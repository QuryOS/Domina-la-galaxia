/**
 * Forja: astillero orbital (estación espacial GRANDE) para Three.js, sin archivos externos.
 *
 * Una estación con un propósito: construir naves. En el centro hay un dique seco (marco de
 * celosías de 64 u) con un crucero a medio construir: proa ya forrada, popa en costillas
 * y larguerillos, interior con luces de trabajo y motores sin terminar.
 *
 *  - 2 grúas pórtico que recorren los rieles superiores moviendo planchas de casco.
 *  - 4 brazos robóticos de soldadura con chispas que se mueven alrededor del casco.
 *  - 3 remolcadores que patrullan el dique.
 *  - Bloque de habitación y mando (cilindro de 52 u con ~700 ventanas y torre de mando).
 *  - Bloque industrial: reactor con anillo de energía, 8 tanques de combustible, contenedores.
 *  - Espina de energía trasera con 4 alas solares y radiadores.
 *  - Concentrador delantero con 4 puertos de atraque y luces de guía.
 *  - Marcas de peligro, 12 focos de trabajo con haz de luz, antenas y balizas.
 *
 * Uso:
 *   const yard = createForja(THREE, { accent: 0xffc21a });
 *   scene.add(yard.group);
 *   // en tu bucle de juego (activity de 0 a 1: ritmo de grúas y soldadura):
 *   yard.update(clock.getElapsedTime(), activity);
 *
 * Convenciones: eje largo en Z (concentrador delantero hacia -Z), arriba +Y.
 * Escala: 1 unidad = 10 m. Dique de 64 x 22 x 13 u; estación completa ~110 u (1,1 km) de largo.
 *
 * Expone:
 *   yard.ship        Group con el crucero en construcción (puedes ocultarlo o sustituirlo)
 *   yard.cranes      [Group x2]  grúas (position.z se anima)
 *   yard.tugs        [Group x3]  remolcadores
 *   yard.ports       [{ object, direction }] 4 puertos de atraque del concentrador delantero,
 *                    en este orden: +X, -X, +Y, -Y. direction apunta hacia fuera del puerto.
 *   yard.setAccent(hex)
 * Compatible con Three.js r128 o superior.
 */
