/* منطق کامل پنل کاربری دانش‌آموز (dashboard-login.html) متصل به بک‌اند جنگو و پنل مدیریت:
   - دریافت اطلاعات کاربر، آمار حضور و غیاب و دوره‌های ثبت‌نامی از /api/student/dashboard/
   - دریافت داینامیک دوره‌های فعال تعریف‌شده در پنل مدیریت از /api/public/courses/
   - ثبت‌نام مستقیم در دوره‌های جدید با همگام‌سازی خودکار لیست حضور و غیاب پنل ادمین
   - تقویم شمسی هوشمند متصل به سوابق واقعی حضور، تأخیر و غیبت دانش‌آموز در دیتابیس
*/
"use strict";

(() => {
    const calendarDays = document.getElementById("calendarDays");
    const monthTitle = document.getElementById("monthTitle");
    const prevMonth = document.getElementById("prevMonth");
    const nextMonth = document.getElementById("nextMonth");

    const sidebarUserName = document.getElementById("sidebarUserName");
    const sidebarUserPhone = document.getElementById("sidebarUserPhone");
    const welcomeUserTitle = document.getElementById("welcomeUserTitle");
    const welcomeUserSubtitle = document.getElementById("welcomeUserSubtitle");
    const topbarSubtitle = document.getElementById("topbarSubtitle");
    const adminPanelShortcut = document.getElementById("adminPanelShortcut");
    const logoutLink = document.getElementById("logoutLink");
    const logoutLinkText = document.getElementById("logoutLinkText");
    const refreshDashboardBtn = document.getElementById("refreshDashboardBtn");

    const statActiveCourses = document.getElementById("statActiveCourses");
    const statPresentSessions = document.getElementById("statPresentSessions");
    const statAbsentSessions = document.getElementById("statAbsentSessions");
    const statAttendanceRate = document.getElementById("statAttendanceRate");
    const attendanceCircle = document.getElementById("attendanceCircle");

    const enrolledEducationalList = document.getElementById("enrolledEducationalList");
    const enrolledSportsList = document.getElementById("enrolledSportsList");

    const courseModal = document.getElementById("courseModal");
    const courseModalClose = document.getElementById("courseModalClose");
    const courseModalCategory = document.getElementById("courseModalCategory");
    const courseModalTitle = document.getElementById("courseModalTitle");
    const courseModalIcon = courseModal?.querySelector(".course-modal__icon i");
    const courseSelectionList = document.getElementById("courseSelectionList");
    const selectedCourseCount = document.getElementById("selectedCourseCount");
    const courseModalSubmitBtn = document.getElementById("courseModalSubmitBtn");
    const courseModalFeedback = document.getElementById("courseModalFeedback");
    const courseOpenButtons = document.querySelectorAll(".course-open-btn");

    const persianFormatter = new Intl.DateTimeFormat(
        "en-US-u-ca-persian-nu-latn",
        { year: "numeric", month: "numeric", day: "numeric" }
    );
    const persianNumbers = new Intl.NumberFormat("fa-IR", { useGrouping: false });
    const persianNumberFormatter = new Intl.NumberFormat("fa-IR");

    const monthNames = [
        "فروردین", "اردیبهشت", "خرداد",
        "تیر", "مرداد", "شهریور",
        "مهر", "آبان", "آذر",
        "دی", "بهمن", "اسفند"
    ];

    const courseIcons = {
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

    function pickCourseIcon(course) {
        const title = String(course?.title || course || "");
        if (courseIcons[title]) return courseIcons[title];
        for (const [key, val] of Object.entries(courseIcons)) {
            if (title.includes(key)) return val;
        }
        return course?.category === "sports" ? "fa-dumbbell" : "fa-book-open";
    }

    function csrfToken() {
        try {
            const m = (document.cookie || "").match(/(?:^|;\s*)csrftoken=([^;]+)/);
            return m ? decodeURIComponent(m[1]) : "";
        } catch (_) {
            return "";
        }
    }

    function toIsoDate(d) {
        const z = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
        return z.toISOString().slice(0, 10);
    }

    function getPersianDate(date) {
        const parts = persianFormatter.formatToParts(date);
        return {
            year: Number(parts.find(p => p.type === "year").value),
            month: Number(parts.find(p => p.type === "month").value),
            day: Number(parts.find(p => p.type === "day").value)
        };
    }

    const today = getPersianDate(new Date());
    let currentYear = today.year;
    let currentMonth = today.month;

    // وضعیت زنده دریافتی از سرور جنگو
    let currentUser = null;
    let attendanceByIsoDate = {};
    let attendanceRecords = [];
    let enrolledCourseIds = new Set();
    let allActiveCourses = { educational: [], sports: [] };
    const selectedCourses = { educational: new Set(), sports: new Set() };
    let currentCourseType = "educational";
    let previousActiveElement = null;

    function getMonthDates(year, month) {
        const dates = [];
        const start = new Date(new Date().getFullYear() - 2, 0, 1);
        const end = new Date(new Date().getFullYear() + 3, 0, 1);

        for (let date = new Date(start); date < end; date.setDate(date.getDate() + 1)) {
            const persianDate = getPersianDate(date);
            if (persianDate.year === year && persianDate.month === month) {
                dates.push({
                    ...persianDate,
                    weekday: date.getDay(),
                    iso: toIsoDate(date)
                });
            }
        }
        return dates;
    }

    function renderCalendar() {
        if (!calendarDays || !monthTitle) return;
        calendarDays.innerHTML = "";
        monthTitle.textContent = `${monthNames[currentMonth - 1]} ${persianNumbers.format(currentYear)}`;

        const dates = getMonthDates(currentYear, currentMonth);
        if (!dates.length) return;

        // First Weekday (Saturday = 0)
        const firstDay = (dates[0].weekday + 1) % 7;
        for (let i = 0; i < firstDay; i++) {
            const emptyDay = document.createElement("div");
            emptyDay.className = "empty-day";
            calendarDays.appendChild(emptyDay);
        }

        const statusLabels = {
            present: "حاضر",
            late: "تأخیر",
            absent: "غایب"
        };

        dates.forEach(date => {
            const day = document.createElement("div");
            day.className = "calendar-day";

            const status = attendanceByIsoDate[date.iso] || "unknown";
            if (status !== "unknown") {
                day.classList.add(`day-${status}`);
                const dayRecs = attendanceRecords.filter(r => r.date === date.iso);
                if (dayRecs.length) {
                    day.title = dayRecs
                        .map(r => `${r.course_title}: ${statusLabels[r.status] || r.status}`)
                        .join(" | ");
                } else {
                    day.title = statusLabels[status] || "";
                }
            }

            const number = document.createElement("span");
            number.className = "day-number";
            number.textContent = persianNumbers.format(date.day);

            const dot = document.createElement("span");
            dot.className = `attendance-dot ${status}`;

            if (date.year === today.year && date.month === today.month && date.day === today.day) {
                day.classList.add("today");
            }

            day.appendChild(number);
            day.appendChild(dot);
            calendarDays.appendChild(day);
        });
    }

    function changeMonth(amount) {
        currentMonth += amount;
        if (currentMonth > 12) {
            currentMonth = 1;
            currentYear++;
        }
        if (currentMonth < 1) {
            currentMonth = 12;
            currentYear--;
        }
        renderCalendar();
    }

    if (prevMonth) prevMonth.addEventListener("click", () => changeMonth(-1));
    if (nextMonth) nextMonth.addEventListener("click", () => changeMonth(1));

    function renderEnrolledCourses(enrollments) {
        const edu = (enrollments || []).filter(e => e.category !== "sports");
        const sp = (enrollments || []).filter(e => e.category === "sports");

        const renderGroup = (host, items, emptyText) => {
            if (!host) return;
            host.replaceChildren();
            if (!items.length) {
                const span = document.createElement("span");
                span.className = "enrolled-empty";
                span.textContent = emptyText;
                host.appendChild(span);
                return;
            }
            items.forEach(item => {
                const badge = document.createElement("span");
                badge.className = "enrolled-tag";
                const mode = item.delivery_mode === "online" ? "آنلاین" : "حضوری";
                badge.innerHTML = `<i class="fa-solid ${pickCourseIcon(item)}"></i> <strong>${item.title}</strong> <small>(${mode}${item.instructor ? ` · ${item.instructor}` : ""})</small>`;
                host.appendChild(badge);
            });
        };

        renderGroup(
            enrolledEducationalList,
            edu,
            currentUser ? "هنوز در دوره آموزشی ثبت‌نام نکرده‌اید." : "برای مشاهده دوره‌های ثبت‌نامی خود وارد حساب شوید."
        );
        renderGroup(
            enrolledSportsList,
            sp,
            currentUser ? "هنوز در دوره ورزشی ثبت‌نام نکرده‌اید." : "برای مشاهده دوره‌های ورزشی خود وارد حساب شوید."
        );
    }

    async function loadDashboardData() {
        try {
            const [dashRes, coursesRes] = await Promise.all([
                fetch("/api/student/dashboard/", { credentials: "same-origin", headers: { Accept: "application/json" } }),
                fetch("/api/public/courses/", { credentials: "same-origin", headers: { Accept: "application/json" } })
            ]);

            if (coursesRes.ok) {
                const cData = await coursesRes.json();
                const courses = cData.courses || [];
                allActiveCourses = {
                    educational: courses.filter(c => c.category !== "sports"),
                    sports: courses.filter(c => c.category === "sports")
                };
            }

            if (dashRes.ok) {
                const data = await dashRes.json();
                if (data.authenticated && data.user) {
                    currentUser = data.user;
                    const displayName = data.user.full_name || data.user.username;
                    if (sidebarUserName) sidebarUserName.textContent = displayName;
                    if (sidebarUserPhone) sidebarUserPhone.textContent = data.user.phone ? `شماره تماس: ${data.user.phone}` : `@${data.user.username}`;
                    if (welcomeUserTitle) welcomeUserTitle.textContent = `سلام، ${displayName} عزیز!`;
                    if (topbarSubtitle) topbarSubtitle.textContent = `خوش آمدید (${displayName})`;
                    if (logoutLinkText) logoutLinkText.textContent = "خروج از حساب";
                    if (adminPanelShortcut) adminPanelShortcut.hidden = data.user.role !== "admin";

                    const st = data.stats || {};
                    const activeCount = Number(st.active_courses || 0);
                    const presentCount = Number(st.present_sessions || 0);
                    const absentCount = Number(st.absent_sessions || 0);
                    const rate = Number(st.attendance_rate || 0);

                    if (statActiveCourses) statActiveCourses.textContent = persianNumberFormatter.format(activeCount);
                    if (statPresentSessions) statPresentSessions.textContent = persianNumberFormatter.format(presentCount);
                    if (statAbsentSessions) statAbsentSessions.textContent = persianNumberFormatter.format(absentCount);
                    if (statAttendanceRate) statAttendanceRate.textContent = `${persianNumberFormatter.format(rate)}٪`;
                    if (attendanceCircle) attendanceCircle.style.setProperty("--progress", `${Math.max(0, Math.min(100, rate))}%`);

                    const enrollments = data.enrollments || [];
                    enrolledCourseIds = new Set(enrollments.map(e => Number(e.course_id)));
                    attendanceByIsoDate = data.attendance_by_date || {};
                    attendanceRecords = data.attendance_records || [];

                    renderEnrolledCourses(enrollments);
                    renderCalendar();
                    return;
                }
            }

            // حالت کاربر واردنشده
            currentUser = null;
            enrolledCourseIds = new Set();
            attendanceByIsoDate = {};
            attendanceRecords = [];
            if (sidebarUserName) sidebarUserName.textContent = "کاربر مهمان";
            if (sidebarUserPhone) sidebarUserPhone.textContent = "وارد حساب نشده‌اید";
            if (welcomeUserTitle) welcomeUserTitle.textContent = "به پنل کاربری کانون خوش آمدید!";
            if (welcomeUserSubtitle) {
                welcomeUserSubtitle.innerHTML = `<i class="fa-solid fa-circle-info"></i> برای مشاهده دوره‌های ثبت‌نام‌شده و تقویم حضور و غیاب شخصی، لطفاً <a href="Login.html?mode=login&next=dashboard-login.html" style="color: #f5d76e; text-decoration: underline; font-weight: 800;">وارد حساب خود شوید</a>.`;
            }
            if (logoutLinkText) logoutLinkText.textContent = "ورود / ثبت‌نام";
            renderEnrolledCourses([]);
            renderCalendar();
        } catch (err) {
            console.error("خطا در بارگذاری اطلاعات پنل کاربری:", err);
            renderCalendar();
        }
    }

    function updateSelectedCount() {
        if (!selectedCourseCount) return;
        const count = selectedCourses[currentCourseType].size;
        selectedCourseCount.textContent = persianNumberFormatter.format(count);
    }

    function renderCourseOptions(type) {
        if (!courseSelectionList) return;
        courseSelectionList.replaceChildren();

        const courses = allActiveCourses[type] || [];
        const selected = selectedCourses[type];

        if (courses.length === 0) {
            const emptyMessage = document.createElement("p");
            emptyMessage.className = "course-selection-empty";
            emptyMessage.textContent = "در حال حاضر دوره فعالی در این بخش توسط مدیریت کانون ثبت نشده است.";
            courseSelectionList.appendChild(emptyMessage);
            updateSelectedCount();
            return;
        }

        const fragment = document.createDocumentFragment();

        courses.forEach((course, index) => {
            const isAlreadyEnrolled = enrolledCourseIds.has(Number(course.id));
            const isFull = Number(course.remaining ?? (course.capacity - course.enrolled)) <= 0;

            const label = document.createElement("label");
            label.className = "course-option" + (isAlreadyEnrolled ? " is-enrolled" : "");

            const checkbox = document.createElement("input");
            checkbox.type = "checkbox";
            checkbox.className = "course-option__checkbox";
            checkbox.id = `course-${type}-${index}`;
            checkbox.value = String(course.id);
            checkbox.checked = isAlreadyEnrolled || selected.has(course.id);
            checkbox.disabled = isAlreadyEnrolled || isFull;

            const iconWrapper = document.createElement("span");
            iconWrapper.className = "course-option__icon";
            const icon = document.createElement("i");
            icon.className = `fa-solid ${pickCourseIcon(course)}`;
            icon.setAttribute("aria-hidden", "true");
            iconWrapper.appendChild(icon);

            const name = document.createElement("span");
            name.className = "course-option__name";
            const rem = Math.max(0, Number(course.capacity || 0) - Number(course.enrolled || 0));
            const subText = isAlreadyEnrolled
                ? " (ثبت‌نام شده)"
                : isFull
                    ? " (ظرفیت تکمیل)"
                    : ` (ظرفیت خالی: ${persianNumberFormatter.format(rem)})`;
            name.textContent = `${course.title}${subText}`;

            const check = document.createElement("span");
            check.className = "course-option__check";
            check.setAttribute("aria-hidden", "true");
            const checkIcon = document.createElement("i");
            checkIcon.className = "fa-solid fa-check";
            check.appendChild(checkIcon);

            checkbox.addEventListener("change", () => {
                if (checkbox.checked) {
                    selected.add(course.id);
                } else {
                    selected.delete(course.id);
                }
                updateSelectedCount();
            });

            label.append(checkbox, iconWrapper, name, check);
            fragment.appendChild(label);
        });

        courseSelectionList.appendChild(fragment);
        updateSelectedCount();
    }

    function openCourseModal(type, button) {
        if (!courseModal) return;
        if (!Object.hasOwn(allActiveCourses, type)) return;

        currentCourseType = type;
        previousActiveElement = button;
        const isSports = type === "sports";

        if (courseModalCategory) {
            courseModalCategory.textContent = isSports ? "دوره‌های ورزشی فعال" : "دوره‌های آموزشی فعال";
        }
        if (courseModalTitle) {
            courseModalTitle.textContent = isSports ? "ثبت‌نام دوره‌های ورزشی" : "ثبت‌نام دوره‌های آموزشی";
        }
        if (courseModalIcon) {
            courseModalIcon.className = isSports ? "fa-solid fa-dumbbell" : "fa-solid fa-book-open";
        }
        if (courseModalFeedback) {
            courseModalFeedback.textContent = "پس از ثبت نهایی، دوره‌های انتخابی به لیست دوره‌های شما و لیست حضور و غیاب کلاس در پنل مدیریت اضافه می‌شوند.";
            courseModalFeedback.style.color = "";
        }

        courseModal.classList.remove("course-modal--educational", "course-modal--sports");
        courseModal.classList.add(isSports ? "course-modal--sports" : "course-modal--educational");

        renderCourseOptions(type);

        courseModal.classList.add("is-open");
        courseModal.setAttribute("aria-hidden", "false");
        document.body.classList.add("modal-open");
        courseModalClose?.focus();
    }

    function closeCourseModal() {
        if (!courseModal) return;
        courseModal.classList.remove("is-open");
        courseModal.setAttribute("aria-hidden", "true");
        document.body.classList.remove("modal-open");
        previousActiveElement?.focus();
    }

    courseOpenButtons.forEach(button => {
        button.addEventListener("click", () => {
            openCourseModal(button.dataset.courseType, button);
        });
    });

    courseModalClose?.addEventListener("click", closeCourseModal);

    courseModal?.addEventListener("click", event => {
        if (event.target === courseModal) closeCourseModal();
    });

    document.addEventListener("keydown", event => {
        if (event.key === "Escape" && courseModal?.classList.contains("is-open")) {
            closeCourseModal();
        }
    });

    // ثبت نهایی دوره‌های انتخاب‌شده در دیتابیس جنگو
    if (courseModalSubmitBtn) {
        courseModalSubmitBtn.addEventListener("click", async () => {
            const chosenIds = [...selectedCourses[currentCourseType]];
            if (!chosenIds.length) {
                if (courseModalFeedback) {
                    courseModalFeedback.textContent = "لطفاً ابتدا حداقل یک دوره جدید را از فهرست بالا تیک بزنید.";
                    courseModalFeedback.style.color = "#c34444";
                }
                return;
            }

            if (!currentUser) {
                window.location.href = `course-register.html?course=${encodeURIComponent(chosenIds[0])}`;
                return;
            }

            courseModalSubmitBtn.disabled = true;
            try {
                await fetch("/api/auth/me/", { credentials: "same-origin" });
                const res = await fetch("/api/student/enroll/", {
                    method: "POST",
                    credentials: "same-origin",
                    headers: {
                        "Content-Type": "application/json",
                        "X-CSRFToken": csrfToken()
                    },
                    body: JSON.stringify({ course_ids: chosenIds })
                });
                const result = await res.json();
                if (!res.ok) {
                    throw new Error(result.error || "ثبت‌نام انجام نشد.");
                }
                selectedCourses[currentCourseType].clear();
                if (courseModalFeedback) {
                    courseModalFeedback.textContent = result.message || "ثبت‌نام با موفقیت انجام شد.";
                    courseModalFeedback.style.color = "#1f8a5b";
                }
                await loadDashboardData();
                renderCourseOptions(currentCourseType);
                setTimeout(() => closeCourseModal(), 900);
            } catch (err) {
                if (courseModalFeedback) {
                    courseModalFeedback.textContent = err.message || "خطا در ارتباط با سرور.";
                    courseModalFeedback.style.color = "#c34444";
                }
            } finally {
                courseModalSubmitBtn.disabled = false;
            }
        });
    }

    // خروج از حساب کاربری با فراخوانی API جنگو
    if (logoutLink) {
        logoutLink.addEventListener("click", async event => {
            if (!currentUser) return; // اگر وارد نشده، مستقیم به صفحه ورود برود
            event.preventDefault();
            try {
                await fetch("/api/auth/me/", { credentials: "same-origin" });
                await fetch("/api/auth/logout/", {
                    method: "POST",
                    credentials: "same-origin",
                    headers: { "Content-Type": "application/json", "X-CSRFToken": csrfToken() },
                    body: "{}"
                });
            } catch (_) {}
            window.location.href = "Login.html?mode=login";
        });
    }

    if (refreshDashboardBtn) {
        refreshDashboardBtn.addEventListener("click", () => {
            loadDashboardData();
        });
    }

    document.querySelectorAll("[data-nav-link]").forEach(link => {
        link.addEventListener("click", () => {
            document.querySelectorAll("[data-nav-link]").forEach(a => a.classList.remove("active"));
            link.classList.add("active");
        });
    });

    renderCalendar();
    loadDashboardData();
})();
