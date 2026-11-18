/**
 * Planta de energía de fusión para Three.js, sin archivos externos (instalación grande para colocar en el planeta).
 *
 * Sala del reactor circular con cristal y tokamak visible (14 bobinas, plasma toroidal con destellos orbitando, solenoide
 * central) y claraboya con haz de luz, dos torres de enfriamiento con vapor, sala de turbinas abierta con dos turbinas
 * giratorias, tuberías con pulsos de flujo, edificio de control con barras de potencia y temperatura, subestación con
 * transformadores, pilonos y cables (con arcos eléctricos en sobrecarga), banco de baterías con luces de carga,
 * depósitos esféricos de combustible, chimenea de ventilación, postes de luz y letrero con rayo.
 *
 * Uso:
 *   const pw = createPlantaEnergia(THREE, { accent: 0xffc42a });
 *   pw.group.position.set(x, groundY, z);        // la base de la losa está en y = 0
 *   scene.add(pw.group);
 *   pw.update(clock.getElapsedTime());
 *
 * Escala: 1 unidad = 4 m. Huella: 16 x 16 unidades (pw.footprint), centrada en el origen. Altura ~8.5.
 * Entrada de combustible: pw.input (Object3D, borde -X). Salida de energía: pw.output (Object3D, borde +X, línea de transmisión).
 *
 * Estados (pw.setState): 'working' genera según pw.setPower (plasma, turbinas, vapor y flujo escalan con la potencia),
 *   'overload' sobrecarga (plasma naranja, balizas rojas, arcos en la subestación), 'broken' avería (plasma parpadeando,
 *   potencia baja), 'off' apagada. Por defecto corre una demostración (pw.demo = true): la potencia sube y baja y de vez
 *   en cuando hay una sobrecarga; setState la desactiva y el control pasa a tu juego.
 * pw.setPower(0..1) / getPower(): nivel de generación. pw.setGhost(true, valid): modo "fantasma" para colocar (verde si
 *   valid, rojo si valid === false); setGhost(false) lo quita. pw.setAccent(hex): color de pintura.
 * Compatible con Three.js r128 o superior.
 */
