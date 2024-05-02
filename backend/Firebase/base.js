import { initializeApp } from "firebase/app";
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  deleteDoc,
} from "firebase/firestore/lite";
import dotenv from "dotenv";

dotenv.config();

const firebaseConfig = {
  apiKey: process.env.API_KEY,
  authDomain: process.env.AUTH_DOMAIN,
  databaseURL: process.env.DATABASE_URL,
  projectId: process.env.PROJECT_ID,
  storageBucket: process.env.STORAGE_BUCKET,
  messagingSenderId: process.env.MESSAGING_SENDER_ID,
  appId: process.env.APP_ID,
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

var valid_fields = new Map([
  ["posts", new Set(["poster_id"])],
  [
    "users",
    new Set([
      "access_token",
      "app_streak",
      "expiration_time",
      "friends",
      "playlist_id",
      "refresh_token",
      "snapshot_playlist_id",
      "username",
    ]),
  ],
  ["views", new Set(["post_id"])],
]);

async function check(collection, document) {
  const docSnap = await getDoc(doc(db, collection, document) );
  return docSnap.exists();
}

async function add(collection, document, fields) {
  if (!valid_fields.has(collection)) {
    throw new Error("collection invalid.");
  }
  if (await check(collection, document)) {
    throw new Error("document already exists.");
  }
  const fieldsKeys = Object.keys(fields);
  if (
    fieldsKeys.length !== valid_fields.get(collection).size ||
    !fieldsKeys.every((key) => valid_fields.get(collection).has(key))
  ) {
    throw new Error(
      "Fields object must contain exactly and only the valid fields."
    );
  }
  try {
    await setDoc(doc(db, collection, document), fields);
    // console.log("Document written");
  } catch (error) {
    console.error("Error adding document: ", error);
  }
}

// `field` is optional
async function get(collection, document, field) {
  if (!valid_fields.has(collection)) {
    throw new Error(
      "collection invalid."
    );
  }
  if (!await check(collection, document)) {
    throw new Error("document doesn't exists.");
  }
  if (field && !valid_fields.get(collection).has(field)) {
    throw new Error(`Invalid field: ${field}`);
  }
  const userRef = doc(db, collection, document);
  try {
    const userDoc = await getDoc(userRef);
    if (userDoc.exists()) {
      const userData = userDoc.data();
      // console.log("Document data:", field ? userData[field] : userData);
      return field ? userData[field] : userData;
    } else {
      // console.log("No such document!");
    }
  } catch (error) {
    console.error("Error getting document:", error);
  }
}

async function update(collection, document, fields) {
  if (!valid_fields.has(collection)) {
    throw new Error(
      "collection invalid."
    );
  }
  if (!await check(collection, document)) {
    throw new Error("document doesn't exists.");
  }
  for (const key of Object.keys(fields)) {
    if (!valid_fields.get(collection).has(key)) {
      throw new Error(`Invalid field: ${key}`);
    }
  }
  const userRef = doc(db, collection, document);
  try {
    await updateDoc(userRef, fields);
    // console.log("Document updated");
  } catch (error) {
    console.error("Error updating document: ", error);
  }
}

async function remove(collection, document) {
  if (!valid_fields.has(collection)) {
    throw new Error("collection invalid.");
  }
  if (!await check(collection, document)) {
    throw new Error("document doesn't exists.");
  }
  const docRef = doc(db, collection, document);
  try {
    await deleteDoc(docRef);
    // console.log("Document deleted");
  } catch (error) {
    console.error("Error deleting document: ", error);
  }
}

export { add, get, update, check, remove };