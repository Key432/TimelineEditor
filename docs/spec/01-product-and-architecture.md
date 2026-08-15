# プロダクト・技術・権限・API

## 1. 文書の目的

本書は、完成済み機能と今後実装する機能を含む、タイムライン作成支援Webアプリの目標仕様書である。実装済みかどうかと実装順序は `TASKS.md` を正とし、本書には実装経緯を記載しない。

本アプリは、文学史・美術史・思想史などを対象に、人物・思想潮流・雑誌・団体・作品・戦争・イベント等を時間軸上へ配置し、同時代性や影響関係を視覚的に確認できる年表作成環境を提供する。

実装規則は `AGENTS.md`、実装順序は `TASKS.md` を参照すること。

---

## 2. プロダクト概要

### 2.1 主目的

ユーザーが開始日、終了日、対象種別、説明、イベントアイテム等を登録することで、横方向へ連続する時間軸上に年表を自動生成できるようにする。

主な利用例：

- 文学史における作家の生没年と作品発表
- 美術史における芸術家、芸術運動、展覧会
- 思想史における思想家、学派、文献刊行
- 雑誌、団体、戦争、社会事件の存続期間比較

### 2.2 基本原則

- タイムラインの横軸は紀元前から西暦まで連続した歴史時間軸とする。
- 利用者向けに西暦0年を表示せず、紀元前1年と西暦1年を連続して計算する。
- 年・月・日、年代、世紀、日付精度、「おおよそ」、原資料上の表記を扱う。
- 元号入力は提供せず、保存値と表示軸は紀元前／西暦の正規化値とする。
- PCとスマートフォンの両方で編集機能を提供する。スマートフォンではタイムラインフィールドをクリック／タップしてイベントを作成する操作だけを無効にし、フォームから作成する。
- ログイン後のWeb版はSupabaseへ永続化し、ログイン前ローカルモードはIndexedDBへ永続化する。
- 公開プロジェクトは閲覧専用URLを共有できる。
- 検索エンジンへ掲載させない。
- イベントは複数のタイムラインアイテムへ関連付けでき、すべてのエンティティ間に意味的関係を登録できる。

---

## 3. 技術スタック

### 3.1 アプリケーション

- Next.js
- TypeScript
- App Router
- React Server Componentsを基本とする
- 高頻度操作が必要なタイムライン、フォーム、モーダル等はClient Componentとする
- パッケージ管理はpnpmを使用する

### 3.2 バックエンド・データベース

- Supabase PostgreSQL
- Supabase Auth
- Google OAuth
- Row Level Security
- Supabase CLI
- DBマイグレーションは同一Gitリポジトリの `supabase/migrations/` で管理する
- 日本語全文検索はPGroongaを使用する

### 3.3 フロントエンド基盤

- TanStack Query：APIキャッシュ、再取得、mutation管理
- Zustand：ズーム、スクロール、選択、パネル開閉等の一時UI状態
- React Hook Form：フォーム状態
- Zod：クライアント・API共通の入力検証
- TanStack Virtual：縦方向の行仮想化
- dnd-kit：手動並べ替え、グループ間移動
- shadcn/ui + Radix UI：モーダル、ポップオーバー、コンボボックス等
- date-fns：現代の日付検証・表示補助

### 3.4 テスト

- Vitest
- React Testing Library
- Playwright
- Supabase CLIによるローカルDBを用いた統合・E2Eテスト

### 3.5 デプロイ

- Next.js：Vercel
- DB・Auth：Supabase Cloud
- ローカル開発：Supabase CLI
- 本番DBをローカル開発から直接更新しない

---

## 4. リポジトリ構成

```text
.
├─ app/
│  ├─ api/
│  ├─ auth/
│  ├─ login/
│  ├─ projects/
│  ├─ public/
│  ├─ search/
│  ├─ robots.ts
│  └─ layout.tsx
├─ components/
├─ features/
│  ├─ auth/
│  ├─ projects/
│  ├─ item-types/
│  ├─ timeline/
│  ├─ timeline-items/
│  ├─ timeline-events/
│  ├─ search/
│  ├─ import-export/
│  └─ public-view/
├─ lib/
│  ├─ supabase/
│  ├─ repositories/
│  ├─ services/
│  ├─ validation/
│  ├─ historical-date/
│  └─ timeline-math/
├─ supabase/
│  ├─ migrations/
│  ├─ seed.sql
│  └─ config.toml
├─ tests/
│  ├─ unit/
│  ├─ integration/
│  └─ e2e/
├─ AGENTS.md
├─ SPEC.md
├─ TASKS.md
└─ README.md
```

