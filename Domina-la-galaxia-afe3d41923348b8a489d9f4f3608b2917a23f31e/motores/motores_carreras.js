/**
 * Motores de carreras (pequeño, mediano, grande) para Three.js, sin archivos externos. Son piezas estáticas de catálogo:
 * no tienen animación, solo mucho detalle de superficie (cromados, tubos curvos, anillos de calor, neón, fibra de carbono).
 * Su diseño es deliberadamente distinto al de los motores militares: aquí todo es visible, brillante y aerodinámico.
 *
 * Uso:
 *   const m = obtenerMotorCarreras(THREE, 'pequeno');    // 'pequeno' | 'mediano' | 'grande'
 *   scene.add(m.group);
 *   // o directamente: createMotorCentella(THREE), createMotorRelampago(THREE), createMotorCometa(THREE)
 *   // o todos: obtenerMotoresCarreras(THREE) -> { pequeno, mediano, grande }
 *
 * Convención: igual que las naves. La cara de montaje (se pega al casco) está en z = 0 y la salida de gases mira a +Z
 * (la nave apunta a -Z). Escala: 1 unidad = 4 m. Cada motor devuelve:
 *   { group, name, size, length, width, height, mount (Object3D en z = 0), exhaust (Object3D en la salida de gases) }
 * opts: { accent: 0xff2d95 (color candy), neon: 0x18e0ff (luces), body: 0xf1f3f7 (pintura perla) }
 *
 * Motores:
 *   Centella (pequeño): motor "hot rod" bóxer con culatas aleteadas, sobrealimentador con trompetas de admisión,
 *     colectores cromados curvos hasta dos escapes laterales con trompeta, volante expuesto y botellas de nitro.
 *   Relámpago (mediano): aerospike lineal, cuña ancha y plana con hilera de 14 cámaras en el borde de fuga, tubos
 *     alimentadores curvos, cercas laterales con neón, alerones de punta y franjas de carreras.
 *   Cometa (grande): tobera anular con espiga central, carenado fusiforme con doble bobina helicoidal luminosa,
 *     seis tomas de aire, aletas cruciformes de barrido y dos cápsulas propulsoras laterales.
 * Compatible con Three.js r128 o superior.
 */
