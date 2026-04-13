// ============================================================
// SUPABASE (config + data layer)
// ============================================================
const BOXER_SUPABASE_TABLES = {
  weight_logs: 'boxer_weight_logs',
  weight_log_photos: 'boxer_weight_log_photos',
  meals: 'boxer_meals',
  training_logs: 'boxer_training_logs',
  fight_goals: 'boxer_fight_goals',
  opponents: 'boxer_opponents',
  fight_history: 'boxer_fight_history',
  hydration_logs: 'boxer_hydration_logs',
  recovery_logs: 'boxer_recovery_logs',
};
const SUPABASE_LAST_SEEN_SYNC_KEY = 'boxerpro.supabase.lastSeenSyncAt';
const SUPABASE_LAST_SEEN_INTERVAL_MS = 30 * 60 * 1000;
const SUPABASE_AUTH_TIMEOUT_MS = 8000;
let supabaseLastSeenBindingDone = false;
let supabaseSessionRequest = null;
let supabaseSessionSnapshot = null;

function withTimeout(promise, ms, label = 'operation') {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      window.setTimeout(() => reject(new Error(`Supabase ${label} timed out after ${ms}ms`)), ms);
    }),
  ]);
}

async function getSupabaseSessionSafe(sb) {
  if (supabaseSessionRequest) return supabaseSessionRequest;
  supabaseSessionRequest = (async () => {
  try {
    const result = await withTimeout(sb.auth.getSession(), SUPABASE_AUTH_TIMEOUT_MS, 'getSession');
    supabaseSessionSnapshot = result?.data?.session || null;
    return supabaseSessionSnapshot;
  } catch (error) {
    console.error('BOXER PRO: Supabase session restore failed', error);
    return supabaseSessionSnapshot;
  } finally {
    supabaseSessionRequest = null;
  }
  })();
  return supabaseSessionRequest;
}

async function getSupabaseUserSafe(sb) {
  if (supabaseSessionSnapshot?.user) return supabaseSessionSnapshot.user;
  try {
    const result = await withTimeout(sb.auth.getUser(), SUPABASE_AUTH_TIMEOUT_MS, 'getUser');
    return result?.data?.user || null;
  } catch (error) {
    console.error('BOXER PRO: Supabase user fetch failed', error);
    return null;
  }
}

function isSupabaseConfigured() {
  const c = typeof window !== 'undefined' ? window.BOXER_PRO_CONFIG : null;
  return !!(c && c.supabaseUrl && c.supabaseAnonKey);
}

async function getSupabaseClient() {
  if (!isSupabaseConfigured()) return null;
  if (supabaseClientPromise) return supabaseClientPromise;
  supabaseClientPromise = (async () => {
    try {
      let createClient;
      const g = typeof window !== 'undefined' ? window.supabase : null;
      if (g && typeof g.createClient === 'function') {
        createClient = g.createClient.bind(g);
      } else {
        let mod;
        try {
          mod = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.49.1/+esm');
        } catch (e1) {
          console.warn('BOXER PRO: jsDelivr からの Supabase 読み込みに失敗、esm.sh を試します', e1);
          mod = await import('https://esm.sh/@supabase/supabase-js@2.49.1');
        }
        createClient = mod.createClient;
      }
      if (typeof createClient !== 'function') {
        throw new Error('Supabase createClient is unavailable');
      }
      const cfg = window.BOXER_PRO_CONFIG;
      const storageAdapter = {
        getItem(key) {
          return safeStorageGetItem(key);
        },
        setItem(key, value) {
          safeStorageSetItem(key, value, { silent: true, context: 'Supabase セッション保存' });
        },
        removeItem(key) {
          safeStorageRemoveItem(key);
        },
      };
      return createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, {
        auth: {
          storage: storageAdapter,
          storageKey: 'boxerpro.supabase.auth',
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: false,
        },
      });
    } catch (err) {
      supabaseClientPromise = null;
      console.error('BOXER PRO: Supabase クライアントを作成できません', err);
      return null;
    }
  })();
  return supabaseClientPromise;
}

