# Chronology Studio

文学史、美術史、思想史などを対象に、人物・思想潮流・雑誌・団体・作品・戦争・出来事を時間軸上へ配置し、同時代性や関係を調査・編集・公開する年表作成Webアプリです。

- 機能とデータの仕様：[`SPEC.md`](./SPEC.md)
- 実装規則：[`AGENTS.md`](./AGENTS.md)
- 今後の実装順：[`TASKS.md`](./TASKS.md)

## 提供中の機能

- Google OAuth、所有者単位の非公開プロジェクト、Supabase RLS
- 文学史・美術史・思想史・汎用・空プロジェクトのテンプレート
- 対象種別の追加、編集、色・アイコン・順序・表示状態の管理
- 期間型／時点型タイムラインアイテムと、期間型項目に属するイベントアイテム
- 紀元後／紀元前、年・月・日／年代／世紀精度、手動日付表記、「日付 頃」の概算表示、継続中、終了時期不明
- 行表示とコンパクトレーン表示、パン、ズーム、自動目盛り、fit-range
- アプリ内最大化／Fullscreen、垂直年代線、全期間ミニマップ、時間スライサー、年代ジャンプ、位置ブックマーク
- 表示年代・ズーム・フィルター・配置・レイアウトを設定JSONだけで保持する保存済みビュー
- 手動／自動並べ替え、対象種別グループ、非表示項目グループ
- 表示座標に基づくイベントクラスタリング
- URL連動詳細オーバーレイ、通常詳細ページ、右サイドパネル編集
- プロジェクト内フィルター、日本語全文検索、アプリ全体検索
- 公開URL、匿名閲覧、公開URL再発行、`noindex`
- JSONバックアップ、CSV／ZIP入出力、インポートプレビュー
- DB・JSON・CSVの現行版v2、旧JSON／CSVの段階的な自動移行、未知版の安全な拒否
- タイムラインアイテム／イベントアイテムの共通参照、Feature Flag、保持上限の共通基盤
- PCとスマートフォンでの閲覧・編集、キーボード操作

## 今後追加する機能

実装順と完了条件は `TASKS.md` を正とします。

- 詳細・編集：同一URL内の閲覧／編集切り替え、フォーム幅変更、ゴシック体／明朝体の書体切り替え
- 安全性：差分履歴、手動チェックポイント、ゴミ箱、復元、一括操作単位のUndo
- 本文：安全なMarkdown、即時プレビュー、コールアウト、プロジェクト内リンク、別名
- 調査情報：構造化された出典・参考文献、引用記法、BibTeX／CSL JSON連携余地
- 編集効率：完全自動保存、オフライン下書き、競合検出、タグ、イベント種別、カスタムフィールド
- データ構造：イベントの複数親、意味的関係、タイムライン上の線・矢印
- 大量編集：テーブルビュー、セル編集、一括操作、任意CSVの列マッピング
- 時代把握：年代背景レイヤー、データ品質チェック、重複候補と参照を保った統合
- 探索・分析：関連ネットワーク、プロジェクト横断比較、統計情報
- 公開・出力：下書きと公開版の分離、SVG／PNG／PDF出力
- ローカル利用：ログイン前ローカルモード、IndexedDB、PWA、オフライン編集、クラウド取込
- Windows版：ローカルDB、画像、長期履歴を扱う独立製品系列

## 技術構成

- Next.js App Router / React / TypeScript / pnpm
- Tailwind CSS / shadcn/ui / Radix UI
- TanStack Query / Zustand / React Hook Form / Zod
- Supabase PostgreSQL / Auth / RLS / PGroonga
- Vercel
- Vitest / React Testing Library / Playwright / Supabase CLI

## 必要な環境

- Node.js 22.12以降
- pnpm 11
- Docker Desktop
- Supabase CLI（devDependencyとして導入済み）

## セットアップ

```powershell
pnpm install
Copy-Item .env.example .env.local
```

