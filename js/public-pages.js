/* منطق صفحات عمومی:
   - فهرست دوره‌ها (courses.html)
   - جزئیات دوره (course-detail.html)
   - ثبت‌نام دوره‌ها (course-register.html) با انتقال خودکار اطلاعات دانش‌آموز به لیست حضور و غیاب کلاس در پنل مدیریت
   - رزرو خوابگاه (accommodation.html)
   - رزرو سالن (hall-booking.html)
*/
(() => {
  "use strict";
  const API = "/api/public/";
  const $ = (s, root = document) => root.querySelector(s);
  const fa = n => new Intl.NumberFormat("fa-IR").format(Number(n || 0));
  const esc = value =>
    String(value ?? "").replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));

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

  const genderLabel = { male: "پسران", female: "دختران", mixed: "مختلط / خانواده" };

  function csrf() {
    try {
      const m = (document.cookie || "").match(/(?:^|;\s*)csrftoken=([^;]+)/);
      return m ? decodeURIComponent(m[1]) : "";
    } catch (_) {
      return "";
    }
  }

  async function api(path, options = {}) {
    const method = options.method || "GET";
    const headers = { Accept: "application/json" };
    if (method !== "GET") {
      headers["Content-Type"] = "application/json";
      headers["X-CSRFToken"] = csrf();
    }
    const response = await fetch(API + path, { ...options, method, headers, credentials: "same-origin" });
    let data = {};
    try { data = await response.json(); } catch (_) {}
    if (!response.ok) {
      const e = new Error(data.error || `خطای سرور (${response.status})`);
      e.status = response.status;
      throw e;
    }
    return data;
  }

  async function loadSessionUser() {
    try {
      const res = await fetch("/api/auth/me/", { credentials: "same-origin" });
      if (!res.ok) return null;
      const data = await res.json();
      const link = $("#headerAuthLink");
      if (data.authenticated && data.user) {
        const u = data.user;
        if (link) {
          const name = u.full_name || u.username;
          if (u.role === "admin") {
            link.href = "dashboard/index.html";
            link.innerHTML = `<i class="fa-solid fa-gauge-high"></i><span>پنل مدیریت (${esc(name)})</span>`;
          } else {
            link.href = "dashboard-login.html";
            link.innerHTML = `<i class="fa-regular fa-user"></i><span>پنل کاربری (${esc(name)})</span>`;
          }
        }
        // پیش‌پر کردن فیلدهای فرم فقط برای کاربران عادی (دانش‌آموزان) تا ادمین هنگام تست فرم دچار تداخل نشود
        if (u.role !== "admin") {
          ["#enrFullName", "#stayFullName", "#hallFullName"].forEach(sel => {
            const el = $(sel);
            if (el && !el.value && u.full_name) el.value = u.full_name;
          });
          ["#enrPhone", "#stayPhone", "#hallPhone"].forEach(sel => {
            const el = $(sel);
            if (el && !el.value && u.phone) el.value = u.phone;
          });
          ["#enrNationalCode", "#stayNationalCode", "#hallNationalCode"].forEach(sel => {
            const el = $(sel);
            if (el && !el.value && u.national_code) el.value = u.national_code;
          });
        }
        return u;
      }
    } catch (_) {}
    return null;
  }

  function setupMobileBurger() {
    const burger = $("#burger");
    const nav = $("#mainNav");
    if (!burger || !nav) return;
    const closeMenu = () => {
      burger.setAttribute("aria-expanded", "false");
      nav.classList.remove("is-open");
    };
    burger.addEventListener("click", () => {
      const open = burger.getAttribute("aria-expanded") !== "true";
      burger.setAttribute("aria-expanded", String(open));
      nav.classList.toggle("is-open", open);
    });
    document.addEventListener("keydown", e => { if (e.key === "Escape") closeMenu(); });
    nav.addEventListener("click", e => { if (e.target.closest("a")) closeMenu(); });
  }

  function courseCard(c) {
    const mode = c.delivery_mode === "online" ? "آنلاین" : "حضوری";
    const category = c.category === "sports" ? "ورزشی" : "آموزشی";
    const remaining = Math.max(0, Number(c.capacity || 0) - Number(c.enrolled || 0));
    return `
      <article class="public-course-card">
        <div class="public-card-visual">
          <span class="public-card-badge">${category} · ${mode}</span>
          <i class="fa-solid ${pickIcon(c)}"></i>
        </div>
        <div class="public-card-body">
          <h2>${esc(c.title)}</h2>
          <p>${esc(c.description || "برای دریافت اطلاعات بیشتر و ثبت‌نام در این دوره اقدام کنید.")}</p>
          <div class="public-card-meta">
            <span>سطح: ${esc(c.level || "همه سطوح")}</span>
            ${c.instructor ? `<span>مربی: ${esc(c.instructor)}</span>` : ""}
            <span>ظرفیت خالی: ${fa(remaining)} از ${fa(c.capacity)} نفر</span>
          </div>
          <div class="public-card-actions">
            <a class="public-card-link" href="course-register.html?course=${encodeURIComponent(c.id)}">
              ثبت‌نام دوره <i class="fa-solid fa-user-plus"></i>
            </a>
            <a class="public-card-link public-card-link--gold" href="course-detail.html?id=${encodeURIComponent(c.id)}">
              جزئیات
            </a>
          </div>
        </div>
      </article>
    `;
  }

  async function coursesPage() {
    const host = $("#publicCourses");
    if (!host) return;
    let all = [];
    try {
      const data = await api("courses/");
      all = data.courses || [];
      const count = $("#courseCount");
      const draw = filter => {
        const rows = all.filter(c =>
          filter === "all" ||
          (filter === "online" || filter === "in_person" ? c.delivery_mode === filter : c.category === filter)
        );
        if (count) count.textContent = `${fa(rows.length)} دوره فعال`;
        host.innerHTML = rows.length
          ? rows.map(courseCard).join("")
          : '<div class="public-empty">در حال حاضر دوره فعالی در این دسته‌بندی ثبت نشده است. مدیر می‌تواند از طریق «پنل مدیریت ← مدیریت دوره‌ها» دوره جدید اضافه کند.</div>';
      };

      const initialFilter = new URLSearchParams(location.search).get("filter") || "all";
      document.querySelectorAll("[data-filter]").forEach(b => {
        b.classList.toggle("active", b.dataset.filter === initialFilter);
        b.addEventListener("click", () => {
          document.querySelectorAll("[data-filter]").forEach(x => x.classList.toggle("active", x === b));
          draw(b.dataset.filter);
        });
      });
      draw(initialFilter);
    } catch (e) {
      host.innerHTML = `<div class="public-empty">${esc(e.message)}<br>لطفاً پس از اطمینان از روشن بودن سرور جنگو دوباره تلاش کنید.</div>`;
    }
  }

  async function courseDetailPage() {
    const host = $("#courseDetail");
    if (!host) return;
    const id = new URLSearchParams(location.search).get("id");
    if (!id || !/^\d+$/.test(id)) {
      host.innerHTML = '<a class="back-link" href="courses.html">← بازگشت به فهرست دوره‌ها</a><div class="public-empty">شناسه دوره معتبر نیست.</div>';
      return;
    }
    try {
      const data = await api("courses/");
      const c = (data.courses || []).find(x => String(x.id) === id);
      if (!c) {
        host.innerHTML = '<a class="back-link" href="courses.html">← بازگشت به فهرست دوره‌ها</a><div class="public-empty">این دوره پیدا نشد یا در حال حاضر فعال نیست.</div>';
        return;
      }
      const mode = c.delivery_mode === "online" ? "آنلاین" : "حضوری";
      const cat = c.category === "sports" ? "ورزشی" : "آموزشی";
      const remaining = Math.max(0, Number(c.capacity) - Number(c.enrolled));
      host.innerHTML = `
        <a class="back-link" href="courses.html">← بازگشت به فهرست دوره‌ها</a>
        <article class="detail-card">
          <div class="detail-visual"><i class="fa-solid ${pickIcon(c)}"></i></div>
          <div class="detail-copy">
            <span class="public-kicker">${cat} · ${mode}</span>
            <h1>${esc(c.title)}</h1>
            <p>${esc(c.description || "توضیحات تکمیلی این دوره توسط کانون ارائه خواهد شد.")}</p>
            <div class="detail-stats">
              <span>سطح: ${esc(c.level || "همه سطوح")}</span>
              <span>مربی: ${esc(c.instructor || "اعلام در شروع دوره")}</span>
              <span>ظرفیت کل: ${fa(c.capacity)} نفر</span>
              <span>ظرفیت باقی‌مانده: ${fa(remaining)} نفر</span>
            </div>
            <div class="detail-actions">
              <a class="public-submit" href="course-register.html?course=${encodeURIComponent(c.id)}" ${remaining <= 0 ? 'style="pointer-events:none;opacity:.55"' : ""}>
                ${remaining <= 0 ? "ظرفیت تکمیل است" : "تکمیل فرم ثبت‌نام این دوره"}
                <i class="fa-solid fa-arrow-left"></i>
              </a>
              <span class="detail-note">پس از تکمیل فرم ثبت‌نام، مشخصات دانش‌آموز به صورت خودکار وارد لیست حضور و غیاب کلاس می‌شود.</span>
            </div>
          </div>
        </article>
      `;
    } catch (e) {
      host.innerHTML = `<a class="back-link" href="courses.html">← بازگشت به فهرست دوره‌ها</a><div class="public-empty">دریافت اطلاعات دوره ممکن نشد: ${esc(e.message)}</div>`;
    }
  }

  async function courseRegisterPage() {
    const form = $("#courseRegisterForm");
    const select = $("#courseSelect");
    const preview = $("#selectedCoursePreview");
    if (!form || !select) return;

    let courses = [];
    const preselectedId = new URLSearchParams(location.search).get("course");

    const renderOptions = selectedVal => {
      if (!courses.length) {
        select.innerHTML = '<option value="">در حال حاضر دوره فعالی در پنل مدیریت تعریف نشده است</option>';
        return;
      }
      select.innerHTML =
        '<option value="">دوره مورد نظر خود را انتخاب کنید…</option>' +
        courses
          .map(c => {
            const rem = Math.max(0, Number(c.capacity) - Number(c.enrolled));
            const mode = c.delivery_mode === "online" ? "آنلاین" : "حضوری";
            return `<option value="${c.id}" ${rem <= 0 ? "disabled" : ""}>${esc(c.title)} (${mode} — ظرفیت خالی: ${fa(rem)} نفر)</option>`;
          })
          .join("");
      if (selectedVal && courses.some(c => String(c.id) === String(selectedVal))) {
        select.value = String(selectedVal);
      }
    };

    const updatePreview = () => {
      if (!preview) return;
      const c = courses.find(x => String(x.id) === String(select.value));
      if (!c) {
        preview.innerHTML = "با انتخاب دوره از فهرست، جزئیات مربی، شیوه برگزاری و ظرفیت آن در این بخش نمایش داده می‌شود.";
        return;
      }
      const mode = c.delivery_mode === "online" ? "آنلاین" : "حضوری";
      const cat = c.category === "sports" ? "ورزشی" : "آموزشی";
      const rem = Math.max(0, Number(c.capacity) - Number(c.enrolled));
      preview.innerHTML = `
        <strong>دوره انتخابی: ${esc(c.title)}</strong><br>
        دسته: ${cat} (${mode}) · سطح: ${esc(c.level || "همه سطوح")}<br>
        مربی: ${esc(c.instructor || "اعلام از سوی کانون")} · ظرفیت خالی: <strong>${fa(rem)} از ${fa(c.capacity)} نفر</strong>
      `;
    };

    try {
      const data = await api("courses/");
      courses = data.courses || [];
      renderOptions(preselectedId);
      updatePreview();
    } catch (e) {
      select.innerHTML = `<option value="">خطا در دریافت فهرست دوره‌ها</option>`;
    }

    select.addEventListener("change", updatePreview);

    form.addEventListener("submit", async e => {
      e.preventDefault();
      const msg = $("#courseRegisterFeedback");
      const btn = form.querySelector('[type="submit"]');
      const d = Object.fromEntries(new FormData(form));
      const chosenCourseId = d.course;

      if (!chosenCourseId) {
        msg.textContent = "لطفاً ابتدا دوره آموزشی یا ورزشی مورد نظر را انتخاب کنید.";
        msg.className = "form-feedback error";
        return;
      }

      btn.disabled = true;
      msg.textContent = "";
      msg.className = "form-feedback";
      try {
        await loadSessionUser();
        const r = await api(`courses/${encodeURIComponent(chosenCourseId)}/enroll/`, {
          method: "POST",
          body: JSON.stringify({
            course: Number(chosenCourseId),
            full_name: d.full_name,
            national_code: d.national_code,
            phone: d.phone,
            grade: d.grade,
            school_name: d.school_name,
            note: d.note,
          }),
        });
        msg.textContent = r.message || "ثبت‌نام شما با موفقیت انجام شد و به لیست حضور و غیاب کلاس اضافه گردید.";
        msg.className = "form-feedback success";
        form.reset();
        await loadSessionUser();
        try {
          const refreshed = await api("courses/");
          courses = refreshed.courses || [];
          renderOptions(chosenCourseId);
        } catch (_) {}
        updatePreview();
      } catch (err) {
        msg.textContent = err.message;
        msg.className = "form-feedback error";
      } finally {
        btn.disabled = false;
      }
    });
  }

  function setMinDates() {
    const today = new Date();
    const local = new Date(today.getTime() - today.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
    document.querySelectorAll('input[type="date"]').forEach(x => {
      x.min = local;
      if (!x.value && x.name === "booking_date") x.value = local;
    });
  }

  async function hallForm() {
    const form = $("#hallForm");
    if (!form) return;
    const params = new URLSearchParams(location.search);
    const hall = params.get("hall");
    if (hall && ["سالن اجتماعات", "سالن کنفرانس"].includes(hall)) {
      $("#hallType").value = hall;
    }

    document.querySelectorAll("[data-pick-hall]").forEach(btn => {
      btn.addEventListener("click", () => {
        $("#hallType").value = btn.dataset.pickHall;
        form.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    });

    setMinDates();
    form.addEventListener("submit", async e => {
      e.preventDefault();
      const msg = $("#hallFeedback");
      const b = form.querySelector('[type="submit"]');
      const d = Object.fromEntries(new FormData(form));

      if (d.end_time <= d.start_time) {
        msg.textContent = "ساعت پایان باید بعد از ساعت شروع باشد.";
        msg.className = "form-feedback error";
        return;
      }

      b.disabled = true;
      msg.textContent = "";
      msg.className = "form-feedback";
      try {
        await loadSessionUser();
        const r = await api("bookings/", {
          method: "POST",
          body: JSON.stringify({
            ...d,
            attendees: Number(d.attendees || 1),
          }),
        });
        msg.textContent = r.message;
        msg.className = "form-feedback success";
        form.reset();
        setMinDates();
        await loadSessionUser();
      } catch (err) {
        msg.textContent = err.message;
        msg.className = "form-feedback error";
      } finally {
        b.disabled = false;
      }
    });
  }

  async function accommodationPage() {
    const host = $("#accommodationList");
    const form = $("#stayForm");
    if (!host || !form) return;
    setMinDates();
    let places = [];

    try {
      const data = await api("accommodations/");
      places = data.accommodations || [];
      const select = $("#accommodationSelect");
      select.innerHTML =
        '<option value="">اقامتگاه مورد نظر را انتخاب کنید…</option>' +
        places
          .map(
            a =>
              `<option value="${a.id}" data-gender="${a.gender}">${esc(a.name)} — ${
                genderLabel[a.gender] || ""
              } (ظرفیت خالی: ${fa(a.available)} نفر)</option>`
          )
          .join("");

      host.innerHTML = places.length
        ? places
            .map(
              a => `
          <article class="accommodation-card">
            <div class="public-card-visual">
              <span class="public-card-badge">${genderLabel[a.gender] || "عمومی"}</span>
              <i class="fa-solid fa-bed"></i>
            </div>
            <div class="public-card-body">
              <h3>${esc(a.name)}</h3>
              <p>${esc(a.address || "آدرس از طریق کانون اعلام می‌شود.")}</p>
              <div class="public-card-meta">
                <span>مخصوص: ${genderLabel[a.gender] || ""}</span>
                <span>ظرفیت کل: ${fa(a.capacity)} نفر</span>
                <span>ظرفیت خالی امروز: ${fa(a.available)} نفر</span>
              </div>
              <button class="public-card-link" type="button" data-select-accommodation="${a.id}" data-gender="${a.gender}">
                انتخاب این اقامتگاه برای رزرو <i class="fa-solid fa-arrow-left"></i>
              </button>
            </div>
          </article>`
            )
            .join("")
        : '<div class="public-empty">هنوز اقامتگاه فعالی در پنل مدیریت تعریف نشده است.</div>';

      host.querySelectorAll("[data-select-accommodation]").forEach(b =>
        b.addEventListener("click", () => {
          select.value = b.dataset.selectAccommodation;
          const g = b.dataset.gender;
          const gSel = $("#stayGenderSelect");
          if (gSel && g) {
            gSel.value = g === "mixed" ? "family" : g;
          }
          form.scrollIntoView({ behavior: "smooth", block: "start" });
        })
      );
    } catch (e) {
      host.innerHTML = `<div class="public-empty">دریافت اقامتگاه‌ها ممکن نشد: ${esc(e.message)}</div>`;
    }

    form.addEventListener("submit", async e => {
      e.preventDefault();
      const msg = $("#stayFeedback");
      const b = form.querySelector('[type="submit"]');
      const fd = new FormData(form);
      const d = Object.fromEntries(fd);

      if (!d.accommodation) {
        msg.textContent = "لطفاً اقامتگاه مورد نظر خود را انتخاب کنید.";
        msg.className = "form-feedback error";
        return;
      }
      if (d.check_out <= d.check_in) {
        msg.textContent = "تاریخ خروج باید بعد از تاریخ ورود باشد.";
        msg.className = "form-feedback error";
        return;
      }

      b.disabled = true;
      msg.textContent = "";
      msg.className = "form-feedback";
      try {
        await loadSessionUser();
        const r = await api("stays/", {
          method: "POST",
          body: JSON.stringify({
            ...d,
            accommodation: Number(d.accommodation),
            guests_count: Number(d.guests_count || 1),
            needs_catering: fd.has("needs_catering"),
          }),
        });
        msg.textContent = r.message;
        msg.className = "form-feedback success";
        form.reset();
        setMinDates();
        await loadSessionUser();
      } catch (err) {
        msg.textContent = err.message;
        msg.className = "form-feedback error";
      } finally {
        b.disabled = false;
      }
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    setupMobileBurger();
    loadSessionUser();
    coursesPage();
    courseDetailPage();
    courseRegisterPage();
    hallForm();
    accommodationPage();
  });
})();
