/* Torreta antiaérea doble (arma antigua y barata) — adaptada de torreta_v2.js para el juego.
   1 unidad = 1 m. Sin renderer ni botones propios: el juego la coloca, la apunta y la dispara.
   API: createTorreta(THREE, opts) -> { group, footprint, update(t), setGhost(on, ok), apuntar(ry, rp), disparar(on), recargar(),
        municion(), asiento(posOut, quatOut), escala: 1 }   ry>0 gira a la izquierda, rp>0 sube el cañón. */
function createTorreta(THREE, opts) {
  opts = opts || {};
  var group = new THREE.Group();
  var fx = new THREE.Group(); group.add(fx);   // trazadoras, casquillos y humo (no giran con la torreta)
    function mat(c, m, r) { return new THREE.MeshStandardMaterial({ color: c, metalness: m, roughness: r }); }
    var steel = mat(0x2b3038, 0.85, 0.42), steel2 = mat(0x3d434d, 0.9, 0.32), olive = mat(0x4a5a34, 0.35, 0.5), dark = mat(0x2f3a24, 0.4, 0.5),
      black = mat(0x07080b, 0.3, 0.7), brass = mat(0xc89b3c, 1, 0.3), leather = mat(0x3a2a1c, 0.1, 0.7), red = mat(0xc8202e, 0.3, 0.4), gray = mat(0x6b7280, 0.5, 0.5);

    /* ---- Utilidades de modelado ---- */
    function rs(pts, r) {
      var s = new THREE.Shape(), n = pts.length;
      for (var i = 0; i < n; i++) {
        var p0 = pts[(i + n - 1) % n], p1 = pts[i], p2 = pts[(i + 1) % n];
        var ax = p0[0] - p1[0], ay = p0[1] - p1[1], bx = p2[0] - p1[0], by = p2[1] - p1[1];
        var la = Math.hypot(ax, ay), lb = Math.hypot(bx, by), rr = Math.min(r, la / 2.2, lb / 2.2);
        var sx = p1[0] + ax / la * rr, sy = p1[1] + ay / la * rr, ex = p1[0] + bx / lb * rr, ey = p1[1] + by / lb * rr;
        if (i == 0) s.moveTo(sx, sy); else s.lineTo(sx, sy);
        s.quadraticCurveTo(p1[0], p1[1], ex, ey);
      }
      s.closePath(); return s;
    }
    function ex(sh, depth, bev) { return new THREE.ExtrudeGeometry(sh, { depth: depth, bevelEnabled: true, bevelThickness: bev, bevelSize: bev, bevelSegments: 6, curveSegments: 10 }); }
    function E(par, pts, depth, bev, m, z, r) { var g = ex(rs(pts, r == null ? 0.1 : r), depth, bev); g.translate(0, 0, -depth / 2); var o = new THREE.Mesh(g, m); o.position.z = z || 0; par.add(o); return o; }
    function Z(par, pts, holes, thick, bev, m, x, r) {
      var sh = rs(pts, r || 0.12);
      (holes || []).forEach(function (h) { var p = new THREE.Path(); p.absarc(h[0], h[1], h[2], 0, Math.PI * 2, true); sh.holes.push(p); });
      var g = ex(sh, thick, bev); g.translate(0, 0, -thick / 2); g.rotateY(-Math.PI / 2);
      var o = new THREE.Mesh(g, m); o.position.x = x; par.add(o); return o;
    }
    function C(par, r, len, x, y, z, m, r2, open) { var g = new THREE.CylinderGeometry(r, r2 || r, len, 32, 1, !!open); g.rotateZ(Math.PI / 2); var o = new THREE.Mesh(g, m); o.position.set(x, y, z || 0); par.add(o); return o; }
    function CZ(par, r, len, x, y, z, m) { var g = new THREE.CylinderGeometry(r, r, len, 32); g.rotateX(Math.PI / 2); var o = new THREE.Mesh(g, m); o.position.set(x, y, z); par.add(o); return o; }
    function CY(par, r, h, x, y, z, m, rb) { var o = new THREE.Mesh(new THREE.CylinderGeometry(r, rb || r, h, 36), m); o.position.set(x, y, z); par.add(o); return o; }
    function B(par, w, h, d, x, y, z, m, rz) { var o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y, z); if (rz) o.rotation.z = rz; par.add(o); return o; }
    function S(par, x, y, z, r) { var o = new THREE.Mesh(new THREE.SphereGeometry(r || 0.04, 10, 8), steel2); o.scale.z = 0.5; o.position.set(x, y, z); par.add(o); return o; }
    function R(par, ax, ay, az, bx, by, bz, r, m) {
      var a = new THREE.Vector3(ax, ay, az), b = new THREE.Vector3(bx, by, bz), d = b.clone().sub(a);
      var o = new THREE.Mesh(new THREE.CylinderGeometry(r, r, d.length(), 14), m);
      o.position.copy(a).add(b).multiplyScalar(0.5); o.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()); par.add(o); return o;
    }

    var base = new THREE.Group(); group.add(base);
    CY(base, 0.8, 0.5, 0, 0.25, 0, olive, 1.1);
    for (var li = 0; li < 3; li++) {
      var lg = new THREE.Group(); lg.rotation.y = li * Math.PI * 2 / 3 + Math.PI / 2; base.add(lg);
      B(lg, 3.0, 0.22, 0.4, 2.1, 0.25, 0, olive); B(lg, 2.9, 0.06, 0.44, 2.1, 0.38, 0, dark);
      CY(lg, 0.38, 0.12, 3.55, 0.06, 0, steel, 0.44); R(lg, 0.5, 1.3, 0, 2.3, 0.3, 0, 0.07, steel);
      S(lg, 1.2, 0.38, 0.2, 0.05); S(lg, 2.4, 0.38, 0.2, 0.05); S(lg, 3.3, 0.38, 0.2, 0.05);
    }
    CY(base, 0.5, 1.1, 0, 1.05, 0, steel, 0.55); CY(base, 0.62, 0.12, 0, 0.9, 0, steel2); CY(base, 1.3, 0.2, 0, 1.5, 0, steel2);

    /* Detalles de suelo: sacos de arena, cajas y tambores de repuesto */
    var sandM = mat(0xa08c4c, 0.05, 0.9);
    for (var sb = 0; sb < 14; sb++) { var sa = Math.PI * 0.8 + sb * (Math.PI * 0.4 / 13); [0, 1].forEach(function (ly) { var bg = B(group, 0.9, 0.38, 0.5, 5.2 * Math.cos(sa + ly * 0.05), 0.19 + ly * 0.36, 5.2 * Math.sin(sa + ly * 0.05), sandM); bg.rotation.y = -(sa + ly * 0.05 + Math.PI / 2); }); }
    [[-2.0, 4.2], [-1.0, 4.9]].forEach(function (p) {
      B(group, 1.0, 0.5, 0.6, p[0], 0.25, p[1], olive); B(group, 1.04, 0.05, 0.64, p[0], 0.52, p[1], dark); B(group, 0.4, 0.06, 0.08, p[0], 0.58, p[1], steel2); B(group, 0.5, 0.04, 0.62, p[0] + 0.3, 0.25, p[1], mat(0xa08c4c, 0.3, 0.55));
    });
    [[2.4, 4.4], [3.2, 4.0]].forEach(function (p) { CY(group, 0.5, 0.34, p[0], 0.17, p[1], olive); CY(group, 0.52, 0.04, p[0], 0.34, p[1], steel2); CY(group, 0.16, 0.38, p[0], 0.17, p[1], steel2); });

    /* ---- Plataforma giratoria (guiñada) ---- */
    var yaw = new THREE.Group(); yaw.position.y = 1.6; group.add(yaw);
    CY(yaw, 1.35, 0.15, 0, 0.075, 0, olive); CY(yaw, 1.38, 0.05, 0, 0.02, 0, steel2);
    [1, -1].forEach(function (sd) {
      E(yaw, [[-0.7, 0.1], [1.0, 0.1], [1.1, 1.1], [0.5, 1.75], [-0.3, 1.6], [-0.65, 1.0]], 0.14, 0.04, olive, 0.78 * sd, 0.12);
      CZ(yaw, 0.22, 0.2, 0.4, 1.15, 0.84 * sd, steel2); S(yaw, -0.4, 0.5, 0.88 * sd); S(yaw, 0.7, 0.5, 0.88 * sd); S(yaw, 0.1, 1.4, 0.88 * sd);
    });
    /* Asiento del artillero con respaldo, poste, reposapiés y pedales */
    CY(yaw, 0.07, 0.85, -1.35, 0.425, 0, steel);
    E(yaw, [[-1.75, 0.85], [-0.95, 0.85], [-0.95, 1.0], [-1.75, 1.0]], 0.7, 0.07, leather, 0, 0.1);
    E(yaw, [[-1.8, 1.0], [-1.7, 1.0], [-1.62, 1.85], [-1.88, 1.85]], 0.6, 0.05, leather, 0, 0.08);
    R(yaw, -1.7, 1.0, 0.2, -1.35, 0.4, 0.2, 0.04, steel); R(yaw, -1.7, 1.0, -0.2, -1.35, 0.4, -0.2, 0.04, steel);
    E(yaw, [[-0.5, 0.35], [0.2, 0.35], [0.2, 0.45], [-0.5, 0.45]], 0.9, 0.04, steel, 0, 0.05);
    [1, -1].forEach(function (sd) { B(yaw, 0.3, 0.05, 0.25, -0.15, 0.55, 0.3 * sd, black, 0.25); R(yaw, -0.3, 0.45, 0.3 * sd, 0.0, 0.58, 0.3 * sd, 0.03, steel2); });

    /* Detalles de la plataforma: dentado, placa antideslizante, volantes de giro y elevación, asideros, apoyabrazos y cabecera */
    for (var tn = 0; tn < 36; tn++) { var ta = tn * Math.PI / 18, tb2 = B(yaw, 0.12, 0.08, 0.1, 1.4 * Math.cos(ta), 0.03, 1.4 * Math.sin(ta), steel2); tb2.rotation.y = -ta; }
    for (var sp = 0; sp < 9; sp++) B(yaw, 0.05, 0.012, 0.9, -1.2 + sp * 0.3, 0.157, 0, black);
    var wheels = [];
    function wheel(x, y, z) {
      var wg = new THREE.Group(); wheels.push(wg); wg.position.set(x, y, z); yaw.add(wg);
      wg.add(new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.03, 8, 24), black));
      for (var k = 0; k < 3; k++) { var spk = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.04, 0.04), steel2); spk.rotation.z = k * Math.PI / 3; wg.add(spk); }
      var hub = new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 10), steel); wg.add(hub);
      var kn = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.16, 10), red); kn.rotation.x = Math.PI / 2; kn.position.set(0.26, 0.0, 0.08); wg.add(kn);
    }
    wheel(-0.2, 0.7, 0.98); wheel(0.3, 1.0, -0.98);
    CZ(yaw, 0.05, 0.3, -0.2, 0.7, 0.86, steel); CZ(yaw, 0.05, 0.3, 0.3, 1.0, -0.86, steel);
    [1, -1].forEach(function (sd) {
      E(yaw, [[-1.7, 1.0], [-1.0, 1.0], [-1.0, 1.12], [-1.7, 1.12]], 0.1, 0.03, leather, 0.42 * sd, 0.04);
      R(yaw, -1.0, 1.0, 0.42 * sd, -1.0, 1.12, 0.42 * sd, 0.03, steel);
      R(yaw, -1.0, 0.2, 0.9 * sd, -1.0, 1.3, 0.9 * sd, 0.035, steel2); R(yaw, -1.0, 1.3, 0.9 * sd, -1.6, 1.3, 0.9 * sd, 0.035, steel2);
      for (var rv = 0; rv < 6; rv++) { S(yaw, -0.55 + rv * 0.28, 0.12, 0.855 * sd, 0.035); }
      B(yaw, 1.2, 0.02, 0.02, 0.15, 1.35, 0.865 * sd, black); B(yaw, 1.0, 0.02, 0.02, 0.15, 0.4, 0.865 * sd, black);
    });
    E(yaw, [[-1.82, 1.85], [-1.7, 1.85], [-1.68, 2.15], [-1.82, 2.15]], 0.4, 0.05, leather, 0, 0.06);
    R(yaw, -1.0, 0.15, 0.5, -0.4, 0.15, 0.2, 0.03, black); R(yaw, -0.4, 0.15, 0.2, -0.2, 0.7, 0.86, 0.025, black);

    /* ---- Cuna con muñones (elevación) ---- */
    var pitch = new THREE.Group(); pitch.position.set(0.4, 1.15, 0); yaw.add(pitch);
    CZ(pitch, 0.14, 1.9, 0, 0, 0, steel2);
    Z(pitch, [[-1.0, -0.9], [1.0, -0.9], [1.15, 0.2], [0.6, 0.95], [-0.6, 0.95], [-1.15, 0.2]], [[-0.45, 0, 0.17], [0.45, 0, 0.17]], 0.12, 0.04, olive, 0.95, 0.1);
    [[-0.95, 0.6], [0.95, 0.6], [-1.0, -0.7], [1.0, -0.7]].forEach(function (p) { S(pitch, 1.03, p[1], p[0], 0.05); });
    /* Mando del artillero: FIJO a la plataforma (no sube ni baja con los cañones). Dos palancas con gatillo rojo; las manos las agarran */
    var mando = new THREE.Group(); mando.position.set(-0.8, 1.4, 0); yaw.add(mando);
    var levs = [];
    R(mando, 0, -0.1, -0.6, 0, -0.1, 0.6, 0.05, steel);
    [1, -1].forEach(function (sd) {
      R(mando, 0.35, -0.5, 0.45 * sd, 0, -0.1, 0.6 * sd, 0.05, steel);
      var lv = new THREE.Group(); lv.position.set(0, -0.1, 0.6 * sd); mando.add(lv); levs.push(lv);
      CY(lv, 0.045, 0.36, 0, 0.18, 0, black); CY(lv, 0.06, 0.05, 0, 0.0, 0, steel2);
      var tb = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.08, 12), red); tb.rotation.x = Math.PI / 2; tb.position.set(0.06, 0.3, 0); lv.add(tb);
    });
    /* Mira de anillos CENTRAL: puente sobre las dos cajas, poste trasero, poste delantero apoyado en el escudo */
    var mirT = new THREE.Group(); pitch.add(mirT);
    B(mirT, 0.9, 0.08, 1.3, -0.2, 0.5, 0, steel2); B(mirT, 0.3, 0.1, 0.3, -0.6, 0.58, 0, steel2);
    [[-0.6, 0.36], [-0.6, -0.36], [0.2, 0.36], [0.2, -0.36]].forEach(function (p) { S(mirT, p[0], 0.55, p[1], 0.04); });
    R(mirT, -0.6, 0.53, 0, -0.6, 0.98, 0, 0.04, steel2);
    var rg1 = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.025, 8, 28), steel2); rg1.rotation.y = Math.PI / 2; rg1.position.set(-0.6, 1.2, 0); mirT.add(rg1);
    B(mirT, 0.04, 0.5, 0.03, -0.6, 1.2, 0, steel2); B(mirT, 0.04, 0.03, 0.5, -0.6, 1.2, 0, steel2);
    R(pitch, 1.0, 0.95, 0, 1.0, 1.2, 0, 0.04, steel2); R(pitch, 1.0, 1.2, 0, 1.5, 1.2, 0, 0.035, steel2);
    var rg2 = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.02, 8, 20), steel2); rg2.rotation.y = Math.PI / 2; rg2.position.set(1.6, 1.2, 0); pitch.add(rg2); B(pitch, 0.03, 0.12, 0.03, 1.6, 1.2, 0, red);
    B(pitch, 0.5, 0.05, 0.3, 1.0, 0.97, 0, steel2); S(pitch, 0.9, 0.99, 0.1, 0.035); S(pitch, 0.9, 0.99, -0.1, 0.035);

    /* Detalles del escudo y la cuna: nervios, cubierta superior, sector dentado de elevación y amortiguadores */
    [0.55, 0.15, -0.25, -0.65].forEach(function (y) { B(pitch, 0.03, 0.05, 2.0, 1.03, y, 0, steel2); });
    B(pitch, 0.16, 0.04, 1.3, 1.0, 0.98, 0, dark, 0.15);
    var sec = new THREE.Mesh(new THREE.TorusGeometry(0.8, 0.05, 8, 40, 1.5), steel2); sec.position.set(0, 0, -1.02); pitch.add(sec);
    for (var tt = 0; tt < 14; tt++) { var tA = tt * 1.5 / 13, tb3 = B(pitch, 0.1, 0.08, 0.1, 0.8 * Math.cos(tA), 0.8 * Math.sin(tA), -1.02, steel2); tb3.rotation.z = tA; }
    [1, -1].forEach(function (sd) { C(pitch, 0.08, 1.4, -0.35, -0.55, 0.45 * sd, steel); C(pitch, 0.05, 1.4, -0.35, -0.55, 0.45 * sd, steel2, 0.05); S(pitch, 0.35, -0.55, 0.45 * sd, 0.07); });

    /* ---- Dos cañones con retroceso independiente ---- */
    var gn = [], muz = [];
    [1, -1].forEach(function (sd, idx) {
      var gg = new THREE.Group(); gg.position.z = 0.45 * sd; pitch.add(gg); gn.push({ g: gg, rec: 0, sd: sd, flash: 0 });
      E(gg, [[-0.9, -0.3], [0.7, -0.3], [0.7, 0.3], [-0.9, 0.3]], 0.34, 0.06, steel, 0, 0.1);
      E(gg, [[-0.8, 0.3], [0.5, 0.3], [0.5, 0.42], [-0.8, 0.42]], 0.26, 0.04, steel2, 0, 0.05);
      C(gg, 0.14, 0.3, -1.05, 0, 0, steel2); C(gg, 0.07, 2.2, 0.9, -0.28, 0, steel2); C(gg, 0.1, 3.8, 2.6, 0, 0, steel2);
      C(gg, 0.18, 1.5, 1.45, 0, 0, steel); [0.8, 2.2].forEach(function (x) { C(gg, 0.2, 0.06, x, 0, 0, steel2); });
      for (var k = 0; k < 6; k++) { var hx = 1.0 + k * 0.23;[1, -1].forEach(function (s2) { var d = new THREE.Mesh(new THREE.CircleGeometry(0.045, 12), black); d.position.set(hx, 0, 0.181 * s2); d.rotation.y = s2 > 0 ? 0 : Math.PI; gg.add(d); }); var t = new THREE.Mesh(new THREE.CircleGeometry(0.045, 12), black); t.rotation.x = -Math.PI / 2; t.position.set(hx, 0.181, 0); gg.add(t); }
      C(gg, 0.12, 0.7, 4.85, 0, 0, steel, 0.17);
      for (var f = 0; f < 3; f++) { B(gg, 0.08, 0.04, 0.12, 4.7 + f * 0.15, 0.17, 0, black); B(gg, 0.08, 0.04, 0.12, 4.7 + f * 0.15, -0.17, 0, black); }
      var mz = new THREE.Mesh(new THREE.CircleGeometry(0.08, 18), black); mz.rotation.y = Math.PI / 2; mz.position.set(5.205, 0, 0); gg.add(mz);
      B(gg, 0.4, 0.03, 0.2, 0.1, -0.31, 0, black); B(gg, 0.5, 0.2, 0.04, 0.0, 0.1, 0.18 * sd, black);
      E(gg, [[-0.6, 0.0], [-0.1, 0.0], [-0.1, 0.08], [-0.6, 0.08]], 0.04, 0.02, red, 0.2 * sd, 0.03);
      S(gg, -0.6, 0.2, 0.19 * sd); S(gg, 0.4, 0.2, 0.19 * sd); S(gg, 0.4, -0.2, 0.19 * sd);
      for (var cf = 0; cf < 6; cf++) C(gg, 0.115, 0.025, 3.0 + cf * 0.2, 0, 0, steel2);
      C(gg, 0.07, 0.8, -0.2, -0.42, 0, steel); B(gg, 0.34, 0.08, 0.1, 1.0, 0.0, 0.15 * sd, black);
      for (var pm = 0; pm < 3; pm++) { B(gg, 0.05, 0.1, 0.08, 4.72 + pm * 0.15, 0, 0.17 * sd, black); }
      B(gg, 0.5, 0.02, 0.36, 0.2, 0.43, 0, black); for (var lh = 0; lh < 4; lh++) B(gg, 0.03, 0.03, 0.3, -0.5 + lh * 0.3, 0.435, 0, steel2);
      var fs = new THREE.Sprite(new THREE.SpriteMaterial({ map: fireTex(), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true })); fs.position.set(5.5, 0, 0); fs.visible = false; gg.add(fs); gn[idx].fs = fs;
    });
    function fireTex() { if (fireTex.t) return fireTex.t; var c = document.createElement('canvas'); c.width = c.height = 64; var x = c.getContext('2d'); var g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(255,255,220,1)'); g.addColorStop(0.35, 'rgba(255,170,50,0.9)'); g.addColorStop(1, 'rgba(255,80,0,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64); return (fireTex.t = new THREE.CanvasTexture(c)); }
    function smokeTex() { if (smokeTex.t) return smokeTex.t; var c = document.createElement('canvas'); c.width = c.height = 64; var x = c.getContext('2d'); var g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(200,200,200,0.9)'); g.addColorStop(1, 'rgba(120,120,120,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64); return (smokeTex.t = new THREE.CanvasTexture(c)); }
    var drums = [];
    [1, -1].forEach(function (sd) {
      var dg = new THREE.Group(); dg.position.set(-0.1, 1.05, 0.45 * sd); pitch.add(dg); drums.push(dg);
      CZ(dg, 0.55, 0.3, 0, 0, 0, olive); CZ(dg, 0.58, 0.04, 0, 0, 0.14, steel2); CZ(dg, 0.58, 0.04, 0, 0, -0.14, steel2); CZ(dg, 0.15, 0.36, 0, 0, 0, steel2);
      for (var k = 0; k < 12; k++) { var a = k * Math.PI / 6; B(dg, 0.05, 0.12, 0.31, 0.56 * Math.cos(a), 0.56 * Math.sin(a), 0, dark, a); }
      var th = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.025, 8, 18, Math.PI), steel2); th.position.set(0, 0.55, 0); dg.add(th);
      B(dg, 0.4, 0.2, 0.26, 0.1, -0.5, 0, steel);
    });
    var tracers = [], casings = [], puffs = [], pIdx = 0, cIdx = 0, tIdx = 0;
    var tg = new THREE.CylinderGeometry(0.04, 0.04, 0.9, 8); tg.rotateZ(Math.PI / 2);
    for (var i = 0; i < 30; i++) { var tm = new THREE.Mesh(tg, new THREE.MeshBasicMaterial({ color: 0xffd25a, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false })); tm.visible = false; fx.add(tm); tracers.push({ m: tm, v: new THREE.Vector3(), t: 99 }); }
    var cg = new THREE.CylinderGeometry(0.05, 0.06, 0.3, 10);
    for (i = 0; i < 24; i++) { var cm = new THREE.Mesh(cg, brass); cm.visible = false; fx.add(cm); casings.push({ m: cm, v: new THREE.Vector3(), w: new THREE.Vector3(), t: 99 }); }
    for (i = 0; i < 50; i++) { var ps = new THREE.Sprite(new THREE.SpriteMaterial({ map: smokeTex(), transparent: true, depthWrite: false })); ps.visible = false; fx.add(ps); puffs.push({ s: ps, v: new THREE.Vector3(), t: 9, life: 1, size: 1 }); }
    function puff(pos, vel, size, life) { var p = puffs[pIdx++ % puffs.length]; p.s.position.copy(pos); p.v.copy(vel); p.t = 0; p.life = life; p.size = size; p.s.visible = true; }
  /* ---- Estado y control ---- */
  var ammo = 120, firing = false, nextSide = 0, cd = 0, reloadState = 0, rt = 0, drops = [], yawA = 0, pitchA = 0.35, aimY = 0, aimP = 0, tPrev = null, api0 = { tiempo: 0.9 };
  var qa = new THREE.Quaternion(), qb = new THREE.Quaternion(), va = new THREE.Vector3(), vb = new THREE.Vector3(), fxQ = new THREE.Quaternion();
  function aLocal(p) { return fx.worldToLocal(p); }
  function shoot() {
    group.updateMatrixWorld(true); fx.getWorldQuaternion(fxQ); fxQ.invert();
    var gi = nextSide; nextSide = 1 - nextSide; var G = gn[gi]; ammo--; G.rec = 1; G.flash = 0.05;
    pitch.getWorldQuaternion(qa);
    var dir = new THREE.Vector3(1, 0, 0).applyQuaternion(qa).add(new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(0.012)).normalize();
    dir.applyQuaternion(fxQ);
    var T = tracers[tIdx++ % tracers.length]; T.m.position.copy(aLocal(G.g.localToWorld(new THREE.Vector3(5.5, 0, 0)))); T.m.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), dir); T.v.copy(dir).multiplyScalar(260); T.t = 0; T.m.visible = true;
    puff(T.m.position.clone(), new THREE.Vector3(Math.random() * 0.6 - 0.3, 0.5, Math.random() * 0.6 - 0.3), 0.35, 0.9);
    var c = casings[cIdx++ % casings.length]; c.m.position.copy(aLocal(G.g.localToWorld(new THREE.Vector3(0.1, -0.4, 0)))); c.v.set(Math.random() - 0.5, -0.5, G.sd * (1 + Math.random())); c.w.set(Math.random() * 20 - 10, Math.random() * 20 - 10, Math.random() * 20 - 10); c.t = 0; c.m.visible = true;
  }
  function dropDrums() {
    group.updateMatrixWorld(true);
    drums.forEach(function (d, i) {
      var c = d.clone(), wp = new THREE.Vector3(), wq = new THREE.Quaternion(); d.getWorldPosition(wp); d.getWorldQuaternion(wq);
      c.position.copy(aLocal(wp)); fx.getWorldQuaternion(qb); c.quaternion.copy(qb.invert().multiply(wq)); c.scale.set(1, 1, 1); fx.add(c); d.visible = false;
      drops.push({ m: c, v: new THREE.Vector3(0, 2, i ? -3 : 3), w: i ? -4 : 4, t: 0 });
    });
  }
  function update(t) {
    var dt = tPrev == null ? 0.016 : Math.min(Math.max(t - tPrev, 0), 0.1); tPrev = t;
    yawA += aimY * 1.1 * dt; pitchA = Math.min(1.45, Math.max(-0.08, pitchA + aimP * 0.8 * dt)); yaw.rotation.y = yawA; pitch.rotation.z = pitchA; wheels.forEach(function (w, k) { w.rotation.z -= aimP * dt * 5; });
    cd -= dt;
    if (firing && cd <= 0 && ammo > 0 && !reloadState) { shoot(); cd = 1 / 12; }
    gn.forEach(function (G) { G.rec *= Math.exp(-dt * 14); G.g.position.x = -0.4 * G.rec; G.flash -= dt; G.fs.visible = G.flash > 0; if (G.fs.visible) G.fs.scale.setScalar(1.2 + Math.random() * 0.8); });
    if (reloadState) {
      rt += dt;
      if (reloadState == 1 && rt > 0.3) { dropDrums(); reloadState = 2; rt = 0; }
      else if (reloadState == 2 && rt > api0.tiempo) { reloadState = 3; rt = 0; drums.forEach(function (d) { d.visible = true; d.scale.setScalar(0.01); }); }
      else if (reloadState == 3) { var k = Math.min(1, rt / 0.3); drums.forEach(function (d) { d.scale.setScalar(Math.max(0.01, k)); }); if (k >= 1) { ammo = 120; reloadState = 0; } }
    }
    for (var i = drops.length - 1; i >= 0; i--) {
      var D = drops[i]; D.t += dt; D.v.y -= 22 * dt; D.m.position.addScaledVector(D.v, dt); D.m.rotation.z += D.w * dt;
      if (D.m.position.y < 0.6) { D.m.position.y = 0.6; D.v.y = Math.abs(D.v.y) > 1.5 ? -D.v.y * 0.3 : 0; D.v.x *= 0.7; D.v.z *= 0.7; D.w *= 0.7; }
      if (D.t > 6) { fx.remove(D.m); drops.splice(i, 1); }
    }
    tracers.forEach(function (T) { if (!T.m.visible) return; T.t += dt; T.m.position.addScaledVector(T.v, dt); if (T.t > 2.2) T.m.visible = false; });
    casings.forEach(function (c) {
      if (!c.m.visible) return; c.t += dt; c.v.y -= 22 * dt; c.m.position.addScaledVector(c.v, dt);
      c.m.rotation.x += c.w.x * dt; c.m.rotation.y += c.w.y * dt; c.m.rotation.z += c.w.z * dt;
      if (c.m.position.y < 0.05) { c.m.position.y = 0.05; c.v.y = Math.abs(c.v.y) > 1 ? -c.v.y * 0.3 : 0; c.v.x *= 0.6; c.v.z *= 0.6; c.w.multiplyScalar(0.6); }
      if (c.t > 3) c.m.visible = false;
    });
    puffs.forEach(function (p) { if (!p.s.visible) return; p.t += dt; var kk = p.t / p.life; if (kk >= 1) { p.s.visible = false; return; } p.s.position.addScaledVector(p.v, dt); p.v.multiplyScalar(1 - dt); p.s.scale.setScalar(p.size * (1 + kk * 2.5)); p.s.material.opacity = 0.6 * (1 - kk); });
  }
  /* cámara del artillero: ojos en el asiento, mirando por donde apuntan los cañones */
  var qy = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -Math.PI / 2);
  function asiento(pos, quat) {
    group.updateMatrixWorld(true); pos.copy(yaw.localToWorld(vb.set(-1.3, 1.9, 0))); pitch.getWorldQuaternion(qa); quat.copy(qa).multiply(qy);
  }
  var mats = null;
  function setGhost(on, ok) {
    if (!mats) { mats = []; group.traverse(function (o) { if (o.isMesh && o.material && mats.indexOf(o.material) < 0) mats.push(o.material); }); mats.forEach(function (m) { m._g0 = { t: m.transparent, o: m.opacity, e: m.emissive ? m.emissive.getHex() : 0 }; }); }
    mats.forEach(function (m) { if (on) { m.transparent = true; m.opacity = 0.55; if (m.emissive) m.emissive.setHex(ok ? 0x0a4a1a : 0x5a1010); } else { m.transparent = m._g0.t; m.opacity = m._g0.o; if (m.emissive) m.emissive.setHex(m._g0.e); } });
  }
  return {
    group: group, footprint: { w: 13, d: 13 }, escala: 1, update: update, setGhost: setGhost, asiento: asiento,
    apuntar: function (ry, rp) { aimY = ry; aimP = rp; },
    disparar: function (on) { firing = !!on; },
    recargar: function () { if (!reloadState && ammo < 120) { reloadState = 1; rt = 0; } },
    municion: function () { return ammo; }, recargando: function () { return reloadState > 0; },
    vistaArtillero: function (on) { mirT.visible = !on; },
    elevacion: function () { return pitchA; },
    boca: function (pos, dir) {   // punta de los cañones (mundo) y hacia dónde disparan
      group.updateMatrixWorld(true); pitch.getWorldQuaternion(qa); dir.set(1, 0, 0).applyQuaternion(qa); pos.copy(pitch.localToWorld(vb.set(5.5, 0, 0))); return dir;
    },
    agarres: function (o) {   // posiciones del mundo: asiento, palancas, manivela de elevación, y hacia dónde mira la torreta
      group.updateMatrixWorld(true);
      o.sitio.copy(yaw.localToWorld(vb.set(-1.35, 1.02, 0))); o.izq.copy(levs[1].localToWorld(vb.set(0, 0.2, 0))); o.der.copy(levs[0].localToWorld(vb.set(0, 0.2, 0)));
      o.vol.copy(wheels[0].localToWorld(vb.set(0.26, 0.0, 0.1)));
      var q = new THREE.Quaternion(); yaw.getWorldQuaternion(q); var f = new THREE.Vector3(1, 0, 0).applyQuaternion(q); o.ang = Math.atan2(f.x, f.z);
      o.volR = wheels[0].rotation.z; return o;
    },
    setAccent: function () { }
  };
}
