// import type { Core } from '@strapi/strapi';

export default {
  /**
   * An asynchronous register function that runs before
   * your application is initialized.
   *
   * This gives you an opportunity to extend code.
   */
  register(/* { strapi }: { strapi: Core.Strapi } */) {},

  /**
   * An asynchronous bootstrap function that runs before
   * your application gets started.
   *
   * This gives you an opportunity to set up your data model,
   * run jobs, or perform some special logic.
   */
  async bootstrap({ strapi }: { strapi: any }) {
    // Grant the Public role read-only (find/findOne) access to every
    // content-type the frontend fetches directly, so their REST endpoints
    // are reachable without authentication. Idempotent: only creates
    // a permission row if one doesn't already exist for that action.
    const publicRole = await strapi
      .query('plugin::users-permissions.role')
      .findOne({ where: { type: 'public' } });

    if (!publicRole) return;

    const actionsToEnable = [
      'api::project.project.find',
      'api::project.project.findOne',
      'api::team-member.team-member.find',
      'api::team-member.team-member.findOne',
      'api::client-logo.client-logo.find',
      'api::client-logo.client-logo.findOne',
      'api::work-category.work-category.find',
      'api::work-category.work-category.findOne',
      // create only (not find/findOne) — the /contact and /careers forms
      // submit directly to these, but nothing about past submissions
      // (someone else's name, email, CV) should ever be publicly readable.
      'api::contact-submission.contact-submission.create',
      'api::careers-application.careers-application.create',
    ];

    for (const action of actionsToEnable) {
      const existing = await strapi.query('plugin::users-permissions.permission').findOne({
        where: { action, role: publicRole.id },
      });
      if (!existing) {
        await strapi.query('plugin::users-permissions.permission').create({
          data: { action, role: publicRole.id },
        });
      }
    }

    // Email notification on every new contact/careers submission — see
    // config/plugins.ts for the SMTP provider setup and .env for
    // SMTP_USERNAME/SMTP_PASSWORD/MAIL_TO. Submissions are always saved
    // (the create call above already persisted it before this fires)
    // regardless of whether the email send itself succeeds, so nothing is
    // lost if MAIL_TO is unset or the SMTP credentials are wrong/missing —
    // it just logs a warning/error instead of sending.
    const CONTACT_UID = 'api::contact-submission.contact-submission';
    const CAREERS_UID = 'api::careers-application.careers-application';

    async function sendContactEmail(mailTo: string, result: any) {
      await strapi.plugin('email').service('email').send({
        to: mailTo,
        replyTo: result.email,
        subject: `New project inquiry from ${result.name}`,
        text: [
          `Name: ${result.name}`,
          `Email: ${result.email}`,
          `Project type: ${(result.projectTypes || []).join(', ') || '—'}`,
          `Timeline: ${result.timeline || '—'}`,
        ].join('\n'),
      });
    }

    async function sendCareersEmail(mailTo: string, result: any) {
      // afterCreate's own `result` doesn't populate media relations — fetch
      // the full row (with the CV) separately to attach it.
      const full = await strapi.db.query(CAREERS_UID).findOne({
        where: { id: result.id },
        populate: ['cv'],
      });

      const attachments = [];
      if (full?.cv?.url) {
        const fs = require('fs');
        const path = require('path');
        const filePath = path.join(strapi.dirs.static.public, full.cv.url);
        if (fs.existsSync(filePath)) {
          attachments.push({ filename: full.cv.name, content: fs.readFileSync(filePath) });
        }
      }

      await strapi.plugin('email').service('email').send({
        to: mailTo,
        replyTo: result.email,
        subject: `New job application: ${result.role} — ${result.name} ${result.surname}`,
        text: [
          `Name: ${result.name} ${result.surname}`,
          `Email: ${result.email}`,
          `Phone: ${result.phone}`,
          `Role: ${result.role}`,
          attachments.length > 0 ? 'CV: attached' : 'CV: could not be attached — check the admin panel.',
        ].join('\n'),
        attachments,
      });
    }

    strapi.db.lifecycles.subscribe({
      models: [CONTACT_UID, CAREERS_UID],
      // Deliberately not `async` / not awaited below — see the note above
      // config/plugins.ts's email timeouts: confirmed live that an SMTP
      // send attempt can take a long time to fail (misconfigured/
      // unreachable server), and afterCreate's return value is awaited by
      // the create call that triggered it. Awaiting the send here would
      // hold the form's own HTTP response hostage to that, on top of the
      // submission having already been safely saved by this point anyway.
      afterCreate(event: { result: any; model: { uid: string } }) {
        const { result, model } = event;
        const mailTo = process.env.MAIL_TO;
        if (!mailTo) {
          strapi.log.warn(`MAIL_TO is not set — skipping notification email for ${model.uid}`);
          return;
        }

        const send =
          model.uid === CONTACT_UID
            ? sendContactEmail(mailTo, result)
            : model.uid === CAREERS_UID
              ? sendCareersEmail(mailTo, result)
              : Promise.resolve();

        send.catch((err) => {
          strapi.log.error(`Failed to send notification email for ${model.uid}:`, err);
        });
      },
    });
  },
};
