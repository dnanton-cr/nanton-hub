// Muestra el botón de descarga solo si el archivo cv.pdf existe en la carpeta de la persona.
(function () {
  var btn = document.getElementById('pdf');
  var empty = document.getElementById('empty');
  if (!btn) return;
  fetch('cv.pdf', { method: 'HEAD' }).then(function (r) {
    if (r.ok) {
      btn.hidden = false;
      if (empty) empty.hidden = true;
    }
  }).catch(function () {});
})();