function createPlantaEnergia(THREE, opts) {
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

  var SLAB = 0.4, k, j, i, q, SZ = 16;
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

  function beacon(g, x, y, z, ph) {
    var bg = new THREE.Group(); g.add(bg); bg.position.set(x, y, z);
    add(bg, new THREE.CylinderGeometry(0.09, 0.11, 0.18, 10), mats.dark, 0, -0.09, 0);
    add(bg, new THREE.SphereGeometry(0.09, 10, 8), mats.red, 0, 0.04, 0);
    var cone = new THREE.ConeGeometry(0.5, 3.0, 14, 1, true); cone.translate(0, -1.5, 0); cone.rotateZ(P / 2);
    add(bg, cone, mats.beam, 0, 0.04, 0);
    bg.visible = false; beacons.push({ g: bg, ph: ph || 0 });
  }

  var BY = SLAB, puffsAll = [];
  function latheV(prof, seg) {
    var pts = [];
    for (var n = 0; n < prof.length; n++) pts.push(new THREE.Vector2(prof[n][0], prof[n][1]));
    return new THREE.LatheGeometry(pts, seg || 40);
  }
  function puffs(g, x, y, z, n, rise, size, color) {
    var arr = [];
    for (var a = 0; a < n; a++) { var pf = add(g, new THREE.SphereGeometry(0.16, 8, 6), glowMat(color || 0xe9eef5, 0), x, y, z); pf.visible = false; arr.push({ m: pf, ph: a / n }); }
    puffsAll.push({ arr: arr, x: x, y: y, z: z, rise: rise, size: size || 1 });
  }
  function pathPt(pts, u) {
    var tot = 0, L = [], q;
    for (q = 0; q < pts.length - 1; q++) { var l = Math.hypot(pts[q + 1][0] - pts[q][0], pts[q + 1][1] - pts[q][1], pts[q + 1][2] - pts[q][2]); L.push(l); tot += l; }
    var d = u * tot;
    for (q = 0; q < L.length; q++) { if (d <= L[q] || q === L.length - 1) { var f = clamp(d / L[q], 0, 1); return [pts[q][0] + (pts[q + 1][0] - pts[q][0]) * f, pts[q][1] + (pts[q + 1][1] - pts[q][1]) * f, pts[q][2] + (pts[q + 1][2] - pts[q][2]) * f]; } d -= L[q]; }
    return pts[pts.length - 1];
  }
  mats.plasma = glowMat(0x6fd0ff, 0.8); mats.plasma2 = glowMat(0xe8fbff, 0.9); mats.cone = glowMat(0x8fdcff, 0.1);
  mats.steel = std(0x7d8794, 0.75, 0.4); mats.cream = std(0xe6dcc8, 0.2, 0.6); mats.xfm = std(0x6f8272, 0.5, 0.55); mats.red2 = std(0xb83a30, 0.4, 0.5);

  /* ---------- Losa 16 x 16 ---------- */
  add(group, roundedBox(SZ, SLAB, SZ, 0.1, 3), mats.slab, 0, SLAB / 2, 0);
  var seamP = [], stP = [];
  for (k = -1; k <= 1; k++) { seamP.push({ x: k * 4, y: SLAB + 0.01, z: 0, sx: 0.04, sy: 0.02, sz: SZ }); seamP.push({ x: 0, y: SLAB + 0.01, z: k * 4, sx: SZ, sy: 0.02, sz: 0.04 }); }
  for (k = 0; k < 16; k++) stP.push({ x: (rnd() - 0.5) * 14, y: SLAB + 0.012, z: (rnd() - 0.5) * 14, ry: rnd() * 3, sx: 0.5 + rnd() * 1.4, sy: 0.01, sz: 0.4 + rnd() });
  group.add(boxField(UB, mats.dark, seamP)); group.add(boxField(UB, mats.trim, stP));
  box(group, 3.0, 0.05, 3.2, mats.road, 0, SLAB + 0.025, 6.4, 0.01);
  var hzY = [], hzK = [];
  for (k = 0; k < 12; k++) (k % 2 ? hzY : hzK).push({ x: -3.0 + k * 0.5, y: SLAB + 0.03, z: 7.7, sx: 0.5, sy: 0.02, sz: 0.2 });
  group.add(boxField(UB, mats.hazY, hzY)); group.add(boxField(UB, mats.hazK, hzK));

  /* ---------- Sala del reactor de fusión (tokamak visible tras cristal) ---------- */
  var RX = 0, RZ = -3.2, RR = 3.4, RH = 3.4;
  cylP(group, RR, RR + 0.1, 0.4, 32, mats.conc, RX, BY + 0.2, RZ);
  cylP(group, RR, RR, RH, 32, mats.conc, RX, BY + RH / 2, RZ);
  add(group, new THREE.CylinderGeometry(RR + 0.04, RR + 0.04, 1.2, 32, 1, true), mats.glassD, RX, BY + 1.7, RZ);
  for (k = 0; k < 16; k++) { var ba = k / 16 * TAU; box(group, 0.22, RH, 0.34, mats.concD, RX + Math.cos(ba) * (RR + 0.1), BY + RH / 2, RZ + Math.sin(ba) * (RR + 0.1), 0.03).rotation.y = -ba; }
  add(group, new THREE.TorusGeometry(RR + 0.1, 0.08, 6, 48).rotateX(P / 2), mats.accent, RX, BY + 1.05, RZ);
  add(group, new THREE.TorusGeometry(RR + 0.1, 0.08, 6, 48).rotateX(P / 2), mats.accent, RX, BY + 2.35, RZ);
  add(group, new THREE.RingGeometry(2.1, RR + 0.1, 40).rotateX(-P / 2), mats.concD, RX, BY + RH + 0.01, RZ);
  add(group, new THREE.CircleGeometry(2.1, 36).rotateX(-P / 2), mats.glassD, RX, BY + RH + 0.02, RZ);
  for (k = 0; k < 12; k++) { var ra = k / 12 * TAU; strutIn(group, [RX + Math.cos(ra) * 2.1, BY + RH + 0.05, RZ + Math.sin(ra) * 2.1], [RX + Math.cos(ra + 0.52) * 2.1, BY + RH + 0.05, RZ + Math.sin(ra + 0.52) * 2.1], 0.03, mats.trim); }
  add(group, new THREE.TorusGeometry(2.1, 0.07, 6, 40).rotateX(P / 2), mats.accent, RX, BY + RH + 0.05, RZ);
  // interior
  var TY = BY + 1.75;
  cylP(group, 2.9, 3.0, 0.5, 32, mats.dark, RX, BY + 0.65, RZ);
  add(group, new THREE.TorusGeometry(2.9, 0.04, 6, 40).rotateX(P / 2), mats.eR, RX, BY + 0.92, RZ);
  cylP(group, 0.5, 0.55, 2.2, 16, mats.steel, RX, BY + 1.75, RZ);
  for (k = 0; k < 4; k++) add(group, new THREE.TorusGeometry(0.52, 0.04, 6, 16).rotateX(P / 2), mats.eR, RX, BY + 1.0 + k * 0.45, RZ);
  for (k = 0; k < 14; k++) {
    var ca = k / 14 * TAU, coil = add(group, new THREE.TorusGeometry(0.88, 0.085, 8, 18), mats.steel, RX + Math.cos(ca) * 1.75, TY, RZ + Math.sin(ca) * 1.75);
    coil.rotation.y = -ca;
  }
  for (k = 0; k < 6; k++) { var la = k / 6 * TAU + 0.3; strutIn(group, [RX + Math.cos(la) * 2.0, BY + 0.9, RZ + Math.sin(la) * 2.0], [RX + Math.cos(la) * 1.75, TY - 0.85, RZ + Math.sin(la) * 1.75], 0.07, mats.hull2); }
  var plasma = add(group, new THREE.TorusGeometry(1.75, 0.5, 14, 50).rotateX(P / 2), mats.plasma, RX, TY, RZ);
  var plasma2 = add(group, new THREE.TorusGeometry(1.75, 0.22, 10, 50).rotateX(P / 2), mats.plasma2, RX, TY, RZ);
  var blobs = [];
  for (k = 0; k < 7; k++) blobs.push({ m: add(group, new THREE.SphereGeometry(0.17, 10, 8), mats.plasma2, RX, TY, RZ), a: k / 7 * TAU, v: 0.8 + (k % 3) * 0.25 });
  var beamUp = add(group, new THREE.CylinderGeometry(1.7, 2.0, 7.0, 24, 1, true), mats.cone, RX, BY + RH + 3.6, RZ);
  // columnas de servicio y pasarela interior
  beacon(group, RX + 2.6, BY + RH + 0.2, RZ + 1.8, 0.2);
  beacon(group, RX - 2.6, BY + RH + 0.2, RZ + 1.8, 1.4);
  // tuberías principales (sala -> torres de enfriamiento y turbinas)
  var PP = [];
  function pipePath(pts, r, mat, bead) { pipeRun(pts, r, mat || mats.pipe); if (bead) PP.push(pts); }
  pipePath([[RX + RR, BY + 1.1, RZ - 0.8], [5.4, BY + 1.1, RZ - 0.8], [5.4, BY + 1.1, -4.3]], 0.14, mats.pipe, true);
  pipePath([[RX + RR, BY + 0.7, RZ + 0.8], [5.0, BY + 0.7, RZ + 0.8], [5.0, BY + 0.7, -4.3]], 0.1, mats.red2, true);
  pipePath([[RX - RR, BY + 1.1, RZ - 0.8], [-5.4, BY + 1.1, RZ - 0.8], [-5.4, BY + 1.1, -4.3]], 0.14, mats.pipe, true);
  pipePath([[RX - RR, BY + 0.7, RZ + 0.8], [-5.0, BY + 0.7, RZ + 0.8], [-5.0, BY + 0.7, -4.3]], 0.1, mats.red2, true);
  pipePath([[-1.2, BY + 0.9, RZ + RR - 0.1], [-1.2, BY + 0.9, 2.0]], 0.13, mats.pipe, true);
  pipePath([[1.2, BY + 0.9, RZ + RR - 0.1], [1.2, BY + 0.9, 1.0], [3.0, BY + 0.9, 1.0], [3.0, BY + 0.9, 2.0]], 0.1, mats.red2, true);
  for (k = 0; k < PP.length; k++) { var pv = PP[k][1]; valve(pv[0], pv[1] + 0.0, pv[2], k % 2 === 0); }

  /* ---------- Torres de enfriamiento (2) ---------- */
  var CT = [[-5.4, -5.4], [5.4, -5.4]];
  var ctProf = [[0, BY], [1.6, BY], [1.6, BY + 0.9], [1.45, BY + 2.0], [1.22, BY + 3.6], [1.1, BY + 4.6], [1.15, BY + 5.8], [1.3, BY + 6.8], [1.34, BY + 7.0], [1.2, BY + 7.0]];
  var ctG = latheV(ctProf, 36);
  CT.forEach(function (p, n) {
    add(group, ctG, mats.conc, p[0], 0, p[1]);
    add(group, new THREE.TorusGeometry(1.34, 0.07, 6, 36).rotateX(P / 2), mats.accent, p[0], BY + 7.0, p[1]);
    var lv = [];
    for (k = 0; k < 28; k++) { var la2 = k / 28 * TAU; lv.push({ x: p[0] + Math.cos(la2) * 1.62, y: BY + 0.45, z: p[1] + Math.sin(la2) * 1.62, ry: P / 2 - la2, sx: 0.28, sy: 0.7, sz: 0.06 }); }
    group.add(boxField(UB, mats.dark, lv));
    for (k = 0; k < 10; k++) { var sa = k / 10 * TAU; strutIn(group, [p[0] + Math.cos(sa) * 1.6, BY + 0.9, p[1] + Math.sin(sa) * 1.6], [p[0] + Math.cos(sa) * 1.6, BY, p[1] + Math.sin(sa) * 1.6], 0.06, mats.concD); }
    ringPlat(p[0], BY + 7.0, p[1], 1.2, 1.5, 14);
    ladderV(p[0] + 1.18, p[1], BY + 1.0, BY + 7.0, 'x', -0.1);
    puffs(group, p[0], BY + 7.2, p[1], 7, 3.4, 2.2);
    light(group, p[0] + 1.3, BY + 7.2, p[1], mats.red, 0.07, 1.6 + n * 0.3);
  });

  /* ---------- Sala de turbinas (frente izquierda, abierta con cristal) ---------- */
  var TX = -1.6, TZ = 3.4;
  box(group, 6.2, 0.2, 2.6, mats.concD, TX, BY + 0.1, TZ, 0.02);
  box(group, 6.0, 2.3, 0.18, mats.panel, TX, BY + 1.35, TZ - 1.2, 0.02);
  [-3.0, 3.0].forEach(function (dx) { box(group, 0.18, 2.3, 2.4, mats.panel, TX + dx, BY + 1.35, TZ, 0.02); });
  box(group, 6.3, 0.2, 2.7, mats.conc, TX, BY + 2.58, TZ, 0.03);
  add(group, new THREE.BoxGeometry(6.0, 2.1, 0.05), mats.glassD, TX, BY + 1.3, TZ + 1.2);
  for (k = 0; k < 7; k++) add(group, new THREE.BoxGeometry(0.06, 2.1, 0.08), mats.trim, TX - 3.0 + k * 1.0, BY + 1.3, TZ + 1.2);
  var skl = [];
  for (k = 0; k < 5; k++) skl.push({ x: TX - 2.4 + k * 1.2, y: BY + 2.72, z: TZ, sx: 0.8, sy: 0.06, sz: 1.6 });
  group.add(boxField(UB, mats.winC, skl));
  add(group, new THREE.BoxGeometry(6.3, 0.06, 0.06), mats.eC, TX, BY + 2.4, TZ + 1.32);
  var turbs = [];
  [-1.5, 1.5].forEach(function (dx, n) {
    var tg = new THREE.Group(); group.add(tg); tg.position.set(TX + dx, BY + 0.85, TZ + 0.1);
    box(tg, 1.9, 0.36, 0.9, mats.dark, 0, -0.5, 0, 0.03);
    add(tg, new THREE.CylinderGeometry(0.46, 0.46, 1.7, 18).rotateZ(P / 2), mats.steel, 0, 0, 0);
    [-0.4, 0.4].forEach(function (xx) { add(tg, new THREE.TorusGeometry(0.47, 0.045, 6, 18).rotateY(P / 2), mats.accent, xx, 0, 0); });
    var rot = new THREE.Group(); tg.add(rot); rot.position.set(0.0, 0, 0);
    var shaft = add(rot, new THREE.CylinderGeometry(0.1, 0.1, 2.2, 10).rotateZ(P / 2), mats.trim, 0, 0, 0);
    for (k = 0; k < 10; k++) { var fb = add(rot, new THREE.BoxGeometry(0.04, 0.5, 0.2), mats.hull2, 1.0, 0, 0); fb.rotation.x = k * TAU / 10; fb.position.set(1.0, Math.cos(k * TAU / 10) * 0.0, 0); }
    var disc = add(rot, new THREE.CylinderGeometry(0.4, 0.4, 0.06, 16).rotateZ(P / 2), mats.eC, 1.06, 0, 0);
    box(tg, 0.9, 0.7, 0.8, mats.hull2, -1.35, -0.05, 0, 0.04);
    turbs.push({ rot: rot, disc: disc });
  });
  roofGreeble(group, TX, BY + 2.7, TZ, 6.0, 2.4, 6, mats.concD);

  /* ---------- Edificio de control (frente derecha) con barras de potencia y temperatura ---------- */
  var FCt = mkFacade(group), CX = 4.7, CZ = 3.4;
  box(group, 3.0, 2.3, 2.4, mats.panel, CX, BY + 1.15, CZ, 0.05);
  FCt.tier(CX, CZ, 0, 3.0, 2.4, BY, 2, 1.15, { seg: 0.5, margin: 0.3 });
  FCt.bake();
  box(group, 3.0, 0.2, 0.04, mats.dark, CX, BY + 0.8, CZ + 1.22, 0.01);
  box(group, 3.0, 0.2, 0.04, mats.dark, CX, BY + 0.48, CZ + 1.22, 0.01);
  var barPw = add(group, new THREE.BoxGeometry(1, 0.13, 0.05), mats.eC, CX, BY + 0.8, CZ + 1.25);
  var barTp = add(group, new THREE.BoxGeometry(1, 0.13, 0.05), mats.eW, CX, BY + 0.48, CZ + 1.25);
  box(group, 0.7, 1.0, 0.08, mats.dark, CX + 1.0, BY + 0.6, CZ + 1.22, 0.02);
  strutIn(group, [CX - 1.0, BY + 2.35, CZ], [CX - 1.0, BY + 3.6, CZ], 0.035, mats.trim);
  light(group, CX - 1.0, BY + 3.65, CZ, mats.red, 0.06, 1.4);
  roofGreeble(group, CX, BY + 2.35, CZ, 2.8, 2.2, 5, mats.concD);
  var mastTop = add(group, new THREE.SphereGeometry(0.16, 12, 10), mats.status, CX + 1.2, BY + 2.6, CZ + 0.6);
  var mastHalo = add(group, new THREE.SphereGeometry(0.4, 12, 10), glowMat(0x7dffb0, 0.3), CX + 1.2, BY + 2.6, CZ + 0.6);
  cylP(group, 0.04, 0.04, 0.5, 6, mats.trim, CX + 1.2, BY + 2.5, CZ + 0.6);

  /* ---------- Subestación: transformadores, pilonos y cables ---------- */
  box(group, 2.4, 0.1, 5.0, mats.concD, 6.4, BY + 0.05, -0.7, 0.01);
  var xfmB = [], arcs = [];
  [-2.6, -0.9, 0.8].forEach(function (zz, n) {
    box(group, 0.9, 0.9, 1.1, mats.xfm, 6.2, BY + 0.55, zz, 0.04);
    var fins = [];
    for (k = 0; k < 7; k++) { fins.push({ x: 5.68, y: BY + 0.55, z: zz - 0.45 + k * 0.15, sx: 0.12, sy: 0.7, sz: 0.04 }); }
    group.add(boxField(UB, mats.steel, fins));
    add(group, new THREE.CylinderGeometry(0.18, 0.18, 1.0, 10).rotateX(P / 2), mats.steel, 6.2, BY + 1.2, zz);
    for (k = 0; k < 3; k++) {
      var bx = 6.2, bz = zz - 0.3 + k * 0.3;
      add(group, new THREE.CylinderGeometry(0.05, 0.05, 0.5, 8), mats.cream, bx, BY + 1.25 + 0.0, bz).position.y = BY + 1.45;
      for (j = 0; j < 4; j++) add(group, new THREE.CylinderGeometry(0.1, 0.1, 0.03, 10), mats.cream, bx, BY + 1.26 + j * 0.12, bz);
      xfmB.push([bx, BY + 1.72, bz]);
    }
  });
  var arcL = [];
  for (k = 0; k < xfmB.length - 1; k++) { if (k % 3 === 2) continue; var am = new THREE.Mesh(_cg[0.02] || (_cg[0.02] = new THREE.CylinderGeometry(0.02, 0.02, 1, 5)), mats.plasma2); placeStrut(am, xfmB[k], xfmB[k + 1]); am.visible = false; group.add(am); arcL.push(am); }
  [-3.4, 1.8].forEach(function (zz) {
    var px = 7.3, top = BY + 5.0;
    [[-0.3, -0.3], [0.3, -0.3], [0.3, 0.3], [-0.3, 0.3]].forEach(function (c) { strutIn(group, [px + c[0] * 1.6, BY, zz + c[1] * 1.6], [px + c[0] * 0.4, top, zz + c[1] * 0.4], 0.04, mats.steel); });
    for (j = 1; j < 5; j++) { var yy = BY + j * 1.0, w = 1.6 - j * 0.3; strutIn(group, [px - w * 0.2, yy, zz - w * 0.2], [px + w * 0.2, yy, zz + w * 0.2], 0.025, mats.steel); }
    box(group, 0.1, 0.06, 1.8, mats.steel, px, BY + 4.5, zz, 0.01); box(group, 0.1, 0.06, 1.4, mats.steel, px, BY + 3.7, zz, 0.01);
    [[4.5, 0.9], [4.5, -0.9], [3.7, 0.7], [3.7, -0.7]].forEach(function (a) { add(group, new THREE.CylinderGeometry(0.05, 0.05, 0.3, 8), mats.cream, px, BY + a[0] - 0.18, zz + a[1]); });
  });
  [[4.5, 0.9], [4.5, -0.9], [3.7, 0.7], [3.7, -0.7]].forEach(function (a) {
    var p0 = [7.3, BY + a[0] - 0.33, -3.4 + a[1] * 1.0], p1 = [7.3, BY + a[0] - 0.33, 1.8 + a[1] * 1.0], mid = [7.3, BY + a[0] - 0.9, (p0[2] + p1[2]) / 2];
    strutIn(group, p0, mid, 0.02, mats.dark); strutIn(group, mid, p1, 0.02, mats.dark);
  });
  var outPort = new THREE.Object3D(); group.add(outPort); outPort.position.set(7.9, BY + 1.0, -0.8);
  strutIn(group, xfmB[4], [7.3, BY + 3.4, -0.8], 0.02, mats.dark);

  /* ---------- Banco de baterías ---------- */
  var batts = [];
  [-6.9, -5.3].forEach(function (bx, c) {
    [-2.4, -0.8, 0.8].forEach(function (bz, r) {
      box(group, 1.3, 0.95, 1.2, mats.panel, bx, BY + 0.5, bz, 0.04);
      box(group, 1.34, 0.08, 1.24, mats.acS, bx, BY + 1.0, bz, 0.01);
      var leds = [];
      for (j = 0; j < 5; j++) leds.push(add(group, new THREE.BoxGeometry(0.04, 0.08, 0.18), mats.eS, bx + (c ? 0.67 : -0.67), BY + 0.22 + j * 0.15, bz));
      add(group, new THREE.BoxGeometry(0.5, 0.28, 0.04), mats.dark, bx, BY + 0.55, bz + (r % 2 ? 0.61 : -0.61));
      batts.push({ leds: leds, ph: (c * 3 + r) * 1.1 });
    });
  });
  roofGreeble(group, -6.1, BY + 1.0, -0.8, 3.0, 4.4, 8, mats.concD);

  /* ---------- Depósitos de combustible (deuterio) ---------- */
  [3.4, 5.7].forEach(function (zz) {
    add(group, new THREE.SphereGeometry(0.85, 22, 16), mats.panel, -6.4, BY + 1.9, zz);
    add(group, new THREE.TorusGeometry(0.85, 0.04, 6, 24).rotateX(P / 2), mats.acR, -6.4, BY + 1.9, zz);
    for (k = 0; k < 4; k++) { var fa = k / 4 * TAU + P / 4; strutIn(group, [-6.4 + Math.cos(fa) * 0.75, BY + 1.35, zz + Math.sin(fa) * 0.75], [-6.4 + Math.cos(fa) * 0.9, BY, zz + Math.sin(fa) * 0.9], 0.05, mats.steel); }
    ringPlat(-6.4, BY + 1.9, zz, 0.88, 1.2, 12);
  });
  pipeRun([[-5.6, BY + 0.5, 3.4], [-4.9, BY + 0.5, 3.4], [-4.9, BY + 0.9, 3.4]], 0.08, mats.pipe);
  pipeRun([[-6.4, BY + 0.5, 4.25], [-6.4, BY + 0.5, 4.85]], 0.08, mats.pipe);
  var inPort = new THREE.Object3D(); group.add(inPort); inPort.position.set(-7.9, BY + 0.9, 4.5);
  pipeRun([[-6.4, BY + 0.5, 5.7], [-7.5, BY + 0.5, 5.7], [-7.5, BY + 0.9, 4.5], [-7.9, BY + 0.9, 4.5]], 0.07, mats.pipe);

  /* ---------- Chimenea de ventilación, postes y letrero ---------- */
  for (k = 0; k < 8; k++) cylP(group, 0.34 - k * 0.012, 0.35 - k * 0.012, 1.0, 14, k % 2 ? mats.red2 : mats.panel, 0, BY + 0.5 + k * 1.0, -7.2);
  light(group, 0, BY + 8.25, -7.2, mats.red, 0.1, 1.2);
  ladderV(0, -6.84, BY + 0.5, BY + 7.5, 'z', -0.1);
  [[-7.2, 6.6], [7.2, 6.6], [-7.2, -7.2], [7.2, -7.2], [0, 2.4]].forEach(function (p) {
    cylP(group, 0.06, 0.08, 3.0, 8, mats.hull2, p[0], BY + 1.5, p[1]);
    box(group, 0.5, 0.1, 0.22, mats.dark, p[0] + (p[0] < 0 ? 0.2 : p[0] > 0 ? -0.2 : 0), BY + 3.0, p[1], 0.02);
    add(group, new THREE.BoxGeometry(0.4, 0.03, 0.15), mats.winW, p[0] + (p[0] < 0 ? 0.2 : p[0] > 0 ? -0.2 : 0), BY + 2.94, p[1]);
  });
  [-1.3, 1.3].forEach(function (xx) { cylP(group, 0.06, 0.06, 1.8, 8, mats.hull2, xx, BY + 0.9, 7.2); });
  box(group, 3.0, 1.2, 0.1, mats.dark, 0, BY + 2.1, 7.2, 0.02);
  [[0.0, 0.0, 0.18, 0.7, 0.0], [-0.12, 0.2, 0.18, 0.4, 0.5], [0.12, -0.2, 0.18, 0.4, 0.5]].forEach(function (b) {
    var bm = add(group, new THREE.BoxGeometry(b[2], b[3], 0.04), mats.eS, b[0], BY + 2.1 + b[1], 7.26); bm.rotation.z = -0.4 + b[4] * 0;
  });
  add(group, new THREE.BoxGeometry(2.8, 0.05, 0.05), mats.eS, 0, BY + 2.65, 7.26);
  // paneles de equipos junto a la sala
  roofGreeble(group, 0, BY + 0.0, 1.8, 3.0, 1.2, 6, mats.hull2);

  /* ---------- Estados y API ---------- */
  var beacons2 = [];
  var flowM = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 6, 5), mats.eC, PP.length * 4); flowM.frustumCulled = false; group.add(flowM);
  var _d = new THREE.Object3D(), flowU = 0, bladeA = 0;
  var mode = 'working', power = 0.6, temp = 0.5, lastT = null, demoT = 0, ghost = false, origEm = {};
  var OWN = { glassD: 0.32, glassG: 0.28, beam: 0.22, sweep: 0.12, plasma: 0.8, plasma2: 0.9, cone: 0.1 };
  var api = {
    group: group,
    footprint: { w: SZ, d: SZ },
    input: inPort,                   // combustible (borde -X)
    output: outPort,                 // energía eléctrica (borde +X, línea de transmisión)
    demo: true,
    getState: function () { return mode; },
    getPower: function () { return power; },
    setPower: function (f) { power = clamp(f, 0, 1); },
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
        mode = (demoT % 70) > 62 ? 'overload' : 'working';
        power = mode === 'overload' ? 1 : 0.55 + 0.35 * Math.sin(demoT * 0.15);
      }
      var run = (mode === 'working' || mode === 'overload') && !ghost, on = mode !== 'off';
      var pw = mode === 'overload' ? 1 : mode === 'broken' ? power * 0.3 : mode === 'off' ? 0 : power;
      temp += ((mode === 'overload' ? 1 : pw * 0.8 + 0.1) - temp) * Math.min(1, dt * 0.6);
      var flick = mode === 'broken' ? (Math.sin(t * 17) + Math.sin(t * 9.3) > 0.3 ? 1 : 0.15) : 1;
      // plasma
      var pc = mode === 'overload' ? 0xff6a3a : mode === 'broken' ? 0xffb03a : 0x6fd0ff;
      mats.plasma.color.setHex(pc); mats.plasma2.color.setHex(mode === 'overload' ? 0xffe2b0 : 0xe8fbff);
      plasma.visible = plasma2.visible = on && !ghost; mats.plasma.opacity = (0.25 + 0.55 * pw) * flick * (0.85 + 0.15 * Math.sin(t * 9)); mats.plasma2.opacity = (0.3 + 0.6 * pw) * flick;
      plasma2.scale.set(1, 1, 1);
      blobs.forEach(function (b) { b.a += dt * b.v * (0.4 + pw * 2.2) * (on ? 1 : 0); b.m.position.set(RX + Math.cos(b.a) * 1.75, TY, RZ + Math.sin(b.a) * 1.75); b.m.visible = on && !ghost; });
      beamUp.visible = run && pw > 0.1; mats.cone.opacity = 0.04 + 0.1 * pw * flick; mats.cone.color.setHex(pc);
      // turbinas
      bladeA += dt * (run ? 2 + pw * 14 : 0);
      turbs.forEach(function (T, n) { T.rot.rotation.x = bladeA * (n ? -1 : 1); T.disc.visible = on; });
      mats.eC.color.setHex(on ? (mode === 'overload' ? 0xff8a6a : 0x35e0ff) : 0x1a4650);
      mats.eR.color.setHex(on ? (mode === 'overload' ? 0xff6a3a : 0x35d0ff) : 0x1a4650);
      mats.eS.color.setHex(on ? 0xffc42a : 0x40340c); mats.eW.color.setHex(on ? 0xff8a1f : 0x40220a);
      // ventanas del control
      for (var li = 0; li < WL; li++) for (var mi = 0; mi < winMeshes[li].length; mi++) winMeshes[li][mi].visible = on && (li < 4 || mode !== 'broken' || Math.sin(t * 7) > 0);
      // barras
      barPw.scale.x = Math.max(0.001, pw) * 2.8; barPw.position.x = CX - 1.4 + barPw.scale.x / 2;
      barTp.scale.x = Math.max(0.001, temp) * 2.8; barTp.position.x = CX - 1.4 + barTp.scale.x / 2;
      // baterías
      batts.forEach(function (b) { var ch = 0.5 + 0.5 * Math.sin(t * 0.3 + b.ph); b.leds.forEach(function (l, q) { l.visible = on && (q + 1) / 5 <= ch + 0.001; }); });
      // arcos de la subestación
      arcL.forEach(function (a, q) { a.visible = !ghost && ((mode === 'overload' && Math.sin(t * 31 + q * 7) > 0.2) || (mode === 'broken' && Math.sin(t * 13 + q * 3) > 0.7) || (mode === 'working' && pw > 0.8 && Math.sin(t * 23 + q * 5) > 0.97)); });
      // flujo en tuberías
      flowU += dt * (run ? 0.1 + pw * 0.5 : 0);
      for (i = 0; i < PP.length; i++) for (k = 0; k < 4; k++) {
        var pt = pathPt(PP[i], (flowU + k / 4 + i * 0.13) % 1), sc = run ? 0.07 : 0.0001;
        _d.position.set(pt[0], pt[1] + 0.0, pt[2]); _d.rotation.y = 0; _d.scale.set(sc, sc, sc); _d.updateMatrix(); flowM.setMatrixAt(i * 4 + k, _d.matrix);
      }
      flowM.instanceMatrix.needsUpdate = true;
      // vapor
      puffsAll.forEach(function (pg) {
        pg.arr.forEach(function (p) {
          var ph = (t * (0.18 + pw * 0.15) + p.ph) % 1;
          p.m.visible = run;
          if (run) { p.m.position.set(pg.x + ph * 0.8, pg.y + ph * pg.rise, pg.z + Math.sin(p.ph * 9) * 0.3); p.m.scale.setScalar((0.6 + ph * 1.8) * pg.size); p.m.material.opacity = (1 - ph) * (0.18 + 0.2 * pw); }
        });
      });
      beacons.forEach(function (b) {
        b.g.visible = (mode === 'overload' || (mode === 'broken' && Math.sin(t * 3) > 0.3)) && !ghost;
        b.g.rotation.y = t * 4 + b.ph;
      });
      mats.beam.color.setHex(mode === 'broken' ? 0xffa31a : 0xff3b30);
      var col = mode === 'working' ? 0x35ff7a : mode === 'overload' ? 0xff3b30 : mode === 'broken' ? 0xffa31a : 0x303030;
      if (mode === 'overload' || mode === 'broken') mats.status.color.setHex(Math.sin(t * 6) > 0 ? col : 0x301010); else mats.status.color.setHex(col);
      mastHalo.material.color.setHex(col); mastHalo.material.opacity = on ? 0.2 + 0.15 * Math.sin(t * 4) : 0;
      for (i = 0; i < blinkers.length; i++) blinkers[i].m.visible = on && Math.sin(t * TAU / blinkers[i].per + blinkers[i].ph) > -0.2;
    }
  };
  api.update(0);
  return api;
}
