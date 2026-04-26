export function ScoreRing({
  score,
  grade,
}: {
  readonly score: number | undefined;
  readonly grade: string;
}) {
  const scoreLabel = score === undefined ? "N/A" : String(score);
  const ariaLabel =
    score === undefined
      ? "Score not assessed"
      : `Score ${score}, grade ${grade}`;

  return (
    <div
      role="img"
      aria-label={ariaLabel}
      className="grid size-28 shrink-0 place-items-center rounded-full border border-slate-200 bg-white"
      style={{
        background:
          score === undefined
            ? "conic-gradient(#cbd5e1 0deg, #e2e8f0 0deg)"
            : `conic-gradient(#047857 ${Math.round(score * 3.6)}deg, #e2e8f0 0deg)`,
      }}
    >
      <div className="grid size-20 place-items-center rounded-full bg-white text-center">
        <div>
          <p className="text-2xl font-semibold leading-none text-slate-950">
            {scoreLabel}
          </p>
          <p className="mt-1 text-xs font-semibold uppercase text-slate-600">
            {grade}
          </p>
        </div>
      </div>
    </div>
  );
}
