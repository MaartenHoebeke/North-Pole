/**
 * ============================================================================
 * DE NOORDPOOL (90° N) — Realistische & Interactieve Three.js Scene
 * ============================================================================
 *
 * Onderdelen in deze scene:
 *  1. Besneeuwde ondergrond (glooiend terrein + bevroren ijsvijver + pad)
 *     en nachtelijke hemel (sterren, maan, mist en geanimeerd Noorderlicht)
 *  2. Rood-wit gestreepte paal op 90° (Noordpool 90° N, loodrecht op 90°)
 *  3. De werkplaats van de Kerstman (blokhut, ramen, schoorsteenrook, deur, cadeaus)
 *  4. Acht kerstbomen (minstens 5) met geanimeerde knipperende kerstlichtjes
 *  5. Vallende sneeuw als GPU-vriendelijk particle system (THREE.Points)
 *  6. Autonoom bewegende objecten (vliegende arrenslee met rendieren + rijdend treintje)
 *  7. Rondkijken met de muis via OrbitControls + snelkoppelingen voor de camera
 *  8. Klikbare objecten via Raycasting met directe visuele en auditieve feedback
 *  9. Geoptimaliseerd voor 60 FPS op een gewone laptop
 */

window.initNoordpoolScene = function initNoordpoolScene() {
  // Voorkom dubbele initialisatie
  if (window.__noordpoolInitialized) return;
  if (!window.THREE || !window.OrbitControls) return;
  window.__noordpoolInitialized = true;

  const THREE = window.THREE;
  const OrbitControls = window.OrbitControls;

  // ==========================================================================
  // 1. BASISOPZET: SCENE, CAMERA, RENDERER & ORBITCONTROLS
  // ==========================================================================

  const container = document.getElementById('canvas-container');

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x060d1c);
  scene.fog = new THREE.FogExp2(0x09152b, 0.0068);

  const camera = new THREE.PerspectiveCamera(
    55,
    window.innerWidth / window.innerHeight,
    0.5,
    600
  );
  camera.position.set(18, 11, 28);

  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    powerPreference: 'high-performance',
  });
  renderer.setSize(window.innerWidth, window.innerHeight);
  // Begrens pixelRatio tot maximaal 2 voor stabiele 60 FPS op Retina/HiDPI laptops
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  container.appendChild(renderer.domElement);

  // Muisbesturing zodat de gebruiker vrij kan rondkijken
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(-2, 3.5, -2);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.minDistance = 4;
  controls.maxDistance = 115;
  // Voorkom dat de camera onder de besneeuwde grond duikt
  controls.maxPolarAngle = Math.PI / 2 - 0.03;
  controls.update();

  // Lijst met alle klikbare 3D-objecten voor de Raycaster
  const clickableObjects = [];

  // ==========================================================================
  // 2. HULPFUNCTIES VOOR TEXTUREN, GELUID & TERREINHOOGTE
  // ==========================================================================

  /**
   * Berekent de hoogte (Y) van het sneeuwlandschap op positie (x, z).
   * Het centrale plein rond de Noordpoolpaal en de werkplaats blijft vlak,
   * terwijl daaromheen natuurlijke sneeuwduinen en heuvels ontstaan.
   */
  function getTerrainHeight(x, z) {
    const distFromCenter = Math.hypot(x, z);
    // Vlakke zone in het midden (straal ~24m) met zachte overgang naar heuvels
    const hillFactor = THREE.MathUtils.smoothstep(distFromCenter, 22, 65);
    const wave1 = Math.sin(x * 0.055) * Math.cos(z * 0.055) * 3.8;
    const wave2 = Math.sin(x * 0.12 + 1.4) * Math.sin(z * 0.11) * 1.4;
    const wave3 = Math.cos((x + z) * 0.03) * 2.5;
    // Subtiele glooiing in het midden zodat het niet kunstmatig plat oogt
    const subtleCenter = (Math.sin(x * 0.15) * Math.cos(z * 0.15)) * 0.12 * (1 - hillFactor);
    return (wave1 + wave2 + wave3 + 2.2) * hillFactor + subtleCenter;
  }

  /**
   * Genereert een zachte ronde deeltjes-textuur voor sneeuwvlokken, rook en sterren.
   */
  function createSoftParticleTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    const grad = ctx.createRadialGradient(32, 32, 2, 32, 32, 30);
    grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
    grad.addColorStop(0.35, 'rgba(235, 245, 255, 0.85)');
    grad.addColorStop(0.7, 'rgba(200, 225, 255, 0.25)');
    grad.addColorStop(1, 'rgba(200, 225, 255, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 64, 64);
    const texture = new THREE.CanvasTexture(canvas);
    return texture;
  }

  /**
   * Genereert een subtiele bump/ruwheids-textuur voor realistische sneeuw.
   */
  function createSnowMicroTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#808080';
    ctx.fillRect(0, 0, 256, 256);

    for (let i = 0; i < 6000; i++) {
      const x = Math.random() * 256;
      const y = Math.random() * 256;
      const shade = 100 + Math.floor(Math.random() * 155);
      ctx.fillStyle = `rgb(${shade},${shade},${shade})`;
      ctx.fillRect(x, y, 2, 2);
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(35, 35);
    return texture;
  }

  /**
   * Genereert de rood-wit gestreepte textuur voor de 90° Noordpoolpaal.
   */
  function createRedWhiteStripeTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(0, 0, 256, 256);

    ctx.fillStyle = '#d91b24';
    const stripes = 4;
    const step = 256 / stripes;

    for (let i = -4; i < stripes * 2; i++) {
      ctx.beginPath();
      ctx.moveTo(0, i * step);
      ctx.lineTo(256, (i + 1) * step);
      ctx.lineTo(256, (i + 1.5) * step);
      ctx.lineTo(0, (i + 0.5) * step);
      ctx.closePath();
      ctx.fill();
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(1, 3);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }

  /**
   * Maakt een houten bordje-textuur met tekst.
   */
  function createSignTexture(titleText, subtitleText, bgColor = '#4a2811', borderColor = '#d4af37') {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 160;
    const ctx = canvas.getContext('2d');

    // Houtachtergrond
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, 512, 160);

    // Houtnerf-lijnen
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.22)';
    ctx.lineWidth = 3;
    for (let y = 12; y < 160; y += 22) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(512, y + (Math.random() - 0.5) * 6);
      ctx.stroke();
    }

    // Sierlijke rand
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = 8;
    ctx.strokeRect(8, 8, 496, 144);

    // Hoofdtekst
    ctx.fillStyle = '#fff8dc';
    ctx.font = 'bold 42px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(titleText, 256, subtitleText ? 62 : 80);

    if (subtitleText) {
      ctx.fillStyle = '#fde047';
      ctx.font = 'bold 28px sans-serif';
      ctx.fillText(subtitleText, 256, 114);
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }

  const softParticleTexture = createSoftParticleTexture();

  // ==========================================================================
  // 3. PROCEDURELE GELUIDSEFFECTEN (Web Audio API, geen externe bestanden nodig)
  // ==========================================================================

  let soundEnabled = true;
  let audioCtx = null;

  function playFestiveSound(type) {
    if (!soundEnabled) return;
    try {
      if (!audioCtx) {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (!AudioContextClass) return;
        audioCtx = new AudioContextClass();
      }
      if (audioCtx.state === 'suspended') {
        audioCtx.resume();
      }

      const now = audioCtx.currentTime;

      if (type === 'pole') {
        // Magische arpeggio-klokkenspel
        const notes = [523.25, 659.25, 783.99, 1046.5, 1318.5];
        notes.forEach((freq, idx) => {
          const osc = audioCtx.createOscillator();
          const gain = audioCtx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, now + idx * 0.08);
          gain.gain.setValueAtTime(0.08, now + idx * 0.08);
          gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.08 + 0.7);
          osc.connect(gain);
          gain.connect(audioCtx.destination);
          osc.start(now + idx * 0.08);
          osc.stop(now + idx * 0.08 + 0.72);
        });
      } else if (type === 'workshop') {
        // Warme deurbel-akkoord
        const notes = [440, 554.37, 659.25];
        notes.forEach((freq, idx) => {
          const osc = audioCtx.createOscillator();
          const gain = audioCtx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(freq, now + idx * 0.11);
          gain.gain.setValueAtTime(0.09, now + idx * 0.11);
          gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.11 + 0.65);
          osc.connect(gain);
          gain.connect(audioCtx.destination);
          osc.start(now + idx * 0.11);
          osc.stop(now + idx * 0.11 + 0.68);
        });
      } else if (type === 'tree') {
        // Kristallen twinkel
        const notes = [880, 1174.66, 1567.98];
        notes.forEach((freq, idx) => {
          const osc = audioCtx.createOscillator();
          const gain = audioCtx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, now + idx * 0.06);
          gain.gain.setValueAtTime(0.06, now + idx * 0.06);
          gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.06 + 0.35);
          osc.connect(gain);
          gain.connect(audioCtx.destination);
          osc.start(now + idx * 0.06);
          osc.stop(now + idx * 0.06 + 0.38);
        });
      } else if (type === 'train') {
        // Tweestemmige stoomtreinfluit ("Toet-toet!")
        [0, 0.25].forEach((offset) => {
          [587.33, 739.99].forEach((freq) => {
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(freq, now + offset);
            gain.gain.setValueAtTime(0.06, now + offset);
            gain.gain.exponentialRampToValueAtTime(0.0001, now + offset + 0.2);
            osc.connect(gain);
            gain.connect(audioCtx.destination);
            osc.start(now + offset);
            osc.stop(now + offset + 0.22);
          });
        });
      } else if (type === 'snowman') {
        // Vrolijke sprong-toon
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(320, now);
        osc.frequency.exponentialRampToValueAtTime(760, now + 0.28);
        gain.gain.setValueAtTime(0.08, now);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.32);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start(now);
        osc.stop(now + 0.34);
      }
    } catch (_) {
      // Negeer fouten indien browser audio blokkeert
    }
  }

  // ==========================================================================
  // 4. BELICHTING: MAANLICHT, POOLHEMEL & SFEERVERLICHTING
  // ==========================================================================

  // Koel blauwachtig poolnacht-omgevingslicht
  const hemiLight = new THREE.HemisphereLight(0x4b77be, 0x1a2a44, 0.75);
  hemiLight.position.set(0, 60, 0);
  scene.add(hemiLight);

  // Hoofd-maanlicht met zachte schaduwen
  const moonLight = new THREE.DirectionalLight(0xc7dfff, 1.45);
  moonLight.position.set(45, 58, -38);
  moonLight.castShadow = true;
  moonLight.shadow.mapSize.width = 2048;
  moonLight.shadow.mapSize.height = 2048;
  moonLight.shadow.camera.near = 10;
  moonLight.shadow.camera.far = 160;
  const shadowBounds = 45;
  moonLight.shadow.camera.left = -shadowBounds;
  moonLight.shadow.camera.right = shadowBounds;
  moonLight.shadow.camera.top = shadowBounds;
  moonLight.shadow.camera.bottom = -shadowBounds;
  moonLight.shadow.bias = -0.0005;
  scene.add(moonLight);

  // ==========================================================================
  // 5. BESNEEUWDE ONDERGROND, BEVROREN VIJVER & NACHTELIJKE HEMEL
  // ==========================================================================

  function createSnowEnvironment() {
    // 5.1 Besneeuwde ondergrond met glooiende sneeuwduinen
    const groundGeo = new THREE.PlaneGeometry(240, 240, 120, 120);
    groundGeo.rotateX(-Math.PI / 2);

    const posAttr = groundGeo.attributes.position;
    for (let i = 0; i < posAttr.count; i++) {
      const vx = posAttr.getX(i);
      const vz = posAttr.getZ(i);
      posAttr.setY(i, getTerrainHeight(vx, vz));
    }
    groundGeo.computeVertexNormals();

    const snowBumpMap = createSnowMicroTexture();
    const groundMat = new THREE.MeshStandardMaterial({
      color: 0xeaf3ff,
      roughness: 0.7,
      metalness: 0.06,
      bumpMap: snowBumpMap,
      bumpScale: 0.08,
    });

    const groundMesh = new THREE.Mesh(groundGeo, groundMat);
    groundMesh.receiveShadow = true;
    scene.add(groundMesh);

    // 5.2 Bevroren ijsvijver rechts vooraan in het landschap
    const pondGroup = new THREE.Group();
    const pondX = 14;
    const pondZ = 7;
    const pondY = getTerrainHeight(pondX, pondZ) + 0.03;

    const iceGeo = new THREE.CircleGeometry(6.2, 40);
    iceGeo.rotateX(-Math.PI / 2);
    const iceMat = new THREE.MeshStandardMaterial({
      color: 0x8fd3ff,
      roughness: 0.12,
      metalness: 0.35,
      envMapIntensity: 1.2,
    });
    const iceMesh = new THREE.Mesh(iceGeo, iceMat);
    iceMesh.receiveShadow = true;
    pondGroup.add(iceMesh);

    // Sneeuwrand rondom de bevroren vijver
    const bankCount = 24;
    const bankGeo = new THREE.SphereGeometry(0.95, 10, 8);
    for (let i = 0; i < bankCount; i++) {
      const angle = (i / bankCount) * Math.PI * 2;
      const radius = 6.1 + Math.sin(i * 3.1) * 0.25;
      const bank = new THREE.Mesh(bankGeo, groundMat);
      bank.position.set(Math.cos(angle) * radius, -0.25, Math.sin(angle) * radius);
      bank.scale.set(1.3, 0.45, 1.1);
      bank.receiveShadow = true;
      pondGroup.add(bank);
    }

    pondGroup.position.set(pondX, pondY, pondZ);
    scene.add(pondGroup);

    // 5.3 Natuurstenen tuinpad van de 90° Noordpoolpaal naar de Werkplaats
    const stoneGeo = new THREE.CylinderGeometry(0.55, 0.62, 0.12, 7);
    const stoneMat = new THREE.MeshStandardMaterial({
      color: 0x64748b,
      roughness: 0.85,
    });
    const pathSteps = 12;
    for (let i = 1; i < pathSteps; i++) {
      const t = i / pathSteps;
      const sx = THREE.MathUtils.lerp(0, -8.5, t) + Math.sin(t * Math.PI) * 1.4;
      const sz = THREE.MathUtils.lerp(2, -7.2, t);
      const sy = getTerrainHeight(sx, sz) + 0.03;

      const stone = new THREE.Mesh(stoneGeo, stoneMat);
      stone.position.set(sx, sy, sz);
      stone.rotation.y = i * 0.8;
      stone.scale.set(1 + (i % 3) * 0.15, 1, 0.85 + (i % 2) * 0.2);
      stone.receiveShadow = true;
      scene.add(stone);
    }
  }

  /**
   * Bouwt de nachtelijke hemel met sterren, volle maan en geanimeerd Noorderlicht (Aurora).
   */
  let auroraMaterial = null;
  let auroraBoost = 0;

  function createNightSky() {
    // 5.4 Sterrenhemel (1.600 fonkelende sterren)
    const starCount = 1600;
    const starPositions = new Float32Array(starCount * 3);
    const starColors = new Float32Array(starCount * 3);

    for (let i = 0; i < starCount; i++) {
      // Verdeel sterren over de bovenste helft van de hemelkoepel
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(0.08 + Math.random() * 0.92);
      const radius = 250 + Math.random() * 40;

      starPositions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
      starPositions[i * 3 + 1] = radius * Math.cos(phi);
      starPositions[i * 3 + 2] = radius * Math.sin(phi) * Math.sin(theta);

      // Subtiele kleurvariatie (ijsblauw, wit, zachtgoud)
      const tint = Math.random();
      if (tint < 0.6) {
        starColors[i * 3] = 0.92;
        starColors[i * 3 + 1] = 0.96;
        starColors[i * 3 + 2] = 1.0;
      } else if (tint < 0.85) {
        starColors[i * 3] = 0.72;
        starColors[i * 3 + 1] = 0.86;
        starColors[i * 3 + 2] = 1.0;
      } else {
        starColors[i * 3] = 1.0;
        starColors[i * 3 + 1] = 0.93;
        starColors[i * 3 + 2] = 0.75;
      }
    }

    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
    starGeo.setAttribute('color', new THREE.BufferAttribute(starColors, 3));

    const starMat = new THREE.PointsMaterial({
      size: 2.1,
      map: softParticleTexture,
      vertexColors: true,
      transparent: true,
      opacity: 0.92,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    const starField = new THREE.Points(starGeo, starMat);
    scene.add(starField);

    // 5.5 Volle Maan met atmosferische halo
    const moonGroup = new THREE.Group();
    moonGroup.position.set(110, 130, -110);

    const moonGeo = new THREE.SphereGeometry(9.5, 32, 32);
    const moonMat = new THREE.MeshBasicMaterial({ color: 0xfef9db });
    const moonMesh = new THREE.Mesh(moonGeo, moonMat);
    moonGroup.add(moonMesh);

    const haloSpriteMat = new THREE.SpriteMaterial({
      map: softParticleTexture,
      color: 0x9ecaff,
      transparent: true,
      opacity: 0.48,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const moonHalo = new THREE.Sprite(haloSpriteMat);
    moonHalo.scale.set(56, 56, 1);
    moonGroup.add(moonHalo);

    scene.add(moonGroup);

    // 5.6 Geanimeerd Noorderlicht (Aurora Borealis) gordijn aan de poolhemel
    const auroraGeo = new THREE.CylinderGeometry(165, 175, 68, 96, 24, true, Math.PI * 0.65, Math.PI * 0.85);
    auroraMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uBoost: { value: 0 },
      },
      vertexShader: `
        uniform float uTime;
        varying vec2 vUv;
        void main() {
          vUv = uv;
          vec3 pos = position;
          float wave = sin(uv.x * 16.0 + uTime * 0.7) * 6.5
                     + cos(uv.x * 28.0 - uTime * 0.45) * 3.5;
          pos.x += wave * uv.y;
          pos.z += cos(uv.x * 12.0 + uTime * 0.5) * 5.0 * uv.y;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform float uBoost;
        varying vec2 vUv;
        void main() {
          // Verticale vervaging aan onder- en bovenkant van het gordijn
          float verticalFade = smoothstep(0.0, 0.25, vUv.y) * smoothstep(1.0, 0.35, vUv.y);
          // Horizontale vervaging aan de uiteinden
          float edgeFade = smoothstep(0.0, 0.15, vUv.x) * smoothstep(1.0, 0.85, vUv.x);

          // Bewegende verticale lichtstralen in het noorderlicht
          float rays = 0.55 + 0.45 * sin(vUv.x * 55.0 + uTime * 1.2 + sin(vUv.y * 8.0));
          rays *= 0.65 + 0.35 * cos(vUv.x * 23.0 - uTime * 0.8);

          vec3 greenAurora = vec3(0.12, 0.95, 0.58);
          vec3 tealAurora = vec3(0.08, 0.75, 0.92);
          vec3 violetAurora = vec3(0.62, 0.25, 0.95);

          vec3 col = mix(greenAurora, tealAurora, smoothstep(0.2, 0.65, vUv.y));
          col = mix(col, violetAurora, smoothstep(0.6, 0.95, vUv.y));

          float alpha = verticalFade * edgeFade * rays * (0.34 + uBoost * 0.42);
          gl_FragColor = vec4(col, alpha);
        }
      `,
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    const auroraMesh = new THREE.Mesh(auroraGeo, auroraMaterial);
    auroraMesh.position.set(0, 72, -15);
    scene.add(auroraMesh);
  }

  createSnowEnvironment();
  createNightSky();

  // ==========================================================================
  // 6. ROOD-WIT GESTREEPTE PAAL OP 90° (NOORDPOOL 90° N) — KLIKBAAR!
  // ==========================================================================

  const northPoleState = {
    group: null,
    globeMesh: null,
    accentLight: null,
    spinVelocity: 0.8,
    burstParticles: null,
    burstVelocities: [],
    burstLife: 0,
  };

  function createNorthPoleMarker() {
    const poleGroup = new THREE.Group();
    const poleX = 0;
    const poleZ = 2;
    const poleY = getTerrainHeight(poleX, poleZ);
    poleGroup.position.set(poleX, poleY, poleZ);

    // 6.1 Achthoekig stenen voetstuk met sneeuwlaag
    const baseStoneMat = new THREE.MeshStandardMaterial({
      color: 0x475569,
      roughness: 0.8,
      metalness: 0.15,
    });
    const baseStep1 = new THREE.Mesh(new THREE.CylinderGeometry(1.45, 1.65, 0.35, 8), baseStoneMat);
    baseStep1.position.y = 0.175;
    baseStep1.castShadow = true;
    baseStep1.receiveShadow = true;
    poleGroup.add(baseStep1);

    const baseStep2 = new THREE.Mesh(new THREE.CylinderGeometry(1.05, 1.25, 0.4, 8), baseStoneMat);
    baseStep2.position.y = 0.55;
    baseStep2.castShadow = true;
    baseStep2.receiveShadow = true;
    poleGroup.add(baseStep2);

    const snowRingMat = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.75 });
    const snowRing = new THREE.Mesh(new THREE.TorusGeometry(1.22, 0.16, 10, 24), snowRingMat);
    snowRing.rotation.x = Math.PI / 2;
    snowRing.position.y = 0.36;
    poleGroup.add(snowRing);

    // 6.2 De Rood-Wit Gestreepte Paal (exact loodrecht op 90° en markering 90° N)
    const stripeTexture = createRedWhiteStripeTexture();
    const poleMat = new THREE.MeshStandardMaterial({
      map: stripeTexture,
      roughness: 0.25,
      metalness: 0.1,
    });
    const poleCylinder = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.26, 4.4, 28), poleMat);
    poleCylinder.position.y = 2.95; // Staat exact onder een hoek van 90° op de grond
    poleCylinder.castShadow = true;
    poleCylinder.receiveShadow = true;
    poleGroup.add(poleCylinder);

    // Gouden sierringen rond de paal
    const goldMat = new THREE.MeshStandardMaterial({
      color: 0xfbbf24,
      roughness: 0.22,
      metalness: 0.85,
      emissive: 0x451a03,
      emissiveIntensity: 0.25,
    });

    const bottomCollar = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.36, 0.22, 24), goldMat);
    bottomCollar.position.y = 0.85;
    poleGroup.add(bottomCollar);

    const topCollar = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.26, 0.24, 24), goldMat);
    topCollar.position.y = 5.18;
    poleGroup.add(topCollar);

    // 6.3 Gouden wereldbol bovenop met meridiaanringen
    const globeGroup = new THREE.Group();
    globeGroup.position.y = 5.68;

    const globeSphere = new THREE.Mesh(new THREE.SphereGeometry(0.42, 24, 24), goldMat);
    globeSphere.castShadow = true;
    globeGroup.add(globeSphere);

    const ringGeo = new THREE.TorusGeometry(0.52, 0.03, 12, 32);
    const meridianRing = new THREE.Mesh(ringGeo, goldMat);
    globeGroup.add(meridianRing);

    const equatorRing = new THREE.Mesh(ringGeo, goldMat);
    equatorRing.rotation.x = Math.PI / 2;
    globeGroup.add(equatorRing);

    poleGroup.add(globeGroup);

    // 6.4 Wegwijzer-bordjes op de paal ("NOORDPOOL 90° N" en "WERKPLAATS")
    const northSignTex = createSignTexture('NOORDPOOL', '90° 00′ N');
    const signBoardMat = new THREE.MeshStandardMaterial({
      map: northSignTex,
      roughness: 0.55,
    });
    const signWoodMat = new THREE.MeshStandardMaterial({ color: 0x4a2811, roughness: 0.7 });

    const sign1 = new THREE.Mesh(new THREE.BoxGeometry(1.75, 0.54, 0.09), [
      signWoodMat,
      signWoodMat,
      signWoodMat,
      signWoodMat,
      signBoardMat,
      signBoardMat,
    ]);
    sign1.position.set(0, 4.25, 0.26);
    sign1.castShadow = true;
    poleGroup.add(sign1);

    const workshopSignTex = createSignTexture('⬅ WERKPLAATS', 'Kerstman & Elfen');
    const workshopSignMat = new THREE.MeshStandardMaterial({
      map: workshopSignTex,
      roughness: 0.55,
    });
    const sign2 = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.48, 0.08), [
      signWoodMat,
      signWoodMat,
      signWoodMat,
      signWoodMat,
      workshopSignMat,
      workshopSignMat,
    ]);
    sign2.position.set(-0.35, 3.55, 0);
    sign2.rotation.y = Math.PI / 5;
    sign2.castShadow = true;
    poleGroup.add(sign2);

    // 6.5 Warme grondspots bij het voetstuk zodat de 90°-paal mooi oplicht
    const poleLight = new THREE.PointLight(0xffd166, 2.2, 11);
    poleLight.position.set(0, 3.2, 0.8);
    poleGroup.add(poleLight);

    // 6.6 Feestelijke sterren-vuurwerkdeeltjes bij het klikken op de paal
    const burstCount = 90;
    const burstPositions = new Float32Array(burstCount * 3);
    const burstColors = new Float32Array(burstCount * 3);
    for (let i = 0; i < burstCount; i++) {
      burstPositions[i * 3] = 0;
      burstPositions[i * 3 + 1] = 5.7;
      burstPositions[i * 3 + 2] = 0;

      const c = i % 3 === 0 ? [1.0, 0.88, 0.25] : i % 3 === 1 ? [0.25, 0.95, 0.7] : [1.0, 0.35, 0.35];
      burstColors[i * 3] = c[0];
      burstColors[i * 3 + 1] = c[1];
      burstColors[i * 3 + 2] = c[2];

      northPoleState.burstVelocities.push(new THREE.Vector3());
    }

    const burstGeo = new THREE.BufferGeometry();
    burstGeo.setAttribute('position', new THREE.BufferAttribute(burstPositions, 3));
    burstGeo.setAttribute('color', new THREE.BufferAttribute(burstColors, 3));
    const burstMat = new THREE.PointsMaterial({
      size: 0.45,
      map: softParticleTexture,
      vertexColors: true,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const burstPoints = new THREE.Points(burstGeo, burstMat);
    poleGroup.add(burstPoints);

    northPoleState.group = poleGroup;
    northPoleState.globeMesh = globeGroup;
    northPoleState.accentLight = poleLight;
    northPoleState.burstParticles = burstPoints;

    // Registreer als klikbaar object
    poleGroup.userData = {
      clickable: true,
      label: '💈 Noordpoolpaal (90° N) — Klik voor Noorderlicht & Sterrenregen',
      onClick: () => {
        northPoleState.spinVelocity = 14.0;
        auroraBoost = 1.35;
        northPoleState.burstLife = 1.0;

        const attr = northPoleState.burstParticles.geometry.attributes.position;
        for (let i = 0; i < burstCount; i++) {
          attr.setXYZ(i, 0, 5.7, 0);
          const angle = Math.random() * Math.PI * 2;
          const speed = 1.5 + Math.random() * 4.5;
          northPoleState.burstVelocities[i].set(
            Math.cos(angle) * speed,
            2.2 + Math.random() * 4.5,
            Math.sin(angle) * speed
          );
        }
        attr.needsUpdate = true;
        northPoleState.burstParticles.material.opacity = 1;

        playFestiveSound('pole');
        showToast('💈 90° Noordpoolpaal geactiveerd! Het Noorderlicht vlamt op aan de hemel!');
      },
    };
    clickableObjects.push(poleGroup);

    scene.add(poleGroup);
  }

  createNorthPoleMarker();

  // ==========================================================================
  // 7. DE WERKPLAATS VAN DE KERSTMAN — MET ROOK, LICHTEN & KLIKBARE DEUR
  // ==========================================================================

  const workshopState = {
    group: null,
    doorPivot: null,
    isOpen: false,
    doorAngle: 0,
    interiorLight: null,
    windowMaterial: null,
    chimneySmokeParticles: [],
    productionBoostTimer: 0,
    gifts: [],
  };

  function createSantaWorkshop() {
    const workshopGroup = new THREE.Group();
    const wx = -12;
    const wz = -11;
    const wy = getTerrainHeight(wx, wz);
    workshopGroup.position.set(wx, wy, wz);
    workshopGroup.rotation.y = Math.PI / 5.5;

    // Gedeelde materialen voor de werkplaats
    const stoneFoundationMat = new THREE.MeshStandardMaterial({
      color: 0x475569,
      roughness: 0.88,
    });
    const logWoodMat = new THREE.MeshStandardMaterial({
      color: 0x6b3416,
      roughness: 0.72,
    });
    const darkTimberMat = new THREE.MeshStandardMaterial({
      color: 0x3e1e0c,
      roughness: 0.78,
    });
    const festiveRedMat = new THREE.MeshStandardMaterial({
      color: 0xb91c1c,
      roughness: 0.5,
    });
    const roofSnowMat = new THREE.MeshStandardMaterial({
      color: 0xf1f7ff,
      roughness: 0.68,
    });
    const windowGlowMat = new THREE.MeshStandardMaterial({
      color: 0xffedd5,
      emissive: 0xff9e2c,
      emissiveIntensity: 2.1,
      roughness: 0.2,
    });
    workshopState.windowMaterial = windowGlowMat;

    // 7.1 Stenen fundering + Hoofdgebouw (9m breed × 4.6m hoog × 7m diep)
    const foundation = new THREE.Mesh(new THREE.BoxGeometry(9.4, 0.6, 7.4), stoneFoundationMat);
    foundation.position.y = 0.3;
    foundation.castShadow = true;
    foundation.receiveShadow = true;
    workshopGroup.add(foundation);

    const mainBody = new THREE.Mesh(new THREE.BoxGeometry(9.0, 4.4, 7.0), logWoodMat);
    mainBody.position.y = 2.8;
    mainBody.castShadow = true;
    mainBody.receiveShadow = true;
    workshopGroup.add(mainBody);

    // Horizontale houten boomstam-details op de voor- en zijgevels en hoekbalken
    const cornerBeamGeo = new THREE.BoxGeometry(0.38, 4.5, 0.38);
    [
      [-4.45, 2.8, -3.45],
      [4.45, 2.8, -3.45],
      [-4.45, 2.8, 3.45],
      [4.45, 2.8, 3.45],
    ].forEach(([cx, cy, cz]) => {
      const beam = new THREE.Mesh(cornerBeamGeo, darkTimberMat);
      beam.position.set(cx, cy, cz);
      beam.castShadow = true;
      workshopGroup.add(beam);
    });

    // 7.2 Zadeldak met dikke sneeuwlaag en geveltoppen
    const roofHeight = 2.8;
    const roofHalfWidth = 5.2;
    const roofLength = 7.8;

    const gableShape = new THREE.Shape();
    gableShape.moveTo(-4.5, 0);
    gableShape.lineTo(4.5, 0);
    gableShape.lineTo(0, roofHeight);
    gableShape.closePath();

    const gableGeo = new THREE.ExtrudeGeometry(gableShape, {
      depth: 7.0,
      bevelEnabled: false,
    });
    gableGeo.translate(0, 5.0, -3.5);
    const gableMesh = new THREE.Mesh(gableGeo, logWoodMat);
    gableMesh.castShadow = true;
    gableMesh.receiveShadow = true;
    workshopGroup.add(gableMesh);

    // Dakplaten + Dikke sneeuwlaag links en rechts
    const slopeLength = Math.hypot(roofHalfWidth, roofHeight);
    const slopeAngle = Math.atan2(roofHeight, roofHalfWidth);

    const roofSlopeGeo = new THREE.BoxGeometry(slopeLength, 0.22, roofLength);
    const snowSlopeGeo = new THREE.BoxGeometry(slopeLength + 0.2, 0.32, roofLength + 0.25);

    [-1, 1].forEach((side) => {
      const slopeGroup = new THREE.Group();
      slopeGroup.position.set(side * (roofHalfWidth * 0.48), 5.0 + roofHeight * 0.52, 0);
      slopeGroup.rotation.z = -side * slopeAngle;

      const roofPlank = new THREE.Mesh(roofSlopeGeo, festiveRedMat);
      roofPlank.castShadow = true;
      slopeGroup.add(roofPlank);

      const roofSnow = new THREE.Mesh(snowSlopeGeo, roofSnowMat);
      roofSnow.position.y = 0.22;
      roofSnow.castShadow = true;
      roofSnow.receiveShadow = true;
      slopeGroup.add(roofSnow);

      workshopGroup.add(slopeGroup);
    });

    // 7.3 Glinsterende ijspegels langs de dakrand
    const icicleGeo = new THREE.ConeGeometry(0.08, 0.55, 6);
    const icicleMat = new THREE.MeshStandardMaterial({
      color: 0xdbeafe,
      roughness: 0.1,
      metalness: 0.2,
      transparent: true,
      opacity: 0.85,
    });
    for (let z = -3.6; z <= 3.6; z += 0.55) {
      [-4.95, 4.95].forEach((xSide) => {
        const icicle = new THREE.Mesh(icicleGeo, icicleMat);
        const scaleH = 0.7 + Math.random() * 0.8;
        icicle.scale.set(1, scaleH, 1);
        icicle.position.set(xSide, 4.78 - scaleH * 0.15, z);
        icicle.rotation.x = Math.PI;
        workshopGroup.add(icicle);
      });
    }

    // 7.4 Zij-aanbouw (Speelgoedopslag & Rendierstal)
    const wingBody = new THREE.Mesh(new THREE.BoxGeometry(3.8, 3.2, 4.8), logWoodMat);
    wingBody.position.set(6.2, 1.9, -0.5);
    wingBody.castShadow = true;
    wingBody.receiveShadow = true;
    workshopGroup.add(wingBody);

    const wingRoof = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.35, 5.3), roofSnowMat);
    wingRoof.position.set(6.3, 3.7, -0.5);
    wingRoof.rotation.z = -0.22;
    wingRoof.castShadow = true;
    wingRoof.receiveShadow = true;
    workshopGroup.add(wingRoof);

    // 7.5 Bakstenen Schoorsteen met geanimeerde rookpluimen
    const brickMat = new THREE.MeshStandardMaterial({
      color: 0x7f1d1d,
      roughness: 0.85,
    });
    const chimney = new THREE.Mesh(new THREE.BoxGeometry(1.1, 3.6, 1.1), brickMat);
    chimney.position.set(-2.6, 6.7, -1.6);
    chimney.castShadow = true;
    workshopGroup.add(chimney);

    const chimneyCap = new THREE.Mesh(new THREE.BoxGeometry(1.35, 0.28, 1.35), roofSnowMat);
    chimneyCap.position.set(-2.6, 8.5, -1.6);
    workshopGroup.add(chimneyCap);

    // Rook-deeltjes uit de schoorsteen
    const smokeMat = new THREE.MeshStandardMaterial({
      color: 0xe2e8f0,
      roughness: 1.0,
      transparent: true,
      opacity: 0.55,
    });
    const smokeGeo = new THREE.SphereGeometry(0.38, 10, 10);
    for (let i = 0; i < 14; i++) {
      const puff = new THREE.Mesh(smokeGeo, smokeMat.clone());
      puff.position.set(-2.6, 8.7 + i * 0.55, -1.6);
      workshopGroup.add(puff);
      workshopState.chimneySmokeParticles.push({
        mesh: puff,
        progress: i / 14,
      });
    }

    // 7.6 Voorportaal (Veranda), Scharnierende Voordeur met Kerstkrans & Bord
    const porchFloor = new THREE.Mesh(new THREE.BoxGeometry(3.8, 0.45, 2.1), stoneFoundationMat);
    porchFloor.position.set(0, 0.225, 4.4);
    porchFloor.receiveShadow = true;
    workshopGroup.add(porchFloor);

    const porchRoof = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.3, 2.4), roofSnowMat);
    porchRoof.position.set(0, 3.85, 4.45);
    porchRoof.rotation.x = 0.24;
    porchRoof.castShadow = true;
    workshopGroup.add(porchRoof);

    // Verandapilaren met snoepstok-strepen
    const pillarGeo = new THREE.CylinderGeometry(0.14, 0.14, 3.3, 16);
    [-1.65, 1.65].forEach((px) => {
      const pillar = new THREE.Mesh(pillarGeo, darkTimberMat);
      pillar.position.set(px, 2.0, 5.25);
      pillar.castShadow = true;
      workshopGroup.add(pillar);
    });

    // Warm verlicht binnenportaal achter de deur (zichtbaar als de deur opengaat)
    const interiorAlcove = new THREE.Mesh(
      new THREE.BoxGeometry(1.5, 2.5, 0.4),
      new THREE.MeshBasicMaterial({ color: 0xffb74d })
    );
    interiorAlcove.position.set(0, 1.85, 3.38);
    workshopGroup.add(interiorAlcove);

    // Scharnierende voordeur
    const doorPivot = new THREE.Group();
    doorPivot.position.set(-0.72, 0.6, 3.52);

    const doorPanel = new THREE.Mesh(
      new THREE.BoxGeometry(1.44, 2.5, 0.14),
      new THREE.MeshStandardMaterial({ color: 0x7c2d12, roughness: 0.65 })
    );
    doorPanel.position.set(0.72, 1.25, 0);
    doorPanel.castShadow = true;
    doorPivot.add(doorPanel);

    // Gouden deurknop
    const doorKnob = new THREE.Mesh(
      new THREE.SphereGeometry(0.08, 12, 12),
      new THREE.MeshStandardMaterial({ color: 0xfacc15, metalness: 0.9, roughness: 0.2 })
    );
    doorKnob.position.set(1.22, 1.2, 0.1);
    doorPivot.add(doorKnob);

    // Kerstkrans op de deur
    const wreath = new THREE.Mesh(
      new THREE.TorusGeometry(0.34, 0.09, 10, 20),
      new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.8 })
    );
    wreath.position.set(0.72, 1.68, 0.1);
    doorPivot.add(wreath);

    const wreathBow = new THREE.Mesh(
      new THREE.BoxGeometry(0.24, 0.14, 0.08),
      new THREE.MeshStandardMaterial({ color: 0xdc2626 })
    );
    wreathBow.position.set(0.72, 1.34, 0.15);
    doorPivot.add(wreathBow);

    workshopGroup.add(doorPivot);
    workshopState.doorPivot = doorPivot;

    // Uithangbord "WERKPLAATS VAN DE KERSTMAN"
    const workshopSignTex = createSignTexture('WERKPLAATS', 'VAN DE KERSTMAN', '#3f1d0b', '#facc15');
    const mainSign = new THREE.Mesh(
      new THREE.BoxGeometry(3.6, 0.95, 0.14),
      new THREE.MeshStandardMaterial({ map: workshopSignTex, roughness: 0.5 })
    );
    mainSign.position.set(0, 4.95, 3.58);
    mainSign.castShadow = true;
    workshopGroup.add(mainSign);

    // 7.7 Warme verlichte ramen met houten kozijnen
    function addWindow(x, y, z, rotY = 0, w = 1.35, h = 1.45) {
      const winGroup = new THREE.Group();
      winGroup.position.set(x, y, z);
      winGroup.rotation.y = rotY;

      const frame = new THREE.Mesh(new THREE.BoxGeometry(w + 0.2, h + 0.2, 0.14), darkTimberMat);
      winGroup.add(frame);

      const glass = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.16), windowGlowMat);
      winGroup.add(glass);

      // Kruisroeden
      const vBar = new THREE.Mesh(new THREE.BoxGeometry(0.08, h, 0.2), darkTimberMat);
      const hBar = new THREE.Mesh(new THREE.BoxGeometry(w, 0.08, 0.2), darkTimberMat);
      winGroup.add(vBar, hBar);

      // Besneeuwde vensterbank
      const sill = new THREE.Mesh(new THREE.BoxGeometry(w + 0.34, 0.16, 0.32), roofSnowMat);
      sill.position.set(0, -h / 2 - 0.06, 0.08);
      winGroup.add(sill);

      workshopGroup.add(winGroup);
    }

    // Voorgevel ramen + rond zolderraam
    addWindow(-2.7, 2.35, 3.5);
    addWindow(2.7, 2.35, 3.5);
    addWindow(0, 6.3, 3.5, 0, 1.0, 1.0);
    // Zijgevel ramen + aanbouw raam
    addWindow(-4.5, 2.35, -1.3, -Math.PI / 2);
    addWindow(-4.5, 2.35, 1.3, -Math.PI / 2);
    addWindow(6.2, 1.95, 1.9, 0, 1.15, 1.15);

    // Warme buitenlamp bij de veranda
    const porchLight = new THREE.PointLight(0xff9e2c, 3.6, 18);
    porchLight.position.set(0, 3.3, 5.0);
    workshopGroup.add(porchLight);
    workshopState.interiorLight = porchLight;

    // 7.8 Cadeautjes op de veranda
    const giftColors = [0xdc2626, 0x16a34a, 0x2563eb, 0x9333ea, 0xeab308];
    const ribbonMat = new THREE.MeshStandardMaterial({ color: 0xfef08a, metalness: 0.4, roughness: 0.3 });

    for (let i = 0; i < 6; i++) {
      const size = 0.42 + (i % 3) * 0.12;
      const giftGroup = new THREE.Group();
      const box = new THREE.Mesh(
        new THREE.BoxGeometry(size, size, size),
        new THREE.MeshStandardMaterial({ color: giftColors[i % giftColors.length], roughness: 0.4 })
      );
      box.castShadow = true;
      giftGroup.add(box);

      const r1 = new THREE.Mesh(new THREE.BoxGeometry(size + 0.02, size + 0.02, size * 0.2), ribbonMat);
      const r2 = new THREE.Mesh(new THREE.BoxGeometry(size * 0.2, size + 0.02, size + 0.02), ribbonMat);
      giftGroup.add(r1, r2);

      const gx = (i < 3 ? -1.25 : 1.25) + (i % 3) * 0.36 - 0.35;
      const gz = 4.2 + (i % 2) * 0.48;
      const baseY = 0.45 + size / 2;
      giftGroup.position.set(gx, baseY, gz);
      giftGroup.rotation.y = i * 0.5;
      workshopGroup.add(giftGroup);

      workshopState.gifts.push({ group: giftGroup, baseY, offset: i * 1.1 });
    }

    workshopState.group = workshopGroup;

    // Registreer de hele werkplaats als klikbaar object
    workshopGroup.userData = {
      clickable: true,
      label: '🏠 Werkplaats van de Kerstman — Klik om deur & speelgoedproductie te schakelen',
      onClick: () => {
        workshopState.isOpen = !workshopState.isOpen;
        workshopState.productionBoostTimer = 5.0;
        playFestiveSound('workshop');

        if (workshopState.isOpen) {
          showToast('🏠 Deur geopend! De elfen draaien op volle toeren in de werkplaats!');
        } else {
          showToast('🏠 Werkplaatsdeur gesloten om de warmte binnen te houden.');
        }
      },
    };
    clickableObjects.push(workshopGroup);

    scene.add(workshopGroup);
  }

  createSantaWorkshop();

  // ==========================================================================
  // 8. MINSTENS VIJF KERSTBOMEN (8 STUKS) MET KNIPPERENDE LICHTJES — KLIKBAAR!
  // ==========================================================================

  const christmasTrees = [];
  const LIGHT_PATTERNS = [
    'Klassiek Knipperen',
    'Disco Golf-Patroon',
    'Warme Gouden Gloed',
    'Snel Sterren-Twinkel',
  ];

  function createChristmasTrees() {
    // Gedeelde materialen voor hoge prestaties (60 FPS)
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x4a2c11, roughness: 0.9 });
    const foliageMat = new THREE.MeshStandardMaterial({ color: 0x0f5132, roughness: 0.78 });
    const snowCapMat = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.7 });
    const starTopperMat = new THREE.MeshStandardMaterial({
      color: 0xfde047,
      emissive: 0xfacc15,
      emissiveIntensity: 1.4,
      metalness: 0.6,
      roughness: 0.2,
    });

    const baubleColors = [0xef4444, 0xfbbf24, 0x3b82f6, 0xe879f9];
    const baubleMats = baubleColors.map(
      (col) => new THREE.MeshStandardMaterial({ color: col, metalness: 0.75, roughness: 0.2 })
    );

    const bulbPalette = [
      new THREE.Color(0xff2a2a), // Rood
      new THREE.Color(0xffd000), // Goudgeel
      new THREE.Color(0x00f59b), // Smaragdgroen
      new THREE.Color(0x22d3ee), // IJscyaan
      new THREE.Color(0xff47da), // Magenta
      new THREE.Color(0xfff4d6), // Warm wit
    ];

    const bulbGeo = new THREE.SphereGeometry(0.095, 8, 8);
    const baubleGeo = new THREE.SphereGeometry(0.12, 10, 10);

    // 8 posities voor rijk versierde kerstbomen rondom de Noordpool en werkplaats
    const treePlacements = [
      { x: -4.5, z: -13.5, scale: 1.18 },
      { x: -18.5, z: -5.5, scale: 1.25 },
      { x: 9.2, z: -7.5, scale: 1.12 },
      { x: 16.5, z: -1.5, scale: 1.0 },
      { x: 7.5, z: 12.5, scale: 0.95 },
      { x: -11.5, z: 7.5, scale: 1.08 },
      { x: -19.0, z: 2.5, scale: 0.92 },
      { x: 2.8, z: -15.5, scale: 1.15 },
    ];

    treePlacements.forEach((cfg, treeIndex) => {
      const treeGroup = new THREE.Group();
      const ty = getTerrainHeight(cfg.x, cfg.z);
      treeGroup.position.set(cfg.x, ty, cfg.z);
      treeGroup.scale.setScalar(cfg.scale);

      // Boomstam
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.4, 1.3, 10), trunkMat);
      trunk.position.y = 0.65;
      trunk.castShadow = true;
      trunk.receiveShadow = true;
      treeGroup.add(trunk);

      // 4 gelaagde dennenkegels met besneeuwde randen
      const tiers = [
        { radius: 2.15, height: 2.1, y: 1.9 },
        { radius: 1.75, height: 1.9, y: 3.1 },
        { radius: 1.32, height: 1.65, y: 4.15 },
        { radius: 0.85, height: 1.35, y: 5.05 },
      ];

      tiers.forEach((tier) => {
        const cone = new THREE.Mesh(new THREE.ConeGeometry(tier.radius, tier.height, 14), foliageMat);
        cone.position.y = tier.y;
        cone.castShadow = true;
        cone.receiveShadow = true;
        treeGroup.add(cone);

        // Sneeuwlaagje op de takken
        const snowCone = new THREE.Mesh(
          new THREE.ConeGeometry(tier.radius * 0.96, tier.height * 0.42, 14),
          snowCapMat
        );
        snowCone.position.y = tier.y + tier.height * 0.27;
        treeGroup.add(snowCone);
      });

      // Kerstballen
      for (let b = 0; b < 14; b++) {
        const t = b / 14;
        const angle = b * 2.35;
        const h = 1.25 + t * 3.6;
        const maxR = THREE.MathUtils.lerp(1.9, 0.52, t);
        const bauble = new THREE.Mesh(baubleGeo, baubleMats[b % baubleMats.length]);
        bauble.position.set(Math.cos(angle) * maxR, h, Math.sin(angle) * maxR);
        treeGroup.add(bauble);
      }

      // Lichtgevende ster op de piek
      const starTopper = new THREE.Mesh(new THREE.OctahedronGeometry(0.36, 0), starTopperMat);
      starTopper.position.y = 5.95;
      starTopper.rotation.y = treeIndex * 0.5;
      treeGroup.add(starTopper);

      // Knipperende kerstlichtjes in een spiraal rond de boom (28 lampjes per boom)
      const bulbs = [];
      const bulbCount = 28;
      for (let i = 0; i < bulbCount; i++) {
        const t = i / (bulbCount - 1);
        const angle = t * Math.PI * 7.5 + treeIndex;
        const y = 1.15 + t * 4.35;
        // Straal volgt het profiel van de kegels
        const baseRadius = THREE.MathUtils.lerp(2.05, 0.38, t) + Math.sin(t * 12.0) * 0.08;

        const baseColor = bulbPalette[(i + treeIndex) % bulbPalette.length];
        const bulbMat = new THREE.MeshBasicMaterial({
          color: baseColor.clone(),
        });

        const bulbMesh = new THREE.Mesh(bulbGeo, bulbMat);
        bulbMesh.position.set(Math.cos(angle) * baseRadius, y, Math.sin(angle) * baseRadius);
        treeGroup.add(bulbMesh);

        bulbs.push({
          mesh: bulbMesh,
          baseColor: baseColor.clone(),
          phase: i * 0.65 + treeIndex * 1.3,
          index: i,
        });
      }

      const treeData = {
        index: treeIndex,
        group: treeGroup,
        starTopper,
        bulbs,
        patternMode: 0,
        shakeTime: 0,
        baseScale: cfg.scale,
      };
      christmasTrees.push(treeData);

      // Elke kerstboom is individueel klikbaar!
      treeGroup.userData = {
        clickable: true,
        label: `🎄 Kerstboom #${treeIndex + 1} — Klik om lichtpatroon te wisselen`,
        onClick: () => {
          treeData.patternMode = (treeData.patternMode + 1) % LIGHT_PATTERNS.length;
          treeData.shakeTime = 0.7;
          playFestiveSound('tree');
          showToast(
            `🎄 Kerstboom #${treeIndex + 1}: Lichtpatroon gewisseld naar "${LIGHT_PATTERNS[treeData.patternMode]}"!`
          );
        },
      };
      clickableObjects.push(treeGroup);

      scene.add(treeGroup);
    });

    // Voeg ook enkele rustige besneeuwde dennenbomen op de heuvels op de achtergrond toe voor diepte
    const bgPinePositions = [
      [-35, -28],
      [-28, -36],
      [25, -32],
      [38, -22],
      [36, 22],
      [-34, 26],
      [0, -40],
      [-42, -8],
    ];
    bgPinePositions.forEach(([bx, bz], i) => {
      const bgPine = new THREE.Group();
      const by = getTerrainHeight(bx, bz);
      bgPine.position.set(bx, by, bz);
      const s = 1.2 + (i % 3) * 0.35;
      bgPine.scale.setScalar(s);

      const c1 = new THREE.Mesh(new THREE.ConeGeometry(2.0, 3.2, 10), foliageMat);
      c1.position.y = 2.0;
      const c2 = new THREE.Mesh(new THREE.ConeGeometry(1.4, 2.6, 10), snowCapMat);
      c2.position.y = 3.6;
      bgPine.add(c1, c2);
      scene.add(bgPine);
    });
  }

  createChristmasTrees();

  // ==========================================================================
  // 9. VALLENDE SNEEUW ALS PARTICLE SYSTEM (THREE.Points)
  // ==========================================================================

  const SNOW_COUNT = 3500;
  const snowPositions = new Float32Array(SNOW_COUNT * 3);
  const snowFallSpeeds = new Float32Array(SNOW_COUNT);
  const snowDriftPhases = new Float32Array(SNOW_COUNT);
  let snowGeometry = null;

  function createSnowParticleSystem() {
    snowGeometry = new THREE.BufferGeometry();

    for (let i = 0; i < SNOW_COUNT; i++) {
      snowPositions[i * 3] = (Math.random() - 0.5) * 150;
      snowPositions[i * 3 + 1] = Math.random() * 65;
      snowPositions[i * 3 + 2] = (Math.random() - 0.5) * 150;

      snowFallSpeeds[i] = 2.2 + Math.random() * 3.4;
      snowDriftPhases[i] = Math.random() * Math.PI * 2;
    }

    snowGeometry.setAttribute('position', new THREE.BufferAttribute(snowPositions, 3));

    const snowMaterial = new THREE.PointsMaterial({
      color: 0xffffff,
      map: softParticleTexture,
      size: 0.52,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
    });

    const snowSystem = new THREE.Points(snowGeometry, snowMaterial);
    scene.add(snowSystem);
  }

  createSnowParticleSystem();

  // ==========================================================================
  // 10. BEWEGENDE OBJECTEN ZONDER INTERACTIE VAN DE USER
  //     A) Vliegende Arrenslee van de Kerstman met Rendieren (in de lucht)
  //     B) Rijdende Noordpool Express Speelgoedtrein (rond de 90° paal)
  //     C) Zwaaiende Sneeuwpop bij de ijsvijver
  // ==========================================================================

  // --- 10.A De Vliegende Arrenslee met Rendieren en Sterrenspoor ---
  const sleighState = {
    group: null,
    reindeerList: [],
    trailPositions: null,
    trailGeo: null,
    time: 0,
  };

  function createFlyingSleigh() {
    const sleighRig = new THREE.Group();

    const redSleighMat = new THREE.MeshStandardMaterial({
      color: 0xc81e1e,
      roughness: 0.35,
      metalness: 0.2,
    });
    const goldRunnerMat = new THREE.MeshStandardMaterial({
      color: 0xfbbf24,
      roughness: 0.25,
      metalness: 0.85,
    });
    const furBrownMat = new THREE.MeshStandardMaterial({
      color: 0x78350f,
      roughness: 0.8,
    });

    // Arrenslee kuip
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.85, 2.4), redSleighMat);
    body.position.set(0, 0.65, -1.5);
    sleighRig.add(body);

    const backRest = new THREE.Mesh(new THREE.BoxGeometry(1.72, 0.9, 0.35), redSleighMat);
    backRest.position.set(0, 1.15, -2.55);
    backRest.rotation.x = -0.25;
    sleighRig.add(backRest);

    // Gouden glijders onder de slee
    [-0.72, 0.72].forEach((rx) => {
      const runner = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 3.1), goldRunnerMat);
      runner.position.set(rx, 0.1, -1.4);
      sleighRig.add(runner);

      const curl = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.05, 8, 16, Math.PI), goldRunnerMat);
      curl.rotation.y = Math.PI / 2;
      curl.position.set(rx, 0.42, 0.12);
      sleighRig.add(curl);
    });

    // De Kerstman + Grote Jute Cadeauzak in de slee
    const giftSack = new THREE.Mesh(
      new THREE.SphereGeometry(0.75, 14, 12),
      new THREE.MeshStandardMaterial({ color: 0x92400e, roughness: 0.9 })
    );
    giftSack.position.set(0, 1.25, -2.05);
    sleighRig.add(giftSack);

    const santaTorso = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.42, 0.85, 12), redSleighMat);
    santaTorso.position.set(0, 1.2, -1.05);
    sleighRig.add(santaTorso);

    const santaHead = new THREE.Mesh(
      new THREE.SphereGeometry(0.26, 12, 12),
      new THREE.MeshStandardMaterial({ color: 0xfed7aa })
    );
    santaHead.position.set(0, 1.78, -1.05);
    sleighRig.add(santaHead);

    const santaBeard = new THREE.Mesh(
      new THREE.SphereGeometry(0.24, 10, 10),
      new THREE.MeshStandardMaterial({ color: 0xffffff })
    );
    santaBeard.position.set(0, 1.68, -0.88);
    sleighRig.add(santaBeard);

    const santaHat = new THREE.Mesh(new THREE.ConeGeometry(0.26, 0.55, 12), redSleighMat);
    santaHat.position.set(0, 2.12, -1.1);
    santaHat.rotation.x = -0.25;
    sleighRig.add(santaHat);

    // 4 Rendieren voor de slee (voorste rendier heeft Rudolfs lichtgevende rode neus!)
    const reindeerOffsets = [
      { x: -0.65, z: 1.5, isRudolf: false },
      { x: 0.65, z: 1.5, isRudolf: false },
      { x: -0.65, z: 3.6, isRudolf: false },
      { x: 0.65, z: 3.6, isRudolf: true },
    ];

    reindeerOffsets.forEach((rcfg, idx) => {
      const deer = new THREE.Group();
      deer.position.set(rcfg.x, 0.55, rcfg.z);

      const deerBody = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.48, 1.05), furBrownMat);
      deer.add(deerBody);

      const deerNeck = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.55, 0.28), furBrownMat);
      deerNeck.position.set(0, 0.36, 0.42);
      deerNeck.rotation.x = 0.35;
      deer.add(deerNeck);

      const deerHead = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.28, 0.46), furBrownMat);
      deerHead.position.set(0, 0.6, 0.62);
      deer.add(deerHead);

      if (rcfg.isRudolf) {
        const redNose = new THREE.Mesh(
          new THREE.SphereGeometry(0.09, 10, 10),
          new THREE.MeshBasicMaterial({ color: 0xff1e1e })
        );
        redNose.position.set(0, 0.62, 0.88);
        deer.add(redNose);
      }

      // Gewei
      const antlerMat = new THREE.MeshStandardMaterial({ color: 0xd6d3d1 });
      [-0.12, 0.12].forEach((ax) => {
        const antler = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.035, 0.42, 6), antlerMat);
        antler.position.set(ax, 0.88, 0.52);
        antler.rotation.z = ax > 0 ? -0.35 : 0.35;
        deer.add(antler);
      });

      // 4 beweegbare poten
      const legs = [];
      const legGeo = new THREE.BoxGeometry(0.1, 0.52, 0.1);
      [
        [-0.15, -0.32, 0.35],
        [0.15, -0.32, 0.35],
        [-0.15, -0.32, -0.35],
        [0.15, -0.32, -0.35],
      ].forEach(([lx, ly, lz]) => {
        const leg = new THREE.Mesh(legGeo, furBrownMat);
        leg.position.set(lx, ly, lz);
        deer.add(leg);
        legs.push(leg);
      });

      sleighRig.add(deer);
      sleighState.reindeerList.push({ group: deer, legs, phase: idx * 0.9 });
    });

    // Gouden teugels en warme lantaarn onder de slee
    const reinLineMat = new THREE.LineBasicMaterial({ color: 0xfde047 });
    [-0.65, 0.65].forEach((rx) => {
      const points = [
        new THREE.Vector3(rx, 0.9, -0.5),
        new THREE.Vector3(rx, 0.8, 1.5),
        new THREE.Vector3(rx, 0.8, 3.6),
      ];
      const reinGeo = new THREE.BufferGeometry().setFromPoints(points);
      sleighRig.add(new THREE.Line(reinGeo, reinLineMat));
    });

    const sleighLight = new THREE.PointLight(0xffd166, 2.5, 22);
    sleighLight.position.set(0, -0.3, 0);
    sleighRig.add(sleighLight);

    scene.add(sleighRig);
    sleighState.group = sleighRig;

    // Magisch gouden sterrenstof-spoor achter de arrenslee
    const trailCount = 55;
    sleighState.trailPositions = new Float32Array(trailCount * 3);
    sleighState.trailGeo = new THREE.BufferGeometry();
    sleighState.trailGeo.setAttribute('position', new THREE.BufferAttribute(sleighState.trailPositions, 3));

    const trailMat = new THREE.PointsMaterial({
      color: 0xfde047,
      map: softParticleTexture,
      size: 0.75,
      transparent: true,
      opacity: 0.8,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const trailPoints = new THREE.Points(sleighState.trailGeo, trailMat);
    scene.add(trailPoints);
  }

  createFlyingSleigh();

  // --- 10.B Rijdende Noordpool Express Speelgoedtrein (Rond de 90° Noordpoolpaal) ---
  const trainState = {
    pivotGroup: null,
    engineGroup: null,
    angle: 0,
    baseSpeed: 0.55,
    boostTimer: 0,
    wheels: [],
    steamPuffs: [],
  };

  function createNorthPoleTrain() {
    const trackRadius = 4.2;
    const poleCenterX = 0;
    const poleCenterZ = 2;
    const groundY = getTerrainHeight(poleCenterX, poleCenterZ) + 0.04;

    const trainRoot = new THREE.Group();
    trainRoot.position.set(poleCenterX, groundY, poleCenterZ);

    // Spoorrails & Houten bielzen
    const railMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.8, roughness: 0.3 });
    const innerRail = new THREE.Mesh(new THREE.TorusGeometry(trackRadius - 0.24, 0.035, 8, 64), railMat);
    innerRail.rotation.x = Math.PI / 2;
    innerRail.position.y = 0.06;
    trainRoot.add(innerRail);

    const outerRail = new THREE.Mesh(new THREE.TorusGeometry(trackRadius + 0.24, 0.035, 8, 64), railMat);
    outerRail.rotation.x = Math.PI / 2;
    outerRail.position.y = 0.06;
    trainRoot.add(outerRail);

    const sleeperGeo = new THREE.BoxGeometry(0.76, 0.05, 0.16);
    const sleeperMat = new THREE.MeshStandardMaterial({ color: 0x451a03, roughness: 0.9 });
    const sleeperCount = 44;
    for (let i = 0; i < sleeperCount; i++) {
      const a = (i / sleeperCount) * Math.PI * 2;
      const sleeper = new THREE.Mesh(sleeperGeo, sleeperMat);
      sleeper.position.set(Math.cos(a) * trackRadius, 0.025, Math.sin(a) * trackRadius);
      sleeper.rotation.y = -a;
      trainRoot.add(sleeper);
    }

    // Draaiende pivot voor de locomotief + cadeautjeswagon
    const pivot = new THREE.Group();
    trainRoot.add(pivot);
    trainState.pivotGroup = pivot;

    const trainAssembly = new THREE.Group();
    pivot.add(trainAssembly);
    trainState.engineGroup = trainAssembly;

    const redMetal = new THREE.MeshStandardMaterial({ color: 0xdc2626, metalness: 0.3, roughness: 0.4 });
    const darkIron = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.6, roughness: 0.4 });
    const brassMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, metalness: 0.8, roughness: 0.25 });
    const greenWagonMat = new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.45 });

    // Locomotief op de cirkelbaan
    const locoGroup = new THREE.Group();
    locoGroup.position.set(trackRadius, 0.24, 0);

    const chassis = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.18, 1.45), redMetal);
    chassis.castShadow = true;
    locoGroup.add(chassis);

    const boiler = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.9, 16), darkIron);
    boiler.rotation.x = Math.PI / 2;
    boiler.position.set(0, 0.32, 0.2);
    boiler.castShadow = true;
    locoGroup.add(boiler);

    const cabin = new THREE.Mesh(new THREE.BoxGeometry(0.64, 0.68, 0.55), redMetal);
    cabin.position.set(0, 0.42, -0.42);
    cabin.castShadow = true;
    locoGroup.add(cabin);

    const cabinRoof = new THREE.Mesh(new THREE.BoxGeometry(0.74, 0.1, 0.66), brassMat);
    cabinRoof.position.set(0, 0.78, -0.42);
    locoGroup.add(cabinRoof);

    const smokestack = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.09, 0.42, 12), darkIron);
    smokestack.position.set(0, 0.66, 0.46);
    locoGroup.add(smokestack);

    const headlamp = new THREE.Mesh(
      new THREE.CylinderGeometry(0.1, 0.1, 0.1, 12),
      new THREE.MeshBasicMaterial({ color: 0xfef08a })
    );
    headlamp.rotation.x = Math.PI / 2;
    headlamp.position.set(0, 0.34, 0.68);
    locoGroup.add(headlamp);

    // Wielen van de locomotief
    const wheelGeo = new THREE.CylinderGeometry(0.17, 0.17, 0.08, 14);
    wheelGeo.rotateZ(Math.PI / 2);
    [
      [-0.34, -0.05, 0.4],
      [0.34, -0.05, 0.4],
      [-0.34, -0.05, -0.35],
      [0.34, -0.05, -0.35],
    ].forEach(([wx, wy, wz]) => {
      const wheel = new THREE.Mesh(wheelGeo, brassMat);
      wheel.position.set(wx, wy, wz);
      locoGroup.add(wheel);
      trainState.wheels.push(wheel);
    });

    // Stoompluimen uit de locomotief
    const puffGeo = new THREE.SphereGeometry(0.14, 8, 8);
    const puffMat = new THREE.MeshBasicMaterial({ color: 0xf8fafc, transparent: true, opacity: 0.75 });
    for (let p = 0; p < 5; p++) {
      const puff = new THREE.Mesh(puffGeo, puffMat.clone());
      locoGroup.add(puff);
      trainState.steamPuffs.push({ mesh: puff, progress: p / 5 });
    }

    trainAssembly.add(locoGroup);

    // Cadeau-wagon achter de locomotief
    const wagonPivot = new THREE.Group();
    wagonPivot.rotation.y = 0.38;
    const wagonGroup = new THREE.Group();
    wagonGroup.position.set(trackRadius, 0.24, 0);

    // Koppeling tussen locomotief en wagon
    const coupler = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.08, 0.65), darkIron);
    coupler.position.set(0, 0.05, 0.72);
    wagonGroup.add(coupler);

    const wagonBody = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.36, 1.05), greenWagonMat);
    wagonBody.position.y = 0.14;
    wagonBody.castShadow = true;
    wagonGroup.add(wagonBody);

    const wagonGift = new THREE.Mesh(
      new THREE.BoxGeometry(0.42, 0.42, 0.42),
      new THREE.MeshStandardMaterial({ color: 0xfbbf24 })
    );
    wagonGift.position.set(0, 0.44, 0);
    wagonGroup.add(wagonGift);

    wagonPivot.add(wagonGroup);
    trainAssembly.add(wagonPivot);

    // Klikbaar maken van het treintje
    trainAssembly.userData = {
      clickable: true,
      label: '🚂 Noordpool Express Trein — Klik voor Stoomfluit & Turboboost!',
      onClick: () => {
        trainState.boostTimer = 4.0;
        playFestiveSound('train');
        showToast('🚂 Toet-toet! De Noordpool Express schiet op volle stoom vooruit!');
      },
    };
    clickableObjects.push(trainAssembly);

    scene.add(trainRoot);
  }

  createNorthPoleTrain();

  // --- 10.C Vrolijke Sneeuwpop bij de bevroren vijver (beweegt & is klikbaar) ---
  const snowmanState = {
    group: null,
    hatGroup: null,
    leftArm: null,
    rightArm: null,
    baseY: 0,
    jumpProgress: 0,
  };

  function createSnowman() {
    const smGroup = new THREE.Group();
    const sx = 8.2;
    const sz = 4.8;
    const sy = getTerrainHeight(sx, sz);
    smGroup.position.set(sx, sy, sz);
    smGroup.rotation.y = -0.45;
    snowmanState.baseY = sy;

    const snowMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.65 });
    const coalMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.5 });
    const carrotMat = new THREE.MeshStandardMaterial({ color: 0xf97316, roughness: 0.5 });
    const scarfMat = new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.7 });

    const bottomBall = new THREE.Mesh(new THREE.SphereGeometry(0.68, 18, 16), snowMat);
    bottomBall.position.y = 0.6;
    bottomBall.castShadow = true;
    smGroup.add(bottomBall);

    const middleBall = new THREE.Mesh(new THREE.SphereGeometry(0.48, 18, 16), snowMat);
    middleBall.position.y = 1.48;
    middleBall.castShadow = true;
    smGroup.add(middleBall);

    const headBall = new THREE.Mesh(new THREE.SphereGeometry(0.35, 16, 16), snowMat);
    headBall.position.y = 2.15;
    headBall.castShadow = true;
    smGroup.add(headBall);

    // Wortelneus & Ogen
    const nose = new THREE.Mesh(new THREE.ConeGeometry(0.065, 0.36, 10), carrotMat);
    nose.rotation.x = Math.PI / 2;
    nose.position.set(0, 2.15, 0.44);
    smGroup.add(nose);

    [-0.12, 0.12].forEach((ex) => {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 8), coalMat);
      eye.position.set(ex, 2.24, 0.31);
      smGroup.add(eye);
    });

    // Rode Sjaal
    const scarf = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.08, 10, 20), scarfMat);
    scarf.rotation.x = Math.PI / 2;
    scarf.position.y = 1.85;
    smGroup.add(scarf);

    // Hoge Hoed
    const hatGroup = new THREE.Group();
    hatGroup.position.y = 2.45;
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.05, 18), coalMat);
    const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.22, 0.42, 18), coalMat);
    crown.position.y = 0.22;
    hatGroup.add(brim, crown);
    smGroup.add(hatGroup);
    snowmanState.hatGroup = hatGroup;

    // Zwaaiende takken-armen
    const twigMat = new THREE.MeshStandardMaterial({ color: 0x451a03 });
    const leftArm = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, 0.75, 6), twigMat);
    leftArm.position.set(-0.62, 1.55, 0);
    leftArm.rotation.z = 1.1;
    smGroup.add(leftArm);
    snowmanState.leftArm = leftArm;

    const rightArm = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, 0.75, 6), twigMat);
    rightArm.position.set(0.62, 1.55, 0);
    rightArm.rotation.z = -1.1;
    smGroup.add(rightArm);
    snowmanState.rightArm = rightArm;

    snowmanState.group = smGroup;

    smGroup.userData = {
      clickable: true,
      label: '⛄ Sneeuwpop Olaf — Klik om een vreugdesprong te maken!',
      onClick: () => {
        snowmanState.jumpProgress = 1.0;
        playFestiveSound('snowman');
        showToast('⛄ Sneeuwpop Olaf maakt een vrolijke sprong en neemt zijn hoed voor je af!');
      },
    };
    clickableObjects.push(smGroup);

    scene.add(smGroup);
  }

  createSnowman();

  // ==========================================================================
  // 11. INTERACTIE: RAYCASTING, HOVER-TOOLTIPS, CAMERA-KNOPPEN & UI
  // ==========================================================================

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const tooltipEl = document.getElementById('hover-tooltip');
  const tooltipTextEl = document.getElementById('tooltip-text');
  const toastEl = document.getElementById('action-toast');

  let toastTimeout = null;
  function showToast(message) {
    if (!toastEl) return;
    toastEl.textContent = message;
    toastEl.classList.remove('hidden');
    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => {
      toastEl.classList.add('hidden');
    }, 3400);
  }

  /**
   * Zoekt in de parent-keten van een geraakte mesh naar de hoofdgroep met `userData.clickable`.
   */
  function findClickableRoot(object3D) {
    let curr = object3D;
    while (curr) {
      if (curr.userData && curr.userData.clickable) {
        return curr;
      }
      curr = curr.parent;
    }
    return null;
  }

  let pointerDownPos = { x: 0, y: 0 };

  window.addEventListener('pointermove', (event) => {
    pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
    pointer.y = -(event.clientY / window.innerHeight) * 2 + 1;

    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObjects(clickableObjects, true);

    if (hits.length > 0) {
      const targetRoot = findClickableRoot(hits[0].object);
      if (targetRoot) {
        document.body.style.cursor = 'pointer';
        tooltipTextEl.textContent = targetRoot.userData.label;
        tooltipEl.style.left = `${event.clientX}px`;
        tooltipEl.style.top = `${event.clientY}px`;
        tooltipEl.classList.remove('hidden');
        return;
      }
    }

    document.body.style.cursor = 'default';
    tooltipEl.classList.add('hidden');
  });

  renderer.domElement.addEventListener('pointerdown', (event) => {
    pointerDownPos.x = event.clientX;
    pointerDownPos.y = event.clientY;
  });

  renderer.domElement.addEventListener('pointerup', (event) => {
    // Alleen als de gebruiker daadwerkelijk klikt (niet tijdens het slepen van de camera)
    const dragDist = Math.hypot(event.clientX - pointerDownPos.x, event.clientY - pointerDownPos.y);
    if (dragDist > 6) return;

    pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
    pointer.y = -(event.clientY / window.innerHeight) * 2 + 1;

    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObjects(clickableObjects, true);

    if (hits.length > 0) {
      const targetRoot = findClickableRoot(hits[0].object);
      if (targetRoot && typeof targetRoot.userData.onClick === 'function') {
        targetRoot.userData.onClick();
      }
    }
  });

  // Camera-standpunten in het zijpaneel
  let activeCameraMode = 'overview';
  let cameraTransition = null;

  const cameraButtons = document.querySelectorAll('.cam-btn');
  cameraButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      cameraButtons.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      const view = btn.dataset.view;
      activeCameraMode = view;

      if (view === 'overview') {
        cameraTransition = {
          pos: new THREE.Vector3(18, 11, 28),
          target: new THREE.Vector3(-2, 3.5, -2),
        };
      } else if (view === 'pole') {
        cameraTransition = {
          pos: new THREE.Vector3(0.5, 4.2, 10.2),
          target: new THREE.Vector3(0, 3.2, 2),
        };
      } else if (view === 'workshop') {
        cameraTransition = {
          pos: new THREE.Vector3(-3.5, 5.2, -1.2),
          target: new THREE.Vector3(-12, 3.2, -11),
        };
      } else if (view === 'sleigh') {
        cameraTransition = null;
        showToast('🦌 Camera volgt nu de vliegende arrenslee van de Kerstman!');
      }
    });
  });

  // Stop automatische camera-transitie zodra de gebruiker zelf met de muis draait
  controls.addEventListener('start', () => {
    cameraTransition = null;
    if (activeCameraMode === 'sleigh') {
      activeCameraMode = 'overview';
      cameraButtons.forEach((b) => b.classList.toggle('active', b.dataset.view === 'overview'));
    }
  });

  // Geluid & Paneel knoppen
  const soundBtn = document.getElementById('toggle-sound-btn');
  if (soundBtn) {
    soundBtn.addEventListener('click', () => {
      soundEnabled = !soundEnabled;
      soundBtn.textContent = soundEnabled ? '🔊 Geluid: Aan' : '🔇 Geluid: Uit';
    });
  }

  const uiBtn = document.getElementById('toggle-ui-btn');
  const infoPanel = document.getElementById('info-panel');
  if (uiBtn && infoPanel) {
    uiBtn.addEventListener('click', () => {
      infoPanel.classList.toggle('collapsed');
    });
  }

  // ==========================================================================
  // 12. ANIMATIELUS (60 FPS) & WINDOW RESIZE
  // ==========================================================================

  const clock = new THREE.Clock();
  const fpsCounterEl = document.getElementById('fps-counter');
  let frameCount = 0;
  let fpsAccumulator = 0;

  // Herbruikbare vectoren in de animatielus (voorkomt garbage collection en houdt 60 FPS stabiel)
  const sleighCurrentPos = new THREE.Vector3();
  const sleighNextPos = new THREE.Vector3();
  const sleighFollowCameraPos = new THREE.Vector3();
  const trailSpawnVec = new THREE.Vector3();

  function animate() {
    requestAnimationFrame(animate);

    const delta = Math.min(clock.getDelta(), 0.1);
    const elapsed = clock.getElapsedTime();

    // 12.1 FPS-meter bijwerken
    frameCount++;
    fpsAccumulator += delta;
    if (fpsAccumulator >= 0.5) {
      const currentFps = Math.round(frameCount / fpsAccumulator);
      if (fpsCounterEl) {
        fpsCounterEl.textContent = `${currentFps} FPS`;
      }
      frameCount = 0;
      fpsAccumulator = 0;
    }

    // 12.2 Noorderlicht (Aurora Borealis) bijwerken
    if (auroraMaterial) {
      auroraMaterial.uniforms.uTime.value = elapsed;
      auroraBoost = Math.max(0, auroraBoost - delta * 0.45);
      auroraMaterial.uniforms.uBoost.value = auroraBoost;
    }

    // 12.3 Vallende sneeuw (Particle System) bijwerken
    if (snowGeometry) {
      const posAttr = snowGeometry.attributes.position;
      const arr = posAttr.array;

      for (let i = 0; i < SNOW_COUNT; i++) {
        const idx3 = i * 3;
        // Zijwaartse poolwind + individuele dwarreling
        arr[idx3] += Math.sin(elapsed * 0.8 + snowDriftPhases[i]) * 0.65 * delta;
        arr[idx3 + 1] -= snowFallSpeeds[i] * delta;
        arr[idx3 + 2] += Math.cos(elapsed * 0.6 + snowDriftPhases[i]) * 0.45 * delta;

        // Zodra een sneeuwvlok de grond bereikt, plaats hem weer bovenaan
        if (arr[idx3 + 1] < 0) {
          arr[idx3 + 1] = 65;
          arr[idx3] = (Math.random() - 0.5) * 150;
          arr[idx3 + 2] = (Math.random() - 0.5) * 150;
        }
      }
      posAttr.needsUpdate = true;
    }

    // 12.4 Noordpoolpaal (90° N) wereldbol & sterrenvuurwerk animeren
    if (northPoleState.globeMesh) {
      northPoleState.spinVelocity = THREE.MathUtils.lerp(northPoleState.spinVelocity, 0.8, delta * 1.8);
      northPoleState.globeMesh.rotation.y += northPoleState.spinVelocity * delta;
    }

    if (northPoleState.burstLife > 0 && northPoleState.burstParticles) {
      northPoleState.burstLife = Math.max(0, northPoleState.burstLife - delta * 0.65);
      const attr = northPoleState.burstParticles.geometry.attributes.position;
      for (let i = 0; i < northPoleState.burstVelocities.length; i++) {
        const vel = northPoleState.burstVelocities[i];
        vel.y -= 5.8 * delta; // Zwaartekracht
        attr.setXYZ(
          i,
          attr.getX(i) + vel.x * delta,
          attr.getY(i) + vel.y * delta,
          attr.getZ(i) + vel.z * delta
        );
      }
      attr.needsUpdate = true;
      northPoleState.burstParticles.material.opacity = northPoleState.burstLife;
    }

    // 12.5 Werkplaats van de Kerstman: Deur, Rookpluimen & Cadeaus
    const targetDoorAngle = workshopState.isOpen ? -Math.PI * 0.62 : 0;
    workshopState.doorAngle = THREE.MathUtils.lerp(workshopState.doorAngle, targetDoorAngle, delta * 5.0);
    if (workshopState.doorPivot) {
      workshopState.doorPivot.rotation.y = workshopState.doorAngle;
    }

    if (workshopState.productionBoostTimer > 0) {
      workshopState.productionBoostTimer = Math.max(0, workshopState.productionBoostTimer - delta);
    }

    const smokeSpeed = workshopState.productionBoostTimer > 0 ? 0.58 : 0.25;
    workshopState.chimneySmokeParticles.forEach((p, idx) => {
      p.progress = (p.progress + delta * smokeSpeed) % 1;
      const t = p.progress;
      p.mesh.position.set(
        -2.6 + Math.sin(elapsed * 1.5 + idx) * t * 1.2,
        8.6 + t * 6.8,
        -1.6 + Math.cos(elapsed * 1.1 + idx) * t * 0.9
      );
      const scale = 0.55 + t * 2.1;
      p.mesh.scale.setScalar(scale);
      p.mesh.material.opacity = (1 - t) * 0.52;
    });

    if (workshopState.interiorLight) {
      const baseIntensity = workshopState.isOpen ? 5.2 : 3.4;
      workshopState.interiorLight.intensity = baseIntensity + Math.sin(elapsed * 6.0) * 0.35;
    }

    workshopState.gifts.forEach((g) => {
      if (workshopState.productionBoostTimer > 0) {
        g.group.position.y = g.baseY + Math.abs(Math.sin(elapsed * 7.5 + g.offset)) * 0.35;
      } else {
        g.group.position.y = THREE.MathUtils.lerp(g.group.position.y, g.baseY, delta * 6);
      }
    });

    // 12.6 Knipperende Kerstboomlichtjes (alle 8 bomen)
    christmasTrees.forEach((tree) => {
      tree.starTopper.rotation.y += delta * 1.2;

      if (tree.shakeTime > 0) {
        tree.shakeTime = Math.max(0, tree.shakeTime - delta);
        tree.group.rotation.z = Math.sin(elapsed * 32) * 0.06 * tree.shakeTime;
      } else {
        tree.group.rotation.z = 0;
      }

      tree.bulbs.forEach((bulb) => {
        let brightness = 1.0;
        if (tree.patternMode === 0) {
          // Klassiek Knipperen: elk lampje knippert op zijn eigen ritme
          const wave = Math.sin(elapsed * 4.2 + bulb.phase);
          brightness = wave > -0.15 ? 0.95 : 0.15;
          bulb.mesh.material.color.copy(bulb.baseColor).multiplyScalar(brightness);
        } else if (tree.patternMode === 1) {
          // Disco Golf-patroon langs de spiraal
          const chase = 0.5 + 0.5 * Math.sin(elapsed * 9.0 - bulb.index * 0.45);
          bulb.mesh.material.color.setHSL(((elapsed * 0.35 + bulb.index * 0.04) % 1), 0.95, 0.15 + chase * 0.5);
          brightness = 0.4 + chase * 0.9;
        } else if (tree.patternMode === 2) {
          // Warme Gouden Gloed
          const pulse = 0.65 + 0.35 * Math.sin(elapsed * 3.0 + bulb.phase * 0.5);
          bulb.mesh.material.color.setRGB(1.0 * pulse, 0.82 * pulse, 0.35 * pulse);
          brightness = pulse;
        } else {
          // Snel Sterren-Twinkel
          const fast = Math.sin(elapsed * 14.0 + bulb.phase * 2.3) > 0 ? 1.15 : 0.12;
          bulb.mesh.material.color.copy(bulb.baseColor).multiplyScalar(fast);
          brightness = fast;
        }

        const bulbScale = 0.72 + brightness * 0.48;
        bulb.mesh.scale.setScalar(bulbScale);
      });
    });

    // 12.7 Autonoom vliegende Arrenslee van de Kerstman (figuur-8 baan door de lucht)
    if (sleighState.group) {
      sleighState.time += delta * 0.38;
      const t = sleighState.time;

      sleighCurrentPos.set(
        Math.sin(t) * 26,
        17.5 + Math.cos(t * 2) * 2.4,
        Math.sin(t * 2) * 14 - 5
      );
      const tNext = t + 0.04;
      sleighNextPos.set(
        Math.sin(tNext) * 26,
        17.5 + Math.cos(tNext * 2) * 2.4,
        Math.sin(tNext * 2) * 14 - 5
      );

      sleighState.group.position.copy(sleighCurrentPos);
      sleighState.group.lookAt(sleighNextPos);

      // Galopperende rendierpoten
      sleighState.reindeerList.forEach((deer) => {
        const gallop = elapsed * 10.5 + deer.phase;
        deer.legs[0].rotation.x = Math.sin(gallop) * 0.55;
        deer.legs[1].rotation.x = Math.cos(gallop) * 0.55;
        deer.legs[2].rotation.x = -Math.sin(gallop) * 0.55;
        deer.legs[3].rotation.x = -Math.cos(gallop) * 0.55;
        deer.group.position.y = 0.55 + Math.abs(Math.sin(gallop)) * 0.12;
      });

      // Sterrenstof-spoor achter de arrenslee bijwerken
      if (sleighState.trailGeo) {
        const arr = sleighState.trailPositions;
        for (let i = arr.length - 3; i >= 3; i -= 3) {
          arr[i] = arr[i - 3];
          arr[i + 1] = arr[i - 2] - 0.02;
          arr[i + 2] = arr[i - 1];
        }
        trailSpawnVec.set(0, 0.5, -2.6);
        sleighState.group.localToWorld(trailSpawnVec);
        arr[0] = trailSpawnVec.x + (Math.random() - 0.5) * 0.45;
        arr[1] = trailSpawnVec.y + (Math.random() - 0.5) * 0.25;
        arr[2] = trailSpawnVec.z + (Math.random() - 0.5) * 0.45;
        sleighState.trailGeo.attributes.position.needsUpdate = true;
      }

      if (activeCameraMode === 'sleigh') {
        sleighFollowCameraPos.set(
          sleighCurrentPos.x - 10,
          sleighCurrentPos.y + 4.5,
          sleighCurrentPos.z - 12
        );
        camera.position.lerp(sleighFollowCameraPos, delta * 3.0);
        controls.target.lerp(sleighCurrentPos, delta * 5.0);
      }
    }

    // 12.8 Autonoom rijdend Speelgoedtreintje rond de 90° Noordpoolpaal
    if (trainState.pivotGroup) {
      if (trainState.boostTimer > 0) {
        trainState.boostTimer = Math.max(0, trainState.boostTimer - delta);
      }
      const speedMultiplier = trainState.boostTimer > 0 ? 3.2 : 1.0;
      const angularSpeed = trainState.baseSpeed * speedMultiplier;

      trainState.angle -= angularSpeed * delta;
      trainState.pivotGroup.rotation.y = trainState.angle;

      trainState.wheels.forEach((w) => {
        w.rotation.x += angularSpeed * 5.5 * delta;
      });

      trainState.steamPuffs.forEach((p) => {
        p.progress = (p.progress + delta * (1.2 * speedMultiplier)) % 1;
        const st = p.progress;
        p.mesh.position.set(0, 0.85 + st * 1.35, 0.46 - st * 0.55);
        p.mesh.scale.setScalar(0.5 + st * 1.4);
        p.mesh.material.opacity = (1 - st) * 0.65;
      });
    }

    // 12.9 Sneeuwpop Olaf (continu zachtjes wiegen + vreugdesprong bij klik)
    if (snowmanState.group) {
      snowmanState.leftArm.rotation.z = 1.1 + Math.sin(elapsed * 2.8) * 0.25;
      snowmanState.rightArm.rotation.z = -1.1 + Math.cos(elapsed * 2.8) * 0.25;

      if (snowmanState.jumpProgress > 0) {
        snowmanState.jumpProgress = Math.max(0, snowmanState.jumpProgress - delta * 1.3);
        const jumpArc = Math.sin(snowmanState.jumpProgress * Math.PI);
        snowmanState.group.position.y = snowmanState.baseY + jumpArc * 1.45;
        snowmanState.group.rotation.y = -0.45 + (1 - snowmanState.jumpProgress) * Math.PI * 2;
        snowmanState.hatGroup.position.y = 2.45 + jumpArc * 0.55;
        snowmanState.hatGroup.rotation.z = jumpArc * 0.4;
      } else {
        snowmanState.group.position.y = snowmanState.baseY;
        snowmanState.hatGroup.position.y = 2.45;
        snowmanState.hatGroup.rotation.z = Math.sin(elapsed * 1.6) * 0.05;
      }
    }

    // 12.10 Vloeiende camera-overgang bij klikken op camerastandpunten
    if (cameraTransition) {
      camera.position.lerp(cameraTransition.pos, delta * 4.2);
      controls.target.lerp(cameraTransition.target, delta * 4.2);
      if (camera.position.distanceTo(cameraTransition.pos) < 0.15) {
        cameraTransition = null;
      }
    }

    controls.update();
    renderer.render(scene, camera);
  }

  animate();

  // Venstergrootte aanpassen bij schalen van het browservenster
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });
};

// Start direct indien de module-loader al klaar is
if (window.THREE && window.OrbitControls) {
  window.initNoordpoolScene();
}
