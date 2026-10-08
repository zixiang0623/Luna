# 🌙 Luna

Cloudflare Workers AI のモデルを選んでチャットできる、月のAIチャット。

- `public/index.html` … UI(単一HTML)
- `src/index.js` … Worker(`/api/models`, `/api/chat`)。モデル一覧は先頭の `M`
- `wrangler.jsonc` … Workers AI バインディング `AI`

## デプロイ
Cloudflare ダッシュボード → Workers & Pages → Create → **Import a repository** で本リポジトリを選択。
デプロイコマンドは既定の `npx wrangler deploy` のまま。手元からなら `npm i && npm run deploy`。

## 公開時の保護(推奨)
誰でも使える状態だとあなたの Workers AI 枠を消費されます。
`npx wrangler secret put ACCESS_KEY` を設定すると、設定画面でキーを入れた人だけ使えます。

## AI Gateway のモデルを使う
`default` ゲートウェイを使います。アカウントIDなどの設定は不要です。
ダッシュボードの AI Gateway で、使いたいプロバイダのキーを保存(BYOK)するか Unified Billing を有効にし、
Luna の設定 → 「AI Gatewayのモデルを有効にする」で使うモデルを選びます(モデルIDの追加も可)。
外部モデルは課金が発生するので、`npx wrangler secret put ACCESS_KEY` でアクセスキーを設定することを強く推奨します。

## Web検索(β)
入力欄の🌐ボタンをオンにすると、質問からキーワードを抜き出してWikipedia(日本語→英語)を検索し、結果を参考情報としてAIに渡します。出典は回答の下にリンクで表示されます。
