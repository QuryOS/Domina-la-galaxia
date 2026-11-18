/**
 * Nodo central de comunicaciones y radar (NIVEL 3 de 3) para Three.js, sin archivos externos. Instalación grande: el
 * corazón de la red del planeta.
 *
 * Gran Antena de 24 m con juntas de panel y montura azimut-elevación, rodeada de un campo de 6 antenas medianas que
 * apuntan en sincronía; torre de mando de 64 m con base escalonada, cubierta de observación acristalada, radar de barra,
 * tres anillos holográficos giratorios y un haz de enlace vertical hacia el cielo; sala de datos con racks, luces y 6
 * enfriadores con ventiladores giratorios; dos torres de radar de matriz en fase (144 elementos); dos radomos; dos mástiles
 * reticulados con plataformas, paneles sectoriales y microondas; garita con barrera animada, generadores, depósito, baterías,
 * paneles solares, postes de luz y letrero. Sin vallas ni dron.
 *
 * Uso:
 *   const cm = createNodoComunicaciones(THREE, { accent: 0x2fd0a0 });
 *   cm.group.position.set(x, groundY, z);        // la base de la losa está en y = 0
 *   scene.add(cm.group);
 *   cm.update(clock.getElapsedTime());
 *
 * Escala: 1 unidad = 4 m. Huella: 20 x 20 unidades (cm.footprint), centrada en el origen. Altura ~20 (el haz sube más).
 * Entrada: cm.entrance (borde +Z). Energía: cm.input (borde -X). Enlace de datos: cm.output (borde +X). cm.nivel = 3.
 *
 * Estados (cm.setState): 'working', 'alert' (rojo, radares rápidos, antenas fijas), 'broken' (antenas caídas, luces
 *   intermitentes, sin haz), 'off'. Por defecto corre una demostración (cm.demo = true); setState la desactiva.
 *   cm.setSignal(0..1): intensidad de señal. cm.setGhost(true, valid) para colocar; cm.setAccent(hex).
 * Compatible con Three.js r128 o superior.
 */
