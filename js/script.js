// مدیریت دکمه مشاهده همه مربیان در صفحه اصلی
(() => {
  "use strict";
  const showMentorsBtn = document.getElementById("showMentorsBtn");
  const mentorsList = document.querySelector(".mentors-list");

  if (showMentorsBtn && mentorsList) {
    showMentorsBtn.addEventListener("click", () => {
      mentorsList.classList.toggle("show-all");
      if (mentorsList.classList.contains("show-all")) {
        showMentorsBtn.textContent = "نمایش کمتر ↑";
      } else {
        showMentorsBtn.textContent = "مشاهده همه مربیان ←";
      }
    });
  }
})();
