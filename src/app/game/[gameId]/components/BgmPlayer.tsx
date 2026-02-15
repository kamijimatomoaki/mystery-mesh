"use client";

/**
 * BGM Player
 * BGMプレイヤー（プリセット音源DJ方式）
 */

import { motion, AnimatePresence } from "framer-motion";
import { X, Play, Pause, Volume2, VolumeX, Music } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components";

// BGMプリセット（モック）
interface BgmTrack {
  id: string;
  name: string;
  category: "exploration" | "discussion" | "tension" | "resolution";
  url: string; // 実際の音源URL（今はモック）
  duration: number; // 秒
}

const BGM_TRACKS: BgmTrack[] = [
  {
    id: "dark-library",
    name: "Dark Library",
    category: "exploration",
    url: "/bgm/dark-library.mp3", // モック
    duration: 180,
  },
  {
    id: "misty-corridor",
    name: "Misty Corridor",
    category: "exploration",
    url: "/bgm/misty-corridor.mp3",
    duration: 200,
  },
  {
    id: "rational-debate",
    name: "Rational Debate",
    category: "discussion",
    url: "/bgm/rational-debate.mp3",
    duration: 220,
  },
  {
    id: "heated-discussion",
    name: "Heated Discussion",
    category: "discussion",
    url: "/bgm/heated-discussion.mp3",
    duration: 190,
  },
  {
    id: "ticking-time",
    name: "Ticking Time",
    category: "tension",
    url: "/bgm/ticking-time.mp3",
    duration: 150,
  },
  {
    id: "final-accusation",
    name: "Final Accusation",
    category: "tension",
    url: "/bgm/final-accusation.mp3",
    duration: 160,
  },
  {
    id: "truth-revealed",
    name: "Truth Revealed",
    category: "resolution",
    url: "/bgm/truth-revealed.mp3",
    duration: 210,
  },
];

const CATEGORY_LABELS = {
  exploration: "探索",
  discussion: "議論",
  tension: "緊張",
  resolution: "解決",
} as const;

interface BgmPlayerProps {
  isOpen: boolean;
  onClose: () => void;
  defaultTrackId?: string;
}

export function BgmPlayer({ isOpen, onClose, defaultTrackId }: BgmPlayerProps) {
  const [currentTrack, setCurrentTrack] = useState<BgmTrack | null>(
    BGM_TRACKS.find((t) => t.id === defaultTrackId) || BGM_TRACKS[0]
  );
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(0.5);
  const [isMuted, setIsMuted] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // オーディオ要素の初期化（実際の音源があれば再生）
  useEffect(() => {
    if (currentTrack && audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : volume;
      // TODO: 実際の音源がある場合のみ再生
      // audioRef.current.play();
    }
  }, [currentTrack, volume, isMuted]);

  const handlePlayPause = () => {
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
    } else {
      // audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleTrackSelect = (track: BgmTrack) => {
    setCurrentTrack(track);
    setIsPlaying(true);
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
    if (audioRef.current) {
      audioRef.current.volume = newVolume;
    }
  };

  const handleMuteToggle = () => {
    setIsMuted(!isMuted);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ type: "spring", damping: 25, stiffness: 200 }}
        className="fixed right-0 top-16 bottom-0 z-40 w-80 border-l border-paper/20 bg-ink/95 backdrop-blur-md overflow-y-auto"
      >
        <div className="p-6 space-y-6">
          {/* ヘッダー */}
          <div className="flex items-center justify-between">
            <h2 className="font-serif text-xl font-bold text-paper flex items-center gap-2">
              <Music className="h-5 w-5 text-accent-gold" />
              BGM プレイヤー
            </h2>
            <button
              onClick={onClose}
              className="rounded p-2 text-paper/70 transition-colors hover:bg-paper/10 hover:text-paper"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* 現在再生中 */}
          {currentTrack && (
            <div className="rounded-lg border-2 border-accent-gold/30 bg-accent-gold/10 p-4 space-y-3">
              <p className="text-xs text-paper/70">現在再生中</p>
              <div>
                <p className="font-serif text-lg font-semibold text-paper">
                  {currentTrack.name}
                </p>
                <Badge variant="outline" size="sm" className="mt-1">
                  {CATEGORY_LABELS[currentTrack.category]}
                </Badge>
              </div>

              {/* コントロール */}
              <div className="flex items-center gap-3">
                <button
                  onClick={handlePlayPause}
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-accent-gold text-ink transition-all hover:scale-110"
                >
                  {isPlaying ? (
                    <Pause className="h-5 w-5" />
                  ) : (
                    <Play className="h-5 w-5" />
                  )}
                </button>

                <div className="flex-1 flex items-center gap-2">
                  <button onClick={handleMuteToggle} className="text-paper/70 hover:text-paper">
                    {isMuted ? (
                      <VolumeX className="h-4 w-4" />
                    ) : (
                      <Volume2 className="h-4 w-4" />
                    )}
                  </button>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={isMuted ? 0 : volume}
                    onChange={handleVolumeChange}
                    className="flex-1 h-1 bg-paper/20 rounded-lg appearance-none cursor-pointer"
                  />
                  <span className="text-xs text-paper/70 w-8 text-right">
                    {Math.round((isMuted ? 0 : volume) * 100)}%
                  </span>
                </div>
              </div>

              <p className="text-xs text-paper/50 text-center">
                💡 音源はモックです。実際の環境では音楽が再生されます
              </p>
            </div>
          )}

          {/* プレイリスト */}
          <div className="space-y-3">
            <h3 className="font-serif text-sm font-semibold text-paper">
              プレイリスト
            </h3>

            {Object.entries(CATEGORY_LABELS).map(([category, label]) => {
              const tracks = BGM_TRACKS.filter((t) => t.category === category);
              if (tracks.length === 0) return null;

              return (
                <div key={category} className="space-y-2">
                  <p className="text-xs font-semibold text-paper/60">{label}</p>
                  {tracks.map((track) => (
                    <button
                      key={track.id}
                      onClick={() => handleTrackSelect(track)}
                      className={cn(
                        "w-full rounded-lg border-2 p-3 text-left transition-all",
                        currentTrack?.id === track.id
                          ? "border-accent-gold bg-accent-gold/20"
                          : "border-paper/20 bg-paper/5 hover:border-accent-gold/50 hover:bg-paper/10"
                      )}
                    >
                      <p className="text-sm font-semibold text-paper">
                        {track.name}
                      </p>
                      <p className="text-xs text-paper/60 mt-1">
                        {Math.floor(track.duration / 60)}:{String(track.duration % 60).padStart(2, "0")}
                      </p>
                    </button>
                  ))}
                </div>
              );
            })}
          </div>
        </div>

        {/* Hidden audio element */}
        <audio ref={audioRef} loop />
      </motion.div>
    </AnimatePresence>
  );
}
