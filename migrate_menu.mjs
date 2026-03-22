import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, setDoc, doc } from "firebase/firestore";

const configA = {
  apiKey: "AIzaSyDlU-O-Z9-gi260kjMp9-3_rJ8zJlZKVVU",
  authDomain: "yoguice-cdaae.firebaseapp.com",
  projectId: "yoguice-cdaae",
  storageBucket: "yoguice-cdaae.firebasestorage.app",
  messagingSenderId: "115939651224",
  appId: "1:115939651224:web:d1f728757c2af0ec48eaed",
};

const configB = {
  apiKey: "AIzaSyC9lpZkFLAGz5aPd6ZgKEOEeddyjvwWlKQ",
  authDomain: "yogu-ice-carapungo.firebaseapp.com",
  projectId: "yogu-ice-carapungo",
  storageBucket: "yogu-ice-carapungo.firebasestorage.app",
  messagingSenderId: "153730189364",
  appId: "1:153730189364:web:e8ccfe96a708f76013a261",
};

const appA = initializeApp(configA, "appA");
const appB = initializeApp(configB, "appB");

const dbA = getFirestore(appA);
const dbB = getFirestore(appB);

async function copyCollection(colName) {
  console.log(`======================`);
  console.log(`➡️  Copying /${colName}...`);
  try {
    const snapshot = await getDocs(collection(dbA, colName));
    console.log(`Found ${snapshot.docs.length} documents.`);
    
    let copied = 0;
    for (const document of snapshot.docs) {
      await setDoc(doc(dbB, colName, document.id), document.data());
      copied++;
    }
    console.log(`✅ Successfully copied ${copied} documents to ${colName}`);
  } catch (err) {
    console.error(`❌ Error copying ${colName}:`, err.message);
  }
}

async function run() {
  console.log("🚀 Starting database migration from Calderón to Carapungo...");
  await copyCollection("productos");
  await copyCollection("opciones");
  await copyCollection("tipos_gastos");
  console.log("🎉 Migration complete!");
  process.exit();
}

run();
