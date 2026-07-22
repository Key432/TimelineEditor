# タイムライン作成支援Webアプリ 仕様書

## 1. 文書の目的

本書は、Codexがタイムライン作成支援Webアプリを段階的に実装するためのプロダクト仕様書である。

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

- タイムラインの横軸は西暦で統一する。
- 初期版は西暦1年以降を扱う。
- 将来、紀元前や「○世紀ごろ」などへ拡張可能な日付型とする。
- 元号入力は将来の入力補助候補とし、保存値と表示軸は西暦を正規値とする。
- 編集はPC中心、スマートフォンは閲覧中心とする。
- 初期版からSupabaseへ永続化する。
- 公開プロジェクトは閲覧専用URLを共有できる。
- 初期版では検索エンジンへ掲載させない。
- 将来のレベルアップ機能として、タイムラインアイテムとイベントアイテムの多対多な関連付けを前提にし、初期実装でも関連データ構造と表示レイヤーに拡張余地を持たせる。

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

- Googleアカウントによるログインのみを初期版で提供する。
- メールアドレス・パスワード認証は初期版では提供しない。
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
/projects/[projectId]/items/[itemId]/edit
/projects/[projectId]/events/[eventId]
/projects/[projectId]/events/[eventId]/edit
/projects/[projectId]/item-types
/projects/[projectId]/import-export
/projects/[projectId]/settings

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

---

## 8. データモデル

### 8.1 共通方針

- 主キーはUUID
- `created_at`、`updated_at`を持つ
- 歴史日付はJavaScript `Date`へ直接変換せず、年・月・日を分離して扱う
- 初期版では西暦1年以降
- 月未入力時は日を入力不可
- 終了日は開始日以降
- 将来のBCE・世紀精度へ拡張可能な命名とする

### 8.2 projects

主要列：

```text
id uuid primary key
owner_id uuid not null references auth.users
name text not null
description text
visibility text not null default 'private'
public_id text unique
published_at timestamptz
created_at timestamptz not null
updated_at timestamptz not null
```

### 8.3 project_settings

```text
project_id uuid primary key references projects on delete cascade
default_uncertainty_years integer not null default 5
initial_start_year integer not null default 1800
initial_end_year integer not null
initial_zoom_preset text not null default 'fit-range'
timeline_density text not null default 'comfortable'
minimum_time_unit text not null default 'day'
created_at timestamptz not null
updated_at timestamptz not null
```

### 8.4 timeline_item_types

```text
id uuid primary key
project_id uuid not null references projects on delete cascade
name text not null
default_color text not null
icon text
sort_order integer not null
is_visible boolean not null default true
is_system_seed boolean not null default false
created_at timestamptz not null
updated_at timestamptz not null
unique(project_id, normalized_name)
```

対象種別はプロジェクトごとにユーザーが追加、変更、並べ替えできる。

初期候補：

- 人物
- 思想潮流
- 文学運動／芸術運動
- 雑誌
- 団体
- 作品
- 戦争
- 政治・社会的事件
- 展覧会・公演
- その他イベント

テンプレートごとに初期値を変える。

### 8.5 timeline_items

```text
id uuid primary key
project_id uuid not null references projects on delete cascade
type_id uuid not null references timeline_item_types
title text not null
description text
source_text text
external_url text
temporal_type text not null -- range | point
color_override text
manual_order integer not null
is_visible boolean not null default true

start_year integer
start_month integer
start_day integer
is_start_approximate boolean not null default false
start_uncertainty_years integer

end_date_status text -- specified | ongoing | unknown
end_year integer
end_month integer
end_day integer
is_end_approximate boolean not null default false
end_uncertainty_years integer

last_confirmed_year integer
last_confirmed_month integer
last_confirmed_day integer

point_year integer
point_month integer
point_day integer
is_point_approximate boolean not null default false

created_at timestamptz not null
updated_at timestamptz not null
```

DB制約：

- `temporal_type = range` の場合、開始日必須
- `temporal_type = point` の場合、時点日必須
- `temporal_type = point` のタイムラインアイテムにはイベントアイテムを作成不可
- `end_date_status = specified` の場合、終了日必須
- `end_date_status = ongoing` の場合、終了日・最終確認日は使用しない
- `end_date_status = unknown` の場合、最終確認日は任意
- 個別曖昧幅がnullならプロジェクト既定値を使用する
- 初期UIでは個別曖昧幅を編集させないが、将来拡張用列として保持してよい

