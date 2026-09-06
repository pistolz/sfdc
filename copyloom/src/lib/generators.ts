import type { BrandKit } from "./types";

export interface Field {
  name: string;
  label: string;
  type: "text" | "textarea" | "select";
  placeholder?: string;
  help?: string;
  options?: string[];
  required?: boolean;
}

export interface Generator {
  id: string;
  name: string;
  icon: string;
  category: "Email" | "Web" | "Social" | "Ads" | "Content" | "Planning";
  blurb: string;
  /** Output format, which drives how the asset is rendered and exported. */
  format: "markdown" | "html";
  /** Streaming ceiling. Landing pages need far more room than a tweet. */
  maxTokens: number;
  fields: Field[];
  /** Task-specific instruction appended after the shared brand context. */
  instruction: (inputs: Record<string, string>) => string;
}

/* -------------------------------------------------------------------------- */
/* Shared prompt scaffolding                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Stable across every request and every user, so it sits first in the system
 * prompt where the prompt cache can hold it.
 */
export const ROLE_PROMPT = `You are a senior marketing copywriter and strategist working inside a content studio. You write for real companies shipping real campaigns.

How you work:
- Lead with the customer's problem and the specific outcome, not with adjectives.
- Be concrete. Name the mechanism, the number, the before-and-after. Cut filler.
- Match the brand's voice exactly as described. If the brand sounds plain, stay plain.
- Never invent statistics, customer names, testimonials, awards, funding, or press coverage. If a claim would need a source the brief does not provide, write around it or leave a clearly marked [placeholder].
- Avoid the tells of generated copy: "unlock", "elevate", "in today's fast-paced world", "game-changer", "seamlessly", "revolutionize", "supercharge", "dive in", "it's not just X, it's Y", and opening with a rhetorical question.
- Vary sentence length. Short sentences carry weight; use them for the point that matters.

Output rules:
- Return only the finished deliverable. No preamble, no "here is your...", no explanation of your choices afterward.
- Use the exact structure requested in the task.`;

function line(label: string, value: string | undefined): string {
  const trimmed = (value || "").trim();
  return trimmed ? `${label}: ${trimmed}\n` : "";
}

/** Renders the brand kit into the system prompt. Stable per user, so cacheable. */
export function brandBlock(brand: BrandKit | null): string {
  if (!brand) {
    return `No brand kit has been set up yet. Write in a clear, professional, neutral voice and use [placeholders] wherever product specifics are required.`;
  }
  return (
    `You are writing as the in-house marketing team for this brand. Everything you produce must sound like it came from them.\n\n` +
    line("Brand", brand.name) +
    line("Website", brand.website) +
    line("What they do", brand.oneLiner) +
    line("Who they sell to", brand.audience) +
    line("Voice and tone", brand.tone) +
    line("Value propositions", brand.valueProps) +
    line("What makes them different", brand.differentiators) +
    line("Default call to action", brand.defaultCta) +
    (brand.bannedWords.trim()
      ? `Never use these words or phrases: ${brand.bannedWords.trim()}\n`
      : "") +
    (brand.exampleCopy.trim()
      ? `\nHere is copy the brand has published before. Match its rhythm, vocabulary and level of formality:\n"""\n${brand.exampleCopy.trim()}\n"""\n`
      : "")
  );
}

/** Free-text steer the user can add to any generation. */
function extras(inputs: Record<string, string>): string {
  const notes = (inputs.notes || "").trim();
  return notes ? `\n\nAdditional direction from the user (this overrides the defaults above where they conflict):\n${notes}` : "";
}

const NOTES_FIELD: Field = {
  name: "notes",
  label: "Extra direction (optional)",
  type: "textarea",
  placeholder: "Anything specific: an angle to take, a competitor to contrast with, a deadline to mention...",
};

/* -------------------------------------------------------------------------- */
/* Generators                                                                  */
/* -------------------------------------------------------------------------- */

