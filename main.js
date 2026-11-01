/* ==========================================================
   Hero: فیلم کره زمین با لود خودکار,اسکرول شدن از پله ها تا در ورودی,هر فریم شماره گذاری شده تا 
   روی یه کنواس کشیده شه تا اسکرول نرم تر باشه
   ========================================================== */
(() => {
  'use strict';

  gsap.registerPlugin(ScrollTrigger);

  /* ---------- مسیر پوشه ها و تعداد فریم هر ویدئو ---------- */
  const CLIPS = {
    earth:  { dir: 'frames/earth/',  count: 90  },   // 3s  – autoplay intro
    stairs: { dir: 'frames/stairs/', count: 97  },   // 4s  – scroll #1
    hall:   { dir: 'frames/hall/',   count: 152 }    // 5s  – scroll #3 (starts at the glass doors)
  };
  // Scroll timeline (یعنی هر 1 واحد برابر یک ارتفاع صفحه اسکرول شه)
  const T_STAIRS = 2.5;            // مقدار اسکرول برای بالا رفتن از پله ها
  const T_DOOR   = 0.45;           // مقدار اسکرول برای عبور از در اصلی
  const T_HALL   = 3.2;            // مقدار اسکرول برای قدم زدن در راهروی اصلی
  const T_TOTAL  = T_STAIRS + T_DOOR + T_HALL;
  const CAPTION_RANGES = [[0, 0.35], [0.8, 2.1], [2.55, 3.5], [T_TOTAL - 0.7, T_TOTAL + 1]];
  const STEP_AT = [0, T_STAIRS, T_STAIRS + T_DOOR, T_TOTAL];
  const DOOR_ORIGIN = { x: 0.5, y: 0.42 };   // نقطه ای که دوربین موقع رد شدن از در اصلی به سمتش زوم میکنه
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- المان ها و وضعیت ---------- */
  const html      = document.documentElement;  //گرفتن المان های فایل html
  const hero      = document.getElementById('hero'); 
  const canvas    = document.getElementById('stage');
  const ctx       = canvas.getContext('2d');
  const loader    = document.getElementById('loader');
  const loaderBar = document.getElementById('loaderBar');
  const loaderTxt = document.getElementById('loaderText');
  const hint      = document.getElementById('hint');
  const hintText  = document.getElementById('hintText');
  const captions  = [...document.querySelectorAll('.caption')];
  const stepBtns  = [...document.querySelectorAll('#steps button')];
  const header    = document.getElementById('siteHeader');
  const burger    = document.getElementById('burger');
  const nav       = document.getElementById('mainNav');

  /* ---------- عنوان بخش وضعیتی که gsap انرا کنترل میکند ---------- */
  const st = {
    earth: 0,     // 0 … 89   شماره فریم ویدئو کره زمین
    intro: 1,     // 1 → 0    شروع
    stairs: 0,    // 0 … 96 شملره فریم پله ها
    push: 0,      // 0 → 1    پیشرفت عبور دوربین از در اصلی به در های شیشه ای
    hall: 0       // 0 … 151  شماره فریم سالن
  };

  let introTextOn = false;   // اولین تیتر بعد از فیلم کره زمین
  let ready = false;         // نشون میده انیمیشن اولیه تموم شده و همه فریم ها لود شدن
  let tl = null;
  let dirty = true;

  /* ---------- توابع کمکی و لود ---------- */
  const clamp  = (v, a, b) => Math.min(b, Math.max(a, v));
  const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const easeOut = t => 1 - Math.pow(1 - t, 3);
  const fa = n => Number(n).toLocaleString('fa-IR');
  const pad3 = n => String(n).padStart(3, '0');

  /* ---------- لود فریم ها ---------- */
  function loadClip(key, onProgress) {
    const { dir, count } = CLIPS[key];
    const frames = new Array(count);
    let done = 0;
    return new Promise(resolve => {
      for (let i = 0; i < count; i++) {
        const img = new Image();
        img.decoding = 'async';
        const finish = () => { done++; onProgress && onProgress(done / count); if (done === count) resolve(frames); };
        img.onload = finish;
        img.onerror = finish;
        img.src = `${dir}${pad3(i + 1)}.webp`;
        frames[i] = img;
      }
    });
  }

  const seq = { earth: [], stairs: [], hall: [] };

  function frameOf(list, f) {
    const n = list.length;
    if (!n) return null;
    let i = clamp(Math.round(f), 0, n - 1);
    if (list[i] && list[i].naturalWidth) return list[i];
    // اگر فریم خواسته شده لود نشد نزدیک ترین فریم نمایش داده بشه
    for (let d = 1; d < n; d++) {
      const a = list[i - d], b = list[i + d];
      if (a && a.naturalWidth) return a;
      if (b && b.naturalWidth) return b;
    }
    return null;
  }

  /* ---------- Canvas ---------- */
  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 1.75);
    const w = Math.min(Math.round(hero.clientWidth * dpr), 2400);
    const h = Math.round(w * hero.clientHeight / hero.clientWidth);
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w; canvas.height = h;
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
    }
    dirty = true;
  }

  // "object-fit: تابع رسم تصویر (ox, oy in 0‥1)
  function drawCover(img, alpha = 1, zoom = 1, ox = 0.5, oy = 0.5) {
    if (!img || alpha <= 0.002) return;
    const cw = canvas.width, ch = canvas.height;
    const r  = Math.max(cw / img.naturalWidth, ch / img.naturalHeight);
    const bw = img.naturalWidth * r, bh = img.naturalHeight * r;
    const bx = (cw - bw) / 2,        by = (ch - bh) / 2;
    const ax = ox * cw,              ay = oy * ch;
    ctx.globalAlpha = alpha;
    ctx.drawImage(img, ax - (ax - bx) * zoom, ay - (ay - by) * zoom, bw * zoom, bh * zoom);
    ctx.globalAlpha = 1;
  }

  function render() {
    dirty = false;
    ctx.fillStyle = '#0B0F0D';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const hallA = smooth(0.3, 0.98, st.push);

    // 1) دم در → زمین (لایه اول رسم)
    if (st.intro > 0.002) {
      drawCover(frameOf(seq.earth, st.earth), 1, 1 + 0.12 * (1 - st.intro));
    }
    // 2) لایه دوم پله ها تا در اصلی
    if (hallA < 0.999) {
      drawCover(frameOf(seq.stairs, st.stairs), 1 - st.intro, 1 + 1.25 * st.push * st.push, DOOR_ORIGIN.x, DOOR_ORIGIN.y);
    }
    // 3) در های شیشه ای تا سالن
    if (hallA > 0.002) {
      drawCover(frameOf(seq.hall, st.hall), hallA, 1.22 - 0.22 * easeOut(st.push));
    }
  }

  function tick() { if (dirty) render(); }
  gsap.ticker.add(tick);
  const invalidate = () => { dirty = true; };

  /* ---------- واکنش به اسکرول ---------- */
  let lastStop = -1;
  function onScroll(p) {            // رابط کاربری که بااسکرول تغیر میکند
    captions.forEach((el, i) => {
      const [a, b] = CAPTION_RANGES[i];
      const on = p >= a && p <= b && (i !== 0 || introTextOn);
      el.classList.toggle('is-active', on);
    });

    // پرش به نزدیک ترین نقطه کناری برای هایلایت کردنش
    let stop = 0, best = Infinity;
    STEP_AT.forEach((v, i) => { const d = Math.abs(p - v); if (d < best) { best = d; stop = i; } });
    if (stop !== lastStop) {
      lastStop = stop;
      stepBtns.forEach((b, i) => {
        b.classList.toggle('is-active', i === stop);
        b.classList.toggle('is-passed', i < stop);
        if (i === stop) b.setAttribute('aria-current', 'step'); else b.removeAttribute('aria-current');
      });
    }

    hint.classList.toggle('is-visible', introTextOn && p < T_TOTAL - 0.8);
  }

  // پرش نرم به مرحله اول/ "خانه"
  let jumpTween = null;
  function goTo(i) {
    if (!ready || !tl) return;
    const t = tl.scrollTrigger;
    const unit = (t.end - t.start) / T_TOTAL;
    const to = STEP_AT[clamp(i, 0, STEP_AT.length - 1)] * unit;
    const o = { y: window.scrollY };
    if (jumpTween) jumpTween.kill();
    jumpTween = gsap.to(o, {
      y: to,
      duration: reduceMotion ? 0.01 : clamp(Math.abs(to - o.y) / window.innerHeight * 0.55, 0.6, 3),
      ease: 'power2.inOut',
      onUpdate: () => window.scrollTo(0, o.y)
    });
  }
  // اگر کاربر وسط پرش اسکرول کرد پرش متوقف بشه
  ['wheel', 'touchstart'].forEach(ev => window.addEventListener(ev, () => { if (jumpTween) jumpTween.kill(); }, { passive: true }));

  /* ---------- اسکرول تایم لاینی ---------- */
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
        scrub: reduceMotion ? true : 0.6,      // کمی حرکت اسکرول را نرم میکند
        onUpdate: self => onScroll(self.progress * T_TOTAL)
      }
    });

    tl
      // 1) پله ها از اولین تا اخرین فریم با اسکرول جلو میرن
      .to(st, { intro: 0, duration: 0.3 }, 0)
      .to(st, { stairs: CLIPS.stairs.count - 1, duration: T_STAIRS }, 0)
      // 2) دوربین از در اصلی رد میشه تا به در های شیشه ای برسه
      .to(st, { push: 1, duration: T_DOOR }, T_STAIRS)
      // 3) ویدئو سالن تا اخر با اسکرول پیش میره
      .to(st, { hall: CLIPS.hall.count - 1, duration: T_HALL }, T_STAIRS + T_DOOR);
  }

  /* ---------- Intro + boot ---------- */
  function setLoader(frac, text) {
    loaderBar.style.width = Math.round(frac * 100) + '%';
    loaderTxt.textContent = text;
  }

  function releaseEarthFrames() {
    // لود اولیه و پخش لنیمیشن اغازین
    seq.earth.forEach((img, i) => { if (i < seq.earth.length - 1) img.src = ''; });
  }

  async function boot() {
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
    window.scrollTo(0, 0);
    html.classList.add('is-locked');
    resize();

    // 1) لود فریم های اولیه کره زمین 
    seq.earth = await loadClip('earth', f => setLoader(f, `در حال آماده‌سازی ورودی… ${fa(Math.round(f * 100))}٪`));
    st.earth = 0; dirty = true; render();

    // 2) پاک شدن فریم های کره زمین بعد از تموم شدن انیمیشن
    const restLoaded = Promise.all([loadClip('stairs'), loadClip('hall')]).then(([s, h]) => {
      seq.stairs = s; seq.hall = h;
    });

    loader.classList.add('is-done');

    // 3) پخش خودکار کره زمین تا در اموزشگاه
    await new Promise(resolve => {
      gsap.to(st, {
        earth: CLIPS.earth.count - 1,
        duration: CLIPS.earth.count / 30,
        ease: 'none',
        onUpdate: () => { invalidate(); if (!introTextOn && st.earth > CLIPS.earth.count - 14) { introTextOn = true; onScroll(0); } },
        onComplete: resolve
      });
    });
    introTextOn = true;

    // 4) لود شدن فریم های پله ها و سالن
    if (!seq.stairs.length) {
      hintText.textContent = 'در حال بارگذاری…';
      hint.classList.add('is-visible');
    }
    await restLoaded;
    hintText.textContent = 'اسکرول کنید';

    releaseEarthFrames();
    buildTimeline();
    ready = true;
    html.classList.remove('is-locked');
    ScrollTrigger.refresh();
    onScroll(0);
  }

  /* ---------- Navbar / header ---------- */
  // نوبار فقط وقتی نشون داده بشه که تمام انیمیشن ها تموم شده باشن
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

  // بازگرداندن کاربر از اخر به اول سایت
  const toTop = e => {
    e.preventDefault();
    closeMenu();
    goTo(0);
  };
  document.querySelectorAll('a[href="#hero"]').forEach(a => a.addEventListener('click', toTop));

  stepBtns.forEach(b => b.addEventListener('click', () => goTo(Number(b.dataset.go))));

  window.addEventListener('resize', () => { resize(); });

  boot();
})();
