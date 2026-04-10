# 🥊 BOXER PRO — 試合管理システム

## プロジェクト概要

SE兼プロボクサー・Vu Minh Duc専用の総合コンディション管理Webアプリ。  
体重管理・食事メニュー・練習スケジュール・カロリー計算・試合目標を一括管理できる、毎日使えるダッシュボード型ツール。

関連ドキュメント:
- `ARCHITECTURE_ROADMAP.md` : 保守しやすい分割設計、月1000円以下の本番運用構成、Supabase前提の拡張ロードマップ

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
- 目標達成率プログレスバー
- 期間フィルター付き体重推移グラフ（7日/14日/30日/全期間）
- 記録一覧テーブル（削除機能付き）

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

---

## 📁 ファイル構造

```
index.html              # メインアプリ（SPA）
css/
  └── style.css         # ダークテーマCSS
js/
  └── app.js            # メインJavaScript（全ロジック）
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
- [ ] 水分摂取量の記録
- [ ] サプリメント管理
- [ ] 試合前の減量スケジュール自動生成
- [ ] 週次・月次レポートPDF出力
- [ ] 体重グラフへの試合日マーカー表示
- [ ] スパーリング記録（ラウンド数・相手・評価）
- [ ] SNS共有機能（note.com連携）
- [ ] プッシュ通知（練習リマインダー）

---

## 📅 開発日

2026年4月8日
