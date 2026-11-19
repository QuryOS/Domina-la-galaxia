/*
  PORTÓN: pilar de piedra + portón de dos hojas + pilar de piedra
  - Unidades: 1 = 1 metro. Largo total 7 (igual que el muro de piedra), a lo largo del eje X,
    centrado en X/Z y apoyado en y = 0. Los pilares son iguales a los del muro de piedra.
  - Las dos hojas son de acero con remaches y una luz de cierre en el centro
    (naranja = cerrado, cian = abierto). Abren hacia -Z.
  - Tablita de código visual en el pilar o poste derecho (cara +Z).
  - userData:
      length, height (pilares), mounts [izquierdo, derecho]
      setOpen(v) -> v de 0 (cerrado) a 1 (abierto del todo); llámalo desde tu lógica del juego
      update(t, dt) -> animación de prueba que abre y cierra solo; en el juego no la uses
*/
function createGate(THREE) {
  const SIZE = 2;
  const COURSES = 4;
  const COURSE_H = 0.6;
  const BASE_H = 0.3;
  const CORE = SIZE / 2 - 0.14;
  const POST_X = 2.5;
  const GATE_L = 3.1;       // luz entre pilares (se mete un poco en ellos)
  const LEAF_W = 1.5;
  const LEAF_H = 2.45;
  const LEAF_Y0 = 0.1;
  const HINGE_X = 1.5;
  const MAX_ANGLE = 1.75;   // radianes (unos 100°)

  let seed = 20240611;
  function rnd() {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  const stones = [0x7d7f85, 0x6f7177, 0x8a8a8c, 0x65686f, 0x777470, 0x82838a].map(c =>
    new THREE.MeshStandardMaterial({ color: c, roughness: 0.95, metalness: 0 })
  );
  const mortar = new THREE.MeshStandardMaterial({ color: 0x2c2d31, roughness: 1, metalness: 0 });
  const darkStone = new THREE.MeshStandardMaterial({ color: 0x55585e, roughness: 1, metalness: 0 });
  const capStone = new THREE.MeshStandardMaterial({ color: 0x909195, roughness: 0.9, metalness: 0 });
  const steel = new THREE.MeshStandardMaterial({ color: 0x2c3544, metalness: 0.85, roughness: 0.34 });
  const plateDark = new THREE.MeshStandardMaterial({ color: 0x12161d, metalness: 0.9, roughness: 0.45 });
  const plate = new THREE.MeshStandardMaterial({ color: 0x5b687c, metalness: 0.8, roughness: 0.3 });
  const lockMat = new THREE.MeshStandardMaterial({ color: 0xff7a1a, emissive: 0xff5a00, emissiveIntensity: 1.3, metalness: 0.2, roughness: 0.4 });

  const box = new THREE.BoxGeometry(1, 1, 1);
  const rivetGeo = new THREE.SphereGeometry(0.03, 8, 6);
  const root = new THREE.Group();
  root.name = 'Porton';

  function addBox(parent, mat, sx, sy, sz, x, y, z) {
    const m = new THREE.Mesh(box, mat);
    m.scale.set(sx, sy, sz);
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  }

  function layBlocks(face, range, n, y, courseH, coreHalf) {
    const weights = Array.from({ length: n }, () => 0.7 + rnd() * 0.6);
    const total = weights.reduce((a, b) => a + b, 0);
    let cursor = -range / 2;
    weights.forEach(w => {
      const len = (w / total) * range;
      const depth = 0.14 + rnd() * 0.05;
      const h = courseH * (0.9 + rnd() * 0.06);
      const mat = stones[Math.floor(rnd() * stones.length)];
      const m = addBox(face, mat, len * 0.96, h, depth,
        cursor + len / 2, y + (rnd() - 0.5) * 0.02, coreHalf + depth / 2 - 0.02);
      m.rotation.z = (rnd() - 0.5) * 0.03;
      cursor += len;
    });
  }

  // ---------- Pilares de piedra (parte superior plana) ----------
  const mounts = [];
  let pillarH = 0;
  function buildPillar(x) {
    const p = new THREE.Group();
    p.position.x = x;
    root.add(p);

    addBox(p, darkStone, SIZE + 0.3, BASE_H * 0.75, SIZE + 0.3, 0, BASE_H * 0.375, 0);
    addBox(p, darkStone, SIZE + 0.14, BASE_H * 0.4, SIZE + 0.14, 0, BASE_H * 0.75 + BASE_H * 0.2 - 0.02, 0);

    const bodyH = COURSES * COURSE_H;
    addBox(p, mortar, CORE * 2, bodyH, CORE * 2, 0, BASE_H + bodyH / 2, 0);

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
    addBox(p, capStone, SIZE + 0.24, capH, SIZE + 0.24, 0, topY + capH / 2, 0);

    const mH = 0.36;
    const mPos = SIZE / 2 - 0.2;
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => {
      addBox(p, capStone, 0.58, mH, 0.58, sx * mPos, topY + capH + mH / 2, sz * mPos);
    });

    const mount = new THREE.Object3D();
    mount.name = 'MontajeTorreta';
    mount.position.set(0, topY + capH, 0);
    p.add(mount);
    mounts.push(mount);
    pillarH = topY + capH + mH;
  }
  buildPillar(-POST_X);
  buildPillar(POST_X);

  // ---------- Dintel de piedra sobre el portón ----------
  const lintelY = 2.735, lintelH = 0.37, lintelHalf = 0.36;
  addBox(root, mortar, GATE_L, lintelH, lintelHalf * 2, 0, lintelY, 0);
  [0, 1].forEach(side => {
    const face = new THREE.Group();
    face.rotation.y = side * Math.PI;
    root.add(face);
    layBlocks(face, GATE_L, 3, lintelY, lintelH, lintelHalf);
  });

  // Umbral
  addBox(root, darkStone, GATE_L, 0.1, 1.2, 0, 0.05, 0);
  addKeypad(root, 2.0, 1.2, 0.98);

  // Tablita para el código (solo visual); mira hacia +Z
  function addKeypad(parent, x, y, z, backMat) {
    const body = new THREE.MeshStandardMaterial({ color: 0x1b2028, metalness: 0.8, roughness: 0.4 });
    const keyMat = new THREE.MeshStandardMaterial({ color: 0x8a97a8, metalness: 0.6, roughness: 0.4 });
    const screen = new THREE.MeshStandardMaterial({ color: 0x00e5ff, emissive: 0x00e5ff, emissiveIntensity: 1.2, roughness: 0.3 });
    const g = new THREE.Group();
    g.position.set(x, y, z);
    parent.add(g);
    let zb = 0;
    if (backMat) { addBox(g, backMat, 0.42, 0.58, 0.05, 0, 0, 0.025); zb = 0.05; }
    addBox(g, body, 0.3, 0.44, 0.05, 0, 0, zb + 0.025);
    addBox(g, screen, 0.2, 0.07, 0.012, 0, 0.15, zb + 0.056);
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 3; c++) addBox(g, keyMat, 0.055, 0.04, 0.014, (c - 1) * 0.075, 0.06 - r * 0.062, zb + 0.057);
    }
    return g;
  }

  // ---------- Hojas del portón ----------
  function buildLeaf(dir) {                      // dir = +1 se extiende hacia +X, -1 hacia -X
    const g = new THREE.Group();                 // el origen es la bisagra
    const cx = dir * LEAF_W / 2;
    const cy = LEAF_Y0 + LEAF_H / 2;

    addBox(g, steel, 0.16, LEAF_H, 0.22, dir * 0.08, cy, 0);
    addBox(g, steel, 0.16, LEAF_H, 0.22, dir * (LEAF_W - 0.08), cy, 0);
    addBox(g, steel, LEAF_W, 0.16, 0.22, cx, LEAF_Y0 + 0.08, 0);
    addBox(g, steel, LEAF_W, 0.16, 0.22, cx, LEAF_Y0 + LEAF_H - 0.08, 0);
    addBox(g, plateDark, LEAF_W - 0.2, LEAF_H - 0.2, 0.1, cx, cy, 0);

    [0.3, 0.5, 0.7].forEach(f => {               // bandas de refuerzo con remaches
      const y = LEAF_Y0 + LEAF_H * f;
      addBox(g, plate, LEAF_W - 0.1, 0.12, 0.26, cx, y, 0);
      for (let i = 0; i < 5; i++) {
        const rx = dir * (0.22 + i * (LEAF_W - 0.44) / 4);
        [-1, 1].forEach(s => {
          const r = new THREE.Mesh(rivetGeo, plate);
          r.position.set(rx, y, s * 0.135);
          g.add(r);
        });
      }
    });

    addBox(g, lockMat, 0.05, LEAF_H - 0.6, 0.27, dir * (LEAF_W - 0.2), cy, 0);   // luz de cierre
    return g;
  }

  const leftLeaf = buildLeaf(1);
  leftLeaf.position.x = -HINGE_X;
  root.add(leftLeaf);
  const rightLeaf = buildLeaf(-1);
  rightLeaf.position.x = HINGE_X;
  root.add(rightLeaf);

  function setOpen(v) {
    v = Math.min(Math.max(v, 0), 1);
    leftLeaf.rotation.y = v * MAX_ANGLE;
    rightLeaf.rotation.y = -v * MAX_ANGLE;
    lockMat.emissive.setHex(v > 0.02 ? 0x00e5ff : 0xff5a00);
    lockMat.color.setHex(v > 0.02 ? 0x00e5ff : 0xff7a1a);
  }

  function update(t) {                           // demo: abre y cierra con pausas
    const s = 0.5 + 0.5 * Math.sin(t * 0.7 - Math.PI / 2);
    const v = Math.min(Math.max((s - 0.15) / 0.7, 0), 1);
    setOpen(v * v * (3 - 2 * v));
  }

  setOpen(0);
  root.userData = { length: 7, height: pillarH, mounts, setOpen, update };
  return root;
}

if (typeof registerModel === 'function') registerModel('Portón de piedra y metal', createGate);
