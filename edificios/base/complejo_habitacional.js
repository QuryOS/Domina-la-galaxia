/**
 * Complejo habitacional principal para Three.js, sin archivos externos (ciudad-base grande para colocar en el planeta).
 *
 * Seis edificios con rol propio sobre una losa de 28 x 28, sin vallas ni cercos:
 *  - Torre de mando (centro, la más grande): podio con columnata, tres cuerpos girados con fachada de cristal por pisos y
 *    contrafuertes luminosos, ascensor exterior, corona mirador, aguja con parábolas giratorias y halo holográfico.
 *  - Investigación: bloque de laboratorios, observatorio con cúpula giratoria, radiotelescopio, reactor de pruebas y radar.
 *  - Víveres: invernadero hidropónico (cúpula facetada y nave en bóveda con luces de cultivo), silos y depósitos de agua.
 *  - Hospital: planta en cruz con cruz roja luminosa, helipuerto con una nave de rescate posada, ambulancias y gases medicinales.
 *  - Armamento: búnker blindado de paredes inclinadas, silos de misiles con escotillas y misil que emerge, torretas
 *    antiaéreas que siguen un blanco, radar, reflector barredor y barreras.
 *  - Almacén: nave de carga con muelles de persiana, camión acoplado, montacargas, patio de contenedores y grúa pórtico.
 * Además: garita con barrera automática que sube y baja, caminos y colonos.
 *
 * Uso:
 *   const hab = createComplejoHabitacional(THREE, { accent: 0x2fa8ff });
 *   hab.group.position.set(x, groundY, z);        // la base de la losa está en y = 0
 *   scene.add(hab.group);
 *   hab.update(clock.getElapsedTime());
 *
 * Escala: 1 unidad = 4 m. Huella: 28 x 28 unidades (hab.footprint), centrada en el origen. Altura total ~26.
 * Acceso: hab.entrance (Object3D, borde +Z). Suministros: hab.input (Object3D, borde -X).
 * hab.towers = { mando, investigacion, viveres, hospital, armamento, almacen }: el grupo de cada edificio (por si quieres
 *   resaltarlo, asignarle función o ponerle una etiqueta encima).
 *
 * Estados (hab.setState): 'working' vida normal, 'alert' alarma (balizas rojas giratorias, luces rojizas),
 *   'broken' avería (ventanas parpadeando, balizas naranjas), 'off' apagado. Por defecto corre una demostración
 *   (hab.demo = true): la población sube y baja y de vez en cuando suena una alerta; setState la desactiva.
 * hab.setPopulation(0..1) / getPopulation(): fracción de ventanas encendidas y de colonos en la calle.
 * hab.setGhost(true, valid): modo "fantasma" para colocar (verde si valid, rojo si valid === false); setGhost(false) lo quita.
 * hab.setAccent(hex): color de la torre de mando.
 * Compatible con Three.js r128 o superior.
 */
