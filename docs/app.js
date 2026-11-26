/**
 * ScamSpotter AI — check suspicious messages with Firebase AI Logic hybrid inference.
 *
 * Live mode (real Firebase config in firebase-config.js):
 *   Firebase AI Logic, mode PREFER_ON_DEVICE — Gemini Nano on-device when available,
 *   cloud Gemini fallback otherwise. The SDK reports which backend ran via
 *   result.response.inferenceSource ('on_device' | 'in_cloud', normalised to
 *   ON_DEVICE | IN_CLOUD by the app).
 *   App Check (debug provider), Anonymous Auth and Firestore history.
 *
 * Demo mode (firebase-config.js still has placeholder values):
 *   A local keyword heuristic runs in the browser. No message leaves the device,
 *   no Firebase/AI call is made, history is kept in localStorage.
 */
import { firebaseConfig } from './firebase-config.js';

// ---------------------------------------------------------------------------
// Config / mode detection
// ---------------------------------------------------------------------------
const isPlaceholder = (v) => !v || typeof v !== 'string' || v.startsWith('YOUR_');
const isConfigured =
  !isPlaceholder(firebaseConfig.apiKey) && !isPlaceholder(firebaseConfig.projectId);

// ---------------------------------------------------------------------------
// DOM
// ---------------------------------------------------------------------------
const $ = (id) => document.getElementById(id);
const messageInput = $('message-input');
const checkBtn = $('check-btn');
const clearBtn = $('clear-btn');
const statusLine = $('status-line');
const modeBadge = $('mode-badge');
const demoBanner = $('demo-banner');
const errorBanner = $('error-banner');
const resultPanel = $('result-panel');
const inferenceBadge = $('inference-badge');
const verdictBadge = $('verdict-badge');
const confidenceFill = $('confidence-fill');
const confidenceValue = $('confidence-value');
const redFlagsEl = $('red-flags');
const explanationEl = $('explanation');
const recommendedActionEl = $('recommended-action');
const resultMeta = $('result-meta');
const historyList = $('history-list');
const historyHint = $('history-hint');

function showError(msg) {
  errorBanner.textContent = msg;
  errorBanner.hidden = false;
}
function hideError() {
  errorBanner.hidden = true;
  errorBanner.textContent = '';
}
function setStatus(msg) {
  statusLine.textContent = msg;
}
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// ---------------------------------------------------------------------------
// Sample messages (one-tap demos)
// ---------------------------------------------------------------------------
const SAMPLES = {
  prize:
    'CONGRATULATIONS! You have won Rp 5,000,000,000 in the National Lottery! ' +
    'Claim your prize now: http://bit.ly/win-5m-2026 — reply with your bank account ' +
    'details within 24 hours or the prize will be forfeited.',
  telegram:
    '🔥 EXCLUSIVE TOKEN SALE 🔥 Loaded accounts for sale! Premium AI token accounts, ' +
    '100% SAFE & BAN-PROOF, guaranteed profit 10x. Only 5 left! Deposit 0.5 SOL now to ' +
    'reserve yours. DM @KeyCraftShop_Official to buy!',
  bank:
    'Dear customer, your bank account has been LOCKED due to suspicious activity. ' +
    'Verify your identity immediately at http://secure-bank-verify.net/login or your ' +
    'account will be closed within 2 hours. Enter your password and OTP to unlock.',
};

document.querySelectorAll('.sample-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    messageInput.value = SAMPLES[btn.dataset.sample] || '';
    messageInput.focus();
    hideError();
    resultPanel.hidden = true;
  });
});

clearBtn.addEventListener('click', () => {
  messageInput.value = '';
  resultPanel.hidden = true;
  hideError();
  setStatus('Ready.');
  messageInput.focus();
});

