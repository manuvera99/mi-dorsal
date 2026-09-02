"use client";

import { useState, useEffect } from "react";
import { useUser } from "@clerk/nextjs";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { ThumbsUp, ThumbsDown, LogIn } from "lucide-react";
import Link from "next/link";
import { isMockMode } from "@/lib/mock/provider";

interface ThumbsVoteProps {
  raceId: string;
  size?: "sm" | "md" | "lg";
  layout?: "inline" | "stacked" | "compact";
  showLoginPrompt?: boolean;
}

interface VoteState {
  ups: number;
  downs: number;
  net: number;
}

function MockThumbsVote({ raceId, size = "md", layout = "inline", showLoginPrompt = true }: ThumbsVoteProps) {
  // Estado en localStorage para simular persistencia del voto
  const STORAGE_KEY = `mock-vote-${raceId}`;
  const COUNTS_KEY = `mock-vote-counts-${raceId}`;

  // Conteos base (curados por carrera) — da sensación de comunidad activa
  const BASE_COUNTS: Record<string, VoteState> = {
    r1: { ups: 1247, downs: 18, net: 1229 },
    r2: { ups: 234, downs: 8, net: 226 },
    r3: { ups: 2891, downs: 64, net: 2827 },
    r4: { ups: 467, downs: 15, net: 452 },
    r5: { ups: 891, downs: 22, net: 869 },
    r6: { ups: 312, downs: 28, net: 284 },
    r7: { ups: 178, downs: 6, net: 172 },
    r8: { ups: 5621, downs: 89, net: 5532 },
    r9: { ups: 145, downs: 4, net: 141 },
    r10: { ups: 198, downs: 7, net: 191 },
    r11: { ups: 287, downs: 11, net: 276 },
    r12: { ups: 89, downs: 3, net: 86 },
  };

  const [myVote, setMyVote] = useState<"up" | "down" | null>(null);
  const [counts, setCounts] = useState<VoteState>(
    BASE_COUNTS[raceId] ?? { ups: 0, downs: 0, net: 0 },
  );
  const [isLoggedIn, setIsLoggedIn] = useState(false); // En mock, simulamos no logueado al inicio

  // Cargar del localStorage
  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "up" || stored === "down") setMyVote(stored);

    const storedCounts = localStorage.getItem(COUNTS_KEY);
    if (storedCounts) {
      try {
        setCounts(JSON.parse(storedCounts));
      } catch {}
    }
  }, [STORAGE_KEY, COUNTS_KEY]);

  const persist = (newVote: "up" | "down" | null, newCounts: VoteState) => {
    setMyVote(newVote);
    setCounts(newCounts);
    if (typeof window !== "undefined") {
      if (newVote) localStorage.setItem(STORAGE_KEY, newVote);
      else localStorage.removeItem(STORAGE_KEY);
      localStorage.setItem(COUNTS_KEY, JSON.stringify(newCounts));
    }
  };

  const handleVote = (newVote: "up" | "down") => {
    if (!isLoggedIn) return;
    const wasSame = myVote === newVote;
    const otherVote = newVote === "up" ? "down" : "up";

    let newCounts = { ...counts };
    if (myVote) {
      // Quitamos el voto anterior
      newCounts[myVote === "up" ? "ups" : "downs"]--;
    }
    if (wasSame) {
      // Toggle off
      persist(null, { ...newCounts, net: newCounts.ups - newCounts.downs });
    } else {
      // Si había voto contrario, lo cambiamos
      if (myVote === otherVote) {
        // No hace falta restar de "otherVote" porque ya restamos del actual
      }
      newCounts[newVote === "up" ? "ups" : "downs"]++;
      persist(newVote, { ...newCounts, net: newCounts.ups - newCounts.downs });
    }
  };

  const sizes = {
    sm: { btn: "h-8 px-2 text-xs", icon: "h-3.5 w-3.5", count: "text-xs" },
    md: { btn: "h-10 px-3 text-sm", icon: "h-4 w-4", count: "text-sm" },
    lg: { btn: "h-12 px-5 text-base", icon: "h-5 w-5", count: "text-base font-semibold" },
  };
  const s = sizes[size];

  const layoutClass = {
    inline: "flex items-center gap-2",
    stacked: "flex flex-col gap-2",
    compact: "flex items-center gap-1 text-xs",
  }[layout];

  return (
    <div className={layoutClass}>
      {/* Login toggle para demo (solo visible en mock) */}
      {showLoginPrompt && !isLoggedIn && (
        <button
          onClick={() => setIsLoggedIn(true)}
          className="text-xs text-gray-500 hover:text-runner-primary underline mr-2"
          title="En producción, Clerk manejaría el login"
        >
          <LogIn className="h-3 w-3 inline mr-0.5" />
          Login (demo)
        </button>
      )}
      {showLoginPrompt && isLoggedIn && (
        <button
          onClick={() => { setIsLoggedIn(false); persist(null, BASE_COUNTS[raceId] ?? { ups: 0, downs: 0, net: 0 }); }}
          className="text-xs text-gray-500 hover:text-red-500 underline mr-2"
        >
          Logout (demo)
        </button>
      )}

      <button
        onClick={() => handleVote("up")}
        disabled={!isLoggedIn}
        title={isLoggedIn ? (myVote === "up" ? "Quitar voto" : "Recomendar") : "Inicia sesión para votar"}
        className={`flex items-center gap-1.5 ${s.btn} rounded-md font-medium border transition-all ${
          myVote === "up"
            ? "bg-green-500 text-white border-green-500 shadow-md"
            : isLoggedIn
            ? "border-gray-300 bg-white text-gray-700 hover:border-green-500 hover:text-green-700"
            : "border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed"
        }`}
      >
        <ThumbsUp className={s.icon} />
        <span className={s.count}>{counts.ups}</span>
      </button>
      <button
        onClick={() => handleVote("down")}
        disabled={!isLoggedIn}
        title={isLoggedIn ? (myVote === "down" ? "Quitar voto" : "No recomendar") : "Inicia sesión para votar"}
        className={`flex items-center gap-1.5 ${s.btn} rounded-md font-medium border transition-all ${
          myVote === "down"
            ? "bg-red-500 text-white border-red-500 shadow-md"
            : isLoggedIn
            ? "border-gray-300 bg-white text-gray-700 hover:border-red-500 hover:text-red-700"
            : "border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed"
        }`}
      >
        <ThumbsDown className={s.icon} />
        <span className={s.count}>{counts.downs}</span>
      </button>
    </div>
  );
}

