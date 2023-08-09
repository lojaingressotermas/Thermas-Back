const { initializeApp } = require('firebase-admin/app');
const admin = require("firebase-admin");

const serviceAccount = require("./termas-f37d4-firebase-adminsdk-kkytk-5c9dd90e05.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

module.exports = { admin, db };