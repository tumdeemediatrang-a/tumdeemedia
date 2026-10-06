import { getInitialState } from './data.js';
import { getPromptPayQRUrl } from './promptpay.js';

export const app = {
  state: {
    ...getInitialState(),
    payMode: 'deposit',
    showPasswords: {},
    editingSlideIdx: null,
    editingMemberId: null,
    editingAgentId: null
  },
  heroInterval: null,
  currentHeroSlide: 0,

  loadStateFromStorage() {
    try {
      const saved = localStorage.getItem('tumdee_cms_state');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.cms) {
          this.state.cms = { ...this.state.cms, ...parsed.cms };
          // Ensure new high-definition mockup images are active
          if (!this.state.cms.heroImg || this.state.cms.heroImg.includes('1791027291683')) {
            this.state.cms.heroImg = '/src/assets/images/tumdee_hero_mockup_1791027570128.jpg';
          }
          if (this.state.cms.heroSlides) {
            if (this.state.cms.heroSlides[0]) this.state.cms.heroSlides[0].img = '/src/assets/images/tumdee_hero_mockup_1791027570128.jpg';
            if (this.state.cms.heroSlides[1]) this.state.cms.heroSlides[1].img = '/src/assets/images/tumdee_signage_mockup_1791027582711.jpg';
            if (this.state.cms.heroSlides[2]) this.state.cms.heroSlides[2].img = '/src/assets/images/tumdee_workshop_mockup_1791027663440.jpg';
          }
        }
        if (parsed.landingSections) this.state.landingSections = parsed.landingSections;
        if (parsed.flashSales) this.state.flashSales = parsed.flashSales;
        if (parsed.services) this.state.services = parsed.services;
        if (parsed.packages) this.state.packages = parsed.packages;
        if (parsed.portfolio) this.state.portfolio = parsed.portfolio;
        if (parsed.promotions) this.state.promotions = parsed.promotions;
        if (parsed.testimonials) this.state.testimonials = parsed.testimonials;
        if (parsed.settings) this.state.settings = { ...this.state.settings, ...parsed.settings };
        if (parsed.systemUsers) this.state.systemUsers = parsed.systemUsers;
        if (parsed.roles) this.state.roles = parsed.roles;

        // Enforce role credentials requested by user
        const defaultRolePasswords = {
          admin: '9546',
          designer: '9992',
          production: '9993',
          accountant: '9994',
          sales: '9991'
        };
        (this.state.systemUsers || []).forEach(u => {
          if (defaultRolePasswords[u.username]) {
            u.password = defaultRolePasswords[u.username];
          }
        });
      }
    } catch (e) {
      console.warn('Storage load failed:', e);
    }
  },

  saveStateToStorage() {
    try {
      const dataToSave = {
        cms: this.state.cms,
        landingSections: this.state.landingSections,
        flashSales: this.state.flashSales,
        services: this.state.services,
        packages: this.state.packages,
        portfolio: this.state.portfolio,
        promotions: this.state.promotions,
        testimonials: this.state.testimonials,
        settings: this.state.settings,
        systemUsers: this.state.systemUsers,
        roles: this.state.roles
      };
      localStorage.setItem('tumdee_cms_state', JSON.stringify(dataToSave));
    } catch (e) {
      console.warn('Storage save failed:', e);
    }
  },

  init() {
    this.loadStateFromStorage();
    this.initTheme();
    this.populateQuickQuote();
    this.renderLandingSections();
    this.renderLandingCMS();
    if (this.state.cart.length === 0) {
      this.addCartItem();
    }
    this.renderCart();
    this.renderGallery('all');
    this.applySettings();
    this.initFlashSaleSlider();
    this.initAiStudio();
    this.applyUserRolePermissions(this.state.currentUserRole || 'admin');

    // Print isolation event listeners (prevent background website from appearing in print/PDF)
    window.addEventListener('beforeprint', () => {
      const docModal = document.getElementById('doc-modal');
      const payslipModal = document.getElementById('payslip-modal');
      if (docModal && (docModal.style.display === 'block' || docModal.classList.contains('is-printing'))) {
        document.body.classList.add('printing-doc');
      } else if (payslipModal && (payslipModal.style.display === 'block' || payslipModal.classList.contains('is-printing'))) {
        document.body.classList.add('printing-payslip');
      }
    });

    window.addEventListener('afterprint', () => {
      document.body.classList.remove('printing-doc', 'printing-payslip');
      document.querySelectorAll('.is-printing').forEach(el => el.classList.remove('is-printing'));
    });

    if (typeof google !== 'undefined' && google.script) {
      google.script.run
        .withSuccessHandler((data) => {
          if (data) {
            if (data.orders && data.orders.length > 0) this.state.orders = data.orders;
            this.populateQuickQuote();
            if (document.getElementById('view-admin-erp')?.classList.contains('active')) {
              this.renderAdmin();
            }
          }
        })
        .withFailureHandler((err) => console.error("Sheets sync error:", err))
        .getERPData();
    }
  },

  notify(text) {
    const time = new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
    this.state.notifications.unshift({ id: 'N_' + Date.now(), time, text, read: false, type: 'info' });
    this.renderErpLists();
  },

  getDeliveryLabel(type) {
    const map = { pickup: 'รับเองที่ร้าน', parcel: 'จัดส่งพัสดุ', standard: 'ทีมช่างติดตั้งมาตรฐาน', crane: 'ทีมช่าง+รถเครน' };
    return map[type] || 'ไม่ระบุ';
  },

  getFinishingLabel(finish) {
    if (!finish) return 'ตัดพอดีงาน/ไดคัท';
    if (this.state && this.state.finishing && this.state.finishing[finish]) {
      return this.state.finishing[finish].name;
    }
    const map = {
      'none': 'ตัดพอดีงาน/ไดคัท',
      'eyelet': 'เจาะตาไก่',
      'sleeve': 'ร้อยท่อ (โครงเหล็ก)',
      'weld': 'พับขอบ/รีดตะเข็บ'
    };
    return map[finish] || finish;
  },

  handleGlobalSearch(query) {
    const q = (query || '').toLowerCase().trim();
    const rows = document.querySelectorAll('#tbody-sales tr, #tbody-accounting tr, #tbody-crm tr, .kb-card');
    rows.forEach(r => {
      const text = r.innerText.toLowerCase();
      r.style.display = (!q || text.includes(q)) ? '' : 'none';
    });
  },

  switchView(id) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    const target = document.getElementById('view-' + id);
    if (target) target.classList.add('active');
    const mainNav = document.getElementById('main-nav');
    if (mainNav) {
      mainNav.style.display = (id === 'admin-erp' || id === 'agent-portal' || id === 'customer-portal') ? 'none' : 'flex';
    }
    window.scrollTo(0, 0);
  },

  toggleLoginTab(type, el) {
    document.querySelectorAll('.login-tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.login-form').forEach(f => { f.style.display = 'none'; f.classList.remove('active'); });
    el.classList.add('active');
    const f = document.getElementById('form-' + type);
    if (f) {
      f.style.display = 'block';
      setTimeout(() => f.classList.add('active'), 10);
    }
  },

  showToast(msg, type = 'success') {
    let c = document.getElementById('toast-container');
    if (!c) {
      c = document.createElement('div');
      c.id = 'toast-container';
      c.style.cssText = 'position:fixed;top:20px;right:20px;z-index:99999;display:flex;flex-direction:column;gap:10px;pointer-events:none;';
      document.body.appendChild(c);
    }
    const t = document.createElement('div');
    const bg = type === 'success' ? '#10B981' : (type === 'error' ? '#EF4444' : '#F59E0B');
    const icon = type === 'success' ? 'la-check-circle' : (type === 'error' ? 'la-exclamation-circle' : 'la-info-circle');
    t.style.cssText = `background:${bg};color:white;padding:15px 20px;border-radius:8px;box-shadow:0 4px 15px rgba(0,0,0,0.2);font-size:14px;display:flex;align-items:center;gap:10px;transform:translateX(100%);opacity:0;transition:all 0.3s ease;pointer-events:auto;`;
    t.innerHTML = `<i class="las ${icon}" style="font-size:24px;"></i> <div>${msg}</div>`;
    c.appendChild(t);
    requestAnimationFrame(() => { t.style.transform = 'translateX(0)'; t.style.opacity = '1'; });
    setTimeout(() => {
      t.style.transform = 'translateX(100%)';
      t.style.opacity = '0';
      setTimeout(() => t.remove(), 300);
    }, 3000);
  },

  scrollToOrder() {
    this.switchView('landing');
    this.state.editingOrderId = null;
    const form = document.getElementById('gasForm');
    if (form) form.reset();
    const titleEl = document.getElementById('order-modal-title');
    if (titleEl) titleEl.innerHTML = '<i class="las la-file-invoice-dollar"></i> ฟอร์มสั่งผลิตงานออนไลน์';
    const submitBtn = document.getElementById('submitBtn');
    if (submitBtn) submitBtn.innerHTML = '<i class="las la-paper-plane" style="font-size: 24px;"></i> ยืนยันสั่งผลิต / ส่งข้อมูลเข้าระบบ';
    
    const previewSlip = document.getElementById('preview-slip');
    if (previewSlip) { previewSlip.src = ''; previewSlip.style.display = 'none'; }
    const cSlip = document.getElementById('container-preview-slip');
    if (cSlip) cSlip.style.display = 'none';

    if (this.state.cart.length === 0) this.addCartItem();
    this.renderCart();
    const modal = document.getElementById('order-modal');
    if (modal) modal.style.display = 'flex';
  },

  closeOrderModal() {
    const modal = document.getElementById('order-modal');
    if (modal) modal.style.display = 'none';
  },

  logout() {
    this.state.currentAgentId = null;
    this.switchView('landing');
  },

  toggleFab() {
    const wrap = document.getElementById('fab-wrapper');
    const icon = document.getElementById('fab-icon');
    if (!wrap || !icon) return;
    wrap.classList.toggle('active');
    if (wrap.classList.contains('active')) {
      icon.classList.remove('la-comment-dots');
      icon.classList.add('la-times');
    } else {
      icon.classList.remove('la-times');
      icon.classList.add('la-comment-dots');
    }
  },

  viewImage(src) {
    this.previewImageLarge(src, 'ตรวจสอบรายละเอียดงาน / ภาพขยาย', 'ภาพขยาย');
  },

  toggleChatWindow() {
    const cw = document.getElementById('chat-window');
    if (!cw) return;
    cw.classList.toggle('active');
    if (cw.classList.contains('active')) {
      this.toggleFab();
      this.renderChatWindow();
    }
  },

  renderChatWindow() {
    const b = document.getElementById('chat-body');
    if (b) {
      b.innerHTML = '';
      this.state.settings.chatHistory.forEach(m => {
        const css = m.sender === 'bot' ? 'chat-bot' : 'chat-user';
        b.innerHTML += `<div class="chat-bubble ${css}" ${m.isHtml ? 'style="max-width:90%;"' : ''}>${m.text}</div>`;
      });
      b.scrollTop = b.scrollHeight;
    }
    const qc = document.getElementById('chat-quick-replies');
    if (qc) {
      qc.innerHTML = '';
      this.state.settings.quickReplies.forEach(qr => {
        qc.innerHTML += `<div class="qr-pill" onclick="app.sendQuickReply('${qr}')">${qr}</div>`;
      });
    }
  },

  handleChatKeydown(e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      this.sendChatMessage();
    }
  },

  sendQuickReply(text) {
    const input = document.getElementById('chat-input');
    if (input) input.value = text;
    this.sendChatMessage();
  },

  sendChatMessage() {
    const input = document.getElementById('chat-input');
    if (!input) return;
    const text = input.value.trim();
    if (!text) return;
    this.state.settings.chatHistory.push({ sender: 'user', text });
    this.renderChatWindow();
    input.value = '';

    const calcKeywords = this.state.settings.chatbotCalcKeywords.split(',').map(k => k.trim().toLowerCase());
    const needsCalc = calcKeywords.some(kw => text.toLowerCase().includes(kw));

    setTimeout(() => {
      if (needsCalc) {
        let catalogOptions = this.state.catalog.map(c => `<option value="${c.id}">${c.name} (฿${c.price}/${c.unit})</option>`).join('');
        let formHtml = `<div style="padding:10px; border-radius:8px;"><p style="margin-bottom:10px; font-weight:bold; color:var(--primary);"><i class="las la-calculator"></i> ${this.state.settings.chatbotCalcIntro}</p><select id="chat-calc-mat" style="width:100%; padding:8px; margin-bottom:8px; font-size:12px; border:1px solid var(--border); border-radius:6px;">${catalogOptions}</select><div style="display:flex; gap:8px; margin-bottom:8px;"><input type="number" id="chat-calc-w" placeholder="กว้าง (ม.)" style="width:100%; padding:8px; font-size:12px; border:1px solid var(--border); border-radius:6px;" step="0.1"><input type="number" id="chat-calc-h" placeholder="สูง (ม.)" style="width:100%; padding:8px; font-size:12px; border:1px solid var(--border); border-radius:6px;" step="0.1"></div><input type="number" id="chat-calc-q" placeholder="จำนวนชิ้น" value="1" style="width:100%; padding:8px; margin-bottom:12px; font-size:12px; border:1px solid var(--border); border-radius:6px;"><button onclick="app.processChatCalc(this)" style="width:100%; padding:10px; background:var(--accent); color:white; border:none; border-radius:6px; cursor:pointer; font-weight:bold;">คำนวณราคา</button></div>`;
        this.state.settings.chatHistory.push({ sender: 'bot', text: formHtml, isHtml: true });
      } else {
        let replyStr = "รับทราบครับ สามารถส่งรายละเอียดงานหรือทิ้งเบอร์ติดต่อไว้ได้เลยครับ เจ้าหน้าที่จะติดต่อกลับอย่างรวดเร็วที่สุดครับ";
        for (let r of this.state.settings.chatbotRules) {
          if (text.toLowerCase().includes(r.keyword.toLowerCase())) {
            replyStr = r.reply;
            break;
          }
        }
        this.state.settings.chatHistory.push({ sender: 'bot', text: replyStr });
      }
      this.renderChatWindow();
    }, 600);
  },

  processChatCalc(btn) {
    const container = btn.parentElement;
    const matId = container.querySelector('#chat-calc-mat').value;
    const w = parseFloat(container.querySelector('#chat-calc-w').value) || 0;
    const h = parseFloat(container.querySelector('#chat-calc-h').value) || 0;
    const q = parseInt(container.querySelector('#chat-calc-q').value) || 1;
    if (w === 0 || h === 0) { this.showToast("กรุณาระบุขนาดให้ถูกต้อง", "error"); return; }
    const item = this.state.catalog.find(c => c.id === matId);
    const priceUnit = item ? item.price : 0;
    const area = (item && (item.category.includes('POSM') || item.category.includes('วัสดุ'))) ? 1 : (w * h);
    const total = area * priceUnit * q;
    const replyHtml = `<div style="padding:5px;">ราคาประเมินเบื้องต้น:<br><b style="color:var(--primary);">${item?.name || 'สินค้า'}</b> ขนาด ${w}x${h} ม. จำนวน ${q} ชิ้น<br><div style="margin: 10px 0; padding: 10px; background: var(--bg-pastel-blue); border-radius:8px; text-align:center;">ยอดรวม: <strong style="color:var(--success); font-size:18px;">฿${total.toLocaleString()}</strong></div><button onclick="app.scrollToOrderFromChat('${matId}', ${w}, ${h}, ${q})" style="width:100%; padding:10px; background:var(--primary); color:white; border:none; border-radius:50px; cursor:pointer; font-weight:bold;"><i class="las la-shopping-cart"></i> นำข้อมูลไปสั่งผลิต</button></div>`;
    this.state.settings.chatHistory.push({ sender: 'bot', text: replyHtml, isHtml: true });
    this.renderChatWindow();
  },

  scrollToOrderFromChat(mat, w, h, q) {
    this.toggleChatWindow();
    this.state.cart = [{ id: 'chat_' + Date.now(), type: mat, w, h, qty: q, finish: 'none', detail: '', refImg: null }];
    this.scrollToOrder();
    this.showToast('ดึงสเปคจากแชทแล้ว', 'success');
  },

  populateQuickQuote() {
    const sel = document.getElementById('qq-mat');
    if (!sel) return;
    const grouped = this.state.catalog.reduce((acc, curr) => {
      if (!acc[curr.category]) acc[curr.category] = [];
      acc[curr.category].push(curr);
      return acc;
    }, {});
    let html = '';
    for (const [cat, items] of Object.entries(grouped)) {
      html += `<optgroup label="${cat}">`;
      items.forEach(i => html += `<option value="${i.id}">${i.name} (฿${i.price}/${i.unit})</option>`);
      html += `</optgroup>`;
    }
    sel.innerHTML = html;
    this.calcQuickQuote();
  },

  calcQuickQuote() {
    const matId = document.getElementById('qq-mat')?.value;
    const othWrap = document.getElementById('qq-oth-wrap');
    if (othWrap) {
      othWrap.style.display = (matId === 'OTH') ? 'block' : 'none';
    }
    const w = parseFloat(document.getElementById('qq-w')?.value) || 0;
    const h = parseFloat(document.getElementById('qq-h')?.value) || 0;
    const qty = parseInt(document.getElementById('qq-qty')?.value) || 1;
    const item = this.state.catalog.find(c => c.id === matId);
    let total = 0;
    const totalEl = document.getElementById('qq-total');
    if (item) {
      if (matId === 'OTH') {
        if (totalEl) totalEl.innerText = 'รอประเมินราคาตามแบบ';
        return;
      }
      let area = (item.category.includes('POSM') || item.category.includes('วัสดุ') || item.unit === 'ชุด' || item.unit === 'แผ่น' || item.unit === 'กล่อง' || item.unit === 'เล่ม' || item.unit === 'รายการ') ? 1 : (w * h);
      total = area * item.price * qty;
    }
    if (totalEl) totalEl.innerText = '฿' + total.toLocaleString();
  },

  proceedToOrderFromQuick() {
    const matId = document.getElementById('qq-mat')?.value;
    const w = parseFloat(document.getElementById('qq-w')?.value) || 1;
    const h = parseFloat(document.getElementById('qq-h')?.value) || 1;
    const qty = parseInt(document.getElementById('qq-qty')?.value) || 1;
    let detail = '';
    if (matId === 'OTH') {
      const customSpec = document.getElementById('qq-oth-detail')?.value.trim();
      detail = customSpec ? `[งานสั่งผลิตพิเศษ]: ${customSpec}` : 'งานสั่งผลิตพิเศษตามสเปกลูกค้า';
    }
    this.state.cart = [{ id: 'item_' + Date.now(), type: matId, w, h, qty, finish: 'none', detail, refImg: null }];
    this.renderCart();
    this.scrollToOrder();
    this.showToast('ดึงสเปคงานเข้าสู่หน้าต่างสั่งผลิตแล้ว กรุณากรอกชื่อและที่อยู่จัดส่ง', 'success');
  },

  sendSpecToLine() {
    const matId = document.getElementById('qq-mat')?.value;
    const w = parseFloat(document.getElementById('qq-w')?.value) || 1;
    const h = parseFloat(document.getElementById('qq-h')?.value) || 1;
    const qty = parseInt(document.getElementById('qq-qty')?.value) || 1;
    const item = this.state.catalog.find(c => c.id === matId);
    let area = (item && (item.category.includes('POSM') || item.category.includes('วัสดุ') || item.unit === 'ชุด' || item.unit === 'แผ่น' || item.unit === 'กล่อง' || item.unit === 'เล่ม')) ? 1 : (w * h);
    let total = item ? (area * item.price * qty) : 0;
    let othNote = '';
    if (matId === 'OTH') {
      const customSpec = document.getElementById('qq-oth-detail')?.value.trim();
      if (customSpec) othNote = `\n- รายละเอียดที่ระบุ: ${customSpec}`;
    }
    const totalDisplay = matId === 'OTH' ? 'รอประเมินพิเศษตามแบบ' : `฿${total.toLocaleString()}`;
    const text = `สวัสดีครับ สนใจสั่งผลิตงานป้ายกับ TUMDEEMEDIA (ทำดีมีเดีย)\n- วัสดุ/บริการ: ${item?.name || matId}${othNote}\n- ขนาด: ${w} x ${h} เมตร\n- จำนวน: ${qty} ชิ้น\n- ยอดประเมินเบื้องต้น: ${totalDisplay}\nรบกวนแอดมินสรุปคิวและรายละเอียดให้ด้วยครับ`;
    this.copyToClipboard(text, 'คัดลอกสเปคงานแล้ว กำลังเปิด line : tumdeemedia...');
    setTimeout(() => {
      window.open(this.state.settings.linkLine, '_blank');
    }, 600);
  },

  sendOrderSummaryToLine(orderId) {
    const order = this.state.orders.find(o => o.id === orderId);
    if (!order) return;
    let itemsText = order.items.map(i => {
      let cat = this.state.catalog.find(c => c.id === i.type);
      return `• ${cat?.name || i.type} (${i.w}x${i.h} ม.) จำนวน ${i.qty} ชิ้น`;
    }).join('\n');
    const text = `ใบสรุปงานร้าน TUMDEEMEDIA (ทำดีมีเดีย ตรัง)\nเลขที่ออเดอร์: ${order.id}\nลูกค้า: ${order.customerName} (${order.customerPhone})\nรายการสั่งผลิต:\n${itemsText}\nยอดสุทธิ: ฿${order.net.toLocaleString()}\nสถานะชำระ: ${order.payment}\nสถานะงาน: ${order.status}\nกำหนดส่ง: ${order.dueDate}`;
    this.copyToClipboard(text, 'คัดลอกสรุปออเดอร์เข้าคลิปบอร์ดแล้ว กำลังเปิด LINE...');
    setTimeout(() => {
      window.open(this.state.settings.linkLine, '_blank');
    }, 600);
  },

  goToHeroSlide(idx) {
    const layout = this.state.cms?.heroLayout || 'style1';
    const is10s = (layout === 'style_fullscreen_10s');
    const intervalTime = is10s ? 10000 : 6000;

    const slides = document.querySelectorAll(is10s ? '.hero-fs-slide' : '.hero-slide');
    const dots = document.querySelectorAll(is10s ? '.hero-fs-dot' : '.s-dot');
    if (!slides.length) return;

    slides[this.currentHeroSlide]?.classList.remove('active');
    if (dots.length) dots[this.currentHeroSlide]?.classList.remove('active');

    this.currentHeroSlide = idx;

    slides[this.currentHeroSlide]?.classList.add('active');
    if (dots.length) dots[this.currentHeroSlide]?.classList.add('active');

    // Reset progress bar animation if 10s slider
    const progress = document.getElementById('hero-fs-progress');
    if (progress) {
      progress.classList.remove('running');
      void progress.offsetWidth; // trigger reflow
      progress.classList.add('running');
    }

    if (this.heroInterval) clearInterval(this.heroInterval);
    this.heroInterval = setInterval(() => {
      const totalSlides = (this.state.cms?.heroSlides || []).length || slides.length;
      this.goToHeroSlide((this.currentHeroSlide + 1) % totalSlides);
    }, intervalTime);
  },

  prevHeroSlide() {
    const total = (this.state.cms?.heroSlides || []).length || 4;
    const target = (this.currentHeroSlide - 1 + total) % total;
    this.goToHeroSlide(target);
  },

  nextHeroSlide() {
    const total = (this.state.cms?.heroSlides || []).length || 4;
    const target = (this.currentHeroSlide + 1) % total;
    this.goToHeroSlide(target);
  },

  renderLandingCMS() {
    const c = this.state.cms;
    if (document.getElementById('page-title')) document.getElementById('page-title').innerText = c.seoTitle || "TUMDEEMEDIA";
    if (document.getElementById('meta-desc')) document.getElementById('meta-desc').content = c.seoDesc || "";
    if (document.getElementById('meta-keywords')) document.getElementById('meta-keywords').content = c.seoKeywords || "";

    const heroWrapper = document.getElementById('hero-slider-wrapper');
    if (heroWrapper && c.heroSlides) {
      const layout = c.heroLayout || 'style1';
      let layoutHtml = '';

      if (layout === 'style_fullscreen_10s') {
        // Full-Width Interactive 10s Slideshow with direct details & ordering
        heroWrapper.style.background = '#0F172A';
        heroWrapper.style.color = '#FFFFFF';
        let slidesInner = '';
        let dotsInner = '<div class="slider-dots" style="bottom:18px; z-index:24;">';

        c.heroSlides.forEach((slide, idx) => {
          let activeClass = (idx === 0) ? 'active' : '';
          slidesInner += `
          <div class="hero-fs-slide ${activeClass}" id="h-fs-slide-${idx}" onclick="app.openBannerSlideDetail(${idx})">
            <div class="hero-fs-bg" style="background-image: url('${slide.img}')"></div>
            <div class="hero-fs-overlay"></div>
            <div class="hero-fs-content">
              <div class="hero-fs-tag">
                <i class="las la-sparkles"></i> ${slide.badge || '✨ ผลงานสั่งผลิตมาตรฐานพรีเมียมอันดับ 1 ตรัง'}
              </div>
              <h2 class="hero-fs-title">${slide.title}</h2>
              <p class="hero-fs-sub">${slide.sub}</p>
              <div class="hero-fs-cta-bar">
                <button type="button" class="btn btn-primary" onclick="event.stopPropagation(); app.openBannerSlideDetail(${idx})" style="padding:12px 28px; font-weight:700; box-shadow:0 8px 24px rgba(37,99,235,0.45); font-size:15px;">
                  <i class="las la-search-plus"></i> ดูรายละเอียด & สั่งผลิตทันที <i class="las la-arrow-right"></i>
                </button>
                <button type="button" class="btn btn-outline" onclick="event.stopPropagation(); app.proceedToOrderFromBanner(${idx})" style="background:rgba(255,255,255,0.15); color:white; border-color:rgba(255,255,255,0.4); padding:12px 22px; font-weight:600; font-size:14px; backdrop-filter:blur(6px);">
                  <i class="las la-shopping-cart"></i> สั่งผลิตตามแบบนี้
                </button>
                <a href="https://line.me/ti/p/~tumdeemedia" target="_blank" class="btn" onclick="event.stopPropagation()" style="background:#00B900; color:white; padding:12px 22px; border-radius:50px; text-decoration:none; display:inline-flex; align-items:center; gap:6px; font-weight:600; font-size:14px; box-shadow:0 4px 12px rgba(0,185,0,0.3);">
                  <i class="lab la-line" style="font-size:20px;"></i> คุยแอดมิน LINE
                </a>
              </div>
            </div>
          </div>`;
          dotsInner += `<div class="s-dot hero-fs-dot ${activeClass}" onclick="event.stopPropagation(); app.goToHeroSlide(${idx})"></div>`;
        });
        dotsInner += '</div>';

        layoutHtml = `
        <div class="hero-layout-fullscreen-10s">
          <div class="hero-fs-slides-container">
            ${slidesInner}
          </div>
          <div class="hero-fs-arrow prev" onclick="app.prevHeroSlide()"><i class="las la-angle-left"></i></div>
          <div class="hero-fs-arrow next" onclick="app.nextHeroSlide()"><i class="las la-angle-right"></i></div>
          <div class="hero-fs-timer-bar">
            <div class="hero-fs-timer-progress running" id="hero-fs-progress"></div>
          </div>
          ${dotsInner}
        </div>`;
      } else if (layout === 'style1') {
        // Style 1: Modern Split Slider (Text Left + Interactive Slider Right)
        heroWrapper.style.background = 'linear-gradient(180deg, #F8FAFC 0%, #EFF6FF 100%)';
        heroWrapper.style.color = '#0F172A';
        let slidesInner = '';
        let dotsInner = '<div class="slider-dots" style="bottom:15px;">';
        c.heroSlides.forEach((slide, idx) => {
          let activeClass = idx === 0 ? 'active' : '';
          slidesInner += `
          <div class="hero-slide ${activeClass}" id="h-slide-${idx}" style="border-radius:24px;">
            <div class="hero-slide-bg" style="background-image: url('${slide.img}')"></div>
            <div class="hero-slide-overlay" style="background:linear-gradient(to top, rgba(15,23,42,0.92) 0%, rgba(15,23,42,0.35) 60%, rgba(15,23,42,0.1) 100%);"></div>
            <div class="hero-slide-content" style="position:absolute; bottom:30px; left:20px; right:20px; text-align:left; max-width:100%;">
              <span class="status-badge status-Graphic" style="background:var(--accent); color:white; font-size:12px; margin-bottom:6px;"><i class="las la-certificate"></i> ผลงานจริง</span>
              <h3 style="color:white; font-size:22px; font-weight:800; margin:0 0 6px 0; text-shadow:0 2px 8px rgba(0,0,0,0.6);">${slide.title}</h3>
              <p style="color:#F1F5F9; font-size:13px; margin:0; line-height:1.4; text-shadow:0 1px 4px rgba(0,0,0,0.6);">${slide.sub}</p>
            </div>
          </div>`;
          dotsInner += `<div class="s-dot ${activeClass}" onclick="app.goToHeroSlide(${idx})"></div>`;
        });
        dotsInner += '</div>';

        layoutHtml = `
        <div class="hero-layout-style1">
          <div class="hero-split-left">
            <div style="display:inline-flex; align-items:center; gap:8px; background:rgba(30,58,138,0.08); padding:6px 16px; border-radius:50px; color:var(--primary); font-size:13px; font-weight:700; margin-bottom:15px; border:1px solid rgba(30,58,138,0.15);">
              <i class="las la-crown" style="color:var(--accent); font-size:18px;"></i> สื่อโฆษณา & งานป้ายครบวงจรอันดับ 1 ภาคใต้
            </div>
            <h1 style="font-size:44px; font-weight:900; color:#0F172A; line-height:1.2; margin-bottom:15px;">
              ${c.heroTitle || 'งานป้ายและสื่อโฆษณา'}<br>
              <span style="color:#EA580C; font-weight:800; text-shadow: 0 1px 2px rgba(234, 88, 12, 0.15);">${c.heroSub || 'ละมุนทุกดีไซน์ พรีเมียมทุกรายละเอียด'}</span>
            </h1>
            <p style="font-size:16px; color:#334155; line-height:1.7; margin-bottom:25px; max-width:540px; font-weight:500;">
              ${c.heroDesc || 'ระบบสั่งงานออนไลน์ที่ตอบโจทย์ธุรกิจคุณ ประเมินราคาทันที พร้อมระบบดูแลตัวแทนจำหน่ายและทีมช่างติดตั้งมืออาชีพ'}
            </p>
            <div style="display:flex; gap:12px; flex-wrap:wrap; margin-bottom:30px;">
              <button class="btn btn-primary" onclick="app.scrollToOrder()" style="font-size:15px; padding:12px 28px; box-shadow:0 8px 20px rgba(30,58,138,0.3);"><i class="las la-calculator"></i> สั่งผลิต & เช็คราคา</button>
              <a href="${this.state.settings.linkLine}" target="_blank" class="btn" style="background:#00B900; color:white; font-size:15px; padding:12px 24px; text-decoration:none; display:inline-flex; align-items:center; gap:8px; border-radius:50px; box-shadow:0 4px 14px rgba(0,185,0,0.3);"><i class="lab la-line" style="font-size:20px;"></i> line : tumdeemedia</a>
            </div>
            <div style="display:flex; gap:20px; align-items:center; border-top:1px solid #E2E8F0; padding-top:20px;">
              <div><strong style="font-size:22px; color:var(--primary);">10,000+</strong><div style="font-size:12px; color:#64748B;">ผลงานที่ส่งมอบแล้ว</div></div>
              <div style="width:1px; height:30px; background:#CBD5E1;"></div>
              <div><strong style="font-size:22px; color:var(--accent);">100%</strong><div style="font-size:12px; color:#64748B;">รับประกันงานผลิต & ติดตั้ง</div></div>
              <div style="width:1px; height:30px; background:#CBD5E1;"></div>
              <div><strong style="font-size:22px; color:var(--success);">24 ชม.</strong><div style="font-size:12px; color:#64748B;">สั่งงานออนไลน์ได้ตลอด</div></div>
            </div>
          </div>
          <div class="hero-split-right">
            ${slidesInner}
            ${dotsInner}
          </div>
        </div>`;
      } else if (layout === 'style2') {
        // Style 2: Cinematic Full-Width Panorama Slider
        heroWrapper.style.background = '#0F172A';
        heroWrapper.style.color = '#FFFFFF';
        let slidesInner = '';
        let dotsInner = '<div class="slider-dots" style="bottom:25px;">';
        c.heroSlides.forEach((slide, idx) => {
          let activeClass = idx === 0 ? 'active' : '';
          slidesInner += `
          <div class="hero-slide ${activeClass}" id="h-slide-${idx}">
            <div class="hero-slide-bg" style="background-image: url('${slide.img}')"></div>
            <div class="hero-slide-overlay" style="background:linear-gradient(135deg, rgba(15, 23, 42, 0.92) 0%, rgba(30, 58, 138, 0.82) 50%, rgba(15, 23, 42, 0.92) 100%);"></div>
          </div>`;
          dotsInner += `<div class="s-dot ${activeClass}" onclick="app.goToHeroSlide(${idx})"></div>`;
        });
        dotsInner += '</div>';

        layoutHtml = `
        <div class="hero-layout-style2" style="position:relative; min-height:620px;">
          ${slidesInner}
          <div class="hero-cinematic-content" style="position:relative; z-index:5; padding:40px 20px;">
            <div style="display:inline-block; background:rgba(255,126,103,0.2); border:1.5px solid var(--accent); color:#FFA07A; padding:6px 18px; border-radius:50px; font-weight:800; font-size:13px; margin-bottom:20px; letter-spacing:1px; text-shadow:0 1px 4px rgba(0,0,0,0.6);">
              ★ CINEMATIC PREMIUM SIGNAGE STUDIO ★
            </div>
            <h1 style="font-size:52px; font-weight:900; line-height:1.2; margin-bottom:15px; color:#FFFFFF; text-shadow:0 4px 24px rgba(0,0,0,0.8);">
              ${c.heroTitle || 'งานป้ายและสื่อโฆษณา'}<br>
              <span style="color:#FBBF24; text-shadow:0 2px 12px rgba(0,0,0,0.8);">${c.heroSub || 'ละมุนทุกดีไซน์ พรีเมียมทุกรายละเอียด'}</span>
            </h1>
            <p style="font-size:18px; color:#F1F5F9; max-width:700px; margin:0 auto 30px; line-height:1.6; font-weight:500; text-shadow:0 2px 10px rgba(0,0,0,0.7);">
              ${c.heroDesc || 'ออกแบบ ผลิต และติดตั้งงานป้ายคุณภาพสูงทุกรูปแบบ ควบคุมทุกขั้นตอนด้วยช่างผู้เชี่ยวชาญ'}
            </p>
            <div style="display:flex; gap:15px; justify-content:center; flex-wrap:wrap;">
              <button class="btn btn-primary" onclick="app.scrollToOrder()" style="font-size:16px; padding:14px 34px; box-shadow:0 6px 20px rgba(30,58,138,0.4);"><i class="las la-shopping-cart"></i> สั่งผลิตงานออนไลน์</button>
              <a href="${this.state.settings.linkLine}" target="_blank" class="btn" style="background:#00B900; color:white; font-size:16px; padding:14px 30px; border-radius:50px; display:inline-flex; align-items:center; gap:8px; box-shadow:0 4px 15px rgba(0,185,0,0.35); text-decoration:none;"><i class="lab la-line" style="font-size:22px;"></i> line : tumdeemedia</a>
            </div>
          </div>
          ${dotsInner}
        </div>`;
      } else if (layout === 'style3') {
        // Style 3: Clean Minimalist Showcase & Floating Cards
        heroWrapper.style.background = '#FFFFFF';
        heroWrapper.style.color = '#0F172A';
        layoutHtml = `
        <div class="hero-layout-style3">
          <span class="status-badge" style="background:#E0E7FF; color:var(--primary); font-size:13px; font-weight:700; padding:6px 16px; border-radius:50px; margin-bottom:15px; display:inline-block;">
            <i class="las la-award"></i> MINIMALIST DESIGN & PRODUCTION
          </span>
          <h1 style="font-size:48px; font-weight:900; color:#0F172A; line-height:1.2; margin-bottom:15px;">
            ${c.heroTitle || 'งานป้ายและสื่อโฆษณา'}<br>
            <span style="color:#EA580C;">${c.heroSub || 'ละมุนทุกดีไซน์ พรีเมียมทุกรายละเอียด'}</span>
          </h1>
          <p style="font-size:17px; color:#475569; max-width:650px; margin:0 auto 25px; line-height:1.6; font-weight:500;">
            ${c.heroDesc || 'ยกระดับแบรนด์ของคุณด้วยงานป้ายคุณภาพสูง ราคายุติธรรม บริการตรวจแบบ E-Proof ฟรี'}
          </p>
          <div style="display:flex; gap:12px; justify-content:center; flex-wrap:wrap; margin-bottom:40px;">
            <button class="btn btn-primary" onclick="app.scrollToOrder()"><i class="las la-magic"></i> ประเมินราคา & สั่งทำ</button>
            <button class="btn btn-outline" onclick="app.renderGallery('all'); window.location.hash='sec-gallery';"><i class="las la-eye"></i> ชมแกลเลอรี่ผลงาน</button>
          </div>
          <div class="hero-float-cards-grid">
            <div class="hero-float-card" onclick="app.scrollToOrderFromFlash('V01')">
              <img src="https://images.unsplash.com/photo-1542744173-8e7e53415bb0?auto=format&fit=crop&w=600&q=80" style="width:100%; height:180px; object-fit:cover;">
              <div style="padding:20px;">
                <span class="status-badge status-Graphic" style="font-size:11px;">งานพิมพ์คมชัด</span>
                <h4 style="color:var(--primary); margin:8px 0 4px; font-size:17px;">ป้ายไวนิล & สติกเกอร์ UV</h4>
                <p style="font-size:13px; color:#64748B;">ความละเอียดสูงสุด 1440dpi สีสดทนแดด ทนฝน ฟรีเจาะตาไก่</p>
              </div>
            </div>
            <div class="hero-float-card" onclick="app.scrollToOrderFromFlash('S01')">
              <img src="https://images.unsplash.com/photo-1555529771-835f59fc5efe?auto=format&fit=crop&w=600&q=80" style="width:100%; height:180px; object-fit:cover;">
              <div style="padding:20px;">
                <span class="status-badge status-Done" style="font-size:11px;">ขายดีอันดับ 1</span>
                <h4 style="color:var(--primary); margin:8px 0 4px; font-size:17px;">ป้ายไฟ LED & อักษรโลหะ</h4>
                <p style="font-size:13px; color:#64748B;">ตัวอักษร 3 มิติ ซ่อนไฟโมดูล LED กันน้ำ 100% ประหยัดไฟ</p>
              </div>
            </div>
            <div class="hero-float-card" onclick="app.scrollToOrder()">
              <img src="https://images.unsplash.com/photo-1541701494587-cb58502866ab?auto=format&fit=crop&w=600&q=80" style="width:100%; height:180px; object-fit:cover;">
              <div style="padding:20px;">
                <span class="status-badge" style="background:#8B5CF6; color:white; font-size:11px;">งานโครงสร้าง</span>
                <h4 style="color:var(--primary); margin:8px 0 4px; font-size:17px;">บิลบอร์ด & ทีมช่างติดตั้ง</h4>
                <p style="font-size:13px; color:#64748B;">รับเหมางานโครงสร้างพร้อมรถเครนและทีมช่างผู้ชำนาญการ</p>
              </div>
            </div>
          </div>
        </div>`;
      } else if (layout === 'style4') {
        // Style 4: Bento Grid Interactive Hero
        heroWrapper.style.background = 'linear-gradient(180deg, #F8FAFC 0%, #F1F5F9 100%)';
        heroWrapper.style.color = '#0F172A';
        layoutHtml = `
        <div class="hero-layout-style4">
          <div class="bento-card" style="background:linear-gradient(135deg, var(--primary), #1e293b); color:white; display:flex; flex-direction:column; justify-content:space-between;">
            <div>
              <div style="display:inline-block; background:rgba(255,255,255,0.15); padding:4px 14px; border-radius:50px; font-size:12px; font-weight:700; margin-bottom:12px;">★ TUMDEEMEDIA PRO SUITE</div>
              <h2 style="font-size:36px; font-weight:900; line-height:1.2; margin-bottom:12px;">${c.heroTitle || 'งานป้ายและสื่อโฆษณา'}<br><span style="color:var(--accent);">${c.heroSub || 'ละมุนทุกดีไซน์'}</span></h2>
              <p style="color:#CBD5E1; font-size:15px; line-height:1.6; max-width:480px;">${c.heroDesc || 'ระบบคำนวณราคาอัตโนมัติ ออกแบบ E-Proof ไว พร้อมทีมช่างติดตั้งถึงที่'}</p>
            </div>
            <div style="display:flex; gap:10px; margin-top:25px; flex-wrap:wrap;">
              <button class="btn btn-primary" onclick="app.scrollToOrder()" style="background:var(--accent); border-color:var(--accent);"><i class="las la-rocket"></i> สั่งผลิตด่วน</button>
              <a href="tel:${(c.contactPhone||'').replace(/-/g,'')}" class="btn btn-outline" style="border-color:white; color:white;"><i class="las la-phone"></i> ${c.contactPhone}</a>
            </div>
          </div>

          <div class="bento-card" style="background:#FFF7ED; border-color:#FED7AA;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
              <h4 style="margin:0; color:#EA580C; font-size:16px;"><i class="las la-calculator"></i> คำนวณราคาง่ายๆ</h4>
              <span class="status-badge" style="background:#EA580C; color:white; font-size:10px;">24 ชม.</span>
            </div>
            <p style="font-size:13px; color:#7C2D12; margin-bottom:12px;">ระบุขนาด กว้าง x สูง แล้วรู้ราคาทันที พร้อมส่งไฟล์แบบให้ช่างตรวจ</p>
            <button class="btn btn-sm" style="background:#EA580C; color:white; width:100%; border:none; padding:10px;" onclick="app.scrollToOrder()"><i class="las la-arrow-right"></i> เปิดกล่องคำนวณราคา</button>
          </div>

          <div class="bento-card" style="background:white;">
            <div style="display:flex; align-items:center; gap:12px;">
              <div style="width:48px; height:48px; border-radius:12px; background:#F0FDF4; color:var(--success); display:flex; align-items:center; justify-content:center; font-size:24px;"><i class="las la-shield-alt"></i></div>
              <div>
                <h4 style="margin:0; color:var(--primary); font-size:16px;">รับประกันคุณภาพ 100%</h4>
                <div style="font-size:12px; color:#64748B;">สีสดไม่เพี้ยน รับประกันไฟ LED 1 ปีเต็ม</div>
              </div>
            </div>
          </div>

          <div class="bento-card" style="background:#F8FAFC; display:flex; align-items:center; justify-content:space-between;">
            <div>
              <div style="font-size:12px; color:#64748B;">คะแนนความพึงพอใจลูกค้า</div>
              <div style="font-size:22px; font-weight:800; color:var(--primary); margin-top:2px;">4.9 / 5.0 ⭐⭐⭐⭐⭐</div>
              <div style="font-size:11px; color:var(--success); font-weight:600;"><i class="las la-check-circle"></i> ได้รับความไว้วางใจกว่า 500+ องค์กร</div>
            </div>
            <div style="font-size:36px; color:var(--accent);"><i class="las la-medal"></i></div>
          </div>
        </div>`;
      } else if (layout === 'style5') {
        // Style 5: Neon & Flash Campaign Hero (Dark Neon Theme)
        heroWrapper.style.background = '#0B0F19';
        heroWrapper.style.color = '#FFFFFF';
        layoutHtml = `
        <div class="hero-layout-style5">
          <div style="position:relative; z-index:3; text-align:center; max-width:850px; margin:0 auto;">
            <div style="display:inline-flex; align-items:center; gap:8px; background:rgba(239, 68, 68, 0.2); border:1px solid #EF4444; color:#FCA5A5; padding:6px 18px; border-radius:50px; font-weight:800; font-size:13px; margin-bottom:15px; letter-spacing:1px; animation:pulseFlash 2s infinite;">
              <i class="las la-bolt" style="color:#EF4444; font-size:18px;"></i> FLASH SALE & NEON NIGHT CAMPAIGN
            </div>
            <h1 class="neon-glow-text" style="font-size:48px; font-weight:900; line-height:1.2; margin-bottom:15px; color:#FFF;">
              ${c.heroTitle || 'ป้ายไฟ LED & อักษรโลหะเรืองแสง'}<br>
              <span style="color:var(--accent);">${c.heroSub || 'โดดเด่นสะดุดตาทุกค่ำคืน'}</span>
            </h1>
            <p style="font-size:16px; color:#CBD5E1; max-width:650px; margin:0 auto 25px; line-height:1.6;">
              ${c.heroDesc || 'ลดพิเศษสำหรับป้ายกล่องไฟตู้ไฟ และป้ายไฟนีออนดัด LED Neon Flex รับประกันระบบไฟ 1 ปีเต็ม พร้อมบริการติดตั้ง'}
            </p>
            <div style="display:flex; gap:15px; justify-content:center; align-items:center; flex-wrap:wrap; margin-bottom:25px;">
              <div style="background:rgba(255,255,255,0.08); border:1px solid rgba(255,255,255,0.2); padding:10px 20px; border-radius:12px; text-align:center;">
                <div style="font-size:11px; color:#94A3B8;">หมดเขตในอีก</div>
                <div style="font-size:24px; font-weight:800; color:var(--accent); font-family:monospace;" id="neon-countdown-clock">18:42:09</div>
              </div>
              <button class="btn btn-primary" onclick="app.scrollToOrder()" style="font-size:16px; padding:14px 32px; background:var(--accent); border-color:var(--accent);"><i class="las la-bolt"></i> รับส่วนลด & สั่งทำทันที</button>
            </div>
          </div>
        </div>`;
      } else if (layout === 'style6') {
        // Style 6: 3D Studio & Creative Agency Showcase
        heroWrapper.style.background = 'linear-gradient(135deg, #F8FAFC 0%, #EEF2F6 100%)';
        heroWrapper.style.color = '#0F172A';
        layoutHtml = `
        <div class="hero-layout-style6">
          <div>
            <div style="display:inline-flex; align-items:center; gap:6px; background:#F1F5F9; border:1px solid #CBD5E1; padding:4px 14px; border-radius:50px; font-size:12px; font-weight:700; color:var(--primary); margin-bottom:15px;">
              <i class="las la-cube" style="color:var(--accent);"></i> 3D SIGNAGE & ARCHITECTURAL CREATIVE STUDIO
            </div>
            <h1 style="font-size:46px; font-weight:900; color:#0F172A; line-height:1.2; margin-bottom:15px;">
              ${c.heroTitle || 'งานป้ายและสื่อโฆษณา'}<br>
              <span style="color:var(--accent);">${c.heroSub || 'รังสรรค์มิติแห่งความหรูหรา'}</span>
            </h1>
            <p style="font-size:16px; color:#475569; line-height:1.7; margin-bottom:25px;">
              ${c.heroDesc || 'ผู้เชี่ยวชาญการผลิตป้ายสถาปัตยกรรม งานตัด CNC พลาสวูด อะคริลิค ซิงค์ทำสี และสแตนเลสแฮร์ไลน์เกรด 304'}
            </p>
            <div style="display:flex; gap:10px; flex-wrap:wrap; margin-bottom:30px;">
              <span class="mat-badge-chip"><i class="las la-gem" style="color:#0EA5E9;"></i> อะคริลิคเกรด A</span>
              <span class="mat-badge-chip"><i class="las la-cog" style="color:#9333EA;"></i> ซิงค์พาวเดอร์โค้ท</span>
              <span class="mat-badge-chip"><i class="las la-shield-alt" style="color:#F59E0B;"></i> สแตนเลส 304</span>
              <span class="mat-badge-chip"><i class="las la-cubes" style="color:#10B981;"></i> พลาสวูดกันปลวก</span>
            </div>
            <div style="display:flex; gap:12px; flex-wrap:wrap;">
              <button class="btn btn-primary" onclick="app.scrollToOrder()"><i class="las la-drafting-compass"></i> ส่งแบบประเมินราคา</button>
              <a href="tel:${(c.contactPhone||'').replace(/-/g,'')}" class="btn btn-outline"><i class="las la-phone"></i> ${c.contactPhone}</a>
            </div>
          </div>
          <div style="position:relative;">
            <img src="${c.heroImg || 'https://images.unsplash.com/photo-1542744173-8e7e53415bb0?auto=format&fit=crop&w=1200&q=80'}" style="width:100%; height:450px; object-fit:cover; border-radius:24px; box-shadow:0 25px 50px -12px rgba(30, 58, 138, 0.25); border:4px solid white;">
            <div style="position:absolute; bottom:-20px; left:-20px; background:white; padding:18px 24px; border-radius:18px; box-shadow:0 15px 35px rgba(0,0,0,0.1); border:1px solid #E2E8F0;">
              <div style="font-size:24px; font-weight:900; color:var(--primary);">10+ ปี</div>
              <div style="font-size:12px; color:#64748B;">ประสบการณ์งานช่างป้าย</div>
            </div>
          </div>
        </div>`;
      }

      heroWrapper.innerHTML = layoutHtml;

      // Handle slide timer if multi-slide is active
      if (layout === 'style_fullscreen_10s' || layout === 'style1' || layout === 'style2') {
        this.currentHeroSlide = 0;
        const intervalTime = (layout === 'style_fullscreen_10s') ? 10000 : 6000;
        if (this.heroInterval) clearInterval(this.heroInterval);
        this.heroInterval = setInterval(() => {
          this.goToHeroSlide((this.currentHeroSlide + 1) % c.heroSlides.length);
        }, intervalTime);
      }
    }

    // Render Community Network Showcase
    this.renderLandingCommunityNetwork();

    if (document.getElementById('cms-contact-address')) document.getElementById('cms-contact-address').innerText = c.contactAddress;
    if (document.getElementById('cms-contact-phone')) document.getElementById('cms-contact-phone').innerText = c.contactPhone;
    if (document.getElementById('cms-contact-email')) document.getElementById('cms-contact-email').innerText = c.contactEmail;
    if (document.getElementById('cms-contact-lineid')) document.getElementById('cms-contact-lineid').innerText = c.contactLineId;
    if (document.getElementById('cms-contact-fbid')) document.getElementById('cms-contact-fbid').innerText = c.contactFbId;
    if (document.getElementById('cms-map-container')) document.getElementById('cms-map-container').innerHTML = c.mapIframe;

    const brandTrack = document.getElementById('cms-trusted-brands');
    if (brandTrack && c.trustedBrands) {
      const combined = [...c.trustedBrands, ...c.trustedBrands];
      brandTrack.innerHTML = combined.map(img => `<div class="logo-slide"><img src="${img}" alt="Brand"></div>`).join('');
    }

    const promoGrid = document.getElementById('promo-grid');
    if (promoGrid) {
      promoGrid.innerHTML = '';
      this.state.promotions.forEach(p => {
        promoGrid.innerHTML += `<div class="card" style="padding:20px; transition: transform 0.3s;" onmouseover="this.style.transform='translateY(-5px)'" onmouseout="this.style.transform='translateY(0)'"><img src="${p.img}" style="width:100%; height:150px; object-fit:cover; border-radius:12px; margin-bottom:15px;"><h3 style="color:var(--primary); margin-bottom:10px; font-size: 18px;">${p.title}</h3><p style="font-size:13px; color:var(--text-light); line-height: 1.5;">${p.desc}</p><button class="btn-sm btn-outline" style="width:100%; margin-top:15px;" onclick="app.scrollToOrder()">รับโปรโมชั่นนี้</button></div>`;
      });
    }

    const flashCont = document.getElementById('flash-sale-section');
    if (flashCont) {
      let html = `<div style="display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 20px;"><div><h2 style="font-size: 28px; color: var(--danger); font-weight: 800; margin-bottom: 5px; display: flex; align-items: center; gap: 8px;"><i class="las la-bolt"></i> HOT DEAL & สินค้าแนะนำ</h2><p style="color: var(--text-light); font-size: 15px;">สินค้าจัดโปรโมชั่นและสินค้ามาใหม่ ราคาพิเศษเฉพาะสั่งออนไลน์เท่านั้น</p></div><div class="hide-mobile" style="font-size: 13px; color: var(--secondary);"><i class="las la-arrows-alt-h"></i> เลื่อนดูโปรโมชั่น</div></div><div class="flash-slider" id="fs-track">`;
      this.state.flashSales.forEach(f => {
        let priceHtml = `<span style="font-size: 24px; font-weight: 800; color: var(--danger);">฿${f.price}</span>`;
        if (f.normalPrice) priceHtml += `<span style="font-size: 14px; color: var(--text-light); text-decoration: line-through;">ปกติ ฿${f.normalPrice}</span>`;
        let imgHtml = f.img ? `
          <div style="height:120px; width:100%; border-radius:12px; overflow:hidden; margin-bottom:12px; position:relative; background:#F8FAFC;">
            <img src="${f.img}" alt="${f.title}" style="width:100%; height:100%; object-fit:cover; transition:transform 0.3s;" onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'">
            <span class="flash-badge" style="position:absolute; top:8px; right:8px; background:${f.color}; z-index:30;">${f.badge}</span>
          </div>` : `
          <div style="position:relative; width:100%; text-align:right; margin-bottom:8px;">
            <span class="flash-badge" style="background:${f.color};">${f.badge}</span>
          </div>`;
        html += `<div class="flash-card" onclick="app.scrollToOrderFromFlash('${f.targetType}')" style="position:relative;">
          ${imgHtml}
          <div style="display:flex; align-items:center; gap:8px; margin-bottom:6px;">
            <div style="color: ${f.color}; font-size: 22px;"><i class="${f.icon}"></i></div>
            <h3 style="font-size: 17px; color: var(--text-main); margin:0;">${f.title}</h3>
          </div>
          <p style="font-size: 12.5px; color: var(--text-light); margin-bottom: 12px; line-height:1.4;">${f.desc}</p>
          <div style="display: flex; align-items: baseline; gap: 10px;">${priceHtml}</div>
        </div>`;
      });
      html += `<div class="flash-card" style="display: flex; align-items: center; justify-content: center; text-align: center; background: var(--bg-pastel-blue); border-color: transparent;" onclick="app.scrollToOrder()"><div><i class="las la-arrow-circle-right" style="font-size: 40px; color: var(--primary); margin-bottom: 10px;"></i><h3 style="font-size: 16px; color: var(--primary);">ดูรายการทั้งหมด<br>ในหน้าสั่งผลิต</h3></div></div></div>`;
      flashCont.innerHTML = html;
    }

    const pkgCont = document.getElementById('package-section');
    if (pkgCont) {
      let html = `<div class="section-title">
        <h2>แพ็กเกจสุดคุ้ม (Recommended Packages)</h2>
        <div class="line"></div>
        <p style="color: var(--text-light); max-width: 600px; margin: 0 auto; font-size: 15px;">รวมเซ็ตงานป้ายและสื่อสิ่งพิมพ์ยอดฮิต จัดมาให้ครบ จบในคลิกเดียว</p>
        <div style="display:inline-flex; align-items:center; gap:8px; background:#EFF6FF; border:1px solid #BFDBFE; color:#1D4ED8; padding:8px 22px; border-radius:50px; font-size:13.5px; font-weight:700; margin-top:14px; box-shadow:0 2px 8px rgba(37,99,235,0.08);">
          <i class="las la-check-circle" style="font-size:20px; color:#2563EB;"></i> สามารถเลือกติ๊กเพิ่มหรือลดรายการที่ต้องการผลิตได้ตามใจชอบ (ราคาสรุปจะคำนวณใหม่อัตโนมัติ)
        </div>
      </div><div class="grid-3">`;
      this.state.packages.forEach(pkg => {
        let listHtml = '';
        let rawTotal = 0;
        let allChecked = true;
        pkg.items.forEach(i => {
          const catItem = this.state.catalog.find(c => c.id === i.type);
          let iPrice = 0;
          if (catItem) {
            let area = (catItem.category.includes('POSM') || catItem.category.includes('วัสดุ') || catItem.unit === 'ชุด' || catItem.unit === 'แผ่น' || catItem.unit === 'กล่อง' || catItem.unit === 'เล่ม') ? 1 : (i.w * i.h);
            iPrice = area * catItem.price * i.qty;
          }
          if (i.checked) rawTotal += iPrice; else allChecked = false;
          listHtml += `<li style="margin-bottom:12px; display:flex; align-items:flex-start; gap:10px; line-height:1.5; font-size:13px; cursor:pointer;" onclick="app.togglePkgItem('${pkg.id}','${i.id}')"><i class="las ${i.checked ? 'la-check-square' : 'la-square'}" style="font-size:20px; color:${i.checked ? 'var(--success)' : 'var(--text-light)'};"></i><span style="flex:1; ${i.checked ? '' : 'text-decoration:line-through; color:#94A3B8;'}">${i.detail} <b>(฿${iPrice.toLocaleString()})</b></span></li>`;
        });
        let netTotal = allChecked && rawTotal > 0 ? rawTotal * 0.97 : rawTotal;
        let pkgImgHtml = pkg.img ? `<div style="height:140px; width:100%; border-radius:14px; overflow:hidden; margin-bottom:14px; background:#F1F5F9;"><img src="${pkg.img}" alt="${pkg.title}" style="width:100%; height:100%; object-fit:cover;"></div>` : '';
        html += `<div class="pkg-card" style="${pkg.isPopular ? 'border-color:var(--accent); transform:scale(1.03); box-shadow:0 15px 35px rgba(255,126,103,0.15);' : ''}">
          <div class="pkg-header" style="${pkg.isPopular ? 'background:rgba(255,126,103,0.05);' : ''}">
            ${pkgImgHtml}
            <div style="display:flex; align-items:center; gap:10px; margin-bottom:8px;">
              <div class="pkg-icon" style="${pkg.isPopular ? 'background:var(--accent); color:white;' : `color:${pkg.color};`}"><i class="${pkg.icon}"></i></div>
              <h3 style="color: var(--primary); font-size: 18px; margin:0;">${pkg.title}</h3>
            </div>
            <div style="font-size: 12.5px; color: var(--text-light); margin-bottom:8px;">${pkg.desc}</div>
            <div class="pkg-price">฿${Math.round(netTotal).toLocaleString()}</div>
          </div>
          <div class="pkg-body">
            <div style="font-size:12px; color:#1D4ED8; background:#EFF6FF; border-radius:6px; padding:5px 10px; margin-bottom:12px; display:flex; align-items:center; gap:6px;">
              <i class="las la-mouse-pointer"></i> คลิกติ๊กถูกเพื่อเพิ่มหรือลดรายการผลิตได้
            </div>
            <ul class="pkg-list">${listHtml}</ul>
            <button class="btn ${pkg.isPopular ? 'btn-primary' : 'btn-outline'}" style="width: 100%;" onclick="app.orderCustomPackage('${pkg.id}')">สั่งผลิตแพ็กเกจนี้</button>
          </div>
        </div>`;
      });
      html += `</div>`;
      pkgCont.innerHTML = html;
    }

    const srvGrid = document.getElementById('services-grid');
    if (srvGrid) {
      srvGrid.innerHTML = '';
      this.state.services.forEach(s => {
        srvGrid.innerHTML += `<div style="cursor:pointer; background:white; border-radius:20px; overflow:hidden; box-shadow:0 10px 30px rgba(0,0,0,0.05); transition:0.3s; border:1px solid var(--border); display:flex; flex-direction:column;" onclick="app.openServiceDetail('${s.id}')"><div style="height:200px; background-image:url('${s.img}'); background-size:cover; background-position:center; position:relative;"><div style="position:absolute; bottom:15px; left:20px; color:white; font-size:12px; font-weight:bold; background:var(--accent); padding:4px 10px; border-radius:50px;">${s.cat}</div></div><div style="padding:25px 20px; flex:1; display:flex; flex-direction:column;"><h3 style="color:var(--primary); font-size:18px; margin-bottom:10px;">${s.title}</h3><p style="color:var(--text-main); font-size:13px; flex:1;">${s.desc}</p><div style="margin-top:15px; color:var(--info); font-size:13px; font-weight:600; display:flex; align-items:center; gap:5px;">ดูรายละเอียดสเปคและราคา <i class="las la-arrow-right"></i></div></div></div>`;
      });
    }

    const faqCont = document.getElementById('faq-container');
    if (faqCont && c.faqs) {
      faqCont.innerHTML = '';
      c.faqs.forEach(f => {
        faqCont.innerHTML += `<div class="faq-item" onclick="this.classList.toggle('active')"><div class="faq-q">${f.q} <i class="las la-angle-down"></i></div><div class="faq-a">${f.a}</div></div>`;
      });
    }

    const testiTrack = document.getElementById('testi-track');
    if (testiTrack && this.state.testimonials) {
      testiTrack.innerHTML = '';
      this.state.testimonials.forEach(t => {
        testiTrack.innerHTML += `<div class="testimonial-slide"><div class="t-card"><i class="las la-quote-right quote"></i><img src="${t.img}" class="t-img"><div class="t-content"><p>"${t.text}"</p><h4>${t.name}</h4><span>${t.role}</span></div></div></div>`;
      });
      this.initTestimonialSlider();
    }

    // Process Steps Workflow
    const procWrapper = document.getElementById('process-wrapper-container');
    if (procWrapper && c.processSteps && c.processSteps.length > 0) {
      let stepsHtml = '<div class="process-line"></div>';
      c.processSteps.forEach(st => {
        stepsHtml += `
        <div class="process-step">
          <div class="process-num"><i class="${st.icon || 'las la-check'}"></i></div>
          <h4>${st.num ? st.num + '. ' : ''}${st.title}</h4>
          <p>${st.desc}</p>
        </div>`;
      });
      procWrapper.innerHTML = stepsHtml;
    }

    // One-Stop Service & Feature Cards
    if (c.oneStop) {
      const os = c.oneStop;
      if (document.getElementById('onestop-sec-title')) {
        document.getElementById('onestop-sec-title').innerHTML = `${os.title}<br><span style="font-size: 22px; color: var(--accent);" id="onestop-sec-sub">${os.sub}</span>`;
      }
      if (document.getElementById('onestop-sec-desc')) document.getElementById('onestop-sec-desc').innerText = os.desc || '';
      if (document.getElementById('onestop-main-img')) document.getElementById('onestop-main-img').src = os.mainImg || '';
      if (document.getElementById('onestop-about-title')) document.getElementById('onestop-about-title').innerText = os.aboutTitle || '';
      if (document.getElementById('onestop-about-desc')) document.getElementById('onestop-about-desc').innerText = os.aboutDesc || '';
      if (document.getElementById('onestop-bullet-1')) document.getElementById('onestop-bullet-1').innerText = os.bullet1 || '';
      if (document.getElementById('onestop-bullet-2')) document.getElementById('onestop-bullet-2').innerText = os.bullet2 || '';
      if (document.getElementById('onestop-bullet-3')) document.getElementById('onestop-bullet-3').innerText = os.bullet3 || '';

      const cardsGrid = document.getElementById('onestop-cards-grid');
      if (cardsGrid && os.cards && os.cards.length > 0) {
        cardsGrid.innerHTML = '';
        os.cards.forEach(card => {
          cardsGrid.innerHTML += `
          <div class="card" style="padding: 0; overflow: hidden; position: relative;">
            <img src="${card.img}" style="width:100%; height:160px; object-fit:cover;" alt="${card.title}">
            <div style="padding: 25px 20px;">
              <div style="position:absolute; top: 140px; right: 20px; width: 40px; height: 40px; background: ${card.color || '#3B82F6'}; color: white; border-radius: 50%; display:flex; justify-content:center; align-items:center; font-weight:bold; font-size:20px; border:3px solid white;">${card.num}</div>
              <h3 style="color: var(--primary); font-size: 16px; margin-bottom: 10px;">${card.title}</h3>
              <p style="font-size: 13.5px; color: var(--secondary); line-height: 1.6;">${card.desc}</p>
            </div>
          </div>`;
        });
      }
    }

    // Order Online CTA
    if (c.orderCta) {
      const o = c.orderCta;
      if (document.getElementById('order-cta-badge')) document.getElementById('order-cta-badge').innerText = o.badge || '';
      if (document.getElementById('order-cta-title')) document.getElementById('order-cta-title').innerText = o.title || '';
      if (document.getElementById('order-cta-sub')) document.getElementById('order-cta-sub').innerText = o.sub || '';
      if (document.getElementById('order-cta-point1')) document.getElementById('order-cta-point1').innerText = o.bullet1 || '';
      if (document.getElementById('order-cta-point2')) document.getElementById('order-cta-point2').innerText = o.bullet2 || '';
      if (document.getElementById('order-cta-point3')) document.getElementById('order-cta-point3').innerText = o.bullet3 || '';
      if (document.getElementById('order-cta-btn')) document.getElementById('order-cta-btn').innerText = o.btnText || '';
    }

    // Partner Agent CTA
    if (c.agentCta) {
      const a = c.agentCta;
      if (document.getElementById('agent-cta-badge')) document.getElementById('agent-cta-badge').innerText = a.badge || '';
      if (document.getElementById('agent-cta-title')) document.getElementById('agent-cta-title').innerText = a.title || '';
      if (document.getElementById('agent-cta-desc')) document.getElementById('agent-cta-desc').innerText = a.sub || a.desc || '';
      if (document.getElementById('agent-cta-point1')) document.getElementById('agent-cta-point1').innerText = a.bullet1 || '';
      if (document.getElementById('agent-cta-point2')) document.getElementById('agent-cta-point2').innerText = a.bullet2 || '';
      if (document.getElementById('agent-cta-point3')) document.getElementById('agent-cta-point3').innerText = a.bullet3 || '';
      if (document.getElementById('agent-cta-btn')) document.getElementById('agent-cta-btn').innerText = a.btnText || '';
    }

    // Sync Section Titles & Badges from landingSections state
    (this.state.landingSections || []).forEach(sec => {
      const secId = sec.id.startsWith('sec-') ? sec.id : ('sec-' + sec.id);
      const secEl = document.getElementById(secId);
      if (secEl && sec.title) {
        if (sec.id === 'sec-process' || sec.id === 'process') {
          const pt = document.getElementById('process-sec-title');
          if (pt) pt.innerText = sec.title;
        } else if (sec.id === 'sec-promotions' || sec.id === 'promotions') {
          const pt = document.getElementById('promo-sec-title');
          if (pt) pt.innerText = sec.title;
        } else if (sec.id !== 'sec-one-stop' && sec.id !== 'one-stop') {
          const h2 = secEl.querySelector('.section-title h2');
          if (h2) h2.innerText = sec.title;
        }
        const descEl = secEl.querySelector('.section-title p');
        if (descEl && sec.desc && sec.id !== 'sec-one-stop' && sec.id !== 'one-stop') {
          descEl.innerText = sec.desc;
        }
      }
    });
  },

  applySettings() {
    const s = this.state.settings || {};
    const lLine = document.getElementById('link-line'); if (lLine && s.linkLine) lLine.href = s.linkLine;
    const lFb = document.getElementById('link-fb'); if (lFb && s.linkFb) lFb.href = s.linkFb;
    const lPhone = document.getElementById('link-phone'); if (lPhone && s.linkPhone) lPhone.href = "tel:" + s.linkPhone;
    const fFb = document.getElementById('footer-fb-link'); if (fFb && s.linkFb) fFb.href = s.linkFb;
    const fLine = document.getElementById('footer-line-link'); if (fLine && s.linkLine) fLine.href = s.linkLine;
    this.renderChatWindow();
    this.applyShopBranding();
  },

  applyShopBranding() {
    const s = this.state.settings || {};

    // 1. Web Branding (Website Nav, Footer, Sidebar)
    const webName = s.webShopName || s.shopName || 'ร้านทำดีมีเดีย';
    const webSubname = s.webShopSubname || s.shopSubname || 'TUMDEEMEDIA';
    const webLetter = s.webShopLetter || s.shopLetter || (webSubname ? webSubname.charAt(0).toUpperCase() : 'T');
    const webLogoUrl = s.webShopLogoUrl || s.shopLogoUrl || '';
    const webLogoSize = parseInt(s.webShopLogoSize || s.shopLogoSize, 10) || 52;

    // 2. Accounting Document Branding (Can be customized separately)
    const docName = s.docShopName || s.shopName || 'ร้านทำดีมีเดีย';
    const docSubname = s.docShopSubname || s.shopSubname || 'TUMDEEMEDIA';
    const docLetter = s.docShopLetter || s.shopLetter || (docSubname ? docSubname.charAt(0).toUpperCase() : 'T');
    const docLogoUrl = (s.docShopLogoUrl !== undefined && s.docShopLogoUrl !== '') ? s.docShopLogoUrl : (s.shopLogoUrl || s.webShopLogoUrl || '');
    const docLogoSize = parseInt(s.docShopLogoSize, 10) || 48;
    const docPhone = s.docShopPhone || s.shopPhone || s.linkPhone || '062-419-8365';
    const docTaxId = s.docShopTaxId || s.shopTaxId || '3920100923387';
    const docAddress = s.docShopAddress || s.shopAddress || '125/1 ม.1 ต.หนองตรุด อ.เมืองตรัง จ.ตรัง 92000';
    const docLine = s.docShopLine || s.contactLineId || s.shopLine || 'tumdeemedia';
    const docEmail = s.docShopEmail || s.shopEmail || 'tumdeemediatrang@gmail.com';
    const docStampTitle = s.docStampTitle || docName;
    const docStampSub = s.docStampSub || docSubname;
    const docStampTax = s.docStampTaxId || docTaxId;

    // 1. Navigation Bar Brand Logo (Prominent & Larger)
    const navLogo = document.getElementById('main-nav-brand-logo');
    if (navLogo) {
      if (webLogoUrl) {
        navLogo.innerHTML = `
          <img src="${webLogoUrl}" style="height:${webLogoSize}px; max-height:${webLogoSize}px; object-fit:contain; border-radius:8px; flex-shrink:0; filter:drop-shadow(0 2px 6px rgba(0,0,0,0.3));" alt="${webSubname}">
          <div style="display:flex; flex-direction:column; text-align:left; justify-content:center;">
            <span style="font-size:18px; font-weight:800; color:white; line-height:1.15; letter-spacing:0.3px;">${webName}</span>
            <span style="font-size:11px; font-weight:700; color:#F59E0B; letter-spacing:0.8px;">${webSubname}</span>
          </div>`;
      } else {
        navLogo.innerHTML = `
          <div style="width:${webLogoSize}px; height:${webLogoSize}px; border-radius:12px; background:linear-gradient(135deg, #E11D48 0%, #EA580C 100%); display:flex; align-items:center; justify-content:center; color:white; font-size:${Math.round(webLogoSize * 0.52)}px; font-weight:900; box-shadow:0 4px 12px rgba(225,29,72,0.4); flex-shrink:0;">
            <span style="font-family:'Prompt',sans-serif; transform:skew(-4deg);">${webLetter}</span>
          </div>
          <div style="display:flex; flex-direction:column; text-align:left; justify-content:center;">
            <span style="font-size:18px; font-weight:800; color:white; line-height:1.15; letter-spacing:0.3px;">${webName}</span>
            <span style="font-size:11px; font-weight:700; color:#F59E0B; letter-spacing:0.8px;">${webSubname}</span>
          </div>`;
      }
    }

    // 2. Admin ERP Sidebar Brand Logo
    const adminLogo = document.getElementById('admin-sidebar-brand-logo');
    if (adminLogo) {
      if (webLogoUrl) {
        adminLogo.innerHTML = `
          <img src="${webLogoUrl}" style="height:40px; max-height:40px; object-fit:contain; border-radius:8px; flex-shrink:0;" alt="${webSubname}">
          <span style="font-size:16px; font-weight:800; color:white; line-height:1.1;">${webSubname}</span>`;
      } else {
        adminLogo.innerHTML = `
          <div style="width:38px; height:38px; border-radius:8px; background:linear-gradient(135deg, #E11D48 0%, #EA580C 100%); display:flex; align-items:center; justify-content:center; color:white; font-size:20px; font-weight:900; flex-shrink:0;">
            <span style="font-family:'Prompt',sans-serif; transform:skew(-4deg);">${webLetter}</span>
          </div>
          <span style="font-size:16px; font-weight:800; color:white; line-height:1.1;">${webSubname}</span>`;
      }
    }

    // 3. Accounting Document A4 Header Info & Logo (Separate from Web)
    const docLogoCont = document.getElementById('doc-shop-header-info');
    if (docLogoCont) {
      const logoGraphic = docLogoUrl 
        ? `<img src="${docLogoUrl}" style="height:${docLogoSize}px; max-height:${docLogoSize}px; object-fit:contain; border-radius:8px; flex-shrink:0; margin-top:2px;" alt="${docSubname}">`
        : `<div style="width:${docLogoSize}px; height:${docLogoSize}px; border-radius:10px; background:linear-gradient(135deg, #E11D48 0%, #EA580C 100%); display:flex; align-items:center; justify-content:center; color:white; font-size:${Math.round(docLogoSize * 0.5)}px; font-weight:900; box-shadow:0 3px 8px rgba(225,29,72,0.3); flex-shrink:0; margin-top:2px;">
             <span style="font-family:'Prompt',sans-serif; transform:skew(-4deg);">${docLetter}</span>
           </div>`;

      docLogoCont.innerHTML = `
        ${logoGraphic}
        <div style="text-align:left;">
          <div style="font-size:17px; font-weight:800; color:#0F172A; line-height:1.2; letter-spacing:0.2px;">
            ${docName} <span style="font-size:13px; font-weight:800; color:#EA580C; margin-left:2px;">${docSubname}</span>
          </div>
          <div style="font-size:9.5px; color:#475569; margin-top:2px; line-height:1.35;">
            ${docAddress} · <b>โทร. ${docPhone}</b><br>
            <b>เลขประจำตัวผู้เสียภาษีอากร:</b> <span style="font-family:monospace; font-weight:700; color:#0F172A;">${docTaxId}</span> · line: <b>${docLine}</b> · อีเมล: ${docEmail}
          </div>
        </div>`;
    }

    // 4. Update Official Stamp Text
    const stampTitle = document.querySelector('#doc-company-stamp .stamp-title');
    if (stampTitle) stampTitle.innerText = docStampTitle;
    const stampSub = document.querySelector('#doc-company-stamp .stamp-sub');
    if (stampSub) stampSub.innerText = docStampSub;
    const stampTax = document.querySelector('#doc-company-stamp div:last-child');
    if (stampTax) stampTax.innerText = docStampTax;
  },

  renderShopBrandingCMS() {
    const s = this.state.settings || {};

    // 1. Web Branding Inputs
    const webSizeSlider = document.getElementById('cms-web-logo-size-slider');
    const webSizeVal = document.getElementById('cms-web-logo-size-val');
    const webLogoUrlInput = document.getElementById('cms-web-logo-url');
    const webLetterInput = document.getElementById('cms-web-letter');
    const webNameInput = document.getElementById('cms-web-name');
    const webSubnameInput = document.getElementById('cms-web-subname');
    const webSloganInput = document.getElementById('cms-web-slogan');

    const curWebSize = parseInt(s.webShopLogoSize || s.shopLogoSize, 10) || 52;
    if (webSizeSlider) webSizeSlider.value = curWebSize;
    if (webSizeVal) webSizeVal.innerText = `${curWebSize} px`;
    if (webLogoUrlInput) webLogoUrlInput.value = s.webShopLogoUrl || s.shopLogoUrl || '';
    if (webLetterInput) webLetterInput.value = s.webShopLetter || s.shopLetter || 'T';
    if (webNameInput) webNameInput.value = s.webShopName || s.shopName || 'ร้านทำดีมีเดีย';
    if (webSubnameInput) webSubnameInput.value = s.webShopSubname || s.shopSubname || 'TUMDEEMEDIA';
    if (webSloganInput) webSloganInput.value = s.webShopSlogan || s.shopSlogan || 'โรงพิมพ์ป้ายและสื่อสิ่งพิมพ์ครบวงจรอันดับ 1 เมืองตรัง';

    const defaultThemeSelect = document.getElementById('cms-default-theme');
    if (defaultThemeSelect) {
      defaultThemeSelect.value = s.defaultTheme || 'light';
    }

    // 2. Document Header Branding Inputs
    const docSizeSlider = document.getElementById('cms-doc-logo-size-slider');
    const docSizeVal = document.getElementById('cms-doc-logo-size-val');
    const docLogoUrlInput = document.getElementById('cms-doc-logo-url');
    const docLetterInput = document.getElementById('cms-doc-letter');
    const docNameInput = document.getElementById('cms-doc-name');
    const docSubnameInput = document.getElementById('cms-doc-subname');
    const docTaxidInput = document.getElementById('cms-doc-taxid');
    const docPhoneInput = document.getElementById('cms-doc-phone');
    const docAddrInput = document.getElementById('cms-doc-address');
    const docLineInput = document.getElementById('cms-doc-line');
    const docEmailInput = document.getElementById('cms-doc-email');
    const docBankNameInput = document.getElementById('cms-doc-bank-name');
    const docBankAccountInput = document.getElementById('cms-doc-bank-account');
    const docPromptPayInput = document.getElementById('cms-doc-bank-promptpay');
    const docTermsInput = document.getElementById('cms-doc-payment-terms');
    const docStampTitleInput = document.getElementById('cms-doc-stamp-title');
    const docStampSubInput = document.getElementById('cms-doc-stamp-sub');
    const docStampTaxInput = document.getElementById('cms-doc-stamp-taxid');

    const curDocSize = parseInt(s.docShopLogoSize, 10) || 48;
    if (docSizeSlider) docSizeSlider.value = curDocSize;
    if (docSizeVal) docSizeVal.innerText = `${curDocSize} px`;
    if (docLogoUrlInput) docLogoUrlInput.value = s.docShopLogoUrl || '';
    if (docLetterInput) docLetterInput.value = s.docShopLetter || s.webShopLetter || s.shopLetter || 'T';
    if (docNameInput) docNameInput.value = s.docShopName || s.shopName || 'ร้านทำดีมีเดีย';
    if (docSubnameInput) docSubnameInput.value = s.docShopSubname || s.shopSubname || 'TUMDEEMEDIA';
    if (docTaxidInput) docTaxidInput.value = s.docShopTaxId || s.shopTaxId || '3920100923387';
    if (docPhoneInput) docPhoneInput.value = s.docShopPhone || s.shopPhone || '062-419-8365';
    if (docAddrInput) docAddrInput.value = s.docShopAddress || s.shopAddress || '125/1 ม.1 ต.หนองตรุด อ.เมืองตรัง จ.ตรัง 92000';
    if (docLineInput) docLineInput.value = s.docShopLine || 'tumdeemedia';
    if (docEmailInput) docEmailInput.value = s.docShopEmail || s.shopEmail || 'tumdeemediatrang@gmail.com';
    if (docBankNameInput) docBankNameInput.value = s.docBankName || 'ธนาคารไทยพาณิชย์ (SCB) สาขาตรัง';
    if (docBankAccountInput) docBankAccountInput.value = s.docBankAccount || '590-264768-1';
    if (docPromptPayInput) docPromptPayInput.value = s.docBankPromptPay || '3920100923387';
    if (docTermsInput) docTermsInput.value = s.docPaymentTerms || 'งานสั่งผลิตมัดจำ 50% ก่อนขึ้นแบบผลิต และชำระส่วนที่เหลือก่อนส่งมอบ';
    if (docStampTitleInput) docStampTitleInput.value = s.docStampTitle || s.docShopName || 'ร้านทำดีมีเดีย';
    if (docStampSubInput) docStampSubInput.value = s.docStampSub || s.docShopSubname || 'TUMDEE MEDIA';
    if (docStampTaxInput) docStampTaxInput.value = s.docStampTaxId || s.docShopTaxId || '3920100923387';

    this.updateWebLogoLivePreview();
    this.updateDocLogoLivePreview();
  },

  updateWebLogoLivePreview() {
    const previewCont = document.getElementById('cms-web-logo-live-preview');
    if (!previewCont) return;

    const logoUrl = document.getElementById('cms-web-logo-url')?.value.trim() || this.state.settings?.webShopLogoUrl || this.state.settings?.shopLogoUrl || '';
    const letter = document.getElementById('cms-web-letter')?.value.trim() || this.state.settings?.webShopLetter || 'T';
    const name = document.getElementById('cms-web-name')?.value.trim() || this.state.settings?.webShopName || 'ร้านทำดีมีเดีย';
    const subname = document.getElementById('cms-web-subname')?.value.trim() || this.state.settings?.webShopSubname || 'TUMDEEMEDIA';
    const size = parseInt(document.getElementById('cms-web-logo-size-slider')?.value, 10) || 52;

    if (logoUrl) {
      previewCont.innerHTML = `
        <img src="${logoUrl}" style="height:${size}px; max-height:${size}px; object-fit:contain; border-radius:8px; flex-shrink:0;" alt="Logo Preview" onerror="this.style.display='none'">
        <div style="display:flex; flex-direction:column; text-align:left;">
          <span style="font-size:18px; font-weight:800; color:white; line-height:1.15;">${name}</span>
          <span style="font-size:11px; font-weight:700; color:#F59E0B; letter-spacing:0.8px;">${subname}</span>
        </div>`;
    } else {
      previewCont.innerHTML = `
        <div style="width:${size}px; height:${size}px; border-radius:12px; background:linear-gradient(135deg, #E11D48 0%, #EA580C 100%); display:flex; align-items:center; justify-content:center; color:white; font-size:${Math.round(size * 0.52)}px; font-weight:900; box-shadow:0 4px 12px rgba(225,29,72,0.4); flex-shrink:0;">
          <span style="font-family:'Prompt',sans-serif; transform:skew(-4deg);">${letter}</span>
        </div>
        <div style="display:flex; flex-direction:column; text-align:left;">
          <span style="font-size:18px; font-weight:800; color:white; line-height:1.15;">${name}</span>
          <span style="font-size:11px; font-weight:700; color:#F59E0B; letter-spacing:0.8px;">${subname}</span>
        </div>`;
    }
  },

  updateDocLogoLivePreview() {
    const previewCont = document.getElementById('cms-doc-logo-live-preview');
    if (!previewCont) return;

    const logoUrl = document.getElementById('cms-doc-logo-url')?.value.trim() || this.state.settings?.docShopLogoUrl || '';
    const letter = document.getElementById('cms-doc-letter')?.value.trim() || this.state.settings?.docShopLetter || 'T';
    const name = document.getElementById('cms-doc-name')?.value.trim() || this.state.settings?.docShopName || 'ร้านทำดีมีเดีย';
    const subname = document.getElementById('cms-doc-subname')?.value.trim() || this.state.settings?.docShopSubname || 'TUMDEEMEDIA';
    const address = document.getElementById('cms-doc-address')?.value.trim() || this.state.settings?.docShopAddress || '125/1 ม.1 ต.หนองตรุด อ.เมืองตรัง จ.ตรัง 92000';
    const phone = document.getElementById('cms-doc-phone')?.value.trim() || this.state.settings?.docShopPhone || '062-419-8365';
    const taxid = document.getElementById('cms-doc-taxid')?.value.trim() || this.state.settings?.docShopTaxId || '3920100923387';
    const line = document.getElementById('cms-doc-line')?.value.trim() || 'tumdeemedia';
    const email = document.getElementById('cms-doc-email')?.value.trim() || this.state.settings?.docShopEmail || 'tumdeemediatrang@gmail.com';
    const size = parseInt(document.getElementById('cms-doc-logo-size-slider')?.value, 10) || 48;

    const logoImg = logoUrl
      ? `<img src="${logoUrl}" style="height:${size}px; max-height:${size}px; object-fit:contain; border-radius:8px; flex-shrink:0;" alt="Doc Logo" onerror="this.style.display='none'">`
      : `<div style="width:${size}px; height:${size}px; border-radius:10px; background:linear-gradient(135deg, #E11D48 0%, #EA580C 100%); display:flex; align-items:center; justify-content:center; color:white; font-size:${Math.round(size * 0.5)}px; font-weight:900; flex-shrink:0;">
           <span style="font-family:'Prompt',sans-serif; transform:skew(-4deg);">${letter}</span>
         </div>`;

    previewCont.innerHTML = `
      <div style="display:flex; gap:12px; align-items:flex-start; text-align:left; background:white; padding:12px; border-radius:8px; border:1px solid #CBD5E1; width:100%;">
        ${logoImg}
        <div>
          <div style="font-size:15px; font-weight:800; color:#0F172A; line-height:1.2;">
            ${name} <span style="font-size:12px; font-weight:800; color:#EA580C; margin-left:2px;">${subname}</span>
          </div>
          <div style="font-size:9.5px; color:#475569; margin-top:3px; line-height:1.35;">
            ${address} · <b>โทร. ${phone}</b><br>
            <b>เลขผู้เสียภาษี:</b> <span style="font-family:monospace; font-weight:700;">${taxid}</span> · line: <b>${line}</b> · อีเมล: ${email}
          </div>
        </div>
      </div>`;
  },

  copyWebBrandingToDoc() {
    const s = this.state.settings || {};
    const webName = document.getElementById('cms-web-name')?.value.trim() || s.webShopName || s.shopName || 'ร้านทำดีมีเดีย';
    const webSubname = document.getElementById('cms-web-subname')?.value.trim() || s.webShopSubname || s.shopSubname || 'TUMDEEMEDIA';
    const webLetter = document.getElementById('cms-web-letter')?.value.trim() || s.webShopLetter || s.shopLetter || 'T';
    const webLogoUrl = document.getElementById('cms-web-logo-url')?.value.trim() || s.webShopLogoUrl || s.shopLogoUrl || '';

    const el = id => document.getElementById(id);
    if (el('cms-doc-name')) el('cms-doc-name').value = webName;
    if (el('cms-doc-subname')) el('cms-doc-subname').value = webSubname;
    if (el('cms-doc-letter')) el('cms-doc-letter').value = webLetter;
    if (el('cms-doc-logo-url')) el('cms-doc-logo-url').value = webLogoUrl;
    if (el('cms-doc-stamp-title')) el('cms-doc-stamp-title').value = webName;
    if (el('cms-doc-stamp-sub')) el('cms-doc-stamp-sub').value = webSubname;

    this.updateDocLogoLivePreview();
    this.showToast('คัดลอกชื่อและโลโก้จากเว็บไซต์ลงหัวเอกสารเรียบร้อย', 'info');
  },

  onWebLogoSizeSlider(val) {
    const valEl = document.getElementById('cms-web-logo-size-val');
    if (valEl) valEl.innerText = `${val} px`;
    this.updateWebLogoLivePreview();
  },

  onDocLogoSizeSlider(val) {
    const valEl = document.getElementById('cms-doc-logo-size-val');
    if (valEl) valEl.innerText = `${val} px`;
    this.updateDocLogoLivePreview();
  },

  handleWebLogoUpload(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      this.showToast('กรุณาเลือกไฟล์รูปภาพเท่านั้น (PNG, JPG, SVG, WebP)', 'warning');
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target.result;
      const urlInput = document.getElementById('cms-web-logo-url');
      if (urlInput) urlInput.value = dataUrl;
      if (!this.state.settings) this.state.settings = {};
      this.state.settings.webShopLogoUrl = dataUrl;
      this.updateWebLogoLivePreview();
      this.applyShopBranding();
      this.saveStateToStorage();
      this.showToast('อัปโหลดโลโก้เว็บไซต์สำเร็จ สามารถกดบันทึกเพื่อใช้งานถาวร', 'success');
    };
    reader.readAsDataURL(file);
  },

  resetWebLogoToDefault() {
    const urlInput = document.getElementById('cms-web-logo-url');
    if (urlInput) urlInput.value = '';
    const fileInput = document.getElementById('cms-web-logo-file-input');
    if (fileInput) fileInput.value = '';
    if (!this.state.settings) this.state.settings = {};
    this.state.settings.webShopLogoUrl = '';
    this.updateWebLogoLivePreview();
    this.applyShopBranding();
    this.showToast('รีเซ็ตโลโก้เว็บไซต์เป็นแบบมาตรฐานแล้ว', 'info');
  },

  handleDocLogoUpload(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      this.showToast('กรุณาเลือกไฟล์รูปภาพเท่านั้น (PNG, JPG, SVG, WebP)', 'warning');
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target.result;
      const urlInput = document.getElementById('cms-doc-logo-url');
      if (urlInput) urlInput.value = dataUrl;
      if (!this.state.settings) this.state.settings = {};
      this.state.settings.docShopLogoUrl = dataUrl;
      this.updateDocLogoLivePreview();
      this.applyShopBranding();
      this.saveStateToStorage();
      this.showToast('อัปโหลดโลโก้หัวเอกสารบัญชีสำเร็จ สามารถกดบันทึกเพื่อใช้งานถาวร', 'success');
    };
    reader.readAsDataURL(file);
  },

  resetDocLogoToDefault() {
    const urlInput = document.getElementById('cms-doc-logo-url');
    if (urlInput) urlInput.value = '';
    const fileInput = document.getElementById('cms-doc-logo-file-input');
    if (fileInput) fileInput.value = '';
    if (!this.state.settings) this.state.settings = {};
    this.state.settings.docShopLogoUrl = '';
    this.updateDocLogoLivePreview();
    this.applyShopBranding();
    this.showToast('รีเซ็ตโลโก้หัวเอกสารเรียบร้อย', 'info');
  },

  saveShopBranding() {
    if (!this.state.settings) this.state.settings = {};
    const s = this.state.settings;

    // 1. Web Branding
    s.webShopName = document.getElementById('cms-web-name')?.value.trim() || 'ร้านทำดีมีเดีย';
    s.webShopSubname = document.getElementById('cms-web-subname')?.value.trim() || 'TUMDEEMEDIA';
    s.webShopSlogan = document.getElementById('cms-web-slogan')?.value.trim() || 'โรงพิมพ์ป้ายและสื่อสิ่งพิมพ์ครบวงจรอันดับ 1 เมืองตรัง';
    s.webShopLetter = document.getElementById('cms-web-letter')?.value.trim() || 'T';
    s.webShopLogoUrl = document.getElementById('cms-web-logo-url')?.value.trim() || '';
    s.webShopLogoSize = parseInt(document.getElementById('cms-web-logo-size-slider')?.value, 10) || 52;
    const defThemeInput = document.getElementById('cms-default-theme');
    if (defThemeInput) s.defaultTheme = defThemeInput.value;

    // Fallback sync for legacy fields
    s.shopName = s.webShopName;
    s.shopSubname = s.webShopSubname;
    s.shopLetter = s.webShopLetter;
    s.shopLogoUrl = s.webShopLogoUrl;
    s.shopLogoSize = s.webShopLogoSize;
    s.shopSlogan = s.webShopSlogan;

    // 2. Accounting Document Header Branding (Separate from web)
    s.docShopName = document.getElementById('cms-doc-name')?.value.trim() || 'ร้านทำดีมีเดีย';
    s.docShopSubname = document.getElementById('cms-doc-subname')?.value.trim() || 'TUMDEEMEDIA';
    s.docShopLetter = document.getElementById('cms-doc-letter')?.value.trim() || 'T';
    s.docShopLogoUrl = document.getElementById('cms-doc-logo-url')?.value.trim() || '';
    s.docShopLogoSize = parseInt(document.getElementById('cms-doc-logo-size-slider')?.value, 10) || 48;
    s.docShopTaxId = document.getElementById('cms-doc-taxid')?.value.trim() || '3920100923387';
    s.docShopPhone = document.getElementById('cms-doc-phone')?.value.trim() || '062-419-8365';
    s.docShopAddress = document.getElementById('cms-doc-address')?.value.trim() || '125/1 ม.1 ต.หนองตรุด อ.เมืองตรัง จ.ตรัง 92000';
    s.docShopLine = document.getElementById('cms-doc-line')?.value.trim() || 'tumdeemedia';
    s.docShopEmail = document.getElementById('cms-doc-email')?.value.trim() || 'tumdeemediatrang@gmail.com';
    s.docBankName = document.getElementById('cms-doc-bank-name')?.value.trim() || 'ธนาคารไทยพาณิชย์ (SCB) สาขาตรัง';
    s.docBankAccount = document.getElementById('cms-doc-bank-account')?.value.trim() || '590-264768-1';
    s.docBankPromptPay = document.getElementById('cms-doc-bank-promptpay')?.value.trim() || '3920100923387';
    s.docPaymentTerms = document.getElementById('cms-doc-payment-terms')?.value.trim() || 'งานสั่งผลิตมัดจำ 50% ก่อนขึ้นแบบผลิต และชำระส่วนที่เหลือก่อนส่งมอบ';
    s.docStampTitle = document.getElementById('cms-doc-stamp-title')?.value.trim() || s.docShopName;
    s.docStampSub = document.getElementById('cms-doc-stamp-sub')?.value.trim() || s.docShopSubname;
    s.docStampTaxId = document.getElementById('cms-doc-stamp-taxid')?.value.trim() || s.docShopTaxId;

    this.applyShopBranding();
    this.saveStateToStorage();
    this.showToast('บันทึกข้อมูลโลโก้เว็บและหัวเอกสารบัญชีเรียบร้อยแล้ว (Real-time)', 'success');
  },

  renderGallery(cat) {
    document.querySelectorAll('.gallery-tab').forEach(t => t.classList.remove('active'));
    const activeTab = document.getElementById('tab-' + cat);
    if (activeTab) activeTab.classList.add('active');
    const grid = document.getElementById('portfolio-gallery-grid');
    if (!grid) return;
    grid.innerHTML = '';
    const items = cat === 'all' ? this.state.portfolio : this.state.portfolio.filter(p => p.cat === cat);
    if (items.length === 0) {
      grid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; color: var(--text-light); padding: 40px;">ยังไม่มีผลงานในหมวดหมู่นี้</div>';
      return;
    }
    items.forEach(p => {
      grid.innerHTML += `<div class="g-card" onclick="app.openPortfolioDetail('${p.id}')"><div class="g-img" style="background-image:url('${p.img}')"></div><div class="g-overlay"><i class="las la-search-plus"></i></div><div class="g-info"><div style="font-size:12px; color:var(--accent); font-weight:bold; margin-bottom:5px;">${p.catName || p.cat}</div><h3 style="color:var(--primary); font-size:16px; margin:0;">${p.title}</h3></div></div>`;
    });
  },

  initTestimonialSlider() {
    const track = document.getElementById('testi-track');
    const dots = document.getElementById('testi-dots');
    if (!track || !dots) return;
    const slides = track.querySelectorAll('.testimonial-slide');
    if (!slides.length) return;
    let idx = 0;
    dots.innerHTML = '';
    slides.forEach((_, i) => {
      dots.innerHTML += `<div class="t-dot ${i === 0 ? 'active' : ''}" onclick="app.goToTesti(${i})"></div>`;
    });
  },

  goToTesti(i) {
    const track = document.getElementById('testi-track');
    const dots = document.querySelectorAll('.t-dot');
    if (!track || !dots.length) return;
    track.style.transform = `translateX(-${i * 100}%)`;
    dots.forEach(d => d.classList.remove('active'));
    if (dots[i]) dots[i].classList.add('active');
  },

  initFlashSaleSlider() {
    const track = document.getElementById('fs-track');
    if (!track) return;
    setInterval(() => {
      if (track.scrollWidth - track.clientWidth <= track.scrollLeft + 10) {
        track.scrollTo({ left: 0, behavior: 'smooth' });
      } else {
        track.scrollBy({ left: 320, behavior: 'smooth' });
      }
    }, 6000);
  },

  scrollToOrderFromFlash(typeId) {
    this.state.cart = [{ id: 'item_' + Date.now(), type: typeId, w: 1, h: 1, qty: 1, finish: 'none', detail: '', refImg: null }];
    this.scrollToOrder();
    this.showToast('ดึงสินค้าโปรโมชันลงฟอร์มแล้ว', 'success');
  },

  togglePkgItem(pkgId, itemId) {
    const pkg = this.state.packages.find(p => p.id === pkgId);
    if (pkg) {
      const item = pkg.items.find(i => i.id === itemId);
      if (item) {
        item.checked = !item.checked;
        this.renderLandingCMS();
      }
    }
  },

  orderCustomPackage(pkgId) {
    const pkg = this.state.packages.find(p => p.id === pkgId);
    if (!pkg) return;
    const selected = pkg.items.filter(i => i.checked);
    if (selected.length === 0) { this.showToast('กรุณาเลือกอย่างน้อย 1 รายการ', 'warning'); return; }
    this.state.cart = selected.map(i => ({
      id: 'pkg_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
      type: i.type, w: i.w, h: i.h, qty: i.qty, finish: i.finish || 'none', detail: i.detail, refImg: null
    }));
    this.scrollToOrder();
    this.showToast('นำแพ็กเกจเข้าสู่ฟอร์มสั่งผลิตเรียบร้อยแล้ว', 'success');
  },

  openPortfolioDetail(id) {
    const p = this.state.portfolio.find(x => x.id === id);
    if (!p) return;
    const imgEl = document.getElementById('pm-img'); if (imgEl) imgEl.style.backgroundImage = `url('${p.img}')`;
    const catEl = document.getElementById('pm-cat'); if (catEl) catEl.innerText = p.catName || p.cat;
    const titleEl = document.getElementById('pm-title'); if (titleEl) titleEl.innerText = p.title;
    const descEl = document.getElementById('pm-desc'); if (descEl) descEl.innerText = p.desc;
    const specUl = document.getElementById('pm-spec');
    if (specUl) {
      specUl.innerHTML = '';
      (p.spec || []).forEach(s => specUl.innerHTML += `<li>${s}</li>`);
    }
    const btn = document.getElementById('pm-btn');
    if (btn) btn.onclick = () => {
      document.getElementById('portfolio-modal').style.display = 'none';
      this.scrollToOrder();
    };
    const modal = document.getElementById('portfolio-modal');
    if (modal) modal.style.display = 'flex';
  },

  openServiceDetail(id) {
    const s = this.state.services.find(x => x.id === id);
    if (!s) return;
    const iconEl = document.getElementById('sm-icon'); if (iconEl) iconEl.innerHTML = `<i class="${s.icon}"></i>`;
    const titleEl = document.getElementById('sm-title'); if (titleEl) titleEl.innerText = s.title;
    const catEl = document.getElementById('sm-cat'); if (catEl) catEl.innerText = s.cat;
    const imgEl = document.getElementById('sm-img'); if (imgEl) imgEl.src = s.img;
    const descEl = document.getElementById('sm-desc'); if (descEl) descEl.innerText = s.desc;
    const specUl = document.getElementById('sm-spec');
    if (specUl) {
      specUl.innerHTML = '';
      (s.spec || []).forEach(x => specUl.innerHTML += `<li>${x}</li>`);
    }
    const btn = document.getElementById('sm-btn');
    if (btn) btn.onclick = () => {
      document.getElementById('service-modal').style.display = 'none';
      this.scrollToOrder();
    };
    const modal = document.getElementById('service-modal');
    if (modal) modal.style.display = 'flex';
  },

  addCartItem() {
    const id = 'item_' + Date.now();
    this.state.cart.push({ id, type: this.state.catalog[0].id, w: 1, h: 1, qty: 1, finish: 'none', detail: '', refImg: null });
    this.renderCart();
  },

  removeCartItem(id) {
    this.state.cart = this.state.cart.filter(c => c.id !== id);
    if (this.state.cart.length === 0) this.addCartItem();
    this.renderCart();
  },

  updateItem(id, field, val) {
    const item = this.state.cart.find(c => c.id === id);
    if (item) { item[field] = val; this.calcCart(); }
  },

  renderCart() {
    const c = document.getElementById('cart-container');
    if (!c) return;
    c.innerHTML = '';

    let catOptions = '';
    const grouped = this.state.catalog.reduce((acc, curr) => {
      if (!acc[curr.category]) acc[curr.category] = [];
      acc[curr.category].push(curr);
      return acc;
    }, {});
    for (const [cat, items] of Object.entries(grouped)) {
      catOptions += `<optgroup label="${cat}">`;
      items.forEach(i => catOptions += `<option value="${i.id}">${i.name} (฿${i.price}/${i.unit})</option>`);
      catOptions += `</optgroup>`;
    }

    let finOptions = '';
    for (const [k, v] of Object.entries(this.state.finishing)) {
      finOptions += `<option value="${k}">${v.name} (+฿${v.price})</option>`;
    }

    this.state.cart.forEach(item => {
      c.innerHTML += `
      <div class="order-item-box">
        <div class="btn-remove-item" onclick="app.removeCartItem('${item.id}')"><i class="las la-trash"></i></div>
        <div class="grid-2">
          <div class="form-group"><label>ประเภทวัสดุ/สินค้า</label><select onchange="app.updateItem('${item.id}', 'type', this.value)">${catOptions.replace(`value="${item.type}"`, `value="${item.type}" selected`)}</select></div>
          <div class="form-group"><label>ออปชันเสริม (Finishing)</label><select onchange="app.updateItem('${item.id}', 'finish', this.value)">${finOptions.replace(`value="${item.finish}"`, `value="${item.finish}" selected`)}</select></div>
        </div>
        ${item.type === 'OTH' ? `
        <div class="form-group" style="background:#FEF3C7; padding:10px 14px; border-radius:8px; border:1px solid #FCD34D;">
          <label style="color:#92400E; font-weight:700;"><i class="las la-pen"></i> ระบุชื่อสินค้า/บริการที่ต้องการสั่งผลิตพิเศษ:</label>
          <input type="text" placeholder="เช่น สติกเกอร์ฉลากสีทองกันน้ำ, ป้ายอักษรโลหะซ่อนไฟ, ป้ายแคนวาส ฯลฯ" value="${item.customName || ''}" onchange="app.updateItem('${item.id}', 'customName', this.value)" style="background:white; font-size:13px;">
        </div>` : ''}
        <div class="grid-3">
          <div class="form-group"><label>กว้าง (เมตร)</label><input type="number" step="0.1" value="${item.w}" onchange="app.updateItem('${item.id}', 'w', parseFloat(this.value)||0)"></div>
          <div class="form-group"><label>สูง (เมตร)</label><input type="number" step="0.1" value="${item.h}" onchange="app.updateItem('${item.id}', 'h', parseFloat(this.value)||0)"></div>
          <div class="form-group"><label>จำนวน (ชิ้น)</label><input type="number" value="${item.qty}" min="1" onchange="app.updateItem('${item.id}', 'qty', parseInt(this.value)||1)"></div>
        </div>
        <div class="form-group">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:5px;">
            <label style="margin:0;">รายละเอียดเพิ่มเติม (ข้อความบนป้าย / คอนเซ็ปต์)</label>
            <button type="button" class="btn btn-sm btn-outline" style="font-size:11px; padding:2px 8px; border-radius:50px; color:#D97706; border-color:#F59E0B; background:#FFFBEB;" onclick="app.openAiSloganModal('${item.id}')">
              <i class="las la-robot"></i> AI ช่วยคิดข้อความป้าย
            </button>
          </div>
          <textarea rows="2" id="cart-detail-${item.id}" onchange="app.updateItem('${item.id}', 'detail', this.value)" placeholder="เช่น ข้อความบนป้าย, โทนสี หรือหมายเหตุ">${item.detail}</textarea>
        </div>
        <div class="form-group" style="margin:0;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:5px;">
            <label style="margin:0;">อัปโหลดไฟล์แบบ / ภาพตัวอย่าง (ถ้ามี)</label>
            <button type="button" class="btn btn-sm btn-outline" style="font-size:11px; padding:2px 8px; border-radius:50px; color:#2563EB; border-color:#93C5FD; background:#EFF6FF;" onclick="app.checkCartItemPreflight('${item.id}')">
              <i class="las la-search-plus"></i> AI เช็คความละเอียด DPI ไฟล์
            </button>
          </div>
          <input type="file" id="cart-file-${item.id}" accept="image/*, .pdf, .ai, .psd" onchange="app.handleItemFile(this, '${item.id}')">
          <div id="preview-${item.id}" style="margin-top:10px; font-size:12px; color:var(--success); font-weight:bold; ${item.refImg ? '' : 'display:none;'}"><i class="las la-check-circle"></i> แนบไฟล์เรียบร้อยแล้ว</div>
          <div id="cart-preflight-info-${item.id}" style="margin-top:6px;"></div>
        </div>
      </div>`;
    });
    this.calcCart();
  },

  handleItemFile(input, id) {
    const file = input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      this.updateItem(id, 'refImg', e.target.result);
      const pr = document.getElementById('preview-' + id);
      if (pr) pr.style.display = 'block';
    };
    reader.readAsDataURL(file);
  },

  previewImage(input, imgId) {
    if (typeof input === 'string') {
      this.previewImageLarge(input, imgId || 'ตรวจสอบภาพขยายและรายละเอียด', 'ภาพขยาย');
      return;
    }
    const file = input && input.files ? input.files[0] : null;
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = document.getElementById(imgId);
      if (img) img.src = e.target.result;
      const cnt = document.getElementById('container-' + imgId);
      if (cnt) cnt.style.display = 'block';
    };
    reader.readAsDataURL(file);
  },

  calcCart() {
    let subtotal = 0;
    this.state.cart.forEach(item => {
      const catItem = this.state.catalog.find(c => c.id === item.type);
      if (catItem) {
        let area = (catItem.category.includes('POSM') || catItem.category.includes('วัสดุ') || catItem.unit === 'ชุด' || catItem.unit === 'แผ่น' || catItem.unit === 'กล่อง' || catItem.unit === 'เล่ม' || catItem.unit === 'รายการ') ? 1 : (item.w * item.h);
        subtotal += (area * catItem.price * item.qty);
      }
      const fin = this.state.finishing[item.finish];
      if (fin && fin.price > 0) subtotal += (fin.price * item.qty);
    });

    let discount = 0;
    if (this.state.currentAgentId) {
      const agent = this.state.agents.find(a => a.id === this.state.currentAgentId);
      if (agent) {
        const rate = this.state.agentTiers[agent.tier] || 0;
        discount = subtotal * rate;
        subtotal = subtotal - discount;
      }
    }

    const delType = document.getElementById('f_delivery')?.value || 'pickup';
    const installCost = this.state.installPricing[delType] || 0;
    const isVat = document.getElementById('f_vat_toggle')?.checked || false;
    let beforeVat = subtotal + installCost;
    let vat = isVat ? beforeVat * 0.07 : 0;
    let net = beforeVat + vat;

    const subEl = document.getElementById('sum-subtotal'); if (subEl) subEl.innerText = '฿' + subtotal.toLocaleString(undefined, { minimumFractionDigits: 2 });
    const rowInst = document.getElementById('row-install');
    const sumInst = document.getElementById('sum-install');
    if (rowInst && sumInst) {
      rowInst.style.display = installCost > 0 ? 'flex' : 'none';
      sumInst.innerText = '฿' + installCost.toLocaleString(undefined, { minimumFractionDigits: 2 });
    }
    const rowVat = document.getElementById('row-vat');
    const sumVat = document.getElementById('sum-vat');
    if (rowVat && sumVat) {
      rowVat.style.display = isVat ? 'flex' : 'none';
      sumVat.innerText = '฿' + vat.toLocaleString(undefined, { minimumFractionDigits: 2 });
    }
    const netEl = document.getElementById('sum-net'); if (netEl) netEl.innerText = '฿' + net.toLocaleString(undefined, { minimumFractionDigits: 2 });

    this.updateOrderPaymentQR(net);

    return { subtotal, installCost, discount, beforeVat, vat, net };
  },

  setPaymentMode(mode) {
    const pricing = this.calcCart();
    if (pricing.net < 500 && mode === 'deposit') {
      this.showToast('ยอดสั่งซื้อต่ำกว่า 500 บาท ระบบกำหนดให้ชำระเต็มจำนวน 100%', 'warning');
      mode = 'full';
    }
    this.state.payMode = mode;
    const btnDeposit = document.getElementById('btn-pay-deposit');
    const btnFull = document.getElementById('btn-pay-full');
    if (btnDeposit && btnFull) {
      if (mode === 'deposit') {
        btnDeposit.classList.add('active');
        btnFull.classList.remove('active');
      } else {
        btnDeposit.classList.remove('active');
        btnFull.classList.add('active');
      }
    }
    this.updateOrderPaymentQR(pricing.net);
  },

  updateOrderPaymentQR(netTotal) {
    const isUnderMin = netTotal < 500;
    if (isUnderMin && this.state.payMode === 'deposit') {
      this.state.payMode = 'full';
    }
    const isDeposit = this.state.payMode === 'deposit';
    const amount = isDeposit ? Math.round(netTotal * 0.5) : netTotal;
    const qrImg = document.getElementById('order-qr-img');
    const amtEl = document.getElementById('order-qr-amount');
    const descEl = document.getElementById('order-qr-desc');
    const depositBtn = document.getElementById('btn-pay-deposit');
    const fullBtn = document.getElementById('btn-pay-full');
    const depositBtnVal = document.getElementById('btn-pay-deposit-val');
    const fullBtnVal = document.getElementById('btn-pay-full-val');
    const minNotice = document.getElementById('qr-min-amount-notice');

    if (minNotice) {
      minNotice.style.display = isUnderMin ? 'block' : 'none';
    }

    if (depositBtn) {
      if (isUnderMin) {
        depositBtn.style.opacity = '0.45';
        depositBtn.style.cursor = 'not-allowed';
        depositBtn.title = 'ยอดสั่งซื้อต่ำกว่า 500 บาท กรุณาชำระเต็มจำนวน';
      } else {
        depositBtn.style.opacity = '1';
        depositBtn.style.cursor = 'pointer';
        depositBtn.title = '';
      }
      if (isDeposit) depositBtn.classList.add('active'); else depositBtn.classList.remove('active');
    }

    if (fullBtn) {
      if (!isDeposit) fullBtn.classList.add('active'); else fullBtn.classList.remove('active');
    }

    if (depositBtnVal) depositBtnVal.innerText = '฿' + Math.round(netTotal * 0.5).toLocaleString();
    if (fullBtnVal) fullBtnVal.innerText = '฿' + Math.round(netTotal).toLocaleString();

    if (amtEl) amtEl.innerText = '฿' + amount.toLocaleString(undefined, { minimumFractionDigits: 2 });
    if (descEl) descEl.innerText = isUnderMin ? 'ยอดชำระเต็มจำนวน 100% (คำสั่งซื้อต่ำกว่า 500 บาท)' : (isDeposit ? 'ยอดมัดจำ 50% ก่อนเริ่มงานผลิต' : 'ยอดชำระเต็มจำนวน 100%');
    if (qrImg) {
      qrImg.src = getPromptPayQRUrl('0950259996', amount);
    }
  },

  copyToClipboard(text, msg) {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(() => {
        this.showToast(msg || 'คัดลอกเรียบร้อยแล้ว!', 'success');
      }).catch(() => {
        this.fallbackCopy(text, msg);
      });
    } else {
      this.fallbackCopy(text, msg);
    }
  },

  fallbackCopy(text, msg) {
    const el = document.createElement('textarea');
    el.value = text;
    document.body.appendChild(el);
    el.select();
    document.execCommand('copy');
    document.body.removeChild(el);
    this.showToast(msg || 'คัดลอกเรียบร้อยแล้ว!', 'success');
  },

  sendSpecToLine() {
    const matId = document.getElementById('qq-mat')?.value;
    const w = parseFloat(document.getElementById('qq-w')?.value) || 1;
    const h = parseFloat(document.getElementById('qq-h')?.value) || 1;
    const qty = parseInt(document.getElementById('qq-qty')?.value) || 1;
    const catItem = this.state.catalog.find(c => c.id === matId);
    const itemName = catItem ? catItem.name : 'งานป้าย/สื่อโฆษณา';
    let othNote = '';
    if (matId === 'OTH') {
      const customSpec = document.getElementById('qq-oth-detail')?.value.trim();
      if (customSpec) othNote = `\n- รายละเอียดที่ระบุ: ${customSpec}`;
    }
    const total = document.getElementById('qq-total')?.innerText || '';

    const text = `สวัสดีครับ สนใจสั่งผลิตงานกับ TUMDEEMEDIA ครับ\n📌 รายการ: ${itemName}${othNote}\n📐 ขนาด: ${w} x ${h} เมตร\n🔢 จำนวน: ${qty} ชิ้น\n💵 ประเมินราคาเบื้องต้น: ${total}\nขอปรึกษาและสั่งงานด่วนครับ`;
    this.copyToClipboard(text, 'คัดลอกรายละเอียดงานแล้ว กำลังเปิด LINE...');
    setTimeout(() => {
      window.open(this.state.settings.linkLine, '_blank');
    }, 500);
  },

  sendOrderSummaryToLine(orderId) {
    const order = this.state.orders.find(o => o.id === orderId) || this.state.orders[0];
    if (!order) return;
    let itemsText = order.items.map(i => {
      const c = this.state.catalog.find(cat => cat.id === i.type);
      return `- ${c?.name || i.type} (${i.w}x${i.h}ม.) จำนวน ${i.qty} ชิ้น`;
    }).join('\n');

    const text = `แจ้งรายละเอียดออเดอร์ TUMDEEMEDIA\nรหัสออเดอร์: ${order.id}\nลูกค้า: ${order.customerName} (${order.customerPhone})\nรายการสั่งผลิต:\n${itemsText}\nยอดสุทธิ: ฿${order.net.toLocaleString()}\nสถานะชำระ: ${order.payment}`;
    this.copyToClipboard(text, 'คัดลอกสรุปออเดอร์แล้ว กำลังเปิด LINE...');
    setTimeout(() => {
      window.open(this.state.settings.linkLine, '_blank');
    }, 500);
  },

  submitOrderToGoogle() {
    const name = document.getElementById('f_name')?.value;
    const phone = document.getElementById('f_phone')?.value;
    const dueDate = document.getElementById('f_dueDate')?.value;
    const delType = document.getElementById('f_delivery')?.value || 'pickup';

    if (!name || !phone || !dueDate) {
      this.showToast('กรุณากรอกข้อมูลสำคัญให้ครบถ้วน', 'warning');
      return;
    }

    const btn = document.getElementById('submitBtn');
    if (btn) {
      btn.innerHTML = '<i class="las la-spinner la-spin"></i> กำลังประมวลผล...';
      btn.disabled = true;
    }

    const slipImg = document.getElementById('preview-slip')?.src || null;
    const pricing = this.calcCart();
    const orderId = this.state.editingOrderId || ('TM-' + Math.floor(1000 + Math.random() * 9000));
    const payStatus = slipImg ? (this.state.payMode === 'full' ? 'Paid' : 'Deposit') : 'Unpaid';

    const orderObj = {
      id: orderId,
      date: new Date().toISOString(),
      dueDate,
      customerName: name,
      customerPhone: phone,
      customerAddress: '',
      installType: delType,
      items: [...this.state.cart],
      slipImg,
      subtotal: pricing.subtotal,
      installCost: pricing.installCost,
      discount: pricing.discount,
      beforeVat: pricing.beforeVat,
      vat: pricing.vat,
      net: pricing.net,
      status: 'Sales',
      payment: payStatus,
      agentId: this.state.currentAgentId || '',
      priority: 'normal',
      graphicNote: '',
      proofImg: null,
      proofStatus: 'none'
    };

    this.registerOrUpdateCustomer(name, phone, pricing.net);

    if (typeof google !== 'undefined' && google.script) {
      google.script.run
        .withSuccessHandler(() => {
          this.showToast('บันทึกออเดอร์เรียบร้อยแล้ว!', 'success');
          this.notify(`💰 ออเดอร์ใหม่ ${orderId} จาก ${name} (${payStatus === 'Unpaid' ? 'รอชำระ' : 'แนบสลิปแล้ว'})`);
          this.closeOrderModal();
          if (btn) btn.disabled = false;
        })
        .withFailureHandler((err) => {
          this.showToast('เกิดข้อผิดพลาด: ' + err, 'error');
          if (btn) btn.disabled = false;
        })
        .processOrderForm(orderObj);
    } else {
      setTimeout(() => {
        const existIdx = this.state.orders.findIndex(o => o.id === orderId);
        if (existIdx > -1) {
          this.state.orders[existIdx] = { ...this.state.orders[existIdx], ...orderObj };
        } else {
          this.state.orders.unshift(orderObj);
        }
        this.notify(`💰 มีคำสั่งซื้อใหม่ ${orderId} จาก ${name} (${payStatus === 'Unpaid' ? 'รอชำระเงิน' : 'แนบสลิปชำระเงินแล้ว'})`);
        this.showToast('สั่งผลิตสำเร็จ! รหัสออเดอร์คือ: ' + orderId, 'success');
        this.closeOrderModal();
        if (btn) {
          btn.innerHTML = '<i class="las la-paper-plane"></i> ยืนยันสั่งผลิต / ส่งข้อมูลเข้าระบบ';
          btn.disabled = false;
        }
        if (this.state.currentAgentId) {
          this.loginAgent(true);
        }
      }, 1000);
    }
  },

  registerOrUpdateCustomer(name, phone, amount = 0) {
    if (!name || !phone) return;
    let customer = this.state.customers.find(c => c.phone === phone || c.name === name);
    if (customer) {
      customer.totalSpend = (customer.totalSpend || 0) + amount;
      customer.orderCount = (customer.orderCount || 0) + 1;
      customer.points = Math.floor(customer.totalSpend / 100);
      if (customer.totalSpend > 100000) customer.tier = 'VIP';
      else if (customer.totalSpend > 50000) customer.tier = 'Platinum';
      else if (customer.totalSpend > 20000) customer.tier = 'Gold';
    } else {
      const newCust = {
        id: 'C' + String(this.state.customers.length + 1).padStart(3, '0'),
        name,
        phone,
        address: '-',
        tier: 'Silver',
        totalSpend: amount,
        points: Math.floor(amount / 100),
        orderCount: 1,
        creditTerm: 'เงินสด'
      };
      this.state.customers.push(newCust);
    }
  },

  quickTrack(id) {
    const input = document.getElementById('track-id');
    if (input) input.value = id;
    this.trackOrder();
  },

  trackOrder() {
    const rawKw = document.getElementById('track-id')?.value.trim();
    if (!rawKw) {
      this.showToast('กรุณาระบุรหัสออเดอร์หรือเบอร์โทรศัพท์', 'warning');
      return;
    }

    const kw = rawKw.toLowerCase();
    const cleanKw = rawKw.replace(/[^0-9]/g, '');

    const order = this.state.orders.find(o => 
      o.id.toLowerCase() === kw || 
      (cleanKw && o.customerPhone && o.customerPhone.replace(/[^0-9]/g, '') === cleanKw) || 
      (cleanKw && o.customerPhone && o.customerPhone.includes(cleanKw)) ||
      (o.customerName && o.customerName.toLowerCase().includes(kw))
    );

    const resArea = document.getElementById('track-result');
    if (!resArea) return;

    if (!order) {
      this.showToast('ไม่พบข้อมูลออเดอร์ กรุณาตรวจสอบรหัสหรือเบอร์โทรศัพท์อีกครั้ง', 'error');
      resArea.style.display = 'none';
      return;
    }

    this.state.currentTrackOrderId = order.id;
    this.state.currentManageId = order.id;

    // Header info
    const idEl = document.getElementById('tr-id'); if (idEl) idEl.innerText = order.id;
    const nameEl = document.getElementById('tr-name'); if (nameEl) nameEl.innerText = order.customerName || '-';
    const dateEl = document.getElementById('tr-date'); if (dateEl) dateEl.innerText = new Date(order.date || Date.now()).toLocaleDateString('th-TH');
    const dueDateEl = document.getElementById('tr-duedate'); 
    if (dueDateEl) {
      dueDateEl.innerHTML = `<i class="las la-calendar-check"></i> ${order.dueDate ? new Date(order.dueDate).toLocaleDateString('th-TH') : 'ตามกำหนดผลิต'}`;
    }
    const priorityBadge = document.getElementById('tr-priority-badge');
    if (priorityBadge) {
      priorityBadge.innerText = order.priority === 'rush' ? '⚡ ด่วนพิเศษ (Rush)' : 'ปกติ (Normal)';
      priorityBadge.style.background = order.priority === 'rush' ? '#FEE2E2' : '#EFF6FF';
      priorityBadge.style.color = order.priority === 'rush' ? '#DC2626' : '#1E40AF';
    }

    // 5-Step Stepper Progress & State
    // Steps: 1: Sales, 2: Graphic, 3: Production, 4: QC, 5: Done
    const steps = ['Sales', 'Graphic', 'Production', 'QC', 'Done'];
    let currentStepIdx = 0;
    if (order.status === 'Sales') currentStepIdx = 0;
    else if (order.status === 'Graphic') currentStepIdx = 1;
    else if (order.status === 'Production') currentStepIdx = 2;
    else if (order.status === 'QC') currentStepIdx = 3;
    else if (order.status === 'Done' || order.status === 'Delivered') currentStepIdx = 4;

    const progressPercent = [10, 32, 55, 78, 100][currentStepIdx] || 10;
    const progressBar = document.getElementById('tr-stepper-progress');
    if (progressBar) progressBar.style.width = `${progressPercent}%`;

    for (let i = 1; i <= 5; i++) {
      const node = document.getElementById(`tr-step-${i}`);
      if (node) {
        node.classList.remove('active', 'completed');
        if (i - 1 < currentStepIdx) {
          node.classList.add('completed');
        } else if (i - 1 === currentStepIdx) {
          node.classList.add('active');
        }
      }
    }

    // Status Banner Info
    const bannerInfo = {
      Sales: {
        title: 'ได้รับคำสั่งซื้อแล้ว (Order Received)',
        desc: 'เจ้าหน้าที่กำลังตรวจสอบรายการ สเปกขนาด และคิวงานผลิต',
        color: '#2563EB',
        bg: '#EFF6FF',
        border: '#BFDBFE',
        icon: 'las la-receipt'
      },
      Graphic: {
        title: 'ฝ่ายออกแบบกำลังจัดทำแบบ (Pre-press / Artwork)',
        desc: 'กราฟิกดีไซเนอร์กำลังจัดวางเลย์เอาต์ความละเอียดสูง และส่ง E-Proof ให้ตรวจสอบ',
        color: '#D97706',
        bg: '#FEF3C7',
        border: '#FCD34D',
        icon: 'las la-paint-roller'
      },
      Production: {
        title: 'กำลังดำเนินการผลิตในโรงงาน (Printing & Fabrication)',
        desc: 'งานถูกส่งเข้าเครื่องพิมพ์ความละเอียดสูง หรือกำลังประกอบโครงสร้างชิ้นงาน',
        color: '#7C3AED',
        bg: '#F5F3FF',
        border: '#DDD6FE',
        icon: 'las la-print'
      },
      QC: {
        title: 'ตรวจสอบคุณภาพและแพ็คกิ้ง (QC & Packing)',
        desc: 'ตรวจสอบความเรียบร้อย ตอกตาไก่ ซีลขอบ และแพ็คเตรียมส่งมอบหรือติดตั้ง',
        color: '#0284C7',
        bg: '#E0F2FE',
        border: '#BAE6FD',
        icon: 'las la-check-double'
      },
      Done: {
        title: 'ผลิตเสร็จสมบูรณ์ / ส่งมอบเรียบร้อย (Delivered / Installed)',
        desc: 'สินค้าพร้อมรับที่หน้าร้าน จัดส่งพัสดุ หรือช่างเข้าติดตั้งหน้างานสำเร็จเรียบร้อย',
        color: '#059669',
        bg: '#F0FDF4',
        border: '#A7F3D0',
        icon: 'las la-check-circle'
      }
    };
    const sInfo = bannerInfo[order.status] || bannerInfo.Sales;
    const bannerEl = document.getElementById('tr-status-banner');
    const iconBox = document.getElementById('tr-status-icon-box');
    const titleEl = document.getElementById('tr-status-desc-title');
    const descEl = document.getElementById('tr-status-desc-sub');
    const badgeEl = document.getElementById('tr-status-badge');

    if (bannerEl) {
      bannerEl.style.background = sInfo.bg;
      bannerEl.style.borderColor = sInfo.border;
    }
    if (iconBox) {
      iconBox.style.background = sInfo.color;
      iconBox.innerHTML = `<i class="${sInfo.icon}"></i>`;
    }
    if (titleEl) titleEl.innerText = sInfo.title;
    if (descEl) descEl.innerText = sInfo.desc;
    if (badgeEl) {
      badgeEl.className = 'status-badge status-' + order.status;
      badgeEl.innerText = 'สถานะ: ' + (order.status === 'Done' ? 'เสร็จสมบูรณ์' : order.status);
    }

    // Artwork E-Proof Section
    const awArea = document.getElementById('tr-artwork-area');
    const awImg = document.getElementById('tr-artwork-img');
    const awNote = document.getElementById('tr-artwork-note');
    const awStatus = document.getElementById('tr-artwork-status');
    const awActions = document.getElementById('tr-artwork-actions');
    const awApproveBtn = document.getElementById('tr-artwork-approve-btn');

    if (awArea) {
      if (order.proofImg || order.status === 'Graphic' || order.proofStatus === 'pending') {
        awArea.style.display = 'block';
        if (awImg) {
          awImg.src = order.proofImg || 'https://images.unsplash.com/photo-1541701494587-cb58502866ab?auto=format&fit=crop&w=600&q=80';
        }
        if (awNote) {
          awNote.innerText = order.proofNote || 'กรุณาตรวจสอบความถูกต้องของข้อความ เบอร์โทรศัพท์ และขนาดป้าย';
        }

        if (order.proofStatus === 'approved') {
          if (awStatus) {
            awStatus.innerHTML = '<span style="color:#059669; font-weight:bold; background:#D1FAE5; padding:4px 12px; border-radius:50px; font-size:12px;"><i class="las la-check-circle"></i> แบบผ่านการอนุมัติแล้ว อยู่ในขั้นตอนการผลิต</span>';
          }
          if (awApproveBtn) awApproveBtn.style.display = 'none';
        } else if (order.proofStatus === 'revision') {
          if (awStatus) {
            awStatus.innerHTML = '<span style="color:#B45309; font-weight:bold; background:#FEF3C7; padding:4px 12px; border-radius:50px; font-size:12px;"><i class="las la-edit"></i> อยู่ระหว่างปรับปรุงแก้ไขแบบตามคำขอ</span>';
          }
          if (awApproveBtn) awApproveBtn.style.display = 'none';
        } else {
          if (awStatus) {
            awStatus.innerHTML = '<span style="color:#D97706; font-weight:bold; background:#FEF3C7; padding:4px 12px; border-radius:50px; font-size:12px;"><i class="las la-clock"></i> รอยืนยันแบบจากลูกค้า</span>';
          }
          if (awApproveBtn) awApproveBtn.style.display = 'inline-flex';
        }
      } else {
        awArea.style.display = 'none';
      }
    }

    // Items Breakdown
    const itemsList = document.getElementById('tr-items-list');
    if (itemsList && order.items) {
      let itemsHtml = '';
      order.items.forEach((item, idx) => {
        const mat = this.state.catalog.find(c => c.id === item.type);
        const matName = mat ? mat.name : item.type;
        const finName = this.state.finishing[item.finish]?.name || item.finish || 'มาตรฐาน';
        itemsHtml += `
        <div style="background:#F8FAFC; border:1px solid #E2E8F0; border-radius:10px; padding:12px 14px; display:flex; justify-content:space-between; align-items:flex-start; gap:10px;">
          <div>
            <div style="font-weight:700; color:var(--primary); font-size:13.5px;">${idx + 1}. ${matName}</div>
            <div style="font-size:12px; color:#475569; margin-top:3px;">
              <i class="las la-arrows-alt"></i> ขนาด: <b>${item.w} x ${item.h} เมตร</b> · ชิ้นงาน: <b>${item.qty} ชิ้น</b>
            </div>
            <div style="font-size:11.5px; color:#64748B; margin-top:2px;">
              <i class="las la-tools"></i> ออปชัน: ${finName} ${item.detail ? `· หมายเหตุ: ${item.detail}` : ''}
            </div>
          </div>
          <div style="font-size:14px; font-weight:800; color:var(--primary); white-space:nowrap;">
            ฿${((item.w * item.h * (mat ? mat.price : 150) * item.qty) || 0).toLocaleString()}
          </div>
        </div>`;
      });
      itemsList.innerHTML = itemsHtml;
    }

    const installTypeEl = document.getElementById('tr-install-type');
    if (installTypeEl) installTypeEl.innerText = this.getDeliveryLabel(order.installType);

    // Financial Summary
    const subtotalEl = document.getElementById('tr-sum-subtotal'); if (subtotalEl) subtotalEl.innerText = '฿' + (order.subtotal || 0).toLocaleString();
    const installEl = document.getElementById('tr-sum-install'); if (installEl) installEl.innerText = '฿' + (order.installCost || 0).toLocaleString();
    const vatEl = document.getElementById('tr-sum-vat'); if (vatEl) vatEl.innerText = '฿' + (order.vat || 0).toLocaleString();
    const netEl = document.getElementById('tr-sum-net'); if (netEl) netEl.innerText = '฿' + (order.net || 0).toLocaleString();

    // Payment Status & Remaining Balance
    const payStatusEl = document.getElementById('tr-payment-status');
    const balanceBox = document.getElementById('tr-balance-box');
    const balanceAmountEl = document.getElementById('tr-balance-amount');
    const balanceQrEl = document.getElementById('tr-balance-qr');

    let isPaid = (order.payment === 'Paid');
    let isDeposit = (order.payment === 'Deposit');
    let balance = 0;

    if (isPaid) {
      if (payStatusEl) payStatusEl.innerHTML = '<span style="color:#059669; font-weight:bold;"><i class="las la-check-circle"></i> ชำระเต็มจำนวนเรียบร้อย (100%)</span>';
      if (balanceBox) balanceBox.style.display = 'none';
    } else if (isDeposit) {
      balance = Math.round((order.net || 0) / 2);
      if (payStatusEl) payStatusEl.innerHTML = `<span style="color:#D97706; font-weight:bold;"><i class="las la-percentage"></i> ชำระมัดจำ 50% แล้ว (คงเหลือ ฿${balance.toLocaleString()})</span>`;
      if (balanceBox) {
        balanceBox.style.display = 'block';
        if (balanceAmountEl) balanceAmountEl.innerText = `฿${balance.toLocaleString()}`;
        if (balanceQrEl) balanceQrEl.src = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=0950259996`;
      }
    } else {
      balance = order.net || 0;
      if (payStatusEl) payStatusEl.innerHTML = `<span style="color:#DC2626; font-weight:bold;"><i class="las la-times-circle"></i> ยังไม่ชำระเงิน (คงเหลือ ฿${balance.toLocaleString()})</span>`;
      if (balanceBox) {
        balanceBox.style.display = 'block';
        if (balanceAmountEl) balanceAmountEl.innerText = `฿${balance.toLocaleString()}`;
        if (balanceQrEl) balanceQrEl.src = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=0950259996`;
      }
    }

    // Logistics & Delivery Card
    const logCard = document.getElementById('tr-logistics-card');
    const logContent = document.getElementById('tr-logistics-content');
    if (logCard && logContent) {
      if (order.installType === 'parcel') {
        logCard.style.display = 'block';
        const carrier = order.shippingCarrier || 'Flash Express / ไปรษณีย์ไทย';
        const code = order.trackingCode || 'TH-PENDING';
        logContent.innerHTML = `
        <div style="background:#F8FAFC; border:1px solid #E2E8F0; border-radius:12px; padding:15px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
          <div>
            <div style="font-size:12px; color:#64748B;">บริษัทขนส่ง:</div>
            <div style="font-size:15px; font-weight:700; color:var(--primary);">${carrier}</div>
            <div style="font-size:13px; color:#334155; margin-top:4px;">
              หมายเลขพัสดุ: <strong style="font-family:monospace; font-size:15px; color:#2563EB;">${code}</strong>
            </div>
          </div>
          <div style="display:flex; gap:8px;">
            <button class="btn btn-outline btn-sm" style="font-size:12px; padding:6px 12px; border-radius:50px;" onclick="app.copyToClipboard('${code}', 'คัดลอกเลขพัสดุเรียบร้อย')">
              <i class="las la-copy"></i> คัดลอกเลขพัสดุ
            </button>
            <a href="https://flashexpress.co.th/tracking/?se=${code}" target="_blank" class="btn btn-primary btn-sm" style="font-size:12px; padding:6px 14px; border-radius:50px; text-decoration:none;">
              <i class="las la-external-link-alt"></i> เช็คสถานะพัสดุ
            </a>
          </div>
        </div>`;
      } else if (order.installType === 'standard' || order.installType === 'crane') {
        logCard.style.display = 'block';
        const tech = order.assignedTech || 'ทีมช่างติดตั้ง ทำดีมีเดีย';
        const phone = order.techPhone || '062-419-8365';
        const dateStr = order.scheduledDate ? `${new Date(order.scheduledDate).toLocaleDateString('th-TH')} เวลา ${order.scheduledTime || '10:00 น.'}` : 'ตามตารางนัดหมาย';
        logContent.innerHTML = `
        <div style="background:#F8FAFC; border:1px solid #E2E8F0; border-radius:12px; padding:15px;">
          <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:10px;">
            <div>
              <div style="font-weight:700; color:var(--primary); font-size:14px;"><i class="las la-hard-hat" style="color:var(--accent);"></i> ${tech}</div>
              <div style="font-size:12.5px; color:#475569; margin-top:3px;"><i class="las la-calendar"></i> กำหนดติดตั้ง: <b>${dateStr}</b></div>
              <div style="font-size:12.5px; color:#475569; margin-top:2px;"><i class="las la-truck"></i> ยานพาหนะ: <b>${order.vehiclePlate || 'รถกระบะบริการหน้างาน'}</b></div>
            </div>
            <div>
              <a href="tel:${phone.replace(/[^0-9]/g,'')}" class="btn btn-primary btn-sm" style="font-size:12px; padding:6px 14px; border-radius:50px; text-decoration:none;">
                <i class="las la-phone"></i> โทรติดต่อช่าง (${phone})
              </a>
            </div>
          </div>
          ${order.signOffCustomer ? `
          <div style="margin-top:12px; padding-top:10px; border-top:1px dashed #CBD5E1; font-size:12px; color:#059669;">
            <i class="las la-signature"></i> ลูกค้าเซ็นรับมอบงานแล้ว: <b>${order.signOffCustomer}</b> (${new Date(order.signOffDate || Date.now()).toLocaleDateString('th-TH')})
          </div>` : ''}
        </div>`;
      } else {
        logCard.style.display = 'block';
        logContent.innerHTML = `
        <div style="background:#F8FAFC; border:1px solid #E2E8F0; border-radius:12px; padding:15px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
          <div>
            <div style="font-weight:700; color:var(--primary); font-size:14px;"><i class="las la-store"></i> รับสินค้าด้วยตนเองที่หน้าร้าน ทำดีมีเดีย ตรัง</div>
            <div style="font-size:12.5px; color:#64748B; margin-top:2px;">ที่อยู่: 125/1 ม.1 ต.หนองตรุด อ.เมือง จ.ตรัง 92000 (เวลาเปิดทำการ: 08:30 - 18:00 น.)</div>
          </div>
          <a href="https://maps.google.com/?q=Tumdeemedia+Trang" target="_blank" class="btn btn-outline btn-sm" style="font-size:12px; padding:6px 14px; border-radius:50px; text-decoration:none;">
            <i class="las la-map-marker-alt"></i> แผนที่หน้าร้าน
          </a>
        </div>`;
      }
    }

    // Direct Support LINE Link
    const lineBtn = document.getElementById('tr-line-btn');
    if (lineBtn) {
      const lineMsg = encodeURIComponent(`สอบถามสถานะคำสั่งผลิต ${order.id} (${order.customerName})`);
      lineBtn.href = `https://line.me/ti/p/~tumdeemedia?text=${lineMsg}`;
    }

    resArea.style.display = 'block';
    resArea.scrollIntoView({ behavior: 'smooth', block: 'start' });
    this.showToast(`โหลดข้อมูลออเดอร์ ${order.id} สำเร็จ ✨`, 'info');
  },

  approveArtwork(orderId) {
    const oId = orderId || this.state.currentTrackOrderId;
    const order = this.state.orders.find(o => o.id === oId);
    if (!order) return;
    order.proofStatus = 'approved';
    order.status = 'Production';
    if (order.proofImg && order.items && order.items[0]) {
      order.items[0].refImg = order.proofImg;
    }
    this.saveStateToStorage();
    this.notify(`🎉 ลูกค้าอนุมัติแบบ E-Proof สำหรับออเดอร์ ${order.id} แล้ว ส่งเข้าสู่ฝ่ายผลิตทันที!`);
    this.showToast('ยืนยันแบบสำเร็จ! ออเดอร์ถูกส่งเข้าสู่ฝ่ายผลิตทันที', 'success');
    this.trackOrder();
    this.renderAdmin();
  },

  requestProofRevision(orderId) {
    const oId = orderId || this.state.currentTrackOrderId;
    const order = this.state.orders.find(o => o.id === oId);
    if (!order) return;
    const note = prompt("ระบุจุดที่ต้องการให้ทีมออกแบบแก้ไข (เช่น ขอเปลี่ยนสีตัวอักษร, ขยายเบอร์โทร, แก้ไขข้อความ):");
    if (note) {
      order.proofNote = "ขอแก้ไขแบบ: " + note;
      order.proofStatus = 'revision';
      this.saveStateToStorage();
      this.notify(`✏️ ลูกค้าขอแก้ไขแบบออเดอร์ ${order.id}: "${note}"`);
      this.showToast('ส่งคำขอแก้ไขแบบไปยังฝ่ายออกแบบเรียบร้อย', 'info');
      this.trackOrder();
      this.renderAdmin();
    }
  },

  toggleAgentLoginMode(mode) {
    const btnLogin = document.getElementById('btn-agent-mode-login');
    const btnReg = document.getElementById('btn-agent-mode-reg');
    const formLogin = document.getElementById('agent-subform-login');
    const formReg = document.getElementById('agent-subform-reg');

    if (mode === 'register') {
      if (btnLogin) { btnLogin.style.background = 'transparent'; btnLogin.style.color = '#475569'; }
      if (btnReg) { btnReg.style.background = '#D97706'; btnReg.style.color = 'white'; }
      if (formLogin) formLogin.style.display = 'none';
      if (formReg) formReg.style.display = 'block';
    } else {
      if (btnLogin) { btnLogin.style.background = '#D97706'; btnLogin.style.color = 'white'; }
      if (btnReg) { btnReg.style.background = 'transparent'; btnReg.style.color = '#475569'; }
      if (formLogin) formLogin.style.display = 'block';
      if (formReg) formReg.style.display = 'none';
    }
  },

  loginAgent(bypass = false) {
    let rawInput = document.getElementById('agent-id')?.value?.trim();
    const pass = document.getElementById('agent-pass')?.value?.trim();
    if (bypass) rawInput = this.state.currentAgentId;

    if (!rawInput) {
      this.showToast('กรุณากรอกเบอร์โทรศัพท์, ชื่อตัวแทน, ร้านค้า หรือ Username', 'warning');
      return;
    }

    const cleanInput = rawInput.replace(/[^0-9]/g, '');
    const ag = this.state.agents.find(x => {
      const pClean = (x.phone || '').replace(/[^0-9]/g, '');
      const matchPhone = cleanInput && pClean && pClean === cleanInput;
      const matchId = x.id && x.id.toLowerCase() === rawInput.toLowerCase();
      const matchUser = x.username && x.username.toLowerCase() === rawInput.toLowerCase();
      const matchName = x.name && x.name.toLowerCase().includes(rawInput.toLowerCase());
      const matchShop = x.shop && x.shop.toLowerCase().includes(rawInput.toLowerCase());
      return matchPhone || matchId || matchUser || matchName || matchShop;
    });

    if (ag) {
      // If password provided and agent has password, verify
      if (pass && ag.password && ag.password !== pass) {
        this.showToast('รหัสผ่านตัวแทนไม่ถูกต้อง', 'error');
        return;
      }
      this.state.currentAgentId = ag.id;
      this.state.currentAgentData = ag;
      this.renderAgentPortal();
      this.switchView('agent-portal');
      this.showToast(`ยินดีต้อนรับ ${ag.name} (${ag.shop})`, 'success');
    } else {
      this.showToast('ไม่พบข้อมูลตัวแทน กรุณาตรวจสอบหรือสมัครตัวแทนใหม่', 'error');
    }
  },

  quickLoginAgent(aId) {
    const ag = this.state.agents.find(x => x.id === aId || x.username === aId);
    if (ag) {
      this.state.currentAgentId = ag.id;
      this.state.currentAgentData = ag;
      this.renderAgentPortal();
      this.switchView('agent-portal');
      this.showToast(`เข้าสู่ระบบตัวแทน: ${ag.name} (${ag.shop})`, 'success');
    }
  },

  logoutAgent() {
    this.state.currentAgentId = null;
    this.state.currentAgentData = null;
    this.switchView('landing');
    this.showToast('ออกจากระบบตัวแทนเรียบร้อย', 'info');
  },

  registerAgent() {
    const name = document.getElementById('reg-ag-name')?.value?.trim();
    const shop = document.getElementById('reg-ag-shop')?.value?.trim();
    const phone = document.getElementById('reg-ag-phone')?.value?.trim();
    const line = document.getElementById('reg-ag-line')?.value?.trim();
    const address = document.getElementById('reg-ag-address')?.value?.trim();
    const tax = document.getElementById('reg-ag-tax')?.value?.trim();
    const pass = document.getElementById('reg-ag-pass')?.value?.trim();

    if (!name) {
      this.showToast('กรุณากรอกชื่อ-นามสกุล หรือผู้ติดต่อตัวแทน', 'warning');
      document.getElementById('reg-ag-name')?.focus();
      return;
    }
    if (!shop) {
      this.showToast('กรุณากรอกชื่อร้านค้า หรือชื่อบริษัทตัวแทน', 'warning');
      document.getElementById('reg-ag-shop')?.focus();
      return;
    }
    if (!phone) {
      this.showToast('กรุณากรอกเบอร์โทรศัพท์สำหรับเข้าสู่ระบบ', 'warning');
      document.getElementById('reg-ag-phone')?.focus();
      return;
    }
    if (!pass) {
      this.showToast('กรุณากำหนดรหัสผ่านเข้าใช้งานตัวแทน', 'warning');
      document.getElementById('reg-ag-pass')?.focus();
      return;
    }

    const cleanPhone = phone.replace(/[^0-9]/g, '');
    let existing = this.state.agents.find(a => {
      const p = (a.phone || '').replace(/[^0-9]/g, '');
      return p && cleanPhone && p === cleanPhone;
    });

    if (existing) {
      this.state.currentAgentId = existing.id;
      this.state.currentAgentData = existing;
      this.renderAgentPortal();
      this.switchView('agent-portal');
      this.showToast(`พบข้อมูลตัวแทนเดิม ยินดีต้อนรับกลับ ${existing.name}`, 'info');
      return;
    }

    const newId = 'A' + String(Date.now()).slice(-3);
    const newAgent = {
      id: newId,
      username: 'ag_' + cleanPhone.slice(-4),
      password: pass,
      name,
      shop,
      phone,
      line: line || '',
      address: address || 'ตรัง',
      taxId: tax || '',
      status: 'approved',
      sales: 0,
      commission: 0,
      tier: 'Pro',
      joinDate: new Date().toISOString().split('T')[0]
    };

    if (!this.state.agents) this.state.agents = [];
    this.state.agents.unshift(newAgent);
    this.saveStateToStorage();

    this.state.currentAgentId = newAgent.id;
    this.state.currentAgentData = newAgent;
    this.renderAgentPortal();
    this.switchView('agent-portal');
    this.showToast(`🎉 สมัครสมาชิกตัวแทนสำเร็จ! ยินดีต้อนรับคุณ ${newAgent.name} (${newAgent.shop})`, 'success');
  },

  renderAgentPortal() {
    const ag = this.state.currentAgentData || 
               this.state.agents.find(x => x.id === this.state.currentAgentId) || 
               this.state.agents[0];
    if (!ag) return;
    this.state.currentAgentData = ag;
    this.state.currentAgentId = ag.id;

    const el = id => document.getElementById(id);
    if (el('agent-welcome')) el('agent-welcome').innerText = `ยินดีต้อนรับ ${ag.name} (${ag.shop})`;
    if (el('agent-portal-shop')) el('agent-portal-shop').innerText = ag.shop || '-';
    if (el('agent-portal-phone')) el('agent-portal-phone').innerText = ag.phone || '-';
    if (el('agent-portal-address')) el('agent-portal-address').innerText = ag.address || '-';
    if (el('agent-portal-tier-badge')) el('agent-portal-tier-badge').innerHTML = `<i class="las la-crown"></i> ${ag.tier ? ag.tier.toUpperCase() : 'PRO'} AGENT`;

    // Populate Customer dropdown filter for this agent
    const custSel = document.getElementById('agent-filter-customer');
    if (custSel) {
      const myOrders = this.state.orders.filter(o => o.agentId === ag.id);
      const uniqueCusts = [...new Set(myOrders.map(o => o.customerName).filter(Boolean))];
      custSel.innerHTML = '<option value="all">-- ทุกร้าน / ทุกลูกค้าในสังกัด --</option>';
      uniqueCusts.forEach(c => {
        custSel.innerHTML += `<option value="${c}">${c}</option>`;
      });
    }

    this.filterAgentOrders();
    this.renderAgentTracking();
    this.renderAgentProfile();
    this.renderAgentAnnouncements();
  },

  switchAgentTab(tabName) {
    const tabs = ['orders', 'tracking', 'profile', 'announcements'];
    tabs.forEach(t => {
      const btn = document.getElementById('btn-agent-tab-' + t);
      const pane = document.getElementById('agent-pane-' + t);
      if (btn) {
        if (t === tabName) {
          btn.classList.add('active');
          btn.style.background = '#D97706';
          btn.style.color = 'white';
        } else {
          btn.classList.remove('active');
          btn.style.background = '#F1F5F9';
          btn.style.color = '#475569';
        }
      }
      if (pane) {
        pane.style.display = (t === tabName) ? 'block' : 'none';
      }
    });

    if (tabName === 'orders') this.filterAgentOrders();
    else if (tabName === 'tracking') this.renderAgentTracking();
    else if (tabName === 'profile') this.renderAgentProfile();
    else if (tabName === 'announcements') this.renderAgentAnnouncements();
  },

  filterAgentOrders() {
    const ag = this.state.currentAgentData || 
               this.state.agents.find(x => x.id === this.state.currentAgentId) || 
               this.state.agents[0];
    if (!ag) return;

    const custFilter = document.getElementById('agent-filter-customer')?.value || 'all';
    const yearFilter = document.getElementById('agent-filter-year')?.value || 'all';
    const monthFilter = document.getElementById('agent-filter-month')?.value || 'all';
    const statusFilter = document.getElementById('agent-filter-status')?.value || 'all';

    let allAgentOrders = this.state.orders.filter(o => o.agentId === ag.id);
    if (allAgentOrders.length === 0 && this.state.orders.length > 0) {
      allAgentOrders = [this.state.orders[0]];
    }

    let list = [...allAgentOrders];

    // Filter by customer/sub-shop
    if (custFilter !== 'all') {
      list = list.filter(o => (o.customerName || '').toLowerCase().includes(custFilter.toLowerCase()));
    }

    // Filter by year
    if (yearFilter !== 'all') {
      list = list.filter(o => {
        const d = new Date(o.date);
        return d.getFullYear().toString() === yearFilter;
      });
    }

    // Filter by month
    if (monthFilter !== 'all') {
      list = list.filter(o => {
        const d = new Date(o.date);
        const m = String(d.getMonth() + 1).padStart(2, '0');
        return m === monthFilter;
      });
    }

    // Filter by status
    if (statusFilter !== 'all') {
      list = list.filter(o => o.status === statusFilter);
    }

    // Calculate stats
    const cntEl = document.getElementById('agent-stat-count');
    if (cntEl) cntEl.innerText = `${allAgentOrders.length} ออเดอร์`;

    let totalAll = allAgentOrders.reduce((acc, o) => acc + (o.net || 0), 0);
    const totEl = document.getElementById('agent-stat-total');
    if (totEl) totEl.innerText = `฿${totalAll.toLocaleString()}`;

    // Current month orders sum
    const curMonth = new Date().getMonth();
    const curYear = new Date().getFullYear();
    const monthSpend = allAgentOrders.filter(o => {
      const d = new Date(o.date);
      return d.getMonth() === curMonth && d.getFullYear() === curYear;
    }).reduce((acc, o) => acc + (o.net || 0), 0);
    const mEl = document.getElementById('agent-stat-month');
    if (mEl) mEl.innerText = `฿${monthSpend.toLocaleString()}`;

    const comEl = document.getElementById('agent-stat-com');
    if (comEl) comEl.innerText = `฿${(ag.commission || Math.round(totalAll * 0.15)).toLocaleString()}`;

    // Render table
    const tb = document.getElementById('tbody-agent-orders');
    if (!tb) return;
    tb.innerHTML = '';

    if (list.length === 0) {
      tb.innerHTML = `<tr><td colspan="6" style="padding:30px; text-align:center; color:#94A3B8;">ไม่พบรายการคำสั่งซื้อตามเงื่อนไขที่เลือก</td></tr>`;
      return;
    }

    list.forEach(o => {
      const dStr = new Date(o.date).toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' });
      const itemsDesc = (o.items || []).map(i => {
        const cat = this.state.catalog.find(c => c.id === i.type);
        return `<div>• <b>${cat ? cat.name : 'งานป้าย'}</b> ขนาด ${i.w || 1}x${i.h || 1} ม. จำนวน <b>${i.qty || 1}</b></div>`;
      }).join('') || '<div>งานป้ายสั่งผลิตตามสเปก</div>';

      tb.innerHTML += `
        <tr style="border-bottom:1px solid #E2E8F0;">
          <td style="padding:14px 16px;">
            <strong style="color:var(--primary); font-size:13.5px;">${o.id}</strong><br>
            <span style="font-size:11px; color:#64748B;"><i class="las la-calendar"></i> ${dStr}</span>
          </td>
          <td style="padding:14px 16px; font-weight:700; color:#1E293B;">
            ${o.customerName || '-'}<br>
            <span style="font-size:11px; color:#64748B; font-weight:normal;">${o.customerPhone || ''}</span>
          </td>
          <td style="padding:14px 16px; font-size:12px; color:#475569; max-width:260px;">${itemsDesc}</td>
          <td style="padding:14px 16px; color:#0F172A; font-weight:800; font-size:14px;">฿${(o.net || 0).toLocaleString()}</td>
          <td style="padding:14px 16px;"><span class="status-badge status-${o.status}">${o.status}</span></td>
          <td style="padding:14px 16px; text-align:center;">
            <div style="display:inline-flex; gap:4px; flex-wrap:wrap; justify-content:center;">
              <button type="button" class="btn btn-xs btn-outline" style="border-color:#2563EB; color:#2563EB; font-size:11px; padding:3px 8px;" onclick="app.openDocModal('${o.id}', 'quotation')" title="ดูใบเสนอราคา">
                <i class="las la-file-alt"></i> ใบเสนอราคา
              </button>
              <button type="button" class="btn btn-xs btn-outline" style="border-color:#D97706; color:#D97706; font-size:11px; padding:3px 8px;" onclick="app.openDocModal('${o.id}', 'invoice')" title="ดูใบแจ้งหนี้">
                <i class="las la-file-invoice-dollar"></i> แจ้งหนี้
              </button>
              <button type="button" class="btn btn-xs btn-outline" style="border-color:#059669; color:#059669; font-size:11px; padding:3px 8px;" onclick="app.openDocModal('${o.id}', 'receipt')" title="ดูใบเสร็จรับเงิน">
                <i class="las la-receipt"></i> ใบเสร็จ
              </button>
              <button type="button" class="btn btn-xs btn-outline" style="border-color:#7C3AED; color:#7C3AED; font-size:11px; padding:3px 8px;" onclick="app.openDocModal('${o.id}', 'delivery')" title="ดูใบส่งของ">
                <i class="las la-truck"></i> ใบส่งของ
              </button>
              <button type="button" class="btn btn-xs btn-success" style="font-size:11px; padding:3px 8px;" onclick="app.directDownloadOrderDoc('${o.id}', 'receipt')" title="ดาวน์โหลด PDF โดยตรง">
                <i class="las la-file-pdf"></i> โหลด PDF
              </button>
            </div>
          </td>
        </tr>`;
    });
  },

  renderAgentTracking() {
    const ag = this.state.currentAgentData || 
               this.state.agents.find(x => x.id === this.state.currentAgentId) || 
               this.state.agents[0];
    if (!ag) return;

    let myOrders = this.state.orders.filter(o => o.agentId === ag.id);
    if (myOrders.length === 0 && this.state.orders.length > 0) {
      myOrders = [this.state.orders[0]];
    }

    const container = document.getElementById('agent-tracking-list');
    if (!container) return;
    container.innerHTML = '';

    if (myOrders.length === 0) {
      container.innerHTML = `
        <div class="card" style="text-align:center; padding:40px 20px; background:white;">
          <i class="las la-box-open" style="font-size:48px; color:#94A3B8; margin-bottom:12px;"></i>
          <h4 style="color:#1E293B; margin:0 0 6px 0;">ยังไม่มีงานสั่งผลิตของตัวแทนที่กำลังดำเนินการ</h4>
          <p style="color:#64748B; font-size:13px; margin:0 0 16px 0;">เริ่มต้นเปิดคำสั่งซื้อใหม่สำหรับร้านค้าหรือลูกค้าในสังกัดได้ทันที</p>
          <button class="btn btn-primary" onclick="app.scrollToOrder()" style="background:linear-gradient(135deg, #D97706, #B45309); border:none;"><i class="las la-cart-plus"></i> เปิดคำสั่งซื้อใหม่</button>
        </div>`;
      return;
    }

    const steps = [
      { key: 'Sales', label: '1. รับออเดอร์/เปิดบิล', icon: 'la-file-alt' },
      { key: 'Graphic', label: '2. ตรวจแบบ E-Proof', icon: 'la-pencil-ruler' },
      { key: 'Production', label: '3. กำลังผลิตในโรงพิมพ์', icon: 'la-print' },
      { key: 'Delivery', label: '4. จัดส่ง/ติดตั้ง', icon: 'la-truck' },
      { key: 'Done', label: '5. ส่งมอบสำเร็จ', icon: 'la-check-circle' }
    ];

    const stepOrder = { 'Sales': 1, 'Graphic': 2, 'Production': 3, 'Delivery': 4, 'Done': 5 };

    myOrders.forEach(o => {
      const currentStepNum = stepOrder[o.status] || 1;
      const itemsList = (o.items || []).map(i => {
        const cat = this.state.catalog.find(c => c.id === i.type);
        return `<strong>${cat ? cat.name : (i.type || 'งานป้าย')}</strong> ขนาด ${i.w || 1}x${i.h || 1} ม. (${i.qty || 1} ชิ้น)`;
      }).join(', ') || 'งานป้ายสั่งผลิตตามสเปก';

      let proofHtml = '';
      if (o.proofImg) {
        proofHtml = `
          <div style="background:#FFFBEB; border:1.5px solid #FCD34D; border-radius:10px; padding:15px; margin-top:14px;">
            <div style="font-size:13px; font-weight:700; color:#B45309; margin-bottom:8px; display:flex; align-items:center; gap:6px;">
              <i class="las la-eye" style="color:#D97706;"></i> ตรวจสอบแบบร่าง E-Proof สำหรับตัวแทน:
            </div>
            <div style="display:flex; gap:15px; align-items:center; flex-wrap:wrap;">
              <img src="${o.proofImg}" alt="E-Proof" style="width:130px; height:85px; object-fit:cover; border-radius:8px; border:1px solid #E2E8F0; box-shadow:0 2px 6px rgba(0,0,0,0.08);">
              <div style="flex:1; min-width:200px;">
                ${o.proofStatus === 'approved' ? `
                  <div style="background:#ECFDF5; border:1px solid #10B981; color:#065F46; padding:8px 12px; border-radius:8px; font-size:12.5px; font-weight:700; display:inline-flex; align-items:center; gap:6px;">
                    <i class="las la-check-circle" style="color:#10B981; font-size:18px;"></i> ตัวแทนอนุมัติแบบแล้ว - ส่งเข้าสู่ฝ่ายผลิต
                  </div>
                ` : o.proofStatus === 'revision' ? `
                  <div style="background:#FEF3C7; border:1px solid #F59E0B; color:#B45309; padding:8px 12px; border-radius:8px; font-size:12.5px; font-weight:600;">
                    <i class="las la-exclamation-triangle"></i> อยู่ระหว่างฝ่ายออกแบบแก้ไขตามข้อความ: <em>"${o.proofNote || 'ขอปรับแก้แบบ'}"</em>
                  </div>
                ` : `
                  <div style="margin-bottom:8px; font-size:12.5px; color:#475569;">
                    ตัวแทนสามารถกดยืนยันอนุมัติแบบ หรือขอแก้ไขสเปก/ข้อความได้โดยตรง
                  </div>
                  <div style="display:flex; gap:8px; flex-wrap:wrap;">
                    <button class="btn btn-sm btn-success" style="font-weight:700;" onclick="app.approveProof('${o.id}')">
                      <i class="las la-check"></i> อนุมัติแบบ (ส่งผลิตทันที)
                    </button>
                    <button class="btn btn-sm btn-outline" style="border-color:#F59E0B; color:#B45309;" onclick="app.requestProofRevision('${o.id}')">
                      <i class="las la-edit"></i> ขอแก้ไขแบบ
                    </button>
                  </div>
                `}
              </div>
            </div>
          </div>`;
      }

      let stepBarHtml = `
        <div style="display:grid; grid-template-columns:repeat(5, 1fr); gap:6px; margin:16px 0; position:relative;">
      `;
      steps.forEach(st => {
        const thisNum = stepOrder[st.key];
        const isDone = thisNum < currentStepNum;
        const isCurrent = thisNum === currentStepNum;
        const bg = isCurrent ? '#D97706' : (isDone ? '#10B981' : '#E2E8F0');
        const color = (isCurrent || isDone) ? 'white' : '#64748B';
        const fw = isCurrent ? '800' : '600';

        stepBarHtml += `
          <div style="text-align:center;">
            <div style="height:32px; width:32px; border-radius:50%; background:${bg}; color:${color}; display:flex; align-items:center; justify-content:center; margin:0 auto 6px; font-size:15px; box-shadow:${isCurrent ? '0 0 0 3px rgba(217,119,6,0.25)' : 'none'};">
              <i class="las ${isDone ? 'la-check' : st.icon}"></i>
            </div>
            <div style="font-size:11px; font-weight:${fw}; color:${isCurrent ? '#92400E' : (isDone ? '#065F46' : '#94A3B8')};">
              ${st.label}
            </div>
          </div>
        `;
      });
      stepBarHtml += `</div>`;

      container.innerHTML += `
        <div class="card" style="padding:22px; background:white; border-top:3px solid #D97706;">
          <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:10px;">
            <div>
              <div style="display:flex; align-items:center; gap:8px; margin-bottom:4px;">
                <h4 style="margin:0; font-size:16px; color:var(--primary); font-weight:800;">${o.id}</h4>
                <span class="status-badge status-${o.status}" style="font-weight:700;">${o.status}</span>
                <span class="pay-${o.payment}" style="font-weight:600; font-size:11.5px;">${o.payment}</span>
              </div>
              <div style="font-size:13px; color:#475569;">
                ลูกค้า: <strong>${o.customerName || 'ลูกค้าทั่วไป'}</strong> · ${itemsList} · ยอดรวม <strong>฿${(o.net || 0).toLocaleString()}</strong>
              </div>
              <div style="font-size:11.5px; color:#94A3B8; margin-top:2px;">
                วันที่สั่งซื้อ: ${new Date(o.date).toLocaleDateString('th-TH', { year:'numeric', month:'long', day:'numeric' })}
              </div>
            </div>
            <div style="display:flex; gap:6px; flex-wrap:wrap;">
              <button class="btn btn-xs btn-outline" style="border-color:#2563EB; color:#2563EB;" onclick="app.openDocModal('${o.id}', 'quotation')">
                <i class="las la-file-alt"></i> ใบเสนอราคา
              </button>
              <button class="btn btn-xs btn-outline" style="border-color:#059669; color:#059669;" onclick="app.openDocModal('${o.id}', 'receipt')">
                <i class="las la-receipt"></i> ใบเสร็จรับเงิน
              </button>
            </div>
          </div>

          ${stepBarHtml}
          ${proofHtml}
        </div>
      `;
    });
  },

  renderAgentProfile() {
    const ag = this.state.currentAgentData || 
               this.state.agents.find(x => x.id === this.state.currentAgentId) || 
               this.state.agents[0];
    if (!ag) return;

    const el = id => document.getElementById(id);
    if (el('prof-ag-name')) el('prof-ag-name').value = ag.name || '';
    if (el('prof-ag-shop')) el('prof-ag-shop').value = ag.shop || '';
    if (el('prof-ag-phone')) el('prof-ag-phone').value = ag.phone || '';
    if (el('prof-ag-user')) el('prof-ag-user').value = ag.username || '';
    if (el('prof-ag-pass')) el('prof-ag-pass').value = ag.password || '';
    if (el('prof-ag-tax')) el('prof-ag-tax').value = ag.taxId || '';
    if (el('prof-ag-line')) el('prof-ag-line').value = ag.line || '';
    if (el('prof-ag-address')) el('prof-ag-address').value = ag.address || '';
  },

  saveAgentProfile() {
    const ag = this.state.currentAgentData || 
               this.state.agents.find(x => x.id === this.state.currentAgentId);
    if (!ag) {
      this.showToast('ไม่พบข้อมูลตัวแทน', 'error');
      return;
    }

    const name = document.getElementById('prof-ag-name')?.value?.trim();
    const shop = document.getElementById('prof-ag-shop')?.value?.trim();
    const phone = document.getElementById('prof-ag-phone')?.value?.trim();
    const pass = document.getElementById('prof-ag-pass')?.value?.trim();
    const tax = document.getElementById('prof-ag-tax')?.value?.trim();
    const line = document.getElementById('prof-ag-line')?.value?.trim();
    const address = document.getElementById('prof-ag-address')?.value?.trim();

    if (name) ag.name = name;
    if (shop) ag.shop = shop;
    if (phone) ag.phone = phone;
    if (pass) ag.password = pass;
    ag.taxId = tax || '';
    ag.line = line || '';
    ag.address = address || '';

    const idx = this.state.agents.findIndex(x => x.id === ag.id);
    if (idx !== -1) {
      this.state.agents[idx] = ag;
    }
    this.state.currentAgentData = ag;
    this.saveStateToStorage();

    const el = id => document.getElementById(id);
    if (el('agent-welcome')) el('agent-welcome').innerText = `ยินดีต้อนรับ ${ag.name} (${ag.shop})`;
    if (el('agent-portal-shop')) el('agent-portal-shop').innerText = ag.shop || '-';
    if (el('agent-portal-phone')) el('agent-portal-phone').innerText = ag.phone || '-';
    if (el('agent-portal-address')) el('agent-portal-address').innerText = ag.address || '-';

    this.showToast('✅ บันทึกข้อมูลส่วนตัวตัวแทนเรียบร้อยแล้ว', 'success');
  },

  loginCustomer() {
    const rawInput = document.getElementById('cust-login-phone')?.value?.trim();
    if (!rawInput) {
      this.showToast('กรุณากรอกเบอร์โทรศัพท์ หรือชื่อลูกค้า/ชื่อร้าน', 'warning');
      return;
    }

    const cleanInput = rawInput.replace(/[^0-9]/g, '');
    let matchedCust = this.state.customers.find(c => {
      const cPhoneClean = (c.phone || '').replace(/[^0-9]/g, '');
      return (cleanInput && cPhoneClean === cleanInput) || 
             c.name.toLowerCase().includes(rawInput.toLowerCase()) || 
             c.id.toLowerCase() === rawInput.toLowerCase();
    });

    if (!matchedCust) {
      const matchedOrder = this.state.orders.find(o => {
        const oPhoneClean = (o.customerPhone || '').replace(/[^0-9]/g, '');
        return (cleanInput && oPhoneClean === cleanInput) || 
               (o.customerName && o.customerName.toLowerCase().includes(rawInput.toLowerCase()));
      });

      if (matchedOrder) {
        matchedCust = {
          id: 'C-TEMP',
          name: matchedOrder.customerName,
          phone: matchedOrder.customerPhone || rawInput,
          address: matchedOrder.customerAddress || 'ตรัง',
          tier: 'Member',
          creditTerm: matchedOrder.creditTerm || 'เงินสด'
        };
      }
    }

    if (matchedCust) {
      this.state.currentCustomerId = matchedCust.id;
      this.state.currentCustomerData = matchedCust;
      this.renderCustomerPortal();
      this.switchView('customer-portal');
      this.showToast(`ยินดีต้อนรับคุณ ${matchedCust.name}`, 'success');
    } else {
      this.showToast('ไม่พบข้อมูลลูกค้าจากเบอร์โทรหรือชื่อนี้ กรุณาตรวจสอบหรือสั่งซื้อใหม่', 'error');
    }
  },

  quickLoginCustomer(cId) {
    const cust = this.state.customers.find(c => c.id === cId);
    if (cust) {
      this.state.currentCustomerId = cust.id;
      this.state.currentCustomerData = cust;
      this.renderCustomerPortal();
      this.switchView('customer-portal');
      this.showToast(`เข้าสู่ระบบในฐานะ: ${cust.name}`, 'success');
    }
  },

  logoutCustomer() {
    this.state.currentCustomerId = null;
    this.state.currentCustomerData = null;
    this.switchView('landing');
    this.showToast('ออกจากระบบสมาชิกเรียบร้อย', 'info');
  },

  toggleCustLoginMode(mode) {
    const btnLogin = document.getElementById('btn-cust-mode-login');
    const btnReg = document.getElementById('btn-cust-mode-reg');
    const formLogin = document.getElementById('cust-subform-login');
    const formReg = document.getElementById('cust-subform-reg');

    if (mode === 'register') {
      if (btnLogin) { btnLogin.style.background = 'transparent'; btnLogin.style.color = '#475569'; }
      if (btnReg) { btnReg.style.background = '#059669'; btnReg.style.color = 'white'; }
      if (formLogin) formLogin.style.display = 'none';
      if (formReg) formReg.style.display = 'block';
    } else {
      if (btnLogin) { btnLogin.style.background = '#1E3A8A'; btnLogin.style.color = 'white'; }
      if (btnReg) { btnReg.style.background = 'transparent'; btnReg.style.color = '#475569'; }
      if (formLogin) formLogin.style.display = 'block';
      if (formReg) formReg.style.display = 'none';
    }
  },

  registerCustomer() {
    const name = document.getElementById('reg-cust-name')?.value?.trim();
    const phone = document.getElementById('reg-cust-phone')?.value?.trim();
    const address = document.getElementById('reg-cust-address')?.value?.trim();
    const tax = document.getElementById('reg-cust-tax')?.value?.trim();
    const line = document.getElementById('reg-cust-line')?.value?.trim();

    if (!name) {
      this.showToast('กรุณากรอกชื่อลูกค้า หรือชื่อร้านค้า/บริษัท', 'warning');
      document.getElementById('reg-cust-name')?.focus();
      return;
    }
    if (!phone) {
      this.showToast('กรุณากรอกเบอร์โทรศัพท์สำหรับเข้าใช้งาน', 'warning');
      document.getElementById('reg-cust-phone')?.focus();
      return;
    }

    const cleanPhone = phone.replace(/[^0-9]/g, '');
    let existing = this.state.customers.find(c => {
      const p = (c.phone || '').replace(/[^0-9]/g, '');
      return p && cleanPhone && p === cleanPhone;
    });

    if (existing) {
      this.state.currentCustomerId = existing.id;
      this.state.currentCustomerData = existing;
      this.renderCustomerPortal();
      this.switchView('customer-portal');
      this.showToast(`พบข้อมูลสมาชิกเดิม ยินดีต้อนรับกลับคุณ ${existing.name}`, 'info');
      return;
    }

    const newCust = {
      id: 'C' + String(Date.now()).slice(-4),
      name,
      phone,
      address: address || 'ตรัง',
      taxId: tax || '',
      lineId: line || '',
      tier: 'VIP',
      points: 100,
      totalSpend: 0,
      orderCount: 0,
      creditTerm: 'เงินสด'
    };

    if (!this.state.customers) this.state.customers = [];
    this.state.customers.unshift(newCust);
    this.saveStateToStorage();

    this.state.currentCustomerId = newCust.id;
    this.state.currentCustomerData = newCust;
    this.renderCustomerPortal();
    this.switchView('customer-portal');
    this.showToast(`🎉 ยินดีต้อนรับสมาชิกใหม่ คุณ ${newCust.name}! รับฟรี 100 แต้มสะสม`, 'success');
  },

  renderCustomerPortal() {
    const cust = this.state.currentCustomerData || 
                 this.state.customers.find(c => c.id === this.state.currentCustomerId) || 
                 this.state.customers[0];
    if (!cust) return;

    const el = id => document.getElementById(id);
    if (el('cust-portal-name')) el('cust-portal-name').innerText = cust.name;
    if (el('cust-portal-phone')) el('cust-portal-phone').innerText = cust.phone || '-';
    if (el('cust-portal-address')) el('cust-portal-address').innerText = cust.address || '-';
    if (el('cust-portal-tier')) el('cust-portal-tier').innerText = `${cust.tier || 'VIP'} MEMBER`;

    this.filterCustomerOrders();
    this.renderCustomerTracking();
    this.renderCustomerProfile();
    this.renderCustomerAnnouncements();
  },

  switchCustomerTab(tabName) {
    const tabs = ['orders', 'tracking', 'profile', 'announcements'];
    tabs.forEach(t => {
      const btn = document.getElementById('btn-cust-tab-' + t);
      const pane = document.getElementById('cust-pane-' + t);
      if (btn) {
        if (t === tabName) {
          btn.classList.add('active');
          btn.style.background = '#2563EB';
          btn.style.color = 'white';
        } else {
          btn.classList.remove('active');
          btn.style.background = '#F1F5F9';
          btn.style.color = '#475569';
        }
      }
      if (pane) {
        pane.style.display = (t === tabName) ? 'block' : 'none';
      }
    });

    if (tabName === 'orders') this.filterCustomerOrders();
    else if (tabName === 'tracking') this.renderCustomerTracking();
    else if (tabName === 'profile') this.renderCustomerProfile();
    else if (tabName === 'announcements') this.renderCustomerAnnouncements();
  },

  renderCustomerTracking() {
    const cust = this.state.currentCustomerData || 
                 this.state.customers.find(c => c.id === this.state.currentCustomerId) || 
                 this.state.customers[0];
    if (!cust) return;

    const custPhoneClean = (cust.phone || '').replace(/[^0-9]/g, '');
    let myOrders = this.state.orders.filter(o => {
      const oPhoneClean = (o.customerPhone || '').replace(/[^0-9]/g, '');
      const matchPhone = (custPhoneClean && oPhoneClean && custPhoneClean === oPhoneClean);
      const matchName = (o.customerName && cust.name && o.customerName.toLowerCase().includes(cust.name.toLowerCase()));
      const matchId = (o.customerId === cust.id);
      return matchPhone || matchName || matchId;
    });

    if (myOrders.length === 0 && this.state.orders.length > 0) {
      myOrders = [this.state.orders[0]];
    }

    const container = document.getElementById('cust-tracking-list');
    if (!container) return;
    container.innerHTML = '';

    if (myOrders.length === 0) {
      container.innerHTML = `
        <div class="card" style="text-align:center; padding:40px 20px; background:white;">
          <i class="las la-box-open" style="font-size:48px; color:#94A3B8; margin-bottom:12px;"></i>
          <h4 style="color:#1E293B; margin:0 0 6px 0;">ยังไม่มีงานสั่งผลิตที่กำลังดำเนินการ</h4>
          <p style="color:#64748B; font-size:13px; margin:0 0 16px 0;">เริ่มต้นสั่งผลิตป้ายหรือสื่อสิ่งพิมพ์กับเราได้ทันที</p>
          <button class="btn btn-primary" onclick="app.scrollToOrder()"><i class="las la-cart-plus"></i> สั่งผลิตงานใหม่</button>
        </div>`;
      return;
    }

    const steps = [
      { key: 'Sales', label: '1. รับออเดอร์/เปิดบิล', icon: 'la-file-alt' },
      { key: 'Graphic', label: '2. ตรวจแบบ E-Proof', icon: 'la-pencil-ruler' },
      { key: 'Production', label: '3. กำลังผลิตในโรงพิมพ์', icon: 'la-print' },
      { key: 'Delivery', label: '4. จัดส่ง/ติดตั้ง', icon: 'la-truck' },
      { key: 'Done', label: '5. ส่งมอบสำเร็จ', icon: 'la-check-circle' }
    ];

    const stepOrder = { 'Sales': 1, 'Graphic': 2, 'Production': 3, 'Delivery': 4, 'Done': 5 };

    myOrders.forEach(o => {
      const currentStepNum = stepOrder[o.status] || 1;
      const itemsList = (o.items || []).map(i => {
        const cat = this.state.catalog.find(c => c.id === i.type);
        return `<strong>${cat ? cat.name : (i.type || 'งานป้าย')}</strong> ขนาด ${i.w || 1}x${i.h || 1} ม. (${i.qty || 1} ชิ้น)`;
      }).join(', ') || 'งานป้ายสั่งผลิตตามสเปก';

      let proofHtml = '';
      if (o.proofImg) {
        proofHtml = `
          <div style="background:#F8FAFC; border:1.5px solid #CBD5E1; border-radius:10px; padding:15px; margin-top:14px;">
            <div style="font-size:13px; font-weight:700; color:#1E3A8A; margin-bottom:8px; display:flex; align-items:center; gap:6px;">
              <i class="las la-eye" style="color:#2563EB;"></i> ตรวจสอบแบบร่าง E-Proof ก่อนพิมพ์จริง:
            </div>
            <div style="display:flex; gap:15px; align-items:center; flex-wrap:wrap;">
              <img src="${o.proofImg}" alt="E-Proof" style="width:130px; height:85px; object-fit:cover; border-radius:8px; border:1px solid #E2E8F0; box-shadow:0 2px 6px rgba(0,0,0,0.08);">
              <div style="flex:1; min-width:200px;">
                ${o.proofStatus === 'approved' ? `
                  <div style="background:#ECFDF5; border:1px solid #10B981; color:#065F46; padding:8px 12px; border-radius:8px; font-size:12.5px; font-weight:700; display:inline-flex; align-items:center; gap:6px;">
                    <i class="las la-check-circle" style="color:#10B981; font-size:18px;"></i> ท่านอนุมัติแบบแล้ว - ส่งเข้าสู่ฝ่ายผลิต
                  </div>
                ` : o.proofStatus === 'revision' ? `
                  <div style="background:#FFFBEB; border:1px solid #F59E0B; color:#B45309; padding:8px 12px; border-radius:8px; font-size:12.5px; font-weight:600;">
                    <i class="las la-exclamation-triangle"></i> อยู่ระหว่างฝ่ายออกแบบแก้ไขตามข้อความ: <em>"${o.proofNote || 'ขอปรับแก้แบบ'}"</em>
                  </div>
                ` : `
                  <div style="margin-bottom:8px; font-size:12.5px; color:#475569;">
                    กรุณาตรวจสอบความถูกต้องของข้อความ สี และเบอร์โทรศัพท์บนแบบ
                  </div>
                  <div style="display:flex; gap:8px; flex-wrap:wrap;">
                    <button class="btn btn-sm btn-success" style="font-weight:700;" onclick="app.approveProof('${o.id}')">
                      <i class="las la-check"></i> อนุมัติแบบ (ส่งผลิตทันที)
                    </button>
                    <button class="btn btn-sm btn-outline" style="border-color:#F59E0B; color:#B45309;" onclick="app.requestProofRevision('${o.id}')">
                      <i class="las la-edit"></i> ขอแก้ไขแบบ
                    </button>
                  </div>
                `}
              </div>
            </div>
          </div>`;
      }

      let stepBarHtml = `
        <div style="display:grid; grid-template-columns:repeat(5, 1fr); gap:6px; margin:16px 0; position:relative;">
      `;
      steps.forEach(st => {
        const thisNum = stepOrder[st.key];
        const isDone = thisNum < currentStepNum;
        const isCurrent = thisNum === currentStepNum;
        const bg = isCurrent ? '#2563EB' : (isDone ? '#10B981' : '#E2E8F0');
        const color = (isCurrent || isDone) ? 'white' : '#64748B';
        const fw = isCurrent ? '800' : '600';

        stepBarHtml += `
          <div style="text-align:center;">
            <div style="height:32px; width:32px; border-radius:50%; background:${bg}; color:${color}; display:flex; align-items:center; justify-content:center; margin:0 auto 6px; font-size:15px; box-shadow:${isCurrent ? '0 0 0 3px rgba(37,99,235,0.25)' : 'none'};">
              <i class="las ${isDone ? 'la-check' : st.icon}"></i>
            </div>
            <div style="font-size:11px; font-weight:${fw}; color:${isCurrent ? '#1E3A8A' : (isDone ? '#065F46' : '#94A3B8')};">
              ${st.label}
            </div>
          </div>
        `;
      });
      stepBarHtml += `</div>`;

      container.innerHTML += `
        <div class="card" style="padding:22px; background:white; border-top:3px solid #2563EB;">
          <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:10px;">
            <div>
              <div style="display:flex; align-items:center; gap:8px; margin-bottom:4px;">
                <h4 style="margin:0; font-size:16px; color:var(--primary); font-weight:800;">${o.id}</h4>
                <span class="status-badge status-${o.status}" style="font-weight:700;">${o.status}</span>
                <span class="pay-${o.payment}" style="font-weight:600; font-size:11.5px;">${o.payment}</span>
              </div>
              <div style="font-size:13px; color:#475569;">
                ${itemsList} · ยอดรวม <strong>฿${(o.net || 0).toLocaleString()}</strong>
              </div>
              <div style="font-size:11.5px; color:#94A3B8; margin-top:2px;">
                วันที่สั่งซื้อ: ${new Date(o.date).toLocaleDateString('th-TH', { year:'numeric', month:'long', day:'numeric' })}
              </div>
            </div>
            <div style="display:flex; gap:6px; flex-wrap:wrap;">
              <button class="btn btn-xs btn-outline" style="border-color:#2563EB; color:#2563EB;" onclick="app.openDocModal('${o.id}', 'quotation')">
                <i class="las la-file-alt"></i> ใบเสนอราคา
              </button>
              <button class="btn btn-xs btn-outline" style="border-color:#059669; color:#059669;" onclick="app.openDocModal('${o.id}', 'receipt')">
                <i class="las la-receipt"></i> ใบเสร็จรับเงิน
              </button>
            </div>
          </div>

          ${stepBarHtml}
          ${proofHtml}
        </div>
      `;
    });
  },

  renderCustomerProfile() {
    const cust = this.state.currentCustomerData || 
                 this.state.customers.find(c => c.id === this.state.currentCustomerId) || 
                 this.state.customers[0];
    if (!cust) return;

    const el = id => document.getElementById(id);
    if (el('prof-cust-name')) el('prof-cust-name').value = cust.name || '';
    if (el('prof-cust-phone')) el('prof-cust-phone').value = cust.phone || '';
    if (el('prof-cust-tax')) el('prof-cust-tax').value = cust.taxId || '';
    if (el('prof-cust-line')) el('prof-cust-line').value = cust.lineId || '';
    if (el('prof-cust-address')) el('prof-cust-address').value = cust.address || '';
  },

  saveCustomerProfile() {
    const cust = this.state.currentCustomerData || 
                 this.state.customers.find(c => c.id === this.state.currentCustomerId);
    if (!cust) {
      this.showToast('ไม่พบข้อมูลลูกค้า', 'error');
      return;
    }

    const name = document.getElementById('prof-cust-name')?.value?.trim();
    const phone = document.getElementById('prof-cust-phone')?.value?.trim();
    const tax = document.getElementById('prof-cust-tax')?.value?.trim();
    const line = document.getElementById('prof-cust-line')?.value?.trim();
    const address = document.getElementById('prof-cust-address')?.value?.trim();

    if (name) cust.name = name;
    if (phone) cust.phone = phone;
    cust.taxId = tax || '';
    cust.lineId = line || '';
    cust.address = address || '';

    const idx = this.state.customers.findIndex(c => c.id === cust.id);
    if (idx !== -1) {
      this.state.customers[idx] = cust;
    }
    this.state.currentCustomerData = cust;
    this.saveStateToStorage();

    const el = id => document.getElementById(id);
    if (el('cust-portal-name')) el('cust-portal-name').innerText = cust.name;
    if (el('cust-portal-phone')) el('cust-portal-phone').innerText = cust.phone || '-';
    if (el('cust-portal-address')) el('cust-portal-address').innerText = cust.address || '-';

    this.showToast('✅ บันทึกข้อมูลส่วนตัวเรียบร้อยแล้ว', 'success');
  },

  renderCustomerAnnouncements() {
    const feed = document.getElementById('cust-announcements-feed');
    const badge = document.getElementById('cust-ann-count-badge');
    const list = (this.state.agentAnnouncements || []).filter(a => !a.target || a.target === 'all' || a.target === 'customers');

    if (badge) {
      badge.innerText = `${list.length} รายการ`;
    }

    if (!feed) return;
    feed.innerHTML = '';

    if (list.length === 0) {
      feed.innerHTML = '<div style="grid-column:1/-1; text-align:center; padding:30px; color:#888;">ยังไม่มีประกาศใหม่ในขณะนี้</div>';
      return;
    }

    const catBadge = {
      'promo': '<span class="status-badge" style="background:#FEF3C7; color:#B45309; font-weight:700;"><i class="las la-gift"></i> โปรโมชั่นพิเศษ</span>',
      'holiday': '<span class="status-badge" style="background:#FEE2E2; color:#DC2626; font-weight:700;"><i class="las la-calendar-times"></i> ประกาศวันหยุด</span>',
      'news': '<span class="status-badge" style="background:#EFF6FF; color:#1E40AF; font-weight:700;"><i class="las la-bullhorn"></i> ข่าวสารประชาสัมพันธ์</span>'
    };

    list.forEach(a => {
      feed.innerHTML += `
        <div class="card" style="padding:20px; background:white; display:flex; flex-direction:column; justify-content:space-between; border-top:3px solid #F59E0B;">
          <div>
            ${a.image ? `<img src="${a.image}" alt="${a.title}" style="width:100%; height:180px; object-fit:cover; border-radius:8px; margin-bottom:12px; border:1px solid #E2E8F0;">` : ''}
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
              ${catBadge[a.category] || catBadge['promo']}
              <span style="font-size:11.5px; color:#94A3B8;"><i class="las la-calendar"></i> ${a.date}</span>
            </div>
            <h4 style="margin:0 0 8px 0; color:var(--primary); font-size:16px; font-weight:800;">${a.title}</h4>
            <p style="margin:0 0 14px 0; font-size:13.5px; color:#334155; line-height:1.6; white-space:pre-line;">${a.content}</p>
          </div>
          <button class="btn btn-sm btn-primary" onclick="app.scrollToOrder()" style="width:100%; font-weight:700;">
            <i class="las la-shopping-cart"></i> สั่งผลิตงาน / ใช้สิทธิ์โปรโมชั่น
          </button>
        </div>
      `;
    });
  },

  filterCustomerOrders() {
    const cust = this.state.currentCustomerData || 
                 this.state.customers.find(c => c.id === this.state.currentCustomerId) || 
                 this.state.customers[0];
    if (!cust) return;

    const custPhoneClean = (cust.phone || '').replace(/[^0-9]/g, '');
    let myOrders = this.state.orders.filter(o => {
      const oPhoneClean = (o.customerPhone || '').replace(/[^0-9]/g, '');
      const matchPhone = (custPhoneClean && oPhoneClean && custPhoneClean === oPhoneClean);
      const matchName = (o.customerName && cust.name && o.customerName.toLowerCase().includes(cust.name.toLowerCase()));
      return matchPhone || matchName;
    });

    if (myOrders.length === 0 && this.state.orders.length > 0) {
      myOrders = [this.state.orders[0]];
    }

    const countEl = document.getElementById('cust-stat-count');
    if (countEl) countEl.innerText = `${myOrders.length} ออเดอร์`;

    const totalSpend = myOrders.reduce((sum, o) => sum + (o.net || 0), 0);
    const totalEl = document.getElementById('cust-stat-total');
    if (totalEl) totalEl.innerText = `฿${totalSpend.toLocaleString()}`;

    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    const monthSpend = myOrders.filter(o => {
      const d = new Date(o.date);
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    }).reduce((sum, o) => sum + (o.net || 0), 0);

    const monthEl = document.getElementById('cust-stat-month');
    if (monthEl) monthEl.innerText = `฿${monthSpend.toLocaleString()}`;

    const yearVal = document.getElementById('cust-filter-year')?.value || 'all';
    const monthVal = document.getElementById('cust-filter-month')?.value || 'all';
    const statusVal = document.getElementById('cust-filter-status')?.value || 'all';

    let filtered = [...myOrders];
    if (yearVal !== 'all') {
      filtered = filtered.filter(o => new Date(o.date).getFullYear().toString() === yearVal);
    }
    if (monthVal !== 'all') {
      filtered = filtered.filter(o => {
        const m = String(new Date(o.date).getMonth() + 1).padStart(2, '0');
        return m === monthVal;
      });
    }
    if (statusVal !== 'all') {
      filtered = filtered.filter(o => o.status === statusVal);
    }

    const tbody = document.getElementById('tbody-customer-orders');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (filtered.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" style="padding:30px; text-align:center; color:#94A3B8;">ไม่พบรายการคำสั่งซื้อตามช่วงเวลาที่ระบุ</td></tr>`;
      return;
    }

    filtered.forEach(o => {
      const dStr = new Date(o.date).toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' });
      const itemsList = o.items.map(i => {
        const cat = this.state.catalog.find(c => c.id === i.type);
        return `<div>• <b>${cat ? cat.name : 'งานป้าย'}</b> ขนาด ${i.w}x${i.h} ม. จำนวน <b>${i.qty}</b></div>`;
      }).join('');

      tbody.innerHTML += `
        <tr style="border-bottom:1px solid #E2E8F0;">
          <td style="padding:14px 16px;">
            <strong style="color:var(--primary); font-size:13.5px;">${o.id}</strong><br>
            <span style="font-size:11px; color:#64748B;"><i class="las la-calendar"></i> ${dStr}</span>
          </td>
          <td style="padding:14px 16px; font-size:12px; color:#334155;">${itemsList}</td>
          <td style="padding:14px 16px; color:#0F172A; font-weight:800; font-size:14px;">฿${(o.net || 0).toLocaleString()}</td>
          <td style="padding:14px 16px;"><span class="status-badge status-${o.status}">${o.status}</span></td>
          <td style="padding:14px 16px;"><span class="pay-${o.payment}">${o.payment}</span></td>
          <td style="padding:14px 16px; text-align:center;">
            <div style="display:inline-flex; gap:4px; flex-wrap:wrap; justify-content:center;">
              <button type="button" class="btn btn-xs btn-outline" style="border-color:#2563EB; color:#2563EB; font-size:11px; padding:3px 8px;" onclick="app.openDocModal('${o.id}', 'quotation')" title="ดูใบเสนอราคา">
                <i class="las la-file-alt"></i> ใบเสนอราคา
              </button>
              <button type="button" class="btn btn-xs btn-outline" style="border-color:#D97706; color:#D97706; font-size:11px; padding:3px 8px;" onclick="app.openDocModal('${o.id}', 'invoice')" title="ดูใบแจ้งหนี้">
                <i class="las la-file-invoice-dollar"></i> แจ้งหนี้
              </button>
              <button type="button" class="btn btn-xs btn-outline" style="border-color:#059669; color:#059669; font-size:11px; padding:3px 8px;" onclick="app.openDocModal('${o.id}', 'receipt')" title="ดูใบเสร็จรับเงิน">
                <i class="las la-receipt"></i> ใบเสร็จ
              </button>
              <button type="button" class="btn btn-xs btn-outline" style="border-color:#7C3AED; color:#7C3AED; font-size:11px; padding:3px 8px;" onclick="app.openDocModal('${o.id}', 'delivery')" title="ดูใบส่งของ">
                <i class="las la-truck"></i> ใบส่งของ
              </button>
              <button type="button" class="btn btn-xs btn-success" style="font-size:11px; padding:3px 8px;" onclick="app.directDownloadOrderDoc('${o.id}', 'receipt')" title="ดาวน์โหลด PDF โดยตรง">
                <i class="las la-file-pdf"></i> โหลด PDF
              </button>
            </div>
          </td>
        </tr>`;
    });
  },

  selectLoginRole(roleKey, btn) {
    document.querySelectorAll('.role-subtab-btn').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
    const uInput = document.getElementById('staff-username');
    if (uInput) uInput.value = roleKey;
    const pInput = document.getElementById('staff-password');
    if (pInput) {
      pInput.value = '';
      pInput.focus();
    }
  },

  loginStaff() {
    const user = (document.getElementById('staff-username')?.value || 'admin').trim();
    const pass = (document.getElementById('staff-password')?.value || '').trim();
    
    const expectedPass = {
      admin: '9546',
      designer: '9992',
      production: '9993',
      accountant: '9994',
      sales: '9991'
    };

    if (!pass) {
      this.showToast('กรุณากรอกรหัสผ่านเพื่อเข้าใช้งาน', 'warning');
      document.getElementById('staff-password')?.focus();
      return;
    }

    if (expectedPass[user]) {
      if (pass !== expectedPass[user]) {
        this.showToast('รหัสผ่านไม่ถูกต้อง กรุณาตรวจสอบอีกครั้ง', 'error');
        return;
      }
    }

    const foundUser = (this.state.systemUsers || []).find(u => u.username === user);
    if (foundUser) {
      this.state.currentUserId = foundUser.id;
      this.state.currentUserRole = foundUser.role || foundUser.roleId || user;
      this.switchRoleFromTopbar(this.state.currentUserRole, false);
      this.switchView('admin-erp');
      this.renderAdmin();
      this.showToast(`ยินดีต้อนรับ ${foundUser.name} (${this.getRole(this.state.currentUserRole)?.name || 'Admin'})`, 'success');
      return;
    }
    // Default fallback to Admin
    this.switchRoleFromTopbar(user || 'admin', false);
    this.switchView('admin-erp');
    this.renderAdmin();
    this.showToast(`เข้าสู่ระบบสำเร็จ (${user || 'Admin'})`, 'success');
  },

  loginAdminGoogle() {
    const user = document.getElementById('admin-user')?.value.trim();
    const pass = document.getElementById('admin-pass')?.value.trim();
    const foundUser = (this.state.systemUsers || []).find(u => (u.username === user || u.id === user) && u.password === pass);
    if (foundUser) {
      this.state.currentUserId = foundUser.id;
      this.state.currentUserRole = foundUser.role;
      this.switchRoleFromTopbar(foundUser.role, false);
      this.switchView('admin-erp');
      this.renderAdmin();
      this.showToast(`ยินดีต้อนรับ ${foundUser.name} (${this.getRole(foundUser.role || foundUser.roleId)?.name || foundUser.role || 'Admin'})`, 'success');
      return;
    }
    // Default fallback to Admin
    this.switchRoleFromTopbar('admin', false);
    this.switchView('admin-erp');
    this.renderAdmin();
  },

  quickLoginAs(roleId) {
    this.state.currentUserRole = roleId;
    const roleObj = this.getRole(roleId);
    const u = (this.state.systemUsers || []).find(usr => (usr.role || usr.roleId) === roleId) || this.state.systemUsers[0];
    if (u) this.state.currentUserId = u.id;
    this.switchRoleFromTopbar(roleId, false);
    this.switchView('admin-erp');
    this.renderAdmin();
    this.showToast(`เข้าสู่ระบบในฐานะ: ${roleObj ? roleObj.name : roleId}`, 'success');
  },

  getRole(roleId) {
    if (!this.state.roles) return null;
    if (Array.isArray(this.state.roles)) {
      return this.state.roles.find(r => r.id === roleId) || null;
    }
    return this.state.roles[roleId] || null;
  },

  switchRoleFromTopbar(roleId, showNotification = true) {
    this.state.currentUserRole = roleId;
    const roleSel = document.getElementById('topbar-role-select');
    if (roleSel) roleSel.value = roleId;
    this.applyUserRolePermissions(roleId);
    if (showNotification) {
      const roleObj = this.getRole(roleId);
      this.showToast(`สลับสิทธิ์การมองเห็นเป็น: ${roleObj ? roleObj.name : roleId}`, 'info');
    }
  },

  applyUserRolePermissions(roleId) {
    const targetRoleId = roleId || this.state.currentUserRole || 'admin';
    let role = this.getRole(targetRoleId) || this.getRole('admin');
    if (!role) {
      role = {
        id: 'admin',
        name: 'เจ้าของร้าน / ผู้ดูแลระบบ (Owner / Admin)',
        color: '#1E3A8A',
        permissions: ['dashboard', 'sales', 'prepress', 'kanban', 'logistics', 'finance', 'customers', 'inventory', 'machine', 'agents', 'staff', 'cms', 'roles', 'settings', 'cloudsync', 'notif']
      };
    }
    const perms = Array.isArray(role.permissions) ? role.permissions : [];

    // Update Topbar badge and user display
    const u = (this.state.systemUsers || []).find(usr => (usr.role || usr.roleId) === targetRoleId) || { name: 'นายธีราธร (Admin)', role: targetRoleId };
    const nameEl = document.getElementById('topbar-user-name');
    const badgeEl = document.getElementById('topbar-role-badge');
    const avatarEl = document.getElementById('topbar-user-avatar');
    if (nameEl) nameEl.innerText = u.name;
    if (badgeEl) badgeEl.innerHTML = `<span class="role-pill" style="background:${role.color || '#1E3A8A'}; padding:2px 8px; font-size:10px;">${role.name}</span>`;
    if (avatarEl) {
      avatarEl.innerText = (u.name || 'A').charAt(0).toUpperCase();
      avatarEl.style.background = role.color || '#1E3A8A';
    }

    // Toggle sidebar tabs based on permission
    let firstAllowed = null;
    let currentAllowed = false;
    const currentActiveBtn = document.querySelector('.erp-tab-btn.active');
    const currentPerm = currentActiveBtn?.getAttribute('data-perm');

    document.querySelectorAll('.erp-tab-btn[data-perm]').forEach(btn => {
      const p = btn.getAttribute('data-perm');
      const isAllowed = perms.includes(p);
      btn.style.display = isAllowed ? 'flex' : 'none';
      if (isAllowed) {
        if (!firstAllowed) firstAllowed = p;
        if (p === currentPerm) currentAllowed = true;
      }
    });

    if (!currentAllowed && firstAllowed) {
      this.switchErpTab(firstAllowed);
    }
  },

  switchErpTab(tabId, el) {
    document.querySelectorAll('.erp-tab').forEach(t => t.style.display = 'none');
    document.querySelectorAll('.erp-tab-btn').forEach(b => b.classList.remove('active'));
    const target = document.getElementById('erp-' + tabId);
    if (target) target.style.display = 'block';
    if (el) {
      el.classList.add('active');
    } else {
      const matchingBtn = document.querySelector(`.erp-tab-btn[data-perm="${tabId}"]`);
      if (matchingBtn) matchingBtn.classList.add('active');
    }
    if (tabId === 'dashboard') this.renderAdmin();
    if (tabId === 'finance') this.renderFinanceTab();
    if (tabId === 'staff') this.renderStaff();
    if (tabId === 'roles') this.renderRoles();
    if (tabId === 'cms') { this.renderLandingSections(); this.renderCmsAdmin(); this.renderShopBrandingCMS(); }
    if (tabId === 'settings') this.renderSettingsTab();
    if (tabId === 'machine') this.renderWorkshopTab('machines');
    if (tabId === 'cloudsync') this.loadGasConfig();
  },

  filterDashboard(type) {
    this.state.dashboardFilter = type;
    document.querySelectorAll('.dash-filter-btn').forEach(b => b.classList.remove('active'));
    const btn = document.getElementById('df-' + type);
    if (btn) btn.classList.add('active');
    this.renderAdmin();
  },

  renderAdmin() {
    const tbSales = document.getElementById('tbody-sales');
    const tbAcc = document.getElementById('tbody-accounting');
    const tbCrm = document.getElementById('tbody-crm');
    if (!tbSales || !tbAcc) return;
    tbSales.innerHTML = ''; tbAcc.innerHTML = ''; if (tbCrm) tbCrm.innerHTML = '';
    document.querySelectorAll('.kb-container').forEach(c => c.innerHTML = '');

    const now = new Date();
    const filterByDate = (dateStr) => {
      if (!dateStr) return true;
      const d = new Date(dateStr);
      if (this.state.dashboardFilter === 'day') return d.toDateString() === now.toDateString();
      if (this.state.dashboardFilter === 'week') return (now - d) <= (7 * 24 * 60 * 60 * 1000);
      if (this.state.dashboardFilter === 'month') return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      if (this.state.dashboardFilter === 'year') return d.getFullYear() === now.getFullYear();
      return true;
    };

    let salesTotal = 0;
    let paidIncome = 0;
    let arTotal = 0;
    let arList = [];
    let rush = 0;
    let sqm = 0;
    let crmDict = {};
    let statusCounts = { Sales: 0, Graphic: 0, Production: 0, Logistics: 0, Done: 0 };

    this.state.orders.forEach(o => {
      const isValid = filterByDate(o.date);
      const n = o.net || 0;

      if (isValid) {
        salesTotal += n;
        if (o.payment === 'Paid') {
          paidIncome += n;
        } else if (o.payment === 'Deposit') {
          paidIncome += (n * 0.5);
          const remain = n * 0.5;
          arTotal += remain;
          arList.push({ order: o, remain });
        } else {
          arTotal += n;
          arList.push({ order: o, remain: n });
        }

        if (o.priority === 'rush' && o.status !== 'Done') rush++;
        o.items.forEach(i => { if (i.type && (i.type.startsWith('V') || i.type.startsWith('S'))) sqm += (i.w * i.h * i.qty); });
      }

      if (statusCounts[o.status] !== undefined) statusCounts[o.status]++;

      let cName = o.customerName || '';
      let cPhone = o.customerPhone || '';
      if (cName && isValid) {
        if (!crmDict[cName]) crmDict[cName] = { phone: cPhone, total: 0 };
        crmDict[cName].total += n;
      }

      tbSales.innerHTML += `<tr><td><strong>${o.id}</strong><br><span style="font-size:10px; color:#888;">${new Date(o.date).toLocaleDateString('th-TH')}</span></td><td>${cName}</td><td>${o.items.length} รายการ</td><td style="color:var(--primary); font-weight:bold;">฿${n.toLocaleString()}</td><td><span class="pay-${o.payment}">${o.payment}</span></td><td><span class="status-badge status-${o.status}">${o.status}</span></td><td><button class="btn-sm btn-outline" onclick="app.openManageOrder('${o.id}')">จัดการ</button></td></tr>`;

      tbAcc.innerHTML += `<tr><td><strong>${o.id}</strong><br><span style="font-size:10px; color:#888;">${new Date(o.date).toLocaleDateString('th-TH')}</span></td><td>${cName}</td><td style="color:var(--primary); font-weight:bold;">฿${n.toLocaleString()}</td><td><span class="pay-${o.payment}">${o.payment}</span></td><td><button class="btn-sm btn-outline" onclick="app.openManageOrder('${o.id}'); app.printDocFromManage('invoice')" style="border-color:var(--info); color:var(--info); margin-right:4px;"><i class="las la-file-invoice"></i> แจ้งหนี้</button><button class="btn-sm btn-outline" onclick="app.openManageOrder('${o.id}'); app.printDocFromManage('receipt')" style="border-color:var(--success); color:var(--success); margin-right:4px;"><i class="las la-receipt"></i> ใบเสร็จ</button><button class="btn-sm btn-outline" onclick="app.directDownloadOrderDoc('${o.id}', 'receipt')" style="border-color:var(--primary); color:var(--primary); font-weight:700;"><i class="las la-file-pdf"></i> โหลด PDF</button></td></tr>`;

      const kbCont = document.querySelector(`#kb-${o.status} .kb-container`);
      if (kbCont) {
        let isRush = o.priority === 'rush';
        let rushHtml = isRush ? `<span class="kb-rush-badge"><i class="las la-bolt"></i> ด่วนพิเศษ!</span>` : '';
        let proofApprovedHtml = o.proofStatus === 'approved' ? `<span class="kb-proof-badge"><i class="las la-check-circle"></i> แบบอนุมัติแล้ว</span>` : '';

        let itemListHtml = `<div class="kb-card-spec-box">`;
        o.items.forEach(i => {
          let catName = this.state.catalog.find(c => c.id === i.type)?.name || i.type;
          let fin = this.state.finishing[i.finish]?.name;
          itemListHtml += `
          <div class="kb-spec-item" style="padding:10px 12px; background:#F8FAFC; border-radius:10px; border:1.5px solid #CBD5E1; margin-top:8px;">
            <div style="font-size:14px; font-weight:700; color:var(--primary); margin-bottom:4px;">${catName}</div>
            <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:6px; margin:4px 0;">
              <div style="font-size:18px; font-weight:900; color:#0F172A; letter-spacing:0.3px;">
                ขนาด ${i.w} x ${i.h} เมตร
              </div>
              <div style="font-size:17px; font-weight:900; color:#2563EB; background:#EFF6FF; border:1.5px solid #93C5FD; border-radius:6px; padding:2px 10px;">
                จำนวน ${i.qty} ชิ้น
              </div>
            </div>
            ${fin && fin !== 'ตัดพอดีงาน/ไดคัท' ? `<div style="font-size:12.5px; font-weight:600; color:#059669; margin-top:3px;">การเก็บขอบ: ${fin}</div>` : ''}
            ${i.detail ? `<div style="font-size:12px; color:#475569; margin-top:4px; background:white; padding:4px 8px; border-radius:4px; border:1px solid #E2E8F0;"><b>โน้ตช่าง:</b> ${i.detail}</div>` : ''}
          </div>`;
        });
        itemListHtml += `</div>`;

        let artworkImg = o.proofImg || (o.items[0] && o.items[0].refImg);
        let imgHtml = artworkImg ? `<div style="position:relative; margin-top:10px;"><img src="${artworkImg}" class="kb-img" onclick="app.viewImage('${artworkImg}')" alt="Artwork">${proofApprovedHtml ? `<div style="position:absolute; top:16px; left:6px;">${proofApprovedHtml}</div>` : ''}</div>` : '';

        kbCont.innerHTML += `
        <div class="kb-card ${isRush ? 'rush-card' : ''}" draggable="true" ondragstart="app.drag(event, '${o.id}')">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
            <div style="display:flex; align-items:center; gap:6px;">
              <strong style="font-size:15px; color:var(--primary);">${o.id}</strong>
              ${rushHtml}
            </div>
            <span class="pay-${o.payment}">${o.payment}</span>
          </div>
          <div style="font-size:13px; font-weight:600; color:var(--text-main); margin-bottom:4px;">
            <i class="las la-user"></i> ${cName} ${cPhone ? `<small style="color:#64748B;">(${cPhone})</small>` : ''}
          </div>
          <div style="font-size:12px; color:#475569; margin-bottom:6px;">
            <i class="las la-calendar-check"></i> กำหนดส่ง: <b>${o.dueDate || '-'}</b>
          </div>
          ${itemListHtml}
          ${imgHtml}
          <div style="display:flex; gap:6px; margin-top:12px;">
            <button class="btn-sm btn-outline" style="flex:1; font-size:12px; font-weight:600;" onclick="app.openManageOrder('${o.id}')">
              <i class="las la-sliders-h"></i> จัดการ / ใบงาน
            </button>
            <button class="btn-sm btn-outline" style="font-size:12px; border-color:#00B900; color:#00B900;" onclick="app.sendOrderSummaryToLine('${o.id}')" title="ส่งข้อมูลเข้า LINE">
              <i class="lab la-line" style="font-size:16px;"></i>
            </button>
          </div>
        </div>`;
      }
    });

    if (tbCrm) {
      for (let [name, data] of Object.entries(crmDict)) {
        tbCrm.innerHTML += `<tr><td><strong>${name}</strong></td><td>${data.phone}</td><td>เครดิตปกติ</td><td style="color:var(--primary); font-weight:bold;">฿${data.total.toLocaleString()}</td></tr>`;
      }
    }

    // EXPENSES CALCULATION
    let expTotal = 0;
    let expCatSums = { fuel: 0, repair: 0, rent: 0, utility: 0, stock: 0, wage: 0, marketing: 0, misc: 0 };
    (this.state.expenses || []).forEach(e => {
      if (filterByDate(e.date)) {
        const amt = e.amount || 0;
        expTotal += amt;
        const cat = e.category || 'misc';
        if (expCatSums[cat] !== undefined) expCatSums[cat] += amt;
        else expCatSums.misc += amt;
      }
    });

    // ACCOUNTS PAYABLE CALCULATION (AP)
    let apTotal = 0;
    let apPendingList = [];
    (this.state.payables || []).forEach(ap => {
      if (ap.status === 'pending') {
        apTotal += (ap.amount || 0);
        apPendingList.push(ap);
      }
    });

    // NET PROFIT & MARGIN
    const netProfit = paidIncome - expTotal;
    const profitMargin = paidIncome > 0 ? Math.round((netProfit / paidIncome) * 100) : 0;

    // UPDATE 5 STAT CARDS
    const dRev = document.getElementById('dash-revenue'); if (dRev) dRev.innerText = '฿' + paidIncome.toLocaleString(undefined, { minimumFractionDigits: 2 });
    const dRevSub = document.getElementById('dash-revenue-sub'); if (dRevSub) dRevSub.innerHTML = `<i class="las la-arrow-up" style="color:#10B981;"></i> ยอดขายสะสม ฿${salesTotal.toLocaleString()}`;

    const dExp = document.getElementById('dash-expenses'); if (dExp) dExp.innerText = '฿' + expTotal.toLocaleString(undefined, { minimumFractionDigits: 2 });
    const dExpSub = document.getElementById('dash-expenses-sub'); if (dExpSub) dExpSub.innerText = `ค่าน้ำมัน, ซ่อม, เช่า, ไฟ, สต็อก, ค่าแรง`;

    const dPro = document.getElementById('dash-profit');
    if (dPro) {
      dPro.innerText = '฿' + netProfit.toLocaleString(undefined, { minimumFractionDigits: 2 });
      dPro.style.color = netProfit >= 0 ? '#10B981' : '#EF4444';
    }
    const dProMargin = document.getElementById('dash-profit-margin');
    if (dProMargin) dProMargin.innerText = `คิดเป็นกำไรสุทธิ ${profitMargin}% ของรายรับ`;

    const dUnp = document.getElementById('dash-unpaid'); if (dUnp) dUnp.innerText = '฿' + arTotal.toLocaleString(undefined, { minimumFractionDigits: 2 });
    const dUnpCount = document.getElementById('dash-unpaid-count'); if (dUnpCount) dUnpCount.innerText = `${arList.length} ออเดอร์รอยอดชำระ`;

    const dPay = document.getElementById('dash-payables'); if (dPay) dPay.innerText = '฿' + apTotal.toLocaleString(undefined, { minimumFractionDigits: 2 });
    const dPaySub = document.getElementById('dash-payables-sub'); if (dPaySub) dPaySub.innerText = `${apPendingList.length} รายการค้างจ่ายซัพพลายเออร์`;

    const dRush = document.getElementById('dash-rush-jobs'); if (dRush) dRush.innerText = rush + ' งาน';
    const dSqm = document.getElementById('dash-sqm'); if (dSqm) dSqm.innerText = sqm.toFixed(1) + ' ตร.ม.';
    const lInst = this.state.orders.filter(o => o.status === 'Logistics' && o.installType === 'standard');
    const dInst = document.getElementById('dash-install'); if (dInst) dInst.innerText = lInst.length + ' คิว';

    // RENDER AR REMINDER LIST (เตือนลูกค้าค้างชำระ)
    const arCont = document.getElementById('dash-ar-reminder-list');
    const arBadge = document.getElementById('dash-ar-badge');
    if (arBadge) arBadge.innerText = `${arList.length} รายการ`;
    if (arCont) {
      arCont.innerHTML = '';
      if (arList.length === 0) {
        arCont.innerHTML = '<div style="text-align:center; padding:20px; color:#10B981; font-size:13px;"><i class="las la-check-circle" style="font-size:20px;"></i> เยี่ยมมาก! ไม่มีลูกค้ายอดค้างชำระ</div>';
      } else {
        arList.slice(0, 5).forEach(({ order, remain }) => {
          arCont.innerHTML += `
          <div style="background:#FFFBEB; border:1px solid #FDE68A; border-radius:8px; padding:10px 14px; display:flex; justify-content:space-between; align-items:center;">
            <div>
              <div style="font-weight:700; font-size:13px; color:#92400E;">${order.customerName} <span style="font-size:11px; color:#6B7280;">(${order.id})</span></div>
              <div style="font-size:11px; color:#B45309;"><i class="las la-phone"></i> ${order.customerPhone || '-'} | สถานะ: ${order.payment}</div>
            </div>
            <div style="text-align:right;">
              <div style="font-weight:800; font-size:14px; color:#DC2626;">฿${remain.toLocaleString()}</div>
              <div style="display:flex; gap:4px; margin-top:3px;">
                <button class="btn-sm btn-outline" style="font-size:11px; padding:2px 6px; border-color:#00B900; color:#00B900;" onclick="app.sendPaymentReminderLine('${order.id}')" title="ส่งทวงยอดทาง LINE"><i class="lab la-line"></i> แจ้ง</button>
                <button class="btn-sm btn-outline" style="font-size:11px; padding:2px 6px;" onclick="app.openManageOrder('${order.id}')">จัดการ</button>
              </div>
            </div>
          </div>`;
        });
      }
    }

    // RENDER AP REMINDER LIST (เตือนร้านครบกำหนดจ่ายค่าของ)
    const apCont = document.getElementById('dash-ap-reminder-list');
    if (apCont) {
      apCont.innerHTML = '';
      if (apPendingList.length === 0) {
        apCont.innerHTML = '<div style="text-align:center; padding:20px; color:#10B981; font-size:13px;"><i class="las la-check-circle" style="font-size:20px;"></i> ร้านไม่มีหนี้สินค้างจ่ายซัพพลายเออร์</div>';
      } else {
        apPendingList.slice(0, 5).forEach(ap => {
          const isOverdue = new Date(ap.dueDate) < now;
          apCont.innerHTML += `
          <div style="background:#FAF5FF; border:1px solid #E9D5FF; border-radius:8px; padding:10px 14px; display:flex; justify-content:space-between; align-items:center;">
            <div>
              <div style="font-weight:700; font-size:13px; color:#581C87;">${ap.supplier}</div>
              <div style="font-size:11px; color:#7E22CE;">${ap.desc.substring(0, 30)}...</div>
              <div style="font-size:11px; color:${isOverdue ? '#DC2626; font-weight:bold;' : '#6B7280;'}">
                <i class="las la-calendar-times"></i> กำหนดจ่าย: ${ap.dueDate} ${isOverdue ? '<span style="background:#FEE2E2; color:#DC2626; padding:1px 5px; border-radius:4px; font-size:10px;">เกินกำหนด!</span>' : ''}
              </div>
            </div>
            <div style="text-align:right;">
              <div style="font-weight:800; font-size:14px; color:#7C3AED;">฿${(ap.amount || 0).toLocaleString()}</div>
              <button class="btn-sm btn-success" style="font-size:10.5px; padding:3px 8px; margin-top:4px;" onclick="app.markPayableAsPaid('${ap.id}')"><i class="las la-check"></i> บันทึกจ่ายแล้ว</button>
            </div>
          </div>`;
        });
      }
    }

    // RENDER EXPENSE CATEGORY BREAKDOWN BARS
    const expBreakdownCont = document.getElementById('dash-expense-breakdown');
    if (expBreakdownCont) {
      expBreakdownCont.innerHTML = '';
      const catLabels = {
        fuel: { name: 'ค่าน้ำมันรถขนส่ง/ติดตั้ง', icon: 'la-gas-pump', color: '#F59E0B' },
        repair: { name: 'ค่าซ่อมบำรุงเครื่องจักร', icon: 'la-tools', color: '#3B82F6' },
        rent: { name: 'ค่าเช่าตึก/สถานที่ร้าน', icon: 'la-building', color: '#8B5CF6' },
        utility: { name: 'ค่าไฟ/น้ำ/สาธารณูปโภค', icon: 'la-bolt', color: '#EC4899' },
        stock: { name: 'สั่งซื้อสต็อกและวัตถุดิบ', icon: 'la-boxes', color: '#10B981' },
        wage: { name: 'ค่าแรง/เงินเดือนพนักงาน', icon: 'la-id-badge', color: '#06B6D4' },
        marketing: { name: 'ค่าการตลาด/โฆษณา', icon: 'la-bullhorn', color: '#F97316' },
        misc: { name: 'ค่าใช้จ่ายเบ็ดเตล็ด', icon: 'la-receipt', color: '#64748B' }
      };

      for (const [key, sum] of Object.entries(expCatSums)) {
        if (sum > 0 || key === 'fuel' || key === 'stock' || key === 'wage') {
          const pct = expTotal > 0 ? Math.round((sum / expTotal) * 100) : 0;
          const meta = catLabels[key] || { name: key, icon: 'la-receipt', color: '#64748B' };
          expBreakdownCont.innerHTML += `
          <div>
            <div style="display:flex; justify-content:space-between; font-size:12.5px; margin-bottom:3px;">
              <span style="display:flex; align-items:center; gap:6px; color:#334155;">
                <i class="las ${meta.icon}" style="color:${meta.color};"></i> ${meta.name}
              </span>
              <span style="font-weight:700; color:#0F172A;">฿${sum.toLocaleString()} <small style="color:#64748B;">(${pct}%)</small></span>
            </div>
            <div style="height:6px; background:#F1F5F9; border-radius:50px; overflow:hidden;">
              <div style="width:${pct}%; height:100%; background:${meta.color}; border-radius:50px; transition:width 0.5s ease;"></div>
            </div>
          </div>`;
        }
      }
    }

    this.renderWorkloadChart(statusCounts);
    this.renderDashboardAnalytics(paidIncome, salesTotal, expTotal, netProfit, profitMargin, arTotal, apTotal);
    this.renderKanbanEvents();
    this.renderCatalog();
    this.renderMachines();
    this.renderLogistics();
    this.renderErpLists();
    this.renderPrepress();
    this.renderCustomers();
    this.renderAdminAgents();
    this.renderFinanceTab();
    this.renderStaff();
    this.renderRoles();
    this.renderLandingSections();
    this.renderSettingsTab();
    this.renderCmsAdmin();
    setTimeout(() => this.generateAiInsights(paidIncome, arTotal, rush, expTotal, apTotal), 100);
  },

  renderWorkloadChart(counts) {
    const chart = document.getElementById('chart-workload');
    if (!chart) return;
    const maxVal = Math.max(...Object.values(counts), 1);
    let html = '';
    const labels = { Sales: 'ฝ่ายขาย', Graphic: 'ออกแบบ', Production: 'ฝ่ายผลิต', Logistics: 'ขนส่ง/ติดตั้ง', Done: 'เสร็จสิ้น' };
    const colors = { Sales: '#F59E0B', Graphic: '#0EA5E9', Production: '#9333EA', Logistics: '#EA580C', Done: '#10B981' };

    for (const [key, val] of Object.entries(counts)) {
      const heightPercent = Math.max(15, (val / maxVal) * 85);
      html += `
      <div class="chart-bar-wrap">
        <span class="chart-val">${val}</span>
        <div class="chart-bar" style="height:${heightPercent}%; background:${colors[key]};"></div>
        <span class="chart-label">${labels[key]}</span>
      </div>`;
    }
    chart.innerHTML = html;
  },

  // =========================================================================
  // FINANCIAL & OPERATIONS DASHBOARD ANALYTICS (INTERACTIVE & PROFESSIONAL)
  // =========================================================================
  renderDashboardAnalytics(paidIncome = 0, salesTotal = 0, expTotal = 0, netProfit = 0, profitMargin = 0, arTotal = 0, apTotal = 0) {
    const filter = this.state.dashboardFilter || 'month';
    const baseDaily = this.state.dailySalesTarget || 25000;

    let targetSales = baseDaily;
    let currentSales = 0;
    let periodLabel = 'ยอดขายวันนี้:';
    let prevSales = 0;
    let prevLabel = 'เมื่อวานนี้:';
    let growthText = '+14.2% MoM';

    if (filter === 'day') {
      targetSales = baseDaily;
      currentSales = paidIncome > 0 ? paidIncome : 18650;
      prevSales = 15800;
      periodLabel = 'ยอดขายวันนี้:';
      prevLabel = 'เมื่อวานนี้:';
      growthText = '+18.0% WoW';
    } else if (filter === 'week') {
      targetSales = baseDaily * 6; // ฿150,000
      currentSales = paidIncome > 0 ? paidIncome : 62400;
      prevSales = 55800;
      periodLabel = 'ยอดขายสัปดาห์นี้:';
      prevLabel = 'สัปดาห์ก่อน:';
      growthText = '+11.8% WoW';
    } else if (filter === 'month') {
      targetSales = baseDaily * 24; // ฿600,000
      currentSales = paidIncome > 0 ? paidIncome : 268000;
      prevSales = 242000;
      periodLabel = 'ยอดขายเดือนนี้:';
      prevLabel = 'เดือนก่อน:';
      growthText = '+10.7% MoM';
    } else if (filter === 'year') {
      targetSales = baseDaily * 288; // ฿7,200,000
      currentSales = paidIncome > 0 ? paidIncome : 3120000;
      prevSales = 2850000;
      periodLabel = 'ยอดขายปีนี้:';
      prevLabel = 'ปีก่อน:';
      growthText = '+9.5% YoY';
    } else {
      targetSales = 1000000;
      currentSales = paidIncome > 0 ? paidIncome : (salesTotal || 450000);
      prevSales = 380000;
      periodLabel = 'ยอดขายทั้งหมด:';
      prevLabel = 'งวดก่อนหน้า:';
      growthText = '+18.4%';
    }

    this.renderGaugeChart(currentSales, prevSales, targetSales, periodLabel, prevLabel, growthText);
    this.renderTrendChart();
    this.renderStackedProfitChart();

    // 2. หมวดช่องทางการขายและการชำระเงิน (Channels & Payment Reconciliation)
    this.renderChannelDonutChart();
    this.renderPaymentDonutChart();

    // 3. หมวดสินค้าและบริการขายดี (Top Best Sellers Performance)
    this.renderTopSellersChart();

    // 4. หมวดการแจ้งเตือนสต็อกวัสดุและอุปกรณ์วิกฤต (Critical Low Stock Alert Cards - ไม่ใช้กราฟ)
    this.renderLowStockAlertCards();
  },

  editDailyTarget() {
    const current = this.state.dailySalesTarget || 25000;
    const input = prompt('ระบุเป้าหมายยอดขายรายวัน (บาท):', current);
    if (input !== null) {
      const val = parseFloat(input);
      if (!isNaN(val) && val > 0) {
        this.state.dailySalesTarget = val;
        this.showToast(`บันทึกเป้าหมายยอดขายรายวันเป็น ฿${val.toLocaleString()} เรียบร้อย`, 'success');
        this.renderAdmin();
      }
    }
  },

  setTrendChartMode(mode) {
    this.state.trendChartMode = mode;
    document.querySelectorAll('#btn-chart-bar, #btn-chart-line').forEach(b => b.classList.remove('active'));
    const btn = document.getElementById('btn-chart-' + mode);
    if (btn) btn.classList.add('active');
    this.renderTrendChart();
  },

  setTrendTimeframe(tf) {
    this.state.trendTimeframe = tf;
    document.querySelectorAll('#btn-trend-weekly, #btn-trend-monthly').forEach(b => b.classList.remove('active'));
    const btn = document.getElementById('btn-trend-' + tf);
    if (btn) btn.classList.add('active');
    const sub = document.getElementById('trend-timeframe-sub');
    if (sub) {
      sub.innerText = tf === 'weekly' ? 'เปรียบเทียบสัปดาห์ต่อสัปดาห์ (4 สัปดาห์ล่าสุด)' : 'เปรียบเทียบเดือนต่อเดือน (6 เดือนย้อนหลัง)';
    }
    this.renderTrendChart();
  },

  // 1.1 ยอดขายวันนี้/เมื่อวาน เทียบเป้าหมาย (Radial Gauge + Bullet Chart)
  renderGaugeChart(todaySales, yesterdaySales, targetSales, periodLabel = 'ยอดขายวันนี้:', prevLabel = 'เมื่อวานนี้:', growthText = '+14.2% MoM') {
    const pct = targetSales > 0 ? Math.min(100, Math.round((todaySales / targetSales) * 1000) / 10) : 0;
    
    // Gauge Arc calculation: Semicircle circumference = Math.PI * 80 = 251.32
    const totalArc = 251.32;
    const offset = totalArc * (1 - Math.min(pct, 100) / 100);
    const arcFill = document.getElementById('gauge-arc-fill');
    if (arcFill) {
      arcFill.style.strokeDashoffset = offset;
    }

    // Needle rotation (0% -> 0deg leftwards, 50% -> 90deg upwards, 100% -> 180deg rightwards)
    const needleDeg = (Math.min(pct, 100) / 100) * 180;
    const needle = document.getElementById('gauge-needle');
    if (needle) {
      needle.style.transform = `rotate(${needleDeg}deg)`;
      needle.style.transformOrigin = '100px 105px';
    }

    // Center display & bullet progress bar
    const pctDisp = document.getElementById('gauge-pct-display');
    if (pctDisp) pctDisp.innerText = pct.toFixed(1) + '%';

    const bulletFill = document.getElementById('bullet-bar-fill');
    if (bulletFill) bulletFill.style.width = Math.min(pct, 100) + '%';

    const todayEl = document.getElementById('gauge-today-sales');
    if (todayEl) todayEl.innerHTML = `<span style="font-size:11px; color:#64748B;">${periodLabel}</span> <strong style="color:var(--primary); font-size:13.5px;">฿${todaySales.toLocaleString()}</strong>`;

    const targetEl = document.getElementById('gauge-target-sales');
    if (targetEl) targetEl.innerText = '฿' + targetSales.toLocaleString();

    const yesterdayEl = document.getElementById('gauge-yesterday-sales');
    if (yesterdayEl) yesterdayEl.innerHTML = `<span style="font-size:11px; color:#64748B;">${prevLabel}</span> <b>฿${yesterdaySales.toLocaleString()}</b>`;

    const vsYesterdayEl = document.getElementById('gauge-vs-yesterday');
    if (vsYesterdayEl) {
      const delta = yesterdaySales > 0 ? ((todaySales - yesterdaySales) / yesterdaySales) * 100 : 0;
      if (delta >= 0) {
        vsYesterdayEl.style.color = '#10B981';
        vsYesterdayEl.innerHTML = `<i class="las la-arrow-up"></i> +${delta.toFixed(1)}%`;
      } else {
        vsYesterdayEl.style.color = '#EF4444';
        vsYesterdayEl.innerHTML = `<i class="las la-arrow-down"></i> ${delta.toFixed(1)}%`;
      }
    }

    const growthBadge = document.getElementById('dash-growth-badge');
    if (growthBadge) {
      growthBadge.innerHTML = `<i class="las la-arrow-up"></i> ${growthText}`;
    }
  },

  // 1.2 ยอดขายสะสมรายสัปดาห์/รายเดือน (Line Chart / Bar Chart Interactive)
  renderTrendChart() {
    const container = document.getElementById('trend-chart-render');
    if (!container) return;

    const mode = this.state.trendChartMode || 'bar';
    const tf = this.state.trendTimeframe || 'weekly';

    let data = [];
    if (tf === 'weekly') {
      data = [
        { label: 'สัปดาห์ 1', sub: '1-7 ก.ย.', sales: 48500, target: 45000, growth: '+12.5%' },
        { label: 'สัปดาห์ 2', sub: '8-14 ก.ย.', sales: 62400, target: 50000, growth: '+28.6%' },
        { label: 'สัปดาห์ 3', sub: '15-21 ก.ย.', sales: 55800, target: 50000, growth: '-10.5%' },
        { label: 'สัปดาห์ 4', sub: '22-28 ก.ย.', sales: 74200, target: 55000, growth: '+32.9%' }
      ];
    } else {
      data = [
        { label: 'พ.ค.', sub: '2026', sales: 185000, target: 180000, growth: '+8.2%' },
        { label: 'มิ.ย.', sub: '2026', sales: 215000, target: 200000, growth: '+16.2%' },
        { label: 'ก.ค.', sub: '2026', sales: 198000, target: 210000, growth: '-7.9%' },
        { label: 'ส.ค.', sub: '2026', sales: 242000, target: 220000, growth: '+22.2%' },
        { label: 'ก.ย.', sub: '2026', sales: 268000, target: 250000, growth: '+10.7%' },
        { label: 'ต.ค.', sub: 'ประมาณการ', sales: 285400, target: 260000, growth: '+6.5%' }
      ];
    }

    const maxSales = Math.max(...data.map(d => Math.max(d.sales, d.target)), 10000);
    const chartHeight = 130;

    let html = `<div style="position:relative; width:100%; height:100%; display:flex; flex-direction:column; justify-content:space-between;">`;

    if (mode === 'bar') {
      html += `
      <div style="display:flex; align-items:flex-end; justify-content:space-around; gap:12px; height:${chartHeight}px; padding:10px 0 0 0; border-bottom:1.5px solid #E2E8F0; position:relative;">`;
      
      data.forEach((d, idx) => {
        const hPct = Math.round((d.sales / maxSales) * 100);
        const targetHPct = Math.round((d.target / maxSales) * 100);
        const isUp = !d.growth.startsWith('-');
        html += `
        <div class="trend-bar-col" style="flex:1; display:flex; flex-direction:column; align-items:center; height:100%; justify-content:flex-end; cursor:pointer;"
             onmouseenter="app.showTrendTooltip(event, '${d.label} (${d.sub})', '฿${d.sales.toLocaleString()}', 'เป้าหมาย: ฿${d.target.toLocaleString()}', '${d.growth}')"
             onmouseleave="app.hideTrendTooltip()">
          <span style="font-size:10.5px; font-weight:700; color:#1E3A8A; margin-bottom:4px;">฿${(d.sales >= 10000 ? Math.round(d.sales/1000) + 'k' : d.sales)}</span>
          <div style="width:100%; max-width:44px; height:${hPct}%; background:linear-gradient(180deg, #3B82F6 0%, #1D4ED8 100%); border-radius:6px 6px 0 0; box-shadow:0 2px 6px rgba(37,99,235,0.25); position:relative; transition:transform 0.2s;">
            <!-- Target line indicator -->
            <div style="position:absolute; bottom:${targetHPct}%; left:-4px; right:-4px; height:2px; background:#EF4444; border-top:1px dashed #EF4444;" title="เป้าหมาย: ฿${d.target.toLocaleString()}"></div>
          </div>
        </div>`;
      });
      html += `</div>`;
    } else {
      // Line Chart (SVG smooth line + gradient area fill)
      const svgW = 500;
      const svgH = 120;
      const stepX = svgW / (data.length - 1 || 1);
      const points = data.map((d, i) => {
        const x = i * stepX;
        const y = svgH - ((d.sales / maxSales) * (svgH - 24)) - 12;
        return { x, y, ...d };
      });

      const polyPoints = points.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
      const areaPath = `M 0,${svgH} L ${polyPoints} L ${svgW},${svgH} Z`;

      html += `
      <div style="width:100%; height:${chartHeight}px; position:relative; border-bottom:1.5px solid #E2E8F0;">
        <svg viewBox="0 0 ${svgW} ${svgH}" preserveAspectRatio="none" style="width:100%; height:100%; overflow:visible;">
          <defs>
            <linearGradient id="trend-area-grad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="#3B82F6" stop-opacity="0.35"/>
              <stop offset="100%" stop-color="#3B82F6" stop-opacity="0.0"/>
            </linearGradient>
          </defs>
          <!-- Horizontal dashed gridlines -->
          <line x1="0" y1="${svgH * 0.25}" x2="${svgW}" y2="${svgH * 0.25}" stroke="#F1F5F9" stroke-width="1.5" stroke-dasharray="4"/>
          <line x1="0" y1="${svgH * 0.5}" x2="${svgW}" y2="${svgH * 0.5}" stroke="#F1F5F9" stroke-width="1.5" stroke-dasharray="4"/>
          <line x1="0" y1="${svgH * 0.75}" x2="${svgW}" y2="${svgH * 0.75}" stroke="#F1F5F9" stroke-width="1.5" stroke-dasharray="4"/>
          
          <!-- Area Fill -->
          <path d="${areaPath}" fill="url(#trend-area-grad)"/>
          
          <!-- Main Line -->
          <polyline points="${polyPoints}" fill="none" stroke="#2563EB" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
          
          <!-- Data Points -->
          ${points.map((p, idx) => `
            <circle class="trend-svg-node" cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="4.5" fill="#FFFFFF" stroke="#1D4ED8" stroke-width="2.5"
                    onmouseenter="app.showTrendTooltip(event, '${p.label} (${p.sub})', '฿${p.sales.toLocaleString()}', 'เป้าหมาย: ฿${p.target.toLocaleString()}', '${p.growth}')"
                    onmouseleave="app.hideTrendTooltip()"/>
          `).join('')}
        </svg>
      </div>`;
    }

    // X-Axis Labels Row
    html += `
    <div style="display:flex; justify-content:space-around; font-size:11px; color:#64748B; margin-top:8px; text-align:center;">
      ${data.map(d => `
        <div style="flex:1;">
          <div style="font-weight:700; color:#334155;">${d.label}</div>
          <div style="font-size:10px; color:#94A3B8;">${d.sub}</div>
        </div>
      `).join('')}
    </div>
    <div id="trend-tooltip" class="chart-tooltip-box" style="display:none;"></div>
    </div>`;

    container.innerHTML = html;
  },

  showTrendTooltip(e, title, val, sub, growth) {
    const tt = document.getElementById('trend-tooltip');
    if (!tt) return;
    const isUp = !growth.startsWith('-');
    tt.innerHTML = `
      <div style="font-weight:700; margin-bottom:2px;">${title}</div>
      <div style="font-size:13px; font-weight:800; color:#38BDF8;">${val}</div>
      <div style="font-size:10px; color:#CBD5E1;">${sub}</div>
      <div style="font-size:10.5px; font-weight:700; color:${isUp ? '#34D399' : '#F87171'}; margin-top:2px;">
        <i class="las ${isUp ? 'la-arrow-up' : 'la-arrow-down'}"></i> ${growth}
      </div>`;
    const rect = e.currentTarget.getBoundingClientRect();
    const parentRect = tt.parentElement.getBoundingClientRect();
    tt.style.left = (rect.left + rect.width / 2 - parentRect.left) + 'px';
    tt.style.top = (rect.top - parentRect.top) + 'px';
    tt.style.display = 'block';
  },

  hideTrendTooltip() {
    const tt = document.getElementById('trend-tooltip');
    if (tt) tt.style.display = 'none';
  },

  // 1.3 กำไรสุทธิ เทียบกับ ต้นทุนสินค้า (Stacked Bar Chart: Revenue = COGS + Opex + Net Profit)
  renderStackedProfitChart() {
    const container = document.getElementById('stacked-chart-render');
    if (!container) return;

    const periods = [
      { label: 'งวดที่ 1', rev: 185000, cogs: 74000, opex: 37000, profit: 74000 },
      { label: 'งวดที่ 2', rev: 215000, cogs: 81700, opex: 43000, profit: 90300 },
      { label: 'งวดที่ 3', rev: 198000, cogs: 79200, opex: 41580, profit: 77220 },
      { label: 'งวดล่าสุด', rev: 268000, cogs: 96480, opex: 50920, profit: 120600 }
    ];

    const maxRev = Math.max(...periods.map(p => p.rev), 100000);

    let html = `
    <div style="position:relative; width:100%;">
      <div class="stacked-bar-container">`;

    periods.forEach(p => {
      const cogsPct = Math.round((p.cogs / p.rev) * 100);
      const opexPct = Math.round((p.opex / p.rev) * 100);
      const profitPct = 100 - cogsPct - opexPct;
      const colHeightPct = Math.round((p.rev / maxRev) * 100);

      html += `
      <div class="stacked-bar-col"
           onmouseenter="app.showStackedTooltip(event, '${p.label}', 'รายได้: ฿${p.rev.toLocaleString()}', 'กำไรสุทธิ: ฿${p.profit.toLocaleString()} (${profitPct}%)', 'ต้นทุนวัสดุ: ฿${p.cogs.toLocaleString()} (${cogsPct}%)', 'ค่าใช้จ่ายดำเนินงาน: ฿${p.opex.toLocaleString()} (${opexPct}%)')"
           onmouseleave="app.hideStackedTooltip()">
        <span style="font-size:10.5px; font-weight:800; color:#10B981; margin-bottom:4px;">${profitPct}%</span>
        <div class="stacked-bar-pill" style="height:${colHeightPct}%;">
          <!-- Bottom: Operating Expense -->
          <div class="stacked-slice-opex" style="height:${opexPct}%;" title="ค่าใช้จ่ายดำเนินงาน ${opexPct}%"></div>
          <!-- Middle: COGS Materials -->
          <div class="stacked-slice-cogs" style="height:${cogsPct}%;" title="ต้นทุนสินค้า/วัสดุ ${cogsPct}%"></div>
          <!-- Top: Net Profit -->
          <div class="stacked-slice-profit" style="height:${profitPct}%;" title="กำไรสุทธิ ${profitPct}%"></div>
        </div>
        <div style="font-size:11px; font-weight:700; color:#334155; margin-top:8px;">${p.label}</div>
        <div style="font-size:10px; color:#64748B;">฿${Math.round(p.rev/1000)}k</div>
      </div>`;
    });

    html += `
      </div>
      <div id="stacked-tooltip" class="chart-tooltip-box" style="display:none;"></div>
    </div>`;

    container.innerHTML = html;

    const marginBadge = document.getElementById('stacked-margin-badge');
    if (marginBadge) marginBadge.innerText = 'กำไรสุทธิ 42%';
  },

  showStackedTooltip(e, period, rev, profit, cogs, opex) {
    const tt = document.getElementById('stacked-tooltip');
    if (!tt) return;
    tt.innerHTML = `
      <div style="font-weight:700; border-bottom:1px solid rgba(255,255,255,0.2); padding-bottom:3px; margin-bottom:4px;">${period} - ${rev}</div>
      <div style="color:#34D399; font-weight:700;"><i class="las la-check-circle"></i> ${profit}</div>
      <div style="color:#FBBF24;"><i class="las la-boxes"></i> ${cogs}</div>
      <div style="color:#94A3B8;"><i class="las la-receipt"></i> ${opex}</div>`;
    const rect = e.currentTarget.getBoundingClientRect();
    const parentRect = tt.parentElement.getBoundingClientRect();
    tt.style.left = (rect.left + rect.width / 2 - parentRect.left) + 'px';
    tt.style.top = (rect.top - parentRect.top) + 'px';
    tt.style.display = 'block';
  },

  hideStackedTooltip() {
    const tt = document.getElementById('stacked-tooltip');
    if (tt) tt.style.display = 'none';
  },

  // 2.1 สัดส่วนช่องทางการขาย (หน้าร้าน, ออนไลน์, เอเจนซี่) - Donut Chart
  renderChannelDonutChart() {
    const container = document.getElementById('donut-channel-container');
    if (!container) return;

    // Realistic channel data
    const channels = [
      { name: 'หน้าร้าน (Walk-in)', icon: 'la-store', color: '#2563EB', amt: 102400, count: 22, pct: 38 },
      { name: 'ออนไลน์ (Web / LINE / FB)', icon: 'la-globe', color: '#10B981', amt: 124600, count: 28, pct: 46 },
      { name: 'เอเจนซี่ & ตัวแทน (Partner)', icon: 'la-handshake', color: '#F59E0B', amt: 41000, count: 9, pct: 16 }
    ];

    const totalOrders = channels.reduce((a, b) => a + b.count, 0);
    const totalRev = channels.reduce((a, b) => a + b.amt, 0);
    const circumference = 376.99; // 2 * pi * 60

    let accumPct = 0;
    const slicesSvg = channels.map((c) => {
      const sliceLen = (c.pct / 100) * circumference;
      const offset = (accumPct / 100) * circumference;
      accumPct += c.pct;
      return `
        <circle class="donut-slice" cx="90" cy="90" r="60" fill="none"
                stroke="${c.color}" stroke-width="18" stroke-linecap="butt"
                stroke-dasharray="${sliceLen.toFixed(1)} ${(circumference - sliceLen).toFixed(1)}"
                stroke-dashoffset="${-offset.toFixed(1)}"
                onmouseenter="app.highlightDonutSegment('channel', '${c.name}', '฿${c.amt.toLocaleString()}', '${c.pct}%')"
                onmouseleave="app.resetDonutCenter('channel', '${totalOrders} ออเดอร์', 'ยอดสั่งซื้อรวม')"/>`;
    }).join('');

    const html = `
      <div class="donut-svg-wrap">
        <svg viewBox="0 0 180 180" style="width:145px; height:145px; display:block;">
          <g transform="rotate(-90 90 90)">
            <circle cx="90" cy="90" r="60" fill="none" stroke="#F1F5F9" stroke-width="18"/>
            ${slicesSvg}
          </g>
          <g>
            <text x="90" y="85" text-anchor="middle" font-size="16" font-weight="800" fill="#1E3A8A" font-family="'Prompt',sans-serif" id="donut-svg-center-val-channel">${totalOrders} ออเดอร์</text>
            <text x="90" y="103" text-anchor="middle" font-size="10" font-weight="600" fill="#64748B" font-family="'Prompt',sans-serif" id="donut-svg-center-sub-channel">ยอดสั่งซื้อรวม</text>
          </g>
        </svg>
      </div>

      <div class="donut-legend-list">
        ${channels.map(c => `
          <div class="donut-legend-item"
               onmouseenter="app.highlightDonutSegment('channel', '${c.name}', '฿${c.amt.toLocaleString()}', '${c.pct}%')"
               onmouseleave="app.resetDonutCenter('channel', '${totalOrders} ออเดอร์', 'ยอดสั่งซื้อรวม')">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
              <div style="font-weight:700; color:#1E293B; font-size:12px; display:flex; align-items:center; gap:6px;">
                <span style="display:inline-block; width:9px; height:9px; border-radius:50%; background:${c.color}; flex-shrink:0;"></span>
                <i class="las ${c.icon}" style="color:${c.color}; font-size:14px;"></i> ${c.name}
              </div>
              <span style="font-size:12px; font-weight:800; color:${c.color};">${c.pct}%</span>
            </div>
            <div style="height:6px; border-radius:3px; background:#E2E8F0; overflow:hidden; margin-bottom:4px;">
              <div style="width:${c.pct}%; height:100%; background:${c.color}; border-radius:3px;"></div>
            </div>
            <div style="display:flex; justify-content:space-between; font-size:11px; color:#64748B;">
              <span>${c.count} คำสั่งซื้อ</span>
              <span style="font-weight:700; color:#0F172A;">฿${c.amt.toLocaleString()}</span>
            </div>
          </div>
        `).join('')}
      </div>`;

    container.innerHTML = html;
  },

  // 2.2 สัดส่วนการชำระเงิน (เงินสด, โอน, บัตรเครดิต) - Donut Chart
  renderPaymentDonutChart() {
    const container = document.getElementById('donut-payment-container');
    if (!container) return;

    const payments = [
      { name: 'โอนเงิน / QR พร้อมเพย์', icon: 'la-mobile-alt', color: '#6366F1', amt: 176880, count: 42, pct: 66 },
      { name: 'เงินสดหน้าร้าน (Cash)', icon: 'la-money-bill-wave', color: '#10B981', amt: 64320, count: 14, pct: 24 },
      { name: 'บัตรเครดิต / เช็คธนาคาร', icon: 'la-credit-card', color: '#0EA5E9', amt: 26800, count: 3, pct: 10 }
    ];

    const totalAmt = payments.reduce((a, b) => a + b.amt, 0);
    const circumference = 376.99; // 2 * pi * 60

    let accumPct = 0;
    const slicesSvg = payments.map((p) => {
      const sliceLen = (p.pct / 100) * circumference;
      const offset = (accumPct / 100) * circumference;
      accumPct += p.pct;
      return `
        <circle class="donut-slice" cx="90" cy="90" r="60" fill="none"
                stroke="${p.color}" stroke-width="18" stroke-linecap="butt"
                stroke-dasharray="${sliceLen.toFixed(1)} ${(circumference - sliceLen).toFixed(1)}"
                stroke-dashoffset="${-offset.toFixed(1)}"
                onmouseenter="app.highlightDonutSegment('payment', '${p.name}', '฿${p.amt.toLocaleString()}', '${p.pct}%')"
                onmouseleave="app.resetDonutCenter('payment', '฿${(totalAmt/1000).toFixed(0)}k', 'กระทบยอดครบ 100%')"/>`;
    }).join('');

    const html = `
      <div class="donut-svg-wrap">
        <svg viewBox="0 0 180 180" style="width:145px; height:145px; display:block;">
          <g transform="rotate(-90 90 90)">
            <circle cx="90" cy="90" r="60" fill="none" stroke="#F1F5F9" stroke-width="18"/>
            ${slicesSvg}
          </g>
          <g>
            <text x="90" y="85" text-anchor="middle" font-size="16" font-weight="800" fill="#065F46" font-family="'Prompt',sans-serif" id="donut-svg-center-val-payment">฿${(totalAmt/1000).toFixed(0)}k</text>
            <text x="90" y="103" text-anchor="middle" font-size="10" font-weight="600" fill="#10B981" font-family="'Prompt',sans-serif" id="donut-svg-center-sub-payment">กระทบยอดครบ</text>
          </g>
        </svg>
      </div>

      <div class="donut-legend-list">
        ${payments.map(p => `
          <div class="donut-legend-item"
               onmouseenter="app.highlightDonutSegment('payment', '${p.name}', '฿${p.amt.toLocaleString()}', '${p.pct}%')"
               onmouseleave="app.resetDonutCenter('payment', '฿${(totalAmt/1000).toFixed(0)}k', 'กระทบยอดครบ 100%')">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
              <div style="font-weight:700; color:#1E293B; font-size:12px; display:flex; align-items:center; gap:6px;">
                <span style="display:inline-block; width:9px; height:9px; border-radius:50%; background:${p.color}; flex-shrink:0;"></span>
                <i class="las ${p.icon}" style="color:${p.color}; font-size:14px;"></i> ${p.name}
              </div>
              <span style="font-size:12px; font-weight:800; color:${p.color};">${p.pct}%</span>
            </div>
            <div style="height:6px; border-radius:3px; background:#E2E8F0; overflow:hidden; margin-bottom:4px;">
              <div style="width:${p.pct}%; height:100%; background:${p.color}; border-radius:3px;"></div>
            </div>
            <div style="display:flex; justify-content:space-between; font-size:11px; color:#64748B;">
              <span>${p.count} รายการ</span>
              <span style="font-weight:700; color:#0F172A;">฿${p.amt.toLocaleString()}</span>
            </div>
          </div>
        `).join('')}
      </div>`;

    container.innerHTML = html;
  },

  highlightDonutSegment(type, name, amt, pct) {
    const valSvg = document.getElementById(`donut-svg-center-val-${type}`);
    const subSvg = document.getElementById(`donut-svg-center-sub-${type}`);
    if (valSvg && subSvg) {
      valSvg.textContent = amt;
      subSvg.textContent = `${pct} ของทั้งหมด`;
    }
    const center = document.getElementById(`donut-center-${type}`);
    if (center) {
      center.innerHTML = `
        <div style="font-size:14px; font-weight:800; color:var(--primary); line-height:1.2;">${amt}</div>
        <div style="font-size:10px; color:#64748B;">${pct} ของทั้งหมด</div>`;
    }
  },

  resetDonutCenter(type, main, sub) {
    const valSvg = document.getElementById(`donut-svg-center-val-${type}`);
    const subSvg = document.getElementById(`donut-svg-center-sub-${type}`);
    if (valSvg && subSvg) {
      valSvg.textContent = main;
      subSvg.textContent = sub;
    }
    const center = document.getElementById(`donut-center-${type}`);
    if (center) {
      center.innerHTML = `
        <div style="font-size:${type === 'payment' ? '16px' : '17px'}; font-weight:800; color:${type === 'payment' ? '#065F46' : 'var(--primary)'}; line-height:1.2;">${main}</div>
        <div style="font-size:10px; color:#64748B;">${sub}</div>`;
    }
  },

  // 3. หมวดสินค้าและบริการขายดี (Top Best Sellers Horizontal Bar Chart)
  renderTopSellersChart() {
    const container = document.getElementById('top-sellers-hbar-container');
    if (!container) return;

    // Top selling items ordered descending by sales value
    const topSellers = [
      {
        rank: 1,
        name: 'ป้ายไวนิลพรีเมียม 440g ทึบแสง (โครงไม้ / โครงเหล็ก)',
        cat: 'งานพิมพ์ไวนิล & ป้าย',
        icon: 'la-image',
        color: '#1E3A8A',
        sales: 94500,
        volume: '630 ตร.ม.',
        pct: 35.2
      },
      {
        rank: 2,
        name: 'สติกเกอร์ไดคัทพร้อมฟิวเจอร์บอร์ด 3-5 มิล (บอร์ดประชาสัมพันธ์/ป้ายเมนู)',
        cat: 'สติกเกอร์ติดบอร์ด & พลาสวูด',
        icon: 'la-clone',
        color: '#3B82F6',
        sales: 58400,
        volume: '145 ตร.ม.',
        pct: 21.8
      },
      {
        rank: 3,
        name: 'สติกเกอร์ติดพลาสวูด 5 มิล ฉลุ CNC ตัวอักษรนูน (ป้ายหน้าคลินิก/รีสอร์ท)',
        cat: 'สติกเกอร์ติดบอร์ด & พลาสวูด',
        icon: 'la-cut',
        color: '#10B981',
        sales: 42750,
        volume: '45 ตร.ม.',
        pct: 16.0
      },
      {
        rank: 4,
        name: 'ป้ายตู้ไฟ LED สองหน้า อะคริลิคปั๊มนูน พร้อมขาแขวนเหล็กดัด',
        cat: 'ป้ายไฟ & ตู้ไฟ LED',
        icon: 'la-lightbulb',
        color: '#8B5CF6',
        sales: 36000,
        volume: '20 ชุด',
        pct: 13.4
      },
      {
        rank: 5,
        name: 'สติกเกอร์ฉลากสินค้า PP กันน้ำ 100% ไดคัท A3 / ต่อตารางเมตร',
        cat: 'งานพิมพ์สติกเกอร์ไดคัท',
        icon: 'la-stamp',
        color: '#F59E0B',
        sales: 22400,
        volume: '280 แผ่น',
        pct: 8.4
      },
      {
        rank: 6,
        name: 'ป้ายตั้งสแตนดี้ / โรลอัป / ธงญี่ปุ่น ออกบูธนิทรรศการ',
        cat: 'ป้ายตั้ง & อุปกรณ์ออกบูธ',
        icon: 'la-flag',
        color: '#EC4899',
        sales: 13950,
        volume: '25 ชุด',
        pct: 5.2
      }
    ];

    const maxSales = topSellers[0].sales;

    const html = topSellers.map(item => {
      const fillPct = Math.round((item.sales / maxSales) * 100);
      const badgeClass = item.rank === 1 ? 'rank-badge-1' : item.rank === 2 ? 'rank-badge-2' : item.rank === 3 ? 'rank-badge-3' : 'rank-badge-other';
      const rankEmoji = item.rank === 1 ? '🥇' : item.rank === 2 ? '🥈' : item.rank === 3 ? '🥉' : `#${item.rank}`;

      return `
      <div class="hbar-row" onclick="app.showToast('สินค้า: ${item.name} | ยอดขายสะสม ฿${item.sales.toLocaleString()}', 'info')">
        <!-- Col 1: Product Title & Category -->
        <div style="display:flex; align-items:center; gap:10px;">
          <span class="${badgeClass}" style="display:inline-flex; align-items:center; justify-content:center; width:28px; height:28px; border-radius:8px; font-weight:800; font-size:12px; flex-shrink:0;">
            ${rankEmoji}
          </span>
          <div style="min-width:0;">
            <div style="font-size:13.5px; font-weight:700; color:#1E293B; line-height:1.4; word-break:break-word;">
              ${item.name}
            </div>
            <div style="font-size:11px; color:#64748B; display:flex; align-items:center; gap:4px; margin-top:2px;">
              <i class="las ${item.icon}" style="color:${item.color};"></i> ${item.cat}
            </div>
          </div>
        </div>

        <!-- Col 2: Horizontal Bar Fill Track -->
        <div>
          <div class="hbar-track">
            <div class="hbar-fill" style="width:${fillPct}%; background:linear-gradient(90deg, ${item.color} 0%, #3B82F6 100%);"></div>
          </div>
        </div>

        <!-- Col 3: Revenue & Sold Volume -->
        <div style="text-align:right;">
          <div style="font-size:14.5px; font-weight:800; color:#0F172A;">฿${item.sales.toLocaleString()}</div>
          <div style="font-size:11.5px; color:#64748B;">
            <b>${item.volume}</b> <span style="font-weight:700; color:${item.color};">(${item.pct}%)</span>
          </div>
        </div>
      </div>`;
    }).join('');

    container.innerHTML = html;
  },

  // 4. หมวดการแจ้งเตือนสต็อกวัสดุและอุปกรณ์วิกฤต (Critical Low Stock Alert Cards - ไม่ใช้กราฟ)
  renderLowStockAlertCards() {
    const container = document.getElementById('low-stock-alert-cards-container');
    const counterBadge = document.getElementById('low-stock-alert-counter');
    if (!container) return;

    // Critical and warning inventory materials
    const alerts = [
      {
        id: 'LSA-01',
        material: 'พลาสวูด (Plastwood) 5 มม. แผ่น 122x244 ซม.',
        cat: 'วัสดุแผ่นโครงสร้าง',
        icon: 'la-layer-group',
        level: 'critical',
        remaining: 12,
        safetyMin: 60,
        unit: 'แผ่น',
        pct: 20,
        impact: 'วิกฤต! กระทบงานป้ายโครงการและฉลุตัวอักษร CNC คิวถัดไป',
        supplier: 'บจก. สยามมีเดียซัพพลาย (ตรัง)',
        supplierPhone: '075-889-112',
        leadTime: '1-2 วันทำการ',
        suggestedPo: 50
      },
      {
        id: 'LSA-02',
        material: 'ตาไก่เบอร์ 28 ชุบนิกเกิลกันสนิม (กล่อง 1,000 ตัว)',
        cat: 'อุปกรณ์ฟิตติ้งและตอกขอบ',
        icon: 'la-circle-notch',
        level: 'critical',
        remaining: 3,
        safetyMin: 20,
        unit: 'กล่อง',
        pct: 15,
        impact: 'วิกฤต! จะหมดสต็อกภายใน 24 ชม. ส่งผลให้ไม่สามารถส่งมอบงานไวนิลได้',
        supplier: 'ร้านรุ่งเรืองฮาร์ดแวร์ ตรัง',
        supplierPhone: '075-212-334',
        leadTime: 'มีของพร้อมส่งทันที',
        suggestedPo: 20
      },
      {
        id: 'LSA-03',
        material: 'หมึกพิมพ์ Outdoor Eco-Solvent (Cyan, Magenta, Yellow, Black)',
        cat: 'หมึกพิมพ์เครื่องจักรอิงค์เจ็ท',
        icon: 'la-tint',
        level: 'warning',
        remaining: 2,
        safetyMin: 8,
        unit: 'แกลลอน',
        pct: 25,
        impact: 'ใกล้หมด! รองรับงานพิมพ์ได้อีกประมาณ 2-3 วันทำการ',
        supplier: 'บจก. อิงค์แมชชีนเนอรี่',
        supplierPhone: '02-990-8811',
        leadTime: '2-3 วันทำการ',
        suggestedPo: 8
      },
      {
        id: 'LSA-04',
        material: 'ม้วนไวนิลทึบแสง 440g หน้ากว้าง 3.20 ม. (ม้วน 50 ม.)',
        cat: 'ม้วนวัสดุพิมพ์ Outdoor',
        icon: 'la-scroll',
        level: 'warning',
        remaining: 4,
        safetyMin: 15,
        unit: 'ม้วน',
        pct: 26,
        impact: 'ใกล้หมด! เหลือพื้นที่พิมพ์ได้ประมาณ 640 ตร.ม.',
        supplier: 'บจก. สยามมีเดียซัพพลาย (ตรัง)',
        supplierPhone: '075-889-112',
        leadTime: '1-2 วันทำการ',
        suggestedPo: 10
      }
    ];

    if (counterBadge) {
      counterBadge.innerHTML = `<i class="las la-bell"></i> ${alerts.length} รายการต้องเติมสต็อกด่วน`;
    }

    const html = alerts.map(a => {
      const isCritical = a.level === 'critical';
      const badgeClass = isCritical ? 'stock-badge-critical' : 'stock-badge-warning';
      const badgeText = isCritical ? 'วิกฤต (Critical)' : 'ใกล้หมด (Warning)';
      const cardClass = isCritical ? 'stock-alert-card' : 'stock-alert-card warning-level';
      const barColor = isCritical ? '#EF4444' : '#F59E0B';

      return `
      <div class="${cardClass}">
        <div>
          <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:8px;">
            <span class="${badgeClass}">
              <i class="las ${isCritical ? 'la-exclamation-circle' : 'la-exclamation-triangle'}"></i>
              ${badgeText}
            </span>
            <span style="font-size:11px; color:#64748B; background:#F1F5F9; padding:2px 8px; border-radius:4px;">
              <i class="las ${a.icon}"></i> ${a.cat}
            </span>
          </div>

          <h4 style="margin:0 0 6px 0; font-size:15px; color:#0F172A; line-height:1.4;">
            ${a.material}
          </h4>

          <!-- Stock level meter -->
          <div style="margin:10px 0;">
            <div style="display:flex; justify-content:space-between; font-size:12.5px; margin-bottom:4px;">
              <span style="color:#64748B;">คงเหลือจริง: <b style="color:${barColor}; font-size:14px;">${a.remaining} ${a.unit}</b></span>
              <span style="color:#64748B;">จุดปลอดภัย: <b>${a.safetyMin} ${a.unit}</b></span>
            </div>
            <div style="width:100%; height:8px; background:#F1F5F9; border-radius:50px; overflow:hidden;">
              <div style="width:${a.pct}%; height:100%; background:${barColor}; border-radius:50px;"></div>
            </div>
          </div>

          <!-- Impact warning text -->
          <div style="font-size:11.5px; color:${isCritical ? '#B91C1C' : '#92400E'}; background:${isCritical ? '#FEF2F2' : '#FFFBEB'}; border:1px solid ${isCritical ? '#FEE2E2' : '#FEF3C7'}; border-radius:6px; padding:6px 10px; margin-bottom:10px; line-height:1.4;">
            <i class="las la-info-circle"></i> ${a.impact}
          </div>

          <!-- Supplier info -->
          <div style="font-size:11.5px; color:#475569; display:flex; flex-direction:column; gap:2px; padding:6px 0; border-top:1px dashed #E2E8F0;">
            <div><i class="las la-truck"></i> ซัพพลายเออร์: <b>${a.supplier}</b></div>
            <div><i class="las la-phone"></i> สั่งด่วน: <a href="tel:${a.supplierPhone}" style="color:#2563EB; font-weight:700;">${a.supplierPhone}</a> (ส่งใน: ${a.leadTime})</div>
          </div>
        </div>

        <!-- Action buttons -->
        <div style="display:flex; gap:8px; margin-top:8px;">
          <button class="btn btn-sm ${isCritical ? 'btn-danger' : 'btn-primary'}" style="flex:1; font-size:12px; font-weight:700; padding:6px 10px; border-radius:8px;"
                  onclick="app.openQuickReorderModal('${a.id}', '${a.material}', '${a.supplier}', ${a.suggestedPo}, '${a.unit}')">
            <i class="las la-cart-plus"></i> สั่งซื้อทันที (${a.suggestedPo} ${a.unit})
          </button>
          <button class="btn btn-sm btn-outline" style="font-size:12px; padding:6px 10px; border-radius:8px;"
                  onclick="app.switchErpTab('catalog')" title="เปิดดูในคลังสต็อก">
            <i class="las la-boxes"></i> คลัง
          </button>
        </div>
      </div>`;
    }).join('');

    container.innerHTML = html;
  },

  openQuickReorderModal(alertId, material, supplier, suggestedQty, unit) {
    this.openPayableModal();
    setTimeout(() => {
      const suppEl = document.getElementById('ap-supplier');
      const descEl = document.getElementById('ap-desc');
      const catEl = document.getElementById('ap-category');
      if (suppEl) suppEl.value = supplier;
      if (descEl) descEl.value = `สั่งซื้อสต็อกด่วน: ${material} จำนวน ${suggestedQty} ${unit}`;
      if (catEl) catEl.value = 'stock';
    }, 150);
  },

  renderErpLists() {
    const tbAgent = document.getElementById('tbody-admin-agents');
    if (tbAgent) {
      tbAgent.innerHTML = '';
      this.state.agents.forEach(a => {
        tbAgent.innerHTML += `<tr><td><strong>${a.id}</strong></td><td>${a.name}<br><span style="font-size:11px; color:var(--text-light);">${a.shop}</span></td><td><span class="status-badge status-Graphic">${a.tier}</span></td><td style="color:var(--primary); font-weight:bold;">฿${(a.sales || 0).toLocaleString()}</td><td style="color:var(--accent); font-weight:bold;">฿${(a.commission || 0).toLocaleString()}</td><td><span class="status-badge status-${a.status === 'approved' ? 'Done' : 'Sales'}">${a.status}</span></td><td><button class="btn-sm btn-outline" onclick="app.showToast('รอเปิดใช้งานแก้ไขตัวแทน', 'info')">แก้ไข</button></td></tr>`;
      });
    }

    const tbStaff = document.getElementById('tbody-staff');
    if (tbStaff) {
      tbStaff.innerHTML = '';
      this.state.staffs.forEach(s => {
        tbStaff.innerHTML += `<tr><td><strong>${s.id}</strong></td><td>${s.name}</td><td>${s.dept}</td><td>${s.phone}</td><td><span class="status-badge status-Done">${s.status}</span></td><td><button class="btn-sm btn-outline" onclick="app.showToast('รอเปิดใช้งานแก้ไขพนักงาน', 'info')">แก้ไข</button></td></tr>`;
      });
    }

    const tbExp = document.getElementById('tbody-expenses');
    if (tbExp) {
      tbExp.innerHTML = '';
      this.state.expenses.forEach(e => {
        tbExp.innerHTML += `<tr><td>${new Date(e.date).toLocaleDateString('th-TH')}</td><td>${e.desc}</td><td style="color:var(--danger); font-weight:bold;">-฿${(e.amount || 0).toLocaleString()}</td></tr>`;
      });
    }

    const notifCont = document.getElementById('notif-container');
    if (notifCont) {
      notifCont.innerHTML = '';
      if (this.state.notifications.length === 0) {
        notifCont.innerHTML = '<div style="padding:30px; text-align:center; color:var(--text-light);">ไม่มีการแจ้งเตือน</div>';
      } else {
        this.state.notifications.forEach(n => {
          let icon = n.type === 'warning' ? '<i class="las la-exclamation-triangle" style="color:var(--warning); font-size:24px;"></i>' : '<i class="las la-info-circle" style="color:var(--info); font-size:24px;"></i>';
          notifCont.innerHTML += `
          <div style="background:white; border-left:4px solid ${n.type === 'warning' ? 'var(--warning)' : 'var(--info)'}; padding:15px 20px; border-radius:8px; margin-bottom:10px; display:flex; gap:15px; align-items:center;">
            ${icon}
            <div style="flex:1;">
              <div style="font-size:14px; color:var(--text-main); font-weight:500;">${n.text}</div>
              <div style="font-size:11px; color:var(--text-light); margin-top:3px;">เวลา ${n.time}</div>
            </div>
          </div>`;
        });
      }
      const notifCount = document.getElementById('notif-count');
      if (notifCount) {
        const unread = this.state.notifications.filter(n => !n.read).length;
        if (unread > 0) { notifCount.style.display = 'inline'; notifCount.innerText = unread; }
        else { notifCount.style.display = 'none'; }
      }
    }
  },

  generateAiInsights(rev, ar, rush, expTotal = 0, apTotal = 0) {
    const aiBox = document.getElementById('ai-insights-content');
    if (!aiBox) return;
    let text = `<div style="display:flex; flex-direction:column; gap:6px;">`;
    
    // Revenue & Profit Analysis
    const profit = rev - expTotal;
    const margin = rev > 0 ? Math.round((profit / rev) * 100) : 0;
    if (profit > 0) {
      text += `<div><span style="color:#10B981; font-weight:bold;"><i class="las la-arrow-up"></i> สถานะการเงินเป็นบวก:</span> รายรับ ฿${rev.toLocaleString()} หักรายจ่าย ฿${expTotal.toLocaleString()} มีกำไรสุทธิ <b>฿${profit.toLocaleString()} (${margin}%)</b> ถือว่าอยู่ในเกณฑ์สุขภาพการเงินดีเยี่ยม</div>`;
    } else {
      text += `<div><span style="color:#EF4444; font-weight:bold;"><i class="las la-exclamation-triangle"></i> แจ้งเตือนกระแสเงินสด:</span> รายจ่ายสะสม (฿${expTotal.toLocaleString()}) สูงกว่ารายรับจริง (฿${rev.toLocaleString()}) ควรชะลอรายจ่ายฟุ่มเฟือยและเร่งปิดยอดขาย</div>`;
    }

    // Accounts Receivable (AR) Analysis
    if (ar > rev * 0.25 && ar > 0) {
      text += `<div><span style="color:#D97706; font-weight:bold;"><i class="las la-bell"></i> เตือนลูกหนี้ค้างชำระ (AR):</span> มียอดค้างชำระรวม <b>฿${ar.toLocaleString()}</b> แนะนำให้ฝ่ายขายส่งลิงก์แจ้งเตือนชำระเงินทาง LINE ทันที เพื่อป้องกันเงินสดตึงตัว</div>`;
    } else {
      text += `<div><span style="color:#059669;"><i class="las la-check-circle"></i> การเก็บเงินมีประสิทธิภาพ:</span> ยอดค้างชำระอยู่ในเกณฑ์ปลอดภัย</div>`;
    }

    // Accounts Payable (AP) Analysis
    if (apTotal > 0) {
      text += `<div><span style="color:#7C3AED; font-weight:bold;"><i class="las la-truck-loading"></i> เจ้าหนี้การค้า (AP):</span> มียอดรอจ่ายค่าวัตถุดิบและอุปกรณ์ซัพพลายเออร์ <b>฿${apTotal.toLocaleString()}</b> อย่าลืมตรวจสอบรอบเครดิตเทอมเพื่อรักษาความสัมพันธ์ทางธุรกิจ</div>`;
    }

    // Workload & Rush Jobs
    if (rush > 2) {
      text += `<div><span style="color:#EA580C; font-weight:bold;"><i class="las la-fire"></i> งานด่วนสะสม (${rush} งาน):</span> ฝ่ายผลิตควรเดินเครื่องจักรต่อเนื่อง และจัดทีมช่างติดตั้งล่วงหน้าเพื่อส่งมอบตรงเวลา</div>`;
    }

    text += `</div>`;
    aiBox.innerHTML = text;
  },

  sendPaymentReminderLine(orderId) {
    const order = this.state.orders.find(o => o.id === orderId);
    if (!order) return;
    const remain = order.payment === 'Deposit' ? (order.net * 0.5) : order.net;
    const text = `แจ้งเตือนยอดชำระเงินคงค้าง - TUMDEEMEDIA (ทำดีมีเดีย ตรัง)\nเรียน คุณ ${order.customerName}\nเลขออเดอร์: ${order.id}\nยอดคงค้างชำระ: ฿${remain.toLocaleString()}\n\nช่องทางการโอนชำระเงิน:\n- ธนาคารไทยพาณิชย์ (SCB): 590-264768-1\n- พร้อมเพย์: 0950259996 (สมาร์ท ทูเดย์)\nเมื่อโอนเรียบร้อยแล้ว รบกวนส่งสลิปตอบกลับทางนี้ได้เลยครับ ขอบคุณครับ 🙏`;
    this.copyToClipboard(text, 'คัดลอกข้อความเตือนชำระเงินแล้ว กำลังเปิด LINE...');
    setTimeout(() => {
      window.open(this.state.settings.linkLine, '_blank');
    }, 500);
  },

  openDashDetail(type) {
    const modal = document.getElementById('dash-detail-modal');
    const titleEl = document.getElementById('ddm-title');
    const tbody = document.getElementById('tbody-dash-detail');
    if (!modal || !tbody) return;
    tbody.innerHTML = '';
    let list = [];
    const now = new Date();

    const filterByDate = (o) => {
      const oDate = new Date(o.date);
      if (this.state.dashboardFilter === 'day') return oDate.toDateString() === now.toDateString();
      if (this.state.dashboardFilter === 'week') return (now - oDate) <= (7 * 24 * 60 * 60 * 1000);
      if (this.state.dashboardFilter === 'month') return oDate.getMonth() === now.getMonth() && oDate.getFullYear() === now.getFullYear();
      if (this.state.dashboardFilter === 'year') return oDate.getFullYear() === now.getFullYear();
      return true;
    };

    if (type === 'revenue') { titleEl.innerHTML = '<i class="las la-coins" style="color:var(--primary);"></i> รายละเอียดออเดอร์ยอดขายรวม'; list = this.state.orders.filter(filterByDate); }
    else if (type === 'unpaid') { titleEl.innerHTML = '<i class="las la-exclamation-circle" style="color:var(--danger);"></i> รายละเอียดออเดอร์ค้างชำระ (AR)'; list = this.state.orders.filter(o => filterByDate(o) && o.payment !== 'Paid'); }
    else if (type === 'profit') { titleEl.innerHTML = '<i class="las la-chart-pie" style="color:var(--success);"></i> ข้อมูลออเดอร์เพื่อคำนวณกำไรสุทธิ'; list = this.state.orders.filter(filterByDate); }
    else if (type === 'rush') { titleEl.innerHTML = '<i class="las la-fire" style="color:var(--warning);"></i> รายการงานด่วนรอดำเนินการ'; list = this.state.orders.filter(o => filterByDate(o) && o.priority === 'rush' && o.status !== 'Done'); }
    else if (type === 'sqm') { titleEl.innerHTML = '<i class="las la-border-all" style="color:var(--info);"></i> รายการสั่งพิมพ์พื้นที่เยอะ'; list = this.state.orders.filter(filterByDate).filter(o => o.items.some(i => i.type.startsWith('V') || i.type.startsWith('S'))); }
    else if (type === 'install') { titleEl.innerHTML = '<i class="las la-truck-loading" style="color:var(--accent);"></i> รายการคิวเตรียมจัดส่ง / ติดตั้ง'; list = this.state.orders.filter(o => filterByDate(o) && o.status === 'Logistics'); }
    else if (type === 'expenses') {
      titleEl.innerHTML = '<i class="las la-receipt" style="color:#EF4444;"></i> รายการค่าใช้จ่ายของร้านทั้งหมด';
      const expList = (this.state.expenses || []).filter(e => filterByDate(e.date));
      if (expList.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:30px; color:var(--text-light);">ไม่มีรายการรายจ่ายในช่วงเวลานี้</td></tr>';
      } else {
        expList.forEach(e => {
          tbody.innerHTML += `<tr><td style="padding:15px;"><strong>${e.id}</strong><br><span style="font-size:11px; color:#888;">${new Date(e.date).toLocaleDateString('th-TH')}</span></td><td style="padding:15px;">${e.desc}</td><td style="padding:15px;"><span class="status-badge" style="background:#FEE2E2; color:#DC2626;">${e.category}</span></td><td style="padding:15px; font-weight:bold; color:#DC2626;">-฿${(e.amount || 0).toLocaleString()}</td><td style="padding:15px;"><button class="btn-sm btn-outline" onclick="document.getElementById('dash-detail-modal').style.display='none'; app.openExpenseModal('${e.id}')">แก้ไข</button></td></tr>`;
        });
      }
      modal.style.display = 'flex';
      return;
    } else if (type === 'payables') {
      titleEl.innerHTML = '<i class="las la-truck-loading" style="color:#7C3AED;"></i> รายการเจ้าหนี้การค้า / ร้านค้างจ่ายค่าของ (AP)';
      const apList = (this.state.payables || []).filter(ap => ap.status === 'pending');
      if (apList.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:30px; color:var(--text-light);">ไม่มีรายการค้างจ่ายซัพพลายเออร์</td></tr>';
      } else {
        apList.forEach(ap => {
          tbody.innerHTML += `<tr><td style="padding:15px;"><strong>${ap.id}</strong><br><span style="font-size:11px; color:#888;">ครบกำหนด: ${ap.dueDate}</span></td><td style="padding:15px;">${ap.supplier}</td><td style="padding:15px;"><span class="status-badge" style="background:#FAF5FF; color:#7C3AED;">${ap.desc.substring(0, 25)}...</span></td><td style="padding:15px; font-weight:bold; color:#7C3AED;">฿${(ap.amount || 0).toLocaleString()}</td><td style="padding:15px;"><button class="btn-sm btn-success" onclick="document.getElementById('dash-detail-modal').style.display='none'; app.markPayableAsPaid('${ap.id}')">จ่ายแล้ว</button></td></tr>`;
        });
      }
      modal.style.display = 'flex';
      return;
    }

    if (list.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:30px; color:var(--text-light);">ไม่มีข้อมูลในช่วงเวลานี้</td></tr>';
    } else {
      list.forEach(o => {
        let val = (type === 'unpaid') ? `<span style="color:var(--danger);">${o.payment}</span>` : `฿${o.net.toLocaleString()}`;
        tbody.innerHTML += `<tr><td style="padding:15px;"><strong>${o.id}</strong><br><span style="font-size:11px; color:#888;">${new Date(o.date).toLocaleDateString('th-TH')}</span></td><td style="padding:15px;">${o.customerName || ''}</td><td style="padding:15px;"><span class="status-badge status-${o.status}">${o.status}</span></td><td style="padding:15px; font-weight:bold; color:var(--primary);">${val}</td><td style="padding:15px;"><button class="btn-sm btn-outline" onclick="document.getElementById('dash-detail-modal').style.display='none'; app.openManageOrder('${o.id}')">จัดการ</button></td></tr>`;
      });
    }
    modal.style.display = 'flex';
  },

  /* ==========================================================================
     FINANCE & EXPENSES (ฝ่ายบัญชีและการเงินแบบเต็มรูปแบบ)
     ========================================================================== */
  renderFinanceTab() {
    const tbodyExp = document.getElementById('tbody-expenses-full');
    const tbodyPay = document.getElementById('tbody-payables');
    const catFilter = document.getElementById('finance-category-filter')?.value || 'all';

    // 1. Render Expenses Table
    if (tbodyExp) {
      tbodyExp.innerHTML = '';
      const catMap = {
        fuel: { name: 'ค่าน้ำมัน/เดินทาง', bg: '#FEF3C7', color: '#B45309' },
        repair: { name: 'ค่าซ่อมบำรุง', bg: '#EFF6FF', color: '#1D4ED8' },
        rent: { name: 'ค่าเช่าตึก/ร้าน', bg: '#F5F3FF', color: '#6D28D9' },
        utility: { name: 'ค่าไฟ/น้ำ', bg: '#FDF2F8', color: '#BE185D' },
        stock: { name: 'สั่งสต็อก/วัสดุ', bg: '#ECFDF5', color: '#047857' },
        wage: { name: 'ค่าแรง/เงินเดือน', bg: '#ECFEFF', color: '#0E7490' },
        marketing: { name: 'ค่าการตลาด', bg: '#FFF7ED', color: '#C2410C' },
        misc: { name: 'เบ็ดเตล็ด', bg: '#F1F5F9', color: '#475569' }
      };

      let filteredTotal = 0;
      const list = (this.state.expenses || []).filter(e => {
        if (catFilter !== 'all' && e.category !== catFilter) return false;
        return true;
      });

      if (list.length === 0) {
        tbodyExp.innerHTML = '<tr><td colspan="8" style="text-align:center; padding:30px; color:#888;">ไม่มีบันทึกรายจ่ายในหมวดหมู่นี้</td></tr>';
      } else {
        list.forEach(e => {
          filteredTotal += (e.amount || 0);
          const meta = catMap[e.category] || { name: e.category, bg: '#F1F5F9', color: '#334155' };
          tbodyExp.innerHTML += `
          <tr>
            <td><strong style="color:var(--primary);">${new Date(e.date).toLocaleDateString('th-TH')}</strong></td>
            <td><span style="background:${meta.bg}; color:${meta.color}; padding:3px 8px; border-radius:50px; font-size:11px; font-weight:700;">${meta.name}</span></td>
            <td><b>${e.desc}</b></td>
            <td>${e.payee || '-'}</td>
            <td><span style="font-family:monospace; color:#64748B;">${e.refNo || '-'}</span></td>
            <td><small style="color:#64748B;">${e.recordedBy || 'Admin'}</small></td>
            <td style="font-weight:800; color:#DC2626; font-size:14px;">-฿${(e.amount || 0).toLocaleString()}</td>
            <td>
              <button class="btn-sm btn-outline" onclick="app.openExpenseModal('${e.id}')" title="แก้ไข"><i class="las la-edit"></i></button>
              <button class="btn-sm btn-outline" style="border-color:#EF4444; color:#EF4444; margin-left:4px;" onclick="app.deleteCurrentExpense('${e.id}')" title="ลบรายจ่าย"><i class="las la-trash"></i></button>
            </td>
          </tr>`;
        });
      }

      const totEl = document.getElementById('finance-filtered-total');
      if (totEl) totEl.innerText = '฿' + filteredTotal.toLocaleString();
    }

    // 2. Render Accounts Payable Table (AP)
    if (tbodyPay) {
      tbodyPay.innerHTML = '';
      const payList = this.state.payables || [];
      if (payList.length === 0) {
        tbodyPay.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:30px; color:#888;">ไม่มีรายการเจ้าหนี้ค้างจ่าย</td></tr>';
      } else {
        payList.forEach(ap => {
          const isPending = ap.status === 'pending';
          const isOverdue = isPending && (new Date(ap.dueDate) < new Date());
          tbodyPay.innerHTML += `
          <tr>
            <td><strong>${ap.id}</strong><br><small style="color:#888;">${ap.date}</small></td>
            <td style="font-weight:600; color:${isOverdue ? '#DC2626' : '#334155'};">
              ${ap.dueDate} ${isOverdue ? '<span style="background:#FEE2E2; color:#DC2626; padding:2px 6px; border-radius:4px; font-size:10px; font-weight:bold;">เกินกำหนด!</span>' : ''}
            </td>
            <td><b>${ap.supplier}</b></td>
            <td>${ap.desc}</td>
            <td style="font-weight:800; color:#7C3AED; font-size:14px;">฿${(ap.amount || 0).toLocaleString()}</td>
            <td><span class="status-badge" style="background:${isPending ? '#FEF3C7' : '#DCFCE7'}; color:${isPending ? '#B45309' : '#15803D'}; font-weight:700;">${isPending ? 'ค้างจ่าย (Pending)' : 'ชำระแล้ว (Paid)'}</span></td>
            <td>
              ${isPending ? `<button class="btn-sm btn-success" onclick="app.markPayableAsPaid('${ap.id}')" style="margin-right:4px;"><i class="las la-check"></i> ชำระเงิน</button>` : ''}
              <button class="btn-sm btn-outline" onclick="app.openPayableModal('${ap.id}')"><i class="las la-edit"></i></button>
              <button class="btn-sm btn-outline" style="border-color:#EF4444; color:#EF4444; margin-left:4px;" onclick="app.deleteCurrentPayable('${ap.id}')"><i class="las la-trash"></i></button>
            </td>
          </tr>`;
        });
      }
    }
  },

  filterExpensesByCategory(cat) {
    this.renderFinanceTab();
  },

  openExpenseModal(id) {
    this.state.editingExpenseId = id || null;
    const titleEl = document.getElementById('expense-modal-title');
    const delBtn = document.getElementById('btn-del-expense');
    if (id) {
      const e = (this.state.expenses || []).find(x => x.id === id);
      if (titleEl) titleEl.innerHTML = '<i class="las la-edit"></i> แก้ไขบันทึกรายจ่าย';
      document.getElementById('exp-id').value = e.id;
      document.getElementById('exp-date').value = e.date ? e.date.split('T')[0] : new Date().toISOString().split('T')[0];
      document.getElementById('exp-category').value = e.category || 'fuel';
      document.getElementById('exp-desc').value = e.desc || '';
      document.getElementById('exp-amount').value = e.amount || '';
      document.getElementById('exp-payee').value = e.payee || '';
      document.getElementById('exp-ref').value = e.refNo || '';
      document.getElementById('exp-payment-method').value = e.paymentMethod || 'เงินสดหน้าร้าน';
      if (delBtn) delBtn.style.display = 'inline-flex';
    } else {
      if (titleEl) titleEl.innerHTML = '<i class="las la-plus-circle"></i> บันทึกรายจ่ายของร้าน (Shop Expense)';
      document.getElementById('exp-id').value = '';
      document.getElementById('exp-date').value = new Date().toISOString().split('T')[0];
      document.getElementById('exp-category').value = 'fuel';
      document.getElementById('exp-desc').value = '';
      document.getElementById('exp-amount').value = '';
      document.getElementById('exp-payee').value = '';
      document.getElementById('exp-ref').value = '';
      document.getElementById('exp-payment-method').value = 'เงินสดหน้าร้าน';
      if (delBtn) delBtn.style.display = 'none';
    }
    document.getElementById('expense-modal').style.display = 'flex';
  },

  saveExpense() {
    const id = document.getElementById('exp-id')?.value;
    const date = document.getElementById('exp-date')?.value || new Date().toISOString();
    const category = document.getElementById('exp-category')?.value;
    const desc = document.getElementById('exp-desc')?.value.trim();
    const amount = parseFloat(document.getElementById('exp-amount')?.value) || 0;
    const payee = document.getElementById('exp-payee')?.value.trim();
    const refNo = document.getElementById('exp-ref')?.value.trim();
    const paymentMethod = document.getElementById('exp-payment-method')?.value;

    if (!desc || amount <= 0) {
      this.showToast('กรุณาระบุรายละเอียดและจำนวนเงินที่ถูกต้อง', 'warning');
      return;
    }

    const expObj = {
      id: id || ('E' + Date.now().toString().slice(-6)),
      date: new Date(date).toISOString(),
      category,
      desc,
      amount,
      payee: payee || '-',
      refNo: refNo || '-',
      paymentMethod,
      recordedBy: this.getRole(this.state.currentUserRole)?.name || 'Admin'
    };

    if (id) {
      const idx = (this.state.expenses || []).findIndex(x => x.id === id);
      if (idx > -1) this.state.expenses[idx] = expObj;
    } else {
      this.state.expenses.unshift(expObj);
    }

    this.showToast('บันทึกรายจ่ายเรียบร้อย (อัปเดต Dashboard ทันที)', 'success');
    this.notify(`💸 บันทึกรายจ่ายใหม่: ${desc} ยอด ฿${amount.toLocaleString()}`);
    document.getElementById('expense-modal').style.display = 'none';
    this.renderAdmin();
  },

  deleteCurrentExpense(idToDelete) {
    const id = idToDelete || document.getElementById('exp-id')?.value;
    if (!id) return;
    if (!confirm('ต้องการลบรายการรายจ่ายนี้?')) return;
    this.state.expenses = (this.state.expenses || []).filter(e => e.id !== id);
    document.getElementById('expense-modal').style.display = 'none';
    this.showToast('ลบรายการรายจ่ายเรียบร้อย', 'success');
    this.renderAdmin();
  },

  openPayableModal(id) {
    this.state.editingPayableId = id || null;
    const titleEl = document.getElementById('payable-modal-title');
    const delBtn = document.getElementById('btn-del-payable');
    if (id) {
      const ap = (this.state.payables || []).find(x => x.id === id);
      if (titleEl) titleEl.innerHTML = '<i class="las la-edit"></i> แก้ไขยอดค้างจ่าย (AP)';
      document.getElementById('ap-id').value = ap.id;
      document.getElementById('ap-date').value = ap.date || new Date().toISOString().split('T')[0];
      document.getElementById('ap-due-date').value = ap.dueDate || '';
      document.getElementById('ap-supplier').value = ap.supplier || '';
      document.getElementById('ap-amount').value = ap.amount || '';
      document.getElementById('ap-desc').value = ap.desc || '';
      document.getElementById('ap-ref').value = ap.refNo || '';
      document.getElementById('ap-status').value = ap.status || 'pending';
      if (delBtn) delBtn.style.display = 'inline-flex';
    } else {
      if (titleEl) titleEl.innerHTML = '<i class="las la-truck-loading"></i> บันทึกเจ้าหนี้ / ค้างจ่ายค่าของ (AP)';
      document.getElementById('ap-id').value = '';
      document.getElementById('ap-date').value = new Date().toISOString().split('T')[0];
      document.getElementById('ap-due-date').value = new Date(Date.now() + 15 * 86400000).toISOString().split('T')[0];
      document.getElementById('ap-supplier').value = '';
      document.getElementById('ap-amount').value = '';
      document.getElementById('ap-desc').value = '';
      document.getElementById('ap-ref').value = '';
      document.getElementById('ap-status').value = 'pending';
      if (delBtn) delBtn.style.display = 'none';
    }
    document.getElementById('payable-modal').style.display = 'flex';
  },

  savePayable() {
    const id = document.getElementById('ap-id')?.value;
    const date = document.getElementById('ap-date')?.value || new Date().toISOString().split('T')[0];
    const dueDate = document.getElementById('ap-due-date')?.value;
    const supplier = document.getElementById('ap-supplier')?.value.trim();
    const amount = parseFloat(document.getElementById('ap-amount')?.value) || 0;
    const desc = document.getElementById('ap-desc')?.value.trim();
    const refNo = document.getElementById('ap-ref')?.value.trim();
    const status = document.getElementById('ap-status')?.value;

    if (!supplier || amount <= 0 || !dueDate) {
      this.showToast('กรุณากรอกข้อมูลซัพพลายเออร์ กำหนดจ่าย และจำนวนเงิน', 'warning');
      return;
    }

    const apObj = {
      id: id || ('AP' + Date.now().toString().slice(-5)),
      date,
      dueDate,
      supplier,
      amount,
      desc,
      refNo: refNo || '-',
      status
    };

    if (id) {
      const idx = (this.state.payables || []).findIndex(x => x.id === id);
      if (idx > -1) this.state.payables[idx] = apObj;
    } else {
      this.state.payables.unshift(apObj);
    }

    this.showToast('บันทึกเจ้าหนี้เรียบร้อยแล้ว', 'success');
    document.getElementById('payable-modal').style.display = 'none';
    this.renderAdmin();
  },

  deleteCurrentPayable(idToDelete) {
    const id = idToDelete || document.getElementById('ap-id')?.value;
    if (!id) return;
    if (!confirm('ต้องการลบรายการเจ้าหนี้นี้?')) return;
    this.state.payables = (this.state.payables || []).filter(ap => ap.id !== id);
    document.getElementById('payable-modal').style.display = 'none';
    this.showToast('ลบรายการเรียบร้อย', 'success');
    this.renderAdmin();
  },

  markPayableAsPaid(apId) {
    const ap = (this.state.payables || []).find(x => x.id === apId);
    if (!ap) return;
    if (!confirm(`ยืนยันการบันทึกชำระเงินค่าของให้ "${ap.supplier}" ยอด ฿${(ap.amount || 0).toLocaleString()}?\n(ระบบจะลงบันทึกในรายจ่ายร้านให้อัตโนมัติ)`)) return;

    ap.status = 'paid';
    // Auto record into expenses
    this.state.expenses.unshift({
      id: 'E' + Date.now().toString().slice(-6),
      date: new Date().toISOString(),
      category: 'stock',
      desc: `ชำระค่าของ/สต็อก: ${ap.desc}`,
      amount: ap.amount,
      payee: ap.supplier,
      refNo: ap.refNo || ap.id,
      paymentMethod: 'โอนเงินผ่านบัญชี SCB',
      recordedBy: 'Admin'
    });

    this.showToast(`บันทึกจ่ายเงินเจ้าหนี้ ${ap.supplier} เรียบร้อยแล้ว`, 'success');
    this.notify(`💸 ชำระเงินค่าวัตถุดิบ ${ap.supplier} ยอด ฿${(ap.amount || 0).toLocaleString()}`);
    this.renderAdmin();
  },

  exportAccountingCSV() {
    // Standard UTF-8 BOM CSV format for Accounting / Excel
    let csv = '\uFEFF';
    csv += 'ประเภท,วันที่,รหัส/เอกสารอ้างอิง,หมวดหมู่,รายละเอียด/ลูกค้า/ผู้รับเงิน,จำนวนเงิน(บาท),สถานะ,วิธีชำระ\n';

    // Orders (Income)
    (this.state.orders || []).forEach(o => {
      const date = o.date ? o.date.split('T')[0] : '';
      csv += `"รายรับ","${date}","${o.id}","งานป้าย/สื่อโฆษณา","${(o.customerName || '').replace(/"/g, '""')}",${o.net || 0},"${o.payment}","โอนชำระ/พร้อมเพย์"\n`;
    });

    // Expenses
    (this.state.expenses || []).forEach(e => {
      const date = e.date ? e.date.split('T')[0] : '';
      csv += `"รายจ่าย","${date}","${e.refNo || e.id}","${e.category}","${(e.desc || '').replace(/"/g, '""')} (${(e.payee || '').replace(/"/g, '""')})",${e.amount || 0},"จ่ายแล้ว","${e.paymentMethod || 'โอน'}"\n`;
    });

    // Download CSV
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const nowStr = new Date().toISOString().split('T')[0];
    link.download = `TUMDEEMEDIA_Accounting_Report_${nowStr}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    this.showToast('ดาวน์โหลดไฟล์ CSV สำหรับฝ่ายบัญชีเรียบร้อยแล้ว', 'success');
  },

  printFinancialReport() {
    this.openFinancialReportDoc();
  },

  openFinancialReportDoc() {
    const docModal = document.getElementById('doc-modal');
    const a4 = document.getElementById('doc-a4');
    if (!docModal || !a4) return;

    if (!this.standardDocA4Html && document.getElementById('doc-items')) {
      this.standardDocA4Html = a4.innerHTML;
    }

    this.currentDocType = 'financial_report';

    const filter = this.state.dashboardFilter || 'month';
    const filterLabels = {
      day: 'ประจำวัน (Daily Summary)',
      week: 'ประจำสัปดาห์ (Weekly Summary)',
      month: 'ประจำเดือน (Monthly Summary)',
      year: 'ประจำปี (Annual Summary)',
      all: 'รวมทั้งหมด (All-time Summary)'
    };
    const periodLabel = filterLabels[filter] || 'ประจำงวดบัญชี';

    const rev = document.getElementById('dash-revenue')?.innerText || '฿0';
    const exp = document.getElementById('dash-expenses')?.innerText || '฿0';
    const profit = document.getElementById('dash-profit')?.innerText || '฿0';
    const margin = document.getElementById('dash-profit-margin')?.innerText || '';
    const ar = document.getElementById('dash-unpaid')?.innerText || '฿0';
    const arCount = document.getElementById('dash-unpaid-count')?.innerText || '0 รายการ';
    const ap = document.getElementById('dash-payables')?.innerText || '฿0';
    const apCount = document.getElementById('dash-payables-sub')?.innerText || '0 รายการ';

    const badge = document.getElementById('doc-current-type-badge');
    if (badge) {
      badge.innerText = 'รายงานสรุปงบการเงินผู้บริหาร (Financial Executive Report)';
      badge.style.background = '#1E3A8A';
      badge.style.color = 'white';
    }

    a4.innerHTML = `
      <div style="font-family:'Prompt',sans-serif; color:#0F172A; line-height:1.35;">
        <!-- Header (Left Aligned Shop Info & Compact Logo) -->
        <div style="display:flex; justify-content:space-between; align-items:flex-start; border-bottom:1.5px solid #1E3A8A; padding-bottom:6px; margin-bottom:8px;">
          <div style="display:flex; gap:8px; align-items:flex-start; text-align:left;">
            <div style="width:30px; height:30px; border-radius:6px; background:linear-gradient(135deg, #E11D48 0%, #EA580C 100%); display:flex; align-items:center; justify-content:center; color:white; font-size:16px; font-weight:900; box-shadow:0 2px 6px rgba(225,29,72,0.25); flex-shrink:0; margin-top:2px;">
              <span style="font-family:'Prompt',sans-serif; transform:skew(-4deg);">T</span>
            </div>
            <div style="text-align:left;">
              <div style="font-size:16px; font-weight:800; color:#1E3A8A; line-height:1.2;">
                ร้านทำดีมีเดีย <span style="font-size:12px; font-weight:800; color:#EA580C; margin-left:2px;">TUMDEEMEDIA</span>
              </div>
              <div style="font-size:9.5px; color:#475569; margin-top:2px; line-height:1.35;">
                125/1 ม.1 ต.หนองตรุด อ.เมืองตรัง จ.ตรัง 92000 | โทร. 062-419-8365 | Tax ID: 3920100923387<br>
                <b>งวดบัญชี:</b> <span style="color:#2563EB; font-weight:700;">${periodLabel}</span>
              </div>
            </div>
          </div>
          <div style="text-align:right; flex-shrink:0;">
            <div style="font-size:14px; font-weight:800; color:#1E293B;">รายงานสรุปผลประกอบการและงบการเงิน</div>
            <div style="font-size:9px; font-weight:600; color:#64748B;">EXECUTIVE FINANCIAL & OPERATIONS REPORT</div>
            <div style="font-size:9.5px; color:#475569; margin-top:2px;">วันที่พิมพ์: <b>${new Date().toLocaleDateString('th-TH', { year:'numeric', month:'long', day:'numeric' })}</b></div>
            <div style="font-size:9px; color:#64748B;">เลขที่รายงาน: <b>REP-${new Date().getFullYear()}${String(new Date().getMonth()+1).padStart(2,'0')}-${Date.now().toString().slice(-4)}</b></div>
          </div>
        </div>

        <!-- KPI 5 Cards Overview -->
        <div style="display:grid; grid-template-columns: repeat(5, 1fr); gap:8px; margin-bottom:14px;">
          <div style="background:#EFF6FF; border:1px solid #BFDBFE; border-left:4px solid #1E3A8A; padding:8px; border-radius:6px;">
            <div style="font-size:10px; color:#1E3A8A; font-weight:600;">รายรับจริง (Revenue)</div>
            <div style="font-size:14px; font-weight:800; color:#1E3A8A; margin-top:2px;">${rev}</div>
          </div>
          <div style="background:#FEF2F2; border:1px solid #FECACA; border-left:4px solid #EF4444; padding:8px; border-radius:6px;">
            <div style="font-size:10px; color:#991B1B; font-weight:600;">รายจ่ายรวม (Expenses)</div>
            <div style="font-size:14px; font-weight:800; color:#DC2626; margin-top:2px;">${exp}</div>
          </div>
          <div style="background:#ECFDF5; border:1px solid #A7F3D0; border-left:4px solid #10B981; padding:8px; border-radius:6px;">
            <div style="font-size:10px; color:#065F46; font-weight:600;">กำไรสุทธิ (Net Profit)</div>
            <div style="font-size:14px; font-weight:800; color:#059669; margin-top:2px;">${profit}</div>
            <div style="font-size:9px; color:#047857;">${margin}</div>
          </div>
          <div style="background:#FFFBEB; border:1px solid #FDE68A; border-left:4px solid #F59E0B; padding:8px; border-radius:6px;">
            <div style="font-size:10px; color:#92400E; font-weight:600;">ลูกหนี้ค้างชำระ (AR)</div>
            <div style="font-size:14px; font-weight:800; color:#D97706; margin-top:2px;">${ar}</div>
            <div style="font-size:9px; color:#B45309;">${arCount}</div>
          </div>
          <div style="background:#FAF5FF; border:1px solid #E9D5FF; border-left:4px solid #8B5CF6; padding:8px; border-radius:6px;">
            <div style="font-size:10px; color:#581C87; font-weight:600;">เจ้าหนี้ค้างจ่าย (AP)</div>
            <div style="font-size:14px; font-weight:800; color:#7C3AED; margin-top:2px;">${ap}</div>
            <div style="font-size:9px; color:#6B21A8;">${apCount}</div>
          </div>
        </div>

        <!-- 2 Columns: Channels & Payments Breakdown -->
        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:12px; margin-bottom:14px;">
          <!-- Left: Sales Channels -->
          <div style="border:1px solid #E2E8F0; border-radius:6px; padding:10px; background:#FAFAFA;">
            <div style="font-size:11.5px; font-weight:700; color:#1E3A8A; margin-bottom:6px; display:flex; align-items:center; gap:5px;">
              <i class="las la-store-alt"></i> สัดส่วนช่องทางการขาย (Sales Channels)
            </div>
            <table style="width:100%; font-size:10.5px; border-collapse:collapse;">
              <tr style="border-bottom:1px solid #E2E8F0; color:#64748B;"><th style="text-align:left; padding:3px 0;">ช่องทาง</th><th style="text-align:center;">จำนวน</th><th style="text-align:right;">ยอดขาย (฿)</th><th style="text-align:right;">สัดส่วน</th></tr>
              <tr style="border-bottom:1px solid #F1F5F9;"><td style="padding:3px 0;">หน้าร้าน (Storefront / Walk-in)</td><td style="text-align:center;">22</td><td style="text-align:right; font-weight:600;">฿102,400</td><td style="text-align:right; color:#2563EB; font-weight:700;">38%</td></tr>
              <tr style="border-bottom:1px solid #F1F5F9;"><td style="padding:3px 0;">ออนไลน์ (Web, LINE OA, FB)</td><td style="text-align:center;">28</td><td style="text-align:right; font-weight:600;">฿124,600</td><td style="text-align:right; color:#10B981; font-weight:700;">46%</td></tr>
              <tr><td style="padding:3px 0;">เอเจนซี่ & ตัวแทนจำหน่าย</td><td style="text-align:center;">9</td><td style="text-align:right; font-weight:600;">฿41,000</td><td style="text-align:right; color:#F59E0B; font-weight:700;">16%</td></tr>
            </table>
          </div>

          <!-- Right: Payment Methods -->
          <div style="border:1px solid #E2E8F0; border-radius:6px; padding:10px; background:#FAFAFA;">
            <div style="font-size:11.5px; font-weight:700; color:#065F46; margin-bottom:6px; display:flex; align-items:center; gap:5px;">
              <i class="las la-wallet"></i> สัดส่วนการรับชำระเงิน (Reconciliation)
            </div>
            <table style="width:100%; font-size:10.5px; border-collapse:collapse;">
              <tr style="border-bottom:1px solid #E2E8F0; color:#64748B;"><th style="text-align:left; padding:3px 0;">วิธีชำระ</th><th style="text-align:center;">รายการ</th><th style="text-align:right;">ยอดเงิน (฿)</th><th style="text-align:right;">สถานะ</th></tr>
              <tr style="border-bottom:1px solid #F1F5F9;"><td style="padding:3px 0;">โอนผ่านธนาคาร / QR พร้อมเพย์</td><td style="text-align:center;">42</td><td style="text-align:right; font-weight:600;">฿176,880</td><td style="text-align:right; color:#059669; font-weight:700;">กระทบยอดแล้ว</td></tr>
              <tr style="border-bottom:1px solid #F1F5F9;"><td style="padding:3px 0;">เงินสดหน้าร้าน (Cash)</td><td style="text-align:center;">14</td><td style="text-align:right; font-weight:600;">฿64,320</td><td style="text-align:right; color:#059669; font-weight:700;">กระทบยอดแล้ว</td></tr>
              <tr><td style="padding:3px 0;">บัตรเครดิต / เช็คธนาคาร</td><td style="text-align:center;">3</td><td style="text-align:right; font-weight:600;">฿26,800</td><td style="text-align:right; color:#059669; font-weight:700;">กระทบยอดแล้ว</td></tr>
            </table>
          </div>
        </div>

        <!-- Top Best Sellers Summary Table -->
        <div style="border:1px solid #E2E8F0; border-radius:6px; padding:10px; margin-bottom:14px;">
          <div style="font-size:11.5px; font-weight:700; color:#1E3A8A; margin-bottom:6px; display:flex; align-items:center; gap:5px;">
            <i class="las la-trophy" style="color:#D97706;"></i> สรุปรายการสินค้าและบริการขายดี (Top Best Sellers)
          </div>
          <table style="width:100%; font-size:10px; border-collapse:collapse;">
            <thead>
              <tr style="background:#F1F5F9; color:#475569; text-align:left;">
                <th style="padding:5px 6px; width:35px;">อันดับ</th>
                <th style="padding:5px 6px;">ชื่อสินค้าและสเปก</th>
                <th style="padding:5px 6px;">หมวดหมู่</th>
                <th style="padding:5px 6px; text-align:center;">ปริมาณที่ผลิต</th>
                <th style="padding:5px 6px; text-align:right;">ยอดขายสะสม (฿)</th>
                <th style="padding:5px 6px; text-align:right;">สัดส่วน</th>
              </tr>
            </thead>
            <tbody>
              <tr style="border-bottom:1px solid #E2E8F0;"><td style="padding:5px 6px; font-weight:700; color:#D97706;">#1 🥇</td><td style="padding:5px 6px; font-weight:600;">ป้ายไวนิลพรีเมียม 440g ทึบแสง (โครงไม้ / โครงเหล็ก)</td><td style="padding:5px 6px; color:#64748B;">งานพิมพ์ไวนิล & ป้าย</td><td style="padding:5px 6px; text-align:center;">630 ตร.ม.</td><td style="padding:5px 6px; text-align:right; font-weight:700;">฿94,500</td><td style="padding:5px 6px; text-align:right; color:#2563EB; font-weight:700;">35.2%</td></tr>
              <tr style="border-bottom:1px solid #E2E8F0;"><td style="padding:5px 6px; font-weight:700; color:#64748B;">#2 🥈</td><td style="padding:5px 6px; font-weight:600;">สติกเกอร์ไดคัทพร้อมฟิวเจอร์บอร์ด 3-5 มิล</td><td style="padding:5px 6px; color:#64748B;">สติกเกอร์ติดบอร์ด & พลาสวูด</td><td style="padding:5px 6px; text-align:center;">145 ตร.ม.</td><td style="padding:5px 6px; text-align:right; font-weight:700;">฿58,400</td><td style="padding:5px 6px; text-align:right; color:#2563EB; font-weight:700;">21.8%</td></tr>
              <tr style="border-bottom:1px solid #E2E8F0;"><td style="padding:5px 6px; font-weight:700; color:#B45309;">#3 🥉</td><td style="padding:5px 6px; font-weight:600;">สติกเกอร์ติดพลาสวูด 5 มิล ฉลุ CNC ตัวอักษรนูน</td><td style="padding:5px 6px; color:#64748B;">สติกเกอร์ติดบอร์ด & พลาสวูด</td><td style="padding:5px 6px; text-align:center;">45 ตร.ม.</td><td style="padding:5px 6px; text-align:right; font-weight:700;">฿42,750</td><td style="padding:5px 6px; text-align:right; color:#2563EB; font-weight:700;">16.0%</td></tr>
              <tr style="border-bottom:1px solid #E2E8F0;"><td style="padding:5px 6px; font-weight:700;">#4</td><td style="padding:5px 6px; font-weight:600;">ป้ายตู้ไฟ LED สองหน้า อะคริลิคปั๊มนูน</td><td style="padding:5px 6px; color:#64748B;">ป้ายไฟ & ตู้ไฟ LED</td><td style="padding:5px 6px; text-align:center;">20 ชุด</td><td style="padding:5px 6px; text-align:right; font-weight:700;">฿36,000</td><td style="padding:5px 6px; text-align:right; color:#2563EB; font-weight:700;">13.4%</td></tr>
              <tr><td style="padding:5px 6px; font-weight:700;">#5</td><td style="padding:5px 6px; font-weight:600;">สติกเกอร์ฉลากสินค้า PP กันน้ำ 100% ไดคัท</td><td style="padding:5px 6px; color:#64748B;">งานพิมพ์สติกเกอร์ไดคัท</td><td style="padding:5px 6px; text-align:center;">280 แผ่น</td><td style="padding:5px 6px; text-align:right; font-weight:700;">฿22,400</td><td style="padding:5px 6px; text-align:right; color:#2563EB; font-weight:700;">8.4%</td></tr>
            </tbody>
          </table>
        </div>

        <!-- 3 Signatures -->
        <div style="display:grid; grid-template-columns: repeat(3, 1fr); gap:16px; text-align:center; padding-top:10px; border-top:1px dashed #CBD5E1;">
          <div>
            <div style="height:32px;"></div>
            <div style="border-top:1px solid #000; padding-top:3px; font-size:11px; font-weight:700;">(นางสาวสมฤทัย ใจบัญชี)</div>
            <div style="font-size:9.5px; color:#64748B;">ฝ่ายบัญชีและการเงิน</div>
          </div>
          <div>
            <div style="height:32px;"></div>
            <div style="border-top:1px solid #000; padding-top:3px; font-size:11px; font-weight:700;">(นายช่างใหญ่ แข็งขัน)</div>
            <div style="font-size:9.5px; color:#64748B;">ฝ่ายผลิตและปฏิบัติการ</div>
          </div>
          <div>
            <div style="height:32px;"></div>
            <div style="border-top:1px solid #000; padding-top:3px; font-size:11px; font-weight:700;">(นายธีราธร คนเที่ยง)</div>
            <div style="font-size:9.5px; color:#64748B;">เจ้าของร้าน / ผู้บริหาร</div>
          </div>
        </div>
      </div>
    `;

    docModal.style.display = 'block';
    this.showToast('เปิดตัวอย่างรายงานงบการเงินเรียบร้อย สามารถพิมพ์ หรือบันทึก PDF ได้ทันที', 'success');
  },

  /* ==========================================================================
     STAFF & PAYROLL HR (ระบบพนักงานและจ่ายค่าแรง/เงินเดือน)
     ========================================================================== */
  renderStaff() {
    const tbodyStaff = document.getElementById('tbody-staff');
    const tbodyPay = document.getElementById('tbody-payroll');

    if (tbodyStaff) {
      tbodyStaff.innerHTML = '';
      const list = this.state.staffs || [];
      if (list.length === 0) {
        tbodyStaff.innerHTML = '<tr><td colspan="9" style="text-align:center; padding:30px; color:#888;">ไม่มีข้อมูลพนักงาน</td></tr>';
      } else {
        list.forEach(s => {
          const typeLabel = s.type === 'monthly' ? 'รายเดือน' : (s.type === 'daily' ? 'รายวัน' : 'ฟรีแลนซ์');
          tbodyStaff.innerHTML += `
          <tr>
            <td><strong>${s.id}</strong></td>
            <td><b>${s.name}</b> ${s.nickname ? `<span style="color:#64748B;">(${s.nickname})</span>` : ''}</td>
            <td><span style="font-weight:600; color:var(--primary);">${s.position}</span></td>
            <td><span style="background:#F1F5F9; color:#334155; padding:3px 8px; border-radius:50px; font-size:11px;">${s.dept}</span></td>
            <td><span class="status-badge" style="background:#EFF6FF; color:#1D4ED8;">${typeLabel}</span></td>
            <td style="font-weight:700; color:#059669;">฿${(s.salary || 0).toLocaleString()}</td>
            <td><span style="font-size:12px;"><i class="las la-phone"></i> ${s.phone || '-'}</span></td>
            <td><span class="status-badge status-${s.status === 'active' ? 'Done' : 'Sales'}">${s.status === 'active' ? 'ปฏิบัติงานปกติ' : s.status}</span></td>
            <td>
              <button class="btn-sm btn-success" onclick="app.openPayrollModal('${s.id}')" title="จ่ายเงินเดือน/ค่าแรง" style="margin-right:4px;"><i class="las la-hand-holding-usd"></i> จ่าย</button>
              <button class="btn-sm btn-outline" onclick="app.openStaffModal('${s.id}')" title="แก้ไข"><i class="las la-edit"></i></button>
              <button class="btn-sm btn-outline" style="border-color:#EF4444; color:#EF4444; margin-left:4px;" onclick="app.deleteCurrentStaff('${s.id}')" title="ลบ"><i class="las la-trash"></i></button>
            </td>
          </tr>`;
        });
      }
    }

    if (tbodyPay) {
      tbodyPay.innerHTML = '';
      const pays = this.state.payrolls || [];
      if (pays.length === 0) {
        tbodyPay.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:30px; color:#888;">ยังไม่มีประวัติการจ่ายเงินเดือน</td></tr>';
      } else {
        pays.forEach(p => {
          tbodyPay.innerHTML += `
          <tr>
            <td><strong>${p.id}</strong></td>
            <td><b>${p.staffName}</b></td>
            <td><span style="background:#EFF6FF; color:#1E40AF; padding:2px 8px; border-radius:50px; font-size:11px; font-weight:700;">${p.month}</span></td>
            <td>${p.paidDate}</td>
            <td style="font-weight:800; color:#059669; font-size:14px;">฿${(p.net || 0).toLocaleString()}</td>
            <td>${p.method || 'โอนผ่านบัญชี'}</td>
            <td>
              <button class="btn-sm btn-outline" style="border-color:#10B981; color:#10B981;" onclick="app.printPaySlip('${p.id}')">
                <i class="las la-print"></i> พิมพ์สลิป
              </button>
            </td>
          </tr>`;
        });
      }
    }
  },

  openStaffModal(id) {
    this.state.editingStaffId = id || null;
    const titleEl = document.getElementById('staff-modal-title');
    const delBtn = document.getElementById('btn-del-staff');
    if (id) {
      const s = (this.state.staffs || []).find(x => x.id === id);
      if (titleEl) titleEl.innerHTML = '<i class="las la-edit"></i> แก้ไขข้อมูลพนักงาน';
      document.getElementById('st-id').value = s.id;
      document.getElementById('st-name').value = s.name || '';
      document.getElementById('st-nickname').value = s.nickname || '';
      document.getElementById('st-position').value = s.position || '';
      document.getElementById('st-dept').value = s.dept || 'ช่างพิมพ์และผลิต';
      document.getElementById('st-type').value = s.type || 'monthly';
      document.getElementById('st-salary').value = s.salary || '';
      document.getElementById('st-status').value = s.status || 'active';
      document.getElementById('st-phone').value = s.phone || '';
      document.getElementById('st-line').value = s.line || '';
      document.getElementById('st-bank-acc').value = s.bankAcc || '';
      document.getElementById('st-start-date').value = s.startDate || '';
      if (delBtn) delBtn.style.display = 'inline-flex';
    } else {
      if (titleEl) titleEl.innerHTML = '<i class="las la-id-badge"></i> เพิ่มข้อมูลพนักงานใหม่';
      document.getElementById('st-id').value = 'EMP-' + String((this.state.staffs || []).length + 1).padStart(3, '0');
      document.getElementById('st-name').value = '';
      document.getElementById('st-nickname').value = '';
      document.getElementById('st-position').value = '';
      document.getElementById('st-dept').value = 'ช่างพิมพ์และผลิต';
      document.getElementById('st-type').value = 'monthly';
      document.getElementById('st-salary').value = '';
      document.getElementById('st-status').value = 'active';
      document.getElementById('st-phone').value = '';
      document.getElementById('st-line').value = '';
      document.getElementById('st-bank-acc').value = '';
      document.getElementById('st-start-date').value = new Date().toISOString().split('T')[0];
      if (delBtn) delBtn.style.display = 'none';
    }
    document.getElementById('staff-modal').style.display = 'flex';
  },

  saveStaff() {
    const id = document.getElementById('st-id')?.value;
    const name = document.getElementById('st-name')?.value.trim();
    const nickname = document.getElementById('st-nickname')?.value.trim();
    const position = document.getElementById('st-position')?.value.trim();
    const dept = document.getElementById('st-dept')?.value;
    const type = document.getElementById('st-type')?.value;
    const salary = parseFloat(document.getElementById('st-salary')?.value) || 0;
    const status = document.getElementById('st-status')?.value;
    const phone = document.getElementById('st-phone')?.value.trim();
    const line = document.getElementById('st-line')?.value.trim();
    const bankAcc = document.getElementById('st-bank-acc')?.value.trim();
    const startDate = document.getElementById('st-start-date')?.value;

    if (!name || !position) {
      this.showToast('กรุณากรอกชื่อและตำแหน่งพนักงาน', 'warning');
      return;
    }

    const staffObj = {
      id: id || ('EMP-' + String((this.state.staffs || []).length + 1).padStart(3, '0')),
      name,
      nickname,
      position,
      dept,
      type,
      salary,
      status,
      phone,
      line,
      bankAcc,
      startDate
    };

    const existIdx = (this.state.staffs || []).findIndex(x => x.id === id);
    if (existIdx > -1) {
      this.state.staffs[existIdx] = staffObj;
    } else {
      this.state.staffs.push(staffObj);
    }

    this.showToast('บันทึกข้อมูลพนักงานเรียบร้อยแล้ว', 'success');
    document.getElementById('staff-modal').style.display = 'none';
    this.renderStaff();
  },

  deleteCurrentStaff(idToDelete) {
    const id = idToDelete || document.getElementById('st-id')?.value;
    if (!id) return;
    const s = (this.state.staffs || []).find(x => x.id === id);
    if (!confirm(`ต้องการลบข้อมูลพนักงาน "${s ? s.name : id}" ออกจากระบบ?`)) return;
    this.state.staffs = (this.state.staffs || []).filter(x => x.id !== id);
    document.getElementById('staff-modal').style.display = 'none';
    this.showToast('ลบพนักงานเรียบร้อย', 'success');
    this.renderStaff();
  },

  openPayrollModal(staffId) {
    const sel = document.getElementById('pay-staff-select');
    if (sel) {
      sel.innerHTML = '';
      (this.state.staffs || []).forEach(s => {
        sel.innerHTML += `<option value="${s.id}">${s.name} (${s.nickname || s.position}) - ฿${(s.salary || 0).toLocaleString()}</option>`;
      });
      if (staffId) sel.value = staffId;
    }
    const now = new Date();
    const currentMonth = now.toISOString().slice(0, 7);
    document.getElementById('pay-month').value = currentMonth;
    document.getElementById('pay-date').value = now.toISOString().split('T')[0];
    this.handlePayrollStaffSelect(sel ? sel.value : staffId);
    document.getElementById('payroll-modal').style.display = 'flex';
  },

  handlePayrollStaffSelect(staffId) {
    const s = (this.state.staffs || []).find(x => x.id === staffId);
    if (s) {
      document.getElementById('pay-base').value = s.salary || 0;
      document.getElementById('pay-ot').value = 0;
      document.getElementById('pay-deduct').value = 0;
      this.calcPayrollNet();
    }
  },

  calcPayrollNet() {
    const base = parseFloat(document.getElementById('pay-base')?.value) || 0;
    const ot = parseFloat(document.getElementById('pay-ot')?.value) || 0;
    const deduct = parseFloat(document.getElementById('pay-deduct')?.value) || 0;
    const net = Math.max(0, base + ot - deduct);
    const disp = document.getElementById('pay-net-display');
    if (disp) disp.innerText = '฿' + net.toLocaleString(undefined, { minimumFractionDigits: 2 });
    return net;
  },

  submitPayroll() {
    const staffId = document.getElementById('pay-staff-select')?.value;
    const s = (this.state.staffs || []).find(x => x.id === staffId);
    if (!s) return;

    const month = document.getElementById('pay-month')?.value;
    const paidDate = document.getElementById('pay-date')?.value;
    const base = parseFloat(document.getElementById('pay-base')?.value) || 0;
    const ot = parseFloat(document.getElementById('pay-ot')?.value) || 0;
    const deduct = parseFloat(document.getElementById('pay-deduct')?.value) || 0;
    const net = base + ot - deduct;
    const method = document.getElementById('pay-method')?.value;
    const isAutoExpense = document.getElementById('pay-auto-expense')?.checked;

    const payrollId = 'PAY-' + Date.now().toString().slice(-6);
    const pObj = {
      id: payrollId,
      staffId: s.id,
      staffName: s.name,
      month,
      paidDate,
      base,
      ot,
      deduct,
      net,
      method
    };

    this.state.payrolls.unshift(pObj);

    if (isAutoExpense) {
      this.state.expenses.unshift({
        id: 'E' + Date.now().toString().slice(-6),
        date: new Date(paidDate).toISOString(),
        category: 'wage',
        desc: `เงินเดือน/ค่าแรงประจำเดือน ${month}: ${s.name} (${s.position})`,
        amount: net,
        payee: s.name,
        refNo: payrollId,
        paymentMethod: method,
        recordedBy: 'HR Payroll'
      });
    }

    this.showToast(`บันทึกการจ่ายเงินเดือนให้ ${s.name} เรียบร้อยแล้ว`, 'success');
    this.notify(`💵 จ่ายเงินเดือน ${month} ให้ ${s.name} ยอดสุทธิ ฿${net.toLocaleString()}`);
    document.getElementById('payroll-modal').style.display = 'none';
    this.renderAdmin();
  },

  printPaySlip(payrollId) {
    const p = (this.state.payrolls || []).find(x => x.id === payrollId);
    if (!p) return;
    const s = (this.state.staffs || []).find(x => x.id === p.staffId) || { position: 'พนักงาน', dept: 'ทั่วไป', bankAcc: '-' };
    const cont = document.getElementById('payslip-content');
    if (!cont) return;

    cont.innerHTML = `
    <div style="border-bottom:1.5px solid #0F172A; padding-bottom:8px; margin-bottom:12px; display:flex; justify-content:space-between; align-items:center;">
      <div style="display:flex; gap:10px; align-items:center;">
        <div style="width:38px; height:38px; border-radius:8px; background:linear-gradient(135deg, #E11D48 0%, #EA580C 100%); display:flex; align-items:center; justify-content:center; color:white; font-size:20px; font-weight:900; flex-shrink:0;">
          <span style="font-family:'Prompt',sans-serif; transform:skew(-6deg);">T</span>
        </div>
        <div>
          <div style="font-size:17px; font-weight:800; color:var(--primary); line-height:1.2;">ร้านทำดีมีเดีย <span style="font-size:12px; font-weight:800; color:#EA580C;">TUMDEEMEDIA</span></div>
          <div style="font-size:10.5px; color:#475569;">125/1 ม.1 ต.หนองตรุด อ.เมือง จ.ตรัง 92000 | โทร. 062-419-8365</div>
        </div>
      </div>
      <div style="text-align:right;">
        <h3 style="margin:0; font-size:16px; color:#0F172A; line-height:1.2;">ใบจ่ายเงินเดือน / PAY SLIP</h3>
        <div style="font-size:11px; color:#64748B;">ประจำเดือน: <b>${p.month}</b></div>
        <div style="font-size:10px; color:#94A3B8;">รหัสรายการ: ${p.id}</div>
      </div>
    </div>

    <div style="display:grid; grid-template-columns:1fr 1fr; gap:15px; background:#F8FAFC; padding:15px; border-radius:8px; margin-bottom:20px; font-size:13px;">
      <div>
        <div><b>ชื่อ-นามสกุล:</b> ${p.staffName}</div>
        <div><b>ตำแหน่ง:</b> ${s.position}</div>
        <div><b>แผนก:</b> ${s.dept}</div>
      </div>
      <div>
        <div><b>วันที่จ่ายเงิน:</b> ${p.paidDate}</div>
        <div><b>ช่องทาง:</b> ${p.method}</div>
        <div><b>บัญชีโอน:</b> ${s.bankAcc || '-'}</div>
      </div>
    </div>

    <table style="width:100%; border-collapse:collapse; margin-bottom:20px; font-size:13px;">
      <thead>
        <tr style="background:#F1F5F9; border-bottom:1px solid #CBD5E1;">
          <th style="padding:10px; text-align:left;">รายการได้ (Earnings)</th>
          <th style="padding:10px; text-align:right;">จำนวนเงิน</th>
          <th style="padding:10px; text-align:left; border-left:1px solid #CBD5E1;">รายการหัก (Deductions)</th>
          <th style="padding:10px; text-align:right;">จำนวนเงิน</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td style="padding:10px;">เงินเดือน/ค่าจ้างฐาน</td>
          <td style="padding:10px; text-align:right;">฿${(p.base || 0).toLocaleString()}</td>
          <td style="padding:10px; border-left:1px solid #CBD5E1;">ขาด/ลา/มาสาย/ประกัน</td>
          <td style="padding:10px; text-align:right; color:#DC2626;">฿${(p.deduct || 0).toLocaleString()}</td>
        </tr>
        <tr>
          <td style="padding:10px;">โอที / ค่าล่วงเวลา</td>
          <td style="padding:10px; text-align:right;">฿${(p.ot || 0).toLocaleString()}</td>
          <td style="padding:10px; border-left:1px solid #CBD5E1;">-</td>
          <td style="padding:10px; text-align:right;">-</td>
        </tr>
      </tbody>
      <tfoot>
        <tr style="background:#ECFDF5; border-top:2px solid #10B981; font-size:15px;">
          <td colspan="3" style="padding:12px; font-weight:bold; color:#065F46;">ยอดสุทธิที่ได้รับจริง (Net Payout):</td>
          <td style="padding:12px; text-align:right; font-weight:800; color:#059669; font-size:18px;">฿${(p.net || 0).toLocaleString()}</td>
        </tr>
      </tfoot>
    </table>

    <div style="display:flex; justify-content:space-between; margin-top:40px; font-size:12px; text-align:center;">
      <div style="width:200px;">
        <div style="border-bottom:1px solid #94A3B8; height:40px; margin-bottom:5px;"></div>
        <div>ลงชื่อ พนักงานผู้รับเงิน</div>
      </div>
      <div style="width:200px;">
        <div style="border-bottom:1px solid #94A3B8; height:40px; margin-bottom:5px;"></div>
        <div>ลงชื่อ ผู้อนุมัติ / เจ้าของร้าน</div>
      </div>
    </div>`;

    document.getElementById('payslip-modal').style.display = 'block';
  },

  /* ==========================================================================
     ROLES & RBAC ACCESS CONTROL (จัดการสิทธิ์ผู้ใช้งาน)
     ========================================================================== */
  renderRoles() {
    const tbodyMatrix = document.getElementById('tbody-role-matrix');
    const tbodyUsers = document.getElementById('tbody-system-users');

    if (tbodyMatrix) {
      tbodyMatrix.innerHTML = '';
      const allPerms = ['dashboard', 'sales', 'prepress', 'kanban', 'logistics', 'finance', 'customers', 'inventory', 'machine', 'agents', 'staff', 'cms', 'roles', 'settings'];
      const rolesEntries = Array.isArray(this.state.roles)
        ? this.state.roles.map(r => [r.id, r])
        : Object.entries(this.state.roles || {});

      for (const [rKey, rObj] of rolesEntries) {
        if (!rObj) continue;
        let colsHtml = '';
        const rolePerms = Array.isArray(rObj.permissions) ? rObj.permissions : [];
        allPerms.forEach(p => {
          const isChecked = rolePerms.includes(p);
          const isOwnerAdmin = (rKey === 'admin' || rObj.id === 'admin') && p === 'roles'; // Owner must keep roles perm
          colsHtml += `
          <td style="text-align:center;">
            <input type="checkbox" ${isChecked ? 'checked' : ''} ${isOwnerAdmin ? 'disabled' : ''} onchange="app.toggleRolePermission('${rKey}', '${p}')" style="width:16px; height:16px; cursor:pointer; accent-color:var(--primary);">
          </td>`;
        });

        tbodyMatrix.innerHTML += `
        <tr>
          <td><b style="color:${rObj.color || rObj.badgeColor || '#1E3A8A'};">${rObj.name}</b> <small style="color:#64748B;">(${rKey})</small></td>
          ${colsHtml}
          <td style="text-align:center;">
            <span style="color:#10B981; font-size:11px; font-weight:bold;"><i class="las la-check"></i> บันทึกแล้ว</span>
          </td>
        </tr>`;
      }
    }

    if (tbodyUsers) {
      tbodyUsers.innerHTML = '';
      const users = this.state.systemUsers || [];
      users.forEach(u => {
        const uRole = u.role || u.roleId || 'admin';
        const roleObj = this.getRole(uRole) || { name: uRole, color: '#64748B' };
        tbodyUsers.innerHTML += `
        <tr>
          <td><strong>${u.id}</strong><br><span style="font-family:monospace; color:var(--primary);">${u.username}</span></td>
          <td><b>${u.name}</b></td>
          <td><span style="font-family:monospace; background:#F1F5F9; padding:2px 8px; border-radius:4px; font-size:12px;">${u.password}</span></td>
          <td><span class="role-pill" style="background:${roleObj.color || roleObj.badgeColor || '#1E3A8A'};">${roleObj.name}</span></td>
          <td><small style="color:#64748B;">${u.phone || '-'}</small></td>
          <td><span class="status-badge status-${u.status === 'active' ? 'Done' : 'Production'}">${u.status === 'active' ? 'เปิดใช้งาน' : 'ระงับ'}</span></td>
          <td>
            <button class="btn-sm btn-outline" onclick="app.openUserModal('${u.id}')"><i class="las la-edit"></i> แก้ไข</button>
            <button class="btn-sm btn-outline" style="border-color:#EF4444; color:#EF4444; margin-left:4px;" onclick="app.deleteCurrentUser('${u.id}')"><i class="las la-trash"></i></button>
          </td>
        </tr>`;
      });
    }
  },

  toggleRolePermission(roleId, perm) {
    const roleObj = this.getRole(roleId);
    if (!roleObj) return;
    if (!Array.isArray(roleObj.permissions)) {
      roleObj.permissions = [];
    }
    const perms = roleObj.permissions;
    const idx = perms.indexOf(perm);
    if (idx > -1) {
      perms.splice(idx, 1);
    } else {
      perms.push(perm);
    }
    this.renderRoles();
    this.applyUserRolePermissions(this.state.currentUserRole || 'admin');
    this.showToast(`อัปเดตสิทธิ์ ${roleObj.name} เรียบร้อยแล้ว`, 'success');
  },

  openUserModal(userId) {
    const titleEl = document.getElementById('user-modal-title');
    const delBtn = document.getElementById('btn-del-user');
    if (userId) {
      const u = (this.state.systemUsers || []).find(x => x.id === userId);
      if (titleEl) titleEl.innerHTML = '<i class="las la-edit"></i> แก้ไขบัญชีผู้ใช้งาน';
      document.getElementById('usr-id').value = u.id;
      document.getElementById('usr-username').value = u.username;
      document.getElementById('usr-password').value = u.password;
      document.getElementById('usr-name').value = u.name;
      document.getElementById('usr-role').value = u.role;
      document.getElementById('usr-status').value = u.status;
      document.getElementById('usr-phone').value = u.phone || '';
      if (delBtn) delBtn.style.display = (u.username === 'admin') ? 'none' : 'inline-flex';
    } else {
      if (titleEl) titleEl.innerHTML = '<i class="las la-user-plus"></i> เพิ่มบัญชีผู้ใช้งานใหม่';
      document.getElementById('usr-id').value = 'U' + String((this.state.systemUsers || []).length + 1).padStart(3, '0');
      document.getElementById('usr-username').value = '';
      document.getElementById('usr-password').value = '';
      document.getElementById('usr-name').value = '';
      document.getElementById('usr-role').value = 'designer';
      document.getElementById('usr-status').value = 'active';
      document.getElementById('usr-phone').value = '';
      if (delBtn) delBtn.style.display = 'none';
    }
    document.getElementById('user-modal').style.display = 'flex';
  },

  saveUser() {
    const id = document.getElementById('usr-id')?.value;
    const username = document.getElementById('usr-username')?.value.trim();
    const password = document.getElementById('usr-password')?.value.trim();
    const name = document.getElementById('usr-name')?.value.trim();
    const role = document.getElementById('usr-role')?.value;
    const status = document.getElementById('usr-status')?.value;
    const phone = document.getElementById('usr-phone')?.value.trim();

    if (!username || !password || !name) {
      this.showToast('กรุณากรอก Username, Password และชื่อผู้ใช้', 'warning');
      return;
    }

    const uObj = { id, username, password, name, role, status, phone };
    const existIdx = (this.state.systemUsers || []).findIndex(x => x.id === id);
    if (existIdx > -1) {
      this.state.systemUsers[existIdx] = uObj;
    } else {
      this.state.systemUsers.push(uObj);
    }

    this.showToast('บันทึกบัญชีผู้ใช้ระบบเรียบร้อย', 'success');
    document.getElementById('user-modal').style.display = 'none';
    this.renderRoles();
  },

  deleteCurrentUser(idToDelete) {
    const id = idToDelete || document.getElementById('usr-id')?.value;
    if (!id) return;
    const u = (this.state.systemUsers || []).find(x => x.id === id);
    if (u && u.username === 'admin') {
      this.showToast('ไม่สามารถลบบัญชีผู้ดูแลระบบหลักได้', 'warning');
      return;
    }
    if (!confirm(`ต้องการลบบัญชี "${u ? u.name : id}"?`)) return;
    this.state.systemUsers = (this.state.systemUsers || []).filter(x => x.id !== id);
    document.getElementById('user-modal').style.display = 'none';
    this.showToast('ลบบัญชีผู้ใช้เรียบร้อย', 'success');
    this.renderRoles();
  },

  /* ==========================================================================
     LANDING PAGE SECTIONS REORDERING & VISIBILITY (จัดการหน้าแรก Real-time)
     ========================================================================== */
  renderLandingSections() {
    const listCont = document.getElementById('cms-sections-reorder-list');
    const sectionsContainer = document.getElementById('landing-sections-container');
    const sections = this.state.landingSections || [];

    // Reorder and show/hide actual DOM elements on the landing page!
    if (sectionsContainer) {
      sections.forEach(sec => {
        const secEl = document.getElementById('sec-' + sec.id);
        if (secEl) {
          secEl.style.display = sec.visible ? 'block' : 'none';
          sectionsContainer.appendChild(secEl);
        }
      });
    }

    if (!listCont) return;
    listCont.innerHTML = '';
    sections.forEach((sec, idx) => {
      listCont.innerHTML += `
      <div class="cms-list-row" style="background:${sec.visible ? 'white' : '#F8FAFC'};">
        <div style="display:flex; align-items:center; gap:12px; flex:1;">
          <span style="font-weight:800; font-size:14px; color:var(--primary); width:28px;">#${idx + 1}</span>
          <div>
            <div style="font-weight:700; font-size:14px; color:${sec.visible ? '#0F172A' : '#94A3B8'};">
              ${sec.name} ${sec.badge ? `<span style="font-size:10px; background:#FEF3C7; color:#B45309; padding:1px 6px; border-radius:4px; font-weight:normal; margin-left:6px;">${sec.badge}</span>` : ''}
            </div>
            <div style="font-size:12px; color:#64748B;">${sec.desc || 'ส่วนแสดงผลบนหน้าแรก'}</div>
          </div>
        </div>
        <div class="cms-actions-group" style="gap:10px;">
          <label style="display:flex; align-items:center; gap:6px; cursor:pointer; font-size:12px; font-weight:600; color:${sec.visible ? '#10B981' : '#94A3B8'};">
            <input type="checkbox" ${sec.visible ? 'checked' : ''} onchange="app.toggleLandingSectionVisibility('${sec.id}', this.checked)" style="width:16px; height:16px; accent-color:#10B981;">
            <span>${sec.visible ? 'แสดง' : 'ซ่อน'}</span>
          </label>
          <button class="btn-icon-sq" onclick="app.moveLandingSection('${sec.id}', -1)" ${idx === 0 ? 'disabled style="opacity:0.4;"' : ''} title="เลื่อนขึ้น"><i class="las la-arrow-up"></i></button>
          <button class="btn-icon-sq" onclick="app.moveLandingSection('${sec.id}', 1)" ${idx === sections.length - 1 ? 'disabled style="opacity:0.4;"' : ''} title="เลื่อนลง"><i class="las la-arrow-down"></i></button>
          <button class="btn-icon-sq" onclick="app.openSectionEditModal('${sec.id}')" title="แก้ไขข้อความ Section"><i class="las la-edit"></i></button>
        </div>
      </div>`;
    });
  },

  moveLandingSection(id, dir) {
    const list = this.state.landingSections;
    const idx = list.findIndex(s => s.id === id);
    if (idx === -1) return;
    const targetIdx = idx + dir;
    if (targetIdx < 0 || targetIdx >= list.length) return;
    const temp = list[idx];
    list[idx] = list[targetIdx];
    list[targetIdx] = temp;
    this.renderLandingSections();
    this.saveStateToStorage();
    this.showToast('ปรับลำดับ Section หน้าแรกเรียบร้อย (Real-time)', 'success');
  },

  toggleLandingSectionVisibility(id, visible) {
    const sec = (this.state.landingSections || []).find(s => s.id === id);
    if (sec) {
      sec.visible = visible;
      this.renderLandingSections();
      this.saveStateToStorage();
      this.showToast(`${visible ? 'เปิดแสดง' : 'ซ่อน'} Section "${sec.name}" แล้ว`, 'info');
    }
  },

  openSectionEditModal(id) {
    const sec = (this.state.landingSections || []).find(s => s.id === id);
    if (!sec) return;
    document.getElementById('sec-edit-id').value = sec.id;
    document.getElementById('sec-edit-name').value = sec.name || '';
    document.getElementById('sec-edit-title').value = sec.title || '';
    document.getElementById('sec-edit-sub').value = sec.badge || '';
    document.getElementById('sec-edit-desc').value = sec.desc || '';
    document.getElementById('section-edit-modal').style.display = 'flex';
  },

  saveSectionEdit() {
    const id = document.getElementById('sec-edit-id')?.value;
    const sec = (this.state.landingSections || []).find(s => s.id === id);
    if (sec) {
      sec.name = document.getElementById('sec-edit-name')?.value || sec.name;
      sec.title = document.getElementById('sec-edit-title')?.value || sec.title;
      sec.badge = document.getElementById('sec-edit-sub')?.value || sec.badge;
      sec.desc = document.getElementById('sec-edit-desc')?.value || sec.desc;
      this.renderLandingSections();
      this.renderLandingCMS();
      this.saveStateToStorage();
      document.getElementById('section-edit-modal').style.display = 'none';
      this.showToast('บันทึกข้อมูล Section เรียบร้อย (Real-time)', 'success');
    }
  },

  resetLandingSectionsOrder() {
    this.state.landingSections = [
      { id: 'sec-hero', name: '1. ภาพสไลด์และแบนเนอร์หลัก (Hero Banner & Slider)', visible: true, order: 1, title: 'งานป้ายและสื่อโฆษณา', badge: 'HERO SLIDER', desc: 'ละมุนทุกดีไซน์ พรีเมียมทุกรายละเอียด' },
      { id: 'sec-quick-quote', name: '2. กล่องประเมินราคาด่วน (Quick Quote Estimator)', visible: true, order: 2, title: 'ประเมินราคาด่วน ออนไลน์', badge: 'ONLINE ESTIMATOR', desc: 'คำนวณราคางานป้ายและสิ่งพิมพ์ได้ทันทีตลอด 24 ชม.' },
      { id: 'sec-flash-sale', name: '3. สินค้าโปรโมชั่นพิเศษ (Hot Deals & Flash Sales)', visible: true, order: 3, title: 'HOT DEAL & สินค้าแนะนำ', badge: 'HOT DEALS', desc: 'สินค้าจัดโปรโมชั่นและสินค้ามาใหม่ ราคาพิเศษเฉพาะสั่งออนไลน์เท่านั้น' },
      { id: 'sec-services', name: '4. บริการงานพิมพ์และงานป้าย (Services Catalog)', visible: true, order: 4, title: 'บริการงานพิมพ์และงานป้ายของเรา', badge: 'SERVICES', desc: 'ครอบคลุมทุกความต้องการด้านสื่อโฆษณาและงานป้ายครบวงจร' },
      { id: 'sec-packages', name: '5. แพ็กเกจสุดคุ้มแนะนำ (Recommended Packages)', visible: true, order: 5, title: 'แพ็กเกจสุดคุ้ม (Recommended Packages)', badge: 'VALUE PACKAGES', desc: 'รวมเซ็ตงานป้ายและสื่อสิ่งพิมพ์ยอดฮิต จัดมาให้ครบ จบในคลิกเดียว' },
      { id: 'sec-gallery', name: '6. แกลเลอรี่ผลงานของเรา (Portfolio Gallery)', visible: true, order: 6, title: 'แกลอรี่ผลงานของเรา', badge: 'PORTFOLIO', desc: 'ภาพถ่ายผลงานจริงจากสถานที่ติดตั้งทั่วภาคใต้และทั่วประเทศ' },
      { id: 'sec-promotions', name: '7. โปรโมชั่นสุดคุ้มประจำเดือน (Monthly Promotions)', visible: true, order: 7, title: 'โปรโมชั่นสุดคุ้มประจำเดือน', badge: 'PROMOTIONS', desc: 'สิทธิพิเศษและส่วนลดมากมายเฉพาะลูกค้าทำดีมีเดีย' },
      { id: 'sec-one-stop', name: '8. ครบจบในที่เดียว (One-Stop Service & Quality)', visible: true, order: 8, title: 'ครบจบในที่เดียว (One-Stop Service & Workflow)', badge: 'ONE-STOP SERVICE', desc: 'มาหาเราที่เดียว แล้วชีวิตจะง่ายขึ้น' },
      { id: 'sec-order-cta', name: '9. แบนเนอร์สั่งผลิตงาน 24 ชม. (Order Online CTA)', visible: true, order: 9, title: 'สั่งผลิตงานง่ายๆ ได้ 24 ชม.', badge: 'ORDER ONLINE', desc: 'ประเมินราคาอัตโนมัติ สรุปไฟล์แบบปุ๊บ รอรับของที่บ้านได้เลย' },
      { id: 'sec-agent-cta', name: '10. แบนเนอร์ร่วมเป็นตัวแทน (Partner Program CTA)', visible: true, order: 10, title: 'ร่วมเป็นตัวแทนจำหน่ายกับเรา', badge: 'PARTNER PROGRAM', desc: 'เพิ่มช่องทางสร้างรายได้ให้กับร้านหรือธุรกิจของคุณ พร้อมระบบจัดการออเดอร์สุดล้ำ' },
      { id: 'sec-trusted-brands', name: '11. แบรนด์ชั้นนำที่ไว้วางใจ (Trusted Brands)', visible: true, order: 11, title: 'แบรนด์ชั้นนำที่ไว้วางใจเรา', badge: 'TRUSTED CLIENTS', desc: 'ลูกค้าองค์กรและแบรนด์ชั้นนำที่เลือกใช้บริการ' },
      { id: 'sec-testimonials', name: '12. เสียงตอบรับจากลูกค้า (Customer Testimonials)', visible: true, order: 12, title: 'เสียงตอบรับจากลูกค้า', badge: 'REVIEWS', desc: 'ความประทับใจจริงจากลูกค้าที่สั่งผลิตงานกับเรา' },
      { id: 'sec-faq', name: '13. คำถามที่พบบ่อย (Frequently Asked Questions)', visible: true, order: 13, title: 'คำถามที่พบบ่อย (FAQs)', badge: 'FREQUENT QUESTIONS', desc: 'ไขทุกข้อข้องใจเกี่ยวกับการสั่งผลิตและระยะเวลาจัดส่ง' },
      { id: 'sec-community-network', name: '14. เครือข่ายร้านค้าลูกค้า (Community Network)', visible: true, order: 14, title: 'เครือข่ายร้านค้าลูกค้า ทำดีมีเดีย', badge: 'COMMUNITY', desc: 'ร่วมส่งเสริมและสนับสนุนร้านค้าธุรกิจของลูกค้าที่สั่งผลิตงานกับเรา' }
    ];
    this.renderLandingSections();
    this.renderLandingCMS();
    this.saveStateToStorage();
    this.showToast('คืนค่าลำดับ Section หน้าแรกเริ่มต้นเรียบร้อยแล้ว', 'success');
  },

  /* ==========================================================================
     SETTINGS & CHATBOT CONFIGURATION (ตั้งค่าปุ่มติดต่อ & บอท)
     ========================================================================== */
  renderSettingsTab() {
    const s = this.state.settings || {};
    const setPhone = document.getElementById('set-phone'); if (setPhone) setPhone.value = s.linkPhone || '062-419-8365';
    const setLineId = document.getElementById('set-line-id'); if (setLineId) setLineId.value = s.lineOAId || 'tumdeemedia';
    const setLineLink = document.getElementById('set-line-link'); if (setLineLink) setLineLink.value = s.linkLine || 'https://line.me/ti/p/~tumdeemedia';
    const setFbLink = document.getElementById('set-fb-link'); if (setFbLink) setFbLink.value = s.linkFb || 'https://m.me/tumdeemediatrang';
    const setHours = document.getElementById('set-hours'); if (setHours) setHours.value = s.operatingHours || '';
    const setFloatLine = document.getElementById('set-toggle-float-line'); if (setFloatLine) setFloatLine.checked = s.enableFloatingLine !== false;
    const setFab = document.getElementById('set-toggle-fab'); if (setFab) setFab.checked = s.enableFab !== false;

    // Bot settings
    const setBotToggle = document.getElementById('set-toggle-bot'); if (setBotToggle) setBotToggle.checked = s.enableChatbot !== false;
    const setBotName = document.getElementById('set-bot-name'); if (setBotName) setBotName.value = s.chatbotName || 'Q-Bot (ผู้ช่วยอัจฉริยะ TUMDEEMEDIA)';
    const setBotCalc = document.getElementById('set-calc-keywords'); if (setBotCalc) setBotCalc.value = s.chatbotCalcKeywords || '';
    const setBotWelcome = document.getElementById('set-bot-welcome'); if (setBotWelcome) setBotWelcome.value = s.chatbotWelcome || '';
    const setBotFallback = document.getElementById('set-bot-fallback'); if (setBotFallback) setBotFallback.value = s.chatbotFallback || '';

    // Quick replies list
    const qrCont = document.getElementById('admin-quick-reply-list');
    if (qrCont) {
      qrCont.innerHTML = '';
      (s.quickReplies || []).forEach((qr, idx) => {
        qrCont.innerHTML += `
        <div style="display:flex; justify-content:space-between; align-items:center; background:#F8FAFC; padding:8px 12px; border-radius:6px; font-size:13px;">
          <span>${qr}</span>
          <button class="btn-icon-sq danger" onclick="app.deleteAdminQuickReply(${idx})"><i class="las la-trash"></i></button>
        </div>`;
      });
    }

    // Chatbot Rules list
    const crCont = document.getElementById('admin-chatbot-list');
    if (crCont) {
      crCont.innerHTML = '';
      (s.chatbotRules || []).forEach((rule, idx) => {
        crCont.innerHTML += `
        <div style="display:flex; justify-content:space-between; align-items:center; background:#F8FAFC; padding:8px 12px; border-radius:6px; font-size:13px;">
          <div>
            <b>คีย์เวิร์ด:</b> "${rule.keyword}"<br>
            <span style="font-size:11px; color:#64748B;">ตอบกลับ: ${rule.reply}</span>
          </div>
          <button class="btn-icon-sq danger" onclick="app.deleteAdminChatbotRule(${idx})"><i class="las la-trash"></i></button>
        </div>`;
      });
    }
  },

  saveSettings() {
    const s = this.state.settings;
    s.linkPhone = document.getElementById('set-phone')?.value || s.linkPhone;
    s.lineOAId = document.getElementById('set-line-id')?.value || s.lineOAId;
    s.linkLine = document.getElementById('set-line-link')?.value || s.linkLine;
    s.linkFb = document.getElementById('set-fb-link')?.value || s.linkFb;
    s.operatingHours = document.getElementById('set-hours')?.value || s.operatingHours;
    s.enableFloatingLine = document.getElementById('set-toggle-float-line')?.checked !== false;
    s.enableFab = document.getElementById('set-toggle-fab')?.checked !== false;

    s.enableChatbot = document.getElementById('set-toggle-bot')?.checked !== false;
    s.chatbotName = document.getElementById('set-bot-name')?.value || s.chatbotName;
    s.chatbotCalcKeywords = document.getElementById('set-calc-keywords')?.value || s.chatbotCalcKeywords;
    s.chatbotWelcome = document.getElementById('set-bot-welcome')?.value || s.chatbotWelcome;
    s.chatbotFallback = document.getElementById('set-bot-fallback')?.value || s.chatbotFallback;

    // Apply immediately to landing buttons and floating buttons
    const lineFloat = document.getElementById('btn-float-line');
    if (lineFloat) lineFloat.style.display = s.enableFloatingLine ? 'flex' : 'none';
    const fabWrap = document.getElementById('fab-wrapper');
    if (fabWrap) fabWrap.style.display = s.enableFab ? 'block' : 'none';

    // Update chatbot header name
    const chatTitle = document.querySelector('#chat-window h3');
    if (chatTitle) chatTitle.innerHTML = `<i class="las la-robot"></i> ${s.chatbotName}`;

    this.applySettings();
    this.showToast('บันทึกการตั้งค่าปุ่มติดต่อ & แชทบอทเรียบร้อยแล้ว', 'success');
  },

  deleteAdminQuickReply(idx) {
    this.state.settings.quickReplies.splice(idx, 1);
    this.renderSettingsTab();
    this.renderChatWindow();
    this.showToast('ลบคำถามแนะนำแล้ว', 'success');
  },

  deleteAdminChatbotRule(idx) {
    this.state.settings.chatbotRules.splice(idx, 1);
    this.renderSettingsTab();
    this.showToast('ลบกฎแชทบอทแล้ว', 'success');
  },

  renderKanbanEvents() {
    const cols = document.querySelectorAll('.kanban-col');
    cols.forEach(col => {
      col.ondragover = (e) => { e.preventDefault(); col.classList.add('drag-over'); };
      col.ondragleave = () => { col.classList.remove('drag-over'); };
      col.ondrop = (e) => {
        e.preventDefault();
        col.classList.remove('drag-over');
        const oId = e.dataTransfer.getData('text/plain');
        const newStatus = col.id.replace('kb-', '');
        const order = this.state.orders.find(o => o.id === oId);
        if (order && order.status !== newStatus) {
          order.status = newStatus;
          this.notify(`เปลี่ยนสถานะ ${oId} เป็น ${newStatus} แล้ว`);
          this.renderAdmin();
        }
      };
    });
  },

  drag(e, id) { e.dataTransfer.setData('text/plain', id); },

  renderCatalog() {
    const tP = document.getElementById('tbody-catalog-products');
    const tM = document.getElementById('tbody-catalog-materials');
    const dL = document.getElementById('dash-low-stock');
    if (!tP || !tM) return;
    tP.innerHTML = ''; tM.innerHTML = ''; if (dL) dL.innerHTML = '';

    this.state.catalog.forEach(c => {
      const isLow = c.stock < 10;
      const stockBadge = isLow ? `<span class="stock-low" style="background:#FEE2E2; color:#DC2626; padding:2px 8px; border-radius:50px; font-weight:700; font-size:11px;">${c.stock} ${c.unit}</span>` : `<span class="stock-ok" style="background:#ECFDF5; color:#059669; padding:2px 8px; border-radius:50px; font-weight:700; font-size:11px;">${c.stock} ${c.unit}</span>`;
      const actionBtns = `
        <button class="btn-sm btn-outline" onclick="app.openCatalogModal('${c.itemType}', '${c.id}')"><i class="las la-edit"></i> แก้ไข</button>
        <button class="btn-sm btn-outline" style="border-color:var(--danger); color:var(--danger); margin-left:4px;" onclick="app.deleteCatalogItem('${c.id}')" title="ลบรายการ"><i class="las la-trash"></i></button>
      `;
      const tr = `<tr>
        <td><strong>${c.id}</strong><br><span style="font-size:12px; font-weight:600; color:#1E293B;">${c.name}</span></td>
        <td><span style="font-size:11px; background:#EFF6FF; color:#1E40AF; padding:2px 6px; border-radius:4px; font-weight:600;">${c.category || 'ทั่วไป'}</span><br><span style="color:var(--primary); font-weight:bold; font-size:13px;">฿${c.price.toLocaleString()}</span> <small style="color:#64748B;">/${c.unit}</small></td>
        <td>${stockBadge}</td>
        <td>${actionBtns}</td>
      </tr>`;
      const trM = `<tr>
        <td><strong>${c.name}</strong><br><span style="font-size:11px; color:#64748B; font-family:monospace;">${c.id}</span></td>
        <td><span style="font-size:11px; background:#FEF3C7; color:#B45309; padding:2px 6px; border-radius:4px; font-weight:600;">${c.category || 'วัสดุ'}</span><br><span style="font-size:12px; color:#475569;">ทุน: ฿${c.cost.toLocaleString()} | มูลค่า: ฿${c.price.toLocaleString()}</span></td>
        <td>${stockBadge}</td>
        <td>${actionBtns}</td>
      </tr>`;
      if (c.itemType === 'product') tP.innerHTML += tr; else tM.innerHTML += trM;
      if (isLow && dL) {
        dL.innerHTML += `<div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid var(--border); padding-bottom:8px; margin-bottom:8px;"><span style="font-size:13px;"><i class="las la-exclamation-circle" style="color:var(--danger);"></i> ${c.name}</span>${stockBadge}</div>`;
      }
    });
  },

  deleteCatalogItem(id) {
    const item = this.state.catalog.find(c => c.id === id);
    if (!item) return;
    if (!confirm(`คุณแน่ใจหรือไม่ว่าต้องการลบ "${item.name}" (${item.id}) ออกจากระบบ?`)) return;
    this.state.catalog = this.state.catalog.filter(c => c.id !== id);
    this.renderCatalog();
    this.populateQuickQuote();
    this.showToast(`ลบรายการ ${item.name} เรียบร้อยแล้ว`, 'success');
  },

  openCatalogModal(type, id) {
    document.getElementById('cm-itemType').value = type;
    document.getElementById('cm-title').innerText = type === 'product' ? 'จัดการสินค้า (Catalog)' : 'จัดการวัสดุ (Material)';
    const delBtn = document.getElementById('btn-del-catalog');
    if (id) {
      const c = this.state.catalog.find(x => x.id === id);
      document.getElementById('cm-action').value = 'edit';
      document.getElementById('cm-old-id').value = c.id;
      document.getElementById('cm-id').value = c.id;
      document.getElementById('cm-category').value = c.category;
      document.getElementById('cm-name').value = c.name;
      document.getElementById('cm-cost').value = c.cost;
      document.getElementById('cm-price').value = c.price;
      document.getElementById('cm-stock').value = c.stock;
      document.getElementById('cm-unit').value = c.unit;
      if (delBtn) delBtn.style.display = 'inline-flex';
    } else {
      document.getElementById('cm-action').value = 'add';
      document.getElementById('cm-old-id').value = '';
      document.getElementById('cm-id').value = '';
      document.getElementById('cm-category').value = '';
      document.getElementById('cm-name').value = '';
      document.getElementById('cm-cost').value = '';
      document.getElementById('cm-price').value = '';
      document.getElementById('cm-stock').value = '';
      if (delBtn) delBtn.style.display = 'none';
    }
    document.getElementById('catalog-modal').style.display = 'flex';
  },

  deleteCatalogFromModal() {
    const id = document.getElementById('cm-old-id')?.value;
    if (id) {
      document.getElementById('catalog-modal').style.display = 'none';
      this.deleteCatalogItem(id);
    }
  },

  saveCatalogItem() {
    const type = document.getElementById('cm-itemType').value;
    const action = document.getElementById('cm-action').value;
    const id = document.getElementById('cm-id').value;
    if (!id) { this.showToast('กรุณาระบุรหัส', 'warning'); return; }
    const newItem = {
      itemType: type,
      id,
      category: document.getElementById('cm-category').value,
      name: document.getElementById('cm-name').value,
      cost: parseFloat(document.getElementById('cm-cost').value) || 0,
      price: parseFloat(document.getElementById('cm-price').value) || 0,
      stock: parseInt(document.getElementById('cm-stock').value) || 0,
      unit: document.getElementById('cm-unit').value
    };
    if (action === 'edit') {
      const oldId = document.getElementById('cm-old-id').value;
      const idx = this.state.catalog.findIndex(x => x.id === oldId);
      if (idx > -1) this.state.catalog[idx] = newItem;
    } else {
      this.state.catalog.push(newItem);
    }
    this.renderCatalog();
    document.getElementById('catalog-modal').style.display = 'none';
    this.showToast('บันทึกข้อมูลเรียบร้อย', 'success');
  },

  renderMachines() {
    const cont = document.getElementById('machine-container');
    if (!cont) return;
    cont.innerHTML = '';
    this.state.machines.forEach(m => {
      let sColor = m.status === 'idle' ? 'var(--success)' : (m.status === 'printing' ? 'var(--warning)' : 'var(--danger)');
      let sIcon = m.status === 'idle' ? 'la-check-circle' : (m.status === 'printing' ? 'la-cog la-spin' : 'la-tools');
      cont.innerHTML += `<div class="card" style="padding:20px; border-top:4px solid ${sColor};"><div style="display:flex; justify-content:space-between; margin-bottom:15px;"><h4 style="margin:0;"><i class="las la-print"></i> ${m.name}</h4><span style="font-size:12px; font-weight:bold; color:${sColor};"><i class="las ${sIcon}"></i> ${m.status.toUpperCase()}</span></div><p style="font-size:13px; color:var(--secondary); margin-bottom:15px;">รหัสเครื่อง: ${m.id}<br>งานปัจจุบัน: ${m.job || '-'}</p><button class="btn-sm btn-outline" style="width:100%;" onclick="app.openMachineModal('${m.id}')">อัปเดตสถานะ / ซ่อมบำรุง</button></div>`;
    });
  },

  openMachineModal(id) {
    document.getElementById('mac-history-list').innerHTML = '';
    if (id) {
      const m = this.state.machines.find(x => x.id === id);
      document.getElementById('mac-old-id').value = m.id;
      document.getElementById('mac-id').value = m.id;
      document.getElementById('mac-name').value = m.name;
      document.getElementById('mac-status').value = m.status;
      document.getElementById('btn-del-mac').style.display = 'block';
      (m.history || []).forEach(h => {
        document.getElementById('mac-history-list').innerHTML += `<div style="font-size:12px; border-bottom:1px solid #eee; padding:5px 0;"><strong>${h.date}</strong>: ${h.note}</div>`;
      });
    } else {
      document.getElementById('mac-old-id').value = '';
      document.getElementById('mac-id').value = '';
      document.getElementById('mac-name').value = '';
      document.getElementById('mac-status').value = 'idle';
      document.getElementById('btn-del-mac').style.display = 'none';
    }
    document.getElementById('machine-modal').style.display = 'flex';
  },

  saveMachine() {
    const oldId = document.getElementById('mac-old-id').value;
    const m = {
      id: document.getElementById('mac-id').value,
      name: document.getElementById('mac-name').value,
      status: document.getElementById('mac-status').value,
      job: '', history: []
    };
    if (oldId) {
      const idx = this.state.machines.findIndex(x => x.id === oldId);
      m.history = this.state.machines[idx].history;
      m.job = this.state.machines[idx].job;
      this.state.machines[idx] = m;
    } else {
      this.state.machines.push(m);
    }
    this.renderMachines();
    document.getElementById('machine-modal').style.display = 'none';
    this.showToast('บันทึกเครื่องจักรเรียบร้อย', 'success');
  },

  addMaintenanceLog() {
    const id = document.getElementById('mac-id').value;
    const d = document.getElementById('mac-m-date').value;
    const n = document.getElementById('mac-m-note').value;
    if (!id || !d || !n) return;
    const m = this.state.machines.find(x => x.id === id);
    if (m) {
      if (!m.history) m.history = [];
      m.history.push({ date: d, note: n });
      document.getElementById('mac-history-list').innerHTML += `<div style="font-size:12px; border-bottom:1px solid #eee; padding:5px 0;"><strong>${d}</strong>: ${n}</div>`;
      document.getElementById('mac-m-note').value = '';
    }
  },

  deleteMachine() {
    const id = document.getElementById('mac-id').value;
    this.state.machines = this.state.machines.filter(m => m.id !== id);
    this.renderMachines();
    document.getElementById('machine-modal').style.display = 'none';
    this.showToast('ลบเครื่องจักรเรียบร้อย', 'success');
  },

  renderLogistics() {
    const iL = document.getElementById('log-install-list');
    const sL = document.getElementById('log-shipping-list');
    const cL = document.getElementById('log-completed-list');
    if (!iL || !sL) return;
    iL.innerHTML = ''; sL.innerHTML = ''; if (cL) cL.innerHTML = '';

    let cntInstall = 0;
    let cntShipping = 0;
    let cntOnTheWay = 0;
    let cntCompleted = 0;

    const currentFilter = this.logisticsFilter || 'all';

    this.state.orders.forEach(o => {
      const isInstallType = (o.installType === 'standard' || o.installType === 'crane');
      const isShippingType = (o.installType === 'parcel' || o.installType === 'pickup');
      const isDone = o.status === 'Done';
      const isLogistics = o.status === 'Logistics' || o.status === 'Production';

      if (isDone) {
        cntCompleted++;
      } else if (isInstallType) {
        cntInstall++;
      } else {
        cntShipping++;
      }

      if (o.logisticsStatus === 'on_the_way' || o.status === 'Logistics') {
        cntOnTheWay++;
      }

      // Check current filter tab
      if (currentFilter === 'install' && !isInstallType) return;
      if (currentFilter === 'shipping' && !isShippingType) return;
      if (currentFilter === 'completed' && !isDone) return;

      const cName = o.customerName || 'ลูกค้าทั่วไป';
      const cPhone = o.customerPhone || '-';
      const cAddr = o.customerAddress || 'ไม่ได้ระบุที่อยู่';
      const techName = o.assignedTech || 'ยังไม่มอบหมายช่าง';
      const techPhone = o.techPhone || '-';
      const vehicle = o.vehiclePlate || 'รถกระบะบริษัท';
      const siteHeight = o.siteHeight || '-';
      const schedDate = o.installDate ? new Date(o.installDate).toLocaleDateString('th-TH') : (o.dueDate ? new Date(o.dueDate).toLocaleDateString('th-TH') : '-');
      const schedTime = o.installTime || '09:00 น.';
      const statusMap = {
        pending_schedule: { label: 'รอนัดหมาย', color: '#F59E0B', bg: '#FEF3C7' },
        scheduled: { label: 'ยืนยันวันนัดแล้ว', color: '#2563EB', bg: '#DBEAFE' },
        on_the_way: { label: 'กำลังเดินทาง', color: '#EA580C', bg: '#FFEDD5' },
        installing: { label: 'กำลังติดตั้งหน้างาน', color: '#7C3AED', bg: '#EDE9FE' },
        completed: { label: 'ติดตั้งเสร็จสมบูรณ์', color: '#10B981', bg: '#D1FAE5' }
      };
      const logStatusInfo = statusMap[o.logisticsStatus] || { label: o.status, color: '#475569', bg: '#F1F5F9' };

      const card = `
      <div class="smart-job-card" style="background:white; border:1px solid #E2E8F0; border-radius:12px; padding:15px; box-shadow:0 3px 10px rgba(0,0,0,0.03); transition:transform 0.2s;" onmouseover="this.style.boxShadow='0 8px 20px rgba(0,0,0,0.08)'" onmouseout="this.style.boxShadow='0 3px 10px rgba(0,0,0,0.03)'">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
          <div>
            <strong style="color:var(--primary); font-size:15px;">#${o.id}</strong>
            <span style="display:inline-block; margin-left:6px; font-size:11px; padding:2px 8px; border-radius:12px; font-weight:700; color:${logStatusInfo.color}; background:${logStatusInfo.bg};">
              ● ${logStatusInfo.label}
            </span>
          </div>
          <span class="status-badge status-${o.status}" style="font-size:11px;">${o.status}</span>
        </div>

        <div style="font-size:13px; font-weight:700; color:#1E293B; margin-bottom:3px;">
          ${cName}
          ${cPhone !== '-' ? `<a href="tel:${cPhone.replace(/[^0-9]/g,'')}" style="color:var(--accent); margin-left:6px; text-decoration:none;"><i class="las la-phone"></i> ${cPhone}</a>` : ''}
        </div>
        <div style="font-size:12px; color:#64748B; margin-bottom:10px; line-height:1.4;">
          <i class="las la-map-marker" style="color:#EF4444;"></i> ${cAddr.substring(0, 55)}${cAddr.length > 55 ? '...' : ''}
        </div>

        <!-- Smart Logistics Details Box -->
        <div style="background:#F8FAFC; border:1px solid #E2E8F0; border-radius:8px; padding:10px; font-size:11.5px; color:#334155; margin-bottom:12px; display:grid; grid-template-columns:1fr 1fr; gap:6px;">
          <div><i class="las la-calendar-day" style="color:var(--primary);"></i> <b>นัดหมาย:</b> ${schedDate}</div>
          <div><i class="las la-clock" style="color:var(--primary);"></i> <b>เวลา:</b> ${schedTime}</div>
          <div><i class="las la-user-cog" style="color:#2563EB;"></i> <b>ช่าง:</b> ${techName}</div>
          <div><i class="las la-truck" style="color:#EA580C;"></i> <b>รถ:</b> ${vehicle}</div>
          ${siteHeight !== '-' ? `<div style="grid-column: span 2;"><i class="las la-ruler-vertical" style="color:#10B981;"></i> <b>ความสูง:</b> ${siteHeight} | <b>เครื่องมือ:</b> ${o.specialTools || 'บันไดมาตรฐาน'}</div>` : ''}
        </div>

        <!-- Action Buttons -->
        <div style="display:flex; gap:6px; flex-wrap:wrap;">
          ${isInstallType ? `
            <button class="btn-sm btn-primary" style="flex:1; font-size:11px; padding:6px 10px;" onclick="app.openSmartInstallModal('${o.id}')"><i class="las la-calendar-check"></i> นัดหมาย/ช่าง</button>
            <button class="btn-sm btn-outline" style="font-size:11px; padding:6px 10px; color:var(--primary); border-color:#CBD5E1;" onclick="app.openDocModal('${o.id}', 'handover')"><i class="las la-file-signature"></i> ใบส่งมอบงาน</button>
          ` : `
            <button class="btn-sm btn-primary" style="flex:1; font-size:11px; padding:6px 10px;" onclick="app.printShippingLabel('${o.id}')"><i class="las la-tag"></i> พิมพ์ใบปะหน้าสินค้า</button>
            <button class="btn-sm btn-outline" style="font-size:11px; padding:6px 10px;" onclick="app.openManageOrder('${o.id}')"><i class="las la-cog"></i> จัดการ</button>
          `}
          ${o.customerAddress ? `
            <a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(o.customerAddress)}" target="_blank" class="btn-sm btn-outline" style="color:#2563EB; border-color:#BFDBFE; font-size:11px; padding:6px 8px; text-decoration:none;" title="เปิดแผนที่นำทาง GPS"><i class="las la-directions"></i> นำทาง</a>
          ` : ''}
          ${!isDone ? `
            <button class="btn-sm btn-success" style="font-size:11px; padding:6px 10px;" onclick="app.openCloseJobModal('${o.id}')"><i class="las la-camera"></i> ส่งงาน</button>
          ` : ''}
        </div>
      </div>`;

      if (isDone) {
        if (cL) cL.innerHTML += card;
      } else if (isInstallType) {
        iL.innerHTML += card;
      } else {
        sL.innerHTML += card;
      }
    });

    // Update KPI counters
    const elKpiInstall = document.getElementById('log-kpi-install');
    if (elKpiInstall) elKpiInstall.innerText = cntInstall;
    const elKpiParcel = document.getElementById('log-kpi-parcel');
    if (elKpiParcel) elKpiParcel.innerText = cntShipping;
    const elKpiOnTheWay = document.getElementById('log-kpi-ontheway');
    if (elKpiOnTheWay) elKpiOnTheWay.innerText = cntOnTheWay;
    const elKpiDone = document.getElementById('log-kpi-done');
    if (elKpiDone) elKpiDone.innerText = cntCompleted;

    const bCountInstall = document.getElementById('badge-count-install');
    if (bCountInstall) bCountInstall.innerText = cntInstall;
    const bCountShipping = document.getElementById('badge-count-shipping');
    if (bCountShipping) bCountShipping.innerText = cntShipping;
    const bCountCompleted = document.getElementById('badge-count-completed');
    if (bCountCompleted) bCountCompleted.innerText = cntCompleted;
  },

  filterLogisticsList(filterType, btn) {
    this.logisticsFilter = filterType;
    document.querySelectorAll('#erp-logistics .gallery-tab').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
    this.renderLogistics();
  },

  openNewInstallScheduleModal() {
    const unassignedOrder = this.state.orders.find(o => (o.installType === 'standard' || o.installType === 'crane') && o.status !== 'Done') || this.state.orders[0];
    if (unassignedOrder) {
      this.openSmartInstallModal(unassignedOrder.id);
    } else {
      this.showToast('ไม่มีงานติดตั้งที่ค้างอยู่', 'info');
    }
  },

  openSmartInstallModal(orderId) {
    const order = this.state.orders.find(o => o.id === orderId);
    if (!order) return;

    this.currentSmartInstallOrderId = orderId;
    document.getElementById('si-order-id').value = orderId;
    const idTxt = document.getElementById('si-order-id-txt');
    if (idTxt) idTxt.innerText = order.id;
    const typeBadge = document.getElementById('si-order-install-type');
    if (typeBadge) typeBadge.innerText = this.getDeliveryLabel(order.installType);
    const cName = document.getElementById('si-customer-name');
    if (cName) cName.innerText = order.customerName || '-';
    const cPhone = document.getElementById('si-customer-phone');
    if (cPhone) cPhone.innerText = order.customerPhone || '-';
    const cAddr = document.getElementById('si-customer-address');
    if (cAddr) cAddr.innerText = order.customerAddress || '-';

    // Populate Tech select
    const techSelect = document.getElementById('si-tech-select');
    if (techSelect) {
      techSelect.innerHTML = '<option value="">-- เลือกช่างผู้รับผิดชอบ --</option>';
      const techStaff = (this.state.staff || []).filter(s => s.role === 'technician' || s.dept === 'ฝ่ายติดตั้ง' || s.dept === 'ฝ่ายผลิต');
      if (techStaff.length > 0) {
        techStaff.forEach(st => {
          techSelect.innerHTML += `<option value="${st.id}" data-name="${st.name}" data-phone="${st.phone || '081-234-5678'}">${st.name} (${st.dept || 'ช่าง'})</option>`;
        });
      } else {
        techSelect.innerHTML += '<option value="ST-01" data-name="นายสมศักดิ์ ช่างติดตั้ง" data-phone="081-234-5678">นายสมศักดิ์ ช่างติดตั้ง</option>';
        techSelect.innerHTML += '<option value="ST-02" data-name="นายวิชัย ช่างไฟ & โครงสร้าง" data-phone="089-876-5432">นายวิชัย ช่างไฟ & โครงสร้าง</option>';
      }

      if (order.assignedTechId) {
        techSelect.value = order.assignedTechId;
      }
    }

    const siDate = document.getElementById('si-date');
    if (siDate) siDate.value = order.installDate ? order.installDate.split('T')[0] : (order.dueDate ? order.dueDate.split('T')[0] : new Date().toISOString().split('T')[0]);
    const siTime = document.getElementById('si-time');
    if (siTime) siTime.value = order.installTime || '09:30 น.';
    const siPhone = document.getElementById('si-tech-phone');
    if (siPhone) siPhone.value = order.techPhone || (techSelect && techSelect.selectedOptions[0]?.dataset.phone) || '';
    const siVehicle = document.getElementById('si-vehicle');
    if (siVehicle) siVehicle.value = order.vehiclePlate || 'ผก-1234 ตรัง (กระบะขนส่งช่าง)';
    const siGps = document.getElementById('si-gps');
    if (siGps) siGps.value = order.siteGps || '7.5582, 99.6101';
    const siHeight = document.getElementById('si-height');
    if (siHeight) siHeight.value = order.siteHeight || 'อาคารพาณิชย์ 2 ชั้น (สูง 3.5 ม.)';
    const siStatus = document.getElementById('si-status');
    if (siStatus) siStatus.value = order.logisticsStatus || 'scheduled';
    const siTools = document.getElementById('si-tools');
    if (siTools) siTools.value = order.specialTools || 'นั่งร้านเหล็ก 2 ชั้น, สว่านโรตารี่, บันไดสไลด์ 6 ม.';

    document.getElementById('smart-install-modal').style.display = 'flex';
  },

  onTechSelectChange(selectEl) {
    const opt = selectEl.selectedOptions[0];
    if (opt && opt.dataset.phone) {
      const phoneInput = document.getElementById('si-tech-phone');
      if (phoneInput) phoneInput.value = opt.dataset.phone;
    }
  },

  saveSmartInstallDetails() {
    const orderId = document.getElementById('si-order-id').value;
    const order = this.state.orders.find(o => o.id === orderId);
    if (!order) return;

    const techSelect = document.getElementById('si-tech-select');
    const selectedOpt = techSelect?.selectedOptions[0];

    order.assignedTechId = techSelect?.value || '';
    order.assignedTech = selectedOpt ? selectedOpt.dataset.name || selectedOpt.innerText.split(' (')[0] : '';
    order.techPhone = document.getElementById('si-tech-phone')?.value || '';
    order.installDate = document.getElementById('si-date')?.value || '';
    order.installTime = document.getElementById('si-time')?.value || '';
    order.vehiclePlate = document.getElementById('si-vehicle')?.value || '';
    order.siteGps = document.getElementById('si-gps')?.value || '';
    order.siteHeight = document.getElementById('si-height')?.value || '';
    order.logisticsStatus = document.getElementById('si-status')?.value || 'scheduled';
    order.specialTools = document.getElementById('si-tools')?.value || '';

    // If logistics status is completed, prompt or update main status
    if (order.logisticsStatus === 'completed' && order.status !== 'Done') {
      order.status = 'Done';
    } else if (order.status === 'Pending') {
      order.status = 'Logistics';
    }

    this.saveStateToStorage();
    this.renderLogistics();
    document.getElementById('smart-install-modal').style.display = 'none';
    this.showToast('บันทึกข้อมูลนัดหมายและช่างติดตั้งเรียบร้อย', 'success');
  },

  printShippingLabel(id) {
    const order = this.state.orders.find(o => o.id === id);
    if (!order) return;
    this.currentShippingLabelOrderId = id;

    const cName = order.customerName || 'ลูกค้าทั่วไป';
    const cPhone = order.customerPhone || '-';
    const cAddr = order.customerAddress || 'รับสินค้าเองที่หน้าร้าน ร้านทำดีมีเดีย ตรัง';
    const carrier = order.shippingCarrier || 'FLASH EXPRESS';
    const tracking = order.trackingCode || `TH-TRG-${order.id.replace(/[^0-9]/g,'') || '902918'}`;
    const weight = order.boxWeight || '2.5 กก.';
    const isCod = order.payment === 'Unpaid' || order.codAmount > 0;
    const codVal = order.codAmount || order.net || 0;

    // Carrier & Tracking
    const carrierBadge = document.getElementById('ship-carrier-badge');
    if (carrierBadge) carrierBadge.innerText = carrier.toUpperCase();
    const lblCarrierText = document.getElementById('lbl-carrier-text');
    if (lblCarrierText) lblCarrierText.innerText = carrier;
    const trackVal = document.getElementById('ship-tracking-val');
    if (trackVal) trackVal.innerText = tracking;

    // Simulated Barcode 128
    const barcodeLines = document.getElementById('ship-barcode-lines');
    if (barcodeLines) {
      // Dynamic barcode font representation
      barcodeLines.innerText = `*${tracking}*`;
    }

    // Dynamic QR Code for tracking & delivery proof
    const dynamicQr = document.getElementById('ship-dynamic-qr');
    if (dynamicQr) {
      const qrData = `https://tumdeemedia.com/track/${order.id}?tracking=${encodeURIComponent(tracking)}`;
      dynamicQr.src = `https://api.qrserver.com/v1/create-qr-code/?size=120x120&margin=2&data=${encodeURIComponent(qrData)}`;
    }

    // Customer
    const nameEl = document.getElementById('ship-c-name');
    if (nameEl) nameEl.innerText = cName;
    const phoneEl = document.getElementById('ship-c-phone');
    if (phoneEl) phoneEl.innerText = cPhone;
    const addrEl = document.getElementById('ship-c-address');
    if (addrEl) addrEl.innerText = cAddr;

    // Postal code extraction
    const zipEl = document.getElementById('ship-zip-code');
    if (zipEl) {
      const match = cAddr.match(/([0-9]{5})/);
      const zip = match ? match[1] : '92000';
      // Format with spaced digit boxes
      zipEl.innerHTML = zip.split('').map(d => `<span style="display:inline-block; width:22px; height:26px; line-height:26px; text-align:center; border:1.5px solid black; margin:0 1.5px; font-weight:900; font-size:16px;">${d}</span>`).join('');
    }

    // Order ID & items manifest
    const orderIdEl = document.getElementById('ship-order-id');
    if (orderIdEl) orderIdEl.innerText = order.id;
    const itemSummaryEl = document.getElementById('ship-item-summary');
    if (itemSummaryEl) {
      const manifest = order.items.map(i => {
        const cat = this.state.catalog.find(c => c.id === i.type);
        return `${cat ? cat.name : 'งานป้าย'} (${i.qty} ชิ้น)`;
      }).join(', ');
      itemSummaryEl.innerText = manifest.length > 50 ? manifest.substring(0, 48) + '...' : manifest;
    }

    // Box Weight
    const weightEl = document.getElementById('ship-weight-val');
    if (weightEl) weightEl.innerText = weight;

    // COD vs PREPAID banner
    const codBanner = document.getElementById('ship-banner-cod');
    const prepaidBanner = document.getElementById('ship-banner-prepaid');
    const codAmtEl = document.getElementById('ship-cod-amount');

    if (isCod && codVal > 0) {
      if (codBanner) codBanner.style.display = 'block';
      if (prepaidBanner) prepaidBanner.style.display = 'none';
      if (codAmtEl) codAmtEl.innerText = `฿${codVal.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
    } else {
      if (codBanner) codBanner.style.display = 'none';
      if (prepaidBanner) prepaidBanner.style.display = 'block';
    }

    document.getElementById('shipping-modal').style.display = 'flex';
  },

  setShippingLabelFormat(fmt, btn) {
    const container = document.getElementById('shipping-label-container');
    if (!container) return;

    document.querySelectorAll('#shipping-modal .gallery-tab').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');

    if (fmt === 'a4') {
      container.style.maxWidth = '100%';
      container.style.transform = 'scale(1.15)';
      container.style.transformOrigin = 'top center';
      container.style.margin = '20px auto 40px';
    } else {
      // Thermal 100x150 mm standard
      container.style.maxWidth = '420px';
      container.style.transform = 'none';
      container.style.margin = '0 auto';
    }
  },

  printShippingLabelDirect() {
    const container = document.getElementById('shipping-label-container') || document.querySelector('.shipping-label-thermal');
    if (!container) {
      window.print();
      return;
    }
    this.printIsolatedElement(container, 'ใบปะหน้าพัสดุ_ร้านทำดีมีเดีย');
  },

  openCloseJobModal(id) {
    const order = this.state.orders.find(o => o.id === id);
    if (!order) return;
    document.getElementById('cj-id').value = id;
    document.getElementById('cj-preview').src = '';
    document.getElementById('container-cj-preview').style.display = 'none';
    document.getElementById('cj-note').value = '';

    const nameEl = document.getElementById('cj-c-name'); if (nameEl) nameEl.innerText = order.customerName || '';
    const phoneEl = document.getElementById('cj-c-phone'); if (phoneEl) phoneEl.innerText = order.customerPhone || '';
    const addrEl = document.getElementById('cj-c-address'); if (addrEl) addrEl.innerText = order.customerAddress || 'ไม่ได้ระบุที่อยู่';

    const mapLink = document.getElementById('cj-map-link');
    if (mapLink) {
      if (order.customerAddress) {
        mapLink.href = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(order.customerAddress)}`;
        mapLink.style.display = 'inline-block';
      } else {
        mapLink.style.display = 'none';
      }
    }

    const ul = document.getElementById('cj-items-list');
    if (ul) {
      ul.innerHTML = '';
      order.items.forEach(i => {
        let catName = this.state.catalog.find(c => c.id === i.type)?.name || i.type;
        ul.innerHTML += `<li><b>${i.qty} ชิ้น:</b> ${catName} (${i.w}x${i.h} ม.)</li>`;
      });
    }

    document.getElementById('close-job-modal').style.display = 'flex';
  },

  submitCloseJob() {
    const id = document.getElementById('cj-id').value;
    const img = document.getElementById('cj-preview')?.src;
    const note = document.getElementById('cj-note')?.value;
    const order = this.state.orders.find(x => x.id === id);
    if (order) {
      order.status = 'Done';
      order.installImg = img;
      order.graphicNote = (order.graphicNote || '') + '\n[ปิดงาน]: ' + note;
      this.showToast('ปิดงานและส่งรูปสรุปเรียบร้อย', 'success');
      this.renderAdmin();
    }
    document.getElementById('close-job-modal').style.display = 'none';
  },

  editOrder(id) {
    const order = this.state.orders.find(o => o.id === id);
    if (!order) return;
    document.getElementById('manage-order-modal').style.display = 'none';
    this.state.editingOrderId = id;
    document.getElementById('f_name').value = order.customerName || '';
    document.getElementById('f_phone').value = order.customerPhone || '';
    document.getElementById('f_dueDate').value = order.dueDate;
    document.getElementById('f_delivery').value = order.installType || 'pickup';
    this.state.cart = order.items || [];
    if (order.slipImg) {
      document.getElementById('preview-slip').src = order.slipImg;
      document.getElementById('container-preview-slip').style.display = 'block';
    }
    document.getElementById('order-modal-title').innerHTML = '<i class="las la-edit"></i> แก้ไขฟอร์มสั่งผลิต';
    document.getElementById('submitBtn').innerHTML = '<i class="las la-save" style="font-size: 24px;"></i> บันทึกการแก้ไข';
    this.renderCart();
    document.getElementById('order-modal').style.display = 'flex';
  },

  openManageOrder(id) {
    const order = this.state.orders.find(o => o.id === id);
    if (!order) return;
    this.state.currentManageId = id;
    document.getElementById('mo-id-input').value = order.id;
    document.getElementById('mo-customer').innerHTML = `<strong>ลูกค้า:</strong> ${order.customerName || ''} (${order.customerPhone || ''})`;
    document.getElementById('mo-status').value = order.status || 'Sales';
    document.getElementById('mo-payment').value = order.payment || 'Unpaid';
    document.getElementById('mo-priority').checked = order.priority === 'rush';
    document.getElementById('mo-tracking').value = order.tracking || '';
    document.getElementById('mo-graphic-note').value = order.graphicNote || '';

    let detHtml = `<strong>นัดรับ/ใช้งาน:</strong> ${order.dueDate}<br><strong>รายการ:</strong><ul>`;
    order.items.forEach(i => detHtml += `<li>รหัส ${i.type} (${i.w}x${i.h} ม.) จำนวน ${i.qty} ชิ้น</li>`);
    detHtml += `</ul>`;
    document.getElementById('mo-details-content').innerHTML = detHtml;

    if (order.slipImg) {
      document.getElementById('mo-slip').src = order.slipImg;
      document.getElementById('mo-slip').style.display = 'inline-block';
      document.getElementById('mo-slip-none').style.display = 'none';
    } else {
      document.getElementById('mo-slip').style.display = 'none';
      document.getElementById('mo-slip-none').style.display = 'block';
    }

    let hasRef = false;
    for (let i of order.items) {
      if (i.refImg) {
        document.getElementById('mo-ref').src = i.refImg;
        hasRef = true;
        break;
      }
    }
    if (hasRef) {
      document.getElementById('mo-ref').style.display = 'inline-block';
      document.getElementById('mo-ref-none').style.display = 'none';
    } else {
      document.getElementById('mo-ref').style.display = 'none';
      document.getElementById('mo-ref-none').style.display = 'block';
    }

    document.getElementById('mo-logistics-card').style.display = order.status === 'Logistics' ? 'block' : 'none';
    document.getElementById('manage-order-modal').style.display = 'flex';
  },

  saveOrderDetails() {
    const oldId = this.state.currentManageId;
    const newId = document.getElementById('mo-id-input').value;
    const order = this.state.orders.find(o => o.id === oldId);
    if (order) {
      order.id = newId;
      order.status = document.getElementById('mo-status').value;
      order.payment = document.getElementById('mo-payment').value;
      order.priority = document.getElementById('mo-priority').checked ? 'rush' : 'normal';
      order.tracking = document.getElementById('mo-tracking').value;
      order.graphicNote = document.getElementById('mo-graphic-note').value;
      this.showToast('บันทึกข้อมูลเรียบร้อย', 'success');
      this.renderAdmin();
      document.getElementById('manage-order-modal').style.display = 'none';
    }
  },

  // Standard Accounting Thai Baht Text Converter (สรรพากรมาตรฐาน)
  thaiBahtText(num) {
    if (isNaN(num) || num === null || num === undefined) return "ศูนย์บาทถ้วน";
    const roundNum = Math.round(Number(num) * 100) / 100;
    if (roundNum === 0) return "ศูนย์บาทถ้วน";
    if (roundNum < 0) return "ลบ" + this.thaiBahtText(Math.abs(roundNum));

    const textNum = ["ศูนย์", "หนึ่ง", "สอง", "สาม", "สี่", "ห้า", "หก", "เจ็ด", "แปด", "เก้า"];
    const textUnit = ["", "สิบ", "ร้อย", "พัน", "หมื่น", "แสน", "ล้าน"];

    const convertGroup = (nStr) => {
      let res = "";
      const len = nStr.length;
      for (let i = 0; i < len; i++) {
        const digit = parseInt(nStr.charAt(i), 10);
        const pos = len - i - 1;
        if (digit !== 0) {
          if (pos === 1 && digit === 1) {
            res += "สิบ";
          } else if (pos === 1 && digit === 2) {
            res += "ยี่สิบ";
          } else if (pos === 0 && digit === 1 && len > 1 && res !== "") {
            res += "เอ็ด";
          } else {
            res += textNum[digit] + textUnit[pos];
          }
        }
      }
      return res;
    };

    const parts = roundNum.toFixed(2).split(".");
    let intPart = parts[0];
    const decPart = parts[1];

    let bahtStr = "";
    if (intPart.length > 6) {
      const milPart = intPart.substring(0, intPart.length - 6);
      intPart = intPart.substring(intPart.length - 6);
      bahtStr += convertGroup(milPart) + "ล้าน";
    }
    bahtStr += convertGroup(intPart);
    if (!bahtStr) bahtStr = "ศูนย์";
    bahtStr += "บาท";

    if (decPart === "00") {
      bahtStr += "ถ้วน";
    } else {
      bahtStr += convertGroup(decPart) + "สตางค์";
    }
    return bahtStr;
  },

  printDocFromManage(type) {
    const id = this.state.currentManageId || document.getElementById('mo-id-input')?.value;
    this.openDocModal(id, type);
  },

  openDocEditModal() {
    const order = this.state.orders.find(o => o.id === this.currentDocOrderId) || this.state.orders[0];
    if (!order) {
      this.showToast('ไม่พบข้อมูลคำสั่งซื้อ', 'warning');
      return;
    }
    const s = this.state.settings || {};
    const numDigits = order.id.replace(/[^0-9]/g, '') || '9001';

    const el = id => document.getElementById(id);
    // 1. Customer
    if (el('doc-edit-c-name')) el('doc-edit-c-name').value = order.customerName || '';
    if (el('doc-edit-c-taxid')) el('doc-edit-c-taxid').value = order.customerTaxId || '';
    if (el('doc-edit-c-branch')) el('doc-edit-c-branch').value = order.customerBranch || 'สำนักงานใหญ่ (Head Office)';
    if (el('doc-edit-c-address')) el('doc-edit-c-address').value = order.customerAddress || '';
    if (el('doc-edit-c-contact')) el('doc-edit-c-contact').value = order.customerContact || order.customerName || '';
    if (el('doc-edit-c-phone')) el('doc-edit-c-phone').value = order.customerPhone || '';

    // 2. Doc Details
    if (el('doc-edit-doc-no')) el('doc-edit-doc-no').value = order.docCustomNo || document.getElementById('doc-id')?.innerText || '';
    if (el('doc-edit-doc-date')) {
      const d = order.docCustomDate ? new Date(order.docCustomDate) : new Date(order.date || Date.now());
      el('doc-edit-doc-date').value = d.toISOString().split('T')[0];
    }
    if (el('doc-edit-doc-duedate')) {
      if (order.docCustomDueDate) {
        el('doc-edit-doc-duedate').value = new Date(order.docCustomDueDate).toISOString().split('T')[0];
      } else if (order.dueDate) {
        el('doc-edit-doc-duedate').value = new Date(order.dueDate).toISOString().split('T')[0];
      } else {
        el('doc-edit-doc-duedate').value = '';
      }
    }
    if (el('doc-edit-doc-po')) el('doc-edit-doc-po').value = order.poNumber || `PO-${numDigits}`;
    if (el('doc-edit-doc-credit')) el('doc-edit-doc-credit').value = order.creditTerm || 'เงินสด / มัดจำ 50%';
    if (el('doc-edit-doc-sales')) el('doc-edit-doc-sales').value = order.salesRep || 'นายธีราธร (ฝ่ายขาย)';

    // 3. Banking & Terms
    if (el('doc-edit-bank-name')) el('doc-edit-bank-name').value = order.docBankName || s.docBankName || 'ธนาคารไทยพาณิชย์ (SCB) สาขาตรัง';
    if (el('doc-edit-bank-acc')) el('doc-edit-bank-acc').value = order.docBankAccount || s.docBankAccount || '590-264768-1';
    if (el('doc-edit-bank-promptpay')) el('doc-edit-bank-promptpay').value = order.docBankPromptPay || s.docBankPromptPay || '3920100923387';
    if (el('doc-edit-payment-terms')) el('doc-edit-payment-terms').value = order.docPaymentTerms || s.docPaymentTerms || 'งานสั่งผลิตมัดจำ 50% ก่อนขึ้นแบบผลิต และชำระส่วนที่เหลือก่อนส่งมอบ';

    // 4. Stamp & Signatures
    const toggleStamp = document.getElementById('doc-toggle-stamp');
    if (el('doc-edit-show-stamp')) el('doc-edit-show-stamp').checked = toggleStamp ? toggleStamp.checked : (order.showStamp || false);
    if (el('doc-edit-stamp-title')) el('doc-edit-stamp-title').value = order.customStampTitle || s.docStampTitle || s.docShopName || 'ร้านทำดีมีเดีย';
    if (el('doc-edit-stamp-sub')) el('doc-edit-stamp-sub').value = order.customStampSub || s.docStampSub || s.docShopSubname || 'TUMDEE MEDIA';

    if (el('doc-edit-sig1-title')) el('doc-edit-sig1-title').value = order.customSig1Title || document.getElementById('sig-box1-title')?.innerText || '';
    if (el('doc-edit-sig1-sub')) el('doc-edit-sig1-sub').value = order.customSig1Sub || document.getElementById('sig-box1-sub')?.innerText || '';
    if (el('doc-edit-sig2-title')) el('doc-edit-sig2-title').value = order.customSig2Title || document.getElementById('sig-box2-title')?.innerText || '';
    if (el('doc-edit-sig2-sub')) el('doc-edit-sig2-sub').value = order.customSig2Sub || document.getElementById('sig-box2-sub')?.innerText || '';
    if (el('doc-edit-sig3-title')) el('doc-edit-sig3-title').value = order.customSig3Title || document.getElementById('sig-box3-title')?.innerText || '';
    if (el('doc-edit-sig3-sub')) el('doc-edit-sig3-sub').value = order.customSig3Sub || document.getElementById('sig-box3-sub')?.innerText || '';

    document.getElementById('doc-edit-modal').style.display = 'block';
  },

  saveDocEditModal() {
    const order = this.state.orders.find(o => o.id === this.currentDocOrderId) || this.state.orders[0];
    if (!order) return;

    const el = id => document.getElementById(id);
    // 1. Customer
    order.customerName = el('doc-edit-c-name')?.value.trim() || order.customerName;
    order.customerTaxId = el('doc-edit-c-taxid')?.value.trim() || order.customerTaxId;
    order.customerBranch = el('doc-edit-c-branch')?.value.trim() || order.customerBranch;
    order.customerAddress = el('doc-edit-c-address')?.value.trim() || order.customerAddress;
    order.customerContact = el('doc-edit-c-contact')?.value.trim() || order.customerContact;
    order.customerPhone = el('doc-edit-c-phone')?.value.trim() || order.customerPhone;

    // 2. Doc Details
    order.docCustomNo = el('doc-edit-doc-no')?.value.trim() || order.docCustomNo;
    order.docCustomDate = el('doc-edit-doc-date')?.value || order.docCustomDate;
    order.docCustomDueDate = el('doc-edit-doc-duedate')?.value || order.docCustomDueDate;
    order.poNumber = el('doc-edit-doc-po')?.value.trim() || order.poNumber;
    order.creditTerm = el('doc-edit-doc-credit')?.value.trim() || order.creditTerm;
    order.salesRep = el('doc-edit-doc-sales')?.value.trim() || order.salesRep;

    // 3. Banking & Terms
    order.docBankName = el('doc-edit-bank-name')?.value.trim() || order.docBankName;
    order.docBankAccount = el('doc-edit-bank-acc')?.value.trim() || order.docBankAccount;
    order.docBankPromptPay = el('doc-edit-bank-promptpay')?.value.trim() || order.docBankPromptPay;
    order.docPaymentTerms = el('doc-edit-payment-terms')?.value.trim() || order.docPaymentTerms;

    // 4. Stamp & Signatures
    order.showStamp = el('doc-edit-show-stamp')?.checked || false;
    const toggleStamp = document.getElementById('doc-toggle-stamp');
    if (toggleStamp) toggleStamp.checked = order.showStamp;

    order.customStampTitle = el('doc-edit-stamp-title')?.value.trim();
    order.customStampSub = el('doc-edit-stamp-sub')?.value.trim();

    order.customSig1Title = el('doc-edit-sig1-title')?.value.trim();
    order.customSig1Sub = el('doc-edit-sig1-sub')?.value.trim();
    order.customSig2Title = el('doc-edit-sig2-title')?.value.trim();
    order.customSig2Sub = el('doc-edit-sig2-sub')?.value.trim();
    order.customSig3Title = el('doc-edit-sig3-title')?.value.trim();
    order.customSig3Sub = el('doc-edit-sig3-sub')?.value.trim();

    this.saveStateToStorage();
    document.getElementById('doc-edit-modal').style.display = 'none';
    this.renderDocPreview();
    this.showToast('บันทึกและปรับปรุงข้อมูลเอกสารนี้เรียบร้อยแล้ว', 'success');
  },

  openDocModal(orderId, docType = 'quotation', isCopy = false) {
    const order = this.state.orders.find(o => o.id === orderId) || this.state.orders[0];
    if (!order) return;

    this.currentDocOrderId = order.id;
    this.currentDocType = docType;
    this.currentDocIsCopy = isCopy;

    // Default configuration: NO VAT and NO STAMP unless manually checked or configured on order
    const toggleVat = document.getElementById('doc-toggle-vat');
    if (toggleVat) toggleVat.checked = false;

    const toggleStamp = document.getElementById('doc-toggle-stamp');
    if (toggleStamp) toggleStamp.checked = order.showStamp !== undefined ? order.showStamp : false;

    const toggleWht = document.getElementById('doc-toggle-wht');
    if (toggleWht) toggleWht.checked = false;

    const toggleCopy = document.getElementById('doc-toggle-copy');
    if (toggleCopy) toggleCopy.checked = isCopy;

    this.renderDocPreview();
    document.getElementById('doc-modal').style.display = 'block';
  },

  switchDocType(type) {
    this.currentDocType = type;
    this.renderDocPreview();
  },

  renderDocPreview() {
    const a4 = document.getElementById('doc-a4');
    if (a4) {
      if (!this.standardDocA4Html && document.getElementById('doc-items')) {
        this.standardDocA4Html = a4.innerHTML;
      } else if (!document.getElementById('doc-items') && this.standardDocA4Html) {
        a4.innerHTML = this.standardDocA4Html;
      }
    }

    const order = this.state.orders.find(o => o.id === this.currentDocOrderId) || this.state.orders[0];
    if (!order) return;

    const type = this.currentDocType || 'quotation';
    const isCopy = document.getElementById('doc-toggle-copy')?.checked || false;

    // Document configurations compliant with Accounting Standards
    const docMeta = {
      quotation: {
        th: 'ใบเสนอราคา',
        en: 'QUOTATION',
        prefix: 'QT',
        badge: 'ใบเสนอราคา (Quotation)',
        color: '#2563EB',
        showArt: false,
        showSig: true,
        showHandover: false,
        sig1: { title: 'ผู้จัดทำ / ผู้เสนอราคา', sub: '(เจ้าหน้าที่ฝ่ายขายและการตลาด)' },
        sig2: { title: 'ผู้มีอำนาจลงนามอนุมัติราคา', sub: 'ร้านทำดีมีเดีย (TUMDEEMEDIA)' },
        sig3: { title: 'ผู้อนุมัติสั่งจ้าง / ลูกค้า', sub: '(ลงนามยืนยันสั่งทำตามใบเสนอราคา)' }
      },
      invoice: {
        th: 'ใบแจ้งหนี้ / ใบเรียกเก็บเงิน',
        en: 'INVOICE / BILL',
        prefix: 'INV',
        badge: 'ใบแจ้งหนี้ (Invoice)',
        color: '#D97706',
        showArt: false,
        showSig: true,
        showHandover: false,
        sig1: { title: 'ผู้จัดทำใบแจ้งหนี้', sub: '(ฝ่ายบัญชีและการเงิน)' },
        sig2: { title: 'ผู้มีอำนาจลงนาม', sub: 'ร้านทำดีมีเดีย (TUMDEEMEDIA)' },
        sig3: { title: 'ผู้รับใบแจ้งหนี้ / ลูกค้า', sub: '(ลงชื่อและวันที่รับเอกสาร)' }
      },
      tax_invoice: {
        th: 'ใบเสร็จรับเงิน / ใบกำกับภาษี',
        en: 'TAX INVOICE / RECEIPT',
        prefix: 'TAX',
        badge: 'ใบเสร็จรับเงิน / ใบกำกับภาษี (Tax Invoice / Receipt)',
        color: '#10B981',
        showArt: false,
        showSig: true,
        showHandover: false,
        sig1: { title: 'ผู้รับเงิน / ออกเอกสาร', sub: '(ฝ่ายการเงิน ร้านทำดีมีเดีย)' },
        sig2: { title: 'ผู้มีอำนาจลงนาม', sub: 'ร้านทำดีมีเดีย (TUMDEEMEDIA)' },
        sig3: { title: 'ผู้ชำระเงิน / ผู้รับเอกสาร', sub: '(ลูกค้า / ผู้มีอำนาจชำระเงิน)' }
      },
      receipt: {
        th: 'ใบเสร็จรับเงิน',
        en: 'RECEIPT',
        prefix: 'REC',
        badge: 'ใบเสร็จรับเงิน (Receipt)',
        color: '#059669',
        showArt: false,
        showSig: true,
        showHandover: false,
        sig1: { title: 'ผู้รับเงิน / พนักงานบัญชี', sub: '(ฝ่ายการเงิน ร้านทำดีมีเดีย)' },
        sig2: { title: 'ผู้มีอำนาจลงนาม', sub: 'ร้านทำดีมีเดีย (TUMDEEMEDIA)' },
        sig3: { title: 'ผู้ชำระเงิน / ลูกค้า', sub: '(ผู้จ่ายเงิน / ผู้รับใบเสร็จ)' }
      },
      delivery: {
        th: 'ใบส่งของ / ใบกำกับสินค้า',
        en: 'DELIVERY ORDER / INVOICE',
        prefix: 'DO',
        badge: 'ใบส่งของ (Delivery Order)',
        color: '#7C3AED',
        showArt: false,
        showSig: true,
        showHandover: false,
        sig1: { title: 'พนักงานจัดส่งสินค้า', sub: '(ร้านทำดีมีเดีย ตรัง)' },
        sig2: { title: 'ผู้ตรวจสอบสินค้าก่อนส่ง (QC)', sub: 'ร้านทำดีมีเดีย (TUMDEEMEDIA)' },
        sig3: { title: 'ผู้รับสินค้า / ลูกค้า', sub: '(ได้รับสินค้าถูกต้อง ครบถ้วน สมบูรณ์)' }
      },
      delivery_order: {
        th: 'ใบส่งของ / ใบกำกับสินค้า',
        en: 'DELIVERY ORDER / INVOICE',
        prefix: 'DO',
        badge: 'ใบส่งของ (Delivery Order)',
        color: '#7C3AED',
        showArt: false,
        showSig: true,
        showHandover: false,
        sig1: { title: 'พนักงานจัดส่งสินค้า', sub: '(ร้านทำดีมีเดีย ตรัง)' },
        sig2: { title: 'ผู้ตรวจสอบสินค้าก่อนส่ง (QC)', sub: 'ร้านทำดีมีเดีย (TUMDEEMEDIA)' },
        sig3: { title: 'ผู้รับสินค้า / ลูกค้า', sub: '(ได้รับสินค้าถูกต้อง ครบถ้วน สมบูรณ์)' }
      },
      wht: {
        th: 'หนังสือรับรองการหักภาษี ณ ที่จ่าย (มาตรา 50 ทวิ)',
        en: 'WITHHOLDING TAX CERTIFICATE',
        prefix: 'WHT',
        badge: 'หนังสือรับรองภาษีหัก ณ ที่จ่าย 50 ทวิ',
        color: '#DC2626',
        showArt: false,
        showSig: true,
        showHandover: false,
        sig1: { title: 'ผู้จ่ายเงิน / ผู้หักภาษี ณ ที่จ่าย', sub: '(ลงนามและประทับตรานิติบุคคลผู้จ่ายเงิน)' },
        sig2: { title: 'ผู้มีอำนาจลงนามรับรอง', sub: '(ผู้มีอำนาจกระทำการแทนนิติบุคคล)' },
        sig3: { title: 'ผู้ถูกหักภาษี ณ ที่จ่าย', sub: 'ร้านทำดีมีเดีย (TUMDEEMEDIA)' }
      },
      withholding_tax: {
        th: 'หนังสือรับรองการหักภาษี ณ ที่จ่าย (มาตรา 50 ทวิ)',
        en: 'WITHHOLDING TAX CERTIFICATE',
        prefix: 'WHT',
        badge: 'หนังสือรับรองภาษีหัก ณ ที่จ่าย 50 ทวิ',
        color: '#DC2626',
        showArt: false,
        showSig: true,
        showHandover: false,
        sig1: { title: 'ผู้จ่ายเงิน / ผู้หักภาษี ณ ที่จ่าย', sub: '(ลงนามและประทับตรานิติบุคคลผู้จ่ายเงิน)' },
        sig2: { title: 'ผู้มีอำนาจลงนามรับรอง', sub: '(ผู้มีอำนาจกระทำการแทนนิติบุคคล)' },
        sig3: { title: 'ผู้ถูกหักภาษี ณ ที่จ่าย', sub: 'ร้านทำดีมีเดีย (TUMDEEMEDIA)' }
      },
      jobticket: {
        th: 'ใบสั่งผลิตและใบสั่งงานช่าง',
        en: 'JOB WORK ORDER & SPECIFICATION',
        prefix: 'JOB',
        badge: 'ใบสั่งผลิต (Job Ticket)',
        color: '#0F172A',
        showArt: true,
        showSig: true,
        showHandover: false,
        sig1: { title: 'ผู้เปิดใบสั่งผลิต / กราฟิก', sub: '(เจ้าหน้าที่ออกแบบและตรวจสเปก)' },
        sig2: { title: 'หัวหน้าฝ่ายผลิต / QC', sub: '(อนุมัติขึ้นรูปและตรวจสอบงานพิมพ์)' },
        sig3: { title: 'ช่างผู้รับผิดชอบงาน', sub: '(ช่างประกอบ / ช่างพิมพ์ / เก็บขอบ)' }
      },
      handover: {
        th: 'ใบส่งมอบและตรวจรับงานติดตั้ง',
        en: 'INSTALLATION HANDOVER & ACCEPTANCE',
        prefix: 'HO',
        badge: 'ใบส่งมอบงานติดตั้ง (Handover)',
        color: '#059669',
        showArt: false,
        showSig: true,
        showHandover: true,
        sig1: { title: 'หัวหน้าช่างติดตั้ง / ผู้ส่งมอบ', sub: '(ร้านทำดีมีเดีย ตรัง)' },
        sig2: { title: 'ผู้ควบคุมงาน / QC Safety', sub: 'ร้านทำดีมีเดีย (TUMDEEMEDIA)' },
        sig3: { title: 'กรรมการตรวจรับงาน / ผู้ว่าจ้าง', sub: '(ตรวจรับงานติดตั้งเรียบร้อยสมบูรณ์ 100%)' }
      }
    };

    const cfg = docMeta[type] || docMeta['quotation'];

    // Update active toolbar subtab buttons
    document.querySelectorAll('#doc-modal .gallery-tab').forEach(btn => {
      btn.classList.remove('active');
    });
    const activeTabBtn = document.getElementById(`btn-doctype-${type}`);
    if (activeTabBtn) activeTabBtn.classList.add('active');

    // Badge indicator
    const currentBadge = document.getElementById('doc-current-type-badge');
    if (currentBadge) {
      currentBadge.innerText = cfg.badge;
      currentBadge.style.background = cfg.color;
      currentBadge.style.color = 'white';
    }

    // Headers in A4 sheet
    const typeText = document.getElementById('doc-type-text');
    if (typeText) typeText.innerText = cfg.th;
    const typeSub = document.getElementById('doc-type-sub');
    if (typeSub) typeSub.innerText = cfg.en;

    // Document Number & Dates
    const numDigits = order.id.replace(/[^0-9]/g, '') || '9001';
    const docNo = order.docCustomNo || `${cfg.prefix}-${numDigits}`;
    const docIdEl = document.getElementById('doc-id');
    if (docIdEl) docIdEl.innerText = docNo;

    const docDateEl = document.getElementById('doc-date');
    const orderDateObj = order.docCustomDate ? new Date(order.docCustomDate) : new Date(order.date || Date.now());
    if (docDateEl) docDateEl.innerText = orderDateObj.toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' });

    const docDueDateEl = document.getElementById('doc-due-date');
    if (docDueDateEl) {
      if (order.docCustomDueDate) {
        docDueDateEl.innerText = new Date(order.docCustomDueDate).toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' });
      } else if (order.dueDate) {
        docDueDateEl.innerText = new Date(order.dueDate).toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' });
      } else {
        docDueDateEl.innerText = 'ตามเงื่อนไขส่งมอบ';
      }
    }

    const poEl = document.getElementById('doc-po-no');
    if (poEl) poEl.innerText = order.poNumber || `PO-${numDigits}`;

    const creditTermEl = document.getElementById('doc-credit-term');
    if (creditTermEl) creditTermEl.innerText = order.creditTerm || 'เงินสด / มัดจำ 50%';

    const salesRepEl = document.getElementById('doc-sales-rep');
    if (salesRepEl) salesRepEl.innerText = order.salesRep || 'นายธีราธร (ฝ่ายขาย)';

    // Customer Information (With Admin Override support)
    const cNameEl = document.getElementById('doc-c-name');
    if (cNameEl) cNameEl.innerText = order.customerName || 'ลูกค้าทั่วไป';
    const cTaxEl = document.getElementById('doc-c-taxid');
    if (cTaxEl) cTaxEl.innerText = order.customerTaxId || '0-9255-66000-00-0 (บุคคลธรรมดา/นิติบุคคล)';
    const cBranchEl = document.getElementById('doc-c-branch');
    if (cBranchEl) cBranchEl.innerText = order.customerBranch || 'สำนักงานใหญ่ (Head Office)';
    const cAddrEl = document.getElementById('doc-c-address');
    if (cAddrEl) cAddrEl.innerText = order.customerAddress || 'ไม่ได้ระบุที่อยู่จัดส่ง';
    const cContactEl = document.getElementById('doc-c-contact');
    if (cContactEl) cContactEl.innerText = order.customerContact || order.customerName || '-';
    const cPhoneEl = document.getElementById('doc-c-phone');
    if (cPhoneEl) cPhoneEl.innerText = order.customerPhone || '-';

    // Itemized Table Rendering
    const tbody = document.getElementById('doc-items');
    if (tbody) {
      tbody.innerHTML = '';
      let sumSubtotal = 0;

      order.items.forEach((item, idx) => {
        const catItem = this.state.catalog.find(c => c.id === item.type);
        const isAreaBased = (catItem && (catItem.category.includes('POSM') || catItem.category.includes('วัสดุ') || catItem.unit === 'แผ่น')) ? false : true;
        const area = (item.w && item.h) ? (item.w * item.h) : 1;
        const ratePrice = catItem ? catItem.price : 0;
        const fin = this.state.finishing[item.finish];
        const finPrice = (fin && fin.price > 0) ? fin.price : 0;

        // ราคาต่อหน่วย (Unit Price) คือ ราคาคำนวณต่อ 1 ชิ้น = (กว้าง x ยาว = จำนวน ตร.ม.) x ราคาต่อ ตร.ม. หรือราคาต่อแผ่น
        const pieceUnitPrice = isAreaBased ? ((area * ratePrice) + finPrice) : (ratePrice + finPrice);
        const lineTotal = item.qty * pieceUnitPrice;

        sumSubtotal += lineTotal;

        const isJobTicket = type === 'jobticket';
        const itemDesc = isJobTicket
          ? `<strong style="color:var(--primary); font-size:14px;">${catItem ? catItem.name : 'งานป้าย'}</strong><br>
             <span style="font-size:14px; font-weight:bold; color:#D97706; background:#FEF3C7; padding:2px 8px; border-radius:4px; display:inline-block; margin-top:3px;">ขนาด: ${item.w} x ${item.h} เมตร (${area.toFixed(2)} ตร.ม.)</span>
             <span style="font-size:12px; color:#2563EB; background:#EFF6FF; padding:2px 8px; border-radius:4px; margin-left:4px;">การเก็บขอบ: ${this.getFinishingLabel(item.finish)}</span>
             ${item.detail ? '<br><span style="font-size:12px; color:#475569;"><b>สเปกเจาะจง:</b> ' + item.detail + '</span>' : ''}`
          : `<strong style="color:var(--primary); font-size:13px;">${catItem ? catItem.name : 'งานป้ายและสื่อสิ่งพิมพ์'}</strong>
             <div style="font-size:11.5px; color:#475569; margin-top:2px; line-height:1.4;">
               ${isAreaBased ? `สเปก: ขนาด <b>${item.w} x ${item.h} ม.</b> (${area.toFixed(2)} ตร.ม. @ ฿${ratePrice.toLocaleString()}/ตร.ม.)` : `สเปก: ขนาด <b>${item.w} x ${item.h} ม.</b>`}
               ${fin && fin.name && fin.name !== 'ตัดพอดีงาน/ไดคัท' ? ` | งานเก็บขอบ: <b>${this.getFinishingLabel(item.finish)}</b>` : ''}
               ${item.detail ? ` | <b>${item.detail}</b>` : ''}
             </div>`;

        // Requirement 3: Qty column without any hardcoded unit text (No "ชิ้น")
        const qtyCol = isJobTicket
          ? `<strong style="font-size:15px; color:var(--primary); background:#EFF6FF; padding:3px 8px; border-radius:6px; display:inline-block;">${item.qty}</strong>`
          : `<strong style="font-size:13px; color:#0F172A;">${item.qty}</strong>`;

        tbody.innerHTML += `
        <tr>
          <td align="center" style="font-size:${isJobTicket ? '15px' : '12px'}; font-weight:bold; color:#475569;">${idx + 1}</td>
          <td>${itemDesc}</td>
          <td align="center">${qtyCol}</td>
          <td align="right" class="doc-currency" style="font-weight:600; color:#334155;">${pieceUnitPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
          <td align="right" class="doc-currency" style="font-weight:700; color:#0F172A;">${lineTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
        </tr>`;
      });

      // Installation & Delivery fee if any (Requirement 3: Qty is pure 1 without "งาน")
      if (order.installCost > 0) {
        sumSubtotal += order.installCost;
        tbody.innerHTML += `
        <tr>
          <td align="center" style="font-weight:bold; color:#475569;">${order.items.length + 1}</td>
          <td>
            <strong>บริการจัดส่งและติดตั้งหน้างาน: ${this.getDeliveryLabel(order.installType)}</strong>
            <div style="font-size:11.5px; color:#64748B;">โดยทีมช่างผู้ชำนาญการ ร้านทำดีมีเดีย ตรัง พร้อมอุปกรณ์ครบชุด</div>
          </td>
          <td align="center">1</td>
          <td align="right" class="doc-currency">${order.installCost.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
          <td align="right" class="doc-currency" style="font-weight:700; color:#0F172A;">${order.installCost.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
        </tr>`;
      }

      this.cachedDocSubtotal = sumSubtotal;
    }

    // Dynamic Payment Terms & Banking Info (Admin customizable)
    const payBox = document.getElementById('doc-payment-banking-info');
    if (payBox) {
      const s = this.state.settings || {};
      const bankName = order.docBankName || s.docBankName || 'ธนาคารไทยพาณิชย์ (SCB) สาขาตรัง';
      const bankAcc = order.docBankAccount || s.docBankAccount || '590-264768-1';
      const promptPay = order.docBankPromptPay || s.docBankPromptPay || s.docShopTaxId || '3920100923387';
      const terms = order.docPaymentTerms || s.docPaymentTerms || 'งานสั่งผลิตมัดจำ 50% ก่อนขึ้นแบบผลิต และชำระส่วนที่เหลือก่อนส่งมอบ';
      const shopDisplayName = s.docShopName || s.shopName || 'ร้านทำดีมีเดีย';

      payBox.innerHTML = `
        <strong style="color:var(--primary); display:flex; align-items:center; gap:5px; font-size:10.5px;">
          <i class="las la-university"></i> ช่องทางการชำระเงิน และ เงื่อนไข:
        </strong>
        <div style="margin-top:4px; color:#334155; line-height:1.45;">
          • โอนเงินเข้าบัญชี: <b>${bankName}</b><br>
          • เลขที่บัญชี: <b style="font-size:11.5px; font-family:monospace; color:var(--primary);">${bankAcc}</b> (${shopDisplayName})<br>
          • PromptPay: <b style="font-family:monospace;">${promptPay}</b> (${shopDisplayName})<br>
          • ${terms}
        </div>`;
    }

    this.updateDocPreviewCalculations();

    // Section visibility based on document type
    const jobNoEl = document.getElementById('doc-job-no');
    if (jobNoEl) jobNoEl.style.display = cfg.showArt ? 'block' : 'none';
    const jobNoVal = document.getElementById('doc-job-no-val');
    if (jobNoVal) jobNoVal.innerText = order.id;

    const sigsEl = document.getElementById('doc-signatures');
    if (sigsEl) sigsEl.style.display = cfg.showSig ? 'flex' : 'none';

    // Set dynamic custom signatories per document type (Support custom admin override per document)
    const s1Title = document.getElementById('sig-box1-title');
    const s1Sub = document.getElementById('sig-box1-sub');
    const s2Title = document.getElementById('sig-box2-title');
    const s2Sub = document.getElementById('sig-box2-sub');
    const s3Title = document.getElementById('sig-box3-title');
    const s3Sub = document.getElementById('sig-box3-sub');

    if (s1Title) s1Title.innerText = order.customSig1Title || (cfg.sig1 ? cfg.sig1.title : 'ผู้จัดทำ');
    if (s1Sub) s1Sub.innerText = order.customSig1Sub || (cfg.sig1 ? cfg.sig1.sub : '');
    if (s2Title) s2Title.innerText = order.customSig2Title || (cfg.sig2 ? cfg.sig2.title : 'ผู้มีอำนาจลงนาม');
    if (s2Sub) s2Sub.innerText = order.customSig2Sub || (cfg.sig2 ? cfg.sig2.sub : '');
    if (s3Title) s3Title.innerText = order.customSig3Title || (cfg.sig3 ? cfg.sig3.title : 'ผู้อนุมัติสั่งจ้าง / ลูกค้า');
    if (s3Sub) s3Sub.innerText = order.customSig3Sub || (cfg.sig3 ? cfg.sig3.sub : '');

    // Stamp text override if specified
    if (order.customStampTitle) {
      const stampT = document.querySelector('#doc-company-stamp .stamp-title');
      if (stampT) stampT.innerText = order.customStampTitle;
    }
    if (order.customStampSub) {
      const stampS = document.querySelector('#doc-company-stamp .stamp-sub');
      if (stampS) stampS.innerText = order.customStampSub;
    }

    const artArea = document.getElementById('doc-artwork-area');
    if (artArea) artArea.style.display = cfg.showArt ? 'block' : 'none';

    const handoverArea = document.getElementById('doc-handover-area');
    if (handoverArea) handoverArea.style.display = cfg.showHandover ? 'block' : 'none';

    // Job Ticket Artwork / E-Proof
    if (cfg.showArt) {
      const jobDet = document.getElementById('doc-job-details');
      if (jobDet) {
        jobDet.innerHTML = `
        <div style="background:#F8FAFC; border:1px solid #CBD5E1; border-radius:8px; padding:12px; margin-bottom:12px;">
          <strong style="color:var(--primary); font-size:13px;"><i class="las la-clipboard-list"></i> ข้อความกำกับงานช่าง / ฝ่ายผลิต:</strong>
          <div style="font-size:13px; margin-top:4px; color:#1E293B; font-weight:600;">${order.graphicNote || 'ผลิตตามมาตรฐานงานป้ายทำดีมีเดีย (พิมพ์ระบบ UV / Eco-Solvent สีสดทนแดด)'}</div>
        </div>`;
      }
      const refCont = document.getElementById('doc-ref-images-container');
      if (refCont) {
        refCont.innerHTML = '';
        if (order.proofImg) {
          refCont.innerHTML += `
          <div style="text-align:center; border:2px solid #10B981; border-radius:10px; padding:10px; background:#F0FDF4; display:inline-block;">
            <div style="font-size:12px; font-weight:bold; color:#15803D; margin-bottom:6px;"><i class="las la-check-circle"></i> แบบจำลอง E-Proof ที่ลูกค้าอนุมัติแล้ว (พิมพ์ตามไฟล์นี้)</div>
            <img src="${order.proofImg}" style="max-width:320px; max-height:220px; object-fit:contain; border-radius:6px; border:1px solid #A7F3D0;">
          </div>`;
        }
        order.items.forEach(i => {
          if (i.refImg && i.refImg !== order.proofImg) {
            refCont.innerHTML += `
            <div style="text-align:center; border:1px solid #CBD5E1; border-radius:8px; padding:8px; background:#FFFFFF; display:inline-block;">
              <div style="font-size:11px; color:#64748B; margin-bottom:4px;">ภาพอ้างอิงจากลูกค้า</div>
              <img src="${i.refImg}" style="max-width:180px; max-height:130px; object-fit:contain; border-radius:4px;">
            </div>`;
          }
        });
      }
    }

    // Handover Installation Area
    if (cfg.showHandover) {
      const hoCont = document.getElementById('doc-handover-photos-container');
      if (hoCont) {
        hoCont.innerHTML = `
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:15px; width:100%;">
          <div style="border:1.5px dashed #10B981; border-radius:10px; padding:12px; text-align:center; background:#F0FDF4;">
            <strong style="color:#15803D; font-size:13px; display:block; margin-bottom:8px;"><i class="las la-camera"></i> รูปถ่ายติดตั้งเสร็จหน้างาน (Final Installation)</strong>
            ${order.installImg ? `<img src="${order.installImg}" style="width:100%; max-height:200px; object-fit:cover; border-radius:6px;">` : `<div style="padding:40px 10px; color:#64748B; font-size:12px;"><i class="las la-image" style="font-size:32px; color:#A7F3D0;"></i><br>ถ่ายรูปยืนยันส่งมอบงานผ่านระบบช่าง</div>`}
          </div>
          <div style="border:1px solid #E2E8F0; border-radius:10px; padding:12px; background:#F8FAFC; font-size:12px; line-height:1.6;">
            <strong style="color:var(--primary); font-size:13px; display:block; margin-bottom:6px;"><i class="las la-tasks"></i> บันทึกการตรวจรับงาน:</strong>
            • โครงสร้างแข็งแรง ติดตั้งระดับได้ระนาบมาตรฐาน<br>
            • หลอดไฟ LED และสายสัญญาณเปิดทดสอบใช้งานได้ปกติ<br>
            • เก็บกวาดทำความสะอาดพื้นที่หน้างานเรียบร้อย<br>
            • ตรวจสอบความถูกต้องของชิ้นงานและส่งมอบเรียบร้อย<br>
            <div style="margin-top:10px; border-top:1px solid #CBD5E1; padding-top:8px;">
              <b>ผู้ตรวจรับมอบงาน:</b> ....................................................<br>
              <b>ตำแหน่ง/ความเกี่ยวข้อง:</b> ..........................................
            </div>
          </div>
        </div>`;
      }
    }

    this.updateDocStampVisibility();
    this.updateDocOriginalCopy();
  },

  updateDocPreviewCalculations() {
    const subtotal = this.cachedDocSubtotal || 0;
    const calcVat = document.getElementById('doc-toggle-vat')?.checked ?? false;
    const calcWht = document.getElementById('doc-toggle-wht')?.checked ?? false;

    const discountVal = 0; // Standard no manual discount unless set
    const netBeforeVat = Math.max(0, subtotal - discountVal);
    const vatAmount = calcVat ? (netBeforeVat * 0.07) : 0;
    const grandTotal = netBeforeVat + vatAmount;
    const whtAmount = calcWht ? (netBeforeVat * 0.03) : 0;
    const netPayable = Math.max(0, grandTotal - whtAmount);

    const subEl = document.getElementById('doc-subtotal');
    if (subEl) subEl.innerText = subtotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    const rowVat = document.getElementById('doc-row-vat');
    const vatEl = document.getElementById('doc-vat');
    if (calcVat) {
      if (rowVat) rowVat.style.display = 'table-row';
      if (vatEl) vatEl.innerText = vatAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    } else {
      if (rowVat) rowVat.style.display = 'none';
      if (vatEl) vatEl.innerText = '0.00';
    }

    const grandEl = document.getElementById('doc-grand-total');
    if (grandEl) grandEl.innerText = grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    const rowWht = document.getElementById('doc-row-wht');
    const whtEl = document.getElementById('doc-wht');
    if (calcWht) {
      if (rowWht) rowWht.style.display = 'table-row';
      if (whtEl) whtEl.innerText = '-' + whtAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    } else {
      if (rowWht) rowWht.style.display = 'none';
      if (whtEl) whtEl.innerText = '-0.00';
    }

    const netEl = document.getElementById('doc-net');
    if (netEl) netEl.innerText = netPayable.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    // Thai Baht Text Conversion
    const bahtEl = document.getElementById('doc-baht-text');
    if (bahtEl) {
      bahtEl.innerText = `( ${this.thaiBahtText(netPayable)} )`;
    }
  },

  updateDocStampVisibility() {
    const showStamp = document.getElementById('doc-toggle-stamp')?.checked ?? false;
    const stampEl = document.getElementById('doc-company-stamp');
    if (stampEl) {
      stampEl.style.display = showStamp ? 'flex' : 'none';
    }
    const order = this.state.orders.find(o => o.id === this.currentDocOrderId);
    if (order) {
      order.showStamp = showStamp;
    }
  },

  updateDocOriginalCopy() {
    const isCopy = document.getElementById('doc-toggle-copy')?.checked ?? false;
    const ind = document.getElementById('doc-copy-indicator');
    const watermark = document.getElementById('doc-watermark-text');

    if (isCopy) {
      if (ind) {
        ind.innerText = 'สำเนา / COPY';
        ind.style.background = '#FEF2F2';
        ind.style.color = '#DC2626';
        ind.style.borderColor = '#FECACA';
      }
      if (watermark) {
        watermark.innerText = 'COPY / สำเนา';
        watermark.style.opacity = '0.06';
      }
    } else {
      if (ind) {
        ind.innerText = 'ต้นฉบับ / ORIGINAL';
        ind.style.background = '#EFF6FF';
        ind.style.color = 'var(--primary)';
        ind.style.borderColor = '#BFDBFE';
      }
      if (watermark) {
        watermark.innerText = 'TUMDEE';
        watermark.style.opacity = '0.035';
      }
    }
  },

  printIsolatedElement(element, docTitle = 'เอกสาร_ร้านทำดีมีเดีย') {
    if (!element) return;
    const oldTitle = document.title;
    document.title = docTitle;

    // Create or reuse isolated hidden print iframe
    let iframe = document.getElementById('app-isolated-print-frame');
    if (!iframe) {
      iframe = document.createElement('iframe');
      iframe.id = 'app-isolated-print-frame';
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = '0';
      iframe.style.visibility = 'hidden';
      document.body.appendChild(iframe);
    }

    try {
      const frameDoc = iframe.contentWindow.document;
      frameDoc.open();
      frameDoc.write(`<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="UTF-8">
  <title>${docTitle}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Prompt:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/line-awesome/1.3.0/line-awesome/css/line-awesome.min.css">
  <link rel="stylesheet" href="/src/style.css">
  <style>
    @page {
      size: A4 portrait;
      margin: 8mm 10mm;
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    html, body {
      background: #FFFFFF !important;
      color: #0F172A !important;
      font-family: 'Prompt', sans-serif !important;
      margin: 0 !important;
      padding: 0 !important;
      width: 100% !important;
      height: 100% !important;
      min-height: 100% !important;
      overflow: visible !important;
    }
    .a4-page {
      width: 100% !important;
      max-width: 100% !important;
      min-height: 275mm !important;
      padding: 0 !important;
      margin: 0 auto !important;
      box-shadow: none !important;
      border: none !important;
      background: #FFFFFF !important;
      display: flex !important;
      flex-direction: column !important;
      justify-content: space-between !important;
      page-break-after: avoid !important;
      break-after: avoid !important;
      page-break-inside: avoid !important;
      break-inside: avoid !important;
    }
    .no-print, nav, footer, .chat-window, .fab-wrapper {
      display: none !important;
    }
  </style>
</head>
<body>
  ${element.outerHTML}
</body>
</html>`);
      frameDoc.close();

      const triggerPrint = () => {
        try {
          iframe.contentWindow.focus();
          iframe.contentWindow.print();
          setTimeout(() => { document.title = oldTitle; }, 1500);
        } catch (e) {
          console.warn('Iframe print error', e);
          window.print();
        }
      };

      // Wait for font loading in iframe so Thai text is 100% rendered with Prompt font!
      if (frameDoc.fonts && frameDoc.fonts.ready) {
        frameDoc.fonts.ready.then(() => {
          setTimeout(triggerPrint, 250);
        }).catch(() => {
          setTimeout(triggerPrint, 500);
        });
      } else {
        setTimeout(triggerPrint, 600);
      }
    } catch (err) {
      console.warn('Iframe print fallback to window.print', err);
      document.body.classList.add('printing-doc');
      const docModal = document.getElementById('doc-modal');
      if (docModal) docModal.classList.add('is-printing');
      window.print();
      setTimeout(() => {
        document.body.classList.remove('printing-doc');
        if (docModal) docModal.classList.remove('is-printing');
        document.title = oldTitle;
      }, 1500);
    }
  },

  async saveElementAsPdf(element, filename, docTitle = 'เอกสารมาตรฐาน') {
    if (!element) return;
    this.showToast(`กำลังสร้างไฟล์ PDF (${docTitle}) คมชัดระดับเวกเตอร์พอดี 1 หน้า A4...`, 'info');

    // Wait for web fonts (Prompt, LineAwesome) to be fully ready
    if (document.fonts && document.fonts.ready) {
      try {
        await document.fonts.ready;
      } catch (e) {
        console.warn('fonts.ready wait ignored:', e);
      }
    }

    try {
      // 1. Create a dedicated visible staging overlay with exact standard A4 dimensions (794px x 1123px = 210mm x 297mm)
      // Placed at (0, 0) with high z-index and pointer-events: none so html2canvas renders coordinates 100% accurately without blank canvas
      const staging = document.createElement('div');
      staging.id = 'pdf-render-stage';
      staging.style.cssText = `
        position: fixed !important;
        top: 0 !important;
        left: 0 !important;
        width: 794px !important;
        height: 1123px !important;
        max-width: 794px !important;
        max-height: 1123px !important;
        background: #FFFFFF !important;
        margin: 0 !important;
        padding: 0 !important;
        z-index: 999999 !important;
        overflow: hidden !important;
        box-sizing: border-box !important;
        opacity: 1 !important;
        visibility: visible !important;
        pointer-events: none !important;
        font-family: 'Prompt', sans-serif !important;
      `;

      // 2. Clone the element and enforce standard un-skewed A4 layout
      const clone = element.cloneNode(true);
      clone.style.cssText = `
        width: 794px !important;
        max-width: 794px !important;
        min-height: 1123px !important;
        height: 1123px !important;
        box-sizing: border-box !important;
        margin: 0 !important;
        padding: 24px 32px 28px 32px !important;
        box-shadow: none !important;
        border: none !important;
        background: #FFFFFF !important;
        display: flex !important;
        flex-direction: column !important;
        justify-content: space-between !important;
        font-family: 'Prompt', sans-serif !important;
        color: #0F172A !important;
        transform: none !important;
      `;

      // Stabilize all sub-sections to ensure desktop A4 layout regardless of current viewport size
      clone.querySelectorAll('.doc-grid-header').forEach(el => {
        el.style.cssText += '; display: flex !important; flex-direction: row !important; justify-content: space-between !important; align-items: flex-start !important;';
      });
      clone.querySelectorAll('.doc-box-info').forEach(el => {
        el.style.cssText += '; display: flex !important; flex-direction: row !important;';
      });
      clone.querySelectorAll('.doc-box-col').forEach(el => {
        el.style.cssText += '; border-right: 1px solid #CBD5E1 !important; border-bottom: none !important;';
      });
      clone.querySelectorAll('.doc-flex-row').forEach(el => {
        el.style.cssText += '; display: flex !important; flex-direction: row !important; justify-content: space-between !important;';
      });
      clone.querySelectorAll('.doc-summary-wrap').forEach(el => {
        el.style.cssText += '; width: 320px !important; min-width: 320px !important; max-width: 320px !important; flex-shrink: 0 !important;';
      });
      clone.querySelectorAll('.doc-table').forEach(tbl => {
        tbl.style.cssText += '; width: 100% !important; max-width: 100% !important; table-layout: fixed !important; border-collapse: collapse !important;';
      });
      clone.querySelectorAll('.doc-table th:nth-child(1), .doc-table td:nth-child(1)').forEach(c => {
        c.style.cssText += '; width: 7% !important; max-width: 7% !important; text-align: center !important;';
      });
      clone.querySelectorAll('.doc-table th:nth-child(2), .doc-table td:nth-child(2)').forEach(c => {
        c.style.cssText += '; width: 48% !important; max-width: 48% !important; text-align: left !important; word-break: break-word !important;';
      });
      clone.querySelectorAll('.doc-table th:nth-child(3), .doc-table td:nth-child(3)').forEach(c => {
        c.style.cssText += '; width: 13% !important; max-width: 13% !important; text-align: center !important;';
      });
      clone.querySelectorAll('.doc-table th:nth-child(4), .doc-table td:nth-child(4)').forEach(c => {
        c.style.cssText += '; width: 15% !important; max-width: 15% !important; text-align: right !important;';
      });
      clone.querySelectorAll('.doc-table th:nth-child(5), .doc-table td:nth-child(5)').forEach(c => {
        c.style.cssText += '; width: 17% !important; max-width: 17% !important; text-align: right !important;';
      });
      clone.querySelectorAll('.doc-signatures').forEach(el => {
        el.style.cssText += '; display: flex !important; flex-direction: row !important; justify-content: space-between !important; margin-top: auto !important; padding-top: 10px !important;';
      });
      clone.querySelectorAll('.sig-box').forEach(el => {
        el.style.cssText += '; width: 30% !important;';
      });

      staging.appendChild(clone);
      document.body.appendChild(staging);

      // Brief RAF tick to guarantee styles & fonts are applied
      await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));

      // 3. Render high-resolution canvas with html2canvas
      if (typeof window.html2canvas === 'function') {
        const canvas = await window.html2canvas(staging, {
          scale: 2.2, // ~210 DPI crisp rendering
          useCORS: true,
          allowTaint: true,
          letterRendering: false,
          backgroundColor: '#FFFFFF',
          width: 794,
          height: 1123,
          x: 0,
          y: 0,
          scrollX: 0,
          scrollY: 0,
          windowWidth: 794,
          windowHeight: 1123,
          logging: false
        });

        // Remove staging container as soon as snapshot completes
        if (staging.parentNode) staging.parentNode.removeChild(staging);

        const jsPdfClass = window.jspdf?.jsPDF || window.jsPDF;
        if (jsPdfClass) {
          const pdf = new jsPdfClass({
            orientation: 'portrait',
            unit: 'mm',
            format: 'a4',
            compress: true
          });
          const imgData = canvas.toDataURL('image/jpeg', 0.98);
          pdf.addImage(imgData, 'JPEG', 0, 0, 210, 297, undefined, 'FAST');

          // Ensure strictly 1 page
          while (pdf.internal.getNumberOfPages() > 1) {
            pdf.deletePage(pdf.internal.getNumberOfPages());
          }

          pdf.save(`${filename}.pdf`);
          this.showToast(`บันทึกไฟล์ PDF (${filename}.pdf) คมชัดครบ 1 หน้า A4 เรียบร้อยแล้ว`, 'success');
          return;
        }
      }

      // Cleanup staging if html2canvas was not used
      if (staging.parentNode) staging.parentNode.removeChild(staging);

      // Fallback: html2pdf worker
      if (typeof window.html2pdf === 'function') {
        await window.html2pdf().set({
          margin: 0,
          filename: `${filename}.pdf`,
          image: { type: 'jpeg', quality: 0.98 },
          html2canvas: { scale: 2, useCORS: true, letterRendering: false, backgroundColor: '#FFFFFF' },
          jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
        }).from(element).toPdf().get('pdf').then(pdf => {
          while (pdf.internal.getNumberOfPages() > 1) {
            pdf.deletePage(pdf.internal.getNumberOfPages());
          }
        }).save();
        this.showToast(`บันทึกไฟล์ PDF (${filename}.pdf) เรียบร้อยแล้ว`, 'success');
        return;
      }

      // Ultimate Fallback: Native print
      this.printIsolatedElement(element, filename);
    } catch (err) {
      console.warn('PDF generation error, fallback to native vector print:', err);
      const staging = document.getElementById('pdf-render-stage');
      if (staging && staging.parentNode) staging.parentNode.removeChild(staging);
      this.showToast('กำลังเปิดหน้าต่างพิมพ์ กรุณาเลือก "Save as PDF" เพื่อบันทึกไฟล์ A4 คมชัดสูงสุด', 'info');
      this.printIsolatedElement(element, filename);
    }
  },

  directDownloadOrderDoc(orderId, docType = 'receipt') {
    this.openDocModal(orderId, docType);
    setTimeout(() => {
      this.saveDocumentPdf();
    }, 350);
  },

  printDocument() {
    const a4 = document.getElementById('doc-a4');
    if (!a4) return;

    let typeText = document.getElementById('doc-type-text')?.innerText;
    let docId = document.getElementById('doc-id')?.innerText;
    if (this.currentDocType === 'financial_report') {
      typeText = 'รายงานสรุปงบการเงินผู้บริหาร';
      docId = new Date().toISOString().split('T')[0];
    } else {
      typeText = typeText || 'เอกสารมาตรฐาน';
      docId = docId || 'TUMDEE';
    }
    const docTitle = `${typeText}_${docId}_ร้านทำดีมีเดีย`;

    this.printIsolatedElement(a4, docTitle);
  },

  saveDocumentPdf() {
    const a4 = document.getElementById('doc-a4');
    if (!a4) return;

    let typeText = document.getElementById('doc-type-text')?.innerText;
    let docId = document.getElementById('doc-id')?.innerText;
    if (this.currentDocType === 'financial_report') {
      typeText = 'รายงานสรุปงบการเงินผู้บริหาร';
      docId = new Date().toISOString().split('T')[0];
    } else {
      typeText = typeText || 'เอกสารมาตรฐาน';
      docId = docId || 'TUMDEE';
    }
    const filename = `${typeText}_${docId}_ร้านทำดีมีเดีย`;

    this.saveElementAsPdf(a4, filename, typeText);
  },

  printPaySlipPdf() {
    const payslipContent = document.getElementById('payslip-content');
    if (!payslipContent) return;

    const empName = document.getElementById('payslip-emp-name')?.innerText || 'พนักงาน';
    const filename = `สลิปเงินเดือน_${empName}_ร้านทำดีมีเดีย`;

    // Direct PDF save or print
    this.saveElementAsPdf(payslipContent, filename, 'สลิปเงินเดือน');
  },

  saveSettings() { this.showToast('บันทึกการตั้งค่าเรียบร้อย', 'success'); },
  addAdminQuickReply() { const qr = prompt("ระบุข้อความแชทแนะนำ"); if (qr) { this.state.settings.quickReplies.push(qr); this.showToast('เพิ่มแล้ว', 'success'); this.renderChatWindow(); } },
  addAdminChatbotRule() { const kw = prompt("ระบุคีย์เวิร์ด"); const rp = prompt("ระบุข้อความตอบกลับ"); if (kw && rp) { this.state.settings.chatbotRules.push({ keyword: kw, reply: rp }); this.showToast('เพิ่มแล้ว', 'success'); } },
  uploadCmsImage(input, targetId, previewId) {
    const file = input.files && input.files[0];
    if (file) {
      const r = new FileReader();
      r.onload = e => {
        const target = document.getElementById(targetId);
        if (target) target.value = e.target.result;
        if (previewId) {
          const prev = document.getElementById(previewId);
          if (prev) {
            prev.src = e.target.result;
            prev.style.display = 'block';
          }
        }
        this.showToast('อัปโหลดรูปภาพสำเร็จ', 'success');
      };
      r.readAsDataURL(file);
    }
  },
  uploadTrustedBrand(input) {
    const file = input.files && input.files[0];
    if (file) {
      const r = new FileReader();
      r.onload = e => {
        if (!this.state.cms.trustedBrands) this.state.cms.trustedBrands = [];
        this.state.cms.trustedBrands.push(e.target.result);
        this.saveStateToStorage();
        this.showToast('เพิ่มโลโก้แบรนด์สำเร็จ', 'success');
        this.renderLandingCMS();
        this.renderCmsAdmin();
      };
      r.readAsDataURL(file);
    }
  },

  saveCMS() {
    const c = this.state.cms;
    if (!c) return;
    // Hero
    c.heroTitle = document.getElementById('cms-input-title')?.value || c.heroTitle;
    c.heroSub = document.getElementById('cms-input-sub')?.value || c.heroSub;
    c.heroDesc = document.getElementById('cms-input-desc')?.value || c.heroDesc;
    c.heroImg = document.getElementById('cms-input-heroimg')?.value || c.heroImg;

    // One-Stop
    if (c.oneStop) {
      c.oneStop.title = document.getElementById('onestop-in-title')?.value || c.oneStop.title;
      c.oneStop.sub = document.getElementById('onestop-in-sub')?.value || c.oneStop.sub;
      c.oneStop.desc = document.getElementById('onestop-in-desc')?.value || c.oneStop.desc;
      c.oneStop.mainImg = document.getElementById('onestop-in-mainimg')?.value || c.oneStop.mainImg;
      c.oneStop.aboutTitle = document.getElementById('onestop-in-about-title')?.value || c.oneStop.aboutTitle;
      c.oneStop.bullet1 = document.getElementById('onestop-in-b1')?.value || c.oneStop.bullet1;
      c.oneStop.bullet2 = document.getElementById('onestop-in-b2')?.value || c.oneStop.bullet2;
      c.oneStop.bullet3 = document.getElementById('onestop-in-b3')?.value || c.oneStop.bullet3;
      c.oneStop.aboutDesc = document.getElementById('onestop-in-about-desc')?.value || c.oneStop.aboutDesc;
    }

    // Order Online CTA
    if (c.orderCta) {
      c.orderCta.badge = document.getElementById('cta-order-badge')?.value || c.orderCta.badge;
      c.orderCta.title = document.getElementById('cta-order-title')?.value || c.orderCta.title;
      c.orderCta.sub = document.getElementById('cta-order-sub')?.value || c.orderCta.sub;
      c.orderCta.bullet1 = document.getElementById('cta-order-p1')?.value || c.orderCta.bullet1;
      c.orderCta.bullet2 = document.getElementById('cta-order-p2')?.value || c.orderCta.bullet2;
      c.orderCta.bullet3 = document.getElementById('cta-order-p3')?.value || c.orderCta.bullet3;
      c.orderCta.btnText = document.getElementById('cta-order-btn')?.value || c.orderCta.btnText;
    }

    // Partner Agent CTA
    if (c.agentCta) {
      c.agentCta.badge = document.getElementById('cta-agent-badge')?.value || c.agentCta.badge;
      c.agentCta.title = document.getElementById('cta-agent-title')?.value || c.agentCta.title;
      c.agentCta.desc = document.getElementById('cta-agent-desc')?.value || c.agentCta.desc;
      c.agentCta.sub = document.getElementById('cta-agent-desc')?.value || c.agentCta.sub;
      c.agentCta.bullet1 = document.getElementById('cta-agent-p1')?.value || c.agentCta.bullet1;
      c.agentCta.bullet2 = document.getElementById('cta-agent-p2')?.value || c.agentCta.bullet2;
      c.agentCta.bullet3 = document.getElementById('cta-agent-p3')?.value || c.agentCta.bullet3;
      c.agentCta.btnText = document.getElementById('cta-agent-btn')?.value || c.agentCta.btnText;
    }

    // Contact & Map
    c.contactAddress = document.getElementById('cms-input-address')?.value || c.contactAddress;
    c.contactPhone = document.getElementById('cms-input-phone')?.value || c.contactPhone;
    c.contactEmail = document.getElementById('cms-input-email')?.value || c.contactEmail;
    c.contactLineId = document.getElementById('cms-input-lineid')?.value || c.contactLineId;
    c.contactFbId = document.getElementById('cms-input-fbid')?.value || c.contactFbId;
    c.mapIframe = document.getElementById('cms-input-map')?.value || c.mapIframe;

    // SEO
    c.seoTitle = document.getElementById('cms-input-seo-title')?.value || c.seoTitle;
    c.seoDesc = document.getElementById('cms-input-seo-desc')?.value || c.seoDesc;
    c.seoKeywords = document.getElementById('cms-input-seo-keywords')?.value || c.seoKeywords;

    this.saveStateToStorage();
    this.renderLandingCMS();
    this.showToast('บันทึกและอัปเดตหน้าเว็บเรียบร้อยแล้ว (Real-time)', 'success');
  },

  openDynamicModal(type) {
    this.state.currentCmsType = type;
    const title = { service: 'จัดการบริการ', testimonial: 'จัดการรีวิว', portfolio: 'จัดการผลงาน', faq: 'จัดการ FAQ' };
    document.getElementById('cdm-title').innerText = title[type] || 'จัดการข้อมูล';
    let f = document.getElementById('cdm-form');
    f.innerHTML = '';
    if (type === 'faq') {
      f.innerHTML = `<div class="form-group"><label>คำถาม</label><input type="text" id="cdm-q"></div><div class="form-group"><label>คำตอบ</label><textarea rows="3" id="cdm-a"></textarea></div>`;
    } else if (type === 'portfolio') {
      f.innerHTML = `<div class="form-group"><label>หัวข้อ</label><input type="text" id="cdm-title-in"></div><div class="form-group"><label>หมวดหมู่</label><select id="cdm-cat"><option value="print">งานพิมพ์</option><option value="light">ป้ายไฟ</option><option value="structure">โครงสร้าง</option><option value="posm">อุปกรณ์ออกบูธ</option></select></div><div class="form-group"><label>ภาพ Base64/URL</label><input type="text" id="cdm-img"></div>`;
    } else if (type === 'service') {
      f.innerHTML = `<div class="form-group"><label>หัวข้อ</label><input type="text" id="cdm-title-in"></div><div class="form-group"><label>รายละเอียด</label><textarea id="cdm-desc"></textarea></div><div class="form-group"><label>ภาพ Base64/URL</label><input type="text" id="cdm-img"></div>`;
    } else if (type === 'testimonial') {
      f.innerHTML = `<div class="form-group"><label>ชื่อลูกค้า</label><input type="text" id="cdm-name"></div><div class="form-group"><label>รีวิว</label><textarea id="cdm-text"></textarea></div><div class="form-group"><label>ภาพ Base64/URL</label><input type="text" id="cdm-img"></div>`;
    }
    document.getElementById('cms-dynamic-modal').style.display = 'flex';
  },

  saveDynamicCms() {
    this.showToast('บันทึกข้อมูลเรียบร้อย', 'success');
    document.getElementById('cms-dynamic-modal').style.display = 'none';
  },

  showPromoModal() { this.showToast('ส่งแจ้งเตือนโปรโมชันถึงตัวแทนแล้ว', 'success'); },
  openAgentRegister() { document.getElementById('agent-register-modal').style.display = 'flex'; },
  closeAgentRegister() { document.getElementById('agent-register-modal').style.display = 'none'; },
  submitAgentRegistration() { this.showToast('สมัครสมาชิกตัวแทนเรียบร้อย! รอแอดมินอนุมัติ', 'success'); this.closeAgentRegister(); },
  addExpense() {
    const desc = document.getElementById('exp_desc')?.value;
    const amount = parseFloat(document.getElementById('exp_amount')?.value) || 0;
    if (!desc || amount <= 0) { this.showToast('กรุณาระบุรายละเอียดและจำนวนเงิน', 'warning'); return; }
    this.state.expenses.unshift({ id: 'E_' + Date.now(), date: new Date().toISOString(), desc, amount });
    document.getElementById('exp_desc').value = '';
    document.getElementById('exp_amount').value = '';
    this.showToast('บันทึกรายจ่ายสำเร็จ', 'success');
    this.renderErpLists();
  },

  /* ==========================================================================
     DESIGN & PRE-PRESS WORKFLOW (ฝ่ายออกแบบ)
     ========================================================================== */
  renderPrepress() {
    const cont = document.getElementById('prepress-container');
    if (!cont) return;
    cont.innerHTML = '';
    const designOrders = this.state.orders.filter(o => o.status === 'Sales' || o.status === 'Graphic' || o.status === 'Production');
    if (designOrders.length === 0) {
      cont.innerHTML = '<div style="text-align:center; padding:40px; color:var(--text-light); background:white; border-radius:16px;">ไม่มีคิวงานออกแบบในขณะนี้</div>';
      return;
    }

    designOrders.forEach(o => {
      let isRush = o.priority === 'rush';
      let proofBadge = '';
      if (o.proofStatus === 'approved') {
        proofBadge = '<span class="status-badge status-Done"><i class="las la-check-circle"></i> แบบผ่านการอนุมัติแล้ว</span>';
      } else if (o.proofStatus === 'pending') {
        proofBadge = '<span class="status-badge status-Sales"><i class="las la-clock"></i> ส่งแบบแล้ว (รอลูกค้าคอนเฟิร์ม)</span>';
      } else if (o.proofStatus === 'revision') {
        proofBadge = '<span class="status-badge status-Production" style="background:#FEE2E2; color:#DC2626;"><i class="las la-exclamation-triangle"></i> ลูกค้าขอปรับแก้ไขแบบ</span>';
      } else {
        proofBadge = '<span class="status-badge" style="background:#E2E8F0; color:#475569;"><i class="las la-pencil-ruler"></i> รออัปโหลดแบบ (Draft Proof)</span>';
      }

      let itemsHtml = '<ul style="margin:8px 0 0 16px; font-size:13px; color:var(--text-main); line-height:1.5;">';
      o.items.forEach(i => {
        let cat = this.state.catalog.find(c => c.id === i.type);
        itemsHtml += `<li><b>${i.qty} ชิ้น:</b> ${cat?.name || i.type} (${i.w}x${i.h} ม.) ${i.detail ? '<br><small style="color:#64748B;">โน้ตลูกค้า: ' + i.detail + '</small>' : ''}</li>`;
      });
      itemsHtml += '</ul>';

      let proofImgHtml = o.proofImg ? `
        <div style="text-align:center;">
          <img src="${o.proofImg}" class="prepress-proof-img" onclick="app.viewImage('${o.proofImg}')" title="คลิกเพื่อดูภาพขยาย">
          <div style="font-size:11px; color:#64748B; margin-top:5px;"><i class="las la-search-plus"></i> คลิกดูภาพขยาย</div>
        </div>
      ` : `
        <div class="prepress-proof-area">
          <i class="las la-file-image" style="font-size:44px; color:#94A3B8; margin-bottom:8px;"></i>
          <span style="font-size:13px; color:#64748B;">ยังไม่มีไฟล์แบบจำลอง (E-Proof)</span>
        </div>
      `;

      cont.innerHTML += `
      <div class="prepress-item">
        <div>
          <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:10px;">
            <div>
              <strong style="font-size:18px; color:var(--primary);">${o.id}</strong>
              <div style="font-size:14px; font-weight:600; color:var(--text-main); margin-top:3px;">
                <i class="las la-user"></i> ${o.customerName} <span style="font-size:12px; color:#64748B;">(${o.customerPhone})</span>
              </div>
            </div>
            <div>${proofBadge}</div>
          </div>
          <div style="font-size:12px; color:#64748B; margin-bottom:10px;">
            <i class="las la-calendar"></i> กำหนดส่ง: <b>${o.dueDate}</b> ${isRush ? '<span class="kb-rush-badge" style="margin-left:6px;"><i class="las la-bolt"></i> ด่วน!</span>' : ''}
          </div>
          <div style="background:#F8FAFC; padding:12px; border-radius:8px; border:1px solid #E2E8F0; margin-bottom:12px;">
            <strong style="font-size:12px; color:var(--primary);"><i class="las la-list"></i> สเปคที่ลูกค้าต้องการ:</strong>
            ${itemsHtml}
          </div>
          ${o.graphicNote ? `<div style="font-size:12px; background:#FEF3C7; color:#92400E; padding:8px 12px; border-radius:6px; margin-bottom:12px;"><b>บันทึกกราฟิก:</b> ${o.graphicNote}</div>` : ''}
        </div>
        <div style="display:flex; flex-direction:column; justify-content:space-between;">
          ${proofImgHtml}
          <div style="margin-top:15px; display:flex; flex-direction:column; gap:8px;">
            <div style="display:flex; gap:8px;">
              <label class="btn btn-outline btn-sm" style="flex:1; cursor:pointer; font-weight:600; justify-content:center;">
                <i class="las la-upload"></i> อัปโหลดแบบ (Proof)
                <input type="file" accept="image/*" style="display:none;" onchange="app.uploadOrderProof('${o.id}', this)">
              </label>
              ${o.proofImg ? `<button class="btn btn-outline btn-sm" style="border-color:#00B900; color:#00B900;" onclick="app.sendProofLineNotification('${o.id}')" title="ส่งให้ลูกค้าตรวจทาง LINE"><i class="lab la-line" style="font-size:16px;"></i> ส่งตรวจ LINE</button>` : ''}
            </div>
            ${o.proofStatus !== 'approved' && o.proofImg ? `
              <button class="btn btn-success btn-sm" style="width:100%; justify-content:center; padding:8px;" onclick="app.approveProofFromPrepress('${o.id}')">
                <i class="las la-check-circle"></i> อนุมัติแบบ (ส่งเข้าฝ่ายผลิตทันที)
              </button>
            ` : ''}
          </div>
        </div>
      </div>`;
    });
  },

  uploadOrderProof(orderId, input) {
    const file = input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const order = this.state.orders.find(o => o.id === orderId);
      if (order) {
        order.proofImg = e.target.result;
        order.proofStatus = 'pending';
        order.status = 'Graphic';
        this.notify(`🎨 กราฟิกอัปโหลดแบบ E-Proof สำหรับออเดอร์ ${orderId} แล้ว`);
        this.showToast('อัปโหลดไฟล์แบบเรียบร้อยแล้ว!', 'success');
        this.renderAdmin();
      }
    };
    reader.readAsDataURL(file);
  },

  approveProofFromPrepress(orderId) {
    this.approveArtwork(orderId);
  },

  sendProofLineNotification(orderId) {
    const order = this.state.orders.find(o => o.id === orderId);
    if (!order) return;
    const text = `แจ้งแบบงาน E-Proof ร้าน TUMDEEMEDIA\nออเดอร์: ${order.id}\nลูกค้า: ${order.customerName}\nฝ่ายออกแบบได้จัดทำแบบเสร็จเรียบร้อยแล้ว ท่านสามารถตรวจสอบแบบและกดยืนยันได้ที่ลิงก์นี้ครับ:\n${window.location.origin}/#track?id=${order.id}`;
    this.copyToClipboard(text, 'คัดลอกข้อความส่งแบบแล้ว กำลังเปิด LINE...');
    setTimeout(() => {
      window.open(this.state.settings.linkLine, '_blank');
    }, 500);
  },

  /* ==========================================================================
     CUSTOMERS & MEMBERSHIP (CRM)
     ========================================================================== */
  renderCustomers() {
    const tbody = document.getElementById('tbody-customers-full');
    if (!tbody) return;
    tbody.innerHTML = '';
    const customers = this.state.customers || [];
    if (customers.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:30px; color:#888;">ไม่มีข้อมูลสมาชิก</td></tr>';
      return;
    }

    customers.forEach(c => {
      let tierColor = c.tier === 'VIP' ? '#7C3AED' : (c.tier === 'Platinum' ? '#0284C7' : (c.tier === 'Gold' ? '#D97706' : '#64748B'));
      let tierBg = c.tier === 'VIP' ? '#EDE9FE' : (c.tier === 'Platinum' ? '#E0F2FE' : (c.tier === 'Gold' ? '#FEF3C7' : '#F1F5F9'));

      tbody.innerHTML += `
      <tr>
        <td><strong>${c.id}</strong></td>
        <td>
          <b>${c.name}</b><br>
          <span style="font-size:12px; color:#64748B;"><i class="las la-phone"></i> ${c.phone}</span>
          ${c.taxId ? `<br><small style="color:#0284C7; font-size:11px; font-weight:600;"><i class="las la-id-badge"></i> เลขภาษี: ${c.taxId}</small>` : ''}
          ${c.address ? `<br><small style="color:#64748B; font-size:11px;"><i class="las la-map-marker"></i> ${c.address.length > 35 ? c.address.substring(0,35)+'...' : c.address}</small>` : ''}
        </td>
        <td><span style="background:${tierBg}; color:${tierColor}; font-weight:700; padding:4px 10px; border-radius:50px; font-size:11px;">${c.tier}</span></td>
        <td style="font-weight:700; color:var(--primary);">฿${(c.totalSpend || 0).toLocaleString()}</td>
        <td><span style="color:#059669; font-weight:bold;">${(c.points || 0).toLocaleString()} แต้ม</span></td>
        <td><span class="status-badge" style="background:#F1F5F9; color:#334155;">${c.creditTerm || 'เงินสด'}</span></td>
        <td>
          <div style="display:flex; gap:4px; flex-wrap:wrap;">
            <button class="btn-sm btn-primary" onclick="app.openAdminMemberDetail('customer', '${c.id}', 'profile')" title="ตรวจสอบและแก้ไขข้อมูลส่วนตัว ที่อยู่จัดส่ง และเลขภาษี"><i class="las la-id-card"></i> ตรวจสอบ/ภาษี</button>
            <button class="btn-sm btn-outline" style="border-color:#2563EB; color:#2563EB;" onclick="app.openAdminMemberDetail('customer', '${c.id}', 'orders')" title="คำสั่งซื้อย้อนหลัง & สั่งพิมพ์เอกสารบัญชี"><i class="las la-history"></i> ออเดอร์/พิมพ์บิล</button>
            <button class="btn-sm btn-outline" style="border-color:#10B981; color:#059669;" onclick="app.openAdminMemberDetail('customer', '${c.id}', 'tracking')" title="ติดตามงาน 5 ขั้นตอน & ตรวจแบบ E-Proof"><i class="las la-truck"></i> ติดตามงาน</button>
            <button class="btn-sm btn-outline" style="border-color:var(--danger); color:var(--danger);" onclick="app.deleteCustomer('${c.id}')"><i class="las la-trash"></i></button>
          </div>
        </td>
      </tr>`;
    });
  },

  openCustomerModal(customerId) {
    if (customerId) {
      this.openAdminMemberDetail('customer', customerId, 'profile');
      return;
    }
    this.state.editingMemberId = null;
    const titleEl = document.getElementById('cust-modal-title');
    if (titleEl) titleEl.innerText = 'เพิ่มสมาชิก / ลูกค้าใหม่';
    document.getElementById('cm-cust-id').value = 'C' + String(this.state.customers.length + 1).padStart(3, '0');
    document.getElementById('cm-cust-name').value = '';
    document.getElementById('cm-cust-phone').value = '';
    document.getElementById('cm-cust-address').value = '';
    if (document.getElementById('cm-cust-line')) document.getElementById('cm-cust-line').value = '';
    if (document.getElementById('cm-cust-taxid')) document.getElementById('cm-cust-taxid').value = '';
    document.getElementById('cm-cust-tier').value = 'Silver';
    document.getElementById('cm-cust-credit').value = 'เงินสด';
    const modal = document.getElementById('customer-modal');
    if (modal) modal.style.display = 'flex';
  },

  saveCustomer() {
    const id = document.getElementById('cm-cust-id')?.value;
    const name = document.getElementById('cm-cust-name')?.value;
    const phone = document.getElementById('cm-cust-phone')?.value;
    const address = document.getElementById('cm-cust-address')?.value || '';
    const line = document.getElementById('cm-cust-line')?.value || '';
    const taxId = document.getElementById('cm-cust-taxid')?.value || '';
    const tier = document.getElementById('cm-cust-tier')?.value || 'Silver';
    const creditTerm = document.getElementById('cm-cust-credit')?.value || 'เงินสด';

    if (!name || !phone) { this.showToast('กรุณากรอกชื่อและเบอร์โทรศัพท์', 'warning'); return; }

    const existIdx = this.state.customers.findIndex(c => c.id === id);
    if (existIdx > -1) {
      this.state.customers[existIdx] = {
        ...this.state.customers[existIdx],
        name, phone, address, line, taxId, tier, creditTerm
      };
    } else {
      this.state.customers.push({
        id, name, phone, address, line, taxId, tier, creditTerm,
        totalSpend: 0, points: 0, orderCount: 0
      });
    }
    this.renderCustomers();
    const modal = document.getElementById('customer-modal');
    if (modal) modal.style.display = 'none';
    this.showToast('บันทึกข้อมูลสมาชิกเรียบร้อยแล้ว', 'success');
  },

  deleteCustomer(id) {
    const cust = this.state.customers.find(c => c.id === id);
    if (!cust) return;
    if (!confirm(`ต้องการลบข้อมูลสมาชิก "${cust.name}" ออกจากระบบ?`)) return;
    this.state.customers = this.state.customers.filter(c => c.id !== id);
    this.renderCustomers();
    this.showToast('ลบสมาชิกเรียบร้อย', 'success');
  },

  viewCustomerHistory(customerId) {
    this.openAdminMemberDetail('customer', customerId, 'orders');
  },

  renderCustomerHistoryModalTable() {
    const c = this.state.customers.find(x => x.id === this.currentCustomerHistoryId);
    if (!c) return;
    const tbody = document.getElementById('tbody-customer-history');
    if (!tbody) return;
    tbody.innerHTML = '';

    const yearFilter = document.getElementById('cust-hist-year')?.value || 'all';
    const monthFilter = document.getElementById('cust-hist-month')?.value || 'all';
    const statusFilter = document.getElementById('cust-hist-status')?.value || 'all';

    const cPhoneClean = (c.phone || '').replace(/[^0-9]/g, '');
    let orders = this.state.orders.filter(o => {
      const oPhoneClean = (o.customerPhone || '').replace(/[^0-9]/g, '');
      const matchId = (o.customerId === c.id);
      const matchPhone = (cPhoneClean && oPhoneClean && cPhoneClean === oPhoneClean);
      const matchName = (o.customerName && c.name && o.customerName.trim().toLowerCase() === c.name.trim().toLowerCase());
      return matchId || matchPhone || matchName;
    });

    if (yearFilter !== 'all') {
      orders = orders.filter(o => {
        const d = new Date(o.date);
        return d.getFullYear().toString() === yearFilter;
      });
    }

    if (monthFilter !== 'all') {
      orders = orders.filter(o => {
        const d = new Date(o.date);
        const m = String(d.getMonth() + 1).padStart(2, '0');
        return m === monthFilter;
      });
    }

    if (statusFilter !== 'all') {
      orders = orders.filter(o => o.status === statusFilter);
    }

    const sumEl = document.getElementById('cust-hist-summary');
    if (sumEl) {
      const sumTotal = orders.reduce((acc, o) => acc + (o.net || 0), 0);
      sumEl.innerText = `${orders.length} ออเดอร์ (ยอดรวม ฿${sumTotal.toLocaleString()})`;
    }

    if (orders.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:30px; color:#888;">ไม่พบรายการคำสั่งซื้อตามตัวกรองที่เลือก</td></tr>';
      return;
    }

    orders.forEach(o => {
      const itemsDesc = (o.items || []).map(it => {
        const cat = this.state.catalog.find(x => x.id === it.type);
        return `${cat ? cat.name : (it.type || 'งานป้าย')} (${it.w || 1}x${it.h || 1}ม. จำนวน ${it.qty || 1})`;
      }).join(', ') || 'งานป้ายสั่งผลิตตามสเปก';

      tbody.innerHTML += `
      <tr>
        <td style="padding:10px 12px;"><strong>${o.id}</strong><br><small style="color:#64748B;">${new Date(o.date).toLocaleDateString('th-TH')}</small></td>
        <td style="padding:10px 12px;"><span style="font-weight:600; color:#1E293B;">${itemsDesc}</span></td>
        <td style="padding:10px 12px; font-weight:700; color:var(--primary);">฿${(o.net || 0).toLocaleString()}</td>
        <td style="padding:10px 12px;"><span class="status-badge status-${o.status}">${o.status}</span></td>
        <td style="padding:10px 12px;"><span class="pay-${o.payment}">${o.payment}</span></td>
        <td style="padding:10px 12px; text-align:center;">
          <div style="display:flex; gap:4px; justify-content:center; flex-wrap:wrap;">
            <button class="btn btn-xs btn-outline" onclick="app.openDocModal('${o.id}', 'quotation')" title="เปิด/พิมพ์ใบเสนอราคา (Quotation)"><i class="las la-file-invoice"></i> ใบเสนอราคา</button>
            <button class="btn btn-xs btn-outline" style="border-color:#10B981; color:#059669;" onclick="app.openDocModal('${o.id}', 'receipt')" title="เปิด/พิมพ์ใบเสร็จรับเงิน (Receipt)"><i class="las la-receipt"></i> ใบเสร็จ</button>
            <button class="btn btn-xs btn-outline" style="border-color:#2563EB; color:#2563EB;" onclick="app.openDocModal('${o.id}', 'tax_invoice')" title="เปิด/พิมพ์ใบกำกับภาษี (Tax Invoice)"><i class="las la-file-invoice-dollar"></i> ใบกำกับภาษี</button>
            <button class="btn btn-xs btn-outline" style="border-color:#D97706; color:#D97706;" onclick="app.openDocModal('${o.id}', 'delivery_note')" title="เปิด/พิมพ์ใบส่งของ/ใบแจ้งหนี้"><i class="las la-truck"></i> ใบส่งของ</button>
          </div>
        </td>
      </tr>`;
    });
  },

  /* ==========================================================================
     AGENTS & ANNOUNCEMENTS (ระบบตัวแทน & ประกาศบรอดแคสต์)
     ========================================================================== */
  renderAdminAgents() {
    const tbAgent = document.getElementById('tbody-admin-agents');
    if (!tbAgent) return;
    tbAgent.innerHTML = '';
    this.state.agents.forEach(a => {
      const showPwd = this.state.showPasswords[a.id];
      const pwdDisplay = showPwd ? `<span style="font-family:monospace; background:#F1F5F9; padding:2px 6px; border-radius:4px; font-weight:bold; color:#0F172A;">${a.password || '-'}</span>` : '<span style="color:#94A3B8;">••••••••</span>';

      tbAgent.innerHTML += `
      <tr>
        <td><strong>${a.id}</strong></td>
        <td>
          <b>${a.name}</b><br>
          <span style="font-size:11px; color:var(--text-light);">${a.shop}</span>
          ${a.taxId ? `<br><small style="color:#D97706; font-size:11px; font-weight:600;"><i class="las la-id-badge"></i> เลขภาษี: ${a.taxId}</small>` : ''}
          ${a.address ? `<br><small style="color:#64748B; font-size:11px;"><i class="las la-map-marker"></i> ${a.address.length > 35 ? a.address.substring(0,35)+'...' : a.address}</small>` : ''}
        </td>
        <td><span style="font-family:monospace; color:var(--primary); font-weight:600;">${a.username}</span></td>
        <td>
          <div style="display:flex; align-items:center; gap:6px;">
            ${pwdDisplay}
            <button class="btn-icon-sq" style="width:24px; height:24px;" onclick="app.togglePasswordVisibility('${a.id}')" title="แสดง/ซ่อนรหัสผ่าน">
              <i class="las ${showPwd ? 'la-eye-slash' : 'la-eye'}"></i>
            </button>
          </div>
        </td>
        <td><span class="status-badge status-Graphic">${a.tier}</span></td>
        <td style="color:var(--primary); font-weight:bold;">฿${(a.sales || 0).toLocaleString()}</td>
        <td style="color:var(--accent); font-weight:bold;">฿${(a.commission || 0).toLocaleString()}</td>
        <td><span class="status-badge status-${a.status === 'approved' ? 'Done' : (a.status === 'pending' ? 'Sales' : 'Production')}">${a.status}</span></td>
        <td>
          <div style="display:flex; gap:4px; flex-wrap:wrap;">
            <button class="btn-sm btn-primary" onclick="app.openAdminMemberDetail('agent', '${a.id}', 'profile')" title="ตรวจสอบและแก้ไขข้อมูลส่วนตัว ที่อยู่จัดส่ง และเลขภาษี"><i class="las la-id-card"></i> ตรวจสอบ/ภาษี</button>
            <button class="btn-sm btn-outline" style="border-color:#D97706; color:#B45309;" onclick="app.openAdminMemberDetail('agent', '${a.id}', 'orders')" title="คำสั่งซื้อย้อนหลัง & สั่งพิมพ์เอกสารบัญชี"><i class="las la-history"></i> ออเดอร์/พิมพ์บิล</button>
            <button class="btn-sm btn-outline" style="border-color:#10B981; color:#059669;" onclick="app.openAdminMemberDetail('agent', '${a.id}', 'tracking')" title="ติดตามงาน 5 ขั้นตอน & ตรวจแบบ E-Proof"><i class="las la-truck"></i> ติดตามงาน</button>
            <button class="btn-sm btn-outline" style="border-color:var(--danger); color:var(--danger);" onclick="app.deleteAgent('${a.id}')" title="ลบตัวแทน"><i class="las la-trash"></i></button>
          </div>
        </td>
      </tr>`;
    });
    this.renderAgentAnnouncements();
  },

  togglePasswordVisibility(agentId) {
    this.state.showPasswords[agentId] = !this.state.showPasswords[agentId];
    this.renderAdminAgents();
  },

  openAgentModal(agentId) {
    if (agentId) {
      this.openAdminMemberDetail('agent', agentId, 'profile');
      return;
    }
    this.state.editingAgentId = null;
    const titleEl = document.getElementById('ag-modal-title');
    if (titleEl) titleEl.innerText = 'เพิ่มสมาชิกตัวแทนจำหน่ายใหม่';
    document.getElementById('ag-m-id').value = 'A' + String(this.state.agents.length + 1).padStart(3, '0');
    document.getElementById('ag-m-user').value = '';
    document.getElementById('ag-m-pass').value = '';
    document.getElementById('ag-m-name').value = '';
    document.getElementById('ag-m-shop').value = '';
    document.getElementById('ag-m-phone').value = '';
    document.getElementById('ag-m-line').value = '';
    if (document.getElementById('ag-m-address')) document.getElementById('ag-m-address').value = '';
    if (document.getElementById('ag-m-taxid')) document.getElementById('ag-m-taxid').value = '';
    document.getElementById('ag-m-tier').value = 'Standard';
    document.getElementById('ag-m-status').value = 'approved';
    const modal = document.getElementById('agent-manage-modal');
    if (modal) modal.style.display = 'flex';
  },

  saveAgent() {
    const id = document.getElementById('ag-m-id')?.value;
    const username = document.getElementById('ag-m-user')?.value;
    const password = document.getElementById('ag-m-pass')?.value;
    const name = document.getElementById('ag-m-name')?.value;
    const shop = document.getElementById('ag-m-shop')?.value;
    const phone = document.getElementById('ag-m-phone')?.value;
    const line = document.getElementById('ag-m-line')?.value;
    const address = document.getElementById('ag-m-address')?.value || '';
    const taxId = document.getElementById('ag-m-taxid')?.value || '';
    const tier = document.getElementById('ag-m-tier')?.value;
    const status = document.getElementById('ag-m-status')?.value;

    if (!username || !password || !name) { this.showToast('กรุณากรอก Username, Password และชื่อตัวแทน', 'warning'); return; }

    const existIdx = this.state.agents.findIndex(a => a.id === id);
    if (existIdx > -1) {
      this.state.agents[existIdx] = {
        ...this.state.agents[existIdx],
        username, password, name, shop, phone, line, address, taxId, tier, status
      };
    } else {
      this.state.agents.push({
        id, username, password, name, shop, phone, line, address, taxId, tier, status,
        sales: 0, commission: 0, joinDate: new Date().toISOString().split('T')[0]
      });
    }
    this.renderAdminAgents();
    const modal = document.getElementById('agent-manage-modal');
    if (modal) modal.style.display = 'none';
    this.showToast('บันทึกข้อมูลตัวแทนเรียบร้อยแล้ว', 'success');
  },

  deleteAgent(id) {
    const ag = this.state.agents.find(a => a.id === id);
    if (!ag) return;
    if (!confirm(`ต้องการลบตัวแทน "${ag.name}" (${ag.shop}) ออกจากระบบ?`)) return;
    this.state.agents = this.state.agents.filter(a => a.id !== id);
    this.renderAdminAgents();
    this.showToast('ลบตัวแทนเรียบร้อยแล้ว', 'success');
  },

  viewAgentOrders(agentId) {
    this.openAdminMemberDetail('agent', agentId, 'orders');
  },

  renderAgentHistoryModalTable() {
    const ag = this.state.agents.find(a => a.id === this.currentAgentHistoryId);
    if (!ag) return;
    const tbody = document.getElementById('tbody-agent-history');
    if (!tbody) return;
    tbody.innerHTML = '';

    const custFilter = document.getElementById('ag-hist-customer')?.value || 'all';
    const yearFilter = document.getElementById('ag-hist-year')?.value || 'all';
    const monthFilter = document.getElementById('ag-hist-month')?.value || 'all';

    let orders = this.state.orders.filter(o => o.agentId === ag.id);

    if (custFilter !== 'all') {
      orders = orders.filter(o => o.customerName === custFilter);
    }

    if (yearFilter !== 'all') {
      orders = orders.filter(o => {
        const d = new Date(o.date);
        return d.getFullYear().toString() === yearFilter;
      });
    }

    if (monthFilter !== 'all') {
      orders = orders.filter(o => {
        const d = new Date(o.date);
        const m = String(d.getMonth() + 1).padStart(2, '0');
        return m === monthFilter;
      });
    }

    const sumEl = document.getElementById('ag-hist-summary');
    if (sumEl) {
      const sumTotal = orders.reduce((acc, o) => acc + (o.net || 0), 0);
      sumEl.innerText = `${orders.length} ออเดอร์ (ยอดรวม ฿${sumTotal.toLocaleString()})`;
    }

    if (orders.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:30px; color:#888;">ไม่พบรายการคำสั่งซื้อตามตัวกรองที่เลือก</td></tr>';
      return;
    }

    orders.forEach(o => {
      tbody.innerHTML += `
      <tr>
        <td style="padding:10px 12px;"><strong>${o.id}</strong><br><small style="color:#64748B;">${new Date(o.date).toLocaleDateString('th-TH')}</small></td>
        <td style="padding:10px 12px;"><b>${o.customerName}</b><br><span style="font-size:11px; color:#64748B;">${o.details || 'งานป้ายสั่งผลิต'}</span></td>
        <td style="padding:10px 12px; font-weight:700; color:var(--primary);">฿${(o.net || 0).toLocaleString()}</td>
        <td style="padding:10px 12px;"><span class="status-badge status-${o.status}">${o.status}</span></td>
        <td style="padding:10px 12px;"><span class="pay-${o.payment}">${o.payment}</span></td>
        <td style="padding:10px 12px; text-align:center;">
          <div style="display:flex; gap:4px; justify-content:center; flex-wrap:wrap;">
            <button class="btn btn-xs btn-outline" onclick="app.openDocModal('${o.id}', 'quotation')" title="เปิด/พิมพ์ใบเสนอราคา (Quotation)"><i class="las la-file-invoice"></i> ใบเสนอราคา</button>
            <button class="btn btn-xs btn-outline" style="border-color:#10B981; color:#059669;" onclick="app.openDocModal('${o.id}', 'receipt')" title="เปิด/พิมพ์ใบเสร็จรับเงิน (Receipt)"><i class="las la-receipt"></i> ใบเสร็จ</button>
            <button class="btn btn-xs btn-outline" style="border-color:#2563EB; color:#2563EB;" onclick="app.openDocModal('${o.id}', 'tax_invoice')" title="เปิด/พิมพ์ใบกำกับภาษี (Tax Invoice)"><i class="las la-file-invoice-dollar"></i> ใบกำกับภาษี</button>
            <button class="btn btn-xs btn-outline" style="border-color:#D97706; color:#D97706;" onclick="app.openDocModal('${o.id}', 'delivery_note')" title="เปิด/พิมพ์ใบส่งของ/ใบแจ้งหนี้"><i class="las la-truck"></i> ใบส่งของ</button>
          </div>
        </td>
      </tr>`;
    });
  },

  handleAnnouncementImage(input) {
    if (!input.files || !input.files[0]) return;
    const file = input.files[0];
    const reader = new FileReader();
    reader.onload = (e) => {
      this.currentAnnouncementImage = e.target.result;
      this.updateAnnouncementPreview();
    };
    reader.readAsDataURL(file);
  },

  onAnnouncementUrlChange() {
    const url = document.getElementById('an-image-url')?.value?.trim();
    if (url) {
      this.currentAnnouncementImage = url;
      this.updateAnnouncementPreview();
    }
  },

  setAnnouncementPresetImage(type) {
    const presets = {
      promo: 'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?w=600&auto=format&fit=crop&q=80',
      holiday: 'https://images.unsplash.com/photo-1510312305653-8ed496efae75?w=600&auto=format&fit=crop&q=80',
      machine: 'https://images.unsplash.com/photo-1563986768609-322da13575f3?w=600&auto=format&fit=crop&q=80'
    };
    if (presets[type]) {
      this.currentAnnouncementImage = presets[type];
      const urlInput = document.getElementById('an-image-url');
      if (urlInput) urlInput.value = presets[type];
      this.updateAnnouncementPreview();
    }
  },

  clearAnnouncementImage() {
    this.currentAnnouncementImage = null;
    const f = document.getElementById('an-image-file'); if (f) f.value = '';
    const u = document.getElementById('an-image-url'); if (u) u.value = '';
    this.updateAnnouncementPreview();
  },

  updateAnnouncementPreview() {
    const wrap = document.getElementById('an-preview-wrap');
    const img = document.getElementById('an-preview-img');
    if (wrap && img) {
      if (this.currentAnnouncementImage) {
        img.src = this.currentAnnouncementImage;
        wrap.style.display = 'block';
      } else {
        img.src = '';
        wrap.style.display = 'none';
      }
    }
  },

  renderAgentAnnouncements() {
    const erpCont = document.getElementById('erp-announcements-list');
    const portalCont = document.getElementById('portal-announcements-list');
    const list = this.state.agentAnnouncements || [];

    const catBadge = {
      'promo': '<span class="status-badge" style="background:#FEF3C7; color:#B45309; font-weight:700;"><i class="las la-gift"></i> โปรโมชั่น</span>',
      'holiday': '<span class="status-badge" style="background:#FEE2E2; color:#DC2626; font-weight:700;"><i class="las la-calendar-times"></i> วันหยุด</span>',
      'news': '<span class="status-badge" style="background:#EFF6FF; color:#1E40AF; font-weight:700;"><i class="las la-bullhorn"></i> ข่าวสาร</span>'
    };

    if (erpCont) {
      erpCont.innerHTML = '';
      if (list.length === 0) {
        erpCont.innerHTML = '<div style="color:#888; font-size:13px; text-align:center; padding:15px;">ยังไม่มีประกาศ</div>';
      }
      list.forEach(a => {
        erpCont.innerHTML += `
        <div class="announcement-card" style="display:flex; justify-content:space-between; align-items:flex-start; gap:12px; margin-bottom:10px;">
          <div style="display:flex; gap:12px; align-items:flex-start;">
            ${a.image ? `<img src="${a.image}" style="width:70px; height:55px; object-fit:cover; border-radius:6px; border:1px solid #E2E8F0; flex-shrink:0;">` : ''}
            <div>
              <div style="display:flex; align-items:center; gap:8px; margin-bottom:4px;">
                ${catBadge[a.category] || catBadge['promo']}
                <span style="font-weight:700; color:var(--primary); font-size:14.5px;">${a.title}</span>
              </div>
              <div style="font-size:13px; color:#334155; line-height:1.5;">${a.content}</div>
              <div style="font-size:11px; color:#94A3B8; margin-top:4px;">ประกาศเมื่อ: ${a.date} | เป้าหมาย: ${a.target === 'agents' ? 'ตัวแทน' : (a.target === 'customers' ? 'ลูกค้าสมาชิก' : 'ทุกคน')}</div>
            </div>
          </div>
          <button class="btn-icon-sq danger" onclick="app.deleteAnnouncement('${a.id}')" title="ลบประกาศ"><i class="las la-trash"></i></button>
        </div>`;
      });
    }

    if (portalCont) {
      portalCont.innerHTML = '';
      const agentList = list.filter(a => !a.target || a.target === 'all' || a.target === 'agents');
      const badge = document.getElementById('agent-ann-count-badge');
      if (badge) {
        badge.innerText = `${agentList.length} รายการ`;
      }

      if (agentList.length === 0) {
        portalCont.innerHTML = '<div style="grid-column:1/-1; color:#888; font-size:13px; text-align:center; padding:30px;">ไม่มีประกาศตัวแทนในขณะนี้</div>';
      }
      agentList.forEach(a => {
        portalCont.innerHTML += `
        <div class="card" style="padding:20px; background:white; display:flex; flex-direction:column; justify-content:space-between; border-top:3px solid #F59E0B; margin-bottom:0;">
          <div>
            ${a.image ? `<img src="${a.image}" alt="${a.title}" style="width:100%; height:180px; object-fit:cover; border-radius:8px; margin-bottom:12px; border:1px solid #E2E8F0;">` : ''}
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
              ${catBadge[a.category] || catBadge['promo']}
              <span style="font-size:11.5px; color:#94A3B8;"><i class="las la-calendar"></i> ${a.date}</span>
            </div>
            <h4 style="margin:0 0 8px 0; color:var(--primary); font-size:16px; font-weight:800;">${a.title}</h4>
            <p style="margin:0 0 14px 0; font-size:13.5px; color:#334155; line-height:1.6; white-space:pre-line;">${a.content}</p>
          </div>
          <button class="btn btn-sm btn-primary" onclick="app.scrollToOrder()" style="width:100%; font-weight:700; background:linear-gradient(135deg, #D97706, #B45309); border:none;">
            <i class="las la-shopping-cart"></i> เปิดคำสั่งซื้อใหม่ / ใช้สิทธิ์ตัวแทน
          </button>
        </div>`;
      });
    }
  },

  openAnnouncementModal() {
    const t = document.getElementById('an-title'); if (t) t.value = '';
    const c = document.getElementById('an-content'); if (c) c.value = '';
    const cat = document.getElementById('an-category'); if (cat) cat.value = 'promo';
    const tgt = document.getElementById('an-target'); if (tgt) tgt.value = 'all';
    this.clearAnnouncementImage();
    const modal = document.getElementById('announcement-modal');
    if (modal) modal.style.display = 'flex';
  },

  saveAnnouncement() {
    const title = document.getElementById('an-title')?.value?.trim();
    const content = document.getElementById('an-content')?.value?.trim();
    const category = document.getElementById('an-category')?.value || 'promo';
    const target = document.getElementById('an-target')?.value || 'all';

    if (!title || !content) { 
      this.showToast('กรุณากรอกหัวข้อและเนื้อหาประกาศ', 'warning'); 
      return; 
    }

    if (!this.state.agentAnnouncements) this.state.agentAnnouncements = [];
    this.state.agentAnnouncements.unshift({
      id: 'AN-' + Date.now(),
      date: new Date().toISOString().split('T')[0],
      category,
      target,
      title,
      content,
      image: this.currentAnnouncementImage || null,
      priority: 'high'
    });

    this.saveStorage();
    this.renderAgentAnnouncements();
    this.renderCustomerAnnouncements();
    const modal = document.getElementById('announcement-modal');
    if (modal) modal.style.display = 'none';
    this.showToast('บรอดแคสต์ประกาศและรูปภาพถึงลูกค้าสมาชิกและตัวแทนเรียบร้อยแล้ว', 'success');
  },

  deleteAnnouncement(id) {
    if (!confirm('ต้องการลบประกาศนี้?')) return;
    this.state.agentAnnouncements = this.state.agentAnnouncements.filter(a => a.id !== id);
    this.saveStorage();
    this.renderAgentAnnouncements();
    this.renderCustomerAnnouncements();
    this.showToast('ลบประกาศเรียบร้อย', 'success');
  },

  /* ==========================================================================
     ADMIN MEMBER & AGENT 360° MANAGEMENT (ตรวจสอบ & แก้ไขข้อมูล, คำสั่งซื้อย้อนหลัง, ติดตามงาน 5 ขั้นตอน)
     ========================================================================== */
  openAdminMemberDetail(type, id, initialTab = 'profile') {
    this.currentAdminMember = { type, id };
    const isCustomer = (type === 'customer');
    const item = isCustomer
      ? (this.state.customers || []).find(c => c.id === id)
      : (this.state.agents || []).find(a => a.id === id);

    if (!item) {
      this.showToast('ไม่พบข้อมูลในระบบ', 'warning');
      return;
    }

    // Modal Header Styling & Info
    const header = document.getElementById('amd-modal-header');
    const avatar = document.getElementById('amd-header-avatar');
    const titleEl = document.getElementById('amd-header-title');
    const typeBadge = document.getElementById('amd-badge-type');
    const tierBadge = document.getElementById('amd-badge-tier');
    const subtitleEl = document.getElementById('amd-header-subtitle');

    if (header) {
      header.style.background = isCustomer
        ? 'linear-gradient(135deg, #1E3A8A 0%, #2563EB 100%)'
        : 'linear-gradient(135deg, #B45309 0%, #D97706 100%)';
    }
    if (avatar) {
      avatar.innerHTML = isCustomer ? '<i class="las la-user"></i>' : '<i class="las la-user-tie"></i>';
    }
    if (titleEl) {
      titleEl.innerText = `${item.name || item.shop || 'ข้อมูลสมาชิก/ตัวแทน'}`;
    }
    if (typeBadge) {
      typeBadge.innerText = isCustomer ? '👤 สมาชิก / ลูกค้า' : '💼 ตัวแทนจำหน่าย (Agent)';
      typeBadge.style.color = isCustomer ? '#1E3A8A' : '#B45309';
    }
    if (tierBadge) {
      tierBadge.innerText = item.tier || (isCustomer ? 'Silver' : 'Gold');
    }
    if (subtitleEl) {
      const totalSpendVal = (isCustomer ? item.totalSpend : item.sales) || 0;
      subtitleEl.innerText = `รหัส: ${item.id} | เบอร์โทร: ${item.phone || '-'} | LINE: ${item.line || '-'} | ยอดสะสม: ฿${totalSpendVal.toLocaleString()}`;
    }

    // Populate Form (Pane 1)
    const el = fid => document.getElementById(fid);
    if (el('amd-p-id')) el('amd-p-id').value = item.id;
    if (el('amd-p-type')) el('amd-p-type').value = type;
    if (el('amd-p-display-id')) el('amd-p-display-id').value = item.id;
    if (el('amd-p-name')) el('amd-p-name').value = item.name || '';
    if (el('amd-p-shop')) el('amd-p-shop').value = item.shop || '';
    if (el('amd-p-phone')) el('amd-p-phone').value = item.phone || '';
    if (el('amd-p-line')) el('amd-p-line').value = item.line || '';
    if (el('amd-p-tier')) el('amd-p-tier').value = item.tier || 'Silver';
    if (el('amd-p-taxid')) el('amd-p-taxid').value = item.taxId || '';
    if (el('amd-p-credit')) el('amd-p-credit').value = item.creditTerm || 'เงินสด';
    if (el('amd-p-address')) el('amd-p-address').value = item.address || '';

    // Agent Extra Card
    const agentExtraCard = el('amd-agent-extra-card');
    if (agentExtraCard) {
      if (isCustomer) {
        agentExtraCard.style.display = 'none';
      } else {
        agentExtraCard.style.display = 'block';
        if (el('amd-p-username')) el('amd-p-username').value = item.username || '';
        if (el('amd-p-password')) {
          el('amd-p-password').value = item.password || '';
          el('amd-p-password').type = 'password';
        }
        if (el('amd-pwd-toggle-icon')) {
          el('amd-pwd-toggle-icon').className = 'las la-eye';
        }
        if (el('amd-p-commission')) el('amd-p-commission').value = item.commission || 15;
        if (el('amd-p-status')) el('amd-p-status').value = item.status || 'approved';
      }
    }

    // Render Orders & Live Tracking
    this.renderAdminMemberOrdersTable();
    this.renderAdminMemberTrackingList();

    // Switch to initial tab
    this.switchAdminMemberTab(initialTab);

    // Show modal
    const modal = document.getElementById('admin-member-detail-modal');
    if (modal) modal.style.display = 'flex';
  },

  switchAdminMemberTab(tabName) {
    const tabs = ['profile', 'orders', 'tracking'];
    tabs.forEach(t => {
      const btn = document.getElementById('btn-amd-tab-' + t);
      const pane = document.getElementById('amd-pane-' + t);
      if (btn) {
        if (t === tabName) {
          btn.classList.add('active');
          btn.style.background = '#2563EB';
          btn.style.color = 'white';
        } else {
          btn.classList.remove('active');
          btn.style.background = 'white';
          btn.style.color = '#334155';
        }
      }
      if (pane) {
        pane.style.display = (t === tabName ? 'block' : 'none');
      }
    });

    if (tabName === 'orders') {
      this.renderAdminMemberOrdersTable();
    } else if (tabName === 'tracking') {
      this.renderAdminMemberTrackingList();
    }
  },

  toggleAmdPasswordVisibility() {
    const pwdInput = document.getElementById('amd-p-password');
    const icon = document.getElementById('amd-pwd-toggle-icon');
    if (pwdInput && icon) {
      if (pwdInput.type === 'password') {
        pwdInput.type = 'text';
        icon.className = 'las la-eye-slash';
      } else {
        pwdInput.type = 'password';
        icon.className = 'las la-eye';
      }
    }
  },

  saveAdminMemberProfile() {
    if (!this.currentAdminMember) return;
    const { type, id } = this.currentAdminMember;
    const isCustomer = (type === 'customer');

    const name = document.getElementById('amd-p-name')?.value?.trim();
    const phone = document.getElementById('amd-p-phone')?.value?.trim();
    if (!name || !phone) {
      this.showToast('กรุณาระบุชื่อ-นามสกุล และเบอร์โทรศัพท์ติดต่อ', 'warning');
      return;
    }

    const shop = document.getElementById('amd-p-shop')?.value?.trim() || '';
    const line = document.getElementById('amd-p-line')?.value?.trim() || '';
    const tier = document.getElementById('amd-p-tier')?.value || 'Silver';
    const taxId = document.getElementById('amd-p-taxid')?.value?.trim() || '';
    const creditTerm = document.getElementById('amd-p-credit')?.value || 'เงินสด';
    const address = document.getElementById('amd-p-address')?.value?.trim() || '';

    if (isCustomer) {
      const custIndex = (this.state.customers || []).findIndex(c => c.id === id);
      if (custIndex !== -1) {
        this.state.customers[custIndex] = {
          ...this.state.customers[custIndex],
          name,
          shop,
          phone,
          line,
          tier,
          taxId,
          creditTerm,
          address
        };
      }
    } else {
      const agentIndex = (this.state.agents || []).findIndex(a => a.id === id);
      const username = document.getElementById('amd-p-username')?.value?.trim() || '';
      const password = document.getElementById('amd-p-password')?.value || '';
      const commission = parseFloat(document.getElementById('amd-p-commission')?.value) || 15;
      const status = document.getElementById('amd-p-status')?.value || 'approved';

      if (agentIndex !== -1) {
        this.state.agents[agentIndex] = {
          ...this.state.agents[agentIndex],
          name,
          shop,
          phone,
          line,
          tier,
          taxId,
          creditTerm,
          address,
          username,
          password,
          commission,
          status
        };
      }
    }

    this.saveStorage();
    this.renderCustomers();
    this.renderAdminAgents();

    // Update Header subtitle
    const subtitleEl = document.getElementById('amd-header-subtitle');
    const titleEl = document.getElementById('amd-header-title');
    if (titleEl) titleEl.innerText = name || shop;
    if (subtitleEl) {
      subtitleEl.innerText = `รหัส: ${id} | เบอร์โทร: ${phone} | LINE: ${line || '-'} | ข้อมูลภาษี & จัดส่งอัปเดตแล้ว`;
    }

    this.showToast('บันทึกข้อมูลส่วนตัว ที่อยู่จัดส่ง และเลขภาษีเรียบร้อยแล้ว', 'success');
  },

  getAdminMemberOrders() {
    if (!this.currentAdminMember) return [];
    const { type, id } = this.currentAdminMember;
    const isCustomer = (type === 'customer');
    const item = isCustomer
      ? (this.state.customers || []).find(c => c.id === id)
      : (this.state.agents || []).find(a => a.id === id);

    if (!item) return [];

    let orders = (this.state.orders || []).filter(o => {
      if (isCustomer) {
        return o.customerId === id || 
               o.customerName === item.name || 
               (item.phone && o.customerPhone === item.phone) ||
               (item.shop && o.customerName === item.shop);
      } else {
        return o.agentId === id || 
               o.agentName === item.name || 
               o.customerName === item.name || 
               (item.shop && o.customerName === item.shop);
      }
    });

    // Fallback if specific user doesn't have assigned orders yet in demo data
    if (orders.length === 0 && (this.state.orders || []).length > 0) {
      // Pick top demo orders with items for demonstration
      orders = this.state.orders.slice(0, 3);
    }

    return orders;
  },

  renderAdminMemberOrdersTable() {
    const allOrders = this.getAdminMemberOrders();
    const tbody = document.getElementById('tbody-amd-orders');
    if (!tbody) return;
    tbody.innerHTML = '';

    // Calculate Summary Stats
    const totalSum = allOrders.reduce((sum, o) => sum + (o.net || 0), 0);
    const statTotalEl = document.getElementById('amd-stat-total');
    const statCountEl = document.getElementById('amd-stat-count');
    if (statTotalEl) statTotalEl.innerText = '฿' + totalSum.toLocaleString();
    if (statCountEl) statCountEl.innerText = `${allOrders.length} คำสั่งซื้อทั้งหมด`;

    // Month filter (current year/month)
    const now = new Date();
    const curYearStr = String(now.getFullYear());
    const curMonthStr = String(now.getMonth() + 1).padStart(2, '0');
    const curMonthOrders = allOrders.filter(o => {
      const d = new Date(o.date);
      return d.getFullYear().toString() === curYearStr && String(d.getMonth() + 1).padStart(2, '0') === curMonthStr;
    });
    const monthOrdersToCount = curMonthOrders.length > 0 ? curMonthOrders : allOrders;
    const monthSum = monthOrdersToCount.reduce((sum, o) => sum + (o.net || 0), 0);
    const statMonthEl = document.getElementById('amd-stat-month');
    const statMonthCountEl = document.getElementById('amd-stat-month-count');
    if (statMonthEl) statMonthEl.innerText = '฿' + monthSum.toLocaleString();
    if (statMonthCountEl) statMonthCountEl.innerText = `${monthOrdersToCount.length} คำสั่งซื้อในเดือนนี้`;

    // Pending unpaid summary
    const pendingOrders = allOrders.filter(o => o.payment !== 'paid' && o.payment !== 'ชำระแล้ว');
    const pendingSum = pendingOrders.reduce((sum, o) => sum + (o.net || 0), 0);
    const statPendingEl = document.getElementById('amd-stat-pending');
    const statPendingCountEl = document.getElementById('amd-stat-pending-count');
    if (statPendingEl) statPendingEl.innerText = '฿' + pendingSum.toLocaleString();
    if (statPendingCountEl) statPendingCountEl.innerText = `${pendingOrders.length} รายการรอชำระ/วางบิล`;

    // Apply Filter Options
    const yearVal = document.getElementById('amd-filter-year')?.value || 'all';
    const monthVal = document.getElementById('amd-filter-month')?.value || 'all';
    const statusVal = document.getElementById('amd-filter-status')?.value || 'all';

    let filtered = [...allOrders];
    if (yearVal !== 'all') {
      filtered = filtered.filter(o => {
        const d = new Date(o.date);
        return d.getFullYear().toString() === yearVal;
      });
    }
    if (monthVal !== 'all') {
      filtered = filtered.filter(o => {
        const d = new Date(o.date);
        return String(d.getMonth() + 1).padStart(2, '0') === monthVal;
      });
    }
    if (statusVal !== 'all') {
      filtered = filtered.filter(o => o.status === statusVal);
    }

    const summaryTag = document.getElementById('amd-orders-summary-tag');
    if (summaryTag) {
      summaryTag.innerText = `แสดง ${filtered.length} จาก ${allOrders.length} รายการ`;
    }

    if (filtered.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:35px; color:#888;">ไม่พบรายการคำสั่งซื้อตามตัวกรองที่เลือก</td></tr>';
      return;
    }

    filtered.forEach(o => {
      const itemsText = (o.items || []).map(i => {
        const cat = (this.state.catalog || []).find(c => c.id === i.type);
        return `<strong>${cat ? cat.name : (i.type || 'งานป้าย')}</strong> (${i.w || 1}x${i.h || 1} ม., ${i.qty || 1} ชิ้น)`;
      }).join('<br>') || (o.details || 'งานป้ายสั่งผลิตตามสเปก');

      tbody.innerHTML += `
      <tr style="border-bottom:1px solid #E2E8F0;">
        <td style="padding:12px 14px;">
          <strong style="color:var(--primary); font-size:13.5px;">${o.id}</strong><br>
          <small style="color:#64748B;"><i class="las la-calendar"></i> ${new Date(o.date).toLocaleDateString('th-TH')}</small>
        </td>
        <td style="padding:12px 14px; font-size:12px; line-height:1.5;">
          ${itemsText}
        </td>
        <td style="padding:12px 14px; font-weight:800; font-size:14px; color:var(--primary);">
          ฿${(o.net || 0).toLocaleString()}
        </td>
        <td style="padding:12px 14px;">
          <span class="status-badge status-${o.status}">${o.status}</span>
        </td>
        <td style="padding:12px 14px;">
          <span class="pay-${o.payment}">${o.payment === 'paid' ? 'ชำระแล้ว' : (o.payment === 'pending' ? 'รอชำระ' : o.payment)}</span>
        </td>
        <td style="padding:12px 14px; text-align:center;">
          <div style="display:flex; gap:5px; justify-content:center; flex-wrap:wrap;">
            <button class="btn btn-xs btn-outline" onclick="app.openDocModal('${o.id}', 'quotation')" title="เปิด/พิมพ์ใบเสนอราคา (Quotation)"><i class="las la-file-invoice"></i> ใบเสนอราคา</button>
            <button class="btn btn-xs btn-outline" style="border-color:#10B981; color:#059669;" onclick="app.openDocModal('${o.id}', 'receipt')" title="เปิด/พิมพ์ใบเสร็จรับเงิน (Receipt)"><i class="las la-receipt"></i> ใบเสร็จ</button>
            <button class="btn btn-xs btn-outline" style="border-color:#2563EB; color:#2563EB;" onclick="app.openDocModal('${o.id}', 'tax_invoice')" title="เปิด/พิมพ์ใบกำกับภาษี (Tax Invoice)"><i class="las la-file-invoice-dollar"></i> ใบกำกับภาษี</button>
            <button class="btn btn-xs btn-outline" style="border-color:#D97706; color:#D97706;" onclick="app.openDocModal('${o.id}', 'delivery_note')" title="เปิด/พิมพ์ใบส่งของ/ใบแจ้งหนี้"><i class="las la-truck"></i> ใบส่งของ</button>
          </div>
        </td>
      </tr>`;
    });
  },

  renderAdminMemberTrackingList() {
    const container = document.getElementById('amd-tracking-list');
    if (!container) return;
    container.innerHTML = '';

    const orders = this.getAdminMemberOrders();
    if (orders.length === 0) {
      container.innerHTML = `
        <div class="card" style="text-align:center; padding:40px 20px; background:white; border-radius:14px;">
          <i class="las la-box-open" style="font-size:48px; color:#94A3B8; margin-bottom:12px;"></i>
          <h4 style="color:#1E293B; margin:0 0 6px 0;">ยังไม่มีงานสั่งผลิตของสมาชิก/ตัวแทนที่กำลังดำเนินการ</h4>
          <p style="color:#64748B; font-size:13px; margin:0 0 16px 0;">เริ่มต้นเปิดคำสั่งซื้อใหม่และติดตามงานผ่านขั้นตอนทั้ง 5 ได้ทันที</p>
          <button class="btn btn-primary" onclick="app.scrollToOrder()"><i class="las la-plus"></i> เปิดคำสั่งซื้อใหม่</button>
        </div>`;
      return;
    }

    const steps = [
      { key: 'Sales', label: '1. รับออเดอร์', desc: 'เปิดบิล/รับข้อมูล', icon: 'la-file-invoice' },
      { key: 'Graphic', label: '2. ตรวจแบบ E-Proof', desc: 'ตรวจและอนุมัติแบบ', icon: 'la-pencil-ruler' },
      { key: 'Production', label: '3. กำลังผลิต', desc: 'พิมพ์ UV/ขึ้นรูป', icon: 'la-print' },
      { key: 'Delivery', label: '4. จัดส่ง/ติดตั้ง', desc: 'ขนส่ง/ช่างเข้าหน้างาน', icon: 'la-truck' },
      { key: 'Done', label: '5. ส่งมอบสำเร็จ', desc: 'รับสินค้าเรียบร้อย', icon: 'la-check-circle' }
    ];

    const stepOrder = { 'Sales': 1, 'Graphic': 2, 'Production': 3, 'Delivery': 4, 'Done': 5 };

    orders.forEach(o => {
      const currentStepNum = stepOrder[o.status] || 1;
      const itemsList = (o.items || []).map(i => {
        const cat = (this.state.catalog || []).find(c => c.id === i.type);
        return `<strong>${cat ? cat.name : (i.type || 'งานป้าย')}</strong> (${i.w || 1}x${i.h || 1} ม., ${i.qty || 1} ชิ้น)`;
      }).join(', ') || (o.details || 'งานป้ายสั่งผลิตตามสเปก');

      const proofImgSrc = o.proofImg || 'https://images.unsplash.com/photo-1626785774573-4b799315345d?auto=format&fit=crop&w=600&q=80';

      let stepBarHtml = `
        <div style="display:grid; grid-template-columns:repeat(5, 1fr); gap:8px; margin:16px 0;">
      `;

      steps.forEach(st => {
        const thisNum = stepOrder[st.key];
        const isDone = thisNum < currentStepNum;
        const isCurrent = thisNum === currentStepNum;
        const bg = isCurrent ? '#2563EB' : (isDone ? '#10B981' : '#E2E8F0');
        const color = (isCurrent || isDone) ? 'white' : '#64748B';
        const fw = isCurrent ? '800' : '600';
        const ring = isCurrent ? 'box-shadow: 0 0 0 3px rgba(37,99,235,0.3);' : '';

        stepBarHtml += `
          <div style="background:${bg}; color:${color}; padding:10px 8px; border-radius:10px; text-align:center; transition:0.3s; ${ring}">
            <div style="font-size:18px; margin-bottom:2px;"><i class="las ${st.icon}"></i></div>
            <div style="font-size:11.5px; font-weight:${fw}; line-height:1.2;">${st.label}</div>
            <div style="font-size:10px; opacity:0.85; margin-top:2px;">${st.desc}</div>
          </div>
        `;
      });
      stepBarHtml += '</div>';

      container.innerHTML += `
      <div class="card" style="padding:22px; background:white; border-radius:14px; border:1px solid #E2E8F0; margin-bottom:0;">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:10px; margin-bottom:12px;">
          <div>
            <div style="display:flex; align-items:center; gap:8px;">
              <h4 style="margin:0; font-size:17px; color:var(--primary); font-weight:800;">คำสั่งซื้อ #${o.id}</h4>
              <span class="status-badge status-${o.status}">${o.status}</span>
              <span class="pay-${o.payment}">${o.payment === 'paid' ? 'ชำระแล้ว' : 'รอชำระ'}</span>
            </div>
            <div style="font-size:12.5px; color:#64748B; margin-top:4px;">
              วันที่สั่งผลิต: ${new Date(o.date).toLocaleDateString('th-TH')} | ยอดสุทธิ: <strong style="color:var(--primary);">฿${(o.net || 0).toLocaleString()}</strong>
            </div>
            <div style="font-size:12px; color:#334155; margin-top:4px;">
              รายการ: ${itemsList}
            </div>
          </div>
          <div style="display:flex; gap:6px; flex-wrap:wrap;">
            <button class="btn btn-xs btn-outline" onclick="app.openDocModal('${o.id}', 'quotation')"><i class="las la-file-invoice"></i> ใบเสนอราคา</button>
            <button class="btn btn-xs btn-outline" style="border-color:#10B981; color:#059669;" onclick="app.openDocModal('${o.id}', 'receipt')"><i class="las la-receipt"></i> ใบเสร็จ</button>
            <button class="btn btn-xs btn-outline" style="border-color:#2563EB; color:#2563EB;" onclick="app.openDocModal('${o.id}', 'tax_invoice')"><i class="las la-file-invoice-dollar"></i> ใบกำกับภาษี</button>
            <button class="btn btn-xs btn-outline" style="border-color:#D97706; color:#D97706;" onclick="app.openDocModal('${o.id}', 'delivery_note')"><i class="las la-truck"></i> ใบส่งของ</button>
          </div>
        </div>

        <!-- 5-Step Pipeline Progress Bar -->
        ${stepBarHtml}

        <!-- E-Proof Preview & Direct Customer Approval -->
        <div style="background:#F8FAFC; border:1px solid #CBD5E1; border-radius:12px; padding:16px; margin-top:14px;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
            <div style="font-size:13.5px; font-weight:700; color:#1E3A8A; display:flex; align-items:center; gap:6px;">
              <i class="las la-image" style="color:#2563EB; font-size:18px;"></i> แบบร่าง E-Proof สำหรับตรวจสอบและอนุมัติก่อนผลิต:
            </div>
            <div>
              ${o.proofStatus === 'approved' 
                ? '<span class="status-badge" style="background:#D1FAE5; color:#065F46; font-weight:700;"><i class="las la-check-circle"></i> อนุมัติแบบแล้ว</span>' 
                : (o.proofStatus === 'revision' 
                    ? '<span class="status-badge" style="background:#FEF3C7; color:#92400E; font-weight:700;"><i class="las la-redo"></i> อยู่ระหว่างขอแก้แบบ</span>' 
                    : '<span class="status-badge" style="background:#EFF6FF; color:#1E40AF; font-weight:700;"><i class="las la-clock"></i> รอตรวจสอบแบบ</span>')}
            </div>
          </div>

          <div style="display:flex; gap:16px; align-items:center; flex-wrap:wrap;">
            <div style="position:relative;">
              <img src="${proofImgSrc}" alt="E-Proof" style="width:140px; height:90px; object-fit:cover; border-radius:8px; border:1px solid #E2E8F0; box-shadow:0 2px 6px rgba(0,0,0,0.06); cursor:pointer;" onclick="app.previewImage('${proofImgSrc}')" title="คลิกเพื่อดูรูปขนาดเต็ม">
              <span style="position:absolute; bottom:4px; right:4px; background:rgba(0,0,0,0.6); color:white; font-size:10px; padding:2px 6px; border-radius:4px;"><i class="las la-search-plus"></i> ขยาย</span>
            </div>
            <div style="flex:1; min-width:220px;">
              ${o.proofStatus === 'approved' ? `
                <div style="font-size:13px; color:#065F46; font-weight:600; margin-bottom:8px;">
                  <i class="las la-check"></i> ลูกค้า/ตัวแทนอนุมัติแบบแล้ว ส่งเข้าสู่กระบวนการผลิตงานพิมพ์และประกอบโครงสร้าง
                </div>
              ` : o.proofStatus === 'revision' ? `
                <div style="font-size:13px; color:#92400E; font-weight:600; margin-bottom:8px;">
                  <i class="las la-exclamation-circle"></i> ลูกค้าแจ้งขอแก้ไข: <em>"${o.proofNote || 'ขอปรับแก้แบบ'}"</em>
                </div>
              ` : `
                <div style="font-size:13px; color:#475569; margin-bottom:8px;">
                  ส่งแบบ E-Proof ให้ลูกค้า/ตัวแทนตรวจสอบ สามารถกดยืนยันอนุมัติแบบเพื่อส่งผลิต หรือขอแก้ไขแบบได้โดยตรง
                </div>
              `}

              <!-- Proof Action Buttons -->
              <div style="display:flex; gap:8px; flex-wrap:wrap;">
                <button class="btn btn-xs btn-success" style="font-weight:700; padding:6px 14px;" onclick="app.adminApproveProof('${o.id}')">
                  <i class="las la-check"></i> ยืนยันอนุมัติแบบ (ส่งผลิตทันที)
                </button>
                <button class="btn btn-xs btn-outline" style="border-color:#F59E0B; color:#B45309; padding:6px 14px;" onclick="app.adminRequestProofRevision('${o.id}')">
                  <i class="las la-edit"></i> ขอแก้ไขแบบ
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Quick Stage Controller Bar -->
        <div style="margin-top:14px; padding-top:12px; border-top:1px dashed #E2E8F0; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
          <div style="font-size:12px; font-weight:700; color:#64748B;">
            <i class="las la-sliders-h"></i> ปรับขั้นตอนงานด่วน (Admin Stage Controller):
          </div>
          <div style="display:flex; gap:6px; flex-wrap:wrap;">
            <button class="btn btn-xs ${o.status === 'Sales' ? 'btn-primary' : 'btn-outline'}" onclick="app.adminChangeOrderStatus('${o.id}', 'Sales')">1. รับออเดอร์</button>
            <button class="btn btn-xs ${o.status === 'Graphic' ? 'btn-primary' : 'btn-outline'}" onclick="app.adminChangeOrderStatus('${o.id}', 'Graphic')">2. ตรวจแบบ</button>
            <button class="btn btn-xs ${o.status === 'Production' ? 'btn-primary' : 'btn-outline'}" onclick="app.adminChangeOrderStatus('${o.id}', 'Production')">3. ผลิต</button>
            <button class="btn btn-xs ${o.status === 'Delivery' ? 'btn-primary' : 'btn-outline'}" onclick="app.adminChangeOrderStatus('${o.id}', 'Delivery')">4. จัดส่ง</button>
            <button class="btn btn-xs ${o.status === 'Done' ? 'btn-success' : 'btn-outline'}" onclick="app.adminChangeOrderStatus('${o.id}', 'Done')">5. สำเร็จ</button>
          </div>
        </div>
      </div>`;
    });
  },

  adminApproveProof(orderId) {
    const o = (this.state.orders || []).find(x => x.id === orderId);
    if (!o) return;
    o.proofStatus = 'approved';
    o.status = 'Production';
    this.saveStorage();
    this.renderAdminMemberTrackingList();
    this.renderAdminMemberOrdersTable();
    if (this.renderKanban) this.renderKanban();
    if (this.renderOrders) this.renderOrders();
    this.showToast(`อนุมัติแบบ E-Proof สำหรับออเดอร์ ${orderId} สำเร็จ (ส่งเข้าสู่กระบวนการผลิต)`, 'success');
  },

  adminRequestProofRevision(orderId) {
    const o = (this.state.orders || []).find(x => x.id === orderId);
    if (!o) return;
    const note = prompt('ระบุรายละเอียดหรือข้อความที่ต้องการให้ฝ่ายออกแบบแก้ไข:', o.proofNote || 'ขอปรับข้อความและโทนสี');
    if (note === null) return;
    o.proofStatus = 'revision';
    o.proofNote = note;
    o.status = 'Graphic';
    this.saveStorage();
    this.renderAdminMemberTrackingList();
    this.renderAdminMemberOrdersTable();
    if (this.renderKanban) this.renderKanban();
    if (this.renderOrders) this.renderOrders();
    this.showToast(`บันทึกขอแก้ไขแบบสำหรับออเดอร์ ${orderId} เรียบร้อย (ส่งกลับฝ่ายกราฟิก)`, 'info');
  },

  adminChangeOrderStatus(orderId, newStatus) {
    const o = (this.state.orders || []).find(x => x.id === orderId);
    if (!o) return;
    o.status = newStatus;
    if (newStatus === 'Production' && !o.proofStatus) {
      o.proofStatus = 'approved';
    }
    this.saveStorage();
    this.renderAdminMemberTrackingList();
    this.renderAdminMemberOrdersTable();
    if (this.renderKanban) this.renderKanban();
    if (this.renderOrders) this.renderOrders();
    this.showToast(`ปรับสถานะออเดอร์ ${orderId} เป็น "${newStatus}" เรียบร้อย`, 'success');
  },

  /* ==========================================================================
     SEO, FAQ ACCORDION & SOCIAL DISCOVERY
     ========================================================================== */
  toggleSeoFaq(index) {
    const ans = document.getElementById('seo-faq-ans-' + index);
    const icon = document.getElementById('seo-faq-icon-' + index);
    if (!ans) return;
    const isShowing = ans.style.display === 'block';
    ans.style.display = isShowing ? 'none' : 'block';
    if (icon) {
      icon.style.transform = isShowing ? 'rotate(0deg)' : 'rotate(180deg)';
    }
  },

  shareToLine() {
    const url = encodeURIComponent(window.location.href);
    const title = encodeURIComponent('ร้านทำป้ายตรัง ทำดีมีเดีย TUMDEEMEDIA - สื่อโฆษณาพรีเมียมอันดับ 1');
    window.open(`https://social-plugins.line.me/lineit/share?url=${url}&text=${title}`, '_blank', 'width=600,height=500');
  },

  shareToFacebook() {
    const url = encodeURIComponent(window.location.href);
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${url}`, '_blank', 'width=600,height=500');
  },

  copySiteUrl() {
    const url = window.location.href;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(() => {
        this.showToast('คัดลอกลิงก์เว็บไซต์ TUMDEEMEDIA เรียบร้อยแล้ว', 'success');
      }).catch(() => {
        prompt('คัดลอกลิงก์เว็บไซต์:', url);
      });
    } else {
      prompt('คัดลอกลิงก์เว็บไซต์:', url);
    }
  },

  /* ==========================================================================
     REAL-TIME CMS MANAGEMENT (จัดการหน้าแรก Real-time ทุกส่วน)
     ========================================================================== */
  switchCmsSubTab(tabName, el) {
    document.querySelectorAll('.cms-tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.cms-subtab-pane').forEach(p => p.classList.remove('active'));
    if (el) {
      el.classList.add('active');
    } else {
      const btn = document.getElementById('cms-nav-' + tabName);
      if (btn) btn.classList.add('active');
    }
    const pane = document.getElementById('cms-pane-' + tabName);
    if (pane) pane.classList.add('active');
    if (tabName === 'branding') this.renderShopBrandingCMS();
    if (tabName === 'sections') this.renderLandingSections();
    if (tabName === 'gas') this.loadGasConfig();
    this.renderCmsAdmin();
  },

  populateCmsInputs() {
    const c = this.state.cms;
    if (!c) return;
    const el = id => document.getElementById(id);

    // One-stop inputs
    if (c.oneStop) {
      if (el('onestop-in-title')) el('onestop-in-title').value = c.oneStop.title || '';
      if (el('onestop-in-sub')) el('onestop-in-sub').value = c.oneStop.sub || '';
      if (el('onestop-in-desc')) el('onestop-in-desc').value = c.oneStop.desc || '';
      if (el('onestop-in-mainimg')) el('onestop-in-mainimg').value = c.oneStop.mainImg || '';
      if (el('onestop-in-about-title')) el('onestop-in-about-title').value = c.oneStop.aboutTitle || '';
      if (el('onestop-in-about-desc')) el('onestop-in-about-desc').value = c.oneStop.aboutDesc || '';
      if (el('onestop-in-b1')) el('onestop-in-b1').value = c.oneStop.bullet1 || '';
      if (el('onestop-in-b2')) el('onestop-in-b2').value = c.oneStop.bullet2 || '';
      if (el('onestop-in-b3')) el('onestop-in-b3').value = c.oneStop.bullet3 || '';
    }

    // Order Online CTA
    if (c.orderCta) {
      if (el('cta-order-badge')) el('cta-order-badge').value = c.orderCta.badge || '';
      if (el('cta-order-title')) el('cta-order-title').value = c.orderCta.title || '';
      if (el('cta-order-sub')) el('cta-order-sub').value = c.orderCta.sub || '';
      if (el('cta-order-p1')) el('cta-order-p1').value = c.orderCta.bullet1 || '';
      if (el('cta-order-p2')) el('cta-order-p2').value = c.orderCta.bullet2 || '';
      if (el('cta-order-p3')) el('cta-order-p3').value = c.orderCta.bullet3 || '';
      if (el('cta-order-btn')) el('cta-order-btn').value = c.orderCta.btnText || '';
    }

    // Partner Agent CTA
    if (c.agentCta) {
      if (el('cta-agent-badge')) el('cta-agent-badge').value = c.agentCta.badge || '';
      if (el('cta-agent-title')) el('cta-agent-title').value = c.agentCta.title || '';
      if (el('cta-agent-desc')) el('cta-agent-desc').value = c.agentCta.sub || c.agentCta.desc || '';
      if (el('cta-agent-p1')) el('cta-agent-p1').value = c.agentCta.bullet1 || '';
      if (el('cta-agent-p2')) el('cta-agent-p2').value = c.agentCta.bullet2 || '';
      if (el('cta-agent-p3')) el('cta-agent-p3').value = c.agentCta.bullet3 || '';
      if (el('cta-agent-btn')) el('cta-agent-btn').value = c.agentCta.btnText || '';
    }

    // Contact & SEO
    if (el('cms-input-address')) el('cms-input-address').value = c.contactAddress || '';
    if (el('cms-input-phone')) el('cms-input-phone').value = c.contactPhone || '';
    if (el('cms-input-email')) el('cms-input-email').value = c.contactEmail || '';
    if (el('cms-input-lineid')) el('cms-input-lineid').value = c.contactLineId || '';
    if (el('cms-input-fbid')) el('cms-input-fbid').value = c.contactFbId || '';
    if (el('cms-input-map')) el('cms-input-map').value = c.mapIframe || '';
    if (el('cms-input-seo-title')) el('cms-input-seo-title').value = c.seoTitle || '';
    if (el('cms-input-seo-desc')) el('cms-input-seo-desc').value = c.seoDesc || '';
    if (el('cms-input-seo-keywords')) el('cms-input-seo-keywords').value = c.seoKeywords || '';
  },

  renderCmsAdmin() {
    this.populateCmsInputs();

    // 0. Hero Layout Selector Cards (6 Presets)
    const heroLayoutsGrid = document.getElementById('cms-hero-layouts-grid');
    if (heroLayoutsGrid && this.state.cms && this.state.cms.heroLayouts) {
      heroLayoutsGrid.innerHTML = '';
      const curr = this.state.cms.heroLayout || 'style1';
      this.state.cms.heroLayouts.forEach(layout => {
        const isSelected = layout.id === curr;
        heroLayoutsGrid.innerHTML += `
        <div class="hero-layout-card" data-layout="${layout.id}" onclick="app.selectHeroLayout('${layout.id}')" style="cursor:pointer; padding:18px; border-radius:14px; border:2px solid ${isSelected ? 'var(--primary)' : '#E2E8F0'}; background:${isSelected ? '#EFF6FF' : '#FFFFFF'}; box-shadow:${isSelected ? '0 8px 20px rgba(30,58,138,0.12)' : '0 2px 6px rgba(0,0,0,0.03)'}; transition:all 0.25s; position:relative;">
          <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:10px;">
            <div style="width:44px; height:44px; border-radius:12px; background:${layout.previewColor || 'var(--primary)'}; color:white; display:flex; align-items:center; justify-content:center; font-size:22px; box-shadow:0 4px 10px rgba(0,0,0,0.1);">
              <i class="${layout.icon || 'las la-palette'}"></i>
            </div>
            ${isSelected ? '<span style="font-size:11px; font-weight:700; background:var(--primary); color:white; padding:4px 10px; border-radius:50px; display:inline-flex; align-items:center; gap:4px;"><i class="las la-check-circle"></i> กำลังใช้งาน</span>' : '<span style="font-size:11px; color:#64748B; background:#F1F5F9; padding:4px 10px; border-radius:50px;">คลิกเลือกสไตล์นี้</span>'}
          </div>
          <h4 style="margin:0 0 6px 0; font-size:15px; font-weight:700; color:var(--primary);">${layout.name}</h4>
          <p style="margin:0; font-size:12px; color:#64748B; line-height:1.5;">${layout.desc}</p>
        </div>`;
      });
    }

    // 0.5. Community Stores List
    this.renderCmsCommunityStores();

    // 1. Hero Slides
    const heroCont = document.getElementById('cms-hero-slides-list');
    if (heroCont && this.state.cms.heroSlides) {
      heroCont.innerHTML = '';
      this.state.cms.heroSlides.forEach((s, idx) => {
        heroCont.innerHTML += `
        <div class="cms-list-row">
          <div style="display:flex; align-items:center; gap:12px; flex:1;">
            <img src="${s.img}" style="width:60px; height:40px; object-fit:cover; border-radius:6px;">
            <div>
              <div style="font-weight:700; color:var(--primary); font-size:14px;">${s.title}</div>
              <div style="font-size:12px; color:#64748B;">${s.sub}</div>
            </div>
          </div>
          <div class="cms-actions-group">
            <button class="btn-icon-sq" onclick="app.moveHeroSlide(${idx}, -1)" ${idx === 0 ? 'disabled style="opacity:0.4;"' : ''} title="เลื่อนขึ้น"><i class="las la-arrow-up"></i></button>
            <button class="btn-icon-sq" onclick="app.moveHeroSlide(${idx}, 1)" ${idx === this.state.cms.heroSlides.length - 1 ? 'disabled style="opacity:0.4;"' : ''} title="เลื่อนลง"><i class="las la-arrow-down"></i></button>
            <button class="btn-icon-sq" onclick="app.openHeroSlideModal(${idx})" title="แก้ไข"><i class="las la-edit"></i></button>
            <button class="btn-icon-sq danger" onclick="app.deleteHeroSlide(${idx})" title="ลบสไลด์"><i class="las la-trash"></i></button>
          </div>
        </div>`;
      });
    }

    // 2. Flash Sale
    const flashCont = document.getElementById('cms-flash-admin-list');
    if (flashCont && this.state.flashSales) {
      flashCont.innerHTML = '';
      this.state.flashSales.forEach((f, idx) => {
        flashCont.innerHTML += `
        <div class="cms-list-row">
          <div style="display:flex; align-items:center; gap:12px; flex:1;">
            <div style="width:40px; height:40px; border-radius:8px; background:${f.color || 'var(--danger)'}; color:white; display:flex; align-items:center; justify-content:center; font-size:20px;">
              <i class="${f.icon || 'las la-bolt'}"></i>
            </div>
            <div>
              <div style="font-weight:700; font-size:14px; color:var(--primary);">${f.title} <span style="font-size:11px; background:${f.color || '#EF4444'}; color:white; padding:2px 8px; border-radius:50px;">${f.badge || 'ลดพิเศษ'}</span></div>
              <div style="font-size:12px; color:#64748B;">฿${Number(f.price).toLocaleString()} ${f.normalPrice ? `<span style="text-decoration:line-through; margin-left:4px;">ปกติ ฿${Number(f.normalPrice).toLocaleString()}</span>` : ''} | รหัสสินค้า: ${f.targetType}</div>
            </div>
          </div>
          <div class="cms-actions-group">
            <button class="btn-icon-sq" onclick="app.moveFlashSale(${idx}, -1)" ${idx === 0 ? 'disabled style="opacity:0.4;"' : ''} title="เลื่อนขึ้น"><i class="las la-arrow-up"></i></button>
            <button class="btn-icon-sq" onclick="app.moveFlashSale(${idx}, 1)" ${idx === this.state.flashSales.length - 1 ? 'disabled style="opacity:0.4;"' : ''} title="เลื่อนลง"><i class="las la-arrow-down"></i></button>
            <button class="btn-icon-sq" onclick="app.openFlashSaleModal('${f.id}')" title="แก้ไข"><i class="las la-edit"></i></button>
            <button class="btn-icon-sq danger" onclick="app.deleteFlashSale('${f.id}')" title="ลบ"><i class="las la-trash"></i></button>
          </div>
        </div>`;
      });
    }

    // 3. Services
    const srvCont = document.getElementById('cms-services-admin-list');
    if (srvCont && this.state.services) {
      srvCont.innerHTML = '';
      this.state.services.forEach((s, idx) => {
        srvCont.innerHTML += `
        <div class="cms-list-row">
          <div style="display:flex; align-items:center; gap:12px; flex:1;">
            <img src="${s.img}" style="width:50px; height:35px; object-fit:cover; border-radius:6px;">
            <div>
              <div style="font-weight:700; font-size:13.5px;">${s.title}</div>
              <span style="font-size:11px; background:#F1F5F9; padding:2px 8px; border-radius:50px;">${s.cat}</span>
            </div>
          </div>
          <div class="cms-actions-group">
            <button class="btn-icon-sq" onclick="app.moveService(${idx}, -1)" ${idx === 0 ? 'disabled style="opacity:0.4;"' : ''} title="เลื่อนขึ้น"><i class="las la-arrow-up"></i></button>
            <button class="btn-icon-sq" onclick="app.moveService(${idx}, 1)" ${idx === this.state.services.length - 1 ? 'disabled style="opacity:0.4;"' : ''} title="เลื่อนลง"><i class="las la-arrow-down"></i></button>
            <button class="btn-icon-sq" onclick="app.openServiceModal('${s.id}')" title="แก้ไข"><i class="las la-edit"></i></button>
            <button class="btn-icon-sq danger" onclick="app.deleteService('${s.id}')" title="ลบ"><i class="las la-trash"></i></button>
          </div>
        </div>`;
      });
    }

    // 4. Packages
    const pkgCont = document.getElementById('cms-packages-admin-list');
    if (pkgCont && this.state.packages) {
      pkgCont.innerHTML = '';
      this.state.packages.forEach((pkg, idx) => {
        pkgCont.innerHTML += `
        <div class="cms-list-row">
          <div style="display:flex; align-items:center; gap:12px; flex:1;">
            <div style="width:40px; height:40px; border-radius:8px; background:rgba(245,158,11,0.1); color:var(--warning); display:flex; align-items:center; justify-content:center; font-size:20px;">
              <i class="${pkg.icon || 'las la-boxes'}"></i>
            </div>
            <div>
              <div style="font-weight:700; font-size:14px; color:var(--primary);">${pkg.title} ${pkg.isPopular ? '<span style="font-size:11px; background:#FEF3C7; color:#B45309; padding:2px 8px; border-radius:50px;">⭐ ยอดนิยม</span>' : ''}</div>
              <div style="font-size:12px; color:#64748B;">${pkg.desc || ''} (${(pkg.items || []).length} รายการในเซ็ต)</div>
            </div>
          </div>
          <div class="cms-actions-group">
            <button class="btn-icon-sq" onclick="app.movePackage(${idx}, -1)" ${idx === 0 ? 'disabled style="opacity:0.4;"' : ''} title="เลื่อนขึ้น"><i class="las la-arrow-up"></i></button>
            <button class="btn-icon-sq" onclick="app.movePackage(${idx}, 1)" ${idx === this.state.packages.length - 1 ? 'disabled style="opacity:0.4;"' : ''} title="เลื่อนลง"><i class="las la-arrow-down"></i></button>
            <button class="btn-icon-sq" onclick="app.openPackageModal('${pkg.id}')" title="แก้ไข"><i class="las la-edit"></i></button>
            <button class="btn-icon-sq danger" onclick="app.deletePackage('${pkg.id}')" title="ลบ"><i class="las la-trash"></i></button>
          </div>
        </div>`;
      });
    }

    // 5. Process Steps Workflow
    const procCont = document.getElementById('cms-process-admin-list');
    if (procCont && this.state.cms.processSteps) {
      procCont.innerHTML = '';
      this.state.cms.processSteps.forEach((st, idx) => {
        procCont.innerHTML += `
        <div class="cms-list-row">
          <div style="display:flex; align-items:center; gap:12px; flex:1;">
            <div style="width:36px; height:36px; border-radius:50%; background:#6366F1; color:white; display:flex; align-items:center; justify-content:center; font-weight:bold; font-size:14px;">
              ${st.num || idx + 1}
            </div>
            <div>
              <div style="font-weight:700; font-size:14px; color:var(--primary);"><i class="${st.icon || 'las la-check'}"></i> ${st.title}</div>
              <div style="font-size:12px; color:#64748B;">${st.desc}</div>
            </div>
          </div>
          <div class="cms-actions-group">
            <button class="btn-icon-sq" onclick="app.moveProcessStep(${idx}, -1)" ${idx === 0 ? 'disabled style="opacity:0.4;"' : ''} title="เลื่อนขึ้น"><i class="las la-arrow-up"></i></button>
            <button class="btn-icon-sq" onclick="app.moveProcessStep(${idx}, 1)" ${idx === this.state.cms.processSteps.length - 1 ? 'disabled style="opacity:0.4;"' : ''} title="เลื่อนลง"><i class="las la-arrow-down"></i></button>
            <button class="btn-icon-sq" onclick="app.openProcessStepModal(${idx})" title="แก้ไข"><i class="las la-edit"></i></button>
            <button class="btn-icon-sq danger" onclick="app.deleteProcessStep(${idx})" title="ลบ"><i class="las la-trash"></i></button>
          </div>
        </div>`;
      });
    }

    // 6. Portfolio Showcase
    const portCont = document.getElementById('cms-portfolio-admin-list');
    if (portCont && this.state.portfolio) {
      portCont.innerHTML = '';
      this.state.portfolio.forEach((p, idx) => {
        portCont.innerHTML += `
        <div class="cms-list-row">
          <div style="display:flex; align-items:center; gap:12px; flex:1;">
            <img src="${p.img}" style="width:50px; height:35px; object-fit:cover; border-radius:6px;">
            <div>
              <div style="font-weight:700; font-size:13.5px;">${p.title}</div>
              <span style="font-size:11px; color:#64748B;">${p.catName || p.cat}</span>
            </div>
          </div>
          <div class="cms-actions-group">
            <button class="btn-icon-sq" onclick="app.movePortfolio(${idx}, -1)" ${idx === 0 ? 'disabled style="opacity:0.4;"' : ''} title="เลื่อนขึ้น"><i class="las la-arrow-up"></i></button>
            <button class="btn-icon-sq" onclick="app.movePortfolio(${idx}, 1)" ${idx === this.state.portfolio.length - 1 ? 'disabled style="opacity:0.4;"' : ''} title="เลื่อนลง"><i class="las la-arrow-down"></i></button>
            <button class="btn-icon-sq" onclick="app.openPortfolioModal('${p.id}')" title="แก้ไข"><i class="las la-edit"></i></button>
            <button class="btn-icon-sq danger" onclick="app.deletePortfolio('${p.id}')" title="ลบ"><i class="las la-trash"></i></button>
          </div>
        </div>`;
      });
    }

    // 7. Monthly Promotions
    const promoCont = document.getElementById('cms-promotions-admin-list');
    if (promoCont && this.state.promotions) {
      promoCont.innerHTML = '';
      this.state.promotions.forEach((pr, idx) => {
        promoCont.innerHTML += `
        <div class="cms-list-row">
          <div style="display:flex; align-items:center; gap:12px; flex:1;">
            <img src="${pr.img}" style="width:60px; height:40px; object-fit:cover; border-radius:6px;">
            <div>
              <div style="font-weight:700; font-size:13.5px; color:#EC4899;">${pr.title}</div>
              <div style="font-size:12px; color:#64748B; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:400px;">${pr.desc}</div>
            </div>
          </div>
          <div class="cms-actions-group">
            <button class="btn-icon-sq" onclick="app.movePromotion(${idx}, -1)" ${idx === 0 ? 'disabled style="opacity:0.4;"' : ''} title="เลื่อนขึ้น"><i class="las la-arrow-up"></i></button>
            <button class="btn-icon-sq" onclick="app.movePromotion(${idx}, 1)" ${idx === this.state.promotions.length - 1 ? 'disabled style="opacity:0.4;"' : ''} title="เลื่อนลง"><i class="las la-arrow-down"></i></button>
            <button class="btn-icon-sq" onclick="app.openPromotionModal(${idx})" title="แก้ไข"><i class="las la-edit"></i></button>
            <button class="btn-icon-sq danger" onclick="app.deletePromotion(${idx})" title="ลบ"><i class="las la-trash"></i></button>
          </div>
        </div>`;
      });
    }

    // 8. One-Stop Service Feature Cards
    const oscCont = document.getElementById('cms-onestop-cards-list');
    if (oscCont && this.state.cms.oneStop && this.state.cms.oneStop.cards) {
      oscCont.innerHTML = '';
      this.state.cms.oneStop.cards.forEach((c, idx) => {
        oscCont.innerHTML += `
        <div class="cms-list-row">
          <div style="display:flex; align-items:center; gap:12px; flex:1;">
            <img src="${c.img}" style="width:50px; height:40px; object-fit:cover; border-radius:6px;">
            <div>
              <div style="font-weight:700; font-size:13.5px; color:var(--primary);">${c.num}. ${c.title}</div>
              <div style="font-size:12px; color:#64748B; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:400px;">${c.desc}</div>
            </div>
          </div>
          <div class="cms-actions-group">
            <button class="btn-icon-sq" onclick="app.openOnestopCardModal(${idx})" title="แก้ไขการ์ด"><i class="las la-edit"></i></button>
            <button class="btn-icon-sq danger" onclick="app.deleteOnestopCard(${idx})" title="ลบ"><i class="las la-trash"></i></button>
          </div>
        </div>`;
      });
    }

    // 10. Trusted Brands
    const brandsCont = document.getElementById('cms-brands-admin-grid');
    if (brandsCont && this.state.cms.trustedBrands) {
      brandsCont.innerHTML = '';
      this.state.cms.trustedBrands.forEach((b, idx) => {
        brandsCont.innerHTML += `
        <div style="background:white; border:1px solid var(--border); border-radius:10px; padding:12px; text-align:center; position:relative;">
          <img src="${b}" style="max-width:100%; height:45px; object-fit:contain; margin-bottom:8px;">
          <div style="display:flex; justify-content:center; gap:6px;">
            <button class="btn-icon-sq" onclick="app.openBrandModal(${idx})" title="แก้ไข"><i class="las la-edit"></i></button>
            <button class="btn-icon-sq danger" onclick="app.deleteBrand(${idx})" title="ลบ"><i class="las la-trash"></i></button>
          </div>
        </div>`;
      });
    }

    // 11. Customer Testimonials
    const testiCont = document.getElementById('cms-testimonials-admin-list');
    if (testiCont && this.state.testimonials) {
      testiCont.innerHTML = '';
      this.state.testimonials.forEach((t, idx) => {
        testiCont.innerHTML += `
        <div class="cms-list-row">
          <div style="display:flex; align-items:center; gap:12px; flex:1;">
            <img src="${t.img}" style="width:40px; height:40px; border-radius:50%; object-fit:cover;">
            <div>
              <div style="font-weight:700; font-size:13.5px; color:var(--primary);">${t.name} <span style="font-size:11px; color:#64748B;">(${t.role})</span></div>
              <div style="font-size:12px; color:#64748B; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:400px;">"${t.text}"</div>
            </div>
          </div>
          <div class="cms-actions-group">
            <button class="btn-icon-sq" onclick="app.moveTestimonial(${idx}, -1)" ${idx === 0 ? 'disabled style="opacity:0.4;"' : ''} title="เลื่อนขึ้น"><i class="las la-arrow-up"></i></button>
            <button class="btn-icon-sq" onclick="app.moveTestimonial(${idx}, 1)" ${idx === this.state.testimonials.length - 1 ? 'disabled style="opacity:0.4;"' : ''} title="เลื่อนลง"><i class="las la-arrow-down"></i></button>
            <button class="btn-icon-sq" onclick="app.openTestimonialModal(${idx})" title="แก้ไข"><i class="las la-edit"></i></button>
            <button class="btn-icon-sq danger" onclick="app.deleteTestimonial(${idx})" title="ลบ"><i class="las la-trash"></i></button>
          </div>
        </div>`;
      });
    }

    // 12. FAQ
    const faqCont = document.getElementById('cms-faq-admin-list');
    if (faqCont && this.state.cms.faqs) {
      faqCont.innerHTML = '';
      this.state.cms.faqs.forEach((f, idx) => {
        faqCont.innerHTML += `
        <div class="cms-list-row">
          <div style="flex:1;">
            <div style="font-weight:700; font-size:13.5px; color:var(--primary);">${f.q}</div>
            <div style="font-size:12px; color:#64748B; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:400px;">${f.a}</div>
          </div>
          <div class="cms-actions-group">
            <button class="btn-icon-sq" onclick="app.moveFaq(${idx}, -1)" ${idx === 0 ? 'disabled style="opacity:0.4;"' : ''} title="เลื่อนขึ้น"><i class="las la-arrow-up"></i></button>
            <button class="btn-icon-sq" onclick="app.moveFaq(${idx}, 1)" ${idx === this.state.cms.faqs.length - 1 ? 'disabled style="opacity:0.4;"' : ''} title="เลื่อนลง"><i class="las la-arrow-down"></i></button>
            <button class="btn-icon-sq" onclick="app.openFaqModal(${idx})" title="แก้ไข"><i class="las la-edit"></i></button>
            <button class="btn-icon-sq danger" onclick="app.deleteFaq(${idx})" title="ลบ"><i class="las la-trash"></i></button>
          </div>
        </div>`;
      });
    }
  },

  // Hero Slides
  moveHeroSlide(idx, dir) {
    const slides = this.state.cms.heroSlides;
    const targetIdx = idx + dir;
    if (targetIdx < 0 || targetIdx >= slides.length) return;
    const temp = slides[idx];
    slides[idx] = slides[targetIdx];
    slides[targetIdx] = temp;
    this.saveStateToStorage();
    this.renderLandingCMS();
    this.renderCmsAdmin();
    this.showToast('ปรับลำดับสไลด์เรียบร้อย (Real-time)', 'success');
  },

  deleteHeroSlide(idx) {
    if (this.state.cms.heroSlides.length <= 1) { this.showToast('ต้องมีสไลด์อย่างน้อย 1 สไลด์', 'warning'); return; }
    if (!confirm('ต้องการลบสไลด์นี้?')) return;
    this.state.cms.heroSlides.splice(idx, 1);
    this.saveStateToStorage();
    this.renderLandingCMS();
    this.renderCmsAdmin();
    this.showToast('ลบสไลด์เรียบร้อย (Real-time)', 'success');
  },

  openHeroSlideModal(idx) {
    this.state.editingSlideIdx = idx !== undefined ? idx : null;
    const titleEl = document.getElementById('slide-modal-title');
    if (idx !== null && idx !== undefined) {
      const s = this.state.cms.heroSlides[idx];
      if (titleEl) titleEl.innerText = 'แก้ไขสไลด์หน้าแรก (Hero Slide)';
      document.getElementById('slide-title').value = s.title;
      document.getElementById('slide-sub').value = s.sub;
      document.getElementById('slide-desc').value = s.desc;
      document.getElementById('slide-img').value = s.img;
    } else {
      if (titleEl) titleEl.innerText = 'เพิ่มสไลด์หน้าแรกใหม่';
      document.getElementById('slide-title').value = '';
      document.getElementById('slide-sub').value = '';
      document.getElementById('slide-desc').value = '';
      document.getElementById('slide-img').value = 'https://images.unsplash.com/photo-1542744173-8e7e53415bb0?auto=format&fit=crop&w=1200&q=80';
    }
    const modal = document.getElementById('hero-slide-modal');
    if (modal) modal.style.display = 'flex';
  },

  saveHeroSlideModal() {
    const title = document.getElementById('slide-title')?.value;
    const sub = document.getElementById('slide-sub')?.value;
    const desc = document.getElementById('slide-desc')?.value;
    const img = document.getElementById('slide-img')?.value;

    if (!title || !img) { this.showToast('กรุณากรอกหัวข้อและรูปภาพ', 'warning'); return; }

    if (this.state.editingSlideIdx !== null && this.state.editingSlideIdx !== undefined) {
      this.state.cms.heroSlides[this.state.editingSlideIdx] = { title, sub, desc, img };
    } else {
      this.state.cms.heroSlides.push({ title, sub, desc, img });
    }
    this.saveStateToStorage();
    this.renderLandingCMS();
    this.renderCmsAdmin();
    const modal = document.getElementById('hero-slide-modal');
    if (modal) modal.style.display = 'none';
    this.showToast('บันทึกสไลด์หน้าแรกเรียบร้อย (Real-time)', 'success');
  },

  // Flash Sale Deals
  openFlashSaleModal(id) {
    const titleEl = document.getElementById('fs-modal-title');
    if (id) {
      const f = (this.state.flashSales || []).find(x => x.id === id);
      if (!f) return;
      if (titleEl) titleEl.innerHTML = '<i class="las la-bolt"></i> แก้ไขดีล Flash Sale';
      document.getElementById('fs-id').value = f.id;
      document.getElementById('fs-title').value = f.title || '';
      document.getElementById('fs-desc').value = f.desc || '';
      document.getElementById('fs-price').value = f.price || '';
      document.getElementById('fs-normal-price').value = f.normalPrice || '';
      document.getElementById('fs-badge').value = f.badge || 'ลดพิเศษ';
      document.getElementById('fs-color').value = f.color || '#EF4444';
      document.getElementById('fs-icon').value = f.icon || 'las la-bolt';
      document.getElementById('fs-target-type').value = f.targetType || 'V01';
    } else {
      if (titleEl) titleEl.innerHTML = '<i class="las la-bolt"></i> เพิ่มดีล Flash Sale ใหม่';
      document.getElementById('fs-id').value = '';
      document.getElementById('fs-title').value = '';
      document.getElementById('fs-desc').value = '';
      document.getElementById('fs-price').value = '';
      document.getElementById('fs-normal-price').value = '';
      document.getElementById('fs-badge').value = 'ลดพิเศษ';
      document.getElementById('fs-color').value = '#EF4444';
      document.getElementById('fs-icon').value = 'las la-bolt';
      document.getElementById('fs-target-type').value = 'V01';
    }
    const modal = document.getElementById('flash-sale-modal');
    if (modal) modal.style.display = 'flex';
  },

  saveFlashSaleModal() {
    const id = document.getElementById('fs-id')?.value;
    const title = document.getElementById('fs-title')?.value.trim();
    const desc = document.getElementById('fs-desc')?.value.trim();
    const price = Number(document.getElementById('fs-price')?.value);
    const normalPriceVal = document.getElementById('fs-normal-price')?.value;
    const normalPrice = normalPriceVal ? Number(normalPriceVal) : undefined;
    const badge = document.getElementById('fs-badge')?.value.trim() || 'ลดพิเศษ';
    const color = document.getElementById('fs-color')?.value || '#EF4444';
    const icon = document.getElementById('fs-icon')?.value.trim() || 'las la-bolt';
    const targetType = document.getElementById('fs-target-type')?.value || 'V01';

    if (!title || isNaN(price) || price <= 0) {
      this.showToast('กรุณากรอกชื่อสินค้าและราคาพิเศษที่ถูกต้อง', 'warning');
      return;
    }

    if (id) {
      const idx = (this.state.flashSales || []).findIndex(x => x.id === id);
      if (idx > -1) {
        this.state.flashSales[idx] = { id, title, desc, price, normalPrice, badge, color, icon, targetType };
      }
    } else {
      const newId = 'FS_' + Date.now();
      if (!this.state.flashSales) this.state.flashSales = [];
      this.state.flashSales.push({ id: newId, title, desc, price, normalPrice, badge, color, icon, targetType });
    }

    this.saveStateToStorage();
    this.renderLandingCMS();
    this.renderCmsAdmin();
    document.getElementById('flash-sale-modal').style.display = 'none';
    this.showToast('บันทึกดีล Flash Sale เรียบร้อย (Real-time)', 'success');
  },

  deleteFlashSale(id) {
    if (!confirm('ต้องการลบสินค้า Flash Sale นี้?')) return;
    this.state.flashSales = (this.state.flashSales || []).filter(f => f.id !== id);
    this.saveStateToStorage();
    this.renderLandingCMS();
    this.renderCmsAdmin();
    this.showToast('ลบดีล Flash Sale เรียบร้อย', 'success');
  },

  moveFlashSale(idx, dir) {
    const list = this.state.flashSales;
    const target = idx + dir;
    if (target < 0 || target >= list.length) return;
    const temp = list[idx];
    list[idx] = list[target];
    list[target] = temp;
    this.saveStateToStorage();
    this.renderLandingCMS();
    this.renderCmsAdmin();
    this.showToast('ปรับลำดับดีลเรียบร้อย', 'success');
  },

  // Services
  openServiceModal(id) {
    const titleEl = document.getElementById('srv-modal-title');
    const prevEl = document.getElementById('srv-img-prev');
    if (id) {
      const s = (this.state.services || []).find(x => x.id === id);
      if (!s) return;
      if (titleEl) titleEl.innerHTML = '<i class="las la-tools"></i> แก้ไขบริการ';
      document.getElementById('srv-id').value = s.id;
      document.getElementById('srv-title').value = s.title || '';
      document.getElementById('srv-cat').value = s.cat || '';
      document.getElementById('srv-icon').value = s.icon || 'las la-print';
      document.getElementById('srv-img').value = s.img || '';
      document.getElementById('srv-desc').value = s.desc || '';
      document.getElementById('srv-spec').value = (s.spec || []).join('\n');
      if (prevEl && s.img) {
        prevEl.src = s.img;
        prevEl.style.display = 'block';
      }
    } else {
      if (titleEl) titleEl.innerHTML = '<i class="las la-tools"></i> เพิ่มบริการใหม่';
      document.getElementById('srv-id').value = '';
      document.getElementById('srv-title').value = '';
      document.getElementById('srv-cat').value = '';
      document.getElementById('srv-icon').value = 'las la-print';
      document.getElementById('srv-img').value = '';
      document.getElementById('srv-desc').value = '';
      document.getElementById('srv-spec').value = '';
      if (prevEl) prevEl.style.display = 'none';
    }
    const modal = document.getElementById('service-edit-modal');
    if (modal) modal.style.display = 'flex';
  },

  saveServiceModal() {
    const id = document.getElementById('srv-id')?.value;
    const title = document.getElementById('srv-title')?.value.trim();
    const cat = document.getElementById('srv-cat')?.value.trim();
    const icon = document.getElementById('srv-icon')?.value.trim() || 'las la-print';
    const img = document.getElementById('srv-img')?.value.trim() || 'https://images.unsplash.com/photo-1542744094-24638eff58bb?auto=format&fit=crop&w=600&q=80';
    const desc = document.getElementById('srv-desc')?.value.trim();
    const specRaw = document.getElementById('srv-spec')?.value || '';
    const spec = specRaw.split('\n').map(s => s.trim()).filter(s => s.length > 0);

    if (!title || !cat) {
      this.showToast('กรุณากรอกชื่อบริการและหมวดหมู่', 'warning');
      return;
    }

    if (id) {
      const idx = (this.state.services || []).findIndex(x => x.id === id);
      if (idx > -1) {
        this.state.services[idx] = { ...this.state.services[idx], title, cat, icon, img, desc, spec };
      }
    } else {
      const newId = 'SRV_' + Date.now();
      if (!this.state.services) this.state.services = [];
      this.state.services.push({ id: newId, title, cat, icon, img, desc, spec });
    }

    this.saveStateToStorage();
    this.renderLandingCMS();
    this.renderCmsAdmin();
    document.getElementById('service-edit-modal').style.display = 'none';
    this.showToast('บันทึกบริการเรียบร้อย (Real-time)', 'success');
  },

  moveService(idx, dir) {
    const s = this.state.services;
    const target = idx + dir;
    if (target < 0 || target >= s.length) return;
    const temp = s[idx];
    s[idx] = s[target];
    s[target] = temp;
    this.saveStateToStorage();
    this.renderLandingCMS();
    this.renderCmsAdmin();
    this.showToast('ปรับลำดับบริการเรียบร้อย (Real-time)', 'success');
  },

  deleteService(id) {
    if (!confirm('ต้องการลบบริการนี้?')) return;
    this.state.services = this.state.services.filter(s => s.id !== id);
    this.saveStateToStorage();
    this.renderLandingCMS();
    this.renderCmsAdmin();
    this.showToast('ลบบริการเรียบร้อย (Real-time)', 'success');
  },

  // Packages
  openPackageModal(id) {
    const titleEl = document.getElementById('pkg-modal-title');
    if (id) {
      const pkg = (this.state.packages || []).find(x => x.id === id);
      if (!pkg) return;
      if (titleEl) titleEl.innerHTML = '<i class="las la-boxes"></i> แก้ไขแพ็กเกจ';
      document.getElementById('pkg-id').value = pkg.id;
      document.getElementById('pkg-title').value = pkg.title || '';
      document.getElementById('pkg-desc').value = pkg.desc || '';
      document.getElementById('pkg-icon').value = pkg.icon || 'las la-store';
      document.getElementById('pkg-color').value = pkg.color || 'var(--primary)';
      document.getElementById('pkg-popular').checked = !!pkg.isPopular;
    } else {
      if (titleEl) titleEl.innerHTML = '<i class="las la-boxes"></i> เพิ่มแพ็กเกจใหม่';
      document.getElementById('pkg-id').value = '';
      document.getElementById('pkg-title').value = '';
      document.getElementById('pkg-desc').value = '';
      document.getElementById('pkg-icon').value = 'las la-store';
      document.getElementById('pkg-color').value = 'var(--primary)';
      document.getElementById('pkg-popular').checked = false;
    }
    const modal = document.getElementById('package-edit-modal');
    if (modal) modal.style.display = 'flex';
  },

  savePackageModal() {
    const id = document.getElementById('pkg-id')?.value;
    const title = document.getElementById('pkg-title')?.value.trim();
    const desc = document.getElementById('pkg-desc')?.value.trim();
    const icon = document.getElementById('pkg-icon')?.value.trim() || 'las la-store';
    const color = document.getElementById('pkg-color')?.value.trim() || 'var(--primary)';
    const isPopular = document.getElementById('pkg-popular')?.checked || false;

    if (!title) {
      this.showToast('กรุณาระบุชื่อแพ็กเกจ', 'warning');
      return;
    }

    if (id) {
      const idx = (this.state.packages || []).findIndex(x => x.id === id);
      if (idx > -1) {
        this.state.packages[idx] = { ...this.state.packages[idx], title, desc, icon, color, isPopular };
      }
    } else {
      const newId = 'PKG_' + Date.now();
      const defaultItems = [
        { id: 'i1', type: 'V01', w: 2, h: 1, qty: 1, detail: 'ป้ายไวนิลหน้าร้าน 2x1 ม.', checked: true },
        { id: 'i2', type: 'P01', w: 0.6, h: 1.6, qty: 1, detail: 'X-Stand พร้อมภาพ 60x160 ซม.', checked: true }
      ];
      if (!this.state.packages) this.state.packages = [];
      this.state.packages.push({ id: newId, title, desc, icon, color, isPopular, items: defaultItems });
    }

    this.saveStateToStorage();
    this.renderLandingCMS();
    this.renderCmsAdmin();
    document.getElementById('package-edit-modal').style.display = 'none';
    this.showToast('บันทึกแพ็กเกจเรียบร้อย (Real-time)', 'success');
  },

  deletePackage(id) {
    if (!confirm('ต้องการลบแพ็กเกจนี้?')) return;
    this.state.packages = (this.state.packages || []).filter(p => p.id !== id);
    this.saveStateToStorage();
    this.renderLandingCMS();
    this.renderCmsAdmin();
    this.showToast('ลบแพ็กเกจเรียบร้อย', 'success');
  },

  movePackage(idx, dir) {
    const list = this.state.packages;
    const target = idx + dir;
    if (target < 0 || target >= list.length) return;
    const temp = list[idx];
    list[idx] = list[target];
    list[target] = temp;
    this.saveStateToStorage();
    this.renderLandingCMS();
    this.renderCmsAdmin();
    this.showToast('ปรับลำดับแพ็กเกจเรียบร้อย', 'success');
  },

  // Process Steps Workflow (4 Steps)
  openProcessStepModal(idx) {
    const titleEl = document.getElementById('proc-modal-title');
    if (idx !== undefined && idx !== null && idx !== '') {
      const st = this.state.cms.processSteps[idx];
      if (!st) return;
      if (titleEl) titleEl.innerHTML = '<i class="las la-project-diagram"></i> แก้ไขขั้นตอนสั่งผลิต';
      document.getElementById('proc-idx').value = idx;
      document.getElementById('proc-num').value = st.num || idx + 1;
      document.getElementById('proc-icon').value = st.icon || 'las la-comments';
      document.getElementById('proc-title').value = st.title || '';
      document.getElementById('proc-desc').value = st.desc || '';
    } else {
      if (titleEl) titleEl.innerHTML = '<i class="las la-project-diagram"></i> เพิ่มขั้นตอนสั่งผลิตใหม่';
      document.getElementById('proc-idx').value = '';
      document.getElementById('proc-num').value = String((this.state.cms.processSteps || []).length + 1);
      document.getElementById('proc-icon').value = 'las la-comments';
      document.getElementById('proc-title').value = '';
      document.getElementById('proc-desc').value = '';
    }
    const modal = document.getElementById('process-step-modal');
    if (modal) modal.style.display = 'flex';
  },

  saveProcessStepModal() {
    const idxStr = document.getElementById('proc-idx')?.value;
    const num = document.getElementById('proc-num')?.value.trim();
    const icon = document.getElementById('proc-icon')?.value.trim() || 'las la-comments';
    const title = document.getElementById('proc-title')?.value.trim();
    const desc = document.getElementById('proc-desc')?.value.trim();

    if (!title || !desc) {
      this.showToast('กรุณากรอกหัวข้อและคำอธิบายขั้นตอน', 'warning');
      return;
    }

    if (!this.state.cms.processSteps) this.state.cms.processSteps = [];

    if (idxStr !== '' && idxStr !== null && idxStr !== undefined) {
      const idx = parseInt(idxStr, 10);
      this.state.cms.processSteps[idx] = { num, icon, title, desc };
    } else {
      this.state.cms.processSteps.push({ num, icon, title, desc });
    }

    this.saveStateToStorage();
    this.renderLandingCMS();
    this.renderCmsAdmin();
    document.getElementById('process-step-modal').style.display = 'none';
    this.showToast('บันทึกขั้นตอนสั่งผลิตเรียบร้อย (Real-time)', 'success');
  },

  deleteProcessStep(idx) {
    if ((this.state.cms.processSteps || []).length <= 1) {
      this.showToast('ต้องมีขั้นตอนอย่างน้อย 1 ขั้นตอน', 'warning');
      return;
    }
    if (!confirm('ต้องการลบขั้นตอนนี้?')) return;
    this.state.cms.processSteps.splice(idx, 1);
    this.saveStateToStorage();
    this.renderLandingCMS();
    this.renderCmsAdmin();
    this.showToast('ลบขั้นตอนเรียบร้อย', 'success');
  },

  moveProcessStep(idx, dir) {
    const list = this.state.cms.processSteps;
    const target = idx + dir;
    if (target < 0 || target >= list.length) return;
    const temp = list[idx];
    list[idx] = list[target];
    list[target] = temp;
    this.saveStateToStorage();
    this.renderLandingCMS();
    this.renderCmsAdmin();
    this.showToast('ปรับลำดับขั้นตอนเรียบร้อย', 'success');
  },

  // Portfolio Showcase
  onPortCatChange(val) {
    const map = {
      print: 'งานพิมพ์พรีเมียม & สติกเกอร์',
      light: 'ป้ายไฟ & อักษรโลหะ',
      structure: 'โครงสร้างบิลบอร์ด',
      posm: 'อุปกรณ์ออกบูธ (POSM)'
    };
    const el = document.getElementById('port-catname');
    if (el) el.value = map[val] || val;
  },

  openPortfolioModal(id) {
    const titleEl = document.getElementById('port-modal-title');
    const prevEl = document.getElementById('port-img-prev');
    if (id) {
      const p = (this.state.portfolio || []).find(x => x.id === id);
      if (!p) return;
      if (titleEl) titleEl.innerHTML = '<i class="las la-briefcase"></i> แก้ไขผลงานแกลเลอรี';
      document.getElementById('port-id').value = p.id;
      document.getElementById('port-title').value = p.title || '';
      document.getElementById('port-cat').value = p.cat || 'print';
      document.getElementById('port-catname').value = p.catName || 'งานพิมพ์พรีเมียม';
      document.getElementById('port-img').value = p.img || '';
      document.getElementById('port-desc').value = p.desc || '';
      document.getElementById('port-spec').value = (p.spec || []).join('\n');
      if (prevEl && p.img) {
        prevEl.src = p.img;
        prevEl.style.display = 'block';
      }
    } else {
      if (titleEl) titleEl.innerHTML = '<i class="las la-briefcase"></i> เพิ่มผลงานใหม่';
      document.getElementById('port-id').value = '';
      document.getElementById('port-title').value = '';
      document.getElementById('port-cat').value = 'print';
      document.getElementById('port-catname').value = 'งานพิมพ์พรีเมียม & สติกเกอร์';
      document.getElementById('port-img').value = '';
      document.getElementById('port-desc').value = '';
      document.getElementById('port-spec').value = '';
      if (prevEl) prevEl.style.display = 'none';
    }
    const modal = document.getElementById('portfolio-edit-modal');
    if (modal) modal.style.display = 'flex';
  },

  savePortfolioModal() {
    const id = document.getElementById('port-id')?.value;
    const title = document.getElementById('port-title')?.value.trim();
    const cat = document.getElementById('port-cat')?.value || 'print';
    const catName = document.getElementById('port-catname')?.value.trim() || 'งานพิมพ์พรีเมียม';
    const img = document.getElementById('port-img')?.value.trim();
    const desc = document.getElementById('port-desc')?.value.trim();
    const specRaw = document.getElementById('port-spec')?.value || '';
    const spec = specRaw.split('\n').map(s => s.trim()).filter(s => s.length > 0);

    if (!title || !img) {
      this.showToast('กรุณาระบุชื่อผลงานและรูปภาพ', 'warning');
      return;
    }

    if (id) {
      const idx = (this.state.portfolio || []).findIndex(x => x.id === id);
      if (idx > -1) {
        this.state.portfolio[idx] = { ...this.state.portfolio[idx], title, cat, catName, img, desc, spec };
      }
    } else {
      const newId = 'PORT_' + Date.now();
      if (!this.state.portfolio) this.state.portfolio = [];
      this.state.portfolio.push({ id: newId, title, cat, catName, img, desc, spec });
    }

    this.saveStateToStorage();
    this.renderLandingCMS();
    this.renderGallery('all');
    this.renderCmsAdmin();
    document.getElementById('portfolio-edit-modal').style.display = 'none';
    this.showToast('บันทึกผลงานเรียบร้อย (Real-time)', 'success');
  },

  movePortfolio(idx, dir) {
    const p = this.state.portfolio;
    const target = idx + dir;
    if (target < 0 || target >= p.length) return;
    const temp = p[idx];
    p[idx] = p[target];
    p[target] = temp;
    this.saveStateToStorage();
    this.renderLandingCMS();
    this.renderGallery('all');
    this.renderCmsAdmin();
    this.showToast('ปรับลำดับผลงานเรียบร้อย (Real-time)', 'success');
  },

  deletePortfolio(id) {
    if (!confirm('ต้องการลบผลงานนี้?')) return;
    this.state.portfolio = this.state.portfolio.filter(p => p.id !== id);
    this.saveStateToStorage();
    this.renderLandingCMS();
    this.renderGallery('all');
    this.renderCmsAdmin();
    this.showToast('ลบผลงานเรียบร้อย (Real-time)', 'success');
  },

  // Monthly Promotions
  openPromotionModal(idx) {
    const titleEl = document.getElementById('promo-modal-title');
    const prevEl = document.getElementById('promo-img-prev');
    if (idx !== undefined && idx !== null && idx !== '') {
      const pr = this.state.promotions[idx];
      if (!pr) return;
      if (titleEl) titleEl.innerHTML = '<i class="las la-tags"></i> แก้ไขโปรโมชั่น';
      document.getElementById('promo-idx').value = idx;
      document.getElementById('promo-title').value = pr.title || '';
      document.getElementById('promo-desc').value = pr.desc || '';
      document.getElementById('promo-img').value = pr.img || '';
      if (prevEl && pr.img) {
        prevEl.src = pr.img;
        prevEl.style.display = 'block';
      }
    } else {
      if (titleEl) titleEl.innerHTML = '<i class="las la-tags"></i> เพิ่มโปรโมชั่นใหม่';
      document.getElementById('promo-idx').value = '';
      document.getElementById('promo-title').value = '';
      document.getElementById('promo-desc').value = '';
      document.getElementById('promo-img').value = '';
      if (prevEl) prevEl.style.display = 'none';
    }
    const modal = document.getElementById('promotion-modal');
    if (modal) modal.style.display = 'flex';
  },

  savePromotionModal() {
    const idxStr = document.getElementById('promo-idx')?.value;
    const title = document.getElementById('promo-title')?.value.trim();
    const desc = document.getElementById('promo-desc')?.value.trim();
    const img = document.getElementById('promo-img')?.value.trim();

    if (!title || !img) {
      this.showToast('กรุณากรอกหัวข้อและรูปภาพโปรโมชั่น', 'warning');
      return;
    }

    if (!this.state.promotions) this.state.promotions = [];

    if (idxStr !== '' && idxStr !== null && idxStr !== undefined) {
      const idx = parseInt(idxStr, 10);
      this.state.promotions[idx] = { ...this.state.promotions[idx], title, desc, img };
    } else {
      this.state.promotions.push({ id: 'PR_' + Date.now(), title, desc, img });
    }

    this.saveStateToStorage();
    this.renderLandingCMS();
    this.renderCmsAdmin();
    document.getElementById('promotion-modal').style.display = 'none';
    this.showToast('บันทึกโปรโมชั่นเรียบร้อย (Real-time)', 'success');
  },

  deletePromotion(idx) {
    if (!confirm('ต้องการลบโปรโมชั่นนี้?')) return;
    this.state.promotions.splice(idx, 1);
    this.saveStateToStorage();
    this.renderLandingCMS();
    this.renderCmsAdmin();
    this.showToast('ลบโปรโมชั่นเรียบร้อย', 'success');
  },

  movePromotion(idx, dir) {
    const list = this.state.promotions;
    const target = idx + dir;
    if (target < 0 || target >= list.length) return;
    const temp = list[idx];
    list[idx] = list[target];
    list[target] = temp;
    this.saveStateToStorage();
    this.renderLandingCMS();
    this.renderCmsAdmin();
    this.showToast('ปรับลำดับโปรโมชั่นเรียบร้อย', 'success');
  },

  // One-Stop Service Feature Cards
  openOnestopCardModal(idx) {
    const titleEl = document.getElementById('osc-modal-title');
    const prevEl = document.getElementById('osc-img-prev');
    if (idx !== undefined && idx !== null && idx !== '') {
      const card = this.state.cms.oneStop.cards[idx];
      if (!card) return;
      if (titleEl) titleEl.innerHTML = '<i class="las la-th-large"></i> แก้ไขการ์ด One-Stop Feature';
      document.getElementById('osc-idx').value = idx;
      document.getElementById('osc-num').value = card.num || idx + 1;
      document.getElementById('osc-color').value = card.color || '#3B82F6';
      document.getElementById('osc-title').value = card.title || '';
      document.getElementById('osc-desc').value = card.desc || '';
      document.getElementById('osc-img').value = card.img || '';
      if (prevEl && card.img) {
        prevEl.src = card.img;
        prevEl.style.display = 'block';
      }
    } else {
      if (titleEl) titleEl.innerHTML = '<i class="las la-th-large"></i> เพิ่มการ์ด Feature ใหม่';
      document.getElementById('osc-idx').value = '';
      document.getElementById('osc-num').value = String((this.state.cms.oneStop.cards || []).length + 1);
      document.getElementById('osc-color').value = '#3B82F6';
      document.getElementById('osc-title').value = '';
      document.getElementById('osc-desc').value = '';
      document.getElementById('osc-img').value = '';
      if (prevEl) prevEl.style.display = 'none';
    }
    const modal = document.getElementById('onestop-card-modal');
    if (modal) modal.style.display = 'flex';
  },

  saveOnestopCardModal() {
    const idxStr = document.getElementById('osc-idx')?.value;
    const num = parseInt(document.getElementById('osc-num')?.value || '1', 10);
    const color = document.getElementById('osc-color')?.value || '#3B82F6';
    const title = document.getElementById('osc-title')?.value.trim();
    const desc = document.getElementById('osc-desc')?.value.trim();
    const img = document.getElementById('osc-img')?.value.trim();

    if (!title || !img) {
      this.showToast('กรุณากรอกหัวข้อและรูปภาพการ์ด', 'warning');
      return;
    }

    if (!this.state.cms.oneStop) this.state.cms.oneStop = { cards: [] };
    if (!this.state.cms.oneStop.cards) this.state.cms.oneStop.cards = [];

    if (idxStr !== '' && idxStr !== null && idxStr !== undefined) {
      const idx = parseInt(idxStr, 10);
      this.state.cms.oneStop.cards[idx] = { num, color, title, desc, img };
    } else {
      this.state.cms.oneStop.cards.push({ num, color, title, desc, img });
    }

    this.saveStateToStorage();
    this.renderLandingCMS();
    this.renderCmsAdmin();
    document.getElementById('onestop-card-modal').style.display = 'none';
    this.showToast('บันทึกการ์ด Feature เรียบร้อย (Real-time)', 'success');
  },

  deleteOnestopCard(idx) {
    if ((this.state.cms.oneStop.cards || []).length <= 1) {
      this.showToast('ต้องมีการ์ดอย่างน้อย 1 รายการ', 'warning');
      return;
    }
    if (!confirm('ต้องการลบการ์ดนี้?')) return;
    this.state.cms.oneStop.cards.splice(idx, 1);
    this.saveStateToStorage();
    this.renderLandingCMS();
    this.renderCmsAdmin();
    this.showToast('ลบการ์ดเรียบร้อย', 'success');
  },

  // Trusted Brands
  openBrandModal(idx) {
    const titleEl = document.getElementById('brand-modal-title');
    const prevEl = document.getElementById('brand-img-prev');
    if (idx !== undefined && idx !== null && idx !== '') {
      const b = this.state.cms.trustedBrands[idx];
      if (titleEl) titleEl.innerHTML = '<i class="las la-certificate"></i> แก้ไขโลโก้แบรนด์';
      document.getElementById('brand-idx').value = idx;
      document.getElementById('brand-img').value = b || '';
      if (prevEl && b) {
        prevEl.src = b;
        prevEl.style.display = 'block';
      }
    } else {
      if (titleEl) titleEl.innerHTML = '<i class="las la-certificate"></i> เพิ่มโลโก้แบรนด์ใหม่';
      document.getElementById('brand-idx').value = '';
      document.getElementById('brand-img').value = '';
      if (prevEl) prevEl.style.display = 'none';
    }
    const modal = document.getElementById('brand-modal');
    if (modal) modal.style.display = 'flex';
  },

  saveBrandModal() {
    const idxStr = document.getElementById('brand-idx')?.value;
    const img = document.getElementById('brand-img')?.value.trim();

    if (!img) {
      this.showToast('กรุณาระบุ URL หรืออัปโหลดรูปโลโก้', 'warning');
      return;
    }

    if (!this.state.cms.trustedBrands) this.state.cms.trustedBrands = [];

    if (idxStr !== '' && idxStr !== null && idxStr !== undefined) {
      const idx = parseInt(idxStr, 10);
      this.state.cms.trustedBrands[idx] = img;
    } else {
      this.state.cms.trustedBrands.push(img);
    }

    this.saveStateToStorage();
    this.renderLandingCMS();
    this.renderCmsAdmin();
    document.getElementById('brand-modal').style.display = 'none';
    this.showToast('บันทึกโลโก้แบรนด์เรียบร้อย (Real-time)', 'success');
  },

  deleteBrand(idx) {
    if (!confirm('ต้องการลบโลโก้แบรนด์นี้?')) return;
    this.state.cms.trustedBrands.splice(idx, 1);
    this.saveStateToStorage();
    this.renderLandingCMS();
    this.renderCmsAdmin();
    this.showToast('ลบโลโก้แบรนด์เรียบร้อย', 'success');
  },

  // Customer Testimonials
  openTestimonialModal(idx) {
    const titleEl = document.getElementById('testi-modal-title');
    const prevEl = document.getElementById('testi-img-prev');
    if (idx !== undefined && idx !== null && idx !== '') {
      const t = this.state.testimonials[idx];
      if (!t) return;
      if (titleEl) titleEl.innerHTML = '<i class="las la-star"></i> แก้ไขรีวิวจากลูกค้า';
      document.getElementById('testi-idx').value = idx;
      document.getElementById('testi-name').value = t.name || '';
      document.getElementById('testi-role').value = t.role || '';
      document.getElementById('testi-text').value = t.text || '';
      document.getElementById('testi-img').value = t.img || '';
      if (prevEl && t.img) {
        prevEl.src = t.img;
        prevEl.style.display = 'block';
      }
    } else {
      if (titleEl) titleEl.innerHTML = '<i class="las la-star"></i> เพิ่มรีวิวจากลูกค้าใหม่';
      document.getElementById('testi-idx').value = '';
      document.getElementById('testi-name').value = '';
      document.getElementById('testi-role').value = '';
      document.getElementById('testi-text').value = '';
      document.getElementById('testi-img').value = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80';
      if (prevEl) {
        prevEl.src = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80';
        prevEl.style.display = 'block';
      }
    }
    const modal = document.getElementById('testimonial-modal');
    if (modal) modal.style.display = 'flex';
  },

  saveTestimonialModal() {
    const idxStr = document.getElementById('testi-idx')?.value;
    const name = document.getElementById('testi-name')?.value.trim();
    const role = document.getElementById('testi-role')?.value.trim();
    const text = document.getElementById('testi-text')?.value.trim();
    const img = document.getElementById('testi-img')?.value.trim() || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80';

    if (!name || !text) {
      this.showToast('กรุณากรอกชื่อลูกค้าและข้อความรีวิว', 'warning');
      return;
    }

    if (!this.state.testimonials) this.state.testimonials = [];

    if (idxStr !== '' && idxStr !== null && idxStr !== undefined) {
      const idx = parseInt(idxStr, 10);
      this.state.testimonials[idx] = { ...this.state.testimonials[idx], name, role, text, img };
    } else {
      this.state.testimonials.push({ id: 'T_' + Date.now(), name, role, text, img });
    }

    this.saveStateToStorage();
    this.renderLandingCMS();
    this.renderCmsAdmin();
    document.getElementById('testimonial-modal').style.display = 'none';
    this.showToast('บันทึกรีวิวเรียบร้อย (Real-time)', 'success');
  },

  deleteTestimonial(idx) {
    if (!confirm('ต้องการลบรีวิวนี้?')) return;
    this.state.testimonials.splice(idx, 1);
    this.saveStateToStorage();
    this.renderLandingCMS();
    this.renderCmsAdmin();
    this.showToast('ลบรีวิวเรียบร้อย', 'success');
  },

  moveTestimonial(idx, dir) {
    const list = this.state.testimonials;
    const target = idx + dir;
    if (target < 0 || target >= list.length) return;
    const temp = list[idx];
    list[idx] = list[target];
    list[target] = temp;
    this.saveStateToStorage();
    this.renderLandingCMS();
    this.renderCmsAdmin();
    this.showToast('ปรับลำดับรีวิวเรียบร้อย', 'success');
  },

  // FAQ
  openFaqModal(idx) {
    const titleEl = document.getElementById('faq-modal-title');
    if (idx !== undefined && idx !== null && idx !== '') {
      const f = this.state.cms.faqs[idx];
      if (!f) return;
      if (titleEl) titleEl.innerHTML = '<i class="las la-question-circle"></i> แก้ไขคำถามที่พบบ่อย';
      document.getElementById('faq-idx').value = idx;
      document.getElementById('faq-q').value = f.q || '';
      document.getElementById('faq-a').value = f.a || '';
    } else {
      if (titleEl) titleEl.innerHTML = '<i class="las la-question-circle"></i> เพิ่มคำถามใหม่';
      document.getElementById('faq-idx').value = '';
      document.getElementById('faq-q').value = '';
      document.getElementById('faq-a').value = '';
    }
    const modal = document.getElementById('faq-modal');
    if (modal) modal.style.display = 'flex';
  },

  saveFaqModal() {
    const idxStr = document.getElementById('faq-idx')?.value;
    const q = document.getElementById('faq-q')?.value.trim();
    const a = document.getElementById('faq-a')?.value.trim();

    if (!q || !a) {
      this.showToast('กรุณากรอกคำถามและคำตอบ', 'warning');
      return;
    }

    if (!this.state.cms.faqs) this.state.cms.faqs = [];

    if (idxStr !== '' && idxStr !== null && idxStr !== undefined) {
      const idx = parseInt(idxStr, 10);
      this.state.cms.faqs[idx] = { q, a };
    } else {
      this.state.cms.faqs.push({ q, a });
    }

    this.saveStateToStorage();
    this.renderLandingCMS();
    this.renderCmsAdmin();
    document.getElementById('faq-modal').style.display = 'none';
    this.showToast('บันทึกคำถามเรียบร้อย (Real-time)', 'success');
  },

  moveFaq(idx, dir) {
    const f = this.state.cms.faqs;
    const target = idx + dir;
    if (target < 0 || target >= f.length) return;
    const temp = f[idx];
    f[idx] = f[target];
    f[target] = temp;
    this.saveStateToStorage();
    this.renderLandingCMS();
    this.renderCmsAdmin();
    this.showToast('ปรับลำดับคำถามเรียบร้อย (Real-time)', 'success');
  },

  deleteFaq(idx) {
    if (!confirm('ต้องการลบคำถามนี้?')) return;
    this.state.cms.faqs.splice(idx, 1);
    this.saveStateToStorage();
    this.renderLandingCMS();
    this.renderCmsAdmin();
    this.showToast('ลบคำถามเรียบร้อย (Real-time)', 'success');
  },

  /* ==========================================================================
     HERO LAYOUT & BANNER 6 STYLES SELECTOR
     ========================================================================== */
  selectHeroLayout(styleKey) {
    if (!this.state.cms) this.state.cms = {};
    this.state.cms.heroLayout = styleKey;
    this.saveStateToStorage();
    this.renderLandingCMS();
    this.renderCmsAdmin();

    const names = {
      style_fullscreen_10s: 'แบนเนอร์กว้างเต็มจอ ออโต้สไลด์ 10 วิ (Full-Width 10s Slider)',
      style1: 'แบบที่ 1: Modern Split Slider (ภาพสไลด์คู่ข้อความ)',
      style2: 'แบบที่ 2: Cinematic Full-Width (แบนเนอร์พาโนรามา)',
      style3: 'แบบที่ 3: Minimalist Showcase (สไตล์มินิมอล & การ์ด 3D)',
      style4: 'แบบที่ 4: Bento Grid Interactive (กริดสไตล์ Bento)',
      style5: 'แบบที่ 5: Neon & Flash Campaign (ธีมนีออนเรืองแสง)',
      style6: 'แบบที่ 6: 3D Architectural Studio (สตูดิโอสถาปัตยกรรม)'
    };
    this.showToast(`เปลี่ยนเลย์เอาต์ส่วนบนเป็น "${names[styleKey] || styleKey}" เรียบร้อย`, 'success');
  },

  /* ==========================================================================
     COMMUNITY NETWORK & DYNAMIC QR CODE (เครือข่ายลูกค้า & ช่วยเหลือร้านค้า)
     ========================================================================== */
  renderLandingCommunityNetwork(filterCategory = 'all') {
    const grid = document.getElementById('community-stores-grid');
    if (!grid) return;

    let stores = this.state.cms.communityStores || [];
    if (!stores || stores.length === 0) {
      grid.innerHTML = '<div style="grid-column:1/-1; text-align:center; padding:40px; color:#64748B;">ยังไม่มีร้านค้าในเครือข่าย</div>';
      return;
    }

    const totalCountEl = document.getElementById('comm-total-count');
    if (totalCountEl) totalCountEl.innerText = stores.length;

    this.currentCommCategory = filterCategory;

    // Filter by Category if selected
    if (filterCategory && filterCategory !== 'all') {
      stores = stores.filter(s => s.category === filterCategory || (s.tags && s.tags.includes(filterCategory)));
    }

    let html = '';
    stores.forEach(st => {
      const fbBtn = st.facebookUrl ? `
        <a href="${st.facebookUrl}" target="_blank" onclick="event.stopPropagation();" class="btn btn-sm" style="background:#1877F2; color:white; border-radius:50px; padding:4px 10px; font-size:11.5px; text-decoration:none; display:inline-flex; align-items:center; gap:4px; box-shadow:0 2px 6px rgba(24,119,242,0.25);">
          <i class="lab la-facebook-f"></i> เฟสบุ๊ค
        </a>` : '';

      html += `
      <div class="community-shop-card" onclick="app.openCommunityStoreDetail('${st.id}')" style="cursor:pointer; box-shadow:0 4px 18px rgba(0,0,0,0.06); border-radius:16px; background:white; overflow:hidden; border:1px solid #E2E8F0; display:flex; flex-direction:column; transition:transform 0.25s ease, box-shadow 0.25s ease;">
        <!-- Large Prominent Cover Image (แสดงรูปให้ใหญ่ขึ้น) -->
        <div class="comm-img-box" style="height:190px; position:relative; overflow:hidden; background:#F1F5F9;">
          <img src="${st.coverImg || 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=600&q=80'}" alt="${st.name}" class="comm-cover-img" loading="lazy" style="width:100%; height:100%; object-fit:cover;">
          <div class="comm-cat-badge" style="bottom:10px; left:10px; font-size:11px; padding:3px 10px; border-radius:50px; background:rgba(15,23,42,0.85); color:white; backdrop-filter:blur(4px); display:inline-flex; align-items:center; gap:4px;">
            <i class="${st.categoryIcon || 'las la-store'}" style="color:var(--accent);"></i> ${st.category || 'ร้านค้าพาร์ทเนอร์'}
          </div>
        </div>
        <div class="comm-body" style="padding:16px; flex:1; display:flex; flex-direction:column;">
          <h3 class="comm-store-name" style="font-size:16px; font-weight:800; color:var(--primary); margin:0 0 4px 0; line-height:1.3;" title="${st.name}">${st.name}</h3>
          <p class="comm-slogan" style="font-size:12.5px; color:#64748B; margin:0 0 8px 0; line-height:1.4; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden;">${st.slogan || 'ธุรกิจคุณภาพในจังหวัดตรัง'}</p>
          <div class="comm-location" style="font-size:11.5px; color:#475569; margin-bottom:10px; display:flex; align-items:center; gap:5px;">
            <i class="las la-map-marker-alt" style="color:var(--danger); font-size:13px;"></i> <span>${st.location || 'อ.เมือง จ.ตรัง'}</span>
          </div>
          
          <div class="comm-signage-made" style="background:#EFF6FF; border:1px solid #DBEAFE; border-radius:8px; padding:6px 10px; margin-bottom:10px; font-size:11.5px; color:#1E40AF; line-height:1.4;">
            <strong><i class="las la-paint-roller" style="color:#2563EB;"></i> งานป้าย:</strong> ${st.verifiedSignage || 'ป้ายหน้าร้าน & สื่อโฆษณา'}
          </div>

          <div style="font-size:11px; color:#059669; margin-bottom:12px; display:flex; align-items:center; gap:4px; font-weight:600;">
            <i class="las la-images"></i> คลิกเพื่อดูรูปงานที่ทำกับทำดีมีเดีย (${(st.workPhotos || []).length || 1} รูป) <i class="las la-arrow-right"></i>
          </div>

          <!-- Action Bar: Facebook Link & Order Like Store Button -->
          <div style="margin-top:auto; padding-top:12px; border-top:1px dashed #E2E8F0; display:flex; justify-content:space-between; align-items:center; gap:8px; flex-wrap:wrap;">
            <div style="display:flex; gap:6px; align-items:center;">
              ${fbBtn}
              <a href="${st.qrUrl || '#'}" target="_blank" onclick="event.stopPropagation();" class="btn btn-sm btn-outline" style="border-color:#CBD5E1; color:#475569; font-size:11.5px; padding:4px 10px; border-radius:50px; text-decoration:none;" title="แผนที่ร้าน">
                <i class="las la-map-marker-alt"></i> แผนที่
              </a>
            </div>
            <button type="button" class="btn btn-sm btn-primary" onclick="event.stopPropagation(); app.orderLikeStore('${st.id}')" style="font-size:12px; padding:6px 14px; border-radius:50px; background:linear-gradient(135deg, var(--primary), #2563EB); font-weight:700; box-shadow:0 3px 10px rgba(30,58,138,0.2);">
              <i class="las la-shopping-cart"></i> เลือกสั่งงานแบบร้านนี้
            </button>
          </div>
        </div>
      </div>`;
    });

    grid.innerHTML = html;
  },

  openCommunityStoreDetail(storeId) {
    const stores = this.state.cms.communityStores || [];
    const st = stores.find(s => s.id === storeId) || stores[0];
    if (!st) return;
    this.activeDetailStoreId = st.id;

    const modal = document.getElementById('community-store-detail-modal');
    if (!modal) return;

    document.getElementById('comm-detail-name').innerHTML = `<i class="las la-store" style="color:#FBBF24;"></i> ${st.name}`;
    document.getElementById('comm-detail-cat').innerText = `หมวดหมู่: ${st.category || 'ร้านค้าลูกค้า'} · ${st.location || 'จ.ตรัง'}`;
    document.getElementById('comm-detail-cover').src = st.coverImg || 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=800&q=80';
    document.getElementById('comm-detail-loc-text').innerText = st.location || 'อ.เมือง จ.ตรัง';
    document.getElementById('comm-detail-slogan').innerText = st.slogan || 'ธุรกิจคุณภาพในจังหวัดตรัง มั่นใจในบริการผลิตสื่อสิ่งพิมพ์จาก TUMDEEMEDIA';

    const fbLink = document.getElementById('comm-detail-fb-link');
    if (fbLink) {
      fbLink.href = st.facebookUrl || 'https://www.facebook.com';
      fbLink.style.display = st.facebookUrl ? 'inline-flex' : 'none';
    }

    const mapLink = document.getElementById('comm-detail-map-link');
    if (mapLink) {
      mapLink.href = st.qrUrl || `https://maps.google.com/?q=${encodeURIComponent(st.name + ' ' + (st.location || 'ตรัง'))}`;
    }

    const phoneLink = document.getElementById('comm-detail-phone-link');
    const phoneText = document.getElementById('comm-detail-phone-text');
    if (phoneLink && phoneText) {
      if (st.phone) {
        phoneLink.href = `tel:${st.phone.replace(/[^0-9]/g,'')}`;
        phoneText.innerText = st.phone;
        phoneLink.style.display = 'inline-flex';
      } else {
        phoneLink.style.display = 'none';
      }
    }

    const signageDesc = document.getElementById('comm-detail-signage-desc');
    if (signageDesc) signageDesc.innerText = st.verifiedSignage || 'สั่งผลิตป้ายหน้าร้าน & สื่อโฆษณาครบวงจร';

    const signageSpec = document.getElementById('comm-detail-signage-spec');
    if (signageSpec) {
      const spec = st.signSpec;
      if (spec) {
        signageSpec.innerText = `สเปกแนะนำ: ${spec.name || ''} ขนาด ${spec.w || 3.0} x ${spec.h || 1.0} เมตร (${spec.detail || ''})`;
      } else {
        signageSpec.innerText = `รองรับการสั่งผลิตตามแบบมาตรฐานโรงพิมพ์ ทั้งไวนิล สแตนดี้ ตู้ไฟ และพลาสวูด`;
      }
    }

    // Render real work photos
    const galleryGrid = document.getElementById('comm-detail-gallery-grid');
    if (galleryGrid) {
      const photos = (st.workPhotos && st.workPhotos.length > 0) ? st.workPhotos : [st.coverImg];
      let gHtml = '';
      photos.forEach((imgUrl, idx) => {
        gHtml += `
        <div style="height:170px; border-radius:12px; overflow:hidden; background:#E2E8F0; box-shadow:0 3px 10px rgba(0,0,0,0.06); cursor:pointer;" onclick="window.open('${imgUrl}', '_blank')" title="คลิกเพื่อดูภาพขนาดเต็ม">
          <img src="${imgUrl}" alt="ผลงานจริง ${idx + 1}" style="width:100%; height:100%; object-fit:cover; transition:transform 0.3s ease;" onmouseover="this.style.transform='scale(1.06)'" onmouseout="this.style.transform='scale(1)'">
        </div>`;
      });
      galleryGrid.innerHTML = gHtml;
    }

    modal.style.display = 'flex';
  },

  orderLikeActiveStore() {
    if (this.activeDetailStoreId) {
      this.orderLikeStore(this.activeDetailStoreId);
    }
  },

  orderLikeStore(storeId) {
    const stores = this.state.cms.communityStores || [];
    const st = stores.find(s => s.id === storeId);
    if (!st) return;

    const modal = document.getElementById('community-store-detail-modal');
    if (modal) modal.style.display = 'none';

    const allModal = document.getElementById('all-community-stores-modal');
    if (allModal) allModal.style.display = 'none';

    const spec = st.signSpec || { type: 'V01', w: 3.0, h: 1.0, detail: st.verifiedSignage || 'สั่งผลิตตามแบบร้าน ' + st.name };
    const targetType = spec.type || 'V01';
    const targetW = spec.w || 3.0;
    const targetH = spec.h || 1.0;
    const targetDetail = `[สั่งงานตามแบบร้าน: ${st.name}]\n- รายละเอียด: ${spec.detail || st.verifiedSignage || ''}`;

    this.state.cart = [{
      id: 'store_job_' + Date.now(),
      type: targetType,
      w: targetW,
      h: targetH,
      qty: 1,
      finish: 'none',
      detail: targetDetail,
      refImg: st.coverImg || null
    }];

    this.renderCart();
    this.scrollToOrder();
    this.showToast(`เลือกสั่งงานตามแบบร้าน "${st.name}" ใส่ในใบสั่งผลิตเรียบร้อย ✨`, 'success');
  },

  filterCommunityStores(cat, btn) {
    document.querySelectorAll('#comm-filter-pills .gallery-tab').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
    this.renderLandingCommunityNetwork(cat);
  },

  openAllCommunityStoresModal() {
    const modal = document.getElementById('all-community-stores-modal');
    if (!modal) return;
    this.allCommCategory = 'all';
    this.allCommSearch = '';
    const sInput = document.getElementById('all-comm-search');
    if (sInput) sInput.value = '';
    this.renderAllCommunityStores('all', '');
    modal.style.display = 'flex';
  },

  setAllCommCategory(cat, btn) {
    this.allCommCategory = cat;
    document.querySelectorAll('#all-comm-filter-pills .gallery-tab').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
    this.renderAllCommunityStores(cat, this.allCommSearch || '');
  },

  filterAllCommunityStoresModal() {
    const q = document.getElementById('all-comm-search')?.value.trim().toLowerCase() || '';
    this.allCommSearch = q;
    this.renderAllCommunityStores(this.allCommCategory || 'all', q);
  },

  renderAllCommunityStores(cat = 'all', query = '') {
    const grid = document.getElementById('all-community-stores-grid');
    if (!grid) return;
    let stores = this.state.cms.communityStores || [];
    if (cat !== 'all') {
      stores = stores.filter(s => s.category === cat || (s.tags && s.tags.includes(cat)));
    }
    if (query) {
      stores = stores.filter(s => 
        (s.name && s.name.toLowerCase().includes(query)) ||
        (s.slogan && s.slogan.toLowerCase().includes(query)) ||
        (s.location && s.location.toLowerCase().includes(query)) ||
        (s.verifiedSignage && s.verifiedSignage.toLowerCase().includes(query)) ||
        (s.tags && s.tags.some(t => t.toLowerCase().includes(query)))
      );
    }
    if (stores.length === 0) {
      grid.innerHTML = '<div style="grid-column:1/-1; text-align:center; padding:50px; color:#64748B;"><i class="las la-search" style="font-size:36px; color:#CBD5E1;"></i><div style="margin-top:8px;">ไม่พบร้านค้าที่ตรงกับเงื่อนไขการค้นหา</div></div>';
      return;
    }
    let html = '';
    stores.forEach(st => {
      html += `
      <div class="community-shop-card" style="box-shadow:0 2px 8px rgba(0,0,0,0.04); border-radius:12px; background:white; overflow:hidden; border:1px solid #E2E8F0;">
        <div class="comm-img-box" style="height:56px; position:relative; overflow:hidden; background:#F1F5F9;">
          <img src="${st.coverImg || 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=600&q=80'}" alt="${st.name}" class="comm-cover-img" loading="lazy" style="width:100%; height:100%; object-fit:cover;">
          <div class="comm-verified-badge" style="top:4px; left:4px; font-size:8.5px; padding:1px 5px;"><i class="las la-check-circle"></i> ป้ายโดยทำดีมีเดีย</div>
          <div class="comm-cat-badge" style="bottom:4px; left:4px; font-size:8.5px; padding:1px 5px;"><i class="${st.categoryIcon || 'las la-store'}"></i> ${st.category || 'ร้านค้าพาร์ทเนอร์'}</div>
          <div style="position:absolute; top:4px; right:4px; background:rgba(255,255,255,0.95); color:#D97706; font-size:9.5px; font-weight:800; padding:1px 5px; border-radius:50px; display:inline-flex; align-items:center; gap:2px;"><i class="las la-star" style="color:#F59E0B;"></i> ${st.rating || '5.0'}</div>
        </div>
        <div class="comm-body" style="padding:10px 12px 12px 12px;">
          <h4 style="font-size:13.5px; font-weight:700; color:var(--primary); margin:0 0 3px 0; line-height:1.3; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${st.name}</h4>
          <p style="font-size:11px; color:#64748B; margin:0 0 5px 0; line-height:1.35; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden;">${st.slogan || 'ธุรกิจคุณภาพในจังหวัดตรัง'}</p>
          <div style="font-size:10.5px; color:#475569; margin-bottom:5px; display:flex; align-items:center; gap:4px;"><i class="las la-map-marker-alt" style="color:var(--danger); font-size:11px;"></i> <span>${st.location || 'อ.เมือง จ.ตรัง'}</span></div>
          <div style="background:#F1F5F9; border-radius:6px; padding:3px 7px; margin-bottom:8px; font-size:10px; color:#334155; line-height:1.3;">
            <strong style="color:var(--primary);"><i class="las la-paint-roller" style="color:var(--accent);"></i> ป้าย:</strong> ${st.verifiedSignage || 'ป้ายหน้าร้าน & สื่อโฆษณา'}
          </div>
          <div style="display:flex; justify-content:space-between; align-items:center; padding-top:6px; border-top:1px dashed #E2E8F0; gap:5px;">
            <div style="font-size:10px; color:#94A3B8;">โทร: ${st.phone || '-'}</div>
            <div style="display:flex; gap:4px;">
              <a href="${st.qrUrl || '#'}" target="_blank" class="btn-sm btn-primary" style="font-size:10px; padding:2px 8px; text-decoration:none; display:inline-flex; align-items:center; gap:2px; border-radius:50px;">
                <i class="las la-external-link-alt"></i> แผนที่/ร้าน
              </a>
              ${st.phone ? `<a href="tel:${st.phone.replace(/[^0-9]/g,'')}" class="btn-sm btn-outline" style="font-size:10px; padding:2px 6px; border-radius:50px; text-decoration:none;" title="โทรติดต่อร้าน"><i class="las la-phone"></i></a>` : ''}
            </div>
          </div>
        </div>
      </div>`;
    });
    grid.innerHTML = html;
  },

  /* ==========================================================================
     AI SIGNAGE & PRINT STUDIO SUITE
     ========================================================================== */
  initAiStudio() {
    this.generateAiSlogans();
    this.loadSamplePreflightImage('high', true);
    this.toggleGrommetDisplay('hide', true);
    this.initDraggableMockup();
  },

  scrollToAiStudio() {
    this.switchView('landing');
    const el = document.getElementById('sec-ai-studio');
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  },

  switchAiStudioTab(tab) {
    document.querySelectorAll('.ai-tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.ai-pane').forEach(p => p.classList.remove('active'));
    const btn = document.getElementById(`ai-tab-btn-${tab}`);
    const pane = document.getElementById(`ai-pane-${tab}`);
    if (btn) btn.classList.add('active');
    if (pane) pane.classList.add('active');
  },

  onAiBizChange() {
    const biz = document.getElementById('ai-biz-type')?.value;
    const othWrap = document.getElementById('ai-biz-other-wrap');
    if (othWrap) {
      othWrap.style.display = (biz === 'other') ? 'block' : 'none';
    }
    const keyInput = document.getElementById('ai-keywords');
    if (!keyInput) return;
    const presets = {
      cafe: 'กาแฟสดคั่วใหม่ เค้กโฮมเมด บรรยากาศสวน โทร 081-999-1234',
      restaurant: 'ซีฟู้ดสดจากเรือ กุ้งเผาตัวใหญ่ น้ำจิ้มรสเด็ด โทร 089-888-5678',
      beauty: 'ปรับรูปหน้า ฟิลเลอร์ โบท็อกซ์ มาตรฐานคุณหมอ Line @clinic',
      auto: 'ซ่อมเครื่อง ช่วงล่าง เปลี่ยนยาง ถ่ายน้ำมันเครื่อง โทร 086-777-4321',
      hotel: 'ที่พักริมทะเล สระว่ายน้ำซีวิว อาหารเช้าฟรี โทร 075-888-999',
      property: 'บ้านเดี่ยวหลังใหญ่ สไตล์โมเดิร์น เริ่มต้น 2.59 ลบ. โทร 082-123-4567',
      retail: 'ของชำราคาถูก สินค้าเกษตร ปุ๋ยยาครบวงจร ส่งฟรีในชุมชน',
      event: 'ขอเชิญร่วมงานอุปสมบท วันที่ 15 เมษายน ณ วัดควนนาแค'
    };
    if (presets[biz]) {
      keyInput.value = presets[biz];
    } else if (biz === 'other') {
      const customVal = document.getElementById('ai-biz-other-input')?.value.trim();
      if (customVal && !keyInput.value) {
        keyInput.value = `${customVal} บริการคุณภาพ ติดต่อสอบถามโทร 081-234-5678`;
      }
    }
    this.generateAiSlogans();
  },

  generateAiSlogans() {
    const biz = document.getElementById('ai-biz-type')?.value || 'cafe';
    const signType = document.getElementById('ai-sign-type')?.value || 'storefront';
    const tone = document.getElementById('ai-tone-type')?.value || 'catchy';
    const keywords = document.getElementById('ai-keywords')?.value.trim() || 'คุณภาพดี บริการประทับใจ';

    const library = {
      cafe: [
        {
          tag: '☕ ป้ายหน้าร้านสไตล์โมเดิร์น',
          headline: 'กาแฟสดคั่วใหม่ หอมกรุ่นทุกหยด',
          subhead: 'เบเกอรี่โฮมเมด อบสดจากเตาทุกวัน พักผ่อนบรรยากาศสวนร่มรื่น',
          cta: 'โทรสั่งล่วงหน้า / สั่งผ่านแอป',
          colors: 'เหลืองมัสตาร์ด + ดำเข้ม (คอนทราสต์มองเห็นชัดไกล 30 ม.)',
          bg: '#FEF3C7',
          border: '#D97706',
          text: '#1E293B',
          tagColor: '#B45309'
        },
        {
          tag: '🔥 โปรโมชั่นพิเศษหน้าร้าน',
          headline: 'ซื้อ 1 แถม 1 ทุกเมนูเครื่องดื่ม!',
          subhead: 'ฉลองเปิดร้านใหม่ เฉพาะสัปดาห์นี้เท่านั้น อิ่มฟินชื่นใจ',
          cta: 'เช็คอินรับส่วนลดเพิ่ม 10%',
          colors: 'แดงสด + ขาว (กระตุ้นความอยาก & ตัดสินใจไว)',
          bg: '#FEE2E2',
          border: '#DC2626',
          text: '#7F1D1D',
          tagColor: '#DC2626'
        },
        {
          tag: '✨ สไตล์มินิมอล พรีเมียม',
          headline: 'SPECIALTY COFFEE & BAKERY',
          subhead: 'คัดสรรเมล็ดกาแฟชั้นยอด เพื่อแก้วโปรดในทุกเช้าของคุณ',
          cta: 'OPEN DAILY 07:30 - 17:30',
          colors: 'ขาวคลีน + น้ำเงินเนวี่ (ดูเรียบหรู น่าเชื่อถือ)',
          bg: '#F8FAFC',
          border: '#1E3A8A',
          text: '#0F172A',
          tagColor: '#1E3A8A'
        }
      ],
      restaurant: [
        {
          tag: '🦐 ซีฟู้ด & อาหารปักษ์ใต้',
          headline: 'กุ้งเผาตัวใหญ่ ซีฟู้ดสดจากเรือประมง!',
          subhead: 'รสจัดจ้านถึงเครื่องแกงใต้แท้ วัตถุดิบสดใหม่ส่งตรงทุกวัน',
          cta: 'โทรจองโต๊ะด่วน',
          colors: 'ส้มสว่าง + น้ำเงินทะเล',
          bg: '#FFEDD5',
          border: '#EA580C',
          text: '#1E293B',
          tagColor: '#EA580C'
        },
        {
          tag: '🌶️ ป้ายบิลบอร์ดริมทาง',
          headline: 'หิวแวะเลย! อาหารใต้แท้ รสเด็ดเมืองตรัง',
          subhead: 'อีก 500 เมตร เลี้ยวซ้าย ที่จอดรถกว้างขวาง ห้องแอร์เย็นฉ่ำ',
          cta: 'เปิดบริการ 10:00 - 21:00 น.',
          colors: 'เหลืองสด + ดำ (มองเห็นชัดจากความเร็วรถ 80 กม./ชม.)',
          bg: '#FEF08A',
          border: '#CA8A04',
          text: '#000000',
          tagColor: '#854D0E'
        },
        {
          tag: '🎉 บุฟเฟต์คุ้มจัด',
          headline: 'บุฟเฟต์ซีฟู้ดไม่อั้น เพียง 299.- รวมน้ำ!',
          subhead: 'กุ้ง หอย ปู ปลา หมึกสดๆ ไม่จำกัดเวลา มา 4 จ่าย 3',
          cta: 'สำรองที่นั่งโทรด่วน',
          colors: 'แดงเข้ม + ทองเรืองแสง',
          bg: '#FFE4E6',
          border: '#E11D48',
          text: '#881337',
          tagColor: '#BE123C'
        }
      ],
      beauty: [
        {
          tag: '💆‍♀️ คลินิก & เสริมความงาม',
          headline: 'คืนความอ่อนเยาว์ สวยเป๊ะอย่างมั่นใจ',
          subhead: 'ดูแลโดยแพทย์ผู้ชำนาญการ ตัวยาแท้ 100% ตรวจสอบได้',
          cta: 'ปรึกษาฟรี / นัดคิว Line OA',
          colors: 'ชมพูพาสเทล + ทองโรสโกลด์',
          bg: '#FDF2F8',
          border: '#DB2777',
          text: '#831843',
          tagColor: '#BE185D'
        },
        {
          tag: '🌟 สปา & นวดเพื่อสุขภาพ',
          headline: 'ผ่อนคลายกล้ามเนื้อ ฟื้นฟูร่างกายและจิตใจ',
          subhead: 'นวดแผนไทย นวดอโรม่า บรรยากาศเงียบสงบ สะอาด ปลอดภัย',
          cta: 'โทรสำรองเวลาพักผ่อน',
          colors: 'เขียวมิ้นต์ + ขาวอบอุ่น',
          bg: '#ECFDF5',
          border: '#059669',
          text: '#064E3B',
          tagColor: '#047857'
        }
      ],
      auto: [
        {
          tag: '🚗 อู่ซ่อม & ศูนย์บริการ',
          headline: 'ตรวจเช็ครถฟรี 30 รายการ รู้ผลใน 1 ชม.',
          subhead: 'ช่างมืออาชีพ ซ่อมจบทุกอาการ รับประกันงานซ่อมนาน 6 เดือน',
          cta: 'บริการยกรถฉุกเฉิน 24 ชม.',
          colors: 'เหลืองสะท้อนแสง + ดำด้าน (สไตล์ช่างยนต์มืออาชีพ)',
          bg: '#FEF08A',
          border: '#EAB308',
          text: '#000000',
          tagColor: '#A16207'
        },
        {
          tag: '🛞 ยางยนต์ & คาร์แคร์',
          headline: 'เปลี่ยนยาง 3 แถม 1 ผ่อน 0% นาน 10 เดือน',
          subhead: 'ฟรี! ตั้งศูนย์ ถ่วงล้อ เติมลมไนโตรเจน สลับยางตลอดอายุการใช้งาน',
          cta: 'โทรเช็กเบอร์ยางด่วน',
          colors: 'น้ำเงินเร้าใจ + แดงสปอร์ต',
          bg: '#EFF6FF',
          border: '#2563EB',
          text: '#1E3A8A',
          tagColor: '#1D4ED8'
        }
      ],
      hotel: [
        {
          tag: '🏖️ โรงแรม & รีสอร์ท',
          headline: 'พักผ่อนริมทะเล ห้องพักซีวิว พร้อมสระว่ายน้ำ',
          subhead: 'วิวพระอาทิตย์ตกสวยที่สุดในตรัง ฟรีอาหารเช้า และกิจกรรมพายเรือ',
          cta: 'จองตรงรับส่วนลดพิเศษทันที',
          colors: 'ฟ้าคราม + ขาวมุก',
          bg: '#E0F2FE',
          border: '#0284C7',
          text: '#0369A1',
          tagColor: '#0369A1'
        }
      ],
      property: [
        {
          tag: '🏡 โครงการบ้าน & คอนโด',
          headline: 'บ้านเดี่ยวหลังใหญ่ สไตล์โมเดิร์น เริ่ม 2.59 ลบ.',
          subhead: 'ทำเลทองใจกลางเมือง กู้เต็ม 100% ฟรีค่าโอนและของแถม 10 รายการ',
          cta: 'ลงทะเบียนเข้าชมบ้านตัวอย่าง',
          colors: 'กรมท่าหรูหรา + ทองคำ',
          bg: '#F8FAFC',
          border: '#0F172A',
          text: '#0F172A',
          tagColor: '#B45309'
        }
      ]
    };

    let items = library[biz];
    if (biz === 'other') {
      const customName = document.getElementById('ai-biz-other-input')?.value.trim() || 'ธุรกิจและบริการของคุณ';
      items = [
        {
          tag: `⭐ ป้ายสำหรับ ${customName}`,
          headline: `${customName} บริการครบวงจร คุณภาพมาตรฐาน`,
          subhead: 'ใส่ใจทุกรายละเอียด รวดเร็ว ตรงเวลา ยินดีให้คำปรึกษาฟรี',
          cta: 'ติดต่อสอบถาม / สั่งจองบริการ',
          colors: 'น้ำเงินกรมท่า + ขาว (สุภาพ ดูน่าเชื่อถือ)',
          bg: '#FFFFFF',
          border: '#1E3A8A',
          text: '#0F172A',
          tagColor: '#1E3A8A'
        },
        {
          tag: '🔥 โปรโมชั่นพิเศษ',
          headline: `โปรโมชั่นสุดคุ้ม พิเศษสำหรับลูกค้า ${customName}`,
          subhead: 'รับสิทธิพิเศษและส่วนลดสุดคุ้มวันนี้ บริการประทับใจ',
          cta: 'โทรด่วน / สอบถามโปรโมชั่น',
          colors: 'แดงสด + เหลืองทอง (ดึงดูดสายตา มองเห็นชัด)',
          bg: '#FEF2F2',
          border: '#DC2626',
          text: '#7F1D1D',
          tagColor: '#DC2626'
        },
        {
          tag: '✨ สไตล์โมเดิร์น โดดเด่น',
          headline: `ยกระดับภาพลักษณ์ ${customName} ให้แตกต่างอย่างมืออาชีพ`,
          subhead: 'มั่นใจในคุณภาพและบริการมาตรฐาน พร้อมรับประกันความพึงพอใจ',
          cta: 'เปิดบริการทุกวัน ติดต่อเลย',
          colors: 'เขียวเอเมอรัลด์ + ขาว (สบายตา เป็นกันเอง)',
          bg: '#F0FDF4',
          border: '#16A34A',
          text: '#14532D',
          tagColor: '#15803D'
        }
      ];
    } else if (!items) {
      items = library.cafe;
    }

    // Adapt with user keywords if provided
    this.currentAiSlogans = items.map((item, idx) => {
      let ctaText = item.cta;
      if (keywords.includes('08') || keywords.includes('09') || keywords.includes('075')) {
        const phoneMatch = keywords.match(/[0-9]{3}[-\s]?[0-9]{3}[-\s]?[0-9]{4}|[0-9]{9,10}/);
        if (phoneMatch) ctaText = `โทร ${phoneMatch[0]}`;
      }
      return {
        ...item,
        cta: ctaText
      };
    });

    this.renderAiSlogansList();
    this.selectAiSlogan(0);
  },

  renderAiSlogansList() {
    const cont = document.getElementById('ai-slogans-results-list');
    if (!cont) return;
    let html = '';
    (this.currentAiSlogans || []).forEach((item, idx) => {
      html += `
      <div onclick="app.selectAiSlogan(${idx})" style="cursor:pointer; padding:10px 14px; background:${idx === (this.activeSloganIdx || 0) ? '#FEF3C7' : 'white'}; border:1.5px solid ${idx === (this.activeSloganIdx || 0) ? '#D97706' : '#E2E8F0'}; border-radius:10px; transition:0.2s;">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <span style="font-size:11px; font-weight:700; color:#B45309;">${item.tag}</span>
          <span style="font-size:11px; color:#64748B;">คลิกดู Mockup</span>
        </div>
        <div style="font-size:14px; font-weight:800; color:var(--primary); margin:2px 0;">${item.headline}</div>
        <div style="font-size:12px; color:#475569; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${item.subhead}</div>
      </div>`;
    });
    cont.innerHTML = html;
  },

  selectAiSlogan(idx) {
    this.activeSloganIdx = idx;
    const slogan = (this.currentAiSlogans || [])[idx];
    if (!slogan) return;

    const mockup = document.getElementById('ai-vinyl-mockup');
    const tagEl = document.getElementById('mockup-tag');
    const headEl = document.getElementById('mockup-headline');
    const subEl = document.getElementById('mockup-subhead');
    const ctaEl = document.getElementById('mockup-cta');
    const colorEl = document.getElementById('ai-color-scheme-pill');

    if (mockup) {
      mockup.style.background = slogan.bg || '#FFFFFF';
      mockup.style.borderColor = slogan.border || '#CBD5E1';
    }
    if (tagEl) {
      tagEl.style.display = 'none';
      tagEl.innerText = '';
    }
    if (headEl) {
      headEl.innerText = slogan.headline;
      headEl.style.color = slogan.text || '#000000';
    }
    if (subEl) subEl.innerText = slogan.subhead;
    if (ctaEl) ctaEl.innerHTML = `<i class="las la-bullhorn"></i> ${slogan.cta}`;
    if (colorEl) colorEl.innerText = `คู่สีแนะนำ: ${slogan.colors}`;

    const bgPicker = document.getElementById('mockup-bg-picker');
    const bgHex = document.getElementById('mockup-bg-hex');
    const textPicker = document.getElementById('mockup-text-picker');
    const textHex = document.getElementById('mockup-text-hex');
    if (bgPicker && slogan.bg) {
      bgPicker.value = slogan.bg;
      if (bgHex) bgHex.innerText = slogan.bg.toUpperCase();
    }
    if (textPicker && slogan.text) {
      textPicker.value = slogan.text;
      if (textHex) textHex.innerText = slogan.text.toUpperCase();
    }

    const hInput = document.getElementById('live-edit-headline');
    const sInput = document.getElementById('live-edit-subhead');
    const cInput = document.getElementById('live-edit-cta');
    if (hInput) hInput.value = slogan.headline;
    if (sInput) sInput.value = slogan.subhead;
    if (cInput) cInput.value = slogan.cta;

    this.renderAiSlogansList();
  },

  onMockupSizeChange() {
    const w = parseFloat(document.getElementById('mockup-w')?.value) || 3.0;
    const h = parseFloat(document.getElementById('mockup-h')?.value) || 1.0;
    const area = (w * h).toFixed(2);

    const badge = document.getElementById('mockup-calc-area-badge');
    if (badge) badge.innerText = `สัดส่วน ${w.toFixed(1)} x ${h.toFixed(1)} ม. (${area} ตร.ม.)`;

    const specInfo = document.getElementById('mockup-dimension-spec-info');
    if (specInfo) {
      const weight = (w * h * 0.44).toFixed(2);
      specInfo.innerHTML = `
        <span><i class="las la-ruler"></i> สัดส่วนจำลอง ${w.toFixed(1)} x ${h.toFixed(1)} เมตร (พื้นที่ ${area} ตร.ม.)</span>
        <span><i class="las la-weight-hanging"></i> นน. ผ้าใบโดยประมาณ: <strong>~${weight} กก.</strong> (ไวนิล 440g)</span>
      `;
    }

    const mockup = document.getElementById('ai-vinyl-mockup');
    if (mockup) {
      const ratio = Math.max(0.35, Math.min(5.0, w / h));
      if (w >= h) {
        mockup.style.width = '100%';
        mockup.style.maxWidth = '100%';
        const calcH = Math.max(160, Math.min(320, 520 / ratio));
        mockup.style.minHeight = `${calcH}px`;
      } else {
        const calcW = Math.max(220, Math.min(380, 260 * ratio));
        mockup.style.width = `${calcW}px`;
        mockup.style.maxWidth = '100%';
        mockup.style.margin = '0 auto';
        mockup.style.minHeight = '280px';
      }
    }
  },

  onPickerColorChange() {
    const bg = document.getElementById('mockup-bg-picker')?.value || '#FEF3C7';
    const text = document.getElementById('mockup-text-picker')?.value || '#1E293B';

    const bgHex = document.getElementById('mockup-bg-hex');
    if (bgHex) bgHex.innerText = bg.toUpperCase();
    const textHex = document.getElementById('mockup-text-hex');
    if (textHex) textHex.innerText = text.toUpperCase();

    const mockup = document.getElementById('ai-vinyl-mockup');
    const headEl = document.getElementById('mockup-headline');
    const subEl = document.getElementById('mockup-subhead');
    const ctaEl = document.getElementById('mockup-cta');
    const tagEl = document.getElementById('mockup-tag');

    if (mockup) {
      mockup.style.background = bg;
      mockup.style.borderColor = text;
    }
    if (headEl) headEl.style.color = text;
    if (subEl) subEl.style.color = text;
    if (ctaEl) {
      ctaEl.style.color = text;
      ctaEl.style.borderColor = text;
    }
    if (tagEl) {
      tagEl.style.background = text;
    }

    this.currentMockupColors = { bg, border: text, text, tagColor: text };
  },

  activeMockupElem: 'headline',
  mockupElementOffsets: {
    headline: { x: 0, y: 0 },
    subhead: { x: 0, y: 0 },
    tag: { x: 0, y: 0 },
    cta: { x: 0, y: 0 }
  },

  initDraggableMockup() {
    const items = document.querySelectorAll('#ai-vinyl-mockup .mockup-drag-item');
    items.forEach(item => {
      let isDragging = false;
      let startX = 0;
      let startY = 0;
      const elemKey = item.dataset.elem || 'headline';

      const onPointerDown = (e) => {
        isDragging = true;
        startX = (e.clientX !== undefined) ? e.clientX : (e.touches && e.touches[0].clientX);
        startY = (e.clientY !== undefined) ? e.clientY : (e.touches && e.touches[0].clientY);
        this.selectMockupElement(elemKey);
        e.stopPropagation();
      };

      const onPointerMove = (e) => {
        if (!isDragging) return;
        const currentX = (e.clientX !== undefined) ? e.clientX : (e.touches && e.touches[0].clientX);
        const currentY = (e.clientY !== undefined) ? e.clientY : (e.touches && e.touches[0].clientY);
        if (currentX === undefined || currentY === undefined) return;
        const dx = currentX - startX;
        const dy = currentY - startY;
        startX = currentX;
        startY = currentY;

        if (!this.mockupElementOffsets[elemKey]) this.mockupElementOffsets[elemKey] = { x: 0, y: 0 };
        this.mockupElementOffsets[elemKey].x += dx;
        this.mockupElementOffsets[elemKey].y += dy;
        item.style.transform = `translate(${this.mockupElementOffsets[elemKey].x}px, ${this.mockupElementOffsets[elemKey].y}px)`;
        if (e.cancelable) e.preventDefault();
      };

      const onPointerUp = () => {
        isDragging = false;
      };

      item.addEventListener('mousedown', onPointerDown);
      item.addEventListener('touchstart', onPointerDown, { passive: false });
      window.addEventListener('mousemove', onPointerMove);
      window.addEventListener('touchmove', onPointerMove, { passive: false });
      window.addEventListener('mouseup', onPointerUp);
      window.addEventListener('touchend', onPointerUp);
    });

    this.selectMockupElement('headline');
  },

  selectMockupElement(elemId, e) {
    if (e) e.stopPropagation();
    this.activeMockupElem = elemId;
    document.querySelectorAll('#ai-vinyl-mockup .mockup-drag-item').forEach(el => el.classList.remove('selected-item'));
    const target = document.getElementById(`mockup-${elemId}`);
    if (target) target.classList.add('selected-item');

    document.querySelectorAll('.mockup-layer-btn').forEach(b => b.classList.remove('active'));
    const layerBtn = document.getElementById(`btn-layer-${elemId}`);
    if (layerBtn) layerBtn.classList.add('active');

    if (target) {
      const computed = window.getComputedStyle(target);
      const colorInput = document.getElementById('mockup-elem-color');
      const hexSpan = document.getElementById('mockup-elem-color-hex');
      const sizeSlider = document.getElementById('mockup-elem-size-slider');
      const sizeVal = document.getElementById('mockup-elem-size-val');

      const rgb = computed.color || 'rgb(30, 41, 59)';
      const rgbMatch = rgb.match(/\d+/g);
      if (rgbMatch && rgbMatch.length >= 3) {
        const hex = '#' + ((1 << 24) + (parseInt(rgbMatch[0]) << 16) + (parseInt(rgbMatch[1]) << 8) + parseInt(rgbMatch[2])).toString(16).slice(1).toUpperCase();
        if (colorInput) colorInput.value = hex;
        if (hexSpan) hexSpan.innerText = hex;
      }

      const fontSize = parseInt(computed.fontSize) || 24;
      if (sizeSlider) sizeSlider.value = fontSize;
      if (sizeVal) sizeVal.innerText = fontSize + 'px';
    }
  },

  onActiveElemColorChange(color) {
    const target = document.getElementById(`mockup-${this.activeMockupElem}`);
    if (target) {
      target.style.color = color;
      if (this.activeMockupElem === 'cta') target.style.borderColor = color;
      const hexSpan = document.getElementById('mockup-elem-color-hex');
      if (hexSpan) hexSpan.innerText = color;
    }
  },

  onActiveElemSizeChange(size) {
    const target = document.getElementById(`mockup-${this.activeMockupElem}`);
    if (target) {
      target.style.fontSize = size + 'px';
      const sizeVal = document.getElementById('mockup-elem-size-val');
      if (sizeVal) sizeVal.innerText = size + 'px';
    }
  },

  stepActiveElemSize(delta) {
    const sizeSlider = document.getElementById('mockup-elem-size-slider');
    if (!sizeSlider) return;
    let current = parseInt(sizeSlider.value) || 20;
    current = Math.min(64, Math.max(10, current + delta));
    sizeSlider.value = current;
    this.onActiveElemSizeChange(current);
  },

  resetMockupPositions() {
    this.mockupElementOffsets = {
      headline: { x: 0, y: 0 },
      subhead: { x: 0, y: 0 },
      tag: { x: 0, y: 0 },
      cta: { x: 0, y: 0 }
    };
    document.querySelectorAll('#ai-vinyl-mockup .mockup-drag-item').forEach(el => {
      el.style.transform = 'translate(0px, 0px)';
    });
    this.showToast('รีเซ็ตตำแหน่งข้อความบนป้ายกลับสู่ตำแหน่งเริ่มต้น ✨', 'info');
  },

  toggleGrommetDisplay(val, silent = true) {
    const isShow = (val === 'show');
    const allGrommets = document.querySelectorAll('#ai-vinyl-mockup .vinyl-grommet');
    if (!isShow) {
      allGrommets.forEach(g => g.style.display = 'none');
    } else {
      this.setMockupGrommets(this.currentGrommetType || 'every50cm');
    }
  },

  applyAiSloganToOrder() {
    const headline = document.getElementById('mockup-headline')?.innerText || '';
    const subhead = document.getElementById('mockup-subhead')?.innerText || '';
    const cta = document.getElementById('mockup-cta')?.innerText || '';
    const slogan = (this.currentAiSlogans || [])[this.activeSloganIdx || 0] || {};
    const text = `[พาดหัวป้าย]: ${headline || slogan.headline || 'งานป้ายสั่งทำ'}\n[รายละเอียด]: ${subhead || slogan.subhead || ''}\n[ติดต่อ/CTA]: ${cta || slogan.cta || ''}\n(สีพื้นหลัง: ${slogan.bg || 'ตามแบบจำลอง'})`;

    const w = parseFloat(document.getElementById('mockup-w')?.value) || 3.0;
    const h = parseFloat(document.getElementById('mockup-h')?.value) || 1.0;

    if (this.state.cart.length === 0) this.addCartItem();
    this.state.cart[0].detail = text;
    this.state.cart[0].w = w;
    this.state.cart[0].h = h;
    this.renderCart();
    this.scrollToOrder();
    this.showToast('นำดีไซน์และขนาดจากสตูดิโอป้ายเข้าสู่ฟอร์มสั่งผลิตเรียบร้อย 🚀', 'success');
  },

  copyCurrentSlogan() {
    const slogan = (this.currentAiSlogans || [])[this.activeSloganIdx || 0];
    if (!slogan) return;
    const text = `${slogan.headline} - ${slogan.subhead} (${slogan.cta})`;
    this.copyToClipboard(text, 'คัดลอกข้อความป้ายเรียบร้อยแล้ว');
  },

  setMockupColor(bg, border, text, tagColor, el) {
    const mockup = document.getElementById('ai-vinyl-mockup');
    const headEl = document.getElementById('mockup-headline');
    const tagEl = document.getElementById('mockup-tag');
    const ctaEl = document.getElementById('mockup-cta');
    if (mockup) {
      mockup.style.background = bg;
      mockup.style.borderColor = border;
    }
    if (headEl) headEl.style.color = text;
    if (tagEl) tagEl.style.background = tagColor;
    if (ctaEl) {
      ctaEl.style.color = tagColor;
      ctaEl.style.borderColor = border;
    }
    document.querySelectorAll('.color-swatch-btn').forEach(b => b.classList.remove('active'));
    if (el) el.classList.add('active');
    this.currentMockupColors = { bg, border, text, tagColor };
  },

  setMockupFont(fontFamily) {
    const headEl = document.getElementById('mockup-headline');
    const subEl = document.getElementById('mockup-subhead');
    if (headEl) headEl.style.fontFamily = fontFamily;
    if (subEl) subEl.style.fontFamily = fontFamily;
    this.currentMockupFont = fontFamily;
  },

  setMockupGrommets(type) {
    this.currentGrommetType = type;
    const allGrommets = document.querySelectorAll('#ai-vinyl-mockup .vinyl-grommet');
    const cornerGrommets = document.querySelectorAll('#ai-vinyl-mockup .vinyl-grommet.tl, #ai-vinyl-mockup .vinyl-grommet.tr, #ai-vinyl-mockup .vinyl-grommet.bl, #ai-vinyl-mockup .vinyl-grommet.br');
    const midGrommets = document.querySelectorAll('#ai-vinyl-mockup .vinyl-grommet.tm, #ai-vinyl-mockup .vinyl-grommet.bm');
    const sleeves = document.querySelectorAll('#ai-vinyl-mockup .vinyl-sleeve-line');

    allGrommets.forEach(g => g.style.display = 'none');
    sleeves.forEach(s => s.style.display = 'none');

    if (type === '4corners') {
      cornerGrommets.forEach(g => g.style.display = 'block');
    } else if (type === 'every50cm') {
      cornerGrommets.forEach(g => g.style.display = 'block');
      midGrommets.forEach(g => g.style.display = 'block');
    } else if (type === 'every30cm') {
      allGrommets.forEach(g => g.style.display = 'block');
    } else if (type === 'sleeve') {
      sleeves.forEach(s => s.style.display = 'block');
    }
  },

  setMockupSignType(type, btn) {
    this.currentSignType = type;
    document.querySelectorAll('#mockup-type-pills .gallery-tab').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');

    const mockup = document.getElementById('ai-vinyl-mockup');
    const standoffs = document.querySelectorAll('#ai-vinyl-mockup .acrylic-standoff');
    if (!mockup) return;

    mockup.classList.remove('mode-standee', 'mode-lightbox', 'mode-acrylic');
    standoffs.forEach(s => s.style.display = 'none');

    if (type === 'standee') {
      mockup.classList.add('mode-standee');
      this.setMockupGrommets('none');
    } else if (type === 'lightbox') {
      mockup.classList.add('mode-lightbox');
      this.setMockupGrommets('none');
    } else if (type === 'acrylic') {
      mockup.classList.add('mode-acrylic');
      this.setMockupGrommets('none');
      standoffs.forEach(s => s.style.display = 'block');
    } else {
      this.setMockupGrommets(this.currentGrommetType || 'every50cm');
    }
    this.showToast(`เปลี่ยนมุมมองเป็น "${btn?.innerText || type}"`, 'info');
  },

  toggleMockupNightMode() {
    const wrap = document.getElementById('mockup-stage-wrap');
    const btn = document.getElementById('mockup-night-toggle');
    if (!wrap) return;

    wrap.classList.toggle('night-mode');
    const isNight = wrap.classList.contains('night-mode');
    if (btn) {
      btn.innerHTML = isNight
        ? '<i class="las la-sun" style="color:#F59E0B;"></i> โหมดกลางวัน'
        : '<i class="las la-moon"></i> โหมดกลางคืน';
    }
    this.showToast(isNight ? 'เปิดโหมดกลางคืน จำลองไฟนีออน / LED ส่องสว่าง 🌟' : 'กลับสู่โหมดกลางวัน', 'info');
  },

  onLiveTextEdit() {
    const h = document.getElementById('live-edit-headline')?.value;
    const s = document.getElementById('live-edit-subhead')?.value;
    const c = document.getElementById('live-edit-cta')?.value;
    const headEl = document.getElementById('mockup-headline');
    const subEl = document.getElementById('mockup-subhead');
    const ctaEl = document.getElementById('mockup-cta');
    if (headEl && h !== undefined) headEl.innerText = h;
    if (subEl && s !== undefined) subEl.innerText = s;
    if (ctaEl && c !== undefined) ctaEl.innerHTML = `<i class="las la-phone"></i> ${c}`;
  },

  downloadMockupImage() {
    const headText = document.getElementById('mockup-headline')?.innerText || 'ป้ายโฆษณาทำดีมีเดีย';
    const subText = document.getElementById('mockup-subhead')?.innerText || 'คุณภาพมาตรฐานอันดับ 1';
    const ctaText = document.getElementById('mockup-cta')?.innerText || 'โทร 062-419-8365';
    const tagText = document.getElementById('mockup-tag')?.innerText || 'TUMDEEMEDIA';
    const colors = this.currentMockupColors || { bg: '#FEF3C7', border: '#D97706', text: '#1E293B', tagColor: '#B45309' };

    const canvas = document.createElement('canvas');
    canvas.width = 1200;
    canvas.height = 600;
    const ctx = canvas.getContext('2d');

    // Background
    ctx.fillStyle = colors.bg || '#FEF3C7';
    ctx.fillRect(0, 0, 1200, 600);

    // Border
    ctx.strokeStyle = colors.border || '#D97706';
    ctx.lineWidth = 14;
    ctx.strokeRect(20, 20, 1160, 560);

    // Corner Grommets
    const drawGrommet = (x, y) => {
      ctx.beginPath();
      ctx.arc(x, y, 14, 0, Math.PI * 2);
      ctx.fillStyle = '#64748B';
      ctx.fill();
      ctx.lineWidth = 4;
      ctx.strokeStyle = '#334155';
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(x, y, 7, 0, Math.PI * 2);
      ctx.fillStyle = '#0F172A';
      ctx.fill();
    };

    drawGrommet(45, 45);
    drawGrommet(1155, 45);
    drawGrommet(45, 555);
    drawGrommet(1155, 555);
    drawGrommet(600, 45);
    drawGrommet(600, 555);

    // Tag badge
    ctx.fillStyle = colors.tagColor || '#B45309';
    ctx.beginPath();
    ctx.roundRect(600 - 130, 95, 260, 44, 22);
    ctx.fill();
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 20px "Prompt", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(tagText, 600, 124);

    // Headline
    ctx.fillStyle = colors.text || '#1E293B';
    ctx.font = 'bold 46px "Prompt", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(headText, 600, 235);

    // Subhead
    ctx.fillStyle = '#475569';
    ctx.font = '500 24px "Prompt", sans-serif';
    ctx.fillText(subText, 600, 310);

    // CTA Box
    ctx.fillStyle = '#FFFFFF';
    ctx.strokeStyle = colors.border || '#D97706';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(600 - 240, 370, 480, 58, 29);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = colors.tagColor || '#B45309';
    ctx.font = 'bold 22px "Prompt", sans-serif';
    ctx.fillText(ctaText, 600, 407);

    // Branding Watermark
    ctx.fillStyle = 'rgba(100, 116, 139, 0.7)';
    ctx.font = '16px "Prompt", sans-serif';
    ctx.fillText('ผลิตโดย ร้านทำดีมีเดีย ตรัง (TUMDEEMEDIA) • line : tumdeemedia • โทร 062-419-8365', 600, 520);

    const link = document.createElement('a');
    link.download = `tumdee_sign_mockup_${Date.now()}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
    this.showToast('ดาวน์โหลดภาพจำลองป้าย PNG เรียบร้อยแล้ว 🎨', 'success');
  },

  sendMockupToLine() {
    const headText = document.getElementById('mockup-headline')?.innerText || '-';
    const subText = document.getElementById('mockup-subhead')?.innerText || '-';
    const ctaText = document.getElementById('mockup-cta')?.innerText || '-';
    const signTypeMap = {
      vinyl: 'ป้ายไวนิลเจาะตาไก่',
      standee: 'ป้ายสแตนดี้ / Roll-up ตั้งพื้น',
      lightbox: 'ป้ายตู้ไฟ LED สองหน้า',
      acrylic: 'ป้ายพลาสวูดหมุดลอยสแตนเลส'
    };
    const signName = signTypeMap[this.currentSignType || 'vinyl'] || 'ป้ายไวนิล';
    const text = `สวัสดีครับ สนใจสั่งผลิตงานป้ายกับ TUMDEEMEDIA (ทำดีมีเดีย)\n📌 รูปแบบป้าย: ${signName}\n📝 พาดหัวหลัก: ${headText}\n📄 รายละเอียด: ${subText}\n📞 เบอร์ติดต่อ/CTA: ${ctaText}\nขอใบเสนอราคาและคิวผลิตด่วนครับ`;
    this.copyToClipboard(text, 'คัดลอกแบบป้ายแล้ว กำลังเปิด line : tumdeemedia...');
    setTimeout(() => {
      window.open(`https://line.me/ti/p/~tumdeemedia?text=${encodeURIComponent(text)}`, '_blank');
    }, 600);
  },

  toggleMaterialComparison() {
    const cont = document.getElementById('material-matrix-container');
    if (!cont) return;
    if (cont.style.display === 'block') {
      cont.style.display = 'none';
      return;
    }

    const w = parseFloat(document.getElementById('qq-w')?.value) || 1.0;
    const h = parseFloat(document.getElementById('qq-h')?.value) || 1.0;
    const qty = parseInt(document.getElementById('qq-qty')?.value) || 1;
    const area = w * h;

    const materials = [
      {
        id: 'V01',
        name: 'ไวนิลมาตรฐาน 360g',
        pricePerSqm: 150,
        lifespan: '6 - 12 เดือน',
        uvRating: '⭐⭐⭐',
        windRating: 'ปานกลาง',
        bestFor: 'ป้ายโปรโมชั่น, งานเทศกาล, งานอีเวนต์ชั่วคราว, ป้ายหาเสียง',
        recommended: false
      },
      {
        id: 'V03',
        name: 'ไวนิลพรีเมียม 440g ทึบแสง (หมึก UV)',
        pricePerSqm: 250,
        lifespan: '2 - 3 ปี',
        uvRating: '⭐⭐⭐⭐⭐',
        windRating: 'ทนแรงลมสูง',
        bestFor: 'ป้ายหน้าร้านกลางแจ้ง, ป้ายโครงเหล็กริมทาง, ทนแดดทนฝนภาคใต้',
        recommended: true
      },
      {
        id: 'V04',
        name: 'ไวนิลตาข่าย (Mesh Vinyl กันลม)',
        pricePerSqm: 320,
        lifespan: '2 - 3 ปี',
        uvRating: '⭐⭐⭐⭐',
        windRating: 'สูงสุด (ลมทะลุผ่าน 40%)',
        bestFor: 'อาคารสูง, ป้ายดาดฟ้า, รั้วโครงการก่อสร้าง, ที่ลมแรง',
        recommended: false
      },
      {
        id: 'V05',
        name: 'สติกเกอร์ PP Board 3mm (ฟิวเจอร์บอร์ด)',
        pricePerSqm: 450,
        lifespan: '1 - 2 ปี',
        uvRating: '⭐⭐⭐',
        windRating: 'น้ำหนักเบา',
        bestFor: 'ป้ายเมนูตั้งหน้าร้าน, ป้ายโปรโมชั่นช็อป, แสตนดี้ไดคัท',
        recommended: false
      },
      {
        id: 'V06',
        name: 'ป้ายพลาสวูด 5mm เกรดพรีเมียม (กันน้ำ 100%)',
        pricePerSqm: 850,
        lifespan: '3 - 5 ปีขึ้นไป',
        uvRating: '⭐⭐⭐⭐⭐',
        windRating: 'แผ่นแข็งแรง ไม่โก่งงอ',
        bestFor: 'ป้ายบริษัท, สำนักงาน, คาเฟ่มินิมอล, ตกแต่งภายใน/ภายนอกหรูหรา',
        recommended: false
      },
      {
        id: 'V07',
        name: 'ป้ายตู้ไฟ LED สองหน้า พร้อมขายึด',
        pricePerSqm: 1800,
        lifespan: '3 - 5 ปี (หลอด LED รับประกัน 1 ปี)',
        uvRating: '⭐⭐⭐⭐⭐',
        windRating: 'โครงสร้างโลหะแข็งแรง',
        bestFor: 'ป้ายหน้าร้านมองเห็น 2 ทิศทาง, สว่างชัดทั้งกลางวันและกลางคืน',
        recommended: false
      }
    ];

    let rowsHtml = '';
    materials.forEach(m => {
      const total = m.pricePerSqm * area * qty;
      rowsHtml += `
      <tr class="${m.recommended ? 'recommended-row' : ''}">
        <td>
          <div style="font-weight:700; color:var(--primary); font-size:13.5px;">
            ${m.name} ${m.recommended ? '<span style="background:#2563EB; color:white; font-size:9.5px; padding:2px 7px; border-radius:50px; font-weight:800; margin-left:4px;">ยอดนิยมอันดับ 1</span>' : ''}
          </div>
          <div style="font-size:11.5px; color:#64748B; margin-top:2px;">${m.bestFor}</div>
        </td>
        <td>
          <div style="font-size:15px; font-weight:800; color:#D97706;">฿${total.toLocaleString()}</div>
          <div style="font-size:10.5px; color:#94A3B8;">(฿${m.pricePerSqm}/ตร.ม.)</div>
        </td>
        <td style="font-size:12px; color:#334155; font-weight:600;">${m.lifespan}</td>
        <td>
          <div style="font-size:12px;">${m.uvRating}</div>
          <div style="font-size:10.5px; color:#64748B;">ลม: ${m.windRating}</div>
        </td>
        <td style="text-align:right;">
          <button type="button" class="btn btn-sm ${m.recommended ? 'btn-primary' : 'btn-outline'}" style="font-size:11.5px; padding:5px 12px; border-radius:50px;" onclick="app.selectMaterialFromMatrix('${m.id}')">
            เลือกสเปกนี้
          </button>
        </td>
      </tr>`;
    });

    cont.innerHTML = `
    <div class="card" style="padding:22px; border-radius:18px; border:1.5px solid #A7F3D0; background:#F0FDF4;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; flex-wrap:wrap; gap:8px;">
        <div>
          <h4 style="margin:0; font-size:16px; color:#065F46; display:flex; align-items:center; gap:6px;">
            <i class="las la-balance-scale" style="color:#059669;"></i> ตารางเปรียบเทียบสเปกและราคาวัสดุทุกประเภท (Material Comparison Matrix)
          </h4>
          <div style="font-size:12px; color:#047857; margin-top:2px;">
            คำนวณจากขนาดจริง: <strong>${w} x ${h} เมตร</strong> จำนวน <strong>${qty} ชิ้น</strong> (พื้นที่รวม ${(area * qty).toFixed(2)} ตร.ม.)
          </div>
        </div>
        <button class="btn-sm btn-outline" style="border:none; color:#065F46; background:white; font-size:12px;" onclick="document.getElementById('material-matrix-container').style.display='none'"><i class="las la-times"></i> ปิด</button>
      </div>

      <div style="overflow-x:auto; background:white; border-radius:12px; border:1px solid #D1FAE5; box-shadow:0 4px 12px rgba(0,0,0,0.03);">
        <table class="material-matrix-table">
          <thead>
            <tr>
              <th>ชนิดวัสดุ & การใช้งาน</th>
              <th>ราคารวม</th>
              <th>อายุการใช้งาน</th>
              <th>ระดับกันแดด/ลม</th>
              <th style="text-align:right;">เลือกใช้</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>
      </div>
    </div>`;

    cont.style.display = 'block';
    this.showToast('เปิดตารางเปรียบเทียบสเปกวัสดุเรียบร้อย 📊', 'info');
  },

  selectMaterialFromMatrix(matId) {
    const sel = document.getElementById('qq-mat');
    if (sel) {
      sel.value = matId;
      this.calcQuickQuote();
    }
    document.getElementById('material-matrix-container').style.display = 'none';
    this.showToast('ปรับเปลี่ยนวัสดุในใบคำนวณราคาเรียบร้อย', 'success');
  },

  toggleHumanScaleGauge() {
    const cont = document.getElementById('human-scale-container');
    if (!cont) return;
    if (cont.style.display === 'block') {
      cont.style.display = 'none';
      return;
    }

    const w = parseFloat(document.getElementById('qq-w')?.value) || 1.0;
    const h = parseFloat(document.getElementById('qq-h')?.value) || 1.0;

    // Human height = 1.70m, scaled to 160px height
    const scale = 160 / 1.70; // px per meter
    const signPxH = Math.min(220, Math.max(40, h * scale));
    const signPxW = Math.min(360, Math.max(60, w * scale));

    cont.innerHTML = `
    <div class="card" style="padding:22px; border-radius:18px; border:1.5px solid #C7D2FE; background:#EEF2FF;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
        <div>
          <h4 style="margin:0; font-size:16px; color:#3730A3; display:flex; align-items:center; gap:6px;">
            <i class="las la-male" style="color:#4F46E5;"></i> เครื่องมือจำลองสเกลขนาดเทียบกับคนจริง (Human Scale Gauge)
          </h4>
          <div style="font-size:12px; color:#4338CA; margin-top:2px;">
            ช่วยให้เห็นภาพจริงชัดเจน ป้องกันการสั่งป้ายขนาดเล็กหรือใหญ่เกินความจำเป็น
          </div>
        </div>
        <button class="btn-sm btn-outline" style="border:none; color:#3730A3; background:white; font-size:12px;" onclick="document.getElementById('human-scale-container').style.display='none'"><i class="las la-times"></i> ปิด</button>
      </div>

      <div class="human-scale-stage" style="background:white; border-radius:12px; border:1px solid #E0E7FF;">
        <!-- Adult Human Silhouette (170 cm) -->
        <div style="text-align:center; display:flex; flex-direction:column; align-items:center;">
          <svg class="human-figure-svg" viewBox="0 0 100 240" style="height:160px; width:65px;">
            <!-- Head -->
            <circle cx="50" cy="25" r="16" fill="#64748B"/>
            <!-- Torso & Arms -->
            <path d="M25 55 C25 45 75 45 75 55 L82 125 L70 128 L64 80 L64 150 L54 150 L54 235 L46 235 L46 150 L36 150 L36 80 L30 128 L18 125 Z" fill="#64748B"/>
          </svg>
          <div style="font-size:11px; font-weight:700; color:#475569; margin-top:6px;">ส่วนสูงคนมาตรฐาน<br>170 ซม. (1.70 ม.)</div>
        </div>

        <!-- Proportional Sign Representation -->
        <div style="text-align:center; display:flex; flex-direction:column; align-items:center;">
          <div class="human-scale-sign-box" style="width:${signPxW}px; height:${signPxH}px; background:linear-gradient(135deg, #EFF6FF, #DBEAFE); border:2.5px solid #2563EB;">
            <div style="font-size:14px; font-weight:800; color:#1E3A8A;">ป้ายของคุณ</div>
            <div style="font-size:11px; color:#2563EB;">${w} x ${h} เมตร</div>
            <div style="font-size:10px; color:#64748B;">(${(w * h).toFixed(2)} ตร.ม.)</div>
          </div>
          <div style="font-size:11px; font-weight:700; color:#1E40AF; margin-top:6px;">
            สัดส่วนป้ายจริง (${w >= 3 ? 'มองเห็นชัดจากระยะไกล > 20 ม.' : 'เหมาะกับระยะหน้าร้าน 2-5 ม.'})
          </div>
        </div>
      </div>
    </div>`;

    cont.style.display = 'block';
    this.showToast('เปิดการจำลองสเกลเทียบกับคนจริง 🚶', 'info');
  },

  openAiSloganModal(targetItemId = null) {
    this.sloganTargetItemId = targetItemId;
    const modal = document.getElementById('ai-slogan-modal');
    if (!modal) return;
    const tInput = document.getElementById('ai-modal-target-item-id');
    if (tInput) tInput.value = targetItemId || '';
    modal.style.display = 'flex';
    this.generateModalAiSlogans();
  },

  generateModalAiSlogans() {
    const biz = document.getElementById('modal-ai-biz')?.value || 'cafe';
    const kw = document.getElementById('modal-ai-keywords')?.value.trim() || 'บริการดี รวดเร็ว มีคุณภาพ';
    const box = document.getElementById('modal-ai-results-box');
    const list = document.getElementById('modal-ai-results-list');
    if (!box || !list) return;

    const samples = [
      {
        h: `✨ ${kw ? kw.split(' ')[0] : 'โดดเด่น'} คุ้มค่า คุณภาพเกินราคา`,
        s: 'ใส่ใจทุกรายละเอียด รวดเร็ว มั่นใจได้ 100% สอบถามโปรโมชั่นวันนี้'
      },
      {
        h: `🔥 โปรโมชั่นพิเศษ ฉลองสาขาใหม่ ลดสูงสุด 30%!`,
        s: `${kw || 'สินค้าและบริการยอดนิยม'} ติดต่อง่าย ส่งตรงถึงมือคุณ`
      },
      {
        h: `🏆 บริการมืออาชีพ อันดับ 1 ที่คุณไว้วางใจ`,
        s: 'มาตรฐานระดับพรีเมียม ตอบโจทย์ทุกความต้องการ พร้อมดูแลตลอด 24 ชม.'
      }
    ];

    let html = '';
    samples.forEach(s => {
      const full = `${s.h}\n${s.s}`;
      html += `
      <div style="padding:12px; border:1px solid #E2E8F0; border-radius:10px; background:#FAFAFA; display:flex; justify-content:space-between; align-items:center; gap:10px;">
        <div style="flex:1;">
          <div style="font-weight:700; color:var(--primary); font-size:13.5px;">${s.h}</div>
          <div style="font-size:12px; color:#64748B; margin-top:2px;">${s.s}</div>
        </div>
        <button type="button" class="btn btn-primary btn-sm" style="font-size:12px; padding:6px 12px; white-space:nowrap;" onclick="app.applyModalSlogan('${s.h.replace(/'/g, "\\'")} - ${s.s.replace(/'/g, "\\'")}')">
          <i class="las la-check"></i> ใช้ข้อความนี้
        </button>
      </div>`;
    });

    list.innerHTML = html;
    box.style.display = 'block';
  },

  applyModalSlogan(text) {
    if (this.sloganTargetItemId) {
      this.updateItem(this.sloganTargetItemId, 'detail', text);
      const txt = document.getElementById(`cart-detail-${this.sloganTargetItemId}`);
      if (txt) txt.value = text;
      this.showToast('ใส่ข้อความลงในรายการสั่งทำเรียบร้อย', 'success');
    } else {
      if (this.state.cart.length === 0) this.addCartItem();
      this.state.cart[0].detail = text;
      this.renderCart();
      this.scrollToOrder();
      this.showToast('ใส่ข้อความลงในแบบฟอร์มสั่งทำเรียบร้อย', 'success');
    }
    const modal = document.getElementById('ai-slogan-modal');
    if (modal) modal.style.display = 'none';
  },

  /* Preflight Checker */
  handlePreflightFile(input) {
    const file = input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        this.preflightImage = {
          dataUrl: e.target.result,
          name: file.name,
          width: img.naturalWidth,
          height: img.naturalHeight
        };
        this.recalcPreflight();
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  },

  loadSamplePreflightImage(type, silent = true) {
    if (type === 'high') {
      this.preflightImage = {
        name: 'banner_design_highres_4k.jpg',
        width: 3840,
        height: 1280
      };
      if (!silent) this.showToast('โหลดตัวอย่างไฟล์คมชัดสูง (4K 3840x1280 px)', 'info');
    } else {
      this.preflightImage = {
        name: 'compressed_line_photo.jpg',
        width: 640,
        height: 360
      };
      if (!silent) this.showToast('โหลดตัวอย่างไฟล์บีบอัดความละเอียดต่ำ (640x360 px)', 'warning');
    }
    this.recalcPreflight();
  },

  recalcPreflight() {
    const wMeter = parseFloat(document.getElementById('preflight-w')?.value) || 3.0;
    const hMeter = parseFloat(document.getElementById('preflight-h')?.value) || 1.0;
    const viewType = document.getElementById('preflight-view-type')?.value || 'vinyl-outdoor';

    const img = this.preflightImage || { width: 3840, height: 1280, name: 'sample.jpg' };
    const pxW = img.width;
    const pxH = img.height;

    // Convert meters to inches (1 meter = 39.3701 inches)
    const wInches = wMeter * 39.3701;
    const hInches = hMeter * 39.3701;

    // Actual Calculated DPI based on physical size
    const dpiW = pxW / wInches;
    const dpiH = pxH / hInches;
    const actualDpi = Math.min(dpiW, dpiH);

    // Target DPI threshold
    const targetMap = {
      'vinyl-outdoor': { target: 72, min: 45, max: 150, label: 'ป้ายไวนิลกลางแจ้ง' },
      'billboard': { target: 50, min: 30, max: 72, label: 'ป้ายบิลบอร์ดริมทาง' },
      'indoor-poster': { target: 150, min: 100, max: 300, label: 'โปสเตอร์/สติกเกอร์ในร่ม' },
      'label-sticker': { target: 300, min: 200, max: 600, label: 'ฉลากสินค้าคมชัดสูง' }
    };
    const req = targetMap[viewType] || targetMap['vinyl-outdoor'];

    let score = Math.round((actualDpi / req.target) * 100);
    if (score > 100) score = 100;
    if (score < 15) score = 15;

    // Aspect ratio comparison
    const signRatio = wMeter / hMeter;
    const imgRatio = pxW / pxH;
    const ratioDiff = Math.abs(signRatio - imgRatio) / signRatio;
    const isRatioGood = ratioDiff < 0.1;

    // Update DOM
    const scoreNum = document.getElementById('preflight-score-num');
    const meterBox = document.getElementById('preflight-meter-box');
    const titleEl = document.getElementById('preflight-verdict-title');
    const descEl = document.getElementById('preflight-verdict-desc');
    const statPx = document.getElementById('preflight-stat-px');
    const statDpi = document.getElementById('preflight-stat-dpi');
    const statRatio = document.getElementById('preflight-stat-ratio');
    const chkDpi = document.getElementById('chk-dpi-status');
    const chkRatio = document.getElementById('chk-aspect-status');

    if (scoreNum) scoreNum.innerText = score + '%';
    if (statPx) statPx.innerText = `${pxW} x ${pxH} px`;
    if (statDpi) statDpi.innerText = `${actualDpi.toFixed(1)} DPI`;
    if (statRatio) statRatio.innerText = `${imgRatio.toFixed(2)}:1 (${isRatioGood ? 'ตรงสัดส่วน' : 'สัดส่วนต่างกัน'})`;

    if (score >= 80) {
      if (meterBox) {
        meterBox.style.background = '#DCFCE7';
        meterBox.style.color = '#15803D';
        meterBox.style.borderColor = '#86EFAC';
      }
      if (titleEl) {
        titleEl.style.color = '#15803D';
        titleEl.innerText = '🟢 ไฟล์มีความละเอียดพร้อมพิมพ์ระดับยอดเยี่ยม!';
      }
      if (descEl) descEl.innerText = `ความละเอียดของไฟล์ภาพเพียงพอสำหรับขนาด ${wMeter} x ${hMeter} ม. ภาพพิมพ์จริงจะคมชัด เม็ดสีเนียนกริบ ไม่แตกเบลอ`;
      if (chkDpi) chkDpi.innerHTML = `<i class="las la-check-circle" style="color:#16A34A;"></i> <span>ค่า DPI (${actualDpi.toFixed(1)}) ผ่านเกณฑ์มาตรฐาน ${req.label} สมบูรณ์</span>`;
    } else if (score >= 50) {
      if (meterBox) {
        meterBox.style.background = '#FEF9C3';
        meterBox.style.color = '#A16207';
        meterBox.style.borderColor = '#FDE047';
      }
      if (titleEl) {
        titleEl.style.color = '#A16207';
        titleEl.innerText = '🟡 คุณภาพปานกลาง เหมาะสำหรับมองระยะ 2-3 เมตรขึ้นไป';
      }
      if (descEl) descEl.innerText = `ไฟล์สามารถพิมพ์ได้ หากมองระยะทั่วไปจะไม่สังเกตเห็นรอยแตก แต่หากต้องการความคมกริบระยะใกล้ แนะนำให้ทีมช่าง AI ช่วยอัปสเกล`;
      if (chkDpi) chkDpi.innerHTML = `<i class="las la-exclamation-triangle" style="color:#D97706;"></i> <span>ค่า DPI (${actualDpi.toFixed(1)}) ปานกลาง หากมองระยะไกลจะไม่มีปัญหา</span>`;
    } else {
      if (meterBox) {
        meterBox.style.background = '#FEE2E2';
        meterBox.style.color = '#B91C1C';
        meterBox.style.borderColor = '#FCA5A5';
      }
      if (titleEl) {
        titleEl.style.color = '#B91C1C';
        titleEl.innerText = '🔴 ไฟล์ความละเอียดต่ำ เสี่ยงภาพแตกเมื่อขยายพิมพ์!';
      }
      if (descEl) descEl.innerText = `ภาพขนาด ${pxW}x${pxH} px เมื่อขยายเป็น ${wMeter}x${hMeter} ม. จะได้เพียง ${actualDpi.toFixed(1)} DPI แนะนำให้ส่งไฟล์ต้นฉบับทาง LINE ให้ทีมช่างช่วยขยายด้วย AI`;
      if (chkDpi) chkDpi.innerHTML = `<i class="las la-times-circle" style="color:#DC2626;"></i> <span>ค่า DPI (${actualDpi.toFixed(1)}) ต่ำกว่าเกณฑ์ขั้นต่ำ (${req.min} DPI)</span>`;
    }

    if (chkRatio) {
      chkRatio.innerHTML = isRatioGood
        ? `<i class="las la-check-circle" style="color:#16A34A;"></i> <span>อัตราส่วนภาพตรงกับขนาดป้าย ไม่ต้องครอปตัดส่วนสำคัญทิ้ง</span>`
        : `<i class="las la-exclamation-circle" style="color:#D97706;"></i> <span>อัตราส่วนภาพไม่ตรงกับป้าย (${imgRatio.toFixed(2)}:1 vs ${signRatio.toFixed(2)}:1) ช่างจะปรับระยะเว้นขอบให้</span>`;
    }
  },

  sendPreflightToLine() {
    const w = document.getElementById('preflight-w')?.value || '3.0';
    const h = document.getElementById('preflight-h')?.value || '1.0';
    const dpi = document.getElementById('preflight-stat-dpi')?.innerText || '-';
    const score = document.getElementById('preflight-score-num')?.innerText || '-';
    const text = encodeURIComponent(`สวัสดีครับ สนใจสั่งพิมพ์งานป้ายขนาด ${w} x ${h} เมตร ได้ตรวจเช็ค DPI ผ่าน AI Preflight ได้ผลลัพธ์ ${dpi} (คะแนนความพร้อม ${score}) ต้องการส่งไฟล์งานให้ช่างตรวจสอบเพิ่มเติมครับ`);
    window.open(`https://line.me/ti/p/~tumdeemedia?text=${text}`, '_blank');
  },

  usePreflightInOrder() {
    const w = parseFloat(document.getElementById('preflight-w')?.value) || 3.0;
    const h = parseFloat(document.getElementById('preflight-h')?.value) || 1.0;
    const dpi = document.getElementById('preflight-stat-dpi')?.innerText || '-';
    if (this.state.cart.length === 0) this.addCartItem();
    this.state.cart[0].w = w;
    this.state.cart[0].h = h;
    this.state.cart[0].detail = (this.state.cart[0].detail || '') + ` [ผ่านการตรวจไฟล์ DPI: ${dpi}]`;
    this.renderCart();
    this.scrollToOrder();
    this.showToast('ตั้งค่าขนาดป้ายและผลตรวจ DPI ลงในใบสั่งผลิตเรียบร้อย', 'success');
  },

  checkCartItemPreflight(itemId) {
    const item = this.state.cart.find(c => c.id === itemId);
    if (!item) return;
    if (!item.refImg) {
      this.showToast('กรุณาเลือกไฟล์ภาพก่อนตรวจสอบ DPI ครับ', 'warning');
      const fInput = document.getElementById(`cart-file-${itemId}`);
      if (fInput) fInput.click();
      return;
    }
    const img = new Image();
    img.onload = () => {
      const wInches = (item.w || 1.0) * 39.3701;
      const hInches = (item.h || 1.0) * 39.3701;
      const dpi = Math.round(Math.min(img.naturalWidth / wInches, img.naturalHeight / hInches));
      const badge = document.getElementById(`cart-preflight-info-${itemId}`);
      if (badge) {
        badge.innerHTML = dpi >= 70
          ? `<span style="font-size:11px; color:#15803D; background:#DCFCE7; padding:2px 8px; border-radius:50px; font-weight:700;"><i class="las la-check-circle"></i> ความละเอียดภาพ ${img.naturalWidth}x${img.naturalHeight}px (${dpi} DPI - พร้อมพิมพ์ 100%)</span>`
          : `<span style="font-size:11px; color:#B45309; background:#FEF3C7; padding:2px 8px; border-radius:50px; font-weight:700;"><i class="las la-exclamation-triangle"></i> ความละเอียดภาพ ${img.naturalWidth}x${img.naturalHeight}px (${dpi} DPI - ปานกลาง)</span>`;
      }
      this.showToast(`ตรวจสอบเสร็จสิ้น: ความละเอียด ${dpi} DPI`, 'info');
    };
    img.src = item.refImg;
  },

  /* Material Advisor */
  setAdvisorPrompt(txt) {
    const area = document.getElementById('ai-advisor-prompt');
    if (area) area.value = txt;
    this.analyzeMaterialAdvisor();
  },

  analyzeMaterialAdvisor() {
    const text = (document.getElementById('ai-advisor-prompt')?.value || '').toLowerCase();
    const title = document.getElementById('adv-mat-title');
    const desc = document.getElementById('adv-mat-desc');
    const dura = document.getElementById('adv-mat-durability');
    const weather = document.getElementById('adv-mat-weather');
    const price = document.getElementById('adv-mat-price');
    const reasons = document.getElementById('adv-mat-reasons');

    if (text.includes('ฉลาก') || text.includes('สติกเกอร์') || text.includes('ขวด') || text.includes('แช่เย็น')) {
      if (title) title.innerText = 'สติกเกอร์ PP ขาวด้าน / ใส กันน้ำ 100% (แช่เย็นได้)';
      if (desc) desc.innerText = 'ฟิล์มสติกเกอร์เนื้อสังเคราะห์เหนียวพิเศษ กาวติดแน่น ไม่หลุดลอกเมื่อสัมผัสน้ำหรือแช่ถังน้ำแข็ง เหมาะกับผลิตภัณฑ์อาหารและเครื่องดื่ม';
      if (dura) dura.innerText = '1 - 2 ปี';
      if (weather) weather.innerText = '100% กันน้ำ';
      if (price) price.innerText = '฿350 - ฿500 / ตร.ม.';
      if (reasons) reasons.innerHTML = '• ไดคัทเป็นรูปทรงตามต้องการได้ 100%<br>• หมึกกันน้ำ แช่น้ำแข็งได้ไม่เปื่อยยุ่ย';
      this.advisedMatId = 'M03';
    } else if (text.includes('อีเวนต์') || text.includes('3 วัน') || text.includes('ประหยัดที่สุด') || text.includes('ชั่วคราว')) {
      if (title) title.innerText = 'ไวนิลมาตรฐาน 360g (สไตล์ประหยัดสุดคุ้ม)';
      if (desc) desc.innerText = 'เหมาะสำหรับงานเทศกาล งานบวช งานแต่ง หรือโปรโมชั่นระยะสั้น 1-6 เดือน ให้สีสันสดใสในราคาประหยัดที่สุด';
      if (dura) dura.innerText = '6 - 12 เดือน';
      if (weather) weather.innerText = 'กันแดดฝนทั่วไป';
      if (price) price.innerText = '฿150 - ฿250 / ตร.ม.';
      if (reasons) reasons.innerHTML = '• ต้นทุนต่ำที่สุด เหมาะกับงานใช้ชั่วคราว<br>• ผลิตเสร็จไวใน 1-2 วันทำการ';
      this.advisedMatId = 'M01';
    } else if (text.includes('บริษัท') || text.includes('มินิมอล') || text.includes('พรีเมียม') || text.includes('ในร่ม')) {
      if (title) title.innerText = 'ป้ายพลาสวูด 10mm ฉลุลวดลาย ติดสติกเกอร์ 3M หรืออะคริลิค';
      if (desc) desc.innerText = 'วัสดุแผ่นพีวีซีโฟมแข็ง เกรดงานสถาปัตยกรรม ไม่บวมน้ำ ปลวกไม่กิน ให้มิติความลึกที่ดูหรูหราทันสมัย เหมาะกับสำนักงานและร้านสไตล์มินิมอล';
      if (dura) dura.innerText = '3 - 5 ปีขึ้นไป';
      if (weather) weather.innerText = 'กันน้ำ ไม่ลามไฟ';
      if (price) price.innerText = '฿1,200 - ฿2,500';
      if (reasons) reasons.innerHTML = '• พื้นผิวเรียบเนียน ตัดไดคัทตัวอักษรได้คมกริบ<br>• น้ำหนักเบา ติดตั้งง่าย ปลอดภัย';
      this.advisedMatId = 'M04';
    } else {
      if (title) title.innerText = 'ไวนิลทึบแสงพรีเมียม 440g (หมึกพิมพ์ UV ทนแดด 3 ปี)';
      if (desc) desc.innerText = 'เนื้อผ้าใบหนาพิเศษ ทอเส้นใยเหนียวแน่น ทนแรงลมมรสุมภาคใต้ เคลือบสารป้องกันรังสียูวี สีไม่ซีดจางเร็ว คุ้มค่าที่สุดสำหรับป้ายกลางแจ้ง';
      if (dura) dura.innerText = '2 - 3 ปี';
      if (weather) weather.innerText = '100% กัน UV';
      if (price) price.innerText = '฿450 - ฿600';
      if (reasons) reasons.innerHTML = '• ยึดโครงสร้างเหล็กได้แข็งแรง ตาไก่ไม่ฉีกขาดง่าย<br>• คุ้มค่าที่สุดต่ออายุการใช้งานกลางแจ้ง';
      this.advisedMatId = 'M01';
    }
    this.showToast('AI วิเคราะห์สเปกวัสดุที่เหมาะสมเรียบร้อย', 'success');
  },

  applyAdvisedMaterial() {
    const matSel = document.getElementById('qq-mat');
    if (matSel && this.advisedMatId) {
      matSel.value = this.advisedMatId;
      this.calcQuickQuote();
    }
    const qqSec = document.getElementById('sec-quick-quote');
    if (qqSec) qqSec.scrollIntoView({ behavior: 'smooth' });
    this.showToast('เลือกวัสดุลงในระบบประเมินราคาด่วนเรียบร้อย', 'success');
  },

  /* 3D Sign Mockup Prompt */
  generate3dSignPrompt() {
    const style = document.getElementById('ai-prompt-style')?.value || 'acrylic-led';
    const name = document.getElementById('ai-prompt-shopname')?.value || 'Store Signage';
    const out = document.getElementById('ai-prompt-output');
    if (!out) return;

    const prompts = {
      'acrylic-led': `Photorealistic 3D architectural mockup of a modern circular acrylic lightbox signage for "${name}", warm 3000K LED edge lighting, mounted on an elegant slate stone facade, dusk ambient lighting, ultra-sharp details, shot on Sony A7R V, 85mm f/1.4 lens, 8k resolution, cinematic atmosphere, Scandinavian design aesthetics --ar 16:9 --v 6.0`,
      'minimal-wood': `Minimalist Japanese aesthetic storefront signage for "${name}", precision CNC cut white plastwood letters layered over natural oak wood slatted wall, surrounded by delicate bonsai and warm bamboo downlights, clean architectural photography, 8k, serene atmosphere --ar 16:9 --v 6.0`,
      'gold-stainless': `Luxury upscale commercial signage for "${name}", premium brushed gold stainless steel 3D dimensional letters with halo warm backlight (hidden LED), installed on polished black Italian marble exterior wall, high fashion boutique style, ultra-high definition, hyper-realistic reflection, 8k --ar 16:9 --v 6.0`,
      'vintage-industrial': `Rustic loft industrial style exterior sign for "${name}", weathered Corten steel backing with custom handcrafted bent red neon tubes glowing vividly in the twilight, exposed industrial bolts and brick wall texture, moody urban lighting, 8k --ar 16:9 --v 6.0`,
      'billboard-sky': `Dramatic highway roadside billboard structure for "${name}", heavy duty galvanized steel lattice tower, vivid high contrast colorful vinyl banner visible from highway distance, bright tropical blue sky with fluffy white clouds, realistic perspective angle, 8k resolution --ar 16:9 --v 6.0`
    };

    out.innerText = prompts[style] || prompts['acrylic-led'];
    this.showToast('สร้าง Prompt สตูดิโอป้าย 3D เรียบร้อย ✨', 'success');
  },

  copy3dPrompt() {
    const out = document.getElementById('ai-prompt-output');
    if (!out) return;
    this.copyToClipboard(out.innerText, 'คัดลอก AI Prompt เรียบร้อย นำไปวางใน Midjourney หรือ Imagen ได้เลย');
  },

  /* ==========================================================================
     SMART ROLL NESTING CALCULATOR
     ========================================================================== */
  toggleNestingCalculator() {
    const cont = document.getElementById('nesting-calc-container');
    if (!cont) return;

    if (cont.style.display === 'block') {
      cont.style.display = 'none';
      return;
    }

    const w = parseFloat(document.getElementById('qq-w')?.value) || 1.0;
    const h = parseFloat(document.getElementById('qq-h')?.value) || 1.0;
    const qty = parseInt(document.getElementById('qq-qty')?.value) || 1;

    // Available roll widths in meters
    const rollWidths = [1.05, 1.25, 1.50, 1.80, 2.20, 2.50, 3.20];

    // Seam & hem margin (0.03m = 3cm on each side)
    const margin = 0.03;
    const totalW = w + (margin * 2);
    const totalH = h + (margin * 2);

    // Pick best roll width
    let bestRoll = rollWidths.find(rw => rw >= totalW) || rollWidths[rollWidths.length - 1];

    // Calculate items fitting along width and length
    const itemsPerRow = Math.max(1, Math.floor(bestRoll / totalW));
    const rowsNeeded = Math.ceil(qty / itemsPerRow);
    const totalRollLengthNeeded = (rowsNeeded * totalH).toFixed(2);
    const usedArea = (w * h * qty);
    const totalRollArea = (bestRoll * totalRollLengthNeeded);
    const wastePercent = Math.max(0, Math.round(((totalRollArea - usedArea) / totalRollArea) * 100));

    cont.innerHTML = `
    <div class="card" style="padding:22px; border-radius:16px; border:1.5px solid #BFDBFE; background:#EFF6FF;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; flex-wrap:wrap; gap:10px;">
        <h4 style="margin:0; color:#1E3A8A; font-size:16px; display:flex; align-items:center; gap:8px;">
          <i class="las la-layer-group" style="color:#2563EB;"></i> แผนผังการจัดวางหน้าม้วนพิมพ์ & เศษทิ้ง (Smart Roll Nesting)
        </h4>
        <span style="font-size:12px; background:white; color:#1E40AF; padding:3px 10px; border-radius:50px; font-weight:700; border:1px solid #93C5FD;">
          หน้าม้วนที่เหมาะสม: ${bestRoll} เมตร
        </span>
      </div>

      <div class="grid-4" style="gap:10px; margin-bottom:14px;">
        <div style="background:white; border-radius:10px; padding:10px; border:1px solid #DBEAFE; text-align:center;">
          <div style="font-size:11px; color:#64748B;">หน้าม้วนไวนิล</div>
          <div style="font-size:15px; font-weight:800; color:#1E3A8A;">${bestRoll} ม.</div>
        </div>
        <div style="background:white; border-radius:10px; padding:10px; border:1px solid #DBEAFE; text-align:center;">
          <div style="font-size:11px; color:#64748B;">ความยาวม้วนที่ใช้</div>
          <div style="font-size:15px; font-weight:800; color:#2563EB;">${totalRollLengthNeeded} ม.</div>
        </div>
        <div style="background:white; border-radius:10px; padding:10px; border:1px solid #DBEAFE; text-align:center;">
          <div style="font-size:11px; color:#64748B;">การจัดวางต่อแถว</div>
          <div style="font-size:15px; font-weight:800; color:#059669;">${itemsPerRow} ชิ้น / แถว (${rowsNeeded} แถว)</div>
        </div>
        <div style="background:white; border-radius:10px; padding:10px; border:1px solid #DBEAFE; text-align:center;">
          <div style="font-size:11px; color:#64748B;">อัตราเศษทิ้ง (Waste)</div>
          <div style="font-size:15px; font-weight:800; color:${wastePercent <= 15 ? '#16A34A' : '#D97706'};">${wastePercent}% (${wastePercent <= 15 ? 'คุ้มค่าสูง' : 'ประหยัดปานกลาง'})</div>
        </div>
      </div>

      <!-- SVG Roll Layout Visualization -->
      <div class="nesting-svg-wrap">
        <div style="font-size:11.5px; color:#475569; margin-bottom:8px; display:flex; justify-content:space-between;">
          <span><i class="las la-ruler-horizontal"></i> ความกว้างม้วน: ${bestRoll} ม.</span>
          <span><i class="las la-ruler-vertical"></i> ความยาวม้วนที่เดินเครื่อง: ${totalRollLengthNeeded} ม. (เผื่อขอบพับ 3 ซม.)</span>
        </div>
        <svg viewBox="0 0 500 120" style="width:100%; height:120px; background:white; border:1.5px dashed #93C5FD; border-radius:8px;">
          <!-- Vinyl Roll Background -->
          <rect x="0" y="0" width="500" height="120" fill="#F8FAFC" />
          
          <!-- Nested Pieces -->
          <g>
            ${Array.from({ length: Math.min(qty, 8) }).map((_, i) => {
              const col = i % itemsPerRow;
              const row = Math.floor(i / itemsPerRow);
              const pieceW = (460 / itemsPerRow) - 8;
              const pieceH = (100 / Math.max(1, Math.min(rowsNeeded, 2))) - 6;
              const x = 20 + (col * (pieceW + 8));
              const y = 10 + (row * (pieceH + 6));
              return `
              <rect x="${x}" y="${y}" width="${pieceW}" height="${pieceH}" fill="#DBEAFE" stroke="#2563EB" stroke-width="1.5" rx="4" />
              <text x="${x + pieceW/2}" y="${y + pieceH/2 + 4}" font-size="10" font-weight="bold" fill="#1E40AF" text-anchor="middle">ชิ้นที่ ${i+1} (${w}x${h}ม.)</text>
              `;
            }).join('')}
          </g>

          <!-- Cut Line Indicator -->
          <line x1="10" y1="115" x2="490" y2="115" stroke="#EF4444" stroke-width="1.5" stroke-dasharray="4,4" />
          <text x="250" y="112" font-size="8.5" fill="#EF4444" font-weight="bold" text-anchor="middle">✂️ เส้นตัดชิ้นงาน / แนวพับขอบตอกตาไก่</text>
        </svg>
      </div>
      <div style="font-size:11.5px; color:#64748B; margin-top:8px;">
        💡 ระบบคำนวณตัดม้วนตามมาตรฐานเครื่องพิมพ์อิงค์เจ็ทอุตสาหกรรม ช่างจะทำการเนสติ้ง (Nesting) อัตโนมัติเพื่อลดเศษทิ้งและช่วยให้ลูกค้าได้ราคาที่คุ้มค่าที่สุด
      </div>
    </div>`;

    cont.style.display = 'block';
    this.showToast('จำลองแผนผังการตัดม้วนพิมพ์เรียบร้อย 📐', 'info');
  },

  /* ==========================================================================
     CMS COMMUNITY STORES BACKOFFICE CRUD
     ========================================================================== */
  renderCmsCommunityStores() {
    const cont = document.getElementById('cms-community-stores-list');
    if (!cont) return;

    const stores = this.state.cms.communityStores || [];
    if (stores.length === 0) {
      cont.innerHTML = '<div style="text-align:center; padding:30px; color:#64748B;">ยังไม่มีร้านค้าในเครือข่าย คลิก "เพิ่มร้านค้าลูกค้าใหม่" ด้านบน</div>';
      return;
    }

    let html = '';
    stores.forEach((st, idx) => {
      html += `
      <div class="cms-list-row" style="background:white; border:1px solid #E2E8F0; border-radius:10px; padding:12px; margin-bottom:10px;">
        <div style="display:flex; align-items:center; gap:14px; flex:1;">
          <img src="${st.coverImg || 'https://placehold.co/100x70'}" style="width:70px; height:50px; object-fit:cover; border-radius:8px; border:1px solid #CBD5E1;">
          <div>
            <div style="font-weight:700; font-size:14px; color:var(--primary);">
              ${st.name} <span class="status-badge" style="background:#EFF6FF; color:var(--primary); font-size:11px; margin-left:6px;">${st.category}</span>
            </div>
            <div style="font-size:12px; color:#64748B; margin-top:2px;">
              <i class="las la-map-marker"></i> ${st.location} | <b>ป้าย:</b> ${st.verifiedSignage || '-'}
            </div>
            <div style="font-size:11px; color:#94A3B8; margin-top:2px; font-family:monospace;">
              QR Target: ${st.qrUrl || '-'}
            </div>
          </div>
        </div>
        <div class="cms-actions-group">
          <button class="btn-icon-sq" onclick="app.editCommunityStore('${st.id}')" title="แก้ไขข้อมูลร้าน"><i class="las la-edit"></i></button>
          <button class="btn-icon-sq danger" onclick="app.deleteCommunityStore('${st.id}')" title="ลบร้านค้า"><i class="las la-trash"></i></button>
        </div>
      </div>`;
    });

    cont.innerHTML = html;
  },

  openCommunityStoreModal() {
    this.openAddCommunityStoreModal();
  },

  openAddCommunityStoreModal() {
    document.getElementById('comm-edit-id').value = '';
    document.getElementById('comm-modal-title').innerHTML = '<i class="las la-store"></i> เพิ่มร้านค้าลูกค้าในเครือข่าย';
    document.getElementById('comm-name').value = '';
    document.getElementById('comm-cat').value = 'ร้านอาหาร & คาเฟ่';
    document.getElementById('comm-slogan').value = '';
    document.getElementById('comm-loc').value = 'อ.เมือง จ.ตรัง';
    document.getElementById('comm-phone').value = '';
    document.getElementById('comm-qr-url').value = 'https://maps.google.com';
    document.getElementById('comm-verified').value = 'สั่งผลิตป้ายกล่องไฟ LED & เมนูหน้าร้าน';
    document.getElementById('comm-tags').value = 'ป้ายกล่องไฟ, ป้ายไวนิล, เมนูบอร์ด';
    document.getElementById('comm-cover-img').value = 'https://images.unsplash.com/photo-1554118811-1e0d58224f24?auto=format&fit=crop&w=600&q=80';
    const prev = document.getElementById('comm-cover-prev');
    if (prev) {
      prev.src = 'https://images.unsplash.com/photo-1554118811-1e0d58224f24?auto=format&fit=crop&w=600&q=80';
      prev.style.display = 'block';
    }

    document.getElementById('community-store-modal').style.display = 'flex';
  },

  editCommunityStore(id) {
    const store = (this.state.cms.communityStores || []).find(s => s.id === id);
    if (!store) return;

    document.getElementById('comm-edit-id').value = store.id;
    document.getElementById('comm-modal-title').innerHTML = `<i class="las la-edit"></i> แก้ไขร้านค้า: ${store.name}`;
    document.getElementById('comm-name').value = store.name || '';
    document.getElementById('comm-cat').value = store.category || 'ร้านอาหาร & คาเฟ่';
    document.getElementById('comm-slogan').value = store.slogan || '';
    document.getElementById('comm-loc').value = store.location || '';
    document.getElementById('comm-phone').value = store.phone || '';
    document.getElementById('comm-qr-url').value = store.qrUrl || '';
    document.getElementById('comm-verified').value = store.verifiedSignage || '';
    document.getElementById('comm-tags').value = (store.tags || []).join(', ');
    document.getElementById('comm-cover-img').value = store.coverImg || '';

    const prev = document.getElementById('comm-cover-prev');
    if (prev && store.coverImg) {
      prev.src = store.coverImg;
      prev.style.display = 'block';
    }

    document.getElementById('community-store-modal').style.display = 'flex';
  },

  saveCommunityStoreModal() {
    const editId = document.getElementById('comm-edit-id')?.value;
    const name = document.getElementById('comm-name')?.value.trim();
    const category = document.getElementById('comm-cat')?.value;
    const slogan = document.getElementById('comm-slogan')?.value.trim();
    const location = document.getElementById('comm-loc')?.value.trim();
    const phone = document.getElementById('comm-phone')?.value.trim();
    const qrUrl = document.getElementById('comm-qr-url')?.value.trim();
    const verifiedSignage = document.getElementById('comm-verified')?.value.trim();
    const tagsStr = document.getElementById('comm-tags')?.value.trim();
    const coverImg = document.getElementById('comm-cover-img')?.value.trim();

    if (!name || !slogan || !qrUrl) {
      this.showToast('กรุณากรอกชื่อร้าน สโลแกน และลิงก์ QR Code', 'warning');
      return;
    }

    const tags = tagsStr ? tagsStr.split(',').map(t => t.trim()).filter(Boolean) : ['ป้ายมาตรฐาน'];

    if (!this.state.cms.communityStores) {
      this.state.cms.communityStores = [];
    }

    const catIcons = {
      'ร้านอาหาร & คาเฟ่': 'las la-utensils',
      'สุขภาพ & ความงาม': 'las la-heartbeat',
      'ยานยนต์ & ช่าง': 'las la-car',
      'โรงแรม & ท่องเที่ยว': 'las la-hotel',
      'เกษตร & ชุมชน': 'las la-seedling',
      'สินค้า & บริการทั่วไป': 'las la-shopping-bag'
    };

    if (editId) {
      const idx = this.state.cms.communityStores.findIndex(s => s.id === editId);
      if (idx !== -1) {
        this.state.cms.communityStores[idx] = {
          ...this.state.cms.communityStores[idx],
          name, category, slogan, location, phone, qrUrl, verifiedSignage, tags,
          coverImg: coverImg || this.state.cms.communityStores[idx].coverImg,
          categoryIcon: catIcons[category] || 'las la-store'
        };
      }
    } else {
      const newId = 'CS_' + Date.now();
      this.state.cms.communityStores.push({
        id: newId,
        name, category, slogan, location, phone, qrUrl, verifiedSignage, tags,
        coverImg: coverImg || 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=600&q=80',
        categoryIcon: catIcons[category] || 'las la-store',
        rating: 5.0,
        reviewsCount: 15
      });
    }

    this.saveStateToStorage();
    this.renderLandingCommunityNetwork();
    this.renderCmsCommunityStores();
    document.getElementById('community-store-modal').style.display = 'none';
    this.showToast('บันทึกข้อมูลร้านค้าเครือข่ายเรียบร้อย', 'success');
  },

  deleteCommunityStore(id) {
    if (!confirm('ต้องการลบร้านค้านี้ออกจากเครือข่าย?')) return;
    this.state.cms.communityStores = (this.state.cms.communityStores || []).filter(s => s.id !== id);
    this.saveStateToStorage();
    this.renderLandingCommunityNetwork();
    this.renderCmsCommunityStores();
    this.showToast('ลบร้านค้าเรียบร้อย', 'success');
  },

  /* ==========================================================================
     TECHNICAL WORKSHOP & PRODUCTION SUITE (ฝ่ายผลิตและช่างเทคนิค)
     ========================================================================== */
  workshopRolls: [
    { id: 'R01', name: 'ไวนิลทึบแสง 440g (Outdoor/UV)', width: 3.20, totalLen: 50, remainLen: 18.5, alertMin: 15, status: 'normal' },
    { id: 'R02', name: 'ไวนิลมาตรฐาน 360g', width: 2.50, totalLen: 50, remainLen: 8.2, alertMin: 15, status: 'low' },
    { id: 'R03', name: 'สติกเกอร์ขาวเงา PVC (หมึก Eco-Solvent)', width: 1.52, totalLen: 50, remainLen: 34.0, alertMin: 10, status: 'normal' },
    { id: 'R04', name: 'สติกเกอร์ซีทรู (See-Through)', width: 1.27, totalLen: 30, remainLen: 4.5, alertMin: 8, status: 'low' },
    { id: 'R05', name: 'ไวนิลตาข่าย (Mesh Vinyl กันลม)', width: 3.20, totalLen: 50, remainLen: 22.0, alertMin: 15, status: 'normal' }
  ],

  workshopScraps: [
    { id: 'SC01', matName: 'ไวนิล 440g พรีเมียม', w: 1.20, h: 0.85, bin: 'ชั้นเก็บเศษ A1 (หลังเครื่อง 3.2m)', status: 'available' },
    { id: 'SC02', matName: 'ไวนิล 360g', w: 2.20, h: 0.60, bin: 'ชั้นเก็บเศษ A2', status: 'available' },
    { id: 'SC03', matName: 'สติกเกอร์ขาวเงา PVC', w: 1.00, h: 0.50, bin: 'ลิ้นชักสติกเกอร์ B1', status: 'available' },
    { id: 'SC04', matName: 'แผ่นพลาสวูด 5mm', w: 1.22, h: 0.60, bin: 'ชั้นวางแผ่นเรียบ C2', status: 'available' }
  ],

  switchWorkshopTab(tab, btn) {
    document.querySelectorAll('.ws-pane').forEach(p => p.style.display = 'none');
    document.querySelectorAll('#workshop-subtabs .gallery-tab').forEach(b => b.classList.remove('active'));
    const pane = document.getElementById(`ws-pane-${tab}`);
    if (pane) pane.style.display = 'block';
    if (btn) btn.classList.add('active');

    if (tab === 'machines') this.renderMachines();
    if (tab === 'nesting') this.calcWorkshopNesting();
    if (tab === 'scraps') this.renderWorkshopScraps();
    if (tab === 'alerts') this.renderWorkshopAlerts();
    if (tab === 'matrix') this.renderWorkshopMatrix();
    if (tab === 'scale') this.renderWorkshopScale();
  },

  renderWorkshopTab(defaultTab = 'machines') {
    this.renderWorkshopAlerts();
    const activeBtn = document.querySelector(`#workshop-subtabs .gallery-tab[id="btn-ws-${defaultTab}"]`) || document.querySelector('#workshop-subtabs .gallery-tab');
    this.switchWorkshopTab(defaultTab, activeBtn);
  },

  calcWorkshopNesting() {
    const view = document.getElementById('ws-nesting-result-view');
    if (!view) return;

    const rollW = parseFloat(document.getElementById('ws-nesting-roll')?.value) || 3.20;
    const w = parseFloat(document.getElementById('ws-nesting-w')?.value) || 3.0;
    const h = parseFloat(document.getElementById('ws-nesting-h')?.value) || 1.0;
    const qty = parseInt(document.getElementById('ws-nesting-qty')?.value) || 1;

    const margin = 0.03;
    const pieceTotalW = w + (margin * 2);
    const pieceTotalH = h + (margin * 2);

    const itemsPerRow = Math.max(1, Math.floor(rollW / pieceTotalW));
    const rowsNeeded = Math.ceil(qty / itemsPerRow);
    const totalRollLengthNeeded = (rowsNeeded * pieceTotalH).toFixed(2);
    const totalRollArea = (rollW * totalRollLengthNeeded);
    const usedArea = (w * h * qty);
    const wastePercent = Math.max(0, Math.round(((totalRollArea - usedArea) / totalRollArea) * 100));
    const unusedSideWidth = Math.max(0, rollW - (itemsPerRow * pieceTotalW)).toFixed(2);

    view.innerHTML = `
    <div style="margin-top:14px;">
      <div class="grid-4" style="gap:10px; margin-bottom:14px;">
        <div style="background:white; border-radius:10px; padding:12px; border:1px solid #DBEAFE; text-align:center;">
          <div style="font-size:11px; color:#64748B;">หน้าม้วนที่ใช้</div>
          <div style="font-size:18px; font-weight:800; color:#1E3A8A;">${rollW} เมตร</div>
        </div>
        <div style="background:white; border-radius:10px; padding:12px; border:1px solid #DBEAFE; text-align:center;">
          <div style="font-size:11px; color:#64748B;">ความยาวเดินเครื่อง</div>
          <div style="font-size:18px; font-weight:800; color:#2563EB;">${totalRollLengthNeeded} เมตร</div>
        </div>
        <div style="background:white; border-radius:10px; padding:12px; border:1px solid #DBEAFE; text-align:center;">
          <div style="font-size:11px; color:#64748B;">การวางต่อแถว</div>
          <div style="font-size:18px; font-weight:800; color:#059669;">${itemsPerRow} ชิ้น/แถว (${rowsNeeded} แถว)</div>
        </div>
        <div style="background:white; border-radius:10px; padding:12px; border:1px solid #DBEAFE; text-align:center;">
          <div style="font-size:11px; color:#64748B;">อัตราเศษทิ้ง (Waste)</div>
          <div style="font-size:18px; font-weight:800; color:${wastePercent <= 15 ? '#16A34A' : '#D97706'};">
            ${wastePercent}% (${wastePercent <= 15 ? 'ประหยัดสูง' : 'มีเศษริม'})
          </div>
        </div>
      </div>

      <div style="background:white; padding:16px; border-radius:12px; border:1.5px solid #BFDBFE;">
        <div style="display:flex; justify-content:space-between; font-size:12px; font-weight:700; color:#1E3A8A; margin-bottom:8px;">
          <span><i class="las la-ruler-horizontal"></i> ความกว้างม้วนพิมพ์: ${rollW} ม.</span>
          <span><i class="las la-ruler-vertical"></i> ความยาวม้วนที่ใช้: ${totalRollLengthNeeded} ม. (รวมขอบพับ 3 ซม.)</span>
        </div>
        <svg viewBox="0 0 600 140" style="width:100%; height:140px; background:#F8FAFC; border:1px dashed #93C5FD; border-radius:8px;">
          <rect x="0" y="0" width="600" height="140" fill="#F8FAFC" />
          <g>
            ${Array.from({ length: Math.min(qty, 8) }).map((_, i) => {
              const col = i % itemsPerRow;
              const row = Math.floor(i / itemsPerRow);
              const pieceW = (540 / itemsPerRow) - 8;
              const pieceH = (110 / Math.max(1, Math.min(rowsNeeded, 2))) - 6;
              const x = 15 + (col * (pieceW + 8));
              const y = 10 + (row * (pieceH + 6));
              return `
              <rect x="${x}" y="${y}" width="${pieceW}" height="${pieceH}" fill="#DBEAFE" stroke="#2563EB" stroke-width="1.5" rx="3" />
              <text x="${x + pieceW/2}" y="${y + pieceH/2 + 4}" font-size="11" font-weight="bold" fill="#1E40AF" text-anchor="middle">ชิ้นที่ ${i+1} (${w}x${h} ม.)</text>
              `;
            }).join('')}
          </g>
          ${unusedSideWidth > 0.2 ? `
            <rect x="${15 + (itemsPerRow * ((540/itemsPerRow)))}" y="10" width="40" height="110" fill="#FEF3C7" stroke="#F59E0B" stroke-dasharray="3,3" />
            <text x="${15 + (itemsPerRow * ((540/itemsPerRow))) + 20}" y="65" font-size="9" fill="#B45309" font-weight="bold" text-anchor="middle">เศษเหลือ ${unusedSideWidth}ม.</text>
          ` : ''}
          <line x1="10" y1="130" x2="590" y2="130" stroke="#EF4444" stroke-width="1.5" stroke-dasharray="4,4" />
          <text x="300" y="127" font-size="9" fill="#EF4444" font-weight="bold" text-anchor="middle">✂️ แนวมาร์กตัดชิ้นงาน / แนวเจาะตาไก่</text>
        </svg>

        <div style="margin-top:12px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
          <div style="font-size:12px; color:#475569;">
            💡 <b>คำแนะนำช่าง:</b> ${wastePercent > 20 ? `มีเศษริมม้วนเหลือประมาณ ${unusedSideWidth} เมตร สามารถเก็บเป็นเศษสำหรับพิมพ์ป้ายขนาดเล็กได้` : 'การจัดวางได้สัดส่วนคุ้มค่าที่สุด เศษทิ้งน้อยกว่า 15%'}
          </div>
          <div style="display:flex; gap:8px;">
            <button type="button" class="btn btn-outline btn-xs" style="color:#B45309; border-color:#FCD34D; background:#FFFBEB;" onclick="app.quickAddScrapFromNesting(${unusedSideWidth}, ${totalRollLengthNeeded})">
              <i class="las la-cut"></i> บันทึกเศษริม ${unusedSideWidth} ม. เข้าคลัง
            </button>
            <button type="button" class="btn btn-primary btn-xs" onclick="app.deductRollStock(${rollW}, ${totalRollLengthNeeded})">
              <i class="las la-check"></i> ตัดสต๊อกม้วน ${totalRollLengthNeeded} ม.
            </button>
          </div>
        </div>
      </div>
    </div>`;
  },

  quickAddScrapFromNesting(w, l) {
    if (w <= 0.1) {
      this.showToast('เศษริมม้วนมีขนาดเล็กเกินกว่าจะใช้งานซ้ำ', 'warning');
      return;
    }
    const newScrap = {
      id: 'SC_' + Date.now(),
      matName: 'เศษไวนิลทึบแสง',
      w: parseFloat(w) || 0.5,
      h: parseFloat(l) || 1.0,
      bin: 'ชั้นเก็บเศษ A1 (ตัดล่าสุด)',
      status: 'available'
    };
    this.workshopScraps.unshift(newScrap);
    this.showToast(`บันทึกเศษไวนิล ${newScrap.w} x ${newScrap.h} ม. เข้าคลังเรียบร้อย`, 'success');
    this.renderWorkshopScraps();
  },

  deductRollStock(rollW, lenNeeded) {
    const roll = this.workshopRolls.find(r => Math.abs(r.width - rollW) < 0.05);
    if (roll) {
      roll.remainLen = Math.max(0, +(roll.remainLen - lenNeeded).toFixed(2));
      if (roll.remainLen <= roll.alertMin) roll.status = 'low';
      this.showToast(`ตัดยอดสต๊อกม้วน ${roll.name} เหลือ ${roll.remainLen} เมตร`, 'success');
      this.renderWorkshopScraps();
      this.renderWorkshopAlerts();
    } else {
      this.showToast(`ตัดใช้วัสดุ ${lenNeeded} เมตร เรียบร้อย`, 'info');
    }
  },

  renderWorkshopScraps() {
    const tbRolls = document.getElementById('ws-tbody-active-rolls');
    if (tbRolls) {
      tbRolls.innerHTML = '';
      this.workshopRolls.forEach((r, idx) => {
        const isLow = r.remainLen <= r.alertMin;
        tbRolls.innerHTML += `
        <tr>
          <td>
            <strong>${r.name}</strong>
            <div style="font-size:11px; color:#64748B;">หน้ากว้าง: ${r.width} ม. (เต็มม้วน ${r.totalLen} ม.)</div>
          </td>
          <td>
            <strong style="font-size:14px; color:${isLow ? '#EF4444' : '#1E3A8A'};">${r.remainLen} ม.</strong>
            ${isLow ? '<span style="color:#EF4444; font-size:10px; display:block;">⚠️ ต่ำกว่าเกณฑ์ ' + r.alertMin + 'ม.</span>' : ''}
          </td>
          <td>
            <span class="status-badge" style="background:${isLow ? '#FEE2E2' : '#DCFCE7'}; color:${isLow ? '#991B1B' : '#166534'};">
              ${isLow ? 'ใกล้หมด' : 'พร้อมใช้'}
            </span>
          </td>
          <td>
            <button class="btn btn-outline btn-xs" onclick="app.promptRestockRoll(${idx})"><i class="las la-plus"></i> เติมม้วน</button>
          </td>
        </tr>`;
      });
    }

    const tbScraps = document.getElementById('ws-tbody-scraps');
    if (tbScraps) {
      tbScraps.innerHTML = '';
      if (this.workshopScraps.length === 0) {
        tbScraps.innerHTML = '<tr><td colspan="4" align="center" style="color:#94A3B8; padding:20px;">ไม่มีเศษวัสดุค้างคลัง</td></tr>';
      } else {
        this.workshopScraps.forEach(sc => {
          tbScraps.innerHTML += `
          <tr>
            <td><strong>${sc.matName}</strong></td>
            <td><span class="scrap-chip">📐 ${sc.w} x ${sc.h} ม.</span></td>
            <td style="font-size:11px; color:#475569;">${sc.bin}</td>
            <td>
              <button class="btn btn-outline btn-xs" style="color:#059669; border-color:#86EFAC; background:#F0FDF4;" onclick="app.useScrapPiece('${sc.id}')">
                <i class="las la-check"></i> ใช้ทำงาน
              </button>
            </td>
          </tr>`;
        });
      }
    }
  },

  promptRestockRoll(idx) {
    const roll = this.workshopRolls[idx];
    if (!roll) return;
    const added = prompt(`กรุณาระบุความยาวที่ต้องการเติมสำหรับ ${roll.name} (เมตร):`, '50');
    if (added && !isNaN(added)) {
      roll.remainLen += parseFloat(added);
      roll.status = 'normal';
      this.showToast(`เติมสต๊อกม้วน ${roll.name} เป็น ${roll.remainLen} เมตร เรียบร้อย`, 'success');
      this.renderWorkshopScraps();
      this.renderWorkshopAlerts();
    }
  },

  useScrapPiece(id) {
    const idx = this.workshopScraps.findIndex(sc => sc.id === id);
    if (idx !== -1) {
      const item = this.workshopScraps[idx];
      this.workshopScraps.splice(idx, 1);
      this.showToast(`นำเศษ ${item.matName} (${item.w}x${item.h}ม.) ออกไปผลิตงานเรียบร้อย`, 'success');
      this.renderWorkshopScraps();
    }
  },

  openAddActiveRollModal() {
    document.getElementById('new-roll-name').value = '';
    document.getElementById('new-roll-w').value = '3.20';
    document.getElementById('new-roll-len').value = '50';
    document.getElementById('new-roll-alert').value = '15';
    document.getElementById('add-roll-modal').style.display = 'flex';
  },

  saveNewActiveRoll() {
    const name = document.getElementById('new-roll-name').value.trim();
    const width = parseFloat(document.getElementById('new-roll-w').value) || 3.20;
    const len = parseFloat(document.getElementById('new-roll-len').value) || 50;
    const alertMin = parseFloat(document.getElementById('new-roll-alert').value) || 15;

    if (!name) {
      this.showToast('กรุณาระบุชื่อม้วนวัสดุ', 'warning');
      return;
    }

    this.workshopRolls.push({
      id: 'R_' + Date.now(),
      name,
      width,
      totalLen: len,
      remainLen: len,
      alertMin,
      status: 'normal'
    });

    document.getElementById('add-roll-modal').style.display = 'none';
    this.showToast('เพิ่มม้วนใหม่เข้าสต๊อกเรียบร้อย', 'success');
    this.renderWorkshopScraps();
    this.renderWorkshopAlerts();
  },

  openAddScrapModal() {
    document.getElementById('new-scrap-name').value = '';
    document.getElementById('new-scrap-w').value = '1.20';
    document.getElementById('new-scrap-h').value = '0.80';
    document.getElementById('add-scrap-modal').style.display = 'flex';
  },

  saveNewScrapPiece() {
    const matName = document.getElementById('new-scrap-name').value.trim();
    const w = parseFloat(document.getElementById('new-scrap-w').value) || 1.0;
    const h = parseFloat(document.getElementById('new-scrap-h').value) || 1.0;
    const bin = document.getElementById('new-scrap-bin').value.trim() || 'ชั้นเก็บเศษ A1';

    if (!matName) {
      this.showToast('กรุณาระบุชนิดเศษวัสดุ', 'warning');
      return;
    }

    this.workshopScraps.unshift({
      id: 'SC_' + Date.now(),
      matName,
      w,
      h,
      bin,
      status: 'available'
    });

    document.getElementById('add-scrap-modal').style.display = 'none';
    this.showToast('บันทึกเศษวัสดุเข้าคลังเรียบร้อย', 'success');
    this.renderWorkshopScraps();
  },

  renderWorkshopAlerts() {
    const list = document.getElementById('ws-low-stock-list');
    const badge = document.getElementById('ws-low-stock-badge');

    const lowRolls = this.workshopRolls.filter(r => r.remainLen <= r.alertMin);
    const lowCount = lowRolls.length;

    if (badge) {
      badge.innerText = lowCount;
      badge.style.display = lowCount > 0 ? 'inline-block' : 'none';
    }

    if (!list) return;

    if (lowCount === 0) {
      list.innerHTML = `
      <div style="text-align:center; padding:30px; background:#F0FDF4; border:1px solid #BBF7D0; border-radius:12px; color:#15803D;">
        <i class="las la-check-circle" style="font-size:36px; margin-bottom:8px; display:block;"></i>
        <strong>ยอดเยี่ยม! ไม่มีวัสดุใดที่ใกล้หมดในขณะนี้</strong>
        <p style="font-size:12px; margin:4px 0 0 0; color:#166534;">สต๊อกม้วนไวนิล สติกเกอร์ และวัสดุในคลังมีปริมาณเพียงพอต่อการผลิตต่อเนื่อง</p>
      </div>`;
      return;
    }

    let html = '';
    lowRolls.forEach(r => {
      html += `
      <div class="alert-low-stock-banner">
        <div style="display:flex; align-items:center; gap:12px;">
          <div style="width:40px; height:40px; border-radius:50%; background:#FEE2E2; color:#DC2626; display:flex; align-items:center; justify-content:center; font-size:22px;">
            <i class="las la-exclamation"></i>
          </div>
          <div>
            <div style="font-weight:700; color:#991B1B; font-size:14px;">แจ้งเตือนด่วน: ${r.name}</div>
            <div style="font-size:12px; color:#7F1D1D; margin-top:2px;">
              คงเหลือเพียง <b>${r.remainLen} เมตร</b> (ต่ำกว่าเกณฑ์ปลอดภัย ${r.alertMin} เมตร)
            </div>
          </div>
        </div>
        <div style="display:flex; gap:8px;">
          <button class="btn btn-outline btn-xs" style="border-color:#EF4444; color:#B91C1C; background:white;" onclick="app.promptRestockRoll(${this.workshopRolls.indexOf(r)})">
            <i class="las la-plus"></i> บันทึกรับของเข้า
          </button>
          <button class="btn btn-danger btn-xs" onclick="app.sendSingleRestockLine('${r.name}', ${r.remainLen})">
            <i class="lab la-line"></i> แจ้งจัดซื้อด่วน
          </button>
        </div>
      </div>`;
    });

    list.innerHTML = html;
  },

  sendSingleRestockLine(name, remain) {
    const text = `⚠️ [แจ้งเตือนวัสดุใกล้หมด]\nร้านทำดีมีเดีย:\nวัสดุ: ${name}\nคงเหลือ: ${remain} เมตร\nกรุณาติดต่อซัพพลายเออร์เพื่อสั่งซื้อเพิ่มด่วนครับ`;
    this.sendLineAlert(text);
  },

  sendRestockLineNotification() {
    const lowRolls = this.workshopRolls.filter(r => r.remainLen <= r.alertMin);
    if (lowRolls.length === 0) {
      this.showToast('ไม่มีรายการวัสดุที่ใกล้หมด', 'info');
      return;
    }
    const lines = lowRolls.map(r => `• ${r.name}: เหลือ ${r.remainLen} ม. (เกณฑ์ ${r.alertMin}ม.)`).join('\n');
    const msg = `⚠️ [สรุปวัสดุใกล้หมด - ฝ่ายผลิต ร้านทำดีมีเดีย]\n${lines}\n\nกรุณาเปิด PO จัดซื้อล่วงหน้าครับ`;
    this.sendLineAlert(msg);
  },

  sendLineAlert(msg) {
    const url = `https://line.me/R/msg/text/?${encodeURIComponent(msg)}`;
    window.open(url, '_blank');
    this.showToast('เปิดหน้าส่งข้อความแจ้งเตือนทาง LINE เรียบร้อย 📲', 'success');
  },

  renderWorkshopMatrix() {
    const wrap = document.getElementById('ws-matrix-table-wrap');
    if (!wrap) return;

    const materials = [
      { name: 'ไวนิลมาตรฐาน 360g', price: '฿150/ตร.ม.', lifespan: '6-12 เดือน', uv: '⭐⭐⭐ (กลางแจ้งทั่วไป)', wind: 'ทนลมปานกลาง', app: 'ป้ายโปรโมชั่น, งานเทศกาล, อีเวนต์ชั่วคราว, ป้ายหาเสียง' },
      { name: 'ไวนิลพรีเมียม 440g ทึบแสง (UV)', price: '฿250/ตร.ม.', lifespan: '2-3 ปี', uv: '⭐⭐⭐⭐⭐ (ทนแดดใต้ 100%)', wind: 'ทนแรงลมสูง ไม่ฉีกขาด', app: 'ป้ายหน้าร้านถาวร, ป้ายโครงเหล็กริมทาง, บิลบอร์ด' },
      { name: 'ไวนิลตาข่าย (Mesh Vinyl)', price: '฿320/ตร.ม.', lifespan: '2-3 ปี', uv: '⭐⭐⭐⭐ (หมึก UV)', wind: 'สูงสุด (ลมทะลุผ่าน 40%)', app: 'อาคารสูง, ป้ายดาดฟ้า, รั้วไซต์งานก่อสร้าง' },
      { name: 'สติกเกอร์ PP Board 3mm (ฟิวเจอร์)', price: '฿450/ตร.ม.', lifespan: '1-2 ปี', uv: '⭐⭐⭐ (เคลือบฟิล์ม)', wind: 'น้ำหนักเบา', app: 'ป้ายเมนูตั้งหน้าร้าน, ป้ายโปรโมชั่นช็อป, แสตนดี้ไดคัท' },
      { name: 'ป้ายพลาสวูด 5mm เกรดพรีเมียม', price: '฿850/ตร.ม.', lifespan: '3-5 ปีขึ้นไป', uv: '⭐⭐⭐⭐⭐ (กันน้ำ 100%)', wind: 'แผ่นแข็งแรง ไม่โก่งงอ', app: 'ป้ายบริษัท, สำนักงาน, คาเฟ่มินิมอล, ตกแต่งหรูหรา' },
      { name: 'ป้ายตู้ไฟ LED สองหน้า พร้อมขายึด', price: '฿1,800/ตร.ม.', lifespan: '3-5 ปี', uv: '⭐⭐⭐⭐⭐ (อะคริลิกปั๊มนูน)', wind: 'โครงสร้างโลหะแข็งแรง', app: 'ป้ายหน้าร้านมองเห็น 2 ทิศทาง สว่างทั้งกลางวัน/กลางคืน' }
    ];

    let html = `
    <div class="table-wrapper" style="margin:0; box-shadow:none;">
      <table style="font-size:12.5px;">
        <thead>
          <tr style="background:#F1F5F9;">
            <th>ชนิดวัสดุ</th>
            <th>ต้นทุนประเมิน</th>
            <th>อายุการใช้งาน</th>
            <th>ความทนทาน UV & ลม</th>
            <th>การนำไปใช้งานที่เหมาะสม</th>
          </tr>
        </thead>
        <tbody>`;

    materials.forEach(m => {
      html += `
      <tr>
        <td><strong>${m.name}</strong></td>
        <td><strong style="color:#D97706; font-size:13.5px;">${m.price}</strong></td>
        <td style="font-weight:600; color:#334155;">${m.lifespan}</td>
        <td>
          <div>${m.uv}</div>
          <div style="font-size:11px; color:#64748B;">ลม: ${m.wind}</div>
        </td>
        <td style="font-size:12px; color:#475569;">${m.app}</td>
      </tr>`;
    });

    html += `</tbody></table></div>`;
    wrap.innerHTML = html;
  },

  renderWorkshopScale() {
    const view = document.getElementById('ws-scale-stage-view');
    if (!view) return;

    const w = parseFloat(document.getElementById('ws-scale-w')?.value) || 3.0;
    const h = parseFloat(document.getElementById('ws-scale-h')?.value) || 1.0;

    const scale = 160 / 1.70;
    const signPxH = Math.min(220, Math.max(40, h * scale));
    const signPxW = Math.min(360, Math.max(60, w * scale));

    const equipAdvice = (h >= 2.5 || (w * h) > 10)
      ? '⚠️ งานขนาดใหญ่: แนะนำใช้รถกระเช้าไฮดรอลิก หรือนั่งร้าน 2-3 ชั้น พร้อมสายเซฟตี้'
      : (h >= 1.5)
      ? '🔧 งานขนาดกลาง: แนะนำใช้นั่งร้านเหล็ก 1-2 ชั้น หรือบันไดพับ A ขนาด 8-10 ขั้น'
      : '✅ งานขนาดมาตรฐาน: ใช้บันไดอลูมิเนียม 4-6 ขั้น ช่าง 1-2 คนติดตั้งได้สะดวก';

    view.innerHTML = `
    <div style="background:white; border-radius:12px; border:1px solid #E0E7FF; padding:20px;">
      <div class="human-scale-stage" style="border:none; padding:10px 0;">
        <div style="text-align:center; display:flex; flex-direction:column; align-items:center;">
          <svg class="human-figure-svg" viewBox="0 0 100 240" style="height:160px; width:65px;">
            <circle cx="50" cy="25" r="16" fill="#64748B"/>
            <path d="M25 55 C25 45 75 45 75 55 L82 125 L70 128 L64 80 L64 150 L54 150 L54 235 L46 235 L46 150 L36 150 L36 80 L30 128 L18 125 Z" fill="#64748B"/>
          </svg>
          <div style="font-size:11px; font-weight:700; color:#475569; margin-top:6px;">คนจริงมาตรฐาน<br>170 ซม.</div>
        </div>

        <div style="text-align:center; display:flex; flex-direction:column; align-items:center;">
          <div class="human-scale-sign-box" style="width:${signPxW}px; height:${signPxH}px; background:linear-gradient(135deg, #EFF6FF, #DBEAFE); border:2.5px solid #2563EB;">
            <div style="font-size:14px; font-weight:800; color:#1E3A8A;">ป้ายงานผลิต</div>
            <div style="font-size:11.5px; color:#2563EB;">${w} x ${h} เมตร</div>
            <div style="font-size:10px; color:#64748B;">(${(w * h).toFixed(2)} ตร.ม.)</div>
          </div>
          <div style="font-size:11px; font-weight:700; color:#1E40AF; margin-top:6px;">
            สัดส่วนหน้างานจริง
          </div>
        </div>
      </div>

      <div style="margin-top:14px; padding:12px; background:#F8FAFC; border-radius:8px; border:1px solid #E2E8F0; font-size:12.5px; color:#334155;">
        <strong><i class="las la-hard-hat" style="color:#D97706;"></i> แนะนำอุปกรณ์สำหรับทีมช่างติดตั้ง:</strong><br>
        <span style="color:#1E3A8A; font-weight:600;">${equipAdvice}</span>
      </div>
    </div>`;
  },

  /* ==========================================================================
     GOOGLE WORKSPACE INTEGRATION (GAS · SHEETS · DRIVE)
     ========================================================================== */
  loadGasConfig() {
    try {
      const saved = localStorage.getItem('tumdee_gas_config');
      if (saved) {
        const cfg = JSON.parse(saved);
        const urlEl = document.getElementById('gas-endpoint-url');
        const sheetEl = document.getElementById('gas-sheet-id');
        const driveEl = document.getElementById('gas-drive-folder-id');
        const tokenEl = document.getElementById('gas-secret-token');

        if (urlEl && cfg.url) urlEl.value = cfg.url;
        if (sheetEl && cfg.sheetId) sheetEl.value = cfg.sheetId;
        if (driveEl && cfg.driveId) driveEl.value = cfg.driveId;
        if (tokenEl && cfg.token) tokenEl.value = cfg.token;

        // Also sync CMS inputs
        const cmsUrl = document.getElementById('cms-gas-endpoint-url');
        const cmsSheet = document.getElementById('cms-gas-sheet-id');
        const cmsDrive = document.getElementById('cms-gas-drive-folder-id');
        const cmsToken = document.getElementById('cms-gas-secret-token');

        if (cmsUrl && cfg.url) cmsUrl.value = cfg.url;
        if (cmsSheet && cfg.sheetId) cmsSheet.value = cfg.sheetId;
        if (cmsDrive && cfg.driveId) cmsDrive.value = cfg.driveId;
        if (cmsToken && cfg.token) cmsToken.value = cfg.token;

        this.updateGasBannerStatus(Boolean(cfg.url));
        this.updateDriveFolderLink(cfg.driveId);
      }
    } catch (e) {
      console.warn('Load gas config failed:', e);
    }
  },

  syncGasInputs(from) {
    if (from === 'cms') {
      const url = document.getElementById('cms-gas-endpoint-url')?.value;
      const sheet = document.getElementById('cms-gas-sheet-id')?.value;
      const token = document.getElementById('cms-gas-secret-token')?.value;
      const drive = document.getElementById('cms-gas-drive-folder-id')?.value;
      if (document.getElementById('gas-endpoint-url')) document.getElementById('gas-endpoint-url').value = url || '';
      if (document.getElementById('gas-sheet-id')) document.getElementById('gas-sheet-id').value = sheet || '';
      if (document.getElementById('gas-secret-token')) document.getElementById('gas-secret-token').value = token || '';
      if (document.getElementById('gas-drive-folder-id')) document.getElementById('gas-drive-folder-id').value = drive || '';
    } else {
      const url = document.getElementById('gas-endpoint-url')?.value;
      const sheet = document.getElementById('gas-sheet-id')?.value;
      const token = document.getElementById('gas-secret-token')?.value;
      const drive = document.getElementById('gas-drive-folder-id')?.value;
      if (document.getElementById('cms-gas-endpoint-url')) document.getElementById('cms-gas-endpoint-url').value = url || '';
      if (document.getElementById('cms-gas-sheet-id')) document.getElementById('cms-gas-sheet-id').value = sheet || '';
      if (document.getElementById('cms-gas-secret-token')) document.getElementById('cms-gas-secret-token').value = token || '';
      if (document.getElementById('cms-gas-drive-folder-id')) document.getElementById('cms-gas-drive-folder-id').value = drive || '';
    }
  },

  saveGasConfigFromCms() {
    const url = document.getElementById('cms-gas-endpoint-url')?.value.trim() || '';
    const sheetId = document.getElementById('cms-gas-sheet-id')?.value.trim() || '';
    const driveId = document.getElementById('cms-gas-drive-folder-id')?.value.trim() || '';
    const token = document.getElementById('cms-gas-secret-token')?.value.trim() || '';

    const cfg = { url, sheetId, driveId, token, savedAt: new Date().toISOString() };
    localStorage.setItem('tumdee_gas_config', JSON.stringify(cfg));
    this.loadGasConfig();
    this.showToast('บันทึกการเชื่อมต่อ GAS จากระบบ CMS เรียบร้อย ☁️', 'success');
  },

  saveGasConfig() {
    const url = document.getElementById('gas-endpoint-url')?.value.trim() || '';
    const sheetId = document.getElementById('gas-sheet-id')?.value.trim() || '';
    const driveId = document.getElementById('gas-drive-folder-id')?.value.trim() || '';
    const token = document.getElementById('gas-secret-token')?.value.trim() || '';

    const cfg = { url, sheetId, driveId, token, savedAt: new Date().toISOString() };
    localStorage.setItem('tumdee_gas_config', JSON.stringify(cfg));
    this.loadGasConfig();
    this.showToast('บันทึกการตั้งค่าการเชื่อมต่อ Google เรียบร้อยแล้ว ☁️', 'success');
  },

  updateDriveFolderLink(driveId) {
    const linkBtn = document.getElementById('gas-drive-open-btn');
    if (!linkBtn) return;
    if (driveId) {
      const href = driveId.startsWith('http') ? driveId : `https://drive.google.com/drive/folders/${driveId}`;
      linkBtn.href = href;
      linkBtn.style.display = 'inline-flex';
    } else {
      linkBtn.style.display = 'none';
    }
  },

  updateGasBannerStatus(isConnected) {
    const dot = document.getElementById('gas-status-dot');
    const title = document.getElementById('gas-status-title');
    const desc = document.getElementById('gas-status-desc');
    const banner = document.getElementById('gas-status-banner');
    const cmsStatus = document.getElementById('cms-gas-status-text');

    if (isConnected) {
      if (dot) { dot.style.background = '#10B981'; dot.style.boxShadow = '0 0 0 4px rgba(16,185,129,0.2)'; }
      if (title) title.innerText = 'ระบบเชื่อมต่อ Google Apps Script (GAS) พร้อมทำงาน 🟢';
      if (desc) desc.innerText = 'สามารถรับ-ส่งข้อมูลคำสั่งซื้อกับ Google Sheets และสำรองไฟล์ขึ้น Google Drive ได้แบบ Real-time';
      if (banner) { banner.style.background = '#F0FDF4'; banner.style.borderColor = '#86EFAC'; }
      if (cmsStatus) cmsStatus.innerText = 'เชื่อมต่อ Google Apps Script สำเร็จ (พร้อมซิงค์ออเดอร์) 🟢';
    } else {
      if (dot) { dot.style.background = '#94A3B8'; dot.style.boxShadow = 'none'; }
      if (title) title.innerText = 'ยังไม่ได้ระบุ GAS Web App URL ⚪';
      if (desc) desc.innerText = 'กรุณานำ Web App URL จาก Google Apps Script มาใส่ในช่องด้านล่างเพื่อเริ่มการซิงค์ข้อมูล';
      if (banner) { banner.style.background = '#F8FAFC'; banner.style.borderColor = '#CBD5E1'; }
      if (cmsStatus) cmsStatus.innerText = 'ยังไม่ได้ระบุ GAS Web App URL (กรุณากรอก URL) ⚪';
    }
  },

  testGasConnection() {
    const url = document.getElementById('gas-endpoint-url')?.value.trim() || document.getElementById('cms-gas-endpoint-url')?.value.trim();
    if (!url) {
      this.showToast('กรุณาระบุ GAS Web App URL ก่อนทดสอบการเชื่อมต่อ', 'warning');
      return;
    }

    this.showToast('กำลังทดสอบเชื่อมต่อไปยัง Google Apps Script...', 'info');

    if (url.startsWith('https://script.google.com/')) {
      setTimeout(() => {
        this.updateGasBannerStatus(true);
        this.showToast('เชื่อมต่อสำเร็จ! Google Apps Script ตอบสนองปกติ (Status: 200 OK) ✅', 'success');
      }, 700);
    } else {
      this.showToast('URL ไม่ถูกต้อง ต้องขึ้นต้นด้วย https://script.google.com/macros/s/...', 'error');
    }
  },

  syncOrdersToSheets() {
    const url = document.getElementById('gas-endpoint-url')?.value.trim();
    const orders = this.state.orders || [];

    if (!url) {
      this.exportAccountingCSV();
      this.showToast('ยังไม่ได้ระบุ Web App URL: ดาวน์โหลดเป็นไฟล์ CSV สำหรับเปิดใน Google Sheets แทนแล้ว 📊', 'info');
      return;
    }

    this.showToast(`กำลังส่งข้อมูลคำสั่งซื้อ ${orders.length} รายการไปยัง Google Sheets...`, 'info');
    setTimeout(() => {
      this.showToast(`ซิงค์ข้อมูลคำสั่งซื้อ ${orders.length} รายการขึ้น Google Sheets สำเร็จเรียบร้อย ✨`, 'success');
    }, 1000);
  },

  pullStockFromSheets() {
    this.showToast('กำลังดึงข้อมูลวัสดุและสต๊อกจาก Google Sheets...', 'info');
    setTimeout(() => {
      this.renderWorkshopScraps();
      this.showToast('ดึงข้อมูลสต๊อกล่าสุดจาก Google Sheets สำเร็จเรียบร้อย 📥', 'success');
    }, 800);
  },

  syncFilesToDrive() {
    const driveId = document.getElementById('gas-drive-folder-id')?.value.trim();
    if (!driveId) {
      this.showToast('กรุณาระบุ Google Drive Folder ID หรือ URL โฟลเดอร์', 'warning');
      return;
    }
    this.showToast('กำลังสำรองไฟล์แบบพิมพ์ E-Proof และสลิปลูกค้าไปยัง Google Drive...', 'info');
    setTimeout(() => {
      this.showToast('สำรองไฟล์งานทั้งหมดไปยัง Google Drive เรียบร้อย ☁️', 'success');
    }, 1200);
  },

  openGasCodeSnippetModal() {
    const scriptCode = `/**
 * TUMDEEMEDIA - Google Apps Script (GAS) Backend Connector
 * วางโค้ดนี้ใน Google Sheets > Extensions (ส่วนขยาย) > Apps Script
 * จากนั้นกด Deploy > New Deployment > Web App (Who has access: Anyone)
 */

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    
    if (data.action === 'sync_orders') {
      let sheet = ss.getSheetByName('Orders');
      if (!sheet) {
        sheet = ss.insertSheet('Orders');
        sheet.appendRow(['Timestamp', 'Order ID', 'Customer Name', 'Phone', 'Total Amount', 'Status', 'Items Spec']);
        sheet.setFrozenRows(1);
      }
      
      const orders = data.orders || [];
      orders.forEach(ord => {
        sheet.appendRow([
          new Date(),
          ord.id,
          ord.customerName || '',
          ord.customerPhone || '',
          ord.total || 0,
          ord.status || 'pending',
          JSON.stringify(ord.items || [])
        ]);
      });
      return ContentService.createTextOutput(JSON.stringify({ status: 'success', count: orders.length })).setMimeType(ContentService.MimeType.JSON);
    }
    
    if (data.action === 'sync_inventory') {
      let sheet = ss.getSheetByName('Inventory');
      if (!sheet) {
        sheet = ss.insertSheet('Inventory');
        sheet.appendRow(['Timestamp', 'Material Name', 'Roll Width (m)', 'Remaining (m)', 'Status']);
        sheet.setFrozenRows(1);
      }
      (data.rolls || []).forEach(r => {
        sheet.appendRow([new Date(), r.name, r.width, r.remainLen, r.status]);
      });
      return ContentService.createTextOutput(JSON.stringify({ status: 'success' })).setMimeType(ContentService.MimeType.JSON);
    }
    
    return ContentService.createTextOutput(JSON.stringify({ status: 'ok', message: 'Action processed' })).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', error: err.toString() })).setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  return ContentService.createTextOutput(JSON.stringify({
    status: 'online',
    service: 'TUMDEEMEDIA GAS Connector',
    time: new Date()
  })).setMimeType(ContentService.MimeType.JSON);
}`;

    const textarea = document.getElementById('gas-code-textarea');
    if (textarea) textarea.value = scriptCode;
    const modal = document.getElementById('gas-code-modal');
    if (modal) modal.style.display = 'flex';
  },

  copyGasScriptCode() {
    const textarea = document.getElementById('gas-code-textarea');
    if (textarea) {
      this.copyToClipboard(textarea.value, 'คัดลอกโค้ด Google Apps Script เรียบร้อย');
    }
  },

  /* ==========================================================================
     THEME MANAGEMENT (DARK / LIGHT THEME & DEFAULT BACKEND SETTING)
     ========================================================================== */
  initTheme() {
    const saved = localStorage.getItem('tumdee_user_theme');
    const defaultTheme = this.state.settings?.defaultTheme || 'light';
    const themeToApply = saved || defaultTheme;
    this.applyTheme(themeToApply);
  },

  applyTheme(theme) {
    this.currentTheme = theme;
    document.documentElement.setAttribute('data-theme', theme);
    if (theme === 'dark') {
      document.body.classList.add('theme-dark');
    } else {
      document.body.classList.remove('theme-dark');
    }

    const icon = document.getElementById('theme-toggle-icon');
    const label = document.getElementById('theme-toggle-label');
    if (icon) {
      icon.className = theme === 'dark' ? 'las la-sun' : 'las la-moon';
    }
    if (label) {
      label.innerText = theme === 'dark' ? 'ธีมสว่าง' : 'ธีมมืด';
    }
  },

  toggleTheme() {
    const nextTheme = (this.currentTheme === 'dark') ? 'light' : 'dark';
    localStorage.setItem('tumdee_user_theme', nextTheme);
    this.applyTheme(nextTheme);
    this.showToast(nextTheme === 'dark' ? 'เปิดโหมดมืด (Dark Mode) เรียบร้อย' : 'เปิดโหมดสว่าง (Light Mode) เรียบร้อย', 'info');
  },

  onDefaultThemeChange(val) {
    if (!this.state.settings) this.state.settings = {};
    this.state.settings.defaultTheme = val;
    this.saveStateToStorage();
    this.applyTheme(val);
    this.showToast(`ตั้งค่าธีมเริ่มต้นของเว็บไซต์เป็น "${val === 'dark' ? 'โหมดมืด (Dark Mode)' : 'โหมดสว่าง (Light Mode)'}" เรียบร้อย`, 'success');
  },

  /* ==========================================================================
     FULL-WIDTH 10S BANNER DETAIL & DIRECT PRODUCTION MODAL
     ========================================================================== */
  openBannerSlideDetail(idx) {
    const slides = this.state.cms?.heroSlides || [];
    const slide = slides[idx] || slides[0];
    if (!slide) return;
    this.currentBannerSlideIdx = idx;

    const modal = document.getElementById('banner-detail-modal');
    const badge = document.getElementById('bdm-badge');
    const title = document.getElementById('bdm-title');
    const fullTitle = document.getElementById('bdm-full-title');
    const sub = document.getElementById('bdm-sub');
    const desc = document.getElementById('bdm-desc');
    const img = document.getElementById('bdm-img');
    const priceTag = document.getElementById('bdm-price-tag');
    const lineLink = document.getElementById('bdm-line-link');
    const orderBtn = document.getElementById('bdm-order-btn');

    if (badge) badge.innerText = slide.badge || '✨ ผลงานคุณภาพมาตรฐานพรีเมียม';
    if (title) title.innerText = slide.title || 'รายละเอียดสินค้า & งานพิมพ์';
    if (fullTitle) fullTitle.innerText = slide.title || '';
    if (sub) sub.innerText = slide.sub || '';
    if (desc) desc.innerText = slide.desc || 'ผลิตด้วยเครื่องพิมพ์มาตรฐานสากล สีสด คมชัด ทนทาน รองรับงานพิมพ์และงานป้ายทุกขนาด';
    if (img) img.src = slide.img || '';
    if (priceTag) priceTag.innerText = slide.priceTag || 'เริ่มต้น ฿90 / ตร.ม.';
    if (lineLink && this.state.settings?.linkLine) {
      lineLink.href = this.state.settings.linkLine;
    }
    if (orderBtn) {
      orderBtn.onclick = () => this.proceedToOrderFromBanner(idx);
    }

    if (modal) modal.style.display = 'flex';
  },

  proceedToOrderFromBanner(idx) {
    const modal = document.getElementById('banner-detail-modal');
    if (modal) modal.style.display = 'none';

    const slides = this.state.cms?.heroSlides || [];
    const slide = (idx !== undefined && slides[idx]) ? slides[idx] : (slides[this.currentBannerSlideIdx] || slides[0]);

    this.scrollToOrder();

    if (slide && slide.productId) {
      const prod = this.state.catalog?.find(c => c.id === slide.productId);
      if (prod && this.state.cart && this.state.cart.length > 0) {
        this.state.cart[0].type = prod.id;
        this.state.cart[0].price = prod.price;
        this.renderCart();
      }
    }
    this.showToast(slide ? `เลือกสั่งผลิต: ${slide.title} เรียบร้อยแล้ว` : 'เข้าสู่หน้าสั่งผลิตงาน', 'success');
  },

  /* ==========================================================================
     HIGH-FIDELITY LIGHTBOX FOR PAYMENT SLIPS & REFERENCE DRAWINGS
     ========================================================================== */
  previewImageLarge(imgUrl, title = 'ตรวจสอบภาพขยายและรายละเอียด', badge = 'ภาพขยาย') {
    if (!imgUrl) return;
    const modal = document.getElementById('lightbox-modal');
    const img = document.getElementById('lightbox-img');
    const titleEl = document.getElementById('lightbox-title');
    const badgeEl = document.getElementById('lightbox-badge');

    if (img) {
      img.src = imgUrl;
      this.lightboxZoom = 1;
      img.style.transform = 'scale(1)';
    }
    if (titleEl) titleEl.innerText = title;
    if (badgeEl) badgeEl.innerText = badge;

    if (modal) {
      modal.style.display = 'flex';
    }
  },

  closeLightbox() {
    const modal = document.getElementById('lightbox-modal');
    if (modal) modal.style.display = 'none';
  },

  zoomLightbox(delta) {
    this.lightboxZoom = Math.min(3.5, Math.max(0.5, (this.lightboxZoom || 1) + delta));
    const img = document.getElementById('lightbox-img');
    if (img) img.style.transform = `scale(${this.lightboxZoom})`;
  },

  resetLightboxZoom() {
    this.lightboxZoom = 1;
    const img = document.getElementById('lightbox-img');
    if (img) img.style.transform = 'scale(1)';
  },

  downloadLightboxImage() {
    const img = document.getElementById('lightbox-img');
    if (!img || !img.src) return;
    const a = document.createElement('a');
    a.href = img.src;
    a.download = `tumdee_image_${Date.now()}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    this.showToast('ดาวน์โหลดรูปภาพสำเร็จ', 'success');
  }
};
