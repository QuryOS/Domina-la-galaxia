/**
 * Motores militares (pequeño, mediano, grande) para Three.js, sin archivos externos. Son piezas estáticas de catálogo:
 * no tienen animación, solo mucho detalle de superficie (anillos de calor, tuberías, actuadores, tornillería, placas, ranuras).
 *
 * Uso:
 *   const m = obtenerMotorMilitar(THREE, 'pequeno');     // 'pequeno' | 'mediano' | 'grande'
 *   scene.add(m.group);
 *   // o directamente: createMotorColmillo(THREE), createMotorTenaza(THREE), createMotorColoso(THREE)
 *   // o todos: obtenerMotoresMilitares(THREE) -> { pequeno, mediano, grande }
 *
 * Convención: igual que las naves. La cara de montaje (se pega al casco) está en z = 0 y la salida de gases mira a +Z
 * (la nave apunta a -Z). Escala: 1 unidad = 4 m. Cada motor devuelve:
 *   { group, name, size, length, width, height, mount (Object3D en z = 0), exhaust (Object3D en la boca de la tobera) }
 * opts: { accent: 0xff7a1a (color de franjas y brillo), hull: 0x4b5260 (blindaje), glow: 0xffa040 (gas incandescente) }
 *
 * Motores:
 *   Colmillo (pequeño): turbofán con postquemador, tobera de pétalos solapados, actuadores de vectorización.
 *   Tenaza (mediano): dos toberas magnéticas gemelas con bobinas, núcleo blindado, radiadores y pilonos.
 *   Coloso (grande): reactor de fusión con cubierta de cresta, tobera campana con costillas y tubos regenerativos,
 *     seis toberas vernier y cardán con cuatro actuadores hidráulicos.
 * Compatible con Three.js r128 o superior.
 */

  function _motorKit(THREE, opts) {
    opts = opts || {};
    var P = Math.PI, TAU = P * 2;
    var C = { accent: opts.accent != null ? opts.accent : 0xff7a1a, hull: opts.hull != null ? opts.hull : 0x4b5260, glow: opts.glow != null ? opts.glow : 0xffa040 };
    var seed = opts.seed || 11;
    function rnd() { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }
    function std(c, m, r, e) { var o = { color: c, metalness: m, roughness: r, side: THREE.DoubleSide }; if (e) for (var k in e) o[k] = e[k]; return new THREE.MeshStandardMaterial(o); }
    var M = {
      hull: std(C.hull, 0.7, 0.42), hull2: std(0x6b7484, 0.75, 0.35), dark: std(0x1b2029, 0.8, 0.45), plate: std(0x2c3340, 0.8, 0.4),
      steel: std(0x9aa3b0, 0.9, 0.28), accent: std(C.accent, 0.35, 0.45), cream: std(0xd9d2c0, 0.3, 0.6),
      h1: std(0x8e9aa8, 0.9, 0.3), h2: std(0x6f7a99, 0.9, 0.3), h3: std(0x5b5170, 0.9, 0.32), h4: std(0x4a3a30, 0.9, 0.38), h5: std(0x2f2420, 0.85, 0.5),
      liner: std(0x120f10, 0.7, 0.5),
      glow: new THREE.MeshBasicMaterial({ color: C.glow, side: THREE.DoubleSide }),
      core: new THREE.MeshBasicMaterial({ color: 0xfff1d0, side: THREE.DoubleSide }),
      slit: new THREE.MeshBasicMaterial({ color: C.accent, side: THREE.DoubleSide }),
      blue: new THREE.MeshBasicMaterial({ color: 0x7fd2ff, side: THREE.DoubleSide }),
      halo: new THREE.MeshBasicMaterial({ color: C.glow, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })
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
    function base(name, size) {
      var g = new THREE.Group(); g.name = name;
      var mount = new THREE.Object3D(); mount.name = 'mount'; g.add(mount);
      var exhaust = new THREE.Object3D(); exhaust.name = 'exhaust'; g.add(exhaust);
      return { group: g, mount: mount, exhaust: exhaust };
    }
    return { THREE: THREE, P: P, TAU: TAU, C: C, M: M, UB: UB, rnd: rnd, add: add, box: box, roundedBox: roundedBox, latheZ: latheZ, ring: ring, around: around, strut: strut, pol: pol, cylZ: cylZ, bolts: bolts, glowDisc: glowDisc, base: base };
  }

  /* ============================== COLMILLO (pequeño) ============================== */
  function createMotorColmillo(THREE, opts) {
    var K = _motorKit(THREE, opts), M = K.M, P = K.P, TAU = K.TAU, b = K.base('Colmillo', 'pequeno'), g = b.group, i, k;
    var L = 2.3;
    // brida de montaje y tornillería
    K.cylZ(g, 0.58, 0.58, 0.14, M.plate, 0, 0, 0.07, 28);
    K.cylZ(g, 0.52, 0.52, 0.06, M.dark, 0, 0, 0.17, 28);
    K.bolts(g, 14, 0.54, 0.15, 0.025, M.steel);
    // carcasa principal (compresor + cámara + postquemador)
    K.add(g, K.latheZ([[0.46, 0.14], [0.55, 0.3], [0.58, 0.6], [0.55, 1.0], [0.5, 1.25], [0.47, 1.45], [0.46, 1.55]], 40), M.hull, 0, 0, 0);
    // franjas de pintura y placas de acceso
    K.ring(g, 0.585, 0.022, 0.42, M.accent, 44); K.ring(g, 0.585, 0.022, 0.5, M.accent, 44);
    K.ring(g, 0.572, 0.03, 0.78, M.hull2, 44); K.ring(g, 0.545, 0.03, 1.05, M.hull2, 44);
    var plates = K.around(g, K.UB, M.plate, 8, 0.585, 0.7, 0.03, 0.17, 0.3, 0.2, 0);
    var panelsLong = K.around(g, K.UB, M.dark, 24, 0.572, 0.8, 0.012, 0.012, 1.1, 0, 0);
    K.around(g, K.UB, M.dark, 12, 0.56, 0.5, 0.012, 0.012, 0.35, 0.13, 0);
    // anillos de refuerzo y de calor (de acero a quemado)
    var heat = [M.h1, M.h2, M.h3, M.h4, M.h5];
    for (i = 0; i < 5; i++) K.ring(g, 0.5 - i * 0.012, 0.03, 1.12 + i * 0.09, heat[i], 44);
    K.ring(g, 0.51, 0.05, 1.0, M.dark, 44);
    // tuberías de combustible y cableado con abrazaderas
    for (k = 0; k < 4; k++) {
      var pa = k / 4 * TAU + 0.4, pr = 0.6;
      K.strut(g, K.pol(pr, pa, 0.25), K.pol(pr, pa, 1.3), 0.018, M.steel);
      for (i = 0; i < 4; i++) { var cz = 0.4 + i * 0.28, clamp = K.add(g, new THREE.TorusGeometry(0.024, 0.01, 6, 10), M.dark, Math.cos(pa) * pr, Math.sin(pa) * pr, cz); clamp.rotation.x = P / 2; clamp.rotation.y = 0; }
      K.strut(g, K.pol(pr, pa + 0.12, 0.3), K.pol(pr - 0.02, pa + 0.12, 1.15), 0.01, M.accent);
    }
    // anillo del cardán y actuadores de vectorización
    K.ring(g, 0.52, 0.04, 1.48, M.plate, 44);
    for (k = 0; k < 3; k++) {
      var ga = k / 3 * TAU + 0.3;
      K.strut(g, K.pol(0.6, ga, 1.0), K.pol(0.55, ga, 1.45), 0.03, M.steel);
      K.strut(g, K.pol(0.6, ga, 1.0), K.pol(0.6, ga, 1.2), 0.045, M.dark);
      K.add(g, new THREE.SphereGeometry(0.045, 8, 6), M.steel, Math.cos(ga) * 0.6, Math.sin(ga) * 0.6, 1.0);
      K.add(g, new THREE.SphereGeometry(0.04, 8, 6), M.steel, Math.cos(ga) * 0.55, Math.sin(ga) * 0.55, 1.45);
    }
    // tobera de pétalos solapados (convergente) en dos capas
    var petals = new THREE.Group(); g.add(petals);
    for (k = 0; k < 16; k++) {
      var a0 = k / 16 * TAU, pg = new THREE.Group(); pg.rotation.z = a0; petals.add(pg);
      var pt = K.box(pg, 0.5, 0.2, 0.012, k % 2 ? M.h4 : M.h3, 0, 0, 0, 0.004); pt.geometry.rotateY(P / 2);
      pt.scale.set(1, 1, 1); pt.position.set(0.455, 0, 1.78); pt.rotation.y = -0.2;
      var pt2 = K.box(pg, 0.42, 0.17, 0.01, M.h5, 0, 0, 0, 0.004); pt2.geometry.rotateY(P / 2);
      pt2.position.set(0.44, 0, 1.95); pt2.rotation.y = -0.3;
      // nervio exterior de cada pétalo
      K.add(pg, new THREE.BoxGeometry(0.012, 0.012, 0.55), M.dark, 0.485, 0, 1.78).rotation.y = -0.2;
    }
    // labio, anillo de salida y brillo interior
    K.ring(g, 0.4, 0.022, 2.18, M.h5, 44);
    K.add(g, K.latheZ([[0.42, 1.55], [0.4, 1.7], [0.36, 1.95], [0.35, 2.2]], 32), M.liner, 0, 0, 0);
    K.glowDisc(g, 0.33, 1.78, M.glow);
    K.glowDisc(g, 0.2, 1.74, M.core);
    // portallamas (flameholder) con radios y cono central
    for (k = 0; k < 4; k++) K.strut(g, K.pol(0.05, k * P / 2, 1.7), K.pol(0.3, k * P / 2, 1.72), 0.012, M.dark);
    K.add(g, new THREE.ConeGeometry(0.06, 0.2, 10).rotateX(-P / 2), M.hull2, 0, 0, 1.6);
    // aleta/puntos de enganche al casco y placa de identificación
    [-1, 1].forEach(function (s) { K.box(g, 0.05, 0.18, 0.5, M.plate, s * 0.6, 0, 0.45, 0.01); K.box(g, 0.1, 0.07, 0.12, M.accent, s * 0.63, 0, 0.3, 0.01); });
    K.box(g, 0.2, 0.06, 0.012, M.accent, 0, 0.585, 0.7, 0.003);
    b.mount.position.z = 0; b.exhaust.position.z = L;
    return { group: g, name: 'Colmillo', size: 'pequeno', length: L, width: 1.3, height: 1.3, mount: b.mount, exhaust: b.exhaust };
  }

  /* ============================== TENAZA (mediano) ============================== */
  function createMotorTenaza(THREE, opts) {
    var K = _motorKit(THREE, opts), M = K.M, P = K.P, TAU = K.TAU, b = K.base('Tenaza', 'mediano'), g = b.group, i, k;
    var L = 4.2, PX = 1.0;
    // bloque de montaje blindado con tornillería
    K.box(g, 2.4, 1.3, 0.35, M.plate, 0, 0, 0.18, 0.05);
    K.box(g, 2.0, 1.0, 0.12, M.dark, 0, 0, 0.4, 0.03);
    for (i = 0; i < 6; i++) { K.add(g, new THREE.CylinderGeometry(0.04, 0.04, 0.05, 6).rotateX(P / 2), M.steel, -1.0 + i * 0.4, 0.52, 0.37); K.add(g, new THREE.CylinderGeometry(0.04, 0.04, 0.05, 6).rotateX(P / 2), M.steel, -1.0 + i * 0.4, -0.52, 0.37); }
    // núcleo / reactor central con placas de blindaje
    K.add(g, K.latheZ([[0.42, 0.35], [0.62, 0.6], [0.68, 1.2], [0.68, 2.0], [0.6, 2.7], [0.45, 3.0]], 36), M.hull, 0, 0, 0);
    K.ring(g, 0.69, 0.04, 0.9, M.hull2, 40); K.ring(g, 0.69, 0.04, 1.9, M.hull2, 40); K.ring(g, 0.64, 0.035, 2.5, M.hull2, 40);
    K.around(g, K.UB, M.plate, 6, 0.69, 1.4, 0.05, 0.4, 0.7, 0.3, 0);
    K.around(g, K.UB, M.slit, 6, 0.695, 1.4, 0.012, 0.05, 0.55, 0.6, 0);
    K.around(g, K.UB, M.dark, 20, 0.685, 1.6, 0.01, 0.01, 1.8, 0, 0);
    K.ring(g, 0.7, 0.02, 0.62, M.accent, 40); K.ring(g, 0.7, 0.02, 2.2, M.accent, 40);
    // toberas magnéticas gemelas
    [-1, 1].forEach(function (s) {
      var px = s * PX, pod = new THREE.Group(); pod.position.x = px; g.add(pod);
      K.add(pod, K.latheZ([[0.3, 0.9], [0.26, 1.4], [0.3, 1.9], [0.42, 2.7], [0.58, 3.4], [0.72, 4.05]], 36), M.hull2, 0, 0, 0);
      K.add(pod, K.latheZ([[0.26, 1.2], [0.28, 1.9], [0.4, 2.7], [0.55, 3.4], [0.69, 4.05]], 32), M.liner, 0, 0, 0);
      // bobinas magnéticas (anillos gruesos que crecen)
      for (i = 0; i < 6; i++) {
        var cz = 1.5 + i * 0.5, cr = 0.3 + Math.pow(i / 5, 1.5) * 0.4 + 0.0;
        var coil = K.ring(pod, cr + 0.02, 0.06 + i * 0.006, cz, i % 2 ? M.accent : M.steel, 36);
        K.add(pod, new THREE.TorusGeometry(cr + 0.02, 0.02, 6, 36), M.dark, 0, 0, cz + 0.07);
      }
      K.bolts(pod, 10, 0.33, 1.0, 0.02, M.steel);
      K.ring(pod, 0.74, 0.03, 4.05, M.h4, 36); K.ring(pod, 0.71, 0.022, 3.98, M.h5, 36);
      K.glowDisc(pod, 0.62, 3.0, M.blue); K.glowDisc(pod, 0.42, 2.6, M.core);
      var hz = K.add(pod, new THREE.CircleGeometry(0.7, 30), M.halo, 0, 0, 4.07); hz.rotation.y = P;
      // pilonos hacia el núcleo
      [1.2, 1.9, 2.6].forEach(function (z) {
        K.strut(g, [s * 0.62, 0.0, z], [px - s * 0.3, 0.0, z], 0.05, M.steel);
        K.box(g, 0.3, 0.22, 0.12, M.plate, s * 0.78, 0, z, 0.02);
      });
      // manguitos de plasma y colectores
      K.strut(g, [s * 0.55, 0.3, 0.85], [px, 0.2, 1.0], 0.07, M.dark);
      K.strut(g, [s * 0.55, -0.3, 0.85], [px, -0.2, 1.0], 0.07, M.dark);
      K.ring(pod, 0.37, 0.05, 1.0, M.plate, 30);
    });
    // radiadores superior e inferior con nervios y tuberías
    [-1, 1].forEach(function (s) {
      var rd = new THREE.Group(); rd.position.set(0, s * 0.82, 2.0); rd.rotation.x = -s * 0.12; g.add(rd);
      K.box(rd, 1.5, 0.05, 2.2, M.dark, 0, 0, 0, 0.012);
      var fins = [];
      for (i = 0; i < 12; i++) K.box(rd, 1.5, 0.1 * 0.5, 0.02, M.hull2, 0, s * 0.04, -1.0 + i * 0.18, 0.004);
      for (i = 0; i < 5; i++) K.strut(rd, [-0.7 + i * 0.35, s * 0.05, -1.05], [-0.7 + i * 0.35, s * 0.05, 1.05], 0.012, M.accent);
      K.strut(g, [-0.5, s * 0.55, 0.9], [-0.5, s * 0.8, 1.0], 0.025, M.steel); K.strut(g, [0.5, s * 0.55, 0.9], [0.5, s * 0.8, 1.0], 0.025, M.steel);
      K.strut(g, [-0.5, s * 0.55, 3.0], [-0.5, s * 0.8, 2.9], 0.025, M.steel); K.strut(g, [0.5, s * 0.55, 3.0], [0.5, s * 0.8, 2.9], 0.025, M.steel);
    });
    // tapa trasera del núcleo con salida de residuos
    K.cylZ(g, 0.28, 0.32, 0.22, M.plate, 0, 0, 3.1, 20);
    K.glowDisc(g, 0.2, 3.22, M.slit);
    K.ring(g, 0.3, 0.025, 3.2, M.accent, 24);
    b.exhaust.position.set(0, 0, L);
    return { group: g, name: 'Tenaza', size: 'mediano', length: L, width: 3.0, height: 2.0, mount: b.mount, exhaust: b.exhaust };
  }

  /* ============================== COLOSO (grande) ============================== */
  function createMotorColoso(THREE, opts) {
    var K = _motorKit(THREE, opts), M = K.M, P = K.P, TAU = K.TAU, b = K.base('Coloso', 'grande'), g = b.group, i, k;
    var L = 8.0;
    // brida de montaje gigante, tornillería y placas
    K.cylZ(g, 2.1, 2.1, 0.3, M.plate, 0, 0, 0.15, 48);
    K.cylZ(g, 1.9, 1.9, 0.12, M.dark, 0, 0, 0.34, 48);
    K.bolts(g, 32, 2.0, 0.3, 0.06, M.steel);
    K.ring(g, 2.1, 0.05, 0.3, M.accent, 48);
    // cubierta del reactor (casco de cresta)
    K.add(g, K.latheZ([[1.85, 0.3], [2.1, 0.8], [2.25, 1.4], [2.2, 2.0], [1.95, 2.6], [1.5, 3.0], [1.25, 3.2]], 56), M.hull, 0, 0, 0);
    K.ring(g, 2.27, 0.06, 1.4, M.hull2, 56); K.ring(g, 2.2, 0.05, 1.95, M.hull2, 56); K.ring(g, 1.95, 0.05, 2.6, M.hull2, 56);
    K.ring(g, 2.28, 0.04, 0.95, M.accent, 56); K.ring(g, 2.28, 0.04, 1.05, M.accent, 56);
    K.around(g, K.UB, M.plate, 12, 2.25, 1.7, 0.14, 0.75, 1.5, 0.12, 0);               // placas de blindaje
    K.around(g, K.UB, M.dark, 36, 2.2, 1.7, 0.03, 0.03, 2.4, 0, 0);                    // líneas de panel
    K.around(g, K.UB, M.slit, 12, 2.3, 1.7, 0.03, 0.12, 1.1, 0.26, 0);                 // ranuras luminosas del reactor
    K.around(g, K.UB, M.steel, 12, 2.3, 0.7, 0.05, 0.2, 0.2, 0.0, 0);
    K.bolts(g, 24, 2.18, 2.0, 0.05, M.steel);
    // radiadores principales (4 paneles) en la cubierta
    for (k = 0; k < 4; k++) {
      var ra = k / 4 * TAU + P / 4, rg = new THREE.Group(); rg.rotation.z = ra; g.add(rg);
      var rp = new THREE.Group(); rp.position.set(2.5, 0, 1.6); rp.rotation.y = 0.0; rg.add(rp);
      K.box(rp, 0.08, 1.5, 2.2, M.dark, 0, 0, 0, 0.02);
      for (i = 0; i < 10; i++) K.box(rp, 0.2, 1.46, 0.025, M.hull2, 0.08, 0, -1.0 + i * 0.22, 0.006);
      for (i = 0; i < 4; i++) K.strut(rp, [-0.06, -0.6 + i * 0.4, -1.0], [-0.06, -0.6 + i * 0.4, 1.0], 0.018, M.accent);
      K.strut(rg, [2.2, 0.0, 1.0], [2.45, 0.0, 0.75], 0.05, M.steel); K.strut(rg, [2.2, 0.0, 2.2], [2.45, 0.0, 2.45], 0.05, M.steel);
    }
    // garganta y tobera de campana con costillas
    var bell = [[1.25, 3.0], [0.95, 3.4], [0.92, 3.7], [1.05, 4.4], [1.35, 5.4], [1.7, 6.6], [1.95, 8.0]];
    K.add(g, K.latheZ(bell, 56), M.hull2, 0, 0, 0);
    var inner = [[0.88, 3.4], [0.9, 3.7], [1.02, 4.4], [1.32, 5.4], [1.67, 6.6], [1.92, 8.0]];
    K.add(g, K.latheZ(inner, 48), M.liner, 0, 0, 0);
    function rAt(z) {
      for (var q = 0; q < bell.length - 1; q++) if (z <= bell[q + 1][1]) { var f = (z - bell[q][1]) / (bell[q + 1][1] - bell[q][1]); return bell[q][0] + (bell[q + 1][0] - bell[q][0]) * f; }
      return bell[bell.length - 1][0];
    }
    // costillas longitudinales siguiendo el perfil y aros de refuerzo
    for (k = 0; k < 24; k++) {
      var a = k / 24 * TAU;
      for (i = 0; i < 6; i++) { var z0 = 3.7 + i * 0.72, z1 = z0 + 0.72; K.strut(g, K.pol(rAt(z0) + 0.04, a, z0), K.pol(rAt(z1) + 0.04, a, z1), 0.035, M.plate); }
    }
    for (i = 0; i < 9; i++) { var zr = 3.9 + i * 0.52; K.ring(g, rAt(zr) + 0.06, 0.045 + i * 0.004, zr, i % 3 === 2 ? M.accent : M.hull, 56); }
    // anillos de calor en el borde de la campana
    [M.h1, M.h2, M.h3, M.h4, M.h5].forEach(function (m, n) { K.ring(g, rAt(7.2 + n * 0.16) + 0.04, 0.05, 7.2 + n * 0.16, m, 56); });
    K.ring(g, 1.98, 0.06, 8.0, M.h5, 56);
    // tubos regenerativos que envuelven la campana
    for (k = 0; k < 16; k++) {
      var ta = (k + 0.5) / 16 * TAU;
      for (i = 0; i < 5; i++) { var tz0 = 3.9 + i * 0.8, tz1 = tz0 + 0.8; K.strut(g, K.pol(rAt(tz0) + 0.14, ta, tz0), K.pol(rAt(tz1) + 0.14, ta, tz1), 0.016, k % 2 ? M.steel : M.accent); }
    }
    K.ring(g, 1.15, 0.09, 3.25, M.plate, 48); K.ring(g, 1.2, 0.05, 3.25, M.accent, 48);
    // brillo interior
    K.glowDisc(g, 1.15, 4.8, M.glow); K.glowDisc(g, 0.7, 4.5, M.core);
    var hz = K.add(g, new THREE.CircleGeometry(1.9, 40), M.halo, 0, 0, 8.02); hz.rotation.y = P;
    // cardán: aro y cuatro actuadores hidráulicos telescópicos
    K.ring(g, 1.42, 0.1, 3.3, M.hull2, 56);
    for (k = 0; k < 4; k++) {
      var ga = k / 4 * TAU + P / 4, a0 = K.pol(2.0, ga, 2.1), a1 = K.pol(1.45, ga, 3.35), am = K.pol(1.74, ga, 2.72);
      K.strut(g, a0, am, 0.085, M.dark); K.strut(g, am, a1, 0.055, M.steel);
      K.add(g, new THREE.SphereGeometry(0.11, 10, 8), M.steel, a0[0], a0[1], a0[2]); K.add(g, new THREE.SphereGeometry(0.09, 10, 8), M.steel, a1[0], a1[1], a1[2]);
      K.box(g, 0.25, 0.25, 0.3, M.plate, a0[0], a0[1], a0[2] - 0.05, 0.03).rotation.z = ga;
    }
    // seis toberas vernier alrededor
    for (k = 0; k < 6; k++) {
      var va = k / 6 * TAU, vg = new THREE.Group(); vg.position.set(Math.cos(va) * 2.5, Math.sin(va) * 2.5, 0); g.add(vg);
      K.add(vg, K.latheZ([[0.24, 2.9], [0.22, 3.4], [0.3, 4.2], [0.42, 5.0], [0.52, 5.7]], 24), M.hull2, 0, 0, 0);
      K.add(vg, K.latheZ([[0.2, 3.2], [0.27, 4.2], [0.39, 5.0], [0.49, 5.7]], 20), M.liner, 0, 0, 0);
      K.ring(vg, 0.54, 0.035, 5.7, M.h4, 24); K.ring(vg, 0.3, 0.03, 3.6, M.accent, 24); K.ring(vg, 0.38, 0.03, 4.4, M.hull, 24);
      K.cylZ(vg, 0.3, 0.3, 0.6, M.plate, 0, 0, 2.7, 16);
      K.glowDisc(vg, 0.4, 4.3, M.glow); var vh = K.add(vg, new THREE.CircleGeometry(0.5, 20), M.halo, 0, 0, 5.72); vh.rotation.y = P;
      K.strut(g, [Math.cos(va) * 2.3, Math.sin(va) * 2.3, 2.7], [Math.cos(va) * 1.5, Math.sin(va) * 1.5, 3.05], 0.07, M.steel);
      K.strut(g, K.pol(2.5, va, 3.6), K.pol(1.28, va, 4.1), 0.05, M.plate);
    }
    // tuberías de alimentación y colectores en la cubierta
    for (k = 0; k < 8; k++) {
      var fa = k / 8 * TAU + 0.2;
      K.strut(g, K.pol(2.38, fa, 0.9), K.pol(2.38, fa, 2.5), 0.045, M.steel);
      K.strut(g, K.pol(2.4, fa + 0.07, 0.9), K.pol(2.4, fa + 0.07, 2.4), 0.025, M.accent);
      for (i = 0; i < 3; i++) K.add(g, new THREE.TorusGeometry(0.06, 0.018, 6, 10), M.dark, Math.cos(fa) * 2.38, Math.sin(fa) * 2.38, 1.1 + i * 0.5).rotation.y = 0;
    }
    K.ring(g, 1.5, 0.12, 3.05, M.plate, 48);
    b.exhaust.position.z = L;
    return { group: g, name: 'Coloso', size: 'grande', length: L, width: 5.8, height: 5.8, mount: b.mount, exhaust: b.exhaust };
  }

  var table = { pequeno: createMotorColmillo, mediano: createMotorTenaza, grande: createMotorColoso };
  function obtenerMotorMilitar(THREE, size, opts) { var f = table[size]; if (!f) throw new Error("size debe ser 'pequeno', 'mediano' o 'grande'"); return f(THREE, opts); }
  function obtenerMotoresMilitares(THREE, opts) { return { pequeno: createMotorColmillo(THREE, opts), mediano: createMotorTenaza(THREE, opts), grande: createMotorColoso(THREE, opts) }; }
