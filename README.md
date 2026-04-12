# 🥊 BOXER PRO — 試合管理システム

## プロジェクト概要

SE兼プロボクサー・Vu Minh Duc専用の総合コンディション管理Webアプリ。  
体重管理・食事メニュー・練習スケジュール・カロリー計算・試合目標を一括管理できる、毎日使えるダッシュボード型ツール。

関連ドキュメント:
- `ARCHITECTURE_ROADMAP.md` : 保守しやすい分割設計、月1000円以下の本番運用構成、Supabase前提の拡張ロードマップ

---

## 現在の到達点

日常利用できる機能はかなり揃っており、個人利用には十分入っています。  
一方で「他人にそのまま配って迷わず使ってもらう」観点では、次の前提があります。

- 初回利用時は `マイ設定` の入力が必要
- クラウド同期を使うなら Supabase と Google ログイン設定が必要
- スマホでは一覧テーブルの一部が横スクロール前提
- PWA / ローカル保存で即利用はできるが、運用説明は README を読まないと不足しやすい

このため、本リポジトリではアプリ内の初回ガイドと README のセットアップ説明を追加しています。

---

## すぐ使う方法

### 1. ローカルだけで試す

静的ファイルを配信できれば動きます。最小構成なら次のどちらかです。

```bash
python3 -m http.server 5500
```

または Cloudflare Pages / Workers などの静的ホスティングに配置します。

### 2. ブラウザで開いたら最初にやること

1. `マイ設定` で身長・年齢・目標体重・既定 kcal を保存
2. `体重管理` で朝または夜の体重を 1 件登録
3. `食事メニュー` か `練習スケジュール` を 1 件登録
4. 必要なら `マイ設定` から Google ログインしてクラウド同期

### 3. クラウド同期を有効にする場合

1. `js/config.example.js` を参考に `js/config.js` を設定
2. Supabase で `supabase/migrations/001_boxer_pro_schema.sql` を実行
3. Authentication → Google を有効化
4. Redirect URL / Site URL を現在の公開 URL に合わせて設定
5. `docs/SUPABASE_SETUP_ORDER_JA.md` の順で確認

補足:
- `supabaseAnonKey` には Secret key ではなく Publishable / anon key を使います
- Supabase 未設定でもローカル保存で動作します

### 4. 管理者だけが登録ユーザー数を見る場合

この機能は `Cloudflare Worker` 側で `service_role key` を使って集計します。  
`service_role key` を `js/config.js` に置いてはいけません。

必要な Worker 環境変数:
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ADMIN_EMAILS`

例:

```bash
wrangler secret put SUPABASE_URL
wrangler secret put SUPABASE_ANON_KEY
wrangler secret put SUPABASE_SERVICE_ROLE_KEY
wrangler secret put ADMIN_EMAILS
```

`ADMIN_EMAILS` には、管理者にしたい Google メールアドレスをカンマ区切りまたは改行区切りで入れます。  
設定後、対象メールでログインしたユーザーにだけ `マイ設定 > 管理者統計` カードが表示されます。

---

## 他人に使ってもらうときの前提

- 共有先がそのまま同じ Supabase プロジェクトを使う構成なら、RLS 前提でユーザー分離されます
- ただし本番公開するなら、運用者が Supabase / Google OAuth / ドメイン設定を管理する必要があります
- 端末変更や障害対応のため、`マイ設定` の JSON バックアップを案内した方が安全です

---

## ✅ 実装済み機能

### 🏠 ダッシュボード
- 今日の体重・カロリー・タンパク質・練習時間のKPIカード（4枚）
- 体重推移グラフ（直近14日）
- 今日のPFCバランスドーナツチャート
- クイック体重記録フォーム
- クイック練習記録フォーム
- 試合カウントダウン表示（次の試合まで○日）
- 最近の記録アクティビティフィード

### ⚖️ 体重管理
- 体重・体脂肪率・筋肉量・目標体重の記録
- 朝 / 夜の 1 日 2 枠記録
- 目標達成率プログレスバー
- 期間フィルター付き体重推移グラフ（7日/14日/30日/全期間）
- 記録一覧テーブル（選択編集 / 個別削除）

### 🍱 食事メニュー管理
- 食事タイプ別記録（朝食/昼食/夕食/間食/プロテイン）
- PFC（タンパク質・脂質・炭水化物）詳細入力
- 食品データベース検索（25種類以上のボクサー向け食品）
- 日別食事サマリー（kcal/P/F/C）
- PFCバランスグラフ
- 日付・食事タイプフィルター付き一覧

### 🥊 練習スケジュール管理
- 種目別練習記録（シャドー/サンドバッグ/ミット打ち/スパーリング/ロードワーク/筋トレ/縄跳び/ストレッチ）
- 強度設定（低/中/高/最大）
- 消費カロリー自動計算（種目×強度×時間で推定）
- 今週の練習サマリー（回数・合計時間・消費kcal）
- 週次練習バーチャート
- 月次練習カレンダー（練習した日に🥊マーク表示）
- 記録一覧テーブル

### 🔥 カロリー計算
- BMR（基礎代謝）計算（Mifflin-St Jeor式）
- TDEE（1日の総消費カロリー）計算
- 目標別カロリー推奨（減量80%/維持100%/増量110%）
- ボクサー向けPFC推奨量（タンパク質：体重×2.2g）
- 摂取vs消費カロリーの7日間バーチャート
- 今日のカロリー収支表示

### 🏆 試合目標管理
- 試合日・対戦相手・階級・目標体重・会場の登録
- 試合までのカウントダウン表示
- 減量進捗プログレスバー
- 試合カード一覧（準備中/完了/中止ステータス管理）

### ☁️ 運用 / 同期
- ローカル保存フォールバック
- Supabase + Google ログイン
- ローカルデータのクラウドマージ
- JSON バックアップ / 復元
- PWA インストール対応
- Service Worker によるオフラインキャッシュ

---

## 📁 ファイル構造

```
index.html              # メインアプリ（SPA）
css/
  └── style.css         # ダークテーマCSS
