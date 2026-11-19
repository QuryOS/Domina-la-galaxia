/* Adaptadores de las defensas (muro de piedra, portón y torreta futurista) para el planeta.
   Cargan los modelos originales (muro_piedra.js, porton_piedra.js, torreta_futurista.js) sin tocarlos y
   fusionan sus cientos de bloques en pocas mallas para que no den lag. Unidades: 1 = 1 metro (esc = 1). */
(function (global) {
  'use strict';
  function fusionar(g, saltar) {   // junta todas las mallas del grupo que comparten material en una sola
    saltar = saltar || []; g.updateMatrixWorld(true);
    var inv = new THREE.Matrix4().copy(g.matrixWorld).invert(), lst = [], por = [];
    (function rec(n) {
      if (saltar.indexOf(n) >= 0) return;
      if (n.isMesh && n.geometry && n.material && !Array.isArray(n.material)) lst.push(n);
      for (var i = 0; i < n.children.length; i++) rec(n.children[i]);
    })(g);
    lst.forEach(function (m) {
      var k = -1, j; for (j = 0; j < por.length; j++) if (por[j].mat === m.material) { k = j; break; }
      if (k < 0) { por.push({ mat: m.material, ms: [] }); k = por.length - 1; } por[k].ms.push(m);
    });
    por.forEach(function (p) {
      var pos = [], nor = [], idx = [], off = 0;
      p.ms.forEach(function (m) {
        m.updateMatrixWorld(true);
        var mt = new THREE.Matrix4().multiplyMatrices(inv, m.matrixWorld), ge = m.geometry.clone().applyMatrix4(mt), pa = ge.attributes.position.array, na = ge.attributes.normal ? ge.attributes.normal.array : null, n = ge.attributes.position.count, i;
        for (i = 0; i < pa.length; i++) pos.push(pa[i]);
        if (na) for (i = 0; i < na.length; i++) nor.push(na[i]);
        if (ge.index) { var ia = ge.index.array; for (i = 0; i < ia.length; i++) idx.push(ia[i] + off); } else for (i = 0; i < n; i++) idx.push(i + off);
        off += n; ge.dispose(); if (m.parent) m.parent.remove(m);
      });
      var G = new THREE.BufferGeometry(); G.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      if (nor.length === pos.length) G.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
      G.setIndex(idx); if (nor.length !== pos.length) G.computeVertexNormals();
      g.add(new THREE.Mesh(G, p.mat));
    });
  }
  function fantasma(root) {   // tinte verde/rojo al colocar
    var mats = []; root.traverse(function (m) { if (m.isMesh && m.material && mats.indexOf(m.material) < 0) mats.push(m.material); });
    var estado = null;
    return function (on, ok) {
      var clave = on ? (ok ? 'v' : 'r') : 'n'; if (clave === estado) return; estado = clave;
      mats.forEach(function (m) {
        if (!m._o) m._o = { t: m.transparent, o: m.opacity, e: m.emissive ? m.emissive.getHex() : 0 };
        if (on) { m.transparent = true; m.opacity = 0.6; if (m.emissive) m.emissive.setHex(ok ? 0x0a4a1a : 0x5a0a0a); }
        else { m.transparent = m._o.t; m.opacity = m._o.o; if (m.emissive) m.emissive.setHex(m._o.e); }
        m.needsUpdate = true;
      });
    };
  }
  function noop() { }
  global.createDefMuro = function (T) {
    var r = global.createStoneWall(T), p0 = r.children[0], p1 = r.children[1];
    fusionar(p0); fusionar(p1); fusionar(r, [p0, p1]);
    return { group: r, defensa: 'muro', footprint: { w: 7, d: 7 }, update: noop, setGhost: fantasma(r), pilar: function (i) { return r.children[i]; } };
  };
  global.createDefPorton = function (T) {
    var r = global.createGate(T), u = r.userData, p0 = r.children[0], p1 = r.children[1], hojas = r.children.filter(function (c) { return c.isGroup && Math.abs(Math.abs(c.position.x) - 1.5) < 1e-6; });
    fusionar(p0); fusionar(p1); hojas.forEach(function (h) { fusionar(h); }); fusionar(r, [p0, p1].concat(hojas));
    return { group: r, defensa: 'porton', footprint: { w: 7, d: 7 }, update: noop, setOpen: u.setOpen, setGhost: fantasma(r), pilar: function (i) { return r.children[i]; } };
  };
  global.createDefTorretaF = function (T) {
    var r = global.createTurret(T), u = r.userData;
    fusionar(r, [u.yaw]); fusionar(u.yaw, [u.pitch]);
    u.yaw.rotation.y = 0; u.pitch.rotation.x = -0.15; r.scale.setScalar(0.62);   // cabe sobre la columna (2 × 2 m)
    return { group: r, defensa: 'torretaf', footprint: { w: 2, d: 2 }, update: noop, setGhost: fantasma(r), yaw: u.yaw, pitch: u.pitch, muzzle: u.muzzle, fire: u.fire };
  };
})(window);
