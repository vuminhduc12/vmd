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
const SUPABASE_AUTH_STORAGE_KEY = 'boxerpro.supabase.auth';
const SUPABASE_LAST_SEEN_INTERVAL_MS = 30 * 60 * 1000;
const SUPABASE_AUTH_TIMEOUT_MS = 8000;
const API_PAGE_SIZE = 500;
const API_MAX_PAGES = 40;
const SUPABASE_PAGE_SIZE = 1000;
const SUPABASE_MAX_PAGES = 20;
const RETENTION_MAX_DELETES_PER_RUN = 120;
const WRITE_RETRY_ATTEMPTS = 2;
const WRITE_RETRY_DELAY_MS = 220;
const RETENTION_POLICY_RULES = {
  meals: { days: 365 * 2, maxRows: 5000, dateField: 'date' },
  training_logs: { days: 365 * 2, maxRows: 5000, dateField: 'date' },
  hydration_logs: { days: 365 * 2, maxRows: 3000, dateField: 'date' },
  recovery_logs: { days: 365 * 2, maxRows: 3000, dateField: 'date' },
};
let supabaseLastSeenBindingDone = false;
let supabaseSessionRequest = null;
let supabaseSessionSnapshot = null;
let retentionPolicyAppliedOnce = false;
let aiCoachAdminAllowed = false;
let supabaseLogoutInFlight = false;
let supabaseAuthUiDebounceTimer = null;
let supabaseAuthUiInFlight = false;
let supabaseAuthUiQueued = false;
const DEFAULT_USER_CAPABILITIES = {
  roles: [],
  isAdmin: false,
  isAthlete: true,
  isTrainer: false,
  source: 'local',
};
let currentUserCapabilities = { ...DEFAULT_USER_CAPABILITIES };

function publishCurrentUserCapabilities() {
  if (typeof window !== 'undefined') {
    window.currentUserCapabilities = { ...currentUserCapabilities };
  }
}

function setCurrentUserCapabilities(patch = {}) {
  const roles = Array.isArray(patch.roles)
    ? [...new Set(patch.roles.map((role) => String(role || '').trim()).filter(Boolean))]
    : currentUserCapabilities.roles;
  currentUserCapabilities = {
    ...currentUserCapabilities,
    ...patch,
    roles,
  };
  publishCurrentUserCapabilities();
  return { ...currentUserCapabilities };
}

function resetCurrentUserCapabilities() {
  currentUserCapabilities = { ...DEFAULT_USER_CAPABILITIES };
  publishCurrentUserCapabilities();
  return { ...currentUserCapabilities };
}

function getCurrentUserCapabilities() {
  return { ...currentUserCapabilities };
}

publishCurrentUserCapabilities();

