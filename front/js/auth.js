document.addEventListener('DOMContentLoaded', function () {

  // ─── Toast ─────────────────────────────────────────
  function toast(msg, kind) {
    kind = kind || 'success';
    const t = document.createElement('div');
    t.className = 'toast ' + kind;
    t.innerHTML = '<span class="seal sm" style="background:url(../../assets/logo.png) center/cover;color:transparent;">白</span><span>' + msg + '</span>';
    document.getElementById('toasts').appendChild(t);
    setTimeout(() => { t.style.opacity = '0'; t.style.transform = 'translateX(20px)'; }, 2400);
    setTimeout(() => t.remove(), 2800);
  }

  // ─── Validation utilities ─────────────────────────
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const PWD_RE = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/;
  const CODE_RE = /^\d{6}$/;

  function setFieldError(field, message) {
    const input = field.querySelector('.input');
    const errEl = field.querySelector('.field-err');
    if (errEl) errEl.textContent = message || '';
    if (input) input.setAttribute('aria-invalid', message ? 'true' : 'false');
    field.setAttribute('data-invalid', message ? 'true' : 'false');
  }

  function clearAllErrors() {
    document.querySelectorAll('.field[data-field]').forEach(f => setFieldError(f, ''));
  }

  // ─── DOM refs ─────────────────────────────────────
  let mode = 'login';
  const title = document.getElementById('auth-title');
  const sub = document.getElementById('auth-sub');
  const submitBtn = document.getElementById('submit-btn');
  const submitLabel = submitBtn.querySelector('.btn-label');
  const switchText = document.getElementById('switch-text');
  const switchLink = document.getElementById('switch-link');
  const confirmField = document.getElementById('confirm-field');
  const forgotLink = document.getElementById('forgot-link');
  const codeField = document.getElementById('code-field');
  const codeInput = document.getElementById('code');
  const emailInput = document.getElementById('email');
  const passwordInput = document.getElementById('password');
  const confirmInput = document.getElementById('confirm');
  const sendCodeBtn = document.getElementById('send-code-btn');
  const revealBtn = document.getElementById('reveal-password');
  const emailField = emailInput.closest('.field');
  const passwordField = passwordInput.closest('.field');
  const codeFieldRow = document.getElementById('code-field');
  const confirmFieldRow = document.getElementById('confirm-field');
  const SEND_CODE_LABEL = '发送验证码';
  const RESEND_LABEL = '重新发送';
  let countdownTimer = null;
  let countdownLeft = 0;

  // ─── Send-code button state machine ──────────────
  function setSendCodeBtnState(state, label) {
    sendCodeBtn.classList.remove('counting');
    if (state === 'idle') {
      sendCodeBtn.disabled = false;
      sendCodeBtn.textContent = label || SEND_CODE_LABEL;
    } else if (state === 'sent') {
      sendCodeBtn.classList.add('counting');
      sendCodeBtn.disabled = true;
      sendCodeBtn.textContent = label;
    } else if (state === 'disabled') {
      sendCodeBtn.disabled = true;
      sendCodeBtn.textContent = label || SEND_CODE_LABEL;
    }
  }

  function startCountdown(seconds) {
    countdownLeft = seconds;
    setSendCodeBtnState('sent', '已发送 · ' + countdownLeft + 's 后重发');
    emailInput.readOnly = true;
    if (countdownTimer) clearInterval(countdownTimer);
    countdownTimer = setInterval(() => {
      countdownLeft -= 1;
      if (countdownLeft <= 0) {
        clearInterval(countdownTimer);
        countdownTimer = null;
        setSendCodeBtnState('idle', RESEND_LABEL);
      } else {
        setSendCodeBtnState('sent', '已发送 · ' + countdownLeft + 's 后重发');
      }
    }, 1000);
  }

  // ─── Submit button loading state ──────────────────
  function setSubmitLoading(busy, label) {
    submitBtn.setAttribute('aria-busy', busy ? 'true' : 'false');
    if (label) submitLabel.textContent = label;
  }

  // ─── Field-level validation ───────────────────────
  function validateEmailField() {
    const v = emailInput.value.trim();
    if (!v) { setFieldError(emailField, ''); return false; }
    if (!EMAIL_RE.test(v)) {
      setFieldError(emailField, '请输入有效的邮箱地址');
      return false;
    }
    setFieldError(emailField, '');
    return true;
  }
  function validatePasswordField() {
    const v = passwordInput.value;
    if (!v) { setFieldError(passwordField, ''); return false; }
    if (!PWD_RE.test(v)) {
      setFieldError(passwordField, '至少 8 位，且需同时含字母与数字');
      return false;
    }
    setFieldError(passwordField, '');
    return true;
  }
  function validateCodeField() {
    const v = codeInput.value.trim();
    if (!v) { setFieldError(codeFieldRow, ''); return false; }
    if (!CODE_RE.test(v)) {
      setFieldError(codeFieldRow, '请输入 6 位数字验证码');
      return false;
    }
    setFieldError(codeFieldRow, '');
    return true;
  }
  function validateConfirmField() {
    const v = confirmInput.value;
    if (!v) { setFieldError(confirmFieldRow, ''); return false; }
    if (v !== passwordInput.value) {
      setFieldError(confirmFieldRow, '两次输入的密码不一致');
      return false;
    }
    setFieldError(confirmFieldRow, '');
    return true;
  }

  // ─── Listeners ────────────────────────────────────
  emailInput.addEventListener('input', () => {
    if (countdownTimer) { clearInterval(countdownTimer); countdownTimer = null; }
    emailInput.readOnly = false;
    validateEmailField();
    const valid = EMAIL_RE.test(emailInput.value.trim());
    setSendCodeBtnState(valid ? 'idle' : 'disabled', SEND_CODE_LABEL);
  });
  emailInput.addEventListener('blur', validateEmailField);
  passwordInput.addEventListener('input', validatePasswordField);
  passwordInput.addEventListener('blur', () => {
    validatePasswordField();
    if (mode === 'register' && confirmInput.value) validateConfirmField();
  });
  codeInput.addEventListener('input', () => {
    codeInput.value = codeInput.value.replace(/\D/g, '').slice(0, 6);
    validateCodeField();
  });
  codeInput.addEventListener('blur', validateCodeField);
  confirmInput.addEventListener('input', validateConfirmField);
  confirmInput.addEventListener('blur', validateConfirmField);

  // Send-code click
  sendCodeBtn.addEventListener('click', () => {
    if (sendCodeBtn.disabled) return;
    const email = emailInput.value.trim();
    if (!EMAIL_RE.test(email)) {
      validateEmailField();
      emailInput.focus();
      return;
    }
    sendCodeBtn.disabled = true;
    sendCodeBtn.textContent = '发送中…';
    setTimeout(() => {
      toast('验证码已发送至 ' + email);
      startCountdown(60);
      codeInput.value = '';
      setFieldError(codeFieldRow, '');
      codeInput.focus();
    }, 600);
  });

  // Password reveal toggle
  revealBtn.addEventListener('click', () => {
    const shown = revealBtn.getAttribute('aria-pressed') === 'true';
    const next = !shown;
    passwordInput.type = next ? 'text' : 'password';
    confirmInput.type = next ? 'text' : 'password';
    revealBtn.setAttribute('aria-pressed', String(next));
    revealBtn.setAttribute('aria-label', next ? '隐藏密码' : '显示密码');
    revealBtn.textContent = next ? '隐藏' : '显示';
  });

  // Mode switch
  switchLink.addEventListener('click', e => {
    e.preventDefault();
    mode = mode === 'login' ? 'register' : 'login';
    clearAllErrors();
    if (countdownTimer) { clearInterval(countdownTimer); countdownTimer = null; }
    if (mode === 'register') {
      title.textContent = '加入白石';
      sub.textContent = '企业邮箱 · 验证码 · 密码，三十秒开始创作';
      submitLabel.textContent = '注册账户';
      switchText.textContent = '已有账户？';
      switchLink.textContent = '直接登录';
      confirmField.style.display = 'flex';
      codeField.style.display = 'flex';
      forgotLink.style.display = 'none';
      sendCodeBtn.hidden = false;
      const valid = EMAIL_RE.test(emailInput.value.trim());
      setSendCodeBtnState(valid ? 'idle' : 'disabled', SEND_CODE_LABEL);
    } else {
      title.textContent = '欢迎回来';
      sub.textContent = '以企业邮箱 + 密码登录你的白石';
      submitLabel.textContent = '登录';
      switchText.textContent = '还没有账户？';
      switchLink.textContent = '立即注册';
      confirmField.style.display = 'none';
      codeField.style.display = 'none';
      forgotLink.style.display = '';
      sendCodeBtn.hidden = true;
      emailInput.readOnly = false;
      setSendCodeBtnState('idle', SEND_CODE_LABEL);
    }
  });

  // Submit
  document.getElementById('auth-form').addEventListener('submit', e => {
    e.preventDefault();
    clearAllErrors();

    const emailOk = validateEmailField();
    const pwdOk = validatePasswordField();
    if (!emailOk || !pwdOk) {
      if (!emailOk) emailInput.focus();
      else passwordInput.focus();
      return;
    }

    if (mode === 'register') {
      const codeOk = validateCodeField();
      const confirmOk = validateConfirmField();
      if (!codeOk) { codeInput.focus(); return; }
      if (!confirmOk) { confirmInput.focus(); return; }
      if (countdownTimer) { clearInterval(countdownTimer); countdownTimer = null; }
      setSubmitLoading(true, '验证中…');
      setTimeout(() => {
        setSubmitLoading(false, '注册账户');
        toast('注册成功 · 正在进入白石…');
        setTimeout(() => location.href = 'workspace.html', 800);
      }, 1200);
    } else {
      setSubmitLoading(true, '登录中…');
      setTimeout(() => {
        setSubmitLoading(false, '登录');
        toast('登录成功 · 欢迎回来');
        setTimeout(() => location.href = 'workspace.html', 800);
      }, 1000);
    }
  });

  // Forgot-password (no-op wiring; placeholder for future flow)
  forgotLink.addEventListener('click', () => {
    const email = emailInput.value.trim();
    if (email && EMAIL_RE.test(email)) {
      toast('重置链接已发送至 ' + email);
    } else {
      toast('请先在邮箱字段输入企业邮箱', 'error');
      emailInput.focus();
    }
  });

});
