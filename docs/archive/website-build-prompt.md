You're building a one-page marketing website for a browser extension called CONTEXA. I'm the developer. Everything factual you need is below — do not add facts that aren't here.

## What CONTEXA is

A browser extension that works on claude.ai. After Claude replies, CONTEXA reads that reply and shows a row of short chips underneath it. Each chip is a next move. Click one and a full, ready-to-send prompt loads into the message box, written in the user's own voice. The user reads it, edits if they want, and hits send. There is also an empty "Rough ask" chip: type a rough intent ("optimize seo & meta") and CONTEXA drafts the full, well-formed prompt for you.

- Official name: **CONTEXA — Prompt like a PRO**
- Motto: **Make bad prompts good.**
- One-liner already in use on the store listing: *"Reads the reply and hands you your next prompt, tailored in AI language, ready to send. No API key, no account, no setup."*
- The chips are grounded in the reply itself — every suggestion has to be provable from what Claude actually said, which is why they're specific to the conversation instead of generic advice.
- Free. No signup, no account, no API key, no credit card. A hosted backend covers a fair-use allowance of 20 next-step generations per day.
- Power users can paste their own Anthropic API key in the extension's options page for unlimited use. In that mode requests go straight from their browser to the API — the key never touches my server.
- Privacy: no login, no personal data, no tracking, no analytics. An anonymous per-install token exists only so the free tier can count usage against the daily allowance.

## Install and supported browsers — get this exactly right

The only distribution channel is the Chrome Web Store:

**https://chromewebstore.google.com/detail/phhamigkjeeabbjncpmhkppkjccfglhb**

- **Google Chrome** — the primary path. This deserves the big obvious "Add to Chrome" button.
- **Microsoft Edge, Brave, Opera, Vivaldi, Arc** — all Chromium-based, and they install from the *same* Chrome Web Store link above. Some of them ask the user to allow extensions from other stores the first time.
- **Not supported:** Firefox, Safari, and all mobile browsers. Extensions of this kind only run in desktop Chromium browsers.

Build the install area as one primary button plus a clearly labeled group of the other supported browsers pointing at that same URL, and state plainly which browsers aren't supported rather than staying quiet about it. Do not invent a Firefox add-on link, a Safari link, a direct .zip download, an App Store link, or a "coming soon" date for any of them.

## Hard rules

- CONTEXA is an independent product. It is **not** affiliated with, endorsed by, or partnered with Anthropic. Write "works on claude.ai" — never anything that implies official status, partnership, or approval. Don't use Anthropic's or Claude's logos, wordmarks, or signature brand colors in a way that suggests the product is theirs.
- **Invent nothing.** No testimonials, no reviews, no star ratings, no user counts, no press logos, no team bios, no funding, no roadmap dates, no pricing tiers beyond what's written above. If a section you want to build would need a fact I haven't given you, ask me for it instead of filling it in.
- No email capture, no newsletter signup, no analytics, no third-party scripts, no trackers, no cookie banner (because there should be nothing to consent to).

## Before you build anything, ask me questions

Do not write code in your first response. Instead do these two things:

1. **Ask me what you actually need.** Scope and sections, tone, what a first-time visitor should understand within five seconds, whether I have screenshots or a demo GIF to give you (I do have screenshots), how much explaining the product needs versus showing it, and where this will be hosted — I already run a Cloudflare Worker for this product, so Cloudflare Pages is the likely target.
2. **Propose four distinct visual directions** tailored to this brief. Give each one as: background hex / accent hex / typeface pairing, plus one line on why it suits a small precise tool that lives inside somebody's chat window. Make them genuinely different from each other, not four variations on one idea.

Then stop and wait. I'll answer your questions and pick a direction. Only after that should you build.

## When you do build

One self-contained HTML file. No build step, no framework, no external requests — inline the CSS and JavaScript, and use system-available or self-hosted fonts so the page works offline and loads instantly. Responsive down to a phone screen. Semantic HTML, keyboard navigable, real contrast, alt text on every image.

Avoid the default AI-website look: no Inter, Roboto or Arial; no purple-to-blue gradient on white; no row of three generic line icons under the fold; no fake "trusted by" logo bar. The people who install this type for a living and will notice a template instantly. Make it feel deliberate and specific to what the product actually does.

Keep your messages to me short and readable — lead with what you did or what you need, and put the supporting detail after it.
