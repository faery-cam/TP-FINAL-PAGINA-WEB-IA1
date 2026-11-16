const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const db = require('../database/db.js');

const maxObras =30;
const validateName = /^[a-zA-Z0-9_]{3,20}$/;

router.get('/login', (req, res) => {
    res.render('login');
});

router.get('/signup', (req, res) => {
    res.render('signup');
});

router.get('/perfil', (req, res) => {
    res.render('perfil');
});

router.post('/signup', (req, res) => {
    const { nombre, email, password } = req.body;
    if(!validateName.test(nombre)){
        return res.send('El nombre debe tener de 3 a 20 caracteres; letras, números o guión bajo sin espacios.')
    }
    if (db.userExists(nombre)) {
        return res.send('Ese nombre de usuario no está disponible.');
    }
    const hash = bcrypt.hashSync(password, 10);
    db.addUser(nombre, email, hash);
    res.redirect('/user/login');
});

router.post('/login', (req, res) => {
    const { nombre, password } = req.body;
    if (!db.userExists(nombre)) {
        return res.send('Usuario o contraseña incorrecta.');
    }
    if (!bcrypt.compareSync(password, db.getHash(nombre))) {
        return res.send('Usuario o contraseña incorrecta.');
    }
    req.session.usuario = nombre;
    res.redirect('/user/perfil');
});

router.get('/logout', (req, res) => {
   req.session.destroy(()=> res.redirect('/'));
});

module.exports = router;