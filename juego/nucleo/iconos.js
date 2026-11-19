/* Iconos SVG (recursos y acciones), cuadros de inventario y miniaturas reales de los modelos 3D. */
(function (global) {
  'use strict';
  var E = global.JN = global.JN || {};
  var el = E.el;
  var RES = {   // recursos: figuras sencillas y reconocibles
    piedra: { n: 'Piedra', c: '#c3c6cc', svg: '<path d="M4 17l2-7 5-4 6 2 3 6-3 5H8z" fill="#8d9097" stroke="#d6d9de"/><path d="M6 10l5-4M11 6l1 6-4 5M12 12l5 5M17 8l-5 4" stroke="#5d6066" fill="none"/>' },
    hierro: { n: 'Hierro', c: '#b4bac4', svg: '<path d="M3 15l3-6h12l3 6z" fill="#8b929d" stroke="#d3d8e0"/><path d="M3 15v3h18v-3" fill="#69707b" stroke="#aab1bc"/><path d="M8 9l-1 6M16 9l1 6" stroke="#c9cfd8" fill="none"/>' },
    cobre: { n: 'Cobre', c: '#e0894f', svg: '<path d="M3 15l3-6h12l3 6z" fill="#c4713c" stroke="#f0b088"/><path d="M3 15v3h18v-3" fill="#8f4f27" stroke="#d48a57"/><path d="M8 9l-1 6M16 9l1 6" stroke="#f3b78f" fill="none"/>' },
    titanio: { n: 'Titanio', c: '#8fd0ff', svg: '<path d="M12 3l6 5-2 10-4 3-4-3-2-10z" fill="#6aa5cf" stroke="#c4e8ff"/><path d="M12 3v18M6 8l6 4 6-4M8 18l4-6 4 6" stroke="#dff3ff" fill="none" stroke-opacity=".7"/>' },
    oro: { n: 'Oro', c: '#ffd447', svg: '<path d="M4 16l3-6 5-3 6 3 2 6-4 3H8z" fill="#e3b630" stroke="#fff0a8"/><path d="M7 10l5 3 6-3M12 13v7" stroke="#fff6c4" fill="none" stroke-opacity=".8"/>' },
    piezas: { n: 'Trozos metálicos', c: '#c9d6e6', svg: '<path d="M4 8l6-3 4 4-2 4 6 1-3 5H7z" fill="#7c8a9c" stroke="#c9d6e6"/><circle cx="10" cy="13" r="1.6" fill="#44505f"/><path d="M14 9l5-2" stroke="#c9d6e6"/>' },
    credito: { n: 'Toristina', c: '#ffe27a', svg: '<circle cx="12" cy="12" r="8" fill="#e6b83a" stroke="#fff1a8" stroke-width="1.5"/><path d="M8 8h8M12 8v8M9.5 16h5" stroke="#6b4a00" stroke-width="1.8" fill="none"/>' }
  };
  var ACC = {   // acciones de la flota
    llamar: '<circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="8"/><path d="M12 1v4M12 19v4M1 12h4M19 12h4"/>',
    pilotar: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="2.5"/><path d="M12 14.5V21M9.8 11L4 8.5M14.2 11L20 8.5"/>',
    minar: '<path d="M3 20l8-8M10 4c5-1 9 2 10 6-3-1-5 0-7 2l-3-3c0-2 1-4 0-5z"/>',
    seguir: '<path d="M4 8h10M11 4l4 4-4 4M20 16H10M13 12l-4 4 4 4"/>',
    estacion: '<circle cx="12" cy="12" r="3.5"/><path d="M12 2v6.5M12 15.5V22M2 12h6.5M15.5 12H22M5 5l4.5 4.5M14.5 14.5L19 19M19 5l-4.5 4.5M9.5 14.5L5 19"/>',
    parar: '<rect x="6" y="6" width="12" height="12" rx="2"/>',
    viajar: '<path d="M3 12h14M13 6l6 6-6 6"/>'
  };
  function svg(clave, px, col) {
    px = px || 24;
    if (RES[clave]) return '<svg viewBox="0 0 24 24" width="' + px + '" height="' + px + '" stroke-width="1.2" stroke-linejoin="round">' + RES[clave].svg + '</svg>';
    return '<svg viewBox="0 0 24 24" width="' + px + '" height="' + px + '" fill="none" stroke="' + (col || 'currentColor') + '" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">' + (ACC[clave] || '') + '</svg>';
  }
  /* cuadro: imagen arriba, nombre y cantidad abajo; opcional botón debajo */
  function cuadro(padre, o) {
    var d = el('div', 'jn-cuad' + (o.cls ? ' ' + o.cls : ''), padre), im = el('div', 'jn-cuad-im', d);
    if (o.html) im.innerHTML = o.html; else if (o.icono) im.innerHTML = svg(o.icono, 44);
    if (o.badge != null) el('span', 'jn-cuad-n', im, String(o.badge));
    el('b', '', d, o.titulo || ''); if (o.sub) el('small', '', d, o.sub);
    return d;
  }
  /* miniatura real: dibuja un modelo 3D en una imagen pequeña (usa el mismo renderer, sin crear otro contexto) */
  var cacheMini = {};
  function miniatura(clave, crear, px) {
    if (cacheMini[clave]) return cacheMini[clave];
    var r = E.renderer; if (!r || !crear) return '';
    px = px || 160; var obj = null, rt = null, out = '';
    try {
      obj = crear(); if (!obj) return '';
      var sc = new THREE.Scene(); sc.add(new THREE.HemisphereLight(0xffffff, 0x556677, 1.15)); var dl = new THREE.DirectionalLight(0xffffff, 1.8); dl.position.set(3, 6, 4); sc.add(dl); sc.add(obj); obj.updateMatrixWorld(true);
      var b = new THREE.Box3().setFromObject(obj), c = b.getCenter(new THREE.Vector3()), sz = b.getSize(new THREE.Vector3()), rad = Math.max(sz.x, sz.y, sz.z) * 0.5 || 1;
      var cam = new THREE.PerspectiveCamera(35, 1, rad * 0.05, rad * 60), dist = rad / Math.sin(17.5 * Math.PI / 180) * 1.0;
      cam.position.set(c.x + dist * 0.62, c.y + dist * 0.4, c.z + dist * 0.67); cam.lookAt(c);
      rt = new THREE.WebGLRenderTarget(px, px); try { rt.texture.encoding = THREE.sRGBEncoding; } catch (e0) { }
      var old = r.getRenderTarget(), oc = new THREE.Color(), oa = r.getClearAlpha(); r.getClearColor(oc);
      r.setRenderTarget(rt); r.setClearColor(0x000000, 0); r.clear(); r.render(sc, cam); r.setRenderTarget(old); r.setClearColor(oc, oa);
      var buf = new Uint8Array(px * px * 4); r.readRenderTargetPixels(rt, 0, 0, px, px, buf);
      var cv = document.createElement('canvas'); cv.width = cv.height = px; var g = cv.getContext('2d'), im = g.createImageData(px, px), y, x2;
      for (y = 0; y < px; y++) for (x2 = 0; x2 < px * 4; x2++) im.data[y * px * 4 + x2] = buf[(px - 1 - y) * px * 4 + x2];
      g.putImageData(im, 0, 0); out = cv.toDataURL('image/png');
    } catch (e) { out = ''; }
    try { if (rt) rt.dispose(); } catch (e1) { }
    cacheMini[clave] = out; return out;
  }
  E.Iconos = { RES: RES, svg: svg, cuadro: cuadro, miniatura: miniatura };
})(window);
