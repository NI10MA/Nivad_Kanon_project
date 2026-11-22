/* ==========================================================
   Hero: سفر اسکرولی از کره زمین تا سالن اصلی آموزشگاه

   ۱) کره زمین  : با اسکرول زوم میکنه تا سردر آموزشگاه  (مکث)
   ۲) پله‌ها     : با اسکرول از پله‌ها بالا میره تا در اصلی (مکث)
   ۳) سالن      : از درهای شیشه‌ای تا سالن اصلی

   • همه فریم‌های هر سه ویدئو نمایش داده میشن (بدون حذف فریم)
   • هر فریم یک عکس WebP کامل ۱۹۲۰×۱۰۸۰ هست که روی canvas کشیده میشه
   • لود تدریجی: اول چند فریم پراکنده از کل مسیر میاد (سایت فوری کار میکنه)
     بعد فریم‌های بین اونها پر میشن تا همه فریم‌ها کامل بشه
   ========================================================== */
(() => {
  'use strict';

  gsap.registerPlugin(ScrollTrigger);

  /* ==========================================================
     تنظیمات (برای تغییر سرعت و حس اسکرول فقط همین بخش رو عوض کن)
     ========================================================== */

  /* ---------- مسیر پوشه‌ها و تعداد دقیق فریم‌های موجود در هر پوشه ---------- */
  const CLIPS = {
    earth:  { dir: 'frames/earth/',  count: 122 },   // کره زمین تا سردر آموزشگاه (001..178)
    stairs: { dir: 'frames/stairs/', count: 192 },   // بالا رفتن از پله‌ها (001..154)
    hall:   { dir: 'frames/hall/',   count: 233 }    // درهای شیشه‌ای تا سالن اصلی (001..152)
  };

  /* ---------- «هر چند فریم در یک صفحه اسکرول» ----------
     عدد بزرگ‌تر = فریم‌ها سریع‌تر رد میشن (اسکرول کوتاه‌تر)
     عدد کوچک‌تر = حرکت آروم‌تر و سینمایی‌تر (اسکرول بلندتر)     */
  const FRAMES_PER_SCREEN = {
    earth:  55,
    stairs: 70,
    hall:   55
  };

  /* ---------- مکث‌ها: تصویر چند لحظه ثابت میمونه تا کاربر خوب ببینه ----------
     (بر حسب ارتفاع صفحه اسکرول؛ ۰ = بدون مکث)                                  */
  const HOLD_SIGN = 0.7;    // مکث روی سردر آموزشگاه
  const HOLD_DOOR = 0.7;    // مکث روی در اصلی (بالای پله‌ها)

  /* ---------- نرمی اسکرول ---------- */
  const SMOOTH = 0.08;      // چرخ ماوس: ۰.۰۵ خیلی نرم‌تر و کندتر … ۰.۲ تندتر
  const SCRUB  = 0.8;       // دنبال کردن اسکرول توسط تصویر (ثانیه): بیشتر = لطیف‌تر

  /* ---------- مدت هر مرحله روی تایم‌لاین (۱ واحد = یک ارتفاع صفحه اسکرول) ---------- */
  const T_EARTH  = (CLIPS.earth.count  - 1) / FRAMES_PER_SCREEN.earth;
  const T_LINK   = 0.4;                                              // محو شدن سردر به ابتدای پله‌ها
  const T_STAIRS = (CLIPS.stairs.count - 1) / FRAMES_PER_SCREEN.stairs;
  const T_DOOR   = 0.45;                                             // عبور از در اصلی به درهای شیشه‌ای
  const T_HALL   = (CLIPS.hall.count   - 1) / FRAMES_PER_SCREEN.hall;

  // نقطه شروع هر مرحله روی تایم‌لاین
  const AT_LINK       = T_EARTH + HOLD_SIGN;       // شروع محو شدن سردر به پله‌ها
  const AT_STAIRS     = AT_LINK + T_LINK;          // شروع بالا رفتن از پله‌ها
  const AT_STAIRS_END = AT_STAIRS + T_STAIRS;      // رسیدن به در اصلی
  const AT_DOOR       = AT_STAIRS_END + HOLD_DOOR; // شروع عبور از در
  const AT_HALL       = AT_DOOR + T_DOOR;          // شروع قدم زدن در سالن
  const T_TOTAL       = AT_HALL + T_HALL;

  // بازه نمایش هر تیتر [شروع، پایان]
  const CAPTION_RANGES = [
    [0, 0.6],
    [AT_STAIRS + 0.15, AT_STAIRS_END - 0.3],
    [AT_STAIRS_END + 0.05, AT_HALL + 1.2],
    [T_TOTAL - 0.7, T_TOTAL + 1]
  ];

  const DOOR_ORIGIN = { x: 0.5, y: 0.42 };   // نقطه‌ای که دوربین موقع رد شدن از در اصلی به سمتش زوم میکنه
  const CONCURRENCY = 12;                     // تعداد دانلود هم‌زمان
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- المان‌ها ---------- */
  const hero      = document.getElementById('hero');
  const canvas    = document.getElementById('stage');
  const ctx       = canvas.getContext('2d', { alpha: false });
  const loader    = document.getElementById('loader');
  const loaderBar = document.getElementById('loaderBar');
  const loaderTxt = document.getElementById('loaderText');
  const hint      = document.getElementById('hint');
  const hintText  = document.getElementById('hintText');
  const captions  = [...document.querySelectorAll('.caption')];
  const header    = document.getElementById('siteHeader');
  const burger    = document.getElementById('burger');
  const nav       = document.getElementById('mainNav');

  /* ---------- وضعیتی که gsap کنترل میکنه ---------- */
  const st = {
    earth:  0,   // شماره فریم کره زمین
    link:   0,   // ۰ → ۱  محو شدن از سردر به ابتدای پله‌ها
    stairs: 0,   // شماره فریم پله‌ها
    push:   0,   // ۰ → ۱  عبور دوربین از در اصلی به درهای شیشه‌ای
    hall:   0    // شماره فریم سالن
  };

  let dirty = true;          // یعنی canvas باید دوباره کشیده بشه
  let ready = false;         // اسکرول فعاله
  let tl = null;             // تایم‌لاین اسکرول

  /* ---------- توابع کمکی ---------- */
  const clamp   = (v, a, b) => Math.min(b, Math.max(a, v));
  const smooth  = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const easeOut = t => 1 - Math.pow(1 - t, 3);
  const fa      = n => Number(n).toLocaleString('fa-IR');          // عدد فارسی
  const pad3    = n => String(n).padStart(3, '0');                 // ۱ → 001
  const invalidate = () => { dirty = true; };

  /* ==========================================================
     لود و دیکود فریم‌ها
     ========================================================== */
  const store   = { earth: [], stairs: [], hall: [] };
  const cache   = { earth: new Map(), stairs: new Map(), hall: new Map() };
  const pending = { earth: new Set(), stairs: new Set(), hall: new Set() };
  const lastPos = { earth: 0, stairs: 0, hall: 0 };
  const dirOf   = { earth: 1, stairs: 1, hall: 1 };

  function loadFrame(key, i) {
    const url = `${CLIPS[key].dir}${pad3(i + 1)}.webp`;
    return fetch(url)
      .then(r => { if (!r.ok) throw new Error(r.status); return r.blob(); })
      .then(blob => { store[key][i] = blob; })
      .catch(() => new Promise(resolve => {
        const img = new Image();
        img.onload = img.onerror = () => { store[key][i] = img; resolve(); };
        img.src = url;
      }));
  }

  function runPool(tasks, limit = CONCURRENCY) {
    let next = 0;
    const worker = async () => { while (next < tasks.length) await tasks[next++](); };
    return Promise.all(Array.from({ length: Math.min(limit, tasks.length) }, worker));
  }

  function buildLoadTasks(onDone) {
    const tasks = [], queued = {};
    for (const key in CLIPS) queued[key] = new Set();
    for (const step of [8, 4, 2, 1]) {
      for (const key in CLIPS) {
        const n = CLIPS[key].count;
        for (let i = 0; i < n; i++) {
          if (i % step !== 0 && i !== n - 1) continue;
          if (queued[key].has(i)) continue;
          queued[key].add(i);
          tasks.push(() => loadFrame(key, i).then(() => { onDone(); invalidate(); }));
        }
      }
    }
    return tasks;
  }

  const MAX_INFLIGHT = 4;
  let inflight = 0;
  function decode(key, i) {
    if (cache[key].has(i)) return Promise.resolve();
    const src = store[key][i];
    if (!src || pending[key].has(i) || inflight >= MAX_INFLIGHT) return Promise.resolve();

    if (!(src instanceof Blob)) {
      if (src.naturalWidth) cache[key].set(i, src);
      return Promise.resolve();
    }
    pending[key].add(i);
    inflight++;
    return createImageBitmap(src)
      .then(bm => { cache[key].set(i, bm); })
      .catch(() => {})
      .finally(() => { pending[key].delete(i); inflight--; invalidate(); });
  }

  function nearestStored(key, c) {
    const n = CLIPS[key].count, list = store[key];
    let a = -1, b = -1;
    for (let i = c; i >= 0; i--)    if (list[i]) { a = i; break; }
    for (let j = c + 1; j < n; j++) if (list[j]) { b = j; break; }
    return [a, b];
  }

  function warm(key, f, active) {
    const n = CLIPS[key].count;
    const c = clamp(Math.floor(f), 0, n - 1);
    if (f > lastPos[key] + 0.01) dirOf[key] = 1;
    else if (f < lastPos[key] - 0.01) dirOf[key] = -1;
    lastPos[key] = f;

    const span = active ? 16 : 2;
    const tail = active ? 6  : 1;
    let lo = c - (dirOf[key] > 0 ? tail : span);
    let hi = c + (dirOf[key] > 0 ? span : tail) + 1;

    const [a, b] = nearestStored(key, c);
    if (a >= 0) lo = Math.min(lo, a);
    if (b >= 0) hi = Math.max(hi, b);

    const need = [];
    for (let i = Math.max(0, lo); i <= Math.min(n - 1, hi); i++) need.push(i);
    need.sort((x, y) => Math.abs(x - f) - Math.abs(y - f));
    need.forEach(i => decode(key, i));

    const cap = active ? 28 : 6;
    const map = cache[key];
    if (map.size > cap) {
      [...map.keys()]
        .sort((x, y) => Math.abs(y - f) - Math.abs(x - f))
        .slice(0, map.size - cap)
        .forEach(i => { const bm = map.get(i); if (bm.close) bm.close(); map.delete(i); });
    }
  }

  /* ==========================================================
     Canvas
     ========================================================== */
  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.min(Math.round(hero.clientWidth * dpr), 2560);
    const h = Math.round(w * hero.clientHeight / hero.clientWidth);
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w; canvas.height = h;
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
    }
    invalidate();
  }

  function drawCover(img, alpha = 1, zoom = 1, ox = 0.5, oy = 0.5) {
    if (!img || alpha <= 0.002) return;
    const iw = img.naturalWidth || img.width;
    const ih = img.naturalHeight || img.height;
    const cw = canvas.width, ch = canvas.height;
    const r  = Math.max(cw / iw, ch / ih);
    const bw = iw * r,  bh = ih * r;
    const bx = (cw - bw) / 2, by = (ch - bh) / 2;
    const ax = ox * cw,       ay = oy * ch;
    ctx.globalAlpha = alpha;
    ctx.drawImage(img, ax - (ax - bx) * zoom, ay - (ay - by) * zoom, bw * zoom, bh * zoom);
    ctx.globalAlpha = 1;
  }

  function drawClip(key, f, alpha = 1, zoom = 1, ox = 0.5, oy = 0.5) {
    const map = cache[key], n = CLIPS[key].count;
    const i0 = clamp(Math.floor(f), 0, n - 1);
    let a = -1, b = -1;
    for (let i = i0; i >= 0; i--)    if (map.has(i)) { a = i; break; }
    for (let j = i0 + 1; j < n; j++) if (map.has(j)) { b = j; break; }

    if (a < 0 && b < 0) return;
    if (a < 0) return drawCover(map.get(b), alpha, zoom, ox, oy);
    drawCover(map.get(a), alpha, zoom, ox, oy);
    if (b >= 0) {
      const t = clamp((f - a) / (b - a), 0, 1);
      if (t > 0.02) drawCover(map.get(b), alpha * t, zoom, ox, oy);
    }
  }

  function render() {
    dirty = false;

    const hallA      = smooth(0.3, 0.98, st.push);
    const showEarth  = st.link < 0.999;
    const showStairs = st.link > 0.002 && hallA < 0.999;
    const showHall   = hallA > 0.002;

    warm('earth',  st.earth,  showEarth);
    warm('stairs', st.stairs, showStairs);
    warm('hall',   st.hall,   showHall);

    if ((showEarth && !cache.earth.size) || (showStairs && !cache.stairs.size) || (showHall && !cache.hall.size)) {
      setTimeout(invalidate, 40);
      return;
    }

    ctx.fillStyle = '#0B0F0D';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (showEarth) {
      drawClip('earth', st.earth, 1, 1 + 0.1 * easeOut(st.link));
    }
    if (showStairs) {
      const intro = 1 + 0.08 * (1 - st.link);
      drawClip('stairs', st.stairs, smooth(0, 1, st.link), intro * (1 + 1.25 * st.push * st.push), DOOR_ORIGIN.x, DOOR_ORIGIN.y);
    }
    if (showHall) {
      drawClip('hall', st.hall, hallA, 1.22 - 0.22 * easeOut(st.push));
    }
  }

  gsap.ticker.add(() => { if (dirty) render(); });

  /* ==========================================================
     واکنش رابط کاربری به اسکرول
     ========================================================== */
  function onScroll(p) {
    captions.forEach((el, i) => {
      const [a, b] = CAPTION_RANGES[i];
      el.classList.toggle('is-active', p >= a && p <= b);
    });
    hint.classList.toggle('is-visible', p < T_TOTAL - 0.8);
  }

  let jumpTween = null;
  function scrollToTop() {
    if (!ready) return;
    const o = { y: window.scrollY };
    if (jumpTween) jumpTween.kill();
    jumpTween = gsap.to(o, {
      y: 0,
      duration: reduceMotion ? 0.01 : clamp(o.y / window.innerHeight * 0.3, 0.6, 3.5),
      ease: 'power2.inOut',
      onUpdate: () => window.scrollTo(0, o.y)
    });
  }
  ['wheel', 'touchstart'].forEach(ev =>
    window.addEventListener(ev, () => { if (jumpTween) jumpTween.kill(); }, { passive: true })
  );

  /* ==========================================================
     اسکرول نرم (فقط برای چرخ ماوس)
     ========================================================== */
  let wheelTarget = 0, wheelCur = 0, wheelBusy = false;

  function initSmoothWheel() {
    if (reduceMotion || window.matchMedia('(pointer: coarse)').matches) return;

    const maxScroll = () => document.documentElement.scrollHeight - window.innerHeight;
    wheelTarget = wheelCur = window.scrollY;

    window.addEventListener('wheel', e => {
      if (!ready || e.ctrlKey) return;
      e.preventDefault();
      if (!wheelBusy) wheelTarget = wheelCur = window.scrollY;
      const unit = e.deltaMode === 1 ? 32 : e.deltaMode === 2 ? window.innerHeight : 1;
      wheelTarget = clamp(wheelTarget + e.deltaY * unit, 0, maxScroll());
      wheelBusy = true;
    }, { passive: false });

    gsap.ticker.add((time, dt) => {
      if (!wheelBusy) return;
      const k = 1 - Math.pow(1 - SMOOTH, dt / 16.667);
      wheelCur += (wheelTarget - wheelCur) * k;
      if (Math.abs(wheelTarget - wheelCur) < 0.4) { wheelCur = wheelTarget; wheelBusy = false; }
      window.scrollTo(0, wheelCur);
    });
  }

  /* ==========================================================
     تایم‌لاین اسکرول
     ========================================================== */
  function buildTimeline() {
    tl = gsap.timeline({
      defaults: { ease: 'none' },
      onUpdate: () => { invalidate(); setHeader(tl.progress() >= 0.999); },
      scrollTrigger: {
        trigger: hero,
        start: 'top top',
        end: '+=' + Math.round(T_TOTAL * 100) + '%',
        pin: true,
        anticipatePin: 1,
        scrub: reduceMotion ? true : SCRUB,
        onUpdate: self => onScroll(self.progress * T_TOTAL)
      }
    });

    tl
      .fromTo(st, { earth: 0 }, { earth: CLIPS.earth.count - 1, duration: T_EARTH }, 0)
      .fromTo(st, { link: 0 }, { link: 1, duration: T_LINK }, AT_LINK)
      .fromTo(st, { stairs: 0 }, { stairs: CLIPS.stairs.count - 1, duration: T_STAIRS }, AT_STAIRS)
      .fromTo(st, { push: 0 }, { push: 1, duration: T_DOOR }, AT_DOOR)
      .fromTo(st, { hall: 0 }, { hall: CLIPS.hall.count - 1, duration: T_HALL }, AT_HALL);
  }

  /* ==========================================================
     شروع
     ========================================================== */
  function setLoader(frac, text) {
    loaderBar.style.width = Math.round(frac * 100) + '%';
    loaderTxt.textContent = text;
  }

  async function boot() {
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
    window.scrollTo(0, 0);
    resize();

    const total = CLIPS.earth.count + CLIPS.stairs.count + CLIPS.hall.count;
    let loaded = 0;
    runPool(buildLoadTasks(() => {
      loaded++;
      hintText.textContent = loaded >= total ? 'اسکرول کنید' : `در حال بارگذاری… ${fa(Math.round(loaded / total * 100))}٪`;
    }));

    await new Promise(res => {
      const t = setInterval(() => { if (store.earth[0]) { clearInterval(t); res(); } }, 20);
    });
    await decode('earth', 0);
    setLoader(1, 'آماده‌ایم…');
    invalidate(); render();
    loader.classList.add('is-done');

    buildTimeline();
    initSmoothWheel();
    ready = true;
    document.documentElement.classList.remove('is-locked');
    ScrollTrigger.refresh();
    onScroll(0);
  }

  /* ==========================================================
     Navbar / header
     ========================================================== */
  function setHeader(show) {
    header.classList.toggle('is-hidden', !show);
    if (!show) closeMenu();
  }

  function closeMenu() {
    burger.setAttribute('aria-expanded', 'false');
    nav.classList.remove('is-open');
  }

  burger.addEventListener('click', () => {
    const open = burger.getAttribute('aria-expanded') !== 'true';
    burger.setAttribute('aria-expanded', String(open));
    nav.classList.toggle('is-open', open);
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeMenu(); });
  nav.addEventListener('click', e => { if (e.target.closest('a')) closeMenu(); });

  document.querySelectorAll('a[href="#hero"]').forEach(a => a.addEventListener('click', e => {
    e.preventDefault();
    closeMenu();
    scrollToTop();
  }));

  window.addEventListener('resize', resize);

  boot();
})();
