import { APP_DATA } from "./data.js";

const STORAGE_KEY = "dyslexia.platform.progress.v1";

const state = {
  view: "home",
  selectedSubjectId: APP_DATA.subjects[0].id,
  selectedChapterId: APP_DATA.subjects[0].chapters[0].id,
  readerChunkIndex: 0,
  currentWordSpans: [],
  currentPlainWords: [],
  speaking: false,
  utterance: null,
  readerSessionStartedAt: 0,
  practiceIndex: 0,
  practiceAnswers: [],
  chartRefs: [],
  focusMode: false,
  progress: loadProgress()
};

const el = {
  navButtons: document.querySelectorAll("[data-nav]"),
  pages: document.querySelectorAll("[data-page]"),
  focusToggle: document.getElementById("focusToggle"),
  dyslexicFontToggle: document.getElementById("dyslexicFontToggle"),
  fontSlider: document.getElementById("fontSlider"),
  lineSlider: document.getElementById("lineSlider"),
  bgSelector: document.getElementById("bgSelector"),
  homeCards: document.getElementById("homeCards"),
  previewStats: document.getElementById("previewStats"),
  subjectsList: document.getElementById("subjectsList"),
  chapterList: document.getElementById("chapterList"),
  readerTitle: document.getElementById("readerTitle"),
  chapterSummary: document.getElementById("chapterSummary"),
  chapterConcepts: document.getElementById("chapterConcepts"),
  chapterDiagram: document.getElementById("chapterDiagram"),
  chapterVideo: document.getElementById("chapterVideo"),
  chunkText: document.getElementById("chunkText"),
  chunkCounter: document.getElementById("chunkCounter"),
  prevChunkBtn: document.getElementById("prevChunkBtn"),
  nextChunkBtn: document.getElementById("nextChunkBtn"),
  readChunkBtn: document.getElementById("readChunkBtn"),
  stopReadBtn: document.getElementById("stopReadBtn"),
  glossaryInline: document.getElementById("glossaryInline"),
  startPracticeBtn: document.getElementById("startPracticeBtn"),
  practiceWrap: document.getElementById("practiceWrap"),
  practiceVoiceBtn: document.getElementById("practiceVoiceBtn"),
  dashboardStats: document.getElementById("dashboardStats"),
  weakTopics: document.getElementById("weakTopics"),
  rewardsStrip: document.getElementById("rewardsStrip")
};

function loadProgress() {
  const fallback = {
    completedChapters: [],
    quizScores: {},
    readingSecondsBySubject: {},
    chapterAttempts: {},
    achievements: []
  };
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || JSON.stringify(fallback));
  } catch (_err) {
    return fallback;
  }
}

function saveProgress() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.progress));
}

function getSubjectById(id) {
  return APP_DATA.subjects.find((s) => s.id === id) || APP_DATA.subjects[0];
}

function getSelectedChapter() {
  const subject = getSubjectById(state.selectedSubjectId);
  return subject.chapters.find((c) => c.id === state.selectedChapterId) || subject.chapters[0];
}

function getChapterChunks(text) {
  const sentences = text
    .split(/(?<=[.!?])\s+/)
    .map((x) => x.trim())
    .filter(Boolean);
  const chunks = [];
  for (let i = 0; i < sentences.length; i += 2) {
    chunks.push(sentences.slice(i, i + 2).join(" "));
  }
  return chunks.length ? chunks : [text];
}

function markAchievement(title) {
  if (!state.progress.achievements.includes(title)) {
    state.progress.achievements.push(title);
    saveProgress();
  }
}

function stopSpeech() {
  if (state.utterance) {
    window.speechSynthesis.cancel();
    state.utterance = null;
  }
  state.speaking = false;
}

