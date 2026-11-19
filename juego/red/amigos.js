/* Amigos P2P (PeerJS, gratis): ID fijo guardado en el teléfono + lista de amigos + estado en línea.
   El servicio público de PeerJS solo hace de "casillero" para encontrarse; los datos van directos entre teléfonos. */
(function (global) {
  'use strict';
  var E = global.JN = global.JN || {};
  var URL_PEER = 'https://unpkg.com/peerjs@1.5.4/dist/peerjs.min.js';
  var leer = E.leer, guardar = E.guardar;
  var A = { peer: null, listo: false, cargando: false, error: '', nombre: '', conex: {}, enLinea: {}, nombres: {}, ultimo: {}, onCambio: null, _t: 0 };

  function nuevoId() { var s = '', c = 'abcdefghjkmnpqrstuvwxyz23456789', i; for (i = 0; i < 6; i++) s += c.charAt(Math.floor(Math.random() * c.length)); return 'jn-' + s; }
  function lim(id) { return String(id || '').toLowerCase().replace(/[^a-z0-9\-]/g, '').slice(0, 20); }
  function avisar() { if (A.onCambio) { try { A.onCambio(); } catch (e) { } } }
  A.id = function () { var id = leer('miId', ''); if (!id) { id = nuevoId(); guardar('miId', id); } return id; };
  A.amigos = function () { return leer('amigos', []) || []; };
  A.pendientes = function () { return leer('amigosPend', []) || []; };
  function esAmigo(id) { return A.amigos().some(function (a) { return a.id === id; }); }
  function guardaAmigos(l) { guardar('amigos', l); }
  A.agregar = function (id, nombre) {
    id = lim(id); if (!id || id === A.id()) return 'ESE ID NO ES VÁLIDO';
    if (esAmigo(id)) return 'YA ES TU AMIGO';
    var l = A.amigos(); l.push({ id: id, nombre: nombre || id }); guardaAmigos(l);
    guardar('amigosPend', A.pendientes().filter(function (p) { return p.id !== id; })); conectarCon(id); avisar(); return '';
  };
  A.aceptar = function (id) { var p = A.pendientes().filter(function (q) { return q.id === id; })[0]; A.agregar(id, p && p.nombre); };
  A.rechazar = function (id) { guardar('amigosPend', A.pendientes().filter(function (p) { return p.id !== id; })); avisar(); };
  A.quitar = function (id) { guardaAmigos(A.amigos().filter(function (a) { return a.id !== id; })); var c = A.conex[id]; if (c) { try { c.close(); } catch (e) { } } delete A.conex[id]; delete A.enLinea[id]; avisar(); };
  A.saludar = function (id) { var c = A.conex[id]; if (c && c.open) { try { c.send({ t: 'saludo', nombre: A.nombre }); } catch (e) { } return true; } return false; };
  A.enviar = function (id, o) { var c = A.conex[id]; if (c && c.open) { try { c.send(o); } catch (e) { } return true; } return false; };

  function registra(c) {   // una conexión (entrante o saliente) con otro jugador
    var id = c.peer;
    if (A.conex[id] && A.conex[id] !== c && A.conex[id].open) { try { c.close(); } catch (e) { } return; }
    A.conex[id] = c;
    function abierta() { try { c.send({ t: 'hola', nombre: A.nombre }); } catch (e) { } }
    c.on('open', function () { A.enLinea[id] = true; abierta(); avisar(); });
    c.on('data', function (m) {
      if (!m || typeof m !== 'object') return;
      if (m.t === 'hola') {
        var nm = String(m.nombre || id).replace(/[<>]/g, '').slice(0, 16); A.nombres[id] = nm;
        if (esAmigo(id)) { var l = A.amigos(); l.forEach(function (a) { if (a.id === id) a.nombre = nm; }); guardaAmigos(l); }
        else { var p = A.pendientes(); if (!p.some(function (q) { return q.id === id; })) { p.push({ id: id, nombre: nm }); guardar('amigosPend', p); } }
        avisar();
      } else if (m.t === 'saludo' && esAmigo(id)) { A.ultimo[id] = '👋 ' + String(m.nombre || '').slice(0, 16) + ' te saluda'; avisar(); if (A.onSaludo) A.onSaludo(id, m); }
      else if (A.onMensaje && esAmigo(id)) A.onMensaje(id, m);
    });
    function cerrada() { if (A.conex[id] === c) { delete A.conex[id]; A.enLinea[id] = false; avisar(); } }
    c.on('close', cerrada); c.on('error', cerrada);
  }
  function conectarCon(id) {
    if (!A.listo || !A.peer || A.conex[id]) return;
    try { var c = A.peer.connect(id, { reliable: true }); registra(c); } catch (e) { }
  }
  function reintentar() {   // cada pocos segundos busca a los amigos que no están conectados
    if (!A.listo) return; A.amigos().forEach(function (a) { var c = A.conex[a.id]; if (!c || (!c.open && c._t0 && Date.now() - c._t0 > 12000)) { if (c) { try { c.close(); } catch (e) { } delete A.conex[a.id]; } conectarCon(a.id); if (A.conex[a.id]) A.conex[a.id]._t0 = Date.now(); } });
  }
  function crearPeer() {
    var P = global.Peer; if (!P) return;
    try { A.peer = new P(A.id()); } catch (e) { A.error = 'No se pudo iniciar la red'; avisar(); return; }
    A.peer.on('open', function () { A.listo = true; A.error = ''; avisar(); reintentar(); });
    A.peer.on('connection', registra);
    A.peer.on('disconnected', function () { A.listo = false; avisar(); try { A.peer.reconnect(); } catch (e) { } });
    A.peer.on('error', function (er) {
      var t = er && er.type; if (t === 'peer-unavailable') return;   // ese amigo no está en línea
      if (t === 'unavailable-id') { A.error = 'Tu ID sigue registrado, reintentando…'; try { A.peer.destroy(); } catch (e) { } A.listo = false; setTimeout(crearPeer, 6000); }
      else if (t === 'network' || t === 'server-error' || t === 'socket-error' || t === 'socket-closed') { A.error = 'Sin conexión con el servicio de amigos'; A.listo = false; }
      else A.error = 'Error de red: ' + (t || '?');
      avisar();
    });
  }
  A.iniciar = function (nombre) {
    A.nombre = nombre || A.nombre || 'Piloto';
    if (A.peer || A.cargando) return;
    if (global.Peer) { crearPeer(); } else {
      A.cargando = true; A.error = ''; avisar();
      E.cargarScript(URL_PEER, function () { A.cargando = false; crearPeer(); avisar(); }, function () { A.cargando = false; A.error = 'No se pudo cargar la red (¿sin internet?)'; avisar(); });
    }
    if (!A._t) A._t = setInterval(reintentar, 8000);
  };
  A.reintentarRed = function () { if (A.peer) { try { A.peer.destroy(); } catch (e) { } A.peer = null; A.listo = false; A.conex = {}; A.enLinea = {} } A.iniciar(A.nombre); };
  E.Amigos = A;
})(window);
