# USD Viewer

USDA（Universal Scene Description Asset）ファイル用のコードエディタと3Dビューワーです。

## 機能

- USDAを編集するためのコードエディタ（Monaco Editor）
- シンタックスハイライト対応
- リアルタイムで3Dアセットをプレビュー表示

## 必要環境

- Node.js 25.5.0（[mise](https://mise.jdx.dev/) を使用している場合は自動で設定されます）

## セットアップ

```bash
# リポジトリをクローン
git clone https://github.com/AkasanOrg/usd_viewer.git
cd usd_viewer

# 依存関係をインストール
cd usd-viewer
npm install
```

## 使い方

### 開発サーバーの起動

```bash
cd usd-viewer
npm run dev
```

ブラウザで http://localhost:5173 にアクセスしてください。

### プロダクションビルド

```bash
cd usd-viewer
npm run build
```

ビルド結果は `usd-viewer/dist` に出力されます。

### ビルド結果のプレビュー

```bash
cd usd-viewer
npm run preview
```

### Lint

```bash
cd usd-viewer
npm run lint
```

## 技術スタック

- [Vite](https://vite.dev/) - ビルドツール
- [React](https://react.dev/) - UIフレームワーク
- [TypeScript](https://www.typescriptlang.org/) - 型付きJavaScript
- [Monaco Editor](https://microsoft.github.io/monaco-editor/) - コードエディタ
- [Three.js](https://threejs.org/) / [React Three Fiber](https://docs.pmnd.rs/react-three-fiber/) - 3Dレンダリング
