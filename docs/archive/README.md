# Archive — shipped planning documents

These are historical planning and specification documents whose content has
**already shipped**. They are kept for provenance — to explain *why* the code
looks the way it does — but they no longer describe pending work. Their own
status lines ("Nothing here is applied yet", "awaiting build commission",
"FINAL DRAFT", "build and ship ASAP") were true when written and are now stale;
read them as history, not as a to-do list.

The live version record is `CHANGELOG.md` at the repo root. The current shipped
prompt is in `extension/background.js` and `worker/src/index.js` (kept
byte-identical by `build.mjs`).

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

See also `test-runs/` for historical prompt-tuning and model-comparison output,
and `../../scripts/archive/` for the one-off scripts and inputs used to
produce some of it.

