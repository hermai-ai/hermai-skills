# hermai-skills

[English](./README.md) · [繁體中文](./README.zh-Hant.md) · [简体中文](./README.zh-Hans.md) · **日本語**

[Hermai](https://hermai.ai) レジストリ向けの Agent skills — 「AI Agent のための Google」。これらをあなたの agent にインストールすれば、HTML をスクレイピングする代わりに、構造化されたウェブサイト API を発見し、呼び出し、貢献できるようになります。

## インストール

```bash
# 両方の skill
npx skills add hermai-ai/hermai-skills

# どちらか一方のみ
npx skills add hermai-ai/hermai-skills --skill hermai
npx skills add hermai-ai/hermai-skills --skill hermai-contribute

# 特定の agent を対象にする
npx skills add hermai-ai/hermai-skills -a claude-code
```

Claude Code、Codex、Cursor、OpenCode、その他 40 以上の agent で、[Vercel skills CLI](https://github.com/vercel-labs/skills) を通じて利用できます。

## Skills

### `hermai` — レジストリを使う

ユーザーがウェブサイトからデータを取得したいとき、例えば「allbirds.com で価格を確認して」「kayak でフライトを探して」「zillow からリスティングを取得して」といったリクエストで発動します。agent に対して、サイトを検索し、カタログを呼び出し、エンドポイントテンプレートを埋め、ボット対策のあるサイトでの `SESSION_REQUIRED` レスポンスを処理する方法を教えます。CLI (`hermai registry pull`) と API (`curl https://api.hermai.ai/v1/catalog/...`) の両方のパスをカバーしているため、CLI がインストールされている環境でもそうでない環境でも動作します。

### `hermai-contribute` — レジストリに追加する

ユーザーが新しいサイトを登録したい、または schema をプッシュしたいときに発動します。agent に対して、[hermai-cli](https://github.com/hermai-ai/hermai-cli) の探索ツールキット (`hermai detect`、`wellknown`、`probe`、`extract`、`intercept`、`introspect`、`session`) を使ってサイトのエンドポイントをドキュメント化し、フォーマット v0.1 に対して schema を構成し、`hermai registry push` でプッシュする方法を教えます。intent カテゴリの分類体系、ボット対策サイト向けの session-block ルール(許可されるフィールド、禁止されるフィールド、禁止される name パターン)、そしてバリデーションエラーが仕様書にどのようにマッピングされるかをカバーしています。

ローカルに `hermai-cli` のインストールが必要です:

```bash
go install github.com/hermai-ai/hermai-cli/cmd/hermai@latest
hermai registry login
```

完全なインストール手順とコマンドリファレンスは [hermai-ai/hermai-cli](https://github.com/hermai-ai/hermai-cli) を参照してください。

## リポジトリ構成

```
hermai/              # 利用者向け skill
  SKILL.md
hermai-contribute/   # 貢献者向け skill
  SKILL.md
```

各 skill は、YAML frontmatter (`name`、`description`) を持つ単一の `SKILL.md` を含むディレクトリです。Vercel skills CLI が検出に必要とするのはそれだけです。

## リンク

- レジストリとダッシュボード: https://hermai.ai
- API: https://api.hermai.ai
- CLI: https://github.com/hermai-ai/hermai-cli
- Issues: https://github.com/hermai-ai/hermai-skills/issues