function applyReaderStyles() {
  const size = Number(el.fontSlider.value);
  const line = Number(el.lineSlider.value);
  const bg = el.bgSelector.value;
  document.documentElement.style.setProperty("--reader-size", `${size}px`);
  document.documentElement.style.setProperty("--reader-line", String(line));
  document.documentElement.style.setProperty("--reader-bg", bg);
}

function renderGlossaryText(chunk, glossary) {
  const tokens = chunk.split(/(\s+)/);
  const frag = document.createDocumentFragment();
  state.currentWordSpans = [];
  state.currentPlainWords = chunk.split(/\s+/).filter(Boolean);

  tokens.forEach((token) => {
    if (/^\s+$/.test(token)) {
      frag.appendChild(document.createTextNode(token));
      return;
    }
    const pure = token.toLowerCase().replace(/[^a-z]/g, "");
    const entry = glossary[pure];
    const span = document.createElement("span");
    span.textContent = token;
    span.className = "reader-word";
    state.currentWordSpans.push(span);
    if (entry) {
      span.classList.add("difficult-word");
      span.dataset.word = pure;
    }
    frag.appendChild(span);
  });

  el.chunkText.innerHTML = "";
  el.chunkText.appendChild(frag);
}

function highlightWordByCharIndex(charIndex) {
  if (!state.currentWordSpans.length || !state.currentPlainWords.length) return;
  let acc = 0;
  let found = 0;
  for (let i = 0; i < state.currentPlainWords.length; i += 1) {
    const wlen = state.currentPlainWords[i].length;
    if (charIndex <= acc + wlen) {
      found = i;
      break;
    }
    acc += wlen + 1;
    found = i;
  }
  state.currentWordSpans.forEach((w, idx) => {
    w.classList.toggle("active-word", idx === found);
  });
}

function speakText(text) {
  if (!("speechSynthesis" in window)) return;
  stopSpeech();
  const utt = new SpeechSynthesisUtterance(text);
  utt.rate = 0.9;
  utt.pitch = 1;
  utt.volume = 1;
  utt.onboundary = (event) => {
    if (typeof event.charIndex === "number") {
      highlightWordByCharIndex(event.charIndex);
    }
  };
  utt.onend = () => {
    state.speaking = false;
    state.currentWordSpans.forEach((w) => w.classList.remove("active-word"));
  };
  state.utterance = utt;
  state.speaking = true;
  window.speechSynthesis.speak(utt);
}

function renderReader() {
  const subject = getSubjectById(state.selectedSubjectId);
  const chapter = getSelectedChapter();
  const chunks = getChapterChunks(chapter.text);
  if (state.readerChunkIndex >= chunks.length) state.readerChunkIndex = chunks.length - 1;
  if (state.readerChunkIndex < 0) state.readerChunkIndex = 0;
  const chunk = chunks[state.readerChunkIndex];

  el.readerTitle.textContent = `${subject.name} · ${chapter.title}`;
  el.chunkCounter.textContent = `Chunk ${state.readerChunkIndex + 1} of ${chunks.length}`;
  renderGlossaryText(chunk, chapter.glossary);
  if (el.glossaryInline) {
    el.glossaryInline.hidden = true;
    el.glossaryInline.textContent = "";
  }

  el.chapterSummary.innerHTML = chapter.summary.map((x) => `<li>${x}</li>`).join("");
  el.chapterConcepts.innerHTML = chapter.concepts.map((x) => `<span class="chip">${x}</span>`).join("");
  el.chapterDiagram.textContent = chapter.diagram;
  el.chapterVideo.textContent = chapter.videoPlaceholder;
}

