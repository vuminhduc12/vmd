/* ============================================================
  BOXER PRO -- Main Application JavaScript
   ============================================================ */

'use strict';

// ============================================================
// CONSTANTS
// ============================================================
const API_BASE = 'tables';
const TODAY = () => new Date().toISOString().slice(0, 10);
const LOCAL_TABLE_PREFIX = 'boxerpro.table.';
const SETTINGS_KEY = 'boxerpro.settings';
const APP_SCHEMA_VERSION = 1;
const CUTTING_PLAN_URL = 'data/weight-cut-plan.csv';
const DATA_TABLES = ['weight_logs', 'meals', 'training_logs', 'fight_goals', 'hydration_logs', 'recovery_logs'];
const STORAGE_MODE = {
  CHECKING: 'checking',
  API: 'api',
  LOCAL: 'local',
  SUPABASE: 'supabase',
};

let supabaseClientPromise = null;
let supabaseAuthListenerBound = false;
const DEFAULT_SETTINGS = {
  athleteName: 'Vu Minh Duc',
  athleteRole: 'SE / Pro Boxer',
  heightCm: 170,
  age: 27,
  gender: 'male',
  targetWeight: '',
  dailyCalorieGoal: 1800,
  defaultMealType: '朝食',
  defaultTrainingIntensity: '中',
  landingPage: 'dashboard',
  remindersEnabled: true,
  reminderWeightTime: '07:00',
  reminderHydrationTime: '13:00',
  reminderSleepTime: '22:00',
};

// ============================================================
// FOOD DATABASE -- 120+ items (per 100g unless noted)
// CSV data from user's actual meal plan included
// ============================================================
const FOOD_DB = [
  // === タンパク質系 ===
  { name: '鶏胸肉(皮なし)', cat:'タンパク質', per100: { cal: 116, p: 24.4, f: 1.9, c: 0 }, unit: 'g', defaultAmt: 150 },
  { name: '鶏もも肉(皮なし)', cat:'タンパク質', per100: { cal: 138, p: 22.0, f: 5.0, c: 0 }, unit: 'g', defaultAmt: 150 },
  { name: '鶏むね肉(蒸し)', cat:'タンパク質', per100: { cal: 108, p: 24.6, f: 1.0, c: 0 }, unit: 'g', defaultAmt: 150 },
  { name: 'ゆで鶏(サラダチキン)', cat:'タンパク質', per100: { cal: 113, p: 24.2, f: 1.4, c: 0 }, unit: 'g', defaultAmt: 130 },
  { name: '牛赤身肉', cat:'タンパク質', per100: { cal: 130, p: 22.0, f: 4.2, c: 0.5 }, unit: 'g', defaultAmt: 100 },
  { name: '豚ロース(脂身なし)', cat:'タンパク質', per100: { cal: 150, p: 22.7, f: 6.0, c: 0.2 }, unit: 'g', defaultAmt: 100 },
  { name: 'ツナ缶(水煮)', cat:'タンパク質', per100: { cal: 71, p: 16.0, f: 0.7, c: 0.1 }, unit: 'g', defaultAmt: 70 },
  { name: '鮭(生)', cat:'タンパク質', per100: { cal: 138, p: 22.3, f: 4.1, c: 0.1 }, unit: 'g', defaultAmt: 100 },
  { name: 'まぐろ(赤身)', cat:'タンパク質', per100: { cal: 125, p: 26.4, f: 1.4, c: 0.1 }, unit: 'g', defaultAmt: 100 },
  { name: 'サバ缶(水煮)', cat:'タンパク質', per100: { cal: 174, p: 20.9, f: 10.7, c: 0.2 }, unit: 'g', defaultAmt: 190 },
  { name: 'タコ(茹で)', cat:'タンパク質', per100: { cal: 76, p: 16.5, f: 0.7, c: 0.1 }, unit: 'g', defaultAmt: 80 },
  { name: 'えび(ボイル)', cat:'タンパク質', per100: { cal: 97, p: 20.3, f: 1.5, c: 0 }, unit: 'g', defaultAmt: 80 },
  { name: '卵(全卵)', cat:'タンパク質', per100: { cal: 151, p: 12.3, f: 10.3, c: 0.3 }, unit: '個(50g)', defaultAmt: 50 },
  { name: '卵白', cat:'タンパク質', per100: { cal: 47, p: 11.0, f: 0, c: 0 }, unit: 'g', defaultAmt: 30 },
  { name: 'ゆでたまご', cat:'タンパク質', per100: { cal: 151, p: 12.9, f: 10.0, c: 0.4 }, unit: '個(50g)', defaultAmt: 50 },
  { name: '豆腐(木綿)', cat:'タンパク質', per100: { cal: 72, p: 6.6, f: 4.2, c: 1.6 }, unit: 'g', defaultAmt: 150 },
  { name: '豆腐(絹)', cat:'タンパク質', per100: { cal: 56, p: 4.9, f: 3.0, c: 2.0 }, unit: 'g', defaultAmt: 150 },
  { name: '納豆', cat:'タンパク質', per100: { cal: 200, p: 16.5, f: 10.0, c: 12.1 }, unit: 'パック(45g)', defaultAmt: 45 },
  { name: '枝豆', cat:'タンパク質', per100: { cal: 135, p: 11.5, f: 6.1, c: 8.8 }, unit: 'g', defaultAmt: 100 },

  // === プロテイン・サプリ ===
  { name: 'プロテインパウダー(WPI)', cat:'サプリ', per100: { cal: 380, p: 85.0, f: 2.0, c: 5.0 }, unit: 'g', defaultAmt: 30 },
  { name: 'プロテインパウダー(WPC)', cat:'サプリ', per100: { cal: 370, p: 75.0, f: 5.0, c: 10.0 }, unit: 'g', defaultAmt: 30 },
  { name: 'プロテインスクープ2杯', cat:'サプリ', per100: { cal: 228, p: 51.0, f: 1.2, c: 3.0 }, unit: '杯分(60g)', defaultAmt: 60 },
  { name: 'プロテインシェイク(200ml)', cat:'サプリ', per100: { cal: 120, p: 20.0, f: 2.0, c: 5.0 }, unit: '杯(200ml)', defaultAmt: 200 },
  { name: 'グルタミン5g', cat:'サプリ', per100: { cal: 10, p: 2.5, f: 0, c: 0 }, unit: 'g', defaultAmt: 5 },
  { name: 'BCAA(5g)', cat:'サプリ', per100: { cal: 20, p: 5.0, f: 0, c: 0 }, unit: 'g', defaultAmt: 5 },

  // === 炭水化物系 ===
  { name: '白米(炊いた)', cat:'炭水化物', per100: { cal: 168, p: 2.5, f: 0.3, c: 37.1 }, unit: 'g', defaultAmt: 150 },
  { name: '玄米(炊いた)', cat:'炭水化物', per100: { cal: 165, p: 2.8, f: 1.0, c: 35.6 }, unit: 'g', defaultAmt: 150 },
  { name: '麦ご飯', cat:'炭水化物', per100: { cal: 162, p: 3.1, f: 0.5, c: 34.2 }, unit: 'g', defaultAmt: 150 },
  { name: 'オートミール', cat:'炭水化物', per100: { cal: 380, p: 13.7, f: 5.7, c: 69.1 }, unit: 'g', defaultAmt: 50 },
  { name: 'さつまいも(蒸し)', cat:'炭水化物', per100: { cal: 131, p: 1.2, f: 0.2, c: 33.1 }, unit: 'g', defaultAmt: 100 },
  { name: 'じゃがいも(茹で)', cat:'炭水化物', per100: { cal: 84, p: 1.9, f: 0.1, c: 19.8 }, unit: 'g', defaultAmt: 100 },
  { name: 'パスタ(茹で)', cat:'炭水化物', per100: { cal: 165, p: 5.8, f: 0.9, c: 32.2 }, unit: 'g', defaultAmt: 150 },
  { name: '食パン', cat:'炭水化物', per100: { cal: 264, p: 9.3, f: 3.5, c: 49.2 }, unit: '枚(60g)', defaultAmt: 60 },
  { name: 'そば(茹で)', cat:'炭水化物', per100: { cal: 132, p: 4.8, f: 1.0, c: 26.0 }, unit: 'g', defaultAmt: 200 },
  { name: 'うどん(茹で)', cat:'炭水化物', per100: { cal: 105, p: 2.6, f: 0.4, c: 21.6 }, unit: 'g', defaultAmt: 200 },
  { name: '全粒粉パン', cat:'炭水化物', per100: { cal: 253, p: 9.5, f: 3.2, c: 44.8 }, unit: 'g', defaultAmt: 60 },

  // === 野菜 ===
  { name: 'ブロッコリー(茹で)', cat:'野菜', per100: { cal: 30, p: 3.5, f: 0.5, c: 3.3 }, unit: 'g', defaultAmt: 100 },
  { name: 'ほうれん草(茹で)', cat:'野菜', per100: { cal: 25, p: 2.6, f: 0.5, c: 3.6 }, unit: 'g', defaultAmt: 100 },
  { name: 'キャベツ', cat:'野菜', per100: { cal: 23, p: 1.3, f: 0.2, c: 5.2 }, unit: 'g', defaultAmt: 100 },
  { name: 'レタス', cat:'野菜', per100: { cal: 12, p: 0.6, f: 0.1, c: 2.8 }, unit: 'g', defaultAmt: 50 },
  { name: 'トマト', cat:'野菜', per100: { cal: 19, p: 0.7, f: 0.1, c: 4.7 }, unit: 'g', defaultAmt: 100 },
  { name: 'きゅうり', cat:'野菜', per100: { cal: 14, p: 1.0, f: 0.1, c: 3.0 }, unit: 'g', defaultAmt: 100 },
  { name: 'ごぼう(茹で)', cat:'野菜', per100: { cal: 58, p: 1.8, f: 0.2, c: 13.7 }, unit: 'g', defaultAmt: 50 },
  { name: 'もやし', cat:'野菜', per100: { cal: 14, p: 1.7, f: 0.1, c: 2.6 }, unit: 'g', defaultAmt: 100 },
  { name: 'アスパラガス', cat:'野菜', per100: { cal: 22, p: 2.6, f: 0.2, c: 3.9 }, unit: 'g', defaultAmt: 80 },
  { name: 'かぼちゃ(茹で)', cat:'野菜', per100: { cal: 60, p: 1.6, f: 0.3, c: 15.1 }, unit: 'g', defaultAmt: 100 },
  { name: 'ゴーヤ', cat:'野菜', per100: { cal: 17, p: 1.0, f: 0.1, c: 3.9 }, unit: 'g', defaultAmt: 100 },
  { name: 'にんじん', cat:'野菜', per100: { cal: 35, p: 0.7, f: 0.1, c: 8.7 }, unit: 'g', defaultAmt: 50 },
  { name: 'たまねぎ', cat:'野菜', per100: { cal: 37, p: 1.0, f: 0.1, c: 8.8 }, unit: 'g', defaultAmt: 50 },

  // === 果物 ===
  { name: 'バナナ', cat:'果物', per100: { cal: 86, p: 1.1, f: 0.2, c: 22.5 }, unit: '本(100g)', defaultAmt: 100 },
  { name: 'バナナ 1/2本', cat:'果物', per100: { cal: 86, p: 1.1, f: 0.2, c: 22.5 }, unit: '本(50g)', defaultAmt: 50 },
  { name: 'りんご', cat:'果物', per100: { cal: 54, p: 0.2, f: 0.1, c: 16.2 }, unit: 'g', defaultAmt: 150 },
  { name: 'みかん', cat:'果物', per100: { cal: 49, p: 0.7, f: 0.1, c: 12.0 }, unit: '個(80g)', defaultAmt: 80 },
  { name: 'キウイ', cat:'果物', per100: { cal: 53, p: 1.0, f: 0.1, c: 13.5 }, unit: '個(80g)', defaultAmt: 80 },
  { name: 'いちご', cat:'果物', per100: { cal: 34, p: 0.9, f: 0.1, c: 8.5 }, unit: 'g', defaultAmt: 100 },
  { name: 'ブルーベリー', cat:'果物', per100: { cal: 49, p: 0.5, f: 0.1, c: 12.9 }, unit: 'g', defaultAmt: 50 },

  // === 乳製品 ===
  { name: '牛乳', cat:'乳製品', per100: { cal: 67, p: 3.3, f: 3.8, c: 4.8 }, unit: 'ml', defaultAmt: 200 },
  { name: 'ヨーグルト(無糖)', cat:'乳製品', per100: { cal: 62, p: 3.6, f: 3.0, c: 4.9 }, unit: 'g', defaultAmt: 150 },
  { name: 'ヨーグルト(加糖)', cat:'乳製品', per100: { cal: 99, p: 3.6, f: 3.0, c: 13.9 }, unit: 'g', defaultAmt: 100 },
  { name: 'カッテージチーズ', cat:'乳製品', per100: { cal: 99, p: 13.3, f: 4.5, c: 1.9 }, unit: 'g', defaultAmt: 100 },
  { name: 'ギリシャヨーグルト', cat:'乳製品', per100: { cal: 59, p: 10.0, f: 0.4, c: 3.6 }, unit: 'g', defaultAmt: 150 },

  // === ナッツ・油脂 ===
  { name: 'アーモンド', cat:'ナッツ', per100: { cal: 598, p: 19.6, f: 51.8, c: 17.5 }, unit: 'g', defaultAmt: 25 },
  { name: 'くるみ', cat:'ナッツ', per100: { cal: 674, p: 14.6, f: 68.8, c: 11.7 }, unit: 'g', defaultAmt: 20 },
  { name: 'アーモンドバター', cat:'ナッツ', per100: { cal: 614, p: 21.0, f: 56.0, c: 13.0 }, unit: 'g', defaultAmt: 15 },
  { name: 'オリーブオイル', cat:'油脂', per100: { cal: 921, p: 0, f: 100, c: 0 }, unit: 'g(小さじ5g)', defaultAmt: 5 },

  // === 調味料・その他 ===
  { name: 'みそ汁(1杯)', cat:'汁物', per100: { cal: 40, p: 2.0, f: 1.5, c: 5.0 }, unit: '杯(200ml)', defaultAmt: 200 },
  { name: '野菜スープ(塩)', cat:'汁物', per100: { cal: 25, p: 1.5, f: 0.5, c: 4.0 }, unit: '杯(200ml)', defaultAmt: 200 },
  { name: 'お茶(無糖)', cat:'飲み物', per100: { cal: 0, p: 0, f: 0, c: 0 }, unit: 'ml', defaultAmt: 500 },
  { name: '水', cat:'飲み物', per100: { cal: 0, p: 0, f: 0, c: 0 }, unit: 'ml', defaultAmt: 500 },
  { name: 'スポーツドリンク', cat:'飲み物', per100: { cal: 25, p: 0, f: 0, c: 6.0 }, unit: 'ml', defaultAmt: 500 },
  { name: 'プロテインバー', cat:'その他', per100: { cal: 390, p: 30.0, f: 12.0, c: 40.0 }, unit: '本(60g)', defaultAmt: 60 },

  // === CSVユーザーデータ由来 ===
  { name: 'プロテイン2スクープ', cat:'サプリ', per100: { cal: 380, p: 85.0, f: 2.0, c: 5.0 }, unit: 'g(60g)', defaultAmt: 60 },
  { name: 'グルタミン', cat:'サプリ', per100: { cal: 10, p: 2.5, f: 0, c: 0 }, unit: 'g', defaultAmt: 5 },
  { name: 'パン70g', cat:'炭水化物', per100: { cal: 264, p: 9.3, f: 3.5, c: 49.2 }, unit: 'g', defaultAmt: 70 },
  { name: '納豆10g', cat:'タンパク質', per100: { cal: 200, p: 16.5, f: 10.0, c: 12.1 }, unit: 'g', defaultAmt: 10 },
  { name: 'ブロッコリー60g', cat:'野菜', per100: { cal: 30, p: 3.5, f: 0.5, c: 3.3 }, unit: 'g', defaultAmt: 60 },
  { name: '白米130g', cat:'炭水化物', per100: { cal: 168, p: 2.5, f: 0.3, c: 37.1 }, unit: 'g', defaultAmt: 130 },
  { name: '白米180g', cat:'炭水化物', per100: { cal: 168, p: 2.5, f: 0.3, c: 37.1 }, unit: 'g', defaultAmt: 180 },
  { name: '白米200g', cat:'炭水化物', per100: { cal: 168, p: 2.5, f: 0.3, c: 37.1 }, unit: 'g', defaultAmt: 200 },
  { name: '麻婆豆腐(小皿)', cat:'その他', per100: { cal: 90, p: 6.0, f: 5.5, c: 4.0 }, unit: 'g', defaultAmt: 150 },
  { name: 'みかん1個', cat:'果物', per100: { cal: 49, p: 0.7, f: 0.1, c: 12.0 }, unit: '個(80g)', defaultAmt: 80 },
  { name: 'バナナ1/2本', cat:'果物', per100: { cal: 86, p: 1.1, f: 0.2, c: 22.5 }, unit: '本(50g)', defaultAmt: 50 },
  { name: 'ゆで野菜150g', cat:'野菜', per100: { cal: 25, p: 2.0, f: 0.3, c: 4.0 }, unit: 'g', defaultAmt: 150 },
  { name: '刺身盛り(100g)', cat:'タンパク質', per100: { cal: 120, p: 22.0, f: 2.0, c: 0.5 }, unit: 'g', defaultAmt: 100 },
  { name: 'ゆで野菜200g', cat:'野菜', per100: { cal: 25, p: 2.0, f: 0.3, c: 4.0 }, unit: 'g', defaultAmt: 200 },
  { name: '切り干し大根', cat:'野菜', per100: { cal: 30, p: 1.5, f: 0.1, c: 7.0 }, unit: 'g', defaultAmt: 50 },
];

// Quick presets from user's CSV meal plan
const MEAL_PRESETS = {
  '朝食プリセット(減量)': [
    { name: 'プロテイン2スクープ', amt: 60 },
    { name: 'グルタミン', amt: 5 },
    { name: 'パン70g', amt: 70 },
    { name: '納豆10g', amt: 10 },
  ],
  '朝食プリセット(標準)': [
    { name: '白米130g', amt: 130 },
    { name: 'ゆでたまご', amt: 100 },
    { name: 'みそ汁(1杯)', amt: 200 },
    { name: 'ブロッコリー(茹で)', amt: 60 },
  ],
  '昼食プリセット': [
    { name: '白米200g', amt: 200 },
    { name: '鶏胸肉(皮なし)', amt: 150 },
    { name: 'ブロッコリー(茹で)', amt: 100 },
    { name: 'たまねぎ', amt: 50 },
  ],
  '夕食プリセット(軽め)': [
    { name: '白米130g', amt: 130 },
    { name: '鮭(生)', amt: 100 },
    { name: '豆腐(木綿)', amt: 150 },
    { name: 'ゆで野菜150g', amt: 150 },
  ],
  'プロテインシェイク': [
    { name: 'プロテインパウダー(WPI)', amt: 30 },
    { name: 'バナナ', amt: 100 },
    { name: '牛乳', amt: 200 },
  ],
};

// Calorie burn rates per minute by exercise type and intensity
const BURN_RATES = {
  'シャドーボクシング': { 低: 6, 中: 9, 高: 12, 最大: 15 },
  'サンドバッグ': { 低: 8, 中: 11, 高: 14, 最大: 18 },
  'ミット打ち': { 低: 9, 中: 13, 高: 16, 最大: 20 },
  'スパーリング': { 低: 10, 中: 14, 高: 18, 最大: 22 },
  'ロードワーク': { 低: 7, 中: 10, 高: 13, 最大: 16 },
  '筋トレ': { 低: 5, 中: 7, 高: 9, 最大: 12 },
  '縄跳び': { 低: 8, 中: 11, 高: 14, 最大: 17 },
  'ストレッチ': { 低: 2, 中: 3, 高: 4, 最大: 5 },
  'その他': { 低: 5, 中: 8, 高: 11, 最大: 14 },
};

// ============================================================
// STATE
// ============================================================
let weightLogs = [];
let mealLogs = [];
let trainingLogs = [];
let fightGoals = [];
let hydrationLogs = [];
let recoveryLogs = [];
let cuttingPlanRows = [];
let currentCutPlanTab = 'card';
let currentCalendarDate = new Date();
let pendingDeleteFn = null;
let activeStorageMode = STORAGE_MODE.CHECKING;
let storageFallbackNotified = false;
let deferredInstallPrompt = null;
let appSettings = { ...DEFAULT_SETTINGS };
let hasInitialDataLoaded = false;
let reminderIntervalId = null;
let storageWriteWarningShown = false;
const reminderSessionStamps = new Set();