function sleep(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function isTransientHttpStatus(status) {
  const s = Number(status || 0);
  return s === 429 || s >= 500;
}

function isTransientWriteError(error) {
  if (!error) return false;
  if (error instanceof TypeError) return true;
  const status = Number(error?.status || 0);
  if (isTransientHttpStatus(status)) return true;
  const msg = String(error?.message || '').toLowerCase();
  return (
    msg.includes('network')
    || msg.includes('fetch')
    || msg.includes('timeout')
    || msg.includes('temporar')
    || msg.includes('gateway')
  );
}

async function withWriteRetry(task, label = 'write') {
  let lastError = null;
  for (let attempt = 1; attempt <= WRITE_RETRY_ATTEMPTS; attempt += 1) {
    try {
      return await task();
    } catch (error) {
      lastError = error;
      const canRetry = attempt < WRITE_RETRY_ATTEMPTS && isTransientWriteError(error);
      if (!canRetry) break;
      console.warn(`BOXER PRO: retry ${label} (${attempt}/${WRITE_RETRY_ATTEMPTS})`, error);
      await sleep(WRITE_RETRY_DELAY_MS * attempt);
    }
  }
  throw lastError || new Error(`${label} failed`);
}

async function fetchWithWriteRetry(url, init, label = 'fetch-write') {
  let lastError = null;
  for (let attempt = 1; attempt <= WRITE_RETRY_ATTEMPTS; attempt += 1) {
    try {
      const res = await fetch(url, init);
      if (attempt < WRITE_RETRY_ATTEMPTS && isTransientHttpStatus(res.status)) {
        await sleep(WRITE_RETRY_DELAY_MS * attempt);
        continue;
      }
      return res;
    } catch (error) {
      lastError = error;
      const canRetry = attempt < WRITE_RETRY_ATTEMPTS && isTransientWriteError(error);
      if (!canRetry) break;
      console.warn(`BOXER PRO: retry ${label} (${attempt}/${WRITE_RETRY_ATTEMPTS})`, error);
      await sleep(WRITE_RETRY_DELAY_MS * attempt);
    }
  }
  throw lastError || new Error(`${label} failed`);
}

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
          storageKey: SUPABASE_AUTH_STORAGE_KEY,
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

async function fetchCurrentUserRoles() {
  const sb = await getSupabaseClient();
  if (!sb || activeStorageMode !== STORAGE_MODE.SUPABASE) return [];
  const user = await getSupabaseUserSafe(sb);
  if (!user) return [];
  try {
    const { data, error } = await sb
      .from('boxer_user_roles')
      .select('role')
      .eq('user_id', user.id);
    if (error) throw error;
    return [...new Set((data || []).map((row) => String(row.role || '').trim()).filter(Boolean))];
  } catch (error) {
    const code = String(error?.code || '');
    const finalCode = String(error?.code || code);
    if (finalCode === '42P01' || finalCode === 'PGRST205') {
      console.warn('BOXER PRO: boxer_user_roles migration has not been applied yet');
      return [];
    }
    console.error('BOXER PRO: fetch user roles failed', error);
    return [];
  }
}

async function refreshCurrentUserCapabilities() {
  if (activeStorageMode !== STORAGE_MODE.SUPABASE) {
    return resetCurrentUserCapabilities();
  }
  const roles = await fetchCurrentUserRoles();
  const isAdmin = roles.includes('admin');
  const isTrainer = roles.includes('trainer');
  const isAthlete = roles.includes('athlete') || (!isTrainer && !roles.length);
  return setCurrentUserCapabilities({
    roles,
    isAdmin,
    isTrainer,
    isAthlete,
    source: roles.length ? 'db' : 'fallback',
  });
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
    user_id: row.user_id,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function normalizeTrainerEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function isValidTrainerEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeTrainerEmail(email));
}

async function boxerSupabaseApiGet(table, params = '') {
  const sb = await getSupabaseClient();
  const tn = BOXER_SUPABASE_TABLES[table];
  if (!sb || !tn) throw new Error('Supabase not available');
  const user = await getSupabaseUserSafe(sb);
  if (!user) throw new Error('Not signed in');
  const rows = [];
  for (let page = 0; page < SUPABASE_MAX_PAGES; page += 1) {
    const from = page * SUPABASE_PAGE_SIZE;
    const to = from + SUPABASE_PAGE_SIZE - 1;
    const { data, error } = await sb
      .from(tn)
      .select('id, user_id, payload, created_at, updated_at')
      .eq('user_id', user.id)
      .range(from, to);
    if (error) throw error;
    const chunk = (data || []).map(boxerRowToRecord);
    rows.push(...chunk);
    if (chunk.length < SUPABASE_PAGE_SIZE) break;
  }
  return { data: sortRows(rows, params) };
}

async function boxerSupabaseApiGetForAthlete(table, athleteUserId, params = '') {
  const sb = await getSupabaseClient();
  const tn = BOXER_SUPABASE_TABLES[table];
  const targetUserId = String(athleteUserId || '').trim();
  if (!sb || !tn || !targetUserId) throw new Error('Supabase trainer read is not available');
  const rows = [];
  for (let page = 0; page < SUPABASE_MAX_PAGES; page += 1) {
    const from = page * SUPABASE_PAGE_SIZE;
    const to = from + SUPABASE_PAGE_SIZE - 1;
    const { data, error } = await sb
      .from(tn)
      .select('id, user_id, payload, created_at, updated_at')
      .eq('user_id', targetUserId)
      .range(from, to);
    if (error) throw error;
    const chunk = (data || []).map(boxerRowToRecord);
    rows.push(...chunk);
    if (chunk.length < SUPABASE_PAGE_SIZE) break;
  }
  return { data: sortRows(rows, params) };
}