### 8.6 timeline_events

初期版では「イベントアイテム」として扱う。将来の拡張を見据え、イベントアイテムはタイムラインアイテムと多対多で関連付け可能な構造を想定し、内部的にはイベントと関連対象を分離して扱えるようにしておく。

```text
id uuid primary key
project_id uuid not null references projects on delete cascade
timeline_item_id uuid not null references timeline_items on delete cascade
title text not null
event_year integer not null
event_month integer
event_day integer
is_approximate boolean not null default false
description text
source_text text
external_url text
created_at timestamptz not null
updated_at timestamptz not null
```

- 初期版では、イベントは1つの期間型タイムラインアイテムに紐づく形で保存する。
- 将来は複数のタイムラインアイテムへ紐づけ可能にし、共著出版物や複数人物への影響関係などを表現できるようにする。
- 将来の関連付けは、イベントアイテムとタイムラインアイテムの多対多テーブルを介して管理する設計を前提とする。
- 親が `temporal_type = point` の場合は作成不可
- 親期間外のイベント登録は許可するが警告を表示する
- 期間外の登録理由として、没後刊行・回顧展等を想定する

### 8.7 entity_relationships

将来のレベルアップ機能として、タイムラインアイテムとイベントアイテムの間に関連線を張れるようにするため、共通の関連テーブルを初期実装から導入する。

```text
id uuid primary key
project_id uuid not null references projects on delete cascade
source_type text not null -- timeline_item | timeline_event
source_id uuid not null
target_type text not null -- timeline_item | timeline_event
target_id uuid not null
relation_type text not null -- influence | reference | collaboration | other
note text
created_at timestamptz not null
updated_at timestamptz not null
unique(project_id, source_type, source_id, target_type, target_id, relation_type)
```

- 代表的なユースケースとして、「ある本が他の著者の本に影響を与えた」「ある人物が別の人物を教えた」「ある人物がある他の人物の出来事に影響を与えた」「ある出来事がある人物に影響を与えた」を表現できるようにする。
- 関連は表示時に線として描画し、対象間の関係性を視覚化する。
- 初期版では関連の登録UI・描画は実装しないが、DB設計とAPIの拡張ポリシーに余地を残す。

### 8.8 search_documents

アプリ全体のフリーワード検索用。

概念列：

```text
entity_type text
entity_id uuid
project_id uuid
owner_id uuid
is_public boolean
title text
content text
detail_path text
sort_date
updated_at timestamptz
```

- プロジェクト、タイムラインアイテム、イベントアイテムを検索対象とする
- PGroongaインデックスを使用する
- 非公開データは所有者の検索結果にのみ含める
- 公開データは未ログイン検索へ含めるか、公開検索の提供範囲に応じて制御する
- 削除・更新時に検索インデックスを同期する

---

## 9. プロジェクト管理

### 9.1 新規作成

必須：

- プロジェクト名

任意：

- 説明

詳細設定：

- テンプレート
- 初期表示開始年
- 初期表示終了年
- 曖昧期間の既定値
- 初期ズーム
- 初期対象種別

新規作成時の公開状態は必ず非公開。

作成成功後はプロジェクト設定ではなく、作成したプロジェクトのタイムラインを開く。

### 9.2 テンプレート

- 文学史
- 美術史
- 思想史
- 汎用
- 空のプロジェクト

テンプレートは対象種別の初期投入にのみ使用し、作成後は自由に変更可能。

初期投入する対象種別：

- 文学史：人物、文学運動、雑誌、団体、作品、政治・社会的事件、その他イベント
- 美術史：人物、芸術運動、団体、作品、展覧会・公演、政治・社会的事件、その他イベント
- 思想史：人物、思想潮流、団体、作品、政治・社会的事件、その他イベント
- 汎用：8.4に列挙した初期候補すべて
- 空のプロジェクト：投入なし

各初期種別には用途を識別しやすい既定色とアイコンを設定する。これらは作成後に他の種別と同様に変更、並べ替え、非表示、未使用時の削除ができる。

### 9.3 削除

論理削除・ゴミ箱は実装しない。

- プロジェクト削除は完全削除
- プロジェクト名の再入力を要求
- 配下データは `ON DELETE CASCADE`
- タイムラインアイテム削除時はイベントアイテム件数を表示
- イベントアイテムは確認後に完全削除
- 使用中の対象種別は直接削除不可

