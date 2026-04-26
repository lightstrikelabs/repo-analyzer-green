import { z } from "zod";

import type { RepositoryReference } from "../../domain/repository/repository-source";

export const GitHubRepositoryUrlSchema = z.url().transform((value, context) => {
  const parsedUrl = new URL(value);

  if (
    parsedUrl.hostname !== "github.com" &&
    parsedUrl.hostname !== "www.github.com"
  ) {
    context.addIssue({
      code: "custom",
      message: "Repository URL must use github.com.",
    });
    return z.NEVER;
  }

  const [owner, rawName] = parsedUrl.pathname.split("/").filter(Boolean);
  if (owner === undefined || rawName === undefined) {
    context.addIssue({
      code: "custom",
      message: "GitHub repository URL must include owner and repository name.",
    });
    return z.NEVER;
  }

  return {
    provider: "github",
    owner,
    name: rawName.replace(/\.git$/u, ""),
    url: `https://github.com/${owner}/${rawName.replace(/\.git$/u, "")}`,
  } satisfies RepositoryReference;
});

export function parseGitHubRepositoryUrl(input: string): RepositoryReference {
  return GitHubRepositoryUrlSchema.parse(input.trim());
}