async function fetchAthleteTrainerLinks() {
  const sb = await getSupabaseClient();
  if (!sb || activeStorageMode !== STORAGE_MODE.SUPABASE) return [];
  const user = await getSupabaseUserSafe(sb);
  if (!user) return [];
  const { data, error } = await sb
    .from('boxer_trainer_links')
    .select('id, athlete_user_id, trainer_user_id, trainer_email, status, created_at, accepted_at, updated_at')
    .eq('athlete_user_id', user.id)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

async function saveTrainerInvite(email) {
  const trainerEmail = normalizeTrainerEmail(email);
  if (!isValidTrainerEmail(trainerEmail)) {
    throw new Error('トレーナーのメールアドレスを正しく入力してください');
  }
  const sb = await getSupabaseClient();
  if (!sb || activeStorageMode !== STORAGE_MODE.SUPABASE) {
    throw new Error('クラウドログイン中のみ利用できます');
  }
  const user = await getSupabaseUserSafe(sb);
  if (!user) throw new Error('ログインが必要です');
  if (normalizeTrainerEmail(user.email) === trainerEmail) {
    throw new Error('自分自身のメールは登録できません');
  }
  const { data, error } = await sb
    .from('boxer_trainer_links')
    .upsert({
      athlete_user_id: user.id,
      trainer_email: trainerEmail,
      status: 'pending',
      accepted_at: null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'athlete_user_id,trainer_email' })
    .select('id, athlete_user_id, trainer_user_id, trainer_email, status, created_at, accepted_at, updated_at')
    .single();
  if (error) throw error;
  return data;
}

async function revokeTrainerInvite(linkId) {
  const sb = await getSupabaseClient();
  if (!sb || activeStorageMode !== STORAGE_MODE.SUPABASE) {
    throw new Error('クラウドログイン中のみ利用できます');
  }
  const id = String(linkId || '').trim();
  if (!id) throw new Error('対象が不正です');
  const { data, error } = await sb.rpc('boxer_revoke_trainer_invite', { link_id: id });
  if (error) throw error;
  if (!data) throw new Error('招待を解除できませんでした');
  return data;
}

async function deleteTrainerInvite(linkId) {
  return revokeTrainerInvite(linkId);
}

async function acceptTrainerInvite(linkId) {
  const sb = await getSupabaseClient();
  if (!sb || activeStorageMode !== STORAGE_MODE.SUPABASE) {
    throw new Error('クラウドログイン中のみ利用できます');
  }
  const id = String(linkId || '').trim();
  if (!id) throw new Error('招待が不正です');
  const { data, error } = await sb.rpc('boxer_accept_trainer_invite', { link_id: id });
  if (error) throw error;
  if (!data) throw new Error('招待を承認できませんでした');
  return data;
}

async function fetchTrainerInviteRequests() {
  const sb = await getSupabaseClient();
  if (!sb || activeStorageMode !== STORAGE_MODE.SUPABASE) return [];
  const user = await getSupabaseUserSafe(sb);
  if (!user?.email) return [];
  const trainerEmail = normalizeTrainerEmail(user.email);
  const { data, error } = await sb
    .from('boxer_trainer_links')
    .select('id, athlete_user_id, trainer_user_id, trainer_email, status, created_at, accepted_at, updated_at')
    .eq('trainer_email', trainerEmail)
    .eq('status', 'pending')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

async function fetchTrainerAthletes() {
  const sb = await getSupabaseClient();
  if (!sb || activeStorageMode !== STORAGE_MODE.SUPABASE) return [];
  const user = await getSupabaseUserSafe(sb);
  if (!user?.email) return [];
  const trainerEmail = normalizeTrainerEmail(user.email);
  const { data: links, error } = await sb
    .from('boxer_trainer_links')
    .select('id, athlete_user_id, trainer_user_id, trainer_email, status, created_at, accepted_at, updated_at')
    .eq('trainer_email', trainerEmail)
    .eq('status', 'accepted')
    .order('created_at', { ascending: false });
  if (error) throw error;
  const rows = links || [];
  const athleteIds = [...new Set(rows.map((row) => row.athlete_user_id).filter(Boolean))];
  if (!athleteIds.length) return [];
  const { data: profiles, error: profileError } = await sb
    .from('boxer_profiles')
    .select('user_id, settings, last_seen_at, updated_at')
    .in('user_id', athleteIds);
  if (profileError) throw profileError;
  const profileMap = new Map((profiles || []).map((profile) => [profile.user_id, profile]));
  return rows.map((link) => ({
    ...link,
    profile: profileMap.get(link.athlete_user_id) || null,
  }));
}

async function fetchTrainerAthleteSnapshot(athleteUserId) {
  const [weights, photos, meals, training, hydration, recovery, notes] = await Promise.all([
    boxerSupabaseApiGetForAthlete('weight_logs', athleteUserId, 'sort=date'),
    boxerSupabaseApiGetForAthlete('weight_log_photos', athleteUserId, 'sort=created_at'),
    boxerSupabaseApiGetForAthlete('meals', athleteUserId, 'sort=date'),
    boxerSupabaseApiGetForAthlete('training_logs', athleteUserId, 'sort=date'),
    boxerSupabaseApiGetForAthlete('hydration_logs', athleteUserId, 'sort=date'),
    boxerSupabaseApiGetForAthlete('recovery_logs', athleteUserId, 'sort=date'),
    fetchTrainerNotes(athleteUserId),
  ]);
  return {
    weight_logs: weights.data || [],
    weight_log_photos: photos.data || [],
    meals: meals.data || [],
    training_logs: training.data || [],
    hydration_logs: hydration.data || [],
    recovery_logs: recovery.data || [],
    trainer_notes: notes || [],
  };
}

async function fetchTrainerNotes(athleteUserId) {
  const sb = await getSupabaseClient();
  const targetUserId = String(athleteUserId || '').trim();
  if (!sb || activeStorageMode !== STORAGE_MODE.SUPABASE || !targetUserId) return [];
  let { data, error } = await sb
    .from('boxer_trainer_notes')
    .select('id, athlete_user_id, trainer_user_id, trainer_display_name, note, created_at, updated_at')
    .eq('athlete_user_id', targetUserId)
    .order('created_at', { ascending: false })
    .limit(20);
  if (error) {
    const code = String(error?.code || '');
    const message = String(error?.message || '');
    if (code === '42703' || code === 'PGRST204' || message.includes('trainer_display_name')) {
      const fallback = await sb
        .from('boxer_trainer_notes')
        .select('id, athlete_user_id, trainer_user_id, note, created_at, updated_at')
        .eq('athlete_user_id', targetUserId)
        .order('created_at', { ascending: false })
        .limit(20);
      if (!fallback.error) {
        return (fallback.data || []).map((row) => ({ ...row, trainer_display_name: 'トレーナー' }));
      }
      error = fallback.error;
    }
    if (code === '42P01' || code === 'PGRST205') {
      console.warn('BOXER PRO: boxer_trainer_notes migration has not been applied yet');
      return [];
    }
    throw error;
  }
  return data || [];
}

async function fetchCurrentAthleteTrainerNotes() {
  const sb = await getSupabaseClient();
  if (!sb || activeStorageMode !== STORAGE_MODE.SUPABASE) return [];
  const user = await getSupabaseUserSafe(sb);
  if (!user) return [];
  return fetchTrainerNotes(user.id);
}

async function saveTrainerNoteForAthlete(athleteUserId, note) {
  const sb = await getSupabaseClient();
  if (!sb || activeStorageMode !== STORAGE_MODE.SUPABASE) {
    throw new Error('クラウドログイン中のみ利用できます');
  }
  const user = await getSupabaseUserSafe(sb);
  const targetUserId = String(athleteUserId || '').trim();
  const noteText = String(note || '').trim();
  if (!user) throw new Error('ログインが必要です');
  if (!targetUserId) throw new Error('選手が選択されていません');
  if (!noteText) throw new Error('コメントを入力してください');
  if (noteText.length > 1200) throw new Error('コメントは1200文字以内で入力してください');
  const { data, error } = await sb.rpc('boxer_create_trainer_note', {
    target_athlete_user_id: targetUserId,
    note_text: noteText,
  });
  if (error) throw error;
  return data;
}

async function deleteTrainerNote(noteId) {
  const sb = await getSupabaseClient();
  if (!sb || activeStorageMode !== STORAGE_MODE.SUPABASE) {
    throw new Error('クラウドログイン中のみ利用できます');
  }
  const id = String(noteId || '').trim();
  if (!id) throw new Error('削除対象が不正です');
  const { data, error } = await sb.rpc('boxer_delete_trainer_note', { note_id: id });
  if (error) throw error;
  if (!data) throw new Error('コメントを削除できませんでした');
  return data;
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
  const user = await getSupabaseUserSafe(sb);
  if (!user) throw new Error('Not signed in');
  const { error } = await sb.from(tn).delete().eq('user_id', user.id).eq('id', id);
  if (error) throw error;
  return true;
}

async function boxerSupabaseApiPut(table, id, data) {
  const sb = await getSupabaseClient();
  const tn = BOXER_SUPABASE_TABLES[table];
  if (!sb || !tn) throw new Error('Supabase not available');
  const user = await getSupabaseUserSafe(sb);
  if (!user) throw new Error('Not signed in');
  const { data: prevRow, error: e0 } = await sb.from(tn).select('payload').eq('user_id', user.id).eq('id', id).maybeSingle();
  if (e0) throw e0;
  const prev = prevRow?.payload && typeof prevRow.payload === 'object' ? prevRow.payload : {};
  const nextPayload = { ...prev, ...data, id, updated_at: new Date().toISOString() };
  const { data: row, error } = await sb.from(tn)
    .update({ payload: nextPayload })
    .eq('user_id', user.id)
    .eq('id', id)
    .select('id, user_id, payload, created_at, updated_at')
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
  try {
    await withWriteRetry(async () => {
      const { error } = await sb.from('boxer_profiles').upsert({
        user_id: user.id,
        settings: appSettings,
        last_seen_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });
      if (error) throw error;
      return true;
    }, 'supabase-settings');
  } catch (error) {
    console.error('Supabase settings save:', error);
  }
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
    await refreshCurrentUserCapabilities();
    await touchSupabaseLastSeen(true);
    cleanupSupabaseAuthRedirectUrl();
  } else {
    setStorageMode(STORAGE_MODE.LOCAL);
    resetCurrentUserCapabilities();
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
        await refreshCurrentUserCapabilities();
        await touchSupabaseLastSeen(true);
        cleanupSupabaseAuthRedirectUrl();
        applyAppSettings(true);
        await loadAllData();
        syncSupabaseUi();
        if (typeof renderDashboard === 'function') renderDashboard();
      } else if (event === 'SIGNED_OUT') {
        supabaseSessionSnapshot = null;
        setStorageMode(STORAGE_MODE.LOCAL);
        resetCurrentUserCapabilities();
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
  if (supabaseLogoutInFlight) return;
  const sb = await getSupabaseClient();
  if (!sb) return;
  supabaseLogoutInFlight = true;
  const loginBtn = document.getElementById('supabase-login-btn');
  const logoutBtn = document.getElementById('supabase-logout-btn');
  const mergeBtn = document.getElementById('supabase-merge-btn');
  if (loginBtn) loginBtn.disabled = true;
  if (logoutBtn) logoutBtn.disabled = true;
  if (mergeBtn) mergeBtn.disabled = true;

  const forceLocalLogout = async () => {
    supabaseSessionSnapshot = null;
    safeStorageRemoveItem(SUPABASE_AUTH_STORAGE_KEY);
    safeStorageSetItem(SUPABASE_LAST_SEEN_SYNC_KEY, '0', { context: 'last seen reset' });
    setStorageMode(STORAGE_MODE.LOCAL);
    appSettings = loadSettingsFromStorage();
    applyAppSettings(true);
    try {
      await loadAllData();
    } catch (err) {
      console.error('BOXER PRO: loadAllData after local logout', err);
    }
    syncSupabaseUi();
    if (typeof renderDashboard === 'function') renderDashboard();
  };

  try {
    // モバイルで 403(scope=global) が出るケースを避けるため local scope で終了する
    const out = await withTimeout(sb.auth.signOut({ scope: 'local' }), 5000, 'signOut');
    if (out?.error) throw out.error;
    await forceLocalLogout();
    showToast('ログアウトしました', 'success');
  } catch (error) {
    console.error('BOXER PRO: signOutSupabase fallback', error);
    await forceLocalLogout();
    showToast('ログアウト（ローカル）を完了しました', 'info');
  } finally {
    supabaseLogoutInFlight = false;
    if (loginBtn) loginBtn.disabled = false;
    if (logoutBtn) logoutBtn.disabled = false;
    if (mergeBtn) mergeBtn.disabled = false;
  }
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
  window.isAiCoachAdminAllowed = () => activeStorageMode === STORAGE_MODE.SUPABASE && aiCoachAdminAllowed;
  window.refreshAiCoachAdminAccess = refreshAiCoachAdminAccess;
  window.getCurrentUserCapabilities = getCurrentUserCapabilities;
  window.setCurrentUserCapabilities = setCurrentUserCapabilities;
  window.refreshCurrentUserCapabilities = refreshCurrentUserCapabilities;
}

function resetAdminStatsUi() {
  const card = document.getElementById('admin-stats-card');
  const storageCard = document.getElementById('settings-storage-card');
  const totalEl = document.getElementById('admin-total-users');
  const activeEl = document.getElementById('admin-active-users');
  const emailEl = document.getElementById('admin-stats-email');
  const updatedEl = document.getElementById('admin-stats-updated');
  if (card) card.hidden = true;
  if (storageCard) storageCard.hidden = true;
  if (totalEl) totalEl.textContent = '--';
  if (activeEl) activeEl.textContent = '--';
  if (emailEl) emailEl.textContent = '--';
  if (updatedEl) updatedEl.textContent = '--';
  aiCoachAdminAllowed = false;
  setAdminCapabilityAllowed(false);
}

function isTrainerAccessActiveForSettings() {
  const caps = getCurrentUserCapabilities();
  return !!caps.isTrainer
    || (typeof window !== 'undefined'
      && typeof window.isTrainerAccessActive === 'function'
      && window.isTrainerAccessActive());
}

function setAdminCapabilityAllowed(allowed) {
  const caps = getCurrentUserCapabilities();
  setCurrentUserCapabilities({
    roles: caps.roles,
    isAdmin: !!allowed,
  });
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
  // 送信直前にサーバー側で管理者権限を再確認して、非管理者の利用を確実に遮断する
  const adminCheck = await fetch('/api/admin/stats', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
  if (adminCheck.status === 401 || adminCheck.status === 403) {
    aiCoachAdminAllowed = false;
    setAdminCapabilityAllowed(false);
    throw new Error('AIコーチは管理者アカウントのみ利用できます');
  }
  if (!adminCheck.ok) {
    const body = await adminCheck.text().catch(() => '');
    throw new Error(body || `管理者権限チェックに失敗しました (${adminCheck.status})`);
  }
  aiCoachAdminAllowed = true;
  setAdminCapabilityAllowed(true);

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

async function refreshAiCoachAdminAccess() {
  aiCoachAdminAllowed = false;
  const sb = await getSupabaseClient();
  if (!sb || activeStorageMode !== STORAGE_MODE.SUPABASE) return false;
  if (isTrainerAccessActiveForSettings()) {
    setAdminCapabilityAllowed(false);
    return false;
  }
  try {
    const data = await fetchAdminStats();
    aiCoachAdminAllowed = !!data;
    setAdminCapabilityAllowed(aiCoachAdminAllowed);
    return aiCoachAdminAllowed;
  } catch (error) {
    console.error('BOXER PRO: refreshAiCoachAdminAccess', error);
    aiCoachAdminAllowed = false;
    setAdminCapabilityAllowed(false);
    return false;
  }
}

async function updateAdminStatsUi() {
  const card = document.getElementById('admin-stats-card');
  const storageCard = document.getElementById('settings-storage-card');
  const totalEl = document.getElementById('admin-total-users');
  const activeEl = document.getElementById('admin-active-users');
  const emailEl = document.getElementById('admin-stats-email');
  const updatedEl = document.getElementById('admin-stats-updated');
  if (!card || !totalEl || !activeEl || !emailEl || !updatedEl) return;

  resetAdminStatsUi();
  if (!isSupabaseConfigured()) return;
  if (isTrainerAccessActiveForSettings()) return;

  try {
    const data = await fetchAdminStats();
    if (!data) return;
    if (isTrainerAccessActiveForSettings()) return;
    if (storageCard) storageCard.hidden = false;
    card.hidden = false;
    totalEl.textContent = String(data.total_users ?? '--');
    activeEl.textContent = String(data.active_users_7d ?? '--');
    emailEl.textContent = data.admin_email || '--';
    updatedEl.textContent = data.measured_at
      ? `取得: ${formatDateTimeJP(data.measured_at)}`
      : '取得済み';
    aiCoachAdminAllowed = true;
    setAdminCapabilityAllowed(true);
  } catch (err) {
    console.error('BOXER PRO: updateAdminStatsUi', err);
    resetAdminStatsUi();
  }
}

async function updateSupabaseAuthUIInternal() {
  if (supabaseAuthUiInFlight) {
    supabaseAuthUiQueued = true;
    return;
  }
  supabaseAuthUiInFlight = true;
  const hint = document.getElementById('supabase-config-hint');
  const emailEl = document.getElementById('supabase-auth-email');
  const loginBtn = document.getElementById('supabase-login-btn');
  const logoutBtn = document.getElementById('supabase-logout-btn');
  const mergeBtn = document.getElementById('supabase-merge-btn');
  if (!hint || !emailEl || !loginBtn || !logoutBtn || !mergeBtn) {
    supabaseAuthUiInFlight = false;
    return;
  }

  const configured = isSupabaseConfigured();
  hint.hidden = configured;
  hint.style.display = configured ? 'none' : 'block';

  if (!configured) {
    emailEl.textContent = '—';
    loginBtn.style.display = 'none';
    logoutBtn.style.display = 'none';
    mergeBtn.style.display = 'none';
    resetAdminStatsUi();
    supabaseAuthUiInFlight = false;
    return;
  }

  await getSupabaseClient().then(async (sb) => {
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
    aiCoachAdminAllowed = false;
    emailEl.textContent = email || '未ログイン';
    const hasSession = !!session;
    const inCloud = activeStorageMode === STORAGE_MODE.SUPABASE && hasSession;
    renderProfileCard(inCloud ? session.user : null);
    loginBtn.style.display = hasSession ? 'none' : 'inline-flex';
    // ローカルフォールバック中でも、セッションが残っていればログアウト可能にする
    logoutBtn.style.display = hasSession ? 'inline-flex' : 'none';
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
  supabaseAuthUiInFlight = false;
  if (supabaseAuthUiQueued) {
    supabaseAuthUiQueued = false;
    void updateSupabaseAuthUIInternal();
  }
}

function updateSupabaseAuthUI() {
  if (supabaseAuthUiDebounceTimer) {
    window.clearTimeout(supabaseAuthUiDebounceTimer);
  }
  supabaseAuthUiDebounceTimer = window.setTimeout(() => {
    supabaseAuthUiDebounceTimer = null;
    void updateSupabaseAuthUIInternal();
  }, 120);
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
    const rows = [];
    for (let page = 0; page < API_MAX_PAGES; page += 1) {
      const offset = page * API_PAGE_SIZE;
      const res = await fetch(`${API_BASE}/${table}?limit=${API_PAGE_SIZE}&offset=${offset}${params ? '&' + params : ''}`);
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
      let payload;
      try {
        payload = await res.json();
      } catch (parseErr) {
        setStorageMode(STORAGE_MODE.LOCAL);
        notifyLocalFallback();
        return getLocalTableResponse(table, params);
      }
      const chunk = Array.isArray(payload?.data) ? payload.data : (Array.isArray(payload) ? payload : null);
      if (!Array.isArray(chunk)) {
        setStorageMode(STORAGE_MODE.LOCAL);
        notifyLocalFallback();
        return getLocalTableResponse(table, params);
      }
      rows.push(...chunk);
      if (chunk.length < API_PAGE_SIZE) break;
    }
    setStorageMode(STORAGE_MODE.API);
    return { data: sortRows(rows, params) };
  } catch (error) {
    if (shouldFallbackToLocal(error)) {
      setStorageMode(STORAGE_MODE.LOCAL);
      notifyLocalFallback();
      return getLocalTableResponse(table, params);
    }
    throw error;
  }
}

function normalizeDateValue(raw) {
  const text = String(raw || '').trim();
  if (!text) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  const normalized = text.replace(/\//g, '-').slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(normalized) ? normalized : '';
}

function getTableRowsByName(table) {
  if (table === 'meals') return mealLogs;
  if (table === 'training_logs') return trainingLogs;
  if (table === 'hydration_logs') return hydrationLogs;
  if (table === 'recovery_logs') return recoveryLogs;
  return [];
}

function setTableRowsByName(table, rows) {
  if (table === 'meals') mealLogs = rows;
  else if (table === 'training_logs') trainingLogs = rows;
  else if (table === 'hydration_logs') hydrationLogs = rows;
  else if (table === 'recovery_logs') recoveryLogs = rows;
}

function collectRetentionDeleteIds(table, rows) {
  const rule = RETENTION_POLICY_RULES[table];
  if (!rule || !Array.isArray(rows) || !rows.length) return [];

  const now = new Date();
  const cutoffDate = new Date(now);
  cutoffDate.setDate(cutoffDate.getDate() - Number(rule.days || 0));
  const cutoffIso = cutoffDate.toISOString().slice(0, 10);

  const withDate = rows
    .map((row) => ({
      id: row?.id,
      date: normalizeDateValue(row?.[rule.dateField]),
    }))
    .filter((item) => item.id && item.date)
    .sort((a, b) => a.date.localeCompare(b.date));

  const deletes = new Set();
  withDate.forEach((item) => {
    if (item.date < cutoffIso) deletes.add(item.id);
  });

  const keepSorted = withDate.filter((item) => !deletes.has(item.id));
  const overflow = keepSorted.length - Number(rule.maxRows || 0);
  if (overflow > 0) {
    keepSorted.slice(0, overflow).forEach((item) => deletes.add(item.id));
  }
  return [...deletes];
}

async function enforceRetentionPolicyOnce() {
  if (retentionPolicyAppliedOnce) return;
  retentionPolicyAppliedOnce = true;

  let deletedCount = 0;
  for (const table of Object.keys(RETENTION_POLICY_RULES)) {
    const rows = getTableRowsByName(table);
    const deleteIds = collectRetentionDeleteIds(table, rows).slice(0, RETENTION_MAX_DELETES_PER_RUN - deletedCount);
    if (!deleteIds.length) continue;

    const deleteSet = new Set();
    for (const id of deleteIds) {
      try {
        await apiDelete(table, id);
        deleteSet.add(id);
        deletedCount += 1;
        if (deletedCount >= RETENTION_MAX_DELETES_PER_RUN) break;
      } catch (error) {
        console.error(`Retention delete failed: ${table}/${id}`, error);
      }
    }
    if (deleteSet.size) {
      setTableRowsByName(table, rows.filter((row) => !deleteSet.has(row?.id)));
    }
    if (deletedCount >= RETENTION_MAX_DELETES_PER_RUN) break;
  }

  if (deletedCount > 0) {
    showToast(`保持ポリシーを適用し、古い記録を${deletedCount}件整理しました`, 'info');
    renderDashboard();
    renderWeightPage();
    renderMealsPage();
    renderTrainingPage();
    renderCaloriesPage();
    renderFightPage();
  }
}

async function apiPost(table, data) {
  if (activeStorageMode === STORAGE_MODE.LOCAL) {
    return saveLocalRecord(table, data);
  }
  if (activeStorageMode === STORAGE_MODE.SUPABASE) {
    return withWriteRetry(() => boxerSupabaseApiPost(table, data), `supabase-post:${table}`);
  }

  try {
    const res = await fetchWithWriteRetry(`${API_BASE}/${table}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }, `api-post:${table}`);
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
    return withWriteRetry(() => boxerSupabaseApiDelete(table, id), `supabase-delete:${table}`);
  }

  try {
    const res = await fetchWithWriteRetry(`${API_BASE}/${table}/${id}`, { method: 'DELETE' }, `api-delete:${table}`);
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
    return withWriteRetry(() => boxerSupabaseApiPut(table, id, data), `supabase-put:${table}`);
  }

  try {
    const res = await fetchWithWriteRetry(`${API_BASE}/${table}/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }, `api-put:${table}`);
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
    if (typeof refreshTrainerNavAccess === 'function') {
      await refreshTrainerNavAccess();
    }
    const activePageId = document.querySelector('.page.active')?.id || 'page-dashboard';
    if (typeof renderActivePageById === 'function') {
      renderActivePageById(activePageId);
    } else if (activePageId === 'page-settings') {
      renderSettingsPage();
    } else {
      renderDashboard();
    }
    void enforceRetentionPolicyOnce().catch((error) => console.error('Retention policy run failed', error));
  } catch(e) {
    showToast('データの読み込みに失敗しました', 'error');
    console.error(e);
  }
}
