// منطق اصلی داشبورد مدیریت (رابط کاربری): مسیریابی، جدول‌ها، فرم‌ها و نمودارها.
// داده‌ها از طریق شیء api (تعریف‌شده در api.js) دریافت و ذخیره می‌شوند.
"use strict";

/* ───────────── helpers ───────────── */
const $ = (sel, root = document) => root.querySelector(sel);
const fa = n => new Intl.NumberFormat("fa-IR").format(Number(n || 0));
const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const faDate = iso => {
  if (!iso) return "";
  try { return new Intl.DateTimeFormat("fa-IR-u-ca-persian", { dateStyle: "medium" }).format(new Date(iso.slice(0, 10) + "T00:00:00")); }
  catch (e) { return iso; }
};
const todayISO = () => { const d = new Date(); return new Date(d - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); };

const LABELS = {
  category: { educational: "آموزشی", sports: "ورزشی" },
  delivery_mode: { in_person: "حضوری", online: "آنلاین" },
  role: { admin: "مدیر", student: "کاربر" },
  gender: { male: "پسران", female: "دختران", mixed: "مختلط / خانواده", family: "خانواده / مختلط" },
  room_type: { dorm: "اتاق خوابگاهی گروهی", suite: "سوئیت اختصاصی", vip: "اتاق ویژه مهمان" },
  color: { blue: "آبی", purple: "بنفش", orange: "نارنجی", green: "سبز", pink: "صورتی", gold: "طلایی" },
  status: { pending: "در انتظار بررسی", approved: "تأیید شده", rejected: "رد شده" },
};

let api = null;
let currentUser = null;

function toast(msg, isError) {
  const t = $("#toast");
  t.textContent = msg;
  t.classList.toggle("error", !!isError);
  t.classList.add("show");
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.remove("show"), 2800);
}

/* ───────────── dialogs ───────────── */
const dlg = $("#dlg");
dlg.addEventListener("click", e => { if (e.target === dlg) dlg.close(); });

function openDialog({ title, body, foot }) {
  dlg.innerHTML =
    `<div class="dlg__head"><h2>${esc(title)}</h2><button class="icon-btn" type="button" data-close aria-label="بستن">✕</button></div>` +
    `<div class="dlg__body">${body}</div>` + (foot ? `<div class="dlg__foot">${foot}</div>` : "");
  dlg.querySelector("[data-close]").onclick = () => dlg.close();
  if (!dlg.open) dlg.showModal();
  return dlg;
}

function confirmBox(message, okLabel = "حذف") {
  return new Promise(resolve => {
    openDialog({ title: "تأیید", body: `<p>${esc(message)}</p>`,
      foot: `<button class="btn btn--danger" data-ok type="button">${esc(okLabel)}</button><button class="btn" data-no type="button">انصراف</button>` });
    let done = false;
    const finish = v => { if (!done) { done = true; resolve(v); } };
    dlg.querySelector("[data-ok]").onclick = () => { finish(true); dlg.close(); };
    dlg.querySelector("[data-no]").onclick = () => dlg.close();
    dlg.addEventListener("close", () => finish(false), { once: true });
  });
}

/* Generic form dialog. fields: [{name,label,type,options,required,full,ltr,hint}] */
function formDialog({ title, fields, values = {}, submitLabel = "ذخیره", onSubmit, onOpen }) {
  const input = f => {
    const v = values[f.name];
    const attrs = `name="${esc(f.name)}"${f.required ? " required" : ""}${f.ltr ? ' dir="ltr"' : ""}`;
    if (f.type === "checkbox") {
      const checked = v === undefined ? (f.defaultChecked !== false) : !!v;
      return `<label class="check ${f.full ? "full" : ""}"><input type="checkbox" ${attrs} ${checked ? "checked" : ""}>${esc(f.label)}</label>`;
    }
    let control;
    if (f.type === "select") {
      const opts = (f.options || []).map(o => `<option value="${esc(o.value)}" ${String(o.value) === String(v == null ? "" : v) ? "selected" : ""}>${esc(o.label)}</option>`).join("");
      control = `<select ${attrs}>${f.required ? "" : `<option value="">${esc(f.emptyLabel || "—")}</option>`}${opts}</select>`;
    } else if (f.type === "textarea") {
      control = `<textarea ${attrs} rows="3">${esc(v)}</textarea>`;
    } else {
      control = `<input type="${f.type || "text"}" ${attrs} value="${esc(v)}"${f.type === "number" ? ' min="1"' : ""} ${f.type === "password" ? 'autocomplete="new-password"' : ""}>`;
    }
    return `<label class="${f.full ? "full" : ""}">${esc(f.label)}${f.required ? " *" : ""}${control}${f.hint ? `<small class="muted">${esc(f.hint)}</small>` : ""}</label>`;
  };
  openDialog({
    title,
    body: `<form id="dlgForm" novalidate><div class="form-grid">${fields.map(input).join("")}</div><p class="form-error" role="alert"></p></form>`,
    foot: `<button class="btn btn--primary" type="submit" form="dlgForm">${esc(submitLabel)}</button><button class="btn" type="button" data-cancel>انصراف</button>`,
  });
  const form = $("#dlgForm", dlg), errBox = $(".form-error", form);
  dlg.querySelector("[data-cancel]").onclick = () => dlg.close();
  if (onOpen) onOpen(form);
  const first = form.querySelector("input,select,textarea"); if (first) first.focus();
  form.addEventListener("submit", async e => {
    e.preventDefault();
    errBox.textContent = "";
    const data = {};
    fields.forEach(f => {
      const el = form.elements[f.name];
      data[f.name] = f.type === "checkbox" ? el.checked : el.value.trim ? el.value.trim() : el.value;
    });
    for (const f of fields) {
      if (f.required && f.type !== "checkbox" && data[f.name] === "") { errBox.textContent = `«${f.label}» الزامی است.`; form.elements[f.name].focus(); return; }
    }
    const btn = dlg.querySelector('[type="submit"]'); btn.disabled = true;
    try { await onSubmit(data); dlg.close(); }
    catch (err) { errBox.textContent = err.message || "خطا در ذخیره‌سازی."; if (err.status === 401) showGate(); }
    finally { btn.disabled = false; }
  });
}

