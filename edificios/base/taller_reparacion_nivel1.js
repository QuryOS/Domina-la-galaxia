/**
 * NAVE-TALLER DE REPARACIÓN (NIVEL 1) para Three.js, sin archivos externos. Naves pequeñas y medianas.
 *
 * Diseño propio, distinto de las pistas: una NAVE LARGA DE CRISTAL (≈150 m) con LÍNEA DE MONTAJE. La nave aterriza en la
 * plataforma OESTE, un remolcador la mete por el portón y un CARRO SOBRE RIELES la lleva de estación en estación:
 *   1) DIAGNÓSTICO: arco escáner con haz y barrido láser;
 *   2) ESTRUCTURA: 4 brazos robóticos con chispas y grúa puente;
 *   3) PINTURA: arco pulverizador con conos de pintura y secado.
 * Al terminar, otro remolcador la saca por el portón ESTE hasta la plataforma de salida, de donde despega. Incluye torre de
 * control, oficina/terminal, depósito de combustible, contenedores, paneles solares, grúa de patio y manga de viento.
 * Sin vallas, sin helicópteros, sin molinos y sin personas (solo el piloto animado, opcional).
 *
 * Uso:
 *   const taller = createTallerReparacion1(THREE, { accent: 0xf08a1e });
 *   taller.group.position.set(x, groundY, z);      // la base de la losa está en y = 0
 *   scene.add(taller.group);
 *   taller.update(clock.getElapsedTime());
 *
 * Escala: 1 unidad = 4 m. taller.footprint = {w, d}. taller.pad / taller.landing = plataforma de aterrizaje (oeste);
 * taller.padSalida = plataforma de despegue (este). taller.entrance = puerta de la oficina. input / output = energía.
 * repairSeconds = 600 (configurable con opts.repairSeconds). Estados de trabajo: queued, aligning, approach, towing, repairing,
 * repaired, ready, takeoff, departed. API igual que las pistas: land, service, launch, free, setState, setGhost, setAccent, getShips.
 * Estados: 'working', 'alert', 'broken', 'off'. Por defecto corre una demostración (taller.demo = true). Three.js r128 o superior.
 */
