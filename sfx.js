/**
 * 다 때려쳐 @office — Web Audio 효과음
 * (브라우저 첫 클릭 후 재생)
 */
(function (global) {
  let ctx = null;
  let voicesReady = false;

  function getCtx() {
    if (!global.AudioContext && !global.webkitAudioContext) return null;
    if (!ctx) {
      const Ctx = global.AudioContext || global.webkitAudioContext;
      ctx = new Ctx();
    }
    if (ctx.state === "suspended") {
      ctx.resume().catch(function () {});
    }
    return ctx;
  }

  function unlock() {
    getCtx();
    primeVoices();
  }

  function primeVoices() {
    if (!global.speechSynthesis || voicesReady) return;
    const load = function () {
      global.speechSynthesis.getVoices();
      voicesReady = true;
    };
    load();
    global.speechSynthesis.addEventListener("voiceschanged", load, { once: true });
  }

  function pickKoVoice() {
    if (!global.speechSynthesis) return null;
    const voices = global.speechSynthesis.getVoices();
    return (
      voices.find(function (v) {
        return v.lang === "ko-KR";
      }) ||
      voices.find(function (v) {
        return v.lang.indexOf("ko") === 0;
      }) ||
      null
    );
  }

  function pickMaleKoVoice() {
    if (!global.speechSynthesis) return null;
    const voices = global.speechSynthesis.getVoices();
    const ko = voices.filter(function (v) {
      return v.lang.indexOf("ko") === 0;
    });
    const maleHint = /male|남성|남자|heera|injoon|hyunsu|yong|seok|junwoo/i;
    const hinted = ko.find(function (v) {
      return maleHint.test(v.name);
    });
    if (hinted) return hinted;
    if (ko.length > 1) return ko[ko.length - 1];
    return pickKoVoice();
  }

  function speakLine(text, opts) {
    if (!global.speechSynthesis) return false;
    if (opts.cancel !== false) global.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = "ko-KR";
    utter.rate = opts.rate || 1;
    utter.pitch = opts.pitch || 1;
    utter.volume = opts.volume != null ? opts.volume : 1;
    const voice = opts.male ? pickMaleKoVoice() : pickKoVoice();
    if (voice) utter.voice = voice;
    global.speechSynthesis.speak(utter);
    return true;
  }

  /** Web Audio — "으악" 비명 (TTS 없이도 재생) */
  function playMaleEukVocal() {
    if (!getCtx()) return;
    const t = now();

    const o1 = ctx.createOscillator();
    o1.type = "triangle";
    o1.frequency.setValueAtTime(270, t);
    o1.frequency.exponentialRampToValueAtTime(185, t + 0.1);
    const g1 = ctx.createGain();
    g1.gain.setValueAtTime(0.0001, t);
    g1.gain.exponentialRampToValueAtTime(0.5, t + 0.015);
    g1.gain.exponentialRampToValueAtTime(0.0001, t + 0.11);
    o1.connect(g1);
    g1.connect(ctx.destination);
    o1.start(t);
    o1.stop(t + 0.12);

    const t2 = t + 0.09;
    const n = ctx.createBufferSource();
    n.buffer = noiseBuffer(0.2);
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 520;
    bp.Q.value = 0.65;
    const gn = ctx.createGain();
    gn.gain.setValueAtTime(0.0001, t2);
    gn.gain.exponentialRampToValueAtTime(0.62, t2 + 0.012);
    gn.gain.exponentialRampToValueAtTime(0.0001, t2 + 0.22);
    n.connect(bp);
    bp.connect(gn);
    gn.connect(ctx.destination);
    n.start(t2);
    n.stop(t2 + 0.24);

    const o2 = ctx.createOscillator();
    o2.type = "sawtooth";
    o2.frequency.setValueAtTime(560, t2);
    o2.frequency.exponentialRampToValueAtTime(260, t2 + 0.16);
    const g2 = ctx.createGain();
    g2.gain.setValueAtTime(0.0001, t2);
    g2.gain.exponentialRampToValueAtTime(0.42, t2 + 0.01);
    g2.gain.exponentialRampToValueAtTime(0.0001, t2 + 0.18);
    o2.connect(g2);
    g2.connect(ctx.destination);
    o2.start(t2);
    o2.stop(t2 + 0.2);
  }

  function trySpeakMaleEuk() {
    if (!global.speechSynthesis) return;
    primeVoices();
    const utter = new SpeechSynthesisUtterance("으악");
    utter.lang = "ko-KR";
    utter.rate = 1.15;
    utter.pitch = 0.45;
    utter.volume = 1;
    const voice = pickMaleKoVoice();
    if (voice) utter.voice = voice;
    try {
      global.speechSynthesis.speak(utter);
    } catch (e) {
      /* Web Audio만 사용 */
    }
  }

  var ACK_DELAY_SEC = {
    notebook: 0.12,
    cup: 0.13,
    phone: 0.15,
    monitor: 0.18,
    chair: 0.22,
    keyboard: 0.14,
    mouse: 0.13,
  };

  var ackTimer = null;

  function scheduleBossMaleAck(type) {
    if (ackTimer) {
      window.clearTimeout(ackTimer);
      ackTimer = null;
    }
    if (!getCtx()) {
      ackTimer = window.setTimeout(function () {
        playMaleEukVocal();
        trySpeakMaleEuk();
      }, 150);
      return;
    }

    const delaySec = ACK_DELAY_SEC[type] || 0.14;

    ackTimer = window.setTimeout(function () {
      ackTimer = null;
      getCtx();
      playMaleEukVocal();
      trySpeakMaleEuk();
    }, Math.max(0, delaySec * 1000));
  }

  function playBossMaleAck() {
    getCtx();
    playMaleEukVocal();
    trySpeakMaleEuk();
  }

  /** 소리지르기 — "시발!" 외침 */
  function playYell() {
    if (!getCtx()) {
      speakLine("시발!", { rate: 1.5, pitch: 0.7, volume: 1 });
      return;
    }
    const t = now();

    playNoise({ duration: 0.12, freq: 520, q: 0.7, peak: 0.55 });
    playNoise({ duration: 0.18, freq: 220, q: 0.5, peak: 0.45 });
    playTone({ freq: 220, slideTo: 480, duration: 0.22, peak: 0.38, wave: "sawtooth" });
    playTone({ freq: 140, duration: 0.15, peak: 0.28, wave: "square" });

    window.setTimeout(function () {
      playNoise({ duration: 0.08, freq: 1100, q: 1.5, peak: 0.25 });
    }, 30);

    speakLine("시발!", { rate: 1.55, pitch: 0.65, volume: 1 });
  }

  /** 진짜 때려치기 — 상사 "으악" 비명 */
  function playBossScream() {
    if (!getCtx()) {
      speakLine("으악아악!", { rate: 1.15, pitch: 1.45, volume: 1 });
      return;
    }

    playNoise({ duration: 0.2, freq: 680, q: 0.6, peak: 0.5 });
    playNoise({ duration: 0.35, freq: 240, q: 0.45, peak: 0.55 });
    playTone({ freq: 520, slideTo: 920, duration: 0.45, peak: 0.42, wave: "sawtooth" });
    playTone({ freq: 380, slideTo: 1200, duration: 0.5, peak: 0.35, wave: "triangle" });

    window.setTimeout(function () {
      playNoise({ duration: 0.15, freq: 1400, q: 1.2, peak: 0.3 });
      playTone({ freq: 800, slideTo: 400, duration: 0.25, peak: 0.25, wave: "square" });
    }, 80);

    window.setTimeout(function () {
      playNoise({ duration: 0.2, freq: 900, q: 0.8, peak: 0.28 });
    }, 200);

    speakLine("으악아악!", { rate: 1.2, pitch: 1.5, volume: 1 });
  }

  function now() {
    return ctx.currentTime;
  }

  function noiseBuffer(duration) {
    const sampleRate = ctx.sampleRate;
    const length = Math.floor(sampleRate * duration);
    const buffer = ctx.createBuffer(1, length, sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    return buffer;
  }

  function playNoise(opts) {
    const t = now();
    const dur = opts.duration || 0.12;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer(dur);
    const filter = ctx.createBiquadFilter();
    filter.type = opts.filterType || "bandpass";
    filter.frequency.value = opts.freq || 400;
    filter.Q.value = opts.q || 0.8;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(opts.peak || 0.35, t + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    src.start(t);
    src.stop(t + dur + 0.02);
    return { t, dur };
  }

  function playTone(opts) {
    const t = now();
    const dur = opts.duration || 0.08;
    const osc = ctx.createOscillator();
    osc.type = opts.wave || "sine";
    osc.frequency.setValueAtTime(opts.freq || 440, t);
    if (opts.slideTo) {
      osc.frequency.exponentialRampToValueAtTime(opts.slideTo, t + dur);
    }
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(opts.peak || 0.2, t + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  function playHit(type) {
    if (!getCtx()) {
      scheduleBossMaleAck(type);
      return;
    }

    switch (type) {
      case "notebook":
        playNoise({ duration: 0.07, freq: 900, q: 1.2, peak: 0.22 });
        playNoise({ duration: 0.14, freq: 180, q: 0.6, peak: 0.42 });
        playTone({ freq: 120, duration: 0.05, peak: 0.12, wave: "triangle" });
        break;

      case "cup":
        playNoise({ duration: 0.05, freq: 2200, q: 2, peak: 0.18 });
        playNoise({ duration: 0.18, freq: 350, q: 0.5, peak: 0.38 });
        window.setTimeout(function () {
          playTone({ freq: 880, slideTo: 520, duration: 0.09, peak: 0.14, wave: "sine" });
        }, 40);
        break;

      case "phone":
        playTone({ freq: 1400, duration: 0.04, peak: 0.1, wave: "square" });
        window.setTimeout(function () {
          playTone({ freq: 900, duration: 0.03, peak: 0.08, wave: "square" });
        }, 55);
        window.setTimeout(function () {
          playNoise({ duration: 0.1, freq: 600, q: 1, peak: 0.28 });
          playNoise({ duration: 0.12, freq: 140, q: 0.7, peak: 0.35 });
        }, 90);
        break;

      case "monitor":
        playNoise({ duration: 0.08, freq: 3200, q: 1.5, peak: 0.25 });
        playNoise({ duration: 0.22, freq: 280, q: 0.55, peak: 0.55 });
        playTone({ freq: 90, duration: 0.2, peak: 0.25, wave: "sawtooth", slideTo: 45 });
        window.setTimeout(function () {
          playNoise({ duration: 0.15, freq: 1200, q: 0.8, peak: 0.2 });
        }, 60);
        break;

      case "chair":
        playNoise({ duration: 0.28, freq: 75, q: 0.45, peak: 0.65 });
        playNoise({ duration: 0.2, freq: 220, q: 0.6, peak: 0.35 });
        playTone({ freq: 55, duration: 0.25, peak: 0.3, wave: "triangle", slideTo: 35 });
        window.setTimeout(function () {
          playNoise({ duration: 0.12, freq: 450, q: 1.2, peak: 0.22 });
        }, 120);
        break;

      case "keyboard":
        playTone({ freq: 620, duration: 0.03, peak: 0.12, wave: "square" });
        window.setTimeout(function () {
          playTone({ freq: 480, duration: 0.03, peak: 0.1, wave: "square" });
        }, 28);
        window.setTimeout(function () {
          playNoise({ duration: 0.1, freq: 420, q: 0.9, peak: 0.32 });
          playNoise({ duration: 0.14, freq: 160, q: 0.55, peak: 0.38 });
        }, 55);
        break;

      case "mouse":
        playTone({ freq: 1100, duration: 0.025, peak: 0.08, wave: "square" });
        playNoise({ duration: 0.08, freq: 800, q: 1.3, peak: 0.2 });
        window.setTimeout(function () {
          playNoise({ duration: 0.12, freq: 200, q: 0.65, peak: 0.36 });
        }, 45);
        break;

      default:
        playNoise({ duration: 0.12, freq: 300, q: 0.7, peak: 0.35 });
        break;
    }

    scheduleBossMaleAck(type);
  }

  global.GameSfx = {
    unlock: unlock,
    playHit: playHit,
    playBossMaleAck: playBossMaleAck,
    playYell: playYell,
    playBossScream: playBossScream,
  };
})(typeof window !== "undefined" ? window : globalThis);
