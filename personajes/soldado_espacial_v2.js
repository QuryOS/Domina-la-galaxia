/**
 * Soldado espacial 2.0 para Three.js, sin archivos externos (unidad de combate para colocar en el planeta).
 * Evolución del soldado rojo inspirado en Nova Legacy, ahora con un diseño mucho más futurista:
 *
 *  - Hombros en cuchilla: ya no son redondos, son alas puntiagudas que se prolongan hacia atrás y hacia
 *    arriba, con una capa oscura debajo y una tobera de propulsor que apunta hacia abajo.
 *  - Mochila pequeña y alta: es el compartimento del oxígeno, con dos tanques, válvulas, indicador de nivel,
 *    mangueras que suben hacia el cuello.
 *  - Casco tipo moto de una sola pieza: la cúpula se estira hacia atrás y se afila de forma continua hasta
 *    formar la cola (sin piezas añadidas); frente abierta con máscara triangular, mangueras a la nuca y gafas de varillas.
 *  - Antebrazos: guantelete angular protector (sin cuchillas) y manos articuladas.
 *  - Más cuchillas y ángulos: quilla corta y redondeada en el esternón.
 *    Rodilleras bajas y suaves (casquete ovoide, charnelas) y botas esculpidas (empeine, puntera blindada, suela con arco).
 *
 * Es un modelo ESTÁTICO: no tiene ninguna animación (update() existe solo por compatibilidad y no hace nada).
 * Sin texturas: todo son colores planos (rojo liso para la armadura) y el detalle está en la geometría.
 *
 * Uso:
 *   const unit = createSoldadoEspacialV2(THREE, { armor: 0xc4151c, glow: 0x62d6ff });
 *   unit.group.position.set(x, groundY, z);        // los pies están en y = 0
 *   scene.add(unit.group);
 *   unit.update(clock.getElapsedTime());           // opcional: no hace nada
 *
 * Escala: 1 unidad = 4 m (igual que el resto de máquinas), así que mide 0.49 unidades (1.95 m).
 *   Cambia la equivalencia con opts.metersPerUnit (1 = unidades en metros) y la altura con opts.height (m).
 *   Huella: unit.footprint (centrada en el origen). Frente del soldado: lado +Z. Los propulsores miran hacia abajo (-Y).
 *
 * unit.setAccent(hex): color de la armadura (rojo, negro, morado... como las variantes de la referencia).
 * unit.setGlow(hex): color de la energía (visor, núcleo, franjas, propulsores).
 * unit.setGhost(true, valid): modo "fantasma" para colocar (verde si valid, rojo si valid === false);
 *   unit.setGhost(false) vuelve a lo normal.
 * unit.dispose(): libera geometrías y materiales.
 * unit.thrusters: [Object3D, Object3D] con la salida de cada propulsor de hombro (izq., der.), mirando a -Y
 *   (hacia abajo):
 *   úsalos para humo, llamas o partículas.
 * unit.parts: pivotes por si quieres cambiar la postura desde tu juego { head, armL, armR, forearmL,
 *   forearmR, legL, legR, shinL, shinR, wingL, wingR, pack }.
 * Nota: el modelo tiene unas 300 mallas; si pones muchos soldados a la vez, considera fusionar geometrías.
 * Compatible con Three.js r128 o superior.
 */
