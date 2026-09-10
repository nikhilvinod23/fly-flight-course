import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js";

(() => {
  "use strict";

  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
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

  const ringX = [-220, 200, -180, 220, -200, 180, -220, 210, -190, 200];
  const rings = ringX.map((x, index) => ({ x, y: 0, z: 700 + index * RING_SPACING, color: RING_COLORS[index % RING_COLORS.length], result: null }));
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
  const neural = {
    visualLeft: 0,
    visualRight: 0,
    motorLeft: 0,
    motorRight: 0,
    frontLimb: 0,
    dopamine: 0,
    moveX: 0,
    context: 2,
    fireCooldown: 0
  };

  const three = {
    renderer: null,
    scene: null,
    camera: null,
    fly: null,
    frontLegs: [],
    wings: [],
    ringMeshes: [],
    targetMeshes: [],
    clock: 0
  };

  function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
  function lerp(a, b, amount) { return a + (b - a) * amount; }

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
    rings.forEach((ring) => { ring.result = null; });
    syncUI();
    drawGame();
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

  function buildNeuralController(dt) {
    const ring = rings[nextRingIndex] || rings[rings.length - 1];
    const error = clamp((ring.x - player.x) / 180, -1, 1);
    neural.context = clamp(Math.round(error * 2) + 2, 0, 4);
    neural.visualLeft = lerp(neural.visualLeft, Math.max(0, -error), 1 - Math.exp(-dt * 12));
    neural.visualRight = lerp(neural.visualRight, Math.max(0, error), 1 - Math.exp(-dt * 12));
    neural.motorLeft = lerp(neural.motorLeft, neural.visualLeft, 1 - Math.exp(-dt * 9));
    neural.motorRight = lerp(neural.motorRight, neural.visualRight, 1 - Math.exp(-dt * 9));

    const contextPreferences = preferences[neural.context];
    let bestIndex = 0;
    let bestScore = -Infinity;
    ACTIONS.forEach((action, index) => {
      const visualFit = -Math.abs(action - error) * 2;
      const score = visualFit + contextPreferences[index] * 0.4;
      if (score > bestScore) { bestScore = score; bestIndex = index; }
    });
    actionIndex = bestIndex;
    eligibility = eligibility.map((value) => value * Math.exp(-dt * 2));
    eligibility[actionIndex] = Math.max(eligibility[actionIndex], 1);
    neural.moveX = clamp(error * 0.72 + ACTIONS[actionIndex] * 0.28, -1, 1);

    neural.fireCooldown = Math.max(0, neural.fireCooldown - dt);
    const target = targets[nextTargetIndex];
    if (target && !target.hit && !target.missed) {
      const targetDepth = target.z - player.z;
      const targetVisual = clamp(1 - Math.abs(target.x - player.x) / 110, 0, 1) * clamp(1 - Math.abs(targetDepth - 240) / 320, 0, 1);
      neural.frontLimb = lerp(neural.frontLimb, targetVisual, 1 - Math.exp(-dt * 15));
      if (targetVisual > 0.68 && neural.fireCooldown <= 0 && targetDepth > 40 && targetDepth < 430) fire();
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
    ctx.beginPath(); ctx.arc(p.x, p.y, RING_RADIUS * p.scale, 0, Math.PI * 2); ctx.stroke();
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
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.58, 14, 8), makeMaterial(0x20262b));
    body.scale.set(0.85, 0.75, 1.55); group.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.42, 12, 8), makeMaterial(0x303941));
    head.position.z = 0.95; group.add(head);
    const abdomen = new THREE.Mesh(new THREE.SphereGeometry(0.48, 12, 8), makeMaterial(0x6d4a28));
    abdomen.scale.set(0.9, 0.9, 1.5); abdomen.position.z = -0.95; group.add(abdomen);
    const eyeMaterial = makeMaterial(0xa62c2c);
    [-1, 1].forEach((side) => { const eye = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), eyeMaterial); eye.position.set(side * 0.32, 0.12, 1.2); group.add(eye); });
    const wingMaterial = new THREE.MeshStandardMaterial({ color: 0xb8d5df, transparent: true, opacity: 0.48, side: THREE.DoubleSide });
    [-1, 1].forEach((side) => {
      const wing = new THREE.Mesh(new THREE.PlaneGeometry(1.45, 0.48), wingMaterial);
      wing.position.set(side * 0.48, 0.3, -0.15); wing.rotation.set(side * 0.2, side * 0.25, side * 0.25); group.add(wing); three.wings.push(wing);
    });
    const legMaterial = makeMaterial(0x111820);
    [-1, 1].forEach((side) => {
      const root = new THREE.Group(); root.position.set(side * 0.32, -0.18, 0.48); group.add(root);
      root.add(cylinderBetween(new THREE.Vector3(0, 0, 0), new THREE.Vector3(side * 0.55, -0.25, 0.35), 0.045, legMaterial));
      root.add(cylinderBetween(new THREE.Vector3(side * 0.55, -0.25, 0.35), new THREE.Vector3(side * 0.9, -0.5, 0.05), 0.035, legMaterial));
      three.frontLegs.push(root);
    });
    [-1, 1].forEach((side) => {
      for (let row = 0; row < 2; row += 1) {
        const root = new THREE.Group(); root.position.set(side * 0.32, -0.18, -0.15 - row * 0.55); group.add(root);
        root.add(cylinderBetween(new THREE.Vector3(0, 0, 0), new THREE.Vector3(side * 0.55, -0.22, -0.08), 0.04, legMaterial));
        root.add(cylinderBetween(new THREE.Vector3(side * 0.55, -0.22, -0.08), new THREE.Vector3(side * 0.95, -0.42, -0.2), 0.03, legMaterial));
      }
    });
    return group;
  }

  function initThree() {
    three.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    three.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    three.renderer.setClearColor(0xd7e4e9, 1);
    flyView.appendChild(three.renderer.domElement);
    three.scene = new THREE.Scene();
    three.scene.fog = new THREE.Fog(0xd7e4e9, 18, 75);
    three.camera = new THREE.PerspectiveCamera(42, 1, 0.1, 120);
    three.camera.position.set(0, 2.4, 7);
    three.camera.lookAt(0, 0, -22);
    three.scene.add(new THREE.HemisphereLight(0xf4f1e8, 0x5a6c75, 2.1));
    const key = new THREE.DirectionalLight(0xffffff, 2.2); key.position.set(-4, 7, 6); three.scene.add(key);
    three.fly = createFly(); three.fly.scale.setScalar(0.8); three.scene.add(three.fly);
    for (const ring of rings) {
      const mesh = new THREE.Mesh(new THREE.TorusGeometry(1.5, 0.09, 8, 36), makeMaterial(ring.color));
      three.scene.add(mesh); three.ringMeshes.push(mesh);
    }
    for (const target of targets) {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.65, 0.16), makeMaterial(0x7c3aed));
      three.scene.add(mesh); three.targetMeshes.push(mesh);
    }
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
    const flyX = player.x / 100;
    three.fly.position.set(flyX, -0.15, 0);
    three.fly.rotation.z = -neural.moveX * 0.22;
    three.fly.rotation.x = -neural.moveX * 0.05;
    three.frontLegs.forEach((leg, index) => { leg.rotation.z = (index === 0 ? -1 : 1) * (0.12 + neural.frontLimb * 0.95); });
    three.wings.forEach((wing, index) => { wing.rotation.y = (index === 0 ? -1 : 1) * (0.25 + Math.sin(three.clock * 20) * 0.08 + neural.frontLimb * 0.16); });
    rings.forEach((ring, index) => {
      const mesh = three.ringMeshes[index];
      mesh.position.set(ring.x / 100, 0, -(ring.z - player.z) / 220);
      mesh.rotation.x = Math.PI / 2;
      mesh.visible = ring.z - player.z > -100 && ring.z - player.z < 13000;
      mesh.material.color.set(ring.result === "hit" ? 0x1e6b49 : ring.color);
    });
    targets.forEach((target, index) => {
      const mesh = three.targetMeshes[index];
      mesh.position.set(target.x / 100, 0, -(target.z - player.z) / 220);
      mesh.visible = !target.hit && target.z - player.z > -100 && target.z - player.z < 13000;
      mesh.rotation.z += 0.01;
    });
    three.renderer.render(three.scene, three.camera);
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
  initThree();
  resetEpisode();
  drawGame();
  syncUI();
  updateThree();
})();
