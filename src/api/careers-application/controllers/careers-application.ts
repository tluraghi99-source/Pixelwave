import { factories } from '@strapi/strapi'

const REQUIRED_FIELDS = ['name', 'surname', 'email', 'phone', 'role'] as const

/** Overrides the auto-generated create() — confirmed live that the plain
 *  factory controller's create() only reads `ctx.request.body.data` as
 *  already-parsed JSON (`fp.isObject(body.data)`), which multipart/
 *  form-data submissions never satisfy (koa-body leaves a multipart
 *  "data" field as a raw string) — every attempt came back "Missing
 *  data payload" even with no file involved. The file itself also isn't
 *  something the default create() looks at (that's a content-manager-UI-
 *  specific flow, not the plain REST API's), so a required media field
 *  like `cv` needs to be uploaded and attached explicitly here instead. */
export default factories.createCoreController(
  'api::careers-application.careers-application',
  ({ strapi }) => ({
    async create(ctx) {
      const rawData = ctx.request.body?.data
      const data = typeof rawData === 'string' ? JSON.parse(rawData) : rawData

      if (!data || typeof data !== 'object') {
        return ctx.badRequest('Missing "data" payload in the request body')
      }
      for (const field of REQUIRED_FIELDS) {
        if (typeof data[field] !== 'string' || data[field].trim() === '') {
          return ctx.badRequest(`Missing or empty "${field}"`)
        }
      }

      // formidable (via koa-body) gives a single object for one file on a
      // field, but can give an array if the client sent more than one under
      // the same name — only the first is ever relevant for a single-CV field.
      const rawCv = ctx.request.files?.cv
      const cvFile = Array.isArray(rawCv) ? rawCv[0] : rawCv
      if (!cvFile) {
        return ctx.badRequest('Missing CV file (expected a "cv" file field)')
      }

      const [uploaded] = await strapi.plugin('upload').service('upload').upload({
        data: {},
        files: cvFile,
      })

      // Hand-picked whitelist, not the raw client payload — data could
      // technically carry any extra keys, and this is the only sanitization
      // that matters since every field here is a plain string the schema
      // itself will still validate on write.
      const entity = await strapi.service('api::careers-application.careers-application').create({
        data: {
          name: data.name,
          surname: data.surname,
          email: data.email,
          phone: data.phone,
          role: data.role,
          cv: uploaded.id,
        },
      })

      const sanitizedEntity = await this.sanitizeOutput!(entity, ctx)
      return this.transformResponse!(sanitizedEntity)
    },
  })
)