function cleanupSupabaseAuthRedirectUrl() {
  if (typeof window === 'undefined' || !window.history?.replaceState) return;
  const url = new URL(window.location.href);
  let changed = false;
  const paramsToStrip = ['code', 'state'];
  paramsToStrip.forEach((key) => {
    if (url.searchParams.has(key)) {
      url.searchParams.delete(key);
      changed = true;
    }
  });
  if (url.hash && /access_token=|refresh_token=|expires_at=|token_type=/.test(url.hash)) {
    url.hash = '';
    changed = true;
  }
  if (changed) {
    window.history.replaceState({}, document.title, `${url.pathname}${url.search}${url.hash}`);
  }
}

function readSupabaseAuthTokensFromUrl() {
  if (typeof window === 'undefined') return null;
  const hash = window.location.hash || '';
  if (!hash || !hash.includes('access_token=')) return null;
  const raw = hash.startsWith('#') ? hash.slice(1) : hash;
  const params = new URLSearchParams(raw);
  const accessToken = params.get('access_token');
  const refreshToken = params.get('refresh_token');
  if (!accessToken || !refreshToken) return null;
  return {
    access_token: accessToken,
    refresh_token: refreshToken,
  };
}

async function restoreSupabaseSessionFromUrl(sb) {
  const tokens = readSupabaseAuthTokensFromUrl();
  if (!tokens) return null;
  try {
    const result = await withTimeout(sb.auth.setSession(tokens), SUPABASE_AUTH_TIMEOUT_MS, 'setSession');
    supabaseSessionSnapshot = result?.data?.session || null;
    if (supabaseSessionSnapshot?.user) {
      cleanupSupabaseAuthRedirectUrl();
    }
    return supabaseSessionSnapshot;
  } catch (error) {
    console.error('BOXER PRO: Supabase URL session restore failed', error);
    return null;
  }
}

function syncSupabaseUi() {
  updateSupabaseAuthUI();
  renderSettingsPage();
}

async function touchSupabaseLastSeen(force = false) {
  const sb = await getSupabaseClient();
  if (!sb || activeStorageMode !== STORAGE_MODE.SUPABASE) return false;
  const user = await getSupabaseUserSafe(sb);
  if (!user) return false;

  const now = Date.now();
  const lastSyncAt = Number(safeStorageGetItem(SUPABASE_LAST_SEEN_SYNC_KEY) || 0);
  if (!force && lastSyncAt && now - lastSyncAt < SUPABASE_LAST_SEEN_INTERVAL_MS) {
    return false;
  }

  const timestamp = new Date(now).toISOString();
  const { error } = await sb.from('boxer_profiles').upsert({
    user_id: user.id,
    settings: appSettings,
    last_seen_at: timestamp,
    updated_at: timestamp,
  }, { onConflict: 'user_id' });
  if (error) {
    console.error('Supabase last seen save:', error);
    return false;
  }
  safeStorageSetItem(SUPABASE_LAST_SEEN_SYNC_KEY, String(now), { context: 'last seen sync' });
  return true;
}

function bindSupabaseLastSeenTracking() {
  if (supabaseLastSeenBindingDone || typeof document === 'undefined' || typeof window === 'undefined') return;
  supabaseLastSeenBindingDone = true;

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      touchSupabaseLastSeen().catch((err) => console.error('BOXER PRO: last seen visibility', err));
    }
  });
  window.addEventListener('focus', () => {
    touchSupabaseLastSeen().catch((err) => console.error('BOXER PRO: last seen focus', err));
  });
}