function renderHome() {
  const totalChapters = APP_DATA.subjects.reduce((sum, s) => sum + s.chapters.length, 0);
  const completed = state.progress.completedChapters.length;
  const progressPct = Math.round((completed / totalChapters) * 100);
  const avgScore = average(Object.values(state.progress.quizScores));

  el.homeCards.innerHTML = [
    ...APP_DATA.subjects.map((s) => ({ name: s.name, id: s.id, active: true })),
    ...APP_DATA.extraSubjects.map((s) => ({ name: s.name, id: s.id, active: false }))
  ].map((item) => `
    <button class="subject-card ${item.active ? "" : "locked"}" data-open-subject="${item.id}" ${item.active ? "" : "disabled"}>
      <h4>${item.name}</h4>
      <p>${item.active ? "Start chapters" : "Coming soon"}</p>
    </button>
  `).join("");

  el.previewStats.innerHTML = `
    <article><h3>${completed}</h3><p>Chapters Completed</p></article>
    <article><h3>${progressPct}%</h3><p>Learning Progress</p></article>
    <article><h3>${avgScore}%</h3><p>Average Quiz Score</p></article>
  `;

  el.homeCards.querySelectorAll("[data-open-subject]").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.selectedSubjectId = btn.dataset.openSubject;
      state.selectedChapterId = getSubjectById(state.selectedSubjectId).chapters[0].id;
      setView("subjects");
    });
  });
}

function renderSubjects() {
  el.subjectsList.innerHTML = APP_DATA.subjects.map((subject) => `
    <button class="subject-pill ${subject.id === state.selectedSubjectId ? "active" : ""}" data-subject-pill="${subject.id}">
      ${subject.name}
    </button>
  `).join("");

  const subject = getSubjectById(state.selectedSubjectId);
  el.chapterList.innerHTML = subject.chapters.map((ch) => {
    const done = state.progress.completedChapters.includes(ch.id);
    return `
      <article class="chapter-card">
        <div>
          <h4>${ch.title}</h4>
          <p>${ch.estimatedMinutes} mins · Difficulty: <span class="difficulty ${ch.difficulty.toLowerCase()}">${ch.difficulty}</span></p>
        </div>
        <div class="chapter-actions">
          <span class="status ${done ? "done" : "pending"}">${done ? "Completed" : "In Progress"}</span>
          <button data-open-chapter="${ch.id}" class="primary-btn">Open Reader</button>
        </div>
      </article>
    `;
  }).join("");

  el.subjectsList.querySelectorAll("[data-subject-pill]").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.selectedSubjectId = btn.dataset.subjectPill;
      state.selectedChapterId = getSubjectById(state.selectedSubjectId).chapters[0].id;
      renderSubjects();
      renderReader();
    });
  });

  el.chapterList.querySelectorAll("[data-open-chapter]").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.selectedChapterId = btn.dataset.openChapter;
      state.readerChunkIndex = 0;
      setView("reader");
    });
  });
}

function buildPracticeQuestion(q) {
  if (!q) {
    el.practiceWrap.innerHTML = `<div class="result-box"><h3>No quiz found for this chapter.</h3></div>`;
    return;
  }

  if (q.type === "mcq") {
    el.practiceWrap.innerHTML = `
      <div class="question-box">
        <h3>${q.question}</h3>
        <div class="options-wrap">
          ${q.options.map((op, idx) => `<button class="option-btn" data-option="${idx}">${op}</button>`).join("")}
        </div>
      </div>
    `;

    el.practiceWrap.querySelectorAll("[data-option]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const selected = Number(btn.dataset.option);
        const correct = selected === q.answerIndex;
        state.practiceAnswers.push({ id: q.id, correct });
        nextPractice();
      });
    });
  }

  if (q.type === "match") {
    const choices = q.pairs.map((p) => p.right).sort(() => Math.random() - 0.5);
    el.practiceWrap.innerHTML = `
      <div class="question-box">
        <h3>${q.prompt}</h3>
        <div class="match-grid">
          <div>
            ${q.pairs.map((pair, idx) => `
              <div class="match-row">
                <div class="left-item">${pair.left}</div>
                <div class="drop-slot" data-expected="${pair.right}" data-slot="${idx}" tabindex="0">Drop answer here</div>
              </div>
            `).join("")}
          </div>
          <div>
            ${choices.map((c, idx) => `<div class="drag-item" draggable="true" data-choice="${c}" id="choice-${idx}">${c}</div>`).join("")}
          </div>
        </div>
        <button id="checkMatchBtn" class="primary-btn">Check Matching</button>
      </div>
    `;

    let dragValue = "";
    el.practiceWrap.querySelectorAll(".drag-item").forEach((item) => {
      item.addEventListener("dragstart", () => {
        dragValue = item.dataset.choice;
      });
    });

    el.practiceWrap.querySelectorAll(".drop-slot").forEach((slot) => {
      slot.addEventListener("dragover", (event) => event.preventDefault());
      slot.addEventListener("drop", (event) => {
        event.preventDefault();
        if (!dragValue) return;
        slot.dataset.value = dragValue;
        slot.textContent = dragValue;
      });
    });

    document.getElementById("checkMatchBtn").addEventListener("click", () => {
      const slots = [...el.practiceWrap.querySelectorAll(".drop-slot")];
      const allCorrect = slots.every((slot) => slot.dataset.value === slot.dataset.expected);
      state.practiceAnswers.push({ id: q.id, correct: allCorrect });
      nextPractice();
    });
  }
}

