
const {
  initializeApp,
  getApps,
  cert
} = require('firebase-admin/app');

const { getAuth } = require('firebase-admin/auth');

// Check required Firebase environment variables
const requiredVariables = [
  'FIREBASE_PROJECT_ID',
  'FIREBASE_CLIENT_EMAIL',
  'FIREBASE_PRIVATE_KEY'
];

for (const variable of requiredVariables) {
  if (!process.env[variable]) {
    throw new Error(
      `Firebase configuration error: ${variable} is missing from environment variables.`
    );
  }
}

// Prepare Firebase service account credentials
const serviceAccount = {
  projectId: process.env.FIREBASE_PROJECT_ID,
  clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
};

// Initialize Firebase only once
const firebaseApp =
  getApps().length > 0
    ? getApps()[0]
    : initializeApp({
        credential: cert(serviceAccount)
      });

// Export an interface compatible with admin.auth()
const admin = {
  auth: () => getAuth(firebaseApp)
};

module.exports = admin;
                    