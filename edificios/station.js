/**
 * Ágora: estación espacial procedural para Three.js (sin archivos externos).
 *
 * Estructura (eje vertical = Y):
 *  - Anillo habitable giratorio (radio 9) con ventanas, costillas y tira de luz interior.
 *  - Seis radios que unen el anillo con el cojinete del núcleo.
 *  - Núcleo central con cúpulas de observación, 6 módulos de laboratorio y planchas.
 *  - Puertos de atraque arriba y abajo, con luces de guía.
 *  - 4 alas solares con seguimiento (2 arriba, 2 abajo, giradas 90 grados).
 *  - Racimo de 4 tanques con propulsores de mantenimiento de órbita.
 *  - Mástil de comunicaciones con dos antenas giratorias.
 *
 * Uso:
 *   const station = createStation(THREE, { accent: 0x1fd1b5, spin: 0.05 });
 *   scene.add(station.group);
 *   // en tu bucle de juego (thrust de 0 a 1 enciende los propulsores):
 *   station.update(clock.getElapsedTime(), thrust);
 *
 * Convenciones: arriba es +Y. Escala: 1 unidad = 6 m. Anillo de 119 m de diámetro,
 * alto total ~84 m, envergadura de paneles ~190 m.
 *
 * Expone:
 *   station.ring        grupo del anillo (gira solo; puedes leer su rotation.y)
 *   station.ports       [{ object, direction }] puertos de atraque, en este orden:
 *                       [0] y [1] hangares del anillo, [2] puerto superior, [3] puerto inferior.
 *                       Los del anillo son hijos de station.ring y giran con él; usa
 *                       object.getWorldPosition() para saber dónde están en cada momento.
 *   station.setAccent(hex)
 * Compatible con Three.js r128 o superior.
 */
