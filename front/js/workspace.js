// Auto-extracted from workspace.html
document.addEventListener('DOMContentLoaded', function () {
  
      // OS 切换
      document.querySelectorAll('[data-os-set]').forEach(btn => {
        btn.addEventListener('click', () => {
          const os = btn.dataset.osSet;
          document.body.dataset.os = os;
          document.querySelectorAll('[data-os-set]').forEach(b => b.classList.toggle('active', b === btn));
        });
      });
  
      // Toast
      const toastHost = document.getElementById('toasts');
      function toast(msg, kind = 'success') {
        const t = document.createElement('div');
        t.className = `toast ${kind}`;
        t.innerHTML = `<span class="seal sm" style="background:url(../../assets/logo.png) center/cover;color:transparent;">白</span><span>${msg}</span>`;
        toastHost.appendChild(t);
        setTimeout(() => { t.style.opacity = '0'; t.style.transform = 'translateX(20px)'; }, 2400);
        setTimeout(() => t.remove(), 2800);
      }
  
      // 作品图注入（水墨纹理）
      const artStyles = {
        'morning-glow': 'linear-gradient(160deg, #f8f3e3 0%, #d4a574 60%, #8b6f47 100%)',
        'lakeside-fog':  'linear-gradient(180deg, #e8e0cc 0%, #a4a896 50%, #5a6b58 100%)',
        'bamboo-shadow': 'linear-gradient(45deg, #f4ecd6 0%, #7a8a5a 50%, #2d3818 100%)',
        'tea-ceremony':  'radial-gradient(ellipse at 30% 30%, #d4a574 0%, #8b6f47 50%, #3d2817 100%)'
      };
      document.querySelectorAll('[data-art]').forEach(el => {
        const k = el.dataset.art;
        if (artStyles[k]) el.style.background = artStyles[k];
      });
  
      // 触发演示 toast
      setTimeout(() => toast('欢迎回来 · 已加载最近 7 天 32 件作品', 'success'), 800);
    
});