function calculateLevel(points) {
  if (points >= 16) return { level: 4, label: "Shining Scholar" };
  if (points >= 10) return { level: 3, label: "Steady Achiever" };
  if (points >= 5) return { level: 2, label: "Growing Learner" };
  return { level: 1, label: "Curious Starter" };
}

function finalizePractice() {
  const chapter = getSelectedChapter();
  const correct = state.practiceAnswers.filter((x) => x.correct).length;
  const total = state.practiceAnswers.length;
  const score = total ? Math.round((correct / total) * 100) : 0;

  state.progress.quizScores[chapter.id] = score;
  state.progress.chapterAttempts[chapter.id] = (state.progress.chapterAttempts[chapter.id] || 0) + 1;
  if (score >= 60 && !state.progress.completedChapters.includes(chapter.id)) {
    state.progress.completedChapters.push(chapter.id);
  }

  if (score >= 80) markAchievement("Quiz Master");
  if (state.progress.completedChapters.length >= 2) markAchievement("Two Chapters Completed");
  if (Object.keys(state.progress.quizScores).length >= 3) markAchievement("Consistent Learner");

  saveProgress();

  const stars = Math.max(1, Math.round(score / 20));
  const points = state.progress.completedChapters.length * 3 + Math.round(average(Object.values(state.progress.quizScores)) / 20);
  const levelInfo = calculateLevel(points);

  el.practiceWrap.innerHTML = `
    <div class="result-box">
      <h3>Quiz Complete</h3>
      <p>You scored <strong>${score}%</strong> (${correct}/${total})</p>
      <p>Rewards earned: <strong>${"★".repeat(stars)}</strong></p>
      <p>Level: <strong>${levelInfo.level} - ${levelInfo.label}</strong></p>
      <button id="goDashboardBtn" class="primary-btn">Go to Dashboard</button>
    </div>
  `;

  document.getElementById("goDashboardBtn").addEventListener("click", () => setView("dashboard"));
}

function nextPractice() {
  const chapter = getSelectedChapter();
  const quiz = chapter.quiz;
  state.practiceIndex += 1;
  if (state.practiceIndex >= quiz.length) {
    finalizePractice();
    return;
  }
  buildPracticeQuestion(quiz[state.practiceIndex]);
}

function startPractice() {
  const chapter = getSelectedChapter();
  state.practiceIndex = 0;
  state.practiceAnswers = [];
  buildPracticeQuestion(chapter.quiz[0]);
}

function speakQuestionText() {
  const chapter = getSelectedChapter();
  const q = chapter.quiz[state.practiceIndex];
  if (!q) return;
  const text = q.type === "mcq" ? q.question : q.prompt;
  speakText(text);
}

