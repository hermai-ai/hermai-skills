# hermai-skills

[English](./README.md) · [繁體中文](./README.zh-Hant.md) · [简体中文](./README.zh-Hans.md) · **日本語**

[Hermai](https://hermai.ai) レジストリ向けの `hermai` agent skill — 「AI Agent のための Google」。これをあなたの agent にインストールすれば、HTML をスクレイピングする代わりに、構造化されたウェブサイト API を発見し、呼び出し、貢献できるようになります。

## インストール

```bash
npx skills add hermai-ai/hermai

# 特定の agent を対象にする
npx skills add hermai-ai/hermai -a claude-code
```

Claude Code、Codex、Cursor、OpenCode、その他 40 以上の agent で、[Vercel skills CLI](https://github.com/vercel-labs/skills) を通じて利用できます。

利用者と貢献者の両方が、プログレッシブディスクロージャにより単一の `hermai` スキルで対応されます。貢献者向けリファレンスは `references/contribute/` 配下に配置され、必要なときにのみ読み込まれます。

## このスキルでできること

- **利用する場合**: ユーザーがウェブサイトからデータを取得したいとき、例えば「allbirds.com で価格を確認して」「kayak でフライトを探して」「zillow からリスティングを取得して」といったリクエストで発動します。agent に対して、レジストリでサイトを検索し、schema を取得し、エンドポイントテンプレートを埋め、認証が必要なアクション（Cookie、signer、bootstrap state）を処理する方法を教えます。CLI (`hermai action`、`hermai registry pull`) と直接 HTTP API の両方のパスをカバーしています。
- **貢献する場合**: ユーザーが新しいサイトをレジストリに追加したいときに発動します。agent に対して、[hermai-cli](https://github.com/hermai-ai/hermai-cli) の探索ツールキット (`hermai detect`、`wellknown`、`probe`、`extract`、`intercept`、`introspect`、`session`) を使ってエンドポイントをドキュメント化し、書き込み操作のための実際のブラウザトラフィックをキャプチャし、フォーマット v0.1 に対して schema を構成し、プッシュする方法を教えます。intent カテゴリの分類体系、ボット対策サイト向けの session-block ルール、リクエストごとに署名が必要なサイト向けの runtime block（signer JS / bootstrap JS）、そしてバリデーションエラーが仕様書にどのようにマッピングされるかをカバーしています。

貢献するにはローカルに `hermai-cli` のインストールが必要です:

```bash
go install github.com/hermai-ai/hermai-cli/cmd/hermai@latest
hermai registry login
```

完全なコマンドリファレンスは [hermai-ai/hermai-cli](https://github.com/hermai-ai/hermai-cli) を参照してください。

## リポジトリ構成

```
hermai/                              # スキル本体
  SKILL.md
  references/
    cli.md                           すべての `hermai` CLI コマンド + フラグ
    api.md                           直接 HTTP API
    sessions.md                      セッション処理、Cookie インポート、headful bootstrap
    schema-format.md                 v0.1 JSON 仕様、全フィールド
    runtime.md                       Path 1 vs Path 2、signer.js + bootstrap.js の規約
    versioning.md                    update-nudge ヘッダー + meta.skill_update ペイロード
    contribute/
      overview.md                    貢献者向けスタートガイド
      coverage-checklist.md          サイトタイプ別インタラクションチェックリスト
      platforms.md                   既知のプラットフォーム (Shopify, Shopline, WordPress, WACA)
      actions.md                     書き込み操作のキャプチャとドキュメント化
      troubleshooting.md             バリデーターエラーコード + ランタイムエラーのトリアージ
```

スキルは、YAML frontmatter (`name`、`version`、`description`) を持つ `SKILL.md` を含むディレクトリです。`references/` 配下のリファレンスは、プログレッシブディスクロージャにより必要に応じて読み込まれます。スキルが指示するまで agent のコンテキストを圧迫しません。

> **`version` についての補足:** Anthropic のスキル仕様では `name` と `description` のみが定義されています。ここでの `version` フィールドは、[`hermai/references/versioning.md`](./hermai/references/versioning.md) の update-nudge フローで使用される hermai 独自の慣例であり、Claude Code / Agent Skills ランタイムでは必須ではありません。

## リンク

- レジストリとダッシュボード: https://hermai.ai
- API: https://api.hermai.ai
- CLI: https://github.com/hermai-ai/hermai-cli
- Issues: https://github.com/hermai-ai/hermai-skills/issues
