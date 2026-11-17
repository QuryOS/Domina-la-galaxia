/**
 * Prospector: nave extractora de recursos para Three.js, sin archivos externos.
 *
 * Una nave minera de unos 64 m con:
 *  - 2 brazos grandes y 2 pequeños, articulados (hombro, codo y pinza de 3 dedos), que agarran
 *    rocas con cinemática inversa: tú le das un punto y el brazo lo alcanza.
 *  - Láser minero en un cardán bajo la proa, con rayo animado, punto de impacto y chispas.
 *  - Bodega de 4 cápsulas de carga con 12 luces que indican cuánto mineral llevas.
 *  - Cabina, escotilla de carga, mástil de prospección giratorio, focos y 5 motores.
 *
 * Modo demostración (activo por defecto): la nave agarra una roca, la sostiene, la rompe con el
 * láser y la suelta, en un ciclo de 30 s con otra roca grande al fondo. Para controlarla tú:
 *   ship.demo = false;
 *   ship.arms[0].target = new THREE.Vector3(1, -0.4, -10);   // punto que debe alcanzar la pinza
 *   ship.arms[0].grip = 1;                                    // 0 abierta, 1 cerrada
 *   ship.laser.target = new THREE.Vector3(0, 0, -15);         // null apaga el láser
 *   ship.laser.power = 1;                                     // 0 a 1
 *   ship.setCargo(0.5);                                       // 0 a 1
 * Los puntos están en coordenadas locales de la nave (usa ship.group.worldToLocal si los tienes
 * en el mundo). Con target = null el brazo vuelve a su postura de reposo.
 *
 * Uso:
 *   const ship = createProspector(THREE, { accent: 0xff7a1a });
 *   scene.add(ship.group);
 *   ship.update(clock.getElapsedTime(), throttle);   // throttle de 0 a 1
 *
 * Convenciones: nariz hacia -Z, arriba +Y, derecha +X. Escala: 1 unidad = 4 m.
 * Eslora 17,5 u (70 m), ancho ~8,6 u, alto ~5 u.
 *
 * Expone:
 *   ship.arms     [{ target, grip, tip, reach }]  0 y 1 grandes (derecha, izquierda), 2 y 3 pequeños.
 *                 tip es un Object3D en la punta de la pinza (usa tip.getWorldPosition()).
 *                 reach es el alcance máximo desde el hombro.
 *   ship.laser    { target, power, muzzle }  muzzle es el Object3D de la boca del láser
 *   ship.rocks    [Mesh x2]  rocas de la demostración (puedes ocultarlas con visible = false)
 *   ship.demo     true / false
 *   ship.setCargo(f), ship.setAccent(hex)
 * Compatible con Three.js r128 o superior.
 */