### 9.4 一覧とナビゲーション

- プロジェクトカード本体のクリック／キーボード操作でタイムラインを開く
- 説明未入力時は代替文を表示せず、カードの高さだけを維持する
- スマートフォンの左ナビゲーションで移動先を選択したら、ナビゲーションを自動で閉じる

---

## 10. タイムラインアイテム

### 10.1 時間形式

```ts
type TemporalType = "range" | "point";
```

#### 期間型

用途：

- 人物
- 思想潮流
- 雑誌
- 団体
- 戦争
- 芸術運動等

開始日と終了状態を持つ。

#### 時点型

用途：

- 単発事件
- 作品刊行
- 展覧会
- 宣言発表等

単一の日付を持つ。

- 時点型項目は1行を占有する
- イベントアイテムは登録不可
- 期間型のイベントアイテム用マーカーと視覚的に区別する

### 10.2 終了状態

```ts
type EndDateStatus = "specified" | "ongoing" | "unknown";
```

#### specified

- 終了日あり
- 終了日の曖昧フラグ設定可能

#### ongoing

- ページ表示当日まで線を伸ばす
- DBの終了日を毎日更新しない
- 終端に継続中を示す表現を付ける
- サーバー側で基準日を確定し、hydration差異を避ける

#### unknown

- 終了時期不明
- 任意の最終確認日を持つ
- 最終確認日まで通常線、その後既定年数でフェードアウト
- 最終確認日が未入力なら開始日を最終確認日として扱う

### 10.3 曖昧な開始・終了

開始・終了それぞれに独立した曖昧フラグを持つ。

- 開始側：透明から通常色へグラデーション
- 終了側：通常色から透明へグラデーション
- 初期値は5年分
- プロジェクト全体で変更可能
- 将来は項目単位で上書き可能
- 開始・終了の登録点自体は維持する

---

## 11. イベントアイテム・関連付け

初期版では「イベントアイテム」を中心に実装する。将来のレベルアップを見据えて、イベントアイテムは単一親ではなく複数のタイムラインアイテムに紐づけられる構造を前提にし、内部的にはイベントと関連対象を分離して扱えるようにしておく。

### 11.1 登録項目

- タイトル
- 年・月・日
- 曖昧フラグ
- 本文
- 出典・参考文献の自由記述
- 外部URL

### 11.2 登録経路

1. メインの追加メニュー、サイドパネル、詳細編集ページから登録
2. タイムライン行の時間軸部分をダブルクリックして登録

ダブルクリック時：

- X座標を日付へ変換
- 親タイムラインアイテムを自動設定
- 算出日付を初期値としてフォームを開く
- 保存前に日付を編集可能
- 横棒外の期間でも登録可能。ただし警告する
- 既存マーカーのダブルクリックは新規作成ではなく編集

### 11.3 将来の関連付け方針

- 初期実装ではイベントを1つの期間型タイムラインアイテムに紐づける。
- 将来はイベントを複数のタイムラインアイテムへ紐づけられるようにし、共著出版物や複数人物への関係性を表現できるようにする。
- タイムラインアイテム同士、イベントアイテム同士、タイムラインアイテムとイベントアイテムの間に関連線を張れるようにし、線は対象から対象への方向性を持たせる。
- 関連の種類は `influence`、`reference`、`collaboration`、`other` を初期候補とする。

### 11.4 日付スナップ

ズーム段階に応じて初期入力精度を変える。

- 世紀・数十年表示：年単位
- 数年表示：月単位
- 数か月・数週間表示：日単位
- 入力フォームでは自由に修正可能
- 曖昧フラグは自動で有効にしない

---

## 12. タイムライン描画

### 12.1 基本構成

- 横軸：時間
- 表示モードは「行表示」と「コンパクトレーン表示」を切り替え可能とする
- 既定は従来の「行表示」とする
- 選択中の表示モードは `layout=row|compact` としてURLクエリへ反映する
- 行表示では縦軸をタイムラインアイテムとし、左側の項目情報列を固定する
- 行表示ではタイムライン部分のみ横方向へ移動する
- タイムライン領域をドラッグしてパンする
- パン操作中も期間型バーと時点型マーカーを表示し続ける
- 通常スクロールバー、トラックパッドにも対応
- PCでは `Alt + ホイール`、ボタン、スライダー等でズーム
- モバイルではタッチパン、ピンチズーム

