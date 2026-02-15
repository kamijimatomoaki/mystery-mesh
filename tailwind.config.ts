import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/features/**/*.{js,ts,jsx,tsx,mdx}", // Feature-Sliced Design対応
  ],
  theme: {
    extend: {
      colors: {
        // "Infinite Mystery Library" Theme Palette
        primary: {
          DEFAULT: "#0f172a", // Slate 900: Primary Black (深い闇)
          foreground: "#f1f5f9", // Slate 100: Paper White (紙の白)
        },
        accent: {
          red: "#9f1239", // Rose 800: Blood Red (封蝋、警告)
          gold: "#d97706", // Amber 600: Magic Gold (魔法、ハイライト)
        },
        paper: {
          DEFAULT: "#f5e6c8", // Old Parchment (羊皮紙)
          dark: "#e6d5b0",
        },
        ink: {
          DEFAULT: "#0a0a0a", // Ink Black (インク)
          light: "#1e293b",
        },
        // Dark Academia Enhanced Palette
        parchment: {
          light: "#f4f1e8", // 羊皮紙（明）
          DEFAULT: "#f5e6c8", // 羊皮紙（標準）
          dark: "#d4c5a1", // 羊皮紙（暗）
        },
        "ink-black": "#1a1410", // インク黒
        "ink-brown": "#3d2817", // インク茶
        "blood-red": "#8b1538", // 血のような赤
        "gold-accent": "#c9a961", // 金箔
        "emerald-accent": "#2d5f4a", // エメラルド
        "amber-accent": "#d4a574", // 琥珀
        // Semantic Colors (Dark Academia)
        success: "#4a7c59",
        warning: "#c17817",
        danger: "#8b1538",
        info: "#4a5d7c",
      },
      fontFamily: {
        // next/font/google でロードしたフォント変数を指定することを想定
        serif: ["var(--font-shippori-mincho)", "serif"], // 見出し用
        sans: ["var(--font-noto-sans-jp)", "sans-serif"], // 本文用
        mono: ["var(--font-cinzel)", "monospace"], // 数字・装飾用
        // Dark Academia Typography
        title: ["var(--font-cinzel)", "var(--font-playfair)", "serif"], // タイトル用
        body: ["var(--font-crimson)", "var(--font-shippori-mincho)", "serif"], // 本文用
        ui: ["var(--font-noto-sans-jp)", "sans-serif"], // UI用
      },
      fontSize: {
        xs: ["0.75rem", { lineHeight: "1rem" }],
        sm: ["0.875rem", { lineHeight: "1.25rem" }],
        base: ["1rem", { lineHeight: "1.5rem" }],
        lg: ["1.125rem", { lineHeight: "1.75rem" }],
        xl: ["1.25rem", { lineHeight: "1.75rem" }],
        "2xl": ["1.5rem", { lineHeight: "2rem" }],
        "3xl": ["1.875rem", { lineHeight: "2.25rem" }],
        "4xl": ["2.25rem", { lineHeight: "2.5rem" }],
        "5xl": ["3rem", { lineHeight: "1" }],
      },
      spacing: {
        1: "0.25rem", // 4px
        2: "0.5rem", // 8px
        3: "0.75rem", // 12px
        4: "1rem", // 16px
        6: "1.5rem", // 24px
        8: "2rem", // 32px
        12: "3rem", // 48px
        16: "4rem", // 64px
      },
      boxShadow: {
        sm: "0 1px 2px 0 rgb(0 0 0 / 0.05)",
        DEFAULT:
          "0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)",
        md: "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)",
        lg: "0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)",
        xl: "0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)",
        // Special: Parchment Shadow
        parchment:
          "0 2px 4px rgba(61, 40, 23, 0.1), 0 4px 8px rgba(61, 40, 23, 0.08), inset 0 0 0 1px rgba(201, 169, 97, 0.2)",
        // Card shadows
        "card-hover":
          "0 20px 40px -10px rgba(0, 0, 0, 0.2), 0 0 15px rgba(201, 169, 97, 0.15)",
      },
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
        "library-overlay":
          "linear-gradient(to bottom, rgba(15, 23, 42, 0.8), rgba(15, 23, 42, 0.95))",
        "parchment-texture":
          "linear-gradient(to bottom, #f4f1e8 0%, #f5e6c8 50%, #d4c5a1 100%)",
        "ink-gradient": "linear-gradient(135deg, #1a1410 0%, #3d2817 100%)",
      },
      animation: {
        "fade-in": "fadeIn 0.5s ease-out forwards",
        "page-flip": "pageFlip 0.6s ease-in-out forwards",
        "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "card-flip": "cardFlip 0.6s ease-in-out",
        "ink-spread": "inkSpread 0.8s ease-out forwards",
        "candle-flicker": "candleFlicker 2s ease-in-out infinite",
        "book-open": "bookOpen 0.5s ease-out forwards",
        shimmer: "shimmer 2s linear infinite",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0", filter: "blur(4px)" },
          "100%": { opacity: "1", filter: "blur(0)" },
        },
        pageFlip: {
          "0%": { transform: "rotateY(0deg)", transformOrigin: "left" },
          "100%": { transform: "rotateY(-180deg)", transformOrigin: "left" },
        },
        cardFlip: {
          "0%": { transform: "rotateY(0deg)" },
          "50%": { transform: "rotateY(90deg)" },
          "100%": { transform: "rotateY(180deg)" },
        },
        inkSpread: {
          "0%": {
            opacity: "0",
            transform: "scale(0.8)",
            filter: "blur(10px)",
          },
          "100%": {
            opacity: "1",
            transform: "scale(1)",
            filter: "blur(0px)",
          },
        },
        candleFlicker: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.85" },
        },
        bookOpen: {
          "0%": { transform: "scaleY(0)", transformOrigin: "top" },
          "100%": { transform: "scaleY(1)", transformOrigin: "top" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-1000px 0" },
          "100%": { backgroundPosition: "1000px 0" },
        },
      },
    },
  },
  plugins: [],
};
export default config;
