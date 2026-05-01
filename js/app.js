/* ============================================================
  BOXER PRO -- Main Application JavaScript
   ============================================================ */

'use strict';
(function purgeLocalhostServiceWorkerOnce() {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
  const h = (location.hostname || "").toLowerCase();
  if (h !== "localhost" && h !== "127.0.0.1" && h !== "[::1]" && h !== "0.0.0.0") return;
  navigator.serviceWorker.getRegistrations().then(async (regs) => {
    if (!regs.length) {
      sessionStorage.removeItem("bpDevSwReloadOnce");
      return;
    }
    const alreadyReloaded = sessionStorage.getItem("bpDevSwReloadOnce") === "1";
    await Promise.all(regs.map((r) => r.unregister()));
    if ("caches" in window) {
      try {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      } catch (_) {}
    }
    if (!alreadyReloaded) {
      sessionStorage.setItem("bpDevSwReloadOnce", "1");
      location.reload();
      return;
    }
    sessionStorage.removeItem("bpDevSwReloadOnce");
    console.warn(
      "BOXER PRO: localhost で Service Worker が残っています。Chrome → Application → 「サイトデータを削除」でキャッシュを消してください。"
    );
  });
})();


// ============================================================
// CONSTANTS
// ============================================================
const API_BASE = 'tables';
function toLocalIsoDate(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
const TODAY = () => toLocalIsoDate(new Date());
const LOCAL_TABLE_PREFIX = 'boxerpro.table.';
const SETTINGS_KEY = 'boxerpro.settings';
const APP_SCHEMA_VERSION = 1;
const CUTTING_PLAN_URL = 'data/weight-cut-plan.csv';
const FOODS_DB_URL = 'data/foods.csv';
const AUTO_CUT_WEEKLY_LIMIT_RATIO = 0.009;
const AUTO_CUT_PHASE_BOUNDARIES = {
  baseDaysMin: 29,
  intensiveDaysMin: 15,
  finalDaysMin: 6,
};
const AUTO_CUT_CLASS_PRESETS = [
  {
    id: 'mini_to_fly',
    label: 'ミニマム〜フライ',
    keywords: ['ミニマム', 'ライトフライ', 'フライ'],
    proteinMul: 1.08,
    fatMul: 0.92,
    carbsShift: -15,
    deficitMul: 0.90,
    kcalFloorMul: 1.00,
  },
  {
    id: 'superfly_to_feather',
    label: 'Sフライ〜フェザー',
    keywords: ['スーパーフライ', 'バンタム', 'スーパーバンタム', 'フェザー'],
    proteinMul: 1.04,
    fatMul: 0.96,
    carbsShift: -8,
    deficitMul: 0.95,
    kcalFloorMul: 1.00,
  },
  {
    id: 'superfeather_to_welter',
    label: 'Sフェザー〜ウェルター',
    keywords: ['スーパーフェザー', 'ライト級', 'スーパーライト', 'ウェルター'],
    proteinMul: 1.00,
    fatMul: 1.00,
    carbsShift: 0,
    deficitMul: 1.00,
    kcalFloorMul: 1.00,
  },
  {
    id: 'middle_plus',
    label: 'ミドル以上',
    keywords: ['ミドル', 'スーパーミドル', 'ライトヘビー', 'クルーザー', 'ヘビー'],
    proteinMul: 0.96,
    fatMul: 1.05,
    carbsShift: 10,
    deficitMul: 1.08,
    kcalFloorMul: 1.04,
  },
];
const AUTO_CUT_CLASS_PRESET_DEFAULT = {
  id: 'default',
  label: '標準',
  proteinMul: 1,
  fatMul: 1,
  carbsShift: 0,
  deficitMul: 1,
  kcalFloorMul: 1,
};
const DATA_TABLES = ['weight_logs', 'weight_log_photos', 'meals', 'training_logs', 'fight_goals', 'opponents', 'fight_history', 'hydration_logs', 'recovery_logs'];
const WEIGHT_LOG_SLOTS = [
  { value: 'morning', label: '朝', shortLabel: '朝' },
  { value: 'evening', label: '夜', shortLabel: '夜' },
];
const WEIGHT_PHOTO_BUCKET = 'weight-photos';
const OPPONENT_PHOTO_BUCKET = 'opponent-photos';
const WEIGHT_PHOTO_MAX_FILES = 3;
const IMAGE_MAX_EDGE = 1600;
const IMAGE_MAX_SIZE_BYTES = 850 * 1024;
const OPPONENT_STANCES = ['オーソドックス', 'サウスポー', 'スイッチ', '不明'];
const FIGHT_RESULTS = ['勝ち', '負け', '引き分け', '中止', '無効試合'];
const FIGHT_METHODS = ['判定', 'KO', 'TKO', 'RSC', '棄権', 'その他'];
const STORAGE_MODE = {
  CHECKING: 'checking',
  API: 'api',
  LOCAL: 'local',
  SUPABASE: 'supabase',
};
const GOAL_MODES = ['boxer_cut', 'fat_loss', 'maintenance'];
const SUPPORTED_LANGUAGES = ['ja', 'vi'];

const UI_TEXT = {
  ja: {
    pageTitles: {
      dashboard: 'ダッシュボード',
      weight: '体重管理',
      meals: '食事メニュー',
      training: '練習スケジュール',
      calories: 'カロリー計算',
      fight: '試合目標',
      trainer: 'トレーナー閲覧',
      notifications: '通知',
      settings: 'マイ設定',
    },
    navLabels: {
      dashboard: 'ダッシュボード',
      weight: '体重管理',
      meals: '食事メニュー',
      training: '練習スケジュール',
      calories: 'カロリー計算',
      fight: '試合目標',
      trainer: 'トレーナー閲覧',
      notifications: '通知',
      settings: 'マイ設定',
    },
    mobileNavLabels: {
      dashboard: 'ホーム',
      weight: '体重',
      meals: '食事',
      training: '練習',
      fight: '試合',
    },
    quickSheet: {
      title: 'すばやく記録',
      sub: 'よく使う入力画面へすぐ移動（開いている画面から）',
      close: '閉じる',
      weight: '体重',
      meals: '食事',
      training: '練習',
      hydration: '水分',
      recovery: '睡眠・回復',
      calories: 'カロリー',
      settings: '設定',
    },
    settings: {
      pageTitle: 'マイ設定',
      pageSubtitle: '個人用の基本設定・通知・バックアップ管理',
      languageLabel: '表示言語',
      languageJa: '日本語',
      languageVi: 'Tiếng Việt',
      saveDone: '設定を保存しました',
    },
    dashboard: {
      title: 'ダッシュボード',
      subtitle: '今日のコンディションを一目で確認',
      kpiWeight: '現在の体重',
      kpiCalories: '本日摂取カロリー',
      kpiProtein: '本日タンパク質',
      kpiTraining: '本日の練習',
      kpiProteinGuide: '目安 体重×2.2g',
      weightTrendTitle: '体重推移（直近14日）',
      weightTrendSub: '減量ペースと目標ラインを同時に確認',
      pfcTitle: '本日 PFC バランス',
      pfcSub: '食事から逆算して減量中でもチェック',
      statCurrent: '現在',
      statAvg14: '14日平均',
      statDelta: '前回比',
      statGap: '目標差',
    },
    common: {
      save: '保存',
      close: '閉じる',
      cancel: 'キャンセル',
      delete: '削除',
      edit: '編集',
      add: '追加',
    },
  },
  vi: {
    pageTitles: {
      dashboard: 'Bảng điều khiển',
      weight: 'Quản lý cân nặng',
      meals: 'Bữa ăn',
      training: 'Lịch tập',
      calories: 'Tính calo',
      fight: 'Mục tiêu trận đấu',
      trainer: 'HLV xem dữ liệu',
      notifications: 'Thông báo',
      settings: 'Cài đặt',
    },
    navLabels: {
      dashboard: 'Bảng điều khiển',
      weight: 'Cân nặng',
      meals: 'Bữa ăn',
      training: 'Luyện tập',
      calories: 'Calo',
      fight: 'Trận đấu',
      trainer: 'HLV',
      notifications: 'Thông báo',
      settings: 'Cài đặt',
    },
    mobileNavLabels: {
      dashboard: 'Trang chủ',
      weight: 'Cân nặng',
      meals: 'Bữa ăn',
      training: 'Luyện tập',
      fight: 'Trận đấu',
    },
    quickSheet: {
      title: 'Ghi nhanh',
      sub: 'Đi đến màn hình nhập liệu thường dùng',
      close: 'Đóng',
      weight: 'Cân nặng',
      meals: 'Bữa ăn',
      training: 'Luyện tập',
      hydration: 'Nước',
      recovery: 'Ngủ/Phục hồi',
      calories: 'Calo',
      settings: 'Cài đặt',
    },
    settings: {
      pageTitle: 'Cài đặt',
      pageSubtitle: 'Thiết lập cá nhân, thông báo, sao lưu',
      languageLabel: 'Ngôn ngữ hiển thị',
      languageJa: 'Tiếng Nhật',
      languageVi: 'Tiếng Việt',
      saveDone: 'Đã lưu cài đặt',
    },
    dashboard: {
      title: 'Bảng điều khiển',
      subtitle: 'Xem nhanh tình trạng hôm nay',
      kpiWeight: 'Cân nặng hiện tại',
      kpiCalories: 'Calo hôm nay',
      kpiProtein: 'Protein hôm nay',
      kpiTraining: 'Buổi tập hôm nay',
      kpiProteinGuide: 'Mốc: cân nặng x 2.2g',
      weightTrendTitle: 'Xu hướng cân nặng (14 ngày gần nhất)',
      weightTrendSub: 'Theo dõi cùng lúc tốc độ giảm cân và mốc mục tiêu',
      pfcTitle: 'Cân bằng PFC hôm nay',
      pfcSub: 'Kiểm tra cả khi giảm cân dựa trên bữa ăn',
      statCurrent: 'Hiện tại',
      statAvg14: 'TB 14 ngày',
      statDelta: 'So với lần trước',
      statGap: 'Chênh lệch mục tiêu',
    },
    common: {
      save: 'Lưu',
      close: 'Đóng',
      cancel: 'Hủy',
      delete: 'Xóa',
      edit: 'Sửa',
      add: 'Thêm',
    },
  },
};

const JA_TO_VI_TEXT = {
  'ダッシュボード': 'Bảng điều khiển',
  '体重管理': 'Quản lý cân nặng',
  '食事メニュー': 'Bữa ăn',
  '練習スケジュール': 'Lịch tập',
  'カロリー計算': 'Tính calo',
  '試合目標': 'Mục tiêu trận đấu',
  'マイ設定': 'Cài đặt',
  'Navigation': 'Điều hướng',
  '同期確認中': 'Đang kiểm tra đồng bộ',
  'アプリをインストール': 'Cài đặt ứng dụng',
  '今日のコンディションを一目で確認': 'Xem nhanh tình trạng hôm nay',
  '現在の体重': 'Cân nặng hiện tại',
  '本日摂取カロリー': 'Calo hôm nay',
  '判定: 計算待ち': 'Đánh giá: chờ tính',
  '本日タンパク質': 'Protein hôm nay',
  '目安 体重×2.2g': 'Mốc: cân nặng x 2.2g',
  '本日の練習': 'Buổi tập hôm nay',
  '消費 -- kcal': 'Tiêu hao -- kcal',
  '体重推移（直近14日）': 'Xu hướng cân nặng (14 ngày gần nhất)',
  '減量ペースと目標ラインを同時に確認': 'Theo dõi cùng lúc tốc độ giảm cân và mốc mục tiêu',
  '増量トレンド': 'Xu hướng tăng',
  '記録待ち': 'Chờ ghi nhận',
  '本日 PFC バランス': 'Cân bằng PFC hôm nay',
  '食事から逆算して減量中でもチェック': 'Kiểm tra cả khi giảm cân dựa trên bữa ăn',
  '現在': 'Hiện tại',
  '14日平均': 'TB 14 ngày',
  '前回比': 'So với lần trước',
  '目標差': 'Chênh lệch mục tiêu',
  '記録の確認と、必要なときだけ編集': 'Xem bản ghi và chỉ chỉnh sửa khi cần',
  '食品名を入力して': 'Nhập tên thực phẩm để',
  'カロリー・PFC 自動計算': 'tự động tính calo và PFC',
  'トレーニング記録・消費カロリー・感想レビュー管理': 'Quản lý buổi tập, calo tiêu hao và ghi chú',
  'BMR / TDEE 計算とPFCバランス管理': 'Tính BMR/TDEE và quản lý cân bằng PFC',
  '次の試合に向けたカウントダウンと減量進捗': 'Đếm ngược trận đấu và tiến độ giảm cân',
  '記録詳細': 'Chi tiết bản ghi',
  '新規記録': 'Bản ghi mới',
  '編集': 'Sửa',
  '削除': 'Xóa',
  'キャンセル': 'Hủy',
  '閉じる': 'Đóng',
  '体重を記録': 'Ghi cân nặng',
  '体重を保存': 'Lưu cân nặng',
  '体重推移グラフ': 'Biểu đồ cân nặng',
  '記録一覧': 'Danh sách bản ghi',
  '日付': 'Ngày',
  '区分': 'Mục',
  '体重': 'Cân nặng',
  '体脂肪率': 'Mỡ cơ thể',
  'メモ': 'Ghi chú',
  'データなし': 'Không có dữ liệu',
  '日': 'ngày',
  '全期間': 'Toàn kỳ',
  '食品リスト': 'Danh sách thực phẩm',
  '行を追加': 'Thêm dòng',
  'クリア': 'Xóa nhanh',
  '目標 kcal': 'Mục tiêu kcal',
  '合計 KCAL': 'Tổng KCAL',
  'タンパク質 (g)': 'Protein (g)',
  '脂質 (g)': 'Chất béo (g)',
  '炭水化物 (g)': 'Carb (g)',
  'この食事を保存': 'Lưu bữa ăn này',
  '日別 食事サマリー': 'Tóm tắt bữa ăn theo ngày',
  '7日間カロリー推移': 'Xu hướng calo 7 ngày',
  '食事記録一覧': 'Danh sách bữa ăn',
  '全タイプ': 'Tất cả loại',
  '種別': 'Loại',
  '食品名': 'Thực phẩm',
  '量': 'Lượng',
  '操作': 'Thao tác',
  '練習を記録': 'Ghi buổi tập',
  '既存の練習記録を編集中': 'Đang sửa bản ghi tập hiện có',
  '新規入力に戻す': 'Quay lại nhập mới',
  '練習時間 (分)': 'Thời gian tập (phút)',
  '強度': 'Cường độ',
  '消費カロリー (kcal)': 'Calo tiêu hao (kcal)',
  '自動計算': 'Tự tính',
  'メモ・感想': 'Ghi chú/Cảm nhận',
  'ラウンド数': 'Số hiệp',
  'スパー相手': 'Đối tác sparring',
  'テーマ': 'Chủ đề',
  '自己評価': 'Tự đánh giá',
  '練習を保存': 'Lưu buổi tập',
  '今週のサマリー': 'Tóm tắt tuần này',
  '練習回数': 'Số buổi tập',
  '合計分': 'Tổng phút',
  '練習バランス (今週)': 'Cân bằng tập luyện (tuần này)',
  '練習カレンダー': 'Lịch tập',
  '練習記録一覧': 'Danh sách bản ghi tập',
  'BMR / TDEE 計算': 'Tính BMR / TDEE',
  '年齢': 'Tuổi',
  '性別': 'Giới tính',
  '身長 (cm)': 'Chiều cao (cm)',
  '活動レベル': 'Mức hoạt động',
  '目標': 'Mục tiêu',
  '計算する': 'Tính toán',
  '推奨 PFCバランス（ボクサー向け）': 'PFC khuyến nghị (cho boxer)',
  '摂取 vs 消費カロリー（直近7日）': 'Nạp vào vs tiêu hao (7 ngày gần nhất)',
  '練習と体重・回復の相関（直近14日）': 'Tương quan tập luyện, cân nặng và phục hồi (14 ngày)',
  '今日のカロリー収支': 'Cân bằng calo hôm nay',
  '摂取 kcal': 'Kcal nạp vào',
  '消費 kcal': 'Kcal tiêu hao',
  '収支 kcal': 'Kcal chênh lệch',
  '水分 / 発汗 / 塩分': 'Nước / Mồ hôi / Muối',
  '水分ログを保存': 'Lưu log nước',
  '睡眠 / 疲労 / 体調': 'Ngủ / Mệt mỏi / Thể trạng',
  '回復ログを保存': 'Lưu log phục hồi',
  '今日の水分サマリー': 'Tóm tắt nước hôm nay',
  '今日の回復サマリー': 'Tóm tắt phục hồi hôm nay',
  '試合目標を登録': 'Đăng ký mục tiêu trận đấu',
  '折りたたむ': 'Thu gọn',
  '展開': 'Mở rộng',
  '試合目標を保存': 'Lưu mục tiêu trận đấu',
  '減量進捗': 'Tiến độ giảm cân',
  '危険な減量診断': 'Cảnh báo giảm cân nguy hiểm',
  '減量食事プラン': 'Kế hoạch ăn kiêng giảm cân',
  '今日/次戦': 'Hôm nay/Trận kế',
  '全期間一覧': 'Danh sách toàn kỳ',
  '計画 vs 実績': 'Kế hoạch vs Thực tế',
  '試合リスト': 'Danh sách trận',
  '次の相手': 'Đối thủ kế tiếp',
  '新規登録': 'Đăng ký mới',
  '対戦相手プロフィールを編集': 'Sửa hồ sơ đối thủ',
  '対戦相手を保存': 'Lưu đối thủ',
  '対戦相手一覧': 'Danh sách đối thủ',
  '過去試合管理': 'Quản lý trận đã đấu',
  '過去試合を保存': 'Lưu trận đã đấu',
  '過去試合一覧': 'Danh sách trận đã đấu',
  '個人プロフィール設定': 'Thiết lập hồ sơ cá nhân',
  '表示名': 'Tên hiển thị',
  '肩書き': 'Vai trò',
  '目標体重 (kg)': 'Cân nặng mục tiêu (kg)',
  '既定 kcal': 'Kcal mặc định',
  '既定の食事タイプ': 'Loại bữa ăn mặc định',
  '既定の練習強度': 'Cường độ tập mặc định',
  '起動ページ': 'Trang khi mở ứng dụng',
  '目標モード': 'Chế độ mục tiêu',
  '一般減量の目標達成日': 'Ngày mục tiêu đạt cân (giảm cân thường)',
  '設定を保存': 'Lưu cài đặt',
  '保存先ステータス': 'Trạng thái lưu trữ',
  '保存先種別': 'Loại lưu trữ',
  'レコード件数': 'Số bản ghi',
  'クラウド同期 (Supabase)': 'Đồng bộ cloud (Supabase)',
  'アカウント': 'Tài khoản',
  'Google でログイン': 'Đăng nhập bằng Google',
  'この端末のデータをクラウドへマージ': 'Gộp dữ liệu thiết bị này lên cloud',
  'ログアウト': 'Đăng xuất',
  '管理者統計': 'Thống kê quản trị',
  'バックアップ / 復元': 'Sao lưu / Khôi phục',
  'JSONバックアップを保存': 'Lưu sao lưu JSON',
  'JSONから復元': 'Khôi phục từ JSON',
  '通知 / リマインダー': 'Thông báo / Nhắc nhở',
  '通知を有効化': 'Bật thông báo',
  '通知許可': 'Quyền thông báo',
  '許可をリクエスト': 'Yêu cầu quyền',
  '体重記録': 'Ghi cân nặng',
  '水分チェック': 'Kiểm tra nước',
  '睡眠 / 回復': 'Ngủ / Phục hồi',
  'AIコーチ': 'AI Coach',
  '準備中': 'Đang chuẩn bị',
  '送信': 'Gửi',
  '確認': 'Xác nhận',
  '削除する': 'Xóa',
};

let supabaseClientPromise = null;
let supabaseAuthListenerBound = false;
const DEFAULT_SETTINGS = {
  athleteName: 'Vu Minh Duc',
  athleteRole: 'SE / Pro Boxer',
  language: 'ja',
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
  goalMode: 'boxer_cut',
  fatLossTargetDate: '',
};

const APP_PAGE_IDS = ['dashboard', 'weight', 'meals', 'training', 'calories', 'fight', 'trainer', 'notifications', 'settings'];

function normalizeAppPageId(name) {
  const p = String(name == null ? '' : name).trim();
  return APP_PAGE_IDS.includes(p) ? p : 'dashboard';
}

function normalizeGoalMode(mode) {
  const value = String(mode || '').trim();
  return GOAL_MODES.includes(value) ? value : DEFAULT_SETTINGS.goalMode;
}

function normalizeLanguage(language) {
  const value = String(language || '').trim().toLowerCase();
  return SUPPORTED_LANGUAGES.includes(value) ? value : DEFAULT_SETTINGS.language;
}

function getCurrentLanguage() {
  return normalizeLanguage(appSettings?.language || DEFAULT_SETTINGS.language);
}

function getUiText(key, fallback = '') {
  const lang = getCurrentLanguage();
  const source = UI_TEXT[lang] || UI_TEXT.ja;
  const jaSource = UI_TEXT.ja;
  const parts = String(key || '').split('.');
  let current = source;
  for (const part of parts) {
    current = current?.[part];
    if (current == null) break;
  }
  if (typeof current === 'string') return current;
  let jaCurrent = jaSource;
  for (const part of parts) {
    jaCurrent = jaCurrent?.[part];
    if (jaCurrent == null) break;
  }
  if (typeof jaCurrent === 'string') return jaCurrent;
  return fallback;
}

window.getUiText = getUiText;

function normalizeOptionalIsoDate(value) {
  const text = String(value || '').trim();
  if (!text) return '';
  return isIsoDateString(text) ? text : '';
}

function getCurrentGoalMode() {
  return normalizeGoalMode(appSettings?.goalMode || DEFAULT_SETTINGS.goalMode);
}

function isFightModeEnabled() {
  return getCurrentGoalMode() === 'boxer_cut';
}

let goalModeUiRedirecting = false;
let trainerNavRedirecting = false;

function applyGoalModeUi() {
  const mode = getCurrentGoalMode();
  const boxerMode = mode === 'boxer_cut';
  const fatLossMode = mode === 'fat_loss';
  const countdownPill = document.getElementById('countdownPill');
  if (countdownPill) countdownPill.hidden = !boxerMode;

  document.querySelectorAll('.nav-item[data-page]').forEach((item) => {
    const page = item.dataset.page;
    if (trainerAccessAvailable) {
      item.style.display = page === 'trainer' || page === 'settings' ? '' : 'none';
      return;
    }
    item.style.display = page === 'trainer' ? 'none' : '';
  });
  document.querySelectorAll('.mobile-nav-btn[data-page]').forEach((btn) => {
    btn.style.display = trainerAccessAvailable ? 'none' : '';
  });

  const desktopFightNav = document.querySelector('.nav-item[data-page="fight"]');
  if (desktopFightNav && !trainerAccessAvailable) desktopFightNav.style.display = boxerMode ? '' : 'none';
  const mobileFightNav = document.querySelector('.mobile-nav-btn[data-page="fight"]');
  if (mobileFightNav && !trainerAccessAvailable) mobileFightNav.style.display = boxerMode ? '' : 'none';
  const trainerNav = document.querySelector('.nav-item[data-page="trainer"]');
  if (trainerNav) trainerNav.style.display = trainerAccessAvailable ? '' : 'none';

  const dashboardFightCard = document.querySelector('#dash-quick-anchor .dashboard-focus-card');
  if (dashboardFightCard) dashboardFightCard.style.display = boxerMode ? '' : 'none';
  const dashboardQuickRow = document.getElementById('dash-quick-anchor');
  if (dashboardQuickRow) dashboardQuickRow.classList.toggle('single-card', !boxerMode);

  const fightTabs = document.getElementById('fightSectionTabs');
  if (fightTabs) fightTabs.hidden = !boxerMode;
  ['fightSectionPanelNext', 'fightSectionPanelOpponents', 'fightSectionPanelHistory'].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.hidden = !boxerMode;
  });

  const fightGuideCard = document.getElementById('fightModeGuideCard');
  const fightGuideText = document.getElementById('fightModeGuideText');
  if (fightGuideCard) fightGuideCard.hidden = boxerMode;
  if (fightGuideText && !boxerMode) {
    fightGuideText.textContent = mode === 'fat_loss'
      ? '一般減量（安全重視）モードでは、試合・対戦相手・過去試合管理は非表示です。体重・食事・練習の継続管理に集中してください。'
      : '維持モードでは試合管理は非表示です。体重維持と回復の安定化を中心に使ってください。';
  }

  const fatLossTargetDateWrap = document.getElementById('fatLossTargetDateWrap');
  if (fatLossTargetDateWrap) {
    fatLossTargetDateWrap.style.display = fatLossMode ? '' : 'none';
  }

  const activePage = document.querySelector('.page.active')?.id || '';
  if (!boxerMode && activePage === 'page-fight' && !goalModeUiRedirecting) {
    goalModeUiRedirecting = true;
    switchPage('dashboard');
    goalModeUiRedirecting = false;
  }
  if (!trainerAccessAvailable && activePage === 'page-trainer' && !trainerNavRedirecting) {
    trainerNavRedirecting = true;
    switchPage('dashboard');
    trainerNavRedirecting = false;
  }
  if (trainerAccessAvailable && activePage !== 'page-trainer' && activePage !== 'page-settings' && !trainerNavRedirecting) {
    trainerNavRedirecting = true;
    switchPage('trainer');
    trainerNavRedirecting = false;
  }
}