// Chart instances
let weightChartInst = null;
let weightDetailChartInst = null;
let pfcChartInst = null;
let mealPfcChartInst = null;
let weeklyTrainingChartInst = null;
let calorieBalanceChartInst = null;
let trainingWeightRecoveryChartInst = null;
let editingWeightId = null;

// ============================================================
// UTILITIES
// ============================================================
function formatDate(dateStr) {
  if (!dateStr) return '--';
  const d = new Date(dateStr);
  return `${d.getFullYear()}/${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getDate()).padStart(2,'0')}`;
}

function formatDateJP(dateStr) {
  if (!dateStr) return '--';
  const d = new Date(dateStr);
  return `${d.getFullYear()}年${d.getMonth()+1}月${d.getDate()}日`;
}

function normalizeSlashDate(dateStr) {
  if (!dateStr) return '';
  const [year, month, day] = dateStr.split('/').map(Number);
  if (!year || !month || !day) return '';
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function safeStorageGetItem(key) {
  try {
    return localStorage.getItem(key);
  } catch (error) {
    console.warn(`Storage read failed: ${key}`, error);
    return null;
  }
}

function notifyStorageWriteFailure(context = 'データ保存') {
  if (storageWriteWarningShown) return;
  storageWriteWarningShown = true;
  showToast(`${context}に失敗しました。端末の保存領域を確認してください。`, 'error');
}

function safeStorageSetItem(key, value, options = {}) {
  const { silent = false, context = 'データ保存' } = options;
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (error) {
    console.error(`Storage write failed: ${key}`, error);
    if (!silent) notifyStorageWriteFailure(context);
    return false;
  }
}

function parseCsvLine(line) {
  const cols = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === ',' && !inQuotes) {
      cols.push(current.trim());
      current = '';
      continue;
    }

    current += char;
  }

  cols.push(current.trim());
  return cols;
}

function getDaysUntil(dateStr) {
  if (!dateStr) return null;
  const target = new Date(dateStr);
  target.setHours(0,0,0,0);
  const now = new Date();
  now.setHours(0,0,0,0);
  return Math.round((target - now) / (1000*60*60*24));
}

function getWeekStart(date = new Date()) {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() - day);
  d.setHours(0,0,0,0);
  return d;
}

function mergeSettings(raw = {}) {
  return {
    ...DEFAULT_SETTINGS,
    ...raw,
    heightCm: Number(raw.heightCm ?? DEFAULT_SETTINGS.heightCm) || DEFAULT_SETTINGS.heightCm,
    age: Number(raw.age ?? DEFAULT_SETTINGS.age) || DEFAULT_SETTINGS.age,
    dailyCalorieGoal: Number(raw.dailyCalorieGoal ?? DEFAULT_SETTINGS.dailyCalorieGoal) || DEFAULT_SETTINGS.dailyCalorieGoal,
    remindersEnabled: typeof raw.remindersEnabled === 'boolean' ? raw.remindersEnabled : DEFAULT_SETTINGS.remindersEnabled,
  };
}

function loadSettingsFromStorage() {
  try {
    const raw = safeStorageGetItem(SETTINGS_KEY);
    return mergeSettings(raw ? JSON.parse(raw) : {});
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

function persistSettingsToStorage() {
  safeStorageSetItem(SETTINGS_KEY, JSON.stringify(appSettings), { context: '設定保存' });
  if (activeStorageMode === STORAGE_MODE.SUPABASE) {
    void persistAppSettingsToSupabase().catch((err) => console.error(err));
  }
}

function setFieldValue(id, value, force = true) {
  const el = document.getElementById(id);
  if (!el) return;
  if (!force && el.value) return;
  el.value = value ?? '';
}

function renderProfileCard() {
  const nameEl = document.getElementById('profileNameDisplay');
  const roleEl = document.getElementById('profileRoleDisplay');
  if (nameEl) nameEl.textContent = appSettings.athleteName || DEFAULT_SETTINGS.athleteName;
  if (roleEl) roleEl.textContent = appSettings.athleteRole || DEFAULT_SETTINGS.athleteRole;
}

function applyAppSettings(force = false) {
  renderProfileCard();
  setFieldValue('quickHeight', appSettings.heightCm, force);
  setFieldValue('w-height', appSettings.heightCm, force);
  setFieldValue('calc-height', appSettings.heightCm, force);
  setFieldValue('calc-age', appSettings.age, force);
  setFieldValue('calc-gender', appSettings.gender, force);
  setFieldValue('caloricGoalInput', appSettings.dailyCalorieGoal, force);
  setFieldValue('m-type', appSettings.defaultMealType, force);
  setFieldValue('quickIntensity', appSettings.defaultTrainingIntensity, force);
  setFieldValue('t-intensity', appSettings.defaultTrainingIntensity, force);

  if (appSettings.targetWeight) {
    setFieldValue('w-target', appSettings.targetWeight, force);
    setFieldValue('f-target', appSettings.targetWeight, force);
  }

  if (typeof updateGoalBar === 'function') updateGoalBar();
  if (typeof updateWeightBmiPreview === 'function') updateWeightBmiPreview();
}

function getLatestKnownHeightCm() {
  const lastHeight = [...weightLogs].reverse().find(w => Number(w.height_cm));
  return Number(lastHeight?.height_cm) || Number(appSettings.heightCm) || DEFAULT_SETTINGS.heightCm;
}

function calculateBMI(weight, heightCm) {
  const w = Number(weight);
  const h = Number(heightCm);
  if (!w || !h) return null;
  const meters = h / 100;
  if (!meters) return null;
  return w / (meters * meters);
}

function getBmiBadgeHtml(bmi) {
  if (!bmi) return '<span class="badge">--</span>';
  if (bmi < 18.5) return '<span class="badge" style="background:rgba(74,144,226,0.18);color:#a9ceff">低体重</span>';
  if (bmi < 25) return '<span class="badge" style="background:rgba(48,208,128,0.16);color:#9bf2bf">標準</span>';
  if (bmi < 30) return '<span class="badge" style="background:rgba(240,192,64,0.16);color:#ffe18f">過体重</span>';
  return '<span class="badge" style="background:rgba(232,57,74,0.16);color:#ff9aa5">肥満</span>';
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

function setHtml(id, value) {
  const el = document.getElementById(id);
  if (el) el.innerHTML = value;
}

function setClassByState(id, state) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.remove('up', 'down', 'flat', 'pos', 'neg');
  if (state) el.classList.add(state);
}

function formatSignedKg(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '-- kg';
  const num = Number(value);
  const sign = num > 0 ? '+' : '';
  return `${sign}${num.toFixed(1)} kg`;
}

function average(values) {
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function clampNumber(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

/** 入力ミス防止: 許容レンジ（極端な数値の保存を防ぐ） */
const INPUT_BOUNDS = {
  weightKg: [30, 220],
  heightCm: [120, 230],
  bodyFatPct: [2, 70],
  muscleKg: [20, 150],
  targetWeightKg: [30, 220],
  mealAmountGrams: [1, 10000],
  mealCaloriesPerItem: [0, 20000],
  macroGPerItem: [0, 500],
  trainingMinutes: [1, 960],
  trainingBurnedKcal: [0, 15000],
  trainingRounds: [0, 50],
  trainingRating: [1, 5],
  hydrationWaterMl: [1, 20000],
  hydrationSweatMl: [0, 15000],
  sodiumMg: [0, 50000],
  sleepHours: [0.5, 24],
  score1to10: [1, 10],
  restingHr: [30, 220],
  age: [10, 100],
  calorieGoal: [500, 12000],
};

const TRAINING_INTENSITIES = ['低', '中', '高', '最大'];

function isIsoDateString(value) {
  if (!value || typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T12:00:00`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

function isValidTimeHHMM(value) {
  if (!value || typeof value !== 'string' || !/^\d{1,2}:\d{2}$/.test(value.trim())) return false;
  const [h, m] = value.trim().split(':').map(v => parseInt(v, 10));
  return h >= 0 && h <= 23 && m >= 0 && m <= 59;
}

function parseRequiredBounded(raw, bounds, label) {
  const n = parseFloat(String(raw ?? '').replace(/,/g, '').trim());
  if (!Number.isFinite(n)) return { ok: false, msg: `${label}は数値で入力してください` };
  if (n < bounds[0] || n > bounds[1]) {
    return { ok: false, msg: `${label}は${bounds[0]}〜${bounds[1]}の範囲で入力してください` };
  }
  return { ok: true, value: n };
}

function parseOptionalBounded(raw, bounds, label) {
  const s = String(raw ?? '').trim();
  if (!s) return { ok: true, value: null };
  return parseRequiredBounded(s, bounds, label);
}

function parseOptionalIntBounded(raw, bounds, label) {
  const s = String(raw ?? '').trim();
  if (!s) return { ok: true, value: null };
  const n = parseInt(s, 10);
  if (!Number.isFinite(n)) return { ok: false, msg: `${label}は整数で入力してください` };
  if (n < bounds[0] || n > bounds[1]) {
    return { ok: false, msg: `${label}は${bounds[0]}〜${bounds[1]}の範囲で入力してください` };
  }
  return { ok: true, value: n };
}

function getLatestEntryForDate(rows, dateStr) {
  return [...rows].reverse().find(row => row.date && row.date.slice(0, 10) === dateStr) || null;
}

function parseTargetWeightRange(rawValue) {
  const text = String(rawValue || '').trim();
  if (!text) return { label: '--', hasNumeric: false, min: null, max: null };
  const match = text.match(/(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)/);
  if (match) {
    const min = Number(match[1]);
    const max = Number(match[2]);
    return { label: `${min.toFixed(1)}-${max.toFixed(1)} kg`, hasNumeric: true, min, max };
  }
  const single = text.match(/(\d+(?:\.\d+)?)/);
  if (single) {
    const value = Number(single[1]);
    return { label: `${value.toFixed(1)} kg`, hasNumeric: true, min: value, max: value };
  }
  return { label: text, hasNumeric: false, min: null, max: null };
}

function getWeightGapToRange(actualWeight, range) {
  if (!range?.hasNumeric || actualWeight === null || actualWeight === undefined) return null;
  const actual = Number(actualWeight);
  if (Number.isNaN(actual)) return null;
  if (actual < range.min) return Number((actual - range.min).toFixed(1));
  if (actual > range.max) return Number((actual - range.max).toFixed(1));
  return 0;
}

function getPlanRowForDate(dateStr = TODAY()) {
  return cuttingPlanRows.find(row => row.date === dateStr)
    || cuttingPlanRows.find(row => row.date >= dateStr)
    || cuttingPlanRows[cuttingPlanRows.length - 1]
    || null;
}

function getDailyPerformanceSnapshot(dateStr = TODAY()) {
  const planRow = getPlanRowForDate(dateStr);
  const todayMeals = mealLogs.filter(m => m.date && m.date.slice(0, 10) === dateStr);
  const todayTraining = trainingLogs.filter(t => t.date && t.date.slice(0, 10) === dateStr);
  const todayHydration = getDailyHydration(dateStr);
  const todayRecovery = getDailyRecovery(dateStr);
  const latestRecovery = todayRecovery[todayRecovery.length - 1] || null;
  const actualWeightLog = getLatestEntryForDate(weightLogs, dateStr) || (weightLogs.length ? weightLogs[weightLogs.length - 1] : null);
  const actualWeight = actualWeightLog ? Number(actualWeightLog.weight) : null;
  const weightRange = parseTargetWeightRange(planRow?.targetMorningWeight);
  const water = todayHydration.reduce((sum, log) => sum + (parseFloat(log.water_ml) || 0), 0);
  const sweat = todayHydration.reduce((sum, log) => sum + (parseFloat(log.sweat_loss_ml) || 0), 0);
  const hydrationGap = water - sweat;
  const calories = todayMeals.reduce((sum, log) => sum + (parseFloat(log.calories) || 0), 0);
  const protein = todayMeals.reduce((sum, log) => sum + (parseFloat(log.protein) || 0), 0);
  const fat = todayMeals.reduce((sum, log) => sum + (parseFloat(log.fat) || 0), 0);
  const carbs = todayMeals.reduce((sum, log) => sum + (parseFloat(log.carbs) || 0), 0);
  const trainingMinutes = todayTraining.reduce((sum, log) => sum + (parseFloat(log.duration) || 0), 0);
  const activeFight = fightGoals
    .filter(f => f.status === '準備中' && f.fight_date)
    .sort((a, b) => new Date(a.fight_date) - new Date(b.fight_date))[0] || null;

  return {
    dateStr,
    planRow,
    actualWeightLog,
    actualWeight,
    weightRange,
    weightGap: getWeightGapToRange(actualWeight, weightRange),
    water,
    sweat,
    hydrationGap,
    latestRecovery,
    calories,
    protein,
    fat,
    carbs,
    trainingMinutes,
    activeFight,
  };
}

function createLineGradient(ctx, color) {
  const gradient = ctx.createLinearGradient(0, 0, 0, 260);
  gradient.addColorStop(0, `${color}55`);
  gradient.addColorStop(1, `${color}00`);
  return gradient;
}

function createBarGradient(ctx, topColor, bottomColor) {
  const gradient = ctx.createLinearGradient(0, 0, 0, 260);
  gradient.addColorStop(0, topColor);
  gradient.addColorStop(1, bottomColor);
  return gradient;
}

function trendState(delta) {
  if (delta < -0.05) return 'down';
  if (delta > 0.05) return 'up';
  return 'flat';
}

const chartGlowPlugin = {
  id: 'chartGlowPlugin',
  beforeDatasetDraw(chart, args) {
    const dataset = chart.data.datasets?.[args.index];
    if (!dataset || dataset.type === 'bar') return;
    const { ctx } = chart;
    ctx.save();
    ctx.shadowColor = dataset.borderColor || 'rgba(255,255,255,0.2)';
    ctx.shadowBlur = dataset.glowBlur ?? 14;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
  },
  afterDatasetDraw(chart, args) {
    const dataset = chart.data.datasets?.[args.index];
    if (!dataset || dataset.type === 'bar') return;
    chart.ctx.restore();
  },
};

if (typeof Chart !== 'undefined') {
  Chart.register(chartGlowPlugin);
}

function updateWeightBmiPreview() {
  const weight = parseFloat(document.getElementById('w-weight')?.value);
  const height = parseFloat(document.getElementById('w-height')?.value) || getLatestKnownHeightCm();
  const box = document.getElementById('bmiPreview');
  const val = document.getElementById('bmiPreviewVal');
  const badge = document.getElementById('bmiPreviewBadge');
  if (!box || !val || !badge) return;

  const bmi = calculateBMI(weight, height);
  if (!bmi) {
    box.style.display = 'none';
    return;
  }

  box.style.display = 'block';
  val.textContent = bmi.toFixed(1);
  badge.innerHTML = getBmiBadgeHtml(bmi);
}

function getStorageModeLabel() {
  if (activeStorageMode === STORAGE_MODE.API) return 'クラウド同期';
  if (activeStorageMode === STORAGE_MODE.SUPABASE) return 'クラウド (Supabase)';
  if (activeStorageMode === STORAGE_MODE.LOCAL) return 'ローカル保存';
  return '同期確認中';
}

function getTotalRecordCount() {
  return weightLogs.length + mealLogs.length + trainingLogs.length + fightGoals.length + hydrationLogs.length + recoveryLogs.length;
}

function getDailyHydration(dateStr) {
  return hydrationLogs.filter(h => h.date && h.date.slice(0, 10) === dateStr);
}

function getDailyRecovery(dateStr) {
  return recoveryLogs.filter(r => r.date && r.date.slice(0, 10) === dateStr);
}

function renderSettingsPage() {
  try {
  setFieldValue('s-name', appSettings.athleteName);
  setFieldValue('s-role', appSettings.athleteRole);
  setFieldValue('s-height', appSettings.heightCm);
  setFieldValue('s-age', appSettings.age);
  setFieldValue('s-gender', appSettings.gender);
  setFieldValue('s-target-weight', appSettings.targetWeight);
  setFieldValue('s-calorie-goal', appSettings.dailyCalorieGoal);
  setFieldValue('s-meal-type', appSettings.defaultMealType);
  setFieldValue('s-intensity', appSettings.defaultTrainingIntensity);
  setFieldValue('s-landing-page', appSettings.landingPage);
  setFieldValue('s-reminders-enabled', String(appSettings.remindersEnabled));
  setFieldValue('s-reminder-weight', appSettings.reminderWeightTime);
  setFieldValue('s-reminder-hydration', appSettings.reminderHydrationTime);
  setFieldValue('s-reminder-sleep', appSettings.reminderSleepTime);

  const modeEl = document.getElementById('settings-storage-mode');
  const totalEl = document.getElementById('settings-total-records');
  const reminderEl = document.getElementById('reminderStatusText');
  if (modeEl) modeEl.textContent = getStorageModeLabel();
  if (totalEl) totalEl.textContent = String(getTotalRecordCount());
  if (reminderEl) {
    const permission = 'Notification' in window ? Notification.permission : 'unsupported';
    reminderEl.textContent = appSettings.remindersEnabled
      ? `体重 ${appSettings.reminderWeightTime} / 水分 ${appSettings.reminderHydrationTime} / 睡眠 ${appSettings.reminderSleepTime} ・ 通知権限 ${permission}`
      : '通知はOFFです。アプリ起動中のローカル通知も停止します。';
  }
  updateSupabaseAuthUI();
  } catch (err) {
    console.error('BOXER PRO: renderSettingsPage', err);
  }
}

function saveAppSettings() {
  const heightRaw = document.getElementById('s-height').value.trim();
  let heightCm = DEFAULT_SETTINGS.heightCm;
  if (heightRaw) {
    const hChk = parseRequiredBounded(heightRaw, INPUT_BOUNDS.heightCm, '身長');
    if (!hChk.ok) { showToast(hChk.msg, 'error'); return; }
    heightCm = hChk.value;
  }

  const ageRaw = document.getElementById('s-age').value.trim();
  let age = DEFAULT_SETTINGS.age;
  if (ageRaw) {
    const aChk = parseRequiredIntBounded(ageRaw, INPUT_BOUNDS.age, '年齢');
    if (!aChk.ok) { showToast(aChk.msg, 'error'); return; }
    age = aChk.value;
  }

  const calRaw = document.getElementById('s-calorie-goal').value.trim();
  let dailyCalorieGoal = DEFAULT_SETTINGS.dailyCalorieGoal;
  if (calRaw) {
    const cChk = parseRequiredIntBounded(calRaw, INPUT_BOUNDS.calorieGoal, '1日の目標カロリー');
    if (!cChk.ok) { showToast(cChk.msg, 'error'); return; }
    dailyCalorieGoal = cChk.value;
  }

  const twRaw = document.getElementById('s-target-weight').value.trim();
  let targetWeight = '';
  if (twRaw) {
    const twChk = parseRequiredBounded(twRaw, INPUT_BOUNDS.targetWeightKg, '目標体重');
    if (!twChk.ok) { showToast(twChk.msg, 'error'); return; }
    targetWeight = String(twChk.value);
  }

  const reminderWeightTime = (document.getElementById('s-reminder-weight').value || DEFAULT_SETTINGS.reminderWeightTime).trim();
  const reminderHydrationTime = (document.getElementById('s-reminder-hydration').value || DEFAULT_SETTINGS.reminderHydrationTime).trim();
  const reminderSleepTime = (document.getElementById('s-reminder-sleep').value || DEFAULT_SETTINGS.reminderSleepTime).trim();
  if (!isValidTimeHHMM(reminderWeightTime)) { showToast('体重リマインダーは HH:MM（例 07:00）で入力してください', 'error'); return; }
  if (!isValidTimeHHMM(reminderHydrationTime)) { showToast('水分リマインダーは HH:MM で入力してください', 'error'); return; }
  if (!isValidTimeHHMM(reminderSleepTime)) { showToast('睡眠リマインダーは HH:MM で入力してください', 'error'); return; }

  const di = document.getElementById('s-intensity').value;
  if (!TRAINING_INTENSITIES.includes(di)) { showToast('既定の練習強度を選択してください', 'error'); return; }

  appSettings = mergeSettings({
    athleteName: document.getElementById('s-name').value.trim() || DEFAULT_SETTINGS.athleteName,
    athleteRole: document.getElementById('s-role').value.trim() || DEFAULT_SETTINGS.athleteRole,
    heightCm,
    age,
    gender: document.getElementById('s-gender').value || DEFAULT_SETTINGS.gender,
    targetWeight,
    dailyCalorieGoal,
    defaultMealType: document.getElementById('s-meal-type').value || DEFAULT_SETTINGS.defaultMealType,
    defaultTrainingIntensity: di,
    landingPage: document.getElementById('s-landing-page').value || DEFAULT_SETTINGS.landingPage,
    remindersEnabled: document.getElementById('s-reminders-enabled').value === 'true',
    reminderWeightTime,
    reminderHydrationTime,
    reminderSleepTime,
  });

  persistSettingsToStorage();
  applyAppSettings(true);
  renderSettingsPage();
  renderWeightPage();
  renderCaloriesPage();
  showToast('設定を保存しました', 'success');
}

function buildExportPayload() {
  return {
    schemaVersion: APP_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    storageMode: activeStorageMode,
    settings: appSettings,
    tables: {
      weight_logs: weightLogs,
      meals: mealLogs,
      training_logs: trainingLogs,
      fight_goals: fightGoals,
      hydration_logs: hydrationLogs,
      recovery_logs: recoveryLogs,
    },
  };
}

function exportAppData() {
  const payload = buildExportPayload();
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `boxer-pro-backup-${TODAY()}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('バックアップを書き出しました', 'success');
}

function triggerImportAppData() {
  document.getElementById('appDataImportInput')?.click();
}

async function importAppDataFromFile(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  try {
    const text = await file.text();
    const parsed = JSON.parse(text);
    const tables = parsed?.tables || {};

    DATA_TABLES.forEach(table => {
      writeLocalTable(table, Array.isArray(tables[table]) ? tables[table] : []);
    });

    appSettings = mergeSettings(parsed?.settings || {});
    persistSettingsToStorage();
    setStorageMode(STORAGE_MODE.LOCAL);
    storageFallbackNotified = true;
    applyAppSettings(true);
    await loadAllData();
    renderSettingsPage();
    showToast('バックアップを復元しました', 'success');
  } catch (error) {
    console.error(error);
    showToast('復元に失敗しました', 'error');
  } finally {
    event.target.value = '';
  }
}

function showToast(message, type = 'success') {
  const icons = { success: 'fa-check-circle', error: 'fa-times-circle', info: 'fa-info-circle' };
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<i class="fas ${icons[type]}"></i><span>${message}</span>`;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 4000);
}

function showModal(title, msg, onConfirm) {
  document.getElementById('modalTitle').textContent = title;
  document.getElementById('modalMsg').textContent = msg;
  document.getElementById('modalOverlay').classList.add('active');
  pendingDeleteFn = onConfirm;
  document.getElementById('modalConfirmBtn').onclick = () => {
    onConfirm();
    closeModal();
  };
}

function closeModal() {
  document.getElementById('modalOverlay').classList.remove('active');
  pendingDeleteFn = null;
}

function setStorageMode(mode) {
  activeStorageMode = mode;
  const badge = document.getElementById('storageStatusBadge');
  if (!badge) return;

  badge.classList.remove('is-api', 'is-local');

  if (mode === STORAGE_MODE.API) {
    badge.textContent = 'クラウド同期';
    badge.classList.add('is-api');
    renderSettingsPage();
    return;
  }

  if (mode === STORAGE_MODE.SUPABASE) {
    badge.textContent = 'クラウド (Supabase)';
    badge.classList.add('is-api');
    renderSettingsPage();
    return;
  }

  if (mode === STORAGE_MODE.LOCAL) {
    badge.textContent = 'ローカル保存';
    badge.classList.add('is-local');
    renderSettingsPage();
    return;
  }

  badge.textContent = '同期確認中';
  renderSettingsPage();
}

function getLocalTableKey(table) {
  return `${LOCAL_TABLE_PREFIX}${table}`;
}

function readLocalTable(table) {
  try {
    const raw = safeStorageGetItem(getLocalTableKey(table));
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeLocalTable(table, rows) {
  return safeStorageSetItem(getLocalTableKey(table), JSON.stringify(rows), { context: 'ローカル保存' });
}

function createRecordId() {
  if (window.crypto?.randomUUID) return window.crypto.randomUUID();
  return `local-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function sortRows(rows, params = '') {
  const sortKey = new URLSearchParams(params).get('sort');
  if (!sortKey) return [...rows];
  return [...rows].sort((a, b) => {
    const av = a?.[sortKey];
    const bv = b?.[sortKey];
    return String(av || '').localeCompare(String(bv || ''));
  });
}

function getLocalTableResponse(table, params = '') {
  return { data: sortRows(readLocalTable(table), params) };
}

function shouldFallbackToLocal(error, res) {
  if (!navigator.onLine) return true;
  if (res && (res.status === 404 || res.status >= 500)) return true;
  if (error instanceof TypeError) return true;
  // 静的ホストが /tables/* に HTML を返して res.json() が失敗したとき
  if (error instanceof SyntaxError) return true;
  return false;
}

function responseLooksLikeJson(res) {
  const ct = res.headers.get('content-type') || '';
  return ct.includes('application/json');
}

function notifyLocalFallback() {
  if (storageFallbackNotified) return;
  storageFallbackNotified = true;
  showToast('API未接続のため、この端末に保存して継続します', 'info');
}

function saveLocalRecord(table, data) {
  const rows = readLocalTable(table);
  const record = { id: createRecordId(), created_at: new Date().toISOString(), ...data };
  rows.push(record);
  writeLocalTable(table, rows);
  return record;
}

function deleteLocalRecord(table, id) {
  const rows = readLocalTable(table).filter(row => row.id !== id);
  writeLocalTable(table, rows);
}

function updateLocalRecord(table, id, data) {
  const rows = readLocalTable(table);
  const idx = rows.findIndex(row => row.id === id);
  if (idx === -1) return null;
  const prev = rows[idx];
  const next = { ...prev, ...data, updated_at: new Date().toISOString() };
  rows[idx] = next;
  writeLocalTable(table, rows);
  return next;
}

function setDateInputs() {
  const today = TODAY();
  ['w-date','m-date','t-date','mealViewDate','mealFilterDate','h-date','r-date'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = today;
  });
}

// ============================================================
// NAVIGATION
// ============================================================
function initNav() {
  const navItems = document.querySelectorAll('.nav-item[data-page]');
  const pageMap = {
    'dashboard': 'ダッシュボード',
    'weight': '⚖️ 体重管理',
    'meals': '🍱 食事管理',
    'training': '🥊 練習スケジュール',
    'calories': '🔥 カロリー計算',
    'fight': '🏆 試合目標',
    'settings': '⚙️ マイ設定',
  };

  navItems.forEach(item => {
    const link = item.querySelector('.nav-link');
    if (!link) return;
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const page = item.dataset.page;
      switchPage(page);
      // Close sidebar on mobile
      if (window.innerWidth <= 900) {
        document.getElementById('sidebar').classList.remove('open');
      }
    });
  });

  // Topbar hamburger
  document.getElementById('topbarMenuBtn').addEventListener('click', () => {
    document.getElementById('sidebar').classList.toggle('open');
  });
  document.getElementById('sidebarToggle').addEventListener('click', () => {
    document.getElementById('sidebar').classList.toggle('open');
  });
}

function updateMobileNav(pageName) {
  document.querySelectorAll('.mobile-nav-btn[data-page]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.page === pageName);
  });
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
    'dash-weight': () => mobileNavigateTo('dashboard', '#dash-quick-anchor', 'quickWeight'),
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
  // Update nav
  document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
  const activeItem = document.querySelector(`.nav-item[data-page="${pageName}"]`);
  if (activeItem) activeItem.classList.add('active');
  updateMobileNav(pageName);

  // Update pages
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const activePage = document.getElementById(`page-${pageName}`);
  if (activePage) activePage.classList.add('active');

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
  document.getElementById('topbarTitle').textContent = titles[pageName] || pageName;

  // Load page-specific data
  if (pageName === 'weight') renderWeightPage();
  if (pageName === 'meals') renderMealsPage();
  if (pageName === 'training') renderTrainingPage();
  if (pageName === 'calories') renderCaloriesPage();
  if (pageName === 'fight') renderFightPage();
  if (pageName === 'settings') renderSettingsPage();
}

// ============================================================
// SUPABASE (config + data layer)
// ============================================================
const BOXER_SUPABASE_TABLES = {
  weight_logs: 'boxer_weight_logs',
  meals: 'boxer_meals',
  training_logs: 'boxer_training_logs',
  fight_goals: 'boxer_fight_goals',
  hydration_logs: 'boxer_hydration_logs',
  recovery_logs: 'boxer_recovery_logs',
};

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
      const cfg = window.BOXER_PRO_CONFIG;
      return createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
        },
      });
    } catch (err) {
      console.error('BOXER PRO: Supabase クライアントを作成できません', err);
      return null;
    }
  })();
  return supabaseClientPromise;
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
  const { data: { user } } = await sb.auth.getUser();
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
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return;
  const { data, error } = await sb.from('boxer_profiles').select('settings').eq('user_id', user.id).maybeSingle();
  if (error || !data?.settings) return;
  appSettings = mergeSettings(data.settings);
  safeStorageSetItem(SETTINGS_KEY, JSON.stringify(appSettings), { context: '設定キャッシュ' });
}

