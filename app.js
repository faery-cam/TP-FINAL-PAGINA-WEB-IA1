/* ========== IMPORTS ========== */
const express = require('express');
const session = require('express-session');
const path = require('path');

const indexRouter = require('./routes/index.js');
const userRouter = require('./routes/user.js');

/* ========== CONFIGURACIÓN DEL SERVIDOR ========== */
const PORT = 3000;
const app = express(); //objeto del servidor

app.set('port', PORT); // puerto del servidor guardado en la llave port del obj. app

app.set('views', path.join(__dirname, 'views')); // plantillas
app.set('view engine', 'ejs'); //motor de vistas EJS

/* funciones de respuesta (middleware) */
app.use(express.urlencoded({ extended: true })); // procesa los datos de las peticiones 'post' y los deja disponible en 'req.body'

app.use(express.json()); // Middleware para parsear JSON
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({ secret: 'clave', resave: false, saveUninitialized: false }))


/* ========== RUTAS ========== */
app.use('/', indexRouter);
app.use('/user', userRouter);


/* ===== RESPUESTAS A PETICIONES (GET/POST) ===== */





app.listen(app.get('port'));
console.log(`Server running on port ${PORT}`);