function simulateVoiceAnswer() {
  const chapter = getSelectedChapter();
  const q = chapter.quiz[state.practiceIndex];
  if (!q || q.type !== "mcq") return;
  el.practiceVoiceBtn.disabled = true;
  el.practiceVoiceBtn.textContent = "Listening...";
  setTimeout(() => {
    const simulated = Math.floor(Math.random() * q.options.length);
    const btn = el.practiceWrap.querySelector(`[data-option="${simulated}"]`);
    if (btn) btn.click();
    el.practiceVoiceBtn.disabled = false;
    el.practiceVoiceBtn.textContent = "Voice Answer (Simulated)";
  }, 1200);
}

function recordReadingTime() {
  if (!state.readerSessionStartedAt) return;
  const now = Date.now();
  const elapsedSec = Math.max(0, Math.round((now - state.readerSessionStartedAt) / 1000));
  if (elapsedSec > 0) {
    state.progress.readingSecondsBySubject[state.selectedSubjectId] =
      (state.progress.readingSecondsBySubject[state.selectedSubjectId] || 0) + elapsedSec;
    saveProgress();
  }
  state.readerSessionStartedAt = now;
}

function average(arr) {
  if (!arr.length) return 0;
  return Math.round(arr.reduce((a, b) => a + b, 0) / arr.length);
}

function renderDashboard() {
  const completed = state.progress.completedChapters.length;
  const total = APP_DATA.subjects.reduce((sum, s) => sum + s.chapters.length, 0);
  const readingMinutes = Object.values(state.progress.readingSecondsBySubject).reduce((a, b) => a + b, 0) / 60;
  const avgScore = average(Object.values(state.progress.quizScores));
  const weak = findWeakTopics();
  const progressPct = Math.round((completed / total) * 100);

  el.dashboardStats.innerHTML = `
    <article><h4>${completed}/${total}</h4><p>Chapters Completed</p></article>
    <article><h4>${Math.round(readingMinutes)}</h4><p>Reading Minutes</p></article>
    <article><h4>${avgScore}%</h4><p>Quiz Average</p></article>
    <article><h4>${progressPct}%</h4><p>Total Progress</p></article>
  `;

  el.weakTopics.innerHTML = weak.length
    ? weak.map((w) => `<li>${w.topic} (${w.score}%)</li>`).join("")
    : "<li>No weak topics yet. Great start!</li>";

  const points = completed * 3 + Math.round(avgScore / 20);
  const levelInfo = calculateLevel(points);
  const badges = state.progress.achievements.length ? state.progress.achievements : ["First Login Badge"];
  el.rewardsStrip.innerHTML = `
    <div><strong>Level ${levelInfo.level}</strong> · ${levelInfo.label}</div>
    <div>Badges: ${badges.map((x) => `<span class="chip">${x}</span>`).join(" ")}</div>
  `;

  renderCharts(progressPct, avgScore);
}

function findWeakTopics() {
  const weak = [];
  APP_DATA.subjects.forEach((s) => {
    s.chapters.forEach((c) => {
      const score = state.progress.quizScores[c.id];
      if (typeof score === "number" && score < 60) {
        weak.push({ topic: `${s.name}: ${c.title}`, score });
      }
    });
  });
  return weak;
}

