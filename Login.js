"use strict";

(() => {
    const signupTab = document.getElementById("signupTab");
    const loginTab = document.getElementById("loginTab");

    const signupForm = document.getElementById("signupForm");
    const loginForm = document.getElementById("loginForm");

    const signupMessage = document.getElementById("signupMessage");
    const loginMessage = document.getElementById("loginMessage");

    const signupUsername = document.getElementById("signupUsername");
    const signupFullName = document.getElementById("signupFullName");
    const signupNationalCode = document.getElementById("signupNationalCode");
    const signupPhone = document.getElementById("signupPhone");
    const signupPassword = document.getElementById("signupPassword");
    const confirmPassword = document.getElementById("confirmPassword");

    const loginUsername = document.getElementById("loginUsername");
    const loginPassword = document.getElementById("loginPassword");

    const requiredElements = [
        signupTab, loginTab, signupForm, loginForm,
        signupMessage, loginMessage, signupUsername,
        signupPassword, confirmPassword, loginUsername, loginPassword
    ];

    if (requiredElements.some(element => !element)) {
        console.error("Authentication form elements are missing.");
        return;
    }

    const MIN_USERNAME_LENGTH = 3;
    const MAX_USERNAME_LENGTH = 24;
    const MIN_PASSWORD_LENGTH = 8;
    const MAX_PASSWORD_LENGTH = 128;
    const USERNAME_PATTERN = /^[A-Za-z0-9_]+$/;

    function showMessage(element, message, type) {
        if (!element) return;
        element.textContent = message;
        element.classList.remove("error", "success");
        if (type === "error" || type === "success") {
            element.classList.add(type);
        }
    }

    function redirectAfterAuth(user) {
        const next = new URLSearchParams(window.location.search).get("next");
        if (next && !next.startsWith("//") && !next.includes(":") && !next.startsWith("\\")) {
            window.location.href = next;
        } else if (user && user.role === "admin") {
            window.location.href = "dashboard/index.html";
        } else {
            window.location.href = "dashboard-login.html";
        }
    }

    function clearMessages() {
        showMessage(signupMessage, "", "");
        showMessage(loginMessage, "", "");
    }

    function showForm(type) {
        if (type !== "signup" && type !== "login") return;
        clearMessages();
        const isSignup = type === "signup";
        signupForm.classList.toggle("hidden", !isSignup);
        loginForm.classList.toggle("hidden", isSignup);
        signupTab.classList.toggle("active", isSignup);
        loginTab.classList.toggle("active", !isSignup);
        signupTab.setAttribute("aria-selected", String(isSignup));
        loginTab.setAttribute("aria-selected", String(!isSignup));
    }

    signupTab.addEventListener("click", () => showForm("signup"));
    loginTab.addEventListener("click", () => showForm("login"));

    document.querySelectorAll("[data-switch]").forEach(button => {
        button.addEventListener("click", () => {
            const target = button.dataset.switch;
            if (target === "signup" || target === "login") {
                showForm(target);
            }
        });
    });

    signupForm.addEventListener("submit", event => {
        event.preventDefault();
        clearMessages();

        const username = signupUsername.value.trim();
        const fullName = signupFullName ? signupFullName.value.trim() : username;
        const nationalCode = signupNationalCode ? signupNationalCode.value.trim() : "";
        const phone = signupPhone ? signupPhone.value.trim() : "";
        const password = signupPassword.value;
        const confirmation = confirmPassword.value;

        if (username.length < MIN_USERNAME_LENGTH || username.length > MAX_USERNAME_LENGTH) {
            showMessage(signupMessage, "نام کاربری باید بین ۳ تا ۲۴ کاراکتر باشد.", "error");
            return;
        }
        if (!fullName || !phone) {
            showMessage(signupMessage, "نام و نام خانوادگی و شماره تماس والد یا سرپرست را وارد کنید.", "error");
            return;
        }
        if (!USERNAME_PATTERN.test(username)) {
            showMessage(signupMessage, "نام کاربری فقط می‌تواند شامل حروف انگلیسی، اعداد و زیرخط باشد.", "error");
            return;
        }
        const passwordLength = Array.from(password).length;
        if (passwordLength < MIN_PASSWORD_LENGTH || passwordLength > MAX_PASSWORD_LENGTH) {
            showMessage(signupMessage, "رمز عبور باید بین ۸ تا ۱۲۸ کاراکتر باشد.", "error");
            return;
        }
        if (password !== confirmation) {
            showMessage(signupMessage, "رمزهای عبور با یکدیگر مطابقت ندارند.", "error");
            return;
        }

        (async () => {
            const button = signupForm.querySelector('[type="submit"]');
            button.disabled = true;
            try {
                await fetch("/api/auth/me/", { credentials: "same-origin" });
                const token = ((function(){try{return document.cookie||""}catch(_){return ""}})().match(/(?:^|;\s*)csrftoken=([^;]+)/) || [])[1] || "";
                const response = await fetch("/api/auth/register/", {
                    method: "POST",
                    credentials: "same-origin",
                    headers: { "Content-Type": "application/json", "X-CSRFToken": decodeURIComponent(token) },
                    body: JSON.stringify({
                        username,
                        password,
                        full_name: fullName,
                        phone,
                        national_code: nationalCode
                    })
                });
                const result = await response.json();
                if (!response.ok) throw new Error(result.error || "ثبت‌نام انجام نشد.");
                showMessage(signupMessage, "حساب کاربری با موفقیت ایجاد شد. در حال ورود به پنل کاربری…", "success");
                setTimeout(() => redirectAfterAuth(result.user), 450);
            } catch (error) {
                showMessage(signupMessage, error.message || "ارتباط با سرور برقرار نشد.", "error");
            } finally {
                button.disabled = false;
            }
        })();
    });

    loginForm.addEventListener("submit", event => {
        event.preventDefault();
        clearMessages();

        const username = loginUsername.value.trim();
        const password = loginPassword.value;

        if (!username || !password) {
            showMessage(loginMessage, "لطفاً نام کاربری و رمز عبور را وارد کنید.", "error");
            return;
        }
        if (username.length < MIN_USERNAME_LENGTH || username.length > MAX_USERNAME_LENGTH || !USERNAME_PATTERN.test(username)) {
            showMessage(loginMessage, "نام کاربری وارد شده معتبر نیست.", "error");
            return;
        }
        if (Array.from(password).length > MAX_PASSWORD_LENGTH) {
            showMessage(loginMessage, "طول رمز عبور بیش از حد مجاز است.", "error");
            return;
        }

        (async () => {
            const button = loginForm.querySelector('[type="submit"]');
            button.disabled = true;
            try {
                await fetch("/api/auth/me/", { credentials: "same-origin" });
                const token = ((function(){try{return document.cookie||""}catch(_){return ""}})().match(/(?:^|;\s*)csrftoken=([^;]+)/) || [])[1] || "";
                const response = await fetch("/api/auth/login/", {
                    method: "POST",
                    credentials: "same-origin",
                    headers: { "Content-Type": "application/json", "X-CSRFToken": decodeURIComponent(token) },
                    body: JSON.stringify({ username, password })
                });
                const result = await response.json();
                if (!response.ok) throw new Error(result.error || "ورود انجام نشد.");
                showMessage(loginMessage, "ورود موفق بود. در حال انتقال…", "success");
                setTimeout(() => redirectAfterAuth(result.user), 450);
            } catch (error) {
                showMessage(loginMessage, error.message || "ارتباط با سرور برقرار نشد.", "error");
            } finally {
                button.disabled = false;
            }
        })();
    });

    const params = new URLSearchParams(window.location.search);
    if (params.get("mode") === "login" || params.get("next")) {
        showForm("login");
    } else {
        showForm("signup");
    }
})();
