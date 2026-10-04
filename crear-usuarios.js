// Crea usuarios con contraseña aleatoria y las imprime UNA sola vez.
// Uso: node crear-usuarios.js [nombre ...]   (sin argumentos: los amigos y la familia)
// Si el usuario ya existe se omite; con --reset se le genera contraseña nueva.
const { setUser, userId, readUsers } = require('./auth');
const crypto = require('crypto');

const DEFAULTS = ['Euge', 'Santiago', 'Andres', 'Bruno', 'Rafa', 'Luca', 'Bernie'];
const WORDS = ['lobo', 'luna', 'pollo', 'rayo', 'nube', 'oso', 'gato', 'fuego', 'roca', 'mono',
  'tigre', 'pez', 'sol', 'cohete', 'dragon', 'perro', 'rana', 'trueno', 'cubo', 'panda'];

const pick = () => WORDS[crypto.randomInt(WORDS.length)];
const newPassword = () => `${pick()}-${pick()}-${crypto.randomInt(10, 100)}`;

const args = process.argv.slice(2);
const reset = args.includes('--reset');
const names = args.filter((a) => a !== '--reset');
const existing = readUsers();

for (const name of names.length ? names : DEFAULTS) {
  const id = userId(name);
  if (existing[id] && !reset) { console.log(`${name.padEnd(10)} ya existe (usa --reset para cambiar su contraseña)`); continue; }
  const password = newPassword();
  setUser(name, password);
  console.log(`${name.padEnd(10)} usuario: ${id.padEnd(10)} contraseña: ${password}`);
}