function boxerRowToRecord(row) {
  if (!row) return null;
  const p = row.payload && typeof row.payload === 'object' ? row.payload : {};
  return {
    ...p,
    id: row.id,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

async function boxerSupabaseApiGet(table, params = '') {
  const sb = await getSupabaseClient();
  const tn = BOXER_SUPABASE_TABLES[table];
  if (!sb || !tn) throw new Error('Supabase not available');
  const { data, error } = await sb.from(tn).select('id, payload, created_at, updated_at');
  if (error) throw error;
  const rows = (data || []).map(boxerRowToRecord);
  return { data: sortRows(rows, params) };
}

async function boxerSupabaseApiPost(table, data) {
  const sb = await getSupabaseClient();
  const tn = BOXER_SUPABASE_TABLES[table];
  if (!sb || !tn) throw new Error('Supabase not available');
  const user = await getSupabaseUserSafe(sb);
  if (!user) throw new Error('Not signed in');
  const id = data.id || createRecordId();
  const createdAt = data.created_at || new Date().toISOString();
  const payloadObj = { ...data, id, created_at: createdAt };
  const { data: row, error } = await sb.from(tn)
    .insert({
      id,
      user_id: user.id,
      payload: payloadObj,
      created_at: createdAt,
    })
    .select('id, payload, created_at, updated_at')
    .single();
  if (error) throw error;
  return boxerRowToRecord(row);
}

async function boxerSupabaseApiDelete(table, id) {
  const sb = await getSupabaseClient();
  const tn = BOXER_SUPABASE_TABLES[table];
  if (!sb || !tn) throw new Error('Supabase not available');
  const { error } = await sb.from(tn).delete().eq('id', id);
  if (error) throw error;
  return true;
}

async function boxerSupabaseApiPut(table, id, data) {
  const sb = await getSupabaseClient();
  const tn = BOXER_SUPABASE_TABLES[table];
  if (!sb || !tn) throw new Error('Supabase not available');
  const { data: prevRow, error: e0 } = await sb.from(tn).select('payload').eq('id', id).maybeSingle();
  if (e0) throw e0;
  const prev = prevRow?.payload && typeof prevRow.payload === 'object' ? prevRow.payload : {};
  const nextPayload = { ...prev, ...data, id, updated_at: new Date().toISOString() };
  const { data: row, error } = await sb.from(tn)
    .update({ payload: nextPayload })
    .eq('id', id)
    .select('id, payload, created_at, updated_at')
    .single();
  if (error) throw error;
  return boxerRowToRecord(row);
}

async function loadAppSettingsFromSupabase() {
  const sb = await getSupabaseClient();
  if (!sb) return;
  const user = await getSupabaseUserSafe(sb);
  if (!user) return;
  const { data, error } = await sb.from('boxer_profiles').select('settings').eq('user_id', user.id).maybeSingle();
  if (error || !data?.settings) return;
  appSettings = mergeSettings(data.settings);
  safeStorageSetItem(SETTINGS_KEY, JSON.stringify(appSettings), { context: '設定キャッシュ' });
}

async function persistAppSettingsToSupabase() {
  const sb = await getSupabaseClient();
  if (!sb || activeStorageMode !== STORAGE_MODE.SUPABASE) return;
  const user = await getSupabaseUserSafe(sb);
  if (!user) return;
  const { error } = await sb.from('boxer_profiles').upsert({
    user_id: user.id,
    settings: appSettings,
    last_seen_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id' });
  if (error) console.error('Supabase settings save:', error);
}

async function initSupabaseAuth() {
  if (!isSupabaseConfigured()) {
    setStorageMode(STORAGE_MODE.LOCAL);
    syncSupabaseUi();
    return;
  }
  const sb = await getSupabaseClient();
  if (!sb) {
    setStorageMode(STORAGE_MODE.LOCAL);
    syncSupabaseUi();
    return;
  }

  let session = await restoreSupabaseSessionFromUrl(sb);
  if (!session) {
    session = await getSupabaseSessionSafe(sb);
  }
  if (session?.user) {
    setStorageMode(STORAGE_MODE.SUPABASE);
    await loadAppSettingsFromSupabase();
    await touchSupabaseLastSeen(true);
    cleanupSupabaseAuthRedirectUrl();
  } else {
    setStorageMode(STORAGE_MODE.LOCAL);
  }
  bindSupabaseLastSeenTracking();
  syncSupabaseUi();

  if (!supabaseAuthListenerBound) {
    supabaseAuthListenerBound = true;
    sb.auth.onAuthStateChange(async (event, sess) => {
      if (event === 'SIGNED_IN' && sess?.user) {
        supabaseSessionSnapshot = sess;
        setStorageMode(STORAGE_MODE.SUPABASE);
        await loadAppSettingsFromSupabase();
        await touchSupabaseLastSeen(true);
        cleanupSupabaseAuthRedirectUrl();
        applyAppSettings(true);
        await loadAllData();
        syncSupabaseUi();
        if (typeof renderDashboard === 'function') renderDashboard();
      } else if (event === 'SIGNED_OUT') {
        supabaseSessionSnapshot = null;
        setStorageMode(STORAGE_MODE.LOCAL);
        safeStorageSetItem(SUPABASE_LAST_SEEN_SYNC_KEY, '0', { context: 'last seen reset' });
        appSettings = loadSettingsFromStorage();
        applyAppSettings(true);
        await loadAllData();
        syncSupabaseUi();
        if (typeof renderDashboard === 'function') renderDashboard();
      }
    });
  }
}

function getSupabaseOAuthRedirectTo() {
  const u = new URL(window.location.href);
  u.hash = '';
  u.search = '';
  if (!u.pathname || u.pathname === '/') {
    return `${u.origin}/`;
  }
  return `${u.origin}${u.pathname}`;
}

async function signInWithGoogle() {
  const sb = await getSupabaseClient();
  if (!sb) {
    showToast('Supabase が未設定です。js/config.js を確認してください', 'error');
    return;
  }
  const redirectTo = getSupabaseOAuthRedirectTo();
  const { error } = await sb.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo, scopes: 'email' },
  });
  if (error) {
    console.error(error);
    showToast('ログインに失敗しました', 'error');
  }
}

async function signOutSupabase() {
  const sb = await getSupabaseClient();
  if (!sb) return;
  const { error } = await sb.auth.signOut();
  if (error) {
    showToast('ログアウトに失敗しました', 'error');
    return;
  }
  showToast('ログアウトしました', 'success');
}

async function mergeLocalDataToSupabase() {
  if (activeStorageMode !== STORAGE_MODE.SUPABASE) {
    showToast('クラウドにログインした状態で実行してください', 'info');
    return;
  }
  const sb = await getSupabaseClient();
  const user = await getSupabaseUserSafe(sb);
  if (!user) {
    showToast('ログインが必要です', 'error');
    return;
  }
  let n = 0;
  for (const table of DATA_TABLES) {
    const tn = BOXER_SUPABASE_TABLES[table];
    const rows = readLocalTable(table);
    for (const rec of rows) {
      if (!rec || !rec.id) continue;
      const createdAt = rec.created_at || new Date().toISOString();
      const payloadObj = { ...rec, id: rec.id, created_at: createdAt };
      const { error } = await sb.from(tn).upsert({
        id: rec.id,
        user_id: user.id,
        payload: payloadObj,
        created_at: createdAt,
      }, { onConflict: 'user_id,id' });
      if (!error) n += 1;
    }
  }
  await loadAllData();
  renderSettingsPage();
  showToast(`ローカルデータを反映しました（${n} 件処理）`, 'success');
}

function canUseCloudMedia() {
  return activeStorageMode === STORAGE_MODE.SUPABASE;
}

function getWeightPhotosByLogId(weightLogId) {
  return weightLogPhotos
    .filter((row) => row.weight_log_id === weightLogId)
    .sort((a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0));
}

async function compressImageFile(file) {
  if (!(file instanceof File)) throw new Error('画像ファイルが不正です');
  if (!file.type.startsWith('image/')) return file;
  const dataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('画像を読み込めませんでした'));
    reader.readAsDataURL(file);
  });
  const img = await new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('画像を開けませんでした'));
    image.src = dataUrl;
  });
  const maxEdge = IMAGE_MAX_EDGE;
  const scale = Math.min(1, maxEdge / Math.max(img.width, img.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(img.width * scale));
  canvas.height = Math.max(1, Math.round(img.height * scale));
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  let quality = 0.88;
  let blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
  while (blob && blob.size > IMAGE_MAX_SIZE_BYTES && quality > 0.52) {
    quality -= 0.08;
    blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
  }
  if (!blob) throw new Error('画像を圧縮できませんでした');
  return new File([blob], `${file.name.replace(/\.[^.]+$/, '') || 'photo'}.jpg`, { type: 'image/jpeg' });
}

