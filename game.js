(() => {
  "use strict";

  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  const ui = {
    levelLabel: document.getElementById("level-label"),
    statusLabel: document.getElementById("status-label"),
    rings: document.getElementById("rings-count"),
    targets: document.getElementById("targets-count"),
    speed: document.getElementById("speed-label"),
    message: document.getElementById("message-label"),
    card: document.getElementById("start-card"),
    cardTitle: document.getElementById("card-title"),
    cardCopy: document.getElementById("card-copy"),
    start: document.getElementById("start-button"),
    restart: document.getElementById("restart-button"),
    next: document.getElementById("next-button"),
    controls: document.getElementById("control-description"),
    vertical: document.getElementById("vertical-control")
  };

  const COLORS = { ink: "#111820", blue: "#005c9e", red: "#a62c2c", green: "#1e6b49", paper: "#f4f1e8", sky: "#d7e4e9", grid: "#9db5bd" };
  const COURSE_LENGTH = 5200;
  const PLAYER_RADIUS = 42;
  const RING_RADIUS = 165;
  const TARGET_HIT_RADIUS = 82;
  const keys = new Set();
  const mouse = { active: false, x: 0.5, y: 0.5 };
  let width = 1000;
  let height = 600;
  let level = 1;
  let running = false;
  let completed = false;
  let lastTime = 0;
  let player;
  let rings;
  let targets;
  let bullets;
  let particles;
  let announcement = "PRESS START";

  function resize() {
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    const rect = canvas.getBoundingClientRect();
    width = Math.max(320, rect.width);
    height = Math.max(320, rect.height);
    canvas.width = Math.floor(width * ratio);
    canvas.height = Math.floor(height * ratio);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  }

  function buildCourse(whichLevel) {
    const lateral = whichLevel === 1 ? [-105, 105, -85, 115, -35] : [-115, 100, -95, 115, 0];
    const vertical = whichLevel === 1 ? [0, 0, 0, 0, 0] : [65, -60, 85, -50, 0];
    // Wide gaps leave time to line up with the next ring or target.
    rings = lateral.map((x, index) => ({ x, y: vertical[index], z: 800 + index * 900, passed: false, result: null }));
    const targetX = whichLevel === 1 ? [-65, 75] : [-70, 70];
    const targetY = whichLevel === 1 ? [0, 0] : [45, -45];
    // Targets occupy their own depth layer between rings rather than sharing a gate plane.
    targets = targetX.map((x, index) => ({ x, y: targetY[index], z: 1250 + index * 1800, hit: false, missed: false }));
  }

  function resetGame(whichLevel = level) {
    level = whichLevel;
    player = { x: 0, y: 0, z: 0, speed: 360, fireCooldown: 0, flash: 0 };
    bullets = [];
    particles = [];
    completed = false;
    running = false;
    announcement = "PRESS START";
    buildCourse(level);
    ui.levelLabel.textContent = `LEVEL ${level} · ${level === 1 ? "LATERAL" : "FULL 2D"}`;
    ui.controls.textContent = level === 1 ? "Level 1 uses horizontal movement only. Level 2 adds vertical movement." : "Level 2 adds vertical movement while the craft continues straight ahead.";
    ui.vertical.style.opacity = level === 1 ? "0.42" : "1";
    ui.cardTitle.textContent = `Level ${level}`;
    ui.cardCopy.textContent = level === 1 ? "Move left and right through five rings. Your craft always moves forward." : "Move left, right, up, and down through five rings. Shoot both targets.";
    ui.start.textContent = `Start level ${level}`;
    ui.next.disabled = true;
    ui.card.hidden = false;
    syncUI();
  }

  function startGame() {
    running = true;
    completed = false;
    ui.card.hidden = true;
    ui.statusLabel.textContent = "RUNNING";
    announcement = "FLY FORWARD";
    lastTime = performance.now();
    requestAnimationFrame(loop);
  }

  function finishGame(success) {
    running = false;
    completed = success;
    announcement = success ? "COURSE COMPLETE" : "COURSE ENDED";
    ui.statusLabel.textContent = success ? "COMPLETE" : "ENDED";
    ui.cardTitle.textContent = success ? `Level ${level} complete` : `Level ${level} finished`;
    ui.cardCopy.textContent = success ? "All rings cleared and both targets hit." : "Try again with a steadier line through the course.";
    ui.start.textContent = "Run again";
    ui.card.hidden = false;
    ui.next.disabled = !(success && level === 1);
    syncUI();
  }

  function syncUI() {
    const passed = rings.filter((ring) => ring.result === "hit").length;
    const hit = targets.filter((target) => target.hit).length;
    ui.rings.textContent = `${passed} / ${rings.length}`;
    ui.targets.textContent = `${hit} / ${targets.length}`;
    ui.speed.textContent = `${(player?.speed / 360 || 1).toFixed(1)}×`;
    ui.message.textContent = announcement;
    if (!running && !completed) ui.statusLabel.textContent = "READY";
  }

  function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }

  function movePlayer(dt) {
    const keyboardX = (keys.has("ArrowRight") || keys.has("d") ? 1 : 0) - (keys.has("ArrowLeft") || keys.has("a") ? 1 : 0);
    const keyboardY = (keys.has("ArrowDown") || keys.has("s") ? 1 : 0) - (keys.has("ArrowUp") || keys.has("w") ? 1 : 0);
    const mouseX = mouse.active ? (mouse.x - 0.5) * 2 : 0;
    const mouseY = mouse.active && level === 2 ? (mouse.y - 0.5) * 2 : 0;
    const inputX = keyboardX || mouseX;
    const inputY = level === 2 ? (keyboardY || mouseY) : 0;
    const response = 520 * dt;
    player.x = clamp(player.x + inputX * response, -230, 230);
    player.y = clamp(player.y + inputY * response, -175, 175);
    player.z += player.speed * dt;
    player.fireCooldown = Math.max(0, player.fireCooldown - dt);
    player.flash = Math.max(0, player.flash - dt);
  }

  function fire() {
    if (!running || player.fireCooldown > 0) return;
    player.fireCooldown = 0.22;
    player.flash = 0.08;
    bullets.push({ x: player.x, y: player.y, z: player.z + 50, speed: 920, life: 2.5 });
  }

  function updateBullets(dt) {
    for (const bullet of bullets) {
      bullet.z += bullet.speed * dt;
      bullet.life -= dt;
      for (const target of targets) {
        if (!target.hit && !target.missed && Math.abs(bullet.z - target.z) < 55 && Math.hypot(bullet.x - target.x, bullet.y - target.y) < TARGET_HIT_RADIUS) {
          target.hit = true;
          particles.push({ x: target.x, y: target.y, z: target.z, life: 0.3, color: COLORS.green });
        }
      }
    }
    bullets = bullets.filter((bullet) => bullet.life > 0 && bullet.z < player.z + 900);
  }

  function updateCourse() {
    for (const ring of rings) {
      if (!ring.passed && player.z >= ring.z) {
        ring.passed = true;
        ring.result = Math.hypot(player.x - ring.x, player.y - ring.y) <= RING_RADIUS - PLAYER_RADIUS ? "hit" : "miss";
        announcement = ring.result === "hit" ? "RING CLEARED" : "RING MISSED";
        if (ring.result === "hit") particles.push({ x: ring.x, y: ring.y, z: ring.z, life: 0.35, color: COLORS.blue });
      }
    }
    for (const target of targets) {
      if (!target.hit && !target.missed && player.z > target.z + 75) target.missed = true;
    }
    if (player.z > COURSE_LENGTH) finishGame(rings.every((ring) => ring.result === "hit") && targets.every((target) => target.hit));
  }

  function updateParticles(dt) { for (const item of particles) item.life -= dt; particles = particles.filter((item) => item.life > 0); }

  function project(x, y, z) {
    const depth = z - player.z;
    const scale = 420 / Math.max(depth, 120);
    return { x: width / 2 + (x - player.x) * scale, y: height / 2 + (y - player.y) * scale, scale, depth };
  }

  function drawBackground() {
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

  function drawRing(ring) {
    const p = project(ring.x, ring.y, ring.z);
    if (p.depth < 90 || p.x < -300 || p.x > width + 300 || p.y < -300 || p.y > height + 300) return;
    const radius = RING_RADIUS * p.scale;
    const ringColors = ["#216eaa", "#c26718", "#2f7d55", "#7548a8", "#a53463"];
    ctx.strokeStyle = ring.result === "miss" ? COLORS.red : ring.result === "hit" ? COLORS.green : ringColors[Math.round(ring.z / 900) % ringColors.length];
    ctx.lineWidth = clamp(18 * p.scale, 5, 22);
    ctx.beginPath(); ctx.arc(p.x, p.y, radius, 0, Math.PI * 2); ctx.stroke();
  }

  function drawTarget(target) {
    const p = project(target.x, target.y, target.z);
    if (p.depth < 90 || p.x < -100 || p.x > width + 100 || p.y < -100 || p.y > height + 100) return;
    const size = clamp(48 * p.scale, 12, 100);
    ctx.fillStyle = target.hit ? COLORS.green : target.missed ? COLORS.red : "#7c3aed";
    ctx.strokeStyle = COLORS.ink;
    ctx.lineWidth = clamp(2 * p.scale, 1.5, 4);
    ctx.fillRect(p.x - size, p.y - size, size * 2, size * 2);
    ctx.strokeRect(p.x - size, p.y - size, size * 2, size * 2);
    ctx.beginPath(); ctx.moveTo(p.x - size * 1.3, p.y); ctx.lineTo(p.x + size * 1.3, p.y); ctx.moveTo(p.x, p.y - size * 1.3); ctx.lineTo(p.x, p.y + size * 1.3); ctx.stroke();
  }

  function drawBullets() {
    ctx.strokeStyle = COLORS.red;
    ctx.lineWidth = 3;
    for (const bullet of bullets) {
      const p = project(bullet.x, bullet.y, bullet.z);
      const tail = project(bullet.x, bullet.y, bullet.z - 100);
      if (p.depth > 0 && p.depth < 1800) { ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(tail.x, tail.y); ctx.stroke(); }
    }
  }

  function drawPlayer() {
    const x = width / 2;
    const y = height / 2;
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = COLORS.paper;
    ctx.strokeStyle = player.flash > 0 ? COLORS.red : COLORS.ink;
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(0, -24); ctx.lineTo(24, 20); ctx.lineTo(0, 12); ctx.lineTo(-24, 20); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-12, 18); ctx.lineTo(12, 18); ctx.stroke();
    ctx.restore();
  }

  function drawParticles() {
    for (const item of particles) {
      const p = project(item.x, item.y, item.z);
      const radius = (1 - item.life / 0.35) * 42 * p.scale;
      ctx.strokeStyle = item.color;
      ctx.globalAlpha = clamp(item.life / 0.35, 0, 1);
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(p.x, p.y, radius, 0, Math.PI * 2); ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }

  function draw() {
    drawBackground();
    [...rings].sort((a, b) => b.z - a.z).forEach(drawRing);
    [...targets].sort((a, b) => b.z - a.z).forEach(drawTarget);
    drawBullets();
    drawParticles();
    drawPlayer();
  }

  function loop(now) {
    if (!running) { draw(); return; }
    const dt = Math.min((now - lastTime) / 1000, 0.05);
    lastTime = now;
    movePlayer(dt);
    updateBullets(dt);
    updateCourse();
    updateParticles(dt);
    draw();
    syncUI();
    if (running) requestAnimationFrame(loop);
  }

  function pointerPosition(event) {
    const rect = canvas.getBoundingClientRect();
    mouse.x = clamp((event.clientX - rect.left) / rect.width, 0, 1);
    mouse.y = clamp((event.clientY - rect.top) / rect.height, 0, 1);
    mouse.active = true;
  }

  window.addEventListener("resize", resize);
  window.addEventListener("keydown", (event) => {
    const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
    if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", " "].includes(event.key)) event.preventDefault();
    keys.add(key);
    if (event.key === " " || key === "f") fire();
  });
  window.addEventListener("keyup", (event) => keys.delete(event.key.length === 1 ? event.key.toLowerCase() : event.key));
  canvas.addEventListener("pointermove", pointerPosition);
  canvas.addEventListener("pointerleave", () => { mouse.active = false; });
  canvas.addEventListener("pointerdown", (event) => { pointerPosition(event); fire(); });
  ui.start.addEventListener("click", () => { resetGame(level); startGame(); });
  ui.restart.addEventListener("click", () => resetGame(level));
  ui.next.addEventListener("click", () => { if (level === 1 && completed) { resetGame(2); startGame(); } });

  resize();
  resetGame(1);
  draw();
})();
