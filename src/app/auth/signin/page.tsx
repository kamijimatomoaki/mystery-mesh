/**
 * Sign In Page
 * サインインページ
 */

"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { useAuth } from "@/lib/hooks/useAuth";
import { Button, Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components";
import { ArrowLeft, User, AlertCircle } from "lucide-react";

function SignInContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { signInWithGoogle, signInAsGuest, isAuthenticated, loading, error } = useAuth();

  const [isSigningIn, setIsSigningIn] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  // リダイレクト先
  const redirectTo = searchParams.get("redirect") || "/";

  // 認証済みならリダイレクト
  useEffect(() => {
    if (isAuthenticated && !loading) {
      router.push(redirectTo);
    }
  }, [isAuthenticated, loading, router, redirectTo]);

  const handleGoogleSignIn = async () => {
    setIsSigningIn(true);
    setLocalError(null);
    try {
      await signInWithGoogle();
      router.push(redirectTo);
    } catch (err) {
      setLocalError("Googleサインインに失敗しました。もう一度お試しください。");
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleGuestSignIn = async () => {
    setIsSigningIn(true);
    setLocalError(null);
    try {
      await signInAsGuest();
      router.push(redirectTo);
    } catch (err) {
      setLocalError("ゲストサインインに失敗しました。もう一度お試しください。");
    } finally {
      setIsSigningIn(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen ink-bg flex items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
          className="text-4xl"
        >
          📚
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen ink-bg flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* 戻るリンク */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6"
        >
          <Link
            href="/"
            className="flex items-center gap-2 text-parchment-light/70 hover:text-parchment-light transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm font-body">ホームに戻る</span>
          </Link>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          <Card variant="parchment" className="parchment-card">
            <CardHeader className="text-center">
              <motion.div
                animate={{
                  rotate: [0, 5, -5, 0],
                  scale: [1, 1.05, 1],
                }}
                transition={{
                  duration: 3,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
                className="text-5xl mb-4"
              >
                📚
              </motion.div>
              <CardTitle className="text-2xl text-ink-black">
                MisteryMeshへようこそ
              </CardTitle>
              <CardDescription>
                アカウントでサインインして、謎解きの旅を始めましょう
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
              {/* エラー表示 */}
              {(localError || error) && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center gap-2 p-3 bg-blood-red/10 border border-blood-red/30 rounded-lg text-blood-red text-sm"
                >
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{localError || error?.message}</span>
                </motion.div>
              )}

              {/* Googleサインイン */}
              <Button
                onClick={handleGoogleSignIn}
                disabled={isSigningIn}
                isLoading={isSigningIn}
                variant="seal"
                className="w-full gold-button py-6"
              >
                <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                  <path
                    fill="currentColor"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="currentColor"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                Googleでサインイン
              </Button>

              {/* 区切り線 */}
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-ink-brown/30" />
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="px-2 bg-parchment-texture text-ink-brown/70 font-body">
                    または
                  </span>
                </div>
              </div>

              {/* ゲストプレイ */}
              <Button
                onClick={handleGuestSignIn}
                disabled={isSigningIn}
                variant="outline"
                className="w-full py-6 border-ink-brown/30 text-ink-brown hover:bg-ink-brown/5"
              >
                <User className="w-5 h-5 mr-2" />
                ゲストとしてプレイ
              </Button>

              {/* 注意書き */}
              <p className="text-xs text-ink-brown/60 text-center font-body mt-4">
                ゲストアカウントではプレイ履歴が保存されません。
                <br />
                継続してプレイするにはGoogleアカウントでのサインインをお勧めします。
              </p>
            </CardContent>
          </Card>
        </motion.div>

        {/* バージョン */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="text-center mt-6 text-parchment-light/50 text-xs font-body"
        >
          MisteryMesh v0.1.0 Alpha
        </motion.div>
      </div>
    </div>
  );
}

function SignInLoading() {
  return (
    <div className="min-h-screen ink-bg flex items-center justify-center">
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
        className="text-4xl"
      >
        📚
      </motion.div>
    </div>
  );
}

export default function SignInPage() {
  return (
    <Suspense fallback={<SignInLoading />}>
      <SignInContent />
    </Suspense>
  );
}