function createForja(THREE, opts) {
  opts = opts || {};
  var P = Math.PI, TAU = P * 2;
  var colors = {
    hull: opts.hull != null ? opts.hull : 0xcfd5de,
    accent: opts.accent != null ? opts.accent : 0xffc21a,
    dark: opts.dark != null ? opts.dark : 0x151b27,
    glow: opts.glow != null ? opts.glow : 0x62d6ff
  };

  var group = new THREE.Group();

  /* ---------- Materiales ---------- */
  function hazardTexture() {
    if (typeof document === 'undefined') return null;
    try {
      var c = document.createElement('canvas');
      c.width = 32; c.height = 32;
      var g = c.getContext('2d');
      g.fillStyle = '#f2c200'; g.fillRect(0, 0, 32, 32);
      g.strokeStyle = '#15181f'; g.lineWidth = 10;
      [0, 32, 64].forEach(function (k) { g.beginPath(); g.moveTo(-8, k + 8); g.lineTo(k + 8, -8); g.stroke(); });
      var tex = new THREE.CanvasTexture(c);
      tex.wrapS = THREE.RepeatWrapping; tex.wrapT = THREE.RepeatWrapping;
      tex.repeat.set(1, 64);
      tex.anisotropy = 8;
      return tex;
    } catch (e) { return null; }
  }
  function solarTexture() {
    if (typeof document === 'undefined') return null;
    try {
      var cols = 4, rows = 3, cw = 64, ch = 64;
      var c = document.createElement('canvas');
      c.width = cols * cw; c.height = rows * ch;
      var g = c.getContext('2d');
      g.fillStyle = '#0d1f45'; g.fillRect(0, 0, c.width, c.height);
      for (var i = 0; i < cols; i++) {
        for (var j = 0; j < rows; j++) {
          var x = i * cw, y = j * ch;
          var grad = g.createLinearGradient(x, y, x + cw, y + ch);
          grad.addColorStop(0, '#1d3d7c'); grad.addColorStop(1, '#10285a');
          g.fillStyle = grad; g.fillRect(x + 3, y + 3, cw - 6, ch - 6);
          g.strokeStyle = 'rgba(150,190,255,0.35)'; g.lineWidth = 1;
          for (var k = 1; k < 4; k++) {
            g.beginPath(); g.moveTo(x + 3 + (cw - 6) * k / 4, y + 3); g.lineTo(x + 3 + (cw - 6) * k / 4, y + ch - 3); g.stroke();
          }
        }
      }
      g.strokeStyle = '#c9d4e4'; g.lineWidth = 3;
      for (var a = 0; a <= cols; a++) { g.beginPath(); g.moveTo(a * cw, 0); g.lineTo(a * cw, c.height); g.stroke(); }
      for (var b = 0; b <= rows; b++) { g.beginPath(); g.moveTo(0, b * ch); g.lineTo(c.width, b * ch); g.stroke(); }
      var tex = new THREE.CanvasTexture(c);
      tex.anisotropy = 8;
      return tex;
    } catch (e) { return null; }
  }
  var hazMap = hazardTexture(), solarMap = solarTexture();

  var mats = {
    hull: new THREE.MeshStandardMaterial({ color: colors.hull, metalness: 0.35, roughness: 0.42 }),
    shell: new THREE.MeshStandardMaterial({ color: 0x9aa5b5, metalness: 0.5, roughness: 0.42, side: THREE.DoubleSide }),
    steel: new THREE.MeshStandardMaterial({ color: 0x8892a2, metalness: 0.65, roughness: 0.45 }),
    plate: new THREE.MeshStandardMaterial({ color: 0x6d788a, metalness: 0.6, roughness: 0.5 }),
    accent: new THREE.MeshStandardMaterial({ color: colors.accent, metalness: 0.3, roughness: 0.45 }),
    dark: new THREE.MeshStandardMaterial({ color: colors.dark, metalness: 0.7, roughness: 0.5, side: THREE.DoubleSide }),
    hazard: new THREE.MeshStandardMaterial({ color: hazMap ? 0xffffff : 0xf2c200, map: hazMap || null, metalness: 0.2, roughness: 0.6 }),
    glass: new THREE.MeshStandardMaterial({
      color: 0x0b1d33, metalness: 0.9, roughness: 0.05,
      emissive: 0x0a3a5c, emissiveIntensity: 0.9, side: THREE.DoubleSide
    }),
    solar: new THREE.MeshStandardMaterial({
      color: solarMap ? 0xffffff : 0x1c3d73, map: solarMap || null, metalness: 0.55, roughness: 0.3
    }),
    window: new THREE.MeshBasicMaterial({ color: 0xffe3a0 }),
    lamp: new THREE.MeshBasicMaterial({ color: 0xffe9b8 }),
    work: new THREE.MeshBasicMaterial({ color: 0xdff4ff })
  };
  var crateMats = [
    mats.accent,
    new THREE.MeshStandardMaterial({ color: 0x41536f, metalness: 0.3, roughness: 0.5 }),
    new THREE.MeshStandardMaterial({ color: 0xc9d1dc, metalness: 0.3, roughness: 0.5 }),
    new THREE.MeshStandardMaterial({ color: 0x5d7f68, metalness: 0.3, roughness: 0.5 }),
    new THREE.MeshStandardMaterial({ color: 0x9a4a42, metalness: 0.3, roughness: 0.5 })
  ];

  function glowMat(color, opacity) {
    return new THREE.MeshBasicMaterial({
      color: color, transparent: true, opacity: opacity,
      blending: THREE.AdditiveBlending, depthWrite: false
    });
  }
  function add(parent, geo, mat, x, y, z) {
    var m = new THREE.Mesh(geo, mat);
    m.position.set(x || 0, y || 0, z || 0);
    parent.add(m);
    return m;
  }
  var seed = 71;
  function rnd() {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  }

  /* ---------- Herramientas geométricas ---------- */
  function norm(v) {
    var l = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]) || 1;
    return [v[0] / l, v[1] / l, v[2] / l];
  }
  function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
  function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
  function sub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
  var UP = new THREE.Vector3(0, 1, 0);

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

  // Cápsula con el eje en Z.
  function capsule(r, len, seg) {
    var pts = [], n = 10, i, a;
    for (i = 0; i <= n; i++) {
      a = -P / 2 + (P / 2) * i / n;
      pts.push(new THREE.Vector2(Math.max(0, r * Math.cos(a)), -len / 2 + r * Math.sin(a)));
    }
    for (i = 0; i <= n; i++) {
      a = (P / 2) * i / n;
      pts.push(new THREE.Vector2(Math.max(0, r * Math.cos(a)), len / 2 + r * Math.sin(a)));
    }
    var g = new THREE.LatheGeometry(pts, seg);
    g.rotateX(P / 2);
    return g;
  }

  function horizontalTorus(R, tube, ts, rs) {
    var g = new THREE.TorusGeometry(R, tube, ts, rs);
    g.rotateX(P / 2);
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

  var strutGeo = new THREE.CylinderGeometry(1, 1, 1, 8);
  function strutField(list, mat) {
    var mesh = new THREE.InstancedMesh(strutGeo, mat, list.length);
    var o = new THREE.Object3D(), dir = new THREE.Vector3();
    for (var i = 0; i < list.length; i++) {
      var s = list[i];
      var dx = s[3] - s[0], dy = s[4] - s[1], dz = s[5] - s[2];
      var L = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1e-6;
      dir.set(dx / L, dy / L, dz / L);
      o.position.set((s[0] + s[3]) / 2, (s[1] + s[4]) / 2, (s[2] + s[5]) / 2);
      o.quaternion.setFromUnitVectors(UP, dir);
      o.scale.set(s[6], L, s[6]);
      o.updateMatrix();
      mesh.setMatrixAt(i, o.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
    mesh.frustumCulled = false;
    return mesh;
  }

  // Celosía cuadrada entre a y b.
  function truss(list, a, b, w, segs, r) {
    var ax = sub(b, a), L = Math.sqrt(dot(ax, ax)), n = [ax[0] / L, ax[1] / L, ax[2] / L];
    var h = Math.abs(n[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
    var u = norm(cross(n, h)), v = cross(n, u);
    var offs = [[1, 1], [-1, 1], [-1, -1], [1, -1]].map(function (q) {
      return [(u[0] * q[0] + v[0] * q[1]) * w / 2, (u[1] * q[0] + v[1] * q[1]) * w / 2, (u[2] * q[0] + v[2] * q[1]) * w / 2];
    });
    function pt(s, c) {
      var t = L * s / segs;
      return [a[0] + n[0] * t + offs[c][0], a[1] + n[1] * t + offs[c][1], a[2] + n[2] * t + offs[c][2]];
    }
    var c, s;
    for (c = 0; c < 4; c++) { var p0 = pt(0, c), p1 = pt(segs, c); list.push([p0[0], p0[1], p0[2], p1[0], p1[1], p1[2], r]); }
    for (s = 0; s <= segs; s++) {
      for (c = 0; c < 4; c++) { var q0 = pt(s, c), q1 = pt(s, (c + 1) % 4); list.push([q0[0], q0[1], q0[2], q1[0], q1[1], q1[2], r * 0.7]); }
    }
    for (s = 0; s < segs; s++) {
      for (c = 0; c < 4; c++) {
        var d0 = (s + c) % 2 === 0 ? pt(s, c) : pt(s + 1, c);
        var d1 = (s + c) % 2 === 0 ? pt(s + 1, (c + 1) % 4) : pt(s, (c + 1) % 4);
        list.push([d0[0], d0[1], d0[2], d1[0], d1[1], d1[2], r * 0.6]);
      }
    }
  }

  function dishMesh(parent, r, x, y, z, tilt) {
    var pivot = new THREE.Group();
    pivot.position.set(x, y, z);
    var d = add(pivot, new THREE.SphereGeometry(r, 28, 12, 0, TAU, 0, P / 2), mats.hull, 0, 0.05, 0);
    d.rotation.x = P;
    d.material = mats.hull.clone();
    d.material.side = THREE.DoubleSide;
    add(pivot, new THREE.CylinderGeometry(r * 0.08, r * 0.12, r * 0.5, 10), mats.dark, 0, -r * 0.1, 0);
    pivot.rotation.z = tilt || 0;
    parent.add(pivot);
    return pivot;
  }

  /* ================= DIQUE SECO: marco de celosías ================= */
  var BX = 11, BY = 6.5, ZL = 32;
  var frame = [];
  [[1, 1], [-1, 1], [-1, -1], [1, -1]].forEach(function (q) {
    truss(frame, [q[0] * BX, q[1] * BY, -ZL], [q[0] * BX, q[1] * BY, ZL], 1.6, 32, 0.11);
  });
  var ringZ = [-30, -18, -6, 6, 18, 30];
  ringZ.forEach(function (z) {
    truss(frame, [-BX, BY, z], [BX, BY, z], 1.2, 11, 0.08);
    truss(frame, [-BX, -BY, z], [BX, -BY, z], 1.2, 11, 0.08);
    truss(frame, [BX, -BY, z], [BX, BY, z], 1.2, 6, 0.08);
    truss(frame, [-BX, -BY, z], [-BX, BY, z], 1.2, 6, 0.08);
  });
  group.add(strutField(frame, mats.steel));

  // Esquinas reforzadas en los anillos
  var cornerGeo = roundedBox(1.9, 1.9, 1.5, 0.4, 6);
  ringZ.forEach(function (z) {
    [[1, 1], [-1, 1], [-1, -1], [1, -1]].forEach(function (q) {
      add(group, cornerGeo, mats.plate, q[0] * BX, q[1] * BY, z);
    });
  });

  // Rieles superiores y bordes del piso con marcas de peligro
  [1, -1].forEach(function (s) {
    add(group, new THREE.BoxGeometry(0.5, 0.2, 64), mats.dark, s * BX, BY + 0.9, 0);
    var haz = add(group, new THREE.BoxGeometry(0.9, 0.16, 64), mats.hazard, s * 9.2, -BY - 0.2, 0);
    add(group, new THREE.BoxGeometry(0.3, 0.3, 64), mats.accent, s * 7.9, -BY - 0.2, 0);
  });
  // Piso del dique: vigas longitudinales y durmientes
  var sleepers = [];
  for (var sz = -30; sz <= 30; sz += 3) sleepers.push({ x: 0, y: -BY - 0.2, z: sz });
  group.add(boxField(roundedBox(14, 0.3, 0.6, 0.1, 4), mats.plate, sleepers));

  /* ================= CRUCERO EN CONSTRUCCIÓN ================= */
  var ship = new THREE.Group();
  group.add(ship);
  var SX = 1.3, SY = 0.85;
  var RZ = [[-22.6, 0], [-22.2, 0.3], [-21, 0.9], [-18, 1.9], [-12, 2.8], [-6, 3.1], [-2, 3.0], [14, 3.0], [24, 2.4]];
  function hullR(z) {
    for (var i = 1; i < RZ.length; i++) {
      if (z <= RZ[i][0]) {
        var a = RZ[i - 1], b = RZ[i];
        return a[1] + (b[1] - a[1]) * (z - a[0]) / (b[0] - a[0]);
      }
    }
    return RZ[RZ.length - 1][1];
  }

  // Proa forrada: lámina de revolución abierta por detrás (se ve el interior)
  var fwd = [[3.0, 2], [3.1, 6], [2.8, 12], [1.9, 18], [0.9, 21], [0.3, 22.2], [0.001, 22.6]]
    .map(function (p) { return new THREE.Vector2(p[0], p[1]); });
  var fwdPts = new THREE.SplineCurve(fwd).getPoints(80).map(function (p) {
    return new THREE.Vector2(Math.max(0.001, p.x), p.y);
  });
  var bowGeo = new THREE.LatheGeometry(fwdPts, 56);
  bowGeo.rotateX(-P / 2);
  add(ship, bowGeo, mats.shell).scale.set(SX, SY, 1);

  // Costuras de planchas y franja de acento
  [-6, -10.5, -15, -19].forEach(function (z) {
    var seam = add(ship, new THREE.TorusGeometry(hullR(z) + 0.02, 0.045, 6, 48), mats.dark, 0, 0, z);
    seam.scale.set(SX, SY, 1);
  });
  var stripeList = [];
  for (var stz = -17; stz <= -4; stz += 1.0) {
    var shr = hullR(stz);
    [1, -1].forEach(function (s) {
      stripeList.push({ x: s * (shr * SX * Math.cos(0.2) + 0.02), y: shr * SY * Math.sin(0.2), z: stz });
    });
  }
  ship.add(boxField(new THREE.BoxGeometry(0.1, 0.12, 1.05), mats.accent, stripeList));
  // Ventanas de mando ya instaladas y torretas de cubierta
  var bridgeWin = [];
  for (var bw = 0; bw < 8; bw++) bridgeWin.push({ x: -1.6 + bw * 0.45, y: 1.95, z: -14.8 });
  add(ship, new THREE.BoxGeometry(3.9, 0.22, 0.05), mats.glass, 0, 2.0, -15.4).rotation.x = -0.9;
  var hemi = new THREE.SphereGeometry(1, 20, 10, 0, TAU, 0, P / 2);
  [[-1.2, -8], [1.2, -8], [0, -11.5], [0, -4]].forEach(function (p) {
    var hr = hullR(p[1]);
    var ty = hr * SY * Math.sqrt(1 - Math.pow(p[0] / (hr * SX), 2)) - 0.03;
    add(ship, hemi, mats.hull, p[0], ty, p[1]).scale.set(0.55, 0.3, 0.55);
  });

  // Popa en construcción: costillas, larguerillos, cubiertas y luces de trabajo
  var ribGeo = new THREE.TorusGeometry(1, 0.03, 6, 40);
  for (var rz = -1; rz <= 23.5; rz += 1.75) {
    var rib = add(ship, ribGeo, ((rz + 1) / 1.75) % 4 < 0.5 ? mats.accent : mats.steel, 0, 0, rz);
    rib.scale.set(hullR(rz) * SX, hullR(rz) * SY, 1);
  }
  var stringers = [];
  for (var sa = 0; sa < 14; sa++) {
    var ang = sa * TAU / 14;
    var ca = Math.cos(ang) * SX, sa2 = Math.sin(ang) * SY;
    stringers.push([ca * 3.0, sa2 * 3.0, -2, ca * 3.0, sa2 * 3.0, 14, 0.07]);
    stringers.push([ca * 3.0, sa2 * 3.0, 14, ca * 2.4, sa2 * 2.4, 24, 0.07]);
  }
  ship.add(strutField(stringers, mats.steel));
  [-0.9, 0.9].forEach(function (y) {
    add(ship, roundedBox(5.4, 0.14, 21, 0.05, 4), mats.plate, 0, y, 9);
  });
  var workLights = [];
  for (var wl = 0; wl < 12; wl++) {
    workLights.push({ x: -2.0, y: 0.2, z: -0.5 + wl * 2.0 }, { x: 2.0, y: 0.2, z: -0.5 + wl * 2.0 });
  }
  ship.add(boxField(new THREE.BoxGeometry(0.1, 0.1, 0.8), mats.work, workLights));
  // Planchas ya soldadas a las costillas
  for (var pl = 0; pl < 16; pl++) {
    var pz = 0 + rnd() * 21, pa = rnd() * TAU;
    var rr = hullR(pz) + 0.05;
    var plate = add(ship, roundedBox(1.6, 0.08, 1.4, 0.03, 3), mats.shell,
      Math.cos(pa) * rr * SX, Math.sin(pa) * rr * SY, pz);
    plate.rotation.z = pa + P / 2;
  }
  // Motores sin terminar
  add(ship, roundedBox(7.4, 2.6, 1.8, 0.55, 12), mats.hull, 0, 0, 24.4);
  var bellPts = [[0.2, 0], [0.22, 0.1], [0.27, 0.25], [0.35, 0.45], [0.45, 0.65], [0.52, 0.75]]
    .map(function (p) { return new THREE.Vector2(p[0], p[1]); });
  var bellGeo = new THREE.LatheGeometry(bellPts, 36);
  bellGeo.rotateX(P / 2);
  [[0, 0, 1.2], [-2.4, 0, 1.2], [2.4, 0, 1.2], [-1.2, 0, 0.7], [1.2, 0, 0.7]].forEach(function (e) {
    add(ship, bellGeo, mats.dark, e[0], e[1], 25.3).scale.set(e[2], e[2], e[2]);
    add(ship, new THREE.TorusGeometry(0.5 * e[2], 0.05 * e[2], 8, 28), mats.accent, e[0], e[1], 25.25);
  });
  // Bloques de quilla y apoyos
  var keel = [];
  for (var kz = -20; kz <= 22; kz += 4) keel.push({ x: 0, y: -3.5, z: kz });
  ship.add(boxField(roundedBox(1.6, 1.0, 2.2, 0.25, 6), mats.plate, keel));
  var props = [];
  keel.forEach(function (k) {
    props.push([-1.2, k.y - 0.5, k.z, -1.2, -BY - 0.1, k.z, 0.08]);
    props.push([1.2, k.y - 0.5, k.z, 1.2, -BY - 0.1, k.z, 0.08]);
  });
  ship.add(strutField(props, mats.steel));

  /* ================= GRÚAS PÓRTICO ================= */
  var cranes = [], craneParts = [];
  function buildCrane(phase, plateMat) {
    var cr = new THREE.Group();
    var cs = [];
    truss(cs, [-BX, 8.6, 0], [BX, 8.6, 0], 1.4, 11, 0.09);
    cr.add(strutField(cs, mats.steel));
    [1, -1].forEach(function (s) {
      add(cr, roundedBox(2.0, 1.1, 2.6, 0.3, 6), mats.accent, s * BX, 7.9, 0);
      add(cr, new THREE.BoxGeometry(0.5, 1.2, 0.5), mats.plate, s * BX, 8.3, 0);
      [0.9, -0.9].forEach(function (z) {
        var w = add(cr, new THREE.CylinderGeometry(0.3, 0.3, 0.25, 16), mats.dark, s * BX, 7.35, z);
        w.rotation.z = P / 2;
      });
    });
    var trolley = new THREE.Group();
    trolley.position.y = 9.6;
    add(trolley, roundedBox(2.4, 0.9, 1.9, 0.3, 6), mats.hull, 0, 0, 0);
    add(trolley, new THREE.BoxGeometry(2.0, 0.08, 1.6), mats.accent, 0, 0.48, 0);
    add(trolley, new THREE.CylinderGeometry(0.4, 0.4, 0.5, 16), mats.dark, 0, -0.65, 0);
    var cable = add(trolley, new THREE.CylinderGeometry(0.05, 0.05, 1, 8), mats.dark, 0, -3, 0);
    var hook = new THREE.Group();
    add(hook, roundedBox(1.2, 0.8, 1.2, 0.25, 6), mats.accent, 0, 0, 0);
    [[1, 1], [-1, 1], [-1, -1], [1, -1]].forEach(function (q) {
      var sl = add(hook, new THREE.CylinderGeometry(0.03, 0.03, 2.6, 6), mats.dark, q[0] * 0.9, -1.5, q[1] * 0.65);
      sl.rotation.z = -q[0] * 0.35; sl.rotation.x = q[1] * 0.25;
    });
    add(hook, roundedBox(4.6, 0.25, 3.2, 0.1, 6), plateMat, 0, -2.9, 0);
    trolley.add(hook);
    cr.add(trolley);
    group.add(cr);
    cranes.push(cr);
    craneParts.push({ trolley: trolley, cable: cable, hook: hook, phase: phase });
  }
  buildCrane(0, mats.shell);
  buildCrane(2.4, mats.plate);

  /* ================= BRAZOS DE SOLDADURA ================= */
  var armGeoA = capsule(0.28, 2.8, 16);
  armGeoA.rotateY(P / 2);   // eje en X
  var armGeoB = capsule(0.22, 2.6, 16);
  armGeoB.rotateY(P / 2);
  var arms = [];
  var sparkMat = new THREE.MeshBasicMaterial({ color: 0xdff4ff });
  var haloMat = glowMat(0x8fd0ff, 0.5);
  [[1, -16], [-1, -6], [1, 8], [-1, 18]].forEach(function (a, i) {
    var side = a[0], z = a[1];
    var base = new THREE.Group();
    base.position.set(side * (BX - 0.9), 0.5, z);
    base.rotation.y = side > 0 ? P : 0;
    add(base, roundedBox(1.2, 1.4, 1.2, 0.3, 6), mats.hull, -0.3, 0, 0);
    add(base, new THREE.CylinderGeometry(0.5, 0.5, 0.35, 20), mats.accent, 0.3, 0, 0).rotation.x = 0;
    var yaw = new THREE.Group();
    yaw.position.set(0.5, 0, 0);
    base.add(yaw);
    var shoulder = new THREE.Group();
    yaw.add(shoulder);
    add(shoulder, new THREE.SphereGeometry(0.38, 16, 12), mats.dark, 0, 0, 0);
    add(shoulder, armGeoA, mats.hull, 1.5, 0, 0);
    var elbow = new THREE.Group();
    elbow.position.x = 3.0;
    shoulder.add(elbow);
    add(elbow, new THREE.SphereGeometry(0.3, 14, 10), mats.dark, 0, 0, 0);
    add(elbow, armGeoB, mats.hull, 1.4, 0, 0);
    add(elbow, new THREE.CylinderGeometry(0.06, 0.12, 0.7, 10), mats.dark, 2.95, 0, 0).rotation.z = P / 2;
    add(elbow, new THREE.SphereGeometry(0.09, 10, 8), sparkMat, 3.35, 0, 0);
    var halo = add(elbow, new THREE.SphereGeometry(0.4, 12, 10), haloMat, 3.4, 0, 0);
    group.add(base);
    arms.push({ yaw: yaw, shoulder: shoulder, elbow: elbow, halo: halo, phase: i * 1.7 });
  });

  /* ================= REMOLCADORES ================= */
  var tugs = [], tugLights = [];
  var tugBody = roundedBox(0.9, 0.7, 1.5, 0.22, 6);
  [[8.6, 0, 20, 0.11], [-8.6, 2.1, 17, 0.09], [8.6, 4.2, 14, 0.13]].forEach(function (c, i) {
    var tg = new THREE.Group();
    add(tg, tugBody, mats.hull, 0, 0, 0);
    add(tg, new THREE.BoxGeometry(0.92, 0.1, 0.6), mats.accent, 0, 0.3, 0.1);
    add(tg, new THREE.BoxGeometry(0.5, 0.2, 0.04), mats.glass, 0, 0.1, -0.76);
    [-0.3, 0.3].forEach(function (x) {
      add(tg, new THREE.CylinderGeometry(0.12, 0.16, 0.3, 12), mats.dark, x, 0, 0.82).rotation.x = P / 2;
      add(tg, new THREE.CircleGeometry(0.1, 12), glowMat(0x9fd8ff, 0.9), x, 0, 0.98);
    });
    [-0.7, 0.7].forEach(function (x) {
      add(tg, new THREE.BoxGeometry(0.5, 0.05, 0.3), mats.dark, x, 0, 0.1);
    });
    var lm = new THREE.MeshBasicMaterial({ color: 0xffb347 });
    add(tg, new THREE.SphereGeometry(0.07, 8, 6), lm, 0, 0.42, 0.4);
    tugLights.push(lm);
    group.add(tg);
    tugs.push({ obj: tg, x: c[0], phase: c[1], amp: c[2], speed: c[3] });
  });

  /* ================= FOCOS DE TRABAJO ================= */
  var beamGeo = new THREE.ConeGeometry(1.7, 9, 16, 1, true);
  beamGeo.translate(0, -4.5, 0);
  var beamMat = glowMat(0xffefc8, 0.06);
  var lampPositions = [];
  for (var lz = -26; lz <= 26; lz += 10) {
    [1, -1].forEach(function (s) { lampPositions.push([s * 10.2, 5.7, lz, s]); });
  }
  lampPositions.forEach(function (lp) {
    var lamp = new THREE.Group();
    lamp.position.set(lp[0], lp[1], lp[2]);
    lamp.rotation.z = lp[3] * 0.55;
    add(lamp, roundedBox(0.9, 0.28, 0.6, 0.1, 4), mats.hull, 0, 0, 0);
    add(lamp, new THREE.BoxGeometry(0.75, 0.03, 0.45), mats.lamp, 0, -0.15, 0);
    add(lamp, beamGeo, beamMat, 0, -0.16, 0);
    group.add(lamp);
  });

  /* ================= BLOQUE DE HABITACIÓN Y MANDO (x +) ================= */
  var HX = 17;
  var hab = new THREE.Group();
  hab.position.x = HX;
  group.add(hab);
  var habCyl = add(hab, new THREE.CylinderGeometry(3.2, 3.2, 50, 56), mats.hull, 0, 0, 0);
  habCyl.rotation.x = P / 2;
  [1, -1].forEach(function (s) {
    var dome = add(hab, new THREE.SphereGeometry(3.2, 40, 20, 0, TAU, 0, P / 2), mats.hull, 0, 0, s * 25);
    dome.rotation.x = s * P / 2;
    add(hab, new THREE.TorusGeometry(3.22, 0.1, 10, 56), mats.accent, 0, 0, s * 24.9);
  });
  for (var hz = -20; hz <= 20; hz += 5) {
    add(hab, new THREE.TorusGeometry(3.24, 0.09, 8, 56), mats.steel, 0, 0, hz);
  }
  add(hab, new THREE.TorusGeometry(3.26, 0.14, 10, 56), mats.accent, 0, 0, -20);
  add(hab, new THREE.TorusGeometry(3.26, 0.14, 10, 56), mats.accent, 0, 0, 20);
  // Ventanas alrededor del cilindro
  var habWin = [];
  for (var wz = -23; wz <= 23; wz += 0.9) {
    for (var wa = 0; wa < 18; wa++) {
      if (wz > -21 && wz < -19.5) continue;
      if (rnd() > 0.78) continue;
      var an = wa * TAU / 18 + 0.1;
      habWin.push({ x: 3.23 * Math.cos(an), y: 3.23 * Math.sin(an), z: wz, ry: 0, an: an });
    }
  }
  // Las ventanas de un cilindro necesitan girar sobre Z; se crean con su propia matriz.
  (function () {
    var m = new THREE.InstancedMesh(new THREE.BoxGeometry(0.34, 0.05, 0.14), mats.window, habWin.length);
    var o = new THREE.Object3D();
    for (var i = 0; i < habWin.length; i++) {
      o.position.set(habWin[i].x, habWin[i].y, habWin[i].z);
      o.rotation.z = habWin[i].an - P / 2;
      o.scale.set(1, 1, 1);
      o.updateMatrix();
      m.setMatrixAt(i, o.matrix);
    }
    m.instanceMatrix.needsUpdate = true;
    m.frustumCulled = false;
    hab.add(m);
  })();
  // Cúpula de observación en el extremo
  add(hab, new THREE.SphereGeometry(1.2, 28, 14, 0, TAU, 0, P / 2), mats.glass, 0, 0, 28.2).rotation.x = P / 2;
  add(hab, new THREE.CylinderGeometry(0.9, 1.1, 3.2, 20), mats.steel, 0, 0, 26.6).rotation.x = P / 2;

  // Torre de mando
  var tw = new THREE.Group();
  tw.position.set(0, 3.2, -14);
  hab.add(tw);
  add(tw, roundedBox(4.2, 1.5, 6.0, 0.5, 10), mats.hull, 0, 0.7, 0);
  add(tw, roundedBox(3.0, 1.5, 4.0, 0.45, 10), mats.hull, 0, 2.2, 0.3);
  add(tw, roundedBox(4.6, 1.0, 3.0, 0.4, 10), mats.hull, 0, 3.45, -0.2);
  add(tw, new THREE.BoxGeometry(4.4, 0.28, 0.04), mats.glass, 0, 3.5, -1.72);
  [1, -1].forEach(function (s) {
    add(tw, new THREE.BoxGeometry(0.04, 0.24, 2.4), mats.glass, 2.32 * s, 3.5, -0.2);
    add(tw, new THREE.BoxGeometry(0.05, 0.12, 5.6), mats.accent, 2.12 * s, 0.9, 0);
  });
  add(tw, new THREE.SphereGeometry(0.8, 28, 14), mats.glass, 0, 4.0, 0).scale.set(1, 0.6, 1);
  add(tw, new THREE.CylinderGeometry(0.05, 0.08, 4.0, 10), mats.dark, 0.5, 6.0, 0.5);
  [[1.6, 6.2], [1.2, 6.9], [0.8, 7.5]].forEach(function (c) {
    add(tw, new THREE.BoxGeometry(c[0], 0.04, 0.06), mats.dark, 0.5, c[1], 0.5);
  });
  var towerBeacon = new THREE.MeshBasicMaterial({ color: 0xffffff });
  add(tw, new THREE.SphereGeometry(0.1, 10, 8), towerBeacon, 0.5, 8.05, 0.5);
  var radar = new THREE.Group();
  radar.position.set(-0.6, 4.5, 0.6);
  add(radar, roundedBox(2.4, 0.08, 0.24, 0.04, 4), mats.plate, 0, 0, 0);
  add(radar, new THREE.CylinderGeometry(0.08, 0.1, 0.4, 10), mats.dark, 0, -0.2, 0);
  tw.add(radar);
  var dish1 = dishMesh(tw, 0.6, 1.5, 4.0, 1.2, -0.4);
  var dish2 = dishMesh(tw, 0.45, -1.6, 4.0, 1.4, 0.45);
  var towWin = [];
  for (var tz = -2.4; tz <= 2.4; tz += 0.5) {
    [1, -1].forEach(function (s) {
      [0.55, 0.95].forEach(function (y) { if (rnd() < 0.85) towWin.push({ x: 2.13 * s, y: y, z: tz, ry: P / 2 }); });
    });
  }
  tw.add(boxField(new THREE.BoxGeometry(0.05, 0.1, 0.22), mats.window, towWin));

  // Conectores con el dique
  var conn = [];
  [-24, 0, 24].forEach(function (z) {
    truss(conn, [BX + 0.8, 0, z], [HX - 3.0, 0, z], 0.9, 4, 0.06);
    truss(conn, [BX + 0.8, 3, z], [HX - 2.4, 1.8, z], 0.7, 4, 0.05);
    truss(conn, [BX + 0.8, -3, z], [HX - 2.4, -1.8, z], 0.7, 4, 0.05);
    truss(conn, [-BX - 0.8, 0, z], [-HX + 3.0, 0, z], 0.9, 4, 0.06);
  });
  group.add(strutField(conn, mats.steel));

  /* ================= BLOQUE INDUSTRIAL (x -) ================= */
  var IX = -17;
  var ind = new THREE.Group();
  ind.position.x = IX;
  group.add(ind);
  // Reactor
  var reactor = add(ind, new THREE.SphereGeometry(3.2, 44, 28), mats.hull, 0, 0, -14);
  var reactorRing = new THREE.MeshBasicMaterial({ color: 0x66ccff });
  add(ind, horizontalTorus(3.45, 0.25, 12, 64), reactorRing, 0, 0, -14);
  add(ind, new THREE.TorusGeometry(3.3, 0.12, 10, 56), mats.accent, 0, 0, -14);
  add(ind, new THREE.TorusGeometry(3.3, 0.12, 10, 56), mats.accent, 0, 0, -14).rotation.y = P / 2;
  var reactorStruts = [];
  [[1, 1], [-1, 1], [-1, -1], [1, -1]].forEach(function (q) {
    reactorStruts.push([q[0] * 2.0, q[1] * 2.0, -17.5, q[0] * 1.2, q[1] * 1.2, -21.5, 0.12]);
    reactorStruts.push([q[0] * 2.0, q[1] * 2.0, -10.5, q[0] * 1.2, q[1] * 1.2, -6.5, 0.12]);
  });
  ind.add(strutField(reactorStruts, mats.steel));
  add(ind, new THREE.CylinderGeometry(1.0, 1.0, 1.0, 24), mats.steel, 0, 0, -22).rotation.x = P / 2;
  // Tanques de combustible
  var tankGeo = capsule(1.2, 9.2, 28);
  var tankBand = new THREE.TorusGeometry(1.22, 0.07, 8, 28);
  [[-1.9, 1.9], [1.9, 1.9], [-1.9, -1.9], [1.9, -1.9]].forEach(function (c, ci) {
    [9, 23].forEach(function (z) {
      add(ind, tankGeo, mats.hull, c[0], c[1], z);
      [z - 3.2, z, z + 3.2].forEach(function (bz) {
        add(ind, tankBand, mats.accent, c[0], c[1], bz);
      });
    });
  });
  var rack = [];
  [9, 23].forEach(function (z) {
    truss(rack, [-3.6, 3.6, z - 3.2], [3.6, 3.6, z - 3.2], 0.5, 6, 0.05);
    truss(rack, [-3.6, -3.6, z - 3.2], [3.6, -3.6, z - 3.2], 0.5, 6, 0.05);
    truss(rack, [-3.6, 3.6, z + 3.2], [3.6, 3.6, z + 3.2], 0.5, 6, 0.05);
    truss(rack, [-3.6, -3.6, z + 3.2], [3.6, -3.6, z + 3.2], 0.5, 6, 0.05);
  });
  truss(rack, [3.6, 3.6, 5.8], [3.6, 3.6, 26.2], 0.5, 14, 0.05);
  truss(rack, [-3.6, 3.6, 5.8], [-3.6, 3.6, 26.2], 0.5, 14, 0.05);
  truss(rack, [3.6, -3.6, 5.8], [3.6, -3.6, 26.2], 0.5, 14, 0.05);
  truss(rack, [-3.6, -3.6, 5.8], [-3.6, -3.6, 26.2], 0.5, 14, 0.05);
  ind.add(strutField(rack, mats.steel));
  // Contenedores almacenados
  var crateLists = [[], [], [], [], []];
  var crateGeo = roundedBox(1.6, 1.6, 3.2, 0.25, 6);
  for (var cx = 0; cx < 2; cx++) {
    for (var cy = 0; cy < 3; cy++) {
      for (var cz = 0; cz < 2; cz++) {
        if (rnd() > 0.88) continue;
        crateLists[Math.floor(rnd() * 5)].push({ x: -0.9 + cx * 1.75, y: -1.75 + cy * 1.75, z: -31 + cz * 3.4 });
      }
    }
  }
  crateLists.forEach(function (lst, i) {
    if (lst.length) ind.add(boxField(crateGeo, crateMats[i], lst));
  });
  // Conducto entre reactor y tanques
  var duct = add(ind, new THREE.CylinderGeometry(0.5, 0.5, 17, 16), mats.steel, 0, 0, -5);
  duct.rotation.x = P / 2;
  [-10.5, -7, -3.5, 0].forEach(function (z) { add(ind, new THREE.TorusGeometry(0.55, 0.07, 8, 20), mats.accent, 0, 0, z); });

  /* ================= CONCENTRADOR DELANTERO ================= */
  var fwdGroup = new THREE.Group();
  group.add(fwdGroup);
  var fs = [];
  truss(fs, [0, 0, -ZL], [0, 0, -44], 2.0, 6, 0.1);
  fwdGroup.add(strutField(fs, mats.steel));
  add(fwdGroup, new THREE.SphereGeometry(2.6, 40, 24), mats.hull, 0, 0, -46);
  add(fwdGroup, new THREE.TorusGeometry(2.62, 0.12, 10, 48), mats.accent, 0, 0, -46);
  add(fwdGroup, horizontalTorus(2.62, 0.12, 10, 48), mats.accent, 0, 0, -46);
  var noseGeo = new THREE.LatheGeometry([[0.001, 0], [0.9, 0.1], [0.8, 1.2], [0.5, 2.4], [0.2, 3.4], [0.001, 3.8]]
    .map(function (p) { return new THREE.Vector2(p[0], p[1]); }), 24);
  noseGeo.rotateX(-P / 2);
  add(fwdGroup, noseGeo, mats.hull, 0, 0, -48.2);
  add(fwdGroup, new THREE.CylinderGeometry(0.03, 0.05, 2.0, 8), mats.dark, 0, 0, -53).rotation.x = P / 2;
  var noseBeacon = new THREE.MeshBasicMaterial({ color: 0xff4d4d });
  add(fwdGroup, new THREE.SphereGeometry(0.12, 10, 8), noseBeacon, 0, 0, -54.1);

  var ports = [], portGuides = [];
  var dirs = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0]];
  dirs.forEach(function (d, i) {
    var arm = new THREE.Group();
    arm.position.set(0, 0, -46);
    arm.quaternion.setFromUnitVectors(UP, new THREE.Vector3(d[0], d[1], d[2]));
    add(arm, new THREE.CylinderGeometry(0.55, 0.7, 6.0, 24), mats.steel, 0, 4.5, 0);
    [3.4, 5.0].forEach(function (y) { add(arm, horizontalTorus(0.72, 0.07, 8, 28), mats.accent, 0, y, 0); });
    add(arm, horizontalTorus(1.5, 0.2, 12, 48), mats.accent, 0, 7.7, 0);
    add(arm, horizontalTorus(1.25, 0.05, 8, 48), mats.steel, 0, 7.7, 0);
    var lamps = [];
    for (var li = 0; li < 12; li++) {
      var la = li * TAU / 12;
      lamps.push({ x: 1.5 * Math.cos(la), y: 7.92, z: 1.5 * Math.sin(la) });
    }
    arm.add(boxField(new THREE.SphereGeometry(0.07, 8, 6), mats.lamp, lamps));
    var gm = [];
    [9.6, 11.4, 13.2].forEach(function (y) {
      var m = new THREE.MeshBasicMaterial({ color: 0xffd08a });
      add(arm, new THREE.SphereGeometry(0.12, 10, 8), m, 0, y, 0);
      gm.push(m);
    });
    portGuides.push(gm);
    var port = new THREE.Object3D();
    port.position.set(0, 8.0, 0);
    arm.add(port);
    fwdGroup.add(arm);
    ports.push({ object: port, direction: new THREE.Vector3(d[0], d[1], d[2]) });
  });

  /* ================= ESPINA DE ENERGÍA TRASERA ================= */
  var spine = new THREE.Group();
  group.add(spine);
  var ss = [];
  truss(ss, [0, 0, ZL], [0, 0, 56], 2.2, 12, 0.11);
  spine.add(strutField(ss, mats.steel));
  add(spine, roundedBox(3.0, 3.0, 3.4, 0.7, 10), mats.hull, 0, 0, 57);
  add(spine, new THREE.BoxGeometry(2.4, 0.1, 2.0), mats.accent, 0, 1.5, 57);
  var panelGeo = roundedBox(4.2, 5.5, 0.07, 0.03, 6);
  var boomGeo = new THREE.CylinderGeometry(0.12, 0.12, 19, 12);
  var wings = [];
  [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (d, i) {
    var arm = new THREE.Group();
    arm.position.set(0, 0, 57);
    arm.rotation.z = Math.atan2(-d[0], d[1]);   // el eje local +Y apunta hacia d
    add(arm, boomGeo, mats.steel, 0, 10.5, 0);
    var piv = new THREE.Group();   // gira sobre el eje del brazo para seguir al sol
    arm.add(piv);
    for (var k = 0; k < 3; k++) {
      add(piv, panelGeo, mats.solar, 0, 4.2 + k * 5.7, 0);
    }
    add(piv, new THREE.SphereGeometry(0.18, 12, 10), mats.accent, 0, 20.2, 0);
    spine.add(arm);
    wings.push({ pivot: piv, phase: i * 0.9 });
  });
  // Radiadores
  [1, -1].forEach(function (s) {
    for (var r = 0; r < 3; r++) {
      add(spine, roundedBox(0.09, 5.5, 3.0, 0.03, 4), mats.hull, s * 1.9, 0, 36 + r * 5.5);
      add(spine, new THREE.BoxGeometry(0.11, 5.5, 0.07), mats.accent, s * 1.9, 0, 37.55 + r * 5.5);
    }
  });
  var spineBeacon = new THREE.MeshBasicMaterial({ color: 0xff4d4d });
  add(spine, new THREE.SphereGeometry(0.12, 10, 8), spineBeacon, 0, 1.7, 58.9);

  /* ---------- Luces del dique y baliza ---------- */
  var weldLight = new THREE.PointLight(0xbfe4ff, 1.2, 40);
  weldLight.position.set(0, 4, 0);
  group.add(weldLight);
  var reactorLight = new THREE.PointLight(0x66ccff, 1.0, 30);
  reactorLight.position.set(IX, 0, -14);
  group.add(reactorLight);

  /* ================= ANIMACIÓN ================= */
  function update(t, activity) {
    var act = Math.max(0, Math.min(1, activity == null ? 0.6 : activity));
    var sp = 0.4 + act * 1.2;

    // Grúas
    for (var i = 0; i < cranes.length; i++) {
      var cp = craneParts[i];
      var z = (i === 0 ? -13 : 13) + 10 * Math.sin(t * 0.09 * sp + cp.phase);
      cranes[i].position.z = z;
      cp.trolley.position.x = 6.5 * Math.sin(t * 0.23 * sp + cp.phase * 1.7);
      var L = 3.6 + 1.4 * (0.5 + 0.5 * Math.sin(t * 0.4 * sp + cp.phase));
      cp.cable.scale.y = L;
      cp.cable.position.y = -0.9 - L / 2;
      cp.hook.position.y = -0.9 - L;
    }

    // Soldadores
    for (var a = 0; a < arms.length; a++) {
      var ar = arms[a];
      ar.yaw.rotation.y = 0.5 * Math.sin(t * 0.35 * sp + ar.phase);
      ar.shoulder.rotation.z = -0.15 + 0.3 * Math.sin(t * 0.5 * sp + ar.phase * 2);
      ar.elbow.rotation.z = 0.25 + 0.3 * Math.sin(t * 0.7 * sp + ar.phase);
      var on = Math.sin(t * 23 + ar.phase * 5) * Math.sin(t * 7.3 + ar.phase) > -0.2;
      ar.halo.visible = on;
      ar.halo.scale.setScalar(0.7 + 0.5 * Math.abs(Math.sin(t * 31 + ar.phase)));
    }
    weldLight.intensity = 0.7 + act * 0.8 + 0.5 * Math.abs(Math.sin(t * 27)) * Math.abs(Math.sin(t * 3.1));

    // Remolcadores
    for (var k = 0; k < tugs.length; k++) {
      var tg = tugs[k];
      var an = t * tg.speed * (0.6 + act * 0.8) + tg.phase;
      var tz = tg.amp * Math.sin(an);
      tg.obj.position.set(tg.x, 3.2 + 1.2 * Math.sin(an * 2 + tg.phase), tz);
      tg.obj.rotation.y = Math.cos(an) > 0 ? 0 : P;
      tugLights[k].color.setHex(Math.sin(t * 4 + k) > 0.1 ? 0xffb347 : 0x2a2010);
    }

    // Reactor, antenas, balizas
    reactorRing.color.setRGB(0.25 + 0.2 * Math.sin(t * 2.0), 0.7 + 0.2 * Math.sin(t * 2.0), 1.0);
    reactorLight.intensity = 0.8 + 0.3 * Math.sin(t * 2.0);
    radar.rotation.y = t * 0.9;
    dish1.rotation.y = t * 0.4;
    dish2.rotation.y = -t * 0.3;
    towerBeacon.color.setHex(Math.sin(t * 6) > 0.8 ? 0xffffff : 0x1a1a1a);
    noseBeacon.color.setHex(Math.sin(t * 3) > 0.3 ? 0xff4d4d : 0x2a1010);
    spineBeacon.color.setHex(Math.sin(t * 3 + 1.2) > 0.3 ? 0xff4d4d : 0x2a1010);

    // Alas solares
    for (var w = 0; w < wings.length; w++) {
      wings[w].pivot.rotation.y = 0.3 * Math.sin(t * 0.2 + wings[w].phase);
    }

    // Luces de guía de los puertos
    var g = Math.floor(t * 2.5) % 5;
    for (var p = 0; p < portGuides.length; p++) {
      for (var q = 0; q < 3; q++) {
        portGuides[p][q].color.setHex(g <= 2 && q === 2 - g ? 0xffd08a : 0x2a2418);
      }
    }
  }

  function setAccent(hex) {
    colors.accent = hex;
    mats.accent.color.setHex(hex);
  }

  return {
    group: group, ship: ship, cranes: cranes, tugs: tugs.map(function (t) { return t.obj; }),
    ports: ports, update: update, setAccent: setAccent, materials: mats
  };
}