function _carrerasKit(THREE, opts) {
    opts = opts || {};
    var P = Math.PI, TAU = P * 2;
    var C = { accent: opts.accent != null ? opts.accent : 0xff2d95, neon: opts.neon != null ? opts.neon : 0x18e0ff, body: opts.body != null ? opts.body : 0xf1f3f7 };
    var seed = opts.seed || 23;
    function rnd() { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }
    function std(c, m, r, e) { var o = { color: c, metalness: m, roughness: r, side: THREE.DoubleSide }; if (e) for (var k in e) o[k] = e[k]; return new THREE.MeshStandardMaterial(o); }
    var M = {
      pearl: std(C.body, 0.45, 0.22), chrome: std(0xe3e9f1, 0.75, 0.16), steel: std(0xaab4c2, 0.8, 0.28), carbon: std(0x15181e, 0.55, 0.32),
      dark: std(0x0c0e12, 0.7, 0.4), candy: std(C.accent, 0.5, 0.2), copper: std(0xc77b3d, 0.85, 0.25), gold: std(0xe3b04b, 0.85, 0.22),
      h1: std(0xbfc9d6, 0.85, 0.25), h2: std(0x8c9cc8, 0.85, 0.25), h3: std(0x6a5fa8, 0.85, 0.28), h4: std(0x9a3f6a, 0.85, 0.3), h5: std(0x5a2630, 0.8, 0.4),
      neon: new THREE.MeshBasicMaterial({ color: C.neon, side: THREE.DoubleSide }), neon2: new THREE.MeshBasicMaterial({ color: C.accent, side: THREE.DoubleSide }),
      core: new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide }), blue: new THREE.MeshBasicMaterial({ color: 0x7fd2ff, side: THREE.DoubleSide }),
      glass: std(0x9fd6ff, 0.2, 0.05, { transparent: true, opacity: 0.4 }),
      halo: new THREE.MeshBasicMaterial({ color: C.neon, transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })
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
    function base(name, size) {
      var g = new THREE.Group(); g.name = name;
      var mount = new THREE.Object3D(); mount.name = 'mount'; g.add(mount);
      var exhaust = new THREE.Object3D(); exhaust.name = 'exhaust'; g.add(exhaust);
      return { group: g, mount: mount, exhaust: exhaust };
    }
    return { THREE: THREE, P: P, TAU: TAU, C: C, M: M, UB: UB, rnd: rnd, add: add, box: box, roundedBox: roundedBox, latheZ: latheZ, ring: ring, around: around, strut: strut, pol: pol, cylZ: cylZ, bolts: bolts, glowDisc: glowDisc, base: base, tube: tube, funnel: funnel };
  }


  /* ============================== CENTELLA (pequeño) ============================== */
  /* Motor "hot rod" espacial: bloque bóxer con culatas aleteadas, sobrealimentador con trompetas de admisión,
     colectores cromados que se curvan hasta dos escapes laterales con trompeta, volante expuesto y botellas de nitro. */
  function createMotorCentella(THREE, opts) {
    var K = _carrerasKit(THREE, opts), M = K.M, P = K.P, TAU = K.TAU, b = K.base('Centella', 'pequeno'), g = b.group, i, k;
    var L = 2.75;
    // placa de montaje de carbono con marco candy y tornillos
    K.box(g, 1.7, 1.0, 0.12, M.carbon, 0, 0, 0.06, 0.05);
    [[-0.82, 0], [0.82, 0]].forEach(function (p) { K.box(g, 0.05, 0.92, 0.03, M.candy, p[0], 0, 0.13, 0.01); });
    [[-0.7, -0.4], [0.7, -0.4], [-0.7, 0.4], [0.7, 0.4], [0, -0.44], [0, 0.44]].forEach(function (p) { K.add(g, new THREE.CylinderGeometry(0.035, 0.035, 0.05, 6).rotateX(P / 2), M.steel, p[0], p[1], 0.13); });
    // cárter y bloque central
    K.box(g, 0.92, 0.62, 1.3, M.steel, 0, 0, 0.8, 0.09);
    K.box(g, 0.5, 0.2, 1.1, M.dark, 0, -0.38, 0.85, 0.05);
    K.around(g, K.UB, M.carbon, 10, 0.3, 0.8, 0.02, 0.02, 1.1, 0, 0);
    // culatas bóxer con aletas de refrigeración y tapas de válvulas candy
    [-1, 1].forEach(function (s) {
      var hx = s * 0.66;
      K.box(g, 0.42, 0.56, 1.22, M.steel, hx, 0.02, 0.82, 0.06);
      for (i = 0; i < 9; i++) K.box(g, 0.5, 0.52, 0.025, M.chrome, hx + s * 0.02, 0.02, 0.28 + i * 0.13, 0.005);
      K.box(g, 0.34, 0.1, 1.15, M.candy, hx, 0.35, 0.82, 0.04);
      for (i = 0; i < 6; i++) K.box(g, 0.3, 0.03, 0.04, M.chrome, hx, 0.415, 0.34 + i * 0.2, 0.005);
      for (i = 0; i < 4; i++) { var pz = 0.42 + i * 0.27; K.add(g, new THREE.CylinderGeometry(0.03, 0.04, 0.12, 8), M.pearl, hx, 0.44, pz); K.add(g, new THREE.CylinderGeometry(0.014, 0.014, 0.16, 6), M.dark, hx, 0.52, pz); }
      // bridas de escape y colectores curvados
      var pts0 = [];
      for (i = 0; i < 4; i++) {
        var zi = 0.42 + i * 0.27;
        K.add(g, new THREE.CylinderGeometry(0.09, 0.09, 0.05, 12).rotateZ(P / 2), M.chrome, s * 0.88, -0.1, zi);
        K.tube(g, [[s * 0.88, -0.1, zi], [s * 1.06, -0.16, zi + 0.12], [s * 1.12, -0.22, zi + 0.7 - i * 0.08], [s * 1.0, -0.26, 1.85]], 0.055, M.chrome, 26);
        K.add(g, new THREE.TorusGeometry(0.075, 0.016, 6, 12), M.gold, s * 0.95, -0.1, zi).rotation.y = P / 2;
      }
      // colector, tubo de escape, anillos de calor y trompeta
      K.cylZ(g, 0.13, 0.13, 0.22, M.chrome, s * 1.0, -0.26, 1.9, 18);
      K.tube(g, [[s * 1.0, -0.26, 1.9], [s * 1.0, -0.26, 2.3]], 0.11, M.chrome, 4);
      for (i = 0; i < 5; i++) { var hr = K.add(g, new THREE.TorusGeometry(0.118, 0.02, 8, 18), [M.h1, M.h2, M.h3, M.h4, M.h5][i], s * 1.0, -0.26, 2.0 + i * 0.07); }
      K.add(g, K.latheZ([[0.11, 2.3], [0.15, 2.45], [0.22, 2.62], [0.26, 2.75]], 24), M.chrome, s * 1.0, -0.26, 0);
      K.add(g, K.latheZ([[0.1, 2.32], [0.13, 2.45], [0.2, 2.62], [0.24, 2.75]], 20), M.dark, s * 1.0, -0.26, 0);
      K.glowDisc(g, 0.15, 2.5, M.neon).position.set(s * 1.0, -0.26, 2.5);
      var hz = K.add(g, new THREE.CircleGeometry(0.28, 20), M.halo, s * 1.0, -0.26, 2.77); hz.rotation.y = P;
      // protectores/soportes de los colectores
      K.strut(g, [s * 0.9, -0.28, 0.9], [s * 1.0, -0.33, 1.55], 0.02, M.steel);
      K.box(g, 0.06, 0.12, 0.1, M.candy, s * 1.0, -0.26, 1.7, 0.01);
    });
    // sobrealimentador con polea, trompetas de admisión y tomas
    K.cylZ(g, 0.23, 0.23, 0.95, M.chrome, 0, 0.5, 0.78, 22);
    K.cylZ(g, 0.17, 0.17, 0.12, M.candy, 0, 0.5, 1.3, 20);
    K.add(g, K.latheZ([[0.34, 0.0], [0.3, 0.12], [0.17, 0.25]], 24), M.carbon, 0, 0.5, 0.0);
    for (i = 0; i < 4; i++) {
      var sx = 0, sz = 0.5 + i * 0.22;
      K.add(g, K.funnel([[0.05, 0], [0.06, 0.08], [0.09, 0.15], [0.14, 0.2], [0.16, 0.22]], 18), M.chrome, sx, 0.68, sz);
      K.add(g, K.funnel([[0.045, 0.02], [0.055, 0.08], [0.085, 0.15], [0.13, 0.19], [0.15, 0.21]], 16), M.dark, sx, 0.675, sz);
    }
    var belt = K.add(g, new THREE.TorusGeometry(0.2, 0.02, 6, 24), M.carbon, 0, 0.5, 0.31); belt.scale.set(1, 1, 1);
    K.add(g, new THREE.CylinderGeometry(0.2, 0.2, 0.05, 18).rotateX(P / 2), M.steel, 0, 0.5, 0.3);
    K.add(g, new THREE.CylinderGeometry(0.06, 0.06, 0.08, 10).rotateX(P / 2), M.candy, 0, 0.5, 0.26);
    K.strut(g, [0.0, 0.3, 0.3], [0, 0.5, 0.3], 0.03, M.steel);
    // botellas de nitro y radiador de aceite
    [-1, 1].forEach(function (s) {
      var btg = new THREE.CylinderGeometry(0.1, 0.1, 0.72, 16); btg.rotateX(P / 2); K.add(g, btg, M.blue, s * 0.34, -0.5, 1.0);
      K.add(g, new THREE.SphereGeometry(0.1, 12, 8), M.blue, s * 0.34, -0.5, 0.64); K.add(g, new THREE.SphereGeometry(0.1, 12, 8), M.blue, s * 0.34, -0.5, 1.36);
      K.ring(g, 0.1, 0.012, 0.8, M.candy, 20).position.set(s * 0.34, -0.5, 0.8); K.ring(g, 0.1, 0.012, 1.2, M.candy, 20).position.set(s * 0.34, -0.5, 1.2);
      K.strut(g, [s * 0.34, -0.5, 1.36], [s * 0.34, -0.5, 1.5], 0.02, M.gold);
      K.add(g, new THREE.SphereGeometry(0.03, 8, 6), M.gold, s * 0.34, -0.5, 1.5);
      K.box(g, 0.08, 0.2, 0.05, M.chrome, s * 0.34, -0.34, 0.8, 0.01); K.box(g, 0.08, 0.2, 0.05, M.chrome, s * 0.34, -0.34, 1.2, 0.01);
    });
    K.box(g, 0.74, 0.28, 0.07, M.carbon, 0, -0.18, 0.2, 0.02);
    for (i = 0; i < 7; i++) K.box(g, 0.7, 0.012, 0.075, M.steel, 0, -0.32 + i * 0.04, 0.2, 0.002);
    K.tube(g, [[-0.2, -0.2, 0.22], [-0.25, -0.3, 0.5], [-0.15, -0.38, 0.9]], 0.016, M.gold, 10); K.tube(g, [[0.2, -0.2, 0.22], [0.25, -0.3, 0.5], [0.15, -0.38, 0.9]], 0.016, M.candy, 10);
    // volante expuesto y campana trasera
    K.cylZ(g, 0.32, 0.34, 0.14, M.carbon, 0, 0, 1.6, 30);
    K.ring(g, 0.34, 0.03, 1.6, M.neon, 36);
    for (i = 0; i < 6; i++) { var sa = i / 6 * TAU; K.strut(g, K.pol(0.05, sa, 1.69), K.pol(0.3, sa, 1.69), 0.025, M.chrome); }
    K.add(g, new THREE.CylinderGeometry(0.07, 0.07, 0.2, 12).rotateX(P / 2), M.candy, 0, 0, 1.75);
    K.add(g, K.latheZ([[0.2, 1.7], [0.24, 1.85], [0.2, 2.05], [0.15, 2.2]], 20), M.steel, 0, 0, 0);
    K.bolts(g, 10, 0.3, 1.68, 0.02, M.steel);
    // neón bajo el chasis
    [-1, 1].forEach(function (s) { K.box(g, 0.03, 0.03, 2.0, M.neon, s * 0.5, -0.36, 1.3, 0.005); K.box(g, 0.03, 0.03, 0.9, M.neon2, s * 0.9, 0.3, 0.8, 0.005); });
    b.exhaust.position.set(0, -0.2, L);
    return { group: g, name: 'Centella', size: 'pequeno', length: L, width: 2.6, height: 1.6, mount: b.mount, exhaust: b.exhaust };
  }

  /* ============================== RELÁMPAGO (mediano) ============================== */
  /* Aerospike lineal: cuña ancha y plana con rampas que convergen, una hilera de cámaras de combustión a lo largo del
     borde de fuga, colector con tubos alimentadores curvos, cercas laterales, alerones de punta y franjas de carreras. */
  function createMotorRelampago(THREE, opts) {
    var K = _carrerasKit(THREE, opts), M = K.M, P = K.P, TAU = K.TAU, b = K.base('Relámpago', 'mediano'), g = b.group, i, k;
    var W = 3.2, L = 3.7;
    // cuña principal (perfil lateral extruido a lo ancho)
    var sh = new THREE.Shape(); sh.moveTo(0.0, 0.42); sh.lineTo(1.2, 0.5); sh.lineTo(3.0, 0.1); sh.lineTo(3.4, 0.07); sh.lineTo(3.4, -0.07); sh.lineTo(3.0, -0.1); sh.lineTo(1.2, -0.5); sh.lineTo(0.0, -0.42); sh.closePath();
    var wg = new THREE.ExtrudeGeometry(sh, { depth: W, bevelEnabled: true, bevelSize: 0.03, bevelThickness: 0.03, bevelSegments: 2, curveSegments: 6 });
    wg.translate(0, 0, -W / 2); wg.rotateY(-P / 2);
    K.add(g, wg, M.pearl, 0, 0, 0);
    // placa de montaje con tornillería
    K.box(g, W + 0.1, 0.95, 0.12, M.carbon, 0, 0, 0.06, 0.04);
    for (i = 0; i < 12; i++) K.add(g, new THREE.CylinderGeometry(0.035, 0.035, 0.05, 6).rotateX(P / 2), M.steel, -1.45 + i * 0.264, i % 2 ? 0.38 : -0.38, 0.13);
    function ys(z) { return z < 1.2 ? 0.42 + 0.08 * z / 1.2 : z < 3.0 ? 0.5 - 0.4 * (z - 1.2) / 1.8 : 0.1 - 0.03 * (z - 3.0) / 0.4; }
    function onTop(sign, w, z0, z1, mat, x, off, h) {
      var ya = ys(z0), yb = ys(z1), m = K.box(g, w, h || 0.016, Math.hypot(z1 - z0, yb - ya), mat, x, sign * ((ya + yb) / 2 + (off || 0.006)), (z0 + z1) / 2, 0.003);
      m.rotation.x = -sign * Math.atan2(yb - ya, z1 - z0); return m;
    }
    [1, -1].forEach(function (sg) {
      [-0.5, 0.5].forEach(function (x) { onTop(sg, 0.2, 0.15, 1.2, M.candy, x); onTop(sg, 0.2, 1.2, 3.0, M.candy, x); });
      [-1.1, 1.1].forEach(function (x) { onTop(sg, 0.8, 1.3, 2.9, M.carbon, x, 0.01); });
      [-0.25, 0.25].forEach(function (x) { onTop(sg, 0.05, 0.15, 1.2, M.neon, x, 0.012, 0.012); onTop(sg, 0.05, 1.2, 3.0, M.neon, x, 0.012, 0.012); });
      [0.0, -1.5, 1.5].forEach(function (x) {
        onTop(sg, 0.55, 0.52, 1.0, M.dark, x, 0.012, 0.02);
        for (i = 0; i < 6; i++) onTop(sg, 0.5, 0.6 + i * 0.065, 0.62 + i * 0.065, M.steel, x, 0.03, 0.012);
      });
    });
    // hilera de cámaras de combustión en el borde de fuga (arriba y abajo)
    var N = 14, ys = [0.14, -0.14];
    for (k = 0; k < N; k++) {
      var cx = -1.3 + k * (2.6 / (N - 1));
      ys.forEach(function (y, q) {
        K.box(g, 0.14, 0.07, 0.34, M.chrome, cx, y, 3.12, 0.012);
        K.box(g, 0.09, 0.035, 0.1, M.neon, cx, y, 3.32, 0.004);
        K.box(g, 0.12, 0.03, 0.16, k % 2 ? M.h2 : M.h3, cx, y, 3.22, 0.004);
      });
      // tubos alimentadores curvos desde el colector
      K.tube(g, [[cx, 0.52, 0.5], [cx, 0.56, 1.3], [cx, 0.36, 2.3], [cx, 0.16, 2.95]], 0.022, k % 2 ? M.gold : M.copper, 20);
      K.tube(g, [[cx, -0.52, 0.5], [cx, -0.56, 1.3], [cx, -0.36, 2.3], [cx, -0.16, 2.95]], 0.022, k % 2 ? M.gold : M.copper, 20);
    }
    // colector transversal y entradas
    K.add(g, new THREE.CylinderGeometry(0.075, 0.075, 2.9, 16).rotateZ(P / 2), M.chrome, 0, 0.54, 0.5);
    K.add(g, new THREE.CylinderGeometry(0.075, 0.075, 2.9, 16).rotateZ(P / 2), M.chrome, 0, -0.54, 0.5);
    for (i = 0; i < 5; i++) { K.add(g, new THREE.TorusGeometry(0.09, 0.02, 6, 14), M.candy, -1.2 + i * 0.6, 0.54, 0.5).rotation.y = P / 2; K.add(g, new THREE.TorusGeometry(0.09, 0.02, 6, 14), M.candy, -1.2 + i * 0.6, -0.54, 0.5).rotation.y = P / 2; }
    K.cylZ(g, 0.13, 0.13, 0.25, M.steel, 0, 0.54, 0.35, 16); K.cylZ(g, 0.13, 0.13, 0.25, M.steel, 0, -0.54, 0.35, 16);
    // borde de fuga luminoso (plasma) y anillos de calor
    K.box(g, 2.8, 0.05, 0.05, M.neon, 0, 0.0, 3.42, 0.006);
    var hz = K.add(g, new THREE.PlaneGeometry(2.9, 0.5), M.halo, 0, 0, 3.44); hz.rotation.y = P;
    for (i = 0; i < 5; i++) K.box(g, 2.9, 0.03, 0.03, [M.h1, M.h2, M.h3, M.h4, M.h5][i], 0, 0.0, 3.0 + i * 0.09, 0.004);
    // cercas laterales (placas terminales) con neón, alerones de punta
    [-1, 1].forEach(function (s) {
      var x = s * (W / 2 + 0.05);
      K.box(g, 0.08, 1.05, 3.1, M.carbon, x, 0, 1.75, 0.03);
      K.box(g, 0.1, 0.05, 3.0, M.neon, x + s * 0.02, 0.5, 1.75, 0.005); K.box(g, 0.1, 0.05, 3.0, M.neon, x + s * 0.02, -0.5, 1.75, 0.005);
      K.box(g, 0.12, 0.8, 0.12, M.candy, x + s * 0.01, 0, 3.3, 0.02);
      var wl = K.box(g, 0.05, 0.62, 0.9, M.pearl, s * (W / 2 + 0.3), 0.0, 2.6, 0.02); wl.rotation.z = s * 0.25;
      K.box(g, 0.06, 0.04, 0.9, M.neon2, s * (W / 2 + 0.32), 0.3, 2.6, 0.005).rotation.z = s * 0.25;
      K.strut(g, [s * (W / 2 + 0.05), 0.0, 2.3], [s * (W / 2 + 0.3), 0.0, 2.6], 0.025, M.steel);
      for (i = 0; i < 5; i++) K.add(g, new THREE.CylinderGeometry(0.03, 0.03, 0.04, 6).rotateZ(P / 2), M.steel, x + s * 0.06, 0.0, 0.4 + i * 0.5);
    });
    // soportes de montaje delanteros
    [-1, 1].forEach(function (s) { K.box(g, 0.3, 0.2, 0.3, M.steel, s * 1.2, 0, 0.3, 0.03); K.add(g, new THREE.CylinderGeometry(0.06, 0.06, 0.32, 10).rotateX(P / 2), M.candy, s * 1.2, 0, 0.3); });
    b.exhaust.position.set(0, 0, L);
    return { group: g, name: 'Relámpago', size: 'mediano', length: L, width: W + 1.0, height: 1.1, mount: b.mount, exhaust: b.exhaust };
  }

  /* ============================== COMETA (grande) ============================== */
  /* Motor de tobera anular con espiga central: carenado fusiforme con doble bobina helicoidal luminosa, seis tomas de
     aire, tapa de carbono, corona de inyectores, aletas cruciformes de barrido y dos cápsulas propulsoras laterales. */
  function createMotorCometa(THREE, opts) {
    var K = _carrerasKit(THREE, opts), M = K.M, P = K.P, TAU = K.TAU, b = K.base('Cometa', 'grande'), g = b.group, i, k;
    var L = 7.2;
    // brida de montaje de carbono
    K.cylZ(g, 1.35, 1.35, 0.22, M.carbon, 0, 0, 0.11, 48);
    K.ring(g, 1.34, 0.05, 0.24, M.candy, 48); K.ring(g, 1.1, 0.03, 0.24, M.neon, 48);
    K.bolts(g, 24, 1.22, 0.22, 0.05, M.steel);
    // carenado fusiforme
    var fair = [[1.18, 0.22], [1.34, 0.7], [1.5, 1.4], [1.52, 2.1], [1.4, 2.8], [1.18, 3.4], [1.02, 3.7]];
    K.add(g, K.latheZ(fair, 56), M.pearl, 0, 0, 0);
    function fr(z) { for (var q = 0; q < fair.length - 1; q++) if (z <= fair[q + 1][1]) { var f = (z - fair[q][1]) / (fair[q + 1][1] - fair[q][1]); return fair[q][0] + (fair[q + 1][0] - fair[q][0]) * f; } return fair[fair.length - 1][0]; }
    // franjas y paneles
    K.ring(g, fr(0.9) + 0.01, 0.035, 0.9, M.candy, 56); K.ring(g, fr(1.0) + 0.01, 0.015, 1.0, M.neon, 56);
    K.around(g, K.UB, M.carbon, 12, fr(1.75) + 0.0, 1.75, 0.03, 0.55, 1.2, 0.13, 0);
    K.around(g, K.UB, M.candy, 12, fr(1.75) + 0.02, 1.75, 0.012, 0.08, 1.25, 0.13, 0);
    K.around(g, K.UB, M.dark, 36, fr(2.0) - 0.0, 2.0, 0.01, 0.01, 2.2, 0, 0);
    // tomas de aire frontales (6) con aspas
    for (k = 0; k < 6; k++) {
      var ia = k / 6 * TAU + 0.26, ix = Math.cos(ia) * 1.3, iy = Math.sin(ia) * 1.3;
      var sc = K.add(g, K.latheZ([[0.3, 0.3], [0.26, 0.4], [0.22, 0.55]], 20), M.chrome, ix, iy, 0);
      K.add(g, K.latheZ([[0.28, 0.3], [0.24, 0.4], [0.2, 0.55]], 20), M.dark, ix, iy, 0);
      for (i = 0; i < 6; i++) { var ba = K.add(g, new THREE.BoxGeometry(0.2, 0.02, 0.04), M.steel, ix, iy, 0.45); ba.rotation.z = i * P / 3; }
      K.ring(g, 0.3, 0.025, 0.3, M.candy, 20).position.set(ix, iy, 0.3);
    }
    // doble bobina helicoidal luminosa
    for (k = 0; k < 2; k++) {
      var pts = [];
      for (i = 0; i <= 64; i++) { var t = i / 64, z = 0.9 + t * 2.7, a = t * TAU * 3.2 + k * P; pts.push(K.pol(fr(z) + 0.07, a, z)); }
      K.tube(g, pts, 0.04, k ? M.neon2 : M.neon, 160);
      for (i = 1; i < 8; i++) { var t2 = i / 8, z2 = 0.9 + t2 * 2.7, a2 = t2 * TAU * 3.2 + k * P, pp = K.pol(fr(z2) + 0.07, a2, z2); K.add(g, new THREE.SphereGeometry(0.075, 10, 8), M.chrome, pp[0], pp[1], pp[2]); }
    }
    // tobera anular: pared exterior, espiga central larga y corona de inyectores
    var outer = [[1.02, 3.5], [1.05, 4.0], [1.14, 4.8], [1.26, 5.6]];
    K.add(g, K.latheZ(outer, 48), M.chrome, 0, 0, 0);
    K.add(g, K.latheZ([[0.98, 3.55], [1.01, 4.0], [1.1, 4.8], [1.22, 5.6]], 44), M.dark, 0, 0, 0);
    var spike = [[0.78, 3.4], [0.74, 4.0], [0.62, 4.9], [0.42, 5.9], [0.2, 6.8], [0.0, 7.2]];
    K.add(g, K.latheZ(spike, 48), M.steel, 0, 0, 0);
    for (i = 0; i < 9; i++) { var zz = 3.7 + i * 0.36, rr = 0.78 - (zz - 3.4) / 3.8 * 0.78 + 0.04; K.ring(g, Math.max(0.05, rr), 0.022, zz, i % 3 === 0 ? M.candy : M.chrome, 40); }
    [M.h1, M.h2, M.h3, M.h4, M.h5].forEach(function (m, n) { K.ring(g, 1.2 + n * 0.012, 0.035, 5.15 + n * 0.1, m, 48); });
    K.ring(g, 1.27, 0.045, 5.6, M.h5, 48);
    // corona de 20 inyectores en la garganta y brillo en la ranura anular
    for (k = 0; k < 20; k++) { var ja = k / 20 * TAU, jp = K.pol(0.92, ja, 3.7); K.add(g, new THREE.CylinderGeometry(0.045, 0.06, 0.2, 8).rotateX(P / 2), M.gold, jp[0], jp[1], jp[2]); K.add(g, new THREE.SphereGeometry(0.035, 6, 5), M.neon, jp[0], jp[1], 3.8); }
    var ann = K.add(g, new THREE.RingGeometry(0.8, 0.98, 48), M.neon, 0, 0, 4.2); ann.rotation.y = P;
    K.add(g, new THREE.RingGeometry(0.78, 1.2, 48), M.halo, 0, 0, 5.62).rotation.y = P;
    // aletas cruciformes de barrido (4) con neón y franja candy
    for (k = 0; k < 4; k++) {
      var fa = k / 4 * TAU + P / 4, fg = new THREE.Group(); fg.rotation.z = fa; g.add(fg);
      var fs = new THREE.Shape(); fs.moveTo(0, 0); fs.lineTo(1.5, 0.0); fs.lineTo(1.9, 1.1); fs.lineTo(1.4, 1.2); fs.lineTo(0.0, 0.9); fs.closePath();
      var fgeo = new THREE.ExtrudeGeometry(fs, { depth: 0.07, bevelEnabled: true, bevelSize: 0.015, bevelThickness: 0.015, bevelSegments: 2 });
      fgeo.translate(0, 0, -0.035); fgeo.rotateX(P / 2);
      K.add(fg, fgeo, M.pearl, 0, 0, 3.3);
      [-1, 1].forEach(function (q) { K.strut(fg, [1.5, q * 0.04, 3.3], [1.9, q * 0.04, 4.4], 0.022, M.neon); });
      K.strut(fg, [1.3, 0.04, 3.4], [1.62, 0.04, 4.2], 0.02, M.candy); K.strut(fg, [1.3, -0.04, 3.4], [1.62, -0.04, 4.2], 0.02, M.candy);
    }
    // cápsulas propulsoras laterales con pilonos
    [-1, 1].forEach(function (s) {
      var px = s * 2.55, pod = new THREE.Group(); pod.position.set(px, 0.0, 0); g.add(pod);
      K.add(pod, K.latheZ([[0.0, 1.1], [0.26, 1.3], [0.42, 1.9], [0.45, 2.8], [0.36, 3.8], [0.22, 4.5], [0.19, 4.8]], 32), M.pearl, 0, 0, 0);
      K.ring(pod, 0.44, 0.03, 2.2, M.candy, 32); K.ring(pod, 0.4, 0.015, 3.1, M.neon, 32);
      K.add(pod, K.latheZ([[0.16, 4.7], [0.2, 4.9], [0.26, 5.1]], 20), M.chrome, 0, 0, 0);
      K.add(pod, K.latheZ([[0.14, 4.72], [0.18, 4.9], [0.24, 5.1]], 16), M.dark, 0, 0, 0);
      K.glowDisc(pod, 0.16, 4.85, M.neon);
      var pz = K.add(pod, new THREE.CircleGeometry(0.3, 20), M.halo, 0, 0, 5.12); pz.rotation.y = P;
      for (i = 0; i < 4; i++) { var za = 1.9 + i * 0.55; K.box(pod, 0.2, 0.012, 0.05, M.dark, 0, 0.45, za, 0.002); }
      K.add(pod, new THREE.SphereGeometry(0.12, 12, 8), M.glass, 0, 0.33, 1.65).scale.set(1, 0.7, 1.7);
      K.around(pod, K.UB, M.carbon, 8, 0.44, 2.6, 0.02, 0.15, 0.6, 0, 0);
      // pilonos al carenado
      K.box(g, 1.0, 0.1, 0.5, M.pearl, s * 1.5, 0, 2.0, 0.03);
      K.box(g, 1.0, 0.1, 0.5, M.pearl, s * 1.5, 0, 3.2, 0.03);
      K.box(g, 1.0, 0.03, 0.52, M.candy, s * 1.5, 0.06, 2.0, 0.005); K.box(g, 1.0, 0.03, 0.52, M.candy, s * 1.5, 0.06, 3.2, 0.005);
      K.strut(g, [s * 1.3, 0, 2.0], [s * 2.2, 0, 2.0], 0.04, M.steel); K.strut(g, [s * 1.3, 0, 3.2], [s * 2.2, 0, 3.2], 0.04, M.steel);
    });
    // tubos de refrigeración entre carenado y cápsulas (curvos)
    [-1, 1].forEach(function (s) { K.tube(g, [[s * 1.4, 0.3, 1.2], [s * 1.9, 0.5, 1.5], [s * 2.3, 0.3, 1.9]], 0.04, M.gold, 18); K.tube(g, [[s * 1.4, -0.3, 1.2], [s * 1.9, -0.5, 1.5], [s * 2.3, -0.3, 1.9]], 0.04, M.copper, 18); });
    b.exhaust.position.set(0, 0, L);
    return { group: g, name: 'Cometa', size: 'grande', length: L, width: 6.4, height: 3.8, mount: b.mount, exhaust: b.exhaust };
  }

  var tablaCarreras = { pequeno: createMotorCentella, mediano: createMotorRelampago, grande: createMotorCometa };
  function obtenerMotorCarreras(THREE, size, opts) { var f = tablaCarreras[size]; if (!f) throw new Error("size debe ser 'pequeno', 'mediano' o 'grande'"); return f(THREE, opts); }
  function obtenerMotoresCarreras(THREE, opts) { return { pequeno: createMotorCentella(THREE, opts), mediano: createMotorRelampago(THREE, opts), grande: createMotorCometa(THREE, opts) }; }
