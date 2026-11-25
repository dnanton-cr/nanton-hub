// Editor de currículos: formulario + historial de versiones. Usa solo las funciones de js/store.js.
import { h } from "../js/render.js";
import { PEOPLE, FIREBASE_ENABLED } from "../js/config.js";
import { loadCv, saveCv, savePdf, PDF_MAX_BYTES, listVersions, signIn, signOutUser, onUser, getMember } from "../js/store.js";

const root = document.getElementById("editor");
const msg = h("p", { class: "msg", role: "status" });
const say = (text, bad) => { msg.textContent = text; msg.className = "msg" + (bad ? " bad" : ""); };
const lines = (s) => s.split("\n").map((x) => x.trim()).filter(Boolean);
const blank = () => ({ lang: "es", name: "", headline: "", contact: {}, summary: "", skills: [], experience: [], projects: [], education: [], extra: [] });

if (!FIREBASE_ENABLED) {
  root.append(h("div", { class: "empty" }, h("h2", {}, "Firebase sin configurar"),
    h("p", {}, "Pegue los datos de su proyecto en js/config.js y vuelva a publicar el sitio.")));
} else {
  start();
}

function start() {
  const bar = h("div", { class: "actions" });
  const app = h("div", { hidden: "" });
  root.append(bar, msg, app);
  let built = false;

  onUser(async (user) => {
    bar.replaceChildren();
    if (!user) {
      app.hidden = true;
      bar.append(h("button", { class: "btn", type: "button", onclick: () => signIn().catch((e) => say(e.message, true)) }, "Entrar con Google"));
      say("");
      return;
    }
    bar.append(h("span", { class: "sub", style: "margin:0;align-self:center" }, user.email),
      h("button", { class: "btn ghost", type: "button", onclick: () => signOutUser() }, "Salir"));
    let member;
    try { member = await getMember(user.email); } catch (e) { say("No se pudo verificar el acceso: " + e.message, true); return; }
    if (!member) { app.hidden = true; say("Este correo no está autorizado para editar. Pida a Daniel que lo agregue.", true); return; }
    const allowed = member.admin ? PEOPLE : PEOPLE.filter((p) => p[0] === member.slug);
    if (!built) { buildApp(app, user, allowed); built = true; }
    app.hidden = false;
  });
}

