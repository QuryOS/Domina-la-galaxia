/**
 * Complejo de aterrizaje CIRCULAR y torre de control (NIVEL 2) para Three.js, sin archivos externos. Naves pequeñas y medianas.
 *
 * Losa circular de 340 m con la plataforma de aterrizaje vertical en el centro (mesa giratoria, anillos de luces, marcas) y,
 * alrededor, un anillo de rodaje con luces azules. En un arco de 40° por sector: 4 HANGARES en curva (arco, puerta enrollable,
 * rótulo y lámparas), 2 ZONAS DE REPARACIÓN AL AIRE LIBRE (sin paredes ni techo: pórticos, grúa puente, 4 brazos robóticos por
 * zona, chispas y una barra de progreso vertical, para ver cómo se repara la nave), la TORRE DE CONTROL (cabina octogonal,
 * radar y baliza), la terminal, el depósito de combustible, contenedores y paneles solares. Mástiles de focos entre sectores,
 * manga de viento y polvo al aterrizar. Sin vallas, sin helicópteros y sin molinos (planeta de tormentas).
 *
 * Uso:
 *   const pista = createPistaCircular2(THREE, { accent: 0xf08a1e });
 *   pista.group.position.set(x, groundY, z);      // la base de la losa está en y = 0
 *   scene.add(pista.group);
 *   pista.update(clock.getElapsedTime());
 *
 * Escala: 1 unidad = 4 m. Losa circular de radio pista.radius (42 unidades); pista.footprint = {w, d} = 85 x 85, centrada en el
 * origen. pista.pad = { x, z, r }: centro y radio de la plataforma. pista.landing = centro de la plataforma.
 * pista.entrance = puerta de la terminal. pista.input / pista.output = energía. pista.nivel = 2. Naves máximas: pista.maxShip.
 *
 * API de servicio idéntica a la de la pista cuadrada (conectar_pista.js sirve igual): service(nave, {...}), launch(nave, {...}),
 * free(nave), land(nave, {...}); estados queued, aligning, approach, towing, repairing, repaired, stored, ready, takeoff, departed.
 *   - La mesa giratoria centra la nave y la gira con la proa hacia la plaza elegida; el remolcador la lleva en línea recta
 *     (nariz primero) a la zona de reparación abierta (pista.repairSeconds = 1800 s, job.progress 0..1), después la guarda en un
 *     hangar. launch() la saca del hangar o de la zona de reparación (cancela la reparación) y la deja en el centro.
 *   - Carrito con el piloto hacia la terminal, carrito escolta y remolcador: todo animado por la pista.
 *   La nave es un Object3D con la nariz hacia -Z y, opcionalmente, userData.length / width / baseY en unidades de tu escena.
 *
 * NIVEL 2 (escala 1.5): torre un 35% más alta con mástil reticulado, radomo y platos; DOS ANILLOS de luces en secuencia (uno protege la
 * plataforma y otro rodea la plaza de rodaje); 6 CAÑONES ANTIAÉREOS en el borde que siguen a las naves; ESCUDO DE ENERGÍA (cúpula
 * azul) que se enciende con setState('alert'). Dimensiones: pista.footprint ya incluye la escala.
 *
 * Estados (pista.setState): 'working', 'alert', 'broken', 'off'. Por defecto corre una demostración (pista.demo = true).
 * pista.setGhost(true, valid) para colocar; pista.setAccent(hex). Compatible con Three.js r128 o superior.
 */