async function persistAppSettingsToSupabase() {
  const sb = await getSupabaseClient();
  if (!sb || activeStorageMode !== STORAGE_MODE.SUPABASE) return;
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return;
  const { error } = await sb.from('boxer_profiles').upsert({
    user_id: user.id,
    settings: appSettings,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id' });
  if (error) console.error('Supabase settings save:', error);
}

async function initSupabaseAuth() {
  if (!isSupabaseConfigured()) return;
  const sb = await getSupabaseClient();
  if (!sb) {
    setStorageMode(STORAGE_MODE.LOCAL);
    return;
  }

  const { data: { session } } = await sb.auth.getSession();
  if (session?.user) {
    setStorageMode(STORAGE_MODE.SUPABASE);
    await loadAppSettingsFromSupabase();
  } else {
    setStorageMode(STORAGE_MODE.LOCAL);
  }

  if (!supabaseAuthListenerBound) {
    supabaseAuthListenerBound = true;
    sb.auth.onAuthStateChange(async (event, sess) => {
      if (event === 'SIGNED_IN' && sess?.user) {
        setStorageMode(STORAGE_MODE.SUPABASE);
        await loadAppSettingsFromSupabase();
        applyAppSettings(true);
        await loadAllData();
        renderSettingsPage();
        if (typeof renderDashboard === 'function') renderDashboard();
      } else if (event === 'SIGNED_OUT') {
        setStorageMode(STORAGE_MODE.LOCAL);
        appSettings = loadSettingsFromStorage();
        applyAppSettings(true);
        await loadAllData();
        renderSettingsPage();
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
  const { data: { user } } = await sb.auth.getUser();
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
    return;
  }

  getSupabaseClient().then(async (sb) => {
    if (!sb) return;
    const { data: { session } } = await sb.auth.getSession();
    const email = session?.user?.email || '';
    emailEl.textContent = email || '未ログイン';
    const inCloud = activeStorageMode === STORAGE_MODE.SUPABASE && !!session;
    loginBtn.style.display = inCloud ? 'none' : 'inline-flex';
    logoutBtn.style.display = inCloud ? 'inline-flex' : 'none';
    mergeBtn.style.display = inCloud ? 'inline-flex' : 'none';
  }).catch(() => {});
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
    const [wRes, mRes, tRes, fRes, hRes, rRes] = await Promise.all([
      apiGet('weight_logs', 'sort=date'),
      apiGet('meals', 'sort=date'),
      apiGet('training_logs', 'sort=date'),
      apiGet('fight_goals', 'sort=fight_date'),
      apiGet('hydration_logs', 'sort=date'),
      apiGet('recovery_logs', 'sort=date'),
    ]);
    weightLogs   = (wRes.data || []).sort((a,b) => new Date(a.date) - new Date(b.date));
    mealLogs     = (mRes.data || []).sort((a,b) => new Date(a.date) - new Date(b.date));
    trainingLogs = (tRes.data || []).sort((a,b) => new Date(a.date) - new Date(b.date));
    fightGoals   = (fRes.data || []).sort((a,b) => new Date(a.fight_date) - new Date(b.fight_date));
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

async function loadCuttingPlanText() {
  try {
    const response = await fetch(CUTTING_PLAN_URL);
    if (!response.ok) throw new Error('Failed to load cutting plan');
    return await response.text();
  } catch (networkError) {
    if ('caches' in window) {
      const cached = await caches.match(CUTTING_PLAN_URL) || await caches.match(`./${CUTTING_PLAN_URL}`);
      if (cached) return cached.text();
    }
    throw networkError;
  }
}

async function loadCuttingPlanData() {
  try {
    const text = await loadCuttingPlanText();
    const lines = text.split(/\r?\n/).filter(line => line.trim());
    cuttingPlanRows = lines.slice(1).map(line => {
      const parts = parseCsvLine(line);
      return {
        date: normalizeSlashDate(parts[0]),
        phase: parts[1] || '',
        targetMorningWeight: parts[2] || '',
        breakfast: parts[3] || '',
        lunch: parts[4] || '',
        dinner: parts[5] || '',
        snack: parts[6] || '',
        totalKcalTarget: Number(parts[7]) || 0,
        protein: Number(parts[8]) || 0,
        fat: Number(parts[9]) || 0,
        carbs: Number(parts[10]) || 0,
        hydrationMemo: parts[11] || '',
        conditionMemo: parts[12] || '',
      };
    }).filter(row => row.date);
  } catch (error) {
    console.error(error);
    cuttingPlanRows = [];
  }
}

function renderPerformanceCoach() {
  const badge = document.getElementById('readinessBadge');
  const scoreEl = document.getElementById('readinessScore');
  if (!badge || !scoreEl) return;

  const snapshot = getDailyPerformanceSnapshot(TODAY());
  const planTarget = snapshot.planRow?.totalKcalTarget || Number(appSettings.dailyCalorieGoal) || 1800;
  const proteinTarget = snapshot.actualWeight ? snapshot.actualWeight * 1.8 : 110;
  const sleep = Number(snapshot.latestRecovery?.sleep_hours) || 0;
  const condition = Number(snapshot.latestRecovery?.condition_score) || 0;
  const fatigue = Number(snapshot.latestRecovery?.fatigue_score) || 0;

  let weightScore = 12;
  let weightStatus = '比較待ち';
  let weightSub = snapshot.activeFight ? '朝体重を記録すると精度が上がります' : '次の試合目標を入れると判定します';
  if (snapshot.weightGap === 0) {
    weightScore = 20;
    weightStatus = '範囲内';
    weightSub = `予定 ${snapshot.weightRange.label}`;
  } else if (snapshot.weightGap !== null) {
    const absGap = Math.abs(snapshot.weightGap);
    weightScore = absGap <= 0.3 ? 15 : absGap <= 0.6 ? 10 : 4;
    weightStatus = snapshot.weightGap > 0 ? '上振れ' : '下振れ';
    weightSub = `${snapshot.weightGap > 0 ? '+' : ''}${snapshot.weightGap.toFixed(1)} kg / 予定 ${snapshot.weightRange.label}`;
  }

  let hydrationScore = 6;
  let hydrationStatus = '未記録';
  let hydrationSub = '水分ログを追加';
  if (snapshot.water > 0) {
    hydrationScore = snapshot.water >= 2000 && snapshot.hydrationGap >= 0 ? 20 : snapshot.water >= 1500 ? 15 : 9;
    hydrationStatus = snapshot.hydrationGap >= 0 ? '補えている' : '不足気味';
    hydrationSub = `${Math.round(snapshot.water)}ml / 発汗差 ${Math.round(snapshot.hydrationGap)}ml`;
  }

  let recoveryScore = 10;
  let recoveryStatus = '未記録';
  let recoverySub = '睡眠・疲労ログを追加';
  if (snapshot.latestRecovery) {
    recoveryScore = Math.round(
      clampNumber((sleep / 8) * 13, 0, 13)
      + clampNumber((condition / 10) * 12, 0, 12)
      + clampNumber(((10 - fatigue) / 10) * 10, 0, 10)
    );
    recoveryStatus = condition >= 8 && fatigue <= 4 ? '良好' : condition >= 6 && fatigue <= 6 ? '維持' : '要回復';
    recoverySub = `睡眠 ${sleep.toFixed(1)}h / 体調 ${condition}/10 / 疲労 ${fatigue}/10`;
  }

  let fuelScore = 8;
  let fuelStatus = '未記録';
  let fuelSub = '食事ログを追加';
  if (snapshot.calories > 0 || snapshot.protein > 0) {
    const kcalGapRatio = planTarget ? Math.abs(snapshot.calories - planTarget) / planTarget : 0;
    const proteinRatio = proteinTarget ? snapshot.protein / proteinTarget : 0;
    fuelScore = (kcalGapRatio <= 0.12 ? 12 : kcalGapRatio <= 0.25 ? 8 : 4)
      + (proteinRatio >= 1 ? 13 : proteinRatio >= 0.8 ? 9 : proteinRatio >= 0.6 ? 6 : 3);
    fuelStatus = kcalGapRatio <= 0.12 && proteinRatio >= 0.9 ? '順調' : kcalGapRatio <= 0.25 && proteinRatio >= 0.75 ? '調整中' : '不足気味';
    fuelSub = `${Math.round(snapshot.calories)} / ${Math.round(planTarget)} kcal ・ P ${Math.round(snapshot.protein)}g`;
  }

  const totalScore = clampNumber(weightScore + hydrationScore + recoveryScore + fuelScore, 0, 100);
  const readinessTitle = totalScore >= 80 ? '仕上がり良好' : totalScore >= 65 ? '調整継続' : '立て直し優先';
  const readinessSummary = totalScore >= 80
    ? '今日は質の高い練習を入れやすい状態です。体重ラインと回復をこのまま維持してください。'
    : totalScore >= 65
      ? '大きく崩れてはいません。弱い項目を1つだけ補正すると勝負コンディションに近づきます。'
      : 'コンディションを上げる余地があります。追い込みよりも、回復と補給の立て直しを優先してください。';

  const weakest = [
    { key: 'weight', score: weightScore },
    { key: 'hydration', score: hydrationScore },
    { key: 'recovery', score: recoveryScore },
    { key: 'fuel', score: fuelScore },
  ].sort((a, b) => a.score - b.score)[0]?.key;

  const focusMap = {
    weight: snapshot.weightGap !== null
      ? `重点: 朝体重が計画から${snapshot.weightGap > 0 ? '上振れ' : '下振れ'}です。夜の炭水化物・塩分・水分タイミングを見直してください。`
      : '重点: 試合用の朝体重を毎日記録すると、減量のズレを早く修正できます。',
    hydration: '重点: 水分と発汗差が勝負の動きに直結します。練習前後の補水量を固定して再現性を上げてください。',
    recovery: '重点: 睡眠・疲労が弱い日は追い込みより質優先です。体調が戻るまで負荷を微調整してください。',
    fuel: '重点: 練習の質を落とさない範囲で、kcalとタンパク質をプランに寄せてください。',
  };

  const trainingAction = totalScore >= 80
    ? '強度: メイン練習OK。質を優先'
    : totalScore >= 65
      ? '強度: 通常-1段階で調整'
      : '強度: 追い込み禁止。技術中心';
  const fuelingAction = fuelScore >= 18
    ? '補給: 現状維持でOK'
    : snapshot.protein < proteinTarget * 0.8
      ? '補給: タンパク質を先に追加'
      : snapshot.calories < planTarget * 0.85
        ? '補給: 練習前後に糖質を戻す'
        : '補給: 夜のPFCを微調整';
  const recoveryAction = recoveryScore >= 22
    ? '回復: 通常ルーティン継続'
    : sleep < 6
      ? '回復: 今夜は睡眠最優先'
      : fatigue >= 7
        ? '回復: スパー量を抑えて回復'
        : '回復: ストレッチと補水強化';

  scoreEl.textContent = String(totalScore);
  setText('readinessTitle', readinessTitle);
  setText('readinessSummary', readinessSummary);
  setText('readinessWeightStatus', weightStatus);
  setText('readinessWeightSub', weightSub);
  setText('readinessHydrationStatus', hydrationStatus);
  setText('readinessHydrationSub', hydrationSub);
  setText('readinessRecoveryStatus', recoveryStatus);
  setText('readinessRecoverySub', recoverySub);
  setText('readinessFuelStatus', fuelStatus);
  setText('readinessFuelSub', fuelSub);
  setText('readinessFocus', focusMap[weakest] || '重点: まずは体重・食事・水分・回復の記録を揃えて、日々の判断精度を上げてください。');
  setText('readinessAction1', trainingAction);
  setText('readinessAction2', fuelingAction);
  setText('readinessAction3', recoveryAction);
  badge.classList.remove('up', 'down', 'flat');
  badge.classList.add(totalScore >= 80 ? 'up' : totalScore >= 65 ? 'flat' : 'down');
  badge.textContent = readinessTitle;
}

/** 原因別減量アラート（閾値は運用で調整する仮置き） */
const WEIGHT_CUT_ALERT_THRESHOLDS = {
  hydrationGapMl: -400,
  sleepHoursLow: 6,
  sleepHoursWarn: 7,
  fatigueHigh: 7,
  fatigueVeryHigh: 9,
  kcalOverPlan: 250,
  kcalUnderPlan: -500,
  proteinUnderG: -25,
  heavyVsPlanKg: 0.35,
  trainingMinutesHeavy: 150,
};

function buildWeightCutCauseAlerts({ cutPerWeek, safeWeeklyCut, paceStatus, snapshot }) {
  const alerts = [];
  const t = WEIGHT_CUT_ALERT_THRESHOLDS;

  if (paceStatus === '危険') {
    alerts.push({
      severity: 'danger',
      label: '減量ペース',
      text: `週換算の必要減量（約${cutPerWeek.toFixed(2)}kg）が、体重1%ルールの安全目安（${safeWeeklyCut.toFixed(2)}kg/週）を超えています。`,
    });
  } else if (paceStatus === '注意') {
    alerts.push({
      severity: 'warn',
      label: '減量ペース',
      text: '減量ペースがやや速いです。脱水や極端な飢餓に寄せないよう注意してください。',
    });
  }

  const wg = snapshot.weightGap;
  if (snapshot.planRow) {
    if (wg !== null && wg > t.heavyVsPlanKg) {
      alerts.push({
        severity: 'danger',
        label: '計画対比・体重',
        text: '朝体重がプラン帯より明らかに重めです。塩分・糖質・水分の摂り方が効いている可能性があります。',
      });
    } else if (wg !== null && wg > 0) {
      alerts.push({
        severity: 'warn',
        label: '計画対比・体重',
        text: 'プラン帯よりわずかに重めです。前日の夕食と就寝前の水分を確認してください。',
      });
    }
  }

  if (!snapshot.water) {
    alerts.push({
      severity: 'warn',
      label: '水分ログ',
      text: '水分が未記録です。減量判断がブレやすいので、最低でも1回は目安量をメモしてください。',
    });
  } else if (snapshot.hydrationGap < t.hydrationGapMl) {
    alerts.push({
      severity: 'danger',
      label: '水分バランス',
      text: '損失に対して水分が不足気味です。スパー日は特に補給計画を軽く見ないでください。',
    });
  } else if (snapshot.hydrationGap < 0) {
    alerts.push({
      severity: 'warn',
      label: '水分バランス',
      text: '摂取と損失の差がマイナスです。翌朝の体重再現性が落ちることがあります。',
    });
  }

  const rec = snapshot.latestRecovery;
  if (!rec) {
    alerts.push({
      severity: 'warn',
      label: '回復ログ',
      text: '睡眠・疲労が未記録です。激しい減量と併せるとコンディションが読めません。',
    });
  } else {
    const sh = Number(rec.sleep_hours) || 0;
    const fat = Number(rec.fatigue_score) || 0;
    if (sh < t.sleepHoursLow || fat >= t.fatigueVeryHigh) {
      alerts.push({
        severity: 'danger',
        label: '睡眠・疲労',
        text: `睡眠${sh.toFixed(1)}h / 疲労${fat}/10 です。回復が足りない状態での急減量は怪我リスクが上がります。`,
      });
    } else if (sh < t.sleepHoursWarn || fat >= t.fatigueHigh) {
      alerts.push({
        severity: 'warn',
        label: '睡眠・疲労',
        text: '睡眠か疲労に余裕が薄いです。練習強度か減量のどちらかを一時的に緩めると安全です。',
      });
    }
  }

  const plan = snapshot.planRow;
  if (plan?.totalKcalTarget) {
    const gap = snapshot.calories - plan.totalKcalTarget;
    if (gap > t.kcalOverPlan) {
      alerts.push({
        severity: 'warn',
        label: 'カロリー',
        text: `プラン比 +約${Math.round(gap)}kcal です。隠れ脂質・外食・おやつを疑ってください。`,
      });
    } else if (gap < t.kcalUnderPlan) {
      alerts.push({
        severity: 'warn',
        label: 'カロリー',
        text: `プラン比 約${Math.round(gap)}kcal です。落ち込み過ぎは筋肉とパワーを落とします。`,
      });
    }
  }

  if (plan?.protein) {
    const pg = snapshot.protein - plan.protein;
    if (pg < t.proteinUnderG) {
      alerts.push({
        severity: 'warn',
        label: 'たんぱく質',
        text: `Pが目標より約${Math.abs(Math.round(pg))}g不足です。まず主菜の量から戻すのが安全です。`,
      });
    }
  }

  if (snapshot.trainingMinutes >= t.trainingMinutesHeavy) {
    alerts.push({
      severity: 'warn',
      label: '練習量',
      text: `本日${Math.round(snapshot.trainingMinutes)}分の練習です。糖質と水分を前後で補い、睡眠を削らないようにしてください。`,
    });
  }

  return alerts;
}

function hideWeightCutCauseAlerts() {
  const wrap = document.getElementById('weightCutAlerts');
  if (wrap) wrap.style.display = 'none';
}

function renderWeightCutCauseAlerts(nextFight, latest, target, days, cutPerWeek, safeWeeklyCut, paceStatus) {
  const wrap = document.getElementById('weightCutAlerts');
  const list = document.getElementById('weightCutAlertsList');
  const sumEl = document.getElementById('weightCutAlertsSummary');
  if (!wrap || !list) return;

  if (!nextFight || latest == null || target == null) {
    hideWeightCutCauseAlerts();
    return;
  }

  const snapshot = getDailyPerformanceSnapshot(TODAY());
  const alerts = buildWeightCutCauseAlerts({
    cutPerWeek,
    safeWeeklyCut,
    paceStatus,
    snapshot,
  });

  const danger = alerts.filter(a => a.severity === 'danger');
  const warn = alerts.filter(a => a.severity === 'warn');
  wrap.style.display = '';

  if (sumEl) {
    if (danger.length) {
      sumEl.textContent = `要警戒 ${danger.length}件 / 注意 ${warn.length}件（原因別・閾値は仮設定）`;
    } else if (warn.length) {
      sumEl.textContent = `注意 ${warn.length}件（原因別・閾値は仮設定）`;
    } else {
      sumEl.textContent = '主要アラートなし（仮閾値）。水分・睡眠ログを入れると検出が増えます。';
    }
  }

  if (!alerts.length) {
    list.innerHTML = '<div class="wca-item wca-ok"><span class="wca-cause-tag">総合</span><p class="wca-text">いまの入力範囲では、原因別の強い警告は出ていません。</p></div>';
    return;
  }

  list.innerHTML = alerts.map(a => `
    <div class="wca-item wca-${a.severity}">
      <span class="wca-cause-tag">${a.label}</span>
      <p class="wca-text">${a.text}</p>
    </div>
  `).join('');
}

function renderFightPlanComparison(nextFight = null) {
  const badge = document.getElementById('planCompareBadge');
  if (!badge) return;

  const snapshot = getDailyPerformanceSnapshot(TODAY());
  const planRow = snapshot.planRow;
  if (!planRow) {
    setText('planCompareDate', '--');
    setText('planComparePhase', 'プラン未読込');
    setText('planTargetWeightRange', '--');
    setText('planActualWeight', '実績体重 --');
    setText('planWeightDiff', '--');
    setText('planWeightDiffSub', '減量プラン未設定');
    setText('planKcalDiff', '--');
    setText('planKcalDiffSub', '食事プラン未設定');
    setText('planHydrationStatus', '水分: --');
    setText('planRecoveryStatus', '回復: --');
    setText('planTrainingStatus', '練習: --');
    setText('planCompareNote', 'CSVの減量プランを読み込むと、計画との差分を表示します。');
    badge.classList.remove('up', 'down', 'flat');
    badge.textContent = '比較待ち';
    return;
  }

  const planLabel = planRow.date === TODAY() ? '今日のプラン' : `次回プラン ${formatDate(planRow.date)}`;
  const weightGap = snapshot.weightGap;
  const kcalGap = planRow.totalKcalTarget ? Math.round(snapshot.calories - planRow.totalKcalTarget) : null;
  const proteinGap = planRow.protein ? Math.round(snapshot.protein - planRow.protein) : null;
  const fatGap = planRow.fat ? Math.round(snapshot.fat - planRow.fat) : null;
  const carbGap = planRow.carbs ? Math.round(snapshot.carbs - planRow.carbs) : null;
  const latestRecovery = snapshot.latestRecovery;
  const sleepHours = Number(latestRecovery?.sleep_hours) || 0;
  const recoveryText = latestRecovery
    ? `回復: 睡眠 ${sleepHours.toFixed(1)}h / 体調 ${latestRecovery.condition_score}/10 / 疲労 ${latestRecovery.fatigue_score}/10`
    : '回復: 未記録';
  const hydrationText = snapshot.water
    ? `水分: ${Math.round(snapshot.water)}ml / 発汗差 ${Math.round(snapshot.hydrationGap)}ml`
    : '水分: 未記録';
  const trainingText = snapshot.trainingMinutes
    ? `練習: ${Math.round(snapshot.trainingMinutes)}分`
    : nextFight ? `練習: 試合まで ${Math.max(getDaysUntil(nextFight.fight_date), 0)}日` : '練習: 未記録';

  const pfcDiffText = [
    proteinGap === null ? null : `P ${proteinGap > 0 ? '+' : ''}${proteinGap}g`,
    fatGap === null ? null : `F ${fatGap > 0 ? '+' : ''}${fatGap}g`,
    carbGap === null ? null : `C ${carbGap > 0 ? '+' : ''}${carbGap}g`,
  ].filter(Boolean).join(' / ');

  const hydrationImpact = !snapshot.water
    ? '水分記録なし'
    : snapshot.hydrationGap >= 0 ? '脱水影響は小さめ' : '脱水で体重が重く出やすい';
  const sleepImpact = !latestRecovery
    ? '睡眠記録なし'
    : sleepHours >= 7 ? '睡眠は概ね維持' : '睡眠不足でパフォーマンス低下リスク';
  const impactStatus = !snapshot.water && !latestRecovery
    ? '判定待ち'
    : snapshot.hydrationGap < 0 || sleepHours < 6
      ? '影響あり'
      : '軽微';

  setText('planCompareDate', formatDate(planRow.date));
  setText('planComparePhase', `${planLabel} / ${planRow.phase || 'フェーズ未設定'}`);
  setText('planTargetWeightRange', snapshot.weightRange.label);
  setText('planActualWeight', `実績体重 ${snapshot.actualWeight !== null ? `${snapshot.actualWeight.toFixed(1)} kg` : '--'}`);
  setText('planWeightDiff', weightGap === null ? '--' : weightGap === 0 ? '範囲内' : `${weightGap > 0 ? '+' : ''}${weightGap.toFixed(1)} kg`);
  setText('planWeightDiffSub', weightGap === null ? '朝の体重記録待ち' : weightGap === 0 ? '予定レンジ内です' : weightGap > 0 ? '目標より重めです' : '目標より軽めです');
  setText('planKcalDiff', kcalGap === null ? '--' : `${kcalGap > 0 ? '+' : ''}${kcalGap} kcal`);
  setText('planKcalDiffSub', planRow.totalKcalTarget ? `実績 ${Math.round(snapshot.calories)} / 予定 ${Math.round(planRow.totalKcalTarget)} kcal` : 'kcal目標なし');
  setText('planPfcDiff', pfcDiffText || '--');
  setText('planPfcDiffSub', pfcDiffText ? `実績 P${Math.round(snapshot.protein)} / F${Math.round(snapshot.fat)} / C${Math.round(snapshot.carbs)}` : 'PFC目標なし');
  setText('planImpactStatus', impactStatus);
  setText('planImpactSub', `${hydrationImpact} / ${sleepImpact}`);
  setText('planHydrationStatus', hydrationText);
  setText('planRecoveryStatus', recoveryText);
  setText('planTrainingStatus', trainingText);

  const compareState = weightGap === 0
    && (kcalGap === null || Math.abs(kcalGap) <= 150)
    && (proteinGap === null || Math.abs(proteinGap) <= 10)
    && impactStatus !== '影響あり'
    ? '順調'
    : ((weightGap !== null && Math.abs(weightGap) <= 0.3)
      || (kcalGap !== null && Math.abs(kcalGap) <= 300)
      || (proteinGap !== null && Math.abs(proteinGap) <= 20))
      ? '調整'
      : '要修正';

  const compareNote = compareState === '順調'
    ? '体重・摂取量・回復のズレが小さく、試合プランにきれいに乗れています。今日は練習の質を優先できます。'
    : compareState === '調整'
      ? '小さなズレがあります。PFCか睡眠のどちらか1つを先に整えると、翌朝体重の再現性が上がります。'
      : '計画との差が大きめです。体重だけでなく、PFC不足や睡眠不足の影響まで含めて修正してください。';

  setText('planCompareNote', compareNote);
  badge.classList.remove('up', 'down', 'flat');
  badge.classList.add(compareState === '順調' ? 'up' : compareState === '調整' ? 'flat' : 'down');
  badge.textContent = compareState;
}

// ============================================================
// DASHBOARD
// ============================================================
function renderDashboard() {
  const today = TODAY();

  // Today's weight
  const todayWeights = weightLogs.filter(w => w.date && w.date.slice(0,10) === today);
  const latestWeight = weightLogs.length ? weightLogs[weightLogs.length - 1] : null;

  if (latestWeight) {
    document.getElementById('kpi-current-weight').textContent = `${latestWeight.weight} kg`;
    const bmi = calculateBMI(latestWeight.weight, latestWeight.height_cm || getLatestKnownHeightCm());
    setHtml(
      'kpi-bmi-badge',
      bmi
        ? `<span class="kpi-bmi-line"><span class="kpi-bmi-num">BMI ${bmi.toFixed(1)}</span>${getBmiBadgeHtml(bmi)}</span>`
        : '--'
    );
    const target = latestWeight.target_weight;
    if (target) {
      const diff = (latestWeight.weight - target).toFixed(1);
      setText('dashSubDate', `${formatDateJP(today)} ・ 目標差 ${diff > 0 ? `-${diff}` : `+${Math.abs(diff)}`}kg`);
    } else {
      setText('dashSubDate', formatDateJP(today));
    }
  } else {
    setText('dashSubDate', formatDateJP(today));
  }

  // Today's meals
  const todayMeals = mealLogs.filter(m => m.date && m.date.slice(0,10) === today);
  const todayCal = todayMeals.reduce((s,m) => s + (parseFloat(m.calories)||0), 0);
  const todayProtein = todayMeals.reduce((s,m) => s + (parseFloat(m.protein)||0), 0);
  document.getElementById('kpi-today-calories').textContent = `${Math.round(todayCal)} kcal`;
  document.getElementById('kpi-today-protein').textContent = `${Math.round(todayProtein)} g`;

  // Today's training
  const todayTraining = trainingLogs.filter(t => t.date && t.date.slice(0,10) === today);
  const todayMinutes = todayTraining.reduce((s,t) => s + (parseFloat(t.duration)||0), 0);
  const todayBurned = todayTraining.reduce((s,t) => s + (parseFloat(t.calories_burned)||0), 0);
  document.getElementById('kpi-today-training').textContent = `${Math.round(todayMinutes)} 分`;
  document.getElementById('kpi-burned').textContent = `消費 ${Math.round(todayBurned)} kcal`;

  // Fight countdown
  const activeFights = fightGoals.filter(f => f.status === '準備中' && f.fight_date);
  if (activeFights.length) {
    const nextFight = activeFights.sort((a,b) => new Date(a.fight_date)-new Date(b.fight_date))[0];
    const days = getDaysUntil(nextFight.fight_date);
    document.getElementById('countdownText').textContent = `試合まで ${days} 日`;
    renderFightGoalMini(nextFight);
  }

  // Today's date
  document.getElementById('todayDate').textContent = formatDateJP(today);

  // Charts
  renderDashboardWeightChart();
  renderDashboardPFCChart(todayMeals);
  renderRecentActivity();
  renderPerformanceCoach();
  renderAutoSummaries();
}

function renderFightGoalMini(fight) {
  const el = document.getElementById('fightGoalCard');
  const days = getDaysUntil(fight.fight_date);
  el.innerHTML = `
    <div class="fight-goal-mini">
      <div class="fgm-countdown">${days}</div>
      <div class="fgm-unit">日後 - 試合</div>
      <div class="fgm-row"><i class="fas fa-user"></i> vs ${fight.opponent || '相手未定'}</div>
      <div class="fgm-row"><i class="fas fa-calendar"></i> ${formatDateJP(fight.fight_date)}</div>
      <div class="fgm-row"><i class="fas fa-weight"></i> 目標: ${fight.target_weight || '--'} kg</div>
      ${fight.venue ? `<div class="fgm-row"><i class="fas fa-map-marker-alt"></i> ${fight.venue}</div>` : ''}
    </div>
  `;
}

function renderDashboardWeightChart() {
  const ctx = document.getElementById('weightChart').getContext('2d');
  const last14 = weightLogs.slice(-14);
  const labels = last14.map(w => w.date ? w.date.slice(5) : '');
  const values = last14.map(w => w.weight);
  const targets = last14.map(w => w.target_weight || null);
  const latest = last14[last14.length - 1];
  const first = last14[0];
  const avgWeight = average(values);
  const delta = latest && first ? latest.weight - first.weight : null;
  const gap = latest?.target_weight ? latest.weight - latest.target_weight : null;
  const state = trendState(delta ?? 0);

  setText('dashWeightCurrent', latest ? `${latest.weight} kg` : '-- kg');
  setText('dashWeightAvg', avgWeight ? `${avgWeight.toFixed(1)} kg` : '-- kg');
  setText('dashWeightDelta', delta !== null ? formatSignedKg(delta) : '-- kg');
  setText('dashWeightGap', gap !== null ? formatSignedKg(gap) : '-- kg');
  setClassByState('dashWeightDelta', delta !== null ? (delta <= 0 ? 'pos' : 'neg') : '');
  setClassByState('dashWeightGap', gap !== null ? (gap <= 0 ? 'pos' : 'neg') : '');

  const trendBadge = document.getElementById('dashWeightTrend');
  if (trendBadge) {
    trendBadge.classList.remove('up', 'down', 'flat');
    trendBadge.classList.add(state);
    trendBadge.textContent = !latest ? '記録待ち' : state === 'down' ? '減量トレンド' : state === 'up' ? '増量トレンド' : '横ばい';
  }

  if (weightChartInst) weightChartInst.destroy();
  weightChartInst = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: '体重 (kg)',
          data: values,
          borderColor: '#e54a4a',
          backgroundColor: createLineGradient(ctx, '#e54a4a'),
          fill: true,
          tension: 0.4,
          glowBlur: 16,
          pointBackgroundColor: '#e54a4a',
          pointBorderColor: '#fff',
          pointBorderWidth: 1.5,
          pointHoverRadius: 6,
          pointRadius: values.map((_, index) => index === values.length - 1 ? 5 : 3),
          hitRadius: 16,
          borderWidth: 2.5,
        },
        {
          label: '目標体重 (kg)',
          data: targets,
          borderColor: '#f5c842',
          borderDash: [6,3],
          backgroundColor: 'transparent',
          tension: 0.2,
          glowBlur: 10,
          borderWidth: 2,
          pointRadius: 0,
        },
      ],
    },
    options: chartOptions('kg'),
  });
}

function renderDashboardPFCChart(meals) {
  const ctx = document.getElementById('pfcChart').getContext('2d');
  const p = meals.reduce((s,m) => s + (parseFloat(m.protein)||0), 0);
  const f = meals.reduce((s,m) => s + (parseFloat(m.fat)||0), 0);
  const c = meals.reduce((s,m) => s + (parseFloat(m.carbs)||0), 0);
  const totalKcal = Math.round((p * 4) + (f * 9) + (c * 4));
  const totalMacro = p + f + c;
  setText('pfcTotalKcal', String(totalKcal || 0));
  setHtml('pfcGoalRow', `
    <div class="chart-chip"><span class="chart-chip-dot" style="background:#e54a4a"></span>タンパク <strong>${Math.round(p)}g</strong> <span>${totalMacro ? Math.round((p / totalMacro) * 100) : 0}%</span></div>
    <div class="chart-chip"><span class="chart-chip-dot" style="background:#f5c842"></span>脂質 <strong>${Math.round(f)}g</strong> <span>${totalMacro ? Math.round((f / totalMacro) * 100) : 0}%</span></div>
    <div class="chart-chip"><span class="chart-chip-dot" style="background:#4a90e2"></span>炭水化物 <strong>${Math.round(c)}g</strong> <span>${totalMacro ? Math.round((c / totalMacro) * 100) : 0}%</span></div>
  `);

  if (pfcChartInst) pfcChartInst.destroy();
  pfcChartInst = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['タンパク質', '脂質', '炭水化物'],
      datasets: [{
        data: [Math.round(p), Math.round(f), Math.round(c)],
        backgroundColor: ['#e54a4a', '#f5c842', '#4a90e2'],
        borderColor: '#141824',
        borderWidth: 4,
        hoverOffset: 8,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom',
          labels: { color: '#8b90a0', font: { size: 11 }, padding: 12 }
        },
        tooltip: { callbacks: { label: (c) => ` ${c.label}: ${c.raw}g` } }
      },
      cutout: '65%',
    },
  });
}

