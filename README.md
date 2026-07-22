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

- Node.js 22.12以降
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

## Git運用方針

個人開発では、基本的に `main` 以外のブランチを作成せず、目的ごとに `main` 上で作業を進めます。実施内容は都度コミットし、履歴を追いやすい粒度で残します。

- 1つの作業単位につき、1つの論理変更または1つの目的にまとめる
- 途中で切り分ける必要がある場合でも、短期の作業は `main` へ直接コミットする
- 共有や並列作業が必要な場合のみ、例外的に別ブランチを検討する

コミットメッセージは英語で記述し、`fix: `、`feat: `、`docs: `、`refactor: `、`chore: ` などの接頭辞を付けます。例: `fix: resolve project deletion validation`、`docs: add git workflow guidance`

## 将来拡張方針

初期実装では「イベントアイテム」を期間型タイムラインアイテムに紐づける形で実装しますが、将来的にはイベントを複数のタイムラインアイテムへ紐づけたり、タイムラインアイテムとイベントアイテムの間に関連線を描画したりできるように拡張します。これに備えて、将来の多対多関連と関連線描画を扱うためのデータ構造と表示レイヤーの拡張余地を初期実装から確保します。

## プロジェクト管理

認証後の `/projects` で、非公開プロジェクトの作成、一覧、設定変更、完全削除を行えます。作成時は名前だけで開始でき、表示範囲、曖昧期間の既定値、初期ズーム、表示密度、最小時間単位を詳細設定できます。

- `projects.owner_id` はサーバーセッションの `auth.uid()` から設定し、クライアント入力は使用しません。
- `projects` と `project_settings` はRLSにより所有者だけが参照・更新・削除できます。
- 新規プロジェクトの公開状態は必ず `private` です。
- プロジェクト削除時は名前の再入力が必要で、設定を含む配下データは `ON DELETE CASCADE` で完全削除されます。
- テンプレート選択は作成APIで検証し、プロジェクトと設定、対象種別を同じトランザクションで作成します。

Phase 2で提供するAPI：

```text
GET    /api/projects
POST   /api/projects
GET    /api/projects/[projectId]
PATCH  /api/projects/[projectId]
DELETE /api/projects/[projectId]
```

## 対象種別管理

プロジェクト設定から `/projects/[projectId]/item-types` を開き、対象種別の検索、追加、名称・既定色・アイコン変更、上下移動、表示切替、削除を行えます。検索語と同名の種別がない場合は、Enterキーまたは新規作成ボタンでその場で追加できます。

- 名前は前後空白と連続空白、英字の大文字小文字を正規化してプロジェクト内の重複を防止します。
- 既定色は `#RRGGBB` 形式で検証します。
- 対象種別は所有者だけが参照・変更でき、プロジェクト削除時は `ON DELETE CASCADE` で削除されます。
- 未使用の対象種別だけを削除できます。Phase 4で追加する `timeline_items.type_id` は削除連鎖を設定せず、使用中の削除を外部キーで拒否します。
- 文学史、美術史、思想史、汎用テンプレートは用途別の初期種別を投入し、空のプロジェクトは0件で開始します。

Phase 3で提供するAPI：

```text
GET    /api/projects/[projectId]/item-types
POST   /api/projects/[projectId]/item-types
PATCH  /api/projects/[projectId]/item-types/[typeId]
DELETE /api/projects/[projectId]/item-types/[typeId]
```

## タイムラインアイテム

`/projects/[projectId]/timeline` で、期間型・時点型のタイムラインアイテムを右サイドパネルから作成・編集し、基本時間軸上へ表示できます。概要フィールドは持たず、本文、出典、外部URLはプロパティ入力部と分けた枠なしの編集領域で管理します。

