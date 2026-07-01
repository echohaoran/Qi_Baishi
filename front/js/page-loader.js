/* ── 页面加载动画控制 · 水墨风 ─────────────────────────────────────
 *  白石 Baishi — 显示时机 / 淡出时机 / 导航拦截
 *  用法：<script src="js/page-loader.js"></script>
 * ────────────────────────────────────────────────────────────────── */
(function () {
  "use strict";

  var initialized = false;

  function init() {
    if (initialized) return;

    var loader = document.getElementById("page-loader");
    if (!loader) return;

    initialized = true;
    loader.hidden = true;
    loader.setAttribute("aria-hidden", "true");
    loader.classList.remove("is-visible", "is-transitioning", "is-handoff", "fade-out");
    loader.classList.add("is-idle");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
