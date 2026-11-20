(() => {
  "use strict";
  const form=document.getElementById("registerForm");if(!form)return;
  const message=document.getElementById("registerMessage");
  const csrf=()=>{const m=(function(){try{return document.cookie||""}catch(_){return ""}})().match(/(?:^|;\s*)csrftoken=([^;]+)/);return m?decodeURIComponent(m[1]):"";};
  form.addEventListener("submit",async e=>{e.preventDefault();message.textContent="";const username=form.elements.username.value.trim(),password=form.elements.password.value,password2=document.getElementById("password2").value,button=form.querySelector('[type="submit"]');
    if(!/^[A-Za-z0-9_]{3,24}$/.test(username)){message.textContent="نام کاربری باید ۳ تا ۲۴ حرف انگلیسی، عدد یا زیرخط باشد.";message.className="form-message error";return;}
    if(password.length<8||password!==password2){message.textContent=password!==password2?"تکرار رمز عبور مطابقت ندارد.":"رمز عبور باید حداقل ۸ کاراکتر باشد.";message.className="form-message error";return;}
    button.disabled=true;try{await fetch("/api/auth/me/",{credentials:"same-origin"});const response=await fetch("/api/auth/register/",{method:"POST",credentials:"same-origin",headers:{"Content-Type":"application/json","X-CSRFToken":csrf()},body:JSON.stringify({username,password,full_name:form.elements.full_name.value.trim(),phone:form.elements.phone.value.trim()})});const data=await response.json();if(!response.ok)throw new Error(data.error||"ثبت‌نام انجام نشد.");message.textContent="حساب کاربری ساخته شد. در حال انتقال به پنل کاربری…";message.className="form-message success";const next=new URLSearchParams(location.search).get("next");setTimeout(()=>location.href=next&&!next.startsWith("//")&&!next.includes(":")?next:(data.user&&data.user.role==="admin"?"dashboard/index.html":"dashboard-login.html"),450);}catch(err){message.textContent=err.message;message.className="form-message error";}finally{button.disabled=false;}
  });
})();
