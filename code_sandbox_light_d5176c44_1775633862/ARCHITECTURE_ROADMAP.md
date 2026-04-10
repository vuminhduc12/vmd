# BOXER PRO 設計・運用・拡張計画

## 目的
このドキュメントは、現在の `BOXER PRO` を次の3つの観点で整理するための設計メモです。

- 今のコードを保守しやすい構成へ分割する設計案
- 月1000円以下で維持する本番運用構成
- `Supabase` を前提にした将来拡張ロードマップ

現状は `index.html + css/style.css + js/app.js` を中心としたシングルページ構成で、個人利用には十分実用的です。一方で、機能が増えてきたため、次の段階では「壊しにくさ」と「増やしやすさ」を優先した整理が必要です。

---

## 1. 保守しやすい構成へ分割する設計案

## 設計方針
- まずは `フレームワーク導入なし` で整理する
- 既存UIを崩さず、`責務ごとにファイル分割` する
- `localStorage` と将来の `Supabase` を両立できるように、データ入出力を共通化する
- `画面描画` と `データ取得/保存` と `計算ロジック` を分ける

## 推奨ディレクトリ構成

```text
index.html
css/
  style.css
js/
  app.js
  core/
    state.js
    constants.js
    utils.js
    dates.js
    formatters.js
  storage/
    storage-adapter.js
    local-storage-repo.js
    api-repo.js
    sync-service.js
  modules/
    dashboard.js
    weight.js
    meals.js
    training.js
    calories.js
    fight.js
    settings.js
    reminders.js
    cutting-plan.js
  charts/
    chart-theme.js
    weight-chart.js
    pfc-chart.js
    training-chart.js
  bootstrap/
    init.js
    events.js
data/
  weight-cut-plan.csv
```

## 役割分担

### `core/`
- アプリ全体で使う定数、日付処理、フォーマット関数、共有状態を置く
- UIやAPIに依存しない純粋関数を優先する

### `storage/`
- 保存先を吸収する層
- `localStorage`、既存API、将来の `Supabase` をここだけで切り替えられる形にする
- 他モジュールは `saveWeight()` のような機能名で呼び、保存方式を意識しない

### `modules/`
- 機能単位の画面ロジックを分離する
- 例: `fight.js` は試合目標、減量警告、食事プラン表示だけに責務を限定する

### `charts/`
- Chart.js のオプションや描画関数を画面ロジックから分離する
- 色・グラデーション・共通プラグインをまとめてUI品質を安定させる

### `bootstrap/`
- 初期化順序とイベントバインドを整理する
- 将来の機能追加時に「どこで初期化されるか」が分かりやすくなる

## データアクセス設計

現状の課題は、各機能が `app.js` 内で直接保存処理を触りやすいことです。これを避けるため、以下のような抽象を置きます。

```js
// storage/storage-adapter.js
export const storageAdapter = {
  getWeightLogs,
  saveWeightLog,
  deleteWeightLog,
  getMeals,
  saveMeal,
  // ...
};
```

この形にしておくと、初期は `localStorage` 実装、将来は `Supabase` 実装に差し替えるだけで済みます。

## 優先分割順
一気に全部分割すると壊しやすいので、順番を決めて進めます。

1. `constants / utils / formatters` を分離
2. `storage` 層を分離
3. `cutting-plan` と `fight` を分離
4. `weight` と `dashboard` を分離
5. `training / meals / calories / settings / reminders` を順次分離

## 命名とルール
- DOM取得は `getEl('id')` のような薄い共通関数を通す
- 1ファイル1責務を守る
- `renderXxx()` は描画のみ、`saveXxx()` は保存のみ、`calcXxx()` は計算のみ
- 画面用の一時状態と永続データを混ぜない
- `schemaVersion` を保存データに含めて将来の移行を可能にする

## この構成で得られる効果
- 機能追加時に触る範囲が小さくなる
- バグの切り分けが早くなる
- 将来 `Supabase` を入れても全面書き換えになりにくい
- UI改善とデータ同期改善を別々に進められる

---

## 2. 月1000円以下の本番運用構成図

## 方針
- フロントは静的配信
- 個人利用の間は無料枠を最大活用
- コストが出る要素は `独自ドメイン` と `有料DB移行` のみ
- まずは `無料 or ほぼ無料` を前提にする

## 推奨構成図

```text
[ iPhone Safari / ホーム画面アプリ ]
                |
                v
     [ Cloudflare Pages / 静的ホスティング ]
                |
        +-------+--------+
        |                |
        v                v
[ localStorage ]   [ Supabase Free ]
  個人端末保存        認証 / DB / 将来同期
```

## 役割
- `Cloudflare Pages`
  - `index.html`, `css`, `js`, `manifest`, `service-worker` を配信
  - HTTPS対応
  - iPhoneでのPWA利用を成立させる

