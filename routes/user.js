const express = require('express');
const router = express.Router();


/* modelo de clase MODIFICAR */
router.get('/user', (req, res) => {
  console.log('sub ruta /user');
  res.send('<h1>Ruta de usuario</h1>');
});

router.get('/user/:dato', (req, res) => {
  console.log('sub ruta /user');
  res.send('<h1>Sub ruta variable</h1>');
});

module.export= router;