function createProspector(THREE, opts) {
  opts = opts || {};
  var P = Math.PI, TAU = P * 2;
  var colors = {
    hull: opts.hull != null ? opts.hull : 0xd2d6dc,
    accent: opts.accent != null ? opts.accent : 0xff7a1a,
    dark: opts.dark != null ? opts.dark : 0x151b27,
    glow: opts.glow != null ? opts.glow : 0x62d6ff,
    beam: opts.beam != null ? opts.beam : 0xff5a2a,
    ore: opts.ore != null ? opts.ore : 0x33ffcc
  };

  var group = new THREE.Group();

  /* ---------- Materiales ---------- */
  function hazardTexture() {
    if (typeof document === 'undefined') return null;
    try {
      var c = document.createElement('canvas');
      c.width = 32; c.height = 32;
      var g = c.getContext('2d');
      g.fillStyle = '#f2c200'; g.fillRect(0, 0, 32, 32);
      g.strokeStyle = '#15181f'; g.lineWidth = 10;
      [0, 32, 64].forEach(function (k) { g.beginPath(); g.moveTo(-8, k + 8); g.lineTo(k + 8, -8); g.stroke(); });
      var tex = new THREE.CanvasTexture(c);
      tex.wrapS = THREE.RepeatWrapping; tex.wrapT = THREE.RepeatWrapping;
      tex.repeat.set(4, 1);
      tex.anisotropy = 8;
      return tex;
    } catch (e) { return null; }
  }
  var hazMap = hazardTexture();

  var mats = {
    hull: new THREE.MeshStandardMaterial({ color: colors.hull, metalness: 0.4, roughness: 0.42 }),
    plate: new THREE.MeshStandardMaterial({ color: 0x6d788a, metalness: 0.6, roughness: 0.5 }),
    steel: new THREE.MeshStandardMaterial({ color: 0x8892a2, metalness: 0.65, roughness: 0.42 }),
    accent: new THREE.MeshStandardMaterial({ color: colors.accent, metalness: 0.3, roughness: 0.42 }),
    dark: new THREE.MeshStandardMaterial({ color: colors.dark, metalness: 0.7, roughness: 0.5, side: THREE.DoubleSide }),
    hazard: new THREE.MeshStandardMaterial({ color: hazMap ? 0xffffff : 0xf2c200, map: hazMap || null, metalness: 0.2, roughness: 0.6 }),
    glass: new THREE.MeshStandardMaterial({
      color: 0x0b1d33, metalness: 0.9, roughness: 0.05,
      emissive: 0x0a3a5c, emissiveIntensity: 0.9
    }),
    crystal: new THREE.MeshStandardMaterial({
      color: 0x401008, metalness: 0.2, roughness: 0.2,
      emissive: colors.beam, emissiveIntensity: 0.4
    }),
    rock: new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.05, roughness: 0.95 }),
    window: new THREE.MeshBasicMaterial({ color: 0xffe3a0 }),
    lamp: new THREE.MeshBasicMaterial({ color: 0xffe9b8 })
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
  var seed = 97;
  function rnd() {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  }

  /* ---------- Geometrías ---------- */
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

  // Cápsula con el eje en Z; con axisX = true queda a lo largo de X.
  function capsule(r, len, seg, axisX) {
    var pts = [], n = 10, i, a;
    for (i = 0; i <= n; i++) {
      a = -P / 2 + (P / 2) * i / n;
      pts.push(new THREE.Vector2(Math.max(0, r * Math.cos(a)), -len / 2 + r * Math.sin(a)));
    }
    for (i = 0; i <= n; i++) {
      a = (P / 2) * i / n;
      pts.push(new THREE.Vector2(Math.max(0, r * Math.cos(a)), len / 2 + r * Math.sin(a)));
    }
    var g = new THREE.LatheGeometry(pts, seg);
    g.rotateX(P / 2);
    if (axisX) g.rotateY(P / 2);
    return g;
  }

  function horizontalTorus(R, tube, ts, rs) {
    var g = new THREE.TorusGeometry(R, tube, ts, rs);
    g.rotateX(P / 2);
    return g;
  }

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
    mesh.frustumCulled = false;
    return mesh;
  }

  /* ---------- Casco oval ---------- */
  var SX = 1.25, SY = 0.8;
  var RZ = [[-8.3, 0], [-8.0, 0.4], [-7.2, 0.9], [-5.5, 1.5], [-3, 1.9], [0, 2.1], [3, 2.1], [6, 1.9], [8, 1.5], [9, 0.9], [9.2, 0]];
  function hullR(z) {
    if (z <= RZ[0][0]) return 0;
    for (var i = 1; i < RZ.length; i++) {
      if (z <= RZ[i][0]) {
        var a = RZ[i - 1], b = RZ[i];
        return a[1] + (b[1] - a[1]) * (z - a[0]) / (b[0] - a[0]);
      }
    }
    return 0;
  }
  function topY(z, x) {
    var r = hullR(z), q = 1 - Math.pow((x || 0) / (SX * r || 1), 2);
    return SY * r * Math.sqrt(Math.max(0, q));
  }
  function surfX(z, y) {
    var r = hullR(z), q = 1 - Math.pow(y / (SY * r || 1), 2);
    return SX * r * Math.sqrt(Math.max(0, q));
  }
  function sideRy(s, z, y) {
    var sl = (surfX(z + 0.1, y) - surfX(z - 0.1, y)) / 0.2;
    return s > 0 ? Math.atan2(1, -sl) : Math.atan2(-1, -sl);
  }

  var hp = RZ.slice().reverse().map(function (p) { return new THREE.Vector2(Math.max(0.001, p[1]), -p[0]); });
  var hullPts = new THREE.SplineCurve(hp).getPoints(100).map(function (p) {
    return new THREE.Vector2(Math.max(0.001, p.x), p.y);
  });
  var hullGeo = new THREE.LatheGeometry(hullPts, 64);
  hullGeo.rotateX(-P / 2);
  add(group, hullGeo, mats.hull).scale.set(SX, SY, 1);

  // Collar, franjas y quilla
  var collar = add(group, new THREE.TorusGeometry(hullR(-6.2) + 0.02, 0.1, 10, 56), mats.accent, 0, 0, -6.2);
  collar.scale.set(SX, SY, 1);
  for (var sz = -4.5; sz <= 7; sz += 2.3) {
    add(group, new THREE.TorusGeometry(hullR(sz) + 0.012, 0.03, 6, 56), mats.dark, 0, 0, sz).scale.set(SX, SY, 1);
  }
  var stripe = [], keelList = [];
  for (var tz = -6; tz <= 8.5; tz += 1.0) {
    var tr = hullR(tz);
    [1, -1].forEach(function (s) {
      stripe.push({ x: s * (tr * SX * Math.cos(0.3) + 0.02), y: tr * SY * Math.sin(0.3), z: tz });
    });
    keelList.push({ x: 0, y: -tr * SY - 0.02, z: tz });
  }
  group.add(boxField(new THREE.BoxGeometry(0.1, 0.12, 1.05), mats.accent, stripe));
  group.add(boxField(roundedBox(0.5, 0.16, 1.05, 0.06, 3), mats.dark, keelList));

  /* ---------- Cabina ---------- */
  var cabY = topY(-4.6, 0);
  add(group, roundedBox(2.2, 0.5, 3.0, 0.2, 8), mats.hull, 0, cabY + 0.05, -4.4);
  var canopy = add(group, new THREE.SphereGeometry(1, 32, 20), mats.glass, 0, cabY + 0.35, -4.9);
  canopy.scale.set(0.95, 0.62, 1.5);
  add(group, new THREE.TorusGeometry(0.97, 0.04, 8, 36), mats.accent, 0, cabY + 0.3, -4.0).scale.set(1, 0.66, 1);
  add(group, new THREE.BoxGeometry(0.05, 0.05, 2.2), mats.plate, 0, cabY + 0.95, -4.9);

  /* ---------- Bodega: 4 cápsulas de carga ---------- */
  var podGeo = capsule(1.0, 5.4, 32);
  var clampGeo = new THREE.TorusGeometry(1.03, 0.07, 8, 32);
  var ringStruts = [];
  var oreLamps = [];
  var pods = [[1, 1], [-1, 1], [1, -1], [-1, -1]];
  pods.forEach(function (q) {
    var px = 2.4 * q[0], py = 1.3 * q[1];
    add(group, podGeo, mats.hull, px, py, 5.6);
    [3.2, 5.6, 8.0].forEach(function (z) { add(group, clampGeo, mats.accent, px, py, z); });
    // Puntales hacia el casco
    var br = add(group, roundedBox(0.3, 0.3, 4.6, 0.1, 4), mats.plate, px * 0.62, py * 0.72, 5.0);
    // Luces de mineral en la cara exterior
    var ox = q[0] * 0.7071, oy = q[1] * 0.7071;
    [3.8, 5.6, 7.4].forEach(function (z) {
      var m = new THREE.MeshBasicMaterial({ color: 0x0a2a24 });
      var lamp = add(group, new THREE.BoxGeometry(0.34, 0.34, 0.5), m, px + ox * 1.0, py + oy * 1.0, z);
      lamp.rotation.z = Math.atan2(oy, ox) - P / 2;
      oreLamps.push(m);
    });
  });
  // Escotilla de carga dorsal
  var hatchY = topY(1.5, 0) + 0.03;
  add(group, roundedBox(2.2, 0.1, 3.0, 0.04, 4), mats.dark, 0, hatchY, 1.5);
  add(group, roundedBox(2.5, 0.08, 3.3, 0.04, 4), mats.hazard, 0, hatchY - 0.02, 1.5);

  /* ---------- Motores ---------- */
  var bellPts = [[0.2, 0], [0.22, 0.1], [0.27, 0.25], [0.35, 0.45], [0.45, 0.65], [0.52, 0.75]]
    .map(function (p) { return new THREE.Vector2(p[0], p[1]); });
  var bellGeo = new THREE.LatheGeometry(bellPts, 32);
  bellGeo.rotateX(P / 2);
  var engines = [];
  var flameLight = new THREE.PointLight(colors.glow, 1.6, 20);
  flameLight.position.set(0, 0, 13);
  group.add(flameLight);

  function buildEngine(x, y, z, s, flameLen) {
    add(group, bellGeo, mats.dark, x, y, z).scale.set(s, s, s);
    add(group, new THREE.TorusGeometry(0.5 * s, 0.05 * s, 8, 28), mats.accent, x, y, z - 0.05);
    add(group, new THREE.CircleGeometry(0.2 * s, 24), glowMat(0xffffff, 0.95), x, y, z + 0.05);
    var baseZ = z + 0.75 * s;
    function cone(r, len, color, op) {
      var g = new THREE.ConeGeometry(r, len, 20, 1, true);
      g.translate(0, len / 2, 0);
      g.rotateX(P / 2);
      return add(group, g, glowMat(color, op), x, y, baseZ);
    }
    engines.push({
      outer: cone(0.5 * s, flameLen, colors.glow, 0.4),
      inner: cone(0.28 * s, flameLen * 0.62, 0xffffff, 0.85),
      phase: engines.length * 1.4, len: flameLen
    });
  }
  buildEngine(0, 0, 9.0, 1.1, 3.4);
  pods.forEach(function (q) { buildEngine(2.4 * q[0], 1.3 * q[1], 9.2, 0.7, 2.2); });

  /* ---------- Láser minero ---------- */
  var LP = { x: 0, y: -1.35, z: -6.6 };           // pivote del cardán
  var laserBase = new THREE.Group();
  laserBase.position.set(LP.x, LP.y, LP.z);
  group.add(laserBase);
  add(laserBase, horizontalTorus(0.62, 0.09, 10, 36), mats.accent, 0, 0.35, 0);
  add(laserBase, roundedBox(1.0, 0.5, 1.0, 0.2, 6), mats.plate, 0, 0.2, 0);
  var laserYaw = new THREE.Group();
  laserBase.add(laserYaw);
  var laserPitch = new THREE.Group();
  laserYaw.add(laserPitch);
  add(laserPitch, new THREE.SphereGeometry(0.46, 24, 16), mats.hull, 0, 0, 0);
  var barrel = add(laserPitch, new THREE.CylinderGeometry(0.2, 0.26, 1.9, 20), mats.dark, 0, 0, -1.0);
  barrel.rotation.x = P / 2;
  [-0.5, -1.0, -1.5].forEach(function (z) {
    add(laserPitch, new THREE.TorusGeometry(0.27, 0.04, 8, 24), mats.accent, 0, 0, z);
  });
  var lens = add(laserPitch, new THREE.TorusGeometry(0.28, 0.07, 10, 28), mats.steel, 0, 0, -1.95);
  var crystal = add(laserPitch, new THREE.SphereGeometry(0.17, 18, 12), mats.crystal, 0, 0, -1.8);
  var muzzle = new THREE.Object3D();
  muzzle.position.set(0, 0, -2.0);
  laserPitch.add(muzzle);

  var beam = new THREE.Group();
  beam.position.set(0, 0, -2.0);
  laserPitch.add(beam);
  var beamGeo = new THREE.CylinderGeometry(1, 1, 1, 14, 1, true);
  beamGeo.rotateX(P / 2);
  beamGeo.translate(0, 0, -0.5);                  // de z = 0 a z = -1
  var beamGlow = add(beam, beamGeo, glowMat(colors.beam, 0.4));
  var beamCore = add(beam, beamGeo, glowMat(0xfff0d0, 0.95));
  beam.visible = false;

  var impact = new THREE.Group();
  impact.visible = false;
  group.add(impact);
  var impactGlow = add(impact, new THREE.SphereGeometry(0.5, 16, 12), glowMat(colors.beam, 0.6));
  var impactCore = add(impact, new THREE.SphereGeometry(0.22, 12, 10), glowMat(0xfff0d0, 0.95));
  var sparks = [];
  var sparkGeo = new THREE.SphereGeometry(0.06, 6, 5);
  var sparkMat = glowMat(0xffc070, 0.95);
  for (var si = 0; si < 14; si++) sparks.push(add(impact, sparkGeo, sparkMat));
  var impactLight = new THREE.PointLight(colors.beam, 1.5, 12);
  impact.add(impactLight);

  /* ---------- Brazos articulados ---------- */
  var armDefs = [
    { S: [2.7, 0.2, -2.5], L1: 4.4, L2: 4.2, th: 1.0, rest: [1.6, -0.5, -8.8] },
    { S: [-2.7, 0.2, -2.5], L1: 4.4, L2: 4.2, th: 1.0, rest: [-1.6, -0.5, -8.8] },
    { S: [1.5, -1.35, -4.8], L1: 2.6, L2: 2.4, th: 0.6, rest: [0.9, -1.5, -8.0] },
    { S: [-1.5, -1.35, -4.8], L1: 2.6, L2: 2.4, th: 0.6, rest: [-0.9, -1.5, -8.0] }
  ];
  var arms = [];
  armDefs.forEach(function (d, ai) {
    var th = d.th;
    var root = new THREE.Group();
    root.position.set(d.S[0], d.S[1], d.S[2]);
    group.add(root);
    // Alojamiento del hombro
    var sgn = d.S[0] > 0 ? 1 : -1;
    add(root, roundedBox(1.5 * th + 0.2, 1.3 * th, 1.8 * th, 0.35 * th, 8), mats.hull, -0.15 * sgn * th, 0, 0);
    add(root, new THREE.BoxGeometry(1.2 * th, 0.06, 0.5 * th), mats.hazard, -0.15 * sgn * th, 0.62 * th, -0.4 * th);
    var yawG = new THREE.Group();
    root.add(yawG);
    add(yawG, new THREE.SphereGeometry(0.5 * th, 20, 14), mats.dark, 0, 0, 0);
    var sh = new THREE.Group();
    yawG.add(sh);
    // Brazo superior
    add(sh, capsule(0.3 * th, d.L1 - 0.6 * th, 20, true), mats.hull, d.L1 / 2, 0, 0);
    add(sh, capsule(0.12 * th, d.L1 * 0.7, 10, true), mats.steel, d.L1 * 0.45, 0.42 * th, 0);
    [0.25, 0.55, 0.8].forEach(function (f) {
      var ring = add(sh, new THREE.TorusGeometry(0.33 * th, 0.045 * th, 8, 20), mats.accent, d.L1 * f, 0, 0);
      ring.rotation.y = P / 2;
    });
    var el = new THREE.Group();
    el.position.x = d.L1;
    sh.add(el);
    add(el, new THREE.SphereGeometry(0.4 * th, 18, 12), mats.dark, 0, 0, 0);
    add(el, capsule(0.24 * th, d.L2 - 0.5 * th, 18, true), mats.hull, d.L2 / 2, 0, 0);
    add(el, capsule(0.1 * th, d.L2 * 0.6, 10, true), mats.steel, d.L2 * 0.5, 0.35 * th, 0);
    var ring2 = add(el, new THREE.TorusGeometry(0.27 * th, 0.04 * th, 8, 18), mats.accent, d.L2 * 0.5, 0, 0);
    ring2.rotation.y = P / 2;

    // Pinza de 3 dedos
    var wrist = new THREE.Group();
    wrist.position.x = d.L2;
    el.add(wrist);
    add(wrist, new THREE.SphereGeometry(0.26 * th, 14, 10), mats.dark, 0, 0, 0);
    add(wrist, roundedBox(0.4 * th, 0.4 * th, 0.4 * th, 0.12 * th, 4), mats.plate, 0.22 * th, 0, 0);
    var fingers = [];
    for (var k = 0; k < 3; k++) {
      var fg = new THREE.Group();
      fg.position.x = 0.35 * th;
      fg.rotation.x = k * TAU / 3;
      wrist.add(fg);
      var f1 = new THREE.Group();
      f1.position.y = 0.22 * th;
      fg.add(f1);
      add(f1, capsule(0.075 * th, 0.55 * th, 10, true), mats.steel, 0.3 * th, 0, 0);
      var f2 = new THREE.Group();
      f2.position.x = 0.6 * th;
      f1.add(f2);
      add(f2, new THREE.SphereGeometry(0.07 * th, 8, 6), mats.dark, 0, 0, 0);
      add(f2, capsule(0.06 * th, 0.42 * th, 10, true), mats.accent, 0.26 * th, 0, 0);
      var tipF = add(f2, new THREE.ConeGeometry(0.06 * th, 0.2 * th, 8), mats.dark, 0.55 * th, 0, 0);
      tipF.rotation.z = -P / 2;
      fingers.push({ f1: f1, f2: f2 });
    }
    var tip = new THREE.Object3D();
    tip.position.x = d.L2 + 1.0 * th;
    el.add(tip);

    arms.push({
      target: null, grip: 0, tip: tip, reach: d.L1 + d.L2 + 1.0 * th,
      _S: d.S, _L1: d.L1, _L2: d.L2, _claw: 1.0 * th, _rest: d.rest,
      _yaw: yawG, _sh: sh, _el: el, _fingers: fingers,
      _cur: { x: d.rest[0], y: d.rest[1], z: d.rest[2] }, _grip: 0
    });
  });

  function poseArm(a, T) {
    var S = a._S;
    var dx = T.x - S[0], dy = T.y - S[1], dz = T.z - S[2];
    var dl = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1e-6;
    var reachTo = Math.max(dl - a._claw, 0.4);
    var wx = dx / dl * reachTo, wy = dy / dl * reachTo, wz = dz / dl * reachTo;
    var h = Math.sqrt(wx * wx + wz * wz);
    var D = Math.sqrt(h * h + wy * wy);
    var Dc = Math.min(a._L1 + a._L2 - 0.02, Math.max(Math.abs(a._L1 - a._L2) + 0.05, D));
    var cosA = (a._L1 * a._L1 + Dc * Dc - a._L2 * a._L2) / (2 * a._L1 * Dc);
    var angA = Math.acos(Math.max(-1, Math.min(1, cosA)));
    var cosB = (a._L1 * a._L1 + a._L2 * a._L2 - Dc * Dc) / (2 * a._L1 * a._L2);
    var angB = Math.acos(Math.max(-1, Math.min(1, cosB)));
    a._yaw.rotation.y = Math.atan2(-wz, wx);
    a._sh.rotation.z = Math.atan2(wy, h) + angA;
    a._el.rotation.z = -(P - angB);
  }

  /* ---------- Rocas de la demostración ---------- */
  function hash(i, j, k) {
    var h = Math.sin(i * 127.1 + j * 311.7 + k * 74.7) * 43758.5453;
    return h - Math.floor(h);
  }
  function vnoise(x, y, z) {
    var xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
    var xf = x - xi, yf = y - yi, zf = z - zi;
    var u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf), w = zf * zf * (3 - 2 * zf);
    function h(a, b, c) { return hash(xi + a, yi + b, zi + c); }
    var x00 = h(0, 0, 0) + (h(1, 0, 0) - h(0, 0, 0)) * u;
    var x10 = h(0, 1, 0) + (h(1, 1, 0) - h(0, 1, 0)) * u;
    var x01 = h(0, 0, 1) + (h(1, 0, 1) - h(0, 0, 1)) * u;
    var x11 = h(0, 1, 1) + (h(1, 1, 1) - h(0, 1, 1)) * u;
    var y0 = x00 + (x10 - x00) * v, y1 = x01 + (x11 - x01) * v;
    return y0 + (y1 - y0) * w;
  }
  function fbm(x, y, z) {
    var a = 0.5, s = 0, f = 1;
    for (var i = 0; i < 4; i++) { s += a * vnoise(x * f, y * f, z * f); f *= 2.03; a *= 0.5; }
    return s / 0.9375;
  }
  function weld(src) {
    var pos = src.attributes.position, idx = src.index;
    var count = idx ? idx.count : pos.count;
    var map = {}, verts = [], ind = [];
    for (var i = 0; i < count; i++) {
      var vi = idx ? idx.getX(i) : i;
      var x = pos.getX(vi), y = pos.getY(vi), z = pos.getZ(vi);
      var key = Math.round(x * 1e4) + ',' + Math.round(y * 1e4) + ',' + Math.round(z * 1e4);
      if (map[key] === undefined) { map[key] = verts.length / 3; verts.push(x, y, z); }
      ind.push(map[key]);
    }
    var g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    g.setIndex(ind);
    return g;
  }
  function makeRock(off) {
    var g = weld(new THREE.IcosahedronGeometry(1, 12));
    var pos = g.attributes.position;
    var col = new Float32Array(pos.count * 3);
    for (var i = 0; i < pos.count; i++) {
      var x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
      var l = Math.sqrt(x * x + y * y + z * z) || 1;
      var dx = x / l, dy = y / l, dz = z / l;
      var n = fbm(dx * 1.9 + off, dy * 1.9 + off * 0.7, dz * 1.9 + off * 1.3);
      var r = 1 + (n - 0.5) * 0.7 + (fbm(dx * 5 + off, dy * 5, dz * 5 + off) - 0.5) * 0.12;
      pos.setXYZ(i, dx * r * 1.0, dy * r * 0.8, dz * r * 0.9);
      var c = 0.2 + 0.2 * fbm(dx * 4 + 3, dy * 4 + 3, dz * 4 + off);
      var ore = fbm(dx * 2.6 + off, dy * 2.6, dz * 2.6 + 9);
      var m = Math.max(0, Math.min(1, (ore - 0.62) / 0.18)) * 0.6;
      col[i * 3] = c * 1.05 + (0.15 - c * 1.05) * m;
      col[i * 3 + 1] = c * 0.98 + (0.75 - c * 0.98) * m;
      col[i * 3 + 2] = c * 0.9 + (0.65 - c * 0.9) * m;
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.computeVertexNormals();
    return new THREE.Mesh(g, mats.rock);
  }
  var rockA = makeRock(3.7), rockB = makeRock(11.1);
  rockA.position.set(0, -0.4, -10.5);
  rockB.position.set(-9, 1.5, -19);
  rockB.scale.setScalar(2.3);
  group.add(rockA, rockB);
  var rocks = [rockA, rockB];

  /* ---------- Detalles del casco ---------- */
  // Mástil de prospección
  var mastY = topY(-0.2, 0);
  add(group, new THREE.CylinderGeometry(0.06, 0.1, 1.6, 10), mats.dark, 0, mastY + 0.7, -0.2);
  add(group, roundedBox(0.6, 0.3, 0.6, 0.12, 4), mats.hull, 0, mastY + 0.2, -0.2);
  var scanner = new THREE.Group();
  scanner.position.set(0, mastY + 1.45, -0.2);
  add(scanner, roundedBox(1.7, 0.06, 0.2, 0.03, 4), mats.plate, 0, 0, 0);
  add(scanner, new THREE.CylinderGeometry(0.08, 0.1, 0.2, 10), mats.dark, 0, -0.1, 0);
  add(scanner, horizontalTorus(0.5, 0.03, 8, 28), mats.accent, 0, -0.18, 0);
  group.add(scanner);
  var mastLight = new THREE.MeshBasicMaterial({ color: 0xffffff });
  add(group, new THREE.SphereGeometry(0.07, 10, 8), mastLight, 0, mastY + 1.7, -0.2);
  add(group, new THREE.CylinderGeometry(0.015, 0.03, 1.4, 6), mats.dark, 0.5, mastY + 0.8, 1.2);

  // Focos de proa
  var beamLamp = new THREE.ConeGeometry(1.3, 6, 16, 1, true);
  beamLamp.translate(0, -3, 0);
  beamLamp.rotateX(-P / 2);                        // el haz sale hacia -Z
  var lampBeamMat = glowMat(0xffefc8, 0.07);
  [1, -1].forEach(function (s) {
    var lamp = new THREE.Group();
    lamp.position.set(1.55 * s, 0.9, -5.6);
    lamp.rotation.y = s * -0.25;
    add(lamp, roundedBox(0.45, 0.3, 0.5, 0.1, 4), mats.hull, 0, 0, 0);
    add(lamp, new THREE.BoxGeometry(0.34, 0.2, 0.03), mats.lamp, 0, 0, -0.26);
    add(lamp, beamLamp, lampBeamMat, 0, 0, -0.27);
    group.add(lamp);
  });

  // Ventanas y planchas
  var wins = [];
  for (var wz = -5.5; wz <= 3; wz += 0.55) {
    [1, -1].forEach(function (s) {
      [0.25, 0].forEach(function (y) {
        if (rnd() > 0.82) return;
        wins.push({ x: (surfX(wz, y) + 0.02) * s, y: y, z: wz, ry: sideRy(s, wz, y) });
      });
    });
  }
  group.add(boxField(new THREE.BoxGeometry(0.2, 0.08, 0.04), mats.window, wins));
  var plates = [];
  for (var pl = 0; pl < 70; pl++) {
    var pz = -3 + rnd() * 11, px = (rnd() * 2 - 1) * 1.5;
    if (Math.abs(px) < 1.5 && pz > -0.5 && pz < 3.2) continue;       // escotilla y mástil
    var ph = topY(pz, px);
    if (ph < 0.2) continue;
    plates.push({ x: px, y: ph + 0.02, z: pz, sx: 0.25 + rnd() * 0.5, sy: 0.05 + rnd() * 0.06, sz: 0.25 + rnd() * 0.6 });
  }
  group.add(boxField(roundedBox(1, 1, 1, 0.14, 4), mats.plate, plates));

  // Luces de navegación
  var navLights = [];
  [1, -1].forEach(function (s) {
    var c = s > 0 ? 0x38e07b : 0xff3b3b;
    var m = new THREE.MeshBasicMaterial({ color: c });
    add(group, new THREE.SphereGeometry(0.1, 12, 10), m, 3.45 * s, 0, 3.4);
    navLights.push({ mat: m, on: c, fast: false });
  });
  navLights.push({ mat: mastLight, on: 0xffffff, fast: true });

  /* ---------- Estado y animación ---------- */
  var api = {};
  var laser = { target: null, power: 0, muzzle: muzzle };
  var cargo = 0.3, cargoShown = -1;
  var lastT = 0, cycleSeen = -1;
  var demoT = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
  var laserT = new THREE.Vector3();
  var beamDir = { x: 0, y: 0, z: -1 };

  function setCargo(f) { cargo = Math.max(0, Math.min(1, f)); }

  function smoothstep(a, b, x) {
    var t = Math.max(0, Math.min(1, (x - a) / (b - a)));
    return t * t * (3 - 2 * t);
  }

  function runDemo(t) {
    var T = 30, tc = t % T, cyc = Math.floor(t / T);
    if (cyc !== cycleSeen) { cycleSeen = cyc; setCargo(0.12 + 0.1 * (cyc % 8)); }
    var A = rockA, grow = smoothstep(0, 1.2, tc);
    var holdA = tc >= 6 && tc < 19;
    var sc = 1.1 * grow;
    if (tc >= 12 && tc < 18) sc = 1.1 * (1 - 0.55 * smoothstep(12, 18, tc));
    if (tc >= 18) sc = 1.1 * 0.45;
    var drift = tc >= 19 ? (tc - 19) : 0;
    var rr = sc * 0.95;
    var cx = 0, cy = -0.4, cz = -10.5;
    if (holdA) { cz = -10.5 + 0.7 * smoothstep(6, 9, tc); cy = -0.4 + 0.3 * smoothstep(6, 9, tc); }
    if (tc >= 19) { cx = 0; cy = -0.1 - drift * 0.2; cz = -9.8 - drift * 1.4; }
    A.visible = tc < 25;
    A.scale.setScalar(Math.max(0.01, sc * (tc >= 24 ? Math.max(0, 25 - tc) : 1)));
    A.rotation.y = t * 0.15; A.rotation.x = t * 0.08;

    var closed = tc >= 5.2 && tc < 18.6;
    var reaching = tc < 19.5;
    for (var i = 0; i < 2; i++) {
      var sd = i === 0 ? 1 : -1;
      if (reaching) demoT[i].set(cx + sd * rr, cy, cz + 0.2);
      arms[i].target = reaching ? demoT[i] : null;
      arms[i].grip = closed ? 1 : (tc >= 18.6 && tc < 19.4 ? 0.2 : 0);
    }
    for (var j = 2; j < 4; j++) {
      var sj = j === 2 ? 1 : -1;
      if (tc >= 4 && tc < 19) demoT[j].set(cx + sj * rr * 0.55, cy - rr * 0.8, cz + 0.4);
      arms[j].target = (tc >= 4 && tc < 19) ? demoT[j] : null;
      arms[j].grip = (tc >= 5.5 && tc < 18.6) ? 0.8 : 0;
    }

    // Láser: rompe la roca A entre los 12 y los 18 s; explora la roca B entre los 22 y los 29 s
    var onA = tc >= 12 && tc < 18;
    var onB = tc >= 22 && tc < 29;
    if (onA) {
      laserT.set(cx + Math.sin(t * 3.1) * 0.25, cy + Math.cos(t * 2.3) * 0.2, cz);
      laser.target = laserT;
      laser.power = smoothstep(12, 12.6, tc) * (1 - smoothstep(17.5, 18, tc));
    } else if (onB) {
      laserT.set(-9 + Math.sin(t * 1.3) * 1.2, 1.5 + Math.cos(t * 1.7) * 0.8, -19);
      laser.target = laserT;
      laser.power = 0.35 * smoothstep(22, 22.8, tc) * (1 - smoothstep(28.2, 29, tc));
    } else {
      laser.target = null; laser.power = 0;
    }
    rockB.rotation.y = t * 0.03;
    rockB.position.y = 1.5 + Math.sin(t * 0.2) * 0.3;
    return holdA;
  }

  function update(t, throttle) {
    var dt = Math.max(0, Math.min(0.1, t - lastT)); lastT = t;
    var th = Math.max(0, Math.min(1, throttle == null ? 0.4 : throttle));

    // Motores
    var w = 0.75 + th * 0.35;
    for (var i = 0; i < engines.length; i++) {
      var e = engines[i];
      var len = (0.3 + th * 1.1) * e.len / 2.2;
      var f = 1 + 0.07 * Math.sin(t * 33 + e.phase) + 0.04 * Math.sin(t * 21 + e.phase * 2);
      e.outer.scale.set(w, w, len * f);
      e.inner.scale.set(w, w, len * (2 - f));
      e.outer.material.opacity = 0.2 + th * 0.3;
    }
    flameLight.intensity = 0.5 + th * 1.8 + 0.1 * Math.sin(t * 27);

    var holdingA = false;
    if (api.demo) holdingA = runDemo(t);

    // Brazos
    var k = 1 - Math.exp(-dt * 4.5);
    for (var a = 0; a < arms.length; a++) {
      var ar = arms[a];
      var T = ar.target || { x: ar._rest[0], y: ar._rest[1], z: ar._rest[2] };
      ar._cur.x += (T.x - ar._cur.x) * k;
      ar._cur.y += (T.y - ar._cur.y) * k;
      ar._cur.z += (T.z - ar._cur.z) * k;
      poseArm(ar, ar._cur);
      ar._grip += (ar.grip - ar._grip) * (1 - Math.exp(-dt * 6));
      for (var fi = 0; fi < ar._fingers.length; fi++) {
        ar._fingers[fi].f1.rotation.z = 0.25 - ar._grip * 1.25;
        ar._fingers[fi].f2.rotation.z = 0.15 - ar._grip * 1.0;
      }
    }
    // La roca A acompaña a las pinzas mientras la sostienen
    if (api.demo && holdingA) {
      rockA.position.x = (arms[0]._cur.x + arms[1]._cur.x) / 2;
      rockA.position.y = (arms[0]._cur.y + arms[1]._cur.y) / 2;
      rockA.position.z = (arms[0]._cur.z + arms[1]._cur.z) / 2 - 0.2;
    } else if (api.demo) {
      var tc2 = t % 30;
      var d2 = tc2 >= 19 ? (tc2 - 19) : 0;
      if (tc2 >= 19) rockA.position.set(0, -0.1 - d2 * 0.2, -9.8 - d2 * 1.4);
      else rockA.position.set(0, -0.4, -10.5);
    }

    // Láser
    var lt = laser.target, pw = laser.power;
    if (lt && pw > 0.01) {
      var dx = lt.x - LP.x, dy = lt.y - LP.y, dz = lt.z - LP.z;
      var dist = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1e-6;
      var hz = Math.sqrt(dx * dx + dz * dz);
      laserYaw.rotation.y = Math.atan2(-dx, -dz);
      laserPitch.rotation.x = Math.atan2(dy, hz);
      var bl = Math.max(0.1, dist - 2.2 - 0.35);
      var flick = 1 + 0.12 * Math.sin(t * 60) + 0.08 * Math.sin(t * 37);
      beam.visible = true;
      beam.scale.set(1, 1, 1);
      beamGlow.scale.set(0.16 * pw * flick, 0.16 * pw * flick, bl);
      beamCore.scale.set(0.05 * pw, 0.05 * pw, bl);
      beamGlow.material.opacity = 0.25 + 0.2 * pw;
      impact.visible = true;
      impact.position.set(lt.x, lt.y, lt.z);
      var is = (0.6 + 0.8 * pw) * flick;
      impactGlow.scale.setScalar(is);
      impactCore.scale.setScalar(is * 0.9);
      impactLight.intensity = 0.8 + 2.0 * pw * flick;
      for (var s = 0; s < sparks.length; s++) {
        var ph = s * 12.9898 + Math.floor(t * 18) * 78.233;
        var rx = Math.sin(ph) * 43758.5453; rx -= Math.floor(rx);
        var ry = Math.sin(ph * 1.7) * 24634.6345; ry -= Math.floor(ry);
        var rz = Math.sin(ph * 2.3) * 12345.6789; rz -= Math.floor(rz);
        sparks[s].position.set((rx - 0.5) * 1.6 * pw, (ry - 0.5) * 1.6 * pw, (rz - 0.5) * 1.6 * pw);
        sparks[s].visible = pw > 0.05 && rx > 0.2;
      }
      mats.crystal.emissiveIntensity = 0.6 + 1.6 * pw * flick;
    } else {
      beam.visible = false;
      impact.visible = false;
      mats.crystal.emissiveIntensity = 0.35 + 0.1 * Math.sin(t * 2);
      laserYaw.rotation.y *= 1 - k;
      laserPitch.rotation.x *= 1 - k;
    }

    // Bodega
    if (cargo !== cargoShown) {
      cargoShown = cargo;
      var lit = Math.round(cargo * oreLamps.length);
      for (var q = 0; q < oreLamps.length; q++) oreLamps[q].color.setHex(q < lit ? colors.ore : 0x0a2a24);
    }

    scanner.rotation.y = t * 1.1;
    for (var j = 0; j < navLights.length; j++) {
      var n = navLights[j];
      var on = n.fast ? Math.sin(t * 6) > 0.8 : Math.sin(t * 2.5) > 0.5;
      n.mat.color.setHex(on ? n.on : 0x1a1010);
    }
  }

  function setAccent(hex) {
    colors.accent = hex;
    mats.accent.color.setHex(hex);
  }

  api.group = group;
  api.update = update;
  api.setAccent = setAccent;
  api.setCargo = setCargo;
  api.arms = arms;
  api.laser = laser;
  api.rocks = rocks;
  api.demo = opts.demo !== false;
  api.materials = mats;
  return api;
}
