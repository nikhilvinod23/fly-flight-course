(() => {
  "use strict";

  let THREE = null;

  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  const retinaCanvas = document.getElementById("retina-preview");
  const retinaCtx = retinaCanvas.getContext("2d", { willReadFrequently: true });
  const flyView = document.getElementById("fly-view");
  const ui = {
    status: document.getElementById("status-label"),
    episode: document.getElementById("episode-label"),
    rings: document.getElementById("rings-count"),
    targets: document.getElementById("targets-count"),
    message: document.getElementById("message-label"),
    card: document.getElementById("start-card"),
    start: document.getElementById("start-button"),
    run: document.getElementById("run-button"),
    resetLearning: document.getElementById("reset-learning"),
    action: document.getElementById("action-label"),
    reward: document.getElementById("reward-label"),
    learning: document.getElementById("learning-label"),
    visualLeft: document.getElementById("visual-left"),
    visualRight: document.getElementById("visual-right"),
    motorLeft: document.getElementById("motor-left"),
    motorRight: document.getElementById("motor-right"),
    spontaneous: document.getElementById("spontaneous-drive"),
    frontLimb: document.getElementById("front-limb"),
    dopamine: document.getElementById("dopamine")
  };

  const COLORS = { ink: "#111820", blue: "#005c9e", red: "#a62c2c", green: "#1e6b49", paper: "#f4f1e8", sky: "#d7e4e9", grid: "#9db5bd" };
  const RING_COLORS = ["#216eaa", "#c26718", "#2f7d55", "#7548a8", "#a53463"];
  const ACTIONS = [-1, -0.5, 0, 0.5, 1];
  const COURSE_LENGTH = 7300;
  const SPEED = 360;
  const LATERAL_SPEED = 270;
  const RING_RADIUS = 165;
  const RING_CLEARANCE = 16;
  const TARGET_HIT_RADIUS = 82;
  const BULLET_SPEED = 920;
  const RING_SPACING = 650;
  const LEARNING_RATE = 0.08;
  const RETINA_WIDTH = 48;
  const RETINA_HEIGHT = 27;

  const ringX = [-250, 190, -80, 245, -220, 70, -245, 225, -35, 250];
  const ringAngles = [-0.18, 0.52, -0.86, 0.28, 1.12, -0.42, 0.74, -1.02, 0.36, -0.64];
  const rings = ringX.map((x, index) => ({ x, y: 0, z: 700 + index * RING_SPACING, angle: ringAngles[index], color: RING_COLORS[index % RING_COLORS.length], result: null }));
  const targetBlueprint = [{ x: -40, z: 1600 }, { x: 60, z: 4600 }];

  let width = 1000;
  let height = 600;
  let player;
  let targets;
  let bullets;
  let explosions;
  let time = 0;
  let episode = 0;
  let running = false;
  let lastTime = 0;
  let nextRingIndex = 0;
  let nextTargetIndex = 0;
  let lastReward = 0;
  let rewardFlash = 0;
  let actionIndex = 2;
  let preferences = ACTIONS.map(() => ACTIONS.map(() => 0));
  let eligibility = ACTIONS.map(() => 0);
  let sensorySeed = 0x4f1bbcdc;
  let previousRetinaColumns = new Array(RETINA_WIDTH).fill(0);
  const neural = {
    visualLeft: 0,
    visualRight: 0,
    motorLeft: 0,
    motorRight: 0,
    frontLimb: 0,
    dopamine: 0,
    moveX: 0,
    context: 2,
    fireCooldown: 0,
    decisionTimer: 0,
    noiseTimer: 0,
    spontaneousDrive: 0,
    turnBias: 0
  };

  const three = {
    renderer: null,
    scene: null,
    camera: null,
    fly: null,
    frontLegs: [],
    wings: [],
    clock: 0
  };

  function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
  function lerp(a, b, amount) { return a + (b - a) * amount; }
  function randomUnit() {
    sensorySeed = (sensorySeed * 1664525 + 1013904223) >>> 0;
    return sensorySeed / 4294967296;
  }
  function sensoryNoise(amount) { return (randomUnit() * 2 - 1) * amount; }

  function resetEpisode() {
    player = { x: 0, y: 0, z: 0 };
    targets = targetBlueprint.map((target) => ({ ...target, hit: false, missed: false }));
    bullets = [];
    explosions = [];
    time = 0;
    nextRingIndex = 0;
    nextTargetIndex = 0;
    lastReward = 0;
    rewardFlash = 0;
    neural.fireCooldown = 0;
    neural.decisionTimer = 0;
    neural.noiseTimer = 0;
    neural.spontaneousDrive = 0;
    neural.turnBias = 0;
    sensorySeed = (0x4f1bbcdc + episode * 1103515245) >>> 0;
    previousRetinaColumns = new Array(RETINA_WIDTH).fill(0);
    rings.forEach((ring) => { ring.result = null; });
    syncUI();
    drawGame();
    updateRetinaFromCamera();
    updateThree();
  }

  function resetLearning() {
    preferences = ACTIONS.map(() => ACTIONS.map(() => 0));
    eligibility = ACTIONS.map(() => 0);
    episode = 0;
    resetEpisode();
    ui.learning.textContent = "Preferences are untrained.";
  }

  function resizeGame() {
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    const rect = canvas.getBoundingClientRect();
    width = Math.max(320, rect.width);
    height = Math.max(320, rect.height);
    canvas.width = Math.floor(width * ratio);
    canvas.height = Math.floor(height * ratio);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  }

  function project(x, y, z) {
    const depth = z - player.z;
    const scale = 420 / Math.max(depth, 120);
    return { x: width / 2 + (x - player.x) * scale, y: height / 2 + y * scale, scale, depth };
  }

  function updateRetinaFromCamera() {
    retinaCtx.imageSmoothingEnabled = false;
    retinaCtx.clearRect(0, 0, RETINA_WIDTH, RETINA_HEIGHT);
    retinaCtx.drawImage(canvas, 0, 0, canvas.width, canvas.height, 0, 0, RETINA_WIDTH, RETINA_HEIGHT);
    const pixels = retinaCtx.getImageData(0, 0, RETINA_WIDTH, RETINA_HEIGHT).data;
    const columns = new Array(RETINA_WIDTH).fill(0);
    const targetColumns = new Array(RETINA_WIDTH).fill(0);

    for (let y = 3; y < RETINA_HEIGHT - 4; y += 1) {
      for (let x = 0; x < RETINA_WIDTH; x += 1) {
        const pixel = (y * RETINA_WIDTH + x) * 4;
        const red = pixels[pixel] / 255;
        const green = pixels[pixel + 1] / 255;
        const blue = pixels[pixel + 2] / 255;
        const luminance = (red + green + blue) / 3;
        const chroma = Math.max(red, green, blue) - Math.min(red, green, blue);
        const salience = clamp(chroma * 2.1 + Math.abs(luminance - 0.82) * 0.55, 0, 1);
        columns[x] += salience;
        if (blue > red * 1.25 && blue > green * 1.8) targetColumns[x] += 1;
      }
    }

    const rowCount = RETINA_HEIGHT - 7;
    const smoothedColumns = columns.map((value, index) => {
      const current = value / rowCount;
      const motion = Math.abs(current - previousRetinaColumns[index]);
      return clamp(current * 0.82 + motion * 0.18 + sensoryNoise(0.012), 0, 1);
    });
    previousRetinaColumns = smoothedColumns;

    const half = RETINA_WIDTH / 2;
    const left = smoothedColumns.slice(0, half).reduce((sum, value) => sum + value, 0) / half;
    const right = smoothedColumns.slice(half).reduce((sum, value) => sum + value, 0) / half;
    const centerStart = Math.floor(RETINA_WIDTH * 0.36);
    const centerEnd = Math.ceil(RETINA_WIDTH * 0.64);
    const center = smoothedColumns.slice(centerStart, centerEnd).reduce((sum, value) => sum + value, 0) / (centerEnd - centerStart);
    const targetCenter = targetColumns.slice(centerStart, centerEnd).reduce((sum, value) => sum + value, 0) / ((centerEnd - centerStart) * rowCount);
    return { left: clamp(left * 2.2, 0, 1), right: clamp(right * 2.2, 0, 1), center: clamp(center * 2.2, 0, 1), targetCenter: clamp(targetCenter * 1.8, 0, 1) };
  }

  function selectAction(visualDifference) {
    const contextPreferences = preferences[neural.context];
    const exploration = 0.58;
    let bestIndex = 0;
    let bestScore = -Infinity;
    ACTIONS.forEach((action, index) => {
      const weakReflex = visualDifference * action * 0.12;
      const spontaneousBias = neural.spontaneousDrive * action * 0.22;
      const adaptation = -neural.turnBias * action * 0.26;
      const score = contextPreferences[index] + weakReflex + spontaneousBias + adaptation + sensoryNoise(exploration);
      if (score > bestScore) { bestScore = score; bestIndex = index; }
    });
    actionIndex = bestIndex;
  }

  function buildNeuralController(dt) {
    const retinalInput = updateRetinaFromCamera();
    neural.visualLeft = lerp(neural.visualLeft, retinalInput.left, 1 - Math.exp(-dt * 12));
    neural.visualRight = lerp(neural.visualRight, retinalInput.right, 1 - Math.exp(-dt * 12));
    const visualDifference = clamp(neural.visualRight - neural.visualLeft, -1, 1);
    neural.context = clamp(Math.round(visualDifference * 2) + 2, 0, 4);

    neural.noiseTimer -= dt;
    if (neural.noiseTimer <= 0) {
      neural.spontaneousDrive = sensoryNoise(1);
      neural.noiseTimer = 0.22 + randomUnit() * 0.34;
    }
    neural.turnBias = lerp(neural.turnBias, neural.moveX, 1 - Math.exp(-dt * 0.65));

    neural.decisionTimer -= dt;
    if (neural.decisionTimer <= 0) {
      selectAction(visualDifference);
      neural.decisionTimer = 0.16 + randomUnit() * 0.14;
    }
    eligibility = eligibility.map((value) => value * Math.exp(-dt * 2));
    eligibility[actionIndex] = Math.max(eligibility[actionIndex], 1);

    const actionDrive = ACTIONS[actionIndex] * 0.62;
    const motorTarget = actionDrive + visualDifference * 0.08 + neural.spontaneousDrive * 0.3 - neural.turnBias * 0.2;
    neural.moveX = lerp(neural.moveX, clamp(motorTarget + sensoryNoise(0.045), -1, 1), 1 - Math.exp(-dt * 5.5));
    neural.motorLeft = lerp(neural.motorLeft, Math.max(0, -neural.moveX), 1 - Math.exp(-dt * 9));
    neural.motorRight = lerp(neural.motorRight, Math.max(0, neural.moveX), 1 - Math.exp(-dt * 9));

    neural.fireCooldown = Math.max(0, neural.fireCooldown - dt);
    const target = targets[nextTargetIndex];
    if (target && !target.hit && !target.missed) {
      const targetDepth = target.z - player.z;
      const targetVisual = retinalInput.targetCenter * retinalInput.center;
      neural.frontLimb = lerp(neural.frontLimb, targetVisual, 1 - Math.exp(-dt * 15));
      if (targetVisual > 0.42 && neural.fireCooldown <= 0 && targetDepth > 40 && targetDepth < 430) fire();
    } else {
      neural.frontLimb = lerp(neural.frontLimb, 0, 1 - Math.exp(-dt * 12));
    }
    neural.dopamine = lerp(neural.dopamine, 0, 1 - Math.exp(-dt * 4));
  }

  function applyReward(reward) {
    lastReward = reward;
    rewardFlash = reward > 0 ? 0.6 : -0.6;
    neural.dopamine = reward > 0 ? reward : 0;
    for (let index = 0; index < ACTIONS.length; index += 1) {
      preferences[neural.context][index] += LEARNING_RATE * reward * eligibility[index];
    }
    const average = preferences.flat().reduce((sum, value) => sum + value, 0) / preferences.flat().length;
    ui.learning.textContent = `Context ${neural.context + 1}/5 preference average ${average.toFixed(2)}.`;
  }

  function fire() {
    const target = targets[nextTargetIndex];
    if (!target || neural.fireCooldown > 0) return;
    neural.fireCooldown = 0.28;
    neural.frontLimb = 1;
    bullets.push({ x: player.x, y: 14, z: player.z + 50, life: 2.5 });
  }

  function updateBullets(dt) {
    for (const bullet of bullets) {
      bullet.z += BULLET_SPEED * dt;
      bullet.life -= dt;
      for (const target of targets) {
        if (!target.hit && !target.missed && Math.abs(bullet.z - target.z) < 55 && Math.hypot(bullet.x - target.x, bullet.y) < TARGET_HIT_RADIUS) {
          target.hit = true;
          bullet.life = 0;
          explosions.push({ x: target.x, y: 0, z: target.z, life: 0.68 });
          applyReward(0.5);
          if (target === targets[nextTargetIndex]) nextTargetIndex += 1;
          break;
        }
      }
    }
    bullets = bullets.filter((bullet) => bullet.life > 0);
    for (const explosion of explosions) explosion.life -= dt;
    explosions = explosions.filter((explosion) => explosion.life > 0);
  }

  function updateCourse() {
    while (nextRingIndex < rings.length && player.z >= rings[nextRingIndex].z) {
      const ring = rings[nextRingIndex];
      const success = Math.abs(player.x - ring.x) <= RING_RADIUS - RING_CLEARANCE;
      ring.result = success ? "hit" : "miss";
      applyReward(success ? 1 : -0.6);
      nextRingIndex += 1;
    }
    for (const target of targets) {
      if (!target.hit && !target.missed && player.z > target.z + 75) target.missed = true;
    }
  }

  function step(dt) {
    time += dt;
    player.z += SPEED * dt;
    buildNeuralController(dt);
    player.x = clamp(player.x + neural.moveX * LATERAL_SPEED * dt, -250, 250);
    updateBullets(dt);
    updateCourse();
    rewardFlash = Math.max(0, rewardFlash - dt);
    if (player.z > COURSE_LENGTH) finishEpisode();
  }

  function finishEpisode() {
    running = false;
    ui.card.hidden = false;
    ui.status.textContent = "COMPLETE";
    ui.message.textContent = "EPISODE COMPLETE";
    ui.start.textContent = "Run next episode";
  }

  function drawGameBackground() {
    ctx.fillStyle = COLORS.sky;
    ctx.fillRect(0, 0, width, height);
    ctx.strokeStyle = COLORS.grid;
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.65;
    for (let y = height * 0.56; y < height; y += 38) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke(); }
    for (let x = -width; x < width * 2; x += 80) { ctx.beginPath(); ctx.moveTo(width / 2, height * 0.5); ctx.lineTo(x, height); ctx.stroke(); }
    ctx.globalAlpha = 1;
    ctx.strokeStyle = COLORS.ink;
    ctx.setLineDash([6, 8]);
    ctx.beginPath(); ctx.moveTo(width / 2, 0); ctx.lineTo(width / 2, height); ctx.stroke();
    ctx.setLineDash([]);
  }

  function drawGameRing(ring) {
    const p = project(ring.x, 0, ring.z);
    if (p.depth < 90 || p.x < -300 || p.x > width + 300) return;
    ctx.strokeStyle = ring.result === "miss" ? COLORS.red : ring.result === "hit" ? COLORS.green : ring.color;
    ctx.lineWidth = clamp(18 * p.scale, 5, 22);
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(ring.angle);
    ctx.beginPath();
    ctx.ellipse(0, 0, RING_RADIUS * p.scale, RING_RADIUS * p.scale * 0.68, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  function drawGameTarget(target) {
    if (target.hit) return;
    const p = project(target.x, 0, target.z);
    if (p.depth < 90 || p.x < -100 || p.x > width + 100) return;
    const size = clamp(48 * p.scale, 12, 100);
    ctx.fillStyle = target.missed ? COLORS.red : "#7c3aed";
    ctx.strokeStyle = COLORS.ink;
    ctx.lineWidth = clamp(2 * p.scale, 1.5, 4);
    ctx.fillRect(p.x - size, p.y - size, size * 2, size * 2);
    ctx.strokeRect(p.x - size, p.y - size, size * 2, size * 2);
    ctx.beginPath(); ctx.moveTo(p.x - size * 1.3, p.y); ctx.lineTo(p.x + size * 1.3, p.y); ctx.moveTo(p.x, p.y - size * 1.3); ctx.lineTo(p.x, p.y + size * 1.3); ctx.stroke();
  }

  function drawGameBullets() {
    ctx.lineCap = "round";
    for (const bullet of bullets) {
      const p = project(bullet.x, bullet.y, bullet.z);
      const tail = project(bullet.x, bullet.y, bullet.z - 100);
      if (p.depth <= 0 || p.depth >= 1800) continue;
      const depthScale = clamp(p.scale / 3.5, 0.16, 1);
      ctx.strokeStyle = COLORS.ink; ctx.lineWidth = clamp(8 * depthScale, 2, 8);
      ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(tail.x, tail.y); ctx.stroke();
      ctx.strokeStyle = "#e24b2d"; ctx.lineWidth = clamp(4 * depthScale, 1, 4);
      ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(tail.x, tail.y); ctx.stroke();
    }
    ctx.lineCap = "butt";
  }

  function drawGameExplosions() {
    for (const explosion of explosions) {
      const p = project(explosion.x, 0, explosion.z);
      const progress = 1 - explosion.life / 0.68;
      ctx.save();
      ctx.globalAlpha = clamp(explosion.life / 0.68, 0, 1);
      ctx.strokeStyle = COLORS.red; ctx.lineWidth = 3;
      for (let index = 0; index < 8; index += 1) {
        const angle = (Math.PI * 2 * index) / 8;
        const start = progress * 8 * p.scale;
        const end = start + progress * 35 * p.scale;
        ctx.beginPath(); ctx.moveTo(p.x + Math.cos(angle) * start, p.y + Math.sin(angle) * start); ctx.lineTo(p.x + Math.cos(angle) * end, p.y + Math.sin(angle) * end); ctx.stroke();
      }
      ctx.restore();
    }
  }

  function drawGamePlayer() {
    ctx.save();
    ctx.translate(width / 2, height / 2 + 72);
    ctx.fillStyle = COLORS.paper; ctx.strokeStyle = COLORS.ink; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(0, -24); ctx.lineTo(24, 20); ctx.lineTo(0, 12); ctx.lineTo(-24, 20); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-12, 18); ctx.lineTo(12, 18); ctx.stroke();
    ctx.restore();
  }

  function drawGameCrosshair() {
    const x = width / 2; const y = height / 2;
    ctx.strokeStyle = COLORS.ink; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x - 15, y); ctx.lineTo(x - 5, y); ctx.moveTo(x + 5, y); ctx.lineTo(x + 15, y); ctx.moveTo(x, y - 15); ctx.lineTo(x, y - 5); ctx.moveTo(x, y + 5); ctx.lineTo(x, y + 15); ctx.stroke();
    ctx.strokeRect(x - 4, y - 4, 8, 8);
  }

  function drawGamePulse() {
    if (!rewardFlash) return;
    ctx.save(); ctx.globalAlpha = Math.abs(rewardFlash); ctx.strokeStyle = rewardFlash > 0 ? COLORS.green : COLORS.red; ctx.lineWidth = 5; ctx.strokeRect(6, 6, width - 12, height - 12); ctx.restore();
  }

  function drawGame() {
    drawGameBackground();
    [...rings].reverse().forEach(drawGameRing);
    [...targets].reverse().forEach(drawGameTarget);
    drawGameBullets();
    drawGameExplosions();
    drawGamePlayer();
    drawGameCrosshair();
    drawGamePulse();
  }

  function setBar(element, value) { element.style.width = `${clamp(value, 0, 1) * 100}%`; }

  function syncUI() {
    const passed = rings.filter((ring) => ring.result === "hit").length;
    const hit = targets.filter((target) => target.hit).length;
    ui.rings.textContent = `${passed} / ${rings.length}`;
    ui.targets.textContent = `${hit} / ${targets.length}`;
    ui.episode.textContent = `EPISODE ${episode}`;
    ui.status.textContent = running ? "RUNNING" : player.z >= COURSE_LENGTH ? "COMPLETE" : "READY";
    ui.message.textContent = running ? (rewardFlash > 0 ? "POSITIVE REWARD" : "NEURAL CONTROL") : "REPLAY READY";
    ui.action.textContent = `MOVE ${neural.moveX.toFixed(2)}`;
    ui.reward.textContent = `REWARD ${lastReward.toFixed(2)}`;
    setBar(ui.visualLeft, neural.visualLeft); setBar(ui.visualRight, neural.visualRight);
    setBar(ui.motorLeft, neural.motorLeft); setBar(ui.motorRight, neural.motorRight);
    setBar(ui.spontaneous, Math.abs(neural.spontaneousDrive));
    setBar(ui.frontLimb, neural.frontLimb); setBar(ui.dopamine, neural.dopamine);
  }

  function makeMaterial(color, opacity = 1) { return new THREE.MeshStandardMaterial({ color, roughness: 0.8, metalness: 0.05, transparent: opacity < 1, opacity }); }

  function cylinderBetween(a, b, radius, material) {
    const direction = new THREE.Vector3().subVectors(b, a);
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, direction.length(), 6), material);
    mesh.position.copy(a).add(b).multiplyScalar(0.5);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
    return mesh;
  }

  function createFly() {
    const group = new THREE.Group();
    const thorax = new THREE.Mesh(new THREE.SphereGeometry(0.62, 16, 10), makeMaterial(0x252b30));
    thorax.scale.set(0.95, 0.9, 1.1); group.add(thorax);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.47, 16, 10), makeMaterial(0x39434a));
    head.position.z = 1.0; group.add(head);
    const abdomenMaterial = makeMaterial(0x664424);
    [-0.55, -1.05, -1.52].forEach((z, index) => {
      const abdomen = new THREE.Mesh(new THREE.SphereGeometry(0.5 - index * 0.045, 14, 9), abdomenMaterial);
      abdomen.scale.set(0.94 - index * 0.08, 0.92 - index * 0.06, 0.72);
      abdomen.position.z = z;
      group.add(abdomen);
      if (index < 2) {
        const band = new THREE.Mesh(new THREE.TorusGeometry(0.47 - index * 0.04, 0.035, 6, 18), makeMaterial(0x171b1e));
        band.rotation.x = Math.PI / 2; band.position.z = z - 0.22; group.add(band);
      }
    });
    const eyeMaterial = makeMaterial(0xb83d45);
    [-1, 1].forEach((side) => {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 7), eyeMaterial);
      eye.scale.set(0.82, 1, 0.62); eye.position.set(side * 0.34, 0.14, 1.22); group.add(eye);
      const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.58, 5), makeMaterial(0x111820));
      antenna.position.set(side * 0.2, 0.48, 1.32); antenna.rotation.z = side * 0.3; antenna.rotation.x = -0.24; group.add(antenna);
    });
    const proboscis = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.07, 0.36, 6), makeMaterial(0x111820));
    proboscis.position.set(0, -0.08, 1.46); proboscis.rotation.x = Math.PI / 2; group.add(proboscis);
    const wingMaterial = new THREE.MeshStandardMaterial({ color: 0xaecbd4, transparent: true, opacity: 0.58, side: THREE.DoubleSide, roughness: 0.45 });
    [-1, 1].forEach((side) => {
      const wing = new THREE.Mesh(new THREE.PlaneGeometry(1.85, 0.62), wingMaterial);
      wing.position.set(side * 0.62, 0.34, -0.2); wing.rotation.set(side * 0.2, side * 0.25, side * 0.28); group.add(wing); three.wings.push(wing);
    });
    const legMaterial = makeMaterial(0x111820);
    [-1, 1].forEach((side) => {
      const root = new THREE.Group(); root.position.set(side * 0.32, -0.18, 0.48); group.add(root);
      root.add(cylinderBetween(new THREE.Vector3(0, 0, 0), new THREE.Vector3(side * 0.58, -0.28, 0.4), 0.052, legMaterial));
      root.add(cylinderBetween(new THREE.Vector3(side * 0.58, -0.28, 0.4), new THREE.Vector3(side * 1.0, -0.54, 0.1), 0.038, legMaterial));
      three.frontLegs.push(root);
    });
    [-1, 1].forEach((side) => {
      for (let row = 0; row < 3; row += 1) {
        const root = new THREE.Group(); root.position.set(side * 0.32, -0.18, -0.15 - row * 0.55); group.add(root);
        root.add(cylinderBetween(new THREE.Vector3(0, 0, 0), new THREE.Vector3(side * 0.58, -0.22, -0.08), 0.043, legMaterial));
        root.add(cylinderBetween(new THREE.Vector3(side * 0.58, -0.22, -0.08), new THREE.Vector3(side * (0.9 + row * 0.08), -0.45, -0.24), 0.032, legMaterial));
      }
    });
    return group;
  }

  function initThree() {
    three.renderer = new THREE.WebGLRenderer({ antialias: false, alpha: false, powerPreference: "low-power" });
    three.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    three.renderer.setClearColor(0xd7e4e9, 1);
    flyView.appendChild(three.renderer.domElement);
    three.scene = new THREE.Scene();
    three.scene.fog = new THREE.Fog(0xd7e4e9, 18, 75);
    three.camera = new THREE.PerspectiveCamera(42, 1, 0.1, 120);
    three.camera.position.set(3.2, 2.1, 6.8);
    three.camera.lookAt(0, -0.05, 0);
    three.scene.add(new THREE.HemisphereLight(0xf4f1e8, 0x5a6c75, 2.1));
    const key = new THREE.DirectionalLight(0xffffff, 2.2); key.position.set(-4, 7, 6); three.scene.add(key);
    three.fly = createFly(); three.fly.scale.setScalar(1.05); three.scene.add(three.fly);
    resizeThree();
  }

  function resizeThree() {
    if (!three.renderer) return;
    const rect = flyView.getBoundingClientRect();
    three.renderer.setSize(rect.width, rect.height, false);
    three.camera.aspect = rect.width / rect.height;
    three.camera.updateProjectionMatrix();
  }

  function updateThree() {
    if (!three.renderer) return;
    const flyX = player.x / 155 + neural.moveX * 0.55;
    three.fly.position.set(flyX, -0.15 + Math.sin(three.clock * 5) * 0.05, 0);
    // Local +X is the fly's right; positive game movement is screen-right.
    // Keep the visible roll on the same side as the fly's own turn.
    three.fly.rotation.z = neural.moveX * 0.38;
    three.fly.rotation.x = -neural.moveX * 0.08 + Math.sin(three.clock * 3.2) * 0.025;
    three.fly.rotation.y = Math.sin(three.clock * 2.4) * 0.04;
    three.frontLegs.forEach((leg, index) => { leg.rotation.z = (index === 0 ? -1 : 1) * (0.12 + neural.frontLimb * 0.95); });
    three.wings.forEach((wing, index) => {
      const side = index === 0 ? -1 : 1;
      const turnLift = 1 + side * neural.moveX * 0.35;
      wing.rotation.y = side * (0.25 + Math.sin(three.clock * 24) * 0.18 * turnLift + neural.frontLimb * 0.16);
      wing.rotation.z = (index === 0 ? -1 : 1) * (0.22 + Math.sin(three.clock * 24 + Math.PI / 2) * 0.05);
    });
    three.renderer.render(three.scene, three.camera);
  }

  function showThreeFallback() {
    flyView.innerHTML = "<div class=\"fly-fallback\"><strong>3D preview unavailable</strong><span>The replay controls remain active. A WebGL-capable browser will show the Three.js fly here.</span></div>";
  }

  async function loadThree() {
    try {
      THREE = window.THREE;
      if (!THREE) throw new Error("Three.js was not available");
      initThree();
      updateThree();
    } catch (error) {
      three.renderer = null;
      showThreeFallback();
    }
  }

  function startEpisode() {
    if (running) return;
    if (player.z >= COURSE_LENGTH) resetEpisode();
    episode += 1;
    running = true;
    ui.card.hidden = true;
    lastTime = performance.now();
    requestAnimationFrame(loop);
  }

  function loop(now) {
    if (!running) return;
    const dt = Math.min((now - lastTime) / 1000, 0.04);
    lastTime = now;
    three.clock += dt;
    step(dt);
    drawGame();
    syncUI();
    updateThree();
    if (running) requestAnimationFrame(loop);
  }

  window.addEventListener("resize", () => { resizeGame(); resizeThree(); drawGame(); updateThree(); });
  ui.start.addEventListener("click", startEpisode);
  ui.run.addEventListener("click", startEpisode);
  ui.resetLearning.addEventListener("click", resetLearning);

  resizeGame();
  resetEpisode();
  drawGame();
  syncUI();
  loadThree();
})();
