/**
 * Refinería para Three.js, sin archivos externos (instalación grande para colocar en el planeta).
 *
 * Horno con chimenea y quemadores, columna de destilación (plataformas, escaleras, bocas de hombre, 3 salidas laterales
 * y línea de vapor), reactor y regenerador de craqueo catalítico con ventana de brasa, rack de tuberías de dos niveles con
 * luces de flujo, dos enfriadores con ventiladores giratorios y tambor de reflujo, tanque de crudo con escalera helicoidal,
 * 3 tanques de producto (diésel, gasolina, lubricante) y una esfera de gas licuado dentro de un dique, manifold y puerto
 * de salida, antorcha de gas con llama, cabina de control, subestación y un dron esférico con antena luminosa que patrulla.
 *
 * Uso:
 *   const ref = createRefineria(THREE, { accent: 0x2fa8ff });
 *   ref.group.position.set(x, groundY, z);        // la base de la losa está en y = 0
 *   scene.add(ref.group);
 *   ref.update(clock.getElapsedTime());
 *
 * Escala: 1 unidad = 4 m. Huella: 14 x 14 unidades (ref.footprint), centrada en el origen.
 * Entrada de crudo: ref.input (Object3D, borde -X). Salida de producto: ref.output (Object3D, borde +X).
 *
 * Estados (ref.setState): 'working' refina (baja el crudo, sube el producto, ventiladores, llama, vapor, luces en el rack),
 *   'starved' sin crudo (lámpara amarilla), 'full' producto lleno (lámpara roja), 'unload' vacía el producto por la salida,
 *   'broken' (lámpara naranja), 'off' (apagada). Por defecto corre un ciclo de demostración (ref.demo = true);
 *   setState lo desactiva y el control pasa a tu juego.
 * ref.setCrude(0..1) / getCrude(): nivel del tanque de crudo. ref.setProduct(0..1) / getProduct(): nivel de los tanques de producto.
 * ref.setGhost(true, valid): modo "fantasma" para colocar (verde si valid, rojo si valid === false); setGhost(false) lo quita.
 * ref.patrol = false deja el dron quieto sobre la cabina; ref.drone es su grupo. ref.setAccent(hex): color de pintura.
 * Compatible con Three.js r128 o superior.
 */
