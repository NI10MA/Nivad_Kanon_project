/* Data layer for the dashboard.
 *
 * Two interchangeable back-ends with the same interface:
 *   - RemoteAPI: talks to the Django API (same origin, session cookie + CSRF).
 *   - DemoAPI:   keeps sample data in localStorage so the UI can be previewed
 *                without a server (used only when explicitly enabled).
 */
// لایه‌ی دسترسی به داده‌ی داشبورد: دو پیاده‌سازی هم‌رابط (RemoteAPI برای سرور جنگو و DemoAPI برای نمایش آزمایشی با localStorage).
"use strict";

// خطای اختصاصی API: علاوه بر پیام، کد وضعیت HTTP و خطای فیلدها را هم نگه می‌دارد (status=0 یعنی اتصال به سرور برقرار نشد).
class ApiError extends Error {
  constructor(message, status, fields) { super(message); this.status = status; this.fields = fields || {}; }
}

/* ───────────────────────── Remote (Django) ───────────────────────── */
// ارتباط با API جنگو (هم‌مبدأ؛ احراز هویت با کوکی نشست و محافظت CSRF)
const RemoteAPI = {
  mode: "remote",

  // خواندن توکن CSRF از کوکی برای ارسال در هدر درخواست‌های غیر GET
  _csrf() {
    const m = (function(){try{return document.cookie||""}catch(_){return ""}})().match(/(?:^|;\s*)csrftoken=([^;]+)/);
    return m ? decodeURIComponent(m[1]) : "";
  },

  // درخواست عمومی به سرور: JSON می‌فرستد/می‌گیرد و خطاها را به ApiError تبدیل می‌کند.
  async _req(method, path, body) {
    const opts = { method, credentials: "same-origin", headers: { "Accept": "application/json" } };
    // درخواست‌های تغییردهنده (POST/PUT/DELETE) باید JSON و توکن CSRF داشته باشند.
    if (method !== "GET") {
      opts.headers["Content-Type"] = "application/json";
      opts.headers["X-CSRFToken"] = this._csrf();
      opts.body = JSON.stringify(body || {});
    }
    let res;
    try { res = await fetch("/api" + path, opts); }
    // خطای شبکه (مثلاً سرور خاموش است)
    catch (e) { throw new ApiError("ارتباط با سرور برقرار نشد.", 0); }
    let data = null;
    try { data = await res.json(); } catch (e) { /* non-JSON */ }
    if (!res.ok) throw new ApiError((data && data.error) || "خطای سرور (" + res.status + ")", res.status, data && data.fields);
    return data;
  },

  // بررسی اینکه پشت این صفحه واقعاً API جنگو وجود دارد (پاسخ JSON می‌دهد) یا نه.
  /* Is there a Django API behind this page? */
  async probe() {
    try {
      const res = await fetch("/api/auth/me/", { credentials: "same-origin" });
      const ct = res.headers.get("content-type") || "";
      return res.ok && ct.includes("json");
    } catch (e) { return false; }
  },

  // احراز هویت: وضعیت کاربر فعلی، ورود و خروج
  me() { return this._req("GET", "/auth/me/"); },
  login(username, password) { return this._req("POST", "/auth/login/", { username, password }); },
  logout() { return this._req("POST", "/auth/logout/"); },

  // عملیات CRUD عمومی روی منابع (courses, users, stays, ...): فهرست، ساخت، ویرایش و حذف
  _base(res) { return "/dashboard/" + res + "/"; },
  async list(res) { return (await this._req("GET", this._base(res))).items; },
  create(res, data) { return this._req("POST", this._base(res), data); },
  update(res, id, data) { return this._req("PUT", this._base(res) + id + "/", data); },
  remove(res, id) { return this._req("DELETE", this._base(res) + id + "/"); },

  // دانش‌آموزان ثبت‌نام‌شده‌ی یک دوره: دریافت و جایگزینی کامل فهرست
  async getEnrollments(courseId) { return (await this._req("GET", "/dashboard/courses/" + courseId + "/enrollments/")).student_ids; },
  setEnrollments(courseId, ids) { return this._req("PUT", "/dashboard/courses/" + courseId + "/enrollments/", { student_ids: ids }); },

  // حضور و غیاب: دریافت لیست یک دوره در یک روز و ذخیره‌ی وضعیت‌ها
  async getAttendance(courseId, date) {
    return (await this._req("GET", "/dashboard/attendance/?course=" + encodeURIComponent(courseId) + "&date=" + encodeURIComponent(date))).records;
  },
  saveAttendance(courseId, date, records) { return this._req("POST", "/dashboard/attendance/", { course: courseId, date, records }); },

  // آمار و گزارش‌های داشبورد
  reports() { return this._req("GET", "/dashboard/reports/"); },
};

