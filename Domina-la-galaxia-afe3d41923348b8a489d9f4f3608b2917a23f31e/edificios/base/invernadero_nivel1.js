/**
 * Invernadero (NIVEL 1 de 2) para Three.js, sin archivos externos. Instalación mediana para producir alimentos en el planeta.
 *
 * Dos naves de cristal en bóveda con costillas de acero, ventanas de cumbrera que se abren y panel evaporativo con extractores:
 * la nave A cultiva tomates en espaldera (crecen y maduran de verde a rojo, con aspersores y rocío); la nave B es un cultivo
 * hidropónico de lechugas en bastidores de 3 niveles con luces de crecimiento magenta. Domo geodésico de recepción con árbol,
 * depósito de agua elevado, cisternas, compostaje, caseta de embalaje con cajas, caseta de control con caldera y vapor, tanques
 * de CO2, estación meteorológica con anemómetro, paneles solares, postes de luz y letrero. Sin vallas ni dron.
 *
 * Uso:
 *   const gh = createInvernadero1(THREE, { accent: 0x4fce6a });
 *   gh.group.position.set(x, groundY, z);        // la base de la losa está en y = 0
 *   scene.add(gh.group);
 *   gh.update(clock.getElapsedTime());
 *
 * Escala: 1 unidad = 4 m. Huella: 14 x 14 unidades (gh.footprint), centrada en el origen. Altura ~7 (depósito).
 * Entrada: gh.entrance (borde +Z). Agua/energía: gh.input (borde -X). Cosecha: gh.output (borde +X). gh.nivel = 1.
 *
 * Estados (gh.setState): 'working' (ventanas abren y cierran, ventiladores, aspersores, anemómetro), 'alert' (rojo,
 *   ventanas cerradas), 'broken' (luces y ventanas fallando), 'off'. Por defecto corre una demostración (gh.demo = true).
 *   gh.setGrowth(0..1): estado de los cultivos (tamaño y madurez). gh.setGhost(true, valid) para colocar; gh.setAccent(hex).
 * Compatible con Three.js r128 o superior.
 */
