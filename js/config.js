export const firebaseConfig = {
  apiKey: "AIzaSyCi1521BC-Y49VGT7ohT--n61ccMhHDlTA",
  authDomain: "nanton-hub.firebaseapp.com",
  projectId: "nanton-hub",
  appId: "1:843704194547:web:48f20b5150cd53cd21ee86"
};

export const FIREBASE_ENABLED = !String(firebaseConfig.apiKey).startsWith("PEGAR");

// Personas del sitio: [identificador de la carpeta y del documento, nombre visible].
export const PEOPLE = [
  ["daniel", "Daniel"],
  ["matias", "Matias"],
  ["iker", "Iker"],
  ["karin", "Karin"]
];