`.env.local` へ次を設定します。Service Role KeyまたはSecret Keyをブラウザ用変数へ設定してはいけません。

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
NEXT_PUBLIC_APP_URL=http://localhost:3000
E2E_TEST_AUTH=false
E2E_TEST_AUTH_SECRET=
SUPABASE_SERVICE_ROLE_KEY=
FEATURE_FLAGS=
```

`FEATURE_FLAGS` は後続機能の段階導入用です。カンマ区切りで有効化し、先頭に `-` を付けると明示的に無効化します。既定ではすべて無効です。

```env
FEATURE_FLAGS=historicalDateModelV2,autosave
```

通常開発では `E2E_TEST_AUTH=false` とします。テストスクリプトはローカルSupabaseの値をプロセス環境へ一時設定し、コミット可能なファイルへ秘密値を保存しません。

## ローカル開発

```powershell
pnpm exec supabase start
pnpm exec supabase db reset
pnpm dev
```

ローカルでGoogle OAuthを確認する場合は、Google CloudのWeb OAuthクライアントへ次を設定します。

```text
Authorized JavaScript origin: http://localhost:3000
Authorized redirect URI: http://127.0.0.1:54621/auth/v1/callback
```

続いてクライアントIDとSecretを環境変数へ設定し、`supabase/config.toml` の `[auth.external.google]` を `enabled = true` にします。

```env
SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID=
SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_SECRET=
```

クラウドSupabaseへlocalhostから接続する場合は、Google CloudとSupabaseのRedirect URL許可リストへ使用するlocalhostの `/auth/callback` を追加してください。

## 本番設定

Google Auth PlatformでAudience、Branding、Data Accessを設定し、`openid`、`userinfo.email`、`userinfo.profile` を許可します。Supabase DashboardではGoogleだけを認証プロバイダーとして有効化し、Site URLと許可する `/auth/callback` を登録します。

VercelのDevelopment、Preview、Productionへ次を設定します。

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
NEXT_PUBLIC_APP_URL
E2E_TEST_AUTH=false
```

`SUPABASE_SERVICE_ROLE_KEY` と `E2E_TEST_AUTH_SECRET` は通常のVercel環境へ登録しません。

本番DBはローカル端末から直接変更しません。`supabase/migrations/` をコミットし、GitHub Actionsの `Deploy Supabase Migrations` を手動実行します。GitHubの `production` Environmentには次を設定します。

```text
Secret:   SUPABASE_ACCESS_TOKEN
Secret:   SUPABASE_DB_PASSWORD
Variable: SUPABASE_PROJECT_ID
```

ワークフローは確認文字列 `deploy-production` と `db push --dry-run` の成功を要求し、未適用マイグレーションだけを適用します。本番へシードデータは投入しません。

## データと容量の方針

Web版はSupabase無料枠の範囲で継続運用できる設計とします。容量は管理者がSupabase Dashboardで確認し、アプリ内の容量監視、診断画面、警告通知は実装しません。

- 履歴とゴミ箱には保持期間・保持数・容量上限を設ける
- Markdown原文とレンダリング済みHTMLを二重保存しない
- 統計、ネットワーク自動配置、描画結果など再生成可能な派生データを恒久保存しない
- 画像、添付ファイル、生成したSVG／PNG／PDFをSupabaseへ恒久保存しない
- 自動保存の未送信下書きはIndexedDBへ置く
- 公開版は必要なデータと少数世代に限定する
- 無制限履歴、画像管理、長期スナップショットはWindows版の候補とする

## アーキテクチャ

- UIからSupabaseへ直接書き込まず、Route HandlerまたはServer Actionからservice／repositoryを利用する
- 認証、所有権、公開状態はサーバー側とRLSで検証する
- 永続データはSupabase、APIキャッシュはTanStack Query、一時タイムライン状態はZustand、フォームはReact Hook Formで管理する
- 入力はZodとDB制約の両方で検証する
- 歴史日付をJavaScript `Date`へ安易に変換せず、タイムゾーンによる日付ずれを防ぐ
- タイムラインの座標変換、目盛り、クラスタリング、レーン割り当ては純粋関数を中心に自前実装する
- 1プロジェクトあたり1,000項目・10,000イベントを性能目標とする

## 検証

```powershell
pnpm verify:commit
```

このコマンドはformat、lint、typecheck、unit、integration、E2E、migration、buildを実行します。個別コマンドは `package.json` を参照してください。

## Git運用

個人開発では原則 `main` 上で、1つの論理変更または目的ごとにコミットします。例外的な長期・並列作業だけ別ブランチを検討します。

コミットメッセージは英語で、`fix: `、`feat: `、`docs: `、`refactor: `、`chore: ` 等の接頭辞を付けます。コミット前に必ず `pnpm verify:commit` を成功させます。

## セキュリティ

- Service Role Keyをブラウザ、ログ、テスト出力、コミットへ含めない
- `.env*` の秘密値をコミットしない
- クライアントからの `ownerId` を信用しない
- 非公開リソースの存在を所有者以外へ漏らさない
- 自由記述とMarkdownは許可要素だけを安全に描画する
- 外部URLは許可プロトコルを検証する
- `noindex` を認可の代替にしない
