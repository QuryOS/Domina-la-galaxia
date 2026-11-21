/* Gusanos devoradores: primer monstruo del juego. Viven bajo el suelo, van hacia una estructura, atacan de 1 a 4 veces (de vez en cuando) y se van.
   Usa personajes/criatura_gusano.js (tu archivo del visor) a través de un pequeño "registerCreature". */
(function (global) {
  'use strict';
  var E = global.JN, G = E.Gusanos = {};
  var CFG = { escala: 1, ataqueDist: 45, danioMin: 20, danioMax: 32, radioGolpe: 12, vel: 14, velLenta: 3.5 };
  var THREE_ = null, ctx = null, lista = [], def = null, cargando = false, tSpawn = 0, tRep = 0, tGlobal = 0;
  global.registerCreature = global.registerCreature || function (d) { E.criaturas = E.criaturas || {}; E.criaturas[d.id] = d; };
  function sm(x) { x = x < 0 ? 0 : x > 1 ? 1 : x; return x * x * (3 - 2 * x); }
  function wrap(a) { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; }
  function rotPt(th, x, z) { var c = Math.cos(th), s = Math.sin(th); return [x * c + z * s, -x * s + z * c]; }
  function maxGusanos() { return ctx.minero ? 4 : 1; }
  function proxima() { return ctx.minero ? 80 + Math.random() * 100 : 240 + Math.random() * 300; }
  function cargar(cb) {
    if (def) return cb(true); if (E.criaturas && E.criaturas.gusano) { def = E.criaturas.gusano; return cb(true); }
    if (cargando) return; cargando = true;
    E.cargarScript(E.CONFIG.rutaPersonajes + 'criatura_gusano.js', function () { cargando = false; def = E.criaturas && E.criaturas.gusano; cb(!!def); }, function () { cargando = false; cb(false); });
  }
  function objetivos() {
    var l = ctx.estructuras(), out = [], i, o, now = Date.now();
    for (i = 0; i < l.length; i++) { o = l[i]; if (o.fin && o.fin > now) continue; out.push({ o: o, w: (o.item.defensa === 'muro' || o.item.defensa === 'porton') ? 3 : 1 }); }
    return out;
  }
  function elegir() {
    var l = objetivos(), tot = 0, i; for (i = 0; i < l.length; i++) tot += l[i].w; if (!tot) return null;
    var u = Math.random() * tot; for (i = 0; i < l.length; i++) { u -= l[i].w; if (u <= 0) return l[i].o; } return l[0].o;
  }
  function centro() {
    var l = ctx.estructuras(), x = 0, z = 0, n = 0, i; for (i = 0; i < l.length; i++) { x += l[i].x; z += l[i].z; n++; }
    if (!n) { var j = ctx.jugador(); return { x: j.x, z: j.z }; } return { x: x / n, z: z / n };
  }
  function distRect(o, x, z) {
    var dx = x - o.x, dz = z - o.z, c = Math.cos(o.rot || 0), s = Math.sin(o.rot || 0), lx = dx * c - dz * s, lz = dx * s + dz * c, hw = o.hw != null ? o.hw : o.r, hd = o.hd != null ? o.hd : o.r;
    return Math.hypot(Math.max(Math.abs(lx) - hw, 0), Math.max(Math.abs(lz) - hd, 0));
  }
  function crear(cb) {
    cargar(function (ok) {
      if (!ok) return cb(null);
      var api = null; try { api = def.build(THREE_, { V: function (x, y, z) { return new THREE_.Vector3(x, y, z); }, smooth: sm }); } catch (e) { if (global.console) console.error('Gusano', e); return cb(null); }
      cb(api);
    });
  }
  function aparecer() {
    if (lista.length >= maxGusanos() || lista.spawning) return; lista.spawning = true;
    crear(function (api) {
      lista.spawning = false; if (!api || !ctx) return;
      var c = centro(), a = Math.random() * Math.PI * 2, d = 420 + Math.random() * 130, x0 = c.x + Math.sin(a) * d, z0 = c.z + Math.cos(a) * d;
      var w = { api: api, g: new THREE_.Group(), x0: x0, z0: z0, yaw0: Math.atan2(c.x - x0, c.z - z0), x: x0, z: z0, yaw: 0, est: 'ir', obj: null, hits: 0, max: 1 + Math.floor(Math.random() * 4), sp: 3.5, ph: 0, u: 0, atq: false, golpeado: false, t: 0, esp: 0 };
      w.g.add(api.root); ctx.sc.add(w.g); w.g.scale.setScalar(CFG.escala); w.obj = elegir(); lista.push(w);
      if (ctx.aviso) ctx.aviso('ALGO SE MUEVE BAJO EL SUELO…', 3);
    });
  }
  function quitar(w) { if (w.g.parent) w.g.parent.remove(w.g); var i = lista.indexOf(w); if (i >= 0) lista.splice(i, 1); tSpawn = proxima(); }
  function golpe(w) {   // la cabeza se clava en el suelo: daña lo que tenga justo delante
    var hx = w.x + Math.sin(w.yaw) * 3 * CFG.escala, hz = w.z + Math.cos(w.yaw) * 3 * CFG.escala, l = ctx.estructuras(), i, o, n = 0, now = Date.now();
    for (i = 0; i < l.length; i++) { o = l[i]; if (o.fin && o.fin > now) continue; if (distRect(o, hx, hz) < CFG.radioGolpe * CFG.escala) { ctx.danio(o, CFG.danioMin + Math.random() * (CFG.danioMax - CFG.danioMin)); n++; } }
    if (ctx.golpe) ctx.golpe(w.x, w.z, n);
  }
  function paso(w, dt) {
    w.t += dt; var api = w.api, tgt = w.obj, des = w.yaw0 + api.pose.yaw, c = centro(), dx, dz, d, err, want = 0, spT = CFG.vel, steer = 0, p;
    // posición y rumbo actuales en el mundo
    p = rotPt(w.yaw0, api.pose.x * CFG.escala, api.pose.z * CFG.escala); w.x = w.x0 + p[0]; w.z = w.z0 + p[1]; w.yaw = w.yaw0 + api.pose.yaw;
    if (w.est === 'irse') { want = Math.atan2(w.x - c.x, w.z - c.z); if (Math.hypot(w.x - c.x, w.z - c.z) > 900) { quitar(w); return; } }
    else {
      if (!tgt || ctx.estructuras().indexOf(tgt) < 0) { w.obj = tgt = elegir(); }
      if (!tgt) { want = w.yaw + 0.01; spT = CFG.velLenta; w.esp += dt; if (w.esp > 40) w.est = 'irse'; }
      else { dx = tgt.x - w.x; dz = tgt.z - w.z; d = Math.hypot(dx, dz); want = Math.atan2(dx, dz); err = wrap(want - w.yaw);
        if (!w.atq && w.est === 'ir' && d < CFG.ataqueDist && Math.abs(err) < 0.5) { w.atq = true; w.u = 0; w.golpeado = false; spT = CFG.velLenta; }
        if (w.est === 'ir' && d < 140 && !w.atq) spT = 9; }
    }
    steer = Math.max(-0.8, Math.min(0.8, 2 * wrap(want - w.yaw)));
    w.sp += Math.max(-dt * 8, Math.min(dt * 8, spT - w.sp));
    var rate = w.sp >= 3.5 ? 1.2 + (w.sp - 3.5) * (2.8 / 10.5) : 1.2 * w.sp / 3.5; w.ph += rate * dt;
    if (w.atq) { w.u += dt; if (!w.golpeado && w.u >= 6.45) { w.golpeado = true; golpe(w); } if (w.u >= 8) { w.atq = false; w.hits++; w.u = 0; if (w.hits >= w.max) w.est = 'irse'; else w.obj = elegir(); } }
    api.update({ t: tGlobal, sp: w.atq ? 3.5 : w.sp, mode: w.atq ? 'attack' : 'walk', dt: dt, ph: w.ph, u: w.u, mouth: 0.25, steer: steer });
    p = rotPt(w.yaw0, api.pose.x * CFG.escala, api.pose.z * CFG.escala);
    w.g.position.set(w.x0 + p[0], 0, w.z0 + p[1]); w.g.rotation.y = w.yaw0 + api.pose.yaw;
  }
  G.iniciar = function (c) {
    G.detener(); THREE_ = global.THREE; ctx = c; tSpawn = 50 + Math.random() * 70; tRep = 0; tGlobal = 0; lista = [];
    cargar(function () { });   // descarga el archivo desde ya
  };
  G.actualizar = function (dt) {
    if (!ctx) return; tGlobal += dt; dt = Math.min(dt, 0.1);
    if (lista.length < maxGusanos() && !lista.spawning && ctx.estructuras().length) { tSpawn -= dt; if (tSpawn <= 0) { tSpawn = 5; aparecer(); } }
    for (var i = lista.length - 1; i >= 0; i--) { try { paso(lista[i], dt); } catch (e) { if (global.console) console.error(e); quitar(lista[i]); } }
    tRep -= dt; if (tRep <= 0) { tRep = 5; ctx.reparar(); }
  };
  G.detener = function () { var i; for (i = lista.length - 1; i >= 0; i--) if (lista[i].g.parent) lista[i].g.parent.remove(lista[i].g); lista = []; ctx = null; };
  G.cfg = CFG; G.lista = function () { return lista; };
  G.forzar = function () { if (ctx) { tSpawn = 0; aparecer(); } };   // para pruebas
})(window);
