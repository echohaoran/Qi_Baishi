// Auto-extracted from presets.html
document.addEventListener('DOMContentLoaded', function () {
  
      document.querySelectorAll('[data-os-set]').forEach(btn => {
        btn.addEventListener('click', () => {
          document.body.dataset.os = btn.dataset.osSet;
          document.querySelectorAll('[data-os-set]').forEach(b => b.classList.toggle('active', b === btn));
        });
      });
  
      function toast(msg, kind = 'success') {
        const t = document.createElement('div');
        t.className = `toast ${kind}`;
        t.innerHTML = `<span class="seal sm" style="background:url(logo.png) center/cover;color:transparent;">白</span><span>${msg}</span>`;
        document.getElementById('toasts').appendChild(t);
        setTimeout(() => { t.style.opacity = '0'; t.style.transform = 'translateX(20px)'; }, 2400);
        setTimeout(() => t.remove(), 2800);
      }
  
      // ── Sub-nav 切换 ───────────────────────────
      function switchTab(tab) {
        document.querySelectorAll('.sub-nav .item').forEach(x => x.classList.toggle('active', x.dataset.tab === tab));
        document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
        const target = document.getElementById('panel-' + tab);
        if (target) target.classList.add('active');
      }
      document.querySelectorAll('.sub-nav .item').forEach(item => {
        item.addEventListener('click', () => switchTab(item.dataset.tab));
      });
  
      // ── Edit mode 状态 ───────────────────────────
      const editMode = { gallery: false, copywriting: false };
      function toggleEditMode(panel) {
        editMode[panel] = !editMode[panel];
        document.body.classList.toggle('edit-mode-' + panel, editMode[panel]);
        const btn = document.getElementById('edit-toggle-' + panel);
        btn.classList.toggle('active', editMode[panel]);
        btn.querySelector('.label').textContent = editMode[panel] ? '完成管理' : '管理';
        hideAllDeleteConfirms();
        if (panel === 'gallery') renderPresets({ animate: false });
        else renderTextStyles({ animate: false });
        toast(editMode[panel] ? '已进入管理模式 · 增删改启用' : '已退出管理模式');
      }
      document.getElementById('edit-toggle-gallery').addEventListener('click', () => toggleEditMode('gallery'));
      document.getElementById('edit-toggle-copywriting').addEventListener('click', () => toggleEditMode('copywriting'));
  
      // ── filter / search / sort（画廊 / 妙笔生花） ─────────────
      const filterState = { gallery: { cat: 'all', q: '', sort: 'newest' }, copywriting: { cat: 'all', q: '', sort: 'newest' } };
      function applyFilter(items, panel) {
        const s = filterState[panel];
        let arr = items.slice();
        if (s.cat && s.cat !== 'all') arr = arr.filter(x => x.cat === s.cat);
        if (s.q) {
          const q = s.q.toLowerCase().trim();
          arr = arr.filter(x =>
            (x.name || '').toLowerCase().includes(q) ||
            (x.prompt || '').toLowerCase().includes(q) ||
            (x.desc || '').toLowerCase().includes(q) ||
            (x.tags || []).some(t => (t || '').toLowerCase().includes(q))
          );
        }
        if (s.sort === 'hot' || s.sort === 'rating') arr.reverse();
        return arr;
      }
      function wireFilter(panel, renderFn) {
        const root = document.getElementById('panel-' + panel);
        if (!root) return;
        root.querySelectorAll('.filter-bar .chips .tag').forEach(chip => {
          chip.addEventListener('click', () => {
            root.querySelectorAll('.filter-bar .chips .tag').forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            filterState[panel].cat = chip.dataset.cat || 'all';
            renderFn({ animate: false });
          });
        });
        const search = root.querySelector('.input-search');
        if (search) search.addEventListener('input', e => { filterState[panel].q = e.target.value; renderFn({ animate: false }); });
        const sort = root.querySelector('.select');
        if (sort) sort.addEventListener('change', e => { filterState[panel].sort = e.target.value; renderFn({ animate: false }); });
      }
      // 监听器在 renderPresets / renderTextStyles 定义后再调用
  
      // ── 渐变 / 墨色 生成器（用于新加项） ─────────────
      const gradientPalettes = [
        ['#f8f3e3', '#d4c8a8', '#a8987a'],
        ['#e8e0cc', '#a4a896', '#5a6b58'],
        ['#d4c8a8', '#8a7a5a', '#3a2e1c'],
        ['#e8d8b0', '#c4a574', '#6a4a2a'],
        ['#f4ecd6', '#a8987a', '#2a2018'],
        ['#c89870', '#8a4a3a', '#2a1a14'],
        ['#f8f3e3', '#c4a574', '#2a1f15'],
        ['#d4a574', '#5a3a20', '#2a1a18'],
        ['#6a8a8a', '#4a6a5a', '#2a3a2a'],
        ['#e8d4b4', '#a88064', '#4a2a1a'],
      ];
      // 低饱和度渐变背景（S ≤ 20% HSL），每张文案卡分到不同色相
      const inkPalettes = [
        'linear-gradient(160deg, hsl(40, 16%, 89%) 0%, hsl(35, 14%, 76%) 100%)',   // 暖米白
        'linear-gradient(160deg, hsl(30, 10%, 84%) 0%, hsl(25, 10%, 68%) 100%)',   // 暖砂石
        'linear-gradient(160deg, hsl(80, 12%, 82%) 0%, hsl(70, 10%, 62%) 100%)',   // 远山青
        'linear-gradient(160deg, hsl(200, 8%, 85%) 0%, hsl(195, 10%, 70%) 100%)',  // 晓岚蓝
        'linear-gradient(160deg, hsl(15, 14%, 85%) 0%, hsl(10, 12%, 68%) 100%)',   // 暮山赭
        'linear-gradient(160deg, hsl(30, 6%, 78%) 0%, hsl(25, 8%, 56%) 100%)',     // 沉墨
        'linear-gradient(160deg, hsl(38, 20%, 87%) 0%, hsl(32, 18%, 72%) 100%)',   // 麦秸黄
        'linear-gradient(160deg, hsl(220, 5%, 72%) 0%, hsl(220, 6%, 48%) 100%)',  // 玄青
      ];
      function hashCode(s) {
        let h = 0;
        for (let i = 0; i < s.length; i++) { h = ((h << 5) - h) + s.charCodeAt(i); h |= 0; }
        return Math.abs(h);
      }
      function genGradient(name) {
        const c = gradientPalettes[hashCode(name) % gradientPalettes.length];
        const angle = (hashCode(name + 'a') % 4) * 90;
        return `linear-gradient(${angle}deg, ${c[0]} 0%, ${c[1]} 50%, ${c[2]} 100%)`;
      }
      function genInk(name) {
        return inkPalettes[hashCode(name + 'i') % inkPalettes.length];
      }

      // 笔触 SVG：按分类生成不同笔意纹理
      function brushSvg(cat, name) {
        const h = hashCode(name);
        const tilt = (h % 7) - 3; // -3..3 deg
        const skew = ((h >> 3) % 5) - 2;
        const color = 'rgba(29,24,20,0.55)';
        const ink = 'rgba(29,24,20,0.85)';
        if (cat === '山水') {
          // 远山：底部 3 段山影 + 太阳/月亮
          const sunY = 18 + (h % 18);
          return `<svg viewBox="0 0 100 75" preserveAspectRatio="xMidYMid slice" style="transform:rotate(${tilt * 0.4}deg)">
            <circle cx="${30 + (h % 40)}" cy="${sunY}" r="6" fill="${color}" opacity="0.4"/>
            <path d="M0,75 L0,52 Q15,42 28,48 T55,42 Q72,38 88,46 T100,50 L100,75 Z" fill="${ink}" opacity="0.55"/>
            <path d="M0,75 L0,60 Q20,55 38,58 T68,55 Q84,52 100,58 L100,75 Z" fill="${ink}" opacity="0.78"/>
            <path d="M0,75 L0,68 L100,66 L100,75 Z" fill="${ink}" opacity="0.92"/>
          </svg>`;
        }
        if (cat === '花鸟') {
          // 枯枝：3 段分叉枝条 + 几片花瓣点缀
          return `<svg viewBox="0 0 100 75" preserveAspectRatio="xMidYMid slice" style="transform:rotate(${tilt * 0.6}deg)">
            <path d="M${10 + (h % 20)},15 Q${30 + (h % 15)},30 ${50},42 Q${65},52 ${80},68" stroke="${ink}" stroke-width="1.4" fill="none" opacity="0.85" stroke-linecap="round"/>
            <path d="M50,42 Q40,52 28,60" stroke="${ink}" stroke-width="1" fill="none" opacity="0.7" stroke-linecap="round"/>
            <path d="M65,52 Q72,46 82,42" stroke="${ink}" stroke-width="1" fill="none" opacity="0.7" stroke-linecap="round"/>
            <circle cx="82" cy="42" r="2.2" fill="${ink}" opacity="0.85"/>
            <circle cx="28" cy="60" r="1.8" fill="${ink}" opacity="0.85"/>
            <circle cx="80" cy="68" r="2.4" fill="${ink}" opacity="0.9"/>
          </svg>`;
        }
        if (cat === '人物') {
          // 留白：竖向人物剪影（头 + 肩 + 身），大量留白
          const cx = 35 + (h % 30);
          return `<svg viewBox="0 0 100 75" preserveAspectRatio="xMidYMid slice" style="transform:rotate(${tilt * 0.3}deg)">
            <ellipse cx="${cx}" cy="22" rx="3.2" ry="3.8" fill="${ink}" opacity="0.8"/>
            <path d="M${cx - 8},75 L${cx - 5},38 Q${cx - 3},32 ${cx},30 Q${cx + 3},32 ${cx + 5},38 L${cx + 8},75 Z" fill="${ink}" opacity="0.7"/>
            <path d="M${cx - 2},42 L${cx - 18},58" stroke="${ink}" stroke-width="1.4" opacity="0.6" stroke-linecap="round"/>
          </svg>`;
        }
        if (cat === '重彩') {
          // 晕染：多层半透明墨斑
          return `<svg viewBox="0 0 100 75" preserveAspectRatio="xMidYMid slice" style="transform:rotate(${tilt * 0.5}deg)">
            <ellipse cx="${25 + (h % 30)}" cy="${30 + (h % 20)}" rx="22" ry="14" fill="${ink}" opacity="0.18"/>
            <ellipse cx="${55 + (h % 20)}" cy="${20 + (h % 15)}" rx="14" ry="10" fill="${ink}" opacity="0.22"/>
            <ellipse cx="${70 + (h % 15)}" cy="${45 + (h % 15)}" rx="18" ry="12" fill="${ink}" opacity="0.16"/>
            <path d="M0,75 L0,60 Q25,55 50,58 T100,60 L100,75 Z" fill="${ink}" opacity="0.7"/>
          </svg>`;
        }
        // 现代（含未匹配分类）：飞白，几笔干墨斜扫
        return `<svg viewBox="0 0 100 75" preserveAspectRatio="xMidYMid slice" style="transform:rotate(${tilt * 0.7}deg)">
          <path d="M${5 + (h % 10)},${15 + (h % 10)} Q${30},${20 + (h % 8)} ${50},${12 + (h % 6)} T${95},${20 + (h % 8)}" stroke="${ink}" stroke-width="2.4" fill="none" opacity="0.55" stroke-linecap="round"/>
          <path d="M${10 + (h % 8)},${40 + (h % 8)} Q${35},${48} ${60},${42 + (h % 5)} T${95},${48}" stroke="${ink}" stroke-width="1.8" fill="none" opacity="0.4" stroke-linecap="round"/>
          <path d="M${5 + (h % 6)},${60 + (h % 6)} Q${30},${66} ${55},${62} T${95},${64}" stroke="${ink}" stroke-width="1.2" fill="none" opacity="0.3" stroke-linecap="round"/>
        </svg>`;
      }
  
      // ── 文案段落渲染（带 HTML 转义）────────────────
      function escapeHtml(s) {
        return String(s)
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#39;');
      }
      function sampleToParagraphs(sample) {
        return escapeHtml(sample)
          .split(/\n\n+/)
          .map(para => '<p>' + para.split('\n').join('<br>') + '</p>')
          .join('');
      }
  
      // ── 画廊 · 25 款真实海报预设（素材来自 ~/Downloads/posters） ─────────────────────────
      const POSTER_DIR = '../../assets/posters/';
      const presets = [
        { name: '写实人像', cat: '人物', desc: '饱经风霜的老渔夫，窗光写实，8K 细节。', prompt: 'Medium shot portrait of an elderly fisherman with weathered skin, deep wrinkles, intense blue eyes, wearing a worn raincoat, natural window lighting, photorealistic, ultra detailed, 8k', ratio: '3:4', strength: '0.70 - 0.85', img: POSTER_DIR + '01_portrait_realistic.png', tags: ['写实', '人像', '窗光'] },
        { name: '炭笔速写', cat: '人物', desc: '舞者动态炭笔，明暗对比强烈。', prompt: 'Charcoal sketch portrait of a ballerina in motion, flowing dress, dynamic pose, rough textured paper, dramatic chiaroscuro lighting, expressive strokes, high contrast', ratio: '3:4', strength: '0.65 - 0.80', img: POSTER_DIR + '02_portrait_sketch.png', tags: ['炭笔', '速写', '舞者'] },
        { name: '古典油画', cat: '人物', desc: '文艺复兴贵妇，晕涂法，暖金光。', prompt: 'Classical oil painting portrait of a renaissance noblewoman in velvet dress, soft sfumato technique, warm golden lighting, dark background, Old Masters style, museum quality', ratio: '3:4', strength: '0.60 - 0.80', img: POSTER_DIR + '03_portrait_oilpainting.png', tags: ['油画', '文艺复兴', '晕涂法'] },
        { name: '水彩竹影', cat: '山水', desc: '雾中竹林水彩，淡绿灰调，雨意。', prompt: 'Watercolor painting of a misty bamboo forest, delicate brushstrokes, soft greens and grays, light rain, atmospheric perspective, loose painterly style, fine art paper texture', ratio: '3:4', strength: '0.55 - 0.75', img: POSTER_DIR + '04_landscape_watercolor.png', tags: ['水彩', '竹林', '雨意'] },
        { name: '古希腊浮雕', cat: '重彩', desc: '雅典娜大理石浮雕，风化石质。', prompt: 'Ancient Greek marble relief sculpture of Athena, Classical period style, weathered stone texture, shallow depth carving, dramatic side lighting, archaeological museum quality', ratio: '3:4', strength: '0.60 - 0.80', img: POSTER_DIR + '05_sculpture_relief.png', tags: ['浮雕', '大理石', '雅典娜'] },
        { name: '街头摄影', cat: '现代', desc: '东京夜市黄金时刻，胶片质感。', prompt: 'Street photography of a bustling Tokyo night market at golden hour, lanterns glowing, steam rising from food stalls, real people, candid moment, Fujifilm color grading, grain, 35mm film', ratio: '4:5', strength: '0.65 - 0.85', img: POSTER_DIR + '06_photo_street.png', tags: ['街拍', '东京夜市', '胶片'] },
        { name: '建筑素描', cat: '现代', desc: '巴黎圣母院铅笔建筑图，哥特拱券。', prompt: 'Detailed pencil architectural drawing of Notre Dame cathedral, gothic arches, flying buttresses, cross-hatching technique, drafting paper, technical precision, vintage architectural sketch', ratio: '4:5', strength: '0.60 - 0.80', img: POSTER_DIR + '07_sketch_architecture.png', tags: ['建筑素描', '哥特', '巴黎圣母院'] },
        { name: '复古旅行海报', cat: '现代', desc: '1920 年代巴黎装饰艺术旅行海报。', prompt: 'Vintage travel poster advertising Paris 1920s, art deco style, elegant typography, Eiffel Tower silhouetted against sunset, bold geometric shapes, limited color palette, screen print texture', ratio: '4:5', strength: '0.65 - 0.85', img: POSTER_DIR + '08_poster_travel.png', tags: ['旅行海报', '装饰艺术', '巴黎'] },
        { name: '水墨山水', cat: '山水', desc: '传统水墨云山松石，宋画笔意。', prompt: 'Traditional Chinese ink wash painting of misty mountains and pine trees, gongbi fine brushwork, ink gradations on rice paper, vertical scroll composition, seal stamp, classical Song dynasty style', ratio: '4:5', strength: '0.70 - 0.90', img: POSTER_DIR + '09_inkwash_chinese.png', tags: ['水墨', '山水', '宋画'] },
        { name: '哥特彩窗', cat: '重彩', desc: '天体玫瑰彩窗，深蓝宝石红。', prompt: 'Gothic cathedral stained glass window depicting a celestial rose, deep blues and rubies, lead came lines, morning light streaming through, kaleidoscopic pattern, intricate tracery, spiritual atmosphere', ratio: '4:5', strength: '0.60 - 0.80', img: POSTER_DIR + '10_stainedglass.png', tags: ['彩窗', '哥特', '玫瑰窗'] },
        { name: '波普肖像', cat: '人物', desc: '沃霍尔式波普，高对比 halftone。', prompt: 'Pop art portrait of a glamorous woman, Warhol-style, bold bright colors, halftone dots, screen print effect, high contrast, iconic 1960s aesthetic, gallery wall', ratio: '1:1', strength: '0.65 - 0.85', img: POSTER_DIR + '11_popart_portrait.png', tags: ['波普', '沃霍尔', 'halftone'] },
        { name: '罗马马赛克', cat: '重彩', desc: '狮猎马赛克镶嵌画，赤陶橄榄色。', prompt: 'Ancient Roman mosaic floor depicting a lion hunt, tesserae tiles, earthy terracotta and olive tones, geometric border, weathered archaeological texture, intricate tessellation, preserved antiquity', ratio: '1:1', strength: '0.60 - 0.80', img: POSTER_DIR + '12_mosaic_roman.png', tags: ['马赛克', '罗马', '狮猎'] },
        { name: '超现实达利', cat: '重彩', desc: '达利式融化时钟，梦境沙漠。', prompt: 'Surrealist painting in the style of Salvador Dali, melting clocks over a dreamlike desert landscape, impossible geometry, soft warm light, bizarre juxtapositions, oil on canvas, museum quality', ratio: '1:1', strength: '0.70 - 0.90', img: POSTER_DIR + '13_surrealist_dali.png', tags: ['超现实', '达利', '融化时钟'] },
        { name: '故障赛博', cat: '现代', desc: 'RGB 色差故障黑客肖像，蒸汽波。', prompt: 'Digital glitch portrait of a cyberpunk hacker, RGB chromatic aberration, pixel sorting artifacts, scan lines, data corruption visual effect, neon cyan and magenta, futuristic, vaporwave aesthetic', ratio: '1:1', strength: '0.70 - 0.90', img: POSTER_DIR + '14_glitch_cyberpunk.png', tags: ['故障', '赛博', '蒸汽波'] },
        { name: '浮世绘', cat: '重彩', desc: '神奈川冲浪里式木版画，葛饰北斋。', prompt: 'Ukiyo-e woodblock print of The Great Wave off Kanagawa style, stylized ocean wave with Mount Fuji in background, Hokusai homage, indigo and cream, wood grain texture, Japanese Edo period', ratio: '1:1', strength: '0.65 - 0.85', img: POSTER_DIR + '15_ukiyoe_print.png', tags: ['浮世绘', '神奈川', '北斋'] },
        { name: '赛博都市', cat: '现代', desc: '霓虹雨夜赛博城市，银翼杀手质感。', prompt: 'Cyberpunk cityscape at night, neon-drenched rain-slicked streets, towering holographic advertisements, flying cars, blade runner aesthetic, moody atmosphere, volumetric fog, cinematic lighting', ratio: '16:9', strength: '0.70 - 0.90', img: POSTER_DIR + '16_cyberpunk_city.png', tags: ['赛博都市', '霓虹', '银翼杀手'] },
        { name: '巴洛克海景', cat: '山水', desc: '暴风怒涛海景，透纳式戏剧光。', prompt: 'Baroque landscape painting of a stormy seascape, raging waves against rocky cliffs, dramatic sky with breaking light, Turner and Ruisdael influence, impasto oil technique, dramatic chiaroscuro', ratio: '16:9', strength: '0.65 - 0.85', img: POSTER_DIR + '17_baroque_seascape.png', tags: ['巴洛克', '海景', '透纳'] },
        { name: '蒸汽飞艇', cat: '现代', desc: '维多利亚伦敦上空蒸汽朋克飞艇。', prompt: 'Steampunk airship fleet over Victorian London, brass and copper dirigibles, clockwork details, steam and gear aesthetic, sepia toned, intricate mechanical design, alternate history, fantasy', ratio: '16:9', strength: '0.70 - 0.90', img: POSTER_DIR + '18_steampunk_airship.png', tags: ['蒸汽朋克', '飞艇', '维多利亚'] },
        { name: '印象花园', cat: '山水', desc: '莫奈式睡莲花园，斑驳日光。', prompt: 'Impressionist garden scene, Monet-style, water lilies in a pond, dappled sunlight through willow trees, visible brushstrokes, pastel palette, peaceful atmosphere, plein air feeling', ratio: '16:9', strength: '0.60 - 0.80', img: POSTER_DIR + '19_impressionist_garden.png', tags: ['印象派', '莫奈', '睡莲'] },
        { name: '涂鸦街头', cat: '现代', desc: '砖墙野生涂鸦，喷漆滴落。', prompt: 'Vibrant graffiti mural on a brick wall, wild style lettering, spray paint texture, dripping paint, colorful street art, urban art movement, layers of tags and throw-ups, hip-hop culture', ratio: '16:9', strength: '0.65 - 0.85', img: POSTER_DIR + '20_graffiti_street.png', tags: ['涂鸦', '街头', '喷漆'] },
        { name: '巴塔哥尼亚全景', cat: '山水', desc: '日出安第斯雪山倒影，电影宽屏。', prompt: 'Ultra-wide cinematic landscape of Patagonia at sunrise, snow-capped Andes mountains reflecting in turquoise lake, golden hour light, anamorphic lens flare, National Geographic photography style, breathtaking panorama', ratio: '21:9', strength: '0.70 - 0.90', img: POSTER_DIR + '21_panorama_landscape.png', tags: ['全景', '巴塔哥尼亚', '雪山'] },
        { name: '普罗旺斯粉彩', cat: '山水', desc: '薰衣草田粉彩，塞尚式暖橙。', prompt: 'Soft pastel drawing of rolling lavender fields in Provence, gentle hills under gradient sunset sky, delicate chalk texture, muted purples and warm oranges, peaceful, Cezanne-inspired, fine art', ratio: '21:9', strength: '0.60 - 0.80', img: POSTER_DIR + '22_pastel_lavender.png', tags: ['粉彩', '普罗旺斯', '薰衣草'] },
        { name: '浮世绘全景', cat: '重彩', desc: '广重式樱花河景全景木版画。', prompt: 'Traditional Japanese woodblock print of a long panoramic landscape, cherry blossoms along a river, Mount Fuji in distance, Hiroshige style, natural pigments on washi paper, horizontal composition', ratio: '21:9', strength: '0.65 - 0.85', img: POSTER_DIR + '23_woodblock_panorama.png', tags: ['浮世绘', '广重', '樱花'] },
        { name: '装饰艺术', cat: '现代', desc: '金黑几何装饰艺术，1920 奢华。', prompt: 'Art deco geometric pattern design, gold and black, symmetrical layered chevrons and sunbursts, elegant 1920s luxury style, metallic accents, architectural ornament, sophisticated wallpaper pattern', ratio: '21:9', strength: '0.65 - 0.85', img: POSTER_DIR + '24_artdeco_pattern.png', tags: ['装饰艺术', '几何', '金黑'] },
        { name: '文艺复兴湿壁画', cat: '重彩', desc: '西斯廷式天顶湿壁画，天使云层。', prompt: 'Renaissance fresco mural depicting a celestial scene, angels and clouds, Michelangelo-inspired, vaulted ceiling perspective, cracked plaster texture, faded pigments, Sistine Chapel style, monumental scale', ratio: '21:9', strength: '0.70 - 0.90', img: POSTER_DIR + '25_fresco_renaissance.png', tags: ['湿壁画', '文艺复兴', '米开朗基罗', '宗教'] }
      ];
  
      presets.forEach((p, i) => { p.id = p.id || 'gp' + String(i + 1).padStart(2, '0'); });
  
      const presetGrid = document.getElementById('preset-grid');
      function makeAddCard(label, onClick) {
        const card = document.createElement('div');
        card.className = 'add-card';
        card.innerHTML = `<svg class="add-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M12 5v14M5 12h14"/></svg><span class="add-text">${label}</span>`;
        card.addEventListener('click', onClick);
        return card;
      }
      function makeEditOverlay(id) {
        return `
          <div class="edit-overlay">
            <button class="edit-btn" data-id="${id}" title="编辑">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
            </button>
            <button class="delete-btn" data-id="${id}" title="删除">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
            </button>
          </div>
        `;
      }
      function renderPresets(opts) {
        const animate = !opts || opts.animate !== false;
        presetGrid.classList.toggle('enter', animate);
        presetGrid.innerHTML = '';
        if (editMode.gallery) {
          presetGrid.appendChild(makeAddCard('添加新风格', () => openGalleryEditor(null)));
        }
        const list = applyFilter(presets, 'gallery');
        list.forEach((p, i) => {
          const card = document.createElement('div');
          card.className = 'style-card' + (editMode.gallery ? ' editable' : '');
          card.style.setProperty('--i', i);
          card.dataset.id = p.id;
          const previewBg = p.img
            ? `<img class="preview-img" src="${p.img}" alt="${p.name}" loading="lazy" />`
            : `<div class="preview-fallback" style="background:${p.g || genGradient(p.name)};"></div>`;
          const tagChips = (p.tags || []).map(t => `<span class="tag-chip">${t}</span>`).join('');
          card.innerHTML = `
            <div class="preview">
              ${previewBg}
              <div class="seal-corner" title="${p.name}">${p.name.charAt(0)}</div>
              <div class="name">${p.name}</div>
            </div>
            <div class="meta">
              <div class="meta-tags">${tagChips}</div>
              <span class="num">${p.ratio}</span>
            </div>
            ${editMode.gallery ? makeEditOverlay(p.id) : ''}
          `;
          card.addEventListener('click', (e) => {
            if (e.target.closest('.delete-btn')) {
              e.stopPropagation();
              confirmDelete(p, 'gallery');
              return;
            }
            if (editMode.gallery) {
              openGalleryEditor(p);
            } else {
              openDetail(p);
            }
          });
          presetGrid.appendChild(card);
        });
      }
      renderPresets();
  
      const detail = document.getElementById('detail');
      const favoriteBtn = document.getElementById('favorite-preset');
      const favSet = new Set();
      let currentDetailId = null;
      function syncFavoriteBtn() {
        if (!favoriteBtn) return;
        const on = currentDetailId && favSet.has(currentDetailId);
        favoriteBtn.textContent = on ? '已收藏' : '收藏';
        favoriteBtn.style.background = on ? 'var(--accent)' : '';
        favoriteBtn.style.color = on ? '#fff' : '';
        favoriteBtn.style.borderColor = on ? 'var(--accent)' : '';
      }
      function openDetail(p) {
        currentDetailId = p.id;
        document.getElementById('detailName').textContent = p.name;
        document.getElementById('detail-cat').textContent = p.cat;
        document.getElementById('detail-desc').textContent = p.desc;
        document.getElementById('detail-prompt').textContent = p.prompt;
        const art = document.getElementById('detail-art');
        art.style.background = p.img ? '' : (p.g || genGradient(p.name));
        // 根据比例判断横图/竖图：宽/高 > 1.3 为横图 → 上下排列
        var ratioParts = /^(\d+)\s*:\s*(\d+)$/.exec((p.ratio || '4:5').trim());
        var isLandscape = ratioParts && parseFloat(ratioParts[1]) / parseFloat(ratioParts[2]) > 1.3;
        var detailPanel = document.getElementById('detail');
        detailPanel.classList.toggle('landscape', isLandscape);
        // 设置 art 容器比例匹配图片原始比例
        if (ratioParts) {
          art.style.aspectRatio = ratioParts[1] + ' / ' + ratioParts[2];
        } else {
          art.style.aspectRatio = '4 / 5';
        }
        var fit = isLandscape ? 'contain' : 'cover';
        var inner = p.img
          ? '<img src="' + p.img + '" alt="' + p.name + '" style="width:100%;height:100%;object-fit:' + fit + ';display:block;" />'
          : '<div style="position:absolute;inset:0;background:radial-gradient(ellipse 60% 40% at 30% 30%, ' + (p.ink || 'rgba(29,24,20,0.6)') + ' 0%, transparent 50%),radial-gradient(ellipse 50% 30% at 70% 70%, ' + (p.ink || 'rgba(29,24,20,0.6)') + ' 0%, transparent 60%);mix-blend-mode:multiply;opacity:0.6;"></div>';
        art.innerHTML = inner + '<div class="detail-caption">' + p.name + ' · ' + p.cat + ' · ' + p.ratio + '</div>';
        syncFavoriteBtn();
        detailPanel.classList.add('open');
      }
      document.getElementById('detail-close').addEventListener('click', () => detail.classList.remove('open'));
      detail.addEventListener('click', e => { if (e.target === detail) detail.classList.remove('open'); });
      favoriteBtn.addEventListener('click', () => {
        if (!currentDetailId) return;
        const willFavorite = !favSet.has(currentDetailId);
        if (willFavorite) favSet.add(currentDetailId); else favSet.delete(currentDetailId);
        syncFavoriteBtn();
        toast(willFavorite ? '已加入收藏' : '已取消收藏');
      });
  
      // ── 妙笔生花 · 12 款文风预设 ─────────────────
      const textStyles = [
        { id: 'linqingyuan', name: '林清远风', cat: '文学', desc: '现代山水散文 · 留白与呼吸并重', prompt: '请用现代山水散文的笔法撰写。要求：①以景入情，留白三分；②多用短句与比喻，忌华丽辞藻；③面向安静的阅读者，节奏舒缓。', length: '300-500 字', strength: '0.65 - 0.85', sample: '山是静的。\n\n风过松林时，我听见自己的呼吸。\n\n墨痕未干，三两笔便把整片秋天\n收进了纸里。', ink: 'rgba(29,24,20,0.85)', tags: ['散文', '留白', '现代', '山水'] },
        { id: 'luxun', name: '鲁迅风', cat: '文学', desc: '犀利杂文 · 一针见血', prompt: '请以鲁迅式杂文笔法撰写。要求：①语言犀利冷峻，态度鲜明；②善用反讽与排比；③观点直击人心，不绕弯子。', length: '200-400 字', strength: '0.70 - 0.90', sample: '沉默啊，沉默。\n\n不在沉默中爆发，\n就在沉默中灭亡。\n\n这世上最可怕的，\n从来不是刀剑。', ink: 'rgba(29,24,20,0.90)', tags: ['杂文', '犀利', '批判', '民国'] },
        { id: 'zhangailing', name: '张爱玲风', cat: '文学', desc: '都市言情 · 苍凉而华美', prompt: '请用张爱玲式笔法撰写。要求：①苍凉底色里透出华美；②多用通感和意象；③女性视角细腻，命运感强。', length: '300-600 字', strength: '0.60 - 0.80', sample: '于千万人之中遇见你所遇见的人，\n于千万年之中，时间的无涯的荒野里，\n没有早一步，也没有晚一步，\n刚巧赶上了。', ink: 'rgba(168,50,46,0.55)', tags: ['言情', '苍凉', '意象', '民国'] },
        { id: 'wangzengqi', name: '汪曾祺风', cat: '文学', desc: '平淡生活 · 烟火可亲', prompt: '请用汪曾祺式笔法撰写。要求：①记录日常小事；②语言干净温和；③于平淡中见真意。', length: '200-400 字', strength: '0.55 - 0.75', sample: '如果你来访我，我不在，\n请和我门外的花坐一会儿。\n\n它们很温暖，\n我注视它们很久了。', ink: 'rgba(74,90,72,0.70)', tags: ['生活', '清淡', '温情', '日常'] },
        { id: 'guwen', name: '古文观止', cat: '古文', desc: '古典文言 · 骈散结合', prompt: '请用典雅文言文撰写。要求：①句式整散结合；②典故信手拈来；③意境深远，音韵和谐。', length: '100-300 字', strength: '0.75 - 0.95', sample: '山不在高，有仙则名。\n水不在深，有龙则灵。\n斯是陋室，惟吾德馨。\n\n苔痕上阶绿，草色入帘青。', ink: 'rgba(29,24,20,0.85)', tags: ['文言', '典雅', '骈文', '古意'] },
        { id: 'libai', name: '李白风', cat: '古文', desc: '浪漫古诗 · 豪放飘逸', prompt: '请以李白式浪漫古诗笔法撰写。要求：①想象瑰丽，气象宏大；②多用夸张与神话意象；③情感奔放而不失天真。', length: '五言 / 七言', strength: '0.70 - 0.90', sample: '飞流直下三千尺，\n疑是银河落九天。\n\n举杯邀明月，\n对影成三人。', ink: 'rgba(106,138,138,0.75)', tags: ['古诗', '浪漫', '豪放', '唐诗'] },
        { id: 'business', name: '商业文案', cat: '商业', desc: '卖点驱动 · 简洁有力', prompt: '请撰写商业推广文案。要求：①直击产品核心卖点；②开头3秒抓眼球；③动词驱动，忌形容词堆砌。', length: '50-150 字', strength: '0.80 - 1.00', sample: '一台懂你的工具。\n\n不是更快，是刚刚好。\n\n现在就开始，不再等待。', ink: 'rgba(168,50,46,0.70)', tags: ['商业', '卖点', '电商', '推广'] },
        { id: 'academic', name: '学术论文', cat: '学术', desc: '严谨论证 · 逻辑清晰', prompt: '请用学术论文风格撰写。要求：①论点明确，论据充分；②引用规范，行文严谨；③避免主观表达。', length: '500-1500 字', strength: '0.70 - 0.90', sample: '本文基于田野调查数据，\n探讨传统水墨在数字媒介中的\n转译路径及其美学张力。\n\n研究表明，……', ink: 'rgba(29,24,20,0.75)', tags: ['学术', '严谨', '论证', '论文'] },
        { id: 'social', name: '社交媒体', cat: '媒体', desc: '短句爆款 · 朗朗上口', prompt: '请撰写社交媒体文案。要求：①30字以内；②有节奏感，押韵或对仗；③可附 emoji 断点；④适合微博/小红书/朋友圈。', length: '20-50 字', strength: '0.65 - 0.85', sample: '今天的风，是宣纸的味道 🍃\n\n一笔落下，万物生。\n#水墨日常 #东方美学', ink: 'rgba(196,165,116,0.80)', tags: ['社交', '短句', '爆款', '种草'] },
        { id: 'headline', name: '标题党', cat: '媒体', desc: '钩子开篇 · 一眼入魂', prompt: '请生成 10 个吸睛标题。要求：①8-20 字；②数字 / 反差 / 悬念任一驱动；③引发好奇，但不标题欺诈。', length: '8-20 字', strength: '0.75 - 0.95', sample: '① 一支毛笔，让 AI 学会了呼吸\n\n② 90 后辞职后，写下 100 万字水墨\n\n③ 你绝对想不到的留白', ink: 'rgba(168,50,46,0.65)', tags: ['标题', '钩子', '吸睛', '悬念'] },
        { id: 'brand', name: '品牌故事', cat: '商业', desc: '温度叙事 · 缘起愿景', prompt: '请撰写品牌故事。要求：①以创始人初心切入；②讲清楚"为什么"而非"是什么"；③温度感强，可读性高。', length: '300-600 字', strength: '0.60 - 0.80', sample: '那年冬天，我父亲送了我一支毛笔。\n\n他说，笔是有重量的。\n\n十年后，这支笔还在，\n但它的重量，落到了更多人的手里。', ink: 'rgba(196,165,116,0.75)', tags: ['品牌', '故事', '温度', '初心'] },
        { id: 'slogan', name: '广告金句', cat: '商业', desc: '极简一字 · 一句入心', prompt: '请生成广告金句。要求：①10 字以内；②有记忆点；③可独立成句；④适合海报或视频结尾。', length: '5-10 字', strength: '0.85 - 1.00', sample: '落笔之处，万象生。\n\n\n墨未干，心已远。', ink: 'rgba(29,24,20,0.90)', tags: ['金句', '极简', '海报', '记忆点'] }
      ];
  
      textStyles.forEach((p, i) => { p.id = p.id || 'tx' + String(i + 1).padStart(2, '0'); });
  
      const textGrid = document.getElementById('text-grid');
      function renderTextStyles(opts) {
        const animate = !opts || opts.animate !== false;
        textGrid.classList.toggle('enter', animate);
        textGrid.innerHTML = '';
        if (editMode.copywriting) {
          textGrid.appendChild(makeAddCard('添加新文风', () => openTextEditor(null)));
        }
        const list = applyFilter(textStyles, 'copywriting');
        list.forEach((p, i) => {
          const card = document.createElement('div');
          card.className = 'text-card' + (editMode.copywriting ? ' editable' : '');
          card.style.setProperty('--i', i);
          card.dataset.id = p.id;
          card.innerHTML = `
            <div class="preview">
              <div class="snippet">${sampleToParagraphs(p.sample)}</div>
            </div>
            <div class="meta"><span class="name">${p.name}</span><span>${p.cat}</span></div>
            ${editMode.copywriting ? makeEditOverlay(p.id) : ''}
          `;
          card.addEventListener('click', (e) => {
            if (e.target.closest('.delete-btn')) {
              e.stopPropagation();
              confirmDelete(p, 'copywriting');
              return;
            }
            if (editMode.copywriting) {
              openTextEditor(p);
            } else {
              openTextDetail(p);
            }
          });
          textGrid.appendChild(card);
        });
      }
      renderTextStyles();
  
      wireFilter('gallery', renderPresets);
      wireFilter('copywriting', renderTextStyles);
  
      const textDetail = document.getElementById('text-detail');
      let currentDetailTextId = null;
      let detailTags = [];

      // ── Detail tag input ─────────────────────────────────────
      function renderDetailTagInputs() {
        const container = document.getElementById('text-detail-tags-input');
        if (!container) return;
        const tagsHtml = detailTags.map((t, i) =>
          `<span class="tag" data-idx="${i}">${t}<span class="tag-remove" data-remove="${i}">×</span></span>`
        ).join('');
        container.innerHTML = tagsHtml + `<input type="text" id="text-detail-tag-new" placeholder="回车添加标签" />`;
        const newInput = document.getElementById('text-detail-tag-new');
        if (newInput) {
          newInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              const v = newInput.value.trim();
              if (v && !detailTags.includes(v)) {
                detailTags.push(v);
                renderDetailTagInputs();
                const inp = document.getElementById('text-detail-tag-new');
                if (inp) inp.focus();
              }
            }
          });
        }
        container.querySelectorAll('.tag-remove').forEach(btn => {
          btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const idx = parseInt(btn.dataset.remove, 10);
            detailTags.splice(idx, 1);
            renderDetailTagInputs();
          });
        });
      }

      function openTextDetail(p) {
        currentDetailTextId = p.id;
        detailTags = p.tags ? [...p.tags] : [];
        document.getElementById('text-detail-name').textContent = p.name;
        document.getElementById('text-detail-cat').textContent = p.cat;
        document.getElementById('text-detail-desc').value = p.desc || '';
        document.getElementById('text-detail-prompt').value = p.prompt || '';
        document.getElementById('text-detail-length').value = p.length || '300-500 字';
        document.getElementById('text-detail-strength').value = p.strength || '0.65 - 0.85';
        document.getElementById('text-detail-sample').innerHTML = sampleToParagraphs(p.sample);
        document.getElementById('text-detail-sample').style.background = 'transparent';
        renderDetailTagInputs();
        textDetail.classList.add('open');
      }

      document.getElementById('text-detail-close').addEventListener('click', () => textDetail.classList.remove('open'));
      textDetail.addEventListener('click', e => { if (e.target === textDetail) textDetail.classList.remove('open'); });
      document.getElementById('text-detail-save').addEventListener('click', () => {
        const currentPreset = currentDetailTextId ? textStyles.find(function(p){ return p.id === currentDetailTextId; }) : null;
        if (!currentPreset) { toast('未找到文风数据', 'error'); return; }
        currentPreset.desc = document.getElementById('text-detail-desc').value.trim();
        currentPreset.prompt = document.getElementById('text-detail-prompt').value.trim();
        currentPreset.length = document.getElementById('text-detail-length').value.trim();
        currentPreset.strength = document.getElementById('text-detail-strength').value.trim();
        currentPreset.tags = [...detailTags];
        renderTextStyles();
        textDetail.classList.remove('open');
        toast('已保存修改');
      });
      document.getElementById('text-detail-cancel').addEventListener('click', () => textDetail.classList.remove('open'));
  
      // ── Delete confirmation (inline overlay) ───────────────────
      function hideAllDeleteConfirms() {
        document.querySelectorAll('.editor-delete-confirm.show').forEach(el => el.classList.remove('show'));
      }
      function confirmDelete(item, panel) {
        hideAllDeleteConfirms();
        const selector = panel === 'gallery' ? '#preset-grid .style-card' : '#text-grid .text-card';
        const targetCard = document.querySelector(`${selector}[data-id="${item.id}"]`);
        if (!targetCard) return;
        let overlay = targetCard.querySelector('.editor-delete-confirm');
        if (!overlay) {
          overlay = document.createElement('div');
          overlay.className = 'editor-delete-confirm';
          overlay.innerHTML = `
            <p>确定删除<br>「${item.name}」？</p>
            <div class="row">
              <button class="btn btn-secondary btn-sm" data-cancel>取消</button>
              <button class="btn btn-sm" data-ok style="background:#c44a44;color:#faf9f6;">删除</button>
            </div>
          `;
          targetCard.appendChild(overlay);
          overlay.addEventListener('click', (e) => e.stopPropagation());
          overlay.querySelector('[data-cancel]').addEventListener('click', (e) => {
            e.stopPropagation();
            overlay.classList.remove('show');
          });
          overlay.querySelector('[data-ok]').addEventListener('click', (e) => {
            e.stopPropagation();
            executeDelete(item, panel);
          });
        } else {
          overlay.querySelector('p').innerHTML = `确定删除<br>「${item.name}」？`;
        }
        overlay.classList.add('show');
      }
      function executeDelete(item, panel) {
        if (panel === 'gallery') {
          const idx = presets.findIndex(x => x.id === item.id);
          if (idx >= 0) presets.splice(idx, 1);
          renderPresets({ animate: false });
        } else {
          const idx = textStyles.findIndex(x => x.id === item.id);
          if (idx >= 0) textStyles.splice(idx, 1);
          renderTextStyles({ animate: false });
        }
        toast('已删除');
      }
  
      // ── Gallery editor modal ───────────────────────
      const editorGallery = document.getElementById('editor-gallery');
      let editingGalleryId = null;
      let editorUploadDataUri = null;

      // ── Upload handling ─────────────────────────────────
      function triggerUpload() {
        document.getElementById('editor-upload-input').click();
      }
      document.getElementById('editor-upload-input').addEventListener('change', function(e) {
        const file = e.target.files && e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = function(ev) {
          editorUploadDataUri = ev.target.result;
          updateEditorGalleryPreview();
        };
        reader.readAsDataURL(file);
      });
      document.getElementById('editor-upload-area').addEventListener('click', function(e) {
        if (e.target.closest('.upload-change-btn') || e.target.closest('#editor-upload-change')) return;
        triggerUpload();
      });
      document.getElementById('editor-upload-change').addEventListener('click', function(e) {
        e.stopPropagation();
        triggerUpload();
      });

      // ── Custom category handling ────────────────────────
      function refreshCatSelect() {
        const sel = document.getElementById('editor-gallery-cat');
        const cats = new Set();
        presets.forEach(function(p){ cats.add(p.cat); });
        // also keep the default 5
        ['山水','花鸟','人物','重彩','现代'].forEach(function(c){ cats.add(c); });
        const cur = sel.value;
        sel.innerHTML = '';
        cats.forEach(function(c){ 
          var opt = document.createElement('option');
          opt.value = c; opt.textContent = c;
          sel.appendChild(opt);
        });
        var newOpt = document.createElement('option');
        newOpt.value = '__NEW__'; newOpt.textContent = '+ 添加新分类…';
        sel.appendChild(newOpt);
        if (cur && cats.has(cur)) sel.value = cur;
      }
      function handleCatChange() {
        const sel = document.getElementById('editor-gallery-cat');
        const newInput = document.getElementById('editor-gallery-cat-new');
        if (sel.value === '__NEW__') {
          sel.style.display = 'none';
          newInput.style.display = 'block';
          newInput.value = '';
          newInput.focus();
        } else {
          sel.style.display = 'block';
          newInput.style.display = 'none';
        }
        updateEditorGalleryPreview();
      }
      document.getElementById('editor-gallery-cat').addEventListener('change', handleCatChange);
      document.getElementById('editor-gallery-cat-new').addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
          e.preventDefault();
          var v = this.value.trim();
          if (v) {
            var sel = document.getElementById('editor-gallery-cat');
            // add option
            var opt = document.createElement('option');
            opt.value = v; opt.textContent = v;
            sel.insertBefore(opt, sel.lastElementChild);
            sel.value = v;
            sel.style.display = 'block';
            this.style.display = 'none';
            this.value = '';
            updateEditorGalleryPreview();
          }
        }
      });
      document.getElementById('editor-gallery-cat-new').addEventListener('blur', function(e) {
        var v = this.value.trim();
        if (v) {
          var sel = document.getElementById('editor-gallery-cat');
          var opt = document.createElement('option');
          opt.value = v; opt.textContent = v;
          sel.insertBefore(opt, sel.lastElementChild);
          sel.value = v;
        }
        sel.style.display = 'block';
        this.style.display = 'none';
      });

      function updateEditorGalleryPreview() {
        const name = document.getElementById('editor-gallery-name').value || '未命名';
        const cat = document.getElementById('editor-gallery-cat').value;
        const g = genGradient(name);
        const ink = genInk(name);
        const art = document.getElementById('editor-gallery-art');
        const uploadArea = document.getElementById('editor-upload-area');
        const changeBtn = document.getElementById('editor-upload-change');
        if (editorUploadDataUri) {
          art.classList.add('has-image');
          art.style.background = 'transparent';
          art.innerHTML = '<img src="' + editorUploadDataUri + '" alt="' + name + '" />';
          changeBtn.style.display = 'inline-flex';
        } else {
          art.classList.remove('has-image');
          art.style.background = g;
          changeBtn.style.display = 'none';
          art.innerHTML = `
            <div class="brush-layer">${brushSvg(cat, name)}</div>
            <div style="position:absolute;inset:0;background:radial-gradient(ellipse 60% 40% at 30% 30%, ${ink} 0%, transparent 50%),radial-gradient(ellipse 50% 30% at 70% 70%, ${ink} 0%, transparent 60%);mix-blend-mode:multiply;opacity:0.6;"></div>
            <div class="detail-stamp">${name.charAt(0) || '·'}</div>
            <div class="detail-caption">${name} · ${cat}</div>
            <div class="upload-placeholder" style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;color:var(--muted);z-index:1;">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" style="width:36px;height:36px;"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/></svg>
              <span style="font-size:14px;font-weight:500;">点击上传参考图</span>
              <span style="font-size:11px;opacity:0.6;">支持 PNG / JPG / WebP</span>
            </div>
          `;
        }
      }
      function openGalleryEditor(item) {
        editingGalleryId = item ? item.id : null;
        editorUploadDataUri = null;
        refreshCatSelect();
        document.getElementById('editor-gallery-mode').textContent = item ? '编辑图像风格' : '添加新风格';
        document.getElementById('editor-gallery-title').textContent = item ? item.name : '新增风格';
        document.getElementById('editor-gallery-name').value = item ? item.name : '';
        document.getElementById('editor-gallery-cat').value = item ? item.cat : '山水';
        document.getElementById('editor-gallery-cat-new').style.display = 'none';
        document.getElementById('editor-gallery-cat').style.display = 'block';
        document.getElementById('editor-gallery-desc').value = item ? item.desc : '';
        document.getElementById('editor-gallery-prompt').value = item ? item.prompt : '';
        document.getElementById('editor-gallery-ratio').value = item ? item.ratio : '16:9';
        document.getElementById('editor-gallery-strength').value = item ? item.strength : '0.70 - 0.85';
        if (item && item.img && item.img.startsWith('data:')) {
          editorUploadDataUri = item.img;
        }
        updateEditorGalleryPreview();
        editorGallery.classList.add('open');
      }
      document.getElementById('editor-gallery-name').addEventListener('input', updateEditorGalleryPreview);
      document.getElementById('editor-gallery-close').addEventListener('click', () => editorGallery.classList.remove('open'));
      editorGallery.addEventListener('click', e => { if (e.target === editorGallery) editorGallery.classList.remove('open'); });
      document.getElementById('editor-gallery-cancel').addEventListener('click', () => editorGallery.classList.remove('open'));
      document.getElementById('editor-gallery-save').addEventListener('click', () => {
        const name = document.getElementById('editor-gallery-name').value.trim();
        if (!name) { toast('请输入风格名称', 'error'); document.getElementById('editor-gallery-name').focus(); return; }
        const cat = document.getElementById('editor-gallery-cat').value;
        const data = {
          name,
          cat: cat === '__NEW__' ? document.getElementById('editor-gallery-cat-new').value.trim() || '未分类' : cat,
          desc: document.getElementById('editor-gallery-desc').value.trim(),
          prompt: document.getElementById('editor-gallery-prompt').value.trim(),
          ratio: document.getElementById('editor-gallery-ratio').value.trim() || '16:9',
          strength: document.getElementById('editor-gallery-strength').value.trim() || '0.70 - 0.85',
          g: genGradient(name),
          ink: genInk(name),
          img: editorUploadDataUri || undefined,
        };
        if (editingGalleryId) {
          const idx = presets.findIndex(x => x.id === editingGalleryId);
          if (idx >= 0) { data.id = editingGalleryId; presets[idx] = data; }
        } else {
          data.id = 'gp' + Date.now().toString(36);
          presets.unshift(data);
        }
        renderPresets();
        editorGallery.classList.remove('open');
        toast(editingGalleryId ? '已保存修改' : '已添加新风格');
      });
  
      // ── Text editor modal ───────────────────────
      const editorText = document.getElementById('editor-text');
      let editingTextId = null;
      let editingTags = [];
      function renderTagInputs() {
        const container = document.getElementById('editor-text-tags-input');
        const tagsHtml = editingTags.map((t, i) =>
          `<span class="tag" data-idx="${i}">${t}<span class="tag-remove" data-remove="${i}">×</span></span>`
        ).join('');
        container.innerHTML = tagsHtml + `<input type="text" id="editor-text-tag-new" placeholder="回车添加标签" />`;
        const newInput = document.getElementById('editor-text-tag-new');
        newInput.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            const v = newInput.value.trim();
            if (v && !editingTags.includes(v)) {
              editingTags.push(v);
              renderTagInputs();
              document.getElementById('editor-text-tag-new').focus();
            }
          }
        });
        container.querySelectorAll('.tag-remove').forEach(btn => {
          btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const idx = parseInt(btn.dataset.remove, 10);
            editingTags.splice(idx, 1);
            renderTagInputs();
          });
        });
      }
      function updateEditorTextPreview() {
        const sample = document.getElementById('editor-text-sample').value || '（示例文本待填）';
        const name = document.getElementById('editor-text-name').value || 'preview';
        const ink = genInk(name);
        const preview = document.getElementById('editor-text-preview');
        preview.innerHTML = sampleToParagraphs(sample);
        preview.style.background = ink;
        preview.style.setProperty('--ink', ink);
      }
      // ── Custom category for text editor ──────────────────────
      function refreshTextCatSelect() {
        var sel = document.getElementById('editor-text-cat');
        if (!sel) return;
        var cats = new Set();
        textStyles.forEach(function(p){ cats.add(p.cat); });
        ['文学','古文','商业','学术','媒体'].forEach(function(c){ cats.add(c); });
        var cur = sel.value;
        sel.innerHTML = '';
        cats.forEach(function(c) {
          var opt = document.createElement('option');
          opt.value = c; opt.textContent = c;
          sel.appendChild(opt);
        });
        var newOpt = document.createElement('option');
        newOpt.value = '__NEW__'; newOpt.textContent = '+ 添加新分类…';
        sel.appendChild(newOpt);
        if (cur && cats.has(cur)) sel.value = cur;
      }
      function handleTextCatChange() {
        var sel = document.getElementById('editor-text-cat');
        var newInput = document.getElementById('editor-text-cat-new');
        if (sel.value === '__NEW__') {
          sel.style.display = 'none';
          newInput.style.display = 'block';
          newInput.value = '';
          newInput.focus();
        } else {
          sel.style.display = 'block';
          newInput.style.display = 'none';
        }
      }

      function openTextEditor(item) {
        editingTextId = item ? item.id : null;
        editingTags = item ? [...(item.tags || [])] : [];
        refreshTextCatSelect();
        document.getElementById('editor-text-mode').textContent = item ? '编辑文生文风格' : '添加新文风';
        document.getElementById('editor-text-title').textContent = item ? item.name : '新增文风';
        document.getElementById('editor-text-name').value = item ? item.name : '';
        document.getElementById('editor-text-cat').value = item ? item.cat : '文学';
        document.getElementById('editor-text-cat-new').style.display = 'none';
        document.getElementById('editor-text-cat').style.display = 'block';
        document.getElementById('editor-text-desc').value = item ? item.desc : '';
        document.getElementById('editor-text-prompt').value = item ? item.prompt : '';
        document.getElementById('editor-text-length').value = item ? item.length : '300-500 字';
        document.getElementById('editor-text-strength').value = item ? item.strength : '0.65 - 0.85';
        document.getElementById('editor-text-sample').value = item ? item.sample : '';
        renderTagInputs();
        updateEditorTextPreview();
        editorText.classList.add('open');
      }
      document.getElementById('editor-text-name').addEventListener('input', updateEditorTextPreview);
      document.getElementById('editor-text-sample').addEventListener('input', updateEditorTextPreview);
      document.getElementById('editor-text-close').addEventListener('click', () => editorText.classList.remove('open'));
      editorText.addEventListener('click', e => { if (e.target === editorText) editorText.classList.remove('open'); });
      document.getElementById('editor-text-cancel').addEventListener('click', () => editorText.classList.remove('open'));

      // ── Text custom category events ──────────────────────────
      document.getElementById('editor-text-cat').addEventListener('change', handleTextCatChange);
      document.getElementById('editor-text-cat-new').addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
          e.preventDefault();
          var v = this.value.trim();
          if (v) {
            var sel = document.getElementById('editor-text-cat');
            var opt = document.createElement('option');
            opt.value = v; opt.textContent = v;
            sel.insertBefore(opt, sel.lastElementChild);
            sel.value = v;
            sel.style.display = 'block';
            this.style.display = 'none';
            this.value = '';
          }
        }
      });
      document.getElementById('editor-text-cat-new').addEventListener('blur', function(e) {
        var v = this.value.trim();
        if (v) {
          var sel = document.getElementById('editor-text-cat');
          var opt = document.createElement('option');
          opt.value = v; opt.textContent = v;
          sel.insertBefore(opt, sel.lastElementChild);
          sel.value = v;
        }
        document.getElementById('editor-text-cat').style.display = 'block';
        this.style.display = 'none';
      });

      document.getElementById('editor-text-save').addEventListener('click', () => {
        const name = document.getElementById('editor-text-name').value.trim();
        if (!name) { toast('请输入文风名称', 'error'); document.getElementById('editor-text-name').focus(); return; }
        var catVal = document.getElementById('editor-text-cat').value;
        var data = {
          name,
          cat: catVal === '__NEW__' ? (document.getElementById('editor-text-cat-new').value.trim() || '未分类') : catVal,
          desc: document.getElementById('editor-text-desc').value.trim(),
          prompt: document.getElementById('editor-text-prompt').value.trim(),
          length: document.getElementById('editor-text-length').value.trim() || '300-500 字',
          strength: document.getElementById('editor-text-strength').value.trim() || '0.65 - 0.85',
          sample: document.getElementById('editor-text-sample').value.trim(),
          ink: genInk(name),
          tags: [...editingTags],
        };
        if (editingTextId) {
          const idx = textStyles.findIndex(x => x.id === editingTextId);
          if (idx >= 0) { data.id = editingTextId; textStyles[idx] = data; }
        } else {
          data.id = 'tx' + Date.now().toString(36);
          textStyles.unshift(data);
        }
        renderTextStyles();
        editorText.classList.remove('open');
        toast(editingTextId ? '已保存修改' : '已添加新文风');
      });
    
});
