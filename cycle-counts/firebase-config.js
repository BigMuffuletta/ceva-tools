// Firebase web app config for cycle count requests.
// Use a separate Firebase project from the dock board: customers sign in here, so keep them out of internal tools.
// Get it from the Firebase console: Project settings (gear icon) → General → Your apps → Web app → "SDK setup and configuration" → Config.
// These values identify the project; they are not secrets. Access is controlled by firestore.rules and sign-in.
// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyAIMnik5UPd0cA6sg9OiaGEmdO3cH-AL_E",
  authDomain: "ceva-cycle-counts-request.firebaseapp.com",
  projectId: "ceva-cycle-counts-request",
  storageBucket: "ceva-cycle-counts-request.firebasestorage.app",
  messagingSenderId: "289370932489",
  appId: "1:289370932489:web:a4add2fdc43c4006a6bfd8",
  measurementId: "G-GQWHN6HY2F"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
