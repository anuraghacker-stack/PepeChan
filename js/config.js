import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js";

// Ваши настройки Firebase
const firebaseConfig = {
  apiKey: "AIzaSyD0drXAAP2LQSbHloYq2YUIaw4YS-mKv-Y",
  authDomain: "pepechan-board.firebaseapp.com",
  projectId: "pepechan-board",
  storageBucket: "pepechan-board.firebasestorage.app",
  messagingSenderId: "805918011698",
  appId: "1:805918011698:web:2c8fa7ba6e76cf9648672b"
};

// Инициализация приложения
const app = initializeApp(firebaseConfig);

// Инициализация сервисов
const db = getFirestore(app);
const auth = getAuth(app);

// ID коллекции в базе данных (не меняйте это, если хотите сохранить старые посты)
const appId = 'pepechan-public-v1'; 

// Экспорт для использования в других файлах (app.js)
export { app, db, auth, appId };