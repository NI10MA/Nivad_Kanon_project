
/* =====================================================
   LEARNING HUB
   Course Carousel + Course Details + Reservations
   ===================================================== */

(() => {

    "use strict";


    /* =================================================
       CAROUSEL
       ================================================= */

    const carousels = document.querySelectorAll("[data-carousel]");


    carousels.forEach((carousel) => {

        const panel = carousel.closest(".course-panel");

        const track = carousel.querySelector(".course-track");

        const slides = [...track.children];

        const previousButton = panel.querySelector("[data-carousel-prev]");

        const nextButton = panel.querySelector("[data-carousel-next]");

        const dots = [...panel.querySelectorAll(".carousel-dot")];

        let currentIndex = 0;

        const totalSlides = slides.length;


        /* ---------- Update Carousel ---------- */

        function updateCarousel() {

            const offset = currentIndex * 100;

            track.style.transform = `translateX(${offset}%)`;


            dots.forEach((dot, index) => {

                const isActive = index === currentIndex;

                dot.classList.toggle("is-active", isActive);

                if (isActive) {

                    dot.setAttribute("aria-current", "true");

                } else {

                    dot.removeAttribute("aria-current");

                }

            });

        }


        /* ---------- Next Slide ---------- */

        function nextSlide() {

            currentIndex = (currentIndex + 1) % totalSlides;

            updateCarousel();

        }


        /* ---------- Previous Slide ---------- */

        function previousSlide() {

            currentIndex = (currentIndex - 1 + totalSlides) % totalSlides;

            updateCarousel();

        }


        /* ---------- Arrow Events ---------- */

        nextButton?.addEventListener("click", nextSlide);

        previousButton?.addEventListener("click", previousSlide);


        /* ---------- Dot Events ---------- */

        dots.forEach((dot, index) => {

            dot.addEventListener("click", () => {

                currentIndex = index;

                updateCarousel();

            });

        });


        /* ---------- Initial State ---------- */

        updateCarousel();

    });



    /* =================================================
       COURSE DETAILS DIALOG
       ================================================= */

    const courseDialog = document.getElementById("courseDialog");

    const dialogTitle = document.getElementById("dialogCourseTitle");

    const dialogDescription = document.getElementById("dialogCourseDescription");

    const courseButtons = document.querySelectorAll("[data-course-title]");

    const closeButtons = document.querySelectorAll("[data-dialog-close]");


    /* ---------- Open Course Details ---------- */

    courseButtons.forEach((button) => {

        button.addEventListener("click", () => {

            const title = button.dataset.courseTitle;

            const description = button.dataset.courseDescription;


            dialogTitle.textContent = title;

            dialogDescription.textContent = description;


            if (typeof courseDialog.showModal === "function") {

                courseDialog.showModal();

            }

        });

    });


    /* ---------- Close Dialog ---------- */

    closeButtons.forEach((button) => {

        button.addEventListener("click", () => {

            courseDialog.close();

        });

    });


    /* ---------- Close On Backdrop ---------- */

    courseDialog?.addEventListener("click", (event) => {

        if (event.target === courseDialog) {

            courseDialog.close();

        }

    });



    /* =================================================
       RESERVATION NOTIFICATION
       ================================================= */

    const reservationButtons = document.querySelectorAll("[data-reservation]");

    const toast = document.getElementById("learningToast");

    let toastTimer = null;


    /* ---------- Show Notification ---------- */

    function showToast(message) {

        if (!toast) return;

        toast.textContent = message;

        toast.classList.add("is-visible");


        clearTimeout(toastTimer);

        toastTimer = setTimeout(() => {

            toast.classList.remove("is-visible");

        }, 3500);

    }


    /* ---------- Reservation Events ---------- */

    reservationButtons.forEach((button) => {

        button.addEventListener("click", () => {

            const hallName = button.dataset.reservation;

            showToast(
                `بخش ثبت درخواست ${hallName} هنوز به سامانه رزرو متصل نشده است.`
            );

        });

    });


})();