- 歴史日付は年・月・日を分離して保存し、JavaScript `Date` やタイムゾーン変換を使用しません。
- 西暦1年以降、実在日、月なしの日入力禁止、終了日・最終確認日の前後関係をZodとDB制約の両方で検証します。
- 期間型は終了日あり、継続中、終了時期不明を扱い、開始・終了の曖昧表示を個別に設定できます。
- 時点型は期間型と異なる菱形マーカーで表示します。
- 色は対象種別から継承し、項目単位で `#RRGGBB` の上書きを設定できます。
- 手動順は永続化され、ドラッグ操作とキーボード対応の上下移動を利用できます。自動並べ替えは表示上だけに適用され、開始日・終了日は年月日を含む日序数で比較します。
- 対象種別グループの折りたたみと、完全削除に対応します。グループ化中は見出しに種別を集約し、各行では同じ種別名を繰り返しません。
- 非表示にした項目は薄く残さず、タイムライン最下部の初期状態で閉じた「非表示にした項目」グループへ集約します。表示行数はグループ見出しを除いた実項目だけを数えます。
- プロジェクト設定と対象種別管理はタイムラインを離れず右サイドパネルで開けます。対象種別の変更はタイムラインアイテムフォームの選択肢へ即時反映されます。
- 新規プロジェクトの作成成功後はタイムラインを開きます。独立した設定画面は一覧へ、独立した対象種別画面は設定へ戻ります。
- 対象種別による並び替えは、名称の五十音順ではなく対象種別管理で設定した表示順を使用します。
- タイムライン一覧APIは長文の本文・出典・外部URLを取得せず、詳細APIでのみ取得します。

Phase 4で提供するAPI：

```text
GET    /api/projects/[projectId]/timeline
GET    /api/projects/[projectId]/items/[itemId]
POST   /api/projects/[projectId]/items
PATCH  /api/projects/[projectId]/items/[itemId]
DELETE /api/projects/[projectId]/items/[itemId]
```

手動順・グループ移動も同じ `PATCH` APIへ `manualOrder` と任意の `typeId` を送信します。

## 時間軸操作

Phase 5では、タイムラインを精密な日単位座標へ移行し、次の操作と性能対策を実装しています。

- 歴史日付とX座標を、うるう年を含む先発グレゴリオ暦の日序数で相互変換します。西暦0年やJavaScript `Date` は歴史日付計算に使用しません。
- 段階式ズーム、ボタン、スライダー、`Alt + ホイール` に対応します。ホイール操作はカーソル位置、ボタンとスライダーは表示中央の日付を維持します。
- 「全項目を表示」は、曖昧期間、終了時期不明のフェード範囲、継続中項目のサーバー基準当日まで含めて表示範囲へ収めます。
- 横ドラッグ、通常スクロールバー、トラックパッドでパンできます。操作中も期間型バーと時点型マーカーを維持し、左側の項目情報列と右側の操作列は固定されます。ドラッグ自体はブラウザのスクロールへ直接追従させ、目盛り再計算に使う状態同期は最大約30fpsへまとめています。
- 表示倍率に応じて世紀、十年、年、月、日の主目盛り・補助目盛りを生成し、プロジェクトの最小時間単位を超えて細分化しません。
- 曖昧開始・終了のグラデーション幅は既定年数を実座標へ変換して描画し、登録点自体を維持します。
- TanStack Virtualで縦方向を仮想化し、表示年代外の横棒・マーカーを描画しません。単一の時点データだけの場合は前後に表示余白を確保し、読みやすい縮尺にします。
- 画面下部の「表示中」件数は、スクロール位置やグループの折りたたみにかかわらず、非表示に設定されていないタイムラインアイテム数を表示します。
- 標準／高密度の表示密度を切り替えられます。内部値の `comfortable`／`compact` は維持しますが、表示モードとの混同を避けるためUIでは「コンパクト」を密度名に使用しません。切替時は仮想行を再計測し、プロジェクトの初期密度と反対方向へ変更しても行位置を維持します。ズーム、スクロール、パン状態、密度はZustandのワークスペース単位ストアで管理します。

