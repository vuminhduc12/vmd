// ============================================================
// INIT
// ============================================================
document.addEventListener('DOMContentLoaded', async () => {
  syncDisplayModeUi();
  window.matchMedia?.('(display-mode: standalone)').addEventListener?.('change', syncDisplayModeUi);
  setStorageMode(STORAGE_MODE.CHECKING);
  appSettings = loadSettingsFromStorage();
  initNav();
  initMobileQuickUI();
  updateMobileNav(appSettings.landingPage || 'dashboard');
  initInstallPrompt();
  registerServiceWorker();
  bindAppEventHandlers();
  if (typeof setAiCoachWidgetOpen === 'function') setAiCoachWidgetOpen(false);
  setDateInputs();
  applyAppSettings(true);
  if (typeof initCollapseToggleButtons === 'function') initCollapseToggleButtons();
  try {
    await initSupabaseAuth();
  } catch (err) {
    console.error('BOXER PRO: initSupabaseAuth', err);
    setStorageMode(STORAGE_MODE.LOCAL);
  }
  await loadCuttingPlanData();
  await loadAllData();
  if (typeof refreshCuttingPlanRows === 'function') refreshCuttingPlanRows();
  startReminderLoop();

  // Set mealViewDate to today and load summary（要素欠落でここで止まると active ページが更新されないことがある）
  const mealViewDateEl = document.getElementById('mealViewDate');
  if (mealViewDateEl) mealViewDateEl.value = TODAY();
  loadMealSummary();
  switchPage(appSettings.landingPage || 'dashboard');

  if (typeof syncAppDayBoundary === 'function') {
    syncAppDayBoundary(true);
    window.setInterval(() => {
      try {
        syncAppDayBoundary(false);
      } catch (err) {
        console.error('BOXER PRO: day boundary sync interval', err);
      }
    }, 30 * 1000);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        syncAppDayBoundary(true);
      }
    });
    window.addEventListener('focus', () => {
      syncAppDayBoundary(true);
    });
  }
});
