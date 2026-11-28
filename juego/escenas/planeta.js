/* Escena: superficie del planeta — aterrizas, ves tu base y colocas estructuras (ver README.md).
   Las estructuras son los modelos de edificios/base/ (se descargan solo al necesitarlos). La base se guarda en este dispositivo. */
(function (global) {
  'use strict';
  var E = global.JN = global.JN || {};
  var CONFIG = E.CONFIG, PI = E.PI, clamp = E.clamp, leer = E.leer, guardar = E.guardar, el = E.el, esc = E.esc, DOMcapas = E.DOMcapas, jug = E.jug, escenas = E.escenas;
  var naveDe = E.naveDe, medidas = E.medidas, obtenerModelo = E.obtenerModelo, cargarScript = E.cargarScript, mostrarCapas = E.mostrarCapas, irA = function (n, d) { return E.irA(n, d); };

  var RADIO_BASE = 8000, MAX_EST = 30, HOVER = 90;
  var DUR = { torreta: 25, planta: 60, extr_min: 40, extr_pet: 40, refineria: 90, complejo: 120, com1: 20, com2: 40, com3: 70, inv1: 25, inv2: 60, pista1: 90, pista2: 150, ciudad: 240, taller1: 70, taller2: 110, astillero: 180, muro: 6, porton: 10, torretaf: 8, base_pc: 4, base_pt: 3, base_mc: 5, base_mt: 4, base_dc: 8, base_dt: 6 };   // segundos
  var CATALOGO = [
    { id: 'planta', nombre: 'Planta de energía de fusión', archivo: 'planta_energia.js', fn: 'createPlantaEnergia', desc: 'Reactor, turbinas y baterías.' },
    { id: 'extr_min', nombre: 'Extractora de minerales', archivo: 'extractora_minerales.js', fn: 'createExtractoraMinerales', desc: 'Saca mineral del suelo.' },
    { id: 'extr_pet', nombre: 'Extractora de petróleo', archivo: 'extractora_petroleo.js', fn: 'createExtractoraPetroleo', desc: 'Bombea petróleo.' },
    { id: 'refineria', nombre: 'Refinería', archivo: 'refineria.js', fn: 'createRefineria', desc: 'Procesa petróleo y mineral.' },
    { id: 'complejo', nombre: 'Complejo habitacional', archivo: 'complejo_habitacional.js', fn: 'createComplejoHabitacional', desc: 'Torre de mando y 5 torres.' },
    { id: 'com1', nombre: 'Puesto de comunicaciones', archivo: 'comunicaciones_nivel1.js', fn: 'createPuestoComunicaciones', desc: 'Nivel 1.' },
    { id: 'com2', nombre: 'Estación de comunicaciones', archivo: 'comunicaciones_nivel2.js', fn: 'createEstacionComunicaciones', desc: 'Nivel 2.' },
    { id: 'com3', nombre: 'Nodo de comunicaciones', archivo: 'comunicaciones_nivel3.js', fn: 'createNodoComunicaciones', desc: 'Nivel 3.' },
    { id: 'inv1', nombre: 'Invernadero', archivo: 'invernadero_nivel1.js', fn: 'createInvernadero1', desc: 'Nivel 1.' },
    { id: 'inv2', nombre: 'Gran invernadero', archivo: 'invernadero_nivel2.js', fn: 'createInvernadero2', desc: 'Nivel 2.' },
    { id: 'pista1', plano: true, nombre: 'Pista circular', archivo: 'pista_circular_nivel1.js', fn: 'createPistaCircular1', desc: 'Nivel 1.' },
    { id: 'pista2', plano: true, nombre: 'Pista circular grande', archivo: 'pista_circular_nivel2.js', fn: 'createPistaCircular2', desc: 'Nivel 2.' },
    { id: 'ciudad', plano: true, nombre: 'Pista-ciudad', archivo: 'pista_ciudad_nivel2.js', fn: 'createPistaCiudad2', desc: '3 pistas y torre central.' },
    { id: 'taller1', nombre: 'Taller de reparación', archivo: 'taller_reparacion_nivel1.js', fn: 'createTallerReparacion1', desc: 'Nivel 1.' },
    { id: 'taller2', nombre: 'Taller de reparación doble', archivo: 'taller_reparacion_nivel2.js', fn: 'createTallerReparacion2', desc: 'Nivel 2.' },
    { id: 'torreta', nombre: 'Torreta antiaérea doble', archivo: 'torreta_antiaerea.js', fn: 'createTorreta', desc: 'Arma antigua y barata. Puedes sentarte y disparar.', esc: 1, arma: true },
    { id: 'muro', defensa: 'muro', nombre: 'Muro de piedra', archivo: ['muro_piedra.js', 'defensas.js'], fn: 'createDefMuro', desc: 'Columna + pared + columna. Se encaja solo con los demás muros.', esc: 10 },
    { id: 'porton', defensa: 'porton', nombre: 'Portón de piedra y metal', archivo: ['porton_piedra.js', 'defensas.js'], fn: 'createDefPorton', desc: 'Igual que un muro, con dos hojas que se abren con USAR.', esc: 10 },
    { id: 'torretaf', defensa: 'torretaf', nombre: 'Torreta futurista', archivo: ['torreta_futurista.js', 'defensas.js'], fn: 'createDefTorretaF', desc: 'Se coloca sobre la columna de un muro o portón.', esc: 10 },
    { id: 'base_pc', req: 'createStoneFoundationSquare', base: 'c', lado: 10, mejora: 'base_mc', nombre: 'Base de piedra (cuadrada)', archivo: ['base_piedra.js', 'bases.js'], fn: 'createBasePiedraC', desc: 'Cimiento de 10 m. Se encaja con otras bases y se mejora a metal y metal duro. Solo a pie.', esc: 10 / 3, escY: 1.9 },
    { id: 'base_pt', req: 'createStoneFoundationTriangle', base: 't', lado: 10, mejora: 'base_mt', nombre: 'Base de piedra (triangular)', archivo: ['base_piedra.js', 'bases.js'], fn: 'createBasePiedraT', desc: 'Cimiento triangular de 10 m por lado. Solo a pie.', esc: 10 / 3, escY: 1.9 },
    { id: 'base_mc', req: 'createMetalFoundationSquare', base: 'c', lado: 10, mejora: 'base_dc', oculto: true, nombre: 'Base de metal (cuadrada)', archivo: ['base_metal.js', 'bases.js'], fn: 'createBaseMetalC', desc: 'Mejora de la base de piedra.', esc: 10 / 3, escY: 1.9 },
    { id: 'base_mt', req: 'createMetalFoundationTriangle', base: 't', lado: 10, mejora: 'base_dt', oculto: true, nombre: 'Base de metal (triangular)', archivo: ['base_metal.js', 'bases.js'], fn: 'createBaseMetalT', desc: 'Mejora de la base de piedra.', esc: 10 / 3, escY: 1.9 },
    { id: 'base_dc', req: 'createArmoredFoundationSquare', base: 'c', lado: 10, oculto: true, nombre: 'Base de metal duro (cuadrada)', archivo: ['base_metal_duro.js', 'bases.js'], fn: 'createBaseDuroC', desc: 'Mejora final.', esc: 10 / 3, escY: 1.9 },
    { id: 'base_dt', req: 'createArmoredFoundationTriangle', base: 't', lado: 10, oculto: true, nombre: 'Base de metal duro (triangular)', archivo: ['base_metal_duro.js', 'bases.js'], fn: 'createBaseDuroT', desc: 'Mejora final.', esc: 10 / 3, escY: 1.9 },
    { id: 'astillero', nombre: 'Astillero planetario', archivo: 'astillero_planetario.js', fn: 'createAstillero', desc: 'Construye naves en el suelo.' }
  ];
  /* [color del suelo, cielo, estilo de suelo, color del mar (si tiene océano), color del sol] */
  var PAISAJE = { tierra: ['#4e8f3c', 0x8cc4f2, 'hierba', 0x2f7fc4, 0xfff4e2], caos: ['#8d8a3c', 0xdccb78, 'hierba', 0x4f8f86, 0xffe9a0], desierto: ['#d9b676', 0xeccf9e, 'arena', 0x2aa6b8, 0xffe6bf], arido: ['#b0764a', 0xd9a074], rocoso: ['#6f7b63', 0x8fb0cf], hielo: ['#cfe0ee', 0x9ec3e6], tormenta: ['#5a5470', 0x7c6f98] };
  E.ATERRIZABLES = { tierra: 1, caos: 1, desierto: 1 };   // los demás son planetas mineros: no se aterriza

  var sc, cam, suelo, anillo, rejilla, luzSol, luzHemi, luzLuna, ui = null, construido = false, ray = null, v2p = null, pyF = 0, fallV = 0, rc = null, cm = { x: 1e9, z: 1e9, list: [] }, ascKey = '', pendAsc = null, viajeFin = 0, naveBaja = false, naveY = HOVER, avisoT = 0, naveX = 0, naveZ = 0, naveTx = 0, naveTz = 0;
  var modoPie = false, px = 0, pz = 0, pyaw = 0, ppit = 0, sentado = null, correr = false, tIx = 0, tIy = 0, saltoY = 0, saltoV = 0, jet = 1, volar = false, jetOn = false, golpeT = 0, manosPie = null,  stk = null, lookId = null, cercaT = null, cercaN = false, cercaG = null, cercaB = null, vA = null, qA = null, vB = null, vC = null;
  var pl = null, ret = null, key = '', nave = null, pad = 60, colocadas = [], ghost = null, itemSel = null, rotG = 0, modoBorrar = false, cargando = '', alt = false;
  var fx = 0, fz = 0, yaw = 0.6, pit = 0.75, dist = 160, punteros = {}, pinch0 = 0, dist0 = 0, mov = 0, bR = 0, bZ = 0, tToast = 0;

  function construir() {
    mar = orilla = deco = null; manosPrem = null; sc = new THREE.Scene(); cam = new THREE.PerspectiveCamera(60, 1, 1, 22000);
    luzSol = new THREE.DirectionalLight(0xfff1e0, 2.3); luzSol.position.set(0.6, 0.8, 0.4); luzHemi = new THREE.HemisphereLight(0xaac4e6, 0x3a2a22, 0.75); luzLuna = new THREE.DirectionalLight(0x8fa8ff, 0); luzLuna.position.set(-0.6, 0.8, -0.4); sc.add(luzSol, luzHemi, luzLuna); crearCielo();
    suelo = new THREE.Mesh(new THREE.CircleGeometry(30000, 72), new THREE.MeshStandardMaterial({ roughness: 1, metalness: 0 })); suelo.rotation.x = -PI / 2; sc.add(suelo);
    anillo = new THREE.Mesh(new THREE.RingGeometry(RADIO_PLANO - 2.5, RADIO_PLANO, 160), new THREE.MeshBasicMaterial({ color: 0x7fe3ff, transparent: true, opacity: 0.45, side: THREE.DoubleSide })); anillo.rotation.x = -PI / 2; anillo.position.y = 0.4; sc.add(anillo);
    rejilla = new THREE.GridHelper(600, 30, 0x7fe3ff, 0x7fe3ff); rejilla.material.transparent = true; rejilla.material.opacity = 0.16; rejilla.position.y = 0.5; rejilla.visible = false; sc.add(rejilla);
    try {   // reflejos suaves para que los metales no se vean negros
      var es = new THREE.Scene(); es.add(new THREE.Mesh(new THREE.BoxGeometry(40, 40, 40), new THREE.MeshBasicMaterial({ color: 0x2a3348, side: THREE.BackSide })));
      var strip = function (c, w, h, x, y, z) { var m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: c, side: THREE.DoubleSide })); m.position.set(x, y, z); m.lookAt(0, 0, 0); es.add(m); };
      strip(0xdddddd, 24, 8, 0, 18, 4); strip(0xffc890, 8, 16, -16, 2, 6); strip(0x8fb8ff, 8, 16, 16, 0, -6);
      var pm = new THREE.PMREMGenerator(E.renderer); sc.environment = pm.fromScene(es, 0.06).texture; pm.dispose();
    } catch (e0) { }
    ray = new THREE.Raycaster(); v2p = new THREE.Vector2();
    construido = true;
  }
  var mar = null, orilla = null, deco = null;
  function rnd01(sd) { var v = Math.sin(sd * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); }
  function texSuelo(col, estilo) {
    var c = document.createElement('canvas'); c.width = c.height = 256; var g = c.getContext('2d'), i, t;
    g.fillStyle = col; g.fillRect(0, 0, 256, 256);
    if (estilo === 'hierba' || estilo === 'arena') {
      var pal = estilo === 'hierba' ? ['rgba(24,80,28,0.40)', 'rgba(130,196,76,0.38)', 'rgba(72,134,40,0.34)', 'rgba(190,210,100,0.22)'] : ['rgba(255,238,200,0.16)', 'rgba(130,86,34,0.14)', 'rgba(255,224,170,0.12)'];
      for (i = 0; i < (estilo === 'hierba' ? 7000 : 2600); i++) { g.fillStyle = pal[(Math.random() * pal.length) | 0]; if (estilo === 'hierba') g.fillRect(Math.random() * 256, Math.random() * 256, 1, 2 + Math.random() * 4); else g.fillRect(Math.random() * 256, Math.random() * 256, 6 + Math.random() * 34, 1 + (Math.random() < 0.3 ? 1 : 0)); }
      t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(730, 730); if ('encoding' in t) t.encoding = THREE.sRGBEncoding; return t;
    }
    for (i = 0; i < 2600; i++) { g.fillStyle = Math.random() < 0.5 ? 'rgba(0,0,0,0.07)' : 'rgba(255,255,255,0.06)'; var s = 2 + Math.random() * 14; g.fillRect(Math.random() * 256, Math.random() * 256, s, s); }
    var t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(730, 730); if ('encoding' in t) t.encoding = THREE.sRGBEncoding; return t;
  }

  /* ---- PLANETA REDONDO: el mundo da la vuelta (este-oeste) y los polos son casquetes de hielo; el relieve sale de ruido 3D sobre una esfera ---- */
  var AGUA_Y = -1.5, RADIO_PLANO = 1200, PI2 = PI * 2, TER = null;
  var MUN = { W: 40000, TILE: 800 }; MUN.RP = MUN.W / PI2; MUN.ZMAX = MUN.RP * 1.4835; MUN.NX = MUN.W / MUN.TILE;
  function hash2(i, j, sd) { var v = Math.sin(i * 127.1 + j * 311.7 + sd * 74.7) * 43758.5453; return v - Math.floor(v); }
  function sstep(a, b, x) { var t = (x - a) / (b - a); t = t < 0 ? 0 : t > 1 ? 1 : t; return t * t * (3 - 2 * t); }
  function wrapX(x) { x = (x + MUN.W / 2) % MUN.W; if (x < 0) x += MUN.W; return x - MUN.W / 2; }
