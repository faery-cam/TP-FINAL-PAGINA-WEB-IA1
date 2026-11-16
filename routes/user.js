const express = require('express');
const router = express.Router();
const formidable = require('formidable');
const path = require('path');

router.get('/login', (req, res) => {
    res.render('login');
});

router.get('/signup', (req, res) => {
    res.render('signup');
});

router.post('/signup', (req, res) => {
    const form = new formidable.IncomingForm();
    form.uploadDir = path.join(__dirname, '../public/uploads');
    form.keepExtensions = true;

    form.parse(req, (err, fields, files) => {
        if (err) {
            console.error("Error al procesar el formulario:", err);
            return res.status(500).send("Error al procesar el registro.");
        }

        const nombre = Array.isArray(fields.nombre) ? fields.nombre[0] : fields.nombre;
        const email = Array.isArray(fields.email) ? fields.email[0] : fields.email;
        const password = Array.isArray(fields.password) ? fields.password[0] : fields.password;

        if (!files.obra1 || !files.obra2 || !files.obra3) {
            return res.send('Error: Es obligatorio subir los 3 archivos de obras distintas.');
        }

        res.redirect('/user/profile');
    });
});

router.post('/login', (req, res) => {
    const { email, password } = req.body;
    res.redirect('/user/profile');
});

module.exports = router;