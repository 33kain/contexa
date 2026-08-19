# Catch git up from v0.9.5 to v0.9.9.
#
# Verifies before it commits, and stops on the first failure rather than pushing
# something broken. Does NOT push — the commit is left local so you can inspect it.
#
# Run:  cd C:\Users\Q\contexa ;  .\commit-0.9.12.ps1

$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot

function Step($msg) { Write-Host ""; Write-Host "== $msg" -ForegroundColor Cyan }
function Die($msg)  { Write-Host "ABORTED: $msg" -ForegroundColor Red; exit 1 }

# ---- 0. has a key ever been committed, in any past version? ---------------
# The staged-diff scan below only sees this commit. A key committed earlier would
# already be in history and pushed to GitHub, where deleting the file does not
# remove it. Worth checking once, given a key was mishandled early in this project.
#
# The pattern requires the long random suffix a real key has. Matching bare
# 'sk-ant-' also hits the options page's own placeholder text, which cried wolf on
# the first run of this script — and a check that fires on nothing is a check you
# start ignoring.
$KEY_RE = 'sk-ant-[A-Za-z0-9_-]{20,}'

Step "scanning ALL git history for a leaked key"
$hist = git --no-pager log --all --oneline -G $KEY_RE
if ($hist) {
  Write-Host "A commit in history adds or removes something shaped like a real key:" -ForegroundColor Red
  Write-Host $hist
  Write-Host "It is in the pushed repo permanently. Revoke it in the Anthropic Console" -ForegroundColor Red
  Write-Host "first, then decide about rewriting history. Deleting a file does not fix it." -ForegroundColor Red
  Write-Host "Inspect with:  git --no-pager grep -nE '$KEY_RE' `$(git rev-list --all)" -ForegroundColor Yellow
  Die "resolve the historical key leak before adding more commits"
}
Write-Host "history clean - no key-shaped strings" -ForegroundColor Green

# Informational only: bare 'sk-ant-' hits placeholders and docs, which are fine.
$loose = git --no-pager log --all --oneline -S 'sk-ant-'
if ($loose) {
  Write-Host "(FYI: $($loose.Count) commit(s) mention 'sk-ant-' without a key-shaped suffix" -ForegroundColor DarkGray
  Write-Host " - normally the options page placeholder. Not treated as a leak.)" -ForegroundColor DarkGray
}

# ---- 1. verify the tree actually works ------------------------------------
Step "worker tests"
node worker\test.mjs
if ($LASTEXITCODE -ne 0) { Die "worker tests failed - not committing" }

Step "extension tests"
Push-Location extension
node test.mjs
$extOk = $LASTEXITCODE
Pop-Location
if ($extOk -ne 0) { Die "extension tests failed - not committing" }

Step "build (also checks prompt drift, model agreement, zip layout)"
node build.mjs
if ($LASTEXITCODE -ne 0) { Die "build failed - not committing" }

# ---- 2. confirm no secret is about to be committed ------------------------
Step "secret scan on what git would actually commit"
git add -A
$staged = git diff --cached --name-only
if (-not $staged) { Write-Host "Nothing staged - tree already matches HEAD."; exit 0 }

# Scan staged CONTENT, not the working tree, so anything .gitignore excluded is
# correctly out of scope. Same key-shaped pattern as the history scan.
$leak = git diff --cached -U0 | Select-String -Pattern $KEY_RE
if ($leak) {
  git reset | Out-Null
  Write-Host $leak -ForegroundColor Red
  Die "an API key appears in the staged diff - unstaged everything, fix this first"
}

# .wrangler holds wrangler-account.json; zips hold the built extension.
$bad = $staged | Where-Object { $_ -match '\.wrangler/' -or $_ -match '\.zip$' -or $_ -match '(^|/)key\.txt$' -or $_ -match '\.dev\.vars$' }
if ($bad) {
  git reset | Out-Null
  Write-Host ($bad -join "`n") -ForegroundColor Red
  Die "files that must never be committed are staged - check .gitignore"
}

Write-Host "clean - no keys, no .wrangler, no zips" -ForegroundColor Green
Write-Host ""
Write-Host "Staging $($staged.Count) file(s):"
$staged | ForEach-Object { Write-Host "  $_" }

# ---- 3. commit ------------------------------------------------------------
Step "commit"
$msg = @"
v0.9.12: fix degraded capture that caused code-conversation truncations

Extension 0.9.12, backend 0.9.12 (includes unreleased 0.9.10 and 0.9.11).

Root cause chain, found in the field: three max_tokens ceiling-hits in one
code-heavy conversation, zero elsewhere. The reply was captured as raw
textContent, which glued adjacent paragraphs together (block elements contribute
no line break) and shipped every line of every code block. On code-heavy replies
the 6,000-char budget filled with raw code, which the model echoed into
oversized step texts until it hit the 2,500-token ceiling.

Capture now walks the DOM: real line breaks at block boundaries, UI chrome
skipped, code blocks collapsed to their first two lines plus a count marker so
signatures survive as anchors while the bulk stays out. Applied to both the
reply and the user message; a mock code-heavy reply shrinks 82 percent, cutting
input cost on what were the most expensive calls. The worker cannot do this fix:
it receives flat text with no fences. Plus one prompt line as insurance, framed
positively per the round-3 A/B finding, byte-identical in both prompt copies and
enforced by the build.

Also in this range:
- 0.9.10: parse failures return a diagnostic (stop_reason, token counts, text
  length, steps started, content block types) instead of destroying the
  evidence; worker logs first 300 chars to wrangler tail; page shows the cause
  in one sentence. A test plants a marker string and fails if conversation text
  reaches the client.
- 0.9.11: partial salvages log the same evidence (last 300 chars — the question
  there is what the model was writing when the budget ran out); diag counts
  steps started vs kept, making over-generation visible.
- 22 extension checks including 10 for the capture walker, verified against
  both a hand-rolled DOM and real Chromium; 19 worker checks.
"@
git commit -m $msg
if ($LASTEXITCODE -ne 0) { Die "commit failed" }

Step "tag"
git tag -a v0.9.12 -m "CONTEXA v0.9.12"

Step "done - nothing pushed yet"
git --no-pager log --oneline -3
Write-Host ""
Write-Host "Review the commit above, then push:" -ForegroundColor Yellow
Write-Host "  git push origin main --follow-tags"
