import { mkdir, mkdtemp, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  RepositorySourceError,
  type RepositoryReference,
} from "../../../src/domain/repository/repository-source";
import {
  archiveUrlForRepository,
  GitHubArchiveRepositorySource,
  type GitHubArchiveExtractor,
  type GitHubArchiveFetcher,
} from "../../../src/infrastructure/github/github-archive-repository-source";
import { parseGitHubRepositoryUrl } from "../../../src/infrastructure/github/github-repository-url";

const repository: RepositoryReference = {
  provider: "github",
  owner: "lightstrikelabs",
  name: "repo-analyzer-green",
  url: "https://github.com/lightstrikelabs/repo-analyzer-green",
  revision: "main",
};

describe("parseGitHubRepositoryUrl", () => {
  it("parses GitHub repository URLs into repository references", () => {
    expect(
      parseGitHubRepositoryUrl(
        "https://github.com/lightstrikelabs/repo-analyzer-green.git",
      ),
    ).toEqual({
      provider: "github",
      owner: "lightstrikelabs",
      name: "repo-analyzer-green",
      url: "https://github.com/lightstrikelabs/repo-analyzer-green",
    });
  });

  it("rejects non-GitHub repository URLs", () => {
    expect(() =>
      parseGitHubRepositoryUrl("https://example.com/lightstrikelabs/repo"),
    ).toThrow();
  });
});

describe("GitHubArchiveRepositorySource", () => {
  it("downloads and exposes archive files through the repository source port", async () => {
    const temporaryRoot = await mkdtemp(
      path.join(tmpdir(), "repo-analyzer-green-github-test-"),
    );
    const requestedUrls: string[] = [];
    const fetcher: GitHubArchiveFetcher = async (url) => {
      requestedUrls.push(url);
      return new Response(new Uint8Array([1, 2, 3]), { status: 200 });
    };
    const extractor: GitHubArchiveExtractor = async ({ destinationPath }) => {
      await mkdir(path.join(destinationPath, "src"), { recursive: true });
      await writeFile(path.join(destinationPath, "README.md"), "# Green\n");
      await writeFile(
        path.join(destinationPath, "src", "add.ts"),
        "export const add = (left: number, right: number) => left + right;\n",
      );
    };
    const source = new GitHubArchiveRepositorySource({
      fetcher,
      extractor,
      temporaryRoot,
    });

    const files = await source.listFiles(repository);
    const file = await source.readFile(repository, "src/add.ts");

    expect(requestedUrls).toEqual([archiveUrlForRepository(repository)]);
    expect(files.map((entry) => entry.path)).toEqual([
      "README.md",
      "src/add.ts",
    ]);
    expect(file.text).toContain("export const add");
    expect(file.provenance).toMatchObject({
      repository,
      sourceKind: "github-archive",
      path: "src/add.ts",
    });
  });

  it("fails with typed context when GitHub archive download fails", async () => {
    const source = new GitHubArchiveRepositorySource({
      fetcher: async () => new Response("not found", { status: 404 }),
      extractor: async () => undefined,
      temporaryRoot: await mkdtemp(
        path.join(tmpdir(), "repo-analyzer-green-github-test-"),
      ),
    });

    await expect(source.listFiles(repository)).rejects.toMatchObject({
      code: "download-failed",
      repository,
    });
  });

  it("fails with typed context when archive extraction fails", async () => {
    const source = new GitHubArchiveRepositorySource({
      fetcher: async () => new Response(new Uint8Array([1]), { status: 200 }),
      extractor: async () => {
        throw new Error("bad archive");
      },
      temporaryRoot: await mkdtemp(
        path.join(tmpdir(), "repo-analyzer-green-github-test-"),
      ),
    });

    await expect(source.listFiles(repository)).rejects.toMatchObject({
      code: "extraction-failed",
      repository,
    });
  });

  it("does not allow reads outside the extracted repository root", async () => {
    const source = new GitHubArchiveRepositorySource({
      fetcher: async () => new Response(new Uint8Array([1]), { status: 200 }),
      extractor: async ({ destinationPath }) => {
        await writeFile(path.join(destinationPath, "README.md"), "# Green\n");
      },
      temporaryRoot: await mkdtemp(
        path.join(tmpdir(), "repo-analyzer-green-github-test-"),
      ),
    });

    await expect(
      source.readFile(repository, "../README.md"),
    ).rejects.toBeInstanceOf(RepositorySourceError);
    await expect(
      source.readFile(repository, "../README.md"),
    ).rejects.toMatchObject({
      code: "file-not-found",
      repository,
    });
  });

  it("cleans up owned temporary repository archives on dispose", async () => {
    let extractedRoot = "";
    const source = new GitHubArchiveRepositorySource({
      fetcher: async () => new Response(new Uint8Array([1]), { status: 200 }),
      extractor: async ({ destinationPath }) => {
        extractedRoot = destinationPath;
        await writeFile(path.join(destinationPath, "README.md"), "# Green\n");
      },
    });
    const files = await source.listFiles(repository);

    expect(files[0]?.path).toBe("README.md");
    await expect(stat(extractedRoot)).resolves.toMatchObject({
      isDirectory: expect.any(Function),
    });
    await source.dispose();
    await expect(stat(extractedRoot)).rejects.toThrow();
  });
});
