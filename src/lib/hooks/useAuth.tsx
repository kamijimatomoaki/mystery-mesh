/**
 * useAuth Hook
 * Firebase認証の状態管理
 */

"use client";

import { useState, useEffect, useMemo, createContext, useContext, useCallback } from "react";
import {
  User,
  onAuthStateChanged,
  signInWithPopup,
  signInAnonymously,
  signOut as firebaseSignOut,
  GoogleAuthProvider,
} from "firebase/auth";
import { auth } from "@/core/db/firestore-client";

interface AuthState {
  user: User | null;
  loading: boolean;
  error: Error | null;
}

interface AuthContextValue extends AuthState {
  signInWithGoogle: () => Promise<void>;
  signInAsGuest: () => Promise<void>;
  signOut: () => Promise<void>;
  isAuthenticated: boolean;
  isAnonymous: boolean;
  userId: string | null;
  displayName: string | null;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * AuthProvider コンポーネント
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    loading: true,
    error: null,
  });

  // 認証状態の監視
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(
      auth,
      (user) => {
        setState({
          user,
          loading: false,
          error: null,
        });
        console.log("[Auth] State changed:", user?.uid || "signed out");
      },
      (error) => {
        console.error("[Auth] Error:", error);
        setState({
          user: null,
          loading: false,
          error: error as Error,
        });
      }
    );

    return () => unsubscribe();
  }, []);

  // Googleサインイン
  const signInWithGoogle = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      console.log("[Auth] Google sign in successful");
    } catch (error) {
      console.error("[Auth] Google sign in failed:", error);
      setState((prev) => ({
        ...prev,
        loading: false,
        error: error as Error,
      }));
      throw error;
    }
  }, []);

  // 匿名サインイン
  const signInAsGuest = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      await signInAnonymously(auth);
      console.log("[Auth] Anonymous sign in successful");
    } catch (error) {
      console.error("[Auth] Anonymous sign in failed:", error);
      setState((prev) => ({
        ...prev,
        loading: false,
        error: error as Error,
      }));
      throw error;
    }
  }, []);

  // サインアウト
  const signOut = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true }));
    try {
      await firebaseSignOut(auth);
      console.log("[Auth] Sign out successful");
    } catch (error) {
      console.error("[Auth] Sign out failed:", error);
      setState((prev) => ({
        ...prev,
        loading: false,
        error: error as Error,
      }));
      throw error;
    }
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    ...state,
    signInWithGoogle,
    signInAsGuest,
    signOut,
    isAuthenticated: !!state.user,
    isAnonymous: state.user?.isAnonymous ?? false,
    userId: state.user?.uid ?? null,
    displayName: state.user?.displayName ?? (state.user?.isAnonymous ? "ゲスト" : null),
  }), [state, signInWithGoogle, signInAsGuest, signOut]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * useAuth フック
 */
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

/**
 * 現在のユーザーIDを取得するヘルパー
 * 未認証の場合はフォールバックIDを返す（開発環境のみ）
 */
export function useCurrentUserId(fallbackId?: string): string | null {
  const { userId } = useAuth();
  // 本番環境ではフォールバックを使用しない
  if (process.env.NODE_ENV === "production") {
    return userId;
  }
  return userId ?? fallbackId ?? null;
}
