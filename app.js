/* ========== IMPORTS ========== */
const express = require('express');
const path = require('path');
const userRouter = require('./routes/user.js');

/* ========== CONFIGURACIÓN DEL SERVIDOR ========== */
const PORT = 3000;
const app = express();

app.set('port', PORT);

/* ========== MIDDLEWARES ========== */
// Procesar datos de formularios (POST) y dejarlos disponibles en 'req.body'
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Configuración del motor de vistas EJS
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Carpeta para archivos estáticos (CSS, imágenes, uploads, etc.)
app.use(express.static(path.join(__dirname, 'public'))); 

/* ========== RUTAS ========== */
// Ruta principal: renderiza la vista 'index.ejs' donde estarán el Login y el Registro
app.get('/', (req, res) => {
    res.render('index'); 
});

// Rutas de usuario (controla el /user/signup y /user/login)
app.use('/user', userRouter);


/* ========== LEVANTAR EL SERVIDOR ========== */
app.listen(app.get('port'), () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
});