js/
  ├── app.js            # メインJavaScript（全ロジック）
  ├── config.js         # Supabase 接続設定
  └── config.example.js # 設定テンプレート
docs/
  └── SUPABASE_SETUP_ORDER_JA.md
supabase/
  └── migrations/001_boxer_pro_schema.sql
service-worker.js       # PWA キャッシュ
README.md               # このファイル
```

---

## 🗄️ データモデル

| テーブル名 | 説明 | 主要フィールド |
|---|---|---|
| `weight_logs` | 体重記録 | date, weight, body_fat, muscle_mass, target_weight |
| `meals` | 食事記録 | date, meal_type, food_name, calories, protein, fat, carbs |
| `training_logs` | 練習記録 | date, training_type, duration, intensity, calories_burned |
| `fight_goals` | 試合目標 | fight_date, opponent, weight_class, target_weight, status |
| `hydration_logs` | 水分記録 | date, water_ml, timing, note |
| `recovery_logs` | 回復記録 | date, sleep_hours, condition_score, fatigue_score |

---

## 🔗 データ保存方式

- 既定はローカル保存
- `tables/*` API が使える環境では API 保存
- Supabase 設定済みかつログイン済みなら Supabase 保存

ローカル保存しかなくても主要機能は利用できます。

---

## 🔗 APIエンドポイント

| メソッド | パス | 説明 |
|---|---|---|
| GET | `tables/weight_logs?limit=500` | 体重記録一覧 |
| POST | `tables/weight_logs` | 体重記録追加 |
| DELETE | `tables/weight_logs/{id}` | 体重記録削除 |
| GET | `tables/meals?limit=500` | 食事記録一覧 |
| POST | `tables/meals` | 食事記録追加 |
| DELETE | `tables/meals/{id}` | 食事記録削除 |
| GET | `tables/training_logs?limit=500` | 練習記録一覧 |
| POST | `tables/training_logs` | 練習記録追加 |
| DELETE | `tables/training_logs/{id}` | 練習記録削除 |
| GET | `tables/fight_goals?limit=500` | 試合目標一覧 |
| POST | `tables/fight_goals` | 試合目標追加 |
| DELETE | `tables/fight_goals/{id}` | 試合目標削除 |

---

## 🚀 今後の拡張案

- [ ] データのCSVエクスポート機能
- [ ] サプリメント管理
- [ ] 試合前の減量スケジュール自動生成
- [ ] 週次・月次レポートPDF出力
- [ ] 体重グラフへの試合日マーカー表示
- [ ] スパーリング記録（ラウンド数・相手・評価）
- [ ] SNS共有機能（note.com連携）
- [ ] プッシュ通知（練習リマインダー）

---

## 現時点の注意点

- スマホでは表形式の一覧が横スクロールになる画面があります
- クラウド同期の品質は Supabase / Google OAuth 設定に依存します
- `weight-cut-plan.csv` は固定 CSV なので、他選手向けには内容更新が必要です
- マルチテナント SaaS として公開するなら、利用規約・障害対応・データ保持方針は別途整備が必要です

---

## 📅 開発日

2026年4月8日

（リポジトリ名: `vmd`）