async function uploadWeightPhotoFile(file, weightLogId, sortOrder = 0) {
  const sb = await getSupabaseClient();
  if (!sb || !canUseCloudMedia()) throw new Error('クラウドログイン時のみ画像を保存できます');
  const user = await getSupabaseUserSafe(sb);
  if (!user) throw new Error('ログインが必要です');

  const compressed = await compressImageFile(file);
  const photoId = createRecordId();
  const storagePath = `${user.id}/weight_logs/${weightLogId}/${photoId}.jpg`;
  const upload = await sb.storage.from(WEIGHT_PHOTO_BUCKET).upload(storagePath, compressed, {
    cacheControl: '3600',
    contentType: 'image/jpeg',
    upsert: true,
  });
  if (upload.error) throw upload.error;

  const meta = await apiPost('weight_log_photos', {
    weight_log_id: weightLogId,
    storage_path: storagePath,
    file_name: compressed.name,
    content_type: compressed.type,
    file_size: compressed.size,
    caption: '',
    shot_type: 'progress',
    sort_order: sortOrder,
  });
  return meta;
}

async function getWeightPhotoSignedUrl(storagePath) {
  const sb = await getSupabaseClient();
  if (!sb || !storagePath) return '';
  const { data, error } = await sb.storage.from(WEIGHT_PHOTO_BUCKET).createSignedUrl(storagePath, 60 * 30);
  if (error) {
    console.error('BOXER PRO: createSignedUrl failed', error);
    return '';
  }
  return data?.signedUrl || '';
}