/* ───────────── generic table / CRUD ───────────── */
function tableHTML(cols, rows, withActions) {
  if (!rows.length) return `<div class="table-wrap"><div class="empty">موردی برای نمایش وجود ندارد.</div></div>`;
  return `<div class="table-wrap"><table><thead><tr>${cols.map(c => `<th>${esc(c.label)}</th>`).join("")}${withActions ? "<th></th>" : ""}</tr></thead><tbody>` +
    rows.map(r => `<tr data-id="${r.id}">${cols.map(c => `<td>${c.cell(r)}</td>`).join("")}${withActions ? `<td class="actions">${withActions(r)}</td>` : ""}</tr>`).join("") +
    `</tbody></table></div>`;
}

const bar = (value, max, extra = "") => {
  const pct = max > 0 ? Math.min(100, Math.round(value * 100 / max)) : 0;
  return `<div class="bar ${pct >= 100 ? "full" : ""} ${extra}" role="img" aria-label="${fa(pct)} درصد"><i style="width:${pct}%"></i></div>`;
};
const activeBadge = r => r.is_active ? `<span class="badge badge--ok">فعال</span>` : `<span class="badge badge--bad">غیرفعال</span>`;
const statusBadge = s => {
  const cls = s === "approved" ? "badge--ok" : s === "rejected" ? "badge--bad" : "badge--warn";
  return `<span class="badge ${cls}">${esc(LABELS.status[s] || s)}</span>`;
};

async function crud(host, cfg) {
  let rows = [], q = "";
  const reload = async () => { rows = await api.list(cfg.res); draw(); };
  const matches = r => !q || cfg.searchKeys.some(k => String(r[k] == null ? "" : r[k]).toLowerCase().includes(q));

  function draw() {
    const shown = rows.filter(matches);
    $(".crud-body", host).innerHTML = tableHTML(cfg.columns, shown, r =>
      (cfg.extraActions ? cfg.extraActions(r) : "") +
      `<button class="btn btn--sm" data-act="edit" type="button">ویرایش</button> <button class="btn btn--sm btn--danger" data-act="del" type="button">حذف</button>`);
    $(".crud-count", host).textContent = fa(shown.length) + " مورد";
  }

  async function openForm(row) {
    const fields = typeof cfg.fields === "function" ? await cfg.fields(!!row) : cfg.fields;
    formDialog({
      title: row ? cfg.editTitle : cfg.addTitle,
      fields,
      values: row || cfg.defaults || {},
      onOpen: cfg.onFormOpen ? form => cfg.onFormOpen(form, row) : undefined,
      onSubmit: async data => {
        const payload = { ...data };
        if (cfg.prepare) cfg.prepare(payload, !!row);
        if (row) await api.update(cfg.res, row.id, payload); else await api.create(cfg.res, payload);
        toast(row ? "تغییرات ذخیره شد." : "با موفقیت اضافه شد.");
        await reload();
        if (cfg.onChange) cfg.onChange();
      },
    });
  }

  host.innerHTML =
    `<div class="toolbar"><input class="search" type="search" placeholder="جستجو…" aria-label="جستجو"><span class="muted crud-count"></span><span class="spacer"></span>` +
    `${cfg.allowCreate === false ? "" : `<button class="btn btn--primary" data-add type="button">+ ${esc(cfg.addLabel)}</button>`}</div><div class="crud-body"></div>`;
  $(".search", host).addEventListener("input", e => { q = e.target.value.trim().toLowerCase(); draw(); });
  const addButton = $("[data-add]", host);
  if (addButton) addButton.onclick = () => openForm(null).catch(e => toast(e.message, true));
  host.onclick = async e => {
    const btn = e.target.closest("[data-act]"); if (!btn) return;
    const id = Number(btn.closest("tr").dataset.id), row = rows.find(r => r.id === id);
    try {
      if (btn.dataset.act === "edit") await openForm(row);
      else if (btn.dataset.act === "del") {
        if (await confirmBox(cfg.deleteMessage(row))) { await api.remove(cfg.res, id); toast("حذف شد."); await reload(); }
      } else if (cfg.onAction) await cfg.onAction(btn.dataset.act, row, reload);
    } catch (err) { toast(err.message, true); if (err.status === 401) showGate(); }
  };
  await reload();
}

/* ───────────── views ───────────── */
const ICONS = {
  overview: '<path d="M3 12 12 3l9 9M5 10v10h5v-6h4v6h5V10"/>',
  courses: '<path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2zM4 19V5M9 7h6"/>',
  enrollments: '<path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 7M18 14.5a6 6 0 0 1 3.5 5.5"/>',
  instructors: '<circle cx="12" cy="7" r="3.5"/><path d="M5 21a7 7 0 0 1 14 0M9 14l3 3 3-3"/>',
  accommodations: '<path d="M3 20V9l9-6 9 6v11M3 20h18M9 20v-6h6v6"/>',
  bookings: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 8h10M7 12h6M7 16h4"/>',
  attendance: '<rect x="4" y="4" width="16" height="17" rx="2"/><path d="M8 2v4M16 2v4M8.5 13l2.5 2.5 4.5-5"/>',
  reports: '<path d="M4 20V4M4 20h16M8 16v-5M13 16V8M18 16v-3"/>',
};

const VIEWS = [
  { id: "overview", title: "نمای کلی", render: viewOverview },
  { id: "courses", title: "مدیریت دوره‌ها", render: viewCourses },
  { id: "enrollments", title: "ثبت‌نام‌های دوره", render: viewEnrollments },
  { id: "attendance", title: "حضور و غیاب", render: viewAttendance },
  { id: "instructors", title: "مدیریت مربیان", render: viewInstructors },
  { id: "accommodations", title: "مدیریت خوابگاه", render: viewAccommodations },
  { id: "bookings", title: "رزروهای سالن", render: viewBookings },
  { id: "users", title: "مدیریت کاربران", render: viewUsers },
  { id: "reports", title: "گزارش‌ها", render: viewReports },
];

