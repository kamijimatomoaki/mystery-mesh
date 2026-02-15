/**
 * App Providers
 * 全アプリケーションプロバイダーを統合
 */

"use client";

import { AuthProvider } from "@/lib/hooks/useAuth";
import { ToastProvider } from "@/lib/hooks/useToast";
import { LoadingProvider } from "@/contexts/LoadingContext";

interface ProvidersProps {
  children: React.ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  return (
    <AuthProvider>
      <ToastProvider>
        <LoadingProvider>{children}</LoadingProvider>
      </ToastProvider>
    </AuthProvider>
  );
}