// ============================================================
// FOOD DATABASE -- 120+ items (per 100g unless noted)
// CSV data from user's actual meal plan included
// ============================================================
const DEFAULT_FOOD_DB = [
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
let FOOD_DB = [...DEFAULT_FOOD_DB];

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
let opponents = [];
let fightHistory = [];
let weightLogPhotos = [];
let hydrationLogs = [];
let recoveryLogs = [];
let cuttingPlanRows = [];
let baseCuttingPlanRows = [];
let currentCutPlanTab = 'card';
let currentFightSectionTab = 'next';
let currentCalendarDate = new Date();
let pendingDeleteFn = null;
let activeStorageMode = STORAGE_MODE.CHECKING;
let storageFallbackNotified = false;
let deferredInstallPrompt = null;
let appSettings = { ...DEFAULT_SETTINGS };
let fatLossTargetDateWarning = '';
let hasInitialDataLoaded = false;
let reminderIntervalId = null;
let storageWriteWarningShown = false;
let currentAppDayKey = TODAY();
const reminderSessionStamps = new Set();

// Chart instances
let weightChartInst = null;
let weightDetailChartInst = null;
let pfcChartInst = null;
let mealPfcChartInst = null;
let weeklyTrainingChartInst = null;
let calorieBalanceChartInst = null;
let trainingWeightRecoveryChartInst = null;
let dash7dayChartInst = null;
let editingWeightId = null;
let editingTrainingId = null;
let editingOpponentId = null;
let editingOpponentPhotoStoragePath = '';
let editingOpponentPhotoUrl = '';
let isWeightComposerOpen = false;
let isOpponentComposerOpen = false;
let selectedWeightRecordId = '';
let selectedOpponentId = '';
let pendingWeightPhotoFiles = [];
let pendingOpponentPhotoFile = null;
let pendingOpponentPhotoPreviewUrl = '';
let aiCoachMessages = [];
let aiCoachPending = false;
let aiCoachOpen = false;
let trainerAthletes = [];
let selectedTrainerAthleteId = '';
let trainerInviteRenderSeq = 0;
let trainerPageRenderSeq = 0;
let trainerAccessAvailable = false;
let dashboardSectionOrderApplied = false;
let dashboardRenderTimer = null;
const DASHBOARD_RENDER_DEBOUNCE_MS = 120;

// ============================================================
// UTILITIES
// ============================================================
function formatDate(dateStr) {
  if (!dateStr) return '--';
  const d = new Date(dateStr);
  return `${d.getFullYear()}/${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getDate()).padStart(2,'0')}`;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function formatDateJP(dateStr) {
  if (!dateStr) return '--';
  const d = new Date(dateStr);
  return `${d.getFullYear()}年${d.getMonth()+1}月${d.getDate()}日`;
}

function formatDateTimeJP(dateStr) {
  if (!dateStr) return '--';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return '--';
  return `${d.getFullYear()}年${d.getMonth()+1}月${d.getDate()}日 ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function normalizeSlashDate(dateStr) {
  if (!dateStr) return '';
  const [year, month, day] = dateStr.split('/').map(Number);
  if (!year || !month || !day) return '';
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function getWeightSlotMeta(slot) {
  return WEIGHT_LOG_SLOTS.find((item) => item.value === slot) || WEIGHT_LOG_SLOTS[0];
}

function getWeightSlotLabel(slot) {
  return getWeightSlotMeta(slot).label;
}

function getWeightSlotOrder(slot) {
  return WEIGHT_LOG_SLOTS.findIndex((item) => item.value === slot);
}

function normalizeWeightLogRecord(record = {}) {
  return {
    ...record,
    slot: getWeightSlotMeta(record.slot).value,
  };
}

function sortWeightLogsInPlace() {
  weightLogs = weightLogs
    .map(normalizeWeightLogRecord)
    .sort((a, b) => {
      const dateCmp = String(a.date || '').localeCompare(String(b.date || ''));
      if (dateCmp !== 0) return dateCmp;
      return getWeightSlotOrder(a.slot) - getWeightSlotOrder(b.slot);
    });
}

function findWeightLogByDateAndSlot(date, slot) {
  return weightLogs.find((row) => row.date === date && row.slot === slot) || null;
}

function getOpponentNameById(opponentId, fallback = '') {
  const row = opponents.find((item) => item.id === opponentId);
  return row?.name || fallback || '相手未登録';
}

function getOpponentsForSelectOptions(selectedId = '') {
  const options = ['<option value="">対戦相手を選択</option>'];
  opponents
    .slice()
    .sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')))
    .forEach((op) => {
      options.push(`<option value="${escapeHtml(op.id)}"${selectedId === op.id ? ' selected' : ''}>${escapeHtml(op.name)}${op.gym ? ` / ${escapeHtml(op.gym)}` : ''}</option>`);
    });
  return options.join('');
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

function safeStorageRemoveItem(key) {
  try {
    localStorage.removeItem(key);
    return true;
  } catch (error) {
    console.error(`Storage remove failed: ${key}`, error);
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

function normalizeFoodCsvHeader(header) {
  return String(header || '')
    .trim()
    .toLowerCase()
    .replace(/[\s_（）()]/g, '');
}

function readFoodCsvValue(row, aliases = []) {
  for (const alias of aliases) {
    const key = normalizeFoodCsvHeader(alias);
    if (Object.prototype.hasOwnProperty.call(row, key) && String(row[key]).trim() !== '') {
      return String(row[key]).trim();
    }
  }
  return '';
}

function parseFoodsCsv(text) {
  const lines = String(text || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'));
  if (lines.length < 2) return [];

  const headers = parseCsvLine(lines[0]).map((h) => normalizeFoodCsvHeader(h));
  const parsed = [];

  for (let i = 1; i < lines.length; i += 1) {
    const cols = parseCsvLine(lines[i]);
    const row = {};
    headers.forEach((h, idx) => { row[h] = cols[idx] ?? ''; });

    const name = readFoodCsvValue(row, ['name', 'food_name', '食品名', '名称']);
    const cat = readFoodCsvValue(row, ['cat', 'category', 'カテゴリ', '分類']) || 'その他';
    const calRaw = readFoodCsvValue(row, ['cal', 'kcal', 'エネルギー', 'カロリー']);
    const pRaw = readFoodCsvValue(row, ['p', 'protein', 'タンパク質']);
    const fRaw = readFoodCsvValue(row, ['f', 'fat', '脂質']);
    const cRaw = readFoodCsvValue(row, ['c', 'carb', 'carbs', '炭水化物']);
    const unit = readFoodCsvValue(row, ['unit', '単位']) || 'g';
    const defaultAmtRaw = readFoodCsvValue(row, ['defaultamt', 'default_amount', '量', '既定量']);

    const cal = Number(calRaw);
    const p = Number(pRaw);
    const f = Number(fRaw);
    const c = Number(cRaw);
    const defaultAmt = Number(defaultAmtRaw);

    if (!name) continue;
    if (![cal, p, f, c].every((v) => Number.isFinite(v) && v >= 0)) continue;

    parsed.push({
      name,
      cat,
      per100: { cal, p, f, c },
      unit,
      defaultAmt: Number.isFinite(defaultAmt) && defaultAmt > 0 ? defaultAmt : 100,
    });
  }

  return parsed;
}

function getDefaultFoodDbClone() {
  return DEFAULT_FOOD_DB.map((row) => ({
    ...row,
    per100: { ...(row.per100 || {}) },
  }));
}

function mergeFoodsWithDefaults(csvFoods) {
  const merged = new Map(getDefaultFoodDbClone().map((row) => [String(row.name || ''), row]));
  csvFoods.forEach((row) => {
    if (!row?.name) return;
    merged.set(String(row.name), row);
  });
  return Array.from(merged.values());
}

async function loadFoodDatabase() {
  FOOD_DB = getDefaultFoodDbClone();
  try {
    const response = await fetch(FOODS_DB_URL, { cache: 'no-store' });
    if (!response.ok) throw new Error(`foods.csv load failed (${response.status})`);
    const text = await response.text();
    const csvFoods = parseFoodsCsv(text);
    if (!csvFoods.length) {
      console.info('BOXER PRO: foods.csv is empty or invalid, fallback to bundled FOOD_DB');
      return false;
    }
    FOOD_DB = mergeFoodsWithDefaults(csvFoods);
    console.info(`BOXER PRO: foods.csv loaded (${csvFoods.length} rows)`);
    return true;
  } catch (error) {
    console.warn('BOXER PRO: foods.csv fallback to bundled FOOD_DB', error);
    FOOD_DB = getDefaultFoodDbClone();
    return false;
  }
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
    language: normalizeLanguage(raw.language ?? DEFAULT_SETTINGS.language),
    heightCm: Number(raw.heightCm ?? DEFAULT_SETTINGS.heightCm) || DEFAULT_SETTINGS.heightCm,
    age: Number(raw.age ?? DEFAULT_SETTINGS.age) || DEFAULT_SETTINGS.age,
    dailyCalorieGoal: Number(raw.dailyCalorieGoal ?? DEFAULT_SETTINGS.dailyCalorieGoal) || DEFAULT_SETTINGS.dailyCalorieGoal,
    remindersEnabled: typeof raw.remindersEnabled === 'boolean' ? raw.remindersEnabled : DEFAULT_SETTINGS.remindersEnabled,
    landingPage: normalizeAppPageId(raw.landingPage ?? DEFAULT_SETTINGS.landingPage),
    goalMode: normalizeGoalMode(raw.goalMode ?? DEFAULT_SETTINGS.goalMode),
    fatLossTargetDate: normalizeOptionalIsoDate(raw.fatLossTargetDate ?? DEFAULT_SETTINGS.fatLossTargetDate),
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

function getUserDisplayName(user) {
  if (!user) return '';
  const meta = user.user_metadata || {};
  return meta.full_name || meta.name || meta.user_name || '';
}

function renderProfileCard(authUser = null) {
  const nameEl = document.getElementById('profileNameDisplay');
  const roleEl = document.getElementById('profileRoleDisplay');
  if (!nameEl || !roleEl) return;

  const defaultName = appSettings.athleteName || DEFAULT_SETTINGS.athleteName;
  const defaultRole = appSettings.athleteRole || DEFAULT_SETTINGS.athleteRole;
  if (!authUser) {
    nameEl.textContent = defaultName;
    roleEl.textContent = defaultRole;
    return;
  }

  const email = authUser.email || '';
  const displayName = getUserDisplayName(authUser) || (email ? email.split('@')[0] : '') || defaultName;
  nameEl.textContent = displayName;
  roleEl.textContent = email || `クラウド同期中 / ${defaultRole}`;
}

function isStandaloneDisplayMode() {
  if (typeof window === 'undefined') return false;
  return window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true;
}

function syncDisplayModeUi() {
  if (typeof document === 'undefined') return;
  document.body.classList.toggle('standalone-mode', isStandaloneDisplayMode());
}

function triggerDashboardEditorFromKey(event, mode) {
  if (event.key !== 'Enter' && event.key !== ' ') return;
  event.preventDefault();
  openDashboardEditor(mode);
}

function getLatestWeightLog() {
  return weightLogs.length ? [...weightLogs].sort((a, b) => new Date(b.date) - new Date(a.date))[0] : null;
}

function getLatestTrainingLog(dateStr = TODAY()) {
  const rows = trainingLogs
    .filter((t) => t.date && t.date.slice(0, 10) === dateStr)
    .sort((a, b) => new Date(b.created_at || b.date) - new Date(a.created_at || a.date));
  return rows[0] || null;
}

function openDashboardEditor(mode) {
  if (mode === 'weight') {
    const latest = getLatestWeightLog();
    if (latest?.id) {
      switchPage('weight');
      handleWeightRecordSelection(latest.id);
      return;
    }
    switchPage('weight');
    return;
  }

  if (mode === 'training') {
    const latest = getLatestTrainingLog();
    if (latest?.id) {
      startEditTraining(latest.id);
      return;
    }
    switchPage('training');
    const tDate = document.getElementById('t-date');
    if (tDate) tDate.value = TODAY();
    window.setTimeout(() => document.getElementById('t-type')?.focus(), 80);
    return;
  }

  if (mode === 'meals' || mode === 'protein') {
    switchPage('meals');
    const today = TODAY();
    const mealDate = document.getElementById('m-date');
    const viewDate = document.getElementById('mealViewDate');
    const filterDate = document.getElementById('mealFilterDate');
    if (mealDate) mealDate.value = today;
    if (viewDate) viewDate.value = today;
    if (filterDate) filterDate.value = today;
    loadMealSummary();
    filterMeals();
    window.setTimeout(() => {
      document.getElementById('meal-input-anchor')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      document.getElementById('foodSearch')?.focus();
    }, 80);
    return;
  }
}

function hasCoreUserData() {
  return Boolean(
    weightLogs.length
    || mealLogs.length
    || trainingLogs.length
    || fightGoals.length
    || hydrationLogs.length
    || recoveryLogs.length
  );
}

function renderDashboardOnboarding() {
  const card = document.getElementById('dashboardOnboardingCard');
  if (!card) return;

  if (hasCoreUserData()) {
    card.style.display = 'none';
    card.innerHTML = '';
    return;
  }

  card.style.display = 'block';
  card.classList.add('onboarding-card');
  card.innerHTML = `
    <div class="onboarding-head">
      <div class="onboarding-copy">
        <h3><i class="fas fa-compass"></i> 初回セットアップガイド</h3>
        <p>初めて使う人でもこの順番で入れれば、ダッシュボードの数値と分析が動き始めます。まずは基本設定と最初の記録を入れてください。</p>
      </div>
      <div class="onboarding-badge"><i class="fas fa-shield-heart"></i> ローカル保存ですぐ開始可</div>
    </div>
    <div class="onboarding-steps">
      <div class="onboarding-step">
        <div class="onboarding-step-num">1</div>
        <strong>マイ設定を入力</strong>
        <p>身長、年齢、目標体重、既定 kcal を先に入れると、BMI と推奨値の精度が上がります。</p>
      </div>
      <div class="onboarding-step">
        <div class="onboarding-step-num">2</div>
        <strong>朝か夜の体重を記録</strong>
        <p>体重は 1 日 2 枠です。まず 1 件入れると、体重推移と目標差がダッシュボードに反映されます。</p>
      </div>
      <div class="onboarding-step">
        <div class="onboarding-step-num">3</div>
        <strong>食事か練習を 1 件追加</strong>
        <p>本日 kcal、タンパク質、練習時間の KPI が埋まり、日々の判断に使える状態になります。</p>
      </div>
      <div class="onboarding-step">
        <div class="onboarding-step-num">4</div>
        <strong>必要ならクラウド同期</strong>
        <p>複数端末で使うなら、マイ設定から Google でログインし、この端末のデータを Supabase にマージします。</p>
      </div>
    </div>
    <div class="onboarding-actions">
      <button type="button" class="btn btn-primary" onclick="switchPage('settings')"><i class="fas fa-sliders"></i> マイ設定を開く</button>
      <button type="button" class="btn btn-secondary" onclick="switchPage('weight')"><i class="fas fa-weight-scale"></i> 体重を記録</button>
      <button type="button" class="btn btn-ghost" onclick="switchPage('meals')"><i class="fas fa-utensils"></i> 食事を記録</button>
    </div>
  `;
}

function applyAppSettings(force = false) {
  renderProfileCard();
  setFieldValue('w-height', appSettings.heightCm, force);
  setFieldValue('calc-height', appSettings.heightCm, force);
  setFieldValue('calc-age', appSettings.age, force);
  setFieldValue('calc-gender', appSettings.gender, force);
  setFieldValue('caloricGoalInput', appSettings.dailyCalorieGoal, force);
  setFieldValue('m-type', appSettings.defaultMealType, force);
  setFieldValue('t-intensity', appSettings.defaultTrainingIntensity, force);

  if (appSettings.targetWeight) {
    setFieldValue('w-target', appSettings.targetWeight, force);
    setFieldValue('f-target', appSettings.targetWeight, force);
  }

  if (typeof updateGoalBar === 'function') updateGoalBar();
  if (typeof updateWeightBmiPreview === 'function') updateWeightBmiPreview();
  applyGoalModeUi();
  applyLanguageUi();
}

function applyLanguageUi() {
  const lang = getCurrentLanguage();
  document.documentElement.lang = lang;
  applyDataI18nBindings();

  document.querySelectorAll('.nav-item[data-page]').forEach((item) => {
    const page = item.dataset.page;
    const label = getUiText(`navLabels.${page}`);
    const span = item.querySelector('.nav-link span');
    if (span && label) span.textContent = label;
  });

  document.querySelectorAll('.mobile-nav-btn[data-page]').forEach((btn) => {
    const page = btn.dataset.page;
    const label = getUiText(`mobileNavLabels.${page}`);
    const span = btn.querySelector('span');
    if (span && label) span.textContent = label;
  });

  const settingsTitle = document.getElementById('settings-page-title-text');
  if (settingsTitle) settingsTitle.textContent = getUiText('settings.pageTitle', settingsTitle.textContent || '');
  const settingsSubtitle = document.getElementById('settings-page-subtitle');
  if (settingsSubtitle) settingsSubtitle.textContent = getUiText('settings.pageSubtitle', settingsSubtitle.textContent || '');
  const languageLabel = document.getElementById('s-language-label');
  if (languageLabel) languageLabel.textContent = getUiText('settings.languageLabel', languageLabel.textContent || '');

  const languageSelect = document.getElementById('s-language');
  if (languageSelect) {
    const optionJa = languageSelect.querySelector('option[value="ja"]');
    const optionVi = languageSelect.querySelector('option[value="vi"]');
    if (optionJa) optionJa.textContent = getUiText('settings.languageJa', optionJa.textContent || '日本語');
    if (optionVi) optionVi.textContent = getUiText('settings.languageVi', optionVi.textContent || 'Tiếng Việt');
  }

  const landingPageSelect = document.getElementById('s-landing-page');
  if (landingPageSelect) {
    landingPageSelect.querySelectorAll('option[value]').forEach((option) => {
      const text = getUiText(`pageTitles.${option.value}`);
      if (text) option.textContent = text;
    });
  }

  const quickTitle = document.getElementById('mobileQuickTitle');
  if (quickTitle) quickTitle.textContent = getUiText('quickSheet.title', quickTitle.textContent || '');
  const quickSub = document.getElementById('mobileQuickSub');
  if (quickSub) quickSub.textContent = getUiText('quickSheet.sub', quickSub.textContent || '');
  const quickClose = document.getElementById('mobileQuickCloseBtn');
  if (quickClose) quickClose.textContent = getUiText('quickSheet.close', quickClose.textContent || '');
  const quickMap = {
    'dash-weight': 'quickSheet.weight',
    meals: 'quickSheet.meals',
    training: 'quickSheet.training',
    hydration: 'quickSheet.hydration',
    recovery: 'quickSheet.recovery',
    calories: 'quickSheet.calories',
    settings: 'quickSheet.settings',
  };
  document.querySelectorAll('.mobile-quick-tile[data-mq-action]').forEach((btn) => {
    const key = quickMap[btn.dataset.mqAction];
    if (!key) return;
    const span = btn.querySelector('span');
    const text = getUiText(key);
    if (span && text) span.textContent = text;
  });

  const activePage = document.querySelector('.page.active')?.id?.replace('page-', '') || 'dashboard';
  const topTitle = document.getElementById('topbarTitle');
  if (topTitle) topTitle.textContent = getUiText(`pageTitles.${activePage}`, topTitle.textContent || activePage);

  const pageHeaderMap = {
    'page-dashboard-title-text': lang === 'vi' ? 'Bảng điều khiển' : 'ダッシュボード',
    'page-dashboard-subtitle-text': lang === 'vi' ? 'Xem nhanh tình trạng hôm nay' : '今日のコンディションを一目で確認',
    'page-weight-title-text': lang === 'vi' ? 'Quản lý cân nặng' : '体重管理',
    'page-weight-subtitle-text': lang === 'vi' ? 'Xem bản ghi và chỉ chỉnh sửa khi cần' : '記録の確認と、必要なときだけ編集',
    'page-meals-title-text': lang === 'vi' ? 'Quản lý bữa ăn' : '食事メニュー管理',
    'page-meals-subtitle-text': lang === 'vi' ? 'Nhập tên thực phẩm để ' : '食品名を入力して ',
    'page-meals-subtitle-strong-text': lang === 'vi' ? 'tự động tính calo và PFC' : 'カロリー・PFC 自動計算',
    'page-training-title-text': lang === 'vi' ? 'Lịch tập luyện' : '練習スケジュール',
    'page-training-subtitle-text': lang === 'vi' ? 'Quản lý buổi tập, calo tiêu hao và ghi chú' : 'トレーニング記録・消費カロリー・感想レビュー管理',
    'page-calories-title-text': lang === 'vi' ? 'Tính calo' : 'カロリー計算',
    'page-calories-subtitle-text': lang === 'vi' ? 'Tính BMR/TDEE và quản lý cân bằng PFC' : 'BMR / TDEE 計算とPFCバランス管理',
    'page-fight-title-text': lang === 'vi' ? 'Quản lý mục tiêu trận đấu' : '試合目標管理',
    'page-fight-subtitle-text': lang === 'vi' ? 'Đếm ngược trận đấu và tiến độ giảm cân' : '次の試合に向けたカウントダウンと減量進捗',
    'page-trainer-title-text': lang === 'vi' ? 'HLV xem dữ liệu' : 'トレーナー閲覧',
    'page-trainer-subtitle-text': lang === 'vi' ? 'Màn hình HLV: xem võ sĩ đã cấp quyền' : 'トレーナー用画面：閲覧許可された選手の状態を確認します',
  };
  Object.entries(pageHeaderMap).forEach(([id, text]) => {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  });

  applyStaticLanguageReplacements(lang);
}

function applyDataI18nBindings() {
  const bindings = document.querySelectorAll('[data-i18n]');
  bindings.forEach((el) => {
    const key = (el.getAttribute('data-i18n') || '').trim();
    if (!key) return;
    const text = getUiText(key);
    if (text) el.textContent = text;
  });

  const placeholderBindings = document.querySelectorAll('[data-i18n-placeholder]');
  placeholderBindings.forEach((el) => {
    const key = (el.getAttribute('data-i18n-placeholder') || '').trim();
    if (!key) return;
    const text = getUiText(key);
    if (text) el.setAttribute('placeholder', text);
  });
}

function applyStaticLanguageReplacements(lang) {
  const reverseMap = Object.fromEntries(Object.entries(JA_TO_VI_TEXT).map(([ja, vi]) => [vi, ja]));
  const replaceMap = lang === 'vi' ? JA_TO_VI_TEXT : reverseMap;
  const replaceEntries = Object.entries(replaceMap).sort((a, b) => b[0].length - a[0].length);
  const roots = [
    document.querySelector('#mainWrapper'),
    document.querySelector('#sidebar'),
    document.querySelector('#aiCoachWidget'),
    document.querySelector('#mobileQuickSheet'),
    document.querySelector('.mobile-bottom-nav'),
    document.querySelector('#modalOverlay'),
  ].filter(Boolean);

  const translateText = (raw) => {
    if (!raw) return raw;
    let out = String(raw);
    replaceEntries.forEach(([from, to]) => {
      if (!from || from === to) return;
      if (!out.includes(from)) return;
      out = out.split(from).join(to);
    });
    return out;
  };

  roots.forEach((root) => {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const textNodes = [];
    while (walker.nextNode()) textNodes.push(walker.currentNode);
    textNodes.forEach((node) => {
      const raw = node.nodeValue || '';
      const next = translateText(raw);
      if (next !== raw) node.nodeValue = next;
    });

    root.querySelectorAll('[placeholder]').forEach((el) => {
      const raw = el.getAttribute('placeholder') || '';
      const next = translateText(raw);
      if (next !== raw) el.setAttribute('placeholder', next);
    });
    root.querySelectorAll('[title]').forEach((el) => {
      const raw = el.getAttribute('title') || '';
      const next = translateText(raw);
      if (next !== raw) el.setAttribute('title', next);
    });
  });

  const goalModeSelect = document.getElementById('s-goal-mode');
  if (goalModeSelect) {
    const labels = lang === 'vi'
      ? {
          boxer_cut: 'Giảm cân thi đấu (vận động viên)',
          fat_loss: 'Giảm cân thường (an toàn)',
          maintenance: 'Duy trì',
        }
      : {
          boxer_cut: '試合向け減量（競技者）',
          fat_loss: '一般減量（安全重視）',
          maintenance: '維持',
        };
    goalModeSelect.querySelectorAll('option[value]').forEach((option) => {
      const text = labels[option.value];
      if (text) option.textContent = text;
    });
  }
}

window.applyLanguageUi = applyLanguageUi;

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
  reachCm: [120, 250],
  bodyFatPct: [2, 70],
  muscleKg: [20, 150],
  targetWeightKg: [30, 220],
  opponentRecordCount: [0, 300],
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
  return !Number.isNaN(d.getTime()) && toLocalIsoDate(d) === value;
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

function parseRequiredIntBounded(raw, bounds, label) {
  const s = String(raw ?? '').trim();
  if (!s) return { ok: false, msg: `${label}を入力してください` };
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
  return weightLogs.length + weightLogPhotos.length + mealLogs.length + trainingLogs.length + fightGoals.length + opponents.length + fightHistory.length + hydrationLogs.length + recoveryLogs.length;
}

function getDailyHydration(dateStr) {
  return hydrationLogs.filter(h => h.date && h.date.slice(0, 10) === dateStr);
}

function getDailyRecovery(dateStr) {
  return recoveryLogs.filter(r => r.date && r.date.slice(0, 10) === dateStr);
}

function scrollAiChatToBottom(force = false) {
  const log = document.getElementById('ai-chat-log');
  if (!log) return;
  const threshold = 72;
  const distance = log.scrollHeight - log.clientHeight - log.scrollTop;
  const shouldScroll = force || distance <= threshold;
  if (!shouldScroll) return;
  window.requestAnimationFrame(() => {
    log.scrollTop = log.scrollHeight;
  });
}

function renderAiCoachMessages(forceScroll = false) {
  const log = document.getElementById('ai-chat-log');
  const empty = document.getElementById('ai-chat-empty');
  if (!log) return;
  if (!aiCoachMessages.length) {
    if (empty) empty.style.display = '';
    Array.from(log.querySelectorAll('.ai-chat-item')).forEach((el) => el.remove());
    return;
  }
  if (empty) empty.style.display = 'none';
  Array.from(log.querySelectorAll('.ai-chat-item')).forEach((el) => el.remove());

  const formatAiMessageHtml = (role, text) => {
    const lines = String(text || '').split('\n');
    if (role === 'user') {
      return `<p>${escapeHtml(String(text || '').trim()).replaceAll('\n', '<br>')}</p>`;
    }
    const parts = [];
    let listItems = [];
    const flushList = () => {
      if (!listItems.length) return;
      parts.push(`<ul>${listItems.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`);
      listItems = [];
    };
    lines.forEach((raw) => {
      const line = String(raw || '').trim();
      if (!line) {
        flushList();
        return;
      }
      const bullet = line.match(/^(?:[-・*]|(?:\d+[\.\)]))\s*(.+)$/);
      if (bullet) {
        listItems.push((bullet[1] || '').trim());
        return;
      }
      flushList();
      parts.push(`<p>${escapeHtml(line)}</p>`);
    });
    flushList();
    return parts.join('') || `<p>${escapeHtml(String(text || '').trim())}</p>`;
  };

  aiCoachMessages.forEach((msg) => {
    const row = document.createElement('div');
    row.className = `ai-chat-item ${msg.role === 'user' ? 'user' : 'assistant'}`;
    const roleLabel = msg.role === 'user' ? 'YOU' : 'AI';
    row.innerHTML = `
      <div class="ai-chat-badge">${roleLabel}</div>
      <div class="ai-chat-bubble">
        <div class="ai-chat-role">${msg.role === 'user' ? 'あなた' : 'AIコーチ'}</div>
        <div class="ai-chat-text ai-chat-rich">${formatAiMessageHtml(msg.role, msg.text)}</div>
      </div>
    `;
    log.appendChild(row);
  });
  scrollAiChatToBottom(forceScroll);
}

function updateAiCoachAvailability() {
  const note = document.getElementById('ai-coach-note');
  const input = document.getElementById('ai-chat-input');
  const sendBtn = document.getElementById('ai-chat-send-btn');
  const statusPill = document.getElementById('ai-chat-status-pill');
  const chips = Array.from(document.querySelectorAll('#ai-chat-suggestions .ai-suggestion-chip'));
  const fab = document.getElementById('aiCoachFab');
  if (!note || !input || !sendBtn || !statusPill) return;

  const adminAllowed = typeof window.isAiCoachAdminAllowed === 'function'
    ? window.isAiCoachAdminAllowed()
    : false;
  const canUse = activeStorageMode === STORAGE_MODE.SUPABASE
    && typeof fetchAiCoachReply === 'function'
    && adminAllowed;
  input.disabled = !canUse || aiCoachPending;
  sendBtn.disabled = !canUse || aiCoachPending;
  chips.forEach((chip) => { chip.disabled = !canUse || aiCoachPending; });
  note.textContent = canUse
    ? '記録をもとに、今日と明日の実行案を返します。'
    : '';
  note.style.display = canUse ? 'block' : 'none';
  input.placeholder = canUse
    ? '例: 今日の食事と練習を見て、明日の修正点を3つだけ教えて'
    : '管理者限定';

  statusPill.classList.remove('ready', 'busy', 'locked');
  if (!canUse) {
    statusPill.classList.add('locked');
    statusPill.textContent = '管理者限定';
  } else if (aiCoachPending) {
    statusPill.classList.add('busy');
    statusPill.textContent = '解析中';
  } else {
    statusPill.classList.add('ready');
    statusPill.textContent = '利用可能';
  }

  sendBtn.innerHTML = aiCoachPending
    ? '<i class="fas fa-spinner fa-spin"></i> 解析中...'
    : '<i class="fas fa-paper-plane"></i> 送信';
  if (fab) {
    fab.classList.toggle('is-busy', aiCoachPending);
    fab.classList.toggle('is-locked', !canUse);
  }
}

function clearAiCoachChat() {
  aiCoachMessages = [];
  renderAiCoachMessages(true);
}

function setAiCoachWidgetOpen(open) {
  aiCoachOpen = !!open;
  const widget = document.getElementById('aiCoachWidget');
  const backdrop = document.getElementById('aiCoachBackdrop');
  const fab = document.getElementById('aiCoachFab');
  if (!widget || !backdrop || !fab) return;
  widget.hidden = !aiCoachOpen;
  backdrop.hidden = !aiCoachOpen;
  fab.classList.toggle('is-open', aiCoachOpen);
  fab.setAttribute('aria-expanded', aiCoachOpen ? 'true' : 'false');
  if (aiCoachOpen) {
    updateAiCoachAvailability();
    renderAiCoachMessages(true);
    if (typeof window.refreshAiCoachAdminAccess === 'function') {
      window.refreshAiCoachAdminAccess()
        .catch(() => false)
        .finally(() => updateAiCoachAvailability());
    }
    window.setTimeout(() => document.getElementById('ai-chat-input')?.focus(), 40);
  }
}

function toggleAiCoachWidget() {
  setAiCoachWidgetOpen(!aiCoachOpen);
}

function closeAiCoachWidget() {
  setAiCoachWidgetOpen(false);
}

function useAiCoachSuggestion(btn) {
  const input = document.getElementById('ai-chat-input');
  if (!btn || !input) return;
  input.value = String(btn.textContent || '').trim();
  input.focus();
}

function handleAiCoachInputKeydown(event) {
  if (!event) return;
  if (event.key !== 'Enter' || event.shiftKey) return;
  event.preventDefault();
  sendAiCoachQuestion();
}

async function sendAiCoachQuestion() {
  const input = document.getElementById('ai-chat-input');
  if (!input) return;
  const question = input.value.trim();
  if (!question) {
    showToast('質問を入力してください', 'info');
    return;
  }
  if (question.length > 1000) {
    showToast('質問は1000文字以内で入力してください', 'error');
    return;
  }
  if (activeStorageMode !== STORAGE_MODE.SUPABASE) {
    showToast('クラウドログイン中のみ利用できます', 'error');
    return;
  }
  if (!(typeof window.isAiCoachAdminAllowed === 'function' && window.isAiCoachAdminAllowed())) {
    showToast('AIコーチは管理者アカウントのみ利用できます', 'error');
    return;
  }
  if (aiCoachPending) return;

  aiCoachMessages.push({ role: 'user', text: question });
  renderAiCoachMessages(true);
  input.value = '';
  aiCoachPending = true;
  updateAiCoachAvailability();

  try {
    const answer = await fetchAiCoachReply(question);
    aiCoachMessages.push({ role: 'assistant', text: answer });
    renderAiCoachMessages(true);
  } catch (error) {
    console.error('BOXER PRO: AI coach', error);
    showToast(`AI応答に失敗しました: ${error?.message || 'unknown error'}`, 'error');
  } finally {
    aiCoachPending = false;
    updateAiCoachAvailability();
  }
}

function getTrainerAthleteName(row) {
  const settings = row?.profile?.settings && typeof row.profile.settings === 'object' ? row.profile.settings : {};
  return settings.athleteName || `選手 ${String(row?.athlete_user_id || '').slice(0, 8)}`;
}

function getTrainerAthleteMeta(row) {
  const settings = row?.profile?.settings && typeof row.profile.settings === 'object' ? row.profile.settings : {};
  const role = settings.athleteRole || 'Boxer';
  const lastSeen = row?.profile?.last_seen_at ? `最終利用 ${formatDate(row.profile.last_seen_at)}` : '最終利用 --';
  return `${role} / ${lastSeen}`;
}

function getTrainerAthleteInitials(row) {
  const name = getTrainerAthleteName(row).replace(/^選手\s*/, '').trim();
  if (!name) return 'BP';
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0] || ''}${parts[1][0] || ''}`.toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

function getTrainerInviteStatusMeta(status) {
  switch (String(status || '').toLowerCase()) {
    case 'pending':
      return { label: '招待中', className: 'status-pending', note: 'トレーナーの承認待ち' };
    case 'accepted':
      return { label: '承認済み', className: 'status-accepted', note: 'トレーナーが閲覧可能' };
    case 'revoked':
      return { label: '解除済み', className: 'status-revoked', note: '閲覧できません' };
    default:
      return { label: '不明', className: 'status-unknown', note: '--' };
  }
}

function syncTrainerNavVisibility(athletes = trainerAthletes) {
  trainerAccessAvailable = activeStorageMode === STORAGE_MODE.SUPABASE && Array.isArray(athletes) && athletes.length > 0;
  if (!trainerAccessAvailable) {
    selectedTrainerAthleteId = '';
  }
  if (typeof window.setCurrentUserCapabilities === 'function') {
    const caps = typeof window.getCurrentUserCapabilities === 'function'
      ? window.getCurrentUserCapabilities()
      : {};
    const roles = Array.isArray(caps.roles) ? caps.roles : [];
    window.setCurrentUserCapabilities({
      isTrainer: trainerAccessAvailable || roles.includes('trainer'),
      isAthlete: roles.includes('athlete') || (!trainerAccessAvailable && !roles.length),
    });
  }
  if (trainerAccessAvailable) {
    ['settings-storage-card', 'admin-stats-card'].forEach((id) => {
      const card = document.getElementById(id);
      if (card) card.hidden = true;
    });
  }
  applySettingsCapabilityVisibility();
  applyGoalModeUi();
}

function isTrainerAccessActive() {
  return !!trainerAccessAvailable;
}

if (typeof window !== 'undefined') {
  window.isTrainerAccessActive = isTrainerAccessActive;
}

async function refreshTrainerNavAccess() {
  if (activeStorageMode !== STORAGE_MODE.SUPABASE) {
    trainerAthletes = [];
    syncTrainerNavVisibility([]);
    return false;
  }
  try {
    trainerAthletes = await fetchTrainerAthletes();
    syncTrainerNavVisibility(trainerAthletes);
    return trainerAccessAvailable;
  } catch (error) {
    console.error('BOXER PRO: refresh trainer nav access', error);
    trainerAthletes = [];
    syncTrainerNavVisibility([]);
    return false;
  }
}

async function renderTrainerInvitePanel() {
  const list = document.getElementById('trainerInviteList');
  const card = document.getElementById('trainer-invite-card');
  if (!list || !card) return;
  const seq = trainerInviteRenderSeq + 1;
  trainerInviteRenderSeq = seq;
  if (activeStorageMode !== STORAGE_MODE.SUPABASE) {
    list.innerHTML = '<div class="settings-note">選手本人がクラウドログインすると、ここでトレーナーのGoogleメールを登録できます。</div>';
    return;
  }

  list.innerHTML = '<div class="settings-note">読み込み中...</div>';
  try {
    const links = await fetchAthleteTrainerLinks();
    if (seq !== trainerInviteRenderSeq) return;
    if (!links.length) {
      list.innerHTML = '<div class="settings-note">まだトレーナー招待はありません。上の入力欄にトレーナーのGoogleメールを入れてください。</div>';
      return;
    }
    list.innerHTML = links.map((link) => {
      const meta = getTrainerInviteStatusMeta(link.status);
      const canRevoke = link.status === 'pending' || link.status === 'accepted';
      return `
      <div class="stat-card trainer-invite-status-card ${escapeHtml(meta.className)}" style="text-align:left">
        <div class="stat-label">${escapeHtml(meta.label)}</div>
        <div class="stat-val" style="font-size:18px">${escapeHtml(link.trainer_email)}</div>
        <div class="stat-sub">${escapeHtml(meta.note)} / ${escapeHtml(formatDateTimeJP(link.accepted_at || link.created_at))}</div>
        ${canRevoke ? `
          <button type="button" class="btn btn-sm btn-danger" style="margin-top:8px" onclick="removeTrainerInviteFromSettings('${escapeHtml(link.id)}')">
            <i class="fas fa-user-xmark"></i> 招待を解除
          </button>
        ` : ''}
      </div>
    `;
    }).join('');
  } catch (error) {
    console.error('BOXER PRO: trainer invite list', error);
    list.innerHTML = '<div class="settings-note">トレーナー許可一覧を取得できませんでした。</div>';
  }
}

async function renderAthleteTrainerNotesPanel() {
  const card = document.getElementById('athlete-trainer-notes-card');
  const list = document.getElementById('athleteTrainerNotesList');
  if (!card || !list) return;
  const caps = getEffectiveUserCapabilities();
  const shouldShow = activeStorageMode === STORAGE_MODE.SUPABASE && !trainerAccessAvailable && caps.isAthlete !== false;
  card.hidden = !shouldShow;
  if (!shouldShow) {
    list.innerHTML = '';
    return;
  }
  list.innerHTML = '<div class="settings-note">コメントを読み込み中...</div>';
  try {
    const notes = await fetchCurrentAthleteTrainerNotes();
    updateTrainerNotificationBadge(notes);
    if (!notes.length) {
      list.innerHTML = '<div class="settings-note">まだトレーナーからのコメントはありません。</div>';
      return;
    }
    list.innerHTML = notes.slice(0, 3).map((note) => `
      <div class="trainer-note-item">
        <div class="trainer-note-head">
          <span><i class="fas fa-comment-dots"></i> ${escapeHtml(getTrainerNoteSenderName(note))} / ${escapeHtml(formatDateTimeJP(note.created_at))}</span>
        </div>
        <div class="trainer-note-body">${escapeHtml(note.note || '')}</div>
      </div>
    `).join('') + (notes.length > 3 ? '<div class="settings-note">続きは通知一覧で確認できます。</div>' : '');
  } catch (error) {
    console.error('BOXER PRO: athlete trainer notes', error);
    list.innerHTML = '<div class="settings-note">トレーナーコメントを取得できませんでした。Supabase migration 004 が適用済みか確認してください。</div>';
  }
}

function getTrainerNoteSenderName(note) {
  const name = String(note?.trainer_display_name || '').trim();
  return name || 'トレーナー';
}

function getTrainerNotificationReadIds() {
  try {
    const raw = localStorage.getItem('boxerTrainerNoteReadIds');
    const parsed = JSON.parse(raw || '[]');
    return new Set(Array.isArray(parsed) ? parsed.map(String) : []);
  } catch (error) {
    return new Set();
  }
}

function saveTrainerNotificationReadIds(ids) {
  try {
    localStorage.setItem('boxerTrainerNoteReadIds', JSON.stringify([...ids].slice(-300)));
  } catch (error) {
    console.warn('BOXER PRO: save notification read ids', error);
  }
}

function updateTrainerNotificationBadge(notes = null) {
  const badge = document.getElementById('navNotificationBadge');
  if (!badge) return;
  if (!Array.isArray(notes)) {
    badge.style.display = 'none';
    return;
  }
  const readIds = getTrainerNotificationReadIds();
  const unreadCount = notes.filter((note) => note?.id && !readIds.has(String(note.id))).length;
  badge.textContent = String(unreadCount);
  badge.style.display = unreadCount > 0 ? '' : 'none';
}

function renderTrainerNotificationCards(notes = []) {
  const readIds = getTrainerNotificationReadIds();
  return notes.map((note) => {
    const unread = note?.id && !readIds.has(String(note.id));
    const senderName = getTrainerNoteSenderName(note);
    return `
      <div class="trainer-notification-item ${unread ? 'is-unread' : 'is-read'}">
        <div class="trainer-notification-marker"><i class="fas ${unread ? 'fa-bell' : 'fa-check'}"></i></div>
        <div class="trainer-notification-content">
          <div class="trainer-notification-head">
            <span class="trainer-notification-title">${escapeHtml(senderName)} からの${unread ? '新しいコメント' : 'コメント'}</span>
            <span class="trainer-notification-date">${escapeHtml(formatDateTimeJP(note.created_at))}</span>
          </div>
          <div class="trainer-notification-body">${escapeHtml(note.note || '')}</div>
        </div>
      </div>
    `;
  }).join('');
}

async function renderNotificationsPage() {
  const list = document.getElementById('trainerNotificationList');
  const pill = document.getElementById('trainerNotificationCountPill');
  if (!list) return;
  if (activeStorageMode !== STORAGE_MODE.SUPABASE) {
    list.innerHTML = '<div class="settings-note">通知を見るにはクラウドログインが必要です。</div>';
    if (pill) pill.innerHTML = '<i class="fas fa-bell"></i> -- 件';
    updateTrainerNotificationBadge([]);
    return;
  }
  if (trainerAccessAvailable) {
    list.innerHTML = '<div class="settings-note">トレーナー閲覧中は、選手本人向けの通知一覧は表示しません。</div>';
    if (pill) pill.innerHTML = '<i class="fas fa-bell"></i> -- 件';
    updateTrainerNotificationBadge([]);
    return;
  }

  list.innerHTML = '<div class="settings-note">通知を読み込み中...</div>';
  try {
    const notes = await fetchCurrentAthleteTrainerNotes();
    const readIds = getTrainerNotificationReadIds();
    const unreadCount = notes.filter((note) => note?.id && !readIds.has(String(note.id))).length;
    updateTrainerNotificationBadge(notes);
    if (pill) pill.innerHTML = `<i class="fas fa-bell"></i> 未読 ${unreadCount}件 / 全${notes.length}件`;
    if (!notes.length) {
      list.innerHTML = '<div class="trainer-notification-empty"><i class="fas fa-inbox"></i><strong>通知はありません</strong><span>トレーナーがコメントを保存すると、ここに一覧表示されます。</span></div>';
      return;
    }
    list.innerHTML = renderTrainerNotificationCards(notes);
  } catch (error) {
    console.error('BOXER PRO: render notifications page', error);
    list.innerHTML = '<div class="settings-note">通知を取得できませんでした。Supabase migration 004/005 が適用済みか確認してください。</div>';
  }
}

async function markAllTrainerNotificationsRead() {
  try {
    const notes = await fetchCurrentAthleteTrainerNotes();
    const readIds = getTrainerNotificationReadIds();
    notes.forEach((note) => {
      if (note?.id) readIds.add(String(note.id));
    });
    saveTrainerNotificationReadIds(readIds);
    updateTrainerNotificationBadge(notes);
    await renderNotificationsPage();
    showToast('トレーナーコメントを既読にしました', 'success');
  } catch (error) {
    console.error('BOXER PRO: mark notifications read', error);
    showToast('既読にできませんでした', 'error');
  }
}

async function saveTrainerInviteFromSettings() {
  const input = document.getElementById('trainerInviteEmail');
  const email = input?.value || '';
  try {
    await saveTrainerInvite(email);
    if (input) input.value = '';
    await renderTrainerInvitePanel();
    showToast('トレーナーに招待を送信しました', 'success');
  } catch (error) {
    console.error('BOXER PRO: save trainer invite', error);
    showToast(error?.message || 'トレーナー許可に失敗しました', 'error');
  }
}

async function removeTrainerInviteFromSettings(linkId) {
  showModal('招待を解除', 'このトレーナー招待または閲覧権限を解除しますか？', async () => {
    try {
      await deleteTrainerInvite(linkId);
      await renderTrainerInvitePanel();
      showToast('トレーナー招待を解除しました', 'info');
    } catch (error) {
      console.error('BOXER PRO: delete trainer invite', error);
      showToast('解除に失敗しました', 'error');
    }
  });
}

function renderTrainerInviteRequests(requests = []) {
  const card = document.getElementById('trainerInviteRequestsCard');
  const list = document.getElementById('trainerInviteRequestsList');
  if (!card || !list) return;
  card.style.display = requests.length ? '' : 'none';
  if (!requests.length) {
    list.innerHTML = '';
    return;
  }
  list.innerHTML = requests.map((invite) => `
    <div class="trainer-athlete-card trainer-invite-request-card">
      <div class="trainer-athlete-avatar"><i class="fas fa-envelope"></i></div>
      <div class="trainer-athlete-info">
        <div class="trainer-athlete-status">承認待ち</div>
        <div class="trainer-athlete-name">選手 ${escapeHtml(String(invite.athlete_user_id || '').slice(0, 8))}</div>
        <div class="trainer-athlete-meta">受信: ${escapeHtml(formatDateTimeJP(invite.created_at))}</div>
      </div>
      <div class="trainer-athlete-actions">
        <button type="button" class="btn btn-sm btn-primary" onclick="acceptTrainerInviteFromPage('${escapeHtml(invite.id)}')">
          <i class="fas fa-check"></i> 承認
        </button>
        <button type="button" class="btn btn-sm btn-ghost" onclick="declineTrainerInviteFromPage('${escapeHtml(invite.id)}')">
          <i class="fas fa-xmark"></i> 辞退
        </button>
      </div>
    </div>
  `).join('');
}

async function acceptTrainerInviteFromPage(linkId) {
  try {
    await acceptTrainerInvite(linkId);
    showToast('招待を承認しました', 'success');
    await refreshTrainerNavAccess();
    await renderTrainerPage();
  } catch (error) {
    console.error('BOXER PRO: accept trainer invite', error);
    showToast(error?.message || '招待を承認できませんでした', 'error');
  }
}

async function declineTrainerInviteFromPage(linkId) {
  showModal('招待を辞退', 'このトレーナー招待を辞退しますか？', async () => {
    try {
      await revokeTrainerInvite(linkId);
      showToast('招待を辞退しました', 'info');
      await renderTrainerPage();
    } catch (error) {
      console.error('BOXER PRO: decline trainer invite', error);
      showToast(error?.message || '招待を辞退できませんでした', 'error');
    }
  });
}

function renderTrainerAthleteList() {
  const list = document.getElementById('trainerAthleteList');
  if (!list) return;
  if (!trainerAthletes.length) {
    list.innerHTML = '<div class="settings-note">担当選手はまだいません。選手側の「マイ設定 > トレーナー閲覧許可」で、あなたのGoogleメールを登録してもらってください。</div>';
    return;
  }
  list.innerHTML = trainerAthletes.map((row) => {
    const athleteId = row.athlete_user_id;
    const active = athleteId === selectedTrainerAthleteId;
    return `
      <div class="trainer-athlete-card ${active ? 'is-active' : ''}" role="button" tabindex="0" onclick="selectTrainerAthlete('${escapeHtml(athleteId)}')" onkeydown="if(event.key === 'Enter' || event.key === ' '){ event.preventDefault(); selectTrainerAthlete('${escapeHtml(athleteId)}'); }">
        <div class="trainer-athlete-avatar">${escapeHtml(getTrainerAthleteInitials(row))}</div>
        <div class="trainer-athlete-info">
          <div class="trainer-athlete-status">${active ? '選択中' : '担当選手'}</div>
          <div class="trainer-athlete-name">${escapeHtml(getTrainerAthleteName(row))}</div>
          <div class="trainer-athlete-meta">${escapeHtml(getTrainerAthleteMeta(row))}</div>
        </div>
        <div class="trainer-athlete-actions">
          <span class="trainer-athlete-view"><i class="fas fa-chevron-right"></i></span>
          <button type="button" class="trainer-athlete-remove" title="担当から外す" onclick="event.stopPropagation(); removeTrainerAthlete('${escapeHtml(row.id)}')">
            <i class="fas fa-user-minus"></i>
          </button>
        </div>
      </div>
    `;
  }).join('');
}

function renderTrainerEmptyData(message) {
  setText('trainerSelectedName', '--');
  setText('trainerSelectedMeta', message || '未選択');
  setText('trainerSelectedAvatar', '--');
  setText('trainerLatestWeight', '-- kg');
  setText('trainerLatestWeightDate', '--');
  setText('trainerRecordCounts', '--');
  ['trainerAlertSection', 'trainerNotesSection'].forEach((id) => {
    const section = document.getElementById(id);
    if (section) section.style.display = 'none';
  });
  const alertList = document.getElementById('trainerAlertList');
  if (alertList) alertList.innerHTML = `<div class="settings-note">${escapeHtml(message || '担当選手を選択してください')}</div>`;
  const notesList = document.getElementById('trainerNotesList');
  if (notesList) notesList.innerHTML = '';
  const noteInput = document.getElementById('trainerNoteInput');
  if (noteInput) noteInput.value = '';
  const tbody = document.getElementById('trainerWeightTableBody');
  if (tbody) tbody.innerHTML = `<tr><td colspan="7" class="empty-cell">${escapeHtml(message || '担当選手を選択してください')}</td></tr>`;
}

async function buildTrainerWeightPhotoMap(photos = []) {
  const photoMap = new Map();
  await Promise.all((photos || []).map(async (photo) => {
    if (!photo?.weight_log_id || !photo?.storage_path) return;
    const url = await getWeightPhotoSignedUrl(photo.storage_path);
    if (!url) return;
    const current = photoMap.get(photo.weight_log_id) || [];
    current.push({
      ...photo,
      signed_url: url,
    });
    photoMap.set(photo.weight_log_id, current);
  }));
  photoMap.forEach((rows) => {
    rows.sort((a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0));
  });
  return photoMap;
}

function renderTrainerWeightPhotoCell(photos = []) {
  if (!photos.length) return '--';
  const first = photos[0];
  const extra = photos.length > 1 ? `<span class="table-subnote">+${photos.length - 1}枚</span>` : '';
  return `
    <a href="${escapeHtml(first.signed_url)}" target="_blank" rel="noopener" title="体重写真を開く" class="trainer-photo-link">
      <img src="${escapeHtml(first.signed_url)}" alt="体重写真" class="trainer-photo-thumb">
      ${extra}
    </a>
  `;
}

function parseTrainerLogDate(value) {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  parsed.setHours(0, 0, 0, 0);
  return parsed;
}

function getTrainerDaysBetween(from, to = new Date()) {
  const fromDate = parseTrainerLogDate(from);
  if (!fromDate) return null;
  const toDate = parseTrainerLogDate(to);
  if (!toDate) return null;
  return Math.round((toDate.getTime() - fromDate.getTime()) / 86400000);
}

function buildTrainerDangerAlerts(weights = [], snapshot = {}) {
  const alerts = [];
  const sortedWeights = [...weights]
    .filter((row) => row?.date && row?.weight != null)
    .sort((a, b) => new Date(a.date) - new Date(b.date));
  const latest = sortedWeights[sortedWeights.length - 1] || null;
  const previous = sortedWeights[sortedWeights.length - 2] || null;

  if (!latest) {
    return [{
      level: 'info',
      title: '体重ログなし',
      body: 'まだ体重記録がありません。初回記録を選手に依頼してください。',
      icon: 'fa-circle-info',
    }];
  }

  const daysSinceWeight = getTrainerDaysBetween(latest.date);
  if (daysSinceWeight != null && daysSinceWeight >= 4) {
    alerts.push({
      level: 'warning',
      title: '体重記録が止まっています',
      body: `最新の体重記録から${daysSinceWeight}日経過しています。減量期は記録頻度を確認してください。`,
      icon: 'fa-clock',
    });
  }

  if (previous?.weight != null && latest?.weight != null) {
    const diffKg = Number(latest.weight) - Number(previous.weight);
    const diffPct = Number(previous.weight) ? (diffKg / Number(previous.weight)) * 100 : 0;
    if (diffKg <= -1.0 || diffPct <= -1.5) {
      alerts.push({
        level: 'danger',
        title: '急な体重減少',
        body: `前回から${Math.abs(diffKg).toFixed(1)}kg減っています。脱水・食事不足・疲労の確認が必要です。`,
        icon: 'fa-triangle-exclamation',
      });
    }
    if (diffKg >= 1.5) {
      alerts.push({
        level: 'warning',
        title: '急な体重増加',
        body: `前回から${diffKg.toFixed(1)}kg増えています。食事・水分・測定タイミングを確認してください。`,
        icon: 'fa-arrow-trend-up',
      });
    }
  }

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const baseline = [...sortedWeights].reverse().find((row) => {
    const rowDate = parseTrainerLogDate(row.date);
    return rowDate && rowDate <= sevenDaysAgo;
  });
  if (baseline?.weight != null && latest?.weight != null) {
    const weeklyDiffKg = Number(latest.weight) - Number(baseline.weight);
    const weeklyDiffPct = Number(baseline.weight) ? (weeklyDiffKg / Number(baseline.weight)) * 100 : 0;
    if (weeklyDiffPct <= -3) {
      alerts.push({
        level: 'danger',
        title: '7日間の減量ペースが速い',
        body: `約7日で${Math.abs(weeklyDiffPct).toFixed(1)}%減少しています。安全な減量計画か確認してください。`,
        icon: 'fa-fire-flame-curved',
      });
    }
  }

  const recentMeals = (snapshot.meals || []).filter((meal) => {
    const days = getTrainerDaysBetween(meal?.date);
    return days != null && days <= 2;
  });
  if (!recentMeals.length) {
    alerts.push({
      level: 'warning',
      title: '食事記録が少ない',
      body: '直近2日間の食事記録がありません。体重変化の理由を判断しにくい状態です。',
      icon: 'fa-utensils',
    });
  }

  const recentTraining = (snapshot.training_logs || []).filter((log) => {
    const days = getTrainerDaysBetween(log?.date);
    return days != null && days <= 2;
  });
  if (recentTraining.length >= 2 && previous?.weight != null && latest?.weight != null && Number(latest.weight) < Number(previous.weight)) {
    alerts.push({
      level: 'warning',
      title: '練習量と体重減少を確認',
      body: '直近の練習記録が多く、体重も下がっています。回復・睡眠・水分補給を確認してください。',
      icon: 'fa-heart-pulse',
    });
  }

  if (!alerts.length) {
    alerts.push({
      level: 'ok',
      title: '大きな危険サインはありません',
      body: '体重変化と記録状況から見る限り、今すぐ注意すべきアラートはありません。',
      icon: 'fa-shield-heart',
    });
  }
  return alerts;
}

function renderTrainerDangerAlerts(alerts = []) {
  const section = document.getElementById('trainerAlertSection');
  const list = document.getElementById('trainerAlertList');
  if (section) section.style.display = selectedTrainerAthleteId ? '' : 'none';
  if (!list) return;
  list.innerHTML = alerts.map((alert) => `
    <div class="trainer-alert-item trainer-alert-${escapeHtml(alert.level || 'info')}">
      <div class="trainer-alert-icon"><i class="fas ${escapeHtml(alert.icon || 'fa-circle-info')}"></i></div>
      <div>
        <div class="trainer-alert-title">${escapeHtml(alert.title || 'アラート')}</div>
        <div class="trainer-alert-body">${escapeHtml(alert.body || '')}</div>
      </div>
    </div>
  `).join('');
}

function renderTrainerNotes(notes = []) {
  const section = document.getElementById('trainerNotesSection');
  const list = document.getElementById('trainerNotesList');
  if (section) section.style.display = selectedTrainerAthleteId ? '' : 'none';
  if (!list) return;
  if (!notes.length) {
    list.innerHTML = '<div class="settings-note">まだコメントはありません。気づいた点を保存すると、選手ごとに履歴として残せます。</div>';
    return;
  }
  list.innerHTML = notes.map((note) => `
    <div class="trainer-note-item">
      <div class="trainer-note-head">
        <span><i class="fas fa-note-sticky"></i> ${escapeHtml(getTrainerNoteSenderName(note))} / ${escapeHtml(formatDateTimeJP(note.created_at))}</span>
        <button type="button" class="trainer-note-delete" title="コメントを削除" onclick="deleteTrainerNoteFromPage('${escapeHtml(note.id)}')">
          <i class="fas fa-trash"></i>
        </button>
      </div>
      <div class="trainer-note-body">${escapeHtml(note.note || '')}</div>
    </div>
  `).join('');
}

async function renderTrainerAthleteData() {
  const section = document.getElementById('trainerWeightSection');
  if (section) section.style.display = selectedTrainerAthleteId ? '' : 'none';
  if (!selectedTrainerAthleteId) {
    renderTrainerEmptyData('担当選手を選択してください');
    return;
  }

  const athlete = trainerAthletes.find((row) => row.athlete_user_id === selectedTrainerAthleteId) || null;
  setText('trainerSelectedName', athlete ? getTrainerAthleteName(athlete) : '--');
  setText('trainerSelectedMeta', athlete ? getTrainerAthleteMeta(athlete) : selectedTrainerAthleteId);
  setText('trainerSelectedAvatar', athlete ? getTrainerAthleteInitials(athlete) : '--');
  const tbody = document.getElementById('trainerWeightTableBody');
  if (tbody) tbody.innerHTML = '<tr><td colspan="7" class="empty-cell">読み込み中...</td></tr>';
  renderTrainerDangerAlerts([{
    level: 'info',
    title: '判定中',
    body: '選手データを読み込んで危険アラートを確認しています。',
    icon: 'fa-spinner',
  }]);
  renderTrainerNotes([]);

  try {
    const snapshot = await fetchTrainerAthleteSnapshot(selectedTrainerAthleteId);
    const weights = (snapshot.weight_logs || []).map(normalizeWeightLogRecord);
    weights.sort((a, b) => new Date(a.date) - new Date(b.date));
    const latest = weights.length ? weights[weights.length - 1] : null;
    setText('trainerLatestWeight', latest?.weight != null ? `${latest.weight} kg` : '-- kg');
    setText('trainerLatestWeightDate', latest?.date ? `${formatDate(latest.date)} ${getWeightSlotLabel(latest.slot)}` : '--');
    setText('trainerRecordCounts', `体重 ${weights.length}件 / 食事 ${(snapshot.meals || []).length}件 / 練習 ${(snapshot.training_logs || []).length}件`);
    renderTrainerDangerAlerts(buildTrainerDangerAlerts(weights, snapshot));
    renderTrainerNotes(snapshot.trainer_notes || []);

    if (!tbody) return;
    if (!weights.length) {
      tbody.innerHTML = '<tr><td colspan="7" class="empty-cell">体重ログはまだありません</td></tr>';
      return;
    }
    const photoMap = await buildTrainerWeightPhotoMap(snapshot.weight_log_photos || []);
    const activeHeight = Number(latest?.height_cm) || Number(athlete?.profile?.settings?.heightCm) || DEFAULT_SETTINGS.heightCm;
    tbody.innerHTML = [...weights].reverse().map((w) => `
      <tr class="trainer-log-row">
        <td data-label="日付">
          <div class="trainer-log-date">
            <span>${escapeHtml(formatDate(w.date))}</span>
            <button type="button" class="trainer-log-toggle" aria-expanded="false" onclick="toggleTrainerLogRow(this)">
              詳細 <i class="fas fa-chevron-down" aria-hidden="true"></i>
            </button>
          </div>
        </td>
        <td data-label="区分"><span class="badge">${escapeHtml(getWeightSlotLabel(w.slot))}</span></td>
        <td data-label="体重"><strong>${escapeHtml(w.weight)} kg</strong></td>
        <td data-label="BMI">${calculateBMI(w.weight, w.height_cm || activeHeight)?.toFixed(1) || '--'}</td>
        <td data-label="体脂肪率">${w.body_fat ? `${escapeHtml(w.body_fat)} %` : '--'}</td>
        <td data-label="写真">${renderTrainerWeightPhotoCell(photoMap.get(w.id) || [])}</td>
        <td data-label="メモ">${escapeHtml(w.note || '--')}</td>
      </tr>
    `).join('');
  } catch (error) {
    console.error('BOXER PRO: trainer athlete data', error);
    renderTrainerEmptyData('選手データを取得できませんでした。閲覧許可またはSupabase RLSを確認してください。');
  }
}

async function saveTrainerNoteFromPage() {
  const input = document.getElementById('trainerNoteInput');
  const note = input?.value || '';
  if (!selectedTrainerAthleteId) {
    showToast('先に選手を選択してください', 'warning');
    return;
  }
  try {
    await saveTrainerNoteForAthlete(selectedTrainerAthleteId, note);
    if (input) input.value = '';
    await renderTrainerAthleteData();
    showToast('コメントを保存しました', 'success');
  } catch (error) {
    console.error('BOXER PRO: save trainer note', error);
    showToast(error?.message || 'コメントを保存できませんでした', 'error');
  }
}

async function deleteTrainerNoteFromPage(noteId) {
  showModal('コメントを削除', 'このコメントを削除しますか？', async () => {
    try {
      await deleteTrainerNote(noteId);
      await renderTrainerAthleteData();
      showToast('コメントを削除しました', 'info');
    } catch (error) {
      console.error('BOXER PRO: delete trainer note', error);
      showToast(error?.message || 'コメントを削除できませんでした', 'error');
    }
  });
}

function toggleTrainerLogRow(buttonEl) {
  const row = buttonEl?.closest?.('.trainer-log-row');
  if (!row) return;
  const expanded = row.classList.toggle('is-expanded');
  buttonEl.setAttribute('aria-expanded', expanded ? 'true' : 'false');
  buttonEl.innerHTML = `${expanded ? '閉じる' : '詳細'} <i class="fas ${expanded ? 'fa-chevron-up' : 'fa-chevron-down'}" aria-hidden="true"></i>`;
}

window.toggleTrainerLogRow = toggleTrainerLogRow;

function setTrainerSectionCollapsed(sectionId, collapsed) {
  const section = document.getElementById(sectionId);
  if (!section) return;
  section.classList.toggle('is-collapsed', !!collapsed);
  const button = document.querySelector(`.collapse-toggle[onclick*="${sectionId}"]`);
  if (!button) return;
  const icon = collapsed ? 'fa-chevron-down' : 'fa-chevron-up';
  button.innerHTML = `<i class="fas ${icon}" aria-hidden="true"></i>`;
  button.setAttribute('aria-label', collapsed ? '開く' : '折りたたむ');
}

function focusTrainerSelectedView() {
  setTrainerSectionCollapsed('trainerAthletePanelBody', true);
  setTrainerSectionCollapsed('trainerSummaryBody', false);
  setTrainerSectionCollapsed('trainerAlertBody', false);
  setTrainerSectionCollapsed('trainerNotesBody', false);
  setTrainerSectionCollapsed('trainerWeightListBody', false);
}

async function selectTrainerAthlete(athleteUserId) {
  selectedTrainerAthleteId = String(athleteUserId || '').trim();
  renderTrainerAthleteList();
  await renderTrainerAthleteData();
  focusTrainerSelectedView();
  window.requestAnimationFrame(() => {
    document.querySelector('.trainer-summary-card')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
}

async function removeTrainerAthlete(linkId) {
  showModal('担当選手を外す', 'この選手をトレーナー閲覧から外しますか？外すと、この選手のデータは表示されなくなります。', async () => {
    try {
      await revokeTrainerInvite(linkId);
      trainerAthletes = trainerAthletes.filter((row) => row.id !== linkId);
      if (!trainerAthletes.some((row) => row.athlete_user_id === selectedTrainerAthleteId)) {
        selectedTrainerAthleteId = trainerAthletes[0]?.athlete_user_id || '';
      }
      syncTrainerNavVisibility(trainerAthletes);
      if (!trainerAccessAvailable) {
        showToast('担当選手がいなくなったため、通常ユーザー画面に戻りました', 'info');
        switchPage('dashboard');
        return;
      }
      renderTrainerAthleteList();
      await renderTrainerAthleteData();
      showToast('担当選手を外しました', 'info');
    } catch (error) {
      console.error('BOXER PRO: remove trainer athlete', error);
      showToast('担当選手を外せませんでした', 'error');
    }
  });
}

async function renderTrainerPage() {
  const gate = document.getElementById('trainerCloudGate');
  const workspace = document.getElementById('trainerWorkspace');
  const section = document.getElementById('trainerWeightSection');
  const requestsCard = document.getElementById('trainerInviteRequestsCard');
  if (!gate || !workspace) return;
  const inCloud = activeStorageMode === STORAGE_MODE.SUPABASE;
  gate.style.display = inCloud ? 'none' : '';
  workspace.style.display = inCloud ? '' : 'none';
  if (section) section.style.display = inCloud && selectedTrainerAthleteId ? '' : 'none';
  if (requestsCard) requestsCard.style.display = 'none';
  if (!inCloud) {
    renderTrainerEmptyData('クラウドログインが必要です');
    return;
  }

  const seq = trainerPageRenderSeq + 1;
  trainerPageRenderSeq = seq;
  const list = document.getElementById('trainerAthleteList');
  if (list) list.innerHTML = '<div class="settings-note">あなたに閲覧許可した選手を読み込み中...</div>';
  try {
    const pendingInvites = await fetchTrainerInviteRequests();
    renderTrainerInviteRequests(pendingInvites);
    await refreshTrainerNavAccess();
    if (seq !== trainerPageRenderSeq) return;
    if (!trainerAthletes.some((row) => row.athlete_user_id === selectedTrainerAthleteId)) {
      selectedTrainerAthleteId = trainerAthletes[0]?.athlete_user_id || '';
    }
    renderTrainerAthleteList();
    await renderTrainerAthleteData();
  } catch (error) {
    console.error('BOXER PRO: render trainer page', error);
    if (list) list.innerHTML = '<div class="settings-note">担当選手一覧を取得できませんでした。</div>';
    renderTrainerEmptyData('担当選手一覧を取得できませんでした');
  }
}

function getEffectiveUserCapabilities() {
  if (typeof window.getCurrentUserCapabilities === 'function') {
    return window.getCurrentUserCapabilities();
  }
  return { roles: [], isAdmin: false, isAthlete: true, isTrainer: trainerAccessAvailable };
}

function isTrainerSettingsMode(caps = getEffectiveUserCapabilities()) {
  return !!trainerAccessAvailable || (!!caps.isTrainer && caps.isAthlete === false);
}

function applySettingsCapabilityVisibility() {
  const caps = getEffectiveUserCapabilities();
  const trainerMode = isTrainerSettingsMode(caps);
  const settingsTitle = document.getElementById('settings-page-title-text');
  const settingsSubtitle = document.getElementById('settings-page-subtitle');
  const profileTitle = document.getElementById('settingsProfileTitle');
  const cloudTitle = document.getElementById('settingsCloudTitle');
  const topTitle = document.getElementById('topbarTitle');
  if (settingsTitle) settingsTitle.textContent = trainerMode ? 'トレーナー設定' : getUiText('settings.pageTitle', 'マイ設定');
  if (topTitle && document.querySelector('.page.active')?.id === 'page-settings') {
    topTitle.textContent = trainerMode ? 'トレーナー設定' : getUiText('pageTitles.settings', 'マイ設定');
  }
  if (settingsSubtitle) {
    settingsSubtitle.textContent = trainerMode
      ? 'トレーナーのログインID・表示名だけを管理'
      : getUiText('settings.pageSubtitle', '個人用の基本設定・通知・バックアップ管理');
  }
  if (profileTitle) profileTitle.innerHTML = `<i class="fas fa-user-gear"></i> ${trainerMode ? 'トレーナープロフィール' : '個人プロフィール設定'}`;
  if (cloudTitle) cloudTitle.innerHTML = `<i class="fas fa-cloud"></i> ${trainerMode ? 'ログインID' : 'クラウド同期 (Supabase)'}`;

  document.querySelectorAll('.settings-athlete-only').forEach((el) => {
    el.hidden = trainerMode;
  });
  ['settings-backup-card', 'settings-reminder-card'].forEach((id) => {
    const card = document.getElementById(id);
    if (card) card.hidden = trainerMode;
  });
  const configHint = document.getElementById('supabase-config-hint');
  if (configHint) configHint.hidden = trainerMode;
  const mergeBtn = document.getElementById('supabase-merge-btn');
  if (mergeBtn) mergeBtn.hidden = trainerMode;

  const trainerInviteCard = document.getElementById('trainer-invite-card');
  if (trainerInviteCard) {
    trainerInviteCard.hidden = trainerMode || (!!trainerAccessAvailable && !caps.isAthlete);
  }
  const athleteTrainerNotesCard = document.getElementById('athlete-trainer-notes-card');
  if (athleteTrainerNotesCard) {
    athleteTrainerNotesCard.hidden = trainerMode || activeStorageMode !== STORAGE_MODE.SUPABASE || !!trainerAccessAvailable || caps.isAthlete === false;
  }
  if (trainerMode || trainerAccessAvailable || caps.isTrainer) {
    ['settings-storage-card', 'admin-stats-card'].forEach((id) => {
      const card = document.getElementById(id);
      if (card) card.hidden = true;
    });
  }
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
  setFieldValue('s-goal-mode', appSettings.goalMode);
  setFieldValue('s-language', appSettings.language);
  setFieldValue('s-fat-loss-target-date', appSettings.fatLossTargetDate);
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
  renderAiCoachMessages(false);
  updateAiCoachAvailability();
  updateSupabaseAuthUI();
  void renderTrainerInvitePanel();
  void renderAthleteTrainerNotesPanel();
  applyLanguageUi();
  applySettingsCapabilityVisibility();
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
  const goalMode = normalizeGoalMode(document.getElementById('s-goal-mode')?.value || DEFAULT_SETTINGS.goalMode);
  const language = normalizeLanguage(document.getElementById('s-language')?.value || DEFAULT_SETTINGS.language);
  const fatLossTargetRaw = (document.getElementById('s-fat-loss-target-date')?.value || '').trim();
  if (fatLossTargetRaw && !isIsoDateString(fatLossTargetRaw)) {
    showToast('一般減量の目標達成日は YYYY-MM-DD 形式で入力してください', 'error');
    return;
  }

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
    language,
    goalMode,
    fatLossTargetDate: goalMode === 'fat_loss' ? fatLossTargetRaw : '',
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
  showToast(getUiText('settings.saveDone', '設定を保存しました'), 'success');
}

function renderWeeklyFatLossCard() {
  const card = document.getElementById('weeklyFatLossCard');
  const summary = document.getElementById('weeklyFatLossSummary');
  const plan = document.getElementById('weeklyFatLossPlan');
  if (!card || !summary || !plan) return;

  if ((appSettings?.goalMode || '') !== 'fat_loss') {
    card.style.display = 'none';
    plan.style.display = 'none';
    plan.innerHTML = '';
    summary.innerHTML = '';
    return;
  }
  card.style.display = '';
  card.classList.add('fatloss-card');

  const rows = [...weightLogs]
    .filter((row) => row?.date && Number.isFinite(Number(row?.weight)))
    .sort((a, b) => new Date(a.date) - new Date(b.date));
  if (rows.length < 2) {
    summary.innerHTML = '<div class="fatloss-warn">体重記録が2件以上あると週間ペースを判定します。</div>';
    plan.style.display = 'none';
    plan.innerHTML = '';
    return;
  }

  const latest = rows[rows.length - 1];
  const latestDate = new Date(`${latest.date}T00:00:00`);
  const baselineDate = new Date(latestDate);
  baselineDate.setDate(baselineDate.getDate() - 7);
  const baseline = [...rows].reverse().find((row) => new Date(`${row.date}T00:00:00`) <= baselineDate) || rows[0];

  const latestWeight = Number(latest.weight);
  const baseWeight = Number(baseline.weight);
  const diffKg = baseWeight - latestWeight;
  const weeklyPct = baseWeight > 0 ? (diffKg / baseWeight) * 100 : 0;

  let judge = '適正';
  if (weeklyPct < 0.25) judge = '遅め';
  else if (weeklyPct > 0.75) judge = '速め';

  summary.innerHTML = `
    <div class="fatloss-summary-grid">
      <div class="fatloss-summary-chip">
        <span>直近7日</span>
        <strong>${weeklyPct.toFixed(2)}%</strong>
      </div>
      <div class="fatloss-summary-chip">
        <span>体重差</span>
        <strong>${diffKg >= 0 ? '-' : '+'}${Math.abs(diffKg).toFixed(1)} kg</strong>
      </div>
      <div class="fatloss-summary-chip">
        <span>判定</span>
        <strong>${escapeHtml(judge)}</strong>
      </div>
      <div class="fatloss-summary-chip">
        <span>推奨ペース</span>
        <strong>0.25〜0.75% / 週</strong>
      </div>
    </div>
  `;

  const today = TODAY();
  const row = cuttingPlanRows.find((item) => item.date >= today) || cuttingPlanRows[cuttingPlanRows.length - 1];
  if (!row?.autoGenerated) {
    plan.style.display = 'none';
    plan.innerHTML = '';
    return;
  }
  plan.style.display = 'block';
  const kcal = Math.round(Number(row.totalKcalTarget) || 0);
  const protein = Math.round(Number(row.protein) || 0);
  const fat = Math.round(Number(row.fat) || 0);
  const carbs = Math.round(Number(row.carbs) || 0);
  const warnHtml = fatLossTargetDateWarning
    ? `<div class="fatloss-warn"><strong>警告:</strong> ${escapeHtml(fatLossTargetDateWarning)}</div>`
    : '';
  plan.innerHTML = `
    <div class="fatloss-plan">
      <div class="fatloss-plan-head">
        <div>
          <div class="fatloss-plan-title">今日/次回の一般減量プラン</div>
          <div class="fatloss-plan-date">${escapeHtml(formatDate(row.date))} / フェーズ: ${escapeHtml(row.phase || '--')}</div>
        </div>
      </div>
      <div class="fatloss-pfc-row">
        <div class="fatloss-pfc-chip"><span>目標体重</span><strong>${escapeHtml(row.targetMorningWeight || '--')}</strong></div>
        <div class="fatloss-pfc-chip"><span>KCAL</span><strong>${kcal}</strong></div>
        <div class="fatloss-pfc-chip"><span>P / F / C</span><strong>${protein} / ${fat} / ${carbs} g</strong></div>
        <div class="fatloss-pfc-chip"><span>補食</span><strong>${escapeHtml(row.snack || 'なし')}</strong></div>
      </div>
      <div class="fatloss-meals">
        <div class="fatloss-meal"><strong>朝:</strong> ${escapeHtml(row.breakfast || '--')}</div>
        <div class="fatloss-meal"><strong>昼:</strong> ${escapeHtml(row.lunch || '--')}</div>
        <div class="fatloss-meal"><strong>夜:</strong> ${escapeHtml(row.dinner || '--')}</div>
      </div>
      ${warnHtml}
    </div>
  `;
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
  if (sortKey === 'date') {
    return [...rows].sort((a, b) => {
      const dateCmp = String(a?.date || '').localeCompare(String(b?.date || ''));
      if (dateCmp !== 0) return dateCmp;
      if ('slot' in (a || {}) || 'slot' in (b || {})) {
        return getWeightSlotOrder(a?.slot) - getWeightSlotOrder(b?.slot);
      }
      return 0;
    });
  }
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
  ['w-date','m-date','t-date','mealViewDate','mealFilterDate','h-date','r-date','fh-date','f-date'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = today;
  });
  const weightSlotEl = document.getElementById('w-slot');
  if (weightSlotEl && !weightSlotEl.value) weightSlotEl.value = 'morning';
}

function renderActivePageById(activePageId) {
  if (activePageId === 'page-dashboard') {
    renderDashboard(true);
    return;
  }
  if (activePageId === 'page-weight') {
    renderWeightPage();
    return;
  }
  if (activePageId === 'page-meals') {
    renderMealsPage();
    return;
  }
  if (activePageId === 'page-training') {
    renderTrainingPage();
    return;
  }
  if (activePageId === 'page-calories') {
    renderCaloriesPage();
    return;
  }
  if (activePageId === 'page-fight') {
    renderFightPage();
    return;
  }
  if (activePageId === 'page-trainer') {
    void renderTrainerPage();
    return;
  }
  if (activePageId === 'page-settings') {
    renderSettingsPage();
    return;
  }
  renderDashboard();
}

function refreshTodayBoundViews() {
  setDateInputs();
  loadMealSummary();
  renderDashboard();
  const activePageId = document.querySelector('.page.active')?.id || '';
  renderActivePageById(activePageId);
  if (typeof window.applyLanguageUi === 'function') window.applyLanguageUi();
}

function syncAppDayBoundary(force = false) {
  const today = TODAY();
  if (!force && today === currentAppDayKey) return false;
  currentAppDayKey = today;
  refreshTodayBoundViews();
  return true;
}

// Navigation moved to js/core/navigation.js

// Storage and data services moved to js/services/storage.js

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
    baseCuttingPlanRows = lines.slice(1).map(line => {
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
    refreshCuttingPlanRows();
  } catch (error) {
    console.error(error);
    baseCuttingPlanRows = [];
    cuttingPlanRows = [];
  }
}

function toIsoDateLocal(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function getNextActiveFightGoal() {
  const rows = fightGoals
    .filter((row) => row?.status === '準備中' && row?.fight_date)
    .sort((a, b) => new Date(a.fight_date) - new Date(b.fight_date));
  if (!rows.length) return null;
  const today = TODAY();
  return rows.find((row) => String(row.fight_date || '') >= today) || rows[0];
}

function getLatestWeightValue() {
  if (!weightLogs.length) return null;
  const latest = [...weightLogs]
    .filter((row) => Number.isFinite(Number(row?.weight)))
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .pop();
  return latest ? Number(latest.weight) : null;
}

function getAutoCutPhase(daysLeft) {
  if (daysLeft >= AUTO_CUT_PHASE_BOUNDARIES.baseDaysMin) return '基礎減量';
  if (daysLeft >= AUTO_CUT_PHASE_BOUNDARIES.intensiveDaysMin) return '強化減量';
  if (daysLeft >= AUTO_CUT_PHASE_BOUNDARIES.finalDaysMin) return '最終調整';
  return '計量直前調整';
}

function resolveAutoCutClassPreset(weightClass) {
  const raw = String(weightClass || '').trim().toLowerCase();
  if (!raw) return { ...AUTO_CUT_CLASS_PRESET_DEFAULT };
  const found = AUTO_CUT_CLASS_PRESETS.find((preset) => preset.keywords.some((kw) => raw.includes(String(kw).toLowerCase())));
  return found ? { ...AUTO_CUT_CLASS_PRESET_DEFAULT, ...found } : { ...AUTO_CUT_CLASS_PRESET_DEFAULT };
}

function getAutoCutPhaseConfig(phase, weightKg, baseKcal, classPreset = AUTO_CUT_CLASS_PRESET_DEFAULT) {
  const bw = Number(weightKg) || 60;
  const preset = classPreset || AUTO_CUT_CLASS_PRESET_DEFAULT;
  const defaultFloor = Math.max(1400, Math.round(bw * 22 * (preset.kcalFloorMul || 1)));
  const defaultCeiling = Math.max(defaultFloor + 100, Math.round(baseKcal * 1.05));
  if (phase === '基礎減量') {
    return {
      proteinG: Math.round(clampNumber(bw * 2.0 * (preset.proteinMul || 1), 120, 240)),
      fatG: Math.round(clampNumber(bw * 0.8 * (preset.fatMul || 1), 38, 90)),
      minCarbsG: Math.max(60, 130 + (preset.carbsShift || 0)),
      maxDeficitKcal: Math.round(450 * (preset.deficitMul || 1)),
      phaseAdjustKcal: 60,
      kcalFloor: defaultFloor,
      kcalCeiling: defaultCeiling,
    };
  }
  if (phase === '強化減量') {
    return {
      proteinG: Math.round(clampNumber(bw * 2.2 * (preset.proteinMul || 1), 130, 250)),
      fatG: Math.round(clampNumber(bw * 0.7 * (preset.fatMul || 1), 35, 80)),
      minCarbsG: Math.max(55, 110 + (preset.carbsShift || 0)),
      maxDeficitKcal: Math.round(650 * (preset.deficitMul || 1)),
      phaseAdjustKcal: 0,
      kcalFloor: defaultFloor,
      kcalCeiling: defaultCeiling,
    };
  }
  if (phase === '最終調整') {
    return {
      proteinG: Math.round(clampNumber(bw * 2.3 * (preset.proteinMul || 1), 140, 260)),
      fatG: Math.round(clampNumber(bw * 0.6 * (preset.fatMul || 1), 30, 70)),
      minCarbsG: Math.max(50, 90 + (preset.carbsShift || 0)),
      maxDeficitKcal: Math.round(750 * (preset.deficitMul || 1)),
      phaseAdjustKcal: -40,
      kcalFloor: defaultFloor,
      kcalCeiling: defaultCeiling,
    };
  }
  return {
    proteinG: Math.round(clampNumber(bw * 2.4 * (preset.proteinMul || 1), 145, 265)),
    fatG: Math.round(clampNumber(bw * 0.55 * (preset.fatMul || 1), 28, 65)),
    minCarbsG: Math.max(45, 70 + (preset.carbsShift || 0)),
    maxDeficitKcal: Math.round(500 * (preset.deficitMul || 1)),
    phaseAdjustKcal: -80,
    kcalFloor: defaultFloor,
    kcalCeiling: defaultCeiling,
  };
}

function getAutoCutMealTemplate(phase) {
  if (phase === '基礎減量') {
    return {
      breakfast: 'オートミール + 卵 + ヨーグルト',
      lunch: '鶏胸肉 + 白米 + 温野菜',
      dinner: '白身魚 + 白米少量 + 野菜スープ',
      snack: 'プロテイン + 果物',
    };
  }
  if (phase === '強化減量') {
    return {
      breakfast: '卵白オムレツ + バナナ1/2',
      lunch: '鶏胸肉 + 白米130g + ブロッコリー',
      dinner: '豆腐 + 赤身魚 + 野菜',
      snack: 'プロテイン + ナッツ少量',
    };
  }
  if (phase === '最終調整') {
    return {
      breakfast: '白米少量 + 卵 + 味噌汁',
      lunch: '鶏胸肉 + 低脂質炭水化物',
      dinner: '白身魚 + 消化の良い炭水化物少量',
      snack: 'プロテイン',
    };
  }
  return {
    breakfast: '低残渣食（少量）',
    lunch: '低脂質・低繊維で調整',
    dinner: 'コンディション優先の軽食',
    snack: '必要時のみプロテイン',
  };
}

function buildAutoCuttingPlanRows() {
  const mode = getCurrentGoalMode();
  fatLossTargetDateWarning = '';
  const today = TODAY();
  let horizonDate = '';
  let currentWeight = null;
  let targetWeight = null;
  let classPreset = { ...AUTO_CUT_CLASS_PRESET_DEFAULT };

  if (mode === 'boxer_cut') {
    const nextFight = getNextActiveFightGoal();
    if (!nextFight?.fight_date) return [];
    horizonDate = String(nextFight.fight_date);
    if (horizonDate < today) return [];
    currentWeight = getLatestWeightValue() || Number(nextFight.current_weight) || null;
    targetWeight = Number(nextFight.target_weight) || Number(appSettings.targetWeight) || null;
    classPreset = resolveAutoCutClassPreset(nextFight.weight_class);
  } else if (mode === 'fat_loss') {
    currentWeight = getLatestWeightValue();
    targetWeight = Number(appSettings.targetWeight) || null;
    if (!currentWeight || !targetWeight || currentWeight <= targetWeight) return [];
    const targetDate = normalizeOptionalIsoDate(appSettings.fatLossTargetDate);
    if (targetDate) {
      if (targetDate < today) {
        fatLossTargetDateWarning = '目標達成日が過去日です。安全ペースで再計算した日程を表示しています。';
      } else {
        horizonDate = targetDate;
      }
    }
    if (!horizonDate) {
      const weeklyLoss = Math.max(currentWeight * 0.005, 0.15);
      const estimatedDays = Math.ceil(((currentWeight - targetWeight) / weeklyLoss) * 7);
      const planDays = clampNumber(estimatedDays, 14, 140);
      const horizon = new Date(`${today}T00:00:00`);
      horizon.setDate(horizon.getDate() + planDays);
      horizonDate = toIsoDateLocal(horizon);
    }
  } else {
    return [];
  }

  if (!currentWeight || !targetWeight) return [];

  const totalDays = Math.max(getDaysUntil(horizonDate), 0);
  if (!Number.isFinite(totalDays)) return [];

  const totalLoss = Math.max(currentWeight - targetWeight, 0);
  const requiredPerWeek = totalDays > 0 ? (totalLoss / Math.max(totalDays / 7, 1)) : 0;
  const safeWeeklyLimit = mode === 'fat_loss' ? currentWeight * 0.0075 : currentWeight * AUTO_CUT_WEEKLY_LIMIT_RATIO;
  const baseKcal = Number(appSettings.dailyCalorieGoal) || 1800;

  if (mode === 'fat_loss' && appSettings.fatLossTargetDate && appSettings.fatLossTargetDate >= today && requiredPerWeek > safeWeeklyLimit) {
    fatLossTargetDateWarning = `目標日までに必要な減量速度は ${requiredPerWeek.toFixed(2)}kg/週 です（安全目安 ${safeWeeklyLimit.toFixed(2)}kg/週）。目標日を後ろへ調整してください。`;
  }

  const rows = [];
  const startDate = new Date(`${today}T00:00:00`);
  for (let i = 0; i <= totalDays; i += 1) {
    const d = new Date(startDate);
    d.setDate(startDate.getDate() + i);
    const date = toIsoDateLocal(d);
    const daysLeft = totalDays - i;
    const phase = getAutoCutPhase(daysLeft);
    const progress = totalDays > 0 ? i / totalDays : 1;
    const targetMorningWeight = currentWeight - (totalLoss * progress);

    const requiredDailyLoss = totalDays > 0 ? totalLoss / totalDays : 0;
    const requiredDeficit = Math.round(requiredDailyLoss * 7700);
    const phaseCfgRaw = getAutoCutPhaseConfig(phase, currentWeight, baseKcal, classPreset);
    const phaseCfg = mode === 'fat_loss'
      ? {
          ...phaseCfgRaw,
          maxDeficitKcal: Math.round(phaseCfgRaw.maxDeficitKcal * 0.7),
          phaseAdjustKcal: Math.max(phaseCfgRaw.phaseAdjustKcal, -20),
          kcalFloor: Math.max(phaseCfgRaw.kcalFloor, Math.round(currentWeight * 24)),
          minCarbsG: Math.max(phaseCfgRaw.minCarbsG, 120),
        }
      : phaseCfgRaw;
    const kcalTarget = clampNumber(
      Math.round(baseKcal - clampNumber(requiredDeficit, 200, phaseCfg.maxDeficitKcal) + phaseCfg.phaseAdjustKcal),
      phaseCfg.kcalFloor,
      phaseCfg.kcalCeiling
    );

    const protein = phaseCfg.proteinG;
    const fat = phaseCfg.fatG;
    const carbsRaw = Math.round((kcalTarget - (protein * 4) - (fat * 9)) / 4);
    const carbs = Math.max(phaseCfg.minCarbsG, carbsRaw);
    const meals = getAutoCutMealTemplate(phase);
    const hydrationMemo = daysLeft <= 2
      ? '急激な水抜きは避ける。電解質を維持しながらこまめに補給。'
      : '体重(kg)×35〜45mlを目安に補給。発汗量の差分を記録。';
    const conditionMemo = requiredPerWeek > safeWeeklyLimit
      ? `減量ペース警告: ${requiredPerWeek.toFixed(2)}kg/週（安全目安 ${safeWeeklyLimit.toFixed(2)}kg/週）`
      : mode === 'fat_loss'
        ? '一般減量: 週0.25〜0.75%を目安に、睡眠・NEAT・食事継続を優先。'
        : `睡眠7時間以上・疲労スコア確認・練習強度を日次調整。階級プリセット: ${classPreset.label}`;

    rows.push({
      date,
      phase,
      targetMorningWeight: `${targetMorningWeight.toFixed(1)} kg`,
      breakfast: meals.breakfast,
      lunch: meals.lunch,
      dinner: meals.dinner,
      snack: meals.snack,
      totalKcalTarget: kcalTarget,
      protein,
      fat,
      carbs,
      hydrationMemo,
      conditionMemo,
      autoGenerated: true,
      autoGeneratedMode: mode,
    });
  }
  return rows;
}

function refreshCuttingPlanRows() {
  const autoRows = buildAutoCuttingPlanRows();
  cuttingPlanRows = autoRows.length ? autoRows : [...baseCuttingPlanRows];
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

  refreshCuttingPlanRows();
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
    setText('planCompareNote', '試合目標と体重記録が揃うと、自動減量プランとの差分を表示します。');
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

function getDashboardCalorieJudge(snapshot) {
  if (snapshot.calories <= 0) {
    return { text: '判定: 食事記録待ち', state: '' };
  }

  const targetKcal = Number(snapshot.planRow?.totalKcalTarget) || Number(appSettings.dailyCalorieGoal) || 0;
  if (!targetKcal) {
    return { text: '判定: 目標kcal未設定', state: '' };
  }

  const kcalGap = Math.round(snapshot.calories - targetKcal);
  const weightGap = snapshot.weightGap;
  const hasFightPlan = Boolean(snapshot.activeFight && snapshot.planRow?.totalKcalTarget);

  if (hasFightPlan) {
    if (kcalGap < -500) {
      return { text: `判定: 落としすぎ（予定比 ${kcalGap}kcal）`, state: 'down' };
    }
    if (kcalGap > 250) {
      return { text: `判定: オーバー（予定比 +${kcalGap}kcal）`, state: 'down' };
    }
    if (weightGap !== null && weightGap > 0.3 && kcalGap <= 0) {
      return { text: `判定: 順調（絞り優先・予定比 ${kcalGap}kcal）`, state: 'up' };
    }
    if (weightGap !== null && weightGap < -0.3 && kcalGap < -250) {
      return { text: `判定: 下げすぎ（体重先行・予定比 ${kcalGap}kcal）`, state: 'down' };
    }
    if ((weightGap === null || Math.abs(weightGap) <= 0.3) && Math.abs(kcalGap) <= 150) {
      return { text: `判定: 順調（予定比 ${kcalGap > 0 ? '+' : ''}${kcalGap}kcal）`, state: 'up' };
    }
    return { text: `判定: 調整中（予定比 ${kcalGap > 0 ? '+' : ''}${kcalGap}kcal）`, state: 'flat' };
  }

  if (Math.abs(kcalGap) <= 150) {
    return { text: `判定: 目標内（基準比 ${kcalGap > 0 ? '+' : ''}${kcalGap}kcal）`, state: 'up' };
  }
  if (kcalGap < -500) {
    return { text: `判定: 少なめ（基準比 ${kcalGap}kcal）`, state: 'down' };
  }
  if (kcalGap > 250) {
    return { text: `判定: 多め（基準比 +${kcalGap}kcal）`, state: 'down' };
  }
  return { text: `判定: 調整中（基準比 ${kcalGap > 0 ? '+' : ''}${kcalGap}kcal）`, state: 'flat' };
}

function setRingFill(ringId, pctId, ratio) {
  const ring = document.getElementById(ringId);
  const pctEl = document.getElementById(pctId);
  if (!ring || !pctEl) return;
  const r = clampNumber(Number(ratio) || 0, 0, 1.2);
  const pct = Math.round(r * 100);
  const circumference = 201;
  ring.style.strokeDashoffset = String(circumference * (1 - Math.min(r, 1)));
  pctEl.textContent = `${pct}%`;
}

function renderDashboard7dayCalorieBalance() {
  const canvas = document.getElementById('dash7dayChart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const days7 = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return toLocalIsoDate(d);
  });
  const labels = days7.map((d) => d.slice(5));
  const intake = days7.map((d) => Math.round(mealLogs
    .filter((m) => m.date && m.date.slice(0, 10) === d)
    .reduce((s, m) => s + (parseFloat(m.calories) || 0), 0)));
  const burned = days7.map((d) => Math.round(trainingLogs
    .filter((t) => t.date && t.date.slice(0, 10) === d)
    .reduce((s, t) => s + (parseFloat(t.calories_burned) || 0), 0)));
  const net = intake.map((v, i) => v - burned[i]);

  if (dash7dayChartInst) dash7dayChartInst.destroy();
  dash7dayChartInst = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        { label: '摂取', data: intake, backgroundColor: createBarGradient(ctx, '#69b2ff', '#326fd6'), borderRadius: 7 },
        { label: '消費', data: burned, backgroundColor: createBarGradient(ctx, '#ff6b78', '#c92d3d'), borderRadius: 7 },
        { type: 'line', label: '収支', data: net, borderColor: '#f5c842', backgroundColor: 'rgba(245,200,66,0.08)', tension: 0.35, borderWidth: 2, pointRadius: 3 },
      ],
    },
    options: chartOptions('kcal'),
  });
}

function renderDashboardStreakAndRings(snapshot) {
  const dayHasRecord = (day) => (
    weightLogs.some((w) => w.date && w.date.slice(0, 10) === day)
    || mealLogs.some((m) => m.date && m.date.slice(0, 10) === day)
    || trainingLogs.some((t) => t.date && t.date.slice(0, 10) === day)
    || hydrationLogs.some((h) => h.date && h.date.slice(0, 10) === day)
    || recoveryLogs.some((r) => r.date && r.date.slice(0, 10) === day)
  );

  let streak = 0;
  for (let i = 0; i < 365; i += 1) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const ds = toLocalIsoDate(d);
    if (!dayHasRecord(ds)) break;
    streak += 1;
  }
  setText('streakDays', String(streak));
  setText('streakSub', streak > 0 ? `直近${streak}日継続` : '今日の記録から開始');

  const calTarget = Number(snapshot.planRow?.totalKcalTarget) || Number(appSettings.dailyCalorieGoal) || 0;
  const proteinTarget = Number(snapshot.planRow?.protein) || ((Number(snapshot.actualWeight) || Number(appSettings.targetWeight) || 0) * 2.2);
  const trainTarget = 60;
  const calRatio = calTarget > 0 ? snapshot.calories / calTarget : 0;
  const proteinRatio = proteinTarget > 0 ? snapshot.protein / proteinTarget : 0;
  const trainRatio = trainTarget > 0 ? snapshot.trainingMinutes / trainTarget : 0;

  setRingFill('ringCalFill', 'ringCalPct', calRatio);
  setRingFill('ringProFill', 'ringProPct', proteinRatio);
  setRingFill('ringTrainFill', 'ringTrainPct', trainRatio);
}

function applyDashboardSectionOrder() {
  if (dashboardSectionOrderApplied) return;
  const dashboardPage = document.getElementById('page-dashboard');
  if (!dashboardPage) return;
  const kpiGrid = dashboardPage.querySelector('.kpi-grid');
  if (!kpiGrid) return;

  const onboarding = document.getElementById('dashboardOnboardingCard');
  const dashGridBottom = document.getElementById('dashGridBottom');
  const dashGridTop = document.getElementById('dashGridTop');
  const performanceCard = document.getElementById('dashboardPerformanceCard');
  const quickRow = document.getElementById('dash-quick-anchor');
  const activityCard = document.getElementById('dashboardRecentActivityCard');
  const summaryRow = dashboardPage.querySelector('.two-col.mt-16');

  const ordered = [
    onboarding,
    dashGridBottom,
    dashGridTop,
    performanceCard,
    quickRow,
    activityCard,
    summaryRow,
  ].filter(Boolean);
  if (!ordered.length) return;

  ordered.forEach((section) => {
    dashboardPage.appendChild(section);
  });
  dashboardSectionOrderApplied = true;
}

// ============================================================
// DASHBOARD
// ============================================================
function renderDashboardNow() {
  applyDashboardSectionOrder();
  refreshCuttingPlanRows();
  const today = TODAY();
  const snapshot = getDailyPerformanceSnapshot(today);

  // Today's weight
  const todayWeights = weightLogs.filter(w => w.date && w.date.slice(0,10) === today);
  const latestWeight = todayWeights.length ? todayWeights[todayWeights.length - 1] : null;

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
    document.getElementById('kpi-current-weight').textContent = '-- kg';
    setText('kpi-bmi-badge', '--');
    setText('dashSubDate', formatDateJP(today));
  }

  // Today's meals
  const todayMeals = mealLogs.filter(m => m.date && m.date.slice(0,10) === today);
  const todayCal = todayMeals.reduce((s,m) => s + (parseFloat(m.calories)||0), 0);
  const todayProtein = todayMeals.reduce((s,m) => s + (parseFloat(m.protein)||0), 0);
  document.getElementById('kpi-today-calories').textContent = `${Math.round(todayCal)} kcal`;
  document.getElementById('kpi-today-protein').textContent = `${Math.round(todayProtein)} g`;
  const calorieJudge = getDashboardCalorieJudge(snapshot);
  const calorieJudgeEl = document.getElementById('kpi-calorie-judge');
  if (calorieJudgeEl) {
    calorieJudgeEl.textContent = calorieJudge.text;
    calorieJudgeEl.classList.remove('up', 'flat', 'down');
    if (calorieJudge.state) calorieJudgeEl.classList.add(calorieJudge.state);
  }

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

  renderDashboardOnboarding();
  renderWeeklyFatLossCard();

  // Charts
  renderDashboardWeightChart();
  renderDashboardPFCChart(todayMeals);
  renderDashboard7dayCalorieBalance();
  renderDashboardStreakAndRings(snapshot);
  renderRecentActivity();
  renderPerformanceCoach();
  renderAutoSummaries();
}

