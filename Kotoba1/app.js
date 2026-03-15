// iPadOS 13以降はUAに"iPad"が含まれないためタッチ判定も併用
const IS_IOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
               (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

const App = (() => {
  // ---- State ----
  let mode         = null;   // 'narabe' | 'erabe'
  let questions    = [];
  let qIdx         = 0;
  let score        = 0;
  let firstTry     = true;
  let answered     = false;
  let currentAudio = '';

  // narabe
  let slots      = [];   // Array of null | {char, tileId, color}
  let tilePool   = [];   // Array of {id, char, color}
  let tileSize   = 56;
  let hintActive = false;

  // erabe
  let correctSide  = 0;     // 0=left  1=right
  let erabeRandom  = false;

  // narabe restart
  let narabeStars  = 0;

  // audio
  let audioCtx = null;

  // BGM
  let bgmRunning   = false;
  let bgmTimerId   = null;
  let bgmStep      = 0;

  // =====================================================
  // BGMパターン選択（1〜4 の数字で切り替え）
  // =====================================================
  const BGM_PATTERN = 2;

  const BGM_PATTERNS = {
    // 案1: マーチポップ ── 行進曲テンポ、聴きやすくてノリが出る (210ms)
    1: {
      beat: 160,
      seq: [
        [523, 1], [659, 1], [784, 1], [659, 1],   // C5 E5 G5 E5
        [523, 1], [659, 1], [784, 2],              // C5 E5 G5(長)
        [880, 1], [784, 1], [659, 1], [523, 1],   // A5 G5 E5 C5
        [659, 2], [523, 2],                        // E5(長) C5(長)
      ],
    },

    // 案2: スキップリズム ── 休符でぴょんぴょん跳ねる感じ (185ms)
    2: {
      beat: 215,
      seq: [
        [659, 1], [784, 1], [880, 1], [  0, 1],   // E5 G5 A5 休
        [880, 1], [784, 1], [659, 1], [  0, 1],   // A5 G5 E5 休
        [523, 1], [659, 1], [784, 1], [880, 1],   // C5 E5 G5 A5
        [1047,2], [784, 2],                        // C6(長) G5(長)
      ],
    },

    // 案3: ゲームBGM風 ── 上昇下降パターン、一番アップテンポ (165ms)
    3: {
      beat: 220,
      seq: [
        [523, 1], [659, 1], [784, 1], [1047,1],   // C5 E5 G5 C6（上昇）
        [880, 1], [784, 1], [659, 1], [523, 1],   // A5 G5 E5 C5（下降）
        [440, 1], [523, 1], [659, 1], [784, 1],   // A4 C5 E5 G5（上昇）
        [880, 2], [523, 2],                        // A5(長) C5(長)
      ],
    },

    // 案4: タッタッタリズム ── シンコペーション、弾む付点リズム感 (175ms)
    4: {
      beat: 175,
      seq: [
        [784, 2], [659, 1], [784, 1],              // G5(長) E5 G5
        [880, 2], [784, 1], [659, 1],              // A5(長) G5 E5
        [659, 2], [523, 1], [659, 1],              // E5(長) C5 E5
        [784, 3], [  0, 1],                        // G5(長め) 休
      ],
    },
  };

  const _bgm = BGM_PATTERNS[BGM_PATTERN];
  const BGM_SEQ  = _bgm.seq;
  const BGM_BEAT = _bgm.beat;

  function startBgm() {
    if (bgmRunning) return;
    bgmRunning = true;
    bgmStep = 0;
    tickBgm();
  }

  function stopBgm() {
    bgmRunning = false;
    clearTimeout(bgmTimerId);
    bgmTimerId = null;
  }

  function tickBgm() {
    if (!bgmRunning) return;
    const [freq, beats] = BGM_SEQ[bgmStep % BGM_SEQ.length];
    if (freq > 0) playBgmNote(freq, BGM_BEAT * beats * 0.72 / 1000);
    bgmStep++;
    bgmTimerId = setTimeout(tickBgm, BGM_BEAT * beats);
  }

  function playBgmNote(freq, dur) {
    try {
      const ctx  = getAudioCtx();
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'triangle';
      osc.frequency.value = freq;
      const t = ctx.currentTime;
      gain.gain.setValueAtTime(0.032, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
      osc.start(t);
      osc.stop(t + dur + 0.02);
    } catch (e) {}
  }

  // ---- Tile colors (pastel) ----
  const COLORS = [
    '#FF9AA2','#FFB347','#FFDAC1','#B5EAD7',
    '#C7CEEA','#F8C8D4','#A8D8EA','#F9E4B7','#B2F7EF',
  ];

  // ---- Utils ----
  function shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function getAudioCtx() {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    return audioCtx;
  }

  function playTone(freq, dur, delay = 0, type = 'sine') {
    try {
      const ctx  = getAudioCtx();
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = type;
      osc.frequency.value = freq;
      const t = ctx.currentTime + delay;
      gain.gain.setValueAtTime(0.16, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
      osc.start(t);
      osc.stop(t + dur);
    } catch (e) {}
  }

  // Short ping for each correctly placed tile
  function playCorrectStep() {
    playTone(880, 0.10, 0.00);
  }

  // Full success fanfare (all tiles done / correct answer)
  function playSuccess() {
    playTone(523,  0.18, 0.00);  // C5
    playTone(659,  0.18, 0.15);  // E5
    playTone(784,  0.28, 0.30);  // G5
    playTone(1047, 0.22, 0.50);  // C6
  }

  // Celebratory fanfare for 80%+
  function playFanfare() {
    playTone(523,  0.14, 0.00);
    playTone(659,  0.14, 0.12);
    playTone(784,  0.14, 0.24);
    playTone(880,  0.14, 0.36);
    playTone(1047, 0.28, 0.50);
    playTone(880,  0.14, 0.82);
    playTone(1047, 0.40, 0.98);
  }

  function playError() {
    playTone(220, 0.18, 0.00, 'sawtooth');
    playTone(196, 0.22, 0.15, 'sawtooth');
  }

  function speak(text) {
    if (!text) return;
    window.speechSynthesis.cancel();
    // iOS は cancel() 直後に speak() すると先頭音節が欠けるため遅延を入れる
    setTimeout(() => {
      const u = new SpeechSynthesisUtterance(text);
      u.lang  = 'ja-JP';
      u.rate  = IS_IOS ? 0.90 : 0.72;
      u.pitch = 1.1;
      window.speechSynthesis.speak(u);
    }, IS_IOS ? 120 : 0);
  }

  function showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    window.scrollTo(0, 0);
  }

  function calcTileSize(n) {
    if (n <= 4) return 62;
    if (n === 5) return 56;
    if (n === 6) return 48;
    if (n === 7) return 42;
    return 36;
  }

  function setProgress(screenId, idx, total) {
    const pct = total > 0 ? (idx / total) * 100 : 0;
    document.getElementById(`${screenId}-prog-fill`).style.width = pct + '%';
    document.getElementById(`${screenId}-prog-text`).textContent =
      `${idx + 1} / ${total}もん`;
  }

  // ---- Init ----
  function init() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    }
  }

  // ---- Navigation ----
  function goHome() {
    window.speechSynthesis.cancel();
    stopBgm();
    showScreen('home');
  }

  // ---- NARABE ----
  function startNarabe(stars) {
    mode = 'narabe';
    narabeStars = stars;
    let qs = stars === 0
      ? [...NARABE]
      : NARABE.filter(q => q.stars === stars);
    if (!qs.length) return;

    // Sort by difficulty, shuffle within each level
    const groups = { 1: [], 2: [], 3: [] };
    qs.forEach(q => groups[q.stars].push(q));
    questions = [
      ...shuffle(groups[1]),
      ...shuffle(groups[2]),
      ...shuffle(groups[3]),
    ].filter(Boolean);

    qIdx       = 0;
    score      = 0;
    hintActive = false;
    showScreen('narabe');
    startBgm();
    loadNarabeQ();
  }

  function loadNarabeQ() {
    const q = questions[qIdx];
    firstTry     = true;
    answered     = false;
    currentAudio = q.audio || q.yomi;

    const chars = [...q.yomi];
    tileSize = calcTileSize(chars.length);

    // Shuffle tiles (ensure different order from answer)
    let shuffled;
    do { shuffled = shuffle(chars); }
    while (chars.length > 1 && shuffled.join('') === q.yomi);

    tilePool = shuffled.map((c, i) => ({
      id:    i,
      char:  c,
      color: COLORS[i % COLORS.length],
    }));
    slots = new Array(chars.length).fill(null);

    document.getElementById('narabe-img').src = `images/${q.img}`;
    document.getElementById('narabe-img').alt = q.yomi;

    // ヒントdivは常に非表示（ヒントはスロット内に表示）
    const hintEl = document.getElementById('narabe-hint');
    hintEl.textContent = '';
    hintEl.className = 'hint-text hidden';

    hideFeedback('narabe');
    setProgress('narabe', qIdx, questions.length);
    renderNarabe();
    setTimeout(() => speak(q.audio || q.yomi), 600);
  }

  function renderNarabe() {
    const slotsEl = document.getElementById('narabe-slots');
    const tilesEl = document.getElementById('narabe-tiles');
    const sz = tileSize;
    const fs = Math.max(14, Math.round(sz * 0.46));
    const base = `width:${sz}px;height:${sz}px;font-size:${fs}px;line-height:${sz}px;`;

    slotsEl.innerHTML = '';
    const firstEmpty = slots.indexOf(null);
    const yomiChars  = [...questions[qIdx].yomi];
    slots.forEach((s, i) => {
      const el = document.createElement('div');
      el.className = 'answer-slot' + (s ? ' filled' : '');
      el.style.cssText = base;
      if (s) {
        el.style.background = s.color;
        el.textContent = s.char;
      } else if (hintActive && i === firstEmpty) {
        // 次に入れる文字をグレーでヒント表示
        el.textContent = yomiChars[i];
        el.style.color = '#bbb';
      }
      slotsEl.appendChild(el);
    });

    tilesEl.innerHTML = '';
    tilePool.forEach(tile => {
      const el = document.createElement('div');
      el.className = 'tile';
      el.style.cssText = `${base}background:${tile.color};`;
      el.textContent = tile.char;
      el.addEventListener('click', () => tapTile(tile.id));
      tilesEl.appendChild(el);
    });
  }

  function tapTile(tileId) {
    if (answered) return;
    const firstEmpty = slots.indexOf(null);
    if (firstEmpty === -1) return;
    const tile = tilePool.find(t => t.id === tileId);
    if (!tile) return;

    const expected = [...questions[qIdx].yomi][firstEmpty];

    if (tile.char === expected) {
      // Correct tile — lock it in slot
      tilePool = tilePool.filter(t => t.id !== tileId);
      slots[firstEmpty] = { char: tile.char, tileId: tile.id, color: tile.color };
      playCorrectStep();
      renderNarabe();
      if (slots.every(s => s !== null)) {
        // All slots filled correctly
        setTimeout(onNarabeComplete, 200);
      }
    } else {
      // Wrong tile — reject immediately
      firstTry = false;
      playError();
      const tilesEl = document.getElementById('narabe-tiles');
      tilesEl.classList.add('shake');
      setTimeout(() => tilesEl.classList.remove('shake'), 400);
    }
  }

  function onNarabeComplete() {
    answered = true;
    if (firstTry) score++;

    // Light up all slots green
    document.querySelectorAll('.answer-slot').forEach(el => el.classList.add('correct'));

    // Show big 〇
    showMaru();
    playSuccess();

    // Auto-advance after overlay
    setTimeout(() => {
      hideMaru();
      nextQuestion();
    }, 1500);
  }

  function showMaru() {
    const el = document.getElementById('maru-overlay');
    el.classList.remove('show');
    void el.offsetWidth;  // force reflow
    el.classList.add('show');
  }

  function hideMaru() {
    document.getElementById('maru-overlay').classList.remove('show');
  }

  // ---- ERABE ----
  function retryMode() {
    if (mode === 'erabe') startErabe(erabeRandom);
    else startNarabe(narabeStars);
  }

  function startErabe(random) {
    mode         = 'erabe';
    erabeRandom  = random;
    const pool = shuffle([...ERABE]);
    questions = random ? pool.slice(0, 10) : pool;
    qIdx      = 0;
    score     = 0;
    showScreen('erabe');
    startBgm();
    loadErabeQ();
  }

  function loadErabeQ() {
    const q  = questions[qIdx];
    firstTry = true;
    answered = false;
    currentAudio = q.audio;

    const correctImg = q.correct === 1 ? q.img1 : q.img2;
    const wrongImg   = q.correct === 1 ? q.img2 : q.img1;

    correctSide = Math.random() < 0.5 ? 0 : 1;
    const imgs = correctSide === 0
      ? [correctImg, wrongImg]
      : [wrongImg, correctImg];

    [0, 1].forEach(i => {
      document.getElementById(`choice-img-${i}`).src = `images/${imgs[i]}`;
      const btn = document.getElementById(`choice-${i}`);
      btn.className = 'choice-btn';
      btn.disabled  = false;
    });

    // Display question wrapped in 「」(text=表示用ひらがな、なければaudioを使用)
    document.getElementById('erabe-q').textContent =
      '「' + (q.text || q.audio).replace(/　/g, ' ') + '」';

    hideFeedback('erabe');
    setProgress('erabe', qIdx, questions.length);
    setTimeout(() => speak(q.audio), 400);
  }

  function selectChoice(side) {
    if (answered) return;

    const isCorrect = side === correctSide;
    if (isCorrect) {
      answered = true;
      if (firstTry) score++;
      playSuccess();
      document.getElementById(`choice-${side}`).classList.add('correct');
      [0, 1].forEach(i => { document.getElementById(`choice-${i}`).disabled = true; });

      if (questions[qIdx].anim) {
        // 正解画像のSVGアニメを最初から再生してから次へ
        setTimeout(() => {
          const img = document.getElementById(`choice-img-${side}`);
          const s = img.src; img.src = ''; img.src = s;
        }, 300);
        setTimeout(nextQuestion, 5000);
      } else {
        setTimeout(nextQuestion, 1500);
      }
    } else {
      firstTry = false;
      playError();
      document.getElementById(`choice-${side}`).classList.add('wrong');
      [0, 1].forEach(i => { document.getElementById(`choice-${i}`).disabled = true; });
      setTimeout(() => {
        document.getElementById(`choice-${side}`).classList.remove('wrong');
        hideFeedback('erabe');
        [0, 1].forEach(i => { document.getElementById(`choice-${i}`).disabled = false; });
        speak(currentAudio);
      }, 800);
    }
  }

  // ---- Next / Result ----
  function nextQuestion() {
    qIdx++;
    if (qIdx >= questions.length) {
      showResult();
    } else if (mode === 'narabe') {
      loadNarabeQ();
    } else {
      loadErabeQ();
    }
  }

  function showResult() {
    stopBgm();
    showScreen('result');
    const total = questions.length;
    const pct   = total > 0 ? score / total : 0;

    document.getElementById('result-score-num').textContent = score;
    document.getElementById('result-total').textContent = `/ ${total}もん せいかい`;

    let stars, msg;
    if (pct >= 1.0) {
      stars = '⭐⭐⭐'; msg = 'すごい！ぜんぶせいかい！';
      playSuccess();
      playTone(1047, 0.25, 0.6);
      setTimeout(launchFireworks, 400);
    } else if (pct >= 0.8) {
      stars = '⭐⭐'; msg = 'がんばったね！';
      playFanfare();
    } else if (pct >= 0.6) {
      stars = '⭐'; msg = 'よくできました！';
      playSuccess();
    } else {
      stars = ''; msg = 'またちょうせんしよう！';
    }

    document.getElementById('result-stars').textContent = stars;
    document.getElementById('result-msg').textContent   = msg;
  }

  function launchFireworks() {
    const layer  = document.getElementById('fireworks-layer');
    const colors = ['#ff6b35','#00b4d8','#52b788','#ffd700','#ff69b4','#a855f7','#fb923c','#22d3ee'];
    const W = window.innerWidth;
    const H = window.innerHeight;

    for (let burst = 0; burst < 7; burst++) {
      const delay = burst * 280;
      const cx = W * (0.15 + Math.random() * 0.70);
      const cy = H * (0.10 + Math.random() * 0.55);

      for (let p = 0; p < 20; p++) {
        const el    = document.createElement('div');
        el.className = 'fw-particle';
        const color  = colors[Math.floor(Math.random() * colors.length)];
        const size   = 7 + Math.random() * 8;
        el.style.cssText =
          `left:${cx}px;top:${cy}px;width:${size}px;height:${size}px;background:${color};`;
        layer.appendChild(el);

        const angle = (p / 20) * 2 * Math.PI + Math.random() * 0.4;
        const dist  = 70 + Math.random() * 110;
        const dx    = Math.cos(angle) * dist;
        const dy    = Math.sin(angle) * dist;

        el.animate([
          { transform: 'translate(-50%,-50%) scale(1)',                              opacity: 1 },
          { transform: `translate(calc(-50% + ${dx}px),calc(-50% + ${dy}px)) scale(0)`, opacity: 0 },
        ], {
          duration: 900 + Math.random() * 400,
          delay:    delay + Math.random() * 80,
          easing:   'cubic-bezier(0,.9,.57,1)',
          fill:     'forwards',
        }).onfinish = () => el.remove();
      }
    }

    // Extra celebratory tones
    playTone(1047, 0.18, 0.0);
    playTone(1319, 0.18, 0.2);
    playTone(1568, 0.18, 0.4);
    playTone(2093, 0.35, 0.6);
    playTone(1568, 0.18, 1.0);
    playTone(2093, 0.45, 1.2);
  }

  function playAudio() {
    speak(currentAudio);
    // えらぶモードではSVGアニメーションも最初から再生
    if (mode === 'erabe') {
      [0, 1].forEach(i => {
        const img = document.getElementById(`choice-img-${i}`);
        const src = img.src;
        img.src = '';
        img.src = src;
      });
    }
  }

  function showHint() {
    hintActive = !hintActive;
    renderNarabe();
  }

  // ---- Feedback helpers ----
  function showFeedback(screenId, text, ok) {
    const el = document.getElementById(`${screenId}-feedback`);
    el.textContent = text;
    el.className   = `feedback ${ok ? 'ok' : 'ng'}`;
  }

  function hideFeedback(screenId) {
    const el = document.getElementById(`${screenId}-feedback`);
    el.textContent = '';
    el.className   = 'feedback hidden';
  }

  // ---- Public API ----
  return {
    init,
    goHome,
    retryMode,
    startNarabe,
    startErabe,
    selectChoice,
    nextQuestion,
    playAudio,
    showHint,
  };
})();