/* — hall bookings — */
async function viewBookings(host) {
  await crud(host, {
    res: "bookings", allowCreate: true, addLabel: "ثبت رزرو سالن", addTitle: "ثبت رزرو سالن جدید", editTitle: "بررسی و ویرایش درخواست رزرو سالن",
    searchKeys: ["user_name", "full_name", "national_code", "organization", "hall", "event_title", "phone", "equipment"],
    columns: [
      { label: "درخواست‌دهنده", cell: r => `<strong>${esc(r.full_name || r.user_name)}</strong><div class="muted" style="font-size:12px">${esc(r.organization || "—")} ${r.national_code ? `· کد ملی: ${esc(r.national_code)}` : ""}</div>` },
      { label: "سالن / برنامه", cell: r => `<strong>${esc(r.hall)}</strong><div class="muted">${esc(r.event_title)}</div>${r.equipment ? `<div class="muted" style="font-size:11px">تجهیزات: ${esc(r.equipment)}</div>` : ""}` },
      { label: "تاریخ و ساعت", cell: r => `${esc(faDate(r.booking_date))} · ${esc(r.start_time)} تا ${esc(r.end_time)}` },
      { label: "تعداد / تماس", cell: r => `${fa(r.attendees)} نفر<div class="muted num" dir="ltr" style="font-size:12px">${esc(r.phone)}</div>` },
      { label: "وضعیت", cell: r => statusBadge(r.status) },
    ],
    fields: () => [
      { name: "hall", label: "نوع سالن", type: "select", required: true, options: [{ value: "سالن اجتماعات", label: "سالن اجتماعات" }, { value: "سالن کنفرانس", label: "سالن کنفرانس" }] },
      { name: "event_title", label: "عنوان برنامه / رویداد", required: true },
      { name: "full_name", label: "نام و نام خانوادگی متقاضی", required: true },
      { name: "national_code", label: "کد ملی", ltr: true },
      { name: "organization", label: "سازمان / مدرسه / واحد درخواست‌کننده" },
      { name: "phone", label: "شماره تماس", required: true, ltr: true },
      { name: "booking_date", label: "تاریخ برگزاری", type: "date", required: true },
      { name: "attendees", label: "تعداد شرکت‌کنندگان", type: "number", required: true },
      { name: "start_time", label: "ساعت شروع", type: "time", required: true },
      { name: "end_time", label: "ساعت پایان", type: "time", required: true },
      { name: "equipment", label: "تجهیزات مورد نیاز", full: true },
      { name: "status", label: "وضعیت درخواست", type: "select", required: true, options: [{ value: "pending", label: "در انتظار بررسی" }, { value: "approved", label: "تأیید شده" }, { value: "rejected", label: "رد شده" }] },
      { name: "note", label: "توضیحات / یادداشت مدیر", type: "textarea", full: true },
    ],
    defaults: { hall: "سالن اجتماعات", booking_date: todayISO(), attendees: 30, status: "pending" },
    deleteMessage: r => `درخواست رزرو «${r.event_title}» حذف شود؟`,
  });
}

/* — courses — */
async function viewCourses(host) {
  const instructors = await api.list("instructors");
  const instOpts = instructors.filter(i => i.is_active).map(i => ({ value: i.id, label: i.full_name }));
  await crud(host, {
    res: "courses", addLabel: "دوره جدید", addTitle: "دوره جدید", editTitle: "ویرایش دوره",
    searchKeys: ["title", "instructor_name", "level"],
    columns: [
      { label: "عنوان", cell: r => `<strong>${esc(r.title)}</strong><div class="muted" style="font-size:12px">${esc(r.level)}</div>` },
      { label: "دسته", cell: r => esc(LABELS.category[r.category] || r.category) },
      { label: "شیوه", cell: r => esc(LABELS.delivery_mode[r.delivery_mode] || "حضوری") },
      { label: "مربی", cell: r => esc(r.instructor_name || "—") },
      { label: "ظرفیت", cell: r => `<div class="num" style="font-size:13px">${fa(r.enrolled)} از ${fa(r.capacity)}</div>${bar(r.enrolled, r.capacity)}` },
      { label: "وضعیت", cell: activeBadge },
    ],
    fields: () => [
      { name: "title", label: "عنوان دوره", required: true, full: true },
      { name: "category", label: "دسته", type: "select", required: true, options: Object.entries(LABELS.category).map(([value, label]) => ({ value, label })) },
      { name: "delivery_mode", label: "شیوه برگزاری", type: "select", required: true, options: Object.entries(LABELS.delivery_mode).map(([value, label]) => ({ value, label })) },
      { name: "level", label: "سطح" },
      { name: "instructor", label: "مربی", type: "select", options: instOpts },
      { name: "capacity", label: "ظرفیت", type: "number", required: true },
      { name: "color", label: "رنگ کارت در سایت", type: "select", required: true, options: Object.entries(LABELS.color).map(([value, label]) => ({ value, label })) },
      { name: "is_active", label: "فعال (نمایش در سایت)", type: "checkbox" },
      { name: "description", label: "توضیحات", type: "textarea", full: true },
    ],
    defaults: { category: "educational", delivery_mode: "in_person", color: "blue", capacity: 25, is_active: true },
    deleteMessage: r => `دوره «${r.title}» و حضور و غیاب آن حذف شود؟`,
    extraActions: () => `<button class="btn btn--sm" data-act="attendance" type="button">حضور و غیاب</button> <button class="btn btn--sm" data-act="students" type="button">دانش‌آموزان</button> `,
    onAction: async (act, row, reload) => {
      if (act === "students") await enrollDialog(row, reload);
      if (act === "attendance") {
        window.__preferredAttendanceCourseId = row.id;
        location.hash = "#/attendance";
      }
    },
  });
}

