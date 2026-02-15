"use client";

/**
 * LoadingContext
 * グローバルローディング状態管理
 *
 * 読み込み中に画面右下にローディングオーバーレイを表示
 * Dark Academia世界観に統一
 */

import {
  createContext,
  useContext,
  useState,
  useCallback,
  ReactNode,
} from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Loading } from "@/components/atoms/Loading";

interface LoadingContextType {
  /** ローディング中かどうか */
  isLoading: boolean;
  /** ローディングメッセージ */
  loadingMessage: string;
  /** ローディングを開始 */
  startLoading: (message?: string) => void;
  /** ローディングを終了 */
  stopLoading: () => void;
  /** ローディングメッセージを更新 */
  setLoadingMessage: (message: string) => void;
}

const LoadingContext = createContext<LoadingContextType | undefined>(undefined);

/**
 * ローディング状態を管理するカスタムフック
 */
export function useLoading() {
  const context = useContext(LoadingContext);
  if (!context) {
    throw new Error("useLoading must be used within a LoadingProvider");
  }
  return context;
}

interface LoadingProviderProps {
  children: ReactNode;
}

/**
 * グローバルローディングプロバイダー
 */
export function LoadingProvider({ children }: LoadingProviderProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState("");

  const startLoading = useCallback((message: string = "読み込み中...") => {
    setLoadingMessage(message);
    setIsLoading(true);
  }, []);

  const stopLoading = useCallback(() => {
    setIsLoading(false);
    setLoadingMessage("");
  }, []);

  return (
    <LoadingContext.Provider
      value={{
        isLoading,
        loadingMessage,
        startLoading,
        stopLoading,
        setLoadingMessage,
      }}
    >
      {children}
      <AnimatePresence>
        {isLoading && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ type: "spring", damping: 20, stiffness: 300 }}
            className="fixed bottom-8 right-8 z-[100] bg-ink/90 backdrop-blur-sm rounded-lg px-6 py-4 shadow-2xl border border-accent-gold/30"
          >
            <div className="flex items-center gap-4">
              <Loading variant="hourglass" size="md" />
              <span className="text-paper/80 font-serif text-sm">
                {loadingMessage || "読み込み中..."}
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </LoadingContext.Provider>
  );
}
