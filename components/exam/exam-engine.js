import { EXAM_QUESTIONS } from "./questions.js";

const START_DELAY_MS = 10000;
const DETECTION_WARMUP_MS = 900;
const HISTORY_LIMIT = 24;
const NOD_RANGE_MIN = 0.012;
const SHAKE_RANGE_MIN = 0.014;
const AXIS_DOMINANCE = 1.12;
const SIGN_CHANGE_EPSILON = 0.0008;
const MIN_DIRECTION_CHANGES = 2;
const DEBUG_STATUS_THROTTLE_MS = 220;

const ui = {
  app: document.getElementById("examApp"),
  startButton: document.getElementById("startExamBtn"),
  stageIdle: document.getElementById("stageIdle"),
  stageActive: document.getElementById("stageActive"),
  stageResult: document.getElementById("stageResult"),
  statusText: document.getElementById("statusText"),
  instructionText: document.getElementById("instructionText"),
  questionCounter: document.getElementById("questionCounter"),
  questionText: document.getElementById("questionText"),
  selectedAnswer: document.getElementById("selectedAnswer"),
  video: document.getElementById("cameraVideo"),
  canvas: document.getElementById("cameraCanvas"),
  resultTotal: document.getElementById("resultTotal"),
  resultCorrect: document.getElementById("resultCorrect"),
  resultScore: document.getElementById("resultScore")
};

const state = {
  currentIndex: -1,
  answers: [],
  examStarted: false,
  listeningForGesture: false,
  questionLocked: false,
  openCvReady: false,
  mediaPipeReady: false,
  blockInput: false,
  noseHistory: [],
  listeningSince: 0,
  faceMesh: null,
  camera: null,
  cvCapture: null,
  cvMat: null,
  cvLoopHandle: 0,
  lastFaceAt: 0,
  lastDebugAt: 0,
  cvEnabled: false,
  selectedVoice: null,
  speechReady: false
};

function setStatus(text) {
  ui.statusText.textContent = text;
}

function setInstruction(text) {
  ui.instructionText.textContent = text;
}

