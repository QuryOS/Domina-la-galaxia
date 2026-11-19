/**
 * Astillero para Three.js, sin archivos externos (instalación grande para colocar en el planeta).
 *
 * Dársena de construcción con una nave que se levanta tramo a tramo (cuadernas y largueros, luego el casco, y al final
 * cabina, alas, deriva y motores), dos pórticos laterales con rieles, puente grúa de doble viga con carro, cable y gancho
 * que lleva planchas desde la pila de material hasta el tramo en obra, dos robots de soldadura sobre rieles con cinemática
 * inversa (soplete con destello y chispas), cinta de entrada de materiales, contenedores, taller de piezas con tejado
 * dentado, ventiladores y chimenea, dos generadores, cabina de control con barras de progreso y de material, radar,
 * postes de luz, zona de lanzamiento y un dron esférico con antena luminosa que patrulla.
 *
 * Uso:
 *   const ast = createAstillero(THREE, { accent: 0xff9f2f });
 *   ast.group.position.set(x, groundY, z);        // la base de la losa está en y = 0
 *   scene.add(ast.group);
 *   ast.update(clock.getElapsedTime());
 *
 * Escala: 1 unidad = 4 m. Huella: 18 x 18 unidades (ast.footprint), centrada en el origen.
 * Entrada de materiales: ast.input (Object3D, borde -X). Salida de naves: ast.output (Object3D, borde -Z, donde nace la nave al lanzarse).
 *
 * Estados (ast.setState): 'building' construye (sube el progreso, grúa y robots trabajando), 'waiting' sin material (lámpara
 *   amarilla, la cinta sigue recibiendo), 'done' nave terminada (lámpara cian), 'launch' la nave despega por el frente,
 *   'broken' (lámpara naranja, robots con cortocircuito), 'off' (apagado). Por defecto corre un ciclo de demostración
 *   (ast.demo = true): construir -> terminar -> lanzar -> empezar otra; setState lo desactiva y el control pasa a tu juego.
 * ast.setProgress(0..1) / getProgress(): avance de la nave. ast.setStock(0..1) / getStock(): material disponible.
 * ast.launch(): fuerza el despegue (luego haz setProgress(0) y setState('building') para otra nave).
 * ast.setGhost(true, valid): modo "fantasma" para colocar (muestra la nave completa; verde si valid, rojo si valid === false);
 *   setGhost(false) lo quita. ast.patrol = false deja el dron quieto sobre la cabina; ast.drone es su grupo. ast.setAccent(hex): pintura.
 * Compatible con Three.js r128 o superior.
 */
