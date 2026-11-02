/* IMPORTS */
const express = require('express');
const path = require('path');

const PORT = 3000;

/* CONFIGURACIÓN DEL SERVIDOR */
//obj del servidor
const app = express();

app.set('port', PORT);

// Configuración de motor de vistas EJS
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middlewares para parsear datos de formularios y JSON
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Rutas
const indexRouter = require('./routes/index');
const usersRouter = require('./routes/user');

app.use('/', indexRouter);
app.use('/users', usersRouter);


/* RESPUESTAS A PETICIONES (GET/POST) */

app.get('/', (req, res) => {
    res.sendFile('./views/user.html', { root: __dirname });
});



app.listen(app.get('port'));