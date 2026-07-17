# Chronology Studio

文学史、美術史、思想史などを対象に、人物・思想潮流・雑誌・団体・作品・戦争・イベント等を時間軸上へ配置する年表作成支援Webアプリです。

詳細仕様は [`SPEC.md`](./SPEC.md)、実装規則は [`AGENTS.md`](./AGENTS.md)、実装フェーズは [`TASKS.md`](./TASKS.md) を参照してください。

## 技術構成

- Next.js App Router / TypeScript / pnpm
- Tailwind CSS / shadcn/ui / Radix UI
- Supabase PostgreSQL / Auth / Google OAuth
- Vercel
- Vitest / React Testing Library / Playwright

## 必要な環境

- Node.js 20.9以降
- pnpm 11
- Docker Desktop
- Supabase CLI（devDependencyとして導入済み）

## セットアップ

```bash
pnpm install
Copy-Item .env.example .env.local
```

`.env.local`へ以下を設定します。Service RoleまたはSecret Keyをブラウザ用変数へ設定してはいけません。

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
NEXT_PUBLIC_APP_URL=http://localhost:3000
E2E_TEST_AUTH=false
E2E_TEST_AUTH_SECRET=
SUPABASE_SERVICE_ROLE_KEY=
```

通常の開発では `E2E_TEST_AUTH` を必ず `false` にします。テストスクリプトはローカルSupabaseの値をプロセス環境へ一時設定し、コミット可能なファイルへ秘密値を保存しません。

## ローカルSupabase

```bash
pnpm exec supabase start
pnpm exec supabase db reset
pnpm dev
```

ローカルのGoogle OAuthを手動確認する場合は、Google CloudのWeb OAuthクライアントを作成し、次を設定します。

- Authorized JavaScript origin: `http://localhost:3000`
- Authorized redirect URI: `http://127.0.0.1:54321/auth/v1/callback`

続いて、クライアントIDとSecretを環境変数へ設定し、`supabase/config.toml` の `[auth.external.google]` を `enabled = true` にします。

```env
SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID=
SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_SECRET=
```

クラウドSupabaseへ接続してlocalhostからGoogle OAuthを開始した場合、開発環境ではアクセス元のlocalhostを戻り先に使用します。`NEXT_PUBLIC_APP_URL` が本番URLでも、認証後は `http://localhost:3000/auth/callback` または `http://127.0.0.1:3000/auth/callback` へ戻ります。Google CloudとSupabaseのRedirect URL許可リストには、使用するlocalhost URLを登録してください。

## Supabase CloudのGoogle OAuth設定

1. Google Auth PlatformでAudience、Branding、Data Accessを設定します。
2. Data Accessへ `openid`、`userinfo.email`、`userinfo.profile` を追加します。
3. Web application OAuthクライアントを作成します。
4. Authorized JavaScript originsへ本番URLを追加します。
5. Authorized redirect URIsへ次を追加します。

```text
https://olqembomrhtttpxabweh.supabase.co/auth/v1/callback
```

6. Supabase Dashboardの Authentication → Sign In / Providers → Google でClient IDとClient Secretを登録し、Googleだけを有効化します。
7. Authentication → URL Configurationで次を設定します。

```text
Site URL: https://<production-domain>
Redirect URL: https://<production-domain>/auth/callback
Redirect URL: http://localhost:3000/auth/callback
```

Vercel PreviewをGoogleログインの確認対象にする場合は、利用するPreview URLもSupabaseのRedirect allow listへ追加してください。

## Vercel環境変数

Development、Preview、Productionの各環境へ次を設定します。

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
NEXT_PUBLIC_APP_URL
E2E_TEST_AUTH=false
```

`SUPABASE_SERVICE_ROLE_KEY` と `E2E_TEST_AUTH_SECRET` は通常のVercel環境へ登録しません。

## 本番DBマイグレーション

本番Supabaseへローカル端末から直接変更を適用しません。`supabase/migrations/` の変更をコミットし、GitHub Actionsの `Deploy Supabase Migrations` を手動実行します。

GitHubの `production` Environmentへ次を設定します。

```text
Secret:   SUPABASE_ACCESS_TOKEN
Secret:   SUPABASE_DB_PASSWORD
Variable: SUPABASE_PROJECT_ID
```

`SUPABASE_DB_PASSWORD` はCLIのパスワードレス接続が利用できない場合に使用されます。ワークフローは確認文字列 `deploy-production` を要求し、`db push --dry-run` の成功後に未適用マイグレーションだけを適用します。本番へシードデータは投入しません。

## プロジェクト管理

認証後の `/projects` で、非公開プロジェクトの作成、一覧、設定変更、完全削除を行えます。作成時は名前だけで開始でき、表示範囲、曖昧期間の既定値、初期ズーム、表示密度、最小時間単位を詳細設定できます。

- `projects.owner_id` はサーバーセッションの `auth.uid()` から設定し、クライアント入力は使用しません。
- `projects` と `project_settings` はRLSにより所有者だけが参照・更新・削除できます。
- 新規プロジェクトの公開状態は必ず `private` です。
- プロジェクト削除時は名前の再入力が必要で、設定を含む配下データは `ON DELETE CASCADE` で完全削除されます。
- テンプレート選択は作成APIで検証します。テンプレート別の対象種別投入はPhase 3で同じ作成フローへ接続します。

Phase 2で提供するAPI：

```text
GET    /api/projects
POST   /api/projects
GET    /api/projects/[projectId]
PATCH  /api/projects/[projectId]
DELETE /api/projects/[projectId]
```

## 検証

```bash
pnpm verify:commit
```

次を順番に実行します。

- Prettier
- ESLint
- TypeScript
- Vitest単体・コンポーネントテスト
- ローカルSupabase統合テスト
- Playwright E2E
- マイグレーションリセット
- Next.js本番ビルド

統合・E2E・マイグレーション検証はDocker上のローカルSupabaseを自動起動します。E2Eは開発サーバーと同時実行できるよう、専用のポート `3100` とビルド領域を使用します。

## セキュリティ

- アプリ全体へ `noindex`、`nofollow`、`noarchive`、`nosnippet`、`noimageindex` を設定しています。
- `noindex`はアクセス制御ではありません。非公開データは認証、サーバー側認可、RLSで保護します。
- テスト認証エンドポイントは `E2E_TEST_AUTH=true` かつテスト用Secretが一致するローカルテスト時だけ動作します。
- `.env*`、Supabase Secret Key、Service Role KeyはGitへコミットしません。