function renderRecentActivity() {
  const container = document.getElementById('recentActivity');
  const activities = [];

  weightLogs.slice(-5).reverse().forEach(w => {
    activities.push({ type:'weight', date: w.date, html: `<strong>${w.weight}kg</strong> を記録` });
  });
  mealLogs.slice(-5).reverse().forEach(m => {
    activities.push({ type:'meal', date: m.date, html: `<strong>${m.food_name}</strong> ・ ${m.calories}kcal` });
  });
  trainingLogs.slice(-5).reverse().forEach(t => {
    activities.push({ type:'training', date: t.date, html: `<strong>${t.training_type}</strong> ${t.duration}分 / ${t.calories_burned||0}kcal消費` });
  });

  activities.sort((a,b) => new Date(b.date) - new Date(a.date));
  const recent = activities.slice(0, 8);

  if (!recent.length) { container.innerHTML = '<div class="empty-state">まだ記録がありません</div>'; return; }

  const icons = { weight: 'fa-weight', meal: 'fa-utensils', training: 'fa-dumbbell' };
  container.innerHTML = recent.map(a => `
    <div class="activity-item">
      <div class="activity-icon ${a.type}"><i class="fas ${icons[a.type]}"></i></div>
      <div class="activity-text">${a.html}</div>
      <div class="activity-time">${formatDate(a.date)}</div>
    </div>
  `).join('');
}

