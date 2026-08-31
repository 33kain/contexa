# CONTEXA dogfood test — three REAL tasks from the build session, live model.
#
# Run it TWICE: once before deploying a prompt change, once after.
#
#   powershell -ExecutionPolicy Bypass -File dogfood-test.ps1 -Tag baseline
#   ...deploy the new worker...
#   powershell -ExecutionPolicy Bypass -File dogfood-test.ps1 -Tag improved
#
# Each run uses 3 of your 20 daily quota (~1.2 cents) and writes
# contexa-test-<tag>.txt next to this script. Send me both files to be scored.
#
# 2026-08-31 — rewritten for history mining. The request is now (turns, reply)
# and the session ACCUMULATES across the run, so turn 3 is mined against all
# three turns rather than against itself. Sending only the current turn would
# have tested the old single-turn product wearing the new wire and would never
# have exercised the pin/drop policy — which is the same class of mistake as
# the one below, and the reason that note is kept.
#
# 2026-08-30 — fixed to actually hit the current prompt. This script sent no
# `v` field, which the worker read as a pre-0.9.30 client, answering with the
# frozen one-step prompt that predated everything since. Every run was silently
# testing a prompt nobody was trying to test. It also sent an Origin that does
# not match ALLOWED_EXTENSION_IDS in wrangler.toml. Both were fixed; the `v`
# field has since gone with the negotiation itself, but the lesson stands and
# is why the accumulation above is spelled out rather than assumed.
#
# FIELD NOTES
#
# 2026-08-30 — first live run since the fix, against BUILD 0.9.57 (Node port
# of this script, run from a session with network access to the worker; this
# one has none). All three branches fired correctly on real, spontaneous
# replies:
#   Turn 1 (fork/choose)  — MOVES(1): reply said "that is your call rather
#     than mine" between two fixes; came back as a `choose` chip, grounded on
#     the real quote. Clean confirmation of the precedence rule's core case.
#   Turn 2 (Chrome Web Store fields) — QUESTIONS(1): reply fully resolved
#     both justification fields, leaving nothing genuinely open. Still earned
#     one question ("Did the host and remote code fields clear the errors?"),
#     evidence-grounded (the quote is real) so nothing is misbehaving — but
#     it reads closer to a status check-in than a fork/assumption/missing-
#     info case. Not a defect in this run; flagged here for whoever next
#     tunes the question-vs-quiet boundary.
#   Turn 3 (quiet + assume) — QUIET, with `assume` carrying the reply's own
#     complete recommendation verbatim. Clean confirmation of "state it,
#     don't ask" for a reply that left nothing open.
# None of the three was the "contested shape" case (a reply that both asks
# directly AND earns a move in the same breath) — that one was covered
# separately by the earlier live U1 check against /v1/next-steps.

param(
  [string]$Tag = "dogfood",
  [string]$Api = "https://contexa-api.michu110899.workers.dev"
)

# Real, pinned in wrangler.toml — see ALLOWED_EXTENSION_IDS. A made-up origin
# gets forbidden_origin now that the worker is locked to the shipped extension.
$origin = "chrome-extension://phhamigkjeeabbjncpmhkppkjccfglhb"

# A fresh device token per run, so a previous run's quota can't block this one.
$device = ($Tag -replace '[^A-Za-z0-9]','') + (Get-Date -Format "yyyyMMddHHmmss")
if ($device.Length -lt 16) { $device = $device + ("x" * (16 - $device.Length)) }
$device = $device.Substring(0, [Math]::Min(64, $device.Length))

$outFile = Join-Path $PSScriptRoot ("contexa-test-$Tag.txt")
$log = New-Object System.Collections.Generic.List[string]
function Say($text, $colour = "Gray") { Write-Host $text -ForegroundColor $colour; $log.Add($text) }