function buildApp(app, user, allowed) {
  let slug = allowed[0][0];
  const F = {};

  const field = (parent, key, label, { area = false, rows = 3, hint } = {}) => {
    const el = h(area ? "textarea" : "input", { id: "f-" + key, rows: area ? rows : null });
    F[key] = el;
    parent.append(h("label", { class: "f" }, h("span", {}, label), el, hint ? h("small", {}, hint) : null));
    return el;
  };

  const personSel = h("select", { id: "person" }, allowed.map(([s, n]) => h("option", { value: s }, n)));
  const langSel = h("select", { id: "lang" }, h("option", { value: "es" }, "Español"), h("option", { value: "en" }, "English"));
  const top = h("div", { class: "row2" },
    h("label", { class: "f" }, h("span", {}, "Persona"), personSel),
    h("label", { class: "f" }, h("span", {}, "Idioma del currículo"), langSel));

  const form = h("form", { class: "ed" });
  const basics = h("div", { class: "row2" });
  field(basics, "name", "Nombre completo");
  field(basics, "headline", "Título o puesto");
  field(basics, "location", "Ubicación");
  field(basics, "phone", "Teléfono");
  field(basics, "email", "Correo");
  field(basics, "linkedin", "LinkedIn (usuario)");
  field(form, "languages", "Idiomas");
  form.prepend(basics);
  field(form, "summary", "Resumen profesional", { area: true, rows: 5 });
  field(form, "skills", "Competencias (una por línea)", { area: true, rows: 5, hint: "Use **negrita** entre dobles asteriscos." });

  const jobsBox = (title, addLabel) => {
    const box = h("div", { class: "jobs" });
    const add = h("button", { type: "button", class: "btn ghost sm", onclick: () => box.append(jobBlock({})) }, addLabel);
    form.append(h("h3", { class: "ed-h" }, title), box, add);
    return box;
  };
  const expBox = jobsBox("Experiencia", "Agregar experiencia");
  const projBox = jobsBox("Proyectos y emprendimientos", "Agregar proyecto");
  field(form, "education", "Formación y certificaciones (una por línea)", { area: true, rows: 4 });
  field(form, "extra", "Información adicional (una por línea)", { area: true, rows: 3 });

  function jobBlock(j) {
    const d = h("fieldset", { class: "jobf" });
    const mk = (k, label, val, area) => {
      const el = h(area ? "textarea" : "input", { "data-k": k, rows: area ? 4 : null });
      el.value = val || "";
      d.append(h("label", { class: "f" }, h("span", {}, label), el));
    };
    mk("org", "Organización o proyecto", j.org);
    mk("role", "Cargo", j.role);
    mk("period", "Período", j.period);
    mk("url", "Enlace (opcional)", j.url);
    mk("bullets", "Logros (uno por línea)", (j.bullets || []).join("\n"), true);
    d.append(h("button", { type: "button", class: "btn ghost sm", onclick: () => d.remove() }, "Quitar"));
    return d;
  }
  const readJobs = (box) => [...box.querySelectorAll(":scope > .jobf")].map((d) => {
    const g = (k) => d.querySelector(`[data-k=${k}]`).value.trim();
    const o = { org: g("org"), role: g("role"), period: g("period"), bullets: lines(g("bullets")) };
    if (g("url")) o.url = g("url");
    return o;
  }).filter((o) => o.org || o.role);

  const note = h("input", { id: "note", placeholder: "Nota de la versión (opcional)" });
  const saveBtn = h("button", { class: "btn", type: "submit" }, "Guardar nueva versión");
  form.append(h("div", { class: "savebar" }, note, saveBtn));
  const versions = h("div", { class: "versions" });

  // PDF del currículo (se guarda aparte del formulario)
  const pdfInfo = h("p", { class: "sub" });
  const pdfIn = h("input", { type: "file", accept: "application/pdf", id: "pdf-file" });
  const pdfBox = h("div", { class: "pdfbox" }, h("h3", { class: "ed-h" }, "PDF del currículo"), pdfInfo,
    h("div", { class: "savebar" }, pdfIn, h("button", { type: "button", class: "btn ghost sm", onclick: uploadPdf }, "Subir PDF")),
    h("p", { class: "sub" }, `Máximo ${Math.round(PDF_MAX_BYTES / 1024)} KB. Un PDF nuevo reemplaza al anterior.`));
  const showPdf = (p) => { pdfInfo.textContent = p ? `PDF actual: ${p.name} (${Math.round(p.size / 1024)} KB)` : "Todavía no hay un PDF subido desde el editor."; };

  async function uploadPdf() {
    const f = pdfIn.files[0];
    if (!f) { say("Elija primero un archivo PDF.", true); return; }
    if (f.type !== "application/pdf") { say("El archivo debe ser un PDF.", true); return; }
    if (f.size > PDF_MAX_BYTES) { say(`El PDF pesa ${Math.round(f.size / 1024)} KB y el máximo es ${Math.round(PDF_MAX_BYTES / 1024)} KB. Reduzca su tamaño e intente de nuevo.`, true); return; }
    try {
      say("Subiendo PDF…");
      await savePdf(slug, f.name, new Uint8Array(await f.arrayBuffer()), user);
      showPdf({ name: f.name, size: f.size });
      pdfIn.value = "";
      say(`PDF guardado. Ya se puede descargar desde /${slug}.`);
    } catch (e) { say("No se pudo subir el PDF: " + e.message, true); }
  }

  function fill(cv) {
    const c = cv.contact || {};
    langSel.value = cv.lang || "es";
    F.name.value = cv.name || ""; F.headline.value = cv.headline || "";
    F.location.value = c.location || ""; F.phone.value = c.phone || "";
    F.email.value = c.email || ""; F.linkedin.value = c.linkedin || ""; F.languages.value = c.languages || "";
    F.summary.value = cv.summary || "";
    F.skills.value = (cv.skills || []).join("\n");
    F.education.value = (cv.education || []).join("\n");
    F.extra.value = (cv.extra || []).join("\n");
    expBox.replaceChildren(...(cv.experience || []).map(jobBlock));
    projBox.replaceChildren(...(cv.projects || []).map(jobBlock));
  }
  function read() {
    const contact = {};
    for (const k of ["location", "phone", "email", "linkedin", "languages"]) if (F[k].value.trim()) contact[k] = F[k].value.trim();
    return {
      lang: langSel.value, name: F.name.value.trim(), headline: F.headline.value.trim(), contact,
      summary: F.summary.value.trim(), skills: lines(F.skills.value),
      experience: readJobs(expBox), projects: readJobs(projBox),
      education: lines(F.education.value), extra: lines(F.extra.value)
    };
  }

  async function open(s) {
    slug = s;
    say("Cargando…");
    const res = await loadCv(s);
    fill(res && res.cv ? res.cv : blank());
    showPdf(res ? res.pdf : null);
    say(res ? (res.source === "firestore" ? `Versión ${res.version} cargada desde Firestore.` : "Contenido inicial cargado del archivo. Al guardar se crea la versión 1.") : "Currículo vacío. Llene los campos y guarde.");
    await showVersions();
  }

  async function showVersions() {
    try {
      const list = await listVersions(slug);
      versions.replaceChildren(h("h3", { class: "ed-h" }, "Historial de versiones"),
        list.length ? list.map((v) => h("div", { class: "ver" },
          h("span", {}, `v${v.version} · ${v.at ? v.at.toLocaleString("es-CR") : ""} · ${v.by}${v.note ? " · " + v.note : ""}`),
          h("button", { type: "button", class: "btn ghost sm", onclick: () => { fill(v.cv); say(`Versión ${v.version} cargada en el formulario. Guarde para publicarla como versión nueva.`); } }, "Cargar")))
          : h("p", { class: "sub" }, "Todavía no hay versiones guardadas."));
    } catch (e) { versions.replaceChildren(h("p", { class: "sub" }, "No se pudo leer el historial: " + e.message)); }
  }

  form.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const cv = read();
    if (!cv.name) { say("Escriba al menos el nombre.", true); return; }
    saveBtn.disabled = true;
    try {
      const n = await saveCv(slug, cv, note.value.trim(), user);
      note.value = "";
      say(`Guardado como versión ${n}. Ya se ve en /${slug}.`);
      await showVersions();
    } catch (e) { say("No se pudo guardar: " + e.message, true); }
    saveBtn.disabled = false;
  });
  personSel.addEventListener("change", () => open(personSel.value));

  app.append(top, form, pdfBox, versions);
  open(slug);
}