/* — course enrollments (form submissions) — */
async function viewEnrollments(host) {
  const [courses, users] = await Promise.all([api.list("courses"), api.list("users")]);
  const courseOpts = courses.map(c => ({ value: c.id, label: c.title }));
  const studentUsers = users.filter(u => u.role !== "admin");
  const userOpts = studentUsers.map(u => ({ value: u.id, label: `${u.full_name || u.username} (@${u.username})` }));
  const userMap = new Map(studentUsers.map(u => [String(u.id), u]));

  await crud(host, {
    res: "enrollments", addLabel: "ثبت‌نام جدید", addTitle: "ثبت‌نام دانش‌آموز در دوره", editTitle: "بررسی و ویرایش ثبت‌نام دوره",
    searchKeys: ["full_name", "national_code", "phone", "course_title", "school_name", "grade"],
    columns: [
      { label: "دانش‌آموز", cell: r => `<strong>${esc(r.full_name || "—")}</strong><div class="muted" style="font-size:12px">${r.national_code ? `کد ملی: ${esc(r.national_code)}` : ""}</div>` },
      { label: "دوره انتخابی", cell: r => `<strong>${esc(r.course_title)}</strong>` },
      { label: "مدرسه / پایه", cell: r => `${esc(r.school_name || "—")}<div class="muted" style="font-size:12px">${esc(r.grade || "")}</div>` },
      { label: "شماره تماس", cell: r => `<span class="num" dir="ltr">${esc(r.phone || "—")}</span>` },
      { label: "تاریخ ثبت", cell: r => esc(faDate(r.created_at)) },
      { label: "وضعیت", cell: r => statusBadge(r.status) },
    ],
    fields: () => [
      { name: "course", label: "دوره", type: "select", required: true, options: courseOpts },
      { name: "student", label: "کاربر دانش‌آموز (اختیاری — در صورت خالی بودن خودکار ساخته می‌شود)", type: "select", emptyLabel: "ایجاد خودکار از مشخصات زیر…", options: userOpts },
      { name: "full_name", label: "نام و نام خانوادگی دانش‌آموز", required: true },
      { name: "national_code", label: "کد ملی", ltr: true },
      { name: "phone", label: "شماره تماس", required: true, ltr: true },
      { name: "grade", label: "پایه تحصیلی / رده سنی" },
      { name: "school_name", label: "نام مدرسه" },
      { name: "status", label: "وضعیت ثبت‌نام", type: "select", required: true, options: [{ value: "approved", label: "تأیید شده" }, { value: "pending", label: "در انتظار بررسی" }, { value: "rejected", label: "رد شده" }] },
      { name: "note", label: "توضیحات", type: "textarea", full: true },
    ],
    onFormOpen: form => {
      const stuSelect = form.elements.student;
      if (!stuSelect) return;
      stuSelect.addEventListener("change", () => {
        const u = userMap.get(String(stuSelect.value));
        if (!u) return;
        if (u.full_name && !form.elements.full_name.value) form.elements.full_name.value = u.full_name;
        if (u.phone && !form.elements.phone.value) form.elements.phone.value = u.phone;
        if (u.national_code && !form.elements.national_code.value) form.elements.national_code.value = u.national_code;
      });
    },
    defaults: { status: "approved" },
    deleteMessage: r => `ثبت‌نام «${r.full_name}» در دوره «${r.course_title}» حذف شود؟`,
    extraActions: () => `<button class="btn btn--sm" data-act="go_attendance" type="button">مشاهده در حضور و غیاب</button> `,
    onAction: async (act, row) => {
      if (act === "go_attendance") {
        window.__preferredAttendanceCourseId = row.course;
        location.hash = "#/attendance";
      }
    },
  });
}

async function enrollDialog(course, reload) {
  const [users, current] = await Promise.all([api.list("users"), api.getEnrollments(course.id)]);
  const sel = new Set(current);
  const list = users.filter(u => u.role !== "admin" && (u.is_active || sel.has(u.id)));
  openDialog({
    title: `دانش‌آموزان «${course.title}»`,
    body: `<div class="toolbar"><input class="search" id="enrQ" type="search" placeholder="جستجو…" aria-label="جستجو"><span class="muted" id="enrCount"></span></div>` +
      `<div class="pick-list" id="enrList">${list.map(u => `<label data-name="${esc((u.full_name + " " + u.username).toLowerCase())}"><input type="checkbox" value="${u.id}" ${sel.has(u.id) ? "checked" : ""}> ${esc(u.full_name || u.username)} <span class="muted" dir="ltr">@${esc(u.username)}</span></label>`).join("") || '<div class="empty">کاربری وجود ندارد.</div>'}</div>` +
      `<p class="form-error" id="enrErr" role="alert"></p>`,
    foot: `<button class="btn btn--primary" id="enrSave" type="button">ذخیره</button><button class="btn" data-cancel type="button">انصراف</button>`,
  });
  const count = () => { $("#enrCount", dlg).textContent = `${fa(sel.size)} از ${fa(course.capacity)} نفر`; };
  count();
  $("#enrList", dlg).addEventListener("change", e => { const id = Number(e.target.value); e.target.checked ? sel.add(id) : sel.delete(id); count(); });
  $("#enrQ", dlg).addEventListener("input", e => {
    const q = e.target.value.trim().toLowerCase();
    dlg.querySelectorAll("#enrList label").forEach(l => { l.hidden = !!q && !l.dataset.name.includes(q); });
  });
  dlg.querySelector("[data-cancel]").onclick = () => dlg.close();
  $("#enrSave", dlg).onclick = async () => {
    try { await api.setEnrollments(course.id, [...sel]); dlg.close(); toast("فهرست دانش‌آموزان ذخیره شد."); await reload(); }
    catch (err) { $("#enrErr", dlg).textContent = err.message; }
  };
}

