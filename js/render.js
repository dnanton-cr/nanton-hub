// Dibuja un currículo (objeto JSON) como HTML. No depende de Firebase.
// Todo el texto entra con textContent, así que el contenido guardado nunca se interpreta como HTML.

const LABELS = {
  en: { summary: "Summary of qualifications", skills: "Core competencies and technical skills",
        experience: "Professional experience", projects: "Entrepreneurial and innovation projects",
        education: "Education and certifications", extra: "Additional information", download: "Download PDF" },
  es: { summary: "Resumen profesional", skills: "Competencias y habilidades técnicas",
        experience: "Experiencia profesional", projects: "Proyectos y emprendimientos",
        education: "Formación y certificaciones", extra: "Información adicional", download: "Descargar PDF" }
};
export const labels = (lang) => LABELS[lang] || LABELS.es;

export function h(tag, attrs = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null) continue;
    if (k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v);
  }
  for (const kid of kids.flat()) if (kid != null) el.append(kid);
  return el;
}

// Texto con **negrita** → fragmento seguro.
function rich(text) {
  const frag = document.createDocumentFragment();
  String(text).split(/(\*\*[^*]+\*\*)/).forEach((part) => {
    if (/^\*\*[^*]+\*\*$/.test(part)) frag.append(h("b", {}, part.slice(2, -2)));
    else if (part) frag.append(part);
  });
  return frag;
}

const list = (items) => h("ul", { class: "pts" }, (items || []).map((x) => h("li", {}, rich(x))));

function jobs(items) {
  return (items || []).map((j) => {
    const role = h("p", { class: "role" }, j.role || "");
    if (j.url) {
      role.append(role.textContent ? " · " : "");
      const safe = /^https?:\/\//i.test(j.url) ? j.url : "#";
      role.append(h("a", { href: safe, target: "_blank", rel: "noopener", class: "lnk" }, j.url.replace(/^https?:\/\//i, "")));
    }
    return h("div", { class: "job" },
      h("div", { class: "job-top" }, h("b", {}, j.org || ""), h("span", { class: "when" }, j.period || "")),
      role, list(j.bullets));
  });
}

export function renderCv(cv) {
  const L = labels(cv.lang);
  const c = cv.contact || {};
  const contact = h("p", {});
  [c.location, c.phone, c.email, c.linkedin && "LinkedIn: " + c.linkedin, c.languages]
    .filter(Boolean).forEach((line, i) => { if (i) contact.append(h("br")); contact.append(line); });

  const art = h("article", { class: "cv" },
    h("div", { class: "cv-head" }, h("div", {}, h("h2", {}, cv.name || ""), h("p", {}, cv.headline || "")), contact),
    h("div", { class: "actions" }, h("a", { class: "btn", id: "pdf", href: "cv.pdf", hidden: "" }, L.download)));

  const section = (title, body) => body && art.append(h("h3", {}, title), body);
  if (cv.summary) section(L.summary, h("p", {}, cv.summary));
  if (cv.skills?.length) section(L.skills, list(cv.skills));
  if (cv.experience?.length) section(L.experience, h("div", {}, jobs(cv.experience)));
  if (cv.projects?.length) section(L.projects, h("div", {}, jobs(cv.projects)));
  if (cv.education?.length) section(L.education, list(cv.education));
  if (cv.extra?.length) section(L.extra, list(cv.extra));
  return art;
}
