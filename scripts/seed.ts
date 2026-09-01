// One-off seed script: populates api::project.project and
// api::team-member.team-member from 000_sito's current
// src/data/work.ts (PROJECTS) and src/data/team.ts (TEAM) so the two
// content-types have real starter content instead of empty tables.
//
// Run with: node scripts/seed.ts (or: npm run seed)
// (Node 22.18+/23.6+'s native TypeScript support strips the types; no
// ts-node/tsx needed. Re-run only with awareness that it is NOT idempotent
// — it always creates new rows, so running it twice duplicates all
// entries.)
//
// Draft & Publish is enabled on both content-types, so `.create()` alone
// would only create a draft — invisible to the public find/findOne API,
// which defaults to returning published entries only. Passing
// `status: 'published'` to `.create()` makes the document service create
// the draft and then immediately publish it in the same call (confirmed
// against the installed 5.52.2 source,
// node_modules/@strapi/core/dist/services/document-service/repository.mjs:
// `create()` always writes a draft first, then — only when
// `hasDraftAndPublish && params.status === 'published'` — calls the
// internal `publish()` on the new document before returning it).
//
// Programmatic-boot API note: the task's draft plan guessed
// `import strapi from '@strapi/strapi'` with
// `strapi({ distDir: './dist' }).load()`. That guess does not match the
// installed 5.52.2 package:
//   - `@strapi/strapi` (and the `@strapi/core` package it re-exports) has
//     NO default export. The real exports are the named
//     `createStrapi(options?)` and `compileStrapi(options?)` functions.
//   - `createStrapi` returns a Strapi instance synchronously; `.load()`
//     (called on that instance) is what's async.
//   - Booting also needs `appDir`/`distDir`, which are produced by first
//     calling `compileStrapi()` (it compiles the TS project if needed and
//     resolves the output directory) rather than hardcoding `./dist`.
// This mirrors exactly what Strapi's own `strapi console` CLI command does
// (node_modules/@strapi/strapi/dist/src/cli/commands/console.js):
//     const appContext = await compileStrapi();
//     const app = await createStrapi(appContext).load();
//
// Using `require(...)` rather than `import ... from`: package.json has no
// `"type": "module"`, so Node's native TS runner defaults this file to
// CommonJS as long as it sees no ESM import/export syntax. That matters
// here — Strapi's own CLI commands load it the same way (via `require`),
// and going through Node's ESM resolver instead trips
// ERR_UNSUPPORTED_DIR_IMPORT on a transitive `lodash/fp` deep import
// inside @strapi/core that only resolves under CommonJS/webpack rules.
const { compileStrapi, createStrapi } = require('@strapi/strapi');

