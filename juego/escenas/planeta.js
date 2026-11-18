/* Escena: superficie del planeta — aterrizas, ves tu base y colocas estructuras (ver README.md).
   Las estructuras son los modelos de edificios/base/ (se descargan solo al necesitarlos). La base se guarda en este dispositivo. */
(function (global) {
  'use strict';
  var E = global.JN = global.JN || {};
  var CONFIG = E.CONFIG, PI = E.PI, clamp = E.clamp, leer = E.leer, guardar = E.guardar, el = E.el, esc = E.esc, DOMcapas = E.DOMcapas, jug = E.jug, escenas = E.escenas;
  var naveDe = E.naveDe, medidas = E.medidas, obtenerModelo = E.obtenerModelo, cargarScript = E.cargarScript, mostrarCapas = E.mostrarCapas, irA = function (n, d) { return E.irA(n, d); };

  var RADIO_BASE = 700, MAX_EST = 14;
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
    { id: 'pista1', nombre: 'Pista circular', archivo: 'pista_circular_nivel1.js', fn: 'createPistaCircular1', desc: 'Nivel 1.' },
    { id: 'pista2', nombre: 'Pista circular grande', archivo: 'pista_circular_nivel2.js', fn: 'createPistaCircular2', desc: 'Nivel 2.' },
    { id: 'ciudad', nombre: 'Pista-ciudad', archivo: 'pista_ciudad_nivel2.js', fn: 'createPistaCiudad2', desc: '3 pistas y torre central.' },
    { id: 'taller1', nombre: 'Taller de reparación', archivo: 'taller_reparacion_nivel1.js', fn: 'createTallerReparacion1', desc: 'Nivel 1.' },
    { id: 'taller2', nombre: 'Taller de reparación doble', archivo: 'taller_reparacion_nivel2.js', fn: 'createTallerReparacion2', desc: 'Nivel 2.' },
    { id: 'astillero', nombre: 'Astillero planetario', archivo: 'astillero_planetario.js', fn: 'createAstillero', desc: 'Construye naves en el suelo.' }
  ];
  var PAISAJE = { arido: ['#b0764a', 0xd9a074], rocoso: ['#6f7b63', 0x8fb0cf], hielo: ['#cfe0ee', 0x9ec3e6], tormenta: ['#5a5470', 0x7c6f98] };
  E.ATERRIZABLES = { arido: 1, rocoso: 1, hielo: 1, tormenta: 1 };

  var sc, cam, suelo, anillo, rejilla, luzSol, ui = null, construido = false, ray = null, v2p = null;
  var pl = null, ret = null, key = '', nave = null, pad = 60, colocadas = [], ghost = null, itemSel = null, rotG = 0, modoBorrar = false, cargando = '', alt = false;
  var fx = 0, fz = 0, yaw = 0.6, pit = 0.75, dist = 160, punteros = {}, pinch0 = 0, dist0 = 0, mov = 0, bR = 0, bZ = 0, tToast = 0;

  function construir() {
    sc = new THREE.Scene(); cam = new THREE.PerspectiveCamera(60, 1, 1, 12000);
    luzSol = new THREE.DirectionalLight(0xfff1e0, 2.3); luzSol.position.set(0.6, 0.8, 0.4); sc.add(luzSol, new THREE.HemisphereLight(0xaac4e6, 0x3a2a22, 0.75));
    suelo = new THREE.Mesh(new THREE.CircleGeometry(9000, 64), new THREE.MeshStandardMaterial({ roughness: 1, metalness: 0 })); suelo.rotation.x = -PI / 2; sc.add(suelo);
    anillo = new THREE.Mesh(new THREE.RingGeometry(RADIO_BASE - 3, RADIO_BASE, 128), new THREE.MeshBasicMaterial({ color: 0x7fe3ff, transparent: true, opacity: 0.45, side: THREE.DoubleSide })); anillo.rotation.x = -PI / 2; anillo.position.y = 0.4; sc.add(anillo);
    rejilla = new THREE.GridHelper(RADIO_BASE * 2, RADIO_BASE / 10, 0x7fe3ff, 0x7fe3ff); rejilla.material.transparent = true; rejilla.material.opacity = 0.16; rejilla.position.y = 0.5; rejilla.visible = false; sc.add(rejilla);
    ray = new THREE.Raycaster(); v2p = new THREE.Vector2();
    construido = true;
  }
  function texSuelo(col) {
    var c = document.createElement('canvas'); c.width = c.height = 256; var g = c.getContext('2d'), i;
    g.fillStyle = col; g.fillRect(0, 0, 256, 256);
    for (i = 0; i < 2600; i++) { g.fillStyle = Math.random() < 0.5 ? 'rgba(0,0,0,0.07)' : 'rgba(255,255,255,0.06)'; var s = 2 + Math.random() * 14; g.fillRect(Math.random() * 256, Math.random() * 256, s, s); }
    var t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(220, 220); if ('encoding' in t) t.encoding = THREE.sRGBEncoding; return t;
  }
  function toast(t, s) { if (!ui) return; ui.toast.textContent = t; ui.toast.style.opacity = 1; tToast = s || 1.5; }

  /* ---- estructuras ---- */
  function itemDe(id) { for (var i = 0; i < CATALOGO.length; i++) if (CATALOGO[i].id === id) return CATALOGO[i]; return null; }
  function asegurar(item, ok) {
    if (typeof global[item.fn] === 'function') return ok(true);
    cargando = item.nombre; if (ui) ui.est.textContent = 'Descargando ' + item.nombre + '…';
    cargarScript(CONFIG.rutaEdificios + 'base/' + item.archivo, function () { cargando = ''; ok(typeof global[item.fn] === 'function'); }, function () { cargando = ''; ok(false); });
  }
  function instanciar(item) {   // modelo en metros, apoyado en el suelo, con su radio de huella
    var api = null; try { api = global[item.fn](THREE, { accent: jug.acento }); } catch (e) { if (global.console) console.error(e); }
    if (!api || !api.group) return null;
    var w = new THREE.Group(); w.scale.setScalar(4); w.add(api.group); w.updateMatrixWorld(true);
    var b = new THREE.Box3().setFromObject(w), s = b.getSize(new THREE.Vector3()), r = 0.5 * Math.sqrt(s.x * s.x + s.z * s.z) * 0.8;
    if (!isFinite(r) || r <= 0) r = 40;
    api.group.position.y -= b.min.y / 4; if (isFinite(b.min.y) === false) api.group.position.y = 0;
    var raiz = new THREE.Group(); raiz.add(w); sc.add(raiz);
    return { item: item, api: api, g: raiz, r: r };
  }
  function valida(x, z, r, ignorar) {
    var d = Math.sqrt(x * x + z * z), i, o;
    if (d + r > RADIO_BASE || d < pad + r) return false;
    for (i = 0; i < colocadas.length; i++) { o = colocadas[i]; if (o === ignorar) continue; if (Math.hypot(o.x - x, o.z - z) < o.r + r) return false; }
    return true;
  }
  function guardarBase() { guardar('base_' + key, colocadas.map(function (o) { return { i: o.item.id, x: Math.round(o.x * 10) / 10, z: Math.round(o.z * 10) / 10, r: o.rot }; })); }
  function cargarBase() {
    var lst = leer('base_' + key, []) || [], i = 0;
    ui.est.textContent = lst.length ? 'Reconstruyendo la base…' : '';
    (function sig() {
      if (!pl || i >= lst.length) { actualizarUI(); return; }
      var e = lst[i++], item = itemDe(e.i); if (!item) return sig();
      asegurar(item, function (ok) {
        if (ok && pl) { var o = instanciar(item); if (o) { o.x = e.x; o.z = e.z; o.rot = e.r || 0; o.g.position.set(o.x, 0, o.z); o.g.rotation.y = o.rot; o.g.userData.idx = true; colocadas.push(o); } }
        setTimeout(sig, 0);
      });
    })();
  }
  function elegir(item) {
    if (colocadas.length >= MAX_EST) { toast('LÍMITE DE ' + MAX_EST + ' ESTRUCTURAS'); return; }
    quitarGhost(); modoBorrar = false; itemSel = item; ui.panel.classList.remove('on');
    asegurar(item, function (ok) {
      if (!ok || itemSel !== item) { if (!ok) { toast('NO SE PUDO DESCARGAR'); itemSel = null; } actualizarUI(); return; }
      ghost = instanciar(item); if (!ghost) { toast('ERROR AL CREAR'); itemSel = null; } else { ghost.g.userData.fantasma = true; rotG = 0; }
      actualizarUI();
    });
    actualizarUI();
  }
  function quitarGhost() { if (ghost) { sc.remove(ghost.g); ghost = null; } itemSel = null; }
  function colocar() {
    if (!ghost) return; var x = ghost.g.position.x, z = ghost.g.position.z;
    if (!valida(x, z, ghost.r, null)) { toast('NO CABE AQUÍ'); return; }
    var o = ghost; ghost = null; itemSel = null; o.x = x; o.z = z; o.rot = rotG; try { if (o.api.setGhost) o.api.setGhost(false); } catch (e) { }
    colocadas.push(o); guardarBase(); toast('CONSTRUIDO', 1); actualizarUI();
  }
  function borrarEn(px, py) {
    v2p.set(px / E.ancho * 2 - 1, -(py / E.alto) * 2 + 1); ray.setFromCamera(v2p, cam);
    var i, hits = [], o;
    for (i = 0; i < colocadas.length; i++) { o = colocadas[i]; var h = ray.intersectObject(o.g, true); if (h.length) hits.push({ d: h[0].distance, o: o }); }
    if (!hits.length) return; hits.sort(function (a, b) { return a.d - b.d; }); o = hits[0].o;
    sc.remove(o.g); colocadas.splice(colocadas.indexOf(o), 1); guardarBase(); toast('DEMOLIDO: ' + o.item.nombre.toUpperCase(), 1.4); actualizarUI();
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
    ui.bCons = el('button', 'jn-btn', ui.barra, 'CONSTRUIR'); ui.bCons.onclick = function () { quitarGhost(); modoBorrar = false; ui.panel.classList.add('on'); actualizarUI(); };
    ui.bCol = el('button', 'jn-btn jn-grande', ui.barra, 'COLOCAR'); ui.bCol.onclick = colocar;
    ui.bRot = el('button', 'jn-btn', ui.barra, 'GIRAR'); ui.bRot.onclick = function () { rotG += PI / 4; };
    ui.bCan = el('button', 'jn-btn', ui.barra, 'CANCELAR'); ui.bCan.onclick = function () { quitarGhost(); actualizarUI(); };
    ui.bBor = el('button', 'jn-btn', ui.barra, 'DEMOLER'); ui.bBor.onclick = function () { quitarGhost(); modoBorrar = !modoBorrar; if (modoBorrar) toast('TOCA UNA ESTRUCTURA PARA DEMOLERLA', 2); actualizarUI(); };
    ui.bDes = el('button', 'jn-btn', ui.barra, 'DESPEGAR'); ui.bDes.onclick = despegar;
    ui.panel = el('div', 'jn-pmenu jn-pl-panel', L, ''); var cab = el('div', 'jn-pl-cab', ui.panel); el('b', '', cab, 'ESTRUCTURAS'); var x = el('button', 'jn-mapa-x', ui.panel, '✕'); x.onclick = function () { ui.panel.classList.remove('on'); };
    var lst = el('div', 'jn-fl-lista', ui.panel);
    CATALOGO.forEach(function (it) {
      var f = el('div', 'jn-fl-fila', lst), inf = el('div', 'jn-fl-inf', f); el('b', '', inf, it.nombre); el('span', '', inf, it.desc);
      var b = el('button', 'jn-btn', f, 'ELEGIR'); b.onclick = function () { elegir(it); };
    });
  }
  function actualizarUI() {
    if (!ui) return; var pon = !!(ghost || itemSel);
    ui.tit.textContent = pl ? pl.nombre.toUpperCase() + ' · BASE ' + colocadas.length + '/' + MAX_EST : '';
    ui.bCons.style.display = pon || modoBorrar ? 'none' : ''; ui.bCol.style.display = pon ? '' : 'none'; ui.bRot.style.display = pon ? '' : 'none'; ui.bCan.style.display = pon ? '' : 'none';
    ui.bBor.style.display = pon ? 'none' : ''; ui.bBor.textContent = modoBorrar ? 'LISTO' : 'DEMOLER'; ui.bDes.style.display = pon ? 'none' : '';
    ui.est.textContent = cargando ? 'Descargando ' + cargando + '…' : (itemSel && !ghost ? 'Preparando…' : (ghost ? 'Mueve la cámara para elegir el sitio · verde = cabe' : ''));
    rejilla.visible = pon;
  }
  function despegar() {
    if (!ret) { irA('lobby'); return; }
    var r = ret; irA('mundo', { modo: r.modo, retorno: r });
  }

  function camara() {
    cam.position.set(fx + dist * Math.sin(yaw) * Math.cos(pit), dist * Math.sin(pit) + 2, fz + dist * Math.cos(yaw) * Math.cos(pit)); cam.lookAt(fx, 0, fz);
  }
  function redimensionar5(w, h) { if (!cam) return; cam.aspect = w / h; cam.updateProjectionMatrix(); }

  escenas.planeta = {
    construir: construir, redimensionar: redimensionar5,
    _test: function () { return { colocadas: function () { return colocadas; }, elegir: elegir, colocar: colocar, itemDe: itemDe, CATALOGO: CATALOGO, ghost: function () { return ghost; }, mover: function (x, z) { fx = x; fz = z; }, borrarEn: borrarEn, despegar: despegar }; },
    entrar: function (d) {
      if (!construido) construir();
      pl = d.pl; ret = d.retorno; key = pl.key; colocadas = []; ghost = null; itemSel = null; modoBorrar = false; cargando = ''; punteros = {}; mov = 0;
      var pj = PAISAJE[pl.tipo] || PAISAJE.rocoso; suelo.material.map = texSuelo(pj[0]); suelo.material.needsUpdate = true; sc.background = new THREE.Color(pj[1]); sc.fog = new THREE.Fog(pj[1], 900, 5200);
      // la nave posada en el centro
      nave = null; var n = naveDe(jug.nave), m = obtenerModelo(jug.nave), md = medidas[jug.nave];
      if (m && md) { var w = new THREE.Group(); w.scale.setScalar(n.m); w.add(m.group); nave = new THREE.Group(); nave.add(w); w.position.set(-md.centro.x * 1, -(md.centro.y - md.alto / 2), -md.centro.z * 1); sc.add(nave); pad = Math.max(60, md.radio * 1.15 + 15); }
      else pad = 60;
      fx = 0; fz = pad + 200; yaw = 0.6; pit = 0.75; dist = Math.max(160, pad * 3);
      mostrarCapas(['planeta']); construirUI(); actualizarUI(); camara(); redimensionar5(E.ancho, E.alto);
      toast('ATERRIZASTE EN ' + pl.nombre.toUpperCase(), 2.4);
      cargarBase();
    },
    salir: function () {
      var i; for (i = 0; i < colocadas.length; i++) sc.remove(colocadas[i].g); colocadas = []; quitarGhost();
      if (nave) { sc.remove(nave); nave = null; } pl = null;
    },
    puntero: function (tipo, e) {
      if (!pl || ui.panel.classList.contains('on')) return;
      if (tipo === 'abajo') { punteros[e.pointerId] = { x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY }; mov = 0; var ks = Object.keys(punteros); if (ks.length === 2) { pinch0 = Math.hypot(punteros[ks[0]].x - punteros[ks[1]].x, punteros[ks[0]].y - punteros[ks[1]].y); dist0 = dist; } }
      else if (tipo === 'mueve' && punteros[e.pointerId]) {
        var p = punteros[e.pointerId], dx = e.clientX - p.x, dy = e.clientY - p.y, ks2 = Object.keys(punteros); p.x = e.clientX; p.y = e.clientY; mov += Math.abs(dx) + Math.abs(dy);
        if (ks2.length >= 2) { var a = punteros[ks2[0]], b = punteros[ks2[1]], dd = Math.hypot(a.x - b.x, a.y - b.y); if (pinch0 > 10) dist = clamp(dist0 * pinch0 / Math.max(10, dd), 25, 1500); }
        else { var k = dist * 0.0022; fx -= (dx * Math.cos(yaw) - dy * Math.sin(yaw)) * k; fz -= (-dx * Math.sin(yaw) - dy * Math.cos(yaw)) * k; var rr = Math.hypot(fx, fz); if (rr > RADIO_BASE + 300) { fx *= (RADIO_BASE + 300) / rr; fz *= (RADIO_BASE + 300) / rr; } }
      } else if (tipo === 'arriba' && punteros[e.pointerId]) {
        var q = punteros[e.pointerId]; delete punteros[e.pointerId];
        if (mov < 8 && modoBorrar) borrarEn(q.x0, q.y0);
      }
    },
    tecla: function (e, abajo) { if (abajo && e.code === 'Escape' && ghost) { quitarGhost(); actualizarUI(); } },
    actualizar: function (dt, t) {
      if (!pl) return;
      yaw += bR * dt * 1.2; dist = clamp(dist * (1 + bZ * dt * 1.4), 25, 1500);
      if (ghost) {
        var gx = Math.round(fx / 2) * 2, gz = Math.round(fz / 2) * 2; ghost.g.position.set(gx, 0, gz); ghost.g.rotation.y = rotG;
        var ok = valida(gx, gz, ghost.r, null); try { if (ghost.api.setGhost) ghost.api.setGhost(true, ok); } catch (e) { }
        ui.bCol.disabled = !ok; ui.bCol.style.opacity = ok ? 1 : 0.4;
      }
      alt = !alt; var i; if (alt) for (i = 0; i < colocadas.length; i++) { try { colocadas[i].api.update(t); } catch (e2) { } } if (ghost && alt) { try { ghost.api.update(t); } catch (e3) { } }
      if (nave) nave.position.set(0, 0, 0);
      camara(); if (tToast > 0) { tToast -= dt; if (tToast <= 0) ui.toast.style.opacity = 0; }
      E.renderer.render(sc, cam);
    }
  };
})(window);
