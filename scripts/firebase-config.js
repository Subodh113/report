// firebase-config.js - REPLACE the placeholders with your Firebase project values
const firebaseConfig = {
  apiKey: "AIzaSyCS98TwN_CqGLuS1a600P76La7I7t6kJqU",
  authDomain: "facilitymanagement-47470.firebaseapp.com",
  projectId: "facilitymanagement-47470",
  storageBucket: "facilitymanagement-47470.firebasestorage.app",
  messagingSenderId: "638809761503",
  appId: "1:638809761503:web:1a15443eeeee2414aaab6a",
};

// Initialize Firebase (compat)
if (!window.firebaseAppsInitialized) {
  firebase.initializeApp(firebaseConfig);
  window.firebaseAppsInitialized = true;
}
const auth = firebase.auth();
const db = firebase.firestore();
const storage = firebase.storage();
// Single admin email
const adminEmails = ["admin@ifm.com","subodhsingh113@gmail.com"];
