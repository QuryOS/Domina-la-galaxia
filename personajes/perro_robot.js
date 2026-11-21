/**
 * Perro robot cuadrúpedo para Three.js, sin archivos externos, inspirado en el Unitree Go2 (versión civil: blanco y gris).
 *
 *  - Cuerpo alargado y compacto: carcasa blanca, vientre oscuro, tapa de la batería, barra de luz trasera y rejillas.
 *  - Cabeza corta con visor negro brillante, dos cámaras y lámpara frontal, y el LiDAR en forma de domo bajo la barbilla (como el Go2).
 *  - Cuatro patas articuladas con tres articulaciones cada una (cadera, muslo y pantorrilla), con las rodillas hacia
 *    atrás como el Go2. Los motores son cilindros oscuros en la cadera, el muslo y la rodilla; los pies son de goma.
 *  - Animación con cinemática inversa: los pies se apoyan en el suelo y se levantan al avanzar.
 *      'idle'  -> de pie, respirando y mirando alrededor
 *      'walk'  -> caminata de cuatro tiempos
 *      'trot'  -> trote con pares de patas diagonales
 *
 * Versiones (opts.version):
 *   'farmeo'  -> la versión base, para recolectar recursos (sin arma).
 *   'canon'   -> con un cañón futurista de dos rieles y núcleo de energía sobre una torreta en el lomo.
 *   'pistola' -> con una pistola futurista compacta sobre una torreta en el lomo.
 *   Las versiones armadas tienen dog.aim(yaw, pitch), dog.fire() y dog.setAutoAim(on) (por defecto la torreta vigila sola).
 *
 * Uso:
 *   const dog = createPerroRobotGo2(THREE, { version: 'canon', glow: 0x7fd8ff });
 *   dog.group.position.set(x, groundY, z);          // los pies están en y = 0
 *   scene.add(dog.group);
 *   dog.setState('trot');                           // 'idle' | 'walk' | 'trot'
 *   dog.update(clock.getElapsedTime());             // llámalo en cada frame con el tiempo en segundos
 *   dog.group.position.addScaledVector(forward, dog.speed * dt);   // avanza sin que resbalen los pies
 *
 * Escala: 1 unidad = 4 m (igual que el resto de modelos), así que mide 0.1 unidades de alto (0.40 m).
 *   Cambia la equivalencia con opts.metersPerUnit (1 = unidades en metros) y la altura con opts.height (m).
 *   Frente del perro: lado +Z. Su izquierda es +X. Huella: dog.footprint (centrada en el origen).
 *
 * dog.setAccent(hex): color de la carcasa (blanco por defecto).
 * dog.setGlow(hex): color de la luz (lentes, barra trasera, franjas).
 * dog.setGhost(true, valid): modo "fantasma" para colocar (verde si valid, rojo si valid === false).
 * dog.state: estado pedido. dog.speed: velocidad de avance en unidades por segundo para el estado actual.
 * dog.feet: [FL, FR, RL, RR] Object3D en el centro de cada pie (polvo, huellas, partículas).
 * dog.lidar: Object3D del LiDAR (el domo de la barbilla gira solo). La cabeza no se mueve.
 * dog.parts: { trunk, head, legs: { FL, FR, RL, RR: { hip, thigh, calf, foot } } } por si quieres cambiar la postura.
 * dog.dispose(): libera geometrías y materiales.
 * Compatible con Three.js r128 o superior.
 */
