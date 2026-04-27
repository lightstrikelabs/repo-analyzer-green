# `.agents/skills/`

Project-level skills for every agent that runs against this repo (Claude Code, Codex CLI, pi).

Each skill is a directory containing a `SKILL.md` file with YAML frontmatter (`name`, `description`, plus optional fields per the [Agent Skills specification](https://agentskills.io/specification)).

```
.agents/skills/
├── README.md              # this file
└── <skill-name>/
    ├── SKILL.md           # required entry point
    ├── scripts/           # optional helper scripts
    ├── references/        # optional reference docs
    └── assets/            # optional fixtures, templates, images
```

Pi reads this directory natively. Claude Code and Codex reach it via relative symlinks at `.claude/skills` and `.codex/skills` (see [docs/agent-compat.md](../../docs/agent-compat.md)).

Don't add skill content under `.claude/skills/`, `.codex/skills/`, or `.pi/skills/` — those are symlinks pointing here; everything goes under `.agents/skills/<name>/`.

For authoring rules, frontmatter fields, naming validation, and a review checklist, see [docs/skills.md](../../docs/skills.md).