/* ───────────────────────── Demo (localStorage) ───────────────────────── */
// حالت نمایشی: داده‌ی نمونه در localStorage مرورگر نگه‌داری می‌شود (بدون نیاز به سرور).
// توجه: در boot فعلی app.js استفاده نمی‌شود و فقط رابط ابتدایی آن (me/login/logout) باقی مانده است.
const DemoAPI = {
  mode: "demo",
  // کلید ذخیره در localStorage؛ با تغییر ساختار داده، شماره‌ی نسخه باید بالا برود.
  KEY: "nivad_dashboard_demo_v2",
  db: null,

  // توابع کمکی تاریخ: تبدیل به YYYY-MM-DD (با منطقه‌ی زمانی محلی)، امروز و امروز±n روز
  _iso(d) { const z = new Date(d.getTime() - d.getTimezoneOffset() * 60000); return z.toISOString().slice(0, 10); },
  _today() { return this._iso(new Date()); },
  _addDays(n) { const d = new Date(); d.setDate(d.getDate() + n); return this._iso(d); },

  // ساخت داده‌ی اولیه‌ی نمایشی (یک مدیر و سه اقامتگاه؛ بقیه خالی)
  _seed() {
    const instructors = [];
    const courses = [];
    const users = [{ id: 1, username: "admin", full_name: "مدیر سیستم", phone: "", national_code: "", role: "admin", is_active: true, joined: this._addDays(-120) }];
    const enrollments = {};
    const enrollmentRows = [];
    const attendance = [];
    const accommodations = [
      { id: 1, name: "خوابگاه پسرانه شهید بهشتی", address: "همدان، بلوار آیت‌الله کاشانی", gender: "male", capacity: 40, is_active: true },
      { id: 2, name: "خوابگاه دخترانه حضرت معصومه (س)", address: "همدان، خیابان مهدیه", gender: "female", capacity: 36, is_active: true },
      { id: 3, name: "مهمانسرا و سوئیت فرهنگیان", address: "همدان، میدان فلسطین", gender: "mixed", capacity: 16, is_active: true },
    ];
    const stays = [];
    const bookings = [];
    return {
      // نسخه‌ی ساختار داده و شمارنده‌ی شناسه‌ی بعدی هر جدول
      v: 2,
      seq: { instructors: 10, courses: 10, users: 10, accommodations: 10, stays: 10, bookings: 10, enrollments: 10 },
      instructors, courses, users, enrollments, enrollmentRows, attendance, accommodations, stays, bookings,
    };
  },

  // بارگذاری داده از localStorage؛ اگر نبود یا خراب بود، داده‌ی اولیه ساخته می‌شود.
  load() {
    try { const raw = localStorage.getItem(this.KEY); if (raw) { this.db = JSON.parse(raw); return; } } catch (e) { /* ignore */ }
    this.db = this._seed();
    this._persist();
  },
  // ذخیره‌ی داده؛ در حالت خصوصی مرورگر ممکن است خطا بدهد که نادیده گرفته می‌شود.
  _persist() { try { localStorage.setItem(this.KEY, JSON.stringify(this.db)); } catch (e) { /* private mode */ } },
  // پاک‌کردن داده‌ها و ساخت دوباره‌ی داده‌ی نمونه
  reset() { try { localStorage.removeItem(this.KEY); } catch (e) { /* ignore */ } this.db = this._seed(); this._persist(); },

  // نمایشی: همیشه مدیر وارد شده فرض می‌شود.
  async me() { return { authenticated: true, user: this.db.users[0] }; },
  async login() { return { user: this.db.users[0] }; },
  async logout() { return { ok: true }; },
};
