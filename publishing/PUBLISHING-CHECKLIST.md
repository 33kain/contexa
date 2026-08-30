# CONTEXA — publishing checklist

Work top to bottom. Anything marked **⚠️** is a known rejection trigger, not
just housekeeping.

---

## Phase 1 — deploy the backend (before anything else)

The extension is useless in the store until the backend is live, because
hosted mode is the default.

- [ ] Deploy the Worker following `worker/README.md`.
- [ ] Confirm `curl https://YOUR-HOST/v1/health` returns `{"ok":true,"limit":20}`.
- [ ] **Set a spend limit in the Anthropic console.** Quotas are the first line of
      defence; a hard spend cap is the only real backstop. Do this before the
      URL is public.
- [ ] Set `DEFAULT_PROXY_URL` in `extension/background.js` to your deployed URL.
- [ ] ⚠️ Replace `"https://*.workers.dev/*"` in `manifest.json` with your exact
      host. A wildcard across a whole shared domain reads as over-broad
      permission; one pinned host does not.
- [ ] Reload the extension and confirm suggestions work with the API key field
      **empty** — that's what your users will experience.

## Phase 2 — host the privacy policy

- [ ] Fill `[YOUR_CONTACT_EMAIL]` in `publishing/PRIVACY.md`. Consider a
      dedicated address; this becomes public and permanent.
- [ ] Publish it at a stable public URL (GitHub Pages, a Gist, or your own site).
      It must stay reachable for as long as the extension is listed.
- [ ] ⚠️ Verify the policy matches what the code actually does. If you later
      change what data is sent, the policy has to change in the same release —
      a mismatch is the fastest route to removal.

## Phase 3 — developer account

- [ ] Register at the [Chrome Web Store developer dashboard](https://chrome.google.com/webstore/devconsole).
- [ ] Pay the **one-time $5 USD** registration fee.
- [ ] Verify your email, and set a publisher display name you're happy to be
      known by publicly.

## Phase 4 — prepare the package

- [ ] Bump `version` in `manifest.json` (every upload needs a higher number).
- [ ] Zip the **contents** of `extension/`, not the folder itself —
      `manifest.json` must sit at the archive root.
- [ ] Confirm the zip has no source maps, no `.DS_Store`, no test files.
- [ ] Install the exact zip you're about to upload in a clean Chrome profile and
      use it once. Ship only what you've run.

## Phase 5 — fill the listing

All copy is in `publishing/STORE-LISTING.md`.

- [ ] Name, short description, detailed description.
- [ ] Category: Productivity.
- [ ] Icon: `extension/icons/icon128.png`.
- [ ] Screenshots: the five 1280×800 PNGs in `publishing/screenshots/`.
      Order them `1-interview` → `2-composed` → `3-trigger` → `4-light` →
      `5-settings`; the first is what most people judge the listing by.
      Regenerate with `xvfb-run -a node scripts/screenshots/capture.mjs` rather
      than editing the PNGs by hand.
- [ ] ⚠️ **Retake the screenshots on real claude.ai** before you submit. They
      are captured with the real extension running, but against a local mock of
      claude.ai's DOM and with canned model output. Reviewers compare
      screenshots against actual behaviour, and real ones are simply more honest
      and more convincing — and only a live session proves the selectors still
      match the site as it stands today.
- [ ] Single purpose description (verbatim from the listing doc).
- [ ] Privacy policy URL.
- [ ] Permission justifications — one per permission, specific.
- [ ] Data usage disclosures and the three certifications.

## Phase 6 — the two real rejection risks

**⚠️ Trademark / implied affiliation.** Your listing necessarily mentions Claude,
because that is what the extension works with. Nominative use is allowed;
implying endorsement is not.

- [ ] "Claude" appears nowhere in the extension **name**.
- [ ] The disclaimer is present: *"CONTEXA is an independent project. It is not
      affiliated with, endorsed by, or sponsored by Anthropic."*
- [ ] No Anthropic logo, and no icon or promo image resembling Anthropic's marks.
      Your icon is your own spark mark — keep it that way.
- [ ] Description never says "official", "partner", or "integrated with Anthropic".

**⚠️ Data handling.** You transmit personal communications, which draws real
scrutiny.

- [ ] Disclosures declare Authentication information, Personal communications,
      and Website content (see the listing doc for why each).
- [ ] The description states plainly that conversation text is never stored.
- [ ] No permission is requested that the code doesn't use. Your manifest asks
      for `storage` plus three hosts — nothing else. Keep it minimal; that
      minimalism is your best argument in review.

## Phase 7 — submit

- [ ] Choose visibility. **Unlisted** first is worth considering even though you
      chose a public launch: it exercises the entire review pipeline with no
      reputation at stake, and flipping to public later needs no new review.
- [ ] Submit for review. Expect a few days; first submissions and anything
      touching personal communications often take longer.
- [ ] If rejected, read the cited policy clause, fix precisely that, and resubmit
      with a note describing the change. Arguing without changing anything is
      the slowest path.

## Phase 8 — after it's live

- [ ] ⚠️ **Pin the extension ID on the Worker** the moment Chrome assigns it:
      `npx wrangler deploy --var ALLOWED_EXTENSION_IDS:your32charid`.
      Until you do, anyone who finds your URL can spend your inference budget.
- [ ] Watch spend for the first week against install count. Your break-even
      assumption is ~$0.004 per suggestion set.
- [ ] Watch for claude.ai DOM changes — if suggestions stop appearing, the
      selectors in `content.js` are the first place to look.
- [ ] Decide the quota policy for real usage. If people hit 20/day often, that's
      a signal the product works, and the moment to think about a paid tier
      rather than silently raising your own bill.

---

## What I could not do for you

- **Deploying.** Needs your Cloudflare account and your API key. Commands are in
  `worker/README.md`; secrets stay with you.
- **Paying the $5 fee** or creating the developer account.
- **Real-site screenshots.** Requires the extension installed in your own browser
  on your own claude.ai session.
- **Choosing the contact email** that will be publicly attached to this.
