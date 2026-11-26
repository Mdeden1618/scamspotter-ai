// ScamSpotter AI — Firebase web app configuration (EXAMPLE).
//
// Copy this file to firebase-config.js and replace the placeholder values with
// your own from the Firebase console (Project settings > Your apps > Web app).
// See README.md for the full setup checklist.
//
// The Firebase web API key and reCAPTCHA Enterprise site key are
// client-side identifiers BY DESIGN — they are meant to ship in client code
// and are protected by Firebase App Check + API restrictions, not by secrecy.
// The firebase-config.js in this project therefore contains the live config
// and is committed to the repo. Never put server keys, service-account files
// or App Check debug tokens in it.
export const firebaseConfig = {
  // Web API key (Project settings > General > Your apps).
  apiKey: 'YOUR_API_KEY',
  // e.g. my-project.firebaseapp.com
  authDomain: 'YOUR_PROJECT_ID.firebaseapp.com',
  projectId: 'YOUR_PROJECT_ID',
  // e.g. my-project.firebasestorage.app
  storageBucket: 'YOUR_PROJECT_ID.firebasestorage.app',
  messagingSenderId: 'YOUR_MESSAGING_SENDER_ID',
  // Web app ID, e.g. 1:123456789012:web:abcdef1234567890
  appId: 'YOUR_APP_ID',
  // Optional: reCAPTCHA Enterprise site key for App Check
  // (Firebase console > Security > App Check). Leave empty to skip App Check.
  appCheckSiteKey: '',
  // Use the App Check debug provider. Debug tokens are accepted in
  // BuildHybridAI submissions. Set to false in production.
  appCheckDebug: true,
};