function createAstillero(THREE, opts) {
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

  var SLAB = 0.4, k, j, i;
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function sstep(x) { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); }
  function box(parent, w, h, d, mat, x, y, z, r) { return add(parent, roundedBox(w, h, d, r || 0.04, 2), mat, x, y, z); }
  mats.hazY = new THREE.MeshStandardMaterial({ color: 0xf2c200, metalness: 0.2, roughness: 0.6, side: THREE.DoubleSide });
  mats.hazK = new THREE.MeshStandardMaterial({ color: 0x15171c, metalness: 0.2, roughness: 0.7, side: THREE.DoubleSide });
  mats.contA = new THREE.MeshStandardMaterial({ color: 0xc0502f, metalness: 0.4, roughness: 0.55, side: THREE.DoubleSide });
  mats.contB = new THREE.MeshStandardMaterial({ color: 0x2f7bc0, metalness: 0.4, roughness: 0.55, side: THREE.DoubleSide });
  mats.contC = new THREE.MeshStandardMaterial({ color: 0xc9a02f, metalness: 0.4, roughness: 0.55, side: THREE.DoubleSide });
  mats.barP = new THREE.MeshBasicMaterial({ color: 0x35e0ff });
  mats.barM = new THREE.MeshBasicMaterial({ color: 0xffc84a });
  mats.gen = new THREE.MeshBasicMaterial({ color: 0x35e0ff });
  mats.forge = new THREE.MeshBasicMaterial({ color: 0xff8a2a });
  mats.weld = new THREE.MeshBasicMaterial({ color: 0xcfefff, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false });
  mats.spark = new THREE.MeshBasicMaterial({ color: 0xffd98a, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false });

  /* ---------- Losa 18 x 18, dársena de construcción, franjas de peligro ---------- */
  add(group, roundedBox(18, SLAB, 18, 0.08, 3), mats.slab, 0, SLAB / 2, 0);
  var DZ0 = -9, DZ1 = 4.2, DX = 4.6;
  box(group, DX * 2, 0.04, DZ1 - DZ0, mats.trim, 0, SLAB + 0.02, (DZ0 + DZ1) / 2, 0.01);
  var hy = [], hk = [];
  for (k = 0; k < 26; k++) {
    var zz = DZ0 + 0.26 + k * 0.5;
    [-DX, DX].forEach(function (xx) { (k % 2 ? hy : hk).push({ x: xx, y: SLAB + 0.03, z: zz, sx: 0.22, sy: 0.03, sz: 0.5 }); });
  }
  for (k = 0; k < 19; k++) (k % 2 ? hy : hk).push({ x: -DX + 0.25 + k * 0.5, y: SLAB + 0.03, z: DZ1, sx: 0.5, sy: 0.03, sz: 0.22 });
  group.add(boxField(UB, mats.hazY, hy));
  group.add(boxField(UB, mats.hazK, hk));
  var seams = [], stains = [];
  for (k = -2; k <= 2; k++) { seams.push({ x: k * 3.6, y: SLAB + 0.01, z: 0, sx: 0.04, sy: 0.02, sz: 18 }); seams.push({ x: 0, y: SLAB + 0.01, z: k * 3.6, sx: 18, sy: 0.02, sz: 0.04 }); }
  for (k = 0; k < 18; k++) stains.push({ x: (rnd() - 0.5) * 16, y: SLAB + 0.012, z: (rnd() - 0.5) * 16, ry: rnd() * 3, sx: 0.5 + rnd() * 1.4, sy: 0.01, sz: 0.4 + rnd() });
  group.add(boxField(UB, mats.dark, seams));
  group.add(boxField(UB, mats.trim, stains));
  // círculo de lanzamiento (frente de la dársena)
  add(group, new THREE.RingGeometry(1.7, 1.85, 40).rotateX(-P / 2), mats.accent, 0, SLAB + 0.05, -6.0);

  /* ---------- Pórticos laterales (4 columnas por lado) y rieles del puente grúa ---------- */
  var GH = 9.0, GX = 8.2, COLZ = [-8.5, -2.8, 2.9, 8.5];
  function column(cx, cz) {
    var o = 0.45, lv = [SLAB, GH * 0.33, GH * 0.66, GH], q, c, cs = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
    box(group, 1.4, 0.18, 1.4, mats.trim, cx, SLAB + 0.09, cz, 0.03);
    cs.forEach(function (c2) { strut([cx + c2[0] * o, SLAB, cz + c2[1] * o], [cx + c2[0] * o, GH, cz + c2[1] * o], 0.09, mats.hull2); });
    for (q = 1; q < 4; q++) for (c = 0; c < 4; c++) {
      var a = cs[c], b = cs[(c + 1) % 4];
      strut([cx + a[0] * o, lv[q], cz + a[1] * o], [cx + b[0] * o, lv[q], cz + b[1] * o], 0.05, mats.trim);
    }
    for (q = 0; q < 3; q++) for (c = 0; c < 4; c++) {
      var a2 = cs[c], b2 = cs[(c + 1) % 4], flip = (q + c) % 2;
      strut([cx + (flip ? a2[0] : b2[0]) * o, lv[q], cz + (flip ? a2[1] : b2[1]) * o], [cx + (flip ? b2[0] : a2[0]) * o, lv[q + 1], cz + (flip ? b2[1] : a2[1]) * o], 0.04, mats.trim);
    }
    box(group, 1.2, 0.3, 1.2, mats.hull, cx, GH + 0.15, cz, 0.05);
    add(group, new THREE.BoxGeometry(0.5, 0.06, 0.5), mats.accent, cx, GH + 0.32, cz);
  }
  [-GX, GX].forEach(function (cx) {
    COLZ.forEach(function (cz) { column(cx, cz); });
    box(group, 0.6, 0.45, 18.0, mats.hull2, cx, GH + 0.52, 0, 0.04);              // viga carril
    box(group, 0.22, 0.1, 18.0, mats.plate, cx, GH + 0.8, 0, 0.02);
    for (k = 0; k < 2; k++) add(group, new THREE.BoxGeometry(0.9, 0.5, 0.5), mats.hazK, cx, GH + 0.52, k ? 8.9 : -8.9);   // topes
  });
  // tirantes superiores entre carriles (travesaños fijos al principio y al final)
  [-8.9, 8.9].forEach(function (zz2) { box(group, GX * 2, 0.35, 0.35, mats.hull2, 0, GH + 0.2, zz2, 0.04); });

  /* ---------- Puente grúa (doble viga), carro, cable y gancho con plancha ---------- */
  var bridge = new THREE.Group();
  group.add(bridge);
  var GY = GH + 0.9;                  // sobre el carril
  [-0.55, 0.55].forEach(function (zz2) {
    box(bridge, GX * 2 + 0.6, 0.8, 0.5, mats.hull, 0, GY + 0.75, zz2, 0.06);
    add(bridge, new THREE.BoxGeometry(GX * 2 + 0.6, 0.05, 0.12), mats.accent, 0, GY + 0.75, zz2 + (zz2 > 0 ? 0.26 : -0.26));
  });
  for (k = -7; k <= 7; k++) box(bridge, 0.14, 0.7, 1.6, mats.hull2, k * 1.1, GY + 0.75, 0, 0.02);       // diafragmas
  [-GX, GX].forEach(function (xx) {
    box(bridge, 1.0, 0.7, 2.6, mats.hull2, xx, GY + 0.35, 0, 0.06);
    for (var wz = -1; wz <= 1; wz += 2) add(bridge, new THREE.CylinderGeometry(0.28, 0.28, 0.5, 14).rotateZ(P / 2), mats.dark, xx, GY + 0.0, wz * 0.85);
    add(bridge, new THREE.SphereGeometry(0.12, 10, 8), mats.red, xx, GY + 1.0, 0);
  });
  // cabina del operador colgada del puente
  box(bridge, 1.5, 1.2, 1.5, mats.hull2, -6.8, GY - 0.45, 0, 0.1);
  add(bridge, new THREE.BoxGeometry(1.2, 0.5, 0.05), mats.glass, -6.8, GY - 0.25, -0.77);
  add(bridge, new THREE.BoxGeometry(0.05, 0.5, 1.0), mats.glass, -7.56, GY - 0.25, 0);
  strut([-7.3, GY + 0.35, 0], [-7.3, GY - 0.0, 0], 0.05, mats.trim); strut([-6.3, GY + 0.35, 0], [-6.3, GY - 0.0, 0], 0.05, mats.trim);
  // carro
  var trol = new THREE.Group();
  bridge.add(trol);
  trol.position.set(0, GY + 1.15, 0);
  box(trol, 1.6, 0.5, 1.9, mats.hull, 0, 0.3, 0, 0.08);
  add(trol, new THREE.CylinderGeometry(0.32, 0.32, 1.5, 16).rotateX(P / 2), mats.accent, 0, 0.7, 0);
  for (k = 0; k < 4; k++) add(trol, new THREE.CylinderGeometry(0.2, 0.2, 0.25, 12).rotateX(P / 2), mats.dark, k < 2 ? -0.6 : 0.6, 0.0, k % 2 ? 0.7 : -0.7);
  add(trol, new THREE.SphereGeometry(0.1, 10, 8), mats.red, 0, 1.15, 0);
  var cableM = add(trol, new THREE.CylinderGeometry(0.035, 0.035, 1, 6), mats.trim, 0, -1, 0);
  var hook = new THREE.Group();
  trol.add(hook);
  box(hook, 0.55, 0.4, 0.5, mats.accent, 0, 0.0, 0, 0.08);
  add(hook, new THREE.TorusGeometry(0.16, 0.045, 8, 16, P * 1.5).rotateZ(P * 0.25), mats.trim, 0, -0.34, 0);
  var load = new THREE.Group();
  hook.add(load);
  [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(function (c2) {
    var m = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 1, 5), mats.trim);
    placeStrut(m, [0, -0.2, 0], [c2[0] * 0.7, -1.62, c2[1] * 0.5]);
    load.add(m);
  });
  box(load, 1.6, 0.09, 1.2, mats.plate, 0, -1.67, 0, 0.03);
  box(load, 1.4, 0.05, 1.0, mats.hull, 0, -1.62, 0, 0.02);
  var cabLamp = add(bridge, new THREE.SphereGeometry(0.14, 10, 8), mats.status, 0, GY + 1.3, 0.0);
  var TROL0 = GY + 1.15;

  /* ---------- Nave en construcción (casco por tramos, cuadernas, y piezas finales) ---------- */
  var Y0 = 2.1, NSEG = 8;
  var secs = [
    { z: -8.0, w: 0.25, t: 0.20, b: 0.20 }, { z: -6.6, w: 0.90, t: 0.50, b: 0.45 }, { z: -5.0, w: 1.35, t: 0.75, b: 0.60 },
    { z: -3.4, w: 1.60, t: 0.90, b: 0.70 }, { z: -1.8, w: 1.70, t: 0.95, b: 0.75 }, { z: -0.2, w: 1.70, t: 0.95, b: 0.75 },
    { z: 1.2, w: 1.55, t: 0.90, b: 0.70 }, { z: 2.4, w: 1.30, t: 0.80, b: 0.62 }, { z: 3.2, w: 1.00, t: 0.70, b: 0.55 }
  ];
  secs.forEach(function (s) { s.n = 2.6; });
  function hullAt(z, key) {
    for (var q = 0; q < secs.length - 1; q++) if (z <= secs[q + 1].z) { var u2 = clamp((z - secs[q].z) / (secs[q + 1].z - secs[q].z), 0, 1); return secs[q][key] + (secs[q + 1][key] - secs[q][key]) * u2; }
    return secs[secs.length - 1][key];
  }
  function segMid(s) { return (secs[s].z + secs[s + 1].z) / 2; }
  var shipG = new THREE.Group();
  group.add(shipG);
  shipG.position.y = Y0;
  var ringG = new THREE.TorusGeometry(1, 0.03, 6, 28);
  var ANG = [0.5236, 1.5708, 2.618, 3.6652, 4.7124, 5.7596];
  function hullPt(si, a) {
    var s = secs[si], c = Math.cos(a), sn = Math.sin(a), e = 2 / s.n, h = sn >= 0 ? s.t : s.b;
    return [s.w * (c < 0 ? -1 : 1) * Math.pow(Math.abs(c), e) * 0.96, h * (sn < 0 ? -1 : 1) * Math.pow(Math.abs(sn), e) * 0.96, s.z];
  }
  var segs = [];
  for (i = 0; i < NSEG; i++) {
    var fr = new THREE.Group();
    shipG.add(fr);
    var rings = i === NSEG - 1 ? [i, i + 1] : [i];
    rings.forEach(function (ri) {
      var sc = secs[ri], rm = add(fr, ringG, mats.trim, 0, (sc.t - sc.b) / 2, sc.z);
      rm.scale.set(sc.w * 0.96, (sc.t + sc.b) / 2 * 0.96, 1);
    });
    ANG.forEach(function (a) {
      var p0 = hullPt(i, a), p1 = hullPt(i + 1, a), m = new THREE.Mesh(_cg[0.04] || (_cg[0.04] = new THREE.CylinderGeometry(0.04, 0.04, 1, 6)), mats.plate);
      placeStrut(m, p0, p1); fr.add(m);
    });
    var pl = new THREE.Mesh(loft([secs[i], secs[i + 1]], 30, i === 0, i === NSEG - 1), i % 3 === 1 ? mats.hull2 : mats.hull);
    shipG.add(pl);
    segs.push({ fr: fr, pl: pl });
  }
  // franja de pintura (aparece con el casco): dos tiras laterales
  // piezas finales
  var late = [];
  function lateAdd(g, p0, cx, cy, cz) { g.position.set(cx, cy, cz); shipG.add(g); late.push({ g: g, p0: p0 }); return g; }
  var gCan = new THREE.Group();
  var can = add(gCan, new THREE.SphereGeometry(0.62, 18, 12), mats.glass, 0, 0, 0); can.scale.set(0.8, 0.55, 1.9);
  add(gCan, new THREE.TorusGeometry(0.5, 0.03, 6, 20).rotateX(P / 2), mats.accent, 0, -0.18, 0.0).scale.set(0.9, 1, 2.0);
  lateAdd(gCan, 0.55, 0, 0.78, -4.6);
  var gWing = new THREE.Group();
  var wg = plan([[0, -0.5], [3.2, 0.9], [3.2, 1.8], [0, 2.6]], 0.13, 0.02); wg.translate(0, 0, -1.05);
  add(gWing, wg, mats.hull2, 0, 0, 0);
  var wg2 = plan([[0, -0.2], [3.0, 1.05], [3.0, 1.35], [0, 1.8]], 0.05, 0); wg2.translate(0, 0, -0.8);
  add(gWing, wg2, mats.accent, 0, 0.09, 0.25);
  [-1, 1].forEach(function (s) {
    add(gWing, new THREE.SphereGeometry(0.1, 8, 6), s < 0 ? mats.red : mats.green, s * 3.2, 0, 0.3);
    add(gWing, new THREE.CylinderGeometry(0.06, 0.06, 1.2, 8).rotateX(P / 2), mats.trim, s * 3.15, 0, 0.5);
  });
  lateAdd(gWing, 0.72, 0, -0.45, 1.05);
  var gFin = new THREE.Group();
  box(gFin, 0.14, 1.0, 1.5, mats.hull2, 0, 0, 0, 0.04);
  add(gFin, new THREE.BoxGeometry(0.16, 0.18, 1.2), mats.accent, 0, 0.3, 0);
  lateAdd(gFin, 0.82, 0, 1.4, 2.0);
  var gNoz = [], flames = [];
  [-0.7, 0.7].forEach(function (xx) {
    var g = new THREE.Group();
    add(g, new THREE.CylinderGeometry(0.4, 0.48, 0.8, 18).rotateX(P / 2), mats.dark, 0, 0, 0);
    add(g, new THREE.TorusGeometry(0.42, 0.05, 8, 20), mats.accent, 0, 0, 0.42);
    add(g, new THREE.CircleGeometry(0.34, 18), glowMat(colors.glow, 0.9), 0, 0, 0.43);
    var fl = add(g, new THREE.ConeGeometry(0.34, 2.2, 14, 1, true).rotateX(P / 2), glowMat(colors.glow, 0.7), 0, 0, 1.55);
    fl.visible = false; flames.push(fl);
    lateAdd(g, 0.9, xx, -0.05, 3.45);
  });
  // soportes de cuna (siempre) y apoyos laterales (aparecen con su tramo)
  [-4.6, -2.6, -0.6, 1.4, 2.8].forEach(function (zz2) {
    var bb = hullAt(zz2, 'b'), hh = Y0 - bb - SLAB;
    box(group, 0.8, hh, 0.7, mats.hazK, 0, SLAB + hh / 2, zz2, 0.04);
    box(group, 1.1, 0.12, 0.9, mats.plate, 0, Y0 - bb - 0.06, zz2, 0.03);
  });
  var supG = [];
  [[-1.0, 4], [1.8, 6]].forEach(function (d) {
    var sg = new THREE.Group(); group.add(sg);
    [-1, 1].forEach(function (s) {
      var m = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 1, 8), mats.hull2);
      placeStrut(m, [s * 3.2, SLAB, d[0]], [s * 1.15, Y0 - 0.5, d[0]]); sg.add(m);
      box(sg, 0.7, 0.14, 0.7, mats.trim, s * 3.2, SLAB + 0.07, d[0], 0.03);
      var m2 = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1, 6), mats.trim);
      placeStrut(m2, [s * 3.9, SLAB, d[0]], [s * 3.0, Y0 - 1.1, d[0]]); sg.add(m2);
    });
    supG.push({ g: sg, s: d[1] });
  });

  /* ---------- Robots de soldadura (2, sobre rieles junto a la dársena) ---------- */
  var L1 = 2.6, L2 = 2.4, RBX = 5.3, SHY = SLAB + 0.95;
  var robots = [];
  [-1, 1].forEach(function (side) {
    box(group, 0.5, 0.06, 9.6, mats.dark, side * RBX, SLAB + 0.03, -2.6, 0.01);       // riel
    for (k = 0; k < 10; k++) add(group, new THREE.BoxGeometry(0.8, 0.04, 0.1), mats.trim, side * RBX, SLAB + 0.07, -7.0 + k * 1.0);
    var rg = new THREE.Group(); group.add(rg);
    rg.rotation.y = side < 0 ? 0 : P;
    box(rg, 1.0, 0.5, 1.2, mats.hull2, 0, SLAB + 0.3, 0, 0.06);
    add(rg, new THREE.CylinderGeometry(0.35, 0.42, 0.45, 16), mats.dark, 0, SLAB + 0.75, 0);
    add(rg, new THREE.TorusGeometry(0.36, 0.03, 6, 20).rotateX(P / 2), mats.accent, 0, SLAB + 0.95, 0);
    var sh = new THREE.Group(); rg.add(sh); sh.position.set(0, SHY + 0.1, 0);
    add(sh, new THREE.CylinderGeometry(0.28, 0.28, 0.5, 16).rotateX(P / 2), mats.accent, 0, 0, 0);
    box(sh, L1, 0.34, 0.3, mats.hull, L1 / 2, 0, 0.0, 0.08);
    add(sh, new THREE.BoxGeometry(L1 * 0.8, 0.06, 0.32), mats.accent, L1 / 2, 0.19, 0);
    var el = new THREE.Group(); sh.add(el); el.position.set(L1, 0, 0);
    add(el, new THREE.CylinderGeometry(0.22, 0.22, 0.42, 16).rotateX(P / 2), mats.accent, 0, 0, 0);
    box(el, L2, 0.26, 0.24, mats.hull2, L2 / 2, 0, 0, 0.06);
    add(el, new THREE.CylinderGeometry(0.15, 0.2, 0.4, 12).rotateZ(-P / 2), mats.dark, L2 + 0.05, 0, 0);
    add(el, new THREE.CylinderGeometry(0.03, 0.06, 0.4, 8).rotateZ(-P / 2), mats.trim, L2 + 0.4, 0, 0);
    var tg = add(el, new THREE.SphereGeometry(0.13, 10, 8), mats.weld, L2 + 0.62, 0, 0);
    var sp = [];
    for (k = 0; k < 7; k++) { var sm = add(group, new THREE.SphereGeometry(0.035, 6, 4), mats.spark, 0, 0, 0); sm.visible = false; sp.push({ m: sm, vx: 0.5 + rnd() * 1.1, vy: 0.4 + rnd() * 1.3, vz: (rnd() - 0.5) * 1.6, ph: k / 7 }); }
    robots.push({ side: side, rg: rg, sh: sh, el: el, tg: tg, sp: sp, z: -4.0, wz: 0 });
  });

  /* ---------- Zona de material: cinta, pila de planchas, contenedores ---------- */
  box(group, 2.5, 0.16, 1.0, mats.dark, -7.75, SLAB + 0.45, 6.3, 0.03);
  for (k = 0; k < 6; k++) add(group, new THREE.CylinderGeometry(0.07, 0.07, 1.0, 8).rotateX(P / 2), mats.trim, -8.7 + k * 0.4, SLAB + 0.55, 6.3);
  [-1, 1].forEach(function (s) { box(group, 2.5, 0.12, 0.08, mats.accent, -7.75, SLAB + 0.55, 6.3 + s * 0.52, 0.01); });
  for (k = 0; k < 4; k++) box(group, 0.12, 0.45, 1.0, mats.trim, -8.6 + k * 0.7, SLAB + 0.22, 6.3, 0.02);
  var crates = new THREE.InstancedMesh(UB, mats.contC, 5);
  crates.frustumCulled = false;
  group.add(crates);
  var _d = new THREE.Object3D();
  var stackG = new THREE.Group(); group.add(stackG); stackG.position.set(-5.6, SLAB, 6.3);
  box(stackG, 2.0, 0.14, 1.4, mats.hazK, 0, 0.07, 0, 0.02);
  var stackM = add(stackG, new THREE.BoxGeometry(1.8, 1, 1.2), mats.plate, 0, 0.5, 0);
  for (k = 0; k < 2; k++) box(stackG, 0.08, 1.0, 1.28, mats.accent, -0.6 + k * 1.2, 0.5, 0, 0.01).visible = true;
  [[-6.9, -6.4, mats.contA], [-6.9, -4.4, mats.contB]].forEach(function (c) {
    box(group, 1.5, 1.0, 1.9, c[2], c[0], SLAB + 0.5, c[1], 0.05);
    box(group, 1.5, 1.0, 1.9, c[2] === mats.contA ? mats.contC : mats.contA, c[0], SLAB + 1.5, c[1], 0.05);
    for (var ci = 0; ci < 2; ci++) for (var cj = 0; cj < 5; cj++) add(group, new THREE.BoxGeometry(0.03, 0.9, 0.05), mats.dark, c[0] + (ci ? 0.76 : -0.76), SLAB + 0.5 + ci * 0, c[1] - 0.8 + cj * 0.4);
  });
  var barrels = [];
  for (k = 0; k < 7; k++) barrels.push({ x: -7.1 + (k % 4) * 0.5, y: SLAB + 0.3, z: -1.7 + Math.floor(k / 4) * 0.55, sx: 0.4, sy: 0.6, sz: 0.4 });
  var bg = new THREE.CylinderGeometry(0.5, 0.5, 1, 14);
  group.add(boxField(bg, mats.accent, barrels));
  // bombonas de gas junto al riel izquierdo
  for (k = 0; k < 3; k++) { add(group, new THREE.CylinderGeometry(0.14, 0.14, 0.8, 10), mats.hazY, -6.4 + k * 0.4, SLAB + 0.4, -0.4); add(group, new THREE.SphereGeometry(0.14, 10, 6, 0, TAU, 0, P / 2), mats.hazY, -6.4 + k * 0.4, SLAB + 0.8, -0.4); }

  /* ---------- Taller de piezas (derecha, frente) ---------- */
  var WX = 6.0, WZ = 6.2;
  box(group, 3.2, 2.2, 4.0, mats.hull2, WX, SLAB + 1.1, WZ, 0.08);
  box(group, 3.3, 0.18, 4.1, mats.trim, WX, SLAB + 2.25, WZ, 0.03);
  var saw = new THREE.Shape(); saw.moveTo(-1.6, 0); saw.lineTo(-1.6, 0.9); saw.lineTo(1.6, 0); saw.closePath();
  for (k = 0; k < 3; k++) {
    var sg2 = new THREE.ExtrudeGeometry(saw, { depth: 1.3, bevelEnabled: false }); sg2.translate(0, 0, -0.65);
    add(group, sg2, mats.hull, WX, SLAB + 2.34, WZ - 1.33 + k * 1.33);
    add(group, new THREE.BoxGeometry(0.04, 0.7, 1.2), mats.glass, WX - 1.58, SLAB + 2.75, WZ - 1.33 + k * 1.33);
  }
  box(group, 0.12, 1.7, 2.2, mats.dark, WX - 1.62, SLAB + 0.95, WZ - 0.2, 0.02);        // portón hacia la dársena
  for (k = 0; k < 6; k++) add(group, new THREE.BoxGeometry(0.05, 0.05, 2.2), mats.hazY, WX - 1.69, SLAB + 0.3 + k * 0.27, WZ - 0.2);
  add(group, new THREE.BoxGeometry(0.05, 0.5, 0.9), mats.forge, WX - 1.68, SLAB + 1.6, WZ + 1.45);
  add(group, new THREE.BoxGeometry(0.05, 0.5, 0.9), mats.forge, WX - 1.68, SLAB + 1.6, WZ - 1.85);
  cyl(0.28, 3.0, 'y', mats.pipe, WX + 1.1, SLAB + 3.5, WZ + 1.6, 14);
  add(group, new THREE.TorusGeometry(0.29, 0.04, 6, 14).rotateX(P / 2), mats.accent, WX + 1.1, SLAB + 5.0, WZ + 1.6);
  var wFans = [];
  [-0.9, 0.7].forEach(function (zz2) {
    var fg2 = new THREE.Group(); group.add(fg2); fg2.position.set(WX + 0.7, SLAB + 2.4, WZ + zz2);
    add(fg2, new THREE.CylinderGeometry(0.4, 0.4, 0.14, 16), mats.dark, 0, 0, 0);
    var bl = new THREE.Group(); fg2.add(bl); bl.position.y = 0.1;
    for (k = 0; k < 4; k++) { var b = add(bl, new THREE.BoxGeometry(0.62, 0.03, 0.15), mats.plate, 0, 0, 0); b.rotation.y = k * P / 4; }
    wFans.push(bl);
  });
  var wPuffs = [];
  for (k = 0; k < 5; k++) { var pf = add(group, new THREE.SphereGeometry(0.22, 10, 8), glowMat(0xdde3ea, 0), WX + 1.1, SLAB + 5.0, WZ + 1.6); pf.visible = false; wPuffs.push({ m: pf, ph: k / 5 }); }

  /* ---------- Generadores (derecha, junto a la dársena) ---------- */
  var gens = [];
  [-6.6, -3.9].forEach(function (zz2) {
    box(group, 2.0, 0.3, 2.0, mats.trim, 6.9, SLAB + 0.15, zz2, 0.05);
    add(group, new THREE.CylinderGeometry(0.8, 0.85, 1.7, 22), mats.hull, 6.9, SLAB + 1.15, zz2);
    for (k = 0; k < 5; k++) add(group, new THREE.TorusGeometry(0.86, 0.04, 6, 24).rotateX(P / 2), mats.hull2, 6.9, SLAB + 0.6 + k * 0.28, zz2);
    gens.push(add(group, new THREE.TorusGeometry(0.82, 0.07, 8, 28).rotateX(P / 2), mats.gen, 6.9, SLAB + 1.95, zz2));
    add(group, new THREE.CylinderGeometry(0.5, 0.65, 0.3, 18), mats.dark, 6.9, SLAB + 2.1, zz2);
    strut([6.9, SLAB + 2.2, zz2], [6.9, SLAB + 3.6, zz2], 0.04, mats.trim);
    add(group, new THREE.SphereGeometry(0.1, 8, 6), mats.red, 6.9, SLAB + 3.65, zz2);
  });
  [-5.25].forEach(function (zz2) { box(group, 1.2, 1.0, 1.4, mats.hull2, 6.9, SLAB + 0.5, zz2, 0.05); greeble(6.9, SLAB + 1.0, zz2, 1.0, 0, 1.2, 4, mats.trim, 'y', 0.12, 0.3); });
  for (k = 0; k < 8; k++) add(group, new THREE.BoxGeometry(2.4, 0.04, 0.08), mats.dark, 5.7, SLAB + 0.03, -6.8 + k * 0.55).rotation.y = 0;   // cables al suelo
  strut([5.7, SLAB + 0.1, -6.6], [5.4, SLAB + 0.1, -2.0], 0.07, mats.dark);

  /* ---------- Cabina de control (centro, frente) con barras de progreso ---------- */
  var CZ = 7.1;
  box(group, 5.0, 1.5, 3.0, mats.hull2, 0, SLAB + 0.75, CZ, 0.08);
  box(group, 5.1, 0.12, 3.1, mats.trim, 0, SLAB + 1.55, CZ, 0.03);
  box(group, 3.8, 1.3, 2.2, mats.hull, 0, SLAB + 2.2, CZ, 0.08);
  add(group, new THREE.BoxGeometry(3.4, 0.6, 0.05), mats.glass, 0, SLAB + 2.3, CZ - 1.12);
  for (k = 0; k < 7; k++) add(group, new THREE.BoxGeometry(0.04, 0.6, 0.07), mats.trim, -1.7 + k * 0.566, SLAB + 2.3, CZ - 1.12);
  add(group, new THREE.BoxGeometry(0.05, 0.5, 1.5), mats.glass, -1.92, SLAB + 2.3, CZ);
  add(group, new THREE.BoxGeometry(0.05, 0.5, 1.5), mats.glass, 1.92, SLAB + 2.3, CZ);
  box(group, 4.0, 0.14, 2.4, mats.accent, 0, SLAB + 2.9, CZ, 0.03);
  box(group, 3.0, 0.2, 0.04, mats.dark, 0, SLAB + 1.05, CZ - 1.5, 0.01);
  box(group, 3.0, 0.2, 0.04, mats.dark, 0, SLAB + 0.72, CZ - 1.5, 0.01);
  var barP = add(group, new THREE.BoxGeometry(1, 0.14, 0.05), mats.barP, 0, SLAB + 1.05, CZ - 1.52);
  var barM = add(group, new THREE.BoxGeometry(1, 0.14, 0.05), mats.barM, 0, SLAB + 0.72, CZ - 1.52);
  add(group, new THREE.BoxGeometry(0.22, 0.22, 0.05), mats.barP, -1.75, SLAB + 1.05, CZ - 1.52).scale.set(0.6, 0.6, 1);
  add(group, new THREE.BoxGeometry(0.22, 0.22, 0.05), mats.barM, -1.75, SLAB + 0.72, CZ - 1.52).scale.set(0.6, 0.6, 1);
  box(group, 1.0, 1.2, 0.08, mats.dark, 1.9, SLAB + 0.65, CZ - 1.5, 0.02);               // puerta
  strut([-1.8, SLAB + 3.0, CZ + 0.8], [-1.8, SLAB + 4.4, CZ + 0.8], 0.04, mats.trim);
  var radar = new THREE.Group(); group.add(radar); radar.position.set(1.2, SLAB + 3.0, CZ + 0.4);
  add(radar, new THREE.CylinderGeometry(0.06, 0.06, 0.5, 8), mats.trim, 0, 0.25, 0);
  var dish = add(radar, new THREE.SphereGeometry(0.55, 16, 8, 0, TAU, 0, P / 2.4), mats.hull, 0, 0.7, 0); dish.rotation.x = P * 0.72;
  add(radar, new THREE.CylinderGeometry(0.02, 0.02, 0.5, 6), mats.trim, 0, 0.9, -0.4).rotation.x = 0.7;
  strut([-0.9, SLAB + 3.0, CZ + 0.6], [-0.9, SLAB + 4.0, CZ + 0.6], 0.05, mats.trim);
  var mastTop = add(group, new THREE.SphereGeometry(0.2, 12, 10), mats.status, -1.8, SLAB + 4.5, CZ + 0.8);
  var mastHalo = add(group, new THREE.SphereGeometry(0.45, 12, 10), glowMat(0x7dffb0, 0.3), -1.8, SLAB + 4.5, CZ + 0.8);
  greeble(0, SLAB + 2.97, CZ, 3.4, 0, 1.8, 7, mats.hull2, 'y', 0.15, 0.4);

  /* ---------- Postes de luz, puertos y señales ---------- */
  [[-4.9, -8.6], [4.9, -8.6], [-4.9, 3.9], [4.9, 3.9]].forEach(function (p) {
    cyl(0.1, 6.0, 'y', mats.hull2, p[0], SLAB + 3.0, p[1], 8);
    box(group, 0.5, 0.5, 0.5, mats.trim, p[0], SLAB + 0.25, p[1], 0.04);
    var hd = box(group, 1.1, 0.5, 0.35, mats.dark, p[0] + (p[0] < 0 ? 0.3 : -0.3), SLAB + 6.1, p[1], 0.04);
    hd.rotation.z = p[0] < 0 ? -0.35 : 0.35;
    add(group, new THREE.BoxGeometry(0.9, 0.3, 0.05), mats.window, p[0] + (p[0] < 0 ? 0.32 : -0.32), SLAB + 6.05, p[1] + 0.2).rotation.z = p[0] < 0 ? -0.35 : 0.35;
    light(group, p[0], SLAB + 6.4, p[1], mats.red, 0.07, 1.6);
  });
  var inPort = new THREE.Object3D(); group.add(inPort); inPort.position.set(-9.0, SLAB + 0.9, 6.3);
  var outPort = new THREE.Object3D(); group.add(outPort); outPort.position.set(0, SLAB + 1.7, -9.0);
  add(group, new THREE.ConeGeometry(0.28, 0.6, 4).rotateX(-P / 2), mats.accent, -8.7, SLAB + 1.2, 6.3);
  [[-4.0, -9.0], [4.0, -9.0]].forEach(function (p) { box(group, 0.5, 0.5, 0.5, mats.hazY, p[0], SLAB + 0.25, p[1], 0.03); });
  for (k = 0; k < 5; k++) { add(group, new THREE.CylinderGeometry(0.14, 0.14, 0.7, 10), mats.hazY, -8.6 + k * 4.3, SLAB + 0.35, -8.7); }
  box(group, 2.6, 0.9, 0.12, mats.dark, -2.6, SLAB + 1.1, 4.0, 0.02);
  add(group, new THREE.BoxGeometry(2.3, 0.1, 0.05), mats.accent, -2.6, SLAB + 1.35, 3.94);
  strut([-3.5, SLAB, 4.0], [-3.5, SLAB + 1.0, 4.0], 0.04, mats.trim); strut([-1.7, SLAB, 4.0], [-1.7, SLAB + 1.0, 4.0], 0.04, mats.trim);

  /* ---------- Vapor del taller y destellos ---------- */
  var wk = 0;

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
  var beam2 = add(drone, new THREE.ConeGeometry(2.0, 9.0, 22, 1, true), glowMat(0xbfffe0, 0.05), 0, -4.9, 0);
  var patrolA = 0;
  function patrolPos(a) {
    var c = Math.cos(a), s = Math.sin(a);
    return [10.6 * (c < 0 ? -1 : 1) * Math.pow(Math.abs(c), 0.55), 12.8 + 0.4 * Math.sin(a * 3), 10.6 * (s < 0 ? -1 : 1) * Math.pow(Math.abs(s), 0.55)];
  }

  /* ---------- Estados, demostración y API ---------- */
  var mode = 'building', prog = 0.3, stock = 0.9, lastT = null, hold = 0, ghost = false, origEm = {}, tl = 0, flick = 1;
  var cranePh = 0, CY = 12, lastDropZ = segMid(2), dropZ = segMid(2), zCur = 0, xCur = 0, hCur = 10, loadOn = false;
  var weldOn = 0, conv = 0;
  var STZ = 6.3, STX = -5.6;
  function ikArm(R, dx, dy) {
    var d = Math.sqrt(dx * dx + dy * dy), mx = L1 + L2 - 0.06;
    if (d > mx) { dx *= mx / d; dy *= mx / d; d = mx; }
    if (d < 1.0) { d = 1.0; }
    var a = Math.atan2(dy, dx), cb = clamp((L1 * L1 + d * d - L2 * L2) / (2 * L1 * d), -1, 1), s = a + Math.acos(cb);
    var ex = L1 * Math.cos(s), ey = L1 * Math.sin(s), a2 = Math.atan2(dy - ey, dx - ex);
    R.sh.rotation.z = s; R.el.rotation.z = a2 - s;
    return [ex + (L2 + 0.62) * Math.cos(a2), ey + (L2 + 0.62) * Math.sin(a2)];
  }
  var WP = function () {
    return [
      [0, lastDropZ, 0, 10.0, 0], [0.12, STZ, STX, 10.0, 0], [0.24, STZ, STX, 3.55, 0], [0.27, STZ, STX, 3.55, 1], [0.40, STZ, STX, 10.0, 1],
      [0.64, dropZ, 0, 10.0, 1], [0.78, dropZ, 0, 4.75, 1], [0.80, dropZ, 0, 4.75, 0], [0.90, dropZ, 0, 10.0, 0], [1.0, dropZ, 0, 10.0, 0]
    ];
  };
  function craneTarget(ph) {
    var w = WP(), q = 0;
    while (q < w.length - 2 && ph > w[q + 1][0]) q++;
    var a = w[q], b = w[q + 1], f = sstep((ph - a[0]) / (b[0] - a[0]));
    return [a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f, a[3] + (b[3] - a[3]) * f, a[4]];
  }
  function pop(g, p0, pe) {
    var s = sstep((pe - p0) / 0.05);
    g.visible = s > 0.01;
    if (g.visible) g.scale.set(s, s, s);
  }
  var api = {
    group: group,
    footprint: { w: 18, d: 18 },
    input: inPort,                   // entrada de materiales (borde -X)
    output: outPort,                 // salida de naves (borde -Z), punto donde aparece la nave al lanzarse
    demo: true,
    patrol: true,
    drone: drone,
    getState: function () { return mode; },
    getProgress: function () { return prog; },
    getStock: function () { return stock; },
    setProgress: function (f) { prog = clamp(f, 0, 1); },
    setStock: function (f) { stock = clamp(f, 0, 1); },
    launch: function () { api.demo = false; mode = 'launch'; tl = 0; },
    setState: function (s) { api.demo = false; mode = s; if (s === 'launch') tl = 0; if (s === 'done') hold = 0; },
    setAccent: setAccent,
    setGhost: function (on, valid) {
      ghost = !!on;
      for (var key in mats) {
        var m = mats[key];
        if (!m.isMeshStandardMaterial && !m.isMeshBasicMaterial) continue;
        if (m.isMeshStandardMaterial && !origEm[key]) origEm[key] = { c: m.emissive.getHex(), i: m.emissiveIntensity };
        m.transparent = ghost || m === mats.weld || m === mats.spark; m.opacity = ghost ? 0.45 : (m === mats.weld || m === mats.spark ? 0.95 : 1); m.depthWrite = !ghost;
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
      if (mode === 'launch') tl += dt;
      if (api.demo) {
        if (mode === 'building') {
          prog += dt / 80; stock -= dt * 0.004;
          if (prog >= 1) { prog = 1; mode = 'done'; hold = 0; }
          else if (stock <= 0.03) { stock = 0.03; mode = 'waiting'; }
        } else if (mode === 'waiting') { stock += dt * 0.2; if (stock >= 0.8) mode = 'building'; }
        else if (mode === 'done') { hold += dt; if (hold > 3) { mode = 'launch'; tl = 0; } }
        else if (mode === 'launch') { if (tl > 3.6) { prog = 0; mode = 'building'; } }
      }
      var working = mode === 'building' && !ghost, broken = mode === 'broken';
      var pe = ghost ? 1 : prog, u = pe * (NSEG + 1), sAct = clamp(Math.floor(u), 0, NSEG - 1);
      // casco por tramos
      for (i = 0; i < NSEG; i++) {
        var f = clamp(u - i, 0, 1), sg3 = segs[i], e = sstep((f - 0.5) / 0.3);
        sg3.fr.visible = f > 0 && !(mode === 'launch' && tl > 3.6);
        sg3.pl.visible = f >= 0.5 && sg3.fr.visible;
        if (sg3.pl.visible) sg3.pl.scale.set(0.9 + 0.1 * e, 0.9 + 0.1 * e, 1);
      }
      supG.forEach(function (sp) { sp.g.visible = u - sp.s > 0 || ghost; });
      late.forEach(function (l) { pop(l.g, l.p0, pe); if (mode === 'launch' && tl > 3.6) l.g.visible = false; });
      // lanzamiento
      var lau = mode === 'launch' && !ghost;
      if (lau) {
        shipG.position.set(0, Y0 + 1.6 * tl * tl, -1.2 * tl * tl);
        shipG.rotation.x = 0.9 * sstep(tl / 1.5);
      } else { shipG.position.set(0, Y0, 0); shipG.rotation.x = 0; }
      flames.forEach(function (fl, q) { fl.visible = lau && tl < 3.6; fl.scale.set(1, 1, (0.8 + 0.4 * Math.sin(t * 40 + q)) * (0.5 + Math.min(1, tl))); });
      // puente grúa
      if (working) {
        cranePh += dt / CY;
        if (cranePh >= 1) { cranePh -= 1; lastDropZ = dropZ; dropZ = segMid(sAct); }
      }
      var tgt = working ? craneTarget(cranePh) : broken ? [zCur, xCur, hCur, 0] : [0, 0, 10.0, 0];
      var rate = Math.min(1, dt * 5);
      zCur += (tgt[0] - zCur) * rate; xCur += (tgt[1] - xCur) * rate; hCur += (tgt[2] - hCur) * rate;
      loadOn = working && tgt[3] === 1;
      bridge.position.z = zCur; trol.position.x = xCur;
      var hl = TROL0 - hCur;
      hook.position.y = -hl; cableM.scale.y = Math.max(0.1, hl - 0.25); cableM.position.y = -(hl - 0.25) / 2 - 0.1;
      load.visible = loadOn;
      hook.rotation.z = loadOn ? 0.03 * Math.sin(t * 1.6) : 0;
      // robots de soldadura
      var wTarget = working && pe > 0.03 && pe < 0.995 ? 1 : 0;
      weldOn += (wTarget - weldOn) * Math.min(1, dt * 2);
      robots.forEach(function (R, q) {
        var zd = segMid(sAct) - (q ? 1.1 : -0.2) + 0.7 * Math.sin(t * 0.7 + q * 2);
        if (!working && !broken) zd = (q ? -4.5 : -6.5);
        if (!broken) R.z += (zd - R.z) * Math.min(1, dt * 1.6);
        R.rg.position.set(R.side * RBX, 0, R.z);
        var wz = R.z, wx = hullAt(wz, 'w') + 0.08;
        var ty = Y0 + 0.35 + 0.35 * Math.sin(t * 2.6 + q * 1.5) - SHY - 0.1;
        var tx = RBX - wx - 0.55;
        var hx = 2.3, hy2 = 1.0;
        var dx = hx + (tx - hx) * weldOn, dy = hy2 + (ty - hy2) * weldOn;
        if (broken) { dx += 0.2 * Math.sin(t * 13 + q); dy += 0.2 * Math.sin(t * 17); }
        var tip = ikArm(R, dx, dy);
        var wxw = R.side < 0 ? -RBX + tip[0] : RBX - tip[0], wyw = SHY + 0.1 + tip[1];
        var hot = ((weldOn > 0.6 && working) || (broken && Math.sin(t * 9 + q * 3) > 0.2)) && !ghost;
        R.tg.visible = hot; R.tg.scale.setScalar(0.7 + 0.5 * Math.abs(Math.sin(t * 47 + q)));
        R.sp.forEach(function (s) {
          var ph = (t * 2.4 + s.ph) % 1;
          s.m.visible = hot;
          if (hot) s.m.position.set(wxw + R.side * s.vx * ph * 0.7, wyw + s.vy * ph - 2.0 * ph * ph, R.z + s.vz * ph);
        });
      });
      // cinta, pila y paneles
      var feeding = (mode === 'building' || mode === 'waiting') && !ghost;
      if (feeding) conv += dt * (mode === 'waiting' ? 0.5 : 0.22);
      for (i = 0; i < 5; i++) {
        _d.position.set(-8.75 + ((i / 5 + conv) % 1) * 2.15, SLAB + 0.77, 6.3); _d.rotation.y = 0; _d.scale.set(0.5, 0.36, 0.5); _d.updateMatrix(); crates.setMatrixAt(i, _d.matrix);
      }
      crates.instanceMatrix.needsUpdate = true;
      var stf = Math.max(0.06, stock);
      stackM.scale.y = stf * 1.5; stackM.position.y = 0.14 + stf * 0.75;
      barP.scale.x = Math.max(0.001, pe) * 2.8; barP.position.x = -1.4 + barP.scale.x / 2 + 0.0;
      barM.scale.x = Math.max(0.001, stock) * 2.8; barM.position.x = -1.4 + barM.scale.x / 2;
      // taller, generadores, radar
      var busy = (working || mode === 'waiting') ? 1 : 0;
      wFans.forEach(function (b, q) { if (working) b.rotation.y += dt * (q ? -9 : 9); });
      gens.forEach(function (g, q) { g.visible = mode !== 'off'; g.material.color.setHex(working || lau ? (Math.sin(t * 8 + q) > -0.2 ? 0x6ff0ff : 0x2a9fb0) : 0x1a5560); });
      mats.forge.color.setHex(working ? 0xff8a2a : 0x401a08);
      radar.rotation.y += dt * (mode === 'off' ? 0 : 1.2);
      wPuffs.forEach(function (p) {
        var ph = (t * 0.3 + p.ph) % 1;
        p.m.visible = working;
        if (working) { p.m.position.set(WX + 1.1 + ph * 0.9, SLAB + 5.1 + ph * 2.2, WZ + 1.6); p.m.scale.setScalar(0.6 + ph * 2.0); p.m.material.opacity = (1 - ph) * 0.28; }
      });
      // lámpara de estado
      var col = mode === 'building' ? 0x35ff7a : mode === 'waiting' ? 0xffd030 : mode === 'done' ? 0x35e0ff : mode === 'launch' ? 0xffffff : mode === 'broken' ? 0xffa31a : 0x303030;
      if (mode === 'waiting' || mode === 'broken' || mode === 'launch') mats.status.color.setHex(Math.sin(t * 6) > 0 ? col : 0x301010); else mats.status.color.setHex(col);
      mastHalo.material.color.setHex(col); mastHalo.material.opacity = mode === 'off' ? 0 : 0.2 + 0.15 * Math.sin(t * 4);
      for (i = 0; i < blinkers.length; i++) blinkers[i].m.visible = mode !== 'off' && Math.sin(t * TAU / blinkers[i].per + blinkers[i].ph) > -0.2;
      // dron
      var pon = api.patrol, p, p1, p0;
      if (pon) { patrolA += dt * 0.2; p = patrolPos(patrolA); p1 = patrolPos(patrolA + 0.03); p0 = patrolPos(patrolA - 0.03); }
      else { p = [0.0, 12.8 + 0.12 * Math.sin(t * 1.5), CZ]; p1 = p; p0 = p; }
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
