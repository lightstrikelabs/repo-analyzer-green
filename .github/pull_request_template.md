## Linked Issue

Closes #<issue-number>

## Before Any Code Checklist

Confirm each of the five chat-visible artifacts from the AGENTS.md `## Before Any Code` section was produced during the session that wrote this PR. If any are missing, explain why.

- [ ] Linked issue (above)
- [ ] Branch (not `main`)
- [ ] Preflight output (or manual fork-day verification per `docs/setup.md`)
- [ ] Failing test (RED) observed before any non-test edit
- [ ] Architecture/plan check against `docs/architecture.md` and `docs/development-plan.md`

## Scope

What coherent slice does this PR complete?

## Non-Goals

What is intentionally out of scope?

## Test Evidence

- [ ] Lint
- [ ] Format check
- [ ] Typecheck
- [ ] Unit/application tests
- [ ] Build
- [ ] Foundational E2E, if relevant

Commands run:

```text

```

## Architecture And Docs

- [ ] This follows `docs/architecture.md`
- [ ] Architecture docs were updated, if architecture changed
- [ ] Development plan was updated, if planning or milestones changed
- [ ] No domain/application/infrastructure boundary violations were introduced

## Type Safety

- [ ] Runtime data is parsed or narrowed instead of cast
- [ ] No `as any`, `: any`, `<any>`, or `as unknown as` was introduced
- [ ] Any unavoidable type escape uses a documented `type-escape:` marker

## Risk And Rollback

What can go wrong, and how can this be rolled back?

## Dependencies

List new dependencies and explain why each is needed.