### 12.2 ズーム

段階式ズームとし、段階切替には短いアニメーションを付ける。

- カーソル位置を基準にズーム
- ボタン操作時は中央日付を維持
- ズーム後も選択状態を維持
- 「全項目を表示範囲に収める」を提供する
- 表示対象が単一の時点のみでも前後に表示余白を確保し、過大な日単位ズームにしない

### 12.3 時間軸の自動粒度

候補例：

```ts
[
  { unit: "year", step: 500 },
  { unit: "year", step: 200 },
  { unit: "year", step: 100 },
  { unit: "year", step: 50 },
  { unit: "year", step: 20 },
  { unit: "year", step: 10 },
  { unit: "year", step: 5 },
  { unit: "year", step: 2 },
  { unit: "year", step: 1 },
  { unit: "month", step: 6 },
  { unit: "month", step: 3 },
  { unit: "month", step: 1 },
  { unit: "week", step: 1 },
  { unit: "day", step: 1 },
];
```

ルール：

- 主目盛りラベル間は原則80〜120px以上
- 補助目盛り間は原則16〜30px以上
- ラベル衝突時は粗い粒度へ変更
- 余裕ができたら細かい粒度へ変更
- 年／月／日の階層ラベルを表示
- 初期版の最小粒度は日

### 12.4 描画方式

- HTMLとSVGを併用
- 巨大な1枚のSVGは作らない
- 行仮想化と表示範囲クリッピングを行う
- タイムライン固有の座標計算、目盛り、クラスタリングは自前実装
- Canvas/WebGLは初期版では使用しない

### 12.5 コンパクトレーン表示

コンパクトレーン表示は、タイムラインアイテムごとの固定行と左側の項目情報列を持たず、時間的に重ならない複数項目を同じ高さのレーンへ配置する高密度な比較表示とする。

#### 表示

- 期間型タイムラインアイテムは従来と同じ横棒、時点型は従来と同じ区別可能なマーカーで描画する
- タイムラインアイテム名は開始位置または時点位置の上に表示する
- 対象種別と開始・終了日は常時表示せず、既存の共通ホバーUIで確認できるようにする
- タイムラインアイテム名、横棒、時点型マーカー、イベントマーカーから既存の詳細表示・編集操作を利用可能とする
- イベントマーカーは親タイムラインアイテムと同じレーンに描画する
- 固定行と左側の項目情報列がないため、タイムライン領域をつかんだドラッグで左右・上下の両方向へパンできるようにする
- 通常スクロールバーとトラックパッドによる左右・上下移動にも対応する

#### 占有範囲

レーン割り当てに用いる各項目の占有範囲は、次の表示要素をX座標上で合成した最小位置から最大位置までとする。

- 期間型の横棒。`ongoing` はサーバー基準の当日、`unknown` は既定曖昧期間によるフェードアウト終端まで含める
- 時点型のマーカー描画領域
- 親期間の内外を問わず、そのタイムラインアイテムに紐づくすべてのイベントマーカー描画領域
- 開始位置または時点位置の上に表示するタイムラインアイテム名の描画領域
- 前後の固定ピクセル余白 `compactLaneGapPx`。初期値は16pxとし、項目の終端と次項目の開始位置、イベントマーカーと次項目の開始位置が接触しないようにする

イベントマーカーのクラスタリング結果ではなく、クラスタリング前の全イベントマーカー領域を占有範囲へ含める。これにより、ズームによるクラスタ生成・解除でレーンが変化しないようにする。

#### 配置基準と割り当て

- 配置計算には既存のプロジェクト設定 `initial_zoom_preset` から初期表示時に解決した縮尺を使用し、専用の設定項目は追加しない
- `fit-range` の場合は、タイムラインアイテムと期間外を含むイベントのfit対象範囲、および初期表示時の利用可能幅から解決した縮尺を配置基準とする
- 通常のズーム、パン、クラスタリング、画面リサイズではレーンを再計算しない
- タイムラインデータ、イベントデータ、表示対象となるフィルター、グループ化、または初期ズーム設定が変わった場合は再計算する
- 配置対象を開始日時、占有終了日時、安定IDの順に並べ、各項目を占有範囲が衝突しない最上段のレーンへ順番に割り当てる
- 同じレーンの先行項目との間に `compactLaneGapPx` を確保できない場合は次のレーンへ配置する
- レーン割り当ては表示専用の決定的な純粋計算とし、DBへ保存しない
- ズーム変更後も割り当て済みのレーンを維持し、拡大・縮小によって項目の上下位置を変えない

