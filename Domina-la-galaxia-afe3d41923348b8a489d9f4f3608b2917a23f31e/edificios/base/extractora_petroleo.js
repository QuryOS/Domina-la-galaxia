/**
 * Extractora de petróleo espacial para Three.js, sin archivos externos (máquina para colocar en el planeta).
 *
 * Balancín (cabeza de caballo) con poste en A, viga con arco, bielas, contrapesos giratorios, caja de engranajes y
 * motor; árbol de válvulas del pozo con charola de contención; 2 tanques esféricos con patas, pasarela, escalera
 * e indicadores de nivel; tuberías con válvulas, mirillas con gotas de petróleo, manifold y bomba de carga;
 * depurador y antorcha de gas con llama animada y vientos; cabina de control, grupo electrógeno y un dron
 * esférico con antena luminosa que patrulla alrededor.
 *
 * Uso:
 *   const oil = createExtractoraPetroleo(THREE, { accent: 0xe8512a });
 *   oil.group.position.set(x, groundY, z);        // la base de la losa está en y = 0
 *   scene.add(oil.group);
 *   oil.update(clock.getElapsedTime());
 *
 * Escala: 1 unidad = 4 m. Huella: 10 x 10 unidades (oil.footprint), centrada en el origen.
 * Salida del petróleo: oil.output (Object3D en el borde +X, para conectar tu cañería o camión cisterna).
 *
 * Estados (oil.setState): 'working' el balancín bombea y llena los tanques, 'full' tanques llenos (lámpara roja),
 *   'unload' la bomba de carga vacía los tanques por la salida, 'broken' (lámpara naranja), 'off' (apagada).
 *   Por defecto corre un ciclo de demostración (oil.demo = true); setState lo desactiva.
 * oil.setFill(0..1) / getFill(): nivel de los tanques (tu lógica de juego lo controla con demo = false).
 * oil.setGhost(true, valid): modo "fantasma" para colocar (verde si valid, rojo si valid === false);
 *   oil.setGhost(false) vuelve a lo normal.
 * oil.patrol = false deja el dron quieto sobre la cabina; oil.drone es su grupo.
 * oil.setAccent(hex): color de pintura.
 * Compatible con Three.js r128 o superior.
 */
