/*
  MURO DE PIEDRA: pilar + pared + pilar
  - Unidades: 1 = 1 metro. Se extiende a lo largo del eje X, centrado en X/Z y apoyado en y = 0.
  - Pilares de 2 x 2 y unos 3.3 de alto (parte superior plana, listos para la torreta).
    La pared del medio mide 3 de largo, 1 de grosor y unos 2.3 de alto, más baja que los pilares.
  - userData:
      length       -> largo total del muro (pilar + pared + pilar)
      height       -> altura de los pilares
      panelHeight  -> altura de la pared
      mounts       -> [montaje izquierdo, montaje derecho]: Object3D en lo alto de cada pilar
*/
function createStoneWall(THREE) {
  const SIZE = 2;            // lado del pilar
  const COURSES = 4;         // hileras del pilar
  const COURSE_H = 0.6;
  const BASE_H = 0.3;
  const CORE = SIZE / 2 - 0.14;

  const PANEL_L = 3;         // largo de la pared entre pilares
  const PANEL_T = 1;         // grosor de la pared
  const PANEL_COURSES = 3;   // hileras de la pared
  const PANEL_CORE = PANEL_T / 2 - 0.14;

  let seed = 20240611;
  function rnd() {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  const stones = [0x7d7f85, 0x6f7177, 0x8a8a8c, 0x65686f, 0x777470, 0x82838a].map(c =>
    new THREE.MeshStandardMaterial({ color: c, roughness: 0.95, metalness: 0.0 })
  );
  const mortar = new THREE.MeshStandardMaterial({ color: 0x2c2d31, roughness: 1, metalness: 0 });
  const darkStone = new THREE.MeshStandardMaterial({ color: 0x55585e, roughness: 1, metalness: 0 });
  const capStone = new THREE.MeshStandardMaterial({ color: 0x909195, roughness: 0.9, metalness: 0 });

  const box = new THREE.BoxGeometry(1, 1, 1);
  const root = new THREE.Group();
  root.name = 'MuroPiedra';

  function add(parent, mat, sx, sy, sz, x, y, z) {
    const m = new THREE.Mesh(box, mat);
    m.scale.set(sx, sy, sz);
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  }

  // Reparte una cara en bloques de ancho irregular y los coloca en el grupo de la cara
  function layBlocks(face, range, n, y, courseH, coreHalf) {
    const weights = Array.from({ length: n }, () => 0.7 + rnd() * 0.6);
    const total = weights.reduce((a, b) => a + b, 0);
    let cursor = -range / 2;
    weights.forEach(w => {
      const len = (w / total) * range;
      const depth = 0.14 + rnd() * 0.05;
      const h = courseH * (0.9 + rnd() * 0.06);
      const mat = stones[Math.floor(rnd() * stones.length)];
      const m = add(face, mat, len * 0.96, h, depth,
        cursor + len / 2, y + (rnd() - 0.5) * 0.02, coreHalf + depth / 2 - 0.02);
      m.rotation.z = (rnd() - 0.5) * 0.03;
      cursor += len;
    });
  }

  // ---------- Pilar (parte superior plana) ----------
  const mounts = [];
  function buildPillar(x) {
    const p = new THREE.Group();
    p.position.x = x;
    root.add(p);

    add(p, darkStone, SIZE + 0.3, BASE_H * 0.75, SIZE + 0.3, 0, BASE_H * 0.375, 0);
    add(p, darkStone, SIZE + 0.14, BASE_H * 0.4, SIZE + 0.14, 0, BASE_H * 0.75 + BASE_H * 0.2 - 0.02, 0);

    const bodyH = COURSES * COURSE_H;
    add(p, mortar, CORE * 2, bodyH, CORE * 2, 0, BASE_H + bodyH / 2, 0);

    for (let c = 0; c < COURSES; c++) {
      const y = BASE_H + c * COURSE_H + COURSE_H / 2;
      for (let f = 0; f < 4; f++) {
        const face = new THREE.Group();
        face.rotation.y = f * Math.PI / 2;
        p.add(face);
        const long = (f % 2) === (c % 2);
        const range = long ? SIZE : SIZE - 0.34;
        const n = long ? (rnd() < 0.5 ? 3 : 4) : 2 + Math.floor(rnd() * 2);
        layBlocks(face, range, n, y, COURSE_H, CORE);
      }
    }

    const topY = BASE_H + bodyH;
    const capH = 0.22;
    add(p, capStone, SIZE + 0.24, capH, SIZE + 0.24, 0, topY + capH / 2, 0);

    const mH = 0.36;
    const mPos = SIZE / 2 - 0.2;
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => {
      add(p, capStone, 0.58, mH, 0.58, sx * mPos, topY + capH + mH / 2, sz * mPos);
    });

    const mount = new THREE.Object3D();
    mount.name = 'MontajeTorreta';
    mount.position.set(0, topY + capH, 0);
    p.add(mount);
    mounts.push(mount);

    return topY + capH + mH;
  }

  const pillarX = PANEL_L / 2 + SIZE / 2;
  const pillarH = buildPillar(-pillarX);
  buildPillar(pillarX);

  // ---------- Pared entre los pilares ----------
  const panelBodyH = PANEL_COURSES * COURSE_H;
  const panelBaseH = BASE_H * 0.75;

  add(root, darkStone, PANEL_L + 0.2, panelBaseH, PANEL_T + 0.3, 0, panelBaseH / 2, 0);   // zócalo de la pared
  // El cuerpo arranca sobre el zócalo, alineado con las hileras del pilar
  add(root, mortar, PANEL_L + 0.2, panelBodyH, PANEL_CORE * 2, 0, BASE_H + panelBodyH / 2, 0);
  add(root, darkStone, PANEL_L + 0.2, BASE_H - panelBaseH + 0.02, PANEL_T + 0.1, 0, panelBaseH + (BASE_H - panelBaseH) / 2, 0);

  for (let c = 0; c < PANEL_COURSES; c++) {
    const y = BASE_H + c * COURSE_H + COURSE_H / 2;
    [0, 1].forEach(side => {
      const face = new THREE.Group();
      face.rotation.y = side * Math.PI;         // una cara hacia +Z y otra hacia -Z
      root.add(face);
      const n = (c % 2 === 0) ? 3 : 4;
      layBlocks(face, PANEL_L + 0.2, n, y, COURSE_H, PANEL_CORE);
    });
  }

  // Remate plano de la pared
  const panelTop = BASE_H + panelBodyH;
  const panelCapH = 0.2;
  add(root, capStone, PANEL_L + 0.2, panelCapH, PANEL_T + 0.2, 0, panelTop + panelCapH / 2, 0);

  root.userData = {
    length: PANEL_L + SIZE * 2,
    height: pillarH,
    panelHeight: panelTop + panelCapH,
    mounts
  };
  return root;
}

if (typeof registerModel === 'function') registerModel('Muro de piedra (pilar, pared, pilar)', createStoneWall);
