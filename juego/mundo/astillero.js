/* Astillero: fabricar naves con piezas y minerales, con tiempo de fabricación y entrega (estación o colonia).
   Una nave en fabricación o en viaje todavía no existe en tu flota: por eso nadie puede atacarla ni robarla. */
(function (global) {
  'use strict';
  var E = global.JN, leer = E.leer, guardar = E.guardar;
  var A = E.Astillero = { onLlega: null };
  /* Costos y tiempos por nivel (ajustables). Tiempo en segundos reales; sigue corriendo con el juego cerrado. */
  A.NIVELES = {
    1: { cost: { piezas: 30, hierro: 200, cobre: 80, titanio: 20, oro: 4 }, seg: 180 },
    2: { cost: { piezas: 80, hierro: 500, cobre: 200, titanio: 60, oro: 12 }, seg: 480 },
    3: { cost: { piezas: 160, hierro: 1000, cobre: 400, titanio: 140, oro: 30 }, seg: 900 }
  };
  var NIV_ID = {};   // nivel fijo por nave (si lo quieres): { id: 2 }
  A.nivelDe = function (n) {
    if (NIV_ID[n.id]) return NIV_ID[n.id]; var c = String((n.clase || '') + ' ' + (n.nombre || '')).toLowerCase();
    if (/carguero|pesad|crucero|nodriza|acoraz|titan|mastodonte|fragata|destructor/.test(c)) return 3;
    if (/caza|ligera|ligero|explor|scout|interceptor|prospector|correo/.test(c)) return 1; return 2;
  };
  A.fabricables = function () { return (E.NAVES || []).filter(function (n) { return (E.NAVES_INICIALES || []).indexOf(n.id) < 0 && n.id !== 'sombra'; }); };
  A.tiene = function (id) { return (E.NAVES_INICIALES || []).indexOf(id) >= 0 || (leer('desbloq', []) || []).indexOf(id) >= 0; };
  function est() { var s = leer('astillero', null) || {}; if (!s.cola) s.cola = []; if (!s.viaje) s.viaje = []; return s; }
  A.estado = est;
  function dar(id, col) {
    var d = leer('desbloq', []) || []; if (d.indexOf(id) < 0) { d.push(id); guardar('desbloq', d); }
    if (col) { var cs = leer('colonias', {}) || {}; if (cs[col]) { cs[col].naves = cs[col].naves || []; if (cs[col].naves.indexOf(id) < 0) cs[col].naves.push(id); guardar('colonias', cs); } }
  }
  A.puede = function (n, inv) { var c = A.NIVELES[A.nivelDe(n)].cost, k; for (k in c) if ((inv[k] || 0) < c[k]) return false; return true; };
  /* paga con el inventario `inv` (el mismo objeto del juego) y la pone en la cola */
  A.comprar = function (n, inv) {
    var s = est(), niv = A.NIVELES[A.nivelDe(n)], k;
    if (A.tiene(n.id) || s.cola.some(function (q) { return q.id === n.id; }) || s.viaje.some(function (q) { return q.id === n.id; })) return { ok: false, msg: 'Ya tienes esa nave (o ya viene en camino).' };
    if (!A.puede(n, inv)) return { ok: false, msg: 'Faltan materiales.' };
    for (k in niv.cost) inv[k] -= niv.cost[k]; guardar('inv', inv);
    s.cola.push({ id: n.id, fin: Date.now() + (leer('pruebas', false) ? 0 : niv.seg * 1000) }); guardar('astillero', s);
    return { ok: true, msg: 'Fabricación iniciada: ' + n.nombre };
  };
  A.entregarAqui = function (id) { var s = est(); s.cola = s.cola.filter(function (q) { return q.id !== id; }); guardar('astillero', s); dar(id); return 'Nave entregada en la estación'; };
  /* seg de viaje: distancia / 400 m/s, entre 1 y 15 minutos */
  A.enviar = function (id, colKey, dist) {
    var s = est(), cs = leer('colonias', {}) || {}; if (!cs[colKey]) return 'Esa colonia ya no existe';
    s.cola = s.cola.filter(function (q) { return q.id !== id; });
    var seg = Math.max(60, Math.min(900, Math.round((dist || 100000) / 400))); s.viaje.push({ id: id, col: colKey, fin: Date.now() + seg * 1000 }); guardar('astillero', s);
    return 'En camino a ' + cs[colKey].nombre + ' (' + A.fmt(seg * 1000) + '). Viaja protegida: nadie puede atacarla.';
  };
  A.fmt = function (ms) { var t = Math.max(0, Math.ceil(ms / 1000)), m = Math.floor(t / 60), s = t % 60; return m + ':' + (s < 10 ? '0' : '') + s; };
  A.listas = function () { var n = Date.now(); return est().cola.filter(function (q) { return q.fin <= n; }); };
  A.procesar = function () {
    var s = est(), n = Date.now(), llegan = s.viaje.filter(function (q) { return q.fin <= n; });
    if (!llegan.length) return [];
    s.viaje = s.viaje.filter(function (q) { return q.fin > n; }); guardar('astillero', s);
    llegan.forEach(function (q) { dar(q.id, q.col); }); if (A.onLlega) A.onLlega(llegan); return llegan;
  };
  setInterval(A.procesar, 4000);
})(window);
