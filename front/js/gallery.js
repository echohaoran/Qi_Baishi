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
        t.innerHTML = `<span class="seal sm" style="background:url(../../assets/logo.png) center/cover;color:transparent;">白</span><span>${msg}</span>`;
        document.getElementById('toasts').appendChild(t);
        setTimeout(() => { t.style.opacity = '0'; t.style.transform = 'translateX(20px)'; }, 2400);
        setTimeout(() => t.remove(), 2800);
      }
  
      const presets = [
        { name: '飞白山水', cat: '山水', desc: '枯笔飞白，高山云海，留白三分。', prompt: '远山含黛，云海翻涌，笔意飞白疏朗 —', ratio: '16:9', strength: '0.70 - 0.85', g: 'linear-gradient(160deg, #f8f3e3 0%, #d4c8a8 50%, #a8987a 100%)', ink: 'rgba(29,24,20,0.85)' },
        { name: '云山图', cat: '山水', desc: '米氏云山，米点皴。', prompt: '云山苍茫，米点皴法，烟雨朦胧 —', ratio: '16:9', strength: '0.60 - 0.80', g: 'linear-gradient(180deg, #e8e0cc 0%, #a4a896 50%, #5a6b58 100%)', ink: 'rgba(29,24,20,0.75)' },
        { name: '溪山行旅', cat: '山水', desc: '范宽笔意，高山仰止。', prompt: '高山仰止，溪流潺潺，范宽笔意 —', ratio: '21:9', strength: '0.70 - 0.90', g: 'linear-gradient(45deg, #d4c8a8 0%, #8a7a5a 50%, #3a2e1c 100%)', ink: 'rgba(29,24,20,0.90)' },
        { name: '富春山居', cat: '山水', desc: '黄公望笔意，浅绛设色。', prompt: '富春江畔，浅绛设色，黄公望笔意 —', ratio: '21:9', strength: '0.65 - 0.80', g: 'linear-gradient(135deg, #e8d8b0 0%, #c4a574 50%, #6a4a2a 100%)', ink: 'rgba(29,24,20,0.70)' },
        { name: '工笔花鸟', cat: '花鸟', desc: '宋人笔意，细线淡彩。', prompt: '工笔花鸟，宋院体，细线淡彩 —', ratio: '3:4', strength: '0.50 - 0.70', g: 'radial-gradient(ellipse at 30% 30%, #d4a574, #5a3a20)', ink: 'rgba(168,50,46,0.50)' },
        { name: '墨梅', cat: '花鸟', desc: '王冕墨梅，圈花点蕊。', prompt: '墨梅一枝，圈花点蕊，月下疏影 —', ratio: '1:1', strength: '0.60 - 0.80', g: 'linear-gradient(180deg, #f4ecd6 0%, #a8987a 50%, #2a2018 100%)', ink: 'rgba(29,24,20,0.85)' },
        { name: '荷花翠鸟', cat: '花鸟', desc: '没骨设色，工兼写。', prompt: '荷花翠鸟，没骨设色，工兼写 —', ratio: '3:4', strength: '0.55 - 0.75', g: 'linear-gradient(135deg, #e8d4b4 0%, #a88064 50%, #4a2a1a 100%)', ink: 'rgba(29,24,20,0.70)' },
        { name: '竹石图', cat: '花鸟', desc: '文同笔意，竹影婆娑。', prompt: '竹石图，文同笔意，月下竹影 —', ratio: '4:5', strength: '0.60 - 0.80', g: 'linear-gradient(45deg, #f4ecd6 0%, #7a8a5a 50%, #2d3818 100%)', ink: 'rgba(29,24,20,0.80)' },
        { name: '写意人物', cat: '人物', desc: '梁楷减笔，泼墨意趣。', prompt: '写意人物，梁楷减笔，泼墨意趣 —', ratio: '3:4', strength: '0.70 - 0.90', g: 'radial-gradient(ellipse at 30% 30%, #d4a574, #3a2a1a)', ink: 'rgba(29,24,20,0.85)' },
        { name: '仕女图', cat: '人物', desc: '唐寅仕女，线条流畅。', prompt: '仕女图，唐寅笔意，线条流畅 —', ratio: '3:4', strength: '0.60 - 0.80', g: 'linear-gradient(135deg, #f4d8b4 0%, #c89870 50%, #5a3a20 100%)', ink: 'rgba(29,24,20,0.70)' },
        { name: '钟馗', cat: '人物', desc: '民间意趣，驱邪纳福。', prompt: '钟馗像，民间意趣，朱砂点睛 —', ratio: '3:4', strength: '0.65 - 0.85', g: 'radial-gradient(ellipse at 50% 50%, #c44a44, #2a1a18)', ink: 'rgba(168,50,46,0.60)' },
        { name: '敦煌飞天', cat: '重彩', desc: '石青石绿，金线勾勒。', prompt: '敦煌飞天，石青石绿，金线勾勒 —', ratio: '3:4', strength: '0.60 - 0.80', g: 'linear-gradient(135deg, #6a8a8a 0%, #c44a44 50%, #d4a574 100%)', ink: 'rgba(29,24,20,0.70)' },
        { name: '敦煌菩萨', cat: '重彩', desc: '庄严宝相，矿物质颜料。', prompt: '敦煌菩萨，庄严宝相，矿物颜料 —', ratio: '3:4', strength: '0.55 - 0.75', g: 'linear-gradient(45deg, #d4a574 0%, #c44a44 50%, #4a3a2a 100%)', ink: 'rgba(29,24,20,0.85)' },
        { name: '永乐宫壁画', cat: '重彩', desc: '道教壁画，沉稳厚重。', prompt: '永乐宫壁画，沉稳厚重，朱砂石青 —', ratio: '4:5', strength: '0.60 - 0.80', g: 'linear-gradient(135deg, #c89870 0%, #8a4a3a 50%, #2a1a14 100%)', ink: 'rgba(29,24,20,0.80)' },
        { name: '现代水墨', cat: '现代', desc: '吴冠中点线面。', prompt: '现代水墨，吴冠中，点线面构成 —', ratio: '4:5', strength: '0.70 - 0.90', g: 'linear-gradient(180deg, #f8f3e3 0%, #c4a574 50%, #2a1f15 100%)', ink: 'rgba(29,24,20,0.85)' },
        { name: '抽象水墨', cat: '现代', desc: '赵无极意趣。', prompt: '抽象水墨，赵无极，宇宙洪荒 —', ratio: '1:1', strength: '0.75 - 0.95', g: 'radial-gradient(ellipse at 30% 30%, #cba66e 0%, #4a3522 70%, #1a1612 100%)', ink: 'rgba(29,24,20,0.90)' },
        { name: '极简留白', cat: '现代', desc: '极简构图，大量留白。', prompt: '极简水墨，大面积留白，仅一抹远山 —', ratio: '4:5', strength: '0.50 - 0.70', g: 'linear-gradient(180deg, #f8f3e3 0%, #ebe2cc 60%, #d4c8a8 100%)', ink: 'rgba(29,24,20,0.60)' },
        { name: '青绿山水', cat: '山水', desc: '大青绿设色，辉煌富丽。', prompt: '青绿山水，金碧辉煌，矿物质色 —', ratio: '16:9', strength: '0.60 - 0.80', g: 'linear-gradient(135deg, #6a8a8a 0%, #4a6a5a 50%, #2a3a2a 100%)', ink: 'rgba(29,24,20,0.75)' },
        { name: '雪景寒林', cat: '山水', desc: '郭熙笔意，冬意萧瑟。', prompt: '雪景寒林，郭熙笔意，冬意萧瑟 —', ratio: '16:9', strength: '0.65 - 0.85', g: 'linear-gradient(180deg, #f8f3e3 0%, #d4d4d4 50%, #5a5a5a 100%)', ink: 'rgba(29,24,20,0.65)' },
        { name: '雨意江南', cat: '山水', desc: '烟雨江南，水墨氤氲。', prompt: '雨意江南，水墨氤氲，烟雨朦胧 —', ratio: '16:9', strength: '0.60 - 0.80', g: 'linear-gradient(180deg, #e0e0d0 0%, #a4a896 50%, #4a5a48 100%)', ink: 'rgba(29,24,20,0.70)' },
        { name: '墨兰', cat: '花鸟', desc: '郑思肖墨兰，无土之兰。', prompt: '墨兰一丛，郑思肖笔意，无土之兰 —', ratio: '1:1', strength: '0.55 - 0.75', g: 'linear-gradient(135deg, #f4ecd6 0%, #a8a888 50%, #3a4a28 100%)', ink: 'rgba(29,24,20,0.80)' },
        { name: '鹤寿图', cat: '花鸟', desc: '松鹤延年，寓意吉祥。', prompt: '松鹤延年，寓意吉祥，工笔淡彩 —', ratio: '4:5', strength: '0.60 - 0.80', g: 'linear-gradient(45deg, #e8d4b4 0%, #8a9a7a 50%, #2a2a1a 100%)', ink: 'rgba(29,24,20,0.75)' },
        { name: '罗汉图', cat: '人物', desc: '贯休罗汉，奇崛古怪。', prompt: '罗汉图，贯休笔意，奇崛古怪 —', ratio: '3:4', strength: '0.65 - 0.85', g: 'radial-gradient(ellipse at 50% 30%, #c89870 0%, #4a2a1a 70%, #1a0e08 100%)', ink: 'rgba(29,24,20,0.85)' },
        { name: '禅意水墨', cat: '现代', desc: '禅意空灵，墨色克制。', prompt: '禅意水墨，墨色克制，空灵无物 —', ratio: '1:1', strength: '0.40 - 0.60', g: 'linear-gradient(180deg, #f8f3e3 0%, #e8e0cc 50%, #c4baa4 100%)', ink: 'rgba(29,24,20,0.55)' }
      ];
  
      const grid = document.getElementById('preset-grid');
      presets.forEach((p, i) => {
        const card = document.createElement('div');
        card.className = 'style-card';
        card.style.animationDelay = (i * 30) + 'ms';
        card.classList.add('fade-in');
        card.innerHTML = `
          <div class="preview" style="background: ${p.g};">
            <div class="ink" style="background: radial-gradient(ellipse 60% 40% at 30% 30%, ${p.ink} 0%, transparent 50%), radial-gradient(ellipse 50% 30% at 70% 70%, ${p.ink} 0%, transparent 60%);"></div>
            <div class="name">${p.name}</div>
          </div>
          <div class="meta"><span>${p.cat}</span><span class="num">${p.ratio}</span></div>
        `;
        card.addEventListener('click', () => openDetail(p));
        grid.appendChild(card);
      });
  
      const detail = document.getElementById('detail');
      function openDetail(p) {
        document.getElementById('detailName').textContent = p.name;
        document.getElementById('detail-cat').textContent = p.cat;
        document.getElementById('detail-desc').textContent = p.desc;
        document.getElementById('detail-prompt').textContent = p.prompt;
        const art = document.getElementById('detail-art');
        art.style.background = p.g;
        art.innerHTML = `<div style="position:absolute;inset:0;background:radial-gradient(ellipse 60% 40% at 30% 30%, ${p.ink} 0%, transparent 50%),radial-gradient(ellipse 50% 30% at 70% 70%, ${p.ink} 0%, transparent 60%);mix-blend-mode:multiply;opacity:0.6;"></div>`;
        detail.classList.add('open');
      }
      document.getElementById('detail-close').addEventListener('click', () => detail.classList.remove('open'));
      detail.addEventListener('click', e => { if (e.target === detail) detail.classList.remove('open'); });
      document.getElementById('use-preset').addEventListener('click', () => {
        detail.classList.remove('open');
        toast('已载入预设 · 跳转到文生图');
        setTimeout(() => location.href = 'text-to-image.html', 600);
      });
    
});
