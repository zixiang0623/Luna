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