#### 並び順とグループ

- コンパクトレーン表示では並び順の選択と手動D&Dを無効にする
- 行表示で選択していた並び順は保持し、行表示へ戻したときに復元する
- 対象種別によるグループ化は利用可能とする
- グループ化中は対象種別ごとに独立してレーンを計算し、異なるグループの項目を同じレーンへ混在させない
- グループ見出し、対象種別の並び順、展開・折りたたみ、折りたたみ状態は行表示と同じ規則を使用する
- 「非表示にした項目」は既存どおり独立した最下部グループとし、展開された場合はそのグループ内でレーンを計算する

---

## 13. マーカーとクラスタリング

### 13.1 個別マーカー

- ホバー：タイムラインアイテム／イベントアイテム共通の専用UIでタイトルと日付または期間を表示し、「登録日付」等の固定ラベルは付けない
- クリック：URL連動詳細オーバーレイ
- ダブルクリック：編集フォーム
- イベントアイテムと時点型親アイテムは形状・大きさを変えて区別する
- タイムラインアイテムとイベントアイテムはホバー時に輪郭を強調する

### 13.2 クラスタリング

少しでも表示領域が重なる場合はクラスタ化する。

- 同日
- 近接日付
- 枠線を含むマーカー領域の接触
- 連鎖的に接触するマーカー群も1クラスター
- 上下への積み重ねはしない
- ズーム、画面幅、サイドパネル開閉ごとに再計算
- 拡大して重なりが解消したら自動解除

初期候補：

```ts
collisionDiameterPx = 10;
collisionPaddingPx = 0;
eventMarkerRenderDiameterPx = 12;
eventClusterRenderDiameterPx = 24;
```

初期クラスタ生成後、通常マーカー12px・クラスタマーカー24pxの実描画領域で再判定する。クラスタマーカーが通常マーカーまたは別クラスタマーカーへ接触する場合は再結合し、描画後の重なりを残さない。

### 13.3 クラスターホバー

- 含まれるタイトル一覧を表示
- 日付順
- 件数が多ければ内部スクロール
- ホバー表示は確認用

### 13.4 クラスタークリック

- 選択モーダルを表示
- タイトル・日付一覧
- 行クリックで個別詳細オーバーレイ
- キーボード操作対応
- Esc、背景クリックで閉じる

---

## 14. 並び順・グループ表示

### 14.1 並び順

```ts
type TimelineSortMode =
  | "manual"
  | "startDate"
  | "endDate"
  | "title"
  | "itemType"
  | "createdAt"
  | "updatedAt";
```

- 手動順を永続化
- 自動並べ替えは表示上のみ
- 自動並べ替え中はD&D無効
- 手動順へ戻すと以前の順序を復元
- 昇順・降順を選択可能
- 開始日・終了日の比較は年だけでなく月日まで含む歴史日付の日序数で行う
- コンパクトレーン表示では自動配置を使用するため、並び順の選択と手動D&Dを無効にする

### 14.2 グループ表示

- 対象種別でグループ化
- オン・オフ切替
- グループ見出しに名称、色、件数
- グループ化中は各行に対象種別名を重複表示しない
- 折りたたみ可能
- 折りたたみ状態を保持
- グループ内手動D&D
- 別グループへ移動した場合は対象種別変更
- `is_visible = false` の項目は、対象種別グループとは別に最下部の「非表示にした項目」へ集約する
- 「非表示にした項目」は初期状態で折りたたみ、対象種別の並び順に影響されない
- 仮想化の「表示中 n / n 行」はグループ見出しを除き、実際のタイムラインアイテムだけを数える

---

## 15. 対象種別と色

### 15.1 対象種別

- 登録時に既存種別を単一選択
- 入力文字で候補絞り込み
- 一致しない場合はその場で新規作成可能
- プロジェクト設定から追加、名称変更、並べ替え、非表示、削除可能
- タイムライン上の対象種別管理は右サイドパネルで開き、閉じた後に登録フォームの選択肢へ即時反映する
- 対象種別による項目の並び替えは名称ではなく `timeline_item_types.sort_order` を基準にする
- 使用中種別の削除時は別種別への移行を要求

