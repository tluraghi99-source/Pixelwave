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

    const escapeHtml = (value: unknown) =>
      String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');

    // Inline-styled table layout — email clients ignore <style> blocks and
    // modern CSS, so this is the one format that renders consistently.
    // Row values are passed in already-escaped (or as trusted markup).
    function renderEmailHtml(title: string, rows: Array<[string, string]>, note?: string) {
      const rowsHtml = rows
        .map(
          ([label, value]) => `
            <tr>
              <td style="padding:14px 0;border-bottom:1px solid #e5e5e5;width:130px;vertical-align:top;font-family:Menlo,Consolas,monospace;font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:#808080;">${escapeHtml(label)}</td>
              <td style="padding:14px 0;border-bottom:1px solid #e5e5e5;vertical-align:top;font-family:Helvetica,Arial,sans-serif;font-size:15px;color:#000000;">${value}</td>
            </tr>`
        )
        .join('');

      return `<!doctype html>
<html>
  <body style="margin:0;padding:24px;background:#f5f5f5;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;background:#ffffff;">
      <tr>
        <td style="background:#000000;padding:24px 32px;border-bottom:4px solid #FF5B00;">
          <span style="font-family:Helvetica,Arial,sans-serif;font-size:20px;font-weight:700;color:#ffffff;">PixelWave</span>
        </td>
      </tr>
      <tr>
        <td style="padding:32px;">
          <h1 style="margin:0 0 20px;font-family:Helvetica,Arial,sans-serif;font-size:22px;color:#000000;">${escapeHtml(title)}</h1>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rowsHtml}</table>
          ${note ? `<p style="margin:24px 0 0;font-family:Helvetica,Arial,sans-serif;font-size:13px;color:#666666;">${escapeHtml(note)}</p>` : ''}
        </td>
      </tr>
    </table>
  </body>
</html>`;
    }

    const mailtoLink = (email: string) =>
      `<a href="mailto:${escapeHtml(email)}" style="color:#FF5B00;text-decoration:none;">${escapeHtml(email)}</a>`;

    async function sendContactEmail(mailTo: string, result: any) {
      const projectTypes = (result.projectTypes || []).join(', ') || '—';
      await strapi.plugin('email').service('email').send({
        to: mailTo,
        replyTo: result.email,
        subject: `New project inquiry from ${result.name}`,
        text: [
          `Name: ${result.name}`,
          `Email: ${result.email}`,
          `Phone: ${result.phone || '—'}`,
          `Project type: ${projectTypes}`,
          `Timeline: ${result.timeline || '—'}`,
        ].join('\n'),
        html: renderEmailHtml(
          'New project inquiry',
          [
            ['Name', escapeHtml(result.name)],
            ['Email', mailtoLink(result.email)],
            [
              'Phone',
              result.phone
                ? `<a href="tel:${escapeHtml(result.phone)}" style="color:#FF5B00;text-decoration:none;">${escapeHtml(result.phone)}</a>`
                : '—',
            ],
            ['Project type', escapeHtml(projectTypes)],
            ['Timeline', escapeHtml(result.timeline || '—')],
          ],
          'Reply to this email to answer directly.'
        ),
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
          attachments.length > 0 ? 'CV: attached (not kept on the server)' : 'CV: could not be attached — check the admin panel.',
        ].join('\n'),
        html: renderEmailHtml(
          'New job application',
          [
            ['Name', escapeHtml(`${result.name} ${result.surname}`)],
            ['Email', mailtoLink(result.email)],
            ['Phone', `<a href="tel:${escapeHtml(result.phone)}" style="color:#FF5B00;text-decoration:none;">${escapeHtml(result.phone)}</a>`],
            ['Role', escapeHtml(result.role)],
            ['CV', attachments.length > 0 ? 'Attached to this email (not kept on the server)' : 'Could not be attached — check the admin panel'],
          ],
          'Reply to this email to answer directly.'
        ),
        attachments,
      });

      // The CV only needs to live in the mailbox: once the email carrying it
      // has actually been sent, remove the uploaded copy (file + Media
      // Library entry) so personal data isn't kept on the server. Reached
      // only if send() above didn't throw — on a failed send the CV stays,
      // so the application can still be recovered from the admin panel.
      if (attachments.length > 0 && full?.cv) {
        try {
          await strapi.plugin('upload').service('upload').remove(full.cv);
        } catch (err) {
          strapi.log.error(`Sent the CV by email but could not delete the uploaded copy (file id ${full.cv.id}):`, err);
        }
      }
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
