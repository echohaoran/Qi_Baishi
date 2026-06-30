// Auto-extracted from text-to-image.html
document.addEventListener('DOMContentLoaded', function () {
      // OS 切换
      document.querySelectorAll('[data-os-set]').forEach(btn => {
        btn.addEventListener('click', () => {
          document.body.dataset.os = btn.dataset.osSet;
          document.querySelectorAll('[data-os-set]').forEach(b => b.classList.toggle('active', b === btn));
        });
      });
  
      // Toast
      function toast(msg, kind = 'success') {
        const t = document.createElement('div');
        t.className = `toast ${kind}`;
        t.innerHTML = `<span class="seal sm" style="background:url(../../assets/logo.png) center/cover;color:transparent;">白</span><span>${msg}</span>`;
        document.getElementById('toasts').appendChild(t);
        setTimeout(() => { t.style.opacity = '0'; t.style.transform = 'translateX(20px)'; }, 2400);
        setTimeout(() => t.remove(), 2800);
      }
  
      // 字符计数
      const prompt = document.getElementById('prompt');
      const charCount = document.getElementById('char-count');
      prompt.addEventListener('input', () => { charCount.textContent = prompt.value.length; });

      // 从灵感墙 / 画廊预设载入提示词（URL 参数优先，sessionStorage 回退）
      const urlParams = new URLSearchParams(location.search);
      const pendingPrompt = urlParams.get('prompt') || sessionStorage.getItem('baishi_preset_prompt');
      if (pendingPrompt) {
        prompt.value = pendingPrompt;
        charCount.textContent = pendingPrompt.length;
        const pendingRatio = urlParams.get('ratio') || sessionStorage.getItem('baishi_preset_ratio');
        if (pendingRatio) {
          document.querySelectorAll('#ratio-opts .opt').forEach(function(o) {
            o.classList.toggle('active', o.dataset.v === pendingRatio);
          });
          document.getElementById('ratio-val').textContent = pendingRatio;
        }
        sessionStorage.removeItem('baishi_preset_prompt');
        sessionStorage.removeItem('baishi_preset_name');
        sessionStorage.removeItem('baishi_preset_ratio');
        toast('已载入预设 · 提示词就绪');
      }
  
      // 比例 / 数量选择
      function bindOptions(group, valEl, prefix = '') {
        const opts = group.querySelectorAll('.opt');
        opts.forEach(o => o.addEventListener('click', () => {
          opts.forEach(x => x.classList.remove('active'));
          o.classList.add('active');
          valEl.textContent = prefix + o.dataset.v;
        }));
      }
      bindOptions(document.getElementById('ratio-opts'), document.getElementById('ratio-val'));
      // 出图数量滑动条
      const batchSlider = document.getElementById('batch-slider');
      const batchVal = document.getElementById('batch-val');
      batchSlider.addEventListener('input', () => {
        batchVal.textContent = batchSlider.value + ' 张';
      });
  
      // 风格强度
      const slider = document.getElementById('style-slider');
      const styleVal = document.getElementById('style-val');
      slider.addEventListener('input', () => { styleVal.textContent = parseFloat(slider.value).toFixed(2); });
  
      // 出图数量初始值
      if (batchVal) batchVal.textContent = '3 张';
  
      // 种子骰
      const seedInput = document.getElementById('seed-input');
      const seedVal = document.getElementById('seed-val');
      seedInput.addEventListener('input', () => { seedVal.textContent = seedInput.value; });
      document.getElementById('seed-dice').addEventListener('click', () => {
        const n = Math.floor(Math.random() * 9999999);
        seedInput.value = n;
        seedVal.textContent = n;
      });
  
      // 固定提示词：可增删改的数据 + 编辑模式 + 编辑器模态
      const promptPresets = [
        { id: 'pp01', name: '飞白山水',     prompt: '巍峨群山层峦叠嶂，云海翻涌于山腰之间，近处古松苍劲虬曲，飞瀑如白练自悬崖倾泻而下，水雾弥漫。以焦墨枯笔写山石肌理，飞白处若断若连，干湿浓淡相生相发，留白处尽显宣纸本色。山间有隐约石径蜿蜒而上，远峰没入苍茫云霭。整体气势雄浑而静谧，意境悠远深邃，有黄宾虹晚年山水浑厚华滋之气，兼具齐白石墨法自然天真的趣味。' },
        { id: 'pp02', name: '工笔花鸟',     prompt: '一株垂丝海棠自画幅右上角欹斜而出，枝上停驻一只红嘴绶带鸟，长尾如丝线般飘逸垂下，引颈回眸凝视左下方。海棠花有盛放、半开、含苞三种姿态，花瓣以胭脂层层晕染，叶脉勾勒细劲圆润，叶之正反转折色彩变化分明。枝干以没骨法写出，墨色滋润。画面背景大片留白，右下角钤朱文小印一方。整体设色清雅明丽，格调工致婉约，深具宋代院体花鸟静观自然之神韵。' },
        { id: 'pp03', name: '写意人物',     prompt: '一位白发渔翁独坐于秋江岸边石矶之上，头戴棕编斗笠，身披蓑衣，手持青竹钓竿垂目静候。远山仅以淡墨一抹代过，江面开阔，烟波浩渺，数只沙鸥悠然掠过水面。人物以减笔法勾勒，宽袍大袖线条疏朗而不羸弱，面部用笔极简却神采内含，若隐若现的微笑透出超然物外的旷达。画面大片留白，寥寥数笔即传孤独而自在的气韵，有八大山人冷峻清寂之风，亦见白石老人天真平淡之趣。' },
        { id: 'pp04', name: '敦煌重彩',     prompt: '敦煌莫高窟壁画风格的散花天女伎乐天，身姿呈S形曼妙扭转，天衣彩带如云霞般飘举翻飞，一手执五弦琵琶反背于肩后，一手散花于虚空。色彩以天然矿物颜料层层叠染：石青绘天女发髻与裙裾，石绿描飘带与祥云，朱砂点唇及掌心，土黄作身光与背景底色的斑驳感。天女面容丰腴圆润，长眉入鬓，眼微垂慈悲含笑，高髻簪宝冠，三层圆形背光交叠。祥云纹样取自唐代卷草与火焰纹样，整体极富盛唐气象。' },
        { id: 'pp05', name: '吴冠中现代水墨', prompt: '江南水乡春日的乌镇一角：错落有致的白墙黑瓦沿河而立，拱桥横跨碧绿水面，倒影朦胧摇曳。画面以吴冠中标志性的抽象语言——黑瓦屋脊以浓重粗墨线概括书写，白墙以水色淡墨轻轻铺染，留白通透。水面点以大大小小的红、黄、绿、蓝彩色斑点与自由交织的细线，如乐谱上的音符在跳动，抽象灵动。河畔老柳新绿如烟，枝干以书法用笔写出。整体介于具象与抽象之间的诗画境界，色彩鲜亮干净又充满江南湿润气息。' },
        { id: 'pp06', name: '南宋院体',     prompt: '南宋临安西郊秋晚之境：远处淡紫色群峰隐没于暮霭之间，云气缭绕山腰。近处河岸石壁崚嶒，以斧劈皴擦出硬朗质感，笔墨方折刚健。几株秋树错落于岩石之间，红叶与枯枝相间交代出深秋时令。溪畔一茅亭中，文士凭栏远眺，童子于亭后石灶上煮茶，青烟袅袅融入暮色。天空一抹残霞如金，淡墨晕染云层。画风取南宋马远、夏圭一角半边之意，善用对角线构图，大片留白予人无限遐想。' },
        { id: 'pp07', name: '梁楷减笔',     prompt: '大唐诗仙李白醉卧于庭院古松之下，乌纱帽半脱歪斜，青衫散落半袒胸襟，怀抱一只赭红陶酒坛仰面朝天，张口朗笑，放浪形骸之外。人物神采以梁楷减笔泼墨法高度概括：面部仅五六笔勾出孩童般天真神态，眉眼弯弯，髭须散乱；衣袍以大笔淡墨阔扫再以焦墨破墨写出衣折，笔势如风驰电掣；松干以散锋枯笔写出鳞皴，松针以破笔点簇倏忽而成。通篇笔墨狂放不羁而神完气足，将诗仙不拘一格、笑傲江湖的性情展现得淋漓尽致。' },
        { id: 'pp08', name: '徐渭泼墨',     prompt: '盛夏狂风骤雨中的一方荷塘：数枝残荷在烈风中疯狂倾斜卷曲，叶片翻卷露出叶背，茎秆弯折——大笔阔墨横扫泼洒，墨色分明分五色——枯焦处如干裂秋风，湿润处如雨中春山，浓淡交融之间水汽蒸腾氤氲，几可闻雷雨与荷香。一枝红荷虽在风雨中摇摆却倔强不屈，花瓣以朱砂信笔点染，色彩与满纸玄墨形成惊心动魄的对比张力。画面下方狂草落款与涟漪墨痕融为一体，笔势狂暴恣肆，情感张力逼人，完美体现徐渭大写意花鸟画的灵魂。' },
      ];
      let promptEditMode = false;
      let editingPromptId = null;       // null = 新建；id = 编辑
      let pendingDeletePromptId = null;
  
      const promptGrid   = document.getElementById('prompt-presets-grid');
      const editToggle   = document.getElementById('prompt-edit-toggle');
      const editToggleLb = document.getElementById('prompt-edit-toggle-label');
      const editor       = document.getElementById('prompt-editor');
      const editorTitle  = document.getElementById('prompt-editor-title');
      const editorName   = document.getElementById('prompt-editor-name');
      const editorText   = document.getElementById('prompt-editor-text');
      const editorSave   = document.getElementById('prompt-editor-save');
      const editorCancel = document.getElementById('prompt-editor-cancel');
      const editorClose  = document.getElementById('prompt-editor-close');
  
      function renderPromptPresets() {
        promptGrid.innerHTML = '';
        // 添加占位卡（永远在首位）
        if (promptEditMode) {
          const addBtn = document.createElement('span');
          addBtn.className = 'prompt-add-card';
          addBtn.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"></path></svg>添加';
          addBtn.addEventListener('click', () => openPromptEditor(null));
          promptGrid.appendChild(addBtn);
        }
        promptPresets.forEach((p, idx) => {
          const wrap = document.createElement('span');
          wrap.className = 'prompt-chip-wrap';
          wrap.style.position = 'relative';
          wrap.style.display = 'inline-flex';
          wrap.dataset.promptId = p.id;
  
          const chip = document.createElement('span');
          chip.className = 'chip';
          chip.dataset.prompt = p.prompt;
          if (idx === 0 && !promptEditMode) chip.classList.add('active');
          chip.textContent = '+ ' + p.name;
  
          if (!promptEditMode) {
            // 正常点击：追加到提示词
            chip.addEventListener('click', () => {
              const cur = prompt.value.trim();
              prompt.value = cur ? `${cur}，${p.prompt}` : p.prompt;
              charCount.textContent = prompt.value.length;
              chip.classList.add('active');
              setTimeout(() => chip.classList.remove('active'), 400);
              toast(`已追加提示词 · ${p.name}`);
            });
          } else {
            // 编辑模式：点击 chip 打开编辑器
            chip.style.cursor = 'pointer';
            chip.addEventListener('click', () => openPromptEditor(p.id));
          }
  
          // 编辑/删除叠加层
          if (promptEditMode) {
            const overlay = document.createElement('span');
            overlay.className = 'prompt-card-edit-overlay';
            overlay.innerHTML = `
              <button class="edit" type="button" title="编辑">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z"></path></svg>
              </button>
              <button class="del" type="button" title="删除">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M6 6l12 12M18 6 6 18"></path></svg>
              </button>
            `;
            overlay.querySelector('.edit').addEventListener('click', (e) => {
              e.stopPropagation();
              openPromptEditor(p.id);
            });
            overlay.querySelector('.del').addEventListener('click', (e) => {
              e.stopPropagation();
              showPromptDeleteConfirm(p.id, wrap);
            });
  
            // 二次确认层
            const confirm = document.createElement('span');
            confirm.className = 'prompt-delete-confirm';
            confirm.innerHTML = `
              <span>删除？</span>
              <button class="ok" type="button">确定</button>
              <button class="cancel" type="button">取消</button>
            `;
            confirm.querySelector('.ok').addEventListener('click', (e) => {
              e.stopPropagation();
              executePromptDelete(p.id);
            });
            confirm.querySelector('.cancel').addEventListener('click', (e) => {
              e.stopPropagation();
              confirm.classList.remove('show');
              pendingDeletePromptId = null;
            });
  
            wrap.appendChild(chip);
            wrap.appendChild(overlay);
            wrap.appendChild(confirm);
          } else {
            wrap.appendChild(chip);
          }
          promptGrid.appendChild(wrap);
        });
      }
  
      function showPromptDeleteConfirm(id, wrapEl) {
        const all = promptGrid.querySelectorAll('.prompt-delete-confirm.show');
        all.forEach(el => el.classList.remove('show'));
        pendingDeletePromptId = id;
        const cf = wrapEl.querySelector('.prompt-delete-confirm');
        if (cf) cf.classList.add('show');
      }
  
      function executePromptDelete(id) {
        const idx = promptPresets.findIndex(x => x.id === id);
        if (idx >= 0) {
          const removed = promptPresets.splice(idx, 1)[0];
          renderPromptPresets();
          toast(`已删除 · ${removed.name}`);
        }
        pendingDeletePromptId = null;
      }
  
      function openPromptEditor(id) {
        editingPromptId = id;
        if (id) {
          const p = promptPresets.find(x => x.id === id);
          if (!p) return;
          editorTitle.textContent = '编辑固定提示词';
          editorName.value = p.name;
          editorText.value = p.prompt;
        } else {
          editorTitle.textContent = '新建固定提示词';
          editorName.value = '';
          editorText.value = '';
        }
        editor.hidden = false;
        setTimeout(() => editorName.focus(), 30);
      }
  
      function closePromptEditor() {
        editor.hidden = true;
        editingPromptId = null;
      }
  
      function savePromptPreset() {
        const name = editorName.value.trim();
        const txt  = editorText.value.trim();
        if (!name) { toast('请填写名称', 'error'); editorName.focus(); return; }
        if (!txt)  { toast('请填写提示词', 'error'); editorText.focus(); return; }
        if (editingPromptId) {
          const p = promptPresets.find(x => x.id === editingPromptId);
          if (p) { p.name = name; p.prompt = txt; toast(`已更新 · ${name}`); }
        } else {
          promptPresets.unshift({
            id: 'pp' + Date.now().toString(36),
            name, prompt: txt
          });
          toast(`已新建 · ${name}`);
        }
        closePromptEditor();
        renderPromptPresets();
      }
  
      editToggle.addEventListener('click', () => {
        promptEditMode = !promptEditMode;
        editToggle.classList.toggle('active', promptEditMode);
        editToggleLb.textContent = promptEditMode ? '完成' : '编辑';
        document.body.classList.toggle('prompt-edit-on', promptEditMode);
        // 清掉任何残留的二次确认
        pendingDeletePromptId = null;
        promptGrid.querySelectorAll('.prompt-delete-confirm.show')
          .forEach(el => el.classList.remove('show'));
        renderPromptPresets();
      });
  
      editorSave.addEventListener('click', savePromptPreset);
      editorCancel.addEventListener('click', closePromptEditor);
      editorClose.addEventListener('click', closePromptEditor);
      editor.addEventListener('click', (e) => { if (e.target === editor) closePromptEditor(); });
  
      // 首次渲染
      renderPromptPresets();
  
  
      // 智能润色
      document.getElementById('enhance-btn').addEventListener('click', () => {
        if (!prompt.value.trim()) { toast('请先输入提示词', 'error'); return; }
        const enhanced = prompt.value + '，飞白与皴法交融，留白三分，笔意疏朗';
        prompt.value = enhanced;
        charCount.textContent = prompt.value.length;
        toast('已润色 · 增加飞白与留白');
      });
  
      // 清空
      document.getElementById('clear-btn').addEventListener('click', () => {
        prompt.value = '';
        charCount.textContent = 0;
        document.getElementById('result-empty').style.display = 'grid';
        document.getElementById('result-grid').style.display = 'none';
      });
  
      // 生图
      const genBtn = document.getElementById('generate-btn');
      let generating = false;
      genBtn.addEventListener('click', () => {
        if (generating) return;
        if (!prompt.value.trim()) { toast('请先输入提示词', 'error'); return; }
        generating = true;
        const orig = genBtn.innerHTML;
        genBtn.innerHTML = '<span>正在落笔…</span>';
        genBtn.disabled = true;
        document.getElementById('result-empty').style.display = 'none';
        document.getElementById('result-grid').style.display = 'grid';
        setTimeout(() => {
          genBtn.innerHTML = orig;
          genBtn.disabled = false;
          generating = false;
          toast('生图完成 · 4 张作品已就位');
        }, 1800);
      });
  
      // 作品图注入
      const arts = {
        g1: 'radial-gradient(ellipse at 30% 30%, #d4a574, #4a3522)',
        g2: 'radial-gradient(ellipse at 70% 70%, #a4a896, #2d3818)',
        g3: 'linear-gradient(135deg, #cba66e, #5a3a20)',
        g4: 'radial-gradient(circle at 50% 50%, #b4a07e, #2a1f15)'
      };
      document.querySelectorAll('[data-art]').forEach(el => {
        const k = el.dataset.art;
        if (arts[k]) {
          el.style.background = arts[k];
          el.style.position = 'relative';
        }
      });
  
      // ⌘ + ⏎
      document.addEventListener('keydown', (e) => {
        if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
          e.preventDefault();
          genBtn.click();
        }
      });
    
});
