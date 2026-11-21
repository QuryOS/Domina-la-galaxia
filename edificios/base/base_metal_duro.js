/*
  BASE DE METAL DURO (blindada)
  - Unidades: 1 = 1 metro. Cuadrada de 3 x 3 o triangular equilatera de lado 3, centrada en X/Z
    y apoyada en y = 0. La cara superior es plana y queda en y = 0.8.
  - Este archivo registra dos modelos: la base cuadrada y la base triangular.
  - userData: shape ('square' | 'triangle'), size, height, topY,
              edges -> lista de { x, z, angle, length }: punto medio de cada borde y su giro hacia afuera.
                       Sirve para pegar muros o portones:
                       muro.position.set(x, topY, z); muro.rotation.y = angle;
*/
function createArmoredFoundation(THREE, shape) {
  const S = 3;                                   // lado de la base
  const TOP = 0.8;                               // altura de la cara superior
  const tri = shape === 'triangle';
  const R = S / Math.sqrt(3);                    // centro -> vertice del triangulo
  const verts = tri
    ? [[0, R], [S / 2, -R / 2], [-S / 2, -R / 2]]
    : [[-S / 2, -S / 2], [S / 2, -S / 2], [S / 2, S / 2], [-S / 2, S / 2]];
  const INR = tri ? R / 2 : S / 2;               // centro -> borde
  const zmin = tri ? -R / 2 : -S / 2;
  const zmax = tri ? R : S / 2;

  let seed = 505;
  function rnd() {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  const std = (color, rough, metal) => new THREE.MeshStandardMaterial({ color, roughness: rough == null ? 0.95 : rough, metalness: metal || 0 });
  const box = new THREE.BoxGeometry(1, 1, 1);
  const root = new THREE.Group();
  root.name = 'BaseMetalDuro';

  function put(m, parent, x, y, z) {
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  }
  function addBox(parent, mat, sx, sy, sz, x, y, z) {
    const m = new THREE.Mesh(box, mat);
    m.scale.set(sx, sy, sz);
    return put(m, parent, x, y, z);
  }
  function add(parent, geo, mat, x, y, z) {
    return put(new THREE.Mesh(geo, mat), parent, x, y, z);
  }

  // Acerca un punto [x, z] al centro una distancia d
  function inward(p, d) {
    const k = 1 - d / INR;
    return [p[0] * k, p[1] * k];
  }

  // Mitad del ancho (en X) de la base a una altura z del plano
  function halfWidthAt(z) {
    if (!tri) return S / 2;
    return (S / 2) * Math.max(R - z, 0) / (1.5 * R);
  }

  // Recorre los bordes. Cada uno trae su punto medio y un giro tal que el eje +Z local mira hacia afuera.
  function eachEdge(fn) {
    for (let i = 0; i < verts.length; i++) {
      const a = verts[i], b = verts[(i + 1) % verts.length];
      const dx = b[0] - a[0], dz = b[1] - a[1];
      const mx = (a[0] + b[0]) / 2, mz = (a[1] + b[1]) / 2;
      let ang = Math.atan2(-dz, dx);
      if (Math.sin(ang) * mx + Math.cos(ang) * mz < 0) ang += Math.PI;
      fn({ len: Math.hypot(dx, dz), mx, mz, ang });
    }
  }
  function edgeGroup(e) {
    const g = new THREE.Group();
    g.position.set(e.mx, 0, e.mz);
    g.rotation.y = e.ang;
    root.add(g);
    return g;
  }

  // Prisma con la forma de la base, encogido "inset" desde los bordes, de altura h (arranca en y = 0)
  function prism(inset, h) {
    const k = 1 - inset / INR;
    const sh = new THREE.Shape();
    verts.forEach((v, i) => {
      if (i === 0) sh.moveTo(v[0] * k, -v[1] * k);
      else sh.lineTo(v[0] * k, -v[1] * k);
    });
    const g = new THREE.ExtrudeGeometry(sh, { depth: h, bevelEnabled: false });
    g.rotateX(-Math.PI / 2);
    return g;
  }
  function prismMesh(mat, inset, h, y0) {
    return put(new THREE.Mesh(prism(inset, h), mat), root, 0, y0, 0);
  }

  // Recorre filas a lo largo de X cubriendo la cara superior: fn(z, x0, x1)
  function rows(step, inset, fn) {
    for (let z = zmin + inset + step / 2; z <= zmax - inset - step / 2 + 1e-6; z += step) {
      const half = halfWidthAt(z) - inset;
      if (half > 0.05) fn(z, -half, half);
    }
  }

  // ---------- Modelo ----------
  const armor = std(0x2b3038, 0.45, 0.85);
  const armorLight = std(0x474f5c, 0.4, 0.85);
  const boltMat = std(0x7d8796, 0.35, 0.9);
  const boltGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.05, 6);
  boltGeo.rotateX(Math.PI / 2);

  // Tres capas de blindaje que se van encogiendo hacia arriba, y una cubierta
  const layers = [[0, 0, 0.27], [0.04, 0.27, 0.27], [0.08, 0.54, 0.18]];   // [encogido, y, alto]
  layers.forEach(l => prismMesh(armor, l[0], l[2], l[1]));
  prismMesh(armorLight, 0.12, 0.08, 0.72);

  // Bandas y pernos grandes en cada capa
  eachEdge(e => {
    const g = edgeGroup(e);
    layers.forEach(l => {
      const inset = l[0], y0 = l[1], h = l[2];
      addBox(g, armorLight, e.len - 0.5, 0.05, 0.05, 0, y0 + 0.025, -inset + 0.01);
      const n = Math.max(2, Math.floor((e.len - 0.6) / 0.4) + 1);
      for (let i = 0; i < n; i++) {
        const b = new THREE.Mesh(boltGeo, boltMat);
        b.position.set(-((n - 1) * 0.4) / 2 + i * 0.4, y0 + h * 0.55, -inset + 0.015);
        g.add(b);
      }
    });
  });

  // Columnas hexagonales en las esquinas
  verts.forEach(v => {
    const p = inward(v, 0.14);
    add(root, new THREE.CylinderGeometry(0.24, 0.27, 0.72, 6), armorLight, p[0], 0.36, p[1]);
  });

  // Nervaduras gruesas sobre la cubierta
  rows(0.22, 0.16, (z, x0, x1) => {
    addBox(root, armorLight, x1 - x0, 0.03, 0.09, (x0 + x1) / 2, TOP + 0.015, z);
  });

  const edges = [];
  eachEdge(e => edges.push({ x: e.mx, z: e.mz, angle: e.ang, length: e.len }));
  root.userData = { shape, size: S, height: TOP, topY: TOP, edges };
  return root;
}

function createArmoredFoundationSquare(THREE) { return createArmoredFoundation(THREE, 'square'); }
function createArmoredFoundationTriangle(THREE) { return createArmoredFoundation(THREE, 'triangle'); }

if (typeof registerModel === 'function') {
  registerModel('Base de metal duro (cuadrada)', createArmoredFoundationSquare);
  registerModel('Base de metal duro (triangular)', createArmoredFoundationTriangle);
}
