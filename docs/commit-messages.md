# Commit Messages

Use Conventional Commits for every commit subject and PR title. Squash merges should keep the PR title as the final commit subject.

## Subject Format

```text
<type>(optional-scope): <imperative summary>
```

Accepted types:
- `feat`
- `fix`
- `docs`
- `test`
- `refactor`
- `perf`
- `build`
- `ci`
- `chore`
- `revert`

Scopes are optional but encouraged when they add useful context. Prefer stable domain and tooling scopes such as `domain`, `evidence`, `reviewer`, `scoring`, `report`, `chat`, `ui`, `ci`, `docs`, and `type-safety`.

Subject rules:
- Keep the subject to 72 characters or fewer
- Use imperative mood
- Do not end the subject with a period
- Avoid vague summaries such as `fix`, `changes`, `update`, `stuff`, or `wip`

## Commit Body

Non-trivial commits should include a body. When committing from the command line, use a second `-m`:

```bash
git commit -m "feat(chat): model targeted follow-up conversations" \
  -m "Add conversation targets for report dimensions, findings, caveats, and evidence items. This keeps chat context explicit before persistence and auth are introduced."
```

The body should explain:
- Why the change exists
- Important tradeoffs or constraints
- Test, migration, or rollout implications when relevant

Do not repeat the subject in the body.

## Examples

Acceptable:

```text
feat(chat): model targeted follow-up conversations
fix(report): preserve evidence citations
docs(architecture): define enforcement model
test(type-safety): guard unsafe type escapes
ci(github): validate pull request titles
```

Unacceptable:

```text
update stuff
fix
changes
style(ui): adjust page
docs: define commit standards.
feat(BadScope): add thing
```

## Enforcement

Local validation:

```bash
pnpm run commit-message:check -- --message "feat(chat): model conversations"
pnpm run commit-message:check -- --file .git/COMMIT_EDITMSG
```

Lefthook runs the same validator in the `commit-msg` hook.

CI validates PR titles with the same script so squash-merge titles follow the same standard.
