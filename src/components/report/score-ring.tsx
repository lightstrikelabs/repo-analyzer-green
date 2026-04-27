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
      className="grid size-28 shrink-0 place-items-center rounded-full"
      style={{
        background:
          score === undefined
            ? "conic-gradient(#d8d2c5 0deg, #e4dfd4 0deg)"
            : `conic-gradient(#146c60 ${Math.round(score * 3.6)}deg, #e4dfd4 0deg)`,
      }}
    >
      <div className="grid size-20 place-items-center rounded-full bg-white text-center">
        <div>
          <p className="text-2xl font-semibold leading-none tracking-normal text-[#111111]">
            {scoreLabel}
          </p>
          <p className="mt-1 text-xs font-semibold uppercase text-[#146c60]">
            {grade}
          </p>
        </div>
      </div>
    </div>
  );
}