function createPistaCircular2(THREE, opts) {
  opts = opts || {};
  var P = Math.PI, TAU = P * 2;
  var colors = {
    hull: opts.hull != null ? opts.hull : 0xd3d7dd,
    accent: opts.accent != null ? opts.accent : 0xd9a21b,
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

  var S = 1.5, outer = group; group = new THREE.Group(); group.scale.setScalar(S); outer.add(group);
  /* ---------- Constantes, materiales y utilidades ---------- */
  var SLAB = 0.3, RB = 42, SX = RB * 2 + 1, SZ = RB * 2 + 1, y0 = SLAB, PADR = 9.6, PADZ = 0, RDOOR = 20, RING = 14.5, D2R = Math.PI / 180, k, j, i, q;
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
  mats.conc = std(0xb7bbc2, 0.15, 0.78); mats.concD = std(0x8d9199, 0.2, 0.8);
  mats.panel = std(0xe9edf2, 0.25, 0.55);
  mats.strip = std(0x101a28, 0.9, 0.15, { emissive: 0x0a2236, emissiveIntensity: 0.55 });
  mats.asph = std(0x2b2e35, 0.1, 0.92); mats.apron = std(0x9a9ea5, 0.1, 0.85); mats.apronD = std(0x777b82, 0.1, 0.88);
  mats.mkY = bas(0xf2c21e); mats.mkW = bas(0xe9ecef);
  mats.lW = bas(0xfff2cf); mats.lG = bas(0x35ff7a); mats.lR = bas(0xff3b30); mats.lB = bas(0x3a7bff); mats.lA = bas(0xffb020);
  mats.hw = std(0xd3d9df, 0.45, 0.5); mats.hwD = std(0x8a929c, 0.5, 0.5); mats.floorH = std(0x565b64, 0.3, 0.75);
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

  /* ---------- Losa circular, plataforma, anillo de rodaje y marcas ---------- */
  add(group, new THREE.CylinderGeometry(RB, RB + 0.8, SLAB, 96), mats.slab, 0, SLAB / 2, 0);
  add(group, new THREE.CylinderGeometry(21.6, 21.6, 0.06, 96), mats.apron, 0, y0 + 0.03, 0);
  add(group, new THREE.RingGeometry(RING - 1.9, RING + 1.9, 96).rotateX(-P / 2), mats.asph, 0, y0 + 0.07, 0);
  var joints = [], my = [], mw = [], pa, BAYA = [-90, -50, -10, 30, 70, 110];
  for (k = 0; k < 48; k++) { pa = k * TAU / 48 + TAU / 96; var jp = pol(15.9, pa); joints.push({ x: jp[0], y: y0 + 0.065, z: jp[1], ry: -pa, sx: 11.4, sy: 0.01, sz: 0.05 }); }
  group.add(boxField(UB, mats.apronD, joints));
  // marcas amarillas: anillo de rodaje, líneas radiales de entrada a cada plaza y líneas de parada
  add(group, new THREE.RingGeometry(RING - 0.07, RING + 0.07, 96).rotateX(-P / 2), mats.mkY, 0, y0 + 0.086, 0);
  BAYA.forEach(function (d) { var a = d * D2R, c = pol((RING + 2.0 + RDOOR) / 2, a), h = pol(RDOOR - 0.5, a); my.push({ x: c[0], y: y0 + 0.08, z: c[1], ry: -a, sx: RDOOR - RING - 2.0, sy: 0.01, sz: 0.14 }); mw.push({ x: h[0], y: y0 + 0.08, z: h[1], ry: -a, sx: 0.12, sy: 0.01, sz: 8 }); });
  // plataforma circular de aterrizaje vertical con mesa giratoria, anillos de luces y marcas
  var mw2 = [], my2 = [];
  add(group, new THREE.CylinderGeometry(PADR + 0.55, PADR + 0.55, 0.07, 64), mats.concD, 0, y0 + 0.035, 0);
  add(group, new THREE.CylinderGeometry(PADR, PADR, 0.08, 64), mats.asph, 0, y0 + 0.04, 0);
  add(group, new THREE.RingGeometry(PADR - 0.72, PADR - 0.45, 64).rotateX(-P / 2), mats.mkY, 0, y0 + 0.086, 0);
  add(group, new THREE.RingGeometry(PADR - 1.55, PADR - 1.45, 64).rotateX(-P / 2), mats.mkW, 0, y0 + 0.086, 0);
  for (k = 0; k < 48; k++) { pa = k * TAU / 48; (k % 2 ? my2 : mw2).push({ x: Math.cos(pa) * (PADR - 0.12), y: y0 + 0.087, z: Math.sin(pa) * (PADR - 0.12), ry: -pa, sx: 0.26, sy: 0.01, sz: 1.0 }); }
  group.add(boxField(UB, mats.mkY, my2)); group.add(boxField(UB, mats.hazK, mw2));
  var ttable = new THREE.Group(); ttable.position.set(0, y0 + 0.09, 0); group.add(ttable);
  add(ttable, new THREE.CylinderGeometry(6.8, 6.8, 0.05, 48), mats.hwD, 0, 0, 0);
  add(ttable, new THREE.RingGeometry(6.5, 6.8, 48).rotateX(-P / 2), mats.accent, 0, 0.03, 0);
  var tw8 = []; for (k = 0; k < 8; k++) tw8.push({ x: 0, y: 0.03, z: 0, ry: k * TAU / 16, sx: 13.0, sy: 0.02, sz: 0.07 });
  ttable.add(boxField(UB, mats.trim, tw8));
  box(ttable, 0.16, 0.03, 13.0, mats.mkY, 0, 0.035, 0, 0.005); box(ttable, 13.0, 0.03, 0.16, mats.mkY, 0, 0.035, 0, 0.005);
  add(ttable, new THREE.RingGeometry(1.5, 1.72, 40).rotateX(-P / 2), mats.mkW, 0, 0.06, 0); cylP(ttable, 0.5, 0.5, 0.05, 16, mats.accent, 0, 0.05, 0);
  [-4.95, -3.9].forEach(function (zz) { box(ttable, 1.8, 0.03, 0.28, mats.mkW, -0.62, 0.04, zz, 0.005).rotation.y = P / 4; box(ttable, 1.8, 0.03, 0.28, mats.mkW, 0.62, 0.04, zz, 0.005).rotation.y = -P / 4; });
  group.add(boxField(UB, mats.mkY, my)); group.add(boxField(UB, mats.mkW, mw));
  var lw = [], lb = [], lgg = [], lrr = [];
  for (k = 0; k < 36; k++) { pa = k * TAU / 36; lw.push({ x: Math.cos(pa) * (PADR + 0.32), y: y0 + 0.1, z: Math.sin(pa) * (PADR + 0.32), sx: 0.22, sy: 0.12, sz: 0.22 }); }
  for (k = 0; k < 24; k++) { pa = k * TAU / 24; lgg.push({ x: Math.cos(pa) * 6.98, y: y0 + 0.125, z: Math.sin(pa) * 6.98, sx: 0.2, sy: 0.08, sz: 0.2 }); }
  for (k = 0; k < 72; k++) { pa = k * TAU / 72; [RING - 1.75, RING + 1.75].forEach(function (rr) { lb.push({ x: Math.cos(pa) * rr, y: y0 + 0.1, z: Math.sin(pa) * rr, sx: 0.18, sy: 0.1, sz: 0.18 }); }); }
  for (k = 0; k < 4; k++) { pa = k * P / 2; lrr.push({ x: Math.cos(pa) * (PADR + 0.7), y: y0 + 0.1, z: Math.sin(pa) * (PADR + 0.7), sx: 0.26, sy: 0.14, sz: 0.26 }); }
  var lwM = boxField(UB, mats.lW, lw), lbM = boxField(UB, mats.lB, lb), lgM = boxField(UB, mats.lG, lgg), lrM = boxField(UB, mats.lR, lrr);
  [lwM, lbM, lgM, lrM].forEach(function (m) { group.add(m); });
  var strobes = [];
  for (k = 0; k < 36; k++) { pa = k * TAU / 36; strobes.push(add(group, new THREE.SphereGeometry(0.16, 8, 6), mats.lA, Math.cos(pa) * (PADR - 1.0), y0 + 0.2, Math.sin(pa) * (PADR - 1.0))); }
  // borde de la losa con franjas de peligro, arena acumulada y manchas
  var eg = [], ek = []; for (k = 0; k < 96; k++) { pa = k * TAU / 96; (k % 2 ? eg : ek).push({ x: Math.cos(pa) * (RB - 0.3), y: y0 + 0.02, z: Math.sin(pa) * (RB - 0.3), ry: -pa, sx: 0.5, sy: 0.03, sz: 2.5 }); }
  group.add(boxField(UB, mats.hazY, eg)); group.add(boxField(UB, mats.hazK, ek));
  [[-8, 12, 2.6, 1.0], [10, 15.5, 2.2, 0.7], [-16, -3, 3.0, 1.1], [17, -2, 2.4, 0.9], [4, -17, 2.0, 0.8]].forEach(function (p) { add(group, new THREE.CircleGeometry(p[2], 18).rotateX(-P / 2), mats.sandD, p[0], y0 + 0.095, p[1]).scale.set(1.6, 1, p[3]); });
  // mástiles de focos en cada hueco entre plazas
  var flood = [], GAPA = [-70, -30, 10, 50, 90, 130, 170, 210, 250];
  GAPA.forEach(function (d) { flood.push(d * D2R); });
  flood.forEach(function (a) {
    var p = pol(18.6, a), fx = -Math.cos(a), fz = -Math.sin(a), fy = Math.atan2(fx, fz);
    cylP(group, 0.14, 0.24, 11, 8, mats.hull2, p[0], y0 + 5.5, p[1]); cylP(group, 0.5, 0.6, 0.35, 8, mats.concD, p[0], y0 + 0.17, p[1]);
    box(group, 1.8, 0.2, 0.5, mats.trim, p[0], y0 + 11.1, p[1], 0.02).rotation.y = fy;
    var fl = []; for (k = 0; k < 6; k++) fl.push({ x: p[0] + fx * 0.28 + Math.cos(fy) * (-0.7 + (k % 3) * 0.7), y: y0 + 11.0 + Math.floor(k / 3) * 0.3 - 0.1, z: p[1] + fz * 0.28 - Math.sin(fy) * (-0.7 + (k % 3) * 0.7), ry: fy, sx: 0.55, sy: 0.22, sz: 0.04 });
    group.add(boxField(UB, mats.lW, fl));
    strutIn(group, [p[0], y0 + 0.5, p[1] + 0.2], [p[0], y0 + 9, p[1] + 0.2], 0.02, mats.trim); box(group, 0.3, 0.3, 0.2, mats.panel, p[0] + 0.5, y0 + 0.9, p[1], 0.02);
  });
  var floodMesh = null;

  /* ---------- Puertas, plazas (hangares y taller) ---------- */
  var bays = [], HDEP = 19, cranes = [], arms = [], sparks = [], progLit = [[], []], progDim = [[], []];
  function bayFrame(phi) {                              // marco polar de una plaza: u = hacia fuera, puerta a RDOOR del centro
    var u = [Math.cos(phi), Math.sin(phi)], rc = RDOOR + HDEP / 2;
    return { phi: phi, u: u, psi: psiOf(phi), c: [u[0] * rc, u[1] * rc], Dp: [u[0] * RDOOR, u[1] * RDOOR], S: [u[0] * (RDOOR + HDEP / 2 - 1.0), u[1] * (RDOOR + HDEP / 2 - 1.0)] };
  }
  function makeDoor(parent, x, z, w, h, topY, mat, slats) {
    var dg = new THREE.Group(); dg.position.set(x, topY - h, z); parent.add(dg);
    box(dg, w, h, 0.18, mat, 0, h / 2, 0, 0.02);
    for (var s2 = 1; s2 < slats; s2++) box(dg, w - 0.1, 0.04, 0.22, mats.trim, 0, h * s2 / slats, 0, 0.005);
    box(dg, w, 0.22, 0.24, mats.hazY, 0, 0.11, 0, 0.01); for (var s3 = 0; s3 < Math.floor(w / 0.6); s3++) box(dg, 0.3, 0.22, 0.25, mats.hazK, -w / 2 + 0.3 + s3 * 0.6, 0.11, 0, 0.005);
    add(dg, new THREE.BoxGeometry(w * 0.7, 0.35, 0.22), mats.strip, 0, h * 0.82, 0);
    return { g: dg, H: h, top: topY, o: 0, t: 0 };
  }
  var HW = 12, WHh = 4.2, ARC = 0.45, HR = HW / 2;
  function buildHangar(phi, idx) {
    var fr = bayFrame(phi);
    var hg = new THREE.Group(); hg.position.set(fr.c[0], y0, fr.c[1]); hg.rotation.y = fr.psi; group.add(hg);
    box(hg, HW + 0.4, 0.2, HDEP + 0.4, mats.concD, 0, 0.1, 0, 0.03); box(hg, HW - 0.2, 0.06, HDEP - 0.2, mats.floorH, 0, 0.22, 0, 0.01);
    box(hg, 0.5, WHh, HDEP, mats.hw, -HW / 2 + 0.25, 0.2 + WHh / 2, 0, 0.03); box(hg, 0.5, WHh, HDEP, mats.hw, HW / 2 - 0.25, 0.2 + WHh / 2, 0, 0.03); box(hg, HW, WHh, 0.5, mats.hw, 0, 0.2 + WHh / 2, -HDEP / 2 + 0.25, 0.03);
    var rg = new THREE.CylinderGeometry(HR, HR, HDEP, 34, 1, true, P / 2, P); rg.rotateX(P / 2); rg.scale(1, ARC, 1); add(hg, rg, mats.hw, 0, 0.2 + WHh, 0);
    for (i = 0; i < 10; i++) { var rb = new THREE.Mesh(new THREE.TorusGeometry(HR + 0.02, 0.1, 6, 26, P), mats.hwD); rb.scale.y = ARC; rb.position.set(0, 0.2 + WHh, -HDEP / 2 + 0.5 + i * (HDEP - 1) / 9); hg.add(rb); }
    for (i = 1; i < 6; i++) { var an = P * i / 6; box(hg, 0.12, 0.1, HDEP, mats.hwD, Math.cos(an) * (HR + 0.1), 0.2 + WHh + Math.sin(an) * HR * ARC + 0.04, 0, 0.01).rotation.z = an - P / 2; }
    var lg = new THREE.CircleGeometry(HR, 34, 0, P); lg.scale(1, ARC, 1); add(hg, lg, mats.hw, 0, 0.2 + WHh, HDEP / 2);
    var lr = new THREE.Mesh(new THREE.TorusGeometry(HR, 0.14, 6, 30, P), mats.accent); lr.scale.y = ARC; lr.position.set(0, 0.2 + WHh, HDEP / 2 + 0.02); hg.add(lr);
    box(hg, 0.8, WHh, 0.6, mats.hwD, -HW / 2 + 0.4, 0.2 + WHh / 2, HDEP / 2 - 0.05, 0.03); box(hg, 0.8, WHh, 0.6, mats.hwD, HW / 2 - 0.4, 0.2 + WHh / 2, HDEP / 2 - 0.05, 0.03);
    box(hg, HW, 0.5, 0.6, mats.hwD, 0, 0.2 + WHh - 0.05, HDEP / 2 - 0.05, 0.03);
    var door = makeDoor(hg, 0, HDEP / 2 + 0.05, HW - 1.6, WHh - 0.45, 0.2 + WHh - 0.3, mats.hw, 8);
    // rótulo con número de hangar, lámparas de estado y focos sobre la puerta
    box(hg, 1.6, 0.5, 0.1, mats.dark, 0, 0.2 + WHh + 0.7, HDEP / 2 + 0.08, 0.02); for (k = 0; k <= idx; k++) box(hg, 0.12, 0.3, 0.04, mats.lA, -0.35 * idx / 1 * 0 + (-0.2 * idx) + k * 0.4, 0.2 + WHh + 0.7, HDEP / 2 + 0.14, 0.005);
    var lampR = add(hg, new THREE.SphereGeometry(0.14, 10, 8), mats.lR, -1.1, 0.2 + WHh + 0.7, HDEP / 2 + 0.15), lampG = add(hg, new THREE.SphereGeometry(0.14, 10, 8), mats.lG, 1.1, 0.2 + WHh + 0.7, HDEP / 2 + 0.15);
    [-3.6, 3.6].forEach(function (fx) { box(hg, 0.7, 0.25, 0.3, mats.dark, fx, 0.2 + WHh + 0.4, HDEP / 2 + 0.3, 0.02); add(hg, new THREE.BoxGeometry(0.55, 0.04, 0.2), mats.lW, fx, 0.2 + WHh + 0.27, HDEP / 2 + 0.32); });
    // costillas del muro, canalones y bajantes, respiraderos del cumbrero
    var wr = []; for (i = 0; i < 10; i++) { wr.push({ x: -HW / 2 - 0.02, y: 0.2 + WHh / 2, z: -HDEP / 2 + 1 + i * 1.9, sx: 0.06, sy: WHh - 0.2, sz: 0.2 }); wr.push({ x: HW / 2 + 0.02, y: 0.2 + WHh / 2, z: -HDEP / 2 + 1 + i * 1.9, sx: 0.06, sy: WHh - 0.2, sz: 0.2 }); }
    hg.add(boxField(UB, mats.hwD, wr));
    [-1, 1].forEach(function (s) { box(hg, 0.18, 0.14, HDEP, mats.hull2, s * (HW / 2 + 0.1), 0.2 + WHh + 0.05, 0, 0.02); strutIn(hg, [s * (HW / 2 + 0.12), 0.2 + WHh, -HDEP / 2 + 0.6], [s * (HW / 2 + 0.12), 0.35, -HDEP / 2 + 0.6], 0.05, mats.hull2); });
    for (i = 0; i < 5; i++) { cylP(hg, 0.22, 0.22, 0.4, 10, mats.hull2, 0, 0.2 + WHh + HR * ARC + 0.1, -HDEP / 2 + 2 + i * 3.8); cylP(hg, 0.34, 0.34, 0.06, 10, mats.trim, 0, 0.2 + WHh + HR * ARC + 0.34, -HDEP / 2 + 2 + i * 3.8); }
    box(hg, 0.5, 0.18, HDEP, mats.hull2, 0, 0.2 + WHh + HR * ARC + 0.1, 0, 0.02);
    // interior: luces del techo, marcas del suelo, cuadros eléctricos y cajas de herramientas
    var il = []; [-3.2, 0, 3.2].forEach(function (lx) { var ly = 0.2 + WHh + ARC * Math.sqrt(HR * HR - lx * lx) - 0.15; for (i = 0; i < 6; i++) il.push({ x: lx, y: ly, z: -HDEP / 2 + 2 + i * 3, sx: 0.4, sy: 0.08, sz: 1.6 }); });
    hg.add(boxField(UB, mats.lW, il));
    box(hg, 8.4, 0.02, 0.15, mats.mkY, 0, 0.26, HDEP / 2 - 2.0, 0.005); box(hg, 0.15, 0.02, 15.0, mats.mkY, -4.2, 0.26, -0.8, 0.005); box(hg, 0.15, 0.02, 15.0, mats.mkY, 4.2, 0.26, -0.8, 0.005); box(hg, 8.4, 0.02, 0.15, mats.mkY, 0, 0.26, -HDEP / 2 + 1.0, 0.005);
    [-1, 1].forEach(function (s) { box(hg, 0.6, 1.1, 1.0, mats.cargoA, s * (HW / 2 - 0.9), 0.75, -HDEP / 2 + 2.0, 0.03); box(hg, 0.5, 1.4, 0.5, mats.panel, s * (HW / 2 - 0.9), 0.95, -HDEP / 2 + 4.0, 0.03); add(hg, new THREE.SphereGeometry(0.05, 6, 6), mats.lG, s * (HW / 2 - 1.15), 1.4, -HDEP / 2 + 4.0); });
    cylP(hg, 0.45, 0.45, 0.9, 12, mats.blue, HW / 2 - 1.0, 0.7, -HDEP / 2 + 6.0); cylP(hg, 0.45, 0.45, 0.9, 12, mats.cargoB, HW / 2 - 1.0, 0.7, -HDEP / 2 + 7.0);
    var slot = new THREE.Object3D(); slot.position.set(fr.S[0], y0, fr.S[1]); group.add(slot);
    var bay = { type: 'hangar', idx: idx, phi: phi, u: fr.u, psi: fr.psi, Dp: fr.Dp, S: fr.S, lane: -4.3, door: door, occ: null, slot: slot, lampR: lampR, lampG: lampG, repairing: false }; bays.push(bay); return bay;
  }

  [-90, -50, -10, 30].forEach(function (d, n) { buildHangar(d * D2R, n); });

  /* ---------- Zona de reparación AL AIRE LIBRE: pórticos, grúa puente, brazos robóticos y chispas a la vista ---------- */
  function buildRepairBay(phi, bi) {
    var fr = bayFrame(phi), rg = new THREE.Group(), cx2 = 5.5, kk;
    rg.position.set(fr.c[0], y0, fr.c[1]); rg.rotation.y = fr.psi; group.add(rg);
    box(rg, HW + 0.4, 0.2, HDEP + 0.4, mats.concD, 0, 0.1, 0, 0.03); box(rg, HW - 0.2, 0.06, HDEP - 0.2, mats.floorH, 0, 0.22, 0, 0.01);
    for (kk = 0; kk < 12; kk++) { box(rg, 0.5, 0.03, 0.4, kk % 2 ? mats.hazK : mats.hazY, -HW / 2 + 0.55 + kk * 0.9, 0.26, HDEP / 2 - 0.5, 0.005); box(rg, 0.5, 0.03, 0.4, kk % 2 ? mats.hazK : mats.hazY, -HW / 2 + 0.55 + kk * 0.9, 0.26, -HDEP / 2 + 0.5, 0.005); }
    box(rg, 8.6, 0.02, 0.15, mats.mkY, 0, 0.26, HDEP / 2 - 1.8, 0.005); box(rg, 0.15, 0.02, 14, mats.mkY, -4.3, 0.26, -1.0, 0.005); box(rg, 0.15, 0.02, 14, mats.mkY, 4.3, 0.26, -1.0, 0.005); box(rg, 8.4, 0.02, 0.15, mats.mkY, 0, 0.26, -HDEP / 2 + 1.0, 0.005); box(rg, 3.0, 0.03, 3.0, mats.dark, 0, 0.25, 1.0, 0.01);
    add(rg, new THREE.RingGeometry(1.1, 1.3, 32).rotateX(-P / 2), mats.accent, 0, 0.28, 1.0);
    // pórticos laterales (sin paredes ni techo) con rieles y travesaños
    [-1, 1].forEach(function (s) {
      [-8.3, -2.7, 2.9, 8.3].forEach(function (cz) { box(rg, 0.5, 6.0, 0.5, mats.hwD, s * cx2, 3.2, cz, 0.03); box(rg, 0.9, 0.2, 0.9, mats.concD, s * cx2, 0.3, cz, 0.02); box(rg, 0.2, 0.5, 0.2, mats.accent, s * cx2, 5.0, cz, 0.01); });
      box(rg, 0.4, 0.45, HDEP - 1.0, mats.hull2, s * cx2, 6.25, 0, 0.02); box(rg, 0.12, 0.1, HDEP - 1.0, mats.accent, s * cx2 - s * 0.26, 6.05, 0, 0.01);
      strutIn(rg, [s * cx2, 0.4, -8.3], [s * cx2, 5.9, -2.7], 0.04, mats.trim); strutIn(rg, [s * cx2, 0.4, 8.3], [s * cx2, 5.9, 2.9], 0.04, mats.trim); strutIn(rg, [s * cx2, 0.4, -2.7], [s * cx2, 5.9, 2.9], 0.04, mats.trim);
    });
    box(rg, 2 * cx2 + 0.4, 0.35, 0.4, mats.hwD, 0, 6.3, -HDEP / 2 + 1.2, 0.02); box(rg, 2 * cx2 + 0.4, 0.35, 0.4, mats.hwD, 0, 6.3, HDEP / 2 - 1.2, 0.02);
    var tl = []; for (kk = 0; kk < 5; kk++) [-4.4, 4.4].forEach(function (lx) { tl.push({ x: lx, y: 6.0, z: -HDEP / 2 + 2.2 + kk * 3.9, sx: 0.5, sy: 0.08, sz: 1.8 }); });
    rg.add(boxField(UB, mats.lW, tl));
    // grúa puente con carro y gancho
    var bg2 = new THREE.Group(); bg2.position.set(0, 6.0, -0.5); rg.add(bg2);
    box(bg2, 10.6, 0.4, 0.6, mats.cargoD, 0, 0.0, 0, 0.03); box(bg2, 10.6, 0.1, 0.7, mats.hazK, 0, 0.22, 0, 0.01);
    var tr = new THREE.Group(); tr.position.set(0, -0.35, 0); bg2.add(tr); box(tr, 1.0, 0.5, 0.9, mats.cargoD, 0, 0, 0, 0.04); add(tr, new THREE.SphereGeometry(0.06, 6, 6), mats.lA, 0, 0.3, 0.46);
    var cable = new THREE.Mesh(_cg[0.025] || (_cg[0.025] = new THREE.CylinderGeometry(0.025, 0.025, 1, 8)), mats.trim); tr.add(cable); var hook = box(tr, 0.3, 0.3, 0.3, mats.hazY, 0, -2.4, 0, 0.04);
    // slot, registro de la plaza y barra de progreso vertical sobre un pilón
    var slot2 = new THREE.Object3D(); slot2.position.set(fr.S[0], y0, fr.S[1]); group.add(slot2);
    var dummyDoor = { g: new THREE.Group(), H: 1, top: 0, o: 0, t: 0 };
    var bay = { type: 'repair', idx: bi, bi: bi, phi: phi, u: fr.u, psi: fr.psi, Dp: fr.Dp, S: fr.S, lane: 7.6, door: dummyDoor, occ: null, slot: slot2, repairing: false, open: true };
    cranes.push({ bridge: bg2, trolley: tr, cable: cable, hook: hook, bay: bay, bi: bi });
    var px = 6.9, pz = HDEP / 2 - 0.6;
    box(rg, 0.7, 6.4, 0.45, mats.dark, px, 3.4, pz, 0.03); box(rg, 0.9, 0.3, 0.6, mats.accent, px, 6.7, pz, 0.02); box(rg, 1.2, 0.3, 0.9, mats.concD, px, 0.35, pz, 0.02);
    for (kk = 0; kk < 10; kk++) { progDim[bi].push(box(rg, 0.5, 0.36, 0.06, mats.dim, px, 1.2 + kk * 0.5, pz + 0.25, 0.01)); progLit[bi].push(box(rg, 0.5, 0.36, 0.08, kk < 7 ? mats.lG : mats.lA, px, 1.2 + kk * 0.5, pz + 0.27, 0.01)); }
    var bgr = new THREE.Group(); bgr.position.set(px, 7.0, pz); rg.add(bgr); cylP(bgr, 0.25, 0.3, 0.2, 10, mats.trim, 0, 0, 0); add(bgr, new THREE.SphereGeometry(0.22, 10, 8, 0, TAU, 0, P / 2), mats.lA, 0, 0.1, 0); bay.beacon = bgr;
    // brazos robóticos de soldadura / reparación a ambos lados de la nave
    [[-3.9, -3.0, 1], [3.9, -3.0, -1], [-3.9, 2.0, 1], [3.9, 2.0, -1]].forEach(function (ap, an) {
      var ag = new THREE.Group(); ag.position.set(ap[0], 0.25, ap[1]); rg.add(ag);
      cylP(ag, 0.5, 0.6, 0.35, 14, mats.hull2, 0, 0.17, 0); cylP(ag, 0.38, 0.38, 0.12, 14, mats.accent, 0, 0.4, 0);
      var yaw = new THREE.Group(); yaw.position.set(0, 0.5, 0); ag.add(yaw); if (ap[2] < 0) yaw.rotation.y = P;
      cylP(yaw, 0.25, 0.25, 0.7, 10, mats.panel, 0, 0.3, 0);
      var sh = new THREE.Group(); sh.position.set(0, 0.65, 0); yaw.add(sh); add(sh, new THREE.SphereGeometry(0.26, 10, 8), mats.trim, 0, 0, 0);
      box(sh, 0.34, 2.0, 0.34, mats.cartY, 0, 1.0, 0, 0.05);
      var el = new THREE.Group(); el.position.set(0, 2.0, 0); sh.add(el); add(el, new THREE.SphereGeometry(0.22, 10, 8), mats.trim, 0, 0, 0);
      box(el, 0.28, 1.7, 0.28, mats.panel, 0, 0.85, 0, 0.04); var tip = add(el, new THREE.SphereGeometry(0.14, 8, 6), mats.weld, 0, 1.75, 0); box(el, 0.1, 0.35, 0.1, mats.dark, 0, 1.6, 0, 0.01);
      arms.push({ yaw: yaw, sh: sh, el: el, ph: an * 1.3 + bi, sgn: ap[2], bay: bay, tip: tip });
    });
    for (kk = 0; kk < 14; kk++) { var spk = add(rg, new THREE.SphereGeometry(0.06, 5, 4), mats.spark, 0, 2, 1); spk.visible = false; sparks.push({ m: spk, ph: kk * 0.7 + bi, bay: bay }); }
    // equipo a la vista: carros de herramientas, rollos de manguera, cajas de repuestos y focos
    box(rg, 1.0, 0.9, 0.6, mats.cartY, -6.9, 0.7, -5.5, 0.04); box(rg, 0.9, 0.12, 0.5, mats.dark, -6.9, 1.2, -5.5, 0.01); box(rg, 0.9, 0.7, 0.7, mats.cargoA, -6.9, 0.6, -3.6, 0.04); box(rg, 0.9, 0.5, 0.7, mats.cargoC, -6.9, 1.2, -3.6, 0.04);
    cylP(rg, 0.4, 0.4, 0.5, 12, mats.blue, -6.9, 0.55, -1.2).rotation.x = P / 2; for (kk = 0; kk < 3; kk++) cylP(rg, 0.3, 0.3, 0.7, 10, mats.cargoB, -7.0, 0.6, 1.0 + kk * 0.8);
    [-6.6, 6.6].forEach(function (fx) { box(rg, 0.7, 0.25, 0.3, mats.dark, fx, 6.7, -HDEP / 2 + 1.5, 0.02); add(rg, new THREE.BoxGeometry(0.55, 0.04, 0.2), mats.lW, fx, 6.55, -HDEP / 2 + 1.5); });
    bays.push(bay); return bay;
  }
  [70, 110].forEach(function (d, n) { buildRepairBay(d * D2R, n); });

  /* ---------- Torre de control (nivel pequeño: cabina octogonal, radar y baliza) ---------- */
  var TWA = 190 * D2R, TWP = pol(29.5, TWA), tw = new THREE.Group(); tw.position.set(TWP[0], y0, TWP[1]); tw.rotation.y = psiOf(TWA); group.add(tw);
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
  // manga de viento
  var WSKP = pol(33.5, -70 * D2R), WSKX = WSKP[0], WSKZ = WSKP[1];
  cylP(group, 0.35, 0.45, 0.3, 8, mats.concD, WSKX, y0 + 0.15, WSKZ); cylP(group, 0.07, 0.1, 6.0, 8, mats.hull2, WSKX, y0 + 3.2, WSKZ);
  var sockG = new THREE.Group(); sockG.position.set(WSKX, y0 + 6.0, WSKZ); group.add(sockG); add(sockG, new THREE.TorusGeometry(0.5, 0.035, 6, 14), mats.trim, 0.0, 0, 0).rotation.y = P / 2;
  var sockD = new THREE.Group(); sockG.add(sockD);
  for (k = 0; k < 5; k++) { var sg = new THREE.CylinderGeometry(0.5 - k * 0.06, 0.5 - (k + 1) * 0.06, 0.55, 10, 1, true); sg.rotateZ(P / 2); sg.translate(0.3 + k * 0.55, 0, 0); add(sockD, sg, k % 2 ? mats.sockW : mats.sockO, 0, 0, 0); }
  // terminal de pasajeros
  var TMA = 150 * D2R, TMP = pol(29.0, TMA), tm = new THREE.Group(); tm.position.set(TMP[0], y0, TMP[1]); tm.rotation.y = psiOf(TMA); group.add(tm);
  box(tm, 12.4, 0.2, 8.4, mats.concD, 0, 0.1, 0, 0.03); box(tm, 12, 3.6, 8, mats.panel, 0, 2.0, 0, 0.06); box(tm, 12.6, 0.3, 8.6, mats.conc, 0, 3.95, 0, 0.03); box(tm, 12.02, 0.2, 8.02, mats.accent, 0, 3.55, 0, 0.01);
  add(tm, new THREE.BoxGeometry(9.0, 1.3, 0.06), mats.strip, 0, 1.9, 0 + 4.03); var tml = []; for (k = 0; k < 14; k++) tml.push({ x: 0 - 4.2 + k * 0.65, y: 1.9, z: 0 + 4.07, sx: 0.5, sy: 0.9, sz: 0.02 });
  var tmMesh = boxField(UB, mats.window, tml); tm.add(tmMesh);
  for (k = 0; k < 10; k++) box(tm, 0.07, 1.3, 0.1, mats.trim, 0 - 4.5 + k * 1.0, 1.9, 0 + 4.06, 0.01);
  box(tm, 1.6, 2.4, 0.15, mats.accent, 0, 1.4, 0 + 4.05, 0.02); box(tm, 1.3, 2.2, 0.08, mats.dark, 0, 1.35, 0 + 4.12, 0.02); box(tm, 3.4, 0.14, 1.4, mats.conc, 0, 2.7, 0 + 4.7, 0.02);
  [-1.5, 1.5].forEach(function (dx) { cylP(tm, 0.06, 0.06, 2.5, 8, mats.trim, 0 + dx, 1.35, 0 + 5.2); });
  for (k = 0; k < 3; k++) { box(tm, 0.8, 0.7, 0.8, mats.hull2, 0 - 4 + k * 3.6, 4.4, 0, 0.04); cylP(tm, 0.3, 0.3, 0.03, 12, mats.dark, 0 - 4 + k * 3.6, 4.78, 0); }
  box(tm, 3.2, 0.7, 0.1, mats.dark, 0 + 3.6, 4.1, 0 + 4.1, 0.02); box(tm, 2.4, 0.12, 0.06, mats.accent, 0 + 3.6, 4.15, 0 + 4.16, 0.01);
  for (k = 0; k < 4; k++) box(tm, 0.9, 0.2, 0.4, mats.wood || mats.hull2, 0 - 5.0 + k * 1.3, 0.4, 0 + 5.5, 0.03);
  var pilotLocal = [0, 4.3], pc = Math.cos(psiOf(TMA)), ps = Math.sin(psiOf(TMA)), pilotDoor = [TMP[0] + pilotLocal[0] * pc + pilotLocal[1] * ps, TMP[1] - pilotLocal[0] * ps + pilotLocal[1] * pc];

  // depósito de combustible (sector de 230°): tres tanques tumbados y surtidores
  var FDA = 230 * D2R, FDP = pol(31.5, FDA), fd = new THREE.Group(); fd.position.set(FDP[0], y0, FDP[1]); fd.rotation.y = psiOf(FDA); group.add(fd);
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
  var cmats = [mats.cargoA, mats.cargoB, mats.cargoC, mats.cargoD], CNA = 250 * D2R, CNP = pol(35.5, CNA), cg = new THREE.Group(); cg.position.set(CNP[0], y0, CNP[1]); cg.rotation.y = psiOf(CNA); group.add(cg);
  for (k = 0; k < 5; k++) { box(cg, 3.0, 0.95, 1.0, cmats[k % 4], -6.6 + k * 3.3, 0.48, 0, 0.04); if (k % 3 !== 1) box(cg, 3.0, 0.95, 1.0, cmats[(k + 1) % 4], -6.6 + k * 3.3, 1.45, 0, 0.04); for (j = 0; j < 4; j++) box(cg, 0.04, 0.8, 0.04, mats.trim, -7.8 + k * 3.3 + j * 0.8, 0.48, 0.52, 0.005); }
  // campo solar en los huecos de 90° y 170°
  [90, 170].forEach(function (ga) {
    for (i = 0; i < 3; i++) {
      var sp = new THREE.Group(), spp = pol(31 + i * 3.6, ga * D2R); sp.position.set(spp[0], y0 + 0.55, spp[1]); sp.rotation.y = psiOf(ga * D2R); group.add(sp);
      box(sp, 0.1, 0.5, 0.1, mats.trim, -0.7, -0.15, 0.2, 0.01); box(sp, 0.1, 0.5, 0.1, mats.trim, 0.7, -0.15, 0.2, 0.01);
      var pg = new THREE.Group(); pg.rotation.x = -0.55; sp.add(pg); box(pg, 3.2, 0.08, 1.4, mats.solar, 0, 0, 0, 0.015);
      var gl = []; for (k = 1; k < 8; k++) gl.push({ x: -1.6 + k * 0.4, y: 0.045, z: 0, sx: 0.015, sy: 0.01, sz: 1.35 }); for (k = 1; k < 4; k++) gl.push({ x: 0, y: 0.045, z: -0.7 + k * 0.35, sx: 3.1, sy: 0.01, sz: 0.015 });
      pg.add(boxField(UB, mats.cell, gl));
    }
  });

  /* ---------- Extras del nivel 2: torre elevada con mástil de radar, anillos de luces, cañones antiaéreos y escudo ---------- */
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
  tw.scale.setScalar(1.35);

  // dos anillos de luces con secuencia: uno protege la plataforma y otro rodea la plaza de rodaje
  var chaseR = [11.3, 17.6], chaseM = [[], []], cm = [mats.lA, mats.lW];
  chaseR.forEach(function (rr, ri) {
    var lists = [[], [], [], []];
    for (k = 0; k < 48; k++) { pa = k * TAU / 48; lists[k % 4].push({ x: Math.cos(pa) * rr, y: y0 + 0.11, z: Math.sin(pa) * rr, ry: -pa, sx: 0.9, sy: 0.08, sz: 0.2 }); }
    lists.forEach(function (l) { var m = boxField(UB, cm[ri], l); group.add(m); chaseM[ri].push(m); });
    add(group, new THREE.RingGeometry(rr - 0.5, rr - 0.42, 96).rotateX(-P / 2), mats.mkW, 0, y0 + 0.09, 0);
  });

  // cañones antiaéreos en los huecos del borde: siguen a las naves y disparan en alerta
  var turrets = [];
  [-70, -30, 10, 50, 130, 210].forEach(function (d, ti) {
    var ta = d * D2R, tp = pol(39.4, ta), tg = new THREE.Group(); tg.position.set(tp[0], y0, tp[1]); group.add(tg);
    cylP(tg, 1.5, 1.7, 0.7, 12, mats.concD, 0, 0.35, 0); cylP(tg, 1.2, 1.3, 0.6, 12, mats.hull2, 0, 1.0, 0);
    add(tg, new THREE.TorusGeometry(1.25, 0.06, 6, 20).rotateX(P / 2), mats.accent, 0, 1.3, 0);
    var th = new THREE.Group(); th.position.set(0, 1.9, 0); tg.add(th);
    box(th, 1.6, 0.9, 1.7, mats.panel, 0, 0, 0, 0.1); box(th, 1.8, 0.2, 1.9, mats.accent, 0, 0.5, 0, 0.03);
    add(th, new THREE.SphereGeometry(0.42, 10, 8), mats.cab, 0, 0.5, -0.3);
    var tp2 = new THREE.Group(); tp2.position.set(0, 0.1, -0.8); th.add(tp2);
    [-0.45, 0.45].forEach(function (bx) {
      cylP(tp2, 0.12, 0.12, 3.4, 8, mats.trim, bx, 0, -1.6).rotation.x = P / 2; cylP(tp2, 0.2, 0.2, 0.5, 8, mats.dark, bx, 0, -0.6).rotation.x = P / 2;
      cylP(tp2, 0.17, 0.17, 0.25, 8, mats.dark, bx, 0, -3.3).rotation.x = P / 2;
    });
    var mf = add(tp2, new THREE.SphereGeometry(0.4, 8, 6), mats.spark, 0, 0, -3.7); mf.visible = false;
    box(th, 0.8, 0.15, 0.6, mats.lG, 0, -0.1, 0.9, 0.01);
    turrets.push({ g: tg, h: th, p: tp2, mf: mf, x: tp[0], z: tp[1], ph: ti * 1.7, yaw: 0, pitch: 0.3 });
  });

  // escudo de energía: cúpula translúcida que se enciende en alerta
  var domeMat = new THREE.MeshBasicMaterial({ color: 0x39c5ff, transparent: true, opacity: 0.0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  var dome = add(group, new THREE.SphereGeometry(RB + 1.2, 40, 14, 0, TAU, 0, P / 2), domeMat, 0, y0, 0); dome.visible = false;
  var domeRing = add(group, new THREE.TorusGeometry(RB + 1.2, 0.25, 6, 96).rotateX(P / 2), domeMat, 0, y0 + 0.2, 0); domeRing.visible = false;

  /* ---------- Vehículos: carritos, remolcador robot, piloto y nave de demostración ---------- */
  var RY = y0 + 0.07;                                   // altura del pavimento exterior
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
    return { g: g, x: hx, z: hz, yaw: 0, wheels: wheels, beacon: bl, hx: hx, hz: hz, busy: false, speed: 4.2, pilot: false, kind: 'cart' };
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
    return { g: g, x: hx, z: hz, yaw: 0, wheels: wheels, beacon: bl, hx: hx, hz: hz, busy: false, speed: 4.5, claw: { fL: fL, fR: fR, o: 1, t: 1 }, kind: 'tug' };
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
    s.scale.setScalar(1.3); s.userData = { length: 8.4 * 1.3 * S, width: 6.6 * 1.3 * S, baseY: 0, demo: true };
    return s;
  }
  var carts = [-30, 10, 130, 250].map(function (d) { var h = pol(16.6, d * D2R); return buildCart(h[0], h[1]); });
  var tugs = [-70, 50].map(function (d) { var h = pol(16.6, d * D2R); return buildTug(h[0], h[1]); });
  var pilot = buildPilot();

  /* ---------- Rutas y ejecutor de pasos (movimientos, remolque, puertas) ---------- */
  var LAND_Y = RY;
  function yawFor(dx, dz) { return Math.atan2(-dx, -dz); }
  function angDiff(a, b) { var d = (b - a) % TAU; if (d > P) d -= TAU; if (d < -P) d += TAU; return d; }
  function gnd(x, z) {                               // altura del suelo: dentro de una plaza el piso es más alto (rampa en la puerta)
    var r = Math.hypot(x, z), h2, bb, al, lat, f, best = r < 21.7 ? RY : y0 + 0.02;
    for (h2 = 0; h2 < bays.length; h2++) {
      bb = bays[h2]; al = (x - bb.Dp[0]) * bb.u[0] + (z - bb.Dp[1]) * bb.u[1]; lat = -(x - bb.Dp[0]) * bb.u[1] + (z - bb.Dp[1]) * bb.u[0];
      if (Math.abs(lat) < 6.0 && al > -2 && al < 19.5) { f = clamp((al + 2) / 2, 0, 1); return RY + (y0 + 0.25 - RY) * f; }
    }
    return best;
  }
  function buildPath(pts0, R) {                      // polilínea con esquinas redondeadas -> muestras densas
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
    rec.o.position.set(sx, gnd(sx, sz) + rec.baseY, sz);
    rec.o.rotation.y = v.tow.nose ? v.yaw : v.yaw + P;
  }
  function applyV(v) {
    v.g.position.set(v.x, gnd(v.x, v.z), v.z); v.g.rotation.y = v.yaw;
    if (v.tow) placeShip(v.tow.rec, v);
  }
  // ejecutor: cada paso es una función (dt) -> true cuando termina
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
  function sDoorOpen(bay) { return function () { return bay.door.o > 0.96; }; }
  function polAng(x, z) { return Math.atan2(z, x); }
  function ringRoute(F, T) {                         // del punto F al anillo de rodaje, por el anillo hasta el ángulo de T y radial hasta T
    var aF = polAng(F.x, F.z), aT = polAng(T.x, T.z), d = angDiff(aF, aT), n = Math.max(1, Math.ceil(Math.abs(d) / (30 * D2R))), pts = [], s;
    pts.push(pol(RING, aF));
    for (s = 1; s <= n; s++) pts.push(pol(RING, aF + d * s / n));
    pts.push([T.x, T.z]); return pts;
  }

  /* ---------- Trabajos: aparcar, reparar (media hora a la vista), guardar y despachar naves ---------- */
  var jobs = [], ships = [], flights = [], TDP = pol(22.3, TMA), TERM_DROP = { x: TDP[0], z: TDP[1] };
  function recOf(o, opts) {
    var r = o.userData && o.userData._air;
    if (r) return r;
    opts = opts || {}; var ud = o.userData || {};
    r = { o: o, L: (opts.length || ud.length || 8 * S) / S, W: (opts.width || ud.width || 6 * S) / S, baseY: (ud.baseY || 0) / S, state: 'landed', bay: null, job: null };
    o.userData = ud; ud._air = r; ships.push(r);
    r.parent0 = o.parent;
    if (o.parent !== group) { if (group.attach) group.attach(o); else group.add(o); }
    return r;
  }
  function poseOf(rec) { return { x: rec.o.position.x, z: rec.o.position.z, yaw: rec.o.rotation.y }; }
  function endAt(pose, L, which) {                   // punto donde el remolcador toma la nave por la nariz o la cola
    var sg = which === 'nose' ? 1 : -1, ax = -Math.sin(pose.yaw) * sg, az = -Math.cos(pose.yaw) * sg, d = L / 2 + 0.85;
    return { x: pose.x + ax * d, z: pose.z + az * d, ax: ax, az: az, which: which };
  }
  function doorEndB(rec, bay) {                      // extremo del lado del anillo (mira hacia el centro)
    var a = endAt(poseOf(rec), rec.L, 'nose');
    return (a.ax * bay.u[0] + a.az * bay.u[1]) < 0 ? a : endAt(poseOf(rec), rec.L, 'tail');
  }
  function freeBay(type) { for (var b = 0; b < bays.length; b++) if (bays[b].type === type && !bays[b].occ) return bays[b]; return null; }
  function freeTug() { for (var t2 = 0; t2 < tugs.length; t2++) if (!tugs[t2].busy) return tugs[t2]; return null; }
  function freeCart() { for (var c2 = 0; c2 < carts.length; c2++) if (!carts[c2].busy) return carts[c2]; return null; }
  function polyLen(pts, upTo) { var l = 0, q2; for (q2 = 1; q2 <= upTo; q2++) l += Math.hypot(pts[q2][0] - pts[q2 - 1][0], pts[q2][1] - pts[q2 - 1][1]); return l; }
  function notify(job, st) { job.state = st; if (job.rec) job.rec.state = st; if (job.onState) { try { job.onState(job, job.rec.o); } catch (e) { } } }
  function sHide(vv) { return sDo(function () { vv.g.visible = false; }); }
  function addv(a, b, k) { return [a[0] + b[0] * k, a[1] + b[1] * k]; }
  // pasos: llegar al extremo de la nave, girar, abrir pinza, retroceder y agarrar
  function stepsAttach(tug, E) {
    var Q = { x: E.x + E.ax * 2.4, z: E.z + E.az * 2.4 };
    return [sDo(function () { tug.claw.t = 1; }), sMove(tug, ringRoute({ x: tug.x, z: tug.z }, Q), { R: 1.6 }), sTurn(tug, yawFor(E.ax, E.az)),
      sMove(tug, [[E.x, E.z]], { rev: true, noAlign: true, speed: 1.4, R: 0.1 }), sClaw(tug, false)];
  }
  // llevar la nave a una plaza: desde la plataforma = nariz primero en línea recta; desde el taller = cola primero por el anillo
  function flowTowIn(job, tug, bay, carts2, fromBay) {
    var rec = job.rec, L = rec.L, D = L / 2 + 0.85, nose = !fromBay, pose = job.pose || poseOf(rec), E = fromBay ? doorEndB(rec, fromBay) : endAt(pose, L, 'nose');
    var u = bay.u, pr = [-u[1], u[0]], Tend = [bay.S[0] + u[0] * D, bay.S[1] + u[1] * D], R = clamp(L * 0.3, 1.5, 3.5), tp, sv = {}, lag = L + 2.4, st = [];
    if (fromBay) tp = [[E.x, E.z]].concat(ringRoute({ x: E.x, z: E.z }, { x: Tend[0], z: Tend[1] })); else tp = [[E.x, E.z], Tend];
    var endS = Math.max(0, polyLen(tp, tp.length - 2) - 1.8), lane = bay.lane;
    var P1 = addv(Tend, pr, lane), P2 = addv(addv(bay.Dp, pr, lane), u, -1.5), outPts = [P1, P2].concat(ringRoute({ x: P2[0], z: P2[1] }, { x: tug.hx, z: tug.hz }));
    st.push(sDo(function () { holdDoor(bay); notify(job, 'approach'); }));
    st = st.concat(stepsAttach(tug, E));
    st.push(sUntil(function () { return job.boarded; }));
    st.push(sDo(function () { tug.tow = { rec: rec, nose: fromBay ? (E.which === 'nose') : nose }; notify(job, 'towing'); }));
    st.push(sMove(tug, tp.slice(1), { noAlign: true, speed: 3.0, R: R, save: sv }));
    st.push(sDo(function () { tug.tow = null; rec.o.position.set(bay.S[0], gnd(bay.S[0], bay.S[1]) + rec.baseY, bay.S[1]); rec.o.rotation.y = nose ? bay.psi : bay.psi + Math.PI; rec.bay = bay; bay.occ = rec; if (fromBay) { fromBay.occ = null; fromBay.repairing = false; fromBay.prog = 0; } }));
    st.push(sClaw(tug, true));
    st.push(sMove(tug, outPts, { R: 1.2 }));
    st.push(sTurn(tug, 0));
    st.push(sDo(function () { freeDoor(bay); tug.busy = false; }));
    var main = seq(st), esc = null;
    if (carts2 && carts2.escort) {
      var cb = carts2.escort, stage = { x: E.x - E.ax * lag, z: E.z - E.az * lag }, P2c = addv(addv(bay.Dp, pr, lane), u, -1.5), pk = addv(addv(bay.Dp, pr, lane), u, 3.5), es = [];
      es.push(sDo(function () { cb.busy = true; holdDoor(bay); }));
      es.push(sMove(cb, ringRoute({ x: cb.x, z: cb.z }, stage), { R: 1.4 })); es.push(sTurn(cb, yawFor(E.ax, E.az)));
      es.push(function (dt) { if (!sv.path) return false; var sf = Math.min(sv.s - lag, endS), q = sf < 0 ? (function () { var d0 = pathAt(sv.path, 0); return { x: d0.x + d0.dx * sf, z: d0.z + d0.dz * sf, dx: d0.dx, dz: d0.dz }; })() : pathAt(sv.path, sf); cb.x = q.x; cb.z = q.z; cb.yaw = yawFor(q.dx, q.dz); applyV(cb); cb.moving = 1; return sv.s - lag >= endS || sv.done; });
      es.push(sMove(cb, [pol(RING, bay.phi), P2c, pk], { R: 1.4 })); es.push(sTurn(cb, yawFor(u[0], u[1]))); es.push(sWait(2.2));
      es.push(sMove(cb, [P2c].concat(ringRoute({ x: P2c[0], z: P2c[1] }, { x: cb.hx, z: cb.hz })), { R: 1.2 }));
      es.push(sDo(function () { freeDoor(bay); cb.busy = false; cb.moving = 0; }));
      esc = seq(es);
    }
    return esc ? par([main, esc]) : main;
  }
  function flowPilot(job, cart) {                    // el carrito recoge al piloto junto a la nave y lo lleva a la terminal
    var rec = job.rec, pose = job.pose || poseOf(rec), fx = -Math.sin(pose.yaw), fz = -Math.cos(pose.yaw), off = rec.W / 2 + 1.6;
    var px = pose.x - fz * off, pz = pose.z + fx * off, CP = { x: px + (px - pose.x) / off * 1.0, z: pz + (pz - pose.z) / off * 1.0 };
    var st = [], home = { x: cart.hx, z: cart.hz };
    st.push(sDo(function () { cart.busy = true; pilot.g.visible = true; pilot.sit = null; pilot.x = px; pilot.z = pz; pilot.yaw = 0; }));
    st.push(sMove(cart, ringRoute({ x: cart.x, z: cart.z }, CP), { R: 1.6 }));
    st.push(sPilotTo(CP.x, CP.z, 1.6)); st.push(sWait(0.4));
    st.push(sDo(function () { pilot.sit = cart; job.boarded = true; }));
    st.push(sMove(cart, ringRoute(CP, TERM_DROP), { R: 1.8 }));
    st.push(sDo(function () { pilot.sit = null; pilot.x = TERM_DROP.x; pilot.z = TERM_DROP.z; }));
    st.push(sPilotTo(pilotDoor[0], pilotDoor[1], 1.4)); st.push(sHide(pilot));
    st.push(sMove(cart, ringRoute(TERM_DROP, home), { R: 1.6 })); st.push(sTurn(cart, 0));
    st.push(sDo(function () { cart.busy = false; cart.moving = 0; }));
    return seq(st);
  }
  // mesa giratoria: la nave se centra y gira con la proa hacia la plaza elegida antes de que llegue el remolcador
  function flowAlign(job, psiT) {
    var rec = job.rec, x0, z0, a0, aT, tt = 0, dur = 3.2;
    return stp(function () { x0 = rec.o.position.x; z0 = rec.o.position.z; a0 = rec.o.rotation.y; aT = a0 + angDiff(a0, psiT); ttable.rotation.y = a0 - aT; notify(job, 'aligning'); }, function (dt) {
      tt += dt; var u = clamp(tt / dur, 0, 1), e = u * u * (3 - 2 * u), ya = a0 + (aT - a0) * e;
      rec.o.position.set(x0 * (1 - e), gnd(0, 0) + rec.baseY, z0 * (1 - e)); rec.o.rotation.y = ya; ttable.rotation.y = ya - aT;
      if (u >= 1) { rec.o.rotation.y = psiT; ttable.rotation.y = 0; return true; }
      return false;
    });
  }
  function flowRepair(job, bay) {
    return stp(function () { bay.repairing = true; job.t = 0; notify(job, 'repairing'); }, function (dt) {
      job.t += dt; job.progress = clamp(job.t / job.rep, 0, 1); bay.prog = job.progress;
      if (job.progress >= 1) { bay.repairing = false; return true; }
      return false;
    });
  }

  // despacho: el remolcador saca la nave de su plaza en línea recta y la deja en el centro de la plataforma
  function flowLaunch(job, tug) {
    var rec = job.rec, bay = rec.bay, E = doorEndB(rec, bay), L = rec.L, D = L / 2 + 0.85, u = bay.u, pr = [-u[1], u[0]], st = [];
    var Tfin = [-u[0] * D, -u[1] * D], nose = E.which === 'nose', lp = rec.W / 2 + 1.3, P1 = addv(Tfin, pr, lp), P2 = pol(RING, polAng(P1[0], P1[1]));
    st.push(sDo(function () { holdDoor(bay); notify(job, 'approach'); }));
    st = st.concat(stepsAttach(tug, E));
    st.push(sDo(function () { tug.tow = { rec: rec, nose: nose }; bay.occ = null; bay.repairing = false; bay.prog = 0; notify(job, 'towing'); }));
    st.push(sMove(tug, [Tfin], { noAlign: true, speed: 3.2, R: 1.5 }));
    st.push(sDo(function () { tug.tow = null; rec.bay = null; }));
    st.push(sClaw(tug, true));
    st.push(sDo(function () { freeDoor(bay); notify(job, 'ready'); if (job.autoTakeoff) startTakeoff(rec, job); }));
    st.push(sMove(tug, [P1, P2].concat(ringRoute({ x: P2[0], z: P2[1] }, { x: tug.hx, z: tug.hz })), { R: 1.6 }));
    st.push(sTurn(tug, 0)); st.push(sDo(function () { tug.busy = false; tug.moving = 0; }));
    return seq(st);
  }
  // polvo de la plataforma (arena levantada por los propulsores)
  var dustMat = new THREE.MeshBasicMaterial({ color: 0xc9a972, transparent: true, opacity: 0, depthWrite: false }), dustM = new THREE.Mesh(new THREE.CircleGeometry(1, 28).rotateX(-P / 2), dustMat);
  dustM.visible = false; group.add(dustM);
  function setDust(x, z, r, op) { dustM.visible = op > 0.01; dustM.position.set(x, y0 + 0.12, z); dustM.scale.set(r, 1, r); dustMat.opacity = op; }
  function startTakeoff(rec, job) {
    var f = { rec: rec, t: 0, x0: rec.o.position.x, z0: rec.o.position.z, job: job, kind: 'takeoff' }; flights.push(f); rec.state = 'takeoff'; notify(job, 'takeoff');
  }
  function startLanding(o, opts) {
    opts = opts || {}; var rec = recOf(o, opts);
    o.visible = true; rec.state = 'landing';
    var tx = opts.x != null ? opts.x : (rnd() - 0.5) * 2.4, tz = opts.z != null ? opts.z : PADZ + (rnd() - 0.5) * 2.4, yaw = opts.yaw != null ? opts.yaw : (rnd() - 0.5) * 1.8;
    var f = { rec: rec, t: 0, dur: 11, tx: tx, tz: tz, yaw: yaw, sx: tx + 34, sz: tz - 14, sh: 18, kind: 'land', onLanded: opts.onLanded };
    flights.push(f); o.rotation.set(0, P / 2, 0); o.position.set(f.sx, RY + f.sh, f.sz); return rec;
  }
  function stepFlights(dt) {
    var hasDust = false;
    for (var fi = flights.length - 1; fi >= 0; fi--) {
      var f = flights[fi], r = f.rec, o = r.o, tt = f.t += dt;
      if (f.kind === 'land') {
        var u = Math.min(1, tt / f.dur), a = clamp(u / 0.42, 0, 1), ea = 1 - (1 - a) * (1 - a), b = clamp((u - 0.42) / 0.58, 0, 1), eb = b * b * (3 - 2 * b);
        var px = f.sx + (f.tx - f.sx) * ea, pz = f.sz + (f.tz - f.sz) * ea, hh = f.sh * (1 - eb);
        o.position.set(px, RY + r.baseY + hh, pz); o.rotation.set(0, P / 2 + (f.yaw - P / 2) * ea, 0);
        if (hh < 7) { setDust(px, pz, 2 + (7 - hh) * 0.9 + b * 2, Math.min(0.5, (7 - hh) / 7 * 0.6) * (1 - Math.max(0, u - 0.97) * 30)); hasDust = true; }
        if (u >= 1) { r.state = 'landed'; o.rotation.set(0, f.yaw, 0); flights.splice(fi, 1); if (f.onLanded) f.onLanded(r.o); }
      } else {
        var rise = clamp(tt / 3.2, 0, 1), er = rise * rise * (3 - 2 * rise), away = Math.max(0, tt - 3.2), yy = 16 * er + away * away * 0.9, xx = f.x0 + away * away * 3.2;
        o.position.set(xx, RY + r.baseY + yy, f.z0 - away * away * 0.6); o.rotation.set(0, o.rotation.y, 0);
        if (tt < 4.5) { setDust(f.x0, f.z0, 3 + tt * 1.6, Math.min(0.5, tt * 0.5) * (1 - clamp((tt - 2.8) / 1.7, 0, 1))); hasDust = true; }
        if (tt > 11) { o.visible = false; r.state = 'gone'; flights.splice(fi, 1); var ix = ships.indexOf(r); if (ix >= 0) ships.splice(ix, 1); if (o.userData) o.userData._air = null; if (f.job && f.job.onState) { f.job.state = 'departed'; try { f.job.onState(f.job, o); } catch (e) { } } }
      }
    }
    if (!hasDust) dustM.visible = false;
  }

  /* ---------- Planificador, demostración y API ---------- */
  var mode = 'working', ghost = false, origEm = {}, lastT = null, demoT = 0, tickN = 0;
  bays.forEach(function (b) { b.holds = 0; b.idleT = 9; b.prog = 0; });
  function tryStart(job) {
    var tug, bay, cart, esc, ps = [];
    if (job.type === 'service' && job.phase === 'queued') {
      tug = freeTug(); if (!tug) return;
      bay = job.repair ? freeBay('repair') : freeBay('hangar'); if (!bay) return;
      tug.busy = true; bay.occ = job.rec; if (job.repair) job.repairBay = bay;
      cart = job.pilot ? freeCart() : null; if (cart) cart.busy = true; else job.boarded = true;
      esc = freeCart(); if (esc) esc.busy = true;
      job.pose = { x: 0, z: 0, yaw: bay.psi };
      ps.push(flowTowIn(job, tug, bay, esc ? { escort: esc } : null, null));
      if (cart) ps.push(flowPilot(job, cart));
      job.run = seq([flowAlign(job, bay.psi), par(ps)]); job.phase = 'p1';
    } else if (job.type === 'service' && job.phase === 'queued2') {
      tug = freeTug(); bay = freeBay('hangar'); if (!tug || !bay) return;
      tug.busy = true; bay.occ = job.rec; job.boarded = true; esc = freeCart(); if (esc) esc.busy = true;
      job.run = flowTowIn(job, tug, bay, esc ? { escort: esc } : null, job.repairBay); job.phase = 'p3';
    } else if (job.type === 'launch' && job.phase === 'queued') {
      tug = freeTug(); if (!tug) return;
      tug.busy = true; job.run = flowLaunch(job, tug); job.phase = 'p1';
    }
  }
  function advance(job) {
    if (job.type === 'launch') { job.phase = 'done'; return; }
    if (job.phase === 'p1') { if (job.repair) { job.phase = 'repair'; job.run = flowRepair(job, job.repairBay); } else { job.phase = 'done'; notify(job, 'stored'); } }
    else if (job.phase === 'repair') { job.phase = 'queued2'; notify(job, 'repaired'); }
    else if (job.phase === 'p3') { job.phase = 'done'; notify(job, 'stored'); }
  }
  var dm = { step: 0, t: 0, ship: null, job: null, lj: null };
  function demoTick(dt) {
    dm.t += dt;
    if (dm.step === 0) {
      if (!dm.ship) dm.ship = buildDemoShip();
      startLanding(dm.ship, { onLanded: function () { dm.step = 2; dm.t = 0; } }); dm.step = 1;
    } else if (dm.step === 2 && dm.t > 1.5) { dm.job = api.service(dm.ship, { pilot: true, repairSeconds: 16 }); dm.step = 3; }
    else if (dm.step === 3 && dm.job.phase === 'done') { dm.step = 4; dm.t = 0; }
    else if (dm.step === 4 && dm.t > 5) { dm.lj = api.launch(dm.ship, { autoTakeoff: true }); dm.step = dm.lj ? 5 : 4; }
    else if (dm.step === 5 && dm.lj && dm.lj.state === 'departed') { dm.step = 6; dm.t = 0; }
    else if (dm.step === 6 && dm.t > 4) dm.step = 0;
  }
  var entrance = new THREE.Object3D(); entrance.position.set(pilotDoor[0] * S, (y0 + 0.1) * S, pilotDoor[1] * S); outer.add(entrance);
  var landingRef = new THREE.Object3D(); landingRef.position.set(0, RY * S, 0); outer.add(landingRef);
  var api = {
    group: outer,
    footprint: { w: SX * S, d: SZ * S },
    circular: true, radius: RB * S,
    entrance: entrance,                                  // puerta de la terminal (el jugador entra/sale aquí)
    input: new THREE.Object3D(),                         // energía (esquina noroeste)
    output: new THREE.Object3D(),
    landing: landingRef,                                 // centro de la pista
    pad: { x: 0, z: 0, r: PADR * S },                    // plataforma circular de aterrizaje vertical
    maxShip: { length: 12 * S, width: 9 * S },
    bays: bays,
    nivel: 2,
    repairSeconds: opts.repairSeconds || 1800,           // reparación en la pista: media hora
    demo: true,
    getState: function () { return mode; },
    setState: function (s) { api.demo = false; mode = s; },
    setAccent: function (hex) { setAccent(hex); },
    getShips: function () { return ships.slice(); },
    land: function (ship, o) { return startLanding(ship, o); },       // descenso vertical animado (opcional)
    service: function (ship, o) {
      o = o || {}; var rec = recOf(ship, o);
      if (rec.job && rec.job.phase !== 'done') return rec.job;
      var job = { type: 'service', rec: rec, phase: 'queued', repair: o.repair !== false, pilot: o.pilot !== false, rep: o.repairSeconds || api.repairSeconds, progress: 0, onState: o.onState, boarded: false, t: 0, state: 'queued' };
      rec.job = job; jobs.push(job); notify(job, 'queued'); return job;
    },
    launch: function (ship, o) {
      o = o || {}; var rec = ship.userData && ship.userData._air;
      if (!rec || !rec.bay || ['stored', 'repairing', 'repaired'].indexOf(rec.state) < 0) return null;
      var pj = rec.job;                                    // si estaba en reparación, se cancela y sale tal cual
      if (pj && pj.type === 'service' && pj.phase !== 'done') {
        if (pj.run && pj.phase !== 'repair') return null;  // a medio remolque: aún no se puede sacar
        pj.run = null; pj.phase = 'done'; rec.bay.repairing = false; rec.bay.prog = 0; pj.cancelled = pj.progress < 1;
      }
      var job = { type: 'launch', rec: rec, phase: 'queued', autoTakeoff: !!o.autoTakeoff, onState: o.onState, state: 'queued' };
      rec.job = job; jobs.push(job); notify(job, 'queued'); return job;
    },
    free: function (ship) {                            // la pista suelta la nave (el juego recupera el control)
      var rec = ship.userData && ship.userData._air; if (!rec) return;
      var ix = ships.indexOf(rec); if (ix >= 0) ships.splice(ix, 1); ship.userData._air = null;
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
          else if (jb.phase === 'queued' || jb.phase === 'queued2') tryStart(jb);
        }
        for (i = jobs.length - 1; i >= 0; i--) if (jobs[i].phase === 'done') jobs.splice(i, 1);
      }
      // vehículos: pinza, balizas, piloto
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
        pilot.g.position.set(pilot.x, gnd(pilot.x, pilot.z), pilot.z); pilot.g.rotation.y = pilot.yaw;
        var sw = pilot.walking && run ? Math.sin(t * 9) * 0.6 : 0;
        pilot.lL.rotation.x = sw; pilot.lR.rotation.x = -sw; pilot.aL.rotation.x = -sw; pilot.aR.rotation.x = sw;
      }
      // puertas y lámparas de las plazas
      for (i = 0; i < bays.length; i++) {
        b = bays[i];
        if (b.holds > 0) b.idleT = 0; else b.idleT += dt;
        var tg = (b.holds > 0 || b.idleT < 1.2) && on ? 1 : 0, dd = tg - b.door.o, moving = Math.abs(dd) > 0.01;
        b.door.o += Math.max(-1, Math.min(1, dd * 100)) * Math.min(Math.abs(dd), dt * 0.4);
        var sc = Math.max(0.04, 1 - b.door.o); b.door.g.scale.y = sc; b.door.g.position.y = b.door.top - b.door.H * sc; if (b.open) moving = false;
        if (b.type === 'hangar') { b.lampG.visible = on && !b.occ; b.lampR.visible = on && !!b.occ && (!moving || blink); }
        else {
          var act = b.repairing && run; b.beacon.rotation.y += dt * (act || moving ? 5 : 0); b.beacon.visible = on && (act || moving || !!b.occ);
          var nl = Math.round(clamp(b.prog, 0, 1) * 10), bi = b.bi, kk;
          for (kk = 0; kk < 10; kk++) progLit[bi][kk].visible = on && kk < nl && !!b.occ;
        }
      }
      // grúas puente, brazos robóticos y chispas del taller
      for (i = 0; i < cranes.length; i++) {
        c = cranes[i]; var rb = c.bay, act2 = rb.repairing && run; c.k = (c.k || 0) + ((act2 ? 1 : 0) - (c.k || 0)) * Math.min(1, dt * 1.2);
        c.bridge.position.z = -0.5 + c.k * 2.6 * Math.sin(t * 0.3 + c.bi * 2); c.trolley.position.x = c.k * 2.8 * Math.sin(t * 0.47 + c.bi);
        var cl = 1.2 + c.k * (0.8 + 0.7 * Math.sin(t * 0.6 + c.bi)); c.cable.scale.y = cl; c.cable.position.y = -0.2 - cl / 2; c.hook.position.y = -0.3 - cl;
      }
      for (i = 0; i < arms.length; i++) {
        a2 = arms[i]; var ab = a2.bay, ac = ab.repairing && run; a2.k = (a2.k || 0) + ((ac ? 1 : 0) - (a2.k || 0)) * Math.min(1, dt * 1.5);
        a2.sh.rotation.z = -(0.12 + a2.k * (0.7 + 0.3 * Math.sin(t * 1.4 + a2.ph))); a2.el.rotation.z = -(0.15 + a2.k * (0.8 + 0.4 * Math.sin(t * 2.1 + a2.ph * 2)));
        a2.yaw.rotation.y = (a2.sgn < 0 ? P : 0) + a2.k * 0.3 * Math.sin(t * 0.8 + a2.ph);
      }
      for (i = 0; i < sparks.length; i++) {
        var sp = sparks[i], sb = sp.bay, f = (t * 1.3 + sp.ph) % 1, sa = sb.repairing && run && f < 0.7 && Math.sin(t * 3 + sp.ph * 5) > -0.3;
        sp.m.visible = sa;
        if (sa) sp.m.position.set(Math.sin(sp.ph * 7) * 3.0 + Math.sin(sp.ph) * f, 1.3 + (sp.ph % 1) * 1.2 + f * 0.8 - f * f * 1.6, 1.0 + Math.cos(sp.ph * 5) * 3.0);
      }
      // pista, torre y manga
      for (i = 0; i < strobes.length; i++) strobes[i].visible = on && (mode === 'alert' ? blink : (Math.floor(t * 8) + i) % 6 === 0);
      var fl = on && (mode !== 'broken' || Math.sin(t * 9) > -0.4);
      lwM.visible = fl && (mode !== 'alert' || blink); lbM.visible = fl; lgM.visible = fl; lrM.visible = fl; tmMesh.visible = fl;
      tradar.rotation.y += dt * (run ? (mode === 'alert' ? 3.2 : 1.1) : 0); tbeamG.rotation.y += dt * (run ? 1.6 : 0); tbeamG.visible = on;
      tbeacon.visible = on && blink; tradarB.rotation.y += dt * (run ? (mode === 'alert' ? 4.0 : 1.8) : 0);
      for (k = 0; k < 2; k++) { var cph = (((Math.floor(t * 7) * (k ? -1 : 1)) % 4) + 4) % 4; for (j = 0; j < 4; j++) chaseM[k][j].visible = fl && (mode === 'alert' ? blink : j === cph); }
      var tgt = null, tgd = 1e9;
      for (k = 0; k < ships.length; k++) { var so = ships[k].o; if (!so.visible) continue; var sdx = so.position.x, sdz = so.position.z, sdd = sdx * sdx + sdz * sdz; if (sdd < tgd) { tgd = sdd; tgt = so; } }
      for (k = 0; k < turrets.length; k++) {
        var tu = turrets[k], gy, gp;
        if (tgt && run) { var ddx = tgt.position.x - tu.x, ddz = tgt.position.z - tu.z, hh = Math.max(0, tgt.position.y - y0 - 1.9), dd = Math.sqrt(ddx * ddx + ddz * ddz) || 1; gy = Math.atan2(-ddx, -ddz); gp = clamp(Math.atan2(hh + 3, dd), 0.12, 1.2); }
        else { gy = psiOf(Math.atan2(tu.z, tu.x)) + P + 0.6 * Math.sin(t * 0.25 + tu.ph); gp = 0.25 + 0.1 * Math.sin(t * 0.4 + tu.ph); }
        var dy = gy - tu.yaw; while (dy > P) dy -= TAU; while (dy < -P) dy += TAU;
        tu.yaw += dy * Math.min(1, dt * 2.5); tu.pitch += (gp - tu.pitch) * Math.min(1, dt * 2.5);
        tu.h.rotation.y = tu.yaw; tu.p.rotation.x = tu.pitch;
        tu.mf.visible = on && mode === 'alert' && ((Math.floor(t * 12) + k) % 3 === 0);
      }
      var shOn = mode === 'alert'; dome.visible = shOn; domeRing.visible = shOn; domeMat.opacity = shOn ? 0.07 + 0.05 * Math.sin(t * 3) : 0;
      sockG.rotation.y = 0.5 * Math.sin(t * 0.07) + 0.15 * Math.sin(t * 0.4);
      sockD.rotation.z = -(0.2 + 0.25 * (0.5 + 0.5 * Math.sin(t * 0.5))) + 0.05 * Math.sin(t * 6);
      mats.status.color.setHex(mode === 'working' ? 0x35ff7a : mode === 'alert' ? (blink ? 0xff3b30 : 0x301010) : mode === 'broken' ? 0xffa31a : 0x303030);
    }
  };
  var ip = pol(RB - 1.4, 250 * D2R); api.input.position.set(ip[0] * S, (y0 + 0.5) * S, ip[1] * S); outer.add(api.input);
  var op = pol(RB - 1.4, 90 * D2R); api.output.position.set(op[0] * S, (y0 + 0.5) * S, op[1] * S); outer.add(api.output);
  api.update(0);
  return api;
}
