# Isle of Embers — Cloudflare Pages 公開手順

構成: `public/index.html`(ゲーム) + `functions/api/rank.js`(ランキングAPI, D1)

## コマンドで公開
```
npm i -g wrangler && wrangler login
wrangler d1 create honoo-rank          # 出力された database_id を wrangler.toml に貼る
wrangler d1 execute honoo-rank --remote --file=schema.sql
wrangler pages deploy public --project-name honoo-no-shima
```
## ダッシュボードで設定する場合
Pages プロジェクト → Settings → Bindings → D1 database: 変数名 `DB` に honoo-rank を割り当て。
GitHub連携の場合は Build output directory を `public` に。

## 公開前チェック
- OGP画像 `public/ogp.png` (1200x630) を置く。index.html の og:image は https://あなたのドメイン/ogp.png の絶対URLに変更
- 不正対策は簡易(値の上限・IP毎1分3件)。荒れたら Turnstile 等を追加

## v2 更新（デイリーチャレンジ）
すでに v1 の schema.sql を実行済みなら、一度だけ次を実行:
```
wrangler d1 execute honoo-rank --remote --file=migration_v2.sql
```
その後 `wrangler pages deploy public --project-name honoo-no-shima`

## v3: Turnstile（ランキングのbot対策・任意）
1. Cloudflare ダッシュボード → Turnstile → サイト追加 → ドメインを指定 → Widget は Managed
2. 表示される **Site key** を `public/index.html` の `TSKEY=''` に貼る
3. **Secret key** を Pages の Settings → Variables and Secrets に `TURNSTILE_SECRET` として追加（Secretとして）
4. 再デプロイ。未設定ならTurnstileなしで動きます。
