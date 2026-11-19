/*
  TORRETA FUTURISTA (un solo cañón)
  - Unidades: 1 = 1 metro. La base queda en y = 0 y el cañón apunta hacia +Z.
  - Para tu juego, el grupo devuelto trae en userData:
      yaw      -> Group que gira en horizontal (rotation.y)
      pitch    -> Group que sube/baja el cañón (rotation.x, negativo = apunta hacia arriba)
      muzzle   -> Object3D en la punta del cañón (de aquí salen los disparos)
      fire()   -> dispara la animación de retroceso y destello
      update(t, dt) -> animación de prueba (patrulla y dispara); en el juego no la uses
*/
function createTurret(THREE) {
  const root = new THREE.Group();
  root.name = 'TorretaFuturista';

  // ---------- Materiales ----------
  const hull  = new THREE.MeshStandardMaterial({ color: 0x2c3544, metalness: 0.85, roughness: 0.34 });
  const dark  = new THREE.MeshStandardMaterial({ color: 0x12161d, metalness: 0.9,  roughness: 0.45 });
  const plate = new THREE.MeshStandardMaterial({ color: 0x5b687c, metalness: 0.8,  roughness: 0.3 });
  const glow  = new THREE.MeshStandardMaterial({ color: 0x00e5ff, emissive: 0x00e5ff, emissiveIntensity: 1.6, metalness: 0.2, roughness: 0.3 });
  const warn  = new THREE.MeshStandardMaterial({ color: 0xff7a1a, emissive: 0xff5a00, emissiveIntensity: 0.9, metalness: 0.3, roughness: 0.4 });

  function add(parent, geo, mat, x, y, z) {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x || 0, y || 0, z || 0);
    m.castShadow = true;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  }
  // Cilindro cuyo eje apunta a lo largo de Z
  function cylZ(rTop, rBot, len, seg) {
    const g = new THREE.CylinderGeometry(rTop, rBot, len, seg);
    g.rotateX(Math.PI / 2);
    return g;
  }

  // ---------- Base fija ----------
  add(root, new THREE.CylinderGeometry(1.5, 1.72, 0.35, 8), dark, 0, 0.175, 0);          // zócalo octagonal
  const baseRing = add(root, new THREE.TorusGeometry(1.36, 0.035, 8, 64), glow, 0, 0.37, 0);
  baseRing.rotation.x = Math.PI / 2;
  add(root, new THREE.CylinderGeometry(0.95, 1.18, 0.5, 8), hull, 0, 0.6, 0);             // pedestal
  for (let i = 0; i < 8; i++) {                                                           // anclajes naranjas
    const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
    add(root, new THREE.BoxGeometry(0.22, 0.1, 0.12), warn, Math.sin(a) * 1.58, 0.3, Math.cos(a) * 1.58).rotation.y = a;
  }
  add(root, new THREE.CylinderGeometry(1.02, 1.02, 0.12, 32), plate, 0, 0.91, 0);         // anillo de giro

  // ---------- Torre giratoria (yaw) ----------
  const yaw = new THREE.Group();
  yaw.position.y = 0.97;
  root.add(yaw);

  add(yaw, new THREE.CylinderGeometry(0.9, 0.95, 0.18, 8), dark, 0, 0.09, 0);             // plato giratorio
  add(yaw, new THREE.CylinderGeometry(0.72, 0.92, 0.62, 6), hull, 0, 0.49, -0.1);         // cuerpo hexagonal

  // Módulos laterales con franja de luz
  [-1, 1].forEach(s => {
    const pod = add(yaw, new THREE.BoxGeometry(0.34, 0.5, 0.85), plate, s * 0.82, 0.55, -0.15);
    pod.rotation.z = -s * 0.14;
    add(yaw, new THREE.BoxGeometry(0.03, 0.07, 0.62), glow, s * 0.99, 0.6, -0.15).rotation.z = -s * 0.14;
  });

  // Domo de sensores trasero y antena
  const dome = add(yaw, new THREE.SphereGeometry(0.24, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), dark, 0, 0.8, -0.5);
  add(yaw, new THREE.SphereGeometry(0.1, 16, 12), glow, 0, 0.9, -0.42);
  add(yaw, new THREE.CylinderGeometry(0.012, 0.012, 0.6, 6), plate, 0.3, 1.05, -0.62);
  add(yaw, new THREE.SphereGeometry(0.035, 8, 8), warn, 0.3, 1.36, -0.62);

  // Mejillas que sostienen el cañón
  const PIVOT = new THREE.Vector3(0, 0.9, 0.3);
  [-1, 1].forEach(s => {
    add(yaw, new THREE.BoxGeometry(0.16, 0.8, 0.85), plate, s * 0.5, 0.8, 0.3);
    const axle = add(yaw, new THREE.CylinderGeometry(0.17, 0.17, 0.08, 16), dark, s * 0.6, PIVOT.y, PIVOT.z);
    axle.rotation.z = Math.PI / 2;
    const cap = add(yaw, new THREE.CylinderGeometry(0.09, 0.09, 0.05, 16), glow, s * 0.65, PIVOT.y, PIVOT.z);
    cap.rotation.z = Math.PI / 2;
  });

  // ---------- Cañón (pitch) ----------
  const pitch = new THREE.Group();
  pitch.position.copy(PIVOT);
  yaw.add(pitch);

  add(pitch, new THREE.BoxGeometry(0.62, 0.52, 0.95), hull, 0, 0, 0.12);                  // recámara
  add(pitch, new THREE.BoxGeometry(0.5, 0.06, 0.5), warn, 0, 0.29, 0.1);                  // placa de advertencia
  add(pitch, cylZ(0.21, 0.26, 0.9, 12), dark, 0, 0, 0.95);                                // funda del cañón

  // Parte que retrocede al disparar
  const barrel = new THREE.Group();
  pitch.add(barrel);
  add(barrel, cylZ(0.095, 0.11, 2.5, 16), plate, 0, 0, 2.05);                             // tubo
  for (let i = 0; i < 5; i++) {                                                            // aletas de enfriamiento
    add(barrel, cylZ(0.17, 0.17, 0.06, 16), dark, 0, 0, 1.45 + i * 0.28);
  }
  [-1, 1].forEach(s => {                                                                   // rieles de energía
    add(barrel, new THREE.BoxGeometry(0.035, 0.035, 1.5), glow, s * 0.15, 0, 2.2);
    add(barrel, new THREE.BoxGeometry(0.035, 0.035, 1.5), glow, 0, s * 0.15, 2.2);
  });
  add(barrel, cylZ(0.17, 0.15, 0.4, 12), dark, 0, 0, 3.3);                                // freno de boca
  add(barrel, cylZ(0.18, 0.18, 0.05, 16), glow, 0, 0, 3.2);
  add(barrel, cylZ(0.06, 0.06, 0.02, 12), glow, 0, 0, 3.51);                              // núcleo emisor

  const muzzle = new THREE.Object3D();
  muzzle.position.set(0, 0, 3.55);
  barrel.add(muzzle);

  // Destello de disparo
  const flashMat = new THREE.MeshBasicMaterial({ color: 0x7ff3ff, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
  const flash = new THREE.Mesh(new THREE.SphereGeometry(0.28, 16, 12), flashMat);
  flash.position.set(0, 0, 3.7);
  barrel.add(flash);

  // ---------- Animación / API ----------
  let recoil = 0;
  function fire() { recoil = 1; }

  function applyRecoil(dt) {
    recoil = Math.max(0, recoil - dt * 5);
    barrel.position.z = -0.28 * recoil * recoil;
    flashMat.opacity = recoil > 0.6 ? (recoil - 0.6) / 0.4 : 0;
    flash.scale.setScalar(0.6 + recoil);
  }

  let lastShot = 0;
  function update(t, dt) {
    yaw.rotation.y = Math.sin(t * 0.5) * 1.3;
    pitch.rotation.x = -0.18 - 0.1 * Math.sin(t * 0.8);
    glow.emissiveIntensity = 1.4 + 0.4 * Math.sin(t * 3);
    if (t - lastShot > 3) { lastShot = t; fire(); }
    applyRecoil(dt || 0.016);
  }

  root.userData = { yaw, pitch, muzzle, fire, update };
  return root;
}

if (typeof registerModel === 'function') registerModel('Torreta futurista', createTurret);
