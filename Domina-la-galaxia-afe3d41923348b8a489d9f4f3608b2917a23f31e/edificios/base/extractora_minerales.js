/**
 * Extractora de minerales para Three.js, sin archivos externos (máquina para colocar en el planeta).
 *
 * Torre de perforación de celosía con plataforma, casa de motor y varilla que gira y sube/baja dentro
 * de un pozo, cinta inclinada con trozos de mineral hacia un silo con indicador de nivel, cinta de salida
 * hasta el borde de la losa, cabina de control con lámpara de estado, depósitos con tuberías, focos,
 * escalera, pórtico de salida y losa de cimentación con franjas de seguridad.
 *
 * Uso:
 *   const mine = createExtractoraMinerales(THREE, { accent: 0xff9a1f });
 *   mine.group.position.set(x, groundY, z);        // la base de la losa está en y = 0
 *   scene.add(mine.group);
 *   mine.update(clock.getElapsedTime());
 *
 * Escala: 1 unidad = 4 m. Huella: 10 x 10 unidades (mine.footprint), centrada en el origen.
 * Salida del mineral: mine.output (Object3D, lado +X). Frente de la cabina: lado -X.
 *
 * Proceso: la torre extrae y la cinta de entrada llena el silo; al llenarse la cinta de entrada se detiene y la
 *   trituradora (rodillos con dientes bajo el silo) vibra y suelta polvo; después la cinta de salida saca
 *   trozos pequeños de mineral. Un dron esférico con antena luminosa patrulla alrededor de la máquina.
 * Estados (mine.setState): 'working' trabaja y llena el silo, 'full' silo lleno (lámpara roja),
 *   'crush' tritura (lámpara amarilla, cinta de entrada parada), 'unload' saca el mineral triturado,
 *   'broken' (lámpara naranja), 'off' (apagada). mine.patrol = false deja el dron quieto sobre la cabina.
 *   Por defecto corre un ciclo de demostración (mine.demo = true); setState lo desactiva.
 * mine.setFill(0..1) / getFill(): nivel del silo (tu lógica de juego lo controla con demo = false).
 * mine.setGhost(true, valid): modo "fantasma" para colocar (verde si valid, rojo si valid === false);
 *   mine.setGhost(false) vuelve a lo normal.
 * mine.setAccent(hex): color de pintura.
 * Compatible con Three.js r128 o superior.
 */