function pearsonCorrelation(xs, ys) {
  const pairs = [];
  for (let i = 0; i < xs.length; i++) {
    const x = xs[i];
    const y = ys[i];
    if (x == null || y == null || Number.isNaN(Number(x)) || Number.isNaN(Number(y))) continue;
    pairs.push([Number(x), Number(y)]);
  }
  if (pairs.length < 4) return null;
  const n = pairs.length;
  const meanX = pairs.reduce((s, p) => s + p[0], 0) / n;
  const meanY = pairs.reduce((s, p) => s + p[1], 0) / n;
  let num = 0;
  let denX = 0;
  let denY = 0;
  for (const [x, y] of pairs) {
    const dx = x - meanX;
    const dy = y - meanY;
    num += dx * dy;
    denX += dx * dx;
    denY += dy * dy;
  }
  const den = Math.sqrt(denX * denY);
  if (den === 0) return null;
  return num / den;
}

function buildTrainingWeightRecoverySeries(dayCount) {
  const end = new Date();
  end.setHours(0, 0, 0, 0);
  const labels = [];
  const training = [];
  const sleep = [];
  const weightLine = [];
  const weightLogged = [];
  let lastWeight = null;

  for (let i = dayCount - 1; i >= 0; i--) {
    const d = new Date(end);
    d.setDate(d.getDate() - i);
    const ds = d.toISOString().slice(0, 10);
    labels.push(`${d.getMonth() + 1}/${d.getDate()}`);

    const trainMins = trainingLogs
      .filter(t => t.date && t.date.slice(0, 10) === ds)
      .reduce((s, t) => s + (parseFloat(t.duration) || 0), 0);
    training.push(Math.round(trainMins));

    const wRow = getLatestEntryForDate(weightLogs, ds);
    if (wRow && wRow.weight != null && wRow.weight !== '') {
      lastWeight = Number(wRow.weight);
      weightLogged.push(lastWeight);
    } else {
      weightLogged.push(null);
    }
    weightLine.push(lastWeight != null && !Number.isNaN(lastWeight) ? lastWeight : null);

    const rec = getLatestEntryForDate(recoveryLogs, ds);
    const shRaw = rec && rec.sleep_hours != null && rec.sleep_hours !== '' ? Number(rec.sleep_hours) : null;
    sleep.push(shRaw != null && !Number.isNaN(shRaw) ? shRaw : null);
  }

  return { labels, training, sleep, weightLine, weightLogged };
}

function chartOptions(unit = '') {
  return {
    responsive: true,
    maintainAspectRatio: false,
    animation: {
      duration: 900,
      easing: 'easeOutQuart',
    },
    interaction: {
      intersect: false,
      mode: 'index',
    },
    plugins: {
      legend: {
        labels: {
          color: '#a9b1c7',
          font: { size: 11, weight: '700' },
          padding: 16,
          usePointStyle: true,
          pointStyle: 'rectRounded',
          boxWidth: 14,
          boxHeight: 8,
        }
      },
      tooltip: {
        backgroundColor: 'rgba(17,22,34,0.96)',
        titleColor: '#eef0f8',
        bodyColor: '#c8cfde',
        borderColor: 'rgba(255,255,255,0.10)',
        borderWidth: 1,
        displayColors: true,
        padding: 12,
        cornerRadius: 12,
        callbacks: {
          label: (c) => ` ${c.dataset.label}: ${c.raw}${unit}`
        }
      }
    },
    scales: {
      x: {
        border: { display: false },
        grid: { color: 'rgba(255,255,255,0.03)', drawTicks: false },
        ticks: { color: '#7d869d', font: { size: 11, weight: '600' }, padding: 8 }
      },
      y: {
        border: { display: false },
        grid: { color: 'rgba(255,255,255,0.05)', drawTicks: false },
        ticks: { color: '#7d869d', font: { size: 11, weight: '600' }, padding: 8 }
      },
    },
  };
}

// ============================================================
// WEIGHT PAGE
// ============================================================
async function saveWeight() {
  const date   = document.getElementById('w-date').value;
  const heightRaw = document.getElementById('w-height').value.trim();
  const weightRaw = document.getElementById('w-weight').value;
  const fatRaw    = document.getElementById('w-fat').value.trim();
  const muscleRaw = document.getElementById('w-muscle').value.trim();
  const targetRaw = document.getElementById('w-target').value.trim();
  const note   = document.getElementById('w-note').value.trim();

  if (!isIsoDateString(date)) { showToast('日付を正しく選択してください', 'error'); return; }

  const wChk = parseRequiredBounded(weightRaw, INPUT_BOUNDS.weightKg, '体重');
  if (!wChk.ok) { showToast(wChk.msg, 'error'); return; }
  const weight = wChk.value;

  let height = getLatestKnownHeightCm();
  if (heightRaw) {
    const hChk = parseRequiredBounded(heightRaw, INPUT_BOUNDS.heightCm, '身長');
    if (!hChk.ok) { showToast(hChk.msg, 'error'); return; }
    height = hChk.value;
  }

  let fat = null;
  if (fatRaw) {
    const fChk = parseRequiredBounded(fatRaw, INPUT_BOUNDS.bodyFatPct, '体脂肪率');
    if (!fChk.ok) { showToast(fChk.msg, 'error'); return; }
    fat = fChk.value;
  }

  let muscle = null;
  if (muscleRaw) {
    const mChk = parseRequiredBounded(muscleRaw, INPUT_BOUNDS.muscleKg, '筋肉量');
    if (!mChk.ok) { showToast(mChk.msg, 'error'); return; }
    muscle = mChk.value;
  }

  let target = null;
  if (targetRaw) {
    const tChk = parseRequiredBounded(targetRaw, INPUT_BOUNDS.targetWeightKg, '目標体重');
    if (!tChk.ok) { showToast(tChk.msg, 'error'); return; }
    target = tChk.value;
  }

  const payload = { date, height_cm: height, weight, body_fat: fat, muscle_mass: muscle, target_weight: target, note };

  try {
    if (editingWeightId) {
      const updated = await apiPut('weight_logs', editingWeightId, payload);
      const ix = weightLogs.findIndex(w => w.id === editingWeightId);
      if (ix !== -1) weightLogs[ix] = { ...weightLogs[ix], ...updated };
      weightLogs.sort((a,b) => new Date(a.date) - new Date(b.date));
      showToast(`✅ 記録を更新しました (${weight}kg)`, 'success');
      cancelEditWeight();
    } else {
      const record = await apiPost('weight_logs', payload);
      weightLogs.push(record);
      weightLogs.sort((a,b) => new Date(a.date) - new Date(b.date));
      showToast(`✅ ${weight}kg を記録しました`, 'success');
      clearForm(['w-weight','w-fat','w-muscle','w-note']);
    }
    renderWeightPage();
    renderDashboard();
  } catch(e) {
    showToast('保存に失敗しました', 'error');
  }
}

async function quickSaveWeight() {
  const heightRaw = document.getElementById('quickHeight').value.trim();
  const weightRaw = document.getElementById('quickWeight').value;
  const fatRaw    = document.getElementById('quickBodyFat').value.trim();
  const note   = document.getElementById('quickNote').value.trim();

  const wChk = parseRequiredBounded(weightRaw, INPUT_BOUNDS.weightKg, '体重');
  if (!wChk.ok) { showToast(wChk.msg, 'error'); return; }
  const weight = wChk.value;

  let height = getLatestKnownHeightCm();
  if (heightRaw) {
    const hChk = parseRequiredBounded(heightRaw, INPUT_BOUNDS.heightCm, '身長');
    if (!hChk.ok) { showToast(hChk.msg, 'error'); return; }
    height = hChk.value;
  }

  let fat = null;
  if (fatRaw) {
    const fChk = parseRequiredBounded(fatRaw, INPUT_BOUNDS.bodyFatPct, '体脂肪率');
    if (!fChk.ok) { showToast(fChk.msg, 'error'); return; }
    fat = fChk.value;
  }

  let target_weight = null;
  if (appSettings.targetWeight) {
    const twChk = parseRequiredBounded(String(appSettings.targetWeight), INPUT_BOUNDS.targetWeightKg, '設定の目標体重');
    if (twChk.ok) target_weight = twChk.value;
  }

  try {
    const record = await apiPost('weight_logs', {
      date: TODAY(),
      height_cm: height,
      weight,
      body_fat: fat,
      target_weight,
      note
    });
    weightLogs.push(record);
    weightLogs.sort((a,b) => new Date(a.date) - new Date(b.date));
    showToast(`✅ ${weight}kg を記録しました`, 'success');
    clearForm(['quickWeight','quickBodyFat','quickNote']);
    renderDashboard();
  } catch(e) {
    showToast('保存に失敗しました', 'error');
  }
}

function updateWeightEditUI() {
  const banner = document.getElementById('weightEditBanner');
  const btn = document.getElementById('weightSaveBtn');
  const on = Boolean(editingWeightId);
  if (banner) banner.style.display = on ? 'flex' : 'none';
  if (btn) {
    btn.innerHTML = on
      ? '<i class="fas fa-save"></i> 変更を保存'
      : '<i class="fas fa-save"></i> 体重を保存';
  }
}

function cancelEditWeight() {
  editingWeightId = null;
  const today = TODAY();
  const g = (id) => document.getElementById(id);
  if (g('w-date')) g('w-date').value = today;
  if (g('w-height')) {
    const h = getLatestKnownHeightCm();
    g('w-height').value = h != null ? String(h) : '';
  }
  clearForm(['w-weight','w-fat','w-muscle','w-note']);
  if (g('w-target')) g('w-target').value = '';
  updateWeightEditUI();
  if (typeof updateWeightBmiPreview === 'function') updateWeightBmiPreview();
}

function startEditWeight(id) {
  const w = weightLogs.find(x => x.id === id);
  if (!w) return;
  editingWeightId = id;
  const d = w.date ? w.date.slice(0, 10) : TODAY();
  const g = (x) => document.getElementById(x);
  g('w-date').value = d;
  g('w-height').value = w.height_cm != null && w.height_cm !== '' ? w.height_cm : '';
  g('w-weight').value = w.weight != null ? w.weight : '';
  g('w-fat').value = w.body_fat != null && w.body_fat !== '' ? w.body_fat : '';
  g('w-muscle').value = w.muscle_mass != null && w.muscle_mass !== '' ? w.muscle_mass : '';
  g('w-target').value = w.target_weight != null && w.target_weight !== '' ? w.target_weight : '';
  g('w-note').value = w.note || '';
  updateWeightEditUI();
  if (typeof updateWeightBmiPreview === 'function') updateWeightBmiPreview();
  switchPage('weight');
  window.setTimeout(() => {
    document.getElementById('page-weight')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, 50);
}

async function deleteWeightLog(id) {
  showModal('体重記録を削除', 'この記録を削除しますか？', async () => {
    try {
      await apiDelete('weight_logs', id);
      weightLogs = weightLogs.filter(w => w.id !== id);
      if (editingWeightId === id) cancelEditWeight();
      showToast('削除しました', 'info');
      renderWeightPage();
      renderDashboard();
    } catch(e) { showToast('削除に失敗しました', 'error'); }
  });
}

async function clearWeightLogs() {
  showModal('全データを削除', '体重記録をすべて削除しますか？この操作は元に戻せません。', async () => {
    try {
      await Promise.all(weightLogs.map(w => apiDelete('weight_logs', w.id)));
      weightLogs = [];
      editingWeightId = null;
      updateWeightEditUI();
      showToast('全記録を削除しました', 'info');
      renderWeightPage();
      renderDashboard();
    } catch(e) { showToast('削除に失敗しました', 'error'); }
  });
}

function renderWeightPage() {
  // Stats
  const latest = weightLogs.length ? weightLogs[weightLogs.length-1] : null;
  const latestHeight = latest?.height_cm || getLatestKnownHeightCm();
  const bmi = latest ? calculateBMI(latest.weight, latestHeight) : null;
  document.getElementById('latest-weight').textContent = latest ? `${latest.weight} kg` : '-- kg';
  document.getElementById('latest-fat').textContent    = latest?.body_fat ? `${latest.body_fat} %` : '-- %';
  document.getElementById('ringFatVal').textContent = latest?.body_fat ? `${latest.body_fat} %` : '--%';
  document.getElementById('ringMuscleVal').textContent = latest?.muscle_mass ? `${latest.muscle_mass} kg` : '-- kg';
  document.getElementById('bmi-display').textContent = bmi ? bmi.toFixed(1) : '--';
  document.getElementById('bmi-badge-display').innerHTML = getBmiBadgeHtml(bmi);

  const fatPct = latest?.body_fat ? Math.min(100, latest.body_fat) : 0;
  const musclePct = latest?.muscle_mass && latest?.weight ? Math.min(100, Math.round((latest.muscle_mass / latest.weight) * 100)) : 0;
  document.getElementById('ringFatFill').style.strokeDashoffset = `${226 - (226 * fatPct / 100)}`;
  document.getElementById('ringMuscleFill').style.strokeDashoffset = `${226 - (226 * musclePct / 100)}`;

  const lastTarget = [...weightLogs].reverse().find(w => w.target_weight);
  const targetW = lastTarget?.target_weight;
  document.getElementById('target-weight-display').textContent = targetW ? `${targetW} kg` : '-- kg';

  if (latest && targetW) {
    const remain = (latest.weight - targetW).toFixed(1);
    document.getElementById('weight-remain').textContent = `${remain > 0 ? '-' : '+'}${Math.abs(remain)} kg`;

    // Progress: assume starting from heaviest logged weight
    const maxW = Math.max(...weightLogs.map(w => w.weight));
    const pct = maxW > targetW ? Math.min(100, Math.round(((maxW - latest.weight) / (maxW - targetW)) * 100)) : 100;
    document.getElementById('weight-progress-pct').textContent = `${pct}%`;
    document.getElementById('weightProgressFill').style.width = `${pct}%`;
  }

  // Table
  const tbody = document.getElementById('weightTableBody');
  if (!weightLogs.length) {
    tbody.innerHTML = '<tr><td colspan="8" class="empty-cell">データなし</td></tr>';
  } else {
    tbody.innerHTML = [...weightLogs].reverse().map(w => `
      <tr>
        <td>${formatDate(w.date)}</td>
        <td><strong>${w.weight} kg</strong></td>
        <td>${calculateBMI(w.weight, w.height_cm || latestHeight)?.toFixed(1) || '--'}</td>
        <td>${w.body_fat ? w.body_fat + ' %' : '--'}</td>
        <td>${w.muscle_mass ? w.muscle_mass + ' kg' : '--'}</td>
        <td>${w.target_weight ? w.target_weight + ' kg' : '--'}</td>
        <td>${w.note || '--'}</td>
        <td style="white-space:nowrap">
          <button type="button" class="btn btn-sm btn-secondary" onclick="startEditWeight('${w.id}')" title="編集"><i class="fas fa-pen"></i></button>
          <button type="button" class="btn btn-sm btn-danger" onclick="deleteWeightLog('${w.id}')" title="削除"><i class="fas fa-trash"></i></button>
        </td>
      </tr>
    `).join('');
  }

  updateWeightEditUI();

  // Chart
  renderWeightDetailChart(7);
}

let currentWeightRange = 7;
function setWeightRange(days, btn) {
  currentWeightRange = days;
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderWeightDetailChart(days);
}

function renderWeightDetailChart(days) {
  const ctx = document.getElementById('weightDetailChart').getContext('2d');
  const data = days > 0 ? weightLogs.slice(-days) : weightLogs;
  const weights = data.map(w => w.weight);
  const bodyFatValues = data.map(w => Number(w.body_fat)).filter(Number.isFinite);
  const latest = data[data.length - 1];
  const first = data[0];
  const avgWeight = average(weights);
  const delta = latest && first ? latest.weight - first.weight : null;
  const gap = latest?.target_weight ? latest.weight - latest.target_weight : null;
  const hasBodyFat = bodyFatValues.length > 0;
  const fatMin = hasBodyFat ? Math.max(0, Math.floor(Math.min(...bodyFatValues) - 1)) : 0;
  const fatMax = hasBodyFat ? Math.ceil(Math.max(...bodyFatValues) + 1) : 10;
  const weightPointRadius = data.map((_, index) => {
    if (index === data.length - 1) return 6;
    return data.length <= 7 ? 4 : 0;
  });

  setText('weightDetailLatest', latest ? `${latest.weight} kg` : '-- kg');
  setText('weightDetailAvg', avgWeight ? `${avgWeight.toFixed(1)} kg` : '-- kg');
  setText('weightDetailDelta', delta !== null ? formatSignedKg(delta) : '-- kg');
  setText('weightDetailGap', gap !== null ? formatSignedKg(gap) : '-- kg');
  setClassByState('weightDetailDelta', delta !== null ? (delta <= 0 ? 'pos' : 'neg') : '');
  setClassByState('weightDetailGap', gap !== null ? (gap <= 0 ? 'pos' : 'neg') : '');

  if (weightDetailChartInst) weightDetailChartInst.destroy();
  weightDetailChartInst = new Chart(ctx, {
    type: 'line',
    data: {
      labels: data.map(w => w.date ? w.date.slice(5) : ''),
      datasets: [
        {
          label: '体重 (kg)',
          data: data.map(w => w.weight),
          borderColor: '#e54a4a',
          backgroundColor: createLineGradient(ctx, '#e54a4a'),
          fill: true, tension: 0.4,
          borderWidth: 2.5,
          glowBlur: 18,
          pointBackgroundColor: '#e54a4a',
          pointBorderColor: '#fff',
          pointBorderWidth: 1.5,
          pointHoverRadius: 7,
          pointHoverBorderWidth: 2,
          pointRadius: weightPointRadius,
          hitRadius: 18,
        },
        {
          label: '目標体重 (kg)',
          data: data.map(w => w.target_weight || null),
          borderColor: '#f5c842',
          borderDash: [6,3],
          backgroundColor: 'transparent',
          borderWidth: 2,
          glowBlur: 10,
          tension: 0, pointRadius: 0,
        },
        {
          label: '体脂肪玁E(%)',
          data: data.map(w => w.body_fat || null),
          borderColor: '#a78bfa',
          backgroundColor: 'transparent',
          borderWidth: 2,
          glowBlur: 12,
          tension: 0.35, pointRadius: hasBodyFat ? 3 : 0,
          yAxisID: 'y1',
          hidden: !hasBodyFat,
        },
      ],
    },
    options: {
      ...chartOptions('kg'),
      scales: {
        x: {
          border: { display: false },
          grid: { color: 'rgba(255,255,255,0.04)', drawTicks: false },
          ticks: { color: '#7d869d', font:{size:11, weight:'600'} }
        },
        y: {
          border: { display: false },
          grid: { color: 'rgba(255,255,255,0.05)', drawTicks: false },
          ticks: { color: '#7d869d', font:{size:11, weight:'600'} },
          position: 'left',
        },
        y1: {
          display: hasBodyFat,
          min: fatMin,
          max: fatMax,
          border: { display: false },
          grid: { display: false },
          ticks: {
            color: '#b69cff',
            font:{size:11, weight:'700'},
            callback: (value) => `${value}%`
          },
          position: 'right'
        },
      },
    },
  });
}

// ============================================================
// MEALS PAGE  ERedesigned with multi-item + auto-calc
// ============================================================

// In-memory food items for current meal entry
let currentFoodItems = [];  // [{ id, name, amount, cal, p, f, c, dbRef }]
let rtPfcChartInst = null;
let meal7dayChartInst = null;
let foodItemCounter = 0;

// ---- Food Search (live) ----
function searchFoodLive(query) {
  const dropdown = document.getElementById('foodSearchResults');
  const q = query.toLowerCase().trim();
  if (!q) { dropdown.classList.remove('open'); dropdown.innerHTML = ''; return; }

  const found = FOOD_DB.filter(f => f.name.toLowerCase().includes(q)).slice(0, 12);
  if (!found.length) {
    dropdown.innerHTML = `<div class="food-dd-item" style="cursor:default;justify-content:center;color:var(--text-muted)">見つかりませんでした</div>`;
    dropdown.classList.add('open');
    return;
  }

  dropdown.innerHTML = found.map(f => {
    const calPer = Math.round(f.per100.cal * (f.defaultAmt||100) / 100);
    return `<div class="food-dd-item" onclick="selectFoodFromDB('${f.name.replace(/'/g,"\\'")}')">
      <span class="food-dd-name">${f.name}<span class="food-dd-cat">${f.cat||''}</span></span>
      <span class="food-dd-meta">
        <span class="cal">${calPer}kcal</span>
        <span>/${f.defaultAmt||100}${f.unit||'g'}</span>
      </span>
    </div>`;
  }).join('');
  dropdown.classList.add('open');
}

function selectFoodFromDB(name) {
  const food = FOOD_DB.find(f => f.name === name);
  if (!food) return;
  addFoodItemRowWithData(food.name, food.defaultAmt || 100, food.per100);
  document.getElementById('foodSearch').value = '';
  document.getElementById('foodSearchResults').classList.remove('open');
  document.getElementById('foodSearchResults').innerHTML = '';
}

// Close dropdown when clicking outside
document.addEventListener('click', (e) => {
  if (!e.target.closest('.food-search-wrap') && !e.target.closest('.food-results-dropdown')) {
    const dd = document.getElementById('foodSearchResults');
    if (dd) { dd.classList.remove('open'); dd.innerHTML = ''; }
  }
});

// ---- Add row (manual) ----
function addFoodItemRow() {
  addFoodItemRowWithData('', 100, { cal:0, p:0, f:0, c:0 }, true);
}

function addFoodItemRowWithData(name, amount, per100, focusName = false) {
  const id = ++foodItemCounter;
  const cal = Math.round(per100.cal * amount / 100);
  const p   = parseFloat((per100.p * amount / 100).toFixed(1));
  const f   = parseFloat((per100.f * amount / 100).toFixed(1));
  const c   = parseFloat((per100.c * amount / 100).toFixed(1));

  currentFoodItems.push({ id, name, amount, cal, p, f, c, per100 });

  const empty = document.getElementById('foodItemsEmpty');
  if (empty) empty.style.display = 'none';

  const row = document.createElement('div');
  row.className = 'food-item-row';
  row.id = `fi-row-${id}`;
  row.innerHTML = `
    <div class="fi-name">
      <div class="fi-label">食品名</div>
      <input type="text" class="input-field" value="${name}"
        oninput="updateFoodItemName(${id}, this.value)"
        placeholder="食品名を入力...">
    </div>
    <div>
      <div class="fi-label">量(g/ml)</div>
      <input type="number" class="input-field" value="${amount}" min="0" step="1"
        oninput="updateFoodItemAmount(${id}, this.value)">
    </div>
    <div class="fi-cal-col">
      <div class="fi-label">kcal</div>
      <div class="fi-cal-display" id="fi-cal-${id}">${cal}</div>
    </div>
    <div>
      <div class="fi-label">P(g)</div>
      <input type="number" class="input-field" value="${p}" step="0.1"
        oninput="updateFoodItemManual(${id},'p',this.value)" id="fi-p-${id}">
    </div>
    <div>
      <div class="fi-label">F(g)</div>
      <input type="number" class="input-field" value="${f}" step="0.1"
        oninput="updateFoodItemManual(${id},'f',this.value)" id="fi-f-${id}">
    </div>
    <div>
      <div class="fi-label">C(g)</div>
      <input type="number" class="input-field" value="${c}" step="0.1"
        oninput="updateFoodItemManual(${id},'c',this.value)" id="fi-c-${id}">
    </div>
    <button class="fi-delete" onclick="removeFoodItem(${id})" title="削除">
      <i class="fas fa-times"></i>
    </button>
  `;

  document.getElementById('foodItemsList').appendChild(row);
  updateRealtimeTotal();
  if (focusName) row.querySelector('input[type=text]').focus();
  showToast(`${name || '食品'} を追加しました`, 'info');
}

function updateFoodItemName(id, value) {
  const item = currentFoodItems.find(i => i.id === id);
  if (item) item.name = value;
  // Try to auto-fill from DB
  const matched = FOOD_DB.find(f => f.name === value || f.name.toLowerCase() === value.toLowerCase());
  if (matched) {
    item.per100 = matched.per100;
    recalcFoodItem(id);
    showToast(`✨ "${matched.name}" のデータを自動入力`, 'info');
  }
}

function updateFoodItemAmount(id, value) {
  const item = currentFoodItems.find(i => i.id === id);
  if (!item) return;
  item.amount = parseFloat(value) || 0;
  recalcFoodItem(id);
}

function recalcFoodItem(id) {
  const item = currentFoodItems.find(i => i.id === id);
  if (!item || !item.per100) return;
  const ratio = item.amount / 100;
  item.cal = Math.round(item.per100.cal * ratio);
  item.p   = parseFloat((item.per100.p * ratio).toFixed(1));
  item.f   = parseFloat((item.per100.f * ratio).toFixed(1));
  item.c   = parseFloat((item.per100.c * ratio).toFixed(1));

  const calEl = document.getElementById(`fi-cal-${id}`);
  const pEl   = document.getElementById(`fi-p-${id}`);
  const fEl   = document.getElementById(`fi-f-${id}`);
  const cEl   = document.getElementById(`fi-c-${id}`);
  if (calEl) calEl.textContent = item.cal;
  if (pEl)   pEl.value = item.p;
  if (fEl)   fEl.value = item.f;
  if (cEl)   cEl.value = item.c;
  updateRealtimeTotal();
}

function updateFoodItemManual(id, field, value) {
  const item = currentFoodItems.find(i => i.id === id);
  if (!item) return;
  item[field] = parseFloat(value) || 0;
  // Recalc kcal from PFC
  item.cal = Math.round(item.p * 4 + item.f * 9 + item.c * 4);
  const calEl = document.getElementById(`fi-cal-${id}`);
  if (calEl) calEl.textContent = item.cal;
  updateRealtimeTotal();
}

function removeFoodItem(id) {
  currentFoodItems = currentFoodItems.filter(i => i.id !== id);
  const row = document.getElementById(`fi-row-${id}`);
  if (row) row.remove();
  if (!currentFoodItems.length) {
    const empty = document.getElementById('foodItemsEmpty');
    if (empty) empty.style.display = '';
  }
  updateRealtimeTotal();
}

// ---- Realtime Total ----
function updateRealtimeTotal() {
  const totals = currentFoodItems.reduce((s,i) => ({
    cal: s.cal + (i.cal||0),
    p:   s.p   + (i.p||0),
    f:   s.f   + (i.f||0),
    c:   s.c   + (i.c||0),
  }), { cal:0, p:0, f:0, c:0 });

  document.getElementById('rt-cal').textContent = Math.round(totals.cal);
  document.getElementById('rt-p').textContent   = Math.round(totals.p);
  document.getElementById('rt-f').textContent   = Math.round(totals.f);
  document.getElementById('rt-c').textContent   = Math.round(totals.c);

  // Mini PFC chart
  const canvas = document.getElementById('rtPfcMini');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (rtPfcChartInst) rtPfcChartInst.destroy();
  rtPfcChartInst = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['P','F','C'],
      datasets: [{ data: [Math.round(totals.p), Math.round(totals.f), Math.round(totals.c)],
        backgroundColor: ['#e54a4a','#f5c842','#4a90e2'], borderWidth: 0 }]
    },
    options: {
      responsive: false, maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { enabled: false } },
      cutout: '55%'
    }
  });
}

