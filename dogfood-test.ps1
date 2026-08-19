# CONTEXA dogfood test — three REAL tasks from the build session, live Haiku.
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
  [string]$Tag = "dogfood",
  [string]$Api = "https://contexa-api.michu110899.workers.dev"
)

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