function createExtractoraMinerales(THREE, opts) {
  opts = opts || {};
  var P = Math.PI, TAU = P * 2;
  var colors = {
    hull: opts.hull != null ? opts.hull : 0xd3d7dd,
    accent: opts.accent != null ? opts.accent : 0xff9a1f,
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

  /* ---------- Materiales y utilidades propias ---------- */
  var anim = [], blinkers = [];
  mats.slab = new THREE.MeshStandardMaterial({ color: 0x6d7077, metalness: 0.2, roughness: 0.85 });
  mats.ore = new THREE.MeshStandardMaterial({ color: 0x7b5d3f, metalness: 0.3, roughness: 0.9 });
  mats.belt = new THREE.MeshStandardMaterial({ color: 0x23272e, metalness: 0.4, roughness: 0.7 });
  mats.status = new THREE.MeshBasicMaterial({ color: 0x35ff7a });
  mats.dust = glowMat(0xc9b08a, 0.0);
  function light(parent, x, y, z, mat, size, period) {
    var m = add(parent, new THREE.SphereGeometry(size || 0.07, 10, 8), mat, x, y, z);
    blinkers.push({ m: m, per: period || 1.2, ph: rnd() * TAU });
    return m;
  }
  function setAccent(hex) { colors.accent = hex; mats.accent.color.setHex(hex); }
  function strut(a, b, r, mat) {
    var dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2], len = Math.sqrt(dx * dx + dy * dy + dz * dz);
    var m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 1, 8), mat);
    m.position.set((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(dx / len, dy / len, dz / len));
    m.scale.set(1, len, 1);
    group.add(m);
    return m;
  }
  var SLAB = 0.4, TZ = -2.6;          // altura de la losa y posición (z) de la torre

  /* ---------- Losa de cimentación con franjas de seguridad ---------- */
  add(group, roundedBox(10, SLAB, 10, 0.08, 3), mats.slab, 0, SLAB / 2, 0);
  var stA = [], stB = [], k;
  for (k = 0; k < 20; k++) {
    var pos = -4.75 + k * 0.5, tgt = k % 2 ? stA : stB;
    tgt.push({ x: pos, y: SLAB + 0.01, z: 4.85, sx: 0.5, sy: 0.02, sz: 0.3 });
    tgt.push({ x: pos, y: SLAB + 0.01, z: -4.85, sx: 0.5, sy: 0.02, sz: 0.3 });
    tgt.push({ x: 4.85, y: SLAB + 0.01, z: pos, sx: 0.3, sy: 0.02, sz: 0.5 });
    tgt.push({ x: -4.85, y: SLAB + 0.01, z: pos, sx: 0.3, sy: 0.02, sz: 0.5 });
  }
  group.add(boxField(UB, mats.accent, stA));
  group.add(boxField(UB, mats.dark, stB));

  /* ---------- Torre de perforación (celosía) ---------- */
  var H0 = SLAB, H1 = 9.6, HW0 = 1.4, HW1 = 0.65, levels = [0.4, 2.2, 4.0, 5.8, 7.6, 9.6];
  function hw(y) { return HW0 + (HW1 - HW0) * (y - H0) / (H1 - H0); }
  function pt(sx, sz, y) { return [sx * hw(y), y, TZ + sz * hw(y)]; }
  var corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]], j;
  corners.forEach(function (c) {
    strut(pt(c[0], c[1], H0), pt(c[0], c[1], H1), 0.09, mats.accent);
    add(group, roundedBox(0.6, 0.16, 0.6, 0.04, 2), mats.plate, c[0] * HW0, SLAB + 0.08, TZ + c[1] * HW0);     // placa de anclaje
  });
  levels.forEach(function (y) {
    for (j = 0; j < 4; j++) { var c0 = corners[j], c1 = corners[(j + 1) % 4]; strut(pt(c0[0], c0[1], y), pt(c1[0], c1[1], y), 0.05, mats.hull2); }
  });
  for (k = 0; k < levels.length - 1; k++) {
    for (j = 0; j < 4; j++) {
      if (k === 0 && j === 2) continue;      // la cara frontal inferior se deja libre para la cinta
      var d0 = corners[j], d1 = corners[(j + 1) % 4], flip = (k + j) % 2;
      strut(pt(flip ? d1[0] : d0[0], flip ? d1[1] : d0[1], levels[k]), pt(flip ? d0[0] : d1[0], flip ? d0[1] : d1[1], levels[k + 1]), 0.04, mats.hull2);
    }
  }
  // plataforma superior, barandilla y casa del motor
  add(group, roundedBox(1.9, 0.25, 1.9, 0.05, 2), mats.plate, 0, 9.6, TZ);
  [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(function (c, i, arr) {
    var a = [c[0] * 0.88, 9.725, TZ + c[1] * 0.88], b = [c[0] * 0.88, 10.45, TZ + c[1] * 0.88];
    strut(a, b, 0.03, mats.trim);
    var n = arr[(i + 1) % 4];
    strut(b, [n[0] * 0.88, 10.45, TZ + n[1] * 0.88], 0.025, mats.trim);
  });
  add(group, roundedBox(1.2, 1.3, 1.2, 0.2, 3), mats.hull, 0, 10.4, TZ);
  add(group, roundedBox(1.25, 0.18, 1.25, 0.05, 2), mats.accent, 0, 10.9, TZ);
  add(group, new THREE.CylinderGeometry(0.3, 0.38, 0.3, 18), mats.plate, 0, 11.2, TZ);
  add(group, new THREE.CylinderGeometry(0.03, 0.04, 1.4, 6), mats.trim, 0.25, 12.0, TZ);
  light(group, 0, 11.45, TZ, mats.red, 0.1, 1.4);
  // escalera en la pata trasera izquierda
  var rungs = [];
  for (k = 0; k < 24; k++) { var ry = 0.7 + k * 0.38; rungs.push({ x: -hw(ry) + 0.35, y: ry, z: TZ - hw(ry) - 0.13, sx: 0.5, sy: 0.035, sz: 0.035 }); }
  group.add(boxField(UB, mats.trim, rungs));
  [0.1, 0.6].forEach(function (dx) {
    strut([-hw(0.5) + dx, 0.5, TZ - hw(0.5) - 0.13], [-hw(9.4) + dx, 9.4, TZ - hw(9.4) - 0.13], 0.025, mats.trim);
  });
  [0.7, 2.2, 4.0, 5.8, 7.6, 9.3].forEach(function (by) {       // soportes de la escalera contra la torre
    [0.1, 0.6].forEach(function (dx) { add(group, new THREE.BoxGeometry(0.05, 0.05, 0.14), mats.trim, -hw(by) + dx, by, TZ - hw(by) - 0.065); });
  });
  // focos de trabajo
  [[-1, 1], [1, 1], [0, -1]].forEach(function (f) {
    var fy = 6.7, p = pt(f[0] ? f[0] : 0, f[1], fy);
    add(group, roundedBox(0.35, 0.2, 0.25, 0.05, 2), mats.dark, p[0] * (f[0] ? 1 : 0), fy - 0.05, p[2] + f[1] * 0.12);
    add(group, new THREE.BoxGeometry(0.28, 0.12, 0.03), mats.window, p[0] * (f[0] ? 1 : 0), fy - 0.07, p[2] + f[1] * 0.26);
  });

  /* ---------- Pozo, collar y escombros ---------- */
  add(group, new THREE.CylinderGeometry(0.85, 0.85, 0.04, 28), mats.dark, 0, SLAB + 0.02, TZ);
  add(group, new THREE.TorusGeometry(0.88, 0.14, 10, 30).rotateX(P / 2), mats.plate, 0, SLAB + 0.1, TZ);
  for (k = 0; k < 8; k++) { var ba = k / 8 * TAU; add(group, new THREE.CylinderGeometry(0.05, 0.05, 0.06, 6), mats.trim, Math.cos(ba) * 0.88, SLAB + 0.24, TZ + Math.sin(ba) * 0.88); }
  var rocks = [];
  for (k = 0; k < 16; k++) { var ra = rnd() * TAU, rr = 1.2 + rnd() * 0.7, s2 = 0.15 + rnd() * 0.3; rocks.push({ x: Math.cos(ra) * rr, y: SLAB + s2 * 0.4, z: TZ + Math.sin(ra) * rr, ry: rnd() * 3, sx: s2, sy: s2 * 0.8, sz: s2 * 1.2 }); }
  group.add(boxField(UB, mats.ore, rocks));

  /* ---------- Varilla de perforación (sube y baja girando) ---------- */
  var rod = new THREE.Group();
  rod.position.set(0, 0, TZ);
  group.add(rod);
  add(rod, new THREE.CylinderGeometry(0.18, 0.18, 11.5, 14), mats.dark, 0, 4.9, 0);
  for (k = 0; k < 5; k++) {
    var gy = 1.6 + k * 1.9;
    add(rod, new THREE.CylinderGeometry(0.23, 0.23, 0.2, 14), mats.accent, 0, gy, 0);
    add(rod, new THREE.BoxGeometry(0.16, 0.5, 0.1), mats.plate, 0.26, gy + 0.3, 0);
  }
  add(rod, new THREE.CylinderGeometry(0.3, 0.3, 0.4, 14), mats.plate, 0, 9.3, 0);

  // polvo alrededor del pozo
  var dustRings = [];
  for (k = 0; k < 3; k++) {
    var dm = add(group, new THREE.CircleGeometry(1, 20).rotateX(-P / 2), mats.dust.clone(), 0, SLAB + 0.12 + k * 0.02, TZ);
    dm.visible = false;
    dustRings.push(dm);
  }

  /* ---------- Cinta inclinada hacia el silo ---------- */
  var BZ0 = TZ + 0.8, BY0 = SLAB + 0.22, BZ1 = 3.0, BY1 = 4.9;
  var bdz = BZ1 - BZ0, bdy = BY1 - BY0, BL = Math.sqrt(bdz * bdz + bdy * bdy), bth = Math.atan2(bdy, bdz);
  var belt = add(group, new THREE.BoxGeometry(0.8, 0.14, BL), mats.belt, 0, (BY0 + BY1) / 2, (BZ0 + BZ1) / 2);
  belt.rotation.x = -bth;
  [-1, 1].forEach(function (s) {
    var rail = add(group, new THREE.BoxGeometry(0.06, 0.22, BL), mats.accent, s * 0.43, (BY0 + BY1) / 2 + 0.06, (BZ0 + BZ1) / 2);
    rail.rotation.x = -bth;
  });
  [0.15, 0.5, 0.82].forEach(function (f) {        // caballetes bajo la cinta
    var cz = BZ0 + bdz * f, cy = BY0 + bdy * f - 0.1;
    [-1, 1].forEach(function (s) { strut([s * 0.5, SLAB, cz], [s * 0.5, cy, cz], 0.05, mats.hull2); });
    strut([-0.5, cy, cz], [0.5, cy, cz], 0.05, mats.hull2);
  });
  var beltCleats = [], bn = Math.floor(BL / 0.4);
  for (k = 0; k < bn; k++) beltCleats.push({ x: 0, y: 0, z: 0 });
  var cleatsB = new THREE.InstancedMesh(UB, mats.plate, bn);
  cleatsB.frustumCulled = false;
  group.add(cleatsB);

  /* ---------- Silo ---------- */
  var SX = 0, SZ = 3.9, SR = 1.0, S0 = 2.0, S1 = 4.2;
  var siloBody = new THREE.CylinderGeometry(SR, SR, S1 - S0, 28, 1, true);
  add(group, siloBody, mats.hull, SX, (S0 + S1) / 2, SZ);
  var siloCone = new THREE.ConeGeometry(SR, 0.7, 28, 1, true); siloCone.rotateX(P);
  add(group, siloCone, mats.hull2, SX, S0 - 0.35, SZ);
  add(group, new THREE.TorusGeometry(SR, 0.07, 8, 28).rotateX(P / 2), mats.plate, SX, S1, SZ);
  add(group, new THREE.TorusGeometry(SR, 0.05, 8, 28).rotateX(P / 2), mats.accent, SX, S0 + 0.3, SZ);
  add(group, new THREE.TorusGeometry(SR, 0.05, 8, 28).rotateX(P / 2), mats.accent, SX, S1 - 0.35, SZ);
  var oreTop = add(group, new THREE.CylinderGeometry(SR - 0.04, SR - 0.04, 0.06, 28), mats.ore, SX, S0 + 0.4, SZ);
  [[1, 1], [-1, 1], [-1, -1], [1, -1]].forEach(function (c) {
    strut([SX + c[0] * 0.85, SLAB, SZ + c[1] * 0.85], [SX + c[0] * 0.66, S0 + 0.6, SZ + c[1] * 0.66], 0.07, mats.accent);
  });
  strut([SX - 0.85, 1.0, SZ - 0.85], [SX + 0.85, 1.0, SZ - 0.85], 0.04, mats.hull2);
  strut([SX - 0.85, 1.0, SZ + 0.85], [SX + 0.85, 1.0, SZ + 0.85], 0.04, mats.hull2);
  // indicador de nivel en el costado +X
  add(group, roundedBox(0.12, 2.0, 0.22, 0.04, 2), mats.dark, SX + SR + 0.02, (S0 + S1) / 2, SZ);
  var lvl = add(group, new THREE.BoxGeometry(0.06, 1, 0.1), mats.status, SX + SR + 0.1, S0 + 0.1, SZ);

  /* ---------- Cinta de salida hacia el borde de la losa ---------- */
  var OY = SLAB + 0.2, OX0 = -0.2, OX1 = 4.9, OL = OX1 - OX0;
  add(group, new THREE.BoxGeometry(OL, 0.14, 0.8), mats.belt, (OX0 + OX1) / 2, OY, SZ);
  [-1, 1].forEach(function (s) { add(group, new THREE.BoxGeometry(OL, 0.2, 0.06), mats.accent, (OX0 + OX1) / 2, OY + 0.05, SZ + s * 0.43); });
  var on = Math.floor(OL / 0.4);
  var cleatsO = new THREE.InstancedMesh(UB, mats.plate, on);
  cleatsO.frustumCulled = false;
  group.add(cleatsO);
  add(group, new THREE.CylinderGeometry(0.16, 0.16, 0.9, 12).rotateX(P / 2), mats.plate, OX1 + 0.05, OY + 0.02, SZ);   // rodillo final
  var outPort = new THREE.Object3D();
  outPort.position.set(OX1 + 0.4, OY + 0.2, SZ);
  group.add(outPort);
  add(group, new THREE.BoxGeometry(0.1, 0.5, 0.9), mats.accent, OX1 + 0.1, OY + 0.4, SZ - 0.0);
  var tmp = new THREE.Object3D();
  var beltOff = 0, outOff = 0;
  function placeCleats(inst, n, len, off, fn) {
    for (var q = 0; q < n; q++) {
      var s = ((q * len / n + off) % len + len) % len;
      fn(s, tmp);
      tmp.updateMatrix();
      inst.setMatrixAt(q, tmp.matrix);
    }
    inst.instanceMatrix.needsUpdate = true;
  }
  function beltFn(s, o) {
    var cs = Math.cos(bth), sn = Math.sin(bth);
    o.position.set(0, BY0 + s * sn + 0.1 * cs, BZ0 + s * cs - 0.1 * sn);
    o.rotation.set(-bth, 0, 0);
    o.scale.set(0.7, 0.05, 0.1);
  }
  function outFn(s, o) {
    o.position.set(OX0 + s, OY + 0.09, SZ);
    o.rotation.set(0, 0, 0);
    o.scale.set(0.1, 0.05, 0.7);
  }
  // trozos de mineral que viajan por las cintas
  var chunkA = new THREE.InstancedMesh(UB, mats.ore, 10), chunkB = new THREE.InstancedMesh(UB, mats.ore, 36);
  chunkA.frustumCulled = chunkB.frustumCulled = false;
  group.add(chunkA); group.add(chunkB);
  function placeChunks(inst, n, len, off, fn, lift, small) {
    for (var q = 0; q < n; q++) {
      var s = ((q * len / n + off) % len + len) % len;
      fn(s, tmp);
      var sz = small ? 0.05 + ((q * 7) % 5) * 0.015 : 0.18 + ((q * 7) % 5) * 0.04;
      tmp.position.y += lift + sz * 0.4;
      tmp.rotation.set(q, q * 1.7, q * 0.6);
      tmp.scale.set(sz, sz * 0.8, sz * 1.1);
      tmp.updateMatrix();
      inst.setMatrixAt(q, tmp.matrix);
    }
    inst.instanceMatrix.needsUpdate = true;
  }

  /* ---------- Cabina de control ---------- */
  add(group, roundedBox(2.2, 1.9, 2.6, 0.25, 3), mats.hull, -3.4, SLAB + 0.95, 1.2);
  add(group, roundedBox(2.4, 0.18, 2.8, 0.06, 2), mats.plate, -3.4, SLAB + 1.95, 1.2);
  add(group, new THREE.BoxGeometry(0.06, 0.2, 2.62), mats.accent, -2.27, SLAB + 1.55, 1.2);
  add(group, roundedBox(0.08, 0.7, 1.7, 0.03, 2), mats.glass, -2.27, SLAB + 1.2, 1.2);
  var cw = [];
  for (k = 0; k < 3; k++) cw.push({ x: -3.4, y: SLAB + 1.2, z: 0.5 + k * 0.7, sx: 0.5, sy: 0.04, sz: 0.04 });
  add(group, roundedBox(0.08, 1.2, 0.7, 0.03, 2), mats.dark, -2.27, SLAB + 0.65, 0.35);                          // puerta
  add(group, roundedBox(0.8, 0.35, 0.8, 0.08, 2), mats.hull2, -3.8, SLAB + 2.2, 1.6);                           // climatizador
  add(group, new THREE.CylinderGeometry(0.03, 0.03, 1.6, 6), mats.trim, -4.1, SLAB + 2.82, 0.5);
  var pole = add(group, new THREE.CylinderGeometry(0.04, 0.04, 1.0, 6), mats.trim, -2.6, SLAB + 2.55, 2.1);
  var statusLamp = add(group, new THREE.SphereGeometry(0.16, 14, 10), mats.status, -2.6, SLAB + 3.15, 2.1);

  /* ---------- Generador, depósitos y tuberías ---------- */
  [-3.9, -2.2].forEach(function (tz) {
    var tank = new THREE.CylinderGeometry(0.62, 0.62, 1.6, 20); tank.rotateZ(P / 2);
    add(group, tank, mats.hull2, -3.4, SLAB + 0.85, tz);
    [-0.5, 0.5].forEach(function (dx) { add(group, roundedBox(0.2, 0.5, 0.9, 0.05, 2), mats.plate, -3.4 + dx, SLAB + 0.25, tz); });
    add(group, new THREE.CylinderGeometry(0.64, 0.64, 0.12, 20).rotateZ(P / 2), mats.accent, -3.4, SLAB + 0.85, tz);
    add(group, new THREE.SphereGeometry(0.62, 16, 10), mats.hull2, -2.6, SLAB + 0.85, tz);
    add(group, new THREE.SphereGeometry(0.62, 16, 10), mats.hull2, -4.2, SLAB + 0.85, tz);
  });
  strut([-2.05, SLAB + 0.85, -3.9], [-1.33, SLAB + 0.85, -3.93], 0.07, mats.trim);     // tuberías hasta las patas de la torre
  strut([-2.05, SLAB + 0.85, -2.2], [-1.33, SLAB + 0.85, -1.27], 0.07, mats.trim);
  strut([-3.4, SLAB + 0.85, -3.3], [-3.4, SLAB + 0.85, -2.8], 0.06, mats.trim);
  greeble(-1.9, SLAB, 3.0, 1.2, 0, 1.2, 6, mats.hull2, 'y', 0.15, 0.4);

  /* ====================== DETALLES ADICIONALES ====================== */
  var cx, cy2, cz2;
  function cyl(r, len, axis, mat, x, y, z, seg) {          // cilindro con eje x, y o z
    var g = new THREE.CylinderGeometry(r, r, len, seg || 16);
    if (axis === 'x') g.rotateZ(P / 2); else if (axis === 'z') g.rotateX(P / 2);
    return add(group, g, mat, x, y, z);
  }

  // ---- Torre: paneles de revestimiento y pasarela intermedia ----
  var LEAN = Math.atan((HW0 - HW1) / (H1 - H0));
  [[2.2, 4.0], [5.8, 7.6]].forEach(function (r, ri) {
    var ym = (r[0] + r[1]) / 2, h = hw(ym), pw = 2 * h * 0.9;
    add(group, new THREE.BoxGeometry(pw, 1.55, 0.04), mats.hull2, 0, ym, TZ - h).rotation.x = LEAN;
    add(group, new THREE.BoxGeometry(0.04, 1.55, pw), mats.hull2, h, ym, TZ).rotation.z = LEAN;
    add(group, new THREE.BoxGeometry(0.04, 1.55, pw), mats.hull2, -h, ym, TZ).rotation.z = -LEAN;
    if (ri) add(group, new THREE.BoxGeometry(pw, 1.55, 0.04), mats.hull2, 0, ym, TZ + h).rotation.x = -LEAN;
    add(group, new THREE.BoxGeometry(pw, 0.07, 0.07), mats.accent, 0, r[1] - 0.12, TZ - h - 0.03).rotation.x = LEAN;
  });
  var WY = 5.8, WH = hw(WY), WO = WH + 0.6;
  add(group, new THREE.BoxGeometry(2 * WO, 0.06, 0.6), mats.trim, 0, WY, TZ - WH - 0.3);
  add(group, new THREE.BoxGeometry(2 * WO, 0.06, 0.6), mats.trim, 0, WY, TZ + WH + 0.3);
  add(group, new THREE.BoxGeometry(0.6, 0.06, 2 * WH), mats.trim, -WH - 0.3, WY, TZ);
  add(group, new THREE.BoxGeometry(0.6, 0.06, 2 * WH), mats.trim, WH + 0.3, WY, TZ);
  [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(function (c, i, arr) {
    var px = c[0] * WO, pz = TZ + c[1] * WO, nx = arr[(i + 1) % 4];
    strut([px, WY, pz], [px, WY + 0.95, pz], 0.03, mats.accent);
    strut([px, WY + 0.95, pz], [nx[0] * WO, WY + 0.95, TZ + nx[1] * WO], 0.025, mats.accent);
    strut([px, WY + 0.5, pz], [nx[0] * WO, WY + 0.5, TZ + nx[1] * WO], 0.02, mats.accent);
    var q = pt(c[0], c[1], WY - 0.95);
    strut([px, WY - 0.03, pz], q, 0.035, mats.hull2);                                  // diagonal de apoyo
  });

  // ---- Corona con poleas, cable y malacate ----
  var sheaves = [];
  [-1, 1].forEach(function (s) {
    var sh = new THREE.Group();
    sh.position.set(s * 0.74, 10.55, TZ);
    group.add(sh);
    var disc = new THREE.CylinderGeometry(0.28, 0.28, 0.08, 22); disc.rotateZ(P / 2);
    add(sh, disc, mats.plate, 0, 0, 0);
    var rim = new THREE.TorusGeometry(0.28, 0.035, 8, 22); rim.rotateY(P / 2);
    add(sh, rim, mats.accent, 0, 0, 0);
    for (k = 0; k < 3; k++) { var sp = add(sh, new THREE.BoxGeometry(0.1, 0.5, 0.04), mats.dark, 0, 0, 0); sp.rotation.x = k * P / 3; }
    strut([s * 0.6, 10.55, TZ], [s * 0.8, 10.55, TZ], 0.045, mats.trim);
    sheaves.push(sh);
  });
  var WX = 3.2, WZ = -3.0;
  add(group, roundedBox(2.2, 0.25, 1.3, 0.05, 2), mats.plate, WX + 0.2, SLAB + 0.125, WZ);
  var drum = new THREE.Group();
  drum.position.set(WX, SLAB + 0.65, WZ);
  group.add(drum);
  var dgeo = new THREE.CylinderGeometry(0.4, 0.4, 1.0, 20); dgeo.rotateZ(P / 2);
  add(drum, dgeo, mats.hull2, 0, 0, 0);
  [-1, 1].forEach(function (s) {
    var fl = new THREE.CylinderGeometry(0.55, 0.55, 0.08, 22); fl.rotateZ(P / 2);
    add(drum, fl, mats.accent, s * 0.52, 0, 0);
  });
  add(drum, new THREE.BoxGeometry(0.9, 0.05, 0.12), mats.dark, 0, 0.4, 0);
  [-1, 1].forEach(function (s) { strut([WX + s * 0.56, SLAB + 0.25, WZ], [WX + s * 0.56, SLAB + 0.65, WZ], 0.05, mats.trim); });
  add(group, roundedBox(0.6, 0.65, 0.7, 0.08, 2), mats.hull, WX + 1.1, SLAB + 0.55, WZ);                        // motor del malacate
  strut([WX + 0.56, SLAB + 0.65, WZ], [WX + 0.8, SLAB + 0.65, WZ], 0.07, mats.trim);
  strut([WX, SLAB + 1.05, WZ], [0.74, 10.83, TZ], 0.025, mats.dark);                                            // cable hasta la corona

  // ---- Preventor de reventones (BOP) sobre el pozo ----
  var bop = new THREE.Group();
  bop.position.set(0, SLAB, TZ);
  group.add(bop);
  add(bop, new THREE.CylinderGeometry(0.62, 0.62, 1.1, 24, 1, true), mats.hull2, 0, 0.6, 0);
  [0.1, 0.6, 1.1].forEach(function (y) { add(bop, new THREE.TorusGeometry(0.64, 0.07, 8, 26).rotateX(P / 2), mats.accent, 0, y, 0); });
  for (k = 0; k < 4; k++) {
    var va = k * P / 2 + P / 4, vx = Math.cos(va), vz = Math.sin(va);
    var vs = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.55, 10), mats.plate);
    vs.rotation.set(vz * P / 2, 0, -vx * P / 2);
    vs.position.set(vx * 0.85, 0.6, vz * 0.85);
    bop.add(vs);
    add(bop, new THREE.CylinderGeometry(0.16, 0.16, 0.035, 14), mats.accent, vx * 1.16, 0.6, vz * 1.16);
  }

  // ---- Rack de tubería de repuesto ----
  [[-0.6], [1.8]].forEach(function (rz) {
    add(group, new THREE.BoxGeometry(1.9, 0.12, 0.2), mats.trim, 3.7, SLAB + 0.06, rz[0]);
    [3.0, 4.4].forEach(function (ux) { strut([ux, SLAB, rz[0]], [ux, SLAB + 0.95, rz[0]], 0.04, mats.trim); });
  });
  [[0.18, [3.15, 3.55, 3.95, 4.35]], [0.38, [3.35, 3.75, 4.15]], [0.58, [3.55, 3.95]]].forEach(function (row) {
    row[1].forEach(function (px) {
      cyl(0.11, 3.2, 'z', mats.hull2, px, SLAB + 0.12 + row[0] + 0.0, 0.6, 12);
      [-1.6, 1.6].forEach(function (e) { cyl(0.125, 0.18, 'z', mats.accent, px, SLAB + 0.12 + row[0], 0.6 + e, 12); });
    });
  });

  // ---- Cinta inclinada: poleas, motor y cubierta ----
  cyl(0.14, 0.86, 'x', mats.plate, 0, BY0, BZ0, 14);
  cyl(0.14, 0.86, 'x', mats.plate, 0, BY1, BZ1, 14);
  add(group, roundedBox(0.5, 0.5, 0.9, 0.08, 2), mats.hull, 0.78, BY1 - 0.2, BZ1 - 0.35);
  add(group, new THREE.BoxGeometry(0.26, 0.12, 0.3), mats.trim, 0.5, BY1 - 0.1, BZ1 - 0.25);
  add(group, new THREE.BoxGeometry(0.2, 0.08, 0.5), mats.accent, 0.78, BY1 + 0.07, BZ1 - 0.35);
  [-1, 1].forEach(function (s) { strut([s * 0.43, BY1 - 0.02, BZ1 - 0.75], [s * 0.43, BY1 + 0.3, BZ1 - 0.75], 0.03, mats.trim); });
  add(group, roundedBox(0.98, 0.1, 0.9, 0.03, 2), mats.hull2, 0, BY1 + 0.32, BZ1 - 0.45).rotation.x = -bth * 0.9;

  // ---- Silo: nervaduras, pasarela, escalera ----
  for (k = 0; k < 10; k++) {
    var sa = k / 10 * TAU, rib = add(group, new THREE.BoxGeometry(0.08, S1 - S0, 0.14), mats.hull2, SX + Math.cos(sa) * (SR + 0.02), (S0 + S1) / 2, SZ + Math.sin(sa) * (SR + 0.02));
    rib.rotation.y = -sa;
  }
  add(group, new THREE.RingGeometry(SR, SR + 0.38, 30).rotateX(-P / 2), mats.trim, SX, S1 + 0.05, SZ);
  for (k = 0; k <= 6; k++) {
    var pa = k / 6 * P, ppx = SX + Math.cos(pa) * (SR + 0.34), ppz = SZ + Math.sin(pa) * (SR + 0.34);
    strut([ppx, S1 + 0.05, ppz], [ppx, S1 + 0.95, ppz], 0.025, mats.accent);
    if (k) { var pb = (k - 1) / 6 * P; strut([SX + Math.cos(pb) * (SR + 0.34), S1 + 0.95, SZ + Math.sin(pb) * (SR + 0.34)], [ppx, S1 + 0.95, ppz], 0.02, mats.accent); }
  }
  var LXs = SX - SR - 0.14, lad = [];
  [-0.2, 0.2].forEach(function (dz) { strut([LXs, SLAB, SZ + dz], [LXs, S1 + 0.85, SZ + dz], 0.025, mats.trim); });
  for (k = 0; k < 11; k++) lad.push({ x: LXs, y: 0.65 + k * 0.35, z: SZ, sx: 0.035, sy: 0.035, sz: 0.4 });
  group.add(boxField(UB, mats.trim, lad));
  [0.9, 2.2, 3.5].forEach(function (by) { [-0.2, 0.2].forEach(function (dz) { add(group, new THREE.BoxGeometry(0.16, 0.05, 0.05), mats.trim, LXs + 0.07, by, SZ + dz); }); });
  cyl(0.05, 1.0, 'y', mats.trim, SX + 0.45, S1 + 0.5, SZ - 0.1, 8);                                              // tubo sensor de nivel
  add(group, roundedBox(0.28, 0.22, 0.28, 0.05, 2), mats.hull, SX + 0.45, S1 + 1.1, SZ - 0.1);

  // ---- Pórtico de salida ----
  [-0.7, 0.7].forEach(function (dz) { strut([3.0, SLAB, SZ + dz], [3.0, 1.9, SZ + dz], 0.05, mats.accent); });
  add(group, new THREE.BoxGeometry(0.16, 0.14, 1.6), mats.hull, 3.0, 1.9, SZ);
  [-0.35, 0.35].forEach(function (dz) { add(group, new THREE.BoxGeometry(0.2, 0.05, 0.3), mats.window, 3.0, 1.8, SZ + dz); });
  light(group, 3.0, 2.02, SZ, mats.red, 0.07, 1.1);

  // ---- Cabina: escalón, ventanas, panel solar ----
  add(group, roundedBox(0.7, 0.3, 1.0, 0.04, 2), mats.plate, -1.95, SLAB + 0.15, 0.35);
  [-0.45, 0.45].forEach(function (dz) { strut([-1.7, SLAB + 0.3, 0.35 + dz], [-1.7, SLAB + 1.0, 0.35 + dz], 0.025, mats.accent); });
  strut([-1.7, SLAB + 1.0, -0.1], [-1.7, SLAB + 1.0, 0.8], 0.025, mats.accent);
  add(group, new THREE.BoxGeometry(1.4, 0.5, 0.04), mats.glass, -3.4, SLAB + 1.2, 2.52);
  add(group, new THREE.BoxGeometry(1.4, 0.5, 0.04), mats.glass, -3.4, SLAB + 1.2, -0.12);
  add(group, new THREE.BoxGeometry(0.6, 0.35, 0.04), mats.window, -4.52, SLAB + 1.2, 1.2).rotation.y = P / 2;
  var sol = add(group, new THREE.BoxGeometry(1.4, 0.05, 0.95), mats.glass, -3.0, SLAB + 2.5, 0.5);
  sol.rotation.x = -0.3;
  [[-3.6, 0.1], [-2.4, 0.1], [-3.6, 0.85], [-2.4, 0.85]].forEach(function (p) { strut([p[0], SLAB + 2.04, p[1] + 0.1], [p[0], SLAB + (p[1] < 0.5 ? 2.43 : 2.62), p[1] + 0.1], 0.025, mats.trim); });

  // ---- Generador: chimenea, vapor y manómetros ----
  strut([-3.0, SLAB + 1.44, -3.9], [-3.0, SLAB + 3.3, -3.9], 0.09, mats.dark);
  add(group, new THREE.CylinderGeometry(0.16, 0.09, 0.16, 12), mats.plate, -3.0, SLAB + 3.38, -3.9);
  [-3.9, -2.2].forEach(function (tz2) {
    add(group, new THREE.CylinderGeometry(0.13, 0.13, 0.05, 14).rotateX(P / 2), mats.plate, -3.4, SLAB + 0.9, tz2 + (tz2 < -3 ? -0.62 : 0.62));
    add(group, new THREE.CylinderGeometry(0.1, 0.1, 0.02, 14).rotateX(P / 2), mats.window, -3.4, SLAB + 0.9, tz2 + (tz2 < -3 ? -0.655 : 0.655));
  });
  var puffs = [];
  for (k = 0; k < 5; k++) {
    var pm = glowMat(0xd8dde4, 0.0), pf = add(group, new THREE.SphereGeometry(0.18, 10, 8), pm, -3.0, SLAB + 3.5, -3.9);
    pf.visible = false;
    puffs.push(pf);
  }
  anim.push(function (t, dt, working, unload) {
    var on = working || unload;
    puffs.forEach(function (pf, i) {
      var ph = ((t * 0.45 + i / 5) % 1);
      pf.visible = on;
      if (on) { pf.position.set(-3.0 + ph * 0.5, SLAB + 3.5 + ph * 1.6, -3.9); pf.scale.setScalar(0.6 + ph * 2.2); pf.material.opacity = (1 - ph) * 0.3; }
    });
    sheaves.forEach(function (sh, i) { if (working) sh.rotation.x += dt * (i ? 1.6 : -1.6); });
    if (working) drum.rotation.x += dt * 1.6;
  });

  // ---- Losa: juntas, desagües, bolardos, farolas, carteles, bandeja de cables ----
  var seams = [], stains = [];
  [-2.5, 0, 2.5].forEach(function (v) {
    seams.push({ x: 0, y: SLAB + 0.006, z: v, sx: 9.7, sy: 0.012, sz: 0.035 });
    seams.push({ x: v, y: SLAB + 0.006, z: 0, sx: 0.035, sy: 0.012, sz: 9.7 });
  });
  group.add(boxField(UB, mats.dark, seams));
  for (k = 0; k < 14; k++) stains.push({ x: (rnd() - 0.5) * 9, y: SLAB + 0.004, z: (rnd() - 0.5) * 9, ry: rnd() * 3, sx: 0.4 + rnd() * 1.1, sy: 0.008, sz: 0.3 + rnd() * 0.9 });
  group.add(boxField(UB, mats.trim, stains));
  [[2.2, -4.3], [-4.45, -0.9], [4.4, -1.2]].forEach(function (d) { add(group, new THREE.CylinderGeometry(0.22, 0.22, 0.03, 16), mats.dark, d[0], SLAB + 0.012, d[1]); });
  [-4.5, -2.5, 2.5, 4.5].forEach(function (bx) {
    add(group, new THREE.CylinderGeometry(0.1, 0.1, 0.6, 10), mats.hull, bx, SLAB + 0.3, 4.65);
    add(group, new THREE.CylinderGeometry(0.105, 0.105, 0.14, 10), mats.accent, bx, SLAB + 0.5, 4.65);
  });
  [[-4.6, -4.6], [4.6, -4.6], [4.6, 4.6], [-4.6, 4.6]].forEach(function (p) {
    strut([p[0], SLAB, p[1]], [p[0], SLAB + 3.6, p[1]], 0.06, mats.trim);
    var head = add(group, roundedBox(0.5, 0.14, 0.3, 0.04, 2), mats.dark, p[0] - Math.sign(p[0]) * 0.15, SLAB + 3.62, p[1]);
    add(group, new THREE.BoxGeometry(0.4, 0.04, 0.22), mats.window, p[0] - Math.sign(p[0]) * 0.15, SLAB + 3.55, p[1]);
  });
  [[-2.2, 4.4], [2.2, 4.4]].forEach(function (p) {
    strut([p[0], SLAB, p[1]], [p[0], SLAB + 1.2, p[1]], 0.04, mats.trim);
    add(group, new THREE.BoxGeometry(0.9, 0.55, 0.04), mats.accent, p[0], SLAB + 1.2, p[1]);
    for (k = 0; k < 4; k++) { var hz = add(group, new THREE.BoxGeometry(0.12, 0.6, 0.045), mats.dark, p[0] - 0.34 + k * 0.23, SLAB + 1.2, p[1]); hz.rotation.z = 0.6; }
  });
  add(group, new THREE.BoxGeometry(1.4, 0.08, 0.3), mats.trim, -1.6, SLAB + 0.04, 0.3);
  add(group, new THREE.BoxGeometry(0.3, 0.08, 1.4), mats.trim, -0.9, SLAB + 0.04, -0.4);
  add(group, roundedBox(0.35, 0.5, 0.25, 0.04, 2), mats.hull, -HW0 + 0.07, 1.2, TZ + HW0 - 0.2);
  strut([-0.9, SLAB + 0.08, -1.1], [-HW0 + 0.07, 0.95, TZ + HW0 - 0.2], 0.03, mats.trim);
  // cajas y barriles
  [[3.9, -4.5, 0.7, 0.55, 0.7], [3.0, -4.4, 0.5, 0.5, 0.5], [2.3, -4.5, 0.45, 0.4, 0.55]].forEach(function (c) {
    add(group, roundedBox(c[2], c[3], c[4], 0.04, 2), mats.hull2, c[0], SLAB + c[3] / 2, c[1]);
    add(group, new THREE.BoxGeometry(c[2] + 0.02, 0.06, 0.08), mats.accent, c[0], SLAB + c[3] * 0.7, c[1] + c[4] / 2);
  });
  [[1.2, 4.55], [-1.2, 4.55]].forEach(function (b, i) {
    add(group, new THREE.CylinderGeometry(0.22, 0.22, 0.6, 14), i ? mats.accent : mats.plate, b[0], SLAB + 0.3, b[1]);
    add(group, new THREE.TorusGeometry(0.22, 0.02, 6, 14).rotateX(P / 2), mats.trim, b[0], SLAB + 0.3, b[1]);
  });

  /* ---------- Trituradora bajo el silo (rodillos con dientes) ---------- */
  var crusher = new THREE.Group();
  crusher.position.set(SX, 1.12, SZ);
  group.add(crusher);
  add(crusher, roundedBox(1.04, 0.1, 1.04, 0.03, 2), mats.hull2, 0, 0.275, 0);                         // tapa superior (y 1.395)
  [-1, 1].forEach(function (s) {
    add(crusher, roundedBox(1.04, 0.55, 0.08, 0.02, 2), mats.hull, 0, 0, s * 0.48);                       // paredes laterales
    add(crusher, new THREE.BoxGeometry(0.06, 0.58, 0.1), mats.accent, 0.52, 0, s * 0.48);                  // marco frontal
  });
  add(crusher, roundedBox(0.08, 0.55, 1.0, 0.02, 2), mats.hull, -0.48, 0, 0);                              // pared trasera
  add(crusher, new THREE.BoxGeometry(0.06, 0.06, 0.98), mats.accent, 0.52, 0.28, 0);
  function roller(x) {
    var rg = new THREE.Group();
    rg.position.set(x, -0.02, 0);
    crusher.add(rg);
    var rc = new THREE.CylinderGeometry(0.19, 0.19, 0.84, 16); rc.rotateX(P / 2);
    add(rg, rc, mats.dark, 0, 0, 0);
    for (var q = 0; q < 8; q++) {
      var ta = q / 8 * TAU, th = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.07, 0.8), mats.plate);
      th.position.set(Math.cos(ta) * 0.21, Math.sin(ta) * 0.21, 0);
      th.rotation.z = ta;
      rg.add(th);
    }
    return rg;
  }
  var rollA = roller(-0.19), rollB = roller(0.19);
  var crushFlash = add(crusher, new THREE.SphereGeometry(0.32, 12, 10), glowMat(0xff9a30, 0.55), 0.1, -0.1, 0);
  crushFlash.visible = false;
  light(group, SX + 0.56, 1.6, SZ + 0.52, mats.red, 0.06, 0.6);
  var cDust = [];
  for (k = 0; k < 5; k++) { var cp = add(group, new THREE.SphereGeometry(0.14, 10, 8), glowMat(0xbfa886, 0), SX + 0.6, 0.9, SZ); cp.visible = false; cDust.push(cp); }
  anim.push(function (t, dt, working, unload, crushing) {
    var run = crushing || unload, sp = crushing ? 9 : 4;
    if (run) { rollA.rotation.z += dt * sp; rollB.rotation.z -= dt * sp; }
    crusher.position.set(SX + (crushing ? Math.sin(t * 75) * 0.012 : 0), 1.12 + (crushing ? Math.sin(t * 90) * 0.008 : 0), SZ + (crushing ? Math.cos(t * 61) * 0.012 : 0));
    crushFlash.visible = crushing && Math.sin(t * 38) > -0.3;
    cDust.forEach(function (d, i) {
      var ph = (t * 0.9 + i / 5) % 1;
      d.visible = crushing;
      if (crushing) { d.position.set(SX + 0.6 + ph * 0.9, 0.95 + ph * 0.8, SZ + Math.sin(i * 2.1) * 0.4); d.scale.setScalar(0.7 + ph * 2.2); d.material.opacity = (1 - ph) * 0.35; }
    });
  });

  /* ---------- Dron de patrulla ---------- */
  var drone = new THREE.Group();
  group.add(drone);
  add(drone, new THREE.SphereGeometry(0.32, 20, 14), mats.hull, 0, 0, 0);
  add(drone, new THREE.TorusGeometry(0.325, 0.035, 8, 26).rotateX(P / 2), mats.accent, 0, 0, 0);
  add(drone, new THREE.SphereGeometry(0.2, 14, 8, 0, TAU, P / 2, P / 2), mats.dark, 0, -0.18, 0);
  add(drone, new THREE.SphereGeometry(0.075, 10, 8), mats.window, 0, 0.04, -0.3);                      // "ojo" frontal
  [-1, 1].forEach(function (s) {
    var arm = add(drone, new THREE.BoxGeometry(0.34, 0.025, 0.025), mats.trim, s * 0.4, -0.02, 0);
    add(drone, new THREE.SphereGeometry(0.06, 8, 6), glowMat(colors.glow, 0.9), s * 0.58, -0.02, 0);
  });
  add(drone, new THREE.CylinderGeometry(0.018, 0.022, 0.72, 8), mats.trim, 0, 0.66, 0);                 // antena
  var tip = add(drone, new THREE.SphereGeometry(0.06, 10, 8), mats.status, 0, 1.04, 0);
  var halo = add(drone, new THREE.SphereGeometry(0.17, 12, 10), glowMat(0x7dffb0, 0.35), 0, 1.04, 0);
  var thr = new THREE.ConeGeometry(0.11, 0.3, 10, 1, true); thr.rotateX(P);
  add(drone, thr, glowMat(colors.glow, 0.55), 0, -0.45, 0);
  var beamG = new THREE.ConeGeometry(0.95, 3.4, 22, 1, true);
  var beam = add(drone, beamG, glowMat(0xbfffe0, 0.07), 0, -2.1, 0);
  var patrolA = 0;
  function patrolPos(a) {
    var c = Math.cos(a), s = Math.sin(a);
    return [7.2 * (c < 0 ? -1 : 1) * Math.pow(Math.abs(c), 0.55), 3.5 + 0.3 * Math.sin(a * 3), 7.2 * (s < 0 ? -1 : 1) * Math.pow(Math.abs(s), 0.55)];
  }
  anim.push(function (t, dt) {
    var on = api.patrol, p, p1, p0;
    if (on) patrolA += dt * 0.3;
    if (on) { p = patrolPos(patrolA); p1 = patrolPos(patrolA + 0.03); p0 = patrolPos(patrolA - 0.03); }
    else { p = [-3.4, 4.6 + 0.12 * Math.sin(t * 1.5), 1.2]; p1 = p; p0 = p; }
    drone.position.set(p[0], p[1], p[2]);
    drone.rotation.y = on ? Math.atan2(-(p1[0] - p0[0]), -(p1[2] - p0[2])) : t * 0.4;
    drone.rotation.z = on ? 0.08 * Math.sin(t * 2) : 0;
    var col = mode === 'broken' ? 0xffa31a : mode === 'off' ? 0x505050 : 0x5dffa0;
    tip.material = mats.status;
    halo.material.color.setHex(col);
    halo.material.opacity = 0.2 + 0.2 * (0.5 + 0.5 * Math.sin(t * 5));
    beam.material.color.setHex(col);
    beam.visible = on && mode !== 'off';
    drone.visible = !ghost;
  });

  /* ---------- Estados, demostración y API ---------- */
  var mode = 'working', fill = 0.15, drillT = 0, lastT = null, demoHold = 0, crushT = 0, ghost = false;
  var origEm = {};
  var api = {
    group: group,
    footprint: { w: 10, d: 10 },     // 10 x 10 unidades (40 m); la base está en y = 0
    output: outPort,                 // punto donde sale el mineral
    demo: true,
    patrol: true,                    // el dron patrulla alrededor; false = flota sobre la cabina
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
        m.transparent = ghost; m.opacity = ghost ? 0.45 : 1; m.depthWrite = !ghost;
        if (m.isMeshStandardMaterial) {
          if (ghost) { m.emissive.setHex(valid === false ? 0xff2a2a : 0x25ff7a); m.emissiveIntensity = 0.5; }
          else { m.emissive.setHex(origEm[key].c); m.emissiveIntensity = origEm[key].i; }
        }
        m.needsUpdate = true;
      }
      chunkA.visible = chunkB.visible = !ghost;
    },
    update: function (t) {
      var dt = lastT == null ? 0 : Math.min(0.1, t - lastT);
      lastT = t;
      if (api.demo) {
        if (mode === 'working') { fill += 0.04 * dt; if (fill >= 1) { fill = 1; mode = 'full'; demoHold = 0; } }
        else if (mode === 'full') { demoHold += dt; if (demoHold > 1.2) { mode = 'crush'; crushT = 0; } }
        else if (mode === 'crush') { crushT += dt; fill = 1 - 0.45 * Math.min(1, crushT / 4); if (crushT >= 4) mode = 'unload'; }
        else if (mode === 'unload') { fill -= 0.1 * dt; if (fill <= 0) { fill = 0; mode = 'working'; } }
      } else if (mode === 'working') { fill = Math.min(1, fill + 0.0 * dt); }
      var working = mode === 'working' && !ghost, unload = mode === 'unload' && !ghost, crushing = mode === 'crush' && !ghost;
      if (working) drillT += dt;
      rod.rotation.y += working ? dt * 9 : 0;
      rod.position.y = working ? -0.45 - 0.4 * Math.sin(drillT * 0.9) : -0.45;
      beltOff += working ? dt * 0.9 : 0;
      outOff += unload ? dt * 1.4 : 0;
      placeCleats(cleatsB, bn, BL, beltOff, beltFn);
      placeCleats(cleatsO, on, OL, outOff, outFn);
      chunkA.visible = !ghost; chunkB.visible = unload;
      placeChunks(chunkA, 10, BL, beltOff, beltFn, 0.1, false);       // la cinta de entrada se detiene mientras se tritura
      if (unload) placeChunks(chunkB, 36, OL, outOff, outFn, 0.1, true);   // salen trozos pequeños
      var f = Math.max(0.01, fill);
      oreTop.position.y = S0 + 0.35 + f * (S1 - S0 - 0.6);
      lvl.scale.y = f * 1.8; lvl.position.y = S0 + 0.1 + f * 0.9;
      var col = mode === 'working' || mode === 'unload' ? 0x35ff7a : mode === 'crush' ? 0xffd030 : mode === 'full' ? 0xff3b30 : mode === 'broken' ? 0xffa31a : 0x303030;
      if (mode === 'full' || mode === 'broken') mats.status.color.setHex(Math.sin(t * 6) > 0 ? col : 0x301010); else mats.status.color.setHex(col);
      for (var ai = 0; ai < anim.length; ai++) anim[ai](t, dt, working, unload, crushing);
      for (var i = 0; i < blinkers.length; i++) blinkers[i].m.visible = mode !== 'off' && Math.sin(t * TAU / blinkers[i].per + blinkers[i].ph) > -0.2;
      for (i = 0; i < dustRings.length; i++) {
        var ph = ((drillT * 0.7 + i / 3) % 1), d = dustRings[i];
        d.visible = working;
        if (working) { d.scale.set(1 + ph * 2.6, 1, 1 + ph * 2.6); d.material.opacity = (1 - ph) * 0.32; }
      }
    }
  };
  api.update(0);
  return api;
}
