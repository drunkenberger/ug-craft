// Mensajes escondidos para Eugenio, de papá y mamá.
// Cada mensaje se muestra UNA sola vez, para que siga siendo especial.
const EGG_MESSAGES = [
  { from: 'Papá', text: 'Eugenio: eres una persona muy especial. Escúchate siempre a ti mismo.' },
  { from: 'Mamá', text: 'Te amo hasta el infinito y de regreso. Gracias por ser tú.' },
  { from: 'Papá', text: 'Sé auténtico y nunca hagas nada que vaya en contra de lo que crees.' },
  { from: 'Mamá', text: 'Tu sonrisa ilumina cualquier lugar. Nunca dejes de compartirla.' },
  { from: 'Papá', text: 'Equivocarse está bien: así aprenden los valientes. Estoy muy orgulloso de ti.' },
  { from: 'Mamá', text: 'Eres curioso, inteligente y bondadoso. Confía en ti.' },
  { from: 'Papá y Mamá', text: 'No hay nada que puedas hacer que haga que te queramos menos. Nada.' },
  { from: 'Papá', text: 'Cuando algo se ponga difícil, respira hondo. Tú puedes con esto y con más.' },
  { from: 'Mamá', text: 'Trata a los demás como te gusta que te traten a ti. Esa es tu superfuerza.' },
  { from: 'Papá', text: 'Ser diferente es tu magia. El mundo necesita gente como tú.' },
  { from: 'Mamá', text: 'Aunque no estemos cerca, siempre estamos contigo. Te amamos.' },
  { from: 'Papá y Mamá', text: 'Encontraste este tesoro como encuentras lo bueno en todo. ¡Sigue así, campeón!' },
  { from: 'Papá', text: 'Hoy es un gran día para intentar algo nuevo. ¡Atrévete!' },
  { from: 'Mamá', text: 'Tus ideas valen mucho. Nunca tengas miedo de decir lo que piensas.' },
  { from: 'Papá', text: 'No importa qué tan lento vayas: lo importante es no rendirse.' },
  { from: 'Mamá', text: 'Eres valiente aunque a veces sientas miedo. Eso es ser valiente de verdad.' },
  { from: 'Papá', text: 'Pedir ayuda no es de débiles: es de inteligentes.' },
  { from: 'Mamá', text: 'Cada día aprendes algo nuevo, y eso te hace más fuerte.' },
  { from: 'Papá y Mamá', text: 'Nuestro lugar favorito del mundo es donde estés tú.' },
  { from: 'Papá', text: 'Un campeón no es el que nunca cae, sino el que siempre se levanta.' },
  { from: 'Mamá', text: 'Tu corazón amable es el tesoro más grande de este juego.' },
  { from: 'Papá', text: 'Cree en ti como nosotros creemos en ti.' },
  { from: 'Mamá', text: 'Las palabras amables son magia: úsalas todos los días.' },
  { from: 'Papá y Mamá', text: 'Gracias por hacernos reír todos los días. Eres nuestro sol.' },
];

// Datos curiosos: se mezclan con los mensajes como premio de la trivia.
const EGG_FACTS = [
  'Los pulpos tienen tres corazones y su sangre es azul.',
  'Las abejas bailan para decirles a sus amigas dónde hay flores.',
  'La lengua de la ballena azul pesa como un elefante completo.',
  'Un rayo es 5 veces más caliente que la superficie del Sol.',
  'Los caballitos de mar papás son los que cargan a los bebés.',
  'La miel nunca se echa a perder: puede durar miles de años.',
  'Los delfines duermen con un ojo abierto.',
  'Los flamencos nacen grises: se vuelven rosas por lo que comen.',
  'El corazón de un colibrí late más de 1000 veces por minuto.',
  'En la Luna pesarías 6 veces menos: ¡saltarías altísimo!',
  'Las hormigas pueden cargar 50 veces su propio peso.',
  'Los árboles se "hablan" entre ellos a través de sus raíces.',
  'El animal más rápido es el halcón peregrino: ¡vuela a más de 300 km/h!',
  'Los gatos pasan durmiendo casi el 70% de su vida.',
  'Tu cuerpo tiene 206 huesos, ¡pero los bebés nacen con 300!',
  'La Tierra gira a más de 1,600 km/h y ni lo sentimos.',
  'Las estrellas de mar no tienen cerebro… ¡y aun así sobreviven!',
  'Los canguros no pueden caminar hacia atrás.',
];

