# Nanton Hub

Sitio estático (Vercel) con currículos de la familia guardados en Firestore.

## Estructura
- `index.html`: portada con apps y enlaces a cada persona.
- `daniel/`, `matias/`, `iker/`, `karin/`: una carpeta por persona; todas usan el mismo molde y `js/person.js`.
- `editar/`: formulario para editar currículos (inicio de sesión con Google).
- `js/config.js`: datos del proyecto de Firebase y lista de personas.
- `js/store.js`: única capa que habla con Firebase.
- `js/render.js`: dibuja un currículo (JSON) como HTML.
- `data/<persona>.json`: contenido inicial y respaldo si Firestore no responde.
- `firestore.rules`: reglas de seguridad.

## Modelo de datos
- `people/{slug}`: currículo vigente (`current`), `version`, `updatedAt`. Lectura pública.
- `people/{slug}/versions/{id}`: historial. Solo editores; no se modifica ni se borra.
- `members/{correo}`: `{ slug, admin }`. Se crea a mano en la consola de Firebase.

## Agregar una persona
1. Copie una carpeta existente y cambie `data-slug` y el título en su `index.html`.
2. Agregue `["slug", "Nombre"]` en `PEOPLE` de `js/config.js`.
3. Cree el documento `members/<correo>` con `slug`.

## Agregar un PDF
Suba `cv.pdf` a la carpeta de la persona. El botón de descarga aparece solo.
