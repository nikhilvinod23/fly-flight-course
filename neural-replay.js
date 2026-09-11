(() => {
  "use strict";

  let THREE = null;
  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  const retinaCanvas = document.getElementById("retina-preview");
  const retinaCtx = retinaCanvas.getContext("2d", { willReadFrequently: true });
  const brainView = document.getElementById("brain-view");
  const flyView = document.getElementById("fly-view");
  const ui = {
    status: document.getElementById("status-label"), episode: document.getElementById("episode-label"),
    rings: document.getElementById("rings-count"), targets: document.getElementById("targets-count"),
    message: document.getElementById("message-label"), card: document.getElementById("start-card"),
    start: document.getElementById("start-button"), run: document.getElementById("run-button"),
    resetLearning: document.getElementById("reset-learning"), action: document.getElementById("action-label"),
    reward: document.getElementById("reward-label"), learning: document.getElementById("learning-label"),
    visualLeft: document.getElementById("visual-left"), visualRight: document.getElementById("visual-right"),
    visualUp: document.getElementById("visual-up"), visualDown: document.getElementById("visual-down"),
    motorLeft: document.getElementById("motor-left"), motorRight: document.getElementById("motor-right"),
    motorUp: document.getElementById("motor-up"), motorDown: document.getElementById("motor-down"),
    spontaneous: document.getElementById("spontaneous-drive"), frontLimb: document.getElementById("front-limb"),
    dopamine: document.getElementById("dopamine")
  };

  const COLORS = { ink: "#eaf4ff", blue: "#48b8dd", red: "#ef665f", green: "#58d68d", amber: "#f1ad45", sky: "#030914", grid: "#244766" };
  const RING_COLORS = ["#40bde3", "#f2a541", "#55ca88", "#a883ef", "#e66d9d"];
  const ACTIONS = [-1, -0.5, 0, 0.5, 1];
  const COURSE_LENGTH = 7300;
  const SPEED = 360;
  const LATERAL_SPEED = 270;
  const VERTICAL_SPEED = 220;
  const RING_RADIUS = 165;
  const RING_CLEARANCE = 12;
  const TARGET_HIT_RADIUS = 82;
  const BULLET_SPEED = 920;
  const RING_SPACING = 650;
  const LEARNING_RATE = 0.08;
  const RETINA_WIDTH = 48;
  const RETINA_HEIGHT = 27;

  const ringX = [-250, 190, -80, 245, -220, 70, -245, 225, -35, 250];
  const ringY = [120, -115, 165, 35, -150, 130, -55, 175, -175, 65];
  const ringAngles = [-0.18, 0.52, -0.86, 0.28, 1.12, -0.42, 0.74, -1.02, 0.36, -0.64];
  const ringSquash = [0.72, 0.5, 0.82, 0.58, 0.68, 0.46, 0.76, 0.55, 0.84, 0.62];
  const rings = ringX.map((x, index) => ({
    x, y: ringY[index], z: 700 + index * RING_SPACING, angle: ringAngles[index], squash: ringSquash[index],
    color: RING_COLORS[index % RING_COLORS.length], result: null
  }));
  const targetBlueprint = [{ x: 35, y: -145, z: 1600 }, { x: -85, y: 145, z: 4600 }];
  const stars = Array.from({ length: 95 }, (_, index) => ({
    x: ((index * 83) % 997) / 997, y: ((index * 47 + 19) % 541) / 541,
    size: index % 7 === 0 ? 2 : 1, phase: (index * 0.37) % 1
  }));

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
  let rewardColor = COLORS.green;
  let actionXIndex = 2;
  let actionYIndex = 2;
  let preferencesX = ACTIONS.map(() => ACTIONS.map(() => 0));
  let preferencesY = ACTIONS.map(() => ACTIONS.map(() => 0));
  let eligibilityX = ACTIONS.map(() => 0);
  let eligibilityY = ACTIONS.map(() => 0);
  let sensorySeed = 0x4f1bbcdc;
  let previousRetinaColumns = new Array(RETINA_WIDTH).fill(0);
  let previousRetinaRows = new Array(RETINA_HEIGHT).fill(0);

  const neural = {
    visualLeft: 0, visualRight: 0, visualUp: 0, visualDown: 0,
    motorLeft: 0, motorRight: 0, motorUp: 0, motorDown: 0,
    frontLimb: 0, dopamine: 0, moveX: 0, moveY: 0,
    contextX: 2, contextY: 2, fireCooldown: 0, decisionTimer: 0, noiseTimer: 0,
    spontaneousX: 0, spontaneousY: 0, turnBiasX: 0, turnBiasY: 0
  };

  const three = {
    renderer: null, scene: null, camera: null, fly: null, fallback: null,
    frontLegs: [], wings: [], segmentNodes: {}, activityNodes: [], clock: 0, modelReady: false,
    brainRenderer: null, brainScene: null, brainCamera: null, brain: null, brainNodes: []
  };

  function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
  function lerp(a, b, amount) { return a + (b - a) * amount; }
  function randomUnit() { sensorySeed = (sensorySeed * 1664525 + 1013904223) >>> 0; return sensorySeed / 4294967296; }
  function sensoryNoise(amount) { return (randomUnit() * 2 - 1) * amount; }
  function freshPreferences() { return ACTIONS.map(() => ACTIONS.map(() => 0)); }

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
    neural.spontaneousX = 0;
    neural.spontaneousY = 0;
    neural.turnBiasX = 0;
    neural.turnBiasY = 0;
    sensorySeed = (0x4f1bbcdc + episode * 1103515245) >>> 0;
    previousRetinaColumns = new Array(RETINA_WIDTH).fill(0);
    previousRetinaRows = new Array(RETINA_HEIGHT).fill(0);
    rings.forEach((ring) => { ring.result = null; });
    syncUI();
    drawGame();
    updateRetinaFromCamera();
    updateThree();
  }

  function resetLearning() {
    preferencesX = freshPreferences();
    preferencesY = freshPreferences();
    eligibilityX = ACTIONS.map(() => 0);
    eligibilityY = ACTIONS.map(() => 0);
    episode = 0;
    resetEpisode();
    ui.learning.textContent = "Preferences are untrained. The fly is exploring in two axes.";
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
    return { x: width / 2 + (x - player.x) * scale, y: height / 2 - (y - player.y) * scale, scale, depth };
  }

  function updateRetinaFromCamera() {
    retinaCtx.imageSmoothingEnabled = false;
    retinaCtx.clearRect(0, 0, RETINA_WIDTH, RETINA_HEIGHT);
    retinaCtx.drawImage(canvas, 0, 0, canvas.width, canvas.height, 0, 0, RETINA_WIDTH, RETINA_HEIGHT);
    const pixels = retinaCtx.getImageData(0, 0, RETINA_WIDTH, RETINA_HEIGHT).data;
    const columns = new Array(RETINA_WIDTH).fill(0);
    const rows = new Array(RETINA_HEIGHT).fill(0);
    const targetColumns = new Array(RETINA_WIDTH).fill(0);
    const targetRows = new Array(RETINA_HEIGHT).fill(0);
    const yStart = 2;
    const yEnd = RETINA_HEIGHT - 3;

    for (let y = yStart; y < yEnd; y += 1) {
      for (let x = 0; x < RETINA_WIDTH; x += 1) {
        const pixel = (y * RETINA_WIDTH + x) * 4;
        const red = pixels[pixel] / 255;
        const green = pixels[pixel + 1] / 255;
        const blue = pixels[pixel + 2] / 255;
        const luminance = red * 0.3 + green * 0.59 + blue * 0.11;
        const chroma = Math.max(red, green, blue) - Math.min(red, green, blue);
        const salience = clamp(chroma * 1.75 + Math.max(0, luminance - 0.2) * 0.48, 0, 1);
        columns[x] += salience;
        rows[y] += salience;
        if (red > 0.42 && blue > green * 1.35 && red + blue > 1.0) {
          targetColumns[x] += 1;
          targetRows[y] += 1;
        }
      }
    }

    const rowCount = yEnd - yStart;
    const smoothedColumns = columns.map((value, index) => {
      const current = value / rowCount;
      const motion = Math.abs(current - previousRetinaColumns[index]);
      return clamp(current * 0.8 + motion * 0.2 + sensoryNoise(0.012), 0, 1);
    });
    const smoothedRows = rows.map((value, index) => {
      const current = value / RETINA_WIDTH;
      const motion = Math.abs(current - previousRetinaRows[index]);
      return clamp(current * 0.8 + motion * 0.2 + sensoryNoise(0.012), 0, 1);
    });
    previousRetinaColumns = smoothedColumns;
    previousRetinaRows = smoothedRows;

    const halfX = RETINA_WIDTH / 2;
    const halfY = Math.floor(RETINA_HEIGHT / 2);
    const left = smoothedColumns.slice(0, halfX).reduce((sum, value) => sum + value, 0) / halfX;
    const right = smoothedColumns.slice(halfX).reduce((sum, value) => sum + value, 0) / halfX;
    const up = smoothedRows.slice(yStart, halfY).reduce((sum, value) => sum + value, 0) / (halfY - yStart);
    const down = smoothedRows.slice(halfY, yEnd).reduce((sum, value) => sum + value, 0) / (yEnd - halfY);
    const centerX0 = Math.floor(RETINA_WIDTH * 0.36);
    const centerX1 = Math.ceil(RETINA_WIDTH * 0.64);
    const centerY0 = Math.floor(RETINA_HEIGHT * 0.3);
    const centerY1 = Math.ceil(RETINA_HEIGHT * 0.7);
    const center = smoothedColumns.slice(centerX0, centerX1).reduce((sum, value) => sum + value, 0) / (centerX1 - centerX0);
    const targetX = targetColumns.slice(centerX0, centerX1).reduce((sum, value) => sum + value, 0);
    const targetY = targetRows.slice(centerY0, centerY1).reduce((sum, value) => sum + value, 0);
    const targetCenter = (targetX + targetY) / ((centerX1 - centerX0) * rowCount + (centerY1 - centerY0) * RETINA_WIDTH);
    return {
      left: clamp(left * 2.45, 0, 1), right: clamp(right * 2.45, 0, 1),
      up: clamp(up * 2.7, 0, 1), down: clamp(down * 2.7, 0, 1),
      center: clamp(center * 2.2, 0, 1), targetCenter: clamp(targetCenter * 6.5, 0, 1)
    };
  }

  function selectAxisAction(axis, visualDifference) {
    const isX = axis === "x";
    const context = isX ? neural.contextX : neural.contextY;
    const preferences = isX ? preferencesX : preferencesY;
    const spontaneous = isX ? neural.spontaneousX : neural.spontaneousY;
    const adaptation = isX ? neural.turnBiasX : neural.turnBiasY;
    let bestIndex = 0;
    let bestScore = -Infinity;
    ACTIONS.forEach((action, index) => {
      const weakReflex = visualDifference * action * 0.13;
      const spontaneousBias = spontaneous * action * 0.23;
      const adaptationBias = -adaptation * action * 0.27;
      const score = preferences[context][index] + weakReflex + spontaneousBias + adaptationBias + sensoryNoise(0.62);
      if (score > bestScore) { bestScore = score; bestIndex = index; }
    });
    if (isX) actionXIndex = bestIndex; else actionYIndex = bestIndex;
  }

  function buildNeuralController(dt) {
    const input = updateRetinaFromCamera();
    const visualMix = 1 - Math.exp(-dt * 12);
    neural.visualLeft = lerp(neural.visualLeft, input.left, visualMix);
    neural.visualRight = lerp(neural.visualRight, input.right, visualMix);
    neural.visualUp = lerp(neural.visualUp, input.up, visualMix);
    neural.visualDown = lerp(neural.visualDown, input.down, visualMix);
    const differenceX = clamp(neural.visualRight - neural.visualLeft, -1, 1);
    const differenceY = clamp(neural.visualUp - neural.visualDown, -1, 1);
    neural.contextX = clamp(Math.round(differenceX * 2) + 2, 0, 4);
    neural.contextY = clamp(Math.round(differenceY * 2) + 2, 0, 4);

    neural.noiseTimer -= dt;
    if (neural.noiseTimer <= 0) {
      neural.spontaneousX = sensoryNoise(1);
      neural.spontaneousY = sensoryNoise(1);
      neural.noiseTimer = 0.18 + randomUnit() * 0.32;
    }
    neural.turnBiasX = lerp(neural.turnBiasX, neural.moveX, 1 - Math.exp(-dt * 0.7));
    neural.turnBiasY = lerp(neural.turnBiasY, neural.moveY, 1 - Math.exp(-dt * 0.7));

    neural.decisionTimer -= dt;
    if (neural.decisionTimer <= 0) {
      selectAxisAction("x", differenceX);
      selectAxisAction("y", differenceY);
      neural.decisionTimer = 0.15 + randomUnit() * 0.15;
    }
    eligibilityX = eligibilityX.map((value) => value * Math.exp(-dt * 2));
    eligibilityY = eligibilityY.map((value) => value * Math.exp(-dt * 2));
    eligibilityX[actionXIndex] = Math.max(eligibilityX[actionXIndex], 1);
    eligibilityY[actionYIndex] = Math.max(eligibilityY[actionYIndex], 1);

    const targetX = ACTIONS[actionXIndex] * 0.62 + differenceX * 0.08 + neural.spontaneousX * 0.3 - neural.turnBiasX * 0.2;
    const targetY = ACTIONS[actionYIndex] * 0.62 + differenceY * 0.08 + neural.spontaneousY * 0.3 - neural.turnBiasY * 0.2;
    const motorMix = 1 - Math.exp(-dt * 5.5);
    neural.moveX = lerp(neural.moveX, clamp(targetX + sensoryNoise(0.05), -1, 1), motorMix);
    neural.moveY = lerp(neural.moveY, clamp(targetY + sensoryNoise(0.05), -1, 1), motorMix);
    const readoutMix = 1 - Math.exp(-dt * 9);
    neural.motorLeft = lerp(neural.motorLeft, Math.max(0, -neural.moveX), readoutMix);
    neural.motorRight = lerp(neural.motorRight, Math.max(0, neural.moveX), readoutMix);
    neural.motorUp = lerp(neural.motorUp, Math.max(0, neural.moveY), readoutMix);
    neural.motorDown = lerp(neural.motorDown, Math.max(0, -neural.moveY), readoutMix);

    neural.fireCooldown = Math.max(0, neural.fireCooldown - dt);
    const target = targets[nextTargetIndex];
    if (target && !target.hit && !target.missed) {
      const targetDepth = target.z - player.z;
      const targetVisual = input.targetCenter * input.center;
      neural.frontLimb = lerp(neural.frontLimb, targetVisual, 1 - Math.exp(-dt * 15));
      if (targetVisual > 0.18 && neural.fireCooldown <= 0 && targetDepth > 40 && targetDepth < 480) fire();
    } else {
      neural.frontLimb = lerp(neural.frontLimb, 0, 1 - Math.exp(-dt * 12));
    }
    neural.dopamine = lerp(neural.dopamine, 0, 1 - Math.exp(-dt * 4));
  }

  function applyReward(reward, color = null) {
    lastReward = reward;
    rewardFlash = reward > 0 ? 0.65 : -0.55;
    rewardColor = color || (reward > 0 ? COLORS.green : COLORS.red);
    neural.dopamine = reward > 0 ? reward : 0;
    for (let index = 0; index < ACTIONS.length; index += 1) {
      preferencesX[neural.contextX][index] += LEARNING_RATE * reward * eligibilityX[index];
      preferencesY[neural.contextY][index] += LEARNING_RATE * reward * eligibilityY[index];
    }
    const all = preferencesX.flat().concat(preferencesY.flat());
    const average = all.reduce((sum, value) => sum + value, 0) / all.length;
    ui.learning.textContent = `Visual contexts X${neural.contextX + 1}/5 · Y${neural.contextY + 1}/5 · preference mean ${average.toFixed(2)}.`;
  }

  function fire() {
    const target = targets[nextTargetIndex];
    if (!target || neural.fireCooldown > 0) return;
    neural.fireCooldown = 0.28;
    neural.frontLimb = 1;
    bullets.push({ x: player.x, y: player.y, z: player.z + 50, life: 2.5, age: 0 });
  }

  function updateBullets(dt) {
    for (const bullet of bullets) {
      bullet.z += BULLET_SPEED * dt;
      bullet.life -= dt;
      bullet.age += dt;
      for (const target of targets) {
        if (!target.hit && !target.missed && Math.abs(bullet.z - target.z) < 55 && Math.hypot(bullet.x - target.x, bullet.y - target.y) < TARGET_HIT_RADIUS) {
          target.hit = true;
          bullet.life = 0;
          explosions.push({ x: target.x, y: target.y, z: target.z, life: 0.68 });
          applyReward(0.5, COLORS.amber);
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
      const success = Math.hypot(player.x - ring.x, player.y - ring.y) <= RING_RADIUS - RING_CLEARANCE;
      ring.result = success ? "hit" : "miss";
      applyReward(success ? 1 : -0.6, success ? ring.color : COLORS.red);
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
    player.x = clamp(player.x + neural.moveX * LATERAL_SPEED * dt, -290, 290);
    player.y = clamp(player.y + neural.moveY * VERTICAL_SPEED * dt, -205, 205);
    updateBullets(dt);
    updateCourse();
    rewardFlash = rewardFlash > 0 ? Math.max(0, rewardFlash - dt) : Math.min(0, rewardFlash + dt);
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
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, "#020611");
    gradient.addColorStop(0.58, "#081628");
    gradient.addColorStop(1, "#10263a");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = "#b8dbef";
    for (const star of stars) {
      const drift = ((player.z * (0.000015 + star.phase * 0.000008)) % 1);
      const sx = ((star.x + drift) % 1) * width;
      const sy = star.y * height * 0.72;
      ctx.globalAlpha = 0.36 + star.phase * 0.45;
      ctx.fillRect(sx, sy, star.size, star.size);
    }
    ctx.globalAlpha = 1;
    const horizon = height * 0.55;
    ctx.strokeStyle = COLORS.grid;
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.68;
    for (let row = 0; row < 8; row += 1) {
      const t = row / 7;
      const y = horizon + Math.pow(t, 1.8) * (height - horizon);
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke();
    }
    for (let line = -8; line <= 8; line += 1) {
      ctx.beginPath(); ctx.moveTo(width / 2, horizon); ctx.lineTo(width / 2 + line * width * 0.16, height); ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.strokeStyle = "#365d78";
    ctx.setLineDash([3, 8]);
    ctx.beginPath(); ctx.moveTo(width / 2, 0); ctx.lineTo(width / 2, height); ctx.stroke();
    ctx.setLineDash([]);
  }

  function drawGameRing(ring) {
    const p = project(ring.x, ring.y, ring.z);
    if (p.depth < 90 || p.x < -320 || p.x > width + 320 || p.y < -320 || p.y > height + 320) return;
    ctx.strokeStyle = ring.result === "miss" ? COLORS.red : ring.result === "hit" ? COLORS.green : ring.color;
    ctx.lineWidth = clamp(18 * p.scale, 5, 22);
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(ring.angle);
    ctx.beginPath();
    ctx.ellipse(0, 0, RING_RADIUS * p.scale, RING_RADIUS * p.scale * ring.squash, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  function drawGameTarget(target) {
    if (target.hit) return;
    const p = project(target.x, target.y, target.z);
    if (p.depth < 90 || p.x < -110 || p.x > width + 110 || p.y < -110 || p.y > height + 110) return;
    const size = clamp(42 * p.scale, 11, 92);
    ctx.fillStyle = target.missed ? COLORS.red : "#c25edc";
    ctx.strokeStyle = "#f3ca5b";
    ctx.lineWidth = clamp(2 * p.scale, 1, 4);
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(Math.PI / 4);
    ctx.fillRect(-size, -size, size * 2, size * 2);
    ctx.strokeRect(-size, -size, size * 2, size * 2);
    ctx.restore();
    ctx.beginPath(); ctx.moveTo(p.x - size * 1.45, p.y); ctx.lineTo(p.x - size * 0.55, p.y); ctx.moveTo(p.x + size * 0.55, p.y); ctx.lineTo(p.x + size * 1.45, p.y); ctx.stroke();
  }

  function drawGameBullets() {
    ctx.lineCap = "round";
    for (const bullet of bullets) {
      const p = project(bullet.x, bullet.y, bullet.z);
      const tail = project(bullet.x, bullet.y, bullet.z - 100);
      if (p.depth <= 0 || p.depth >= 1800) continue;
      const launch = clamp(bullet.age / 0.18, 0, 1);
      const tipX = width / 2;
      const tipY = height / 2 + 50;
      const headX = lerp(tipX, p.x, launch);
      const headY = lerp(tipY, p.y, launch);
      const tailX = lerp(tipX, tail.x, launch);
      const tailY = lerp(tipY + 8, tail.y, launch);
      const depthScale = clamp(p.scale / 3.5, 0.16, 1);
      ctx.strokeStyle = "#eef9ff"; ctx.lineWidth = clamp(7 * depthScale, 2, 7);
      ctx.beginPath(); ctx.moveTo(headX, headY); ctx.lineTo(tailX, tailY); ctx.stroke();
      ctx.strokeStyle = "#f2a541"; ctx.lineWidth = clamp(3 * depthScale, 1, 3);
      ctx.beginPath(); ctx.moveTo(headX, headY); ctx.lineTo(tailX, tailY); ctx.stroke();
    }
    ctx.lineCap = "butt";
  }

  function drawGameExplosions() {
    for (const explosion of explosions) {
      const p = project(explosion.x, explosion.y, explosion.z);
      const progress = 1 - explosion.life / 0.68;
      ctx.save();
      ctx.globalAlpha = clamp(explosion.life / 0.68, 0, 1);
      ctx.strokeStyle = COLORS.amber;
      ctx.lineWidth = 3;
      for (let index = 0; index < 10; index += 1) {
        const angle = (Math.PI * 2 * index) / 10;
        const start = progress * 8 * p.scale;
        const end = start + progress * 38 * p.scale;
        ctx.beginPath(); ctx.moveTo(p.x + Math.cos(angle) * start, p.y + Math.sin(angle) * start); ctx.lineTo(p.x + Math.cos(angle) * end, p.y + Math.sin(angle) * end); ctx.stroke();
      }
      ctx.restore();
    }
  }

  function drawGamePlayer() {
    const flap = Math.sin(time * 34) * 0.16;
    ctx.save();
    ctx.translate(width / 2, height / 2 + 88);
    ctx.rotate(neural.moveX * 0.08);
    ctx.scale(0.95, 0.95);
    ctx.strokeStyle = "#111927";
    ctx.lineWidth = 2.2;
    ctx.fillStyle = "rgba(136, 195, 215, 0.58)";
    ctx.beginPath(); ctx.ellipse(-29, 9, 34, 12, -0.34 - flap, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(29, 9, 34, 12, 0.34 + flap, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = "#77552e";
    ctx.beginPath(); ctx.ellipse(0, 17, 13, 28, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = "#3a3327";
    ctx.beginPath(); ctx.ellipse(0, -6, 16, 18, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = "#68533a";
    ctx.beginPath(); ctx.ellipse(0, -26, 15, 13, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = "#b9424d";
    ctx.beginPath(); ctx.ellipse(-10, -29, 6, 8, -0.2, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(10, -29, 6, 8, 0.2, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "#25221e";
    for (const side of [-1, 1]) {
      for (let leg = 0; leg < 3; leg += 1) {
        const y = -4 + leg * 13;
        ctx.beginPath(); ctx.moveTo(side * 9, y); ctx.lineTo(side * (24 + leg * 4), y + 13); ctx.lineTo(side * (34 + leg * 5), y + 22); ctx.stroke();
      }
    }
    ctx.restore();
  }

  function drawGameCrosshair() {
    const x = width / 2;
    const y = height / 2;
    ctx.strokeStyle = "#d9ecf7";
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(x - 17, y); ctx.lineTo(x - 6, y); ctx.moveTo(x + 6, y); ctx.lineTo(x + 17, y); ctx.moveTo(x, y - 17); ctx.lineTo(x, y - 6); ctx.moveTo(x, y + 6); ctx.lineTo(x, y + 17); ctx.stroke();
    ctx.strokeRect(x - 3, y - 3, 6, 6);
  }

  function drawGamePulse() {
    if (!rewardFlash) return;
    ctx.save();
    ctx.globalAlpha = Math.abs(rewardFlash);
    ctx.strokeStyle = rewardFlash > 0 ? rewardColor : COLORS.red;
    ctx.lineWidth = 5;
    ctx.strokeRect(6, 6, width - 12, height - 12);
    ctx.restore();
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
    ui.message.textContent = running ? (rewardFlash > 0 ? "POSITIVE REWARD" : "RETINA → MOTOR") : "REPLAY READY";
    ui.action.textContent = `X ${neural.moveX.toFixed(2)} · Y ${neural.moveY.toFixed(2)}`;
    ui.reward.textContent = `REWARD ${lastReward.toFixed(2)}`;
    setBar(ui.visualLeft, neural.visualLeft); setBar(ui.visualRight, neural.visualRight);
    setBar(ui.visualUp, neural.visualUp); setBar(ui.visualDown, neural.visualDown);
    setBar(ui.motorLeft, neural.motorLeft); setBar(ui.motorRight, neural.motorRight);
    setBar(ui.motorUp, neural.motorUp); setBar(ui.motorDown, neural.motorDown);
    setBar(ui.spontaneous, Math.max(Math.abs(neural.spontaneousX), Math.abs(neural.spontaneousY)));
    setBar(ui.frontLimb, neural.frontLimb); setBar(ui.dopamine, neural.dopamine);
  }

  function makeMaterial(color, opacity = 1) {
    return new THREE.MeshStandardMaterial({ color, roughness: 0.78, metalness: 0.03, transparent: opacity < 1, opacity, side: THREE.DoubleSide });
  }

  function cylinderBetween(a, b, radius, material) {
    const direction = new THREE.Vector3().subVectors(b, a);
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, direction.length(), 6), material);
    mesh.position.copy(a).add(b).multiplyScalar(0.5);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
    return mesh;
  }

  function createProceduralFly() {
    const group = new THREE.Group();
    const body = makeMaterial(0x5f4529);
    const dark = makeMaterial(0x24231f);
    const thorax = new THREE.Mesh(new THREE.SphereGeometry(0.58, 14, 10), dark);
    thorax.scale.set(1.05, 0.9, 0.82); group.add(thorax);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.43, 14, 10), makeMaterial(0x604b34));
    head.position.x = 0.82; group.add(head);
    const abdomen = new THREE.Mesh(new THREE.SphereGeometry(0.52, 14, 10), body);
    abdomen.scale.set(1.55, 0.82, 0.72); abdomen.position.x = -0.82; group.add(abdomen);
    [-1, 1].forEach((side) => {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.19, 10, 7), makeMaterial(0xb73e48));
      eye.position.set(1.08, side * 0.3, 0.07); group.add(eye);
      const wing = new THREE.Mesh(new THREE.PlaneGeometry(1.65, 0.62), makeMaterial(0x9fc5d2, 0.52));
      wing.position.set(-0.2, side * 0.62, 0.2); wing.rotation.z = side * 0.2; group.add(wing); three.wings.push(wing);
      for (let row = 0; row < 3; row += 1) {
        const root = new THREE.Group(); root.position.set(0.2 - row * 0.42, side * 0.35, -0.18); group.add(root);
        root.add(cylinderBetween(new THREE.Vector3(), new THREE.Vector3((0.45 - row * 0.25), side * 0.65, -0.35), 0.038, dark));
        root.add(cylinderBetween(new THREE.Vector3((0.45 - row * 0.25), side * 0.65, -0.35), new THREE.Vector3((0.65 - row * 0.4), side * 1.05, -0.62), 0.026, dark));
        if (row === 0) three.frontLegs.push(root);
      }
    });
    return group;
  }

  function addActivityOverlay(fly) {
    const brain = new THREE.Mesh(new THREE.SphereGeometry(0.36, 14, 10), makeMaterial(0x4aa8c7, 0.16));
    brain.scale.set(0.72, 1, 0.58);
    brain.position.set(0.48, 0, 0.08);
    fly.add(brain);
    const specs = [
      ["visualLeft", 0x42c7ef, [0.52, 0.2, 0.13]], ["visualRight", 0x42c7ef, [0.52, -0.2, 0.13]],
      ["visualUp", 0x42c7ef, [0.57, 0, 0.24]], ["visualDown", 0x42c7ef, [0.57, 0, -0.04]],
      ["motorLeft", 0xf2aa45, [0.12, 0.2, 0.04]], ["motorRight", 0xf2aa45, [0.12, -0.2, 0.04]],
      ["motorUp", 0xf2aa45, [-0.02, 0.08, 0.2]], ["motorDown", 0xf2aa45, [-0.02, -0.08, -0.12]],
      ["frontLimb", 0xb08bf0, [0.18, -0.28, -0.08]], ["dopamine", 0x64df90, [0.33, 0, 0.05]]
    ];
    for (const [key, color, position] of specs) {
      const material = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.28, depthTest: false });
      const node = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 6), material);
      node.position.set(...position);
      node.renderOrder = 10;
      fly.add(node);
      three.activityNodes.push({ key, node });
    }
  }

  function materialForSegment(name, colors) {
    const base = colors[name] || [0.48, 0.33, 0.16];
    const color = new THREE.Color(base[0], base[1], base[2]);
    let opacity = 1;
    if (name.includes("wing")) opacity = 0.46;
    if (name.includes("eye")) color.setRGB(0.62, 0.12, 0.16);
    return new THREE.MeshStandardMaterial({ color, roughness: 0.74, metalness: 0.02, transparent: opacity < 1, opacity, side: THREE.DoubleSide });
  }

  async function loadNeuroMechFly() {
    if (!THREE.STLLoader) throw new Error("STLLoader unavailable");
    const response = await fetch("assets/neuromechfly/model.json");
    if (!response.ok) throw new Error(`Model metadata ${response.status}`);
    const model = await response.json();
    const loader = new THREE.STLLoader();
    const geometryCache = new Map();
    const loadGeometry = (file) => {
      if (!geometryCache.has(file)) geometryCache.set(file, loader.loadAsync(`assets/neuromechfly/meshes/${file}`));
      return geometryCache.get(file);
    };
    const body = new THREE.Group();
    const nodes = {};
    model.segments.forEach((name) => { nodes[name] = new THREE.Group(); nodes[name].name = name; });
    const parentByChild = {};
    model.joints.forEach(([parent, child]) => { nodes[parent].add(nodes[child]); parentByChild[child] = parent; });
    body.add(nodes[model.root]);

    for (const name of model.segments) {
      const node = nodes[name];
      const rest = model.rest[name];
      if (name !== model.root) node.position.set(rest.pos[0], rest.pos[1], rest.pos[2]);
      node.quaternion.set(rest.quat[1], rest.quat[2], rest.quat[3], rest.quat[0]);
      const parent = parentByChild[name];
      if (parent) {
        for (const axisName of model.axisOrder) {
          const value = model.neutralDeg[`${parent}-${name}-${axisName}`] || 0;
          const axis = model.axisVector[axisName];
          node.rotateOnAxis(new THREE.Vector3(axis[0], axis[1], axis[2]), THREE.MathUtils.degToRad(value));
        }
      }
      node.userData.baseQuaternion = node.quaternion.clone();
    }

    const colors = model.colors;
    await Promise.all(model.segments.map(async (name) => {
      const meshInfo = model.meshes[name];
      const geometry = await loadGeometry(meshInfo.file);
      const mesh = new THREE.Mesh(geometry, materialForSegment(name, colors));
      mesh.scale.set(model.meshScale, meshInfo.mirror ? -model.meshScale : model.meshScale, model.meshScale);
      nodes[name].add(mesh);
    }));

    three.segmentNodes = nodes;
    three.wings = [nodes.l_wing, nodes.r_wing];
    three.frontLegs = [nodes.lf_coxa, nodes.rf_coxa];
    addActivityOverlay(body);
    body.rotation.x = 0;
    return body;
  }

  function createBrainPreview() {
    three.brainRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "low-power" });
    three.brainRenderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.25));
    three.brainRenderer.setClearColor(0x030914, 1);
    brainView.appendChild(three.brainRenderer.domElement);
    three.brainScene = new THREE.Scene();
    three.brainCamera = new THREE.PerspectiveCamera(34, 1, 0.1, 20);
    three.brainCamera.position.set(2.7, -4.8, 2.1);
    three.brainCamera.lookAt(0, 0, 0.05);
    three.brainScene.add(new THREE.HemisphereLight(0x9fd9ef, 0x17202c, 1.1));
    const brainKey = new THREE.DirectionalLight(0xffffff, 0.8);
    brainKey.position.set(-2, -3, 4);
    three.brainScene.add(brainKey);

    three.brain = new THREE.Group();
    const lobeMaterial = new THREE.MeshStandardMaterial({ color: 0x6b829b, roughness: 0.9, metalness: 0, transparent: true, opacity: 0.38, wireframe: true });
    [-1, 1].forEach((side) => {
      const lobe = new THREE.Mesh(new THREE.SphereGeometry(0.82, 16, 10), lobeMaterial);
      lobe.scale.set(0.78, 0.68, 0.92);
      lobe.position.set(side * 0.48, 0, 0.08);
      three.brain.add(lobe);
    });
    const bridge = new THREE.Mesh(new THREE.SphereGeometry(0.27, 12, 8), new THREE.MeshStandardMaterial({ color: 0x41576c, transparent: true, opacity: 0.58 }));
    bridge.scale.set(0.9, 1.3, 0.8);
    bridge.position.set(0, 0.02, -0.02);
    three.brain.add(bridge);

    const nodeSpecs = [
      ["visualLeft", 0x42c7ef, [-0.72, -0.24, 0.3]], ["visualRight", 0x42c7ef, [0.72, -0.24, 0.3]],
      ["visualUp", 0x42c7ef, [-0.34, 0.02, 0.64]], ["visualDown", 0x42c7ef, [0.34, 0.02, -0.38]],
      ["motorLeft", 0xf2aa45, [-0.35, 0.22, -0.2]], ["motorRight", 0xf2aa45, [0.35, 0.22, -0.2]],
      ["motorUp", 0xf2aa45, [-0.2, 0.32, 0.25]], ["motorDown", 0xf2aa45, [0.2, 0.32, -0.45]],
      ["frontLimb", 0xb08bf0, [0, 0.52, -0.02]], ["dopamine", 0x64df90, [0, -0.2, 0.45]]
    ];
    for (const [key, color, position] of nodeSpecs) {
      const material = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.24, depthTest: false });
      const node = new THREE.Mesh(new THREE.SphereGeometry(0.075, 8, 6), material);
      node.position.set(...position);
      node.renderOrder = 4;
      three.brain.add(node);
      three.brainNodes.push({ key, node });
    }
    const pathwayMaterial = new THREE.LineBasicMaterial({ color: 0x355974, transparent: true, opacity: 0.65 });
    const pathwayPoints = [
      new THREE.Vector3(-0.72, -0.24, 0.3), new THREE.Vector3(-0.34, 0.02, 0.64), new THREE.Vector3(0, 0.02, 0.08),
      new THREE.Vector3(0.34, 0.02, -0.38), new THREE.Vector3(0.72, -0.24, 0.3)
    ];
    three.brain.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pathwayPoints), pathwayMaterial));
    three.brainScene.add(three.brain);
    resizeBrain();
  }

  function resizeBrain() {
    if (!three.brainRenderer) return;
    const rect = brainView.getBoundingClientRect();
    three.brainRenderer.setSize(rect.width, rect.height, false);
    three.brainCamera.aspect = rect.width / rect.height;
    three.brainCamera.updateProjectionMatrix();
  }

  function updateBrainPreview() {
    if (!three.brainRenderer || !three.brain) return;
    three.brain.rotation.y = Math.sin(three.clock * 0.5) * 0.18;
    three.brain.rotation.x = Math.sin(three.clock * 0.35) * 0.05;
    const centralActivity = clamp((Math.abs(neural.moveX) + Math.abs(neural.moveY)) * 0.5, 0, 1);
    three.brainNodes.forEach(({ key, node }) => {
      const activity = key === "dopamine" ? neural.dopamine : key === "frontLimb" ? neural.frontLimb : key === "central" ? centralActivity : clamp(neural[key] || 0, 0, 1);
      node.scale.setScalar(0.45 + activity * 1.6);
      node.material.opacity = 0.2 + activity * 0.8;
    });
    three.brainRenderer.render(three.brainScene, three.brainCamera);
  }

  function initThree() {
    three.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "low-power" });
    three.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    three.renderer.setClearColor(0x07111e, 1);
    flyView.appendChild(three.renderer.domElement);
    three.scene = new THREE.Scene();
    three.scene.fog = new THREE.Fog(0x07111e, 9, 28);
    three.camera = new THREE.PerspectiveCamera(40, 1, 0.1, 50);
    three.camera.position.set(0, -7, 3.4);
    three.camera.lookAt(-0.2, 0, 0.05);
    three.scene.add(new THREE.HemisphereLight(0xbfe9ff, 0x17202c, 0.8));
    const key = new THREE.DirectionalLight(0xfff2d6, 0.95); key.position.set(-3, -4, 7); three.scene.add(key);
    const rim = new THREE.DirectionalLight(0x5bc2e7, 0.38); rim.position.set(4, 5, 2); three.scene.add(rim);
    const grid = new THREE.GridHelper(12, 18, 0x2e6683, 0x173149);
    grid.rotation.x = Math.PI / 2; grid.position.z = -1.25; three.scene.add(grid);
    createBrainPreview();
    three.fallback = createProceduralFly();
    addActivityOverlay(three.fallback);
    three.fly = three.fallback;
    three.scene.add(three.fly);
    resizeThree();

    loadNeuroMechFly().then((modelFly) => {
      three.scene.remove(three.fly);
      three.fly = modelFly;
      three.fly.scale.setScalar(1.18);
      three.scene.add(three.fly);
      three.modelReady = true;
      updateThree();
    }).catch(() => { three.modelReady = false; });
  }

  function resizeThree() {
    if (three.renderer) {
      const rect = flyView.getBoundingClientRect();
      three.renderer.setSize(rect.width, rect.height, false);
      three.camera.aspect = rect.width / rect.height;
      three.camera.updateProjectionMatrix();
    }
    resizeBrain();
  }

  function neuralValue(key) { return neural[key] || 0; }

  function updateThree() {
    if (!three.renderer || !three.fly) return;
    three.fly.position.set(player.x / 650, 0, player.y / 430 - 0.05 + Math.sin(three.clock * 5) * 0.035);
    three.fly.rotation.x = -neural.moveX * 0.34;
    three.fly.rotation.y = neural.moveY * 0.18 + Math.sin(three.clock * 2.4) * 0.025;
    three.fly.rotation.z = neural.moveY * 0.08;

    three.frontLegs.forEach((leg, index) => {
      if (leg.userData.baseQuaternion) leg.quaternion.copy(leg.userData.baseQuaternion);
      leg.rotateOnAxis(new THREE.Vector3(0, 1, 0), (index === 0 ? -1 : 1) * neural.frontLimb * 0.48);
    });
    three.wings.forEach((wing, index) => {
      if (wing.userData.baseQuaternion) wing.quaternion.copy(wing.userData.baseQuaternion);
      const side = index === 0 ? 1 : -1;
      const asymmetricLift = 1 + side * neural.moveX * 0.28;
      wing.rotateOnAxis(new THREE.Vector3(1, 0, 0), side * Math.sin(three.clock * 28) * 0.34 * asymmetricLift);
      wing.rotateOnAxis(new THREE.Vector3(0, 1, 0), neural.moveY * 0.13);
    });
    three.activityNodes.forEach(({ key, node }) => {
      const activity = clamp(neuralValue(key), 0, 1);
      node.scale.setScalar(0.72 + activity * 2.25);
      node.material.opacity = 0.2 + activity * 0.8;
    });
    three.renderer.render(three.scene, three.camera);
    updateBrainPreview();
  }

  function showThreeFallback() {
    flyView.innerHTML = "<div class=\"fly-fallback\"><strong>3D preview unavailable</strong><span>The replay remains active. A WebGL-capable browser will show the NeuroMechFly body here.</span></div>";
    brainView.innerHTML = "<div class=\"fly-fallback\"><strong>Brain preview unavailable</strong></div>";
  }

  function loadThree() {
    try {
      THREE = window.THREE;
      if (!THREE) throw new Error("Three.js unavailable");
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
