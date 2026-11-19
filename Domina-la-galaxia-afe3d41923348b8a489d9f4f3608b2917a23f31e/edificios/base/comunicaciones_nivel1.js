/**
 * Puesto de comunicaciones (NIVEL 1 de 3) para Three.js, sin archivos externos. Instalación pequeña para colocar en el planeta.
 *
 * Edificio de control con ventanas iluminadas, puerta con marquesina y barras de señal; mástil reticulado de 34 m con
 * franjas rojas y blancas, plataforma, paneles sectoriales, enlaces de microondas y baliza; antena parabólica de 6 m con
 * montura azimut-elevación que barre el cielo; radar giratorio y antenas VSAT en el techo; generador de respaldo con
 * depósito de combustible; paneles solares, postes de luz, letrero y luces de borde. Sin vallas ni dron.
 *
 * Uso:
 *   const cm = createPuestoComunicaciones(THREE, { accent: 0x2fd0a0 });
 *   cm.group.position.set(x, groundY, z);        // la base de la losa está en y = 0
 *   scene.add(cm.group);
 *   cm.update(clock.getElapsedTime());
 *
 * Escala: 1 unidad = 4 m. Huella: 10 x 10 unidades (cm.footprint), centrada en el origen. Altura ~9.
 * Entrada: cm.entrance (borde +Z). Energía: cm.input (borde -X). Enlace de datos: cm.output (borde +X). cm.nivel = 1.
 *
 * Estados (cm.setState): 'working' (antena barre, radar gira, pulsos de señal), 'alert' (todo rojo, radar rápido, antena
 *   fija), 'broken' (antena caída, luces intermitentes), 'off'. Por defecto corre una demostración (cm.demo = true);
 *   setState la desactiva. cm.setSignal(0..1): intensidad de señal (barras, alcance de los pulsos).
 *   cm.setGhost(true, valid): modo "fantasma" para colocar (verde/rojo); setGhost(false) lo quita. cm.setAccent(hex).
 * Compatible con Three.js r128 o superior.
 */
