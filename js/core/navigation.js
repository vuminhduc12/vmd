// ============================================================
// NAVIGATION
// ============================================================
function initNav() {
  const navItems = document.querySelectorAll('.nav-item[data-page]');

  navItems.forEach(item => {
    const link = item.querySelector('.nav-link');
    if (!link) return;
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const page = item.dataset.page;
      switchPage(page);
    });
  });

  // Topbar hamburger
  document.getElementById('topbarMenuBtn').addEventListener('click', () => {
    toggleSidebar();
  });
  document.getElementById('sidebarToggle').addEventListener('click', () => {
    toggleSidebar();
  });
  document.getElementById('sidebarBackdrop')?.addEventListener('click', closeSidebar);
  window.addEventListener('resize', () => {
    if (!isMobileLayout()) closeSidebar();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeSidebar();
  });
}

function updateMobileNav(pageName) {
  document.querySelectorAll('.mobile-nav-btn[data-page]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.page === pageName);
  });
}

function isMobileLayout() {
  return window.innerWidth <= 900;
}

function setSidebarOpen(isOpen) {
  const sidebar = document.getElementById('sidebar');
  const backdrop = document.getElementById('sidebarBackdrop');
  if (!sidebar) return;
  const open = !!isOpen && isMobileLayout();
  sidebar.classList.toggle('open', open);
  if (backdrop) backdrop.hidden = !open;
  document.body.classList.toggle('sidebar-open', open);
}

function closeSidebar() {
  setSidebarOpen(false);
}

function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  if (!sidebar) return;
  setSidebarOpen(!sidebar.classList.contains('open'));
}
function closeMobileQuickSheet() {
  const sheet = document.getElementById('mobileQuickSheet');
  const backdrop = document.getElementById('mobileQuickBackdrop');
  const fab = document.getElementById('mobileRecordFab');
  if (sheet) {
    sheet.hidden = true;
    sheet.setAttribute('aria-hidden', 'true');
  }
  if (backdrop) {
    backdrop.hidden = true;
  }
  if (fab) {
    fab.classList.remove('is-open');
    fab.setAttribute('aria-expanded', 'false');
  }
  document.body.classList.remove('mobile-quick-open');
}

function openMobileQuickSheet() {
  const sheet = document.getElementById('mobileQuickSheet');
  const backdrop = document.getElementById('mobileQuickBackdrop');
  const fab = document.getElementById('mobileRecordFab');
  if (!sheet || !backdrop) return;
  backdrop.hidden = false;
  sheet.hidden = false;
  sheet.setAttribute('aria-hidden', 'false');
  if (fab) {
    fab.classList.add('is-open');
    fab.setAttribute('aria-expanded', 'true');
  }
  document.body.classList.add('mobile-quick-open');
}

function toggleMobileQuickSheet() {
  const sheet = document.getElementById('mobileQuickSheet');
  if (!sheet) return;
  if (sheet.hidden) openMobileQuickSheet();
  else closeMobileQuickSheet();
}

function mobileNavigateTo(pageName, scrollSelector, focusId) {
  closeMobileQuickSheet();
  switchPage(pageName);
  window.setTimeout(() => {
    if (scrollSelector) {
      const el = document.querySelector(scrollSelector);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    if (focusId) {
      const inp = document.getElementById(focusId);
      if (inp && typeof inp.focus === 'function') {
        inp.focus();
        if (typeof inp.select === 'function') {
          try { inp.select(); } catch (e) { /* ignore */ }
        }
      }
    }
  }, 100);
}

function initMobileQuickUI() {
  const fab = document.getElementById('mobileRecordFab');
  const backdrop = document.getElementById('mobileQuickBackdrop');
  const closeBtn = document.getElementById('mobileQuickCloseBtn');
  if (fab) fab.addEventListener('click', (e) => { e.stopPropagation(); toggleMobileQuickSheet(); });
  if (backdrop) backdrop.addEventListener('click', closeMobileQuickSheet);
  if (closeBtn) closeBtn.addEventListener('click', closeMobileQuickSheet);

  const actions = {
    'dash-weight': () => mobileNavigateTo('weight', '#weight-record-list-anchor', null),
    meals: () => mobileNavigateTo('meals', '#meal-input-anchor', 'foodSearch'),
    training: () => mobileNavigateTo('training', '#training-record-anchor', 't-type'),
    hydration: () => mobileNavigateTo('calories', '#cal-anchor-hydration', 'h-water'),
    recovery: () => mobileNavigateTo('calories', '#cal-anchor-recovery', 'r-sleep'),
    calories: () => mobileNavigateTo('calories', '#cal-anchor-today', null),
    settings: () => mobileNavigateTo('settings', null, 's-name'),
  };

  document.querySelectorAll('.mobile-quick-tile[data-mq-action]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const key = btn.dataset.mqAction;
      const fn = actions[key];
      if (fn) fn();
    });
  });

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    const sheet = document.getElementById('mobileQuickSheet');
    if (sheet && !sheet.hidden) closeMobileQuickSheet();
  });
}

function switchPage(pageName) {
  closeMobileQuickSheet();
  closeSidebar();
  const page = normalizeAppPageId(pageName);
  if (page !== String(pageName || '').trim() && pageName != null && String(pageName).trim() !== '') {
    console.warn('BOXER PRO: invalid page id, using', page, 'was:', pageName);
  }

  // Update nav
  document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
  const activeItem = document.querySelector(`.nav-item[data-page="${page}"]`);
  if (activeItem) activeItem.classList.add('active');
  updateMobileNav(page);

  // Update pages（必ず1つ active — 未知IDですべて非表示になるのを防ぐ）
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const activePage = document.getElementById(`page-${page}`) || document.getElementById('page-dashboard');
  if (activePage) {
    const main = document.getElementById('mainWrapper');
    if (main) {
      const outsideMain = !main.contains(activePage);
      const nestedInOtherPage = !!(activePage.parentElement && activePage.parentElement.closest && activePage.parentElement.closest('.page'));
      if (outsideMain || nestedInOtherPage) {
        console.warn('BOXER PRO: #' + activePage.id + ' を mainWrapper 直下へ移動（HTMLの誤配置または古いキャッシュ対策）');
        main.appendChild(activePage);
      }
    }
    activePage.classList.add('active');
  }

  // Update topbar title
  const titles = {
    dashboard: 'ダッシュボード',
    weight: '体重管理',
    meals: '食事メニュー',
    training: '練習スケジュール',
    calories: 'カロリー計算',
    fight: '試合目標',
    settings: 'マイ設定',
  };
  const topTitle = document.getElementById('topbarTitle');
  if (topTitle) topTitle.textContent = titles[page] || page;

  // Load page-specific data
  if (page === 'weight') renderWeightPage();
  if (page === 'meals') renderMealsPage();
  if (page === 'training') renderTrainingPage();
  if (page === 'calories') renderCaloriesPage();
  if (page === 'fight') renderFightPage();
  if (page === 'settings') renderSettingsPage();
}
