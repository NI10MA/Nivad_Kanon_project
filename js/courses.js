/* یکپارچه‌سازی صفحه اصلی با بک‌اند جنگو و پنل مدیریت:
   دریافت داینامیک دوره‌های فعال، مربیان و وضعیت ورود کاربر بدون هیچ دوره دستی. */
(() => {
  "use strict";
  const API = "/api/public/";
  const $ = (s, r = document) => r.querySelector(s);
  const fa = n => new Intl.NumberFormat("fa-IR").format(Number(n || 0));

  const icons = {
    "قرآن": "fa-book-quran",
    "مهارت‌های زندگی": "fa-brain",
    "فن بیان و سخنوری": "fa-microphone-lines",
    "تئاتر و بازیگری": "fa-masks-theater",
    "هوش مصنوعی دختران": "fa-robot",
    "هوش مصنوعی پسران": "fa-microchip",
    "هوش مصنوعی": "fa-robot",
    "نقاشی": "fa-palette",
    "مهارت‌های کامپیوتری": "fa-laptop-code",
    "خوشنویسی": "fa-pen-nib",
    "زبان مبتدی": "fa-language",
    "موسیقی": "fa-music",
    "ریاضیات": "fa-calculator",
    "منبت‌کاری": "fa-hammer",
    "علوم آزمایشگاهی": "fa-flask",
    "تیراندازی آقایان": "fa-bullseye",
    "تکواندو پسران": "fa-hand-fist",
    "شطرنج": "fa-chess-knight",
    "تیراندازی بانوان": "fa-crosshairs",
    "تکواندو دختران": "fa-medal",
    "کاراته دختران": "fa-user-ninja",
    "ژیمناستیک پسران": "fa-person-running",
    "ژیمناستیک دختران": "fa-person-dress",
    "ایروبیک و پیلاتس": "fa-dumbbell",
    "بازی و ورزش کودکان": "fa-child-reaching",
    "ورزش سالمندان": "fa-person-walking"
  };

  function pickIcon(course) {
    if (icons[course.title]) return icons[course.title];
    for (const [key, val] of Object.entries(icons)) {
      if (String(course.title || "").includes(key)) return val;
    }
    return course.category === "sports" ? "fa-medal" : "fa-graduation-cap";
  }

  const colors = new Set(["blue", "purple", "orange", "green", "pink", "gold"]);

  async function request(path, options = {}) {
    const method = options.method || "GET";
    const headers = { Accept: "application/json" };
    const response = await fetch(API + path, { ...options, method, headers, credentials: "same-origin" });
    let data = {};
    try { data = await response.json(); } catch (_) {}
    if (!response.ok) throw new Error(data.error || `خطای سرور (${response.status})`);
    return data;
  }

  async function updateAuthHeader() {
    const link = $("#headerAuthLink");
    if (!link) return;
    try {
      const res = await fetch("/api/auth/me/", { credentials: "same-origin" });
      if (!res.ok) return;
      const data = await res.json();
      if (data.authenticated && data.user) {
        const name = data.user.full_name || data.user.username;
        if (data.user.role === "admin") {
          link.href = "dashboard/index.html";
          link.innerHTML = `<i class="fa-solid fa-gauge-high"></i><span>پنل مدیریت (${name})</span>`;
        } else {
          link.href = "dashboard-login.html";
          link.innerHTML = `<i class="fa-regular fa-user"></i><span>پنل کاربری (${name})</span>`;
        }
      }
    } catch (_) {}
  }

  function openCourseDialog(course) {
    const dlg = $("#courseDialog");
    if (!dlg) return;
    const titleEl = $("#dialogCourseTitle", dlg);
    const descEl = $("#dialogCourseDescription", dlg);
    const eyebrowEl = $(".course-dialog__eyebrow", dlg);
    const mode = course.delivery_mode === "online" ? "آنلاین" : "حضوری";
    const cat = course.category === "sports" ? "دوره ورزشی" : "دوره آموزشی";
    const rem = Math.max(0, Number(course.capacity || 0) - Number(course.enrolled || 0));

    if (eyebrowEl) eyebrowEl.textContent = `${cat} · ${mode} · ${course.level || "همه سطوح"}`;
    if (titleEl) titleEl.textContent = course.title;
    if (descEl) {
      const inst = course.instructor ? `\nمربی دوره: ${course.instructor}` : "";
      const cap = `\nظرفیت باقی‌مانده: ${fa(rem)} از ${fa(course.capacity)} نفر`;
      descEl.textContent = `${course.description || "برای مشاهده جزئیات و ثبت‌نام در این دوره اقدام کنید."}${inst}${cap}`;
      descEl.style.whiteSpace = "pre-line";
    }
    let regLink = $("#dialogEnrollLink", dlg);
    if (!regLink) {
      regLink = document.createElement("a");
      regLink.id = "dialogEnrollLink";
      regLink.className = "course-dialog__action";
      regLink.style.display = "inline-flex";
      regLink.style.alignItems = "center";
      regLink.style.marginLeft = "10px";
      regLink.style.textDecoration = "none";
      const closeBtn = $(".course-dialog__content .course-dialog__action", dlg);
      if (closeBtn) closeBtn.before(regLink);
    }
    regLink.href = `course-register.html?course=${encodeURIComponent(course.id)}`;
    regLink.textContent = "ثبت‌نام در این دوره ←";
    if (!dlg.open) dlg.showModal();
  }

  function createCard(course, panelType) {
    const article = document.createElement("article");
    article.className = "course-card";

    const visual = document.createElement("div");
    const color = colors.has(course.color) ? course.color : "blue";
    visual.className = `course-card__image course-card__image--${color}`;
    visual.style.cursor = "pointer";
    visual.title = "مشاهده اطلاعات دوره";
    visual.addEventListener("click", () => openCourseDialog(course));

    const label = document.createElement("span");
    label.className = "course-card__category";
    label.textContent = panelType === "sports" ? "ورزشی" : panelType === "online" ? "آنلاین" : "حضوری";
    visual.append(label);

    const icon = document.createElement("i");
    icon.className = `fa-solid ${pickIcon(course)} course-card__icon`;
    icon.setAttribute("aria-hidden", "true");
    visual.append(icon);

    const body = document.createElement("div");
    body.className = "course-card__body";

    const title = document.createElement("h4");
    title.textContent = course.title;
    title.style.cursor = "pointer";
    title.addEventListener("click", () => openCourseDialog(course));

    const desc = document.createElement("p");
    desc.textContent = course.description || "برای مشاهده جزئیات و ثبت‌نام در این دوره اقدام کنید.";

    const meta = document.createElement("div");
    meta.className = "course-card__meta";

    const level = document.createElement("span");
    level.textContent = course.level || "همه سطوح";
    meta.append(level);

    const rem = Math.max(0, Number(course.capacity || 0) - Number(course.enrolled || 0));
    const capSpan = document.createElement("span");
    capSpan.textContent = course.instructor ? `مربی: ${course.instructor}` : `ظرفیت خالی: ${fa(rem)} نفر`;
    meta.append(capSpan);

    const button = document.createElement("a");
    button.className = "course-card__button";
    button.href = `course-register.html?course=${encodeURIComponent(course.id)}`;
    button.innerHTML = `<span>ثبت‌نام و جزئیات دوره</span><span>←</span>`;

    body.append(title, desc, meta, button);
    article.append(visual, body);
    return article;
  }

  function setupCarousel(panel, courses) {
    const track = $(".course-track", panel);
    const dots = $(".carousel-dots", panel);
    const count = $("[data-course-count]", panel);
    if (!track || !dots) return;

    track.replaceChildren();
    dots.replaceChildren();
    if (count) count.textContent = `${fa(courses.length)} دوره`;

    const prev = $("[data-carousel-prev]", panel);
    const next = $("[data-carousel-next]", panel);

    if (!courses.length) {
      track.style.transform = "translateX(0%)";
      const empty = document.createElement("p");
      empty.className = "course-empty-state";
      empty.textContent = "در حال حاضر دوره‌ای در این بخش از پنل مدیریت ثبت نشده است.";
      track.append(empty);
      if (prev) prev.disabled = true;
      if (next) next.disabled = true;
      return;
    }

    const pages = [];
    for (let i = 0; i < courses.length; i += 3) {
      pages.push(courses.slice(i, i + 3));
    }

    let current = 0;
    pages.forEach((items, i) => {
      const slide = document.createElement("div");
      slide.className = "course-slide";
      items.forEach(c => slide.append(createCard(c, panel.dataset.coursePanel)));
      track.append(slide);

      const dot = document.createElement("button");
      dot.type = "button";
      dot.className = "carousel-dot";
      dot.setAttribute("aria-label", `صفحه ${fa(i + 1)}`);
      dot.addEventListener("click", () => go(i));
      dots.append(dot);
    });

    function go(n) {
      if (!pages.length) return;
      current = Math.max(0, Math.min(n, pages.length - 1));
      track.style.transform = `translateX(-${current * 100}%)`;
      [...dots.children].forEach((d, i) => {
        d.classList.toggle("is-active", i === current);
        d.classList.toggle("active", i === current);
      });
      if (prev) prev.disabled = current === 0;
      if (next) next.disabled = current === pages.length - 1;
    }

    if (prev) prev.onclick = () => go(current - 1);
    if (next) next.onclick = () => go(current + 1);
    go(0);
  }

  async function loadCourses() {
    try {
      const { courses = [] } = await request("courses/");
      document.querySelectorAll("[data-course-panel]").forEach(panel => {
        const type = panel.dataset.coursePanel;
        const rows = courses.filter(c =>
          type === "sports"
            ? c.category === "sports"
            : type === "online"
              ? c.category !== "sports" && c.delivery_mode === "online"
              : c.category !== "sports" && c.delivery_mode !== "online"
        );
        setupCarousel(panel, rows);
      });
    } catch (e) {
      console.error("بارگذاری دوره‌ها ناموفق بود:", e);
      document.querySelectorAll(".course-track").forEach(x => {
        x.innerHTML = '<p class="course-empty-state">برای مشاهده دوره‌ها، سرور بک‌اند را اجرا کرده و از پنل مدیریت دوره‌ها را ثبت کنید.</p>';
      });
    }
  }

  async function loadInstructors() {
    const host = $(".mentors-list");
    const btn = $("#showMentorsBtn");
    if (!host) return;
    try {
      const { instructors = [] } = await request("instructors/");
      host.replaceChildren();
      if (!instructors.length) {
        const empty = document.createElement("div");
        empty.className = "course-empty-state";
        empty.style.gridColumn = "1 / -1";
        empty.textContent = "هنوز مربی فعالی در پنل مدیریت ثبت نشده است.";
        host.append(empty);
        if (btn) btn.hidden = true;
        return;
      }
      instructors.forEach((i, index) => {
        const card = document.createElement("div");
        card.className = "mentor-card" + (index >= 4 ? " extra-mentor" : "");

        const icon = document.createElement("i");
        icon.className = "fa-solid fa-user-tie mentor-avatar";

        const info = document.createElement("div");
        info.className = "mentor-info";

        const name = document.createElement("h3");
        name.textContent = i.full_name;

        const specialty = document.createElement("p");
        specialty.textContent = i.specialty || "مربی کانون";

        const bio = document.createElement("span");
        bio.textContent = i.bio || "مربی رسمی کانون";

        const rating = document.createElement("div");
        rating.className = "mentor-rating";
        rating.textContent = "★ 5.0";

        info.append(name, specialty, bio);
        card.append(icon, info, rating);
        host.append(card);
      });
      if (btn) btn.hidden = instructors.length <= 4;
    } catch (e) {
      console.error("بارگذاری مربیان ناموفق بود:", e);
      host.innerHTML = '<div class="course-empty-state" style="grid-column: 1 / -1;">اطلاعات مربیان پس از اتصال به سرور نمایش داده می‌شود.</div>';
    }
  }

  function setupBooking() {
    document.querySelectorAll("[data-reservation]").forEach(btn =>
      btn.addEventListener("click", () => {
        location.href = `hall-booking.html?hall=${encodeURIComponent(btn.dataset.reservation)}`;
      })
    );
  }

  document.addEventListener("DOMContentLoaded", () => {
    const courseDialog = $("#courseDialog");
    document.querySelectorAll("[data-dialog-close]").forEach(b =>
      b.addEventListener("click", () => courseDialog?.close())
    );
    courseDialog?.addEventListener("click", e => {
      if (e.target === courseDialog) courseDialog.close();
    });
    updateAuthHeader();
    loadCourses();
    loadInstructors();
    setupBooking();
  });
})();
