# Supabase + Google ログイン — この順で進める

既に **SQL** と **Google プロバイダ有効化** が終わっている前提です。残りを **上から順に** 1 つずつ完了させてください。

---

## ステップ 1 — Google Cloud（リダイレクト URI）

1. [Google Cloud Console](https://console.cloud.google.com/) → **API とサービス** → **認証情報**
2. 使っている **OAuth 2.0 クライアント ID**（ウェブアプリ）を開く
3. **承認済みのリダイレクト URI** に、次を **そのまま** 追加（Supabase の Google 設定画面の **Callback URL** と同じ文字列）

   `https://<PROJECT_REF>.supabase.co/auth/v1/callback`

4. **保存**

---

## ステップ 2 — Supabase（アプリに戻る URL）

1. Supabase ダッシュボード → **Authentication** → **URL Configuration**
2. **Site URL** に、いちばんよく開く本番 URL を入れる（例: `https://あなたのサブドメイン.workers.dev/`）
3. **Redirect URLs** に、**Google ログイン後にブラウザが戻る URL** を追加する  
   - 本番: `https://あなたのサブドメイン.workers.dev/`  
   - 末尾の `/` の有無で一致しないことがあるので、**開いたときのアドレスと同じ形**で **両方** 試す場合もある（例: `/` ありとなし）
   - ローカルで試すなら例: `http://127.0.0.1:5500/` など **実際に使う URL**
4. **Save**

---

## ステップ 3 — `js/config.js`（プロジェクト接続）

1. Supabase → **Project Settings** → **API**
2. **Project URL** をコピー → `supabaseUrl` に貼る
3. **Project API keys** の **anon** **public** をコピー → `supabaseAnonKey` に貼る
4. ファイルを保存

テンプレは `js/config.example.js` も参照。

---

## ステップ 4 — デプロイ

プロジェクトルートで:

```bash
npm run deploy
```

（`wrangler deploy` と同じ）

`js/config.js` が **本番に含まれる**ことを確認する（Git にコミットしてデプロイする運用なら push も）。

---

## ステップ 5 — 動作確認

1. ブラウザで **本番 URL** を開く（シークレットウィンドウ推奨）
2. **マイ設定** → **Google でログイン**
3. 成功したら上部バッジが **クラウド (Supabase)** 付近に切り替わる
4. 以前ローカルにだけあったデータがある場合 → **この端末のデータをクラウドへマージ**

---

## うまくいかないとき

| 現象 | 確認 |
|------|------|
| `redirect_uri_mismatch` | Google のリダイレクト URI に **Supabase の callback** が完全一致で入っているか |
| ログイン後にエラー | Supabase の **Redirect URLs** に **今開いているページの URL** が入っているか |
| ボタン押しても反応なし | `js/config.js` の URL/キーが空でないか、デプロイ後の **キャッシュ**（強制再読み込み） |

---

## 完了の目安

- Google でログインできる  
- 記録の保存後、別ブラウザで同じアカウントにログインするとデータが見える（クラウド側に保存されている）
