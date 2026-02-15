# MisteryMesh

**The Infinite Mystery Library** - AI×人間が織りなす、次世代マーダーミステリープラットフォーム

## 概要

MisteryMeshは、AIエージェントと人間が一緒にプレイする、ユーザー生成型マーダーミステリープラットフォームです。Google Cloud Vertex AI（Gemini、Imagen、Veo）を活用し、無限に生成される事件に挑戦できます。

### 世界観

**"The Infinite Mystery Library"（無限のミステリー図書館）**

プレイヤーは、時空の狭間にある「終わりのない図書館」に迷い込んだ読者として、AIの司書とともに様々な事件を解決していきます。

## 技術スタック

- **Frontend**: Next.js 15.1 (App Router) + React 19
- **Styling**: Tailwind CSS 3.4 + Framer Motion 11
- **Type Safety**: TypeScript 5 (strict mode) + Zod
- **Backend**: Next.js API Routes (BFF Pattern)
- **Database**: Firebase Firestore + Firebase Admin
- **AI**: Google Vertex AI
  - Gemini (Text Generation & Reasoning)
  - Imagen (Image Generation)
  - Veo (Video Generation)
- **Auth**: Google Cloud ADC (API Keyless)

## プロジェクト構成

```
src/
├── app/                  # Next.js App Router
│   ├── api/             # BFF Layer
│   ├── debug/           # Component Showcase
│   ├── game/            # Game Pages
│   └── library/         # Scenario Library
├── core/                # Application Core
│   ├── config/          # Configuration
│   ├── db/              # Firebase
│   ├── llm/             # Vertex AI
│   └── types/           # Type Definitions
├── features/            # Domain Logic (FSD)
│   ├── agent/           # AI Agent
│   ├── scenario/        # Scenario Generation
│   ├── library/         # Scenario Sharing
│   ├── ending/          # Ending Generation
│   └── gm/              # Game Master
├── components/          # Shared UI Components
│   ├── atoms/           # Button, Card, Input, etc.
│   └── molecules/       # Modal, etc.
└── lib/                 # Utilities
```

## セットアップ

### 1. 依存関係のインストール

```bash
npm install
```

### 2. 環境変数の設定

`.env.local` ファイルを作成し、以下の環境変数を設定してください：

```env
# Firebase (Public)
NEXT_PUBLIC_FIREBASE_API_KEY=your-api-key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
NEXT_PUBLIC_FIREBASE_APP_ID=your-app-id

# Google Cloud (Private)
GOOGLE_CLOUD_PROJECT=your-gcp-project-id
GOOGLE_CLOUD_REGION=us-central1

# Vertex AI Models (Optional)
VERTEX_MODEL_TEXT=gemini-1.5-pro-002
VERTEX_MODEL_IMAGE=imagen-3.0-generate-001
VERTEX_MODEL_VIDEO=veo-001
```

### 3. 開発サーバーの起動

```bash
npm run dev
```

http://localhost:3000 でアプリケーションが起動します。

### 4. コンポーネントデモ

http://localhost:3000/debug で全UIコンポーネントのデモを確認できます。

## 開発コマンド

```bash
# 開発サーバー起動
npm run dev

# 本番ビルド
npm run build

# 本番サーバー起動
npm start

# 型チェック
npm run type-check

# Lint
npm run lint
```

## UIコンポーネント

Dark Academiaテーマに沿った、世界観のあるUIコンポーネントライブラリ。

### 実装済みコンポーネント

#### Atoms (基本コンポーネント)
- **Button**: 封蝋風、羽根ペン風などの4種類のバリアント
- **Card**: 羊皮紙風、ダークモード、アウトライン（サブコンポーネント5種）
- **Input / Textarea**: インク風の入力フィールド
- **Loading**: 砂時計、インク滲みアニメーション（3種類）
- **Checkbox**: 図書館のチェックリスト風
- **Radio**: ラジオボタン（RadioGroupコンテナ付き）
- **Badge**: タグ・ラベル（7種類のバリアント、削除可能）
- **Select**: ドロップダウン選択（外部クリック・ESCキー対応）
- **Progress**: プログレスバー + ステップ式プログレス

#### Molecules (複合コンポーネント)
- **Modal**: 図書館風のモーダルダイアログ（Framer Motion）
- **Tooltip**: 注釈風ツールチップ（4方向対応）
- **Tabs**: 索引タブ風（lineとenclosed の2種類）

**合計**: 11種類 + サブコンポーネント

詳細は `/debug` ページで確認できます。

## 開発原則

### 1. API Keyless Architecture

API Keyを一切使用せず、Google Cloud ADC（Application Default Credentials）で認証します。

### 2. Type Safety First

TypeScript strict modeとZodによる厳格なバリデーションを徹底します。

### 3. Feature-Sliced Design

ドメインロジックを `features/` ディレクトリに機能単位で分離します。

### 4. 世界観の一貫性

全てのUI要素で"The Infinite Mystery Library"の世界観を徹底します。

## ドキュメント

- [詳細要件定義書](./docs/project_bible.md)
- [データモデル](./docs/data_model.md)
- [デザインコンセプト](./docs/design_concept.md)
- [開発計画履歴](./docs/plan_history.md)

## ライセンス

Private

## 貢献

現在はプライベートプロジェクトです。

---

**🎭 "あと一人足りない"をAIが埋める。無限に生成される事件に挑め。**