---

## 5. 認証・権限

### 5.1 認証

- Googleアカウントによるログインを提供する。
- メールアドレス・パスワード認証は提供しない。
- 共同編集は実装しない。
- 各プロジェクトの所有者は1人とする。

### 5.2 公開範囲

```ts
type ProjectVisibility = "private" | "public";
```

- 新規プロジェクトの初期値は `private`。
- 非公開プロジェクトは所有者のみ閲覧・編集可能。
- 公開プロジェクトは未ログインでも閲覧可能。
- 公開ページでは作成、編集、削除、インポート等を提供しない。
- 所有者以外には、非公開リソースの存在を推測しにくいレスポンスを返す。

### 5.3 RLS

主要テーブルすべてでRLSを有効化する。

- 所有者：自分が所有するプロジェクトと配下データをCRUD可能
- 匿名・他ユーザー：公開プロジェクトと配下データをSELECT可能
- 書き込みは所有者のみ
- Service Role Keyはブラウザへ渡さない
- 通常CRUDはユーザーセッションとRLSを通して行う

---

## 6. URL設計

### 6.1 所有者用

```text
/login
/auth/callback

/projects
/projects/new
/projects/[projectId]/timeline
/projects/[projectId]/items/[itemId]
/projects/[projectId]/events/[eventId]
/projects/[projectId]/item-types
/projects/[projectId]/import-export
/projects/[projectId]/settings
/projects/[projectId]/table
/projects/[projectId]/sources
/projects/[projectId]/quality
/projects/[projectId]/network
/projects/[projectId]/statistics

/local
/search?q=...
```

### 6.2 公開閲覧用

```text
/public/[publicId]
/public/[publicId]/items/[itemId]
/public/[publicId]/events/[eventId]
```

### 6.3 URL連動オーバーレイ

タイムラインからタイムラインアイテム・イベントアイテムを開いた場合：

- 背景にタイムラインを維持
- URLを個別詳細URLへ変更
- ブラウザの戻る操作でオーバーレイを閉じる

個別URLを直接開いた場合：

- 通常の詳細ページとして表示する
- タイムラインアイテムとイベントアイテムで本文領域の最大幅、外側余白、操作領域の配置を統一する
- 常に所属プロジェクトのタイムラインへ移動できる導線を表示する

URL連動オーバーレイには全画面化アイコンボタンを表示する。全画面化では同じ個別詳細URLを通常ページとして開き直し、詳細の内容と遷移元コンテキストを維持する。

詳細間の遷移は、現在の表示コンテキストを維持するため次の規則に統一する。

- タイムラインからタイムラインアイテムまたはイベントアイテムを開く場合はモーダル表示する。
- モーダルの全画面化は同じURLへハード遷移し、通常の個別ページを表示する。
- タイムラインアイテムのモーダル内イベント一覧からイベントアイテムを開く場合は、モーダル表示を継続する。
- タイムラインアイテムの通常ページ内イベント一覧からイベントアイテムを開く場合は、イベントの通常ページへハード遷移する。
- イベントアイテムの通常ページにあるパンくずから親タイムラインアイテムを開く場合は、親の通常ページへハード遷移する。
- タイムラインアイテムまたはイベントアイテムの編集を終了した場合、保存済みの詳細キャッシュを通常詳細ページとURL連動詳細オーバーレイの双方へ即時反映する。

公開閲覧用の通常詳細ページは、本文や出典がビューポートを超える場合にページ本体を縦スクロールでき、末尾まで閲覧できること。

全体検索の候補または検索結果から個別詳細を開く場合、検索語、種類フィルター、ページ番号を含む検索結果URLを、検証済みのアプリ内相対URLとして `returnTo` に保持する。通常詳細ページは以下のパンくずを表示する。

