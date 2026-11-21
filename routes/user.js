const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const fs = require('fs');
const path = require('path');
const { formidable } = require('formidable');
const db = require('../database/db.js');

const maxObras = 30;
const validateName = /^[a-zA-Z0-9_]{3,20}$/;

function carpetaDe(nombre) {
    return path.join(__dirname, '../public/uploads', nombre);
}

function requireLogin(req, res, next) {
    if (!req.session.usuario) return res.redirect('/user/login');
    next();
}

router.get('/login', (req, res) => {
    res.render('login');
});

router.get('/signup', (req, res) => {
    res.render('signup');
});

router.post('/signup', (req, res) => {
    const { nombre, email, password } = req.body;
    if (!validateName.test(nombre)) {
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
    req.session.destroy(() => res.redirect('/'));
});

router.get('/perfil', requireLogin, (req, res) => {
    const nombre = req.session.usuario;
    const carpeta = carpetaDe(nombre);
    const imagenes = fs.existsSync(carpeta) ? fs.readdirSync(carpeta) : [];
    res.render('perfil', { nombre, imagenes });
});

router.post('/perfil/obras', requireLogin, (req, res) => {
    const carpeta = carpetaDe(req.session.usuario);
    fs.mkdirSync(carpeta, { recursive: true });

    const lugar = maxObras - fs.readdirSync(carpeta).length;
    if (lugar <= 0) {
        return res.send(`Llegaste al máximo de ${maxObras} obras.`);
    }

    const formulario = formidable({
        uploadDir: carpeta,
        keepExtensions: true,
        maxFiles: lugar,
        filter: ({ mimetype }) => mimetype && mimetype.startsWith('image/')
    });

    formulario.parse(req, (err) => {
        if (err) return res.send('No se pudieron subir las imágenes.');
        res.redirect('/user/perfil');
    });
});

module.exports = router;