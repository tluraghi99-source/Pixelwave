import type { Core } from '@strapi/strapi';

/** Workaround for the admin Media Library failing to open on the production
 *  MySQL install: its file list is requested with an extra
 *  `filters[$and][n][folder][id][$null]=true` ("files not in any folder"),
 *  and that request alone answers 404 there (the same request without the
 *  filter, and with it on a local MySQL 8, both answer 200).
 *
 *  This site has no Media Library folders, so every file is "not in a
 *  folder" and dropping the filter returns exactly the same list. If folders
 *  are ever created, the root view would then show every file, so remove this
 *  middleware (and its entry in config/middlewares.ts) once the real cause
 *  is fixed. */
const FOLDER_NULL_FILTER = /^filters\[\$and\]\[\d+\]\[folder\]\[id\]\[\$null\]$/;

export function stripFolderNullFilter(querystring: string): string {
  return querystring
    .split('&')
    .filter((pair) => {
      const key = pair.split('=')[0];
      try {
        return !FOLDER_NULL_FILTER.test(decodeURIComponent(key));
      } catch {
        return true;
      }
    })
    .join('&');
}

export default (_config: unknown, _opts: { strapi: Core.Strapi }) => {
  return async (ctx: any, next: () => Promise<void>) => {
    if (ctx.method === 'GET' && ctx.path === '/upload/files' && ctx.querystring.includes('folder')) {
      ctx.querystring = stripFolderNullFilter(ctx.querystring);
    }
    await next();
  };
};