export const GENERATORS: Generator[] = [
  {
    id: "newsletter",
    name: "Email newsletter",
    icon: "✉️",
    category: "Email",
    blurb: "A full send-ready newsletter with subject lines and preheader.",
    format: "markdown",
    maxTokens: 8000,
    fields: [
      {
        name: "topic",
        label: "What is this issue about?",
        type: "textarea",
        placeholder: "We shipped scheduled reports, and I want to tie it to the month-end crunch our users complain about.",
        required: true,
      },
      {
        name: "goal",
        label: "Primary goal",
        type: "select",
        options: ["Drive clicks to a page", "Announce a feature", "Nurture and educate", "Drive replies", "Re-engage dormant users"],
        required: true,
      },
      {
        name: "length",
        label: "Length",
        type: "select",
        options: ["Short (150-250 words)", "Standard (350-500 words)", "Long (700-900 words)"],
        required: true,
      },
      NOTES_FIELD,
    ],
    instruction: (i) =>
      `Write one email newsletter.

Topic: ${i.topic}
Primary goal: ${i.goal}
Target length: ${i.length}

Structure your output with these exact markdown headings:

## Subject lines
Five options. Vary the approach: one curiosity, one direct benefit, one specific number or detail, one short (under 30 characters), one that reads like a note from a colleague. No emoji unless the brand voice calls for it.

## Preheader
One line, 40-90 characters, that adds information rather than repeating the subject.

## Body
The email itself. Open with a concrete situation the reader recognises, not a greeting or a throat-clear. Keep paragraphs to one to three sentences. Build toward a single clear action.

## Call to action
The button or link text, plus one sentence of supporting copy.${extras(i)}`,
  },

  {
    id: "landing-page",
    name: "Landing page",
    icon: "🖥️",
    category: "Web",
    blurb: "A complete, responsive HTML landing page you can ship as-is.",
    format: "html",
    maxTokens: 32000,
    fields: [
      {
        name: "offer",
        label: "What is the page selling?",
        type: "textarea",
        placeholder: "A 14-day free trial of our scheduling tool for independent clinics.",
        required: true,
      },
      {
        name: "audience",
        label: "Who is landing on it?",
        type: "text",
        placeholder: "Practice managers at 2-10 person clinics",
        required: true,
      },
      {
        name: "cta",
        label: "Call to action",
        type: "text",
        placeholder: "Start free trial",
        required: true,
      },
      {
        name: "style",
        label: "Visual style",
        type: "select",
        options: ["Clean and minimal", "Bold and high-contrast", "Warm and human", "Technical and dense"],
        required: true,
      },
      NOTES_FIELD,
    ],
    instruction: (i) =>
      `Build a complete, production-ready landing page as a single HTML file.

Offer: ${i.offer}
Audience: ${i.audience}
Primary call to action: ${i.cta}
Visual style: ${i.style}

Requirements:
- Return one HTML document starting with <!DOCTYPE html>. All CSS goes in a single <style> block in the head. No external stylesheets, no frameworks, no JavaScript build steps. A small amount of inline vanilla JS is fine for an FAQ accordion or mobile menu.
- Define your colour palette as CSS custom properties on :root so it is easy to rebrand. Support both light and dark via prefers-color-scheme.
- Responsive down to 360px using flexbox and grid. No horizontal scroll at any width.
- Sections, in order: hero with headline, subhead and primary CTA; the problem stated in the reader's words; how it works in three steps; benefits tied to outcomes; social proof section using clearly marked [placeholder] quotes; pricing or offer detail; FAQ with five real objections answered; closing CTA; minimal footer.
- Use system font stacks. Use inline SVG for any icons. Do not reference external images: use CSS gradients or shapes as placeholders.
- Accessible: semantic landmarks, a visible focus style, alt text on meaningful graphics, and text contrast of at least 4.5:1 in both themes.

Return only the HTML document, with no markdown fences around it.${extras(i)}`,
  },

  {
    id: "social-posts",
    name: "Social pack",
    icon: "💬",
    category: "Social",
    blurb: "One idea, rewritten natively for each platform.",
    format: "markdown",
    maxTokens: 8000,
    fields: [
      {
        name: "topic",
        label: "What are you posting about?",
        type: "textarea",
        placeholder: "The finding from our usage data that most churn happens in week two, not month six.",
        required: true,
      },
      {
        name: "platforms",
        label: "Platforms",
        type: "select",
        options: ["LinkedIn + X", "LinkedIn + X + Instagram", "All (LinkedIn, X, Instagram, Facebook, TikTok script)"],
        required: true,
      },
      {
        name: "angle",
        label: "Angle",
        type: "select",
        options: ["Teach something useful", "Share a contrarian take", "Tell a story", "Announce news", "Behind the scenes"],
        required: true,
      },
      NOTES_FIELD,
    ],
    instruction: (i) =>
      `Write a social pack around a single idea, rewritten natively for each platform. Do not paste the same text everywhere: each platform gets copy that suits how people actually read there.

Topic: ${i.topic}
Platforms: ${i.platforms}
Angle: ${i.angle}

For each platform use a "## Platform" heading, then:
- LinkedIn: 120-200 words. A specific opening line that earns the "see more" click. Line breaks between short paragraphs. No hashtag soup: at most three, at the end.
- X: a 3-5 post thread. Each post under 280 characters. The first post must stand alone as a complete thought.
- Instagram: a caption of 80-150 words, plus a separate line describing the image or carousel, plus 8-12 hashtags mixing broad and niche.
- Facebook: 60-120 words, conversational, ending with a question that invites a real reply.
- TikTok: a 30-second script with timestamps, an on-screen text overlay for each beat, and a spoken hook in the first three seconds.

Only produce the platforms requested above. After all posts, add a "## Posting notes" section with the best time to post and one suggestion for repurposing.${extras(i)}`,
  },

  {
    id: "ad-copy",
    name: "Ad copy",
    icon: "🎯",
    category: "Ads",
    blurb: "Paid ad variants built for testing, not for vibes.",
    format: "markdown",
    maxTokens: 8000,
    fields: [
      {
        name: "product",
        label: "What are you advertising?",
        type: "textarea",
        placeholder: "Our onboarding service for clinics switching from paper scheduling.",
        required: true,
      },
      {
        name: "channel",
        label: "Channel",
        type: "select",
        options: ["Google Search", "Meta (Facebook/Instagram)", "LinkedIn", "All three"],
        required: true,
      },
      {
        name: "stage",
        label: "Funnel stage",
        type: "select",
        options: ["Cold traffic", "Retargeting", "Bottom of funnel / high intent"],
        required: true,
      },
      NOTES_FIELD,
    ],
    instruction: (i) =>
      `Write paid ad copy designed to be A/B tested.

Product: ${i.product}
Channel: ${i.channel}
Funnel stage: ${i.stage}

Respect these hard limits exactly and state the character count in parentheses after each line:
- Google Search: 10 headlines (max 30 chars each), 4 descriptions (max 90 chars each).
- Meta: 5 primary texts (max 125 chars before truncation), 5 headlines (max 40 chars), 3 link descriptions (max 30 chars).
- LinkedIn: 4 intro texts (max 150 chars), 4 headlines (max 70 chars).

Each variant must test a genuinely different angle, not a reworded version of the same one. Label each with the angle it tests, for example [pain], [outcome], [objection], [social proof], [specificity], [urgency].

Finish with a "## Test plan" section: which two variants to run first, what result would tell you the angle is working, and what to change next.${extras(i)}`,
  },

  {
    id: "blog-post",
    name: "Blog post",
    icon: "📝",
    category: "Content",
    blurb: "A search-aware article that is actually worth reading.",
    format: "markdown",
    maxTokens: 24000,
    fields: [
      {
        name: "topic",
        label: "Topic or working title",
        type: "textarea",
        placeholder: "How small clinics can cut no-shows without hiring a receptionist",
        required: true,
      },
      {
        name: "keyword",
        label: "Primary keyword (optional)",
        type: "text",
        placeholder: "reduce patient no-shows",
      },
      {
        name: "length",
        label: "Length",
        type: "select",
        options: ["800-1,000 words", "1,200-1,600 words", "2,000-2,500 words"],
        required: true,
      },
      {
        name: "depth",
        label: "Reader",
        type: "select",
        options: ["Beginner, needs the basics", "Practitioner, wants specifics", "Expert, wants depth and nuance"],
        required: true,
      },
      NOTES_FIELD,
    ],
    instruction: (i) =>
      `Write a complete blog post in markdown.

Topic: ${i.topic}
${i.keyword ? `Primary keyword: ${i.keyword}. Use it in the title, the first 100 words, and two or three H2s. Never at the cost of a sentence reading naturally.\n` : ""}Target length: ${i.length}
Written for: ${i.depth}

Requirements:
- Open with a specific situation or observation. No "in today's world", no dictionary definition, no restating the title.
- Use H2 and H3 headings that a reader could skim and still get the argument.
- Every major claim gets support: an example, a walkthrough, a number, or a named tradeoff. Where a real citation is needed and you do not have one, write [source needed: what to cite] rather than inventing it.
- Include at least one concrete worked example and at least one table or checklist where it genuinely helps.
- Acknowledge one real limitation or counter-argument. Articles that only argue one side read as marketing.
- End with a short section on what to do next, then a single natural call to action.

Start the output with the title as an H1. After the post, add a "---" rule followed by a "## Meta" section containing a proposed URL slug, a meta description of 150-160 characters, and three suggested internal link targets described generically.${extras(i)}`,
  },

  {
    id: "cold-email",
    name: "Outbound sequence",
    icon: "📮",
    category: "Email",
    blurb: "A four-touch cold sequence that does not read like a template.",
    format: "markdown",
    maxTokens: 8000,
    fields: [
      {
        name: "target",
        label: "Who are you emailing?",
        type: "textarea",
        placeholder: "Practice managers at private clinics with 3-10 staff, currently using paper or spreadsheet scheduling.",
        required: true,
      },
      {
        name: "trigger",
        label: "Why now? (the hook)",
        type: "textarea",
        placeholder: "They just posted a job ad for a front-desk coordinator.",
      },
      {
        name: "ask",
        label: "The ask",
        type: "select",
        options: ["15-minute call", "Reply with interest", "Try the free tier", "Watch a 2-minute demo"],
        required: true,
      },
      NOTES_FIELD,
    ],
    instruction: (i) =>
      `Write a four-email cold outbound sequence.

Target: ${i.target}
${i.trigger ? `Trigger or hook: ${i.trigger}\n` : ""}The ask: ${i.ask}

Rules that matter more than anything else here:
- Every email under 120 words. Email one under 90.
- No "I hope this email finds you well", no "I wanted to reach out", no "quick question" as a subject line, no fake familiarity, no flattery about their website.
- The first sentence must be about them, not about you or your company.
- One ask per email, and the same ask throughout the sequence. Do not escalate to a harder ask.
- Each follow-up must add a new piece of information or a different angle. Never write "just bumping this to the top of your inbox".
- Email four is a genuine break-up email that makes it easy to say no and leaves the door open.

For each email give: "### Email N — day X", then Subject, then the body, then a one-line note on what this email is testing. Use [merge fields] like [first_name] and [company] where personalisation belongs.

End with a "## Personalisation checklist" of the three things a rep must look up before sending, and a note on what to do if someone replies with an objection.${extras(i)}`,
  },

  {
    id: "launch-kit",
    name: "Launch kit",
    icon: "🚀",
    category: "Content",
    blurb: "Everything you need to announce something, in one pass.",
    format: "markdown",
    maxTokens: 24000,
    fields: [
      {
        name: "what",
        label: "What are you launching?",
        type: "textarea",
        placeholder: "Scheduled reports: automatic weekly summaries emailed to clinic owners every Monday.",
        required: true,
      },
      {
        name: "why",
        label: "Why does it matter to customers?",
        type: "textarea",
        placeholder: "Owners were logging in on Sunday nights to pull numbers by hand before their Monday meeting.",
        required: true,
      },
      {
        name: "date",
        label: "Launch date",
        type: "text",
        placeholder: "12 March",
      },
      NOTES_FIELD,
    ],
    instruction: (i) =>
      `Produce a complete launch kit for one announcement. Every piece must tell the same story with the same core message, sized for its channel.

Launching: ${i.what}
Why it matters: ${i.why}
${i.date ? `Launch date: ${i.date}\n` : ""}
Produce these sections, each under an H2:

## Positioning statement
Two sentences. What it is, who it is for, and what it replaces.

## Announcement email
Subject line, preheader, and a body under 250 words.

## Changelog entry
Factual, 80-120 words, written for existing users who want to know what changed.

## Social posts
One LinkedIn post and one X thread of three posts.

## Website banner
Headline under 60 characters plus a CTA under 20 characters.

## In-app message
A title under 40 characters and body under 200 characters, aimed at a user who is mid-task.

## Press blurb
100 words in third person, plus one quote attributed to [Name, Title] that says something specific rather than "we are excited".

## FAQ
Five questions real customers will ask, including at least one uncomfortable one (pricing, migration, or what it does not do), with honest answers.${extras(i)}`,
  },

  {
    id: "content-calendar",
    name: "Content calendar",
    icon: "🗓️",
    category: "Planning",
    blurb: "Four weeks of planned content with angles, not just titles.",
    format: "markdown",
    maxTokens: 16000,
    fields: [
      {
        name: "goal",
        label: "What should this month's content achieve?",
        type: "textarea",
        placeholder: "Build awareness with clinic managers who don't know scheduling software is affordable for them.",
        required: true,
      },
      {
        name: "channels",
        label: "Channels in play",
        type: "text",
        placeholder: "LinkedIn, newsletter, blog",
        required: true,
      },
      {
        name: "cadence",
        label: "Cadence",
        type: "select",
        options: ["Light (2 posts/week)", "Steady (4 posts/week)", "Aggressive (daily)"],
        required: true,
      },
      NOTES_FIELD,
    ],
    instruction: (i) =>
      `Build a four-week content calendar.

Goal: ${i.goal}
Channels: ${i.channels}
Cadence: ${i.cadence}

Start with a "## Themes" section: one theme per week, each with a sentence explaining how it moves the goal forward.

Then one table per week with these columns: Day | Channel | Format | Working title | Angle | CTA. The angle column must say what makes the piece worth reading, not restate the title.

Rules:
- Roughly 70% of pieces should be useful on their own without mentioning the product. Mark promotional pieces with [promo].
- Reuse deliberately: at least three pieces should be derived from another piece in the calendar. Note the source in the angle column.
- Match the requested cadence exactly.

Finish with "## Production notes": which three pieces to write first, what could be batched in one sitting, and the one metric to watch this month.${extras(i)}`,
  },
];

