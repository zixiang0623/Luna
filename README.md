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
1. ダッシュボードで AI Gateway を作成し、`wrangler.jsonc` の `vars` に `CF_ACCOUNT_ID` と `GATEWAY_ID` を設定してデプロイ。
2. プロバイダのキーはゲートウェイ側(BYOK)に保存するか、Unified Billing を使う。ゲートウェイの認証を有効にした場合は
   `npx wrangler secret put CF_AIG_TOKEN` でトークンを設定。
3. Luna の設定 → 「AI Gatewayのモデルを有効にする」で使うモデルを選ぶ(モデルIDの追加も可)。
外部モデルは課金が発生するので、`ACCESS_KEY` の設定を強く推奨します。