// Trivia para primaria (con algo de reto): la respuesta correcta es el índice `c`.
const TRIVIA = [
  { q: '¿Cuánto es 7 + 5?', o: ['11', '12', '13'], c: 1 },
  { q: '¿Cuánto es 12 + 7?', o: ['19', '18', '20'], c: 0 },
  { q: '¿Cuánto es 15 - 6?', o: ['8', '10', '9'], c: 2 },
  { q: '¿Cuánto es 2 × 3?', o: ['5', '6', '8'], c: 1 },
  { q: '¿Cuánto es 2 × 5?', o: ['10', '7', '12'], c: 0 },
  { q: '¿Cuánto es 10 + 10 + 10?', o: ['20', '40', '30'], c: 2 },
  { q: '¿Cuál es la mitad de 10?', o: ['4', '5', '6'], c: 1 },
  { q: '¿Qué número sigue: 2, 4, 6, …?', o: ['8', '7', '10'], c: 0 },
  { q: '¿Qué número sigue: 5, 10, 15, …?', o: ['18', '25', '20'], c: 2 },
  { q: '¿Cuál es el número más grande?', o: ['29', '92', '19'], c: 1 },
  { q: '¿Cuánto es 20 - 8?', o: ['12', '14', '11'], c: 0 },
  { q: '¿Con qué letra empieza "Gato"?', o: ['J', 'C', 'G'], c: 2 },
  { q: '¿Cuántas letras tiene "SOL"?', o: ['2', '3', '4'], c: 1 },
  { q: '¿Qué palabra rima con "gato"?', o: ['Zapato', 'Perro', 'Casa'], c: 0 },
  { q: '¿Qué animal dice "muu"?', o: ['El perro', 'El gato', 'La vaca'], c: 2 },
  { q: '¿Cuántas patas tiene una araña?', o: ['6', '8', '10'], c: 1 },
  { q: '¿Qué animal es un insecto?', o: ['La mariposa', 'El perro', 'El pez'], c: 0 },
  { q: 'Si mezclas azul y amarillo sale...', o: ['Rojo', 'Café', 'Verde'], c: 2 },
  { q: 'Si mezclas rojo y blanco sale...', o: ['Morado', 'Rosa', 'Naranja'], c: 1 },
  { q: '¿Cuánto es 4 + 4?', o: ['8', '6', '9'], c: 0 },
  { q: '¿Qué día viene después del sábado?', o: ['Lunes', 'Viernes', 'Domingo'], c: 2 },
  { q: '¿Cuántos días tiene una semana?', o: ['5', '7', '10'], c: 1 },
  { q: '¿Cuántos meses tiene un año?', o: ['12', '10', '20'], c: 0 },
  { q: '¿Qué figura tiene 3 lados?', o: ['Círculo', 'Cuadrado', 'Triángulo'], c: 2 },
  { q: '¿Cuántos lados tiene un cuadrado?', o: ['3', '4', '5'], c: 1 },
  { q: '¿Cuánto es 10 - 5?', o: ['5', '4', '6'], c: 0 },
  { q: '¿Dónde viven los peces?', o: ['En los árboles', 'En la arena', 'En el agua'], c: 2 },
  { q: '¿Qué hace el agua cuando hace mucho frío?', o: ['Se calienta', 'Se congela', 'Desaparece'], c: 1 },
  { q: '¿Qué planeta está más cerca del Sol?', o: ['Mercurio', 'La Tierra', 'Marte'], c: 0 },
  { q: '¿Qué necesitan las plantas para crecer?', o: ['Dulces', 'Juguetes', 'Agua y sol'], c: 2 },
  { q: '¿Cuánto es 6 + 7?', o: ['12', '13', '14'], c: 1 },
  { q: '¿Qué animal pone huevos?', o: ['La gallina', 'La vaca', 'El perro'], c: 0 },
  { q: '¿Cuántos minutos tiene una hora?', o: ['30', '100', '60'], c: 2 },
  { q: '¿Cuánto es 9 + 9?', o: ['17', '18', '19'], c: 1 },
];

// Premios por contestar bien la trivia: [id del item, cantidad].
const EGG_PRIZES = [
  [8, 2],   // oro ×2
  [3, 6],   // piedra ×6
  [7, 4],   // tablones ×4
  [5, 3],   // troncos ×3
  [103, 3], // palos ×3
  [110, 4], // flechas ×4
  [105, 1], // bistec
  [104, 1], // chuleta
  [106, 1], // pollo asado
];

