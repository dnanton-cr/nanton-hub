// Arranque de la página pública de una persona: /daniel, /matias, /iker, /karin.
import { loadCv } from "./store.js";
import { renderCv } from "./render.js";

const slug = document.body.dataset.slug;
const main = document.getElementById("cv");

try {
  const res = await loadCv(slug);
  if (res) {
    document.documentElement.lang = res.cv.lang || "es";
    document.title = `${res.cv.name} · Nanton Hub`;
    main.replaceChildren(renderCv(res.cv));
    // El botón de descarga solo aparece si existe cv.pdf en la carpeta de la persona.
    fetch("cv.pdf", { method: "HEAD" }).then((r) => {
      const btn = document.getElementById("pdf");
      if (r.ok && btn) btn.hidden = false;
    }).catch(() => {});
  } else {
    main.hidden = true;
    document.getElementById("empty").hidden = false;
  }
} catch (e) {
  console.error(e);
  main.textContent = "No se pudo mostrar el currículo: " + e.message;
}
