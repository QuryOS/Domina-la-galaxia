/**
 * Estación de comunicaciones y radar (NIVEL 2 de 3) para Three.js, sin archivos externos. Instalación mediana para el planeta.
 *
 * Centro de operaciones de dos plantas (planta alta acristalada con montantes, vestíbulo de cristal con barras de señal),
 * sala de servidores con racks y luces parpadeantes, radomo geodésico de 7 m, antena parabólica de 14 m con montura
 * azimut-elevación, torre de radar de matriz en fase giratoria (121 elementos), radar de barra en el techo, antenas VSAT,
 * mástil reticulado de 46 m con dos plataformas, 6 paneles sectoriales, 5 enlaces de microondas y balizas, pulsos de señal,
 * garita con barrera animada, dos generadores con depósito, baterías, paneles solares, postes de luz, letrero y luces de borde.
 *
 * Uso:
 *   const cm = createEstacionComunicaciones(THREE, { accent: 0x2fd0a0 });
 *   cm.group.position.set(x, groundY, z);        // la base de la losa está en y = 0
 *   scene.add(cm.group);
 *   cm.update(clock.getElapsedTime());
 *
 * Escala: 1 unidad = 4 m. Huella: 14 x 14 unidades (cm.footprint), centrada en el origen. Altura ~13.
 * Entrada: cm.entrance (borde +Z). Energía: cm.input (borde -X). Enlace de datos: cm.output (borde +X). cm.nivel = 2.
 *
 * Estados (cm.setState): 'working' (antenas barren, radares giran, pulsos), 'alert' (rojo, radares rápidos), 'broken'
 *   (antena caída, luces intermitentes), 'off'. Por defecto corre una demostración (cm.demo = true); setState la desactiva.
 *   cm.setSignal(0..1): intensidad de señal. cm.setGhost(true, valid) para colocar; cm.setAccent(hex).
 * Compatible con Three.js r128 o superior.
 */
