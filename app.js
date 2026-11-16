/* ========== IMPORTS ========== */
const express = require('express');

const userRouter = require('./routes/user.js');

const path = require('path'); // aun no se q es


/* ========== CONFIGURACIÓN DEL SERVIDOR ========== */
const PORT = 3000;
const app = express(); //objeto del servidor

app.set('port', PORT); // puerto del servidor guardado en la llave port del obj. app

app.set('views','./views'); // plantillas
app.set('view engine', 'ejs'); //motor de vistas EJS

/* funciones de respuesta (middleware) */
app.use(express.urlencoded({ extended: true })); // procesa los datos de las peticiones 'post' y los deja disponible en 'req.body'



/* vvvvv REVISAR vvvvv */
// Middlewares para parsear JSON
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public'))); 

/* ^^^^^ REVISAR ^^^^^ */


/* ========== RUTAS ========== */
app.use('/', userRouter);


/* ===== RESPUESTAS A PETICIONES (GET/POST) ===== */

app.get('/', (req, res) => {
    res.sendFile('./static/index.html', { root: __dirname });
});

app.post('/', (req, res) => {
    res.sendFile('./static/index.html', { root: __dirname });
});


app.listen(app.get('port'));