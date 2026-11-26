// ScamSpotter AI — Firebase web app configuration (LIVE).
//
// Project: scamspotter-ai (Spark plan, no billing). Web app: "ScamSpotter Web".
// Console: https://console.firebase.google.com/project/scamspotter-ai/overview
//
// The Firebase web API key and the reCAPTCHA Enterprise site key below are
// client-side identifiers BY DESIGN — they are meant to ship in client code
// and are protected by Firebase App Check + API restrictions, not by secrecy.
// Never put server keys, service-account files or App Check debug tokens here.
export const firebaseConfig = {
  apiKey: 'AIzaSyD_FhmPbA_lLhBDK81GOhcv9yCPRK8Hnns',
  authDomain: 'scamspotter-ai.firebaseapp.com',
  projectId: 'scamspotter-ai',
  storageBucket: 'scamspotter-ai.firebasestorage.app',
  messagingSenderId: '92127086523',
  appId: '1:92127086523:web:5af3d25f0fcc9a2d98669e',
  // reCAPTCHA Enterprise site key for App Check (console > Security > App Check).
  appCheckSiteKey: '6Le3rzIuAAAAAGk_bGUcha1i648P1RiOs4SSDHpP',
  // App Check debug provider is OFF on the hosted site. When this is true the
  // SDK auto-generates a debug token per browser, and any browser whose token
  // is not registered in the console gets "Firebase App Check token is invalid"
  // (HTTP 401) on every AI call — that broke the live site for all visitors.
  // The hosted site must use the reCAPTCHA Enterprise provider above instead
  // (mdeden1618.github.io is in the key's allowed domains). Debug mode stays
  // on only for local dev (workspace root firebase-config.js, whose token
  // "ScamSpotter Dev" is registered in the console).
  appCheckDebug: false,
};
