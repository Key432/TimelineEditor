# タイムライン作成支援Webアプリ 仕様書

このファイルは仕様書の索引である。仕様本文は機能領域ごとに `docs/spec/` へ分割しており、実装時は対象Phaseに関係する文書だけを追加で読む。実装済みかどうかと実装順序は `TASKS.md` を正とする。

ユーザー向けUIでは、タイムラインアイテムを分類する従来の「対象種別」を「タイムライン種別」と表記する。DB・APIの `item_type` / `type_id` は互換性維持のため変更しない。

## 仕様書一覧

- [プロダクト・技術・権限・API（1〜7章）](docs/spec/01-product-and-architecture.md)
- [データモデル・プロジェクト・エンティティ（8〜11章）](docs/spec/02-data-and-projects.md)
- [タイムライン・編集・詳細（12〜17章）](docs/spec/03-timeline-and-editing.md)
- [検索・公開・入出力（18〜21章）](docs/spec/04-search-sharing-import.md)
- [レイアウト・端末・品質・性能（22〜27章）](docs/spec/05-layout-quality-performance.md)
- [レベルアップ機能・完了条件（28〜39章）](docs/spec/06-level-up-features.md)

## 実装時の参照

1. `TASKS.md` で対象Phaseを確認する
2. `docs/phases/<phase>.md` を読む
3. 上記一覧から関連仕様だけを読む
4. 強制実装規則は `AGENTS.md` に従う
