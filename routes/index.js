const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');

// Configuración de Multer para el almacenamiento de los 3 archivos
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, path.join(__dirname, '../public/uploads'));
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + '-' + file.originalname);
    }
});

const upload = multer({ storage: storage });

// Ruta para mostrar el formulario
router.get('/', (req, res) => {
    res.render('index');
});

// Ruta para procesar el formulario con campos de texto y los 3 archivos
const cpUpload = upload.fields([
    { name: 'archivo1', maxCount: 1 },
    { name: 'archivo2', maxCount: 1 },
    { name: 'archivo3', maxCount: 1 }
]);

router.post('/upload', cpUpload, (req, res) => {
    const { nombre, email, edad } = req.body;
    const archivos = req.files;

    console.log("Datos personales:", { nombre, email, edad });
    console.log("Archivos recibidos:", archivos);

    res.render('profile', { 
        nombre, 
        email, 
        edad, 
        archivos 
    });
});

module.exports = router;
