(() => {
  "use strict";

  const canvas = document.getElementById("replay");
  const ctx = canvas.getContext("2d");
  const ui = {
    status: document.getElementById("status-label"),
    rings: document.getElementById("rings-count"),
    targets: document.getElementById("targets-count"),
    message: document.getElementById("message-label"),
    card: document.getElementById("start-card"),
    play: document.getElementById("play-button"),
    playControl: document.getElementById("play-control"),
    restart: document.getElementById("restart-button"),
    timeline: document.getElementById("timeline"),
    time: document.getElementById("time-label")
  };

  const COLORS = { ink: "#111820", blue: "#005c9e", red: "#a62c2c", green: "#1e6b49", paper: "#f4f1e8", sky: "#d7e4e9", grid: "#9db5bd" };
  const RING_COLORS = ["#216eaa", "#c26718", "#2f7d55", "#7548a8", "#a53463"];
  const SPEED = 360;
  const BULLET_SPEED = 920;
  const COURSE_LENGTH = 5200;
  const RING_RADIUS = 165;
  const REPLAY_LENGTH = COURSE_LENGTH / SPEED + 1;

  const rings = [-200, 180, -170, 210, -160].map((x, index) => ({ x, z: 800 + index * 900, color: RING_COLORS[index] }));
  const targets = [-65, 75].map((x, index) => ({ x, z: 1250 + index * 1800, fireAt: (1250 + index * 1800) / SPEED - 0.22 }));
  const path = [
    { z: 0, x: 0 },
    { z: 700, x: -200 },
    { z: 1050, x: -65 },
    { z: 1450, x: 180 },
    { z: 2150, x: -170 },
    { z: 2850, x: 75 },
    { z: 3350, x: 210 },
    { z: 4100, x: -160 },
    { z: COURSE_LENGTH, x: -160 }
  ];

  let width = 1000;
  let height = 600;
  let time = 0;
  let playing = false;
  let lastTime = 0;

  function resize() {
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    const rect = canvas.getBoundingClientRect();
    width = Math.max(320, rect.width);
    height = Math.max(320, rect.height);
    canvas.width = Math.floor(width * ratio);
    canvas.height = Math.floor(height * ratio);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    draw();
  }

  function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }

  function xAtZ(z) {
    for (let index = 1; index < path.length; index += 1) {
      if (z <= path[index].z) {
        const previous = path[index - 1];
        const current = path[index];
        const amount = (z - previous.z) / (current.z - previous.z);
        return previous.x + (current.x - previous.x) * clamp(amount, 0, 1);
      }
    }
    return path[path.length - 1].x;
  }

  function project(x, y, z) {
    const playerZ = time * SPEED;
    const playerX = xAtZ(playerZ);
    const depth = z - playerZ;
    const scale = 420 / Math.max(depth, 120);
    return { x: width / 2 + (x - playerX) * scale, y: height / 2 + y * scale, scale, depth };
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

  function drawRing(ring, index) {
    const p = project(ring.x, 0, ring.z);
    if (p.depth < 90 || p.x < -300 || p.x > width + 300) return;
    const passed = time >= ring.z / SPEED;
    ctx.strokeStyle = passed ? COLORS.green : ring.color;
    ctx.lineWidth = clamp(18 * p.scale, 5, 22);
    ctx.beginPath(); ctx.arc(p.x, p.y, RING_RADIUS * p.scale, 0, Math.PI * 2); ctx.stroke();
    if (passed) {
      ctx.fillStyle = COLORS.green;
      ctx.font = "700 12px system-ui";
      ctx.fillText(`RING ${index + 1}`, p.x - 24, p.y - RING_RADIUS * p.scale - 12);
    }
  }

  function drawTarget(target, index) {
    const hitAt = target.z / SPEED;
    if (time >= hitAt) return;
    const p = project(target.x, 0, target.z);
    if (p.depth < 90 || p.x < -100 || p.x > width + 100) return;
    const size = clamp(48 * p.scale, 12, 100);
    ctx.fillStyle = "#7c3aed";
    ctx.strokeStyle = COLORS.ink;
    ctx.lineWidth = clamp(2 * p.scale, 1.5, 4);
    ctx.fillRect(p.x - size, p.y - size, size * 2, size * 2);
    ctx.strokeRect(p.x - size, p.y - size, size * 2, size * 2);
    ctx.beginPath(); ctx.moveTo(p.x - size * 1.3, p.y); ctx.lineTo(p.x + size * 1.3, p.y); ctx.moveTo(p.x, p.y - size * 1.3); ctx.lineTo(p.x, p.y + size * 1.3); ctx.stroke();
    ctx.fillStyle = COLORS.ink;
    ctx.font = "700 12px system-ui";
    ctx.fillText(`TARGET ${index + 1}`, p.x - 30, p.y - size - 12);
  }

  function drawBullets() {
    for (const target of targets) {
      const hitAt = target.z / SPEED;
      if (time < target.fireAt || time >= hitAt) continue;
      const z = target.z - BULLET_SPEED * (hitAt - time);
      const p = project(target.x, 14, z);
      const tail = project(target.x, 14, z - 100);
      if (p.depth <= 0 || p.depth >= 1800) continue;
      const depthScale = clamp(p.scale / 3.5, 0.16, 1);
      ctx.lineCap = "round";
      ctx.strokeStyle = COLORS.ink;
      ctx.lineWidth = clamp(8 * depthScale, 2, 8);
      ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(tail.x, tail.y); ctx.stroke();
      ctx.strokeStyle = "#e24b2d";
      ctx.lineWidth = clamp(4 * depthScale, 1, 4);
      ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(tail.x, tail.y); ctx.stroke();
      ctx.fillStyle = COLORS.paper;
      const headSize = clamp(8 * depthScale, 2, 8);
      ctx.fillRect(p.x - headSize / 2, p.y - headSize / 2, headSize, headSize);
    }
    ctx.lineCap = "butt";
  }

  function drawExplosions() {
    for (const target of targets) {
      const hitAt = target.z / SPEED;
      const progress = time - hitAt;
      if (progress < 0 || progress > 0.68) continue;
      const p = project(target.x, 0, target.z);
      const alpha = clamp(1 - progress / 0.68, 0, 1);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = COLORS.red;
      ctx.lineWidth = clamp(5 * p.scale, 2, 7);
      for (let index = 0; index < 8; index += 1) {
        const angle = (Math.PI * 2 * index) / 8;
        const start = (8 + progress * 8) * p.scale;
        const end = start + (24 + 18 * (0.7 + (index % 3) * 0.18)) * progress * p.scale;
        ctx.beginPath();
        ctx.moveTo(p.x + Math.cos(angle) * start, p.y + Math.sin(angle) * start);
        ctx.lineTo(p.x + Math.cos(angle) * end, p.y + Math.sin(angle) * end);
        ctx.stroke();
      }
      ctx.fillStyle = "#7c3aed";
      const size = Math.max(4, (18 - progress * 12) * p.scale);
      ctx.fillRect(p.x - size / 2, p.y - size / 2, size, size);
      ctx.restore();
    }
  }

  function drawPlayer() {
    const x = width / 2;
    const y = height / 2 + 72;
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = COLORS.paper;
    ctx.strokeStyle = COLORS.ink;
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(0, -24); ctx.lineTo(24, 20); ctx.lineTo(0, 12); ctx.lineTo(-24, 20); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-12, 18); ctx.lineTo(12, 18); ctx.stroke();
    ctx.restore();
  }

  function drawCrosshair() {
    const x = width / 2;
    const y = height / 2;
    ctx.strokeStyle = COLORS.ink;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x - 15, y); ctx.lineTo(x - 5, y);
    ctx.moveTo(x + 5, y); ctx.lineTo(x + 15, y);
    ctx.moveTo(x, y - 15); ctx.lineTo(x, y - 5);
    ctx.moveTo(x, y + 5); ctx.lineTo(x, y + 15);
    ctx.stroke();
    ctx.strokeRect(x - 4, y - 4, 8, 8);
  }

  function drawPulse() {
    let remaining = 0;
    let color = COLORS.blue;
    for (const ring of rings) {
      const elapsed = time - ring.z / SPEED;
      if (elapsed >= 0 && elapsed < 0.42 && 0.42 - elapsed > remaining) {
        remaining = 0.42 - elapsed;
        color = ring.color;
      }
    }
    if (!remaining) return;
    ctx.save();
    ctx.globalAlpha = (remaining / 0.42) * 0.9;
    ctx.strokeStyle = color;
    ctx.lineWidth = 4 + (remaining / 0.42) * 7;
    ctx.strokeRect(6, 6, width - 12, height - 12);
    ctx.restore();
  }

  function draw() {
    drawBackground();
    [...rings].reverse().forEach((ring, index) => drawRing(ring, rings.indexOf(ring)));
    [...targets].reverse().forEach((target, index) => drawTarget(target, targets.indexOf(target)));
    drawBullets();
    drawExplosions();
    drawPlayer();
    drawCrosshair();
    drawPulse();
  }

  function updateUI() {
    const ringsCleared = rings.filter((ring) => time >= ring.z / SPEED).length;
    const targetsHit = targets.filter((target) => time >= target.z / SPEED).length;
    ui.rings.textContent = `${ringsCleared} / ${rings.length}`;
    ui.targets.textContent = `${targetsHit} / ${targets.length}`;
    ui.timeline.value = time.toFixed(2);
    ui.time.textContent = `${time.toFixed(1)} s`;
    if (time >= REPLAY_LENGTH) {
      ui.status.textContent = "COMPLETE";
      ui.message.textContent = "COURSE COMPLETE";
    } else if (playing) {
      ui.status.textContent = "PLAYING";
      ui.message.textContent = targets.some((target) => Math.abs(time - target.z / SPEED) < 0.2) ? "TARGET HIT" : "REPLAYING";
    } else {
      ui.status.textContent = "READY";
      ui.message.textContent = "REPLAY READY";
    }
    ui.playControl.textContent = playing ? "Pause" : time >= REPLAY_LENGTH ? "Play again" : "Play";
  }

  function setTime(nextTime) {
    time = clamp(nextTime, 0, REPLAY_LENGTH);
    draw();
    updateUI();
  }

  function play() {
    if (time >= REPLAY_LENGTH) time = 0;
    playing = true;
    ui.card.hidden = true;
    lastTime = performance.now();
    updateUI();
    requestAnimationFrame(loop);
  }

  function togglePlay() {
    if (playing) {
      playing = false;
      updateUI();
    } else {
      play();
    }
  }

  function restart() {
    playing = false;
    ui.card.hidden = false;
    setTime(0);
  }

  function loop(now) {
    if (!playing) return;
    const dt = Math.min((now - lastTime) / 1000, 0.05);
    lastTime = now;
    time = Math.min(REPLAY_LENGTH, time + dt);
    if (time >= REPLAY_LENGTH) {
      playing = false;
      ui.card.hidden = false;
    }
    draw();
    updateUI();
    if (playing) requestAnimationFrame(loop);
  }

  window.addEventListener("resize", resize);
  ui.play.addEventListener("click", play);
  ui.playControl.addEventListener("click", togglePlay);
  ui.restart.addEventListener("click", restart);
  ui.timeline.addEventListener("input", (event) => {
    playing = false;
    ui.card.hidden = true;
    setTime(Number(event.target.value));
  });

  ui.timeline.max = REPLAY_LENGTH.toFixed(2);
  resize();
  updateUI();
})();