// ---- Preset Loader ----
function loadMealPreset() {
  const name = document.getElementById('mealPreset').value;
  if (!name || !MEAL_PRESETS[name]) return;

  // Clear current items
  currentFoodItems = [];
  document.getElementById('foodItemsList').innerHTML = '';
  const empty = document.getElementById('foodItemsEmpty');
  if (empty) empty.style.display = 'none';

  MEAL_PRESETS[name].forEach(item => {
    const food = FOOD_DB.find(f => f.name === item.name);
    if (food) {
      addFoodItemRowWithData(food.name, item.amt, food.per100);
    }
  });

  document.getElementById('mealPreset').value = '';
  showToast(`✅ ${name} を読み込みました`, 'info');
}

// ---- Save Batch Meal ----
async function saveMealBatch() {
  const date = document.getElementById('m-date').value;
  const type = document.getElementById('m-type').value;
  const note = document.getElementById('m-note').value.trim();

  if (!isIsoDateString(date)) { showToast('日付を正しく選択してください', 'error'); return; }
  if (!type) { showToast('食事タイプを選択してください', 'error'); return; }
  if (!currentFoodItems.length) { showToast('食品を1つ以上追加してください', 'error'); return; }

  // Validate items
  const validItems = currentFoodItems.filter(i => i.name && i.name.trim());
  if (!validItems.length) { showToast('食品名を入力してください', 'error'); return; }

  for (const item of validItems) {
    const label = item.name.trim();
    const amt = Number(item.amount);
    if (!Number.isFinite(amt) || amt < INPUT_BOUNDS.mealAmountGrams[0] || amt > INPUT_BOUNDS.mealAmountGrams[1]) {
      showToast(`「${label}」の量は${INPUT_BOUNDS.mealAmountGrams[0]}〜${INPUT_BOUNDS.mealAmountGrams[1]}の数値にしてください`, 'error');
      return;
    }
    const cal = Number(item.cal);
    if (!Number.isFinite(cal) || cal < INPUT_BOUNDS.mealCaloriesPerItem[0] || cal > INPUT_BOUNDS.mealCaloriesPerItem[1]) {
      showToast(`「${label}」のkcalが範囲外です（${INPUT_BOUNDS.mealCaloriesPerItem[0]}〜${INPUT_BOUNDS.mealCaloriesPerItem[1]}）`, 'error');
      return;
    }
    for (const [field, fname] of [['p', 'P'], ['f', 'F'], ['c', 'C']]) {
      const v = Number(item[field]);
      if (!Number.isFinite(v) || v < INPUT_BOUNDS.macroGPerItem[0] || v > INPUT_BOUNDS.macroGPerItem[1]) {
        showToast(`「${label}」の${fname}(g)が範囲外です（${INPUT_BOUNDS.macroGPerItem[0]}〜${INPUT_BOUNDS.macroGPerItem[1]}）`, 'error');
        return;
      }
    }
  }

  try {
    const promises = validItems.map((item, idx) => apiPost('meals', {
      date, meal_type: type,
      food_name: item.name,
      amount: item.amount,
      calories: item.cal,
      protein: item.p,
      fat: item.f,
      carbs: item.c,
      note: idx === 0 ? note : '',
    }));
    const records = await Promise.all(promises);
    records.forEach(r => mealLogs.push(r));
    mealLogs.sort((a,b) => new Date(a.date) - new Date(b.date));

    const totalCal = validItems.reduce((s,i) => s+i.cal, 0);
    showToast(`✅ ${validItems.length}品・合計${Math.round(totalCal)}kcal を記録しました`, 'success');

    // Reset
    currentFoodItems = [];
    document.getElementById('foodItemsList').innerHTML = '';
    document.getElementById('m-note').value = '';
    const empty = document.getElementById('foodItemsEmpty');
    if (empty) empty.style.display = '';
    updateRealtimeTotal();

    loadMealSummary();
    render7dayMealChart();
    filterMeals();
    renderDashboard();
  } catch(e) {
    showToast('保存に失敗しました', 'error');
    console.error(e);
  }
}

// ---- saveMeal (legacy compat  Enot used in new UI) ----
async function saveMeal() { await saveMealBatch(); }

async function deleteMeal(id) {
  showModal('食事記録を削除', 'この記録を削除しますか？', async () => {
    try {
      await apiDelete('meals', id);
      mealLogs = mealLogs.filter(m => m.id !== id);
      showToast('削除しました', 'info');
      renderMealsPage();
      renderDashboard();
    } catch(e) { showToast('削除に失敗しました', 'error'); }
  });
}

function loadMealSummary() {
  const date = document.getElementById('mealViewDate')?.value || TODAY();
  const dayMeals = mealLogs.filter(m => m.date && m.date.slice(0,10) === date);

  const totals = dayMeals.reduce((s,m) => ({
    cal: s.cal + (parseFloat(m.calories)||0),
    p:   s.p   + (parseFloat(m.protein)||0),
    f:   s.f   + (parseFloat(m.fat)||0),
    c:   s.c   + (parseFloat(m.carbs)||0),
  }), { cal:0, p:0, f:0, c:0 });

  const summCal = document.getElementById('summ-cal');
  if (summCal) {
    summCal.textContent = Math.round(totals.cal);
    document.getElementById('summ-p').textContent   = Math.round(totals.p);
    document.getElementById('summ-f').textContent   = Math.round(totals.f);
    document.getElementById('summ-c').textContent   = Math.round(totals.c);
  }

  // PFC chart
  const pfcCanvas = document.getElementById('mealPfcChart');
  if (pfcCanvas) {
    const ctx = pfcCanvas.getContext('2d');
    if (mealPfcChartInst) mealPfcChartInst.destroy();
    mealPfcChartInst = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: ['タンパク質', '脂質', '炭水化物'],
        datasets: [{ data: [Math.round(totals.p), Math.round(totals.f), Math.round(totals.c)],
          backgroundColor: ['#e54a4a','#f5c842','#4a90e2'], borderWidth: 0 }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { position: 'bottom', labels: { color:'#8b90a0', font:{size:10}, padding:8 } } },
        cutout: '60%'
      }
    });
  }

  // Meal list
  const list = document.getElementById('mealList');
  if (!list) return;
  if (!dayMeals.length) { list.innerHTML = '<div class="empty-state" style="padding:20px">この日の記録なし</div>'; return; }

  const typeOrder = ['朝食','昼食','夕食','間食','プロテイン'];
  const sorted = [...dayMeals].sort((a,b) => typeOrder.indexOf(a.meal_type) - typeOrder.indexOf(b.meal_type));
  list.innerHTML = sorted.map(m => `
    <div class="meal-list-item">
      <div>
        <span class="meal-badge meal-badge-${m.meal_type}">${m.meal_type}</span>
        <strong>${m.food_name}</strong>
        ${m.amount ? `<span style="color:var(--text-muted);font-size:11px">(${m.amount}g)</span>` : ''}
      </div>
      <div style="display:flex;align-items:center;gap:10px">
        <span style="color:var(--red-light);font-weight:700;font-size:13px">${m.calories} kcal</span>
        <button class="fi-delete" onclick="deleteMeal('${m.id}')" title="削除" style="width:24px;height:24px;font-size:11px">
          <i class="fas fa-times"></i>
        </button>
      </div>
    </div>
  `).join('');
}

function render7dayMealChart() {
  const canvas = document.getElementById('meal7dayChart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const days7 = Array.from({length:7}, (_,i) => {
    const d = new Date(); d.setDate(d.getDate()-6+i);
    return d.toISOString().slice(0,10);
  });

  const calArr = days7.map(d => Math.round(mealLogs.filter(m => m.date && m.date.slice(0,10)===d).reduce((s,m) => s+(parseFloat(m.calories)||0), 0)));
  const protArr = days7.map(d => Math.round(mealLogs.filter(m => m.date && m.date.slice(0,10)===d).reduce((s,m) => s+(parseFloat(m.protein)||0), 0)));

  if (meal7dayChartInst) meal7dayChartInst.destroy();
  meal7dayChartInst = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: days7.map(d => d.slice(5)),
      datasets: [
        { label: 'kcal', data: calArr, backgroundColor: createBarGradient(ctx, '#ff6b78', '#c92d3d'), borderRadius: 8, yAxisID: 'y' },
        { label: 'P(g)', data: protArr, type:'line', borderColor:'#3dd68c', backgroundColor:'transparent',
          tension: 0.4, pointRadius:3, glowBlur: 12, yAxisID:'y1' },
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { labels: { color:'#8b90a0', font:{size:11} } } },
      scales: {
        x: { grid:{color:'rgba(255,255,255,0.04)'}, ticks:{color:'#555d72',font:{size:11}} },
        y: { grid:{color:'rgba(255,255,255,0.04)'}, ticks:{color:'#555d72',font:{size:11}}, position:'left' },
        y1:{ grid:{display:false}, ticks:{color:'#3dd68c',font:{size:11}}, position:'right' },
      }
    }
  });

  // Weekly stats
  const statsEl = document.getElementById('weeklyMealStats');
  if (statsEl) {
    const avgCal = calArr.length ? Math.round(calArr.reduce((s,v)=>s+v,0)/calArr.filter(v=>v>0).length||1) : 0;
    const totalProt = protArr.reduce((s,v)=>s+v,0);
    statsEl.innerHTML = `
      <div class="wms-item"><div class="wms-val">${avgCal}</div><div>平均kcal/日</div></div>
      <div class="wms-item"><div class="wms-val">${totalProt}g</div><div>7日合訁E</div></div>
      <div class="wms-item"><div class="wms-val">${calArr.filter(v=>v>0).length}</div><div>記録日数</div></div>
    `;
  }
}

function renderMealsPage() {
  loadMealSummary();
  render7dayMealChart();
  filterMeals();
  updateRealtimeTotal();
}

function filterMeals() {
  const dateFilter = document.getElementById('mealFilterDate')?.value;
  const typeFilter = document.getElementById('mealFilterType')?.value;

  let filtered = [...mealLogs].reverse();
  if (dateFilter) filtered = filtered.filter(m => m.date && m.date.slice(0,10) === dateFilter);
  if (typeFilter) filtered = filtered.filter(m => m.meal_type === typeFilter);

  const tbody = document.getElementById('mealsTableBody');
  if (!tbody) return;
  if (!filtered.length) {
    tbody.innerHTML = '<tr><td colspan="9" class="empty-cell">データなし</td></tr>';
    return;
  }

  tbody.innerHTML = filtered.map(m => `
    <tr>
      <td>${formatDate(m.date)}</td>
      <td><span class="meal-badge meal-badge-${m.meal_type}">${m.meal_type}</span></td>
      <td><strong>${m.food_name}</strong></td>
      <td>${m.amount ? m.amount + 'g' : '--'}</td>
      <td><strong style="color:var(--red-light)">${m.calories}</strong></td>
      <td>${m.protein || 0}</td>
      <td>${m.fat || 0}</td>
      <td>${m.carbs || 0}</td>
      <td><button class="btn btn-sm btn-danger" onclick="deleteMeal('${m.id}')"><i class="fas fa-trash"></i></button></td>
    </tr>
  `).join('');
}

function clearMealFilter() {
  const df = document.getElementById('mealFilterDate');
  const tf = document.getElementById('mealFilterType');
  if (df) df.value = '';
  if (tf) tf.value = '';
  filterMeals();
}

// Legacy compat
function searchFood() {}
function fillFoodForm() {}