function renderDashboard(force = false) {
  if (force) {
    if (dashboardRenderTimer) {
      window.clearTimeout(dashboardRenderTimer);
      dashboardRenderTimer = null;
    }
    renderDashboardNow();
    return;
  }
  if (dashboardRenderTimer) window.clearTimeout(dashboardRenderTimer);
  dashboardRenderTimer = window.setTimeout(() => {
    dashboardRenderTimer = null;
    renderDashboardNow();
  }, DASHBOARD_RENDER_DEBOUNCE_MS);
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
    const ds = toLocalIsoDate(d);
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

// Weight page moved to js/pages/weight.js

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
      responsive: true, maintainAspectRatio: false,
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
    window.setTimeout(() => {
      const nextInput = document.getElementById('foodSearch');
      if (nextInput && typeof nextInput.focus === 'function') nextInput.focus();
    }, 60);
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
    return toLocalIsoDate(d);
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
      <div class="wms-item"><div class="wms-val">${totalProt}g</div><div>7日合計</div></div>
      <div class="wms-item"><div class="wms-val">${calArr.filter(v=>v>0).length}</div><div>記録日数</div></div>
    `;
  }
}

function renderMealsPage() {
  loadMealSummary();
  render7dayMealChart();
  filterMeals();
  updateRealtimeTotal();
  window.requestAnimationFrame(() => {
    mealPfcChartInst?.resize();
    meal7dayChartInst?.resize();
    rtPfcChartInst?.resize();
  });
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
    if (editingTrainingId) {
      const updated = await apiPut('training_logs', editingTrainingId, {
        date, training_type: type, duration, intensity, calories_burned: burned,
        rounds, opponent, theme, rating, note
      });
      const ix = trainingLogs.findIndex((t) => t.id === editingTrainingId);
      if (ix !== -1) trainingLogs[ix] = { ...trainingLogs[ix], ...updated };
      trainingLogs.sort((a,b) => new Date(a.date) - new Date(b.date));
      showToast(`✅ ${type} ${duration}分 の記録を更新しました`, 'success');
      cancelEditTraining();
    } else {
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
    }
    renderTrainingPage();
    renderDashboard();
    window.setTimeout(() => {
      const nextInput = document.getElementById('t-type');
      if (nextInput && typeof nextInput.focus === 'function') nextInput.focus();
    }, 60);
  } catch(e) {
    showToast('保存に失敗しました', 'error');
  }
}

function updateTrainingEditUI() {
  const banner = document.getElementById('trainingEditBanner');
  const btn = document.getElementById('trainingSaveBtn');
  const on = Boolean(editingTrainingId);
  if (banner) banner.style.display = on ? 'flex' : 'none';
  if (btn) {
    btn.innerHTML = on
      ? '<i class="fas fa-save"></i> 変更を保存'
      : '<i class="fas fa-save"></i> 練習を保存';
  }
}

function cancelEditTraining() {
  editingTrainingId = null;
  const today = TODAY();
  const g = (id) => document.getElementById(id);
  if (g('t-date')) g('t-date').value = today;
  if (g('t-type')) g('t-type').value = '';
  if (g('t-intensity')) g('t-intensity').value = appSettings.defaultTrainingIntensity || '中';
  if (g('t-rating')) g('t-rating').value = '';
  clearForm(['t-duration','t-burned','t-note','t-rounds','t-opponent','t-theme']);
  updateTrainingEditUI();
}

function startEditTraining(id) {
  const t = trainingLogs.find((x) => x.id === id);
  if (!t) return;
  editingTrainingId = id;
  const g = (x) => document.getElementById(x);
  if (g('t-date')) g('t-date').value = t.date ? t.date.slice(0, 10) : TODAY();
  if (g('t-type')) g('t-type').value = t.training_type || '';
  if (g('t-duration')) g('t-duration').value = t.duration != null ? t.duration : '';
  if (g('t-intensity')) g('t-intensity').value = t.intensity || appSettings.defaultTrainingIntensity || '中';
  if (g('t-burned')) g('t-burned').value = t.calories_burned != null ? t.calories_burned : '';
  if (g('t-note')) g('t-note').value = t.note || '';
  if (g('t-rounds')) g('t-rounds').value = t.rounds != null && t.rounds !== '' ? t.rounds : '';
  if (g('t-opponent')) g('t-opponent').value = t.opponent || '';
  if (g('t-theme')) g('t-theme').value = t.theme || '';
  if (g('t-rating')) g('t-rating').value = t.rating != null && t.rating !== '' ? String(t.rating) : '';
  updateTrainingEditUI();
  if (typeof autoCalcBurned === 'function') autoCalcBurned();
  switchPage('training');
  window.setTimeout(() => {
    document.getElementById('training-record-anchor')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, 50);
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
  updateTrainingEditUI();
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
    const ds = toLocalIsoDate(d);
    return trainingLogs.filter(t => t.date && t.date.slice(0,10) === ds).reduce((s,t) => s+(parseFloat(t.duration)||0), 0);
  });
  const burnedArr = days.map(d => {
    const ds = toLocalIsoDate(d);
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
      <td style="display:flex;gap:6px">
        <button class="btn btn-sm btn-secondary" onclick="startEditTraining('${t.id}')"><i class="fas fa-pen"></i></button>
        <button class="btn btn-sm btn-danger" onclick="deleteTraining('${t.id}')"><i class="fas fa-trash"></i></button>
      </td>
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
    window.setTimeout(() => {
      const nextInput = document.getElementById('h-water');
      if (nextInput && typeof nextInput.focus === 'function') nextInput.focus();
    }, 80);
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
    window.setTimeout(() => {
      const nextInput = document.getElementById('r-sleep');
      if (nextInput && typeof nextInput.focus === 'function') nextInput.focus();
    }, 80);
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
    return toLocalIsoDate(d);
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

// Fight page moved to js/pages/fight.js

// Core helpers moved to js/core/helpers.js

// App init moved to js/core/init.js