export const GENERATOR_MAP: Record<string, Generator> = Object.fromEntries(
  GENERATORS.map((g) => [g.id, g]),
);

export function getGenerator(id: string): Generator | null {
  return GENERATOR_MAP[id] ?? null;
}

/**
 * Validates submitted inputs against a generator's field list.
 * Returns cleaned inputs, or an error message naming the first problem.
 */
export function validateInputs(
  generator: Generator,
  raw: unknown,
): { ok: true; inputs: Record<string, string> } | { ok: false; error: string } {
  if (typeof raw !== "object" || raw === null) {
    return { ok: false, error: "Inputs must be an object." };
  }
  const source = raw as Record<string, unknown>;
  const inputs: Record<string, string> = {};

  for (const field of generator.fields) {
    const value = source[field.name];
    const text = typeof value === "string" ? value.trim() : "";

    if (field.required && !text) {
      return { ok: false, error: `"${field.label}" is required.` };
    }
    if (text.length > 5000) {
      return { ok: false, error: `"${field.label}" is too long (max 5,000 characters).` };
    }
    if (field.type === "select" && text && !field.options?.includes(text)) {
      return { ok: false, error: `"${text}" is not a valid option for "${field.label}".` };
    }
    inputs[field.name] = text;
  }
  return { ok: true, inputs };
}

/** Human-readable title for the saved asset. */
export function deriveTitle(
  generator: Generator,
  inputs: Record<string, string>,
): string {
  const firstField = generator.fields.find((f) => f.required);
  const seed = (firstField ? inputs[firstField.name] : "") || generator.name;
  const clean = seed.replace(/\s+/g, " ").trim();
  return clean.length > 70 ? `${clean.slice(0, 67)}...` : clean;
}
