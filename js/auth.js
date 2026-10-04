// Sesión del jugador en el servidor: usuario y contraseña → token guardado en localStorage.
const Auth = {
  KEY: 'eugecraft.auth',
  onExpire: null, // el menú lo usa para volver a pedir login

  session() {
    try { return JSON.parse(localStorage.getItem(this.KEY)) || null; } catch (e) { return null; }
  },
  token() { const s = this.session(); return s ? s.token : ''; },
  user() { const s = this.session(); return s ? s.id : ''; },
  name() { const s = this.session(); return s ? s.name : ''; },

  /** Devuelve null si entra, o el código de error ('invalid', 'locked', 'network'). */
  async login(user, password) {
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user, password }),
      });
      const data = await res.json();
      if (!res.ok) return data.error || 'invalid';
      localStorage.setItem(this.KEY, JSON.stringify(data));
      return null;
    } catch (e) { return 'network'; }
  },

  logout() { localStorage.removeItem(this.KEY); },

  /** fetch con el token; si el servidor lo rechaza, cierra la sesión. */
  async fetch(url, opts = {}) {
    const res = await fetch(url, { ...opts, headers: { ...opts.headers, Authorization: 'Bearer ' + this.token() } });
    if (res.status === 401) { this.logout(); if (this.onExpire) this.onExpire(); }
    return res;
  },
};
