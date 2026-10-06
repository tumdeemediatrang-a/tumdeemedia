/**
 * TUMDEEMEDIA - Initial Data & State Definition
 * Contains mock data, catalog items, pricing tiers, CMS data, and settings.
 */

export function getInitialState() {
  return {
    cart: [],
    currentManageId: null,
    currentAgentId: null,
    currentCmsType: null,
    currentCmsId: null,
    dashboardFilter: 'month',
    editingOrderId: null,
    editingStaffId: null,
    editingExpenseId: null,
    editingPayableId: null,
    currentUser: {
      id: 'U01',
      username: 'admin',
      name: 'นายธีราธร (เจ้าของร้าน / ผู้ดูแลระบบ)',
      roleId: 'admin'
    },

    expenseCategories: {
      fuel: { name: 'ค่าน้ำมัน/เดินทาง', icon: 'las la-gas-pump', color: '#EA580C' },
      repair: { name: 'ค่าซ่อมแซม/บำรุงรักษา', icon: 'las la-wrench', color: '#D97706' },
      rent: { name: 'ค่าเช่าสถานที่/อาคาร', icon: 'las la-building', color: '#7C3AED' },
      utility: { name: 'ค่าไฟ/ค่าน้ำ/เน็ต', icon: 'las la-bolt', color: '#2563EB' },
      stock: { name: 'สั่งซื้อสต็อกและวัตถุดิบ', icon: 'las la-boxes', color: '#059669' },
      wage: { name: 'ค่าแรง/เงินเดือนพนักงาน', icon: 'las la-users', color: '#4F46E5' },
      marketing: { name: 'ค่าการตลาด/โฆษณา', icon: 'las la-bullhorn', color: '#DB2777' },
      misc: { name: 'ค่าใช้จ่ายเบ็ดเตล็ด', icon: 'las la-receipt', color: '#64748B' }
    },

    roles: {
      admin: {
        id: 'admin',
        name: 'เจ้าของร้าน / ผู้ดูแลระบบ (Owner / Admin)',
        desc: 'เข้าถึงได้ทุกส่วนของระบบ รวมถึงการเงิน บัญชี การตั้งค่า และบริหารสิทธิ์',
        color: '#1E3A8A',
        badgeColor: '#1E3A8A',
        permissions: ['dashboard', 'sales', 'prepress', 'kanban', 'logistics', 'finance', 'customers', 'inventory', 'machine', 'agents', 'staff', 'cms', 'roles', 'settings', 'notif']
      },
      designer: {
        id: 'designer',
        name: 'ฝ่ายออกแบบ (Graphic Designer)',
        desc: 'เข้าถึงคิวออกแบบ จัดเตรียมแบบ ส่งแบบ E-Proof ให้ลูกค้า และกระดานคิวงาน',
        color: '#0EA5E9',
        badgeColor: '#0EA5E9',
        permissions: ['prepress', 'kanban', 'machine', 'notif']
      },
      production: {
        id: 'production',
        name: 'ฝ่ายผลิต / ช่างพิมพ์และติดตั้ง (Production)',
        desc: 'เข้าถึงกระดานคิวงาน ผลิต เครื่องจักร ขนส่ง/ติดตั้ง และเบิกใช้วัสดุ',
        color: '#9333EA',
        badgeColor: '#9333EA',
        permissions: ['kanban', 'machine', 'logistics', 'inventory', 'notif']
      },
      accountant: {
        id: 'accountant',
        name: 'ฝ่ายบัญชีและการเงิน (Accountant)',
        desc: 'เข้าถึง Dashboard รายรับ-รายจ่าย รายการบันทึกค่าใช้จ่าย ลูกหนี้/เจ้าหนี้ และออกบิล',
        color: '#10B981',
        badgeColor: '#10B981',
        permissions: ['dashboard', 'finance', 'customers', 'inventory', 'notif']
      },
      sales: {
        id: 'sales',
        name: 'ฝ่ายขาย & ลูกค้าสัมพันธ์ (Sales & Customer Service)',
        desc: 'เข้าถึงการรับออเดอร์ ออกใบเสนอราคา ข้อมูลสมาชิก และดูแลตัวแทน',
        color: '#F59E0B',
        badgeColor: '#F59E0B',
        permissions: ['sales', 'customers', 'agents', 'prepress', 'notif']
      }
    },

    systemUsers: [
      { id: 'U01', username: 'admin', password: '9546', name: 'นายธีราธร คนเที่ยง (เจ้าของร้าน)', role: 'admin', roleId: 'admin', phone: '062-419-8365', status: 'active' },
      { id: 'U02', username: 'designer', password: '9992', name: 'นายกราฟิก ดีไซน์เนอร์', role: 'designer', roleId: 'designer', phone: '083-333-3333', status: 'active' },
      { id: 'U03', username: 'production', password: '9993', name: 'นายช่างใหญ่ แข็งขัน', role: 'production', roleId: 'production', phone: '081-111-1111', status: 'active' },
      { id: 'U04', username: 'accountant', password: '9994', name: 'นางสาวสมฤทัย ใจบัญชี', role: 'accountant', roleId: 'accountant', phone: '086-444-5555', status: 'active' },
      { id: 'U05', username: 'sales', password: '9991', name: 'นางสาวขายดี ยิ้มแย้ม', role: 'sales', roleId: 'sales', phone: '082-222-2222', status: 'active' }
    ],

    companyInfo: {
      name: "ร้านทำดีมีเดีย",
      nameEn: "TUMDEE MEDIA",
      taxId: "3920100923387",
      branch: "สำนักงานใหญ่",
      address: "125/1 หมู่ 1 ต.หนองตรุด อ.เมือง จ.ตรัง 92000",
      phone: "062-419-8365",
      email: "tumdeemediatrang@gmail.com",
      website: "www.tumdeemedia.com",
      lineId: "tumdeemedia",
      bankName: "ธนาคารไทยพาณิชย์ (SCB) สาขาตรัง",
      bankAccount: "590-264768-1",
      bankAccountName: "ร้านทำดีมีเดีย",
      promptpay: "3920100923387"
    },

    landingSections: [
      { id: 'sec-hero', name: '1. ภาพสไลด์และแบนเนอร์หลัก (Hero Banner & Slider)', visible: true, order: 1, title: 'งานป้ายและสื่อโฆษณา', badge: 'HERO SLIDER', desc: 'ละมุนทุกดีไซน์ พรีเมียมทุกรายละเอียด' },
      { id: 'sec-quick-quote', name: '2. กล่องประเมินราคาด่วน (Quick Quote Estimator)', visible: true, order: 2, title: 'ประเมินราคาด่วน ออนไลน์', badge: 'ONLINE ESTIMATOR', desc: 'คำนวณราคางานป้ายและสิ่งพิมพ์ได้ทันทีตลอด 24 ชม.' },
      { id: 'sec-services', name: '3. บริการงานพิมพ์และงานป้าย (Services Catalog)', visible: true, order: 3, title: 'บริการงานพิมพ์และงานป้ายของเรา', badge: 'SERVICES', desc: 'ครอบคลุมทุกความต้องการด้านสื่อโฆษณาและงานป้ายครบวงจร' },
      { id: 'sec-ai-studio', name: '4. สตูดิโอจำลองภาพป้ายเสมือนจริง & เทมเพลตมาตรฐาน (Interactive Sign Studio)', visible: true, order: 4, title: 'สตูดิโอจำลองภาพป้ายเสมือนจริง', badge: 'SIGN STUDIO', desc: 'ทดลองจำลองภาพป้ายเสมือนจริง พร้อมเทมเพลตมาตรฐานมืออาชีพ สั่งง่ายในคลิกเดียว' },
      { id: 'sec-gallery', name: '5. แกลเลอรี่ผลงานของเรา (Portfolio Gallery)', visible: true, order: 5, title: 'แกลอรี่ผลงานของเรา', badge: 'PORTFOLIO', desc: 'ภาพถ่ายผลงานจริงจากสถานที่ติดตั้งทั่วภาคใต้และทั่วประเทศ' },
      { id: 'sec-flash-sale', name: '6. สินค้าโปรโมชั่นพิเศษ (Hot Deals & Flash Sales)', visible: true, order: 6, title: 'HOT DEAL & สินค้าแนะนำ', badge: 'HOT DEALS', desc: 'สินค้าจัดโปรโมชั่นและสินค้ามาใหม่ ราคาพิเศษเฉพาะสั่งออนไลน์เท่านั้น' },
      { id: 'sec-packages', name: '7. แพ็กเกจสุดคุ้มแนะนำ (Recommended Packages)', visible: true, order: 7, title: 'แพ็กเกจสุดคุ้ม (Recommended Packages)', badge: 'VALUE PACKAGES', desc: 'รวมเซ็ตงานป้ายและสื่อสิ่งพิมพ์ยอดฮิต จัดมาให้ครบ จบในคลิกเดียว' },
      { id: 'sec-promotions', name: '8. โปรโมชั่นสุดคุ้มประจำเดือน (Monthly Promotions)', visible: true, order: 8, title: 'โปรโมชั่นสุดคุ้มประจำเดือน', badge: 'PROMOTIONS', desc: 'สิทธิพิเศษและส่วนลดมากมายเฉพาะลูกค้าทำดีมีเดีย' },
      { id: 'sec-one-stop', name: '9. ครบจบในที่เดียว (One-Stop Service & Quality)', visible: true, order: 9, title: 'ครบจบในที่เดียว (One-Stop Service & Workflow)', badge: 'ONE-STOP SERVICE', desc: 'มาหาเราที่เดียว แล้วชีวิตจะง่ายขึ้น' },
      { id: 'sec-order-cta', name: '10. แบนเนอร์สั่งผลิตงาน 24 ชม. (Order Online CTA)', visible: true, order: 10, title: 'สั่งผลิตงานง่ายๆ ได้ 24 ชม.', badge: 'ORDER ONLINE', desc: 'ประเมินราคาอัตโนมัติ สรุปไฟล์แบบปุ๊บ รอรับของที่บ้านได้เลย' },
      { id: 'sec-agent-cta', name: '11. แบนเนอร์ร่วมเป็นตัวแทน (Partner Program CTA)', visible: true, order: 11, title: 'ร่วมเป็นตัวแทนจำหน่ายกับเรา', badge: 'PARTNER PROGRAM', desc: 'เพิ่มช่องทางสร้างรายได้ให้กับร้านหรือธุรกิจของคุณ พร้อมระบบจัดการออเดอร์สุดล้ำ' },
      { id: 'sec-trusted-brands', name: '12. แบรนด์ชั้นนำที่ไว้วางใจ (Trusted Brands)', visible: true, order: 12, title: 'แบรนด์ชั้นนำที่ไว้วางใจเรา', badge: 'TRUSTED CLIENTS', desc: 'ลูกค้าองค์กรและแบรนด์ชั้นนำที่เลือกใช้บริการ' },
      { id: 'sec-testimonials', name: '13. เสียงตอบรับจากลูกค้า (Customer Testimonials)', visible: true, order: 13, title: 'เสียงตอบรับจากลูกค้า', badge: 'REVIEWS', desc: 'ความประทับใจจริงจากลูกค้าที่สั่งผลิตงานกับเรา' },
      { id: 'sec-faq', name: '14. คำถามที่พบบ่อย (Frequently Asked Questions)', visible: true, order: 14, title: 'คำถามที่พบบ่อย (FAQs)', badge: 'FREQUENT QUESTIONS', desc: 'ไขทุกข้อข้องใจเกี่ยวกับการสั่งผลิตและระยะเวลาจัดส่ง' },
      { id: 'sec-community-network', name: '15. เครือข่ายร้านค้าลูกค้า (Community Network)', visible: true, order: 15, title: 'เครือข่ายร้านค้าลูกค้า ทำดีมีเดีย', badge: 'COMMUNITY', desc: 'ร่วมส่งเสริมและสนับสนุนร้านค้าธุรกิจของลูกค้าที่สั่งผลิตงานกับเรา' }
    ],

    finishing: {
      'none': { name: 'ตัดพอดีงาน/ไดคัท', price: 0 },
      'eyelet': { name: 'เจาะตาไก่', price: 0 },
      'sleeve': { name: 'ร้อยท่อ (โครงเหล็ก)', price: 50 },
      'weld': { name: 'พับขอบ/รีดตะเข็บ', price: 0 }
    },

    installPricing: {
      'pickup': 0,
      'parcel': 0,
      'standard': 500,
      'crane': 5000
    },

    agentTiers: {
      'Standard': 0.10,
      'Pro': 0.15,
      'VIP': 0.20
    },

    cms: {
      seoTitle: "ร้านทำป้ายตรัง ทำดีมีเดีย TUMDEEMEDIA | ผลิตป้ายไวนิล ป้ายไฟ กล่องไฟ สติ๊กเกอร์ ครบวงจร",
      seoDesc: "ร้านทำป้ายตรัง ทำดีมีเดีย (TUMDEEMEDIA) โรงพิมพ์ป้ายอันดับ 1 ในตรัง รับทำป้ายไวนิลด่วน ป้ายกล่องไฟ LED ป้ายสแตนดี้ สติ๊กเกอร์ฉลากสินค้า ป้ายพลาสวูด อะคริลิค ออกแบบฟรี คุณภาพสูง ราคาโรงงาน จัดส่งทั่วประเทศ โทร 062-419-8365",
      seoKeywords: "ร้านทำป้ายตรัง, ทำป้ายไวนิลตรัง, ร้านป้ายตรัง, ป้ายโฆษณาตรัง, ร้านป้ายใกล้ฉัน, รับทำป้าย, ป้ายไวนิล, ป้ายไฟ, กล่องไฟ LED, สติ๊กเกอร์ไดคัท, ป้ายอะคริลิค, ป้ายพลาสวูด, สแตนดี้, ตู้ไฟหน้าร้าน, โรงพิมพ์ป้าย, สั่งทำป้ายออนไลน์, TUMDEEMEDIA, ทำดีมีเดีย",
      heroLayout: 'style1',
      heroLayouts: [
        { id: 'style_fullscreen_10s', name: 'แบนเนอร์กว้างเต็มจอ ออโต้สไลด์ 10 วิ (Full-Width 10s Slider)', desc: 'แบนเนอร์กว้างเต็มจอ สไลด์เปลี่ยนทุก 10 วินาที คลิกภาพเพื่อดูรายละเอียดงานและกดสั่งผลิตได้ทันที', icon: 'las la-tv', previewColor: '#2563EB' },
        { id: 'style1', name: '1. Modern Split Slider (โมเดิร์น สปลิท)', desc: 'เนื้อหาด้านซ้าย + สไลเดอร์ภาพผลงานด้านขวา พร้อมปุ่มติดต่อด่วน', icon: 'las la-columns', previewColor: '#1E3A8A' },
        { id: 'style2', name: '2. Cinematic Full-Width Panorama (พานอรามากว้างเต็มจอ)', desc: 'แบนเนอร์กว้างเต็มจอ ภาพพื้นหลังเลื่อนสไลด์ ตัวอักษรเด่นตรงกลาง สไตล์บิลบอร์ดสากล', icon: 'las la-expand', previewColor: '#0EA5E9' },
        { id: 'style3', name: '3. Clean Minimalist & Floating Cards (มินิมอลโมเดิร์น)', desc: 'ดีไซน์คลีน สะอาดตา เน้นฟอนต์ใหญ่คมชัด พร้อมการ์ดภาพ 3 ผลงานเด่นลอยตัว', icon: 'las la-window-restore', previewColor: '#10B981' },
        { id: 'style4', name: '4. Bento Grid Interactive Hero (เบนโตะสไตล์ Apple)', desc: 'การ์ด Bento หลายมิติ: แบนเนอร์หลัก, กล่องคำนวณราคา, Live Preview ป้ายไฟ, รีวิว 5 ดาว', icon: 'las la-th-large', previewColor: '#8B5CF6' },
        { id: 'style5', name: '5. Neon & Flash Campaign Hero (ป้ายไฟนีออน & แคมเปญลดแรง)', desc: 'โทนเข้ม Dark Neon ป้ายไฟเรืองแสง พร้อมตัวเลขนับถอยหลัง Flash Sale ประจำวัน', icon: 'las la-bolt', previewColor: '#EF4444' },
        { id: 'style6', name: '6. 3D Studio & Creative Agency (สตูดิโอดีไซน์ 3 มิติ)', desc: 'สไตล์เอเจนซี่ครีเอทีฟ โชว์สเปกวัสดุพรีเมียม (อะคริลิค, โลหะ, พลาสวูด) และผลงาน 10,000+ ชิ้น', icon: 'las la-cube', previewColor: '#F59E0B' }
      ],
      heroTitle: 'ทำดีมีเดีย TUMDEEMEDIA',
      heroSub: 'สื่อทุกความสำเร็จ ให้ธุรกิจคุณ · ป้ายที่ใช่ ช่วยให้ธุรกิจคุณโดดเด่นกว่าใคร',
      heroDesc: 'โรงงานผลิตป้ายโฆษณาและสื่อสิ่งพิมพ์ครบวงจร ออกแบบ ผลิต ติดตั้ง ครบจบในที่เดียว ทั่วภาคใต้และทั่วประเทศ',
      heroImg: '/src/assets/images/tumdee_signage_hero_mockup_1791105743409.jpg',
      heroSlides: [
        {
          img: "/src/assets/images/tumdee_signage_hero_mockup_1791105743409.jpg",
          title: "ร้านทำดีมีเดีย TUMDEEMEDIA",
          sub: "โรงงานผลิตป้ายโฆษณา & สื่อสิ่งพิมพ์มาตรฐานพรีเมียมอันดับ 1 เมืองตรัง",
          desc: "ออกแบบ ผลิต ติดตั้ง ครบวงจร ป้ายไวนิล ป้ายไฟ LED ตู้ไฟหน้าร้าน ตัวอักษรโลหะ 3D สแตนดี้ และฉลากสินค้ากันน้ำ",
          productId: "V01",
          priceTag: "เริ่มต้น ฿90 / ตร.ม.",
          badge: "👑 คุณภาพอันดับ 1"
        },
        {
          img: "/src/assets/images/tumdee_banner_outdoor_mockup_1791105764191.jpg",
          title: "ป้ายไวนิลความละเอียดสูง & แบนเนอร์โฆษณา",
          sub: "พิมพ์ระบบ UV / Eco-Solvent สีสดคมชัด ทนแดด ทนฝน พับขอบตอกตาไก่พร้อมติดตั้ง",
          desc: "ไวนิลหนาพิเศษ 440g - 510g ผ้าใบโปร่งแสง-ทึบแสง สำหรับร้านค้า โครงการจัดสรร และงานอีเวนต์ทั่วประเทศ",
          productId: "V01",
          priceTag: "เริ่มต้น ฿90 / ตร.ม.",
          badge: "⚡ ผลิตด่วน 2-4 ชม."
        },
        {
          img: "/src/assets/images/tumdee_signage_mockup_1791027582711.jpg",
          title: "ป้ายไฟ LED & งานอะคริลิก 3D หน้าร้าน",
          sub: "ยกระดับภาพลักษณ์แบรนด์ให้โดดเด่นสะดุดตาทุกมุมมอง",
          desc: "ตู้ไฟ LED สองหน้า ตัวอักษรโลหะซ่อนไฟ ตู้ไฟดัดโค้ง และป้ายพลาสวูดฉลุ CNC ดีไซน์โมเดิร์นมาตรฐานงานโครงการ",
          productId: "S01",
          priceTag: "เริ่มต้น ฿2,500 / ตู้",
          badge: "💡 ไฟ LED กันน้ำ IP68"
        },
        {
          img: "/src/assets/images/tumdee_workshop_mockup_1791027663440.jpg",
          title: "สื่อโฆษณา & งานพิมพ์ครบวงจร",
          sub: "ไวนิล สติกเกอร์ ฉลากสินค้า แบนเนอร์ สแตนดี้ และอุปกรณ์ออกบูธ",
          desc: "ระบบพิมพ์ Inkjet Outdoor 3.2m และ UV Flatbed ความละเอียดสูง สีสดทนแดด ทนฝน 2-3 ปี พร้อมจัดส่งรวดเร็วทั่วประเทศ",
          productId: "L01",
          priceTag: "เริ่มต้น ฿120 / ตร.ม.",
          badge: "🚚 จัดส่งทั่วไทย"
        }
      ],
      processSteps: [
        { num: '1', title: 'ปรึกษาและให้แบบ', desc: 'ส่งรายละเอียดขนาดและวัสดุผ่านหน้าเว็บ หรือทัก LINE เพื่อปรึกษาช่างผู้เชี่ยวชาญ', icon: 'las la-comments' },
        { num: '2', title: 'ออกแบบและประเมินราคา', desc: 'รับใบเสนอราคาทันที พร้อมตรวจสอบ E-Proof งานออกแบบก่อนเริ่มผลิตจริง', icon: 'las la-paint-roller' },
        { num: '3', title: 'ดำเนินการผลิต', desc: 'เข้าสู่สายการผลิตด้วยเครื่องพิมพ์ความละเอียดสูง ควบคุมคุณภาพทุกตารางนิ้ว', icon: 'las la-print' },
        { num: '4', title: 'จัดส่งและติดตั้ง', desc: 'ส่งมอบงานตรงเวลา พร้อมบริการทีมช่างติดตั้งถึงที่ทั่วประเทศ', icon: 'las la-tools' }
      ],
      oneStop: {
        title: 'ครบจบในที่เดียว',
        sub: '(One-Stop Service & Workflow)',
        desc: 'ออกแบบ · ผลิต · ติดตั้ง · ครบจบในที่เดียว',
        mainImg: '/src/assets/images/tumdee_signage_hero_mockup_1791105743409.jpg',
        aboutTitle: 'เราคือผู้ช่วยส่วนตัว เรื่องงานป้ายและสื่อโฆษณาของคุณ',
        aboutDesc: 'หมดปัญหาความยุ่งยากในการประสานงานหลายต่อ เราพร้อมดูแลคุณตั้งแต่เริ่มรับโจทย์ ออกแบบ ควบคุมการผลิต ไปจนถึงส่งมอบและติดตั้ง ด้วยเครือข่ายพันธมิตรที่ได้มาตรฐาน ช่วยให้แบรนด์ของคุณโดดเด่นและเป็นที่น่าจดจำ',
        bullet1: 'สะดวก รวดเร็ว ประหยัดเวลา',
        bullet2: 'ได้งานคุณภาพตรงใจ ในราคาคุ้มค่า',
        bullet3: 'ตรวจสอบคุณภาพและดูแลทุกขั้นตอน',
        cards: [
          { num: 1, title: 'วิเคราะห์ & ให้คำปรึกษา', desc: 'รับฟังทุกความต้องการ พร้อมแนะนำวัสดุและโซลูชันที่ตอบโจทย์ทั้งงบประมาณและการใช้งาน', img: '/src/assets/images/tumdee_signage_mockup_cafe_1791027305672.jpg', color: '#3B82F6' },
          { num: 2, title: 'ออกแบบระดับมืออาชีพ', desc: 'เนรมิตไอเดียให้เป็นจริงด้วยทีมกราฟิกดีไซน์ จัดวางองค์ประกอบให้โดดเด่น สื่อสารแบรนด์ได้ตรงจุด', img: '/src/assets/images/tumdee_storefront_bg_1791027336095.jpg', color: '#EC4899' },
          { num: 3, title: 'ผลิต & ควบคุมคุณภาพ', desc: 'คัดสรรเครื่องพิมพ์และเทคโนโลยีที่เหมาะสมที่สุดสำหรับแต่ละชิ้นงาน มั่นใจคุณภาพระดับพรีเมียม', img: '/src/assets/images/tumdee_services_products_1791027320420.jpg', color: '#8B5CF6' },
          { num: 4, title: 'ตรวจสอบ & จัดส่งรวดเร็ว', desc: 'ผ่านการตรวจสอบ QC ละเอียดก่อนส่งมอบ พร้อมบริการจัดส่งและทีมช่างติดตั้งถึงที่ ตรงเวลา 100%', img: '/src/assets/images/tumdee_storefront_hero_1791027291683.jpg', color: '#10B981' }
        ]
      },
      orderCta: {
        badge: 'ORDER ONLINE',
        title: 'สั่งผลิตงานง่ายๆ ได้ 24 ชม.',
        sub: 'ประเมินราคาอัตโนมัติ สรุปไฟล์แบบปุ๊บ รอรับของที่บ้านได้เลย',
        bullet1: 'ผลิตงานดี มีคุณภาพ สเปคได้มาตรฐาน',
        bullet2: 'รวดเร็ว แม่นยำ ส่งงานตรงกำหนด',
        bullet3: 'รองรับทุกความต้องการ พร้อมจัดส่งทั่วประเทศ',
        btnText: 'คลิกสั่งผลิตงานทันที'
      },
      agentCta: {
        badge: 'PARTNER PROGRAM',
        title: 'ร่วมเป็นตัวแทนจำหน่ายกับเรา',
        sub: 'เพิ่มช่องทางสร้างรายได้ให้กับร้านหรือธุรกิจของคุณ พร้อมระบบจัดการออเดอร์สุดล้ำที่ออกแบบมาเพื่อตัวแทนโดยเฉพาะ',
        bullet1: 'สมัครฟรี! ไม่มีค่าแรกเข้าแอบแฝง',
        bullet2: 'รับส่วนลดพิเศษ และ ค่าคอมมิชชันสูงสุด 20% ทุกออเดอร์',
        bullet3: 'มีระบบติดตามสถานะงาน และพิมพ์ใบเสนอราคาได้เอง 24 ชม.',
        btnText: 'สมัครสมาชิกตัวแทน'
      },
      contactAddress: "125/1 ม.1 ต.หนองตรุด อ.เมือง จ.ตรัง 92000",
      contactPhone: "062-419-8365",
      contactEmail: "tumdeemediatrang@gmail.com",
      contactLineId: "tumdeemedia",
      contactFbId: "tumdeemediatrang",
      mapIframe: "<iframe src='https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3950.819777174668!2d99.5891465!3d7.5901309!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x304d754b2d1c6819%3A0x88f6f59b9e67d2b2!2z4LiX4Liz4LiU4Li14Lih4Li14LmA4LiU4Li14Lii4Liy!5e0!3m2!1sth!2sth!4v1680000000000!5m2!1sth!2sth' width='100%' height='100%' style='border:0;' allowfullscreen='' loading='lazy' referrerpolicy='no-referrer-when-downgrade'></iframe>",
      faqs: [
        {
          q: "ระยะเวลาในการผลิตและจัดส่งกี่วัน?",
          a: "โดยปกติงานพิมพ์ทั่วไปจะใช้เวลา 1-3 วันทำการ และงานโครงสร้างจะใช้เวลา 5-7 วันทำการ ขึ้นอยู่กับปริมาณและคิวงานในขณะนั้นครับ"
        },
        {
          q: "มีบริการออกแบบให้ด้วยหรือไม่?",
          a: "ทางเรามีทีมกราฟิกมืออาชีพคอยให้บริการครับ โดยมีค่าบริการเริ่มต้นที่ 500 บาท หรือหากมีไฟล์พร้อมพิมพ์ก็สามารถส่งมาให้เราตรวจสอบได้ฟรีครับ"
        },
        {
          q: "จัดส่งต่างจังหวัดอย่างไร?",
          a: "เรามีบริการจัดส่งผ่านขนส่งเอกชนครอบคลุมทั่วประเทศ แพ็คชิ้นงานหนาแน่นป้องกันความเสียหาย 100%"
        }
      ],
      trustedBrands: [
        "https://placehold.co/300x120/fff/cbd5e1?text=Brand+One&font=Montserrat",
        "https://placehold.co/300x120/fff/cbd5e1?text=Company+X&font=Montserrat",
        "https://placehold.co/300x120/fff/cbd5e1?text=Studio+G&font=Montserrat",
        "https://placehold.co/300x120/fff/cbd5e1?text=Enterprise&font=Montserrat",
        "https://placehold.co/300x120/fff/cbd5e1?text=Tech+Hub&font=Montserrat"
      ],
      communityStores: [
        {
          id: 'CS01',
          name: "Cafe' de Trang (คาเฟ่ เดอ ตรัง)",
          slogan: "กาแฟคั่วบดสดใหม่ เบเกอรี่โฮมเมด บรรยากาศร่มรื่นใจกลางเมือง",
          category: "ร้านอาหาร & คาเฟ่",
          categoryIcon: "las la-coffee",
          categoryColor: "#D97706",
          location: "อ.เมือง จ.ตรัง",
          coverImg: "https://images.unsplash.com/photo-1554118811-1e0d58224f24?auto=format&fit=crop&w=600&q=80",
          logoImg: "https://images.unsplash.com/photo-1559925393-8be0ec4767c8?auto=format&fit=crop&w=150&q=80",
          workPhotos: [
            "https://images.unsplash.com/photo-1554118811-1e0d58224f24?auto=format&fit=crop&w=800&q=80",
            "https://images.unsplash.com/photo-1559925393-8be0ec4767c8?auto=format&fit=crop&w=800&q=80",
            "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=800&q=80"
          ],
          tags: ["ป้ายกล่องไฟ", "สติกเกอร์ฉลาก", "เมนูบอร์ด"],
          phone: "081-999-1234",
          qrUrl: "https://maps.google.com/?q=Cafe+De+Trang",
          facebookUrl: "https://www.facebook.com/cafedetrang",
          verifiedSignage: "สั่งผลิตป้ายกล่องไฟ LED อะคริลิค & ป้ายเมนูหน้าร้าน",
          signSpec: { type: 'V07', name: 'ป้ายตู้ไฟ LED สองหน้า อะคริลิคปั๊มนูน', w: 1.2, h: 0.8, detail: 'ป้ายตู้ไฟ LED สองหน้า สไตล์คาเฟ่ ขอบซิงค์ทำสีดำด้าน พร้อมขาแขวนเหล็กดัด' },
          rating: 4.9,
          reviewCount: 128
        },
        {
          id: 'CS02',
          name: "ครัวนายดำ ซีฟู้ด ตรัง",
          slogan: "อาหารทะเลสดใหม่จากเรือประมง รสชาติปักษ์ใต้แท้ ถึงเครื่องถึงรส",
          category: "ร้านอาหาร & คาเฟ่",
          categoryIcon: "las la-utensils",
          categoryColor: "#EA580C",
          location: "อ.กันตัง จ.ตรัง",
          coverImg: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=600&q=80",
          logoImg: "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=150&q=80",
          workPhotos: [
            "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=800&q=80",
            "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=800&q=80"
          ],
          tags: ["ป้ายบิลบอร์ด", "ป้ายไวนิล", "เมนูอะคริลิค"],
          phone: "089-888-5678",
          qrUrl: "https://maps.google.com/?q=Naidam+Seafood+Trang",
          facebookUrl: "https://www.facebook.com/naidamseafoodtrang",
          verifiedSignage: "สั่งผลิตป้ายบิลบอร์ดริมทางโครงสร้างเหล็ก & ไวนิล UV 440g",
          signSpec: { type: 'V01', name: 'ป้ายไวนิลพรีเมียม 440g ทึบแสง', w: 4.0, h: 1.5, detail: 'ป้ายไวนิลโครงเหล็กหน้าร้าน ซีลขอบตอกตาไก่ทุก 30 ซม. หมึกพิมพ์ UV ทนแดด 3 ปี' },
          rating: 4.8,
          reviewCount: 95
        },
        {
          id: 'CS03',
          name: "สไมล์ไลฟ์ คลินิกทันตกรรม",
          slogan: "ดูแลรอยยิ้มของคุณด้วยความจริงใจ มาตรฐานทันตกรรมครบวงจร",
          category: "สุขภาพ & ความงาม",
          categoryIcon: "las la-tooth",
          categoryColor: "#0EA5E9",
          location: "ถ.วิเศษกุล อ.เมือง จ.ตรัง",
          coverImg: "https://images.unsplash.com/photo-1629909613654-28e377c37b09?auto=format&fit=crop&w=600&q=80",
          logoImg: "https://images.unsplash.com/photo-1588776814546-1ffcf47267a5?auto=format&fit=crop&w=150&q=80",
          workPhotos: [
            "https://images.unsplash.com/photo-1629909613654-28e377c37b09?auto=format&fit=crop&w=800&q=80",
            "https://images.unsplash.com/photo-1588776814546-1ffcf47267a5?auto=format&fit=crop&w=800&q=80"
          ],
          tags: ["อักษรโลหะซ่อนไฟ", "สติกเกอร์ฝ้าพรางตา", "ป้ายแผนก"],
          phone: "075-222-333",
          qrUrl: "https://maps.google.com/?q=Smile+Life+Dental+Trang",
          facebookUrl: "https://www.facebook.com/smilelifedentalclinictrang",
          verifiedSignage: "สั่งผลิตอักษรโลหะสแตนเลสซ่อนไฟ LED & สติกเกอร์ฝ้าไดคัท",
          signSpec: { type: 'W02', name: 'สติกเกอร์ติดพลาสวูด 5 มิล', w: 2.5, h: 0.8, detail: 'ป้ายพลาสวูด 5 มม. ฉลุ CNC ตัวอักษรนูน ติดสติกเกอร์ 3M สไตล์คลินิกมินิมอล' },
          rating: 5.0,
          reviewCount: 84
        },
        {
          id: 'CS04',
          name: "อู่ช่างเอก การช่าง & ตรวจสภาพ",
          slogan: "บริการซ่อมเครื่องยนต์ ช่วงล่าง แอร์รถยนต์ ตรวจสภาพรถครบวงจร",
          category: "ยานยนต์ & ช่าง",
          categoryIcon: "las la-car",
          categoryColor: "#DC2626",
          location: "อ.นาโยง จ.ตรัง",
          coverImg: "https://images.unsplash.com/photo-1486006920555-c77dce18193b?auto=format&fit=crop&w=600&q=80",
          logoImg: "https://images.unsplash.com/photo-1619642751034-765dfdf7c58e?auto=format&fit=crop&w=150&q=80",
          workPhotos: [
            "https://images.unsplash.com/photo-1486006920555-c77dce18193b?auto=format&fit=crop&w=800&q=80"
          ],
          tags: ["ป้ายโครงเหล็ก", "ป้ายไวนิลทนแดด"],
          phone: "086-777-4321",
          qrUrl: "https://maps.google.com/?q=Chang+Ek+Auto+Trang",
          facebookUrl: "https://www.facebook.com/changekautotrang",
          verifiedSignage: "สั่งผลิตป้ายโครงสร้างเหล็กสูง 6 เมตร & ไวนิลหน้าอู่",
          signSpec: { type: 'V01', name: 'ป้ายไวนิลโครงสร้างเหล็กขนาดใหญ่', w: 6.0, h: 2.0, detail: 'ป้ายไวนิล 440g ทึบแสง ขึงโครงเหล็กทาวเวอร์หน้าอู่ซ่อมรถ ทนพายุลมแรง' },
          rating: 4.9,
          reviewCount: 110
        },
        {
          id: 'CS05',
          name: "อันดามัน บูทีค รีสอร์ท",
          slogan: "พักผ่อนท่ามกลางธรรมชาติอันเงียบสงบ ห้องพักหรู สระว่ายน้ำระบบเกลือ",
          category: "โรงแรม & ท่องเที่ยว",
          categoryIcon: "las la-hotel",
          categoryColor: "#10B981",
          location: "หาดปากเมง อ.สิเกา จ.ตรัง",
          coverImg: "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=600&q=80",
          logoImg: "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=150&q=80",
          workPhotos: [
            "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=800&q=80"
          ],
          tags: ["ป้ายพลาสวูด", "ป้ายไฟสัญลักษณ์", "ป้ายทางเดิน"],
          phone: "075-888-999",
          qrUrl: "https://maps.google.com/?q=Andaman+Boutique+Resort+Trang",
          facebookUrl: "https://www.facebook.com/andamanboutiqueresort",
          verifiedSignage: "สั่งผลิตป้ายบอกทางพลาสวูดทนแดด & ป้ายหน้าวิลล่า",
          signSpec: { type: 'W01', name: 'สติกเกอร์ติดพลาสวูด 3 มิล', w: 1.0, h: 0.4, detail: 'ป้ายบอกทางและเลขห้องพักพลาสวูด 3 มม. กันน้ำ 100% เกรดรีสอร์ทชายทะเล' },
          rating: 4.8,
          reviewCount: 240
        },
        {
          id: 'CS06',
          name: "กรีนการ์เดน ฟาร์มผักไฮโดรโปนิกส์",
          slogan: "ผักสลัดสด กรอบ อร่อย ปลอดภัย ไร้สารเคมี ส่งตรงจากแปลงฟาร์ม",
          category: "เกษตร & ชุมชน",
          categoryIcon: "las la-leaf",
          categoryColor: "#059669",
          location: "อ.ห้วยยอด จ.ตรัง",
          coverImg: "https://images.unsplash.com/photo-1500937386664-56d1dfef3854?auto=format&fit=crop&w=600&q=80",
          logoImg: "https://images.unsplash.com/photo-1592417817098-8f3d69104a47?auto=format&fit=crop&w=150&q=80",
          workPhotos: [
            "https://images.unsplash.com/photo-1500937386664-56d1dfef3854?auto=format&fit=crop&w=800&q=80"
          ],
          tags: ["สติกเกอร์ฉลากกันน้ำ", "X-Stand ออกบูธ", "ป้ายฟาร์ม"],
          phone: "084-333-2109",
          qrUrl: "https://maps.google.com/?q=Green+Garden+Farm+Trang",
          facebookUrl: "https://www.facebook.com/greengardenfarmtrang",
          verifiedSignage: "สั่งผลิตสติกเกอร์ฉลากสินค้ากันน้ำ & สื่อสิ่งพิมพ์แพ็กเกจจิ้ง",
          signSpec: { type: 'S01', name: 'สติกเกอร์ไดคัทA3', w: 1, h: 1, detail: 'สติกเกอร์ฉลากสินค้า PP กันน้ำ 100% ไดคัทพร้อมลอกติดถุงผักสลัด แช่ตู้เย็นได้ไม่ลอก' },
          rating: 4.9,
          reviewCount: 76
        }
      ]
    },

    settings: {
      defaultTheme: "light", // 'light' or 'dark'
      // Website branding
      webShopName: "ร้านทำดีมีเดีย",
      webShopSubname: "TUMDEEMEDIA",
      webShopLetter: "T",
      webShopLogoUrl: "",
      webShopLogoSize: 52,
      webShopSlogan: "โรงพิมพ์ป้ายและสื่อสิ่งพิมพ์ครบวงจรอันดับ 1 เมืองตรัง",

      // Accounting document header branding (Can be different from web)
      docShopName: "ร้านทำดีมีเดีย",
      docShopSubname: "TUMDEEMEDIA",
      docShopLetter: "T",
      docShopLogoUrl: "",
      docShopTaxId: "3920100923387",
      docShopPhone: "062-419-8365",
      docShopAddress: "125/1 ม.1 ต.หนองตรุด อ.เมืองตรัง จ.ตรัง 92000",
      docShopLine: "tumdeemedia",
      docShopEmail: "tumdeemediatrang@gmail.com",
      docBankName: "ธนาคารไทยพาณิชย์ (SCB) สาขาตรัง",
      docBankAccount: "590-264768-1",
      docBankPromptPay: "0950259996",
      docPaymentTerms: "งานสั่งผลิตมัดจำ 50% ก่อนขึ้นแบบผลิต และชำระส่วนที่เหลือก่อนส่งมอบ",
      docStampTitle: "ร้านทำดีมีเดีย",
      docStampSub: "TUMDEE MEDIA",
      docStampCenter: "★ OFFICIAL ★",
      docStampTaxId: "3920100923387",

      // Legacy fallback compatibility
      shopName: "ร้านทำดีมีเดีย",
      shopSubname: "TUMDEEMEDIA",
      shopLetter: "T",
      shopLogoUrl: "",
      shopLogoSize: 52,
      shopSlogan: "โรงพิมพ์ป้ายและสื่อสิ่งพิมพ์ครบวงจรอันดับ 1 เมืองตรัง",
      shopTaxId: "3920100923387",
      shopPhone: "062-419-8365",
      shopAddress: "125/1 ม.1 ต.หนองตรุด อ.เมืองตรัง จ.ตรัง 92000",
      shopLine: "tumdeemedia",
      shopEmail: "tumdeemediatrang@gmail.com",
      enableChatbot: true,
      chatbotName: "Q-Bot (ผู้ช่วยอัจฉริยะ TUMDEEMEDIA)",
      chatbotWelcome: "สวัสดีครับ! ผม Q-Bot ยินดีให้บริการ หากต้องการประเมินราคา สามารถพิมพ์คำว่า 'สอบถามราคา' หรือเลือกหัวข้อคำถามแนะนำด้านล่างได้เลยครับ 👇",
      chatbotFallback: "ขออภัยครับ ข้อความนี้อยู่นอกเหนือระบบตอบคำถามอัตโนมัติ คุณลูกค้าสามารถกดปุ่มสีเขียวเพื่อคุยกับแอดมินทาง line : tumdeemedia หรือโทร 062-419-8365 ได้ทันทีครับ",
      linkLine: "https://line.me/ti/p/~tumdeemedia",
      linkFb: "https://m.me/tumdeemediatrang",
      linkPhone: "062-419-8365",
      contactLineId: "tumdeemedia",
      contactFbId: "tumdeemediatrang",
      workingHours: "จันทร์ - เสาร์: 08:30 - 18:00 น. (หยุดวันอาทิตย์)",
      enableFloatingLine: false,
      enableFab: true,
      chatbotCalcKeywords: "สอบถาม, ไวนิล, สติกเกอร, ขนาด, งาน, ราคา, คำนวณ, เช็คราคา, ตารางเมตร, ประเมินราคา",
      chatbotCalcIntro: "ต้องการประเมินราคาเบื้องต้นใช่ไหมครับ? ระบุขนาด กว้าง x สูง (เมตร) ได้ในกล่องคำนวณหน้าแรก หรือแจ้งรายละเอียดในแชทนี้ได้เลยครับ 👇",
      quickReplies: [
        "เช็คราคาป้ายไวนิล",
        "รับทำป้ายไฟไหม?",
        "ใช้เวลาผลิตกี่วัน?",
        "ขอปรึกษาเรื่องแบบงาน",
        "ช่องทางโอนเงิน/มัดจำ",
        "เวลาทำการและที่อยู่ร้าน"
      ],
      chatbotRules: [
        {
          keyword: "ที่อยู่",
          reply: "ออฟฟิศและโรงงานของเราตั้งอยู่ที่ 125/1 ม.1 ต.หนองตรุด อ.เมือง จ.ตรัง 92000 ครับ สามารถดูแผนที่ Google Maps ได้ที่ด้านล่างสุดของเว็บไซต์เลยครับ"
        },
        {
          keyword: "ป้ายไฟ",
          reply: "เรารับทำป้ายไฟทุกรูปแบบครับ เช่น ป้ายกล่องไฟตู้ไฟอะคริลิค, ป้ายอักษรโลหะซ่อนไฟ LED Module กันน้ำ 100% รับประกันระบบไฟ 1 ปีเต็ม พร้อมบริการติดตั้งทั่วภาคใต้ครับ"
        },
        {
          keyword: "ผลิตกี่วัน",
          reply: "งานพิมพ์อิงค์เจ็ททั่วไป 1-3 วันทำการ งานป้ายกล่องไฟและโครงสร้าง 5-7 วันทำการครับ หากต้องการงานด่วนวันต่อวันสามารถแจ้งฝ่ายผลิตเพื่อเร่งคิวได้ครับ"
        },
        {
          keyword: "โอนเงิน",
          reply: "สามารถชำระเงินมัดจำ 50% หรือเต็มจำนวนผ่าน บัญชี SCB เลขที่ 590-264768-1 หรือพร้อมเพย์ 0950259996 (สมาร์ท ทูเดย์ โดยนายธีราธร คนเที่ยง) แล้วแนบสลิปในระบบได้ทันทีครับ"
        },
        {
          keyword: "เวลาทำการ",
          reply: "เวลาทำการร้าน TUMDEEMEDIA: วันจันทร์ - วันเสาร์ เวลา 08:30 - 18:00 น. (หยุดวันอาทิตย์ แต่สามารถส่งออเดอร์ออนไลน์ผ่านเว็บได้ตลอด 24 ชม. ครับ)"
        },
        {
          keyword: "ไวนิล",
          reply: "ป้ายไวนิลทึบแสงเริ่มต้น ตร.ม. ละ 150 บาท (Outdoor) พิมพ์ด้วยความละเอียดสูง สีสด ทนแดด ทนฝน ฟรีพับขอบเจาะตาไก่ทุกชิ้นงานครับ"
        }
      ],
      chatHistory: [
        { sender: "bot", text: "สวัสดีครับ! ผม Q-Bot ยินดีให้บริการ หากต้องการทราบราคา พิมพ์คำว่า 'สอบถามราคา' หรือกดปุ่มลัดด้านล่างได้เลยครับ" }
      ]
    },

    agents: [
      { id: 'A001', username: 'somchai_ds', password: 'password123', name: 'คุณสมชาย', shop: 'ร้านดีไซน์ป้ายตรัง', phone: '0812345678', line: 'somchai_ds', address: '44/1 ถ.กันตัง ต.ทับเที่ยง อ.เมือง จ.ตรัง 92000', taxId: '0925561004567', status: 'approved', sales: 45000, commission: 6750, tier: 'Pro', joinDate: '2025-01-10' },
      { id: 'A002', username: 'malee_print', password: 'malee2026', name: 'คุณมาลี', shop: 'มาลี พริ้นติ้ง', phone: '0899998888', line: 'malee_print', address: '18 ถ.เจิมปัญญา ต.ทับเที่ยง อ.เมือง จ.ตรัง 92000', taxId: '0925563009988', status: 'approved', sales: 12000, commission: 1200, tier: 'Standard', joinDate: '2025-02-15' },
      { id: 'A003', username: 'event_org', password: 'event999', name: 'คุณธวัชชัย', shop: 'บจก. อีเวนต์ ออร์แกไนเซอร์', phone: '0855554444', line: 'event_org', address: '120/5 ถ.ศรีตรัง ต.กระบี่ใหญ่ อ.เมือง จ.กระบี่ 81000', taxId: '0815560007788', status: 'pending', sales: 0, commission: 0, tier: 'Standard', joinDate: '2025-03-01' }
    ],

    customers: [
      { id: 'C001', name: 'บริษัท สมบูรณ์ จำกัด', phone: '0891112222', line: 'somboon_corp', address: '12/4 ถ.วิเศษกุล ต.ทับเที่ยง อ.เมือง จ.ตรัง 92000', taxId: '0925559001234', tier: 'Gold', totalSpend: 54000, points: 540, orderCount: 8, creditTerm: 'เครดิต 30 วัน' },
      { id: 'C002', name: 'คุณสมศรี', phone: '0812223333', line: 'somsri.design', address: '88 หมู่ 3 ต.คอหงส์ อ.หาดใหญ่ จ.สงขลา 90110', taxId: '1909800123456', tier: 'Platinum', totalSpend: 89000, points: 890, orderCount: 15, creditTerm: 'เครดิต 15 วัน' },
      { id: 'C003', name: 'ร้านกาแฟ คาเฟ่ ชิค', phone: '0854445555', line: 'cafe_chic_trang', address: '45 ถ.พระราม 6 ต.ทับเที่ยง อ.เมือง จ.ตรัง 92000', taxId: '0923562000889', tier: 'Silver', totalSpend: 18500, points: 185, orderCount: 3, creditTerm: 'เงินสด' },
      { id: 'C004', name: 'เทศบาลนครตรัง', phone: '075-111-222', line: 'trang_city_gov', address: 'ถ.พัทลุง ต.ทับเที่ยง อ.เมือง จ.ตรัง 92000', taxId: '0994000160012', tier: 'VIP', totalSpend: 150000, points: 1500, orderCount: 12, creditTerm: 'วางบิลราชการ' },
      { id: 'C005', name: 'บจก. พัฒนาอสังหา อันดามัน', phone: '0887778888', line: 'andaman_asset', address: '99/1 ถ.เจ้าฟ้าตะวันตก ต.ฉลอง อ.เมือง จ.ภูเก็ต 83000', taxId: '0835560002143', tier: 'Gold', totalSpend: 62000, points: 620, orderCount: 6, creditTerm: 'เครดิต 30 วัน' }
    ],

    agentAnnouncements: [
      { id: 'AN-1', date: new Date().toISOString().split('T')[0], title: '📢 ปรับเพิ่มค่าคอมมิชชันป้ายกล่องไฟและอักษรโลหะ เป็น 20%', content: 'ยินดีกับตัวแทนทุกท่าน ตลอดเดือนนี้เมื่อเปิดออเดอร์งานป้ายไฟและอักษรโลหะ รับค่าคอมมิชชันพิเศษ 20% ทันที', priority: 'high' },
      { id: 'AN-2', date: new Date(Date.now() - 3 * 86400000).toISOString().split('T')[0], title: '⚡ อัปเกรดเครื่องพิมพ์ใหม่ UV 1440dpi คมชัดทุกตารางนิ้ว', content: 'งานสติกเกอร์และไวนิลความละเอียดสูง รองรับงานเร่งด่วน ผลิตเสร็จไว สามารถรับงานด่วนวันต่อวันได้แล้ววันนี้', priority: 'normal' }
    ],

    orders: [
      {
        id: 'TM-9001',
        date: new Date(Date.now() - 2 * 86400000).toISOString(),
        dueDate: new Date(Date.now() + 5 * 86400000).toISOString().split('T')[0],
        customerName: 'บริษัท สมบูรณ์ จำกัด',
        customerPhone: '0891112222',
        customerTaxId: '0925562001122',
        customerBranch: 'สำนักงานใหญ่',
        customerContact: 'คุณสมบูรณ์ จิตดี',
        customerAddress: '12/4 ถ.วิเศษกุล ต.ทับเที่ยง อ.เมือง จ.ตรัง 92000',
        installType: 'pickup',
        priority: 'normal',
        items: [{ id: 'i1', type: 'V01', w: 3, h: 2, qty: 1, finish: 'eyelet', detail: 'ป้ายหน้าร้านไวนิล 360dpi ซีลขอบเจาะตาไก่' }],
        subtotal: 900,
        installCost: 0,
        discount: 0,
        beforeVat: 900,
        vat: 63,
        net: 963,
        status: 'Sales',
        payment: 'Unpaid',
        agentId: '',
        slipImg: null,
        graphicNote: 'ลูกค้าขอฟอนต์หนา ชัดเจน โทนสีน้ำเงิน-ส้ม',
        shippingCarrier: 'รับเองที่ร้าน (Pickup)',
        trackingCode: 'PICKUP-9001',
        boxWeight: '1.2 กก.',
        isCod: false,
        codAmount: 0,
        logisticsStatus: 'pending_schedule'
      },
      {
        id: 'TM-9002',
        date: new Date(Date.now() - 5 * 86400000).toISOString(),
        dueDate: new Date(Date.now() - 1 * 86400000).toISOString().split('T')[0],
        customerName: 'คุณสมศรี เจริญสุข',
        customerPhone: '0812223333',
        customerTaxId: '1929900281721',
        customerBranch: 'บุคคลธรรมดา',
        customerContact: 'คุณสมศรี',
        customerAddress: '88 หมู่ 3 ต.คอหงส์ อ.หาดใหญ่ จ.สงขลา 90110',
        installType: 'parcel',
        priority: 'rush',
        items: [{ id: 'i2', type: 'V02', w: 1, h: 1, qty: 50, finish: 'none', detail: 'ฉลากสินค้ากันน้ำ ไดคัทวงกลม 4 ซม.' }],
        subtotal: 17500,
        installCost: 150,
        discount: 0,
        beforeVat: 17650,
        vat: 0,
        net: 17650,
        status: 'Production',
        payment: 'Deposit',
        agentId: 'A001',
        slipImg: 'https://placehold.co/400x600/f1f5f9/1e3a8a?text=Slip+Deposit',
        proofImg: 'https://images.unsplash.com/photo-1586880244406-556ebe35f282?auto=format&fit=crop&w=600&q=80',
        proofStatus: 'approved',
        proofNote: 'ลูกค้าอนุมัติแบบแล้ว ปรับสีเข้มขึ้น 5% ตามคำขอ',
        graphicNote: 'จัดพิมพ์ลงเครื่อง M01 ด่วนที่สุด',
        shippingCarrier: 'Flash Express',
        trackingCode: 'TH8801928374A',
        boxWeight: '3.5 กก.',
        isCod: true,
        codAmount: 8825,
        logisticsStatus: 'pending_schedule'
      },
      {
        id: 'TM-9003',
        date: new Date(Date.now() - 10 * 86400000).toISOString(),
        dueDate: new Date(Date.now() - 5 * 86400000).toISOString().split('T')[0],
        customerName: 'ร้านกาแฟ คาเฟ่ ชิค (สาขาพระราม 6)',
        customerPhone: '0854445555',
        customerTaxId: '0923565009841',
        customerBranch: 'สาขาที่ 00001',
        customerContact: 'คุณมงคล (เจ้าของร้าน)',
        customerAddress: '45 ถ.พระราม 6 ต.ทับเที่ยง อ.เมือง จ.ตรัง 92000',
        installType: 'standard',
        priority: 'normal',
        items: [{ id: 'i3', type: 'S01', w: 1, h: 1, qty: 2, finish: 'none', detail: 'ป้ายกล่องไฟ 2 หน้า อะคริลิกปั๊มนูน พร้อมไฟ LED' }],
        subtotal: 900,
        installCost: 500,
        discount: 0,
        beforeVat: 1400,
        vat: 98,
        net: 1498,
        status: 'Done',
        payment: 'Paid',
        agentId: '',
        slipImg: 'https://placehold.co/400x600/f1f5f9/1e3a8a?text=Slip+Full+Paid',
        graphicNote: 'ติดตั้งเรียบร้อย ลูกค้าเซ็นรับมอบงานแล้ว',
        assignedTechId: 'ST01',
        assignedTech: 'นายช่างใหญ่ แข็งขัน',
        techPhone: '081-111-1111',
        vehiclePlate: 'ผก-1234 ตรัง',
        scheduledDate: new Date(Date.now() - 6 * 86400000).toISOString().split('T')[0],
        scheduledTime: '10:00 น.',
        siteType: 'อาคารพาณิชย์ 2 ชั้น ยื่นออกจากเสา',
        siteHeight: '3.2 เมตร',
        specialTools: 'บันไดสไลด์ 5 ม., สว่านกระแทก, ชุดพุกเหล็ก 5/16',
        siteGps: '7.5582,99.6101',
        logisticsStatus: 'completed',
        beforePhotos: ['https://images.unsplash.com/photo-1555529771-835f59fc5efe?auto=format&fit=crop&w=400&q=80'],
        afterPhotos: ['https://images.unsplash.com/photo-1565515268482-17180dc3c1ea?auto=format&fit=crop&w=400&q=80'],
        signOffCustomer: 'คุณมงคล รักษ์ดี',
        signOffDate: new Date(Date.now() - 5 * 86400000).toISOString().split('T')[0]
      },
      {
        id: 'TM-9004',
        date: new Date().toISOString(),
        dueDate: new Date(Date.now() + 10 * 86400000).toISOString().split('T')[0],
        customerName: 'เทศบาลนครตรัง',
        customerPhone: '075-111-222',
        customerTaxId: '0994000158221',
        customerBranch: 'สำนักงานใหญ่',
        customerContact: 'นายประสิทธิ์ สุขเกษม (หัวหน้าฝ่ายประชาสัมพันธ์)',
        customerAddress: 'ถ.พัทลุง ต.ทับเที่ยง อ.เมือง จ.ตรัง 92000',
        installType: 'crane',
        priority: 'normal',
        items: [{ id: 'i4', type: 'V01', w: 10, h: 5, qty: 1, finish: 'sleeve', detail: 'ป้ายประชาสัมพันธ์งานเทศกาลไวนิลโครงสร้างเหล็กขนาดใหญ่' }],
        subtotal: 7500,
        installCost: 5000,
        discount: 0,
        beforeVat: 12500,
        vat: 875,
        net: 13375,
        status: 'Graphic',
        payment: 'Deposit',
        agentId: '',
        slipImg: 'https://placehold.co/400x600/f1f5f9/1e3a8a?text=Slip+Deposit',
        proofImg: 'https://images.unsplash.com/photo-1541701494587-cb58502866ab?auto=format&fit=crop&w=600&q=80',
        proofStatus: 'pending',
        proofNote: 'แบบร่างป้ายขนาด 10x5 ม. รอการอนุมัติ E-Proof จากลูกค้า',
        graphicNote: 'รอลูกค้าคอนเฟิร์ม E-Proof ทางไลน์',
        assignedTechId: 'ST01',
        assignedTech: 'นายช่างใหญ่ แข็งขัน',
        techPhone: '081-111-1111',
        vehiclePlate: 'รถเครนกระเช้า 12 เมตร (ทะเบียน 82-5544 ตรัง)',
        scheduledDate: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
        scheduledTime: '08:30 น.',
        siteType: 'เสาโครงเหล็กบิลบอร์ดริมถนนพัทลุง (หน้าหอนาฬิกา)',
        siteHeight: '8.5 เมตร',
        specialTools: 'รถกระเช้าเครน 12 เมตร, เข็มขัดนิรภัยเต็มตัว Safety Harness, รอกสลิง',
        siteGps: '7.5574,99.6120',
        logisticsStatus: 'scheduled'
      },
      {
        id: 'TM-9005',
        date: new Date(Date.now() - 1 * 86400000).toISOString(),
        dueDate: new Date(Date.now() + 2 * 86400000).toISOString().split('T')[0],
        customerName: 'บจก. พัฒนาอสังหา อันดามัน',
        customerPhone: '0887778888',
        customerTaxId: '0835560002341',
        customerBranch: 'สำนักงานใหญ่',
        customerContact: 'คุณอนันต์ ชาญวิทย์ (วิศวกรโครงการ)',
        customerAddress: '99/1 ถ.เจ้าฟ้าตะวันตก ต.ฉลอง อ.เมือง จ.ภูเก็ต 83000',
        installType: 'standard',
        priority: 'rush',
        items: [{ id: 'i5', type: 'R01', w: 1, h: 1, qty: 10, finish: 'none', detail: 'ป้ายบอกทางโครงการพลาสวูด 5 มม. ฉลุ CNC พร้อมขารอง' }],
        subtotal: 9000,
        installCost: 500,
        discount: 0,
        beforeVat: 9500,
        vat: 665,
        net: 10165,
        status: 'Logistics',
        payment: 'Unpaid',
        agentId: '',
        slipImg: null,
        graphicNote: 'นัดหมายช่างติดตั้งวันที่ 28 เวลา 09:00 น.',
        assignedTechId: 'ST02',
        assignedTech: 'นายอนุชา งานพิมพ์ (และทีมช่าง)',
        techPhone: '084-222-3333',
        vehiclePlate: 'ผก-7788 ตรัง (รถกระบะแค็ป)',
        scheduledDate: new Date(Date.now() + 1 * 86400000).toISOString().split('T')[0],
        scheduledTime: '09:00 น.',
        siteType: 'โครงการหมู่บ้านจัดสรร ติดตั้งรอบวงเวียนและทางแยก',
        siteHeight: '2.5 เมตร',
        specialTools: 'นั่งร้านอลูมิเนียม, ปืนยิงซิลิโคนโครงสร้าง, เทปกาว 3M VHB',
        siteGps: '7.8480,98.3444',
        logisticsStatus: 'on_the_way',
        beforePhotos: ['https://images.unsplash.com/photo-1541701494587-cb58502866ab?auto=format&fit=crop&w=400&q=80'],
        afterPhotos: []
      }
    ],

    catalog: [
      // === 1. กลุ่มงานป้ายและสื่อสิ่งพิมพ์มาตรฐาน (Standard Signage & Print Products) ===
      { itemType: 'product', category: 'งานพิมพ์ไวนิล & ป้าย', id: 'V01', name: 'ป้ายไวนิล Frontlit 440g (ความละเอียดสูง ทนแดด)', cost: 60, price: 150, stock: 1500, unit: 'ตร.ม.' },
      { itemType: 'product', category: 'งานพิมพ์ไวนิล & ป้าย', id: 'V02', name: 'ป้ายไวนิลทึบแสง Blacklit (พิมพ์ 2 หน้า พับประกบ)', cost: 110, price: 280, stock: 650, unit: 'ตร.ม.' },
      { itemType: 'product', category: 'งานพิมพ์ไวนิล & ป้าย', id: 'V03', name: 'ป้ายไวนิลโปร่งแสง Backlit สำหรับตู้ไฟเรืองแสง', cost: 130, price: 320, stock: 450, unit: 'ตร.ม.' },
      { itemType: 'product', category: 'งานพิมพ์ไวนิล & ป้าย', id: 'V04', name: 'ป้ายไวนิลขึงโครงเหล็กกัลวาไนซ์ พร้อมติดตั้งหน้าร้าน', cost: 350, price: 850, stock: 200, unit: 'ตร.ม.' },

      { itemType: 'product', category: 'ป้ายตั้ง & อุปกรณ์ออกบูธ', id: 'F01', name: 'ธงญี่ปุ่น J-Flag (พิมพ์ไวนิล 2 หน้า พร้อมขาตั้งโครงเหล็ก)', cost: 220, price: 450, stock: 80, unit: 'ชุด' },
      { itemType: 'product', category: 'ป้ายตั้ง & อุปกรณ์ออกบูธ', id: 'P01', name: 'สแตนดี้ฟิวเจอร์บอร์ด/พลาสวูด ไดคัทตามทรง + ขาตั้งปีกนก', cost: 280, price: 550, stock: 70, unit: 'ชุด' },
      { itemType: 'product', category: 'ป้ายตั้ง & อุปกรณ์ออกบูธ', id: 'P02', name: 'โรลอัป Roll-Up Banner อะลูมิเนียมพับเก็บได้ (80x200 ซม.)', cost: 450, price: 950, stock: 60, unit: 'ชุด' },
      { itemType: 'product', category: 'ป้ายตั้ง & อุปกรณ์ออกบูธ', id: 'X01', name: 'ป้าย X-Stand ปรับขนาดได้ พร้อมภาพพิมพ์ PVC เคลือบด้าน', cost: 180, price: 390, stock: 95, unit: 'ชุด' },

      { itemType: 'product', category: 'งานพิมพ์สติกเกอร์ไดคัท', id: 'S01', name: 'สติกเกอร์ฉลากสินค้า ไดคัทขนาด A3 (PP/PVC กันน้ำ 100%)', cost: 35, price: 80, stock: 500, unit: 'แผ่น' },
      { itemType: 'product', category: 'งานพิมพ์สติกเกอร์ไดคัท', id: 'S02', name: 'สติกเกอร์ PVC ขาวเงา/ขาวด้าน เคลือบฟิล์มกันรอยยูวี', cost: 150, price: 350, stock: 400, unit: 'ตร.ม.' },
      { itemType: 'product', category: 'งานพิมพ์สติกเกอร์ไดคัท', id: 'S03', name: 'สติกเกอร์ไดคัทตัวอักษร / สติกเกอร์ติดกระจกหน้าร้าน', cost: 180, price: 450, stock: 300, unit: 'ตร.ม.' },
      { itemType: 'product', category: 'งานพิมพ์สติกเกอร์ไดคัท', id: 'S04', name: 'สติกเกอร์ซีทรู (See-Through) ติดกระจกมองออกด้านเดียว', cost: 220, price: 550, stock: 180, unit: 'ตร.ม.' },
      { itemType: 'product', category: 'งานพิมพ์สติกเกอร์ไดคัท', id: 'S05', name: 'สติกเกอร์ฝ้าติดกระจก ไดคัทลวดลาย & โลโก้สำนักงาน', cost: 190, price: 490, stock: 220, unit: 'ตร.ม.' },
      { itemType: 'product', category: 'งานพิมพ์สติกเกอร์ไดคัท', id: 'S06', name: 'สติกเกอร์สะท้อนแสง 3M ป้ายความปลอดภัย & ป้ายจราจร', cost: 350, price: 850, stock: 120, unit: 'ตร.ม.' },

      { itemType: 'product', category: 'สติกเกอร์ติดบอร์ด & พลาสวูด', id: 'B01', name: 'สติกเกอร์ติดฟิวเจอร์บอร์ด 3 มิล (PP Board ป้ายชั่วคราว/โปรโมชั่น)', cost: 160, price: 400, stock: 250, unit: 'ตร.ม.' },
      { itemType: 'product', category: 'สติกเกอร์ติดบอร์ด & พลาสวูด', id: 'B02', name: 'สติกเกอร์ติดฟิวเจอร์บอร์ด 5 มิล (PP Board หนา แข็งแรง)', cost: 200, price: 500, stock: 200, unit: 'ตร.ม.' },
      { itemType: 'product', category: 'สติกเกอร์ติดบอร์ด & พลาสวูด', id: 'W01', name: 'สติกเกอร์ติดพลาสวูด 3 มิล (Plastwood กันน้ำ ไม่ลามไฟ)', cost: 320, price: 750, stock: 150, unit: 'ตร.ม.' },
      { itemType: 'product', category: 'สติกเกอร์ติดบอร์ด & พลาสวูด', id: 'W02', name: 'สติกเกอร์ติดพลาสวูด 5 มิล (Plastwood ป้ายหน้าร้าน/เมนู)', cost: 420, price: 950, stock: 120, unit: 'ตร.ม.' },
      { itemType: 'product', category: 'สติกเกอร์ติดบอร์ด & พลาสวูด', id: 'W03', name: 'ป้ายพลาสวูดฉลุลาย CNC ไดคัทตัวอักษรนูน หนา 10 มิล', cost: 580, price: 1350, stock: 80, unit: 'ตร.ม.' },
      { itemType: 'product', category: 'สติกเกอร์ติดบอร์ด & พลาสวูด', id: 'W04', name: 'ป้ายพลาสวูดฉลุลาย CNC หนา 15 มิล ทำสีพ่นอุตสาหกรรม', cost: 790, price: 1850, stock: 50, unit: 'ตร.ม.' },

      { itemType: 'product', category: 'ป้ายอะคริลิค & งานเลเซอร์', id: 'AC01', name: 'ป้ายอะคริลิคใส/ขาว 3 มิล พิมพ์ UV คมชัดสูง + หมุดลอยสแตนเลส', cost: 450, price: 1100, stock: 90, unit: 'ตร.ม.' },
      { itemType: 'product', category: 'ป้ายอะคริลิค & งานเลเซอร์', id: 'AC02', name: 'ป้ายหน้าห้อง / ป้ายแผนก อะคริลิคประกบ 2 ชั้น พร้อมขายึด', cost: 150, price: 390, stock: 120, unit: 'ชิ้น' },
      { itemType: 'product', category: 'ป้ายอะคริลิค & งานเลเซอร์', id: 'AC03', name: 'ป้าย QR Code รับเงิน / ป้ายตั้งโต๊ะ อะคริลิคดัดพับตัว T หรือ L', cost: 65, price: 160, stock: 250, unit: 'อัน' },

      { itemType: 'product', category: 'ป้ายไฟ & ตู้ไฟ LED', id: 'V07', name: 'ป้ายตู้ไฟ LED สองหน้า อะคริลิคปั๊มนูน พร้อมขายึดติดผนัง', cost: 800, price: 1800, stock: 40, unit: 'ตร.ม.' },
      { itemType: 'product', category: 'ป้ายไฟ & ตู้ไฟ LED', id: 'LB01', name: 'ป้ายตู้ไฟวงกลมหมุน LED สองหน้า (เส้นผ่านศูนย์กลาง 50-80 ซม.)', cost: 1200, price: 2900, stock: 25, unit: 'ตู้' },
      { itemType: 'product', category: 'ป้ายไฟ & ตู้ไฟ LED', id: 'NF01', name: 'ป้ายไฟนีออนดัด LED Neon Flex ดัดตามฟอนต์/โลโก้ บนแผ่นอะคริลิค', cost: 950, price: 2400, stock: 35, unit: 'ชุด' },

      { itemType: 'product', category: 'ตัวอักษรโลหะ & คอมโพสิต', id: 'MT01', name: 'ตัวอักษรโลหะซิงค์พ่นสี ยกขอบ 3D อบสีอุตสาหกรรม', cost: 700, price: 1600, stock: 45, unit: 'ตร.ม.' },
      { itemType: 'product', category: 'ตัวอักษรโลหะ & คอมโพสิต', id: 'MT02', name: 'ตัวอักษรสแตนเลสเงินเงา/ทองเงา แฮร์ไลน์ ยกขอบหรูหรา', cost: 1100, price: 2500, stock: 30, unit: 'ตร.ม.' },
      { itemType: 'product', category: 'ตัวอักษรโลหะ & คอมโพสิต', id: 'CP01', name: 'ป้ายแผงอลูมิเนียมคอมโพสิต ตกแต่ง Facade หน้าร้านพร้อมโครงเหล็ก', cost: 950, price: 2200, stock: 40, unit: 'ตร.ม.' },

      { itemType: 'product', category: 'งานพิมพ์เอกสาร & การ์ด', id: 'C01', name: 'นามบัตรพรีเมียม กระดาษอาร์ต 350 แกรม เคลือบด้าน (กล่องละ 100 ใบ)', cost: 90, price: 250, stock: 300, unit: 'กล่อง' },
      { itemType: 'product', category: 'งานพิมพ์เอกสาร & การ์ด', id: 'C02', name: 'นามบัตรเคลือบด้าน + Spot UV โลโก้นูนมันวาว', cost: 150, price: 380, stock: 200, unit: 'กล่อง' },
      { itemType: 'product', category: 'งานพิมพ์เอกสาร & การ์ด', id: 'M01', name: 'เล่มเมนูอาหาร เข้าเล่มสันเกลียว เคลือบแข็งกันน้ำ 100%', cost: 60, price: 150, stock: 200, unit: 'เล่ม' },
      { itemType: 'product', category: 'งานพิมพ์เอกสาร & การ์ด', id: 'P03', name: 'พรินท์สีดิจิตอล เลเซอร์คมชัดสูง กระดาษอาร์ตการ์ด A4', cost: 5, price: 15, stock: 1000, unit: 'แผ่น' },
      { itemType: 'product', category: 'งานพิมพ์เอกสาร & การ์ด', id: 'P04', name: 'พรินท์สีดิจิตอล + เคลือบลามิเนตเงา/ด้าน A4', cost: 12, price: 35, stock: 1000, unit: 'แผ่น' },
      { itemType: 'product', category: 'งานพิมพ์เอกสาร & การ์ด', id: 'FL01', name: 'แผ่นพับ / โบรชัวร์ A4 พับ 2 ตอน หรือ 3 ตอน (อาร์ตมัน 130g)', cost: 3.5, price: 9, stock: 2500, unit: 'แผ่น' },
      { itemType: 'product', category: 'งานพิมพ์เอกสาร & การ์ด', id: 'ST01', name: 'ตรายางด่วนหมึกในตัว แฟลชสแตมป์ คมชัด หมึกกันน้ำ', cost: 120, price: 320, stock: 150, unit: 'อัน' },
      { itemType: 'product', category: 'งานพิมพ์เอกสาร & การ์ด', id: 'INV01', name: 'เล่มบิลเงินสด / ใบเสร็จรับเงิน / ใบส่งของ กระดาษก็อปปี้ในตัว (NCR 2-3 ชั้น)', cost: 45, price: 120, stock: 400, unit: 'เล่ม' },
      { itemType: 'product', category: 'สั่งผลิตพิเศษ', id: 'OTH', name: 'งานสั่งผลิตพิเศษตามสเปกลูกค้า (ระบุรายละเอียด)', cost: 0, price: 0, stock: 999, unit: 'รายการ' },

      // === 2. กลุ่มสต๊อกวัสดุ & อุปกรณ์การผลิต (Raw Materials & Inventory Supplies) ===
      { itemType: 'material', category: 'ม้วนผ้าใบไวนิล', id: 'MAT-VN-440', name: 'ม้วนไวนิล Frontlit 440g กว้าง 3.2 ม. x 50 ม.', cost: 2350, price: 3200, stock: 18, unit: 'ม้วน' },
      { itemType: 'material', category: 'ม้วนผ้าใบไวนิล', id: 'MAT-VN-360', name: 'ม้วนไวนิล Frontlit 360g กว้าง 2.5 ม. x 50 ม.', cost: 1650, price: 2300, stock: 14, unit: 'ม้วน' },
      { itemType: 'material', category: 'ม้วนผ้าใบไวนิล', id: 'MAT-VN-BLK', name: 'ม้วนไวนิล Blacklit ทึบแสง กว้าง 3.2 ม. x 50 ม.', cost: 3100, price: 4200, stock: 8, unit: 'ม้วน' },
      { itemType: 'material', category: 'ม้วนผ้าใบไวนิล', id: 'MAT-VN-BKL', name: 'ม้วนไวนิล Backlit ตู้ไฟ กว้าง 3.2 ม. x 50 ม.', cost: 3400, price: 4600, stock: 7, unit: 'ม้วน' },

      { itemType: 'material', category: 'ม้วนสติกเกอร์ & ฟิล์ม', id: 'MAT-ST-GLS', name: 'ม้วนสติกเกอร์ PVC ขาวเงา กว้าง 1.27 ม. x 50 ม.', cost: 1850, price: 2500, stock: 22, unit: 'ม้วน' },
      { itemType: 'material', category: 'ม้วนสติกเกอร์ & ฟิล์ม', id: 'MAT-ST-MAT', name: 'ม้วนสติกเกอร์ PVC ขาวด้าน กว้าง 1.52 ม. x 50 ม.', cost: 2150, price: 2900, stock: 16, unit: 'ม้วน' },
      { itemType: 'material', category: 'ม้วนสติกเกอร์ & ฟิล์ม', id: 'MAT-ST-CLR', name: 'ม้วนสติกเกอร์ใส PVC Clear กว้าง 1.27 ม. x 50 ม.', cost: 1950, price: 2650, stock: 12, unit: 'ม้วน' },
      { itemType: 'material', category: 'ม้วนสติกเกอร์ & ฟิล์ม', id: 'MAT-ST-FRO', name: 'ม้วนสติกเกอร์ฝ้าติดกระจก Frosted กว้าง 1.22 ม. x 50 ม.', cost: 2400, price: 3300, stock: 9, unit: 'ม้วน' },
      { itemType: 'material', category: 'ม้วนสติกเกอร์ & ฟิล์ม', id: 'MAT-ST-STR', name: 'ม้วนสติกเกอร์ซีทรู See-Through กว้าง 1.27 ม. x 50 ม.', cost: 2850, price: 3900, stock: 6, unit: 'ม้วน' },
      { itemType: 'material', category: 'ม้วนสติกเกอร์ & ฟิล์ม', id: 'MAT-ST-3M', name: 'ม้วนสติกเกอร์สะท้อนแสง 3M Commercial Grade กว้าง 1.22 ม.', cost: 6500, price: 8800, stock: 4, unit: 'ม้วน' },
      { itemType: 'material', category: 'ม้วนสติกเกอร์ & ฟิล์ม', id: 'MAT-FLM-LAM', name: 'ม้วนฟิล์มเคลือบเย็น ลามิเนตเงา/ด้าน กว้าง 1.27 ม. x 50 ม.', cost: 950, price: 1400, stock: 25, unit: 'ม้วน' },

      { itemType: 'material', category: 'แผ่นแข็ง & บอร์ด', id: 'MAT-FB-3MM', name: 'แผ่นฟิวเจอร์บอร์ด PP Board 3 มม. (1.30 x 2.45 ม.) คละสี', cost: 110, price: 160, stock: 120, unit: 'แผ่น' },
      { itemType: 'material', category: 'แผ่นแข็ง & บอร์ด', id: 'MAT-FB-5MM', name: 'แผ่นฟิวเจอร์บอร์ด PP Board 5 มม. (1.30 x 2.45 ม.)', cost: 175, price: 250, stock: 85, unit: 'แผ่น' },
      { itemType: 'material', category: 'แผ่นแข็ง & บอร์ด', id: 'MAT-PW-3MM', name: 'แผ่นพลาสวูด Plastwood เกรดภายนอก 3 มม. (1.22 x 2.44 ม.)', cost: 280, price: 390, stock: 45, unit: 'แผ่น' },
      { itemType: 'material', category: 'แผ่นแข็ง & บอร์ด', id: 'MAT-PW-5MM', name: 'แผ่นพลาสวูด Plastwood เกรดภายนอก 5 มม. (1.22 x 2.44 ม.)', cost: 420, price: 580, stock: 38, unit: 'แผ่น' },
      { itemType: 'material', category: 'แผ่นแข็ง & บอร์ด', id: 'MAT-PW-10MM', name: 'แผ่นพลาสวูด Plastwood เกรดภายนอก 10 มม. (1.22 x 2.44 ม.)', cost: 790, price: 1100, stock: 24, unit: 'แผ่น' },
      { itemType: 'material', category: 'แผ่นแข็ง & บอร์ด', id: 'MAT-PW-15MM', name: 'แผ่นพลาสวูด Plastwood เกรดภายนอก 15 มม. (1.22 x 2.44 ม.)', cost: 1150, price: 1580, stock: 15, unit: 'แผ่น' },

      { itemType: 'material', category: 'แผ่นอะคริลิค & คอมโพสิต', id: 'MAT-AC-CLR2', name: 'แผ่นอะคริลิคใสเกรด A หนา 2 มม. (1.22 x 2.44 ม.)', cost: 680, price: 950, stock: 30, unit: 'แผ่น' },
      { itemType: 'material', category: 'แผ่นอะคริลิค & คอมโพสิต', id: 'MAT-AC-CLR3', name: 'แผ่นอะคริลิคใสเกรด A หนา 3 มม. (1.22 x 2.44 ม.)', cost: 950, price: 1350, stock: 26, unit: 'แผ่น' },
      { itemType: 'material', category: 'แผ่นอะคริลิค & คอมโพสิต', id: 'MAT-AC-CLR5', name: 'แผ่นอะคริลิคใสเกรด A หนา 5 มม. (1.22 x 2.44 ม.)', cost: 1550, price: 2150, stock: 18, unit: 'แผ่น' },
      { itemType: 'material', category: 'แผ่นอะคริลิค & คอมโพสิต', id: 'MAT-AC-WHT3', name: 'แผ่นอะคริลิคขาวนม กระจายแสงตู้ไฟ 3 มม. (1.22 x 2.44 ม.)', cost: 1050, price: 1480, stock: 20, unit: 'แผ่น' },
      { itemType: 'material', category: 'แผ่นอะคริลิค & คอมโพสิต', id: 'MAT-CP-4MM', name: 'แผ่นอลูมิเนียมคอมโพสิต 4 มม. เคลือบ PE/PVDF (1.22 x 2.44 ม.)', cost: 1100, price: 1550, stock: 35, unit: 'แผ่น' },

      { itemType: 'material', category: 'หมึกพิมพ์ & สารเคมี', id: 'MAT-INK-SOL', name: 'หมึกพิมพ์ Solvent เกรด Outdoor แม่สี CMYK (แกลลอน 5 ลิตร)', cost: 1450, price: 2100, stock: 32, unit: 'แกลลอน' },
      { itemType: 'material', category: 'หมึกพิมพ์ & สารเคมี', id: 'MAT-INK-ECO', name: 'หมึกพิมพ์ Eco-Solvent สำหรับงาน Indoor/ฉลาก (ขวด 1 ลิตร)', cost: 650, price: 950, stock: 40, unit: 'ขวด' },
      { itemType: 'material', category: 'หมึกพิมพ์ & สารเคมี', id: 'MAT-INK-UV', name: 'หมึกพิมพ์ UV Curable (CMYK + White + Varnish - ขวด 1 ลิตร)', cost: 1200, price: 1750, stock: 20, unit: 'ขวด' },

      { itemType: 'material', category: 'อุปกรณ์ไฟ & ฮาร์ดแวร์', id: 'MAT-LED-MOD', name: 'โมดูลไฟ LED 3 ตา เลนส์กระจายแสง 160° 12V IP67 (แพ็ค 100 ชิ้น)', cost: 850, price: 1250, stock: 28, unit: 'แพ็ค' },
      { itemType: 'material', category: 'อุปกรณ์ไฟ & ฮาร์ดแวร์', id: 'MAT-PWR-400', name: 'สวิตชิ่งพาวเวอร์ซัพพลาย Switching Power Supply 12V 400W กันน้ำ', cost: 580, price: 850, stock: 22, unit: 'ตัว' },
      { itemType: 'material', category: 'อุปกรณ์ไฟ & ฮาร์ดแวร์', id: 'MAT-NF-STRIP', name: 'สายไฟนีออนดัด LED Neon Flex 12V กันน้ำ (ม้วน 5 เมตร คละสี)', cost: 220, price: 340, stock: 50, unit: 'ม้วน' },
      { itemType: 'material', category: 'อุปกรณ์ไฟ & ฮาร์ดแวร์', id: 'MAT-STL-1X1', name: 'เหล็กกล่องกัลวาไนซ์ 1"x1" หนา 1.2 มม. (เส้นยาว 6 ม.)', cost: 185, price: 260, stock: 65, unit: 'เส้น' },
      { itemType: 'material', category: 'อุปกรณ์ไฟ & ฮาร์ดแวร์', id: 'MAT-STL-15X15', name: 'เหล็กกล่องกัลวาไนซ์ 1.5"x1.5" หนา 1.5 มม. (ยาว 6 ม.)', cost: 290, price: 410, stock: 42, unit: 'เส้น' },
      { itemType: 'material', category: 'อุปกรณ์ไฟ & ฮาร์ดแวร์', id: 'MAT-EYE-28', name: 'ตาไก่เหล็ก/ทองเหลือง เบอร์ 28 สำหรับป้ายไวนิล (กล่อง 1,000 ตัว)', cost: 180, price: 280, stock: 45, unit: 'กล่อง' },
      { itemType: 'material', category: 'อุปกรณ์ไฟ & ฮาร์ดแวร์', id: 'MAT-ST-BOLT', name: 'หมุดลอยสแตนเลสยึดป้ายอะคริลิค Standoff Bolt 19x25 มม.', cost: 22, price: 45, stock: 350, unit: 'ตัว' },
      { itemType: 'material', category: 'อุปกรณ์ไฟ & ฮาร์ดแวร์', id: 'MAT-TP-3MVHB', name: 'เทปกาว 2 หน้าแรงยึดติดสูง 3M VHB อะคริลิคโฟม (ม้วน 12 มม. x 33 ม.)', cost: 380, price: 540, stock: 30, unit: 'ม้วน' },
      { itemType: 'material', category: 'อุปกรณ์ไฟ & ฮาร์ดแวร์', id: 'MAT-STD-WING', name: 'โครงขาตั้งปีกนกสำหรับสแตนดี้ฟิวเจอร์บอร์ด/พลาสวูด สูง 150 ซม.', cost: 95, price: 160, stock: 60, unit: 'ชุด' },
      { itemType: 'material', category: 'อุปกรณ์ไฟ & ฮาร์ดแวร์', id: 'MAT-RL-BASE', name: 'โครงฐานโรลอัปอะลูมิเนียมเกรดหนา ขนาด 80x200 ซม. พร้อมกระเป๋า', cost: 320, price: 480, stock: 40, unit: 'ชุด' },
      { itemType: 'material', category: 'อุปกรณ์ไฟ & ฮาร์ดแวร์', id: 'MAT-JF-BASE', name: 'ฐานโครงเหล็กธงญี่ปุ่น J-Flag ฐานสี่เหลี่ยมถ่วงน้ำหนัก', cost: 160, price: 260, stock: 55, unit: 'ชุด' }
    ],

    machines: [
      { id: 'M01', name: 'Inkjet 3.2m (Outdoor)', status: 'printing', job: 'TM-9002', history: [] },
      { id: 'M02', name: 'Inkjet 1.5m (Indoor)', status: 'idle', job: '', history: [] },
      { id: 'M03', name: 'เครื่องตัด CNC (Plastwood)', status: 'maintenance', job: '', history: [{ date: new Date().toISOString().split('T')[0], note: 'รออะไหล่หัวตัด' }] }
    ],

    expenses: [
      { id: 'E1', date: new Date().toISOString(), category: 'fuel', desc: 'ค่าน้ำมันรถขนส่งและทีมติดตั้งหน้างาน', amount: 800, payee: 'ปั๊ม ปตท. ตรัง', refDoc: 'INV-PTT-098', recordedBy: 'นายช่างใหญ่' },
      { id: 'E2', date: new Date(Date.now() - 1 * 86400000).toISOString(), category: 'stock', desc: 'ซื้อตาไก่เบอร์ 28 จำนวน 10 กล่อง และใบมีดคัตเตอร์', amount: 950, payee: 'ร้านรุ่งเรืองฮาร์ดแวร์', refDoc: 'RC-1102', recordedBy: 'ฝ่ายบัญชี' },
      { id: 'E3', date: new Date(Date.now() - 3 * 86400000).toISOString(), category: 'utility', desc: 'ค่าไฟฟ้าโรงงานและเครื่องจักร ประจำงวด', amount: 4850, payee: 'การไฟฟ้าส่วนภูมิภาค', refDoc: 'PEA-77312', recordedBy: 'ฝ่ายบัญชี' },
      { id: 'E4', date: new Date(Date.now() - 5 * 86400000).toISOString(), category: 'repair', desc: 'ค่าเปลี่ยนสายพานและตรวจเช็คหัวพิมพ์เครื่อง Outdoor 3.2m', amount: 2400, payee: 'บจก. อิงค์แมชชีนเนอรี่', refDoc: 'SRV-4421', recordedBy: 'นายช่างใหญ่' },
      { id: 'E5', date: new Date(Date.now() - 7 * 86400000).toISOString(), category: 'rent', desc: 'ค่าเช่าอาคารร้านและโกดังผลิต ประจำเดือน', amount: 15000, payee: 'คุณวิชัย เจ้าของอาคาร', refDoc: 'REC-RENT-09', recordedBy: 'ฝ่ายบัญชี' },
      { id: 'E6', date: new Date(Date.now() - 10 * 86400000).toISOString(), category: 'stock', desc: 'สั่งซื้อม้วนไวนิลทึบแสง 440g หน้ากว้าง 3.2 ม. 5 ม้วน', amount: 12500, payee: 'บจก. สยามมีเดียซัพพลาย', refDoc: 'INV-SMS-889', recordedBy: 'ฝ่ายผลิต' },
      { id: 'E7', date: new Date(Date.now() - 15 * 86400000).toISOString(), category: 'wage', desc: 'เบิกล่วงหน้า/ค่าแรงล่วงเวลา (OT) ทีมช่างติดตั้ง', amount: 3500, payee: 'ทีมช่างติดตั้ง', refDoc: 'OT-PAY-01', recordedBy: 'ฝ่ายบัญชี' },
      { id: 'E8', date: new Date(Date.now() - 20 * 86400000).toISOString(), category: 'marketing', desc: 'ค่าลงโฆษณา Facebook Ads และโปรโมทเพจร้าน', amount: 1800, payee: 'Meta Platforms', refDoc: 'FB-AD-991', recordedBy: 'ฝ่ายการตลาด' }
    ],

    // Accounts Payable (ร้านค้างจ่ายซัพพลายเออร์/ค่าของ/ค่าบริการ)
    payables: [
      { id: 'AP01', date: new Date(Date.now() - 5 * 86400000).toISOString().split('T')[0], dueDate: new Date(Date.now() + 3 * 86400000).toISOString().split('T')[0], supplier: 'บจก. สยามมีเดียซัพพลาย', desc: 'ค่าสั่งซื้อแผ่นพลาสวูด 5 มม. และอะคริลิคใส', amount: 18500, category: 'stock', status: 'unpaid' },
      { id: 'AP02', date: new Date(Date.now() - 12 * 86400000).toISOString().split('T')[0], dueDate: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0], supplier: 'ร้านตรังโลหะกิจ', desc: 'สั่งเหล็กกล่องกัลวาไนซ์ 1x1 และ 2x2 นิ้ว ทำโครงป้าย', amount: 9400, category: 'stock', status: 'unpaid' },
      { id: 'AP03', date: new Date(Date.now() - 2 * 86400000).toISOString().split('T')[0], dueDate: new Date(Date.now() + 10 * 86400000).toISOString().split('T')[0], supplier: 'บจก. อิงค์แมชชีนเนอรี่', desc: 'สั่งซื้อหมึกพิมพ์ Solvent และ UV Eco 8 แกลลอน', amount: 14000, category: 'stock', status: 'unpaid' },
      { id: 'AP04', date: new Date(Date.now() - 25 * 86400000).toISOString().split('T')[0], dueDate: new Date(Date.now() - 2 * 86400000).toISOString().split('T')[0], supplier: 'อู่ช่างเล็กการช่าง', desc: 'ค่าบำรุงรักษารถกระบะขนส่งและตรวจเช็คเครน', amount: 4200, category: 'repair', status: 'paid', paidDate: new Date(Date.now() - 1 * 86400000).toISOString().split('T')[0] }
    ],

    notifications: [
      { id: 'N1', time: '10:30', text: 'มีออเดอร์ใหม่ TM-9004 รอตรวจสอบและเตรียมแบบ', read: false, type: 'info' },
      { id: 'N2', time: '09:15', text: 'แจ้งเตือน: สต๊อก พลาสวูด (Plastwood) 5mm เหลือน้อยกว่าเกณฑ์', read: false, type: 'warning' },
      { id: 'N3', time: '08:45', text: 'แจ้งเตือนเจ้าหนี้: ครบกำหนดชำระค่าของ บจก. สยามมีเดียซัพพลาย ฿18,500 ในอีก 3 วัน', read: false, type: 'warning' }
    ],

    staffs: [
      {
        id: 'ST01',
        name: 'นายช่างใหญ่ แข็งขัน',
        nickname: 'ช่างใหญ่',
        position: 'หัวหน้าฝ่ายผลิตและควบคุมการติดตั้ง',
        dept: 'ฝ่ายผลิต/ติดตั้ง',
        type: 'monthly',
        wage: 22000,
        phone: '081-111-1111',
        line: 'changyai_tm',
        startDate: '2023-01-15',
        status: 'active',
        roleId: 'production'
      },
      {
        id: 'ST02',
        name: 'นายอนุชา งานพิมพ์',
        nickname: 'นุ',
        position: 'ช่างพิมพ์อิงค์เจ็ท & คุมเครื่องจักร UV',
        dept: 'ฝ่ายผลิต/ติดตั้ง',
        type: 'daily',
        wage: 600,
        phone: '084-222-3333',
        line: 'anucha_print',
        startDate: '2024-03-01',
        status: 'active',
        roleId: 'production'
      },
      {
        id: 'ST03',
        name: 'นายกราฟิก ดีไซน์เนอร์',
        nickname: 'อาร์ต',
        position: 'หัวหน้างานออกแบบและตรวจไฟล์ (Pre-press)',
        dept: 'ฝ่ายออกแบบ (Graphic)',
        type: 'monthly',
        wage: 25000,
        phone: '083-333-3333',
        line: 'graphic_pro',
        startDate: '2023-06-10',
        status: 'active',
        roleId: 'designer'
      },
      {
        id: 'ST04',
        name: 'นางสาวสมฤทัย ใจบัญชี',
        nickname: 'ฤทัย',
        position: 'เจ้าหน้าที่บัญชีและการเงิน',
        dept: 'ฝ่ายบัญชีและการเงิน',
        type: 'monthly',
        wage: 24000,
        phone: '086-444-5555',
        line: 'acc_somruthai',
        startDate: '2023-02-01',
        status: 'active',
        roleId: 'accountant'
      },
      {
        id: 'ST05',
        name: 'นางสาวขายดี ยิ้มแย้ม',
        nickname: 'ปลา',
        position: 'เจ้าหน้าที่ฝ่ายขายและดูแลลูกค้าสัมพันธ์',
        dept: 'ฝ่ายขายและลูกค้าสัมพันธ์',
        type: 'monthly',
        wage: 19000,
        phone: '082-222-2222',
        line: 'sales_kaidee',
        startDate: '2023-08-20',
        status: 'active',
        roleId: 'sales'
      },
      {
        id: 'ST06',
        name: 'นายธีราธร คนเที่ยง',
        nickname: 'ท็อป',
        position: 'กรรมการผู้จัดการ / เจ้าของร้าน (Owner)',
        dept: 'บริหารงานทั่วไป',
        type: 'monthly',
        wage: 45000,
        phone: '062-419-8365',
        line: 'tumdeemedia',
        startDate: '2020-01-01',
        status: 'active',
        roleId: 'admin'
      }
    ],

    payrollHistory: [
      {
        id: 'PAY-202509-01',
        staffId: 'ST01',
        staffName: 'นายช่างใหญ่ แข็งขัน',
        month: 'กันยายน 2026',
        date: new Date(Date.now() - 25 * 86400000).toISOString().split('T')[0],
        baseSalary: 22000,
        ot: 2400,
        bonus: 1000,
        deduction: 750,
        netPay: 24650,
        paymentMethod: 'โอนเข้าบัญชี SCB xxx-xxxx12',
        status: 'paid'
      },
      {
        id: 'PAY-202509-02',
        staffId: 'ST03',
        staffName: 'นายกราฟิก ดีไซน์เนอร์',
        month: 'กันยายน 2026',
        date: new Date(Date.now() - 25 * 86400000).toISOString().split('T')[0],
        baseSalary: 25000,
        ot: 1200,
        bonus: 1500,
        deduction: 750,
        netPay: 26950,
        paymentMethod: 'โอนเข้าบัญชี กสิกร xxx-xxxx88',
        status: 'paid'
      }
    ],

    services: [
      {
        id: 's1',
        cat: 'ไวนิล & สติกเกอร์',
        icon: 'las la-print',
        title: 'งานพิมพ์อิงค์เจ็ท (Inkjet Print)',
        img: 'https://images.unsplash.com/photo-1594897030264-ab7d87efc473?auto=format&fit=crop&w=600&q=80',
        desc: 'บริการงานพิมพ์สีสดทนทาน ด้วยเครื่องพิมพ์ความละเอียดสูง สำหรับงานป้ายทั่วไปและป้ายโฆษณา',
        spec: ['ไวนิลทึบแสง (Frontlit): งานป้ายทั่วไป, ป้ายกองโจร', 'ความละเอียด: พิมพ์ Outdoor และ Indoor (สูงสุด 1440dpi)', 'กันน้ำ ทนแดด รับประกันงานพิมพ์ยาวนาน']
      },
      {
        id: 's2',
        cat: 'ป้ายอักษร & ป้ายไฟ',
        icon: 'las la-lightbulb',
        title: 'ป้ายกล่องไฟและอักษรโลหะ',
        img: 'https://images.unsplash.com/photo-1555529771-835f59fc5efe?auto=format&fit=crop&w=600&q=80',
        desc: 'สร้างความโดดเด่นให้ร้านค้าในยามค่ำคืน ด้วยป้ายไฟ LED ประหยัดพลังงานและตัวอักษร 3 มิติ',
        spec: ['ระบบไฟ: LED Module และ Power Supply กันน้ำ 100%', 'วัสดุตัวอักษร: ซิงค์ทำสี, สแตนเลสเงา/แฮร์ไลน์, อะคริลิค', 'แสงสว่างสม่ำเสมอ ประหยัดไฟ']
      },
      {
        id: 's3',
        cat: 'งานโครงสร้าง',
        icon: 'las la-tools',
        title: 'โครงสร้างบิลบอร์ด & ทาวเวอร์',
        img: 'https://images.unsplash.com/photo-1541701494587-cb58502866ab?auto=format&fit=crop&w=600&q=80',
        desc: 'รับเหมาทำป้ายขนาดใหญ่ ป้ายหน้าโครงการ พร้อมคำนวณแบบโดยวิศวกรผู้เชี่ยวชาญ',
        spec: ['ป้ายบิลบอร์ด (Billboard): รับลมแรงได้ดี โครงเหล็กได้มาตรฐานวิศวกรรม', 'บริการฐานราก เสาเหล็ก และทาวเวอร์ไซน์', 'ทีมงานติดตั้งพร้อมรถเครนทั่วภาคใต้']
      }
    ],

    flashSales: [
      { id: 'fs1', title: 'X-Stand พร้อมพิมพ์', desc: 'ขนาด 60x160 ซม. พกพาสะดวก พับเก็บง่าย', price: 450, normalPrice: 650, badge: 'ลด 30%', color: 'var(--danger)', icon: 'las la-id-badge', targetType: 'P01', img: 'https://images.unsplash.com/photo-1542744173-8e7e53415bb0?auto=format&fit=crop&w=350&q=80' },
      { id: 'fs2', title: 'สติกเกอร์ฉลากสินค้า (ไดคัท)', desc: 'กันน้ำ 100% สั่งขั้นต่ำ 1 ตร.ม.', price: 350, normalPrice: null, badge: 'มาใหม่!', color: 'var(--warning)', icon: 'las la-stamp', targetType: 'V02', img: 'https://images.unsplash.com/photo-1589365278144-c9e705f843ba?auto=format&fit=crop&w=350&q=80' },
      { id: 'fs3', title: 'ป้ายไวนิล (Outdoor)', desc: 'ทนแดด ทนฝน ฟรีซีลขอบเจาะตาไก่', price: 150, normalPrice: null, badge: 'โปรค่าส่ง', color: 'var(--info)', icon: 'las la-truck', targetType: 'V01', img: 'https://images.unsplash.com/photo-1558655146-d09347e92766?auto=format&fit=crop&w=350&q=80' }
    ],

    packages: [
      {
        id: 'pkg1',
        title: 'แพ็กเกจร้านคาเฟ่ / เปิดร้านใหม่',
        desc: 'ครบจบเรื่องตกแต่งหน้าร้านและฉลาก',
        icon: 'las la-store',
        color: 'var(--primary)',
        img: 'https://images.unsplash.com/photo-1554118811-1e0d58224f24?auto=format&fit=crop&w=400&q=80',
        items: [
          { id: 'p1_1', type: 'S01', detail: 'ป้ายกล่องไฟหน้าร้าน (1x1 ม.)', w: 1, h: 1, qty: 1, checked: true },
          { id: 'p1_2', type: 'V02', detail: 'สติกเกอร์ฉลากสินค้า (ไดคัท)', w: 1, h: 1, qty: 2, checked: true },
          { id: 'p1_3', type: 'V01', detail: 'ป้ายไวนิลโปรโมชั่น หรือ เมนู', w: 2, h: 1, qty: 1, checked: true },
          { id: 'p1_4', type: 'P01', detail: 'X-Stand ตั้งหน้าร้าน 1 ชุด', w: 0.6, h: 1.6, qty: 1, checked: true }
        ]
      },
      {
        id: 'pkg2',
        title: 'แพ็กเกจจัดบูธ / งานอีเวนต์',
        desc: 'ชุดเซ็ตพกพาง่าย ประกอบใช้งานได้ทันที',
        icon: 'las la-bullhorn',
        color: 'var(--accent)',
        isPopular: true,
        img: 'https://images.unsplash.com/photo-1511578314322-379afb476865?auto=format&fit=crop&w=400&q=80',
        items: [
          { id: 'p2_1', type: 'P02', detail: 'Roll-up ขนาด 80x200 ซม.', w: 0.8, h: 2, qty: 2, checked: true },
          { id: 'p2_2', type: 'V01', detail: 'ป้ายไวนิลฉากหลัง (Backdrop)', w: 3, h: 2, qty: 1, finish: 'eyelet', checked: true },
          { id: 'p2_3', type: 'R01', detail: 'พลาสวูดไดคัท โลโก้ตั้งโต๊ะ', w: 0.6, h: 0.4, qty: 1, checked: true }
        ]
      },
      {
        id: 'pkg3',
        title: 'แพ็กเกจสำนักงาน (Corporate)',
        desc: 'ยกระดับภาพลักษณ์แบรนด์ให้องค์กร',
        icon: 'las la-building',
        color: 'var(--info)',
        img: 'https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=400&q=80',
        items: [
          { id: 'p3_1', type: 'S01', detail: 'ป้ายอักษรโลหะซ่อนไฟ (โลโก้บริษัท)', w: 2, h: 0.8, qty: 1, checked: true },
          { id: 'p3_2', type: 'V02', detail: 'สติกเกอร์ฝ้า (พรางสายตา) ติดกระจก', w: 1, h: 1, qty: 5, checked: true },
          { id: 'p3_3', type: 'R01', detail: 'ป้ายอะคริลิคบอกแผนก / ป้ายชื่อ', w: 0.3, h: 0.1, qty: 5, checked: true }
        ]
      }
    ],

    testimonials: [
      {
        name: "คุณวิชัย",
        role: "เจ้าของร้านอาหาร สวนนายดำ",
        text: "งานป้ายไฟสวยมากครับ ดึงดูดลูกค้าได้เยอะขึ้นจริงๆ ทีมงานติดตั้งก็รวดเร็วมาก ประทับใจมากครับ",
        img: "https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&w=150&q=80"
      },
      {
        name: "คุณสมหญิง",
        role: "ผู้จัดการฝ่ายการตลาด อันดามันกรุ๊ป",
        text: "สั่งงานไวนิลประจำกับที่นี่เลยค่ะ สีสดไม่เพี้ยน ส่งงานตรงเวลาตลอด แนะนำเลยค่ะ",
        img: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=150&q=80"
      },
      {
        name: "บจก. สร้างสรรค์ ดีไซน์",
        role: "ลูกค้าองค์กร",
        text: "ทีมช่างมีความเป็นมืออาชีพมาก งานโครงสร้างใหญ่แค่ไหนก็เอาอยู่ มั่นใจในคุณภาพครับ",
        img: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&q=80"
      }
    ],

    portfolio: [
      {
        id: 'p1',
        cat: 'structure',
        catName: 'โครงสร้างบิลบอร์ด',
        title: 'ป้ายบิลบอร์ดโครงการอสังหาฯ ตรัง',
        img: 'https://images.unsplash.com/photo-1541701494587-cb58502866ab?auto=format&fit=crop&w=600&q=80',
        desc: 'โครงสร้างเหล็กแข็งแรงพิเศษทนแรงลม พร้อมไฟส่องสว่างแบบ Floodlight มาตรฐานวิศวกรรม',
        spec: ['วัสดุ: ไวนิลทึบแสง 1440dpi พิมพ์ UV ทนแดด 2 ปี', 'ขนาด: 12 x 6 เมตร', 'เสาเข็มและโครงเหล็กชุบกัลวาไนซ์']
      },
      {
        id: 'p2',
        cat: 'print',
        catName: 'งานพิมพ์พรีเมียม',
        title: 'ป้ายไวนิลโปรโมชั่นหน้าร้าน',
        img: 'https://images.unsplash.com/photo-1563241527-3004b7be0ffd?auto=format&fit=crop&w=600&q=80',
        desc: 'พิมพ์สีสด ทนแดด ทนฝน ซีลขอบเจาะตาไก่แน่นหนา รับประกันสีสดใส 1 ปี',
        spec: ['วัสดุ: ไวนิล 360dpi Outdoor ทึบแสง หนา 440 แกรม', 'ขนาด: 4 x 1.5 เมตร']
      },
      {
        id: 'p3',
        cat: 'light',
        catName: 'ป้ายไฟ',
        title: 'อักษรโลหะซ่อนไฟ LED คาเฟ่',
        img: 'https://images.unsplash.com/photo-1555529771-835f59fc5efe?auto=format&fit=crop&w=600&q=80',
        desc: 'สร้างความหรูหราให้แบรนด์ด้วยอักษรโลหะซ่อนไฟด้านหลัง (Backlit LED)',
        spec: ['วัสดุ: ซิงค์ทำสีพาวเดอร์โค้ท, โมดูล LED วอร์มไวท์ 12V', 'รับประกันไฟ LED 1 ปีเต็ม']
      },
      {
        id: 'p4',
        cat: 'posm',
        catName: 'อุปกรณ์ออกบูธ',
        title: 'ชุด Roll-up และ X-Stand พกพา',
        img: 'https://images.unsplash.com/photo-1531058020387-3be344556be6?auto=format&fit=crop&w=600&q=80',
        desc: 'ภาพคมชัด ถอดประกอบง่าย น้ำหนักเบา เหมาะสำหรับงานสัมมนาและอีเวนต์',
        spec: ['วัสดุภาพ: PP Glossy เคลือบด้านกันแสงสะท้อน', 'โครง: อลูมิเนียมเกรดพรีเมียม พร้อมกระเป๋าใส่']
      },
      {
        id: 'p5',
        cat: 'print',
        catName: 'งานพิมพ์สติกเกอร์',
        title: 'สติกเกอร์ติดกระจก See-through',
        img: 'https://images.unsplash.com/photo-1586880244406-556ebe35f282?auto=format&fit=crop&w=600&q=80',
        desc: 'พรางสายตาจากภายนอก แต่ภายในมองทะลุเห็นข้างนอกได้ชัดเจน เหมาะกับโชว์รูมและคลินิก',
        spec: ['วัสดุ: สติกเกอร์ซีทรูความละเอียดสูง 1440dpi', 'กันแดดและกันความร้อน']
      },
      {
        id: 'p6',
        cat: 'light',
        catName: 'ป้ายไฟ',
        title: 'ป้ายกล่องไฟตู้ไฟ 2 หน้า ทรงกลม',
        img: 'https://images.unsplash.com/photo-1565515268482-17180dc3c1ea?auto=format&fit=crop&w=600&q=80',
        desc: 'สว่างชัดเจนทั้งกลางวันและกลางคืน ยื่นออกจากตัวตึก ดึงดูดสายตาลูกค้าที่สัญจรผ่านไปมา',
        spec: ['วัสดุ: ขอบอลูมิเนียมอบสีขาว, หน้าอะคริลิคปั๊มนูน, หลอดไฟ LED กันน้ำ']
      }
    ],

    promotions: [
      {
        img: 'https://images.unsplash.com/photo-1563241527-3004b7be0ffd?auto=format&fit=crop&w=600&q=80',
        title: 'ลดพิเศษ 10% งานป้ายกล่องไฟ',
        desc: 'สั่งทำป้ายตู้ไฟ หรืออักษรโลหะ รับส่วนลดทันที 10% ตลอดเดือนนี้'
      },
      {
        img: 'https://images.unsplash.com/photo-1531058020387-3be344556be6?auto=format&fit=crop&w=600&q=80',
        title: 'แถมฟรี X-Stand 1 ชุด',
        desc: 'สั่งผลิตสื่อสิ่งพิมพ์ครบ 10,000 บาท รับฟรี X-Stand พร้อมพิมพ์ 1 ชุดทันที'
      },
      {
        img: 'https://images.unsplash.com/photo-1586880244406-556ebe35f282?auto=format&fit=crop&w=600&q=80',
        title: 'โปรโมชั่นติดตั้งฟรี (เขตเมืองตรัง)',
        desc: 'บริการทีมช่างติดตั้งฟรีสำหรับลูกค้าในเขตเทศบาลนครตรัง เมื่อสั่งงานโครงสร้าง'
      }
    ]
  };
}
