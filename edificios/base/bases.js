/* Adaptadores de las bases de metal para el juego: devuelven { group, edges, setGhost, update, setAccent }.
   Las bases miden 3 m en el modelo; el juego las escala a 50 m de lado (= distancia entre columnas de un muro). */
(function (global) {
  'use strict';
  function envolver(root) {
    var mats = [], orig = [];
    root.traverse(function (m) { if (m.isMesh && m.material) { (Array.isArray(m.material) ? m.material : [m.material]).forEach(function (q) { if (mats.indexOf(q) < 0) { mats.push(q); orig.push({ c: q.emissive ? q.emissive.getHex() : 0, i: q.emissiveIntensity }); } }); } });
    return {
      group: root, edges: root.userData.edges, shape: root.userData.shape, topY: root.userData.topY,
      update: function () { }, setAccent: function () { },
      setGhost: function (on, valid) {
        mats.forEach(function (q, k) {
          q.transparent = !!on; q.opacity = on ? 0.45 : 1; q.depthWrite = !on;
          if (q.emissive) { if (on) { q.emissive.setHex(valid === false ? 0xff2a2a : 0x25ff7a); q.emissiveIntensity = 0.5; } else { q.emissive.setHex(orig[k].c); q.emissiveIntensity = orig[k].i; } }
          q.needsUpdate = true;
        });
      }
    };
  }
  global.createBaseMetalC = function (THREE) { return envolver(global.createMetalFoundationSquare(THREE)); };
  global.createBaseMetalT = function (THREE) { return envolver(global.createMetalFoundationTriangle(THREE)); };
  global.createBaseDuroC = function (THREE) { return envolver(global.createArmoredFoundationSquare(THREE)); };
  global.createBaseDuroT = function (THREE) { return envolver(global.createArmoredFoundationTriangle(THREE)); };
})(window);
