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
    { id: 'motores_p', n: 'Motores pequeños', d: 'Desbloquea los 4 motores pequeños', motor: 0 },
    { id: 'motores_m', n: 'Motores medianos', d: 'Desbloquea los 4 motores medianos', motor: 1 },
    { id: 'motores_g', n: 'Motores grandes', d: 'Desbloquea los 4 motores grandes', motor: 2 },
    { id: 'dev', n: 'Modo desarrollador', d: 'Todo desbloqueado y construcción gratis', dev: true, oculto: true }
  ];
  function h(s, seed) { var x = seed >>> 0; for (var i = 0; i < s.length; i++) { x ^= s.charCodeAt(i); x = Math.imul(x, 16777619) >>> 0; } return x >>> 0; }
  function chk(p) { var a = h(p + SAL, 2166136261), b = h(SAL + p, 0x9e3779b1), v = (a ^ b) >>> 0, r = '', i; for (i = 0; i < 4; i++) { r += ALF[v & 31]; v >>>= 5; } return r; }
  T.generar = function (idx, serial) { var p = ALF[idx >> 5 & 31] + ALF[idx & 31] + serial; var c = p + chk(p); return c.slice(0, 4) + '-' + c.slice(4, 8) + '-' + c.slice(8); };
  T.leerCodigo = function (txt) {
    var c = String(txt || '').toUpperCase().replace(/[^A-Z0-9]/g, ''); if (c.length !== 12) return null;
    var p = c.slice(0, 8); if (chk(p) !== c.slice(8)) return null;
    var i = ALF.indexOf(c[0]) * 32 + ALF.indexOf(c[1]), pq = T.PAQUETES[i]; if (!pq) return null; return { paq: pq, serial: c.slice(2, 8) };
  };
  T.canjear = function (txt) {
    var r = T.leerCodigo(txt); if (!r) return { ok: false, msg: 'Código no válido' };
    var us = leer('codigosUsados', []) || []; if (us.indexOf(r.serial) >= 0) return { ok: false, msg: 'Ese código ya se usó' };
    var pq = r.paq, k, inv, st;
    if (pq.inv) { inv = leer('inv', null) || {}; for (k in pq.inv) inv[k] = (inv[k] || 0) + pq.inv[k]; guardar('inv', inv); }
    if (pq.def) { st = leer('stock', null) || {}; for (k in pq.def) st[k] = (st[k] || 0) + pq.def[k]; guardar('stock', st); }
    if (typeof pq.motor === 'number') { var m = leer('motoresLib', []) || []; if (m.indexOf(pq.motor) < 0) m.push(pq.motor); guardar('motoresLib', m); }
    if (pq.dev) { E.jug.pruebas = true; guardar('pruebas', true); }
    us.push(r.serial); guardar('codigosUsados', us);
    return { ok: true, msg: '¡Canjeado! ' + pq.n + ': ' + pq.d, paq: pq };
  };
  T.motorComprado = function (tam) { return (leer('motoresLib', []) || []).indexOf(tam) >= 0; };
  T.whatsapp = function (pq) {
    var id = ''; try { id = E.Amigos && E.Amigos.id ? E.Amigos.id() : ''; } catch (e) { }
    var msg = 'Hola, quiero comprar el paquete "' + pq.n + '" (' + pq.d + ') de Universo Abierto.' + (id ? ' Mi ID de jugador: ' + id : '');
    return 'https://wa.me/' + WA + '?text=' + encodeURIComponent(msg);
  };
})(window);