Phase 5はDB、RLS、APIの変更を必要とせず、既存のタイムライン一覧APIが返す軽量データを使用します。

## イベントアイテムと詳細表示

Phase 6では、期間型タイムラインアイテムへイベントアイテムを登録し、タイムライン上の独立した円形マーカーから詳細を開けます。

- メインの「アイテムを追加」メニューから「タイムラインを追加」「イベントを追加」を選択できます。イベントアイテムはタイムラインアイテムの編集パネル／詳細編集ページと、タイムライン行の時間軸部分のダブルクリックからも登録できます。時点型タイムラインアイテムはクライアント、service、DBトリガーの各層で親として拒否します。
- ダブルクリック位置は現在の表示倍率に応じ、広域表示では年、年表示では月、近接表示では日にスナップします。フォームでは自由に修正でき、曖昧フラグは自動設定しません。
- 親期間外の日付は保存を許可しつつ、没後刊行・回顧展等を想定した警告を表示します。
- 保存前は破線の仮マーカー、保存後は輪郭を強調できるマーカーを表示します。タイムラインアイテムとイベントアイテムは共通ホバーUIでタイトルと日付または期間を固定ラベルなしに表示し、同じ輪郭強調を使用します。クリックは詳細、ダブルクリックは編集を開きます。
- タイムラインから開いた詳細・編集はIntercepting RoutesとParallel RoutesによるURL連動オーバーレイです。詳細の編集ボタンは背景ページを変えず、同じオーバーレイを編集フォームへ切り替えます。ブラウザの戻る操作で詳細へ戻り、さらに戻ると閉じます。同じURLへ直接アクセスした場合は通常ページを表示します。モーダル内のイベント一覧はモーダル遷移を継続し、通常のタイムラインアイテム詳細にあるイベント一覧とイベント詳細の親パンくずは通常ページへハード遷移します。
- D&Dコンテキストにはワークスペース固有の安定IDを設定し、SSR後の再読み込みでもアクセシビリティ属性のhydration差分を発生させません。
- タイムラインアイテムはタイトルまたは横棒／時点マーカーのクリックで詳細を開きます。詳細はイベントアイテムと同じく、大きなタイトル、プロパティ、区切り線、本文の順に表示します。
- タイムラインアイテムとイベントアイテムの `summary` カラムは廃止しています。詳細モーダルは全画面アイコンから同じURLの通常ページへ切り替えられます。フォーム自体の最大化は初期リリース後の候補として残します。
- 一覧APIは本文・出典・外部URLを除く描画用要約だけを返し、詳細APIで完全なデータを取得します。
- `timeline_events` は初期版の単一親を複合外部キーで保証します。`entity_relationships` は将来の多対多関連と関連線描画に備えて導入しますが、登録UIと線描画は将来フェーズまで提供しません。
- 両テーブルでRLSを有効にし、所有者CRUDを許可します。公開プロジェクトSELECT用ポリシーと `anon` のSELECT権限は準備済みですが、実際の匿名公開はPhase 9で親テーブルを含む公開RLSを完成させてから有効になります。
- 公開詳細ページは長い本文・出典を末尾まで読めるよう、公開レイアウトの本文領域を独立した縦スクロールコンテナにします。

Phase 6で提供するAPI：

```text
GET    /api/projects/[projectId]/events
POST   /api/projects/[projectId]/events
GET    /api/projects/[projectId]/events/[eventId]
PATCH  /api/projects/[projectId]/events/[eventId]
DELETE /api/projects/[projectId]/events/[eventId]
```

## マーカーのクラスタリング

Phase 7では、同じタイムライン行で表示領域が接触・重複するイベントマーカーを、表示座標に基づいて自動的にクラスタ化します。

