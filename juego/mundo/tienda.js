/* Tienda: paquetes que se compran por WhatsApp y se canjean con un código */
(function (global) {
  'use strict';
  var E = global.JN, leer = E.leer, guardar = E.guardar;
  var T = E.Tienda = {};
  var WA = '593959099007', ALF = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', SAL = 'UA-torisoft-2026';
  /* ¡Si cambias algo de esta lista, cámbialo igual en herramientas/generador_codigos.html! */
  T.PAQUETES = [
    { id: 'muros_s', n: 'Paquete de muros S', d: '10 muros + 2 portones', def: { muro: 10, porton: 2 } },
    { id: 'muros_l', n: 'Paquete de muros L', d: '30 muros + 6 portones', def: { muro: 30, porton: 6 } },
    { id: 'torretas_s', n: 'Paquete de torretas S', d: '4 torretas futuristas', def: { torretaf: 4 } },
    { id: 'torretas_l', n: 'Paquete de torretas L', d: '12 torretas futuristas', def: { torretaf: 12 } },
    { id: 'minerales_s', n: 'Minerales S', d: '300 piedra · 100 hierro · 50 cobre · 10 titanio · 2 oro', inv: { piedra: 300, hierro: 100, cobre: 50, titanio: 10, oro: 2 } },
    { id: 'minerales_l', n: 'Minerales L', d: '1500 piedra · 500 hierro · 250 cobre · 60 titanio · 12 oro', inv: { piedra: 1500, hierro: 500, cobre: 250, titanio: 60, oro: 12 } },
    { id: 'piezas_s', n: 'Piezas de nave S', d: '40 piezas', inv: { piezas: 40 } },
    { id: 'piezas_l', n: 'Piezas de nave L', d: '200 piezas', inv: { piezas: 200 } },
    { id: 'dev', n: 'Modo desarrollador', d: 'Todo desbloqueado y construcción gratis', dev: true, oculto: true },
    /* código FIJO (no sale del generador) */
    { id: 'soldado_premium', n: 'Soldado Premium EC Gamer', d: 'Aspecto exclusivo del soldado (se ve en el lobby)', skin: 'premium', fijo: ['ECGAMER', 'SOLDADOPREMIUNECGAMER', 'SOLDADOPREMIUMECGAMER'] },
    { id: 'perro_farmeo', oculto: true, n: 'Perro robot de farmeo', d: 'Te sigue por el planeta y carga tus minerales', perro: true, modelo: 'perro' }
  ];
  function h(s, seed) { var x = seed >>> 0; for (var i = 0; i < s.length; i++) { x ^= s.charCodeAt(i); x = Math.imul(x, 16777619) >>> 0; } return x >>> 0; }
  function chk(p) { var a = h(p + SAL, 2166136261), b = h(SAL + p, 0x9e3779b1), v = (a ^ b) >>> 0, r = '', i; for (i = 0; i < 4; i++) { r += ALF[v & 31]; v >>>= 5; } return r; }
  T.generar = function (idx, serial) { var p = ALF[idx >> 5 & 31] + ALF[idx & 31] + serial; var c = p + chk(p); return c.slice(0, 4) + '-' + c.slice(4, 8) + '-' + c.slice(8); };
  T.leerCodigo = function (txt) {
    var c = String(txt || '').toUpperCase().replace(/[^A-Z0-9]/g, ''); if (c.length !== 12) return null;
    var p = c.slice(0, 8); if (chk(p) !== c.slice(8)) return null;
    var i = ALF.indexOf(c[0]) * 32 + ALF.indexOf(c[1]), pq = T.PAQUETES[i]; if (!pq) return null; return { paq: pq, serial: c.slice(2, 8) };
  };
  T.tienePerro = function () { var p = leer('perro', null); return !!(p && p.tiene); };
  T.tieneSkin = function (k) { return (leer('skins', []) || []).indexOf(k) >= 0; };
  T.canjear = function (txt) {
    var nz = String(txt || '').toUpperCase().replace(/[^A-Z0-9]/g, ''), fx = T.PAQUETES.filter(function (q) { return q.fijo && q.fijo.indexOf(nz) >= 0; })[0];
    if (fx) {
      if (T.tieneSkin(fx.skin)) return { ok: false, msg: 'Ya tienes el ' + fx.n };
      var sk = leer('skins', []) || []; sk.push(fx.skin); guardar('skins', sk); guardar('soldadoSkin', fx.skin);
      return { ok: true, msg: '¡Desbloqueado! ' + fx.n + ' (ya está equipado)', paq: fx };
    }
    var r = T.leerCodigo(txt); if (!r) return { ok: false, msg: 'Código no válido' };
    var us = leer('codigosUsados', []) || []; if (us.indexOf(r.serial) >= 0) return { ok: false, msg: 'Ese código ya se usó' };
    var pq = r.paq, k, inv, st;
    if (pq.inv) { inv = leer('inv', null) || {}; for (k in pq.inv) inv[k] = (inv[k] || 0) + pq.inv[k]; guardar('inv', inv); }
    if (pq.def) { st = leer('stock', null) || {}; for (k in pq.def) st[k] = (st[k] || 0) + pq.def[k]; guardar('stock', st); }
    if (pq.perro) { if (T.tienePerro()) return { ok: false, msg: 'Ya tienes el perro robot' }; guardar('perro', { tiene: true, carga: {} }); }
    if (pq.dev) { E.jug.pruebas = true; guardar('pruebas', true); }
    us.push(r.serial); guardar('codigosUsados', us);
    return { ok: true, msg: '¡Canjeado! ' + pq.n + ': ' + pq.d, paq: pq };
  };
  /* qué trae cada paquete, para dibujar los cuadros con imagen */
  var DEFS = { muro: { n: 'Muro de piedra', arch: ['muro_piedra.js', 'defensas.js'], fn: 'createDefMuro' }, porton: { n: 'Portón', arch: ['porton_piedra.js', 'defensas.js'], fn: 'createDefPorton' }, torretaf: { n: 'Torreta futurista', arch: ['torreta_futurista.js', 'defensas.js'], fn: 'createDefTorretaF' } };
  var NRES = { piedra: 'Piedra', hierro: 'Hierro', cobre: 'Cobre', titanio: 'Titanio', oro: 'Oro', piezas: 'Piezas de nave' };
  T.contenido = function (pq) {
    var r = [], k; if (pq.def) for (k in pq.def) r.push({ tipo: 'def', k: k, n: DEFS[k].n, cant: pq.def[k] });
    if (pq.inv) for (k in pq.inv) r.push({ tipo: 'res', k: k, n: NRES[k] || k, cant: pq.inv[k] }); return r;
  };
  T.miniDef = function (id, cb) {   /* imagen real del modelo (se carga una vez, usa la miniatura cacheada) */
    var q = DEFS[id], arch = q.arch.slice(), THREE = global.THREE;
    (function sig() {
      if (!arch.length) { cb(E.Iconos.miniatura(id, function () { var m = global[q.fn](THREE); return m.group || m; }, 168)); return; }
      var a = arch.shift(); if (a === 'defensas.js' && typeof global.createDefMuro === 'function') return sig();
      if (/muro_piedra|porton_piedra|torreta_futurista/.test(a) && typeof global[{ 'muro_piedra.js': 'createStoneWall', 'porton_piedra.js': 'createGate', 'torreta_futurista.js': 'createTurret' }[a]] === 'function') return sig();
      E.cargarScript(E.CONFIG.rutaEdificios + 'base/' + a, sig, function () { cb(''); });
    })();
  };
  T.cargarPremium = function (cb) {   /* carga el modelo premium una sola vez */
    if (typeof global.createSoldadoPremium === 'function') return cb(true);
    E.cargarScript(E.CONFIG.rutaPersonajes + 'soldado_premium.js', function () { cb(typeof global.createSoldadoPremium === 'function'); }, function () { cb(false); });
  };
  T.miniPremium = function (cb) {
    T.cargarPremium(function (ok) {
      if (!ok) return cb('');
      var api = null; try { api = global.createSoldadoPremium(global.THREE); } catch (e) { return cb(''); }
      api.listo(function () { cb(E.Iconos.miniatura('soldado_premium', function () { return api.group; }, 200)); });
    });
  };
  T.miniPerro = function (cb) {
    E.cargarScript(E.CONFIG.rutaPersonajes + 'perro_robot.js', function () {
      if (typeof global.createPerroRobotGo2 !== 'function') return cb('');
      try { var d = global.createPerroRobotGo2(global.THREE, { version: 'farmeo', metersPerUnit: 1, height: 1.2 }); cb(E.Iconos.miniatura('perro_farmeo', function () { return d.group; }, 200)); } catch (e) { cb(''); }
    }, function () { cb(''); });
  };
  T.whatsapp = function (pq) {
    var id = ''; try { id = E.Amigos && E.Amigos.id ? E.Amigos.id() : ''; } catch (e) { }
    var msg = 'Hola, quiero comprar el paquete "' + pq.n + '" (' + pq.d + ') de Universo Abierto.' + (id ? ' Mi ID de jugador: ' + id : '');
    return 'https://wa.me/' + WA + '?text=' + encodeURIComponent(msg);
  };
})(window);
