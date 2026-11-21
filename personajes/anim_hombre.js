/* Animación compartida de los personajes masculinos (soldado rojo y soldado premium, y los que vengan).
   Estilo "lobby de PUBG Mobile": reposo vivo (respira, cambia el peso, mira alrededor, saluda de vez en cuando),
   caminar, correr y saltar. UNA sola animación para todos: cada modelo solo necesita un "adaptador".

   Uso:
     var anim = AnimHombre.nuevo(AnimHombre.adaptar(unit));   // unit = createSoldadoEspacialV2(...) o createSoldadoPremium(...)
     anim.update(dt, 'idle');            // 'idle' | 'walk' | 'run' | 'jump'   (dt en segundos)
     anim.emote('saludo');               // gesto puntual
   Ejes del personaje: mira a +Z, arriba +Y, su lado "L" es el de -X (como el soldado rojo).
   Para añadir otro personaje masculino: escribe un adaptador con aplicar(P) y regístralo en AnimHombre.adaptadores. */
(function (global) {
  'use strict';
  var A = global.AnimHombre = { adaptadores: [] };
  function sm(x) { x = x < 0 ? 0 : x > 1 ? 1 : x; return x * x * (3 - 2 * x); }
  var PI = Math.PI;

  /* ---------- cuaterniones mínimos [x,y,z,w] ---------- */
  function qm(a, b) { return [a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1], a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0], a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3], a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2]]; }
  function qi(a) { return [-a[0], -a[1], -a[2], a[3]]; }
  function qax(x, y, z, ang) { var s = Math.sin(ang / 2); return [x * s, y * s, z * s, Math.cos(ang / 2)]; }
  var ID = [0, 0, 0, 1];

  /* ---------- parámetros de postura (todo en radianes, hipY en metros) ----------
     hipY, hipRoll, hipTwist, lean, spTwist, spRoll, headP, headY,
     aLf (brazo adelante), aLa (brazo separado del cuerpo), aLe (codo), aLw (muñeca/saludo)  → igual con R
     lLf (pierna adelante), lLk (rodilla)                                                    → igual con R */
  var CLAVES = ['hipY', 'hipRoll', 'hipTwist', 'lean', 'spTwist', 'spRoll', 'headP', 'headY',
    'aLf', 'aLa', 'aLe', 'aLw', 'aRf', 'aRa', 'aRe', 'aRw', 'lLf', 'lLk', 'lRf', 'lRk'];

  /* ---------- adaptador: soldado rojo (pivotes, brazos colgando en reposo) ---------- */
  function adaptarV2(u) {
    var p = u.parts, body = p.armL.parent, by0 = body.position.y, k = body.scale.x || 1;
    return {
      aplicar: function (P) {
        body.position.y = by0 + P.hipY * k; body.rotation.set(P.lean, P.hipTwist, P.hipRoll);
        p.head.rotation.set(P.headP - P.lean * 0.6, P.headY - P.hipTwist * 0.5, -P.hipRoll * 0.5);
        p.armL.rotation.set(-P.aLf, 0, -P.aLa); p.forearmL.rotation.set(-P.aLe, 0, P.aLw);
        p.armR.rotation.set(-P.aRf, 0, P.aRa); p.forearmR.rotation.set(-P.aRe, 0, P.aRw);
        p.legL.rotation.set(-P.lLf, 0, 0); p.shinL.rotation.set(P.lLk, 0, 0);
        p.legR.rotation.set(-P.lRf, 0, 0); p.shinR.rotation.set(P.lRk, 0, 0);
      }
    };
  }
  A.adaptadores.push({ ok: function (u) { return !!(u && u.parts && u.parts.armL); }, crear: adaptarV2 });

  /* ---------- adaptador: soldado premium (esqueleto Mixamo, brazos en T en reposo) ----------
     Cada hueso recibe un giro en EJES DEL MUNDO del personaje, así no importa cómo estén orientados sus ejes internos. */
  function adaptarEsqueleto(u) {
    var S = u.esqueleto, H = S.huesos, D = S.def, n = D.length, idx = {}, i, ry = S.giro || 0, restW = [], restPos1 = H[0].position.y;
    for (i = 0; i < n; i++) { idx[D[i].n] = i; restW[i] = D[i].p < 0 ? D[i].q : qm(restW[D[i].p], D[i].q); }
    var fl = ry ? function (x, y, z, a) { return qax(-x, y, -z, a); } : qax;   // el modelo está girado: eje del personaje → eje del hueso
    function R(x, y, z, a) { return fl(x, y, z, a); }
    var dl = new Array(n), Dc = new Array(n), nw = new Array(n);
    function pon(nombre, q) { dl[idx[nombre]] = q; }
    return {
      aplicar: function (P) {
        var j, c, l, sw;
        for (j = 0; j < n; j++) dl[j] = ID;
        pon('Hips', qm(R(0, 1, 0, P.hipTwist), R(0, 0, 1, P.hipRoll)));
        var lean = P.lean, tw = P.spTwist, rl = P.spRoll;
        ['Spine', 'Spine1', 'Spine2'].forEach(function (nm, q) { var f = [0.4, 0.3, 0.3][q]; pon(nm, qm(qm(R(1, 0, 0, lean * f), R(0, 1, 0, tw * f)), R(0, 0, 1, rl * f))); });
        var hp = P.headP - lean * 0.6 - 0, hy = P.headY - (P.hipTwist + tw) * 0.5;
        pon('Neck', qm(R(1, 0, 0, hp * 0.4), R(0, 1, 0, hy * 0.4))); pon('Head', qm(R(1, 0, 0, hp * 0.6), R(0, 1, 0, hy * 0.6)));
        // lado L semántico = -X del personaje = hueso "Right" de Mixamo
        function brazo(lado, f, a, e, w, sg) {
          pon(lado + 'Arm', qm(R(1, 0, 0, -f), R(0, 0, 1, sg * (PI / 2 - a))));
          pon(lado + 'ForeArm', qm(R(1, 0, 0, -e), R(0, 0, 1, w)));
        }
        brazo('Right', P.aLf, P.aLa, P.aLe, P.aLw, +1); brazo('Left', P.aRf, P.aRa, P.aRe, P.aRw, -1);
        function pierna(lado, f, k) { pon(lado + 'UpLeg', R(1, 0, 0, -f)); pon(lado + 'Leg', R(1, 0, 0, k)); pon(lado + 'Foot', R(1, 0, 0, (f - k) * 0.85)); }
        pierna('Right', P.lLf, P.lLk); pierna('Left', P.lRf, P.lRk);
        for (j = 0; j < n; j++) {   // ya vienen padres antes que hijos
          var pj = D[j].p, pw = pj < 0 ? ID : nw[pj], pd = pj < 0 ? ID : Dc[pj];
          Dc[j] = qm(dl[j], pd); nw[j] = qm(Dc[j], restW[j]);
          l = pj < 0 ? nw[j] : qm(qi(pw), nw[j]);
          H[j].quaternion.set(l[0], l[1], l[2], l[3]);
        }
        H[0].position.y = restPos1 + P.hipY;
      }
    };
  }
  A.adaptadores.push({ ok: function (u) { return !!(u && u.esqueleto); }, crear: adaptarEsqueleto });
  A.adaptar = function (u) {
    for (var i = A.adaptadores.length - 1; i >= 0; i--) if (A.adaptadores[i].ok(u)) return A.adaptadores[i].crear(u);
    throw new Error('AnimHombre: modelo sin adaptador');
  };

  /* ---------- posturas ---------- */
  function pIdle(t, o) {
    var br = Math.sin(t * 1.7), sh = Math.sin(t * 0.45), look = Math.sin(t * 0.33) * Math.max(0, Math.sin(t * 0.21 + 1) + 0.3);
    o.hipY = -0.012 + 0.004 * br - 0.006 * Math.abs(sh); o.hipRoll = 0.035 * sh; o.hipTwist = 0.06 * Math.sin(t * 0.37);
    o.lean = 0.02 + 0.014 * br; o.spTwist = -0.04 * Math.sin(t * 0.37); o.spRoll = -0.02 * sh;
    o.headP = 0.04 + 0.035 * Math.sin(t * 0.71); o.headY = 0.5 * look + 0.08 * Math.sin(t * 1.1);
    o.aLf = 0.07 + 0.025 * Math.sin(t * 0.9); o.aLa = 0.15 + 0.012 * br; o.aLe = 0.3 + 0.05 * br; o.aLw = 0;
    o.aRf = 0.05 + 0.025 * Math.sin(t * 0.9 + 1.3); o.aRa = 0.15 + 0.012 * br; o.aRe = 0.34 + 0.05 * br; o.aRw = 0;
    o.lLf = 0.03 + 0.02 * sh; o.lLk = 0.03 + 0.05 * Math.max(0, -sh); o.lRf = -0.03 - 0.02 * sh; o.lRk = 0.03 + 0.05 * Math.max(0, sh);
  }
  function pCaminar(ph, o, run) {
    var s = Math.sin(ph), c = Math.cos(ph), A_ = run ? 0.85 : 0.5, K = run ? 1.35 : 0.8, AB = run ? 0.75 : 0.42;
    o.hipY = (run ? -0.05 : -0.025) + (run ? 0.035 : 0.018) * Math.cos(2 * ph); o.hipRoll = 0.035 * c; o.hipTwist = (run ? 0.2 : 0.12) * s;
    o.lean = run ? 0.24 : 0.05; o.spTwist = (run ? -0.22 : -0.14) * s; o.spRoll = -0.03 * c;
    o.headP = 0; o.headY = 0;
    o.lLf = A_ * s + 0.04; o.lLk = K * Math.max(0, c) + (run ? 0.15 : 0.04); o.lRf = -A_ * s + 0.04; o.lRk = K * Math.max(0, -c) + (run ? 0.15 : 0.04);
    o.aLf = -AB * s + 0.05; o.aRf = AB * s + 0.05; o.aLa = o.aRa = run ? 0.12 : 0.14;
    o.aLe = (run ? 1.35 : 0.4) + (run ? 0.25 : 0.12) * Math.max(0, s); o.aRe = (run ? 1.35 : 0.4) + (run ? 0.25 : 0.12) * Math.max(0, -s); o.aLw = o.aRw = 0;
  }
  function pSalto(o) {
    o.hipY = 0.02; o.hipRoll = 0; o.hipTwist = 0; o.lean = 0.1; o.spTwist = 0; o.spRoll = 0; o.headP = -0.1; o.headY = 0;
    o.aLf = 0.9; o.aLa = 0.55; o.aLe = 0.5; o.aLw = 0; o.aRf = 0.9; o.aRa = 0.55; o.aRe = 0.5; o.aRw = 0;
    o.lLf = 0.8; o.lLk = 1.2; o.lRf = 0.15; o.lRk = 0.5;
  }
  var EMOTES = { saludo: { dur: 3, lado: 'R' } };

  A.nuevo = function (rig) {
    var P = {}, T = {}, t = 0, ph = 0, k, em = null, emT = 0, sigEm = 6 + Math.random() * 5;
    for (k = 0; k < CLAVES.length; k++) P[CLAVES[k]] = 0;
    pIdle(0, P); rig.aplicar(P);
    return {
      estado: 'idle', P: P,
      emote: function (n) { if (EMOTES[n]) { em = EMOTES[n]; emT = 0; } },
      update: function (dt, estado, vel) {
        dt = Math.min(dt, 0.1); t += dt; estado = estado || 'idle'; this.estado = estado;
        if (estado === 'walk') ph += dt * 7 * (vel || 1); else if (estado === 'run') ph += dt * 11 * (vel || 1);
        if (estado === 'run') pCaminar(ph, T, true); else if (estado === 'walk') pCaminar(ph, T, false); else if (estado === 'jump') pSalto(T); else pIdle(t, T);
        if (estado === 'idle' && !em) { sigEm -= dt; if (sigEm <= 0) { sigEm = 9 + Math.random() * 8; this.emote('saludo'); } }
        if (em) {
          emT += dt; var env = sm(emT / 0.5) * (1 - sm((emT - (em.dur - 0.5)) / 0.5)), pr = em.lado;
          if (estado !== 'idle') env = 0;
          T['a' + pr + 'f'] += (0.3 - T['a' + pr + 'f']) * env; T['a' + pr + 'a'] += (2.35 - T['a' + pr + 'a']) * env;
          T['a' + pr + 'e'] += (0.7 + 0.15 * Math.sin(t * 9) - T['a' + pr + 'e']) * env; T['a' + pr + 'w'] = 0.45 * Math.sin(t * 11) * env;
          T.headY += 0.25 * env * (pr === 'R' ? 1 : -1); T.headP += 0.05 * env;
          if (emT >= em.dur) em = null;
        }
        var a = 1 - Math.exp(-dt * (estado === 'idle' ? 6 : 12));
        for (k = 0; k < CLAVES.length; k++) { var c = CLAVES[k]; P[c] += (T[c] - P[c]) * a; }
        rig.aplicar(P);
      }
    };
  };
})(window);
