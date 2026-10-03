# spherical-circle-packing-unfolding

3D球面上に敷き詰めたサークルパッキングを、正弦波アニメーションで各種2D地図投影図法へと滑らかに展開・可視化するジェネラティブアートアプリケーション。

## 目次

1. [概要](#1-概要)
2. [仕組み](#2-仕組み)
3. [構造](#3-構造)
4. [実行方法](#4-実行方法)
5. [設計のこだわり](#5-設計のこだわり)

## 1. 概要

`spherical-circle-packing-unfolding` は、球面幾何学における測地線距離に基づいたサークルパッキング（円充填）アルゴリズムと、各種地図投影法（Winkel Tripel、Mercator、Azimuthal Equidistant、Mollweide、Orthographic）を組み合わせたインタラクティブなジェネラティブアートスタジオです。

3D球面上の各円の頂点を正規直交基底を用いて高精度に算出し、正弦波イージング曲線に沿って2D平面地図へシームレスに展開（Unfolding）・折りたたみ（Folding）を行います。

## 2. 仕組み

- **球面サークルパッキングアルゴリズム**: 球面上のランダムサンプリングと測地線（大円距離）の衝突判定（Rejection Sampling）を行い、特異点のない正規直交基底 $(U, V)$ を生成して球面上接平面の円周頂点を正確に算出
- **地図投影数学**: 3次元直交座標系から経度・緯度 $(\lambda, \phi)$ へ変換し、ヴィンケル図法、メルカトル図法、モルワイデ図法、正距方位図法、正射図法の計算式を適用して2D平面座標を算出
- **動画録画エンジン**: `mp4-muxer` と WebCodecs API (`VideoEncoder`) を使用し、ブラウザ上でハードウェアアクセラレーションを活用した高速かつ高品質な H.264 MP4 動画を直接生成（非対応環境では MediaRecorder による 60fps WebM フォールバック）
- **高解像度レンダリング & ベクター出力**: オフスクリーン p5 インスタンスにより、2880×2880pxの高精細PNGおよび `p5.js-svg` によるベクターSVG出力に対応

### 技術スタック

- 言語: TypeScript
- フレームワーク: React 18
- 描画エンジン: p5.js (v1.11.13), p5.js-svg
- 状態管理: Jotai
- UI / アニメーション: Tailwind CSS, Framer Motion, Lucide React
- 動画録画: mp4-muxer (WebCodecs H.264 MP4), MediaRecorder (WebM fallback)
- ビルドツール: Vite
- リンター / フォーマッター: Biome
- テストフレームワーク: Vitest
- 未使用コード検知: Knip
- パッケージマネージャー: pnpm

## 3. 構造

```text
spherical-circle-packing-unfolding/
├── .gitignore                      - outputフォルダやビルド成果物の除外設定
├── .npmrc                          - pnpmビルドスクリプト許可設定
├── biome.json                      - コードスタイルおよびLinter設定
├── index.html                      - アプリケーションHTMLエントリーポイント
├── package.json                    - プロジェクト設定および依存パッケージ
├── postcss.config.js               - PostCSS設定
├── tailwind.config.js              - Tailwind CSS設定
├── tsconfig.json                   - TypeScript設定
├── vite.config.ts                  - Vite開発サーバー設定
├── vitest.config.ts                - Vitest設定
├── output/                         - 生成された高解像度画像・録画動画の保存先
└── src/
    ├── main.tsx                    - アプリケーション起動とp5.jsマウント制御
    ├── index.css                   - グローバルスタイル定義 (Zen Maru Gothic)
    ├── vite-env.d.ts               - 環境型定義
    ├── components/
    │   ├── ControlPanel.tsx        - 開閉式ツールバーサイドバーUI
    │   ├── RecordingOverlay.tsx    - 録画状態インジケーターオーバーレイ
    │   ├── ToastNotification.tsx   - アニメーション付きトースト通知
    │   └── drawers/
    │       ├── ProjectionSection.tsx  - 投影法・モーフィング操作
    │       ├── PackingSection.tsx     - サークルパッキング設定
    │       ├── MaterialSection.tsx    - カラーパレット・質感マテリアル設定
    │       ├── AutomationSection.tsx  - オートメーション・ランダム・Nループ録画
    │       └── ExportSection.tsx      - 画像・動画・JSONエクスポート
    ├── constants/
    │   ├── palettes.ts             - 厳選カラーパレット定義集
    │   └── projections.ts          - 地図投影法定義・説明リスト
    ├── core/
    │   ├── exporter.ts             - 高解像度PNG、ベクターSVG、JSON出力
    │   ├── recorder.ts             - mp4-muxer / WebCodecs 動画録画マネージャー
    │   ├── math/
    │   │   ├── coordinates.ts      - 直交座標・球面座標変換
    │   │   ├── orthonormal.ts      - 極点特異点を解消する正規直交基底計算
    │   │   ├── packing.ts          - 球面サークルパッキング幾何計算
    │   │   ├── projections.ts      - 地図投影法2D座標算出
    │   │   └── rotation.ts         - 3次元球面姿勢回転計算
    │   └── renderers/
    │       ├── circleRenderer.ts   - 深度ソート付きサークルパッキング描画
    │       ├── debugOverlay.ts     - HUDデバッグ情報描画
    │       ├── grainBuffer.ts      - フィルム調ノイズバッファ生成
    │       └── gridRenderer.ts     - 経緯線 (Graticule) 描画
    ├── hooks/
    │   ├── useKeyboardShortcuts.ts - ショートカットキーバインディング
    │   └── useSketchHandlers.ts    - 状態変更・履歴管理 (Undo/Redo) ハンドラー
    ├── state/
    │   └── sketchStore.ts          - Jotaiステート定義 (アトム)
    ├── tests/
    │   ├── color.test.ts           - 色彩変換・グラデーション生成テスト
    │   ├── coordinates.test.ts     - 座標系変換テスト
    │   ├── orthonormal.test.ts     - 正規直交基底計算テスト
    │   └── projections.test.ts     - 地図投影法数学テスト
    ├── types/
    │   └── sketch.ts               - 型定義 (パレット、円、パラメータ等)
    └── utils/
        ├── color.ts                - 色彩計算・補間ユーティリティ
        └── date.ts                 - 日時フォーマットユーティリティ
```

## 4. 実行方法

| コマンド | 実行内容 |
|---|---|
| `pnpm install` | パッケージのインストール |
| `pnpm dev` | 開発サーバーの起動 (ローカル自動起動) |
| `pnpm build` | TypeScript型チェックおよび本番バンドルビルド |
| `pnpm preview` | ビルド成果物のローカルプレビュー |
| `pnpm test` | Vitestによる数学・ユーティリティのユニットテスト実行 |
| `pnpm check` | Biomeによる静的解析および構文チェック |
| `pnpm format` | Biomeによるコードフォーマットの適用 |
| `pnpm knip` | Knipによる未使用コード・エクスポート・依存関係の検知 |

### キーボードショートカット

| キー | アクション |
|---|---|
| `R` | MP4 動画録画の開始 |
| `S` | 動画録画の停止・保存 |
| `Space` | 自動展開モーフィングアニメーションの再生 / 一時停止 |
| `H` | 左側UIコントロールパネルの表示 / 非表示トグル |
| `D` | 画面左上HUDデバッグ情報の表示 / 非表示トグル |
| `Ctrl + Z` / `Cmd + Z` | パラメータ変更を元に戻す (Undo) |
| `Ctrl + Y` / `Cmd + Shift + Z` | パラメータ変更をやり直す (Redo) |

## 5. 設計のこだわり

- **数学的特異点の排除**: 球面上の円を正確に平面へ投影するため、各サンプリング点における法線ベクトルに対し極点近傍での特異点を回避する正規直交基底 $(U, V)$ を生成し、円周頂点（デフォルト64分割、スライダーにより16〜128分割まで動的調整可能）を滑らかに生成しています
- **正弦波イージング補間**: $0.5 - 0.5 \times \cos(\theta)$ を用いた連続的で有機的なモーフィングを行い、3D球体の自転運動と2D展開地図の境界線が自然に繋がる設計にしています
- **深度ソートとライティング**: 3D球面上にある円の法線ベクトルのZ深度を計算し、奥にある円から手前にある円へと順にソートして描画。奥にある円は自動的に明度と不透明度を抑制することで、疑似的な空気遠近法と陰影を表現しています
- **クリエイティブワークフローの統合**: 高解像度画像出力（2880×2880px）、ベクターSVG、WebCodecsによる60fps MP4録画、プリセットJSONのインポート/エクスポート、Undo/Redo履歴管理をワンストップで利用可能です
