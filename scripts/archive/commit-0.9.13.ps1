# Catch git up from v0.9.5 to v0.9.9.
#
# Verifies before it commits, and stops on the first failure rather than pushing
# something broken. Does NOT push — the commit is left local so you can inspect it.
#
# Run:  cd C:\Users\Q\contexa ;  .\commit-0.9.13.ps1

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
v0.9.13: pass resp at the error call site so diagnostics actually render

Four missing characters. Three versions of instrumentation (0.9.10-0.9.12)
built the diagnostic pipeline - worker computes it, background forwards it,
renderQuiet renders the grey cause-sentence - and the one call site joining
the last two links read renderQuiet(anchor,'error',reason) with no resp.
The fourth argument was always undefined, which silently disabled both the
grey sentence and the page-console warning for every truncation ever shown.
Each link had a test; the joint had none. A source assertion now pins it.

Found by the field, not by reading: a truncation on verified 0.9.12/0.9.12
still produced a bare card, which the version matrix said was impossible.

Same investigation, via remote browser inspection of a live tab: CONTEXA
runs on claude.ai Cowork sessions (same composer, working streaming flag,
virtualized DOM, reply blocks include tool-widget labels), and a background
tab silently spends quota on every reply. Scope decision deferred.

First field pass after the fix, observed directly: four chips on a long
dense-prose reply - the class that had failed 3/3 - labels 5-6 words,
payloads 206-273 chars, no code, no voice inversion, bullets only where
constraints earn them.
"@
git commit -m $msg
if ($LASTEXITCODE -ne 0) { Die "commit failed" }

Step "tag"
git tag -a v0.9.13 -m "CONTEXA v0.9.13"

Step "done - nothing pushed yet"
git --no-pager log --oneline -3
Write-Host ""
Write-Host "Review the commit above, then push:" -ForegroundColor Yellow
Write-Host "  git push origin main --follow-tags"
