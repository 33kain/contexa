# Archive — shipped planning documents

These are historical planning and specification documents whose content has
**already shipped**. They are kept for provenance — to explain *why* the code
looks the way it does — but they no longer describe pending work. Their own
status lines ("Nothing here is applied yet", "awaiting build commission",
"FINAL DRAFT", "build and ship ASAP") were true when written and are now stale;
read them as history, not as a to-do list.

The live version record is `CHANGELOG.md` at the repo root. The current shipped
prompt is `MOVES_SYSTEM`, in `extension/background.js` and `worker/src/index.js`
(kept byte-identical by `build.mjs`).

**Most of what these documents describe was deleted on 2026-08-31**, in the
history-mining pivot: the click-only interview and its card, the fifth chip and
its free-text box, the four earned move ids, the standalone `Assume:` array, the
`v`/`accepts` schema negotiation, and the `QUESTIONS_SYSTEM`, `EXPAND_SYSTEM` and
`LEGACY_STEPS_SYSTEM` prompts. Read anything below describing those as an account
of why the code once looked the way it did, never as a description of the
product. See `CHANGELOG.md` 0.9.58 and `docs/history-mining-audit.md`.

| Document | Shipped in | What it covered |
|---|---|---|
| `SPEC-v0.9.17.md` | extension/worker 0.9.17 | Evidence-grounded requisitions — every step earned by a verbatim reply fragment. |
| `next-release-train.md` | 0.9.19 | The voice patch ("the text always addresses Claude") plus README copy. |
| `SPEC-0.9.23-fifth-chip.md` | 0.9.23 | The fifth chip — rough ask in, drafted prompt out ("make bad prompts good"). |
| `TRAIN-EXPAND-0.9.23.md` | 0.9.23 | Final draft of the fifth chip's `EXPAND_SYSTEM` prompt text. |
| `website-build-prompt.md` | — | One-off prompt used to generate the marketing site. |
| `CONTEXA-design-brief.md` | 0.9.55 | Design-chat brief for the mascot/teal hat — decisions, not code. |
| `CONTEXA-content-spec.md` | 0.9.55 | Handover spec: mascot trigger + interview card skin. |
| `CONTEXA-voice-spec.md` | 0.9.55 | Handover spec: the interview's "mirror" voice register. |
| `CONTEXA-card-spec.md` | 0.9.32 | Exact spec of the interview card, extracted from shipped code for the website mock. |
| `icon-inspect.png` | — | One-off inspection screenshot from the 0.9.55 mascot icon work. |
| `legacy-steps-prompt.txt` | frozen at 0.9.31 | A snapshot of `LEGACY_STEPS_SYSTEM`, taken when the dual-schema negotiation shipped. It was never the source of truth — that was the constant in `worker/src/index.js` — but the constant was deleted on 2026-08-31 with the rest of the negotiation, so this snapshot is now the only copy that exists. Still nothing reads it. |

See also `test-runs/` for historical prompt-tuning and model-comparison output,
and `../../scripts/archive/` for the one-off scripts and inputs used to
produce some of it.