function createPerroRobotGo2(THREE, opts) {
  opts = opts || {};
  var P = Math.PI, TAU = P * 2;
  var MPU = opts.metersPerUnit != null ? opts.metersPerUnit : 4;
  var HEIGHT_M = opts.height != null ? opts.height : 0.4;
  var VERSION = opts.version === 'canon' || opts.version === 'pistola' ? opts.version : 'farmeo';   // 'farmeo' | 'canon' | 'pistola'

  var colors = {
    shell: opts.shell != null ? opts.shell : 0xe9ebef,
    trim: opts.trim != null ? opts.trim : 0xa9adb5,
    dark: opts.dark != null ? opts.dark : 0x2a2d34,
    glow: opts.glow != null ? opts.glow : 0x7fd8ff
  };

  var group = new THREE.Group();     // lo que añade el juego a la escena
  var body = new THREE.Group();      // cuerpo en metros, escalado a unidades
  group.add(body);

  /* ---------- Materiales ---------- */
  function mat(color, rough, metal) {
    return new THREE.MeshStandardMaterial({ color: color, roughness: rough, metalness: metal });
  }
  var mats = {
    shell: mat(colors.shell, 0.38, 0.05),
    trim: mat(colors.trim, 0.5, 0.2),
    dark: mat(colors.dark, 0.55, 0.3),
    rubber: mat(0x101114, 0.92, 0.0),
    black: mat(0x0b0c0f, 0.12, 0.6),
    glow: new THREE.MeshStandardMaterial({ color: colors.glow, emissive: colors.glow, emissiveIntensity: 1.15, roughness: 0.4, metalness: 0.0 }),
    pulse: new THREE.MeshStandardMaterial({ color: colors.glow, emissive: colors.glow, emissiveIntensity: 1.0, roughness: 0.4, metalness: 0.0 }),    // indicador que pulsa
    muzzle: new THREE.MeshStandardMaterial({ color: colors.glow, emissive: colors.glow, emissiveIntensity: 0.4, roughness: 0.4, metalness: 0.0 })    // boca del arma y fogonazo
  };
  var origEm = {};
  for (var mk in mats) origEm[mk] = { c: mats[mk].emissive.getHex(), i: mats[mk].emissiveIntensity };
  var ghost = false;

  function setAccent(hex) { mats.shell.color.setHex(hex); }
  function setGlow(hex) {
    ['glow', 'pulse', 'muzzle'].forEach(function (k) {
      mats[k].color.setHex(hex);
      mats[k].emissive.setHex(ghost ? 0x25ff7a : hex);
      origEm[k].c = hex;
    });
  }

  /* ---------- Ayudantes de geometría ---------- */
  function mesh(parent, geo, m, x, y, z) {
    var o = new THREE.Mesh(geo, m);
    o.position.set(x || 0, y || 0, z || 0);
    parent.add(o);
    return o;
  }
  function box(parent, w, h, d, m, x, y, z) { return mesh(parent, new THREE.BoxGeometry(w, h, d), m, x, y, z); }
  function cyl(parent, rt, rb, h, m, x, y, z, seg) { return mesh(parent, new THREE.CylinderGeometry(rt, rb, h, seg || 20), m, x, y, z); }
  function sphere(parent, r, m, sx, sy, sz, x, y, z) {
    var o = mesh(parent, new THREE.SphereGeometry(1, 24, 16), m, x, y, z);
    o.scale.set(r * (sx || 1), r * (sy || 1), r * (sz || 1));
    return o;
  }

  // Loft a lo largo de Z: secciones [z, semiancho, arriba, abajo, n] (n = redondez de la sección, 2 = elipse, mayor = más cuadrada)
  function loftZ(secs, seg) {
    seg = seg || 28;
    var ns = secs.length, pos = [], nor = [], idx = [], i, j, k;
    for (i = 0; i < ns; i++) {
      var sc = secs[i], cy = (sc[2] + sc[3]) / 2, hh = (sc[2] - sc[3]) / 2, ex = 2 / (sc[4] || 2.4);
      for (j = 0; j < seg; j++) {
        var a = TAU * j / seg, c = Math.cos(a), s = Math.sin(a);
        pos.push(sc[1] * (c < 0 ? -1 : 1) * Math.pow(Math.abs(c), ex), cy + hh * (s < 0 ? -1 : 1) * Math.pow(Math.abs(s), ex), sc[0]);
        nor.push(0, 0, 0);
      }
    }
    function addTri(a, b, c) {
      idx.push(a, b, c);
      var ax = pos[a * 3], ay = pos[a * 3 + 1], az = pos[a * 3 + 2];
      var ux = pos[b * 3] - ax, uy = pos[b * 3 + 1] - ay, uz = pos[b * 3 + 2] - az;
      var vx = pos[c * 3] - ax, vy = pos[c * 3 + 1] - ay, vz = pos[c * 3 + 2] - az;
      var nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      var ids = [a, b, c];
      for (var q = 0; q < 3; q++) { nor[ids[q] * 3] += nx; nor[ids[q] * 3 + 1] += ny; nor[ids[q] * 3 + 2] += nz; }
    }
    for (i = 0; i < ns - 1; i++) for (j = 0; j < seg; j++) {
      var j2 = (j + 1) % seg, a0 = i * seg + j, b0 = i * seg + j2, c0 = (i + 1) * seg + j, d0 = (i + 1) * seg + j2;
      addTri(a0, b0, c0);
      addTri(b0, d0, c0);
    }
    for (i = 0; i < pos.length / 3; i++) {            // normalizar las normales del cuerpo del loft
      var l = Math.sqrt(nor[i * 3] * nor[i * 3] + nor[i * 3 + 1] * nor[i * 3 + 1] + nor[i * 3 + 2] * nor[i * 3 + 2]) || 1;
      nor[i * 3] /= l; nor[i * 3 + 1] /= l; nor[i * 3 + 2] /= l;
    }
    // tapas planas en los dos extremos (vértices propios para que el borde quede definido)
    [0, ns - 1].forEach(function (e) {
      var base = pos.length / 3, sc = secs[e], dir = e === 0 ? -1 : 1, cy = (sc[2] + sc[3]) / 2;
      pos.push(0, cy, sc[0]); nor.push(0, 0, dir);
      for (k = 0; k < seg; k++) { var o = e * seg + k; pos.push(pos[o * 3], pos[o * 3 + 1], pos[o * 3 + 2]); nor.push(0, 0, dir); }
      for (k = 0; k < seg; k++) {
        var k2 = (k + 1) % seg;
        if (dir < 0) idx.push(base, base + 1 + k2, base + 1 + k); else idx.push(base, base + 1 + k, base + 1 + k2);
      }
    });
    var g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    g.setIndex(idx);
    return g;
  }
  // Loft vertical que cuelga hacia -Y (para muslos y pantorrillas): s = distancia hacia abajo,
  // "arriba" de la sección = delante (+Z) y "abajo" = detrás (-Z)
  function loftDown(secs, seg) { return loftZ(secs, seg).rotateX(P / 2); }
  // contorno interpolado de un loft y una "piel" que lo abraza (para paneles que siguen la forma)
  function profOf(secs, z) {
    var i = 0;
    if (z <= secs[0][0]) return secs[0];
    while (i < secs.length - 2 && z > secs[i + 1][0]) i++;
    var t = Math.min(1, Math.max(0, (z - secs[i][0]) / (secs[i + 1][0] - secs[i][0])));
    return [z, secs[i][1] + (secs[i + 1][1] - secs[i][1]) * t, secs[i][2] + (secs[i + 1][2] - secs[i][2]) * t, secs[i][3] + (secs[i + 1][3] - secs[i][3]) * t, secs[i][4]];
  }
  function skin(secs, z0, z1, off, edge, steps) {
    var out = [];
    for (var i = 0; i <= steps; i++) {
      var z = z0 + (z1 - z0) * i / steps, p = profOf(secs, z), o = (i === 0 || i === steps) ? edge : off;
      out.push([z, p[1] + o, p[2] + o, p[3] - o, p[4]]);
    }
    return out;
  }

  /* ---------- Dimensiones del Go2 (metros) ---------- */
  var L1 = 0.213, L2 = 0.213;                 // muslo y pantorrilla
  var HIP_X = 0.083, HIP_Z = 0.1934;          // esquina del cuerpo donde nace cada pata
  var LEG_X = 0.1;                            // plano lateral de la pata
  var FOOT_R = 0.022;                         // radio del pie
  var DZ0 = -0.012, DY0 = -0.311;             // posición del pie respecto a la cadera al estar de pie
  var H0 = -DY0;                              // altura de la cadera sobre el centro del pie

  var trunk = new THREE.Group();              // se mueve al respirar y caminar
  trunk.position.y = H0 + FOOT_R;
  body.add(trunk);

  /* ---------- Cuerpo ---------- */
  var T = [[-0.275, 0.045, 0.045, -0.02, 2.2], [-0.262, 0.066, 0.062, -0.04, 2.4], [-0.225, 0.081, 0.074, -0.05, 2.6], [-0.12, 0.088, 0.08, -0.054, 2.8],
    [0.0, 0.09, 0.082, -0.055, 2.8], [0.12, 0.088, 0.08, -0.054, 2.8], [0.19, 0.082, 0.071, -0.049, 2.6], [0.225, 0.062, 0.054, -0.036, 2.3], [0.238, 0.034, 0.036, -0.022, 2.0]];
  mesh(trunk, loftZ(T, 32), mats.shell);                                                                       // carcasa blanca
  mesh(trunk, loftZ([[-0.25, 0.05, -0.02, -0.052, 2.4], [-0.2, 0.072, -0.02, -0.0575, 2.6], [0.0, 0.08, -0.02, -0.0585, 2.8], [0.17, 0.072, -0.02, -0.0535, 2.6],
    [0.215, 0.05, -0.02, -0.04, 2.4]], 28), mats.dark);                                                        // vientre oscuro (protector)
  mesh(trunk, loftZ(skin(T, -0.17, 0.1, 0.0, 0.0, 1).map(function (s) { return [s[0], 0.062, 0.0845, 0.068, 2.6]; }).concat([]), 24), mats.trim);   // tapa de la batería
  box(trunk, 0.1, 0.004, 0.004, mats.dark, 0, 0.0825, -0.17);                                                  // junta de la tapa
  box(trunk, 0.1, 0.004, 0.004, mats.dark, 0, 0.0845, 0.1);
  box(trunk, 0.07, 0.009, 0.006, mats.glow, 0, 0.016, -0.2765);                                                // barra de luz trasera
  [-1, 1].forEach(function (s) {
    box(trunk, 0.003, 0.007, 0.24, mats.glow, s * 0.0902, 0.012, -0.01);                                       // franja de luz lateral
    for (var v = 0; v < 3; v++) box(trunk, 0.004, 0.014, 0.05, mats.dark, s * 0.0885, 0.036, -0.17 + v * 0.075);   // rejillas
  });

  /* ---------- Cabeza ---------- */
  var head = new THREE.Group();
  head.position.set(0, 0.04, 0.19);
  trunk.add(head);
  var HS = [[-0.04, 0.066, 0.046, -0.046, 2.6], [0.02, 0.07, 0.05, -0.05, 2.7], [0.07, 0.064, 0.046, -0.047, 2.6], [0.1, 0.053, 0.04, -0.04, 2.5],
    [0.115, 0.05, 0.038, -0.038, 2.5], [0.12, 0.041, 0.032, -0.032, 2.4], [0.122, 0.031, 0.026, -0.026, 2.2]];
  mesh(head, loftZ(HS, 32), mats.shell);                                                                       // carcasa de la cabeza
  var face = skin(HS, 0.096, 0.122, 0.0025, 0.001, 6);
  face.push([0.1245, 0.026, 0.024, -0.024, 2.2]);
  mesh(head, loftZ(face, 28), mats.black);                                                                     // panel frontal negro brillante
  // frente del Go2: dos cámaras frontales pequeñas y la lámpara frontal (sin ojos dibujados)
  [-1, 1].forEach(function (s) {
    cyl(head, 0.0105, 0.0105, 0.005, mats.trim, s * 0.021, 0.004, 0.1258, 20).rotation.x = P / 2;          // aro de la cámara
    cyl(head, 0.0075, 0.0075, 0.006, mats.rubber, s * 0.021, 0.004, 0.1262, 20).rotation.x = P / 2;        // lente
    cyl(head, 0.0028, 0.0028, 0.007, mats.glow, s * 0.021, 0.004, 0.1266, 10).rotation.x = P / 2;          // reflejo azul del lente
  });
  box(head, 0.05, 0.005, 0.004, mats.glow, 0, 0.0215, 0.1262);                                                  // lámpara frontal (barra de luz)
  box(head, 0.014, 0.004, 0.012, mats.glow, 0, 0.0505, 0.0);                                                    // luz indicadora de la cabeza (arriba)
  // LiDAR 4D L1 en la barbilla: domo negro brillante que mira hacia abajo y adelante (así es el del Go2)
  cyl(head, 0.0065, 0.0065, 0.005, mats.pulse, 0, -0.0125, 0.1262, 18).rotation.x = P / 2;                    // circulito indicador bajo las cámaras (pulsa)
  [-1, 1].forEach(function (sd) {
    for (var k = 0; k < 3; k++) box(head, 0.003, 0.004, 0.024, mats.dark, sd * 0.0683, 0.012 - k * 0.012, 0.03);   // rejilla del altavoz en la mejilla
  });
  var lidar = new THREE.Group();
  lidar.position.set(0, -0.039, 0.082);
  lidar.rotation.x = -0.35;
  head.add(lidar);
  cyl(lidar, 0.05, 0.047, 0.01, mats.trim, 0, -0.002, 0, 28);                                                  // base del sensor
  var lidarSpin = new THREE.Group();                                                                          // la parte que gira
  lidar.add(lidarSpin);
  var dome = new THREE.Mesh(new THREE.SphereGeometry(1, 28, 14, 0, TAU, 0, P / 2), mats.black);
  dome.scale.set(0.04, -0.034, 0.04);                                                                          // hemisferio invertido (hacia abajo)
  dome.position.y = -0.006;
  lidarSpin.add(dome);
  box(lidarSpin, 0.004, 0.02, 0.004, mats.glow, 0, -0.024, 0.0345);                                           // ranura luminosa: se ve girar
  cyl(lidarSpin, 0.012, 0.012, 0.004, mats.trim, 0, -0.0415, 0, 14);                                          // tapa del domo
  box(trunk, 0.05, 0.012, 0.03, mats.dark, 0, 0.075, 0.12);                                                    // unión cabeza-cuerpo
  [[-0.045, -0.15], [0.045, -0.15], [-0.045, 0.08], [0.045, 0.08]].forEach(function (q) { cyl(trunk, 0.004, 0.004, 0.003, mats.dark, q[0], 0.0845, q[1], 10); });   // tornillos de la tapa
  [-1, 1].forEach(function (sd) {
    box(trunk, 0.003, 0.03, 0.06, mats.dark, sd * 0.0885, 0.03, 0.1);                                          // placa lateral
    box(trunk, 0.04, 0.006, 0.12, mats.rubber, sd * 0.045, -0.0585, 0.0);                                      // patines bajo el vientre
  });
  box(trunk, 0.04, 0.02, 0.004, mats.dark, 0, -0.008, -0.2765);                                                // puerto de carga trasero
  box(trunk, 0.012, 0.005, 0.0045, mats.glow, 0, -0.008, -0.2768);

  /* ---------- Patas ---------- */
  function buildLeg(name, sx, sz) {
    var hip = new THREE.Group();                         // eje de abducción (a lo largo de Z)
    hip.position.set(sx * HIP_X, 0, sz * HIP_Z);
    trunk.add(hip);
    cyl(hip, 0.038, 0.038, 0.066, mats.dark, 0, 0, 0, 22).rotation.x = P / 2;                              // motor de la cadera
    cyl(hip, 0.04, 0.04, 0.006, mats.trim, 0, 0, sz * 0.036, 22).rotation.x = P / 2;
    for (var fn = -1; fn <= 1; fn++) cyl(hip, 0.0405, 0.0405, 0.003, mats.trim, 0, 0, fn * 0.018, 22).rotation.x = P / 2;   // aletas de enfriamiento
    var thigh = new THREE.Group();                       // eje del muslo (a lo largo de X)
    thigh.position.set(sx * (LEG_X - HIP_X), 0, 0);
    hip.add(thigh);
    cyl(thigh, 0.043, 0.043, 0.05, mats.dark, 0, 0, 0, 24).rotation.z = P / 2;                              // motor del muslo
    cyl(thigh, 0.036, 0.036, 0.006, mats.shell, sx * 0.026, 0, 0, 24).rotation.z = P / 2;                   // tapa blanca exterior
    mesh(thigh, loftDown([[0.0, 0.015, 0.042, -0.036, 2.4], [0.03, 0.017, 0.044, -0.037, 2.6], [0.11, 0.015, 0.032, -0.029, 2.6],
      [0.19, 0.013, 0.025, -0.023, 2.4], [0.213, 0.011, 0.02, -0.019, 2.2]], 22), mats.shell, sx * 0.004, 0, 0);       // muslo (carcasa blanca)
    box(thigh, 0.004, 0.14, 0.05, mats.dark, -sx * 0.013, -0.11, -0.004);                                    // cara interior oscura
    box(thigh, 0.003, 0.09, 0.006, mats.glow, sx * 0.0215, -0.1, 0.012);                                     // franja de luz
    cyl(thigh, 0.0055, 0.0055, 0.1856, mats.dark, 0, -0.1075, -0.0285, 10).rotation.x = -0.081;               // varilla del actuador de la rodilla
    var calf = new THREE.Group();                        // eje de la rodilla (a lo largo de X)
    calf.position.set(0, -L1, 0);
    thigh.add(calf);
    cyl(calf, 0.027, 0.027, 0.04, mats.dark, 0, 0, 0, 20).rotation.z = P / 2;                               // motor de la rodilla
    cyl(calf, 0.0285, 0.0285, 0.006, mats.trim, sx * 0.0215, 0, 0, 20).rotation.z = P / 2;                  // aro de la rodilla
    cyl(calf, 0.0145, 0.0085, L2, mats.dark, 0, -L2 / 2, 0, 14);                                              // varilla de la pantorrilla
    cyl(calf, 0.0135, 0.0135, 0.006, mats.trim, 0, -0.06, 0, 14);                                             // anillos de la pantorrilla
    cyl(calf, 0.0121, 0.0121, 0.006, mats.trim, 0, -0.12, 0, 14);
    mesh(calf, loftDown([[0.012, 0.013, 0.022, -0.004, 2.4], [0.05, 0.013, 0.02, -0.004, 2.4], [0.12, 0.01, 0.014, -0.003, 2.4], [0.17, 0.0085, 0.011, -0.003, 2.4]], 18),
      mats.shell, 0, 0, 0.002);                                                                                // cubierta blanca delantera
    var foot = new THREE.Object3D();                     // centro del pie
    foot.position.set(0, -L2, 0);
    calf.add(foot);
    sphere(foot, FOOT_R, mats.rubber, 1, 1, 1, 0, 0, 0);                                                      // pie de goma
    cyl(foot, 0.0135, 0.011, 0.014, mats.trim, 0, 0.026, 0, 14);                                              // aro del tobillo
    return { name: name, sx: sx, sz: sz, hip: hip, thigh: thigh, calf: calf, foot: foot };
  }
  var legs = { FL: buildLeg('FL', 1, 1), FR: buildLeg('FR', -1, 1), RL: buildLeg('RL', 1, -1), RR: buildLeg('RR', -1, -1) };
  var legList = [legs.FL, legs.FR, legs.RL, legs.RR];

  // Cinemática inversa de dos eslabones en el plano de la pata (rodilla hacia atrás, como el Go2)
  function solveLeg(leg, dz, dy) {
    var d = Math.sqrt(dz * dz + dy * dy), maxd = (L1 + L2) * 0.985;
    if (d > maxd) { dz *= maxd / d; dy *= maxd / d; d = maxd; }
    if (d < 0.1) d = 0.1;
    var cosA = Math.max(-1, Math.min(1, (L1 * L1 + L2 * L2 - d * d) / (2 * L1 * L2)));
    var cosB = Math.max(-1, Math.min(1, (L1 * L1 + d * d - L2 * L2) / (2 * L1 * d)));
    var alpha = Math.acos(cosA), beta = Math.acos(cosB), psi = Math.atan2(dz, -dy);
    leg.thigh.rotation.x = -(psi - beta);
    leg.calf.rotation.x = -(P - alpha);
  }

  /* ---------- Escalado a unidades y apoyo en y = 0 ---------- */
  legList.forEach(function (l) { solveLeg(l, DZ0, DY0); });
  body.updateMatrixWorld(true);
  var bb = new THREE.Box3().setFromObject(body);
  var K = (HEIGHT_M / (bb.max.y - bb.min.y)) / MPU;
  body.scale.setScalar(K);
  body.position.y = -bb.min.y * K;

  /* ---------- Armas (solo en las versiones 'canon' y 'pistola'): se montan después de calcular la escala ---------- */
  var W = { yaw: 0, pitch: 0, recoil: 0, auto: true, turret: null, gun: null, barrel: null, flash: null, bz: 0, rk: 0, fs: 0.03 };
  if (VERSION !== 'farmeo') {
    var turret = new THREE.Group();                                    // torreta giratoria sobre el lomo
    turret.position.set(0, 0.0845, -0.03);
    trunk.add(turret);
    cyl(turret, 0.062, 0.066, 0.016, mats.dark, 0, 0.008, 0, 28);
    cyl(turret, 0.07, 0.07, 0.006, mats.trim, 0, 0.003, 0, 28);
    cyl(turret, 0.045, 0.05, 0.022, mats.shell, 0, 0.027, 0, 24);
    var cradleX = VERSION === 'canon' ? 0.05 : 0.036;
    [-1, 1].forEach(function (sd) { box(turret, 0.012, 0.05, 0.09, mats.dark, sd * cradleX, 0.06, 0); });      // horquilla
    var gun = new THREE.Group();                                       // eje de elevación del arma
    gun.position.set(0, 0.07, 0);
    turret.add(gun);
    cyl(gun, 0.012, 0.012, cradleX * 2 + 0.01, mats.trim, 0, 0, 0, 14).rotation.z = P / 2;
    var barrel = new THREE.Group();                                    // parte que retrocede al disparar
    gun.add(barrel);
    var flash;
    if (VERSION === 'canon') {
      // cañón futurista: receptor blanco, dos rieles con núcleo de energía, aletas de enfriamiento y boca con aro luminoso
      mesh(gun, loftZ([[-0.09, 0.036, 0.034, -0.03, 2.8], [-0.04, 0.042, 0.04, -0.034, 2.8], [0.04, 0.042, 0.04, -0.034, 2.8], [0.08, 0.034, 0.03, -0.026, 2.6]], 24), mats.shell);
      box(gun, 0.07, 0.05, 0.04, mats.dark, 0, 0, -0.11);                                                      // bloque de energía trasero
      [-1, 1].forEach(function (sd) {
        box(gun, 0.03, 0.04, 0.07, mats.dark, sd * 0.058, -0.005, -0.02);                                        // celdas de energía laterales
        box(gun, 0.004, 0.025, 0.04, mats.glow, sd * 0.0745, -0.005, -0.02);
      });
      box(gun, 0.02, 0.014, 0.05, mats.dark, 0, 0.044, 0.0);                                                   // mira
      cyl(gun, 0.007, 0.007, 0.006, mats.glow, 0, 0.044, 0.027, 12).rotation.x = P / 2;
      barrel.position.set(0, 0.004, 0.08);
      [-1, 1].forEach(function (sd) { cyl(barrel, 0.011, 0.011, 0.27, mats.dark, sd * 0.02, 0, 0.135, 14).rotation.x = P / 2; });   // rieles
      box(barrel, 0.012, 0.008, 0.25, mats.glow, 0, 0, 0.135);                                                 // núcleo de energía entre los rieles
      [0.05, 0.1, 0.15, 0.2].forEach(function (z) { cyl(barrel, 0.034, 0.034, 0.004, mats.trim, 0, 0, z, 20).rotation.x = P / 2; });   // aletas
      cyl(barrel, 0.036, 0.036, 0.03, mats.dark, 0, 0, 0.27, 22).rotation.x = P / 2;                           // boca
      mesh(barrel, new THREE.TorusGeometry(0.027, 0.004, 10, 28), mats.glow, 0, 0, 0.287);                     // aro luminoso de la boca
      cyl(barrel, 0.019, 0.019, 0.004, mats.muzzle, 0, 0, 0.2865, 18).rotation.x = P / 2;                      // núcleo que brilla al disparar
      flash = sphere(barrel, 0.03, mats.muzzle, 1, 1, 2.2, 0, 0, 0.33);
      W.bz = 0.08; W.rk = 0.035; W.fs = 0.03;
    } else {
      // pistola futurista: cuerpo blanco, riel superior, ventanas de energía, cañón con anillos luminosos y empuñadura
      [-1, 1].forEach(function (sd) { box(gun, 0.008, 0.04, 0.04, mats.dark, sd * 0.028, 0, 0); });             // soportes del eje
      mesh(gun, loftZ([[-0.07, 0.016, 0.026, -0.016, 2.6], [-0.03, 0.02, 0.03, -0.02, 2.8], [0.05, 0.02, 0.03, -0.02, 2.8], [0.1, 0.016, 0.024, -0.016, 2.4]], 20), mats.shell);
      box(gun, 0.008, 0.006, 0.12, mats.trim, 0, 0.033, 0.02);                                                 // riel superior
      box(gun, 0.006, 0.01, 0.008, mats.dark, 0, 0.038, -0.035);                                               // miras
      box(gun, 0.006, 0.012, 0.008, mats.dark, 0, 0.038, 0.08);
      [-1, 1].forEach(function (sd) { box(gun, 0.004, 0.018, 0.05, mats.glow, sd * 0.0205, 0.0, 0.02); });      // ventanas de la celda de energía
      box(gun, 0.028, 0.07, 0.036, mats.dark, 0, -0.05, -0.045).rotation.x = -0.2;                             // empuñadura
      box(gun, 0.02, 0.014, 0.06, mats.dark, 0, -0.026, 0.07);                                                 // módulo bajo el cañón
      barrel.position.set(0, 0, 0.1);
      cyl(barrel, 0.0105, 0.0105, 0.1, mats.dark, 0, 0, 0.05, 14).rotation.x = P / 2;                          // cañón
      [0.03, 0.07].forEach(function (z) { cyl(barrel, 0.0135, 0.0135, 0.005, mats.glow, 0, 0, z, 16).rotation.x = P / 2; });   // anillos de energía
      cyl(barrel, 0.0145, 0.0145, 0.012, mats.trim, 0, 0, 0.106, 16).rotation.x = P / 2;                       // boca
      cyl(barrel, 0.009, 0.009, 0.004, mats.muzzle, 0, 0, 0.1125, 12).rotation.x = P / 2;                      // núcleo que brilla al disparar
      flash = sphere(barrel, 0.022, mats.muzzle, 1, 1, 2.2, 0, 0, 0.14);
      W.bz = 0.1; W.rk = 0.016; W.fs = 0.022;
    }
    flash.visible = false;
    W.turret = turret; W.gun = gun; W.barrel = barrel; W.flash = flash;
  }
  function updateWeapon(t, dt) {
    if (!W.turret) return;
    if (W.auto) { W.yaw = 0.6 * Math.sin(t * 0.4); W.pitch = 0.05 + 0.04 * Math.sin(t * 0.7); }   // vigila sola mientras no se apunte a mano
    W.recoil = Math.max(0, W.recoil - dt * 8);
    var r = W.recoil;
    W.turret.rotation.y = W.yaw;
    W.gun.rotation.x = -(W.pitch + r * 0.06);
    W.barrel.position.z = W.bz - r * W.rk;
    W.flash.visible = r > 0.72;
    if (W.flash.visible) { var fs = 0.8 + 0.4 * Math.sin(t * 90); W.flash.scale.set(W.fs * fs, W.fs * fs, W.fs * 2.2 * fs); }
  }

  /* ---------- Marchas ---------- */
  var GAITS = {
    walk: { freq: 1.25, duty: 0.75, S: 0.16, H: 0.05, off: { RL: 0.0, FL: 0.25, RR: 0.5, FR: 0.75 }, bob: 0.003, pitch: 0.02, roll: 0.026, yaw: 0.03 },
    trot: { freq: 2.4, duty: 0.5, S: 0.2, H: 0.07, off: { FL: 0.0, RR: 0.0, FR: 0.5, RL: 0.5 }, bob: 0.006, pitch: 0.012, roll: 0.01, yaw: 0.012 }
  };
  var target = 'idle', current = 'idle', amp = 0, phase = 0, lastT = null;

  function easeSwing(u) { return u - Math.sin(TAU * u) / TAU; }   // avance suave del pie en el aire

  function update(t) {
    var dt = lastT == null ? 0 : Math.max(0, Math.min(0.1, t - lastT));
    lastT = t;
    // transición de estados: primero se detiene la marcha actual y luego arranca la nueva
    if (target !== current) {
      amp = Math.max(0, amp - dt * 4);
      if (amp < 0.02) { current = target; }
    } else if (current !== 'idle') {
      amp = Math.min(1, amp + dt * 3);
    } else {
      amp = Math.max(0, amp - dt * 4);
    }
    var g = GAITS[current] || GAITS.trot;
    if (current !== 'idle') phase = (phase + dt * g.freq) % 1;

    // movimiento del cuerpo
    var breath = Math.sin(t * 2.0), look = Math.sin(t * 0.55), idleW = 1 - amp;
    var bob = amp * g.bob * Math.sin(TAU * 2 * phase) + idleW * 0.0013 * breath;
    var pitch = amp * g.pitch * Math.sin(TAU * 2 * phase + P / 2) + idleW * 0.006 * Math.sin(t * 1.3);
    var roll = amp * g.roll * Math.sin(TAU * phase);
    var yaw = amp * g.yaw * Math.sin(TAU * phase + 0.6);
    trunk.position.y = H0 + FOOT_R + bob;
    trunk.rotation.set(pitch, yaw, roll);

    // el domo del LiDAR gira y el indicador bajo las cámaras pulsa (la cabeza no se mueve)
    lidarSpin.rotation.y = t * 4.0;
    if (!ghost) {
      mats.pulse.emissiveIntensity = 0.3 + 1.0 * (0.5 + 0.5 * Math.sin(t * 3.2));
      mats.muzzle.emissiveIntensity = 0.4 + 2.2 * W.recoil;
    }
    updateWeapon(t, dt);
    // patas: la trayectoria del pie se calcula en el marco de la cadera y se resuelve con IK
    for (var i = 0; i < legList.length; i++) {
      var leg = legList[i], zoff = 0, lift = 0;
      if (amp > 0.001) {
        var p = (phase + (g.off[leg.name] || 0)) % 1, S = g.S * amp, H = g.H * amp;
        if (p < g.duty) { zoff = S * (0.5 - p / g.duty); }
        else { var u = (p - g.duty) / (1 - g.duty); zoff = S * (-0.5 + easeSwing(u)); lift = H * 0.5 * (1 - Math.cos(TAU * u)); }
      }
      var dy = -(H0 + bob - pitch * leg.sz * HIP_Z + roll * leg.sx * HIP_X) + lift;     // compensa el movimiento del cuerpo para que el pie siga en el suelo
      solveLeg(leg, DZ0 + zoff, dy);
    }
    api.speed = current === 'idle' ? 0 : g.S * g.freq / g.duty * K * amp;
  }

  /* ---------- API ---------- */
  var api = {
    group: group,
    footprint: { w: (bb.max.x - bb.min.x) * K, d: (bb.max.z - bb.min.z) * K },
    height: HEIGHT_M / MPU,
    state: 'idle',
    speed: 0,
    version: VERSION,
    feet: [legs.FL.foot, legs.FR.foot, legs.RL.foot, legs.RR.foot],
    lidar: lidar,
    parts: { trunk: trunk, head: head, legs: legs, lidarSpin: lidarSpin },
    weapon: W.turret ? { turret: W.turret, gun: W.gun, barrel: W.barrel, flash: W.flash } : null,
    aim: function (yaw, pitch) { W.auto = false; W.yaw = yaw || 0; W.pitch = pitch || 0; },     // apunta a mano (radianes); desactiva la vigilancia automática
    setAutoAim: function (on) { W.auto = !!on; },
    fire: function () { if (W.turret) W.recoil = 1; },                                           // retroceso, fogonazo y brillo en la boca
    setState: function (name) {
      if (name !== 'idle' && !GAITS[name]) return;
      target = name;
      api.state = name;
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
    update: update
  };
  update(0);
  return api;
}
