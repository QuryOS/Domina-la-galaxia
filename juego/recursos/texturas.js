/* =====================================================================
   TEXTURAS DEL SUELO (realismo sin imágenes): césped, tierra, arena, piedra y nieve.
   Adaptado de texturas_1.js: mismos diseños, pero a 256 px y fabricados en segundo plano
   (un renglón por cuadro) para no congelar el juego. Solo el COLOR; el relieve ya viene
   "horneado" en las sombras de las grietas. Se usan en el terreno del planeta.
   E.Texturas.iniciar(THREE) arranca la fabricación; E.Texturas.mapas.<nombre> = { tex, avg } cuando está lista.
   ===================================================================== */
(function (global) {
  'use strict';
  var E = global.JN = global.JN || {};
  var N = 256, ES = N / 512, cache = {};
  var T = null;

  /* ---- ruido sin costuras ---- */
  function azar(semilla) {
    var a = semilla >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function hash(x, y, s) {
    var h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(s + 1, 1442695041);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }
  function env(n, p) { return ((n % p) + p) % p; }
  function lim(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
  function suave(a, b, v) { var t = lim((v - a) / (b - a)); return t * t * (3 - 2 * t); }
  function mez(a, b, t) { return a + (b - a) * t; }

  function ruido(u, v, p, s) {
    var x = u * p, y = v * p, xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi;
    fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy);
    var x0 = env(xi, p), x1 = env(xi + 1, p), y0 = env(yi, p), y1 = env(yi + 1, p);
    return mez(mez(hash(x0, y0, s), hash(x1, y0, s), fx), mez(hash(x0, y1, s), hash(x1, y1, s), fx), fy);
  }
  function fbm(u, v, p, oct, s) {
    var suma = 0, amp = 0.5, total = 0;
    for (var i = 0; i < oct; i++) {
      suma += ruido(u, v, p, s + i * 17) * amp; total += amp; amp *= 0.5; p *= 2;
    }
    return suma / total;
  }
  var W = { f1: 0, f2: 0, id: 0 };
  function celdas(u, v, p, s) {
    var x = u * p, y = v * p, xi = Math.floor(x), yi = Math.floor(y), f1 = 9, f2 = 9, id = 0;
    for (var j = -1; j <= 1; j++) for (var i = -1; i <= 1; i++) {
      var cx = env(xi + i, p), cy = env(yi + j, p);
      var dx = xi + i + hash(cx, cy, s) - x, dy = yi + j + hash(cx, cy, s + 5) - y;
      var d = Math.sqrt(dx * dx + dy * dy);
      if (d < f1) { f2 = f1; f1 = d; id = hash(cx, cy, s + 9); } else if (d < f2) f2 = d;
    }
    W.f1 = f1; W.f2 = f2; W.id = id; return W;
  }


  /* ---- fábrica ---- */
  function lienzo(w) { var c = document.createElement('canvas'); c.width = c.height = w; return c; }

  function nuevaSuperficie() {
    return { H: new Float32Array(N * N), C: new Float32Array(N * N * 3), R: new Float32Array(N * N) };
  }
  function pintar(d, i, r, g, b, a) {
    var k = i * 3;
    d.C[k] = mez(d.C[k], r, a); d.C[k + 1] = mez(d.C[k + 1], g, a); d.C[k + 2] = mez(d.C[k + 2], b, a);
  }
  function* porPixel(d, fn) {   // un renglón por vez: así se puede repartir el trabajo entre cuadros
    for (var y = 0; y < N; y++) { for (var x = 0; x < N; x++) fn(x / N, 1 - y / N, y * N + x); yield; }
  }
  // Dibuja una mancha irregular (piedrita, concha, grano) que continúa por los bordes
  function estampar(cx, cy, rx, ry, ang, fase, fn) {
    rx *= ES; ry *= ES; var R = Math.ceil(Math.max(rx, ry) * 1.3), co = Math.cos(ang), se = Math.sin(ang);
    for (var j = -R; j <= R; j++) for (var i = -R; i <= R; i++) {
      var a = (i * co + j * se) / rx, b = (-i * se + j * co) / ry;
      var borde = 1 + 0.16 * Math.sin(3 * Math.atan2(b, a) + fase) + 0.08 * Math.sin(7 * Math.atan2(b, a) + fase * 2);
      var q = Math.sqrt(a * a + b * b) / borde;
      if (q < 1) fn(env(Math.round(cy) + j, N) * N + env(Math.round(cx) + i, N), q, a, b);
    }
  }
  function desenfocar(H, r) {
    var tmp = new Float32Array(N * N), out = new Float32Array(N * N), n = 2 * r + 1, x, y, s, k;
    for (y = 0; y < N; y++) {
      s = 0; for (k = -r; k <= r; k++) s += H[y * N + env(k, N)];
      for (x = 0; x < N; x++) { tmp[y * N + x] = s / n; s += H[y * N + env(x + r + 1, N)] - H[y * N + env(x - r, N)]; }
    }
    for (x = 0; x < N; x++) {
      s = 0; for (k = -r; k <= r; k++) s += tmp[env(k, N) * N + x];
      for (y = 0; y < N; y++) { out[y * N + x] = s / n; s += tmp[env(y + r + 1, N) * N + x] - tmp[env(y - r, N) * N + x]; }
    }
    return out;
  }

  /* ---- diseños ---- */
  function* superficieTierra() {
    var d = nuevaSuperficie(), r = azar(11);
    yield* porPixel(d, function (u, v, i) {
      var wu = u + (fbm(u, v, 8, 3, 3) - 0.5) * 0.09, wv = v + (fbm(u, v, 8, 3, 4) - 0.5) * 0.09;
      var c = celdas(wu, wv, 11, 21);
      var terron = lim(1 - c.f1 * 0.95), grieta = suave(0, 0.16, c.f2 - c.f1), id = c.id;
      var grande = fbm(u, v, 4, 5, 1), fino = fbm(u, v, 64, 3, 2);
      d.H[i] = 0.18 + terron * 0.32 * grieta + grande * 0.3 + fino * 0.22;
      var t = lim((grande - 0.3) * 1.9 + (id - 0.5) * 0.35);
      d.C[i * 3] = mez(62, 133, t) + (fino - 0.5) * 70;
      d.C[i * 3 + 1] = mez(40, 90, t) + (fino - 0.5) * 52;
      d.C[i * 3 + 2] = mez(25, 56, t) + (fino - 0.5) * 36;
      if (hash(i, 7, 3) > 0.975) pintar(d, i, 170, 132, 94, 0.6);
      d.R[i] = 0.82 + fino * 0.2 - suave(0.62, 0.75, fbm(u, v, 5, 3, 8)) * 0.25;
    });
    // raíces
    for (var k = 0; k < 26; k++) {
      var x = r() * N, y = r() * N, a = r() * 6.28, largo = (40 + r() * 110) * ES, ancho = 0.9 + r() * 2.2, tono = r();
      for (var s = 0; s < largo; s++) {
        a += (r() - 0.5) * 0.45; x += Math.cos(a); y += Math.sin(a);
        var w = ancho * (1 - s / largo) + 0.6;
        estampar(x, y, w, w, 0, 0, function (i, q) {
          pintar(d, i, mez(120, 176, tono), mez(86, 137, tono), mez(54, 93, tono), 0.8 * (1 - q * 0.5));
          d.H[i] = Math.max(d.H[i], 0.56 + (1 - q * q) * 0.1);
        });
      }
    }
    // piedritas incrustadas
    var tonos = [[142, 132, 120], [112, 94, 78], [166, 146, 118], [84, 74, 66]];
    for (var p = 0; p < 150; p++) {
      var rad = 2 + Math.pow(r(), 3) * 17, col = tonos[Math.floor(r() * 4)];
      estampar(r() * N, r() * N, rad, rad * (0.55 + r() * 0.4), r() * 6.28, r() * 6.28, function (i, q) {
        var gr = (hash(i, p, 5) - 0.5) * 30;
        pintar(d, i, col[0] + gr, col[1] + gr, col[2] + gr, q > 0.85 ? 0.6 : 1);
        d.H[i] = Math.max(d.H[i], 0.52 + Math.sqrt(1 - q * q) * Math.min(0.4, rad * 0.028));
        d.R[i] = 0.7;
      });
    }
    return d;
  }
  function* superficieCesped() {
    var d = nuevaSuperficie(), r = azar(131);
    yield* porPixel(d, function (u, v, i) {
      var a = fbm(u, v, 6, 4, 132), b = fbm(u, v, 40, 3, 133);
      d.H[i] = 0.1 + a * 0.18 + b * 0.1;
      d.C[i * 3] = 28 + a * 30 + (b - 0.5) * 24;
      d.C[i * 3 + 1] = 40 + a * 48 + (b - 0.5) * 34;
      d.C[i * 3 + 2] = 14 + a * 14;
      d.R[i] = 0.85;
    });
    var total = 3000;
    for (var k = 0; k < total; k++) {
      var capa = k / total, largo = 6 + r() * 11, ancho = 1.1 + r() * 1.3, seca = r() < 0.06;
      var zona = r(), x = r() * N, y = r() * N, t = lim(capa * 0.75 + zona * 0.35);
      var mancha = fbm(x / N, y / N, 4, 3, 134) - 0.5;
      var cr = seca ? 168 : mez(42, 112, t) + mancha * 55;
      var cg = seca ? 156 : mez(76, 164, t) + mancha * 24;
      var cb = seca ? 78 : mez(20, 50, t);
      estampar(x, y, largo, ancho, r() * 6.28, 0, function (i, q, a, b) {
        var luz = a * 22 + (Math.abs(b) < 0.25 ? 14 : 0);
        pintar(d, i, cr + luz, cg + luz, cb + luz * 0.35, q > 0.85 ? 0.6 : 1);
        d.H[i] = Math.max(d.H[i], 0.22 + capa * 0.5 + (1 - q) * 0.12);
        d.R[i] = 0.72;
      });
    }
    return d;
  }
  function* superficieNieve() {
    var d = nuevaSuperficie(), r = azar(23);
    yield* porPixel(d, function (u, v, i) {
      var monte = fbm(u, v, 3, 4, 31), medio = fbm(u, v, 14, 3, 32);
      var c = celdas(u, v, 96, 33), grano = lim(1 - c.f1), id = c.id;
      var polvo = hash(i, 3, 34);
      d.H[i] = monte * 0.62 + medio * 0.2 + grano * 0.07 + polvo * 0.012;
      var t = suave(0.3, 0.7, monte * 0.7 + medio * 0.3);
      var luz = (id - 0.5) * 12 + (polvo - 0.5) * 7;
      d.C[i * 3] = mez(207, 247, t) + luz;
      d.C[i * 3 + 1] = mez(222, 249, t) + luz;
      d.C[i * 3 + 2] = mez(241, 253, t) + luz * 0.6;
      d.R[i] = 0.62 + medio * 0.2;
    });
    for (var k = 0; k < 900; k++) {   // cristales de hielo
      var rad = 0.8 + r() * 1.7;
      estampar(r() * N, r() * N, rad, rad * 0.55, r() * 3.14, r() * 6, function (i) {
        pintar(d, i, 255, 255, 255, 0.85); d.R[i] = 0.16; d.H[i] += 0.025;
      });
    }
    return d;
  }
  function* superficiePiedra() {
    var d = nuevaSuperficie();
    yield* porPixel(d, function (u, v, i) {
      var wu = u + (fbm(u, v, 5, 4, 41) - 0.5) * 0.22, wv = v + (fbm(u, v, 5, 4, 42) - 0.5) * 0.22;
      var c = celdas(wu, wv, 4, 43), arista = c.f2 - c.f1, id = c.id;
      var mascara = suave(0.4, 0.6, fbm(u, v, 3, 3, 44));
      var grieta = (1 - suave(0.0, 0.055, arista)) * mascara;
      var c2 = celdas(wu, wv, 13, 45);
      var fisura = (1 - suave(0.0, 0.045, c2.f2 - c2.f1)) * suave(0.55, 0.72, fbm(u, v, 6, 3, 46));
      var masa = fbm(wu, wv, 4, 6, 47), fino = fbm(u, v, 48, 3, 48);
      var cresta = 1 - Math.abs(fbm(wu, wv, 7, 4, 49) * 2 - 1);
      var veta = Math.pow(1 - Math.abs(Math.sin((wv * 5 + wu + fbm(u, v, 6, 3, 50)) * Math.PI * 2)), 14);
      d.H[i] = 0.12 + masa * 0.48 + cresta * cresta * 0.2 + fino * 0.12 + (id - 0.5) * 0.12 * mascara - grieta * 0.3 - fisura * 0.14;
      var tono = 118 + (masa - 0.5) * 118 + (fino - 0.5) * 48 + (id - 0.5) * 22;
      d.C[i * 3] = tono; d.C[i * 3 + 1] = tono + 1; d.C[i * 3 + 2] = tono + 3;
      d.R[i] = 0.78 + fino * 0.2;
      var min = celdas(u, v, 120, 51);
      if (min.f1 < 0.45) {
        if (min.id > 0.9) { pintar(d, i, 205, 205, 198, 0.7); d.R[i] = 0.28; }      // cuarzo
        else if (min.id < 0.13) { pintar(d, i, 42, 42, 46, 0.7); d.R[i] = 0.45; }   // mica oscura
        else if (min.id > 0.84) pintar(d, i, 146, 124, 112, 0.5);                   // feldespato
      }
      pintar(d, i, 190, 188, 180, veta * 0.35);
      var liquen = suave(0.63, 0.74, fbm(u, v, 5, 5, 52)) * suave(0.35, 0.65, fbm(u, v, 40, 2, 53));
      pintar(d, i, 132, 142, 98, liquen * 0.6);
      pintar(d, i, 36, 34, 34, lim(grieta * 0.85 + fisura * 0.6));
    });
    return d;
  }
  function* superficieArena() {
    var d = nuevaSuperficie(), r = azar(61);
    yield* porPixel(d, function (u, v, i) {
      var onda = fbm(u, v, 4, 4, 62);
      var fase = (u * 2 + v * 7) * Math.PI * 2 + (onda - 0.5) * 9;
      var rizo = Math.pow(0.5 + 0.5 * Math.sin(fase), 1.5);
      var c = celdas(u, v, 170, 63), grano = lim(1 - c.f1 * 1.1), id = c.id;
      var mancha = fbm(u, v, 6, 4, 64);
      d.H[i] = 0.24 + rizo * 0.3 + onda * 0.18 + grano * 0.09;
      var luz = (rizo - 0.5) * 17 + (mancha - 0.5) * 36;
      d.C[i * 3] = 217 + luz; d.C[i * 3 + 1] = 184 + luz; d.C[i * 3 + 2] = 117 + luz * 0.8;
      d.R[i] = 0.93;
      if (id < 0.12) pintar(d, i, 142, 104, 66, 0.75);
      else if (id < 0.17) pintar(d, i, 88, 74, 58, 0.7);
      else if (id > 0.87) pintar(d, i, 248, 229, 179, 0.8);
      if (id > 0.975) { pintar(d, i, 255, 248, 224, 0.9); d.R[i] = 0.2; }
      var g = (hash(i, 1, 65) - 0.5) * 24; pintar(d, i, d.C[i * 3] + g, d.C[i * 3 + 1] + g, d.C[i * 3 + 2] + g, 1);
    });
    for (var k = 0; k < 70; k++) {   // conchas y gravilla
      var concha = r() < 0.35, rad = concha ? 4 + r() * 6 : 1.5 + r() * 4, tono = r();
      estampar(r() * N, r() * N, rad, rad * (concha ? 0.7 : 0.8), r() * 6.28, r() * 6.28, function (i, q, a, b) {
        var raya = concha ? Math.sin(Math.atan2(b, a + 1.1) * 18) * 16 : 0;
        if (concha) pintar(d, i, 236 + raya, 218 + raya, 190 + raya, 0.95);
        else pintar(d, i, mez(112, 178, tono), mez(88, 148, tono), mez(66, 110, tono), 0.95);
        d.H[i] = Math.max(d.H[i], 0.55 + Math.sqrt(1 - q * q) * 0.14 + raya * 0.002);
        d.R[i] = concha ? 0.5 : 0.8;
      });
    }
    return d;
  }

  /* sombra de grietas + color final en un lienzo; devuelve el lienzo y su color medio (el terreno usa textura/medio para no cambiar la paleta) */
  function terminarColor(d, sombra) {
    var amplio = desenfocar(d.H, 4), c = lienzo(N), g = c.getContext('2d'), im = g.createImageData(N, N), i, j, s0 = 0, s1 = 0, s2 = 0, ao, v;
    for (i = 0; i < N * N; i++) {
      ao = Math.max(0.5, Math.min(1.12, 1 + (d.H[i] - amplio[i]) * sombra));
      for (j = 0; j < 3; j++) { v = Math.max(0, Math.min(255, d.C[i * 3 + j] * ao)); im.data[i * 4 + j] = v; if (j === 0) s0 += v; else if (j === 1) s1 += v; else s2 += v; }
      im.data[i * 4 + 3] = 255;
    }
    g.putImageData(im, 0, 0); var k = N * N * 255;
    return { canvas: c, avg: [Math.max(0.05, s0 / k), Math.max(0.05, s1 / k), Math.max(0.05, s2 / k)] };
  }
  var TRABAJOS = [   // orden: lo primero que se ve en un planeta con hierba
    ['cesped', superficieCesped, 1.4], ['arena', superficieArena, 0.9], ['piedra', superficiePiedra, 1.5], ['tierra', superficieTierra, 1.7], ['nieve', superficieNieve, 0.7]
  ];
  var API = E.Texturas = { mapas: {}, listo: false, activo: false, alCambiar: null };
  API.iniciar = function (THREE_) {
    if (API.activo) return; API.activo = true; T = THREE_ || global.THREE; var idx = 0;
    function siguiente() {
      if (idx >= TRABAJOS.length) { API.listo = true; if (API.alCambiar) API.alCambiar('todo'); return; }
      var tr = TRABAJOS[idx++], gen, r;
      try { gen = tr[1](); } catch (e) { if (global.console) console.error(e); siguiente(); return; }
      (function paso() {
        var t0 = Date.now(), res;
        try {
          do { res = gen.next(); } while (!res.done && Date.now() - t0 < 5);
          if (!res.done) { setTimeout(paso, 0); return; }
          r = terminarColor(res.value, tr[2]);
          var tex = new T.CanvasTexture(r.canvas); tex.wrapS = tex.wrapT = T.RepeatWrapping;
          try { tex.anisotropy = Math.min(4, E.renderer && E.renderer.capabilities ? E.renderer.capabilities.getMaxAnisotropy() : 1); } catch (e1) { }
          API.mapas[tr[0]] = { tex: tex, avg: r.avg };
          if (API.alCambiar) API.alCambiar(tr[0]);
        } catch (e2) { if (global.console) console.error(e2); }
        setTimeout(siguiente, 30);
      })();
    }
    setTimeout(siguiente, 400);
  };
})(window);
