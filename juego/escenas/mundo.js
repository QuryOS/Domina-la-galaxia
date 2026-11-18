/* Escena: mundo infinito (vuelo, cámara, HUD) — parte del juego de naves (ver README.md) */
(function (global) {
  'use strict';
  var E = global.JN = global.JN || {};
  var CONFIG = E.CONFIG;
  var ACENTOS = E.ACENTOS;
  var CALIDAD = E.CALIDAD;
  var PI = E.PI;
  var TAU = E.TAU;
  var clamp = E.clamp;
  var mulberry32 = E.mulberry32;
  var hash3 = E.hash3;
  var el = E.el;
  var esc = E.esc;
  var fmtDist = E.fmtDist;
  var DOMcapas = E.DOMcapas;
  var jug = E.jug;
  var escenas = E.escenas;
  var planetaTex = E.planetaTex;
  var redimensionar = E.redimensionar;
  var mostrarCapas = E.mostrarCapas;
  var fbm = E.fbm;
  var COLOR_ATM = E.COLOR_ATM;
  var medidas = E.medidas;
  var naveDe = E.naveDe;
  var obtenerModelo = E.obtenerModelo;
  var crearModeloNuevo = E.crearModeloNuevo;
  var actualizarModelo = E.actualizarModelo;
  var Red = E.Red;
  function irA(a, b) { return E.irA(a, b); }

  /* ===================== ESCENA: MUNDO ===================== */
  escenas.mundo = (function () {
    var SOL_DIR = null, sc, cam, cielo, solSp, polvo, polvoPos, polvoN = 0, SG, geoAnillo, matAnillo, matAtm = {}, geosRoca = [], matsRoca = [];
    var pivote = null, inclinar = null, escalarN = null, modelo = null, nSel = null, med = null;
    var P = { x: 0, y: 0, z: 0 }, Q, V, qCam, qa, v1, v2, v3, fwd, vObj, AX, AY, AZ, dummy, mInv;
    var celdas = {}, listaEst = [], estLejanas = [], esp = null, botFu = false, botGr = false, atracado = false, estCerca = null, estVista = '', listaPl = [], listaRo = [], camposVis = [], ucx = 1e9, ucy = 1e9, ucz = 1e9;
    var mapaAbierto = false, meta = null, mapaZ = 1, mapaLista = [], mapaPuntos = [], camYaw = 0, camPitch = 0, camPtr = null, camX0 = 0, camY0 = 0, camYaw0 = 0, camPitch0 = 0, qo = null, rYaw = 0, rPitch = 0, rRoll = 0, acelerador = 0.3, turboE = 1, turboBloq = false, turboOn = false, vel = 0, shake = 0, pausado = false, modo = 'solo', tMundo = 0, tHud = 0, fps = 60, tRed = 0, tToast = 0, planCercano = null;
    var teclas = {}, stick = { id: null, x0: 0, y0: 0, ax: 0, ay: 0 }, botT = false, botF = false, palId = null;
    var hud = {}, radarG, radarS = 132, beaconG, remotos = {}, construido = false, DPRH = 1;

    /* ---------- construcción (una vez) ---------- */
    function construir() {
      SOL_DIR = new THREE.Vector3(0.62, 0.34, -0.71).normalize();
      Q = new THREE.Quaternion(); V = new THREE.Vector3(); qCam = new THREE.Quaternion(); qa = new THREE.Quaternion(); mInv = new THREE.Quaternion();
      v1 = new THREE.Vector3(); v2 = new THREE.Vector3(); v3 = new THREE.Vector3(); fwd = new THREE.Vector3(); vObj = new THREE.Vector3();
      AX = new THREE.Vector3(1, 0, 0); AY = new THREE.Vector3(0, 1, 0); AZ = new THREE.Vector3(0, 0, 1); dummy = new THREE.Object3D();
      sc = new THREE.Scene(); cam = new THREE.PerspectiveCamera(72, 1, 1, 160000);
      var sol = new THREE.DirectionalLight(0xfff1e0, 2.6); sol.position.copy(SOL_DIR); sc.add(sol);
      var contra = new THREE.DirectionalLight(0x5fb8ff, 0.55); contra.position.copy(SOL_DIR).multiplyScalar(-1); sc.add(contra);
      sc.add(new THREE.HemisphereLight(0x7088c0, 0x140e1c, 0.4));
      cielo = new THREE.Mesh(new THREE.SphereGeometry(100000, 40, 20), new THREE.MeshBasicMaterial({ map: E.skyTex, side: THREE.BackSide, depthWrite: false, toneMapped: false, fog: false }));
      cielo.renderOrder = -10; cielo.frustumCulled = false; sc.add(cielo);
      solSp = new THREE.Sprite(new THREE.SpriteMaterial({ map: E.glowTex, color: 0xffe8c0, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, toneMapped: false, fog: false }));
      solSp.scale.set(14000, 14000, 1); solSp.renderOrder = -9; solSp.frustumCulled = false; sc.add(solSp);
      var seg = jug.calidad === 'alta' ? 56 : (jug.calidad === 'media' ? 40 : 28); SG = new THREE.SphereGeometry(1, seg, Math.round(seg * 0.7));
      geoAnillo = new THREE.RingGeometry(1.35, 2.3, 96, 1);
      (function () { var p = geoAnillo.attributes.position, uv = geoAnillo.attributes.uv, i, w = new THREE.Vector3(); for (i = 0; i < p.count; i++) { w.set(p.getX(i), p.getY(i), 0); uv.setXY(i, (w.length() - 1.35) / 0.95, 0.5); } })();
      matAnillo = new THREE.MeshBasicMaterial({ map: E.anillosTex, transparent: true, side: THREE.DoubleSide, depthWrite: false, opacity: 0.85 });
      (function () {
        var v, i, g, p, x, y, z, f;
        for (v = 0; v < 3; v++) {
          g = new THREE.IcosahedronGeometry(1, 1); p = g.attributes.position;
          for (i = 0; i < p.count; i++) { x = p.getX(i); y = p.getY(i); z = p.getZ(i); f = 0.7 + 0.65 * fbm(x * 1.5 + v * 7.3 + 5, y * 1.5 + 5, z * 1.5 + 5, 99 + v, 3); p.setXYZ(i, x * f, y * f * 0.88, z * f); }
          g.computeVertexNormals(); geosRoca.push(g);
        }
        [0x8c8378, 0x6d655c, 0x9a7e68].forEach(function (c) { matsRoca.push(new THREE.MeshStandardMaterial({ color: c, roughness: 0.96, metalness: 0.05, flatShading: true })); });
      })();
      qo = new THREE.Quaternion();
      esp = E.Espacio.crear({ sc: sc, P: P, V: V, Q: Q, toast: toast, rocas: function () { return listaRo; }, golpeRoca: golpeRoca });
      construirHUD(); construido = true;
    }

    /* ---------- HUD (DOM) ---------- */
    function construirHUD() {
      var L = DOMcapas.hud; L.innerHTML = '';
      beaconG = el('canvas', '', L); beaconG.style.cssText = 'position:absolute;left:0;top:0;width:100%;height:100%;pointer-events:none';
      var hi = el('div', 'jn-hi', L); hud.nom = el('div', 'n', hi); hud.vel = el('div', 'v', hi, '0 <small>m/s</small>');
      hud.mv = el('div', 'jn-mini', hi, '<i></i>'); hud.mt = el('div', 'jn-mini t', hi, '<i></i>'); hud.estado = el('div', '', hi, ''); hud.inv = el('div', '', hi, ''); hud.inv.style.cssText = 'margin-top:6px;font-size:12px;line-height:1.5;max-width:230px'; hud.estado.style.cssText = 'margin-top:6px;opacity:.8';
      hud.hd = el('div', 'jn-hd', L);
      hud.pausa = el('div', 'jn-ico jn-pausa', L, '❚❚'); hud.pausa.onclick = function () { pausar(true); };
      hud.mapa = el('div', 'jn-pmenu jn-mapa', L, '');
      var rc = el('canvas', 'jn-radar', L); rc.style.width = radarS + 'px'; rc.style.height = radarS + 'px'; hud.radar = rc; rc.style.pointerEvents = 'auto'; rc.style.cursor = 'pointer'; rc.onclick = function () { abrirMapa(); };
      var ac = el('div', 'jn-acel', L), pal = el('div', 'jn-pal', ac, '<u>ACEL</u><i></i>'); hud.pal = pal; hud.palI = pal.querySelector('i');
      var bots = el('div', 'jn-bots', ac); hud.bFu = el('div', 'jn-bot fu', bots, 'FUEGO'); hud.bGr = el('div', 'jn-bot gr', bots, 'AGARRAR'); hud.bT = el('div', 'jn-bot', bots, 'TURBO'); hud.bF = el('div', 'jn-bot f', bots, 'FRENO'); hud.bAuto = el('div', 'jn-bot au', bots, 'AUTO');
      hud.bFu.setAttribute('data-ctl', 'fuego'); hud.bGr.setAttribute('data-ctl', 'agarrar'); hud.bT.setAttribute('data-ctl', 'turbo'); hud.bF.setAttribute('data-ctl', 'freno'); pal.setAttribute('data-ctl', 'acel'); hud.bAuto.setAttribute('data-ctl', 'auto'); hud.bAuto.addEventListener('pointerdown', function (ev) { apAlternar(); ev.preventDefault(); }); rc.setAttribute('data-ctl', 'radar');
      function pulsar(e, b, f) { e.addEventListener('pointerdown', function (ev) { f(true); b.classList.add('on'); try { b.setPointerCapture(ev.pointerId); } catch (x) { } ev.preventDefault(); }); ['pointerup', 'pointercancel'].forEach(function (n) { e.addEventListener(n, function () { f(false); b.classList.remove('on'); }); }); }
      pulsar(hud.bFu, hud.bFu, function (v) { botFu = v; });
      pulsar(hud.bGr, hud.bGr, function (v) { botGr = v; });
      pulsar(hud.bT, hud.bT, function (v) { botT = v; }); pulsar(hud.bF, hud.bF, function (v) { botF = v; });
      function setPal(ev) { var r = pal.getBoundingClientRect(); acelerador = clamp(1 - (ev.clientY - r.top - 4) / (r.height - 8), 0, 1); }
      pal.addEventListener('pointerdown', function (ev) { palId = ev.pointerId; try { pal.setPointerCapture(ev.pointerId); } catch (x) { } setPal(ev); ev.preventDefault(); });
      pal.addEventListener('pointermove', function (ev) { if (palId === ev.pointerId) setPal(ev); });
      ['pointerup', 'pointercancel'].forEach(function (n) { pal.addEventListener(n, function () { palId = null; }); });
      hud.palanca = el('div', 'jn-palanca', L, '<i></i>'); hud.palI2 = hud.palanca.querySelector('i');
      hud.toast = el('div', 'jn-toast', L, '');
      hud.bAtr = el('div', 'jn-atracar', L, 'ATRACAR'); hud.bAtr.onclick = function () { atracar(); };
      hud.merc = el('div', 'jn-pmenu jn-merc', L, '');
      hud.flota = el('div', 'jn-pmenu jn-flota', L, '');
      hud.bFl = el('div', 'jn-ico jn-flotabtn', L, 'FLOTA'); hud.bFl.onclick = function () { abrirFlota(); };
      hud.bMod = el('div', 'jn-ico jn-modbtn', L, ''); hud.bMod.style.display = 'none'; hud.bMod.onclick = function () { ordenPiloto(nSel.minero ? 'mina' : 'sigue'); botonModo(); };
      hud.menu = el('div', 'jn-pmenu', L, '<h3>PAUSA</h3>');
      var bc = el('button', 'jn-btn jn-grande', hud.menu, 'CONTINUAR'); bc.onclick = function () { pausar(false); };
      var bh = el('button', 'jn-btn', hud.menu, 'VOLVER AL HANGAR'); bh.onclick = function () { irA('lobby'); };
      E.aplicarLayout(L);
    }
    function toast(txt, ms) { hud.toast.textContent = txt; hud.toast.style.opacity = 1; tToast = ms || 1.1; }
    /* ---------- mapa a pantalla completa: estaciones, planetas, planetas mineros, campos de asteroides y (pronto) astilleros ---------- */
    var ZOOMS = [40000, 100000, 200000], R_CUERPOS = 100000;
    var TIPOS_MAPA = {
      estacion: { n: 'Estación', c: '#ffd447', svg: '<circle cx="12" cy="12" r="7.5" fill="none" stroke="C" stroke-width="2"/><circle cx="12" cy="12" r="2.6" fill="C"/><path d="M12 2.5v4M12 17.5v4M2.5 12h4M17.5 12h4" stroke="C" stroke-width="2" stroke-linecap="round"/>' },
      planeta: { n: 'Planeta', c: '#8fc8ff', svg: '<circle cx="12" cy="12" r="5.6" fill="C" fill-opacity=".35" stroke="C" stroke-width="2"/><ellipse cx="12" cy="12" rx="10.5" ry="3.4" fill="none" stroke="C" stroke-width="1.6" transform="rotate(-22 12 12)"/>' },
      minero: { n: 'Planeta minero', c: '#ff9a5c', svg: '<circle cx="12" cy="12" r="8" fill="C" fill-opacity=".3" stroke="C" stroke-width="2"/><path d="M7 17l9-9" stroke="C" stroke-width="2.2" stroke-linecap="round"/><path d="M12.5 5.5c3.5-.2 6 2.3 6 5.8" fill="none" stroke="C" stroke-width="2.2" stroke-linecap="round"/>' },
      campo: { n: 'Campo de asteroides', c: '#c6ced8', svg: '<path d="M4 9l3.5-3.5 4 1 1 4-3 3.2-4.2-1z" fill="C" fill-opacity=".4" stroke="C" stroke-width="1.6" stroke-linejoin="round"/><path d="M13 14.5l3-1.8 3.5 1.5.5 3.6-3.3 2.2-3.6-1.2z" fill="C" fill-opacity=".4" stroke="C" stroke-width="1.6" stroke-linejoin="round"/><circle cx="17" cy="6.5" r="2.3" fill="C"/>' },
      flota: { n: 'Mi flota', c: '#7dff9a', svg: '<path d="M12 3l6 16-6-3.5L6 19z" fill="C" fill-opacity=".35" stroke="C" stroke-width="1.8" stroke-linejoin="round"/>' },
      cantera: { n: 'Cantera minera', c: '#ff7b2e', svg: '<path d="M3.5 17l3-8 5-3 6 2 3.5 6-4 4h-9z" fill="C" fill-opacity=".3" stroke="C" stroke-width="1.8" stroke-linejoin="round"/><path d="M12 3v7M9 5l3-2 3 2" fill="none" stroke="C" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>' },
      astillero: { n: 'Astillero', c: '#5cf2c8', svg: '<path d="M12 2.5c3 3 4.2 7 3.4 11.5H8.6C7.8 9.5 9 5.5 12 2.5z" fill="C" fill-opacity=".35" stroke="C" stroke-width="1.8" stroke-linejoin="round"/><path d="M8.6 12L5 16.5h4.2M15.4 12l3.6 4.5h-4.2M10 17.5l2 3.5 2-3.5" fill="none" stroke="C" stroke-width="1.8" stroke-linejoin="round"/>' }
    };
    var iconosImg = {}, mapaFiltro = { flota: true, estacion: false, planeta: false, minero: false, campo: false, astillero: false, cantera: false };   // el mapa empieza limpio: tú eliges qué ver
    function svgIcono(tipo, col, px) { return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="' + px + '" height="' + px + '">' + TIPOS_MAPA[tipo].svg.replace(/"C"/g, '"' + col + '"') + '</svg>'; }
    function imgIcono(tipo, col) {
      var k = tipo + col; if (iconosImg[k]) return iconosImg[k]; if (typeof Image === 'undefined') return null;
      var im = new Image(); im.onload = function () { if (mapaAbierto) pintarMapa(); }; im.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgIcono(tipo, col, 48)); iconosImg[k] = im; return im;
    }
    function tipoDePlaneta(tp) { return (tp === 'gaseoso' || tp === 'gaseoso2' || tp === 'tormenta') ? 'planeta' : 'minero'; }
    function ligera(ix, iy, iz) {   // la celda sin rocas, con memoria
      var kc = ix + ',' + iy + ',' + iz, h = cacheLig[kc]; if (h) return h;
      h = generar(ix, iy, iz, true); if (++nCacheLig > 20000) { cacheLig = {}; nCacheLig = 0; } cacheLig[kc] = h; return h;
    }
    function cuerposDeCelda(cel, x, y, z, R, out) {
      function poner(q, tipo, nombre, key, rad) { var dx = q.x - x, dy = q.y - y, dz = q.z - z, d = Math.sqrt(dx * dx + dy * dy + dz * dz); if (d <= R) out.push({ t: tipo, d: d, o: { key: key, x: q.x, y: q.y, z: q.z, r: rad, nombre: nombre, tipo: tipo } }); }
      if (cel.planeta) poner(cel.planeta, tipoDePlaneta(cel.planeta.tipo), cel.planeta.nombre, 'P' + cel.key, cel.planeta.r);
      if (cel.campo) { var r2 = mulberry32(hash3(cel.ix, cel.iy, cel.iz, 991)); poner(cel.campo, 'campo', 'Cinturón ' + nombrePlaneta(r2).split(' ')[0], 'C' + cel.key, cel.campo.a); }
    }
    function cuerposEn(x, y, z, R) {   // planetas y campos (sin crear nada en pantalla) a menos de R metros
      var C = CONFIG.celda, n = Math.ceil(R / C) + 1, cx = Math.floor(x / C), cy = Math.floor(y / C), cz = Math.floor(z / C), out = [], a, b, c;
      for (a = -n; a <= n; a++) for (b = -n; b <= n; b++) for (c = -n; c <= n; c++) cuerposDeCelda(ligera(cx + a, cy + b, cz + c), x, y, z, R, out);
      return out;
    }
    var mapaTok = 0, mapaCuerpos = 0;   // 0 sin pedir, 1 calculando, 2 listo
    function pedirCuerpos() {   // planetas y campos se calculan por tandas, para que el juego no se congele
      if (mapaCuerpos) return; mapaCuerpos = 1;
      var tok = ++mapaTok, x = P.x, y = P.y, z = P.z, C = CONFIG.celda, n = Math.ceil(R_CUERPOS / C) + 1, cx = Math.floor(x / C), cy = Math.floor(y / C), cz = Math.floor(z / C), cl = [], out = [], a, b, c, i = 0;
      for (a = -n; a <= n; a++) for (b = -n; b <= n; b++) for (c = -n; c <= n; c++) cl.push([cx + a, cy + b, cz + c]);
      function paso() {
        if (tok !== mapaTok || !mapaAbierto) return;
        var fin = Math.min(i + 120, cl.length);
        for (; i < fin; i++) cuerposDeCelda(ligera(cl[i][0], cl[i][1], cl[i][2]), x, y, z, R_CUERPOS, out);
        if (i < cl.length) { setTimeout(paso, 0); return; }
        mapaLista = mapaLista.concat(out); mapaLista.sort(function (u, v) { return u.d - v.d; }); mapaCuerpos = 2; pintarMapa();
      }
      paso();
    }
    function abrirMapa() {
      if (mapaAbierto || atracado || pausado) return;
      mapaAbierto = true; pausado = true; stick.id = null; stick.ax = stick.ay = 0; palancaVisual(false); camPtr = null; botFu = botGr = false;
      mapaLista = lugaresEn(P.x, P.y, P.z, ZOOMS[ZOOMS.length - 1]).map(function (q) { return { t: q.o.tipo, d: q.d, o: q.o }; });
      (function () { var id, f, dx, dy, dz; for (id in flota) { f = flota[id]; if (f.modo === 'hangar' || f.modo === 'piloto') continue; dx = f.x - P.x; dy = f.y - P.y; dz = f.z - P.z; mapaLista.push({ t: 'flota', d: Math.sqrt(dx * dx + dy * dy + dz * dz), o: { key: 'F' + id, x: f.x, y: f.y, z: f.z, r: 0, nombre: naveDe(id).nombre, tipo: 'flota' } }); } mapaLista.sort(function (u, v) { return u.d - v.d; }); })();
      mapaCuerpos = 0; mapaTok++;
      hud.mapa.classList.add('on'); pintarMapa();
      if (mapaFiltro.planeta || mapaFiltro.minero || mapaFiltro.campo) pedirCuerpos();
    }
    function cerrarMapa() { if (!mapaAbierto) return; mapaAbierto = false; pausado = false; hud.mapa.classList.remove('on'); }
    function pintarMapa() {   // arriba = hacia donde apunta tu nave
      var M = hud.mapa, R = ZOOMS[mapaZ], W = E.ancho, H = E.alto, dpr = Math.min(2, global.devicePixelRatio || 1), i, o;
      var vis = mapaLista.filter(function (x) { return x.d <= R * 2.2 && (mapaFiltro[x.t] || (meta && meta.key === x.o.key)) && !(x.t === 'campo' && R > 40000); });   // los campos son miles: solo con el alcance corto
      M.innerHTML = '';
      var cv = el('canvas', 'jn-mapafull', M); cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
      var g = cv.getContext('2d'), cx = W / 2, cy = (H - 100) / 2 + 24, escala = ((H - 150) / 2) / R;
      g.scale(dpr, dpr); g.fillStyle = '#02050d'; g.fillRect(0, 0, W, H);
      g.lineWidth = 1; g.font = '11px system-ui,sans-serif'; g.textAlign = 'left';
      for (i = 1; i <= 3; i++) { g.strokeStyle = 'rgba(120,200,255,' + (i === 3 ? 0.4 : 0.18) + ')'; g.beginPath(); g.arc(cx, cy, R / 3 * i * escala, 0, TAU); g.stroke(); g.fillStyle = 'rgba(160,200,240,0.65)'; g.fillText(fmtDist(R / 3 * i), cx + 5, cy - R / 3 * i * escala - 4); }
      g.strokeStyle = 'rgba(120,200,255,0.14)'; g.beginPath(); g.moveTo(cx, 0); g.lineTo(cx, H); g.moveTo(0, cy); g.lineTo(W, cy); g.stroke();
      mInv.copy(Q).invert(); mapaPuntos = [];
      var etiquetas = 0; g.textAlign = 'center'; g.font = '600 12px system-ui,sans-serif';
      for (i = 0; i < vis.length; i++) {
        var v = vis[i]; o = v.o; v3.set(o.x - P.x, o.y - P.y, o.z - P.z).applyQuaternion(mInv); v.dy = v3.y;
        var sx = cx + v3.x * escala, sy = cy + v3.z * escala;
        if (sx < 14 || sx > W - 14 || sy < 40 || sy > H - 104) continue;
        var T = TIPOS_MAPA[v.t], esMeta = meta && meta.key === o.key, col = esMeta ? '#ffe27a' : T.c, im = imgIcono(v.t, col);
        mapaPuntos.push({ o: o, x: sx, y: sy });
        if (esMeta) { g.strokeStyle = '#ffe27a'; g.lineWidth = 2; g.beginPath(); g.arc(sx, sy, 19, 0, TAU); g.stroke(); g.lineWidth = 1; }
        if (im && im.complete && im.naturalWidth) g.drawImage(im, sx - 12, sy - 12, 24, 24); else { g.fillStyle = col; g.fillRect(sx - 6, sy - 6, 12, 12); }
        if (etiquetas < 26 || esMeta) { etiquetas++; g.fillStyle = esMeta ? '#ffe27a' : (v.t === 'estacion' ? '#ffe9a0' : v.t === 'astillero' ? '#9ff5dc' : '#cfdcec'); g.fillText(o.nombre, sx, sy - 17); }
      }
      g.fillStyle = '#7fe3ff'; g.beginPath(); g.moveTo(cx, cy - 15); g.lineTo(cx - 10, cy + 11); g.lineTo(cx + 10, cy + 11); g.closePath(); g.fill();
      cv.onclick = function (ev) {
        var r = cv.getBoundingClientRect(), x = ev.clientX - r.left, y = ev.clientY - r.top, mejor = null, md = 34, k;
        for (k = 0; k < mapaPuntos.length; k++) { var q = mapaPuntos[k], dd = Math.hypot(q.x - x, q.y - y); if (dd < md) { md = dd; mejor = q.o; } }
        if (mejor) { meta = (meta && meta.key === mejor.key) ? null : mejor; pintarMapa(); }
      };
      /* barra superior: título, alcance, filtros y la X para salir */
      var top = el('div', 'jn-mapa-top', M);
      el('span', 'jn-mapa-tit', top, 'MAPA' + (mapaCuerpos === 1 ? ' · calculando…' : ''));
      var z = el('div', 'jn-zoom', top), bm = el('button', 'jn-btn', z, '−'), tz = el('span', '', z, fmtDist(R)), bp = el('button', 'jn-btn', z, '+');
      bm.onclick = function () { mapaZ = Math.min(ZOOMS.length - 1, mapaZ + 1); pintarMapa(); }; bp.onclick = function () { mapaZ = Math.max(0, mapaZ - 1); pintarMapa(); };
      var fl = el('div', 'jn-mapa-filtros', top);
      ['flota', 'estacion', 'planeta', 'minero', 'campo', 'astillero', 'cantera'].forEach(function (k) {
        var b = el('button', 'jn-mapa-f' + (mapaFiltro[k] ? ' on' : ''), fl, svgIcono(k, mapaFiltro[k] ? TIPOS_MAPA[k].c : '#6c7a90', 22)); b.title = TIPOS_MAPA[k].n;
        b.onclick = function () { mapaFiltro[k] = !mapaFiltro[k]; if (mapaFiltro[k] && (k === 'planeta' || k === 'minero' || k === 'campo')) pedirCuerpos(); pintarMapa(); };
      });
      var bx = el('button', 'jn-mapa-x', M, '✕'); bx.onclick = cerrarMapa;
      /* barra inferior: lista por distancia con icono, nombre y tipo */
      var barra = el('div', 'jn-mapa-barra', M);
      if (!vis.length) el('div', 'jn-ayuda', barra, (mapaFiltro.estacion || mapaFiltro.planeta || mapaFiltro.minero || mapaFiltro.campo || mapaFiltro.astillero || mapaFiltro.cantera) ? 'Nada en este alcance. Cambia el alcance con “+”/“−”.' : 'Mapa limpio. Toca los iconos de arriba para mostrar estaciones, planetas, mineros, campos o astilleros.');
      vis.slice(0, 40).forEach(function (v) {
        var esMeta = meta && meta.key === v.o.key, dy = v.dy || 0, T = TIPOS_MAPA[v.t];
        var f = el('div', 'jn-mapa-card' + (esMeta ? ' meta' : ''), barra, '<span class="ic">' + svgIcono(v.t, esMeta ? '#ffe27a' : T.c, 30) + '</span><span class="tx"><b>' + esc(v.o.nombre) + '</b><small>' + T.n + ' · ' + fmtDist(v.d) + ' · ' + (dy >= 0 ? '↑' : '↓') + fmtDist(Math.abs(dy)) + '</small></span>' + (esMeta ? '<span class="st">★</span>' : ''));
        f.style.borderColor = esMeta ? '#ffe27a' : T.c; f.onclick = function () { meta = esMeta ? null : v.o; pintarMapa(); };
      });
    }
    function atracar() {
      if (mapaAbierto || atracado || !estCerca) return;
      atracado = true; pausado = true; V.set(0, 0, 0); acelerador = 0; stick.id = null; stick.ax = stick.ay = 0; palancaVisual(false); camPtr = null;
      hud.bAtr.style.display = 'none'; estVista = ''; if (estCerca.tipo === 'astillero') pintarAstillero(); else pintarMercado(); hud.merc.classList.add('on'); toast('ATRACADO', 1);
    }
    function desatracar() { if (!atracado) return; atracado = false; pausado = false; hud.merc.classList.remove('on'); acelerador = 0.3; }
    function pintarMercado() {
      var M = hud.merc, k, orden = ['hierro', 'cobre', 'titanio', 'oro', 'piezas'];
      M.innerHTML = ''; var izq = el('div', 'jn-merc-izq', M), der = el('div', 'jn-merc-der', M);
      el('h3', '', izq, esc(estCerca ? estCerca.nombre : 'Estación').toUpperCase() + ' · ' + (estCerca && estCerca.tipo === 'cantera' ? 'COMPRA DE MINERAL' : 'MERCADO'));
      el('div', 'jn-cred', izq, '◎ ' + esp.creditos() + ' créditos');
      var tabla = el('div', 'jn-tabla', der), total = 0;
      orden.forEach(function (k) {
        var n = esp.inv[k] || 0, pr = esp.precios[k], f = el('div', 'jn-venta', tabla);
        total += n * pr;
        el('span', 'n', f, '<i style="background:' + esp.colorTipo(k) + '"></i>' + esp.nombreTipo(k)); el('span', 'q', f, n + ' × ' + pr); 
        var b = el('button', 'jn-btn', f, n ? 'VENDER ' + (n * pr) : '—'); if (!n) b.disabled = true;
        b.onclick = function () { var g = esp.vender(k); toast('+' + g + ' CRÉDITOS', 1); pintarMercado(); };
      });
      var bt = el('button', 'jn-btn jn-grande', izq, total ? 'VENDER TODO (' + total + ')' : 'NADA QUE VENDER'); if (!total) bt.disabled = true;
      bt.onclick = function () { var g = esp.venderTodo(); toast('+' + g + ' CRÉDITOS', 1); pintarMercado(); };
      var bs = el('button', 'jn-btn', izq, 'SALIR AL ESPACIO'); bs.onclick = function () { desatracar(); };
    }
    function pintarAstillero() {
      var M = hud.merc; M.innerHTML = ''; var izq = el('div', 'jn-merc-izq', M), der = el('div', 'jn-merc-der', M), pz = esp.inv.piezas || 0;
      el('h3', '', izq, esc(estCerca ? estCerca.nombre : 'Astillero').toUpperCase());
      el('div', 'jn-cred', izq, '⬢ ' + pz + ' trozos metálicos');
      el('div', 'jn-ayuda', izq, 'Aquí se canjean los trozos metálicos que encuentras flotando por partes de nave. Con las partes podrás armar naves nuevas (muy pronto).');
      var bs = el('button', 'jn-btn', izq, 'SALIR AL ESPACIO'); bs.onclick = function () { desatracar(); };
      var tabla = el('div', 'jn-tabla', der);
      esp.PARTES.forEach(function (q) {
        var f = el('div', 'jn-venta', tabla), tiene = esp.partes[q.id] || 0;
        el('span', 'n', f, esc(q.n) + ' <small>(tienes ' + tiene + ')</small>'); el('span', 'q', f, q.c + ' ⬢');
        var b = el('button', 'jn-btn', f, pz >= q.c ? 'CANJEAR' : 'FALTAN ' + (q.c - pz)); if (pz < q.c) b.disabled = true;
        b.onclick = function () { if (esp.canjear(q.id)) toast('+1 ' + q.n.toUpperCase(), 1); pintarAstillero(); };
      });
    }
    function pausar(p) { if (atracado || mapaAbierto) return; pausado = p; if (p) hud.menu.classList.add('on'); else hud.menu.classList.remove('on'); }

    /* ---------- generación del universo por celdas ---------- */
    var SIL = ['ka', 'ro', 've', 'lu', 'mi', 'tor', 'zen', 'ar', 'ix', 'on', 'da', 'sel', 'vor', 'nem', 'ul', 'cor', 'phe', 'tis', 'ba', 'rin', 'qua', 'dre', 'sha', 'lom'], ROM = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];
    function nombrePlaneta(r) { var n = 2 + (r() < 0.4 ? 1 : 0), s = '', i; for (i = 0; i < n; i++) s += SIL[(r() * SIL.length) | 0]; return s.charAt(0).toUpperCase() + s.slice(1) + ' ' + ROM[(r() * ROM.length) | 0]; }
    function tipoPlaneta(r) { var u = r(); return u < 0.22 ? 'arido' : u < 0.42 ? 'rocoso' : u < 0.56 ? 'hielo' : u < 0.68 ? 'gaseoso' : u < 0.78 ? 'gaseoso2' : u < 0.86 ? 'lava' : 'tormenta'; }
    /* Estaciones: una por cada "supercelda" de 55 km con posición desplazada al azar. A la velocidad de la nave inicial (220 m/s)
       eso son unos 3-5 minutos de vuelo entre estaciones. Es una función pura: sirve para el mundo, el radar ampliado y la baliza. */
    var cacheEst = {}, nCacheEst = 0, cacheAst = {}, nCacheAst = 0, cacheLig = {}, nCacheLig = 0, cacheCan = {}, nCacheCan = 0;   // memoria de cálculos (son funciones puras, no cambian)
    function estacionSuper(sx, sy, sz) {
      var kc = sx + ',' + sy + ',' + sz, hit = cacheEst[kc]; if (hit) return hit;
      var S = CONFIG.espaciadoEstaciones, r = mulberry32(hash3(sx, sy, sz, (CONFIG.semilla ^ 0x57A7) | 0)), J = 0.3;
      var res = { key: 'E' + sx + ',' + sy + ',' + sz, x: (sx + 0.5 + (r() - 0.5) * 2 * J) * S, y: (sy + 0.5 + (r() - 0.5) * 2 * J) * S, z: (sz + 0.5 + (r() - 0.5) * 2 * J) * S, r: CONFIG.radioEstacion, giro: r() * TAU, nombre: 'Ágora ' + nombrePlaneta(r).split(' ')[0], tipo: 'estacion' };
      if (++nCacheEst > 6000) { cacheEst = {}; nCacheEst = 0; } cacheEst[kc] = res; return res;
    }
    function estacionesEn(x, y, z, R) {   // estaciones a menos de R metros, de la más cercana a la más lejana
      var S = CONFIG.espaciadoEstaciones, n = Math.ceil(R / S) + 1, cx = Math.floor(x / S), cy = Math.floor(y / S), cz = Math.floor(z / S), out = [], a, b, c, e, dx, dy, dz, d;
      for (a = -n; a <= n; a++) for (b = -n; b <= n; b++) for (c = -n; c <= n; c++) {
        e = estacionSuper(cx + a, cy + b, cz + c); dx = e.x - x; dy = e.y - y; dz = e.z - z; d = Math.sqrt(dx * dx + dy * dy + dz * dz); if (d <= R) out.push({ o: e, d: d });
      }
      out.sort(function (u, v) { return u.d - v.d; }); return out;
    }
    /* Astilleros: misma idea que las estaciones pero en su propia rejilla (70 km). Ahí se canjean los trozos metálicos por partes de nave. */
    function astilleroSuper(sx, sy, sz) {
      var kc = sx + ',' + sy + ',' + sz; if (kc in cacheAst) return cacheAst[kc];
      var S = CONFIG.espaciadoAstilleros, r = mulberry32(hash3(sx, sy, sz, (CONFIG.semilla ^ 0xA571) | 0)), J = 0.3;
      var o = { key: 'A' + sx + ',' + sy + ',' + sz, x: (sx + 0.5 + (r() - 0.5) * 2 * J) * S, y: (sy + 0.5 + (r() - 0.5) * 2 * J) * S, z: (sz + 0.5 + (r() - 0.5) * 2 * J) * S, r: CONFIG.radioAstillero, giro: r() * TAU, nombre: 'Astillero ' + nombrePlaneta(r).split(' ')[0], tipo: 'astillero' };
      var ce = estacionesEn(o.x, o.y, o.z, 6000), res = ce.length ? null : o;   // nunca pegado a una estación
      if (++nCacheAst > 6000) { cacheAst = {}; nCacheAst = 0; } cacheAst[kc] = res; return res;
    }
    function canteraSuper(sx, sy, sz) {
      var kc = sx + ',' + sy + ',' + sz; if (kc in cacheCan) return cacheCan[kc];
      var S = CONFIG.espaciadoCanteras, r = mulberry32(hash3(sx, sy, sz, (CONFIG.semilla ^ 0xCA17) | 0)), J = 0.3;
      var o = { key: 'Q' + kc, x: (sx + 0.5 + (r() - 0.5) * 2 * J) * S, y: (sy + 0.5 + (r() - 0.5) * 2 * J) * S, z: (sz + 0.5 + (r() - 0.5) * 2 * J) * S, r: CONFIG.radioCantera, giro: r() * TAU, nombre: 'Cantera ' + nombrePlaneta(r).split(' ')[0], tipo: 'cantera' };
      var res = (estacionesEn(o.x, o.y, o.z, 7000).length || astillerosEn(o.x, o.y, o.z, 7000).length) ? null : o;
      if (++nCacheCan > 6000) { cacheCan = {}; nCacheCan = 0; } cacheCan[kc] = res; return res;
    }
    function canterasEn(x, y, z, R) {
      var S = CONFIG.espaciadoCanteras, n = Math.ceil(R / S) + 1, cx = Math.floor(x / S), cy = Math.floor(y / S), cz = Math.floor(z / S), out = [], a, b, c, e, d, dx, dy, dz;
      for (a = -n; a <= n; a++) for (b = -n; b <= n; b++) for (c = -n; c <= n; c++) {
        e = canteraSuper(cx + a, cy + b, cz + c); if (!e) continue; dx = e.x - x; dy = e.y - y; dz = e.z - z; d = Math.sqrt(dx * dx + dy * dy + dz * dz); if (d <= R) out.push({ o: e, d: d });
      }
      return out;
    }
    function astillerosEn(x, y, z, R) {
      var S = CONFIG.espaciadoAstilleros, n = Math.ceil(R / S) + 1, cx = Math.floor(x / S), cy = Math.floor(y / S), cz = Math.floor(z / S), out = [], a, b, c, e, d, dx, dy, dz;
      for (a = -n; a <= n; a++) for (b = -n; b <= n; b++) for (c = -n; c <= n; c++) {
        e = astilleroSuper(cx + a, cy + b, cz + c); if (!e) continue; dx = e.x - x; dy = e.y - y; dz = e.z - z; d = Math.sqrt(dx * dx + dy * dy + dz * dz); if (d <= R) out.push({ o: e, d: d });
      }
      return out;
    }
    function lugaresEn(x, y, z, R) {   // estaciones + astilleros, del más cercano al más lejano
      var l = estacionesEn(x, y, z, R).concat(astillerosEn(x, y, z, R), canterasEn(x, y, z, R)); l.sort(function (u, v) { return u.d - v.d; }); return l;
    }
    function chocaEstacion(x, y, z, rad) {   // ¿algo de ese radio pisaría una estación o un astillero?
      return estacionesEn(x, y, z, rad + CONFIG.radioEstacion + 800).length > 0 || astillerosEn(x, y, z, rad + CONFIG.radioAstillero + 800).length > 0 || canterasEn(x, y, z, rad + CONFIG.radioCantera + 800).length > 0;
    }
    function generar(ix, iy, iz, ligero) {   // ligero: sin rocas (para el mapa)
      var C = CONFIG.celda, r = mulberry32(hash3(ix, iy, iz, CONFIG.semilla)), cel = { key: ix + ',' + iy + ',' + iz, ix: ix, iy: iy, iz: iz, planeta: null, campo: null };
      if (r() < 0.06) {
        var tp = tipoPlaneta(r), gas = tp === 'gaseoso' || tp === 'gaseoso2', rad = gas ? 1500 + r() * 1700 : 500 + r() * 1400;
        cel.planeta = { x: (ix + 0.2 + 0.6 * r()) * C, y: (iy + 0.2 + 0.6 * r()) * C, z: (iz + 0.2 + 0.6 * r()) * C, r: rad, tipo: tp, nombre: nombrePlaneta(r), anillos: gas ? r() < 0.4 : r() < 0.07, incl: 0.1 + r() * 0.5, tinte: [0.85 + r() * 0.3, 0.85 + r() * 0.3, 0.85 + r() * 0.3], giro: (r() - 0.5) * 0.04, g: null, k: 0 };
      }
      if (cel.planeta && chocaEstacion(cel.planeta.x, cel.planeta.y, cel.planeta.z, cel.planeta.r * 1.6)) cel.planeta = null;
      if (r() < 0.4) {
        var a = 700 + r() * 900, cx = (ix + 0.15 + 0.7 * r()) * C, cy = (iy + 0.15 + 0.7 * r()) * C, cz = (iz + 0.15 + 0.7 * r()) * C, ok = true;
        if (cel.planeta) { var pl = cel.planeta, dd = Math.sqrt((cx - pl.x) * (cx - pl.x) + (cy - pl.y) * (cy - pl.y) + (cz - pl.z) * (cz - pl.z)); if (dd < pl.r * 1.5 + a + 500) ok = false; }
        if (ok && chocaEstacion(cx, cy, cz, a + 200)) ok = false;
        if (ok) {
          var n = 28 + ((r() * 32) | 0), rocas = [], i, b = a * (0.35 + 0.4 * r()), c3 = a * (0.6 + 0.4 * r());
          for (i = 0; i < (ligero ? 0 : n); i++) {
            var th = r() * TAU, ph = Math.acos(2 * r() - 1), rr = Math.pow(r(), 0.6);
            rocas.push({ lx: a * rr * Math.sin(ph) * Math.cos(th), ly: b * rr * Math.cos(ph), lz: c3 * rr * Math.sin(ph) * Math.sin(th), s: 8 + Math.pow(r(), 3) * 95, sx: 0.8 + r() * 0.5, sy: 0.6 + r() * 0.5, sz: 0.8 + r() * 0.5, e: [r() * TAU, r() * TAU, r() * TAU], v: (r() * 3) | 0 });
          }
          cel.campo = { x: cx, y: cy, z: cz, a: a, rocas: rocas, mat: (r() * 3) | 0, g: null };
        }
      }
      return cel;
    }
    function celda(ix, iy, iz) { var k = ix + ',' + iy + ',' + iz, c = celdas[k]; if (!c) { c = generar(ix, iy, iz); celdas[k] = c; } return c; }
    function crearPlaneta(pl) {
      var g = new THREE.Group(), mat = new THREE.MeshStandardMaterial({ map: planetaTex[pl.tipo], roughness: 0.95, metalness: 0, color: new THREE.Color(pl.tinte[0], pl.tinte[1], pl.tinte[2]) });
      var cuerpo = new THREE.Mesh(SG, mat); cuerpo.userData.propio = false; cuerpo.rotation.z = pl.incl * 0.3; g.add(cuerpo);
      var atm = new THREE.Mesh(SG, atmosfera(pl.tipo)); atm.scale.setScalar(1.07); g.add(atm);
      if (pl.anillos) { var an = new THREE.Mesh(geoAnillo, matAnillo); an.rotation.x = -PI / 2 + pl.incl; g.add(an); }
      g.userData.cuerpo = cuerpo; g.userData.mat = mat; g.scale.setScalar(pl.r * 0.6); pl.g = g; pl.k = 0; sc.add(g);
    }
    function atmosfera(tipo) {
      if (matAtm[tipo]) return matAtm[tipo]; var c = COLOR_ATM[tipo];
      matAtm[tipo] = new THREE.ShaderMaterial({
        uniforms: { color: { value: new THREE.Color(c[0], c[1], c[2]) } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
        vertexShader: 'varying vec3 vN; varying vec3 vV; void main(){ vN = normalize(normalMatrix * normal); vec4 mv = modelViewMatrix * vec4(position, 1.0); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }',
        fragmentShader: 'uniform vec3 color; varying vec3 vN; varying vec3 vV; void main(){ float f = pow(clamp(1.0 - abs(dot(normalize(vN), normalize(vV))), 0.0, 1.0), 3.0); gl_FragColor = vec4(color * f * 1.3, f); }'
      });
      return matAtm[tipo];
    }
    function quitarPlaneta(pl) { if (pl.g) { sc.remove(pl.g); if (pl.g.userData.mat) pl.g.userData.mat.dispose(); pl.g = null; } }
    function crearCampo(cp) {
      var g = new THREE.Group(), grupos = [[], [], []], i, j, k;
      for (i = 0; i < cp.rocas.length; i++) grupos[cp.rocas[i].v].push(cp.rocas[i]);
      for (k = 0; k < 3; k++) {
        if (!grupos[k].length) continue;
        var im = new THREE.InstancedMesh(geosRoca[k], matsRoca[cp.mat], grupos[k].length);
        for (j = 0; j < grupos[k].length; j++) { var ro = grupos[k][j]; ro.im = im; ro.ii = j; dummy.position.set(ro.lx, ro.ly, ro.lz); dummy.rotation.set(ro.e[0], ro.e[1], ro.e[2]); dummy.scale.set(ro.s * ro.sx, ro.s * ro.sy, ro.s * ro.sz); dummy.updateMatrix(); im.setMatrixAt(j, dummy.matrix); }
        for (j = 0; j < grupos[k].length; j++) { if (grupos[k][j].dead) { dummy.position.set(0, 0, 0); dummy.scale.set(0, 0, 0); dummy.updateMatrix(); im.setMatrixAt(j, dummy.matrix); } }
        im.instanceMatrix.needsUpdate = true; im.frustumCulled = false; g.add(im);
      }
      cp.g = g; sc.add(g);
    }
    function quitarCampo(cp) { if (cp.g) { cp.g.children.forEach(function (m) { if (m.dispose) m.dispose(); }); sc.remove(cp.g); cp.g = null; } }
    function actualizarCeldas(forzar) {
      var C = CONFIG.celda, cx = Math.floor(P.x / C), cy = Math.floor(P.y / C), cz = Math.floor(P.z / C);
      if (!forzar && cx === ucx && cy === ucy && cz === ucz) return;
      ucx = cx; ucy = cy; ucz = cz;
      var Rp = CALIDAD[jug.calidad].radioPlanetas, dx, dy, dz, keep = {}, k, c;
      listaPl = []; listaRo = []; camposVis = [];
      for (dx = -Rp; dx <= Rp; dx++) for (dy = -Rp; dy <= Rp; dy++) for (dz = -Rp; dz <= Rp; dz++) {
        c = celda(cx + dx, cy + dy, cz + dz); keep[c.key] = 1;
        var d = Math.max(Math.abs(dx), Math.abs(dy), Math.abs(dz));
        if (c.planeta) { listaPl.push(c.planeta); if (!c.planeta.g) crearPlaneta(c.planeta); }
        if (c.campo) {
          if (d <= 1) { if (!c.campo.g) crearCampo(c.campo); camposVis.push(c.campo); } else if (c.campo.g && d > 2) quitarCampo(c.campo);
        }
      }
      for (k in celdas) if (!keep[k]) { c = celdas[k]; if (c.planeta) quitarPlaneta(c.planeta); if (c.campo) quitarCampo(c.campo); delete celdas[k]; }
      listaEst = lugaresEn(P.x, P.y, P.z, 36000).filter(function (q) { return (q.o.tipo !== 'astillero' && q.o.tipo !== 'cantera') || q.d < 15000; }).map(function (q) { return q.o; });   // el astillero (modelo pesado) solo se construye cuando ya está cerca   // las que están lo bastante cerca para dibujarse
      estLejanas = lugaresEn(P.x, P.y, P.z, 130000);                                    // para radar y baliza
      if (esp) esp.estaciones(listaEst);
      camposVis.forEach(function (cp) { cp.rocas.forEach(function (ro) { if (!ro.dead) listaRo.push({ x: cp.x + ro.lx, y: cp.y + ro.ly, z: cp.z + ro.lz, r: ro.s * 0.9, ro: ro, cp: cp }); }); });
    }
    function posicionInicial() {   // aparición aleatoria: a unos 20-55 km (3-4 min) de la estación más cercana, mirando en una dirección cualquiera
      var C = CONFIG.celda, t, ok = false, q, c, l, d, dx, dy, dz;
      for (t = 0; t < 60 && !ok; t++) {
        P.x = (Math.random() - 0.5) * 600000; P.y = (Math.random() - 0.5) * 300000; P.z = (Math.random() - 0.5) * 600000;
        l = estacionesEn(P.x, P.y, P.z, 80000); if (!l.length || l[0].d < 20000 || l[0].d > 55000) continue;
        c = celda(Math.floor(P.x / C), Math.floor(P.y / C), Math.floor(P.z / C)); ok = true;
        if (c.planeta) { dx = P.x - c.planeta.x; dy = P.y - c.planeta.y; dz = P.z - c.planeta.z; if (Math.sqrt(dx * dx + dy * dy + dz * dz) < c.planeta.r * 1.5 + 300) ok = false; }
        if (c.campo) { dx = P.x - c.campo.x; dy = P.y - c.campo.y; dz = P.z - c.campo.z; if (Math.sqrt(dx * dx + dy * dy + dz * dz) < c.campo.a + 300) ok = false; }
      }
      if (!ok) { l = estacionesEn(0, 0, 0, 80000); P.x = l[0].o.x + 35000; P.y = l[0].o.y; P.z = l[0].o.z; }
      qa.setFromAxisAngle(AY, Math.random() * TAU); Q.set(0, 0, 0, 1); Q.multiply(qa); qa.setFromAxisAngle(AX, (Math.random() - 0.5) * 0.6); Q.multiply(qa); Q.normalize();
    }

    /* ---------- polvo de velocidad ---------- */
    function crearPolvo() {
      if (polvo) { sc.remove(polvo); polvo.geometry.dispose(); polvo.material.dispose(); }
      polvoN = CALIDAD[jug.calidad].polvo; polvoPos = new Float32Array(polvoN * 3);
      for (var i = 0; i < polvoN * 3; i++) polvoPos[i] = (Math.random() - 0.5) * 700;
      var g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(polvoPos, 3));
      polvo = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xbcd4ff, size: 2.2, sizeAttenuation: false, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
      polvo.frustumCulled = false; sc.add(polvo);
    }
    function moverPolvo(dt, rapidez) {
      var i, R = 350, dx = -V.x * dt, dy = -V.y * dt, dz = -V.z * dt, p = polvoPos;
      for (i = 0; i < polvoN * 3; i += 3) {
        p[i] += dx; p[i + 1] += dy; p[i + 2] += dz;
        if (p[i] > R) p[i] -= 2 * R; else if (p[i] < -R) p[i] += 2 * R;
        if (p[i + 1] > R) p[i + 1] -= 2 * R; else if (p[i + 1] < -R) p[i + 1] += 2 * R;
        if (p[i + 2] > R) p[i + 2] -= 2 * R; else if (p[i + 2] < -R) p[i + 2] += 2 * R;
      }
      polvo.geometry.attributes.position.needsUpdate = true;
      polvo.material.opacity = clamp(rapidez * 1.4, 0, 0.85);
    }

    /* ---------- entrada ---------- */
    function entrada() {
      var yaw = (teclas.KeyD || teclas.ArrowRight ? 1 : 0) - (teclas.KeyA || teclas.ArrowLeft ? 1 : 0) + stick.ax;
      var pit = (teclas.ArrowUp ? 1 : 0) - (teclas.ArrowDown ? 1 : 0) - stick.ay;
      if (jug.invertirY) pit = -pit;
      return { yaw: clamp(yaw, -1, 1), pit: clamp(pit, -1, 1), roll: (teclas.KeyE ? 1 : 0) - (teclas.KeyQ ? 1 : 0), acel: (teclas.KeyW ? 1 : 0) - (teclas.KeyS ? 1 : 0), turbo: !!(teclas.ShiftLeft || teclas.ShiftRight || botT), freno: !!(teclas.Space || botF), fuego: !!(teclas.KeyF || botFu) };
    }
    function palancaVisual(on) {
      hud.palanca.style.display = on ? 'block' : 'none';
      if (on) { hud.palanca.style.left = stick.x0 + 'px'; hud.palanca.style.top = stick.y0 + 'px'; hud.palI2.style.transform = 'translate(' + (stick.ax * 40) + 'px,' + (stick.ay * 40) + 'px)'; }
    }

    /* ---------- piloto automático: navega al destino marcado esquivando rocas y asteroides; no defiende ---------- */
    var laserT = null, ap = { on: false, huir: false, minar: false, seg: false, espera: false, tr: 0, meta: null }, apLaser = false, apE = { yaw: 0, pit: 0, roll: 0, acel: 0, turbo: false, freno: false }, apQ, apD, apS, apL;
    function esLugar(o) { return o && (o.tipo === 'estacion' || o.tipo === 'astillero'); }
    function apDistParada(m) { if (m.ro) return m.r + 110; if (m.stop) return m.stop; return esLugar(m) ? (m.r || 260) + 70 : (m.r || 0) * (m.tipo === 'planeta' || m.tipo === 'minero' ? 1.15 : 1) + 250; }
    function apParar(txt) { ap.on = false; ap.huir = false; ap.minar = false; ap.seg = false; ap.espera = false; apLaser = false; ap.meta = null; hzN = 0; if (hud.bMod) hud.bMod.classList.remove('on'); if (hud.bAuto) hud.bAuto.classList.remove('on'); if (txt) toast(txt, 1.5); }
    function apAlternar() {
      if (pausado || atracado) return;
      if (ap.on) { apParar('PILOTO AUTOMÁTICO APAGADO'); return; }
      if (!meta) { toast('MARCA UN DESTINO EN EL MAPA', 1.8); return; }
      ap.on = true; ap.huir = false; ap.meta = meta; hud.bAuto.classList.add('on'); toast('PILOTO AUTOMÁTICO', 1.2);
    }
    function apHuir() {   // si te atacan: se cancela el rumbo y la nave corre con turbo a la estación más cercana
      var i, o = null;
      for (i = 0; i < estLejanas.length; i++) if (esLugar(estLejanas[i].o) && estLejanas[i].o.tipo === 'estacion') { o = estLejanas[i].o; break; }
      if (!o) for (i = 0; i < estLejanas.length; i++) if (esLugar(estLejanas[i].o)) { o = estLejanas[i].o; break; }
      if (!o) { apParar('PILOTO AUTOMÁTICO CANCELADO'); return; }
      ap.on = true; ap.huir = true; ap.meta = o; hud.bAuto.classList.add('on'); toast('¡ATACADO! HUYENDO A ' + o.nombre.toUpperCase(), 2.4);
    }
    function apPaso(dt) {   // calcula "palanca virtual" (apE) y acelerador para ir a ap.meta
      apLaser = false;
      if (ap.minar) {
        if (bodLlena(jug.nave)) { if (!hayCarguero()) { apParar('BODEGA LLENA · LLAMA AL CARGUERO'); return; } ap.espera = true; if (!ap.meta) ap.meta = elegirRoca(P.x, P.y, P.z, 30000, jug.nave); }
        else { ap.espera = false; if (!ap.meta || (ap.meta.ro && ap.meta.ro.dead)) { ap.meta = elegirRoca(P.x, P.y, P.z, 30000, jug.nave); if (ap.meta) ap.meta.ro.res = jug.nave; } }
        if (!ap.meta) { apParar('SIN ROCAS CERCA'); return; }
      } else if (ap.seg) {
        var mi = buscarMinero(); if (!mi) { apParar('SIN PROSPECTOR QUE SEGUIR'); return; }
        var pp = posDe(mi); segMeta.x = pp.x; segMeta.y = pp.y; segMeta.z = pp.z; segMeta.stop = necesitaRecogida(mi) ? 260 : 700; ap.meta = segMeta; ap.mi = mi;
      }
      var m = ap.meta, dx = m.x - P.x, dy = m.y - P.y, dz = m.z - P.z, dist = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1, stop = apDistParada(m);
      var llego = dist <= stop + 15, hold = ap.minar || ap.seg;
      if (llego && !hold) { apParar(ap.huir ? 'A SALVO EN ' + m.nombre.toUpperCase() : 'LLEGASTE'); acelerador = 0; apE.yaw = apE.pit = 0; apE.freno = true; return; }
      if (!apQ) { apQ = new THREE.Quaternion(); apD = new THREE.Vector3(); apS = new THREE.Vector3(); apL = new THREE.Vector3(); }
      apD.set(dx / dist, dy / dist, dz / dist); apS.set(0, 0, 0);
      var look = Math.max(500, vel * 6), R = Math.max(med.radio * 0.5, 3), i, o, rx, ry, rz, t, px, py, pz, dp, rr, w, lst = esp ? esp._ast : [];
      function obst(cx, cy, cz, r) {
        rx = cx - P.x; ry = cy - P.y; rz = cz - P.z; t = rx * apD.x + ry * apD.y + rz * apD.z; if (t < -r || t > look + r) return;
        px = rx - apD.x * t; py = ry - apD.y * t; pz = rz - apD.z * t; dp = Math.sqrt(px * px + py * py + pz * pz); rr = r + R + 90; if (dp >= rr) return;
        if (dp < 1) { px = apD.y; py = -apD.x; pz = 0; dp = Math.sqrt(px * px + py * py) || 1; px = -px; py = -py; }   // justo de frente: se rodea por un lado
        w = (1 - dp / rr) * (1.4 + 2.2 * (1 - Math.max(0, t) / look)); apS.x -= px / dp * w; apS.y -= py / dp * w; apS.z -= pz / dp * w;
      }
      for (i = 0; i < listaRo.length; i++) { o = listaRo[i]; if (o === m || (o.ro && o.ro.dead) || o.x - P.x > look + 400 || P.x - o.x > look + 400) continue; obst(o.x, o.y, o.z, o.r); }
      for (i = 0; i < lst.length; i++) obst(lst[i].x, lst[i].y, lst[i].z, lst[i].r);
      apD.add(apS); apD.normalize();
      apQ.copy(Q).invert(); apL.copy(apD).applyQuaternion(apQ);   // dirección deseada en ejes de la nave (la nariz es -Z)
      var yawErr = Math.atan2(apL.x, -apL.z), pitErr = Math.atan2(apL.y, -apL.z), err = Math.sqrt(yawErr * yawErr + pitErr * pitErr);
      apE.yaw = clamp(yawErr * 3, -1, 1); apE.pit = clamp(pitErr * 3, -1, 1); apE.roll = 0; apE.acel = 0; apE.freno = false; apE.turbo = ap.huir;
      var cruce = ap.huir ? 1 : clamp((dist - stop) / 3500, 0.12, 1); cruce *= 1 - Math.min(0.75, err / 1.6);
      if (apS.lengthSq() > 0.3) cruce = Math.min(cruce, 0.5);
      if (hold && (llego || ap.espera)) {
        cruce = 0; if (ap.espera) cruce = 0;
        if (ap.minar && !ap.espera) { if (Math.abs(yawErr) < 0.14 && Math.abs(pitErr) < 0.14) { apLaser = true; danarRoca(m, dt, jug.nave); if (!laserT) laserT = new THREE.Vector3(); laserT.copy(apL).multiplyScalar(Math.min(60, dist / nSel.m)); } }
        else if (ap.seg && llego) {
          if (necesitaRecogida(ap.mi)) { ap.tr += dt; hzN = 1; hzA[0] = P.x; hzA[1] = P.y; hzA[2] = P.z; hzB[0] = m.x; hzB[1] = m.y; hzB[2] = m.z; if (ap.tr >= 3.5) { ap.tr = 0; var mv = transferir(ap.mi, jug.nave); toast(mv ? 'CARGA RECIBIDA +' + mv : 'CARGUERO LLENO', 1.5); if (!mv) apParar('CARGUERO LLENO · VE A UNA ESTACIÓN'); } } else ap.tr = 0;
        }
      }
      acelerador += (cruce - acelerador) * Math.min(1, dt * 1.6);
    }
    /* ---------- flota: tus naves vuelan solas; minería automática y carguero que sigue al minero ---------- */
    var flota = {}, bodegas = {}, CAPAC = CONFIG.capacidades || { prospector: 40, mastodonte: 360 }, hzN = 0, hzA = [0, 0, 0], hzB = [0, 0, 0], haz = null, panelFlota = false, segMeta = { nombre: 'PROSPECTOR', tipo: 'seg', r: 0, x: 0, y: 0, z: 0, stop: 700 };
    var iaF = null, iaD, iaA, iaQ, iaR, iaUp;
    function capDe(id) { return CAPAC[id] || 0; }
    function bodDe(id) { return bodegas[id] || (bodegas[id] = { n: 0, it: {} }); }
    function bodLlena(id) { var c = capDe(id); return c > 0 && bodDe(id).n >= c; }
    function sincCarga(id) { var m = id === jug.nave ? modelo : (flota[id] && flota[id].mod); try { if (m && m.setCargo) m.setCargo(capDe(id) ? bodDe(id).n / capDe(id) : 0); } catch (e) { } }
    function bodAgregar(id, it) { var b = bodDe(id), c = capDe(id), k, q, t = 0; for (k in it) { q = Math.min(it[k], c - b.n); if (q <= 0) continue; b.it[k] = (b.it[k] || 0) + q; b.n += q; t += q; } sincCarga(id); return t; }
    function transferir(a, b) {   // pasa lo que quepa de la bodega a a la bodega b
      var A = bodDe(a), B = bodDe(b), cap = capDe(b) - B.n, k, q, mv = 0;
      for (k in A.it) { q = Math.min(A.it[k], cap - mv); if (q <= 0) break; B.it[k] = (B.it[k] || 0) + q; A.it[k] -= q; mv += q; }
      B.n += mv; A.n -= mv; sincCarga(a); sincCarga(b); return mv;
    }
    function bodAInventario(id) { var b = bodDe(id); if (!b.n) return 0; var t = esp.depositar(b.it); b.it = {}; b.n = 0; sincCarga(id); return t; }
    function necesitaRecogida(id) { var c = capDe(id); return c > 0 && bodDe(id).n >= c * 0.95; }
    function posDe(id) { if (id === jug.nave) return P; var s = flota[id]; return s && s.modo !== 'hangar' && s.modo !== 'piloto' ? s : null; }
    function buscarMinero() {
      if (nSel.minero) return jug.nave; var id; for (id in flota) if (naveDe(id) && naveDe(id).minero && posDe(id)) return id; return null;
    }
    function hayCarguero() { var id, s; if (jug.nave === 'mastodonte' && ap.seg) return true; for (id in flota) { s = flota[id]; if (id === 'mastodonte' && s.modo === 'sigue') return true; } return false; }
    function elegirRoca(x, y, z, R, id) {
      var i, o, dx, dy, dz, d, best = null, bd = R * R;
      for (i = 0; i < listaRo.length; i++) {
        o = listaRo[i]; if (!o.ro || o.ro.dead || (o.ro.res && o.ro.res !== id)) continue;
        dx = o.x - x; dy = o.y - y; dz = o.z - z; d = dx * dx + dy * dy + dz * dz; if (d < bd) { bd = d; best = o; }
      }
      return best;
    }
    function regFlota(id) { return flota[id] || (flota[id] = { id: id, x: 0, y: 0, z: 0, q: new THREE.Quaternion(), vel: 0, modo: 'hangar', meta: null, g: null, mod: null, tgt: null, tr: 0, minando: false, lz: null, err: 0 }); }
    function montarIA(s) {
      if (s.g) return true; var m = obtenerModelo(s.id), n = naveDe(s.id); if (!m) return false;
      var w = new THREE.Group(), e = new THREE.Group(); e.scale.setScalar(n.m); e.add(m.group); w.add(e); sc.add(w); s.g = w; s.mod = m; return true;
    }
    function quitarIA(s) { if (s.g) { sc.remove(s.g); s.g = null; } }
    function desplegar(id) {   // la nave sale del hangar a 1,5 km de ti
      var s = regFlota(id); if (s.modo !== 'hangar') return s;
      if (!montarIA(s)) return null;
      var a = Math.random() * TAU; v1.set(Math.cos(a), (Math.random() - 0.5) * 0.4, Math.sin(a)).normalize();
      s.x = P.x + v1.x * 1500; s.y = P.y + v1.y * 1500; s.z = P.z + v1.z * 1500; s.vel = 0; s.modo = 'parada';
      v1.set(P.x - s.x, P.y - s.y, P.z - s.z).normalize(); iaUp = iaUp || new THREE.Vector3(0, 0, -1); s.q.setFromUnitVectors(iaUp, v1);
      return s;
    }
    function llamarNave(id) {
      if (id === jug.nave) { toast('YA PILOTAS ESA NAVE'); return; }
      var s = desplegar(id); if (!s) { toast('NO SE PUDO CARGAR LA NAVE'); return; }
      s.modo = 'nav'; s.meta = { jugador: true }; s.tgt = null; s.minando = false; toast('LLAMANDO A ' + naveDe(id).nombre.toUpperCase(), 1.5);
    }
    function ordenar(id, modo) {   // modo: 'mina' | 'sigue' | 'estacion' | 'parar'
      if (id === jug.nave) { ordenPiloto(modo); return; }
      var s = desplegar(id); if (!s) return;
      if (modo === 'parar') { s.modo = 'parada'; s.meta = null; s.tgt = null; s.minando = false; toast('NAVE DETENIDA', 1); return; }
      if (modo === 'mina') { if (!naveDe(id).minero) { toast('ESA NAVE NO MINA'); return; } s.modo = 'mina'; s.tgt = null; toast('MINERÍA AUTOMÁTICA', 1.2); return; }
      if (modo === 'sigue') { if (id !== 'mastodonte') { toast('SOLO EL CARGUERO SIGUE AL MINERO'); return; } s.modo = 'sigue'; s.tgt = null; toast('SIGUIENDO AL PROSPECTOR', 1.2); return; }
      if (modo === 'estacion') { var l = lugaresEn(s.x, s.y, s.z, 200000).filter(function (q) { return q.o.tipo === 'estacion'; })[0]; if (!l) { toast('NO HAY ESTACIONES CERCA'); return; } s.modo = 'nav'; s.meta = l.o; toast('RUMBO A ' + l.o.nombre.toUpperCase(), 1.4); }
    }
    function ordenPiloto(modo) {   // la nave que pilotas
      if (modo === 'parar') { apParar('PILOTO AUTOMÁTICO APAGADO'); return; }
      if (modo === 'mina') { if (!nSel.minero) { toast('ESTA NAVE NO MINA'); return; } if (ap.on && ap.minar) { apParar('MINERÍA APAGADA'); return; } apParar(); ap.on = true; ap.minar = true; hud.bAuto.classList.add('on'); hud.bMod.classList.add('on'); toast('MINERÍA AUTOMÁTICA', 1.2); return; }
      if (modo === 'sigue') { if (jug.nave !== 'mastodonte') { toast('SOLO EL CARGUERO SIGUE AL MINERO'); return; } if (ap.on && ap.seg) { apParar('SEGUIMIENTO APAGADO'); return; } apParar(); ap.on = true; ap.seg = true; hud.bAuto.classList.add('on'); hud.bMod.classList.add('on'); toast('SIGUIENDO AL PROSPECTOR', 1.2); return; }
      if (modo === 'estacion') { var l = lugaresEn(P.x, P.y, P.z, 200000).filter(function (q) { return q.o.tipo === 'estacion'; })[0]; if (!l) { toast('NO HAY ESTACIONES CERCA'); return; } apParar(); ap.on = true; ap.meta = l.o; hud.bAuto.classList.add('on'); toast('RUMBO A ' + l.o.nombre.toUpperCase(), 1.4); }
    }
    function cambiarA(id) {
      var cur = jug.nave; if (id === cur) return;
      var s = regFlota(id); if (s.modo === 'hangar') { llamarNave(id); toast('LLÁMALA Y PILÓTALA CUANDO LLEGUE', 2); return; }
      var dx = s.x - P.x, dy = s.y - P.y, dz = s.z - P.z, d = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (d > 4000) { toast('ESTÁ A ' + fmtDist(d) + ' · LLÁMALA', 2); return; }
      var c = regFlota(cur); c.x = P.x; c.y = P.y; c.z = P.z; c.q.copy(Q); c.vel = vel; c.modo = 'parada'; c.meta = null; c.tgt = null; c.minando = false; montarIA(c);
      apParar(); jug.nave = id; nSel = naveDe(id); modelo = obtenerModelo(id); med = medidas[id];
      escalarN.scale.setScalar(nSel.m); escalarN.add(modelo.group); quitarIA(s); s.modo = 'piloto'; s.mod = null;
      P.x = s.x; P.y = s.y; P.z = s.z; Q.copy(s.q); V.set(0, 0, -s.vel).applyQuaternion(Q); qCam.copy(Q); rYaw = rPitch = rRoll = 0; acelerador = clamp(s.vel / nSel.vmax, 0, 1);
      try { if (modelo.setAccent) modelo.setAccent(jug.acento); } catch (e) { }
      hud.nom.textContent = nSel.nombre.toUpperCase() + ' · ' + esc(jug.nombre); esp.setRadio(med.radio); sincCarga(id); botonModo(); laserT = null;
      toast('PILOTANDO ' + nSel.nombre.toUpperCase(), 1.6);
    }
    function botonModo() { var k = nSel.minero ? 'MINAR' : (jug.nave === 'mastodonte' ? 'SEGUIR' : ''); hud.bMod.textContent = k; hud.bMod.style.display = k ? 'flex' : 'none'; hud.bMod.classList.toggle('on', !!(ap.on && (ap.minar || ap.seg))); }
    function iaObst(s, cx, cy, cz, r, look, Rn) {
      var rx = cx - s.x, ry = cy - s.y, rz = cz - s.z, t = rx * iaD.x + ry * iaD.y + rz * iaD.z; if (t < -r || t > look + r) return;
      var px = rx - iaD.x * t, py = ry - iaD.y * t, pz = rz - iaD.z * t, dp = Math.sqrt(px * px + py * py + pz * pz), rr = r + Rn + 90; if (dp >= rr) return;
      if (dp < 1) { px = iaD.y; py = -iaD.x; pz = 0; dp = Math.sqrt(px * px + py * py) || 1; px = -px; py = -py; }
      var w = (1 - dp / rr) * (1.4 + 2.2 * (1 - Math.max(0, t) / look)); iaR.x -= px / dp * w; iaR.y -= py / dp * w; iaR.z -= pz / dp * w;
    }
    function iaMover(s, tx, ty, tz, stop, dt, vf, quieta) {   // navega hacia un punto esquivando rocas y asteroides; devuelve la distancia que falta
      if (!iaF) { iaF = new THREE.Vector3(); iaD = new THREE.Vector3(); iaA = new THREE.Vector3(); iaR = new THREE.Vector3(); iaQ = new THREE.Quaternion(); iaUp = iaUp || new THREE.Vector3(0, 0, -1); }
      var n = naveDe(s.id), dx = tx - s.x, dy = ty - s.y, dz = tz - s.z, dist = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1, i, o;
      iaD.set(dx / dist, dy / dist, dz / dist); iaR.set(0, 0, 0);
      if (Math.abs(s.x - P.x) + Math.abs(s.y - P.y) + Math.abs(s.z - P.z) < 30000) {
        var look = Math.max(500, s.vel * 6), Rn = Math.max(n.m * 3, 12), lst = esp._ast;
        for (i = 0; i < listaRo.length; i++) { o = listaRo[i]; if (o === s.tgt || (o.ro && o.ro.dead) || o.x - s.x > look + 400 || s.x - o.x > look + 400) continue; iaObst(s, o.x, o.y, o.z, o.r, look, Rn); }
        for (i = 0; i < lst.length; i++) iaObst(s, lst[i].x, lst[i].y, lst[i].z, lst[i].r, look, Rn);
      }
      iaD.add(iaR).normalize(); iaF.copy(iaUp).applyQuaternion(s.q);
      var ang = Math.acos(clamp(iaF.dot(iaD), -1, 1));
      if (ang > 0.002) { iaA.crossVectors(iaF, iaD); if (iaA.lengthSq() < 1e-10) iaA.set(0, 1, 0).applyQuaternion(s.q); iaA.normalize(); iaQ.setFromAxisAngle(iaA, Math.min(ang, (0.3 + 0.9 * n.agil) * dt)); s.q.premultiply(iaQ); s.q.normalize(); }
      s.err = ang; iaF.copy(iaUp).applyQuaternion(s.q);
      var v = quieta ? 0 : n.vmax * vf * clamp((dist - stop) / (n.vmax * 3 + 200), 0, 1) * (1 - Math.min(0.8, ang / 1.5));
      s.vel += (v - s.vel) * Math.min(1, dt * 1.3);
      s.x += iaF.x * s.vel * dt; s.y += iaF.y * s.vel * dt; s.z += iaF.z * s.vel * dt;
      return dist - stop;
    }
    function iaPaso(s, dt) {
      var n = naveDe(s.id), d, m, o, mi, pp, nec;
      s.minando = false;
      if (s.modo === 'nav') {
        m = s.meta; if (!m) { s.modo = 'parada'; return; }
        if (m.jugador) d = iaMover(s, P.x, P.y, P.z, 300 + n.m * 12, dt, 1, false); else d = iaMover(s, m.x, m.y, m.z, apDistParada(m), dt, 1, false);
        if (d <= 15) {
          if (!m.jugador && (m.tipo === 'estacion' || m.tipo === 'astillero')) { var tt = bodAInventario(s.id); if (tt) toast('+' + tt + ' MINERAL A TU INVENTARIO · ' + n.nombre.toUpperCase(), 2); }
          s.modo = 'parada'; s.meta = null;
        }
      } else if (s.modo === 'mina') {
        if (bodLlena(s.id)) { iaMover(s, s.x, s.y, s.z, 0, dt, 0, true); if (!hayCarguero()) { s.modo = 'parada'; toast('BODEGA LLENA · ' + n.nombre.toUpperCase(), 2); } return; }
        if (!s.tgt || (s.tgt.ro && s.tgt.ro.dead)) { s.tgt = elegirRoca(s.x, s.y, s.z, 30000, s.id); if (!s.tgt) { s.modo = 'parada'; toast('SIN ROCAS CERCA · ' + n.nombre.toUpperCase(), 2); return; } s.tgt.ro.res = s.id; }
        o = s.tgt; d = iaMover(s, o.x, o.y, o.z, o.r + 110, dt, 0.8, false);
        if (d <= 40 && s.err < 0.2) { s.minando = true; danarRoca(o, dt, s.id); s.dR = d + o.r + 110; if (!s.lz) s.lz = new THREE.Vector3(); s.lz.set(0, -0.3, -Math.min(60, s.dR / n.m)); }
      } else if (s.modo === 'sigue') {
        mi = buscarMinero(); pp = mi && posDe(mi); if (!pp) { s.modo = 'parada'; toast('SIN PROSPECTOR QUE SEGUIR', 2); return; }
        nec = necesitaRecogida(mi);
        d = iaMover(s, pp.x, pp.y, pp.z, nec ? 260 : 700, dt, 1, false);
        if (nec && d <= 60) {
          s.tr += dt; hzN = 1; hzA[0] = s.x; hzA[1] = s.y; hzA[2] = s.z; hzB[0] = pp.x; hzB[1] = pp.y; hzB[2] = pp.z;
          if (s.tr >= 3.5) { s.tr = 0; var mv = transferir(mi, s.id); if (mv) toast('CARGA TRANSFERIDA +' + mv, 1.6); else { toast('CARGUERO LLENO · RUMBO A ESTACIÓN', 2.4); ordenar(s.id, 'estacion'); } }
        } else s.tr = 0;
      } else iaMover(s, s.x, s.y, s.z, 0, dt, 0, true);   // parada: se frena
    }
    function actualizarFlota(dt, t) {
      var id, s, n, dj;
      for (id in flota) {
        s = flota[id]; if (!s.g || s.modo === 'hangar' || s.modo === 'piloto') continue;
        if (!pausado) iaPaso(s, dt);
        s.g.position.set(s.x - P.x, s.y - P.y, s.z - P.z); s.g.quaternion.copy(s.q);
        dj = Math.abs(s.x - P.x) + Math.abs(s.y - P.y) + Math.abs(s.z - P.z); s.g.visible = dj < 150000; n = naveDe(id);
        if (dj < 25000) {
          if (s.mod.laser) { s.mod.laser.target = s.minando ? s.lz : null; s.mod.laser.power = s.minando ? 1 : 0; }
          actualizarModelo(s.mod, t, clamp(s.vel / n.vmax, 0, 1));
        }
      }
      if (!haz) { haz = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 8, 1, true), new THREE.MeshBasicMaterial({ color: 0x9fe8ff, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })); haz.frustumCulled = false; haz.visible = false; sc.add(haz); }
      if (!hzN) { haz.visible = false; return; }
      v1.set(hzB[0] - hzA[0], hzB[1] - hzA[1], hzB[2] - hzA[2]); var L = v1.length() || 1; v1.multiplyScalar(1 / L);
      haz.position.set((hzA[0] + hzB[0]) / 2 - P.x, (hzA[1] + hzB[1]) / 2 - P.y, (hzA[2] + hzB[2]) / 2 - P.z);
      iaUp = iaUp || new THREE.Vector3(0, 0, -1); v2.set(0, 1, 0); haz.quaternion.setFromUnitVectors(v2, v1); var w = 3 + 1.5 * Math.sin(t * 14); haz.scale.set(w, L, w); haz.visible = true;
    }
    function limpiarFlota() {
      var id; for (id in bodegas) bodAInventario(id);
      for (id in flota) quitarIA(flota[id]);
      flota = {}; bodegas = {}; hzN = 0; if (haz) haz.visible = false;
    }
    /* ---- panel FLOTA (pantalla completa, pausa el juego como el mapa) ---- */
    function abrirFlota() { if (mapaAbierto || atracado || pausado) return; panelFlota = true; pausado = true; stick.id = null; stick.ax = stick.ay = 0; palancaVisual(false); camPtr = null; botFu = botGr = false; hud.flota.classList.add('on'); pintarFlota(); }
    function cerrarFlota() { if (!panelFlota) return; panelFlota = false; pausado = false; hud.flota.classList.remove('on'); botonModo(); }
    function textoEstado(id, s) {
      var n = naveDe(id), c = capDe(id), b = c ? ' · bodega ' + bodDe(id).n + '/' + c : '', p = posDe(id), d = p && id !== jug.nave ? ' · ' + fmtDist(Math.sqrt((p.x - P.x) * (p.x - P.x) + (p.y - P.y) * (p.y - P.y) + (p.z - P.z) * (p.z - P.z))) : '';
      if (id === jug.nave) return 'PILOTANDO' + (ap.on ? (ap.minar ? ' · minando solo' : ap.seg ? ' · siguiendo al minero' : ' · piloto automático') : '') + b;
      if (!s || s.modo === 'hangar') return 'En el hangar';
      return ({ parada: 'Detenida', nav: 'Navegando', mina: 'Minando solo', sigue: 'Siguiendo al minero' }[s.modo] || s.modo) + d + b;
    }
    function pintarFlota() {
      var M = hud.flota; M.innerHTML = '';
      var top = el('div', 'jn-fl-top', M); el('span', 'jn-mapa-tit', top, 'MI FLOTA');
      var bx = el('button', 'jn-mapa-x', M, '✕'); bx.onclick = cerrarFlota;
      var lista = el('div', 'jn-fl-lista', M), hay = 0;
      E.NAVES.forEach(function (n) {
        if (!E.naveLibre(n.id) || !obtenerModelo(n.id)) return; hay++;
        var s = flota[n.id], act = n.id === jug.nave, r = el('div', 'jn-fl-fila' + (act ? ' act' : ''), lista);
        var inf = el('div', 'jn-fl-inf', r); el('b', '', inf, n.nombre); el('span', '', inf, textoEstado(n.id, s));
        var bt = el('div', 'jn-fl-bt', r);
        function b(txt, f) { var x = el('button', 'jn-btn', bt, txt); x.onclick = function () { f(); pintarFlota(); }; return x; }
        if (!act) { b('LLAMAR', function () { llamarNave(n.id); }); b('PILOTAR', function () { cambiarA(n.id); if (jug.nave === n.id) cerrarFlota(); }); }
        if (n.minero) b(act && ap.minar ? 'DEJAR DE MINAR' : 'MINAR SOLA', function () { ordenar(n.id, 'mina'); });
        if (n.id === 'mastodonte') b(act && ap.seg ? 'DEJAR DE SEGUIR' : 'SEGUIR AL MINERO', function () { ordenar(n.id, 'sigue'); });
        b('A ESTACIÓN', function () { ordenar(n.id, 'estacion'); });
        if (act ? ap.on : (s && s.modo !== 'hangar' && s.modo !== 'parada')) b('PARAR', function () { ordenar(n.id, 'parar'); });
      });
      if (!hay) el('div', 'jn-ayuda', lista, 'Aún no tienes más naves.');
      el('div', 'jn-ayuda', lista, 'Las naves que no pilotas vuelan solas mientras estás en el juego. Su mineral pasa a tu inventario al llegar a una estación o al salir al hangar.');
    }

    /* ---------- física y cámara ---------- */
    function fisica(dt) {
      var e = entrada(), ag = nSel.agil;
      if (ap.on) {
        if (Math.abs(e.yaw) > 0.25 || Math.abs(e.pit) > 0.25 || e.acel !== 0 || palId !== null || e.freno) apParar('CONTROL MANUAL');
        else { apPaso(dt); e = apE; }
      }
      var tY = e.yaw * (0.5 + 0.75 * ag), tP = e.pit * (0.45 + 0.7 * ag), tR = e.roll * (1.1 + 1.2 * ag), k = 1 - Math.exp(-dt * (3.5 + 5 * ag));
      rYaw += (tY - rYaw) * k; rPitch += (tP - rPitch) * k; rRoll += (tR - rRoll) * k;
      qa.setFromAxisAngle(AY, -rYaw * dt); Q.multiply(qa);      // giro a la derecha = rotación negativa sobre Y local
      qa.setFromAxisAngle(AX, rPitch * dt); Q.multiply(qa);     // cabeceo positivo = nariz arriba
      qa.setFromAxisAngle(AZ, -rRoll * dt); Q.multiply(qa);     // alabeo a la derecha = rotación negativa sobre Z local
      Q.normalize();
      acelerador = clamp(acelerador + e.acel * 0.7 * dt, 0, 1);
      if (e.freno) acelerador = Math.max(0, acelerador - 1.6 * dt);
      var quiere = e.turbo && !turboBloq && turboE > 0.02 && acelerador > 0.05;
      turboOn = quiere;
      if (quiere) { turboE = Math.max(0, turboE - 0.22 * dt); if (turboE <= 0.02) { turboBloq = true; toast('TURBO AGOTADO', 1); } } else { turboE = Math.min(1, turboE + 0.12 * dt); if (turboBloq && turboE > 0.3) turboBloq = false; }
      fwd.set(0, 0, -1).applyQuaternion(Q);
      var vo = nSel.vmax * acelerador * (turboOn ? 2.6 : 1);
      vObj.copy(fwd).multiplyScalar(vo);
      var kv = 1 - Math.exp(-dt * (e.freno ? 3.5 : (1.0 + ag * 1.2)));
      V.lerp(vObj, kv);
      P.x += V.x * dt; P.y += V.y * dt; P.z += V.z * dt;
      vel = V.length();
      colisiones();
      inclinar.rotation.z += (-rYaw * 0.45 - inclinar.rotation.z) * Math.min(1, dt * 5);
      inclinar.rotation.x += (rPitch * 0.12 - inclinar.rotation.x) * Math.min(1, dt * 4);
    }
    function golpeRoca(o, x, y, z) {   // un disparo da en una roca quieta: la nave minera la va desmenuzando; las demás solo hacen chispas
      var ro = o.ro; if (!ro || ro.dead) return;
      esp.chispa(x, y, z, 3); if (!nSel.minero) return;
      if (ro.hp == null) ro.hp = 25 + o.r * 4;
      ro.hp -= 20;
      if (ro.hp <= 0) romperRoca(o, null);
    }
    function romperRoca(o, id) {   // id = bodega que recibe el mineral (minería automática); sin id, el mineral sale flotando
      var ro = o.ro; if (!ro || ro.dead) return; ro.dead = true;
      if (ro.im) { dummy.position.set(0, 0, 0); dummy.scale.set(0, 0, 0); dummy.updateMatrix(); ro.im.setMatrixAt(ro.ii, dummy.matrix); ro.im.instanceMatrix.needsUpdate = true; }
      if (id) { var t = bodAgregar(id, esp.sacarMineral(o.r, o.cp ? o.cp.mat : 0)); esp.chispa(o.x, o.y, o.z, o.r); if (id === jug.nave) toast('+' + t + ' · BODEGA ' + bodDe(id).n + '/' + capDe(id), 1); }
      else { esp.botinRoca(o.x, o.y, o.z, o.r, o.cp ? o.cp.mat : 0); toast('ROCA EXTRAÍDA', 0.8); }
    }
    function danarRoca(o, dt, id) { var ro = o.ro; if (!ro || ro.dead) return; if (ro.hp == null) ro.hp = 25 + o.r * 4; ro.hp -= 40 * dt; if (ro.hp <= 0) romperRoca(o, id); }
    function colisiones() {
      var R = Math.max(med.radio * 0.5, 3), i, o, dx, dy, dz, d, rr;
      // los planetas ya no son sólidos (se podrán reclamar y aterrizar más adelante)
      if (esp) esp.colisionar(R, impacto);
      for (i = 0; i < listaRo.length; i++) { o = listaRo[i]; if (o.ro && o.ro.dead) continue; dx = P.x - o.x; if (dx > 400 || dx < -400) continue; dy = P.y - o.y; dz = P.z - o.z; rr = o.r + R; if (dx * dx + dy * dy + dz * dz < rr * rr) impacto(o, dx, dy, dz, rr); }
    }
    function impacto(o, dx, dy, dz, rr) {
      var d = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1, nx = dx / d, ny = dy / d, nz = dz / d;
      P.x = o.x + nx * (rr + 0.05); P.y = o.y + ny * (rr + 0.05); P.z = o.z + nz * (rr + 0.05);
      var vn = V.x * nx + V.y * ny + V.z * nz;
      if (vn < -6 && ap.on && !ap.huir) apHuir();
      if (vn < 0) { V.x -= nx * vn * 1.35; V.y -= ny * vn * 1.35; V.z -= nz * vn * 1.35; V.multiplyScalar(0.7); shake = Math.min(1, shake + Math.abs(vn) / 120); if (tToast <= 0.2) toast('IMPACTO', 0.8); acelerador *= 0.6; }
    }
    function camara(dt, t) {
      qCam.slerp(Q, 1 - Math.exp(-dt * 5.5));
      var L = med.largo, dist = L * 1.15 + 9, alt = L * 0.26 + 2.6, ef = clamp(vel / (nSel.vmax * 2.6), 0, 1);
      // cámara libre: arrastra con el dedo en la mitad derecha (o teclas J/L/I/K); al soltar vuelve sola detrás de la nave
      var tk = (teclas.KeyJ ? 1 : 0) - (teclas.KeyL ? 1 : 0), tp = (teclas.KeyI ? 1 : 0) - (teclas.KeyK ? 1 : 0);
      if (tk || tp) { camYaw += tk * 2.2 * dt; camPitch = clamp(camPitch + tp * 1.6 * dt, -1.25, 1.25); }
      else if (camPtr === null) { var rk = Math.exp(-dt * 1.6); camYaw *= rk; camPitch *= rk; if (Math.abs(camYaw) < 0.002) camYaw = 0; if (Math.abs(camPitch) < 0.002) camPitch = 0; }
      if (camYaw > PI) camYaw -= TAU; else if (camYaw < -PI) camYaw += TAU;
      qo.setFromAxisAngle(AY, camYaw); qa.setFromAxisAngle(AX, -camPitch); qo.multiply(qa);
      v1.set(0, alt, dist * (1 + ef * 0.12)).applyQuaternion(qo).applyQuaternion(qCam);
      v2.set(0, alt * 0.4, -L * 2.2); var kk = Math.min(1, (Math.abs(camYaw) + Math.abs(camPitch)) * 1.6); v2.multiplyScalar(1 - kk).applyQuaternion(qCam);
      cam.position.copy(v1); cam.up.set(0, 1, 0).applyQuaternion(qCam);
      if (shake > 0.001) { cam.position.x += (Math.random() - 0.5) * shake * L * 0.12; cam.position.y += (Math.random() - 0.5) * shake * L * 0.12; shake *= Math.exp(-dt * 5); }
      cam.lookAt(v2);
      var fov = 70 + ef * 16 + (turboOn ? 6 : 0); if (Math.abs(cam.fov - fov) > 0.05) { cam.fov += (fov - cam.fov) * Math.min(1, dt * 4); cam.updateProjectionMatrix(); }
      cam.updateMatrixWorld(true);
      cielo.position.copy(cam.position); solSp.position.copy(cam.position).addScaledVector(SOL_DIR, 80000);
    }

    /* ---------- HUD por fotograma ---------- */
    function dibujarRadar() {
      var g = radarG, S = radarS, c = S / 2, R = c - 4, rango = 5000, i, o;
      g.clearRect(0, 0, S, S);
      g.strokeStyle = 'rgba(120,200,255,0.25)'; g.lineWidth = 1; g.beginPath(); g.arc(c, c, R, 0, TAU); g.stroke(); g.beginPath(); g.arc(c, c, R * 0.5, 0, TAU); g.stroke();
      g.beginPath(); g.moveTo(c, 4); g.lineTo(c, S - 4); g.moveTo(4, c); g.lineTo(S - 4, c); g.stroke();
      mInv.copy(Q).invert();
      function punto(x, y, z, r, col, minR) {
        v3.set(x - P.x, y - P.y, z - P.z).applyQuaternion(mInv);
        var px = v3.x / rango * R, py = -(-v3.z) / rango * R, d = Math.sqrt(px * px + py * py), rad = clamp(r / rango * R, minR, 9), alpha = 1;
        if (d > R) { px *= R / d; py *= R / d; alpha = 0.45; }
        g.globalAlpha = alpha; g.fillStyle = col; g.beginPath(); g.arc(c + px, c - (-py), rad, 0, TAU); g.fill(); g.globalAlpha = 1;
      }
      esp.zonas().forEach(function (z) {   // anillo de zona segura (1 km)
        v3.set(z.x - P.x, z.y - P.y, z.z - P.z).applyQuaternion(mInv);
        var zr = z.r / rango * R, zx = v3.x / rango * R, zy = v3.z / rango * R;
        if (Math.sqrt(zx * zx + zy * zy) < R + zr) { g.strokeStyle = 'rgba(90,255,190,0.55)'; g.beginPath(); g.arc(c + zx, c + zy, zr, 0, TAU); g.stroke(); }
      });
      for (i = 0; i < listaPl.length; i++) { o = listaPl[i]; punto(o.x, o.y, o.z, o.r, '#ffb766', 3); }
      for (i = 0; i < estLejanas.length; i++) { o = estLejanas[i].o; punto(o.x, o.y, o.z, 0, o.tipo === 'astillero' ? '#ffa43a' : o.tipo === 'cantera' ? '#ff7b2e' : '#4df2d6', 4); }
      esp.radar().forEach(function (q) { punto(q.x, q.y, q.z, 0, q.c, q.r); });
      for (i = 0; i < camposVis.length; i++) { o = camposVis[i]; punto(o.x, o.y, o.z, o.a * 0.4, 'rgba(180,180,180,0.7)', 2); }
      for (var id in remotos) { o = remotos[id]; punto(o.rp.x, o.rp.y, o.rp.z, 0, '#5dff8a', 3); }
      g.fillStyle = '#7fe3ff'; g.beginPath(); g.moveTo(c, c - 7); g.lineTo(c - 5, c + 5); g.lineTo(c + 5, c + 5); g.closePath(); g.fill();
    }
    /* ---------- mira: hacia dónde van los disparos, con distancia y punto de adelanto al blanco ---------- */
    function dibujarMira(g, w, h) {
      var k = DPRH, bloq = esp && esp.segura(), col = bloq ? 'rgba(160,170,185,0.6)' : 'rgba(120,255,200,0.9)';
      v3.copy(fwd).multiplyScalar(3000).project(cam); if (v3.z > 1) return;
      var cx = (v3.x * 0.5 + 0.5) * w, cy = (-v3.y * 0.5 + 0.5) * h, i, a, mejor = null, mAng = 1e9, d, ang, dx, dy, dz;
      /* blanco: el asteroide más centrado en la línea de tiro */
      var lst = esp ? esp._ast : [];
      for (i = 0; i < lst.length; i++) {
        a = lst[i]; dx = a.x - P.x; dy = a.y - P.y; dz = a.z - P.z; d = Math.sqrt(dx * dx + dy * dy + dz * dz); if (d > 3500 || d < 1) continue;
        ang = Math.acos(clamp((dx * fwd.x + dy * fwd.y + dz * fwd.z) / d, -1, 1)) - Math.atan(a.r / d); if (ang < 0.16 && ang < mAng) { mAng = ang; mejor = { a: a, d: d }; }
      }
      g.lineWidth = 1.6 * k; g.strokeStyle = col; g.fillStyle = col;
      g.beginPath(); g.arc(cx, cy, 5 * k, 0, TAU); g.stroke();
      g.beginPath(); g.moveTo(cx - 24 * k, cy); g.lineTo(cx - 11 * k, cy); g.moveTo(cx + 11 * k, cy); g.lineTo(cx + 24 * k, cy); g.moveTo(cx, cy - 24 * k); g.lineTo(cx, cy - 11 * k); g.moveTo(cx, cy + 11 * k); g.lineTo(cx, cy + 24 * k); g.stroke();
      g.lineWidth = 1 * k; g.globalAlpha = 0.75;
      for (i = -2; i <= 2; i++) { if (!i) continue; var o = i * 11 * k; g.beginPath(); g.moveTo(cx + o, cy - 3 * k); g.lineTo(cx + o, cy + 3 * k); g.moveTo(cx - 3 * k, cy + o); g.lineTo(cx + 3 * k, cy + o); g.stroke(); }   // rayitas de escala
      g.beginPath(); g.arc(cx, cy, 40 * k, -0.5, 0.5); g.moveTo(cx + Math.cos(Math.PI - 0.5) * 40 * k, cy + Math.sin(Math.PI - 0.5) * 40 * k); g.arc(cx, cy, 40 * k, Math.PI - 0.5, Math.PI + 0.5); g.stroke(); g.globalAlpha = 1;
      if (!mejor || bloq) return;
      a = mejor.a; v3.set(a.x - P.x, a.y - P.y, a.z - P.z).project(cam); if (v3.z > 1) return;
      var bx = (v3.x * 0.5 + 0.5) * w, by = (-v3.y * 0.5 + 0.5) * h, rr = Math.max(14 * k, Math.min(80 * k, Math.atan(a.r / mejor.d) * h * 0.688)), q = rr * 0.45;
      g.strokeStyle = '#ffd447'; g.fillStyle = '#ffd447'; g.lineWidth = 2 * k;
      [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(function (c) { g.beginPath(); g.moveTo(bx + c[0] * rr, by + c[1] * (rr - q)); g.lineTo(bx + c[0] * rr, by + c[1] * rr); g.lineTo(bx + c[0] * (rr - q), by + c[1] * rr); g.stroke(); });
      /* punto de adelanto: donde tienes que apuntar para que el disparo (1300 m/s + tu velocidad) alcance al asteroide en movimiento */
      var px = a.x - P.x, py = a.y - P.y, pz = a.z - P.z, wx = a.vx - V.x, wy = a.vy - V.y, wz = a.vz - V.z, t = mejor.d / 1300, it;
      for (it = 0; it < 3; it++) t = Math.sqrt((px + wx * t) * (px + wx * t) + (py + wy * t) * (py + wy * t) + (pz + wz * t) * (pz + wz * t)) / 1300;
      v3.set(px + wx * t, py + wy * t, pz + wz * t).project(cam);
      if (v3.z < 1) { var lx = (v3.x * 0.5 + 0.5) * w, ly = (-v3.y * 0.5 + 0.5) * h, s = 6 * k; g.lineWidth = 1.8 * k; g.beginPath(); g.moveTo(lx, ly - s); g.lineTo(lx + s, ly); g.lineTo(lx, ly + s); g.lineTo(lx - s, ly); g.closePath(); g.stroke(); }
      g.font = '600 ' + (12 * k) + 'px system-ui,sans-serif'; g.textAlign = 'center'; g.fillText(esp.nombreTipo(a.tipo) + ' · ' + Math.round(mejor.d) + ' m', bx, by + rr + 15 * k);
    }
    function dibujarBalizas() {
      var g = beaconG.getContext('2d'), w = beaconG.width, h = beaconG.height, i, o, cand = [];
      g.clearRect(0, 0, w, h); g.font = (12 * DPRH) + 'px system-ui,sans-serif'; g.textAlign = 'center';
      for (i = 0; i < listaPl.length; i++) { o = listaPl[i]; var dx = o.x - P.x, dy = o.y - P.y, dz = o.z - P.z, d = Math.sqrt(dx * dx + dy * dy + dz * dz); cand.push({ o: o, d: d, s: d - o.r }); }
      cand.sort(function (a, b) { return a.s - b.s; });
      planCercano = cand.length ? cand[0] : null;
      var lista = cand.slice(0, 2), mejorE = null;
      for (i = 0; i < estLejanas.length; i++) { o = estLejanas[i].o; var ex = o.x - P.x, ey = o.y - P.y, ez = o.z - P.z, de = Math.sqrt(ex * ex + ey * ey + ez * ez); if (!mejorE || de < mejorE.d) mejorE = { o: o, d: de, s: de - o.r, est: true }; }
      if (mejorE) lista.push(mejorE);
      if (meta) {
        if (mejorE && mejorE.o.key === meta.key) mejorE.meta = true;
        else { var mx = meta.x - P.x, my = meta.y - P.y, mz = meta.z - P.z, dm = Math.sqrt(mx * mx + my * my + mz * mz); lista.push({ o: meta, d: dm, s: dm - meta.r, est: true, meta: true }); }
      }
      for (i = 0; i < lista.length; i++) {
        var c = lista[i]; o = c.o; v3.set(o.x - P.x, o.y - P.y, o.z - P.z).normalize().multiplyScalar(1000).project(cam);
        var delante = v3.z < 1, sx = v3.x, sy = v3.y;
        if (!delante) { sx = -sx; sy = -sy; }
        var fuera = !delante || Math.abs(sx) > 0.92 || Math.abs(sy) > 0.86, m = Math.max(Math.abs(sx) / 0.92, Math.abs(sy) / 0.86, 1e-6);
        if (fuera) { sx /= m; sy /= m; }
        var X = (sx * 0.5 + 0.5) * w, Y = (-sy * 0.5 + 0.5) * h, col = c.meta ? 'rgba(255,230,120,0.98)' : c.est ? 'rgba(80,245,214,0.95)' : (i === 0 ? 'rgba(255,200,120,0.95)' : 'rgba(180,215,255,0.8)');
        g.strokeStyle = col; g.fillStyle = col; g.lineWidth = 1.5 * DPRH;
        if (fuera) { var ang = Math.atan2(-sy, sx); g.save(); g.translate(X, Y); g.rotate(ang); g.beginPath(); g.moveTo(9 * DPRH, 0); g.lineTo(-6 * DPRH, -6 * DPRH); g.lineTo(-6 * DPRH, 6 * DPRH); g.closePath(); g.fill(); g.restore(); }
        else { var q = 8 * DPRH; g.beginPath(); g.moveTo(X, Y - q); g.lineTo(X + q, Y); g.lineTo(X, Y + q); g.lineTo(X - q, Y); g.closePath(); g.stroke(); }
        var ty = Y + (fuera ? (Y < h / 2 ? 22 : -12) : 24) * DPRH; g.fillText((c.meta ? '★ ' : '') + o.nombre + ' · ' + fmtDist(Math.max(0, c.s)), clamp(X, 80 * DPRH, w - 80 * DPRH), clamp(ty, 16 * DPRH, h - 8 * DPRH));
      }
      dibujarMira(g, w, h);
    }
    function actualizarTextos(dt) {
      hud.vel.innerHTML = Math.round(vel) + ' <small>m/s' + (turboOn ? ' · TURBO' : '') + '</small>';
      hud.mv.firstChild.style.width = Math.round(clamp(vel / (nSel.vmax * 2.6), 0, 1) * 100) + '%'; hud.mt.firstChild.style.width = Math.round(turboE * 100) + '%';
      hud.palI.style.height = Math.round(acelerador * 100) + '%';
      var C = 1000; hud.hd.innerHTML = 'X ' + (P.x / C).toFixed(1) + ' · Y ' + (P.y / C).toFixed(1) + ' · Z ' + (P.z / C).toFixed(1) + ' km<br>' + Math.round(fps) + ' FPS' + (Red.activo ? ' · en línea (' + Object.keys(remotos).length + ')' : '');
      hud.inv.innerHTML = '<b style="color:#ffe27a">◎ ' + esp.creditos() + '</b><br>' + esp.textoInv() + (capDe(jug.nave) ? '<br><span style="color:#9fe8ff">Bodega ' + bodDe(jug.nave).n + '/' + capDe(jug.nave) + '</span>' : '');
      hud.estado.textContent = ap.on && ap.minar ? (ap.espera ? 'BODEGA LLENA · ESPERANDO AL CARGUERO' : 'MINERÍA AUTOMÁTICA') : ap.on && ap.seg ? 'SIGUIENDO AL PROSPECTOR' : ap.on && ap.meta ? (ap.huir ? 'HUYENDO → ' : 'PILOTO AUTOMÁTICO → ') + ap.meta.nombre + ' · ' + fmtDist(Math.sqrt((ap.meta.x - P.x) * (ap.meta.x - P.x) + (ap.meta.y - P.y) * (ap.meta.y - P.y) + (ap.meta.z - P.z) * (ap.meta.z - P.z))) : esp.segura() ? 'ZONA SEGURA · armas bloqueadas' : planCercano ? 'Planeta cercano: ' + planCercano.o.nombre + ' (' + fmtDist(Math.max(0, planCercano.s)) + ')' : '';
    }

    /* ---------- jugadores remotos ---------- */
    function crearRemoto(j) {
      var nm = crearModeloNuevo(j.s, j.c != null ? j.c : ACENTOS[0]); if (!nm) return null;
      var w = new THREE.Group(); w.scale.setScalar(nm.n.m); w.add(nm.m.group); var wrap = new THREE.Group(); wrap.add(w); sc.add(wrap);
      return { id: j.id, nombre: j.n, wrap: wrap, m: nm.m, p: { x: j.p[0], y: j.p[1], z: j.p[2] }, rp: { x: j.p[0], y: j.p[1], z: j.p[2] }, q: new THREE.Quaternion(j.q[0], j.q[1], j.q[2], j.q[3]), v: { x: j.v[0], y: j.v[1], z: j.v[2] }, t: tMundo };
    }
    function recibirEstado(lista) {
      lista.forEach(function (j) {
        if (j.id === Red.id) return; var r = remotos[j.id];
        if (!r) { r = crearRemoto(j); if (!r) return; remotos[j.id] = r; }
        r.p = { x: j.p[0], y: j.p[1], z: j.p[2] }; r.v = { x: j.v[0], y: j.v[1], z: j.v[2] }; r.q.set(j.q[0], j.q[1], j.q[2], j.q[3]); r.t = tMundo;
      });
    }
    function quitarRemoto(id) { var r = remotos[id]; if (r) { sc.remove(r.wrap); delete remotos[id]; } }
    function limpiarRemotos() { for (var id in remotos) quitarRemoto(id); }
    function actualizarRemotos(dt, t) {
      for (var id in remotos) {
        var r = remotos[id], e = Math.min(0.6, tMundo - r.t), tx = r.p.x + r.v.x * e, ty = r.p.y + r.v.y * e, tz = r.p.z + r.v.z * e, k = Math.min(1, dt * 8);
        r.rp.x += (tx - r.rp.x) * k; r.rp.y += (ty - r.rp.y) * k; r.rp.z += (tz - r.rp.z) * k;
        r.wrap.position.set(r.rp.x - P.x, r.rp.y - P.y, r.rp.z - P.z); r.wrap.quaternion.slerp(r.q, k);
        actualizarModelo(r.m, t, 0.6);
      }
    }

    /* ---------- escena: ciclo de vida ---------- */
    function redimensionar4(w, h) {
      if (!cam) return; cam.aspect = w / h; cam.updateProjectionMatrix();
      if (hud.bFu) E.aplicarLayout(DOMcapas.hud);
      DPRH = Math.min(global.devicePixelRatio || 1, 1.5); if (beaconG) { beaconG.width = Math.round(w * DPRH); beaconG.height = Math.round(h * DPRH); }
    }
    return {
      construir: construir, redimensionar: redimensionar4, _estacionesEn: estacionesEn, _cuerposEn: cuerposEn, _test: function () { return { flota: function () { return flota; }, llamarNave: llamarNave, ordenar: ordenar, cambiarA: cambiarA, bodDe: bodDe, bodAgregar: bodAgregar, ordenPiloto: ordenPiloto, desplegar: desplegar, desatracar: desatracar, st: function () { return { atracado: atracado, pausado: pausado, acel: acelerador, vel: vel, V: [V.x, V.y, V.z] }; }, listaRo: function () { return listaRo; }, golpeRoca: golpeRoca, ap: ap, apAlternar: apAlternar, setMeta: function (m) { meta = m; }, nSel: function () { return nSel; }, P: P, V: V, Q: Q, estLejanas: function () { return estLejanas; } }; }, _astillerosEn: astillerosEn, _canterasEn: canterasEn, _spawn: function () { return { x: P.x, y: P.y, z: P.z }; },
      entrar: function (d) {
        modo = (d && d.modo) || 'solo'; nSel = naveDe(jug.nave); modelo = obtenerModelo(jug.nave); med = medidas[jug.nave];
        if (!modelo) { irA('lobby'); return; }
        mostrarCapas(['hud']); pausar(false); apParar(); if (E.refrescarTexturas) E.refrescarTexturas();
        pivote = new THREE.Group(); inclinar = new THREE.Group(); escalarN = new THREE.Group(); escalarN.scale.setScalar(nSel.m); escalarN.add(modelo.group); inclinar.add(escalarN); pivote.add(inclinar); sc.add(pivote);
        try { if (modelo.setAccent) modelo.setAccent(jug.acento); } catch (e) { }
        hud.nom.textContent = nSel.nombre.toUpperCase() + ' · ' + esc(jug.nombre); limpiarFlota(); regFlota(jug.nave).modo = 'piloto'; panelFlota = false; hud.flota.classList.remove('on'); botonModo(); sincCarga(jug.nave);
        radarG = hud.radar.getContext('2d'); var dpr = Math.min(global.devicePixelRatio || 1, 2); hud.radar.width = radarS * dpr; hud.radar.height = radarS * dpr; radarG.setTransform(dpr, 0, 0, dpr, 0, 0);
        crearPolvo(); redimensionar4(E.ancho, E.alto);
        posicionInicial(); actualizarCeldas(true); esp.entrar(med.radio);
        V.set(0, 0, 0); qCam.copy(Q); rYaw = rPitch = rRoll = 0; acelerador = 0.3; turboE = 1; turboBloq = false; shake = 0; tMundo = 0; tHud = 0; tRed = 0; teclas = {}; botT = botF = atracado = false; mapaAbierto = false; hud.merc.classList.remove('on'); hud.mapa.classList.remove('on'); botFu = botGr = false; camYaw = camPitch = 0; camPtr = null; stick.id = null; stick.ax = stick.ay = 0; palancaVisual(false);
        if (modo === 'red') {
          toast('CONECTANDO…', 3);
          Red.onEstado = recibirEstado; Red.onSalio = quitarRemoto;
          Red.conectar(CONFIG.servidor, { nombre: jug.nombre, nave: jug.nave, color: jug.acento }, function (e) { toast('SIN SERVIDOR · SOLO', 2.5); modo = 'solo'; });
        } else toast('BIENVENIDO, ' + jug.nombre.toUpperCase(), 2.2);
      },
      salir: function () {
        limpiarFlota(); if (esp) esp.limpiar();
        if (pivote) { sc.remove(pivote); pivote = null; } Red.cerrar(); limpiarRemotos(); palancaVisual(false); atracado = false; mapaAbierto = false; pausar(false);
        var k; for (k in celdas) { var c = celdas[k]; if (c.planeta) quitarPlaneta(c.planeta); if (c.campo) quitarCampo(c.campo); } celdas = {}; ucx = 1e9;
        if (polvo) { sc.remove(polvo); polvo.geometry.dispose(); polvo.material.dispose(); polvo = null; }
      },
      tecla: function (e, abajo) {
        teclas[e.code] = abajo;
        if (abajo && mapaAbierto && (e.code === 'Escape' || e.code === 'KeyM')) { cerrarMapa(); return; }
        if (abajo && e.code === 'KeyM') { abrirMapa(); return; }
        if (abajo && atracado && (e.code === 'Escape' || e.code === 'KeyH')) { desatracar(); return; }
        if (abajo && e.code === 'KeyH' && !pausado) atracar();
        if (abajo && (e.code === 'Escape' || e.code === 'KeyP')) pausar(!pausado);
        if (e.code === 'Space' || e.code.indexOf('Arrow') === 0) e.preventDefault();
      },
      puntero: function (tipo, e) {
        if (pausado) return;
        if (tipo === 'abajo' && camPtr === null && e.clientX > E.ancho * 0.55) { camPtr = e.pointerId; camX0 = e.clientX; camY0 = e.clientY; camYaw0 = camYaw; camPitch0 = camPitch; return; }
        if (tipo === 'mueve' && camPtr === e.pointerId) { camYaw = camYaw0 - (e.clientX - camX0) * 0.009 * jug.sensCam; camPitch = clamp(camPitch0 + (e.clientY - camY0) * 0.006 * jug.sensCam, -1.25, 1.25); return; }
        if (tipo === 'arriba' && camPtr === e.pointerId) { camPtr = null; return; }
        if (tipo === 'abajo' && stick.id === null) { stick.id = e.pointerId; stick.x0 = e.clientX; stick.y0 = e.clientY; stick.ax = stick.ay = 0; palancaVisual(true); }
        else if (tipo === 'mueve' && stick.id === e.pointerId) {
          var R = 60, dx = e.clientX - stick.x0, dy = e.clientY - stick.y0, d = Math.sqrt(dx * dx + dy * dy);
          if (d > R) { dx *= R / d; dy *= R / d; }
          var ax = clamp(dx / R * jug.sensGiro, -1, 1), ay = clamp(dy / R * jug.sensGiro, -1, 1); stick.ax = Math.abs(ax) < 0.08 ? 0 : ax; stick.ay = Math.abs(ay) < 0.08 ? 0 : ay; palancaVisual(true);
          hud.palI2.style.transform = 'translate(' + (dx * 0.7) + 'px,' + (dy * 0.7) + 'px)';
        }
        else if (tipo === 'arriba' && stick.id === e.pointerId) { stick.id = null; stick.ax = stick.ay = 0; palancaVisual(false); }
      },
      actualizar: function (dt, t) {
        if (!sc || !pivote) return;
        fps += (1 / Math.max(dt, 0.001) - fps) * 0.05; hzN = 0;
        if (!pausado) {
          tMundo += dt; fisica(dt);
          actualizarCeldas(false);
          if (modo === 'red' && Red.activo) { tRed += dt; if (tRed > 0.1) { tRed = 0; Red.enviar({ t: 'e', p: [P.x, P.y, P.z], q: [Q.x, Q.y, Q.z, Q.w], v: [V.x, V.y, V.z] }); } }
        }
        // origen flotante: la nave siempre en (0,0,0); el resto se coloca relativo a ella
        pivote.quaternion.copy(Q); pivote.position.set(0, 0, 0);
        var i, o;
        for (i = 0; i < listaPl.length; i++) {
          o = listaPl[i]; if (!o.g) continue; o.k = Math.min(1, o.k + dt * 0.7); var ek = o.k * o.k * (3 - 2 * o.k);
          o.g.position.set(o.x - P.x, o.y - P.y, o.z - P.z); o.g.scale.setScalar(o.r * (0.6 + 0.4 * ek)); o.g.userData.cuerpo.rotation.y += o.giro * dt;
        }
        for (i = 0; i < camposVis.length; i++) { o = camposVis[i]; if (o.g) o.g.position.set(o.x - P.x, o.y - P.y, o.z - P.z); }
        esp.fuego(!pausado && !!(teclas.KeyF || botFu)); esp.agarrar(!pausado && !!(teclas.KeyG || botGr));
        if (!atracado) { estCerca = pausado ? null : esp.estacionCerca(); var ev = estCerca ? estCerca.nombre : ''; if (ev !== estVista) { estVista = ev; hud.bAtr.style.display = ev ? 'flex' : 'none'; hud.bAtr.textContent = ev ? 'ATRACAR · ' + ev : ''; } } esp.actualizar(pausado ? 0 : dt, t, fwd);
        if (modelo.laser && nSel.minero) { if (!laserT) laserT = new THREE.Vector3(0, -0.3, -45); var fl = (!pausado && !!(botFu || teclas.KeyF) && !esp.segura()) || apLaser; if (!apLaser) laserT.set(0, -0.3, -45); modelo.laser.target = fl ? laserT : null; modelo.laser.power = fl ? 1 : 0; }
        actualizarModelo(modelo, t, clamp(vel / nSel.vmax, 0, 1));
        moverPolvo(pausado ? 0 : dt, clamp(vel / (nSel.vmax * 2.0), 0, 1)); polvo.position.set(0, 0, 0);
        actualizarFlota(dt, t);
        camara(pausado ? 0.0001 : dt, t); actualizarRemotos(dt, t);
        E.renderer.render(sc, cam);
        tHud += dt; if (tHud > 0.1) { tHud = 0; actualizarTextos(dt); }
        dibujarRadar(); dibujarBalizas();
        if (tToast > 0) { tToast -= dt; if (tToast <= 0) hud.toast.style.opacity = 0; }
      }
    };
  })();


})(window);
