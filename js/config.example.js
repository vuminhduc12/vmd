// 手順の全体: docs/SUPABASE_SETUP_ORDER_JA.md（上から順に実施）
// Copy this file to `js/config.js` and fill in values from:
// Supabase Dashboard → Project Settings → API
// (anon public key is safe to embed; protect data with RLS, not secrecy of this key.)
window.BOXER_PRO_CONFIG = {
  supabaseUrl: 'https://YOUR_PROJECT_REF.supabase.co',
  supabaseAnonKey: 'YOUR_SUPABASE_ANON_KEY',
};
