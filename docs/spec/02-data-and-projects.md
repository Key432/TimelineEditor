# データモデル・プロジェクト・エンティティ

## 8. データモデル

### 8.1 共通方針

- 主キーはUUID
- `created_at`、`updated_at`を持つ
- 歴史日付はJavaScript `Date`へ直接変換せず、年・月・日を分離して扱う
- 紀元前と西暦を扱い、西暦0年は利用者向けに使用しない
- 月未入力時は日を入力不可
- 終了日は開始日以降
- 時代、精度、年代、世紀、「おおよそ」、原資料表記を独立して保持する
- 歴史日付は `era`（`ce | bce`）、`precision`（`day | month | year | decade | century`）、正の入力値、任意の原表記、暦法識別子で構成する
- DBでは各日付の正規化最小・最大境界を生成列として保持し、検索、期間抽出、並べ替えへ利用する
- タイムラインアイテムとイベントアイテムを共通参照型で安全に参照できる

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
is_point_approximate boolean not null default false

created_at timestamptz not null
updated_at timestamptz not null
```

DB制約：

- `temporal_type = range` の場合、開始日必須
- `temporal_type = point` の場合、時点日を `start_year/month/day` に保存する
- `temporal_type = point` のタイムラインアイテムにはイベントアイテムを作成不可
- `end_date_status = specified` の場合、終了日必須
- `end_date_status = ongoing` の場合、終了日・最終確認日は使用しない
- `end_date_status = unknown` の場合、任意の最終確認日を `end_year/month/day` に保存する
- 個別曖昧幅がnullならプロジェクト既定値を使用する
- 項目単位で曖昧幅を上書きでき、未指定時はプロジェクト既定値を使用する

### 8.6 timeline_events

イベント本体と親タイムラインアイテムとの所属を分離し、1イベントを複数の期間型タイムラインアイテムへ関連付けられるようにする。

```text
id uuid primary key
project_id uuid not null references projects on delete cascade
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

- `timeline_event_item_links` がイベントと期間型タイムラインアイテムを多対多で関連付ける
- 関連は `sort_order` を持ち、イベント内で重複しない手動順に並べる。すべての親は同格で、主親・副親を設けない
- `timeline_events.timeline_item_id` は旧トリガー・旧RPCとの互換用に先頭親を指すが、正規の読取元や主親として使用しない
- 時点型タイムラインアイテムを親にはできない
- 親期間外のイベント登録は許可するが警告を表示する
- 期間外の登録理由として、没後刊行・回顧展等を想定する
- 親子所属と意味的関係は別データとして扱う

### 8.7 entity_relationships

タイムラインアイテムとイベントアイテムの全組み合わせに意味的関係を登録する共通テーブルとする。

```text
id uuid primary key
project_id uuid not null references projects on delete cascade
source_type text not null -- timeline_item | timeline_event
source_id uuid not null
target_type text not null -- timeline_item | timeline_event
target_id uuid not null
relation_type text not null -- influence | reference | collaboration | teacher | opposition | succession | other
direction text not null -- directed | undirected
note text
created_at timestamptz not null
updated_at timestamptz not null
unique(project_id, source_type, source_id, target_type, target_id, relation_type)
```

- 代表的なユースケースとして、「ある本が他の著者の本に影響を与えた」「ある人物が別の人物を教えた」「ある人物がある他の人物の出来事に影響を与えた」「ある出来事がある人物に影響を与えた」を表現できるようにする。
- 関連は表示時に線として描画し、対象間の関係性を視覚化する。
- 通常タイムラインは選択対象の直接関係だけを既定表示し、全関係の探索はネットワークビューで行う。

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

実装では歴史日付をPostgreSQLの日付型へ変換せず、`start_year`、`start_month`、
`start_day`、時代、精度、原表記、暦法、正規化最小・最大境界と、終了側の同属性、
終了状態・曖昧フラグを保持する。
`(entity_type, entity_id)` を主キーとし、プロジェクト、対象種別、タイムライン
アイテム、イベントアイテムの変更を内部トリガーで同期する。アプリ利用者は
`search_documents` へ直接書き込めない。