// ============================================================
// TRAINING PAGE
// ============================================================
async function saveTraining() {
  const date     = document.getElementById('t-date').value;
  const type     = document.getElementById('t-type').value;
  const intensity = document.getElementById('t-intensity').value;
  const opponent = document.getElementById('t-opponent').value.trim();
  const theme    = document.getElementById('t-theme').value.trim();
  const note     = document.getElementById('t-note').value.trim();

  if (!isIsoDateString(date)) { showToast('日付を正しく選択してください', 'error'); return; }
  if (!type) { showToast('練習種目を選択してください', 'error'); return; }
  if (!TRAINING_INTENSITIES.includes(intensity)) { showToast('強度を選択してください', 'error'); return; }

  const durChk = parseRequiredBounded(document.getElementById('t-duration').value, INPUT_BOUNDS.trainingMinutes, '練習時間');
  if (!durChk.ok) { showToast(durChk.msg, 'error'); return; }
  const duration = durChk.value;

  const burnedRaw = document.getElementById('t-burned').value.trim();
  let burned = 0;
  if (burnedRaw) {
    const bChk = parseRequiredBounded(burnedRaw, INPUT_BOUNDS.trainingBurnedKcal, '消費カロリー');
    if (!bChk.ok) { showToast(bChk.msg, 'error'); return; }
    burned = bChk.value;
  }

  let rounds = null;
  const roundsRaw = document.getElementById('t-rounds').value.trim();
  if (roundsRaw) {
    const rChk = parseRequiredBounded(roundsRaw, INPUT_BOUNDS.trainingRounds, 'ラウンド数');
    if (!rChk.ok) { showToast(rChk.msg, 'error'); return; }
    rounds = rChk.value;
  }

  let rating = null;
  const ratingRaw = document.getElementById('t-rating').value;
  if (ratingRaw) {
    const rtChk = parseRequiredIntBounded(ratingRaw, INPUT_BOUNDS.trainingRating, '自己評価');
    if (!rtChk.ok) { showToast(rtChk.msg, 'error'); return; }
    rating = rtChk.value;
  }

  try {
    const record = await apiPost('training_logs', {
      date, training_type: type, duration, intensity, calories_burned: burned,
      rounds, opponent, theme, rating, note
    });
    trainingLogs.push(record);
    trainingLogs.sort((a,b) => new Date(a.date) - new Date(b.date));
    showToast(`✅ ${type} ${duration}分 を記録しました`, 'success');
    clearForm(['t-duration','t-burned','t-note','t-rounds','t-opponent','t-theme']);
    document.getElementById('t-type').value = '';
    document.getElementById('t-rating').value = '';
    renderTrainingPage();
    renderDashboard();
  } catch(e) {
    showToast('保存に失敗しました', 'error');
  }
}

async function quickSaveTraining() {
  const type     = document.getElementById('quickTrainingType').value;
  const intensity = document.getElementById('quickIntensity').value;

  if (!type) { showToast('練習種目を選択してください', 'error'); return; }
  if (!TRAINING_INTENSITIES.includes(intensity)) { showToast('強度を選択してください', 'error'); return; }
  const durChk = parseRequiredBounded(document.getElementById('quickDuration').value, INPUT_BOUNDS.trainingMinutes, '練習時間');
  if (!durChk.ok) { showToast(durChk.msg, 'error'); return; }
  const duration = durChk.value;
  const burned = calcBurnedByType(type, intensity, duration);

  try {
    const record = await apiPost('training_logs', {
      date: TODAY(), training_type: type, duration, intensity, calories_burned: burned
    });
    trainingLogs.push(record);
    trainingLogs.sort((a,b) => new Date(a.date) - new Date(b.date));
    showToast(`✅ ${type} ${duration}分 を記録しました`, 'success');
    clearForm(['quickDuration']);
    document.getElementById('quickTrainingType').value = '';
    document.getElementById('quickIntensity').value = '';
    renderDashboard();
  } catch(e) {
    showToast('保存に失敗しました', 'error');
  }
}

async function deleteTraining(id) {
  showModal('練習記録を削除', 'この記録を削除しますか？', async () => {
    try {
      await apiDelete('training_logs', id);
      trainingLogs = trainingLogs.filter(t => t.id !== id);
      showToast('削除しました', 'info');
      renderTrainingPage();
      renderDashboard();
    } catch(e) { showToast('削除に失敗しました', 'error'); }
  });
}

function calcBurnedByType(type, intensity, duration) {
  const rates = BURN_RATES[type] || BURN_RATES['その他'];
  const rate = rates[intensity] || rates['中'];
  return Math.round(rate * duration);
}

function calcCaloriesBurned() {
  const type     = document.getElementById('t-type').value;
  const intensity = document.getElementById('t-intensity').value;
  if (!type) { showToast('種目を先に選択してください', 'error'); return; }
  const durChk = parseRequiredBounded(document.getElementById('t-duration').value, INPUT_BOUNDS.trainingMinutes, '練習時間');
  if (!durChk.ok) { showToast(durChk.msg, 'error'); return; }
  const duration = durChk.value;
  const burned = calcBurnedByType(type, intensity, duration);
  document.getElementById('t-burned').value = burned;
  showToast(`🔥 推定消費カロリー: ${burned} kcal`, 'info');
}

function renderTrainingPage() {
  renderWeeklyStats();
  renderWeeklyChart();
  renderTrainingCalendar();
  renderTrainingTable();
}

function renderWeeklyStats() {
  const weekStart = getWeekStart();
  const weekEnd   = new Date(weekStart); weekEnd.setDate(weekEnd.getDate() + 7);
  const weekData  = trainingLogs.filter(t => {
    const d = new Date(t.date); return d >= weekStart && d < weekEnd;
  });

  document.getElementById('week-sessions').textContent = weekData.length;
  document.getElementById('week-minutes').textContent  = weekData.reduce((s,t) => s + (parseFloat(t.duration)||0), 0);
  document.getElementById('week-burned').textContent   = weekData.reduce((s,t) => s + (parseFloat(t.calories_burned)||0), 0);
}

function renderWeeklyChart() {
  const ctx = document.getElementById('weeklyTrainingChart').getContext('2d');
  const weekStart = getWeekStart();
  const days = Array.from({length:7}, (_,i) => {
    const d = new Date(weekStart); d.setDate(d.getDate()+i);
    return d;
  });
  const dayNames = ['日','月','火','水','木','金','土'];
  const labels = days.map(d => dayNames[d.getDay()]);
  const durations = days.map(d => {
    const ds = d.toISOString().slice(0,10);
    return trainingLogs.filter(t => t.date && t.date.slice(0,10) === ds).reduce((s,t) => s+(parseFloat(t.duration)||0), 0);
  });
  const burnedArr = days.map(d => {
    const ds = d.toISOString().slice(0,10);
    return trainingLogs.filter(t => t.date && t.date.slice(0,10) === ds).reduce((s,t) => s+(parseFloat(t.calories_burned)||0), 0);
  });

  if (weeklyTrainingChartInst) weeklyTrainingChartInst.destroy();
  weeklyTrainingChartInst = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        { label: '練習時間(分)', data: durations, backgroundColor: createBarGradient(ctx, '#ff6b78', '#c92d3d'), borderRadius: 8 },
        { label: '消費kcal', data: burnedArr, backgroundColor: createBarGradient(ctx, '#ffd36a', '#d99817'), borderRadius: 8 },
      ]
    },
    options: {
      ...chartOptions(),
      plugins: { legend: { labels: { color:'#8b90a0', font:{size:11} } } },
    }
  });
}

function renderTrainingCalendar() {
  const year = currentCalendarDate.getFullYear();
  const month = currentCalendarDate.getMonth();
  document.getElementById('calendarTitle').textContent = `${year}年${month+1}月`;

  const firstDay = new Date(year, month, 1);
  const lastDay  = new Date(year, month+1, 0);
  const today = TODAY();

  const dayNames = ['日','月','火','水','木','金','土'];
  let html = '<div class="calendar-header-row">' + dayNames.map(d => `<div class="cal-day-name">${d}</div>`).join('') + '</div>';
  html += '<div class="calendar-days-row">';

  // Empty cells before first day
  for (let i = 0; i < firstDay.getDay(); i++) {
    html += `<div class="cal-day empty"></div>`;
  }

  for (let d = 1; d <= lastDay.getDate(); d++) {
    const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const hasTraining = trainingLogs.some(t => t.date && t.date.slice(0,10) === dateStr);
    const isToday = dateStr === today;
    const classes = ['cal-day', hasTraining ? 'has-training' : '', isToday ? 'today' : ''].filter(Boolean).join(' ');
    const burned = trainingLogs.filter(t => t.date && t.date.slice(0,10) === dateStr).reduce((s,t) => s+(parseFloat(t.calories_burned)||0), 0);
    html += `<div class="${classes}" title="${dateStr}">
      <span class="cal-day-num">${d}</span>
      ${burned ? `<span class="cal-day-kcal">${burned}kcal</span>` : ''}
    </div>`;
  }

  html += '</div>';
  document.getElementById('trainingCalendar').innerHTML = html;
}

function prevMonth() {
  currentCalendarDate.setMonth(currentCalendarDate.getMonth() - 1);
  renderTrainingCalendar();
}

function nextMonth() {
  currentCalendarDate.setMonth(currentCalendarDate.getMonth() + 1);
  renderTrainingCalendar();
}

function renderTrainingTable() {
  const tbody = document.getElementById('trainingTableBody');
  if (!trainingLogs.length) {
    tbody.innerHTML = '<tr><td colspan="9" class="empty-cell">データなし</td></tr>';
    return;
  }

  tbody.innerHTML = [...trainingLogs].reverse().map(t => `
    <tr>
      <td>${formatDate(t.date)}</td>
      <td><strong>${t.training_type}</strong></td>
      <td>${t.duration} 分</td>
      <td><span class="badge intensity-${t.intensity}">${t.intensity}</span></td>
      <td>${[
        t.rounds ? `${t.rounds}R` : null,
        t.opponent ? `vs ${t.opponent}` : null,
        t.theme ? `テーマ ${t.theme}` : null
      ].filter(Boolean).join('<br>') || '--'}</td>
      <td>${t.rating ? `${t.rating}/5` : '--'}</td>
      <td>${t.calories_burned || 0} kcal</td>
      <td>${t.note || '--'}</td>
      <td><button class="btn btn-sm btn-danger" onclick="deleteTraining('${t.id}')"><i class="fas fa-trash"></i></button></td>
    </tr>
  `).join('');
}

// ============================================================
// HYDRATION / RECOVERY
// ============================================================
async function saveHydrationLog() {
  const date = document.getElementById('h-date').value;
  const sweatLevel = document.getElementById('h-sweat-level').value;
  const note = document.getElementById('h-note').value.trim();

  if (!isIsoDateString(date)) { showToast('日付を正しく選択してください', 'error'); return; }

  const wChk = parseRequiredBounded(document.getElementById('h-water').value, INPUT_BOUNDS.hydrationWaterMl, '水分摂取量');
  if (!wChk.ok) { showToast(wChk.msg, 'error'); return; }
  const water = wChk.value;

  const swChk = parseOptionalBounded(document.getElementById('h-sweat-loss').value, INPUT_BOUNDS.hydrationSweatMl, '推定発汗量');
  if (!swChk.ok) { showToast(swChk.msg, 'error'); return; }
  const sweatLoss = swChk.value ?? 0;

  const naChk = parseOptionalBounded(document.getElementById('h-sodium').value, INPUT_BOUNDS.sodiumMg, '塩分(Na)');
  if (!naChk.ok) { showToast(naChk.msg, 'error'); return; }
  const sodium = naChk.value ?? 0;

  try {
    const record = await apiPost('hydration_logs', { date, water_ml: water, sweat_level: sweatLevel, sweat_loss_ml: sweatLoss, sodium_mg: sodium, note });
    hydrationLogs.push(record);
    hydrationLogs.sort((a, b) => new Date(a.date) - new Date(b.date));
    clearForm(['h-water', 'h-sweat-loss', 'h-sodium', 'h-note']);
    document.getElementById('h-sweat-level').value = '中';
    renderCaloriesPage();
    renderDashboard();
    showToast('水分ログを保存しました', 'success');
  } catch (e) {
    console.error(e);
    showToast('保存に失敗しました', 'error');
  }
}

async function saveRecoveryLog() {
  const date = document.getElementById('r-date').value;
  const note = document.getElementById('r-note').value.trim();

  if (!isIsoDateString(date)) { showToast('日付を正しく選択してください', 'error'); return; }

  const sleepChk = parseRequiredBounded(document.getElementById('r-sleep').value, INPUT_BOUNDS.sleepHours, '睡眠時間');
  if (!sleepChk.ok) { showToast(sleepChk.msg, 'error'); return; }
  const sleep = sleepChk.value;

  const fatChk = parseRequiredBounded(document.getElementById('r-fatigue').value, INPUT_BOUNDS.score1to10, '疲労度');
  if (!fatChk.ok) { showToast(fatChk.msg, 'error'); return; }
  const fatigue = fatChk.value;

  const condChk = parseRequiredBounded(document.getElementById('r-condition').value, INPUT_BOUNDS.score1to10, '体調スコア');
  if (!condChk.ok) { showToast(condChk.msg, 'error'); return; }
  const condition = condChk.value;

  let restingHr = null;
  const rhrRaw = document.getElementById('r-rhr').value.trim();
  if (rhrRaw) {
    const rChk = parseRequiredBounded(rhrRaw, INPUT_BOUNDS.restingHr, '安静時心拍');
    if (!rChk.ok) { showToast(rChk.msg, 'error'); return; }
    restingHr = rChk.value;
  }

  try {
    const record = await apiPost('recovery_logs', {
      date, sleep_hours: sleep, fatigue_score: fatigue, condition_score: condition, resting_hr: restingHr, note
    });
    recoveryLogs.push(record);
    recoveryLogs.sort((a, b) => new Date(a.date) - new Date(b.date));
    clearForm(['r-sleep', 'r-fatigue', 'r-condition', 'r-rhr', 'r-note']);
    renderCaloriesPage();
    renderDashboard();
    showToast('回復ログを保存しました', 'success');
  } catch (e) {
    console.error(e);
    showToast('保存に失敗しました', 'error');
  }
}

function renderHealthOverview() {
  const today = TODAY();
  const todayHydration = getDailyHydration(today);
  const todayRecovery = getDailyRecovery(today);

  const water = todayHydration.reduce((sum, log) => sum + (parseFloat(log.water_ml) || 0), 0);
  const sweat = todayHydration.reduce((sum, log) => sum + (parseFloat(log.sweat_loss_ml) || 0), 0);
  const sodium = todayHydration.reduce((sum, log) => sum + (parseFloat(log.sodium_mg) || 0), 0);
  const hydrationGap = water - sweat;

  const latestRecovery = todayRecovery[todayRecovery.length - 1];
  setText('todayWaterIntake', `${Math.round(water)} ml`);
  setText('todaySweatLoss', `${Math.round(sweat)} ml`);
  setText('todaySodium', `${Math.round(sodium)} mg`);
  setText('todayHydrationGap', `${Math.round(hydrationGap)} ml`);
  setText('todaySleepHours', latestRecovery ? `${latestRecovery.sleep_hours} h` : '0 h');
  setText('todayFatigueScore', latestRecovery ? `${latestRecovery.fatigue_score} / 10` : '0 / 10');
  setText('todayConditionScore', latestRecovery ? `${latestRecovery.condition_score} / 10` : '0 / 10');
  setText('todayRestingHr', latestRecovery?.resting_hr ? `${latestRecovery.resting_hr} bpm` : '--');
}

function renderAutoSummaries() {
  const weekCutoff = new Date();
  weekCutoff.setDate(weekCutoff.getDate() - 6);
  weekCutoff.setHours(0, 0, 0, 0);
  const monthCutoff = new Date();
  monthCutoff.setDate(monthCutoff.getDate() - 29);
  monthCutoff.setHours(0, 0, 0, 0);

  const weekWeights = weightLogs.filter(w => new Date(w.date) >= weekCutoff);
  const monthWeights = weightLogs.filter(w => new Date(w.date) >= monthCutoff);
  const weekTraining = trainingLogs.filter(t => new Date(t.date) >= weekCutoff);
  const monthTraining = trainingLogs.filter(t => new Date(t.date) >= monthCutoff);
  const weekRecovery = recoveryLogs.filter(r => new Date(r.date) >= weekCutoff);
  const monthRecovery = recoveryLogs.filter(r => new Date(r.date) >= monthCutoff);
  const weekHydration = hydrationLogs.filter(h => new Date(h.date) >= weekCutoff);
  const monthHydration = hydrationLogs.filter(h => new Date(h.date) >= monthCutoff);

  const weekText = [
    `体重: ${weekWeights.length >= 2 ? `${weekWeights[0].weight}kg -> ${weekWeights[weekWeights.length - 1].weight}kg` : '記録不足'}`,
    `練習: ${weekTraining.length}回 / 合計${weekTraining.reduce((s, t) => s + (parseFloat(t.duration) || 0), 0)}分`,
    `水分: 平均${Math.round(average(weekHydration.map(h => parseFloat(h.water_ml) || 0)) || 0)}ml / 日`,
    `回復: 睡眠平均${(average(weekRecovery.map(r => parseFloat(r.sleep_hours) || 0)) || 0).toFixed(1)}h / 体調${(average(weekRecovery.map(r => parseFloat(r.condition_score) || 0)) || 0).toFixed(1)}`
  ].join('\n');

  const monthText = [
    `体重推移: ${monthWeights.length >= 2 ? `${monthWeights[0].weight}kg -> ${monthWeights[monthWeights.length - 1].weight}kg` : '記録不足'}`,
    `練習量: ${monthTraining.length}回 / 合計${monthTraining.reduce((s, t) => s + (parseFloat(t.duration) || 0), 0)}分`,
    `平均水分: ${Math.round(average(monthHydration.map(h => parseFloat(h.water_ml) || 0)) || 0)}ml / 日`,
    `回復傾向: 疲労${(average(monthRecovery.map(r => parseFloat(r.fatigue_score) || 0)) || 0).toFixed(1)} / 体調${(average(monthRecovery.map(r => parseFloat(r.condition_score) || 0)) || 0).toFixed(1)}`
  ].join('\n');

  setText('weeklySummaryText', weekText);
  setText('monthlySummaryText', monthText);
}

// ============================================================
// CALORIES PAGE
// ============================================================
function calcBMR() {
  const gender = document.getElementById('calc-gender').value;
  const activityFactor = parseFloat(document.getElementById('calc-activity').value);
  const goal   = document.getElementById('calc-goal').value;

  const ageChk = parseRequiredIntBounded(document.getElementById('calc-age').value, INPUT_BOUNDS.age, '年齢');
  if (!ageChk.ok) { showToast(ageChk.msg, 'error'); return; }
  const age = ageChk.value;

  const hChk = parseRequiredBounded(document.getElementById('calc-height').value, INPUT_BOUNDS.heightCm, '身長');
  if (!hChk.ok) { showToast(hChk.msg, 'error'); return; }
  const height = hChk.value;

  const wChk = parseRequiredBounded(document.getElementById('calc-weight').value, INPUT_BOUNDS.weightKg, '体重');
  if (!wChk.ok) { showToast(wChk.msg, 'error'); return; }
  const weight = wChk.value;

  if (!Number.isFinite(activityFactor) || activityFactor <= 0) {
    showToast('活動レベルを選択してください', 'error');
    return;
  }

  // Mifflin-St Jeor formula
  let bmr;
  if (gender === 'male') {
    bmr = 10 * weight + 6.25 * height - 5 * age + 5;
  } else {
    bmr = 10 * weight + 6.25 * height - 5 * age - 161;
  }

  const tdee = Math.round(bmr * activityFactor);
  let goalCal = tdee;
  if (goal === 'cut')   goalCal = Math.round(tdee * 0.80);
  if (goal === 'cut_mild') goalCal = Math.round(tdee * 0.90);
  if (goal === 'maintain') goalCal = Math.round(tdee);
  if (goal === 'bulk')  goalCal = Math.round(tdee * 1.10);

  document.getElementById('res-bmr').textContent  = `${Math.round(bmr)} kcal`;
  document.getElementById('res-tdee').textContent = `${tdee} kcal`;
  document.getElementById('res-goal').textContent = `${goalCal} kcal`;

  // PFC recommendations (boxer-focused: high protein)
  const proteinG = Math.round(weight * 2.2);  // 2.2g per kg for athletes
  const fatG     = Math.round(goalCal * 0.20 / 9);
  const carbsKcal = goalCal - (proteinG * 4) - (fatG * 9);
  const carbsG   = Math.round(carbsKcal / 4);

  document.getElementById('rec-p').textContent = `${proteinG} g`;
  document.getElementById('rec-f').textContent = `${fatG} g`;
  document.getElementById('rec-c').textContent = `${carbsG} g`;

  showToast(`✅ BMR: ${Math.round(bmr)}kcal / TDEE: ${tdee}kcal`, 'info');
}

