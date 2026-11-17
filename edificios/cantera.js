/**
 * Cantera: estación minera sobre un asteroide, procedural, para Three.js (sin archivos externos).
 *
 * Es un diseño distinto al de Ágora: en lugar de un anillo, es un asteroide real (relieve con
 * ruido, cráteres, vetas de mineral) con instalaciones montadas encima:
 *  - Torre de perforación sobre un cráter, con broca que sube y baja y cristales de mineral.
 *  - Refinería con tanques esféricos, columna de destilación y una antorcha encendida.
 *  - Módulos de habitación con cúpula de observación.
 *  - Muelle de atraque de 12 u con brazos de carga, contenedores y luces de guía.
 *  - Catapulta de mineral (acelerador magnético) con anillos que se encienden en secuencia.
 *  - Torre de radar, mástil de paneles solares y 8 farolas con haz de luz.
 *  - 4 drones mineros que orbitan la estación.
 *
 * Uso:
 *   const q = createCantera(THREE, { accent: 0xff8a1f, spin: 0.02 });
 *   scene.add(q.group);
 *   // en tu bucle de juego (activity de 0 a 1: ritmo de perforación y de la catapulta):
 *   q.update(clock.getElapsedTime(), activity);
 *
 * Convenciones: arriba +Y. Escala: 1 unidad = 10 m. El asteroide mide ~22 x 14 x 16 u
 * (220 x 140 x 160 m); con muelle y catapulta la estación ocupa ~55 u de punta a punta.
 *
 * Expone:
 *   q.body              grupo que gira con el asteroide (todo lo construido está dentro)
 *   q.ports             [{ object, direction }] puertos de atraque: [0] punta del muelle, [1] helipuerto
 *                       de los módulos. Giran con q.body: usa object.getWorldPosition().
 *   q.drones            [Group x4] drones que orbitan (puedes leer su posición para tu juego)
 *   q.surfacePoint(x, y, z)  punto de la superficie del asteroide en la dirección dada (Vector3,
 *                       en coordenadas locales de q.body), útil para aterrizar o poner objetos
 *   q.setAccent(hex)
 * Compatible con Three.js r128 o superior.
 */
