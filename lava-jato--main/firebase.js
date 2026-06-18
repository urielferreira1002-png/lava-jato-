// firebase.js
// Ponto único de inicialização do Firebase para todo o projeto.
// TODOS os outros arquivos (Db.js, admin.js, login.js) devem importar
// "app", "db", "auth" e "storage" deste arquivo — nunca inicializar o
// Firebase em outro lugar, para evitar instâncias duplicadas.

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";
// BUG CORRIGIDO: o módulo de Authentication nunca era importado nem
// inicializado aqui, mas admin.js e login.js tentavam usar "auth"
// importado deste arquivo. Isso fazia "auth" chegar como "undefined"
// e qualquer chamada de onAuthStateChanged/signOut/signIn quebrava.
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyCrli7CUws1Yf4HdKtqoeT-knklaYjTDI0",
  authDomain: "lava-jato-express-2b669.firebaseapp.com",
  projectId: "lava-jato-express-2b669",
  storageBucket: "lava-jato-express-2b669.firebasestorage.app",
  messagingSenderId: "811300124806",
  appId: "1:811300124806:web:237866dc8f2d37a7527907"
};

const app = initializeApp(firebaseConfig);

const db = getFirestore(app);
const storage = getStorage(app);
const auth = getAuth(app);

const firebaseConfigured = true;

export {
  app,
  db,
  storage,
  auth,
  firebaseConfigured
};

console.log("Firebase conectado! (app, db, storage, auth prontos)");