// ---------------------------------------------------------------------------
// Demo-mode heuristic analyser (local only, no network, no AI call)
// ---------------------------------------------------------------------------
const RULES = [
  { label: 'Promises a prize, lottery win or reward', score: 2, re: /\b(won|winner|prize|lottery|congratulations|claim your (prize|reward)|you have been selected)\b/i },
  { label: 'Creates urgency or threatens (act now, account locked, expires)', score: 1, re: /\b(urgent|immediately|act now|limited time|within \d+ hours?|expires?|locked|suspended|closed within|last chance|hurry)\b/i },
  { label: 'Contains a link (often shortened or suspicious domain)', score: 2, re: /(https?:\/\/\S+|bit\.ly|t\.me|wa\.me|tinyurl|goo\.gl|\.xyz|\.top|\.net\/)/i },
  { label: 'Asks for money, a payment, crypto or a deposit', score: 2, re: /\b(deposit|send money|transfer|pay(ment)?|crypto|wallet|sol\b|btc\b|usdt|bank account|wire)\b/i },
  { label: 'Asks for a password, OTP, PIN or seed phrase', score: 2, re: /\b(password|otp|one[- ]time (code|password)|pin\b|seed phrase|recovery phrase|verification code)\b/i },
  { label: 'Too-good-to-be-true promise (guaranteed, 100% safe, ban-proof, 10x)', score: 2, re: /\b(100%\s*safe|ban-proof|guaranteed|risk-free|double your money|\d+x (profit|return)|no risk)\b/i },
  { label: 'Impersonates a bank, official support or authority', score: 1, re: /\b(bank|official|support team|security team|admin|headquarters|customer service)\b/i },
  { label: 'Offers loaded accounts, token sales or presales', score: 2, re: /\b(loaded accounts?|token sale|presale|exclusive sale|buy (now|tokens?)|dm to buy)\b/i },
];

function analyseWithHeuristic(message) {
  const flags = [];
  let score = 0;
  for (const rule of RULES) {
    if (rule.re.test(message)) {
      flags.push(rule.label);
      score += rule.score;
    }
  }
  if (score >= 5) {
    return {
      verdict: 'scam',
      confidence: Math.min(95, 85 + score),
      red_flags: flags,
      explanation:
        `This message shows ${flags.length} strong scam signals, including ${flags.slice(0, 2).join('; ').toLowerCase()}. ` +
        'Legitimate organisations do not announce billion-rupiah prizes by text, demand urgent payments, or ask for passwords and OTPs.',
      recommended_action:
        'Do NOT click any link, do NOT reply, and do NOT send money, passwords, OTPs or seed phrases. Delete the message and report it as spam/phishing in your messaging app.',
    };
  }
  if (score >= 3) {
    return {
      verdict: 'suspicious',
      confidence: Math.min(78, 60 + score * 4),
      red_flags: flags,
      explanation:
        `This message shows ${flags.length} warning sign(s). It may be legitimate, but the pattern is commonly used in scams — verify it before acting on it.`,
      recommended_action:
        'Do not click links or share codes yet. Verify through an official channel (official app, official website or phone number you already know), never through links in the message.',
    };
  }
  return {
    verdict: 'safe',
    confidence: Math.max(55, 82 - score * 6),
    red_flags: flags.length ? flags : [],
    explanation:
      'No strong scam signals were found in this message. It reads like an ordinary message, but stay alert: unexpected messages asking for money or personal data are always worth a second look.',
    recommended_action:
      'No urgent action needed. If this message came from an unknown sender, do not reply with personal information.',
  };
}

// ---------------------------------------------------------------------------
// Firebase AI Logic (live mode)
// ---------------------------------------------------------------------------
let firebase = null; // { app, ai, model, auth, db, addDoc, collection, serverTimestamp }

const RESULT_SCHEMA = {
  type: 'object',
  properties: {
    verdict: { type: 'string', enum: ['safe', 'suspicious', 'scam'] },
    confidence: { type: 'number' },
    red_flags: { type: 'array', items: { type: 'string' } },
    explanation: { type: 'string' },
    recommended_action: { type: 'string' },
  },
  required: ['verdict', 'confidence', 'red_flags', 'explanation', 'recommended_action'],
};

