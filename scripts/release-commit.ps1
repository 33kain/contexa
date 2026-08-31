# CONTEXA release commit — permanent template (replaces per-release scripts).
#
# Run from anywhere:   powershell -ExecutionPolicy Bypass -File .\scripts\release-commit.ps1
# Reads the version from extension\manifest.json. Verifies before committing,
# stops on the first failure, commits and tags, never pushes.
#
# Why -F instead of -m: Windows PowerShell 5.1 shatters native-command
# arguments at embedded double quotes, so a commit message QUOTING anything
# (a Chrome error string, a chip payload) breaks into fake pathspecs.
# Writing the message to a temp file and using `git commit -F` is immune to
# the entire class. UTF-8 without BOM so the first character of history is
# never a byte-order mark.

$ErrorActionPreference = 'Stop'
# Every path below is repo-root-relative, and this script lives in scripts\.
# It used to sit at the root, where $PSScriptRoot WAS the root; the housekeeping
# commit that moved it left this line behind, so it ran one directory too deep
# and died on the first path it touched. Anchor to the parent, not to the
# script's own folder.
Set-Location (Join-Path $PSScriptRoot '..')

function Step($msg) { Write-Host ""; Write-Host "== $msg" -ForegroundColor Cyan }
function Die($msg)  { Write-Host "ABORTED: $msg" -ForegroundColor Red; exit 1 }

# ---- 0. version comes from the manifest, not from editing this file --------
$manifest = Get-Content .\extension\manifest.json -Raw | ConvertFrom-Json
$version = $manifest.version
if (-not $version) { Die "could not read version from extension\manifest.json" }
Step "release commit for v$version"

# ---- 1. has a key ever been committed, in any past version? ----------------
# Tight pattern: requires the long random suffix a real key has. Bare 'sk-ant-'
# matches the options page's own placeholder and cries wolf.
$KEY_RE = 'sk-ant-[A-Za-z0-9_-]{20,}'
Step "scanning ALL git history for a leaked key"
$hist = git --no-pager log --all --oneline -G $KEY_RE
if ($hist) {
  Write-Host $hist -ForegroundColor Red
  Write-Host "A commit adds or removes a key-shaped string. Revoke it in the" -ForegroundColor Red
  Write-Host "Anthropic Console first. Deleting a file does not fix pushed history." -ForegroundColor Red
  Die "resolve the historical key leak before adding more commits"
}
Write-Host "history clean - no key-shaped strings" -ForegroundColor Green

# ---- 2. verify the tree actually works --------------------------------------
Step "worker tests"
node worker\test.mjs
if ($LASTEXITCODE -ne 0) { Die "worker tests failed - not committing" }

Step "extension tests"
Push-Location extension
node test.mjs
$extOk = $LASTEXITCODE
Pop-Location
if ($extOk -ne 0) { Die "extension tests failed - not committing" }

Step "build (prompt identity, model agreement, zip layout)"
node build.mjs
if ($LASTEXITCODE -ne 0) { Die "build failed - not committing" }

# ---- 3. stage, then refuse to commit secrets or junk ------------------------
Step "secret scan on what git would actually commit"
git add -A
$staged = git diff --cached --name-only
if (-not $staged) { Write-Host "Nothing staged - tree already matches HEAD."; exit 0 }

$leak = git diff --cached -U0 | Select-String -Pattern $KEY_RE
if ($leak) {
  git reset | Out-Null
  Write-Host $leak -ForegroundColor Red
  Die "a key-shaped string appears in the staged diff - unstaged everything"
}
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

# ---- 4. compose the message from the changelog, commit via file -------------
Step "commit"
# Message = header line + the top CHANGELOG section (from its first '## ' to
# the first '---' after it). If extraction fails for any reason, the header
# line alone is a complete, honest message: the full story is IN the commit,
# because CHANGELOG.md is one of the staged files.
$header = "CONTEXA v$version. Full changelog in CHANGELOG.md."
$body = ""
try {
  $lines = Get-Content .\CHANGELOG.md
  $start = -1; $end = -1
  for ($i = 0; $i -lt $lines.Count; $i++) {
    if ($start -lt 0 -and $lines[$i] -like '## *') { $start = $i; continue }
    if ($start -ge 0 -and $lines[$i].Trim() -eq '---') { $end = $i; break }
  }
  if ($start -ge 0) {
    if ($end -lt 0) { $end = [Math]::Min($start + 40, $lines.Count) }
    $body = ($lines[$start..($end - 1)] -join "`n").Trim()
  }
} catch { $body = "" }
$msg = if ($body) { $header + "`n`n" + $body } else { $header }

$msgFile = Join-Path $env:TEMP "contexa-commit-msg.txt"
[System.IO.File]::WriteAllText($msgFile, $msg, [System.Text.UTF8Encoding]::new($false))
git commit -F $msgFile
$commitOk = $LASTEXITCODE
Remove-Item $msgFile -ErrorAction SilentlyContinue
if ($commitOk -ne 0) { Die "commit failed" }

Step "tag"
git tag -a "v$version" -m "CONTEXA v$version"

Step "done - nothing pushed yet"
git --no-pager log --oneline -3
Write-Host ""
Write-Host "Review the commit above, then push:" -ForegroundColor Yellow
Write-Host "  git push origin main --follow-tags"
