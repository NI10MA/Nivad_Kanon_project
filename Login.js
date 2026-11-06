// =====================================
// ELEMENTS
// =====================================

const signupTab = document.getElementById("signupTab");
const loginTab = document.getElementById("loginTab");

const signupForm = document.getElementById("signupForm");
const loginForm = document.getElementById("loginForm");

const signupMessage = document.getElementById("signupMessage");
const loginMessage = document.getElementById("loginMessage");


// =====================================
// SWITCH BETWEEN FORMS
// =====================================

function showForm(type) {

    signupMessage.textContent = "";
    loginMessage.textContent = "";

    signupMessage.className = "form-message";
    loginMessage.className = "form-message";

    if (type === "signup") {

        signupForm.classList.remove("hidden");
        loginForm.classList.add("hidden");

        signupTab.classList.add("active");
        loginTab.classList.remove("active");

    } else {

        loginForm.classList.remove("hidden");
        signupForm.classList.add("hidden");

        loginTab.classList.add("active");
        signupTab.classList.remove("active");

    }

}


// Tab buttons

signupTab.addEventListener("click", () => {
    showForm("signup");
});

loginTab.addEventListener("click", () => {
    showForm("login");
});


// Buttons inside forms

document.querySelectorAll("[data-switch]").forEach(button => {

    button.addEventListener("click", () => {
        showForm(button.dataset.switch);
    });

});


// =====================================
// SIGNUP FORM
// =====================================

signupForm.addEventListener("submit", function (event) {

    event.preventDefault();

    const username = document.getElementById("signupUsername").value.trim();

    const password = document.getElementById("signupPassword").value;

    const confirmPassword = document.getElementById("confirmPassword").value;


    // Username validation

    if (username.length < 3) {

        showMessage(
            signupMessage,
            "نام کاربری باید حداقل ۳ کاراکتر باشد.",
            "error"
        );

        return;
    }


    // Password validation

    if (password.length < 8) {

        showMessage(
            signupMessage,
            "رمز عبور باید حداقل ۸ کاراکتر باشد.",
            "error"
        );

        return;
    }


    // Confirm password

    if (password !== confirmPassword) {

        showMessage(
            signupMessage,
            "رمزهای عبور با یکدیگر مطابقت ندارند.",
            "error"
        );

        return;
    }


    showMessage(
        signupMessage,
        "اعتبارسنجی اولیه موفق بود؛ برای ایجاد حساب واقعی باید سرور متصل شود.",
        "success"
    );

});


// =====================================
// LOGIN FORM
// =====================================

loginForm.addEventListener("submit", function (event) {

    event.preventDefault();

    const username = document.getElementById("loginUsername").value.trim();

    const password = document.getElementById("loginPassword").value;


    if (!username || !password) {

        showMessage(
            loginMessage,
            "لطفاً نام کاربری و رمز عبور را وارد کنید.",
            "error"
        );

        return;
    }


    showMessage(
        loginMessage,
        "فرم معتبر است؛ برای بررسی حساب کاربری باید بک‌اند متصل شود.",
        "success"
    );

});


// =====================================
// MESSAGE FUNCTION
// =====================================

function showMessage(element, message, type) {

    element.textContent = message;

    element.className = "form-message " + type;

}