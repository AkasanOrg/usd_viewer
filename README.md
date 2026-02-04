# USD Viewer

USDA（Universal Scene Description Asset）ファイル用のコードエディタと3Dビューワーです。

## 機能

### エディタ
- Monaco Editorによるコード編集
- USDAシンタックスハイライト
- コード折りたたみ・括弧マッチング

### 3Dビューワー
- リアルタイムプレビュー（編集と同時に反映）
- 対応プリミティブ: Sphere, Cube, Cylinder, Cone, Xform
- アニメーション再生（timeSamples対応）
- タイムラインコントロール
- アニメーションのビデオ録画（WebM形式）

### 複数ファイル対応
- 仮想ファイルシステムによる複数USDAファイル管理
- ファイルツリーでワークスペースを表示
- タブによるファイル切り替え
- ファイルのインポート/エクスポート

### Reference / Payload サポート
- 別ファイルの参照（`references = @./path/to/file.usda@`）
- 特定Primの参照（`references = @./file.usda@</PrimPath>`）
- Payload構文にも対応
- 循環参照の検出とエラー表示

## 使用例

### 基本的なUSDA

```usda
#usda 1.0

def Sphere "MySphere"
{
    double radius = 1.0
    color3f[] primvars:displayColor = [(1.0, 0.3, 0.2)]
}
```

### アニメーション付きUSDA

```usda
#usda 1.0
(
    startTimeCode = 0
    endTimeCode = 48
)

def Sphere "AnimatedSphere"
{
    double radius.timeSamples = {
        0: 0.5,
        24: 1.5,
        48: 0.5,
    }
}
```

### Reference を使った構成

```usda
# main.usda
#usda 1.0

def Xform "World"
{
    def "ImportedCube" (
        references = @./models/cube.usda@
    ) {
        double3 xformOp:translate = (2, 0, 0)
        uniform token[] xformOpOrder = ["xformOp:translate"]
    }
}
```

```usda
# models/cube.usda
#usda 1.0

def Cube "MyCube"
{
    double size = 1.0
    color3f[] primvars:displayColor = [(0.2, 0.6, 1.0)]
}
```

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
