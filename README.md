# 🛡️ ScamSpotter AI

Check suspicious messages with hybrid AI — on-device first, in the cloud only when needed.

**Built for the #BuildHybridAI 2026 hackathon (Firebase / Google).**

Paste an SMS, WhatsApp, Telegram or email message that looks suspicious.
ScamSpotter AI analyses it and returns a verdict — **Safe / Suspicious / Likely Scam** —
with a confidence score, the red flags it found, an explanation, and what to do next.

## Why hybrid inference?

- **On-device first (Gemini Nano in Chrome):** the message is analysed right on your
  device. Sensitive messages never leave the phone or computer — private, free, and
  it even works offline. This is the right default for scam checks, where the text
  itself is personal.
- **Cloud fallback (Gemini via Firebase AI Logic):** when no on-device model is
  available, the same check runs on cloud Gemini. You always get an answer.
- Every result carries a badge showing where it ran: **ON-DEVICE (Gemini Nano)** or
  **CLOUD (Gemini)** — read from the SDK's `response.inferenceSource`.

## Firebase products used

| Product | Used for |
|---|---|
| **Firebase AI Logic** | Hybrid inference: `getGenerativeModel({ mode: InferenceMode.PREFER_ON_DEVICE })`, structured JSON output (`responseJsonSchema` in the cloud, `responseConstraint` on-device), `initializeDeviceModel()` on the Check click |
| **App Check** | Protects the AI service. Debug provider for local development and submissions (debug tokens are accepted in BuildHybridAI) |
| **Authentication** | Anonymous sign-in, so checks are saved without an account |
| **Cloud Firestore** | `checks` collection — history of recent checks (tap one to view it again) |

## Run it

No build step. Plain HTML + CSS + ES-module JavaScript; the Firebase JS SDK
(v13.0.0) loads from the Google CDN via an import map.

```bash
# from the project root
python3 -m http.server 8000
# open http://localhost:8000/public/
```

> The app must be served over HTTP(S) — opening `index.html` directly from disk
> will not load ES modules.

## Demo mode (no Firebase needed)

With placeholder values in `firebase-config.js` (see
`firebase-config.example.js`), the app shows a clear **DEMO MODE** badge and analyses messages with a local keyword heuristic
in the browser. No message leaves the device, no Firebase or AI call is made, and
history is kept in `localStorage`. The UI is fully testable in this mode.

## Go live — add your real Firebase config

1. Create a Firebase project at https://console.firebase.google.com
   (free **Spark** plan is enough; skip Google Analytics).
2. Go to **AI Services → AI Logic**, click **Get started**, choose the
   **Gemini Developer API** (free tier). This also enforces App Check.
3. Register a **Web app** in the project and copy its config into `firebase-config.js`.
4. Enable **Anonymous Auth** (Build → Authentication → Sign-in method → Anonymous).
5. Create a **Cloud Firestore** database (Build → Firestore Database, start in
   production mode; add a rule allowing authenticated users to read/write their
   own `checks` documents — see `firestore.rules.example` below).
6. **App Check:** Security → App Check, register the web app with the
   reCAPTCHA Enterprise provider, paste the site key as `appCheckSiteKey` in
   `firebase-config.js`. For local development, keep `appCheckDebug: true` and
   register the debug token printed in the browser console
   (App Check → Apps → Manage debug tokens).
7. On-device model (for testing Gemini Nano): use Chrome on desktop v139+,
   enable `chrome://flags/#prompt-api-for-gemini-nano-multimodal-input`, restart
   Chrome. The app calls `initializeDeviceModel()` on the Check click, as the
   docs require.

```text
# firestore.rules.example (illustrative — adapt to your needs)
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /checks/{checkId} {
      allow read, write: if request.auth != null;
    }
  }
}
```

## Project layout

```text
scamspotter-ai/
├── public/
│   ├── index.html      # UI + Firebase import map (SDK v13.0.0 via CDN)
│   ├── app.js          # Hybrid AI Logic, App Check, Auth, Firestore, demo heuristic
│   └── style.css
├── firebase-config.js          # Live client config (web API key + reCAPTCHA site key — client-safe by design)
├── firebase-config.example.js  # Template for the real config
├── README.md
├── LICENSE             # Apache 2.0
└── .gitignore
```

## How the hybrid call works

```js
import { getAI, getGenerativeModel, GoogleAIBackend, InferenceMode } from 'firebase/ai';

const ai = getAI(firebaseApp, { backend: new GoogleAIBackend() });
const model = getGenerativeModel(ai, {
  mode: InferenceMode.PREFER_ON_DEVICE, // hybrid: top-level `model` is ignored by the SDK
  inCloudParams: {
    model: 'gemini-3.5-flash-lite', // cloud model (fallback); on-device uses Gemini Nano automatically
    generationConfig: {
      responseMimeType: 'application/json',
      responseJsonSchema: RESULT_SCHEMA, // structured JSON output
      temperature: 0.2,
    },
  },
  onDeviceParams: {
    promptOptions: { responseConstraint: RESULT_SCHEMA },
  },
});

// Called on the Check click, before generateContent():
model.initializeDeviceModel((progress) => { /* download progress 0..1 */ });

const result = await model.generateContent(prompt);
const source = result.response.inferenceSource; // 'ON_DEVICE' | 'IN_CLOUD'
const analysis = JSON.parse(result.response.text());
```

The model is asked for structured JSON:
`{ verdict: "safe" | "suspicious" | "scam", confidence: 0–100, red_flags: [], explanation, recommended_action }`.

## Notes & limitations

- On-device inference needs Chrome on desktop v139+ with the Prompt API flag
  enabled and the Gemini Nano model downloaded. Any other browser uses the cloud
  fallback automatically.
- On-device inference supports single-turn text generation only (no chat) — this
  app only needs single-turn classification, so it fits.
- The AI verdict is an opinion, not a guarantee. The UI says so and always advises
  verifying through official channels.
- Demo mode never calls Firebase or any AI service.

## License

Apache 2.0 — see [LICENSE](LICENSE).