- 有効な検索コンテキストあり：検索結果／所属プロジェクト／詳細
- 検索コンテキストなし、またはURL直接入力：所属プロジェクトのタイムライン／詳細

`returnTo` は `/search` で始まる同一アプリ内の相対URLだけを許可し、外部URL、プロトコル相対URL、別プロジェクトの不正な遷移先として解釈しない。検索結果へ戻る導線がある場合も、所属プロジェクトのタイムラインへの副導線を常に用意する。オーバーレイ内ではパンくずを重ねず、全画面化と閉じる操作を邪魔しないコンパクトな導線にする。

Next.jsのIntercepting RoutesとParallel Routes等を用いて実現してよい。

---

## 7. API設計

Route Handlerを用い、認証・権限検証をサーバー側で実施する。

```text
GET    /api/projects
POST   /api/projects
GET    /api/projects/[projectId]
PATCH  /api/projects/[projectId]
DELETE /api/projects/[projectId]

GET    /api/projects/[projectId]/timeline
GET    /api/projects/[projectId]/timeline/search?q=...
GET    /api/projects/[projectId]/items/[itemId]
POST   /api/projects/[projectId]/items
PATCH  /api/projects/[projectId]/items/[itemId]
DELETE /api/projects/[projectId]/items/[itemId]

GET    /api/projects/[projectId]/events/[eventId]
POST   /api/projects/[projectId]/events
PATCH  /api/projects/[projectId]/events/[eventId]
DELETE /api/projects/[projectId]/events/[eventId]

GET    /api/projects/[projectId]/item-types
POST   /api/projects/[projectId]/item-types
PATCH  /api/projects/[projectId]/item-types/[typeId]
DELETE /api/projects/[projectId]/item-types/[typeId]

GET    /api/projects/[projectId]/background-layers
POST   /api/projects/[projectId]/background-layers
PATCH  /api/projects/[projectId]/background-layers/[layerId]
DELETE /api/projects/[projectId]/background-layers/[layerId]
POST   /api/projects/[projectId]/background-layers/[layerId]/periods
PUT    /api/projects/[projectId]/background-layers/[layerId]/periods/[periodId]
DELETE /api/projects/[projectId]/background-layers/[layerId]/periods/[periodId]

POST   /api/projects/[projectId]/publish
POST   /api/projects/[projectId]/unpublish
POST   /api/projects/[projectId]/public-id/regenerate

GET    /api/projects/[projectId]/export/json
GET    /api/projects/[projectId]/export/csv
POST   /api/projects/[projectId]/import/json/preview
POST   /api/projects/[projectId]/import/json/commit
POST   /api/projects/[projectId]/import/csv/preview
POST   /api/projects/[projectId]/import/csv/commit

GET    /api/search?q=...
```

Route HandlerとServer Componentは、Supabaseクエリを直接重複実装せず、共通のservice/repository層を利用する。

`POST /api/projects/[projectId]/items` は、タイムラインアイテムと同時作成する0件以上のイベントアイテムを任意で受け取れる。親の入力と各イベントの入力は個別に検証する。親が不正な場合は何も作成しない。親が有効な場合は、RLSが適用されるDB関数で親を先にINSERTし、その後に各イベントを独立した例外処理区間でINSERTする。

イベントの入力不正、権限不正、期間型親の制約違反、その他のDB制約違反は、そのイベントだけを失敗として扱う。タイムラインアイテムと、すでに成功した他のイベントアイテムはロールバックしない。時点型の親とともにイベントが送信された場合も、親は作成し、イベントだけを失敗として扱う。

レスポンスは作成したタイムラインアイテム、作成できたイベント、作成できなかったイベントのタイトルと安全な理由を区別して返す。タイトル自体が空または不正な場合は「タイトル未入力」として識別する。親を作成できた場合は一部イベントが失敗しても成功レスポンスとし、UIは親の追加成功を表示したうえで、「次のイベントアイテムは追加できませんでした」と失敗したタイトルを列挙して通知する。DB内部情報や権限判定の詳細は通知へ含めない。

---