function renderCharts(progressPct, avgScore) {
  state.chartRefs.forEach((c) => c.destroy && c.destroy());
  state.chartRefs = [];
  if (!window.Chart) return;

  const progressCtx = document.getElementById("progressChart");
  const subjectCtx = document.getElementById("subjectChart");
  if (!progressCtx || !subjectCtx) return;

  state.chartRefs.push(new Chart(progressCtx, {
    type: "doughnut",
    data: {
      labels: ["Completed", "Remaining"],
      datasets: [{ data: [progressPct, 100 - progressPct], backgroundColor: ["#52c79d", "#d8e8f8"] }]
    },
    options: { plugins: { legend: { position: "bottom" } }, maintainAspectRatio: false }
  }));

  const labels = APP_DATA.subjects.map((s) => s.name);
  const values = APP_DATA.subjects.map((s) => {
    const scores = s.chapters.map((c) => state.progress.quizScores[c.id]).filter((n) => typeof n === "number");
    return scores.length ? average(scores) : 0;
  });

  state.chartRefs.push(new Chart(subjectCtx, {
    type: "bar",
    data: { labels, datasets: [{ label: "Score %", data: values, backgroundColor: ["#5da8ff", "#52c79d"] }] },
    options: { scales: { y: { min: 0, max: 100 } }, maintainAspectRatio: false }
  }));
}

function setView(view) {
  if (state.view === "reader" && view !== "reader") {
    recordReadingTime();
  }

  state.view = view;
  el.pages.forEach((page) => {
    page.hidden = page.dataset.page !== view;
  });

  el.navButtons.forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.nav === view);
  });

  if (view === "home") renderHome();
  if (view === "subjects") renderSubjects();
  if (view === "reader") {
    if (!state.readerSessionStartedAt) state.readerSessionStartedAt = Date.now();
    renderReader();
  }
  if (view === "practice") startPractice();
  if (view === "dashboard") renderDashboard();
}

function attachEvents() {
  el.navButtons.forEach((btn) => {
    btn.addEventListener("click", () => setView(btn.dataset.nav));
  });

  el.focusToggle.addEventListener("change", () => {
    state.focusMode = el.focusToggle.checked;
    document.body.classList.toggle("focus-mode", state.focusMode);
    if (state.focusMode && state.view !== "reader") {
      setView("reader");
    }
  });

  el.dyslexicFontToggle.addEventListener("change", () => {
    document.body.classList.toggle("dyslexic-font", el.dyslexicFontToggle.checked);
  });

  [el.fontSlider, el.lineSlider, el.bgSelector].forEach((node) => {
    node.addEventListener("input", applyReaderStyles);
  });

  el.prevChunkBtn.addEventListener("click", () => {
    state.readerChunkIndex -= 1;
    renderReader();
  });

  el.nextChunkBtn.addEventListener("click", () => {
    state.readerChunkIndex += 1;
    renderReader();
  });

  el.readChunkBtn.addEventListener("click", () => {
    const chapter = getSelectedChapter();
    const chunks = getChapterChunks(chapter.text);
    speakText(chunks[state.readerChunkIndex]);
  });

  el.stopReadBtn.addEventListener("click", stopSpeech);

  el.chunkText.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement) || !target.dataset.word) return;
    const glossary = getSelectedChapter().glossary;
    const entry = glossary[target.dataset.word];
    if (!entry) return;
    if (el.glossaryInline) {
      el.glossaryInline.textContent = `${target.dataset.word}: ${entry.meaning}`;
      el.glossaryInline.hidden = false;
    }
  });

  el.startPracticeBtn.addEventListener("click", () => setView("practice"));
  el.practiceVoiceBtn.addEventListener("click", () => {
    simulateVoiceAnswer();
  });

  document.getElementById("readQuestionBtn").addEventListener("click", speakQuestionText);
  document.getElementById("startLearningBtn").addEventListener("click", () => setView("subjects"));

  document.addEventListener("keydown", (event) => {
    if (state.view === "reader") {
      if (event.key === "ArrowRight") {
        state.readerChunkIndex += 1;
        renderReader();
      }
      if (event.key === "ArrowLeft") {
        state.readerChunkIndex -= 1;
        renderReader();
      }
    }
  });

  window.addEventListener("beforeunload", () => {
    recordReadingTime();
    stopSpeech();
  });
}

function init() {
  attachEvents();
  applyReaderStyles();
  renderHome();
  renderSubjects();
  renderReader();
  renderDashboard();
  setView("home");
}

init();