async function deleteWeightPhoto(photoId) {
  const row = weightLogPhotos.find((item) => item.id === photoId);
  if (!row) return;
  const sb = await getSupabaseClient();
  if (sb && row.storage_path) {
    const { error } = await sb.storage.from(WEIGHT_PHOTO_BUCKET).remove([row.storage_path]);
    if (error) console.error('BOXER PRO: remove weight photo storage', error);
  }
  await apiDelete('weight_log_photos', photoId);
  weightLogPhotos = weightLogPhotos.filter((item) => item.id !== photoId);
}

async function uploadOpponentPhotoFile(file, opponentId) {
  const sb = await getSupabaseClient();
  if (!sb || !canUseCloudMedia()) throw new Error('クラウドログイン時のみ画像を保存できます');
  const user = await getSupabaseUserSafe(sb);
  if (!user) throw new Error('ログインが必要です');

  const compressed = await compressImageFile(file);
  const storagePath = `${user.id}/opponents/${opponentId}/profile.jpg`;
  const upload = await sb.storage.from(OPPONENT_PHOTO_BUCKET).upload(storagePath, compressed, {
    cacheControl: '3600',
    contentType: 'image/jpeg',
    upsert: true,
  });
  if (upload.error) throw upload.error;

  return {
    storage_path: storagePath,
    file_name: compressed.name,
    content_type: compressed.type,
    file_size: compressed.size,
  };
}

async function getOpponentPhotoSignedUrl(storagePath) {
  const sb = await getSupabaseClient();
  if (!sb || !storagePath) return '';
  const { data, error } = await sb.storage.from(OPPONENT_PHOTO_BUCKET).createSignedUrl(storagePath, 60 * 30);
  if (error) {
    console.error('BOXER PRO: createSignedUrl failed', error);
    const downloadRes = await sb.storage.from(OPPONENT_PHOTO_BUCKET).download(storagePath);
    if (downloadRes.error) {
      console.error('BOXER PRO: opponent photo download failed', downloadRes.error);
      return '';
    }
    return URL.createObjectURL(downloadRes.data);
  }
  return data?.signedUrl || '';
}

async function deleteOpponentPhotoStorage(storagePath) {
  if (!storagePath) return;
  const sb = await getSupabaseClient();
  if (!sb) return;
  const { error } = await sb.storage.from(OPPONENT_PHOTO_BUCKET).remove([storagePath]);
  if (error) console.error('BOXER PRO: remove opponent photo storage', error);
}

if (typeof window !== 'undefined') {
  window.signInWithGoogle = signInWithGoogle;
  window.signOutSupabase = signOutSupabase;
  window.mergeLocalDataToSupabase = mergeLocalDataToSupabase;
}