function renderCaloriesPage() {
  // Update today's calorie balance
  const today = TODAY();
  const todayMeals = mealLogs.filter(m => m.date && m.date.slice(0,10) === today);
  const todayTraining = trainingLogs.filter(t => t.date && t.date.slice(0,10) === today);

  const intake = todayMeals.reduce((s,m) => s+(parseFloat(m.calories)||0), 0);
  const burned = todayTraining.reduce((s,t) => s+(parseFloat(t.calories_burned)||0), 0);
  const net    = Math.round(intake - burned);

  document.getElementById('today-intake').textContent     = Math.round(intake);
  document.getElementById('today-burned-cal').textContent = Math.round(burned);
  document.getElementById('today-net').textContent        = net;

  const netIcon = document.getElementById('netIcon');
  netIcon.className = `cal-bal-icon ${net > 0 ? 'positive' : 'negative'}`;

  // 7-day chart
  renderCalorieBalanceChart();
  renderTrainingWeightRecoveryCorrelation();
  renderHealthOverview();

  // Prefill weight from latest record
  if (weightLogs.length) {
    const latest = weightLogs[weightLogs.length-1];
    document.getElementById('calc-weight').value = latest.weight || 65;
  }
}

function renderCalorieBalanceChart() {
  const ctx = document.getElementById('calorieBalanceChart').getContext('2d');
  const days7 = Array.from({length:7}, (_,i) => {
    const d = new Date(); d.setDate(d.getDate()-6+i);
    return d.toISOString().slice(0,10);
  });

  const intakes = days7.map(d => Math.round(mealLogs.filter(m => m.date && m.date.slice(0,10)===d).reduce((s,m) => s+(parseFloat(m.calories)||0), 0)));
  const burneds = days7.map(d => Math.round(trainingLogs.filter(t => t.date && t.date.slice(0,10)===d).reduce((s,t) => s+(parseFloat(t.calories_burned)||0), 0)));

  if (calorieBalanceChartInst) calorieBalanceChartInst.destroy();
  calorieBalanceChartInst = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: days7.map(d => d.slice(5)),
      datasets: [
        { label: '摂取 kcal', data: intakes, backgroundColor: createBarGradient(ctx, '#69b2ff', '#326fd6'), borderRadius: 8 },
        { label: '消費 kcal', data: burneds, backgroundColor: createBarGradient(ctx, '#ff6b78', '#c92d3d'), borderRadius: 8 },
      ]
    },
    options: chartOptions('kcal'),
  });
}

function renderTrainingWeightRecoveryCorrelation() {
  const canvas = document.getElementById('trainingWeightRecoveryChart');
  const summaryEl = document.getElementById('trainingWeightRecoverySummary');
  const noteEl = document.getElementById('trainingWeightRecoveryNote');
  if (!canvas || !summaryEl || !noteEl) return;

  const dayCount = 14;
  const series = buildTrainingWeightRecoverySeries(dayCount);
  const rTrainSleep = pearsonCorrelation(series.training, series.sleep);
  const rTrainWeight = pearsonCorrelation(series.training, series.weightLogged);

  const fmtR = (r) => (r == null ? '—' : `${r >= 0 ? '+' : ''}${r.toFixed(2)}`);
  const summaryParts = [];
  if (rTrainSleep != null) summaryParts.push(`練習×睡眠 r≈${fmtR(rTrainSleep)}`);
  if (rTrainWeight != null) summaryParts.push(`練習×体重(当日計測) r≈${fmtR(rTrainWeight)}`);
  summaryEl.textContent = summaryParts.length
    ? `相関（参考）: ${summaryParts.join(' ／ ')}`
    : '相関を出すには、同一期間に練習＋睡眠（または体重）の記録が複数日必要です';

  let note = '';
  const hasSleep = series.sleep.some(s => s != null);
  const hasTrain = series.training.some(t => t > 0);
  if (hasTrain && !hasSleep) {
    note = '回復ログの睡眠時間を入れると、練習量との関係が把握しやすくなります。';
  } else if (rTrainSleep != null) {
    if (rTrainSleep <= -0.35) {
      note = '練習時間が長い日ほど睡眠が短くなる傾向が見えます。回復を確保する日を週単位で意識してみてください。';
    } else if (rTrainSleep >= 0.35) {
      note = '練習量が多い日でも睡眠時間を保てているようです。回復のバランスが取れています。';
    } else {
      note = '練習と睡眠の強い連動はまだはっきりしません。記録を続けると傾向が見えやすくなります。';
    }
  } else if (!hasTrain && !hasSleep) {
    note = '練習・回復の記録が増えると、このグラフで推移をまとめて確認できます。';
  } else {
    note = '睡眠データが十分に揃うと、練習との相関が表示されます。';
  }
  if (rTrainWeight != null && Math.abs(rTrainWeight) >= 0.35) {
    note += rTrainWeight < 0
      ? ' 当日計測の体重は、練習が多い日ほど低めに出やすい傾向があります（水分・計測タイミングの影響もあり得ます）。'
      : ' 当日計測の体重と練習量に、一定の同方向の傾向が見えます（要因は個人差があります）。';
  }
  noteEl.textContent = note;

  const ctx = canvas.getContext('2d');
  const co = chartOptions('');
  if (trainingWeightRecoveryChartInst) trainingWeightRecoveryChartInst.destroy();

  trainingWeightRecoveryChartInst = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: series.labels,
      datasets: [
        {
          type: 'bar',
          label: '練習(分)',
          data: series.training,
          yAxisID: 'y',
          backgroundColor: createBarGradient(ctx, '#34d399', '#059669'),
          borderRadius: 8,
          order: 3,
        },
        {
          type: 'line',
          label: '体重(kg)',
          data: series.weightLine,
          yAxisID: 'y1',
          borderColor: '#93c5fd',
          backgroundColor: 'rgba(147,197,253,0.08)',
          borderWidth: 2,
          tension: 0.35,
          spanGaps: true,
          pointRadius: 3,
          pointBackgroundColor: '#93c5fd',
          order: 1,
        },
        {
          type: 'line',
          label: '睡眠(h)',
          data: series.sleep,
          yAxisID: 'y2',
          borderColor: '#c4b5fd',
          borderWidth: 2,
          tension: 0.35,
          spanGaps: false,
          pointRadius: 3,
          pointBackgroundColor: '#c4b5fd',
          order: 2,
        },
      ],
    },
    options: {
      ...co,
      scales: {
        x: co.scales.x,
        y: {
          ...co.scales.y,
          beginAtZero: true,
          title: { display: true, text: '練習(分)', color: '#7d869d', font: { size: 11, weight: '600' } },
        },
        y1: {
          type: 'linear',
          position: 'right',
          grid: { drawOnChartArea: false },
          border: { display: false },
          ticks: { color: '#93c5fd', font: { size: 11, weight: '600' }, padding: 8 },
          title: { display: true, text: '体重(kg)', color: '#93c5fd', font: { size: 11, weight: '600' } },
        },
        y2: {
          type: 'linear',
          position: 'right',
          offset: true,
          grid: { drawOnChartArea: false },
          border: { display: false },
          ticks: { color: '#c4b5fd', font: { size: 11, weight: '600' }, padding: 8 },
          title: { display: true, text: '睡眠(h)', color: '#c4b5fd', font: { size: 11, weight: '600' } },
        },
      },
      plugins: {
        ...co.plugins,
        tooltip: {
          ...co.plugins.tooltip,
          callbacks: {
            label: (c) => {
              const v = c.raw;
              const lab = c.dataset.label || '';
              if (v == null || Number.isNaN(Number(v))) return ` ${lab}: —`;
              if (lab.includes('練習')) return ` ${lab}: ${v} 分`;
              if (lab.includes('体重')) return ` ${lab}: ${Number(v).toFixed(1)} kg`;
              if (lab.includes('睡眠')) return ` ${lab}: ${Number(v).toFixed(1)} h`;
              return ` ${lab}: ${v}`;
            },
          },
        },
      },
    },
  });
}

// ============================================================
// FIGHT GOALS PAGE
// ============================================================
async function saveFightGoal() {
  const date     = document.getElementById('f-date').value;
  const opponent = document.getElementById('f-opponent').value.trim();
  const wclass   = document.getElementById('f-class').value;
  const targetRaw = document.getElementById('f-target').value.trim();
  const venue    = document.getElementById('f-venue').value.trim();
  const status   = document.getElementById('f-status').value;
  const note     = document.getElementById('f-note').value.trim();

  if (!isIsoDateString(date)) { showToast('試合日を正しく選択してください', 'error'); return; }

  let target = null;
  if (targetRaw) {
    const tChk = parseRequiredBounded(targetRaw, INPUT_BOUNDS.targetWeightKg, '減量目標体重');
    if (!tChk.ok) { showToast(tChk.msg, 'error'); return; }
    target = tChk.value;
  }

  const latestWeight = weightLogs.length ? weightLogs[weightLogs.length-1]?.weight : null;

  try {
    const record = await apiPost('fight_goals', {
      fight_date: date, opponent, weight_class: wclass, target_weight: target,
      current_weight: latestWeight, venue, status, note
    });
    fightGoals.push(record);
    fightGoals.sort((a,b) => new Date(a.fight_date) - new Date(b.fight_date));
    showToast(`✅ 試合目標を登録しました！`, 'success');
    clearForm(['f-opponent','f-target','f-venue','f-note']);
    renderFightPage();
    renderDashboard();
  } catch(e) {
    showToast('保存に失敗しました', 'error');
  }
}

async function deleteFightGoal(id) {
  showModal('試合目標を削除', 'この試合目標を削除しますか？', async () => {
    try {
      await apiDelete('fight_goals', id);
      fightGoals = fightGoals.filter(f => f.id !== id);
      showToast('削除しました', 'info');
      renderFightPage();
      renderDashboard();
    } catch(e) { showToast('削除に失敗しました', 'error'); }
  });
}

function renderFightPage() {
  const activeFights = fightGoals.filter(f => f.status === '準備中' && f.fight_date);
  const nextFight = activeFights.sort((a,b) => new Date(a.fight_date)-new Date(b.fight_date))[0];

  if (nextFight) {
    const days = getDaysUntil(nextFight.fight_date);
    document.getElementById('countdown-days').textContent = days;
    document.getElementById('fi-opponent').textContent = `vs ${nextFight.opponent || '相手未定'}`;
    document.getElementById('fi-date').textContent = formatDateJP(nextFight.fight_date);
    document.getElementById('fi-venue').textContent = nextFight.venue || '--';
    document.getElementById('fi-target').textContent = `目標体重: ${nextFight.target_weight || '--'} kg`;

    // Weight cut progress
    const latest = weightLogs.length ? weightLogs[weightLogs.length-1].weight : null;
    const target = nextFight.target_weight;
    document.getElementById('wcp-current').textContent = `現在: ${latest || '--'} kg`;
    document.getElementById('wcp-target').textContent = `目標: ${target || '--'} kg`;

    if (latest && target) {
      const startW = nextFight.current_weight || latest;
      const remain = (latest - target).toFixed(1);
      const totalCut = startW - target;
      const pct = totalCut > 0 ? Math.min(100, Math.round(((startW - latest) / totalCut) * 100)) : 100;
      const safeWeeklyCut = latest * 0.01;
      const safeDailyGrams = Math.round((safeWeeklyCut / 7) * 1000);
      const weeksLeft = Math.max(0, Math.ceil(days / 7));
      const trainDays = Math.max(0, days - Math.floor(days / 7));
      const cutPerWeek = days > 0 ? (latest - target) / Math.max(days / 7, 1) : 0;
      const cutPerDayGrams = days > 0 ? Math.round(((latest - target) / days) * 1000) : 0;
      const status = cutPerWeek <= safeWeeklyCut ? '安全圏' : cutPerWeek <= safeWeeklyCut * 1.5 ? '注意' : '危険';
      document.getElementById('fightWeightProgressFill').style.width = `${pct}%`;
      document.getElementById('wcp-remain').textContent = remain > 0 ? `残り -${remain} kg` : '目標達成！';
      setText('fdWeeks', String(weeksLeft));
      setText('fdTrainDays', String(trainDays));
      setText('fdCutPerDay', String(cutPerDayGrams > 0 ? cutPerDayGrams : 0));
      setText('cutPerWeek', `${cutPerWeek > 0 ? cutPerWeek.toFixed(2) : '0.00'} kg`);
      setText('cutPerDay', `${cutPerDayGrams > 0 ? cutPerDayGrams : 0} g`);
      setText('safeCutLimit', `${safeWeeklyCut.toFixed(2)} kg`);
      setText('weightCutStatus', status);
      setText('weightCutPlanNote', status === '安全圏'
        ? '現在のペースは一般的な安全圏です。水分・睡眠・回復も合わせて管理してください。'
        : status === '注意'
          ? 'やや速い減量ペースです。食事制限だけでなく水分・疲労管理も厳密に確認してください。'
          : '危険寄りの減量ペースです。コンディション悪化のリスクが高いため、計画の見直し推奨です。');
      const badge = document.getElementById('weightCutWarningBadge');
      if (badge) {
        badge.classList.remove('up', 'down', 'flat');
        badge.classList.add(status === '安全圏' ? 'up' : status === '注意' ? 'flat' : 'down');
        badge.textContent = status;
      }
      renderWeightCutCauseAlerts(nextFight, latest, target, days, cutPerWeek, safeWeeklyCut, status);
    } else {
      hideWeightCutCauseAlerts();
      setText('cutPerWeek', '-- kg');
      setText('cutPerDay', '-- g');
      setText('safeCutLimit', '-- kg');
      setText('weightCutStatus', '--');
      setText('weightCutPlanNote', '目標体重と最新体重が揃うと安全な減量計画を計算します。');
      const badge = document.getElementById('weightCutWarningBadge');
      if (badge) {
        badge.classList.remove('up', 'down', 'flat');
        badge.textContent = '判定待ち';
      }
    }
  } else {
    document.getElementById('countdown-days').textContent = '--';
    setText('fdWeeks', '--');
    setText('fdTrainDays', '--');
    setText('fdCutPerDay', '--');
    setText('cutPerWeek', '-- kg');
    setText('cutPerDay', '-- g');
    setText('safeCutLimit', '-- kg');
    setText('weightCutStatus', '--');
    setText('weightCutPlanNote', '試合目標を登録すると減量ペースの警告が表示されます。');
    const badge = document.getElementById('weightCutWarningBadge');
    if (badge) {
      badge.classList.remove('up', 'down', 'flat');
      badge.textContent = '判定待ち';
    }
    hideWeightCutCauseAlerts();
  }

  renderCuttingPlanSection();
  renderFightPlanComparison(nextFight);

  // Fight cards list
  const container = document.getElementById('fightCardsList');
  if (!fightGoals.length) {
    container.innerHTML = '<div class="empty-state">試合目標が登録されていません</div>';
    return;
  }

  container.innerHTML = [...fightGoals].reverse().map(f => {
    const days = getDaysUntil(f.fight_date);
    return `
      <div class="fight-card">
        <div class="fight-card-header">
          <div class="fight-card-date">${formatDate(f.fight_date)}</div>
          <span class="fight-card-status status-${f.status}">${f.status}</span>
        </div>
        <div class="fight-card-info">
          ${f.opponent ? `🥊 vs <strong>${f.opponent}</strong><br>` : ''}
          ${f.weight_class ? `⚖️ ${f.weight_class}<br>` : ''}
          ${f.target_weight ? `🎯 目標体重: <strong>${f.target_weight} kg</strong><br>` : ''}
          ${f.venue ? `📍 ${f.venue}<br>` : ''}
          ${f.status === '準備中' && days !== null ? `⏱️ <strong style="color:var(--red-light)">${days}日後</strong>` : ''}
          ${f.note ? `<br>📝 ${f.note}` : ''}
        </div>
        <div class="fight-card-actions">
          <button class="btn btn-sm btn-danger" onclick="deleteFightGoal('${f.id}')">
            <i class="fas fa-trash"></i> 削除
          </button>
        </div>
      </div>
    `;
  }).join('');
}

function renderCuttingPlanSection() {
  const summaryEl = document.getElementById('cutPlanSummary');
  const todayCard = document.getElementById('todayCutPlanCard');
  const tbody = document.getElementById('cutPlanTableBody');
  if (!summaryEl || !todayCard || !tbody) return;

  if (!cuttingPlanRows.length) {
    summaryEl.textContent = 'データ未読込';
    todayCard.innerHTML = '<div class="empty-state">プランデータを読み込めませんでした</div>';
    tbody.innerHTML = '<tr><td colspan="9" class="empty-cell">プランデータなし</td></tr>';
    return;
  }

  const today = TODAY();
  const upcoming = cuttingPlanRows.find(row => row.date >= today) || cuttingPlanRows[cuttingPlanRows.length - 1];
  summaryEl.textContent = `${formatDate(cuttingPlanRows[0].date)} - ${formatDate(cuttingPlanRows[cuttingPlanRows.length - 1].date)} / ${cuttingPlanRows.length}日分`;

  todayCard.innerHTML = `
    <div class="cut-plan-phase"><i class="fas fa-flag-checkered"></i>${upcoming.phase}</div>
    <div>
      <div class="stat-label">対象日</div>
      <div class="cut-plan-target">${formatDate(upcoming.date)}</div>
      <div class="stat-sub">目標朝体重 ${upcoming.targetMorningWeight}</div>
    </div>
    <div class="health-kpi-grid" style="padding:0">
      <div class="health-kpi"><span>KCAL</span><strong>${upcoming.totalKcalTarget}</strong></div>
      <div class="health-kpi"><span>P</span><strong>${upcoming.protein}g</strong></div>
      <div class="health-kpi"><span>F</span><strong>${upcoming.fat}g</strong></div>
      <div class="health-kpi"><span>C</span><strong>${upcoming.carbs}g</strong></div>
    </div>
    <div class="cut-plan-meal"><span>朝</span><strong>${upcoming.breakfast}</strong></div>
    <div class="cut-plan-meal"><span>昼</span><strong>${upcoming.lunch}</strong></div>
    <div class="cut-plan-meal"><span>夜</span><strong>${upcoming.dinner}</strong></div>
    <div class="cut-plan-meal"><span>補食</span><strong>${upcoming.snack || 'なし'}</strong></div>
    <div class="cut-plan-notes">
      <div><strong style="color:var(--tx-1)">水分メモ:</strong> ${upcoming.hydrationMemo || '--'}</div>
      <div><strong style="color:var(--tx-1)">体調メモ:</strong> ${upcoming.conditionMemo || '--'}</div>
    </div>
  `;

  tbody.innerHTML = cuttingPlanRows.map(row => `
    <tr>
      <td>${formatDate(row.date)}</td>
      <td>${row.phase}</td>
      <td>${row.targetMorningWeight}</td>
      <td>${row.totalKcalTarget || '--'}</td>
      <td>${row.protein || '--'}</td>
      <td>${row.fat || '--'}</td>
      <td>${row.carbs || '--'}</td>
      <td>
        <strong>朝</strong> ${row.breakfast}<br>
        <strong>昼</strong> ${row.lunch}<br>
        <strong>夜</strong> ${row.dinner}<br>
        <strong>補</strong> ${row.snack || 'なし'}
      </td>
      <td>${row.hydrationMemo}<br>${row.conditionMemo}</td>
    </tr>
  `).join('');

  switchCutPlanTab(currentCutPlanTab, false);
}

function switchCutPlanTab(tabName, shouldScroll = false) {
  currentCutPlanTab = tabName;

  const cardTab = document.getElementById('cutPlanTabCard');
  const tableTab = document.getElementById('cutPlanTabTable');
  const cardPanel = document.getElementById('cutPlanPanelCard');
  const tablePanel = document.getElementById('cutPlanPanelTable');

  if (!cardTab || !tableTab || !cardPanel || !tablePanel) return;

  const isCard = tabName === 'card';
  cardTab.classList.toggle('active', isCard);
  tableTab.classList.toggle('active', !isCard);
  cardPanel.classList.toggle('active', isCard);
  tablePanel.classList.toggle('active', !isCard);

  if (shouldScroll) {
    (isCard ? cardPanel : tablePanel).scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }
}

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

function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('service-worker.js').catch(err => {
      console.error('Service worker registration failed:', err);
    });
  });
}

function bindAppEventHandlers() {
  document.getElementById('appDataImportInput')?.addEventListener('change', importAppDataFromFile);
  document.getElementById('w-height')?.addEventListener('input', updateWeightBmiPreview);
  document.getElementById('w-weight')?.addEventListener('input', updateWeightBmiPreview);
}

// ============================================================
// INIT
// ============================================================
document.addEventListener('DOMContentLoaded', async () => {
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

  // Set mealViewDate to today and load summary
  document.getElementById('mealViewDate').value = TODAY();
  loadMealSummary();
  switchPage(appSettings.landingPage || 'dashboard');
});