function createInvernadero1(THREE, opts) {
  opts = opts || {};
  var P = Math.PI, TAU = P * 2;
  var colors = {
    hull: opts.hull != null ? opts.hull : 0xd3d7dd,
    accent: opts.accent != null ? opts.accent : 0x4fce6a,
    dark: opts.dark != null ? opts.dark : 0x161c28,
    glow: opts.glow != null ? opts.glow : 0x6dff9a
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
  var SLAB = 0.4, SZ = 14, k, j, i, q, y0 = SLAB;
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
  mats.glassG = std(0xbfeccf, 0.15, 0.05, { transparent: true, opacity: 0.26, depthWrite: false });
  mats.glassF = std(0xd9f7e6, 0.2, 0.05, { transparent: true, opacity: 0.2, depthWrite: false });
  mats.frame = std(0xdfe5e8, 0.6, 0.4);
  mats.winW = bas(0xffe3a0); mats.eC = bas(0x6dff9a); mats.dim = bas(0x23303c);
  mats.road = std(0x363940, 0.2, 0.85);
  mats.soil = std(0x4a3a2c, 0, 0.95); mats.soilD = std(0x372a20, 0, 0.95); mats.wood = std(0x9a7448, 0, 0.85);
  mats.leaf = std(0x3f9a4c, 0, 0.8); mats.leaf2 = std(0x2a7a3c, 0, 0.8); mats.leaf3 = std(0x7ccf55, 0, 0.8); mats.leafP = std(0x7a3f8a, 0, 0.8);
  mats.fruitR = std(0xd9362a, 0, 0.5); mats.fruitG = std(0x7cc24a, 0, 0.5); mats.bark = std(0x6b4a2f, 0, 0.9);
  mats.growL = bas(0xff4fd8); mats.water = std(0x4aa8d8, 0.3, 0.25, { transparent: true, opacity: 0.85 });
  mats.solar = std(0x16264a, 0.85, 0.22, { emissive: 0x0a1a3a, emissiveIntensity: 0.4 });
  mats.cell = std(0x6d86b8, 0.8, 0.3);
  mats.tank = std(0xe7ecef, 0.3, 0.5); mats.blue = std(0x2f7bc0, 0.4, 0.5);
  mats.pad = std(0xc9b88a, 0.05, 0.95);
  mats.mist = new THREE.MeshBasicMaterial({ color: 0xe8f6ff, transparent: true, opacity: 0.25, depthWrite: false });
  mats.smoke = new THREE.MeshBasicMaterial({ color: 0xdadada, transparent: true, opacity: 0.25, depthWrite: false });
  mats.lineR = new THREE.LineBasicMaterial({ color: 0xcfe9dc, transparent: true, opacity: 0.8 });
  var domeEdges = [], fanGroups = [], growS = [], hanFans = [];

  /* ---------- Losa, avenida y luces de borde ---------- */
  box(group, SZ, SLAB, SZ, mats.slab, 0, SLAB / 2, 0, 0.06);
  box(group, SZ - 0.6, 0.04, SZ - 0.6, mats.conc, 0, SLAB + 0.01, 0, 0.01);
  box(group, 1.3, 0.05, 3.2, mats.road, 0, SLAB + 0.03, 5.4, 0.01);
  for (k = 0; k < 4; k++) box(group, 0.08, 0.052, 0.4, mats.panel, 0, SLAB + 0.035, 6.7 - k * 0.7, 0.005);
  var edgeL = [];
  for (k = 0; k < 15; k++) { var ev = -6.3 + k * 0.9; edgeL.push({ x: ev, y: SLAB + 0.03, z: -6.82, sx: 0.28, sy: 0.03, sz: 0.08 }); edgeL.push({ x: ev, y: SLAB + 0.03, z: 6.82, sx: 0.28, sy: 0.03, sz: 0.08 }); edgeL.push({ x: -6.82, y: SLAB + 0.03, z: ev, sx: 0.08, sy: 0.03, sz: 0.28 }); edgeL.push({ x: 6.82, y: SLAB + 0.03, z: ev, sx: 0.08, sy: 0.03, sz: 0.28 }); }
  var edgeM = boxField(UB, mats.eC, edgeL); group.add(edgeM);

  /* ---------- Dos naves de cristal en bóveda ---------- */
  var HW = 4.4, WH = 1.3, HL = 8.4, HZ0 = -6.2, HZc = HZ0 + HL / 2, NR = 9, ARCH = 0.78, hallX = [-2.45, 2.45], flaps = [];
  hallX.forEach(function (hx, h) {
    var hg = new THREE.Group(); hg.position.set(hx, y0, HZc); group.add(hg);
    box(hg, HW + 0.2, 0.3, HL + 0.2, mats.concD, 0, 0.15, 0, 0.03);                                     // zócalo
    box(hg, 0.08, WH, HL, mats.glassG, -HW / 2, 0.3 + WH / 2, 0, 0.005); box(hg, 0.08, WH, HL, mats.glassG, HW / 2, 0.3 + WH / 2, 0, 0.005);
    box(hg, HW, 0.1, 0.1, mats.frame, 0, 0.3, -HL / 2, 0.01);
    var vg = new THREE.CylinderGeometry(HW / 2, HW / 2, HL, 26, 1, true, P / 2, P); vg.rotateX(P / 2); vg.scale(1, ARCH, 1);
    add(hg, vg, mats.glassG, 0, 0.3 + WH, 0);
    for (i = 0; i < NR; i++) {
      var rz = -HL / 2 + 0.1 + i * (HL - 0.2) / (NR - 1);
      var arc = new THREE.Mesh(new THREE.TorusGeometry(HW / 2, 0.04, 6, 26, P), mats.frame); arc.scale.y = ARCH; arc.position.set(0, 0.3 + WH, rz); hg.add(arc);
      strutIn(hg, [-HW / 2, 0.3, rz], [-HW / 2, 0.3 + WH, rz], 0.04, mats.frame); strutIn(hg, [HW / 2, 0.3, rz], [HW / 2, 0.3 + WH, rz], 0.04, mats.frame);
      strutIn(hg, [-HW / 2, 0.3 + WH * 0.55, rz], [HW / 2, 0.3 + WH * 0.55, rz], 0.014, mats.trim);       // tirante
    }
    box(hg, 0.12, 0.1, HL, mats.frame, 0, 0.3 + WH + HW / 2 * ARCH + 0.04, 0, 0.01);                      // cumbrera
    for (i = 0; i < 3; i++) { var a3 = P * (0.2 + i * 0.3); box(hg, 0.05, 0.05, HL, mats.frame, Math.cos(a3) * HW / 2 * 0.99, 0.3 + WH + Math.sin(a3) * HW / 2 * ARCH, 0, 0.005); box(hg, 0.05, 0.05, HL, mats.frame, -Math.cos(a3) * HW / 2 * 0.99, 0.3 + WH + Math.sin(a3) * HW / 2 * ARCH, 0, 0.005); }
    // ventanas de cumbrera (se abren)
    [-1, 1].forEach(function (s) {
      var fg = new THREE.Group(); fg.position.set(s * 0.1, 0.3 + WH + HW / 2 * ARCH + 0.1, 0); hg.add(fg);
      box(fg, 0.7, 0.04, HL - 0.5, mats.glassF, s * 0.35, 0, 0, 0.005); box(fg, 0.04, 0.06, HL - 0.5, mats.frame, s * 0.7, 0, 0, 0.005); box(fg, 0.04, 0.06, HL - 0.5, mats.frame, 0.0, 0, 0, 0.005);
      flaps.push({ g: fg, s: s, h: h });
    });
    // pared trasera: panel evaporativo (colmena) y dos extractores
    box(hg, HW, WH + 0.5, 0.15, mats.frame, 0, 0.3 + (WH + 0.5) / 2, -HL / 2 - 0.02, 0.01);
    var padL = []; for (j = 0; j < 4; j++) for (i = 0; i < 8; i++) padL.push({ x: -1.75 + i * 0.5, y: 0.5 + j * 0.32, z: -HL / 2 - 0.12, sx: 0.4, sy: 0.24, sz: 0.06 });
    hg.add(boxField(UB, mats.pad, padL));
    cylP(hg, 0.55, 0.55, 0.2, 20, mats.hull2, 0, 0.3 + WH + 0.6, -HL / 2 - 0.1).rotation.x = P / 2;
    var fg2 = new THREE.Group(); fg2.position.set(0, 0.3 + WH + 0.6, -HL / 2 - 0.22); hg.add(fg2);
    for (k = 0; k < 4; k++) { var bl = box(fg2, 0.1, 0.46, 0.015, mats.trim, 0, 0, 0, 0.003); bl.position.set(Math.cos(k * P / 2 + 0.4) * 0.23, Math.sin(k * P / 2 + 0.4) * 0.23, 0); bl.rotation.z = k * P / 2 + 0.4 - P / 2; }
    cylP(fg2, 0.07, 0.07, 0.05, 8, mats.accent, 0, 0, 0.02).rotation.x = P / 2;
    fanGroups.push(fg2);
  });

  /* ---------- Cultivos: nave A = tomates en espaldera, nave B = hidroponía de lechugas en 3 niveles ---------- */
  var dd = new THREE.Object3D();
  function setM(mesh, idx, x, y, z, sx, sy, sz) { dd.position.set(x, y, z); dd.rotation.set(0, 0, 0); dd.scale.set(sx, sy, sz); dd.updateMatrix(); mesh.setMatrixAt(idx, dd.matrix); }
  var AXc = hallX[0], BXc = hallX[1], plantsA = [], letts = [], by = y0 + 0.42;
  [-1.2, 1.2].forEach(function (dx) {
    box(group, 0.95, 0.24, HL - 0.5, mats.soil, AXc + dx, y0 + 0.3, HZc, 0.03); box(group, 1.05, 0.1, HL - 0.4, mats.wood, AXc + dx, y0 + 0.22, HZc, 0.02);
    cylP(group, 0.02, 0.02, HL - 0.8, 6, mats.dark, AXc + dx, y0 + 0.44, HZc).rotation.x = P / 2;
    strutIn(group, [AXc + dx, y0 + 2.45, HZ0 + 0.4], [AXc + dx, y0 + 2.45, HZ0 + HL - 0.4], 0.012, mats.trim);
    for (i = 0; i < 7; i++) {
      var pz = HZ0 + 0.9 + i * 1.1; plantsA.push({ x: AXc + dx, z: pz, ph: rnd() * TAU });
      strutIn(group, [AXc + dx, y0 + 2.45, pz], [AXc + dx, by, pz], 0.006, mats.trim);
    }
  });
  box(group, 1.0, 0.04, HL - 0.6, mats.wood, AXc, y0 + 0.32, HZc, 0.01);
  // tubería aérea con aspersores (nave A)
  cylP(group, 0.04, 0.04, HL - 0.6, 8, mats.blue, AXc, y0 + 2.6, HZc).rotation.x = P / 2;
  var nozz = []; for (i = 0; i < 8; i++) { var nz = HZ0 + 0.7 + i * 1.0; add(group, new THREE.SphereGeometry(0.05, 8, 6), mats.trim, AXc, y0 + 2.52, nz); nozz.push(nz); strutIn(group, [AXc, y0 + 2.6, nz], [AXc, y0 + 2.52, nz], 0.012, mats.trim); }
  var tomS = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.03, 0.04, 1, 6), mats.leaf2, plantsA.length);
  var tomL = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 8, 6), mats.leaf, plantsA.length * 5);
  var tomR = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 8, 6), mats.fruitR, plantsA.length * 4), tomG = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 8, 6), mats.fruitG, plantsA.length * 4);
  [tomS, tomL, tomR, tomG].forEach(function (m) { m.frustumCulled = false; group.add(m); });
  // hidroponía
  [-1.2, 1.2].forEach(function (dx) {
    var rx = BXc + dx;
    for (k = 0; k < 2; k++) { var zE = k ? HZ0 + HL - 0.4 : HZ0 + 0.4; [-0.42, 0.42].forEach(function (o) { box(group, 0.07, 2.2, 0.07, mats.hull2, rx + o, y0 + 1.4, zE, 0.01); }); }
    for (k = 1; k < 5; k++) { var zP = HZ0 + 0.4 + k * (HL - 0.8) / 5; [-0.42, 0.42].forEach(function (o) { box(group, 0.05, 2.2, 0.05, mats.hull2, rx + o, y0 + 1.4, zP, 0.01); }); }
    for (j = 0; j < 3; j++) {
      var ty2 = y0 + 0.6 + j * 0.6;
      box(group, 0.95, 0.07, HL - 0.7, mats.tank, rx, ty2, HZc, 0.01); box(group, 0.7, 0.03, HL - 0.8, mats.water, rx, ty2 + 0.04, HZc, 0.005);
      box(group, 0.08, 0.05, HL - 0.7, mats.hull2, rx - 0.45, ty2 + 0.05, HZc, 0.005); box(group, 0.08, 0.05, HL - 0.7, mats.hull2, rx + 0.45, ty2 + 0.05, HZc, 0.005);
      growS.push({ x: rx, y: ty2 + 0.5, z: HZc, sx: 0.7, sy: 0.03, sz: HL - 1.0 });
      for (i = 0; i < 12; i++) letts.push({ x: rx + (i % 2 ? 0.12 : -0.12), y: ty2 + 0.1, z: HZ0 + 0.6 + i * 0.62, ph: rnd() * TAU, c: (i + j + (dx > 0 ? 1 : 0)) % 3 === 0 ? 1 : 0 });
    }
    cylP(group, 0.045, 0.045, HL - 0.8, 8, mats.blue, rx - 0.55, y0 + 0.45, HZc).rotation.x = P / 2;
  });
  box(group, 1.0, 0.04, HL - 0.6, mats.wood, BXc, y0 + 0.32, HZc, 0.01);
  var growMesh = boxField(UB, mats.growL, growS); group.add(growMesh);
  var lettG = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 10, 6), mats.leaf3, letts.length), lettP = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 10, 6), mats.leafP, letts.length);
  lettG.frustumCulled = false; lettP.frustumCulled = false; group.add(lettG); group.add(lettP);
  function updatePlants(g, t) {
    var h, n, x, z, a, ph, sw, hh, fr;
    for (n = 0; n < plantsA.length; n++) {
      var pl = plantsA[n]; h = 0.25 + 1.6 * g; sw = Math.sin(t * 0.9 + pl.ph) * 0.03 * g;
      setM(tomS, n, pl.x, by + h / 2, pl.z, 1, h, 1);
      for (j = 0; j < 5; j++) { hh = by + h * (0.2 + j * 0.18); a = j * 2.2 + pl.ph; setM(tomL, n * 5 + j, pl.x + Math.cos(a) * 0.17 * g + sw * (0.3 + j * 0.2), hh, pl.z + Math.sin(a) * 0.17 * g, 0.2 * (0.35 + 0.65 * g), 0.1 * (0.35 + 0.65 * g), 0.2 * (0.35 + 0.65 * g)); }
      for (j = 0; j < 4; j++) {
        hh = by + h * (0.28 + j * 0.15); a = j * 1.7 + pl.ph; x = pl.x + Math.cos(a) * 0.15 + sw * 0.5; z = pl.z + Math.sin(a) * 0.15; fr = 0.09 * clamp((g - 0.3) / 0.5, 0, 1);
        setM(tomR, n * 4 + j, x, hh, z, g > 0.75 ? fr : 0.0001, g > 0.75 ? fr : 0.0001, g > 0.75 ? fr : 0.0001);
        setM(tomG, n * 4 + j, x, hh, z, g > 0.75 || g < 0.3 ? 0.0001 : fr, g > 0.75 || g < 0.3 ? 0.0001 : fr, g > 0.75 || g < 0.3 ? 0.0001 : fr);
      }
    }
    for (n = 0; n < letts.length; n++) {
      var lt = letts[n], s = 0.05 + 0.15 * g + Math.sin(t * 0.7 + lt.ph) * 0.004;
      setM(lt.c ? lettP : lettG, n, lt.x, lt.y + s * 0.4, lt.z, s, s * 0.65, s);
      setM(lt.c ? lettG : lettP, n, lt.x, lt.y, lt.z, 0.0001, 0.0001, 0.0001);
    }
    [tomS, tomL, tomR, tomG, lettG, lettP].forEach(function (m) { m.instanceMatrix.needsUpdate = true; });
  }

  /* ---------- Domo de recepción acristalado con árbol central ---------- */
  var DCZ = 4.6, DR = 2.0;
  cylP(group, DR + 0.1, DR + 0.15, 0.6, 28, mats.concD, 0, y0 + 0.3, DCZ); cylP(group, DR - 0.1, DR - 0.1, 0.05, 28, mats.road, 0, y0 + 0.62, DCZ);
  var dg = new THREE.SphereGeometry(DR, 16, 8, 0, TAU, 0, P / 2);
  add(group, dg, mats.glassG, 0, y0 + 0.6, DCZ);
  var de = new THREE.LineSegments(new THREE.EdgesGeometry(dg, 1), mats.lineR); de.position.set(0, y0 + 0.6, DCZ); group.add(de); domeEdges.push(de);
  for (i = 0; i < 8; i++) { var mer = new THREE.Mesh(new THREE.TorusGeometry(DR, 0.028, 6, 22, P), mats.frame); mer.rotation.y = i * P / 8; mer.position.set(0, y0 + 0.6, DCZ); group.add(mer); }
  [0.45, 0.9, 1.25].forEach(function (a) { add(group, new THREE.TorusGeometry(DR * Math.cos(a), 0.03, 6, 28).rotateX(P / 2), mats.frame, 0, y0 + 0.6 + DR * Math.sin(a), DCZ); });
  cylP(group, 0.08, 0.08, 0.3, 8, mats.frame, 0, y0 + 0.6 + DR + 0.1, DCZ); add(group, new THREE.SphereGeometry(0.08, 8, 6), mats.accent, 0, y0 + 0.6 + DR + 0.3, DCZ);
  // puerta de entrada
  box(group, 0.1, 1.8, 0.1, mats.frame, -0.7, y0 + 1.5, DCZ + DR - 0.05, 0.01); box(group, 0.1, 1.8, 0.1, mats.frame, 0.7, y0 + 1.5, DCZ + DR - 0.05, 0.01); box(group, 1.5, 0.12, 0.12, mats.frame, 0, y0 + 2.42, DCZ + DR - 0.05, 0.01);
  box(group, 1.9, 0.08, 0.7, mats.conc, 0, y0 + 2.6, DCZ + DR + 0.2, 0.02);
  // interior: macizo con árbol, bancos y mostrador
  cylP(group, 0.85, 0.9, 0.35, 20, mats.soilD, 0, y0 + 0.78, DCZ - 0.2); cylP(group, 0.7, 0.7, 0.05, 18, mats.soil, 0, y0 + 0.97, DCZ - 0.2);
  cylP(group, 0.07, 0.11, 0.9, 10, mats.bark, 0, y0 + 1.42, DCZ - 0.2);
  [[0, 1.72, 0.52], [0.3, 1.52, 0.4], [-0.3, 1.56, 0.4], [0.06, 1.95, 0.3]].forEach(function (c, n) { add(group, new THREE.SphereGeometry(c[2], 12, 8), n % 2 ? mats.leaf : mats.leaf2, c[0], y0 + c[1], DCZ - 0.2 + (n % 2 ? 0.1 : -0.1)); });
  for (i = 0; i < 4; i++) { var ba = i * P / 2 + P / 4; box(group, 0.7, 0.2, 0.28, mats.wood, Math.cos(ba) * 1.35, y0 + 0.75, DCZ - 0.2 + Math.sin(ba) * 1.35, 0.03).rotation.y = -ba + P / 2; }
  box(group, 1.1, 0.5, 0.35, mats.trim, 0.0, y0 + 0.9, DCZ + 1.3, 0.03); box(group, 0.9, 0.02, 0.25, mats.winW, 0.0, y0 + 1.16, DCZ + 1.3, 0.005);
  [[-1.0, 0.8], [1.0, 0.8]].forEach(function (p) { add(group, new THREE.SphereGeometry(0.1, 10, 8), mats.winW, p[0], y0 + 2.0, DCZ + p[1]); strutIn(group, [p[0], y0 + 2.0, DCZ + p[1]], [p[0] * 0.5, y0 + 2.5, DCZ + p[1] * 0.5], 0.01, mats.trim); });
  // pasillos de cristal a las naves
  [-1, 1].forEach(function (s) { box(group, 1.2, 1.6, 0.9, mats.glassG, s * 1.6, y0 + 0.8, 2.45, 0.02); box(group, 1.3, 0.08, 1.0, mats.frame, s * 1.6, y0 + 1.62, 2.45, 0.01); box(group, 0.06, 1.6, 0.06, mats.frame, s * 1.0, y0 + 0.8, 2.0, 0.01); box(group, 0.06, 1.6, 0.06, mats.frame, s * 2.2, y0 + 0.8, 2.0, 0.01); });

  /* ---------- Servicios: depósito elevado, cisternas, compost, caseta de control, CO2, solar, eólica ---------- */
  var WX = -6.0, WZ = -4.6;
  [[-0.7, -0.7], [0.7, -0.7], [0.7, 0.7], [-0.7, 0.7]].forEach(function (c) { strutIn(group, [WX + c[0], y0, WZ + c[1]], [WX + c[0] * 0.8, y0 + 2.6, WZ + c[1] * 0.8], 0.06, mats.hull2); });
  [0.8, 1.7].forEach(function (yy) { [[-1, -1, 1, -1], [1, -1, 1, 1], [1, 1, -1, 1], [-1, 1, -1, -1]].forEach(function (e) { var f = 0.7 - yy * 0.04; strutIn(group, [WX + e[0] * f, y0 + yy, WZ + e[1] * f], [WX + e[2] * f, y0 + yy, WZ + e[3] * f], 0.025, mats.trim); }); });
  cylP(group, 0.95, 0.95, 1.5, 22, mats.tank, WX, y0 + 3.4, WZ); add(group, new THREE.SphereGeometry(0.95, 18, 8, 0, TAU, 0, P / 2), mats.tank, WX, y0 + 4.15, WZ); add(group, new THREE.TorusGeometry(0.96, 0.04, 6, 24).rotateX(P / 2), mats.blue, WX, y0 + 3.4, WZ);
  cylP(group, 0.95, 0.5, 0.35, 22, mats.tank, WX, y0 + 2.5, WZ); cylP(group, 0.1, 0.1, 0.18, 8, mats.trim, WX, y0 + 4.95, WZ);
  strutIn(group, [WX + 0.95, y0 + 0.1, WZ], [WX + 0.95, y0 + 4.0, WZ], 0.025, mats.trim); strutIn(group, [WX + 1.1, y0 + 0.1, WZ], [WX + 1.1, y0 + 4.0, WZ], 0.025, mats.trim);
  for (k = 0; k < 11; k++) strutIn(group, [WX + 0.95, y0 + 0.3 + k * 0.35, WZ], [WX + 1.1, y0 + 0.3 + k * 0.35, WZ], 0.012, mats.trim);
  pipeRun([[WX, y0 + 2.4, WZ], [WX, y0 + 0.3, WZ], [-4.9, y0 + 0.3, WZ]], 0.07, mats.pipe);
  [-1.6, 0.4].forEach(function (zz) { var cz = cylP(group, 0.5, 0.5, 2.0, 18, mats.tank, -6.0, y0 + 0.65, zz); cz.rotation.x = P / 2; add(group, new THREE.TorusGeometry(0.51, 0.025, 6, 20), mats.blue, -6.0, y0 + 0.65, zz - 0.5); add(group, new THREE.TorusGeometry(0.51, 0.025, 6, 20), mats.blue, -6.0, y0 + 0.65, zz + 0.5); box(group, 0.9, 0.2, 0.15, mats.trim, -6.0, y0 + 0.1, zz - 0.6, 0.01); box(group, 0.9, 0.2, 0.15, mats.trim, -6.0, y0 + 0.1, zz + 0.6, 0.01); });
  pipeRun([[-6.0, y0 + 0.4, -3.0], [-6.0, y0 + 0.3, -3.8]], 0.05, mats.pipe); pipeRun([[-6.0, y0 + 0.3, -0.6], [-6.0, y0 + 0.3, -1.0]], 0.05, mats.pipe);
  [2.0, 3.1, 4.2].forEach(function (zz, n) { box(group, 1.0, 0.7, 0.9, mats.wood, -6.0, y0 + 0.35, zz, 0.03); box(group, 0.9, 0.05, 0.8, n === 1 ? mats.leaf2 : mats.soilD, -6.0, y0 + 0.72, zz, 0.01); });
  box(group, 1.9, 1.4, 1.6, mats.panel, -5.9, y0 + 0.7, 5.8, 0.04); box(group, 2.1, 0.1, 1.8, mats.conc, -5.9, y0 + 1.45, 5.8, 0.02); box(group, 1.4, 0.8, 0.04, mats.dark, -5.9, y0 + 0.55, 6.62, 0.01);
  var crates = []; for (k = 0; k < 6; k++) crates.push({ x: -4.7 + (k % 3) * 0.0, y: y0 + 0.14 + Math.floor(k / 3) * 0.28, z: 5.0 + (k % 3) * 0.0, sx: 0.5, sy: 0.26, sz: 0.4 });
  for (k = 0; k < 6; k++) { var cxp = -5.0, czp = 4.9 + (k % 3) * 0.5; crates[k] = { x: cxp, y: y0 + 0.14 + Math.floor(k / 3) * 0.28, z: czp, sx: 0.5, sy: 0.26, sz: 0.42 }; }
  group.add(boxField(UB, mats.wood, crates)); for (k = 0; k < 3; k++) add(group, new THREE.SphereGeometry(0.17, 8, 6), k % 2 ? mats.fruitR : mats.leaf3, -5.0, y0 + 0.62, 4.9 + k * 0.5);
  var CBX = 6.0, CBZ = -3.9;
  box(group, 2.2, 1.8, 2.2, mats.panel, CBX, y0 + 0.9, CBZ, 0.05); box(group, 2.4, 0.12, 2.4, mats.conc, CBX, y0 + 1.86, CBZ, 0.03); box(group, 2.22, 0.12, 2.22, mats.accent, CBX, y0 + 1.5, CBZ, 0.01);
  var cbL = []; add(group, new THREE.BoxGeometry(0.05, 0.6, 1.4), mats.strip, CBX - 1.11, y0 + 1.0, CBZ); for (k = 0; k < 3; k++) cbL.push({ x: CBX - 1.14, y: y0 + 1.0, z: CBZ - 0.45 + k * 0.45, sx: 0.02, sy: 0.42, sz: 0.34 });
  add(group, new THREE.BoxGeometry(1.4, 0.6, 0.05), mats.strip, CBX, y0 + 1.0, CBZ + 1.11); for (k = 0; k < 3; k++) cbL.push({ x: CBX - 0.45 + k * 0.45, y: y0 + 1.0, z: CBZ + 1.14, sx: 0.34, sy: 0.42, sz: 0.02 });
  var cbMesh = boxField(UB, mats.winW, cbL); group.add(cbMesh);
  box(group, 0.7, 0.5, 0.7, mats.hull2, CBX + 0.3, y0 + 2.2, CBZ + 0.3, 0.04); cylP(group, 0.25, 0.25, 0.04, 14, mats.dark, CBX + 0.3, y0 + 2.46, CBZ + 0.3);
  var statusLamp = add(group, new THREE.SphereGeometry(0.1, 12, 10), mats.status, CBX - 0.8, y0 + 2.05, CBZ - 0.8);
  [[5.7, -1.7], [6.4, -1.7]].forEach(function (p) { cylP(group, 0.3, 0.3, 1.5, 16, mats.tank, p[0], y0 + 0.75, p[1]); add(group, new THREE.SphereGeometry(0.3, 12, 6, 0, TAU, 0, P / 2), mats.tank, p[0], y0 + 1.5, p[1]); add(group, new THREE.TorusGeometry(0.305, 0.03, 6, 18).rotateX(P / 2), mats.blue, p[0], y0 + 0.9, p[1]); box(group, 0.12, 0.1, 0.12, mats.trim, p[0], y0 + 1.85, p[1], 0.01); });
  pipeRun([[5.7, y0 + 0.3, -1.4], [5.7, y0 + 0.25, -0.9], [4.9, y0 + 0.25, -0.9], [4.9, y0 + 0.3, -1.2]], 0.045, mats.pipe);
  cylP(group, 0.2, 0.22, 2.6, 12, mats.hull2, 6.1, y0 + 1.3, -5.9); cylP(group, 0.26, 0.26, 0.1, 12, mats.dark, 6.1, y0 + 2.62, -5.9); box(group, 0.7, 0.8, 0.6, mats.hull2, 5.7, y0 + 0.4, -5.9, 0.04);
  /* ---------- Estación meteorológica (anemómetro, veleta y sensor de polvo) ---------- */
  mats.sand = std(0xc2a06a, 0, 0.95); mats.sandD = std(0xa88550, 0, 0.95);
  var WSX = 6.0, WSZ = 1.2;
  cylP(group, 0.18, 0.24, 0.3, 10, mats.concD, WSX, y0 + 0.15, WSZ); cylP(group, 0.05, 0.07, 3.0, 8, mats.hull2, WSX, y0 + 1.8, WSZ);
  for (k = 0; k < 3; k++) strutIn(group, [WSX, y0 + 1.0, WSZ], [WSX + Math.cos(k * TAU / 3) * 0.5, y0 + 0.3, WSZ + Math.sin(k * TAU / 3) * 0.5], 0.02, mats.trim);
  box(group, 0.4, 0.3, 0.26, mats.panel, WSX, y0 + 1.2, WSZ + 0.2, 0.03); add(group, new THREE.SphereGeometry(0.03, 6, 6), mats.green, WSX + 0.12, y0 + 1.25, WSZ + 0.34);
  var anemo = new THREE.Group(); anemo.position.set(WSX, y0 + 3.3, WSZ); group.add(anemo);
  cylP(anemo, 0.04, 0.04, 0.16, 8, mats.trim, 0, 0.05, 0);
  for (k = 0; k < 3; k++) { var ca = k * TAU / 3; strutIn(anemo, [0, 0.1, 0], [Math.cos(ca) * 0.32, 0.1, Math.sin(ca) * 0.32], 0.014, mats.trim); var cup = add(anemo, new THREE.SphereGeometry(0.075, 8, 6, 0, TAU, 0, P), mats.panel, Math.cos(ca) * 0.32, 0.1, Math.sin(ca) * 0.32); cup.scale.set(1, 0.8, 1); }
  var vane = new THREE.Group(); vane.position.set(WSX, y0 + 3.0, WSZ); vane.rotation.y = 0.6; group.add(vane);
  strutIn(vane, [-0.4, 0, 0], [0.4, 0, 0], 0.015, mats.trim); box(vane, 0.22, 0.2, 0.02, mats.panel, -0.4, 0.0, 0, 0.005); add(vane, new THREE.ConeGeometry(0.04, 0.14, 8).rotateZ(-P / 2), mats.red, 0.46, 0, 0);
  var sens = box(group, 0.28, 0.2, 0.2, mats.dark, WSX + 0.2, y0 + 2.6, WSZ, 0.03); add(group, new THREE.CylinderGeometry(0.05, 0.05, 0.04, 10).rotateX(P / 2), mats.winW, WSX + 0.2, y0 + 2.6, WSZ + 0.11);
  box(group, 0.4, 0.04, 0.3, mats.solar, WSX - 0.2, y0 + 2.2, WSZ, 0.01).rotation.z = 0.4; cylP(group, 0.012, 0.012, 0.5, 6, mats.trim, WSX, y0 + 3.55, WSZ);

  /* ---------- Detalles de planeta hostil: dunas, filtros de polvo, canalones, cortina antipolvo, mantenimiento ---------- */
  [[-4.5, -6.6, 1.0, 0.24, 0.7], [4.7, -6.5, 0.9, 0.22, 0.6], [-6.7, 1.6, 0.8, 0.2, 1.1], [6.5, 6.4, 0.9, 0.2, 0.7], [0.4, -6.75, 1.4, 0.18, 0.4], [-6.4, 6.6, 0.9, 0.18, 0.6], [4.9, 2.0, 0.7, 0.16, 0.5]].forEach(function (d) {
    var dg2 = new THREE.SphereGeometry(1, 14, 6, 0, TAU, 0, P / 2); dg2.scale(d[2], d[3], d[4]); add(group, dg2, mats.sand, d[0], y0, d[1]).rotation.y = d[0] * 0.3;
  });
  [[-5.0, -5.4], [3.0, 6.2], [-1.2, -6.5], [5.2, -2.6], [-3.4, 2.7]].forEach(function (p) { add(group, new THREE.CircleGeometry(0.5 + rnd() * 0.5, 14).rotateX(-P / 2), mats.sandD, p[0], y0 + 0.012, p[1]).scale.set(1.5, 1, 0.8); });
  box(group, 0.4, 0.14, HL, mats.sand, -4.85, y0 + 0.07 + 0.1, HZc, 0.04); box(group, 0.4, 0.14, HL, mats.sand, 4.85, y0 + 0.07 + 0.1, HZc, 0.04);
  [-1, 1].forEach(function (s) {
    box(group, 0.14, 0.1, HL, mats.hull2, s * 4.74, y0 + 1.62, HZc, 0.02);
    [HZ0 + 0.3, HZ0 + HL - 0.3].forEach(function (zz) { strutIn(group, [s * 4.76, y0 + 1.6, zz], [s * 4.76, y0 + 0.3, zz], 0.04, mats.hull2); box(group, 0.3, 0.04, 0.3, mats.dark, s * 4.76, y0 + 0.08, zz, 0.005); });
  });
  [[-5.0, -2.5, -1], [-5.0, -1.2, -1], [5.0, -0.4, 1], [5.0, 1.0, 1]].forEach(function (f) {
    box(group, 0.55, 0.9, 0.95, mats.hull2, f[0], y0 + 0.45, f[1], 0.04); box(group, 0.6, 0.06, 1.0, mats.dark, f[0], y0 + 0.92, f[1], 0.01);
    var lv = []; for (k = 0; k < 6; k++) lv.push({ x: f[0] + f[2] * 0.29, y: y0 + 0.2 + k * 0.1, z: f[1], sx: 0.02, sy: 0.05, sz: 0.8 });
    group.add(boxField(UB, mats.dark, lv));
    strutIn(group, [f[0] - f[2] * 0.2, y0 + 0.6, f[1]], [f[0] - f[2] * 0.55, y0 + 0.6, f[1]], 0.06, mats.pipe); add(group, new THREE.SphereGeometry(0.03, 6, 6), mats.green, f[0] + f[2] * 0.29, y0 + 0.8, f[1] + 0.38);
  });
  var curt = []; for (k = 0; k < 9; k++) curt.push({ x: -0.6 + k * 0.15, y: y0 + 1.45, z: DCZ + DR - 0.15, sx: 0.12, sy: 1.8, sz: 0.01 });
  group.add(boxField(UB, mats.dark, curt)); box(group, 1.5, 0.06, 0.08, mats.trim, 0, y0 + 2.36, DCZ + DR - 0.15, 0.01);
  box(group, 1.6, 0.04, 0.9, mats.dark, 0, y0 + 0.07, DCZ + DR + 0.5, 0.01); for (k = 0; k < 8; k++) box(group, 1.5, 0.02, 0.04, mats.trim, 0, y0 + 0.1, DCZ + DR + 0.2 + k * 0.1, 0.003);
  [[-4.55, 3.0], [4.55, 3.0]].forEach(function (p) { box(group, 0.2, 0.3, 0.12, mats.red, p[0], y0 + 0.9, p[1], 0.02); cylP(group, 0.06, 0.06, 0.18, 8, mats.red, p[0], y0 + 0.5, p[1]); });
  valve(-5.4, y0 + 0.3, WZ, true);
  var gau = add(group, new THREE.CylinderGeometry(0.1, 0.1, 0.05, 14), mats.dark, -5.4, y0 + 0.75, WZ + 0.1); gau.rotation.x = P / 2; add(group, new THREE.CircleGeometry(0.08, 14), mats.panel, -5.4, y0 + 0.75, WZ + 0.13); strutIn(group, [-5.4, y0 + 0.4, WZ], [-5.4, y0 + 0.68, WZ + 0.08], 0.015, mats.trim);
  box(group, 0.7, 0.35, 0.5, mats.wood, -4.7, y0 + 0.3, 4.2, 0.03); cylP(group, 0.14, 0.14, 0.06, 10, mats.trim, -4.4, y0 + 0.2, 4.2).rotation.z = P / 2;
  strutIn(group, [-5.05, y0 + 0.45, 4.15], [-5.3, y0 + 0.75, 4.15], 0.02, mats.trim); strutIn(group, [-5.05, y0 + 0.45, 4.25], [-5.3, y0 + 0.75, 4.25], 0.02, mats.trim);
  add(group, new THREE.TorusGeometry(0.28, 0.05, 6, 16), mats.green, -3.55, y0 + 0.75, 5.8).rotation.y = P / 2; cylP(group, 0.08, 0.08, 0.3, 8, mats.trim, -3.55, y0 + 0.75, 5.8).rotation.z = P / 2;
  [[-1.8, 6.5], [1.8, 6.5]].forEach(function (p) { box(group, 0.16, 0.12, 0.28, mats.dark, p[0], y0 + 2.45, p[1], 0.02); add(group, new THREE.CylinderGeometry(0.03, 0.03, 0.06, 8).rotateX(P / 2), mats.winW, p[0], y0 + 2.45, p[1] + 0.16); });
  // interior: ventiladores de circulación, cajas de cosecha y rótulos
  [-4.4, -2.6, -0.8].forEach(function (zz) {
    var fg3 = new THREE.Group(); fg3.position.set(AXc, y0 + 2.2, zz); group.add(fg3); cylP(fg3, 0.28, 0.28, 0.12, 14, mats.hull2, 0, 0.0, 0);
    for (k = 0; k < 4; k++) { var b3 = box(fg3, 0.34, 0.012, 0.09, mats.trim, 0, -0.07, 0, 0.003); b3.position.set(Math.cos(k * P / 2) * 0.17, -0.07, Math.sin(k * P / 2) * 0.17); b3.rotation.y = -k * P / 2; }
    strutIn(group, [AXc, y0 + 2.26, zz], [AXc, y0 + 2.6, zz], 0.02, mats.trim); hanFans.push(fg3);
  });
  var tags = []; plantsA.forEach(function (pl) { tags.push({ x: pl.x + 0.18, y: y0 + 0.5, z: pl.z + 0.2, sx: 0.07, sy: 0.12, sz: 0.01 }); });
  group.add(boxField(UB, mats.panel, tags));
  var hb = []; for (k = 0; k < 6; k++) hb.push({ x: AXc + (k % 2 ? 0.3 : -0.3), y: y0 + 0.5 + Math.floor(k / 2) * 0.28, z: HZ0 + HL - 0.55, sx: 0.5, sy: 0.26, sz: 0.4 });
  group.add(boxField(UB, mats.wood, hb)); for (k = 0; k < 3; k++) add(group, new THREE.SphereGeometry(0.12, 8, 6), mats.fruitR, AXc + (k % 2 ? 0.3 : -0.3), y0 + 1.15, HZ0 + HL - 0.55);
  cylP(group, 0.2, 0.2, 0.1, 10, mats.dark, BXc, y0 + 0.4, HZ0 + 0.7); add(group, new THREE.TorusGeometry(0.17, 0.035, 6, 14).rotateX(P / 2), mats.green, BXc, y0 + 0.46, HZ0 + 0.7);
  box(group, 0.5, 0.35, 0.35, mats.tank, BXc, y0 + 0.2, HZ0 + 1.4, 0.03); add(group, new THREE.SphereGeometry(0.03, 6, 6), mats.led, BXc + 0.15, y0 + 0.3, HZ0 + 1.6);
  for (i = 0; i < 4; i++) {
    var sp = new THREE.Group(); sp.position.set(i % 2 ? 6.0 : 4.3, y0 + 0.5, i < 2 ? 5.0 : 6.2); group.add(sp);
    box(sp, 0.1, 0.5, 0.1, mats.trim, -0.6, -0.15, 0.2, 0.01); box(sp, 0.1, 0.5, 0.1, mats.trim, 0.6, -0.15, 0.2, 0.01);
    var pg = new THREE.Group(); pg.rotation.x = 0.55; sp.add(pg); box(pg, 1.5, 0.06, 0.9, mats.solar, 0, 0, 0, 0.015);
    var gl = []; for (k = 1; k < 4; k++) gl.push({ x: -0.75 + k * 0.375, y: 0.035, z: 0, sx: 0.015, sy: 0.01, sz: 0.85 }); gl.push({ x: 0, y: 0.035, z: 0, sx: 1.45, sy: 0.01, sz: 0.015 });
    pg.add(boxField(UB, mats.cell, gl));
  }
  [[-1.8, 6.5], [1.8, 6.5]].forEach(function (p) { cylP(group, 0.05, 0.07, 2.2, 8, mats.hull2, p[0], y0 + 1.1, p[1]); box(group, 0.4, 0.08, 0.2, mats.dark, p[0] + (p[0] < 0 ? 0.15 : -0.15), y0 + 2.25, p[1], 0.02); add(group, new THREE.BoxGeometry(0.3, 0.02, 0.14), mats.winW, p[0] + (p[0] < 0 ? 0.15 : -0.15), y0 + 2.2, p[1]); });
  box(group, 1.6, 0.85, 0.08, mats.dark, -3.4, y0 + 1.4, 6.3, 0.03); box(group, 0.08, 1.1, 0.08, mats.trim, -3.4, y0 + 0.55, 6.28, 0.01);
  var lf = new THREE.SphereGeometry(0.3, 12, 8); lf.scale(1, 0.38, 0.05); var lf1 = add(group, lf, mats.leaf3, -3.65, y0 + 1.4, 6.36); lf1.rotation.z = 0.7;
  var lf2 = add(group, lf.clone(), mats.leaf, -3.4, y0 + 1.5, 6.36); lf2.rotation.z = 1.2; strutIn(group, [-3.75, y0 + 1.15, 6.37], [-3.5, y0 + 1.45, 6.37], 0.015, mats.eC);
  box(group, 0.7, 0.07, 0.015, mats.accent, -3.05, y0 + 1.58, 6.36, 0.005); box(group, 0.5, 0.05, 0.015, mats.dim, -3.1, y0 + 1.3, 6.36, 0.005);

  /* ---------- Rocío, vapor y animación ---------- */
  var mistA = [], steam = [];
  for (i = 0; i < 8; i++) { var mp = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), mats.mist.clone()); mp.frustumCulled = false; group.add(mp); mistA.push({ m: mp, z: nozz[i], ph: rnd() }); }
  for (i = 0; i < 4; i++) { var sm = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 6), mats.smoke.clone()); sm.frustumCulled = false; group.add(sm); steam.push({ m: sm, ph: i / 4 }); }
  var entrance = new THREE.Object3D(); group.add(entrance); entrance.position.set(0, SLAB + 0.2, 6.9);

  /* ---------- Estados y API ---------- */
  var mode = 'working', grow = 0.7, lastT = null, demoT = 0, ghost = false, origEm = {}, ventO = 0, irrig = false;
  var OWNT = { glassG: 0.26, glassF: 0.2, water: 0.85 };
  var api = {
    group: group,
    footprint: { w: SZ, d: SZ },
    entrance: entrance,
    input: new THREE.Object3D(),     // agua y energía (borde -X)
    output: new THREE.Object3D(),    // cosecha (borde +X)
    nivel: 1,
    demo: true,
    getState: function () { return mode; },
    getGrowth: function () { return grow; },
    setGrowth: function (f) { grow = clamp(f, 0, 1); },
    setState: function (s) { api.demo = false; mode = s; },
    setAccent: setAccent,
    setGhost: function (on, valid) {
      ghost = !!on; for (i = 0; i < domeEdges.length; i++) domeEdges[i].visible = !ghost;
      for (var key in mats) {
        var m = mats[key];
        if (m === mats.smoke || m === mats.mist || m === mats.lineR) continue;
        if (!m.isMeshStandardMaterial && !m.isMeshBasicMaterial) continue;
        if (m.isMeshStandardMaterial && !origEm[key]) origEm[key] = { c: m.emissive.getHex(), i: m.emissiveIntensity };
        var own = OWNT[key];
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
      if (api.demo) { demoT += dt; grow = 0.7 + 0.28 * Math.sin(demoT * 0.06); mode = (demoT % 70) > 62 ? 'alert' : 'working'; }
      var on = mode !== 'off', alive = (mode === 'working' || mode === 'alert') && !ghost;
      updatePlants(on ? grow : grow * 0.6, t);
      var vt = mode === 'working' ? 0.4 + 0.35 * Math.sin(t * 0.25) : mode === 'broken' ? 0.3 + 0.2 * Math.sin(t * 6) : 0;
      ventO += (vt - ventO) * Math.min(1, dt * 2);
      for (i = 0; i < flaps.length; i++) flaps[i].g.rotation.z = flaps[i].s * ventO * 0.7;
      for (i = 0; i < fanGroups.length; i++) fanGroups[i].rotation.z += alive ? dt * (mode === 'alert' ? 14 : 8) : 0;
      anemo.rotation.y += alive ? dt * (3 + Math.sin(t * 0.4) * 1.5) : 0; vane.rotation.y = 0.6 + Math.sin(t * 0.2) * 0.5;
      for (i = 0; i < hanFans.length; i++) hanFans[i].rotation.y += alive ? dt * 10 : 0;
      growMesh.visible = on && (mode !== 'broken' || Math.sin(t * 11) > -0.3);
      mats.growL.color.setHex(mode === 'alert' ? 0xff7a3a : 0xff4fd8);
      mats.eC.color.setHex(on ? (mode === 'alert' ? 0xff5a4a : 0x6dff9a) : 0x1f4a2c);
      edgeM.visible = on;
      cbMesh.visible = on && (mode !== 'broken' || Math.sin(t * 9) > -0.4);
      var col = mode === 'working' ? 0x35ff7a : mode === 'alert' ? 0xff3b30 : mode === 'broken' ? 0xffa31a : 0x303030;
      if (mode === 'alert' || mode === 'broken') mats.status.color.setHex(Math.sin(t * 6) > 0 ? col : 0x301010); else mats.status.color.setHex(col);
      irrig = alive && (t % 16) < 5.5 && mode === 'working';
      for (i = 0; i < mistA.length; i++) {
        var mm = mistA[i], ph = (t * 0.9 + mm.ph) % 1; mm.m.visible = irrig;
        if (irrig) { mm.m.position.set(AXc + Math.sin(t * 3 + i) * 0.1, y0 + 2.5 - ph * 1.7, mm.z); mm.m.scale.setScalar(0.5 + ph * 2.2); mm.m.material.opacity = (1 - ph) * 0.3; }
      }
      for (i = 0; i < steam.length; i++) { var st = steam[i], ph2 = (t * 0.3 + st.ph) % 1; st.m.visible = alive; if (alive) { st.m.position.set(6.1 + ph2 * 0.5, y0 + 2.7 + ph2 * 1.6, -5.9); st.m.scale.setScalar(0.5 + ph2 * 2); st.m.material.opacity = (1 - ph2) * 0.35; } }
    }
  };
  api.input.position.set(-7.0, SLAB + 0.5, WZ); group.add(api.input);
  api.output.position.set(7.0, SLAB + 0.5, 0.0); group.add(api.output);
  api.update(0);
  return api;
}