function persistExamResult(total, correct) {
  try {
    const existing = JSON.parse(localStorage.getItem("examHistory") || "[]");
    const scorePercent = total > 0 ? Math.round((correct / total) * 100) : 0;
    const result = {
      id: `exam-${Date.now()}`,
      title: "Hands-Free Inclusive Exam",
      subject: "General Aptitude",
      total,
      correct,
      scorePercent,
      createdAt: new Date().toISOString()
    };
    existing.unshift(result);
    localStorage.setItem("examHistory", JSON.stringify(existing.slice(0, 120)));
  } catch (_err) {
    // ignore localStorage write issues
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function unlockSpeechFromGesture() {
  if (!("speechSynthesis" in window)) {
    return;
  }

  const unlock = () => {
    try {
      window.speechSynthesis.resume();
    } catch (_err) {
      // ignore browser-specific resume errors
    }
  };

  ["click", "touchstart", "keydown"].forEach((eventName) => {
    document.body.addEventListener(eventName, unlock, { passive: true });
  });
}

function pickPreferredVoice() {
  if (!("speechSynthesis" in window)) {
    return null;
  }
  const voices = window.speechSynthesis.getVoices();
  if (!voices || !voices.length) {
    return null;
  }
  return (
    voices.find((v) => /^en(-|_)?/i.test(v.lang || "") && /female|google|samantha|zira|aria/i.test(v.name || "")) ||
    voices.find((v) => /^en(-|_)?/i.test(v.lang || "")) ||
    voices[0]
  );
}

async function ensureSpeechReady() {
  if (!("speechSynthesis" in window) || !("SpeechSynthesisUtterance" in window)) {
    return false;
  }

  if (state.speechReady && state.selectedVoice) {
    return true;
  }

  state.selectedVoice = pickPreferredVoice();
  if (state.selectedVoice) {
    state.speechReady = true;
    return true;
  }

  await new Promise((resolve) => {
    let resolved = false;
    const timeout = setTimeout(() => {
      if (resolved) return;
      resolved = true;
      resolve();
    }, 2500);

    const onVoices = () => {
      if (resolved) return;
      state.selectedVoice = pickPreferredVoice();
      if (state.selectedVoice) {
        resolved = true;
        clearTimeout(timeout);
        window.speechSynthesis.removeEventListener("voiceschanged", onVoices);
        resolve();
      }
    };

    window.speechSynthesis.addEventListener("voiceschanged", onVoices);
    onVoices();
  });

  state.speechReady = Boolean(state.selectedVoice);
  return state.speechReady;
}

function speak(text, interrupt = true) {
  return new Promise(async (resolve) => {
    const ready = await ensureSpeechReady();
    if (!ready) {
      resolve();
      return;
    }

    try {
      window.speechSynthesis.resume();
    } catch (_err) {
      // ignore resume issues
    }

    if (interrupt) {
      window.speechSynthesis.cancel();
    }

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = state.selectedVoice?.lang || "en-US";
    if (state.selectedVoice) {
      utterance.voice = state.selectedVoice;
    }
    utterance.rate = 1;
    utterance.pitch = 1;
    utterance.volume = 1;

    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      resolve();
    };

    utterance.onend = finish;
    utterance.onerror = finish;

    const timeout = setTimeout(finish, 10000);
    const originalFinish = finish;
    const wrappedFinish = () => {
      clearTimeout(timeout);
      originalFinish();
    };
    utterance.onend = wrappedFinish;
    utterance.onerror = wrappedFinish;

    window.speechSynthesis.speak(utterance);
  });
}

function installInputBlockers() {
  const blocker = (event) => {
    if (!state.blockInput) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
  };

  ["keydown", "mousedown", "mouseup", "touchstart", "touchmove", "touchend", "click", "contextmenu"].forEach((type) => {
    document.addEventListener(type, blocker, { capture: true, passive: false });
  });
}

async function waitForOpenCv() {
  if (window.cv && window.cv.Mat) {
    state.openCvReady = true;
    state.cvEnabled = true;
    return;
  }

  await new Promise((resolve) => {
    let done = false;
    const timeout = setTimeout(() => {
      if (!done) {
        done = true;
        resolve();
      }
    }, 3000);

    const check = () => {
      if (window.cv && window.cv.Mat) {
        done = true;
        clearTimeout(timeout);
        state.cvEnabled = true;
        resolve();
      } else {
        setTimeout(check, 100);
      }
    };

    check();
  });

  state.openCvReady = Boolean(window.cv && window.cv.Mat);
}

async function ensureMediaPipeLoaded() {
  if (window.FaceMesh && window.Camera) {
    state.mediaPipeReady = true;
    return;
  }

  const startedAt = Date.now();
  while (!(window.FaceMesh && window.Camera)) {
    if (Date.now() - startedAt > 15000) {
      throw new Error("MediaPipe initialization timed out.");
    }
    await sleep(100);
  }

  state.mediaPipeReady = true;
}

function startOpenCvRenderLoop() {
  if (!state.openCvReady || !state.cvEnabled) {
    return;
  }

  const width = ui.video.videoWidth || 640;
  const height = ui.video.videoHeight || 480;
  ui.canvas.width = width;
  ui.canvas.height = height;

  state.cvCapture = new window.cv.VideoCapture(ui.video);
  state.cvMat = new window.cv.Mat(height, width, window.cv.CV_8UC4);

  const tick = () => {
    if (!state.examStarted || !state.cvCapture || !state.cvMat) {
      return;
    }

    try {
      state.cvCapture.read(state.cvMat);
      window.cv.imshow(ui.canvas, state.cvMat);
    } catch (_err) {
      // ignore occasional read/render frame errors
    }

    state.cvLoopHandle = requestAnimationFrame(tick);
  };

  tick();
}

function resetNoseHistory() {
  state.noseHistory = [];
  state.listeningSince = Date.now();
  state.lastDebugAt = 0;
}

function countDirectionChanges(values, epsilon) {
  let changes = 0;
  let prevSign = 0;
  for (let i = 1; i < values.length; i += 1) {
    const delta = values[i] - values[i - 1];
    let sign = 0;
    if (delta > epsilon) sign = 1;
    if (delta < -epsilon) sign = -1;
    if (sign !== 0 && prevSign !== 0 && sign !== prevSign) {
      changes += 1;
    }
    if (sign !== 0) {
      prevSign = sign;
    }
  }
  return changes;
}

function getMotionMetrics() {
  if (state.noseHistory.length < 10) {
    return null;
  }
  const xs = state.noseHistory.map((p) => p.x);
  const ys = state.noseHistory.map((p) => p.y);
  const xRange = Math.max(...xs) - Math.min(...xs);
  const yRange = Math.max(...ys) - Math.min(...ys);
  const xChanges = countDirectionChanges(xs, SIGN_CHANGE_EPSILON);
  const yChanges = countDirectionChanges(ys, SIGN_CHANGE_EPSILON);
  return { xRange, yRange, xChanges, yChanges };
}

function detectGestureFromHistory() {
  if (!state.listeningForGesture || state.questionLocked) {
    return null;
  }

  if (Date.now() - state.listeningSince < DETECTION_WARMUP_MS) {
    return null;
  }

  const metrics = getMotionMetrics();
  if (!metrics) {
    return null;
  }
  const { xRange, yRange, xChanges, yChanges } = metrics;

  if (
    yRange >= NOD_RANGE_MIN &&
    yChanges >= MIN_DIRECTION_CHANGES &&
    yRange > xRange * AXIS_DOMINANCE
  ) {
    return "YES";
  }

  if (
    xRange >= SHAKE_RANGE_MIN &&
    xChanges >= MIN_DIRECTION_CHANGES &&
    xRange > yRange * AXIS_DOMINANCE
  ) {
    return "NO";
  }

  return null;
}

function onFaceResults(results) {
  if (!results.multiFaceLandmarks || !results.multiFaceLandmarks.length) {
    if (state.listeningForGesture && !state.questionLocked) {
      setStatus("Face not detected. Keep your face centered and well-lit.");
    }
    return;
  }

  const nose = results.multiFaceLandmarks[0][1];
  if (!nose) {
    return;
  }

  state.lastFaceAt = Date.now();
  state.noseHistory.push({ x: nose.x, y: nose.y, t: performance.now() });
  if (state.noseHistory.length > HISTORY_LIMIT) {
    state.noseHistory.shift();
  }

  if (state.listeningForGesture && !state.questionLocked) {
    const now = Date.now();
    if (now - state.lastDebugAt > DEBUG_STATUS_THROTTLE_MS) {
      const metrics = getMotionMetrics();
      if (metrics) {
        setStatus(
          `Listening... movement x:${metrics.xRange.toFixed(3)} y:${metrics.yRange.toFixed(3)}`
        );
      }
      state.lastDebugAt = now;
    }
  }

  const gesture = detectGestureFromHistory();
  if (gesture) {
    onAnswerDetected(gesture);
  }
}

async function initCameraAndDetection() {
  await ensureMediaPipeLoaded();
  await waitForOpenCv();

  const stream = await navigator.mediaDevices.getUserMedia({
    video: {
      width: { ideal: 960 },
      height: { ideal: 540 },
      facingMode: "user"
    },
    audio: false
  });

  ui.video.srcObject = stream;
  await ui.video.play();

  state.faceMesh = new window.FaceMesh({
    locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`
  });

  state.faceMesh.setOptions({
    maxNumFaces: 1,
    refineLandmarks: false,
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5
  });

  state.faceMesh.onResults(onFaceResults);

  state.camera = new window.Camera(ui.video, {
    onFrame: async () => {
      if (state.faceMesh) {
        await state.faceMesh.send({ image: ui.video });
      }
    },
    width: 960,
    height: 540
  });

  await state.camera.start();
  startOpenCvRenderLoop();
}

function showActiveUI() {
  ui.stageIdle.hidden = true;
  ui.stageResult.hidden = true;
  ui.stageActive.hidden = false;
}

function showResultUI(total, correct) {
  ui.stageActive.hidden = true;
  ui.stageIdle.hidden = true;
  ui.stageResult.hidden = false;

  ui.resultTotal.textContent = String(total);
  ui.resultCorrect.textContent = String(correct);
  ui.resultScore.textContent = `${correct} / ${total}`;
}

async function askQuestion(index) {
  const question = EXAM_QUESTIONS[index];
  state.currentIndex = index;
  state.questionLocked = false;
  state.listeningForGesture = false;
  resetNoseHistory();

  ui.questionCounter.textContent = `Question ${index + 1} of ${EXAM_QUESTIONS.length}`;
  ui.questionText.textContent = question.text;
  ui.selectedAnswer.textContent = "Waiting for your head gesture...";

  // Start listening immediately so head movement during spoken prompt is captured.
  state.listeningForGesture = true;
  state.listeningSince = Date.now();

  setStatus("Listening for gesture answer...");
  setInstruction("Nod your head = YES. Shake your head = NO.");

  speak(
    `Question ${index + 1}. ${question.text}. If your answer is YES, nod your head. If your answer is NO, shake your head.`
  );
}

function onAnswerDetected(answer) {
  if (!state.examStarted || state.questionLocked || !state.listeningForGesture) {
    return;
  }

  state.questionLocked = true;
  state.listeningForGesture = false;

  const question = EXAM_QUESTIONS[state.currentIndex];
  state.answers.push({
    questionId: question.id,
    selected: answer,
    correct: question.correct
  });

  ui.selectedAnswer.textContent = `Locked answer: ${answer}`;
  setStatus("Answer locked. Loading next question...");

  runNextStep();
}

async function runNextStep() {
  await sleep(START_DELAY_MS);

  const next = state.currentIndex + 1;
  if (next < EXAM_QUESTIONS.length) {
    askQuestion(next);
    return;
  }

  finishExam();
}

async function finishExam() {
  state.examStarted = false;
  state.listeningForGesture = false;
  state.blockInput = false;

  const total = EXAM_QUESTIONS.length;
  const correct = state.answers.filter((a) => a.selected === a.correct).length;

  persistExamResult(total, correct);

  showResultUI(total, correct);
  setStatus("Exam completed.");
  setInstruction("Result announced.");

  await speak(`Exam completed. You scored ${correct} out of ${total}.`);
}

async function startExamFlow() {
  try {
    ui.startButton.disabled = true;
    setStatus("Initializing camera and detection...");

    await ensureSpeechReady();
    try {
      window.speechSynthesis.resume();
    } catch (_err) {
      // ignore browser-specific resume errors
    }

    await initCameraAndDetection();

    state.examStarted = true;
    state.blockInput = true;
    state.answers = [];
    state.currentIndex = -1;

    showActiveUI();
    await speak("Exam started. Voice instructions are enabled.");
    await askQuestion(0);
  } catch (error) {
    state.examStarted = false;
    state.blockInput = false;
    ui.startButton.disabled = false;
    setStatus(`Unable to start exam: ${error.message || "Unknown error"}`);
    setInstruction("Please allow camera access and reload the page.");
  }
}

function init() {
  installInputBlockers();
  unlockSpeechFromGesture();

  ui.startButton.addEventListener("click", () => {
    if (!state.examStarted) {
      startExamFlow();
    }
  });

  setStatus("Press Start Exam to begin.");
  setInstruction("Hands-free mode activates after exam start.");
}

init();