- 表示上の判定直径10px・追加余白0pxを基準に、本当に近いマーカーだけをクラスタへまとめます。年単位で個別表示できる間隔がある場合は、過度に連鎖させません。
- 初期判定後は通常点12px・クラスタ点24pxの実描画径で再確認し、クラスタ点と通常点または別クラスタ点が重なる場合は再結合します。
- 連鎖的に接触するマーカーは1つのクラスタとなり、クラスタ上へ件数を表示します。
- ホバーでは日付順のイベント一覧を確認でき、クリックするとキーボード操作可能な選択モーダルが開きます。選択後は既存のURL連動詳細オーバーレイへ遷移します。
- ズーム、画面リサイズ、サイドパネル開閉によって表示座標または表示幅が変わるたびに再計算し、重なりが解消すると個別マーカーへ戻ります。
- Phase 7はDB、RLS、APIの変更を必要とせず、既存のタイムライン一覧APIが返すイベント要約を使用します。

## コンパクトレーン表示

Phase 7.5では、従来の項目ごとの「行表示」に加え、時間的に重ならないタイムラインアイテムを同じ高さへ自動配置する「コンパクトレーン表示」を追加しました。既定は行表示で、選択状態は `layout=row|compact` のURLクエリへ保持します。

- コンパクトレーン表示では左固定情報列を表示せず、項目名を開始位置または時点位置の上へ描画します。対象種別と期間は常時表示せず、既存の共通ホバーUIから確認します。
- 配置基準には既存の初期ズーム設定を使用します。初期表示時にレーンを計算した後は、通常のズーム、パン、クラスタリング、画面リサイズで上下位置を変更しません。
- 期間型バー、時点型マーカー、項目名、親期間外を含む全イベントマーカーを占有範囲とし、前後16pxの余白を確保します。`ongoing` は当日、`unknown` はフェードアウト終端まで含めます。
- 項目を開始日時、占有終了日時、安定IDの順に処理し、衝突しない最上段のレーンへ決定的に割り当てます。割り当ては表示専用で、DBには保存しません。
- 並び順操作とD&Dは利用できません。対象種別グループは利用でき、グループごとに独立してレーンを計算し、従来どおり展開・折りたたみできます。
- 固定行がないキャンバスをドラッグし、左右だけでなく上下にもパンできます。レーンとグループを単位に仮想化し、1,000項目・10,000イベントの性能目標を維持します。
- 表示密度のUI表記は「標準」／「高密度」とし、「コンパクト」は表示モード名だけに使用します。
- タイムライン上部は、追加と表示モードを常設し、並び順・方向・グループ化を「配置」、表示密度を密度メニューへまとめています。ズーム操作と全体表示は時間軸側の操作バーへ分離します。

Phase 7.5ではDB、RLS、APIを変更せず、既存のタイムライン一覧データと `project_settings.initial_zoom_preset` を使用しています。

## フィルターと全体検索

Phase 8では、現在のプロジェクトだけを対象にするタイムラインフィルターと、所有する全プロジェクトを横断するPGroonga全文検索を追加しました。

- タイムライン上部の「フィルター」から、名称・本文・イベント・出典・対象種別名のフリーワード、対象種別、開始／終了年、イベント有無、曖昧状態、個別色、表示状態を組み合わせられます。
- 非一致項目は非表示または薄表示を選べます。薄表示は行表示とコンパクトレーン表示の両方に適用され、イベントだけが一致した場合は親項目を残して一致マーカーへリングを表示します。
- 条件は `q`、`types`、`from`、`to`、`hasEvents`、`approximate`、`hasColor`、`visibility`、`filterMode` のURLクエリへ同期され、再読み込みとブラウザ履歴から復元されます。既存の `layout` 等の表示状態は保持します。
- ヘッダーの全体検索は300ms後に候補を表示し、Enterで `/search` を開きます。検索結果はプロジェクト、タイムラインアイテム、イベントアイテム別に表示でき、一致箇所周辺の抜粋、所属プロジェクト、歴史日付、詳細URL、12件単位のページネーションを提供します。
- `search_documents` はPGroongaインデックスを持ち、プロジェクト・対象種別・アイテム・イベントの変更と削除を内部トリガーで同期します。通常ユーザーからの直接書き込みは許可しません。
- RLSにより非公開データは所有者だけが検索でき、公開データは認証済みの他ユーザーと匿名API利用者も検索できます。公開専用詳細URLと匿名公開画面はPhase 9で完成させます。
- タイムライン検索は長文を描画用一覧へ追加せず、一致IDだけを検索APIから取得するため、既存の軽量一覧と仮想化を維持します。

