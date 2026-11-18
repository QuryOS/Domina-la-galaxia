/**
 * Invernadero (NIVEL 2 de 2) para Three.js, sin archivos externos. Instalación grande para producir alimentos en el planeta.
 *
 * Biodomo geodésico de 20 m con jardín en terrazas, estanque con cascada, árbol grande, senderos y bancos; dos alas de cristal
 * a dos aguas (A: arbustos con bayas que maduran; B: arrozal con espigas que se doran) con ventanas de cumbrera que se abren;
 * torre de cultivo vertical de 8 pisos con luces magenta y ascensor exterior con cabina móvil; planta de procesado con cinta
 * transportadora (las cajas avanzan), silos y enfriadores con ventiladores; depuradoras con brazo barredor, cisternas, paneles
 * solares, estación meteorológica con anemómetro, dunas de arena, filtros de polvo, cortina antipolvo, postes de luz y letrero.
 * Sin vallas, dron ni aerogeneradores.
 *
 * Uso:
 *   const gh = createInvernadero2(THREE, { accent: 0x4fce6a });
 *   gh.group.position.set(x, groundY, z);        // la base de la losa está en y = 0
 *   scene.add(gh.group);
 *   gh.update(clock.getElapsedTime());
 *
 * Escala: 1 unidad = 4 m. Huella: 20 x 20 unidades (gh.footprint), centrada en el origen. Altura ~11.
 * Entrada: gh.entrance (borde +Z). Agua/energía: gh.input (borde -X). Cosecha: gh.output (borde +X). gh.nivel = 2.
 *
 * Estados (gh.setState): 'working', 'alert' (rojo, ventanas cerradas), 'broken' (luces y ventanas fallando), 'off'.
 *   Por defecto corre una demostración (gh.demo = true); setState la desactiva. gh.setGrowth(0..1): estado de los cultivos.
 *   gh.setGhost(true, valid) para colocar; gh.setAccent(hex).
 * Compatible con Three.js r128 o superior.
 */