function resetAdminStatsUi() {
  const card = document.getElementById('admin-stats-card');
  const totalEl = document.getElementById('admin-total-users');
  const activeEl = document.getElementById('admin-active-users');
  const emailEl = document.getElementById('admin-stats-email');
  const updatedEl = document.getElementById('admin-stats-updated');
  if (card) card.hidden = true;
  if (totalEl) totalEl.textContent = '--';
  if (activeEl) activeEl.textContent = '--';
  if (emailEl) emailEl.textContent = '--';
  if (updatedEl) updatedEl.textContent = '--';
}

async function fetchAdminStats() {
  const sb = await getSupabaseClient();
  if (!sb || activeStorageMode !== STORAGE_MODE.SUPABASE) return null;
  const session = await getSupabaseSessionSafe(sb);
  const accessToken = session?.access_token;
  if (!accessToken) return null;

  const res = await fetch('/api/admin/stats', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (res.status === 401 || res.status === 403) return null;
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Admin stats failed: ${res.status} ${body}`);
  }
  return res.json();
}

async function fetchAiCoachReply(question) {
  const sb = await getSupabaseClient();
  if (!sb || activeStorageMode !== STORAGE_MODE.SUPABASE) {
    throw new Error('クラウドログイン中のみ利用できます');
  }
  const session = await getSupabaseSessionSafe(sb);
  const accessToken = session?.access_token;
  if (!accessToken) {
    throw new Error('ログインセッションを取得できません');
  }

  const res = await fetch('/api/ai/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      question,
      goal_mode: appSettings?.goalMode || 'boxer_cut',
    }),
  });
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(payload?.error || `AI chat failed (${res.status})`);
  }
  const answer = String(payload?.answer || '').trim();
  if (!answer) {
    throw new Error('AI応答が空です');
  }
  return answer;
}

async function updateAdminStatsUi() {
  const card = document.getElementById('admin-stats-card');
  const totalEl = document.getElementById('admin-total-users');
  const activeEl = document.getElementById('admin-active-users');
  const emailEl = document.getElementById('admin-stats-email');
  const updatedEl = document.getElementById('admin-stats-updated');
  if (!card || !totalEl || !activeEl || !emailEl || !updatedEl) return;

  resetAdminStatsUi();
  if (!isSupabaseConfigured()) return;

  try {
    const data = await fetchAdminStats();
    if (!data) return;
    card.hidden = false;
    totalEl.textContent = String(data.total_users ?? '--');
    activeEl.textContent = String(data.active_users_7d ?? '--');
    emailEl.textContent = data.admin_email || '--';
    updatedEl.textContent = data.measured_at
      ? `取得: ${formatDateTimeJP(data.measured_at)}`
      : '取得済み';
  } catch (err) {
    console.error('BOXER PRO: updateAdminStatsUi', err);
    resetAdminStatsUi();
  }
}

function updateSupabaseAuthUI() {
  const hint = document.getElementById('supabase-config-hint');
  const emailEl = document.getElementById('supabase-auth-email');
  const loginBtn = document.getElementById('supabase-login-btn');
  const logoutBtn = document.getElementById('supabase-logout-btn');
  const mergeBtn = document.getElementById('supabase-merge-btn');
  if (!hint || !emailEl || !loginBtn || !logoutBtn || !mergeBtn) return;

  const configured = isSupabaseConfigured();
  hint.hidden = configured;
  hint.style.display = configured ? 'none' : 'block';

  if (!configured) {
    emailEl.textContent = '—';
    loginBtn.style.display = 'none';
    logoutBtn.style.display = 'none';
    mergeBtn.style.display = 'none';
    resetAdminStatsUi();
    return;
  }

  getSupabaseClient().then(async (sb) => {
    if (!sb) {
      emailEl.textContent = '接続できません（URL・anon key・Console を確認）';
      renderProfileCard();
      loginBtn.style.display = 'inline-flex';
      logoutBtn.style.display = 'none';
      mergeBtn.style.display = 'none';
      resetAdminStatsUi();
      return;
    }
    const session = await getSupabaseSessionSafe(sb);
    const email = session?.user?.email || '';
    emailEl.textContent = email || '未ログイン';
    const inCloud = activeStorageMode === STORAGE_MODE.SUPABASE && !!session;
    renderProfileCard(inCloud ? session.user : null);
    loginBtn.style.display = inCloud ? 'none' : 'inline-flex';
    logoutBtn.style.display = inCloud ? 'inline-flex' : 'none';
    mergeBtn.style.display = inCloud ? 'inline-flex' : 'none';
    if (inCloud) await updateAdminStatsUi();
    else resetAdminStatsUi();
  }).catch((err) => {
    console.error('BOXER PRO: updateSupabaseAuthUI', err);
    emailEl.textContent = '接続エラー（Console を確認）';
    renderProfileCard();
    loginBtn.style.display = 'inline-flex';
    logoutBtn.style.display = 'none';
    mergeBtn.style.display = 'none';
    resetAdminStatsUi();
  });
}

// ============================================================
// API HELPERS
// ============================================================
async function apiGet(table, params = '') {
  if (activeStorageMode === STORAGE_MODE.LOCAL) {
    return getLocalTableResponse(table, params);
  }
  if (activeStorageMode === STORAGE_MODE.SUPABASE) {
    return boxerSupabaseApiGet(table, params);
  }

  try {
    const res = await fetch(`${API_BASE}/${table}?limit=500${params ? '&' + params : ''}`);
    if (!res.ok) {
      if (shouldFallbackToLocal(null, res)) {
        setStorageMode(STORAGE_MODE.LOCAL);
        notifyLocalFallback();
        return getLocalTableResponse(table, params);
      }
      throw new Error(`GET ${table} failed`);
    }
    // Workers/Pages 等で /tables が無いと index.html が 200 で返ることがある → JSON でなければローカル
    if (!responseLooksLikeJson(res)) {
      setStorageMode(STORAGE_MODE.LOCAL);
      notifyLocalFallback();
      return getLocalTableResponse(table, params);
    }
    try {
      const data = await res.json();
      setStorageMode(STORAGE_MODE.API);
      return data;
    } catch (parseErr) {
      setStorageMode(STORAGE_MODE.LOCAL);
      notifyLocalFallback();
      return getLocalTableResponse(table, params);
    }
  } catch (error) {
    if (shouldFallbackToLocal(error)) {
      setStorageMode(STORAGE_MODE.LOCAL);
      notifyLocalFallback();
      return getLocalTableResponse(table, params);
    }
    throw error;
  }
}

async function apiPost(table, data) {
  if (activeStorageMode === STORAGE_MODE.LOCAL) {
    return saveLocalRecord(table, data);
  }
  if (activeStorageMode === STORAGE_MODE.SUPABASE) {
    return boxerSupabaseApiPost(table, data);
  }

  try {
    const res = await fetch(`${API_BASE}/${table}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      if (shouldFallbackToLocal(null, res)) {
        setStorageMode(STORAGE_MODE.LOCAL);
        notifyLocalFallback();
        return saveLocalRecord(table, data);
      }
      throw new Error(`POST ${table} failed`);
    }
    if (!responseLooksLikeJson(res)) {
      setStorageMode(STORAGE_MODE.LOCAL);
      notifyLocalFallback();
      return saveLocalRecord(table, data);
    }
    try {
      const record = await res.json();
      setStorageMode(STORAGE_MODE.API);
      return record;
    } catch (parseErr) {
      setStorageMode(STORAGE_MODE.LOCAL);
      notifyLocalFallback();
      return saveLocalRecord(table, data);
    }
  } catch (error) {
    if (shouldFallbackToLocal(error)) {
      setStorageMode(STORAGE_MODE.LOCAL);
      notifyLocalFallback();
      return saveLocalRecord(table, data);
    }
    throw error;
  }
}

