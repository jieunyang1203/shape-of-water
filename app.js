// 관람 등급 체크리스트 → 전부 체크 → screen_2 재생 → 끝나기 전 페이드아웃 → water_1 + 타이틀
const ITEMS = [
  ['Disability', 'Features a woman who does not speak as the lead', 'High'],
  ['Race', 'Depicts a significant friendship between Black women', 'High'],
  ['LGBTQ+', 'Features a gay man as a main character', 'High'],
  ['Class', 'The story is led by cleaning staff', 'High'],
  ['Interspecies<br>Romance', 'Depicts love between a human and a non-human being', 'Very High'],
];
const FADE_MS = 1200;   // style.css --fade 와 같게
const SCREEN_SEC = 3.2; // screen_2 를 보여 주는 시간 (원본 8초)
const FADE_OUT_MS = 2200; // screen_2 → 검정 페이드아웃 시간

const list = document.getElementById('items');
list.innerHTML = ITEMS.map(([k, d, lv], i) => `
  <li><label class="item">
    <input type="checkbox" class="one" id="c${i}"><span class="box"></span>
    <span class="label">${k}</span>
    <span class="dots"></span>
    <span class="desc">${d}<small>, ${lv}</small></span>
  </label></li>`).join('');

const ones = [...document.querySelectorAll('.one')];
const allBox = document.getElementById('all-box');
ones.forEach((c) => c.addEventListener('change', () => {
  allBox.disabled = !ones.every((o) => o.checked);
  if (allBox.disabled) allBox.checked = false;
}));

const vScreen = document.getElementById('v-screen');
const vWater = document.getElementById('v-water');
const show = (id) => document.querySelectorAll('.screen').forEach((s) => s.classList.toggle('on', s.id === id));

const LEAVE_HOLD_MS = 7000;   // "나가기" 문구를 보여 주는 시간
const TITLE_HOLD_MS = 30000;  // 타이틀 화면 유지 시간 → 처음 화면으로

// ── 소리 (파일 없이 WebAudio로 합성): 체크 딸깍 · 영사기 돌아가는 소리
let ctx, master;
function audio() {
  if (!ctx) {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain(); master.gain.value = 1; master.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}
function noiseBuffer(sec) {
  const c = audio(), buf = c.createBuffer(1, c.sampleRate * sec, c.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return buf;
}
function tick() {
  const c = audio(), t = c.currentTime;
  const src = c.createBufferSource(); src.buffer = noiseBuffer(0.05);
  const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 2600; bp.Q.value = 3;
  const g = c.createGain(); g.gain.setValueAtTime(0.5, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
  src.connect(bp).connect(g).connect(master); src.start(t);
}
let projector = null;
function projectorOn() {
  if (projector) return;
  const c = audio(), t = c.currentTime;
  const out = c.createGain(); out.gain.setValueAtTime(0, t); out.gain.linearRampToValueAtTime(1, t + 1.2); out.connect(master);
  const src = c.createBufferSource(); src.buffer = noiseBuffer(2); src.loop = true;
  // 낮은 웅- 소리
  const hum = c.createBiquadFilter(); hum.type = 'bandpass'; hum.frequency.value = 220; hum.Q.value = 0.8;
  const humG = c.createGain(); humG.gain.value = 0.12;
  src.connect(hum).connect(humG).connect(out);
  // 초당 24번 딸딸딸 (필름 넘어가는 소리)
  const hi = c.createBiquadFilter(); hi.type = 'highpass'; hi.frequency.value = 2500;
  const clat = c.createGain(); clat.gain.value = 0;
  const lfo = c.createOscillator(); lfo.type = 'square'; lfo.frequency.value = 24;
  const lfoG = c.createGain(); lfoG.gain.value = 0.035;
  lfo.connect(lfoG).connect(clat.gain);
  src.connect(hi).connect(clat).connect(out);
  src.start(t); lfo.start(t);
  projector = { out, src, lfo };
}
function projectorOff(ms = 1500) {
  if (!projector) return;
  const p = projector, t = ctx.currentTime; projector = null;
  p.out.gain.cancelScheduledValues(t); p.out.gain.setValueAtTime(p.out.gain.value, t); p.out.gain.linearRampToValueAtTime(0, t + ms / 1000);
  setTimeout(() => { p.src.stop(); p.lfo.stop(); p.out.disconnect(); }, ms + 100);
}
[...ones, allBox].forEach((c) => c.addEventListener('change', tick));

// ── 흐름
let switched = false, holdTimer = 0;
const screenEl = document.getElementById('screen');

allBox.addEventListener('change', () => {
  if (!allBox.checked) return;
  document.body.classList.add('playing');
  projectorOn();
  show('screen');
  vScreen.currentTime = 0;
  vScreen.play();
});

document.getElementById('leave-btn').addEventListener('click', () => {
  tick();
  document.body.classList.add('playing');
  show('leave');
  holdTimer = setTimeout(reset, LEAVE_HOLD_MS);
});

// screen_2 를 SCREEN_SEC 만큼 보여 주고, 끝나기 FADE_OUT_MS 전에 검정으로 페이드아웃 → 이어서 water_1 + 타이틀 페이드인
function toTitle() {
  if (switched) return;
  switched = true;
  screenEl.style.transitionDuration = FADE_OUT_MS + 'ms';
  show(null);
  setTimeout(() => {
    vWater.currentTime = 0; vWater.play(); show('title');
    holdTimer = setTimeout(reset, TITLE_HOLD_MS);
  }, FADE_OUT_MS);
}
vScreen.addEventListener('timeupdate', () => {
  const end = Math.min(SCREEN_SEC, vScreen.duration || SCREEN_SEC);
  if (switched || vScreen.paused) return;
  if (end - vScreen.currentTime <= FADE_OUT_MS / 1000) toTitle();
});
vScreen.addEventListener('ended', toTitle);

// 처음 화면으로: 검정으로 페이드아웃 → 체크 전부 해제 → 체크리스트 페이드인
function reset() {
  clearTimeout(holdTimer);
  projectorOff(FADE_MS);
  show(null);
  setTimeout(() => {
    vScreen.pause(); vWater.pause();
    vScreen.currentTime = 0; vWater.currentTime = 0;
    ones.forEach((o) => { o.checked = false; });
    allBox.checked = false; allBox.disabled = true;
    switched = false;
    screenEl.style.transitionDuration = '';
    document.body.classList.remove('playing');
    show('check');
  }, FADE_MS + 200);
}