- `localStorage`
  - 即時保存
  - オフライン利用
  - 個人用の軽量運用

- `Supabase Free`
  - 将来のログ同期
  - 認証
  - バックアップ性の向上

## 月額コスト想定

| 項目 | サービス | 想定月額 |
|---|---|---:|
| 静的ホスティング | Cloudflare Pages | 0円 |
| SSL/HTTPS | Cloudflare Pages込み | 0円 |
| 個人データ保存 | localStorage | 0円 |
| 認証/DB | Supabase Free | 0円 |
| 独自ドメイン | 任意 | 0〜200円相当/月 |
| 合計 | 初期運用 | 0〜200円相当/月 |

`月1000円以内` どころか、個人利用フェーズでは `実質0円運用` が可能です。

## 本番運用の段階

### フェーズ1: 最小本番
- Cloudflare Pages に公開
- データ保存は `localStorage`
- JSONバックアップ/リストアを定期実施

### フェーズ2: 低コスト安定運用
- Supabase Free を追加
- ユーザー認証を導入
- `ローカル保存 + クラウド同期` の併用へ移行

### フェーズ3: 拡張本番
- 利用量が無料枠を超えたら有料化を検討
- ただし個人ユースならかなり長く無料枠で持つ想定

## 運用ルール
- 毎週または毎月、JSONバックアップを1回取得
- 破壊的変更時は `schemaVersion` を更新
- `service-worker` 更新時は `CACHE_NAME` を上げる
- 公開前に iPhone Safari で `ホーム画面追加` 動作を確認

---

## 3. Supabase前提の将来拡張ロードマップ

## 目標
- iPhoneとPCで同じデータを使えるようにする
- バックアップ不安を減らす
- 将来のSaaS化に備えてデータ基盤を作る

## ロードマップ

### Phase 0: 現状維持
- 現在の `PWA + localStorage` を維持
- 先にコード分割とデータ層の抽象化を行う

### Phase 1: Supabase導入準備
- `storageAdapter` を完成させる
- データモデルとテーブル設計を固定する
- `created_at`, `updated_at`, `user_id`, `deleted_at` の基本列を定義する

推奨テーブル:
- `profiles`
- `weight_logs`
- `meal_logs`
- `training_logs`
- `hydration_logs`
- `recovery_logs`
- `fight_goals`
- `app_settings`
- `cutting_plan_templates`

### Phase 2: 認証導入
- Supabase Auth でメールログインまたはOTPログイン
- 1ユーザー前提でも `user_id` を全テーブルに持たせる
- RLSで自分のデータしか見えないようにする

### Phase 3: 読み取り同期
- まずは `設定` と `最新ログ` から同期
- 起動時にクラウドデータを取得
- クラウドが失敗したらローカルで継続

### Phase 4: 書き込み同期
- 新規保存時に `localStorage` と `Supabase` の両方へ保存
- ネット接続復帰時に未同期データを再送する
- `sync_queue` 的な考え方を導入する

### Phase 5: 比較・分析強化
- `計画 vs 実績` 比較
- 週報/月報の自動生成
- 目標体重レンジとの差分警告
- 練習量と体重変動の相関表示

### Phase 6: SaaS準備
- 複数プロフィール
- コーチ共有
- CSV/PDF出力
- 管理画面

## Supabase導入時の技術ポイント

### 認証
- まずは `Magic Link` または `OTP` が簡単
- パスワード運用を避けやすく、個人利用にも合う

### DB
- PostgreSQL ベースなので集計や比較機能に強い
- `計画 vs 実績` のような横断集計に向いている

### セキュリティ
- 必ず `RLS` を有効化する
- `anon key` はフロントに置いてよいが、`service_role key` は置かない

### 実装方針
- 先に `read only sync`
- 問題がなければ `write sync`
- 最後に `offline sync` を入れる

全面移行ではなく、段階移行にすることで壊れにくくします。

---

## 推奨実行順

今すぐ着手する順番は以下を推奨します。

1. `app.js` を `core / storage / modules` に分割する
2. Cloudflare Pages へ公開する
3. iPhone で PWA 動作確認をする
4. JSONバックアップ運用を始める
5. `storageAdapter` を導入する
6. Supabase のテーブル設計と RLS を作る
7. `設定` と `体重ログ` から同期を始める

---

## まとめ

今の実装は、`個人用の低コストPWA` としてはかなり良いスタートです。  
次に必要なのは、フロントの全面作り直しではなく、`責務分離` と `データ層の抽象化` です。

この順番で進めれば、

- 月1000円以内で維持できる
- iPhone中心の毎日運用に耐えられる
- 将来 `Supabase` を追加しても破綻しにくい

という形に持っていけます。
