import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
    apiKey: "AIzaSyA-hwI1H5Th8tMu5Sqls8dKU2fYStlTR_c",
    authDomain: "pharmasocii.firebaseapp.com",
    projectId: "pharmasocii",
    storageBucket: "pharmasocii.firebasestorage.app",
    messagingSenderId: "943903316949",
    appId: "1:943903316949:web:f4ebdc993e3c91236ebb5c"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

export default app;