function createPuestoComunicaciones(THREE, opts) {
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
  var SLAB = 0.4, SZ = 10, k, j, i, q;
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function box(parent, w, h, d, mat, x, y, z, r) { return add(parent, roundedBox(w, h, d, r || 0.03, 2), mat, x, y, z); }
  function cylP(parent, r1, r2, h, seg, mat, x, y, z) { return add(parent, new THREE.CylinderGeometry(r1, r2, h, seg || 12), mat, x, y, z); }
  function strutIn(parent, a, b, r, mat) {
    var m = new THREE.Mesh(_cg[r] || (_cg[r] = new THREE.CylinderGeometry(r, r, 1, 8)), mat);
    placeStrut(m, a, b); parent.add(m); return m;
  }
  function std(c, m, r, extra) { var o = { color: c, metalness: m, roughness: r, side: THREE.DoubleSide }; if (extra) for (var kk in extra) o[kk] = extra[kk]; return new THREE.MeshStandardMaterial(o); }
  function bas(c) { return new THREE.MeshBasicMaterial({ color: c }); }
  mats.conc = std(0xb7bbc2, 0.15, 0.78); mats.concD = std(0x8d9199, 0.2, 0.8);
  mats.panel = std(0xe9edf2, 0.25, 0.55);
  mats.strip = std(0x101a28, 0.9, 0.15, { emissive: 0x0a2236, emissiveIntensity: 0.55 });
  mats.winW = bas(0xffe3a0); mats.eC = bas(0x35e0ff); mats.dim = bas(0x23303c);
  mats.plaza = std(0xa9a49a, 0.1, 0.85); mats.road = std(0x363940, 0.2, 0.85);
  mats.mastR = std(0xe0472a, 0.4, 0.5); mats.mastW = std(0xf2f2f2, 0.35, 0.5);
  mats.solar = std(0x16264a, 0.85, 0.22, { emissive: 0x0a1a3a, emissiveIntensity: 0.4 });
  mats.cell = std(0x6d86b8, 0.8, 0.3);
  mats.beaconM = bas(0xff3b30);
  mats.smoke = new THREE.MeshBasicMaterial({ color: 0x9a9a9a, transparent: true, opacity: 0.25, depthWrite: false });
  mats.hull2 = std(0x9aa5b6, 0.55, 0.38); mats.trim = std(0x3a4456, 0.8, 0.35);
  var UB = new THREE.BoxGeometry(1, 1, 1);

  /* ---------- Losa y suelo ---------- */
  box(group, SZ, SLAB, SZ, mats.slab, 0, SLAB / 2, 0, 0.05);
  box(group, SZ - 0.5, 0.04, SZ - 0.5, mats.conc, 0, SLAB + 0.01, 0, 0.01);
  box(group, 1.1, 0.05, 5.8, mats.road, -1.6, SLAB + 0.03, 2.2, 0.01);               // camino hacia la puerta
  for (k = 0; k < 7; k++) box(group, 0.08, 0.052, 0.4, mats.panel, -1.6, SLAB + 0.035, 4.6 - k * 0.75, 0.005);
  var edgeL = [];
  for (k = 0; k < 11; k++) { var ev = -4.5 + k * 0.9; edgeL.push({ x: ev, y: SLAB + 0.03, z: -4.82, sx: 0.28, sy: 0.03, sz: 0.08 }); edgeL.push({ x: ev, y: SLAB + 0.03, z: 4.82, sx: 0.28, sy: 0.03, sz: 0.08 }); edgeL.push({ x: -4.82, y: SLAB + 0.03, z: ev, sx: 0.08, sy: 0.03, sz: 0.28 }); edgeL.push({ x: 4.82, y: SLAB + 0.03, z: ev, sx: 0.08, sy: 0.03, sz: 0.28 }); }
  var edgeM = boxField(UB, mats.eC, edgeL); group.add(edgeM);

  /* ---------- Edificio de control ---------- */
  var BX = -1.6, BZ = -2.4, BW = 5, BD = 3, BH = 2.6, y0 = SLAB, roofY = y0 + BH + 0.14, FZ = BZ + BD / 2;
  box(group, BW + 0.2, 0.25, BD + 0.2, mats.concD, BX, y0 + 0.125, BZ, 0.03);
  box(group, BW, BH, BD, mats.panel, BX, y0 + BH / 2 + 0.1, BZ, 0.06);
  box(group, BW + 0.3, 0.14, BD + 0.3, mats.conc, BX, y0 + BH + 0.07 + 0.1, BZ, 0.03);
  box(group, BW + 0.02, 0.12, BD + 0.02, mats.accent, BX, y0 + BH - 0.05, BZ, 0.01);
  var ribs = [];
  for (k = 0; k < 6; k++) { ribs.push({ x: BX - 2.1 + k * 0.84, y: y0 + 1.45, z: FZ + 0.01, sx: 0.07, sy: 2.2, sz: 0.04 }); ribs.push({ x: BX - 2.1 + k * 0.84, y: y0 + 1.45, z: BZ - BD / 2 - 0.01, sx: 0.07, sy: 2.2, sz: 0.04 }); }
  for (k = 0; k < 4; k++) { ribs.push({ x: BX - BW / 2 - 0.01, y: y0 + 1.45, z: BZ - 1.1 + k * 0.75, sx: 0.04, sy: 2.2, sz: 0.07 }); ribs.push({ x: BX + BW / 2 + 0.01, y: y0 + 1.45, z: BZ - 1.1 + k * 0.75, sx: 0.04, sy: 2.2, sz: 0.07 }); }
  group.add(boxField(UB, mats.concD, ribs));
  // ventanas con luz interior
  var winLit = [];
  [-1.55, 1.55].forEach(function (dx) {
    add(group, new THREE.BoxGeometry(1.5, 0.8, 0.05), mats.strip, BX + dx, y0 + 1.5, FZ + 0.02);
    box(group, 1.62, 0.08, 0.08, mats.concD, BX + dx, y0 + 1.94, FZ + 0.04, 0.01); box(group, 1.62, 0.08, 0.1, mats.concD, BX + dx, y0 + 1.06, FZ + 0.05, 0.01);
    for (k = 0; k < 4; k++) winLit.push({ x: BX + dx - 0.54 + k * 0.36, y: y0 + 1.5, z: FZ + 0.05, sx: 0.28, sy: 0.5, sz: 0.02 });
  });
  [-1, 1].forEach(function (s) {
    add(group, new THREE.BoxGeometry(0.05, 0.6, 1.4), mats.strip, BX + s * (BW / 2 + 0.01), y0 + 1.5, BZ);
    for (k = 0; k < 3; k++) winLit.push({ x: BX + s * (BW / 2 + 0.04), y: y0 + 1.5, z: BZ - 0.45 + k * 0.45, sx: 0.02, sy: 0.4, sz: 0.34 });
  });
  var winMesh = boxField(UB, mats.winW, winLit); group.add(winMesh);
  // puerta con marco, marquesina y escalón
  box(group, 1.0, 1.55, 0.1, mats.accent, BX, y0 + 0.9, FZ + 0.03, 0.02);
  box(group, 0.8, 1.4, 0.06, mats.dark, BX, y0 + 0.87, FZ + 0.08, 0.02);
  add(group, new THREE.BoxGeometry(0.62, 0.5, 0.03), mats.strip, BX, y0 + 1.1, FZ + 0.12);
  box(group, 0.08, 0.14, 0.04, mats.trim, BX + 0.32, y0 + 0.8, FZ + 0.13, 0.01);
  box(group, 1.7, 0.08, 0.8, mats.conc, BX, y0 + 1.85, FZ + 0.4, 0.02);
  [-0.75, 0.75].forEach(function (dx) { cylP(group, 0.04, 0.04, 1.4, 8, mats.trim, BX + dx, y0 + 1.15, FZ + 0.72); });
  add(group, new THREE.BoxGeometry(1.3, 0.03, 0.4), mats.winW, BX, y0 + 1.8, FZ + 0.5);
  box(group, 1.4, 0.14, 0.7, mats.concD, BX, y0 + 0.07, FZ + 0.4, 0.02);
  // barras de señal sobre la puerta
  var sigDim = [], sigOn = [];
  for (k = 0; k < 5; k++) {
    var bh = 0.08 + k * 0.07, bxp = BX - 0.3 + k * 0.15;
    sigDim.push(box(group, 0.1, bh, 0.03, mats.dim, bxp, y0 + 2.1 + bh / 2, FZ + 0.03, 0.005));
    sigOn.push(box(group, 0.1, bh, 0.04, mats.eC, bxp, y0 + 2.1 + bh / 2, FZ + 0.035, 0.005));
  }
  // equipos laterales: A/A, rejillas, conductos
  [-1.2, 0.4].forEach(function (dz) {
    box(group, 0.5, 0.9, 0.9, mats.hull2, BX - BW / 2 - 0.32, y0 + 0.55, BZ + dz, 0.04);
    cylP(group, 0.2, 0.2, 0.04, 16, mats.dark, BX - BW / 2 - 0.58, y0 + 0.62, BZ + dz).rotation.z = P / 2;
    for (k = 0; k < 4; k++) box(group, 0.02, 0.04, 0.6, mats.dark, BX - BW / 2 - 0.58, y0 + 0.9 - k * 0.12 - 0.15, BZ + dz, 0.005);
  });
  box(group, 0.5, 1.0, 0.7, mats.panel, BX + BW / 2 + 0.3, y0 + 0.6, BZ + 0.6, 0.04);                // armario eléctrico
  box(group, 0.04, 0.8, 0.5, mats.trim, BX + BW / 2 + 0.56, y0 + 0.6, BZ + 0.6, 0.01);
  [0.0, 0.1].forEach(function (d) { add(group, new THREE.SphereGeometry(0.025, 6, 6), d ? mats.red : mats.green, BX + BW / 2 + 0.59, y0 + 0.95 - d * 2, BZ + 0.45); });
  // techo: equipos, ventilaciones y bandeja de cables
  box(group, 0.9, 0.5, 0.7, mats.hull2, BX - 0.5, roofY + 0.25, BZ + 0.5, 0.05);
  cylP(group, 0.28, 0.28, 0.05, 18, mats.dark, BX - 0.5, roofY + 0.52, BZ + 0.5);
  for (k = 0; k < 4; k++) add(group, new THREE.BoxGeometry(0.5, 0.012, 0.02), mats.trim, BX - 0.5, roofY + 0.54, BZ + 0.5 - 0.15 + k * 0.1);
  [[-0.9, 0.9], [0.3, 1.0]].forEach(function (p) { cylP(group, 0.09, 0.09, 0.5, 10, mats.hull2, BX + p[0] + 1.5, roofY + 0.25, BZ + p[1] - 1.4); cylP(group, 0.13, 0.13, 0.04, 10, mats.trim, BX + p[0] + 1.5, roofY + 0.52, BZ + p[1] - 1.4); });
  box(group, 2.4, 0.08, 0.2, mats.trim, BX + 0.6, roofY + 0.06, BZ - 0.9, 0.01);
  greeble(BX, roofY, BZ, BW - 0.8, 0.2, BD - 0.8, 9, mats.hull2, 'y', 0.15, 0.4);
  // antenas VSAT en el techo
  function capDish(parent, r, tl) {
    var R = r / Math.sin(tl), g = new THREE.SphereGeometry(R, 22, 8, 0, TAU, P - tl, tl); g.rotateX(P / 2); g.translate(0, 0, R);
    return new THREE.Mesh(g, mats.panel);
  }
  [[BX + 1.7, BZ - 0.9, 0.5], [BX + 0.9, BZ + 0.7, -0.6]].forEach(function (p, n) {
    var dg = new THREE.Group(); dg.position.set(p[0], roofY, p[1]); group.add(dg);
    cylP(dg, 0.08, 0.1, 0.55, 10, mats.trim, 0, 0.27, 0); box(dg, 0.3, 0.06, 0.3, mats.concD, 0, 0.03, 0, 0.01);
    var dh = new THREE.Group(); dh.position.set(0, 0.62, 0); dh.rotation.y = p[2]; dh.rotation.x = -0.6; dg.add(dh);
    var d = capDish(dh, 0.42, 0.9); dh.add(d); cylP(dh, 0.03, 0.03, 0.1, 6, mats.trim, 0, 0, -0.05);
    strutIn(dh, [0, 0, 0.18], [0, 0, 0.42], 0.012, mats.trim); add(dh, new THREE.SphereGeometry(0.04, 8, 6), mats.hull2, 0, 0, 0.44);
  });
  // radar giratorio de techo
  var radarG = new THREE.Group(); radarG.position.set(BX - 1.5, roofY, BZ - 0.5); group.add(radarG);
  cylP(radarG, 0.2, 0.28, 0.12, 14, mats.concD, 0, 0.06, 0); cylP(radarG, 0.1, 0.12, 0.7, 12, mats.trim, 0, 0.45, 0);
  var radarH = new THREE.Group(); radarH.position.y = 0.88; radarG.add(radarH);
  cylP(radarH, 0.14, 0.14, 0.14, 14, mats.hull2, 0, 0, 0);
  box(radarH, 1.7, 0.3, 0.07, mats.panel, 0, 0.18, 0.12, 0.02);
  for (k = 0; k < 5; k++) box(radarH, 0.015, 0.3, 0.075, mats.trim, -0.6 + k * 0.3, 0.18, 0.12, 0.003);
  box(radarH, 0.2, 0.1, 0.22, mats.hull2, 0, 0.18, 0.0, 0.02);
  box(radarH, 1.7, 0.04, 0.12, mats.accent, 0, 0.34, 0.12, 0.01);
  var statusLamp = add(group, new THREE.SphereGeometry(0.09, 12, 10), mats.status, BX + 2.2, roofY + 0.14, BZ + 1.2);
  cylP(group, 0.03, 0.03, 0.12, 8, mats.trim, BX + 2.2, roofY + 0.06, BZ + 1.2);

  /* ---------- Mástil reticulado de 34 m con antenas ---------- */
  var MX = 2.9, MZ = -2.6, NS = 7, MH = 8.0, R0 = 0.85, R1 = 0.22, mast = new THREE.Group(); mast.position.set(MX, y0, MZ); group.add(mast);
  function mr(s) { return R0 + (R1 - R0) * s / NS; }
  function my(s) { return 0.3 + MH * s / NS; }
  function leg(a, s) { return [Math.cos(a) * mr(s), my(s), Math.sin(a) * mr(s)]; }
  cylP(mast, 1.5, 1.6, 0.25, 6, mats.conc, 0, 0.125, 0);
  var legA = [P / 2, P / 2 + TAU / 3, P / 2 + 2 * TAU / 3];
  for (i = 0; i < 3; i++) { var fp = leg(legA[i], 0); box(mast, 0.5, 0.2, 0.5, mats.concD, fp[0], 0.3, fp[2], 0.03); cylP(mast, 0.12, 0.12, 0.12, 8, mats.trim, fp[0], 0.42, fp[2]); }
  for (j = 0; j < NS; j++) {
    var segM = j % 2 ? mats.mastW : mats.mastR;
    for (i = 0; i < 3; i++) {
      var a = legA[i], b = legA[(i + 1) % 3];
      strutIn(mast, leg(a, j), leg(a, j + 1), 0.05, segM);
      strutIn(mast, leg(a, j + 1), leg(b, j + 1), 0.028, mats.mastW);
      strutIn(mast, j % 2 ? leg(a, j) : leg(b, j), j % 2 ? leg(b, j + 1) : leg(a, j + 1), 0.022, mats.mastW);
    }
  }
  for (j = 0; j <= NS; j++) for (i = 0; i < 3; i++) { var nd = leg(legA[i], j); add(mast, new THREE.SphereGeometry(0.06, 8, 6), mats.trim, nd[0], nd[1], nd[2]); }
  var PL = new THREE.Group(); PL.position.set(0, my(5), 0); mast.add(PL);
  add(PL, new THREE.RingGeometry(0.22, 0.62, 3, 1).rotateX(-P / 2), mats.trim, 0, 0, 0);
  add(PL, new THREE.TorusGeometry(0.6, 0.02, 6, 24).rotateX(P / 2), mats.accent, 0, 0.9, 0);
  add(PL, new THREE.TorusGeometry(0.6, 0.016, 6, 24).rotateX(P / 2), mats.accent, 0, 0.45, 0);
  for (i = 0; i < 8; i++) { var pa = i / 8 * TAU; strutIn(PL, [Math.cos(pa) * 0.6, 0, Math.sin(pa) * 0.6], [Math.cos(pa) * 0.6, 0.9, Math.sin(pa) * 0.6], 0.014, mats.accent); }
  // paneles sectoriales (3) y enlaces de microondas (2)
  for (i = 0; i < 3; i++) {
    var sg = new THREE.Group(); sg.rotation.y = -legA[i]; sg.position.y = my(5.6); mast.add(sg);
    var rr = mr(5.6);
    box(sg, 0.08, 1.2, 0.3, mats.panel, rr + 0.32, 0, 0, 0.02);
    box(sg, 0.03, 1.1, 0.22, mats.concD, rr + 0.26, 0, 0, 0.01);
    strutIn(sg, [rr, 0.4, 0], [rr + 0.28, 0.4, 0], 0.025, mats.trim); strutIn(sg, [rr, -0.4, 0], [rr + 0.28, -0.4, 0], 0.025, mats.trim);
    add(sg, new THREE.SphereGeometry(0.03, 6, 6), mats.lamp, rr + 0.37, 0.58, 0);
  }
  [[0.5, 0.0], [3.6, 0.6]].forEach(function (p, n) {
    var mg = new THREE.Group(); mg.rotation.y = -p[0]; mg.position.y = my(3.1 + p[1]); mast.add(mg);
    var rr = mr(3.1 + p[1]);
    strutIn(mg, [rr, 0, 0], [rr + 0.34, 0, 0], 0.03, mats.trim);
    var dd = new THREE.Group(); dd.position.set(rr + 0.38, 0, 0); dd.rotation.y = P / 2; mg.add(dd);
    dd.add(capDish(dd, 0.45, 0.9)); strutIn(dd, [0, 0, 0.2], [0, 0, 0.45], 0.012, mats.trim); add(dd, new THREE.SphereGeometry(0.04, 8, 6), mats.hull2, 0, 0, 0.47);
  });
  // mástil superior, látigos y baliza
  cylP(mast, 0.03, 0.05, 1.3, 8, mats.mastW, 0, my(NS) + 0.65, 0);
  for (i = 0; i < 3; i++) { var wa = legA[i] + P / 3; strutIn(mast, [Math.cos(wa) * 0.2, my(NS) - 0.7, Math.sin(wa) * 0.2], [Math.cos(wa) * 0.3, my(NS) + 0.9, Math.sin(wa) * 0.3], 0.012, mats.trim); }
  var topLamp = add(mast, new THREE.SphereGeometry(0.1, 12, 10), mats.beaconM, 0, my(NS) + 1.35, 0);
  var midLamp = add(mast, new THREE.SphereGeometry(0.08, 10, 8), mats.beaconM, 0, my(3.4), mr(3.4) + 0.05);
  var mastTopY = y0 + my(NS) + 1.35;
  // caseta de equipos junto a la base y bandeja de cables hasta el edificio
  box(group, 0.9, 0.9, 0.6, mats.panel, MX - 1.55, y0 + 0.45, MZ + 0.4, 0.04);
  for (k = 0; k < 4; k++) add(group, new THREE.SphereGeometry(0.025, 6, 6), k % 2 ? mats.green : mats.lamp, MX - 1.8 + k * 0.12, y0 + 0.75, MZ + 0.71);
  box(group, 0.7, 0.05, 0.22, mats.trim, MX - 2.25 + 0.0, y0 + 0.05, MZ, 0.01);
  box(group, 0.7, 0.05, 0.22, mats.trim, BX + BW / 2 + 0.6 + 0.95, y0 + 0.05, MZ + 0.0, 0.01);
  pipeRun([[BX + BW / 2 + 0.2, y0 + 0.2, MZ - 0.1], [MX - 1.1, y0 + 0.2, MZ - 0.1]], 0.05, mats.dark);
  pipeRun([[BX + BW / 2 + 0.2, y0 + 0.3, MZ + 0.1], [MX - 1.1, y0 + 0.3, MZ + 0.1]], 0.04, mats.dark);

  /* ---------- Antena parabólica de 6 m con montura azimut-elevación ---------- */
  var DX = 3.0, DZ = 2.0, DR = 1.3, DF = 1.2;
  cylP(group, 0.8, 0.9, 0.3, 14, mats.conc, DX, y0 + 0.15, DZ); cylP(group, 0.42, 0.55, 0.6, 14, mats.concD, DX, y0 + 0.6, DZ);
  for (i = 0; i < 6; i++) { var ba = i / 6 * TAU; cylP(group, 0.03, 0.03, 0.06, 6, mats.trim, DX + Math.cos(ba) * 0.7, y0 + 0.33, DZ + Math.sin(ba) * 0.7); }
  var dY = new THREE.Group(); dY.position.set(DX, y0 + 0.9, DZ); group.add(dY);
  cylP(dY, 0.5, 0.5, 0.14, 18, mats.hull2, 0, 0.07, 0);
  box(dY, 0.2, 1.5, 0.35, mats.hull2, -1.55, 0.8, 0, 0.04); box(dY, 0.2, 1.5, 0.35, mats.hull2, 1.55, 0.8, 0, 0.04);
  box(dY, 3.3, 0.2, 0.5, mats.hull2, 0, 0.1, 0, 0.04);
  [-1, 1].forEach(function (s) { strutIn(dY, [s * 0.2, 0.15, 0.2], [s * 1.5, 1.4, 0.1], 0.04, mats.trim); strutIn(dY, [s * 0.2, 0.15, -0.2], [s * 1.5, 1.4, -0.1], 0.04, mats.trim); cylP(dY, 0.12, 0.12, 0.08, 12, mats.accent, s * 1.68, 1.2, 0).rotation.z = P / 2; });
  var dX = new THREE.Group(); dX.position.set(0, 1.2, 0); dY.add(dX);
  cylP(dX, 0.07, 0.07, 3.3, 10, mats.trim, 0, 0, 0).rotation.z = P / 2;
  cylP(dX, 0.22, 0.28, 0.35, 14, mats.hull2, 0, -0.1, 0);
  var dpts = [], dpts2 = [];
  for (k = 0; k <= 16; k++) { var rd = DR * k / 16, yd = rd * rd / (4 * DF); dpts.push(new THREE.Vector2(rd, yd)); dpts2.push(new THREE.Vector2(rd, yd - 0.05)); }
  add(dX, new THREE.LatheGeometry(dpts, 40), mats.panel, 0, 0.05, 0);
  add(dX, new THREE.LatheGeometry(dpts2, 40), mats.concD, 0, 0.0, 0);
  add(dX, new THREE.TorusGeometry(DR, 0.03, 8, 40).rotateX(P / 2), mats.accent, 0, 0.05 + DR * DR / (4 * DF), 0);
  for (i = 0; i < 12; i++) { var ra2 = i / 12 * TAU; strutIn(dX, [0, -0.05, 0], [Math.cos(ra2) * DR * 0.85, DR * DR * 0.72 / (4 * DF) - 0.05, Math.sin(ra2) * DR * 0.85], 0.014, mats.trim); }
  var rim = DR * DR / (4 * DF) + 0.05;
  for (i = 0; i < 4; i++) { var fa = i * P / 2 + P / 4; strutIn(dX, [Math.cos(fa) * DR * 0.96, rim, Math.sin(fa) * DR * 0.96], [0, 0.05 + DF, 0], 0.022, mats.trim); }
  cylP(dX, 0.08, 0.1, 0.2, 12, mats.hull2, 0, 0.05 + DF, 0); add(dX, new THREE.CircleGeometry(0.14, 16).rotateX(-P / 2), mats.trim, 0, 0.05 + DF - 0.1, 0);
  add(dX, new THREE.SphereGeometry(0.045, 8, 6), mats.lamp, 0, 0.05 + DF + 0.12, 0);

  /* ---------- Generador de respaldo, depósito y paneles solares ---------- */
  box(group, 1.7, 1.0, 0.95, mats.hull2, -3.7, y0 + 0.55, 1.2, 0.05);
  box(group, 1.75, 0.1, 1.0, mats.accent, -3.7, y0 + 1.0, 1.2, 0.02);
  for (k = 0; k < 7; k++) box(group, 0.04, 0.5, 0.03, mats.dark, -4.3 + k * 0.2, y0 + 0.55, 1.7, 0.005);
  cylP(group, 0.07, 0.07, 0.55, 10, mats.trim, -3.2, y0 + 1.3, 1.1); cylP(group, 0.11, 0.11, 0.04, 10, mats.dark, -3.2, y0 + 1.6, 1.1);
  box(group, 0.3, 0.2, 0.04, mats.red, -4.3, y0 + 0.8, 1.7, 0.01);
  var tankG = cylP(group, 0.38, 0.38, 1.8, 18, mats.hull2, -3.7, y0 + 0.72, 3.0); tankG.rotation.z = P / 2;
  for (i = 0; i < 2; i++) { box(group, 0.12, 0.34, 0.8, mats.trim, -4.2 + i * 1.0, y0 + 0.17, 3.0, 0.01); }
  [-0.5, 0.0, 0.5].forEach(function (dx, n) { add(group, new THREE.TorusGeometry(0.385, 0.02, 6, 20).rotateY(P / 2), n === 1 ? mats.accent : mats.concD, -3.7 + dx * 1.2, y0 + 0.72, 3.0); });
  cylP(group, 0.09, 0.09, 0.1, 10, mats.trim, -3.7, y0 + 1.12, 3.0);
  add(group, new THREE.CylinderGeometry(0.06, 0.06, 0.03, 12), mats.dark, -3.2, y0 + 1.0, 3.0);
  pipeRun([[-3.7, y0 + 0.4, 2.25], [-3.7, y0 + 0.25, 2.4], [-3.7, y0 + 0.25, 2.0], [-3.7, y0 + 0.4, 1.7]], 0.05, mats.pipe);
  for (i = 0; i < 2; i++) {
    var sp = new THREE.Group(); sp.position.set(0.0 + i * 0, y0 + 0.5, 2.3 + i * 1.5); group.add(sp);
    box(sp, 0.1, 0.5, 0.1, mats.trim, -0.6, -0.15, 0.2, 0.01); box(sp, 0.1, 0.5, 0.1, mats.trim, 0.6, -0.15, 0.2, 0.01);
    var pg = new THREE.Group(); pg.rotation.x = 0.55; sp.add(pg);
    box(pg, 1.6, 0.06, 1.0, mats.solar, 0, 0, 0, 0.015);
    var gl = []; for (k = 1; k < 4; k++) gl.push({ x: -0.8 + k * 0.4, y: 0.035, z: 0, sx: 0.015, sy: 0.01, sz: 0.95 }); for (k = 1; k < 3; k++) gl.push({ x: 0, y: 0.035, z: -0.5 + k * 0.33, sx: 1.55, sy: 0.01, sz: 0.015 });
    pg.add(boxField(UB, mats.cell, gl)); box(pg, 1.66, 0.04, 0.05, mats.trim, 0, 0, 0.5, 0.01);
  }
  // postes de luz y letrero con ondas de radio
  [[-4.4, 4.3], [4.4, 4.3]].forEach(function (p) {
    cylP(group, 0.05, 0.07, 2.2, 8, mats.hull2, p[0], y0 + 1.1, p[1]); box(group, 0.4, 0.08, 0.2, mats.dark, p[0] + (p[0] < 0 ? 0.15 : -0.15), y0 + 2.25, p[1], 0.02);
    add(group, new THREE.BoxGeometry(0.3, 0.02, 0.14), mats.winW, p[0] + (p[0] < 0 ? 0.15 : -0.15), y0 + 2.2, p[1]);
  });
  box(group, 1.5, 0.8, 0.08, mats.dark, -3.2, y0 + 1.3, 4.3, 0.03); box(group, 0.08, 1.0, 0.08, mats.trim, -3.2, y0 + 0.5, 4.28, 0.01);
  for (k = 0; k < 3; k++) add(group, new THREE.TorusGeometry(0.1 + k * 0.1, 0.018, 6, 14, P * 0.7).rotateZ(-P * 0.35), mats.eC, -3.5, y0 + 1.1 + 0.02, 4.35).scale.setScalar(1);
  add(group, new THREE.SphereGeometry(0.045, 8, 6), mats.eC, -3.5, y0 + 1.1, 4.35);
  box(group, 0.7, 0.07, 0.015, mats.accent, -2.75, y0 + 1.42, 4.35, 0.005); box(group, 0.5, 0.05, 0.015, mats.dim, -2.85, y0 + 1.2, 4.35, 0.005);

  /* ---------- Pulsos de señal, humo y animación ---------- */
  var pulses = [];
  for (i = 0; i < 3; i++) {
    var pm = glowMat(0x35e0ff, 0.3), pr = new THREE.Mesh(new THREE.TorusGeometry(1, 0.018, 6, 56).rotateX(P / 2), pm);
    pr.position.set(MX, mastTopY - 0.4, MZ); pr.frustumCulled = false; group.add(pr); pulses.push({ m: pr, mat: pm, ph: i / 3 });
  }
  var puffs = [];
  for (i = 0; i < 4; i++) { var pf = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), mats.smoke.clone()); pf.frustumCulled = false; group.add(pf); puffs.push({ m: pf, ph: i / 4 }); }
  var entrance = new THREE.Object3D(); group.add(entrance); entrance.position.set(-1.6, SLAB + 0.2, 4.9);

  /* ---------- Estados y API ---------- */
  var mode = 'working', level = 0.7, lastT = null, demoT = 0, ghost = false, origEm = {}, dishAz = 0, dishEl = 0.6, radarA = 0;
  var OWN = { strip: 0.9, glass: 0.9 };
  function setAccent2(hex) { setAccent(hex); }
  var api = {
    group: group,
    footprint: { w: SZ, d: SZ },
    entrance: entrance,
    input: new THREE.Object3D(),     // energía (borde -X)
    output: new THREE.Object3D(),    // enlace de datos (borde +X)
    nivel: 1,
    demo: true,
    getState: function () { return mode; },
    getSignal: function () { return level; },
    setSignal: function (f) { level = clamp(f, 0, 1); },
    setState: function (s) { api.demo = false; mode = s; },
    setAccent: setAccent2,
    setGhost: function (on, valid) {
      ghost = !!on;
      for (var key in mats) {
        var m = mats[key];
        if (m === mats.smoke) continue;
        if (!m.isMeshStandardMaterial && !m.isMeshBasicMaterial) continue;
        if (m.isMeshStandardMaterial && !origEm[key]) origEm[key] = { c: m.emissive.getHex(), i: m.emissiveIntensity };
        m.transparent = ghost || (m.userData && m.userData.t); m.opacity = ghost ? 0.45 : 1; m.depthWrite = !ghost;
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
      // antena parabólica: barre despacio; en alerta se fija; averiada queda caída
      var tAz = mode === 'working' ? Math.sin(t * 0.18) * 1.1 : mode === 'alert' ? 0.35 : mode === 'broken' ? -0.9 : 0;
      var tEl = mode === 'working' ? 0.75 + 0.2 * Math.sin(t * 0.11 + 1) : mode === 'alert' ? 1.0 : mode === 'broken' ? 0.15 : 0.5;
      var sp = Math.min(1, dt * 1.5);
      dishAz += (tAz - dishAz) * sp; dishEl += (tEl - dishEl) * sp;
      dY.rotation.y = dishAz; dX.rotation.x = dishEl;
      radarA += dt * (alive ? (mode === 'alert' ? 5.5 : 2.4) : 0);
      radarH.rotation.y = radarA;
      // pulsos de señal
      for (i = 0; i < pulses.length; i++) {
        var pu = pulses[i], ph = (t * 0.32 + pu.ph) % 1, vis = alive && level > 0.05;
        pu.m.visible = vis;
        if (vis) { var sc = 0.5 + ph * (2.2 + level * 2.2); pu.m.scale.set(sc, sc, sc); pu.mat.opacity = (1 - ph) * 0.32; pu.mat.color.setHex(mode === 'alert' ? 0xff5a4a : 0x35e0ff); }
      }
      // barras de señal
      var nb = on ? Math.ceil(level * 5 - 0.001) : 0;
      for (i = 0; i < 5; i++) { sigOn[i].visible = i < nb && mode !== 'broken' || (mode === 'broken' && i < 2 && Math.sin(t * 7 + i) > 0); sigDim[i].visible = true; }
      // luces
      var blink = Math.sin(t * (mode === 'alert' ? 8 : 2.2)) > 0;
      var bOn = on && (mode === 'alert' ? blink : (mode === 'broken' ? Math.sin(t * 3) > 0.6 : blink));
      topLamp.visible = bOn; midLamp.visible = on && (mode === 'alert' ? !blink : blink);
      var col = mode === 'working' ? 0x35ff7a : mode === 'alert' ? 0xff3b30 : mode === 'broken' ? 0xffa31a : 0x303030;
      if (mode === 'alert' || mode === 'broken') mats.status.color.setHex(Math.sin(t * 6) > 0 ? col : 0x301010); else mats.status.color.setHex(col);
      mats.eC.color.setHex(on ? (mode === 'alert' ? 0xff5a4a : 0x35e0ff) : 0x1a4650);
      edgeM.visible = on;
      winMesh.visible = on && (mode !== 'broken' || Math.sin(t * 9) > -0.4);
      // humo del generador (solo en alerta o con señal alta)
      var smoking = alive && (mode === 'alert' || level > 0.8);
      for (i = 0; i < puffs.length; i++) {
        var pp = puffs[i], pf2 = (t * 0.3 + pp.ph) % 1;
        pp.m.visible = smoking;
        if (smoking) { pp.m.position.set(-3.2 + pf2 * 0.5, y0 + 1.65 + pf2 * 1.3, 1.1); pp.m.scale.setScalar(0.6 + pf2 * 2); pp.m.material.opacity = (1 - pf2) * 0.3; }
      }
    }
  };
  api.input.position.set(-5.0, SLAB + 0.5, MZ); group.add(api.input);
  api.output.position.set(5.0, SLAB + 0.5, MZ); group.add(api.output);
  api.update(0);
  return api;
}