function createInvernadero2(THREE, opts) {
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
  var SLAB = 0.4, SZ = 20, k, j, i, q, y0 = SLAB;
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
  mats.glassG = std(0xbfeccf, 0.15, 0.05, { transparent: true, opacity: 0.24, depthWrite: false });
  mats.glassF = std(0xd9f7e6, 0.2, 0.05, { transparent: true, opacity: 0.2, depthWrite: false });
  mats.frame = std(0xdfe5e8, 0.6, 0.4);
  mats.winW = bas(0xffe3a0); mats.eC = bas(0x6dff9a); mats.dim = bas(0x23303c);
  mats.road = std(0x363940, 0.2, 0.85); mats.stone = std(0x8a8478, 0.1, 0.9); mats.stoneD = std(0x6a655b, 0.1, 0.9);
  mats.soil = std(0x4a3a2c, 0, 0.95); mats.soilD = std(0x372a20, 0, 0.95); mats.wood = std(0x9a7448, 0, 0.85); mats.bark = std(0x6b4a2f, 0, 0.9);
  mats.leaf = std(0x3f9a4c, 0, 0.8); mats.leaf2 = std(0x2a7a3c, 0, 0.8); mats.leaf3 = std(0x7ccf55, 0, 0.8); mats.gold = std(0xd7b24a, 0, 0.7);
  mats.berryR = std(0xd9362a, 0, 0.5); mats.berryB = std(0x3a4fb0, 0, 0.5); mats.flowP = std(0xff7ac8, 0, 0.6); mats.flowY = std(0xffd23a, 0, 0.6);
  mats.growL = bas(0xff4fd8); mats.water = std(0x4aa8d8, 0.3, 0.25, { transparent: true, opacity: 0.85 });
  mats.solar = std(0x16264a, 0.85, 0.22, { emissive: 0x0a1a3a, emissiveIntensity: 0.4 });
  mats.cell = std(0x6d86b8, 0.8, 0.3);
  mats.tank = std(0xe7ecef, 0.3, 0.5); mats.blue = std(0x2f7bc0, 0.4, 0.5); mats.cont = std(0x3f6f8f, 0.45, 0.55); mats.contB = std(0xc9a02f, 0.45, 0.55);
  mats.sand = std(0xc2a06a, 0, 0.95); mats.sandD = std(0xa88550, 0, 0.95);
  mats.fall = new THREE.MeshBasicMaterial({ color: 0xcfeaff, transparent: true, opacity: 0.55, depthWrite: false });
  mats.mist = new THREE.MeshBasicMaterial({ color: 0xe8f6ff, transparent: true, opacity: 0.25, depthWrite: false });
  mats.smoke = new THREE.MeshBasicMaterial({ color: 0xdadada, transparent: true, opacity: 0.25, depthWrite: false });
  mats.lineR = new THREE.LineBasicMaterial({ color: 0xcfe9dc, transparent: true, opacity: 0.8 });
  mats.hazY = std(0xf2b01e, 0.3, 0.5); mats.hazK = std(0x15171b, 0.3, 0.7);
  var domeLines = [], fanGroups = [], growS = [], hanFans = [], flaps = [];

  /* ---------- Losa, avenida y luces de borde ---------- */
  box(group, SZ, SLAB, SZ, mats.slab, 0, SLAB / 2, 0, 0.07);
  box(group, SZ - 0.8, 0.04, SZ - 0.8, mats.conc, 0, SLAB + 0.01, 0, 0.01);
  box(group, 1.4, 0.05, 3.8, mats.road, 0, SLAB + 0.03, 8.0, 0.01);
  for (k = 0; k < 5; k++) box(group, 0.08, 0.052, 0.4, mats.panel, 0, SLAB + 0.035, 9.6 - k * 0.7, 0.005);
  var edgeL = [];
  for (k = 0; k < 21; k++) { var ev = -9.0 + k * 0.9; edgeL.push({ x: ev, y: SLAB + 0.03, z: -9.82, sx: 0.28, sy: 0.03, sz: 0.08 }); edgeL.push({ x: ev, y: SLAB + 0.03, z: 9.82, sx: 0.28, sy: 0.03, sz: 0.08 }); edgeL.push({ x: -9.82, y: SLAB + 0.03, z: ev, sx: 0.08, sy: 0.03, sz: 0.28 }); edgeL.push({ x: 9.82, y: SLAB + 0.03, z: ev, sx: 0.08, sy: 0.03, sz: 0.28 }); }
  var edgeM = boxField(UB, mats.eC, edgeL); group.add(edgeM);

  /* ---------- Biodomo geodésico de 20 m con jardín en terrazas ---------- */
  var DCZ = 0.6, DR = 5.0, dBase = y0 + 0.6;
  function hemiIco(R, det) {
    var src = new THREE.IcosahedronGeometry(R, det), pa = src.attributes.position, pos = [], el = [], seen = {}, f, v, a, b;
    function fix(x, y, z) { if (y < 0) { var l = Math.sqrt(x * x + z * z) || 1; return [x / l * R, 0, z / l * R]; } return [x, y, z]; }
    for (f = 0; f + 2 < pa.count; f += 3) {
      var vs = [fix(pa.getX(f), pa.getY(f), pa.getZ(f)), fix(pa.getX(f + 1), pa.getY(f + 1), pa.getZ(f + 1)), fix(pa.getX(f + 2), pa.getY(f + 2), pa.getZ(f + 2))];
      if (pa.getY(f) < -0.01 * R && pa.getY(f + 1) < -0.01 * R && pa.getY(f + 2) < -0.01 * R) continue;
      var cy = (pa.getY(f) + pa.getY(f + 1) + pa.getY(f + 2)) / 3; if (cy < -0.02 * R) continue;
      for (v = 0; v < 3; v++) pos.push(vs[v][0], vs[v][1], vs[v][2]);
      for (v = 0; v < 3; v++) {
        a = vs[v]; b = vs[(v + 1) % 3];
        var dl = Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]); if (dl < 0.05) continue;
        var ka = a[0].toFixed(2) + ',' + a[1].toFixed(2) + ',' + a[2].toFixed(2), kb = b[0].toFixed(2) + ',' + b[1].toFixed(2) + ',' + b[2].toFixed(2), key = ka < kb ? ka + '|' + kb : kb + '|' + ka;
        if (!seen[key]) { seen[key] = 1; el.push([a, b]); }
      }
    }
    var g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.computeVertexNormals();
    return { g: g, edges: el };
  }
  var hd = hemiIco(DR, 2);
  var domeMesh = add(group, hd.g, mats.glassG, 0, dBase, DCZ);
  var domeFrame = new THREE.Group(); domeFrame.position.set(0, dBase, DCZ); group.add(domeFrame);
  hd.edges.forEach(function (e) { strutIn(domeFrame, e[0], e[1], 0.03, mats.frame); });
  var nodeSeen = {}; hd.edges.forEach(function (e) { [e[0], e[1]].forEach(function (p) { var nk = p[0].toFixed(2) + ',' + p[1].toFixed(2) + ',' + p[2].toFixed(2); if (p[1] > 0.01 && !nodeSeen[nk]) { nodeSeen[nk] = 1; add(domeFrame, new THREE.SphereGeometry(0.055, 6, 5), mats.frame, p[0], p[1], p[2]); } }); });
  cylP(group, DR + 0.1, DR + 0.15, 0.6, 40, mats.concD, 0, y0 + 0.3, DCZ);
  add(group, new THREE.TorusGeometry(DR + 0.05, 0.07, 8, 48).rotateX(P / 2), mats.accent, 0, dBase + 0.02, DCZ);
  cylP(group, 0.12, 0.12, 0.5, 8, mats.frame, 0, dBase + DR + 0.2, DCZ); add(group, new THREE.SphereGeometry(0.12, 10, 8), mats.accent, 0, dBase + DR + 0.5, DCZ);
  // vestíbulo de entrada con puerta, cortina antipolvo y reja de limpieza
  var VZ = DCZ + DR + 0.5;
  box(group, 2.6, 2.7, 1.5, mats.glassG, 0, y0 + 1.5, VZ - 0.05, 0.02);
  [-1.3, 1.3].forEach(function (x) { box(group, 0.1, 2.7, 0.1, mats.frame, x, y0 + 1.5, VZ + 0.7, 0.01); box(group, 0.1, 2.7, 0.1, mats.frame, x, y0 + 1.5, VZ - 0.8, 0.01); });
  box(group, 2.7, 0.12, 1.6, mats.conc, 0, y0 + 2.9, VZ - 0.05, 0.02); box(group, 2.72, 0.08, 1.62, mats.accent, 0, y0 + 2.8, VZ - 0.05, 0.01);
  box(group, 0.1, 2.0, 0.1, mats.frame, -0.7, y0 + 1.4, VZ + 0.72, 0.01); box(group, 0.1, 2.0, 0.1, mats.frame, 0.7, y0 + 1.4, VZ + 0.72, 0.01); box(group, 1.5, 0.1, 0.1, mats.frame, 0, y0 + 2.4, VZ + 0.72, 0.01);
  var curt = []; for (k = 0; k < 9; k++) curt.push({ x: -0.6 + k * 0.15, y: y0 + 1.3, z: VZ + 0.6, sx: 0.12, sy: 2.0, sz: 0.01 });
  group.add(boxField(UB, mats.dark, curt));
  box(group, 1.8, 0.04, 1.0, mats.dark, 0, y0 + 0.07, VZ + 1.2, 0.01); for (k = 0; k < 9; k++) box(group, 1.7, 0.02, 0.04, mats.trim, 0, y0 + 0.1, VZ + 0.8 + k * 0.1, 0.003);
  var sigDim = [], sigOn = [];
  for (k = 0; k < 5; k++) { var bh = 0.1 + k * 0.08, bxp = -0.4 + k * 0.2; sigDim.push(box(group, 0.12, bh, 0.03, mats.dim, bxp, y0 + 2.55 + bh / 2 - 0.05, VZ + 0.75, 0.005)); sigOn.push(box(group, 0.12, bh, 0.04, mats.eC, bxp, y0 + 2.55 + bh / 2 - 0.05, VZ + 0.76, 0.005)); }
  // interior: suelo, terrazas, estanque con cascada, árbol, senderos y bancos
  add(group, new THREE.CircleGeometry(DR - 0.05, 40).rotateX(-P / 2), mats.road, 0, y0 + 0.64, DCZ);
  var terr = [[4.35, 0.32, mats.soilD], [3.6, 0.62, mats.soil], [2.85, 0.92, mats.soilD]];
  terr.forEach(function (t, n) { cylP(group, t[0], t[0], t[1], 36, t[2], 0, y0 + 0.6 + t[1] / 2, DCZ); add(group, new THREE.TorusGeometry(t[0], 0.08, 6, 40).rotateX(P / 2), mats.stone, 0, y0 + 0.6 + t[1], DCZ); });
  cylP(group, 2.7, 2.7, 0.05, 32, mats.soil, 0, y0 + 1.53, DCZ);
  cylP(group, 1.7, 1.7, 0.08, 28, mats.water, 0, y0 + 1.56, DCZ); add(group, new THREE.TorusGeometry(1.72, 0.12, 8, 28).rotateX(P / 2), mats.stoneD, 0, y0 + 1.58, DCZ);
  for (k = 0; k < 14; k++) { var ra = k / 14 * TAU, rs = 0.14 + rnd() * 0.1; add(group, new THREE.SphereGeometry(rs, 6, 5), mats.stone, Math.cos(ra) * 1.78, y0 + 1.58, DCZ + Math.sin(ra) * 1.78); }
  [[0, 0, 0.7, 0.55], [0.3, 0.4, 0.5, 1.0], [-0.25, -0.3, 0.42, 1.4], [0.05, 0.1, 0.32, 1.75]].forEach(function (r) { var rk = add(group, new THREE.DodecahedronGeometry(r[2], 0), mats.stone, r[0], y0 + 1.55 + r[3] * 0.6, DCZ + r[1]); rk.scale.set(1.2, 0.9, 1.1); });
  cylP(group, 0.07, 0.1, 1.1, 8, mats.fall, 0.05, y0 + 1.95 + 0.3, DCZ + 0.15);
  // senderos radiales y escalones
  for (k = 0; k < 4; k++) { var sa = k * P / 2 + P / 4, sx = Math.cos(sa), sz = Math.sin(sa); for (j = 0; j < 3; j++) box(group, 0.9, 0.3, 0.45, mats.stone, sx * (4.15 - j * 0.7), y0 + 0.77 + j * 0.3, DCZ + sz * (4.15 - j * 0.7), 0.02).rotation.y = -sa + P / 2; }
  for (k = 0; k < 8; k++) { var ba = k * P / 4 + P / 8; box(group, 0.8, 0.22, 0.3, mats.wood, Math.cos(ba) * 4.7, y0 + 0.77, DCZ + Math.sin(ba) * 4.7, 0.03).rotation.y = -ba + P / 2; }
  // árbol grande (cabe dentro del domo)
  var TRX = -1.9, TRZ = DCZ + 0.9, TRY = y0 + 1.55;
  cylP(group, 0.12, 0.2, 1.7, 10, mats.bark, TRX, TRY + 0.85, TRZ);
  for (k = 0; k < 4; k++) { var ta = k * P / 2 + 0.4; strutIn(group, [TRX, TRY + 1.4, TRZ], [TRX + Math.cos(ta) * 0.7, TRY + 2.0, TRZ + Math.sin(ta) * 0.7], 0.06, mats.bark); }
  [[0, 2.45, 0.95], [0.7, 2.15, 0.7], [-0.7, 2.2, 0.7], [0.1, 2.9, 0.65], [0.0, 2.0, 0.6]].forEach(function (c, n) { add(group, new THREE.SphereGeometry(c[2], 12, 8), n % 2 ? mats.leaf : mats.leaf2, TRX + c[0], TRY + c[1] - (n === 3 ? 0.35 : 0), TRZ + (n % 2 ? 0.25 : -0.2)); });
  [[1.9, DCZ - 1.3, 0.8], [-0.4, DCZ - 2.0, 0.6]].forEach(function (p) { cylP(group, 0.06, 0.1, 0.9, 8, mats.bark, p[0], y0 + 1.55 + 0.45, p[1]); add(group, new THREE.SphereGeometry(p[2] * 0.6, 10, 8), mats.leaf3, p[0], y0 + 1.55 + 1.2, p[1]); });
  [[-3.0, DCZ + 1.8], [3.1, DCZ + 1.4], [2.2, DCZ - 2.6], [-2.4, DCZ - 2.7]].forEach(function (p) { add(group, new THREE.SphereGeometry(0.26, 8, 6), mats.leaf2, p[0], y0 + 0.5 + 0.34, p[1]).scale.y = 0.7; });
  // farolas colgantes
  for (k = 0; k < 6; k++) { var la = k / 6 * TAU, lx = Math.cos(la) * 2.6, lz = Math.sin(la) * 2.6, ly = dBase + Math.sqrt(DR * DR - 6.76) - 0.1; strutIn(group, [lx, ly, DCZ + lz], [lx, ly - 0.5, DCZ + lz], 0.012, mats.trim); add(group, new THREE.SphereGeometry(0.11, 8, 6), mats.winW, lx, ly - 0.55, DCZ + lz); }

  /* ---------- Dos alas de cristal a dos aguas: A = frutales y bayas, B = arrozal ---------- */
  var WW = 3.5, WWH = 1.8, WL = 11.4, WZc = 0.0, NB = 3, BL = WL / NB, wingX = [-7.8, 7.8], RISE = 0.8, SL = 0.42, Wcx = [];
  function gableTri(parent, x, y, z) {
    var gg = new THREE.CylinderGeometry(1, 1, 0.04, 3, 1); gg.rotateX(P / 2); gg.rotateZ(P); gg.scale(WW / 2 / 0.866, RISE / 1.5, 1);
    return add(parent, gg, mats.glassG, x, y, z);
  }
  wingX.forEach(function (hx, h) {
    var hg = new THREE.Group(); hg.position.set(hx, y0, WZc); group.add(hg);
    box(hg, WW + 0.2, 0.3, WL + 0.2, mats.concD, 0, 0.15, 0, 0.03);
    box(hg, 0.07, WWH, WL, mats.glassG, -WW / 2, 0.3 + WWH / 2, 0, 0.005); box(hg, 0.07, WWH, WL, mats.glassG, WW / 2, 0.3 + WWH / 2, 0, 0.005);
    box(hg, 0.09, 0.09, WL, mats.frame, -WW / 2, 0.3 + WWH, 0, 0.01); box(hg, 0.09, 0.09, WL, mats.frame, WW / 2, 0.3 + WWH, 0, 0.01);
    box(hg, 0.09, 0.09, WL, mats.frame, 0, 0.3 + WWH + RISE, 0, 0.01);
    for (i = 0; i <= NB; i++) {
      var rz = -WL / 2 + i * BL;
      strutIn(hg, [-WW / 2, 0.3, rz], [-WW / 2, 0.3 + WWH, rz], 0.045, mats.frame); strutIn(hg, [WW / 2, 0.3, rz], [WW / 2, 0.3 + WWH, rz], 0.045, mats.frame);
      strutIn(hg, [-WW / 2, 0.3 + WWH, rz], [0, 0.3 + WWH + RISE, rz], 0.04, mats.frame); strutIn(hg, [WW / 2, 0.3 + WWH, rz], [0, 0.3 + WWH + RISE, rz], 0.04, mats.frame);
      strutIn(hg, [-WW / 2, 0.3 + WWH, rz], [WW / 2, 0.3 + WWH, rz], 0.016, mats.trim);
      strutIn(hg, [0, 0.3 + WWH, rz], [0, 0.3 + WWH + RISE, rz], 0.016, mats.trim);
      if (i === 0 || i === NB) gableTri(hg, 0, 0.3 + WWH + RISE * 0.33, rz);
    }
    for (i = 0; i < NB; i++) {
      var bz = -WL / 2 + (i + 0.5) * BL;
      box(hg, WW / 2 / Math.cos(SL), 0.04, BL - 0.1, mats.glassG, -WW / 4, 0.3 + WWH + RISE / 2, bz, 0.005).rotation.z = SL;
      var fh = new THREE.Group(); fh.position.set(0, 0.3 + WWH + RISE, bz); hg.add(fh);
      box(fh, WW / 2 / Math.cos(SL), 0.04, BL - 0.1, mats.glassF, WW / 4 / Math.cos(SL) * Math.cos(SL), -RISE / 2, 0, 0.005).rotation.z = -SL;
      flaps.push({ g: fh, h: h, i: i });
      box(hg, WW, 0.06, 0.08, mats.concD, 0, 0.3 + WWH - 0.05, bz + BL / 2, 0.01);
    }
    var padL = []; for (j = 0; j < 4; j++) for (i = 0; i < 6; i++) padL.push({ x: -1.35 + i * 0.54, y: 0.5 + j * 0.34, z: WL / 2 + 0.12, sx: 0.44, sy: 0.26, sz: 0.06 });
    hg.add(boxField(UB, mats.sandD, padL));
    cylP(hg, 0.6, 0.6, 0.2, 20, mats.hull2, 0, 0.3 + WWH + 0.2, -WL / 2 - 0.12).rotation.x = P / 2;
    var fg2 = new THREE.Group(); fg2.position.set(0, 0.3 + WWH + 0.2, -WL / 2 - 0.24); hg.add(fg2);
    for (k = 0; k < 4; k++) { var bl = box(fg2, 0.12, 0.5, 0.015, mats.trim, 0, 0, 0, 0.003); bl.position.set(Math.cos(k * P / 2 + 0.4) * 0.26, Math.sin(k * P / 2 + 0.4) * 0.26, 0); bl.rotation.z = k * P / 2 + 0.4 - P / 2; }
    cylP(fg2, 0.08, 0.08, 0.05, 8, mats.accent, 0, 0, 0.02).rotation.x = P / 2; fanGroups.push(fg2);
    box(hg, 0.3, WWH, 0.3, mats.frame, 0, 0.3 + WWH / 2, WL / 2, 0.02).visible = false;
    Wcx.push(hx);
  });
  // pasillos de cristal domo-alas
  [-1, 1].forEach(function (s) { box(group, 1.4, 1.8, 1.2, mats.glassG, s * 5.9, y0 + 1.1, DCZ, 0.02); box(group, 1.5, 0.08, 1.3, mats.frame, s * 5.9, y0 + 2.0, DCZ, 0.01); box(group, 0.07, 1.8, 0.07, mats.frame, s * 5.2, y0 + 1.1, DCZ - 0.6, 0.01); box(group, 0.07, 1.8, 0.07, mats.frame, s * 5.2, y0 + 1.1, DCZ + 0.6, 0.01); box(group, 0.07, 1.8, 0.07, mats.frame, s * 6.6, y0 + 1.1, DCZ - 0.6, 0.01); box(group, 0.07, 1.8, 0.07, mats.frame, s * 6.6, y0 + 1.1, DCZ + 0.6, 0.01); });

  /* ---------- Plantas: arbustos con bayas, arroz y vegetación del domo (instanciado) ---------- */
  var dd = new THREE.Object3D();
  function setM(mesh, idx, x, y, z, sx, sy, sz) { dd.position.set(x, y, z); dd.rotation.set(0, 0, 0); dd.scale.set(sx, sy, sz); dd.updateMatrix(); mesh.setMatrixAt(idx, dd.matrix); }
  var bush = [], rice = [], domeP = [];
  [-0.95, 0.95].forEach(function (dx) {
    box(group, 1.1, 0.26, WL - 0.6, mats.soil, wingX[0] + dx, y0 + 0.31, WZc, 0.03); box(group, 1.2, 0.1, WL - 0.5, mats.wood, wingX[0] + dx, y0 + 0.23, WZc, 0.02);
    cylP(group, 0.02, 0.02, WL - 0.9, 6, mats.dark, wingX[0] + dx, y0 + 0.46, WZc).rotation.x = P / 2;
    for (i = 0; i < 12; i++) bush.push({ x: wingX[0] + dx + (i % 2 ? 0.1 : -0.1), z: -WL / 2 + 0.8 + i * 0.89, ph: rnd() * TAU });
    box(group, 1.4, 0.05, WL - 0.6, mats.road, wingX[0], y0 + 0.31, WZc, 0.01);
  });
  [-0.95, 0.95].forEach(function (dx) {
    box(group, 1.3, 0.28, WL - 0.6, mats.stoneD, wingX[1] + dx, y0 + 0.32, WZc, 0.03); box(group, 1.1, 0.05, WL - 0.8, mats.water, wingX[1] + dx, y0 + 0.47, WZc, 0.01);
    for (i = 0; i < 20; i++) for (j = 0; j < 3; j++) rice.push({ x: wingX[1] + dx - 0.35 + j * 0.35, z: -WL / 2 + 0.7 + i * 0.5, ph: rnd() * TAU });
  });
  box(group, 0.9, 0.04, WL - 0.6, mats.road, wingX[1], y0 + 0.31, WZc, 0.01);
  var domeRings = [[4.0, 24, 0.5], [3.25, 18, 0.8], [2.5, 12, 1.2]];
  domeRings.forEach(function (r) { for (i = 0; i < r[1]; i++) { var a = i / r[1] * TAU + r[0]; domeP.push({ x: Math.cos(a) * r[0], z: DCZ + Math.sin(a) * r[0], y: y0 + 0.6 + (r[0] > 3.9 ? 0.32 : r[0] > 3.1 ? 0.62 : 0.92), c: i % 4 === 0 ? 1 : 0, ph: rnd() * TAU }); } });
  var bushM = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 9, 7), mats.leaf2, bush.length), berR = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 6, 5), mats.berryR, bush.length * 4), berB = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 6, 5), mats.berryB, bush.length * 4);
  var riceG = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.012, 0.02, 1, 5), mats.leaf3, rice.length), riceY = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.014, 0.024, 1, 5), mats.gold, rice.length);
  var domeB = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 8, 6), mats.leaf, domeP.length), domeF = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 6, 5), mats.flowP, domeP.length), domeF2 = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 6, 5), mats.flowY, domeP.length);
  var allInst = [bushM, berR, berB, riceG, riceY, domeB, domeF, domeF2]; allInst.forEach(function (m) { m.frustumCulled = false; group.add(m); });
  function updatePlants(g, t) {
    var n, a, x, z, s, sw;
    for (n = 0; n < bush.length; n++) {
      var b = bush[n]; s = 0.14 + 0.2 * g; sw = Math.sin(t * 0.8 + b.ph) * 0.01 * g;
      setM(bushM, n, b.x + sw, y0 + 0.44 + s * 0.8, b.z, s * 1.4, s, s * 1.3);
      for (j = 0; j < 4; j++) { a = j * 1.7 + b.ph; var fr = g > 0.6 ? 0.045 * clamp((g - 0.6) / 0.3, 0, 1) : 0.0001; x = b.x + Math.cos(a) * s * 1.2 + sw; z = b.z + Math.sin(a) * s * 1.1; setM(n % 2 ? berR : berB, n * 4 + j, x, y0 + 0.44 + s * (0.9 + 0.2 * j % 3), z, fr, fr, fr); setM(n % 2 ? berB : berR, n * 4 + j, x, y0 + 0.44 + s, z, 0.0001, 0.0001, 0.0001); }
    }
    for (n = 0; n < rice.length; n++) {
      var rp = rice[n], hr = 0.12 + 0.6 * g, sy = Math.sin(t * 1.1 + rp.ph) * 0.01 * g;
      setM(g > 0.85 ? riceY : riceG, n, rp.x + sy, y0 + 0.46 + hr / 2, rp.z, 1, hr, 1); setM(g > 0.85 ? riceG : riceY, n, rp.x, y0 + 0.46, rp.z, 0.0001, 0.0001, 0.0001);
    }
    for (n = 0; n < domeP.length; n++) {
      var dp = domeP[n], sd = 0.16 + 0.2 * g;
      setM(domeB, n, dp.x, dp.y + sd * 0.7, dp.z, sd * 1.2, sd, sd * 1.2);
      setM(domeF, n, dp.x, dp.y + sd * 1.5, dp.z, dp.c ? sd * 0.4 * g : 0.0001, dp.c ? sd * 0.4 * g : 0.0001, dp.c ? sd * 0.4 * g : 0.0001);
      setM(domeF2, n, dp.x + 0.12, dp.y + sd * 1.3, dp.z + 0.05, !dp.c && n % 3 === 0 ? sd * 0.35 * g : 0.0001, !dp.c && n % 3 === 0 ? sd * 0.35 * g : 0.0001, !dp.c && n % 3 === 0 ? sd * 0.35 * g : 0.0001);
    }
    allInst.forEach(function (m) { m.instanceMatrix.needsUpdate = true; });
  }
  // luces de crecimiento sobre el arrozal y cableado de las alas
  for (i = 0; i < NB; i++) { var gzp = -WL / 2 + (i + 0.5) * BL; growS.push({ x: wingX[1] - 0.95, y: y0 + 2.3, z: gzp, sx: 0.5, sy: 0.04, sz: BL - 0.8 }); growS.push({ x: wingX[1] + 0.95, y: y0 + 2.3, z: gzp, sx: 0.5, sy: 0.04, sz: BL - 0.8 }); strutIn(group, [wingX[1] - 0.95, y0 + 2.3, gzp - 1], [wingX[1] - 0.95, y0 + 2.9, gzp - 1], 0.01, mats.trim); strutIn(group, [wingX[1] + 0.95, y0 + 2.3, gzp - 1], [wingX[1] + 0.95, y0 + 2.9, gzp - 1], 0.01, mats.trim); }
  // aspersores en el ala A
  var nozz = []; cylP(group, 0.04, 0.04, WL - 0.8, 8, mats.blue, wingX[0], y0 + 2.75, WZc).rotation.x = P / 2;
  for (i = 0; i < 9; i++) { var nz = -WL / 2 + 0.8 + i * 1.2; add(group, new THREE.SphereGeometry(0.05, 8, 6), mats.trim, wingX[0], y0 + 2.67, nz); nozz.push(nz); strutIn(group, [wingX[0], y0 + 2.75, nz], [wingX[0], y0 + 2.67, nz], 0.012, mats.trim); }

  /* ---------- Torre de cultivo vertical de 8 pisos con ascensor exterior ---------- */
  var VX = -3.7, VZ = -8.1, VW = 3.0, VFL = 8, VFH = 1.05, vy = y0 + 0.5;
  box(group, VW + 0.3, 0.5, VW + 0.3, mats.concD, VX, y0 + 0.25, VZ, 0.04);
  box(group, VW - 0.2, 0.2, VW - 0.2, mats.hull2, VX, y0 + 0.6, VZ, 0.02);
  var vGrow = [], vLeaf = [];
  for (j = 0; j < VFL; j++) {
    var fy = vy + 0.2 + j * VFH;
    box(group, VW + 0.12, 0.1, VW + 0.12, mats.conc, VX, fy, VZ, 0.02);
    [[0, VW / 2, VW, 0.05], [0, -VW / 2, VW, 0.05], [VW / 2, 0, 0.05, VW], [-VW / 2, 0, 0.05, VW]].forEach(function (w) { add(group, new THREE.BoxGeometry(w[2], VFH - 0.12, w[3]), mats.glassG, VX + w[0], fy + VFH / 2, VZ + w[1]); });
    [[-1, 1], [1, 1]].forEach(function (s) { vGrow.push({ x: VX + s[0] * 0.55, y: fy + VFH - 0.2, z: VZ, sx: 0.9, sy: 0.04, sz: VW - 0.7 }); });
    [-0.55, 0.55].forEach(function (ox) { vLeaf.push({ x: VX + ox, y: fy + 0.3, z: VZ, sx: 0.8, sy: 0.22, sz: VW - 0.8 }); box(group, 0.9, 0.06, VW - 0.7, mats.tank, VX + ox, fy + 0.18, VZ, 0.01); });
  }
  group.add(boxField(UB, mats.leaf3, vLeaf)); var vGrowM = boxField(UB, mats.growL, vGrow); group.add(vGrowM);
  [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(function (c) { box(group, 0.14, VFL * VFH + 0.2, 0.14, mats.frame, VX + c[0] * VW / 2, vy + VFL * VFH / 2 + 0.1, VZ + c[1] * VW / 2, 0.02); });
  for (j = 0; j <= VFL; j++) { var rzz = vy + 0.2 + j * VFH; [[0, VW / 2, VW + 0.1, 0.05], [0, -VW / 2, VW + 0.1, 0.05]].forEach(function (w) { box(group, w[2], 0.05, w[3], mats.frame, VX, rzz + 0.05, VZ + w[1], 0.01); }); }
  var vtop = vy + 0.2 + VFL * VFH;
  box(group, VW + 0.4, 0.16, VW + 0.4, mats.conc, VX, vtop + 0.08, VZ, 0.03); box(group, VW + 0.42, 0.08, VW + 0.42, mats.accent, VX, vtop + 0.2, VZ, 0.01);
  cylP(group, 0.7, 0.7, 0.9, 18, mats.tank, VX - 0.5, vtop + 0.7, VZ - 0.2); add(group, new THREE.SphereGeometry(0.7, 14, 6, 0, TAU, 0, P / 2), mats.tank, VX - 0.5, vtop + 1.15, VZ - 0.2); add(group, new THREE.TorusGeometry(0.71, 0.04, 6, 20).rotateX(P / 2), mats.blue, VX - 0.5, vtop + 0.7, VZ - 0.2);
  var fnl = add(group, new THREE.ConeGeometry(0.55, 0.4, 16, 1, true), mats.hull2, VX + 0.75, vtop + 0.45, VZ + 0.6); fnl.rotation.x = P;
  strutIn(group, [VX + 0.75, vtop + 0.25, VZ + 0.6], [VX + 0.75, vtop + 0.05, VZ + 0.6], 0.04, mats.pipe);
  [[0.7, -0.7], [-0.7, 0.7]].forEach(function (p) { box(group, 0.5, 0.35, 0.5, mats.hull2, VX + p[0], vtop + 0.33, VZ + p[1], 0.03); cylP(group, 0.2, 0.2, 0.03, 12, mats.dark, VX + p[0], vtop + 0.52, VZ + p[1]); });
  var statusLamp = add(group, new THREE.SphereGeometry(0.1, 12, 10), mats.status, VX + 1.3, vtop + 0.3, VZ + 1.3);
  // ascensor exterior con cabina móvil
  var LX = VX + VW / 2 + 0.55, LZ = VZ + VW / 2 - 0.3;
  [-0.3, 0.3].forEach(function (o) { box(group, 0.07, VFL * VFH + 0.4, 0.07, mats.trim, LX + o, vy + VFL * VFH / 2 + 0.2, LZ, 0.01); }); box(group, 0.8, 0.1, 0.6, mats.conc, LX, vy + VFL * VFH + 0.45, LZ, 0.01);
  var cab = new THREE.Group(); cab.position.set(LX, vy + 0.4, LZ); group.add(cab); box(cab, 0.55, 0.7, 0.5, mats.glassG, 0, 0.35, 0, 0.02); box(cab, 0.6, 0.06, 0.55, mats.accent, 0, 0.72, 0, 0.01); box(cab, 0.6, 0.05, 0.55, mats.trim, 0, 0.02, 0, 0.01);
  strutIn(group, [VX + VW / 2, vy + 0.4, LZ], [LX - 0.3, vy + 0.4, LZ], 0.03, mats.trim);

  /* ---------- Planta de procesado, silos y cinta transportadora ---------- */
  var PX = 3.4, PZ = -8.1, PW = 5.4, PD = 3.0, PH = 2.5;
  box(group, PW + 0.2, 0.25, PD + 0.2, mats.concD, PX, y0 + 0.125, PZ, 0.03);
  box(group, PW, PH, PD, mats.panel, PX, y0 + PH / 2 + 0.1, PZ, 0.05); box(group, PW + 0.3, 0.14, PD + 0.3, mats.conc, PX, y0 + PH + 0.17, PZ, 0.03); box(group, PW + 0.02, 0.12, PD + 0.02, mats.accent, PX, y0 + PH - 0.1, PZ, 0.01);
  var pr = []; for (k = 0; k < 9; k++) pr.push({ x: PX - 2.4 + k * 0.6, y: y0 + 1.3, z: PZ + PD / 2 + 0.012, sx: 0.06, sy: 2.2, sz: 0.04 });
  group.add(boxField(UB, mats.concD, pr));
  box(group, 2.0, 1.9, 0.1, mats.hull2, PX - 1.2, y0 + 1.1, PZ + PD / 2 + 0.03, 0.02); for (k = 0; k < 12; k++) box(group, 1.9, 0.02, 0.03, mats.trim, PX - 1.2, y0 + 0.4 + k * 0.15, PZ + PD / 2 + 0.09, 0.003);
  haz0(group, 6, [PX - 2.15, y0 + 2.1, PZ + PD / 2 + 0.1], [PX - 0.25, y0 + 2.1, PZ + PD / 2 + 0.1], [0.3, 0.1, 0.02]);
  box(group, 1.0, 1.5, 0.1, mats.accent, PX + 1.3, y0 + 0.9, PZ + PD / 2 + 0.03, 0.02); box(group, 0.8, 1.35, 0.06, mats.dark, PX + 1.3, y0 + 0.88, PZ + PD / 2 + 0.09, 0.02);
  var pwL = []; add(group, new THREE.BoxGeometry(1.6, 0.5, 0.05), mats.strip, PX + 2.0, y0 + 1.7, PZ + PD / 2 + 0.02); for (k = 0; k < 4; k++) pwL.push({ x: PX + 1.4 + k * 0.4, y: y0 + 1.7, z: PZ + PD / 2 + 0.05, sx: 0.3, sy: 0.34, sz: 0.02 });
  var pwMesh = boxField(UB, mats.winW, pwL); group.add(pwMesh);
  box(group, 2.6, 0.18, 1.0, mats.conc, PX - 1.1, y0 + 0.09, PZ + PD / 2 + 0.6, 0.02);
  for (k = 0; k < 3; k++) { var fx = PX - 1.8 + k * 1.4, fgp = new THREE.Group(); fgp.position.set(fx, y0 + PH + 0.5, PZ); group.add(fgp); box(group, 1.0, 0.3, 1.0, mats.hull2, fx, y0 + PH + 0.34, PZ, 0.04); cylP(group, 0.4, 0.4, 0.04, 18, mats.dark, fx, y0 + PH + 0.5, PZ); for (q = 0; q < 4; q++) { var bq = box(fgp, 0.36, 0.012, 0.09, mats.trim, 0, 0, 0, 0.003); bq.position.set(Math.cos(q * P / 2) * 0.18, 0, Math.sin(q * P / 2) * 0.18); bq.rotation.y = -q * P / 2; } fanGroups.push({ rotation: fgp.rotation, y: true }); }
  greeble(PX, y0 + PH + 0.24, PZ, PW - 1.2, 0.2, PD - 1.0, 6, mats.hull2, 'y', 0.12, 0.3);
  // cinta transportadora con cajas que avanzan
  var BZ2 = -6.15, BX0 = PX + 1.3, BX1 = 8.6;
  box(group, BX1 - BX0, 0.12, 0.5, mats.trim, (BX0 + BX1) / 2, y0 + 0.62, BZ2, 0.01); box(group, BX1 - BX0, 0.03, 0.4, mats.dark, (BX0 + BX1) / 2, y0 + 0.69, BZ2, 0.005);
  for (k = 0; k < 8; k++) { var lx2 = BX0 + 0.2 + k * ((BX1 - BX0 - 0.4) / 7); strutIn(group, [lx2, y0 + 0.62, BZ2 - 0.2], [lx2, y0, BZ2 - 0.2], 0.03, mats.trim); strutIn(group, [lx2, y0 + 0.62, BZ2 + 0.2], [lx2, y0, BZ2 + 0.2], 0.03, mats.trim); }
  cylP(group, 0.14, 0.14, 0.52, 10, mats.hull2, BX1, y0 + 0.65, BZ2).rotation.x = P / 2;
  var crateM = new THREE.InstancedMesh(UB, mats.wood, 6), crateT = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 8, 6), mats.leaf3, 6); crateM.frustumCulled = false; crateT.frustumCulled = false; group.add(crateM); group.add(crateT);
  var pall = []; for (k = 0; k < 6; k++) pall.push({ x: 8.3, y: y0 + 0.12 + (k % 3) * 0.2, z: -5.4 + 0 * k, sx: 0.0, sy: 0, sz: 0 });
  box(group, 1.0, 0.1, 1.0, mats.wood, 8.2, y0 + 0.05, -5.2, 0.01); for (k = 0; k < 4; k++) box(group, 0.45, 0.25, 0.4, mats.wood, 8.0 + (k % 2) * 0.4, y0 + 0.23 + Math.floor(k / 2) * 0.26, -5.2, 0.01);
  [[7.3, -8.8], [8.8, -8.8], [8.05, -7.5]].forEach(function (p, n) {
    cylP(group, 0.7, 0.7, 2.0, 20, mats.tank, p[0], y0 + 1.4, p[1]); cylP(group, 0.7, 0.12, 0.6, 20, mats.hull2, p[0], y0 + 2.7, p[1]); cylP(group, 0.7, 0.3, 0.5, 20, mats.hull2, p[0], y0 + 0.65, p[1]);
    for (k = 0; k < 3; k++) add(group, new THREE.TorusGeometry(0.705, 0.03, 6, 22).rotateX(P / 2), mats.accent, p[0], y0 + 0.9 + k * 0.7, p[1]);
    strutIn(group, [p[0] + 0.72, y0 + 0.4, p[1]], [p[0] + 0.72, y0 + 2.4, p[1]], 0.025, mats.trim); cylP(group, 0.08, 0.08, 0.3, 8, mats.trim, p[0], y0 + 3.15, p[1]);
  });
  strutIn(group, [7.3, y0 + 3.0, -8.8], [8.8, y0 + 3.0, -8.8], 0.03, mats.trim); strutIn(group, [8.05, y0 + 3.0, -7.5], [8.05, y0 + 3.0, -8.8], 0.03, mats.trim);
  pipeRun([[7.3, y0 + 0.4, -8.1], [6.3, y0 + 0.4, -8.1], [6.3, y0 + 0.62, -7.3]], 0.07, mats.pipe);

  /* ---------- Frente: depuradoras, depósito, solar, postes, letrero, estación meteorológica ---------- */
  var sweeps = [];
  [[-6.2, 8.0], [-3.3, 8.0]].forEach(function (p) {
    cylP(group, 1.3, 1.3, 0.5, 26, mats.concD, p[0], y0 + 0.25, p[1]); cylP(group, 1.2, 1.2, 0.04, 26, mats.water, p[0], y0 + 0.47, p[1]); add(group, new THREE.TorusGeometry(1.28, 0.06, 6, 28).rotateX(P / 2), mats.hull2, p[0], y0 + 0.55, p[1]);
    box(group, 2.6, 0.06, 0.25, mats.trim, p[0], y0 + 0.62, p[1], 0.01); cylP(group, 0.12, 0.12, 0.3, 10, mats.hull2, p[0], y0 + 0.55, p[1]);
    var sw = new THREE.Group(); sw.position.set(p[0], y0 + 0.52, p[1]); group.add(sw); box(sw, 1.15, 0.03, 0.05, mats.trim, 0.6, 0, 0, 0.003); cylP(sw, 0.03, 0.03, 0.2, 6, mats.hull2, 1.15, -0.05, 0); sweeps.push(sw);
  });
  box(group, 0.8, 0.4, 1.2, mats.hull2, -4.75, y0 + 0.5, 8.0, 0.03); pipeRun([[-5.0, y0 + 0.35, 8.0], [-5.0, y0 + 0.25, 8.0]], 0.06, mats.pipe); pipeRun([[-6.2, y0 + 0.2, 8.0], [-3.3, y0 + 0.2, 8.0]], 0.06, mats.pipe);
  [1.4, 3.1].forEach(function (zz, n) { var cz = cylP(group, 0.5, 0.5, 2.0, 18, mats.tank, -9.0, y0 + 0.65, 6.6 + n * 1.5); cz.rotation.x = P / 2; add(group, new THREE.TorusGeometry(0.51, 0.025, 6, 20), mats.blue, -9.0, y0 + 0.65, 6.1 + n * 1.5); add(group, new THREE.TorusGeometry(0.51, 0.025, 6, 20), mats.blue, -9.0, y0 + 0.65, 7.1 + n * 1.5); });
  for (i = 0; i < 4; i++) {
    var sp = new THREE.Group(); sp.position.set(2.8 + i * 1.9, y0 + 0.5, 8.4); group.add(sp);
    box(sp, 0.1, 0.5, 0.1, mats.trim, -0.7, -0.15, 0.2, 0.01); box(sp, 0.1, 0.5, 0.1, mats.trim, 0.7, -0.15, 0.2, 0.01);
    var pg = new THREE.Group(); pg.rotation.x = 0.55; sp.add(pg); box(pg, 1.7, 0.06, 1.0, mats.solar, 0, 0, 0, 0.015);
    var gl = []; for (k = 1; k < 5; k++) gl.push({ x: -0.85 + k * 0.34, y: 0.035, z: 0, sx: 0.015, sy: 0.01, sz: 0.95 }); for (k = 1; k < 3; k++) gl.push({ x: 0, y: 0.035, z: -0.5 + k * 0.33, sx: 1.65, sy: 0.01, sz: 0.015 });
    pg.add(boxField(UB, mats.cell, gl));
  }
  [[-1.8, 9.2], [1.8, 9.2], [-8.0, -9.0], [9.0, 9.0]].forEach(function (p) { cylP(group, 0.05, 0.07, 2.4, 8, mats.hull2, p[0], y0 + 1.2, p[1]); box(group, 0.4, 0.08, 0.2, mats.dark, p[0] + (p[0] < 0 ? 0.15 : -0.15), y0 + 2.45, p[1], 0.02); add(group, new THREE.BoxGeometry(0.3, 0.02, 0.14), mats.winW, p[0] + (p[0] < 0 ? 0.15 : -0.15), y0 + 2.4, p[1]); box(group, 0.16, 0.12, 0.28, mats.dark, p[0], y0 + 2.2, p[1], 0.02); });
  box(group, 1.7, 0.9, 0.08, mats.dark, -3.2, y0 + 1.4, 9.2, 0.03); box(group, 0.08, 1.1, 0.08, mats.trim, -3.2, y0 + 0.55, 9.18, 0.01);
  var lf = new THREE.SphereGeometry(0.3, 12, 8); lf.scale(1, 0.38, 0.05); add(group, lf, mats.leaf3, -3.5, y0 + 1.4, 9.26).rotation.z = 0.7; add(group, lf.clone(), mats.leaf, -3.2, y0 + 1.52, 9.26).rotation.z = 1.2; strutIn(group, [-3.6, y0 + 1.15, 9.27], [-3.35, y0 + 1.45, 9.27], 0.015, mats.eC);
  box(group, 0.8, 0.07, 0.015, mats.accent, -2.8, y0 + 1.58, 9.26, 0.005); box(group, 0.55, 0.05, 0.015, mats.dim, -2.9, y0 + 1.3, 9.26, 0.005);
  var WSX = 8.8, WSZ = 7.4;
  cylP(group, 0.18, 0.24, 0.3, 10, mats.concD, WSX, y0 + 0.15, WSZ); cylP(group, 0.05, 0.07, 3.0, 8, mats.hull2, WSX, y0 + 1.8, WSZ);
  for (k = 0; k < 3; k++) strutIn(group, [WSX, y0 + 1.0, WSZ], [WSX + Math.cos(k * TAU / 3) * 0.5, y0 + 0.3, WSZ + Math.sin(k * TAU / 3) * 0.5], 0.02, mats.trim);
  box(group, 0.4, 0.3, 0.26, mats.panel, WSX, y0 + 1.2, WSZ + 0.2, 0.03);
  var anemo = new THREE.Group(); anemo.position.set(WSX, y0 + 3.3, WSZ); group.add(anemo); cylP(anemo, 0.04, 0.04, 0.16, 8, mats.trim, 0, 0.05, 0);
  for (k = 0; k < 3; k++) { var ca = k * TAU / 3; strutIn(anemo, [0, 0.1, 0], [Math.cos(ca) * 0.32, 0.1, Math.sin(ca) * 0.32], 0.014, mats.trim); add(anemo, new THREE.SphereGeometry(0.075, 8, 6, 0, TAU, 0, P), mats.panel, Math.cos(ca) * 0.32, 0.1, Math.sin(ca) * 0.32).scale.set(1, 0.8, 1); }
  var vane = new THREE.Group(); vane.position.set(WSX, y0 + 3.0, WSZ); vane.rotation.y = 0.6; group.add(vane); strutIn(vane, [-0.4, 0, 0], [0.4, 0, 0], 0.015, mats.trim); box(vane, 0.22, 0.2, 0.02, mats.panel, -0.4, 0.0, 0, 0.005); add(vane, new THREE.ConeGeometry(0.04, 0.14, 8).rotateZ(-P / 2), mats.red, 0.46, 0, 0);
  box(group, 0.28, 0.2, 0.2, mats.dark, WSX + 0.2, y0 + 2.6, WSZ, 0.03); add(group, new THREE.CylinderGeometry(0.05, 0.05, 0.04, 10).rotateX(P / 2), mats.winW, WSX + 0.2, y0 + 2.6, WSZ + 0.11);

  /* ---------- Detalles de planeta hostil: dunas, sensores, filtros, canalones, mantenimiento ---------- */
  [[-9.0, -8.6, 1.1, 0.26, 0.8], [9.0, -9.0, 1.0, 0.24, 0.7], [-9.2, 3.0, 0.9, 0.22, 1.2], [9.3, 4.5, 0.9, 0.2, 0.8], [0.6, -9.2, 1.6, 0.2, 0.4], [-9.0, 9.0, 1.0, 0.2, 0.6], [5.6, 6.2, 0.8, 0.16, 0.5], [-1.2, -5.5, 0.7, 0.14, 0.4]].forEach(function (d) {
    var dg2 = new THREE.SphereGeometry(1, 14, 6, 0, TAU, 0, P / 2); dg2.scale(d[2], d[3], d[4]); add(group, dg2, mats.sand, d[0], y0, d[1]).rotation.y = d[0] * 0.3;
  });
  [[-9.4, 0.0], [9.5, 0.0]].forEach(function (p) { box(group, 0.35, 0.14, WL, mats.sand, p[0], y0 + 0.17, WZc, 0.04); });
  [[-6.8, 6.4], [3.5, 4.6], [-6.0, -3.4], [0.0, -7.1], [6.2, 2.4]].forEach(function (p) { add(group, new THREE.CircleGeometry(0.5 + rnd() * 0.5, 14).rotateX(-P / 2), mats.sandD, p[0], y0 + 0.012, p[1]).scale.set(1.5, 1, 0.8); });
  [-1, 1].forEach(function (s) { [-WL / 2 + 0.3, WL / 2 - 0.3].forEach(function (zz) { strutIn(group, [s * 9.56, y0 + 2.12, zz], [s * 9.56, y0 + 0.3, zz], 0.04, mats.hull2); box(group, 0.3, 0.04, 0.3, mats.dark, s * 9.56, y0 + 0.08, zz, 0.005); }); box(group, 0.12, 0.1, WL, mats.hull2, s * 9.56, y0 + 2.1, WZc, 0.02); });
  [[-5.3, -5.0, 1], [5.3, -4.4, -1], [-5.3, 5.3, 1]].forEach(function (f) {
    box(group, 0.55, 0.9, 0.95, mats.hull2, f[0], y0 + 0.45, f[1], 0.04); box(group, 0.6, 0.06, 1.0, mats.dark, f[0], y0 + 0.92, f[1], 0.01);
    var lv = []; for (k = 0; k < 6; k++) lv.push({ x: f[0] + f[2] * 0.29, y: y0 + 0.2 + k * 0.1, z: f[1], sx: 0.02, sy: 0.05, sz: 0.8 }); group.add(boxField(UB, mats.dark, lv));
    add(group, new THREE.SphereGeometry(0.03, 6, 6), mats.green, f[0] + f[2] * 0.29, y0 + 0.8, f[1] + 0.38);
  });
  [[-3.3, 7.0], [-6.2, 7.0]].forEach(function (p) { box(group, 0.2, 0.3, 0.12, mats.red, p[0], y0 + 0.9, p[1], 0.02); cylP(group, 0.06, 0.06, 0.18, 8, mats.red, p[0], y0 + 0.5, p[1]); });
  [[-1.8, 9.2], [1.8, 9.2]].forEach(function (p) { add(group, new THREE.CylinderGeometry(0.03, 0.03, 0.06, 8).rotateX(P / 2), mats.winW, p[0], y0 + 2.2, p[1] + 0.16); });
  var gau = add(group, new THREE.CylinderGeometry(0.1, 0.1, 0.05, 14), mats.dark, -4.75, y0 + 0.82, 8.65); gau.rotation.x = P / 2; add(group, new THREE.CircleGeometry(0.08, 14), mats.panel, -4.75, y0 + 0.82, 8.68);
  box(group, 0.7, 0.35, 0.5, mats.wood, -7.6, y0 + 0.3, 8.9, 0.03); cylP(group, 0.14, 0.14, 0.06, 10, mats.trim, -7.3, y0 + 0.2, 8.9).rotation.z = P / 2;
  add(group, new THREE.TorusGeometry(0.28, 0.05, 6, 16), mats.green, -7.9, y0 + 0.75, 6.8).rotation.y = P / 2; cylP(group, 0.08, 0.08, 0.3, 8, mats.trim, -7.9, y0 + 0.75, 6.8).rotation.z = P / 2;
  [-1.2, -0.2, 0.8].forEach(function (zz) { var fg3 = new THREE.Group(); fg3.position.set(wingX[0], y0 + 2.2, zz * 3); group.add(fg3); cylP(fg3, 0.28, 0.28, 0.12, 14, mats.hull2, 0, 0.0, 0); for (k = 0; k < 4; k++) { var b3 = box(fg3, 0.34, 0.012, 0.09, mats.trim, 0, -0.07, 0, 0.003); b3.position.set(Math.cos(k * P / 2) * 0.17, -0.07, Math.sin(k * P / 2) * 0.17); b3.rotation.y = -k * P / 2; } strutIn(group, [wingX[0], y0 + 2.26, zz * 3], [wingX[0], y0 + 2.75, zz * 3], 0.02, mats.trim); hanFans.push(fg3); });
  var hb = []; for (k = 0; k < 6; k++) hb.push({ x: wingX[0] + (k % 2 ? 0.3 : -0.3), y: y0 + 0.5 + Math.floor(k / 2) * 0.28, z: WL / 2 - 0.55, sx: 0.5, sy: 0.26, sz: 0.4 }); group.add(boxField(UB, mats.wood, hb));
  for (k = 0; k < 3; k++) add(group, new THREE.SphereGeometry(0.12, 8, 6), mats.berryR, wingX[0] + (k % 2 ? 0.3 : -0.3), y0 + 1.15, WL / 2 - 0.55);
  function haz0(parent, n, p0, p1, size) { var ma = new THREE.InstancedMesh(UB, mats.hazY, Math.ceil(n / 2)), mb = new THREE.InstancedMesh(UB, mats.hazK, Math.max(1, Math.floor(n / 2))), d = new THREE.Object3D(), ia = 0, ib = 0, t; for (var ii = 0; ii < n; ii++) { t = (ii + 0.5) / n; d.position.set(p0[0] + (p1[0] - p0[0]) * t, p0[1] + (p1[1] - p0[1]) * t, p0[2] + (p1[2] - p0[2]) * t); d.rotation.set(0, 0, 0); d.scale.set(size[0], size[1], size[2]); d.updateMatrix(); if (ii % 2) mb.setMatrixAt(ib++, d.matrix); else ma.setMatrixAt(ia++, d.matrix); } ma.count = ia; mb.count = ib; ma.frustumCulled = false; mb.frustumCulled = false; parent.add(ma); parent.add(mb); }

  /* ---------- Cascada, rocío, vapor y animación ---------- */
  var drops = [], ripples = [], mistA = [], steam = [];
  for (i = 0; i < 10; i++) { var dp2 = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 5), mats.fall.clone()); dp2.frustumCulled = false; group.add(dp2); drops.push({ m: dp2, ph: i / 10, a: i * 1.9 }); }
  for (i = 0; i < 3; i++) { var rm = glowMat(0xdff4ff, 0.3), rp2 = new THREE.Mesh(new THREE.TorusGeometry(1, 0.025, 6, 32).rotateX(P / 2), rm); rp2.position.set(0.05, y0 + 1.62, DCZ + 0.15); rp2.frustumCulled = false; group.add(rp2); ripples.push({ m: rp2, mat: rm, ph: i / 3 }); }
  for (i = 0; i < 9; i++) { var mp = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), mats.mist.clone()); mp.frustumCulled = false; group.add(mp); mistA.push({ m: mp, z: nozz[i], ph: rnd() }); }
  for (i = 0; i < 4; i++) { var sm = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 6), mats.smoke.clone()); sm.frustumCulled = false; group.add(sm); steam.push({ m: sm, ph: i / 4 }); }
  var entrance = new THREE.Object3D(); group.add(entrance); entrance.position.set(0, SLAB + 0.2, 9.9);

  /* ---------- Estados y API ---------- */
  var mode = 'working', grow = 0.7, lastT = null, demoT = 0, ghost = false, origEm = {}, ventO = 0, irrig = false, liftT = 0;
  var OWNT = { glassG: 0.24, glassF: 0.2, water: 0.85 };
  var api = {
    group: group,
    footprint: { w: SZ, d: SZ },
    entrance: entrance,
    input: new THREE.Object3D(),     // agua y energía (borde -X)
    output: new THREE.Object3D(),    // cosecha procesada (borde +X)
    nivel: 2,
    demo: true,
    getState: function () { return mode; },
    getGrowth: function () { return grow; },
    setGrowth: function (f) { grow = clamp(f, 0, 1); },
    setState: function (s) { api.demo = false; mode = s; },
    setAccent: setAccent,
    setGhost: function (on, valid) {
      ghost = !!on; domeFrame.visible = true;
      for (var key in mats) {
        var m = mats[key];
        if (m === mats.smoke || m === mats.mist || m === mats.lineR || m === mats.fall) continue;
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
      var vt = mode === 'working' ? 0.35 + 0.3 * Math.sin(t * 0.25) : mode === 'broken' ? 0.3 + 0.2 * Math.sin(t * 6) : 0;
      ventO += (vt - ventO) * Math.min(1, dt * 2);
      for (i = 0; i < flaps.length; i++) flaps[i].g.rotation.z = ventO * (0.5 + 0.1 * flaps[i].i);
      for (i = 0; i < fanGroups.length; i++) { var fgq = fanGroups[i]; if (fgq.y) fgq.rotation.y += alive ? dt * 9 : 0; else fgq.rotation.z += alive ? dt * (mode === 'alert' ? 14 : 8) : 0; }
      for (i = 0; i < hanFans.length; i++) hanFans[i].rotation.y += alive ? dt * 10 : 0;
      anemo.rotation.y += alive ? dt * (3 + Math.sin(t * 0.4) * 1.5) : 0; vane.rotation.y = 0.6 + Math.sin(t * 0.2) * 0.5;
      for (i = 0; i < sweeps.length; i++) sweeps[i].rotation.y += alive ? dt * 0.5 : 0;
      growMesh.visible = on && (mode !== 'broken' || Math.sin(t * 11) > -0.3); vGrowM.visible = growMesh.visible;
      mats.growL.color.setHex(mode === 'alert' ? 0xff7a3a : 0xff4fd8);
      mats.eC.color.setHex(on ? (mode === 'alert' ? 0xff5a4a : 0x6dff9a) : 0x1f4a2c);
      edgeM.visible = on; pwMesh.visible = on && (mode !== 'broken' || Math.sin(t * 9) > -0.4);
      liftT += alive ? dt * 0.25 : 0; var lp = 0.5 - 0.5 * Math.cos(liftT * TAU * 0.5); cab.position.y = vy + 0.4 + lp * (VFL * VFH - 0.8);
      var nb = on ? Math.ceil((0.6 + 0.4 * Math.sin(t * 0.1)) * 5 - 0.001) : 0; for (i = 0; i < 5; i++) sigOn[i].visible = mode === 'broken' ? (i < 2 && Math.sin(t * 7 + i) > 0) : i < nb;
      var col = mode === 'working' ? 0x35ff7a : mode === 'alert' ? 0xff3b30 : mode === 'broken' ? 0xffa31a : 0x303030;
      if (mode === 'alert' || mode === 'broken') mats.status.color.setHex(Math.sin(t * 6) > 0 ? col : 0x301010); else mats.status.color.setHex(col);
      for (i = 0; i < drops.length; i++) { var dr = drops[i], ph3 = (t * 0.7 + dr.ph) % 1; dr.m.visible = alive; if (alive) dr.m.position.set(0.05 + Math.cos(dr.a) * 0.18, y0 + 3.2 - ph3 * 1.6, DCZ + 0.15 + Math.sin(dr.a) * 0.18); }
      for (i = 0; i < ripples.length; i++) { var rr = ripples[i], ph4 = (t * 0.35 + rr.ph) % 1; rr.m.visible = alive; if (alive) { var sc = 0.3 + ph4 * 1.4; rr.m.scale.set(sc, sc, sc); rr.mat.opacity = (1 - ph4) * 0.35; } }
      irrig = alive && (t % 16) < 5.5 && mode === 'working';
      for (i = 0; i < mistA.length; i++) { var mm = mistA[i], ph = (t * 0.9 + mm.ph) % 1; mm.m.visible = irrig; if (irrig) { mm.m.position.set(wingX[0] + Math.sin(t * 3 + i) * 0.1, y0 + 2.65 - ph * 1.8, mm.z); mm.m.scale.setScalar(0.5 + ph * 2.2); mm.m.material.opacity = (1 - ph) * 0.3; } }
      for (i = 0; i < steam.length; i++) { var st = steam[i], ph2 = (t * 0.3 + st.ph) % 1; st.m.visible = alive; if (alive) { st.m.position.set(PX - 1.8 + ph2 * 0.3 + i * 0.1, y0 + PH + 0.9 + ph2 * 1.6, PZ); st.m.scale.setScalar(0.5 + ph2 * 2); st.m.material.opacity = (1 - ph2) * 0.35; } }
      // cinta: las cajas avanzan de la planta hacia el muelle
      for (i = 0; i < 6; i++) { var cp = ((t * 0.35 + i / 6) % 1), cx = BX0 + cp * (BX1 - BX0 - 0.3); var cv = alive || !on ? 1 : 0; setM(crateM, i, cx, y0 + 0.86, BZ2, 0.36, 0.2, 0.34); setM(crateT, i, cx, y0 + 1.0, BZ2, 0.12, 0.06, 0.12); }
      crateM.instanceMatrix.needsUpdate = true; crateT.instanceMatrix.needsUpdate = true;
    }
  };
  api.input.position.set(-10.0, SLAB + 0.5, -7.0); group.add(api.input);
  api.output.position.set(10.0, SLAB + 0.5, -6.1); group.add(api.output);
  var growMesh = boxField(UB, mats.growL, growS); group.add(growMesh);
  api.update(0);
  return api;
}