function createNodoComunicaciones(THREE, opts) {
  opts = opts || {};
  var P = Math.PI, TAU = P * 2;
  var colors = {
    hull: opts.hull != null ? opts.hull : 0xd3d7dd,
    accent: opts.accent != null ? opts.accent : 0x2fd0a0,
    dark: opts.dark != null ? opts.dark : 0x161c28,
    glow: opts.glow != null ? opts.glow : 0x35e0ff
  };
  var group = new THREE.Group();
  var mats = {
    hull: new THREE.MeshStandardMaterial({ color: colors.hull, metalness: 0.45, roughness: 0.4 }),
    plate: new THREE.MeshStandardMaterial({ color: 0x7d899a, metalness: 0.6, roughness: 0.45 }),
    accent: new THREE.MeshStandardMaterial({ color: colors.accent, metalness: 0.3, roughness: 0.4 }),
    dark: new THREE.MeshStandardMaterial({ color: colors.dark, metalness: 0.7, roughness: 0.45, side: THREE.DoubleSide }),
    glass: new THREE.MeshStandardMaterial({ color: 0x0b1d33, metalness: 0.9, roughness: 0.05, emissive: 0x0a3a5c, emissiveIntensity: 0.8 }),
    window: new THREE.MeshBasicMaterial({ color: 0xffe3a0 }),
    lamp: new THREE.MeshBasicMaterial({ color: 0xffc46b }),
    red: new THREE.MeshBasicMaterial({ color: 0xff3b30 }),
    green: new THREE.MeshBasicMaterial({ color: 0x35ff7a })
  };
  function glowMat(color, opacity) {
    return new THREE.MeshBasicMaterial({ color: color, transparent: true, opacity: opacity, blending: THREE.AdditiveBlending, depthWrite: false });
  }
  function add(parent, geo, mat, x, y, z) {
    var m = new THREE.Mesh(geo, mat);
    m.position.set(x || 0, y || 0, z || 0);
    parent.add(m);
    return m;
  }
  var seed = opts.seed || 7;
  function rnd() { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }

  /* ---------- Geometrías ---------- */
  function plan(pts, depth, bevel) {
    var s = new THREE.Shape();
    s.moveTo(pts[0][0], pts[0][1]);
    for (var i = 1; i < pts.length; i++) s.lineTo(pts[i][0], pts[i][1]);
    for (var j = pts.length - 1; j >= 1; j--) s.lineTo(-pts[j][0], pts[j][1]);
    s.closePath();
    var g = new THREE.ExtrudeGeometry(s, { depth: depth, bevelEnabled: !!bevel, bevelSize: bevel || 0, bevelThickness: bevel || 0, bevelSegments: 4, curveSegments: 12 });
    g.rotateX(P / 2);
    g.translate(0, depth / 2, 0);
    return g;
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
  function capsule(r, len, seg) {
    var pts = [], n = 10, i, a;
    for (i = 0; i <= n; i++) { a = -P / 2 + (P / 2) * i / n; pts.push(new THREE.Vector2(Math.max(0, r * Math.cos(a)), -len / 2 + r * Math.sin(a))); }
    for (i = 0; i <= n; i++) { a = (P / 2) * i / n; pts.push(new THREE.Vector2(Math.max(0, r * Math.cos(a)), len / 2 + r * Math.sin(a))); }
    var g = new THREE.LatheGeometry(pts, seg);
    g.rotateX(P / 2);
    return g;
  }
  /* Casco de revolución suave: rz = [[z, radio], ...] con la nariz en z negativo; sx/sy lo ovalan. */
  function lathe(rz, seg, sx, sy) {
    var ctrl = [], i;
    for (i = 0; i < rz.length; i++) ctrl.push(new THREE.Vector2(rz[i][1], -rz[i][0]));
    var curve = new THREE.SplineCurve(ctrl), raw = curve.getPoints(rz.length * 8), pts = [];
    for (i = raw.length - 1; i >= 0; i--) pts.push(new THREE.Vector2(Math.max(0, raw[i].x), raw[i].y));   // y creciente = normales hacia fuera
    var g = new THREE.LatheGeometry(pts, seg);
    g.rotateX(-P / 2);
    g.scale(sx || 1, sy || 1, 1);
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


  mats.hull2 = new THREE.MeshStandardMaterial({ color: 0x9aa5b6, metalness: 0.55, roughness: 0.38 });
  mats.trim = new THREE.MeshStandardMaterial({ color: 0x3a4456, metalness: 0.8, roughness: 0.35 });
  var UB = new THREE.BoxGeometry(1, 1, 1);
  for (var mk in mats) if (mats[mk].isMeshStandardMaterial) mats[mk].side = THREE.DoubleSide;   // nada se ve transparente por dentro

  /* Casco "loft": cada sección { z, w (semiancho), t (alto superior), b (alto inferior), n (cuadratura), x, y }
     se une con la siguiente en una superficie lisa. capA/capB cierran las puntas planas. */
  function loft(secs, seg, capA, capB) {
    var pos = [], idx = [], ns = secs.length, i, j, s, a, c, sn, ex, h, base;
    function ring(sec) {
      var n = sec.n || 2.4, yc = sec.y || 0, xc = sec.x || 0, out = [];
      ex = 2 / n;
      for (var k = 0; k < seg; k++) {
        a = k / seg * TAU; c = Math.cos(a); sn = Math.sin(a);
        h = sn >= 0 ? sec.t : sec.b;
        out.push([xc + sec.w * (c < 0 ? -1 : 1) * Math.pow(Math.abs(c), ex), yc + h * (sn < 0 ? -1 : 1) * Math.pow(Math.abs(sn), ex), sec.z]);
      }
      return out;
    }
    for (i = 0; i < ns; i++) { var r = ring(secs[i]); for (j = 0; j < seg; j++) pos.push(r[j][0], r[j][1], r[j][2]); }
    for (i = 0; i < ns - 1; i++) for (j = 0; j < seg; j++) {
      var A = i * seg + j, B = i * seg + (j + 1) % seg, C = (i + 1) * seg + j, D = (i + 1) * seg + (j + 1) % seg;
      idx.push(A, B, C, B, D, C);
    }
    function cap(sec, front) {
      var r2 = ring(sec), b0 = pos.length / 3, cx = sec.x || 0, cy = sec.y || 0;
      for (var k = 0; k < seg; k++) pos.push(r2[k][0], r2[k][1], r2[k][2]);
      pos.push(cx, cy, sec.z);
      for (var q = 0; q < seg; q++) {
        if (front) idx.push(b0 + seg, b0 + (q + 1) % seg, b0 + q);
        else idx.push(b0 + seg, b0 + q, b0 + (q + 1) % seg);
      }
    }
    if (capA) cap(secs[0], true);
    if (capB) cap(secs[ns - 1], false);
    var g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  }
  /* Detalle aleatorio: cajitas sobre un plano. axis 'y' = superficie horizontal, 'x' = lateral. */
  function greeble(cx, cy, cz, w, h, d, n, mat, axis, smin, smax) {
    var l = [], k, sx, sy, sz;
    smin = smin || 0.15; smax = smax || 0.6;
    for (k = 0; k < n; k++) {
      sx = smin + rnd() * (smax - smin); sz = smin + rnd() * (smax - smin); sy = 0.05 + rnd() * 0.16;
      if (axis === 'x') l.push({ x: cx + sy / 2 * (cx < 0 ? -1 : 1), y: cy + (rnd() - 0.5) * h, z: cz + (rnd() - 0.5) * d, sx: sy, sy: sx, sz: sz });
      else l.push({ x: cx + (rnd() - 0.5) * w, y: cy + sy / 2, z: cz + (rnd() - 0.5) * d, sx: sx, sy: sy, sz: sz });
    }
    var m = boxField(UB, mat, l);
    group.add(m);
    return m;
  }

  /* ---------- Materiales y utilidades ---------- */
  var anim = [], blinkers = [];
  mats.slab = new THREE.MeshStandardMaterial({ color: 0x6d7077, metalness: 0.2, roughness: 0.85 });
  mats.status = new THREE.MeshBasicMaterial({ color: 0x35ff7a });
  mats.pipe = new THREE.MeshStandardMaterial({ color: 0x8892a2, metalness: 0.7, roughness: 0.35 });
  function light(parent, x, y, z, mat, size, period) {
    var m = add(parent, new THREE.SphereGeometry(size || 0.07, 10, 8), mat, x, y, z);
    blinkers.push({ m: m, per: period || 1.2, ph: rnd() * TAU });
    return m;
  }
  function setAccent(hex) { colors.accent = hex; mats.accent.color.setHex(hex); }
  var _up = new THREE.Vector3(0, 1, 0), _dir = new THREE.Vector3();
  function placeStrut(m, a, b) {
    var dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2], len = Math.sqrt(dx * dx + dy * dy + dz * dz) || 0.0001;
    m.position.set((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2);
    _dir.set(dx / len, dy / len, dz / len);
    m.quaternion.setFromUnitVectors(_up, _dir);
    m.scale.set(1, len, 1);
  }
  var _cg = {};
  function strut(a, b, r, mat) {
    var g = _cg[r] || (_cg[r] = new THREE.CylinderGeometry(r, r, 1, 8));
    var m = new THREE.Mesh(g, mat);
    placeStrut(m, a, b);
    group.add(m);
    return m;
  }
  function cyl(r, len, axis, mat, x, y, z, seg) {
    var g = new THREE.CylinderGeometry(r, r, len, seg || 16);
    if (axis === 'x') g.rotateZ(P / 2); else if (axis === 'z') g.rotateX(P / 2);
    return add(group, g, mat, x, y, z);
  }
  function elbow(x, y, z, r) { return add(group, new THREE.SphereGeometry(r || 0.13, 12, 10), mats.pipe, x, y, z); }
  function pipeRun(pts, r, mat) {                  // tubería con codos en cada vértice
    for (var q = 0; q < pts.length - 1; q++) strut(pts[q], pts[q + 1], r, mat);
    for (q = 1; q < pts.length - 1; q++) add(group, new THREE.SphereGeometry(r * 1.25, 12, 10), mat, pts[q][0], pts[q][1], pts[q][2]);
  }
  function valve(x, y, z, axisX) {
    add(group, roundedBox(axisX ? 0.26 : 0.3, 0.3, axisX ? 0.3 : 0.26, 0.05, 2), mats.hull2, x, y, z);
    strut([x, y + 0.14, z], [x, y + 0.42, z], 0.03, mats.trim);
    add(group, new THREE.TorusGeometry(0.15, 0.025, 6, 16).rotateX(P / 2), mats.accent, x, y + 0.43, z);
  }
  function ringPlat(x, y, z, r0, r1, posts) {       // pasarela circular con barandilla
    add(group, new THREE.RingGeometry(r0, r1, 32).rotateX(-P / 2), mats.trim, x, y, z);
    add(group, new THREE.TorusGeometry(r1 - 0.03, 0.022, 6, 32).rotateX(P / 2), mats.accent, x, y + 1.0, z);
    add(group, new THREE.TorusGeometry(r1 - 0.03, 0.016, 6, 32).rotateX(P / 2), mats.accent, x, y + 0.5, z);
    for (var q = 0; q < (posts || 12); q++) {
      var a = q / (posts || 12) * TAU;
      strut([x + Math.cos(a) * (r1 - 0.03), y, z + Math.sin(a) * (r1 - 0.03)], [x + Math.cos(a) * (r1 - 0.03), y + 1.0, z + Math.sin(a) * (r1 - 0.03)], 0.02, mats.accent);
    }
  }
  function ladderV(x, z, y0, y1, dir, wallDist) {    // escalera vertical (dir = eje de apoyo 'z' o 'x') con soportes a la pared
    var q, rungs = [];
    [-0.2, 0.2].forEach(function (d) { strut(dir === 'z' ? [x + d, y0, z] : [x, y0, z + d], dir === 'z' ? [x + d, y1, z] : [x, y1, z + d], 0.025, mats.trim); });
    for (q = y0 + 0.4; q < y1; q += 0.35) rungs.push({ x: x, y: q, z: z, sx: dir === 'z' ? 0.4 : 0.035, sy: 0.035, sz: dir === 'z' ? 0.035 : 0.4 });
    group.add(boxField(UB, mats.trim, rungs));
    for (q = y0 + 1.5; q < y1; q += 2.5) [-0.2, 0.2].forEach(function (d) {
      strut(dir === 'z' ? [x + d, q, z] : [x, q, z + d], dir === 'z' ? [x + d, q, z + wallDist] : [x + wallDist, q, z + d], 0.02, mats.trim);
    });
  }

  /* ---------- Constantes y materiales propios ---------- */
  var SLAB = 0.4, SZ = 20, k, j, i, q;
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function box(parent, w, h, d, mat, x, y, z, r) { return add(parent, roundedBox(w, h, d, r || 0.03, 2), mat, x, y, z); }
  function cylP(parent, r1, r2, h, seg, mat, x, y, z) { return add(parent, new THREE.CylinderGeometry(r1, r2, h, seg || 12), mat, x, y, z); }
  function strutIn(parent, a, b, r, mat) {
    var m = new THREE.Mesh(_cg[r] || (_cg[r] = new THREE.CylinderGeometry(r, r, 1, 8)), mat);
    placeStrut(m, a, b); parent.add(m); return m;
  }
  function std(c, m, r, extra) { var o = { color: c, metalness: m, roughness: r, side: THREE.DoubleSide }; if (extra) for (var kk in extra) o[kk] = extra[kk]; return new THREE.MeshStandardMaterial(o); }
  function bas(c) { return new THREE.MeshBasicMaterial({ color: c }); }
  mats.hull2 = std(0x9aa5b6, 0.55, 0.38); mats.trim = std(0x3a4456, 0.8, 0.35);
  var UB = new THREE.BoxGeometry(1, 1, 1);
  mats.conc = std(0xb7bbc2, 0.15, 0.78); mats.concD = std(0x8d9199, 0.2, 0.8);
  mats.panel = std(0xe9edf2, 0.25, 0.55);
  mats.strip = std(0x101a28, 0.9, 0.15, { emissive: 0x0a2236, emissiveIntensity: 0.55 });
  mats.glassL = std(0x9fd6ff, 0.2, 0.05, { transparent: true, opacity: 0.3 });
  mats.winW = bas(0xffe3a0); mats.eC = bas(0x35e0ff); mats.dim = bas(0x23303c);
  mats.road = std(0x363940, 0.2, 0.85);
  mats.mastR = std(0xe0472a, 0.4, 0.5); mats.mastW = std(0xf2f2f2, 0.35, 0.5);
  mats.radome = std(0xf4f6f8, 0.1, 0.55, { flatShading: true });
  mats.solar = std(0x16264a, 0.85, 0.22, { emissive: 0x0a1a3a, emissiveIntensity: 0.4 });
  mats.cell = std(0x6d86b8, 0.8, 0.3);
  mats.cont = std(0x3f6f8f, 0.45, 0.55); mats.contB = std(0xc9a02f, 0.45, 0.55);
  mats.rack = std(0x20262f, 0.7, 0.4);
  mats.ledG = bas(0x35ff7a); mats.ledA = bas(0xffb020);
  mats.beaconM = bas(0xff3b30);
  mats.arr = std(0x1c2430, 0.6, 0.35, { emissive: 0x0b2a3a, emissiveIntensity: 0.5 });
  mats.seam = std(0x5b6676, 0.6, 0.5);
  mats.smoke = new THREE.MeshBasicMaterial({ color: 0x9a9a9a, transparent: true, opacity: 0.25, depthWrite: false });
  mats.lineR = new THREE.LineBasicMaterial({ color: 0xb9c4cf, transparent: true, opacity: 0.8 });
  mats.holo = bas(0x7ff0ff);
  var beamMat = glowMat(0x7ff0ff, 0.3), radomeEdges = [];

  function capDish(parent, r, tl) {
    var R = r / Math.sin(tl), g = new THREE.SphereGeometry(R, 22, 8, 0, TAU, P - tl, tl); g.rotateX(P / 2); g.translate(0, 0, R);
    return new THREE.Mesh(g, mats.panel);
  }
  function ryAt(a) { return -(a + P / 2); }

  /* ---------- Losa, avenida y luces de borde ---------- */
  box(group, SZ, SLAB, SZ, mats.slab, 0, SLAB / 2, 0, 0.07);
  box(group, SZ - 0.8, 0.04, SZ - 0.8, mats.conc, 0, SLAB + 0.01, 0, 0.01);
  box(group, 1.4, 0.05, 13.0, mats.road, 0, SLAB + 0.03, 3.5, 0.01);
  box(group, 6.2, 0.05, 1.0, mats.road, -3.0, SLAB + 0.03, -3.0, 0.01);
  box(group, 1.0, 0.05, 6.2, mats.road, 3.0, SLAB + 0.03, 0.0, 0.01);
  for (k = 0; k < 17; k++) box(group, 0.08, 0.052, 0.4, mats.panel, 0, SLAB + 0.035, 9.6 - k * 0.75, 0.005);
  var edgeL = [];
  for (k = 0; k < 21; k++) { var ev = -9.0 + k * 0.9; edgeL.push({ x: ev, y: SLAB + 0.03, z: -9.82, sx: 0.28, sy: 0.03, sz: 0.08 }); edgeL.push({ x: ev, y: SLAB + 0.03, z: 9.82, sx: 0.28, sy: 0.03, sz: 0.08 }); edgeL.push({ x: -9.82, y: SLAB + 0.03, z: ev, sx: 0.08, sy: 0.03, sz: 0.28 }); edgeL.push({ x: 9.82, y: SLAB + 0.03, z: ev, sx: 0.08, sy: 0.03, sz: 0.28 }); }
  var edgeM = boxField(UB, mats.eC, edgeL); group.add(edgeM);
  var y0 = SLAB;

  /* ---------- Antena parabólica con montura azimut-elevación (reutilizable) ---------- */
  var dishes = [];
  function buildDish(px, pz, R, F, pedH, armX, pivH, big) {
    var base = new THREE.Group(); base.position.set(px, y0, pz); group.add(base);
    cylP(base, R * 0.5 + 0.35, R * 0.55 + 0.45, 0.3, 18, mats.conc, 0, 0.15, 0);
    cylP(base, R * 0.3 + 0.2, R * 0.4 + 0.3, pedH, 18, mats.concD, 0, 0.3 + pedH / 2, 0);
    for (var b = 0; b < 8; b++) { var ba = b / 8 * TAU; cylP(base, 0.03 + R * 0.01, 0.03 + R * 0.01, 0.06, 6, mats.trim, Math.cos(ba) * (R * 0.5 + 0.2), 0.33, Math.sin(ba) * (R * 0.5 + 0.2)); }
    var dY = new THREE.Group(); dY.position.set(0, 0.3 + pedH, 0); base.add(dY);
    cylP(dY, R * 0.32, R * 0.32, 0.12 + R * 0.04, 18, mats.hull2, 0, 0.07, 0);
    var aw = 0.12 + R * 0.05;
    box(dY, aw, pivH + 0.4, 0.2 + R * 0.12, mats.hull2, -armX, (pivH + 0.4) / 2, 0, 0.03); box(dY, aw, pivH + 0.4, 0.2 + R * 0.12, mats.hull2, armX, (pivH + 0.4) / 2, 0, 0.03);
    box(dY, armX * 2 + aw, 0.15 + R * 0.04, 0.3 + R * 0.12, mats.hull2, 0, 0.1, 0, 0.03);
    [-1, 1].forEach(function (s) {
      strutIn(dY, [s * 0.2, 0.15, 0.2 + R * 0.05], [s * armX, pivH, 0.08], 0.03 + R * 0.01, mats.trim); strutIn(dY, [s * 0.2, 0.15, -0.2 - R * 0.05], [s * armX, pivH, -0.08], 0.03 + R * 0.01, mats.trim);
      cylP(dY, 0.1 + R * 0.04, 0.1 + R * 0.04, 0.09, 12, mats.accent, s * (armX + aw / 2), pivH, 0).rotation.z = P / 2;
    });
    var dX = new THREE.Group(); dX.position.set(0, pivH, 0); dY.add(dX);
    cylP(dX, 0.05 + R * 0.02, 0.05 + R * 0.02, armX * 2, 10, mats.trim, 0, 0, 0).rotation.z = P / 2; cylP(dX, 0.15 + R * 0.08, 0.2 + R * 0.08, 0.3 + R * 0.08, 14, mats.hull2, 0, -0.1, 0);
    var seg = big ? 20 : 16, pts = [], pts2 = [], kk2;
    for (kk2 = 0; kk2 <= seg; kk2++) { var rd = R * kk2 / seg, yd = rd * rd / (4 * F); pts.push(new THREE.Vector2(rd, yd)); pts2.push(new THREE.Vector2(rd, yd - 0.05 - R * 0.015)); }
    add(dX, new THREE.LatheGeometry(pts, big ? 56 : 36), mats.panel, 0, 0.05, 0); add(dX, new THREE.LatheGeometry(pts2, big ? 56 : 36), mats.concD, 0, 0, 0);
    var rimY = R * R / (4 * F) + 0.05;
    add(dX, new THREE.TorusGeometry(R, 0.03 + R * 0.012, 8, big ? 56 : 36).rotateX(P / 2), mats.accent, 0, rimY, 0);
    var nR = big ? 24 : 12, ribs = [];
    for (i = 0; i < nR; i++) { var ra2 = i / nR * TAU; strutIn(dX, [0, -0.05, 0], [Math.cos(ra2) * R * 0.88, R * R * 0.77 / (4 * F) - 0.05, Math.sin(ra2) * R * 0.88], 0.012 + R * 0.004, mats.trim); }
    if (big) {                                          // juntas de los paneles sobre la superficie
      for (i = 0; i < 24; i++) { var sa = i / 24 * TAU, sp0 = [], rr0; for (kk2 = 1; kk2 <= 6; kk2++) { rr0 = R * kk2 / 6.1; sp0.push([Math.cos(sa) * rr0, rr0 * rr0 / (4 * F) + 0.07, Math.sin(sa) * rr0]); } for (kk2 = 0; kk2 < 5; kk2++) strutIn(dX, sp0[kk2], sp0[kk2 + 1], 0.007, mats.seam); }
      for (kk2 = 1; kk2 <= 3; kk2++) { var rr1 = R * kk2 / 4; add(dX, new THREE.TorusGeometry(rr1, 0.01, 4, 56).rotateX(P / 2), mats.seam, 0, rr1 * rr1 / (4 * F) + 0.07, 0); }
    }
    for (i = 0; i < 4; i++) { var fa = i * P / 2 + P / 4; strutIn(dX, [Math.cos(fa) * R * 0.96, rimY, Math.sin(fa) * R * 0.96], [0, 0.05 + F, 0], 0.016 + R * 0.007, mats.trim); }
    cylP(dX, 0.05 + R * 0.04, 0.07 + R * 0.04, 0.18 + R * 0.08, 12, mats.hull2, 0, 0.05 + F, 0);
    add(dX, new THREE.SphereGeometry(0.1 + R * 0.06, 14, 8, 0, TAU, 0, P / 2).rotateX(P), mats.panel, 0, 0.05 + F - 0.1, 0);
    add(dX, new THREE.SphereGeometry(0.03 + R * 0.012, 8, 6), mats.lamp, 0, 0.05 + F + 0.1 + R * 0.05, 0);
    if (big) { box(dX, 1.4, 0.5, 0.9, mats.hull2, 0, -0.6, -0.1, 0.05); for (i = 0; i < 4; i++) add(dX, new THREE.SphereGeometry(0.04, 6, 6), i % 2 ? mats.green : mats.lamp, -0.4 + i * 0.27, -0.6, 0.36); }
    dishes.push({ dY: dY, dX: dX, big: !!big });
    return dY;
  }
  buildDish(4.2, -1.6, 3.0, 2.4, 1.6, 3.35, 3.0, true);                          // Gran Antena
  var arrayPos = [[-7.4, 2.4], [-5.0, 2.4], [-2.6, 2.4], [-7.4, 4.9], [-5.0, 4.9], [-2.6, 4.9]];
  arrayPos.forEach(function (p) { buildDish(p[0], p[1], 0.85, 0.7, 0.5, 1.05, 1.0, false); });
  // caseta de control y cableado de la Gran Antena
  box(group, 1.3, 1.1, 0.8, mats.panel, 1.0 - 0.1, y0 + 0.55, -3.5, 0.04); for (k = 0; k < 4; k++) add(group, new THREE.SphereGeometry(0.03, 6, 6), k % 2 ? mats.green : mats.lamp, 0.55 + k * 0.14, y0 + 0.95, -3.1);
  box(group, 3.0, 0.05, 0.22, mats.trim, 2.5, y0 + 0.06, -3.6, 0.01);
  for (k = 0; k < 3; k++) box(group, 0.06, 0.04, 2.1 + k * 0.2, mats.trim, -7.4 + k * 2.4, y0 + 0.05, 3.65, 0.005);

  /* ---------- Torre de mando: base escalonada, fuste con cubierta de observación, radar y haz de enlace ---------- */
  var TX = -6.0, TZ = -6.0, TW = 4.6, ty = y0;
  box(group, TW + 0.3, 0.28, TW + 0.3, mats.concD, TX, ty + 0.14, TZ, 0.03);
  box(group, TW, 1.6, TW, mats.panel, TX, ty + 0.28 + 0.8, TZ, 0.06);
  box(group, TW + 0.3, 0.14, TW + 0.3, mats.conc, TX, ty + 1.95, TZ, 0.03);
  box(group, TW - 1.1, 1.3, TW - 1.1, mats.panel, TX, ty + 2.02 + 0.65, TZ, 0.05);
  box(group, TW - 0.8, 0.12, TW - 0.8, mats.accent, TX, ty + 3.4, TZ, 0.02);
  var tw1 = [], twL = [];
  for (k = 0; k < 5; k++) { tw1.push({ x: TX - 1.8 + k * 0.9, y: ty + 1.1, z: TZ + TW / 2 + 0.012, sx: 0.07, sy: 1.4, sz: 0.04 }); }
  group.add(boxField(UB, mats.concD, tw1));
  [-1.2, 1.2].forEach(function (dx) { add(group, new THREE.BoxGeometry(1.4, 0.55, 0.05), mats.strip, TX + dx, ty + 1.25, TZ + TW / 2 + 0.02); for (k = 0; k < 4; k++) twL.push({ x: TX + dx - 0.5 + k * 0.33, y: ty + 1.25, z: TZ + TW / 2 + 0.05, sx: 0.26, sy: 0.38, sz: 0.02 }); });
  for (k = 0; k < 4; k++) { twL.push({ x: TX - 0.9 + k * 0.6, y: ty + 2.7, z: TZ + (TW - 1.1) / 2 + 0.03, sx: 0.4, sy: 0.7, sz: 0.02 }); }
  add(group, new THREE.BoxGeometry(2.4, 0.9, 0.04), mats.strip, TX, ty + 2.7, TZ + (TW - 1.1) / 2 + 0.01);
  box(group, 1.1, 1.5, 0.12, mats.accent, TX, ty + 0.9, TZ + TW / 2 + 0.03, 0.02); box(group, 0.9, 1.35, 0.06, mats.dark, TX, ty + 0.88, TZ + TW / 2 + 0.09, 0.02);
  box(group, 1.8, 0.1, 0.9, mats.conc, TX, ty + 1.7, TZ + TW / 2 + 0.45, 0.02);
  [-0.8, 0.8].forEach(function (dx) { cylP(group, 0.04, 0.04, 1.4, 8, mats.trim, TX + dx, ty + 1.0, TZ + TW / 2 + 0.8); });
  var sigDim = [], sigOn = [];
  for (k = 0; k < 5; k++) { var bh = 0.1 + k * 0.08, bxp = TX - 0.4 + k * 0.2; sigDim.push(box(group, 0.12, bh, 0.03, mats.dim, bxp, ty + 1.88 + bh / 2 - 0.02, TZ + TW / 2 + 0.05, 0.005)); sigOn.push(box(group, 0.12, bh, 0.04, mats.eC, bxp, ty + 1.88 + bh / 2 - 0.02, TZ + TW / 2 + 0.06, 0.005)); }
  // fuste ahusado con aletas y anillos
  var shaftTop = ty + 12.0, shaftBase = ty + 3.46;
  add(group, new THREE.LatheGeometry([new THREE.Vector2(1.3, 0), new THREE.Vector2(1.0, 0.8), new THREE.Vector2(0.85, 3.0), new THREE.Vector2(0.8, 6.0), new THREE.Vector2(0.62, 8.5)], 28), mats.panel, TX, shaftBase, TZ);
  for (i = 0; i < 6; i++) { var fa2 = i / 6 * TAU + P / 6; strutIn(group, [TX + Math.cos(fa2) * 1.25, shaftBase, TZ + Math.sin(fa2) * 1.25], [TX + Math.cos(fa2) * 0.72, shaftBase + 7.2, TZ + Math.sin(fa2) * 0.72], 0.05, mats.trim); box(group, 0.08, 0.5, 0.5, mats.accent, TX + Math.cos(fa2) * 1.0, shaftBase + 1.0, TZ + Math.sin(fa2) * 1.0, 0.01).rotation.y = ryAt(fa2) + P / 2; }
  for (i = 0; i < 4; i++) { var rz = shaftBase + 1.4 + i * 1.6, rr3 = 0.95 - i * 0.04; add(group, new THREE.TorusGeometry(rr3, 0.05, 8, 28).rotateX(P / 2), i % 2 ? mats.trim : mats.accent, TX, rz, TZ); }
  // cubierta de observación
  var dkY = ty + 9.2, dkR = 1.9;
  cylP(group, dkR + 0.2, 0.9, 0.5, 28, mats.hull2, TX, dkY - 0.55, TZ);
  cylP(group, dkR, dkR, 1.0, 28, mats.strip, TX, dkY + 0.2, TZ);
  var dkL = [];
  for (i = 0; i < 28; i++) { var da = i / 28 * TAU; dkL.push({ x: TX + Math.cos(da) * (dkR + 0.02), y: dkY + 0.2, z: TZ + Math.sin(da) * (dkR + 0.02), ry: ryAt(da), sx: 0.3, sy: 0.6, sz: 0.04 }); if (i % 7 === 3) dkL.pop(); }
  for (i = 0; i < 14; i++) { var ma = i / 14 * TAU + 0.11; }
  var mulls = []; for (i = 0; i < 14; i++) { var ma2 = i / 14 * TAU; mulls.push({ x: TX + Math.cos(ma2) * (dkR + 0.03), y: dkY + 0.2, z: TZ + Math.sin(ma2) * (dkR + 0.03), ry: ryAt(ma2), sx: 0.07, sy: 1.0, sz: 0.06 }); }
  group.add(boxField(UB, mats.trim, mulls));
  var dkMesh = boxField(UB, mats.winW, dkL); group.add(dkMesh);
  cylP(group, dkR + 0.45, dkR + 0.45, 0.14, 32, mats.conc, TX, dkY + 0.77, TZ); cylP(group, dkR + 0.15, dkR - 0.4, 0.16, 28, mats.hull2, TX, dkY + 0.9, TZ);
  add(group, new THREE.TorusGeometry(dkR + 0.4, 0.03, 6, 36).rotateX(P / 2), mats.accent, TX, dkY + 1.3, TZ);
  for (i = 0; i < 14; i++) { var pa = i / 14 * TAU; strutIn(group, [TX + Math.cos(pa) * (dkR + 0.4), dkY + 0.84, TZ + Math.sin(pa) * (dkR + 0.4)], [TX + Math.cos(pa) * (dkR + 0.4), dkY + 1.3, TZ + Math.sin(pa) * (dkR + 0.4)], 0.014, mats.accent); }
  add(group, new THREE.SphereGeometry(dkR - 0.35, 20, 8, 0, TAU, 0, P / 2), mats.glassL, TX, dkY + 0.9, TZ);
  // fuste superior, radar de barra, espiral de anillos holográficos y haz
  cylP(group, 0.5, 0.62, 1.0, 20, mats.panel, TX, dkY + 1.4, TZ); cylP(group, 0.22, 0.4, 2.2, 16, mats.hull2, TX, dkY + 2.9, TZ);
  var radarG = new THREE.Group(); radarG.position.set(TX, dkY + 4.0, TZ); group.add(radarG);
  cylP(radarG, 0.2, 0.3, 0.12, 14, mats.concD, 0, 0.06, 0); var radarH = new THREE.Group(); radarH.position.y = 0.3; radarG.add(radarH);
  cylP(radarH, 0.14, 0.14, 0.14, 14, mats.hull2, 0, 0, 0); box(radarH, 2.4, 0.4, 0.08, mats.panel, 0, 0.22, 0.14, 0.02); for (k = 0; k < 7; k++) box(radarH, 0.016, 0.4, 0.085, mats.trim, -1.0 + k * 0.33, 0.22, 0.14, 0.003);
  box(radarH, 0.26, 0.12, 0.3, mats.hull2, 0, 0.22, 0, 0.02); box(radarH, 2.4, 0.05, 0.14, mats.accent, 0, 0.45, 0.14, 0.01);
  cylP(group, 0.04, 0.06, 2.2, 8, mats.mastW, TX, dkY + 5.4, TZ);
  var spireTop = dkY + 6.5;
  var topLamp1 = add(group, new THREE.SphereGeometry(0.12, 12, 10), mats.beaconM, TX, spireTop + 0.05, TZ);
  var holo = [];
  [[1.5, 0], [1.2, 1], [0.95, 2]].forEach(function (c, n) {
    var hg = new THREE.Group(); hg.position.set(TX, dkY + 4.95 + n * 0.1, TZ); group.add(hg);
    var hr = new THREE.Mesh(new THREE.TorusGeometry(c[0], 0.025, 6, 48), mats.holo); hg.add(hr);
    for (i = 0; i < 4; i++) { var ha = i / 4 * TAU; add(hg, new THREE.SphereGeometry(0.06, 6, 6), mats.eC, Math.cos(ha) * c[0], Math.sin(ha) * c[0], 0); }
    hg.rotation.x = 0.3 + n * 0.6; holo.push({ g: hg, sp: 0.5 + n * 0.35, ax: n });
  });
  var beam = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.16, 30, 12, 1, true), beamMat); beam.position.set(TX, spireTop + 15, TZ); beam.frustumCulled = false; group.add(beam);
  var beamCore = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.05, 30, 8, 1, true), mats.holo); beamCore.position.copy(beam.position); beamCore.frustumCulled = false; group.add(beamCore);
  var statusLamp = add(group, new THREE.SphereGeometry(0.1, 12, 10), mats.status, TX + 1.5, y0 + 3.62, TZ + 1.5);

  /* ---------- Sala de datos con enfriadores en la cubierta ---------- */
  var HX = 3.2, HZ = -7.9, HW = 8.4, HD = 3.2, HH = 2.4;
  box(group, HW + 0.2, 0.22, HD + 0.2, mats.concD, HX, y0 + 0.11, HZ, 0.03); box(group, HW, HH, HD, mats.panel, HX, y0 + HH / 2 + 0.1, HZ, 0.05);
  box(group, HW + 0.3, 0.14, HD + 0.3, mats.conc, HX, y0 + HH + 0.17, HZ, 0.03); box(group, HW + 0.03, 0.1, HD + 0.03, mats.accent, HX, y0 + HH - 0.15, HZ, 0.01);
  add(group, new THREE.BoxGeometry(HW - 1.2, 1.0, 0.05), mats.strip, HX, y0 + 1.25, HZ + HD / 2 + 0.02);
  var racks = [], ledsG = [], ledsA = [];
  for (k = 0; k < 11; k++) { var rx = HX - 3.6 + k * 0.72; racks.push({ x: rx, y: y0 + 1.15, z: HZ + HD / 2 - 0.4, sx: 0.54, sy: 1.5, sz: 0.4 }); for (j = 0; j < 7; j++) (rnd() > 0.45 ? ledsG : ledsA).push({ x: rx + (rnd() - 0.5) * 0.35, y: y0 + 0.6 + j * 0.2, z: HZ + HD / 2 - 0.18, sx: 0.04, sy: 0.04, sz: 0.02 }); }
  group.add(boxField(UB, mats.rack, racks));
  var ledMG = boxField(UB, mats.ledG, ledsG), ledMA = boxField(UB, mats.ledA, ledsA); group.add(ledMG); group.add(ledMA);
  box(group, 1.1, 1.5, 0.1, mats.accent, HX + HW / 2 - 0.9, y0 + 0.95, HZ + HD / 2 + 0.04, 0.02);
  var fans = [];
  for (i = 0; i < 6; i++) {
    var fx = HX - 3.4 + i * 1.36, fy = y0 + HH + 0.24;
    box(group, 1.1, 0.35, 1.1, mats.hull2, fx, fy + 0.17, HZ, 0.04); cylP(group, 0.45, 0.45, 0.04, 20, mats.dark, fx, fy + 0.37, HZ);
    var fg = new THREE.Group(); fg.position.set(fx, fy + 0.4, HZ); group.add(fg);
    for (k = 0; k < 4; k++) { var bl = box(fg, 0.42, 0.015, 0.1, mats.trim, 0, 0, 0, 0.003); bl.position.set(Math.cos(k * P / 2) * 0.21, 0, Math.sin(k * P / 2) * 0.21); bl.rotation.y = -k * P / 2; }
    cylP(fg, 0.05, 0.05, 0.04, 8, mats.accent, 0, 0.01, 0); fans.push(fg);
  }
  greeble(HX, y0 + HH + 0.24, HZ + 0.9, HW - 1, 0.2, 0.5, 5, mats.hull2, 'y', 0.12, 0.3);
  box(group, HW, 0.1, 0.2, mats.trim, HX, y0 + HH + 0.3, HZ - 1.2, 0.01);
  [[-0.8, 0.5, 0.0], [0.5, 0.4, 0.2]].forEach(function (p, n) { });
  // radomos auxiliares
  [[-1.2, -7.6, 0.85], [9.0, -8.4, 0.85]].forEach(function (p, n) {
    var rb = p[2];
    cylP(group, rb * 0.8, rb * 0.95, 0.5, 16, mats.concD, p[0], y0 + 0.25, p[1]);
    var rg2 = new THREE.IcosahedronGeometry(rb, 1); var rd2 = add(group, rg2, mats.radome, p[0], y0 + 0.5 + rb - 0.1, p[1]);
    var re = new THREE.LineSegments(new THREE.EdgesGeometry(rg2, 8), mats.lineR); re.position.copy(rd2.position); group.add(re); radomeEdges.push(re);
    add(group, new THREE.TorusGeometry(rb * 0.99, 0.04, 8, 28).rotateX(P / 2), mats.accent, p[0], y0 + 0.55, p[1]);
    add(group, new THREE.SphereGeometry(0.05, 8, 6), mats.beaconM, p[0], y0 + 0.5 + rb * 2 + 0.1, p[1]);
  });

  /* ---------- Torre de matriz en fase (x2) ---------- */
  var arrs = [];
  function buildArray(AX, AZ, front) {
    box(group, 1.6, 2.4, 1.6, mats.concD, AX, y0 + 1.2, AZ, 0.05); box(group, 1.8, 0.16, 1.8, mats.conc, AX, y0 + 2.48, AZ, 0.03);
    for (var kk = 0; kk < 4; kk++) box(group, 0.1, 2.2, 0.1, mats.trim, AX + (kk % 2 ? 0.75 : -0.75), y0 + 1.2, AZ + (kk < 2 ? 0.75 : -0.75), 0.01);
    var ag = new THREE.Group(); ag.position.set(AX, y0 + 2.6, AZ); group.add(ag);
    cylP(ag, 0.45, 0.55, 0.25, 16, mats.hull2, 0, 0.12, 0); cylP(ag, 0.24, 0.24, 0.8, 12, mats.trim, 0, 0.65, 0);
    var af = new THREE.Group(); af.position.set(0, 1.8, 0); ag.add(af);
    box(af, 2.4, 2.4, 0.3, mats.panel, 0, 0, 0.1, 0.05); box(af, 2.2, 2.2, 0.04, mats.arr, 0, 0, 0.28, 0.01);
    var cl = []; for (j = 0; j < 12; j++) for (i = 0; i < 12; i++) cl.push({ x: -1.0 + i * 0.18, y: -1.0 + j * 0.18, z: 0.31, sx: 0.12, sy: 0.12, sz: 0.02 });
    af.add(boxField(UB, mats.eC, cl));
    strutIn(af, [-1.1, -1.2, 0.0], [-0.5, -2.0, -0.25], 0.05, mats.trim); strutIn(af, [1.1, -1.2, 0.0], [0.5, -2.0, -0.25], 0.05, mats.trim);
    box(af, 1.5, 0.1, 0.4, mats.hull2, 0, -1.4, -0.1, 0.02); af.rotation.x = -0.28;
    arrs.push({ g: ag, dir: front });
  }
  buildArray(-8.4, -0.4, 1); buildArray(8.4, 0.9, -1);

  /* ---------- Mástiles reticulados ---------- */
  var masts = [];
  function buildMast(MX, MZ, NS, MH, R0, R1, nPan, nDish) {
    var mast = new THREE.Group(); mast.position.set(MX, y0, MZ); group.add(mast);
    function mr(s) { return R0 + (R1 - R0) * s / NS; } function my(s) { return 0.3 + MH * s / NS; }
    function leg(a, s) { return [Math.cos(a) * mr(s), my(s), Math.sin(a) * mr(s)]; }
    cylP(mast, R0 + 0.8, R0 + 0.9, 0.25, 6, mats.conc, 0, 0.125, 0);
    var legA = [P / 2, P / 2 + TAU / 3, P / 2 + 2 * TAU / 3];
    for (i = 0; i < 3; i++) { var fp = leg(legA[i], 0); box(mast, 0.55, 0.22, 0.55, mats.concD, fp[0], 0.32, fp[2], 0.03); cylP(mast, 0.13, 0.13, 0.12, 8, mats.trim, fp[0], 0.44, fp[2]); }
    for (j = 0; j < NS; j++) {
      var segM = j % 2 ? mats.mastW : mats.mastR;
      for (i = 0; i < 3; i++) { var a = legA[i], b = legA[(i + 1) % 3]; strutIn(mast, leg(a, j), leg(a, j + 1), 0.055, segM); strutIn(mast, leg(a, j + 1), leg(b, j + 1), 0.03, mats.mastW); strutIn(mast, j % 2 ? leg(a, j) : leg(b, j), j % 2 ? leg(b, j + 1) : leg(a, j + 1), 0.024, mats.mastW); }
    }
    for (j = 0; j <= NS; j++) for (i = 0; i < 3; i++) { var nd = leg(legA[i], j); add(mast, new THREE.SphereGeometry(0.065, 8, 6), mats.trim, nd[0], nd[1], nd[2]); }
    [NS * 0.33, NS * 0.7].forEach(function (s) {
      var PL = new THREE.Group(); PL.position.set(0, my(s), 0); mast.add(PL); var rp = mr(s) + 0.15;
      add(PL, new THREE.RingGeometry(0.2, rp + 0.1, 3, 1).rotateX(-P / 2), mats.trim, 0, 0, 0);
      add(PL, new THREE.TorusGeometry(rp, 0.02, 6, 24).rotateX(P / 2), mats.accent, 0, 0.9, 0); add(PL, new THREE.TorusGeometry(rp, 0.016, 6, 24).rotateX(P / 2), mats.accent, 0, 0.45, 0);
      for (i = 0; i < 9; i++) { var pa2 = i / 9 * TAU; strutIn(PL, [Math.cos(pa2) * rp, 0, Math.sin(pa2) * rp], [Math.cos(pa2) * rp, 0.9, Math.sin(pa2) * rp], 0.014, mats.accent); }
    });
    for (q = 0; q < nPan; q++) {
      var sn = NS * (0.8 - (q % 2) * 0.35);
      for (i = 0; i < 3; i++) {
        var sg = new THREE.Group(); sg.rotation.y = -(legA[i] + (q % 2) * 0.5); sg.position.y = my(sn); mast.add(sg); var rr = mr(sn);
        box(sg, 0.08, 1.4, 0.32, mats.panel, rr + 0.34, 0, 0, 0.02); box(sg, 0.03, 1.3, 0.24, mats.concD, rr + 0.28, 0, 0, 0.01);
        strutIn(sg, [rr, 0.45, 0], [rr + 0.3, 0.45, 0], 0.025, mats.trim); strutIn(sg, [rr, -0.45, 0], [rr + 0.3, -0.45, 0], 0.025, mats.trim);
      }
    }
    for (q = 0; q < nDish; q++) {
      var sd = NS * (0.25 + 0.4 * (q / Math.max(1, nDish - 1))), ang = q * 2.1 + 0.4;
      var mg = new THREE.Group(); mg.rotation.y = -ang; mg.position.y = my(sd); mast.add(mg); var rd = mr(sd);
      strutIn(mg, [rd, 0, 0], [rd + 0.34, 0, 0], 0.03, mats.trim);
      var dd = new THREE.Group(); dd.position.set(rd + 0.38, 0, 0); dd.rotation.y = P / 2; mg.add(dd);
      dd.add(capDish(dd, 0.5, 0.9)); strutIn(dd, [0, 0, 0.22], [0, 0, 0.5], 0.012, mats.trim); add(dd, new THREE.SphereGeometry(0.045, 8, 6), mats.hull2, 0, 0, 0.52);
    }
    cylP(mast, 0.03, 0.05, 1.8, 8, mats.mastW, 0, my(NS) + 0.9, 0);
    var tl = add(mast, new THREE.SphereGeometry(0.11, 12, 10), mats.beaconM, 0, my(NS) + 1.85, 0);
    var ml = add(mast, new THREE.SphereGeometry(0.09, 10, 8), mats.beaconM, 0, my(NS * 0.5), mr(NS * 0.5) + 0.05);
    masts.push({ tl: tl, ml: ml, topY: y0 + my(NS) + 1.85, x: MX, z: MZ });
  }
  buildMast(8.6, -3.8, 10, 12.0, 1.0, 0.24, 2, 5);
  buildMast(-8.6, 5.2, 8, 9.5, 0.9, 0.22, 1, 3);

  /* ---------- Servicios: generadores, depósito, baterías, paneles solares, garita ---------- */
  [[3.4, 5.0], [5.8, 5.0]].forEach(function (p) {
    box(group, 1.8, 1.1, 1.1, mats.cont, p[0], y0 + 0.6, p[1], 0.05); box(group, 1.85, 0.1, 1.15, mats.accent, p[0], y0 + 1.14, p[1], 0.02);
    for (k = 0; k < 8; k++) box(group, 0.04, 0.55, 0.03, mats.dark, p[0] - 0.6 + k * 0.17, y0 + 0.6, p[1] + 0.57, 0.005);
    cylP(group, 0.08, 0.08, 0.7, 10, mats.trim, p[0] + 0.5, y0 + 1.45, p[1] - 0.2); cylP(group, 0.12, 0.12, 0.04, 10, mats.dark, p[0] + 0.5, y0 + 1.82, p[1] - 0.2);
  });
  var tk = cylP(group, 0.45, 0.45, 2.8, 18, mats.hull2, 4.6, y0 + 0.82, 6.6); tk.rotation.z = P / 2;
  [-0.9, 0.9].forEach(function (dx) { box(group, 0.12, 0.38, 0.9, mats.trim, 4.6 + dx, y0 + 0.19, 6.6, 0.01); add(group, new THREE.TorusGeometry(0.455, 0.02, 6, 20).rotateY(P / 2), mats.accent, 4.6 + dx * 0.8, y0 + 0.82, 6.6); });
  pipeRun([[4.6, y0 + 0.4, 5.5], [4.6, y0 + 0.25, 5.9], [4.6, y0 + 0.25, 6.2]], 0.05, mats.pipe);
  [[8.0, 3.2], [8.0, 4.7]].forEach(function (p) {
    box(group, 2.4, 1.2, 1.1, mats.contB, p[0], y0 + 0.65, p[1], 0.05); for (k = 0; k < 9; k++) box(group, 0.03, 0.85, 0.03, mats.dark, p[0] - 1.0 + k * 0.25, y0 + 0.65, p[1] + 0.57, 0.004);
    add(group, new THREE.SphereGeometry(0.04, 6, 6), mats.green, p[0] + 1.05, y0 + 1.1, p[1] + 0.57);
  });
  for (i = 0; i < 5; i++) {
    var sx2 = i < 3 ? 2.6 + i * 2.2 : -7.2 + (i - 3) * 2.2, sp = new THREE.Group(); sp.position.set(sx2, y0 + 0.5, 8.4); group.add(sp);
    box(sp, 0.1, 0.5, 0.1, mats.trim, -0.7, -0.15, 0.2, 0.01); box(sp, 0.1, 0.5, 0.1, mats.trim, 0.7, -0.15, 0.2, 0.01);
    var pg = new THREE.Group(); pg.rotation.x = 0.55; sp.add(pg); box(pg, 1.9, 0.06, 1.1, mats.solar, 0, 0, 0, 0.015);
    var gl = []; for (k = 1; k < 5; k++) gl.push({ x: -0.95 + k * 0.38, y: 0.035, z: 0, sx: 0.015, sy: 0.01, sz: 1.05 }); for (k = 1; k < 3; k++) gl.push({ x: 0, y: 0.035, z: -0.55 + k * 0.37, sx: 1.85, sy: 0.01, sz: 0.015 });
    pg.add(boxField(UB, mats.cell, gl));
  }
  var GZ = 9.0;
  box(group, 1.2, 1.3, 1.2, mats.panel, 1.5, y0 + 0.65, GZ, 0.04); box(group, 1.4, 0.1, 1.4, mats.conc, 1.5, y0 + 1.35, GZ, 0.02);
  add(group, new THREE.BoxGeometry(0.9, 0.4, 0.05), mats.strip, 1.5, y0 + 0.85, GZ + 0.62); add(group, new THREE.BoxGeometry(0.05, 0.4, 0.9), mats.strip, 0.88, y0 + 0.85, GZ);
  box(group, 0.3, 0.6, 0.3, mats.trim, 0.95, y0 + 0.3, GZ + 0.1, 0.03);
  var arm = new THREE.Group(); group.add(arm); arm.position.set(0.95, y0 + 0.7, GZ + 0.1);
  for (k = 0; k < 6; k++) box(arm, 0.28, 0.09, 0.07, k % 2 ? mats.dark : mats.accent, -0.16 - k * 0.28, 0, 0, 0.005);
  [[-1.8, 8.0], [3.6, 9.3]].forEach(function (p) { cylP(group, 0.06, 0.08, 2.6, 8, mats.hull2, p[0], y0 + 1.3, p[1]); box(group, 0.5, 0.1, 0.22, mats.dark, p[0] + 0.2, y0 + 2.65, p[1], 0.02); add(group, new THREE.BoxGeometry(0.4, 0.03, 0.15), mats.winW, p[0] + 0.2, y0 + 2.59, p[1]); });
  box(group, 1.8, 0.9, 0.08, mats.dark, -2.6, y0 + 1.4, 9.3, 0.03); box(group, 0.08, 1.1, 0.08, mats.trim, -2.6, y0 + 0.55, 9.28, 0.01);
  for (k = 0; k < 3; k++) add(group, new THREE.TorusGeometry(0.12 + k * 0.11, 0.02, 6, 14, P * 0.7).rotateZ(-P * 0.35), mats.eC, -2.95, y0 + 1.4, 9.35);
  add(group, new THREE.SphereGeometry(0.05, 8, 6), mats.eC, -2.95, y0 + 1.4, 9.35); box(group, 0.8, 0.08, 0.015, mats.accent, -2.3, y0 + 1.62, 9.35, 0.005); box(group, 0.55, 0.05, 0.015, mats.dim, -2.4, y0 + 1.36, 9.35, 0.005);

  /* ---------- Pulsos de señal, humo y animación ---------- */
  var pulses = [];
  for (i = 0; i < 3; i++) { var pm = glowMat(0x35e0ff, 0.3), pr = new THREE.Mesh(new THREE.TorusGeometry(1, 0.022, 6, 64).rotateX(P / 2), pm); pr.position.set(TX, spireTop - 1.0, TZ); pr.frustumCulled = false; group.add(pr); pulses.push({ m: pr, mat: pm, ph: i / 3 }); }
  var puffsA = [];
  for (i = 0; i < 4; i++) { var pf = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 6), mats.smoke.clone()); pf.frustumCulled = false; group.add(pf); puffsA.push({ m: pf, ph: i / 4 }); }
  var entrance = new THREE.Object3D(); group.add(entrance); entrance.position.set(0, SLAB + 0.2, 9.9);
  var twMesh = boxField(UB, mats.winW, twL); group.add(twMesh);

  /* ---------- Estados y API ---------- */
  var mode = 'working', level = 0.7, lastT = null, demoT = 0, ghost = false, origEm = {}, az = 0, el = 0.7, radarA = 0, armA = 0, arrA = 0;
  var api = {
    group: group,
    footprint: { w: SZ, d: SZ },
    entrance: entrance,
    input: new THREE.Object3D(),     // energía (borde -X)
    output: new THREE.Object3D(),    // enlace de datos (borde +X)
    nivel: 3,
    demo: true,
    getState: function () { return mode; },
    getSignal: function () { return level; },
    setSignal: function (f) { level = clamp(f, 0, 1); },
    setState: function (s) { api.demo = false; mode = s; },
    setAccent: setAccent,
    setGhost: function (on, valid) {
      ghost = !!on; for (i = 0; i < radomeEdges.length; i++) radomeEdges[i].visible = !ghost;
      for (var key in mats) {
        var m = mats[key];
        if (m === mats.smoke || m === mats.lineR) continue;
        if (!m.isMeshStandardMaterial && !m.isMeshBasicMaterial) continue;
        if (m.isMeshStandardMaterial && !origEm[key]) origEm[key] = { c: m.emissive.getHex(), i: m.emissiveIntensity };
        var own = key === 'glassL' ? 0.3 : null;
        m.transparent = ghost || own != null; m.opacity = ghost ? 0.45 : (own != null ? own : 1); m.depthWrite = !ghost && own == null;
        if (m.isMeshStandardMaterial) {
          if (ghost) { m.emissive.setHex(valid === false ? 0xff2a2a : 0x25ff7a); m.emissiveIntensity = 0.5; }
          else { m.emissive.setHex(origEm[key].c); m.emissiveIntensity = origEm[key].i; }
        }
        m.needsUpdate = true;
      }
    },
    update: function (t) {
      var dt = lastT == null ? 0 : Math.min(0.1, t - lastT);
      lastT = t;
      if (api.demo) { demoT += dt; level = 0.65 + 0.3 * Math.sin(demoT * 0.2); mode = (demoT % 70) > 62 ? 'alert' : 'working'; }
      var on = mode !== 'off', alive = (mode === 'working' || mode === 'alert') && !ghost;
      var tAz = mode === 'working' ? Math.sin(t * 0.12) * 1.1 : mode === 'alert' ? -0.4 : mode === 'broken' ? 0.9 : 0;
      var tEl = mode === 'working' ? 0.7 + 0.25 * Math.sin(t * 0.09 + 1) : mode === 'alert' ? 1.05 : mode === 'broken' ? 0.15 : 0.5;
      var sp2 = Math.min(1, dt * 1.5);
      az += (tAz - az) * sp2; el += (tEl - el) * sp2;
      for (i = 0; i < dishes.length; i++) { var dsh = dishes[i]; dsh.dY.rotation.y = az * (dsh.big ? 1 : 0.8) + (dsh.big ? 0 : (i % 3 - 1) * 0.04); dsh.dX.rotation.x = el + (dsh.big ? 0 : ((i % 2) * 0.05 - 0.02)); }
      radarA += dt * (alive ? (mode === 'alert' ? 5.5 : 2.2) : 0); radarH.rotation.y = radarA;
      arrA += dt * (alive ? (mode === 'alert' ? 1.4 : 0.45) : 0);
      for (i = 0; i < arrs.length; i++) arrs[i].g.rotation.y = arrA * arrs[i].dir;
      for (i = 0; i < holo.length; i++) { var hh = holo[i]; if (alive) { hh.g.rotation.y += dt * hh.sp; hh.g.rotation.z += dt * hh.sp * 0.6; } hh.g.visible = on && !ghost; }
      for (i = 0; i < fans.length; i++) fans[i].rotation.y += alive ? dt * 9 : 0;
      var ac = mode === 'alert' ? 0xff5a4a : 0x35e0ff;
      beam.visible = alive && level > 0.05; beamCore.visible = beam.visible;
      if (beam.visible) { beamMat.opacity = 0.16 + 0.14 * Math.sin(t * 3) + level * 0.12; beamMat.color.setHex(mode === 'alert' ? 0xff6a5a : 0x7ff0ff); mats.holo.color.setHex(mode === 'alert' ? 0xffb0a0 : 0x7ff0ff); }
      for (i = 0; i < pulses.length; i++) {
        var pu = pulses[i], ph = (t * 0.3 + pu.ph) % 1, vis = alive && level > 0.05;
        pu.m.visible = vis;
        if (vis) { var sc = 0.6 + ph * (3.2 + level * 3.5); pu.m.scale.set(sc, sc, sc); pu.mat.opacity = (1 - ph) * 0.32; pu.mat.color.setHex(ac); }
      }
      var nb = on ? Math.ceil(level * 5 - 0.001) : 0;
      for (i = 0; i < 5; i++) sigOn[i].visible = mode === 'broken' ? (i < 2 && Math.sin(t * 7 + i) > 0) : i < nb;
      var blink = Math.sin(t * (mode === 'alert' ? 8 : 2.2)) > 0;
      topLamp1.visible = on && (mode === 'broken' ? Math.sin(t * 3) > 0.6 : blink);
      for (i = 0; i < masts.length; i++) { masts[i].tl.visible = on && (mode === 'broken' ? Math.sin(t * 3 + i) > 0.6 : (i ? !blink : blink)); masts[i].ml.visible = on && (mode === 'alert' ? !blink : blink); }
      var col = mode === 'working' ? 0x35ff7a : mode === 'alert' ? 0xff3b30 : mode === 'broken' ? 0xffa31a : 0x303030;
      if (mode === 'alert' || mode === 'broken') mats.status.color.setHex(Math.sin(t * 6) > 0 ? col : 0x301010); else mats.status.color.setHex(col);
      mats.eC.color.setHex(on ? ac : 0x1a4650);
      edgeM.visible = on;
      var wv = on && (mode !== 'broken' || Math.sin(t * 9) > -0.4); twMesh.visible = wv; dkMesh.visible = wv;
      ledMG.visible = on && Math.sin(t * 5) > -0.2; ledMA.visible = on && Math.sin(t * 3.1 + 1) > -0.3;
      var gateOpen = alive && (t % 11) > 3 && (t % 11) < 7.5;
      armA += ((gateOpen || !on ? -1.3 : 0) - armA) * Math.min(1, dt * 3); arm.rotation.z = armA;
      var smoking = alive && (mode === 'alert' || level > 0.8);
      for (i = 0; i < puffsA.length; i++) {
        var pp = puffsA[i], pf2 = (t * 0.3 + pp.ph) % 1;
        pp.m.visible = smoking;
        if (smoking) { pp.m.position.set(3.9 + pf2 * 0.6, y0 + 1.85 + pf2 * 1.4, 4.8); pp.m.scale.setScalar(0.6 + pf2 * 2); pp.m.material.opacity = (1 - pf2) * 0.3; }
      }
    }
  };
  api.input.position.set(-10.0, SLAB + 0.5, -3.0); group.add(api.input);
  api.output.position.set(10.0, SLAB + 0.5, -3.0); group.add(api.output);
  api.update(0);
  return api;
}
