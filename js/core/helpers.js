// ============================================================
// HELPERS
// ============================================================
function clearForm(ids) {
  ids.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    if (el.tagName === 'TEXTAREA' || el.type === 'text' || el.type === 'number') {
      el.value = '';
    }
  });
}

function requestNotificationPermission() {
  if (!('Notification' in window)) {
    showToast('この端末では通知を利用できません', 'error');
    return;
  }
  Notification.requestPermission().then(permission => {
    renderSettingsPage();
    showToast(permission === 'granted' ? '通知を許可しました' : '通知は未許可です', permission === 'granted' ? 'success' : 'info');
  });
}

function reminderStampKey(kind) {
  return `boxerpro.reminder.${kind}.${TODAY()}`;
}

function sendReminder(kind, title, body) {
  if (!appSettings.remindersEnabled) return;
  const key = reminderStampKey(kind);
  if (reminderSessionStamps.has(key) || safeStorageGetItem(key)) return;
  reminderSessionStamps.add(key);
  safeStorageSetItem(key, '1', { silent: true, context: '通知状態保存' });
  showToast(`${title}: ${body}`, 'info');

  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification(title, { body, icon: 'icons/app-icon.svg' });
  }
}

function isPastReminderTime(timeStr) {
  if (!timeStr) return false;
  const now = new Date();
  const [hours, minutes] = timeStr.split(':').map(Number);
  return now.getHours() > hours || (now.getHours() === hours && now.getMinutes() >= minutes);
}

function checkReminders() {
  if (!hasInitialDataLoaded) return;
  if (!appSettings.remindersEnabled) return;
  if (isPastReminderTime(appSettings.reminderWeightTime) && !weightLogs.some(w => w.date && w.date.slice(0, 10) === TODAY())) {
    sendReminder('weight', '体重記録リマインダー', '今日の体重をまだ記録していません。');
  }
  if (isPastReminderTime(appSettings.reminderHydrationTime)) {
    const water = getDailyHydration(TODAY()).reduce((sum, h) => sum + (parseFloat(h.water_ml) || 0), 0);
    if (water < 1500) sendReminder('hydration', '水分補給リマインダー', '水分ログが少なめです。補給状況を確認してください。');
  }
  if (isPastReminderTime(appSettings.reminderSleepTime) && !getDailyRecovery(TODAY()).length) {
    sendReminder('sleep', '回復ログリマインダー', '睡眠・疲労・体調スコアを記録してください。');
  }
}

function startReminderLoop() {
  if (reminderIntervalId) window.clearInterval(reminderIntervalId);
  checkReminders();
  reminderIntervalId = window.setInterval(checkReminders, 60000);
}

function initInstallPrompt() {
  const installBtn = document.getElementById('installAppBtn');
  if (!installBtn) return;

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredInstallPrompt = event;
    installBtn.style.display = 'inline-flex';
  });

  installBtn.addEventListener('click', async () => {
    if (!deferredInstallPrompt) return;
    deferredInstallPrompt.prompt();
    await deferredInstallPrompt.userChoice;
    deferredInstallPrompt = null;
    installBtn.style.display = 'none';
  });
}

function isLocalDevHost() {
  const h = (location.hostname || '').toLowerCase();
  return h === 'localhost' || h === '127.0.0.1' || h === '[::1]' || h === '0.0.0.0';
}

function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => {
    if (isLocalDevHost()) {
      navigator.serviceWorker.getRegistrations().then(regs => {
        regs.forEach(r => r.unregister());
      });
      if ('caches' in window) {
        caches.keys().then(keys => Promise.all(keys.map(k => caches.delete(k)))).catch(() => {});
      }
      return;
    }
    navigator.serviceWorker.register('service-worker.js', { updateViaCache: 'none' }).catch(err => {
      console.error('Service worker registration failed:', err);
    });
  });
}

function bindAppEventHandlers() {
  document.getElementById('appDataImportInput')?.addEventListener('change', importAppDataFromFile);
  document.getElementById('w-height')?.addEventListener('input', updateWeightBmiPreview);
  document.getElementById('w-weight')?.addEventListener('input', updateWeightBmiPreview);
  document.getElementById('supabase-login-btn')?.addEventListener('click', () => { void signInWithGoogle(); });
  document.getElementById('supabase-logout-btn')?.addEventListener('click', () => { void signOutSupabase(); });
  document.getElementById('supabase-merge-btn')?.addEventListener('click', () => { void mergeLocalDataToSupabase(); });
}