### 15.2 色

- 対象種別に既定色
- 個々のタイムラインアイテムで上書き可能
- 上書き解除時は種別の現在色へ戻る
- 横棒、曖昧グラデーション、イベントアイテムマーカーは継承色を使用
- 選択・ホバー・検索一致は色変更ではなく輪郭等で表す

---

## 16. 登録・編集UI

### 16.1 サイドパネル

右サイドパネルは十分な幅と余白を持たせ、プロパティ領域と本文領域を視覚的に分ける。フォーム最大化は初期リリース後のレベルアップ要素とする。

登録・編集：

- 名称
- 対象種別
- 時間形式
- 開始日／時点日
- 終了状態
- 曖昧フラグ
- 個別色
- 本文、出典、外部URLは枠で囲わず、区切り線を用いてパネルへ直接入力するように表示
- イベントアイテム一覧
- 表示・非表示
- 対象種別管理パネルを開くボタン

### 16.2 詳細編集ページ

- タイムライン上の編集では別ページへ遷移せず、右サイドパネル内ですべての入力項目を表示する
- 直接URLから開く編集ページでも同じ入力構造を使用する
- 長文説明
- イベントアイテム管理
- 出典
- 外部URL
- 管理情報
- 将来のカスタムフィールド用余地

### 16.3 保存

- 明示的な保存
- 未保存状態で閉じる場合は確認
- 保存中は重複送信を防止
- 保存成功後にTanStack Queryキャッシュを無効化
- タイムラインへ即時反映
- 完全自動保存は初期版では実装しない

---

## 17. 詳細ページ

### 17.1 タイムラインアイテム

表示：

- タイトル
- 対象種別
- 期間または時点
- 曖昧表記
- 終了状態
- 本文
- 出典
- 外部URL
- イベントアイテム一覧
- 編集ボタン（所有者のみ）
- タイトルまたはタイムライン上の横棒／時点マーカーをクリックして開く

### 17.2 イベントアイテム

表示：

- タイトル
- 日付
- 曖昧表記
- 親タイムラインアイテム
- 本文
- 出典
- 外部URL
- 編集ボタン（所有者のみ）

両詳細表示は大きなタイトルを最上部へ配置し、プロパティ領域、区切り線、見出しを付けない本文領域の順に表示する。URL連動オーバーレイでも説明用の固定見出しは表示しない。詳細表示の最大化は初期リリース後のレベルアップ要素とする。

### 17.3 出典

初期版は自由記述。

- 複数出典を改行区切り
- URLらしい文字列は安全に自動リンク化
- HTMLとして解釈しない
- 全体検索とタイムライン内検索の対象

---

## 18. タイムライン内フィルター・検索

現在のプロジェクト内に限定する。

### 18.1 フリーワード対象

- タイムラインアイテム名
- 本文
- イベントアイテムのタイトル
- イベントアイテム本文
- 出典
- 対象種別名

### 18.2 絞り込み条件

- 対象種別（複数）
- 表示年代の開始・終了
- イベントアイテムの有無
- 開始日が曖昧
- 終了日が曖昧
- いずれかの日付が曖昧
- 個別色の有無
- 表示・非表示状態

### 18.3 表示方法

- 一致する項目だけ表示
- 一致しない項目を薄く表示

イベントアイテムのみ一致した場合：

- 親行を残す
- 一致したマーカーをSecondary色のリング等で強調

### 18.4 URL状態

フィルター、並び順、グループ表示等をURLクエリへ反映する。

例：

```text
/projects/abc/timeline
?q=漱石
&types=person,magazine
&from=1860
&to=1930
&hasEvents=true
&approximate=any
&filterMode=dim
&layout=compact
&sort=startDate
&direction=asc
&groupBy=itemType
```

---

## 19. 全体検索

### 19.1 UI

- ヘッダーへ全体検索窓を常設
- 入力候補はデバウンス
- Enterで検索結果ページ
- 候補クリックで詳細ページへ遷移

### 19.2 対象

- プロジェクト名・説明
- タイムラインアイテム名・本文
- イベントアイテムのタイトル・本文
- 出典
- 外部URL表示情報
- 対象種別名

### 19.3 検索結果

種類ごとに表示：

- プロジェクト
- タイムラインアイテム
- イベントアイテム

表示項目：