/* — users — */
function viewUsers(host) {
  return crud(host, {
    res: "users", addLabel: "کاربر جدید", addTitle: "کاربر جدید", editTitle: "ویرایش کاربر",
    searchKeys: ["full_name", "username", "phone", "national_code"],
    columns: [
      { label: "نام", cell: r => `<strong>${esc(r.full_name || "—")}</strong>${r.national_code ? `<div class="muted" style="font-size:11px">کد ملی: ${esc(r.national_code)}</div>` : ""}` },
      { label: "نام کاربری", cell: r => `<span dir="ltr">${esc(r.username)}</span>` },
      { label: "تلفن", cell: r => `<span dir="ltr" class="num">${esc(r.phone || "—")}</span>` },
      { label: "نقش", cell: r => `<span class="badge">${esc(LABELS.role[r.role] || r.role)}</span>` },
      { label: "عضویت", cell: r => esc(faDate(r.joined)) },
      { label: "وضعیت", cell: activeBadge },
    ],
    fields: editing => [
      { name: "full_name", label: "نام و نام خانوادگی" },
      { name: "national_code", label: "کد ملی", ltr: true },
      { name: "phone", label: "تلفن", type: "tel", ltr: true },
      { name: "username", label: "نام کاربری", required: true, ltr: true, hint: "حروف انگلیسی، عدد و زیرخط (۳ تا ۲۴ کاراکتر)" },
      { name: "password", label: editing ? "رمز عبور جدید" : "رمز عبور", type: "password", required: !editing, ltr: true, hint: editing ? "خالی بگذارید تا تغییر نکند." : "حداقل ۸ کاراکتر" },
      { name: "role", label: "نقش", type: "select", required: true, options: [{ value: "student", label: "کاربر" }, { value: "admin", label: "مدیر" }] },
      { name: "is_active", label: "حساب فعال", type: "checkbox" },
    ],
    defaults: { role: "student", is_active: true },
    prepare: (p, editing) => { if (editing && !p.password) delete p.password; },
    deleteMessage: r => `کاربر «${r.full_name || r.username}» حذف شود؟`,
  });
}

/* — instructors — */
function viewInstructors(host) {
  return crud(host, {
    res: "instructors", addLabel: "مربی جدید", addTitle: "مربی جدید", editTitle: "ویرایش مربی",
    searchKeys: ["full_name", "specialty", "phone"],
    columns: [
      { label: "نام", cell: r => `<strong>${esc(r.full_name)}</strong>` },
      { label: "تخصص", cell: r => esc(r.specialty || "—") },
      { label: "تلفن", cell: r => `<span dir="ltr" class="num">${esc(r.phone || "—")}</span>` },
      { label: "دوره‌ها", cell: r => fa(r.course_count) },
      { label: "وضعیت", cell: activeBadge },
    ],
    fields: [
      { name: "full_name", label: "نام و نام خانوادگی", required: true },
      { name: "specialty", label: "تخصص" },
      { name: "phone", label: "تلفن", type: "tel", ltr: true },
      { name: "is_active", label: "فعال", type: "checkbox" },
      { name: "bio", label: "توضیحات / مدرک", type: "textarea", full: true },
    ],
    defaults: { is_active: true },
    deleteMessage: r => `مربی «${r.full_name}» حذف شود؟ دوره‌های او بدون مربی می‌مانند.`,
  });
}