## 登録UI・タイムライン画面・詳細導線

Phase 8.5では、Phase 9の公開・共有でも再利用する登録と詳細閲覧の共通UIを完成させました。

- タイムラインアイテム追加サイドパネルの時間形式、曖昧状態、表示状態、個別色、日付入力を再配置し、個別色にはカラーピッカーを追加しました。期間／時点を切り替えても入力済みの開始日を維持します。タイムライン／イベントの「日付はおおよそ」は、日付の右側へ並ぶ共通の枠付きチェックボックスへ統一しています。
- 新規タイムラインアイテムと0件以上のイベントアイテムを一度に送信できます。`create_timeline_item_with_events` はRLSを適用した `SECURITY INVOKER` 関数で親を先に保存し、イベントを個別に追加します。一部イベントが失敗しても親と成功したイベントは維持され、失敗したタイトルと安全な理由を通知します。
- PCのタイムラインは説明折りたたみ時に1画面へ収め、説明は1行表示と展開を切り替えます。タイムラインと詳細モーダルのスクロールバーも角丸に調和する細いデザインへ統一しました。
- 詳細モーダルの全画面化、両個別ページ共通の外枠・内側余白と余白切替、検索結果へ戻れるパンくずと安全な `returnTo` を追加しました。タイムラインアイテム詳細ではイベント件数を展開してタイトル・日付・詳細リンクを確認でき、イベント詳細のパンくずは親タイムラインアイテムから始まります。URL直接アクセス時もタイムラインへの導線を常設します。
- タイムライン内検索はIME変換中の入力をローカルに保持し、確定後にURLへ反映します。フィルターサイドパネルを開いても背景はぼかしません。

Phase 8.5で拡張したAPI：

```text
POST /api/projects/[projectId]/items
  body: { item, events[] }
  response: { item, createdEventIds[], failedEvents[] }
```

## Phase 9：公開・共有

- プロジェクト設定とタイムライン内の設定パネルから、確認ダイアログ付きで公開・非公開を切り替えられます。
- 初回公開時に推測困難な `public_id` をDBで生成し、`/public/[publicId]` を共有URLとして発行します。非公開化してもIDは維持し、再公開では同じURLを使用します。
- 共有URLのコピー、別タブ表示、URL再発行に対応しています。再発行後は旧URLが直ちに404になります。
- 公開ページでは認証不要で、パン、ズーム、表示モード、配置、フィルター、タイムラインアイテム／イベントアイテム詳細を利用できます。管理ナビ、追加、編集、削除、並べ替えは表示しません。
- `projects`、`project_settings`、`timeline_item_types`、`timeline_items`、`timeline_events` の匿名SELECTは、公開プロジェクト配下だけをRLSで許可します。書き込みは引き続き所有者だけです。
- 非公開化は匿名閲覧へ即時反映されます。`noindex`、`X-Robots-Tag`、`robots.txt` はアプリ全体へ適用しますが、アクセス制御はサーバー認可とRLSが担います。

Phase 9で提供するAPI：

```text
POST /api/projects/[projectId]/publish
POST /api/projects/[projectId]/unpublish
POST /api/projects/[projectId]/public-id/regenerate
```

## 次の実装：Phase 10

JSON／CSV入出力、モバイル閲覧、性能、アクセシビリティの仕上げを行います。

Phase 8で提供するAPI：

```text
GET /api/search
GET /api/projects/[projectId]/timeline/search
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
