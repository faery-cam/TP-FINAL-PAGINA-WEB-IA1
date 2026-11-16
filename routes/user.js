const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const db = require('../database/db.js');

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
    if (!req.session.usuario) return res.redirect('/user/login');
    res.render('perfil', { nombre: req.session.usuario, pageTitle: 'Perfil' });
});

module.exports = router;