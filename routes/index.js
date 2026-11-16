const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

const IMAGENES_POR_USUARIO = 2; // para probar con pocos usuarios, subilo (ej: 30)

// extensiones que tomamos como imagen
function esImagen(nombre) {
  return /\.(jpe?g|png|webp|gif)$/i.test(nombre);
}

// mezcla un array (orden al azar)
function mezclar(arr) {
  const copia = arr.slice();
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia;
}

// inicio público: junta imágenes de todos los usuarios para la obra comunitaria
router.get('/', (req, res) => {
  const base = path.join(__dirname, '..', 'public', 'uploads');
  let urls = [];

  if (fs.existsSync(base)) {
    for (const usuario of fs.readdirSync(base)) {
      const carpeta = path.join(base, usuario);
      if (!fs.statSync(carpeta).isDirectory()) continue;

      const imgs = mezclar(fs.readdirSync(carpeta).filter(esImagen)).slice(0, IMAGENES_POR_USUARIO);
      for (const img of imgs) urls.push('/uploads/' + usuario + '/' + img);
    }
  }

  res.render('index', { urlsObra: mezclar(urls) });
});

module.exports = router;