$turns = @(
  @{
    n = 1
    prompt = "npx wrangler login fails with: File C:\Program Files\nodejs\npx.ps1 cannot be loaded because running scripts is disabled on this system. I am on Windows PowerShell and trying to deploy a Cloudflare Worker."
    reply  = "That is the PowerShell execution policy blocking npm's PowerShell shim. npm ships npx as both npx.ps1 and npx.cmd, and only the .ps1 version is subject to the policy. The least invasive fix is to call the cmd version instead: npx.cmd wrangler login. Nothing on your system changes, and it works identically for every wrangler command. The alternative is Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned, which permanently allows locally-created scripts to run. That is a security setting on your machine, so it is your call rather than mine, and you do not need it to get deployed. Two related Windows gotchas while you are here: in PowerShell 5.1 plain curl is an alias for Invoke-WebRequest and will not accept curl flags, so use curl.exe explicitly, and there is no openssl, so generate random strings with the guid method instead."
  },
  @{
    n = 2
    prompt = "The Chrome Web Store dashboard is blocking my submission with two errors: a justification for host permission use is required, and a justification for remote code use is required. On the Privacy practices tab I only see one text box, for storage."
    reply  = "The dashboard does not give one box per host. It gives one justification box per API permission, which for you is just storage, plus a single combined field covering all host permissions together, usually labelled Host permission justification and sitting below the storage box. Press Ctrl+F on that page and search for host to jump to it. Put all three of your hosts in that one field, explaining each: claude.ai because it is the only site the extension operates on and it must read the completed reply and insert the chosen prompt into the composer, api.anthropic.com because it is used only when the user supplies their own API key, and your workers.dev host because it is your own backend for users without a key. The remote code error is different and you should not write a justification for it at all. Change the answer to No, I am not using remote code. Remote code means executing JavaScript or WebAssembly that is not in your package, such as a script tag pointing at a CDN or eval on a fetched string. Fetching JSON data over HTTPS and parsing it is data handling, not remote code. Declaring yes would put you in a stricter review category for something you are not doing."
  },
  @{
    n = 3
    prompt = "I made the suggestion count variable between three and five instead of fixed at five. Counts came back 5, 3, 3 so the change worked mechanically, but measured novelty dropped from 73 percent to 55 percent. Should I revert?"
    reply  = "The trimming removed novel suggestions rather than filler, which is the opposite of the intent. In the turn that dropped from five to three, what survived were the two safest items, the ones any competent person would already have thought of, while the speculative ones disappeared. Told to omit anything it would not click, the model pruned the hardest-to-defend ideas first, so selection pressure favoured safety over originality. Meanwhile the turn that kept all five produced the single best suggestion across every round: it caught an unspecified requirement, asking whether the daily quota meant a calendar day, a local day, or a rolling twenty-four hours, and noting that the answer eliminates two of the three proposed solutions. That is where the value lives, in the tail. My recommendation is to keep the style rules but revert to five, with a much narrower escape hatch: drop a step only when it restates the reply or duplicates another step, never merely to be cautious. One caveat on all of this: there is a single run per configuration and three turns each, so the drop is suggestive rather than proven."
  }
)

Say ""
Say "CONTEXA dogfood test - tag: $Tag" "Cyan"
Say "api: $Api"
Say "session grows to $($turns.Count) turns across the run"
Say "device: $device"
Say "utc: $((Get-Date).ToUniversalTime().ToString('yyyy-MM-dd HH:mm:ss'))"
Say ""

$branchCounts = @()

# The session accumulates as the run walks it, which is the point: turn 1 is
# mined against a one-turn session, turn 3 against all three. A run that sent
# only the current turn would test the old single-turn product wearing the new
# wire, and would never exercise the pin/drop policy at all.
$turnsSoFar = @()

foreach ($t in $turns) {
  $turnsSoFar += @{ i = $t.n; text = $t.prompt }
  Say ("=" * 74) "DarkGray"
  Say "TURN $($t.n)" "Yellow"
  Say ("prompt: " + $t.prompt)
  Say ""

  # Two fields, no handshake. The v/accepts negotiation went with the three
  # client generations it served; there is one shape now. `turns` is the whole
  # signal — the session's own prompts, oldest first — and a request without it
  # is refused before it costs anything.
  $body = @{
    reply = $t.reply
    turns = $turnsSoFar
  } | ConvertTo-Json -Depth 4

  try {
    $res = Invoke-RestMethod -Uri "$Api/v1/next-steps" -Method Post `
      -ContentType "application/json" `
      -Headers @{ "origin" = $origin; "x-cx-device" = $device } `
      -Body $body

    # One shape. The label is what the user reads; the text is what lands in
    # the message box verbatim, so both are printed in full — a label that
    # reads well over a text that does not is the failure worth catching.
    if ($res.moves -and $res.moves.Count -gt 0) {
      Say ("  MOVES: {0}" -f $res.moves.Count) "Magenta"
      $branchCounts += "MOVES($($res.moves.Count))"
      foreach ($m in $res.moves) {
        Say ("  [{0}]" -f $m.label) "Green"
        Say ("      {0}" -f ($m.text -replace "`n", "`n      "))
        Say ("      evidence: {0}" -f $m.evidence)
      }
    }
    else {
      Say "  QUIET: nothing mined from this session" "DarkYellow"
      $branchCounts += "QUIET"
    }

    if ($res.grounding) {
      Say ""
      Say ("  grounding: {0} returned, {1} kept, {2} grounded" -f `
        $res.grounding.total, $res.grounding.kept, $res.grounding.grounded) "DarkCyan"
    }

    if ($res.quota) { Say ""; Say ("  quota: {0}/{1}" -f $res.quota.used, $res.quota.limit) "DarkGray" }
    Say ""
    Say "  RAW JSON:" "DarkGray"
    Say ($res | ConvertTo-Json -Depth 6 -Compress)
  }
  catch {
    Say ("  FAILED: " + $_.Exception.Message) "Red"
    if ($_.ErrorDetails.Message) { Say ("  " + $_.ErrorDetails.Message) "Red" }
    $branchCounts += "ERROR"
  }
  Say ""
}

Say ("=" * 74) "DarkGray"
Say ("branch per turn: " + ($branchCounts -join ", ")) "Magenta"
Say ""

$log | Set-Content -Path $outFile -Encoding utf8
Write-Host "Saved to: $outFile" -ForegroundColor Cyan
Write-Host "Send me this file. For each move: would you actually send that message, as written, without editing it first? And for a QUIET row: was there really nothing worth doing next?" -ForegroundColor Cyan