async function apiDelete(table, id) {
  if (activeStorageMode === STORAGE_MODE.LOCAL) {
    deleteLocalRecord(table, id);
    return true;
  }
  if (activeStorageMode === STORAGE_MODE.SUPABASE) {
    return boxerSupabaseApiDelete(table, id);
  }

  try {
    const res = await fetch(`${API_BASE}/${table}/${id}`, { method: 'DELETE' });
    if (res.status === 204) {
      setStorageMode(STORAGE_MODE.API);
      return true;
    }
    if (res.ok) {
      const ct = res.headers.get('content-type') || '';
      if (ct.includes('text/html')) {
        setStorageMode(STORAGE_MODE.LOCAL);
        notifyLocalFallback();
        deleteLocalRecord(table, id);
        return true;
      }
      setStorageMode(STORAGE_MODE.API);
      return true;
    }
    if (shouldFallbackToLocal(null, res)) {
      setStorageMode(STORAGE_MODE.LOCAL);
      notifyLocalFallback();
      deleteLocalRecord(table, id);
      return true;
    }
    throw new Error(`DELETE ${table}/${id} failed`);
  } catch (error) {
    if (shouldFallbackToLocal(error)) {
      setStorageMode(STORAGE_MODE.LOCAL);
      notifyLocalFallback();
      deleteLocalRecord(table, id);
      return true;
    }
    throw error;
  }
}

