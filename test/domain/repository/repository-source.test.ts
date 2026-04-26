import { describe, expect, it } from "vitest";

import { RepositorySourceError } from "../../../src/domain/repository";
import type { RepositoryReference } from "../../../src/domain/repository";

describe("RepositorySource domain types", () => {
  it("carries repository source failure context", () => {
    const repository: RepositoryReference = {
      provider: "local-fixture",
      name: "missing-fixture",
    };

    const error = new RepositorySourceError(
      "Fixture is unavailable.",
      "repository-not-found",
      repository,
    );

    expect(error).toBeInstanceOf(Error);
    expect(error.code).toBe("repository-not-found");
    expect(error.repository).toBe(repository);
  });
});
