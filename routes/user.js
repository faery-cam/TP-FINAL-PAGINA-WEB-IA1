/* ========== IMPORTS ========== */
const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const fs = require('fs');
const path = require('path');
const { formidable } = require('formidable');
const db = require('../database/db.js');
const { folderObras, folderAvatares } = require('../src/folders.js');
const { groupCollapsed } = require('console');

const maxObras = 30;
const maxVisibleName = 40;
const maxBio = 300;

const validateName = /^[a-zA-Z0-9_]{3,20}$/;
const reservedNames = ['perfil', 'feed', 'login', 'logout', 'signup', 'config', 'editar', 'profAvatar'];

/* ===== RESPUESTAS A PETICIONES (GET/POST) ===== */

router.get('/signup', (req, res) => {
    res.redirect('/#signup');
});

router.get('/login', (req, res) => {
    res.redirect('/#login');
});

router.post('/signup', (req, res) => {
    const { nombre, email, password } = req.body;
    if (!nombre || !email || !password) {
        return mensajeError(req, res, 'signup', "Completá todos los campos.");
    }
    if (!validateName.test(nombre)) {
        return mensajeError(req, res, 'signup', 'El nombre debe tener de 3 a 20 caracteres; letras, números o guión bajo sin espacios.');
    }
    if (reservedNames.includes(nombre.toLowerCase())) {
        return mensajeError(req, res, 'signup', 'Ese nombre de usuario no está disponible.');
    }
    if (db.userExists(nombre)) {
        return mensajeError(req, res, 'signup', 'Ese nombre de usuario no está disponible.');
    }
    const hash = bcrypt.hashSync(password, 10);

    try {
        db.addUser(nombre, email, hash);
    } catch (error) {
        if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
            return mensajeError(req, res, 'signup', "Este correo ya está registrado")
        }
        throw error;
    }
    req.session.mensaje = { form: 'login', texto: 'Cuenta creada. Ya podés ingresar!' }
    res.redirect('/#login');
});

router.post('/login', (req, res) => {
    const { nombre, password } = req.body;
    if (!nombre || !password || !db.userExists(nombre) || !bcrypt.compareSync(password, db.getHash(nombre))) {
        return mensajeError(req, res, 'login', 'Usuario o contraseña incorrecta.');
    }
    const destino = req.session.volver || '/user/perfil';
    delete req.session.volver;
    req.session.usuario = nombre;
    res.redirect(destino);
});

router.get('/logout', (req, res) => {
    req.session.destroy(() => res.redirect('/'));
});

router.get('/perfil', requireLogin, (req, res) => {
    mostrarPerfil(req, res, req.session.usuario);
});


router.post('/perfil/datos', requireLogin, (req, res) => {
    const visibleName = (req.body.visible_name || '').trim();
    const bio = (req.body.bio || '').trim();

    if (visibleName.length < 1 || visibleName.lenght > maxVisibleName) {
        return avisoPerfil(req, res, `Tu nombre debe tener entre 1 y ${maxVisibleName} caracteres.`, '?view=config');
    }
    if (bio.lenght > maxBio) {
        return avisoPerfil(req, res, `Tu biografía no puede superar los ${maxBio} caracteres.`, '?view=config');
    }
    db.saveProfile(req.session.usuario, visibleName, bio);
    avisoPerfil(req, res, 'Perfil actualizado con éxito!', '?view=config');
});

router.post('/perfil/avatar', requireLogin, (req, res) => {
    fs.mkdirSync(folderAvatares, { recursive: true });

    const formulario = formidable({
        uploadDir: folderAvatares,
        keepExtensions: true,
        maxFiles: 1,
        filter: ({ mimetype }) => mimetype && mimetype.startsWith('image/')
    });
    formulario.parse(req, (error, fields, files) => {
        if (error) return avisoPerfil(req, res, 'No se pudo subir la foto.', '?view=config');
        const archivo = files.picture && files.picture[0];
        if (!archivo) return avisoPerfil(req, res, 'El archivo debe ser una imagen', '?view=config');

        const anterior = db.getProfile(req.session.usuario).picture;
        db.savePicture(req.session.usuario, archivo.newFilename);
        if (anterior) fs.rmSync(path.join(folderAvatares, anterior), { force: true });
        avisoPerfil(req, res, 'Foto actualizada con éxito!', '?view=config');
    });
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

    formulario.parse(req, (error) => {
        if (error) return res.send('No se pudieron subir las imágenes.');
        res.redirect('/user/perfil');
    });
});

router.post('/perfil/obras/borrar', requireLogin, (req, res) => {
    const folder = carpetaDe(req.session.usuario);
    const archivo = req.body.archivo;
    if (fs.existsSync(folder) && fs.readdirSync(folder).includes(archivo)) {
        fs.unlinkSync(path.join(folder, archivo));
    }
    res.redirect('/user/perfil');
});

router.get('/:nombre', requireLogin, (req, res) => {
    const nombre = req.params.nombre;
    if (!validateName.test(nombre) || !db.userExists(nombre)) {
        return res.status(404).render('404');
    }
    mostrarPerfil(req, res, nombre);
});

/* ========== */

module.exports = router;

/* ===== FUNCIONES ===== */

function requireLogin(req, res, next) {
    if (!req.session.usuario) {
        req.session.mensaje = { form: 'login', texto: 'Inicia sesión o creá una cuenta para continuar.' };
        req.session.volver = req.originalUrl;
        return res.redirect('/#login');
    }
    next();
}

function carpetaDe(nombre) {
    return path.join(folderObras, nombre);
}

function mensajeError(req, res, form, texto) {
    req.session.mensaje = { form, texto };
    res.redirect('/#' + form);
}

function avisoPerfil(req, res, txt, consulta = '') {
    req.session.aviso = txt;
    res.redirect('/user/perfil' + consulta);
}

function mostrarPerfil(req, res, nombre) {
    const logueado = req.session.usuario === nombre;
    const view = logueado && req.query.view === 'config' ? 'config' : 'obras';
    const folder = carpetaDe(nombre);
    const images = fs.existsSync(folder) ? fs.readdirSync(folder) : [];
    const profile = db.getProfile(nombre);
    const aviso = req.session.aviso;
    delete req.session.aviso;
    res.render('perfil', { nombre, logueado, view, images, profile, aviso });
}