function createExtractoraPetroleo(THREE, opts) {
  opts = opts || {};
  var P = Math.PI, TAU = P * 2;
  var colors = {
    hull: opts.hull != null ? opts.hull : 0xd3d7dd,
    accent: opts.accent != null ? opts.accent : 0xe8512a,
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
  mats.oil = new THREE.MeshStandardMaterial({ color: 0x0b0a0c, metalness: 0.6, roughness: 0.2 });
  mats.status = new THREE.MeshBasicMaterial({ color: 0x35ff7a });
  mats.pipe = new THREE.MeshStandardMaterial({ color: 0x8892a2, metalness: 0.7, roughness: 0.35 });
  mats.tank = new THREE.MeshStandardMaterial({ color: 0xe4e8ee, metalness: 0.5, roughness: 0.3 });
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
  function valve(x, y, z, axisX) {          // válvula de compuerta con volante
    add(group, roundedBox(axisX ? 0.26 : 0.3, 0.3, axisX ? 0.3 : 0.26, 0.05, 2), mats.hull2, x, y, z);
    strut([x, y + 0.14, z], [x, y + 0.42, z], 0.03, mats.trim);
    add(group, new THREE.TorusGeometry(0.15, 0.025, 6, 16).rotateX(P / 2), mats.accent, x, y + 0.43, z);
  }
  var SLAB = 0.4;

  /* ---------- Losa y franjas de seguridad ---------- */
  add(group, roundedBox(10, SLAB, 10, 0.08, 3), mats.slab, 0, SLAB / 2, 0);
  var stA = [], stB = [], k, j;
  for (k = 0; k < 20; k++) {
    var pos = -4.75 + k * 0.5, tgt = k % 2 ? stA : stB;
    tgt.push({ x: pos, y: SLAB + 0.01, z: 4.85, sx: 0.5, sy: 0.02, sz: 0.3 });
    tgt.push({ x: pos, y: SLAB + 0.01, z: -4.85, sx: 0.5, sy: 0.02, sz: 0.3 });
    tgt.push({ x: 4.85, y: SLAB + 0.01, z: pos, sx: 0.3, sy: 0.02, sz: 0.5 });
    tgt.push({ x: -4.85, y: SLAB + 0.01, z: pos, sx: 0.3, sy: 0.02, sz: 0.5 });
  }
  group.add(boxField(UB, mats.accent, stA));
  group.add(boxField(UB, mats.dark, stB));
  var seams = [], stains = [];
  [-2.5, 0, 2.5].forEach(function (v) {
    seams.push({ x: 0, y: SLAB + 0.006, z: v, sx: 9.7, sy: 0.012, sz: 0.035 });
    seams.push({ x: v, y: SLAB + 0.006, z: 0, sx: 0.035, sy: 0.012, sz: 9.7 });
  });
  group.add(boxField(UB, mats.dark, seams));
  for (k = 0; k < 16; k++) stains.push({ x: (rnd() - 0.5) * 9, y: SLAB + 0.004, z: (rnd() - 0.5) * 9, ry: rnd() * 3, sx: 0.4 + rnd() * 1.1, sy: 0.008, sz: 0.3 + rnd() * 0.9 });
  group.add(boxField(UB, mats.trim, stains));

  /* ---------- Balancín (cabeza de caballo) ---------- */
  var SKZ = 0.45;
  add(group, roundedBox(1.4, 0.3, 5.5, 0.06, 3), mats.hull2, 0, SLAB + 0.15, SKZ);                         // patín
  add(group, new THREE.BoxGeometry(0.05, 0.02, 5.4), mats.accent, 0.5, SLAB + 0.31, SKZ);
  add(group, new THREE.BoxGeometry(0.05, 0.02, 5.4), mats.accent, -0.5, SLAB + 0.31, SKZ);
  var SK = SLAB + 0.3;                                                                                      // cara superior del patín
  var PIV = [0, 4.45, -0.5], R1 = 2.6, R2 = 2.4;
  [-1, 1].forEach(function (s) {                                                                            // poste en A
    strut([s * 0.62, SK, -1.4], [s * 0.3, PIV[1], PIV[2]], 0.07, mats.accent);
    strut([s * 0.62, SK, 0.4], [s * 0.3, PIV[1], PIV[2]], 0.07, mats.accent);
    strut([s * 0.62, SK, -1.4], [s * 0.62, SK, 0.4], 0.05, mats.hull2);
    add(group, new THREE.BoxGeometry(0.2, 0.06, 0.4), mats.plate, s * 0.62, SK + 0.03, -0.5);
    cyl(0.17, 0.16, 'x', mats.plate, s * 0.3, PIV[1], PIV[2], 16);                                          // soportes del eje
  });
  [-1.136, 0.136].forEach(function (bz) { strut([-0.526, 1.8, bz], [0.526, 1.8, bz], 0.04, mats.hull2); });
  strut([-0.526, 1.8, -1.136], [0.526, 1.8, 0.136], 0.03, mats.hull2);
  strut([0.526, 1.8, -1.136], [-0.526, 1.8, 0.136], 0.03, mats.hull2);
  [-0.75, -0.25].forEach(function (bz) { strut([-0.39, 3.4, bz], [0.39, 3.4, bz], 0.045, mats.hull2); });
  cyl(0.1, 0.9, 'x', mats.dark, 0, PIV[1], PIV[2], 14);                                                      // eje central

  var beam = new THREE.Group();
  beam.position.set(PIV[0], PIV[1], PIV[2]);
  group.add(beam);
  add(beam, roundedBox(0.34, 0.5, 5.0, 0.06, 2), mats.hull, 0, 0, -0.1);
  [-1, 1].forEach(function (s) { add(beam, roundedBox(0.5, 0.07, 5.0, 0.03, 2), mats.accent, 0, s * 0.27, -0.1); });
  var hh = new THREE.CylinderGeometry(R1, R1, 0.34, 30, 1, true, P - 0.42, 0.84); hh.rotateZ(P / 2);       // cabeza de caballo (arco)
  add(beam, hh, mats.accent, 0, 0, 0);
  [-1, 1].forEach(function (s) {
    var yy = Math.sin(0.42) * R1, zz = -Math.cos(0.42) * R1;
    var ex = s * 0.15;
    [[ex, yy, zz], [ex, -yy, zz], [ex, 0, -R1]].forEach(function (e) {
      var m = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1, 6), mats.hull2);
      placeStrut(m, [ex, 0, -2.4], e); beam.add(m);
    });
  });
  add(beam, roundedBox(1.7, 0.1, 0.14, 0.03, 2), mats.plate, 0, -0.45, 2.35);                              // barra igualadora
  [-1, 1].forEach(function (s) { add(beam, roundedBox(0.07, 0.55, 0.18, 0.02, 2), mats.hull2, s * 0.12, -0.2, 2.35); });
  add(beam, roundedBox(0.4, 0.2, 0.6, 0.05, 2), mats.dark, 0, 0.02, 0);                                      // silla del eje

  // caja de engranajes, contrapesos, motor
  var AX = [0, 2.0, 1.9], CR = 0.5, LP = 2.0;
  add(group, roundedBox(0.8, 0.85, 1.1, 0.08, 2), mats.hull2, 0, SK + 0.425, AX[2]);                         // pedestal
  add(group, roundedBox(0.9, 0.95, 1.3, 0.12, 3), mats.hull, 0, AX[1], AX[2]);                               // caja de engranajes
  add(group, new THREE.BoxGeometry(0.92, 0.12, 1.32), mats.accent, 0, AX[1] + 0.3, AX[2]);
  cyl(0.12, 1.6, 'x', mats.dark, 0, AX[1], AX[2], 14);
  var cranks = [], pins = [];
  [-1, 1].forEach(function (s) {
    var cg = new THREE.Group();
    cg.position.set(s * 0.66, AX[1], AX[2]);
    group.add(cg);
    var cw = new THREE.CylinderGeometry(0.85, 0.85, 0.22, 26, 1, false, P, P); cw.rotateZ(P / 2);
    add(cg, cw, mats.accent, 0, 0, 0);
    add(cg, roundedBox(0.22, 0.6, 0.22, 0.04, 2), mats.dark, 0, CR / 2, 0);
    var pinG = new THREE.CylinderGeometry(0.07, 0.07, 0.4, 10); pinG.rotateZ(P / 2);
    add(cg, pinG, mats.plate, s * 0.1, CR, 0);
    cranks.push(cg);
  });
  add(group, roundedBox(0.6, 0.5, 0.8, 0.1, 2), mats.hull, 0, SK + 0.25, 2.75);                              // motor
  add(group, new THREE.CylinderGeometry(0.2, 0.2, 0.1, 14), mats.plate, 0, SK + 0.25, 2.33).rotation.x = P / 2;
  strut([0, SK + 0.5, 2.7], [0, AX[1] - 0.1, 2.35], 0.14, mats.hull2);                                      // protector de correa
  var pitmanMeshes = [-1, 1].map(function () {
    var m = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 1, 8), mats.dark);
    group.add(m); return m;
  });
  var cableMeshes = [-1, 1].map(function () {
    var m = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1, 6), mats.dark);
    group.add(m); return m;
  });
  var carrier = add(group, roundedBox(0.5, 0.1, 0.12, 0.03, 2), mats.plate, 0, 3.0, PIV[2] - R1);
  var rodM = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1, 10), mats.pipe);
  group.add(rodM);
  var WHZ = PIV[2] - R1;      // z del pozo (-3.1)

  // pozo: árbol de navidad
  add(group, roundedBox(1.6, 0.12, 1.6, 0.03, 2), mats.trim, 0, SLAB + 0.06, WHZ);                           // charola de contención
  [[0, -0.8, 1.6, 0.14], [0, 0.8, 1.6, 0.14], [-0.8, 0, 0.14, 1.6], [0.8, 0, 0.14, 1.6]].forEach(function (b) {
    add(group, roundedBox(b[2], 0.22, b[3], 0.04, 2), mats.accent, b[0], SLAB + 0.11, WHZ + b[1]);
  });
  cyl(0.5, 0.14, 'y', mats.plate, 0, SLAB + 0.19, WHZ, 22);
  cyl(0.28, 0.72, 'y', mats.pipe, 0, SLAB + 0.55, WHZ, 18);
  cyl(0.15, 0.4, 'y', mats.pipe, 0, 1.28, WHZ, 12);
  cyl(0.2, 0.45, 'y', mats.hull2, 0, 1.5, WHZ, 14);
  cyl(0.09, 1.1, 'x', mats.pipe, 0, 1.0, WHZ, 12);
  valve(-0.45, 1.0, WHZ, true); valve(0.45, 1.0, WHZ, true);
  cyl(0.1, 0.04, 'z', mats.window, 0.1, 1.0, WHZ + 0.3, 12);
  strut([0.1, 1.0, WHZ], [0.1, 1.0, WHZ + 0.28], 0.025, mats.trim);
  rodM.visible = true;

  // cinemática (biela-manivela resuelta cada cuadro)
  var tmpA = [0, 0, 0], tmpB = [0, 0, 0], crankPhi = 0;
  function barPt(b) { var c = Math.cos(b), s = Math.sin(b); return [PIV[1] + (-0.45 * c - 2.35 * s), PIV[2] + (-0.45 * s + 2.35 * c)]; }
  function solveBeta(phi) {
    var py = AX[1] + CR * Math.cos(phi), pz = AX[2] + CR * Math.sin(phi), lo = -0.5, hi = 0.5, mid, i;
    for (i = 0; i < 28; i++) {
      mid = (lo + hi) / 2;
      var t = barPt(mid), d = Math.sqrt((t[0] - py) * (t[0] - py) + (t[1] - pz) * (t[1] - pz)) - LP;
      if (d > 0) lo = mid; else hi = mid;
    }
    return (lo + hi) / 2;
  }
  function poseJack(phi) {
    var b = solveBeta(phi), t = barPt(b);
    beam.rotation.x = b;
    cranks[0].rotation.x = cranks[1].rotation.x = phi;
    var py = AX[1] + CR * Math.cos(phi), pz = AX[2] + CR * Math.sin(phi);
    [-1, 1].forEach(function (s, i) { placeStrut(pitmanMeshes[i], [s * 0.82, t[0], t[1]], [s * 0.82, py, pz]); });
    var yc = 3.0 + R1 * b;
    carrier.position.y = yc;
    [-1, 1].forEach(function (s, i) { placeStrut(cableMeshes[i], [s * 0.15, PIV[1], WHZ], [s * 0.15, yc, WHZ]); });
    placeStrut(rodM, [0, yc, WHZ], [0, 1.45, WHZ]);
  }
  poseJack(0);

  /* ---------- Tanques esféricos, tuberías y manifold ---------- */
  var TX = 3.2, TY = 2.6, TR = 1.2, tanks = [-2.0, 1.6], gauges = [];
  tanks.forEach(function (tz, ti) {
    add(group, new THREE.SphereGeometry(TR, 36, 26), mats.tank, TX, TY, tz);
    add(group, new THREE.TorusGeometry(TR, 0.03, 6, 40).rotateX(P / 2), mats.accent, TX, TY, tz);
    add(group, new THREE.TorusGeometry(TR * 0.97, 0.03, 6, 40).rotateX(P / 2), mats.hull2, TX, TY + 0.4, tz);
    add(group, new THREE.TorusGeometry(Math.sqrt(TR * TR - 0.16) , 0.03, 6, 40).rotateX(P / 2), mats.hull2, TX, TY - 0.4, tz);
    for (k = 0; k < 6; k++) {                                                                               // 6 patas con aro de refuerzo
      var a = (30 + 60 * k) * P / 180, top = [TX + Math.sin(1.92) * TR * Math.cos(a) * 0.98, TY + Math.cos(1.92) * TR, tz + Math.sin(1.92) * TR * Math.sin(a) * 0.98];
      strut([TX + 1.25 * Math.cos(a), SLAB, tz + 1.25 * Math.sin(a)], top, 0.07, mats.accent);
      add(group, roundedBox(0.3, 0.08, 0.3, 0.02, 1), mats.plate, TX + 1.25 * Math.cos(a), SLAB + 0.04, tz + 1.25 * Math.sin(a));
      var a2 = (30 + 60 * (k + 1)) * P / 180;
      strut([TX + 1.14 * Math.cos(a), 1.75, tz + 1.14 * Math.sin(a)], [TX + 1.14 * Math.cos(a2), 1.75, tz + 1.14 * Math.sin(a2)], 0.035, mats.hull2);
    }
    cyl(0.55, 0.06, 'y', mats.trim, TX, TY + TR + 0.03, tz, 20);                                            // plataforma superior
    cyl(0.25, 0.1, 'y', mats.plate, TX, TY + TR + 0.1, tz, 16);
    [[-0.3, 0.2], [0.3, -0.2]].forEach(function (v, vi) {
      strut([TX + v[0], TY + TR + 0.06, tz + v[1]], [TX + v[0], TY + TR + (vi ? 0.9 : 0.6), tz + v[1]], 0.04, mats.pipe);
      add(group, new THREE.CylinderGeometry(0.08, 0.04, 0.1, 10), mats.accent, TX + v[0], TY + TR + (vi ? 0.95 : 0.65), tz + v[1]);
    });
    // indicador de nivel externo
    cyl(0.07, 1.7, 'y', mats.sight, TX + 1.45, 2.6, tz, 12);
    [1.75, 3.45].forEach(function (gy) {
      var sx = TX + Math.sqrt(TR * TR - (gy - TY) * (gy - TY)) - 0.05;
      strut([sx, gy, tz], [TX + 1.45, gy, tz], 0.03, mats.pipe);
    });
    var lv = add(group, new THREE.BoxGeometry(0.07, 1, 0.07), mats.status, TX + 1.45, 1.76, tz);
    gauges.push(lv);
  });
  // pasarela entre plataformas y escalera
  add(group, roundedBox(0.5, 0.05, 2.5, 0.02, 1), mats.trim, TX, TY + TR + 0.04, (tanks[0] + tanks[1]) / 2);
  var lxl = 1.75;
  [-0.18, 0.18].forEach(function (dz) { strut([lxl, SLAB, tanks[0] + dz], [lxl, TY + TR + 0.2, tanks[0] + dz], 0.025, mats.trim); });
  var lad = [];
  for (k = 0; k < 11; k++) lad.push({ x: lxl, y: 0.65 + k * 0.31, z: tanks[0], sx: 0.035, sy: 0.035, sz: 0.36 });
  group.add(boxField(UB, mats.trim, lad));
  add(group, roundedBox(1.55, 0.05, 0.5, 0.02, 1), mats.trim, (lxl + TX - 0.55) / 2 + 0.2, TY + TR + 0.04, tanks[0]);

  // línea de entrada: pozo -> tanque 1 (por el fondo)
  var FY = 1.0;
  strut([0.5, FY, WHZ], [1.3, FY, WHZ], 0.1, mats.pipe);
  strut([1.9, FY, WHZ], [2.85, FY, WHZ], 0.1, mats.pipe);
  cyl(0.15, 0.06, 'x', mats.plate, 1.3, FY, WHZ, 14); cyl(0.15, 0.06, 'x', mats.plate, 1.9, FY, WHZ, 14);
  strut([2.85, FY, WHZ], [2.85, FY, tanks[0]], 0.1, mats.pipe);
  strut([2.85, FY, tanks[0]], [2.85, 1.46, tanks[0]], 0.1, mats.pipe);
  elbow(2.85, FY, WHZ); elbow(2.85, FY, tanks[0]);
  valve(1.1, FY, WHZ, true); valve(2.85, FY, -2.65, false);
  // manifold de salida: fondos de los dos tanques
  var MX = 3.55, MY = 0.95;
  [tanks[0], tanks[1]].forEach(function (tz) { strut([MX, 1.46, tz], [MX, MY, tz], 0.1, mats.pipe); elbow(MX, MY, tz); });
  strut([MX, MY, tanks[0]], [MX, MY, tanks[1]], 0.1, mats.pipe);
  valve(MX, MY, -1.0, false); valve(MX, MY, 0.9, false);
  var OZ = -0.2;
  elbow(MX, MY, OZ);
  strut([MX, MY, OZ], [3.72, MY, OZ], 0.1, mats.pipe);
  cyl(0.14, 0.45, 'x', mats.sight, 3.95, MY, OZ, 14);                                                          // mirilla de salida
  cyl(0.15, 0.06, 'x', mats.plate, 3.71, MY, OZ, 14); cyl(0.15, 0.06, 'x', mats.plate, 4.19, MY, OZ, 14);
  strut([4.2, MY, OZ], [4.3, MY, OZ], 0.1, mats.pipe);
  // bomba de carga
  add(group, roundedBox(1.0, 0.2, 1.2, 0.04, 2), mats.trim, 4.5, SLAB + 0.1, 0.1);
  var volute = cyl(0.32, 0.3, 'z', mats.hull2, 4.5, MY, OZ, 20);
  add(group, roundedBox(0.5, 0.5, 0.7, 0.08, 2), mats.hull, 4.5, MY, 0.35);
  var flywheel = new THREE.Group();
  flywheel.position.set(4.5, MY, 0.0);
  group.add(flywheel);
  var fw = new THREE.CylinderGeometry(0.2, 0.2, 0.05, 16); fw.rotateX(P / 2);
  add(flywheel, fw, mats.accent, 0, 0, 0);
  add(flywheel, new THREE.BoxGeometry(0.3, 0.04, 0.06), mats.dark, 0, 0, 0.03);
  strut([4.7, MY, OZ], [5.0, MY, OZ], 0.1, mats.pipe);
  cyl(0.2, 0.1, 'x', mats.plate, 5.02, MY, OZ, 16);
  var outPort = new THREE.Object3D();
  outPort.position.set(5.2, MY, OZ);
  group.add(outPort);

  // gotas de petróleo en las mirillas
  var blobsIn = new THREE.InstancedMesh(new THREE.SphereGeometry(0.07, 8, 6), mats.oil, 6);
  var blobsOut = new THREE.InstancedMesh(new THREE.SphereGeometry(0.07, 8, 6), mats.oil, 6);
  blobsIn.frustumCulled = blobsOut.frustumCulled = false;
  group.add(blobsIn); group.add(blobsOut);
  cyl(0.14, 0.6, 'x', mats.sight, 1.6, FY, WHZ, 14);
  var tmp = new THREE.Object3D(), flowIn = 0, flowOut = 0;
  function placeBlobs(inst, x0, len, y, z, off) {
    for (var q = 0; q < 6; q++) {
      tmp.position.set(x0 + ((q / 6 + off) % 1) * len, y, z);
      tmp.scale.set(1, 1, 1); tmp.rotation.set(0, 0, 0);
      tmp.updateMatrix();
      inst.setMatrixAt(q, tmp.matrix);
    }
    inst.instanceMatrix.needsUpdate = true;
  }

  /* ---------- Antorcha de gas con depurador y vientos ---------- */
  var FXs = -4.5, FZs = WHZ;
  cyl(0.45, 0.12, 'y', mats.plate, FXs, SLAB + 0.06, FZs, 20);
  var stack = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.2, 9.4, 14), mats.hull2);
  stack.position.set(FXs, SLAB + 4.7, FZs); group.add(stack);
  [2.5, 5.0, 7.5].forEach(function (y) { add(group, new THREE.TorusGeometry(0.2 - (y / 9.4) * 0.1 + 0.02, 0.03, 6, 16).rotateX(P / 2), mats.accent, FXs, y, FZs); });
  add(group, new THREE.CylinderGeometry(0.2, 0.1, 0.4, 14), mats.dark, FXs, SLAB + 9.5, FZs);
  [[-1.0, -1.0], [3.0, -3.0], [-1.0, 2.2]].forEach(function (an, ai) {
    var anc = [FXs + an[0] * 1.0, SLAB, FZs + an[1] * 1.0];
    if (ai === 0) anc = [-4.8, SLAB, -0.8]; else if (ai === 1) anc = [-1.5, SLAB, -4.8]; else anc = [-4.8, SLAB, -4.8];
    strut([FXs, 7.6, FZs], [anc[0], SLAB + 0.05, anc[2]], 0.012, mats.dark);
    add(group, roundedBox(0.25, 0.1, 0.25, 0.03, 1), mats.trim, anc[0], SLAB + 0.05, anc[2]);
  });
  var drum = cyl(0.5, 1.8, 'x', mats.hull2, -2.8, SLAB + 0.55, FZs, 22);
  [-3.3, -2.3].forEach(function (dx) { add(group, roundedBox(0.2, 0.3, 0.9, 0.04, 2), mats.plate, dx, SLAB + 0.15, FZs); });
  add(group, new THREE.SphereGeometry(0.5, 16, 12), mats.hull2, -3.7, SLAB + 0.55, FZs);
  add(group, new THREE.SphereGeometry(0.5, 16, 12), mats.hull2, -1.9, SLAB + 0.55, FZs);
  cyl(0.52, 0.12, 'x', mats.accent, -2.8, SLAB + 0.55, FZs, 22);
  strut([-0.45, FY, WHZ], [-1.9, FY, WHZ], 0.08, mats.pipe);
  strut([-3.7, 0.95, FZs], [FXs, 0.95, FZs], 0.08, mats.pipe);
  valve(-1.0, FY, WHZ, true);
  add(group, new THREE.CylinderGeometry(0.15, 0.15, 0.04, 14).rotateX(P / 2), mats.window, -2.8, SLAB + 0.55, FZs + 0.58);
  // llama
  var flame = new THREE.Group();
  flame.position.set(FXs, SLAB + 9.7, FZs);
  group.add(flame);
  var fo = new THREE.ConeGeometry(0.3, 1.8, 14, 1, true); fo.translate(0, 0.9, 0);
  var fi = new THREE.ConeGeometry(0.17, 1.1, 12, 1, true); fi.translate(0, 0.55, 0);
  var flameO = add(flame, fo, glowMat(0xff7a1f, 0.65), 0, 0, 0), flameI = add(flame, fi, glowMat(0xffe27a, 0.85), 0, 0, 0);
  var flameHalo = add(flame, new THREE.SphereGeometry(0.7, 14, 10), glowMat(0xff9a40, 0.18), 0, 0.7, 0);
  var pilot = add(flame, new THREE.SphereGeometry(0.07, 8, 6), glowMat(0xffd27a, 0.9), 0.12, -0.05, 0);

  /* ---------- Cabina de control ---------- */
  var CX = -3.4, CZ = 3.0;
  add(group, roundedBox(2.2, 1.9, 2.6, 0.25, 3), mats.hull, CX, SLAB + 0.95, CZ);
  add(group, roundedBox(2.4, 0.18, 2.8, 0.06, 2), mats.plate, CX, SLAB + 1.95, CZ);
  add(group, new THREE.BoxGeometry(0.06, 0.2, 2.62), mats.accent, CX + 1.13, SLAB + 1.55, CZ);
  add(group, roundedBox(0.08, 0.7, 1.7, 0.03, 2), mats.glass, CX + 1.13, SLAB + 1.2, CZ + 0.35);
  add(group, roundedBox(0.08, 1.2, 0.7, 0.03, 2), mats.dark, CX + 1.13, SLAB + 0.65, CZ - 0.7);
  add(group, new THREE.BoxGeometry(1.4, 0.5, 0.04), mats.glass, CX, SLAB + 1.2, CZ + 1.32);
  add(group, new THREE.BoxGeometry(1.4, 0.5, 0.04), mats.glass, CX, SLAB + 1.2, CZ - 1.32);
  add(group, roundedBox(0.7, 0.3, 1.0, 0.04, 2), mats.plate, CX + 1.45, SLAB + 0.15, CZ - 0.7);
  [-0.45, 0.45].forEach(function (dz) { strut([CX + 1.7, SLAB + 0.3, CZ - 0.7 + dz], [CX + 1.7, SLAB + 1.0, CZ - 0.7 + dz], 0.025, mats.accent); });
  strut([CX + 1.7, SLAB + 1.0, CZ - 1.15], [CX + 1.7, SLAB + 1.0, CZ - 0.25], 0.025, mats.accent);
  add(group, roundedBox(0.8, 0.35, 0.8, 0.08, 2), mats.hull2, CX - 0.4, SLAB + 2.2, CZ + 0.6);
  var sol = add(group, new THREE.BoxGeometry(1.4, 0.05, 0.95), mats.glass, CX + 0.4, SLAB + 2.5, CZ - 0.7);
  sol.rotation.x = -0.3;
  [[-0.3, -1.15, 2.43], [1.1, -1.15, 2.43], [-0.3, -0.35, 2.62], [1.1, -0.35, 2.62]].forEach(function (p) { strut([CX + p[0], SLAB + 2.04, CZ + p[1] + 0.2], [CX + p[0], SLAB + p[2], CZ + p[1] + 0.2], 0.025, mats.trim); });
  add(group, new THREE.CylinderGeometry(0.03, 0.03, 1.6, 6), mats.trim, CX - 0.7, SLAB + 2.82, CZ - 0.4);
  add(group, new THREE.CylinderGeometry(0.04, 0.04, 1.0, 6), mats.trim, CX + 0.8, SLAB + 2.55, CZ + 1.1);
  var statusLamp = add(group, new THREE.SphereGeometry(0.16, 14, 10), mats.status, CX + 0.8, SLAB + 3.15, CZ + 1.1);

  /* ---------- Grupo electrógeno, bandejas y tanque químico ---------- */
  add(group, roundedBox(2.4, 1.0, 1.1, 0.12, 3), mats.hull, 3.2, SLAB + 0.5, 4.0);
  add(group, new THREE.BoxGeometry(2.42, 0.1, 1.12), mats.accent, 3.2, SLAB + 0.85, 4.0);
  var fins = [];
  for (k = 0; k < 8; k++) fins.push({ x: 4.46, y: SLAB + 0.5, z: 3.6 + k * 0.1, sx: 0.12, sy: 0.8, sz: 0.04 });
  group.add(boxField(UB, mats.dark, fins));
  strut([2.6, SLAB + 1.0, 4.0], [2.6, SLAB + 2.7, 4.0], 0.08, mats.dark);
  add(group, new THREE.CylinderGeometry(0.18, 0.18, 0.5, 14), mats.hull2, 2.6, SLAB + 1.45, 4.0);
  add(group, new THREE.CylinderGeometry(0.15, 0.08, 0.15, 12), mats.plate, 2.6, SLAB + 2.75, 4.0);
  add(group, new THREE.BoxGeometry(0.6, 0.35, 0.04), mats.glass, 3.2, SLAB + 0.55, 3.43);
  add(group, new THREE.BoxGeometry(1.7, 0.08, 0.3), mats.trim, 1.0, SLAB + 0.04, 4.0);
  add(group, new THREE.BoxGeometry(0.3, 0.08, 0.9), mats.trim, 0.0, SLAB + 0.04, 3.65);
  strut([0.0, SLAB + 0.08, 3.25], [0.0, SK + 0.35, 3.1], 0.04, mats.trim);
  cyl(0.28, 0.9, 'y', mats.accent, 1.3, SLAB + 0.45, 4.5, 16);
  add(group, new THREE.CylinderGeometry(0.1, 0.1, 0.2, 10), mats.plate, 1.3, SLAB + 0.95, 4.5);
  add(group, roundedBox(0.3, 0.3, 0.3, 0.05, 2), mats.hull, 0.8, SLAB + 0.15, 4.5);

  /* ---------- Detalles de losa: bolardos, farolas, carteles ---------- */
  [-4.0, -3.4, -2.8].forEach(function (bz) {
    add(group, new THREE.CylinderGeometry(0.1, 0.1, 0.6, 10), mats.hull, 4.75, SLAB + 0.3, bz);
    add(group, new THREE.CylinderGeometry(0.105, 0.105, 0.14, 10), mats.accent, 4.75, SLAB + 0.5, bz);
  });
  [[4.6, -4.6], [-4.6, 4.7], [4.6, 4.7]].forEach(function (p) {
    strut([p[0], SLAB, p[1]], [p[0], SLAB + 3.6, p[1]], 0.06, mats.trim);
    add(group, roundedBox(0.5, 0.14, 0.3, 0.04, 2), mats.dark, p[0] - Math.sign(p[0]) * 0.15, SLAB + 3.62, p[1]);
    add(group, new THREE.BoxGeometry(0.4, 0.04, 0.22), mats.window, p[0] - Math.sign(p[0]) * 0.15, SLAB + 3.55, p[1]);
  });
  [[-2.0, 4.4], [1.6, -4.55]].forEach(function (p) {
    strut([p[0], SLAB, p[1]], [p[0], SLAB + 1.2, p[1]], 0.04, mats.trim);
    add(group, new THREE.BoxGeometry(0.9, 0.55, 0.04), mats.accent, p[0], SLAB + 1.2, p[1]);
    for (k = 0; k < 4; k++) { var hz = add(group, new THREE.BoxGeometry(0.12, 0.6, 0.045), mats.dark, p[0] - 0.34 + k * 0.23, SLAB + 1.2, p[1]); hz.rotation.z = 0.6; }
  });
  [[2.2, -4.3], [-4.45, 1.0]].forEach(function (d) { add(group, new THREE.CylinderGeometry(0.22, 0.22, 0.03, 16), mats.dark, d[0], SLAB + 0.012, d[1]); });
  [[2.4, -4.4, 0.7, 0.55, 0.7], [3.4, -4.4, 0.5, 0.5, 0.5]].forEach(function (c) {
    add(group, roundedBox(c[2], c[3], c[4], 0.04, 2), mats.hull2, c[0], SLAB + c[3] / 2, c[1]);
    add(group, new THREE.BoxGeometry(c[2] + 0.02, 0.06, 0.08), mats.accent, c[0], SLAB + c[3] * 0.7, c[1] + c[4] / 2);
  });
  [[-1.2, -4.4], [-0.6, -4.4], [-0.9, -4.05]].forEach(function (b, i) {
    add(group, new THREE.CylinderGeometry(0.22, 0.22, 0.6, 14), i === 1 ? mats.accent : mats.plate, b[0], SLAB + 0.3, b[1]);
    add(group, new THREE.TorusGeometry(0.22, 0.02, 6, 14).rotateX(P / 2), mats.trim, b[0], SLAB + 0.3, b[1]);
  });

  /* ---------- Dron de patrulla ---------- */
  var drone = new THREE.Group();
  group.add(drone);
  add(drone, new THREE.SphereGeometry(0.32, 20, 14), mats.hull, 0, 0, 0);
  add(drone, new THREE.TorusGeometry(0.325, 0.035, 8, 26).rotateX(P / 2), mats.accent, 0, 0, 0);
  add(drone, new THREE.SphereGeometry(0.2, 14, 8, 0, TAU, P / 2, P / 2), mats.dark, 0, -0.18, 0);
  add(drone, new THREE.SphereGeometry(0.075, 10, 8), mats.window, 0, 0.04, -0.3);
  [-1, 1].forEach(function (s) {
    add(drone, new THREE.BoxGeometry(0.34, 0.025, 0.025), mats.trim, s * 0.4, -0.02, 0);
    add(drone, new THREE.SphereGeometry(0.06, 8, 6), glowMat(colors.glow, 0.9), s * 0.58, -0.02, 0);
  });
  add(drone, new THREE.CylinderGeometry(0.018, 0.022, 0.72, 8), mats.trim, 0, 0.66, 0);
  add(drone, new THREE.SphereGeometry(0.06, 10, 8), mats.status, 0, 1.04, 0);
  var halo = add(drone, new THREE.SphereGeometry(0.17, 12, 10), glowMat(0x7dffb0, 0.35), 0, 1.04, 0);
  var thr = new THREE.ConeGeometry(0.11, 0.3, 10, 1, true); thr.rotateX(P);
  add(drone, thr, glowMat(colors.glow, 0.55), 0, -0.45, 0);
  var beam2 = add(drone, new THREE.ConeGeometry(0.95, 3.4, 22, 1, true), glowMat(0xbfffe0, 0.07), 0, -2.1, 0);
  var patrolA = 0;
  function patrolPos(a) {
    var c = Math.cos(a), s = Math.sin(a);
    return [7.2 * (c < 0 ? -1 : 1) * Math.pow(Math.abs(c), 0.55), 3.5 + 0.3 * Math.sin(a * 3), 7.2 * (s < 0 ? -1 : 1) * Math.pow(Math.abs(s), 0.55)];
  }

  /* ---------- Estados, demostración y API ---------- */
  var mode = 'working', fill = 0.2, lastT = null, demoHold = 0, ghost = false, origEm = {}, flick = 0;
  var api = {
    group: group,
    footprint: { w: 10, d: 10 },
    output: outPort,
    demo: true,
    patrol: true,
    drone: drone,
    getState: function () { return mode; },
    getFill: function () { return fill; },
    setFill: function (f) { fill = Math.max(0, Math.min(1, f)); },
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
        if (mode === 'working') { fill += 0.05 * dt; if (fill >= 1) { fill = 1; mode = 'full'; demoHold = 0; } }
        else if (mode === 'full') { demoHold += dt; if (demoHold > 2) mode = 'unload'; }
        else if (mode === 'unload') { fill -= 0.1 * dt; if (fill <= 0) { fill = 0; mode = 'working'; } }
      }
      var working = mode === 'working' && !ghost, unload = mode === 'unload' && !ghost;
      if (working) crankPhi += dt * 1.25;
      poseJack(crankPhi);
      flowIn += working ? dt * 0.35 : 0;
      flowOut += unload ? dt * 0.8 : 0;
      placeBlobs(blobsIn, 1.33, 0.54, FY, WHZ, flowIn);
      placeBlobs(blobsOut, 3.72, 0.46, MY, OZ, flowOut);
      blobsIn.visible = blobsOut.visible = !ghost;
      if (unload) flywheel.rotation.z += dt * 12;
      var f = Math.max(0.01, fill);
      gauges.forEach(function (g) { g.scale.y = f * 1.64; g.position.y = 1.76 + f * 0.82; });
      // llama
      var on = mode !== 'off' && !ghost, big = (working || unload) ? 1 : mode === 'full' ? 0.35 : mode === 'broken' ? 1.5 : 0.12;
      flick = 1 + Math.sin(t * 31) * 0.12 + Math.sin(t * 17 + 1) * 0.1;
      flameO.visible = flameI.visible = flameHalo.visible = on;
      flameO.scale.set(0.8 + big * 0.3, (0.3 + big * 0.8) * flick, 0.8 + big * 0.3);
      flameI.scale.set(0.8 + big * 0.2, (0.3 + big * 0.7) * (2 - flick), 0.8 + big * 0.2);
      flameHalo.scale.setScalar((0.5 + big * 0.7) * flick);
      // lámpara de estado
      var col = mode === 'working' || mode === 'unload' ? 0x35ff7a : mode === 'full' ? 0xff3b30 : mode === 'broken' ? 0xffa31a : 0x303030;
      if (mode === 'full' || mode === 'broken') mats.status.color.setHex(Math.sin(t * 6) > 0 ? col : 0x301010); else mats.status.color.setHex(col);
      for (var i = 0; i < blinkers.length; i++) blinkers[i].m.visible = mode !== 'off' && Math.sin(t * TAU / blinkers[i].per + blinkers[i].ph) > -0.2;
      // dron
      var pon = api.patrol, p, p1, p0;
      if (pon) { patrolA += dt * 0.3; p = patrolPos(patrolA); p1 = patrolPos(patrolA + 0.03); p0 = patrolPos(patrolA - 0.03); }
      else { p = [CX, 4.6 + 0.12 * Math.sin(t * 1.5), CZ]; p1 = p; p0 = p; }
      drone.position.set(p[0], p[1], p[2]);
      drone.rotation.y = pon ? Math.atan2(-(p1[0] - p0[0]), -(p1[2] - p0[2])) : t * 0.4;
      drone.rotation.z = pon ? 0.08 * Math.sin(t * 2) : 0;
      var dc = mode === 'broken' ? 0xffa31a : mode === 'off' ? 0x505050 : 0x5dffa0;
      halo.material.color.setHex(dc);
      halo.material.opacity = 0.2 + 0.2 * (0.5 + 0.5 * Math.sin(t * 5));
      beam2.material.color.setHex(dc);
      beam2.visible = pon && mode !== 'off';
      drone.visible = !ghost;
    }
  };
  api.update(0);
  return api;
}
