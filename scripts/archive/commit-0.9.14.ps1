# Catch git up from v0.9.5 to v0.9.9.
#
# Verifies before it commits, and stops on the first failure rather than pushing
# something broken. Does NOT push — the commit is left local so you can inspect it.
#
# Run:  cd C:\Users\Q\contexa ;  .\commit-0.9.14.ps1

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
v0.9.14: partial salvages render clean; ceiling signal moves to the console

Owner's decision: the cut-short banner is gone. Salvage keeps the first N
complete steps and the prompt orders by leverage, so a partial set is the
best prefix; every chip is whole; 3-5 chips is the spec either way. Hiding
the banner fakes nothing - it stops narrating engine internals the user
cannot act on.

The signal is not dropped: every partial logs [CONTEXA] partial salvage with
the diagnostic to the page console. Each partial burns 3-5x the output cost
of a clean response, so the frequency stays measurable during validation.

Source assertions pin all three properties: no banner markup, no partial
flag on renderSteps, console logging present.
"@
git commit -m $msg
if ($LASTEXITCODE -ne 0) { Die "commit failed" }

Step "tag"
git tag -a v0.9.14 -m "CONTEXA v0.9.14"

Step "done - nothing pushed yet"
git --no-pager log --oneline -3
Write-Host ""
Write-Host "Review the commit above, then push:" -ForegroundColor Yellow
Write-Host "  git push origin main --follow-tags"
