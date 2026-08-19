# CONTEXA usefulness test — runs against the LIVE backend (real Haiku).
#
# Run it TWICE: once before deploying the new prompt, once after.
#
#   powershell -ExecutionPolicy Bypass -File reproduce-test.ps1 -Tag baseline
#   ...deploy the new worker...
#   powershell -ExecutionPolicy Bypass -File reproduce-test.ps1 -Tag improved
#
# Each run uses 3 of your 20 daily quota (~1.2 cents) and writes
# contexa-test-<tag>.txt next to this script. Send me both files to be scored.

param(
  [string]$Tag = "run",
  [string]$Api = "https://contexa-api.michu110899.workers.dev"
)

# A fresh device token per run, so a previous run's quota can't block this one.
$device = ($Tag -replace '[^A-Za-z0-9]','') + (Get-Date -Format "yyyyMMddHHmmss")
if ($device.Length -lt 16) { $device = $device + ("x" * (16 - $device.Length)) }
$device = $device.Substring(0, [Math]::Min(64, $device.Length))

$outFile = Join-Path $PSScriptRoot ("contexa-test-$Tag.txt")
$log = New-Object System.Collections.Generic.List[string]
function Say($text, $colour = "Gray") { Write-Host $text -ForegroundColor $colour; $log.Add($text) }

# The same three (prompt, reply) pairs as usefulness-test.md, so results compare.
$turns = @(
  @{
    n = 1
    prompt = "Our Cloudflare Worker enforces a 20/day quota per device token using KV counters. Under concurrency two requests both read 19 and both write 20, so users can exceed the limit. What's the right fix?"
    reply  = "KV has no compare-and-swap and is eventually consistent, so read-modify-write on a counter is inherently racy. You have three realistic options. First, Durable Objects: each object is single-threaded with strongly consistent storage, so keying a DO by device token serialises the read-modify-write completely. The cost is an extra hop of latency and per-request charges. Second, the Workers Rate Limiting API: fast and simple, but it is fixed-window and designed for rate limiting rather than daily budgets. Third, accept the drift: lower the limit to absorb overshoot and spend nothing. I would use Durable Objects here, with an in-memory counter and periodic persistence, plus an alarm for daily cleanup. Which matters more to you, exact enforcement or keeping latency and cost minimal?"
  },
  @{
    n = 2
    prompt = "Give me the arithmetic: with KV's read-modify-write race, how many extra requests can one determined client actually get per day, and what does that cost me in dollars?"
    reply  = "The vulnerability window is one KV read latency plus propagation delay, so a burst of simultaneous requests can all read the same value and all pass the check. The overshoot per burst is roughly the number of requests a client can fire inside that window. Critically though, your second axis bounds the total: you also enforce 60 per day per hashed IP. So the worst case for a single origin is about 60 requests, which at roughly 0.004 dollars each is about 24 cents per day. The race costs cents, and the per-IP limit already caps it, so Durable Objects are over-engineering for something whose only job is guarding spend. Do you want the cheap fix instead, meaning lower limits plus a small burst guard?"
  },
  @{
    n = 3
    prompt = "Write a script that fires 50 parallel requests with the same device token and reports how many got through, so I can measure the real overshoot instead of reasoning about it."
    reply  = "Here is a parallel burst harness. It fires 50 concurrent POSTs with an identical device token, counts how many returned 200 versus 429, and prints the overshoot above your configured limit. Two caveats when you interpret the results. Workers may serve your requests from more than one colo, and KV propagation between colos is slower than within one, so a single-origin measurement can understate real-world overshoot. Also watch the KV counter directly afterwards to confirm the final stored value matches the number of successes. Run it three times and take the worst result rather than the average, since you care about the tail."
  }
)

Say ""
Say "CONTEXA usefulness test - tag: $Tag" "Cyan"
Say "api: $Api"
Say "device: $device"
Say "utc: $((Get-Date).ToUniversalTime().ToString('yyyy-MM-dd HH:mm:ss'))"
Say ""

$rawSets = @()
$counts = @()

foreach ($t in $turns) {
  Say ("=" * 74) "DarkGray"
  Say "TURN $($t.n)" "Yellow"
  Say ("prompt: " + $t.prompt)
  Say ""

  $body = @{ prompt = $t.prompt; reply = $t.reply } | ConvertTo-Json

  try {
    $res = Invoke-RestMethod -Uri "$Api/v1/next-steps" -Method Post `
      -ContentType "application/json" `
      -Headers @{ "origin" = "chrome-extension://usefulnesstestusefulnesstestuse"; "x-cx-device" = $device } `
      -Body $body

    Say ("  steps returned: {0}" -f $res.steps.Count) "Magenta"
    $counts += $res.steps.Count
    $i = 1
    foreach ($s in $res.steps) {
      $words = ($s.label -split '\s+' | Where-Object { $_ }).Count
      Say ("  {0}. ({1}w) {2}" -f $i, $words, $s.label) "Green"
      Say ("      {0}" -f $s.text)
      $i++
    }
    if ($res.quota) { Say ""; Say ("  quota: {0}/{1}" -f $res.quota.used, $res.quota.limit) "DarkGray" }
    $rawSets += ($res | ConvertTo-Json -Depth 6 -Compress)
  }
  catch {
    Say ("  FAILED: " + $_.Exception.Message) "Red"
    if ($_.ErrorDetails.Message) { Say ("  " + $_.ErrorDetails.Message) "Red" }
  }
  Say ""
}

Say ("=" * 74) "DarkGray"
Say ("step counts per turn: " + ($counts -join ", ")) "Magenta"
Say ""
Say "RAW JSON (for scoring)" "Cyan"
foreach ($r in $rawSets) { Say $r }
Say ""

$log | Set-Content -Path $outFile -Encoding utf8
Write-Host "Saved to: $outFile" -ForegroundColor Cyan
Write-Host "Send me this file. Ask of each set: how many would you NOT have thought of?" -ForegroundColor Cyan