async function apiPut(table, id, data) {
  if (activeStorageMode === STORAGE_MODE.LOCAL) {
    return updateLocalRecord(table, id, data);
  }
  if (activeStorageMode === STORAGE_MODE.SUPABASE) {
    return boxerSupabaseApiPut(table, id, data);
  }

  try {
    const res = await fetch(`${API_BASE}/${table}/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (res.ok) {
      if (res.status === 204) {
        setStorageMode(STORAGE_MODE.API);
        return { id, ...data };
      }
      if (!responseLooksLikeJson(res)) {
        setStorageMode(STORAGE_MODE.LOCAL);
        notifyLocalFallback();
        return updateLocalRecord(table, id, data);
      }
      setStorageMode(STORAGE_MODE.API);
      try {
        return await res.json();
      } catch (parseErr) {
        setStorageMode(STORAGE_MODE.LOCAL);
        notifyLocalFallback();
        return updateLocalRecord(table, id, data);
      }
    }
    // 405/501 は API が PUT 未対応のことが多い → ローカル更新に切り替え
    const putUnsupported = res.status === 405 || res.status === 501;
    if (shouldFallbackToLocal(null, res) || putUnsupported) {
      setStorageMode(STORAGE_MODE.LOCAL);
      notifyLocalFallback();
      return updateLocalRecord(table, id, data);
    }
    throw new Error(`PUT ${table}/${id} failed`);
  } catch (error) {
    if (shouldFallbackToLocal(error)) {
      setStorageMode(STORAGE_MODE.LOCAL);
      notifyLocalFallback();
      return updateLocalRecord(table, id, data);
    }
    throw error;
  }
}

// ============================================================
// LOAD ALL DATA
// ============================================================
async function loadAllData() {
  hasInitialDataLoaded = false;
  try {
    const [wRes, wpRes, mRes, tRes, fRes, oRes, fhRes, hRes, rRes] = await Promise.all([
      apiGet('weight_logs', 'sort=date'),
      apiGet('weight_log_photos', 'sort=created_at'),
      apiGet('meals', 'sort=date'),
      apiGet('training_logs', 'sort=date'),
      apiGet('fight_goals', 'sort=fight_date'),
      apiGet('opponents', 'sort=name'),
      apiGet('fight_history', 'sort=fight_date'),
      apiGet('hydration_logs', 'sort=date'),
      apiGet('recovery_logs', 'sort=date'),
    ]);
    weightLogs   = (wRes.data || []).map(normalizeWeightLogRecord);
    sortWeightLogsInPlace();
    weightLogPhotos = (wpRes.data || []).sort((a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0));
    mealLogs     = (mRes.data || []).sort((a,b) => new Date(a.date) - new Date(b.date));
    trainingLogs = (tRes.data || []).sort((a,b) => new Date(a.date) - new Date(b.date));
    fightGoals   = (fRes.data || []).sort((a,b) => new Date(a.fight_date) - new Date(b.fight_date));
    opponents    = (oRes.data || []).sort((a,b) => String(a.name || '').localeCompare(String(b.name || '')));
    fightHistory = (fhRes.data || []).sort((a,b) => new Date(a.fight_date) - new Date(b.fight_date));
    hydrationLogs = (hRes.data || []).sort((a,b) => new Date(a.date) - new Date(b.date));
    recoveryLogs  = (rRes.data || []).sort((a,b) => new Date(a.date) - new Date(b.date));
    hasInitialDataLoaded = true;
    renderDashboard();
    renderSettingsPage();
  } catch(e) {
    showToast('データの読み込みに失敗しました', 'error');
    console.error(e);
  }
}
