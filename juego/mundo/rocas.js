/* =====================================================================
   ROCAS DE FARMEO (piedra, azufre y metal) repartidas por el planeta.
   Modelo y efectos: rocas_2.js (adaptado: texturas a 256 px, escalado, hooks de golpe/rotura).
   Las rocas se colocan en sitios aleatorios (siempre los mismos en cada planeta), nunca en el agua
   ni en pendientes fuertes; solo existen las más cercanas al jugador (un "pool" que se reubica).
   ===================================================================== */
(function (global) {
  'use strict';
  var E = global.JN = global.JN || {};
  var T = null, N = 256, cache = {}, RESPAWN_S = 150;
  /* ================= Utilidades y ruido sin costuras ================= */
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

  /* ================= Fábrica de texturas ================= */
  function lienzo(w) { var c = document.createElement('canvas'); c.width = c.height = w; return c; }

  function nuevaSuperficie() {
    return { H: new Float32Array(N * N), C: new Float32Array(N * N * 3), R: new Float32Array(N * N) };
  }
  function pintar(d, i, r, g, b, a) {
    var k = i * 3;
    d.C[k] = mez(d.C[k], r, a); d.C[k + 1] = mez(d.C[k + 1], g, a); d.C[k + 2] = mez(d.C[k + 2], b, a);
  }
  function porPixel(d, fn) {
    for (var y = 0; y < N; y++) for (var x = 0; x < N; x++) fn(x / N, 1 - y / N, y * N + x);
  }
  // Dibuja una mancha irregular (piedrita, concha, grano) que continúa por los bordes
  function estampar(cx, cy, rx, ry, ang, fase, fn) {
    var R = Math.ceil(Math.max(rx, ry) * 1.3), co = Math.cos(ang), se = Math.sin(ang);
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
  function textura(c, esColor) {
    var t = new T.CanvasTexture(c);
    t.wrapS = t.wrapT = T.RepeatWrapping;
    t.anisotropy = 4;
    if (esColor) t.encoding = T.sRGBEncoding;
    return t;
  }
  function mapaNormal(H, fuerza) {
    var c = lienzo(N), g = c.getContext('2d'), im = g.createImageData(N, N), p = im.data;
    for (var y = 0; y < N; y++) for (var x = 0; x < N; x++) {
      var dx = (H[y * N + env(x + 1, N)] - H[y * N + env(x - 1, N)]) * fuerza;
      var dy = (H[env(y + 1, N) * N + x] - H[env(y - 1, N) * N + x]) * fuerza;
      var l = Math.sqrt(dx * dx + dy * dy + 1), k = (y * N + x) * 4;
      p[k] = (-dx / l * 0.5 + 0.5) * 255; p[k + 1] = (dy / l * 0.5 + 0.5) * 255;
      p[k + 2] = (1 / l * 0.5 + 0.5) * 255; p[k + 3] = 255;
    }
    g.putImageData(im, 0, 0);
    return textura(c, false);
  }
  function terminar(d, fuerza, sombra) {
    var amplio = desenfocar(d.H, 7);
    var cc = lienzo(N), cr = lienzo(N), gc = cc.getContext('2d'), gr = cr.getContext('2d');
    var ic = gc.createImageData(N, N), ir = gr.createImageData(N, N);
    for (var i = 0; i < N * N; i++) {
      var ao = Math.max(0.5, Math.min(1.12, 1 + (d.H[i] - amplio[i]) * sombra));   // sombra en grietas
      for (var j = 0; j < 3; j++) { ic.data[i * 4 + j] = d.C[i * 3 + j] * ao; ir.data[i * 4 + j] = lim(d.R[i]) * 255; }
      ic.data[i * 4 + 3] = ir.data[i * 4 + 3] = 255;
    }
    gc.putImageData(ic, 0, 0); gr.putImageData(ir, 0, 0);
    var res = { map: textura(cc, true), normalMap: mapaNormal(d.H, fuerza), roughnessMap: textura(cr, false) };
    if (d.M) {      // mapa de zonas metálicas
      var cm = lienzo(N), gm = cm.getContext('2d'), im = gm.createImageData(N, N);
      for (var q = 0; q < N * N; q++) { im.data[q * 4] = im.data[q * 4 + 1] = im.data[q * 4 + 2] = lim(d.M[q]) * 255; im.data[q * 4 + 3] = 255; }
      gm.putImageData(im, 0, 0); res.metalnessMap = textura(cm, false);
    }
    return res;
  }

  function malla(geo, mat) { var m = new T.Mesh(geo, mat); m.castShadow = m.receiveShadow = true; return m; }

  /* ================= PIEDRA ================= */
  function texturaPiedra() {
    var d = nuevaSuperficie();
    porPixel(d, function (u, v, i) {
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
    return terminar(d, 6.5, 1.5);
  }
  var SUELO = -0.575;
  var EJE_Y = null;

  function plano(color, extra) {
    return new T.MeshStandardMaterial(Object.assign(
      { color: new T.Color(color).convertSRGBToLinear(), roughness: 0.9, flatShading: true }, extra || {}));
  }

  /* ---------- Partículas con física ---------- */
  function particulas(fx, o) {
    var menos = o.n > 20;
    if (menos) o.n = Math.round(o.n * 0.5);
    var inst = new T.InstancedMesh(o.geo, o.mat, o.n), r = Math.random, lista = [], aux = new T.Object3D();
    var color = new T.Color(), edad = 0;
    for (var i = 0; i < o.n; i++) {
      var d = o.iniciar(i);
      d.r = new T.Vector3(r() * 6.28, r() * 6.28, r() * 6.28);
      var gi = o.giro === undefined ? 10 : o.giro;
      d.w = new T.Vector3((r() - 0.5) * gi, (r() - 0.5) * gi, (r() - 0.5) * gi);
      d.f = r() * 6.28; d.quieto = false;
      if (menos) d.s *= 1.15;
      lista.push(d);
      if (o.colores) { color.set(o.colores[Math.floor(r() * o.colores.length)]).convertSRGBToLinear(); inst.setColorAt(i, color); }
    }
    inst.frustumCulled = false;
    if (o.profundidad) inst.customDepthMaterial = o.profundidad;
    function paso(dt) {
      edad += dt;
      for (var i = 0; i < lista.length; i++) {
        var d = lista[i];
        if (!d.quieto && dt > 0) {
          d.v.y -= o.g * dt;
          if (o.freno) d.v.multiplyScalar(Math.exp(-o.freno * dt));
          if (o.aleteo) { d.v.x += Math.sin(edad * 6 + d.f) * o.aleteo * dt; d.v.z += Math.cos(edad * 5 + d.f * 2) * o.aleteo * dt; }
          d.p.addScaledVector(d.v, dt);
          d.r.addScaledVector(d.w, dt);
          var piso = SUELO + d.s * (o.apoyo === undefined ? 0.45 : o.apoyo);
          if (d.p.y < piso && d.v.y < 0) {
            d.p.y = piso;
            if (o.rebote && d.v.y < -0.7) {
              d.v.y *= -o.rebote; d.v.x *= 0.65; d.v.z *= 0.65; d.w.multiplyScalar(0.6);
            } else {
              d.quieto = true;
              if (o.acostar) { d.r.x = o.acostar; d.r.z = 0; }
            }
          }
        }
        var k = lim((o.vida - edad - (d.f / 6.28) * o.vida * 0.2) / (o.vida * 0.25));
        aux.position.copy(d.p);
        if (o.alinear) aux.quaternion.setFromUnitVectors(EJE_Y, d.v.clone().normalize());
        else aux.rotation.set(d.r.x, d.r.y, d.r.z);
        var s = d.s * k;
        if (o.aplasta && d.quieto) { aux.scale.set(s * 1.35, s * o.aplasta, s * 1.35); aux.position.y = SUELO + s * o.aplasta * 0.5; }
        else aux.scale.setScalar(s);
        aux.updateMatrix(); inst.setMatrixAt(i, aux.matrix);
      }
      inst.instanceMatrix.needsUpdate = true;
      return edad < o.vida;
    }
    paso(0);
    fx.agregar(inst, paso);
  }

  function humo(fx, centro, o) {     // nubes de polvo
    if (!cache.humo) {
      var c = lienzo(128), g = c.getContext('2d'), r = azar(401);
      for (var k = 0; k < 60; k++) {
        var x = 64 + (r() - 0.5) * 70, y = 64 + (r() - 0.5) * 70, R = 10 + r() * 20;
        var gr = g.createRadialGradient(x, y, 0, x, y, R);
        gr.addColorStop(0, 'rgba(255,255,255,0.22)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = gr; g.beginPath(); g.arc(x, y, R, 0, 6.29); g.fill();
      }
      cache.humo = new T.CanvasTexture(c);
    }
    for (var i = 0, total = Math.ceil(o.n * 0.4); i < total; i++) (function () {
      var mat = new T.SpriteMaterial({
        map: cache.humo, color: new T.Color(o.color).convertSRGBToLinear(), transparent: true, depthWrite: false, opacity: 0
      });
      var s = new T.Sprite(mat), edad = 0, vida = o.vida * (0.7 + Math.random() * 0.5);
      var v = new T.Vector3(Math.random() - 0.5, Math.random() * 0.4, Math.random() - 0.5).multiplyScalar(o.fuerza);
      s.position.copy(centro).add(new T.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(o.radio));
      function paso(dt) {
        edad += dt; var k = lim(edad / vida);
        v.multiplyScalar(Math.exp(-2.5 * dt)); s.position.addScaledVector(v, dt);
        s.scale.setScalar(o.tam * (0.4 + Math.sqrt(k) * 1.2));
        mat.opacity = o.opacidad * Math.sin(Math.PI * Math.sqrt(k));
        return k < 1;
      }
      paso(0);
      fx.agregar(s, paso);
    })();
  }

  // Vector aleatorio que sale desde una cara (normal n)
  function salida(n, fuerza, abanico) {
    return new T.Vector3((Math.random() - 0.5) * abanico, (Math.random() - 0.2) * abanico, (Math.random() - 0.5) * abanico)
      .addScaledVector(n, fuerza * (0.5 + Math.random() * 0.7));
  }
  function cerca(p, r) {
    return new T.Vector3(p.x + (Math.random() - 0.5) * r, p.y + (Math.random() - 0.5) * r, p.z + (Math.random() - 0.5) * r);
  }
  function enCubo() {
    return new T.Vector3((Math.random() - 0.5) * 0.9, (Math.random() - 0.5) * 0.9, (Math.random() - 0.5) * 0.9);
  }
  function entre(a, b) { return a + Math.random() * (b - a); }

  // Granos o migas: sirve para tierra, piedra, arena, nieve y gotas
  function migas(fx, o) {
    particulas(fx, {
      geo: new T.IcosahedronGeometry(1, 0), mat: o.mat || plano('#ffffff'), colores: o.colores, n: o.n,
      vida: o.vida, g: o.g === undefined ? 7 : o.g, rebote: o.rebote, freno: o.freno, aleteo: o.aleteo,
      aplasta: o.aplasta, apoyo: 0.6, sombra: o.sombra,
      iniciar: function () {
        var p = o.donde ? cerca(o.donde, o.radio) : enCubo();
        var v = o.normal ? salida(o.normal, o.fuerza, o.abanico)
          : new T.Vector3(p.x * o.fuerza, p.y * o.fuerza + entre(0, o.fuerza), p.z * o.fuerza);
        return { p: p, v: v, s: entre(o.min, o.max) };
      }
    });
  }
  /* =====================================================================
     GENERADOR DE ROCAS
     ===================================================================== */
  function h3(x, y, z, s) {
    var h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(z, 1274126177) ^ Math.imul(s + 1, 1442695041);
    h = Math.imul(h ^ (h >>> 13), 1103515245);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }
  function ruido3(x, y, z, s) {
    var xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z), fx = x - xi, fy = y - yi, fz = z - zi;
    fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy); fz = fz * fz * (3 - 2 * fz);
    function c(dz) {
      return mez(mez(h3(xi, yi, zi + dz, s), h3(xi + 1, yi, zi + dz, s), fx),
                 mez(h3(xi, yi + 1, zi + dz, s), h3(xi + 1, yi + 1, zi + dz, s), fx), fy);
    }
    return mez(c(0), c(1), fz);
  }
  function fbm3(x, y, z, s) {
    return (ruido3(x, y, z, s) * 4 + ruido3(x * 2.03, y * 2.03, z * 2.03, s + 7) * 2 + ruido3(x * 4.1, y * 4.1, z * 4.1, s + 13)) / 7;
  }

  // Esfera de triángulos parejos (icosfera)
  function icosfera(nivel) {
    var clave = 'ico' + nivel;
    if (cache[clave]) return cache[clave];
    var t = (1 + Math.sqrt(5)) / 2, V = [], F;
    [[-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0], [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t],
     [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1]].forEach(function (p) {
      var l = Math.hypot(p[0], p[1], p[2]); V.push([p[0] / l, p[1] / l, p[2] / l]);
    });
    F = [[0,11,5],[0,5,1],[0,1,7],[0,7,10],[0,10,11],[1,5,9],[5,11,4],[11,10,2],[10,7,6],[7,1,8],
         [3,9,4],[3,4,2],[3,2,6],[3,6,8],[3,8,9],[4,9,5],[2,4,11],[6,2,10],[8,6,7],[9,8,1]];
    for (var n = 0; n < nivel; n++) {
      var medios = {}, G = [];
      var medio = function (a, b) {
        var k = a < b ? a + '_' + b : b + '_' + a;
        if (medios[k] === undefined) {
          var x = V[a][0] + V[b][0], y = V[a][1] + V[b][1], z = V[a][2] + V[b][2], l = Math.hypot(x, y, z);
          medios[k] = V.push([x / l, y / l, z / l]) - 1;
        }
        return medios[k];
      };
      F.forEach(function (f) {
        var a = medio(f[0], f[1]), b = medio(f[1], f[2]), c = medio(f[2], f[0]);
        G.push([f[0], a, c], [f[1], b, a], [f[2], c, b], [a, b, c]);
      });
      F = G;
    }
    return (cache[clave] = { V: V, F: F });
  }

  // Deforma la esfera: bultos, caras cortadas, grietas naturales y base plana
  function formaRoca(o) {
    var base = icosfera(o.nivel), r = azar(o.semilla), s = o.semilla, planos = [], k;
    for (k = 0; k < o.cortes; k++) {
      var z = r() * 2 - 1, a = r() * 6.283, q = Math.sqrt(1 - z * z);
      planos.push([Math.cos(a) * q, z * 0.8 + 0.1, Math.sin(a) * q, 0.66 + r() * 0.3]);
    }
    var V = [], luz = [], g = o.rugoso;
    base.V.forEach(function (d) {
      var x = d[0], y = d[1], z = d[2];
      if (o.cubica) {      // piedra de construcción: esfera "cuadrada"
        x = Math.sign(x) * Math.pow(Math.abs(x), o.cubica); y = Math.sign(y) * Math.pow(Math.abs(y), o.cubica);
        z = Math.sign(z) * Math.pow(Math.abs(z), o.cubica);
      }
      var bulto = 1 + (fbm3(d[0] * 1.5, d[1] * 1.5, d[2] * 1.5, s) - 0.5) * 0.75 * g;
      x *= bulto; y *= bulto; z *= bulto;
      for (var i = 0; i < planos.length; i++) {
        var p = planos[i], n = Math.hypot(p[0], p[1], p[2]);
        var sale = (x * p[0] + y * p[1] + z * p[2]) / n - p[3];
        if (sale > 0) { x -= p[0] / n * sale * 0.95; y -= p[1] / n * sale * 0.95; z -= p[2] / n * sale * 0.95; }
      }
      var cr = Math.pow(1 - Math.abs(fbm3(x * 2.6, y * 3.4, z * 2.6, s + 31) * 2 - 1), 9);
      var med = fbm3(x * 4.3, y * 4.3, z * 4.3, s + 41) - 0.5, fino = ruido3(x * 13, y * 13, z * 13, s + 51) - 0.5;
      var f = 1 + (med * 0.19 - cr * 0.075 + fino * 0.035) * g;
      V.push([x * f * o.escala[0], y * f * o.escala[1], z * f * o.escala[2]]);
      luz.push(1.06 - cr * 0.55 + med * 0.35);
    });
    if (o.base) V.forEach(function (v) { var m = -o.escala[1] * o.base; if (v[1] < m) v[1] = m + (v[1] - m) * 0.07; });
    return { V: V, F: base.F, luz: luz };
  }

  function normalesVertice(V, F) {
    var N3 = V.map(function () { return [0, 0, 0]; }), caras = [];
    F.forEach(function (f) {
      var a = V[f[0]], b = V[f[1]], c = V[f[2]];
      var ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
      var n = [uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx];
      caras.push(n);
      for (var i = 0; i < 3; i++) { var m = N3[f[i]]; m[0] += n[0]; m[1] += n[1]; m[2] += n[2]; }
    });
    N3.forEach(function (n) { var l = Math.hypot(n[0], n[1], n[2]) || 1; n[0] /= l; n[1] /= l; n[2] /= l; });
    return { vert: N3, cara: caras };
  }

  // Convierte la malla en geometría: aristas marcadas, textura proyectada y color por vértice
  function geometria(m, o) {
    var V = m.V, F = m.F, nn = normalesVertice(V, F), vecinas = V.map(function () { return []; });
    var unit = nn.cara.map(function (n) { var l = Math.hypot(n[0], n[1], n[2]) || 1; return [n[0] / l, n[1] / l, n[2] / l]; });
    F.forEach(function (f, i) { vecinas[f[0]].push(i); vecinas[f[1]].push(i); vecinas[f[2]].push(i); });
    var pos = [], nor = [], uv = [], col = [], grupos = [], esc = o.uv || 0.85, suelo = o.suelo;
    var cuantos = m.mat ? 2 : 1;
    for (var g = 0; g < cuantos; g++) {
      var inicio = pos.length / 3;
      for (var i = 0; i < F.length; i++) {
        if (m.mat && m.mat[i] !== g) continue;
        var n = unit[i], ax = Math.abs(n[0]), ay = Math.abs(n[1]), az = Math.abs(n[2]);
        for (var c = 0; c < 3; c++) {
          var id = F[i][c], p = V[id], sx = 0, sy = 0, sz = 0, lista = vecinas[id];
          for (var k = 0; k < lista.length; k++) {
            var u = unit[lista[k]];
            if (u[0] * n[0] + u[1] * n[1] + u[2] * n[2] > 0.78) { var w = nn.cara[lista[k]]; sx += w[0]; sy += w[1]; sz += w[2]; }
          }
          var l = Math.hypot(sx, sy, sz) || 1;
          pos.push(p[0], p[1], p[2]); nor.push(sx / l, sy / l, sz / l);
          if (ax >= ay && ax >= az) uv.push(p[2] * esc + 0.31, p[1] * esc + 0.17);
          else if (ay >= az) uv.push(p[0] * esc + 0.57, p[2] * esc + 0.73);
          else uv.push(p[0] * esc + 0.11, p[1] * esc + 0.47);
          var b = m.luz ? m.luz[id] : 1;
          if (suelo !== undefined) b *= mez(0.5, 1, suave(suelo, suelo + 0.28, p[1]));   // sombra de contacto
          var tono = ruido3(p[0] * 2.3 + 9, p[1] * 2.3, p[2] * 2.3, 77) - 0.5;
          var fresca = m.fresca && m.fresca[id] ? 1.3 : 1;
          col.push(lim(b * (1 + tono * 0.22) * fresca * 0.93), lim(b * fresca * 0.92), lim(b * (1 - tono * 0.2) * fresca * 0.92));
        }
      }
      grupos.push([inicio, pos.length / 3 - inicio, g]);
    }
    var geo = new T.BufferGeometry();
    geo.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
    geo.setAttribute('normal', new T.Float32BufferAttribute(nor, 3));
    geo.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
    geo.setAttribute('color', new T.Float32BufferAttribute(col, 3));
    if (m.mat) grupos.forEach(function (gr) { geo.addGroup(gr[0], gr[1], gr[2]); });
    geo.computeBoundingSphere();
    return geo;
  }
  function geoPiedrita(v) {      // rocas pequeñas reutilizadas para cascotes y escombros
    var clave = 'piedrita' + v;
    if (!cache[clave]) {
      cache[clave] = geometria(formaRoca({ nivel: 2, semilla: 900 + v * 13, cortes: 9, rugoso: 1, escala: [1, 0.8, 0.95] }), { uv: 0.35 });
      cache[clave].compartida = true;
    }
    return cache[clave];
  }

  /* =====================================================================
     TEXTURAS DE MINERALES
     ===================================================================== */
  function piedraBase() { return cache.piedra || (cache.piedra = texturaPiedra()); }

  function texturaAzufre() {
    var d = nuevaSuperficie();
    porPixel(d, function (u, v, i) {
      var wu = u + (fbm(u, v, 7, 3, 501) - 0.5) * 0.1, wv = v + (fbm(u, v, 7, 3, 502) - 0.5) * 0.1;
      var c = celdas(wu, wv, 11, 503), canto = suave(0, 0.14, c.f2 - c.f1), id = c.id, f1 = c.f1;
      var c2 = celdas(wu, wv, 34, 504), id2 = c2.id, canto2 = suave(0, 0.12, c2.f2 - c2.f1);
      var grande = fbm(u, v, 4, 4, 505), fino = fbm(u, v, 64, 2, 506);
      d.H[i] = 0.2 + grande * 0.3 + canto * (0.18 + id * 0.18) - f1 * 0.08 + canto2 * 0.08 + fino * 0.08;
      var t = lim((grande - 0.35) * 2 + (id - 0.5) * 0.7);
      d.C[i * 3] = mez(176, 244, t) + (id2 - 0.5) * 30;
      d.C[i * 3 + 1] = mez(128, 214, t) + (id2 - 0.5) * 34;
      d.C[i * 3 + 2] = mez(22, 62, t) + (fino - 0.5) * 30;
      d.R[i] = 0.42 + fino * 0.3 + (id2 > 0.88 ? -0.25 : 0);
      pintar(d, i, 247, 236, 160, suave(0.62, 0.75, fbm(u, v, 9, 3, 507)) * 0.8);   // costra pálida
      pintar(d, i, 150, 84, 20, (1 - canto) * 0.65);
      var gris = suave(0.6, 0.72, fbm(u, v, 5, 5, 508));
      pintar(d, i, 112 + fino * 40, 106 + fino * 38, 92 + fino * 34, gris);          // restos de roca
      d.R[i] = mez(d.R[i], 0.9, gris);
    });
    return terminar(d, 5.5, 1.2);
  }
  function texturaMetal() {
    var d = nuevaSuperficie(); d.M = new Float32Array(N * N);
    porPixel(d, function (u, v, i) {
      var wu = u + (fbm(u, v, 6, 4, 521) - 0.5) * 0.16, wv = v + (fbm(u, v, 6, 4, 522) - 0.5) * 0.16;
      var masa = fbm(wu, wv, 5, 5, 523), fino = fbm(u, v, 56, 3, 524), oxido = suave(0.38, 0.66, fbm(wu, wv, 4, 5, 525));
      var c = celdas(wu, wv, 13, 526), canto = c.f2 - c.f1, id = c.id;
      var veta = Math.pow(1 - Math.abs(fbm(wu, wv, 6, 4, 527) * 2 - 1), 7);
      var metal = lim(suave(0.62, 0.74, id) * suave(0.03, 0.12, canto) * suave(0.42, 0.58, masa) + suave(0.62, 0.88, veta));
      d.H[i] = 0.2 + masa * 0.42 + fino * 0.14 + metal * (0.1 + id * 0.12);
      var base = (fino - 0.5) * 55;
      d.C[i * 3] = mez(78, 158, oxido) + base; d.C[i * 3 + 1] = mez(66, 84, oxido) + base * 0.8; d.C[i * 3 + 2] = mez(60, 44, oxido) + base * 0.6;
      pintar(d, i, 196, 120, 56, suave(0.62, 0.75, fbm(u, v, 11, 3, 528)) * 0.75);    // óxido naranja
      var brillo = (id - 0.5) * 50 + (fino - 0.5) * 40;
      pintar(d, i, 158 + brillo, 142 + brillo, 128 + brillo, metal);
      d.M[i] = metal * 0.85; d.R[i] = mez(0.86 + fino * 0.12, 0.3 + fino * 0.25, metal);
    });
    return terminar(d, 6, 1.4);
  }
  function materialRoca(m, extra) {
    var p = { map: m.map, normalMap: m.normalMap, roughnessMap: m.roughnessMap, roughness: 1, metalness: 0,
              vertexColors: true, envMapIntensity: 0.4 };
    if (m.metalnessMap) { p.metalnessMap = m.metalnessMap; p.metalness = 1; p.envMapIntensity = 0.9; }
    return new T.MeshStandardMaterial(Object.assign(p, extra || {}));
  }

  /* ---------- Cristales y pepitas que sobresalen ---------- */
  function geoDesdeCaras(caras) {     // triángulos sueltos con sombreado plano
    var pos = [], uv = [];
    caras.forEach(function (t) { t.forEach(function (p) { pos.push(p[0], p[1], p[2]); uv.push(p[0] + p[2] * 0.5, p[1]); }); });
    var g = new T.BufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
    g.computeVertexNormals();
    return g;
  }
  function geoCristal() {
    var caras = [], n = 6;
    for (var i = 0; i < n; i++) {
      var a = i / n * 6.283, b = (i + 1) / n * 6.283;
      var p = [Math.cos(a) * 0.34, -0.2, Math.sin(a) * 0.34], q = [Math.cos(b) * 0.34, -0.2, Math.sin(b) * 0.34];
      var P = [Math.cos(a) * 0.28, 0.68, Math.sin(a) * 0.28], Q = [Math.cos(b) * 0.28, 0.68, Math.sin(b) * 0.28];
      caras.push([p, P, q], [q, P, Q], [P, [0.05, 1, 0.02], Q]);
    }
    return geoDesdeCaras(caras);
  }
  function geoPepita() {
    var base = icosfera(1);
    var V = base.V.map(function (v, i) { var f = 0.65 + h3(i, 3, 9, 61) * 0.65; return [v[0] * f, v[1] * f * 0.8, v[2] * f]; });
    return geoDesdeCaras(base.F.map(function (f) { return [V[f[0]], V[f[1]], V[f[2]]]; }));
  }
  function geoFragmento(semilla) {    // lámina irregular de metal fundido
    var r = azar(semilla), n = 7, A = [], B = [], caras = [];
    for (var i = 0; i < n; i++) {
      var a = i / n * 6.283, R = 0.55 + r() * 0.55;
      A.push([Math.cos(a) * R, 0.16 + r() * 0.1, Math.sin(a) * R * 0.75]); B.push([A[i][0] * 0.9, -0.14, A[i][2] * 0.9]);
    }
    for (var j = 0; j < n; j++) {
      var k = (j + 1) % n;
      caras.push([[0, 0.26, 0], A[k], A[j]], [[0, -0.14, 0], B[j], B[k]], [A[j], A[k], B[j]], [B[j], A[k], B[k]]);
    }
    return geoDesdeCaras(caras);
  }
  function brillante(color, metal, rugoso, luzPropia) {
    return new T.MeshStandardMaterial({
      color: new T.Color(color).convertSRGBToLinear(), metalness: metal, roughness: rugoso, flatShading: true,
      emissive: new T.Color(luzPropia || 0).convertSRGBToLinear(), envMapIntensity: metal > 0.5 ? 1.1 : 0.5
    });
  }

  /* =====================================================================
     ROCAS MINABLES
     ===================================================================== */
  var TIPOS = {
    piedra: {
      semilla: 7, escala: [0.72, 0.56, 0.64], mineral: 0,
      migas: ['#8d8e90', '#66676b', '#b4b5b2', '#57585b'], polvo: '#a9a8a4', chispa: 0xffc45a, marca: 0xffe9b0
    },
    azufre: {
      semilla: 19, escala: [0.68, 0.58, 0.63], mineral: 0.36, textura: texturaAzufre,
      migas: ['#f1d23e', '#d6a91f', '#8b8678', '#f7e98c'], polvo: '#d9c66a', chispa: 0xffe14a, marca: 0xfff27a
    },
    metal: {
      semilla: 33, escala: [0.74, 0.54, 0.62], mineral: 0.42, textura: texturaMetal,
      migas: ['#a6623a', '#6e5547', '#c9bcae', '#8a8580'], polvo: '#a58a78', chispa: 0xffa53a, marca: 0xffb066
    }
  };
  var VIDA = 12;

  function texturaMarca() {
    if (cache.marca) return cache.marca;
    var c = lienzo(128), g = c.getContext('2d');
    var gr = g.createRadialGradient(64, 64, 0, 64, 64, 40);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(255,255,255,0.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
    g.fillStyle = '#fff';
    for (var i = 0; i < 4; i++) {
      g.save(); g.translate(64, 64); g.rotate(i * Math.PI / 2);
      g.beginPath(); g.moveTo(0, -5); g.lineTo(62, 0); g.lineTo(0, 5); g.fill(); g.restore();
    }
    return (cache.marca = new T.CanvasTexture(c));
  }

  function crearRoca(nombre) {
    var tipo = TIPOS[nombre], raiz = new T.Group(), cuerpo = new T.Group(), efectos = new T.Group();
    raiz.add(cuerpo); raiz.add(efectos);

    var forma = formaRoca({ nivel: 4, semilla: tipo.semilla, cortes: 17, rugoso: 1, escala: tipo.escala, base: 0.6 });
    var minY = Math.min.apply(null, forma.V.map(function (v) { return v[1]; }));
    forma.V.forEach(function (v) { v[1] += SUELO - minY - 0.012; });
    var centro = new T.Vector3(0, SUELO + tipo.escala[1] * 0.62, 0);

    var roca = piedraBase(), matPiedra = materialRoca(roca), mats = matPiedra, mineral = null;
    var umbral = 9, valor = null;
    if (tipo.mineral) {
      mineral = cache[nombre] || (cache[nombre] = tipo.textura());
      var matMineral = materialRoca(mineral);
      mats = [matPiedra, matMineral];
      // manchas y vetas de mineral sobre la roca
      valor = forma.V.map(function (v) {
        var veta = 1 - Math.abs(fbm3(v[0] * 2.2, v[1] * 3.6, v[2] * 2.2, tipo.semilla + 61) * 2 - 1);
        return fbm3(v[0] * 3.1, v[1] * 3.1, v[2] * 3.1, tipo.semilla + 71) * 0.75 + veta * veta * veta * 0.25;
      });
      var orden = valor.slice().sort(function (a, b) { return a - b; });
      umbral = orden[Math.floor(orden.length * (1 - tipo.mineral))];
      var nn = normalesVertice(forma.V, forma.F).vert;
      forma.V.forEach(function (v, i) {
        var extra = Math.min(0.028, Math.max(0, valor[i] - umbral) * 0.35);
        v[0] += nn[i][0] * extra; v[1] += nn[i][1] * extra; v[2] += nn[i][2] * extra;
      });
      forma.mat = forma.F.map(function (f) { return (valor[f[0]] + valor[f[1]] + valor[f[2]]) / 3 > umbral ? 1 : 0; });
    }
    var original = {
      V: forma.V.map(function (v) { return v.slice(); }), luz: forma.luz.slice(), mat: forma.mat ? forma.mat.slice() : null
    };
    forma.fresca = new Uint8Array(forma.V.length);
    var vecinos = forma.V.map(function () { return []; });
    forma.F.forEach(function (f) {
      for (var i = 0; i < 3; i++) { var a = f[i], b = f[(i + 1) % 3]; if (vecinos[a].indexOf(b) < 0) vecinos[a].push(b); if (vecinos[b].indexOf(a) < 0) vecinos[b].push(a); }
    });

    var principal = malla(geometria(forma, { suelo: SUELO }), mats);
    cuerpo.add(principal);
    var normales = normalesVertice(forma.V, forma.F).vert;
    var ojo = new T.Vector3(2, 1.4, 2.6);      // posición de la cámara (se actualiza al dibujar)
    principal.onBeforeRender = function (r, s, camara) { ojo.copy(camara.position); raiz.worldToLocal(ojo); };   // cámara en coordenadas de la roca (la roca puede estar escalada y girada)

    /* cristales (azufre) o pepitas (metal) */
    var adornos = null, datosAdorno = [], aux = new T.Object3D();
    if (tipo.mineral) {
      var esCristal = nombre === 'azufre', r = azar(tipo.semilla + 5), candidatos = [];
      valor.forEach(function (v, i) { if (v > umbral + 0.02 && forma.V[i][1] > SUELO + 0.12) candidatos.push(i); });
      for (var c = 0; c < (esCristal ? 17 : 24) && candidatos.length; c++) {
        var iv = candidatos[Math.floor(r() * candidatos.length)], racimo = esCristal ? 2 + Math.floor(r() * 4) : 1 + Math.floor(r() * 2);
        for (var k = 0; k < racimo; k++) {
          var p = forma.V[iv], n = normales[iv], tam = esCristal ? 0.03 + r() * r() * 0.085 : 0.018 + r() * r() * 0.05;
          datosAdorno.push({
            p: new T.Vector3(p[0] + (r() - 0.5) * 0.06, p[1] + (r() - 0.5) * 0.05, p[2] + (r() - 0.5) * 0.06),
            n: new T.Vector3(n[0] + (r() - 0.5) * 0.9, n[1] + (r() - 0.5) * 0.9, n[2] + (r() - 0.5) * 0.9).normalize(),
            s: tam, alto: esCristal ? 1 + r() * 0.5 : 1, vivo: true
          });
        }
      }
      var matAdorno = esCristal ? brillante('#ffd92e', 0.1, 0.22, '#3a2800') : brillante('#9c836e', 0.9, 0.34);
      adornos = new T.InstancedMesh(esCristal ? geoCristal() : geoPepita(), matAdorno, datosAdorno.length);
      adornos.castShadow = adornos.receiveShadow = true; adornos.frustumCulled = false;
      cuerpo.add(adornos);
    }
    function pintarAdornos() {
      if (!adornos) return;
      datosAdorno.forEach(function (d, i) {
        aux.position.copy(d.p); aux.quaternion.setFromUnitVectors(EJE_Y, d.n);
        var s = d.vivo ? d.s : 0; aux.scale.set(s, s * d.alto, s); aux.updateMatrix(); adornos.setMatrixAt(i, aux.matrix);
      });
      adornos.instanceMatrix.needsUpdate = true;
    }
    pintarAdornos();

    /* cascotes alrededor de la base, agrupados para dibujarlos de una vez */
    var geos = [geoPiedrita(0), geoPiedrita(1), geoPiedrita(2)], rc = azar(tipo.semilla + 9), tandas = {};
    for (var q = 0; q < 15; q++) {
      var ang = rc() * 6.283, dist = 0.9 + rc() * 0.22, t = 0.025 + rc() * rc() * 0.095;
      var conMineral = tipo.mineral && q % 4 === 0, clave = (q % 3) + (conMineral ? 'm' : 'p');
      var tanda = tandas[clave] || (tandas[clave] = { geo: geos[q % 3], mat: conMineral ? mats[1] : matPiedra, lista: [] });
      tanda.lista.push({ x: Math.cos(ang) * tipo.escala[0] * dist * 1.06, y: SUELO + t * 0.45, z: Math.sin(ang) * tipo.escala[2] * dist * 1.06,
        s: t, rx: rc() * 0.5, ry: rc() * 6.28, rz: rc() * 0.5 });
    }
    Object.keys(tandas).forEach(function (k) {
      var td = tandas[k], inst = new T.InstancedMesh(td.geo, td.mat, td.lista.length);
      td.lista.forEach(function (c, i) {
        aux.position.set(c.x, c.y, c.z); aux.scale.setScalar(c.s); aux.rotation.set(c.rx, c.ry, c.rz);
        aux.updateMatrix(); inst.setMatrixAt(i, aux.matrix);
      });
      inst.castShadow = inst.receiveShadow = true; inst.frustumCulled = false;
      raiz.add(inst);
    });

    /* punto débil brillante */
    var marca = new T.Sprite(new T.SpriteMaterial({
      map: texturaMarca(), color: new T.Color(tipo.marca), transparent: true, depthWrite: false, blending: T.AdditiveBlending
    }));
    var marcaN = new T.Vector3(0, 0, 1), marcaEdad = 0;
    cuerpo.add(marca);
    function moverMarca() {
      var frente = ojo.clone().sub(centro).normalize(), buenos = [];
      for (var i = 0; i < forma.V.length; i++) {
        var v = forma.V[i], n = normales[i], d = n[0] * frente.x + n[1] * frente.y + n[2] * frente.z;
        if (d > 0.72 && v[1] > SUELO + 0.22) buenos.push(i);
      }
      if (!buenos.length) return;
      var e = buenos[Math.floor(Math.random() * buenos.length)];
      marcaN.set(normales[e][0], normales[e][1], normales[e][2]);
      marca.position.set(forma.V[e][0], forma.V[e][1], forma.V[e][2]).addScaledVector(marcaN, 0.05);
      marcaEdad = 0;
    }
    moverMarca();

    /* efectos temporales */
    var activos = [];
    var fx = { agregar: function (obj, paso) { efectos.add(obj); activos.push({ obj: obj, paso: paso }); } };
    function quitar(e) {
      efectos.remove(e.obj);
      if (!e.obj.isSprite && !e.obj.geometry.compartida) e.obj.geometry.dispose();
      if (e.obj.isInstancedMesh && e.obj.dispose) e.obj.dispose();
    }

    /* grietas que siguen la superficie */
    var grietas = [], matGrieta = new T.MeshBasicMaterial({
      color: 0x0b0908, transparent: true, opacity: 0.82, depthWrite: false, side: T.DoubleSide,
      polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2
    });
    function agrietar(punto) {
      var inicio = 0, mejor = 1e9;
      forma.V.forEach(function (v, i) {
        var d = (v[0] - punto.x) * (v[0] - punto.x) + (v[1] - punto.y) * (v[1] - punto.y) + (v[2] - punto.z) * (v[2] - punto.z);
        if (d < mejor) { mejor = d; inicio = i; }
      });
      var pos = [], usados = [inicio];
      for (var rama = 0; rama < 3; rama++) {
        var dir = new T.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize();
        var a = inicio, pasos = 4 + Math.floor(Math.random() * 5), visto = {};
        for (var k = 0; k < pasos; k++) {
          visto[a] = true;
          var sig = -1, punt = -9, A = forma.V[a];
          for (var j = 0; j < vecinos[a].length; j++) {
            var b = vecinos[a][j]; if (visto[b]) continue;
            var B = forma.V[b], l = Math.hypot(B[0] - A[0], B[1] - A[1], B[2] - A[2]) || 1;
            var s = ((B[0] - A[0]) * dir.x + (B[1] - A[1]) * dir.y + (B[2] - A[2]) * dir.z) / l + Math.random() * 0.8;
            if (s > punt) { punt = s; sig = b; }
          }
          if (sig < 0 || forma.V[sig][1] < SUELO + 0.03) break;
          var P = forma.V[a], Q = forma.V[sig], n = normales[a], m = normales[sig];
          var lado = new T.Vector3(Q[0] - P[0], Q[1] - P[1], Q[2] - P[2]).cross(new T.Vector3(n[0], n[1], n[2])).normalize();
          var w0 = 0.0065 * (1 - k / pasos) + 0.0015, w1 = 0.0065 * (1 - (k + 1) / pasos) + 0.001, h = 0.006;
          var p0 = [P[0] + n[0] * h + lado.x * w0, P[1] + n[1] * h + lado.y * w0, P[2] + n[2] * h + lado.z * w0];
          var p1 = [P[0] + n[0] * h - lado.x * w0, P[1] + n[1] * h - lado.y * w0, P[2] + n[2] * h - lado.z * w0];
          var p2 = [Q[0] + m[0] * h + lado.x * w1, Q[1] + m[1] * h + lado.y * w1, Q[2] + m[2] * h + lado.z * w1];
          var p3 = [Q[0] + m[0] * h - lado.x * w1, Q[1] + m[1] * h - lado.y * w1, Q[2] + m[2] * h - lado.z * w1];
          [p0, p1, p2, p2, p1, p3].forEach(function (v) { pos.push(v[0], v[1], v[2]); });
          usados.push(sig); a = sig;
        }
      }
      if (!pos.length) return;
      var g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
      var m3 = new T.Mesh(g, matGrieta);
      cuerpo.add(m3); grietas.push({ m: m3, v: usados });
    }
    function borrarGrietas(filtro) {
      grietas = grietas.filter(function (g) {
        if (filtro && !g.v.some(filtro)) return true;
        cuerpo.remove(g.m); g.m.geometry.dispose(); return false;
      });
    }

    function rehacer() {
      var vieja = principal.geometry;
      principal.geometry = geometria(forma, { suelo: SUELO }); vieja.dispose();
      normales = normalesVertice(forma.V, forma.F).vert;
    }

    // Escombros con forma de roca que conservan la textura
    function escombros(n, min, max, donde, normal, vida, fuerza) {
      for (var k = 0; k < 3; k++) {
        var mat = (tipo.mineral && k === 0 ? mats[1] : matPiedra).clone();
        particulas(fx, {
          geo: geoPiedrita(k), mat: mat, n: n, vida: vida, g: 7.5, rebote: 0.28, apoyo: 0.55, sombra: true, giro: 9,
          iniciar: function () {
            var p, v;
            if (donde) { p = cerca(donde, 0.3); v = salida(normal, fuerza, 1.1); v.y += entre(0.2, 1.2); }
            else {
              p = new T.Vector3(entre(-0.7, 0.7) * tipo.escala[0], SUELO + entre(0.1, 1.4) * tipo.escala[1], entre(-0.7, 0.7) * tipo.escala[2]);
              v = new T.Vector3(p.x * fuerza + entre(-0.4, 0.4), entre(0.2, 2.2), p.z * fuerza + entre(-0.4, 0.4));
            }
            return { p: p, v: v, s: entre(min, max) };
          }
        });
      }
    }
    function lluviaMineral(n, donde, normal, vida) {
      if (!tipo.mineral) return;
      var esCristal = nombre === 'azufre';
      particulas(fx, {
        geo: esCristal ? geoCristal() : geoPepita(), mat: adornos.material.clone(), n: n, vida: vida, g: 7.5, rebote: 0.35, apoyo: 0.35, sombra: true,
        iniciar: function () {
          var p = donde ? cerca(donde, 0.25) : new T.Vector3(entre(-0.4, 0.4), SUELO + entre(0.2, 0.8), entre(-0.4, 0.4));
          var v = normal ? salida(normal, 1.8, 1.4) : new T.Vector3(p.x * 4, entre(0.8, 2.8), p.z * 4);
          return { p: p, v: v, s: entre(0.025, 0.065) };
        }
      });
    }
    function chispas(p, n, cuantas) {
      particulas(fx, {
        geo: new T.BoxGeometry(0.09, 1, 0.09), mat: new T.MeshBasicMaterial({ color: tipo.chispa, blending: T.AdditiveBlending, transparent: true }),
        n: cuantas, vida: 0.45, g: 5, alinear: true, apoyo: 0,
        iniciar: function () { return { p: p.clone().addScaledVector(n, 0.03), v: salida(n, 2.4, 3.4), s: entre(0.025, 0.085) }; }
      });
    }

    // Arranca un pedazo de la roca: corta con un plano en la zona golpeada
    function desprender(punto) {
      var n = punto.clone().sub(centro); n.y = Math.max(-0.05, n.y * 0.6); n.normalize();
      var max = -9, i, v, s;
      for (i = 0; i < forma.V.length; i++) {
        v = forma.V[i]; if (v[1] < SUELO + 0.05) continue;
        s = (v[0] - centro.x) * n.x + (v[1] - centro.y) * n.y + (v[2] - centro.z) * n.z; if (s > max) max = s;
      }
      var plano = Math.max(max - 0.2, tipo.escala[1] * 0.4), movido = {};
      for (i = 0; i < forma.V.length; i++) {
        v = forma.V[i];
        s = (v[0] - centro.x) * n.x + (v[1] - centro.y) * n.y + (v[2] - centro.z) * n.z - plano;
        if (s <= 0) continue;
        var aspero = (fbm3(v[0] * 7, v[1] * 7, v[2] * 7, 205) - 0.5) * 0.13;
        var corre = s - Math.max(-0.05, aspero * Math.min(1, s * 14));
        v[0] -= n.x * corre; v[1] = Math.max(SUELO - 0.012, v[1] - n.y * corre); v[2] -= n.z * corre;
        forma.fresca[i] = 1; forma.luz[i] = 0.92 + aspero * 2.2; movido[i] = true;
      }
      datosAdorno.forEach(function (d) {
        if ((d.p.x - centro.x) * n.x + (d.p.y - centro.y) * n.y + (d.p.z - centro.z) * n.z > plano - 0.03) d.vivo = false;
      });
      pintarAdornos(); rehacer();
      borrarGrietas(function (i) { return movido[i]; });
      var desde = centro.clone().addScaledVector(n, plano + 0.1);
      escombros(2, 0.04, 0.12, desde, n, 3.2, 1.1);
      lluviaMineral(12, desde, n, 3);
      migas(fx, { donde: desde, normal: n, radio: 0.35, n: 45, min: 0.008, max: 0.028, colores: tipo.migas, vida: 2.2, fuerza: 1.4, abanico: 1.8, rebote: 0.3, g: 8 });
      humo(fx, desde, { n: 8, color: tipo.polvo, tam: 0.4, vida: 1.3, fuerza: 0.9, radio: 0.35, opacidad: 0.55 });
    }

    var dano = 0, etapa = 0, estado = 'listo', reloj = 0, sacudida = 0, auto = false, espera = 0, calma = 0;
    var dirGolpe = new T.Vector3(0, 0, 1);

    function golpear(puntoLocal, normalCara) {   // coordenadas locales de la roca
      if (estado !== 'listo') return;
      var p = puntoLocal.clone(), n = normalCara.clone().normalize();
      var certero = p.distanceTo(marca.position) < 0.19;
      dano += certero ? 2 : 1; sacudida = certero ? 1.4 : 1; calma = 0; dirGolpe.copy(n);
      if (raiz.userData.alGolpe) raiz.userData.alGolpe(certero);
      migas(fx, { donde: p, normal: n, radio: 0.1, n: certero ? 30 : 14, min: 0.008, max: 0.03, colores: tipo.migas, vida: 1.6, fuerza: 1.8, abanico: 1.6, rebote: 0.4, g: 8 });
      chispas(p, n, certero ? 46 : 14);
      humo(fx, p, { n: certero ? 5 : 2, color: tipo.polvo, tam: 0.24, vida: 0.7, fuerza: 0.6, radio: 0.1, opacidad: 0.5 });
      lluviaMineral(certero ? 7 : 3, p, n, 1.8);
      if (certero) {     // destello del golpe certero
        var destello = new T.Sprite(marca.material.clone()), edad = 0;
        destello.position.copy(p).addScaledVector(n, 0.07);
        var paso = function (dt) { edad += dt; destello.scale.setScalar(0.2 + edad * 3); destello.material.opacity = 1 - edad / 0.25; return edad < 0.25; };
        paso(0); fx.agregar(destello, paso);
      }
      if (dano >= VIDA) { romper(); return; }
      var nueva = Math.floor(dano / (VIDA / 4));
      if (nueva > etapa) { etapa = nueva; desprender(p); } else agrietar(p);
      moverMarca();
    }
    function romper() {
      if (raiz.userData.alRomper) raiz.userData.alRomper();
      estado = 'roto'; reloj = 0; auto = false; cuerpo.visible = false; borrarGrietas();
      escombros(8, 0.05, 0.17, null, null, 4.2, 1.5);
      lluviaMineral(55, null, null, 3.8);
      migas(fx, { donde: centro, normal: EJE_Y, radio: 0.8, n: 140, min: 0.008, max: 0.034, colores: tipo.migas, vida: 3, fuerza: 1.2, abanico: 4, rebote: 0.3, g: 8, sombra: true });
      humo(fx, new T.Vector3(0, SUELO + 0.25, 0), { n: 26, color: tipo.polvo, tam: 0.75, vida: 2.2, fuerza: 1.7, radio: 0.9, opacidad: 0.6 });
    }
    function reaparecer() {
      for (var i = 0; i < forma.V.length; i++) {
        forma.V[i][0] = original.V[i][0]; forma.V[i][1] = original.V[i][1]; forma.V[i][2] = original.V[i][2];
        forma.luz[i] = original.luz[i]; forma.fresca[i] = 0;
      }
      datosAdorno.forEach(function (d) { d.vivo = true; });
      pintarAdornos(); rehacer(); dano = 0; etapa = 0;
    }

    function actualizar(t, dt) {
      for (var i = activos.length - 1; i >= 0; i--) if (!activos[i].paso(dt)) { quitar(activos[i]); activos.splice(i, 1); }

      if (auto && estado === 'listo') {
        espera -= dt;
        if (espera <= 0) {
          espera = 0.42;
          var p, n;
          if (Math.random() < 0.45) { p = marca.position.clone(); n = marcaN.clone(); }
          else {
            var frente = ojo.clone().sub(centro).normalize(), e = 0;
            for (var k = 0; k < 60; k++) {
              e = Math.floor(Math.random() * forma.V.length);
              var m = normales[e];
              if (m[0] * frente.x + m[1] * frente.y + m[2] * frente.z > 0.6 && forma.V[e][1] > SUELO + 0.18) break;
            }
            p = new T.Vector3(forma.V[e][0], forma.V[e][1], forma.V[e][2]);
            n = new T.Vector3(normales[e][0], normales[e][1], normales[e][2]);
          }
          golpear(p, n);
        }
      }

      if (estado === 'listo') {
        cuerpo.position.set(0, 0, 0); cuerpo.scale.setScalar(1);
        if (sacudida > 0) {
          sacudida = Math.max(0, sacudida - dt * 4.5);
          var q = sacudida * sacudida;
          cuerpo.position.set(-dirGolpe.x * 0.018 * q + Math.sin(t * 80) * 0.008 * q, 0, -dirGolpe.z * 0.018 * q + Math.cos(t * 71) * 0.008 * q);
        }
        marcaEdad += dt;
        marca.scale.setScalar((0.13 + Math.sin(t * 7) * 0.025) * Math.min(1, marcaEdad * 5));
        marca.material.rotation = t * 0.8;
        var vista = ojo.clone().sub(marca.position).normalize();
        if (marcaEdad > 0.6 && vista.dot(marcaN) < 0.2) moverMarca();    // la cámara giró: buscar otro punto
        if (dano) {     // si se deja de picar, la roca se recupera
          calma += dt;
          if (calma > 8) { borrarGrietas(); reaparecer(); moverMarca(); humo(fx, centro, { n: 10, color: tipo.polvo, tam: 0.5, vida: 1, fuerza: 0.8, radio: 0.9, opacidad: 0.4 }); }
        }
      } else if (estado === 'roto') {
        reloj += dt;
        if (reloj > RESPAWN_S) {
          reaparecer(); estado = 'volver'; reloj = 0; cuerpo.visible = true;
          humo(fx, new T.Vector3(0, SUELO + 0.15, 0), { n: 14, color: tipo.polvo, tam: 0.55, vida: 1.2, fuerza: 1.2, radio: 1, opacidad: 0.5 });
        }
      } else {     // una roca nueva brota del suelo
        reloj += dt;
        var a = suave(0, 0.8, reloj), e2 = 0.55 + 0.45 * a;
        cuerpo.scale.setScalar(e2); cuerpo.position.y = SUELO * (1 - e2) - (1 - a) * 0.25;
        if (reloj >= 0.8) { estado = 'listo'; cuerpo.scale.setScalar(1); cuerpo.position.set(0, 0, 0); moverMarca(); }
      }
    }

    raiz.userData.animar = actualizar;
    raiz.userData.reiniciar = function () { borrarGrietas(); reaparecer(); estado = 'listo'; reloj = 0; auto = false; calma = 0; cuerpo.visible = true; cuerpo.scale.setScalar(1); cuerpo.position.set(0, 0, 0); moverMarca(); };
    raiz.userData.entero = function () { return estado === 'listo' || estado === 'volver'; };
    raiz.userData.golpearMundo = function (pw, nw) {   // punto y normal en coordenadas del mundo
      raiz.updateMatrixWorld(true); var pl = raiz.worldToLocal(pw.clone()), nl = nw.clone().applyQuaternion(raiz.quaternion.clone().invert()).normalize(); golpear(pl, nl);
    };
    raiz.userData.golpear = golpear;
    raiz.userData.minar = function () { if (estado === 'listo') { auto = true; espera = 0; } };
    raiz.userData.tocar = function (rayo) {
      if (!cuerpo.visible) return null;
      var h = rayo.intersectObject(principal, false)[0];
      return h ? { d: h.distance, p: h.point, n: h.face.normal.clone() } : null;
    };
    return raiz;
  }


  /* =====================================================================
     GESTOR: reparte las rocas por el mundo y las reubica según dónde esté el jugador
     ===================================================================== */
  var CEL = 200, RAD = 460, POOL = { piedra: 6, metal: 3, azufre: 3 }, ESC = 2.4, RADIO_COL = 2.5;
  var G = { grupo: null, pool: [], ocupado: {}, ctx: null, t: 0, ux: 1e9, uz: 1e9, nuevo: 0, listo: false };
  var DROP = {
    piedra: { golpe: { piedra: [3, 7] }, romper: { piedra: [20, 30] } },
    metal: { golpe: { hierro: [2, 5] }, romper: { hierro: [12, 18], cobre: [4, 8], piezas: [1, 3] } },
    azufre: { golpe: { azufre: [2, 5] }, romper: { azufre: [12, 18] } }
  };
  function azl(a, b) { return Math.round(a + Math.random() * (b - a)); }
  function dar(tipo, que, certero) {
    var tb = DROP[tipo][que], k, out = {}; for (k in tb) out[k] = azl(tb[k][0], tb[k][1]) * (que === 'golpe' && certero ? 2 : 1);
    if (G.ctx && G.ctx.dar) G.ctx.dar(out);
  }
  function sitio(ci, cj) {   // la roca que le toca a una celda (siempre la misma); null si esa celda no tiene
    if (hash(ci, cj, 901) > 0.5) return null;
    var t = hash(ci, cj, 902);
    return { key: ci + ',' + cj, tipo: t < 0.5 ? 'piedra' : t < 0.78 ? 'metal' : 'azufre', x: (ci + 0.15 + 0.7 * hash(ci, cj, 903)) * CEL, z: (cj + 0.15 + 0.7 * hash(ci, cj, 904)) * CEL, ry: hash(ci, cj, 905) * 6.283 };
  }
  function valido(s) {
    var c = G.ctx, h = c.alt(s.x, s.z), d = 3.5, a = c.alt(s.x + d, s.z), b = c.alt(s.x - d, s.z), e = c.alt(s.x, s.z + d), f = c.alt(s.x, s.z - d), mn = Math.min(a, b, e, f, h), mx = Math.max(a, b, e, f, h);
    if (mn < c.agua + 2) return false;                     // nada de agua ni orillas
    if (mx - mn > 3.2) return false;                       // ni pendientes fuertes
    if (Math.hypot(s.x, s.z - 160) < 70) return false;     // despejado el punto de llegada
    return !(c.ocupado && c.ocupado(s.x, s.z));
  }
  function construirUna() {
    var i, p;
    for (i = 0; i < G.pool.length; i++) { p = G.pool[i]; if (!p.obj) {
      try {
        p.obj = crearRoca(p.tipo); p.obj.visible = false; p.obj.userData.alGolpe = function (tp) { return function (cer) { dar(tp, 'golpe', cer); }; }(p.tipo); p.obj.userData.alRomper = function (tp) { return function () { dar(tp, 'romper'); }; }(p.tipo);
        G.grupo.add(p.obj);
      } catch (e) { p.obj = null; p.malo = true; if (global.console) console.error(e); }
      return true;
    } }
    return false;
  }
  function liberar(p) { if (p.sitio) delete G.ocupado[p.sitio.key]; p.sitio = null; if (p.obj) p.obj.visible = false; }
  function reubicar(ux, uz) {
    var c = G.ctx, ci0 = Math.floor((ux - RAD) / CEL), ci1 = Math.floor((ux + RAD) / CEL), cj0 = Math.floor((uz - RAD) / CEL), cj1 = Math.floor((uz + RAD) / CEL), ci, cj, s, d, want = {}, lista = [], i, p, j;
    for (ci = ci0; ci <= ci1; ci++) for (cj = cj0; cj <= cj1; cj++) {
      s = sitio(ci, cj); if (!s) continue; d = Math.hypot(s.x - ux, s.z - uz); if (d > RAD || !valido(s)) continue; s.d = d; want[s.key] = s; lista.push(s);
    }
    for (i = 0; i < G.pool.length; i++) { p = G.pool[i]; if (p.sitio && !want[p.sitio.key]) liberar(p); }
    lista.sort(function (a, b) { return a.d - b.d; });
    for (j = 0; j < lista.length; j++) {
      s = lista[j]; if (G.ocupado[s.key]) continue;
      for (i = 0; i < G.pool.length; i++) { p = G.pool[i]; if (p.obj && !p.sitio && p.tipo === s.tipo) {
        p.sitio = s; G.ocupado[s.key] = p; p.obj.position.set(s.x, c.alt(s.x, s.z) + 0.575 * ESC - 0.12, s.z); p.obj.scale.setScalar(ESC); p.obj.rotation.set(0, s.ry, 0);
        p.obj.visible = true; p.obj.userData.reiniciar(); break;
      } }
    }
  }
  var API = E.Rocas = {
    /* ctx: { alt(x,z) altura en memoria, agua (y del agua), ocupado(x,z) → bool, dar({recurso:n}) } */
    iniciar: function (THREE_, escena, ctx) {
      T = THREE_; EJE_Y = new T.Vector3(0, 1, 0); API.detener(); G.ctx = ctx; G.grupo = new T.Group(); escena.add(G.grupo); G.pool = []; G.ocupado = {}; G.ux = 1e9; G.t = 0; G.listo = true;
      Object.keys(POOL).forEach(function (tp) { for (var i = 0; i < POOL[tp]; i++) G.pool.push({ tipo: tp, obj: null, sitio: null }); });
    },
    _estado: function () { return G; },
    detener: function () {
      if (!G.grupo) return; if (G.grupo.parent) G.grupo.parent.remove(G.grupo);
      G.grupo.traverse(function (o) { if (o.geometry) o.geometry.dispose(); }); G.grupo = null; G.pool = []; G.ocupado = {}; G.listo = false;
    },
    actualizar: function (dt, t, ux, uz) {
      if (!G.listo) return; var i, p;
      G.nuevo -= dt; if (G.nuevo <= 0) { G.nuevo = 0.25; construirUna(); }
      G.t -= dt; if (G.t <= 0 || Math.hypot(ux - G.ux, uz - G.uz) > 60) { G.t = 1.5; G.ux = ux; G.uz = uz; try { reubicar(ux, uz); } catch (e) { if (global.console && !G.err) { G.err = 1; console.error(e); } } }
      for (i = 0; i < G.pool.length; i++) { p = G.pool[i]; if (p.obj && p.sitio) { try { p.obj.userData.animar(t, dt); } catch (e2) { } } }
    },
    /* empuja al jugador fuera de las rocas: devuelve el movimiento corregido [mx, mz] */
    empujar: function (x, z, mx, mz) {
      if (!G.listo) return null; var i, p, o, dx, dz, d, R = RADIO_COL, tx = x + mx, tz = z + mz, ch = false;
      for (i = 0; i < G.pool.length; i++) { p = G.pool[i]; o = p.obj; if (!o || !p.sitio || !o.visible || !o.userData.entero()) continue;
        dx = tx - o.position.x; dz = tz - o.position.z; d = Math.hypot(dx, dz); if (d < R && d > 1e-4) { tx = o.position.x + dx / d * R; tz = o.position.z + dz / d * R; ch = true; } }
      return ch ? [tx - x, tz - z] : null;
    },
    /* un golpe del jugador: origen (ojos) y dirección de la mirada; devuelve true si dio a una roca */
    golpear: function (origen, dir) {
      if (!G.listo) return false; var i, p, o, best = null, bd = 1e9, rc = new T.Raycaster(origen, dir.clone().normalize(), 0, 7), h, dx, dz, dd, dot;
      for (i = 0; i < G.pool.length; i++) { p = G.pool[i]; o = p.obj; if (!o || !p.sitio || !o.visible || !o.userData.entero()) continue;
        dx = o.position.x - origen.x; dz = o.position.z - origen.z; dd = Math.hypot(dx, dz); if (dd > RADIO_COL + 4.2) continue;
        dot = (dx * dir.x + dz * dir.z) / (dd * Math.hypot(dir.x, dir.z) || 1); if (dot < 0.35) continue;
        o.updateMatrixWorld(true); h = o.userData.tocar(rc);
        if (!h) { var nm = new T.Vector3(origen.x - o.position.x, 0.2, origen.z - o.position.z).normalize(); h = { d: dd, p: new T.Vector3(o.position.x, o.position.y, o.position.z).addScaledVector(nm, ESC * 0.62).setY(origen.y - 0.4), n: nm }; }
        if (h.d < bd) { bd = h.d; best = { o: o, h: h }; } }
      if (!best) return false;
      var nw = best.h.n.clone(); if (best.h.face) nw.applyQuaternion(best.o.quaternion);
      best.o.userData.golpearMundo(best.h.p, nw); return true;
    }
  };
})(window);