function createStation(THREE, opts) {
  opts = opts || {};
  var P = Math.PI, TAU = P * 2;
  var spin = opts.spin != null ? opts.spin : 0.05;
  var colors = {
    hull: opts.hull != null ? opts.hull : 0xdfe5ec,
    accent: opts.accent != null ? opts.accent : 0x1fd1b5,
    dark: opts.dark != null ? opts.dark : 0x171e2b,
    glow: opts.glow != null ? opts.glow : 0x8fd8ff
  };

  var group = new THREE.Group();
  var ring = new THREE.Group();
  group.add(ring);

  /* ---------- Materiales ---------- */
  function solarTexture() {
    if (typeof document === 'undefined') return null;
    try {
      var cols = 4, rows = 6, cw = 64, ch = 48;
      var c = document.createElement('canvas');
      c.width = cols * cw; c.height = rows * ch;
      var g = c.getContext('2d');
      g.fillStyle = '#0d1f45';
      g.fillRect(0, 0, c.width, c.height);
      for (var i = 0; i < cols; i++) {
        for (var j = 0; j < rows; j++) {
          var x = i * cw, y = j * ch;
          var grad = g.createLinearGradient(x, y, x + cw, y + ch);
          grad.addColorStop(0, '#1d3d7c');
          grad.addColorStop(1, '#10285a');
          g.fillStyle = grad;
          g.fillRect(x + 3, y + 3, cw - 6, ch - 6);
          g.strokeStyle = 'rgba(150,190,255,0.35)';
          g.lineWidth = 1;
          for (var k = 1; k < 4; k++) {            // finas líneas de celdas
            g.beginPath(); g.moveTo(x + 3 + (cw - 6) * k / 4, y + 3); g.lineTo(x + 3 + (cw - 6) * k / 4, y + ch - 3); g.stroke();
          }
          g.beginPath(); g.moveTo(x + 3, y + ch / 2); g.lineTo(x + cw - 3, y + ch / 2); g.stroke();
        }
      }
      g.strokeStyle = '#c9d4e4'; g.lineWidth = 3;      // marcos entre celdas
      for (var a = 0; a <= cols; a++) { g.beginPath(); g.moveTo(a * cw, 0); g.lineTo(a * cw, c.height); g.stroke(); }
      for (var b = 0; b <= rows; b++) { g.beginPath(); g.moveTo(0, b * ch); g.lineTo(c.width, b * ch); g.stroke(); }
      var tex = new THREE.CanvasTexture(c);
      tex.anisotropy = 8;
      return tex;
    } catch (e) { return null; }
  }
  var solarMap = solarTexture();

  var mats = {
    hull: new THREE.MeshStandardMaterial({ color: colors.hull, metalness: 0.3, roughness: 0.4 }),
    spine: new THREE.MeshStandardMaterial({ color: 0x8f99a8, metalness: 0.6, roughness: 0.42 }),
    accent: new THREE.MeshStandardMaterial({ color: colors.accent, metalness: 0.25, roughness: 0.4 }),
    dark: new THREE.MeshStandardMaterial({ color: colors.dark, metalness: 0.7, roughness: 0.45, side: THREE.DoubleSide }),
    glass: new THREE.MeshStandardMaterial({
      color: 0x0b1d33, metalness: 0.9, roughness: 0.05,
      emissive: 0x0a3a5c, emissiveIntensity: 0.9, side: THREE.DoubleSide
    }),
    solar: new THREE.MeshStandardMaterial({
      color: solarMap ? 0xffffff : 0x1c3d73, map: solarMap || null,
      metalness: 0.55, roughness: 0.3
    }),
    window: new THREE.MeshBasicMaterial({ color: 0xffe3a0 }),
    strip: new THREE.MeshBasicMaterial({ color: 0x8ff7dc }),
    lamp: new THREE.MeshBasicMaterial({ color: 0xffb347 })
  };

  function glowMat(color, opacity) {
    return new THREE.MeshBasicMaterial({
      color: color, transparent: true, opacity: opacity,
      blending: THREE.AdditiveBlending, depthWrite: false
    });
  }

  function add(parent, geo, mat, x, y, z) {
    var m = new THREE.Mesh(geo, mat);
    m.position.set(x || 0, y || 0, z || 0);
    parent.add(m);
    return m;
  }

  var seed = 23;
  function rnd() {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  }

  // Coloca un objeto a un ángulo y radio, con su eje local Z apuntando hacia fuera del eje Y.
  function radial(obj, a, r, y) {
    obj.position.set(r * Math.cos(a), y, r * Math.sin(a));
    obj.rotation.y = P / 2 - a;
  }

  /* ---------- Geometrías suaves ---------- */
  function roundedBox(w, h, d, r, seg) {
    var g = new THREE.BoxGeometry(w, h, d, seg, seg, seg);
    var pos = g.attributes.position, nor = g.attributes.normal;
    var hx = w / 2 - r, hy = h / 2 - r, hz = d / 2 - r;
    var v = new THREE.Vector3(), inner = new THREE.Vector3(), n = new THREE.Vector3();
    for (var i = 0; i < pos.count; i++) {
      v.set(pos.getX(i), pos.getY(i), pos.getZ(i));
      inner.set(
        Math.max(-hx, Math.min(hx, v.x)),
        Math.max(-hy, Math.min(hy, v.y)),
        Math.max(-hz, Math.min(hz, v.z))
      );
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

  // Cápsula; por defecto con el eje en Z. Con alongY = true queda vertical.
  function capsule(r, len, seg, alongY) {
    var pts = [], n = 12, i, a;
    for (i = 0; i <= n; i++) {
      a = -P / 2 + (P / 2) * i / n;
      pts.push(new THREE.Vector2(Math.max(0, r * Math.cos(a)), -len / 2 + r * Math.sin(a)));
    }
    for (i = 0; i <= n; i++) {
      a = (P / 2) * i / n;
      pts.push(new THREE.Vector2(Math.max(0, r * Math.cos(a)), len / 2 + r * Math.sin(a)));
    }
    var g = new THREE.LatheGeometry(pts, seg);
    if (!alongY) g.rotateX(P / 2);
    return g;
  }

  // Sección de anillo con esquinas redondeadas, para revolucionar alrededor de Y.
  function ringProfile(rin, rout, h, rc, n) {
    var pts = [];
    function arc(cx, cy, a0, a1) {
      for (var i = 0; i <= n; i++) {
        var a = a0 + (a1 - a0) * i / n;
        pts.push(new THREE.Vector2(cx + rc * Math.cos(a), cy + rc * Math.sin(a)));
      }
    }
    arc(rout - rc, -h + rc, -P / 2, 0);
    pts.push(new THREE.Vector2(rout, 0));
    arc(rout - rc, h - rc, 0, P / 2);
    pts.push(new THREE.Vector2((rin + rout) / 2, h));
    arc(rin + rc, h - rc, P / 2, P);
    pts.push(new THREE.Vector2(rin, 0));
    arc(rin + rc, -h + rc, P, 3 * P / 2);
    pts.push(new THREE.Vector2((rin + rout) / 2, -h));
    pts.push(new THREE.Vector2(rout - rc, -h));
    return pts;
  }

  // Campo de cajas pequeñas (ventanas, planchas) en un solo InstancedMesh.
  function boxField(geo, mat, list) {
    var mesh = new THREE.InstancedMesh(geo, mat, list.length);
    var o = new THREE.Object3D();
    for (var i = 0; i < list.length; i++) {
      var e = list[i];
      o.position.set(e.x, e.y, e.z);
      o.rotation.y = e.ry || 0;
      o.scale.set(e.sx || 1, e.sy || 1, e.sz || 1);
      o.updateMatrix();
      mesh.setMatrixAt(i, o.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
    mesh.frustumCulled = false;   // las instancias están lejos del origen del mesh
    return mesh;
  }

  function horizontalTorus(R, tube, tubSeg, radSeg) {
    var g = new THREE.TorusGeometry(R, tube, tubSeg, radSeg);
    g.rotateX(P / 2);
    return g;
  }

  function dishMesh(parent, r, x, y, z, tiltZ) {
    var pivot = new THREE.Group();
    pivot.position.set(x, y, z);
    var d = add(pivot, new THREE.SphereGeometry(r, 28, 12, 0, TAU, 0, P / 2), mats.hull, 0, 0.05, 0);
    d.rotation.x = P;
    d.material = mats.hull.clone();
    d.material.side = THREE.DoubleSide;
    add(pivot, new THREE.CylinderGeometry(r * 0.08, r * 0.12, r * 0.5, 10), mats.dark, 0, -r * 0.1, 0);
    add(pivot, new THREE.CylinderGeometry(r * 0.02, r * 0.02, r * 0.8, 8), mats.dark, 0, r * 0.45, 0);
    pivot.rotation.z = tiltZ || 0;
    parent.add(pivot);
    return pivot;
  }

  /* ================= ANILLO GIRATORIO ================= */
  var RIN = 8.1, ROUT = 9.9, RH = 0.95;
  var ringHull = add(ring, new THREE.LatheGeometry(ringProfile(RIN, ROUT, RH, 0.45, 8), 160), mats.hull);

  // Bandas de acento y tira de luz interior
  [0.62, -0.62].forEach(function (y) {
    var t = add(ring, horizontalTorus(ROUT, 0.05, 8, 160), mats.accent, 0, y, 0);
  });
  add(ring, horizontalTorus(RIN - 0.02, 0.05, 8, 160), mats.strip, 0, 0, 0);

  // Costillas estructurales
  var ribGeo = roundedBox(0.4, 2.1, 2.0, 0.12, 6);
  for (var rb = 0; rb < 24; rb++) {
    var rbm = add(ring, ribGeo, mats.spine);
    radial(rbm, rb * TAU / 24, (RIN + ROUT) / 2, 0);
  }

  // Ventanas exteriores en tres filas
  var ringWin = [];
  for (var wa = 0; wa < 144; wa++) {
    if (wa % 6 === 0) continue;               // deja libre la zona de las costillas
    if (wa % 72 <= 3 || wa % 72 >= 69) continue;   // y la de los hangares
    var ang = wa * TAU / 144;
    [0.3, 0, -0.3].forEach(function (wy) {
      if (rnd() > 0.88) return;
      ringWin.push({ x: (ROUT + 0.01) * Math.cos(ang), y: wy, z: (ROUT + 0.01) * Math.sin(ang), ry: P / 2 - ang });
    });
  }
  ring.add(boxField(new THREE.BoxGeometry(0.16, 0.1, 0.05), mats.window, ringWin));

  // Hangares del anillo
  var ports = [];
  [0, P].forEach(function (a) {
    var h = new THREE.Group();
    radial(h, a, ROUT + 0.02, 0);
    add(h, roundedBox(2.4, 1.2, 0.1, 0.04, 6), mats.dark, 0, 0, 0);
    add(h, new THREE.BoxGeometry(2.1, 0.9, 0.04), mats.lamp, 0, 0, 0.06);
    ring.add(h);
    var o = new THREE.Object3D();
    o.position.set(h.position.x, h.position.y, h.position.z);
    ring.add(o);
    ports.push({ object: o, direction: new THREE.Vector3(Math.cos(a), 0, Math.sin(a)) });
  });

  // Luces de aviso del anillo
  var ringBeacons = [];
  [P / 4, 3 * P / 4, 5 * P / 4, 7 * P / 4].forEach(function (a, i) {
    var m = new THREE.MeshBasicMaterial({ color: 0xff4d4d });
    add(ring, new THREE.SphereGeometry(0.1, 12, 10), m, (ROUT + 0.05) * Math.cos(a), 1.0, (ROUT + 0.05) * Math.sin(a));
    ringBeacons.push({ mat: m, phase: i * 0.8 });
  });

  // Radios y collar del cojinete
  add(ring, horizontalTorus(1.9, 0.3, 20, 64), mats.hull, 0, 0, 0);
  add(ring, horizontalTorus(1.9, 0.05, 8, 64), mats.accent, 0, 0.32, 0);
  var spokeGeo = capsule(0.32, 5.6, 28);
  var spokeRingGeo = new THREE.TorusGeometry(0.34, 0.04, 10, 28);
  for (var sp = 0; sp < 6; sp++) {
    var spoke = new THREE.Group();
    radial(spoke, sp * TAU / 6, 0, 0);
    add(spoke, spokeGeo, mats.spine, 0, 0, 5.05);
    [3.2, 5.05, 6.9].forEach(function (z) { add(spoke, spokeRingGeo, mats.accent, 0, 0, z); });
    ring.add(spoke);
  }

  /* ================= NÚCLEO ================= */
  add(group, capsule(1.45, 8, 56, true), mats.hull, 0, 0, 0);

  // Bandas de acento y anillos de cojinete
  [0.55, -0.55].forEach(function (y) { add(group, horizontalTorus(1.46, 0.07, 8, 56), mats.accent, 0, y, 0); });
  [1.0, -1.0].forEach(function (y) { add(group, horizontalTorus(1.47, 0.04, 8, 56), mats.spine, 0, y, 0); });

  // Cuellos y puertos de atraque
  var ringFlangeGeo = new THREE.LatheGeometry(ringProfile(0.55, 1.05, 0.15, 0.1, 5), 48);
  var dockPorts = [];
  [1, -1].forEach(function (s) {
    var neck = add(group, new THREE.CylinderGeometry(s > 0 ? 0.7 : 0.9, s > 0 ? 0.9 : 0.7, 1.5, 40), mats.spine, 0, s * 5.75, 0);
    add(group, ringFlangeGeo, mats.hull, 0, s * 6.55, 0);
    add(group, horizontalTorus(1.06, 0.035, 8, 48), mats.accent, 0, s * 6.55, 0);
    var hole = new THREE.CircleGeometry(0.56, 32);
    hole.rotateX(-s * P / 2);
    add(group, hole, mats.dark, 0, s * 6.5, 0);
    var target = new THREE.CircleGeometry(0.16, 24);
    target.rotateX(-s * P / 2);
    add(group, target, mats.accent, 0, s * 6.51, 0);

    // Luces de guía alrededor de la brida
    var lights = [];
    for (var li = 0; li < 14; li++) {
      var la = li * TAU / 14;
      lights.push({ x: 1.0 * Math.cos(la), y: s * 6.72, z: 1.0 * Math.sin(la), sx: 1, sy: 1, sz: 1 });
    }
    group.add(boxField(new THREE.BoxGeometry(0.07, 0.04, 0.07), mats.lamp, lights));

    var o = new THREE.Object3D();
    o.position.set(0, s * 6.75, 0);
    group.add(o);
    ports.push({ object: o, direction: new THREE.Vector3(0, s, 0) });
  });

  // Cúpulas de observación a los lados
  [1, -1].forEach(function (s) {
    var dome = add(group, new THREE.SphereGeometry(0.6, 32, 16, 0, TAU, 0, P / 2), mats.glass, s * 1.4, 3.2, 0);
    dome.rotation.z = -s * P / 2;
    var base = add(group, new THREE.TorusGeometry(0.62, 0.07, 10, 32), mats.accent, s * 1.42, 3.2, 0);
    base.rotation.y = P / 2;
  });

  // Ventanas y planchas en el casco del núcleo
  var coreWin = [];
  [3.5, 3.8, 1.2, -3.65, -3.95].forEach(function (wy) {
    for (var k = 0; k < 48; k++) {
      var a = k * TAU / 48;
      var nearDome = wy > 3.0 && Math.abs(Math.cos(a)) > 0.91;
      if (nearDome || rnd() > 0.85) continue;
      coreWin.push({ x: 1.465 * Math.cos(a), y: wy, z: 1.465 * Math.sin(a), ry: P / 2 - a });
    }
  });
  group.add(boxField(new THREE.BoxGeometry(0.14, 0.08, 0.05), mats.window, coreWin));

  var plates = [];
  for (var pl = 0; pl < 56; pl++) {
    var pa = rnd() * TAU, py = (rnd() * 2 - 1) * 3.8;
    if (Math.abs(py) < 0.75) continue;
    plates.push({
      x: 1.46 * Math.cos(pa), y: py, z: 1.46 * Math.sin(pa), ry: P / 2 - pa,
      sx: 0.35 + rnd() * 0.5, sy: 0.2 + rnd() * 0.3, sz: 0.06
    });
  }
  group.add(boxField(roundedBox(1, 1, 1, 0.12, 4), mats.spine, plates));

  /* ---------- Módulos de laboratorio ---------- */
  function labModule(a, y, r, len, centerR) {
    var m = new THREE.Group();
    radial(m, a, 0, y);
    add(m, capsule(r, len, 36), mats.hull, 0, 0, centerR);
    add(m, new THREE.TorusGeometry(r + 0.02, 0.05, 10, 36), mats.accent, 0, 0, centerR);
    for (var i = -1; i <= 1; i++) {
      add(m, new THREE.BoxGeometry(0.1, 0.05, 0.16), mats.window, 0, r + 0.005, centerR + i * len * 0.3);
    }
    var tip = add(m, new THREE.CylinderGeometry(r * 0.45, r * 0.55, 0.2, 20), mats.spine, 0, 0, centerR + len / 2 + r + 0.05);
    tip.rotation.x = P / 2;
    group.add(m);
  }
  [30, 150, 270].forEach(function (d) { labModule(d * P / 180, -2.6, 0.8, 3.0, 3.2); });
  [90, 210, 330].forEach(function (d) { labModule(d * P / 180, 2.1, 0.6, 2.2, 2.9); });

  /* ================= ALAS SOLARES ================= */
  var panelGeo = roundedBox(4.0, 0.07, 6.0, 0.03, 6);
  var boomGeo = new THREE.CylinderGeometry(0.1, 0.1, 14.8, 14);
  boomGeo.rotateZ(P / 2);
  var yokeGeo = new THREE.CylinderGeometry(0.28, 0.28, 0.4, 18);
  yokeGeo.rotateZ(P / 2);
  var wings = [];
  var navLights = [];

  function buildWing(sign, y, rotY, tipColor, phase) {
    var base = new THREE.Group();
    base.position.y = y;
    base.rotation.y = rotY;
    var pivot = new THREE.Group();
    base.add(pivot);
    add(base, yokeGeo, mats.accent, sign * 1.3, 0, 0);
    add(pivot, boomGeo, mats.spine, sign * 8.6, 0, 0);
    for (var i = 0; i < 3; i++) {
      var px = sign * (4.8 + i * 4.4);
      add(pivot, panelGeo, mats.solar, px, 0, 0);
      add(pivot, new THREE.BoxGeometry(0.12, 0.1, 6.1), mats.hull, px - sign * 2.0, 0, 0);   // larguero
    }
    add(pivot, new THREE.SphereGeometry(0.14, 14, 10), mats.accent, sign * 16.05, 0, 0);
    var m = new THREE.MeshBasicMaterial({ color: tipColor });
    add(base, new THREE.SphereGeometry(0.09, 12, 10), m, sign * 16.2, 0.12, 0);
    navLights.push({ mat: m, on: tipColor, mode: 'slow', phase: phase });
    group.add(base);
    wings.push({ pivot: pivot, phase: phase });
  }
  buildWing(1, 4.4, 0, 0x38e07b, 0);
  buildWing(-1, 4.4, 0, 0xff3b3b, 1.7);
  buildWing(1, -4.4, P / 2, 0xffffff, 3.1);
  buildWing(-1, -4.4, P / 2, 0xffffff, 4.6);

  /* ================= TANQUES Y PROPULSORES ================= */
  var tankGeo = capsule(0.45, 1.8, 32, true);
  var tankRing = new THREE.TorusGeometry(0.47, 0.04, 10, 32);
  tankRing.rotateX(P / 2);
  var bellPts = [[0.2, 0], [0.22, 0.1], [0.27, 0.25], [0.35, 0.45], [0.45, 0.65], [0.52, 0.75]]
    .map(function (p) { return new THREE.Vector2(p[0], p[1]); });
  var bellGeo = new THREE.LatheGeometry(bellPts, 28);
  bellGeo.rotateX(P);                         // extremo ancho hacia -Y
  var thrusters = [];
  var BS = 0.45;
  [45, 135, 225, 315].forEach(function (d, i) {
    var a = d * P / 180, tx = 1.55 * Math.cos(a), tz = 1.55 * Math.sin(a);
    add(group, tankGeo, mats.hull, tx, -5.7, tz);
    [-5.2, -6.2].forEach(function (yy) { add(group, tankRing, mats.accent, tx, yy, tz); });
    add(group, new THREE.CylinderGeometry(0.13, 0.17, 0.2, 14), mats.dark, tx, -7.1, tz);
    add(group, bellGeo, mats.dark, tx, -7.2, tz).scale.set(BS, BS, BS);
    var baseY = -7.2 - 0.75 * BS;
    add(group, new THREE.CircleGeometry(0.2 * BS, 16), glowMat(0xffffff, 0.9), tx, -7.2 - 0.02, tz).rotation.x = P / 2;
    function cone(r, len, color, opacity) {
      var g = new THREE.ConeGeometry(r, len, 18, 1, true);
      g.translate(0, len / 2, 0);
      g.rotateX(P);
      return add(group, g, glowMat(color, opacity), tx, baseY, tz);
    }
    thrusters.push({
      outer: cone(0.5 * BS, 1.3, colors.glow, 0.45),
      inner: cone(0.28 * BS, 0.8, 0xffffff, 0.85),
      phase: i * 1.4
    });
  });
  // Soportes entre tanques y núcleo
  [45, 135, 225, 315].forEach(function (d) {
    var a = d * P / 180;
    var st = new THREE.Group();
    radial(st, a, 0, -4.9);
    add(st, new THREE.CylinderGeometry(0.06, 0.06, 1.2, 10), mats.spine, 0, 0, 0.9).rotation.x = P / 2;
    group.add(st);
  });

  /* ================= MÁSTIL DE COMUNICACIONES ================= */
  add(group, new THREE.CylinderGeometry(0.035, 0.05, 3.2, 10), mats.dark, -1.05, 6.3, 0.6);
  add(group, new THREE.SphereGeometry(0.07, 12, 10), mats.accent, -1.05, 7.95, 0.6);
  var dishA = dishMesh(group, 0.4, -1.05, 6.7, 0.6, -0.4);
  var dishB = dishMesh(group, 0.28, -1.05, 7.4, 0.6, 0.5);
  var mastBeacon = new THREE.MeshBasicMaterial({ color: 0xffffff });
  add(group, new THREE.SphereGeometry(0.08, 12, 10), mastBeacon, -1.05, 8.05, 0.6);
  navLights.push({ mat: mastBeacon, on: 0xffffff, mode: 'strobe', phase: 0 });

  /* ================= ANIMACIÓN ================= */
  function update(t, thrust) {
    var th = Math.max(0, Math.min(1, thrust == null ? 0.0 : thrust));
    ring.rotation.y = t * spin;

    for (var i = 0; i < wings.length; i++) {
      wings[i].pivot.rotation.x = 0.25 * Math.sin(t * 0.15 + wings[i].phase);
    }
    dishA.rotation.y = t * 0.5;
    dishB.rotation.y = -t * 0.35;

    var len = 0.15 + th * 1.2, width = 0.4 + th * 0.8;
    for (var k = 0; k < thrusters.length; k++) {
      var e = thrusters[k];
      var f = 1 + 0.08 * Math.sin(t * 33 + e.phase);
      var vis = th > 0.01 ? 1 : 0;
      e.outer.visible = vis === 1; e.inner.visible = vis === 1;
      e.outer.scale.set(width, len * f, width);
      e.inner.scale.set(width, len * (2 - f), width);
      e.outer.material.opacity = 0.2 + th * 0.35;
    }

    for (var j = 0; j < navLights.length; j++) {
      var n = navLights[j];
      var on = n.mode === 'strobe' ? Math.sin(t * 7) > 0.85 : Math.sin(t * 2.6 + n.phase) > 0.4;
      n.mat.color.setHex(on ? n.on : 0x1a1010);
    }
    for (var b = 0; b < ringBeacons.length; b++) {
      var on2 = Math.sin(t * 3 + ringBeacons[b].phase) > 0.2;
      ringBeacons[b].mat.color.setHex(on2 ? 0xff4d4d : 0x2a1010);
    }
  }

  function setAccent(hex) {
    colors.accent = hex;
    mats.accent.color.setHex(hex);
  }

  return { group: group, ring: ring, ports: ports, update: update, setAccent: setAccent, materials: mats };
}
