/* Criatura: Gusano devorador de arena — para el visor (usa registerCreature).
   ~55 m de largo. Se entierra y emerge; el suelo se abulta y forma surcos por donde pasa.
   Todo (paleta, texturas, ataque) es propio de esta criatura. */
registerCreature({
  id: 'gusano', name: 'Gusano devorador', scale: 1, world: 3, cam: { dist: 42, y: 3 },
  gait: { walk: { v: 3.5, rate: 1.2 }, run: { v: 14, rate: 4 } },
  build(T, H) {
    const { V, smooth: sm } = H, T2 = Math.PI * 2, rnd = Math.random, root = new T.Group();

    // ---- texturas propias ----
    const cv = (w, h, draw) => {
      const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
      const t = new T.CanvasTexture(c); t.wrapS = t.wrapT = T.RepeatWrapping; return t;
    };
    const spots = (g, w, h, n, r0, r1, cols) => {
      for (let i = 0; i < n; i++) {
        const x = rnd() * w, y = rnd() * h, r = r0 + rnd() * (r1 - r0), col = cols[(rnd() * cols.length) | 0];
        for (const dx of [-w, 0, w]) for (const dy of [-h, 0, h]) {
          const q = g.createRadialGradient(x + dx, y + dy, 0, x + dx, y + dy, r);
          q.addColorStop(0, col); q.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = q; g.fillRect(x + dx - r, y + dy - r, r * 2, r * 2);
        }
      }
    };
    const skinTex = cv(512, 512, (g, w, h) => {
      const gr = g.createLinearGradient(0, 0, w, 0);
      [[0, '#4a2216'], [.22, '#7d3d26'], [.4, '#b5703f'], [.5, '#e0c08f'], [.6, '#b5703f'], [.78, '#7d3d26'], [1, '#4a2216']].forEach(([p, c]) => gr.addColorStop(p, c));
      g.fillStyle = gr; g.fillRect(0, 0, w, h);
      spots(g, w, h, 520, 3, 14, ['rgba(238,208,150,.32)', 'rgba(30,10,6,.38)']);
      g.fillStyle = 'rgba(20,6,4,.6)'; g.fillRect(0, 0, w, 16);
    });
    const bumpTex = cv(512, 512, (g, w, h) => {
      g.fillStyle = '#9a9a9a'; g.fillRect(0, 0, w, h); spots(g, w, h, 900, 2, 9, ['rgba(255,255,255,.45)', 'rgba(0,0,0,.5)']);
      g.fillStyle = '#000'; g.fillRect(0, 0, w, 22);
    });
    const soilTex = cv(256, 256, (g, w, h) => {
      g.fillStyle = '#6b4a2e'; g.fillRect(0, 0, w, h);
      spots(g, w, h, 500, 2, 12, ['rgba(40,24,12,.5)', 'rgba(150,110,70,.4)', 'rgba(95,65,38,.5)']);
    });
    const skin = new T.MeshPhysicalMaterial({ map: skinTex, bumpMap: bumpTex, bumpScale: 3, roughness: .35, clearcoat: .7, clearcoatRoughness: .25, side: T.DoubleSide });
    const soil = new T.MeshStandardMaterial({ map: soilTex, roughness: 1, side: T.DoubleSide });
    const flesh = new T.MeshStandardMaterial({ color: 0x5b1230, roughness: .3, emissive: 0x1a0412, side: T.BackSide });
    const lipM = new T.MeshStandardMaterial({ color: 0xc77a6a, roughness: .3 });
    const chit = new T.MeshStandardMaterial({ color: 0xcdb27a, roughness: .45 });

    // ---- cuerpo: 136 anillos (≈55 m) ----
    const N = 136, RAD = 24, dl = .4;
    const pts = Array.from({ length: N + 1 }, () => V(0, 0, 0)), rr = new Array(N + 1).fill(0), ar = new Float32Array(N + 1);
    const TX = new Float32Array(N + 1), TY = new Float32Array(N + 1), TZ = new Float32Array(N + 1),
      NX = new Float32Array(N + 1), NY = new Float32Array(N + 1), NZ = new Float32Array(N + 1),
      BX = new Float32Array(N + 1), BY = new Float32Array(N + 1), BZ = new Float32Array(N + 1);
    const posA = new Float32Array((N + 1) * (RAD + 1) * 3), nrmA = new Float32Array(posA.length), uvA = new Float32Array((N + 1) * (RAD + 1) * 2), idx = [];
    for (let i = 0; i <= N; i++) for (let k = 0; k <= RAD; k++) {
      const n = i * (RAD + 1) + k; uvA[n * 2] = k / RAD; uvA[n * 2 + 1] = i * .5;
      if (i < N && k < RAD) { const a = n, b = n + RAD + 1; idx.push(a, b, a + 1, b, b + 1, a + 1); }
    }
    const geo = new T.BufferGeometry(), pa = new T.BufferAttribute(posA, 3), na = new T.BufferAttribute(nrmA, 3);
    geo.setAttribute('position', pa); geo.setAttribute('normal', na); geo.setAttribute('uv', new T.BufferAttribute(uvA, 2)); geo.setIndex(idx);
    const mesh = new T.Mesh(geo, skin); mesh.frustumCulled = false; mesh.receiveShadow = true; root.add(mesh);

    // ---- tierra removida: cinta que sigue el camino real recorrido (curva si gira) y se desvanece con la distancia ----
    const AH = 5, DSR = 1, JN = 126, CS = 10, FADE0 = 54, FADE1 = 66;      // 5 m por delante de la cabeza, rastro de ~120 m
    const mPos = new Float32Array(JN * (CS + 1) * 3), mNrm = new Float32Array(mPos.length), mUv = new Float32Array(JN * (CS + 1) * 2), mIdx = [];
    for (let p = 0; p < JN; p++) for (let q = 0; q <= CS; q++) {
      const n = p * (CS + 1) + q; mUv[n * 2] = q / CS * 2; mUv[n * 2 + 1] = p * .5;
      if (p < JN - 1 && q < CS) { const a = n, b = n + CS + 1; mIdx.push(a, b, a + 1, b, b + 1, a + 1); }
    }
    const mg = new T.BufferGeometry(), mpa = new T.BufferAttribute(mPos, 3), mna = new T.BufferAttribute(mNrm, 3);
    mg.setAttribute('position', mpa); mg.setAttribute('normal', mna); mg.setAttribute('uv', new T.BufferAttribute(mUv, 2)); mg.setIndex(mIdx);
    const mound = new T.Mesh(mg, soil); mound.frustumCulled = false; mound.receiveShadow = true; root.add(mound);
    const sx = new Float32Array(JN), sz = new Float32Array(JN), sw = new Float32Array(JN), sm1 = new Float32Array(JN), sb = new Float32Array(JN), sd = new Float32Array(JN);

    // ---- cabeza ciega: boca circular (labio, embudo con dientes, 5 placas que se abren y cierran) ----
    const head = new T.Group(); root.add(head);
    const mo = new T.Group(); head.add(mo);
    mo.add(new T.Mesh(new T.TorusGeometry(1, .13, 12, 40), lipM));
    const fun = new T.Mesh(new T.CylinderGeometry(.97, .55, 1.6, 32, 1, true), flesh); fun.rotation.x = Math.PI / 2; fun.position.z = -.8; mo.add(fun);
    [[-.1, 18], [-.5, 16], [-.9, 14]].forEach(([z, n], r) => {
      for (let k = 0; k < n; k++) {
        const a = k / n * T2 + r * .2, rad = .97 + (z / 1.4) * .45 - .06, c = new T.Mesh(new T.ConeGeometry(.05, .28, 6), chit);
        c.position.set(Math.cos(a) * rad, Math.sin(a) * rad, z);
        c.quaternion.setFromUnitVectors(V(0, 1, 0), V(-Math.cos(a) * .8, -Math.sin(a) * .8, -.4).normalize()); mo.add(c);
      }
    });
    const flaps = [];
    for (let k = 0; k < 5; k++) {
      const a = k / 5 * T2, g = new T.Group(); g.position.set(Math.cos(a), Math.sin(a), 0);
      g.rotation.order = 'ZYX'; g.rotation.z = a; mo.add(g);                // primero abre/cierra sobre su bisagra y luego se coloca en el aro (antes todas se torcían al mismo lado)
      const pl = new T.Mesh(new T.SphereGeometry(1, 14, 10), chit); pl.scale.set(.34, .07, .95); pl.position.z = .85; g.add(pl);
      const sp = new T.Mesh(new T.ConeGeometry(.07, .4, 6), chit); sp.rotation.x = Math.PI / 2; sp.position.z = 1.75; g.add(sp);
      flaps.push(g);
    }
    const feed = new T.Object3D(); feed.position.z = .5; head.add(feed);
    const mat4 = new T.Matrix4(), lerp = (a, b, u) => a + (b - a) * u;

    // ---- historial del recorrido (en el mundo): el cuerpo y el surco siguen la trayectoria de la cabeza ----
    const DS = .5, HN = 300; let wx = 0, wz = 0, yaw = 0;
    const hX = [], hZ = [];
    for (let k = 0; k < HN; k++) { hX.push(0); hZ.push(-(HN - k) * DS); }
    const pose = { x: 0, z: 0, yaw: 0 };
    const cum = new Float32Array(HN + 2), lx = new Float32Array(HN + 2), lz = new Float32Array(HN + 2);
    let PL = 0, t0x = 0, t0z = 1, qx = 0, qz = 0, qtx = 0, qtz = 1;
    const buildPoly = () => {                                                  // polilínea en coordenadas locales (cabeza = origen)
      const c = Math.cos(yaw), s = Math.sin(yaw); PL = 0;
      const add = (x, z) => { const dx = x - wx, dz = z - wz; lx[PL] = dx * c - dz * s; lz[PL] = dx * s + dz * c; cum[PL] = PL ? cum[PL - 1] + Math.hypot(lx[PL] - lx[PL - 1], lz[PL] - lz[PL - 1]) : 0; PL++; };
      add(wx, wz); for (let k = hX.length - 1; k >= 0; k--) add(hX[k], hZ[k]);
      t0x = 0; t0z = 1; for (let k = 1; k < PL; k++) { const d = Math.hypot(lx[0] - lx[k], lz[0] - lz[k]); if (d > .05) { t0x = (lx[0] - lx[k]) / d; t0z = (lz[0] - lz[k]) / d; break; } }
    };
    const at = a => {                                                          // punto a distancia a por detrás de la cabeza (a<0: por delante)
      if (a <= 0) { qx = t0x * -a; qz = t0z * -a; qtx = t0x; qtz = t0z; return; }
      if (a >= cum[PL - 1]) { qx = lx[PL - 1]; qz = lz[PL - 1]; } else {
        let lo = 0, hi = PL - 1; while (hi - lo > 1) { const m = (lo + hi) >> 1; cum[m] <= a ? lo = m : hi = m; }
        const u = (a - cum[lo]) / Math.max(1e-6, cum[hi] - cum[lo]); qx = lerp(lx[lo], lx[hi], u); qz = lerp(lz[lo], lz[hi], u);
      }
      let lo = 0, hi = PL - 1; while (hi - lo > 1) { const m = (lo + hi) >> 1; cum[m] <= a ? lo = m : hi = m; }
      const dx = lx[lo] - lx[hi], dz = lz[lo] - lz[hi], d = Math.hypot(dx, dz) || 1; qtx = dx / d; qtz = dz / d;
    };

    // ---- ciclo de ataque (8 s): se entierra y avanza girando bajo tierra, emerge en otro sitio, hace el arco con la boca hacia el suelo y se clava ----
    // [t, altura del cuello, profundidad, amplitud onda, boca, gancho (rad), velocidad m/s, giro rad/s]
    const KEYS = [[0,-3.5,4.2,.5,.1,0,2,0],[1.5,-3.5,4.2,.5,.1,0,12,.6],[2.6,-3,3.6,.9,.1,0,12,.6],[3.7,-3,3.6,.9,.2,0,6,0],[4.8,4,2.6,.6,.3,.3,3,0],
                  [5.6,9,2.2,.4,1,1.1,1,0],[6.2,7,2.4,.5,1,1.45,1,0],[6.55,3,2.4,.5,1,1.45,3,0],[6.95,-3,3.8,.5,.9,1.2,3,0],[7.3,-3.5,4.2,.5,.1,.3,2,0],[8,-3.5,4.2,.5,.1,0,2,0]];
    const kf = u => {
      const c = u % 8; let i = 0; while (i < KEYS.length - 2 && c >= KEYS[i + 1][0]) i++;
      const a = KEYS[i], b = KEYS[i + 1], q = sm((c - a[0]) / (b[0] - a[0])); return a.map((v, j) => v + (b[j] - v) * q);
    };
    let lph = 0, prevC = 0, turnDir = 1;
    const yv = new Float32Array(N + 1), yh = new Float32Array(N + 1), xv = new Float32Array(N + 1);
    const api = {
      root, feed, pose, shake: 0,
      drive() { return { v: 0, rate: 3.5 }; },
      update(s) {
        const t = s.t, sp = s.sp, atk = s.mode === 'attack', dt = s.dt, wk = sm(sp / 3.5), rk = sm((sp - 3.5) / 10.5);
        let ph = s.ph + (atk ? 0 : t * .3 * (1 - wk)); if (atk) { lph += dt * 3.5; ph = lph; }

        // 1) parámetros por modo
        let swayK = 1 - wk, depth = 1.3, A = .9, k = .34 + (.286 - .34) * rk, o = s.mouth, hk = 0, Lh = 7, speed = sp, turn = 0;
        depth += (.25 - depth) * wk; A += (.5 - A) * wk; depth += (1 - depth) * rk; A += (2.8 - A) * rk;
        const hyIdle = 3.6 + .3 * Math.sin(t * .8), bump = q => q >= 1 ? 0 : sm(1 - q);
        let base0 = -depth + A * Math.sin(-ph), rise = (hyIdle - base0) * (1 - wk) + .5 * wk * (1 - rk), Lr = 8 + 1.5 * Math.abs(rise);
        if (sp > .5) turn = (.22 * Math.sin(t * .31) + .16 * Math.sin(t * .83)) * (1 + .4 * rk);       // trayectoria con curvas
        if (atk) {
          const c = s.u % 8, K = kf(s.u), ow = sm(s.u / 1.2);
          depth += (K[2] - depth) * ow; A += (K[3] - A) * ow; k = k * (1 - ow) + .3 * ow; o += (K[4] - o) * ow; hk = K[5] * ow;
          const bL = -depth + A * Math.sin(k * Lh - ph), rA = K[1] - bL, LrA = 8 + 1.5 * Math.abs(rA), riseA = rA / Math.max(.25, bump(Lh / LrA));
          rise += (riseA - rise) * ow; Lr += (LrA - Lr) * ow; swayK *= 1 - ow;
          speed = K[6] * ow; turn = K[7] * turnDir * ow;
          if (prevC < 1.5 && c >= 1.5) turnDir = Math.random() < .5 ? -1 : 1;            // al buscar otra salida gira hacia un lado
          if (prevC < 6.4 && c >= 6.4) api.shake = 1;                                       // la cabeza golpea el suelo
          if (prevC < 4.2 && c >= 4.2) api.shake = Math.max(api.shake, .4);
          prevC = c;
        } else prevC = 0;
        api.shake *= Math.exp(-3 * dt);

        // 2) avance real por el mundo (posición y rumbo virtuales); el visor mueve y gira el suelo en consecuencia
        turn += s.steer || 0;                                   // (juego) giro extra para dirigirlo hacia un objetivo
        yaw += turn * dt; wx += speed * dt * Math.sin(yaw); wz += speed * dt * Math.cos(yaw);
        if (Math.hypot(wx - hX[hX.length - 1], wz - hZ[hZ.length - 1]) >= DS) { hX.push(wx); hZ.push(wz); if (hX.length > HN) { hX.shift(); hZ.shift(); } }
        pose.x = wx; pose.z = wz; pose.yaw = yaw; buildPoly();

        // 3) perfil vertical: onda continua (cabeza incluida) + elevación del cuello + gancho final (el arco que baja la boca al suelo)
        const lat = (.5 + .6 * rk) * Math.min(1, sp / 3);
        for (let i = N; i >= 0; i--) {
          const l = (N - i) * dl;
          yv[i] = -depth + A * Math.sin(k * l - ph) + rise * bump(l / Lr);
          xv[i] = lat * Math.sin(.5 * k * l - ph * .5) + .12 * Math.sin(t * .7 + l * .15) + 1.1 * Math.sin(t * .45) * swayK * bump(l / Lr);   // en reposo mira de un lado a otro
        }
        if (hk > .01) {
          const iL = N - Math.round(Lh / dl), hw = sm(hk / .3); let y = yv[iL]; yh[iL] = y;
          for (let i = iL + 1; i <= N; i++) { const l = (N - i) * dl; y -= dl * Math.sin(hk * sm((Lh - l) / Lh)); yh[i] = y; }
          for (let i = iL + 1; i <= N; i++) yv[i] += (yh[i] - yv[i]) * hw;
        }
        let zc = 0;
        for (let i = N; i >= 0; i--) {
          if (i < N) { const dy = yv[i] - yv[i + 1], dx = xv[i] - xv[i + 1]; zc += Math.sqrt(Math.max(.01, dl * dl - dy * dy - dx * dx)); }
          ar[i] = zc; at(zc); pts[i].set(qx + xv[i] * qtz, yv[i], qz - xv[i] * qtx);     // sigue la trayectoria recorrida
        }

        // 4) radios: cola fina, cuerpo grueso, anillos, onda peristáltica, boca (cerrada = punta casi sellada)
        const brt = 1 + .015 * Math.sin(t * 1.5), pw = Math.min(1, sp / 2 + .25);
        for (let i = 0; i <= N; i++) {
          const f = i / N, mth = sm((f - .94) / .06);
          let r = (.1 + 1.05 * (1 - Math.exp(-f * 9)) + .1 * sm((f - .88) / .1)) * (1 + .05 * Math.cos(T2 * f * 120)) * (1 + .07 * pw * Math.sin(k * 2 * i * dl - ph)) * brt;
          rr[i] = r * (1 + mth * (-.45 * (1 - o) + .12 * o));
        }

        // 5) marcos de referencia sin giros bruscos (transporte paralelo) y vértices
        let px = 0, py = 1, pz = 0;
        for (let i = 0; i <= N; i++) {
          const a = pts[Math.max(0, i - 1)], b = pts[Math.min(N, i + 1)];
          let tx = b.x - a.x, ty = b.y - a.y, tz = b.z - a.z; const tl = Math.hypot(tx, ty, tz) || 1; tx /= tl; ty /= tl; tz /= tl;
          const d = px * tx + py * ty + pz * tz; px -= d * tx; py -= d * ty; pz -= d * tz;
          const pl = Math.hypot(px, py, pz) || 1; px /= pl; py /= pl; pz /= pl;
          TX[i] = tx; TY[i] = ty; TZ[i] = tz; NX[i] = px; NY[i] = py; NZ[i] = pz;
          BX[i] = ty * pz - tz * py; BY[i] = tz * px - tx * pz; BZ[i] = tx * py - ty * px;
        }
        for (let i = 0; i <= N; i++) {
          const p = pts[i], r = rr[i];
          for (let q = 0; q <= RAD; q++) {
            const a = q / RAD * T2, ca = Math.cos(a), sa = Math.sin(a), n = (i * (RAD + 1) + q) * 3,
              dx = NX[i] * ca + BX[i] * sa, dy = NY[i] * ca + BY[i] * sa, dz = NZ[i] * ca + BZ[i] * sa;
            posA[n] = p.x + dx * r; posA[n + 1] = p.y + dy * r; posA[n + 2] = p.z + dz * r;
            nrmA[n] = dx; nrmA[n + 1] = dy; nrmA[n + 2] = dz;
          }
        }
        pa.needsUpdate = true; na.needsUpdate = true;

        // 6) tierra: domo si va cerca de la superficie, surco (dos bordes) si va hondo; punta redondeada por delante; el rastro se desvanece
        let ii = N;
        for (let j = 0; j < JN; j++) {
          const a = -AH + j * DSR; let r, top, fade = 1, taper = 1;
          if (a <= 0) { r = rr[N] + .5; top = pts[N].y + rr[N]; taper = Math.sqrt(Math.max(0, 1 - (a / AH) * (a / AH))); }
          else if (a >= ar[0]) { r = .7; top = -1; fade = 1 - sm((a - FADE0) / FADE1); taper = .6 + .4 * fade; }
          else {
            while (ii > 1 && ar[ii - 1] <= a) ii--;
            const u = (a - ar[ii]) / Math.max(1e-6, ar[ii - 1] - ar[ii]); r = lerp(rr[ii], rr[ii - 1], u) + .1; top = lerp(pts[ii].y, pts[ii - 1].y, u) + r;
            fade = a < FADE0 ? 1 : 1 - sm((a - FADE0) / FADE1);
          }
          const cover = -top, d = top > 0 ? 0 : Math.min(1, Math.max(0, 1 - cover / (r * 1.8)));
          at(a); sx[j] = qx; sz[j] = qz; sd[j] = d;
          sm1[j] = Math.max(0, r - cover * .55) * fade * taper; sb[j] = (top > 0 ? .45 : .3) * r * (1 - d) * fade * taper; sw[j] = (1.7 * r + .8) * taper;
        }
        for (let p = 0; p < JN; p++) {
          const a0 = Math.max(0, p - 1), b0 = Math.min(JN - 1, p + 1);
          let tx = sx[b0] - sx[a0], tz = sz[b0] - sz[a0]; const tl = Math.hypot(tx, tz) || 1; tx /= tl; tz /= tl;
          const nx = tz, nz = -tx;
          for (let q = 0; q <= CS; q++) {
            const uu = -1 + 2 * q / CS, n = (p * (CS + 1) + q) * 3,
              y = sd[p] * sm1[p] * Math.pow(Math.max(0, 1 - uu * uu), 1.4) + (1 - sd[p]) * sb[p] * Math.pow(Math.sin(Math.PI * Math.abs(uu)), 1.2) + .03;
            mPos[n] = sx[p] + nx * uu * sw[p]; mPos[n + 1] = y; mPos[n + 2] = sz[p] + nz * uu * sw[p];
            const gx = nx * uu * .6, gz = nz * uu * .6, gl = Math.hypot(gx, 1, gz); mNrm[n] = gx / gl; mNrm[n + 1] = 1 / gl; mNrm[n + 2] = gz / gl;
          }
        }
        mpa.needsUpdate = true; mna.needsUpdate = true;

        // 7) cabeza y boca siguen el último tramo; con la boca cerrada se ocultan las placas
        mat4.makeBasis(V(BX[N], BY[N], BZ[N]).multiplyScalar(-1), V(NX[N], NY[N], NZ[N]), V(TX[N], TY[N], TZ[N]));
        head.quaternion.setFromRotationMatrix(mat4); head.position.copy(pts[N]);
        mo.scale.setScalar(Math.max(.05, rr[N]));
        // en reposo y al atacar las placas se abren/respiran; al caminar y correr se juntan hacia el centro
        flaps.forEach(g => { g.rotation.y = (-.35 + 1.5 * o) * (1 - wk) - .75 * wk; });
      }
    };
    return api;
  }
});