- プロジェクト、タイムラインアイテム、イベントアイテムを検索対象とする
- PGroongaインデックスを使用する
- 非公開データは所有者の検索結果にのみ含める
- 公開データは未ログイン検索へ含めるか、公開検索の提供範囲に応じて制御する
- 削除・更新時に検索インデックスを同期する
- 検索RPCはRLSを適用し、所有者のデータまたは公開プロジェクトのデータだけを返す

### 8.9 timeline_saved_views

```text
id uuid primary key
project_id uuid not null references projects on delete cascade
name text not null
configuration jsonb not null
created_at timestamptz not null
updated_at timestamptz not null
unique(project_id, name)
```

- 所有者だけが作成、閲覧、更新、削除できる
- `configuration` は表示年代、ズーム、スクロール、フィルター、並び順、グループ、レイアウトと後続Phase用の表示条件だけを保持する
- タイムラインのデータ本体や描画結果は複製しない
- 設定JSONは32 KiB以下に制限する
- 保存済みビューは1プロジェクト50件までとし、設定データが無制限に増えないようにする

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

- プロジェクト削除は完全削除
- プロジェクト名の再入力を要求
- 配下データは `ON DELETE CASCADE`
- タイムラインアイテムとイベントアイテムは確認後にゴミ箱へ移動し、5日以内は復元可能。内部リンクの参照元がある場合は、削除確認に参照件数とリンク切れになる旨を表示する
- ゴミ箱の移動から5日後はSupabase Cron（`pg_cron`）の日次処理で実体を削除し、ゴミ箱画面から明示的に完全削除することもできる
- 使用中の対象種別は直接削除不可
- タイムライン内の設定パネルからプロジェクトを完全削除する間は画面操作をブロックし、完了後に `/projects` へ置換遷移する
- イベントアイテムをゴミ箱へ移動する間は画面操作をブロックする。タイムラインから開いたURL連動モーダルでは一覧キャッシュ更新後に履歴を戻してモーダルslotを閉じ、直接詳細ページでは所属プロジェクトの `/timeline` へ置換遷移する
- タイムラインアイテムをURL連動モーダルからゴミ箱へ移動した場合も、項目・イベント一覧キャッシュ更新後に履歴を戻してモーダルslotを閉じ、削除結果を背景のタイムラインへ即時反映する

### 9.4 一覧とナビゲーション

- プロジェクトカード本体のクリック／キーボード操作でタイムラインを開く
- プロジェクトカードには現在の公開状態を「非公開」または「公開済」で表示する
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

作成・編集フォームで時間形式を切り替える場合、入力済みの主日付を失わない。

- 期間型から時点型：開始日を時点日へ引き継ぐ
- 時点型から期間型：時点日を開始日へ引き継ぐ
- 年だけ、年月、年月日の精度と曖昧フラグをそのまま引き継ぐ
- 同じフォームを閉じるまで、切り替えで一時的に非表示となる終了状態・終了日も保持し、期間型へ戻したときに復元する

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
- 項目単位で上書き可能
- 開始・終了の登録点自体は維持する

---

## 11. イベントアイテム・関連付け

イベントアイテムは同格の複数の期間型タイムラインアイテムへ紐づけられ、関連の手動 `sort_order` 順で表示する。

### 11.1 登録項目

- タイトル
- 年・月・日
- 曖昧フラグ
- 本文
- 構造化された出典・参考文献と個別ロケータ
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

### 11.3 関連付け

- イベントを1件以上の期間型タイムラインアイテムへ紐づける。
- 親の追加・削除・上下移動で関連順を編集できる。主親・副親は区別しない。
- 各親行・レーンへ同じイベントを表示するが、検索・統計・CSVではイベント実体を二重計上しない。
- 親ごとに期間外警告を判定する。
- タイムラインアイテム同士、イベントアイテム同士、両者の間に方向あり／なしの意味的関係を登録する。

### 11.4 日付スナップ

ズーム段階に応じて初期入力精度を変える。

- 世紀・数十年表示：年単位
- 数年表示：月単位
- 数か月・数週間表示：日単位
- 入力フォームでは自由に修正可能
- 曖昧フラグは自動で有効にしない

---
