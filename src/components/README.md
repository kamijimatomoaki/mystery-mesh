# Shared Components

このディレクトリには、アプリケーション全体で共有される UI コンポーネントを配置します。

## 構成

- `atoms/` - 最小単位のコンポーネント（ボタン、入力欄など）
- `molecules/` - アトムを組み合わせたコンポーネント
- `organisms/` - より複雑なUIブロック

## 命名規則

- コンポーネントファイル: PascalCase (例: `Button.tsx`)
- スタイルは Tailwind CSS を使用
- 型定義は同じファイル内に記述

## 例

```tsx
// atoms/Button.tsx
interface ButtonProps {
  variant?: "primary" | "secondary";
  children: React.ReactNode;
  onClick?: () => void;
}

export function Button({ variant = "primary", children, onClick }: ButtonProps) {
  return (
    <button className={variant === "primary" ? "seal-button" : "..."} onClick={onClick}>
      {children}
    </button>
  );
}
```
