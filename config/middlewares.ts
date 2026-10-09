import type { Core } from '@strapi/strapi';

const corsOrigins = (process.env.CORS_ORIGINS ?? '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const config: Core.Config.Middlewares = [
  'strapi::logger',
  'strapi::errors',
  'strapi::security',
  // Open to any origin unless CORS_ORIGINS is set (comma-separated list) —
  // production should set it to the real site, e.g. https://pixelwave.it.
  { name: 'strapi::cors', config: corsOrigins.length > 0 ? { origin: corsOrigins } : {} },
  // Temporary workaround for the Media Library listing 404 on the server's MySQL.
  'global::media-library-folder-filter',
  'strapi::poweredBy',
  'strapi::query',
  'strapi::body',
  'strapi::session',
  'strapi::favicon',
  'strapi::public',
];

export default config;
