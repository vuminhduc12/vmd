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
  setDateInputs();
  applyAppSettings(true);
  try {
    await initSupabaseAuth();
  } catch (err) {
    console.error('BOXER PRO: initSupabaseAuth', err);
    setStorageMode(STORAGE_MODE.LOCAL);
  }
  await loadCuttingPlanData();
  await loadAllData();
  startReminderLoop();

  // Set mealViewDate to today and load summary（要素欠落でここで止まると active ページが更新されないことがある）
  const mealViewDateEl = document.getElementById('mealViewDate');
  if (mealViewDateEl) mealViewDateEl.value = TODAY();
  loadMealSummary();
  switchPage(appSettings.landingPage || 'dashboard');
});