- 種類
- タイトル
- 所属プロジェクト
- 一致箇所周辺の抜粋
- 日付または期間
- 詳細URL

ページネーションを実装する。

---

## 20. 公開・共有

### 20.1 公開ページ

- 認証不要
- 閲覧専用
- タイムラインのパン、ズーム、フィルター、詳細閲覧は利用可能
- 管理ナビ、編集パネル、登録・削除機能は非表示
- 公開プロジェクト一覧ページは初期版では作成しない

### 20.2 publicId

- 初回公開時に推測困難なランダム値を生成
- 非公開へ戻しても維持
- 再公開時は同じURL
- 設定画面から共有URLを再発行可能
- 再発行後は古いURLを即時無効化

### 20.3 noindex

アプリ全体で以下を適用：

- `noindex`
- `nofollow`
- `noarchive`
- `nosnippet`
- `noimageindex`
- `X-Robots-Tag`
- `robots.txt`でクロール抑制
- sitemapを生成しない
- 公開ページへの公開ポータルを作らない

`noindex`はアクセス制御ではないことを公開確認画面へ明記する。

---

## 21. JSON・CSV入出力

### 21.1 JSON

完全バックアップ用。

含める：

- プロジェクト
- 設定
- 対象種別
- タイムラインアイテム
- イベントアイテム
- 手動順
- 表示設定
- スキーマバージョン
- アプリバージョン
- エクスポート日時

同一プロジェクトIDが存在する場合：

- 別プロジェクトとして複製
- 上書き
- 中止

既定は複製。

### 21.2 CSV

ZIP出力：

```text
project_csv_YYYY-MM-DD.zip
├─ timeline-items.csv
├─ timeline-events.csv
├─ item-types.csv
└─ README.txt
```

- UTF-8 BOM付き
- Excelでの編集を想定
- ID空欄は新規ID生成
- イベントアイテムの親指定はID優先
- タイトル照合は同名が複数ならエラー

### 21.3 インポート

- サーバー側で検証
- 保存前プレビュー
- エラー・警告一覧
- 正常行のみ取り込み、または全体中止を選択
- 確定時はトランザクション
- 中途半端な登録を残さない

---

## 22. レイアウト

### 22.1 所有者画面

- 上部：ロゴ、パンくず、全体検索、ユーザーメニュー
- 左：折りたたみ式ナビゲーション
- 中央上：プロジェクト名、公開状態、主要操作
- プロジェクト名の下にプロジェクト説明を表示する
- タイムライン上部：フィルター、並び順、グループ、密度、ズーム
- 中央：固定情報列＋タイムライン
- 右：項目編集、プロジェクト設定、対象種別管理を必要時のみサイドパネル表示
- PCの対象種別管理パネルは、一覧の全列と操作が横に見切れない幅を確保する
- 独立したプロジェクト設定画面はプロジェクト一覧へ戻り、独立した対象種別画面はプロジェクト設定へ戻る

### 22.2 左固定情報列

- 左固定情報列は行表示でのみ表示し、コンパクトレーン表示では表示しない
- 項目名
- 対象種別
- 開始・終了簡略表示
- 色
- 操作メニュー
- 幅変更可能
- 長い名称は省略＋ホバー全文

### 22.3 公開画面

- 管理ナビなし
- 編集パネルなし
- タイムライン操作と詳細閲覧のみ

---

## 23. 対応端末

### 23.1 PC・大画面

すべての編集機能を提供する。

推奨最小幅は1024px程度。

### 23.2 スマートフォン

閲覧中心。

利用可能：

- 公開・非公開タイムライン閲覧
- タッチパン
- ピンチズーム
- フィルター
- 検索
- 詳細閲覧

無効：

- 新規作成
- 編集
- 削除
- D&D
- 対象種別管理
- インポート
- 公開状態変更

編集操作時はPC利用を案内する。

---

## 24. デザイン

### 24.1 方針

- タイムライン：学術資料・表計算ソフト寄りの高密度表示
- ヘッダー、フォーム、モーダル：モダンな操作UI
- ライトモードのみ
- ダークモードは初期版対象外
- 角丸を過剰使用しない
- 可読性を優先する

### 24.2 カラー

