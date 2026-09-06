# ab-results/real

One `tokenbrake report` per real session on this repository, written by the session itself just before it ends (the rule is in `CLAUDE.md`, "Before a session ends"). File name: `<YYYY-MM-DD>-<session prefix>.txt`, where the prefix is the eight characters the report prints on its first line.

These are not the A/B arms. `ab-results/debug-*.txt` and the audit runs (see `AB-TASK.md` in `33kain/tokenbrake`) were controlled: one task, one message, hooks off against hooks on. The files here are the uncontrolled counterpart: ordinary working sessions on this repository, with the hooks on, doing whatever the day needed. They answer the question the A/B could not, which is how far a real session sits between the 0% (debugging, the model bounded its own output) and the 37% (read-heavy audit) that the A/B measured.

What to read off each file, and what the table over all of them will hold:

| line in the report | column |
|---|---|
| `Tool results entered ≈ N tokens` | what the session let in |
| `carried through later requests ≈ N token-reads` | what it re-read |
| `tokenbrake trimmed N of them: ≈ N tokens kept out, ≈ N token-reads not carried` | what brake 1 did |
| `Context processed: N tokens across N requests` | the whole session, for the share |

Per session: entered, kept out, not carried, and kept out as a share of entered. Over all sessions: median, min, max. The table goes into `AB-TASK.md` and the README of `33kain/tokenbrake` once there are enough files to be a distribution rather than an anecdote, roughly a week of sessions.

A file lands on `main` only when the branch that wrote it is merged; a session branch that is never merged keeps its file. So collect from every `claude/…` branch, not from `main`:

```bash
git fetch origin && mkdir -p collected
for b in $(git branch -r | grep -E 'origin/claude/'); do
  git ls-tree -r --name-only "$b" -- ab-results/real/ | grep -v README | while read -r f; do
    git show "$b:$f" > "collected/$(basename "$f")"
  done
done
```

The loop deduplicates by name, since a merged file exists on `main` and on its branch.
