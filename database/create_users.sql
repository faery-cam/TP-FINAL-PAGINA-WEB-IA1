-- Crear la tabla para usuario si no existe en la base de datos.

CREATE TABLE IF NOT EXISTS users
(
    username varchar(255) NOT NULL UNIQUE,
    email varchar(255) NOT NULL UNIQUE,
    hash varchar(255) NOT NULL
);
/* Crea la tabla con datos públicos de cada usuario.  */
CREATE TABLE IF NOT EXISTS profiles
(
    username varchar(255) NOT NULL UNIQUE,
    visible_name varchar(255),
    bio text,
    picture varchar(255)
);
