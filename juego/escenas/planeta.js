/* Escena: superficie del planeta — aterrizas, ves tu base y colocas estructuras (ver README.md).
   Las estructuras son los modelos de edificios/base/ (se descargan solo al necesitarlos). La base se guarda en este dispositivo. */
(function (global) {
  'use strict';
  var E = global.JN = global.JN || {};
  var CONFIG = E.CONFIG, PI = E.PI, clamp = E.clamp, leer = E.leer, guardar = E.guardar, el = E.el, esc = E.esc, DOMcapas = E.DOMcapas, jug = E.jug, escenas = E.escenas;
  var naveDe = E.naveDe, medidas = E.medidas, obtenerModelo = E.obtenerModelo, cargarScript = E.cargarScript, mostrarCapas = E.mostrarCapas, irA = function (n, d) { return E.irA(n, d); };

  var RADIO_BASE = 8000, MAX_EST = 30, HOVER = 90;
  var DUR = { torreta: 25, planta: 60, extr_min: 40, extr_pet: 40, refineria: 90, complejo: 120, com1: 20, com2: 40, com3: 70, inv1: 25, inv2: 60, pista1: 90, pista2: 150, ciudad: 240, taller1: 70, taller2: 110, astillero: 180, muro: 6, porton: 10, torretaf: 8, base_mc: 5, base_mt: 4, base_dc: 8, base_dt: 6 };   // segundos
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
    { id: 'base_mc', base: 'c', nombre: 'Base de metal (cuadrada)', archivo: ['base_metal.js', 'bases.js'], fn: 'createBaseMetalC', desc: 'Cimiento de 50 m. Se encaja con otras bases; encima van muros y edificios.', esc: 50 / 3, escY: 1.9 },
    { id: 'base_mt', base: 't', nombre: 'Base de metal (triangular)', archivo: ['base_metal.js', 'bases.js'], fn: 'createBaseMetalT', desc: 'Cimiento triangular de 50 m por lado.', esc: 50 / 3, escY: 1.9 },
    { id: 'base_dc', base: 'c', nombre: 'Base de metal duro (cuadrada)', archivo: ['base_metal_duro.js', 'bases.js'], fn: 'createBaseDuroC', desc: 'Cimiento blindado de 50 m.', esc: 50 / 3, escY: 1.9 },
    { id: 'base_dt', base: 't', nombre: 'Base de metal duro (triangular)', archivo: ['base_metal_duro.js', 'bases.js'], fn: 'createBaseDuroT', desc: 'Cimiento blindado triangular.', esc: 50 / 3, escY: 1.9 },
    { id: 'astillero', nombre: 'Astillero planetario', archivo: 'astillero_planetario.js', fn: 'createAstillero', desc: 'Construye naves en el suelo.' }
  ];
  var PAISAJE = { arido: ['#b0764a', 0xd9a074], rocoso: ['#6f7b63', 0x8fb0cf], hielo: ['#cfe0ee', 0x9ec3e6], tormenta: ['#5a5470', 0x7c6f98] };
  E.ATERRIZABLES = { arido: 1, rocoso: 1, hielo: 1, tormenta: 1 };

  var sc, cam, suelo, anillo, rejilla, luzSol, ui = null, construido = false, ray = null, v2p = null, pyF = 0, fallV = 0, rc = null, cm = { x: 1e9, z: 1e9, list: [] }, ascKey = '', pendAsc = null, viajeFin = 0, naveBaja = false, naveY = HOVER, avisoT = 0, naveX = 0, naveZ = 0, naveTx = 0, naveTz = 0;
  var modoPie = false, px = 0, pz = 0, pyaw = 0, ppit = 0, sentado = null, correr = false, tIx = 0, tIy = 0, saltoY = 0, saltoV = 0, jet = 1, volar = false, jetOn = false, golpeT = 0, manosPie = null,  stk = null, lookId = null, cercaT = null, cercaG = null, cercaB = null, vA = null, qA = null, vB = null, vC = null;
  var pl = null, ret = null, key = '', nave = null, pad = 60, colocadas = [], ghost = null, itemSel = null, rotG = 0, modoBorrar = false, cargando = '', alt = false;
  var fx = 0, fz = 0, yaw = 0.6, pit = 0.75, dist = 160, punteros = {}, pinch0 = 0, dist0 = 0, mov = 0, bR = 0, bZ = 0, tToast = 0;

  function construir() {
    sc = new THREE.Scene(); cam = new THREE.PerspectiveCamera(60, 1, 1, 22000);
    luzSol = new THREE.DirectionalLight(0xfff1e0, 2.3); luzSol.position.set(0.6, 0.8, 0.4); sc.add(luzSol, new THREE.HemisphereLight(0xaac4e6, 0x3a2a22, 0.75));
    suelo = new THREE.Mesh(new THREE.CircleGeometry(30000, 72), new THREE.MeshStandardMaterial({ roughness: 1, metalness: 0 })); suelo.rotation.x = -PI / 2; sc.add(suelo);
    anillo = new THREE.Mesh(new THREE.RingGeometry(RADIO_BASE - 3, RADIO_BASE, 128), new THREE.MeshBasicMaterial({ color: 0x7fe3ff, transparent: true, opacity: 0.45, side: THREE.DoubleSide })); anillo.rotation.x = -PI / 2; anillo.position.y = 0.4; sc.add(anillo);
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
  function texSuelo(col) {
    var c = document.createElement('canvas'); c.width = c.height = 256; var g = c.getContext('2d'), i;
    g.fillStyle = col; g.fillRect(0, 0, 256, 256);
    for (i = 0; i < 2600; i++) { g.fillStyle = Math.random() < 0.5 ? 'rgba(0,0,0,0.07)' : 'rgba(255,255,255,0.06)'; var s = 2 + Math.random() * 14; g.fillRect(Math.random() * 256, Math.random() * 256, s, s); }
    var t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(730, 730); if ('encoding' in t) t.encoding = THREE.sRGBEncoding; return t;
  }
  function toast(t, s) { if (!ui) return; ui.toast.textContent = t; ui.toast.style.opacity = 1; tToast = s || 1.5; }

  /* ---- estructuras ---- */
  function itemDe(id) { for (var i = 0; i < CATALOGO.length; i++) if (CATALOGO[i].id === id) return CATALOGO[i]; return null; }
  function asegurar(item, ok) {
    if (typeof global[item.fn] === 'function') return ok(true);
    cargando = item.nombre; if (ui) ui.est.textContent = 'Descargando ' + item.nombre + '…';
    var arch = [].concat(item.archivo), k = 0;
    (function sig() {
      if (k >= arch.length) { cargando = ''; ok(typeof global[item.fn] === 'function'); return; }
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
      inr = item.base === 'c' ? 25 : 50 / Math.sqrt(3) / 2; topB = (api.topY || 0.8) * item.escY; r = item.base === 'c' ? 35.4 : 28.9; hw = hd = item.base === 'c' ? 25 : 21;
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
    if (d + r > RADIO_BASE || (naveBaja && Math.hypot(x - naveTx, z - naveTz) < pad + r)) return false;
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
        if (Math.hypot(x, z) + pad > RADIO_BASE) continue; ok = true;
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
  function elegir(item) {
    if (item.defensa) { if (stockDe(item.id) <= 0) { toast('NO TIENES · CÓMPRALO EN UNA ESTACIÓN', 2.2); return; } if (colocadas.length - nEst() >= MAX_DEF) { toast('LÍMITE DE DEFENSAS'); return; } }
    else { if (item.base ? nBases() >= 150 : nEst() >= MAX_EST) { toast(item.base ? 'LÍMITE DE BASES' : 'LÍMITE DE ' + MAX_EST + ' ESTRUCTURAS'); return; } if (!alcanza(COSTOS[item.id])) { toast('TE FALTAN MATERIALES', 2); return; } }
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
  var COSTOS = { base_mc: { piedra: 10, hierro: 25 }, base_mt: { piedra: 5, hierro: 13 }, base_dc: { piedra: 20, hierro: 40, titanio: 5 }, base_dt: { piedra: 10, hierro: 20, titanio: 3 }, com1: N1, inv1: N1, pista1: N1, taller1: N1, torreta: { hierro: 20, cobre: 10 }, com2: N2, inv2: N2, pista2: N2, taller2: N2, extr_min: N2, extr_pet: N2, planta: N2, refineria: N2, com3: N3, complejo: N3, ciudad: N3, astillero: N3 };
  var DIA = 86400, REGEN = 100 / DIA, DECAY = 100 / (3 * DIA), MAX_OFFLINE = 48 * 3600 * 1000, DIAS_BODEGA = 14;
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
    b = baseBajo(dg.x, dg.z, 0); dg.y += ((b ? b.top : 0) - dg.y) * Math.min(1, dt * 8);
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
  function iniciarGusanos() {
    if (!E.Gusanos || !pl) return;
    E.Gusanos.iniciar({ sc: sc, estructuras: function () { return colocadas; }, jugador: function () { return { x: modoPie ? px : fx, z: modoPie ? pz : fz }; }, minero: !(E.ATERRIZABLES && E.ATERRIZABLES[pl.tipo]), aviso: toast, danio: danioEstructura, reparar: repararPasivo });
  }
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
    if (Math.hypot(x, z) + 40 > RADIO_BASE || (naveBaja && Math.hypot(x - naveTx, z - naveTz) < pad + 40)) return false;
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
        if (occ) continue; d = Math.hypot(nx - cx, nz - cz); if (d < 10 * K && d < bd) { bd = d; best = { x: nx, z: nz, th: th }; } } }
    var x, z, rot; if (best) { x = best.x; z = best.z; rot = best.th; } else { x = Math.round(cx / 5) * 5; z = Math.round(cz / 5) * 5; rot = rotG; }
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
    if (Math.hypot(x, z) + 4 * K > RADIO_BASE || (naveBaja && Math.hypot(x - naveTx, z - naveTz) < pad + 4 * K)) return false;
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
    if (bB && bdB <= bd) { g.position.set(bB.x, bB.o.top, bB.z); g.rotation.y = bB.ang; ghost.okDef = true; return true; }
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
    if ((df || ghost.item.base) ? !ghost.okDef : !valida(x, z, ghost.r, null, ghost.g.rotation.y, ghost.hw, ghost.hd, baseBajo(x, z, 0))) { toast(df === 'torretaf' ? 'PONLA SOBRE UNA COLUMNA' : 'NO CABE AQUÍ'); return; }
    if (df) { if (stockDe(ghost.item.id) <= 0) { toast('NO TE QUEDAN'); return; } stockMas(ghost.item.id, -1); }
    else { if (!alcanza(COSTOS[ghost.item.id])) { toast('TE FALTAN MATERIALES', 2); return; } gastar(COSTOS[ghost.item.id]); }
    var o = ghost; ghost = null; itemSel = null; o.x = x; o.z = z; o.rot = o.g.rotation.y; try { if (o.api.setGhost) o.api.setGhost(false); } catch (e) { }
    o.dur = jug.pruebas ? 0 : (DUR[o.item.id] || 30) * 1000; o.fin = o.dur ? Date.now() + o.dur : 0; if (o.dur) prepararObra(o);
    iniMant(o); colocadas.push(o); actualizarPilares(); guardarBase(); toast(o.dur ? 'CONSTRUYENDO · ' + Math.round(o.dur / 1000) + ' s' : 'CONSTRUIDO', 1.4); actualizarUI();
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
    ui.bCons = el('button', 'jn-btn', ui.barra, 'CONSTRUIR'); ui.bCons.onclick = function () { quitarGhost(); modoBorrar = false; pintarCatalogo(); ui.panel.classList.add('on'); actualizarUI(); };
    ui.bCol = el('button', 'jn-btn jn-grande', ui.barra, 'COLOCAR'); ui.bCol.onclick = colocar;
    ui.bRot = el('button', 'jn-btn', ui.barra, 'GIRAR'); ui.bRot.onclick = function () { rotG += PI / 4; };
    ui.bCan = el('button', 'jn-btn', ui.barra, 'CANCELAR'); ui.bCan.onclick = function () { quitarGhost(); actualizarUI(); };
    ui.bBor = el('button', 'jn-btn', ui.barra, 'DEMOLER'); ui.bBor.onclick = function () { quitarGhost(); modoBorrar = !modoBorrar; if (modoBorrar) toast('TOCA UNA ESTRUCTURA PARA DEMOLERLA', 2); actualizarUI(); };
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
    ui.bPerro = el('button', 'jn-btn', ui.barra, 'PERRO'); ui.bPerro.onclick = function () { if (ui.perro.classList.contains('on')) ui.perro.classList.remove('on'); else { pintarPerro(); ui.perro.classList.add('on'); } };
    ui.bCor = el('button', 'jn-btn', ui.barra, 'CORRER'); ui.bCor.onclick = function () { correr = !correr; ui.bCor.classList.toggle('on', correr); };
    ui.bSen = el('button', 'jn-btn', ui.barra, 'BAJAR DE LA TORRETA'); ui.bSen.onclick = function () { if (sentado) levantarse(); };
    ui.bUsar = el('div', 'jn-pl-usar', L); el('span', '', ui.bUsar, '✋'); el('b', '', ui.bUsar, 'USAR'); ui.bUsar.addEventListener('pointerdown', function (ev) { if (cercaT && !sentado) sentarse(cercaT); else if (cercaB && !cercaG && !sentado) abrirMant(cercaB); else if (cercaG && !sentado) { cercaG.abierto = !cercaG.abierto; toast(cercaG.abierto ? 'PORTÓN ABIERTO' : 'PORTÓN CERRADO', 1); } ev.preventDefault(); });
    ui.bSal = el('button', 'jn-btn jn-grande jn-pl-saltar', L, 'SALTAR'); ui.bSal.addEventListener('pointerdown', function (ev) { if (saltoY <= 0.001 && modoPie && !sentado) saltoV = 4.6; ev.preventDefault(); });
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
    ui.mant = el('div', 'jn-pmenu jn-pl-panel jn-pl-mant', L, ''); ui.perro = el('div', 'jn-pmenu jn-pl-panel jn-pl-mant', L, '');
    [['p_cons', ui.bCons], ['p_col', ui.bCol], ['p_rot', ui.bRot], ['p_can', ui.bCan], ['p_demoler', ui.bBor], ['p_nave', ui.bNave], ['p_despegar', ui.bDes], ['p_pie', ui.bPie], ['p_correr', ui.bCor], ['p_usar', ui.bUsar], ['p_saltar', ui.bSal], ['p_golpe', ui.bGol], ['p_volar', ui.bVol], ['p_disparar', ui.bFue], ['p_torreta', ui.tor], ['p_zoom', ui.izq], ['p_recargar', ui.bRec], ['p_sen', ui.bSen]].forEach(function (q) { if (q[1]) q[1].setAttribute('data-ctl', q[0]); });
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
  function pintarCatalogo() {
    var L = ui.lstCat, sy = L.scrollTop; L.innerHTML = '';
    var cr = el('div', 'jn-cred', L, 'TU INVENTARIO · ' + ['piedra', 'hierro', 'cobre', 'titanio', 'oro', 'piezas'].map(function (k) { return E.Iconos.svg(k, 16) + (invL()[k] || 0); }).join('  ')); cr.style.fontSize = '13px';
    if (jug.pruebas) el('div', 'jn-lb-nota', L, 'Modo pruebas: construir no cuesta materiales.');
    var g = el('div', 'jn-grid jn-grid-cat', L);
    CATALOGO.forEach(function (it) {
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
    vis(ui.bPerro, !!datosPerro() && !pon && !modoBorrar && !sen); vis(ui.bCons, !pon && !modoBorrar && !sen); vis(ui.bCol, pon); vis(ui.bRot, pon); vis(ui.bCan, pon);
    vis(ui.bNave, !sen && !pon && !(!pie && modoBorrar)); vis(ui.bBor, !pie && !pon); ui.bBor.textContent = modoBorrar ? 'LISTO' : 'DEMOLER'; vis(ui.bDes, !sen && !pon);
    vis(ui.bPie, !sen && !pon && !modoBorrar); ui.bPie.textContent = pie ? 'VISTA BASE' : 'BAJAR A PIE'; vis(ui.bCor, pie && !sen && !pon); vis(ui.bSen, sen); ui.bUsar.style.display = (pie && !sen && !pon && (cercaT || cercaG || cercaB)) ? 'flex' : 'none'; vis(ui.bSal, pie && !sen && !pon); vis(ui.bVol, pie && !sen && !pon); vis(ui.bGol, pie && !sen && !pon);
    vis(ui.bRec, sen); vis(ui.bFue, sen); vis(ui.mira, pie); ui.tor.style.display = sen ? 'grid' : 'none'; if (!sen) { ui.mira.style.left = ui.mira.style.top = ''; tIx = tIy = 0; } ui.izq.style.display = pie ? 'none' : '';
    ui.est.textContent = cargando ? 'Descargando ' + cargando + '…' : (itemSel && !ghost ? 'Preparando…' : (ghost ? 'Mueve la cámara para elegir el sitio · verde = cabe' : ''));
    rejilla.visible = pon && !pie && !(ghost && ghost.item.defensa);
  }
  /* ---- el personaje: el soldado espacial del lobby, visto en primera persona (cabeza oculta, se ven sus brazos y su cuerpo) ---- */
  var LB = 0.29, LA = 0.26, hand = { izq: null, der: null }, wk = 0, ag = null;
  function crearManosPie() {
    if (manosPie || typeof global.createSoldadoEspacialV2 !== 'function') return;
    var u; try { u = global.createSoldadoEspacialV2(THREE, { metersPerUnit: 1, height: 1.8, armor: jug.acento, glow: 0x62d6ff }); } catch (e) { return; }
    var pa = u.parts; pa.head.visible = false; sc.add(u.group); u.group.updateMatrixWorld(true);
    var v = new THREE.Vector3(); pa.head.getWorldPosition(v); var eye = v.y; pa.legL.getWorldPosition(v);
    manosPie = { u: u, pa: pa, eye: eye, hip: v.y, body: pa.armL.parent };
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
  function animarManos(t, dt, mag) {   // a pie: el soldado camina; los brazos van "en guardia" y se balancean
    if (!manosPie) return; var pa = manosPie.pa, g = manosPie.u.group, ph = t * (correr ? 11 : 7), sw = Math.sin(ph) * mag, cw = Math.cos(ph) * mag, gk = golpeT > 0 ? golpePose(1 - golpeT / 0.45) : null;
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
    g.visible = true; g.rotation.set(0, ag.ang, 0); g.position.set(ag.sitio.x, ag.sitio.y - manosPie.hip + 0.03, ag.sitio.z); g.updateMatrixWorld(true);
    pa.legL.rotation.set(-1.45, 0, -0.05); pa.legR.rotation.set(-1.45, 0, 0.05); pa.shinL.rotation.set(1.4, 0, 0); pa.shinR.rotation.set(1.4, 0, 0); g.updateMatrixWorld(true);
    wk += ((Math.abs(ay) > 0.12 ? 1 : 0) - wk) * Math.min(1, dt * 7);
    var tD = ag.der.clone().lerp(ag.vol, wk);
    ik(pa.armL, pa.forearmL, tD, -1); ik(pa.armR, pa.forearmR, ag.izq, 1); g.updateMatrixWorld(true);
    pa.head.getWorldPosition(vA);
  }
  function entrarPie() {
    quitarGhost(); modoBorrar = false; modoPie = true; px = fx; pz = fz; if (Math.hypot(px, pz) > RADIO_BASE) { px = 0; pz = 160; } pyaw = yaw + PI; ppit = 0; sentado = null;
    saltoY = 0; saltoV = 0; golpeT = 0; pyF = 0; fallV = 0; cm.x = 1e9; crearManosPie(); if (manosPie) manosPie.u.group.visible = true; cam.fov = 75; cam.near = 0.05; cam.updateProjectionMatrix(); actualizarUI(); toast('A PIE · IZQUIERDA MUEVE · DERECHA MIRA', 2.4);
  }
  function salirPie() {
    if (sentado) levantarse(); if (manosPie) manosPie.u.group.visible = false; modoPie = false; fx = px; fz = pz; yaw = pyaw + PI; cam.fov = 60; cam.near = 1; cam.updateProjectionMatrix(); stk = null; lookId = null; ui.sb.style.display = ui.sk.style.display = 'none'; actualizarUI();
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
      o = colocadas[i]; if (o.item.defensa || o.item.arma || (o.fin && o.fin > now) || Math.hypot(x - o.x, z - o.z) > o.r + 40) continue;
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
    return { y: 0, bloq: false };
  }
  function moverConColision(mx, mz, dt) {
    var cand = null; try { if (!rc) { rc = new THREE.Raycaster(); o3 = new THREE.Vector3(); d3 = new THREE.Vector3(); } cand = candidatos(px, pz); } catch (e) { cand = null; }
    if (!cand || !cand.length) { px += mx; pz += mz; pyF += Math.min(0, 0 - pyF) * 0; if (pyF > 0) { fallV = Math.min(fallV + 25 * dt, 40); pyF = Math.max(0, pyF - fallV * dt); } else { pyF = 0; fallV = 0; } return; }
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
    var mag = Math.min(1, Math.hypot(ax, ay)), v = (correr ? 7.5 : 3.2) * (jetOn ? 2.2 : 1) * mag, sn = Math.sin(pyaw), cs = Math.cos(pyaw);
    var mvx = 0, mvz = 0; if (mag > 0.05) { mvx = (-sn * (-ay) + cs * ax) * v / mag * dt; mvz = (-cs * (-ay) - sn * ax) * v / mag * dt; }
    moverConColision(mvx, mvz, dt);
    var d0 = Math.hypot(px, pz); if (d0 > RADIO_BASE + 200) { px *= (RADIO_BASE + 200) / d0; pz *= (RADIO_BASE + 200) / d0; }
    cercaT = null; cercaG = null; cercaB = null;
    for (i = 0; i < colocadas.length; i++) {
      o = colocadas[i]; var dx = px - o.x, dz = pz - o.z, dd = Math.hypot(dx, dz) || 0.01;
      if (o.mant && !o.fin && dd < o.r + 10 && !(cercaB && cercaB._d < dd)) { o._d = dd; cercaB = o; }
      if (o.item.defensa) { if (esMuro(o) && !o.fin && dd < 9 * K && saltoY < 3) { if (o.item.defensa === 'porton' && dd < 5.5 * K) cercaG = o; choqueDefensa(o, dx, dz); } continue; }
      if (o.item.arma && !o.fin && dd < 6.5) cercaT = o;
      if (!o.item.plano && (o.item.arma || !cajasDe(o).length) && saltoY < 3) { var lim = o.r * 0.85 + 0.6; if (dd < lim) { px = o.x + dx / dd * lim; pz = o.z + dz / dd * lim; } }
      else if (o.item.arma && dd < 1.6) { px = o.x + dx / dd * 1.6; pz = o.z + dz / dd * 1.6; }
    }
    if (naveBaja && naveY < 8) { var dn = Math.hypot(px - naveX, pz - naveZ), ln = pad * 0.55; if (dn < ln) { px = naveX + (px - naveX) / (dn || 1) * ln; pz = naveZ + (pz - naveZ) / (dn || 1) * ln; } }
    panelEdificio();
    if (!!(cercaT || cercaG || cercaB) !== !!ui._ct) { ui._ct = !!(cercaT || cercaG || cercaB); actualizarUI(); }
    jetOn = volar && jet > 0.01 && !sentado;
    if (jetOn) { saltoV = Math.min(saltoV + 34 * dt, 7.5); jet = Math.max(0, jet - 0.22 * dt); }
    else if (saltoY <= 0.01) jet = Math.min(1, jet + 0.45 * dt);
    ui.bVol.style.background = 'linear-gradient(to top,rgba(0,200,255,.75) ' + Math.round(jet * 100) + '%,rgba(20,30,50,.6) ' + Math.round(jet * 100) + '%)';
    if (manosPie) { var fl = manosPie.llamas; if (fl) { fl[0].visible = fl[1].visible = jetOn; if (jetOn) { var fs = 0.8 + Math.random() * 0.5; fl[0].scale.set(1, fs, 1); fl[1].scale.set(1, fs, 1); } } }
    if (saltoV !== 0 || saltoY > 0) { saltoV -= 12 * dt; saltoY += saltoV * dt; if (saltoY <= 0) { saltoY = 0; saltoV = 0; } }
    if (golpeT > 0) golpeT -= dt;
    cam.position.set(px - Math.sin(pyaw) * 0.1, (manosPie ? manosPie.eye : 1.7) + pyF + saltoY + Math.sin(t * (correr ? 11 : 7)) * 0.03 * mag, pz - Math.cos(pyaw) * 0.1); cam.rotation.set(ppit, pyaw, 0, 'YXZ'); animarManos(t, dt, mag);
    if (ui.est.textContent.indexOf('Munición') === 0) ui.est.textContent = '';
  }
  escenas.planeta = {
    construir: construir, redimensionar: redimensionar5,
    _test: function () { return { pie: function () { return { modoPie: modoPie, px: px, pz: pz, sentado: !!sentado }; }, entrarPie: entrarPie, salirPie: salirPie, sentarse: sentarse, levantarse: levantarse, punteroPie: punteroPie, buscarLibre: buscarLibre, colocadas: function () { return colocadas; }, elegir: elegir, colocar: colocar, itemDe: itemDe, CATALOGO: CATALOGO, ghost: function () { return ghost; }, mover: function (x, z) { fx = x; fz = z; }, borrarEn: borrarEn, despegar: despegar }; },
    entrar: function (d) {
      if (!construido) construir(); else E.aplicarLayout(ui.izq.parentNode);
      if (manosPie) manosPie.u.group.visible = false; saltoY = 0; saltoV = 0; pyF = 0; fallV = 0; cm.x = 1e9; ascKey = ''; pendAsc = null; modoPie = false; sentado = null; correr = false; stk = null; lookId = null; cercaT = null; if (cam) { cam.fov = 60; cam.near = 1; cam.updateProjectionMatrix(); }
      pl = d.pl; ret = d.retorno; key = pl.key; enHangar = {}; colocadas = []; ghost = null; itemSel = null; modoBorrar = false; cargando = ''; punteros = {}; mov = 0;
      var pj = PAISAJE[pl.tipo] || PAISAJE.rocoso; suelo.material.map = texSuelo(pj[0]); suelo.material.needsUpdate = true; sc.background = new THREE.Color(pj[1]); sc.fog = new THREE.Fog(pj[1], 1800, 9500);
      // la nave posada en el centro
      nave = null; var n = naveDe(jug.nave), m = obtenerModelo(jug.nave), md = medidas[jug.nave];
      if (m && md) { var w = new THREE.Group(); w.scale.setScalar(n.m); w.add(m.group); nave = new THREE.Group(); nave.add(w); w.position.set(-md.centro.x * 1, -(md.centro.y - md.alto / 2), -md.centro.z * 1); sc.add(nave); naveBaja = false; naveY = HOVER; naveX = naveZ = naveTx = naveTz = 0; nave.position.y = HOVER; pad = Math.max(60, md.radio * 1.15 + 15); }
      else pad = 60;
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
      yaw += bR * dt * 1.2; dist = clamp(dist * (1 + bZ * dt * 1.4), 25, 4000);
      if (ghost) {
        var gx = Math.round(fx / 2) * 2, gz = Math.round(fz / 2) * 2, ok;
        if (ghost.item.defensa) ok = posDefensa(modoPie ? px - Math.sin(pyaw) * 5 * K : fx, modoPie ? pz - Math.cos(pyaw) * 5 * K : fz);
        else if (ghost.item.base) ok = posBase(modoPie ? px - Math.sin(pyaw) * 5 * K : fx, modoPie ? pz - Math.cos(pyaw) * 5 * K : fz);
        else { if (modoPie) { gx = Math.round((px - Math.sin(pyaw) * 14) / 2) * 2; gz = Math.round((pz - Math.cos(pyaw) * 14) / 2) * 2; } var sbj = baseBajo(gx, gz, 0); ghost.g.position.set(gx, sbj ? sbj.top : 0, gz); ghost.g.rotation.y = rotG; ok = valida(gx, gz, ghost.r, null, rotG, ghost.hw, ghost.hd, sbj); }
        try { if (ghost.api.setGhost) ghost.api.setGhost(true, ok); } catch (e) { }
        ui.bCol.disabled = !ok; ui.bCol.style.opacity = ok ? 1 : 0.4;
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
      avisoT -= dt; if (avisoT <= 0) { avisoT = 0.5; hgT++; if (hgT % 6 === 0) { try { sincronizarHangares(); } catch (eh2) { } } if (prox) ui.est.textContent = 'Construyendo ' + prox.item.nombre + ' · ' + Math.ceil((prox.fin - now) / 1000) + ' s'; else if (!cargando && !ghost && !itemSel) ui.est.textContent = ''; }
      if (ghost) { rejilla.position.set(Math.round(ghost.g.position.x / 20) * 20, 0.5, Math.round(ghost.g.position.z / 20) * 20); }
      if (modoPie) actualizarPie(dt, t); else camara(); if (tToast > 0) { tToast -= dt; if (tToast <= 0) ui.toast.style.opacity = 0; }
      E.renderer.render(sc, cam);
    }
  };
})(window);
