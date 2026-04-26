import { describe, expect, it } from "vitest";

import { repositoryFixtures } from "../support/fixtures";

describe("repository fixture calibration", () => {
  it("covers multiple languages and archetypes without collapsing into one bucket", () => {
    const fixtures = Object.values(repositoryFixtures);
    const languages = new Set(fixtures.flatMap((fixture) => fixture.languages));
    const archetypes = new Set(fixtures.map((fixture) => fixture.archetype));
    const archetypeCounts = fixtures.reduce<Record<string, number>>(
      (accumulator, fixture) => {
        accumulator[fixture.archetype] =
          (accumulator[fixture.archetype] ?? 0) + 1;
        return accumulator;
      },
      {},
    );
    const largestArchetypeBucket = Math.max(...Object.values(archetypeCounts));

    expect(fixtures).toHaveLength(4);
    expect(languages).toEqual(
      new Set(["Go", "Markdown", "TypeScript", "YAML"]),
    );
    expect(languages.size).toBeGreaterThanOrEqual(3);
    expect(archetypes.size).toBeGreaterThanOrEqual(4);
    expect(largestArchetypeBucket).toBeLessThan(fixtures.length);
  });
});
