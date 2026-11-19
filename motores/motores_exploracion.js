/* ============================================================================
 *  MOTORES DE EXPLORACIÓN — 3 motores estáticos, procedurales (Three.js, sin assets)
 *  Sonda (pequeno, efecto Hall) · Peregrino (mediano, térmico nuclear) · Horizonte (grande, fusión magnética)
 *  Convención: cara de montaje en z=0, escape hacia +Z. 1 unidad = 4 m.
 *  API: createMotorSonda/Peregrino/Horizonte(THREE, opts) y obtenerMotorExploracion(THREE,size,opts)
 * ========================================================================== */
function _exploraKit(THREE, opts) {
    opts = opts || {};
    var P = Math.PI, TAU = P * 2;
    var C = { accent: opts.accent != null ? opts.accent : 0xe9eef1, glow: opts.glow != null ? opts.glow : 0xa07cff };
    var seed = opts.seed || 47;
    function rnd() { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }
    function std(c, m, r, e) { var o = { color: c, metalness: m, roughness: r, side: THREE.DoubleSide }; if (e) for (var k in e) o[k] = e[k]; return new THREE.MeshStandardMaterial(o); }
    var M = {
      yellow: std(C.accent, 0.3, 0.45), gold: std(0xd9a93a, 0.95, 0.28), copper: std(0xc4693a, 0.9, 0.3), teal: std(0x1f8f8a, 0.6, 0.4), coil: std(0xb87333, 0.95, 0.25), ceramic: std(0xcfd6d4, 0.1, 0.8), steel: std(0x8a929e, 0.7, 0.45), steel2: std(0x5f6773, 0.7, 0.5), dark: std(0x1a1d23, 0.7, 0.5), plate: std(0x3a414c, 0.7, 0.5),
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


  /* ============================== SONDA (pequeño) ============================== */
  /* Propulsor de efecto Hall: cuerpo cónico envuelto en lámina dorada arrugada, pila de anillos magnéticos de cobre,
     canal anular de escape con resplandor violeta, cuatro módulos RCS, antena parabólica y sensores en pluma. */
  function createMotorSonda(THREE, opts) {
    var K = _exploraKit(THREE, opts), M = K.M, P = K.P, TAU = K.TAU, b = K.base('Sonda', 'pequeno'), g = b.group, i, j;
    var L = 1.9;
    // brida de montaje redonda
    K.cylZ(g, 0.62, 0.62, 0.12, M.ceramic, 0, 0, 0.06, 36); K.bolts(g, 12, 0.54, 0.14, 0.035, M.steel); K.ring(g, 0.62, 0.025, 0.12, M.teal, 36);
    // cuerpo cónico con lámina dorada: perfil con ondulaciones
    K.add(g, K.latheZ([[0.5, 0.12], [0.52, 0.35], [0.46, 0.55], [0.5, 0.75], [0.44, 0.95], [0.46, 1.1]], 36), M.gold, 0, 0, 0);
    for (i = 0; i < 12; i++) { var a = i / 12 * TAU; K.strut(g, K.pol(0.5, a, 0.2), K.pol(0.44, a + 0.12, 1.0), 0.012, M.copper); }
    for (i = 0; i < 4; i++) K.ring(g, 0.5 - i * 0.015, 0.02, 0.3 + i * 0.25, M.steel2, 36);
    // pila de bobinas magnéticas (cobre) con separadores cerámicos
    for (i = 0; i < 5; i++) { K.ring(g, 0.5, 0.06, 1.05 + i * 0.1, M.coil, 36); K.cylZ(g, 0.5, 0.5, 0.02, M.ceramic, 0, 0, 1.1 + i * 0.1, 36); }
    // canal anular: dos paredes cerámicas y plasma entre ellas
    K.cylZ(g, 0.52, 0.52, 0.28, M.ceramic, 0, 0, 1.66, 36); K.cylZ(g, 0.26, 0.26, 0.3, M.ceramic, 0, 0, 1.68, 24);
    K.add(g, new THREE.RingGeometry(0.27, 0.5, 36), M.glow, 0, 0, 1.82).rotation.y = P;
    K.add(g, new THREE.RingGeometry(0.31, 0.45, 36), M.core, 0, 0, 1.835).rotation.y = P;
    K.add(g, new THREE.SphereGeometry(0.17, 14, 10), M.steel2, 0, 0, 1.8);                       // cátodo central
    K.cylZ(g, 0.06, 0.04, 0.2, M.brass, 0, 0, 1.92, 10);
    for (i = 0; i < 8; i++) { var aa = i / 8 * TAU; K.strut(g, K.pol(0.46, aa, 1.6), K.pol(0.52, aa, 1.84), 0.015, M.steel); }
    // cuatro módulos RCS (cubos con tobera) en cruz
    for (i = 0; i < 4; i++) {
      var ra = i * P / 2 + P / 4, pp = K.pol(0.7, ra, 0.4), rg = new THREE.Group(); rg.position.set(pp[0], pp[1], pp[2]); rg.rotation.z = ra; g.add(rg);
      K.box(rg, 0.2, 0.18, 0.24, M.ceramic, 0, 0, 0, 0.03);
      K.add(rg, new THREE.CylinderGeometry(0.04, 0.07, 0.12, 10).rotateZ(P / 2), M.steel2, 0.15, 0, 0);
      K.add(rg, new THREE.SphereGeometry(0.035, 8, 6), M.led, 0.0, 0.1, 0.0);
      K.strut(g, K.pol(0.52, ra, 0.4), pp, 0.025, M.steel);
    }
    // antena parabólica plegada y mástil de sensores
    var dish = K.add(g, new THREE.SphereGeometry(0.22, 18, 8, 0, TAU, 0, P / 2.4), M.ceramic, 0, 0.72, 0.5); dish.rotation.x = -P / 2 + 0.4;
    K.strut(g, [0, 0.55, 0.45], [0, 0.72, 0.5], 0.02, M.steel); K.cylZ(g, 0.01, 0.01, 0.14, M.steel, 0, 0.72, 0.62, 6);
    K.tube(g, [[-0.3, -0.45, 0.2], [-0.5, -0.65, 0.5], [-0.62, -0.8, 0.95]], 0.018, M.steel2, 14);
    K.add(g, new THREE.SphereGeometry(0.06, 10, 8), M.teal, -0.62, -0.8, 0.98); K.add(g, new THREE.SphereGeometry(0.03, 8, 6), M.amber, -0.62, -0.8, 1.04);
    // tanque de xenón esférico lateral con correas
    K.add(g, new THREE.SphereGeometry(0.2, 18, 14), M.ceramic, 0.64, -0.3, 0.5);
    K.add(g, new THREE.TorusGeometry(0.205, 0.015, 6, 20), M.teal, 0.64, -0.3, 0.5).rotation.y = P / 2;
    K.tube(g, [[0.5, -0.28, 0.55], [0.4, -0.2, 0.8], [0.4, -0.1, 1.2]], 0.02, M.copper, 14);
    b.exhaust.position.z = L;
    return { group: g, name: 'Sonda', size: 'pequeno', length: L, width: 1.5, height: 1.5, mount: b.mount, exhaust: b.exhaust };
  }

  /* ============================== PEREGRINO (mediano) ============================== */
  /* Cohete térmico nuclear: escudo de radiación, reactor de núcleo con tambores de control, larga cercha desnuda
     entre reactor y cámara, cuatro paneles radiadores desplegados en aspa, tanque de hidrógeno y tobera de cerámica blanca. */
  function createMotorPeregrino(THREE, opts) {
    var K = _exploraKit(THREE, opts), M = K.M, P = K.P, TAU = K.TAU, b = K.base('Peregrino', 'mediano'), g = b.group, i, j;
    var L = 5.2;
    // escudo de radiación (disco grueso) con anillos concéntricos
    K.cylZ(g, 1.0, 1.0, 0.18, M.plate, 0, 0, 0.09, 40); K.cylZ(g, 0.9, 0.9, 0.06, M.ceramic, 0, 0, 0.2, 40);
    for (i = 1; i < 4; i++) K.ring(g, i * 0.25, 0.015, 0.24, M.steel, 36);
    K.bolts(g, 20, 0.95, 0.2, 0.04, M.steel);
    // tanque de hidrógeno: cilindro blanco con domos, aislante dorado a franjas
    K.cylZ(g, 0.62, 0.62, 1.5, M.ceramic, 0, 0, 1.0, 36);
    var d1 = new THREE.SphereGeometry(0.62, 24, 10, 0, TAU, 0, P / 2); d1.rotateX(-P / 2); d1.scale(1, 1, 0.6); K.add(g, d1, M.ceramic, 0, 0, 0.25);
    for (i = 0; i < 5; i++) K.ring(g, 0.63, 0.04, 0.5 + i * 0.28, i % 2 ? M.gold : M.teal, 36);
    K.around(g, K.UB, M.gold, 8, 0.62, 1.0, 0.03, 0.2, 1.4, 0, 0);
    // cercha desnuda: 4 largueros + aros + tirantes
    var TR = 0.5, tz0 = 1.75, tz1 = 3.1;
    for (i = 0; i < 4; i++) { var ta = i * P / 2 + P / 4, p0 = K.pol(TR, ta, tz0), p1 = K.pol(TR, ta, tz1); K.strut(g, p0, p1, 0.04, M.steel); }
    [tz0, (tz0 + tz1) / 2, tz1].forEach(function (z) { K.ring(g, TR * 1.0, 0.03, z, M.steel2, 4 * 8); });
    for (i = 0; i < 4; i++) { var a0 = i * P / 2 + P / 4, a1 = a0 + P / 2; K.strut(g, K.pol(TR, a0, tz0), K.pol(TR, a1, (tz0 + tz1) / 2), 0.015, M.steel); K.strut(g, K.pol(TR, a1, (tz0 + tz1) / 2), K.pol(TR, a0 + P, tz1), 0.015, M.steel); }
    K.cylZ(g, 0.1, 0.1, 1.4, M.copper, 0, 0, 2.4, 12);                             // línea de hidrógeno central
    // reactor: núcleo con tambores de control
    K.cylZ(g, 0.5, 0.5, 0.9, M.steel2, 0, 0, 3.55, 32);
    K.ring(g, 0.5, 0.05, 3.1, M.gold, 32); K.ring(g, 0.5, 0.05, 4.0, M.gold, 32);
    for (i = 0; i < 12; i++) { var da = i / 12 * TAU, dp = K.pol(0.52, da, 3.55); K.cylZ(g, 0.07, 0.07, 0.78, i % 3 === 0 ? M.lamp : M.copper, dp[0], dp[1], dp[2], 10); }
    K.cylZ(g, 0.4, 0.4, 0.04, M.dark, 0, 0, 3.58, 24);
    // radiadores en aspa: 4 paneles planos largos con nervios y colectores
    for (i = 0; i < 4; i++) {
      var ra = i * P / 2, rg = new THREE.Group(); rg.rotation.z = ra; g.add(rg);
      K.strut(rg, [0.62, 0, 3.55], [1.2, 0, 3.0], 0.03, M.steel); K.strut(rg, [0.62, 0, 3.55], [1.2, 0, 4.1], 0.03, M.steel);
      K.box(rg, 2.1, 0.04, 1.6, M.teal, 2.2, 0, 3.55, 0.01);
      for (j = 0; j < 7; j++) K.box(rg, 2.0, 0.055, 0.03, M.steel, 2.2, 0, 2.9 + j * 0.22, 0.005);
      K.box(rg, 0.06, 0.07, 1.7, M.copper, 1.2, 0, 3.55, 0.01); K.box(rg, 0.06, 0.07, 1.7, M.copper, 3.25, 0, 3.55, 0.01);
      for (j = 0; j < 4; j++) K.box(rg, 0.03, 0.055, 1.55, M.dark, 1.55 + j * 0.5, 0, 3.55, 0.004);
      K.add(rg, new THREE.SphereGeometry(0.04, 8, 6), M.amber, 3.28, 0, 2.7);
    }
    // tobera de cerámica blanca con aletas de refrigeración
    K.add(g, K.latheZ([[0.34, 4.0], [0.3, 4.3], [0.36, 4.55], [0.55, 4.95], [0.8, 5.18]], 40), M.ceramic, 0, 0, 0);
    K.add(g, K.latheZ([[0.3, 4.05], [0.26, 4.3], [0.32, 4.55], [0.5, 4.95], [0.76, 5.16]], 36), M.dark, 0, 0, 0);
    for (i = 0; i < 4; i++) K.ring(g, 0.4 + i * 0.12, 0.03, 4.6 + i * 0.16, i % 2 ? M.gold : M.copper, 36);
    K.around(g, K.UB, M.teal, 12, 0.46, 4.6, 0.015, 0.1, 0.5, 0.0, 0);
    K.glowDisc(g, 0.26, 4.4, M.glow); K.glowDisc(g, 0.15, 4.35, M.core);
    var hz = K.add(g, new THREE.CircleGeometry(0.8, 28), M.halo, 0, 0, 5.18); hz.rotation.y = P;
    // sensores: dos brazos con esferas
    [-1, 1].forEach(function (s) { K.tube(g, [[s * 0.65, 0, 0.5], [s * 0.85, 0.2, 0.9], [s * 0.9, 0.3, 1.4]], 0.02, M.steel, 14); K.add(g, new THREE.SphereGeometry(0.07, 10, 8), s > 0 ? M.led : M.amber, s * 0.9, 0.3, 1.45); });
    b.exhaust.position.z = L;
    return { group: g, name: 'Peregrino', size: 'mediano', length: L, width: 4.6, height: 4.6, mount: b.mount, exhaust: b.exhaust };
  }

  /* ============================== HORIZONTE (grande) ============================== */
  /* Propulsor de fusión de confinamiento magnético: espina central, cinco bobinas toroidales gigantes de cobre con
     soportes en estrella, esferas de combustible en anillo, núcleo de plasma violeta visible entre bobinas
     y tobera magnética de bobinas decrecientes en abanico. */
  function createMotorHorizonte(THREE, opts) {
    var K = _exploraKit(THREE, opts), M = K.M, P = K.P, TAU = K.TAU, b = K.base('Horizonte', 'grande'), g = b.group, i, j;
    var L = 7.0;
    // placa de montaje y anillo de combustible
    K.cylZ(g, 1.5, 1.5, 0.25, M.plate, 0, 0, 0.12, 44); K.ring(g, 1.5, 0.05, 0.26, M.teal, 44); K.bolts(g, 24, 1.35, 0.27, 0.05, M.steel);
    for (i = 0; i < 6; i++) {
      var fa = i / 6 * TAU, fp = K.pol(1.15, fa, 0.95);
      K.add(g, new THREE.SphereGeometry(0.4, 22, 16), M.ceramic, fp[0], fp[1], fp[2]);
      K.add(g, new THREE.TorusGeometry(0.405, 0.025, 6, 24), M.gold, fp[0], fp[1], fp[2]).rotation.y = P / 2;
      K.add(g, new THREE.TorusGeometry(0.405, 0.025, 6, 24), M.teal, fp[0], fp[1], fp[2]).rotation.x = P / 2;
      K.strut(g, K.pol(1.15, fa, 0.3), fp, 0.06, M.steel2);
      K.tube(g, [fp, K.pol(0.8, fa, 1.5), K.pol(0.45, fa, 1.9), [0, 0, 2.1]], 0.04, M.copper, 18);
    }
    // espina central
    K.cylZ(g, 0.3, 0.3, 4.6, M.steel2, 0, 0, 2.7, 24);
    for (i = 0; i < 9; i++) K.ring(g, 0.32, 0.03, 0.5 + i * 0.5, i % 2 ? M.plate : M.gold, 28);
    // bobinas toroidales: cinco anillos de diámetro creciente con soportes
    var coilZ = [2.0, 2.9, 3.8, 4.7, 5.6], coilR = [0.95, 1.1, 1.3, 1.55, 1.85];
    coilZ.forEach(function (z, n) {
      var r = coilR[n];
      K.ring(g, r, 0.24 + n * 0.02, z, M.coil, 52); K.ring(g, r, 0.14, z, M.teal, 52);
      K.around(g, K.UB, M.gold, 12, r + 0.22, z, 0.14, 0.14, 0.2, 0.2, 0);
      for (i = 0; i < 8; i++) { var sa = i / 8 * TAU; K.strut(g, K.pol(0.3, sa, z), K.pol(r - 0.15, sa, z), 0.03, M.steel); }
      K.ring(g, 0.55 + n * 0.1, 0.03, z, M.steel, 36);
    });
    // largueros que unen las bobinas
    for (i = 0; i < 6; i++) { var la = i / 6 * TAU + P / 6; K.strut(g, K.pol(coilR[0] + 0.3, la, 2.0), K.pol(coilR[4] + 0.3, la, 5.6), 0.06, M.steel2); }
    // plasma confinado: cilindro luminoso con núcleo blanco
    K.cylZ(g, 0.42, 0.42, 3.4, M.halo, 0, 0, 3.8, 24); K.cylZ(g, 0.12, 0.12, 3.4, M.glow, 0, 0, 3.8, 14); K.cylZ(g, 0.05, 0.05, 3.4, M.core, 0, 0, 3.8, 8);
    // tobera magnética: bobinas decrecientes en abanico + anillo final
    [6.2, 6.55, 6.85].forEach(function (z, n) { K.ring(g, 2.0 + n * 0.28, 0.12 - n * 0.02, z, M.coil, 52); K.ring(g, 2.0 + n * 0.28, 0.06, z, M.teal, 52); });
    for (i = 0; i < 12; i++) { var na = i / 12 * TAU; K.strut(g, K.pol(1.85, na, 5.6), K.pol(2.0, na, 6.2), 0.03, M.steel); K.strut(g, K.pol(2.0, na, 6.2), K.pol(2.56, na, 6.85), 0.025, M.steel); }
    var hz = K.add(g, new THREE.CircleGeometry(2.4, 40), M.halo, 0, 0, 6.95); hz.rotation.y = P;
    K.glowDisc(g, 0.45, 5.6, M.glow);
    // radiadores plegados en 4 paneles y torretas de diagnóstico
    for (i = 0; i < 4; i++) {
      var qa = i * P / 2 + P / 4, qp = K.pol(2.35, qa, 3.8), qg = new THREE.Group(); qg.position.set(qp[0], qp[1], qp[2]); qg.rotation.z = qa; g.add(qg);
      K.box(qg, 0.4, 0.05, 2.4, M.ceramic, 0.2, 0, 0, 0.01); for (j = 0; j < 8; j++) K.box(qg, 0.38, 0.07, 0.03, M.steel, 0.2, 0, -1.0 + j * 0.28, 0.004);
      K.strut(g, K.pol(1.85, qa, 3.8), K.pol(2.3, qa, 3.8), 0.04, M.steel);
    }
    K.add(g, new THREE.SphereGeometry(0.1, 10, 8), M.lamp, 0, 1.4, 0.3); K.add(g, new THREE.SphereGeometry(0.1, 10, 8), M.led, 1.4, 0, 0.3);
    b.exhaust.position.z = L;
    return { group: g, name: 'Horizonte', size: 'grande', length: L, width: 6.2, height: 6.2, mount: b.mount, exhaust: b.exhaust };
  }

  var tablaExploracion = { pequeno: createMotorSonda, mediano: createMotorPeregrino, grande: createMotorHorizonte };
  function obtenerMotorExploracion(THREE, size, opts) { var f = tablaExploracion[size]; if (!f) throw new Error("size debe ser 'pequeno', 'mediano' o 'grande'"); return f(THREE, opts); }
  function obtenerMotoresExploracion(THREE, opts) { return { pequeno: createMotorSonda(THREE, opts), mediano: createMotorPeregrino(THREE, opts), grande: createMotorHorizonte(THREE, opts) }; }