function RealThumbsVote({ raceId, size = "md", layout = "inline", showLoginPrompt = true }: ThumbsVoteProps) {
  const { isSignedIn, isLoaded } = useUser();
  const summary = useQuery(api.votes.summary, { raceId });
  const myVote = useQuery(api.votes.myVote, { raceId });
  const voteMutation = useMutation(api.votes.vote);
  const unvoteMutation = useMutation(api.votes.unvote);

  const ups = summary?.ups ?? 0;
  const downs = summary?.downs ?? 0;
  const currentVote = myVote ?? null;

  const handleVote = async (newVote: "up" | "down") => {
    if (!isSignedIn) return;
    if (currentVote === newVote) {
      // Toggle off
      await unvoteMutation({ raceId: raceId as any });
    } else {
      await voteMutation({ raceId: raceId as any, vote: newVote });
    }
  };

  const sizes = {
    sm: { btn: "h-8 px-2 text-xs", icon: "h-3.5 w-3.5", count: "text-xs" },
    md: { btn: "h-10 px-3 text-sm", icon: "h-4 w-4", count: "text-sm" },
    lg: { btn: "h-12 px-5 text-base", icon: "h-5 w-5", count: "text-base font-semibold" },
  };
  const s = sizes[size];

  const layoutClass = {
    inline: "flex items-center gap-2",
    stacked: "flex flex-col gap-2",
    compact: "flex items-center gap-1 text-xs",
  }[layout];

  if (!isLoaded) {
    return <div className={layoutClass}>
      <div className={`${s.btn} bg-gray-100 rounded-md animate-pulse w-16`} />
      <div className={`${s.btn} bg-gray-100 rounded-md animate-pulse w-16`} />
    </div>;
  }

  return (
    <div className={layoutClass}>
      {!isSignedIn && showLoginPrompt && (
        <Link
          href="/sign-in"
          className="text-xs text-gray-500 hover:text-runner-primary underline mr-2 flex items-center gap-1"
        >
          <LogIn className="h-3 w-3" />
          Inicia sesión para votar
        </Link>
      )}

      <button
        onClick={() => handleVote("up")}
        disabled={!isSignedIn}
        title={
          !isSignedIn
            ? "Inicia sesión para votar"
            : currentVote === "up"
            ? "Quitar voto"
            : "Recomendar esta carrera"
        }
        className={`flex items-center gap-1.5 ${s.btn} rounded-md font-medium border transition-all ${
          currentVote === "up"
            ? "bg-green-500 text-white border-green-500 shadow-md"
            : isSignedIn
            ? "border-gray-300 bg-white text-gray-700 hover:border-green-500 hover:text-green-700"
            : "border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed"
        }`}
      >
        <ThumbsUp className={s.icon} />
        <span className={s.count}>{ups}</span>
      </button>
      <button
        onClick={() => handleVote("down")}
        disabled={!isSignedIn}
        title={
          !isSignedIn
            ? "Inicia sesión para votar"
            : currentVote === "down"
            ? "Quitar voto"
            : "No recomendar"
        }
        className={`flex items-center gap-1.5 ${s.btn} rounded-md font-medium border transition-all ${
          currentVote === "down"
            ? "bg-red-500 text-white border-red-500 shadow-md"
            : isSignedIn
            ? "border-gray-300 bg-white text-gray-700 hover:border-red-500 hover:text-red-700"
            : "border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed"
        }`}
      >
        <ThumbsDown className={s.icon} />
        <span className={s.count}>{downs}</span>
      </button>
    </div>
  );
}

export function ThumbsVote(props: ThumbsVoteProps) {
  return isMockMode() ? <MockThumbsVote {...props} /> : <RealThumbsVote {...props} />;
}
