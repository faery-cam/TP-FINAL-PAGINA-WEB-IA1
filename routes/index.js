/* ========== IMPORTS ========== */
const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { folderObras, folderAvatares } = require('../src/folders.js');

const OBJETIVO = 20; // imágenes que queremos juntar en total (aprox)

// inicio público: junta imágenes de todos los usuarios para la obra comunitaria
router.get('/', (req, res) => {
  const base = folderObras;
  let urls = [];

  if (fs.existsSync(base)) {
    // usuarios que tienen al menos una imagen
    const usuarios = fs.readdirSync(base).filter(u => {
      const carpeta = path.join(base, u);
      return fs.statSync(carpeta).isDirectory()
        && fs.readdirSync(carpeta).some(esImagen);
    });

    // cuántas por usuario: muchas si hay pocos, menos si hay muchos (mínimo 1)
    const porUsuario = usuarios.length > 0
      ? Math.ceil(OBJETIVO / usuarios.length)
      : 1;

    for (const usuario of usuarios) {
      const carpeta = path.join(base, usuario);
      const imgs = mezclar(fs.readdirSync(carpeta).filter(esImagen)).slice(0, porUsuario);
      for (const img of imgs) urls.push('/uploads/obras/' + usuario + '/' + img);
    }
  }
  const mensaje = req.session.mensaje;
  delete req.session.mensaje;

  res.render('index', { urlsObra: mezclar(urls), mensaje });
});

module.exports = router;


/* ===== FUNCIONES ===== */

// extensiones que tomamos como imagen
function esImagen(nombre) {
  return /\.(jpe?g|png|webp|gif)$/i.test(nombre);
}

// mezcla un array (algoritmo Fisher Yates)
function mezclar(arr) {
  const copia = arr.slice();
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia;
}