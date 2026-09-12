(() => {
  "use strict";

  let THREE = null;
  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  const retinaCanvas = document.getElementById("retina-preview");
  const retinaCtx = retinaCanvas.getContext("2d", { willReadFrequently: true });
  const trainingCanvas = document.getElementById("training-graph");
  const trainingCtx = trainingCanvas.getContext("2d");
  const brainView = document.getElementById("brain-view");
  const flyView = document.getElementById("fly-view");
  const ui = {
    status: document.getElementById("status-label"), episode: document.getElementById("episode-label"),
    rings: document.getElementById("rings-count"), targets: document.getElementById("targets-count"),
    message: document.getElementById("message-label"), card: document.getElementById("start-card"),
    start: document.getElementById("start-button"), run: document.getElementById("run-button"),
    resetLearning: document.getElementById("reset-learning"), skip5: document.getElementById("skip-5"),
    skip10: document.getElementById("skip-10"), skip25: document.getElementById("skip-25"), skip50: document.getElementById("skip-50"), skip100: document.getElementById("skip-100"), action: document.getElementById("action-label"),
    graphSummary: document.getElementById("graph-summary"), graphWindow: document.getElementById("graph-window"),
    graphFrom: document.getElementById("graph-from"), graphTo: document.getElementById("graph-to"), graphApply: document.getElementById("graph-apply"),
    graphShowRings: document.getElementById("graph-show-rings"), graphShowRingAverage: document.getElementById("graph-show-ring-average"),
    graphShowShots: document.getElementById("graph-show-shots"), graphShowShotAverage: document.getElementById("graph-show-shot-average"),
    courseMode: document.getElementById("course-mode"), courseModeNote: document.getElementById("course-mode-note"),
    evaluate: document.getElementById("evaluate-button"),
    oracle: document.getElementById("oracle-button"), retinalDiagnostic: document.getElementById("retinal-diagnostic"),
    statRecordRings: document.getElementById("stat-record-rings"), statRecordHits: document.getElementById("stat-record-hits"),
    statPerfectShots: document.getElementById("stat-perfect-shots"), statShotsAverage: document.getElementById("stat-shots-average"),
    statFirstRingsAverage: document.getElementById("stat-first-rings-average"), statFirstShotsAverage: document.getElementById("stat-first-shots-average"),
    statRingsAverage: document.getElementById("stat-rings-average"), statLatestRings: document.getElementById("stat-latest-rings"),
    statLatestShots: document.getElementById("stat-latest-shots"), graphProbe: document.getElementById("graph-probe"),
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
  const JOINT_ACTIONS = [
    [-1, -1], [0, -1], [1, -1],
    [-1, 0], [0, 0], [1, 0],
    [-1, 1], [0, 1], [1, 1]
  ];
  const Q_POSITION_BINS = 5;
  const Q_SIZE_BINS = 3;
  const Q_VELOCITY_BINS = 3;
  const Q_PHASE_BINS = 10;
  const Q_STATE_COUNT = Q_PHASE_BINS * Q_POSITION_BINS * Q_POSITION_BINS * Q_SIZE_BINS * Q_VELOCITY_BINS * Q_VELOCITY_BINS;
  const Q_ALPHA = 0.2;
  const Q_GAMMA = 0.92;
  const Q_EPSILON_START = 0.22;
  const Q_EPSILON_FLOOR = 0.04;
  const Q_EPSILON_DECAY = 120;
  const Q_REPLAY_CAPACITY = 6000;
  const Q_REPLAY_UPDATES_PER_STEP = 4;
  const POLICY_BASE_FEATURES = 20;
  const POLICY_MEMORY_SIZE = 8;
  const POLICY_FEATURE_SIZE = POLICY_BASE_FEATURES + POLICY_MEMORY_SIZE;
  const POLICY_OUTPUTS = 3;
  const POLICY_GAMMA = 0.96;
  const POLICY_ACTOR_RATE = 0.0045;
  const POLICY_CRITIC_RATE = 0.055;
  const POLICY_REPLAY_CAPACITY = 12000;
  const POLICY_REPLAY_UPDATES = 5;
  const POLICY_N_STEP = 5;
  const POLICY_NOISE_START = 0.34;
  const POLICY_NOISE_FLOOR = 0.07;
  const POLICY_NOISE_DECAY = 150;
  const FIRE_POSITION_BINS = 5;
  const FIRE_DEPTH_BINS = 3;
  const FIRE_STATE_COUNT = FIRE_POSITION_BINS * FIRE_POSITION_BINS * FIRE_DEPTH_BINS;
  const FIRE_ALPHA = 0.18;
  const FIRE_GAMMA = 0.86;
  const COURSE_LENGTH = 7300;
  const SPEED = 360;
  const LATERAL_SPEED = 270;
  const VERTICAL_SPEED = 220;
  const RING_RADIUS = 165;
  const RING_CLEARANCE = 12;
  const TARGET_HIT_RADIUS = 82;
  const BULLET_SPEED = 920;
  const RING_SPACING = 650;
  const LEARNING_RATE = 0.16;
  const ACTION_NOISE_START = 0.24;
  const ACTION_NOISE_FLOOR = 0.05;
  const EXPLORATION_DECAY = 180;
  const CONTEXT_BINS = 9;
  const POLICY_BIAS_SCALE = 0.5;
  const VISUAL_POLICY_RATE = 0.1;
  const VISUAL_POLICY_TRACE_SCALE = 0.9;
  const VISUAL_DIRECTION_RATE = 0.08;
  const VISUAL_POLICY_LIMIT = 2.5;
  const MAX_LEARNED_VISUAL_GAIN = 0.78;
  const VISUAL_GAIN_SUCCESS_STEP = 0.07;
  const VISUAL_GAIN_MISS_STEP = 0.006;
  const EPISODE_BASELINE_MIX = 0.06;
  const EPISODE_TRACE_SCALE = 0.4;
  const RING_TRACE_SCALE = 0.65;
  const RING_TRACE_DECAY = 1.35;
  const RECORD_TRACE_BONUS = 0.5;
  const RECORD_STEERING_GAIN_BONUS = 0.08;
  const TOP_PERFORMANCE_COUNT = 10;
  const ELIGIBILITY_DECAY = 0.42;
  const BASELINE_MIX = 0.08;
  const PROGRESS_REWARD_SCALE = 0.95;
  const RING_SUCCESS_REWARD = 1.4;
  const RING_MISS_REWARD = -0.75;
  const TARGET_REWARD = 0.5;
  const TARGET_MISS_REWARD = -0.18;
  const FAST_FORWARD_DT = 1 / 20;
  const FAST_FORWARD_CHUNK = 80;
  const MAX_RECENT_EPISODES = 10;
  const MOVING_AVERAGE_WINDOW = 10;
  const MAX_STORED_EPISODES = 500;
  const RETINA_WIDTH = 48;
  const RETINA_HEIGHT = 27;
  const CURRICULUM_RAMP_EPISODES = 320;
  const GRAPH_PADDING = { left: 32, right: 34, top: 16, bottom: 24 };

  const baseRingX = [-250, 190, -80, 245, -220, 70, -245, 225, -35, 250];
  const baseRingY = [120, -115, 165, 35, -150, 130, -55, 175, -175, 65];
  const baseRingAngles = [-0.18, 0.52, -0.86, 0.28, 1.12, -0.42, 0.74, -1.02, 0.36, -0.64];
  const baseRingSquash = [0.72, 0.5, 0.82, 0.58, 0.68, 0.46, 0.76, 0.55, 0.84, 0.62];
  let rings = [];
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
  let courseMode = "stationary";
  let running = false;
  let lastTime = 0;
  let nextRingIndex = 0;
  let nextTargetIndex = 0;
  let lastReward = 0;
  let rewardFlash = 0;
  let rewardColor = COLORS.green;
  let actionXIndex = 2;
  let actionYIndex = 2;
  let preferencesX = freshPreferences();
  let preferencesY = freshPreferences();
  let visualPolicyX = freshPreferences();
  let visualPolicyY = freshPreferences();
  let eligibilityX = null;
  let eligibilityY = null;
  let movementBaselineX = 0;
  let movementBaselineY = 0;
  let episodeTraceX = freshEligibility();
  let episodeTraceY = freshEligibility();
  let episodeVisualTraceX = freshEligibility();
  let episodeVisualTraceY = freshEligibility();
  let ringTraceX = freshEligibility();
  let ringTraceY = freshEligibility();
  let episodeScoreBaseline = 0;
  let topPerformances = [];
  let learnedVisualGain = 0;
  let qValues = freshQValues();
  let qState = null;
  let qActionIndex = 4;
  let qRewardAccumulator = 0;
  let qUpdates = 0;
  let qReplayBuffer = [];
  let actorWeights = freshActorWeights();
  let actorBias = [0, 0, -1.2];
  let criticWeights = new Array(POLICY_FEATURE_SIZE).fill(0);
  let criticBias = 0;
  let targetCriticWeights = criticWeights.slice();
  let targetCriticBias = 0;
  let policyMemory = new Array(POLICY_MEMORY_SIZE).fill(0);
  let policyLastFeatures = null;
  let policyLastMeans = [0, 0, 0];
  let policyLastAction = [0, 0, 0];
  let policyLastSigma = POLICY_NOISE_START;
  let policyAction = [0, 0, 0];
  let policyRewardAccumulator = 0;
  let policyRollout = [];
  let policyReplayBuffer = [];
  let policyUpdates = 0;
  let policyEpisodeReturn = 0;
  let evaluationMode = false;
  let oracleMode = false;
  let fireQValues = freshFireQValues();
  let fireState = null;
  let fireAction = 0;
  let fireRewardAccumulator = 0;
  let fireDecisionTimer = 0;
  let firePreference = 0;
  let fireBaseline = 0;
  let fireEligibility = 0;
  let episodeRingHits = 0;
  let episodeRecorded = false;
  let ringHistory = [];
  let targetHistory = [];
  let fastForwarding = false;
  let fastForwardState = null;
  let graphMode = "full";
  let customGraphStart = 0;
  let customGraphEnd = 0;
  const graphVisibility = { rings: true, ringAverage: true, shots: true, shotAverage: true };
  let graphProbeEpisode = null;
  let sensorySeed = 0x4f1bbcdc;
  let previousRetinaColumns = new Array(RETINA_WIDTH).fill(0);
  let previousRetinaRows = new Array(RETINA_HEIGHT).fill(0);
  let retinalTrackX = null;
  let retinalTrackY = null;
  let retinalDiagnostic = { detectedX: null, detectedY: null, actualX: null, actualY: null, confidence: 0 };

  const neural = {
    visualLeft: 0, visualRight: 0, visualUp: 0, visualDown: 0,
    motorLeft: 0, motorRight: 0, motorUp: 0, motorDown: 0,
    frontLimb: 0, dopamine: 0, moveX: 0, moveY: 0,
    contextX: 2, contextY: 2, fireCooldown: 0, decisionTimer: 0, noiseTimer: 0,
    spontaneousX: 0, spontaneousY: 0, turnBiasX: 0, turnBiasY: 0,
    goalMode: "none", goalErrorX: 0, goalErrorY: 0, goalConfidence: 0,
    rewardReferenceX: 0, rewardReferenceY: 0, progressRewardTimer: 0, rewardPotential: 0
  };

  const three = {
    renderer: null, scene: null, camera: null, fly: null, fallback: null,
    frontLegs: [], wings: [], segmentNodes: {}, activityNodes: [], clock: 0, modelReady: false,
    brainRenderer: null, brainScene: null, brainCamera: null, brain: null, brainAtlas: null, brainNodes: []
  };

  function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
  function lerp(a, b, amount) { return a + (b - a) * amount; }
  function randomUnit() { sensorySeed = (sensorySeed * 1664525 + 1013904223) >>> 0; return sensorySeed / 4294967296; }
  function sensoryNoise(amount) { return (randomUnit() * 2 - 1) * amount; }
  function freshPreferences() { return Array.from({ length: CONTEXT_BINS }, () => ACTIONS.map(() => 0)); }
  function freshEligibility() { return Array.from({ length: CONTEXT_BINS }, () => ACTIONS.map(() => 0)); }
  function freshQValues() { return Array.from({ length: Q_STATE_COUNT }, () => new Array(JOINT_ACTIONS.length).fill(0)); }
  function freshActorWeights() { return Array.from({ length: POLICY_OUTPUTS }, () => new Array(POLICY_FEATURE_SIZE).fill(0)); }
  function freshFireQValues() { return Array.from({ length: FIRE_STATE_COUNT }, () => [0, 0.035]); }
  function qEpsilon() { return evaluationMode ? 0 : Math.max(Q_EPSILON_FLOOR, Q_EPSILON_START * Math.exp(-episode / Q_EPSILON_DECAY)); }
  function signedBin(value, bins) {
    return clamp(Math.floor((clamp(value, -1, 1) + 1) * 0.5 * bins), 0, bins - 1);
  }
  function velocityBin(value) {
    return value < -0.22 ? 0 : value > 0.22 ? 2 : 1;
  }
  function fireDepthBin(value) { return value < 140 ? 0 : value < 360 ? 1 : 2; }
  function encodeFireState(input, targetDepth) {
    const x = signedBin(input.targetErrorX, FIRE_POSITION_BINS);
    const y = signedBin(input.targetErrorY, FIRE_POSITION_BINS);
    return (x * FIRE_POSITION_BINS + y) * FIRE_DEPTH_BINS + fireDepthBin(targetDepth);
  }
  function chooseFireAction(state) {
    if (randomUnit() < qEpsilon()) return Math.floor(randomUnit() * 2);
    const values = fireQValues[state];
    if (values[1] === values[0]) return inputFireTieBreak();
    return values[1] > values[0] ? 1 : 0;
  }
  function inputFireTieBreak() { return 1; }

  function policyNoise() {
    return evaluationMode ? 0 : Math.max(POLICY_NOISE_FLOOR, POLICY_NOISE_START * Math.exp(-episode / POLICY_NOISE_DECAY));
  }
  function policySigmoid(value) { return 1 / (1 + Math.exp(-clamp(value, -12, 12))); }
  function policyDot(weights, features) {
    return weights.reduce((sum, weight, index) => sum + weight * features[index], 0);
  }
  function policyBaseFeatures(input) {
    const phase = rings.length ? nextRingIndex / rings.length : 0;
    return [
      input.ringErrorX, input.ringErrorY, input.ringConfidence, input.ringSize,
      input.targetErrorX, input.targetErrorY, input.targetConfidence, input.targetCenter,
      clamp(input.right - input.left, -1, 1), clamp(input.up - input.down, -1, 1),
      neural.moveX, neural.moveY, phase, Math.sin(phase * Math.PI * 2), Math.cos(phase * Math.PI * 2),
      neural.goalErrorX, neural.goalErrorY, neural.goalConfidence, clamp(neural.fireCooldown, 0, 1),
      clamp(lastReward / 2, -1, 1)
    ];
  }
  function buildPolicyFeatures(input) {
    const base = policyBaseFeatures(input);
    for (let index = 0; index < POLICY_MEMORY_SIZE; index += 1) {
      const source = base[(index * 3) % POLICY_BASE_FEATURES] + policyLastAction[index % POLICY_OUTPUTS] * 0.35;
      policyMemory[index] = Math.tanh(policyMemory[index] * 0.86 + source * 0.14);
    }
    return base.concat(policyMemory);
  }
  function criticValue(features, useTarget = false) {
    return policyDot(useTarget ? targetCriticWeights : criticWeights, features) + (useTarget ? targetCriticBias : criticBias);
  }
  function policyMeans(features) {
    return [
      Math.tanh(policyDot(actorWeights[0], features) + actorBias[0]),
      Math.tanh(policyDot(actorWeights[1], features) + actorBias[1]),
      policySigmoid(policyDot(actorWeights[2], features) + actorBias[2])
    ];
  }
  function policyNormalSample(sigma) { return sensoryNoise(sigma); }
  function updateCritic(features, target, rate = POLICY_CRITIC_RATE) {
    const error = clamp(target - criticValue(features), -3, 3);
    criticWeights = criticWeights.map((weight, index) => clamp(weight + rate * error * features[index], -4, 4));
    criticBias = clamp(criticBias + rate * error, -4, 4);
    policyUpdates += 1;
    return error;
  }
  function updateActor(transition, advantage, scale = 1) {
    const sigma = Math.max(transition.sigma, POLICY_NOISE_FLOOR);
    const moveGradientX = clamp(((transition.action[0] - transition.means[0]) / (sigma * sigma)) * (1 - transition.means[0] * transition.means[0]) * advantage * scale, -2, 2);
    const moveGradientY = clamp(((transition.action[1] - transition.means[1]) / (sigma * sigma)) * (1 - transition.means[1] * transition.means[1]) * advantage * scale, -2, 2);
    const fireGradient = clamp((transition.action[2] - transition.means[2]) * advantage * scale, -2, 2);
    [moveGradientX, moveGradientY, fireGradient].forEach((gradient, output) => {
      actorWeights[output] = actorWeights[output].map((weight, index) => clamp(weight + POLICY_ACTOR_RATE * gradient * transition.features[index], -5, 5));
      actorBias[output] = clamp(actorBias[output] + POLICY_ACTOR_RATE * gradient, -5, 5);
    });
  }
  function pushPolicyTransition(transition) {
    const priority = Math.abs(transition.advantage || transition.reward) + 0.05;
    policyReplayBuffer.push({ ...transition, priority });
    if (policyReplayBuffer.length > POLICY_REPLAY_CAPACITY) policyReplayBuffer.shift();
  }
  function replayPolicyCritic() {
    if (evaluationMode || policyReplayBuffer.length < 8) return;
    for (let index = 0; index < POLICY_REPLAY_UPDATES; index += 1) {
      const totalPriority = policyReplayBuffer.reduce((sum, item) => sum + item.priority, 0);
      let cursor = randomUnit() * totalPriority;
      let selected = policyReplayBuffer[0];
      for (const item of policyReplayBuffer) {
        cursor -= item.priority;
        if (cursor <= 0) { selected = item; break; }
      }
      const error = updateCritic(selected.features, selected.returnTarget, POLICY_CRITIC_RATE * 0.45);
      selected.priority = Math.abs(error) + 0.05;
    }
    targetCriticWeights = criticWeights.slice();
    targetCriticBias = criticBias;
  }
  function finishPolicyEpisode() {
    if (policyLastFeatures) {
      policyRollout.push({ features: policyLastFeatures.slice(), means: policyLastMeans.slice(), action: policyLastAction.slice(), sigma: policyLastSigma, reward: clamp(policyRewardAccumulator, -2, 2) });
    }
    policyEpisodeReturn = policyRollout.reduce((sum, transition) => sum + transition.reward, 0);
    let returnValue = 0;
    for (let index = policyRollout.length - 1; index >= 0; index -= 1) {
      const transition = policyRollout[index];
      returnValue = transition.reward + POLICY_GAMMA * returnValue;
      let nStepTarget = 0;
      let discount = 1;
      for (let step = 0; step < POLICY_N_STEP && index + step < policyRollout.length; step += 1) {
        nStepTarget += discount * policyRollout[index + step].reward;
        discount *= POLICY_GAMMA;
      }
      if (index + POLICY_N_STEP < policyRollout.length) {
        nStepTarget += discount * criticValue(policyRollout[index + POLICY_N_STEP].features, true);
      }
      const advantage = clamp(returnValue - criticValue(transition.features), -3, 3);
      transition.returnTarget = nStepTarget;
      transition.policyReturn = returnValue;
      transition.advantage = advantage;
      if (!evaluationMode) {
        updateCritic(transition.features, nStepTarget);
        updateActor(transition, advantage);
        pushPolicyTransition(transition);
      }
    }
    if (!evaluationMode) {
      replayPolicyCritic();
      const score = episodeRingHits + targets.filter((target) => target.hit).length * 1.5;
      if (score > 0) {
        topPerformances.push({ score, rings: episodeRingHits, shots: targets.filter((target) => target.hit).length, rollout: policyRollout.map((transition) => ({ ...transition, features: transition.features.slice(), means: transition.means.slice(), action: transition.action.slice() })) });
        topPerformances.sort((a, b) => b.score - a.score);
        topPerformances = topPerformances.slice(0, TOP_PERFORMANCE_COUNT);
      }
      const best = topPerformances.slice(0, 3);
      best.forEach((performance, index) => performance.rollout.forEach((transition) => updateActor(transition, transition.advantage || 0, 0.08 * (1 - index * 0.2))));
    }
    policyLastFeatures = null;
    policyLastAction = [0, 0, 0];
    policyRewardAccumulator = 0;
    policyRollout = [];
    policyEpisodeReturn = 0;
  }
  function updateFireValue(nextState, terminal = false) {
    if (fireState === null || evaluationMode) return;
    const current = fireQValues[fireState][fireAction];
    const nextValue = terminal ? 0 : Math.max(...fireQValues[nextState]);
    const target = clamp(fireRewardAccumulator, -1.5, 1.5) + FIRE_GAMMA * nextValue;
    fireQValues[fireState][fireAction] = current + FIRE_ALPHA * (target - current);
    fireRewardAccumulator = 0;
  }
  function finalizeFireEpisode() {
    updateFireValue(0, true);
    fireState = null;
    fireAction = 0;
    fireRewardAccumulator = 0;
  }
  function sizeBin(value) {
    return value < 0.18 ? 0 : value < 0.5 ? 1 : 2;
  }
  function encodeQState(input) {
    const x = signedBin(input.ringErrorX, Q_POSITION_BINS);
    const y = signedBin(input.ringErrorY, Q_POSITION_BINS);
    const size = sizeBin(input.ringSize * input.ringConfidence);
    const velocityX = velocityBin(neural.moveX);
    const velocityY = velocityBin(neural.moveY);
    const phase = clamp(nextRingIndex, 0, Q_PHASE_BINS - 1);
    return (((((phase * Q_POSITION_BINS) + x) * Q_POSITION_BINS + y) * Q_SIZE_BINS + size) * Q_VELOCITY_BINS + velocityX) * Q_VELOCITY_BINS + velocityY;
  }
  function bestQValue(state) { return Math.max(...qValues[state]); }
  function chooseQAction(state) {
    if (randomUnit() < qEpsilon()) return Math.floor(randomUnit() * JOINT_ACTIONS.length);
    const values = qValues[state];
    const best = Math.max(...values);
    const candidates = values.map((value, index) => value === best ? index : -1).filter((index) => index >= 0);
    return candidates[Math.floor(randomUnit() * candidates.length)] ?? 4;
  }
  function applyQTransition(state, action, reward, nextState, terminal = false) {
    const current = qValues[state][action];
    const target = reward + (terminal ? 0 : Q_GAMMA * bestQValue(nextState));
    qValues[state][action] = current + Q_ALPHA * (target - current);
    qUpdates += 1;
  }
  function rememberQTransition(transition) {
    qReplayBuffer.push(transition);
    if (qReplayBuffer.length > Q_REPLAY_CAPACITY) qReplayBuffer.shift();
  }
  function replayQTransitions() {
    if (evaluationMode || qReplayBuffer.length < 8) return;
    for (let index = 0; index < Q_REPLAY_UPDATES_PER_STEP; index += 1) {
      const transition = qReplayBuffer[Math.floor(randomUnit() * qReplayBuffer.length)];
      applyQTransition(transition.state, transition.action, transition.reward, transition.nextState, transition.terminal);
    }
  }
  function updateQValue(nextState, terminal = false) {
    if (qState === null) return;
    if (!evaluationMode) {
      const transition = {
        state: qState,
        action: qActionIndex,
        reward: clamp(qRewardAccumulator, -2, 2),
        nextState,
        terminal
      };
      applyQTransition(transition.state, transition.action, transition.reward, transition.nextState, terminal);
      rememberQTransition(transition);
      replayQTransitions();
    }
    qRewardAccumulator = 0;
  }
  function finalizeQEpisode() {
    updateQValue(0, true);
    qState = null;
    qActionIndex = 4;
    qRewardAccumulator = 0;
    policyMemory = new Array(POLICY_MEMORY_SIZE).fill(0);
    policyLastFeatures = null;
    policyLastMeans = [0, 0, 0];
    policyLastAction = [0, 0, 0];
    policyAction = [0, 0, 0];
    policyRewardAccumulator = 0;
    policyRollout = [];
    fireState = null;
    fireAction = 0;
    fireRewardAccumulator = 0;
    fireDecisionTimer = 0;
  }
  function explorationNoise() {
    return Math.max(ACTION_NOISE_FLOOR, ACTION_NOISE_START * Math.exp(-episode / EXPLORATION_DECAY));
  }
  function quantizeContext(error, closingRate) {
    const positionBand = clamp(Math.floor((error + 1) * 1.5), 0, 2);
    const trendBand = closingRate > 0.012 ? 2 : closingRate < -0.012 ? 0 : 1;
    return positionBand * 3 + trendBand;
  }

  function createRings(episodeNumber) {
    let seed = (0x9e3779b9 ^ Math.imul(episodeNumber + 1, 0x45d9f3b)) >>> 0;
    const next = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    const variation = courseMode === "randomized"
      ? Math.min(1, 0.25 + episodeNumber / CURRICULUM_RAMP_EPISODES)
      : 0;
    return baseRingX.map((baseX, index) => ({
      x: clamp(baseX + (next() * 2 - 1) * 72 * variation, -265, 265),
      y: clamp(baseRingY[index] + (next() * 2 - 1) * 58 * variation, -180, 180),
      z: 700 + index * RING_SPACING,
      angle: baseRingAngles[index] + (next() * 2 - 1) * 0.2 * variation,
      squash: clamp(baseRingSquash[index] + (next() * 2 - 1) * 0.08 * variation, 0.42, 0.88),
      color: RING_COLORS[index % RING_COLORS.length], result: null
    }));
  }

  function resetEpisode(render = true) {
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
    neural.goalMode = "none";
    neural.goalErrorX = 0;
    neural.goalErrorY = 0;
    neural.goalConfidence = 0;
    neural.rewardReferenceX = 0;
    neural.rewardReferenceY = 0;
    neural.progressRewardTimer = 0;
    neural.rewardPotential = 0;
    neural.frontLimb = 0;
    qState = null;
    qActionIndex = 4;
    qRewardAccumulator = 0;
    policyMemory = new Array(POLICY_MEMORY_SIZE).fill(0);
    policyLastFeatures = null;
    policyLastMeans = [0, 0, 0];
    policyLastAction = [0, 0, 0];
    policyLastSigma = POLICY_NOISE_START;
    policyAction = [0, 0, 0];
    policyRewardAccumulator = 0;
    policyRollout = [];
    eligibilityX = freshEligibility();
    eligibilityY = freshEligibility();
    fireEligibility = 0;
    episodeTraceX = freshEligibility();
    episodeTraceY = freshEligibility();
    episodeVisualTraceX = freshEligibility();
    episodeVisualTraceY = freshEligibility();
    ringTraceX = freshEligibility();
    ringTraceY = freshEligibility();
    rings = createRings(episode);
    episodeRingHits = 0;
    episodeRecorded = false;
    sensorySeed = (0x4f1bbcdc + episode * 1103515245) >>> 0;
    previousRetinaColumns = new Array(RETINA_WIDTH).fill(0);
    previousRetinaRows = new Array(RETINA_HEIGHT).fill(0);
    retinalTrackX = null;
    retinalTrackY = null;
    retinalDiagnostic = { detectedX: null, detectedY: null, actualX: null, actualY: null, confidence: 0 };
    rings.forEach((ring) => { ring.result = null; });
    if (render) {
      syncUI();
      drawGame();
      updateRetinaFromCamera();
      updateThree();
    }
  }

  function resetLearning() {
    if (running || fastForwarding) return;
    preferencesX = freshPreferences();
    preferencesY = freshPreferences();
    qValues = freshQValues();
    actorWeights = freshActorWeights();
    actorBias = [0, 0, -1.2];
    criticWeights = new Array(POLICY_FEATURE_SIZE).fill(0);
    criticBias = 0;
    targetCriticWeights = criticWeights.slice();
    targetCriticBias = 0;
    policyReplayBuffer = [];
    policyUpdates = 0;
    policyEpisodeReturn = 0;
    fireQValues = freshFireQValues();
    qState = null;
    qActionIndex = 4;
    qRewardAccumulator = 0;
    qUpdates = 0;
    qReplayBuffer = [];
    evaluationMode = false;
    oracleMode = false;
    visualPolicyX = freshPreferences();
    visualPolicyY = freshPreferences();
    eligibilityX = freshEligibility();
    eligibilityY = freshEligibility();
    movementBaselineX = 0;
    movementBaselineY = 0;
    episodeScoreBaseline = 0;
    topPerformances = [];
    learnedVisualGain = 0;
    firePreference = 0;
    fireBaseline = 0;
    fireEligibility = 0;
    ringHistory = [];
    targetHistory = [];
    episode = 0;
    resetEpisode();
    drawTrainingGraph();
    ui.learning.textContent = "Joint Q policy is untrained. The fly is exploring the full course.";
    syncCourseModeUI();
  }

  function syncCourseModeUI() {
    if (!ui.courseMode) return;
    ui.courseMode.value = courseMode;
    ui.courseMode.disabled = running || fastForwarding;
    ui.courseModeNote.textContent = courseMode === "stationary"
      ? "The same ten-ring layout repeats. Switch to randomized between episodes to test transfer."
      : "A new ring layout is generated each episode while the same full-course learner continues. Switch only between episodes.";
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
    let ringWeight = 0;
    let ringCentroidX = 0;
    let ringCentroidY = 0;
    const ringMask = new Array(RETINA_WIDTH * RETINA_HEIGHT).fill(0);
    let targetWeight = 0;
    let targetCentroidX = 0;
    let targetCentroidY = 0;
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
        const targetPixel = red > 0.5 && blue > 0.55 && green < 0.45
          && Math.abs(red - blue) < 0.23 && red + blue > 1.25;
        // The rendered body/ship occupies the lower-center retinal field. It
        // is not an external visual object, so keep it out of ring detection.
        const selfBodyPixel = x >= 17 && x <= 31 && y >= Math.floor(RETINA_HEIGHT * 0.5);
        if (targetPixel) {
          targetColumns[x] += 1;
          targetRows[y] += 1;
          targetWeight += 1;
          targetCentroidX += x;
          targetCentroidY += y;
        } else if (!selfBodyPixel && chroma > 0.27 && luminance > 0.28) {
          const ringPixelWeight = chroma * (0.55 + luminance);
          ringWeight += ringPixelWeight;
          ringCentroidX += x * ringPixelWeight;
          ringCentroidY += y * ringPixelWeight;
          ringMask[y * RETINA_WIDTH + x] = ringPixelWeight;
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
    const targetColumnCenter = targetWeight ? targetCentroidX / targetWeight : RETINA_WIDTH * 0.5;
    const targetRowCenter = targetWeight ? targetCentroidY / targetWeight : RETINA_HEIGHT * 0.5;
    // Treat the low-resolution retina as the sensor, then group nearby
    // saturated pixels into objects. The largest colored object is usually
    // the nearest ring, so movement is based on one gate instead of the
    // centroid of every visible gate in the scene.
    const visited = new Uint8Array(ringMask.length);
    const components = [];
    for (let y = yStart; y < yEnd; y += 1) {
      for (let x = 0; x < RETINA_WIDTH; x += 1) {
        const start = y * RETINA_WIDTH + x;
        if (!ringMask[start] || visited[start]) continue;
        const stack = [start];
        visited[start] = 1;
        let weight = 0;
        let centroidX = 0;
        let centroidY = 0;
        let count = 0;
        while (stack.length) {
          const current = stack.pop();
          const currentX = current % RETINA_WIDTH;
          const currentY = Math.floor(current / RETINA_WIDTH);
          const currentWeight = ringMask[current];
          weight += currentWeight;
          centroidX += currentX * currentWeight;
          centroidY += currentY * currentWeight;
          count += 1;
          for (let offsetY = -1; offsetY <= 1; offsetY += 1) {
            for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
              if (!offsetX && !offsetY) continue;
              const neighborX = currentX + offsetX;
              const neighborY = currentY + offsetY;
              if (neighborX < 0 || neighborX >= RETINA_WIDTH || neighborY < yStart || neighborY >= yEnd) continue;
              const neighbor = neighborY * RETINA_WIDTH + neighborX;
              if (ringMask[neighbor] && !visited[neighbor]) {
                visited[neighbor] = 1;
                stack.push(neighbor);
              }
            }
          }
        }
        if (count >= 2 && weight > 0.35) components.push({ weight, centroidX, centroidY, count });
      }
    }
    const mergedComponents = [];
    for (const component of components) {
      const componentX = component.centroidX / component.weight;
      const componentY = component.centroidY / component.weight;
      const mergeTarget = mergedComponents.find((candidate) => Math.hypot(candidate.centroidX / candidate.weight - componentX, candidate.centroidY / candidate.weight - componentY) <= 10);
      if (!mergeTarget) {
        mergedComponents.push({ ...component });
      } else {
        mergeTarget.centroidX += component.centroidX;
        mergeTarget.centroidY += component.centroidY;
        mergeTarget.weight += component.weight;
        mergeTarget.count += component.count;
      }
    }
    mergedComponents.sort((a, b) => b.count - a.count || b.weight - a.weight);
    let nearestRing = mergedComponents[0] || null;
    if (retinalTrackX !== null && retinalTrackY !== null && mergedComponents.length) {
      const trackedCandidates = mergedComponents
        .map((component) => ({ component, distance: Math.hypot(component.centroidX / component.weight - retinalTrackX, component.centroidY / component.weight - retinalTrackY) }))
        .filter(({ distance }) => distance <= 8)
        .sort((a, b) => (b.component.weight / (1 + b.distance)) - (a.component.weight / (1 + a.distance)));
      if (trackedCandidates.length) nearestRing = trackedCandidates[0].component;
    }
    const selectedRingWeight = nearestRing ? nearestRing.weight : ringWeight;
    const ringColumnCenter = nearestRing
      ? nearestRing.centroidX / nearestRing.weight
      : ringWeight ? ringCentroidX / ringWeight : RETINA_WIDTH * 0.5;
    const ringRowCenter = nearestRing
      ? nearestRing.centroidY / nearestRing.weight
      : ringWeight ? ringCentroidY / ringWeight : RETINA_HEIGHT * 0.5;
    if (nearestRing) {
      retinalTrackX = ringColumnCenter;
      retinalTrackY = ringRowCenter;
    } else {
      retinalTrackX = null;
      retinalTrackY = null;
    }
    const actualRing = rings[nextRingIndex];
    const actualProjection = actualRing ? project(actualRing.x, actualRing.y, actualRing.z) : null;
    const actualColumnCenter = actualProjection
      ? clamp((actualProjection.x / width) * RETINA_WIDTH, -RETINA_WIDTH, RETINA_WIDTH * 2)
      : null;
    const actualRowCenter = actualProjection
      ? clamp((actualProjection.y / height) * RETINA_HEIGHT, -RETINA_HEIGHT, RETINA_HEIGHT * 2)
      : null;
    const detectedErrorX = clamp((ringColumnCenter - RETINA_WIDTH * 0.5) / (RETINA_WIDTH * 0.5), -1, 1);
    const detectedErrorY = clamp((RETINA_HEIGHT * 0.5 - ringRowCenter) / (RETINA_HEIGHT * 0.5), -1, 1);
    const actualErrorX = actualColumnCenter === null ? null : clamp((actualColumnCenter - RETINA_WIDTH * 0.5) / (RETINA_WIDTH * 0.5), -1, 1);
    const actualErrorY = actualRowCenter === null ? null : clamp((RETINA_HEIGHT * 0.5 - actualRowCenter) / (RETINA_HEIGHT * 0.5), -1, 1);
    retinalDiagnostic = { detectedX: detectedErrorX, detectedY: detectedErrorY, actualX: actualErrorX, actualY: actualErrorY, confidence: clamp(selectedRingWeight / 10, 0, 1) };
    if (ui.retinalDiagnostic) {
      const formatPoint = (x, y) => x === null || y === null ? "—" : `${x.toFixed(2)},${y.toFixed(2)}`;
      ui.retinalDiagnostic.textContent = `DETECTED ${formatPoint(detectedErrorX, detectedErrorY)} · ACTUAL ${formatPoint(actualErrorX, actualErrorY)} · CONF ${retinalDiagnostic.confidence.toFixed(2)}`;
    }
    const drawRetinaMarker = (x, y, color) => {
      if (x === null || y === null || x < 0 || x >= RETINA_WIDTH || y < 0 || y >= RETINA_HEIGHT) return;
      retinaCtx.strokeStyle = color;
      retinaCtx.lineWidth = 0.65;
      retinaCtx.beginPath();
      retinaCtx.moveTo(x - 2, y); retinaCtx.lineTo(x + 2, y);
      retinaCtx.moveTo(x, y - 2); retinaCtx.lineTo(x, y + 2);
      retinaCtx.stroke();
    };
    drawRetinaMarker(actualColumnCenter, actualRowCenter, "#f1ad45");
    drawRetinaMarker(ringColumnCenter, ringRowCenter, "#48b8dd");
    return {
      left: clamp(left * 2.45, 0, 1), right: clamp(right * 2.45, 0, 1),
      up: clamp(up * 2.7, 0, 1), down: clamp(down * 2.7, 0, 1),
      center: clamp(center * 2.2, 0, 1), targetCenter: clamp(targetCenter * 6.5, 0, 1),
      ringErrorX: detectedErrorX,
      ringErrorY: detectedErrorY,
      ringConfidence: clamp(selectedRingWeight / 10, 0, 1),
      ringSize: clamp(Math.sqrt(selectedRingWeight / 30), 0, 1),
      targetErrorX: clamp((targetColumnCenter - RETINA_WIDTH * 0.5) / (RETINA_WIDTH * 0.5), -1, 1),
      targetErrorY: clamp((RETINA_HEIGHT * 0.5 - targetRowCenter) / (RETINA_HEIGHT * 0.5), -1, 1),
      targetConfidence: clamp(targetWeight / 12, 0, 1)
    };
  }

  function selectAxisAction(axis) {
    const isX = axis === "x";
    const context = isX ? neural.contextX : neural.contextY;
    const preferences = isX ? preferencesX : preferencesY;
    const visualPolicy = isX ? visualPolicyX : visualPolicyY;
    const spontaneous = isX ? neural.spontaneousX : neural.spontaneousY;
    const adaptation = isX ? neural.turnBiasX : neural.turnBiasY;
    let bestIndex = 0;
    let bestScore = -Infinity;
    ACTIONS.forEach((action, index) => {
      // Visual input only influences movement through this learned table. It
      // starts at zero, so the untrained fly does not have an innate ring reflex.
      const learnedVisualPolicy = visualPolicy[context][index] * (0.35 + learnedVisualGain * 0.65);
      const spontaneousBias = spontaneous * action * 0.23;
      const adaptationBias = -adaptation * action * 0.27;
      const score = preferences[context][index] * POLICY_BIAS_SCALE + learnedVisualPolicy + spontaneousBias + adaptationBias + sensoryNoise(explorationNoise());
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
    const previousGoalMode = neural.goalMode;
    const ringVisible = input.ringConfidence > 0.12;
    const targetVisible = input.targetConfidence > 0.10;
    const goalMode = ringVisible ? "ring" : targetVisible ? "target" : "none";
    const goalErrorX = ringVisible ? input.ringErrorX : targetVisible ? input.targetErrorX : differenceX;
    const goalErrorY = ringVisible ? input.ringErrorY : targetVisible ? input.targetErrorY : differenceY;
    const goalConfidence = ringVisible ? input.ringConfidence : targetVisible ? input.targetConfidence : 0;
    const goalClosingX = previousGoalMode === goalMode ? Math.abs(neural.goalErrorX) - Math.abs(goalErrorX) : 0;
    const goalClosingY = previousGoalMode === goalMode ? Math.abs(neural.goalErrorY) - Math.abs(goalErrorY) : 0;
    neural.goalMode = goalMode;
    neural.goalErrorX = goalErrorX;
    neural.goalErrorY = goalErrorY;
    neural.goalConfidence = goalConfidence;
    if (previousGoalMode !== goalMode) {
      neural.rewardReferenceX = goalErrorX;
      neural.rewardReferenceY = goalErrorY;
    }
    neural.contextX = quantizeContext(goalErrorX, goalClosingX);
    neural.contextY = quantizeContext(goalErrorY, goalClosingY);

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
      if (policyLastFeatures) {
        policyRollout.push({ features: policyLastFeatures.slice(), means: policyLastMeans.slice(), action: policyLastAction.slice(), sigma: policyLastSigma, reward: clamp(policyRewardAccumulator, -2, 2) });
        policyEpisodeReturn += policyRewardAccumulator;
        policyRewardAccumulator = 0;
      }
      const features = buildPolicyFeatures(input);
      const means = policyMeans(features);
      const sigma = policyNoise();
      const moveX = evaluationMode ? means[0] : clamp(means[0] + policyNormalSample(sigma), -1, 1);
      const moveY = evaluationMode ? means[1] : clamp(means[1] + policyNormalSample(sigma), -1, 1);
      const fire = evaluationMode ? (means[2] > 0.5 ? 1 : 0) : (randomUnit() < means[2] ? 1 : 0);
      policyAction = [moveX, moveY, fire];
      policyLastFeatures = features;
      policyLastMeans = means;
      policyLastAction = policyAction.slice();
      policyLastSigma = sigma;
      if (ringVisible && !oracleMode) {
        const visualAlignment = (moveX * input.ringErrorX + moveY * input.ringErrorY) * 0.5;
        policyRewardAccumulator += clamp(visualAlignment * 0.06 * input.ringConfidence, -0.1, 0.1);
      }
      neural.decisionTimer = 0.15 + randomUnit() * 0.15;
    }

    neural.progressRewardTimer -= dt;
    if (goalConfidence > 0.12 && neural.progressRewardTimer <= 0) {
      const currentPotential = -Math.hypot(goalErrorX, goalErrorY) * goalConfidence;
      const potentialReward = clamp((currentPotential - neural.rewardPotential) * 1.25, -0.12, 0.12);
      if (Math.abs(potentialReward) > 0.004) applyMovementReward(potentialReward, potentialReward, potentialReward > 0 ? COLORS.blue : COLORS.red);
      neural.rewardPotential = currentPotential;
      neural.progressRewardTimer = 0.12;
    }

    const [jointMoveX, jointMoveY] = oracleMode ? [0, 0] : policyAction;
    const activeTarget = targets[nextTargetIndex];
    const activeRing = rings[nextRingIndex];
    let oracleAim = activeRing;
    if (oracleMode && activeTarget && (!activeRing || activeRing.z - player.z > 520) && activeTarget.z - player.z > 40 && activeTarget.z - player.z < 520) oracleAim = activeTarget;
    const oracleMoveX = oracleAim ? clamp((oracleAim.x - player.x) / 118, -1, 1) : 0;
    const oracleMoveY = oracleAim ? clamp((oracleAim.y - player.y) / 118, -1, 1) : 0;
    const targetX = oracleMode ? oracleMoveX : jointMoveX;
    const targetY = oracleMode ? oracleMoveY : jointMoveY;
    const motorMix = 1 - Math.exp(-dt * 5.5);
    neural.moveX = lerp(neural.moveX, clamp(targetX, -1, 1), motorMix);
    neural.moveY = lerp(neural.moveY, clamp(targetY, -1, 1), motorMix);
    const readoutMix = 1 - Math.exp(-dt * 9);
    neural.motorLeft = lerp(neural.motorLeft, Math.max(0, -neural.moveX), readoutMix);
    neural.motorRight = lerp(neural.motorRight, Math.max(0, neural.moveX), readoutMix);
    neural.motorUp = lerp(neural.motorUp, Math.max(0, neural.moveY), readoutMix);
    neural.motorDown = lerp(neural.motorDown, Math.max(0, -neural.moveY), readoutMix);

    neural.fireCooldown = Math.max(0, neural.fireCooldown - dt);
    const target = targets[nextTargetIndex];
    if (target && !target.hit && !target.missed) {
      const targetDepth = target.z - player.z;
      const oracleAlignment = clamp(1 - Math.hypot(target.x - player.x, target.y - player.y) / (TARGET_HIT_RADIUS * 1.25), 0, 1);
      const targetAlignment = oracleMode
        ? oracleAlignment
        : input.targetConfidence * (1 - clamp((Math.abs(input.targetErrorX) + Math.abs(input.targetErrorY)) * 0.5, 0, 1));
      const targetVisual = Math.max(input.targetCenter * input.center, targetAlignment * 1.5);
      neural.frontLimb = lerp(neural.frontLimb, targetVisual, 1 - Math.exp(-dt * 15));
      fireEligibility = Math.max(fireEligibility * Math.exp(-dt * 1.4), targetVisual);
      const fireThreshold = 0.14;
      if (targetVisual > fireThreshold && (oracleMode || policyAction[2] === 1) && neural.fireCooldown <= 0 && targetDepth > 40 && targetDepth < 480) fire();
    } else {
      neural.frontLimb = lerp(neural.frontLimb, 0, 1 - Math.exp(-dt * 12));
      fireEligibility *= Math.exp(-dt * 1.4);
      fireDecisionTimer = 0;
    }
    neural.dopamine = lerp(neural.dopamine, 0, 1 - Math.exp(-dt * 4));
  }

  function reinforcePreference(preferences, delta, eligibility) {
    for (let context = 0; context < preferences.length; context += 1) {
      for (let index = 0; index < ACTIONS.length; index += 1) {
        preferences[context][index] += LEARNING_RATE * delta * eligibility[context][index];
      }
      preferences[context] = preferences[context].map((value) => clamp(value, -2.5, 2.5));
    }
  }

  function reinforceTrace(preferences, trace, strength) {
    for (let context = 0; context < preferences.length; context += 1) {
      for (let index = 0; index < ACTIONS.length; index += 1) {
        preferences[context][index] += LEARNING_RATE * strength * trace[context][index];
      }
      preferences[context] = preferences[context].map((value) => clamp(value, -2.5, 2.5));
    }
  }

  function reinforceVisualTrace(policy, trace, strength) {
    for (let context = 0; context < policy.length; context += 1) {
      for (let index = 0; index < ACTIONS.length; index += 1) {
        policy[context][index] += VISUAL_POLICY_RATE * strength * trace[context][index];
      }
      policy[context] = policy[context].map((value) => clamp(value, -VISUAL_POLICY_LIMIT, VISUAL_POLICY_LIMIT));
    }
  }

  function reinforceObservedDirection(policy, trace, goalError, strength) {
    const desiredDirection = Math.sign(goalError);
    if (!desiredDirection) return;
    for (let context = 0; context < policy.length; context += 1) {
      for (let index = 0; index < ACTIONS.length; index += 1) {
        const alignment = desiredDirection * ACTIONS[index];
        policy[context][index] += VISUAL_DIRECTION_RATE * strength * alignment * trace[context][index];
      }
      policy[context] = policy[context].map((value) => clamp(value, -VISUAL_POLICY_LIMIT, VISUAL_POLICY_LIMIT));
    }
  }

  function learnFromRingOutcome(success, xQuality, yQuality, goalErrorX, goalErrorY) {
    const quality = (xQuality + yQuality) * 0.5;
    const ringAdvantage = success ? 1.15 + quality * 0.85 : -0.22 + quality * 0.08;
    const visualAdvantage = success ? 1.2 + quality * 0.8 : -0.16;
    reinforceTrace(preferencesX, ringTraceX, ringAdvantage * RING_TRACE_SCALE);
    reinforceTrace(preferencesY, ringTraceY, ringAdvantage * RING_TRACE_SCALE);
    reinforceVisualTrace(visualPolicyX, ringTraceX, visualAdvantage * VISUAL_POLICY_TRACE_SCALE);
    reinforceVisualTrace(visualPolicyY, ringTraceY, visualAdvantage * VISUAL_POLICY_TRACE_SCALE);
    const directionalStrength = success ? 1.0 + quality * 0.5 : -0.12;
    reinforceObservedDirection(visualPolicyX, ringTraceX, goalErrorX, directionalStrength);
    reinforceObservedDirection(visualPolicyY, ringTraceY, goalErrorY, directionalStrength);
    ringTraceX = freshEligibility();
    ringTraceY = freshEligibility();
  }

  function cloneTrace(trace) { return trace.map((row) => row.slice()); }

  function updateLearnedVisualGain(success, quality = 0) {
    const change = success
      ? VISUAL_GAIN_SUCCESS_STEP * (0.7 + quality * 0.3)
      : -VISUAL_GAIN_MISS_STEP;
    learnedVisualGain = clamp(learnedVisualGain + change, 0, MAX_LEARNED_VISUAL_GAIN);
  }

  function learnFromCompletedEpisode() {
    const shots = targets.filter((target) => target.hit).length;
    const score = episodeRingHits + shots * 1.5;
    const advantage = clamp(score - episodeScoreBaseline, -4, 4);
    reinforceTrace(preferencesX, episodeTraceX, advantage * EPISODE_TRACE_SCALE);
    reinforceTrace(preferencesY, episodeTraceY, advantage * EPISODE_TRACE_SCALE);
    const visualAdvantage = Math.max(0, advantage);
    reinforceVisualTrace(visualPolicyX, episodeVisualTraceX, visualAdvantage * EPISODE_TRACE_SCALE);
    reinforceVisualTrace(visualPolicyY, episodeVisualTraceY, visualAdvantage * EPISODE_TRACE_SCALE);
    episodeScoreBaseline = lerp(episodeScoreBaseline, score, EPISODE_BASELINE_MIX);

    const bestBefore = topPerformances.length ? topPerformances[0].score : -Infinity;
    const candidate = {
      score, rings: episodeRingHits, shots,
      traceX: cloneTrace(episodeTraceX), traceY: cloneTrace(episodeTraceY),
      visualTraceX: cloneTrace(episodeVisualTraceX), visualTraceY: cloneTrace(episodeVisualTraceY)
    };
    if (score > 0) {
      topPerformances.push(candidate);
      topPerformances.sort((a, b) => b.score - a.score);
      topPerformances = topPerformances.slice(0, TOP_PERFORMANCE_COUNT);
    }

    if (score > 0 && score > bestBefore) {
      learnedVisualGain = clamp(learnedVisualGain + RECORD_STEERING_GAIN_BONUS, 0, MAX_LEARNED_VISUAL_GAIN);
      topPerformances.forEach((performance, index) => {
        const replayStrength = RECORD_TRACE_BONUS * (1 - index / TOP_PERFORMANCE_COUNT);
        reinforceTrace(preferencesX, performance.traceX, replayStrength);
        reinforceTrace(preferencesY, performance.traceY, replayStrength);
        reinforceVisualTrace(visualPolicyX, performance.visualTraceX, replayStrength);
        reinforceVisualTrace(visualPolicyY, performance.visualTraceY, replayStrength);
      });
    }
  }

  function updateLearningReadout() {
    const recentHits = ringHistory.slice(-MAX_RECENT_EPISODES);
    const recentRate = recentHits.length ? recentHits.reduce((sum, value) => sum + value, 0) / (recentHits.length * rings.length) : 0;
    const currentHits = rings.filter((ring) => ring.result === "hit").length;
    ui.learning.textContent = `Episode ${episode} · ${currentHits}/${rings.length} rings · recent ${(recentRate * 100).toFixed(0)}% · recurrent actor-critic · noise ${policyNoise().toFixed(2)} · value updates ${policyUpdates} · top memories ${topPerformances.length}.`;
  }

  function getGraphWindow() {
    const total = ringHistory.length;
    if (!total) return { axisStart: 0, axisEnd: 1, dataStart: 0, dataEnd: -1 };
    let axisStart = 0;
    let axisEnd = total;
    if (graphMode === "last10") axisStart = Math.max(0, total - 10);
    if (graphMode === "last25") axisStart = Math.max(0, total - 25);
    if (graphMode === "last50") axisStart = Math.max(0, total - 50);
    if (graphMode === "custom") {
      axisStart = clamp(Math.floor(customGraphStart), 0, Math.max(0, total - 1));
      axisEnd = clamp(Math.floor(customGraphEnd || total), axisStart + 1, total);
    }
    return { axisStart, axisEnd, dataStart: Math.max(0, axisStart - 1), dataEnd: Math.min(total - 1, axisEnd - 1) };
  }

  function applyGraphWindow() {
    graphMode = ui.graphWindow.value;
    if (graphMode === "custom") {
      customGraphStart = Math.max(0, Number.parseInt(ui.graphFrom.value, 10) || 0);
      customGraphEnd = Math.max(customGraphStart + 1, Number.parseInt(ui.graphTo.value, 10) || ringHistory.length || 1);
    }
    drawTrainingGraph();
  }

  function average(values) {
    return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
  }

  function updateGraphStats() {
    const latestRings = ringHistory.length ? ringHistory[ringHistory.length - 1] : 0;
    const latestShots = targetHistory.length ? targetHistory[targetHistory.length - 1] : 0;
    const firstRings = ringHistory.slice(0, MOVING_AVERAGE_WINDOW);
    const firstShots = targetHistory.slice(0, MOVING_AVERAGE_WINDOW);
    const recentRings = ringHistory.slice(-MOVING_AVERAGE_WINDOW);
    const recentShots = targetHistory.slice(-MOVING_AVERAGE_WINDOW);
    const recordRings = ringHistory.length ? Math.max(...ringHistory) : 0;
    const recordHits = recordRings > 0 ? ringHistory.filter((value) => value === recordRings).length : 0;
    const perfectShotEpisodes = targetHistory.filter((value) => value >= 2).length;
    if (ui.statRecordRings) ui.statRecordRings.textContent = String(recordRings);
    if (ui.statRecordHits) ui.statRecordHits.textContent = String(recordHits);
    if (ui.statPerfectShots) ui.statPerfectShots.textContent = String(perfectShotEpisodes);
    if (ui.statFirstRingsAverage) ui.statFirstRingsAverage.textContent = average(firstRings).toFixed(1);
    if (ui.statFirstShotsAverage) ui.statFirstShotsAverage.textContent = average(firstShots).toFixed(1);
    if (ui.statRingsAverage) ui.statRingsAverage.textContent = average(recentRings).toFixed(1);
    if (ui.statShotsAverage) ui.statShotsAverage.textContent = average(recentShots).toFixed(1);
    if (ui.statLatestRings) ui.statLatestRings.textContent = String(latestRings);
    if (ui.statLatestShots) ui.statLatestShots.textContent = String(latestShots);
  }

  function rollingAverageAt(values, episodeNumber) {
    const endIndex = episodeNumber - 1;
    return average(values.slice(Math.max(0, endIndex - MOVING_AVERAGE_WINDOW + 1), endIndex + 1));
  }

  function updateGraphProbe() {
    if (!ui.graphProbe) return;
    if (!ringHistory.length || graphProbeEpisode === null) {
      ui.graphProbe.textContent = "Hover over the graph or focus it and use the arrow keys to inspect an episode.";
      return;
    }
    const episodeNumber = clamp(graphProbeEpisode, 1, ringHistory.length);
    const rings = ringHistory[episodeNumber - 1] ?? 0;
    const shots = targetHistory[episodeNumber - 1] ?? 0;
    const ringAverage = rollingAverageAt(ringHistory, episodeNumber);
    const shotAverage = rollingAverageAt(targetHistory, episodeNumber);
    ui.graphProbe.textContent = `EPISODE ${episodeNumber} · RINGS ${rings}/10 · SHOTS ${shots}/2 · 10-EP AVG RINGS ${ringAverage.toFixed(1)} · SHOTS ${shotAverage.toFixed(1)}`;
  }

  function graphEpisodeAtClientX(clientX) {
    if (!ringHistory.length) return null;
    const rect = trainingCanvas.getBoundingClientRect();
    const cssWidth = Math.max(280, rect.width || 720);
    const plotWidth = cssWidth - GRAPH_PADDING.left - GRAPH_PADDING.right;
    const graphWindow = getGraphWindow();
    const axisSpan = Math.max(1, graphWindow.axisEnd - graphWindow.axisStart);
    const x = clamp(clientX - rect.left, GRAPH_PADDING.left, cssWidth - GRAPH_PADDING.right);
    const rawEpisode = graphWindow.axisStart + ((x - GRAPH_PADDING.left) / plotWidth) * axisSpan;
    const minEpisode = Math.max(1, graphWindow.axisStart);
    const maxEpisode = Math.min(ringHistory.length, graphWindow.axisEnd);
    return clamp(Math.round(rawEpisode), minEpisode, Math.max(minEpisode, maxEpisode));
  }

  function setGraphProbeEpisode(episodeNumber) {
    if (!ringHistory.length) return;
    const graphWindow = getGraphWindow();
    const minEpisode = Math.max(1, graphWindow.axisStart);
    const maxEpisode = Math.min(ringHistory.length, graphWindow.axisEnd);
    graphProbeEpisode = clamp(episodeNumber, minEpisode, Math.max(minEpisode, maxEpisode));
    drawTrainingGraph();
  }

  function drawTrainingGraph() {
    if (!trainingCanvas || !trainingCtx) return;
    const rect = trainingCanvas.getBoundingClientRect();
    const cssWidth = Math.max(280, rect.width || 720);
    const cssHeight = 190;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    trainingCanvas.width = Math.floor(cssWidth * ratio);
    trainingCanvas.height = Math.floor(cssHeight * ratio);
    trainingCtx.setTransform(ratio, 0, 0, ratio, 0, 0);
    trainingCtx.clearRect(0, 0, cssWidth, cssHeight);

    const padding = GRAPH_PADDING;
    const plotWidth = cssWidth - padding.left - padding.right;
    const plotHeight = cssHeight - padding.top - padding.bottom;
    const graphWindow = getGraphWindow();
    if (graphProbeEpisode !== null && ringHistory.length) {
      const minProbe = Math.max(1, graphWindow.axisStart);
      const maxProbe = Math.min(ringHistory.length, graphWindow.axisEnd);
      graphProbeEpisode = clamp(graphProbeEpisode, minProbe, Math.max(minProbe, maxProbe));
    }
    const axisSpan = Math.max(1, graphWindow.axisEnd - graphWindow.axisStart);
    const xForEpisode = (episodeNumber) => padding.left + ((episodeNumber - graphWindow.axisStart) / axisSpan) * plotWidth;
    const yFor = (value, max) => padding.top + plotHeight - clamp(value / max, 0, 1) * plotHeight;

    trainingCtx.fillStyle = "#030914";
    trainingCtx.fillRect(0, 0, cssWidth, cssHeight);
    trainingCtx.font = "10px Arial";
    trainingCtx.textBaseline = "middle";
    trainingCtx.lineWidth = 1;
    for (let tick = 0; tick <= 5; tick += 1) {
      const y = padding.top + plotHeight - (tick / 5) * plotHeight;
      trainingCtx.strokeStyle = "#1a334a";
      trainingCtx.beginPath();
      trainingCtx.moveTo(padding.left, y);
      trainingCtx.lineTo(cssWidth - padding.right, y);
      trainingCtx.stroke();
      trainingCtx.fillStyle = "#71869b";
      trainingCtx.textAlign = "right";
      trainingCtx.fillText(String(tick * 2), padding.left - 7, y);
      trainingCtx.textAlign = "left";
      trainingCtx.fillText(((tick / 5) * 2).toFixed(1).replace(".0", ""), cssWidth - padding.right + 7, y);
    }
    trainingCtx.fillStyle = "#71869b";
    trainingCtx.textAlign = "left";
    trainingCtx.fillText("RINGS", 5, 8);
    trainingCtx.textAlign = "right";
    trainingCtx.fillText("SHOTS", cssWidth - 5, 8);
    if (ringHistory.length) {
      trainingCtx.textAlign = "left";
      trainingCtx.fillText(`EP ${graphWindow.axisStart}`, padding.left, cssHeight - 9);
      trainingCtx.textAlign = "right";
      trainingCtx.fillText(`EP ${graphWindow.axisEnd}`, cssWidth - padding.right, cssHeight - 9);
    } else {
      trainingCtx.textAlign = "center";
      trainingCtx.fillStyle = "#71869b";
      trainingCtx.fillText("Run or fast-forward an episode to populate the graph", cssWidth * 0.5, padding.top + plotHeight * 0.5);
    }

    const visibleValues = (values) => values.slice(graphWindow.dataStart, graphWindow.dataEnd + 1);
    const drawSeries = (values, max, color) => {
      if (!values.length) return;
      const visible = visibleValues(values);
      trainingCtx.strokeStyle = color;
      trainingCtx.fillStyle = color;
      trainingCtx.lineWidth = 2;
      trainingCtx.beginPath();
      visible.forEach((value, index) => {
        const x = xForEpisode(graphWindow.dataStart + index + 1);
        const y = yFor(value, max);
        if (index === 0) trainingCtx.moveTo(x, y); else trainingCtx.lineTo(x, y);
      });
      trainingCtx.stroke();
      visible.forEach((value, index) => {
        trainingCtx.beginPath();
        trainingCtx.arc(xForEpisode(graphWindow.dataStart + index + 1), yFor(value, max), 2.5, 0, Math.PI * 2);
        trainingCtx.fill();
      });
    };
    const drawMovingAverage = (values, max, color) => {
      if (values.length < 2) return;
      trainingCtx.strokeStyle = color;
      trainingCtx.lineWidth = 2;
      trainingCtx.setLineDash([5, 4]);
      trainingCtx.beginPath();
      visibleValues(values).forEach((value, index) => {
        const endIndex = graphWindow.dataStart + index;
        const startIndex = Math.max(0, endIndex - MOVING_AVERAGE_WINDOW + 1);
        const samples = values.slice(startIndex, endIndex + 1);
        const average = samples.reduce((sum, sample) => sum + sample, 0) / samples.length;
        const x = xForEpisode(endIndex + 1);
        const y = yFor(average, max);
        if (index === 0) trainingCtx.moveTo(x, y); else trainingCtx.lineTo(x, y);
      });
      trainingCtx.stroke();
      trainingCtx.setLineDash([]);
    };
    if (graphVisibility.ringAverage) drawMovingAverage(ringHistory, 10, "#b4f3ca");
    if (graphVisibility.shotAverage) drawMovingAverage(targetHistory, 2, "#ffd27b");
    if (graphVisibility.rings) drawSeries(ringHistory, 10, "#58d68d");
    if (graphVisibility.shots) drawSeries(targetHistory, 2, "#f1ad45");
    if (graphProbeEpisode !== null && ringHistory.length) {
      const probeEpisode = clamp(graphProbeEpisode, Math.max(1, graphWindow.axisStart), Math.min(ringHistory.length, graphWindow.axisEnd));
      const probeX = xForEpisode(probeEpisode);
      trainingCtx.save();
      trainingCtx.strokeStyle = "#eaf4ff";
      trainingCtx.lineWidth = 1;
      trainingCtx.setLineDash([3, 3]);
      trainingCtx.beginPath();
      trainingCtx.moveTo(probeX, padding.top);
      trainingCtx.lineTo(probeX, cssHeight - padding.bottom);
      trainingCtx.stroke();
      trainingCtx.restore();
    }
    if (ui.graphSummary) {
      const lastRings = ringHistory.length ? ringHistory[ringHistory.length - 1] : 0;
      const lastShots = targetHistory.length ? targetHistory[targetHistory.length - 1] : 0;
      ui.graphSummary.textContent = ringHistory.length ? `${ringHistory.length} EPISODES · LAST ${lastRings}/10 RINGS · ${lastShots}/2 SHOTS` : "NO COMPLETED EPISODES";
    }
    updateGraphStats();
    updateGraphProbe();
  }

  function applyMovementReward(rewardX, rewardY, color = null) {
    const reward = (rewardX + rewardY) * 0.5;
    policyRewardAccumulator += reward;
    lastReward = reward;
    rewardFlash = reward > 0 ? 0.65 : -0.55;
    rewardColor = color || (reward > 0 ? COLORS.green : COLORS.red);
    neural.dopamine = reward > 0 ? reward : 0;
    updateLearningReadout();
  }

  function applyFireReward(reward, color = null) {
    policyRewardAccumulator += reward;
    fireRewardAccumulator += reward;
    const delta = reward - fireBaseline;
    fireBaseline = lerp(fireBaseline, reward, BASELINE_MIX);
    firePreference = clamp(firePreference + LEARNING_RATE * delta * fireEligibility, -1, 1);
    lastReward = reward;
    rewardFlash = reward > 0 ? 0.65 : -0.55;
    rewardColor = color || (reward > 0 ? COLORS.green : COLORS.red);
    neural.dopamine = reward > 0 ? reward : 0;
    updateLearningReadout();
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
          applyFireReward(TARGET_REWARD, COLORS.amber);
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
      const horizontalError = Math.abs(player.x - ring.x);
      const verticalError = Math.abs(player.y - ring.y);
      const success = Math.hypot(horizontalError, verticalError) <= RING_RADIUS - RING_CLEARANCE;
      ring.result = success ? "hit" : "miss";
      if (success) episodeRingHits += 1;
      const radius = RING_RADIUS - RING_CLEARANCE;
      const xQuality = 1 - clamp(horizontalError / radius, 0, 1);
      const yQuality = 1 - clamp(verticalError / radius, 0, 1);
      const rewardX = success ? RING_SUCCESS_REWARD * (0.75 + xQuality * 0.25) : xQuality > 0 ? xQuality * 0.18 : RING_MISS_REWARD;
      const rewardY = success ? RING_SUCCESS_REWARD * (0.75 + yQuality * 0.25) : yQuality > 0 ? yQuality * 0.18 : RING_MISS_REWARD;
      applyMovementReward(rewardX, rewardY, success ? ring.color : COLORS.red);
      nextRingIndex += 1;
      retinalTrackX = null;
      retinalTrackY = null;
    }
    for (const target of targets) {
      if (!target.hit && !target.missed && player.z > target.z + 75) {
        target.missed = true;
        if (target === targets[nextTargetIndex]) {
          applyFireReward(TARGET_MISS_REWARD, COLORS.red);
          nextTargetIndex += 1;
        }
      }
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
    const wasEvaluation = evaluationMode;
    const wasOracle = oracleMode;
    running = false;
    finishPolicyEpisode();
    evaluationMode = false;
    oracleMode = false;
    if (!wasEvaluation) recordEpisodeStats();
    syncUI();
    ui.card.hidden = false;
    ui.status.textContent = "COMPLETE";
    ui.message.textContent = wasEvaluation ? `${wasOracle ? "ORACLE BENCHMARK" : "GREEDY EVALUATION"} · ${episodeRingHits}/10 RINGS · ${targets.filter((target) => target.hit).length}/2 SHOTS` : "EPISODE COMPLETE";
    if (wasEvaluation) ui.learning.textContent = `${wasOracle ? "Oracle benchmark uses known world geometry; it does not train." : "Greedy evaluation uses the learned policy; it does not train."} Result: ${episodeRingHits}/${rings.length} rings · ${targets.filter((target) => target.hit).length}/${targets.length} shots.`;
    ui.start.textContent = "Run next episode";
  }

  function recordEpisodeStats() {
    if (episodeRecorded) return;
    episodeRecorded = true;
    ringHistory.push(episodeRingHits);
    targetHistory.push(targets.filter((target) => target.hit).length);
    if (ringHistory.length > MAX_STORED_EPISODES) ringHistory.shift();
    if (targetHistory.length > MAX_STORED_EPISODES) targetHistory.shift();
    drawTrainingGraph();
    updateLearningReadout();
  }

  function fastForwardEpisodes(count) {
    if (running || fastForwarding) return;
    fastForwarding = true;
    [ui.start, ui.run, ui.resetLearning, ui.evaluate, ui.oracle, ui.skip5, ui.skip10, ui.skip25, ui.skip50, ui.skip100, ui.courseMode].forEach((button) => { button.disabled = true; });
    ui.card.hidden = false;
    ui.status.textContent = "SIMULATING";
    ui.message.textContent = `FAST-FORWARD ×${count}`;

    fastForwardState = {
      count,
      completed: 0,
      frames: 0,
      maxFrames: Math.ceil(COURSE_LENGTH / SPEED / FAST_FORWARD_DT) + 5
    };
    window.setTimeout(runFastForwardChunk, 0);
  }

  function runFastForwardChunk() {
    const state = fastForwardState;
    if (!state) return;
    if (!running && state.frames === 0) {
      episode += 1;
      resetEpisode(false);
      running = true;
    }
    let framesThisChunk = 0;
    try {
      while (running && state.frames < state.maxFrames && framesThisChunk < FAST_FORWARD_CHUNK) {
        drawGame();
        step(FAST_FORWARD_DT);
        state.frames += 1;
        framesThisChunk += 1;
      }
    } catch (error) {
      running = false;
      fastForwarding = false;
      fastForwardState = null;
    [ui.start, ui.run, ui.resetLearning, ui.evaluate, ui.oracle, ui.skip5, ui.skip10, ui.skip25, ui.skip50, ui.skip100, ui.courseMode].forEach((button) => { button.disabled = false; });
      console.error(error);
      syncUI();
      ui.status.textContent = "ERROR";
      ui.message.textContent = `TRAINING ERROR: ${error.message}`;
      return;
    }
    if (running && state.frames < state.maxFrames) {
      window.setTimeout(runFastForwardChunk, 0);
      return;
    }
    if (running) {
      running = false;
      recordEpisodeStats();
    }
    state.completed += 1;
    ui.message.textContent = `SIMULATED ${state.completed}/${state.count}`;
    if (state.completed < state.count) {
      state.frames = 0;
      window.setTimeout(runFastForwardChunk, 0);
      return;
    }
    running = false;
    resetEpisode();
    ui.status.textContent = "READY";
    ui.message.textContent = `READY AFTER ${state.count} SIMULATIONS`;
    ui.start.textContent = "Run next episode";
    [ui.start, ui.run, ui.resetLearning, ui.evaluate, ui.skip5, ui.skip10, ui.skip25, ui.skip50, ui.skip100, ui.courseMode].forEach((button) => { button.disabled = false; });
    fastForwarding = false;
    fastForwardState = null;
    syncUI();
    drawGame();
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
    ui.evaluate.disabled = running || fastForwarding;
    ui.oracle.disabled = running || fastForwarding;
    setBar(ui.visualLeft, neural.visualLeft); setBar(ui.visualRight, neural.visualRight);
    setBar(ui.visualUp, neural.visualUp); setBar(ui.visualDown, neural.visualDown);
    setBar(ui.motorLeft, neural.motorLeft); setBar(ui.motorRight, neural.motorRight);
    setBar(ui.motorUp, neural.motorUp); setBar(ui.motorDown, neural.motorDown);
    setBar(ui.spontaneous, Math.max(Math.abs(neural.spontaneousX), Math.abs(neural.spontaneousY)));
    setBar(ui.frontLimb, neural.frontLimb); setBar(ui.dopamine, neural.dopamine);
    syncCourseModeUI();
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
    three.brain.rotation.order = "YXZ";
    three.brain.position.y = 0.02;

    // The shell is the low-poly JRC2018U adult Drosophila atlas surface.
    // Activity markers below are deliberately kept as a small, readable overlay:
    // they are pathway labels, not a claim that these exact coordinates are firing.
    loadBrainAtlas();

    const nodeSpecs = [
      ["visualLeft", 0x42c7ef, [-0.72, 0.02, 0.02]], ["visualRight", 0x42c7ef, [0.72, 0.02, 0.02]],
      ["visualUp", 0x42c7ef, [-0.46, 0.19, 0.32]], ["visualDown", 0x42c7ef, [0.46, 0.06, -0.23]],
      ["motorLeft", 0xf2aa45, [-0.31, -0.08, -0.08]], ["motorRight", 0xf2aa45, [0.31, -0.08, -0.08]],
      ["motorUp", 0xf2aa45, [-0.13, 0.12, 0.18]], ["motorDown", 0xf2aa45, [0.13, -0.16, -0.27]],
      ["frontLimb", 0xb08bf0, [0, -0.35, -0.1]], ["dopamine", 0x64df90, [0, 0.2, 0.38]]
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

  function loadBrainAtlas() {
    if (!THREE.PLYLoader) return;
    const loader = new THREE.PLYLoader();
    loader.load("assets/brain/JRC2018U.ply", (geometry) => {
      geometry.computeVertexNormals();
      geometry.center();
      const size = geometry.boundingBox ? geometry.boundingBox.getSize(new THREE.Vector3()) : new THREE.Vector3(1, 1, 1);
      const longestAxis = Math.max(size.x, size.y, size.z) || 1;
      geometry.scale(1.62 / longestAxis, 1.62 / longestAxis, 1.62 / longestAxis);
      const surfaceMaterial = new THREE.MeshStandardMaterial({
        color: 0x7894aa, roughness: 0.92, metalness: 0, transparent: true, opacity: 0.34,
        side: THREE.DoubleSide, depthWrite: false, flatShading: true
      });
      const wireMaterial = new THREE.MeshBasicMaterial({
        color: 0xb4d1df, transparent: true, opacity: 0.34, wireframe: true,
        depthTest: false
      });
      const atlas = new THREE.Group();
      atlas.name = "JRC2018U atlas surface";
      atlas.add(new THREE.Mesh(geometry, surfaceMaterial));
      const wire = new THREE.Mesh(geometry, wireMaterial);
      wire.renderOrder = 2;
      atlas.add(wire);
      atlas.rotation.set(THREE.MathUtils.degToRad(-8), THREE.MathUtils.degToRad(4), 0);
      three.brainAtlas = atlas;
      three.brain.add(atlas);
    }, undefined, () => {
      three.brainAtlas = null;
    });
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

  function startEpisode(mode = "train") {
    if (running || fastForwarding) return;
    evaluationMode = mode !== "train";
    oracleMode = mode === "oracle";
    episode += 1;
    resetEpisode();
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

  window.addEventListener("resize", () => { resizeGame(); resizeThree(); drawGame(); updateThree(); drawTrainingGraph(); });
  ui.start.addEventListener("click", () => startEpisode("train"));
  ui.run.addEventListener("click", () => startEpisode("train"));
  ui.resetLearning.addEventListener("click", resetLearning);
  ui.evaluate.addEventListener("click", () => startEpisode("greedy"));
  ui.oracle.addEventListener("click", () => startEpisode("oracle"));
  ui.courseMode.addEventListener("change", () => {
    if (running || fastForwarding) {
      syncCourseModeUI();
      return;
    }
    courseMode = ui.courseMode.value;
    resetEpisode();
    syncCourseModeUI();
  });
  ui.skip5.addEventListener("click", () => fastForwardEpisodes(5));
  ui.skip10.addEventListener("click", () => fastForwardEpisodes(10));
  ui.skip25.addEventListener("click", () => fastForwardEpisodes(25));
  ui.skip50.addEventListener("click", () => fastForwardEpisodes(50));
  ui.skip100.addEventListener("click", () => fastForwardEpisodes(100));
  ui.graphWindow.addEventListener("change", applyGraphWindow);
  ui.graphApply.addEventListener("click", applyGraphWindow);
  trainingCanvas.addEventListener("pointermove", (event) => {
    const episodeAtPointer = graphEpisodeAtClientX(event.clientX);
    if (episodeAtPointer !== null) setGraphProbeEpisode(episodeAtPointer);
  });
  trainingCanvas.addEventListener("keydown", (event) => {
    if (!ringHistory.length) return;
    const graphWindow = getGraphWindow();
    const minEpisode = Math.max(1, graphWindow.axisStart);
    const maxEpisode = Math.min(ringHistory.length, graphWindow.axisEnd);
    const currentEpisode = graphProbeEpisode ?? minEpisode;
    if (event.key === "ArrowLeft") { event.preventDefault(); setGraphProbeEpisode(currentEpisode - 1); }
    if (event.key === "ArrowRight") { event.preventDefault(); setGraphProbeEpisode(currentEpisode + 1); }
    if (event.key === "Home") { event.preventDefault(); setGraphProbeEpisode(minEpisode); }
    if (event.key === "End") { event.preventDefault(); setGraphProbeEpisode(maxEpisode); }
  });
  [["rings", ui.graphShowRings], ["ringAverage", ui.graphShowRingAverage], ["shots", ui.graphShowShots], ["shotAverage", ui.graphShowShotAverage]].forEach(([key, element]) => {
    element.addEventListener("change", () => {
      graphVisibility[key] = element.checked;
      drawTrainingGraph();
    });
  });

  resizeGame();
  resetEpisode();
  drawGame();
  syncUI();
  drawTrainingGraph();
  loadThree();
})();
