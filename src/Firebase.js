// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";
import { getAuth } from "firebase/auth";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAOn-CWd9skefDxbFQ9E25xDsO1UFM27pY",
  authDomain: "billing-22cd3.firebaseapp.com",
  databaseURL: "https://billing-22cd3-default-rtdb.firebaseio.com",
  projectId: "billing-22cd3",
  storageBucket: "billing-22cd3.firebasestorage.app",
  messagingSenderId: "458477693645",
  appId: "1:458477693645:web:8bbe5c11155b8e77c85784"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Realtime Database and get a reference to the service
export const database = getDatabase(app);

// Initialize Firebase Authentication and get a reference to the service
export const auth = getAuth(app);

export default app;