function h3(i, j, k, sd) { var h = Math.imul(i, 374761393) ^ Math.imul(j, 668265263) ^ Math.imul(k, 1274126177) ^ Math.imul(sd + 1, 1103515245); h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; return (h & 0xffff) / 32767.5 - 1; }
function vn3(x, y, z, sd) {
  var i = Math.floor(x), j = Math.floor(y), k = Math.floor(z), fx = x - i, fy = y - j, fz = z - k, u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy), w = fz * fz * (3 - 2 * fz);
  var a = h3(i, j, k, sd), b = h3(i + 1, j, k, sd), c = h3(i, j + 1, k, sd), d = h3(i + 1, j + 1, k, sd), e = h3(i, j, k + 1, sd), f = h3(i + 1, j, k + 1, sd), g = h3(i, j + 1, k + 1, sd), h = h3(i + 1, j + 1, k + 1, sd);
  var x1 = a + (b - a) * u, x2 = c + (d - c) * u, x3 = e + (f - e) * u, x4 = g + (h - g) * u, y1 = x1 + (x2 - x1) * v, y2 = x3 + (x4 - x3) * v; return y1 + (y2 - y1) * w;
}
function fb3(x, y, z, oct, sd) { var s = 0, a = 1, n = 0, k; for (k = 0; k < oct; k++) { s += vn3(x, y, z, sd + k * 7) * a; n += a; a *= 0.5; x = x * 2.03 + 11.1; y = y * 2.03 - 7.3; z = z * 2.03 + 3.7; } return s / n; }
var PERFIL = { tierra: { A1: 22, A2: 6, A3: 170, dun: 0, polar: 1 }, caos: { A1: 30, A2: 9, A3: 230, dun: 0, polar: 1 }, desierto: { A1: 12, A2: 3, A3: 90, dun: 11, polar: 0 } };
var MS = { h: 0, f: 0, cold: 0, mD: 0, mB: 0, lat: 0, ice: 0, riv: 0, hl: 0, m1: 0, m2: 0, nv: 0, sx: 0 };
function muestra(x, z, tipo) {
  var P = PERFIL[tipo] || PERFIL.tierra, sd = tipo === 'caos' ? 31 : tipo === 'desierto' ? 57 : 5, RP = MUN.RP;
  x = wrapX(x); var lon = x / RP, lat = clamp(z / RP, -1.5, 1.5), cl = Math.cos(lat), ux = cl * Math.cos(lon), uy = Math.sin(lat), uz = cl * Math.sin(lon), alat = Math.abs(lat);
  var sx = ux * RP, sy = uy * RP, sz = uz * RP;   // posición 3D en metros sobre la esfera (sin costuras al dar la vuelta)
  var hd = Math.hypot(x, z), flat = sstep(RADIO_PLANO, RADIO_PLANO + 700, hd);
  var C = fb3(ux * 1.5 + 3.1, uy * 1.5 + 1.7, uz * 1.5 + 5.3, 4, sd), Is = fb3(ux * 6 + 9, uy * 6 - 4, uz * 6 + 2, 3, sd + 9);
  var f = C - 0.07 + Math.max(0, Is - 0.22) * 0.5 + 1.1 * sstep(4300, 2100, hd);   // costa: f > 0 tierra
  MS.f = f; MS.lat = lat;
  var cold = P.polar ? sstep(0.95, 1.33, alat) : 0, ice = P.polar ? sstep(1.22, 1.34, alat) : 0;   // 54°..76°: se enfría; >70°: casquete
  var h, hl = 0, rv = 0;
  if (f <= 0) { var tt = sstep(0, 0.5, -f); h = AGUA_Y - 0.25 - 64.8 * Math.pow(tt, 1.1) + fb3(sx / 380, sy / 380, sz / 380, 2, sd + 63) * 3 * tt; }
  else {
    if (flat > 0) {
      hl = (fb3(sx / 2400, sy / 2400, sz / 2400, 3, sd) + 0.55) * P.A1 + fb3(sx / 520, sy / 520, sz / 520, 2, sd + 9) * P.A2;
      var rg = 1 - Math.abs(fb3(sx / 3000, sy / 3000, sz / 3000, 3, sd + 3)), u = Math.max(0, rg - 0.88) / 0.12;   // montañas en mesetas: terrazas planas y cima ancha
      u = 0.42 * sstep(0.04, 0.2, u) + 0.30 * sstep(0.32, 0.46, u) + 0.28 * sstep(0.58, 0.72, u); hl += P.A3 * u * sstep(0.15, 0.4, f); hl -= fb3(sx / 520, sy / 520, sz / 520, 2, sd + 9) * P.A2 * 0.85 * sstep(0.7, 0.95, u) * flat * sstep(0.15, 0.4, f);
      if (P.dun) hl += (Math.sin((sx * 0.8 + sz * 0.6) / 170 + fb3(sx / 900, sy / 900, sz / 900, 2, sd + 5) * 5) * 0.5 + 0.5) * P.dun;
      hl *= flat;
    }
    var playa = AGUA_Y - 0.2 + 3.4 * sstep(0, 0.045, f); h = playa + (hl - playa) * sstep(0.035, 0.12, f);
    var rr = Math.abs(fb3(sx / 1500 + 8, sy / 1500 - 2, sz / 1500 + 5, 2, sd + 13)); rv = (1 - sstep(0, 0.05, rr)) * sstep(0.1, 0.2, f) * sstep(RADIO_PLANO + 100, RADIO_PLANO + 450, hd);
    h += (AGUA_Y - 4.2 - h) * rv;
  }
  if (ice > 0) { var capH = AGUA_Y + 1.3 + fb3(sx / 260, sy / 260, sz / 260, 2, sd + 77) * 0.5; if (f <= 0) h = capH * ice + h * (1 - ice) + 0; else h = Math.max(h, 0) * (1 - ice) + (capH + Math.max(0, h * 0.25)) * ice; }
  MS.m1 = fb3(sx / 260, sy / 260, sz / 260, 3, sd + 21) * 0.5 + 0.5; MS.m2 = fb3(sx / 1200, sy / 1200, sz / 1200, 2, sd + 33) * 0.5 + 0.5; MS.nv = sstep(0.3, 0.55, fb3(ux * 3.5 + 21, uy * 3.5, uz * 3.5 - 9, 2, sd + 88));
  MS.h = h; MS.hl = hl; MS.cold = cold; MS.ice = ice; MS.riv = rv;
  MS.mD = (tipo === 'desierto') ? 1 : sstep(tipo === 'caos' ? 0.1 : 0.22, tipo === 'caos' ? 0.26 : 0.38, fb3(ux * 2.2 + 13, uy * 2.2 - 5, uz * 2.2 + 8, 2, sd + 41) + (alat > 0.35 && alat < 0.75 ? 0.12 : -0.08)) * sstep(RADIO_PLANO + 200, RADIO_PLANO + 900, hd) * (1 - cold);
  MS.mB = tipo === 'desierto' ? 0 : sstep(0.0, 0.22, fb3(ux * 3 + 2, uy * 3 + 5, uz * 3 - 3, 2, sd + 51) + 0.1 - cold * 0.4) * sstep(RADIO_PLANO + 300, RADIO_PLANO + 1000, hd) * (1 - cold * 0.7);
  return h;
}

  var TILE = MUN.TILE, TN = 32, TN1 = 10, TJ0 = -12, TJ1 = 11, TERG = null, TMAT = null, tilesDat = {}, tilesGeo1 = {}, tilesMesh = {}, tileCnt = 0, ptI = 1e9, ptJ = 1e9, TIPO = '', TCC = null, idxC = {}, aguaT = 0;
  function tileDatos(ti, tj) { var k = ti + ',' + tj, d = tilesDat[k]; if (d) return d; d = construirTile(ti, tj, TN); tilesDat[k] = d; tileCnt++; return d; }
  function hT(x, z) {   // altura del suelo, interpolada igual que la malla (así los pies no se hunden)
    if (!TER) return 0; x = wrapX(x); var tj = Math.floor(z / TILE); if (tj < TJ0 || tj > TJ1) return AGUA_Y + 1.3;
    var ti = Math.floor((x + MUN.W / 2) / TILE), d = tileDatos(ti, tj), st = TILE / TN, lx = (x - (ti * TILE - MUN.W / 2)) / st, lz = (z - tj * TILE) / st, i = lx | 0, j = lz | 0, fu, fv, W1 = TN + 1, H = d.H;
    if (i > TN - 1) i = TN - 1; if (j > TN - 1) j = TN - 1; fu = lx - i; fv = lz - j;
    var a = H[j * W1 + i], b = H[j * W1 + i + 1], c = H[(j + 1) * W1 + i], dd = H[(j + 1) * W1 + i + 1];
    return fu + fv <= 1 ? a + (b - a) * fu + (c - a) * fv : dd + (c - dd) * (1 - fu) + (b - dd) * (1 - fv);
  }
  function hTc(x, z) {   // como hT pero NUNCA construye tiles: lo que no está en memoria cuenta como fondo profundo (lo usa el mapa de profundidad del agua)
    if (!TER) return 0; x = wrapX(x); var tj = Math.floor(z / TILE); if (tj < TJ0 || tj > TJ1) return AGUA_Y + 1.3;
    var ti = Math.floor((x + MUN.W / 2) / TILE), d = tilesDat[ti + ',' + tj]; if (!d) return AGUA_Y - 30;
    var st = TILE / TN, lx = (x - (ti * TILE - MUN.W / 2)) / st, lz = (z - tj * TILE) / st, i = lx | 0, j = lz | 0, fu, fv, W1 = TN + 1, H = d.H;
    if (i > TN - 1) i = TN - 1; if (j > TN - 1) j = TN - 1; fu = lx - i; fv = lz - j;
    var a = H[j * W1 + i], b = H[j * W1 + i + 1], c = H[(j + 1) * W1 + i], dd = H[(j + 1) * W1 + i + 1];
    return fu + fv <= 1 ? a + (b - a) * fu + (c - a) * fv : dd + (c - dd) * (1 - fu) + (b - dd) * (1 - fv);
  }
  /* bioma en (x,z): 0 pasto · 1 desierto · 2 bosque · 3 roca · 4 playa · 5 agua · 6 nieve/hielo */
  function bioAt(x, z) {
    if (!TER) return 0; x = wrapX(x); var tj = Math.floor(z / TILE); if (tj < TJ0 || tj > TJ1) return 6;
    var ti = Math.floor((x + MUN.W / 2) / TILE), d = tileDatos(ti, tj), st = TILE / TN, i = Math.round((x - (ti * TILE - MUN.W / 2)) / st), j = Math.round((z - tj * TILE) / st); return d.B[j * (TN + 1) + i];
  }
  var PALETA = {
    tierra: { c1: '#4a8a38', c2: '#69a545', seco: '#8c9a48', tierra: '#7d5f3c', roca: '#7d7c74', arena: '#d6c68c', nieve: '#f4f7fb', bosque: '#2f5f2c', hielo: '#d9ebf7', tundra: '#8a9684' },
    caos: { c1: '#8d8a3c', c2: '#a89c44', seco: '#b29a50', tierra: '#8a6a3a', roca: '#716850', arena: '#dccb8a', nieve: '#f3ecc8', bosque: '#566226', hielo: '#e4eef0', tundra: '#9a9468' },
    desierto: { c1: '#d9b676', c2: '#e8cb8d', seco: '#cfa764', tierra: '#c4975a', roca: '#a8734a', arena: '#ecd49a', nieve: '#e9dcc0', bosque: '#6a8a3a', hielo: '#e9dcc0', tundra: '#c9ae78' }
  };
  function construirTile(ti, tj, N) {
    var step = TILE / N, W1 = N + 1, G = N + 3, x0 = ti * TILE - MUN.W / 2, z0 = tj * TILE, tipo = TIPO, P = PERFIL[tipo] || PERFIL.tierra, a, b, k, n1 = W1 * W1;
    var Hh = new Float32Array(G * G), fCold = new Float32Array(n1), fIce = new Float32Array(n1), fD = new Float32Array(n1), fB = new Float32Array(n1), fM1 = new Float32Array(n1), fM2 = new Float32Array(n1), fNv = new Float32Array(n1), fLat = new Float32Array(n1);
    for (b = 0; b < G; b++) for (a = 0; a < G; a++) {
      muestra(x0 + (a - 1) * step, z0 + (b - 1) * step, tipo); Hh[b * G + a] = MS.h;
      if (a >= 1 && b >= 1 && a <= N + 1 && b <= N + 1) { k = (b - 1) * W1 + (a - 1); fCold[k] = MS.cold; fIce[k] = MS.ice; fD[k] = MS.mD; fB[k] = MS.mB; fM1[k] = MS.m1; fM2[k] = MS.m2; fNv[k] = MS.nv; fLat[k] = MS.f; }
    }
    var nS = 4 * W1, nT = n1 + nS, pos = new Float32Array(nT * 3), nor = new Float32Array(nT * 3), col = new Float32Array(nT * 3), uv = new Float32Array(nT * 2), H = new Float32Array(n1), B = new Uint8Array(n1), mw = new Float32Array(nT * 4), ms = new Float32Array(nT), wr, wsd, wdt, wsn, rem;
    var cc = TCC, tmp = cc.tmp, u0 = ((x0 / 12) % 1 + 1) % 1, v0 = ((z0 / 12) % 1 + 1) % 1, ia, ib, h, hx, hz, sl, nl, ci, snowH, sn, bio, cold, ice, mD, mB, m1, m2;
    for (ib = 0; ib < W1; ib++) for (ia = 0; ia < W1; ia++) {
      k = ib * W1 + ia; var q = (ib + 1) * G + ia + 1; h = Hh[q]; hx = (Hh[q - 1] - Hh[q + 1]) / (2 * step); hz = (Hh[q - G] - Hh[q + G]) / (2 * step); sl = Math.sqrt(hx * hx + hz * hz); nl = Math.sqrt(hx * hx + 1 + hz * hz);
      cold = fCold[k]; ice = fIce[k]; mD = fD[k]; mB = fB[k]; m1 = fM1[k]; m2 = fM2[k]; H[k] = h;
      tmp.copy(cc.c1).lerp(cc.c2, m1); tmp.lerp(cc.seco, sstep(0.55, 0.85, m2) * 0.8);
      tmp.lerp(cc.bosque, mB * 0.85 * (1 - mD));
      tmp.lerp(cc.tierra, sstep(0.3, 0.55, m1 * 0.6 + sl * 2.2) * 0.5 * (1 - mB * 0.6));
      if (mD > 0) { tmp.lerp(cc.arena, mD * 0.9); tmp.lerp(cc.seco, sstep(0.45, 0.8, m1) * mD * 0.35); }
      tmp.lerp(cc.roca, sstep(0.28, 0.55, sl) * 0.95 + sstep(95, 190, h) * 0.5);
      snowH = 260 - 230 * cold - 200 * fNv[k] * (P.polar ? 1 : 0); sn = h > 0 ? sstep(0, 70, h - snowH) * (1 - sstep(0.45, 0.8, sl)) : 0;
      tmp.lerp(cc.tundra, sstep(0.35, 0.8, cold) * 0.8 * (h > AGUA_Y ? 1 : 0)); tmp.lerp(cc.nieve, sn);
      if (h < AGUA_Y + 4.5) tmp.lerp(cc.arena, (1 - sstep(AGUA_Y + 0.5, AGUA_Y + 4.5, h)) * 0.95 * (1 - cold));   // playa y orilla
      if (h < AGUA_Y) { tmp.lerp(cc.arena, 0.6); tmp.lerp(cc.fondo, sstep(1.5, 45, AGUA_Y - h)); }   // fondo del mar
      tmp.lerp(cc.hielo, ice);
      bio = ice > 0.5 ? 6 : h < AGUA_Y + 0.6 ? 5 : (sn > 0.6 || cold > 0.85) ? 6 : (sl > 0.45 || h > 110) ? 3 : mD > 0.5 ? 1 : (mB > 0.5 && sl < 0.3) ? 2 : 0; B[k] = bio;
      wsn = Math.min(1, Math.max(sn, ice)); rem = 1 - wsn;   // material del suelo en este punto: roca > arena > tierra > césped (suman 1); la nieve va aparte
      wr = Math.min(rem, Math.min(1, sstep(0.28, 0.55, sl) * 0.95 + sstep(95, 190, h) * 0.5)); rem -= wr;
      wsd = Math.min(rem, Math.max(0, Math.min(1, mD * 0.9 + (h < AGUA_Y + 4.5 ? (1 - sstep(AGUA_Y + 0.5, AGUA_Y + 4.5, h)) * 0.95 * (1 - cold) : 0) + (h < AGUA_Y ? 0.6 : 0)))); rem -= wsd;
      wdt = Math.min(rem, Math.min(1, sstep(0.3, 0.55, m1 * 0.6 + sl * 2.2) * 0.5 * (1 - mB * 0.6) + sstep(0.35, 0.8, cold) * 0.8)); rem -= wdt;
      mw[k * 4] = rem; mw[k * 4 + 1] = wdt; mw[k * 4 + 2] = wsd; mw[k * 4 + 3] = wr; ms[k] = wsn;
      pos[k * 3] = ia * step; pos[k * 3 + 1] = h; pos[k * 3 + 2] = ib * step; nor[k * 3] = hx / nl; nor[k * 3 + 1] = 1 / nl; nor[k * 3 + 2] = hz / nl;
      col[k * 3] = tmp.r; col[k * 3 + 1] = tmp.g; col[k * 3 + 2] = tmp.b; uv[k * 2] = u0 + ia * step / 12; uv[k * 2 + 1] = v0 + ib * step / 12;
    }
    var si = n1, e, t2;   // faldones: cubren las rendijas entre tiles de distinta resolución
    for (e = 0; e < 4; e++) for (t2 = 0; t2 < W1; t2++) {
      k = e === 0 ? t2 : e === 1 ? N * W1 + t2 : e === 2 ? t2 * W1 : t2 * W1 + N;
      pos[si * 3] = pos[k * 3]; pos[si * 3 + 1] = pos[k * 3 + 1] - 12; pos[si * 3 + 2] = pos[k * 3 + 2]; nor[si * 3] = nor[k * 3]; nor[si * 3 + 1] = nor[k * 3 + 1]; nor[si * 3 + 2] = nor[k * 3 + 2];
      col[si * 3] = col[k * 3]; col[si * 3 + 1] = col[k * 3 + 1]; col[si * 3 + 2] = col[k * 3 + 2]; uv[si * 2] = uv[k * 2]; uv[si * 2 + 1] = uv[k * 2 + 1]; mw[si * 4] = mw[k * 4]; mw[si * 4 + 1] = mw[k * 4 + 1]; mw[si * 4 + 2] = mw[k * 4 + 2]; mw[si * 4 + 3] = mw[k * 4 + 3]; ms[si] = ms[k]; si++;
    }
    var idx = idxC[N]; if (!idx) {
      idx = new Uint16Array(N * N * 6 + 4 * N * 6); var q2 = 0, ja, jb, A, Bq, C, D;
      for (jb = 0; jb < N; jb++) for (ja = 0; ja < N; ja++) { A = jb * W1 + ja; Bq = A + 1; C = A + W1; D = C + 1; idx[q2++] = A; idx[q2++] = C; idx[q2++] = Bq; idx[q2++] = Bq; idx[q2++] = C; idx[q2++] = D; }
      for (e = 0; e < 4; e++) for (t2 = 0; t2 < N; t2++) {
        var e0 = e === 0 ? t2 : e === 1 ? N * W1 + t2 : e === 2 ? t2 * W1 : t2 * W1 + N, e1 = e0 + (e < 2 ? 1 : W1), s0 = n1 + e * W1 + t2, s1 = s0 + 1;
        idx[q2++] = e0; idx[q2++] = s0; idx[q2++] = e1; idx[q2++] = e1; idx[q2++] = s0; idx[q2++] = s1;
      }
      idxC[N] = idx;
    }
    var geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); geo.setAttribute('color', new THREE.BufferAttribute(col, 3)); geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); geo.setAttribute('aW', new THREE.BufferAttribute(mw, 4)); geo.setAttribute('aS', new THREE.BufferAttribute(ms, 1));
    geo.setIndex(new THREE.BufferAttribute(idx, 1)); geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(TILE / 2, 0, TILE / 2), TILE * 0.8); geo.boundingBox = null;
    return { geo: geo, H: H, B: B };
  }
  /* texturas del suelo (césped, tierra, arena, piedra, nieve): se mezclan según el material de cada punto y se multiplican sobre la paleta
     del planeta (textura ÷ su color medio), así el color general no cambia pero el suelo gana detalle. Mientras se fabrican valen 1 (neutro). */
  var TXU = null, TXN = ['cesped', 'tierra', 'arena', 'piedra', 'nieve'], TXL = ['tG', 'tD', 'tA', 'tR', 'tN'], TXA = ['aG', 'aD', 'aA', 'aR', 'aN'];
  function crearTXU() {
    if (TXU) return TXU; TXU = {}; var neutra = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1, THREE.RGBAFormat); neutra.needsUpdate = true;
    TXL.forEach(function (n, i) { TXU[n] = { value: neutra }; TXU[TXA[i]] = { value: new THREE.Vector3(1, 1, 1) }; }); TXU.neutra = neutra; return TXU;
  }
  function sincTexturas() {
    if (!TXU || !E.Texturas) return; TXN.forEach(function (n, i) { var m = E.Texturas.mapas[n]; if (m) { TXU[TXL[i]].value = m.tex; TXU[TXA[i]].value.set(m.avg[0], m.avg[1], m.avg[2]); } });
  }
  function materialTerreno() {
    var u = crearTXU(), m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0, map: texDetalle(), side: THREE.DoubleSide });
    m.onBeforeCompile = function (sh) {
      TXL.forEach(function (n, i) { sh.uniforms[n] = u[n]; sh.uniforms[TXA[i]] = u[TXA[i]]; });
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute vec4 aW; attribute float aS; varying vec4 vW4; varying float vS1; varying vec3 vWPs;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvW4 = aW; vS1 = aS; vWPs = (modelMatrix * vec4(position, 1.0)).xyz;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform sampler2D tG; uniform sampler2D tD; uniform sampler2D tA; uniform sampler2D tR; uniform sampler2D tN; uniform vec3 aG; uniform vec3 aD; uniform vec3 aA; uniform vec3 aR; uniform vec3 aN; varying vec4 vW4; varying float vS1; varying vec3 vWPs;')
        .replace('#include <color_fragment>', ['#include <color_fragment>',
          'vec2 wp = vWPs.xz;',
          'vec3 rt = texture2D(tG, wp / 5.0).rgb / aG * vW4.x + texture2D(tD, wp / 4.0).rgb / aD * vW4.y + texture2D(tA, wp / 6.0).rgb / aA * vW4.z + texture2D(tR, wp / 8.0 + vec2(0.31, 0.17)).rgb / aR * vW4.w;',
          'rt = mix(rt, texture2D(tN, wp / 5.0 + vec2(0.57, 0.23)).rgb / aN, vS1);',
          'rt = clamp(rt, 0.3, 2.0);',
          'float dT = smoothstep(150.0, 700.0, length(vViewPosition));',
          'diffuseColor.rgb *= mix(mix(vec3(1.0), rt, 0.9), vec3(1.0), dT);'].join('\n'));
    };
    return m;
  }
  function limpiarTerreno() {
    var k; for (k in tilesMesh) { if (TERG) TERG.remove(tilesMesh[k]); } tilesMesh = {};
    for (k in tilesDat) tilesDat[k].geo.dispose(); for (k in tilesGeo1) tilesGeo1[k].dispose(); tilesDat = {}; tilesGeo1 = {}; tileCnt = 0; ptI = ptJ = 1e9;
  }
  function podarTiles(pI, pJ) {
    var k, ps, di, dj; for (k in tilesDat) { ps = k.split(','); di = Math.abs(+ps[0] - pI); di = Math.min(di, MUN.NX - di); dj = Math.abs(+ps[1] - pJ); if (Math.max(di, dj) > 7) { tilesDat[k].geo.dispose(); delete tilesDat[k]; tileCnt--; } }
    for (k in tilesGeo1) { ps = k.split(','); di = Math.abs(+ps[0] - pI); di = Math.min(di, MUN.NX - di); dj = Math.abs(+ps[1] - pJ); if (Math.max(di, dj) > 7) { tilesGeo1[k].dispose(); delete tilesGeo1[k]; } }
  }
  function actualizarTerreno(cx, cz) {   // mantiene los tiles alrededor: alta resolución cerca, baja lejos (el mundo da la vuelta)
    if (!TER || !TERG) return; cx = wrapX(cx); var vi0 = Math.floor((cx + MUN.W / 2) / TILE), vj0 = Math.floor(cz / TILE); if (vi0 === ptI && vj0 === ptJ) return; ptI = vi0; ptJ = vj0;
    var need = {}, di, dj, vi, vj, lod, key, ti, tj, m, g, R1 = 5, k;
    for (dj = -R1; dj <= R1; dj++) for (di = -R1; di <= R1; di++) {
      vi = vi0 + di; vj = vj0 + dj; if (vj < TJ0 || vj > TJ1) continue; lod = (Math.abs(di) <= 1 && Math.abs(dj) <= 1) ? 0 : 1; key = vi + ',' + vj + ',' + lod; need[key] = 1; if (tilesMesh[key]) continue;
      ti = ((vi % MUN.NX) + MUN.NX) % MUN.NX; tj = vj;
      if (lod === 0) g = tileDatos(ti, tj).geo; else { var k1 = ti + ',' + tj; g = tilesGeo1[k1] || (tilesGeo1[k1] = construirTile(ti, tj, TN1).geo); }
      m = new THREE.Mesh(g, TMAT); m.position.set(vi * TILE - MUN.W / 2, 0, vj * TILE); TERG.add(m); tilesMesh[key] = m;
    }
    for (k in tilesMesh) if (!need[k]) { TERG.remove(tilesMesh[k]); delete tilesMesh[k]; }
    if (tileCnt > 120) podarTiles(((vi0 % MUN.NX) + MUN.NX) % MUN.NX, vj0);
  }
  /* Recorre sitios de bosque (rejilla irregular) alrededor de (cx, cz): cb({x, y, z, seed, escala}). paso = separación media en m, prob 0..1, rad = radio de búsqueda */
  function listarBosque(cb, paso, prob, cx, cz, rad) {
    if (!TER) return 0; paso = paso || 30; prob = prob == null ? 0.7 : prob; rad = rad || 1500; cx = cx == null ? px : cx; cz = cz == null ? pz : cz;
    var n = 0, gx, gz, x, z, g0x = Math.floor((cx - rad) / paso) * paso, g0z = Math.floor((cz - rad) / paso) * paso;
    for (gz = g0z; gz < cz + rad; gz += paso) for (gx = g0x; gx < cx + rad; gx += paso) {
      if (hash2(gx / paso, gz / paso, 77) > prob) continue; x = gx + hash2(gx, gz, 3) * paso; z = gz + hash2(gx, gz, 4) * paso;
      if ((x - cx) * (x - cx) + (z - cz) * (z - cz) > rad * rad || bioAt(x, z) !== 2) continue;
      cb({ x: x, y: hT(x, z), z: z, seed: hash2(gx, gz, 9), escala: 0.8 + hash2(gx, gz, 5) * 0.7 }); n++;
    }
    return n;
  }
  /* agua con olas de verdad: el oleaje se calcula en la GPU sobre un parche que sigue al jugador (mismas ondas en CPU para flotar sobre ellas) */
  var OLAS = [[0.80, 0.60, 0.045, 0.66, 0.30], [-0.55, 0.84, 0.08, 0.89, 0.18], [0.30, -0.95, 0.14, 1.17, 0.10], [-0.90, -0.40, 0.21, 1.43, 0.05]];
  function olaH(x, z, t) { var h = 0, i, o; for (i = 0; i < 4; i++) { o = OLAS[i]; h += o[4] * Math.sin((o[0] * x + o[1] * z) * o[2] + t * o[3]); } return h; }
  var aguaU = { uT: { value: 0 }, uPl: { value: null }, uSky: { value: null }, uDepth: { value: null }, uDInfo: { value: null }, uQ: { value: 2 } }, QA = { t: 0, n: 0, skip: 6 }, marFar = null, hieloP = null, hieloQ = null;
  /* mapa de profundidad del agua (256×256 alrededor del jugador): lo usa el agua para el color por fondo y la espuma de orilla */
  var DEP = { N: 256, SZ: 3200, data: null, stage: null, tex: null, sx: 0, sz: 0, row: 256, cx: 1e9, cz: 1e9, ncx: 0, ncz: 0 };
  function actualizarProfundidad(cx, cz, todo) {
    if (!DEP.tex) return; var N = DEP.N, cell = DEP.SZ / N, r, i, x, z, h, v, lim, k;
    if (DEP.row >= N) {
      if (Math.hypot(cx - DEP.cx, cz - DEP.cz) < 250 && DEP.cx !== 1e9) return;
      DEP.ncx = cx; DEP.ncz = cz; DEP.sx = Math.round((cx - DEP.SZ / 2) / cell) * cell; DEP.sz = Math.round((cz - DEP.SZ / 2) / cell) * cell; DEP.row = 0;
    }
    lim = todo ? N : Math.min(N, DEP.row + 16);
    for (r = DEP.row; r < lim; r++) for (i = 0; i < N; i++) {
      x = DEP.sx + (i + 0.5) * cell; z = DEP.sz + (r + 0.5) * cell; h = hTc(x, z); v = (AGUA_Y - h + 4) / 32; DEP.stage[r * N + i] = (v < 0 ? 0 : v > 1 ? 255 : v * 255) | 0;
    }
    DEP.row = lim;
    if (DEP.row >= N) { DEP.data.set(DEP.stage); DEP.tex.needsUpdate = true; aguaU.uDInfo.value.set(DEP.sx, DEP.sz, DEP.SZ); DEP.cx = DEP.ncx; DEP.cz = DEP.ncz; }
  }
  function crearAgua() {
    var SZ = 3200, NG = 160, i, j, pos = [], idx = [], nm = NG + 1, k, glsl = '';
    aguaU.uPl.value = new THREE.Vector2(); aguaU.uSky.value = new THREE.Color(0x8cc4f2); aguaU.uDInfo.value = new THREE.Vector3(0, 0, DEP.SZ);
    DEP.data = new Uint8Array(DEP.N * DEP.N).fill(255); DEP.stage = new Uint8Array(DEP.N * DEP.N); DEP.tex = new THREE.DataTexture(DEP.data, DEP.N, DEP.N, THREE.LuminanceFormat, THREE.UnsignedByteType);
    DEP.tex.minFilter = DEP.tex.magFilter = THREE.LinearFilter; DEP.tex.generateMipmaps = false; DEP.tex.needsUpdate = true; aguaU.uDepth.value = DEP.tex; DEP.row = DEP.N; DEP.cx = 1e9;
    for (j = 0; j < nm; j++) for (i = 0; i < nm; i++) pos.push((i / NG - 0.5) * SZ, 0, (j / NG - 0.5) * SZ);
    for (j = 0; j < NG; j++) for (i = 0; i < NG; i++) { k = j * nm + i; idx.push(k, k + nm, k + 1, k + 1, k + nm, k + nm + 1); }
    var g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pos), 3)); g.setIndex(idx); g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), SZ);
    for (i = 0; i < 4; i++) { var o = OLAS[i]; glsl += ' d = vec2(' + o[0].toFixed(3) + ',' + o[1].toFixed(3) + '); ph = dot(d, p) * ' + o[2].toFixed(3) + ' + uT * ' + o[3].toFixed(3) + '; h += ' + o[4].toFixed(3) + ' * sin(ph); g += ' + (o[4] * o[2]).toFixed(5) + ' * cos(ph) * d;\n'; }
    var mt = new THREE.MeshStandardMaterial({ color: 0x2f7fc4, roughness: 0.1, metalness: 0.1, transparent: true, opacity: 0.9 });
    mt.onBeforeCompile = function (sh) {
      sh.uniforms.uT = aguaU.uT; sh.uniforms.uPl = aguaU.uPl; sh.uniforms.uSky = aguaU.uSky; sh.uniforms.uDepth = aguaU.uDepth; sh.uniforms.uDInfo = aguaU.uDInfo; sh.uniforms.uQ = aguaU.uQ;
      sh.vertexShader = sh.vertexShader.split('#include <common>').join('#include <common>\nuniform float uT;\nuniform vec2 uPl;\nvarying float vCrest;\nvarying vec2 vWP;\nvoid olas(vec2 p, out float h, out vec2 g) { h = 0.0; g = vec2(0.0); vec2 d; float ph;\n' + glsl + '}')
        .split('#include <beginnormal_vertex>').join('vec4 wp0 = modelMatrix * vec4(position, 1.0); float fadeW = 1.0 - smoothstep(900.0, 1500.0, length(wp0.xz - uPl)); float wH; vec2 wG; olas(wp0.xz, wH, wG); wH *= fadeW; wG *= fadeW; vCrest = wH; vWP = wp0.xz;\nvec3 objectNormal = normalize(vec3(-wG.x, 1.0, -wG.y));\n#ifdef USE_TANGENT\nvec3 objectTangent = vec3( tangent.xyz );\n#endif')
        .split('#include <begin_vertex>').join('vec3 transformed = vec3( position ); transformed.y += wH;');
      var FR = [
        'uniform float uT;', 'uniform vec3 uSky;', 'uniform vec3 uDInfo;', 'uniform sampler2D uDepth;', 'uniform float uQ;', 'varying float vCrest;', 'varying vec2 vWP;',
        'float hsh(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }',
        'float vno(vec2 p) { vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(hsh(i), hsh(i + vec2(1.0, 0.0)), f.x), mix(hsh(i + vec2(0.0, 1.0)), hsh(i + vec2(1.0, 1.0)), f.x), f.y); }',
        'float profAgua() { vec2 uv = (vWP - uDInfo.xy) / uDInfo.z; if (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) return 30.0; return texture2D(uDepth, uv).r * 32.0 - 4.0; }'
      ].join('\n');
      var COL = [
        '#include <color_fragment>',
        'float dA = profAgua();',
        'vec3 wc = mix(vec3(0.30, 0.80, 0.76), diffuse * 0.62, smoothstep(0.3, 12.0, dA));',
        'wc = mix(wc, diffuse * vec3(0.20, 0.34, 0.50), smoothstep(14.0, 55.0, dA));',
        'diffuseColor.rgb = wc; diffuseColor.a = mix(0.42, 0.92, smoothstep(0.1, 5.0, dA));',
        'float foam = 0.0;',
        'if (uQ > 0.5 && dA < 3.0 && dA > -0.5) {',
        ' float th = 0.55 + 0.35 * sin(uT * 0.8 + vno(vWP * 0.05) * 6.0);',
        ' float bn = vno(vWP * 0.8 + vec2(uT * 0.15, -uT * 0.1)) * 0.6; if (uQ > 1.5) bn += vno(vWP * 2.3 - vec2(uT * 0.2)) * 0.5; else bn += 0.25;',
        ' float broken = smoothstep(0.30, 0.65, bn);',
        ' float fo = (1.0 - smoothstep(th - 0.4, th, dA)) * broken;',
        ' float fo2 = (1.0 - smoothstep(th + 1.0, th + 1.6, dA)) * smoothstep(th + 0.2, th + 0.7, dA) * broken * 0.55 * (0.5 + 0.5 * sin(dA * 5.0 - uT * 1.6));',
        ' foam = clamp(fo + fo2, 0.0, 1.0);',
        '}',
        'diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.96, 0.98, 1.0), foam); diffuseColor.a = max(diffuseColor.a, foam);',
        'diffuseColor.rgb += vec3(0.14, 0.18, 0.2) * smoothstep(0.18, 0.5, vCrest);'
      ].join('\n');
      var NRM = [
        '#include <normal_fragment_maps>',
        'float dF = 1.0 - smoothstep(120.0, 600.0, length(vViewPosition));',
        'if (uQ > 1.5 && dF > 0.0) {',
        'vec2 q = vWP;',
        'vec2 gd = vec2(cos(q.x * 0.9 + uT * 1.3) + cos(q.y * 1.7 - uT * 1.1 + q.x * 0.4) + cos((q.x + q.y) * 2.6 + uT * 2.1), cos(q.y * 1.1 - uT * 1.2) + cos(q.x * 2.1 + uT * 1.0 - q.y * 0.3) + cos((q.x - q.y) * 2.9 - uT * 1.8));',
        'normal = normalize(normal + vec3(gd.x, gd.y, 0.0) * 0.03 * dF);',
        '}'
      ].join('\n');
      var EMI = [
        '#include <emissivemap_fragment>',
        '{ vec3 vd = normalize(vViewPosition); float fr = pow(1.0 - clamp(dot(vd, normal), 0.0, 1.0), 3.0); totalEmissiveRadiance += uSky * (0.07 + 0.5 * fr); }'
      ].join('\n');
      sh.fragmentShader = sh.fragmentShader.split('#include <common>').join('#include <common>\n' + FR).split('#include <color_fragment>').join(COL).split('#include <normal_fragment_maps>').join(NRM).split('#include <emissivemap_fragment>').join(EMI);
    };
    mar = new THREE.Mesh(g, mt); mar.position.y = AGUA_Y; mar.frustumCulled = false; sc.add(mar);
    var HI = SZ / 2 - 100, HO = 40000, fp = [-HO, 0, -HO, HO, 0, -HO, HO, 0, HO, -HO, 0, HO, -HI, 0, -HI, HI, 0, -HI, HI, 0, HI, -HI, 0, HI];
    var fg = new THREE.BufferGeometry(); fg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(fp), 3)); fg.setIndex([0, 4, 1, 1, 4, 5, 1, 5, 2, 2, 5, 6, 2, 6, 3, 3, 6, 7, 3, 7, 0, 0, 7, 4]); fg.boundingSphere = new THREE.Sphere(new THREE.Vector3(), HO * 1.5);
    marFar = new THREE.Mesh(fg, mt); marFar.position.y = AGUA_Y - 0.3; marFar.frustumCulled = false; sc.add(marFar);
    var hm = new THREE.MeshStandardMaterial({ color: 0xd9ebf7, roughness: 0.85, metalness: 0 }), hg = new THREE.PlaneGeometry(80000, 40000);
    hieloP = new THREE.Mesh(hg, hm); hieloP.rotation.x = -PI / 2; hieloP.frustumCulled = false; sc.add(hieloP); hieloQ = new THREE.Mesh(hg, hm); hieloQ.rotation.x = -PI / 2; hieloQ.frustumCulled = false; sc.add(hieloQ);
  }
  function actualizarAgua(dt, cx, cz) {
    aguaT += dt; aguaU.uT.value = aguaT;
    if (QA.skip > 0) QA.skip -= dt; else if (dt < 0.5) { QA.t += dt; QA.n++; if (QA.t >= 3) { if (QA.t / QA.n > 1 / 36 && aguaU.uQ.value > 0) { aguaU.uQ.value--; QA.skip = 4; } QA.t = 0; QA.n = 0; } }   // si va lento, el agua baja sola de detalle (2 → 1 → 0)
    if (!mar) return; aguaU.uPl.value.set(cx, cz); actualizarProfundidad(cx, cz, false);
    var gx = Math.round(cx / 20) * 20, gz = Math.round(cz / 20) * 20; mar.position.set(gx, AGUA_Y, gz); marFar.position.set(gx, AGUA_Y - 0.3, gz);
    if (hieloP) { hieloP.position.set(cx, AGUA_Y + 1.3, MUN.ZMAX + 20000 + 150); hieloQ.position.set(cx, AGUA_Y + 1.3, -MUN.ZMAX - 20000 - 150); }
  }
  var nadando = false, aire = 100, nUp = false, nDown = false, nadoTilt = 0, bajoAgua = false, fogSave = null, bgSave = null;
  function visAgua(bajo) {
    if (bajo === bajoAgua || !sc) return; bajoAgua = bajo;
    if (bajo) { fogSave = sc.fog; bgSave = sc.background; sc.fog = new THREE.Fog(0x0a4a66, 1.5, 75); sc.background = new THREE.Color(0x0a4a66); }
    else { if (fogSave) sc.fog = fogSave; if (bgSave) sc.background = bgSave; }
  }
  var olasU = null, hierba = null, hierbaKey = '', bosques = null, hierbaU = { uT: { value: 0 } };
  function crearHierba(tipo) {
    var pal = PALETA[tipo] || PALETA.tierra, N = 14000, g = new THREE.BufferGeometry(), pos = [], cl = [], i, k, a, B = 5, hw, hh, bx, bz, dx, dz, curv, cb = new THREE.Color(0x3a5a22), ct = new THREE.Color(0xffffff);
    for (i = 0; i < B; i++) {   // mata de 5 hojas finas, curvadas y de distinto alto: base oscura → punta clara
      a = i / B * 6.283 + (i % 2) * 0.5; hh = 0.38 + (i % 3) * 0.16; hw = 0.045; bx = Math.cos(a) * 0.09; bz = Math.sin(a) * 0.09; dx = Math.cos(a + 1.2); dz = Math.sin(a + 1.2); curv = 0.12 + (i % 2) * 0.08;
      var nx = -dz, nz = dx;   // ancho de la hoja
      pos.push(bx - nx * hw, 0, bz - nz * hw, bx + nx * hw, 0, bz + nz * hw, bx + nx * hw * 0.55 + dx * curv * 0.45, hh * 0.55, bz + nz * hw * 0.55 + dz * curv * 0.45);
      pos.push(bx - nx * hw, 0, bz - nz * hw, bx + nx * hw * 0.55 + dx * curv * 0.45, hh * 0.55, bz + nz * hw * 0.55 + dz * curv * 0.45, bx - nx * hw * 0.55 + dx * curv * 0.45, hh * 0.55, bz - nz * hw * 0.55 + dz * curv * 0.45);
      pos.push(bx - nx * hw * 0.55 + dx * curv * 0.45, hh * 0.55, bz - nz * hw * 0.55 + dz * curv * 0.45, bx + nx * hw * 0.55 + dx * curv * 0.45, hh * 0.55, bz + nz * hw * 0.55 + dz * curv * 0.45, bx + dx * curv, hh, bz + dz * curv);
      cl.push(0.35, 0.45, 0.3, 0.35, 0.45, 0.3, 0.8, 0.85, 0.75, 0.35, 0.45, 0.3, 0.8, 0.85, 0.75, 0.8, 0.85, 0.75, 0.8, 0.85, 0.75, 0.8, 0.85, 0.75, 1, 1, 1);
    }
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pos), 3)); g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(cl), 3)); g.computeVertexNormals();
    var m = new THREE.MeshLambertMaterial({ side: THREE.DoubleSide, color: 0xffffff, vertexColors: true });
    m.onBeforeCompile = function (sh) { sh.uniforms.uT = hierbaU.uT; sh.vertexShader = 'uniform float uT;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n#ifdef USE_INSTANCING\n transformed.x += sin(uT * 1.7 + instanceMatrix[3].x * 0.35 + instanceMatrix[3].z * 0.23) * 0.1 * position.y / 0.5;\n transformed.z += cos(uT * 1.3 + instanceMatrix[3].z * 0.3) * 0.06 * position.y / 0.5;\n#endif'); };
    var im = new THREE.InstancedMesh(g, m, N); im.frustumCulled = false; im.count = 0; im._c1 = new THREE.Color(pal.c1).multiplyScalar(1.15); im._c2 = new THREE.Color(pal.c2).multiplyScalar(1.2); im._cs = new THREE.Color(pal.seco);
    im.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(N * 3), 3); sc.add(im); return im;
  }
  var hMat = null, hQ = null, hE = null, hV = null, hS = null;
  function actualizarHierba(t) {
    if (!hierba) return; hierba.visible = modoPie; hierbaU.uT.value = t; if (!modoPie || !TER) return;
    var key = colocadas.length + ':' + ((px / 10) | 0) + ':' + ((pz / 10) | 0); if (key === hierbaKey) return; hierbaKey = key;
    if (!hMat) { hMat = new THREE.Matrix4(); hQ = new THREE.Quaternion(); hE = new THREE.Euler(); hV = new THREE.Vector3(); hS = new THREE.Vector3(); }
    var C = 0.85, RAD = 27, ci = Math.round(px / C), cj = Math.round(pz / C), R2 = Math.ceil(RAD / C), n = 0, max = hierba.instanceMatrix.count, di, dj, x, z, r, bi, h, o, sk, c = new THREE.Color(), i, gi, gj, esc, bloq;
    for (dj = -R2; dj <= R2; dj++) for (di = -R2; di <= R2; di++) {
      if (n >= max - 2) break; gi = ci + di; gj = cj + dj; r = Math.hypot(gi * C - px, gj * C - pz); if (r > RAD) continue;
      for (sk = 0; sk < 2; sk++) {
        x = (gi + hash2(gi, gj, 11 + sk)) * C; z = (gj + hash2(gi, gj, 21 + sk)) * C; bi = bioAt(x, z); if (bi !== 0 && bi !== 2) continue;
        h = hT(x, z); if (h < AGUA_Y + 0.8) continue;
        bloq = false; for (i = 0; i < colocadas.length; i++) { o = colocadas[i]; if (Math.hypot(o.x - x, o.z - z) < (o.r || 6) + 2) { bloq = true; break; } } if (bloq) continue;
        esc = (0.85 + hash2(gi, gj, 31 + sk) * 0.9) * (1 - Math.pow(r / RAD, 3)); hE.set(0, hash2(gi, gj, 41 + sk) * 6.28, 0); hQ.setFromEuler(hE);
        hMat.compose(hV.set(x, h, z), hQ, hS.set(esc, esc * (0.8 + hash2(gi, gj, 51) * 0.6), esc)); hierba.setMatrixAt(n, hMat);
        c.copy(hierba._c1).lerp(hierba._c2, hash2(gi, gj, 61 + sk)); if (hash2(gi, gj, 71) > 0.8) c.lerp(hierba._cs, 0.7); c.multiplyScalar(bi === 2 ? 0.75 : 1);
        hierba.instanceColor.setXYZ(n, c.r, c.g, c.b); n++;
      }
    }
    hierba.count = n; hierba.instanceMatrix.needsUpdate = true; hierba.instanceColor.needsUpdate = true;
  }
  function texDetalle() {
    var c = document.createElement('canvas'); c.width = c.height = 256; var g = c.getContext('2d'), i; g.fillStyle = '#e8e8e8'; g.fillRect(0, 0, 256, 256);
    for (i = 0; i < 5200; i++) { var q = Math.random(); g.fillStyle = q < 0.5 ? 'rgba(0,0,0,0.10)' : q < 0.8 ? 'rgba(255,255,255,0.22)' : 'rgba(0,0,0,0.20)'; var s = 1 + Math.random() * 3; g.fillRect(Math.random() * 256, Math.random() * 256, s, s * (1 + Math.random() * 3)); }
    for (i = 0; i < 40; i++) { g.fillStyle = 'rgba(0,0,0,0.04)'; g.beginPath(); g.arc(Math.random() * 256, Math.random() * 256, 8 + Math.random() * 26, 0, 7); g.fill(); }
    var t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; if ('encoding' in t) t.encoding = THREE.sRGBEncoding; return t;
  }
  /* ===== CICLO DÍA / NOCHE =====
     Una vuelta completa dura CICLO_MS (30 min de día + 30 min de noche) y sigue el reloj real, así es igual en cada sesión.
     Sol y luna son astros reales: la luna se ilumina con la dirección del sol (creciente, llena, menguante), y cada 8 días de juego repite sus fases. */
  var CICLO_MS = 60 * 60 * 1000, FASES_LUNA = 8;
  var CIE = { g: null, sol: null, luna: null, e1: null, e2: null, bg: null, fog: null, dia: null, noche: null, cre: null, solC: null, tmp: null, s: null, m: null, ax: null, q: null, pj1: 0, uL: null };
  function crearCielo() {
    var R = 15000, i, N, p, c, a, z, r, sn, dpr = 1.5, g = new THREE.Group(), cv = document.createElement('canvas'), cx, gr, mk;
    try { if (E.renderer && E.renderer.getPixelRatio) dpr = Math.min(3, E.renderer.getPixelRatio()); } catch (e0) { }
    cv.width = cv.height = 128; cx = cv.getContext('2d'); gr = cx.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.1, 'rgba(255,252,240,1)'); gr.addColorStop(0.18, 'rgba(255,236,190,0.6)'); gr.addColorStop(0.5, 'rgba(255,200,120,0.12)'); gr.addColorStop(1, 'rgba(255,200,120,0)');
    cx.fillStyle = gr; cx.fillRect(0, 0, 128, 128);
    CIE.sol = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cv), transparent: true, depthWrite: false, fog: false, blending: THREE.AdditiveBlending })); CIE.sol.frustumCulled = false; g.add(CIE.sol);
    CIE.uL = { value: new THREE.Vector3(0, 1, 0) }; CIE.uA = { value: 1 };
    CIE.luna = new THREE.Mesh(new THREE.SphereGeometry(1, 28, 18), new THREE.ShaderMaterial({ transparent: true, depthWrite: false, uniforms: { uL: CIE.uL, uA: CIE.uA },
      vertexShader: 'varying vec3 vN; varying vec3 vP; void main() { vN = normalize(mat3(modelMatrix) * normal); vP = normal; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: ['uniform vec3 uL; uniform float uA; varying vec3 vN; varying vec3 vP;',
        'float hh(vec3 p) { return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }',
        'float nn(vec3 p) { vec3 i = floor(p); vec3 f = fract(p); f = f * f * (3.0 - 2.0 * f);',
        ' return mix(mix(mix(hh(i), hh(i + vec3(1.0, 0.0, 0.0)), f.x), mix(hh(i + vec3(0.0, 1.0, 0.0)), hh(i + vec3(1.0, 1.0, 0.0)), f.x), f.y), mix(mix(hh(i + vec3(0.0, 0.0, 1.0)), hh(i + vec3(1.0, 0.0, 1.0)), f.x), mix(hh(i + vec3(0.0, 1.0, 1.0)), hh(i + vec3(1.0, 1.0, 1.0)), f.x), f.y), f.z); }',
        'void main() { float m = nn(vP * 2.2) * 0.6 + nn(vP * 6.0) * 0.4; vec3 alb = mix(vec3(0.60, 0.62, 0.68), vec3(0.96, 0.96, 0.92), smoothstep(0.35, 0.7, m));',
        ' float l = smoothstep(-0.04, 0.12, dot(normalize(vN), uL)); gl_FragColor = vec4(alb * (0.03 + 1.05 * l), uA); }'].join('\n') }));
    CIE.luna.frustumCulled = false; CIE.luna.scale.setScalar(R * 0.032); g.add(CIE.luna);
    mk = function (n, size, op) {   // estrellas: puntos sobre una esfera lejana
      p = new Float32Array(n * 3); c = new Float32Array(n * 3);
      for (i = 0; i < n; i++) { z = Math.random() * 2 - 1; a = Math.random() * 6.2832; sn = Math.sqrt(1 - z * z); p[i * 3] = sn * Math.cos(a) * 19000; p[i * 3 + 1] = z * 19000; p[i * 3 + 2] = sn * Math.sin(a) * 19000; r = Math.random(); c[i * 3] = 0.8 + 0.2 * r; c[i * 3 + 1] = 0.85 + 0.1 * r; c[i * 3 + 2] = 1 - 0.15 * r; }
      var geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(p, 3)); geo.setAttribute('color', new THREE.BufferAttribute(c, 3));
      var pt = new THREE.Points(geo, new THREE.PointsMaterial({ size: size * dpr, sizeAttenuation: false, vertexColors: true, transparent: true, opacity: 0, depthWrite: false, fog: false })); pt.frustumCulled = false; return pt;
    };
    CIE.e1 = mk(1500, 1.5); CIE.e2 = mk(140, 2.8); CIE.estr = new THREE.Group(); CIE.estr.add(CIE.e1, CIE.e2); g.add(CIE.estr);
    CIE.g = g; sc.add(g); CIE.dia = new THREE.Color(0x8cc4f2); CIE.noche = new THREE.Color(0x050a1f); CIE.cre = new THREE.Color(0xf2784b); CIE.solC = new THREE.Color(0xfff1e0); CIE.tmp = new THREE.Color();
    CIE.s = new THREE.Vector3(); CIE.m = new THREE.Vector3(); CIE.ax = new THREE.Vector3(-0.3, 0, 1).normalize(); CIE.q = new THREE.Quaternion(); CIE.hn = new THREE.Color(0x35467a); CIE.hd = new THREE.Color(0xaac4e6); CIE.naranja = new THREE.Color(0xff7a3a);
  }
  function actualizarCielo(dt, t) {
    if (!CIE.g || !cam) return; var d = Date.now() / CICLO_MS, a = (d - Math.floor(d)) * PI2, am = a + PI + (d * PI2) / FASES_LUNA, s = CIE.s, m = CIE.m, e, dia, tw, noche, col = CIE.tmp, R = 15000, lit;
    s.set(Math.cos(a), Math.sin(a), 0.3).normalize(); m.set(Math.cos(am), Math.sin(am), -0.3).normalize(); e = s.y;
    dia = sstep(-0.08, 0.22, e); noche = 1 - dia; tw = Math.exp(-(e * e) / 0.025);
    CIE.g.position.copy(cam.position);
    CIE.sol.position.copy(s).multiplyScalar(R); CIE.sol.visible = e > -0.12; CIE.sol.scale.setScalar(R * 0.3 * (1 + 0.4 * (1 - sstep(0, 0.4, e)))); CIE.sol.material.color.copy(CIE.solC).lerp(CIE.naranja, 1 - sstep(0, 0.35, e));
    CIE.luna.position.copy(m).multiplyScalar(R); CIE.luna.visible = m.y > -0.1; CIE.uL.value.copy(s); CIE.uA.value = 0.3 + 0.7 * noche;
    CIE.estr.quaternion.setFromAxisAngle(CIE.ax, a);
    lit = sstep(0.02, -0.22, e); CIE.e1.material.opacity = lit * 0.95; CIE.e2.material.opacity = lit * (0.75 + 0.25 * Math.sin(t * 2.1));
    col.copy(CIE.noche).lerp(CIE.dia, dia).lerp(CIE.cre, tw * 0.5 * (0.35 + 0.65 * dia));
    if (bajoAgua) { col.setRGB(0.04, 0.29, 0.4).multiplyScalar(0.2 + 0.8 * dia); if (sc.background && sc.background.isColor) sc.background.copy(col); if (sc.fog) sc.fog.color.copy(col); }
    else { if (CIE.bg) CIE.bg.copy(col); if (CIE.fog) CIE.fog.color.copy(col); }
    if (aguaU.uSky.value) aguaU.uSky.value.copy(col);
    luzSol.position.copy(s).multiplyScalar(100); luzSol.intensity = 2.3 * sstep(-0.05, 0.3, e); luzSol.color.copy(CIE.solC).lerp(CIE.naranja, (1 - sstep(0, 0.3, e)) * 0.6);
    luzLuna.position.copy(m).multiplyScalar(100); luzLuna.intensity = (0.12 + 0.3 * (1 - s.dot(m)) * 0.5) * noche * sstep(-0.05, 0.15, m.y);
    luzHemi.intensity = 0.3 + 0.45 * dia; luzHemi.color.copy(CIE.hn).lerp(CIE.hd, dia);
  }
  function ambientar(tipo) {   // suelo, mar y paisaje lejano de cada planeta
    var pj = PAISAJE[tipo] || PAISAJE.rocoso, agua = pj[3] != null, R = agua ? RADIO_BASE + 260 : 30000, i, j;
    limpiarTerreno(); TER = null;
    if (PERFIL[tipo]) {   // planetas aterrizables: planeta redondo (tiles de terreno que dan la vuelta al mundo)
      suelo.visible = false; TIPO = tipo; var pp = PALETA[tipo] || PALETA.tierra; TCC = { tmp: new THREE.Color() }; ['c1', 'c2', 'seco', 'tierra', 'roca', 'arena', 'nieve', 'bosque', 'hielo', 'tundra'].forEach(function (n) { TCC[n] = new THREE.Color(pp[n]); }); TCC.fondo = new THREE.Color('#12384c');
      if (TMAT) { if (TMAT.map) TMAT.map.dispose(); TMAT.dispose(); } TMAT = materialTerreno(); try { if (E.Texturas) { E.Texturas.alCambiar = sincTexturas; E.Texturas.iniciar(THREE); sincTexturas(); } } catch (et) { if (global.console) console.error(et); }
      if (!TERG) { TERG = new THREE.Group(); sc.add(TERG); } TERG.visible = true; TER = { tipo: tipo }; actualizarTerreno(0, 160); DEP.row = DEP.N; DEP.cx = 1e9; if (DEP.tex) actualizarProfundidad(0, 160, true);
    } else {
      if (TERG) TERG.visible = false; suelo.visible = true; suelo.geometry.dispose(); suelo.rotation.x = -PI / 2; suelo.geometry = new THREE.CircleGeometry(R, 96); suelo.material.vertexColors = false; suelo.material.color.setHex(0xffffff);
      var tx = texSuelo(pj[0], pj[2]); tx.repeat.set(730 * R / 30000, 730 * R / 30000); suelo.material.map = tx; suelo.material.needsUpdate = true;
    }
    sc.background = new THREE.Color(pj[1]); sc.fog = PERFIL[tipo] ? new THREE.Fog(pj[1], 1500, 3900) : agua ? new THREE.Fog(pj[1], 4500, 24000) : new THREE.Fog(pj[1], 1800, 9500); luzSol.color.setHex(pj[4] || 0xfff1e0); CIE.bg = sc.background; CIE.fog = sc.fog; CIE.dia.setHex(pj[1]); CIE.solC.setHex(pj[4] || 0xfff1e0); CIE.pj1 = pj[1];
    if (!mar) {
      crearAgua();
      orilla = new THREE.Mesh(new THREE.RingGeometry(RADIO_BASE + 200, RADIO_BASE + 262, 96), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.35, side: THREE.DoubleSide })); orilla.rotation.x = -PI / 2; orilla.position.y = -0.2; sc.add(orilla);
      deco = new THREE.Group(); sc.add(deco);
    }
    mar.visible = marFar.visible = agua; hieloP.visible = hieloQ.visible = !!PERFIL[tipo] && tipo !== 'desierto'; orilla.visible = false; if (agua) { mar.material.color.setHex(pj[3]); aguaU.uSky.value.setHex(pj[1]); }
    for (i = deco.children.length - 1; i >= 0; i--) { var ch = deco.children[i]; deco.remove(ch); ch.traverse(function (m) { if (m.geometry) m.geometry.dispose(); }); }
    if (hierba) { sc.remove(hierba); hierba.geometry.dispose(); hierba = null; } hierbaKey = '';
    if (!bosques) { bosques = new THREE.Group(); sc.add(bosques); } while (bosques.children.length) bosques.remove(bosques.children[0]);
    if (PERFIL[tipo] && tipo !== 'desierto') hierba = crearHierba(tipo);
    E.Suelo = { altura: hT, bioma: bioAt, bosque: listarBosque, tipo: tipo, grupo: bosques, agua: AGUA_Y, profundidad: function (x, z) { return Math.max(0, AGUA_Y - hT(x, z)); }, jugador: function () { return { x: px, y: pyF, z: pz, nadando: nadando, aire: aire }; } };
    try { if (E.Arboles && E.Arboles.poblar) E.Arboles.poblar(E.Suelo, sc, tipo); } catch (eb) { if (global.console) console.error(eb); }
    if (!agua || PERFIL[tipo]) return;
    var des = tipo === 'desierto', sd = 7, n = des ? 7 : 6;
    var cMonte = tipo === 'caos' ? 0x6f6648 : 0x6a6a62, cNieve = tipo === 'caos' ? 0xf3ecc8 : 0xf4f7fb, cIsla = des ? 0xdcbc80 : tipo === 'caos' ? 0x8d8a3c : 0x4e8f3c;
    var mm = new THREE.MeshStandardMaterial({ color: cMonte, roughness: 1, flatShading: true }), mn = new THREE.MeshStandardMaterial({ color: cNieve, roughness: 0.9, flatShading: true }), mi = new THREE.MeshStandardMaterial({ color: cIsla, roughness: 1 });
    for (i = 0; i < n; i++) {   // islas con un monte: lejos del área de juego, solo para el paisaje
      var ang = (i / n) * PI * 2 + rnd01(i + sd) * 0.6, dd = 10200 + rnd01(i * 3 + sd) * 6500, rd = 1300 + rnd01(i * 5 + sd) * 1700, isl = new THREE.Group();
      var disco = new THREE.Mesh(new THREE.CylinderGeometry(rd * 0.85, rd, 40, 20), mi); disco.position.y = -14; isl.add(disco);
      if (des) { var dn = new THREE.Mesh(new THREE.ConeGeometry(rd * 0.8, rd * 0.18, 12), mi); dn.position.y = rd * 0.09; isl.add(dn); if (i % 3 === 0) { var mesa = new THREE.Mesh(new THREE.CylinderGeometry(rd * 0.25, rd * 0.35, rd * 0.5, 8), mm); mesa.position.y = rd * 0.25; isl.add(mesa); } }
      else { var hm = rd * (0.55 + rnd01(i * 7 + sd) * 0.5), mo = new THREE.Mesh(new THREE.ConeGeometry(rd * 0.62, hm, 8), mm); mo.position.y = hm / 2; isl.add(mo); var ns = new THREE.Mesh(new THREE.ConeGeometry(rd * 0.62 * 0.36, hm * 0.36, 8), mn); ns.position.y = hm * 0.82; isl.add(ns);
        var co = new THREE.Mesh(new THREE.SphereGeometry(rd * 0.5, 12, 6), mi); co.scale.set(1.2, 0.22, 1); co.position.set(rd * 0.3, 8, -rd * 0.2); isl.add(co); }
      isl.position.set(Math.cos(ang) * dd, 0, Math.sin(ang) * dd); isl.rotation.y = rnd01(i + 40) * 6; deco.add(isl);
    }
  }
  function toast(t, s) { if (!ui) return; ui.toast.textContent = t; ui.toast.style.opacity = 1; tToast = s || 1.5; }

  /* ---- estructuras ---- */
  function itemDe(id) { for (var i = 0; i < CATALOGO.length; i++) if (CATALOGO[i].id === id) return CATALOGO[i]; return null; }
  function asegurar(item, ok) {
    function listo() { return typeof global[item.fn] === 'function' && (!item.req || typeof global[item.req] === 'function'); }
    if (listo()) return ok(true);
    cargando = item.nombre; if (ui) ui.est.textContent = 'Descargando ' + item.nombre + '…';
    var arch = [].concat(item.archivo), k = 0;
    (function sig() {
      if (k >= arch.length) { cargando = ''; ok(listo()); return; }
      var a = arch[k++]; cargarScript(CONFIG.rutaEdificios + 'base/' + a, sig, function () { cargando = ''; ok(false); });
    })();
  }
  function instanciar(item) {   // modelo en metros, apoyado en el suelo, con su radio de huella
    var api = null; try { api = global[item.fn](THREE, { accent: jug.acento }); } catch (e) { if (global.console) console.error(e); }
    if (!api || !api.group) return null;
    if (/^pista/.test(item.id) && api.demo === true && typeof api.setState === 'function') { try { api.setState('working'); } catch (e) { } }   // sin nave de demostración aterrizando
    var esc4 = item.esc || 4, w = new THREE.Group(); if (item.escY) w.scale.set(esc4, item.escY, esc4); else w.scale.setScalar(esc4); w.add(api.group); w.updateMatrixWorld(true);
    var b = new THREE.Box3().setFromObject(w), s = b.getSize(new THREE.Vector3()), r = 0.5 * Math.sqrt(s.x * s.x + s.z * s.z) * 0.8;
    if (api.footprint) r = 0.5 * esc4 * Math.max(api.footprint.w, api.footprint.d);   // huella en unidades de 4 m: radio = mitad del lado
    if (!isFinite(r) || r <= 0) r = 40;
    if (item.defensa) r = (item.defensa === 'torretaf' ? 1.2 : 3.6) * (item.esc || 1);
    var hw = 0.5 * s.x, hd = 0.5 * s.z;   // media huella REAL (ejes del modelo): rectángulo, no círculo
    if (api.footprint) { hw = 0.5 * esc4 * api.footprint.w; hd = 0.5 * esc4 * api.footprint.d; }
    if (item.defensa === 'muro' || item.defensa === 'porton') { hw = 3.5 * (item.esc || 1); hd = 1.1 * (item.esc || 1); } else if (item.defensa) { hw = hd = r; }
    api.group.position.y = 0;
    var ed = null, inr = 0, topB = 0;
    if (item.base && api.edges) {   // aristas de la base ya a escala del juego, para encajar bases y muros
      ed = api.edges.map(function (q) { return { x: q.x * esc4, z: q.z * esc4, ang: q.angle, len: q.length * esc4 }; });
      var LD = item.lado || 10; inr = item.base === 'c' ? LD / 2 : LD / Math.sqrt(3) / 2; topB = (api.topY || 0.8) * item.escY; r = item.base === 'c' ? LD * 0.7071 : LD / Math.sqrt(3); hw = hd = item.base === 'c' ? LD / 2 : LD * 0.42;
    }
    if (!item.defensa && !item.base) {   // apoya el edificio por su BASE (las mallas anchas de abajo), ignorando fosos, cables o antenas que se salen
      try {
        var tot = new THREE.Box3().setFromObject(w), foot = Math.max(tot.max.x - tot.min.x, tot.max.z - tot.min.z), ymin = Infinity, bb = new THREE.Box3();
        w.traverse(function (m) { if (!m.isMesh || !m.geometry) return; bb.setFromObject(m); if (!isFinite(bb.min.y)) return; if (Math.max(bb.max.x - bb.min.x, bb.max.z - bb.min.z) >= foot * 0.3 && bb.min.y < ymin) ymin = bb.min.y; });
        if (isFinite(ymin) && Math.abs(ymin) > 0.02) api.group.position.y = -ymin / esc4;
      } catch (eg) { api.group.position.y = 0; }
    }
    var raiz = new THREE.Group(); raiz.add(w); sc.add(raiz);
    return { item: item, api: api, g: raiz, r: r, hw: hw, hd: hd, ed: ed, inr: inr, top: topB };
  }
  /* ---- obra por partes: la estructura aparece pieza a pieza (cimientos y piezas grandes primero, detalles al final). Solo edificios y torreta antigua. ---- */
  function prepararObra(o) {
    if (o.item.defensa || !o.g) return; var lst = [], bb = new THREE.Box3(), sz = new THREE.Vector3(), i, mx = 1e-6, y0 = Infinity, y1 = -Infinity, fl = 0;
    o.g.scale.y = 1; o.g.updateMatrixWorld(true);
    o.g.traverse(function (m) {
      if (!(m.isMesh || m.isPoints || m.isLine) || !m.visible) return; bb.setFromObject(m); if (!isFinite(bb.min.x) || !isFinite(bb.max.x)) return;
      bb.getSize(sz); var v = sz.x * sz.y * sz.z + 1e-6; if (v > mx) mx = v; if (bb.min.y < y0) y0 = bb.min.y; if (bb.max.y > y1) y1 = bb.max.y; fl = Math.max(fl, sz.x, sz.z);
      lst.push({ m: m, v: v, y: bb.min.y, d: Math.max(sz.x, sz.y, sz.z) });
    });
    var H = Math.max(1e-3, y1 - y0);
    lst.forEach(function (q, k) { q.k = (q.d < fl * 0.04 ? 1e6 : 0) + Math.min(5, Math.floor((q.y - y0) / H * 6)) * 1e3 - Math.min(999, q.v / mx * 999) + ((k * 7919) % 13) * 0.01; });
    lst.sort(function (a, b) { return a.k - b.k; });
    for (i = 0; i < lst.length; i++) lst[i].m.visible = false;
    o._ob = { lst: lst, n: 0 };
  }
  function avanceObra(o, pr) {
    var ob = o._ob; if (!ob) return; var t = Math.min(ob.lst.length, Math.max(1, Math.ceil(clamp(pr, 0, 1) * ob.lst.length)));
    while (ob.n < t) ob.lst[ob.n++].m.visible = true;
  }
  function terminarObra(o) { var ob = o._ob; if (!ob) return; for (var i = 0; i < ob.lst.length; i++) ob.lst[i].m.visible = true; o._ob = null; }
  /* ---- hangares: las naves entregadas a esta colonia se guardan en los hangares de pistas (pista circular, grande y pista-ciudad) ---- */
  var HANGARES = { pista1: 1, pista2: 1, ciudad: 1 }, enHangar = {}, hgT = 0;
  function navesColonia() { var c = (leer('colonias', {}) || {})[key]; return (c && c.naves) || []; }
  function capHangar(o) { var n = 0, b = (o.api && o.api.bays) || [], i; for (i = 0; i < b.length; i++) if (b[i].type === 'hangar') n++; return n; }
  function cabeEnPista(o, id) {   // solo naves pequeñas y medianas (lo que admite la pista)
    try { E.obtenerModelo(id); var md = medidas[id], ms = o.api.maxShip; return !!(md && ms && md.largo / 4 <= ms.length && md.ancho / 4 <= ms.width); } catch (e) { return false; }
  }
  function crearNaveHangar(id) {
    var r = E.crearModeloNuevo(id, jug.acento), md = medidas[id]; if (!r || !md) return null;
    var w = new THREE.Group(); w.scale.setScalar(r.n.m / 4); w.add(r.m.group); w.position.set(-md.centro.x / 4, -(md.centro.y - md.alto / 2) / 4, -md.centro.z / 4);
    var g = new THREE.Group(); g.add(w); g.userData = { length: md.largo / 4, width: md.ancho / 4, baseY: 0, hangarId: id };
    try { if (r.m.setAccent) r.m.setAccent(jug.acento); } catch (e) { }
    return g;
  }
  function sincronizarHangares() {
    if (!pl || cargando) return; var lst = navesColonia(), i, j, o, id, usados, cap;
    for (id in enHangar) if (colocadas.indexOf(enHangar[id].o) < 0 || lst.indexOf(id) < 0) delete enHangar[id];
    for (i = 0; i < lst.length; i++) {
      id = lst[i]; if (enHangar[id] || id === jug.nave) continue;
      for (j = 0; j < colocadas.length; j++) {
        o = colocadas[j]; if (!HANGARES[o.item.id] || o.fin || o.vida <= 0 || !o.api || !o.api.land || !o.api.service) continue;
        usados = 0; for (var k in enHangar) if (enHangar[k].o === o) usados++;
        cap = capHangar(o); if (usados >= cap || !cabeEnPista(o, id)) continue;
        var ship = crearNaveHangar(id); if (!ship) break;
        try { o.api.group.add(ship); o.api.land(ship, {}); o.api.service(ship, { repair: false, pilot: false }); enHangar[id] = { o: o, g: ship }; } catch (e) { if (global.console) console.error('Hangar', e); }
        break;
      }
    }
  }
  function chocaRect(ax, az, aa, ahw, ahd, bx, bz, ba, bhw, bhd) {   // dos rectángulos orientados (SAT)
    var A = [[Math.cos(aa), -Math.sin(aa)], [Math.sin(aa), Math.cos(aa)]], B = [[Math.cos(ba), -Math.sin(ba)], [Math.sin(ba), Math.cos(ba)]], dx = bx - ax, dz = bz - az, i, k, ej, pa, pb, d, L;
    var ejes = [A[0], A[1], B[0], B[1]];
    for (i = 0; i < 4; i++) {
      ej = ejes[i]; pa = ahw * Math.abs(A[0][0] * ej[0] + A[0][1] * ej[1]) + ahd * Math.abs(A[1][0] * ej[0] + A[1][1] * ej[1]);
      pb = bhw * Math.abs(B[0][0] * ej[0] + B[0][1] * ej[1]) + bhd * Math.abs(B[1][0] * ej[0] + B[1][1] * ej[1]);
      d = Math.abs(dx * ej[0] + dz * ej[1]); if (d > pa + pb) return false;
    }
    return true;
  }
  function valida(x, z, r, ignorar, rot, hw, hd, sobre) {
    var d = Math.sqrt(x * x + z * z), i, o;
    if (d + r > RADIO_PLANO || (naveBaja && Math.hypot(x - naveTx, z - naveTz) < pad + r)) return false;
    if (hw == null) { hw = hd = r; rot = 0; }
    for (i = 0; i < colocadas.length; i++) {
      o = colocadas[i]; if (o === ignorar || (sobre && o === sobre)) continue;
      if (o.g.position.y > 0.1 && !sobre) continue;
      if (Math.hypot(o.x - x, o.z - z) > o.r + r + 2) continue;   // lejos: ni se calcula
      if (chocaRect(x, z, rot || 0, hw + 0.5, hd + 0.5, o.x, o.z, o.rot || 0, o.hw != null ? o.hw : o.r, o.hd != null ? o.hd : o.r)) return false;
    }
    return true;
  }
  function buscarLibre(cx, cz) {   // sitio despejado más cercano a (cx, cz) donde cabe la nave
    var rad, k, n, a, x, z, i, o, ok;
    for (rad = 0; rad <= 4000; rad += 40) {
      n = rad ? Math.max(6, Math.round(rad / 25)) : 1;
      for (k = 0; k < n; k++) {
        a = k / n * 2 * PI; x = cx + Math.cos(a) * rad; z = cz + Math.sin(a) * rad;
        if (Math.hypot(x, z) + pad > RADIO_PLANO) continue; ok = true;
        for (i = 0; i < colocadas.length; i++) { o = colocadas[i]; if (Math.hypot(o.x - x, o.z - z) < o.r + pad + 25) { ok = false; break; } }
        if (ok) return [x, z];
      }
    }
    return null;
  }
  function guardarBase() { guardar('base_' + key, colocadas.map(function (o) { return { i: o.item.id, x: Math.round(o.x * 100) / 100, z: Math.round(o.z * 100) / 100, y: Math.round((o.g.position.y || 0) * 100) / 100, r: o.rot, fin: o.fin || 0, dur: o.dur || 0, v: o.vida == null ? undefined : Math.round(o.vida * 10) / 10, b: o.bod, tm: o.tm }; }));
    var cs = leer('colonias', {}) || {}; if (colocadas.length) cs[key] = { key: key, nombre: pl.nombre, tipo: pl.tipo, x: pl.x || 0, y: pl.y || 0, z: pl.z || 0, r: pl.r || 1000, estructuras: colocadas.length, naves: (cs[key] && cs[key].naves) || [] }; else delete cs[key]; guardar('colonias', cs); }
  function cargarBase() {
    var lst = leer('base_' + key, []) || [], i = 0;
    ui.est.textContent = lst.length ? 'Reconstruyendo la base…' : '';
    (function sig() {
      if (!pl || i >= lst.length) { actualizarPilares(); actualizarUI(); try { sincronizarHangares(); } catch (eh) { } try { crearPerro(); } catch (ep0) { } try { iniciarGusanos(); } catch (eg0) { } return; }
      var e = lst[i++], item = itemDe(e.i); if (!item) return sig();
      asegurar(item, function (ok) {
        if (ok && pl) { var o = instanciar(item); if (o) { o.x = e.x; o.z = e.z; o.rot = e.r || 0; o.fin = jug.pruebas ? 0 : (e.fin || 0); o.dur = e.dur || 0; if (o.fin && o.fin > Date.now() && o.dur) prepararObra(o); o.vida = e.v; o.bod = e.b; o.tm = e.tm; iniMant(o); if (o.mant) { o.vida = o.vida == null ? 100 : o.vida; tickMant(o, Math.min(Date.now(), o.tm + MAX_OFFLINE)); o.tm = Date.now(); } o.g.position.set(o.x, e.y || 0, o.z); o.g.rotation.y = o.rot; o.g.userData.idx = true; colocadas.push(o); } }
        setTimeout(sig, 0);
      });
    })();
  }
  function elegir(item, sinCosto) {
    ultItem = item;
    if (item.base && !modoPie) { toast('LAS BASES SOLO SE COLOCAN A PIE · PULSA BAJAR A PIE', 2.6); return; }
    if (item.defensa) { if (stockDe(item.id) <= 0) { toast('NO TIENES · CÓMPRALO EN UNA ESTACIÓN', 2.2); return; } if (colocadas.length - nEst() >= MAX_DEF) { toast('LÍMITE DE DEFENSAS'); return; } }
    else { if (item.base ? nBases() >= 150 : nEst() >= MAX_EST) { toast(item.base ? 'LÍMITE DE BASES' : 'LÍMITE DE ' + MAX_EST + ' ESTRUCTURAS'); return; } if (!sinCosto && !alcanza(COSTOS[item.id])) { toast('NO TIENES ' + falta(COSTOS[item.id]).toUpperCase(), 2); return; } }
    quitarGhost(); modoBorrar = false; itemSel = item; ui.panel.classList.remove('on');
    asegurar(item, function (ok) {
      if (!ok || itemSel !== item) { if (!ok) { toast('NO SE PUDO DESCARGAR'); itemSel = null; } actualizarUI(); return; }
      ghost = instanciar(item); if (!ghost) { toast('ERROR AL CREAR'); itemSel = null; } else { ghost.g.userData.fantasma = true; rotG = 0; }
      actualizarUI();
    });
    actualizarUI();
  }
  /* ---- costos de construcción y mantenimiento ---- */
  var N1 = { piedra: 60, hierro: 20, cobre: 10 }, N2 = { piedra: 150, hierro: 60, cobre: 30, titanio: 10, piezas: 10 }, N3 = { piedra: 400, hierro: 150, cobre: 80, titanio: 40, oro: 10, piezas: 30 };
  var COSTOS = { base_pc: { piedra: 8 }, base_pt: { piedra: 4 }, base_mc: { hierro: 20, piedra: 4 }, base_mt: { hierro: 10, piedra: 2 }, base_dc: { hierro: 30, titanio: 4 }, base_dt: { hierro: 15, titanio: 2 }, com1: N1, inv1: N1, pista1: N1, taller1: N1, torreta: { hierro: 20, cobre: 10 }, com2: N2, inv2: N2, pista2: N2, taller2: N2, extr_min: N2, extr_pet: N2, planta: N2, refineria: N2, com3: N3, complejo: N3, ciudad: N3, astillero: N3 };
  var DIA = 86400, REGEN = 100 / DIA, DECAY = 100 / (3 * DIA), MAX_OFFLINE = 48 * 3600 * 1000, DIAS_BODEGA = 14;
  /* barra rápida (como en los juegos de supervivencia) y mochila: lo que compraste (muros, portones, torretas…) y tus recursos */
  var hotSel = 0, hotSig = '';
  function objetosInv() {   // lista ordenada: primero lo comprado (defensas), luego los recursos
    var inv = invL(), out = [];
    CATALOGO.forEach(function (it) { if (it.defensa && !it.oculto) { var n = stockDe(it.id); if (n > 0) out.push({ t: 'd', it: it, n: n, k: it.id }); } });
    Object.keys(E.Iconos.RES).forEach(function (k) { if (inv[k] > 0) out.push({ t: 'r', k: k, n: Math.floor(inv[k]) }); });
    return out;
  }
  function imgObj(o, px) {   // miniatura real del modelo si ya existe; si no, la pide y mientras tanto pone las iniciales
    if (o.t === 'r') return E.Iconos.svg(o.k, px);
    var u = E.Iconos.miniatura(o.it.id, null);
    if (u) return '<img src="' + u + '" style="width:' + px + 'px;height:' + px + 'px;object-fit:contain">';
    miniDe(o.it, function () { hotSig = ''; if (ui && ui.moch && ui.moch.classList.contains('on')) pintarMoch(); });
    return '<span style="font-size:10px;letter-spacing:.04em">' + o.it.nombre.slice(0, 5).toUpperCase() + '</span>';
  }
  function usarObj(o) { if (o && o.t === 'd') { if (ui.moch) ui.moch.classList.remove('on'); elegir(o.it); } }
  function pintarHot(forzar) {
    if (!ui || !ui.hotS) return; var ls = objetosInv().slice(0, 6), sig = ls.map(function (o) { return o.k + o.n; }).join('|') + '#' + hotSel;
    if (sig === hotSig && !forzar) return; hotSig = sig; ui.hotLs = ls;
    ui.hotS.forEach(function (d, i) { var o = ls[i]; d.className = 'jn-hot-s' + (i === hotSel ? ' sel' : ''); d.innerHTML = '<small class="n">' + (i + 1) + '</small>' + (o ? imgObj(o, 30) + '<b>' + o.n + '</b>' : ''); });
  }
  function pintarMoch() {
    var M = ui.moch; if (!M) return; M.innerHTML = ''; var W = el('div', 'jn-moch-w', M), cab = el('div', 'jn-moch-cab', W); el('b', '', cab, 'MOCHILA'); var x = el('button', 'jn-mapa-x', cab, '✕'); x.onclick = function () { M.classList.remove('on'); };
    var ls = objetosInv(), g = el('div', 'jn-moch-g', W), i;
    ls.forEach(function (o) {
      var c = el('div', 'jn-moch-c', g), nm = o.t === 'd' ? o.it.nombre : E.Iconos.RES[o.k].n; c.innerHTML = '<div class="im">' + imgObj(o, 40) + '</div><b>' + o.n + '</b><small>' + nm + '</small>';
      if (o.t === 'd') { c.classList.add('us'); c.onclick = function () { usarObj(o); }; }
    });
    for (i = ls.length; i < 24; i++) el('div', 'jn-moch-c vac', g);
    el('div', 'jn-lb-nota', W, 'Toca un objeto comprado (muro, portón, torreta…) para colocarlo. Los recursos se gastan al construir.');
  }
  function invL() { return leer('inv', {}) || {}; }
  function alcanza(c) { if (!c || jug.pruebas) return true; var iv = invL(), k; for (k in c) if ((iv[k] || 0) < c[k]) return false; return true; }
  function gastar(c, f) { if (!c || jug.pruebas) return; var iv = invL(), k; for (k in c) iv[k] = Math.max(0, (iv[k] || 0) + (f || -1) * c[k]); guardar('inv', iv); }
  function mantDe(id) { var c = COSTOS[id], m = {}, k, h = false; if (!c || /^base_/.test(id)) return null; ['piedra', 'hierro'].forEach(function (k2) { if (c[k2]) { m[k2] = Math.max(1, Math.ceil(c[k2] * 0.1)); h = true; } }); return h ? m : null; }   // por día: 10 % del costo en piedra y hierro
  function iniMant(o) { o.mant = mantDe(o.item.id); if (o.mant) { if (o.vida == null) o.vida = 100; if (!o.bod) o.bod = {}; o.tm = o.tm || Date.now(); } }
  function tickMant(o, ahora) {
    var m = o.mant; if (!m || o.fin) return; var dt = (ahora - o.tm) / 1000; if (dt <= 0) return; o.tm = ahora;
    var f = 1, k, need; for (k in m) { need = m[k] / DIA * dt; if (need > 0) f = Math.min(f, (o.bod[k] || 0) / need); } f = Math.max(0, Math.min(1, f));
    for (k in m) o.bod[k] = Math.max(0, (o.bod[k] || 0) - m[k] / DIA * dt * f);
    o.vida = clamp(o.vida + dt * (f * REGEN - (1 - f) * DECAY), 0, 100);
  }
  function capBod(o, k) { return Math.ceil(o.mant[k] * DIAS_BODEGA); }
  function estadoVida(o) { return o.vida <= 0 ? 'EN RUINAS' : o.vida < 35 ? 'DAÑADO' : 'OPERATIVO'; }
  /* ---- defensas: muros y portones que se encajan columna con columna; torretas sobre las columnas ---- */
  var MAX_DEF = 120, K = 10, ALTO_COL = 2.92 * K;   // las defensas se construyen 10 veces más grandes que el modelo original (el muro mide 70 m)
  function nEst() { var n = 0, i; for (i = 0; i < colocadas.length; i++) if (!colocadas[i].item.defensa && !colocadas[i].item.base) n++; return n; }
  function nBases() { var n = 0, i; for (i = 0; i < colocadas.length; i++) if (colocadas[i].item.base) n++; return n; }
  function stockDe(id) { var s = leer('stock', {}) || {}; return s[id] || 0; }
  function stockMas(id, d) { var s = leer('stock', {}) || {}; s[id] = Math.max(0, (s[id] || 0) + d); guardar('stock', s); }
  /* ---- bases: se encajan por las aristas (como en Rust); muros, portones y edificios se apoyan encima ---- */
  /* ---- perro robot de farmeo: te sigue y lleva carga extra (se compra en la tienda del lobby) ---- */
  var perro = null, perroCargando = false, dg = { x: 0, z: 0, y: 0, yaw: 0, ta: 0 }, CAP_PERRO = 300, RES_P = ['piedra', 'hierro', 'cobre', 'titanio', 'oro', 'piezas'];
  function datosPerro() { var d = leer('perro', null); return d && d.tiene ? d : null; }
  function cargaTotal(d) { var n = 0, k; for (k in d.carga) n += d.carga[k] || 0; return n; }
  function crearPerro() {
    if (perro || perroCargando || !datosPerro()) return; perroCargando = true;
    cargarScript(E.CONFIG.rutaPersonajes + 'perro_robot.js', function () {
      perroCargando = false; if (!pl || typeof global.createPerroRobotGo2 !== 'function' || perro) return;
      try { perro = global.createPerroRobotGo2(THREE, { version: 'farmeo', metersPerUnit: 1, height: 1.2 }); sc.add(perro.group); dg.x = (modoPie ? px : fx) + 6; dg.z = (modoPie ? pz : fz) + 6; dg.y = 0; } catch (e) { perro = null; }
    }, function () { perroCargando = false; });
  }
  function angLerp(a, b, u) { var d = ((b - a + PI * 3) % (PI * 2)) - PI; return a + d * u; }
  function tickPerro(dt) {
    if (!perro || !pl) return; var tx = modoPie ? px : fx, tz = modoPie ? pz : fz, dx = tx - dg.x, dz = tz - dg.z, d = Math.hypot(dx, dz), sp = 0, a = Math.atan2(dx, dz), b;
    if (d > 300) { dg.x = tx + 5; dg.z = tz + 5; dx = tx - dg.x; dz = tz - dg.z; d = Math.hypot(dx, dz); }
    if (modoPie && d > 7) { sp = Math.min(16, (d - 7) * 1.8 + 3); dg.yaw = angLerp(dg.yaw, a, Math.min(1, dt * 6)); dg.x += Math.sin(dg.yaw) * sp * dt; dg.z += Math.cos(dg.yaw) * sp * dt; }
    else if (modoPie) dg.yaw = angLerp(dg.yaw, a, Math.min(1, dt * 2));
    perro.setState(sp > 6 ? 'trot' : sp > 0.5 ? 'walk' : 'idle');
    dg.ta += dt * (sp > 0.5 ? clamp(sp / Math.max(0.5, perro.speed || 1), 1, 4) : 1); perro.update(dg.ta);
    b = baseBajo(dg.x, dg.z, 0); dg.y += ((b ? b.top : hT(dg.x, dg.z)) - dg.y) * Math.min(1, dt * 8);
    perro.group.position.set(dg.x, dg.y, dg.z); perro.group.rotation.y = dg.yaw;
  }
  function moverCarga(k, n) {   // n > 0: del jugador al perro; n < 0: del perro al jugador
    var d = datosPerro(); if (!d) return; var iv = invL(), tot = cargaTotal(d), q;
    if (n > 0) { q = Math.min(n, iv[k] || 0, CAP_PERRO - tot); if (q <= 0) { toast(tot >= CAP_PERRO ? 'EL PERRO ESTÁ LLENO' : 'NO TIENES', 1.4); return; } iv[k] = (iv[k] || 0) - q; d.carga[k] = (d.carga[k] || 0) + q; }
    else { q = Math.min(-n, d.carga[k] || 0); if (q <= 0) return; d.carga[k] -= q; iv[k] = (iv[k] || 0) + q; }
    guardar('inv', iv); guardar('perro', d); pintarPerro();
  }
  function pintarPerro() {
    var P = ui.perro, d = datosPerro(); if (!P) return; P.innerHTML = ''; if (!d) { P.classList.remove('on'); return; }
    var iv = invL(), tot = cargaTotal(d); el('h3', '', P, 'PERRO ROBOT'); el('div', 'jn-cred', P, 'Carga: ' + tot + ' / ' + CAP_PERRO);
    RES_P.forEach(function (k) {
      var f = el('div', 'jn-venta', P); el('span', 'n', f, E.Iconos.svg(k, 18) + ' ' + k + ' <small>tú ' + (iv[k] || 0) + ' · perro ' + (d.carga[k] || 0) + '</small>');
      var a = el('button', 'jn-btn', f, '+10'), b = el('button', 'jn-btn', f, 'TODO →'), c = el('button', 'jn-btn', f, '← TODO');
      a.onclick = function () { moverCarga(k, 10); }; b.onclick = function () { moverCarga(k, 1e9); }; c.onclick = function () { moverCarga(k, -1e9); };
    });
    el('div', 'jn-ayuda', P, 'Lo que lleva el perro lo acompaña a donde vayas. Pásalo a tu inventario para construir o vender.');
    var x = el('button', 'jn-btn', P, 'CERRAR'); x.onclick = function () { P.classList.remove('on'); };
  }
  /* ---- gusanos: daño a estructuras ---- */
  function destruirEst(o) {
    var i = colocadas.indexOf(o); if (i < 0) return; sc.remove(o.g); colocadas.splice(i, 1);
    if (o.item.base) huerfanasBase(); if (o.item.defensa) huerfanas(); actualizarPilares(); guardarBase(); actualizarUI();
  }
  function danioEstructura(o, n) {
    o.vida = (o.vida == null ? 100 : o.vida) - n;
    if (o.vida <= 0) { toast('EL GUSANO DESTRUYÓ: ' + o.item.nombre.toUpperCase(), 3); destruirEst(o); }
    else { toast('EL GUSANO ATACÓ: ' + o.item.nombre.toUpperCase() + ' · ' + Math.round(o.vida) + '%', 2.4); guardarBase(); }
  }
  function repararPasivo() { var i, o, ch = false; for (i = 0; i < colocadas.length; i++) { o = colocadas[i]; if (!o.mant && o.vida != null && o.vida < 100) { o.vida = Math.min(100, o.vida + 0.5); ch = true; } } if (ch && (Date.now() - tGuardar > 30000)) { tGuardar = Date.now(); guardarBase(); } }
  var vidaJ = 100;
  function danioJugador(n) {
    vidaJ -= n; toast(vidaJ > 0 ? 'EL GUSANO TE GOLPEÓ · VIDA ' + Math.max(0, Math.round(vidaJ)) : 'TE DEVORÓ EL GUSANO · REAPARECES', 2.4);
    if (vidaJ <= 0) { vidaJ = 100; px = 0; pz = 0; pyF = hT(0, 0); saltoY = 0; fallV = 0; }
  }
  function iniciarGusanos() {
    if (!E.Gusanos || !pl) return;
    E.Gusanos.iniciar({ sc: sc, estructuras: function () { return colocadas; }, jugador: function () { return { x: modoPie ? px : fx, z: modoPie ? pz : fz }; }, minero: !(E.ATERRIZABLES && E.ATERRIZABLES[pl.tipo]), pie: function () { return modoPie && !sentado; }, danioJugador: danioJugador, aviso: toast, danio: danioEstructura, reparar: repararPasivo });
  }
  function apuntar(maxD, minD) {   // punto del suelo al que mira la cámara (mirar hacia abajo lo acerca, hacia el horizonte lo aleja)
    var d = maxD; if (ppit < -0.04) d = clamp((1.7 + pyF) / Math.tan(-ppit), minD, maxD);
    return { x: px - Math.sin(pyaw) * d, z: pz - Math.cos(pyaw) * d };
  }
  var BASE_SOPORTE = false;   // muros y edificios sobre bases (apagado: las bases miden 12,5 m y esas piezas son mucho más grandes)
  function esBase(o) { return !!o.item.base; }
  function rotPt(th, x, z) { var c = Math.cos(th), sn = Math.sin(th); return [x * c + z * sn, -x * sn + z * c]; }
  function aristasDe(o) { var out = [], i, e, p; for (i = 0; i < o.ed.length; i++) { e = o.ed[i]; p = rotPt(o.rot || 0, e.x, e.z); out.push({ x: o.x + p[0], z: o.z + p[1], ang: (o.rot || 0) + e.ang, len: e.len, o: o }); } return out; }
  function dentroBase(b, x, z, tol) {   // el punto está sobre la base (con margen tol)
    var dx = x - b.x, dz = z - b.z, c = Math.cos(b.rot || 0), sn = Math.sin(b.rot || 0), lx = dx * c - dz * sn, lz = dx * sn + dz * c, i, e;
    for (i = 0; i < b.ed.length; i++) { e = b.ed[i]; if ((lx - e.x) * Math.sin(e.ang) + (lz - e.z) * Math.cos(e.ang) > tol) return false; }
    return true;
  }
  function baseBajo(x, z, tol) { for (var i = 0; i < colocadas.length; i++) if (esBase(colocadas[i]) && !(colocadas[i].fin && colocadas[i].fin > Date.now()) && Math.hypot(colocadas[i].x - x, colocadas[i].z - z) < 40 && dentroBase(colocadas[i], x, z, tol == null ? 0 : tol)) return colocadas[i]; return null; }
  function validaBase(x, z, th) {
    if (Math.hypot(x, z) + ghost.r > RADIO_PLANO || (naveBaja && Math.hypot(x - naveTx, z - naveTz) < pad + ghost.r)) return false;
    var i, o; for (i = 0; i < colocadas.length; i++) { o = colocadas[i];
      if (esBase(o)) { if (Math.hypot(o.x - x, o.z - z) < 0.8 * (o.inr + ghost.inr)) return false; continue; }
      if (o.g.position.y > 0.1 || Math.hypot(o.x - x, o.z - z) > o.r + ghost.r + 2) continue;
      if (chocaRect(x, z, th, ghost.hw * 0.9, ghost.hd * 0.9, o.x, o.z, o.rot || 0, o.hw != null ? o.hw : o.r, o.hd != null ? o.hd : o.r)) return false; }
    return true;
  }
  function posBase(cx, cz) {
    var g = ghost.g, e0 = ghost.ed[0], best = null, bd = 1e9, i, j, k, b, ar, e, th, p, nx, nz, occ, d;
    for (i = 0; i < colocadas.length; i++) { b = colocadas[i]; if (!esBase(b)) continue; ar = aristasDe(b);
      for (j = 0; j < ar.length; j++) { e = ar[j]; th = e.ang + Math.PI - e0.ang; p = rotPt(th, e0.x, e0.z); nx = e.x - p[0]; nz = e.z - p[1]; occ = false;
        for (k = 0; k < colocadas.length; k++) if (esBase(colocadas[k]) && Math.hypot(colocadas[k].x - nx, colocadas[k].z - nz) < 0.8 * (colocadas[k].inr + ghost.inr)) { occ = true; break; }
        if (occ) continue; d = Math.hypot(nx - cx, nz - cz); if (d < 30 && d < bd) { bd = d; best = { x: nx, z: nz, th: th }; } } }
    var x, z, rot; if (best) { x = best.x; z = best.z; rot = best.th; } else { x = Math.round(cx / 2) * 2; z = Math.round(cz / 2) * 2; rot = rotG; }
    g.position.set(x, 0, z); g.rotation.y = rot; ghost.okDef = validaBase(x, z, rot); return ghost.okDef;
  }
  function huerfanasBase() {   // lo que estaba sobre una base demolida se retira (muros al stock, edificios devuelven la mitad)
    var i, o, ch = false, kk, rf;
    for (i = colocadas.length - 1; i >= 0; i--) { o = colocadas[i]; if (esBase(o) || o.item.defensa === 'torretaf' || !(o.g.position.y > 0.1)) continue;
      if (!baseBajo(o.x, o.z, 2)) { sc.remove(o.g); colocadas.splice(i, 1); if (o.item.defensa) stockMas(o.item.id, 1); else if (COSTOS[o.item.id] && !jug.pruebas) { rf = {}; for (kk in COSTOS[o.item.id]) rf[kk] = Math.floor(COSTOS[o.item.id][kk] / 2); gastar(rf, 1); } ch = true; } }
    if (ch) { huerfanas(); actualizarPilares(); }
  }
  function esMuro(o) { return o.item.defensa === 'muro' || o.item.defensa === 'porton'; }
  function extremosDe(o) { var a = o.rot || 0, c = Math.cos(a) * 2.5 * K, sn = Math.sin(a) * 2.5 * K; return [{ x: o.x + c, z: o.z - sn, o: o, i: 1 }, { x: o.x - c, z: o.z + sn, o: o, i: 0 }]; }   // i = columna: 0 izquierda (-x), 1 derecha (+x)
  function todosExtremos() { var l = [], i; for (i = 0; i < colocadas.length; i++) if (esMuro(colocadas[i])) l = l.concat(extremosDe(colocadas[i])); return l; }
  function actualizarPilares() {   // donde dos muros comparten columna, solo se ve una (así queda columna, pared, columna, pared…)
    var i, j, k, o, e, hay, visto = [];
    for (i = 0; i < colocadas.length; i++) { o = colocadas[i]; if (!esMuro(o) || !o.api.pilar) continue; e = extremosDe(o);
      for (k = 0; k < 2; k++) { hay = false; for (j = 0; j < visto.length; j++) if (Math.abs(visto[j][0] - e[k].x) < 0.35 * K && Math.abs(visto[j][1] - e[k].z) < 0.35 * K) { hay = true; break; } var pil = o.api.pilar(e[k].i); if (pil) pil.visible = !hay; if (!hay) visto.push([e[k].x, e[k].z]); } }
  }
  function huerfanas() {   // torretas cuya columna ya no existe vuelven a tu stock
    var ex = todosExtremos(), i, j, o, ok, cambio = false;
    for (i = colocadas.length - 1; i >= 0; i--) { o = colocadas[i]; if (o.item.defensa !== 'torretaf') continue; ok = false; for (j = 0; j < ex.length; j++) if (Math.hypot(ex[j].x - o.x, ex[j].z - o.z) < 0.5 * K) { ok = true; break; }
      if (!ok) { sc.remove(o.g); colocadas.splice(i, 1); stockMas('torretaf', 1); cambio = true; } }
    return cambio;
  }
  function validaDef(x, z) {
    if (Math.hypot(x, z) + 4 * K > RADIO_PLANO || (naveBaja && Math.hypot(x - naveTx, z - naveTz) < pad + 4 * K)) return false;
    var i, o, d; for (i = 0; i < colocadas.length; i++) { o = colocadas[i]; d = Math.hypot(o.x - x, o.z - z); if (o.item.base) continue; if (o.g.position.y > 0.1 && esMuro(o)) continue; if (esMuro(o)) { if (d < 3.3 * K) return false; } else if (o.item.defensa !== 'torretaf' && d < o.r + 4 * K) return false; }
    return true;
  }
  function posDefensa(cx, cz) {   // coloca el fantasma (encajado) y dice si se puede construir
    var it = ghost.item.defensa, g = ghost.g, ex = todosExtremos(), i, j, e, d, bd = 1e9, best = null, f, occ;
    if (it === 'torretaf') {
      for (i = 0; i < ex.length; i++) { e = ex[i]; occ = false; for (j = 0; j < colocadas.length; j++) if (colocadas[j].item.defensa === 'torretaf' && Math.hypot(colocadas[j].x - e.x, colocadas[j].z - e.z) < 0.5 * K) { occ = true; break; } d = Math.hypot(e.x - cx, e.z - cz); if (!occ && d < 10 * K && d < bd) { bd = d; best = e; } }
      if (best) { g.position.set(best.x, ALTO_COL + (best.o.g.position.y || 0), best.z); g.rotation.y = (best.o.rot || 0) + rotG; ghost.okDef = true; } else { g.position.set(cx, 0, cz); g.rotation.y = rotG; ghost.okDef = false; }
      return ghost.okDef;
    }
    var bB = null, bdB = 1e9, bs, ar2, ee, oc2, q;
    for (i = 0; i < colocadas.length; i++) { bs = colocadas[i]; if (!esBase(bs)) continue; ar2 = aristasDe(bs);
      for (j = 0; j < ar2.length; j++) { ee = ar2[j]; oc2 = false; for (q = 0; q < colocadas.length; q++) if (esMuro(colocadas[q]) && colocadas[q].g.position.y > 0.1 && Math.hypot(colocadas[q].x - ee.x, colocadas[q].z - ee.z) < 0.3 * K) { oc2 = true; break; }
        d = Math.hypot(ee.x - cx, ee.z - cz); if (!oc2 && d < 10 * K && d < bdB) { bdB = d; bB = ee; } } }
    for (i = 0; i < ex.length; i++) { e = ex[i]; if (e.o.g.position.y > 0.1) continue; f = true; for (j = 0; j < ex.length; j++) if (ex[j].o !== e.o && Math.hypot(ex[j].x - e.x, ex[j].z - e.z) < 0.35 * K) { f = false; break; } d = Math.hypot(e.x - cx, e.z - cz); if (f && d < 10 * K && d < bd) { bd = d; best = e; } }
    if (BASE_SOPORTE && bB && bdB <= bd) { g.position.set(bB.x, bB.o.top, bB.z); g.rotation.y = bB.ang; ghost.okDef = true; return true; }
    var x, z, rot;
    if (best) {
      rot = (best.o.rot || 0) + rotG; var ax = Math.cos(rot) * 2.5 * K, az = -Math.sin(rot) * 2.5 * K, x1 = best.x + ax, z1 = best.z + az, x2 = best.x - ax, z2 = best.z - az, d1 = Math.hypot(x1 - best.o.x, z1 - best.o.z), d2 = Math.hypot(x2 - best.o.x, z2 - best.o.z), u1;
      u1 = Math.abs(d1 - d2) > 0.5 * K ? d1 > d2 : Math.hypot(x1 - cx, z1 - cz) < Math.hypot(x2 - cx, z2 - cz); x = u1 ? x1 : x2; z = u1 ? z1 : z2;
    } else { x = Math.round(cx / 2) * 2; z = Math.round(cz / 2) * 2; rot = rotG; }
    g.position.set(x, 0, z); g.rotation.y = rot; ghost.okDef = validaDef(x, z); return ghost.okDef;
  }
  function quitarGhost() { if (ghost) { sc.remove(ghost.g); ghost = null; } itemSel = null; }
  function colocar() {
    if (!ghost) return; var x = ghost.g.position.x, z = ghost.g.position.z, df = ghost.item.defensa;
    if (Math.hypot(x, z) + (ghost.r || 0) > RADIO_PLANO) { toast('FUERA DE LA ZONA DE BASE · el círculo celeste marca el límite', 2.4); return; }
    if ((df || ghost.item.base) ? !ghost.okDef : !valida(x, z, ghost.r, null, ghost.g.rotation.y, ghost.hw, ghost.hd, BASE_SOPORTE ? baseBajo(x, z, 0) : null)) { toast(df === 'torretaf' ? 'PONLA SOBRE UNA COLUMNA' : 'NO CABE AQUÍ'); return; }
    if (df) { if (stockDe(ghost.item.id) <= 0) { toast('NO TE QUEDAN'); return; } stockMas(ghost.item.id, -1); }
    else { if (!alcanza(COSTOS[ghost.item.id])) { toast('NO TIENES ' + falta(COSTOS[ghost.item.id]).toUpperCase(), 2); return; } gastar(COSTOS[ghost.item.id]); }
    var o = ghost; ghost = null; itemSel = null; o.x = x; o.z = z; o.rot = o.g.rotation.y; try { if (o.api.setGhost) o.api.setGhost(false); } catch (e) { }
    o.dur = jug.pruebas ? 0 : (DUR[o.item.id] || 30) * 1000; o.fin = o.dur ? Date.now() + o.dur : 0; if (o.dur) prepararObra(o);
    iniMant(o); colocadas.push(o); actualizarPilares(); guardarBase(); toast(o.dur ? 'CONSTRUYENDO · ' + Math.round(o.dur / 1000) + ' s' : 'CONSTRUIDO', 1.4); actualizarUI();
    if (modoCons) { var it0 = o.item; setTimeout(function () { if (modoCons && !ghost && !itemSel) elegir(it0, true); }, 0); }
  }
  function estructuraEn(px, py) {
    v2p.set(px / E.ancho * 2 - 1, -(py / E.alto) * 2 + 1); ray.setFromCamera(v2p, cam);
    var i, hits = [], o;
    for (i = 0; i < colocadas.length; i++) { o = colocadas[i]; var h = ray.intersectObject(o.g, true); if (h.length) hits.push({ d: h[0].distance, o: o }); }
    if (!hits.length) return null; hits.sort(function (a, b) { return a.d - b.d; }); return hits[0].o;
  }
  function borrarEn(px, py) {
    var o = estructuraEn(px, py); if (!o) return;
    sc.remove(o.g); colocadas.splice(colocadas.indexOf(o), 1); if (o.item.defensa) { stockMas(o.item.id, 1); huerfanas(); actualizarPilares(); } else if (o.item.base) { huerfanasBase(); if (COSTOS[o.item.id] && !jug.pruebas) { var rb = {}, kb; for (kb in COSTOS[o.item.id]) rb[kb] = Math.floor(COSTOS[o.item.id][kb] / 2); gastar(rb, 1); } } else if (COSTOS[o.item.id] && !jug.pruebas) { var rf = {}, kk; for (kk in COSTOS[o.item.id]) rf[kk] = Math.floor(COSTOS[o.item.id][kk] / 2); gastar(rf, 1); toast('RECUPERAS LA MITAD DE LOS MATERIALES', 1.6); } guardarBase(); toast('DEMOLIDO: ' + o.item.nombre.toUpperCase(), 1.4); actualizarUI();
  }

  /* ---- interfaz ---- */
  function construirUI() {
    var L = DOMcapas.planeta; L.innerHTML = '';
    ui = {};
    ui.tit = el('div', 'jn-pl-tit', L, ''); ui.est = el('div', 'jn-pl-est', L, ''); ui.toast = el('div', 'jn-toast', L, '');
    var izq = el('div', 'jn-pl-izq', L);
    function hold(t, f) { var b = el('div', 'jn-ico', izq, t); b.addEventListener('pointerdown', function (ev) { f(1); b.setPointerCapture && b.setPointerCapture(ev.pointerId); ev.preventDefault(); }); ['pointerup', 'pointercancel'].forEach(function (n) { b.addEventListener(n, function () { f(0); }); }); return b; }
    hold('⟲', function (v) { bR = v ? -1 : 0; }); hold('⟳', function (v) { bR = v ? 1 : 0; }); hold('＋', function (v) { bZ = v ? -1 : 0; }); hold('－', function (v) { bZ = v ? 1 : 0; });
    ui.barra = el('div', 'jn-pl-barra', L);
    ui.bCons = el('button', 'jn-btn', ui.barra, 'CONSTRUIR'); ui.bCons.onclick = function () { quitarGhost(); modoBorrar = false; modoCons = true; catModo = 'c'; pintarCatalogo(); ui.panel.classList.add('on'); actualizarUI(); };
    ui.bEdif = el('button', 'jn-btn', ui.barra, 'EDIFICACIONES'); ui.bEdif.onclick = function () { quitarGhost(); modoBorrar = false; modoCons = true; catModo = 'e'; pintarCatalogo(); ui.panel.classList.add('on'); actualizarUI(); };
    ui.bMej = el('button', 'jn-btn', ui.barra, 'MEJORAR BASE'); ui.bMej.onclick = function () { mejorarBase(cercaM); };
    ui.bCol = el('button', 'jn-btn jn-grande', ui.barra, 'COLOCAR'); ui.bCol.addEventListener('pointerdown', function (ev) { colocar(); ev.preventDefault(); });
    ui.bRot = el('button', 'jn-btn', ui.barra, 'GIRAR'); ui.bRot.addEventListener('pointerdown', function (ev) { var b0 = ghost && ghost.item.base; rotG += b0 === 't' ? PI / 3 : b0 === 'c' ? PI / 2 : PI / 4; ev.preventDefault(); });
    ui.bCan = el('button', 'jn-btn', ui.barra, 'CANCELAR'); ui.bCan.onclick = function () { quitarGhost(); if (modoCons) { pintarCatalogo(); ui.panel.classList.add('on'); } actualizarUI(); };
    ui.bTer = el('button', 'jn-btn', ui.barra, '3.ª PERSONA'); ui.bTer.onclick = function () { terceraP = !terceraP; actualizarUI(); };
    ui.bSalC = el('button', 'jn-btn', ui.barra, 'SALIR DE CONSTRUIR'); ui.bSalC.onclick = salirCons;
    ui.recur = el('div', 'jn-pl-est', L, ''); ui.recur.style.top = 'calc(62px + env(safe-area-inset-top))'; ui.recur.style.fontSize = '14px';
    ui.bBor = el('button', 'jn-btn', ui.barra, 'DEMOLER'); ui.bBor.onclick = function () { if (modoPie) { var ob = estructuraEn(E.ancho / 2, E.alto / 2); if (ob) borrarEn(E.ancho / 2, E.alto / 2); else toast('MIRA UNA ESTRUCTURA CERCA Y PULSA DEMOLER', 2); return; } quitarGhost(); modoBorrar = !modoBorrar; if (modoBorrar) toast('TOCA UNA ESTRUCTURA PARA DEMOLERLA', 2); actualizarUI(); };
    ui.bNave = el('button', 'jn-btn', ui.barra, 'LLAMAR NAVE'); ui.bNave.onclick = function () {
      if (viajeFin) { toast('TU NAVE AÚN VIAJA · LLEGA EN ' + tiempoViaje(), 2.2); return; }
      if (!naveBaja) { var l = buscarLibre(modoPie ? px : fx, modoPie ? pz : fz); if (!l) { toast('NO HAY SITIO LIBRE CERCA'); return; } naveTx = l[0]; naveTz = l[1]; naveBaja = true; ui.bNave.textContent = 'ENVIAR NAVE ARRIBA'; toast('LA NAVE BUSCA UN SITIO LIBRE…', 1.8); }
      else { naveBaja = false; ui.bNave.textContent = 'LLAMAR NAVE'; }
    };
    ui.bDes = el('button', 'jn-btn', ui.barra, 'DESPEGAR'); ui.bDes.onclick = function () {
      if (viajeFin) { toast('TU NAVE AÚN VIAJA · LLEGA EN ' + tiempoViaje(), 2.2); return; }
      if (modoPie && !(naveBaja && naveY < 3 && Math.hypot(px - naveX, pz - naveZ) < pad + 30)) { toast('LLAMA A LA NAVE Y ACÉRCATE PARA SUBIR', 2); return; } despegar();
    };
    ui.bPie = el('button', 'jn-btn', ui.barra, 'BAJAR A PIE'); ui.bPie.onclick = function () { if (modoPie) salirPie(); else entrarPie(); };
    ui.bMoch = el('button', 'jn-btn', ui.barra, 'MOCHILA'); ui.bMoch.onclick = function () { pintarMoch(); ui.moch.classList.add('on'); };
    ui.bPerro = el('button', 'jn-btn', ui.barra, 'PERRO'); ui.bPerro.onclick = function () { if (ui.perro.classList.contains('on')) ui.perro.classList.remove('on'); else { pintarPerro(); ui.perro.classList.add('on'); } };
    ui.bCor = el('button', 'jn-btn', ui.barra, 'CORRER'); ui.bCor.onclick = function () { correr = !correr; ui.bCor.classList.toggle('on', correr); };
    ui.bSen = el('button', 'jn-btn', ui.barra, 'BAJAR DE LA TORRETA'); ui.bSen.onclick = function () { if (sentado) levantarse(); };
    ui.bUsar = el('div', 'jn-pl-usar', L); el('span', '', ui.bUsar, '✋'); el('b', '', ui.bUsar, 'USAR'); ui.bUsar.addEventListener('pointerdown', function (ev) { if (cercaN && !cercaT && !cercaG && !sentado && !cercaB) despegar(); else if (cercaT && !sentado) sentarse(cercaT); else if (cercaB && !cercaG && !sentado) abrirMant(cercaB); else if (cercaG && !sentado) { cercaG.abierto = !cercaG.abierto; toast(cercaG.abierto ? 'PORTÓN ABIERTO' : 'PORTÓN CERRADO', 1); } ev.preventDefault(); });
    ui.bSal = el('button', 'jn-btn jn-grande jn-pl-saltar', L, 'SALTAR'); ui.bSal.addEventListener('pointerdown', function (ev) { if (nadando) { nUp = true; try { ui.bSal.setPointerCapture(ev.pointerId); } catch (x) { } } else if (saltoY <= 0.001 && modoPie && !sentado) saltoV = 4.6; ev.preventDefault(); });
    ['pointerup', 'pointercancel'].forEach(function (n) { ui.bSal.addEventListener(n, function () { nUp = false; }); });
    ui.bBuc = el('button', 'jn-btn jn-grande jn-pl-volar jn-pl-buc', L, 'BUCEAR'); ui.bBuc.style.display = 'none';
    ui.bBuc.addEventListener('pointerdown', function (ev) { nDown = true; try { ui.bBuc.setPointerCapture(ev.pointerId); } catch (x) { } ev.preventDefault(); });
    ['pointerup', 'pointercancel'].forEach(function (n) { ui.bBuc.addEventListener(n, function () { nDown = false; }); });
    ui.aire = el('div', 'jn-aire', L, '<i></i>'); ui.aireI = ui.aire.firstChild; ui.aire.style.display = 'none';
    ui.hot = el('div', 'jn-hot', L); ui.hotS = []; for (var hi = 0; hi < 6; hi++) (function (n) { var d = el('div', 'jn-hot-s' + (n === 0 ? ' sel' : ''), ui.hot); d.addEventListener('pointerdown', function (ev) { hotSel = n; pintarHot(true); usarObj((ui.hotLs || [])[n]); ev.preventDefault(); ev.stopPropagation(); }); ui.hotS.push(d); })(hi);
    ui.bVol = el('button', 'jn-btn jn-grande jn-pl-volar', L, 'VOLAR');
    ui.bVol.addEventListener('pointerdown', function (ev) { if (modoPie && !sentado) volar = true; try { ui.bVol.setPointerCapture(ev.pointerId); } catch (x) { } ev.preventDefault(); });
    ['pointerup', 'pointercancel'].forEach(function (n) { ui.bVol.addEventListener(n, function () { volar = false; }); });
    ui.bGol = el('button', 'jn-btn jn-grande jn-pl-golpe', L, 'GOLPEAR'); ui.bGol.addEventListener('pointerdown', function (ev) { if (modoPie && !sentado && golpeT <= 0) golpeT = 0.45; ev.preventDefault(); });
    ui.bRec = el('button', 'jn-btn', ui.barra, 'RECARGAR'); ui.bRec.onclick = function () { if (sentado) sentado.api.recargar(); };
    ui.bFue = el('button', 'jn-btn jn-grande jn-fuego', L, 'DISPARAR'); ['pointerdown'].forEach(function (n) { ui.bFue.addEventListener(n, function (ev) { if (sentado) sentado.api.disparar(true); ev.preventDefault(); }); }); ['pointerup', 'pointercancel', 'pointerleave'].forEach(function (n) { ui.bFue.addEventListener(n, function () { if (sentado) sentado.api.disparar(false); }); });
    ui.asc = el('div', 'jn-pl-asc', L); ui.asc.style.display = 'none';
    ui.tor = el('div', 'jn-pl-tor', L);
    function tb(txt, cls, f) { var b = el('div', 'jn-ico ' + cls, ui.tor, txt); b.addEventListener('pointerdown', function (ev) { f(1); b.setPointerCapture && b.setPointerCapture(ev.pointerId); ev.preventDefault(); }); ['pointerup', 'pointercancel', 'pointerleave'].forEach(function (n) { b.addEventListener(n, function () { f(0); }); }); return b; }
    tb('▲', 'tu', function (v) { tIy = v; }); tb('◀', 'tl', function (v) { tIx = v; }); tb('▶', 'tr', function (v) { tIx = -v; }); tb('▼', 'td', function (v) { tIy = -v; });
    ui.sb = el('div', 'jn-pl-sb', L); ui.sk = el('div', 'jn-pl-sk', L); ui.mira = el('div', 'jn-pl-mira', L, '+'); ui.izq = izq;
    ui.panel = el('div', 'jn-pmenu jn-pl-panel', L, ''); var cab = el('div', 'jn-pl-cab', ui.panel); el('b', '', cab, 'ESTRUCTURAS'); var x = el('button', 'jn-mapa-x', ui.panel, '✕'); x.onclick = function () { ui.panel.classList.remove('on'); };
    ui.lstCat = el('div', 'jn-fl-lista', ui.panel);
    ui.moch = el('div', 'jn-pmenu jn-moch jn-pl-mant', L, ''); ui.mant = el('div', 'jn-pmenu jn-pl-panel jn-pl-mant', L, ''); ui.perro = el('div', 'jn-pmenu jn-pl-panel jn-pl-mant', L, '');
    [['p_cons', ui.bCons], ['p_col', ui.bCol], ['p_rot', ui.bRot], ['p_can', ui.bCan], ['p_demoler', ui.bBor], ['p_nave', ui.bNave], ['p_despegar', ui.bDes], ['p_pie', ui.bPie], ['p_correr', ui.bCor], ['p_usar', ui.bUsar], ['p_saltar', ui.bSal], ['p_golpe', ui.bGol], ['p_volar', ui.bVol], ['p_disparar', ui.bFue], ['p_torreta', ui.tor], ['p_zoom', ui.izq], ['p_recargar', ui.bRec], ['p_sen', ui.bSen], ['p_edif', ui.bEdif], ['p_bucear', ui.bBuc], ['p_perro', ui.bPerro], ['p_moch', ui.bMoch], ['p_mej', ui.bMej], ['p_salc', ui.bSalC], ['p_ter', ui.bTer]].forEach(function (q) { if (q[1]) q[1].setAttribute('data-ctl', q[0]); });
    E.aplicarLayout(L);
  }
  var colaMini = [], miniOn = false;
  function miniDe(it, cb) {   // miniatura real del modelo (se genera una vez, en segundo plano)
    var c = E.Iconos.miniatura(it.id, null); if (c) { cb(c); return; }
    colaMini.push([it, cb]); if (miniOn) return; miniOn = true;
    (function sig() {
      var q = colaMini.shift(); if (!q) { miniOn = false; return; }
      asegurar(q[0], function (ok) {
        var url = ''; if (ok) url = E.Iconos.miniatura(q[0].id, function () { var api = global[q[0].fn](THREE, { accent: jug.acento }); if (/^pista/.test(q[0].id) && api.demo === true && api.setState) { try { api.setState('working'); } catch (e) { } } return api.group; }, 168);
        try { q[1](url); } catch (e2) { } setTimeout(sig, 30);
      });
    })();
  }
  function chipsCosto(padre, c) {
    var d = el('div', 'jn-chips', padre), iv = invL(), k;
    for (k in c) { var ok = jug.pruebas || (iv[k] || 0) >= c[k]; el('span', ok ? '' : 'falta', d, E.Iconos.svg(k, 14) + c[k]); }
  }
  var cercaM = null, modoCons = false, ultItem = null;
  function falta(c) { var iv = invL(), k; if (!c || jug.pruebas) return ''; for (k in c) if ((iv[k] || 0) < c[k]) return k; return ''; }
  function salirCons() { modoCons = false; modoBorrar = false; quitarGhost(); ui.panel.classList.remove('on'); actualizarUI(); }
  function mejorarBase(o) {
    if (!o || !o.item.mejora) return; var it2 = itemDe(o.item.mejora), co = COSTOS[it2.id];
    if (!alcanza(co)) { toast('TE FALTAN MATERIALES PARA MEJORAR', 2.2); return; }
    asegurar(it2, function (ok) {
      if (!ok) { toast('NO SE PUDO DESCARGAR'); return; } var n = instanciar(it2); if (!n) { toast('ERROR AL CREAR'); return; }
      gastar(co); n.x = o.x; n.z = o.z; n.rot = o.rot; n.vida = o.vida; n.tm = Date.now(); n.dur = jug.pruebas ? 0 : 10000; n.fin = n.dur ? Date.now() + n.dur : 0;
      n.g.position.set(o.x, o.g.position.y || 0, o.z); n.g.rotation.y = o.rot; n.g.userData.idx = true; if (n.fin) prepararObra(n);
      var ix = colocadas.indexOf(o); cm.x = 1e9; sc.remove(o.g); sc.add(n.g); colocadas[ix] = n; cercaM = null; iniMant(n); actualizarPilares(); guardarBase(); toast('BASE MEJORADA', 1.6); actualizarUI();
    });
  }
  var catModo = 'c';   // 'c' = CONSTRUIR (bases y defensas) · 'e' = EDIFICACIONES
  function pintarCatalogo() {
    var L = ui.lstCat, sy = L.scrollTop; L.innerHTML = '';
    var cr = el('div', 'jn-cred', L, 'TU INVENTARIO · ' + ['piedra', 'hierro', 'cobre', 'titanio', 'oro', 'piezas'].map(function (k) { return E.Iconos.svg(k, 16) + (invL()[k] || 0); }).join('  ')); cr.style.fontSize = '13px';
    if (jug.pruebas) el('div', 'jn-lb-nota', L, 'Modo pruebas: construir no cuesta materiales.');
    var g = el('div', 'jn-grid jn-grid-cat', L);
    el('div', 'jn-lb-nota', L, catModo === 'c' ? 'Bases (empiezan de piedra y se mejoran a metal y metal duro) y defensas. Las bases solo se colocan a pie.' : 'Edificios y edificaciones.');
    CATALOGO.forEach(function (it) {
      if (it.oculto || (!!(it.base || it.defensa)) !== (catModo === 'c')) return;
      var c = E.Iconos.cuadro(g, { html: '<span class="jn-cuad-cargando">…</span>', titulo: it.nombre, sub: it.desc }), im = c.querySelector('.jn-cuad-im');
      miniDe(it, function (url) { if (url && im && im.parentNode) { var i = new Image(); i.src = url; i.className = 'jn-cuad-img'; im.insertBefore(i, im.firstChild); var w = im.querySelector('.jn-cuad-cargando'); if (w) w.remove(); } });
      var b;
      if (it.defensa) { var n = stockDe(it.id); el('div', 'jn-chips', c, '<span>Ya comprado: ' + n + '</span>'); b = el('button', 'jn-btn', c, n > 0 ? 'COLOCAR (' + n + ')' : 'CÓMPRALO EN UNA ESTACIÓN'); b.disabled = n <= 0; }
      else { var co = COSTOS[it.id]; if (co) chipsCosto(c, co); b = el('button', 'jn-btn', c, alcanza(co) ? 'CONSTRUIR' : 'FALTAN MATERIALES'); b.disabled = !alcanza(co); }
      b.onclick = function () { elegir(it); };
    });
    L.scrollTop = sy;
  }
  /* ---- mantenimiento: cada edificio tiene vida y una bodega de piedra/hierro que se gasta poco a poco ---- */
  var mantO = null, tMant = 0, tGuardar = 0;
  function abrirMant(o) { if (!o || !o.mant) return; mantO = o; ui.mant.classList.add('on'); pintarMant(); }
  function pintarMant() {
    var o = mantO, M = ui.mant; if (!o) return; var sy = (M.querySelector('.jn-fl-lista') || {}).scrollTop || 0; M.innerHTML = '';
    var cab = el('div', 'jn-pl-cab', M); el('b', '', cab, o.item.nombre.toUpperCase()); var x = el('button', 'jn-mapa-x', M, '✕'); x.onclick = function () { ui.mant.classList.remove('on'); mantO = null; };
    var L = el('div', 'jn-fl-lista', M), pc = Math.round(o.vida);
    el('div', 'jn-vida', L, '<div class="jn-vida-b"><i style="width:' + pc + '%;background:' + (o.vida <= 0 ? '#ff4d4d' : o.vida < 35 ? '#ffb02e' : '#5dff9a') + '"></i></div><b>' + estadoVida(o) + ' · ' + pc + '%</b>');
    el('div', 'jn-lb-nota', L, o.vida <= 0 ? 'En ruinas: no funciona hasta que le pongas materiales y se recupere.' : 'Gasta por día: ' + Object.keys(o.mant).map(function (k) { return o.mant[k] + ' ' + E.Iconos.RES[k].n.toLowerCase(); }).join(' y ') + '. Si se queda sin ellos pierde vida (en unos 3 días queda en ruinas); con materiales se recupera.');
    el('div', 'jn-fl-sub', L, 'BODEGA DEL EDIFICIO');
    var g = el('div', 'jn-grid', L), iv = invL();
    Object.keys(o.mant).forEach(function (k) {
      var cap = capBod(o, k), have = Math.floor(o.bod[k] || 0), c = E.Iconos.cuadro(g, { icono: k, titulo: E.Iconos.RES[k].n, sub: have + ' / ' + cap + ' · en tu inventario: ' + (iv[k] || 0), badge: have });
      var f = el('div', 'jn-fl-bt', c);
      [10, 50, 1e9].forEach(function (n) { var b = el('button', 'jn-btn', f, n > 1e6 ? 'TODO' : '+' + n); b.disabled = !(iv[k] > 0) || have >= cap; b.onclick = function () {
        var iv2 = invL(), q = Math.min(n, iv2[k] || 0, cap - Math.floor(o.bod[k] || 0)); if (q <= 0) return; iv2[k] -= q; guardar('inv', iv2); o.bod[k] = (o.bod[k] || 0) + q; guardarBase(); pintarMant(); }; });
    });
    L.scrollTop = sy;
  }
  function actualizarUI() {
    if (!ui) return; var pon = !!(ghost || itemSel), pie = modoPie, sen = !!sentado;
    function vis(b, v) { b.style.display = v ? '' : 'none'; }
    ui.tit.textContent = pl ? pl.nombre.toUpperCase() + ' · BASE ' + nEst() + '/' + MAX_EST + (colocadas.length > nEst() ? ' · DEFENSAS ' + (colocadas.length - nEst()) : '') : '';
    vis(ui.bPerro, !!datosPerro() && !pon && !modoBorrar && !sen); vis(ui.bCons, !modoCons && !pon && !modoBorrar && !sen); vis(ui.bEdif, !modoCons && !pon && !modoBorrar && !sen); vis(ui.bMej, modoCons && !!cercaM && pie && !sen); vis(ui.bSalC, modoCons && !sen); if (cercaM && cercaM.item.mejora) { var cm2 = COSTOS[cercaM.item.mejora]; ui.bMej.textContent = 'MEJORAR A ' + itemDe(cercaM.item.mejora).nombre.split('(')[0].replace('Base de ', '').toUpperCase().trim(); } vis(ui.hot, !sen); vis(ui.bMoch, !sen); vis(ui.bCol, pon); vis(ui.bRot, pon); vis(ui.bCan, pon);
    vis(ui.bNave, !sen && !pon && !(!pie && modoBorrar)); vis(ui.bBor, modoCons || (!pie && !pon)); ui.bBor.textContent = modoBorrar ? 'LISTO' : 'DEMOLER'; vis(ui.bDes, !sen && !pon);
    vis(ui.bTer, pie && !sen); ui.bTer.textContent = terceraP ? '1.ª PERSONA' : '3.ª PERSONA';
    vis(ui.bPie, !sen && !pon && !modoBorrar); ui.bPie.textContent = pie ? 'VISTA BASE' : 'BAJAR A PIE'; vis(ui.bCor, pie && !sen && !pon); vis(ui.bSen, sen); ui.bUsar.style.display = (pie && !sen && !pon && (cercaT || cercaG || cercaB || cercaN)) ? 'flex' : 'none'; vis(ui.bSal, pie && !sen && !pon); vis(ui.bVol, pie && !sen && !pon); vis(ui.bGol, pie && !sen && !pon);
    (function () { var it = ghost ? ghost.item : itemSel, co = it && !it.defensa ? COSTOS[it.id] : null, ok = true, t = '', k, iv = invL();
      if (modoCons && it) { if (it.defensa) { var n0 = stockDe(it.id); ok = n0 > 0; t = it.nombre.toUpperCase() + ' · TE QUEDAN ' + n0; } else if (co) { for (k in co) { var h = jug.pruebas ? co[k] : (iv[k] || 0); if (h < co[k]) ok = false; t += (t ? '   ' : '') + k.toUpperCase() + ' ' + h + ' / ' + co[k]; } if (jug.pruebas) t = 'MODO PRUEBAS · SIN COSTO'; } }
      ui.recur.textContent = modoCons && it ? t : ''; ui.recur.style.color = ok ? '#9dff9d' : '#ff6b6b'; ui.bCol.classList.toggle('rojo', !ok); })();
    vis(ui.bRec, sen); vis(ui.bFue, sen); vis(ui.mira, pie); ui.tor.style.display = sen ? 'grid' : 'none'; if (!sen) { ui.mira.style.left = ui.mira.style.top = ''; tIx = tIy = 0; } ui.izq.style.display = pie ? 'none' : '';
    ui.est.textContent = cargando ? 'Descargando ' + cargando + '…' : (itemSel && !ghost ? 'Preparando…' : (ghost ? 'Mueve la cámara para elegir el sitio · verde = cabe' : ''));
    rejilla.visible = pon && !pie && !(ghost && ghost.item.defensa); anillo.visible = !!(modoCons || ghost);
  }
  /* ---- el personaje: el soldado espacial del lobby, visto en primera persona (cabeza oculta, se ven sus brazos y su cuerpo) ---- */
  var LB = 0.29, LA = 0.26, hand = { izq: null, der: null }, wk = 0, ag = null;
  var manosPrem = null, premPide = false, terceraP = false;
  function crearPremiumPie() {   // si tienes equipado el soldado premium, a pie se ve ese cuerpo (con la misma animación)
    var quiere = !!(E.Tienda && E.Tienda.tieneSkin('premium') && leer('soldadoSkin', 'estandar') === 'premium');
    if (!quiere) { if (manosPrem) { sc.remove(manosPrem.u.group); manosPrem = null; } return; }
    if (manosPrem || premPide || !global.AnimHombre) return; premPide = true;
    E.Tienda.cargarPremium(function (ok) {
      premPide = false; if (!ok || !sc || manosPrem || typeof global.createSoldadoPremium !== 'function') return;
      try {
        var u = global.createSoldadoPremium(THREE), hb = u.esqueleto.huesos, i; u.group.scale.setScalar(1.8 / u.alto);
        var hd = null; for (i = 0; i < hb.length; i++) if (hb[i].name === 'Head') hd = hb[i];
        u.group.visible = false; sc.add(u.group); var an = global.AnimHombre.nuevo(global.AnimHombre.adaptar(u)); an.sinEmote = true; manosPrem = { u: u, an: an, head: hd, headS: hd ? hd.scale.clone() : null, headT: hd ? hd.scale.clone().multiplyScalar(0.001) : null };   // en 1.ª persona sin cabeza: la cámara está dentro
      } catch (e) { if (global.console) console.error('Premium a pie', e); }
    });
  }
  function crearManosPie() {
    if (manosPie || typeof global.createSoldadoEspacialV2 !== 'function') return;
    var u; try { u = global.createSoldadoEspacialV2(THREE, { metersPerUnit: 1, height: 1.8, armor: jug.acento, glow: 0x62d6ff }); } catch (e) { return; }
    var pa = u.parts; pa.head.visible = false; sc.add(u.group); u.group.updateMatrixWorld(true);
    var v = new THREE.Vector3(); pa.head.getWorldPosition(v); var eye = v.y; pa.legL.getWorldPosition(v);
    manosPie = { u: u, pa: pa, eye: eye, hip: v.y, body: pa.armL.parent, by0: pa.armL.parent.position.y };
    try {   // llamas del jetpack bajo los dos propulsores de la espalda
      var fm = new THREE.MeshBasicMaterial({ color: 0x8feaff, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false }), fg = new THREE.ConeGeometry(0.07, 0.5, 8), ll = [];
      [-1, 1].forEach(function (sd) { var c = new THREE.Mesh(fg, fm); c.rotation.x = PI; c.position.set(sd * 0.17, 0.98, -0.3); c.visible = false; u.group.add(c); ll.push(c); });
      manosPie.llamas = ll;
    } catch (ef) { }
    if (!ag) ag = { sitio: new THREE.Vector3(), izq: new THREE.Vector3(), der: new THREE.Vector3(), vol: new THREE.Vector3(), ang: 0, volR: 0 };
  }
  function lerp(a, b, k) { return a + (b - a) * k; }
  function ik(brazo, codo, T, lado) {   // dos huesos: el hombro apunta y el codo se dobla para que la mano llegue a T (mundo)
    var body = manosPie.body, tl = body.worldToLocal(T.clone()), S = brazo.position;
    var dx = tl.x - S.x, dy = tl.y - S.y, dz = tl.z - S.z, D = Math.sqrt(dx * dx + dy * dy + dz * dz) || 0.001, mx = LB + LA - 0.004;
    var Dc = Math.min(Math.max(D, 0.1), mx), cf = Math.max(-1, Math.min(1, (Dc * Dc - LB * LB - LA * LA) / (2 * LB * LA))), phi = Math.acos(cf), del = Math.asin(Math.min(1, LA * Math.sin(phi) / Dc));
    var d = [dx / D, dy / D, dz / D], p = [lado * 0.6, -1, -0.3], pd = p[0] * d[0] + p[1] * d[1] + p[2] * d[2]; p = [p[0] - pd * d[0], p[1] - pd * d[1], p[2] - pd * d[2]]; var pl = Math.sqrt(p[0] * p[0] + p[1] * p[1] + p[2] * p[2]) || 1; p = [p[0] / pl, p[1] / pl, p[2] / pl];
    var cd = Math.cos(del), sdl = Math.sin(del), uu = [d[0] * cd + p[0] * sdl, d[1] * cd + p[1] * sdl, d[2] * cd + p[2] * sdl];
    var E = [S.x + uu[0] * LB, S.y + uu[1] * LB, S.z + uu[2] * LB], f = [S.x + d[0] * Dc - E[0], S.y + d[1] * Dc - E[1], S.z + d[2] * Dc - E[2]], fl = Math.sqrt(f[0] * f[0] + f[1] * f[1] + f[2] * f[2]) || 1; f = [f[0] / fl, f[1] / fl, f[2] / fl];
    var fu = f[0] * uu[0] + f[1] * uu[1] + f[2] * uu[2], b = [f[0] - fu * uu[0], f[1] - fu * uu[1], f[2] - fu * uu[2]], bl = Math.sqrt(b[0] * b[0] + b[1] * b[1] + b[2] * b[2]); b = bl < 1e-4 ? [0, 0, 1] : [b[0] / bl, b[1] / bl, b[2] / bl];
    var Y = [-uu[0], -uu[1], -uu[2]], Z = b, X = [Y[1] * Z[2] - Y[2] * Z[1], Y[2] * Z[0] - Y[0] * Z[2], Y[0] * Z[1] - Y[1] * Z[0]];
    var m11 = X[0], m12 = Y[0], m13 = Z[0], m21 = X[1], m22 = Y[1], m23 = Z[1], m31 = X[2], m32 = Y[2], m33 = Z[2], tr = m11 + m22 + m33, qx, qy, qz, qw, r;
    if (tr > 0) { r = Math.sqrt(tr + 1) * 2; qw = r / 4; qx = (m32 - m23) / r; qy = (m13 - m31) / r; qz = (m21 - m12) / r; }
    else if (m11 > m22 && m11 > m33) { r = Math.sqrt(1 + m11 - m22 - m33) * 2; qw = (m32 - m23) / r; qx = r / 4; qy = (m12 + m21) / r; qz = (m13 + m31) / r; }
    else if (m22 > m33) { r = Math.sqrt(1 + m22 - m11 - m33) * 2; qw = (m13 - m31) / r; qx = (m12 + m21) / r; qy = r / 4; qz = (m23 + m32) / r; }
    else { r = Math.sqrt(1 + m33 - m11 - m22) * 2; qw = (m21 - m12) / r; qx = (m13 + m31) / r; qy = (m23 + m32) / r; qz = r / 4; }
    brazo.quaternion.set(qx, qy, qz, qw); codo.rotation.set(-phi, 0, 0);
  }
  function golpePose(k) {   // k 0..1: preparar, golpear, recoger → [hombro, codo]
    if (k < 0.3) { var a = k / 0.3; return [lerp(-1.4, -1.15, a), lerp(-0.25, -1.7, a)]; }
    if (k < 0.55) { var b = (k - 0.3) / 0.25; return [lerp(-1.15, -1.5, b), lerp(-1.7, -0.02, b)]; }
    var c = (k - 0.55) / 0.45; return [lerp(-1.5, -1.4, c), lerp(-0.02, -0.25, c)];
  }
  function animarNado(t, dt, mag) {   // nadar (crol) en movimiento, flotar en el sitio; el cuerpo se tumba al nadar
    var mueve = mag > 0.15, th, al = pyaw + PI, sa, ca, hy, grp, an, estado = mueve ? 'swim' : 'float';
    nadoTilt += ((mueve ? 1.25 : 0) - nadoTilt) * Math.min(1, dt * 4); th = nadoTilt; sa = Math.sin(al); ca = Math.cos(al); hy = pyF + 0.95 + 0.4 * (th / 1.25);
    function colocar(g) { g.rotation.order = 'YXZ'; g.rotation.set(th, al, 0); g.position.set(px - 0.95 * Math.sin(th) * sa, hy - 0.95 * Math.cos(th), pz - 0.95 * Math.sin(th) * ca); }
    var g0 = manosPie.u.group, pa = manosPie.pa;
    if (manosPrem) {
      g0.visible = false; grp = manosPrem.u.group; grp.visible = true; colocar(grp); manosPrem.an.ajuste = null; manosPrem.an.update(dt, estado, 1);
      if (manosPrem.head) manosPrem.head.scale.copy(terceraP ? manosPrem.headS : manosPrem.headT); return;
    }
    if (terceraP) {
      g0.visible = true; pa.head.visible = true; colocar(g0); manosPie.tercera = true;
      if (!manosPie.an && global.AnimHombre) { manosPie.an = global.AnimHombre.nuevo(global.AnimHombre.adaptar(manosPie.u)); manosPie.an.sinEmote = true; }
      if (manosPie.an) { manosPie.an.update(dt, estado, 1); return; }
    }
    g0.visible = true; g0.rotation.set(0, al, 0); g0.position.set(px, pyF, pz); var ph = t * (mueve ? 5 : 2.2);   // 1.ª persona: solo se ven los brazos braceando
    pa.armR.rotation.set(-(mueve ? 1.2 + 1.4 * Math.cos(ph) : 0.9 + 0.3 * Math.sin(ph)), 0, 0.07); pa.armL.rotation.set(-(mueve ? 1.2 + 1.4 * Math.cos(ph + PI) : 0.9 + 0.3 * Math.sin(ph + PI)), 0, -0.07);
    pa.forearmR.rotation.set(-(0.2 + (mueve ? 0.9 * Math.max(0, -Math.sin(ph)) : 0.4)), 0, 0); pa.forearmL.rotation.set(-(0.2 + (mueve ? 0.9 * Math.max(0, Math.sin(ph)) : 0.4)), 0, 0);
    g0.updateMatrixWorld(true);
  }
  function animarManos(t, dt, mag) {   // a pie: el soldado camina; los brazos van "en guardia" y se balancean
    if (nadando && manosPie) { try { animarNado(t, dt, mag); return; } catch (en) { if (global.console) console.error(en); } }
    nadoTilt = 0;
    if (!manosPie) return; var pa = manosPie.pa, g = manosPie.u.group, ph = t * (correr ? 11 : 7), sw = Math.sin(ph) * mag, cw = Math.cos(ph) * mag, gk = golpeT > 0 ? golpePose(1 - golpeT / 0.45) : null;
    if (manosPrem && !sentado) {
      var pg = manosPrem.u.group, up0 = -ppit * 0.55, amp0 = correr ? 0.55 : 0.28, ab0 = Math.abs(sw) * 0.15 + (correr ? 0.6 : 0);
      g.visible = false; pg.visible = true; pg.position.set(px, pyF + saltoY, pz); pg.rotation.set(0, pyaw + PI, 0);
      if (manosPrem.head) manosPrem.head.scale.copy(terceraP ? manosPrem.headS : manosPrem.headT);
      manosPrem.an.ajuste = terceraP ? null : function (P) {   // brazos "en guardia" siguiendo hacia dónde miras
        P.lean *= 0.25; P.hipTwist *= 0.25; P.spTwist *= 0.25; P.spRoll = 0; P.headP = 0; P.headY = 0;
        P.aRf = 1.4 - up0 - cw * amp0 * 0.5; P.aRe = 0.25 + ab0; P.aRa = 0.07; P.aRw = 0;
        P.aLf = gk ? -gk[0] - up0 : 1.4 - up0 + cw * amp0 * 0.5; P.aLe = gk ? -gk[1] : 0.25 + ab0; P.aLa = 0.07; P.aLw = 0;
      };
      manosPrem.an.update(dt, saltoY > 0.02 ? 'jump' : (mag > 0.15 ? (correr ? 'run' : 'walk') : 'idle'), 1);
      return;
    }
    if (manosPrem) manosPrem.u.group.visible = false;
    if (terceraP) {   // 3.ª persona: el cuerpo entero con la animación normal (reposo / caminar / correr / saltar)
      g.visible = true; pa.head.visible = true; g.position.set(px, pyF + saltoY, pz); g.rotation.set(0, pyaw + PI, 0); manosPie.tercera = true;
      if (!manosPie.an && global.AnimHombre) { try { manosPie.an = global.AnimHombre.nuevo(global.AnimHombre.adaptar(manosPie.u)); manosPie.an.sinEmote = true; } catch (ea) { } }
      if (manosPie.an) { manosPie.an.update(dt, saltoY > 0.02 ? 'jump' : (mag > 0.15 ? (correr ? 'run' : 'walk') : 'idle'), 1); return; }
    } else if (manosPie.tercera) { manosPie.tercera = false; pa.head.visible = false; manosPie.body.rotation.set(0, 0, 0); manosPie.body.position.y = manosPie.by0; }
    g.visible = true; g.position.set(px, pyF + saltoY, pz); g.rotation.set(0, pyaw + PI, 0);
    var amp = correr ? 0.55 : 0.28, up = -ppit * 0.55;
    pa.armR.rotation.set(-1.4 + up + cw * amp * 0.5, 0, 0.07); pa.forearmR.rotation.set(-0.25 - Math.abs(sw) * 0.15 - (correr ? 0.6 : 0), 0, 0);
    pa.armL.rotation.set((gk ? gk[0] : -1.4 - cw * amp * 0.5) + up, 0, -0.07); pa.forearmL.rotation.set(gk ? gk[1] : -0.25 - Math.abs(sw) * 0.15 - (correr ? 0.6 : 0), 0, 0);
    var air = saltoY > 0.02 ? 0.6 : 0; pa.legL.rotation.set(sw * (correr ? 0.9 : 0.5) - air, 0, 0); pa.legR.rotation.set(-sw * (correr ? 0.9 : 0.5) - air * 0.3, 0, 0);
    pa.shinL.rotation.set(Math.max(0, -sw) * (correr ? 1.0 : 0.5) + air, 0, 0); pa.shinR.rotation.set(Math.max(0, sw) * (correr ? 1.0 : 0.5) + air * 0.4, 0, 0);
    g.updateMatrixWorld(true);
  }
  function sentadoPose(t, dt, ax, ay, api) {   // sentado: el soldado en el asiento, manos en las dos palancas; la mano derecha gira la manivela al subir/bajar
    var pa = manosPie.pa, g = manosPie.u.group; api.agarres(ag);
    if (manosPrem) manosPrem.u.group.visible = false;
    g.visible = true; g.rotation.set(0, ag.ang, 0); g.position.set(ag.sitio.x, ag.sitio.y - manosPie.hip + 0.03, ag.sitio.z); g.updateMatrixWorld(true);
    pa.legL.rotation.set(-1.45, 0, -0.05); pa.legR.rotation.set(-1.45, 0, 0.05); pa.shinL.rotation.set(1.4, 0, 0); pa.shinR.rotation.set(1.4, 0, 0); g.updateMatrixWorld(true);
    wk += ((Math.abs(ay) > 0.12 ? 1 : 0) - wk) * Math.min(1, dt * 7);
    var tD = ag.der.clone().lerp(ag.vol, wk);
    ik(pa.armL, pa.forearmL, tD, -1); ik(pa.armR, pa.forearmR, ag.izq, 1); g.updateMatrixWorld(true);
    pa.head.getWorldPosition(vA);
  }
  function entrarPie() {
    aire = 100; nadando = false;
    quitarGhost(); modoBorrar = false; modoCons = false; modoPie = true; px = fx; pz = fz; if (Math.hypot(px, pz) > RADIO_BASE) { px = 0; pz = 160; } pyaw = yaw + PI; ppit = 0; sentado = null;
    saltoY = 0; saltoV = 0; golpeT = 0; pyF = hT(px, pz); fallV = 0; cm.x = 1e9; crearManosPie(); crearPremiumPie(); if (manosPie) manosPie.u.group.visible = true; cam.fov = 75; cam.near = 0.05; cam.updateProjectionMatrix(); actualizarUI(); toast('A PIE · IZQUIERDA MUEVE · DERECHA MIRA', 2.4);
  }
  function salirPie() {
    nadando = false; nUp = nDown = false; aire = 100; visAgua(false);
    if (sentado) levantarse(); if (manosPie) manosPie.u.group.visible = false; if (manosPrem) manosPrem.u.group.visible = false; modoPie = false; fx = px; fz = pz; yaw = pyaw + PI; cam.fov = 60; cam.near = 1; cam.updateProjectionMatrix(); stk = null; lookId = null; ui.sb.style.display = ui.sk.style.display = 'none'; actualizarUI();
  }
  function sentarse(o) { sentado = o; wk = 0; try { o.api.vistaArtillero && o.api.vistaArtillero(true); } catch (e) { } stk = null; ui.sb.style.display = ui.sk.style.display = 'none'; toast('ARTILLERO · IZQUIERDA APUNTA', 2); actualizarUI(); }
  function levantarse() { if (!sentado) return; sentado.api.disparar(false); sentado.api.apuntar(0, 0); try { sentado.api.vistaArtillero && sentado.api.vistaArtillero(false); } catch (e) { } px = sentado.x + 3.5; pz = sentado.z + 3.5; sentado = null; actualizarUI(); }
  function tiempoViaje() { var s = Math.max(0, Math.ceil((viajeFin - Date.now()) / 1000)); return Math.floor(s / 60) + ':' + ('0' + (s % 60)).slice(-2); }
  function despegar() {
    if (!ret) { irA('lobby'); return; }
    var r = ret; irA('mundo', { modo: r.modo, retorno: r });
  }

  function camara() {
    cam.position.set(fx + dist * Math.sin(yaw) * Math.cos(pit), dist * Math.sin(pit) + 2, fz + dist * Math.cos(yaw) * Math.cos(pit)); cam.lookAt(fx, 0, fz);
  }
  function redimensionar5(w, h) { if (!cam) return; cam.aspect = w / h; cam.updateProjectionMatrix(); }

  function punteroPie(tipo, e) {
    var W = E.ancho;
    if (tipo === 'abajo') {
      if (e.clientX < W * 0.45 && !stk && !sentado) { stk = { id: e.pointerId, x0: e.clientX, y0: e.clientY, ax: 0, ay: 0 }; ui.sb.style.cssText = 'display:block;left:' + (e.clientX - 55) + 'px;top:' + (e.clientY - 55) + 'px'; ui.sk.style.cssText = 'display:block;left:' + (e.clientX - 24) + 'px;top:' + (e.clientY - 24) + 'px'; }
      else if (lookId === null && !sentado) lookId = { id: e.pointerId, x: e.clientX, y: e.clientY };
    } else if (tipo === 'mueve') {
      if (stk && stk.id === e.pointerId) { var dx = e.clientX - stk.x0, dy = e.clientY - stk.y0, m = Math.hypot(dx, dy), k = m > 55 ? 55 / m : 1; stk.ax = dx * k / 55; stk.ay = dy * k / 55; ui.sk.style.left = (stk.x0 + dx * k - 24) + 'px'; ui.sk.style.top = (stk.y0 + dy * k - 24) + 'px'; }
      else if (lookId && lookId.id === e.pointerId) { pyaw -= (e.clientX - lookId.x) * 0.005; ppit = clamp(ppit - (e.clientY - lookId.y) * 0.004, -1.4, 1.4); lookId.x = e.clientX; lookId.y = e.clientY; }
    } else if (tipo === 'arriba') {
      if (stk && stk.id === e.pointerId) { stk = null; ui.sb.style.display = ui.sk.style.display = 'none'; if (sentado) sentado.api.apuntar(0, 0); }
      if (lookId && lookId.id === e.pointerId) lookId = null;
    }
  }
  /* ---- colisión con la malla real de las construcciones (pistas y la ciudad): paredes y pisos ---- */
  var STEP = 1.6, o3 = null, d3 = null;
  function solida(m) {   // solo lo que de verdad es sólido: fuera haces, halos, cristales tenues, brillos y mallas ocultas
    var mt = m.material, i, q; if (!mt) return true; var ls = Array.isArray(mt) ? mt : [mt], n = 0;
    for (i = 0; i < ls.length; i++) { q = ls[i]; if (!q || q.visible === false) continue; if (q.transparent && q.opacity < 0.6) continue; if (q.blending === THREE.AdditiveBlending) continue; if (q.depthWrite === false && q.transparent) continue; n++; }
    if (!n) return false; if (/glow|beam|halo|haz|luz|light|aura|zona|field|campo|shield|escudo|holo|ghost|fantasma|sombra_suelo|shadow/i.test(m.name || '')) return false; return true;
  }
  function cajasDe(o) {
    if (o._cj) return o._cj; var lst = []; o.g.updateMatrixWorld(true);
    if (o.item.base && o.api && o.api.shape) {   // las bases chocan con UN bloque exacto (su forma), no con cientos de piedritas
      var Sd = 3.03, TP = o.api.topY || 0.8, geo, bx;   // un pelín más grande: así las bases vecinas se solapan y no queda rendija por la que caer
      if (o.api.shape === 'triangle') { var Rr = 3.04 / Math.sqrt(3), sh = new THREE.Shape(); sh.moveTo(0, -Rr); sh.lineTo(1.52, Rr / 2); sh.lineTo(-1.52, Rr / 2); geo = new THREE.ExtrudeGeometry(sh, { depth: TP, bevelEnabled: false }); geo.rotateX(-Math.PI / 2); }
      else { geo = new THREE.BoxGeometry(Sd, TP, Sd); geo.translate(0, TP / 2, 0); }
      var px0 = new THREE.Mesh(geo, new THREE.MeshBasicMaterial()); px0.visible = false; px0.name = 'colision_base'; o.api.group.add(px0); o.g.updateMatrixWorld(true);
      bx = new THREE.Box3().setFromObject(px0); o._cj = [{ m: px0, b: bx }]; return o._cj;
    }
    o.g.traverse(function (m) {
      if (!m.isMesh || !m.geometry || !m.visible || !solida(m)) return;
      var b = new THREE.Box3().setFromObject(m); if (!isFinite(b.min.x) || !isFinite(b.max.x)) return;
      if (Math.max(b.max.x - b.min.x, b.max.y - b.min.y, b.max.z - b.min.z) < 0.4) return; lst.push({ m: m, b: b });
    });
    o._cj = lst; return lst;
  }
  function candidatos(x, z) {   // mallas cercanas al jugador (se recalcula al moverse unos metros)
    if (Math.hypot(x - cm.x, z - cm.z) < 3 && cm.n === colocadas.length) return cm.list;
    var lst = [], i, j, o, cj, c, now = Date.now();
    for (i = 0; i < colocadas.length; i++) {
      o = colocadas[i]; if (o.item.defensa || o.item.arma || (o.fin && o.fin > now && !o.item.base) || Math.hypot(x - o.x, z - o.z) > o.r + 40) continue;
      cj = cajasDe(o); for (j = 0; j < cj.length; j++) { c = cj[j].b; if (c.max.x < x - 16 || c.min.x > x + 16 || c.max.z < z - 16 || c.min.z > z + 16) continue; lst.push(cj[j].m); }
    }
    cm.x = x; cm.z = z; cm.list = lst; cm.n = colocadas.length; return lst;
  }
  function normalMundo(h, fb) {
    if (h.face && h.object) { var n = h.face.normal.clone().transformDirection(h.object.matrixWorld); return n; } return fb;
  }
  function rayoH(x, y, z, dx, dz, L, cand) {
    var k, best = null, hs = [STEP + 0.2, 2.2], hits;
    for (k = 0; k < hs.length; k++) { o3.set(x, y + hs[k], z); d3.set(dx, 0, dz); rc.set(o3, d3); rc.near = 0; rc.far = L; hits = rc.intersectObjects(cand, false); if (hits.length && (!best || hits[0].distance < best.distance)) best = hits[0]; }
    return best;
  }
  function pared(x, y, z, mx, mz, cand) {   // devuelve el movimiento permitido: se desliza por las paredes
    var L = Math.hypot(mx, mz); if (L < 1e-5) return [mx, mz];
    var h = rayoH(x, y, z, mx / L, mz / L, L + 0.5, cand); if (!h) return [mx, mz];
    var n = normalMundo(h, null); if (!n) return [0, 0]; n.y = 0; var nl = Math.hypot(n.x, n.z); if (nl < 1e-3) return [0, 0]; n.x /= nl; n.z /= nl;
    var dp = mx * n.x + mz * n.z; if (dp < 0) { mx -= n.x * dp; mz -= n.z * dp; }
    L = Math.hypot(mx, mz); if (L < 1e-5) return [0, 0];
    return rayoH(x, y, z, mx / L, mz / L, L + 0.5, cand) ? [0, 0] : [mx, mz];
  }
  function sueloEn(x, z, y, cand) {   // altura del suelo bajo (x, z): la primera cara que mira hacia arriba
    var i, hits, n; o3.set(x, y + STEP + 0.2, z); d3.set(0, -1, 0); rc.set(o3, d3); rc.near = 0; rc.far = STEP + 0.2 + 120; hits = rc.intersectObjects(cand, false);
    for (i = 0; i < hits.length; i++) { n = normalMundo(hits[i], null); if (!n || n.y > 0.35) return { y: hits[i].point.y, bloq: hits[i].point.y > y + STEP }; }
    return { y: hT(x, z), bloq: false };
  }
  function moverConColision(mx, mz, dt) {
    var cand = null; try { if (!rc) { rc = new THREE.Raycaster(); o3 = new THREE.Vector3(); d3 = new THREE.Vector3(); } cand = candidatos(px, pz); } catch (e) { cand = null; }
    if (TER && AGUA_Y - hT(px + mx, pz + mz) > 1.2) { px += mx; pz += mz; return; }   // agua profunda: se nada (la altura la lleva actualizarPie)
    if (!cand || !cand.length) { px += mx; pz += mz; var tg = hT(px, pz); if (pyF > tg + 0.02) { fallV = Math.min(fallV + 25 * dt, 40); pyF = Math.max(tg, pyF - fallV * dt); } else { pyF += Math.min(tg - pyF, 14 * dt + 0.02); fallV = 0; } return; }
    try {
      var r = pared(px, pyF, pz, mx, mz, cand), nx = px + r[0], nz = pz + r[1], sf = sueloEn(nx, nz, pyF, cand);
      if (sf.bloq) { var sx = sueloEn(nx, pz, pyF, cand), sz = sueloEn(px, nz, pyF, cand); if (!sx.bloq && Math.abs(r[0]) > 1e-4) { nz = pz; sf = sx; } else if (!sz.bloq && Math.abs(r[1]) > 1e-4) { nx = px; sf = sz; } else { nx = px; nz = pz; sf = sueloEn(px, pz, pyF, cand); } }
      px = nx; pz = nz;
      if (sf.y > pyF) { pyF += Math.min(sf.y - pyF, 14 * dt + 0.02); fallV = 0; } else if (sf.y < pyF - 0.02) { fallV = Math.min(fallV + 25 * dt, 40); pyF = Math.max(sf.y, pyF - fallV * dt); } else { pyF = sf.y; fallV = 0; }
    } catch (e) { px += mx; pz += mz; }
  }
  function pisoY(o, i) { return (o.api.group.position.y + o.api.torre.pisos[i]) * (o.item.esc || 4); }
  function panelEdificio() {   // ascensor y hangares de la ciudad-torre
    var i, o, ciu = null, nivelJ = 0, key, tw, h, b;
    for (i = 0; i < colocadas.length; i++) { o = colocadas[i]; if (o.api && o.api.torre && !(o.fin && o.fin > Date.now()) && !(o.vida <= 0) && Math.hypot(px - o.x, pz - o.z) < (o.api.torre.ascensorRadio + 3) * (o.item.esc || 4)) { ciu = o; break; } }
    if (!ciu) { if (ascKey !== '') { ascKey = ''; ui.asc.style.display = 'none'; } return; }
    tw = ciu.api.torre; for (i = 0; i < 3; i++) if (Math.abs(pyF - pisoY(ciu, i)) < Math.abs(pyF - pisoY(ciu, nivelJ))) nivelJ = i;
    var hg = ciu.api.hangares ? ciu.api.hangares() : [], oc = tw.ocupado();
    key = nivelJ + '|' + tw.nivel() + '|' + oc + '|' + (nivelJ === 1 ? hg.map(function (q) { return (q.abierto ? 1 : 0) + (q.manual ? 'm' : ''); }).join(',') : '');
    if (pendAsc != null && !oc) { var pa = pendAsc; pendAsc = null; if (tw.nivel() !== pa) tw.ir(pa); }
    if (key === ascKey) return; ascKey = key; ui.asc.innerHTML = ''; ui.asc.style.display = 'flex';
    el('b', '', ui.asc, 'ASCENSOR · ' + ['CALLE', 'HANGARES', 'AZOTEA'][nivelJ]);
    ['PISO 1 · CALLE', 'PISO 2 · HANGARES', 'AZOTEA'].forEach(function (nm, ix) {
      if (ix === nivelJ) return; var bt = el('button', 'jn-btn', ui.asc, 'IR A ' + nm); bt.disabled = !!oc;
      bt.onclick = function () { if (tw.ocupado()) { toast('EL ASCENSOR ESTÁ EN USO', 1.4); return; } if (tw.nivel() !== nivelJ) { tw.ir(nivelJ); pendAsc = ix; toast('EL ASCENSOR VIENE A TU PISO…', 1.6); } else { tw.ir(ix); toast('SUBIENDO…', 1.2); } };
    });
    if (nivelJ === 1 && hg.length) { el('b', '', ui.asc, 'HANGARES'); hg.forEach(function (q, ix) { var bt = el('button', 'jn-btn', ui.asc, 'HANGAR ' + (ix + 1) + ' · ' + (q.manual ? 'CERRAR' : q.abierto ? 'ABIERTO (CERRAR)' : 'ABRIR') + (q.ocupado ? ' · con nave' : '')); bt.onclick = function () { ciu.api.hangar(ix, !q.manual); ascKey = ''; }; }); }
  }
  /* ---- rendimiento: las estructuras gigantes solo se animan si importan, y las piezas pequeñas lejanas se ocultan ---- */
  var frN = 0, vCam = null, camFx = 0, camFz = 0;
  function lodDe(o) {   // piezas pequeñas (< 12 m): se ocultan cuando la cámara está lejos de ellas
    if (o._lod) return o._lod; var lst = []; o.g.updateMatrixWorld(true);
    o.g.traverse(function (m) {
      if (!m.isMesh || m.isInstancedMesh || !m.geometry) return; var g = m.geometry; if (!g.boundingSphere) g.computeBoundingSphere(); if (!g.boundingSphere) return;
      var c = g.boundingSphere.center.clone().applyMatrix4(m.matrixWorld), r = g.boundingSphere.radius * (m.matrixWorld.getMaxScaleOnAxis ? m.matrixWorld.getMaxScaleOnAxis() : 1);
      if (r < 12 && isFinite(r)) lst.push({ m: m, x: c.x, y: c.y, z: c.z, d2: Math.pow(Math.max(70, r * 160), 2), oc: false });
    });
    o._lod = lst; return lst;
  }
  function optimizarEstructuras(t) {
    var i, o, dx, dz, dd, k, j, L, q, dy, d2, cx = cam.position.x, cy = cam.position.y, cz = cam.position.z, ahora = Date.now();
    frN++;
    try { if (!vCam) vCam = new THREE.Vector3(); cam.getWorldDirection(vCam); camFx = vCam.x; camFz = vCam.z; } catch (e) { camFx = camFz = 0; }
    for (i = 0; i < colocadas.length; i++) {
      o = colocadas[i]; if (o === sentado) continue;
      dx = o.x - cx; dz = o.z - cz; dd = Math.sqrt(dx * dx + dz * dz) || 1;
      k = dd > o.r * 2 + 1500 ? 8 : (dd > o.r * 1.2 && (dx * camFx + dz * camFz) < -0.25 * dd) ? 4 : 2;   // lejos o a tu espalda: se actualiza menos
      if ((frN + i) % k === 0 && !o._ob) { try { o.api.update(t); } catch (e2) { } }
      if (frN % 6 === (i % 6) && !o.item.arma && !(o.fin && o.fin > ahora)) {   // LOD de piezas pequeñas
        L = lodDe(o);
        for (j = 0; j < L.length; j++) {
          q = L[j]; dx = q.x - cx; dy = q.y - cy; dz = q.z - cz; d2 = dx * dx + dy * dy + dz * dz;
          if (d2 > q.d2) { if (q.m.visible && !q.oc) { q.m.visible = false; q.oc = true; } } else if (q.oc) { q.m.visible = true; q.oc = false; }
        }
      }
    }
  }
  function choqueDefensa(o, dx, dz) {   // muros y portones: rectángulos orientados (pilares 2 × 2 m, pared de 1 m; el portón cerrado también bloquea el centro)
    var a = o.rot || 0, ca = Math.cos(a), sa = Math.sin(a), lx = dx * ca - dz * sa, lz = dx * sa + dz * ca, R = 0.4, rs = [];
    if (o.item.defensa === 'muro') rs.push([0, 3.5 * K + R, 1.1 * K + R]); else { rs.push([-2.5 * K, 1 * K + R, 1.1 * K + R], [2.5 * K, 1 * K + R, 1.1 * K + R]); if (!(o.ov > 0.5)) rs.push([0, 1.6 * K + R, 0.25 * K + R]); }
    var i, q, ex, ez, penx, penz;
    for (i = 0; i < rs.length; i++) { q = rs[i]; ex = lx - q[0]; ez = lz; if (Math.abs(ex) < q[1] && Math.abs(ez) < q[2]) { penx = q[1] - Math.abs(ex); penz = q[2] - Math.abs(ez); if (penx < penz) lx = q[0] + (ex >= 0 ? 1 : -1) * q[1]; else lz = (ez >= 0 ? 1 : -1) * q[2]; } }
    px = o.x + lx * ca + lz * sa; pz = o.z - lx * sa + lz * ca;
  }
  function actualizarPie(dt, t) {
    try { actualizarHierba(t); } catch (eh) { if (global.console) console.error(eh); }
    var i, o, ax = stk ? stk.ax : 0, ay = stk ? stk.ay : 0;
    if (!vA) { vA = new THREE.Vector3(); qA = new THREE.Quaternion(); }
    if (sentado) {
      sentado.api.apuntar(tIx, tIy); sentado.api.update(t); sentado.api.asiento(vA, qA); if (manosPie) { sentadoPose(t, dt, tIx, tIy, sentado.api); }
      if (!ag) ag = { sitio: new THREE.Vector3(), izq: new THREE.Vector3(), der: new THREE.Vector3(), vol: new THREE.Vector3(), ang: 0, volR: 0 };
      sentado.api.agarres(ag); var ev = sentado.api.elevacion(); vA.y += 0.75;   // cabeza fija: ni sube ni avanza; solo gira la mirada
      cam.position.copy(vA); cam.rotation.set(clamp(ev * 0.95 - 0.1, -0.15, 1.4), ag.ang + PI, 0, 'YXZ');   // como el cuello: la mirada sube con los cañones
      cam.updateMatrixWorld(true);
      if (!vB) { vB = new THREE.Vector3(); vC = new THREE.Vector3(); } sentado.api.boca(vB, vC); vB.addScaledVector(vC, 400); vB.project(cam);
      var mxp = clamp((vB.x * 0.5 + 0.5) * E.ancho, 24, E.ancho - 24), myp = clamp((0.5 - vB.y * 0.5) * E.alto, 24, E.alto - 24); if (vB.z > 1) { mxp = E.ancho / 2; myp = E.alto * 0.2; }
      ui.mira.style.left = mxp + 'px'; ui.mira.style.top = myp + 'px';
      ui.est.textContent = 'Munición: ' + sentado.api.municion() + (sentado.api.recargando() ? ' · recargando…' : ''); return;
    }
    var mag = Math.min(1, Math.hypot(ax, ay)), v = (correr ? 7.5 : 3.2) * (jetOn ? 2.2 : 1) * (nadando ? (correr ? 0.55 : 0.75) : 1) * mag, sn = Math.sin(pyaw), cs = Math.cos(pyaw);
    var mvx = 0, mvz = 0; if (mag > 0.05) { mvx = (-sn * (-ay) + cs * ax) * v / mag * dt; mvz = (-cs * (-ay) - sn * ax) * v / mag * dt; }
    moverConColision(mvx, mvz, dt);
    nadando = !!(TER && !sentado && AGUA_Y - hT(px, pz) > 1.2);
    if (nadando) {
      var vyN = (nUp ? 2.4 : 0) - (nDown ? 2.4 : 0) + (mag > 0.1 ? Math.sin(ppit) * (correr ? 4 : 2.6) * mag : 0); if (!nUp && !nDown && Math.abs(vyN) < 0.15) vyN = 0.7;
      var supN = AGUA_Y + olaH(px, pz, aguaT), pisoN = hT(px, pz) + 0.2, topeN = supN - 1.5; pyF = Math.min(topeN, Math.max(pisoN, pyF + vyN * dt)); fallV = 0; saltoY = 0; saltoV = 0;
      var bajoN = pyF + 1.7 < supN - 0.05; aire = bajoN ? Math.max(0, aire - dt * 2.2) : Math.min(100, aire + dt * 40);
      if (aire <= 0) { vidaJ -= dt * 9; if (vidaJ <= 0) { vidaJ = 100; aire = 100; px = 0; pz = 0; pyF = hT(0, 0); toast('TE AHOGASTE · REAPARECES', 2.4); } else if (((t * 2) | 0) % 4 === 0) toast('¡SIN AIRE! SUBE A LA SUPERFICIE', 0.6); }
    } else { nUp = nDown = false; aire = Math.min(100, aire + dt * 60); }
    ui.bBuc.style.display = nadando ? '' : 'none'; ui.aire.style.display = aire < 99.5 ? 'block' : 'none'; if (aire < 99.5) { ui.aireI.style.width = aire + '%'; ui.aire.classList.toggle('bajo', aire < 25); }
    if (TER) {   // planeta redondo: al llegar al este/oeste das la vuelta; al pasar el polo apareces al otro lado
      px = wrapX(px); if (pz > MUN.ZMAX) { pz = 2 * MUN.ZMAX - pz; px = wrapX(px + MUN.W / 2); pyaw += PI; } else if (pz < -MUN.ZMAX) { pz = -2 * MUN.ZMAX - pz; px = wrapX(px + MUN.W / 2); pyaw += PI; }
    } else { var d0 = Math.hypot(px, pz); if (d0 > RADIO_BASE + 200) { px *= (RADIO_BASE + 200) / d0; pz *= (RADIO_BASE + 200) / d0; } }
    cercaT = null; cercaG = null; cercaB = null; var cmN = null; cercaN = !!(naveBaja && naveY < 3 && !viajeFin && Math.hypot(px - naveX, pz - naveZ) < pad + 30);
    for (i = 0; i < colocadas.length; i++) {
      o = colocadas[i]; var dx = px - o.x, dz = pz - o.z, dd = Math.hypot(dx, dz) || 0.01;
      if (o.item.base && o.item.mejora && !o.fin && dd < o.r + 2 && (!cmN || dd < cmN._dm)) { o._dm = dd; cmN = o; }
      if (o.mant && !o.fin && dd < o.r + 10 && !(cercaB && cercaB._d < dd)) { o._d = dd; cercaB = o; }
      if (o.item.defensa) { if (esMuro(o) && !o.fin && dd < 9 * K && saltoY < 3) { if (o.item.defensa === 'porton' && dd < 5.5 * K) cercaG = o; choqueDefensa(o, dx, dz); } continue; }
      if (o.item.arma && !o.fin && dd < 6.5) cercaT = o;
      if (!o.item.plano && (o.item.arma || !cajasDe(o).length) && saltoY < 3) { var lim = o.r * 0.85 + 0.6; if (dd < lim) { px = o.x + dx / dd * lim; pz = o.z + dz / dd * lim; } }
      else if (o.item.arma && dd < 1.6) { px = o.x + dx / dd * 1.6; pz = o.z + dz / dd * 1.6; }
    }
    if (naveBaja && naveY < 8) { var dn = Math.hypot(px - naveX, pz - naveZ), ln = pad * 0.55; if (dn < ln) { px = naveX + (px - naveX) / (dn || 1) * ln; pz = naveZ + (pz - naveZ) / (dn || 1) * ln; } }
    panelEdificio();
    if (cmN !== cercaM) { cercaM = cmN; actualizarUI(); }
    if (!!(cercaT || cercaG || cercaB) !== !!ui._ct) { ui._ct = !!(cercaT || cercaG || cercaB); actualizarUI(); }
    jetOn = volar && jet > 0.01 && !sentado;
    if (jetOn) { saltoV = Math.min(saltoV + 34 * dt, 7.5); jet = Math.max(0, jet - 0.22 * dt); }
    else if (saltoY <= 0.01) jet = Math.min(1, jet + 0.45 * dt);
    ui.bVol.style.background = 'linear-gradient(to top,rgba(0,200,255,.75) ' + Math.round(jet * 100) + '%,rgba(20,30,50,.6) ' + Math.round(jet * 100) + '%)';
    if (manosPie) { var fl = manosPie.llamas; if (fl) { fl[0].visible = fl[1].visible = jetOn; if (jetOn) { var fs = 0.8 + Math.random() * 0.5; fl[0].scale.set(1, fs, 1); fl[1].scale.set(1, fs, 1); } } }
    if (saltoV !== 0 || saltoY > 0) { saltoV -= 12 * dt; saltoY += saltoV * dt; if (saltoY <= 0) { saltoY = 0; saltoV = 0; } }
    if (golpeT > 0) golpeT -= dt; if (vidaJ < 100) vidaJ = Math.min(100, vidaJ + dt * 2);
    if (terceraP) {   // la cámara se aleja por detrás del soldado, siguiendo hacia dónde miras (sube y baja libremente)
      var cp = Math.cos(ppit), D3 = 3.4, hx = px, hy = (manosPie ? manosPie.eye : 1.7) - 0.15 + pyF + saltoY, hz = pz;
      cam.position.set(hx + Math.sin(pyaw) * cp * D3 + Math.cos(pyaw) * 0.45, Math.max(0.35, hy - Math.sin(ppit) * D3), hz + Math.cos(pyaw) * cp * D3 - Math.sin(pyaw) * 0.45);
    } else cam.position.set(px - Math.sin(pyaw) * 0.1, (manosPie ? manosPie.eye : 1.7) + pyF + saltoY + Math.sin(t * (correr ? 11 : 7)) * 0.03 * mag, pz - Math.cos(pyaw) * 0.1);
    cam.rotation.set(ppit, pyaw, 0, 'YXZ'); visAgua(!!TER && cam.position.y < AGUA_Y + olaH(cam.position.x, cam.position.z, aguaT)); animarManos(t, dt, mag);
    if (ui.est.textContent.indexOf('Munición') === 0) ui.est.textContent = '';
  }
  escenas.planeta = {
    construir: construir, redimensionar: redimensionar5,
    _test: function () { return { pie: function () { return { modoPie: modoPie, px: px, pz: pz, sentado: !!sentado }; }, entrarPie: entrarPie, salirPie: salirPie, sentarse: sentarse, levantarse: levantarse, punteroPie: punteroPie, buscarLibre: buscarLibre, colocadas: function () { return colocadas; }, elegir: elegir, colocar: colocar, itemDe: itemDe, CATALOGO: CATALOGO, ghost: function () { return ghost; }, mover: function (x, z) { fx = x; fz = z; }, borrarEn: borrarEn, despegar: despegar }; },
    entrar: function (d) {
      if (!construido) construir(); else E.aplicarLayout(ui.izq.parentNode);
      if (manosPie) manosPie.u.group.visible = false; if (manosPrem) manosPrem.u.group.visible = false; saltoY = 0; saltoV = 0; pyF = 0; fallV = 0; cm.x = 1e9; ascKey = ''; pendAsc = null; modoPie = false; sentado = null; correr = false; stk = null; lookId = null; cercaT = null; if (cam) { cam.fov = 60; cam.near = 1; cam.updateProjectionMatrix(); }
      pl = d.pl; ret = d.retorno; key = pl.key; enHangar = {}; colocadas = []; ghost = null; itemSel = null; modoBorrar = false; modoCons = false; cargando = ''; punteros = {}; mov = 0;
      ambientar(pl.tipo);
      // la nave posada en el centro
      nave = null; var n = naveDe(jug.nave), m = obtenerModelo(jug.nave), md = medidas[jug.nave];
      if (m && md) { var w = new THREE.Group(); w.scale.setScalar(n.m); w.add(m.group); nave = new THREE.Group(); nave.add(w); w.position.set(-md.centro.x * 1, -(md.centro.y - md.alto / 2), -md.centro.z * 1); sc.add(nave); naveBaja = false; naveY = HOVER; naveX = naveZ = naveTx = naveTz = 0; nave.position.y = HOVER; pad = Math.max(18, md.radio * n.m * 1.15 + 8); }
      else pad = 30;
      fx = 0; fz = 160; yaw = 0.6; pit = 0.75; dist = Math.max(240, pad * 3);
      var vj = d.viaje || leer('viaje', null); viajeFin = (vj && (d.viaje || vj.key === pl.key) && vj.fin > Date.now()) ? vj.fin : 0; if (nave) nave.visible = !viajeFin;
      mostrarCapas(['planeta']); construirUI(); naveBaja = false; actualizarUI(); camara(); redimensionar5(E.ancho, E.alto);
      toast(viajeFin ? 'TELETRANSPORTE A ' + pl.nombre.toUpperCase() + ' · TU NAVE LLEGA EN ' + tiempoViaje() : 'ATERRIZASTE EN ' + pl.nombre.toUpperCase(), 3);
      cargarBase();
    },
    salir: function () {
      var i; try { if (pl) guardarBase(); } catch (e0) { } mantO = null; ui.mant && ui.mant.classList.remove('on'); modoPie = false; sentado = null; for (i = 0; i < colocadas.length; i++) sc.remove(colocadas[i].g); colocadas = []; quitarGhost();
      if (nave) { sc.remove(nave); nave = null; } if (perro) { sc.remove(perro.group); perro = null; } try { if (E.Gusanos) E.Gusanos.detener(); } catch (eg2) { } pl = null;
    },
    puntero: function (tipo, e) {
      if (!pl || ui.panel.classList.contains('on')) return;
      if (modoPie) { punteroPie(tipo, e); return; }
      if (tipo === 'abajo') { punteros[e.pointerId] = { x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY }; mov = 0; var ks = Object.keys(punteros); if (ks.length === 2) { pinch0 = Math.hypot(punteros[ks[0]].x - punteros[ks[1]].x, punteros[ks[0]].y - punteros[ks[1]].y); dist0 = dist; } }
      else if (tipo === 'mueve' && punteros[e.pointerId]) {
        var p = punteros[e.pointerId], dx = e.clientX - p.x, dy = e.clientY - p.y, ks2 = Object.keys(punteros); p.x = e.clientX; p.y = e.clientY; mov += Math.abs(dx) + Math.abs(dy);
        if (ks2.length >= 2) { var a = punteros[ks2[0]], b = punteros[ks2[1]], dd = Math.hypot(a.x - b.x, a.y - b.y); if (pinch0 > 10) dist = clamp(dist0 * pinch0 / Math.max(10, dd), 25, 4000); }
        else { var k = dist * 0.0022; fx -= (-dx * Math.cos(yaw) - dy * Math.sin(yaw)) * k; fz -= (dx * Math.sin(yaw) - dy * Math.cos(yaw)) * k; var rr = Math.hypot(fx, fz); if (rr > RADIO_BASE + 300) { fx *= (RADIO_BASE + 300) / rr; fz *= (RADIO_BASE + 300) / rr; } }
      } else if (tipo === 'arriba' && punteros[e.pointerId]) {
        var q = punteros[e.pointerId]; delete punteros[e.pointerId];
        if (mov < 8 && modoBorrar) borrarEn(q.x0, q.y0); else if (mov < 8 && !ghost) { var oe = estructuraEn(q.x0, q.y0); if (oe && oe.mant) abrirMant(oe); }
      }
    },
    tecla: function (e, abajo) { if (abajo && e.code === 'Escape' && ghost) { quitarGhost(); actualizarUI(); } },
    actualizar: function (dt, t) {
      if (!pl) return;
      if (viajeFin && Date.now() >= viajeFin) { viajeFin = 0; guardar('viaje', null); if (nave) nave.visible = true; toast('TU NAVE HA LLEGADO', 2.6); }
      if (TER) { var cxT = modoPie ? px : fx, czT = modoPie ? pz : fz; actualizarTerreno(cxT, czT); actualizarAgua(dt, cxT, czT); }
      yaw += bR * dt * 1.2; dist = clamp(dist * (1 + bZ * dt * 1.4), 25, TER ? 900 : 4000);
      if (ghost) {
        var gx = Math.round(fx / 2) * 2, gz = Math.round(fz / 2) * 2, ok;
        if (ghost.item.defensa) { var ap1 = modoPie ? apuntar(5 * K, 2 * K) : { x: fx, z: fz }; ok = posDefensa(ap1.x, ap1.z); }
        else if (ghost.item.base) { var ap2 = modoPie ? apuntar(25, 4) : { x: fx, z: fz }; ok = posBase(ap2.x, ap2.z); }
        else { if (modoPie) { var ap3 = apuntar(30, 6); gx = Math.round(ap3.x / 2) * 2; gz = Math.round(ap3.z / 2) * 2; } var sbj = BASE_SOPORTE ? baseBajo(gx, gz, 0) : null; ghost.g.position.set(gx, sbj ? sbj.top : 0, gz); ghost.g.rotation.y = rotG; ok = valida(gx, gz, ghost.r, null, rotG, ghost.hw, ghost.hd, sbj); }
        try { if (ghost.api.setGhost && ghost._okp !== ok) { ghost._okp = ok; ghost.api.setGhost(true, ok); } } catch (e) { }
        ui.bCol.style.opacity = ok ? 1 : 0.4;
      }
      alt = !alt; var i; optimizarEstructuras(t); try { tickPerro(dt); } catch (ep) { } try { if (E.Gusanos) E.Gusanos.actualizar(dt); } catch (eg) { }
      if (ghost && alt) { try { ghost.api.update(t); } catch (e3) { } }
      if (nave) {
        var ty = HOVER, dxn = naveTx - naveX, dzn = naveTz - naveZ, dn = Math.hypot(dxn, dzn);
        if (naveBaja) { if (dn > 3) { var st = Math.min(dn, 160 * dt); naveX += dxn / dn * st; naveZ += dzn / dn * st; } else ty = 0; }
        naveY += clamp(ty - naveY, -45 * dt, 45 * dt); nave.position.set(naveX, naveY + (naveBaja ? 0 : Math.sin(t * 1.3) * 1.5), naveZ);
      }
      for (i = 0; i < colocadas.length; i++) { var gt = colocadas[i]; if (gt.item.defensa === 'porton' && !gt.fin) { var tg = gt.abierto ? 1 : 0, ov0 = gt.ov || 0; if (ov0 !== tg) { gt.ov = ov0 + clamp(tg - ov0, -dt * 0.9, dt * 0.9); try { gt.api.setOpen(gt.ov); } catch (eg) { } } } }
      var now = Date.now(), prox = null, pr;
      tMant -= dt; if (tMant <= 0) { tMant = 2; for (i = 0; i < colocadas.length; i++) tickMant(colocadas[i], now); if (mantO) pintarMant(); tGuardar += 2; if (tGuardar >= 30) { tGuardar = 0; guardarBase(); } }
      for (i = 0; i < colocadas.length; i++) { var c = colocadas[i]; if (c.fin) { if (now >= c.fin) { c.fin = 0; terminarObra(c); c.g.scale.y = 1; c.g.updateMatrixWorld(true); c._cj = null; cm.x = 1e9; guardarBase(); toast('TERMINADA: ' + c.item.nombre.toUpperCase(), 2); } else { pr = 1 - (c.fin - now) / c.dur; if (c._ob) avanceObra(c, pr); else c.g.scale.y = 0.04 + 0.96 * pr; if (!prox || c.fin < prox.fin) prox = c; } } }
      avisoT -= dt; if (avisoT <= 0) { avisoT = 0.5; hgT++; pintarHot(); if (hgT % 6 === 0) { try { sincronizarHangares(); } catch (eh2) { } } if (prox) ui.est.textContent = 'Construyendo ' + prox.item.nombre + ' · ' + Math.ceil((prox.fin - now) / 1000) + ' s'; else if (!cargando && !ghost && !itemSel) ui.est.textContent = ''; }
      if (ghost) { rejilla.position.set(Math.round(ghost.g.position.x / 20) * 20, 0.5, Math.round(ghost.g.position.z / 20) * 20); }
      if (modoPie) actualizarPie(dt, t); else camara(); if (tToast > 0) { tToast -= dt; if (tToast <= 0) ui.toast.style.opacity = 0; }
      try { actualizarCielo(dt, t); } catch (ec) { if (global.console && !CIE.err) { CIE.err = 1; console.error(ec); } }
      E.renderer.render(sc, cam);
    }
  };
})(window);