// Transcribed from 000_sito/src/data/work.ts — PROJECTS array (10 entries,
// re-checked against the live file on 2026-09-01; unchanged from the plan's
// transcription). Tag tuples [TagVariant, string] become
// { label, highlighted: variant === "orange" }. `order` is the tuple's
// 1-based position in the source array (source has no explicit order
// field).
const PROJECTS = [
  {
    title: 'Northwind',
    slug: 'northwind',
    description: 'Identity and site for a renewable-energy startup.',
    client: 'Inter',
    year: 2025,
    order: 1,
    tags: [
      { label: 'Featured', highlighted: true },
      { label: 'Web', highlighted: false },
      { label: 'Brand', highlighted: false },
    ],
  },
  {
    title: 'Tidal Commerce',
    slug: 'tidal-commerce',
    description: 'A storefront that moves — fluid product reveals.',
    client: 'Red Bull',
    year: 2025,
    order: 2,
    tags: [
      { label: 'Motion', highlighted: false },
      { label: 'Dev', highlighted: false },
    ],
  },
  {
    title: 'Solstice',
    slug: 'solstice',
    description: 'Editorial platform for a culture magazine.',
    client: 'Isola del Gusto',
    year: 2024,
    order: 3,
    tags: [
      { label: 'Web', highlighted: false },
      { label: 'CMS', highlighted: false },
    ],
  },
  {
    title: 'Meridian Bank',
    slug: 'meridian-bank',
    description: 'Digital banking platform redesigned for clarity and trust.',
    client: 'Maserati',
    year: 2024,
    order: 4,
    tags: [
      { label: 'Web', highlighted: false },
      { label: 'UX', highlighted: false },
    ],
  },
  {
    title: 'Glasswing',
    slug: 'glasswing',
    description: 'Brand system and packaging for a specialty coffee roaster.',
    client: 'Inter',
    year: 2023,
    order: 5,
    tags: [
      { label: 'Featured', highlighted: true },
      { label: 'Brand', highlighted: false },
      { label: 'Packaging', highlighted: false },
    ],
  },
  {
    title: 'Nightfall Records',
    slug: 'nightfall-records',
    description: 'Motion-first site for an independent record label.',
    client: 'Red Bull',
    year: 2023,
    order: 6,
    tags: [
      { label: 'Motion', highlighted: false },
      { label: 'Web', highlighted: false },
    ],
  },
  {
    title: 'Arclight Studios',
    slug: 'arclight-studios',
    description: 'Portfolio and booking platform for a film production house.',
    client: 'Isola del Gusto',
    year: 2022,
    order: 7,
    tags: [
      { label: 'Web', highlighted: false },
      { label: 'Dev', highlighted: false },
    ],
  },
  {
    title: 'Halcyon Health',
    slug: 'halcyon-health',
    description: 'Telehealth product design and front-end build.',
    client: 'Maserati',
    year: 2022,
    order: 8,
    tags: [
      { label: 'UX', highlighted: false },
      { label: 'Dev', highlighted: false },
    ],
  },
  {
    title: 'Driftwood Market',
    slug: 'driftwood-market',
    description: 'E-commerce experience for a coastal home goods brand.',
    client: 'Inter',
    year: 2021,
    order: 9,
    tags: [
      { label: 'Featured', highlighted: true },
      { label: 'Web', highlighted: false },
      { label: 'CMS', highlighted: false },
    ],
  },
  {
    title: 'Vantage Analytics',
    slug: 'vantage-analytics',
    description: 'Data dashboard design system for an enterprise SaaS.',
    client: 'Red Bull',
    year: 2021,
    order: 10,
    tags: [
      { label: 'UX', highlighted: false },
      { label: 'Design System', highlighted: false },
    ],
  },
];

// Transcribed from 000_sito/src/data/team.ts — TEAM array (14 entries,
// re-checked against the live file on 2026-09-01; unchanged from the
// plan's transcription). `order` is the entry's 1-based position in the
// source array (source has no explicit order field).
const TEAM_MEMBERS = [
  { name: 'Mara Lindqvist', role: 'Founder & Creative Director', order: 1 },
  { name: 'Theo Castellano', role: 'Head of Design', order: 2 },
  { name: 'Priya Nandakumar', role: 'Senior Product Designer', order: 3 },
  { name: 'Owen Fairweather', role: 'UX Designer', order: 4 },
  { name: 'Ines Duarte', role: 'Brand Designer', order: 5 },
  { name: 'Kai Sørensen', role: 'Motion Designer', order: 6 },
  { name: 'Marcus Ade', role: 'Lead Developer', order: 7 },
  { name: 'Lena Vogt', role: 'Front-end Developer', order: 8 },
  { name: 'Diego Marín', role: 'Front-end Developer', order: 9 },
  { name: 'Sasha Petrova', role: 'Backend Developer', order: 10 },
  { name: 'Noor El-Amin', role: 'Photographer', order: 11 },
  { name: 'Jonas Reyes', role: 'Video Editor', order: 12 },
  { name: 'Freya Lindgren', role: 'Project Manager', order: 13 },
  { name: 'Tomás Silveira', role: 'Studio Manager', order: 14 },
];

async function run() {
  const appContext = await compileStrapi();
  const app = await createStrapi(appContext).load();

  for (const project of PROJECTS) {
    await app.documents('api::project.project').create({ data: project, status: 'published' });
  }

  for (const member of TEAM_MEMBERS) {
    await app.documents('api::team-member.team-member').create({ data: member, status: 'published' });
  }

  console.log(`Seeded ${PROJECTS.length} projects and ${TEAM_MEMBERS.length} team members.`);
  await app.destroy();
  process.exit(0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
