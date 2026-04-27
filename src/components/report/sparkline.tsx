export type SparklinePoint = {
  readonly label: "Score" | "Confidence" | "Evidence" | "Risk";
  readonly value: number;
};

export function Sparkline({
  points,
}: {
  readonly points: readonly SparklinePoint[];
}) {
  if (points.length === 0) {
    return (
      <div className="grid h-16 place-items-center border border-dashed border-[#d8d2c5] text-xs font-medium text-[#7b7468]">
        No chart data
      </div>
    );
  }

  const polylinePoints = points
    .map((point, index) => {
      const x = points.length === 1 ? 50 : (index / (points.length - 1)) * 100;
      const y = 100 - clamp(point.value);
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <figure className="space-y-2">
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        className="h-16 w-full overflow-visible"
        role="img"
        aria-label="Section signal trend"
      >
        <title>Section signal trend</title>
        <path d="M 1 98 H 99" stroke="#e4dfd4" strokeWidth="1" />
        <polyline
          points={polylinePoints}
          fill="none"
          stroke="#d97706"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="5"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <figcaption className="sr-only">
        <ul>
          {points.map((point) => (
            <li key={point.label}>
              {point.label} {point.value}
            </li>
          ))}
        </ul>
      </figcaption>
    </figure>
  );
}

function clamp(value: number): number {
  return Math.min(100, Math.max(0, value));
}