function createComplejoHabitacional(THREE, opts) {
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

  var SLAB = 0.4, k, j, i, q, SZ = 28;
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function sstep(x) { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); }
  function box(parent, w, h, d, mat, x, y, z, r) { return add(parent, roundedBox(w, h, d, r || 0.03, 2), mat, x, y, z); }
  function cylP(parent, r1, r2, h, seg, mat, x, y, z) { return add(parent, new THREE.CylinderGeometry(r1, r2, h, seg || 12), mat, x, y, z); }
  function strutIn(parent, a, b, r, mat) {
    var m = new THREE.Mesh(_cg[r] || (_cg[r] = new THREE.CylinderGeometry(r, r, 1, 8)), mat);
    placeStrut(m, a, b); parent.add(m); return m;
  }
  function std(c, m, r, extra) { var o = { color: c, metalness: m, roughness: r, side: THREE.DoubleSide }; if (extra) for (var kk in extra) o[kk] = extra[kk]; return new THREE.MeshStandardMaterial(o); }
  function bas(c) { return new THREE.MeshBasicMaterial({ color: c }); }
  mats.conc = std(0xb7bbc2, 0.15, 0.78);
  mats.concD = std(0x8d9199, 0.2, 0.8);
  mats.panel = std(0xe9edf2, 0.25, 0.55);
  mats.strip = std(0x101a28, 0.9, 0.15, { emissive: 0x0a2236, emissiveIntensity: 0.55 });
  mats.milA = std(0x3b4251, 0.55, 0.55);
  mats.milB = std(0x4d5646, 0.45, 0.6);
  mats.metalC = std(0x8a929c, 0.7, 0.45);
  mats.acR = std(0x35d0ff, 0.3, 0.4); mats.acG = std(0x6fe37a, 0.3, 0.4); mats.acH = std(0xff3b3b, 0.3, 0.4); mats.acW = std(0xff8a1f, 0.3, 0.4); mats.acS = std(0xffc42a, 0.3, 0.4);
  mats.eR = bas(0x35d0ff); mats.eG = bas(0xff5fe0); mats.eH = bas(0xff3030); mats.eW = bas(0xff8a1f); mats.eS = bas(0xffc42a); mats.eC = bas(0x35e0ff);
  mats.winW = bas(0xffe3a0); mats.winC = bas(0xbfe4ff);
  mats.glassD = std(0x9fd6ff, 0.2, 0.05, { transparent: true, opacity: 0.32 });
  mats.glassG = std(0xb8f0c8, 0.2, 0.05, { transparent: true, opacity: 0.28, flatShading: true });
  mats.leaf = std(0x3f9a4c, 0, 0.8); mats.leaf2 = std(0x2a7a3c, 0, 0.8); mats.leaf3 = std(0x7ccf55, 0, 0.8);
  mats.bark = std(0x6b4a2f, 0, 0.9); mats.grass = std(0x4f9a4a, 0, 0.95); mats.soil = std(0x4a3a2c, 0, 0.95);
  mats.plaza = std(0xa9a49a, 0.1, 0.85); mats.road = std(0x363940, 0.2, 0.85);
  mats.contA = std(0xc0502f, 0.4, 0.55); mats.contB = std(0x2f7bc0, 0.4, 0.55); mats.contC = std(0xc9a02f, 0.4, 0.55); mats.contD = std(0x4a8a5a, 0.4, 0.55);
  mats.beam = glowMat(0xff3b30, 0.22);
  mats.sweep = glowMat(0xfff3c0, 0.12);
  mats.lineE = new THREE.LineBasicMaterial({ color: 0xcfeeff, transparent: true, opacity: 0.55 });
  var winMeshes = [[], [], [], [], []], edgesL = [], beacons = [], anims = [], WL = 5;
  function roofGreeble(g, cx, y, cz, w, d, n, mat) {
    var l = [];
    for (var a = 0; a < n; a++) { var sx = 0.15 + rnd() * 0.4, sz = 0.15 + rnd() * 0.4, sy = 0.08 + rnd() * 0.25; l.push({ x: cx + (rnd() - 0.5) * (w - 0.5), y: y + sy / 2, z: cz + (rnd() - 0.5) * (d - 0.5), ry: rnd() * 1.2, sx: sx, sy: sy, sz: sz }); }
    var m = boxField(UB, mat, l); g.add(m); return m;
  }
  /* Fachada: franjas de cristal oscuro + segmentos encendibles (5 capas) + cantos de forjado + columnas de esquina. */
  function mkFacade(g) {
    var F = { L: [[], [], [], [], []], S: [], E: [], C: [] };
    F.tier = function (cx, cz, yaw, w, d, y0, floors, fh, o) {
      o = o || {}; var segW = o.seg || 0.5, m = o.margin || 0.3, f, ii, c = Math.cos(yaw), s = Math.sin(yaw);
      function wp(lx, lz) { return [cx + lx * c + lz * s, cz - lx * s + lz * c]; }
      for (f = 0; f < floors; f++) {
        var yc = y0 + (f + 0.5) * fh;
        for (ii = 0; ii < 4; ii++) {
          var len = ii % 2 ? d : w, off = (ii % 2 ? w : d) / 2, usable = len - 2 * m, ns = Math.max(1, Math.floor(usable / segW)), step = usable / ns, ry = yaw + ii * P / 2, uu, pp;
          function place(u, offs) {
            return wp(ii === 0 ? u : ii === 1 ? offs : ii === 2 ? -u : -offs, ii === 0 ? offs : ii === 1 ? -u : ii === 2 ? -offs : u);
          }
          pp = place(0, off + 0.012);
          F.S.push({ x: pp[0], y: yc, z: pp[1], ry: ry, sx: usable, sy: fh * 0.58, sz: 0.05 });
          for (var sI = 0; sI < ns; sI++) {
            uu = -usable / 2 + (sI + 0.5) * step; pp = place(uu, off + 0.022);
            F.L[Math.floor(rnd() * WL)].push({ x: pp[0], y: yc, z: pp[1], ry: ry, sx: step * 0.8, sy: fh * 0.4, sz: 0.05 });
          }
        }
        F.E.push({ x: cx, y: y0 + f * fh, z: cz, ry: yaw, sx: w + 0.1, sy: 0.07, sz: d + 0.1 });
      }
      F.E.push({ x: cx, y: y0 + floors * fh, z: cz, ry: yaw, sx: w + 0.16, sy: 0.12, sz: d + 0.16 });
      if (o.cols !== false) [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(function (cc) {
        var p2 = wp(cc[0] * w / 2, cc[1] * d / 2);
        F.C.push({ x: p2[0], y: y0 + floors * fh / 2, z: p2[1], ry: yaw, sx: 0.2, sy: floors * fh, sz: 0.2 });
      });
    };
    F.bake = function () {
      var m0 = boxField(UB, mats.strip, F.S); g.add(m0);
      g.add(boxField(UB, mats.conc, F.E));
      g.add(boxField(UB, mats.trim, F.C));
      for (var l = 0; l < WL; l++) { var m1 = boxField(UB, l % 2 ? mats.winC : mats.winW, F.L[l]); g.add(m1); winMeshes[l].push(m1); }
    };
    return F;
  }
  function glassDome(g, r, x, y, z, wseg, hseg) {
    var geo = new THREE.SphereGeometry(r, wseg || 14, hseg || 6, 0, TAU, 0, P / 2);
    var m = add(g, geo, mats.glassG, x, y, z);
    var ed = new THREE.LineSegments(new THREE.EdgesGeometry(geo, 1), mats.lineE); ed.position.set(x, y, z); g.add(ed); edgesL.push(ed);
    return m;
  }
  function member(px, pz) {
    var g = new THREE.Group(); group.add(g); g.position.set(px, 0, pz); g.rotation.y = Math.atan2(-px, -pz);
    box(g, 6.2, 0.14, 6.2, mats.concD, 0, SLAB + 0.07, 0, 0.02);
    box(g, 6.0, 0.03, 6.0, mats.conc, 0, SLAB + 0.15, 0, 0.01);
    return g;
  }
  var BY = SLAB + 0.15;

  /* ---------- Losa 28 x 28, plaza, caminos (sin vallas) ---------- */
  add(group, roundedBox(SZ, SLAB, SZ, 0.1, 3), mats.slab, 0, SLAB / 2, 0);
  add(group, new THREE.CylinderGeometry(7.2, 7.2, 0.06, 64), mats.plaza, 0, SLAB + 0.03, 0);
  [5.8, 7.0].forEach(function (r) { add(group, new THREE.RingGeometry(r, r + 0.07, 64).rotateX(-P / 2), mats.accent, 0, SLAB + 0.07, 0); });
  box(group, 3.0, 0.05, 8.4, mats.road, 0, SLAB + 0.025, 10.4, 0.01);
  var dash = [];
  for (k = 0; k < 12; k++) dash.push({ x: 0, y: SLAB + 0.06, z: 6.7 + k * 0.62, sx: 0.08, sy: 0.015, sz: 0.34 });
  group.add(boxField(UB, mats.winW, dash));
  var seamL = [];
  for (k = -3; k <= 3; k++) { seamL.push({ x: k * 4, y: SLAB + 0.01, z: 0, sx: 0.04, sy: 0.02, sz: SZ }); seamL.push({ x: 0, y: SLAB + 0.01, z: k * 4, sx: SZ, sy: 0.02, sz: 0.04 }); }
  group.add(boxField(UB, mats.dark, seamL));
  var stains = [];
  for (k = 0; k < 26; k++) stains.push({ x: (rnd() - 0.5) * 26, y: SLAB + 0.012, z: (rnd() - 0.5) * 26, ry: rnd() * 3, sx: 0.5 + rnd() * 1.6, sy: 0.01, sz: 0.4 + rnd() * 1.1 });
  group.add(boxField(UB, mats.trim, stains));
  var PM = [];
  for (k = 0; k < 5; k++) { var pa0 = (-90 + k * 72) * P / 180; PM.push([Math.cos(pa0) * 9.6, Math.sin(pa0) * 9.6]); }
  // camino a cada torre
  PM.forEach(function (p) {
    var len = 4.2, a0 = Math.atan2(p[1], p[0]), mx = Math.cos(a0) * 7.0, mz = Math.sin(a0) * 7.0;
    var rd = box(group, 1.6, 0.045, len, mats.road, mx * 0.85, SLAB + 0.025, mz * 0.85, 0.01); rd.position.set(Math.cos(a0) * 5.9, SLAB + 0.03, Math.sin(a0) * 5.9); rd.rotation.y = P / 2 - a0;
  });
  var colorPad = [];

  /* ---------- Torre central de mando: podio, tres cuerpos girados, corona y aguja ---------- */
  var C0 = new THREE.Group(); group.add(C0);
  var FC = mkFacade(C0);
  var PH = 2.4, TA_Y = SLAB + PH;
  box(C0, 9.0, PH, 9.0, mats.conc, 0, SLAB + PH / 2, 0, 0.05);
  FC.tier(0, 0, 0, 9.0, 9.0, SLAB, 2, 1.2, { seg: 0.6, margin: 0.6 });
  // columnata y acceso frontal
  for (k = 0; k < 9; k++) cylP(C0, 0.16, 0.16, PH, 10, mats.panel, -3.6 + k * 0.9, SLAB + PH / 2, 5.05);
  box(C0, 8.6, 0.18, 1.4, mats.panel, 0, SLAB + PH + 0.02, 4.85, 0.02);
  for (k = 0; k < 5; k++) box(C0, 3.2 + k * 0.15, 0.1, 0.4, mats.concD, 0, SLAB + 0.05 + (4 - k) * 0.08, 4.7 + k * 0.28, 0.01);
  box(C0, 3.0, 1.5, 0.1, mats.glass, 0, SLAB + 0.85, 4.52, 0.02);
  add(C0, new THREE.BoxGeometry(2.6, 0.12, 0.06), mats.eC, 0, SLAB + 1.7, 4.58);
  box(C0, 9.3, 0.1, 9.3, mats.accent, 0, SLAB + PH + 0.0, 0, 0.01);
  // cuerpo A
  var A_H = 6.0, A_Y = TA_Y;
  box(C0, 6.4, A_H, 6.4, mats.panel, 0, A_Y + A_H / 2, 0, 0.1);
  FC.tier(0, 0, 0, 6.4, 6.4, A_Y, 6, 1.0, { seg: 0.5, margin: 0.35 });
  [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (d, n) {          // contrafuertes
    var bx = d[0] * 3.3, bz = d[1] * 3.3;
    box(C0, d[0] ? 0.4 : 0.8, A_H - 0.4, d[0] ? 0.8 : 0.4, mats.conc, bx, A_Y + A_H / 2 - 0.2, bz, 0.05);
    add(C0, new THREE.BoxGeometry(d[0] ? 0.04 : 0.1, A_H - 1.0, d[0] ? 0.1 : 0.04), mats.eC, d[0] * 3.52, A_Y + A_H / 2 - 0.2, d[1] * 3.52);
  });
  // ascensor exterior
  box(C0, 0.5, A_H, 0.5, mats.trim, 3.6, A_Y + A_H / 2, 1.8, 0.04);
  var elev = box(C0, 0.55, 0.7, 0.55, mats.glass, 3.6, A_Y + 0.5, 2.2, 0.06);
  var elev2 = add(C0, new THREE.BoxGeometry(0.4, 0.06, 0.4), mats.eC, 3.6, A_Y + 0.9, 2.2);
  strutIn(C0, [3.6, A_Y, 2.2], [3.6, A_Y + A_H, 2.2], 0.035, mats.trim);
  // cuerpo B (girado) y C (girado más)
  var B_Y = A_Y + A_H, B_H = 6.0;
  box(C0, 4.6, B_H, 4.6, mats.panel, 0, B_Y + B_H / 2, 0, 0.1).rotation.y = 0.52;
  FC.tier(0, 0, 0.52, 4.6, 4.6, B_Y, 6, 1.0, { seg: 0.5, margin: 0.3 });
  box(C0, 6.0, 0.3, 6.0, mats.conc, 0, B_Y - 0.05, 0, 0.03);
  var C_Y = B_Y + B_H, C_H = 3.0;
  box(C0, 3.2, C_H, 3.2, mats.panel, 0, C_Y + C_H / 2, 0, 0.1).rotation.y = 1.04;
  FC.tier(0, 0, 1.04, 3.2, 3.2, C_Y, 3, 1.0, { seg: 0.45, margin: 0.25 });
  // corona: anillo mirador y cúpula
  var TOP = C_Y + C_H;
  box(C0, 4.2, 0.16, 4.2, mats.conc, 0, TOP + 0.02, 0, 0.03).rotation.y = 1.04;
  add(C0, new THREE.CylinderGeometry(1.35, 1.5, 0.6, 24, 1, true), mats.glass, 0, TOP + 0.4, 0);
  add(C0, new THREE.CylinderGeometry(1.5, 1.5, 0.06, 24), mats.accent, 0, TOP + 0.7, 0);
  add(C0, new THREE.SphereGeometry(1.2, 24, 10, 0, TAU, 0, P / 2), mats.glassD, 0, TOP + 0.7, 0);
  // aguja con antenas y parábolas
  cylP(C0, 0.04, 0.2, 6.0, 12, mats.hull2, 0, TOP + 3.9, 0);
  [[1.4, 0.7], [2.4, 0.55], [3.4, 0.4], [4.4, 0.3]].forEach(function (d, n) {
    box(C0, d[1] * 2, 0.05, 0.05, mats.trim, 0, TOP + 1.8 + d[0], 0, 0.01).rotation.y = n * 0.8;
    box(C0, 0.05, 0.05, d[1] * 2, mats.trim, 0, TOP + 1.8 + d[0], 0, 0.01).rotation.y = n * 0.8;
  });
  var dishes = [];
  [[0.7, 0.4, 0.0], [-0.7, 0.4, 0.0], [0, 0.4, 0.7]].forEach(function (d, n) {
    var dg = new THREE.Group(); C0.add(dg); dg.position.set(d[0] * 1.2, TOP + 2.4 + n * 0.9, d[2] * 1.2);
    var ds = add(dg, new THREE.SphereGeometry(0.42, 16, 8, 0, TAU, 0, P / 2.3), mats.panel, 0, 0.25, 0); ds.rotation.x = P * 0.35;
    cylP(dg, 0.03, 0.03, 0.3, 6, mats.trim, 0, 0.1, 0);
    add(dg, new THREE.SphereGeometry(0.05, 8, 6), mats.trim, 0, 0.45, 0.16);
    dishes.push(dg);
  });
  var mastTop = add(C0, new THREE.SphereGeometry(0.16, 12, 10), mats.status, 0, TOP + 7.0, 0);
  var mastHalo = add(C0, new THREE.SphereGeometry(0.42, 12, 10), glowMat(0x7dffb0, 0.3), 0, TOP + 7.0, 0);
  // halo holográfico alrededor del cuerpo B
  var halo1 = add(C0, new THREE.TorusGeometry(3.7, 0.025, 6, 80).rotateX(P / 2), glowMat(colors.glow, 0.55), 0, B_Y + 3.0, 0);
  var halo2 = add(C0, new THREE.TorusGeometry(3.3, 0.02, 6, 80).rotateX(P / 2), glowMat(colors.glow, 0.4), 0, B_Y + 3.6, 0);
  var uplight = add(C0, new THREE.RingGeometry(4.9, 5.3, 56).rotateX(-P / 2), glowMat(colors.glow, 0.3), 0, SLAB + 0.08, 0);
  roofGreeble(C0, 0, A_Y + A_H + 0.05, 0, 6.2, 6.2, 0, mats.concD);
  roofGreeble(C0, 0, TA_Y, 0, 8.6, 8.6, 0, mats.concD);
  // equipos en el techo del cuerpo A (anillo exterior libre) y de B
  [[2.5, 2.5], [-2.5, 2.5], [2.5, -2.5], [-2.5, -2.5]].forEach(function (p, n) {
    cylP(C0, 0.28, 0.28, 0.35, 10, mats.hull2, p[0], A_Y + A_H + 0.2, p[1]);
    add(C0, new THREE.CylinderGeometry(0.25, 0.25, 0.04, 10), mats.dark, p[0], A_Y + A_H + 0.4, p[1]);
    light(C0, p[0], A_Y + A_H + 0.5, p[1], mats.red, 0.05, 1.5 + n * 0.2);
  });
  FC.bake();
  anims.push(function (S) {
    dishes.forEach(function (dg, n) { if (S.alive) dg.rotation.y += S.dt * (0.5 + n * 0.2) * (n % 2 ? -1 : 1); });
    var ph = (S.t / 7) % 2; ph = ph > 1 ? 2 - ph : ph;
    elev.position.y = A_Y + 0.5 + sstep(ph) * (A_H - 1.0); elev2.position.y = elev.position.y + 0.4; elev.visible = elev2.visible = true;
    halo1.visible = halo2.visible = S.on && !S.ghost; halo1.rotation.y += S.alive ? S.dt * 0.2 : 0; halo2.rotation.y -= S.alive ? S.dt * 0.15 : 0;
    halo1.material.opacity = 0.4 + 0.2 * Math.sin(S.t * 1.7);
    uplight.visible = S.on && !S.ghost; uplight.material.opacity = 0.2 + 0.12 * Math.sin(S.t * 1.5);
  });
  function beacon(g, x, y, z, ph) {
    var bg = new THREE.Group(); g.add(bg); bg.position.set(x, y, z);
    add(bg, new THREE.CylinderGeometry(0.09, 0.11, 0.18, 10), mats.dark, 0, -0.09, 0);
    add(bg, new THREE.SphereGeometry(0.09, 10, 8), mats.red, 0, 0.04, 0);
    var cone = new THREE.ConeGeometry(0.5, 3.0, 14, 1, true); cone.translate(0, -1.5, 0); cone.rotateZ(P / 2);
    add(bg, cone, mats.beam, 0, 0.04, 0);
    bg.visible = false; beacons.push({ g: bg, ph: ph || 0 });
  }
  var puffsAll = [];
  function puffs(g, x, y, z, n, rise, color) {
    var arr = [];
    for (var a = 0; a < n; a++) { var pf = add(g, new THREE.SphereGeometry(0.16, 8, 6), glowMat(color || 0xe9eef5, 0), x, y, z); pf.visible = false; arr.push({ m: pf, ph: a / n }); }
    puffsAll.push({ arr: arr, x: x, y: y, z: z, rise: rise });
  }

  /* ---------- Torre de investigación (laboratorio, observatorio, reactor de pruebas) ---------- */
  var gR = member(PM[4][0], PM[4][1]), FR = mkFacade(gR);
  box(gR, 5.0, 3.0, 2.8, mats.panel, 0, BY + 1.5, -1.3, 0.06);
  FR.tier(0, -1.3, 0, 5.0, 2.8, BY, 3, 1.0, { seg: 0.45, margin: 0.3 });
  box(gR, 4.2, 2.0, 1.8, mats.panel, -0.4, BY + 1.0, 1.0, 0.05);
  FR.tier(-0.4, 1.0, 0, 4.2, 1.8, BY, 2, 1.0, { seg: 0.5, margin: 0.3 });
  box(gR, 2.2, 0.12, 0.9, mats.conc, -0.4, BY + 1.95, 2.35, 0.02);
  [-1.3, 0.5].forEach(function (xx) { cylP(gR, 0.07, 0.07, 1.95, 8, mats.hull2, xx, BY + 0.97, 2.7); });
  box(gR, 1.7, 1.5, 0.08, mats.glass, -0.4, BY + 0.78, 1.93, 0.02);
  add(gR, new THREE.BoxGeometry(5.0, 0.05, 0.05), mats.eR, 0, BY + 2.92, 0.14);
  add(gR, new THREE.BoxGeometry(4.2, 0.05, 0.05), mats.eR, -0.4, BY + 1.92, 1.92);
  // observatorio
  cylP(gR, 0.9, 0.95, 0.5, 14, mats.conc, 1.4, BY + 3.25, -1.3);
  var domeR = new THREE.Group(); gR.add(domeR); domeR.position.set(1.4, BY + 3.5, -1.3);
  add(domeR, new THREE.SphereGeometry(0.88, 22, 10, 0, TAU, 0, P / 2), mats.panel, 0, 0, 0);
  add(domeR, new THREE.BoxGeometry(0.34, 0.03, 1.3), mats.dark, 0, 0.82, -0.3).rotation.x = -0.8;
  var tele = add(domeR, new THREE.CylinderGeometry(0.1, 0.13, 1.0, 10), mats.hull2, 0, 0.7, -0.62); tele.rotation.x = P / 2 - 0.65;
  add(domeR, new THREE.TorusGeometry(0.88, 0.03, 6, 22).rotateX(P / 2), mats.acR, 0, 0.01, 0);
  // radiotelescopio
  cylP(gR, 0.12, 0.2, 0.9, 8, mats.hull2, -1.5, BY + 3.45, -1.9);
  var dishR = new THREE.Group(); gR.add(dishR); dishR.position.set(-1.5, BY + 3.95, -1.9);
  var dsh = add(dishR, new THREE.SphereGeometry(1.0, 20, 8, 0, TAU, 0, P / 2.8), mats.panel, 0, 0.3, 0); dsh.rotation.x = P * 0.2 + P / 2 * 0; dsh.rotation.x = P * 0.28;
  strutIn(dishR, [0.5, 0.3, 0.0], [0, 0.9, 0.5], 0.02, mats.trim); strutIn(dishR, [-0.5, 0.3, 0.0], [0, 0.9, 0.5], 0.02, mats.trim);
  add(dishR, new THREE.SphereGeometry(0.06, 8, 6), mats.eR, 0, 0.9, 0.5);
  // contención del reactor de pruebas
  cylP(gR, 0.58, 0.62, 2.3, 14, mats.concD, 2.2, BY + 1.15, 1.2);
  add(gR, new THREE.SphereGeometry(0.58, 14, 7, 0, TAU, 0, P / 2), mats.concD, 2.2, BY + 2.3, 1.2);
  var rRings = [];
  for (k = 0; k < 3; k++) rRings.push(add(gR, new THREE.TorusGeometry(0.62, 0.05, 6, 20).rotateX(P / 2), mats.eR, 2.2, BY + 0.5 + k * 0.6, 1.2));
  cylP(gR, 0.04, 0.04, 0.7, 6, mats.trim, 2.2, BY + 2.95, 1.2);
  light(gR, 2.2, BY + 3.35, 1.2, mats.red, 0.06, 1.3);
  puffs(gR, 2.45, BY + 2.35, 1.2, 4, 1.6);
  // mástil con radar
  cylP(gR, 0.05, 0.08, 1.8, 8, mats.trim, 0.0, BY + 3.9, -2.2);
  var radarR = new THREE.Group(); gR.add(radarR); radarR.position.set(0.0, BY + 4.85, -2.2);
  box(radarR, 1.1, 0.16, 0.06, mats.panel, 0, 0, 0, 0.02); add(radarR, new THREE.BoxGeometry(0.1, 0.16, 0.2), mats.trim, 0, 0, 0);
  roofGreeble(gR, 0, BY + 3.0, -1.3, 5.0, 2.8, 9, mats.concD);
  roofGreeble(gR, -0.4, BY + 2.0, 1.0, 4.2, 1.8, 5, mats.concD);
  beacon(gR, -2.2, BY + 3.1, -0.4, 0.3);
  FR.bake();
  anims.push(function (S) {
    if (S.alive) { domeR.rotation.y += S.dt * 0.25; dishR.rotation.y = 0.9 * Math.sin(S.t * 0.2); radarR.rotation.y += S.dt * 1.6; }
    rRings.forEach(function (r, n) { r.visible = S.on; r.scale.set(1 + 0.04 * Math.sin(S.t * 3 + n), 1, 1 + 0.04 * Math.sin(S.t * 3 + n)); });
    mats.eR.color.setHex(S.mode === 'alert' ? 0xff8a6a : S.on ? 0x35d0ff : 0x1a4650);
  });

  /* ---------- Torre de víveres (invernadero hidropónico, silos, depósitos) ---------- */
  var gG = member(PM[3][0], PM[3][1]);
  glassDome(gG, 2.0, 0, BY, -0.7, 14, 6);
  cylP(gG, 2.02, 2.06, 0.28, 28, mats.conc, 0, BY + 0.14, -0.7);
  add(gG, new THREE.TorusGeometry(2.03, 0.05, 6, 40).rotateX(P / 2), mats.acG, 0, BY + 0.3, -0.7);
  // terrazas interiores
  cylP(gG, 1.6, 1.7, 0.3, 24, mats.soil, 0, BY + 0.42, -0.7);
  cylP(gG, 1.58, 1.58, 0.04, 24, mats.grass, 0, BY + 0.58, -0.7);
  cylP(gG, 1.0, 1.1, 0.3, 20, mats.soil, 0, BY + 0.72, -0.7);
  cylP(gG, 0.98, 0.98, 0.04, 20, mats.grass, 0, BY + 0.88, -0.7);
  cylP(gG, 0.06, 0.1, 1.2, 8, mats.bark, 0, BY + 1.4, -0.7);
  add(gG, new THREE.SphereGeometry(0.55, 12, 8), mats.leaf, 0, BY + 2.0, -0.7).scale.set(1, 0.8, 1);
  var plantsL = [], plantsB = [];
  for (k = 0; k < 46; k++) {
    var pa = rnd() * TAU, pr = k < 26 ? 1.15 + rnd() * 0.4 : 0.3 + rnd() * 0.6, py = k < 26 ? BY + 0.62 : BY + 0.92, ps = 0.1 + rnd() * 0.09;
    plantsL.push({ x: Math.cos(pa) * pr, y: py + ps * 0.6, z: -0.7 + Math.sin(pa) * pr, sx: ps * 2, sy: ps * 1.6, sz: ps * 2 });
  }
  gG.add(boxField(new THREE.SphereGeometry(0.5, 7, 5), mats.leaf3, plantsL));
  var growD = add(gG, new THREE.TorusGeometry(1.2, 0.035, 6, 32).rotateX(P / 2), mats.eG, 0, BY + 1.7, -0.7);
  add(gG, new THREE.TorusGeometry(0.6, 0.03, 6, 24).rotateX(P / 2), mats.eG, 0, BY + 1.5, -0.7);
  // turbina de ventilación en la cima
  var vent = new THREE.Group(); gG.add(vent); vent.position.set(0, BY + 2.05, -0.7);
  add(vent, new THREE.SphereGeometry(0.22, 12, 8), mats.hull2, 0, 0.22, 0);
  for (k = 0; k < 8; k++) { var vb = add(vent, new THREE.BoxGeometry(0.02, 0.28, 0.12), mats.hull2, 0, 0.22, 0); vb.rotation.y = k * P / 4; vb.position.set(Math.cos(k * P / 4) * 0.2, 0.22, Math.sin(k * P / 4) * 0.2); }
  // nave de cultivo en bóveda (frente)
  var vgeo = new THREE.CylinderGeometry(1.0, 1.0, 5.0, 18, 1, true, 0, P); vgeo.rotateZ(P / 2);
  add(gG, vgeo, mats.glassG, 0, BY + 0.45, 1.95);
  var ved = new THREE.LineSegments(new THREE.EdgesGeometry(vgeo, 1), mats.lineE); ved.position.set(0, BY + 0.45, 1.95); gG.add(ved); edgesL.push(ved);
  for (k = 0; k < 7; k++) add(gG, new THREE.TorusGeometry(1.0, 0.035, 6, 18, P).rotateY(P / 2), mats.hull2, -2.4 + k * 0.8, BY + 0.45, 1.95);
  box(gG, 5.0, 0.45, 2.1, mats.conc, 0, BY + 0.22, 1.95, 0.03);
  box(gG, 5.1, 0.05, 0.05, mats.acG, 0, BY + 0.46, 3.0, 0.01);
  var rowsL = [], plantsV = [];
  for (j = 0; j < 4; j++) {
    var rz = 1.35 + j * 0.42;
    rowsL.push({ x: 0, y: BY + 0.5, z: rz, sx: 4.4, sy: 0.12, sz: 0.28 });
    for (k = 0; k < 14; k++) plantsV.push({ x: -2.0 + k * 0.31, y: BY + 0.68, z: rz, sx: 0.2, sy: 0.22, sz: 0.2 });
  }
  gG.add(boxField(UB, mats.soil, rowsL));
  gG.add(boxField(new THREE.SphereGeometry(0.5, 7, 5), mats.leaf3, plantsV));
  var growV = [];
  for (j = 0; j < 3; j++) growV.push({ x: 0, y: BY + 1.25, z: 1.55 + j * 0.45, sx: 4.4, sy: 0.04, sz: 0.06 });
  var growM = boxField(UB, mats.eG, growV); gG.add(growM);
  box(gG, 0.9, 1.0, 0.1, mats.glass, -0.9, BY + 0.5, 3.06, 0.02);
  // silos, depósitos y tuberías
  [-2.35, 2.35].forEach(function (xx) {
    cylP(gG, 0.42, 0.42, 2.6, 16, mats.metalC, xx, BY + 1.3, -2.3);
    add(gG, new THREE.ConeGeometry(0.46, 0.5, 16), mats.panel, xx, BY + 2.85, -2.3);
    for (k = 0; k < 4; k++) add(gG, new THREE.TorusGeometry(0.43, 0.02, 6, 16).rotateX(P / 2), mats.hull2, xx, BY + 0.5 + k * 0.6, -2.3);
    strutIn(gG, [xx + 0.45, BY, -2.3], [xx + 0.45, BY + 2.4, -2.3], 0.02, mats.trim);
  });
  [-2.55, 2.55].forEach(function (xx) {
    cylP(gG, 0.4, 0.4, 1.3, 14, mats.panel, xx, BY + 0.65, 0.4);
    add(gG, new THREE.TorusGeometry(0.41, 0.03, 6, 14).rotateX(P / 2), mats.acG, xx, BY + 1.0, 0.4);
    add(gG, new THREE.SphereGeometry(0.4, 12, 6, 0, TAU, 0, P / 2), mats.panel, xx, BY + 1.3, 0.4);
  });
  pipeRun([[-2.15, BY + 0.35, 0.4], [-1.9, BY + 0.35, 0.9], [-1.9, BY + 0.35, 1.3]], 0.06, mats.pipe);
  pipeRun([[2.15, BY + 0.35, 0.4], [1.9, BY + 0.35, 0.9], [1.9, BY + 0.35, 1.3]], 0.06, mats.pipe);
  pipeRun([[-2.35, BY + 0.3, -1.9], [-2.2, BY + 0.3, -0.9]], 0.05, mats.pipe);
  puffs(gG, 0.0, BY + 1.4, -0.7, 5, 1.2, 0xdff5ff);
  beacon(gG, 2.35, BY + 3.15, -2.3, 0.6);
  anims.push(function (S) {
    if (S.alive) vent.rotation.y += S.dt * 3;
    var pulse = 0.65 + 0.35 * Math.sin(S.t * 1.2);
    mats.eG.color.setHex(S.on ? (pulse > 0.7 ? 0xff5fe0 : 0xe84fc8) : 0x401a38);
  });
  function vehicle(g, x, z, ry, bodyMat, len, lights) {
    var v = new THREE.Group(); g.add(v); v.position.set(x, BY, z); v.rotation.y = ry || 0;
    box(v, 0.5, 0.34, len, bodyMat, 0, 0.3, 0, 0.05);
    box(v, 0.48, 0.3, 0.38, bodyMat, 0, 0.28, -len / 2 - 0.12, 0.05);
    add(v, new THREE.BoxGeometry(0.44, 0.14, 0.05), mats.glass, 0, 0.36, -len / 2 - 0.28);
    for (var a = 0; a < 4; a++) add(v, new THREE.CylinderGeometry(0.1, 0.1, 0.08, 10).rotateZ(P / 2), mats.dark, a % 2 ? 0.26 : -0.26, 0.1, a < 2 ? -len * 0.32 - 0.1 : len * 0.3);
    var lb = null;
    if (lights) { lb = [add(v, new THREE.BoxGeometry(0.14, 0.05, 0.08), mats.eH, -0.12, 0.5, 0.0), add(v, new THREE.BoxGeometry(0.14, 0.05, 0.08), mats.eC, 0.12, 0.5, 0.0)]; box(v, 0.5, 0.05, len * 0.9, mats.acH, 0, 0.36, 0, 0.01).scale.set(1.02, 1, 1); }
    return { g: v, lb: lb };
  }

  /* ---------- Torre hospital (planta en cruz, helipuerto, cruz roja, ambulancias) ---------- */
  var gH = member(PM[2][0], PM[2][1]), FH = mkFacade(gH);
  box(gH, 5.2, 4.0, 1.8, mats.panel, 0, BY + 2.0, -0.2, 0.05);
  FH.tier(0, -0.2, 0, 5.2, 1.8, BY, 4, 1.0, { seg: 0.5, margin: 0.3 });
  box(gH, 1.8, 4.0, 5.0, mats.panel, 0, BY + 2.0, -0.1, 0.05);
  FH.tier(0, -0.1, 0, 1.8, 5.0, BY, 4, 1.0, { seg: 0.5, margin: 0.3, cols: false });
  box(gH, 2.6, 6.0, 2.6, mats.panel, 0, BY + 3.0, -0.2, 0.06);
  FH.tier(0, -0.2, 0, 2.6, 2.6, BY, 6, 1.0, { seg: 0.45, margin: 0.28 });
  function plusSign(g, x, y, z, s, mat, ry) {
    var a = add(g, new THREE.BoxGeometry(s * 0.28, s, 0.06), mat, x, y, z), b = add(g, new THREE.BoxGeometry(s, s * 0.28, 0.06), mat, x, y, z);
    a.rotation.y = b.rotation.y = ry || 0; return [a, b];
  }
  plusSign(gH, 0, BY + 2.7, 2.43, 0.95, mats.eH);
  plusSign(gH, 0, BY + 5.0, 1.12, 0.8, mats.eH);
  add(gH, new THREE.BoxGeometry(5.2, 0.05, 0.05), mats.eH, 0, BY + 4.0, 0.72);
  add(gH, new THREE.BoxGeometry(1.8, 0.05, 0.05), mats.eH, 0, BY + 4.0, 2.42);
  // helipuerto
  box(gH, 3.0, 0.14, 3.0, mats.conc, 0, BY + 6.05, -0.2, 0.03);
  add(gH, new THREE.CylinderGeometry(1.15, 1.15, 0.04, 28), mats.dark, 0, BY + 6.15, -0.2);
  add(gH, new THREE.RingGeometry(1.0, 1.08, 28).rotateX(-P / 2), mats.window, 0, BY + 6.18, -0.2);
  [[-0.3, 0, 0.1, 0.8], [0.3, 0, 0.1, 0.8], [0, 0, 0.7, 0.1]].forEach(function (b) { add(gH, new THREE.BoxGeometry(b[2], 0.02, b[3]), mats.window, b[0], BY + 6.18, -0.2 + b[1]); });
  var heliL = [];
  for (k = 0; k < 10; k++) { var ha = k / 10 * TAU; heliL.push(add(gH, new THREE.SphereGeometry(0.06, 8, 6), mats.eH, Math.cos(ha) * 1.35, BY + 6.2, -0.2 + Math.sin(ha) * 1.35)); }
  // nave de rescate (lanzadera médica pequeña) posada en el helipuerto
  var heli = new THREE.Group(); gH.add(heli); heli.position.set(0, BY + 6.45, -0.2);
  add(heli, loft([{ z: -0.8, w: 0.04, t: 0.04, b: 0.04, n: 2.2 }, { z: -0.5, w: 0.2, t: 0.14, b: 0.1, n: 2.4 }, { z: 0.0, w: 0.34, t: 0.2, b: 0.14, n: 2.6 }, { z: 0.5, w: 0.3, t: 0.18, b: 0.13, n: 2.6 }, { z: 0.78, w: 0.2, t: 0.13, b: 0.1, n: 2.4 }], 18, true, true), mats.panel, 0, 0.2, 0);
  var hw = plan([[0, -0.15], [0.85, 0.35], [0.85, 0.62], [0, 0.68]], 0.05, 0); hw.translate(0, 0, -0.25);
  add(heli, hw, mats.panel, 0, 0.2, 0.25);
  add(heli, new THREE.SphereGeometry(0.17, 12, 8), mats.glass, 0, 0.36, -0.3).scale.set(0.9, 0.55, 1.5);
  box(heli, 0.08, 0.2, 0.34, mats.acH, 0, 0.42, 0.45, 0.01);
  add(heli, new THREE.BoxGeometry(0.46, 0.02, 0.3), mats.acH, 0, 0.27, 0.05);
  plusSign(heli, 0, 0.38, 0.0, 0.2, mats.eH, 0).forEach(function (m) { m.rotation.x = -P / 2; m.position.set(0, 0.405, 0.18); });
  [-0.12, 0.12].forEach(function (xx) {
    add(heli, new THREE.CylinderGeometry(0.07, 0.09, 0.2, 10).rotateX(P / 2), mats.dark, xx, 0.2, 0.82);
    add(heli, new THREE.CircleGeometry(0.06, 10), glowMat(colors.glow, 0.9), xx, 0.2, 0.93);
  });
  [[-0.2, -0.3], [0.2, -0.3], [0, 0.45]].forEach(function (l) { strutIn(heli, [l[0] * 0.5, 0.12, l[1]], [l[0], 0.0, l[1]], 0.02, mats.trim); box(heli, 0.1, 0.02, 0.1, mats.trim, l[0], 0.0, l[1], 0.005); });
  var heliGlow = add(heli, new THREE.CircleGeometry(0.5, 16).rotateX(-P / 2), glowMat(colors.glow, 0.0), 0, 0.01, 0.2);
  // zona de ambulancias y servicios
  box(gH, 2.4, 0.12, 1.1, mats.conc, 1.55, BY + 1.7, 2.95, 0.02);
  [1.0, 2.1].forEach(function (xx) { cylP(gH, 0.06, 0.06, 1.7, 8, mats.hull2, xx, BY + 0.85, 3.4); });
  add(gH, new THREE.BoxGeometry(2.4, 0.05, 0.05), mats.eH, 1.55, BY + 1.62, 3.5);
  var amb1 = vehicle(gH, 1.55, 2.95, P, mats.panel, 1.1, true), amb2 = vehicle(gH, -1.9, 2.8, P * 0.9, mats.panel, 1.1, true);
  box(gH, 0.9, 0.9, 0.08, mats.glass, -1.0, BY + 0.5, 2.46, 0.02);
  for (k = 0; k < 3; k++) { cylP(gH, 0.17, 0.17, 0.95, 12, mats.panel, 1.55 + k * 0.4 - 0.4, BY + 0.5, -2.4); add(gH, new THREE.TorusGeometry(0.175, 0.02, 6, 12).rotateX(P / 2), mats.acR, 1.55 + k * 0.4 - 0.4, BY + 0.7, -2.4); }
  box(gH, 1.0, 0.6, 0.7, mats.hull2, -1.9, BY + 0.3, -2.3, 0.04);
  roofGreeble(gH, 0, BY + 4.0, -0.2, 5.0, 1.6, 7, mats.concD);
  roofGreeble(gH, 0, BY + 4.0, -0.1, 1.6, 4.8, 6, mats.concD);
  beacon(gH, 2.3, BY + 4.1, -0.2, 0.9);
  FH.bake();
  anims.push(function (S) {
    heliL.forEach(function (l, n) { l.visible = S.on && ((Math.floor(S.t * 7) + n) % 10 < 5); });
    heliGlow.visible = S.alive; heliGlow.material.opacity = 0.25 + 0.15 * Math.sin(S.t * 3);
    [amb1, amb2].forEach(function (a, n) { var f = S.on && (Math.floor(S.t * 4 + n) % 2); a.lb[0].visible = !!f; a.lb[1].visible = S.on && !f; });
    mats.eH.color.setHex(S.on ? (0.7 + 0.3 * Math.sin(S.t * 3) > 0.8 ? 0xff5050 : 0xff3030) : 0x401010);
  });

  /* ---------- Torre de armamento (búnker blindado, silos de misiles, torretas, radar) ---------- */
  var gA = member(PM[1][0], PM[1][1]);
  var bs = new THREE.Shape(); bs.moveTo(-2.6, 0); bs.lineTo(2.6, 0); bs.lineTo(1.9, 2.6); bs.lineTo(-1.9, 2.6); bs.closePath();
  var bgeo = new THREE.ExtrudeGeometry(bs, { depth: 3.4, bevelEnabled: false }); bgeo.translate(0, 0, -2.7);
  add(gA, bgeo, mats.milA, 0, BY, 0);
  box(gA, 3.9, 0.16, 3.5, mats.milB, 0, BY + 2.62, -1.0, 0.03);
  box(gA, 4.1, 0.1, 0.1, mats.acW, 0, BY + 0.1, 0.72, 0.01);
  var slits = [], rivets = [];
  for (k = -2; k <= 2; k++) slits.push({ x: k * 0.9, y: BY + 1.9, z: 0.72, sx: 0.5, sy: 0.07, sz: 0.04 });
  for (k = 0; k < 24; k++) for (j = 0; j < 4; j++) rivets.push({ x: -2.3 + k * 0.2, y: BY + 0.35 + j * 0.5, z: 0.7, sx: 0.04, sy: 0.04, sz: 0.04 });
  gA.add(boxField(UB, mats.eW, slits)); gA.add(boxField(UB, mats.trim, rivets));
  box(gA, 1.5, 1.6, 0.12, mats.dark, 0, BY + 0.8, 0.74, 0.03);
  var hzA = [], hzB = [];
  for (k = 0; k < 8; k++) (k % 2 ? hzA : hzB).push({ x: -0.7 + k * 0.2, y: BY + 0.8, z: 0.81, sx: 0.1, sy: 1.6, sz: 0.03 });
  gA.add(boxField(UB, mats.hazY, hzA)); gA.add(boxField(UB, mats.hazK, hzB));
  add(gA, new THREE.BoxGeometry(0.5, 0.1, 0.06), mats.eW, 0, BY + 1.75, 0.82);
  // paneles inclinados con nervios
  var ribs = [];
  for (k = 0; k < 5; k++) { ribs.push({ x: -2.0 + k * 1.0, y: BY + 2.6, z: -1.0, sx: 0.06, sy: 0.06, sz: 3.45 }); }
  gA.add(boxField(UB, mats.trim, ribs));
  // torretas antiaéreas
  var turrets = [];
  [[-1.1, -0.2], [1.1, -1.6]].forEach(function (p, n) {
    cylP(gA, 0.38, 0.45, 0.25, 12, mats.milB, p[0], BY + 2.82, p[1]);
    var tg = new THREE.Group(); gA.add(tg); tg.position.set(p[0], BY + 3.1, p[1]);
    box(tg, 0.55, 0.3, 0.6, mats.milA, 0, 0, 0, 0.05);
    var pv = new THREE.Group(); tg.add(pv); pv.position.set(0, 0.05, -0.2);
    [-0.12, 0.12].forEach(function (xx) { add(pv, new THREE.CylinderGeometry(0.04, 0.045, 1.0, 8).rotateX(P / 2), mats.dark, xx, 0, -0.5); add(pv, new THREE.CylinderGeometry(0.06, 0.06, 0.12, 8).rotateX(P / 2), mats.trim, xx, 0, -1.0); });
    add(tg, new THREE.SphereGeometry(0.06, 8, 6), mats.eW, 0, 0.18, -0.3);
    turrets.push({ g: tg, pv: pv, ph: n * 2.3 });
  });
  // radar y reflector
  cylP(gA, 0.07, 0.1, 1.0, 8, mats.trim, 0.0, BY + 3.2, -2.1);
  var radA = new THREE.Group(); gA.add(radA); radA.position.set(0, BY + 3.85, -2.1);
  box(radA, 1.2, 0.8, 0.08, mats.milA, 0, 0.05, 0, 0.02).rotation.x = -0.2;
  add(radA, new THREE.BoxGeometry(1.0, 0.6, 0.02), mats.eW, 0, 0.05, 0.05).rotation.x = -0.2;
  // torre de reflector
  cylP(gA, 0.06, 0.1, 2.8, 8, mats.trim, -2.4, BY + 1.4, 1.2);
  var sl = new THREE.Group(); gA.add(sl); sl.position.set(-2.4, BY + 2.9, 1.2);
  add(sl, new THREE.CylinderGeometry(0.16, 0.2, 0.34, 12).rotateX(P / 2), mats.dark, 0, 0, 0);
  add(sl, new THREE.CircleGeometry(0.15, 12), mats.winW, 0, 0, -0.18).rotation.y = P;
  var slc = new THREE.ConeGeometry(0.9, 4.0, 16, 1, true); slc.translate(0, -2.0, 0); slc.rotateX(P / 2);
  var slBeam = add(sl, slc, mats.sweep, 0, 0, -0.1);
  // silos de misiles
  var silos = [];
  [-1.6, 0, 1.6].forEach(function (xx, n) {
    var sz2 = 1.95;
    add(gA, new THREE.CylinderGeometry(0.5, 0.5, 0.05, 20), mats.dark, xx, BY + 0.03, sz2);
    add(gA, new THREE.TorusGeometry(0.55, 0.06, 6, 20).rotateX(P / 2), mats.concD, xx, BY + 0.05, sz2);
    add(gA, new THREE.RingGeometry(0.62, 0.78, 20).rotateX(-P / 2), mats.hazY, xx, BY + 0.025, sz2);
    var dL = add(gA, new THREE.CylinderGeometry(0.5, 0.5, 0.07, 18, 1, false, 0, P), mats.milB, xx, BY + 0.09, sz2);
    var dR = add(gA, new THREE.CylinderGeometry(0.5, 0.5, 0.07, 18, 1, false, 0, P), mats.milB, xx, BY + 0.09, sz2); dR.rotation.y = P;
    var ms = new THREE.Group(); gA.add(ms); ms.position.set(xx, BY - 1.4, sz2);
    add(ms, new THREE.CylinderGeometry(0.16, 0.16, 1.3, 12), mats.panel, 0, 0.65, 0);
    add(ms, new THREE.ConeGeometry(0.16, 0.5, 12), mats.acW, 0, 1.55, 0);
    for (k = 0; k < 4; k++) { var fn = add(ms, new THREE.BoxGeometry(0.02, 0.35, 0.2), mats.milA, 0, 0.2, 0); fn.rotation.y = k * P / 2; fn.position.set(Math.cos(k * P / 2) * 0.17, 0.2, Math.sin(k * P / 2) * 0.17); }
    silos.push({ dL: dL, dR: dR, ms: ms, x: xx, off: n * 5.2 });
  });
  // defensas: barreras, sacos de arena, rayas de peligro
  var jers = [], sandbags = [], hz2 = [], hz3 = [];
  for (k = 0; k < 9; k++) { jers.push({ x: -2.5 + k * 0.62, y: BY + 0.2, z: 2.95, sx: 0.5, sy: 0.4, sz: 0.24 }); }
  for (k = 0; k < 16; k++) (k % 2 ? hz2 : hz3).push({ x: -2.8 + k * 0.37, y: BY + 0.01, z: 2.7, sx: 0.37, sy: 0.015, sz: 0.1 });
  [-2.7, 2.7].forEach(function (xx) { for (k = 0; k < 8; k++) sandbags.push({ x: xx + (k % 4 - 1.5) * 0.22, y: BY + 0.08 + Math.floor(k / 4) * 0.14, z: 1.0 + ((k * 3) % 2) * 0.05, ry: rnd() * 0.5, sx: 0.28, sy: 0.15, sz: 0.2 }); });
  gA.add(boxField(UB, mats.concD, jers)); gA.add(boxField(new THREE.SphereGeometry(0.5, 7, 5), mats.milB, sandbags));
  gA.add(boxField(UB, mats.hazY, hz2)); gA.add(boxField(UB, mats.hazK, hz3));
  roofGreeble(gA, 0, BY + 2.7, -1.0, 3.6, 3.2, 7, mats.milA);
  beacon(gA, 1.7, BY + 2.75, -2.3, 1.4);
  anims.push(function (S) {
    turrets.forEach(function (T) {
      if (S.alive) {
        var tt = S.t * 0.5 + T.ph; T.g.rotation.y = Math.sin(tt) * 1.2 + Math.sin(tt * 2.3) * 0.2; T.pv.rotation.x = -0.35 - 0.3 * (0.5 + 0.5 * Math.sin(tt * 1.7));
      }
    });
    if (S.alive) { radA.rotation.y += S.dt * 0.9; sl.rotation.y = Math.sin(S.t * 0.4) * 1.6; sl.rotation.x = 0.35 + 0.15 * Math.sin(S.t * 0.8); }
    slBeam.visible = S.alive;
    silos.forEach(function (s) {
      var p = S.alive ? ((S.t + s.off) % 16) : -1, open = 0, up = 0;
      if (p >= 2 && p < 4) open = sstep((p - 2) / 2); else if (p >= 4 && p < 12) open = 1; else if (p >= 12 && p < 14) open = 1 - sstep((p - 12) / 2);
      if (p >= 4 && p < 7) up = sstep((p - 4) / 3); else if (p >= 7 && p < 10) up = 1; else if (p >= 10 && p < 12) up = 1 - sstep((p - 10) / 2);
      s.dL.position.x = s.x - open * 0.55; s.dR.position.x = s.x + open * 0.55;
      s.ms.position.y = BY - 1.5 + up * 1.35; s.ms.visible = open > 0.2 || up > 0;
    });
    mats.eW.color.setHex(S.on ? (S.mode === 'alert' ? 0xff3b30 : 0xff8a1f) : 0x40220a);
  });

  /* ---------- Torre de almacenamiento (nave de carga, muelles, patio de contenedores con grúa pórtico) ---------- */
  var gS = member(PM[0][0], PM[0][1]);
  box(gS, 5.4, 1.8, 2.6, mats.metalC, 0, BY + 0.9, -1.4, 0.04);
  var cor = [];
  for (k = 0; k < 29; k++) cor.push({ x: -2.6 + k * 0.18, y: BY + 0.9, z: -0.08, sx: 0.04, sy: 1.7, sz: 0.04 });
  for (k = 0; k < 14; k++) { cor.push({ x: -2.72, y: BY + 0.9, z: -2.6 + k * 0.18, sx: 0.04, sy: 1.7, sz: 0.04 }); cor.push({ x: 2.72, y: BY + 0.9, z: -2.6 + k * 0.18, sx: 0.04, sy: 1.7, sz: 0.04 }); }
  gS.add(boxField(UB, mats.hull2, cor));
  box(gS, 5.5, 0.12, 2.7, mats.conc, 0, BY + 1.82, -1.4, 0.02);
  var rs = new THREE.Shape(); rs.moveTo(-2.75, 0); rs.lineTo(2.75, 0); rs.lineTo(0, 0.9); rs.closePath();
  var rgeo = new THREE.ExtrudeGeometry(rs, { depth: 2.8, bevelEnabled: false }); rgeo.translate(0, 0, -2.8);
  add(gS, rgeo, mats.concD, 0, BY + 1.88, 0);
  var ridge = [], skyl = [];
  for (k = 0; k < 9; k++) ridge.push({ x: -2.4 + k * 0.6, y: BY + 2.82, z: -1.4, sx: 0.4, sy: 0.12, sz: 0.5 });
  gS.add(boxField(UB, mats.hull2, ridge));
  var whirl = [];
  [-1.8, 0, 1.8].forEach(function (xx) {
    var wg = new THREE.Group(); gS.add(wg); wg.position.set(xx, BY + 2.98, -1.4);
    add(wg, new THREE.SphereGeometry(0.17, 10, 8), mats.hull2, 0, 0.12, 0);
    for (k = 0; k < 6; k++) { var wb = add(wg, new THREE.BoxGeometry(0.02, 0.22, 0.1), mats.hull2, Math.cos(k * P / 3) * 0.16, 0.12, Math.sin(k * P / 3) * 0.16); wb.rotation.y = k * P / 3; }
    whirl.push(wg);
  });
  // muelles con persianas
  var doors = [];
  [-1.7, 0, 1.7].forEach(function (xx, n) {
    box(gS, 1.4, 1.35, 0.1, mats.hazK, xx, BY + 0.68, -0.05, 0.02);
    add(gS, new THREE.BoxGeometry(1.5, 0.08, 0.14), mats.hazY, xx, BY + 1.4, -0.03);
    add(gS, new THREE.BoxGeometry(0.1, 1.4, 0.14), mats.hazY, xx - 0.72, BY + 0.7, -0.03); add(gS, new THREE.BoxGeometry(0.1, 1.4, 0.14), mats.hazY, xx + 0.72, BY + 0.7, -0.03);
    var rd = new THREE.Group(); gS.add(rd); rd.position.set(xx, BY + 1.35, 0.03);
    for (k = 0; k < 9; k++) add(rd, new THREE.BoxGeometry(1.3, 0.12, 0.05), mats.metalC, 0, -0.07 - k * 0.14, 0);
    add(gS, new THREE.SphereGeometry(0.07, 8, 6), mats.eS, xx, BY + 1.55, 0.05);
    doors.push({ g: rd, ph: n * 4.1 });
  });
  box(gS, 5.2, 0.28, 0.8, mats.conc, 0, BY + 0.14, 0.45, 0.02);
  for (k = 0; k < 3; k++) add(gS, new THREE.BoxGeometry(0.3, 0.2, 0.08), mats.dark, -1.7 + k * 1.7, BY + 0.36, 0.0);
  var trk = vehicle(gS, -1.7, 1.85, P, mats.panel, 1.9, false);
  box(trk.g, 0.72, 0.75, 1.9, mats.panel, 0, 0.62, 0.0, 0.03);
  box(trk.g, 0.74, 0.1, 1.9, mats.acS, 0, 0.3, 0.0, 0.01);
  // montacargas
  var fork = new THREE.Group(); gS.add(fork); fork.position.set(-0.5, BY + 0.28, 0.85);
  box(fork, 0.26, 0.2, 0.36, mats.acS, 0, 0.17, 0, 0.03);
  box(fork, 0.3, 0.05, 0.28, mats.dark, 0, 0.3, 0.05, 0.01);
  [-0.07, 0.07].forEach(function (xx) { add(fork, new THREE.BoxGeometry(0.03, 0.03, 0.36), mats.trim, xx, 0.07, -0.34); });
  add(fork, new THREE.BoxGeometry(0.2, 0.34, 0.03), mats.trim, 0, 0.2, -0.17);
  box(fork, 0.24, 0.14, 0.24, mats.contC, 0, 0.22, -0.34, 0.01);
  // patio de contenedores + grúa pórtico
  var yardM = [[], [], [], []];
  for (var cxI = 0; cxI < 3; cxI++) for (var czI = 0; czI < 2; czI++) {
    var hN = 1 + Math.floor(rnd() * 3);
    for (var hI = 0; hI < hN; hI++) yardM[Math.floor(rnd() * 4)].push({ x: 0.95 + cxI * 0.75, y: BY + 0.18 + hI * 0.37, z: 1.3 + czI * 1.3, sx: 0.62, sy: 0.34, sz: 1.2 });
  }
  [mats.contA, mats.contB, mats.contC, mats.contD].forEach(function (m, n) { gS.add(boxField(UB, m, yardM[n])); });
  var cranes = new THREE.Group(); gS.add(cranes); cranes.position.set(1.2, BY, 0);
  [0.65, 3.0].forEach(function (zz) {
    box(cranes, 0.14, 2.0, 0.14, mats.acS, 0, 1.0, zz, 0.02); box(cranes, 0.14, 2.0, 0.14, mats.acS, 0.6, 1.0, zz, 0.02);
    box(cranes, 0.7, 0.12, 0.2, mats.trim, 0.3, 0.0, zz, 0.02);
  });
  box(cranes, 0.16, 0.16, 2.6, mats.acS, 0.0, 2.05, 1.82, 0.02); box(cranes, 0.16, 0.16, 2.6, mats.acS, 0.6, 2.05, 1.82, 0.02);
  var trl = new THREE.Group(); cranes.add(trl); trl.position.set(0.3, 2.0, 1.8);
  box(trl, 0.7, 0.12, 0.3, mats.dark, 0, 0.1, 0, 0.02);
  var rope = add(trl, new THREE.CylinderGeometry(0.012, 0.012, 1, 5), mats.trim, 0, -0.5, 0);
  var spr = new THREE.Group(); trl.add(spr);
  box(spr, 0.56, 0.06, 0.4, mats.dark, 0, 0, 0, 0.01);
  var cargo = box(spr, 0.5, 0.3, 1.1, mats.contB, 0, -0.18, 0, 0.01);
  [0.65, 3.0].forEach(function (zz) { box(gS, 3.2, 0.05, 0.1, mats.trim, 1.7, BY + 0.03, zz, 0.01); });
  roofGreeble(gS, 0, BY + 1.9, -1.4, 5.0, 2.4, 5, mats.concD);
  light(gS, -2.6, BY + 3.0, -2.6, mats.red, 0.06, 1.5);
  beacon(gS, 2.4, BY + 1.95, -2.4, 2.0);
  anims.push(function (S) {
    if (S.alive) whirl.forEach(function (w, n) { w.rotation.y += S.dt * (4 + n); });
    doors.forEach(function (d) {
      var ph = S.alive ? ((S.t + d.ph) % 14) : 0, o = ph > 3 && ph < 6 ? sstep((ph - 3) / 1.5) : ph >= 6 && ph < 9 ? 1 : ph >= 9 && ph < 10.5 ? 1 - sstep((ph - 9) / 1.5) : 0;
      d.g.scale.y = 1 - o * 0.75;
    });
    var fp = S.alive ? Math.sin(S.t * 0.35) : -1; fork.position.x = -0.5 + fp * 1.8; fork.rotation.y = Math.cos(S.t * 0.35) > 0 ? P / 2 : -P / 2;
    if (S.alive) {
      var ph2 = (S.t / 12) % 1, cx = 0.7 + 0.5 * Math.sin(ph2 * TAU), tz = 1.8 + 0.8 * Math.sin(ph2 * TAU * 2), hh = 0.55 + 0.45 * (0.5 + 0.5 * Math.sin(ph2 * TAU * 3));
      cranes.position.x = cx + 0.45; trl.position.z = tz; spr.position.y = -(0.35 + hh * 1.0); rope.scale.y = 0.35 + hh * 1.0; rope.position.y = -rope.scale.y / 2;
    }
    mats.eS.color.setHex(S.on ? 0xffc42a : 0x40340c);
  });
  /* ---------- Acceso: garita con barrera, farolas, tráfico, colonos y luces de borde (sin vallas) ---------- */
  var GZ = 9.4;
  box(group, 1.3, 1.4, 1.3, mats.panel, 2.5, SLAB + 0.7, GZ, 0.05);
  box(group, 1.5, 0.1, 1.5, mats.conc, 2.5, SLAB + 1.45, GZ, 0.02);
  add(group, new THREE.BoxGeometry(1.0, 0.4, 0.05), mats.glass, 2.5, SLAB + 0.95, GZ - 0.67);
  add(group, new THREE.BoxGeometry(0.05, 0.4, 0.9), mats.glass, 1.83, SLAB + 0.95, GZ);
  add(group, new THREE.BoxGeometry(1.3, 0.05, 0.05), mats.eC, 2.5, SLAB + 1.35, GZ - 0.67);
  box(group, 0.3, 0.6, 0.3, mats.trim, 1.75, SLAB + 0.3, GZ, 0.03);
  var arm = new THREE.Group(); group.add(arm); arm.position.set(1.75, SLAB + 0.7, GZ);
  for (k = 0; k < 6; k++) box(arm, 0.28, 0.09, 0.07, k % 2 ? mats.hazK : mats.hazY, -0.16 - k * 0.28, 0, 0, 0.005);
  [[-1.9, GZ + 0.4], [1.9, GZ + 2.8]].forEach(function (p) {
    cylP(group, 0.06, 0.08, 2.4, 8, mats.hull2, p[0], SLAB + 1.2, p[1]);
    box(group, 0.5, 0.1, 0.22, mats.dark, p[0] + (p[0] < 0 ? 0.2 : -0.2), SLAB + 2.45, p[1], 0.02);
    add(group, new THREE.BoxGeometry(0.4, 0.03, 0.15), mats.winW, p[0] + (p[0] < 0 ? 0.2 : -0.2), SLAB + 2.39, p[1]);
  });
  var entrance = new THREE.Object3D(); group.add(entrance); entrance.position.set(0, SLAB + 0.2, 13.9);
  var edgeL = [];
  for (k = 0; k < 19; k++) { var ev = -12.6 + k * 1.4; edgeL.push({ x: ev, y: SLAB + 0.02, z: -13.7, sx: 0.3, sy: 0.03, sz: 0.1 }); edgeL.push({ x: ev, y: SLAB + 0.02, z: 13.7, sx: 0.3, sy: 0.03, sz: 0.1 }); edgeL.push({ x: -13.7, y: SLAB + 0.02, z: ev, sx: 0.1, sy: 0.03, sz: 0.3 }); edgeL.push({ x: 13.7, y: SLAB + 0.02, z: ev, sx: 0.1, sy: 0.03, sz: 0.3 }); }
  var edgeM = boxField(UB, mats.eC, edgeL); group.add(edgeM);
  var NW = 8, wBody = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.05, 0.06, 0.24, 6), mats.accent, NW), wHead = new THREE.InstancedMesh(new THREE.SphereGeometry(0.055, 6, 5), mats.winW, NW);
  wBody.frustumCulled = false; wHead.frustumCulled = false; group.add(wBody); group.add(wHead);
  var walkers = [];
  for (k = 0; k < NW; k++) walkers.push({ c: -1.8 + k * 0.5, a: 1.0 + rnd() * 0.8, ph: rnd() * TAU, z: 5.85 + (k % 3) * 0.12 });
  var _d = new THREE.Object3D(), armA = 0;

  /* ---------- Estados, demostración y API ---------- */
  var mode = 'working', pop = 0.6, lastT = null, demoT = 0, ghost = false, origEm = {};
  var OWN = { glassD: 0.32, glassG: 0.28, beam: 0.22, sweep: 0.12 };
  var S = { t: 0, dt: 0, alive: true, on: true, ghost: false, mode: 'working' };
  var api = {
    group: group,
    footprint: { w: SZ, d: SZ },
    entrance: entrance,              // acceso (borde +Z)
    input: new THREE.Object3D(),     // suministros (borde -X)
    towers: { mando: C0, investigacion: gR, viveres: gG, hospital: gH, armamento: gA, almacen: gS },
    demo: true,
    getState: function () { return mode; },
    getPopulation: function () { return pop; },
    setPopulation: function (f) { pop = clamp(f, 0, 1); },
    setState: function (s) { api.demo = false; mode = s; },
    setAccent: setAccent,
    setGhost: function (on, valid) {
      ghost = !!on;
      for (var key in mats) {
        var m = mats[key];
        if (!m.isMeshStandardMaterial && !m.isMeshBasicMaterial) continue;
        if (m.isMeshStandardMaterial && !origEm[key]) origEm[key] = { c: m.emissive.getHex(), i: m.emissiveIntensity };
        var own = OWN[key];
        m.transparent = ghost || own != null; m.opacity = ghost ? (own != null ? own : 0.45) : (own != null ? own : 1); m.depthWrite = !ghost && own == null;
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
        demoT += dt;
        pop = 0.62 + 0.33 * Math.sin(demoT * 0.12);
        mode = (demoT % 70) > 62 ? 'alert' : 'working';
      }
      var on = mode !== 'off', alive = (mode === 'working' || mode === 'alert') && !ghost;
      S.t = t; S.dt = dt; S.alive = alive; S.on = on; S.ghost = ghost; S.mode = mode;
      var nl = Math.ceil(clamp(ghost ? 0.6 : pop, 0, 1) * WL - 0.001), li, mi;
      for (li = 0; li < WL; li++) {
        var vis = on && li < nl;
        if (mode === 'broken') vis = vis && Math.sin(t * (5 + li * 2.3) + li * 4) > -0.3;
        for (mi = 0; mi < winMeshes[li].length; mi++) winMeshes[li][mi].visible = vis;
      }
      mats.winW.color.setHex(mode === 'alert' ? 0xffc0a0 : 0xffe3a0);
      mats.eC.color.setHex(on ? (mode === 'alert' ? 0xff5a4a : 0x35e0ff) : 0x1a4650);
      edgeM.visible = on;
      for (i = 0; i < edgesL.length; i++) edgesL[i].visible = !ghost;
      for (i = 0; i < anims.length; i++) anims[i](S);
      puffsAll.forEach(function (pg) {
        pg.arr.forEach(function (p) {
          var ph = (t * 0.28 + p.ph) % 1;
          p.m.visible = alive;
          if (alive) { p.m.position.set(pg.x + ph * 0.3, pg.y + ph * pg.rise, pg.z); p.m.scale.setScalar(0.6 + ph * 1.8); p.m.material.opacity = (1 - ph) * 0.3; }
        });
      });
      beacons.forEach(function (b) {
        b.g.visible = (mode === 'alert' || (mode === 'broken' && Math.sin(t * 3) > 0.3)) && !ghost;
        b.g.rotation.y = t * 4 + b.ph;
      });
      mats.beam.color.setHex(mode === 'broken' ? 0xffa31a : 0xff3b30);
      // barrera automática: sube y baja cada cierto tiempo
      var gateOpen = alive && (t % 11) > 3 && (t % 11) < 7.5;
      armA += ((gateOpen || !on ? -1.3 : 0) - armA) * Math.min(1, dt * 3);
      arm.rotation.z = armA;
      // colonos
      var nVis = alive ? Math.round(NW * clamp(pop, 0.2, 1)) : 0;
      wBody.count = nVis; wHead.count = nVis;
      for (i = 0; i < NW; i++) {
        var w = walkers[i], wx = w.c + w.a * Math.sin(t * 0.25 + w.ph), bob = Math.abs(Math.sin(t * 7 + i)) * 0.015;
        _d.position.set(wx, SLAB + 0.2 + bob, w.z); _d.rotation.y = 0; _d.scale.set(1, 1, 1); _d.updateMatrix(); wBody.setMatrixAt(i, _d.matrix);
        _d.position.set(wx, SLAB + 0.37 + bob, w.z); _d.updateMatrix(); wHead.setMatrixAt(i, _d.matrix);
      }
      wBody.instanceMatrix.needsUpdate = true; wHead.instanceMatrix.needsUpdate = true;
      // lámpara de estado y parpadeos
      var col = mode === 'working' ? 0x35ff7a : mode === 'alert' ? 0xff3b30 : mode === 'broken' ? 0xffa31a : 0x303030;
      if (mode === 'alert' || mode === 'broken') mats.status.color.setHex(Math.sin(t * 6) > 0 ? col : 0x301010); else mats.status.color.setHex(col);
      mastHalo.material.color.setHex(col); mastHalo.material.opacity = on ? 0.2 + 0.15 * Math.sin(t * 4) : 0;
      for (i = 0; i < blinkers.length; i++) blinkers[i].m.visible = on && Math.sin(t * TAU / blinkers[i].per + blinkers[i].ph) > -0.2;
    }
  };
  api.input.position.set(-13.9, SLAB + 0.5, 0); group.add(api.input);
  api.update(0);
  return api;
}