function createSoldadoEspacialV2(THREE, opts) {
  opts = opts || {};
  var P = Math.PI, TAU = P * 2;
  var MPU = opts.metersPerUnit != null ? opts.metersPerUnit : 4;
  var HEIGHT_M = opts.height != null ? opts.height : 1.95;

  var colors = {
    armor: opts.armor != null ? opts.armor : 0xc4151c,
    suit: opts.suit != null ? opts.suit : 0x15171c,
    hard: opts.hard != null ? opts.hard : 0x2a2d34,
    glow: opts.glow != null ? opts.glow : 0x62d6ff
  };

  var group = new THREE.Group();      // lo que añade el juego a la escena
  var body = new THREE.Group();       // cuerpo en metros, escalado a unidades
  group.add(body);

  /* ---------- Materiales (colores planos) ---------- */
  function mat(color, rough, metal) {
    return new THREE.MeshStandardMaterial({ color: color, roughness: rough != null ? rough : 0.85, metalness: metal != null ? metal : 0.0 });
  }
  var mats = {
    suit: mat(colors.suit, 0.7, 0.2),
    armor: mat(colors.armor, 0.38, 0.25),
    hard: mat(colors.hard, 0.45, 0.6),
    metal: mat(0x8a8f99, 0.3, 0.8),
    rubber: mat(0x1b1c20, 0.9, 0.1),
    visor: mat(0x05070a, 0.08, 0.9),
    glow: mat(colors.glow, 0.4, 0.0)
  };
  mats.visor.emissive.setHex(0x061a26);
  mats.visor.emissiveIntensity = 0.6;
  mats.glow.emissive.setHex(colors.glow);
  mats.glow.emissiveIntensity = 1.8;
  var origEm = {};
  for (var mk in mats) origEm[mk] = { c: mats[mk].emissive.getHex(), i: mats[mk].emissiveIntensity };
  var ghost = false;
  function setAccent(hex) { colors.armor = hex; mats.armor.color.setHex(hex); }
  function setGlow(hex) {
    colors.glow = hex;
    mats.glow.color.setHex(hex);
    origEm.glow.c = hex;
    if (!ghost) mats.glow.emissive.setHex(hex);
  }

  /* ---------- Geometría ---------- */
  function add(parent, m, x, y, z) {
    m.position.set(x || 0, y || 0, z || 0);
    m.castShadow = true;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  }
  function part(parent, geo, m, x, y, z) { return add(parent, new THREE.Mesh(geo, m), x, y, z); }
  function box(w, h, d, m) { return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); }
  function cyl(rt, rb, h, m, seg) { return new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg || 12), m); }
  function cone(r, h, m, seg) { return new THREE.Mesh(new THREE.ConeGeometry(r, h, seg || 8), m); }
  function sphere(r, m, sx, sy, sz) {
    var s = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), m);
    s.scale.set(sx || 1, sy || 1, sz || 1);
    return s;
  }
  function torus(r, t, m, sx, sy) {
    var o = new THREE.Mesh(new THREE.TorusGeometry(r, t, 8, 28), m);
    o.scale.set(sx || 1, sy || 1, 1);
    return o;
  }
  function rb(parent, w, h, d, r, m, x, y, z) { return part(parent, roundedBox(w, h, d, r, 2), m, x, y, z); }
  function rod(parent, a, b, r, m) {          // varilla fina entre dos puntos
    var dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2], len = Math.sqrt(dx * dx + dy * dy + dz * dz);
    var m2 = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 6), m);
    m2.position.set((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2);
    m2.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(dx / len, dy / len, dz / len));
    m2.castShadow = true;
    parent.add(m2);
    return m2;
  }
  function roundedBox(w, h, d, r, seg) {
    var g = new THREE.BoxGeometry(w, h, d, seg, seg, seg);
    var pos = g.attributes.position, nor = g.attributes.normal;
    var hx = w / 2 - r, hy = h / 2 - r, hz = d / 2 - r;
    var v = new THREE.Vector3(), inner = new THREE.Vector3(), n = new THREE.Vector3();
    for (var i = 0; i < pos.count; i++) {
      v.set(pos.getX(i), pos.getY(i), pos.getZ(i));
      inner.set(Math.max(-hx, Math.min(hx, v.x)), Math.max(-hy, Math.min(hy, v.y)), Math.max(-hz, Math.min(hz, v.z)));
      n.set(v.x - inner.x, v.y - inner.y, v.z - inner.z);
      if (n.lengthSq() > 1e-12) {
        n.normalize();
        v.set(inner.x + n.x * r, inner.y + n.y * r, inner.z + n.z * r);
        nor.setXYZ(i, n.x, n.y, n.z);
      }
      pos.setXYZ(i, v.x, v.y, v.z);
    }
    return g;
  }
  function capsule(r, len, seg) {              // cápsula con eje Y
    var pts = [], n = 6, i, a;
    for (i = 0; i <= n; i++) { a = -P / 2 + (P / 2) * i / n; pts.push(new THREE.Vector2(Math.max(0, r * Math.cos(a)), -len / 2 + r * Math.sin(a))); }
    for (i = 0; i <= n; i++) { a = (P / 2) * i / n; pts.push(new THREE.Vector2(Math.max(0, r * Math.cos(a)), len / 2 + r * Math.sin(a))); }
    return new THREE.LatheGeometry(pts, seg || 8);
  }
  function caps(r, len, m) { return new THREE.Mesh(capsule(r, len, 8), m); }
  function rg(y, rx, rz, cz, cx, n) { return { y: y, rx: rx, rz: rz, cz: cz || 0, cx: cx || 0, n: n || 2.2 }; }
  function hr(y, rx, f, b) { return rg(y, rx, (f - b) / 2, (f + b) / 2, 0, 2.3); }

  /* Tubo orgánico: anillos elípticos (superelipses) a lo largo de Y, unidos en una superficie lisa.
     ring = { y, rx, rz, cx, cz, n }. Normales analíticas y tapas opcionales. */
  function tube(rings, seg, withCaps) {
    var ns = rings.length, W = seg + 1, pos = [], nor = [], idx = [];
    var i, k, R, a, c, s, ex, px, pz;
    var asc = rings[ns - 1].y > rings[0].y, sg = asc ? 1 : -1;
    for (i = 0; i < ns; i++) {
      R = rings[i]; ex = 2 / R.n;
      for (k = 0; k < W; k++) {
        a = (k % seg) / seg * TAU; c = Math.cos(a); s = Math.sin(a);
        px = R.cx + R.rx * (c < 0 ? -1 : 1) * Math.pow(Math.abs(c), ex);
        pz = R.cz + R.rz * (s < 0 ? -1 : 1) * Math.pow(Math.abs(s), ex);
        pos.push(px, R.y, pz);
        nor.push(0, 0, 0);
      }
    }
    var kk, kp, kn, ip, inx, ax, ay, az, bx, by, bz, nx, ny, nz, l, o;
    for (i = 0; i < ns; i++) for (k = 0; k < W; k++) {
      kk = k % seg; kp = (kk + seg - 1) % seg; kn = (kk + 1) % seg; ip = Math.max(0, i - 1); inx = Math.min(ns - 1, i + 1);
      ax = pos[(i * W + kn) * 3] - pos[(i * W + kp) * 3];
      ay = pos[(i * W + kn) * 3 + 1] - pos[(i * W + kp) * 3 + 1];
      az = pos[(i * W + kn) * 3 + 2] - pos[(i * W + kp) * 3 + 2];
      bx = pos[(inx * W + kk) * 3] - pos[(ip * W + kk) * 3];
      by = pos[(inx * W + kk) * 3 + 1] - pos[(ip * W + kk) * 3 + 1];
      bz = pos[(inx * W + kk) * 3 + 2] - pos[(ip * W + kk) * 3 + 2];
      nx = (by * az - bz * ay) * sg; ny = (bz * ax - bx * az) * sg; nz = (bx * ay - by * ax) * sg;
      l = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
      o = (i * W + k) * 3;
      nor[o] = nx / l; nor[o + 1] = ny / l; nor[o + 2] = nz / l;
    }
    var A, B, C2, D;
    for (i = 0; i < ns - 1; i++) for (k = 0; k < seg; k++) {
      A = i * W + k; B = i * W + k + 1; C2 = (i + 1) * W + k; D = (i + 1) * W + k + 1;
      if (asc) idx.push(A, C2, B, B, C2, D); else idx.push(A, B, C2, B, D, C2);
    }
    if (withCaps !== false) {
      [0, ns - 1].forEach(function (e) {
        var up = asc ? e === ns - 1 : e === 0, base = pos.length / 3, Re = rings[e], q, q2;
        pos.push(Re.cx, Re.y, Re.cz); nor.push(0, up ? 1 : -1, 0);
        for (q = 0; q < seg; q++) {
          pos.push(pos[(e * W + q) * 3], pos[(e * W + q) * 3 + 1], pos[(e * W + q) * 3 + 2]);
          nor.push(0, up ? 1 : -1, 0);
        }
        for (q = 0; q < seg; q++) {
          q2 = (q + 1) % seg;
          if (up) idx.push(base, base + 1 + q2, base + 1 + q); else idx.push(base, base + 1 + q, base + 1 + q2);
        }
      });
    }
    var g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    g.setIndex(idx);
    return g;
  }
  // atajos: traje negro (cerrado) y placas (abiertas, para ver el traje entre ellas)
  function suitTube(parent, rings, seg, x, y, z) { return part(parent, tube(rings, seg || 16), mats.suit, x, y, z); }
  function plate(parent, rings, m, seg, x, y, z) { return part(parent, tube(rings, seg || 20, false), m, x, y, z); }
  function rivets(parent, list, r) { list.forEach(function (p) { add(parent, sphere(r || 0.006, mats.metal), p[0], p[1], p[2]); }); }
  /* Cuchilla: pieza que se afina hasta una punta. secs = [[y, rx, rz, cz, cx, n], ...] a lo largo de +Y.
     Con rotation.x = -PI/2 apunta a -Z (atrás); con PI apunta a -Y (abajo); con PI/2 apunta a +Z (adelante).
     rz es el "alto" y cz curva la pieza (tras girar a -Z, cz positivo la curva hacia arriba). */
  function blade(parent, secs, m, x, y, z, rx, ry, rz) {
    var rings = secs.map(function (s) { return rg(s[0], s[1], s[2], s[3], s[4], s[5] || 2.6); });
    var mesh = part(parent, tube(rings, 14), m, x, y, z);
    mesh.rotation.set(rx || 0, ry || 0, rz || 0);
    return mesh;
  }

  /* Loft a lo largo de Z: cada sección es [z, semiancho, yArriba, yAbajo, n] y se unen en una sola superficie
     lisa (sirve para formas aerodinámicas que se afilan sin piezas añadidas). */
  function loftZ(secs, seg) {
    var rings = secs.map(function (s) {
      return rg(s[0], s[1], (s[2] - s[3]) / 2, -(s[2] + s[3]) / 2, 0, s[4] || 2.4);
    });
    var g = tube(rings, seg || 24);
    g.rotateX(P / 2);                // el eje del tubo (Y) pasa a ser Z
    return g;
  }

  /* ---------- Medidas (metros, origen en los pies) ---------- */
  var HIP_Y = 0.92, THIGH_LEN = 0.42, SHOULDER_Y = 1.46, ARM_LEN = 0.29, FOREARM_LEN = 0.26;

  /* ---------- Mano: palma anatómica, dedos articulados en falanges y pulgar oponible ----------
     Convención: la palma mira hacia el cuerpo (-side en X), el dorso hacia fuera, el pulgar hacia delante (+Z). */
  function buildHand(hand, side) {
    var sd = side;
    // manguito del guante: transición suave entre el antebrazo y la mano
    plate(hand, [rg(0.014, 0.038, 0.037, 0, 0, 2.4), rg(0.0, 0.035, 0.034, 0, 0, 2.4), rg(-0.014, 0.03, 0.031, 0, 0, 2.4)], mats.hard, 20);
    // palma y dorso: una sola superficie que se ensancha hacia los nudillos y se redondea en la punta
    part(hand, tube([rg(0.006, 0.026, 0.029, 0, 0, 2.2), rg(-0.012, 0.021, 0.031, 0, 0, 2.3), rg(-0.036, 0.0185, 0.037, 0, 0, 2.6),
      rg(-0.06, 0.018, 0.039, 0, 0, 2.8), rg(-0.081, 0.0165, 0.039, 0, 0, 2.6), rg(-0.092, 0.0125, 0.034, 0, 0, 2.2), rg(-0.096, 0.007, 0.024, 0, 0, 2.0)], 20), mats.rubber, 0, 0, 0);
    // eminencia del pulgar (base muscular del pulgar)
    add(hand, sphere(0.019, mats.rubber, 0.8, 1.5, 1.0), -sd * 0.008, -0.04, 0.03);
    // placa del dorso: lente curva que sigue la mano, con franja de energía
    part(hand, tube([rg(-0.014, 0.004, 0.02, 0, sd * 0.0185, 2.0), rg(-0.032, 0.0055, 0.031, 0, sd * 0.0188, 2.0), rg(-0.055, 0.0058, 0.037, 0, sd * 0.019, 2.0),
      rg(-0.077, 0.0052, 0.034, 0, sd * 0.0185, 2.0), rg(-0.087, 0.0035, 0.022, 0, sd * 0.018, 2.0)], 16), mats.armor, 0, 0, 0);
    add(hand, box(0.003, 0.05, 0.005, mats.glow), sd * 0.0246, -0.052, 0);
    // barra de los nudillos: redondeada, sin puntas
    add(hand, caps(0.0072, 0.05, mats.hard), sd * 0.0155, -0.091, 0).rotation.x = P / 2;

    // dedos: [z, largo falange 1, 2, 3, radio, curvatura base]
    var fingers = [[0.027, 0.032, 0.022, 0.019, 0.0088, 0.2], [0.009, 0.036, 0.025, 0.02, 0.0092, 0.3], [-0.009, 0.034, 0.023, 0.019, 0.0088, 0.38], [-0.026, 0.027, 0.018, 0.017, 0.0078, 0.46]];
    fingers.forEach(function (f) {
      var r = f[4], g0 = new THREE.Group();
      g0.position.set(sd * 0.0015, -0.09, f[0]);
      g0.rotation.set(0, 0, -sd * f[5]);
      hand.add(g0);
      var parent = g0, rr = r;
      for (var k = 0; k < 3; k++) {
        var L = f[1 + k], last = k === 2, r2 = rr * (last ? 0.84 : 0.92);
        var rings = last
          ? [rg(0, rr, rr * 0.98), rg(-L * 0.45, rr * 0.96, rr * 0.94), rg(-L * 0.8, rr * 0.82, rr * 0.8), rg(-L * 0.95, rr * 0.55, rr * 0.55), rg(-L, rr * 0.18, rr * 0.18)]
          : [rg(0, rr, rr * 0.98), rg(-L * 0.5, rr * 0.93, rr * 0.92), rg(-L, r2, r2 * 0.98)];
        part(parent, tube(rings, 10), mats.rubber, 0, 0, 0);
        if (k < 2) {
          // refuerzo en el dorso de la falange
          part(parent, tube([rg(-L * 0.12, rr * 0.5, rr * 0.8, 0, sd * rr * 0.7, 2.0), rg(-L * 0.45, rr * 0.5, rr * 0.86, 0, sd * rr * 0.72, 2.0), rg(-L * 0.8, rr * 0.4, rr * 0.7, 0, sd * rr * 0.68, 2.0)], 8), mats.hard, 0, 0, 0);
          var nx = new THREE.Group();
          nx.position.set(0, -L, 0);
          nx.rotation.z = -sd * (0.5 - k * 0.1);
          parent.add(nx);
          add(nx, sphere(r2 * 1.02, mats.rubber), 0, 0, 0);                  // articulación
          parent = nx; rr = r2;
        }
      }
    });

    // pulgar: dos falanges, hacia delante y algo cerrado sobre la palma
    var t0 = new THREE.Group();
    t0.position.set(-sd * 0.006, -0.042, 0.034);
    t0.rotation.set(-0.62, 0, -sd * 0.22);
    hand.add(t0);
    var tp = t0, tr = 0.0108;
    [0.03, 0.026].forEach(function (L, k) {
      var r2 = tr * (k ? 0.82 : 0.9);
      var rings = k
        ? [rg(0, tr, tr), rg(-L * 0.45, tr * 0.95, tr * 0.95), rg(-L * 0.8, tr * 0.8, tr * 0.8), rg(-L * 0.95, tr * 0.5, tr * 0.5), rg(-L, tr * 0.16, tr * 0.16)]
        : [rg(0, tr, tr), rg(-L * 0.5, tr * 0.95, tr * 0.95), rg(-L, r2, r2)];
      part(tp, tube(rings, 10), mats.rubber, 0, 0, 0);
      if (!k) {
        var tn = new THREE.Group();
        tn.position.set(0, -L, 0);
        tn.rotation.set(-0.2, 0, -sd * 0.38);
        tp.add(tn);
        add(tn, sphere(r2 * 1.02, mats.rubber), 0, 0, 0);
        tp = tn; tr = r2;
      }
    });
  }

  /* ---------- Piernas ---------- */
  function buildLeg(side) {
    var hip = new THREE.Group();
    hip.position.set(side * 0.105, HIP_Y, 0);
    hip.rotation.z = side * 0.04;                                                      // postura: piernas algo abiertas
    suitTube(hip, [rg(0, 0.078, 0.086), rg(-0.06, 0.08, 0.088, 0.002), rg(-0.18, 0.074, 0.08), rg(-0.3, 0.062, 0.068), rg(-0.38, 0.054, 0.06), rg(-0.42, 0.052, 0.056)]);
    // armadura del muslo: abraza el traje (separación mínima) y sus bordes se afinan hasta tocar la tela
    plate(hip, [rg(-0.025, 0.0803, 0.0883, 0.0008, 0, 2.5), rg(-0.05, 0.0872, 0.0952, 0.0017, 0, 2.5), rg(-0.1, 0.0855, 0.0928, 0.0013, 0, 2.5), rg(-0.15, 0.0830, 0.0895, 0.0005, 0, 2.5), rg(-0.178, 0.0816, 0.0876, 0.0000, 0, 2.5)], mats.armor, 24);      // muslera alta
    plate(hip, [rg(-0.172, 0.0809, 0.0870, 0.0001, 0, 2.5), rg(-0.19, 0.0795, 0.0855, 0.0000, 0, 2.5), rg(-0.205, 0.0780, 0.0840, 0.0000, 0, 2.5)], mats.hard, 24);       // banda oscura
    plate(hip, [rg(-0.198, 0.0797, 0.0857, 0.0000, 0, 2.5), rg(-0.24, 0.0755, 0.0815, 0.0000, 0, 2.5), rg(-0.29, 0.0705, 0.0765, 0.0000, 0, 2.5), rg(-0.325, 0.0670, 0.0730, 0.0000, 0, 2.5)], mats.armor, 24);      // muslera baja
    plate(hip, [rg(-0.32, 0.0665, 0.0725, 0.0000, 0, 2.5), rg(-0.338, 0.0637, 0.0697, 0.0000, 0, 2.5), rg(-0.355, 0.0595, 0.0655, 0.0000, 0, 2.5)], mats.hard, 24);       // borde inferior
    add(hip, box(0.006, 0.18, 0.012, mats.glow), side * 0.0835, -0.11, 0.03);            // franja de energía
    add(hip, box(0.05, 0.006, 0.006, mats.glow), -0.026, -0.08, 0.092).rotation.z = 0.5;     // chevron de energía
    add(hip, box(0.05, 0.006, 0.006, mats.glow), 0.026, -0.08, 0.092).rotation.z = -0.5;
    rivets(hip, [[-0.05, -0.05, 0.0875], [0.05, -0.05, 0.0875], [-0.045, -0.14, 0.0835], [0.045, -0.14, 0.0835]]);
    if (side > 0) {                                                                    // bolsillo táctico (muslo derecho)
      rb(hip, 0.045, 0.15, 0.09, 0.012, mats.hard, 0.1005, -0.17, 0);
      add(hip, box(0.006, 0.05, 0.03, mats.glow), 0.1255, -0.15, 0);
    } else {                                                                           // canister de energía (muslo izquierdo)
      add(hip, cyl(0.026, 0.026, 0.13, mats.hard, 14), -0.1015, -0.17, 0);
      add(hip, cyl(0.02, 0.02, 0.012, mats.glow, 14), -0.1015, -0.24, 0);
    }
    add(hip, sphere(0.056, mats.suit), 0, -THIGH_LEN, 0);                              // rodilla

    var knee = new THREE.Group();
    knee.position.set(0, -THIGH_LEN, 0);
    hip.add(knee);
    suitTube(knee, [rg(0, 0.054, 0.056), rg(-0.05, 0.052, 0.056), rg(-0.13, 0.056, 0.064, -0.008), rg(-0.22, 0.048, 0.054, -0.004), rg(-0.3, 0.044, 0.048), rg(-0.38, 0.046, 0.05), rg(-0.43, 0.05, 0.054)]);
    // rodillera esculpida: casquete ovoide adelantado (no una esfera), con charnelas laterales y cresta central
    plate(knee, [rg(0.07, 0.058, 0.05, 0.026, 0, 2.6), rg(0.04, 0.066, 0.058, 0.03, 0, 2.6), rg(0, 0.069, 0.06, 0.031, 0, 2.6),
      rg(-0.04, 0.066, 0.058, 0.03, 0, 2.6), rg(-0.075, 0.058, 0.05, 0.026, 0, 2.6)], mats.armor, 24);                              // rodillera baja y suave
    plate(knee, [rg(-0.077, 0.059, 0.051, 0.027, 0, 2.6), rg(-0.095, 0.054, 0.047, 0.024, 0, 2.6)], mats.hard, 24);                    // reborde inferior oscuro
    [-1, 1].forEach(function (s) {
      add(knee, cyl(0.018, 0.018, 0.016, mats.hard, 14), s * 0.072, 0, 0.03).rotation.z = P / 2;                                      // charnelas
      add(knee, cyl(0.01, 0.01, 0.006, mats.glow, 12), s * 0.0805, 0, 0.03).rotation.z = P / 2;
    });
    plate(knee, [rg(-0.09, 0.0555, 0.0615, -0.0040, 0, 2.5), rg(-0.13, 0.0635, 0.0715, -0.0080, 0, 2.5), rg(-0.17, 0.0599, 0.0671, -0.0062, 0, 2.5), rg(-0.22, 0.0555, 0.0615, -0.0040, 0, 2.5), rg(-0.265, 0.0532, 0.0581, -0.0017, 0, 2.5), rg(-0.29, 0.0520, 0.0563, -0.0005, 0, 2.5)], mats.armor, 24);   // espinillera
    plate(knee, [rg(-0.285, 0.0512, 0.0556, -0.0008, 0, 2.5), rg(-0.3, 0.0505, 0.0545, 0.0000, 0, 2.5), rg(-0.318, 0.0474, 0.0515, 0.0000, 0, 2.5)], mats.hard, 24);    // banda inferior
    add(knee, box(0.006, 0.12, 0.01, mats.glow), side * 0.0565, -0.2, 0.02);             // franja de energía
    [-0.0805, -0.0755, -0.0708].forEach(function (zz, v) { add(knee, box(0.04, 0.008, 0.01, mats.rubber), 0, -0.12 - v * 0.03, zz); });   // rejillas de la pantorrilla
    plate(knee, [rg(-0.33, 0.0478, 0.0518, 0.0000, 0, 2.5), rg(-0.345, 0.0536, 0.0576, 0.0000, 0, 2.5), rg(-0.39, 0.0548, 0.0588, 0.0000, 0, 2.5), rg(-0.43, 0.0585, 0.0625, 0.0000, 0, 2.5)], mats.hard, 24);          // caña de la bota (abraza la pierna)

    var foot = new THREE.Group();
    foot.position.set(0, -0.43, 0);
    knee.add(foot);
    // bota esculpida: empeine que baja suave hacia la puntera, talón redondeado, suela con arco y punta levantada
    var upperS = [[-0.098, 0.034, -0.005, -0.074, 2.4], [-0.078, 0.052, 0.003, -0.074, 2.4], [-0.04, 0.058, 0.003, -0.074, 2.4], [0.0, 0.059, 0.0, -0.074, 2.4],
      [0.05, 0.059, -0.006, -0.074, 2.4], [0.09, 0.059, -0.014, -0.074, 2.5], [0.13, 0.058, -0.022, -0.074, 2.5], [0.17, 0.054, -0.032, -0.074, 2.5],
      [0.205, 0.045, -0.041, -0.074, 2.3], [0.225, 0.03, -0.05, -0.074, 2.1], [0.233, 0.012, -0.058, -0.074, 2.0]];
    function prof(z) {                                                    // contorno de la bota en cualquier z (interpolado)
      var q = upperS, i = 0;
      if (z <= q[0][0]) return q[0];
      while (i < q.length - 2 && z > q[i + 1][0]) i++;
      var t = Math.min(1, (z - q[i][0]) / (q[i + 1][0] - q[i][0]));
      return [z, q[i][1] + (q[i + 1][1] - q[i][1]) * t, q[i][2] + (q[i + 1][2] - q[i][2]) * t, q[i][3], q[i][4]];
    }
    function shell(z0, z1, off, bot, edge, steps) {                      // piel que abraza la bota, con bordes que se funden
      var out = [];
      for (var i = 0; i <= steps; i++) {
        var z = z0 + (z1 - z0) * i / steps, pr = prof(z), o = (i === 0 || i === steps) ? edge : off;
        out.push([z, pr[1] + o, pr[2] + o, bot, 2.5]);
      }
      return out;
    }
    part(foot, loftZ(upperS, 20), mats.hard, 0, 0, 0);                                                                                    // cuerpo de la bota
    part(foot, loftZ(shell(-0.098, -0.04, 0.0035, -0.077, 0.0015, 6), 20), mats.armor, 0, 0, 0);                                         // talonera
    var cap = shell(0.11, 0.233, 0.004, -0.077, 0.0012, 8);
    cap.push([0.2385, 0.006, -0.0555, -0.0745, 2.0]);
    part(foot, loftZ(cap, 20), mats.armor, 0, 0, 0);                                                                                      // puntera blindada
    part(foot, loftZ(shell(0.028, 0.054, 0.0032, -0.077, 0.001, 4), 20), mats.suit, 0, 0, 0);                                            // correa del empeine 1
    part(foot, loftZ(shell(0.066, 0.092, 0.0032, -0.077, 0.001, 4), 20), mats.suit, 0, 0, 0);                                            // correa del empeine 2
    part(foot, loftZ([[-0.112, 0.03, -0.072, -0.113, 2.4], [-0.1, 0.056, -0.07, -0.113, 2.4], [-0.06, 0.064, -0.074, -0.113, 2.4], [-0.01, 0.062, -0.078, -0.111, 2.4],
      [0.04, 0.061, -0.078, -0.108, 2.4], [0.1, 0.067, -0.078, -0.11, 2.4], [0.16, 0.064, -0.078, -0.108, 2.4], [0.205, 0.054, -0.078, -0.103, 2.2],
      [0.228, 0.036, -0.079, -0.097, 2.0], [0.235, 0.016, -0.08, -0.092, 2.0]], 20), mats.rubber, 0, 0, 0);                                // suela con arco y punta levantada
    plate(foot, [rg(0.004, 0.0595, 0.063, 0, 0, 2.4), rg(-0.006, 0.0615, 0.065, 0, 0, 2.4), rg(-0.017, 0.0595, 0.063, 0, 0, 2.4)], mats.rubber, 20);   // sello del tobillo
    add(foot, sphere(0.04, mats.armor, 0.3, 1, 0.9), side * 0.06, -0.02, -0.005);                                                         // tobillera exterior
    add(foot, box(0.005, 0.01, 0.17, mats.glow), side * 0.0668, -0.094, 0.05);                                                            // línea de luz en la suela
    add(foot, box(0.006, 0.012, 0.05, mats.glow), side * 0.0605, -0.045, 0.01);                                                           // luz lateral
    return { hip: hip, knee: knee, foot: foot };
  }
  var legL = buildLeg(-1), legR = buildLeg(1);
  body.add(legL.hip);
  body.add(legR.hip);

  /* ---------- Torso: pechera original, abdomen con relieve leve, cinturón y pelvis ajustados ---------- */
  suitTube(body, [rg(0.85, 0.15, 0.092, -0.005, 0, 2.3), rg(0.9, 0.165, 0.1, -0.005, 0, 2.3), rg(1.0, 0.145, 0.09, -0.004, 0, 2.3), rg(1.12, 0.155, 0.096, 0, 0, 2.3),
    rg(1.25, 0.178, 0.108, 0.004, 0, 2.3), rg(1.38, 0.19, 0.112, 0.008, 0, 2.3), rg(1.46, 0.185, 0.102, 0.004, 0, 2.3), rg(1.51, 0.09, 0.075, 0, 0, 2.0)], 24);
  // pelvis y cinturón: abrazan el traje
  plate(body, [rg(0.852, 0.1526, 0.0943, -0.0050, 0, 2.5), rg(0.87, 0.1630, 0.1022, -0.0050, 0, 2.5), rg(0.9, 0.1720, 0.1070, -0.0050, 0, 2.5), rg(0.915, 0.1650, 0.1015, -0.0049, 0, 2.5)], mats.hard, 24);       // pelvis
  plate(body, [rg(0.925, 0.1630, 0.1005, -0.0047, 0, 2.5), rg(0.94, 0.1650, 0.1040, -0.0046, 0, 2.5), rg(0.975, 0.1580, 0.1005, -0.0043, 0, 2.5), rg(0.99, 0.1500, 0.0940, -0.0041, 0, 2.5)], mats.hard, 24);       // cinturón
  // abdomen: seis bloques con relieve leve, separados por una ranura central
  plate(body, [rg(0.9950, 0.0460, 0.0030, 0.0812, -0.062, 2.4), rg(1.0175, 0.0520, 0.0065, 0.0858, -0.062, 2.4), rg(1.0400, 0.0460, 0.0030, 0.0842, -0.062, 2.4)], mats.suit, 16);
  plate(body, [rg(0.9950, 0.0460, 0.0030, 0.0812, 0.062, 2.4), rg(1.0175, 0.0520, 0.0065, 0.0858, 0.062, 2.4), rg(1.0400, 0.0460, 0.0030, 0.0842, 0.062, 2.4)], mats.suit, 16);
  plate(body, [rg(1.0520, 0.0460, 0.0030, 0.0853, -0.062, 2.4), rg(1.0745, 0.0520, 0.0065, 0.0908, -0.062, 2.4), rg(1.0970, 0.0460, 0.0030, 0.0892, -0.062, 2.4)], mats.suit, 16);
  plate(body, [rg(1.0520, 0.0460, 0.0030, 0.0853, 0.062, 2.4), rg(1.0745, 0.0520, 0.0065, 0.0908, 0.062, 2.4), rg(1.0970, 0.0460, 0.0030, 0.0892, 0.062, 2.4)], mats.suit, 16);
  plate(body, [rg(1.1090, 0.0460, 0.0030, 0.0903, -0.062, 2.4), rg(1.1315, 0.0520, 0.0065, 0.0963, -0.062, 2.4), rg(1.1540, 0.0460, 0.0030, 0.0957, -0.062, 2.4)], mats.suit, 16);
  plate(body, [rg(1.1090, 0.0460, 0.0030, 0.0903, 0.062, 2.4), rg(1.1315, 0.0520, 0.0065, 0.0963, 0.062, 2.4), rg(1.1540, 0.0460, 0.0030, 0.0957, 0.062, 2.4)], mats.suit, 16);
  add(body, box(0.008, 0.16, 0.01, mats.glow), 0, 1.075, 0.0943);                                                // línea central de energía
  plate(body, [rg(1.2, 0.185, 0.125, 0.008, 0, 3.0), rg(1.3, 0.21, 0.145, 0.01, 0, 3.2), rg(1.4, 0.222, 0.15, 0.012, 0, 3.2), rg(1.47, 0.205, 0.136, 0.008, 0, 3.0), rg(1.52, 0.14, 0.1, 0.004, 0, 2.6)], mats.armor, 28);   // peto angular
  plate(body, [rg(1.19, 0.187, 0.127, 0.008, 0, 3.0), rg(1.21, 0.189, 0.129, 0.008, 0, 3.0)], mats.hard, 28);                                    // borde inferior del peto
  part(body, tube([rg(1.385, 0.026, 0.016, 0.1659, 0, 2.2), rg(1.370, 0.030, 0.018, 0.1669, 0, 2.2), rg(1.340, 0.030, 0.018, 0.1648, 0, 2.2), rg(1.310, 0.028, 0.017, 0.1617, 0, 2.2), rg(1.285, 0.022, 0.014, 0.1547, 0, 2.2), rg(1.268, 0.015, 0.010, 0.1470, 0, 2.2), rg(1.257, 0.008, 0.006, 0.1405, 0, 2.2), rg(1.252, 0.003, 0.002, 0.1354, 0, 2.2)], 16, true), mats.hard, 0, 0, 0);          // quilla del esternón: corta, de punta redondeada y pegada al peto
  add(body, cyl(0.03, 0.03, 0.012, mats.glow, 20), 0, 1.44, 0.166).rotation.x = P / 2;                        // núcleo de energía
  add(body, torus(0.038, 0.007, mats.hard), 0, 1.44, 0.165);
  add(body, torus(0.05, 0.004, mats.glow), 0, 1.44, 0.164);
  [-1, 1].forEach(function (s) {
    add(body, box(0.09, 0.007, 0.007, mats.glow), s * 0.045, 1.32, 0.1565).rotation.z = s * 0.5;               // chevrons de energía
    add(body, box(0.09, 0.007, 0.007, mats.glow), s * 0.045, 1.28, 0.1565).rotation.z = s * 0.5;
    add(body, box(0.008, 0.07, 0.008, mats.glow), s * 0.16, 1.3, 0.1345);
    [0.1309, 0.1367, 0.1422].forEach(function (zz, k) { add(body, box(0.05, 0.007, 0.012, mats.rubber), s * 0.13, 1.24 + k * 0.02, zz).rotation.z = -s * 0.2; });   // ventilaciones del pecho
    rb(body, 0.025, 0.12, 0.1, 0.01, mats.hard, s * 0.222, 1.25, 0);                                           // placas de costado
    rb(body, 0.06, 0.09, 0.06, 0.018, mats.hard, s * 0.176, 0.96, 0.03);                                       // bolsillos laterales
    add(body, cyl(0.025, 0.025, 0.07, mats.hard, 12), s * 0.12, 0.945, 0.092);                                  // granadas
    add(body, cyl(0.018, 0.018, 0.012, mats.glow, 12), s * 0.12, 0.985, 0.092);
    blade(body, [[0, 0.03, 0.01], [0.09, 0.012, 0.012], [0.14, 0.003, 0.003]], mats.hard, s * 0.07, 1.5, -0.06, -0.3);   // cuchillas del cuello
  });
  rivets(body, [[-0.17, 1.2, 0.086], [0.17, 1.2, 0.086], [-0.19, 1.38, 0.121], [0.19, 1.38, 0.121]], 0.007);
  add(body, cyl(0.036, 0.036, 0.014, mats.glow, 6), 0, 0.958, 0.1016).rotation.x = P / 2;                      // hebilla hexagonal
  add(body, torus(0.04, 0.005, mats.metal), 0, 0.958, 0.1006);
  suitTube(body, [rg(1.5, 0.05, 0.054), rg(1.56, 0.046, 0.05, -0.003), rg(1.6, 0.044, 0.048, -0.004)], 14);   // cuello
  plate(body, [rg(1.47, 0.12, 0.09, 0, 0, 2.6), rg(1.53, 0.095, 0.075, 0, 0, 2.4)], mats.hard, 24);          // gorguera
  plate(body, [rg(1.528, 0.099, 0.079, 0, 0, 2.4), rg(1.538, 0.099, 0.079, 0, 0, 2.4)], mats.glow, 24);

  /* ---------- Mochila pequeña y alta: compartimento del oxígeno ---------- */
  var pack = new THREE.Group();
  pack.position.set(0, 1.38, -0.18);
  body.add(pack);
  rb(pack, 0.2, 0.22, 0.09, 0.03, mats.hard, 0, 0, 0);
  rb(pack, 0.12, 0.16, 0.03, 0.014, mats.armor, 0, 0.01, -0.055);                                             // tapa
  add(pack, box(0.012, 0.1, 0.006, mats.glow), 0, 0.01, -0.073);                                              // indicador de nivel de oxígeno
  add(pack, cyl(0.016, 0.016, 0.008, mats.glow, 14), 0, 0.075, -0.072).rotation.x = P / 2;                    // manómetro
  add(pack, torus(0.019, 0.003, mats.metal), 0, 0.075, -0.072);
  [-1, 1].forEach(function (s) {
    add(pack, cyl(0.026, 0.026, 0.2, mats.armor, 16), s * 0.085, 0.0, -0.06);                                 // tanques de oxígeno
    add(pack, sphere(0.026, mats.hard), s * 0.085, 0.1, -0.06);
    add(pack, sphere(0.026, mats.hard), s * 0.085, -0.1, -0.06);
    add(pack, cyl(0.011, 0.011, 0.03, mats.metal, 8), s * 0.085, 0.13, -0.06);                                // válvulas
    add(pack, cyl(0.028, 0.028, 0.008, mats.glow, 16), s * 0.085, -0.03, -0.06);                              // aro luminoso
    add(pack, box(0.05, 0.008, 0.01, mats.rubber), s * 0.04, -0.06 + 0.0, 0.0 + 0.046).rotation.z = 0;        // rejillas laterales
  });
  // mangueras: curva continua desde la válvula de cada tanque hasta el sello de la nuca del casco (sin cabos sueltos)
  [-1, 1].forEach(function (s) {
    var P0 = [s * 0.085, 1.545, -0.24], P1 = [s * 0.092, 1.585, -0.225], P2 = [s * 0.098, 1.58, -0.165], P3 = [s * 0.056, 1.575, -0.118];
    var N = 12, prev = null;
    for (var i = 0; i <= N; i++) {
      var t = i / N, u = 1 - t, w0 = u * u * u, w1 = 3 * u * u * t, w2 = 3 * u * t * t, w3 = t * t * t;
      var pt = [0, 1, 2].map(function (c) { return w0 * P0[c] + w1 * P1[c] + w2 * P2[c] + w3 * P3[c]; });
      if (prev) rod(body, prev, pt, 0.0075, mats.rubber);
      if (i > 0 && i < N) add(body, sphere(0.0075, mats.rubber), pt[0], pt[1], pt[2]);
      prev = pt;
    }
    add(body, cyl(0.011, 0.011, 0.02, mats.metal, 10), s * 0.085, 1.535, -0.24);                               // conector en la válvula
    add(body, cyl(0.012, 0.012, 0.016, mats.metal, 10), s * 0.05, 1.575, -0.118).rotation.z = P / 2;          // conector en el casco
  });
  rivets(pack, [[-0.07, 0.08, 0.046], [0.07, 0.08, 0.046], [-0.07, -0.08, 0.046], [0.07, -0.08, 0.046]], 0.006);

  /* ---------- Ayudantes de la cabeza: curvas suaves, tubos que siguen una trayectoria y piezas curvas ---------- */
  function crPath(Q, sub) {                          // curva suave (Catmull-Rom) que pasa por los puntos
    var out = [], n = Q.length;
    for (var i = 0; i < n - 1; i++) {
      var p0 = Q[Math.max(0, i - 1)], p1 = Q[i], p2 = Q[i + 1], p3 = Q[Math.min(n - 1, i + 2)];
      for (var k = 0; k < sub; k++) {
        var t = k / sub, t2 = t * t, t3 = t2 * t;
        out.push([0, 1, 2].map(function (c) {
          return 0.5 * (2 * p1[c] + (-p0[c] + p2[c]) * t + (2 * p0[c] - 5 * p1[c] + 4 * p2[c] - p3[c]) * t2 + (-p0[c] + 3 * p1[c] - 3 * p2[c] + p3[c]) * t3);
        }));
      }
    }
    out.push(Q[n - 1].slice());
    return out;
  }
  function swept(pts, r, seg, closed) {              // tubo redondo que recorre una trayectoria (mangueras, varillas, bordes)
    var n = pts.length, pos = [], nor = [], idx = [], T = [], i, j, t, l;
    for (i = 0; i < n; i++) {
      var a = pts[closed ? (i + n - 1) % n : Math.max(0, i - 1)], b = pts[closed ? (i + 1) % n : Math.min(n - 1, i + 1)];
      t = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
      l = Math.sqrt(t[0] * t[0] + t[1] * t[1] + t[2] * t[2]) || 1;
      T.push([t[0] / l, t[1] / l, t[2] / l]);
    }
    var N = Math.abs(T[0][1]) > 0.9 ? [1, 0, 0] : [0, 1, 0];
    for (i = 0; i < n; i++) {
      t = T[i];
      var d = N[0] * t[0] + N[1] * t[1] + N[2] * t[2];
      N = [N[0] - d * t[0], N[1] - d * t[1], N[2] - d * t[2]];
      l = Math.sqrt(N[0] * N[0] + N[1] * N[1] + N[2] * N[2]) || 1;
      N = [N[0] / l, N[1] / l, N[2] / l];
      var B = [t[1] * N[2] - t[2] * N[1], t[2] * N[0] - t[0] * N[2], t[0] * N[1] - t[1] * N[0]];
      for (j = 0; j <= seg; j++) {
        var an = 2 * P * j / seg, c = Math.cos(an), sn = Math.sin(an);
        var nx = c * N[0] + sn * B[0], ny = c * N[1] + sn * B[1], nz = c * N[2] + sn * B[2];
        nor.push(nx, ny, nz);
        pos.push(pts[i][0] + r * nx, pts[i][1] + r * ny, pts[i][2] + r * nz);
      }
    }
    var rows = closed ? n : n - 1;
    for (i = 0; i < rows; i++) {
      var i2 = (i + 1) % n;
      for (j = 0; j < seg; j++) {
        var q0 = i * (seg + 1) + j, q1 = i2 * (seg + 1) + j, q2 = q0 + 1, q3 = q1 + 1;
        idx.push(q0, q3, q1, q0, q2, q3);
      }
    }
    var g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    g.setIndex(idx);
    return g;
  }
  function bentBox(w, h, d, r, R) {                  // caja redondeada curvada alrededor del eje Y (lente que abraza la cara)
    var g = roundedBox(w, h, d, r, 10), pos = g.attributes.position, nor = g.attributes.normal;
    for (var i = 0; i < pos.count; i++) {
      var x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i), ang = x / R, c = Math.cos(ang), sn = Math.sin(ang);
      pos.setXYZ(i, (R + z) * sn, y, (R + z) * c - R);
      var nx = nor.getX(i), ny = nor.getY(i), nz = nor.getZ(i);
      nor.setXYZ(i, nx * c + nz * sn, ny, -nx * sn + nz * c);
    }
    return g;
  }
  // cara: elipsoide (rx, ry, rz) centrado en FC; la máscara y las gafas se apoyan sobre su superficie
  var FA = 0.09, FB = 0.12, FCY = -0.005, FC = 0.11, FCZ = 0.02;
  function maskPoint(t, ph, yb, yt, off) {           // punto de la máscara a altura t (0 barbilla, 1 arriba) y ángulo ph
    var y = yb + (yt - yb) * t, q = (y - FCY) / FB, k = Math.sqrt(Math.max(0.0004, 1 - q * q));
    return [(FA * k + off) * Math.sin(ph), y, FCZ + (FC * k + off) * Math.cos(ph)];
  }
  function maskHalfAngle(t) {                        // ancho angular: triángulo con vértices redondeados
    var base = 1.75 * Math.sqrt(t * t + 0.015) / Math.sqrt(1.015), u = Math.max(0, (t - 0.85) / 0.15);
    return base * Math.sqrt(1 - 0.81 * u * u);                   // borde superior curvo (arco), sin colapsar
  }
  function maskGeo(yb, yt) {
    var NT = 18, NC = 30, pos = [], nor = [], idx = [], i, j;
    for (i = 0; i <= NT; i++) {
      var t = (1 - Math.cos(P * i / NT)) / 2, w = maskHalfAngle(t);
      for (j = 0; j <= NC; j++) {
        var ph = w * (-1 + 2 * j / NC), f = Math.abs(ph) / Math.max(w, 0.0001);
        var off = 0.0055 + 0.0085 * (1 - f * f);
        var pt = maskPoint(t, ph, yb, yt, off), bp = maskPoint(t, ph, yb, yt, 0);
        pos.push(pt[0], pt[1], pt[2]);
        var nx = bp[0] / (FA * FA), ny = (bp[1] - FCY) / (FB * FB), nz = (bp[2] - FCZ) / (FC * FC), l = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
        nor.push(nx / l, ny / l, nz / l);
      }
    }
    for (i = 0; i < NT; i++) for (j = 0; j < NC; j++) {
      var q0 = i * (NC + 1) + j, q1 = q0 + 1, q2 = q0 + (NC + 1), q3 = q2 + 1;
      idx.push(q0, q1, q3, q0, q3, q2);
    }
    var g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    g.setIndex(idx);
    return g;
  }
  function maskRim(yb, yt) {                         // contorno de la máscara (lista de puntos, cerrado)
    var NT = 18, loop = [], i, j;
    var w0 = maskHalfAngle(0);
    for (j = 0; j <= 6; j++) loop.push(maskPoint(0, w0 * (-1 + 2 * j / 6), yb, yt, 0.0075));
    for (i = 1; i <= NT; i++) { var t = (1 - Math.cos(P * i / NT)) / 2; loop.push(maskPoint(t, maskHalfAngle(t), yb, yt, 0.0075)); }
    var w1 = maskHalfAngle(1);
    for (j = 1; j <= 11; j++) loop.push(maskPoint(1, w1 * (1 - 2 * j / 12), yb, yt, 0.0075));
    for (i = NT; i >= 1; i--) { var t2 = (1 - Math.cos(P * i / NT)) / 2; loop.push(maskPoint(t2, -maskHalfAngle(t2), yb, yt, 0.0075)); }
    return loop;
  }

  /* ---------- Cabeza: casquete con cola, cara cubierta por máscara triangular y gafas de varillas ---------- */
  var head = new THREE.Group();
  head.position.set(0, 1.66, 0);
  body.add(head);
  // casquete de una sola pieza: cola larga atrás y frente abierta (borde en ceja) para dejar ver la máscara y las gafas
  part(head, loftZ([
    [-0.31, 0.004, 0.036, 0.033, 2],
    [-0.27, 0.012, 0.05, 0.025, 2],
    [-0.23, 0.03, 0.075, 0.01, 2.1],
    [-0.19, 0.052, 0.105, -0.015, 2.2],
    [-0.15, 0.075, 0.13, -0.045, 2.3],
    [-0.11, 0.095, 0.15, -0.075, 2.4],
    [-0.07, 0.108, 0.158, -0.1, 2.4],
    [-0.02, 0.113, 0.16, -0.118, 2.4],
    [0.03, 0.112, 0.16, -0.12, 2.4],
    [0.05, 0.108, 0.158, -0.07, 2.4],
    [0.07, 0.102, 0.153, -0.02, 2.3],
    [0.09, 0.09, 0.144, 0.035, 2.2],
    [0.105, 0.072, 0.13, 0.07, 2.1],
    [0.118, 0.048, 0.112, 0.09, 2],
    [0.126, 0.02, 0.103, 0.096, 2]], 28), mats.armor);
  part(head, loftZ([[-0.2200, 0.0030, 0.0845, 0.0795, 2.2], [-0.1800, 0.0060, 0.1153, 0.0993, 2.2], [-0.1200, 0.0070, 0.1490, 0.1330, 2.2], [-0.0600, 0.0070, 0.1624, 0.1464, 2.2], [0.0000, 0.0070, 0.1640, 0.1480, 2.2], [0.0500, 0.0065, 0.1620, 0.1460, 2.2], [0.0850, 0.0030, 0.1482, 0.1422, 2.2]], 16), mats.hard, 0, 0, 0);                                                       // cresta dorsal baja, integrada al casquete
  // cabeza (capucha negra) bajo el casquete
  var face = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 20), mats.suit);
  face.scale.set(FA, FB, FC);
  add(head, face, 0, FCY, FCZ);

  // máscara triangular de vértices redondeados: de la boca a las orejas
  var MYB = -0.118, MYT = -0.03;
  part(head, maskGeo(MYB, MYT), mats.hard, 0, 0, 0);
  part(head, swept(maskRim(MYB, MYT), 0.0035, 6, true), mats.armor, 0, 0, 0);                                  // borde de la máscara
  [-0.066, -0.079, -0.092].forEach(function (yy) {                                                              // rejilla respiratoria
    add(head, box(0.05, 0.005, 0.008, mats.rubber), 0, yy, FCZ + FC * Math.sqrt(1 - Math.pow((yy - FCY) / FB, 2)) + 0.0125);
  });

  // gafas: lente rectangular de esquinas redondeadas sobre los ojos, con una varilla a cada lado hasta el disco de la oreja
  var LY = 0.012, LZ = 0.1385, LR = 0.075;
  part(head, bentBox(0.14, 0.058, 0.008, 0.022, LR), mats.hard, 0, LY, LZ - 0.003);                           // marco
  part(head, bentBox(0.132, 0.05, 0.01, 0.018, LR), mats.visor, 0, LY, LZ);                                    // lente
  part(head, bentBox(0.1, 0.004, 0.004, 0.0015, LR), mats.glow, 0, LY - 0.016, LZ + 0.0065);                  // línea de energía
  [-1, 1].forEach(function (s) {
    var arm = crPath([[s * 0.066, LY, 0.099], [s * 0.079, LY, 0.088], [s * 0.0925, LY, 0.0735], [s * 0.105, LY, 0.058], [s * 0.113, LY, 0.036], [s * 0.117, LY, 0.026]], 6);
    part(head, swept(arm, 0.0042, 8, false), mats.hard, 0, 0, 0);                                               // varilla oreja-lente

    // mangueras: salen de un puerto en la esquina de la máscara y van hacia atrás, por debajo del disco de la oreja, hasta la nuca
    var corner = maskPoint(0.85, s * maskHalfAngle(0.85), MYB, MYT, 0.008);
    var port = add(head, cyl(0.013, 0.013, 0.022, mats.metal, 12), corner[0], corner[1], corner[2]);
    port.rotation.x = P / 2; port.rotation.z = -s * 0.2;
    var hose = crPath([[corner[0], corner[1], corner[2] - 0.012], [s * 0.118, -0.07, -0.015], [s * 0.108, -0.088, -0.07], [s * 0.07, -0.093, -0.105], [s * 0.036, -0.062, -0.12]], 7);
    part(head, swept(hose, 0.0085, 8, false), mats.rubber, 0, 0, 0);
    add(head, cyl(0.012, 0.012, 0.016, mats.metal, 10), s * 0.036, -0.058, -0.12);                              // conector en la nuca

    add(head, cyl(0.045, 0.045, 0.022, mats.hard, 18), s * 0.114, -0.01, -0.005).rotation.z = P / 2;          // discos de las orejas
    add(head, torus(0.03, 0.004, mats.glow), s * 0.127, -0.01, -0.005).rotation.y = P / 2;
    for (var k = 0; k < 3; k++) add(head, box(0.006, 0.012, 0.04, mats.rubber), s * 0.112, 0.055 - k * 0.02, -0.06);   // ventilaciones laterales
  });
  for (var tv = 0; tv < 2; tv++) add(head, box(0.04, 0.004, 0.012, mats.rubber), 0, 0.16, 0.02 - tv * 0.05);  // ventilaciones superiores
  add(head, sphere(0.005, mats.glow), 0, 0.034, -0.305);                                                      // luz de la punta de la cola
  rb(head, 0.1, 0.06, 0.04, 0.015, mats.hard, 0, -0.085, -0.115);                                             // sello de la nuca

  /* ---------- Brazos ---------- */
  var thrusters = [];
  var wings = [];
  function buildArm(side) {
    var shoulder = new THREE.Group();
    shoulder.position.set(side * 0.255, SHOULDER_Y, 0);
    shoulder.rotation.set(-0.1, 0, side * 0.1);                                                // postura: brazos algo abiertos
    add(shoulder, sphere(0.066, mats.suit), 0, 0, 0);                                          // hombro (articulación)

    // hombrera-propulsor: ala puntiaguda hacia atrás y hacia arriba
    var wing = new THREE.Group();
    wing.position.set(side * 0.03, 0.05, 0.05);
    wing.rotation.y = -side * 0.22;                                                            // la punta se abre un poco hacia fuera
    shoulder.add(wing);
    blade(wing, [[-0.1, 0.07, 0.03, 0, 0, 2.8], [-0.02, 0.108, 0.056, 0, 0, 2.8], [0.08, 0.104, 0.062, 0.004, 0, 2.8], [0.2, 0.056, 0.04, 0.02, 0, 2.6], [0.3, 0.014, 0.016, 0.05, 0, 2.4], [0.34, 0.003, 0.003, 0.06]], mats.armor, 0, 0, 0, -P / 2);
    blade(wing, [[-0.06, 0.06, 0.02, -0.02, 0, 2.8], [0.02, 0.09, 0.04, -0.02, 0, 2.8], [0.14, 0.075, 0.035, 0, 0, 2.6], [0.26, 0.03, 0.02, 0.02, 0, 2.4], [0.36, 0.003, 0.003, 0.04]], mats.hard, 0, -0.03, 0, -P / 2);   // capa oscura inferior
    add(wing, box(0.008, 0.004, 0.17, mats.glow), 0, 0.066, -0.11);                            // franja de energía
    rivets(wing, [[0.07, 0.04, 0.02], [-0.07, 0.04, 0.02], [0.05, 0.05, -0.06], [-0.05, 0.05, -0.06]], 0.007);
    add(wing, box(0.05, 0.03, 0.06, mats.hard), 0, -0.03, -0.17);                              // soporte bajo el ala
    add(wing, cyl(0.03, 0.046, 0.13, mats.hard, 16), 0, -0.095, -0.17);                        // tobera del propulsor (apunta hacia abajo)
    add(wing, torus(0.048, 0.006, mats.hard), 0, -0.158, -0.17).rotation.x = P / 2;            // aro de salida
    add(wing, cyl(0.039, 0.039, 0.01, mats.glow, 16), 0, -0.162, -0.17);                       // fuego del propulsor
    add(wing, torus(0.036, 0.004, mats.glow), 0, -0.06, -0.17).rotation.x = P / 2;             // anillo de energía
    var out = new THREE.Object3D();                                                            // salida del propulsor (mira a -Y)
    out.position.set(0, -0.168, -0.17);
    wing.add(out);
    thrusters.push(out);
    wings.push(wing);

    var upper = new THREE.Group();
    shoulder.add(upper);
    suitTube(upper, [rg(0, 0.056, 0.058), rg(-0.05, 0.06, 0.062), rg(-0.12, 0.056, 0.06, 0.004), rg(-0.2, 0.05, 0.052), rg(-0.29, 0.046, 0.047)], 14);
    // brazal del bíceps: sigue el contorno del traje (separación mínima) y sus bordes se afinan hasta tocar la tela
    plate(upper, [rg(-0.03, 0.0599, 0.0619, 0, 0, 2.5), rg(-0.05, 0.0665, 0.0685, 0, 0, 2.5), rg(-0.08, 0.0648, 0.0676, 0.0017, 0, 2.5),
      rg(-0.12, 0.0625, 0.0665, 0.004, 0, 2.5), rg(-0.16, 0.0595, 0.0625, 0.002, 0, 2.5), rg(-0.185, 0.0566, 0.059, 0.001, 0, 2.5)], mats.armor, 20);
    plate(upper, [rg(-0.18, 0.057, 0.0595, 0.001, 0, 2.5), rg(-0.195, 0.0558, 0.058, 0.0005, 0, 2.5), rg(-0.21, 0.0524, 0.0545, 0, 0, 2.4)], mats.hard, 20);      // borde inferior oscuro que se funde con el traje
    var elbow = new THREE.Group();
    elbow.position.set(0, -ARM_LEN, 0);
    elbow.rotation.x = -0.35;                                                                  // postura: codo flexionado
    upper.add(elbow);
    add(elbow, sphere(0.047, mats.suit), 0, 0, 0);                                             // codo
    add(elbow, sphere(0.055, mats.hard, 1, 1.1, 0.7), 0, 0, -0.05);                            // codera
    suitTube(elbow, [rg(0, 0.046, 0.047), rg(-0.06, 0.05, 0.05), rg(-0.15, 0.043, 0.042), rg(-0.22, 0.036, 0.035), rg(-0.26, 0.034, 0.033)], 14);
    plate(elbow, [rg(-0.04, 0.068, 0.062, 0, 0, 3.2), rg(-0.12, 0.058, 0.055, 0, 0, 3.2), rg(-0.2, 0.044, 0.042, 0, 0, 3.2)], mats.armor, 16);       // guantelete angular
    plate(elbow, [rg(-0.035, 0.07, 0.064, 0, 0, 3.2), rg(-0.052, 0.069, 0.063, 0, 0, 3.2)], mats.hard, 16);
    rb(elbow, 0.05, 0.1, 0.012, 0.004, mats.hard, 0, -0.12, 0.052);                            // panel de control
    add(elbow, box(0.032, 0.058, 0.004, mats.glow), 0, -0.115, 0.06);                          // pantalla
    for (var bt = -1; bt <= 1; bt++) add(elbow, sphere(0.004, mats.glow), bt * 0.013, -0.17, 0.059);   // botones
    add(elbow, box(0.006, 0.12, 0.01, mats.glow), -side * 0.0585, -0.12, 0.012).rotation.z = side * 0.112;                // franja de energía
    plate(elbow, [rg(-0.215, 0.04, 0.039, 0, 0, 2.2), rg(-0.222, 0.04, 0.039, 0, 0, 2.2)], mats.glow, 14);                                         // anillo de la muñeca
    var hand = new THREE.Group();
    hand.position.set(0, -FOREARM_LEN, 0);
    elbow.add(hand);
    buildHand(hand, side);
    return { shoulder: shoulder, elbow: elbow, upper: upper };
  }
  var armL = buildArm(-1), armR = buildArm(1);
  body.add(armL.shoulder);
  body.add(armR.shoulder);

  /* ---------- Escalado a unidades y apoyo en y = 0 ---------- */
  body.updateMatrixWorld(true);
  var bb = new THREE.Box3().setFromObject(body);
  var K = (HEIGHT_M / (bb.max.y - bb.min.y)) / MPU;
  body.scale.setScalar(K);
  body.position.y = -bb.min.y * K;

  /* ---------- API ---------- */
  var api = {
    group: group,
    footprint: { w: 0.95 * HEIGHT_M / 1.95 / MPU, d: 0.9 * HEIGHT_M / 1.95 / MPU },
    height: HEIGHT_M / MPU,
    thrusters: thrusters,
    parts: {
      head: head, armL: armL.shoulder, armR: armR.shoulder, forearmL: armL.elbow, forearmR: armR.elbow,
      legL: legL.hip, legR: legR.hip, shinL: legL.knee, shinR: legR.knee,
      wingL: wings[0], wingR: wings[1], pack: pack
    },
    setAccent: setAccent,
    setGlow: setGlow,
    setGhost: function (on, valid) {
      ghost = !!on;
      for (var key in mats) {
        var m = mats[key];
        m.transparent = ghost;
        m.opacity = ghost ? 0.45 : 1;
        m.depthWrite = !ghost;
        if (ghost) { m.emissive.setHex(valid === false ? 0xff2a2a : 0x25ff7a); m.emissiveIntensity = 0.5; }
        else { m.emissive.setHex(origEm[key].c); m.emissiveIntensity = origEm[key].i; }
        m.needsUpdate = true;
      }
    },
    dispose: function () {
      group.traverse(function (o) { if (o.geometry) o.geometry.dispose(); });
      for (var key in mats) mats[key].dispose();
    },
    update: function () { }          // sin animación
  };
  return api;
}
