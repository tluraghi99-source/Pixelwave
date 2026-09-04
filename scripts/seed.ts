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
const fs = require('fs');
const path = require('path');

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
    bodyDescription: 'Identity and site for a renewable-energy startup.',
    heroMediaType: 'image',
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
    bodyDescription: 'A storefront that moves — fluid product reveals.',
    heroMediaType: 'image',
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
    bodyDescription: 'Editorial platform for a culture magazine.',
    heroMediaType: 'image',
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
    bodyDescription: 'Digital banking platform redesigned for clarity and trust.',
    heroMediaType: 'image',
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
    bodyDescription: 'Brand system and packaging for a specialty coffee roaster.',
    heroMediaType: 'image',
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
    bodyDescription: 'Motion-first site for an independent record label.',
    heroMediaType: 'image',
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
    bodyDescription: 'Portfolio and booking platform for a film production house.',
    heroMediaType: 'image',
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
    bodyDescription: 'Telehealth product design and front-end build.',
    heroMediaType: 'image',
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
    bodyDescription: 'E-commerce experience for a coastal home goods brand.',
    heroMediaType: 'image',
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
    bodyDescription: 'Data dashboard design system for an enterprise SaaS.',
    heroMediaType: 'image',
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

// Transcribed from 000_sito/src/data/clients.ts — CLIENTS array (27
// entries, re-checked against the live file on 2026-09-03). `order` is the
// entry's 1-based position in the source array. `logoFile` names the file
// under scripts/seed-assets/clients/ to upload for this entry, or null for
// the clients that render as a text logotype (no real logo asset exists).
const CLIENT_LOGOS = [
  { name: 'Inter', order: 1, logoFile: 'inter.svg' },
  { name: 'Adidas', order: 2, logoFile: 'adidas.svg' },
  { name: 'Red Bull', order: 3, logoFile: 'redbull.svg' },
  { name: 'Style Magazine', order: 4, logoFile: null },
  { name: '1000 Miglia', order: 5, logoFile: '1000miglia.svg' },
  { name: 'Gattinoni Group', order: 6, logoFile: null },
  { name: 'Ford', order: 7, logoFile: 'ford.svg' },
  { name: 'ABmedica', order: 8, logoFile: null },
  { name: 'Snakes Milano', order: 9, logoFile: null },
  { name: 'Quattroruote', order: 10, logoFile: 'quattroruote.svg' },
  { name: "L'Isola del Gusto", order: 11, logoFile: null },
  { name: "Men's Health", order: 12, logoFile: 'menshealth.svg' },
  { name: 'Deejay', order: 13, logoFile: 'deejay.svg' },
  { name: 'STS Communication', order: 14, logoFile: null },
  { name: 'Milano Cortina 2026', order: 15, logoFile: 'milanocortina2026.svg' },
  { name: 'Campari', order: 16, logoFile: 'campari.svg' },
  { name: 'Marelli', order: 17, logoFile: 'marelli.svg' },
  { name: 'Nike', order: 18, logoFile: 'nike.svg' },
  { name: 'BNP Paribas', order: 19, logoFile: 'bnpparibas.svg' },
  { name: 'Alfa Romeo', order: 20, logoFile: null },
  { name: 'Maserati', order: 21, logoFile: 'maserati.svg' },
  { name: 'Satispay', order: 22, logoFile: 'satispay.svg' },
  { name: 'Coca-Cola', order: 23, logoFile: 'cocacola.svg' },
  { name: 'UniCredit Bank', order: 24, logoFile: 'unicredit.svg' },
  { name: 'Generali', order: 25, logoFile: 'generali.svg' },
  { name: 'immobiliare.it', order: 26, logoFile: null },
  { name: 'Allianz', order: 27, logoFile: 'allianz.svg' },
];

// Uploads one local SVG file through Strapi's upload plugin service and
// returns the created file record's numeric id, ready to assign directly
// to a `media` attribute (Strapi v5's document service accepts either a
// raw file object with `.id` or the bare id for a single-media field —
// confirmed against the installed 5.52.2 source,
// node_modules/@strapi/core/dist/services/document-service/internationalization.mjs's
// normalizeMediaIds: `value && typeof value === 'object' && 'id' in value
// ? value.id : value`).
async function uploadClientLogo(app: any, filename: string) {
  const filePath = path.join(__dirname, 'seed-assets', 'clients', filename);
  const { size } = fs.statSync(filePath);
  const uploadService = app.plugin('upload').service('upload');
  const [uploaded] = await uploadService.upload({
    data: {},
    files: {
      filepath: filePath,
      originalFilename: filename,
      mimetype: 'image/svg+xml',
      size,
    },
  });
  return uploaded.id;
}

async function run() {
  const appContext = await compileStrapi();
  const app = await createStrapi(appContext).load();

  for (const project of PROJECTS) {
    await app.documents('api::project.project').create({ data: project, status: 'published' });
  }

  for (const member of TEAM_MEMBERS) {
    await app.documents('api::team-member.team-member').create({ data: member, status: 'published' });
  }

  for (const client of CLIENT_LOGOS) {
    const logoId = client.logoFile ? await uploadClientLogo(app, client.logoFile) : undefined;
    await app.documents('api::client-logo.client-logo').create({
      data: { name: client.name, order: client.order, ...(logoId ? { logo: logoId } : {}) },
      status: 'published',
    });
  }

  console.log(
    `Seeded ${PROJECTS.length} projects, ${TEAM_MEMBERS.length} team members, and ${CLIENT_LOGOS.length} client logos.`
  );
  await app.destroy();
  process.exit(0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
