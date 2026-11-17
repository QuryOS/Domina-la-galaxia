/* Espacio vivo: asteroides móviles, disparos, botín, piezas de nave y estaciones — parte del juego de naves */
(function (global) {
  'use strict';
  var E = global.JN = global.JN || {};
  var clamp = E.clamp, leer = E.leer, guardar = E.guardar, fbm = E.fbm, TAU = E.TAU;

  /* Tipos de asteroide móvil: los raros son más rápidos, más pequeños y dan mejor recurso. */
  var TIPOS = {
    hierro:  { n: 'Hierro',  c: 0x8a8f99, e: 0x000000, css: '#b4bac4', peso: 56, vel: [12, 38], r: [14, 48], hpK: 1.4, botin: [2, 4] },
    cobre:   { n: 'Cobre',   c: 0xb8683a, e: 0x1a0a02, css: '#e0894f', peso: 26, vel: [22, 55], r: [12, 38], hpK: 1.5, botin: [2, 4] },
    titanio: { n: 'Titanio', c: 0x8fb0cc, e: 0x06131f, css: '#8fd0ff', peso: 13, vel: [35, 70], r: [10, 30], hpK: 2.0, botin: [2, 3] },
    oro:     { n: 'Oro',     c: 0xe3b630, e: 0x3a2800, css: '#ffd447', peso: 5,  vel: [50, 95], r: [7, 18],  hpK: 1.7, botin: [1, 3] }
  };
  var ORDEN = ['hierro', 'cobre', 'titanio', 'oro'];
  var PRECIOS = { hierro: 6, cobre: 11, titanio: 28, oro: 75, piezas: 45 }, R_ATRAQUE = 520;
  var COLOR_PIEZA = { c: 0x9aa7b8, css: '#c9d6e6' };
  var R_TRACTOR = 450, MAX_AST = 26, R_SPAWN_MIN = 900, R_SPAWN_MAX = 2300, R_DESPAWN = 3300, MAX_DISP = 48, CADENCIA = 0.15, DANO = 12;

  function performance_now() { return (global.performance && global.performance.now) ? global.performance.now() : Date.now(); }
  function rnd(a, b) { return a + Math.random() * (b - a); }
  function elegirTipo() {
    var tot = 0, k, u; for (k = 0; k < ORDEN.length; k++) tot += TIPOS[ORDEN[k]].peso;
    u = Math.random() * tot; for (k = 0; k < ORDEN.length; k++) { u -= TIPOS[ORDEN[k]].peso; if (u <= 0) return ORDEN[k]; }
    return 'hierro';
  }

  function crear(ctx) {
    // ctx: { sc, P, V, Q, toast }   (P, V y Q son objetos vivos del mundo; aquí solo se leen)
    var sc = ctx.sc, P = ctx.P, V = ctx.V, Q = ctx.Q;
    var geos = [], mats = {}, ast = [], disp = [], bot = [], boom = [], estac = {}, fuego = false, enfr = 0, lado = 1, radio = 6, tDeb = 0, nuevo = true;
    var inv = leer('inv', null) || { hierro: 0, cobre: 0, titanio: 0, oro: 0, piezas: 0 };
    ['hierro', 'cobre', 'titanio', 'oro', 'piezas'].forEach(function (k) { if (typeof inv[k] !== 'number') inv[k] = 0; });
    var creditos = leer('cred', 0);
    var v1 = new THREE.Vector3(), v2 = new THREE.Vector3(), q1 = new THREE.Quaternion();
    var agarrando = false, cand = null, aro = null, rayo = null, geoBot, matBot, geoBot2, geoPza, matPza, geoPieza, matPieza;

    function iniciarRecursos() {
      if (geos.length) return;
      var v, i, g, p, x, y, z, f;
      for (v = 0; v < 4; v++) {
        g = new THREE.IcosahedronGeometry(1, 1); p = g.attributes.position;
        for (i = 0; i < p.count; i++) { x = p.getX(i); y = p.getY(i); z = p.getZ(i); f = 0.68 + 0.7 * fbm(x * 1.4 + v * 5.1 + 3, y * 1.4 + 3, z * 1.4 + 3, 311 + v, 3); p.setXYZ(i, x * f, y * f * 0.9, z * f); }
        g.computeVertexNormals(); geos.push(g);
      }
      ORDEN.forEach(function (k) { mats[k] = new THREE.MeshStandardMaterial({ color: TIPOS[k].c, emissive: TIPOS[k].e, roughness: k === 'oro' ? 0.45 : 0.9, metalness: k === 'oro' ? 0.8 : (k === 'hierro' ? 0.2 : 0.4), flatShading: true }); });
      geoBot = new THREE.BoxGeometry(1, 1, 1); matBot = new THREE.MeshBasicMaterial({ color: 0x7affea, toneMapped: false });
      geoPza = new THREE.OctahedronGeometry(1, 0);
      geoPieza = new THREE.BoxGeometry(1.6, 0.7, 2.6); matPieza = new THREE.MeshStandardMaterial({ color: COLOR_PIEZA.c, emissive: 0x0b2a3a, roughness: 0.5, metalness: 0.7, flatShading: true });
      aro = new THREE.Sprite(new THREE.SpriteMaterial({ map: E.glowTex, color: 0xffee88, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, transparent: true, toneMapped: false }));
      aro.visible = false; aro.frustumCulled = false; aro.renderOrder = 20; sc.add(aro);
      rayo = new THREE.Mesh(geoBot, new THREE.MeshBasicMaterial({ color: 0x74ffb0, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
      rayo.visible = false; rayo.frustumCulled = false; sc.add(rayo);
      for (i = 0; i < MAX_DISP; i++) {
        var m = new THREE.Mesh(geoBot, matBot); m.scale.set(0.9, 0.9, 16); m.visible = false; m.frustumCulled = false; sc.add(m);
        disp.push({ m: m, on: false, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, t: 0 });
      }
    }

    /* ----- asteroides móviles ----- */
    function nuevoAst(cerca) {
      var k = elegirTipo(), T = TIPOS[k], r = rnd(T.r[0], T.r[1]), d = cerca ? rnd(R_SPAWN_MIN, R_SPAWN_MAX) : rnd(R_DESPAWN * 0.8, R_DESPAWN * 0.95);
      v1.set(Math.random() - 0.5, (Math.random() - 0.5) * 0.7, Math.random() - 0.5).normalize();
      var a = { tipo: k, r: r, hp: r * T.hpK, hpMax: r * T.hpK, x: P.x + v1.x * d, y: P.y + v1.y * d, z: P.z + v1.z * d, rx: Math.random() * TAU, ry: Math.random() * TAU, rz: Math.random() * TAU, wx: rnd(-0.5, 0.5), wy: rnd(-0.5, 0.5), wz: rnd(-0.4, 0.4), flash: 0 };
      v2.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize().multiplyScalar(rnd(T.vel[0], T.vel[1]));
      if (!cerca) v2.addScaledVector(v1, -rnd(10, T.vel[1]));      // los que aparecen lejos tienden a cruzar la zona
      a.vx = v2.x; a.vy = v2.y; a.vz = v2.z;
      var m = new THREE.Mesh(geos[(Math.random() * geos.length) | 0], mats[k]); m.frustumCulled = false;
      a.sx = rnd(0.85, 1.2); a.sy = rnd(0.65, 1.0); a.sz = rnd(0.85, 1.2); a.m = m; sc.add(m);
      return a;
    }
    function quitarAst(i) { sc.remove(ast[i].m); ast.splice(i, 1); }

    /* ----- botín, explosiones ----- */
    function nuevoBotin(tipo, x, y, z, vx, vy, vz) {
      var m;
      if (tipo === 'piezas') { m = new THREE.Mesh(geoPieza, matPieza); m.scale.setScalar(2.4); }
      else { m = new THREE.Mesh(geoPza, new THREE.MeshStandardMaterial({ color: TIPOS[tipo].c, emissive: TIPOS[tipo].c, emissiveIntensity: 0.55, roughness: 0.4, metalness: 0.5, flatShading: true })); m.scale.set(2.2, 3.2, 2.2); }
      m.frustumCulled = false; sc.add(m);
      bot.push({ tipo: tipo, x: x, y: y, z: z, vx: vx, vy: vy, vz: vz, t: 150, m: m, rx: Math.random() * TAU, ry: Math.random() * TAU });
    }
    function explosion(x, y, z, r, color) {
      var s = new THREE.Sprite(new THREE.SpriteMaterial({ map: E.glowTex, color: color, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, toneMapped: false }));
      s.frustumCulled = false; sc.add(s); boom.push({ s: s, x: x, y: y, z: z, r: r * 3.4, t: 0 });
    }
    function romper(a) {
      var T = TIPOS[a.tipo], n = T.botin[0] + ((Math.random() * (T.botin[1] - T.botin[0] + 1)) | 0) + ((a.r / 22) | 0), i;
      explosion(a.x, a.y, a.z, a.r, a.tipo === 'oro' ? 0xffd060 : 0xffa860);
      for (i = 0; i < n; i++) nuevoBotin(a.tipo, a.x + rnd(-a.r, a.r) * 0.6, a.y + rnd(-a.r, a.r) * 0.6, a.z + rnd(-a.r, a.r) * 0.6, a.vx * 0.5 + rnd(-14, 14), a.vy * 0.5 + rnd(-14, 14), a.vz * 0.5 + rnd(-14, 14));
      if (Math.random() < 0.16) nuevoBotin('piezas', a.x, a.y, a.z, a.vx * 0.4 + rnd(-10, 10), a.vy * 0.4 + rnd(-10, 10), a.vz * 0.4 + rnd(-10, 10));
    }
    function recoger(b) {
      inv[b.tipo]++; guardar('inv', inv);
      var nom = b.tipo === 'piezas' ? 'Pieza de nave' : TIPOS[b.tipo].n;
      ctx.toast('+1 ' + nom.toUpperCase(), 0.7);
    }

    /* ----- disparos ----- */
    function disparar(fwd) {
      var d = null, i; for (i = 0; i < disp.length; i++) if (!disp[i].on) { d = disp[i]; break; }
      if (!d) return;
      v1.set(lado * radio * 0.28, -radio * 0.04, -radio * 0.75).applyQuaternion(Q); lado = -lado;
      d.x = P.x + v1.x; d.y = P.y + v1.y; d.z = P.z + v1.z;
      d.vx = V.x + fwd.x * 1300; d.vy = V.y + fwd.y * 1300; d.vz = V.z + fwd.z * 1300; d.t = 1.9; d.on = true; d.m.visible = true; d.m.quaternion.copy(Q);
    }

    /* ----- estaciones (las coloca el mundo; aquí se dibujan) ----- */
    function estaciones(lista) {
      var keep = {}, i, o, k;
      for (i = 0; i < lista.length; i++) {
        o = lista[i]; keep[o.key] = 1;
        if (!estac[o.key]) {
          var g = new THREE.Group(), mod = null;
          try { if (typeof global.createStation === 'function') mod = global.createStation(THREE, { accent: 0x1fd1b5, spin: 0.05 }); } catch (e) { mod = null; }
          if (mod && mod.group) { var w = new THREE.Group(); w.scale.setScalar(6); w.add(mod.group); g.add(w); }
          else { var an = new THREE.Mesh(new THREE.TorusGeometry(54, 6, 10, 36), new THREE.MeshStandardMaterial({ color: 0x9fb3c4, metalness: 0.6, roughness: 0.5 })); an.rotation.x = Math.PI / 2; g.add(an); }
          g.rotation.y = o.giro; g.frustumCulled = false; sc.add(g); estac[o.key] = { o: o, g: g, mod: mod };
        }
      }
      for (k in estac) if (!keep[k]) { sc.remove(estac[k].g); delete estac[k]; }
    }

    /* ----- ciclo ----- */
    function entrar(r) {
      iniciarRecursos(); radio = r || 6; limpiar();
      var i; for (i = 0; i < MAX_AST; i++) ast.push(nuevoAst(true));
      for (i = 0; i < 2; i++) piezaFlotante();
    }
    function limpiar() {
      cand = null; if (aro) aro.visible = false; if (rayo) rayo.visible = false;
      var i, k; for (i = ast.length - 1; i >= 0; i--) quitarAst(i);
      for (i = 0; i < bot.length; i++) sc.remove(bot[i].m); bot = [];
      for (i = 0; i < boom.length; i++) sc.remove(boom[i].s); boom = [];
      for (i = 0; i < disp.length; i++) { disp[i].on = false; disp[i].m.visible = false; }
      for (k in estac) sc.remove(estac[k].g); estac = {};
    }
    function piezaFlotante() {
      v1.set(Math.random() - 0.5, (Math.random() - 0.5) * 0.5, Math.random() - 0.5).normalize().multiplyScalar(rnd(700, 2200));
      nuevoBotin('piezas', P.x + v1.x, P.y + v1.y, P.z + v1.z, rnd(-6, 6), rnd(-6, 6), rnd(-6, 6));
    }
    function actualizar(dt, t, fwd) {
      var i, j, a, b, d, dx, dy, dz, rr;
      // disparos
      enfr -= dt; if (fuego && enfr <= 0) { enfr = CADENCIA; disparar(fwd); }
      for (i = 0; i < disp.length; i++) {
        d = disp[i]; if (!d.on) continue;
        d.t -= dt; if (d.t <= 0) { d.on = false; d.m.visible = false; continue; }
        var px = d.x, py = d.y, pz = d.z; d.x += d.vx * dt; d.y += d.vy * dt; d.z += d.vz * dt;
        for (j = 0; j < ast.length; j++) {
          a = ast[j]; rr = a.r + 3;
          // se prueba el punto medio y el final del tramo (el disparo avanza ~20 m por fotograma)
          var mx = (px + d.x) * 0.5, my = (py + d.y) * 0.5, mz = (pz + d.z) * 0.5;
          if (((d.x - a.x) * (d.x - a.x) + (d.y - a.y) * (d.y - a.y) + (d.z - a.z) * (d.z - a.z) < rr * rr * 0.85) || ((mx - a.x) * (mx - a.x) + (my - a.y) * (my - a.y) + (mz - a.z) * (mz - a.z) < rr * rr * 0.85)) {
            d.on = false; d.m.visible = false; a.hp -= DANO; a.flash = 0.12;
            explosion(d.x, d.y, d.z, 3, 0xffe2a0);
            if (a.hp <= 0) { romper(a); quitarAst(j); }
            break;
          }
        }
      }
      // asteroides
      for (i = ast.length - 1; i >= 0; i--) {
        a = ast[i]; a.x += a.vx * dt; a.y += a.vy * dt; a.z += a.vz * dt; a.rx += a.wx * dt; a.ry += a.wy * dt; a.rz += a.wz * dt; if (a.flash > 0) a.flash -= dt;
        dx = a.x - P.x; dy = a.y - P.y; dz = a.z - P.z;
        if (dx * dx + dy * dy + dz * dz > R_DESPAWN * R_DESPAWN) { quitarAst(i); ast.push(nuevoAst(false)); }
      }
      // botín + rayo tractor: se resalta lo agarrable que tienes cerca; con AGARRAR lo atraes a la parte de abajo de la nave
      v2.set(0, -radio * 0.55, 0).applyQuaternion(Q); var ux = P.x + v2.x, uy = P.y + v2.y, uz = P.z + v2.z, mejor = null, md = R_TRACTOR;
      for (i = bot.length - 1; i >= 0; i--) {
        b = bot[i]; b.t -= dt; dx = P.x - b.x; dy = P.y - b.y; dz = P.z - b.z; d = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (b.t <= 0 || d > 6000) { sc.remove(b.m); bot.splice(i, 1); if (cand === b) cand = null; continue; }
        if (d < radio * 0.7) { recoger(b); sc.remove(b.m); bot.splice(i, 1); if (cand === b) cand = null; continue; }   // al rozarlo también se recoge
        if (d < md) { md = d; mejor = b; }
        b.x += b.vx * dt; b.y += b.vy * dt; b.z += b.vz * dt; b.rx += dt * 1.4; b.ry += dt * 0.9;
      }
      cand = mejor;
      if (cand && agarrando) {
        dx = ux - cand.x; dy = uy - cand.y; dz = uz - cand.z; d = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
        var vel = Math.min(220, 35 + d * 0.9), kv = 1 - Math.exp(-dt * 5);
        cand.vx += (V.x + dx / d * vel - cand.vx) * kv; cand.vy += (V.y + dy / d * vel - cand.vy) * kv; cand.vz += (V.z + dz / d * vel - cand.vz) * kv;
        if (d < Math.max(5, radio * 0.4)) { recoger(cand); sc.remove(cand.m); bot.splice(bot.indexOf(cand), 1); cand = null; }
      }
      tDeb -= dt; if (tDeb <= 0) { tDeb = 25; var nPz = 0; for (i = 0; i < bot.length; i++) if (bot[i].tipo === 'piezas') nPz++; if (nPz < 3) piezaFlotante(); }
      // explosiones
      for (i = boom.length - 1; i >= 0; i--) { var e = boom[i]; e.t += dt; if (e.t > 0.55) { sc.remove(e.s); e.s.material.dispose(); boom.splice(i, 1); } }
      // estaciones
      for (var k2 in estac) { var s = estac[k2]; if (s.mod && s.mod.update) { try { s.mod.update(t, 0); } catch (er) { } } }
      colocar();
    }
    function colocar() {   // origen flotante: todo se coloca relativo a la nave
      var i, a, b, d, e, k, s, f;
      for (i = 0; i < ast.length; i++) { a = ast[i]; f = 1 + (a.flash > 0 ? 0.06 : 0); a.m.position.set(a.x - P.x, a.y - P.y, a.z - P.z); a.m.rotation.set(a.rx, a.ry, a.rz); a.m.scale.set(a.r * a.sx * f, a.r * a.sy * f, a.r * a.sz * f); }
      for (i = 0; i < bot.length; i++) { b = bot[i]; b.m.position.set(b.x - P.x, b.y - P.y, b.z - P.z); b.m.rotation.set(b.rx, b.ry, 0); }
      for (i = 0; i < disp.length; i++) { d = disp[i]; if (d.on) d.m.position.set(d.x - P.x, d.y - P.y, d.z - P.z); }
      for (i = 0; i < boom.length; i++) { e = boom[i]; var u = e.t / 0.55; e.s.position.set(e.x - P.x, e.y - P.y, e.z - P.z); e.s.scale.setScalar(e.r * (0.35 + u)); e.s.material.opacity = 1 - u; }
      if (aro) {
        if (cand) { aro.visible = true; aro.position.set(cand.x - P.x, cand.y - P.y, cand.z - P.z); aro.scale.setScalar((cand.tipo === 'piezas' ? 26 : 20) * (1 + 0.12 * Math.sin(performance_now() * 0.008))); aro.material.color.setHex(agarrando ? 0x74ffb0 : 0xffee88); } else aro.visible = false;
        if (cand && agarrando) {
          v1.set(0, -radio * 0.55, 0).applyQuaternion(Q); v2.set(cand.x - P.x - v1.x, cand.y - P.y - v1.y, cand.z - P.z - v1.z);
          var ln = v2.length(); rayo.visible = true; rayo.position.set(v1.x + v2.x * 0.5, v1.y + v2.y * 0.5, v1.z + v2.z * 0.5); rayo.lookAt(v1.x + v2.x, v1.y + v2.y, v1.z + v2.z); rayo.scale.set(0.5 + Math.random() * 0.4, 0.5 + Math.random() * 0.4, ln);
        } else rayo.visible = false;
      }
      for (k in estac) { s = estac[k]; s.g.position.set(s.o.x - P.x, s.o.y - P.y, s.o.z - P.z); }
    }
    function colisionar(R, impacto) {   // asteroides móviles son sólidos para la nave
      var i, a, dx, dy, dz, rr;
      for (i = 0; i < ast.length; i++) { a = ast[i]; dx = P.x - a.x; if (dx > 200 || dx < -200) continue; dy = P.y - a.y; dz = P.z - a.z; rr = a.r * 0.9 + R; if (dx * dx + dy * dy + dz * dz < rr * rr) impacto(a, dx, dy, dz, rr, a.vx, a.vy, a.vz); }
    }
    function estacionCerca() {   // estación a menos de R_ATRAQUE m del centro (el anillo mide ~110 m)
      var k, s, dx, dy, dz, d, mej = null, md = R_ATRAQUE;
      for (k in estac) { s = estac[k]; dx = s.o.x - P.x; dy = s.o.y - P.y; dz = s.o.z - P.z; d = Math.sqrt(dx * dx + dy * dy + dz * dz); if (d < md) { md = d; mej = s.o; } }
      return mej;
    }
    function vender(tipo) {
      var n = inv[tipo] || 0, g = n * (PRECIOS[tipo] || 0); if (n <= 0) return 0;
      inv[tipo] = 0; creditos += g; guardar('inv', inv); guardar('cred', creditos); return g;
    }
    function venderTodo() { var t = 0, k; for (k in PRECIOS) t += vender(k); return t; }
    function nombreTipo(k) { return k === 'piezas' ? 'Piezas de nave' : TIPOS[k].n; }
    function colorTipo(k) { return k === 'piezas' ? COLOR_PIEZA.css : TIPOS[k].css; }
    function radar() {
      var l = [], i;
      for (i = 0; i < ast.length; i++) l.push({ x: ast[i].x, y: ast[i].y, z: ast[i].z, c: TIPOS[ast[i].tipo].css, r: 2.2 });
      for (i = 0; i < bot.length; i++) l.push({ x: bot[i].x, y: bot[i].y, z: bot[i].z, c: bot[i].tipo === 'piezas' ? COLOR_PIEZA.css : TIPOS[bot[i].tipo].css, r: 1.4 });
      return l;
    }
    function textoInv() {
      var s = '', k; for (k = 0; k < ORDEN.length; k++) s += '<span style="color:' + TIPOS[ORDEN[k]].css + '">' + TIPOS[ORDEN[k]].n + ' ' + inv[ORDEN[k]] + '</span> · ';
      return s + '<span style="color:' + COLOR_PIEZA.css + '">Piezas ' + inv.piezas + '</span>';
    }
    return {
      entrar: entrar, limpiar: limpiar, actualizar: actualizar, estaciones: estaciones, colisionar: colisionar, radar: radar, textoInv: textoInv, inv: inv,
      fuego: function (v) { fuego = v; }, agarrar: function (v) { agarrando = v; }, estacionCerca: estacionCerca, vender: vender, venderTodo: venderTodo, precios: PRECIOS, creditos: function () { return creditos; }, nombreTipo: nombreTipo, colorTipo: colorTipo, _ast: ast, _bot: function () { return bot; }, _nuevoAst: nuevoAst
    };
  }
  E.Espacio = { crear: crear, TIPOS: TIPOS };
})(window);