const ANALYSIS_PROMPT = `You are a scam-detection analyst. Analyse the message below and decide whether it is a scam, suspicious, or safe. Look for: fake prizes or lotteries, urgency or threats (account locked, act now), requests for money, passwords, OTPs or seed phrases, shortened or suspicious links, impersonation of banks or official support, and too-good-to-be-true promises (guaranteed profit, 100% safe, ban-proof).

Return ONLY a JSON object with this exact shape:
{"verdict": "safe" | "suspicious" | "scam", "confidence": <0-100>, "red_flags": ["..."], "explanation": "...", "recommended_action": "..."}

Message to analyse:
"""`;

function extractJson(text) {
  const cleaned = String(text).replace(/```(?:json)?/gi, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) throw new Error('Model did not return JSON.');
  return JSON.parse(cleaned.slice(start, end + 1));
}

function normaliseResult(raw) {
  const verdict = ['safe', 'suspicious', 'scam'].includes(raw.verdict) ? raw.verdict : 'suspicious';
  const confidence = Math.max(0, Math.min(100, Math.round(Number(raw.confidence) || 50)));
  return {
    verdict,
    confidence,
    red_flags: Array.isArray(raw.red_flags) ? raw.red_flags.map(String) : [],
    explanation: String(raw.explanation || 'No explanation provided.'),
    recommended_action: String(raw.recommended_action || 'Verify through official channels before acting.'),
  };
}

async function checkOnDeviceAvailability() {
  // Chrome Prompt API (Gemini Nano). Returns 'available' | 'downloading' |
  // 'downloadable' | 'unavailable' — or 'unavailable' when not a supported browser.
  try {
    if (typeof window !== 'undefined' && window.LanguageModel && window.LanguageModel.availability) {
      return await window.LanguageModel.availability();
    }
  } catch (e) {
    console.warn('LanguageModel.availability() failed:', e);
  }
  return 'unavailable';
}

async function initFirebase() {
  const { initializeApp } = await import('firebase/app');
  const { getAI, getGenerativeModel, GoogleAIBackend, InferenceMode } = await import('firebase/ai');
  const { getAuth, signInAnonymously } = await import('firebase/auth');
  const { getFirestore, collection, addDoc, query, orderBy, limit, onSnapshot, serverTimestamp } =
    await import('firebase/firestore');

  const app = initializeApp(firebaseConfig);

  // App Check (debug provider for local dev / submissions).
  // Set self.FIREBASE_APPCHECK_DEBUG_TOKEN = true BEFORE initializeAppCheck,
  // then register the printed debug token in the Firebase console (App Check > Apps).
  if (firebaseConfig.appCheckSiteKey) {
    try {
      const { initializeAppCheck, ReCaptchaEnterpriseProvider } = await import('firebase/app-check');
      if (firebaseConfig.appCheckDebug && !self.FIREBASE_APPCHECK_DEBUG_TOKEN) {
        // Only auto-generate when no debug token was set already (e.g. a
        // registered token injected before page load takes precedence).
        self.FIREBASE_APPCHECK_DEBUG_TOKEN = true;
      }
      initializeAppCheck(app, {
        provider: new ReCaptchaEnterpriseProvider(firebaseConfig.appCheckSiteKey),
        isTokenAutoRefreshEnabled: true,
      });
    } catch (e) {
      console.warn('App Check initialisation failed (continuing without it):', e);
    }
  } else {
    console.warn('No appCheckSiteKey in firebase-config.js — App Check skipped. Add one to enable it.');
  }

  const auth = getAuth(app);
  try {
    await signInAnonymously(auth);
  } catch (e) {
    console.warn('Anonymous sign-in failed (enable Anonymous Auth in the Firebase console):', e);
    setStatus('Signed in anonymously failed — history saving may not work. AI check still available.');
  }

  const ai = getAI(app, { backend: new GoogleAIBackend() });
  // Hybrid inference: prefer the on-device model (Gemini Nano), fall back to the
  // cloud-hosted model. Structured output: JSON schema in the cloud, the same
  // schema as responseConstraint on-device.
  const model = getGenerativeModel(ai, {
    // Hybrid mode: top-level `model` is ignored by the SDK (only `mode`,
    // `inCloudParams` and `onDeviceParams` are read). The cloud model goes
    // in inCloudParams; the on-device model is Gemini Nano, selected
    // automatically by the SDK. If inCloudParams were omitted entirely the
    // SDK would default to 'gemini-3.5-flash-lite'.
    mode: InferenceMode.PREFER_ON_DEVICE,
    inCloudParams: {
      // gemini-2.5-flash returns 404 for new projects ("no longer available
      // to new users"); gemini-3.8-flash returns 500 "high demand" on this
      // project. Use the SDK's own default cloud model instead.
      model: 'gemini-3.5-flash-lite',
      generationConfig: {
        responseMimeType: 'application/json',
        responseJsonSchema: RESULT_SCHEMA,
        temperature: 0.2,
      },
    },
    onDeviceParams: {
      promptOptions: { responseConstraint: RESULT_SCHEMA },
    },
  });

  firebase = { app, ai, model, auth, db: getFirestore(app), collection, addDoc, query, orderBy, limit, onSnapshot, serverTimestamp };

  // Live history subscription (Firestore, most recent 10).
  try {
    const q = query(collection(firebase.db, 'checks'), orderBy('createdAt', 'desc'), limit(10));
    onSnapshot(q, (snap) => {
      renderHistory(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    }, (e) => console.warn('History listener failed:', e));
  } catch (e) {
    console.warn('History subscription failed:', e);
  }
}

async function analyseWithAI(message) {
  // initializeDeviceModel() must be called after/on a user interaction
  // (this click) and before generateContent(). It starts the on-device
  // model download in the background if needed; the call below still works
  // and the SDK falls back to the cloud model when the device model is not ready.
  let deviceStatus = 'unavailable';
  try {
    deviceStatus = await checkOnDeviceAvailability();
    if (deviceStatus === 'available' || deviceStatus === 'downloading' || deviceStatus === 'downloadable') {
      firebase.model.initializeDeviceModel((val) => {
        setStatus(`Preparing on-device model… ${Math.round(val * 100)}%`);
      });
    }
  } catch (e) {
    console.warn('initializeDeviceModel failed:', e);
  }

  const result = await firebase.model.generateContent(ANALYSIS_PROMPT + message + '\n"""');
  const response = result.response;
  // The SDK reports inferenceSource as 'on_device' | 'in_cloud' (lowercase
  // snake_case, JS SDK v13). Normalise to the app's internal 'ON_DEVICE' |
  // 'IN_CLOUD' constants; if the field is ever absent, fall back to the
  // capability check performed before the call.
  const rawSource = response.inferenceSource
    ? String(response.inferenceSource).toUpperCase()
    : (deviceStatus === 'available' ? 'ON_DEVICE' : 'IN_CLOUD');
  const source = rawSource === 'ON_DEVICE' ? 'ON_DEVICE' : 'IN_CLOUD';
  const parsed = normaliseResult(extractJson(response.text()));
  return { ...parsed, source };
}

// ---------------------------------------------------------------------------
// History (Firestore in live mode, localStorage in demo mode)
// ---------------------------------------------------------------------------
const DEMO_HISTORY_KEY = 'scamspotter-demo-history';

function loadDemoHistory() {
  try {
    return JSON.parse(localStorage.getItem(DEMO_HISTORY_KEY) || '[]');
  } catch (e) {
    return [];
  }
}

function saveDemoHistory(item) {
  const items = [item, ...loadDemoHistory()].slice(0, 10);
  try {
    localStorage.setItem(DEMO_HISTORY_KEY, JSON.stringify(items));
  } catch (e) {
    console.warn('Could not save demo history:', e);
  }
}

function formatTime(createdAt) {
  try {
    const d = createdAt && typeof createdAt.toDate === 'function'
      ? createdAt.toDate()
      : new Date(createdAt || Date.now());
    return d.toLocaleString();
  } catch (e) {
    return '';
  }
}

function renderHistory(items) {
  // Firestore documents that are not check records (e.g. a setup placeholder
  // document) must never appear in history. A real record always has a
  // verdict and the checked message text.
  const records = (items || []).filter(
    (item) =>
      !!item &&
      ['safe', 'suspicious', 'scam'].includes(item.verdict) &&
      typeof item.message === 'string' &&
      item.message.trim().length > 0,
  );
  historyList.innerHTML = '';
  if (records.length === 0) {
    const li = document.createElement('li');
    li.className = 'history-empty';
    li.textContent = 'No checks yet.';
    historyList.appendChild(li);
    return;
  }
  for (const item of records) {
    const li = document.createElement('li');
    const top = document.createElement('div');
    top.className = 'history-item-top';
    const badge = document.createElement('span');
    badge.className = `history-verdict ${item.verdict || 'suspicious'}`;
    badge.textContent = String(item.verdict || 'suspicious').toUpperCase();
    const when = document.createElement('span');
    when.className = 'history-meta';
    when.textContent = formatTime(item.createdAt) + (item.source ? ` · ${item.source === 'ON_DEVICE' ? 'on-device' : item.source === 'IN_CLOUD' ? 'cloud' : 'demo'}` : '');
    top.appendChild(badge);
    top.appendChild(when);
    const text = document.createElement('p');
    text.className = 'history-text';
    text.textContent = item.message || '';
    li.appendChild(top);
    li.appendChild(text);
    li.addEventListener('click', () => {
      messageInput.value = item.message || '';
      renderResult(item);
      window.scrollTo({ top: resultPanel.offsetTop - 12, behavior: 'smooth' });
    });
    historyList.appendChild(li);
  }
}

async function saveCheck(record) {
  if (isConfigured && firebase) {
    try {
      await firebase.addDoc(firebase.collection(firebase.db, 'checks'), {
        ...record,
        uid: firebase.auth.currentUser ? firebase.auth.currentUser.uid : null,
        createdAt: firebase.serverTimestamp(),
      });
    } catch (e) {
      console.warn('Could not save check to Firestore:', e);
    }
  } else {
    saveDemoHistory({ ...record, createdAt: Date.now() });
    renderHistory(loadDemoHistory());
  }
}

// ---------------------------------------------------------------------------
// Result rendering
// ---------------------------------------------------------------------------
function renderResult(result) {
  const labels = { safe: '✅ Likely Safe', suspicious: '⚠️ Suspicious', scam: '🚨 Likely Scam' };
  verdictBadge.textContent = labels[result.verdict] || result.verdict;
  verdictBadge.className = `verdict ${result.verdict}`;
  confidenceFill.style.width = `${result.confidence}%`;
  confidenceValue.textContent = `${result.confidence}%`;

  redFlagsEl.innerHTML = '';
  if (result.red_flags && result.red_flags.length) {
    for (const flag of result.red_flags) {
      const li = document.createElement('li');
      li.textContent = flag;
      redFlagsEl.appendChild(li);
    }
  } else {
    const li = document.createElement('li');
    li.className = 'none';
    li.textContent = 'No specific red flags found.';
    redFlagsEl.appendChild(li);
  }

  explanationEl.textContent = result.explanation;
  recommendedActionEl.textContent = result.recommended_action;

  const sourceLabel = result.source === 'ON_DEVICE'
    ? 'ON-DEVICE (Gemini Nano)'
    : result.source === 'IN_CLOUD'
      ? 'CLOUD (Gemini)'
      : 'DEMO (local heuristic)';
  inferenceBadge.textContent = sourceLabel;
  inferenceBadge.className = `badge ${result.source === 'ON_DEVICE' ? 'on-device' : result.source === 'IN_CLOUD' ? 'cloud' : 'demo'}`;

  resultMeta.textContent =
    `Checked ${formatTime(result.createdAt || Date.now())} · ` +
    (result.source === 'DEMO'
      ? 'Demo mode — analysed locally in your browser, no AI call was made.'
      : result.source === 'ON_DEVICE'
        ? 'Analysed on this device by Gemini Nano — your message never left the device.'
        : 'Analysed by cloud Gemini via Firebase AI Logic (on-device model was not available).');

  resultPanel.hidden = false;
}

// ---------------------------------------------------------------------------
// Main check flow
// ---------------------------------------------------------------------------
checkBtn.addEventListener('click', async () => {
  const message = messageInput.value.trim();
  if (!message) {
    showError('Please paste a message first.');
    messageInput.focus();
    return;
  }
  hideError();
  checkBtn.disabled = true;
  checkBtn.textContent = 'Checking…';
  setStatus(isConfigured ? 'Analysing with Firebase AI Logic…' : 'Analysing locally (demo mode)…');

  try {
    let result;
    if (isConfigured) {
      if (!firebase) throw new Error('Firebase is not initialised. Check your config and connection, then reload.');
      result = await analyseWithAI(message);
    } else {
      // Demo mode: small delay so the UI state is visible, then local analysis.
      await new Promise((r) => setTimeout(r, 350));
      result = { ...analyseWithHeuristic(message), source: 'DEMO' };
    }
    const record = { message, ...result };
    renderResult(record);
    await saveCheck(record);
    setStatus(
      result.source === 'ON_DEVICE'
        ? 'Done — analysed on-device by Gemini Nano.'
        : result.source === 'IN_CLOUD'
          ? 'Done — analysed by cloud Gemini (on-device model not available).'
          : 'Done — demo analysis (local heuristic).',
    );
  } catch (e) {
    console.error('Check failed:', e);
    showError(`Check failed: ${e.message || e}. ${isConfigured ? 'If the on-device model is still downloading, try again — the SDK falls back to the cloud model.' : ''}`);
    setStatus('Check failed. Please try again.');
  } finally {
    checkBtn.disabled = false;
    checkBtn.textContent = 'Check Message';
  }
});

// ---------------------------------------------------------------------------
// Startup
// ---------------------------------------------------------------------------
async function init() {
  if (!isConfigured) {
    modeBadge.textContent = 'DEMO MODE';
    modeBadge.className = 'badge demo';
    demoBanner.hidden = false;
    historyHint.textContent = 'Demo mode: history is stored only in this browser (localStorage).';
    renderHistory(loadDemoHistory());
    setStatus('Demo mode — local heuristic analysis, no Firebase call.');
    return;
  }

  modeBadge.textContent = 'LIVE';
  modeBadge.className = 'badge live';
  setStatus('Connecting to Firebase…');
  try {
    await initFirebase();
    const deviceStatus = await checkOnDeviceAvailability();
    if (deviceStatus === 'available') {
      setStatus('Ready — on-device model (Gemini Nano) is available; cloud Gemini is the fallback.');
    } else if (deviceStatus === 'downloading' || deviceStatus === 'downloadable') {
      setStatus('Ready — on-device model is downloading; checks will use cloud Gemini until it is ready.');
    } else {
      setStatus('Ready — on-device model is not available in this browser; checks will use cloud Gemini.');
    }
  } catch (e) {
    console.error('Firebase initialisation failed:', e);
    showError(
      'Firebase could not be initialised: ' + (e.message || e) +
      ' Check firebase-config.js and your connection, then reload. ' +
      'No AI check will run until Firebase is connected.',
    );
    modeBadge.textContent = 'FIREBASE ERROR';
    setStatus('Firebase initialisation failed.');
  }
}

init();
