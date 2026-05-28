export function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) return <span className="text-xl" aria-label="rank 1">🥇</span>;
  if (rank === 2) return <span className="text-xl" aria-label="rank 2">🥈</span>;
  if (rank === 3) return <span className="text-xl" aria-label="rank 3">🥉</span>;
  return <span className="text-sm font-bold text-slate-500">#{rank}</span>;
}
