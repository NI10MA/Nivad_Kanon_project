
/* ==========================================
   LEARNING HUB
   COURSE DATA + CAROUSEL + DETAILS
========================================== */

(() => {

    "use strict";


    /* ======================================
       COURSE DATA
    ====================================== */

    const courses = [

        {
            title: "قرآن",
            description: "آموزش روخوانی، روان‌خوانی و آشنایی با مفاهیم قرآنی.",
            level: "سطح مقدماتی",
            color: "blue"
        },

        {
            title: "مهارت‌های زندگی",
            description: "تقویت مهارت‌های فردی، اجتماعی و تصمیم‌گیری.",
            level: "سطح عمومی",
            color: "purple"
        },

        {
            title: "فن بیان و سخنوری",
            description: "افزایش اعتمادبه‌نفس و توانایی صحبت در جمع.",
            level: "سطح عمومی",
            color: "orange"
        },

        {
            title: "تئاتر و بازیگری",
            description: "آشنایی با بازیگری، نمایش و پرورش خلاقیت.",
            level: "سطح مقدماتی",
            color: "green"
        },

        {
            title: "هوش مصنوعی دختران",
            description: "آشنایی با هوش مصنوعی و کاربردهای خلاقانه آن.",
            level: "سطح مقدماتی",
            color: "pink"
        },

        {
            title: "هوش مصنوعی پسران",
            description: "یادگیری مفاهیم و ابزارهای هوش مصنوعی.",
            level: "سطح مقدماتی",
            color: "gold"
        },

        {
            title: "نقاشی",
            description: "آموزش تکنیک‌های نقاشی و تقویت خلاقیت هنری.",
            level: "سطح مقدماتی",
            color: "orange"
        },

        {
            title: "مهارت‌های کامپیوتری",
            description: "آشنایی با کامپیوتر، نرم‌افزارها و مهارت‌های دیجیتال.",
            level: "سطح مقدماتی",
            color: "blue"
        },

        {
            title: "خوشنویسی",
            description: "آموزش اصول نوشتار زیبا و هنر خوشنویسی.",
            level: "سطح مقدماتی",
            color: "purple"
        },

        {
            title: "زبان مبتدی",
            description: "آشنایی با واژگان و مکالمات پایه زبان.",
            level: "سطح مقدماتی",
            color: "green"
        },

        {
            title: "موسیقی",
            description: "آشنایی با مبانی موسیقی، ریتم و نواختن.",
            level: "سطح مقدماتی",
            color: "pink"
        },

        {
            title: "ریاضیات",
            description: "تقویت مهارت حل مسئله و تفکر منطقی.",
            level: "سطح عمومی",
            color: "gold"
        },

        {
            title: "منبت‌کاری",
            description: "آشنایی با هنر منبت و تکنیک‌های کار با چوب.",
            level: "سطح مقدماتی",
            color: "orange"
        },

        {
            title: "علوم آزمایشگاهی",
            description: "آشنایی عملی با آزمایش‌های علمی و مشاهده پدیده‌ها.",
            level: "سطح مقدماتی",
            color: "blue"
        },

    ];

    
const educationalCourses = [
    {
        title: "قرآن",
        description: "آموزش روخوانی، روان‌خوانی و آشنایی با مفاهیم قرآنی.",
        level: "سطح مقدماتی",
        color: "blue"
    },
    {
        title: "مهارت‌های زندگی",
        description: "تقویت مهارت‌های فردی، اجتماعی و تصمیم‌گیری.",
        level: "سطح عمومی",
        color: "purple"
    },
    {
        title: "فن بیان و سخنوری",
        description: "افزایش اعتمادبه‌نفس و توانایی صحبت در جمع.",
        level: "سطح عمومی",
        color: "orange"
    },
    {
        title: "تئاتر و بازیگری",
        description: "آشنایی با بازیگری، نمایش و پرورش خلاقیت.",
        level: "سطح مقدماتی",
        color: "green"
    },
    {
        title: "هوش مصنوعی دختران",
        description: "آشنایی با هوش مصنوعی و کاربردهای خلاقانه آن.",
        level: "سطح مقدماتی",
        color: "pink"
    },
    {
        title: "هوش مصنوعی پسران",
        description: "یادگیری مفاهیم و ابزارهای هوش مصنوعی.",
        level: "سطح مقدماتی",
        color: "gold"
    },
    {
        title: "نقاشی",
        description: "آموزش تکنیک‌های نقاشی و تقویت خلاقیت هنری.",
        level: "سطح مقدماتی",
        color: "orange"
    },
    {
        title: "مهارت‌های کامپیوتری",
        description: "آشنایی با کامپیوتر، نرم‌افزارها و مهارت‌های دیجیتال.",
        level: "سطح مقدماتی",
        color: "blue"
    },
    {
        title: "خوشنویسی",
        description: "آموزش اصول نوشتار زیبا و هنر خوشنویسی.",
        level: "سطح مقدماتی",
        color: "purple"
    },
    {
        title: "زبان مبتدی",
        description: "آشنایی با واژگان و مکالمات پایه زبان.",
        level: "سطح مقدماتی",
        color: "green"
    },
    {
        title: "موسیقی",
        description: "آشنایی با مبانی موسیقی، ریتم و نواختن.",
        level: "سطح مقدماتی",
        color: "pink"
    },
    {
        title: "ریاضیات",
        description: "تقویت مهارت حل مسئله و تفکر منطقی.",
        level: "سطح عمومی",
        color: "gold"
    },
    {
        title: "منبت‌کاری",
        description: "آشنایی با هنر منبت و تکنیک‌های کار با چوب.",
        level: "سطح مقدماتی",
        color: "orange"
    },
    {
        title: "علوم آزمایشگاهی",
        description: "آشنایی عملی با آزمایش‌های علمی و مشاهده پدیده‌ها.",
        level: "سطح مقدماتی",
        color: "blue"
    }
];

const sportsCourses = [
    {
        title: "تیراندازی آقایان",
        description: "آشنایی با اصول ایمنی و مبانی ورزشی تیراندازی زیر نظر مربی.",
        level: "سطح مقدماتی",
        color: "green"
    },
    {
        title: "تکواندو پسران",
        description: "آشنایی با فنون پایه تکواندو و اصول آمادگی ورزشی.",
        level: "سطح مقدماتی",
        color: "orange"
    },
    {
        title: "شطرنج",
        description: "آموزش قوانین، تاکتیک‌ها و تقویت تفکر استراتژیک.",
        level: "سطح مقدماتی",
        color: "blue"
    },
    {
        title: "تیراندازی بانوان",
        description: "آشنایی با اصول ایمنی و مبانی ورزشی تیراندازی زیر نظر مربی.",
        level: "سطح مقدماتی",
        color: "green"
    },
    {
        title: "تکواندو دختران",
        description: "آشنایی با فنون پایه تکواندو و اصول آمادگی ورزشی.",
        level: "سطح مقدماتی",
        color: "orange"
    },
    {
        title: "کاراته دختران",
        description: "آشنایی با فنون پایه کاراته و اصول آمادگی جسمانی.",
        level: "سطح مقدماتی",
        color: "purple"
    },
    {
        title: "ژیمناستیک پسران",
        description: "آشنایی با حرکات پایه ژیمناستیک و تمرین‌های تعادلی.",
        level: "سطح مقدماتی",
        color: "gold"
    },
    {
        title: "ژیمناستیک دختران",
        description: "آشنایی با حرکات پایه ژیمناستیک و تمرین‌های تعادلی.",
        level: "سطح مقدماتی",
        color: "gold"
    },
    {
        title: "ایروبیک و پیلاتس",
        description: "تمرین‌های حرکتی، انعطاف‌پذیری و تقویت هماهنگی بدن.",
        level: "سطح عمومی",
        color: "pink"
    },
    {
        title: "بازی و ورزش کودکان",
        description: "فعالیت‌های حرکتی و بازی‌های گروهی متناسب با کودکان.",
        level: "سطح مقدماتی",
        color: "pink"
    },
    {
        title: "ورزش سالمندان",
        description: "فعالیت‌های حرکتی متناسب با توانایی و شرایط سنی سالمندان.",
        level: "سطح عمومی",
        color: "blue"
    }
];

    /* ======================================
       ELEMENTS
    ====================================== */

    const panels = document.querySelectorAll(
        "[data-course-panel]"
    );

    const dialog = document.getElementById("courseDialog");

    const dialogTitle = document.getElementById(
        "dialogCourseTitle"
    );

    const dialogDescription = document.getElementById(
        "dialogCourseDescription"
    );


    /* ======================================
       COURSE CARD TEMPLATE
    ====================================== */

    function createCourseCard(course, type) {

        const category = type === "sports"
        ? "ورزشی"
        : type === "in-person"
            ? "حضوری"
            : "آنلاین";

        const article = document.createElement("article");

        article.className = "course-card";

        const image = document.createElement("div");

        image.className =
            `course-card__image course-card__image--${course.color}`;

        const categoryLabel = document.createElement("span");

        categoryLabel.className = "course-card__category";
        categoryLabel.textContent = category;

        image.appendChild(categoryLabel);

        image.insertAdjacentHTML(
            "beforeend",
            `
                <svg viewBox="0 0 120 80" aria-hidden="true">
                    <path d="M18 65 43 29 64 55 79 39 105 65Z"></path>
                    <circle cx="83" cy="20" r="8"></circle>
                </svg>
            `
        );

        const body = document.createElement("div");

        body.className = "course-card__body";

        const title = document.createElement("h4");
        title.textContent = course.title;

        const description = document.createElement("p");
        description.textContent = course.description;

        const meta = document.createElement("div");
        meta.className = "course-card__meta";

        const level = document.createElement("span");
        level.textContent = course.level;

        const dot = document.createElement("span");
        dot.textContent = "●";

        meta.append(level, dot);

        const button = document.createElement("button");

        button.className = "course-card__button";
        button.type = "button";

        button.innerHTML = `
            مشاهده جزئیات
            <span>←</span>
        `;

        button.addEventListener("click", () => {

            dialogTitle.textContent = course.title;

            dialogDescription.textContent = course.description;

            if (dialog && !dialog.open) {
                dialog.showModal();
            }

        });

        body.append(
            title,
            description,
            meta,
            button
        );

        article.append(image, body);

        return article;

    }


    /* ======================================
       INITIALIZE EACH CAROUSEL
    ====================================== */

    function initializeCarousel(panel) {

        const type = panel.dataset.coursePanel;

        const courses = type === "sports"
        ? sportsCourses
        : educationalCourses;

        const track = panel.querySelector(".course-track");

        const dotsContainer = panel.querySelector(".carousel-dots");

        const previousButton = panel.querySelector(
            "[data-carousel-prev]"
        );

        const nextButton = panel.querySelector(
            "[data-carousel-next]"
        );

        const countElement = panel.querySelector(
            "[data-course-count]"
        );

        if (!track || !dotsContainer) return;


        const pageSize = 3;

        const pageCount = Math.ceil(courses.length / pageSize);

        let currentPage = 0;


        /* Course count */

        countElement.textContent =
            `${new Intl.NumberFormat("fa-IR").format(courses.length)} دوره`;


        /* Create slides */

        for (let i = 0; i < pageCount; i++) {

            const slide = document.createElement("div");

            slide.className = "course-slide";

            const start = i * pageSize;

            const pageCourses = courses.slice(
                start,
                start + pageSize
            );

            pageCourses.forEach(course => {

                slide.appendChild(
                    createCourseCard(course, type)
                );

            });

            track.appendChild(slide);


            /* Create pagination dot */

            const dot = document.createElement("button");

            dot.className = "carousel-dot";

            dot.type = "button";

            dot.setAttribute(
                "aria-label",
                `صفحه ${i + 1}`
            );

            dot.addEventListener("click", () => {
                goToPage(i);
            });

            dotsContainer.appendChild(dot);

        }


        /* Update carousel */

        function updateCarousel() {

            track.style.transform =
                `translateX(-${currentPage * 100}%)`;

            const dots = dotsContainer.querySelectorAll(
                ".carousel-dot"
            );

            dots.forEach((dot, index) => {

                const active = index === currentPage;

                dot.classList.toggle("is-active", active);

                if (active) {
                    dot.setAttribute("aria-current", "true");
                } else {
                    dot.removeAttribute("aria-current");
                }

            });

            previousButton.disabled = currentPage === 0;

            nextButton.disabled = currentPage === pageCount - 1;

        }


        /* Go to specific page */

        function goToPage(index) {

            currentPage = Math.max(
                0,
                Math.min(index, pageCount - 1)
            );

            updateCarousel();

        }


        /* Navigation */

        previousButton.addEventListener("click", () => {
            goToPage(currentPage - 1);
        });

        nextButton.addEventListener("click", () => {
            goToPage(currentPage + 1);
        });


        updateCarousel();

    }


    /* ======================================
       CLOSE COURSE DIALOG
    ====================================== */

    if (dialog) {

        dialog.querySelectorAll("[data-dialog-close]")
            .forEach(button => {

                button.addEventListener("click", () => {
                    dialog.close();
                });

            });

        dialog.addEventListener("click", event => {

            if (event.target === dialog) {
                dialog.close();
            }

        });

    }


    /* ======================================
       START
    ====================================== */

    panels.forEach(initializeCarousel);

})();