const Eggs = {
  KEY: 'eugecraft.eggs',

  load() {
    try {
      return JSON.parse(localStorage.getItem(this.KEY)) || {};
    } catch (e) {
      return {};
    }
  },

  save(s) {
    localStorage.setItem(this.KEY, JSON.stringify(s));
  },

  // Siguiente mensaje no visto (null si ya se vieron todos).
  next() {
    const s = this.load();
    s.shown = s.shown || [];
    const idx = EGG_MESSAGES.findIndex((_, i) => !s.shown.includes(i));
    if (idx === -1) return null;
    s.shown.push(idx);
    this.save(s);
    return EGG_MESSAGES[idx];
  },

  // Siguiente pregunta de trivia; cuando se agotan, vuelven a empezar.
  nextTrivia() {
    const s = this.load();
    s.trivia = s.trivia || [];
    if (s.trivia.length >= TRIVIA.length) s.trivia = [];
    const idx = TRIVIA.findIndex((_, i) => !s.trivia.includes(i));
    s.trivia.push(idx);
    this.save(s);
    return TRIVIA[idx];
  },

  // Siguiente dato curioso; cuando se agotan, vuelven a empezar.
  nextFact() {
    const s = this.load();
    s.facts = s.facts || [];
    if (s.facts.length >= EGG_FACTS.length) s.facts = [];
    const idx = EGG_FACTS.findIndex((_, i) => !s.facts.includes(i));
    s.facts.push(idx);
    this.save(s);
    return EGG_FACTS[idx];
  },

  // Premio tras la trivia: mensaje de amor (una vez cada uno) o dato curioso.
  reward() {
    const s = this.load();
    const loveLeft = EGG_MESSAGES.length - (s.shown || []).length;
    if (loveLeft > 0 && Math.random() < 0.6) {
      return { kind: 'love', ...this.next() };
    }
    return { kind: 'fact', text: this.nextFact() };
  },

  // true solo la primera vez que ocurre el hito.
  once(flag) {
    const s = this.load();
    s.flags = s.flags || {};
    if (s.flags[flag]) return false;
    s.flags[flag] = true;
    this.save(s);
    return true;
  },
};

// Modal del easter egg: primero una trivia, al acertar el mensaje de amor.
class EggUI {
  constructor() {
    this.el = document.getElementById('egg');
    this.title = document.getElementById('egg-title');
    this.quiz = document.getElementById('egg-quiz');
    this.question = document.getElementById('egg-question');
    this.options = document.getElementById('egg-options');
    this.feedback = document.getElementById('egg-feedback');
    this.message = document.getElementById('egg-message');
    this.open = false;
    this.onClose = null;
    document.getElementById('eggCloseBtn').addEventListener('click', () => this.close());
  }

  // prize: { text, grant() } opcional — se entrega al llegar al mensaje.
  start(trivia, msg, prize) {
    this.open = true;
    this.prize = prize || null;
    this.el.classList.remove('hidden');
    this.message.classList.add('hidden');
    if (trivia) this.showQuiz(trivia, msg);
    else this.showMessage(msg);
  }

  showQuiz(trivia, msg) {
    this.title.textContent = '🎓 ¡Pregunta sorpresa!';
    this.quiz.classList.remove('hidden');
    this.question.textContent = trivia.q;
    this.feedback.textContent = '';
    this.options.replaceChildren();
    trivia.o.forEach((opt, i) => {
      const btn = document.createElement('button');
      btn.className = 'btn egg-option';
      btn.textContent = opt;
      btn.addEventListener('click', () => {
        if (i === trivia.c) {
          this.feedback.textContent = '¡Muy bien! 🎉';
          this.options.querySelectorAll('button').forEach((b) => (b.disabled = true));
          setTimeout(() => this.showMessage(msg), 800);
        } else {
          this.feedback.textContent = '¡Casi! Inténtalo otra vez 💪';
          btn.disabled = true;
        }
      });
      this.options.append(btn);
    });
  }

  showMessage(msg) {
    this.quiz.classList.add('hidden');
    this.message.classList.remove('hidden');
    const text = document.getElementById('egg-text');
    const from = document.getElementById('egg-from');
    if (msg && msg.kind === 'fact') {
      this.title.textContent = '🤓 ¡Dato curioso!';
      text.textContent = `¿Sabías que… ${msg.text}`;
      from.textContent = '— El mundo es increíble 🌎';
    } else if (msg) {
      this.title.textContent = '💌 ¡Te ganaste un mensaje!';
      text.textContent = `«${msg.text}»`;
      from.textContent = `— ${msg.from} ❤️`;
    } else {
      this.title.textContent = '💌 ¡Te ganaste un mensaje!';
      text.textContent = '«¡Eres increíble! Sigue aprendiendo y jugando.»';
      from.textContent = '— Papá y Mamá ❤️';
    }
    // Entregar el premio (una sola vez).
    const prizeEl = document.getElementById('egg-prize');
    if (this.prize) {
      this.prize.grant();
      prizeEl.textContent = `🎁 Premio: ${this.prize.text}`;
      this.prize = null;
    } else {
      prizeEl.textContent = '';
    }
  }

  close() {
    if (!this.open) return;
    this.open = false;
    this.el.classList.add('hidden');
    if (this.onClose) this.onClose();
  }
}