```css
:root {
  --color-primary: #00b0b0;
  --color-primary-hover: #009999;
  --color-primary-active: #007f7f;
  --color-primary-soft: #e6f8f8;
  --color-primary-subtle: #f2fbfb;

  --color-secondary: #ff3399;
  --color-secondary-hover: #e62e8a;
  --color-secondary-active: #cc267a;
  --color-secondary-soft: #fff0f7;

  --color-text: #333333;
  --color-text-secondary: #666666;
  --color-text-muted: #858585;
  --color-text-disabled: #aaaaaa;

  --color-background: #f7fafa;
  --color-surface: #ffffff;
  --color-surface-subtle: #f1f6f6;
  --color-surface-hover: #edf7f7;
  --color-overlay: rgb(20 35 35 / 45%);

  --color-border: #d8e1e1;
  --color-border-strong: #b8c7c7;
  --color-grid-minor: #e8eeee;
  --color-grid-major: #ccd9d9;

  --color-danger: #c73d4d;
  --color-warning: #a66a00;
  --color-success: #27845a;
  --color-focus: #007f7f;
}
```

ブランドカラーを小さい本文文字として直接使わず、必要に応じて濃色派生色を用いる。

### 24.3 表示密度

```ts
type TimelineDensity = "compact" | "comfortable";
```

初期値は `comfortable`。

ユーザー向けの表示名は `comfortable` を「標準」、`compact` を「高密度」とする。「コンパクト」は表示モード名との混同を避けるため、表示密度の名称には使用しない。

---

## 25. 性能要件

1プロジェクトの目標：

- タイムラインアイテム：1,000件
- イベントアイテム：10,000件
- 対象種別：100件程度

要件：

- 縦方向行仮想化
- コンパクトレーン表示ではレーンとグループを仮想化し、1項目1行を前提にしない
- 表示年代付近のマーカーのみ描画
- タイムライン一覧APIでは長文本文を取得しない
- 詳細は個別APIで取得
- クラスタリングをメモ化
- コンパクトレーン割り当てをメモ化し、ズーム、パン、クラスタリング、リサイズでは再計算しない
- パン中のDOMスクロールはポインターへ直接追従させ、目盛り生成等に使うReact状態の同期は最大約30fpsにまとめて高コスト再計算を抑制
- 全体検索はページネーション
- 初期版は画像・添付ファイルなし

---

## 26. サンプルデータ

開発環境専用の文学史サンプルを `supabase/seed.sql` またはシードスクリプトで提供する。

含める：

- 日本近代文学史プロジェクト
- 複数の対象種別
- 期間型人物
- 時点型項目
- 曖昧開始・終了
- 継続中
- 終了時期不明
- 最終確認日
- 複数イベントアイテム
- クラスター確認用の近接イベント

本番には自動投入しない。

E2Eはテストごとに独立データを生成し、サンプルデータへ依存しない。

---

## 27. 非機能要件

### 27.1 セキュリティ

- すべての入力をZodで検証
- SQL文字列連結を避ける
- RLSを必須
- Service Role Keyをクライアントへ公開しない
- 自由記述はプレーンテキストとして扱う
- 外部URLを安全に検証
- 所有権をサーバー側で検証
- 公開・非公開切替を即時反映

### 27.2 アクセシビリティ

- キーボード操作
- フォーカス可視化
- Escでモーダルを閉じる
- モーダルのフォーカストラップ
- 色だけに依存しない状態表現
- ラベルと入力欄の関連付け
- ツールチップ情報へ代替アクセス手段を用意
- コントラストを確認する

### 27.3 信頼性

- 破壊的操作は確認
- インポートはプレビュー後に実行
- DB変更はマイグレーション
- 変更と同時にテストを追加
- すべての検証成功をコミット条件とする

---

## 28. 完了条件

初期版は以下を満たすこと。

- Google認証でログインできる
- プロジェクトを作成・編集・削除できる
- 対象種別を管理できる
- 期間型・時点型項目を登録できる
- 曖昧端点、継続中、終了時期不明を描画できる
- イベントアイテムをフォーム／ダブルクリックから登録できる
- パン、ズーム、自動時間軸が動作する
- マーカーが重なるとクラスタ化する
- 詳細がURL連動オーバーレイと直接ページで表示される
- タイムライン内フィルターと全体検索が動作する
- 公開URLを発行・再発行できる
- 匿名ユーザーが公開ページを閲覧できる
- JSON・CSV入出力が動作する
- スマートフォンで閲覧できる
- 1,000項目・10,000イベント規模の性能目標を確認する
- 全自動テストとビルドが成功する