function createRefineria(THREE, opts) {
  opts = opts || {};
  var P = Math.PI, TAU = P * 2;
  var colors = {
    hull: opts.hull != null ? opts.hull : 0xd3d7dd,
    accent: opts.accent != null ? opts.accent : 0x2fa8ff,
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
  mats.pipeR = new THREE.MeshStandardMaterial({ color: 0xc2452f, metalness: 0.6, roughness: 0.4 });
  mats.pipeY = new THREE.MeshStandardMaterial({ color: 0xe6b422, metalness: 0.6, roughness: 0.4 });
  mats.pipeB = new THREE.MeshStandardMaterial({ color: 0x3a86d9, metalness: 0.6, roughness: 0.4 });
  mats.pipeG = new THREE.MeshStandardMaterial({ color: 0x3fae6a, metalness: 0.6, roughness: 0.4 });
  mats.tank = new THREE.MeshStandardMaterial({ color: 0xe4e8ee, metalness: 0.5, roughness: 0.3 });
  mats.bandGas = new THREE.MeshStandardMaterial({ color: 0xffd24a, metalness: 0.3, roughness: 0.5, side: THREE.DoubleSide });
  mats.bandDie = new THREE.MeshStandardMaterial({ color: 0xd9603b, metalness: 0.3, roughness: 0.5, side: THREE.DoubleSide });
  mats.bandLub = new THREE.MeshStandardMaterial({ color: 0x4aa3ff, metalness: 0.3, roughness: 0.5, side: THREE.DoubleSide });
  mats.sight = new THREE.MeshStandardMaterial({ color: 0x9fd6ff, metalness: 0.1, roughness: 0.05, transparent: true, opacity: 0.35 });
  mats.dust = glowMat(0xc9b08a, 0.0);
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
  function strut(a, b, r, mat) {
    var m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 1, 8), mat);
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
  var SLAB = 0.4, k, j, i;

  /* ---------- Losa 14 x 14, franjas y detalles de piso ---------- */
  add(group, roundedBox(14, SLAB, 14, 0.08, 3), mats.slab, 0, SLAB / 2, 0);
  var stA = [], stB = [], seams = [], stains = [];
  for (k = 0; k < 28; k++) {
    var pos = -6.75 + k * 0.5, tgt = k % 2 ? stA : stB;
    tgt.push({ x: pos, y: SLAB + 0.01, z: 6.85, sx: 0.5, sy: 0.02, sz: 0.3 });
    tgt.push({ x: pos, y: SLAB + 0.01, z: -6.85, sx: 0.5, sy: 0.02, sz: 0.3 });
    tgt.push({ x: 6.85, y: SLAB + 0.01, z: pos, sx: 0.3, sy: 0.02, sz: 0.5 });
    tgt.push({ x: -6.85, y: SLAB + 0.01, z: pos, sx: 0.3, sy: 0.02, sz: 0.5 });
  }
  group.add(boxField(UB, mats.accent, stA));
  group.add(boxField(UB, mats.dark, stB));
  [-4.5, -1.5, 1.5, 4.5].forEach(function (v) {
    seams.push({ x: 0, y: SLAB + 0.006, z: v, sx: 13.7, sy: 0.012, sz: 0.035 });
    seams.push({ x: v, y: SLAB + 0.006, z: 0, sx: 0.035, sy: 0.012, sz: 13.7 });
  });
  group.add(boxField(UB, mats.dark, seams));
  for (k = 0; k < 26; k++) stains.push({ x: (rnd() - 0.5) * 13, y: SLAB + 0.004, z: (rnd() - 0.5) * 13, ry: rnd() * 3, sx: 0.4 + rnd() * 1.3, sy: 0.008, sz: 0.3 + rnd() * 1.0 });
  group.add(boxField(UB, mats.trim, stains));

  /* ---------- Horno con chimenea ---------- */
  var FX = -5.2, FZ = -4.8;
  cyl(1.25, 0.3, 'y', mats.plate, FX, SLAB + 0.15, FZ, 28);
  cyl(1.05, 3.0, 'y', mats.hull, FX, 2.2, FZ, 32);
  [1.2, 2.2, 3.2].forEach(function (y) { add(group, new THREE.TorusGeometry(1.06, 0.045, 8, 32).rotateX(P / 2), mats.accent, FX, y, FZ); });
  var cone = new THREE.ConeGeometry(1.05, 0.8, 32); add(group, cone, mats.hull2, FX, 4.1, FZ);
  var burners = [];
  for (k = 0; k < 6; k++) {
    var ba = k / 6 * TAU + 0.3, bx = FX + Math.cos(ba) * 1.05, bz = FZ + Math.sin(ba) * 1.05;
    var bn = new THREE.CylinderGeometry(0.14, 0.17, 0.35, 12); bn.rotateZ(P / 2);
    var bm = add(group, bn, mats.dark, bx + Math.cos(ba) * 0.1, 1.0, bz + Math.sin(ba) * 0.1);
    bm.rotation.y = -ba;
    var bg = add(group, new THREE.SphereGeometry(0.15, 10, 8), glowMat(0xff7a1f, 0.8), bx + Math.cos(ba) * 0.3, 1.0, bz + Math.sin(ba) * 0.3);
    burners.push(bg);
    if (k % 2 === 0) { var win = add(group, new THREE.BoxGeometry(0.34, 0.22, 0.04), glowMat(0xff8a2a, 0.85), FX + Math.cos(ba + 0.5) * 1.07, 2.2, FZ + Math.sin(ba + 0.5) * 1.07); win.rotation.y = -(ba + 0.5) + P / 2; burners.push(win); }
  }
  var stackF = new THREE.CylinderGeometry(0.3, 0.42, 5.0, 20);
  add(group, stackF, mats.hull2, FX, 6.7, FZ);
  [5.4, 7.2, 8.6].forEach(function (y, q) { add(group, new THREE.TorusGeometry(0.34 + (9.2 - y) * 0.02, 0.04, 8, 20).rotateX(P / 2), mats.accent, FX, y, FZ); });
  ringPlat(FX, 7.4, FZ, 0.35, 0.85, 10);
  add(group, new THREE.CylinderGeometry(0.34, 0.3, 0.2, 16), mats.dark, FX, 9.25, FZ);
  ladderV(FX, FZ - 1.2, 0.5, 4.0, 'z', 1.0);
  ladderV(FX, FZ - 0.9, 4.0, 7.3, 'z', 0.6);
  // línea de crudo desde el tanque y salida hacia la columna
  pipeRun([[-5.0, 0.95, 0.4], [-5.0, 0.95, -3.8]], 0.11, mats.pipe);
  valve(-5.0, 0.95, -1.0, false);
  add(group, roundedBox(0.7, 0.5, 0.5, 0.08, 2), mats.hull, -5.5, 0.65, -2.4);
  var pumpFly = add(group, new THREE.CylinderGeometry(0.2, 0.2, 0.06, 14).rotateZ(P / 2), mats.accent, -5.17, 0.65, -2.4);
  strut([-4.15, 2.2, FZ], [-3.6, 2.2, FZ], 0.13, mats.pipe);

  /* ---------- Columna de destilación ---------- */
  var MXc = -2.4, MZc = -4.8;
  cyl(1.35, 0.7, 'y', mats.plate, MXc, 0.75, MZc, 28);
  cyl(1.2, 3.0, 'y', mats.hull2, MXc, 2.6, MZc, 32);
  cyl(1.1, 3.4, 'y', mats.hull2, MXc, 5.7, MZc, 32);
  add(group, new THREE.CylinderGeometry(0.95, 1.1, 0.4, 32), mats.hull2, MXc, 7.6, MZc);
  cyl(0.95, 2.6, 'y', mats.hull2, MXc, 9.1, MZc, 32);
  add(group, new THREE.SphereGeometry(0.95, 28, 14, 0, TAU, 0, P / 2), mats.hull2, MXc, 10.4, MZc);
  [1.1, 4.1, 7.4, 10.4].forEach(function (y, q) { add(group, new THREE.TorusGeometry((y > 7 ? 0.97 : y > 4 ? 1.12 : 1.22) + 0.02, 0.05, 8, 32).rotateX(P / 2), mats.accent, MXc, y, MZc); });
  for (k = 0; k < 9; k++) { var wy = 1.6 + k * 1.0; if (Math.abs(wy - 4.1) < 0.2 || Math.abs(wy - 7.4) < 0.2) continue; add(group, new THREE.TorusGeometry((wy > 7.4 ? 0.95 : wy > 4.1 ? 1.1 : 1.2) + 0.012, 0.018, 6, 32).rotateX(P / 2), mats.trim, MXc, wy, MZc); }
  [[4.0, 1.2, 1.45], [7.2, 1.1, 1.45], [10.0, 0.95, 1.4]].forEach(function (p) { ringPlat(MXc, p[0], MZc, p[1] - 0.03, p[2], 14); });
  ladderV(MXc, MZc - 1.45, 0.5, 4.0, 'z', 0.3);
  ladderV(MXc, MZc - 1.45, 4.0, 7.2, 'z', 0.35);
  ladderV(MXc, MZc - 1.4, 7.2, 10.0, 'z', 0.45);
  [[3.0, 1.35, 0.4], [6.0, 1.2, -0.6], [8.6, 1.1, 0.9]].forEach(function (h) {      // bocas de hombre
    var ang = h[2];
    var mh = add(group, new THREE.CylinderGeometry(0.22, 0.22, 0.3, 16), mats.plate, MXc + Math.cos(ang) * (h[1] * 0.85 + 0.12), h[0], MZc + Math.sin(ang) * (h[1] * 0.85 + 0.12));
    mh.rotation.set(Math.sin(ang) * P / 2, 0, -Math.cos(ang) * P / 2);
  });
  var risers = [[1.62, 3.4], [1.84, 6.8], [2.06, 9.4]];
  var rpm = [mats.pipeR, mats.pipeY, mats.pipeB], rz = [-1.8, -1.45, -1.1];
  risers.forEach(function (rs, q) {
    var xi = MXc + rs[0], yn = rs[1], rShell = yn > 7.4 ? 0.95 : yn > 4.1 ? 1.1 : 1.2;
    pipeRun([[MXc + rShell - 0.05, yn, MZc], [xi, yn, MZc], [xi, 1.6, MZc], [xi, 1.6, rz[q]], [xi, 3.0, rz[q]]], 0.09, rpm[q]);
    valve(xi, 1.6, -3.2, false);
  });
  // línea de vapor superior -> baja en x=-0.1 -> ramal hacia los enfriadores
  pipeRun([[MXc, 11.3, MZc], [MXc, 11.8, MZc], [-0.1, 11.8, MZc], [-0.1, 11.8, -2.85], [-0.1, 0.55, -2.85]], 0.12, mats.pipe);
  pipeRun([[-0.1, 6.0, -2.85], [-0.1, 6.0, 1.7], [-0.1, 5.82, 1.7]], 0.1, mats.pipe);
  add(group, roundedBox(0.4, 0.15, 0.4, 0.04, 2), mats.plate, -0.1, 0.48, -2.85);
  [[-0.1, 3.0, -2.85], [-0.1, 9.0, -2.85]].forEach(function (g) { cyl(0.15, 0.05, 'x', mats.window, g[0] + 0.14, g[1], g[2], 12); });
  strut([-0.1, 6.0, 0.4], [-0.1, SLAB, 0.4], 0.05, mats.trim);

  /* ---------- Reactor y regenerador (craqueo catalítico) ---------- */
  var RX = 0.8, RX2 = 2.8, RZ = -4.8;
  cyl(0.95, 0.6, 'y', mats.plate, RX, 0.7, RZ, 24);
  cyl(0.85, 3.4, 'y', mats.hull, RX, 2.7, RZ, 28);
  add(group, new THREE.SphereGeometry(0.85, 24, 12, 0, TAU, 0, P / 2), mats.hull, RX, 4.4, RZ);
  cyl(0.8, 0.6, 'y', mats.plate, RX2, 0.7, RZ, 24);
  cyl(0.75, 4.6, 'y', mats.hull2, RX2, 3.3, RZ, 28);
  add(group, new THREE.SphereGeometry(0.75, 24, 12, 0, TAU, 0, P / 2), mats.hull2, RX2, 5.6, RZ);
  [1.0, 2.5, 4.4].forEach(function (y) { add(group, new THREE.TorusGeometry(0.87, 0.045, 8, 28).rotateX(P / 2), mats.accent, RX, y, RZ); });
  [1.0, 3.0, 5.6].forEach(function (y) { add(group, new THREE.TorusGeometry(0.77, 0.045, 8, 28).rotateX(P / 2), mats.accent, RX2, y, RZ); });
  [-0.3, 0.3].forEach(function (d) { cyl(0.14, 1.0, 'y', mats.pipe, RX + d, 5.3, RZ, 10); add(group, new THREE.SphereGeometry(0.14, 10, 8), mats.pipe, RX + d, 5.8, RZ); });
  cyl(0.2, 1.0, 'y', mats.pipe, RX2, 6.4, RZ, 12);
  pipeRun([[RX + 0.8, 3.2, RZ], [RX2 - 0.7, 3.2, RZ]], 0.18, mats.pipeR);
  pipeRun([[RX + 0.8, 1.9, RZ], [RX2 - 0.7, 1.9, RZ]], 0.18, mats.pipeR);
  add(group, roundedBox(0.4, 0.4, 0.4, 0.06, 2), mats.hull2, (RX + RX2) / 2, 3.2, RZ);
  add(group, roundedBox(0.4, 0.4, 0.4, 0.06, 2), mats.hull2, (RX + RX2) / 2, 1.9, RZ);
  ringPlat(RX, 3.7, RZ, 0.82, 1.4, 12);
  ringPlat(RX2, 4.9, RZ, 0.72, 1.3, 12);
  ladderV(RX, RZ - 1.45, 0.5, 3.7, 'z', 0.55);
  ladderV(RX2, RZ - 1.35, 0.5, 4.9, 'z', 0.5);
  var rGlow = add(group, new THREE.CircleGeometry(0.22, 16), glowMat(0xff4a1f, 0.85), RX, 2.4, RZ + 0.87);
  var rFrame = add(group, new THREE.TorusGeometry(0.24, 0.035, 6, 16), mats.dark, RX, 2.4, RZ + 0.86);
  pipeRun([[RX, 1.5, RZ + 0.8], [RX, 1.5, -2.0], [RX, 3.0, -1.1 - 0.0 * 1]], 0.09, mats.pipeG);

  /* ---------- Rack de tuberías ---------- */
  var RACKX0 = -6.2, RACKX1 = 6.0;
  var lowZ = [-1.8, -1.45, -1.1, -0.75, -0.4], upZ = [-1.65, -1.3, -0.95, -0.6];
  var lowM = [mats.pipeR, mats.pipeY, mats.pipeB, mats.pipeG, mats.pipe], upM = [mats.pipe, mats.pipeG, mats.pipeY, mats.pipeR];
  var rackLines = [];
  lowZ.forEach(function (z, q) {
    strut([RACKX0, 3.0, z], [RACKX1, 3.0, z], q < 2 ? 0.11 : 0.09, lowM[q]);
    cyl(0.13, 0.08, 'x', mats.plate, RACKX0, 3.0, z, 12); cyl(0.13, 0.08, 'x', mats.plate, RACKX1, 3.0, z, 12);
    rackLines.push([3.0, z]);
  });
  upZ.forEach(function (z, q) {
    strut([RACKX0, 3.8, z], [RACKX1 - 0.1, 3.8, z], 0.09, upM[q]);
    cyl(0.12, 0.08, 'x', mats.plate, RACKX0, 3.8, z, 12); cyl(0.12, 0.08, 'x', mats.plate, RACKX1 - 0.1, 3.8, z, 12);
    rackLines.push([3.8, z]);
  });
  [-6.0, -3.7, -1.6, 0.9, 3.4, 6.1].forEach(function (px) {
    [-2.05, -0.1].forEach(function (pz) {
      strut([px, SLAB, pz], [px, 3.95, pz], 0.07, mats.accent);
      add(group, roundedBox(0.4, 0.06, 0.4, 0.02, 1), mats.plate, px, SLAB + 0.03, pz);
    });
    add(group, new THREE.BoxGeometry(0.12, 0.1, 2.1), mats.hull2, px, 2.85, -1.075);
    add(group, new THREE.BoxGeometry(0.12, 0.1, 2.1), mats.hull2, px, 3.65, -1.075);
    add(group, new THREE.BoxGeometry(0.12, 0.1, 2.1), mats.accent, px, 3.95, -1.075);
    strut([px, 2.0, -2.05], [px, 3.0, -0.1], 0.025, mats.hull2);
  });
  // luces de flujo que corren por las tuberías
  var flowN = 40, flowMesh = new THREE.InstancedMesh(UB, glowMat(0x7dffd0, 0.9), flowN);
  flowMesh.frustumCulled = false;
  group.add(flowMesh);
  var tmp = new THREE.Object3D(), flowOff = 0;
  function placeFlow() {
    var n = 0;
    for (var q = 0; q < rackLines.length && n < flowN; q++) for (var w = 0; w < 4 && n < flowN; w++, n++) {
      var s = (((w / 4) + flowOff + q * 0.13) % 1);
      tmp.position.set(RACKX0 + 0.4 + s * (RACKX1 - RACKX0 - 0.8), rackLines[q][0] + 0.115, rackLines[q][1]);
      tmp.scale.set(0.25, 0.04, 0.07); tmp.rotation.set(0, 0, 0); tmp.updateMatrix();
      flowMesh.setMatrixAt(n, tmp.matrix);
    }
    flowMesh.instanceMatrix.needsUpdate = true;
  }

  /* ---------- Enfriadores con ventiladores ---------- */
  var fans = [];
  [0.0, 2.0].forEach(function (cx) {
    var cz = 1.7;
    add(group, roundedBox(1.9, 0.5, 1.6, 0.08, 2), mats.hull2, cx, 5.6, cz);
    add(group, new THREE.BoxGeometry(2.0, 0.12, 0.3), mats.accent, cx, 5.28, cz - 0.7);
    add(group, new THREE.BoxGeometry(2.0, 0.12, 0.3), mats.accent, cx, 5.28, cz + 0.7);
    var ring = new THREE.CylinderGeometry(0.62, 0.62, 0.28, 24, 1, true); add(group, ring, mats.plate, cx, 5.98, cz);
    var fg = new THREE.Group(); fg.position.set(cx, 5.95, cz); group.add(fg);
    for (k = 0; k < 4; k++) { var bl = add(fg, new THREE.BoxGeometry(0.55, 0.03, 0.15), mats.dark, 0.3, 0, 0); var pv = new THREE.Group(); pv.rotation.y = k * P / 2; fg.add(pv); pv.add(bl); bl.rotation.z = 0.2; }
    add(fg, new THREE.CylinderGeometry(0.1, 0.1, 0.12, 12), mats.accent, 0, 0, 0);
    [0.18, 0.4].forEach(function (rr) { var grd = new THREE.TorusGeometry(rr * 1.5, 0.012, 4, 20); grd.rotateX(P / 2); add(group, grd, mats.trim, cx, 6.12, cz); });
    strut([cx - 0.62, 6.12, cz], [cx + 0.62, 6.12, cz], 0.012, mats.trim);
    strut([cx, 6.12, cz - 0.62], [cx, 6.12, cz + 0.62], 0.012, mats.trim);
    fans.push(fg);
    [[-0.95, -0.8], [0.95, -0.8], [-0.95, 0.8], [0.95, 0.8]].forEach(function (c) { strut([cx + c[0], SLAB, cz + c[1]], [cx + c[0], 5.35, cz + c[1]], 0.07, mats.accent); });
    strut([cx - 0.95, SLAB, cz - 0.8], [cx + 0.95, 5.0, cz - 0.8], 0.03, mats.hull2);
    strut([cx + 0.95, SLAB, cz - 0.8], [cx - 0.95, 5.0, cz - 0.8], 0.03, mats.hull2);
  });
  // condensador -> tambor de reflujo
  pipeRun([[1.0, 5.2, 2.5], [1.0, 5.2, 3.5], [1.0, 1.5, 3.5]], 0.1, mats.pipeB);
  cyl(0.5, 2.2, 'x', mats.hull2, 1.0, SLAB + 0.55, 3.5, 22);
  add(group, new THREE.SphereGeometry(0.5, 16, 12), mats.hull2, -0.1, SLAB + 0.55, 3.5);
  add(group, new THREE.SphereGeometry(0.5, 16, 12), mats.hull2, 2.1, SLAB + 0.55, 3.5);
  [-0.1, 2.1].forEach(function (sx) { add(group, roundedBox(0.2, 0.3, 0.9, 0.04, 2), mats.plate, sx, SLAB + 0.15, 3.5); });
  cyl(0.52, 0.1, 'x', mats.accent, 1.0, SLAB + 0.55, 3.5, 22);

  /* ---------- Tanque de crudo con escalera helicoidal ---------- */
  var CX0 = -5.0, CZ0 = 2.4, CR0 = 1.5, CH0 = 3.0;
  cyl(CR0 + 0.12, 0.2, 'y', mats.plate, CX0, SLAB + 0.1, CZ0, 32);
  cyl(CR0, CH0, 'y', mats.tank, CX0, SLAB + CH0 / 2, CZ0, 36);
  [0.75, 1.5, 2.25, 3.0].forEach(function (h) { add(group, new THREE.TorusGeometry(CR0 + 0.01, 0.03, 6, 36).rotateX(P / 2), mats.hull2, CX0, SLAB + h, CZ0); });
  add(group, new THREE.CylinderGeometry(CR0 + 0.012, CR0 + 0.012, 0.5, 36, 1, true), mats.bandLub, CX0, SLAB + 1.5, CZ0);
  add(group, new THREE.ConeGeometry(CR0 + 0.05, 0.5, 36), mats.hull2, CX0, SLAB + CH0 + 0.25, CZ0);
  add(group, new THREE.CylinderGeometry(0.22, 0.22, 0.25, 14), mats.plate, CX0, SLAB + CH0 + 0.55, CZ0);
  ringPlat(CX0, SLAB + CH0, CZ0, CR0 - 0.05, CR0 + 0.35, 14);
  var stairPts = [];
  for (k = 0; k <= 16; k++) { var sa = (200 + k * 20) * P / 180; stairPts.push([CX0 + Math.cos(sa) * (CR0 + 0.38), SLAB + 0.05 + k * (CH0 - 0.05) / 16, CZ0 + Math.sin(sa) * (CR0 + 0.38)]); }
  var treads = [];
  for (k = 0; k < stairPts.length - 1; k++) {
    strut(stairPts[k], stairPts[k + 1], 0.035, mats.trim);
    strut([stairPts[k][0], stairPts[k][1] + 0.95, stairPts[k][2]], [stairPts[k + 1][0], stairPts[k + 1][1] + 0.95, stairPts[k + 1][2]], 0.02, mats.accent);
    strut(stairPts[k], [stairPts[k][0], stairPts[k][1] + 0.95, stairPts[k][2]], 0.015, mats.accent);
    var tcx = (stairPts[k][0] + stairPts[k + 1][0]) / 2, tcz = (stairPts[k][2] + stairPts[k + 1][2]) / 2;
    var tdir = Math.atan2(stairPts[k + 1][0] - stairPts[k][0], stairPts[k + 1][2] - stairPts[k][2]);
    treads.push({ x: tcx, y: (stairPts[k][1] + stairPts[k + 1][1]) / 2 + 0.02, z: tcz, ry: tdir, sx: 0.5, sy: 0.04, sz: 0.4 });
  }
  group.add(boxField(UB, mats.trim, treads));
  // línea de entrada (puerto de crudo) y nivel
  pipeRun([[CX0 - CR0, 0.95, CZ0], [-7.1, 0.95, CZ0]], 0.12, mats.pipe);
  cyl(0.2, 0.1, 'x', mats.plate, -7.15, 0.95, CZ0, 16);
  valve(-6.8, 0.95, CZ0, true);
  var inPort = new THREE.Object3D(); inPort.position.set(-7.3, 0.95, CZ0); group.add(inPort);
  pipeRun([[CX0, 0.95, CZ0 - CR0], [CX0, 0.95, 0.4]], 0.11, mats.pipe);
  cyl(0.07, 2.4, 'y', mats.sight, CX0 + CR0 + 0.35, SLAB + 1.6, CZ0 - 0.9, 12);
  var gCrude = add(group, new THREE.BoxGeometry(0.07, 1, 0.07), mats.status, CX0 + CR0 + 0.35, SLAB + 0.4, CZ0 - 0.9);
  [0.55, 2.55].forEach(function (gy) { strut([CX0 + Math.sqrt(CR0 * CR0 - 0.81) - 0.05, SLAB + gy, CZ0 - 0.9], [CX0 + CR0 + 0.35, SLAB + gy, CZ0 - 0.9], 0.03, mats.pipe); });

  /* ---------- Tanques de producto con dique ---------- */
  var gaugesP = [];
  function productTank(tx, tz, r, h, band) {
    cyl(r + 0.1, 0.16, 'y', mats.plate, tx, SLAB + 0.08, tz, 28);
    cyl(r, h, 'y', mats.tank, tx, SLAB + h / 2, tz, 32);
    for (var q = 1; q <= 3; q++) add(group, new THREE.TorusGeometry(r + 0.01, 0.03, 6, 32).rotateX(P / 2), mats.hull2, tx, SLAB + q * h / 3.2, tz);
    add(group, new THREE.CylinderGeometry(r + 0.012, r + 0.012, 0.45, 32, 1, true), band, tx, SLAB + h * 0.55, tz);
    add(group, new THREE.ConeGeometry(r + 0.04, 0.4, 32), mats.hull2, tx, SLAB + h + 0.2, tz);
    add(group, new THREE.CylinderGeometry(0.16, 0.16, 0.2, 12), mats.plate, tx, SLAB + h + 0.45, tz);
    cyl(0.06, h * 0.8, 'y', mats.sight, tx + r + 0.3, SLAB + h * 0.45, tz, 10);
    var lv = add(group, new THREE.BoxGeometry(0.06, 1, 0.06), mats.status, tx + r + 0.3, SLAB + 0.3, tz);
    [0.15, h * 0.85].forEach(function (gy) { strut([tx + r - 0.02, SLAB + gy, tz], [tx + r + 0.3, SLAB + gy, tz], 0.025, mats.pipe); });
    gaugesP.push({ m: lv, h: h * 0.8, y0: SLAB + 0.05 });
    // escalera lateral corta
    var rungs = [];
    [-0.17, 0.17].forEach(function (d) { strut([tx - r - 0.2, SLAB, tz + d], [tx - r - 0.2, SLAB + h + 0.2, tz + d], 0.022, mats.trim); });
    for (var y = SLAB + 0.4; y < SLAB + h; y += 0.32) rungs.push({ x: tx - r - 0.2, y: y, z: tz, sx: 0.035, sy: 0.035, sz: 0.34 });
    group.add(boxField(UB, mats.trim, rungs));
    strut([tx - r - 0.2, SLAB + h * 0.5, tz - 0.17], [tx - r, SLAB + h * 0.5, tz - 0.17], 0.02, mats.trim);
    strut([tx - r - 0.2, SLAB + h * 0.5, tz + 0.17], [tx - r, SLAB + h * 0.5, tz + 0.17], 0.02, mats.trim);
  }
  productTank(5.2, 0.4, 1.0, 2.4, mats.bandDie);
  productTank(5.2, 3.0, 1.0, 2.4, mats.bandGas);
  productTank(-2.2, 4.6, 0.8, 2.2, mats.bandLub);
  var SPX = 5.2, SPZ = 5.5, SPR = 0.85, SPY = 2.05;                     // esfera de gas licuado
  add(group, new THREE.SphereGeometry(SPR, 28, 20), mats.tank, SPX, SPY, SPZ);
  add(group, new THREE.TorusGeometry(SPR, 0.025, 6, 30).rotateX(P / 2), mats.accent, SPX, SPY, SPZ);
  for (k = 0; k < 6; k++) {
    var la = (30 + 60 * k) * P / 180;
    strut([SPX + 1.0 * Math.cos(la), SLAB, SPZ + 1.0 * Math.sin(la)], [SPX + Math.sin(1.9) * SPR * Math.cos(la) * 0.98, SPY + Math.cos(1.9) * SPR, SPZ + Math.sin(1.9) * SPR * Math.sin(la) * 0.98], 0.06, mats.accent);
    add(group, roundedBox(0.25, 0.07, 0.25, 0.02, 1), mats.plate, SPX + 1.0 * Math.cos(la), SLAB + 0.035, SPZ + 1.0 * Math.sin(la));
  }
  cyl(0.4, 0.05, 'y', mats.trim, SPX, SPY + SPR + 0.03, SPZ, 16);
  // dique de contención
  [[5.25, -1.0, 3.1, 0.12, 0.35, 0.12], [5.25, 6.5, 3.1, 0.12, 0.35, 0.12]].forEach(function () {});
  add(group, new THREE.BoxGeometry(3.1, 0.35, 0.12), mats.slab, 5.25, SLAB + 0.175, -1.1);
  add(group, new THREE.BoxGeometry(3.1, 0.35, 0.12), mats.slab, 5.25, SLAB + 0.175, 6.5);
  add(group, new THREE.BoxGeometry(0.12, 0.35, 7.6), mats.slab, 3.7, SLAB + 0.175, 2.7);
  add(group, new THREE.BoxGeometry(0.12, 0.35, 7.6), mats.slab, 6.8, SLAB + 0.175, 2.7);
  // manifold de salida y puerto de producto
  var MFX = 6.45;
  [0.4, 3.0].forEach(function (tz) { pipeRun([[6.2, 0.95, tz], [MFX, 0.95, tz]], 0.1, mats.pipeY); });
  pipeRun([[5.2, SPY - SPR, SPZ], [5.2, 0.95, SPZ], [MFX, 0.95, SPZ]], 0.09, mats.pipeY);
  strut([MFX, 0.95, 0.4], [MFX, 0.95, SPZ], 0.1, mats.pipeY);
  [[1.5], [4.2]].forEach(function (z) { valve(MFX, 0.95, z[0], false); });
  pipeRun([[MFX, 0.95, 2.0], [7.05, 0.95, 2.0]], 0.11, mats.pipeY);
  cyl(0.2, 0.1, 'x', mats.plate, 7.1, 0.95, 2.0, 16);
  var outPort = new THREE.Object3D(); outPort.position.set(7.3, 0.95, 2.0); group.add(outPort);
  add(group, roundedBox(0.5, 0.5, 0.7, 0.08, 2), mats.hull, 6.9, 0.65, 3.2);
  var pumpFly2 = add(group, new THREE.CylinderGeometry(0.2, 0.2, 0.06, 14).rotateX(P / 2), mats.accent, 6.9, 0.65, 2.78);
  // ramales del rack hacia los tanques
  pipeRun([[5.2, 3.0, -0.4], [5.2, 3.0, 0.4], [5.2, 2.85, 0.4]], 0.09, mats.pipe);
  pipeRun([[5.2, 3.8, -0.6], [5.2, 3.8, 3.0], [5.2, 3.2, 3.0]], 0.09, mats.pipeR);
  pipeRun([[5.7, 3.8, -0.6], [5.7, 3.8, SPZ], [SPX, 3.8, SPZ], [SPX, SPY + SPR + 0.05, SPZ]], 0.09, mats.pipeY);
  [[5.2, 1.7], [5.7, 1.7]].forEach(function (pp) { strut([pp[0], SLAB, pp[1]], [pp[0], 3.75, pp[1]], 0.05, mats.accent); });
  strut([5.2, 3.75, 1.7], [5.7, 3.75, 1.7], 0.05, mats.hull2);

  /* ---------- Antorcha ---------- */
  var AXs = 6.2, AZs = -6.0;
  cyl(0.45, 0.12, 'y', mats.plate, AXs, SLAB + 0.06, AZs, 20);
  add(group, new THREE.CylinderGeometry(0.1, 0.2, 9.0, 14), mats.hull2, AXs, SLAB + 4.5, AZs);
  [2.5, 5.0, 7.5].forEach(function (y) { add(group, new THREE.TorusGeometry(0.2 - (y / 9.4) * 0.1 + 0.02, 0.03, 6, 16).rotateX(P / 2), mats.accent, AXs, y, AZs); });
  add(group, new THREE.CylinderGeometry(0.2, 0.1, 0.4, 14), mats.dark, AXs, SLAB + 9.1, AZs);
  [[AXs - 3.0, AZs + 3.2], [AXs + 0.5, AZs + 4.8], [AXs - 0.5, AZs - 0.9]].forEach(function (an) {
    strut([AXs, 7.4, AZs], [an[0], SLAB + 0.05, an[1]], 0.012, mats.dark);
    add(group, roundedBox(0.25, 0.1, 0.25, 0.03, 1), mats.trim, an[0], SLAB + 0.05, an[1]);
  });
  pipeRun([[5.9, 3.8, -0.6]], 0.09, mats.pipeR);
  var flame = new THREE.Group(); flame.position.set(AXs, SLAB + 9.3, AZs); group.add(flame);
  var fo = new THREE.ConeGeometry(0.3, 1.8, 14, 1, true); fo.translate(0, 0.9, 0);
  var fi = new THREE.ConeGeometry(0.17, 1.1, 12, 1, true); fi.translate(0, 0.55, 0);
  var flameO = add(flame, fo, glowMat(0xff7a1f, 0.65), 0, 0, 0), flameI = add(flame, fi, glowMat(0xffe27a, 0.85), 0, 0, 0);
  var flameHalo = add(flame, new THREE.SphereGeometry(0.7, 14, 10), glowMat(0xff9a40, 0.18), 0, 0.7, 0);
  strut([AXs - 0.3, 0.95, AZs + 0.0], [-0.1, 0.95, -2.85], 0.0001, mats.pipe).visible = false;

  /* ---------- Cabina de control ---------- */
  var KX = 0.5, KZ = 5.4;
  add(group, roundedBox(2.4, 1.9, 2.4, 0.25, 3), mats.hull, KX, SLAB + 0.95, KZ);
  add(group, roundedBox(2.6, 0.18, 2.6, 0.06, 2), mats.plate, KX, SLAB + 1.95, KZ);
  add(group, new THREE.BoxGeometry(2.42, 0.2, 0.06), mats.accent, KX, SLAB + 1.55, KZ + 1.23);
  add(group, roundedBox(1.7, 0.7, 0.08, 0.03, 2), mats.glass, KX, SLAB + 1.2, KZ + 1.22);
  add(group, roundedBox(0.7, 1.2, 0.08, 0.03, 2), mats.dark, KX + 0.7, SLAB + 0.65, KZ - 1.22);
  add(group, new THREE.BoxGeometry(1.4, 0.5, 0.04), mats.glass, KX, SLAB + 1.2, KZ - 1.22 + 0.0).position.z = KZ - 1.23;
  add(group, new THREE.BoxGeometry(0.04, 0.5, 1.4), mats.glass, KX + 1.22, SLAB + 1.2, KZ);
  add(group, new THREE.BoxGeometry(0.04, 0.5, 1.4), mats.glass, KX - 1.22, SLAB + 1.2, KZ);
  add(group, roundedBox(1.0, 0.3, 0.7, 0.04, 2), mats.plate, KX + 0.7, SLAB + 0.15, KZ - 1.65);
  [-0.4, 0.4].forEach(function (dx) { strut([KX + 0.7 + dx, SLAB + 0.3, KZ - 1.95], [KX + 0.7 + dx, SLAB + 1.0, KZ - 1.95], 0.025, mats.accent); });
  strut([KX + 0.3, SLAB + 1.0, KZ - 1.95], [KX + 1.1, SLAB + 1.0, KZ - 1.95], 0.025, mats.accent);
  add(group, roundedBox(0.8, 0.35, 0.8, 0.08, 2), mats.hull2, KX - 0.7, SLAB + 2.2, KZ + 0.6);
  var sol = add(group, new THREE.BoxGeometry(1.5, 0.05, 1.0), mats.glass, KX + 0.3, SLAB + 2.5, KZ - 0.6);
  sol.rotation.x = -0.3;
  [[-0.3, -1.1, 2.43], [1.1, -1.1, 2.43], [-0.3, -0.25, 2.62], [1.1, -0.25, 2.62]].forEach(function (p) { strut([KX + p[0], SLAB + 2.04, KZ + p[1] + 0.2], [KX + p[0], SLAB + p[2], KZ + p[1] + 0.2], 0.025, mats.trim); });
  add(group, new THREE.CylinderGeometry(0.03, 0.03, 1.6, 6), mats.trim, KX - 0.9, SLAB + 2.82, KZ - 0.5);
  add(group, new THREE.CylinderGeometry(0.04, 0.04, 1.0, 6), mats.trim, KX + 0.9, SLAB + 2.55, KZ + 0.9);
  var statusLamp = add(group, new THREE.SphereGeometry(0.16, 14, 10), mats.status, KX + 0.9, SLAB + 3.15, KZ + 0.9);

  /* ---------- Subestación, bolardos, farolas, carteles ---------- */
  add(group, roundedBox(1.6, 1.3, 1.1, 0.1, 3), mats.hull, -5.6, SLAB + 0.65, 5.6);
  var tfin = [];
  for (k = 0; k < 7; k++) tfin.push({ x: -5.6 - 0.86, y: SLAB + 0.65, z: 5.2 + k * 0.13, sx: 0.12, sy: 1.0, sz: 0.04 });
  group.add(boxField(UB, mats.dark, tfin));
  [-0.45, 0, 0.45].forEach(function (dx) { cyl(0.07, 0.4, 'y', mats.window, -5.6 + dx, SLAB + 1.5, 5.6, 8); cyl(0.12, 0.08, 'y', mats.plate, -5.6 + dx, SLAB + 1.3, 5.6, 10); });
  [[-6.6, -6.6], [6.6, 6.6], [-6.6, 6.6], [6.6, -3.0]].forEach(function (p) {
    strut([p[0], SLAB, p[1]], [p[0], SLAB + 3.6, p[1]], 0.06, mats.trim);
    add(group, roundedBox(0.5, 0.14, 0.3, 0.04, 2), mats.dark, p[0] - Math.sign(p[0]) * 0.15, SLAB + 3.62, p[1]);
    add(group, new THREE.BoxGeometry(0.4, 0.04, 0.22), mats.window, p[0] - Math.sign(p[0]) * 0.15, SLAB + 3.55, p[1]);
  });
  [[-2.0, 6.5], [3.2, 6.5]].forEach(function (p) {
    strut([p[0], SLAB, p[1]], [p[0], SLAB + 1.2, p[1]], 0.04, mats.trim);
    add(group, new THREE.BoxGeometry(0.9, 0.55, 0.04), mats.accent, p[0], SLAB + 1.2, p[1]);
    for (k = 0; k < 4; k++) { var hz = add(group, new THREE.BoxGeometry(0.12, 0.6, 0.045), mats.dark, p[0] - 0.34 + k * 0.23, SLAB + 1.2, p[1]); hz.rotation.z = 0.6; }
  });
  [-3.0, -2.2, -1.4].forEach(function (bz) {
    add(group, new THREE.CylinderGeometry(0.1, 0.1, 0.6, 10), mats.hull, -6.7, SLAB + 0.3, bz);
    add(group, new THREE.CylinderGeometry(0.105, 0.105, 0.14, 10), mats.accent, -6.7, SLAB + 0.5, bz);
  });
  [[-3.6, 0.8, 0.7, 0.55, 0.7], [-2.6, 0.9, 0.5, 0.5, 0.5]].forEach(function (c) {
    add(group, roundedBox(c[2], c[3], c[4], 0.04, 2), mats.hull2, c[0], SLAB + c[3] / 2, c[1]);
    add(group, new THREE.BoxGeometry(c[2] + 0.02, 0.06, 0.08), mats.accent, c[0], SLAB + c[3] * 0.7, c[1] + c[4] / 2);
  });
  [[2.9, 6.2], [3.5, 6.2]].forEach(function (b, q) {
    add(group, new THREE.CylinderGeometry(0.22, 0.22, 0.6, 14), q ? mats.accent : mats.plate, b[0], SLAB + 0.3, b[1]);
    add(group, new THREE.TorusGeometry(0.22, 0.02, 6, 14).rotateX(P / 2), mats.trim, b[0], SLAB + 0.3, b[1]);
  });
  greeble(-3.2, SLAB, 6.0, 1.8, 0, 1.4, 14, mats.hull2, 'y', 0.15, 0.45);

  /* ---------- Vapor y humo ---------- */
  var puffs = [];
  for (k = 0; k < 6; k++) { var pf = add(group, new THREE.SphereGeometry(0.22, 10, 8), glowMat(0xe9eef5, 0), MXc, 11.5, MZc); pf.visible = false; puffs.push({ m: pf, x: MXc, y: 11.5, z: MZc, c: 0xe9eef5, a: 0.28, up: 2.4, ph: k / 6 }); }
  for (k = 0; k < 6; k++) { var pf2 = add(group, new THREE.SphereGeometry(0.28, 10, 8), glowMat(0x4a4d55, 0), FX, 9.4, FZ); pf2.visible = false; puffs.push({ m: pf2, x: FX, y: 9.4, z: FZ, c: 0x4a4d55, a: 0.35, up: 2.8, ph: k / 6 + 0.05 }); }

  /* ---------- Dron de patrulla ---------- */
  var drone = new THREE.Group();
  group.add(drone);
  add(drone, new THREE.SphereGeometry(0.34, 20, 14), mats.hull, 0, 0, 0);
  add(drone, new THREE.TorusGeometry(0.345, 0.037, 8, 26).rotateX(P / 2), mats.accent, 0, 0, 0);
  add(drone, new THREE.SphereGeometry(0.21, 14, 8, 0, TAU, P / 2, P / 2), mats.dark, 0, -0.19, 0);
  add(drone, new THREE.SphereGeometry(0.08, 10, 8), mats.window, 0, 0.04, -0.32);
  [-1, 1].forEach(function (s) {
    add(drone, new THREE.BoxGeometry(0.36, 0.025, 0.025), mats.trim, s * 0.42, -0.02, 0);
    add(drone, new THREE.SphereGeometry(0.06, 8, 6), glowMat(colors.glow, 0.9), s * 0.61, -0.02, 0);
  });
  add(drone, new THREE.CylinderGeometry(0.018, 0.022, 0.76, 8), mats.trim, 0, 0.68, 0);
  add(drone, new THREE.SphereGeometry(0.06, 10, 8), mats.status, 0, 1.08, 0);
  var halo = add(drone, new THREE.SphereGeometry(0.18, 12, 10), glowMat(0x7dffb0, 0.35), 0, 1.08, 0);
  var thr = new THREE.ConeGeometry(0.11, 0.3, 10, 1, true); thr.rotateX(P);
  add(drone, thr, glowMat(colors.glow, 0.55), 0, -0.47, 0);
  var beam2 = add(drone, new THREE.ConeGeometry(1.1, 4.8, 22, 1, true), glowMat(0xbfffe0, 0.07), 0, -2.9, 0);
  var patrolA = 0;
  function patrolPos(a) {
    var c = Math.cos(a), s = Math.sin(a);
    return [10.0 * (c < 0 ? -1 : 1) * Math.pow(Math.abs(c), 0.55), 5.0 + 0.35 * Math.sin(a * 3), 10.0 * (s < 0 ? -1 : 1) * Math.pow(Math.abs(s), 0.55)];
  }

  /* ---------- Estados, demostración y API ---------- */
  var mode = 'working', crude = 0.9, prod = 0.1, lastT = null, hold = 0, ghost = false, origEm = {}, flick = 1;
  var api = {
    group: group,
    footprint: { w: 14, d: 14 },
    input: inPort,                   // entrada de crudo (borde -X)
    output: outPort,                 // salida de producto refinado (borde +X)
    demo: true,
    patrol: true,
    drone: drone,
    getState: function () { return mode; },
    getCrude: function () { return crude; },
    getProduct: function () { return prod; },
    setCrude: function (f) { crude = Math.max(0, Math.min(1, f)); },
    setProduct: function (f) { prod = Math.max(0, Math.min(1, f)); },
    setState: function (s) { api.demo = false; mode = s; },
    setAccent: setAccent,
    setGhost: function (on, valid) {
      ghost = !!on;
      for (var key in mats) {
        var m = mats[key];
        if (!m.isMeshStandardMaterial && !m.isMeshBasicMaterial) continue;
        if (m.isMeshStandardMaterial && !origEm[key]) origEm[key] = { c: m.emissive.getHex(), i: m.emissiveIntensity };
        if (key === 'dust') continue;
        var base = key === 'sight' ? 0.35 : 1;
        m.transparent = ghost || key === 'sight'; m.opacity = ghost ? 0.45 * base : base; m.depthWrite = !ghost;
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
      if (api.demo) {
        if (mode === 'working') {
          crude -= 0.03 * dt; prod += 0.025 * dt;
          if (prod >= 1) { prod = 1; mode = 'full'; hold = 0; }
          else if (crude <= 0.03) { crude = 0.03; mode = 'starved'; hold = 0; }
        } else if (mode === 'full') { hold += dt; if (hold > 2) mode = 'unload'; }
        else if (mode === 'starved') { crude += 0.22 * dt; if (crude >= 0.85) mode = 'working'; }
        else if (mode === 'unload') { prod -= 0.1 * dt; if (prod <= 0.05) { prod = 0.05; mode = crude > 0.05 ? 'working' : 'starved'; } }
      }
      var working = mode === 'working' && !ghost, unload = mode === 'unload' && !ghost, run = working || unload;
      flowOff += working ? dt * 0.25 : unload ? dt * 0.12 : 0;
      placeFlow(); flowMesh.visible = (working || unload);
      fans.forEach(function (fg, q) { if (working) fg.rotation.y += dt * (q ? -8 : 8); });
      if (run) { pumpFly.rotation.x += dt * 10; pumpFly2.rotation.z += dt * (unload ? 12 : 0); }
      gCrude.scale.y = Math.max(0.01, crude) * 2.0; gCrude.position.y = SLAB + 0.55 + Math.max(0.01, crude) * 1.0;
      gaugesP.forEach(function (g) { var f = Math.max(0.01, prod); g.m.scale.y = f * g.h; g.m.position.y = g.y0 + f * g.h / 2; });
      flick = 1 + Math.sin(t * 31) * 0.12 + Math.sin(t * 17 + 1) * 0.1;
      burners.forEach(function (b, q) { b.visible = !ghost && mode !== 'off'; b.material.opacity = (working ? 0.85 : 0.35) * (0.8 + 0.2 * Math.sin(t * 25 + q)); });
      rGlow.visible = working; if (working) rGlow.material.opacity = 0.6 + 0.3 * Math.sin(t * 9);
      var big = (working || unload) ? 1 : mode === 'full' ? 0.4 : mode === 'broken' ? 1.5 : 0.12, on = mode !== 'off' && !ghost;
      flameO.visible = flameI.visible = flameHalo.visible = on;
      flameO.scale.set(0.8 + big * 0.3, (0.3 + big * 0.8) * flick, 0.8 + big * 0.3);
      flameI.scale.set(0.8 + big * 0.2, (0.3 + big * 0.7) * (2 - flick), 0.8 + big * 0.2);
      flameHalo.scale.setScalar((0.5 + big * 0.7) * flick);
      puffs.forEach(function (p) {
        var ph = (t * 0.35 + p.ph) % 1;
        p.m.visible = working;
        if (working) { p.m.position.set(p.x + ph * 0.8, p.y + ph * p.up, p.z + Math.sin(p.ph * 9) * 0.2); p.m.scale.setScalar(0.6 + ph * 2.4); p.m.material.opacity = (1 - ph) * p.a; }
      });
      var col = mode === 'working' || mode === 'unload' ? 0x35ff7a : mode === 'starved' ? 0xffd030 : mode === 'full' ? 0xff3b30 : mode === 'broken' ? 0xffa31a : 0x303030;
      if (mode === 'full' || mode === 'broken' || mode === 'starved') mats.status.color.setHex(Math.sin(t * 6) > 0 ? col : 0x301010); else mats.status.color.setHex(col);
      for (var bi = 0; bi < blinkers.length; bi++) blinkers[bi].m.visible = mode !== 'off' && Math.sin(t * TAU / blinkers[bi].per + blinkers[bi].ph) > -0.2;
      var pon = api.patrol, p, p1, p0;
      if (pon) { patrolA += dt * 0.22; p = patrolPos(patrolA); p1 = patrolPos(patrolA + 0.03); p0 = patrolPos(patrolA - 0.03); }
      else { p = [KX - 0.4, 4.7 + 0.12 * Math.sin(t * 1.5), KZ]; p1 = p; p0 = p; }
      drone.position.set(p[0], p[1], p[2]);
      drone.rotation.y = pon ? Math.atan2(-(p1[0] - p0[0]), -(p1[2] - p0[2])) : t * 0.4;
      drone.rotation.z = pon ? 0.08 * Math.sin(t * 2) : 0;
      var dc = mode === 'broken' ? 0xffa31a : mode === 'off' ? 0x505050 : 0x5dffa0;
      halo.material.color.setHex(dc); halo.material.opacity = 0.2 + 0.2 * (0.5 + 0.5 * Math.sin(t * 5));
      beam2.material.color.setHex(dc); beam2.visible = pon && mode !== 'off';
      drone.visible = !ghost;
    }
  };
  api.update(0);
  return api;
}
