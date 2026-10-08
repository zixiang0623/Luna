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

## Wikipedia検索
入力欄の📖ボタンをオンにすると、質問からキーワードを抜き出してWikipedia(日本語→英語)を検索し、上位の記事をAIに渡します。
AIは出典の文章を写さず、内容を自分の言葉でまとめ、根拠にした記事を[1]のように番号で示します。出典は回答の下にリンクで表示されます。

## 音声入力・読み上げ
入力欄の🎤で音声入力(日本語)、回答の🔊で読み上げ。ブラウザの音声機能を使うので設定は不要です(音声入力はChrome/Safari向け)。
