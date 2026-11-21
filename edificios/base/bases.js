/* Adaptadores de las bases de metal para el juego: devuelven { group, edges, setGhost, update, setAccent }.
   Las bases miden 3 m en el modelo; el juego las escala a 50 m de lado (= distancia entre columnas de un muro). */
(function (global) {
  'use strict';
  /* Une todas las piezas pequeñas de la base en pocas mallas (una por material): de ~400 llamadas de dibujo a ~7. Es lo que quita el lag. */
  function fusionar(THREE, root) {
    var lista = [], grupos = [], i, j, k;
    root.updateMatrixWorld(true);
    var inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
    root.traverse(function (m) { if (m.isMesh && !m.isSkinnedMesh && !m.isInstancedMesh && m.geometry && m.geometry.attributes.position && !Array.isArray(m.material)) lista.push(m); });
    lista.forEach(function (m) {
      var g = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone(), mt = new THREE.Matrix4().multiplyMatrices(inv, m.matrixWorld), neg = mt.determinant() < 0;
      g.applyMatrix4(mt);
      var e = null; for (j = 0; j < grupos.length; j++) if (grupos[j].mat === m.material) { e = grupos[j]; break; }
      if (!e) { e = { mat: m.material, gs: [], neg: [] }; grupos.push(e); } e.gs.push(g); e.neg.push(neg);
    });
    lista.forEach(function (m) { if (m.parent) m.parent.remove(m); });
    grupos.forEach(function (e) {
      var nv = 0; e.gs.forEach(function (g) { nv += g.attributes.position.count; });
      var P = new Float32Array(nv * 3), N = new Float32Array(nv * 3), U = new Float32Array(nv * 2), o = 0;
      e.gs.forEach(function (g, q) {
        var c = g.attributes.position.count, a = g.attributes.position.array, b = g.attributes.normal ? g.attributes.normal.array : null, u = g.attributes.uv ? g.attributes.uv.array : null;
        P.set(a, o * 3); if (b) N.set(b, o * 3); if (u) U.set(u, o * 2);
        if (e.neg[q]) { for (k = 0; k + 2 < c; k += 3) { var x, t; for (x = 0; x < 3; x++) { t = P[(o + k + 1) * 3 + x]; P[(o + k + 1) * 3 + x] = P[(o + k + 2) * 3 + x]; P[(o + k + 2) * 3 + x] = t; t = N[(o + k + 1) * 3 + x]; N[(o + k + 1) * 3 + x] = N[(o + k + 2) * 3 + x]; N[(o + k + 2) * 3 + x] = t; } } }
        o += c;
      });
      var G = new THREE.BufferGeometry(); G.setAttribute('position', new THREE.BufferAttribute(P, 3)); G.setAttribute('normal', new THREE.BufferAttribute(N, 3)); G.setAttribute('uv', new THREE.BufferAttribute(U, 2));
      var M = new THREE.Mesh(G, e.mat); M.castShadow = true; M.receiveShadow = true; M.name = 'base_fusion'; root.add(M);
    });
    return root;
  }
  function envolver(THREE, root) {
    try { fusionar(THREE, root); } catch (ef) { if (global.console) console.error('fusionar base', ef); }
    var S = 3, TOP = root.userData.topY || 0.8, gg;   // el "fantasma" es un solo bloque simple: dibujar la base entera transparente (miles de caras superpuestas) es lo que mataba los FPS
    if (root.userData.shape === 'triangle') { var Rr = S / Math.sqrt(3), sh = new THREE.Shape(); sh.moveTo(0, -Rr); sh.lineTo(S / 2, Rr / 2); sh.lineTo(-S / 2, Rr / 2); gg = new THREE.ExtrudeGeometry(sh, { depth: TOP, bevelEnabled: false }); gg.rotateX(-Math.PI / 2); }
    else { gg = new THREE.BoxGeometry(S, TOP, S); gg.translate(0, TOP / 2, 0); }
    var gm = new THREE.Mesh(gg, new THREE.MeshBasicMaterial({ color: 0x25ff7a, transparent: true, opacity: 0.5, depthWrite: false })); gm.visible = false; gm.name = 'base_fantasma'; root.add(gm);
    return {
      group: root, edges: root.userData.edges, shape: root.userData.shape, topY: root.userData.topY,
      update: function () { }, setAccent: function () { },
      setGhost: function (on, valid) {
        root.children.forEach(function (c) { if (c !== gm && c.isMesh && c.name !== 'colision_base') c.visible = !on; });
        gm.visible = !!on; if (on) gm.material.color.setHex(valid === false ? 0xff2a2a : 0x25ff7a);
      }
    };
  }
  global.createBasePiedraC = function (THREE) { return envolver(THREE, global.createStoneFoundationSquare(THREE)); };
  global.createBasePiedraT = function (THREE) { return envolver(THREE, global.createStoneFoundationTriangle(THREE)); };
  global.createBaseMetalC = function (THREE) { return envolver(THREE, global.createMetalFoundationSquare(THREE)); };
  global.createBaseMetalT = function (THREE) { return envolver(THREE, global.createMetalFoundationTriangle(THREE)); };
  global.createBaseDuroC = function (THREE) { return envolver(THREE, global.createArmoredFoundationSquare(THREE)); };
  global.createBaseDuroT = function (THREE) { return envolver(THREE, global.createArmoredFoundationTriangle(THREE)); };
})(window);