/* — accommodation (two tabs) — */
async function viewAccommodations(host) {
  host.innerHTML = `<div class="tabs" role="tablist"><button class="tab" role="tab" data-tab="stays" aria-selected="true">درخواست‌های رزرو خوابگاه</button><button class="tab" role="tab" data-tab="places" aria-selected="false">تعریف اقامتگاه‌ها و ظرفیت</button></div><div id="tabHost"></div>`;
  const tabHost = $("#tabHost", host);
  const show = async tab => {
    host.querySelectorAll(".tab").forEach(t => t.setAttribute("aria-selected", String(t.dataset.tab === tab)));
    tabHost.onclick = null;
    if (tab === "places") {
      await crud(tabHost, {
        res: "accommodations", addLabel: "اقامتگاه جدید", addTitle: "اقامتگاه جدید", editTitle: "ویرایش اقامتگاه",
        searchKeys: ["name", "address"],
        columns: [
          { label: "نام", cell: r => `<strong>${esc(r.name)}</strong><div class="muted" style="font-size:12px">${esc(r.address)}</div>` },
          { label: "مخصوص", cell: r => esc(LABELS.gender[r.gender] || r.gender) },
          { label: "اشغال امروز", cell: r => `<div class="num" style="font-size:13px">${fa(r.occupied)} از ${fa(r.capacity)} نفر</div>${bar(r.occupied, r.capacity, "gold")}` },
          { label: "وضعیت", cell: activeBadge },
        ],
        fields: [
          { name: "name", label: "نام اقامتگاه", required: true, full: true },
          { name: "address", label: "آدرس", full: true },
          { name: "gender", label: "مخصوص", type: "select", required: true, options: [{ value: "male", label: "پسران" }, { value: "female", label: "دختران" }, { value: "mixed", label: "مختلط / خانواده" }] },
          { name: "capacity", label: "ظرفیت کل (نفر)", type: "number", required: true },
          { name: "is_active", label: "فعال", type: "checkbox" },
        ],
        defaults: { gender: "mixed", capacity: 20, is_active: true },
        deleteMessage: r => `اقامتگاه «${r.name}» و سوابق اقامت آن حذف شود؟`,
      });
    } else {
      const [places, users] = await Promise.all([api.list("accommodations"), api.list("users")]);
      await crud(tabHost, {
        res: "stays", addLabel: "ثبت درخواست اقامت", addTitle: "ثبت درخواست اقامت جدید", editTitle: "بررسی و ویرایش درخواست خوابگاه",
        searchKeys: ["user_name", "full_name", "national_code", "phone", "organization", "purpose", "accommodation_name", "note"],
        columns: [
          { label: "متقاضی / سرپرست", cell: r => `<strong>${esc(r.full_name || r.user_name)}</strong><div class="muted" style="font-size:12px">${r.national_code ? `کد ملی: ${esc(r.national_code)} · ` : ""}<span dir="ltr">${esc(r.phone || "")}</span></div>` },
          { label: "اقامتگاه / نوع اسکان", cell: r => `<strong>${esc(r.accommodation_name)}</strong><div class="muted" style="font-size:12px">${esc(LABELS.room_type[r.room_type] || r.room_type || "")} · ${esc(LABELS.gender[r.gender] || "")}</div>` },
          { label: "تعداد و واحد اعزامی", cell: r => `${fa(r.guests_count || 1)} نفر<div class="muted" style="font-size:12px">${esc(r.organization || r.purpose || "—")}</div>` },
          { label: "بازه اقامت", cell: r => `${esc(faDate(r.check_in))} تا ${esc(faDate(r.check_out))}${r.arrival_time ? `<div class="muted" style="font-size:11px">ورود: ${esc(r.arrival_time)}${r.needs_catering ? " · با پذیرایی" : ""}</div>` : ""}` },
          { label: "وضعیت", cell: r => statusBadge(r.status) },
        ],
        fields: [
          { name: "accommodation", label: "اقامتگاه", type: "select", required: true, options: places.filter(p => p.is_active).map(p => ({ value: p.id, label: p.name })) },
          { name: "user", label: "حساب کاربری مرتبط (اختیاری)", type: "select", options: users.filter(u => u.role !== "admin").map(u => ({ value: u.id, label: u.full_name || u.username })) },
          { name: "full_name", label: "نام و نام خانوادگی متقاضی / سرپرست", required: true },
          { name: "national_code", label: "کد ملی", required: true, ltr: true },
          { name: "phone", label: "شماره تماس", required: true, ltr: true },
          { name: "gender", label: "بخش / جنسیت", type: "select", required: true, options: [{ value: "male", label: "پسران / آقایان" }, { value: "female", label: "دختران / بانوان" }, { value: "family", label: "خانواده / مختلط" }] },
          { name: "room_type", label: "نوع اسکان", type: "select", required: true, options: Object.entries(LABELS.room_type).map(([value, label]) => ({ value, label })) },
          { name: "guests_count", label: "تعداد نفرات", type: "number", required: true },
          { name: "organization", label: "نام مدرسه / شهر / واحد اعزام‌کننده" },
          { name: "purpose", label: "علت اقامت / عنوان اردو یا برنامه" },
          { name: "check_in", label: "تاریخ ورود", type: "date", required: true },
          { name: "check_out", label: "تاریخ خروج", type: "date", required: true },
          { name: "arrival_time", label: "ساعت تقریبی ورود", type: "time" },
          { name: "status", label: "وضعیت درخواست", type: "select", required: true, options: [{ value: "pending", label: "در انتظار بررسی" }, { value: "approved", label: "تأیید شده" }, { value: "rejected", label: "رد شده" }] },
          { name: "needs_catering", label: "درخواست خدمات پذیرایی و وعده غذایی", type: "checkbox", defaultChecked: false, full: true },
          { name: "note", label: "توضیحات و یادداشت مدیر", type: "textarea", full: true },
        ],
        defaults: { check_in: todayISO(), guests_count: 1, gender: "male", room_type: "dorm", status: "pending", needs_catering: false },
        deleteMessage: r => `درخواست اقامت «${r.full_name || r.user_name}» حذف شود؟`,
      });
    }
  };
  host.querySelector(".tabs").addEventListener("click", e => { const t = e.target.closest(".tab"); if (t) show(t.dataset.tab).catch(err => toast(err.message, true)); });
  await show("stays");
}

