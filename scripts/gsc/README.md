# gsc

A weekly Search Console report for `contexa-website.pages.dev`. `weekly.mjs` pulls
the last complete week and the week before it, then writes `seo/reports/<end-date>.md`
with totals, top queries, new and lost queries, position movers and pages. It has no
dependencies and makes no model call. It lists the numbers and leaves reading them
to a person. A week under 100 impressions is labelled as too little data rather than
flagged as a trend.

Ranges end 3 days back (`--lag`), because Search Console's final data trails by 2–3 days.

## One-time setup

**1. Verify the site (the maintainer, in the browser).** A `pages.dev` subdomain
cannot be verified by DNS, so it is a **URL-prefix** property:

- Search Console → Add property → *URL prefix* → `https://contexa-website.pages.dev/`
- Method *HTML tag*: copy only the `content` value of the tag it shows.
- The tag goes in `publishing/website/index.html`, in `<head>` right after the
  `<meta name="description">` line:

  ```html
  <meta name="google-site-verification" content="PASTE_VALUE_HERE">
  ```

  It is a plain meta tag, so the single-origin CSP in `_headers` is unaffected.
  Deploy the site, then press *Verify*. Also submit `sitemap.xml` under *Sitemaps*.
  Keep the tag in place after verification, because removing it un-verifies the property.

**2. A service account for the API.**

- Google Cloud console → create a project (any name) → enable **Google Search Console API**.
- IAM → Service accounts → create one, no roles → Keys → *Add key* → JSON.
- Save the file **outside this repository**, at `~/.config/contexa/gsc-key.json`, or
  point `GSC_KEY` at it.
- Search Console → Settings → Users and permissions → add the service account's
  e-mail (`…@….iam.gserviceaccount.com`) with *Restricted* permission. Read access is all it needs.

**3. Check it once by hand:**

```bash
node scripts/gsc/weekly.mjs --stdout
```

Search Console needs a few days after verification before the API returns rows.
Until then the report shows zeros.

## Running it weekly

Windows Task Scheduler, Mondays at 09:00, run from the repo root:

```powershell
$repo = "$env:USERPROFILE\projects\contexa"
$action = New-ScheduledTaskAction -Execute "node" -Argument "scripts/gsc/weekly.mjs" -WorkingDirectory $repo
$trigger = New-ScheduledTaskTrigger -Weekly -DaysOfWeek Monday -At 9am
Register-ScheduledTask -TaskName "CONTEXA GSC weekly" -Action $action -Trigger $trigger
```

The script writes the file and does nothing else. To have Claude read a report, open
it in a session. That is the only step that costs tokens.

## Checking the format offline

`--fixture <file.json>` renders from saved data shaped
`{ current: { start, end, totals, queries, pages }, previous: { … } }`, where each row is
`{ key, clicks, impressions, ctr, position }`. No credentials or network are needed.

## Before changing anything on the site

Collect 2–4 weekly reports first. They are the baseline, and without them no later
change can be told apart from the site's ordinary week-to-week variation.
