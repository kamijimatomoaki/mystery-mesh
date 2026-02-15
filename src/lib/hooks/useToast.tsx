/**
 * useToast Hook
 * トースト通知を簡単に表示するためのフック
 */

"use client";

import { createContext, useContext, useState, useCallback, ReactNode, useEffect } from "react";
import { ToastContainer } from "@/components/atoms/Toast";
import type { ToastVariant } from "@/components/atoms/Toast";

interface Toast {
  id: string;
  message: string;
  variant?: ToastVariant;
  duration?: number;
}

interface ToastContextValue {
  show: (message: string, options?: { variant?: ToastVariant; duration?: number }) => void;
  info: (message: string, duration?: number) => void;
  success: (message: string, duration?: number) => void;
  warning: (message: string, duration?: number) => void;
  error: (message: string, duration?: number) => void;
  close: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const close = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const show = useCallback(
    (
      message: string,
      options?: { variant?: ToastVariant; duration?: number }
    ) => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      const toast: Toast = {
        id,
        message,
        variant: options?.variant || "info",
        duration: options?.duration ?? 4000,
      };

      setToasts((prev) => [...prev, toast]);

      // 自動で閉じる
      if (toast.duration && toast.duration > 0) {
        setTimeout(() => {
          close(id);
        }, toast.duration);
      }
    },
    [close]
  );

  const info = useCallback(
    (message: string, duration?: number) => {
      show(message, { variant: "info", duration });
    },
    [show]
  );

  const success = useCallback(
    (message: string, duration?: number) => {
      show(message, { variant: "success", duration });
    },
    [show]
  );

  const warning = useCallback(
    (message: string, duration?: number) => {
      show(message, { variant: "warning", duration });
    },
    [show]
  );

  const error = useCallback(
    (message: string, duration?: number) => {
      show(message, { variant: "error", duration });
    },
    [show]
  );

  return (
    <ToastContext.Provider value={{ show, info, success, warning, error, close }}>
      {children}
      <ToastContainer toasts={toasts} onClose={close} />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within ToastProvider");
  }
  return context;
}
