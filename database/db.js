// Importa el módulo better-sqlite3.
const Database = require('better-sqlite3');
const fs = require('fs'); // leer archivos
const path = require('path'); // configurar rutas

// Abre/crea una base de datos en disco rígido, dentro de esta misma carpeta.
const db = new Database(path.join(__dirname, 'users.db'), { verbose: console.log });

// Carga el script sql para crear la tabla users.
const filePath = path.join(__dirname, 'create_users.sql');
const file = fs.readFileSync(filePath, 'utf-8');

// Crea la tabla si no existe, `exec` es lo mismo que `run` pero se usa para hacer varias cosas de uan.
db.exec(file);

/**
 * Imprime el contenido de la base de datos.
 */
exports.log = () => {
    let data = db.prepare('SELECT rowid, * FROM users').all();
    console.log(data);
};

/**
 * Comprueba si el nombre de usuario existe en la base de datos.
 *
 * @param {string} username
 * @returns boolean
 */
exports.userExists = (username) => {
    let stmt = db.prepare('SELECT username FROM users WHERE username=?');
    let value = stmt.get(username);
    if (!value) return false;
    else return true;
};

/**
 * Agrega un nuevo usuario en la base de datos.
 * ¡El usuario *no* debe existir!
 *
 * @param {string} username
 * @param {string} email
 * @param {string} hash
 */
exports.addUser = (username, email, hash) => {
    stmt = db.prepare("INSERT INTO users VALUES (?, ?, ?)");
    stmt.run(username, email, hash);
};

exports.getHash = (username) => {
    let stmt = db.prepare("SELECT hash FROM users WHERE username=?");
    return stmt.get(username).hash;
};

exports.getProfile = (username) => {
    let stmt = db.prepare('SELECT visible_name, bio, picture FROM profiles WHERE username =?');
    let profile = stmt.get(username);
    return {
        visible_name: (profile && profile.visible_name) || username,
        bio: (profile && profile.bio) || '',
        picture: (profile && profile.picture) || null
    };
};

exports.saveProfile = (username, visibleName, bio) => {
    let stmt = db.prepare(`INSERT INTO profiles (username, visible_name, bio) VALUES (?, ?, ?) ON CONFLICT(username) DO UPDATE SET visible_name=excluded.visible_name, bio=excluded.bio`);
    stmt.run(username, visibleName, bio);
};

exports.savePicture = (username, picture) => {
    let stmt = db.prepare(`INSERT INTO profiles (username, picture) VALUES (?, ?) ON CONFLICT(username) DO UPDATE SET picture=excluded.picture`);
    stmt.run(username, picture);
};

// Siempre cerrar la conexión, apagar, al terminar.
// ste código sirve luego para el servidor express.
process.on('exit', () => db.close());
process.on('SIGHUP', () => process.exit()); // Cierre de la terminal.
process.on('SIGINT', () => process.exit()); // Ctrl-C.
process.on('SIGTERM', () => process.exit()); // Ctrl-D.