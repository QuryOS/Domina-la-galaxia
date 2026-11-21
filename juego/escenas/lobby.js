/* Escena: lobby (hangar) — estilo "sala de espera" de juego móvil: personaje al centro y pestañas arriba (ver README.md) */
(function (global) {
  'use strict';
  var E = global.JN = global.JN || {};
  var CONFIG = E.CONFIG;
  var NAVES = E.NAVES;
  var ACENTOS = E.ACENTOS;
  var PI = E.PI;
  var clamp = E.clamp;
  var leer = E.leer;
  var guardar = E.guardar;
  var el = E.el;
  var esc = E.esc;
  var DOMcapas = E.DOMcapas;
  var jug = E.jug;
  var escenas = E.escenas;
  var disponibles = E.disponibles;
  var cache = E.cache;
  var redimensionar = E.redimensionar;
  var mostrarCapas = E.mostrarCapas;
  var medidas = E.medidas;
  var obtenerModelo = E.obtenerModelo;
  var actualizarModelo = E.actualizarModelo;
  var primeraDisponible = E.primeraDisponible;
  function irA(a, b) { return E.irA(a, b); }

  /* ---- catálogos de equipo (de momento solo lo básico está disponible; el resto es "próximamente") ---- */
  var ARMAS = [
    { n: 'Cañón de pulsos', d: 'Arma de serie. Disparo rápido y barato: 12 de daño cada 0,15 s.', libre: true },
    { n: 'Láser de fusión', d: 'Rayo continuo, ideal contra asteroides grandes.' },
    { n: 'Lanzamisiles', d: 'Misiles guiados para combate entre jugadores.' },
    { n: 'Cañón de plasma', d: 'Disparo lento y devastador.' }
  ];
  var CATS = { militar: ['MILITAR', 'Blindados y con mucho empuje.'], carreras: ['CARRERAS', 'Ligeros, máxima velocidad.'], carga: ['CARGA', 'Fuertes y resistentes, para naves pesadas.'], exploracion: ['EXPLORACIÓN', 'Eficientes, de largo alcance.'] }, TAMS = { pequeno: 'Pequeño', mediano: 'Mediano', grande: 'Grande' };
  var MOTORES = [   // los 12 motores del juego: 4 categorías × 3 tamaños. El de arranque es el Colmillo (el más pequeño).
    ['Colmillo', 'militar', 'pequeno', 'createMotorColmillo'], ['Tenaza', 'militar', 'mediano', 'createMotorTenaza'], ['Coloso', 'militar', 'grande', 'createMotorColoso'],
    ['Centella', 'carreras', 'pequeno', 'createMotorCentella'], ['Relámpago', 'carreras', 'mediano', 'createMotorRelampago'], ['Cometa', 'carreras', 'grande', 'createMotorCometa'],
    ['Mula', 'carga', 'pequeno', 'createMotorMula'], ['Buey', 'carga', 'mediano', 'createMotorBuey'], ['Mamut', 'carga', 'grande', 'createMotorMamut'],
    ['Sonda', 'exploracion', 'pequeno', 'createMotorSonda'], ['Peregrino', 'exploracion', 'mediano', 'createMotorPeregrino'], ['Horizonte', 'exploracion', 'grande', 'createMotorHorizonte']
  ].map(function (q) { return { n: q[0], cat: q[1], tam: q[2], fn: q[3], libre: q[0] === 'Colmillo' }; });
  var ICONOS = {
    inicio: '<path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
    naves: '<path d="M12 2l4 9 5 4-1 2-4-1-1 5h-6l-1-5-4 1-1-2 5-4z"/>',
    arsenal: '<circle cx="12" cy="12" r="7"/><path d="M12 2v5M12 17v5M2 12h5M17 12h5"/>',
    motores: '<path d="M12 3c3 3 4 6 3 9l2 3-3 1v5l-2-2-2 2v-5l-3-1 2-3c-1-3 0-6 3-9z"/>',
    tienda: '<path d="M5 8h14l-1 12H6zM9 8V6a3 3 0 0 1 6 0v2"/>',
    amigos: '<circle cx="9" cy="8" r="3"/><path d="M3 20c0-3.5 2.7-6 6-6s6 2.5 6 6"/><circle cx="17" cy="9" r="2.3"/><path d="M17 14c2.6 0 4.5 2 4.5 5"/>',
    ajustes: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2"/>'
  };
  var TABS = [['inicio', 'INICIO'], ['naves', 'NAVES'], ['arsenal', 'ARSENAL'], ['motores', 'MOTORES'], ['tienda', 'TIENDA'], ['amigos', 'AMIGOS'], ['ajustes', 'AJUSTES']];
  function svg(k) { return '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round">' + ICONOS[k] + '</svg>'; }

  jug.motor = leer('motor', 'Colmillo');
  function motorLibre(q) { return !!jug.pruebas || q.libre; }
  function naveLibre(id) { return !!jug.pruebas || E.NAVES_INICIALES.indexOf(id) >= 0 || (leer('desbloq', []) || []).indexOf(id) >= 0; }
  E.naveLibre = naveLibre;

  /* ===================== ESCENA: LOBBY ===================== */
  escenas.lobby = (function () {
    var sc, cam, girar, escalar = null, plataforma, matAc, luzAc, cielo, idx = 0, vel = 0.25, arr = null, uiHecha = false, ui = {}, modeloAct = null, ambiente = [];
    var tab = 'inicio', soldado = null, escSoldado = null, mIdx = 0, motorMods = {};

    function construir() {
      sc = new THREE.Scene(); cam = new THREE.PerspectiveCamera(40, 1, 0.1, 3000);
      var hemi = new THREE.HemisphereLight(0xbfd4ff, 0x1a1020, 0.8), key = new THREE.DirectionalLight(0xfff1e0, 2.4), rim = new THREE.DirectionalLight(0x5fb8ff, 1.5), fill = new THREE.DirectionalLight(0xffffff, 0.6);
      key.position.set(6, 10, 8); rim.position.set(-8, 3, -6); fill.position.set(0, -2, 6); sc.add(hemi, key, rim, fill);
      cielo = new THREE.Mesh(new THREE.SphereGeometry(1500, 32, 16), new THREE.MeshBasicMaterial({ map: E.skyTex, side: THREE.BackSide, depthWrite: false, toneMapped: false })); sc.add(cielo);
      matAc = new THREE.MeshBasicMaterial({ color: jug.acento });
      plataforma = new THREE.Group();
      var disco = new THREE.Mesh(new THREE.CylinderGeometry(9.6, 10.6, 0.5, 64), new THREE.MeshStandardMaterial({ color: 0x151c2a, metalness: 0.7, roughness: 0.4 })); plataforma.add(disco);
      var a1 = new THREE.Mesh(new THREE.TorusGeometry(8.7, 0.08, 8, 96), matAc); a1.rotation.x = PI / 2; a1.position.y = 0.27; plataforma.add(a1);
      var a2 = new THREE.Mesh(new THREE.TorusGeometry(6.2, 0.05, 8, 80), matAc); a2.rotation.x = PI / 2; a2.position.y = 0.27; plataforma.add(a2);
      var brillo = new THREE.Mesh(new THREE.CircleGeometry(8.5, 64), new THREE.MeshBasicMaterial({ color: jug.acento, transparent: true, opacity: 0.1, blending: THREE.AdditiveBlending, depthWrite: false })); brillo.rotation.x = -PI / 2; brillo.position.y = 0.28; plataforma.add(brillo);
      ambiente.push(brillo.material);
      luzAc = new THREE.PointLight(jug.acento, 1.4, 44); luzAc.position.set(0, 1.5, 0); plataforma.add(luzAc);
      sc.add(plataforma);
      girar = new THREE.Group(); sc.add(girar);
    }
    function aplicarAcento() {
      if (matAc) matAc.color.setHex(jug.acento); if (luzAc) luzAc.color.setHex(jug.acento); ambiente.forEach(function (m) { m.color.setHex(jug.acento); });
      if (soldado && soldado.setAccent) { try { soldado.setAccent(jug.acento); } catch (e) { } }
      if (modeloAct && modeloAct.setAccent) { try { modeloAct.setAccent(jug.acento); } catch (e2) { } }
      for (var i in cache) { try { if (cache[i].setAccent) cache[i].setAccent(jug.acento); } catch (e3) { } }
    }
    var escPrem = null;
    function quitarEscena() { if (escalar) { girar.remove(escalar); escalar = null; } if (escSoldado) { girar.remove(escSoldado); } if (escPrem) { girar.remove(escPrem); } }

    /* ---- qué se ve en el centro: el soldado (inicio, tienda, ajustes) o la nave (naves, arsenal, motores) ---- */
    function mostrarSoldado() {
      quitarEscena(); modeloAct = null;
      if (E.Tienda && E.Tienda.tieneSkin('premium') && leer('soldadoSkin', 'estandar') === 'premium') {   // aspecto premium (estático)
        if (!escPrem && typeof global.createSoldadoPremium === 'function') {
          try { var pr = global.createSoldadoPremium(THREE), H = 7.6; escPrem = new THREE.Group(); escPrem.scale.setScalar(H / pr.alto); pr.group.position.y = -pr.alto / 2; escPrem.add(pr.group); escPrem.userData.alto = H; } catch (ep) { escPrem = null; }
        }
        if (escPrem) { girar.add(escPrem); plataforma.position.y = -escPrem.userData.alto / 2 - 0.25; return true; }
        else if (E.Tienda && typeof global.createSoldadoPremium !== 'function') E.Tienda.cargarPremium(function (ok) { if (ok && tab !== 'naves') { escenario(); } });
      }
      if (!soldado && typeof global.createSoldadoEspacialV2 === 'function') {
        try { soldado = global.createSoldadoEspacialV2(THREE, { armor: jug.acento, glow: 0x62d6ff }); } catch (e) { soldado = null; if (global.console) console.error('Soldado', e); }
        if (soldado) {
          var w = new THREE.Group(); w.add(soldado.group); w.updateMatrixWorld(true);
          var b = new THREE.Box3().setFromObject(w), s = b.getSize(new THREE.Vector3()), c = b.getCenter(new THREE.Vector3()), k = 8.6 / (s.y || 1);
          escSoldado = new THREE.Group(); escSoldado.scale.setScalar(k); w.position.copy(c).multiplyScalar(-1); escSoldado.add(w); escSoldado.userData.alto = s.y * k;
          try { soldado.setAccent(jug.acento); } catch (e2) { }
        }
      }
      if (soldado && escSoldado) { girar.add(escSoldado); plataforma.position.y = -escSoldado.userData.alto / 2 - 0.25; return true; }
      return false;
    }
    function mostrarNave(i) {
      var n = NAVES[i], m = obtenerModelo(n.id); if (!m) return false;
      quitarEscena();
      var md = medidas[n.id], s = 5 / md.radio; escalar = new THREE.Group();
      escalar.scale.setScalar(n.m * s); escalar.position.copy(md.centro).multiplyScalar(-s); escalar.add(m.group); girar.add(escalar);
      plataforma.position.y = -(md.alto * s) / 2 - 1.0; modeloAct = m; idx = i;
      try { if (m.setAccent) m.setAccent(jug.acento); } catch (e) { }
      return true;
    }
    function mostrarMotor(k) {
      var q = MOTORES[k], m = motorMods[q.n]; if (typeof global[q.fn] !== 'function') return false;
      if (!m) { try { m = global[q.fn](THREE, {}); } catch (e) { if (global.console) console.error('Motor ' + q.n, e); return false; } motorMods[q.n] = m; }
      quitarEscena(); modeloAct = null;
      var w = new THREE.Group(); w.add(m.group); w.updateMatrixWorld(true);
      var b = new THREE.Box3().setFromObject(w), sz = b.getSize(new THREE.Vector3()), c = b.getCenter(new THREE.Vector3()), r = Math.max(sz.x, sz.y, sz.z) / 2 || 1, s = 5 / r;
      escalar = new THREE.Group(); escalar.scale.setScalar(s); w.position.copy(c).multiplyScalar(-1); escalar.add(w); girar.add(escalar);
      plataforma.position.y = -(sz.y * s) / 2 - 1.0; mIdx = k; return true;
    }
    function escenario() {
      if (tab === 'motores') { if (!mostrarMotor(mIdx)) mostrarSoldado(); } else if (tab === 'naves' || tab === 'arsenal') { if (!mostrarNave(idx)) mostrarSoldado(); } else mostrarSoldado();
      encuadrar();
    }
    function indiceNaveElegida() { var k; for (k = 0; k < NAVES.length; k++) if (NAVES[k].id === jug.nave && disponibles[NAVES[k].id]) return k; k = primeraDisponible(); return k < 0 ? 0 : k; }
    function elegirNave(i) { var n = NAVES[i]; if (!naveLibre(n.id)) return; jug.nave = n.id; guardar('nave', n.id); }

    /* ---- panel derecho ---- */
    function tarjeta(padre, titulo, sub, estado, clase, onclick) {
      var d = el('div', 'jn-lb-card' + (clase ? ' ' + clase : ''), padre, '<div class="t"><b>' + esc(titulo) + '</b><small>' + esc(sub) + '</small></div><span class="e">' + estado + '</span>');
      if (onclick) d.onclick = onclick; return d;
    }
    function colores(padre) {
      var fc = el('div', 'jn-fila', padre); el('span', 'jn-lb-rot', fc, 'COLOR');
      ACENTOS.forEach(function (c) {
        var d = el('div', 'jn-col' + (c === jug.acento ? ' on' : ''), fc); d.setAttribute('data-c', c); d.style.background = '#' + ('000000' + c.toString(16)).slice(-6);
        d.onclick = function () { jug.acento = c; guardar('acento', c); aplicarAcento(); var t = DOMcapas.lobby.querySelectorAll('.jn-col'), q; for (q = 0; q < t.length; q++) t[q].className = 'jn-col' + (Number(t[q].getAttribute('data-c')) === c ? ' on' : ''); };
      });
    }
    function pintarPanel() {
      var P = ui.panel, vh = P.querySelector('.hor'), sl = vh ? vh.scrollLeft : 0; P.innerHTML = '';
      P.classList.toggle('on', tab !== 'inicio'); P.classList.toggle('full', tab === 'tienda'); ui.inicio.style.display = tab === 'inicio' ? 'flex' : 'none';
      if (tab === 'inicio') return;
      var tt = TABS.filter(function (t) { return t[0] === tab; })[0][1]; el('div', 'jn-lb-tit', P, tt);
      var cont = el('div', 'jn-lb-cont', P), i;
      if (tab === 'naves') {
                var lista = el('div', 'jn-lb-lista hor', cont);
        NAVES.forEach(function (q, k) {
          if (!disponibles[q.id]) return;
          var lb = naveLibre(q.id); tarjeta(lista, q.nombre, q.clase, jug.nave === q.id ? '✔' : lb ? '' : '🔒', (k === idx ? 'sel ' : '') + (lb ? '' : 'bloq'), function () { mostrarNave(k); encuadrar(); pintarPanel(); });
        });
        var n = NAVES[idx], md = medidas[n.id], libre = naveLibre(n.id), elegida = jug.nave === n.id;
        el('div', 'jn-nom', cont, esc(n.nombre.toUpperCase())); el('div', 'jn-clase', cont, esc(n.clase)); el('div', 'jn-desc', cont, esc(n.desc));
        var st = el('div', 'jn-stats', cont, '<b>Velocidad</b><span><i></i></span><b>Agilidad</b><span><i></i></span><b>Blindaje</b><span><i></i></span><b>Datos</b><em style="font-style:normal">' + (md ? Math.round(md.largo) + ' m · ' : '') + n.vmax + ' m/s</em>'), bar = st.querySelectorAll('i');
        bar[0].style.width = Math.round(n.vmax / 300 * 100) + '%'; bar[1].style.width = Math.round(clamp(n.agil / 1.25, 0.08, 1) * 100) + '%'; bar[2].style.width = Math.round(n.blind * 100) + '%';
        var b = el('button', 'jn-btn jn-lb-sel', cont, elegida ? 'EQUIPADA' : libre ? 'USAR ESTA NAVE' : '🔒 BLOQUEADA'); b.disabled = elegida || !libre; b.onclick = function () { elegirNave(idx); pintarPanel(); };
        colores(cont);
      } else if (tab === 'arsenal') {
        el('div', 'jn-lb-nota', cont, 'Armas de tu nave. Solo la de serie está disponible por ahora.');
        ARMAS.forEach(function (q) { tarjeta(cont, q.n, q.d, q.libre ? 'EQUIPADA' : '🔒', q.libre ? 'sel' : 'bloq'); });
      } else if (tab === 'motores') {
        var lm = el('div', 'jn-lb-lista hor', cont);
        MOTORES.forEach(function (q, k) { var lb = motorLibre(q); tarjeta(lm, q.n, CATS[q.cat][0] + ' · ' + TAMS[q.tam], jug.motor === q.n ? '✔' : lb ? '' : '🔒', (k === mIdx ? 'sel ' : '') + (lb ? '' : 'bloq'), function () { mIdx = k; mostrarMotor(k); encuadrar(); pintarPanel(); }); });
        var mq = MOTORES[mIdx], mm = motorMods[mq.n], mlib = motorLibre(mq), meq = jug.motor === mq.n;
        el('div', 'jn-nom', cont, esc(mq.n.toUpperCase())); el('div', 'jn-clase', cont, 'Motor ' + CATS[mq.cat][0].toLowerCase() + ' · ' + TAMS[mq.tam].toLowerCase()); el('div', 'jn-desc', cont, esc(CATS[mq.cat][1]));
        if (mm) el('div', 'jn-lb-nota', cont, 'Largo ' + Math.round(mm.length * 4) + ' m · ancho ' + Math.round(mm.width * 4) + ' m');
        var bm = el('button', 'jn-btn jn-lb-sel', cont, meq ? 'EQUIPADO' : mlib ? 'USAR ESTE MOTOR' : '🔒 BLOQUEADO'); bm.disabled = meq || !mlib; bm.onclick = function () { jug.motor = mq.n; guardar('motor', mq.n); pintarPanel(); };
        el('div', 'jn-lb-nota', cont, '12 motores en total: 4 categorías × 3 tamaños. De momento no cambian el manejo.');
      } else if (tab === 'tienda') {
        el('div', 'jn-lb-cred', cont, '◎ ' + (leer('cred', 0) || 0) + ' <small>Toristina</small>');
        el('div', 'jn-lb-nota', cont, 'Los paquetes se compran por WhatsApp: te enviamos un código y lo canjeas al final de esta pantalla. Los motores y las naves no se venden aquí.');
        var T = E.Tienda, gr = el('div', 'jn-tgrid', cont);
        T.PAQUETES.forEach(function (pq) {
          if (pq.oculto) return;
          if (pq.skin) {   // aspecto del soldado: tarjeta grande con imagen y botón equipar
            var cs = el('div', 'jn-tpaq jn-tskin', gr), tn = T.tieneSkin(pq.skin), im = el('div', 'jn-tskin-im', cs, '<span class="jn-cuad-cargando">…</span>');
            el('b', 'jn-tnom', cs, esc(pq.n)); el('small', 'jn-tdesc', cs, esc(pq.d));
            T.miniPremium(function (u) { if (u && im.parentNode) im.innerHTML = '<img class="jn-tskin-img" src="' + u + '">'; else if (im.parentNode) im.textContent = '▣'; });
            if (tn) { var eq = leer('soldadoSkin', 'estandar') === pq.skin, be = el('button', 'jn-btn', cs, eq ? 'QUITAR (USAR ESTÁNDAR)' : 'EQUIPAR'); be.onclick = function () { guardar('soldadoSkin', eq ? 'estandar' : pq.skin); pintarPanel(); escenario(); }; }
            else { var bw2 = el('a', 'jn-btn tw', cs, 'COMPRAR POR WHATSAPP'); bw2.href = T.whatsapp(pq); bw2.target = '_blank'; bw2.rel = 'noopener'; }
            return;
          }
          var cd = el('div', 'jn-tpaq', gr), ct = el('div', 'jn-tcont', cd);
          el('b', 'jn-tnom', cd, esc(pq.n)); cd.insertBefore(cd.lastChild, ct);
          T.contenido(pq).forEach(function (it) {
            var q = E.Iconos.cuadro(ct, it.tipo === 'res' ? { html: E.Iconos.svg(it.k, 44), badge: 'x' + it.cant, titulo: it.n } : { html: '<span class="jn-cuad-cargando">…</span>', badge: 'x' + it.cant, titulo: it.n });
            if (it.tipo === 'def') T.miniDef(it.k, function (u) { var im = q.querySelector('.jn-cuad-im span, .jn-cuad-im .jn-cuad-cargando'); if (im && u) { im.outerHTML = '<img class="jn-cuad-img" src="' + u + '">'; } else if (im) im.textContent = '▣'; });
          });
          var bw = el('a', 'jn-btn tw', cd, 'COMPRAR POR WHATSAPP'); bw.href = T.whatsapp(pq); bw.target = '_blank'; bw.rel = 'noopener';
        });
        el('div', 'jn-lb-sub', cont, 'CANJEAR CÓDIGO');
        var fc = el('div', 'jn-fila', cont), ic = el('input', 'jn-in', fc); ic.placeholder = 'XXXX-XXXX-XXXX'; ic.maxLength = 40; ic.autocapitalize = 'characters';
        var bc = el('button', 'jn-btn', fc, 'CANJEAR'), rc = el('div', 'jn-lb-nota', cont, '');
        bc.onclick = function () { var r = T.canjear(ic.value); rc.textContent = r.msg; rc.style.color = r.ok ? '#8fe3a0' : '#ff9a9a'; if (r.ok) { ic.value = ''; } };
      } else if (tab === 'amigos') pintarAmigos(cont);
      else if (tab === 'ajustes') pintarAjustes(cont);
      var nh = P.querySelector('.hor'); if (nh) nh.scrollLeft = sl;
    }
    /* ---- editor de controles: arrastra cada control; toca uno para elegirlo y cambiar su tamaño ---- */
    var NOMBRES_CTL = { fuego: 'FUEGO', agarrar: 'AGARRAR', turbo: 'TURBO', freno: 'FRENO', auto: 'PILOTO AUTOMÁTICO', acel: 'ACELERADOR', radar: 'RADAR', flota: 'FLOTA', mochila: 'MOCHILA', atracar: 'ATRACAR', aterrizar: 'ATERRIZAR',
      p_saltar: 'SALTAR', p_golpe: 'GOLPEAR', p_volar: 'VOLAR (jetpack)', p_usar: 'USAR', p_correr: 'CORRER', p_pie: 'BAJAR A PIE / VISTA BASE', p_nave: 'LLAMAR NAVE', p_despegar: 'DESPEGAR',
      p_cons: 'CONSTRUIR', p_demoler: 'DEMOLER', p_col: 'COLOCAR', p_rot: 'GIRAR', p_can: 'CANCELAR', p_zoom: 'ZOOM Y GIRO DE CÁMARA', p_torreta: 'FLECHAS DE LA TORRETA', p_disparar: 'DISPARAR TORRETA', p_recargar: 'RECARGAR', p_sen: 'BAJAR DE LA TORRETA' };
    function abrirEditor() {
      var L = DOMcapas.lobby, ed = el('div', 'jn-ed', L), sel = null, drag = null, els = {}, pant = 'nave';
      var zona = el('div', 'jn-edz', ed), tabs = el('div', 'jn-ed-tabs', ed);
      function cfg(i) { return jug.layout[i] || (jug.layout[i] = { dx: 0, dy: 0, s: 1 }); }
      function revisar() {   // marca en rojo lo que se pisa con otro control o se sale de la pantalla
        var ks = Object.keys(els), i, j, r1, r2, mal = {};
        for (i = 0; i < ks.length; i++) for (j = i + 1; j < ks.length; j++) { r1 = els[ks[i]].getBoundingClientRect(); r2 = els[ks[j]].getBoundingClientRect(); if (r1.left < r2.right - 4 && r1.right > r2.left + 4 && r1.top < r2.bottom - 4 && r1.bottom > r2.top + 4) { mal[ks[i]] = mal[ks[j]] = 1; } }
        ks.forEach(function (k) { els[k].classList.toggle('sol', !!mal[k]); els[k].classList.toggle('sel', k === sel); });
        if (!sel) { info.textContent = 'Toca un control para elegirlo, arrástralo y cambia su tamaño.'; rng.disabled = true; return; }
        rng.disabled = false; info.textContent = (NOMBRES_CTL[sel] || sel) + ' · tamaño ' + Math.round(cfg(sel).s * 100) + '%' + (Object.keys(mal).length ? ' · ⚠ hay controles encimados (en rojo)' : '');
        rng.value = Math.round(cfg(sel).s * 100);
      }
      function aplicar() { E.aplicarLayout(zona); }
      function dentro(k) {
        var r = els[k].getBoundingClientRect(), W = E.ancho, H = E.alto, c = cfg(k), pad = 4;
        if (r.left < pad) c.dx += (pad - r.left) / W; if (r.right > W - pad) c.dx -= (r.right - (W - pad)) / W;
        if (r.top < pad) c.dy += (pad - r.top) / H; if (r.bottom > H - pad) c.dy -= (r.bottom - (H - pad)) / H;
      }
      function hacer(elm, k) {
        els[k] = elm; elm.setAttribute('data-ctl', k); elm.classList.add('jn-ed-c'); elm.style.display = elm.classList.contains('jn-pl-tor') ? 'grid' : (elm.classList.contains('jn-pl-usar') ? 'flex' : '');
        elm.addEventListener('pointerdown', function (e) { sel = k; drag = { k: k, x: e.clientX, y: e.clientY, dx: cfg(k).dx, dy: cfg(k).dy, id: e.pointerId }; try { elm.setPointerCapture(e.pointerId); } catch (x) { } revisar(); e.preventDefault(); e.stopPropagation(); });
        elm.addEventListener('pointermove', function (e) { if (!drag || drag.id !== e.pointerId || drag.k !== k) return; var c = cfg(k); c.dx = drag.dx + (e.clientX - drag.x) / E.ancho; c.dy = drag.dy + (e.clientY - drag.y) / E.alto; aplicar(); dentro(k); aplicar(); revisar(); });
        ['pointerup', 'pointercancel'].forEach(function (n) { elm.addEventListener(n, function () { drag = null; guardar('layout', jug.layout); }); });
      }
      var PANTS = {
        nave: ['EN LA NAVE', function (z) {
          var rad = el('div', 'jn-radar', z, '<span>RADAR</span>'); rad.style.width = rad.style.height = '132px'; hacer(rad, 'radar');
          var ac = el('div', 'jn-acel', z), pal = el('div', 'jn-pal', ac, '<u>ACEL</u><i></i>'); hacer(pal, 'acel');
          var bs = el('div', 'jn-bots', ac); hacer(el('div', 'jn-bot fu', bs, 'FUEGO'), 'fuego'); hacer(el('div', 'jn-bot gr', bs, 'AGARRAR'), 'agarrar'); hacer(el('div', 'jn-bot', bs, 'TURBO'), 'turbo'); hacer(el('div', 'jn-bot f', bs, 'FRENO'), 'freno'); hacer(el('div', 'jn-bot au', bs, 'AUTO'), 'auto');
          hacer(el('div', 'jn-ico jn-flotabtn', z, 'FLOTA'), 'flota'); hacer(el('div', 'jn-ico jn-flotabtn jn-invbtn', z, 'MOCHILA'), 'mochila');
          hacer(el('div', 'jn-atracar', z, 'ATRACAR'), 'atracar'); hacer(el('div', 'jn-atracar jn-aterrizar', z, 'ATERRIZAR'), 'aterrizar');
        }],
        pie: ['PERSONAJE A PIE', function (z) {
          var w = el('div', 'jn-planeta', z); w.style.cssText = 'position:absolute;left:0;top:0;width:100%;height:100%;pointer-events:none';
          hacer(el('button', 'jn-btn jn-grande jn-pl-saltar', w, 'SALTAR'), 'p_saltar'); hacer(el('button', 'jn-btn jn-grande jn-pl-volar', w, 'VOLAR'), 'p_volar'); hacer(el('button', 'jn-btn jn-grande jn-pl-golpe', w, 'GOLPEAR'), 'p_golpe');
          var u = el('div', 'jn-pl-usar', w); el('span', '', u, '✋'); el('b', '', u, 'USAR'); hacer(u, 'p_usar');
          var br = el('div', 'jn-pl-barra', w); br.style.pointerEvents = 'none';
          hacer(el('button', 'jn-btn', br, 'CORRER'), 'p_correr'); hacer(el('button', 'jn-btn', br, 'VISTA BASE'), 'p_pie'); hacer(el('button', 'jn-btn', br, 'LLAMAR NAVE'), 'p_nave'); hacer(el('button', 'jn-btn', br, 'DESPEGAR'), 'p_despegar');
        }],
        base: ['VISTA DE LA BASE', function (z) {
          var w = el('div', 'jn-planeta', z); w.style.cssText = 'position:absolute;left:0;top:0;width:100%;height:100%;pointer-events:none';
          var iz = el('div', 'jn-pl-izq', w); ['⟲', '⟳', '＋', '－'].forEach(function (t) { el('div', 'jn-ico', iz, t); }); hacer(iz, 'p_zoom');
          var br = el('div', 'jn-pl-barra', w); br.style.pointerEvents = 'none';
          hacer(el('button', 'jn-btn', br, 'CONSTRUIR'), 'p_cons'); hacer(el('button', 'jn-btn', br, 'DEMOLER'), 'p_demoler'); hacer(el('button', 'jn-btn', br, 'COLOCAR'), 'p_col'); hacer(el('button', 'jn-btn', br, 'GIRAR'), 'p_rot'); hacer(el('button', 'jn-btn', br, 'CANCELAR'), 'p_can');
        }],
        torreta: ['EN LA TORRETA', function (z) {
          var w = el('div', 'jn-planeta', z); w.style.cssText = 'position:absolute;left:0;top:0;width:100%;height:100%;pointer-events:none';
          var t = el('div', 'jn-pl-tor', w); ['▲:tu', '◀:tl', '▶:tr', '▼:td'].forEach(function (q) { var a = q.split(':'); el('div', 'jn-ico ' + a[1], t, a[0]); }); hacer(t, 'p_torreta');
          hacer(el('button', 'jn-btn jn-grande jn-fuego', w, 'DISPARAR'), 'p_disparar');
          var br = el('div', 'jn-pl-barra', w); br.style.pointerEvents = 'none'; hacer(el('button', 'jn-btn', br, 'RECARGAR'), 'p_recargar'); hacer(el('button', 'jn-btn', br, 'BAJAR DE LA TORRETA'), 'p_sen');
        }]
      };
      function cargar(k) {
        pant = k; sel = null; els = {}; zona.innerHTML = ''; PANTS[k][1](zona); aplicar(); revisar();
        Array.prototype.forEach.call(tabs.children, function (b) { b.classList.toggle('on', b.getAttribute('data-p') === k); });
      }
      el('div', 'jn-ed-tit', ed, 'AJUSTAR CONTROLES');
      Object.keys(PANTS).forEach(function (k) { var b = el('button', 'jn-btn', tabs, PANTS[k][0]); b.setAttribute('data-p', k); b.onclick = function () { cargar(k); }; });
      var barra = el('div', 'jn-ed-barra', ed), info = el('div', 'jn-ed-info', barra, ''), rng = el('input', 'jn-lb-rng', barra); rng.type = 'range'; rng.min = 50; rng.max = 180; rng.step = 5;
      rng.oninput = function () { if (!sel) return; cfg(sel).s = rng.value / 100; aplicar(); dentro(sel); aplicar(); guardar('layout', jug.layout); revisar(); };
      var rs = el('button', 'jn-btn', barra, 'RESTABLECER PANTALLA'); rs.onclick = function () { Object.keys(els).forEach(function (k) { delete jug.layout[k]; }); guardar('layout', jug.layout); aplicar(); revisar(); };
      var ok = el('button', 'jn-btn jn-grande', barra, 'LISTO'); ok.onclick = function () { guardar('layout', jug.layout); ed.parentNode.removeChild(ed); };
      cargar('nave');
    }
    function seg(padre, titulo, k, opciones) {
      el('h4', '', padre, titulo); var s = el('div', 'jn-seg', padre); s.setAttribute('data-k', k);
      opciones.forEach(function (o) { var b = el('button', 'jn-btn', s, o[1]); b.setAttribute('data-v', o[0]); });
    }
    function deslizador(padre, titulo, k, min, max) {
      var h = el('h4', '', padre, titulo + ' · <span></span>'), sp = h.querySelector('span'), r = el('input', 'jn-lb-rng', padre); r.type = 'range'; r.min = min; r.max = max; r.step = 5; r.value = Math.round(jug[k] * 100); sp.textContent = r.value + '%';
      r.oninput = function () { jug[k] = r.value / 100; guardar(k, jug[k]); sp.textContent = r.value + '%'; };
    }
    function marcarSeg(c) {
      var b = c.querySelectorAll('.jn-seg button'), i;
      for (i = 0; i < b.length; i++) { var k = b[i].parentNode.getAttribute('data-k'), v = b[i].getAttribute('data-v'); b[i].className = 'jn-btn' + ((k === 'calidad' && jug.calidad === v) || (k === 'inv' && String(jug.invertirY ? 1 : 0) === v) ? ' on' : ''); }
    }
    function pintarAjustes(c) {
      seg(c, 'CALIDAD GRÁFICA', 'calidad', [['baja', 'Baja'], ['media', 'Media'], ['alta', 'Alta']]);
      el('div', 'jn-lb-nota', c, 'La calidad de las texturas se aplica al reiniciar el juego.');
      el('div', 'jn-lb-sub', c, 'CONTROLES');
      seg(c, 'EJE VERTICAL (CABECEO)', 'inv', [['0', 'Natural'], ['1', 'Invertido']]);
      deslizador(c, 'SENSIBILIDAD DE GIRO (palanca)', 'sensGiro', 50, 200);
      deslizador(c, 'SENSIBILIDAD DE CÁMARA', 'sensCam', 50, 250);
      var be = el('button', 'jn-btn jn-lb-sel', c, 'PERSONALIZAR CONTROLES'); be.onclick = abrirEditor;
      el('div', 'jn-lb-nota', c, 'Mueve y cambia de tamaño los botones para que no se estorben en tu pantalla.');
      el('div', 'jn-lb-sub', c, 'APLICACIÓN');
      var ins = el('button', 'jn-btn jn-lb-sel', c, 'INSTALAR COMO APP'), info = el('div', 'jn-lb-nota', c, '');
      var standalone = (global.matchMedia && global.matchMedia('(display-mode: fullscreen), (display-mode: standalone)').matches) || global.navigator.standalone;
      if (standalone) { ins.disabled = true; ins.textContent = 'YA ESTÁS EN LA APP'; info.textContent = 'Estás jugando como aplicación instalada.'; }
      else if (global.JN_instalar) { info.textContent = 'Se añade a tu pantalla de inicio y abre a pantalla completa, sin barra del navegador.'; ins.onclick = function () { var e = global.JN_instalar; global.JN_instalar = null; try { e.prompt(); } catch (x) { } }; }
      else { info.textContent = 'Si no sale la ventana de instalación: toca ⋮ en Chrome y elige “Instalar aplicación” (o “Añadir a la pantalla de inicio”).'; ins.disabled = true; ins.textContent = 'INSTALAR DESDE EL MENÚ ⋮'; }
      el('div', 'jn-lb-sub', c, 'CUENTA');
      var g = el('button', 'jn-btn jn-lb-sel', c, 'VINCULAR CON GOOGLE · próximamente'); g.disabled = true;
      el('div', 'jn-lb-nota', c, 'Cuando haya servidor, tu progreso se guardará en tu cuenta y podrás jugar desde cualquier dispositivo.');
      el('div', 'jn-lb-nota', c, 'Versión ' + esc(CONFIG.version) + (global.JN_V ? ' · ' + esc(global.JN_V) : ''));
      marcarSeg(c);
    }

    /* ---- amigos (P2P): ID fijo, agregar amigo pegando su ID, lista en línea ---- */
    function pintarAmigos(c) {
      var Am = E.Amigos; if (!Am) { el('div', 'jn-lb-nota', c, 'La red de amigos no está disponible.'); return; }
      Am.iniciar(jug.nombre); Am.onCambio = function () { if (tab === 'amigos' && ui.amgLista) listaAmigos(ui.amgLista); };
      el('div', 'jn-lb-sub', c, 'MI ID');
      var f = el('div', 'jn-fila', c), idc = el('input', 'jn-in', f); idc.readOnly = true; idc.value = Am.id();
      var cp = el('button', 'jn-btn', f, 'COPIAR'); cp.onclick = function () { var ok = function () { cp.textContent = '¡COPIADO!'; setTimeout(function () { cp.textContent = 'COPIAR'; }, 1400); }; try { if (global.navigator.clipboard) global.navigator.clipboard.writeText(idc.value).then(ok, function () { idc.select(); document.execCommand('copy'); ok(); }); else { idc.select(); document.execCommand('copy'); ok(); } } catch (x) { } };
      el('div', 'jn-lb-sub', c, 'AGREGAR AMIGO');
      var f2 = el('div', 'jn-fila', c), ni = el('input', 'jn-in', f2); ni.placeholder = 'Pega el ID de tu amigo'; ni.maxLength = 20; ni.autocapitalize = 'none';
      var ab = el('button', 'jn-btn', f2, 'AGREGAR'), msg = el('div', 'jn-lb-nota', c, '');
      ab.onclick = function () { var r = Am.agregar(ni.value); msg.textContent = r || 'Agregado. Cuando tu amigo abra esta pestaña te verá y podrá aceptarte.'; if (!r) ni.value = ''; };
      el('div', 'jn-lb-sub', c, 'LISTA');
      ui.amgLista = el('div', '', c); listaAmigos(ui.amgLista);
    }
    function listaAmigos(L) {
      var Am = E.Amigos; L.innerHTML = '';
      el('div', 'jn-lb-nota', L, Am.cargando ? 'Conectando…' : Am.error ? '⚠ ' + esc(Am.error) : Am.listo ? '● Conectado a la red de amigos' : '○ Sin conexión todavía');
      if (Am.error || (!Am.listo && !Am.cargando)) { var rb = el('button', 'jn-btn', L, 'REINTENTAR'); rb.onclick = function () { Am.reintentarRed(); }; }
      Am.pendientes().forEach(function (p) {
        var d = tarjeta(L, p.nombre, 'Quiere ser tu amigo · ' + p.id, '', 'sel'), bs = el('div', 'jn-fl-bt', d);
        var a = el('button', 'jn-btn', bs, 'ACEPTAR'); a.onclick = function (e) { e.stopPropagation(); Am.aceptar(p.id); };
        var r = el('button', 'jn-btn', bs, 'RECHAZAR'); r.onclick = function (e) { e.stopPropagation(); Am.rechazar(p.id); };
      });
      var l = Am.amigos(); if (!l.length) el('div', 'jn-lb-nota', L, 'Aún no tienes amigos. Intercambia tu ID con alguien: basta con que uno agregue al otro.');
      l.forEach(function (a) {
        var on = !!Am.enLinea[a.id], d = tarjeta(L, a.nombre, (Am.ultimo[a.id] || a.id), on ? '● EN LÍNEA' : '○', on ? 'sel' : ''), bs = el('div', 'jn-fl-bt', d);
        var s = el('button', 'jn-btn', bs, 'SALUDAR'); s.disabled = !on; s.onclick = function (e) { e.stopPropagation(); Am.saludar(a.id); };
        var q = el('button', 'jn-btn', bs, 'QUITAR'); q.onclick = function (e) { e.stopPropagation(); if (global.confirm('¿Quitar a ' + a.nombre + '?')) Am.quitar(a.id); };
      });
    }
    function cambiarTab(t) { tab = t; idx = indiceNaveElegida(); if (t === 'motores') { mIdx = 0; MOTORES.forEach(function (q, k) { if (q.n === jug.motor) mIdx = k; }); } marcarTabs(); escenario(); pintarPanel(); }
    function marcarTabs() { ui.tabs.forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-t') === tab); }); }

    function construirUI() {
      var L = DOMcapas.lobby; L.innerHTML = '';
      var top = el('div', 'jn-lb-top jn-sinpe', L); el('div', 'jn-lb-logo', top, esc(CONFIG.titulo));
      var nav = el('div', 'jn-lb-nav', top); ui.tabs = [];
      TABS.forEach(function (t) { var b = el('button', 'jn-lb-tab', nav, svg(t[0]) + '<span>' + t[1] + '</span>'); b.setAttribute('data-t', t[0]); b.onclick = function () { cambiarTab(t[0]); }; ui.tabs.push(b); });
      ui.cred = el('div', 'jn-lb-credtop', top, '');
      ui.panel = el('div', 'jn-lb-panel', L);
      ui.inicio = el('div', 'jn-lb-inicio jn-sinpe', L);
      var izq = el('div', 'jn-lb-izq', ui.inicio);
      el('div', 'jn-lb-rot', izq, 'PILOTO'); ui.in = el('input', 'jn-in', izq); ui.in.maxLength = 16; ui.in.placeholder = 'Tu nombre de piloto'; ui.in.value = jug.nombre;
      ui.in.onchange = function () { jug.nombre = (ui.in.value || 'Piloto').replace(/[<>]/g, '').slice(0, 16); guardar('nombre', jug.nombre); };
      colores(izq);
      ui.jugarCaja = el('div', 'jn-lb-jugar jn-sinpe', L);
      ui.red = el('button', 'jn-btn', ui.jugarCaja, CONFIG.servidor ? 'MULTIJUGADOR' : 'MULTIJUGADOR · sin servidor'); ui.red.disabled = !CONFIG.servidor; ui.red.style.fontSize = '12px';
      ui.red.onclick = function () { ui.in.onchange(); irA('mundo', { modo: 'red' }); };
      ui.jugar = el('button', 'jn-btn jn-grande', ui.jugarCaja, 'JUGAR'); ui.jugar.onclick = function () { ui.in.onchange(); irA('mundo', { modo: 'solo' }); };
      ui.panel.addEventListener('pointerdown', function (e) { e.stopPropagation(); });
      /* el panel de ajustes reutiliza un solo manejador de clics */
      L.addEventListener('click', function (e) {
        var b = e.target; if (!b || !b.getAttribute || b.parentNode === null || !b.parentNode.getAttribute) return; var v = b.getAttribute('data-v'); if (v == null) return; var k = b.parentNode.getAttribute('data-k'); if (!k) return;
        if (k === 'calidad') { jug.calidad = v; guardar('calidad', v); redimensionar(); } else if (k === 'inv') { jug.invertirY = v === '1'; guardar('invY', jug.invertirY); }
        marcarSeg(ui.panel);
      });
      uiHecha = true;
    }
    function encuadrar() { redimensionar3(E.ancho, E.alto); }
    function redimensionar3(w, h) {
      if (!cam) return;
      cam.aspect = w / h;
      var vf = 40 * PI / 180, hf = 2 * Math.atan(Math.tan(vf / 2) * cam.aspect), dV = 5 / Math.sin(vf / 2) * 1.3, dH = 5 / Math.sin(hf / 2) * 1.3, d = Math.max(dV, dH);
      cam.position.set(0, d * 0.16, d); cam.lookAt(0, 0, 0);
      var conPanel = tab !== 'inicio', pw = Math.min(w * 0.46, 380), centro = conPanel && w > h ? (w - pw) / 2 : w / 2;   // el modelo se queda en el hueco libre
      if (w > h) { var dy = h * 0.04; cam.setViewOffset(w, h, w / 2 - centro, -dy, w, h); } else cam.setViewOffset(w, h, 0, h * 0.11, w, h);
      cam.updateProjectionMatrix();
    }
    return {
      construir: construir, redimensionar: redimensionar3,
      entrar: function () {
        mostrarCapas(['lobby']); if (!uiHecha) construirUI(); if (E.refrescarTexturas) E.refrescarTexturas();
        if (!naveLibre(jug.nave)) { jug.nave = 'sombra'; guardar('nave', 'sombra'); }
        idx = indiceNaveElegida(); tab = 'inicio'; aplicarAcento(); marcarTabs(); escenario(); pintarPanel();
        ui.cred.innerHTML = '◎ ' + (leer('cred', 0) || 0);
      },
      salir: function () { quitarEscena(); },
      tecla: function (e) { if (e.code === 'Enter' && document.activeElement !== ui.in && tab === 'inicio') ui.jugar.onclick(); },
      puntero: function (tipo, e) {
        if (tipo === 'abajo') arr = { id: e.pointerId, x: e.clientX };
        else if (tipo === 'mueve' && arr && arr.id === e.pointerId) { girar.rotation.y += (e.clientX - arr.x) * 0.012; arr.x = e.clientX; vel = 0; }
        else if (tipo === 'arriba' && arr && arr.id === e.pointerId) arr = null;
      },
      actualizar: function (dt, t) {
        if (!sc) return;
        if (!arr) { vel += (0.25 - vel) * Math.min(1, dt * 1.5); girar.rotation.y += vel * dt; }
        cielo.rotation.y += dt * 0.008;
        if (modeloAct) actualizarModelo(modeloAct, t, 0.35 + 0.1 * Math.sin(t * 1.3));
        E.renderer.render(sc, cam);
      }
    };
  })();


})(window);
