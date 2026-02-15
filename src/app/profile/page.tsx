/**
 * Profile Page
 * ユーザープロフィールページ
 */

"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { useAuth } from "@/lib/hooks/useAuth";
import { Avatar } from "@/components/atoms/Avatar";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  Button,
  Input,
  Badge,
} from "@/components";
import { Navbar } from "@/components/organisms/Navbar";
import {
  ArrowLeft,
  Edit2,
  Save,
  Trophy,
  Clock,
  Target,
  Star,
  LogOut,
  Shield,
  Mail,
} from "lucide-react";

// ダミーの統計データ（将来的にはFirestoreから取得）
const mockStats = {
  gamesPlayed: 12,
  gamesWon: 5,
  totalPlayTime: 480, // 分
  averageScore: 78,
  favoriteGenre: "クラシック推理",
  achievements: [
    { id: "first_win", name: "初勝利", description: "初めてゲームに勝利した", icon: "🏆" },
    { id: "detective", name: "名探偵", description: "3回連続で犯人を当てた", icon: "🔍" },
    { id: "social", name: "社交家", description: "10回以上ゲームをプレイした", icon: "🎭" },
  ],
  recentGames: [
    { id: "game_001", title: "黄昏の洋館", result: "勝利", date: "2025-01-15" },
    { id: "game_002", title: "学園ミステリー", result: "敗北", date: "2025-01-14" },
    { id: "game_003", title: "サイバー事件簿", result: "勝利", date: "2025-01-12" },
  ],
};