/* — attendance — */
async function viewAttendance(host) {
  const allCourses = await api.list("courses");
  const courses = allCourses.filter(c => c.is_active || c.enrolled > 0);
  if (!courses.length) {
    host.innerHTML = `<div class="card empty">ابتدا یک دوره فعال در بخش «مدیریت دوره‌ها» تعریف کنید.</div>`;
    return;
  }

  const preferredId = window.__preferredAttendanceCourseId;
  delete window.__preferredAttendanceCourseId;
  const defaultCourse =
    courses.find(c => String(c.id) === String(preferredId)) ||
    courses.find(c => Number(c.enrolled) > 0) ||
    courses[0];

  host.innerHTML =
    `<div class="toolbar">` +
    `<label style="min-width:260px">انتخاب کلاس / دوره<select id="atCourse">${courses.map(c => `<option value="${c.id}" ${c.id === defaultCourse.id ? "selected" : ""}>${esc(c.title)} (${fa(c.enrolled)} دانش‌آموز ثبت‌نامی)</option>`).join("")}</select></label>` +
    `<label>تاریخ جلسه<input id="atDate" type="date" value="${todayISO()}"></label>` +
    `</div><div id="atBody"></div>`;

  const body = $("#atBody", host);
  const load = async () => {
    const courseId = Number($("#atCourse", host).value), date = $("#atDate", host).value;
    if (!date) return;
    body.innerHTML = `<div class="card muted">در حال بارگذاری لیست حضور و غیاب کلاس…</div>`;
    try {
      const recs = await api.getAttendance(courseId, date);
      if (!recs.length) {
        body.innerHTML = `<div class="card empty">هنوز دانش‌آموزی در این دوره ثبت‌نام نکرده است. به محض نهایی شدن ثبت‌نام دوره در سایت، مشخصات دانش‌آموز به صورت خودکار به این لیست اضافه می‌شود.</div>`;
        return;
      }
      body.innerHTML =
        `<div class="toolbar">` +
        `<button class="btn" id="allPresent" type="button">همه حاضر</button>` +
        `<span class="muted" id="atCount"></span>` +
        `<span class="spacer"></span>` +
        `<button class="btn btn--primary" id="atSave" type="button">ذخیره حضور و غیاب</button>` +
        `</div>` +
        `<div class="table-wrap"><table><thead><tr>` +
        `<th>#</th>` +
        `<th>نام و نام خانوادگی دانش‌آموز</th>` +
        `<th>کد ملی</th>` +
        `<th>شماره تماس</th>` +
        `<th>پایه تحصیلی / مدرسه</th>` +
        `<th>وضعیت حضور</th>` +
        `</tr></thead><tbody>` +
        recs.map((r, i) =>
          `<tr data-s="${r.student}">` +
          `<td class="num">${fa(i + 1)}</td>` +
          `<td><strong>${esc(r.full_name || r.name)}</strong>${r.note ? `<div class="muted" style="font-size:11px">${esc(r.note)}</div>` : ""}</td>` +
          `<td class="num" dir="ltr">${esc(r.national_code || "—")}</td>` +
          `<td class="num" dir="ltr">${esc(r.phone || "—")}</td>` +
          `<td>${esc(r.grade || "—")}${r.school_name ? `<div class="muted" style="font-size:12px">${esc(r.school_name)}</div>` : ""}</td>` +
          `<td><div class="seg" role="radiogroup" aria-label="وضعیت ${esc(r.full_name || r.name)}">` +
          [["present", "p", "حاضر"], ["late", "l", "تأخیر"], ["absent", "a", "غایب"]].map(([v, cls, lab]) =>
            `<input type="radio" id="r${r.student}${v}" name="s${r.student}" value="${v}" ${(r.status || "present") === v ? "checked" : ""}><label class="${cls}" for="r${r.student}${v}">${lab}</label>`
          ).join("") +
          `</div></td></tr>`
        ).join("") +
        `</tbody></table></div>`;

      const tally = () => {
        const n = k => body.querySelectorAll(`input[value="${k}"]:checked`).length;
        $("#atCount", body).textContent = `کل دانش‌آموزان کلاس: ${fa(recs.length)} نفر · حاضر: ${fa(n("present"))} · تأخیر: ${fa(n("late"))} · غایب: ${fa(n("absent"))}`;
      };
      tally();
      body.addEventListener("change", tally);
      $("#allPresent", body).onclick = () => {
        body.querySelectorAll('input[value="present"]').forEach(i => { i.checked = true; });
        tally();
      };
      $("#atSave", body).onclick = async () => {
        const records = [];
        body.querySelectorAll("tbody tr").forEach(tr => {
          const c = tr.querySelector("input:checked");
          if (c) records.push({ student: Number(tr.dataset.s), status: c.value });
        });
        if (!records.length) { toast("وضعیتی انتخاب نشده است.", true); return; }
        try {
          await api.saveAttendance(courseId, date, records);
          toast("حضور و غیاب کلاس با موفقیت ذخیره شد.");
        } catch (err) {
          toast(err.message, true);
        }
      };
    } catch (err) {
      body.innerHTML = `<div class="card"><p class="form-error">${esc(err.message)}</p></div>`;
    }
  };
  $("#atCourse", host).addEventListener("change", load);
  $("#atDate", host).addEventListener("change", load);
  await load();
}

/* — overview & reports — */
const kpi = (label, value, sub) => `<div class="card kpi"><div class="kpi__label">${esc(label)}</div><div class="kpi__value num">${value}</div>${sub ? `<div class="kpi__sub">${sub}</div>` : ""}</div>`;

function dailyChart(daily) {
  return `<div class="cols-chart" role="img" aria-label="نمودار نرخ حضور ۱۴ روز اخیر">` + daily.map(d => {
    const h = d.rate == null ? 4 : Math.max(4, d.rate);
    const day = new Intl.DateTimeFormat("fa-IR-u-ca-persian", { day: "numeric" }).format(new Date(d.date + "T00:00:00"));
    return `<div class="col" title="${esc(faDate(d.date))}: ${d.rate == null ? "بدون ثبت" : fa(d.rate) + "٪"}"><small>${d.rate == null ? "" : fa(d.rate)}</small><i class="${d.rate == null ? "none" : ""}" style="height:${h}%"></i><small>${day}</small></div>`;
  }).join("") + `</div>`;
}

async function viewOverview(host) {
  const r = await api.reports(), t = r.totals;
  const occPct = t.accommodation_capacity ? Math.round(t.accommodation_occupied * 100 / t.accommodation_capacity) : 0;
  const pendingTotal = Number(t.pending_stays || 0) + Number(t.pending_bookings || 0);
  host.innerHTML =
    `<div class="grid kpis">` +
    kpi("کاربران", fa(t.students), "دانش‌آموز و عضو") +
    kpi("دوره‌های فعال", fa(t.courses), `${fa(t.enrollments)} ثبت‌نام فعال`) +
    kpi("مربیان فعال", fa(t.instructors), "مربیان کانون") +
    kpi("اشغال خوابگاه", fa(occPct) + "٪", `${fa(t.accommodation_occupied)} از ${fa(t.accommodation_capacity)} نفر`) +
    kpi("درخواست‌های در انتظار", fa(pendingTotal), `${fa(t.pending_stays || 0)} خوابگاه · ${fa(t.pending_bookings || 0)} سالن`) +
    `</div>` +
    `<div class="grid cols-2"><section class="card"><h2>نرخ حضور ۱۴ روز اخیر</h2>${dailyChart(r.daily_attendance)}</section>` +
    `<section class="card"><h2>پرشدن ظرفیت دوره‌ها</h2><div class="row-bars">` +
    (r.courses.map(c => `<div><div class="top"><span>${esc(c.title)}</span><span class="muted num">${fa(c.enrolled)} / ${fa(c.capacity)}</span></div>${bar(c.enrolled, c.capacity)}</div>`).join("") || '<div class="empty">هنوز دوره‌ای در پنل ثبت نشده است.</div>') +
    `</div></section></div>`;
}