function createTallerReparacion1(THREE, opts) {
  opts = opts || {};
  var P = Math.PI, TAU = P * 2;
  var colors = {
    hull: opts.hull != null ? opts.hull : 0xd3d7dd,
    accent: opts.accent != null ? opts.accent : 0xf08a1e,
    dark: opts.dark != null ? opts.dark : 0x161c28,
    glow: opts.glow != null ? opts.glow : 0x62d6ff
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
  /* ---------- Constantes, materiales y utilidades ---------- */
  function pol(r, a) { return [Math.cos(a) * r, Math.sin(a) * r]; }
  function psiOf(a) { return Math.atan2(-Math.cos(a), -Math.sin(a)); }          // giro para que el +Z local mire al centro
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
  mats.conc = std(0xb7bbc2, 0.0, 0.85); mats.concD = std(0x8d9199, 0.0, 0.88);
  mats.panel = std(0xe9edf2, 0.25, 0.55);
  mats.strip = std(0x101a28, 0.9, 0.15, { emissive: 0x0a2236, emissiveIntensity: 0.55 });
  mats.asph = std(0x3a3e47, 0.0, 0.95); mats.apron = std(0x9a9ea5, 0.0, 0.9); mats.apronD = std(0x777b82, 0.0, 0.9);
  mats.mkY = bas(0xf2c21e); mats.mkW = bas(0xe9ecef);
  mats.lW = bas(0xfff2cf); mats.lG = bas(0x35ff7a); mats.lR = bas(0xff3b30); mats.lB = bas(0x3a7bff); mats.lA = bas(0xffb020);
  mats.hw = std(0xd3d9df, 0.45, 0.5); mats.hwD = std(0x8a929c, 0.5, 0.5); mats.floorH = std(0x6c727c, 0.0, 0.8);
  mats.hazY = std(0xf2b01e, 0.3, 0.5); mats.hazK = std(0x15171b, 0.3, 0.7);
  mats.rubber = std(0x15171a, 0, 0.9); mats.sand = std(0xc2a06a, 0, 0.95); mats.sandD = std(0xa88550, 0, 0.95);
  mats.cartY = std(0xf2b01e, 0.35, 0.5); mats.cartB = std(0x2f7bc0, 0.4, 0.5); mats.robot = std(0xe8ecef, 0.5, 0.35); mats.skin = std(0xe0b79a, 0, 0.8);
  mats.suit = std(0xff7a1f, 0.1, 0.7); mats.cab = std(0x0f2236, 0.9, 0.12, { emissive: 0x0c3552, emissiveIntensity: 0.7 });
  mats.cargoA = std(0x3f6f8f, 0.45, 0.55); mats.cargoB = std(0xc0502f, 0.45, 0.55); mats.cargoC = std(0x4a8a5a, 0.45, 0.55); mats.cargoD = std(0xc9a02f, 0.45, 0.55);
  mats.tankM = std(0xe7ecef, 0.3, 0.5); mats.blue = std(0x2f7bc0, 0.4, 0.5); mats.spark = bas(0xffd27a); mats.weld = bas(0x9fe8ff);
  mats.solar = std(0x16264a, 0.85, 0.22, { emissive: 0x0a1a3a, emissiveIntensity: 0.4 }); mats.cell = std(0x6d86b8, 0.8, 0.3);
  mats.sockO = std(0xff6a1a, 0, 0.8); mats.sockW = std(0xf4f4f4, 0, 0.8);
  mats.beam = glowMat(0xff3b30, 0.22); mats.dim = bas(0x23303c);
  var ACC = opts.accent != null ? opts.accent : 0xf08a1e;

  [mats.mkY, mats.mkW, mats.hazK, mats.hazY].forEach(function (m) { m.polygonOffset = true; m.polygonOffsetFactor = -2; m.polygonOffsetUnits = -2; });
  mats.slab.metalness = 0; mats.slab.roughness = 0.9;

  /* ---------- Constantes: una nave-taller larga con línea de montaje, y dos plataformas (entrada y salida) ---------- */
  var SLAB = 0.3, y0 = SLAB, D2R = Math.PI / 180, k, j, i, q, pa;
  var HX = 38, HZ = 14, WALLH = 11.5, FL = y0 + 0.07, DECK = 0.14, PADR = 9.6, XPW = -62, XPE = 62, XL = -30, XU = 30, XS = [-15, 2, 19], CARL = 15, CARW = 11.6;
  var YX = -P / 2;                                       // la proa mira hacia +X (la línea va de oeste a este)
  var glassT = new THREE.MeshStandardMaterial({ color: 0x8fd3ff, metalness: 0.2, roughness: 0.08, transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false });
  var paintM = new THREE.MeshBasicMaterial({ color: ACC, transparent: true, opacity: 0.3, side: THREE.DoubleSide, depthWrite: false });
  var scanM = new THREE.MeshBasicMaterial({ color: 0x35ff9a, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending });
  var domeMat = new THREE.MeshBasicMaterial({ color: 0x39c5ff, transparent: true, opacity: 0.0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  function setAccentAll(h) { setAccent(h); paintM.color.setHex(h); }

  /* ---------- Losa, calles de acceso y plataformas ---------- */
  add(group, roundedBox(2 * (XPE + 14), SLAB, 74, 0.1, 2), mats.slab, 0, SLAB / 2, 0);
  add(group, new THREE.BoxGeometry(2 * (XPE + 12.4), 0.03, 71, 1, 1, 1), mats.apron, 0, y0 + 0.015, 0);
  var rdY = [], rdW = [];
  [[XPW + 11.8, -HX], [HX, XPE - 11.8]].forEach(function (r) {
    var len = r[1] - r[0], cx = (r[0] + r[1]) / 2;
    add(group, new THREE.BoxGeometry(len, 0.12, 11), mats.asph, cx, y0, 0);
    for (k = 0; k < 8; k++) rdY.push({ x: r[0] + 1.2 + k * (len - 2.4) / 7, y: y0 + 0.085, z: 0, sx: 1.6, sy: 0.02, sz: 0.16 });
    [-5.3, 5.3].forEach(function (zz) { rdW.push({ x: cx, y: y0 + 0.085, z: zz, sx: len, sy: 0.02, sz: 0.14 }); });
  });
  group.add(boxField(UB, mats.mkY, rdY)); group.add(boxField(UB, mats.mkW, rdW));
  var padLW = [], padLB = [], padLG = [], padLR = [], strobes = [], pads = [];
  function buildPad(px, pi) {
    var pg = new THREE.Group(); pg.position.set(px, 0, 0); group.add(pg);
    add(pg, new THREE.CylinderGeometry(PADR + 2.2, PADR + 2.8, SLAB, 64), mats.slab, 0, SLAB / 2, 0);
    add(pg, new THREE.CylinderGeometry(PADR + 2.0, PADR + 2.0, 0.045, 64), mats.apron, 0, y0 + 0.0225, 0);
    add(pg, new THREE.CylinderGeometry(PADR + 0.55, PADR + 0.55, 0.075, 64), mats.concD, 0, y0 + 0.0375, 0);
    add(pg, new THREE.CylinderGeometry(PADR, PADR, 0.10, 64), mats.asph, 0, y0 + 0.05, 0);
    add(pg, new THREE.RingGeometry(PADR - 0.72, PADR - 0.45, 64).rotateX(-P / 2), mats.mkY, 0, y0 + 0.116, 0);
    add(pg, new THREE.RingGeometry(PADR - 1.55, PADR - 1.45, 64).rotateX(-P / 2), mats.mkW, 0, y0 + 0.116, 0);
    var mw2 = [], my2 = []; for (k = 0; k < 48; k++) { pa = k * TAU / 48; (k % 2 ? my2 : mw2).push({ x: Math.cos(pa) * (PADR - 0.12), y: y0 + 0.12, z: Math.sin(pa) * (PADR - 0.12), ry: -pa, sx: 0.26, sy: 0.02, sz: 1.0 }); }
    pg.add(boxField(UB, mats.mkY, my2)); pg.add(boxField(UB, mats.hazK, mw2));
    var tt = new THREE.Group(); tt.position.set(0, y0 + 0.09, 0); pg.add(tt);
    add(tt, new THREE.CylinderGeometry(6.8, 6.8, 0.05, 48), mats.hwD, 0, 0, 0);
    add(tt, new THREE.RingGeometry(6.5, 6.8, 48).rotateX(-P / 2), mats.accent, 0, 0.03, 0);
    var tw8 = []; for (k = 0; k < 8; k++) tw8.push({ x: 0, y: 0.03, z: 0, ry: k * TAU / 16, sx: 13.0, sy: 0.02, sz: 0.07 });
    tt.add(boxField(UB, mats.trim, tw8));
    box(tt, 0.16, 0.03, 13.0, mats.mkY, 0, 0.035, 0, 0.005); box(tt, 13.0, 0.03, 0.16, mats.mkY, 0, 0.035, 0, 0.005);
    add(tt, new THREE.RingGeometry(1.5, 1.72, 40).rotateX(-P / 2), mats.mkW, 0, 0.06, 0); cylP(tt, 0.5, 0.5, 0.05, 16, mats.accent, 0, 0.05, 0);
    // flechas hacia la nave-taller y barras de identificación (1 = entrada, 2 = salida)
    for (k = 0; k < 3; k++) [-0.6, 0.6].forEach(function (s2) { add(pg, new THREE.BoxGeometry(1.4, 0.02, 0.18), mats.mkW, 7.6 + k * 1.1, y0 + 0.12, s2 * 0.5).rotation.y = (s2 > 0 ? -0.6 : 0.6); });
    for (k = 0; k <= pi; k++) add(pg, new THREE.BoxGeometry(0.4, 0.02, 1.6), mats.mkY, -8.6, y0 + 0.12, (k - pi / 2) * 0.9);
    var lw = [], lgg = [], lrr = [], lbL = [[], [], [], []];
    for (k = 0; k < 36; k++) { pa = k * TAU / 36; lw.push({ x: Math.cos(pa) * (PADR + 0.32), y: y0 + 0.1, z: Math.sin(pa) * (PADR + 0.32), sx: 0.22, sy: 0.12, sz: 0.22 }); }
    for (k = 0; k < 24; k++) { pa = k * TAU / 24; lgg.push({ x: Math.cos(pa) * 6.98, y: y0 + 0.125, z: Math.sin(pa) * 6.98, sx: 0.2, sy: 0.08, sz: 0.2 }); }
    for (k = 0; k < 4; k++) { pa = k * P / 2; lrr.push({ x: Math.cos(pa) * (PADR + 0.7), y: y0 + 0.1, z: Math.sin(pa) * (PADR + 0.7), sx: 0.26, sy: 0.14, sz: 0.26 }); }
    for (k = 0; k < 48; k++) { pa = k * TAU / 48; lbL[k % 4].push({ x: Math.cos(pa) * (PADR + 1.45), y: y0 + 0.1, z: Math.sin(pa) * (PADR + 1.45), ry: -pa, sx: 0.8, sy: 0.08, sz: 0.2 }); }
    var m1 = boxField(UB, mats.lW, lw), m2 = boxField(UB, mats.lG, lgg), m3 = boxField(UB, mats.lR, lrr); pg.add(m1); pg.add(m2); pg.add(m3);
    padLW.push(m1); padLG.push(m2); padLR.push(m3);
    var chs = []; lbL.forEach(function (l) { var m4 = boxField(UB, mats.lB, l); pg.add(m4); chs.push(m4); }); padLB.push(chs);
    var sg = []; for (k = 0; k < 36; k++) { pa = k * TAU / 36; sg.push(add(pg, new THREE.SphereGeometry(0.16, 8, 6), mats.lA, Math.cos(pa) * (PADR - 1.0), y0 + 0.2, Math.sin(pa) * (PADR - 1.0))); }
    strobes.push(sg);
    [P / 2 + 0.9, -P / 2 - 0.9].forEach(function (fa) {                    // mástiles de focos junto a la plataforma
      var px2 = Math.cos(fa) * (PADR + 3.6), pz2 = Math.sin(fa) * (PADR + 3.6), ny = Math.atan2(-Math.cos(fa), -Math.sin(fa));
      cylP(pg, 0.14, 0.24, 10, 8, mats.hull2, px2, y0 + 5.0, pz2); cylP(pg, 0.5, 0.6, 0.35, 8, mats.concD, px2, y0 + 0.17, pz2);
      box(pg, 1.8, 0.2, 0.5, mats.trim, px2, y0 + 10.1, pz2, 0.02).rotation.y = ny;
      var fl = []; for (k = 0; k < 6; k++) fl.push({ x: px2 + Math.sin(ny) * 0.28 + Math.cos(ny) * (-0.7 + (k % 3) * 0.7), y: y0 + 10.0 + Math.floor(k / 3) * 0.3 - 0.1, z: pz2 + Math.cos(ny) * 0.28 - Math.sin(ny) * (-0.7 + (k % 3) * 0.7), ry: ny, sx: 0.55, sy: 0.22, sz: 0.1 });
      pg.add(boxField(UB, mats.lW, fl));
    });
    var pd = { i: pi, x: px, z: 0, r: PADR, pg: pg, tt: tt, rec: null }; pads.push(pd); return pd;
  }
  var padW = buildPad(XPW, 0), padE = buildPad(XPE, 1);

  /* ---------- La nave-taller: muros de cristal, techo en diente de sierra, portones, rieles y carro transportador ---------- */
  function makeDoor(parent, x, z, w, h, topY, mat, slats) {
    var dg = new THREE.Group(); dg.position.set(x, topY - h, z); parent.add(dg);
    box(dg, w, h, 0.18, mat, 0, h / 2, 0, 0.02);
    for (var s2 = 1; s2 < slats; s2++) box(dg, w - 0.1, 0.04, 0.22, mats.trim, 0, h * s2 / slats, 0, 0.005);
    box(dg, w, 0.22, 0.24, mats.hazY, 0, 0.11, 0, 0.01); for (var s3 = 0; s3 < Math.floor(w / 0.6); s3++) box(dg, 0.3, 0.22, 0.25, mats.hazK, -w / 2 + 0.3 + s3 * 0.6, 0.11, 0, 0.005);
    add(dg, new THREE.BoxGeometry(w * 0.7, 0.35, 0.22), mats.strip, 0, h * 0.82, 0);
    return { g: dg, H: h, top: topY, o: 0, t: 0, holds: 0, idleT: 9 };
  }
  box(group, 2 * HX - 0.4, 0.06, 2 * HZ - 0.4, mats.floorH, 0, y0 + 0.07, 0, 0.01);
  var hz1 = [], hz2 = [];
  for (k = 0; k < 40; k++) { var hx1 = -HX + 1.2 + k * (2 * HX - 2.4) / 39; (k % 2 ? hz1 : hz2).push({ x: hx1, y: y0 + 0.11, z: HZ - 0.9, sx: 0.8, sy: 0.02, sz: 0.5 }); (k % 2 ? hz1 : hz2).push({ x: hx1, y: y0 + 0.11, z: -HZ + 0.9, sx: 0.8, sy: 0.02, sz: 0.5 }); }
  group.add(boxField(UB, mats.hazY, hz1)); group.add(boxField(UB, mats.hazK, hz2));
  // columnas, vigas y paños de cristal (se ve todo lo que pasa dentro)
  var colX = []; for (k = 0; k <= 10; k++) colX.push(-HX + 0.5 + k * (2 * HX - 1) / 10);
  [-1, 1].forEach(function (s) {
    colX.forEach(function (cx0) { box(group, 0.9, WALLH, 0.9, mats.hwD, cx0, y0 + WALLH / 2, s * HZ, 0.04); box(group, 1.4, 0.4, 1.4, mats.concD, cx0, y0 + 0.2, s * HZ, 0.03); box(group, 0.2, WALLH - 2, 0.12, mats.accent, cx0, y0 + WALLH / 2 + 0.4, s * (HZ - 0.55), 0.01); });
    box(group, 2 * HX, 1.0, 0.5, mats.hw, 0, y0 + 0.5, s * HZ, 0.03); box(group, 2 * HX, 0.5, 0.7, mats.hull2, 0, y0 + WALLH + 0.2, s * HZ, 0.03); box(group, 2 * HX, 0.25, 0.8, mats.accent, 0, y0 + WALLH - 0.1, s * HZ, 0.02);
    box(group, 2 * HX, 0.25, 0.3, mats.hwD, 0, y0 + 5.4, s * HZ, 0.02);
    add(group, new THREE.BoxGeometry(2 * HX, WALLH - 1.4, 0.06), glassT, 0, y0 + 1.0 + (WALLH - 1.4) / 2, s * HZ);
    for (k = 0; k < 4; k++) add(group, new THREE.BoxGeometry(2 * HX, 0.05, 0.12), mats.trim, 0, y0 + 2.6 + k * 2.3, s * HZ);
  });
  // testeros con portones enrollables (oeste = entrada, este = salida)
  var shopDoors = [];
  [-1, 1].forEach(function (s) {
    var wl = (HZ - 7) / 2;
    [-1, 1].forEach(function (t) { box(group, 0.7, WALLH, HZ - 7, mats.hw, s * HX, y0 + WALLH / 2, t * (7 + wl), 0.03); });
    box(group, 0.7, WALLH - 8.4, 14, mats.hw, s * HX, y0 + 8.4 + (WALLH - 8.4) / 2, 0, 0.03);
    [-1, 1].forEach(function (t) { box(group, 1.1, 8.6, 1.1, mats.hwD, s * HX, y0 + 4.3, t * 7.1, 0.04); box(group, 0.3, 7.5, 0.3, mats.accent, s * (HX + (s > 0 ? 0.55 : -0.55)), y0 + 4.2, t * 7.1, 0.01); });
    box(group, 1.1, 0.9, 14.8, mats.hwD, s * HX, y0 + 8.65, 0, 0.03); box(group, 1.2, 0.25, 14.8, mats.accent, s * (HX + (s > 0 ? 0.1 : -0.1)), y0 + 9.2, 0, 0.02);
    var dgp = new THREE.Group(); dgp.position.set(s * HX, y0, 0); dgp.rotation.y = P / 2; group.add(dgp);
    var dr = makeDoor(dgp, 0, 0, 13.4, 8.2, 8.3, mats.hw, 10); shopDoors.push(dr);
    box(group, 0.3, 1.0, 4.0, mats.dark, s * (HX + (s > 0 ? 0.6 : -0.6)), y0 + 10.3, 0, 0.02);
    for (k = 0; k < (s > 0 ? 2 : 1); k++) box(group, 0.12, 0.5, 0.4, mats.lA, s * (HX + (s > 0 ? 0.78 : -0.78)), y0 + 10.3, -0.3 * (s > 0 ? 1 : 0) + k * 0.6, 0.005);
    [-5.2, 5.2].forEach(function (zz) { box(group, 0.7, 0.25, 0.3, mats.dark, s * (HX + (s > 0 ? 0.6 : -0.6)), y0 + 9.4, zz, 0.02); });
  });
  // techo en dientes de sierra con lucernarios y vigas
  var TN = 7, TW = 2 * HX / TN, TH = 3.2, tilt = Math.atan2(TH, TW * 0.82), tl = Math.sqrt(TW * 0.82 * TW * 0.82 + TH * TH);
  for (k = 0; k < TN; k++) {
    var tx0 = -HX + k * TW, tx1 = tx0 + TW * 0.82;
    add(group, new THREE.BoxGeometry(tl, 0.22, 2 * HZ + 0.8), mats.hw, (tx0 + tx1) / 2, y0 + WALLH + TH / 2 + 0.1, 0).rotation.z = tilt;
    add(group, new THREE.BoxGeometry(0.06, TH, 2 * HZ), glassT, tx1, y0 + WALLH + TH / 2, 0);
    box(group, 0.12, 0.3, 2 * HZ + 0.8, mats.hwD, tx1, y0 + WALLH + TH + 0.1, 0, 0.01); box(group, 0.14, 0.14, 2 * HZ, mats.accent, tx1 + 0.04, y0 + WALLH + TH * 0.55, 0, 0.005);
    add(group, new THREE.BoxGeometry(0.05, TH * 0.9, 2 * HZ - 1), mats.window, tx1 - 0.18, y0 + WALLH + TH / 2, 0);
    [-1, 1].forEach(function (s) { box(group, TW, TH * 0.5, 0.2, mats.hw, tx0 + TW / 2, y0 + WALLH + TH * 0.25, s * (HZ + 0.2), 0.02); });
    for (j = 0; j < 4; j++) { var rbx = tx0 + 1.2 + j * (TW * 0.8 - 1.4) / 3, rbh = TH * (rbx - tx0) / (TW * 0.82); box(group, 0.14, 0.14, 2 * HZ, mats.hwD, rbx, y0 + WALLH + rbh + 0.02, 0, 0.01); }
  }
  // cerchas interiores
  colX.forEach(function (cx0, ci) { if (ci % 2) return; box(group, 0.3, 0.5, 2 * HZ, mats.hull2, cx0, y0 + WALLH - 0.35, 0, 0.02); strutIn(group, [cx0, y0 + WALLH - 0.3, -HZ], [cx0, y0 + WALLH - 2.2, -HZ / 2], 0.05, mats.trim); strutIn(group, [cx0, y0 + WALLH - 0.3, HZ], [cx0, y0 + WALLH - 2.2, HZ / 2], 0.05, mats.trim); strutIn(group, [cx0, y0 + WALLH - 2.2, -HZ / 2], [cx0, y0 + WALLH - 2.2, HZ / 2], 0.04, mats.trim); });
  // chimeneas, extractores y paneles en el techo
  [[-22, -9], [-6, -10], [11, -9], [26, -10]].forEach(function (cp, ci) { cylP(group, 0.7, 0.9, 9 + ci % 2 * 2, 12, mats.hull2, cp[0], y0 + WALLH + TH + 4.5, cp[1]); cylP(group, 0.95, 0.95, 0.25, 12, mats.accent, cp[0], y0 + WALLH + TH + 9.2 + ci % 2 * 2, cp[1]); add(group, new THREE.SphereGeometry(0.16, 8, 6), mats.lR, cp[0], y0 + WALLH + TH + 9.7 + ci % 2 * 2, cp[1]); cylP(group, 1.1, 1.1, 0.5, 12, mats.hwD, cp[0], y0 + WALLH + TH + 0.2, cp[1]); });
  for (k = 0; k < 6; k++) { cylP(group, 0.55, 0.55, 0.5, 12, mats.hull2, -32 + k * 12, y0 + WALLH + 1.0, 9); cylP(group, 0.7, 0.7, 0.08, 12, mats.trim, -32 + k * 12, y0 + WALLH + 1.28, 9); }
  // luces del techo
  var hl = []; for (k = 0; k < 20; k++) [-9, -3, 3, 9].forEach(function (zz) { hl.push({ x: -HX + 2.4 + k * 3.8, y: y0 + WALLH - 0.75, z: zz, sx: 1.8, sy: 0.08, sz: 0.4 }); });
  var hallLM = boxField(UB, mats.lW, hl); group.add(hallLM);

  /* ---------- Vía de rieles y carro transportador (lleva la nave de estación en estación) ---------- */
  box(group, 2 * XU + 6, 0.12, 0.5, mats.hwD, 0, y0 + 0.12, 5.0, 0.01); box(group, 2 * XU + 6, 0.12, 0.5, mats.hwD, 0, y0 + 0.12, -5.0, 0.01);
  box(group, 2 * XU + 6, 0.08, 0.2, mats.accent, 0, y0 + 0.2, 5.0, 0.005); box(group, 2 * XU + 6, 0.08, 0.2, mats.accent, 0, y0 + 0.2, -5.0, 0.005);
  var sl = []; for (k = 0; k < 44; k++) sl.push({ x: -XU - 2.5 + k * (2 * XU + 5) / 43, y: y0 + 0.1, z: 0, sx: 0.5, sy: 0.08, sz: 12.4 });
  group.add(boxField(UB, mats.concD, sl));
  var car = new THREE.Group(); car.position.set(XL, FL, 0); group.add(car);
  var carState = { x: XL, busy: false, occ: null };
  box(car, CARL, 0.22, CARW, mats.hull2, 0, DECK - 0.11, 0, 0.04); box(car, CARL - 0.4, 0.06, CARW - 0.4, mats.floorH, 0, DECK - 0.01, 0, 0.01);
  [-1, 1].forEach(function (sx) { box(car, 0.5, 0.26, CARW + 0.1, mats.hazY, sx * (CARL / 2 - 0.25), DECK - 0.08, 0, 0.01); [-1, 1].forEach(function (sz) { var wb = cylP(car, 0.34, 0.34, 0.5, 12, mats.rubber, sx * 5.4, 0.1, sz * 5.0); wb.rotation.z = P / 2; cylP(wb, 0.16, 0.16, 0.56, 8, mats.hull2, 0, 0, 0); box(car, 1.8, 0.35, 0.6, mats.hwD, sx * 5.4, 0.12, sz * 5.0, 0.03); }); });
  [-1, 1].forEach(function (sz) { box(car, CARL, 0.16, 0.3, mats.hazK, 0, DECK - 0.06, sz * (CARW / 2 - 0.15), 0.01); box(car, CARL - 1, 0.04, 0.12, mats.mkY, 0, DECK + 0.01, sz * (CARW / 2 - 0.6), 0.005); });
  [[-3.6, -3.0], [-3.6, 3.0], [3.6, -3.0], [3.6, 3.0]].forEach(function (cc) { box(car, 1.4, 0.3, 0.5, mats.trim, cc[0], DECK + 0.1, cc[1], 0.02); add(car, new THREE.SphereGeometry(0.07, 6, 6), mats.lG, cc[0], DECK + 0.3, cc[1]); });
  add(car, new THREE.RingGeometry(1.2, 1.35, 32).rotateX(-P / 2), mats.accent, 0, DECK + 0.02, 0);
  for (k = 0; k < 3; k++) [-0.7, 0.7].forEach(function (s2) { add(car, new THREE.BoxGeometry(1.0, 0.02, 0.16), mats.mkW, CARL / 2 - 1.8 - k * 0.9, DECK + 0.02, s2 * 0.45).rotation.y = (s2 > 0 ? -0.6 : 0.6); });
  var carBeacon = add(car, new THREE.SphereGeometry(0.16, 8, 6), mats.lA, CARL / 2 - 0.6, DECK + 0.5, -CARW / 2 + 0.6); strutIn(car, [CARL / 2 - 0.6, DECK, -CARW / 2 + 0.6], [CARL / 2 - 0.6, DECK + 0.45, -CARW / 2 + 0.6], 0.03, mats.trim);
  function deckY(x, z) { var dx = CARL / 2 - Math.abs(x - carState.x), dz = CARW / 2 - Math.abs(z), d = Math.min(dx, dz); return FL + DECK * clamp(d / 0.8, 0, 1); }

  /* ---------- Las tres estaciones: diagnóstico (escáner), reparación estructural (grúa + brazos + soldadura) y pintura y pruebas ---------- */
  var arms = [], sparks = [], stLamps = [], stage = { cur: -1, k: [0, 0, 0] };
  function stationFloor(sx, idx) {
    box(group, 15.4, 0.02, 0.18, mats.mkY, sx, y0 + 0.11, 6.4, 0.005); box(group, 15.4, 0.02, 0.18, mats.mkY, sx, y0 + 0.11, -6.4, 0.005);
    [-7.7, 7.7].forEach(function (dx) { box(group, 0.18, 0.02, 12.8, mats.mkY, sx + dx, y0 + 0.11, 0, 0.005); });
    for (k = 0; k < 8; k++) { box(group, 0.7, 0.025, 0.5, k % 2 ? mats.hazK : mats.hazY, sx - 7.0 + k * 2.0, y0 + 0.12, 6.9, 0.005); box(group, 0.7, 0.025, 0.5, k % 2 ? mats.hazK : mats.hazY, sx - 7.0 + k * 2.0, y0 + 0.12, -6.9, 0.005); }
    // cartel colgante con número y semáforo de estado
    [-1, 1].forEach(function (s2) { strutIn(group, [sx + s2 * 3.5, y0 + WALLH - 0.4, -11.4], [sx + s2 * 3.5, y0 + 8.1, -11.4], 0.03, mats.trim); });
    box(group, 8.6, 1.2, 0.2, mats.dark, sx, y0 + 7.6, -11.4, 0.03); box(group, 8.6, 0.16, 0.24, mats.accent, sx, y0 + 8.25, -11.4, 0.01);
    for (k = 0; k <= idx; k++) box(group, 0.7, 0.7, 0.06, mats.lA, sx - 0.9 * idx + k * 1.8 - 0.0, y0 + 7.6, -11.28, 0.01);
    var lr = add(group, new THREE.SphereGeometry(0.2, 8, 6), mats.lR, sx + 3.2, y0 + 6.6, -11.3), la = add(group, new THREE.SphereGeometry(0.2, 8, 6), mats.lA, sx + 3.2, y0 + 6.2, -11.3), lg = add(group, new THREE.SphereGeometry(0.2, 8, 6), mats.lG, sx + 3.2, y0 + 5.8, -11.3);
    box(group, 0.5, 1.5, 0.3, mats.dark, sx + 3.2, y0 + 6.2, -11.4, 0.02);
    stLamps.push({ r: lr, a: la, g: lg });
  }
  XS.forEach(function (sx, idx) { stationFloor(sx, idx); });
  function archFrame(g, w, h, colMat) {                // pórtico de estación: dos postes y una viga con lámparas
    [-1, 1].forEach(function (s2) { box(g, 0.7, h, 0.9, colMat, 0, h / 2, s2 * w / 2, 0.04); box(g, 1.1, 0.35, 1.3, mats.concD, 0, 0.17, s2 * w / 2, 0.03); box(g, 0.2, h - 1, 0.2, mats.accent, 0.38, h / 2, s2 * w / 2, 0.01); });
    box(g, 1.1, 0.9, w + 0.9, colMat, 0, h + 0.05, 0, 0.04); box(g, 0.2, 0.2, w, mats.accent, 0.56, h + 0.25, 0, 0.01);
  }
  // S1 · diagnóstico: arco escáner que recorre la nave, plano verde y consolas
  var scan = new THREE.Group(); scan.position.set(XS[0], FL, 0); group.add(scan);
  archFrame(scan, 12.8, 6.4, mats.hull2);
  [-1, 1].forEach(function (s2) { for (k = 0; k < 5; k++) add(scan, new THREE.SphereGeometry(0.12, 8, 6), mats.lG, 0.42, 1.0 + k * 1.1, s2 * 6.4); });
  for (k = 0; k < 7; k++) add(scan, new THREE.SphereGeometry(0.14, 8, 6), mats.lB, 0.55, 6.5, -5.4 + k * 1.8);
  var scanBeam = add(scan, new THREE.BoxGeometry(0.1, 6.2, 12.4), scanM, 0, 3.2, 0); scanBeam.visible = false;
  var scanLine = add(scan, new THREE.BoxGeometry(0.16, 0.12, 12.4), mats.lG, 0, 6.0, 0);
  for (k = 0; k < 4; k++) { var cs2 = box(group, 1.4, 1.5, 0.9, mats.dark, XS[0] - 5.4 + k * 2.4, FL + 0.8, -11.6, 0.04); add(group, new THREE.BoxGeometry(1.1, 0.7, 0.04), mats.cab, XS[0] - 5.4 + k * 2.4, FL + 1.05, -11.12); add(group, new THREE.BoxGeometry(1.1, 0.06, 0.5), mats.lG, XS[0] - 5.4 + k * 2.4, FL + 1.58, -11.3); }
  cylP(group, 0.3, 0.45, 5.5, 8, mats.hull2, XS[0] + 3.5, FL + 2.7, 11.6); var cam1 = box(group, 1.0, 0.5, 0.5, mats.panel, XS[0] + 3.5, FL + 5.6, 11.1, 0.05); add(group, new THREE.SphereGeometry(0.22, 8, 6), mats.cab, XS[0] + 3.5, FL + 5.6, 10.8);
  // S2 · reparación estructural: 4 brazos robóticos, plataformas de trabajo, estanterías de repuestos, chispas
  [[-3.0, -7.4, 1], [3.0, -7.4, 1], [-3.0, 7.4, -1], [3.0, 7.4, -1]].forEach(function (ap, an) {
    var ag = new THREE.Group(); ag.position.set(XS[1] + ap[0], FL, ap[1]); group.add(ag);
    cylP(ag, 0.6, 0.7, 0.4, 14, mats.hull2, 0, 0.2, 0); cylP(ag, 0.45, 0.45, 0.12, 14, mats.accent, 0, 0.45, 0);
    var yaw = new THREE.Group(); yaw.position.set(0, 0.5, 0); yaw.rotation.y = ap[2] > 0 ? -P / 2 : P / 2; ag.add(yaw);
    cylP(yaw, 0.28, 0.28, 0.8, 10, mats.panel, 0, 0.35, 0);
    var sh = new THREE.Group(); sh.position.set(0, 0.8, 0); yaw.add(sh); add(sh, new THREE.SphereGeometry(0.3, 10, 8), mats.trim, 0, 0, 0);
    box(sh, 0.38, 2.4, 0.38, mats.cartY, 0, 1.2, 0, 0.05);
    var el = new THREE.Group(); el.position.set(0, 2.4, 0); sh.add(el); add(el, new THREE.SphereGeometry(0.25, 10, 8), mats.trim, 0, 0, 0);
    box(el, 0.3, 2.0, 0.3, mats.panel, 0, 1.0, 0, 0.04); var tip = add(el, new THREE.SphereGeometry(0.16, 8, 6), mats.weld, 0, 2.0, 0); box(el, 0.12, 0.4, 0.12, mats.dark, 0, 1.85, 0, 0.01);
    arms.push({ yaw: yaw, sh: sh, el: el, ph: an * 1.3, base: yaw.rotation.y, tip: tip });
  });
  for (k = 0; k < 14; k++) { var spk = add(group, new THREE.SphereGeometry(0.06, 5, 4), mats.spark, XS[1], FL + 2, 0); spk.visible = false; sparks.push({ m: spk, ph: k * 0.7 }); }
  [-1, 1].forEach(function (s2) { for (k = 0; k < 3; k++) { box(group, 3.0, 2.2, 0.9, mats.hwD, XS[1] + (k - 1) * 4.2, FL + 1.1, s2 * 12.1, 0.03); add(group, new THREE.BoxGeometry(2.4, 0.5, 0.04), mats.cab, XS[1] + (k - 1) * 4.2, FL + 1.6, s2 * 12.1 - s2 * 0.48); } });
  for (k = 0; k < 5; k++) { box(group, 2.6, 0.12, 1.0, mats.hull2, XS[1] - 6 + k * 3.0, FL + 1.3, 11.8, 0.02); box(group, 2.4, 0.9, 0.8, [mats.cargoA, mats.cargoB, mats.cargoC, mats.cargoD][k % 4], XS[1] - 6 + k * 3.0, FL + 1.85, 11.8, 0.04); box(group, 2.6, 0.12, 1.0, mats.hull2, XS[1] - 6 + k * 3.0, FL + 2.6, 11.8, 0.02); cylP(group, 0.35, 0.35, 0.8, 10, mats.blue, XS[1] - 6.2 + k * 3.0, FL + 3.05, 11.8); [-1.2, 1.2].forEach(function (ox) { box(group, 0.12, 3.4, 0.9, mats.trim, XS[1] - 6 + k * 3.0 + ox, FL + 1.7, 11.8, 0.01); }); }
  // S3 · pintura y pruebas: arco de boquillas con cortina de pintura, lámparas de secado y conductos
  var paint = new THREE.Group(); paint.position.set(XS[2], FL, 0); group.add(paint);
  archFrame(paint, 12.8, 6.4, mats.hull2);
  var nozz = [], cones = [];
  for (k = 0; k < 8; k++) { var nz = -5.25 + k * 1.5; cylP(paint, 0.12, 0.2, 0.5, 8, mats.dark, 0.0, 6.0, nz); var cn = add(paint, new THREE.CylinderGeometry(0.05, 0.9, 3.8, 10, 1, true), paintM, 0, 4.0, nz); cn.visible = false; cones.push(cn); }
  [-1, 1].forEach(function (s2) { for (k = 0; k < 3; k++) { cylP(paint, 0.1, 0.16, 0.5, 8, mats.dark, 0.0, 1.2 + k * 1.3, s2 * 6.0); var sc = add(paint, new THREE.CylinderGeometry(0.05, 0.7, 2.6, 10, 1, true), paintM, 0, 1.2 + k * 1.3, s2 * 4.7); sc.rotation.x = s2 * P / 2; sc.visible = false; cones.push(sc); } });
  var dryL = []; for (k = 0; k < 6; k++) [-4.5, 0, 4.5].forEach(function (zz) { dryL.push({ x: XS[2] - 6 + k * 2.4, y: y0 + WALLH - 1.0, z: zz, sx: 1.6, sy: 0.12, sz: 0.5 }); });
  var dryM = boxField(UB, mats.lA, dryL); group.add(dryM);
  cylP(group, 0.9, 0.9, 40, 12, mats.pipe, XS[2] + 2, y0 + WALLH - 2.2, 10.4).rotation.z = P / 2; cylP(group, 0.9, 0.9, 40, 12, mats.pipe, XS[2] + 2, y0 + WALLH - 2.2, -10.4).rotation.z = P / 2;
  for (k = 0; k < 5; k++) { box(group, 0.4, 0.4, 1.0, mats.trim, XS[2] - 14 + k * 9, y0 + WALLH - 2.2, 10.4, 0.02); }
  [-1, 1].forEach(function (s2) { for (k = 0; k < 3; k++) { cylP(group, 0.55, 0.55, 2.4, 10, mats.cargoD, XS[2] - 4 + k * 4, FL + 1.2, s2 * 11.6); box(group, 0.6, 0.12, 0.6, mats.trim, XS[2] - 4 + k * 4, FL + 2.45, s2 * 11.6, 0.01); } });
  // grúa pórtico enorme que recorre toda la nave sobre rieles de pared a pared
  var CR_Y = y0 + WALLH - 1.8;
  [-1, 1].forEach(function (s2) { box(group, 2 * HX - 3, 0.5, 0.6, mats.hull2, 0, CR_Y - 0.6, s2 * (HZ - 0.7), 0.02); box(group, 2 * HX - 3, 0.12, 0.3, mats.accent, 0, CR_Y - 0.28, s2 * (HZ - 0.7), 0.005); });
  var crane = new THREE.Group(); crane.position.set(XS[1], CR_Y, 0); group.add(crane);
  box(crane, 1.3, 0.8, 2 * HZ - 0.8, mats.cargoD, 0, 0, 0, 0.04); box(crane, 1.4, 0.14, 2 * HZ - 0.6, mats.hazK, 0, 0.5, 0, 0.01);
  [-1, 1].forEach(function (s2) { box(crane, 2.2, 0.7, 1.4, mats.hwD, 0, -0.2, s2 * (HZ - 0.7), 0.03); add(crane, new THREE.SphereGeometry(0.1, 6, 6), mats.lA, 0, 0.5, s2 * (HZ - 0.7)); });
  var cTr = new THREE.Group(); cTr.position.set(0, -0.7, 0); crane.add(cTr); box(cTr, 1.5, 0.7, 1.8, mats.cargoD, 0, 0, 0, 0.05); add(cTr, new THREE.SphereGeometry(0.08, 6, 6), mats.lR, 0, 0.45, 0.9);
  var cCable = new THREE.Mesh(_cg[0.03] || (_cg[0.03] = new THREE.CylinderGeometry(0.03, 0.03, 1, 8)), mats.trim); cTr.add(cCable); var cHook = box(cTr, 0.5, 0.5, 0.5, mats.hazY, 0, -3, 0, 0.05);
  // barra de progreso a lo largo de la pared sur (10 tramos) y alarma
  var progLit = [], progDim = [];
  for (k = 0; k < 10; k++) { var px3 = -17 + k * 3.8; progDim.push(box(group, 3.3, 0.5, 0.06, mats.dim, px3, y0 + 9.2, HZ - 0.62, 0.01)); progLit.push(box(group, 3.3, 0.5, 0.1, k < 7 ? mats.lG : mats.lA, px3, y0 + 9.2, HZ - 0.66, 0.01)); }
  box(group, 38.4, 0.8, 0.12, mats.dark, 0, y0 + 9.2, HZ - 0.52, 0.02);

  /* ---------- Exterior: torre, oficina, depósito, contenedores, campo solar, patio de piezas y farolas ---------- */
  /* ---------- Torre de control (nivel pequeño: cabina octogonal, radar y baliza) ---------- */
  var tw = new THREE.Group(); tw.position.set(-52, y0, 24); tw.rotation.y = 0; group.add(tw);
  box(tw, 6.2, 0.6, 6.2, mats.concD, 0, 0.3, 0, 0.04);
  box(tw, 3.6, 10, 3.6, mats.panel, 0, 5.6, 0, 0.08); box(tw, 3.7, 0.3, 3.7, mats.accent, 0, 10.4, 0, 0.02);
  var tsl = [], tfl = [];
  [3.0, 5.4, 7.8].forEach(function (yy) { [[0, 1.81, 2.6, 0.04], [0, -1.81, 2.6, 0.04], [1.81, 0, 0.04, 2.6], [-1.81, 0, 0.04, 2.6]].forEach(function (w) { add(tw, new THREE.BoxGeometry(w[2], 0.5, w[3]), mats.strip, w[0], yy, w[1]); }); });
  for (k = 0; k < 5; k++) tfl.push({ x: -1.6 + k * 0.8, y: 4.0, z: 1.83, sx: 0.06, sy: 5.8, sz: 0.04 });
  tw.add(boxField(UB, mats.concD, tfl));
  box(tw, 1.4, 2.2, 0.15, mats.accent, 0, 1.7, 1.85, 0.02); box(tw, 1.1, 2.0, 0.08, mats.dark, 0, 1.65, 1.92, 0.02); box(tw, 2.2, 0.12, 0.9, mats.conc, 0, 2.9, 2.2, 0.02);
  box(tw, 5.8, 0.4, 5.8, mats.conc, 0, 10.8, 0, 0.03);
  var cabG = new THREE.CylinderGeometry(3.5, 2.7, 2.4, 8, 1, true); add(tw, cabG, mats.cab, 0, 12.2, 0);
  for (k = 0; k < 8; k++) { var ca = k * TAU / 8; strutIn(tw, [Math.sin(ca) * 2.7, 11.0, Math.cos(ca) * 2.7], [Math.sin(ca) * 3.5, 13.4, Math.cos(ca) * 3.5], 0.07, mats.panel); }
  add(tw, new THREE.TorusGeometry(2.9, 0.07, 6, 8).rotateX(P / 2), mats.panel, 0, 11.6, 0).rotation.y = P / 8; add(tw, new THREE.TorusGeometry(3.3, 0.07, 6, 8).rotateX(P / 2), mats.panel, 0, 12.8, 0).rotation.y = P / 8;
  cylP(tw, 3.9, 3.9, 0.15, 8, mats.conc, 0, 10.95, 0); cylP(tw, 3.75, 3.75, 0.35, 8, mats.hwD, 0, 13.55, 0); cylP(tw, 3.9, 3.9, 0.12, 8, mats.accent, 0, 13.35, 0);
  add(tw, new THREE.TorusGeometry(3.85, 0.04, 6, 8).rotateX(P / 2), mats.accent, 0, 11.95, 0).rotation.y = P / 8; add(tw, new THREE.TorusGeometry(3.85, 0.03, 6, 8).rotateX(P / 2), mats.accent, 0, 11.5, 0).rotation.y = P / 8;
  for (k = 0; k < 16; k++) { var pa = k / 16 * TAU; strutIn(tw, [Math.sin(pa) * 3.88, 11.0, Math.cos(pa) * 3.88], [Math.sin(pa) * 3.88, 11.95, Math.cos(pa) * 3.88], 0.02, mats.accent); }
  // consolas y pantallas visibles desde fuera
  for (k = 0; k < 6; k++) { var da = (k - 2.5) * 0.42 + P; box(tw, 1.2, 0.5, 0.5, mats.trim, Math.sin(da) * 1.9, 11.35, Math.cos(da) * 1.9, 0.03).rotation.y = da; box(tw, 0.9, 0.04, 0.3, k % 2 ? mats.lG : mats.lB, Math.sin(da) * 1.9, 11.65, Math.cos(da) * 1.9, 0.005).rotation.y = da; }
  cylP(tw, 0.1, 0.1, 1.0, 8, mats.trim, 0, 11.5, 0); add(tw, new THREE.SphereGeometry(0.25, 8, 6), mats.lA, 0, 12.0, 0);
  // radar, antenas y baliza giratoria
  cylP(tw, 0.12, 0.16, 1.6, 8, mats.hull2, 0, 14.5, 0);
  var tradar = new THREE.Group(); tradar.position.set(0, 15.4, 0); tw.add(tradar);
  cylP(tradar, 0.22, 0.22, 0.2, 12, mats.hull2, 0, 0, 0); box(tradar, 3.0, 0.5, 0.1, mats.panel, 0, 0.3, 0.12, 0.02); for (k = 0; k < 7; k++) box(tradar, 0.02, 0.5, 0.11, mats.trim, -1.2 + k * 0.4, 0.3, 0.12, 0.003); box(tradar, 3.0, 0.06, 0.16, mats.accent, 0, 0.58, 0.12, 0.01); box(tradar, 0.3, 0.14, 0.34, mats.hull2, 0, 0.3, 0, 0.02);
  [[2.8, 0.3], [-2.9, 0.4], [0.6, -2.7]].forEach(function (a2) { strutIn(tw, [a2[0], 13.7, a2[1]], [a2[0], 16.3, a2[1]], 0.03, mats.mkW); add(tw, new THREE.SphereGeometry(0.06, 6, 6), mats.lR, a2[0], 16.35, a2[1]); });
  var tbeacon = new THREE.Group(); tbeacon.position.set(0, 13.9, 2.6); tw.add(tbeacon); cylP(tbeacon, 0.2, 0.25, 0.3, 10, mats.trim, 0, 0, 0); add(tbeacon, new THREE.SphereGeometry(0.2, 10, 8, 0, TAU, 0, P / 2), mats.lG, 0, 0.15, 0);
  var tbeamG = new THREE.Group(); tbeamG.position.set(0, 14.2, 2.6); tw.add(tbeamG); box(tbeamG, 3.0, 0.12, 0.12, mats.beam, 1.6, 0, 0, 0.01); box(tbeamG, 3.0, 0.12, 0.12, mats.beam, -1.6, 0, 0, 0.01);
  [[3.0, 3.0], [-3.0, 3.0]].forEach(function (p) { box(tw, 0.5, 0.25, 0.3, mats.dark, p[0], 11.0, p[1], 0.02); add(tw, new THREE.BoxGeometry(0.4, 0.04, 0.18), mats.lW, p[0], 10.87, p[1] + 0.02); });
// mástil de comunicaciones reticulado junto a la torre, con radomo y platos
  var mx = -6.4, mz = -1.0;
  box(tw, 2.2, 0.5, 2.2, mats.concD, mx, 0.25, mz, 0.04);
  [[-0.7, -0.7], [0.7, -0.7], [-0.7, 0.7], [0.7, 0.7]].forEach(function (c4) {
    strutIn(tw, [mx + c4[0], 0.4, mz + c4[1]], [mx + c4[0] * 0.35, 20, mz + c4[1] * 0.35], 0.08, mats.hull2);
  });
  for (k = 0; k < 9; k++) {
    var my0 = 1.2 + k * 2.1, mw0 = 0.7 - k * 0.04;
    strutIn(tw, [mx - mw0, my0, mz - mw0], [mx + mw0 * 0.9, my0 + 1.9, mz - mw0], 0.025, mats.trim);
    strutIn(tw, [mx + mw0, my0, mz + mw0], [mx - mw0 * 0.9, my0 + 1.9, mz + mw0], 0.025, mats.trim);
    strutIn(tw, [mx - mw0, my0, mz + mw0], [mx - mw0, my0 + 1.9, mz - mw0], 0.025, mats.trim);
    strutIn(tw, [mx + mw0, my0, mz - mw0], [mx + mw0, my0 + 1.9, mz + mw0], 0.025, mats.trim);
  }
  cylP(tw, 0.3, 0.3, 4.0, 10, mats.panel, mx, 22, mz);
  var tradarB = new THREE.Group(); tradarB.position.set(mx, 24.6, mz); tw.add(tradarB);
  cylP(tradarB, 0.3, 0.3, 0.3, 10, mats.hull2, 0, 0, 0);
  add(tradarB, new THREE.SphereGeometry(0.9, 12, 8, 0, TAU, 0, P / 2), mats.panel, 0, 0.15, 0);
  box(tradarB, 4.4, 0.7, 0.12, mats.panel, 0, 0.9, 0.2, 0.02); box(tradarB, 0.2, 1.0, 0.3, mats.trim, 0, 0.5, 0.1, 0.02);
  for (k = 0; k < 3; k++) {
    var dg = new THREE.Group(); dg.position.set(mx, 12 + k * 3.3, mz); dg.rotation.y = k * 2.1 + 0.7; tw.add(dg);
    add(dg, new THREE.SphereGeometry(0.9, 12, 8, 0, TAU, 0, P / 2.2), mats.panel, 1.2, 0, 0).rotation.z = -P / 2; cylP(dg, 0.05, 0.05, 1.0, 6, mats.trim, 0.6, 0, 0).rotation.z = P / 2;
  }
  add(tw, new THREE.SphereGeometry(0.22, 8, 6), mats.lR, mx, 26.1, mz); add(tw, new THREE.SphereGeometry(0.16, 8, 6), mats.lR, mx, 14.0, mz);
  
  tw.scale.setScalar(1.1);
  // manga de viento
  var WSKX = 58, WSKZ = -25;
  cylP(group, 0.35, 0.45, 0.3, 8, mats.concD, WSKX, y0 + 0.15, WSKZ); cylP(group, 0.07, 0.1, 6.0, 8, mats.hull2, WSKX, y0 + 3.2, WSKZ);
  var sockG = new THREE.Group(); sockG.position.set(WSKX, y0 + 6.0, WSKZ); group.add(sockG); add(sockG, new THREE.TorusGeometry(0.5, 0.035, 6, 14), mats.trim, 0.0, 0, 0).rotation.y = P / 2;
  var sockD = new THREE.Group(); sockG.add(sockD);
  for (k = 0; k < 5; k++) { var sg = new THREE.CylinderGeometry(0.5 - k * 0.06, 0.5 - (k + 1) * 0.06, 0.55, 10, 1, true); sg.rotateZ(P / 2); sg.translate(0.3 + k * 0.55, 0, 0); add(sockD, sg, k % 2 ? mats.sockW : mats.sockO, 0, 0, 0); }
  // terminal de pasajeros
  var TMP = [-46, -25], tm = new THREE.Group(); tm.position.set(TMP[0], y0, TMP[1]); tm.rotation.y = 0; group.add(tm);
  box(tm, 12.4, 0.2, 8.4, mats.concD, 0, 0.1, 0, 0.03); box(tm, 12, 3.6, 8, mats.panel, 0, 2.0, 0, 0.06); box(tm, 12.6, 0.3, 8.6, mats.conc, 0, 3.95, 0, 0.03); box(tm, 12.02, 0.2, 8.02, mats.accent, 0, 3.55, 0, 0.01);
  add(tm, new THREE.BoxGeometry(9.0, 1.3, 0.06), mats.strip, 0, 1.9, 0 + 4.03); var tml = []; for (k = 0; k < 14; k++) tml.push({ x: 0 - 4.2 + k * 0.65, y: 1.9, z: 0 + 4.07, sx: 0.5, sy: 0.9, sz: 0.02 });
  var tmMesh = boxField(UB, mats.window, tml); tm.add(tmMesh);
  for (k = 0; k < 10; k++) box(tm, 0.07, 1.3, 0.1, mats.trim, 0 - 4.5 + k * 1.0, 1.9, 0 + 4.06, 0.01);
  box(tm, 1.6, 2.4, 0.15, mats.accent, 0, 1.4, 0 + 4.05, 0.02); box(tm, 1.3, 2.2, 0.08, mats.dark, 0, 1.35, 0 + 4.12, 0.02); box(tm, 3.4, 0.14, 1.4, mats.conc, 0, 2.7, 0 + 4.7, 0.02);
  [-1.5, 1.5].forEach(function (dx) { cylP(tm, 0.06, 0.06, 2.5, 8, mats.trim, 0 + dx, 1.35, 0 + 5.2); });
  for (k = 0; k < 3; k++) { box(tm, 0.8, 0.7, 0.8, mats.hull2, 0 - 4 + k * 3.6, 4.4, 0, 0.04); cylP(tm, 0.3, 0.3, 0.03, 12, mats.dark, 0 - 4 + k * 3.6, 4.78, 0); }
  box(tm, 3.2, 0.7, 0.1, mats.dark, 0 + 3.6, 4.1, 0 + 4.1, 0.02); box(tm, 2.4, 0.12, 0.06, mats.accent, 0 + 3.6, 4.15, 0 + 4.16, 0.01);
  for (k = 0; k < 4; k++) box(tm, 0.9, 0.2, 0.4, mats.wood || mats.hull2, 0 - 5.0 + k * 1.3, 0.4, 0 + 5.5, 0.03);
  var pilotDoor = [TMP[0], TMP[1] + 4.3];

  // depósito de combustible (sector de 230°): tres tanques tumbados y surtidores
  var fd = new THREE.Group(); fd.position.set(-12, y0, 27); fd.rotation.y = P; group.add(fd);
  box(fd, 11.0, 0.2, 13.0, mats.concD, 0, 0.1, 0, 0.03);
  [-4.2, 0, 4.2].forEach(function (zz) {
    var ft = cylP(fd, 1.3, 1.3, 5.6, 22, mats.tankM, 0, 1.7, zz); ft.rotation.z = P / 2;
    [-2.8, 2.8].forEach(function (cxp, ci) { var cap = add(fd, new THREE.SphereGeometry(1.3, 14, 6, 0, TAU, 0, P / 2), mats.tankM, cxp, 1.7, zz); cap.rotation.z = ci ? -P / 2 : P / 2; });
    [-1.8, 1.8].forEach(function (dx) { box(fd, 0.35, 0.5, 2.4, mats.trim, dx, 0.3, zz, 0.02); add(fd, new THREE.TorusGeometry(1.31, 0.04, 6, 24), mats.accent, dx, 1.7, zz).rotation.y = P / 2; });
    box(fd, 0.5, 0.2, 0.5, mats.trim, 0, 3.05, zz, 0.02); add(fd, new THREE.SphereGeometry(0.13, 8, 6), mats.lA, 0, 3.2, zz);
  });
  [[-4.6, 2.1], [4.6, 2.1]].forEach(function (p) { box(fd, 0.7, 1.4, 0.5, mats.cartY, p[0], 0.7, p[1] + 2.6, 0.04); box(fd, 0.4, 0.3, 0.05, mats.dark, p[0] + 0.3, 1.0, p[1] + 2.6, 0.01); cylP(fd, 0.03, 0.03, 0.7, 6, mats.rubber, p[0] + 0.45, 0.7, p[1] + 2.8); box(fd, 0.9, 0.12, 0.7, mats.concD, p[0], 0.06, p[1] + 2.6, 0.02); });
  for (k = 0; k < 8; k++) strutIn(fd, [-5.2, 0.2, -6.0 + k * 1.7], [-5.2, 0.9, -6.0 + k * 1.7], 0.02, mats.accent); box(fd, 0.12, 0.1, 12, mats.accent, -5.2, 0.9, 0, 0.01);
  // contenedores apilados (sector de 250°)
  var cmats = [mats.cargoA, mats.cargoB, mats.cargoC, mats.cargoD], cg = new THREE.Group(); cg.position.set(32, y0, 28); cg.rotation.y = 0; group.add(cg);
  for (k = 0; k < 5; k++) { box(cg, 3.0, 0.95, 1.0, cmats[k % 4], -6.6 + k * 3.3, 0.48, 0, 0.04); if (k % 3 !== 1) box(cg, 3.0, 0.95, 1.0, cmats[(k + 1) % 4], -6.6 + k * 3.3, 1.45, 0, 0.04); for (j = 0; j < 4; j++) box(cg, 0.04, 0.8, 0.04, mats.trim, -7.8 + k * 3.3 + j * 0.8, 0.48, 0.52, 0.005); }
  // campo solar al sur de la nave
  for (j = 0; j < 2; j++) for (i = 0; i < 8; i++) {
    var sp = new THREE.Group(); sp.position.set(-28 + i * 7.6, y0 + 0.55, -24 - j * 5); group.add(sp);
    box(sp, 0.1, 0.5, 0.1, mats.trim, -0.7, -0.15, 0.2, 0.01); box(sp, 0.1, 0.5, 0.1, mats.trim, 0.7, -0.15, 0.2, 0.01);
    var pg2 = new THREE.Group(); pg2.rotation.x = -0.55; sp.add(pg2); box(pg2, 3.2, 0.08, 1.4, mats.solar, 0, 0, 0, 0.015); box(pg2, 3.2, 0.08, 1.4, mats.solar, 0, 0, 0, 0.015);
    var gl = []; for (k = 1; k < 8; k++) gl.push({ x: -1.6 + k * 0.4, y: 0.045, z: 0, sx: 0.015, sy: 0.01, sz: 1.35 }); for (k = 1; k < 4; k++) gl.push({ x: 0, y: 0.045, z: -0.7 + k * 0.35, sx: 3.1, sy: 0.01, sz: 0.015 });
    pg2.add(boxField(UB, mats.cell, gl));
  }
  // patio de piezas (nordeste): grúa pórtico de patio, montones de chatarra y motores de repuesto, depósitos de pintura
  var yd = new THREE.Group(); yd.position.set(52, y0, 24); group.add(yd);
  [[-7, -5], [7, -5], [-7, 5], [7, 5]].forEach(function (lp) { box(yd, 0.9, 11, 0.9, mats.hwD, lp[0], 5.5, lp[1], 0.04); box(yd, 1.6, 0.4, 1.6, mats.concD, lp[0], 0.2, lp[1], 0.03); });
  box(yd, 15.4, 0.9, 0.8, mats.cargoD, 0, 11.2, -5, 0.04); box(yd, 15.4, 0.9, 0.8, mats.cargoD, 0, 11.2, 5, 0.04); box(yd, 0.9, 0.7, 11, mats.hull2, 0, 11.3, 0, 0.03);
  var ydT = new THREE.Group(); ydT.position.set(0, 10.6, 0); yd.add(ydT); box(ydT, 1.6, 0.7, 1.4, mats.cargoD, 0, 0, 0, 0.04); var ydC = new THREE.Mesh(_cg[0.03] || (_cg[0.03] = new THREE.CylinderGeometry(0.03, 0.03, 1, 8)), mats.trim); ydT.add(ydC); var ydH = box(ydT, 0.6, 0.5, 0.6, mats.hazY, 0, -4, 0, 0.04);
  for (k = 0; k < 7; k++) { var mh = 0.6 + rnd() * 1.4; box(yd, 1.2 + rnd() * 1.6, mh, 1.0 + rnd() * 1.6, [mats.hull2, mats.hwD, mats.cargoA, mats.dark][k % 4], -5.2 + (k % 4) * 3.4 + rnd(), mh / 2 + 0.05, -3 + Math.floor(k / 4) * 6 + rnd(), 0.05).rotation.y = rnd() * 3; }
  for (k = 0; k < 4; k++) { cylP(yd, 0.8, 0.8, 2.0, 12, mats.hull2, -3 + k * 2.2, 1.1, 1.0).rotation.x = P / 2; cylP(yd, 0.55, 0.55, 1.2, 12, mats.trim, -3 + k * 2.2, 1.8, 1.0); }
  for (k = 0; k < 3; k++) { cylP(yd, 1.6, 1.6, 6, 16, mats.tankM, -14 + k * 3.8, 3.2, 3); add(yd, new THREE.SphereGeometry(1.6, 14, 6, 0, TAU, 0, P / 2), mats.tankM, -14 + k * 3.8, 6.2, 3); add(yd, new THREE.TorusGeometry(1.62, 0.05, 6, 24), mats.accent, -14 + k * 3.8, 4.4, 3).rotation.x = P / 2; strutIn(yd, [-14 + k * 3.8 + 1.6, 0.3, 3], [-14 + k * 3.8 + 1.6, 5.4, 3], 0.05, mats.trim); }
  // farolas junto a las calles y mástiles de focos a lo largo de la nave
  var lpHead = [];
  [[-44, 6.5], [-52, 6.5], [-44, -6.5], [-52, -6.5], [44, 6.5], [52, 6.5], [44, -6.5], [52, -6.5]].forEach(function (lp) { cylP(group, 0.07, 0.1, 3.4, 6, mats.hull2, lp[0], y0 + 1.7, lp[1]); box(group, 0.9, 0.12, 0.28, mats.trim, lp[0], y0 + 3.45, lp[1] + (lp[1] > 0 ? 0.3 : -0.3), 0.02); lpHead.push({ x: lp[0], y: y0 + 3.37, z: lp[1] + (lp[1] > 0 ? 0.35 : -0.35), sx: 0.7, sy: 0.05, sz: 0.2 }); });
  [-30, -10, 10, 30].forEach(function (fx) { [-1, 1].forEach(function (s2) {
    var fz = s2 * (HZ + 4.6); cylP(group, 0.14, 0.24, 11, 8, mats.hull2, fx, y0 + 5.5, fz); cylP(group, 0.5, 0.6, 0.35, 8, mats.concD, fx, y0 + 0.17, fz);
    box(group, 1.8, 0.2, 0.5, mats.trim, fx, y0 + 11.1, fz, 0.02);
    var fl = []; for (k = 0; k < 6; k++) fl.push({ x: fx - 0.7 + (k % 3) * 0.7, y: y0 + 11.0 + Math.floor(k / 3) * 0.3 - 0.1, z: fz - s2 * 0.28, sx: 0.55, sy: 0.22, sz: 0.1 });
    group.add(boxField(UB, mats.lW, fl));
  }); });
  var lampM = boxField(UB, mats.lW, lpHead); group.add(lampM);
  // escudo de energía sobre toda la nave-taller (se enciende en alerta)
  var dome = add(group, new THREE.SphereGeometry(1, 40, 14, 0, TAU, 0, P / 2), domeMat, 0, y0, 0); dome.scale.set(XPE + 13, 30, 36); dome.visible = false;

  /* ---------- Vehículos: carritos, remolcador robot, piloto y nave de demostración ---------- */
  var RY = FL;
  function buildCart(hx, hz) {
    var g = new THREE.Group(); group.add(g); var wheels = [];
    box(g, 0.9, 0.22, 1.7, mats.cartY, 0, 0.32, 0, 0.04); box(g, 0.94, 0.12, 0.5, mats.hazK, 0, 0.3, -0.75, 0.01);
    box(g, 0.8, 0.5, 0.5, mats.cartY, 0, 0.55, -0.55, 0.05); box(g, 0.7, 0.2, 0.06, mats.cab, 0, 0.72, -0.82, 0.01);
    box(g, 0.7, 0.3, 0.4, mats.trim, 0, 0.55, 0.05, 0.04); box(g, 0.7, 0.32, 0.08, mats.trim, 0, 0.75, 0.28, 0.02);
    box(g, 0.86, 0.1, 0.7, mats.cartB, 0, 0.5, 0.62, 0.02); box(g, 0.05, 0.22, 0.7, mats.cartB, -0.42, 0.6, 0.62, 0.01); box(g, 0.05, 0.22, 0.7, mats.cartB, 0.42, 0.6, 0.62, 0.01);
    [-0.4, 0.4].forEach(function (px) { [-0.5, 0.5].forEach(function (pz) { strutIn(g, [px, 0.4, pz], [px, 1.05, pz], 0.025, mats.trim); }); });
    box(g, 0.95, 0.06, 1.2, mats.panel, 0, 1.06, 0, 0.02);
    [-0.58, 0.6].forEach(function (wz) { [-0.46, 0.46].forEach(function (wx) { var w = cylP(g, 0.2, 0.2, 0.14, 12, mats.rubber, wx, 0.2, wz); w.rotation.z = P / 2; var hub = cylP(w, 0.09, 0.09, 0.16, 8, mats.hull2, 0, 0, 0); wheels.push(w); }); });
    add(g, new THREE.BoxGeometry(0.16, 0.06, 0.04), mats.lW, -0.28, 0.35, -0.87); add(g, new THREE.BoxGeometry(0.16, 0.06, 0.04), mats.lW, 0.28, 0.35, -0.87);
    var bc = cylP(g, 0.06, 0.08, 0.1, 8, mats.trim, 0, 1.14, 0.35), bl = add(g, new THREE.SphereGeometry(0.07, 8, 6), mats.lA, 0, 1.22, 0.35);
    g.position.set(hx, RY, hz);
    return { g: g, x: hx, z: hz, yaw: 0, lv: 0, wheels: wheels, beacon: bl, hx: hx, hz: hz, busy: false, speed: 4.2, pilot: false, kind: 'cart' };
  }
  function buildTug(hx, hz) {
    var g = new THREE.Group(); group.add(g); var wheels = [];
    box(g, 0.95, 0.4, 1.4, mats.robot, 0, 0.42, 0, 0.08); box(g, 1.0, 0.1, 1.0, mats.accent, 0, 0.3, 0.05, 0.02);
    [-0.56, 0.56].forEach(function (tx) { box(g, 0.2, 0.34, 1.5, mats.rubber, tx, 0.22, 0, 0.1); for (j = 0; j < 4; j++) { var w = cylP(g, 0.1, 0.1, 0.22, 8, mats.hull2, tx, 0.22, -0.55 + j * 0.37); w.rotation.z = P / 2; wheels.push(w); } });
    box(g, 0.7, 0.34, 0.6, mats.robot, 0, 0.8, -0.2, 0.08); box(g, 0.6, 0.14, 0.05, mats.cab, 0, 0.84, -0.52, 0.01);
    add(g, new THREE.BoxGeometry(0.1, 0.06, 0.03), mats.lG, -0.14, 0.84, -0.55); add(g, new THREE.BoxGeometry(0.1, 0.06, 0.03), mats.lG, 0.14, 0.84, -0.55);
    box(g, 0.7, 0.07, 0.62, mats.accent, 0, 0.99, -0.2, 0.02); strutIn(g, [0.25, 1.0, 0.0], [0.25, 1.4, 0.0], 0.015, mats.trim); add(g, new THREE.SphereGeometry(0.04, 6, 6), mats.lR, 0.25, 1.42, 0);
    var bl = add(g, new THREE.SphereGeometry(0.08, 8, 6), mats.lA, -0.22, 1.05, 0.15);
    add(g, new THREE.BoxGeometry(0.2, 0.06, 0.03), mats.lW, -0.3, 0.5, -0.71); add(g, new THREE.BoxGeometry(0.2, 0.06, 0.03), mats.lW, 0.3, 0.5, -0.71);
    // brazo trasero con pinza que se abre y cierra
    var arm = new THREE.Group(); arm.position.set(0, 0.5, 0.62); g.add(arm); box(arm, 0.3, 0.26, 0.5, mats.hull2, 0, 0, 0.1, 0.04); box(arm, 0.16, 0.14, 0.4, mats.cartY, 0, 0.03, 0.3, 0.03);
    var fL = new THREE.Group(), fR = new THREE.Group(); fL.position.set(-0.1, 0, 0.5); fR.position.set(0.1, 0, 0.5); arm.add(fL); arm.add(fR);
    box(fL, 0.08, 0.2, 0.42, mats.hazY, -0.04, 0, 0.2, 0.02); box(fR, 0.08, 0.2, 0.42, mats.hazY, 0.04, 0, 0.2, 0.02);
    g.position.set(hx, RY, hz);
    return { g: g, x: hx, z: hz, yaw: 0, lv: 0, wheels: wheels, beacon: bl, hx: hx, hz: hz, busy: false, speed: 4.5, claw: { fL: fL, fR: fR, o: 1, t: 1 }, kind: 'tug' };
  }
  function buildPilot() {
    var g = new THREE.Group(); group.add(g); g.visible = false;
    var lL = new THREE.Group(), lR = new THREE.Group(); lL.position.set(-0.07, 0.38, 0); lR.position.set(0.07, 0.38, 0); g.add(lL); g.add(lR);
    box(lL, 0.09, 0.38, 0.1, mats.suit, 0, -0.19, 0, 0.02); box(lR, 0.09, 0.38, 0.1, mats.suit, 0, -0.19, 0, 0.02);
    box(g, 0.3, 0.38, 0.17, mats.suit, 0, 0.58, 0, 0.04); box(g, 0.32, 0.06, 0.18, mats.trim, 0, 0.42, 0, 0.01);
    var aL = new THREE.Group(), aR = new THREE.Group(); aL.position.set(-0.2, 0.74, 0); aR.position.set(0.2, 0.74, 0); g.add(aL); g.add(aR);
    box(aL, 0.07, 0.34, 0.08, mats.suit, 0, -0.16, 0, 0.02); box(aR, 0.07, 0.34, 0.08, mats.suit, 0, -0.16, 0, 0.02);
    add(g, new THREE.SphereGeometry(0.12, 10, 8), mats.panel, 0, 0.9, 0); add(g, new THREE.SphereGeometry(0.095, 8, 6), mats.cab, 0, 0.9, -0.05);
    return { g: g, lL: lL, lR: lR, aL: aL, aR: aR, x: 0, z: 0, yaw: 0, walk: 0, sit: false };
  }
  // nave de demostración (nariz en -Z, base en y = 0); userData.length / width para el sistema de remolque
  function buildDemoShip() {
    var s = new THREE.Group(), hullM = std(0xc9d0d9, 0.5, 0.35), darkM = std(0x2a3240, 0.7, 0.4), accM = std(ACC, 0.4, 0.4);
    var body = add(s, new THREE.SphereGeometry(1, 16, 10), hullM, 0, 1.25, 0); body.scale.set(1.15, 0.8, 4.0);
    add(s, new THREE.SphereGeometry(0.55, 12, 8, 0, TAU, 0, P / 2), mats.cab, 0, 1.7, -1.5).scale.set(1, 0.9, 1.5);
    box(s, 6.4, 0.12, 1.8, hullM, 0, 1.05, 0.8, 0.03); box(s, 6.6, 0.14, 0.3, accM, 0, 1.05, 1.6, 0.01);
    box(s, 0.12, 1.3, 1.2, accM, 0, 2.1, 3.0, 0.02); box(s, 2.4, 0.1, 0.8, hullM, 0, 1.4, 3.3, 0.02);
    [-1.2, 1.2].forEach(function (ex) { var en = cylP(s, 0.45, 0.5, 1.5, 12, darkM, ex, 1.1, 3.4); en.rotation.x = P / 2; add(s, new THREE.CircleGeometry(0.4, 12), mats.lB, ex, 1.1, 4.16); });
    [[0, -1.6, 0.5], [-1.0, 1.6, 0.5], [1.0, 1.6, 0.5]].forEach(function (lg) { strutIn(s, [lg[0], 0.9, lg[1]], [lg[0], 0.3, lg[1]], 0.06, mats.trim); var w = cylP(s, 0.3, 0.3, 0.2, 10, mats.rubber, lg[0], 0.3, lg[1]); w.rotation.z = P / 2; });
    add(s, new THREE.SphereGeometry(0.06, 6, 6), mats.lR, -3.3, 1.05, 1.6); add(s, new THREE.SphereGeometry(0.06, 6, 6), mats.lG, 3.3, 1.05, 1.6);
    s.userData = { length: 8.4, width: 6.6, baseY: 0, demo: true };
    return s;
  }
  var carts = [], tugs = [];
  var cv = buildCart(-52, -9); cv.yaw = YX; cv.hyaw = YX; cv.g.rotation.y = YX; cv.pad = 0; cv.lob = { drop: [-46, -17.5], door: [-46, -21.2] }; carts.push(cv);
  [[-50, 9.5], [50, 9.5]].forEach(function (tp, ti) { var tv = buildTug(tp[0], tp[1]); tv.yaw = YX; tv.hyaw = YX; tv.g.rotation.y = YX; tugs.push(tv); });
  var pilot = buildPilot();

  /* ---------- Rutas y ejecutor de pasos (movimientos, remolque, ascensor) ---------- */
  function yawFor(dx, dz) { return Math.atan2(-dx, -dz); }
  function angDiff(a, b) { var d = (b - a) % TAU; if (d > P) d -= TAU; if (d < -P) d += TAU; return d; }
  function curY(v) { return deckY(v.x, v.z); }
  function polAng(x, z) { return Math.atan2(z, x); }
  function buildPath(pts0, R) {
    var pts = [], i2, a, b, c, out = [], res = [], s = 0, prev = null;
    for (i2 = 0; i2 < pts0.length; i2++) if (!pts.length || Math.hypot(pts0[i2][0] - pts[pts.length - 1][0], pts0[i2][1] - pts[pts.length - 1][1]) > 0.05) pts.push(pts0[i2]);
    var n = pts.length;
    out.push([pts[0][0], pts[0][1]]);
    for (i2 = 1; i2 < n - 1; i2++) {
      a = pts[i2 - 1]; b = pts[i2]; c = pts[i2 + 1];
      var l1 = Math.hypot(b[0] - a[0], b[1] - a[1]), l2 = Math.hypot(c[0] - b[0], c[1] - b[1]), cut = Math.min(R, l1 * 0.5, l2 * 0.5);
      if (cut < 0.05) { out.push([b[0], b[1]]); continue; }
      var p1 = [b[0] + (a[0] - b[0]) * cut / l1, b[1] + (a[1] - b[1]) * cut / l1], p2 = [b[0] + (c[0] - b[0]) * cut / l2, b[1] + (c[1] - b[1]) * cut / l2];
      for (var u = 0; u <= 8; u++) { var f = u / 8, g2 = 1 - f; out.push([g2 * g2 * p1[0] + 2 * g2 * f * b[0] + f * f * p2[0], g2 * g2 * p1[1] + 2 * g2 * f * b[1] + f * f * p2[1]]); }
    }
    if (n > 1) out.push([pts[n - 1][0], pts[n - 1][1]]);
    for (i2 = 0; i2 < out.length; i2++) { var q2 = out[i2]; if (prev) { var dd = Math.hypot(q2[0] - prev[0], q2[1] - prev[1]); if (dd < 1e-4) continue; s += dd; } res.push({ x: q2[0], z: q2[1], s: s }); prev = q2; }
    return { p: res, total: s };
  }
  function pathAt(path, s) {
    var p = path.p, n = p.length;
    if (n < 2) return { x: p[0].x, z: p[0].z, dx: 0, dz: -1 };
    s = clamp(s, 0, path.total);
    var a = 0; while (a < n - 2 && p[a + 1].s < s) a++;
    var A = p[a], B = p[a + 1], f = (s - A.s) / Math.max(1e-6, B.s - A.s), dx = B.x - A.x, dz = B.z - A.z, l = Math.hypot(dx, dz) || 1;
    return { x: A.x + dx * f, z: A.z + dz * f, dx: dx / l, dz: dz / l };
  }
  function placeShip(rec, v) {                       // la nave va detrás del remolcador (rígida)
    var D = rec.L / 2 + 0.85, sn = Math.sin(v.yaw), cs = Math.cos(v.yaw), sx = v.x + sn * D, sz = v.z + cs * D;
    rec.o.position.set(sx, deckY(sx, sz) + rec.baseY, sz);
    rec.o.rotation.y = v.tow.nose ? v.yaw : v.yaw + P;
  }
  function applyV(v) {
    v.g.position.set(v.x, curY(v), v.z); v.g.rotation.y = v.yaw;
    if (v.tow) placeShip(v.tow.rec, v);
  }
  function stp(init, tick) { var st = false; return function (dt) { if (!st) { st = true; if (init) init(); } return tick(dt); }; }
  function sDo(fn) { return function () { fn(); return true; }; }
  function sWait(sec) { var t0 = 0; return function (dt) { t0 += dt; return t0 >= sec; }; }
  function sUntil(fn) { return function () { return !!fn(); }; }
  function seq(list) { var ii = 0; return function (dt) { while (ii < list.length) { if (list[ii](dt)) ii++; else return false; } return true; }; }
  function par(list) { var dn = [], pp; return function (dt) { var all = true; for (pp = 0; pp < list.length; pp++) if (!dn[pp]) { if (list[pp](dt)) dn[pp] = true; else all = false; } return all; }; }
  function sMove(v, pts, opt) {
    opt = opt || {}; var path = null, s = 0, vel = 0, align = false, tgt = 0;
    return stp(function () {
      var list = typeof pts === 'function' ? pts() : pts;
      path = buildPath([[v.x, v.z]].concat(list), opt.R || 1.4); s = 0; vel = 0; if (opt.save) { opt.save.path = path; opt.save.s = 0; opt.save.done = false; }
      align = !opt.noAlign && path.p.length > 1;
      if (align) { var t0 = pathAt(path, 0); tgt = opt.rev ? yawFor(-t0.dx, -t0.dz) : yawFor(t0.dx, t0.dz); }
    }, function (dt) {
      if (path.p.length < 2) return true;
      if (align) { var d = angDiff(v.yaw, tgt), stp2 = 4.0 * dt; if (Math.abs(d) <= stp2) { v.yaw = tgt; align = false; } else v.yaw += (d > 0 ? 1 : -1) * stp2; applyV(v); return false; }
      var sp = opt.speed || v.speed, rem = path.total - s;
      vel = Math.min(vel + 4 * dt, sp, Math.sqrt(2 * 3 * Math.max(rem, 0)) + 0.12);
      s = Math.min(path.total, s + vel * dt); if (opt.save) opt.save.s = s;
      var q = pathAt(path, s), mv = vel * dt, w2;
      v.x = q.x; v.z = q.z; v.yaw = opt.rev ? yawFor(-q.dx, -q.dz) : yawFor(q.dx, q.dz);
      for (w2 = 0; w2 < v.wheels.length; w2++) v.wheels[w2].rotation.x += (opt.rev ? -mv : mv) / 0.2;
      v.moving = 1;
      applyV(v);
      if (s >= path.total - 1e-4) { v.moving = 0; if (opt.save) opt.save.done = true; return true; }
      return false;
    });
  }
  function sTurn(v, yaw) {
    return function (dt) { var d = angDiff(v.yaw, yaw), st2 = 4.0 * dt; if (Math.abs(d) <= st2) { v.yaw = yaw; applyV(v); return true; } v.yaw += (d > 0 ? 1 : -1) * st2; applyV(v); return false; };
  }
  function sClaw(v, open) { return stp(function () { v.claw.t = open ? 1 : 0; }, function () { return Math.abs(v.claw.o - v.claw.t) < 0.02; }); }
  function sPilotTo(x, z, sp) {
    var x0, z0, len, tt;
    return stp(function () { x0 = pilot.x; z0 = pilot.z; len = Math.hypot(x - x0, z - z0) || 0.01; tt = 0; pilot.yaw = yawFor(x - x0, z - z0); pilot.walking = true; },
      function (dt) { tt += dt * (sp || 1.3) / len; var f = Math.min(1, tt); pilot.x = x0 + (x - x0) * f; pilot.z = z0 + (z - z0) * f; if (f >= 1) { pilot.walking = false; return true; } return false; });
  }
  function holdDoor(bay) { bay.holds++; }
  function freeDoor(bay) { bay.holds = Math.max(0, bay.holds - 1); }

  /* ---------- Trabajos: entrada, línea de montaje (3 estaciones), salida y despegue ---------- */
  var jobs = [], ships = [], flights = [], shopBay = { type: 'repair', name: 'linea' }, doorW = shopDoors[0], doorE = shopDoors[1];
  function recOf(o, opts) {
    var r = o.userData && o.userData._air;
    if (r) return r;
    opts = opts || {}; var ud = o.userData || {};
    r = { o: o, L: opts.length || ud.length || 8, W: opts.width || ud.width || 6, baseY: ud.baseY || 0, state: 'landed', bay: null, job: null, pad: null };
    o.userData = ud; ud._air = r; ships.push(r);
    r.parent0 = o.parent;
    if (o.parent !== group) { if (group.attach) group.attach(o); else group.add(o); }
    var bp = null, bd = 1e9, pq;
    for (pq = 0; pq < pads.length; pq++) { var dd2 = Math.hypot(o.position.x - pads[pq].x, o.position.z - pads[pq].z); if (dd2 < bd) { bd = dd2; bp = pads[pq]; } }
    if (bp && bd < PADR + 3) { r.pad = bp; if (!bp.rec) bp.rec = r; }
    return r;
  }
  function poseOf(rec) { return { x: rec.o.position.x, z: rec.o.position.z, yaw: rec.o.rotation.y }; }
  function endAt(pose, L, which) {
    var sg = which === 'nose' ? 1 : -1, ax = -Math.sin(pose.yaw) * sg, az = -Math.cos(pose.yaw) * sg, d = L / 2 + 0.85;
    return { x: pose.x + ax * d, z: pose.z + az * d, ax: ax, az: az, which: which };
  }
  function notify(job, st) { job.state = st; if (job.rec) job.rec.state = st; if (job.onState) { try { job.onState(job, job.rec.o); } catch (e) { } } }
  function sHide(vv) { return sDo(function () { vv.g.visible = false; }); }
  function stepsAttach(tug, E) {
    var Q = { x: E.x + E.ax * 2.4, z: E.z + E.az * 2.4 };
    return [sDo(function () { tug.claw.t = 1; }), sMove(tug, [[Q.x, Q.z]], { R: 1.6 }), sTurn(tug, yawFor(E.ax, E.az)),
      sMove(tug, [[E.x, E.z]], { rev: true, noAlign: true, speed: 1.4, R: 0.1 }), sClaw(tug, false)];
  }
  function flowAlignPad(job, pd, psiT) {
    var rec = job.rec, x0, z0, a0, aT, tt = 0, dur = 3.2;
    return stp(function () { x0 = rec.o.position.x; z0 = rec.o.position.z; a0 = rec.o.rotation.y; aT = a0 + angDiff(a0, psiT); pd.tt.rotation.y = a0 - aT; notify(job, 'aligning'); }, function (dt) {
      tt += dt; var u = clamp(tt / dur, 0, 1), e = u * u * (3 - 2 * u), ya = a0 + (aT - a0) * e;
      rec.o.position.set(pd.x + (x0 - pd.x) * (1 - e), FL + rec.baseY, pd.z + (z0 - pd.z) * (1 - e)); rec.o.rotation.y = ya; pd.tt.rotation.y = ya - aT;
      if (u >= 1) { rec.o.rotation.y = psiT; pd.tt.rotation.y = 0; return true; }
      return false;
    });
  }
  function flowPilot(job, cart, pd) {                // el carrito recoge al piloto junto a la nave y lo lleva a la oficina
    var rec = job.rec, fx = -Math.sin(YX), fz = -Math.cos(YX), off = rec.W / 2 + 1.6;
    var px = pd.x - fz * off, pz = pd.z + fx * off, CP = { x: px, z: pz - 1.0 }, st = [], lob = cart.lob, home = { x: cart.hx, z: cart.hz };
    st.push(sDo(function () { cart.busy = true; pilot.g.visible = true; pilot.sit = null; pilot.x = px; pilot.z = pz; pilot.yaw = 0; }));
    st.push(sMove(cart, [[CP.x, CP.z]], { R: 1.6 }));
    st.push(sPilotTo(CP.x, CP.z, 1.6)); st.push(sWait(0.4));
    st.push(sDo(function () { pilot.sit = cart; job.boarded = true; }));
    st.push(sMove(cart, [[lob.drop[0], lob.drop[1]]], { R: 1.8 }));
    st.push(sDo(function () { pilot.sit = null; pilot.x = lob.drop[0]; pilot.z = lob.drop[1]; }));
    st.push(sPilotTo(lob.door[0], lob.door[1], 1.4)); st.push(sHide(pilot));
    st.push(sMove(cart, [[home.x, home.z]], { R: 1.6 })); st.push(sTurn(cart, cart.hyaw));
    st.push(sDo(function () { cart.busy = false; cart.moving = 0; }));
    return seq(st);
  }
  function sCarTo(xt) {                              // el carro transportador rueda por los rieles con la nave encima
    var vel = 0;
    return stp(function () { carState.busy = true; vel = 0; }, function (dt) {
      var d = xt - carState.x, ad = Math.abs(d);
      vel = Math.min(vel + 2.5 * dt, 3.0, Math.sqrt(2 * 2.2 * ad) + 0.06);
      carState.x += Math.min(ad, vel * dt) * (d >= 0 ? 1 : -1); car.position.x = carState.x;
      if (carState.occ) { var ro = carState.occ.o; ro.position.set(carState.x, FL + DECK + carState.occ.baseY, 0); }
      carBeacon.userData.mv = true;
      if (Math.abs(xt - carState.x) < 0.004) { carState.x = xt; car.position.x = xt; if (carState.occ) carState.occ.o.position.x = xt; carState.busy = false; carBeacon.userData.mv = false; return true; }
      return false;
    });
  }
  function sStage(job, idx, frac, base) {
    var tt = 0, dur = 1;
    return stp(function () { stage.cur = idx; tt = 0; dur = Math.max(1, job.rep * frac); }, function (dt) {
      tt += dt; job.progress = clamp(base + frac * Math.min(1, tt / dur), 0, 1);
      if (tt >= dur || job.skip) { stage.cur = -1; stage.done[idx] = true; return true; }
      return false;
    });
  }
  function buildRun(job) {
    var rec = job.rec, L = rec.L, D = L / 2 + 0.85, tW = tugs[0], tE = tugs[1], pd = rec.pad, cart = job.cart, st = [];
    var E1 = endAt({ x: pd.x, z: 0, yaw: YX }, L, 'nose'), tin = [];
    tin.push(sDo(function () { notify(job, 'approach'); holdDoor(doorW); }));
    tin = tin.concat(stepsAttach(tW, E1));
    tin.push(sUntil(function () { return job.boarded; }));
    tin.push(sDo(function () { tW.tow = { rec: rec, nose: true }; pd.rec = null; rec.pad = null; notify(job, 'towing'); }));
    tin.push(sUntil(function () { return doorW.o > 0.96; }));
    tin.push(sMove(tW, [[XL + D, 0]], { noAlign: true, speed: 3.2, R: 1.5 }));
    tin.push(sDo(function () { tW.tow = null; rec.o.position.set(XL, FL + DECK + rec.baseY, 0); rec.o.rotation.y = YX; carState.occ = rec; rec.bay = shopBay; }));
    tin.push(sClaw(tW, true));
    tin.push(sMove(tW, [[XL + D, 5.0], [XL - L / 2 - 2.4, 5.0], [-HX - 5, 5.0], [tW.hx, tW.hz]], { R: 1.4 }));
    tin.push(sTurn(tW, tW.hyaw)); tin.push(sDo(function () { freeDoor(doorW); tW.busy = false; tW.moving = 0; }));
    var ps = [seq(tin)]; if (cart) ps.push(flowPilot(job, cart, pd));
    st.push(flowAlignPad(job, pd, YX)); st.push(par(ps));
    st.push(sDo(function () { stage.done = [false, false, false]; notify(job, 'repairing'); job.progress = 0; }));
    var fr = [0.25, 0.5, 0.25], base = 0;
    for (i = 0; i < 3; i++) { st.push(sCarTo(XS[i])); st.push(sStage(job, i, fr[i], base)); base += fr[i]; }
    st.push(sCarTo(XU)); st.push(sDo(function () { stage.done = [true, true, true]; job.progress = 1; notify(job, 'repaired'); }));
    var E2 = endAt({ x: XU, z: 0, yaw: YX }, L, 'nose'), tout = [];
    tout.push(sDo(function () { holdDoor(doorE); })); tout.push(sUntil(function () { return doorE.o > 0.96; }));
    tout = tout.concat(stepsAttach(tE, E2));
    tout.push(sDo(function () { tE.tow = { rec: rec, nose: true }; carState.occ = null; rec.bay = null; notify(job, 'towing'); }));
    tout.push(sMove(tE, [[XPE + D, 0]], { noAlign: true, speed: 3.2, R: 1.5 }));
    tout.push(sDo(function () { tE.tow = null; rec.o.position.set(XPE, FL + rec.baseY, 0); rec.o.rotation.y = YX; rec.pad = padE; padE.rec = rec; notify(job, 'ready'); if (job.autoTakeoff) startTakeoff(rec, job); }));
    tout.push(sClaw(tE, true));
    tout.push(sMove(tE, [[XPE + D, 6.8], [tE.hx, tE.hz]], { R: 1.4 }));
    tout.push(sTurn(tE, tE.hyaw)); tout.push(sDo(function () { freeDoor(doorE); tE.busy = false; tE.moving = 0; }));
    st.push(par([seq(tout), sCarTo(XL)]));
    return seq(st);
  }
  // polvo de la plataforma de salida o de entrada
  var dustMat = new THREE.MeshBasicMaterial({ color: 0xc9a972, transparent: true, opacity: 0, depthWrite: false }), dustM = new THREE.Mesh(new THREE.CircleGeometry(1, 28).rotateX(-P / 2), dustMat);
  dustM.visible = false; group.add(dustM);
  function setDust(x, y, z, r, op) { dustM.visible = op > 0.01; dustM.position.set(x, y + 0.05, z); dustM.scale.set(r, 1, r); dustMat.opacity = op; }
  function startTakeoff(rec, job) {
    var f = { rec: rec, t: 0, x0: rec.o.position.x, z0: rec.o.position.z, job: job, kind: 'takeoff', pd: rec.pad }; flights.push(f); rec.state = 'takeoff'; notify(job, 'takeoff');
  }
  function startLanding(o, opts) {
    opts = opts || {}; var rec = recOf(o, opts), pd = padW;
    o.visible = true; rec.state = 'landing'; rec.pad = pd; pd.rec = rec;
    var tx = pd.x + (opts.x != null ? opts.x - pd.x : (rnd() - 0.5) * 2.4), tz = (opts.z != null ? opts.z : (rnd() - 0.5) * 2.4), yaw = opts.yaw != null ? opts.yaw : (rnd() - 0.5) * 1.8;
    var f = { rec: rec, t: 0, dur: 11, tx: tx, tz: tz, yaw: yaw, sx: tx - 34, sz: tz - 14, sh: 18, kind: 'land', onLanded: opts.onLanded };
    flights.push(f); o.rotation.set(0, P / 2, 0); o.position.set(f.sx, FL + f.sh, f.sz); return rec;
  }
  function stepFlights(dt) {
    var hasDust = false;
    for (var fi = flights.length - 1; fi >= 0; fi--) {
      var f = flights[fi], r = f.rec, o = r.o, tt = f.t += dt;
      if (f.kind === 'land') {
        var u = Math.min(1, tt / f.dur), a = clamp(u / 0.42, 0, 1), ea = 1 - (1 - a) * (1 - a), b = clamp((u - 0.42) / 0.58, 0, 1), eb = b * b * (3 - 2 * b);
        var px = f.sx + (f.tx - f.sx) * ea, pz = f.sz + (f.tz - f.sz) * ea, hh = f.sh * (1 - eb);
        o.position.set(px, FL + r.baseY + hh, pz); o.rotation.set(0, P / 2 + (f.yaw - P / 2) * ea, 0);
        if (hh < 7) { setDust(px, FL, pz, 2 + (7 - hh) * 0.9 + b * 2, Math.min(0.5, (7 - hh) / 7 * 0.6) * (1 - Math.max(0, u - 0.97) * 30)); hasDust = true; }
        if (u >= 1) { r.state = 'landed'; o.rotation.set(0, f.yaw, 0); flights.splice(fi, 1); if (f.onLanded) f.onLanded(r.o); }
      } else {
        var rise = clamp(tt / 3.2, 0, 1), er = rise * rise * (3 - 2 * rise), away = Math.max(0, tt - 3.2), yy = 16 * er + away * away * 0.9, xx = f.x0 + away * away * 3.2;
        o.position.set(xx, FL + r.baseY + yy, f.z0 - away * away * 0.6); o.rotation.set(0, o.rotation.y, 0);
        if (tt < 4.5) { setDust(f.x0, FL, f.z0, 3 + tt * 1.6, Math.min(0.5, tt * 0.5) * (1 - clamp((tt - 2.8) / 1.7, 0, 1))); hasDust = true; }
        if (tt > 11) { o.visible = false; r.state = 'gone'; flights.splice(fi, 1); if (f.pd && f.pd.rec === r) f.pd.rec = null; var ix = ships.indexOf(r); if (ix >= 0) ships.splice(ix, 1); if (o.userData) o.userData._air = null; if (f.job && f.job.onState) { f.job.state = 'departed'; try { f.job.onState(f.job, o); } catch (e) { } } else if (f.job) f.job.state = 'departed'; }
      }
    }
    if (!hasDust) dustM.visible = false;
  }

  /* ---------- Planificador, demostración y API ---------- */
  var mode = 'working', ghost = false, origEm = {}, lastT = null, tickN = 0;
  shopDoors.forEach(function (d) { d.holds = 0; d.idleT = 9; });
  function lockFree() { for (var q4 = 0; q4 < jobs.length; q4++) if (jobs[q4].mv) return false; return true; }
  function tryStart(job) {
    var rec = job.rec, pd = rec.pad;
    if (job.phase !== 'queued' || !lockFree()) return;
    if (!pd || pd !== padW || (rec.state !== 'landed' && rec.state !== 'queued')) return;
    if (tugs[0].busy || tugs[1].busy || carState.occ || carState.busy || Math.abs(carState.x - XL) > 0.05) return;
    tugs[0].busy = true; tugs[1].busy = true;
    var cart = job.pilot ? carts[0] : null; if (cart && cart.busy) cart = null; if (cart) cart.busy = true; else job.boarded = true;
    job.cart = cart; job.mv = true; job.skip = false; job.phase = 'run'; job.run = buildRun(job);
  }
  function advance(job) { job.mv = false; job.phase = 'done'; }
  var dm = { step: 0, t: 0, ship: null, job: null };
  function demoTick(dt) {
    dm.t += dt;
    if (dm.step === 0) {
      if (!dm.ship) dm.ship = buildDemoShip();
      startLanding(dm.ship, { onLanded: function () { dm.step = 2; dm.t = 0; } }); dm.step = 1;
    } else if (dm.step === 2 && dm.t > 1.5) { dm.job = api.service(dm.ship, { pilot: true, repairSeconds: 24, autoTakeoff: true }); dm.step = 3; }
    else if (dm.step === 3 && dm.job.state === 'departed') { dm.step = 6; dm.t = 0; }
    else if (dm.step === 6 && dm.t > 4) dm.step = 0;
  }
  var entrance = new THREE.Object3D(); entrance.position.set(pilotDoor[0], y0 + 0.1, pilotDoor[1]); group.add(entrance);
  var landingRef = new THREE.Object3D(); landingRef.position.set(XPW, FL, 0); group.add(landingRef);
  var api = {
    group: group,
    footprint: { w: 2 * (XPE + 14), d: 74 },
    circular: false, radius: XPE + 14,
    entrance: entrance,                                  // puerta de la oficina
    input: new THREE.Object3D(),                         // energía
    output: new THREE.Object3D(),
    landing: landingRef,                                 // centro de la plataforma de aterrizaje (entrada, lado oeste)
    pad: { x: XPW, z: 0, r: PADR },                      // plataforma de aterrizaje
    padSalida: { x: XPE, z: 0, r: PADR },                // plataforma de salida (lado este): las naves reparadas despegan de aquí
    maxShip: { length: 11, width: 8.4 },
    bays: [shopBay],
    nivel: 1, taller: true, lineaDeMontaje: true,
    repairSeconds: opts.repairSeconds || 600,            // 10 minutos en total: 25% diagnóstico, 50% estructura, 25% pintura
    demo: true,
    getState: function () { return mode; },
    setState: function (s) { api.demo = false; mode = s; },
    setAccent: function (hex) { setAccentAll(hex); },
    getShips: function () { return ships.slice(); },
    land: function (ship, o) { return startLanding(ship, o); },
    service: function (ship, o) {
      o = o || {}; var rec = recOf(ship, o);
      if (rec.job && rec.job.phase !== 'done') return rec.job;
      var job = { type: 'service', rec: rec, phase: 'queued', repair: true, autoTakeoff: !!o.autoTakeoff, pilot: o.pilot !== false, rep: o.repairSeconds || api.repairSeconds, progress: 0, onState: o.onState, boarded: false, t: 0, state: 'queued', mv: false, skip: false };
      rec.job = job; jobs.push(job); notify(job, 'queued'); return job;
    },
    launch: function (ship, o) {                         // saltarse lo que falta de la reparación: la nave pasa directo a la salida
      var rec = ship.userData && ship.userData._air; if (!rec || !rec.job || rec.state !== 'repairing') return null;
      var job = rec.job; job.skip = true; job.cancelled = job.progress < 1; if (o && o.onState) job.onState = o.onState; if (o && o.autoTakeoff) job.autoTakeoff = true; return job;
    },
    free: function (ship) {
      var rec = ship.userData && ship.userData._air; if (!rec) return;
      var ix = ships.indexOf(rec); if (ix >= 0) ships.splice(ix, 1); ship.userData._air = null; if (rec.pad && rec.pad.rec === rec) rec.pad.rec = null;
      if (rec.parent0 && rec.parent0 !== ship.parent && rec.parent0.attach) rec.parent0.attach(ship);
    },
    setGhost: function (on, valid) {
      ghost = !!on;
      for (var key in mats) {
        var m = mats[key];
        if (m === mats.beam) continue;
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
      var dt = lastT == null ? 0 : clamp(t - lastT, 0, 0.1); lastT = t; tickN++;
      var on = mode !== 'off', run = on && mode !== 'broken' && !ghost, blink = Math.sin(t * (mode === 'alert' ? 8 : 2.4)) > 0, v, b, a2, c;
      if (run) {
        if (api.demo) demoTick(dt);
        stepFlights(dt);
        for (i = 0; i < jobs.length; i++) {
          var jb = jobs[i];
          if (jb.run) { if (jb.run(dt)) { jb.run = null; advance(jb); } }
          else if (jb.phase === 'queued') tryStart(jb);
        }
        for (i = jobs.length - 1; i >= 0; i--) if (jobs[i].phase === 'done') jobs.splice(i, 1);
      }
      var allV = carts.concat(tugs);
      for (i = 0; i < allV.length; i++) {
        v = allV[i];
        if (v.claw) { var dc = v.claw.t - v.claw.o; v.claw.o += Math.max(-1, Math.min(1, dc / 0.0001)) * Math.min(Math.abs(dc), dt * 1.8); v.claw.fL.rotation.y = -0.75 * v.claw.o; v.claw.fR.rotation.y = 0.75 * v.claw.o; }
        v.beacon.visible = on && v.busy && (Math.sin(t * 9 + i) > -0.2);
      }
      if (pilot.sit) {
        c = pilot.sit; var sn = Math.sin(c.yaw), cs = Math.cos(c.yaw);
        pilot.g.position.set(c.x + 0.05 * sn, c.g.position.y + 0.36, c.z + 0.05 * cs); pilot.g.rotation.y = c.yaw;
        pilot.lL.rotation.x = 1.3; pilot.lR.rotation.x = 1.3; pilot.aL.rotation.x = 0.7; pilot.aR.rotation.x = 0.7;
      } else {
        pilot.g.position.set(pilot.x, FL, pilot.z); pilot.g.rotation.y = pilot.yaw;
        var sw = pilot.walking && run ? Math.sin(t * 9) * 0.6 : 0;
        pilot.lL.rotation.x = sw; pilot.lR.rotation.x = -sw; pilot.aL.rotation.x = -sw; pilot.aR.rotation.x = sw;
      }
      // portones de la nave
      for (i = 0; i < shopDoors.length; i++) {
        b = shopDoors[i];
        if (b.holds > 0) b.idleT = 0; else b.idleT += dt;
        var tg = (b.holds > 0 || b.idleT < 1.5) && on ? 1 : 0, dd = tg - b.o;
        b.o += Math.max(-1, Math.min(1, dd * 100)) * Math.min(Math.abs(dd), dt * 0.4);
        var sc = Math.max(0.04, 1 - b.o); b.g.scale.y = sc; b.g.position.y = b.top - b.H * sc;
      }
      // línea de montaje: cada estación se activa mientras la nave está en ella
      for (i = 0; i < 3; i++) stage.k[i] += (((stage.cur === i && run) ? 1 : 0) - stage.k[i]) * Math.min(1, dt * 1.6);
      var k0 = stage.k[0], k1 = stage.k[1], k2 = stage.k[2];
      scan.position.x = XS[0] + k0 * 6.2 * Math.sin(t * 0.7); scanBeam.visible = k0 > 0.1 && (Math.floor(t * 14) % 5 !== 0); scanLine.visible = on && (k0 < 0.1 || blink);
      for (i = 0; i < arms.length; i++) {
        a2 = arms[i];
        a2.sh.rotation.z = -(0.12 + k1 * (0.7 + 0.3 * Math.sin(t * 1.4 + a2.ph))); a2.el.rotation.z = -(0.15 + k1 * (0.8 + 0.4 * Math.sin(t * 2.1 + a2.ph * 2)));
        a2.yaw.rotation.y = a2.base + k1 * 0.25 * Math.sin(t * 0.8 + a2.ph);
      }
      for (i = 0; i < sparks.length; i++) {
        var sp = sparks[i], f = (t * 1.3 + sp.ph) % 1, sa = k1 > 0.5 && run && f < 0.7 && Math.sin(t * 3 + sp.ph * 5) > -0.3;
        sp.m.visible = sa;
        if (sa) sp.m.position.set(XS[1] + Math.sin(sp.ph * 7) * 3.2 + Math.sin(sp.ph) * f, FL + 1.3 + (sp.ph % 1) * 1.4 + f * 0.8 - f * f * 1.6, Math.cos(sp.ph * 5) * 3.6);
      }
      paint.position.x = XS[2] + k2 * 5.0 * Math.sin(t * 0.9);
      for (i = 0; i < cones.length; i++) cones[i].visible = k2 > 0.5 && run && ((Math.floor(t * 9) + i) % 6 !== 0);
      dryM.visible = on && (k2 > 0.3 ? blink || mode !== 'alert' : mode !== 'alert');
      var cTarget = stage.cur >= 0 ? XS[stage.cur] : carState.x; crane.position.x += (cTarget - crane.position.x) * Math.min(1, dt * 0.7);
      cTr.position.z = Math.sin(t * 0.4) * 3.0 * k1; var cl = 1.6 + k1 * (1.3 + 0.8 * Math.sin(t * 0.6)); cCable.scale.y = cl; cCable.position.y = -0.35 - cl / 2; cHook.position.y = -0.7 - cl;
      for (i = 0; i < 3; i++) { var lm = stLamps[i]; lm.r.visible = on && !stage.done[i] && stage.cur !== i; lm.a.visible = on && stage.cur === i && (blink || mode !== 'alert'); lm.g.visible = on && !!stage.done[i]; }
      var nl = carState.occ ? Math.round(clamp(carState.occ.job ? carState.occ.job.progress : 0, 0, 1) * 10) : 0; for (i = 0; i < 10; i++) progLit[i].visible = on && i < nl;
      carBeacon.visible = on && (carState.busy || !!carState.occ) && (Math.sin(t * 9) > -0.2);
      // plataformas, luces, torre
      var fl = on && (mode !== 'broken' || Math.sin(t * 9) > -0.4), cph = (((Math.floor(t * 7)) % 4) + 4) % 4;
      for (i = 0; i < 2; i++) {
        padLW[i].visible = fl && (mode !== 'alert' || blink); padLG[i].visible = fl; padLR[i].visible = fl;
        for (j = 0; j < 4; j++) padLB[i][j].visible = fl && (mode === 'alert' ? blink : j === cph);
        for (k = 0; k < strobes[i].length; k++) strobes[i][k].visible = on && (mode === 'alert' ? blink : (Math.floor(t * 8) + k) % 6 === 0);
      }
      hallLM.visible = fl; lampM.visible = on; tmMesh.visible = fl;
      tradar.rotation.y += dt * (run ? (mode === 'alert' ? 3.2 : 1.1) : 0); tbeamG.rotation.y += dt * (run ? 1.6 : 0); tbeamG.visible = on;
      tradarB.rotation.y += dt * (run ? (mode === 'alert' ? 4.0 : 1.8) : 0);
      tbeacon.visible = on && blink;
      sockG.rotation.y = 0.5 * Math.sin(t * 0.07) + 0.15 * Math.sin(t * 0.4);
      sockD.rotation.z = -(0.2 + 0.25 * (0.5 + 0.5 * Math.sin(t * 0.5))) + 0.05 * Math.sin(t * 6);
      ydT.position.x = Math.sin(t * 0.15) * 4.0; ydT.position.z = Math.sin(t * 0.11 + 1) * 2.4; ydC.scale.y = 3.6; ydC.position.y = -0.35 - 1.8; ydH.position.y = -0.7 - 3.6;
      var shOn = mode === 'alert'; dome.visible = shOn; domeMat.opacity = shOn ? 0.06 + 0.04 * Math.sin(t * 3) : 0;
      mats.status.color.setHex(mode === 'working' ? 0x35ff7a : mode === 'alert' ? (blink ? 0xff3b30 : 0x301010) : mode === 'broken' ? 0xffa31a : 0x303030);
    }
  };
  stage.done = [false, false, false];
  var ip = [-70, y0 + 0.5, -30]; api.input.position.set(ip[0], ip[1], ip[2]); group.add(api.input);
  api.output.position.set(70, y0 + 0.5, -30); group.add(api.output);
  api.update(0);
  return api;
}