function createCantera(THREE, opts) {
  opts = opts || {};
  var P = Math.PI, TAU = P * 2;
  var spin = opts.spin != null ? opts.spin : 0.02;
  var colors = {
    hull: opts.hull != null ? opts.hull : 0xcfd5de,
    accent: opts.accent != null ? opts.accent : 0xff8a1f,
    dark: opts.dark != null ? opts.dark : 0x161c28,
    ore: opts.ore != null ? opts.ore : 0x33f0c8
  };

  var group = new THREE.Group();
  var body = new THREE.Group();
  group.add(body);

  /* ---------- Materiales ---------- */
  function solarTexture() {
    if (typeof document === 'undefined') return null;
    try {
      var cols = 4, rows = 3, cw = 64, ch = 64;
      var c = document.createElement('canvas');
      c.width = cols * cw; c.height = rows * ch;
      var g = c.getContext('2d');
      g.fillStyle = '#0d1f45';
      g.fillRect(0, 0, c.width, c.height);
      for (var i = 0; i < cols; i++) {
        for (var j = 0; j < rows; j++) {
          var x = i * cw, y = j * ch;
          var grad = g.createLinearGradient(x, y, x + cw, y + ch);
          grad.addColorStop(0, '#1d3d7c');
          grad.addColorStop(1, '#10285a');
          g.fillStyle = grad;
          g.fillRect(x + 3, y + 3, cw - 6, ch - 6);
          g.strokeStyle = 'rgba(150,190,255,0.35)';
          g.lineWidth = 1;
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
  var solarMap = solarTexture();

  var mats = {
    rock: new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.05, roughness: 0.95 }),
    boulder: new THREE.MeshStandardMaterial({ color: 0x5d564e, metalness: 0.05, roughness: 0.95 }),
    hull: new THREE.MeshStandardMaterial({ color: colors.hull, metalness: 0.35, roughness: 0.45 }),
    steel: new THREE.MeshStandardMaterial({ color: 0x8a95a5, metalness: 0.65, roughness: 0.45 }),
    accent: new THREE.MeshStandardMaterial({ color: colors.accent, metalness: 0.3, roughness: 0.45 }),
    dark: new THREE.MeshStandardMaterial({ color: colors.dark, metalness: 0.7, roughness: 0.5, side: THREE.DoubleSide }),
    glass: new THREE.MeshStandardMaterial({
      color: 0x0b1d33, metalness: 0.9, roughness: 0.05,
      emissive: 0x0a3a5c, emissiveIntensity: 0.9, side: THREE.DoubleSide
    }),
    ore: new THREE.MeshStandardMaterial({
      color: 0x0b3b33, metalness: 0.3, roughness: 0.3,
      emissive: colors.ore, emissiveIntensity: 0.9
    }),
    solar: new THREE.MeshStandardMaterial({
      color: solarMap ? 0xffffff : 0x1c3d73, map: solarMap || null, metalness: 0.55, roughness: 0.3
    }),
    window: new THREE.MeshBasicMaterial({ color: 0xffe3a0 }),
    lamp: new THREE.MeshBasicMaterial({ color: 0xffd08a })
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
  var seed = 59;
  function rnd() {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  }

  /* ---------- Matemática auxiliar (con arreglos simples) ---------- */
  function norm(v) {
    var l = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]) || 1;
    return [v[0] / l, v[1] / l, v[2] / l];
  }
  function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
  function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
  function sub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
  function smooth(a, b, x) { var t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); }
  function tangents(d) {
    var h = Math.abs(d[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
    var u = norm(cross(d, h));
    return [u, norm(cross(d, u))];
  }

  /* ---------- Ruido de valor ---------- */
  function hash(i, j, k) {
    var h = Math.sin(i * 127.1 + j * 311.7 + k * 74.7) * 43758.5453;
    return h - Math.floor(h);
  }
  function vnoise(x, y, z) {
    var xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
    var xf = x - xi, yf = y - yi, zf = z - zi;
    var u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf), w = zf * zf * (3 - 2 * zf);
    function h(a, b, c) { return hash(xi + a, yi + b, zi + c); }
    var x00 = h(0, 0, 0) + (h(1, 0, 0) - h(0, 0, 0)) * u;
    var x10 = h(0, 1, 0) + (h(1, 1, 0) - h(0, 1, 0)) * u;
    var x01 = h(0, 0, 1) + (h(1, 0, 1) - h(0, 0, 1)) * u;
    var x11 = h(0, 1, 1) + (h(1, 1, 1) - h(0, 1, 1)) * u;
    var y0 = x00 + (x10 - x00) * v, y1 = x01 + (x11 - x01) * v;
    return y0 + (y1 - y0) * w;
  }
  function fbm(x, y, z) {
    var a = 0.5, s = 0, f = 1;
    for (var i = 0; i < 4; i++) { s += a * vnoise(x * f, y * f, z * f); f *= 2.03; a *= 0.5; }
    return s / 0.9375;
  }

  /* ---------- Forma del asteroide ---------- */
  var RAD = 8, SC = [1.35, 0.85, 1.0];
  var DRILL = norm([0.1, 1, 0.15]), REFINERY = norm([1, 0.2, 0.1]), HAB = norm([-1, 0.25, 0.25]);
  var PIER = norm([0, -0.1, -1]), DRIVER = norm([0, 0.1, 1]), RADAR = norm([-0.5, 0.7, -0.5]);
  var SOLAR = norm([0.1, -1, 0.1]);

  var craters = [
    { d: DRILL, a: 0.3, depth: 0.16 },
    { d: norm([-0.6, -0.2, 0.8]), a: 0.35, depth: 0.12 },
    { d: norm([0.7, -0.5, -0.5]), a: 0.28, depth: 0.1 },
    { d: norm([-0.2, 0.6, -0.7]), a: 0.2, depth: 0.08 },
    { d: norm([0.5, 0.7, 0.5]), a: 0.22, depth: 0.09 }
  ];
  var pads = [
    { d: DRILL, a: 0.2 }, { d: REFINERY, a: 0.32 }, { d: HAB, a: 0.3 }, { d: PIER, a: 0.15 },
    { d: DRIVER, a: 0.13 }, { d: RADAR, a: 0.1 }, { d: SOLAR, a: 0.15 }
  ];

  function radiusBase(d) {
    var n = fbm(d[0] * 1.7 + 5.3, d[1] * 1.7 + 1.1, d[2] * 1.7 + 9.7);
    var rg = fbm(d[0] * 4.3 + 2.2, d[1] * 4.3 + 7.7, d[2] * 4.3 + 3.1);
    var r = 1 + (n - 0.5) * 0.4 + (rg - 0.5) * 0.1;
    for (var i = 0; i < craters.length; i++) {
      var c = craters[i];
      var ang = Math.acos(Math.max(-1, Math.min(1, dot(d, c.d))));
      if (ang < c.a * 1.5) {
        var t = ang / c.a;
        if (t < 1) r -= c.depth * (1 - t * t);
        r += c.depth * 0.35 * Math.exp(-Math.pow((t - 1) * 4, 2));
      }
    }
    return r;
  }
  for (var pi = 0; pi < pads.length; pi++) pads[pi].r0 = radiusBase(pads[pi].d);

  function radiusAt(d) {
    var r = radiusBase(d);
    for (var i = 0; i < pads.length; i++) {
      var p = pads[i];
      var ang = Math.acos(Math.max(-1, Math.min(1, dot(d, p.d))));
      if (ang < p.a) {
        var w = 1 - smooth(0.55, 1.0, ang / p.a);
        r = r * (1 - w) + p.r0 * w;
      }
    }
    return r;
  }
  function surf(d) {
    d = norm(d);
    var r = radiusAt(d) * RAD;
    return [d[0] * r * SC[0], d[1] * r * SC[1], d[2] * r * SC[2]];
  }
  function normalAt(d) {
    d = norm(d);
    var t = tangents(d), e = 0.012;
    var p0 = surf(d);
    var p1 = surf([d[0] + t[0][0] * e, d[1] + t[0][1] * e, d[2] + t[0][2] * e]);
    var p2 = surf([d[0] + t[1][0] * e, d[1] + t[1][1] * e, d[2] + t[1][2] * e]);
    var n = norm(cross(sub(p1, p0), sub(p2, p0)));
    if (dot(n, d) < 0) n = [-n[0], -n[1], -n[2]];
    return n;
  }
  var UP = new THREE.Vector3(0, 1, 0);

  // Coloca un grupo en la superficie con su eje local +Y siguiendo la normal.
  function place(grp, d, sink) {
    var p = surf(d), n = normalAt(d), s = sink == null ? 0.3 : sink;
    grp.position.set(p[0] - n[0] * s, p[1] - n[1] * s, p[2] - n[2] * s);
    grp.quaternion.setFromUnitVectors(UP, new THREE.Vector3(n[0], n[1], n[2]));
    body.add(grp);
    return grp;
  }

  /* ---------- Malla del asteroide ---------- */
  function weld(src) {
    var pos = src.attributes.position, idx = src.index;
    var count = idx ? idx.count : pos.count;
    var map = {}, verts = [], ind = [];
    for (var i = 0; i < count; i++) {
      var vi = idx ? idx.getX(i) : i;
      var x = pos.getX(vi), y = pos.getY(vi), z = pos.getZ(vi);
      var key = Math.round(x * 1e4) + ',' + Math.round(y * 1e4) + ',' + Math.round(z * 1e4);
      if (map[key] === undefined) { map[key] = verts.length / 3; verts.push(x, y, z); }
      ind.push(map[key]);
    }
    var g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    g.setIndex(ind);
    return g;
  }

  var rockGeo = weld(new THREE.IcosahedronGeometry(1, 22));
  (function shape() {
    var pos = rockGeo.attributes.position;
    var col = new Float32Array(pos.count * 3);
    for (var i = 0; i < pos.count; i++) {
      var d = norm([pos.getX(i), pos.getY(i), pos.getZ(i)]);
      var p = surf(d);
      pos.setXYZ(i, p[0], p[1], p[2]);
      var c1 = fbm(d[0] * 5.5 + 3, d[1] * 5.5 + 3, d[2] * 5.5 + 3);
      var ore = fbm(d[0] * 2.4 + 11.3, d[1] * 2.4 + 4.1, d[2] * 2.4 + 8.9);
      var g = 0.2 + 0.24 * c1;
      var r = g * 1.05, gg = g * 0.98, b = g * 0.9;
      var m = smooth(0.64, 0.8, ore) * 0.6;
      r += (0.62 - r) * m; gg += (0.34 - gg) * m; b += (0.14 - b) * m;
      col[i * 3] = r; col[i * 3 + 1] = gg; col[i * 3 + 2] = b;
    }
    rockGeo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    rockGeo.computeVertexNormals();
  })();
  body.add(new THREE.Mesh(rockGeo, mats.rock));

  /* ---------- Geometrías y herramientas ---------- */
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

  // Puntales: cilindros unitarios instanciados entre dos puntos.
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

  // Celosía cuadrada entre a y b, con cordones, travesaños y diagonales.
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

  function scatter(geo, mat, list) {
    var mesh = new THREE.InstancedMesh(geo, mat, list.length);
    var o = new THREE.Object3D();
    for (var i = 0; i < list.length; i++) {
      var e = list[i];
      o.position.set(e.p[0], e.p[1], e.p[2]);
      o.quaternion.setFromUnitVectors(UP, new THREE.Vector3(e.n[0], e.n[1], e.n[2]));
      o.rotateY(e.spin);
      o.scale.set(e.sx, e.sy, e.sz);
      o.updateMatrix();
      mesh.setMatrixAt(i, o.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
    mesh.frustumCulled = false;
    return mesh;
  }

  /* ---------- Rocas sueltas y cristales de mineral ---------- */
  var boulders = [];
  for (var bi = 0; bi < 150; bi++) {
    var bd = norm([rnd() * 2 - 1, rnd() * 2 - 1, rnd() * 2 - 1]);
    var padHit = false;
    for (var pj = 0; pj < pads.length; pj++) {
      if (Math.acos(Math.max(-1, Math.min(1, dot(bd, pads[pj].d)))) < pads[pj].a * 1.15) padHit = true;
    }
    if (padHit) continue;
    var bs = 0.12 + rnd() * rnd() * 0.7;
    var bp = surf(bd), bn = normalAt(bd);
    boulders.push({ p: [bp[0] - bn[0] * bs * 0.3, bp[1] - bn[1] * bs * 0.3, bp[2] - bn[2] * bs * 0.3], n: bn,
      spin: rnd() * TAU, sx: bs * (0.8 + rnd() * 0.6), sy: bs * (0.6 + rnd() * 0.5), sz: bs * (0.8 + rnd() * 0.6) });
  }
  body.add(scatter(new THREE.SphereGeometry(1, 9, 7), mats.boulder, boulders));

  var crystals = [], dt = tangents(DRILL);
  for (var ki = 0; ki < 70; ki++) {
    var ka = rnd() * TAU, kr = 0.2 + rnd() * 0.18;
    var kd = norm([
      DRILL[0] + (dt[0][0] * Math.cos(ka) + dt[1][0] * Math.sin(ka)) * kr,
      DRILL[1] + (dt[0][1] * Math.cos(ka) + dt[1][1] * Math.sin(ka)) * kr,
      DRILL[2] + (dt[0][2] * Math.cos(ka) + dt[1][2] * Math.sin(ka)) * kr
    ]);
    var kp = surf(kd), kn = normalAt(kd), ks = 0.1 + rnd() * 0.22;
    crystals.push({ p: [kp[0] - kn[0] * 0.05, kp[1] - kn[1] * 0.05, kp[2] - kn[2] * 0.05], n: kn,
      spin: rnd() * TAU, sx: ks * 0.5, sy: ks * (1.6 + rnd() * 1.4), sz: ks * 0.5 });
  }
  var crystalGeo = new THREE.ConeGeometry(1, 1, 6);
  crystalGeo.translate(0, 0.5, 0);
  body.add(scatter(crystalGeo, mats.ore, crystals));

  /* ================= TORRE DE PERFORACIÓN ================= */
  var rig = new THREE.Group();
  add(rig, roundedBox(4.4, 0.3, 4.4, 0.12, 8), mats.steel, 0, 0.15, 0);
  add(rig, horizontalTorus(1.8, 0.14, 10, 40), mats.accent, 0, 0.32, 0);
  var rigStruts = [];
  [[1, 1], [-1, 1], [-1, -1], [1, -1]].forEach(function (q) {
    truss(rigStruts, [q[0] * 1.7, 0.3, q[1] * 1.7], [q[0] * 0.6, 5.0, q[1] * 0.6], 0.22, 6, 0.045);
  });
  rig.add(strutField(rigStruts, mats.steel));
  add(rig, roundedBox(1.7, 0.45, 1.7, 0.16, 8), mats.hull, 0, 5.2, 0);
  add(rig, roundedBox(1.0, 0.3, 1.0, 0.12, 6), mats.accent, 0, 5.55, 0);
  [[0.4, 0], [-0.4, 0]].forEach(function (p) {
    var sh = add(rig, new THREE.TorusGeometry(0.28, 0.06, 8, 24), mats.dark, p[0], 5.85, p[1]);
    sh.rotation.y = P / 2;
  });
  var rod = new THREE.Group();
  rig.add(rod);
  add(rod, new THREE.CylinderGeometry(0.17, 0.17, 5.2, 14), mats.dark, 0, 0, 0);
  for (var rb = 0; rb < 4; rb++) add(rod, new THREE.TorusGeometry(0.19, 0.04, 8, 16), mats.steel, 0, -2.1 + rb * 1.3, 0).rotation.x = P / 2;
  add(rod, new THREE.CylinderGeometry(0.3, 0.06, 0.9, 12), mats.dark, 0, -3.0, 0);
  add(rod, new THREE.SphereGeometry(0.1, 12, 10), glowMat(0xffd08a, 0.95), 0, -3.5, 0);
  // Cabina de control y depósitos
  add(rig, roundedBox(1.1, 0.9, 1.3, 0.22, 8), mats.hull, 1.95, 0.75, 0);
  add(rig, new THREE.BoxGeometry(0.03, 0.3, 1.0), mats.glass, 2.52, 0.9, 0);
  add(rig, new THREE.BoxGeometry(0.9, 0.05, 0.12), mats.accent, 1.95, 1.22, 0.55);
  [0.9, -0.9].forEach(function (z) {
    add(rig, roundedBox(0.9, 0.7, 1.2, 0.2, 8), mats.steel, -1.8, 0.65, z);
    add(rig, new THREE.BoxGeometry(0.92, 0.05, 1.22), mats.accent, -1.8, 1.0, z);
  });
  var craterGlow = new THREE.CircleGeometry(1.5, 32);
  craterGlow.rotateX(-P / 2);
  var craterMat = glowMat(0xff7a2a, 0.35);
  add(rig, craterGlow, craterMat, 0, 0.36, 0);
  var craterLight = new THREE.PointLight(0xff8a3a, 1.2, 14);
  craterLight.position.set(0, 1.0, 0);
  rig.add(craterLight);
  place(rig, DRILL, 0.3);

  /* ================= REFINERÍA ================= */
  var ref = new THREE.Group();
  add(ref, roundedBox(5.4, 0.4, 4.4, 0.16, 8), mats.steel, 0, 0.2, 0);
  var refStruts = [];
  var tanks = [[-1.4, -0.7, 1.1], [1.1, -1.0, 0.8], [0.4, 1.0, 0.95]];
  tanks.forEach(function (t) {
    var cy = 0.4 + t[2] + 0.35;
    add(ref, new THREE.SphereGeometry(t[2], 36, 24), mats.hull, t[0], cy, t[1]);
    add(ref, horizontalTorus(t[2] * 1.002, 0.04, 8, 40), mats.accent, t[0], cy, t[1]);
    [[1, 1], [-1, 1], [-1, -1], [1, -1]].forEach(function (q) {
      refStruts.push([t[0] + q[0] * t[2] * 0.62, 0.4, t[1] + q[1] * t[2] * 0.62, t[0] + q[0] * t[2] * 0.5, cy - t[2] * 0.7, t[1] + q[1] * t[2] * 0.5, 0.06]);
    });
  });
  var capGeo = capsule(0.5, 1.6, 24);
  capGeo.rotateX(P / 2);   // vertical (el eje pasa a Y)
  [[-1.7, 1.2], [1.9, 0.6]].forEach(function (p) {
    add(ref, capGeo, mats.hull, p[0], 1.95, p[1]);
    add(ref, horizontalTorus(0.51, 0.04, 8, 28), mats.accent, p[0], 1.6, p[1]);
    add(ref, horizontalTorus(0.51, 0.04, 8, 28), mats.accent, p[0], 2.4, p[1]);
  });
  add(ref, new THREE.CylinderGeometry(0.45, 0.5, 5.2, 28), mats.hull, -0.2, 3.0, 0.1);
  [1.2, 2.6, 4.0].forEach(function (y) { add(ref, horizontalTorus(0.5, 0.05, 8, 28), mats.accent, -0.2, y, 0.1); });
  add(ref, new THREE.SphereGeometry(0.45, 20, 12, 0, TAU, 0, P / 2), mats.hull, -0.2, 5.6, 0.1);
  // Tuberías
  refStruts.push([-1.4, 2.5, -0.7, -0.2, 4.2, 0.1, 0.07]);
  refStruts.push([1.1, 2.0, -1.0, -0.2, 3.4, 0.1, 0.07]);
  refStruts.push([0.4, 2.3, 1.0, -0.2, 2.2, 0.1, 0.07]);
  refStruts.push([-1.7, 2.8, 1.2, -0.2, 3.8, 0.1, 0.06]);
  refStruts.push([1.9, 2.7, 0.6, 0.4, 2.2, 1.0, 0.06]);
  ref.add(strutField(refStruts, mats.steel));
  // Antorcha
  add(ref, new THREE.CylinderGeometry(0.06, 0.09, 6.2, 10), mats.dark, 2.1, 3.1, -1.5);
  var flare = new THREE.Group();
  flare.position.set(2.1, 6.2, -1.5);
  var fg1 = new THREE.ConeGeometry(0.35, 1.5, 14, 1, true); fg1.translate(0, 0.75, 0);
  var fg2 = new THREE.ConeGeometry(0.18, 1.0, 12, 1, true); fg2.translate(0, 0.5, 0);
  var flameOuter = add(flare, fg1, glowMat(0xff7a1f, 0.6));
  var flameInner = add(flare, fg2, glowMat(0xffe0a0, 0.9));
  ref.add(flare);
  var flareLight = new THREE.PointLight(0xff8a2f, 1.4, 16);
  flareLight.position.set(2.1, 6.8, -1.5);
  ref.add(flareLight);
  place(ref, REFINERY, 0.35);

  /* ================= MÓDULOS DE HABITACIÓN ================= */
  var hab = new THREE.Group();
  add(hab, roundedBox(6, 0.4, 6.4, 0.2, 8), mats.steel, 0, 0.2, 0);
  var modGeo = capsule(0.9, 3.2, 32);
  [-2.1, 0, 2.1].forEach(function (z, i) {
    var m = add(hab, modGeo, mats.hull, 0, 1.35, z);
    m.rotation.y = P / 2;
    add(hab, new THREE.TorusGeometry(0.92, 0.05, 8, 32), mats.accent, 0, 1.35, z).rotation.y = P / 2;
    add(hab, new THREE.TorusGeometry(0.92, 0.05, 8, 32), mats.accent, 0.9, 1.35, z).rotation.y = P / 2;
    add(hab, new THREE.TorusGeometry(0.92, 0.05, 8, 32), mats.accent, -0.9, 1.35, z).rotation.y = P / 2;
  });
  [1, -1].forEach(function (s) {
    var c = add(hab, new THREE.CylinderGeometry(0.25, 0.25, 4.6, 14), mats.steel, 1.3 * s, 1.1, 0);
    c.rotation.x = P / 2;
  });
  var habWin = [];
  [-2.1, 2.1].forEach(function (z) {
    for (var k = -3; k <= 3; k++) {
      [0.42, -0.42].forEach(function (dz) { if (rnd() < 0.85) habWin.push({ x: k * 0.4, y: 2.245, z: z + dz * 0.6 }); });
    }
  });
  hab.add(boxField(new THREE.BoxGeometry(0.22, 0.04, 0.14), mats.window, habWin));
  add(hab, new THREE.SphereGeometry(0.7, 28, 14, 0, TAU, 0, P / 2), mats.glass, 0, 2.15, 0);
  add(hab, horizontalTorus(0.72, 0.06, 8, 28), mats.accent, 0, 2.15, 0);
  add(hab, new THREE.CylinderGeometry(0.03, 0.04, 2.2, 8), mats.dark, -2.3, 2.1, -2.4);
  add(hab, new THREE.SphereGeometry(0.07, 10, 8), mats.accent, -2.3, 3.2, -2.4);
  // Helipuerto
  var pad = add(hab, new THREE.CircleGeometry(1.0, 28), mats.dark, 2.0, 0.42, 2.3);
  pad.rotation.x = -P / 2;
  add(hab, horizontalTorus(1.0, 0.04, 8, 36), mats.accent, 2.0, 0.42, 2.3);
  var padPort = new THREE.Object3D();
  padPort.position.set(2.0, 0.6, 2.3);
  hab.add(padPort);
  place(hab, HAB, 0.35);

  /* ================= MUELLE DE ATRAQUE ================= */
  var pier = new THREE.Group();
  add(pier, roundedBox(3.0, 0.6, 3.0, 0.2, 8), mats.steel, 0, 0.3, 0);
  var pierStruts = [];
  truss(pierStruts, [0, 0.4, 0], [0, 12, 0], 1.0, 12, 0.07);
  [5, 9].forEach(function (y, i) {
    [1, -1].forEach(function (s) {
      truss(pierStruts, [s * 0.5, y, 0], [s * 3.6, y, 0], 0.5, 6, 0.05);
      var c = add(pier, roundedBox(1.1, 1.1, 2.4, 0.22, 8), crateMats[(i * 2 + (s > 0 ? 0 : 1)) % crateMats.length], s * 4.2, y, 0);
      add(pier, new THREE.BoxGeometry(0.1, 0.5, 2.0), mats.dark, s * 3.62, y, 0);
      add(pier, new THREE.BoxGeometry(0.1, 0.3, 1.2), mats.accent, s * 4.76, y, 0);
    });
  });
  pier.add(strutField(pierStruts, mats.steel));
  add(pier, horizontalTorus(1.7, 0.18, 12, 48), mats.accent, 0, 12.2, 0);
  add(pier, horizontalTorus(1.45, 0.05, 8, 48), mats.steel, 0, 12.2, 0);
  var ringLamps = [];
  for (var li = 0; li < 16; li++) {
    var la = li * TAU / 16;
    ringLamps.push({ x: 1.7 * Math.cos(la), y: 12.4, z: 1.7 * Math.sin(la) });
  }
  pier.add(boxField(new THREE.SphereGeometry(0.07, 8, 6), mats.lamp, ringLamps));
  // Luces de guía en secuencia
  var guides = [];
  [14.2, 16.2, 18.2].forEach(function (y) {
    var m = new THREE.MeshBasicMaterial({ color: 0xffd08a });
    add(pier, new THREE.SphereGeometry(0.12, 10, 8), m, 0, y, 0);
    guides.push(m);
  });
  var pierPort = new THREE.Object3D();
  pierPort.position.set(0, 12.5, 0);
  pier.add(pierPort);
  place(pier, PIER, 0.4);

  /* ================= CATAPULTA DE MINERAL ================= */
  var driver = new THREE.Group();
  add(driver, roundedBox(2.6, 0.5, 2.6, 0.18, 8), mats.steel, 0, 0.25, 0);
  var drvStruts = [];
  [1, -1].forEach(function (s) {
    drvStruts.push([s * 0.38, 0.4, 0, s * 0.38, 16.4, 0, 0.07]);
    truss(drvStruts, [s * 1.0, 0.4, 0], [s * 0.45, 4.0, 0], 0.3, 3, 0.04);
  });
  driver.add(strutField(drvStruts, mats.steel));
  var drvRings = [];
  for (var di = 0; di < 12; di++) {
    var dm = new THREE.MeshBasicMaterial({ color: 0x66ccff });
    add(driver, horizontalTorus(0.62, 0.08, 10, 32), dm, 0, 2.2 + di * 1.2, 0);
    drvRings.push(dm);
    add(driver, new THREE.BoxGeometry(0.78, 0.05, 0.06), mats.dark, 0, 2.2 + di * 1.2, 0);
  }
  add(driver, horizontalTorus(0.7, 0.12, 10, 36), mats.accent, 0, 16.6, 0);
  var drvBeacon = new THREE.MeshBasicMaterial({ color: 0xff4d4d });
  add(driver, new THREE.SphereGeometry(0.12, 10, 8), drvBeacon, 0, 17.0, 0);
  place(driver, DRIVER, 0.35);

  /* ================= TORRE DE RADAR ================= */
  var radarTower = new THREE.Group();
  var radStruts = [];
  truss(radStruts, [0, 0, 0], [0, 7, 0], 0.55, 7, 0.04);
  radarTower.add(strutField(radStruts, mats.steel));
  add(radarTower, roundedBox(1.0, 0.25, 1.0, 0.1, 6), mats.hull, 0, 7.1, 0);
  var radarDish = new THREE.Group();
  radarDish.position.set(0, 7.5, 0);
  var rdm = add(radarDish, new THREE.SphereGeometry(0.9, 28, 12, 0, TAU, 0, P / 2), mats.hull, 0, 0.1, 0);
  rdm.rotation.x = P;
  rdm.material = mats.hull.clone();
  rdm.material.side = THREE.DoubleSide;
  add(radarDish, new THREE.CylinderGeometry(0.03, 0.03, 0.9, 8), mats.dark, 0, 0.45, 0);
  radarDish.rotation.z = -0.5;
  radarTower.add(radarDish);
  var radarBeacon = new THREE.MeshBasicMaterial({ color: 0xff4d4d });
  add(radarTower, new THREE.SphereGeometry(0.1, 10, 8), radarBeacon, 0, 7.4, 0.4);
  place(radarTower, RADAR, 0.3);

  /* ================= MÁSTIL SOLAR ================= */
  var solar = new THREE.Group();
  var solStruts = [];
  truss(solStruts, [0, 0, 0], [0, 6, 0], 0.5, 6, 0.04);
  truss(solStruts, [-4.6, 6, 0], [4.6, 6, 0], 0.4, 9, 0.035);
  solar.add(strutField(solStruts, mats.steel));
  add(solar, roundedBox(0.9, 0.6, 0.9, 0.2, 6), mats.hull, 0, 6, 0);
  var panelGeo = roundedBox(4.0, 0.06, 3.0, 0.025, 6);
  var solarPivots = [];
  [1, -1].forEach(function (s) {
    var pv = new THREE.Group();
    pv.position.set(0, 6, 0);
    add(pv, panelGeo, mats.solar, s * 2.9, 0.1, 0);
    solar.add(pv);
    solarPivots.push({ pivot: pv, phase: s > 0 ? 0 : 1.6 });
  });
  place(solar, SOLAR, 0.35);

  /* ================= FAROLAS ================= */
  var beamGeo = new THREE.ConeGeometry(0.9, 3.4, 16, 1, true);
  beamGeo.translate(0, -1.7, 0);
  var beamMat = glowMat(0xffe3b0, 0.16);
  var lampDirs = [];
  [[0.35, 0.0], [-0.17, 0.3], [-0.17, -0.3]].forEach(function (o) {
    var t = tangents(DRILL);
    lampDirs.push([
      DRILL[0] + t[0][0] * o[0] + t[1][0] * o[1],
      DRILL[1] + t[0][1] * o[0] + t[1][1] * o[1],
      DRILL[2] + t[0][2] * o[0] + t[1][2] * o[1]
    ]);
  });
  var pt = tangents(PIER);
  lampDirs.push([PIER[0] + pt[0][0] * 0.2, PIER[1] + pt[0][1] * 0.2, PIER[2] + pt[0][2] * 0.2]);
  lampDirs.push([PIER[0] - pt[0][0] * 0.2, PIER[1] - pt[0][1] * 0.2, PIER[2] - pt[0][2] * 0.2]);
  var rt = tangents(REFINERY);
  lampDirs.push([REFINERY[0] + rt[1][0] * 0.38, REFINERY[1] + rt[1][1] * 0.38, REFINERY[2] + rt[1][2] * 0.38]);
  var ht = tangents(HAB);
  lampDirs.push([HAB[0] + ht[1][0] * 0.36, HAB[1] + ht[1][1] * 0.36, HAB[2] + ht[1][2] * 0.36]);
  lampDirs.forEach(function (d, i) {
    var lamp = new THREE.Group();
    add(lamp, new THREE.CylinderGeometry(0.05, 0.07, 1.6, 8), mats.dark, 0, 0.8, 0);
    var head = new THREE.Group();
    head.position.y = 1.65;
    head.rotation.z = 0.6;
    head.rotation.y = i * 1.3;
    add(head, roundedBox(0.5, 0.16, 0.3, 0.06, 4), mats.hull, 0, 0, 0);
    add(head, new THREE.BoxGeometry(0.4, 0.02, 0.22), mats.lamp, 0, -0.085, 0);
    add(head, beamGeo, beamMat, 0, -0.09, 0);
    lamp.add(head);
    place(lamp, d, 0.1);
  });

  /* ================= DRONES MINEROS ================= */
  var drones = [];
  var droneBody = roundedBox(0.6, 0.4, 0.9, 0.14, 6);
  var dronePanel = new THREE.BoxGeometry(0.7, 0.03, 0.4);
  var droneLights = [];
  [[30, 0.5, 0, 0.11], [34, -0.7, 2.1, -0.08], [27, 1.0, 4.0, 0.14], [37, -0.3, 5.2, -0.06]].forEach(function (c, i) {
    var dr = new THREE.Group();
    add(dr, droneBody, mats.hull, 0, 0, 0);
    add(dr, new THREE.BoxGeometry(0.62, 0.05, 0.3), mats.accent, 0, 0.2, 0.05);
    add(dr, dronePanel, mats.solar, 0.75, 0, 0);
    add(dr, dronePanel, mats.solar, -0.75, 0, 0);
    add(dr, new THREE.CylinderGeometry(0.03, 0.03, 0.2, 6), mats.dark, 0, -0.28, 0);
    var lm = new THREE.MeshBasicMaterial({ color: 0xff4d4d });
    add(dr, new THREE.SphereGeometry(0.06, 8, 6), lm, 0, 0.26, -0.3);
    droneLights.push(lm);
    group.add(dr);
    drones.push({ obj: dr, R: c[0], inc: c[1], phase: c[2], speed: c[3] });
  });

  /* ================= ANIMACIÓN ================= */
  var up = new THREE.Vector3(0, 1, 0);
  function update(t, activity) {
    var act = Math.max(0, Math.min(1, activity == null ? 0.6 : activity));
    body.rotation.y = t * spin;
    body.rotation.z = 0.12;

    // Broca: sube y baja con golpes cortos
    var cycle = t * (0.6 + act * 1.4);
    rod.position.y = 3.0 + Math.sin(cycle) * 0.9 + Math.sin(cycle * 9) * 0.03 * act;
    craterMat.opacity = 0.25 + 0.15 * Math.sin(cycle * 2.3) + act * 0.1;
    craterLight.intensity = 0.8 + act * 0.8 + 0.15 * Math.sin(t * 11);

    // Antorcha
    var fl = 1 + 0.15 * Math.sin(t * 17) + 0.1 * Math.sin(t * 29);
    flameOuter.scale.set(1 + 0.1 * Math.sin(t * 23), fl, 1 + 0.1 * Math.cos(t * 19));
    flameInner.scale.set(1, fl * (2 - fl), 1);
    flareLight.intensity = 1.0 + 0.4 * Math.sin(t * 13) + 0.2 * Math.sin(t * 31);

    // Catapulta: pulso que sube por los anillos
    var pulse = (t * (1.2 + act * 2.0)) % (drvRings.length + 4);
    for (var i = 0; i < drvRings.length; i++) {
      var v = Math.max(0, 1 - Math.abs(pulse - i) / 2.2);
      drvRings[i].color.setRGB(0.12 + 0.55 * v, 0.35 + 0.55 * v, 0.7 + 0.3 * v);
    }
    drvBeacon.color.setHex(Math.sin(t * 3) > 0.3 ? 0xff4d4d : 0x2a1010);
    radarBeacon.color.setHex(Math.sin(t * 2.2 + 1) > 0.3 ? 0xff4d4d : 0x2a1010);

    // Luces de guía del muelle
    var g = Math.floor(t * 2.5) % 5;
    for (var k = 0; k < guides.length; k++) guides[k].color.setHex(k === (2 - g) || g > 2 ? (g > 2 ? 0x2a2418 : 0xffd08a) : 0x2a2418);

    radarDish.rotation.y = t * 0.7;
    for (var s = 0; s < solarPivots.length; s++) {
      solarPivots[s].pivot.rotation.x = 0.35 * Math.sin(t * 0.2 + solarPivots[s].phase);
    }

    // Drones orbitando
    for (var d = 0; d < drones.length; d++) {
      var dr = drones[d];
      var a = t * dr.speed + dr.phase;
      var x = dr.R * Math.cos(a), yy = dr.R * Math.sin(a) * Math.sin(dr.inc), z = dr.R * Math.sin(a) * Math.cos(dr.inc);
      dr.obj.position.set(x, yy, z);
      dr.obj.rotation.y = -a + P / 2;
      droneLights[d].color.setHex(Math.sin(t * 4 + d) > 0.2 ? 0xff4d4d : 0x2a1010);
    }
  }

  function setAccent(hex) {
    colors.accent = hex;
    mats.accent.color.setHex(hex);
  }

  function surfacePoint(x, y, z) {
    var p = surf([x, y, z]);
    return new THREE.Vector3(p[0], p[1], p[2]);
  }

  return {
    group: group, body: body, update: update, setAccent: setAccent, surfacePoint: surfacePoint,
    ports: [
      { object: pierPort, direction: new THREE.Vector3(0, 1, 0) },
      { object: padPort, direction: new THREE.Vector3(0, 1, 0) }
    ],
    drones: drones.map(function (d) { return d.obj; }),
    materials: mats
  };
}