async function viewReports(host) {
  const r = await api.reports(), t = r.totals;
  host.innerHTML =
    `<div class="toolbar"><span class="spacer"></span><button class="btn" id="csvBtn" type="button">دریافت خروجی CSV</button></div>` +
    `<div class="grid kpis">${kpi("کاربران", fa(t.students))}${kpi("ثبت‌نام‌ها", fa(t.enrollments))}${kpi("دوره‌های فعال", fa(t.courses))}${kpi("ظرفیت خوابگاه", fa(t.accommodation_capacity), `${fa(t.accommodation_occupied)} نفر ساکن`)}</div>` +
    `<div class="grid cols-2"><section class="card"><h2>نرخ حضور ۱۴ روز اخیر</h2>${dailyChart(r.daily_attendance)}</section>` +
    `<section class="card"><h2>حضور به تفکیک دوره</h2><div class="row-bars">` +
    (r.courses.map(c => `<div><div class="top"><span>${esc(c.title)}</span><span class="muted num">${c.attendance_rate == null ? "بدون ثبت" : fa(c.attendance_rate) + "٪"}</span></div>${bar(c.attendance_rate || 0, 100, "gold")}</div>`).join("") || '<div class="empty">دوره‌ای ثبت نشده است.</div>') +
    `</div></section></div>`;
  $("#csvBtn", host).onclick = () => {
    const safe = v => { let s = String(v == null ? "" : v); if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; return '"' + s.replace(/"/g, '""') + '"'; };
    const lines = [["دوره", "ثبت‌نام", "ظرفیت", "نرخ حضور (درصد)"]].concat(r.courses.map(c => [c.title, c.enrolled, c.capacity, c.attendance_rate == null ? "" : c.attendance_rate]));
    const blob = new Blob(["\uFEFF" + lines.map(l => l.map(safe).join(",")).join("\r\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = "nivad-report-" + todayISO() + ".csv";
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };
}

/* ───────────── shell: nav, routing, boot ───────────── */
const nav = $("#nav"), view = $("#view"), sidebar = $("#sidebar"), scrim = $("#scrim");

nav.innerHTML = VIEWS.map(v => `<a class="nav__link" href="#/${v.id}" data-id="${v.id}"><svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[v.id]}</svg>${esc(v.title)}</a>`).join("");

function setMenu(open) {
  sidebar.classList.toggle("open", open);
  scrim.hidden = !open;
  $("#menuBtn").setAttribute("aria-expanded", String(open));
}
$("#menuBtn").onclick = () => setMenu(!sidebar.classList.contains("open"));
scrim.onclick = () => setMenu(false);
document.addEventListener("keydown", e => { if (e.key === "Escape") setMenu(false); });

let renderToken = 0;
async function route() {
  if (!api) return;
  const id = (location.hash.match(/^#\/(\w+)/) || [])[1];
  const v = VIEWS.find(x => x.id === id) || VIEWS[0];
  const token = ++renderToken;
  nav.querySelectorAll(".nav__link").forEach(a => {
    if (a.dataset.id === v.id) a.setAttribute("aria-current", "page");
    else a.removeAttribute("aria-current");
  });
  $("#pageTitle").textContent = v.title;
  document.title = v.title + " | پنل مدیریت کانون دانش‌آموزی";
  setMenu(false);
  view.innerHTML = `<div class="card muted">در حال بارگذاری…</div>`;
  const host = document.createElement("div");
  try {
    await v.render(host);
    if (token !== renderToken) return;
    view.replaceChildren(host);
  } catch (err) {
    if (token !== renderToken) return;
    if (err.status === 401) { showGate(); return; }
    view.innerHTML = `<div class="card"><p class="form-error">${esc(err.message || "خطا در بارگذاری.")}</p><button class="btn" id="retry" type="button">تلاش دوباره</button></div>`;
    $("#retry").onclick = route;
  }
  view.focus({ preventScroll: true });
}
window.addEventListener("hashchange", route);

function showGate() {
  $("#shell").hidden = true; $("#loginGate").hidden = false;
  if (dlg.open) dlg.close();
  $("#gateUser").focus();
}

function startApp(user) {
  currentUser = user;
  $("#loginGate").hidden = true; $("#shell").hidden = false;
  $("#whoami").textContent = user.full_name || user.username;
  const demo = api.mode === "demo";
  $("#modeBadge").hidden = !demo; $("#demoNote").hidden = !demo; $("#logoutBtn").hidden = demo;
  route();
}

$("#gateForm").addEventListener("submit", async e => {
  e.preventDefault();
  const msg = $("#gateMsg"); msg.textContent = "";
  try {
    const { user } = await api.login($("#gateUser").value.trim(), $("#gatePass").value);
    if (user.role !== "admin") { await api.logout(); msg.textContent = "این حساب دسترسی مدیریت ندارد."; return; }
    $("#gatePass").value = "";
    await api.me();
    startApp(user);
  } catch (err) { msg.textContent = err.message; }
});
$("#logoutBtn").onclick = async () => { try { await api.logout(); } catch (e) { /* ignore */ } showGate(); };
$("#resetDemo").onclick = async () => { if (await confirmBox("همه تغییرات شما پاک و داده‌های نمونه دوباره ساخته شود؟", "بازنشانی")) { DemoAPI.reset(); route(); toast("داده‌های نمونه بازنشانی شد."); } };

(async function boot() {
  if (await RemoteAPI.probe()) {
    api = RemoteAPI;
    try {
      const me = await api.me();
      if (me.authenticated && me.user.role === "admin") startApp(me.user); else showGate();
    } catch (e) { showGate(); }
  } else {
    api = RemoteAPI;
    showGate();
    $("#gateMsg").textContent = "سرور Django در دسترس نیست. ابتدا سرور را اجرا کنید؛ اطلاعات نمایشی جایگزین داده‌های واقعی نمی‌شود.";
  }
})();
