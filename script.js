// دکمه مشاهده همه مربیان
const showMentorsBtn = document.getElementById("showMentorsBtn");

const mentorsList = document.querySelector(".mentors-list");

showMentorsBtn.addEventListener("click", function () {

    mentorsList.classList.toggle("show-all");

    if (mentorsList.classList.contains("show-all")) {

        showMentorsBtn.textContent = "نمایش کمتر ↑";

    } else {

        showMentorsBtn.textContent = "مشاهده همه مربیان ←";

    }

});