function createEstacionComunicaciones(THREE, opts) {
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
  var SLAB = 0.4, SZ = 14, k, j, i, q;
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
  mats.plaza = std(0xa9a49a, 0.1, 0.85); mats.road = std(0x363940, 0.2, 0.85);
  mats.mastR = std(0xe0472a, 0.4, 0.5); mats.mastW = std(0xf2f2f2, 0.35, 0.5);
  mats.radome = std(0xf4f6f8, 0.1, 0.55, { flatShading: true });
  mats.solar = std(0x16264a, 0.85, 0.22, { emissive: 0x0a1a3a, emissiveIntensity: 0.4 });
  mats.cell = std(0x6d86b8, 0.8, 0.3);
  mats.cont = std(0x3f6f8f, 0.45, 0.55); mats.contB = std(0xc9a02f, 0.45, 0.55);
  mats.rack = std(0x20262f, 0.7, 0.4);
  mats.ledG = bas(0x35ff7a); mats.ledA = bas(0xffb020);
  mats.beaconM = bas(0xff3b30);
  mats.arr = std(0x1c2430, 0.6, 0.35, { emissive: 0x0b2a3a, emissiveIntensity: 0.5 });
  mats.smoke = new THREE.MeshBasicMaterial({ color: 0x9a9a9a, transparent: true, opacity: 0.25, depthWrite: false });
  mats.lineR = new THREE.LineBasicMaterial({ color: 0xb9c4cf, transparent: true, opacity: 0.8 });

  function capDish(parent, r, tl) {
    var R = r / Math.sin(tl), g = new THREE.SphereGeometry(R, 22, 8, 0, TAU, P - tl, tl); g.rotateX(P / 2); g.translate(0, 0, R);
    return new THREE.Mesh(g, mats.panel);
  }

  /* ---------- Losa, caminos y luces de borde ---------- */
  box(group, SZ, SLAB, SZ, mats.slab, 0, SLAB / 2, 0, 0.06);
  box(group, SZ - 0.6, 0.04, SZ - 0.6, mats.conc, 0, SLAB + 0.01, 0, 0.01);
  box(group, 1.3, 0.05, 8.6, mats.road, -2.6, SLAB + 0.03, 2.9, 0.01);
  box(group, 5.6, 0.05, 1.0, mats.road, 0.2, SLAB + 0.03, 3.3 - 0.9, 0.01);
  for (k = 0; k < 11; k++) box(group, 0.08, 0.052, 0.4, mats.panel, -2.6, SLAB + 0.035, 6.8 - k * 0.75, 0.005);
  var edgeL = [];
  for (k = 0; k < 15; k++) { var ev = -6.3 + k * 0.9; edgeL.push({ x: ev, y: SLAB + 0.03, z: -6.82, sx: 0.28, sy: 0.03, sz: 0.08 }); edgeL.push({ x: ev, y: SLAB + 0.03, z: 6.82, sx: 0.28, sy: 0.03, sz: 0.08 }); edgeL.push({ x: -6.82, y: SLAB + 0.03, z: ev, sx: 0.08, sy: 0.03, sz: 0.28 }); edgeL.push({ x: 6.82, y: SLAB + 0.03, z: ev, sx: 0.08, sy: 0.03, sz: 0.28 }); }
  var edgeM = boxField(UB, mats.eC, edgeL); group.add(edgeM);

  /* ---------- Centro de operaciones de dos plantas ---------- */
  var BX = -2.6, BZ = -4.0, BW = 7, BD = 4.0, H1 = 2.0, H2 = 1.8, y0 = SLAB, roofY = y0 + H1 + H2 + 0.3, FZ = BZ + BD / 2;
  box(group, BW + 0.2, 0.25, BD + 0.2, mats.concD, BX, y0 + 0.125, BZ, 0.03);
  box(group, BW, H1, BD, mats.panel, BX, y0 + H1 / 2 + 0.1, BZ, 0.05);
  box(group, BW + 0.3, 0.14, BD + 0.3, mats.conc, BX, y0 + H1 + 0.17, BZ, 0.03);               // forjado intermedio
  box(group, BW - 0.2, H2, BD - 0.2, mats.strip, BX, y0 + H1 + 0.24 + H2 / 2, BZ, 0.04);       // planta superior acristalada
  box(group, BW + 0.4, 0.16, BD + 0.4, mats.conc, BX, y0 + H1 + H2 + 0.32, BZ, 0.03);          // cubierta con alero
  box(group, BW + 0.42, 0.1, BD + 0.42, mats.accent, BX, y0 + H1 + H2 + 0.46, BZ, 0.01);
  var mull = [], winLit = [];
  for (k = 0; k < 15; k++) {
    var mx = BX - BW / 2 + 0.3 + k * ((BW - 0.6) / 14);
    mull.push({ x: mx, y: y0 + H1 + 0.24 + H2 / 2, z: FZ - 0.08, sx: 0.06, sy: H2, sz: 0.06 }); mull.push({ x: mx, y: y0 + H1 + 0.24 + H2 / 2, z: BZ - BD / 2 + 0.08, sx: 0.06, sy: H2, sz: 0.06 });
    if (rnd() > 0.22 && k < 14) { winLit.push({ x: mx + 0.24, y: y0 + H1 + 0.24 + H2 / 2, z: FZ - 0.06, sx: 0.4, sy: H2 * 0.7, sz: 0.02 }); }
  }
  for (k = 0; k < 8; k++) { var mz = BZ - BD / 2 + 0.3 + k * ((BD - 0.6) / 7); mull.push({ x: BX - BW / 2 + 0.08, y: y0 + H1 + 0.24 + H2 / 2, z: mz, sx: 0.06, sy: H2, sz: 0.06 }); mull.push({ x: BX + BW / 2 - 0.08, y: y0 + H1 + 0.24 + H2 / 2, z: mz, sx: 0.06, sy: H2, sz: 0.06 }); if (rnd() > 0.3 && k < 7) winLit.push({ x: BX + BW / 2 - 0.06, y: y0 + H1 + 0.24 + H2 / 2, z: mz + 0.2, sx: 0.02, sy: H2 * 0.7, sz: 0.32 }); }
  group.add(boxField(UB, mats.trim, mull));
  // planta baja: ventanas estrechas en banda y costillas
  var ribs = [];
  for (k = 0; k < 8; k++) { ribs.push({ x: BX - 3.2 + k * 0.92, y: y0 + 1.15, z: FZ + 0.012, sx: 0.07, sy: 1.9, sz: 0.04 }); ribs.push({ x: BX - 3.2 + k * 0.92, y: y0 + 1.15, z: BZ - BD / 2 - 0.012, sx: 0.07, sy: 1.9, sz: 0.04 }); }
  group.add(boxField(UB, mats.concD, ribs));
  [-2.5, 2.5].forEach(function (dx) {
    add(group, new THREE.BoxGeometry(1.6, 0.55, 0.05), mats.strip, BX + dx, y0 + 1.3, FZ + 0.02);
    for (k = 0; k < 4; k++) winLit.push({ x: BX + dx - 0.58 + k * 0.39, y: y0 + 1.3, z: FZ + 0.05, sx: 0.3, sy: 0.38, sz: 0.02 });
    box(group, 1.72, 0.07, 0.1, mats.concD, BX + dx, y0 + 0.97, FZ + 0.05, 0.01);
  });
  // vestíbulo de cristal con marco, escritorio y marquesina
  box(group, 2.4, 2.1, 1.5, mats.panel, BX, y0 + 1.15, FZ + 0.7, 0.04);
  add(group, new THREE.BoxGeometry(2.0, 1.6, 1.2), mats.glassL, BX, y0 + 1.0, FZ + 0.9);
  box(group, 2.5, 0.12, 1.6, mats.conc, BX, y0 + 2.2, FZ + 0.7, 0.03);
  [-1, 0, 1].forEach(function (s) { box(group, 0.06, 1.6, 0.06, mats.trim, BX + s * 1.0, y0 + 1.0, FZ + 1.5, 0.01); });
  box(group, 0.9, 0.9, 0.04, mats.dark, BX, y0 + 0.6, FZ + 1.5, 0.01);
  add(group, new THREE.BoxGeometry(0.7, 0.02, 0.02), mats.eC, BX, y0 + 1.3, FZ + 1.52);
  box(group, 1.0, 0.45, 0.3, mats.trim, BX, y0 + 0.32, FZ + 0.6, 0.02);
  winLit.push({ x: BX, y: y0 + 0.62, z: FZ + 0.6, sx: 0.8, sy: 0.04, sz: 0.2 });
  var winMesh = boxField(UB, mats.winW, winLit); group.add(winMesh);
  var sigDim = [], sigOn = [];
  for (k = 0; k < 5; k++) { var bh = 0.1 + k * 0.08, bxp = BX - 0.4 + k * 0.2; sigDim.push(box(group, 0.12, bh, 0.03, mats.dim, bxp, y0 + 1.82 + bh / 2 - 0.05, FZ + 1.55, 0.005)); sigOn.push(box(group, 0.12, bh, 0.04, mats.eC, bxp, y0 + 1.82 + bh / 2 - 0.05, FZ + 1.56, 0.005)); }
  box(group, 1.6, 0.12, 0.02, mats.accent, BX, y0 + 2.5, FZ + 1.5, 0.005);
  box(group, 1.2, 0.5, 0.02, mats.dark, BX + 3.0, y0 + 0.5, FZ + 0.03, 0.01); box(group, 1.2, 0.04, 0.03, mats.accent, BX + 3.0, y0 + 0.8, FZ + 0.045, 0.005);
  // sala de servidores (ala baja) con racks visibles
  var SX = -5.4, SZc = 0.9, SW = 2.8, SD = 2.6, SH = 2.2;
  box(group, SW + 0.2, 0.22, SD + 0.2, mats.concD, SX, y0 + 0.11, SZc, 0.03);
  box(group, SW, SH, SD, mats.panel, SX, y0 + SH / 2 + 0.1, SZc, 0.05);
  box(group, SW + 0.25, 0.12, SD + 0.25, mats.conc, SX, y0 + SH + 0.16, SZc, 0.03);
  box(group, SW + 0.03, 0.1, SD + 0.03, mats.accent, SX, y0 + SH - 0.1, SZc, 0.01);
  add(group, new THREE.BoxGeometry(SW - 0.6, 0.9, 0.05), mats.strip, SX, y0 + 1.2, SZc + SD / 2 + 0.02);
  var racks = [], ledsG = [], ledsA = [];
  for (k = 0; k < 4; k++) {
    var rx = SX - 0.9 + k * 0.6; racks.push({ x: rx, y: y0 + 1.1, z: SZc + SD / 2 - 0.35, sx: 0.46, sy: 1.5, sz: 0.4 });
    for (j = 0; j < 7; j++) { (rnd() > 0.45 ? ledsG : ledsA).push({ x: rx + (rnd() - 0.5) * 0.3, y: y0 + 0.55 + j * 0.2, z: SZc + SD / 2 - 0.14, sx: 0.04, sy: 0.04, sz: 0.02 }); }
  }
  group.add(boxField(UB, mats.rack, racks));
  var ledMG = boxField(UB, mats.ledG, ledsG), ledMA = boxField(UB, mats.ledA, ledsA); group.add(ledMG); group.add(ledMA);
  [-0.8, 0.2].forEach(function (dz) {
    box(group, 0.5, 0.9, 0.9, mats.hull2, SX - SW / 2 - 0.32, y0 + 0.55, SZc + dz, 0.04);
    cylP(group, 0.2, 0.2, 0.04, 16, mats.dark, SX - SW / 2 - 0.58, y0 + 0.62, SZc + dz).rotation.z = P / 2;
  });
  // techo: equipos, ventilaciones, antenas VSAT y radar
  box(group, 1.2, 0.55, 0.8, mats.hull2, BX - 2.0, roofY + 0.28, BZ + 0.9, 0.05); cylP(group, 0.3, 0.3, 0.05, 18, mats.dark, BX - 2.3, roofY + 0.57, BZ + 0.9); cylP(group, 0.3, 0.3, 0.05, 18, mats.dark, BX - 1.7, roofY + 0.57, BZ + 0.9);
  box(group, 1.6, 0.08, 0.22, mats.trim, BX + 0.6, roofY + 0.06, BZ - 1.2, 0.01);
  for (k = 0; k < 4; k++) { cylP(group, 0.09, 0.09, 0.5, 10, mats.hull2, BX + 1.8 + k * 0.3, roofY + 0.25, BZ + 1.1); cylP(group, 0.13, 0.13, 0.04, 10, mats.trim, BX + 1.8 + k * 0.3, roofY + 0.52, BZ + 1.1); }
  greeble(BX, roofY, BZ, BW - 1.4, 0.2, BD - 1.0, 14, mats.hull2, 'y', 0.15, 0.45);
  [[BX + 2.7, BZ - 0.9, 0.5], [BX - 1.2, BZ - 1.3, -0.6], [BX + 0.4, BZ + 0.9, 0.2]].forEach(function (p) {
    var dg = new THREE.Group(); dg.position.set(p[0], roofY, p[1]); group.add(dg);
    cylP(dg, 0.08, 0.1, 0.55, 10, mats.trim, 0, 0.27, 0); box(dg, 0.3, 0.06, 0.3, mats.concD, 0, 0.03, 0, 0.01);
    var dh = new THREE.Group(); dh.position.set(0, 0.62, 0); dh.rotation.y = p[2]; dh.rotation.x = -0.6; dg.add(dh);
    dh.add(capDish(dh, 0.44, 0.9)); cylP(dh, 0.03, 0.03, 0.1, 6, mats.trim, 0, 0, -0.05);
    strutIn(dh, [0, 0, 0.18], [0, 0, 0.44], 0.012, mats.trim); add(dh, new THREE.SphereGeometry(0.04, 8, 6), mats.hull2, 0, 0, 0.46);
  });
  var radarG = new THREE.Group(); radarG.position.set(BX - 3.0, roofY, BZ - 1.0); group.add(radarG);
  cylP(radarG, 0.24, 0.32, 0.14, 14, mats.concD, 0, 0.07, 0); cylP(radarG, 0.11, 0.13, 0.9, 12, mats.trim, 0, 0.55, 0);
  var radarH = new THREE.Group(); radarH.position.y = 1.05; radarG.add(radarH);
  cylP(radarH, 0.16, 0.16, 0.16, 14, mats.hull2, 0, 0, 0); box(radarH, 2.0, 0.34, 0.07, mats.panel, 0, 0.2, 0.13, 0.02);
  for (k = 0; k < 6; k++) box(radarH, 0.015, 0.34, 0.075, mats.trim, -0.8 + k * 0.32, 0.2, 0.13, 0.003);
  box(radarH, 0.24, 0.12, 0.26, mats.hull2, 0, 0.2, 0.0, 0.02); box(radarH, 2.0, 0.05, 0.12, mats.accent, 0, 0.39, 0.13, 0.01);
  var statusLamp = add(group, new THREE.SphereGeometry(0.1, 12, 10), mats.status, BX + 3.2, roofY + 0.2, BZ + 1.5); cylP(group, 0.03, 0.03, 0.2, 8, mats.trim, BX + 3.2, roofY + 0.08, BZ + 1.5);

  /* ---------- Radomo geodésico de 7 m ---------- */
  var RX = 2.1, RZ = 2.6, RR = 1.55, RH = y0 + 1.1;
  cylP(group, 1.3, 1.5, 0.5, 20, mats.conc, RX, y0 + 0.25, RZ); cylP(group, 1.2, 1.2, 0.7, 20, mats.concD, RX, y0 + 0.75, RZ);
  for (i = 0; i < 12; i++) { var ra = i / 12 * TAU; box(group, 0.1, 0.55, 0.12, mats.trim, RX + Math.cos(ra) * 1.21, y0 + 0.78, RZ + Math.sin(ra) * 1.21, 0.01).rotation.y = -ra; }
  var rg = new THREE.IcosahedronGeometry(RR, 2); rg.scale(1, 1.0, 1);
  var radome = add(group, rg, mats.radome, RX, RH + RR - 0.15, RZ);
  var redge = new THREE.LineSegments(new THREE.EdgesGeometry(rg, 8), mats.lineR); redge.position.copy(radome.position); group.add(redge);
  add(group, new THREE.TorusGeometry(RR * 0.99, 0.05, 8, 40).rotateX(P / 2), mats.accent, RX, RH + 0.55, RZ);
  box(group, 0.7, 1.0, 0.05, mats.dark, RX - RR * 0.62, y0 + 1.0, RZ + RR * 0.9, 0.02).rotation.y = -0.6;              // puerta de acceso
  box(group, 0.12, 0.4, 0.4, mats.trim, RX, RH + RR * 2 - 0.1, RZ, 0.02);
  cylP(group, 0.03, 0.03, 0.5, 6, mats.trim, RX, RH + RR * 2 + 0.2, RZ);
  var radomeLamp = add(group, new THREE.SphereGeometry(0.07, 8, 6), mats.beaconM, RX, RH + RR * 2 + 0.5, RZ);

  /* ---------- Torre de radar de matriz en fase (array de cuatro caras giratorio) ---------- */
  var AX = 2.2, AZ = -5.4;
  box(group, 1.5, 2.2, 1.5, mats.concD, AX, y0 + 1.1, AZ, 0.05); box(group, 1.7, 0.16, 1.7, mats.conc, AX, y0 + 2.28, AZ, 0.03);
  for (k = 0; k < 4; k++) box(group, 0.1, 2.0, 0.1, mats.trim, AX + (k % 2 ? 0.7 : -0.7), y0 + 1.1, AZ + (k < 2 ? 0.7 : -0.7), 0.01);
  box(group, 0.9, 0.9, 0.04, mats.dark, AX, y0 + 0.65, AZ + 0.77, 0.01);
  var arrG = new THREE.Group(); arrG.position.set(AX, y0 + 2.4, AZ); group.add(arrG);
  cylP(arrG, 0.4, 0.5, 0.25, 16, mats.hull2, 0, 0.12, 0); cylP(arrG, 0.22, 0.22, 0.8, 12, mats.trim, 0, 0.65, 0);
  var arrFace = new THREE.Group(); arrFace.position.set(0, 1.7, 0); arrG.add(arrFace);
  box(arrFace, 2.2, 2.2, 0.28, mats.panel, 0, 0, 0.1, 0.05); box(arrFace, 2.0, 2.0, 0.04, mats.arr, 0, 0, 0.26, 0.01);
  var cells = [];
  for (j = 0; j < 11; j++) for (i = 0; i < 11; i++) cells.push({ x: -0.9 + i * 0.18, y: -0.9 + j * 0.18, z: 0.29, sx: 0.12, sy: 0.12, sz: 0.02 });
  arrFace.add(boxField(UB, mats.eC, cells));
  strutIn(arrFace, [-1.0, -1.1, 0.0], [-0.5, -1.9, -0.25], 0.05, mats.trim); strutIn(arrFace, [1.0, -1.1, 0.0], [0.5, -1.9, -0.25], 0.05, mats.trim);
  box(arrFace, 1.4, 0.1, 0.4, mats.hull2, 0, -1.3, -0.1, 0.02); arrFace.rotation.x = -0.28;
  [-1, 1].forEach(function (s) { add(arrFace, new THREE.SphereGeometry(0.05, 8, 6), mats.lamp, s * 1.15, 1.15, 0.12); });

  /* ---------- Mástil reticulado de 46 m ---------- */
  var MX = 5.4, MZ = -4.6, NS = 9, MH = 11.0, R0 = 1.0, R1 = 0.24, mast = new THREE.Group(); mast.position.set(MX, y0, MZ); group.add(mast);
  function mr(s) { return R0 + (R1 - R0) * s / NS; }
  function my(s) { return 0.3 + MH * s / NS; }
  function leg(a, s) { return [Math.cos(a) * mr(s), my(s), Math.sin(a) * mr(s)]; }
  cylP(mast, 1.7, 1.8, 0.25, 6, mats.conc, 0, 0.125, 0);
  var legA = [P / 2, P / 2 + TAU / 3, P / 2 + 2 * TAU / 3];
  for (i = 0; i < 3; i++) { var fp = leg(legA[i], 0); box(mast, 0.55, 0.22, 0.55, mats.concD, fp[0], 0.32, fp[2], 0.03); cylP(mast, 0.13, 0.13, 0.12, 8, mats.trim, fp[0], 0.44, fp[2]); }
  for (j = 0; j < NS; j++) {
    var segM = j % 2 ? mats.mastW : mats.mastR;
    for (i = 0; i < 3; i++) {
      var a = legA[i], b = legA[(i + 1) % 3];
      strutIn(mast, leg(a, j), leg(a, j + 1), 0.055, segM);
      strutIn(mast, leg(a, j + 1), leg(b, j + 1), 0.03, mats.mastW);
      strutIn(mast, j % 2 ? leg(a, j) : leg(b, j), j % 2 ? leg(b, j + 1) : leg(a, j + 1), 0.024, mats.mastW);
    }
  }
  for (j = 0; j <= NS; j++) for (i = 0; i < 3; i++) { var nd = leg(legA[i], j); add(mast, new THREE.SphereGeometry(0.065, 8, 6), mats.trim, nd[0], nd[1], nd[2]); }
  [3, 6.5].forEach(function (s) {
    var PL = new THREE.Group(); PL.position.set(0, my(s), 0); mast.add(PL);
    var rp = mr(s) + 0.15;
    add(PL, new THREE.RingGeometry(0.2, rp + 0.1, 3, 1).rotateX(-P / 2), mats.trim, 0, 0, 0);
    add(PL, new THREE.TorusGeometry(rp, 0.02, 6, 24).rotateX(P / 2), mats.accent, 0, 0.9, 0); add(PL, new THREE.TorusGeometry(rp, 0.016, 6, 24).rotateX(P / 2), mats.accent, 0, 0.45, 0);
    for (i = 0; i < 9; i++) { var pa = i / 9 * TAU; strutIn(PL, [Math.cos(pa) * rp, 0, Math.sin(pa) * rp], [Math.cos(pa) * rp, 0.9, Math.sin(pa) * rp], 0.014, mats.accent); }
  });
  [[7.6, 0], [4.2, 0.5]].forEach(function (cfg) {
    for (i = 0; i < 3; i++) {
      var sg = new THREE.Group(); sg.rotation.y = -(legA[i] + cfg[1]); sg.position.y = my(cfg[0]); mast.add(sg);
      var rr = mr(cfg[0]);
      box(sg, 0.08, 1.4, 0.32, mats.panel, rr + 0.34, 0, 0, 0.02); box(sg, 0.03, 1.3, 0.24, mats.concD, rr + 0.28, 0, 0, 0.01);
      strutIn(sg, [rr, 0.45, 0], [rr + 0.3, 0.45, 0], 0.025, mats.trim); strutIn(sg, [rr, -0.45, 0], [rr + 0.3, -0.45, 0], 0.025, mats.trim);
      add(sg, new THREE.SphereGeometry(0.03, 6, 6), mats.lamp, rr + 0.39, 0.66, 0);
    }
  });
  [[0.4, 5.3], [2.6, 5.3], [4.6, 2.2], [5.8, 2.2], [1.6, 2.2]].forEach(function (p) {
    var mg = new THREE.Group(); mg.rotation.y = -p[0]; mg.position.y = my(p[1]); mast.add(mg);
    var rr = mr(p[1]);
    strutIn(mg, [rr, 0, 0], [rr + 0.34, 0, 0], 0.03, mats.trim);
    var dd = new THREE.Group(); dd.position.set(rr + 0.38, 0, 0); dd.rotation.y = P / 2; mg.add(dd);
    dd.add(capDish(dd, 0.5, 0.9)); strutIn(dd, [0, 0, 0.22], [0, 0, 0.5], 0.012, mats.trim); add(dd, new THREE.SphereGeometry(0.045, 8, 6), mats.hull2, 0, 0, 0.52);
  });
  cylP(mast, 0.03, 0.05, 1.8, 8, mats.mastW, 0, my(NS) + 0.9, 0);
  for (i = 0; i < 3; i++) { var wa = legA[i] + P / 3; strutIn(mast, [Math.cos(wa) * 0.22, my(NS) - 0.8, Math.sin(wa) * 0.22], [Math.cos(wa) * 0.34, my(NS) + 1.0, Math.sin(wa) * 0.34], 0.012, mats.trim); }
  var topLamp = add(mast, new THREE.SphereGeometry(0.11, 12, 10), mats.beaconM, 0, my(NS) + 1.85, 0);
  var midLamp = add(mast, new THREE.SphereGeometry(0.09, 10, 8), mats.beaconM, 0, my(5), mr(5) + 0.05);
  var mastTopY = y0 + my(NS) + 1.85;
  // cable de bajada por una pata y caseta de equipos
  strutIn(mast, [leg(legA[0], 0)[0] + 0.08, 0.5, leg(legA[0], 0)[2]], [leg(legA[0], NS)[0] + 0.08, my(NS), leg(legA[0], NS)[2]], 0.02, mats.cable || mats.dark);
  box(group, 1.0, 1.0, 0.7, mats.panel, MX - 1.8, y0 + 0.5, MZ + 0.8, 0.04); for (k = 0; k < 4; k++) add(group, new THREE.SphereGeometry(0.025, 6, 6), k % 2 ? mats.green : mats.lamp, MX - 2.05 + k * 0.12, y0 + 0.8, MZ + 1.16);
  pipeRun([[BX + BW / 2 + 0.2, y0 + 0.2, MZ + 0.7], [MX - 1.3, y0 + 0.2, MZ + 0.7]], 0.05, mats.dark); pipeRun([[BX + BW / 2 + 0.2, y0 + 0.3, MZ + 0.9], [MX - 1.3, y0 + 0.3, MZ + 0.9]], 0.04, mats.dark);

  /* ---------- Antena parabólica principal de 14 m (azimut-elevación) ---------- */
  var DX = 4.9, DZ = -0.5, DR = 1.55, DF = 1.3;
  cylP(group, 0.9, 1.0, 0.3, 14, mats.conc, DX, y0 + 0.15, DZ); cylP(group, 0.45, 0.6, 0.7, 14, mats.concD, DX, y0 + 0.65, DZ);
  for (i = 0; i < 8; i++) { var ba = i / 8 * TAU; cylP(group, 0.03, 0.03, 0.06, 6, mats.trim, DX + Math.cos(ba) * 0.8, y0 + 0.33, DZ + Math.sin(ba) * 0.8); }
  var dY = new THREE.Group(); dY.position.set(DX, y0 + 1.0, DZ); group.add(dY);
  cylP(dY, 0.55, 0.55, 0.16, 18, mats.hull2, 0, 0.08, 0);
  box(dY, 0.22, 1.7, 0.4, mats.hull2, -1.8, 0.9, 0, 0.04); box(dY, 0.22, 1.7, 0.4, mats.hull2, 1.8, 0.9, 0, 0.04); box(dY, 3.8, 0.22, 0.55, mats.hull2, 0, 0.11, 0, 0.04);
  [-1, 1].forEach(function (s) { strutIn(dY, [s * 0.22, 0.17, 0.22], [s * 1.75, 1.55, 0.1], 0.045, mats.trim); strutIn(dY, [s * 0.22, 0.17, -0.22], [s * 1.75, 1.55, -0.1], 0.045, mats.trim); cylP(dY, 0.14, 0.14, 0.09, 12, mats.accent, s * 1.95, 1.35, 0).rotation.z = P / 2; });
  var dX = new THREE.Group(); dX.position.set(0, 1.35, 0); dY.add(dX);
  cylP(dX, 0.08, 0.08, 3.8, 10, mats.trim, 0, 0, 0).rotation.z = P / 2; cylP(dX, 0.25, 0.3, 0.4, 14, mats.hull2, 0, -0.1, 0);
  var dpts = [], dpts2 = [];
  for (k = 0; k <= 18; k++) { var rd = DR * k / 18, yd = rd * rd / (4 * DF); dpts.push(new THREE.Vector2(rd, yd)); dpts2.push(new THREE.Vector2(rd, yd - 0.05)); }
  add(dX, new THREE.LatheGeometry(dpts, 44), mats.panel, 0, 0.05, 0); add(dX, new THREE.LatheGeometry(dpts2, 44), mats.concD, 0, 0.0, 0);
  var rimY = DR * DR / (4 * DF) + 0.05;
  add(dX, new THREE.TorusGeometry(DR, 0.035, 8, 44).rotateX(P / 2), mats.accent, 0, rimY, 0);
  for (i = 0; i < 16; i++) { var ra2 = i / 16 * TAU; strutIn(dX, [0, -0.05, 0], [Math.cos(ra2) * DR * 0.88, DR * DR * 0.77 / (4 * DF) - 0.05, Math.sin(ra2) * DR * 0.88], 0.014, mats.trim); }
  for (i = 0; i < 4; i++) { var fa = i * P / 2 + P / 4; strutIn(dX, [Math.cos(fa) * DR * 0.96, rimY, Math.sin(fa) * DR * 0.96], [0, 0.05 + DF, 0], 0.024, mats.trim); }
  cylP(dX, 0.09, 0.11, 0.22, 12, mats.hull2, 0, 0.05 + DF, 0); add(dX, new THREE.SphereGeometry(0.2, 14, 8, 0, TAU, 0, P / 2).rotateX(P), mats.panel, 0, 0.05 + DF - 0.1, 0);
  add(dX, new THREE.SphereGeometry(0.05, 8, 6), mats.lamp, 0, 0.05 + DF + 0.14, 0);

  /* ---------- Garita con barrera, generadores, baterías y paneles solares ---------- */
  var GZ = 6.3;
  box(group, 1.1, 1.3, 1.1, mats.panel, -1.2, y0 + 0.65, GZ, 0.04); box(group, 1.3, 0.1, 1.3, mats.conc, -1.2, y0 + 1.35, GZ, 0.02);
  add(group, new THREE.BoxGeometry(0.8, 0.4, 0.05), mats.strip, -1.2, y0 + 0.85, GZ + 0.56); add(group, new THREE.BoxGeometry(0.05, 0.4, 0.8), mats.strip, -1.76, y0 + 0.85, GZ);
  box(group, 0.3, 0.6, 0.3, mats.trim, -1.95, y0 + 0.3, GZ + 0.1, 0.03);
  var arm = new THREE.Group(); group.add(arm); arm.position.set(-1.95, y0 + 0.7, GZ + 0.1);
  for (k = 0; k < 6; k++) box(arm, 0.28, 0.09, 0.07, k % 2 ? mats.hazK || mats.dark : mats.accent, -0.16 - k * 0.28, 0, 0, 0.005);
  [[-5.8, 5.6], [5.8, 5.6]].forEach(function (p) { cylP(group, 0.06, 0.08, 2.4, 8, mats.hull2, p[0], y0 + 1.2, p[1]); box(group, 0.5, 0.1, 0.22, mats.dark, p[0] + (p[0] < 0 ? 0.2 : -0.2), y0 + 2.45, p[1], 0.02); add(group, new THREE.BoxGeometry(0.4, 0.03, 0.15), mats.winW, p[0] + (p[0] < 0 ? 0.2 : -0.2), y0 + 2.39, p[1]); });
  [-5.4, -3.9].forEach(function (gx, n) {
    box(group, 1.3, 1.0, 1.0, mats.cont, gx, y0 + 0.55, 3.9, 0.05); box(group, 1.35, 0.1, 1.05, mats.accent, gx, y0 + 1.04, 3.9, 0.02);
    for (k = 0; k < 6; k++) box(group, 0.04, 0.5, 0.03, mats.dark, gx - 0.45 + k * 0.18, y0 + 0.55, 4.42, 0.005);
    cylP(group, 0.07, 0.07, 0.6, 10, mats.trim, gx + 0.35, y0 + 1.3, 3.8); cylP(group, 0.11, 0.11, 0.04, 10, mats.dark, gx + 0.35, y0 + 1.62, 3.8);
  });
  var tk = cylP(group, 0.4, 0.4, 2.0, 18, mats.hull2, -4.7, y0 + 0.75, 5.5); tk.rotation.z = P / 2;
  [-0.7, 0.7].forEach(function (dx) { box(group, 0.12, 0.34, 0.8, mats.trim, -4.7 + dx, y0 + 0.17, 5.5, 0.01); add(group, new THREE.TorusGeometry(0.405, 0.02, 6, 20).rotateY(P / 2), mats.accent, -4.7 + dx * 0.9, y0 + 0.75, 5.5); });
  pipeRun([[-4.7, y0 + 0.4, 4.4], [-4.7, y0 + 0.25, 4.7], [-4.7, y0 + 0.25, 5.1]], 0.05, mats.pipe);
  [[5.4, 3.4], [5.4, 4.7]].forEach(function (p) {
    box(group, 2.2, 1.1, 1.0, mats.contB, p[0], y0 + 0.6, p[1], 0.05); for (k = 0; k < 8; k++) box(group, 0.03, 0.8, 0.03, mats.dark, p[0] - 0.9 + k * 0.26, y0 + 0.6, p[1] + 0.52, 0.004);
    add(group, new THREE.SphereGeometry(0.04, 6, 6), mats.green, p[0] + 1.0, y0 + 1.0, p[1] + 0.52);
  });
  for (i = 0; i < 3; i++) {
    var sp = new THREE.Group(); sp.position.set(-0.1 + i * 2.0, y0 + 0.5, 4.95 + (i % 2) * 0.0); group.add(sp);
    box(sp, 0.1, 0.5, 0.1, mats.trim, -0.7, -0.15, 0.2, 0.01); box(sp, 0.1, 0.5, 0.1, mats.trim, 0.7, -0.15, 0.2, 0.01);
    var pg = new THREE.Group(); pg.rotation.x = 0.55; sp.add(pg);
    box(pg, 1.8, 0.06, 1.0, mats.solar, 0, 0, 0, 0.015);
    var gl = []; for (k = 1; k < 5; k++) gl.push({ x: -0.9 + k * 0.36, y: 0.035, z: 0, sx: 0.015, sy: 0.01, sz: 0.95 }); for (k = 1; k < 3; k++) gl.push({ x: 0, y: 0.035, z: -0.5 + k * 0.33, sx: 1.75, sy: 0.01, sz: 0.015 });
    pg.add(boxField(UB, mats.cell, gl));
  }
  // letrero con ondas de radio
  box(group, 1.6, 0.8, 0.08, mats.dark, -5.2, y0 + 1.3, 6.5, 0.03); box(group, 0.08, 1.0, 0.08, mats.trim, -5.2, y0 + 0.5, 6.48, 0.01);
  for (k = 0; k < 3; k++) add(group, new THREE.TorusGeometry(0.1 + k * 0.1, 0.018, 6, 14, P * 0.7).rotateZ(-P * 0.35), mats.eC, -5.5, y0 + 1.3, 6.55);
  add(group, new THREE.SphereGeometry(0.045, 8, 6), mats.eC, -5.5, y0 + 1.3, 6.55);
  box(group, 0.7, 0.07, 0.015, mats.accent, -4.95, y0 + 1.5, 6.55, 0.005); box(group, 0.5, 0.05, 0.015, mats.dim, -5.05, y0 + 1.25, 6.55, 0.005);

  /* ---------- Pulsos de señal, humo y animación ---------- */
  var pulses = [];
  for (i = 0; i < 3; i++) {
    var pm = glowMat(0x35e0ff, 0.3), pr = new THREE.Mesh(new THREE.TorusGeometry(1, 0.02, 6, 60).rotateX(P / 2), pm);
    pr.position.set(MX, mastTopY - 0.4, MZ); pr.frustumCulled = false; group.add(pr); pulses.push({ m: pr, mat: pm, ph: i / 3 });
  }
  var puffsA = [];
  for (i = 0; i < 4; i++) { var pf = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), mats.smoke.clone()); pf.frustumCulled = false; group.add(pf); puffsA.push({ m: pf, ph: i / 4 }); }
  var entrance = new THREE.Object3D(); group.add(entrance); entrance.position.set(-2.6, SLAB + 0.2, 6.9);

  /* ---------- Estados y API ---------- */
  var mode = 'working', level = 0.7, lastT = null, demoT = 0, ghost = false, origEm = {}, dishAz = 0, dishEl = 0.6, radarA = 0, arrA = 0, armA = 0;
  var api = {
    group: group,
    footprint: { w: SZ, d: SZ },
    entrance: entrance,
    input: new THREE.Object3D(),     // energía (borde -X)
    output: new THREE.Object3D(),    // enlace de datos (borde +X)
    nivel: 2,
    demo: true,
    getState: function () { return mode; },
    getSignal: function () { return level; },
    setSignal: function (f) { level = clamp(f, 0, 1); },
    setState: function (s) { api.demo = false; mode = s; },
    setAccent: setAccent,
    setGhost: function (on, valid) {
      ghost = !!on; redge.visible = !ghost;
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
      var tAz = mode === 'working' ? Math.sin(t * 0.15) * 1.0 : mode === 'alert' ? -0.4 : mode === 'broken' ? 0.9 : 0;
      var tEl = mode === 'working' ? 0.7 + 0.25 * Math.sin(t * 0.1 + 1) : mode === 'alert' ? 1.05 : mode === 'broken' ? 0.1 : 0.5;
      var sp2 = Math.min(1, dt * 1.5);
      dishAz += (tAz - dishAz) * sp2; dishEl += (tEl - dishEl) * sp2; dY.rotation.y = dishAz; dX.rotation.x = dishEl;
      radarA += dt * (alive ? (mode === 'alert' ? 5.5 : 2.2) : 0); radarH.rotation.y = radarA;
      arrA += dt * (alive ? (mode === 'alert' ? 1.4 : 0.45) : 0); arrG.rotation.y = arrA;
      for (i = 0; i < pulses.length; i++) {
        var pu = pulses[i], ph = (t * 0.3 + pu.ph) % 1, vis = alive && level > 0.05;
        pu.m.visible = vis;
        if (vis) { var sc = 0.6 + ph * (2.5 + level * 2.8); pu.m.scale.set(sc, sc, sc); pu.mat.opacity = (1 - ph) * 0.32; pu.mat.color.setHex(mode === 'alert' ? 0xff5a4a : 0x35e0ff); }
      }
      var nb = on ? Math.ceil(level * 5 - 0.001) : 0;
      for (i = 0; i < 5; i++) sigOn[i].visible = mode === 'broken' ? (i < 2 && Math.sin(t * 7 + i) > 0) : i < nb;
      var blink = Math.sin(t * (mode === 'alert' ? 8 : 2.2)) > 0;
      topLamp.visible = on && (mode === 'broken' ? Math.sin(t * 3) > 0.6 : blink); midLamp.visible = on && (mode === 'alert' ? !blink : blink); radomeLamp.visible = on && blink;
      var col = mode === 'working' ? 0x35ff7a : mode === 'alert' ? 0xff3b30 : mode === 'broken' ? 0xffa31a : 0x303030;
      if (mode === 'alert' || mode === 'broken') mats.status.color.setHex(Math.sin(t * 6) > 0 ? col : 0x301010); else mats.status.color.setHex(col);
      mats.eC.color.setHex(on ? (mode === 'alert' ? 0xff5a4a : 0x35e0ff) : 0x1a4650);
      edgeM.visible = on;
      winMesh.visible = on && (mode !== 'broken' || Math.sin(t * 9) > -0.4);
      ledMG.visible = on && Math.sin(t * 5) > -0.2; ledMA.visible = on && Math.sin(t * 3.1 + 1) > -0.3;
      var gateOpen = alive && (t % 11) > 3 && (t % 11) < 7.5;
      armA += ((gateOpen || !on ? -1.3 : 0) - armA) * Math.min(1, dt * 3); arm.rotation.z = armA;
      var smoking = alive && (mode === 'alert' || level > 0.8);
      for (i = 0; i < puffsA.length; i++) {
        var pp = puffsA[i], pf2 = (t * 0.3 + pp.ph) % 1;
        pp.m.visible = smoking;
        if (smoking) { pp.m.position.set(-5.05 + pf2 * 0.5, y0 + 1.65 + pf2 * 1.3, 3.8); pp.m.scale.setScalar(0.6 + pf2 * 2); pp.m.material.opacity = (1 - pf2) * 0.3; }
      }
    }
  };
  api.input.position.set(-7.0, SLAB + 0.5, MZ); group.add(api.input);
  api.output.position.set(7.0, SLAB + 0.5, MZ); group.add(api.output);
  api.update(0);
  return api;
}