export default function ProfilePage() {
  const router = useRouter();
  const { user, isAuthenticated, isAnonymous, displayName, signOut, loading } = useAuth();

  const [isEditing, setIsEditing] = useState(false);
  const [editedName, setEditedName] = useState(displayName || "");

  // 未認証ならサインインページへ
  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push("/auth/signin?redirect=/profile");
    }
  }, [loading, isAuthenticated, router]);

  useEffect(() => {
    setEditedName(displayName || "");
  }, [displayName]);

  const handleSave = async () => {
    // TODO: Firestoreにプロフィールを保存
    console.log("Saving profile:", editedName);
    setIsEditing(false);
  };

  const handleSignOut = async () => {
    await signOut();
    router.push("/");
  };

  if (loading || !isAuthenticated) {
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
    <main className="min-h-screen ink-bg">
      <Navbar />

      <div className="pt-24 pb-12 px-4">
        <div className="max-w-4xl mx-auto">
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

          {/* プロフィールヘッダー */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Card variant="parchment" className="parchment-card mb-6">
              <CardContent className="py-8">
                <div className="flex flex-col md:flex-row items-center gap-6">
                  {/* アバター */}
                  <Avatar
                    src={user?.photoURL}
                    alt={displayName || "User"}
                    size="xl"
                    isOnline={true}
                  />

                  {/* 基本情報 */}
                  <div className="flex-1 text-center md:text-left">
                    {isEditing ? (
                      <div className="flex items-center gap-2 justify-center md:justify-start">
                        <Input
                          value={editedName}
                          onChange={(e) => setEditedName(e.target.value)}
                          className="max-w-xs"
                          placeholder="表示名を入力"
                        />
                        <Button variant="seal" size="sm" onClick={handleSave}>
                          <Save className="w-4 h-4" />
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 justify-center md:justify-start">
                        <h1 className="text-3xl font-title font-bold text-ink-black">
                          {displayName || "名無しの探偵"}
                        </h1>
                        <button
                          onClick={() => setIsEditing(true)}
                          className="p-1.5 rounded-lg hover:bg-ink-brown/10 transition-colors"
                        >
                          <Edit2 className="w-4 h-4 text-ink-brown/60" />
                        </button>
                      </div>
                    )}

                    <div className="flex flex-wrap items-center gap-2 mt-2 justify-center md:justify-start">
                      {isAnonymous ? (
                        <Badge variant="secondary" className="bg-ink-brown/20 text-ink-brown">
                          <Shield className="w-3 h-3 mr-1" />
                          ゲストアカウント
                        </Badge>
                      ) : (
                        <Badge variant="primary" className="bg-gold-accent/20 text-gold-accent border-gold-accent/50">
                          <Mail className="w-3 h-3 mr-1" />
                          {user?.email}
                        </Badge>
                      )}
                    </div>

                    {isAnonymous && (
                      <p className="text-sm text-ink-brown/70 mt-3 font-body">
                        ゲストアカウントではプレイ履歴が保存されません。
                        <Link href="/auth/signin" className="text-gold-accent hover:underline ml-1">
                          Googleでサインイン
                        </Link>
                        してデータを保存しましょう。
                      </p>
                    )}
                  </div>

                  {/* サインアウトボタン */}
                  <Button
                    variant="outline"
                    onClick={handleSignOut}
                    className="border-blood-red/50 text-blood-red hover:bg-blood-red/10"
                  >
                    <LogOut className="w-4 h-4 mr-2" />
                    サインアウト
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* 統計カード */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6"
          >
            <Card variant="dark" className="book-card">
              <CardContent className="py-6 text-center">
                <Trophy className="w-8 h-8 text-gold-accent mx-auto mb-2" />
                <p className="text-2xl font-title font-bold text-parchment-light">
                  {mockStats.gamesWon}
                </p>
                <p className="text-xs text-parchment-light/60 font-body">勝利数</p>
              </CardContent>
            </Card>

            <Card variant="dark" className="book-card">
              <CardContent className="py-6 text-center">
                <Target className="w-8 h-8 text-emerald-accent mx-auto mb-2" />
                <p className="text-2xl font-title font-bold text-parchment-light">
                  {mockStats.gamesPlayed}
                </p>
                <p className="text-xs text-parchment-light/60 font-body">プレイ回数</p>
              </CardContent>
            </Card>

            <Card variant="dark" className="book-card">
              <CardContent className="py-6 text-center">
                <Clock className="w-8 h-8 text-blue-400 mx-auto mb-2" />
                <p className="text-2xl font-title font-bold text-parchment-light">
                  {Math.floor(mockStats.totalPlayTime / 60)}h
                </p>
                <p className="text-xs text-parchment-light/60 font-body">総プレイ時間</p>
              </CardContent>
            </Card>

            <Card variant="dark" className="book-card">
              <CardContent className="py-6 text-center">
                <Star className="w-8 h-8 text-amber-accent mx-auto mb-2" />
                <p className="text-2xl font-title font-bold text-parchment-light">
                  {mockStats.averageScore}%
                </p>
                <p className="text-xs text-parchment-light/60 font-body">平均スコア</p>
              </CardContent>
            </Card>
          </motion.div>

          <div className="grid md:grid-cols-2 gap-6">
            {/* 実績 */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <Card variant="parchment" className="parchment-card h-full">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-ink-black">
                    <Trophy className="w-5 h-5 text-gold-accent" />
                    獲得した称号
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {mockStats.achievements.map((achievement) => (
                    <motion.div
                      key={achievement.id}
                      whileHover={{ scale: 1.02 }}
                      className="flex items-center gap-3 p-3 rounded-lg bg-gold-accent/10 border border-gold-accent/30"
                    >
                      <span className="text-2xl">{achievement.icon}</span>
                      <div>
                        <p className="font-title font-semibold text-ink-black">
                          {achievement.name}
                        </p>
                        <p className="text-xs text-ink-brown/70 font-body">
                          {achievement.description}
                        </p>
                      </div>
                    </motion.div>
                  ))}
                </CardContent>
              </Card>
            </motion.div>

            {/* 最近のゲーム */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              <Card variant="dark" className="book-card h-full">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-parchment-light">
                    <Clock className="w-5 h-5 text-gold-accent" />
                    最近のプレイ履歴
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {mockStats.recentGames.map((game, index) => (
                    <motion.div
                      key={game.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.1 }}
                      className="flex items-center justify-between p-3 rounded-lg bg-parchment-light/5 border border-parchment-light/10"
                    >
                      <div>
                        <p className="font-title font-semibold text-parchment-light">
                          {game.title}
                        </p>
                        <p className="text-xs text-parchment-light/60 font-body">
                          {game.date}
                        </p>
                      </div>
                      <Badge
                        variant={game.result === "勝利" ? "success" : "secondary"}
                        className={
                          game.result === "勝利"
                            ? "bg-emerald-accent/20 text-emerald-accent border-emerald-accent/50"
                            : "bg-parchment-light/10 text-parchment-light/60"
                        }
                      >
                        {game.result}
                      </Badge>
                    </motion.div>
                  ))}

                  <Link
                    href="/library"
                    className="block text-center text-sm text-gold-accent hover:text-gold-accent/80 transition-colors font-body mt-4"
                  >
                    新しいシナリオをプレイする →
                  </Link>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </div>
      </div>
    </main>
  );
}
