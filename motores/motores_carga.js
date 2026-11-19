/* ============================================================================
 *  MOTORES DE CARGA — 3 motores estáticos, procedurales (Three.js, sin assets)
 *  Mula (pequeno) · Buey (mediano) · Mamut (grande)
 *  Convención: cara de montaje en z=0, escape hacia +Z. 1 unidad = 4 m.
 *  API: createMotorMula/Buey/Mamut(THREE, opts) y obtenerMotorCarga(THREE,size,opts)
 * ========================================================================== */
function _cargaKit(THREE, opts) {
    opts = opts || {};
    var P = Math.PI, TAU = P * 2;
    var C = { accent: opts.accent != null ? opts.accent : 0xf2b01e, glow: opts.glow != null ? opts.glow : 0x58c8ff };
    var seed = opts.seed || 31;
    function rnd() { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }
    function std(c, m, r, e) { var o = { color: c, metalness: m, roughness: r, side: THREE.DoubleSide }; if (e) for (var k in e) o[k] = e[k]; return new THREE.MeshStandardMaterial(o); }
    var M = {
      yellow: std(C.accent, 0.35, 0.5), steel: std(0x8a929e, 0.7, 0.45), steel2: std(0x5f6773, 0.7, 0.5), dark: std(0x1a1d23, 0.7, 0.5), plate: std(0x3a414c, 0.7, 0.5),
      rust: std(0x8a4b2a, 0.5, 0.75), hazK: std(0x15171b, 0.3, 0.7), cable: std(0x0f1115, 0.3, 0.6), brass: std(0xb58a3c, 0.8, 0.35), red: std(0xc23a2a, 0.4, 0.55),
      h1: std(0x9aa3ae, 0.85, 0.3), h2: std(0x77809a, 0.85, 0.3), h3: std(0x5f5a78, 0.85, 0.32), h4: std(0x5a3d33, 0.85, 0.4), h5: std(0x2d2421, 0.8, 0.5),
      glow: new THREE.MeshBasicMaterial({ color: C.glow, side: THREE.DoubleSide }), core: new THREE.MeshBasicMaterial({ color: 0xeaffff, side: THREE.DoubleSide }),
      lamp: new THREE.MeshBasicMaterial({ color: 0xff3b30, side: THREE.DoubleSide }), led: new THREE.MeshBasicMaterial({ color: 0x35ff7a, side: THREE.DoubleSide }), amber: new THREE.MeshBasicMaterial({ color: 0xffb020, side: THREE.DoubleSide }),
      halo: new THREE.MeshBasicMaterial({ color: C.glow, transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })
    };
    var UB = new THREE.BoxGeometry(1, 1, 1), _cyl = {};
    function add(parent, geo, mat, x, y, z) { var m = new THREE.Mesh(geo, mat); m.position.set(x || 0, y || 0, z || 0); parent.add(m); return m; }
    function roundedBox(w, h, d, r) {
      var g = new THREE.BoxGeometry(w, h, d, 3, 3, 3), pos = g.attributes.position, nor = g.attributes.normal;
      var hx = w / 2 - r, hy = h / 2 - r, hz = d / 2 - r, v = new THREE.Vector3(), inn = new THREE.Vector3(), n = new THREE.Vector3();
      for (var i = 0; i < pos.count; i++) {
        v.set(pos.getX(i), pos.getY(i), pos.getZ(i));
        inn.set(Math.max(-hx, Math.min(hx, v.x)), Math.max(-hy, Math.min(hy, v.y)), Math.max(-hz, Math.min(hz, v.z)));
        n.set(v.x - inn.x, v.y - inn.y, v.z - inn.z);
        if (n.lengthSq() > 1e-12) { n.normalize(); v.set(inn.x + n.x * r, inn.y + n.y * r, inn.z + n.z * r); nor.setXYZ(i, n.x, n.y, n.z); }
        pos.setXYZ(i, v.x, v.y, v.z);
      }
      return g;
    }
    function box(parent, w, h, d, mat, x, y, z, r) { return add(parent, roundedBox(w, h, d, r || Math.min(0.03, Math.min(w, h, d) * 0.3)), mat, x, y, z); }
    /* Sólido de revolución con eje en Z: perfil [[r, z], ...] con z creciente; spline suave. */
    function latheZ(prof, seg, smooth) {
      var ctrl = [], i, pts = [];
      for (i = 0; i < prof.length; i++) ctrl.push(new THREE.Vector2(prof[i][0], prof[i][1]));
      var raw = smooth === false ? ctrl : new THREE.SplineCurve(ctrl).getPoints(prof.length * 8);
      for (i = 0; i < raw.length; i++) pts.push(new THREE.Vector2(Math.max(0, raw[i].x), raw[i].y));
      var g = new THREE.LatheGeometry(pts, seg || 40);
      g.rotateX(P / 2);
      return g;
    }
    function ring(parent, r, tube, z, mat, seg) { var t = new THREE.Mesh(new THREE.TorusGeometry(r, tube, 8, seg || 40), mat); t.position.z = z; parent.add(t); return t; }
    /* Reparte n copias de una geometría alrededor del eje Z (local x = radial). */
    function around(parent, geo, mat, n, r, z, sx, sy, sz, off, tilt) {
      var mesh = new THREE.InstancedMesh(geo, mat, n), d = new THREE.Object3D();
      for (var i = 0; i < n; i++) {
        var a = (off || 0) + i / n * TAU;
        d.position.set(Math.cos(a) * r, Math.sin(a) * r, z); d.rotation.set(0, tilt || 0, 0); d.rotation.z = a;
        d.scale.set(sx, sy, sz); d.updateMatrix(); mesh.setMatrixAt(i, d.matrix);
      }
      mesh.instanceMatrix.needsUpdate = true; mesh.frustumCulled = false; parent.add(mesh); return mesh;
    }
    var _up = new THREE.Vector3(0, 1, 0), _dir = new THREE.Vector3();
    function strut(parent, a, b, r, mat) {
      var g = _cyl[r] || (_cyl[r] = new THREE.CylinderGeometry(r, r, 1, 8)), m = new THREE.Mesh(g, mat);
      var dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2], len = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1e-4;
      m.position.set((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2);
      _dir.set(dx / len, dy / len, dz / len); m.quaternion.setFromUnitVectors(_up, _dir); m.scale.set(1, len, 1);
      parent.add(m); return m;
    }
    function pol(r, a, z) { return [Math.cos(a) * r, Math.sin(a) * r, z]; }
    /* Cilindro con eje en Z */
    function cylZ(parent, r1, r2, len, mat, x, y, z, seg) { var g = new THREE.CylinderGeometry(r1, r2, len, seg || 18); g.rotateX(P / 2); return add(parent, g, mat, x, y, z); }
    /* Tornillos alrededor de un anillo (cabezas cilíndricas pequeñas, ejes en Z) */
    function bolts(parent, n, r, z, size, mat) {
      var g = new THREE.CylinderGeometry(1, 1, 1, 6); g.rotateX(P / 2);
      return around(parent, g, mat || M.steel, n, r, z, size, size, size * 0.8, 0.1, 0);
    }
    function glowDisc(parent, r, z, mat) { var d = add(parent, new THREE.CircleGeometry(r, 28), mat || M.glow, 0, 0, z); d.rotation.y = P; return d; }
    function tube(parent, pts, r, mat, seg) {
      var v = []; for (var i = 0; i < pts.length; i++) v.push(new THREE.Vector3(pts[i][0], pts[i][1], pts[i][2]));
      var m = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(v), seg || 24, r, 10, false), mat); parent.add(m); return m;
    }
    /* Embudo (trompeta de admisión) con eje en Y: perfil [[r, y], ...] */
    function funnel(prof, seg) {
      var pts = []; for (var i = 0; i < prof.length; i++) pts.push(new THREE.Vector2(prof[i][0], prof[i][1]));
      return new THREE.LatheGeometry(pts, seg || 20);
    }
    /* Franja de peligro: n bloques alternando amarillo/negro entre p0 y p1; size = tamaño de cada bloque */
    function haz(parent, n, p0, p1, size) {
      var na = Math.ceil(n / 2), nb = Math.floor(n / 2), ma = new THREE.InstancedMesh(UB, M.yellow, na), mb = new THREE.InstancedMesh(UB, M.hazK, Math.max(1, nb)), d = new THREE.Object3D(), ia = 0, ib = 0, i, t;
      for (i = 0; i < n; i++) {
        t = (i + 0.5) / n; d.position.set(p0[0] + (p1[0] - p0[0]) * t, p0[1] + (p1[1] - p0[1]) * t, p0[2] + (p1[2] - p0[2]) * t);
        d.rotation.set(0, 0, 0); d.scale.set(size[0], size[1], size[2]); d.updateMatrix();
        if (i % 2) mb.setMatrixAt(ib++, d.matrix); else ma.setMatrixAt(ia++, d.matrix);
      }
      ma.count = ia; mb.count = ib; ma.frustumCulled = false; mb.frustumCulled = false; parent.add(ma); parent.add(mb);
    }
    function base(name, size) {
      var g = new THREE.Group(); g.name = name;
      var mount = new THREE.Object3D(); mount.name = 'mount'; g.add(mount);
      var exhaust = new THREE.Object3D(); exhaust.name = 'exhaust'; g.add(exhaust);
      return { group: g, mount: mount, exhaust: exhaust };
    }
    return { THREE: THREE, P: P, TAU: TAU, C: C, M: M, UB: UB, rnd: rnd, add: add, box: box, roundedBox: roundedBox, latheZ: latheZ, ring: ring, around: around, strut: strut, pol: pol, cylZ: cylZ, bolts: bolts, glowDisc: glowDisc, base: base, tube: tube, funnel: funnel, haz: haz };
  }


  /* ============================== MULA (pequeño) ============================== */
  /* Propulsor iónico de rejilla: caja industrial con placas amarillas, disipadores, tanque de xenón con correas,
     cableado y tuberías con válvulas, y una rejilla cuadrada de 99 haces azules en la cara de salida. */
  function createMotorMula(THREE, opts) {
    var K = _cargaKit(THREE, opts), M = K.M, P = K.P, TAU = K.TAU, b = K.base('Mula', 'pequeno'), g = b.group, i, j, k;
    var L = 1.75;
    // placa base con borde de peligro, tornillos y argollas de izado
    K.box(g, 1.8, 1.6, 0.14, M.plate, 0, 0, 0.07, 0.03);
    K.haz(g, 12, [-0.82, 0.74, 0.15], [0.82, 0.74, 0.15], [0.137, 0.08, 0.02]); K.haz(g, 12, [-0.82, -0.74, 0.15], [0.82, -0.74, 0.15], [0.137, 0.08, 0.02]);
    K.haz(g, 10, [-0.86, -0.66, 0.15], [-0.86, 0.66, 0.15], [0.08, 0.132, 0.02]); K.haz(g, 10, [0.86, -0.66, 0.15], [0.86, 0.66, 0.15], [0.08, 0.132, 0.02]);
    [[-0.7, -0.6], [0.7, -0.6], [-0.7, 0.6], [0.7, 0.6], [0, -0.66], [0, 0.66]].forEach(function (p) { K.add(g, new THREE.CylinderGeometry(0.05, 0.05, 0.05, 6).rotateX(P / 2), M.steel, p[0], p[1], 0.16); });
    [-0.62, 0.62].forEach(function (x) { var lug = K.add(g, new THREE.TorusGeometry(0.11, 0.028, 8, 16), M.steel, x, 0.84, 0.1); lug.rotation.y = P / 2; K.box(g, 0.08, 0.1, 0.1, M.plate, x, 0.78, 0.1, 0.01); });
    // carcasa
    K.box(g, 1.36, 1.16, 1.2, M.steel2, 0, 0, 0.75, 0.07);
    K.box(g, 1.2, 0.04, 1.1, M.dark, 0, 0.58, 0.75, 0.01);
    [-1, 1].forEach(function (s) {
      K.box(g, 0.06, 0.96, 0.92, M.yellow, s * 0.7, 0.02, 0.75, 0.02);
      for (j = 0; j < 2; j++) for (i = 0; i < 3; i++) K.add(g, new THREE.CylinderGeometry(0.03, 0.03, 0.05, 6).rotateZ(P / 2), M.steel, s * 0.74, -0.3 + j * 0.64, 0.45 + i * 0.3);
      for (i = 0; i < 5; i++) K.box(g, 0.02, 0.5, 0.05, M.dark, s * 0.735, 0.02, 0.5 + i * 0.12, 0.004);       // ranuras de ventilación
      K.box(g, 0.04, 0.16, 0.22, M.hazK, s * 0.735, 0.4, 1.1, 0.01); K.box(g, 0.045, 0.14, 0.2, M.amber, s * 0.738, 0.4, 1.1, 0.01);
    });
    // disipadores inferiores y superiores
    for (i = 0; i < 12; i++) { K.box(g, 1.2, 0.3, 0.025, M.steel, 0, -0.73, 0.28 + i * 0.09, 0.004); }
    K.box(g, 1.22, 0.04, 1.1, M.dark, 0, -0.58, 0.78, 0.01);
    // tanque de xenón con cuna y correas
    K.box(g, 0.7, 0.1, 0.7, M.plate, 0, 0.64, 0.85, 0.02);
    K.add(g, new THREE.SphereGeometry(0.32, 22, 16), M.steel, 0, 0.98, 0.85);
    [0.0, 0.2].forEach(function (dz) { var st = K.ring(g, 0.325, 0.022, 0, M.yellow, 28); st.rotation.x = P / 2; st.position.set(0, 0.98 + (dz ? 0.08 : -0.08), 0.85); st.scale.set(1, 1, 1); });
    K.box(g, 0.06, 0.06, 0.06, M.steel, 0.325, 0.9, 0.85, 0.01); K.box(g, 0.06, 0.06, 0.06, M.steel, -0.325, 0.9, 0.85, 0.01);
    K.add(g, new THREE.CylinderGeometry(0.05, 0.06, 0.1, 10), M.brass, 0, 1.31, 0.85);
    var gau = K.add(g, new THREE.CylinderGeometry(0.07, 0.07, 0.04, 14), M.dark, 0.2, 1.22, 0.7); gau.rotation.z = 0.7;
    K.add(g, new THREE.CircleGeometry(0.05, 12), M.amber, 0.23, 1.25, 0.7).rotation.y = 0.0;
    // caja de control con LEDs
    K.box(g, 0.46, 0.2, 0.36, M.yellow, 0.35, 0.67, 0.35, 0.03);
    [M.led, M.led, M.amber, M.led, M.lamp].forEach(function (m, n) { K.add(g, new THREE.CylinderGeometry(0.02, 0.02, 0.03, 8), m, 0.19 + n * 0.08, 0.78, 0.26); });
    K.box(g, 0.3, 0.02, 0.2, M.dark, 0.35, 0.775, 0.42, 0.005);
    // tuberías de refrigerante con válvulas, y mazo de cables con abrazaderas
    [-1, 1].forEach(function (s) {
      K.tube(g, [[s * 0.6, 0.4, 0.25], [s * 0.78, 0.5, 0.3], [s * 0.8, 0.2, 0.9], [s * 0.7, -0.1, 1.3]], 0.04, s < 0 ? M.brass : M.steel, 24);
      K.box(g, 0.12, 0.12, 0.12, M.red, s * 0.8, 0.28, 0.6, 0.02);
      var vw = K.add(g, new THREE.TorusGeometry(0.1, 0.018, 6, 14), M.red, s * 0.8, 0.42, 0.6); vw.rotation.x = P / 2;
      K.strut(g, [s * 0.8, 0.34, 0.6], [s * 0.8, 0.42, 0.6], 0.016, M.steel);
    });
    K.tube(g, [[-0.3, 0.55, 0.3], [-0.45, 0.62, 0.7], [-0.62, 0.2, 1.1], [-0.58, 0.0, 1.35]], 0.03, M.cable, 22);
    K.tube(g, [[-0.22, 0.55, 0.3], [-0.38, 0.64, 0.7], [-0.55, 0.22, 1.1], [-0.5, 0.0, 1.35]], 0.025, M.cable, 22);
    [0.5, 0.8].forEach(function (z) { K.box(g, 0.1, 0.05, 0.04, M.steel, -0.42 - (z - 0.5) * 0.1, 0.63, z, 0.005); });
    // rejilla iónica: marco, placa trasera, 99 haces luminosos y barras
    var gz = 1.4;
    K.box(g, 1.22, 0.08, 0.2, M.steel, 0, 0.5, gz + 0.05, 0.02); K.box(g, 1.22, 0.08, 0.2, M.steel, 0, -0.5, gz + 0.05, 0.02);
    K.box(g, 0.08, 1.0, 0.2, M.steel, -0.57, 0, gz + 0.05, 0.02); K.box(g, 0.08, 1.0, 0.2, M.steel, 0.57, 0, gz + 0.05, 0.02);
    K.box(g, 1.1, 0.92, 0.04, M.dark, 0, 0, gz + 0.02, 0.005);
    var beams = new THREE.InstancedMesh(new THREE.CylinderGeometry(1, 1, 1, 8).rotateX(P / 2), M.glow, 99), dd = new THREE.Object3D(), bi = 0;
    for (j = 0; j < 9; j++) for (i = 0; i < 11; i++) { dd.position.set(-0.45 + i * 0.09, -0.36 + j * 0.09, gz + 0.06); dd.rotation.set(0, 0, 0); dd.scale.set(0.028, 0.028, 0.06); dd.updateMatrix(); beams.setMatrixAt(bi++, dd.matrix); }
    beams.frustumCulled = false; g.add(beams);
    for (i = 0; i < 12; i++) K.box(g, 0.012, 0.86, 0.012, M.steel2, -0.495 + i * 0.09, 0, gz + 0.11, 0.002);
    for (j = 0; j < 10; j++) K.box(g, 1.08, 0.012, 0.012, M.steel2, 0, -0.405 + j * 0.09, gz + 0.11, 0.002);
    var hz = K.add(g, new THREE.PlaneGeometry(1.15, 0.95), M.halo, 0, 0, gz + 0.22); hz.rotation.y = P;
    // neutralizador (cátodo) y soportes diagonales
    K.cylZ(g, 0.04, 0.06, 0.34, M.brass, 0.42, 0.52, gz + 0.14, 10); K.add(g, new THREE.SphereGeometry(0.035, 8, 6), M.core, 0.42, 0.52, gz + 0.32);
    K.strut(g, [0.42, 0.58, gz - 0.1], [0.42, 0.52, gz + 0.05], 0.02, M.steel);
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(function (c) { K.strut(g, [c[0] * 0.62, c[1] * 0.5, 1.2], [c[0] * 0.58, c[1] * 0.48, gz + 0.1], 0.03, M.plate); });
    K.haz(g, 8, [-0.5, 0.0, 0.42], [0.5, 0.0, 0.42], [0.125, 0.06, 0.02]);
    K.box(g, 0.34, 0.12, 0.012, M.yellow, 0, -0.6, 1.36, 0.003);
    b.exhaust.position.z = L;
    return { group: g, name: 'Mula', size: 'pequeno', length: L, width: 1.9, height: 1.9, mount: b.mount, exhaust: b.exhaust };
  }

  /* ============================== BUEY (mediano) ============================== */
  /* Motor de tanque integrado: jaula estructural con tirantes en X, barril de propelente con costillas, correas y manómetros,
     turbobombas con volutas y válvulas de rueda, y una tobera telescópica de cinco anillos anidados con actuadores. */
  function createMotorBuey(THREE, opts) {
    var K = _cargaKit(THREE, opts), M = K.M, P = K.P, TAU = K.TAU, b = K.base('Buey', 'mediano'), g = b.group, i, j, k;
    var L = 4.7, CX = 1.15;
    // placa de montaje, tornillería y argollas
    K.box(g, 2.7, 2.7, 0.18, M.plate, 0, 0, 0.09, 0.04);
    K.haz(g, 16, [-1.2, 1.28, 0.19], [1.2, 1.28, 0.19], [0.15, 0.1, 0.02]); K.haz(g, 16, [-1.2, -1.28, 0.19], [1.2, -1.28, 0.19], [0.15, 0.1, 0.02]);
    for (i = 0; i < 10; i++) { K.add(g, new THREE.CylinderGeometry(0.06, 0.06, 0.06, 6).rotateX(P / 2), M.steel, -1.1 + i * 0.245, 1.05, 0.2); K.add(g, new THREE.CylinderGeometry(0.06, 0.06, 0.06, 6).rotateX(P / 2), M.steel, -1.1 + i * 0.245, -1.05, 0.2); }
    [[-1, 1], [1, 1]].forEach(function (c) { var lg = K.add(g, new THREE.TorusGeometry(0.14, 0.035, 8, 16), M.steel, c[0] * 1.1, 1.4, 0.1); lg.rotation.y = P / 2; });
    // jaula estructural: 4 montantes, 4 marcos cuadrados y tirantes en X
    var zs = [0.3, 1.3, 2.3, 3.2];
    [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(function (c) {
      K.box(g, 0.16, 0.16, 3.0, M.steel2, c[0] * CX, c[1] * CX, 1.8, 0.02);
      K.haz(g, 12, [c[0] * CX, c[1] * CX + 0.085, 0.5], [c[0] * CX, c[1] * CX + 0.085, 3.1], [0.1, 0.018, 0.2]);
    });
    zs.forEach(function (z) {
      K.box(g, CX * 2 + 0.16, 0.12, 0.12, M.steel2, 0, CX, z, 0.015); K.box(g, CX * 2 + 0.16, 0.12, 0.12, M.steel2, 0, -CX, z, 0.015);
      K.box(g, 0.12, CX * 2, 0.12, M.steel2, CX, 0, z, 0.015); K.box(g, 0.12, CX * 2, 0.12, M.steel2, -CX, 0, z, 0.015);
    });
    for (k = 0; k < 2; k++) {
      var za = zs[k], zb = zs[k + 1];
      [[-CX, -CX, CX, -CX], [CX, -CX, CX, CX], [CX, CX, -CX, CX], [-CX, CX, -CX, -CX]].forEach(function (e, n) {
        var x0 = e[0], y0 = e[1], x1 = e[2], y1 = e[3];
        K.strut(g, [x0, y0, za], [x1, y1, zb], 0.028, M.steel); K.strut(g, [x1, y1, za], [x0, y0, zb], 0.028, M.steel);
      });
    }
    // barril de propelente con domos, costillas, correas y bandas de peligro
    K.cylZ(g, 0.7, 0.7, 2.2, M.yellow, 0, 0, 1.6, 36);
    var dm = new THREE.SphereGeometry(0.7, 28, 12, 0, TAU, 0, P / 2); dm.rotateX(-P / 2); dm.scale(1, 1, 0.55); K.add(g, dm, M.yellow, 0, 0, 0.5);
    var dm2 = new THREE.SphereGeometry(0.7, 28, 12, 0, TAU, 0, P / 2); dm2.rotateX(P / 2); dm2.scale(1, 1, 0.55); K.add(g, dm2, M.yellow, 0, 0, 2.7);
    for (i = 0; i < 7; i++) K.ring(g, 0.705, 0.03, 0.75 + i * 0.32, M.steel2, 40);
    [0.9, 1.6, 2.3].forEach(function (z) { K.ring(g, 0.72, 0.035, z, M.dark, 40); K.around(g, K.UB, M.steel, 2, 0.74, z, 0.06, 0.1, 0.08, 0.0, 0); });
    K.around(g, K.UB, M.hazK, 12, 0.705, 1.6, 0.02, 0.2, 0.26, 0.0, 0); K.around(g, K.UB, M.hazK, 12, 0.705, 1.2, 0.02, 0.2, 0.26, 0.26, 0);
    [0.2, 0.6, -0.4].forEach(function (a, n) { var gz2 = 1.0 + n * 0.5; K.add(g, new THREE.CylinderGeometry(0.1, 0.1, 0.06, 16), M.dark, 0, 0.74, gz2); K.add(g, new THREE.CircleGeometry(0.08, 14), n === 1 ? M.amber : M.led, 0, 0.775, gz2).rotation.x = -P / 2; });
    K.add(g, new THREE.CylinderGeometry(0.1, 0.12, 0.12, 12), M.brass, 0, 0.78, 2.0); K.add(g, new THREE.CylinderGeometry(0.07, 0.07, 0.1, 10), M.steel, 0, 0.88, 2.0);
    // turbobombas arriba y abajo, con volutas y tuberías hacia la cámara
    [-1, 1].forEach(function (s) {
      var py = s * 0.97;
      K.cylZ(g, 0.2, 0.2, 0.95, M.steel2, 0, py, 1.9, 22);
      K.cylZ(g, 0.12, 0.12, 0.3, M.plate, 0, py, 1.3, 14);
      var vo = K.add(g, new THREE.TorusGeometry(0.2, 0.08, 8, 22), M.steel, 0, py, 2.38); vo.scale.set(1, 1, 1);
      K.box(g, 0.34, 0.1, 0.1, M.yellow, 0, py + s * 0.18, 1.9, 0.02);
      K.bolts(g, 10, 0.21, 1.45, 0.03, M.steel);
      K.tube(g, [[0, py, 2.38], [0.0, py * 0.7, 2.7], [0.1, py * 0.45, 2.95], [0.0, 0.0, 3.1]], 0.05, M.brass, 24);
      var vw = K.add(g, new THREE.TorusGeometry(0.15, 0.022, 6, 16), M.red, 0.3, py * 0.85, 2.6); vw.rotation.y = P / 2;
      for (i = 0; i < 4; i++) { var sa = i * P / 2; K.strut(g, [0.3, py * 0.85, 2.6], [0.3, py * 0.85 + Math.cos(sa) * 0.15, 2.6 + Math.sin(sa) * 0.15], 0.012, M.red); }
      K.strut(g, [0.0, py * 0.78, 2.62], [0.3, py * 0.85, 2.6], 0.02, M.steel);
    });
    // cámara y brida de la tobera
    K.cylZ(g, 0.4, 0.42, 0.5, M.steel2, 0, 0, 3.05, 24);
    K.ring(g, 0.42, 0.05, 3.3, M.yellow, 28); K.bolts(g, 16, 0.42, 3.32, 0.035, M.steel);
    // tobera telescópica: cinco anillos anidados que se ensanchan
    var segs = [];
    for (i = 0; i < 5; i++) {
      var z0 = 3.15 + i * 0.28, z1 = z0 + 0.45, r0 = 0.4 + i * 0.14, r1 = 0.4 + (i + 1) * 0.14;
      K.add(g, K.latheZ([[r0, z0], [(r0 + r1) / 2, (z0 + z1) / 2], [r1, z1]], 40, false), i % 2 ? M.steel2 : M.steel, 0, 0, 0);
      K.ring(g, r1 + 0.01, 0.045, z1, i % 2 ? M.yellow : M.plate, 40);
      K.ring(g, r0 + 0.005, 0.025, z0 + 0.04, M.dark, 40);
      segs.push({ r: r1, z: z1 });
    }
    K.add(g, K.latheZ([[0.36, 3.2], [0.45, 3.6], [0.68, 4.2], [1.0, 4.62]], 36), M.dark, 0, 0, 0);
    [M.h1, M.h2, M.h3, M.h4, M.h5].forEach(function (m, n) { K.ring(g, 0.97 + n * 0.0, 0.03, 4.0 + n * 0.14, m, 40).scale.set(1 + n * 0.0, 1 + n * 0.0, 1); });
    K.glowDisc(g, 0.34, 3.5, M.glow); K.glowDisc(g, 0.2, 3.42, M.core);
    var hz = K.add(g, new THREE.CircleGeometry(1.0, 32), M.halo, 0, 0, 4.66); hz.rotation.y = P;
    // actuadores hidráulicos entre la jaula y la tobera
    [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(function (c) {
      var ra = Math.atan2(c[1], c[0]), a0 = [c[0] * CX, c[1] * CX, 3.2], a1 = K.pol(0.8, ra, 3.9), am = [(a0[0] + a1[0]) / 2, (a0[1] + a1[1]) / 2, (a0[2] + a1[2]) / 2];
      K.strut(g, a0, am, 0.07, M.dark); K.strut(g, am, a1, 0.045, M.steel);
      K.add(g, new THREE.SphereGeometry(0.08, 10, 8), M.steel, a0[0], a0[1], a0[2]); K.add(g, new THREE.SphereGeometry(0.07, 10, 8), M.steel, a1[0], a1[1], a1[2]);
    });
    // luces de aviso, placa de datos y asideros
    [[-1, -1], [1, 1]].forEach(function (c) { K.add(g, new THREE.SphereGeometry(0.07, 10, 8), M.lamp, c[0] * CX, c[1] * CX, 3.3); });
    K.box(g, 0.5, 0.25, 0.02, M.dark, CX + 0.0, 0.0, 0.75, 0.005).position.set(CX + 0.1, 0, 0.75);
    K.box(g, 0.36, 0.015, 0.012, M.yellow, CX + 0.1, 0.06, 0.765, 0.003);
    [0.9, 2.0].forEach(function (z) { K.strut(g, [-CX - 0.1, 0.3, z], [-CX - 0.1, -0.3, z], 0.03, M.yellow); K.strut(g, [-CX - 0.1, 0.3, z], [-CX, 0.3, z], 0.025, M.steel); K.strut(g, [-CX - 0.1, -0.3, z], [-CX, -0.3, z], 0.025, M.steel); });
    b.exhaust.position.z = L;
    return { group: g, name: 'Buey', size: 'mediano', length: L, width: 2.9, height: 3.0, mount: b.mount, exhaust: b.exhaust };
  }

  /* ============================== MAMUT (grande) ============================== */
  /* Racimo de cuatro motores en una estructura cuadrada: placa de empuje, armadura de celosía, cámaras con turbobombas,
     campanas con bandas de calor, cardán con actuadores, pasarela perimetral con barandillas y colector central con fuelles. */
  function createMotorMamut(THREE, opts) {
    var K = _cargaKit(THREE, opts), M = K.M, P = K.P, TAU = K.TAU, b = K.base('Mamut', 'grande'), g = b.group, i, j, k;
    var L = 6.3, EC = 1.2;
    // placa de empuje con nervios, tornillería y argollas
    K.box(g, 5.0, 5.0, 0.3, M.plate, 0, 0, 0.15, 0.05);
    for (i = -2; i <= 2; i++) { K.box(g, 0.1, 4.8, 0.08, M.steel2, i * 0.95, 0, 0.34, 0.01); K.box(g, 4.8, 0.1, 0.08, M.steel2, 0, i * 0.95, 0.34, 0.01); }
    K.haz(g, 24, [-2.4, 2.38, 0.31], [2.4, 2.38, 0.31], [0.2, 0.12, 0.02]); K.haz(g, 24, [-2.4, -2.38, 0.31], [2.4, -2.38, 0.31], [0.2, 0.12, 0.02]);
    K.haz(g, 24, [-2.38, -2.4, 0.31], [-2.38, 2.4, 0.31], [0.12, 0.2, 0.02]); K.haz(g, 24, [2.38, -2.4, 0.31], [2.38, 2.4, 0.31], [0.12, 0.2, 0.02]);
    for (j = 0; j < 5; j++) for (i = 0; i < 5; i++) if ((i + j) % 2 === 0) K.add(g, new THREE.CylinderGeometry(0.07, 0.07, 0.06, 6).rotateX(P / 2), M.steel, -1.9 + i * 0.95, -1.9 + j * 0.95, 0.4);
    [[-2.2, 2.2], [2.2, 2.2], [-2.2, -2.2], [2.2, -2.2]].forEach(function (c) { var lg = K.add(g, new THREE.TorusGeometry(0.2, 0.05, 8, 18), M.steel, c[0], c[1], 0.16); lg.rotation.x = c[1] > 0 ? P / 2 : P / 2; lg.position.set(c[0] * 1.08, c[1] * 1.08, 0.16); });
    // armadura de celosía entre la placa y la cubierta de motores
    var TZ0 = 0.3, TZ1 = 2.0, TR = 2.0;
    [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(function (c) {
      K.box(g, 0.22, 0.22, TZ1 - TZ0, M.steel2, c[0] * TR, c[1] * TR, (TZ0 + TZ1) / 2, 0.02);
      K.haz(g, 8, [c[0] * TR, c[1] * TR + 0.115, TZ0 + 0.1], [c[0] * TR, c[1] * TR + 0.115, TZ1 - 0.1], [0.12, 0.02, 0.2]);
    });
    [0.3, 1.15, 2.0].forEach(function (z) {
      K.box(g, TR * 2 + 0.2, 0.14, 0.14, M.steel2, 0, TR, z, 0.02); K.box(g, TR * 2 + 0.2, 0.14, 0.14, M.steel2, 0, -TR, z, 0.02);
      K.box(g, 0.14, TR * 2, 0.14, M.steel2, TR, 0, z, 0.02); K.box(g, 0.14, TR * 2, 0.14, M.steel2, -TR, 0, z, 0.02);
    });
    [[0.3, 1.15], [1.15, 2.0]].forEach(function (zz, n) {
      [[-TR, -TR, TR, -TR], [TR, -TR, TR, TR], [TR, TR, -TR, TR], [-TR, TR, -TR, -TR]].forEach(function (e) {
        var fl = n % 2;
        K.strut(g, [e[0], e[1], zz[0]], [e[2], e[3], zz[1]], 0.03, M.steel); K.strut(g, [e[2], e[3], zz[0]], [e[0], e[1], zz[1]], 0.03, M.steel);
      });
    });
    // colector central con ramales a cada motor y fuelles
    K.cylZ(g, 0.24, 0.24, 1.6, M.steel, 0, 0, 1.1, 20);
    for (i = 0; i < 6; i++) K.ring(g, 0.255, 0.035, 0.5 + i * 0.22, i % 2 ? M.plate : M.steel2, 24);
    K.ring(g, 0.3, 0.06, 0.4, M.yellow, 28); K.ring(g, 0.3, 0.06, 1.85, M.yellow, 28);
    // cubierta de motores con aberturas y lámina térmica dorada
    K.box(g, 4.5, 4.5, 0.22, M.steel2, 0, 0, 2.1, 0.03);
    K.box(g, 4.2, 4.2, 0.03, M.brass, 0, 0, 2.23, 0.01);
    [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(function (c, n) {
      var ex = c[0] * EC, ey = c[1] * EC, eg = new THREE.Group(); eg.position.set(ex, ey, 0); g.add(eg);
      K.cylZ(eg, 0.5, 0.5, 0.1, M.dark, 0, 0, 2.27, 24);
      K.ring(eg, 0.5, 0.05, 2.28, M.yellow, 30); K.bolts(eg, 12, 0.5, 2.3, 0.03, M.steel);
      // cámara de combustión
      K.cylZ(eg, 0.4, 0.42, 0.7, M.steel, 0, 0, 2.65, 26);
      K.ring(eg, 0.42, 0.04, 2.4, M.steel2, 28); K.ring(eg, 0.42, 0.04, 2.85, M.steel2, 28);
      // turbobomba con voluta y tuberías
      var pa = Math.atan2(c[1], c[0]), pp = K.pol(0.62, pa, 0);
      K.cylZ(eg, 0.2, 0.2, 0.8, M.steel2, pp[0], pp[1], 2.7, 20);
      K.add(eg, new THREE.TorusGeometry(0.2, 0.07, 8, 20), M.steel, pp[0], pp[1], 3.12);
      K.bolts(eg, 8, 0.0, 2.3, 0.0, M.steel);
      K.tube(eg, [[pp[0], pp[1], 3.12], [pp[0] * 0.6, pp[1] * 0.6, 3.25], [0.0, 0.0, 3.1]], 0.045, M.brass, 18);
      K.tube(eg, [[pp[0], pp[1], 2.3], [pp[0] * 0.9, pp[1] * 0.9, 2.2], [0.1 * c[0], 0.1 * c[1], 2.1]], 0.05, M.steel, 14);
      // campana con bandas
      var bell = [[0.34, 2.95], [0.28, 3.2], [0.34, 3.7], [0.55, 4.5], [0.86, 5.8]];
      K.add(eg, K.latheZ(bell, 40), M.steel2, 0, 0, 0);
      K.add(eg, K.latheZ([[0.3, 3.0], [0.26, 3.2], [0.32, 3.7], [0.52, 4.5], [0.83, 5.8]], 36), M.dark, 0, 0, 0);
      for (i = 0; i < 6; i++) { var zr = 3.5 + i * 0.4, rr = 0.3 + Math.pow((zr - 3.2) / 2.6, 1.3) * 0.55; K.ring(eg, rr + 0.03, 0.035, zr, i % 3 === 0 ? M.yellow : M.plate, 40); }
      [M.h1, M.h2, M.h3, M.h4, M.h5].forEach(function (m, q) { K.ring(eg, 0.82 + q * 0.012, 0.03, 5.05 + q * 0.15, m, 40); });
      K.ring(eg, 0.87, 0.04, 5.8, M.h5, 40);
      K.glowDisc(eg, 0.3, 3.8, M.glow); K.glowDisc(eg, 0.18, 3.72, M.core);
      var hh = K.add(eg, new THREE.CircleGeometry(0.85, 28), M.halo, 0, 0, 5.82); hh.rotation.y = P;
      // actuadores de cardán
      [0, 1].forEach(function (q) {
        var ga = pa + P / 2 + q * P, g0 = K.pol(0.62, ga, 2.3), g1 = K.pol(0.38, ga, 3.4), gm = [(g0[0] + g1[0]) / 2, (g0[1] + g1[1]) / 2, (g0[2] + g1[2]) / 2];
        K.strut(eg, g0, gm, 0.05, M.dark); K.strut(eg, gm, g1, 0.034, M.steel);
        K.add(eg, new THREE.SphereGeometry(0.055, 8, 6), M.steel, g0[0], g0[1], g0[2]); K.add(eg, new THREE.SphereGeometry(0.05, 8, 6), M.steel, g1[0], g1[1], g1[2]);
      });
      // ramal del colector con fuelle hacia el motor
      var br = K.tube(eg, [[-ex * 0.0 - ex, -ey, 1.6], [-ex * 0.6, -ey * 0.6, 1.9], [-ex * 0.2, -ey * 0.2, 2.05], [0.0, 0.0, 2.2]], 0.07, M.steel, 20);
      K.add(eg, new THREE.TorusGeometry(0.1, 0.03, 6, 14), M.yellow, -ex * 0.2, -ey * 0.2, 2.05);
    });
    // marco entre campanas con pasarela perimetral y barandillas
    var FZ = 4.2, FR = 2.15;
    [-1, 1].forEach(function (s) {
      K.box(g, FR * 2, 0.14, 0.14, M.steel2, 0, s * FR, FZ, 0.02); K.box(g, 0.14, FR * 2, 0.14, M.steel2, s * FR, 0, FZ, 0.02);
      K.box(g, FR * 2 - 0.3, 0.5, 0.03, M.dark, 0, s * (FR + 0.12), FZ + 0.06, 0.005); K.box(g, 0.5, FR * 2 - 0.3, 0.03, M.dark, s * (FR + 0.12), 0, FZ + 0.06, 0.005);
      K.box(g, FR * 2 + 0.2, 0.04, 0.04, M.yellow, 0, s * (FR + 0.34), FZ + 0.52, 0.005); K.box(g, 0.04, FR * 2 + 0.2, 0.04, M.yellow, s * (FR + 0.34), 0, FZ + 0.52, 0.005);
    });
    for (i = 0; i < 9; i++) { var pxx = -2.15 + i * 0.5375; [-1, 1].forEach(function (s) { K.box(g, 0.04, 0.04, 0.54, M.yellow, pxx, s * (FR + 0.34), FZ + 0.25, 0.005); K.box(g, 0.04, 0.04, 0.54, M.yellow, s * (FR + 0.34), pxx, FZ + 0.25, 0.005); }); }
    K.box(g, 0.12, 2 * FR, 0.12, M.steel2, 0, 0, FZ, 0.015); K.box(g, 2 * FR, 0.12, 0.12, M.steel2, 0, 0, FZ, 0.015);
    [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(function (c) { K.strut(g, [c[0] * FR, c[1] * FR, FZ], [c[0] * EC, c[1] * EC, FZ], 0.04, M.steel); K.add(g, new THREE.SphereGeometry(0.07, 8, 6), M.lamp, c[0] * FR, c[1] * FR, FZ + 0.1); });
    K.haz(g, 18, [-2.0, FR, FZ + 0.075], [2.0, FR, FZ + 0.075], [0.22, 0.14, 0.02]); K.haz(g, 18, [-2.0, -FR, FZ + 0.075], [2.0, -FR, FZ + 0.075], [0.22, 0.14, 0.02]);
    b.exhaust.position.z = L;
    return { group: g, name: 'Mamut', size: 'grande', length: L, width: 5.2, height: 5.2, mount: b.mount, exhaust: b.exhaust };
  }

  var tablaCarga = { pequeno: createMotorMula, mediano: createMotorBuey, grande: createMotorMamut };
  function obtenerMotorCarga(THREE, size, opts) { var f = tablaCarga[size]; if (!f) throw new Error("size debe ser 'pequeno', 'mediano' o 'grande'"); return f(THREE, opts); }
  function obtenerMotoresCarga(THREE, opts) { return { pequeno: createMotorMula(THREE, opts), mediano: createMotorBuey(THREE, opts), grande: createMotorMamut(THREE, opts) }; }
