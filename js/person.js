// Arranque de la página pública de una persona: /daniel, /matias, /iker, /karin.
import { loadCv, downloadPdf } from "./store.js";
import { renderCv } from "./render.js";

const slug = document.body.dataset.slug;
const main = document.getElementById("cv");

try {
  const res = await loadCv(slug);
  if (res && res.cv) {
    document.documentElement.lang = res.cv.lang || "es";
    document.title = `${res.cv.name} · Nanton Hub`;
    main.replaceChildren(renderCv(res.cv));
    const btn = document.getElementById("pdf");
    if (res.pdf) {
      // PDF subido desde el editor: se descarga de Firestore al pulsar.
      btn.hidden = false;
      btn.addEventListener("click", (ev) => {
        ev.preventDefault();
        downloadPdf(slug, res.pdf.name).catch((e) => alert("No se pudo descargar: " + e.message));
      });
    } else {
      // Respaldo: cv.pdf dentro de la carpeta del sitio, si existe.
      fetch("cv.pdf", { method: "HEAD" }).then((r) => { if (r.ok && btn) btn.hidden = false; }).catch(() => {});
    }
  } else {
    main.hidden = true;
    document.getElementById("empty").hidden = false;
  }
} catch (e) {
  console.error(e);
  main.textContent = "No se pudo mostrar el currículo: " + e.message;
}
