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
      // single type: only `find` exists (there is no findOne / no id).
      'api::showreel.showreel.find',
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

    // Public address of the PixelWave logo used in the email header (a PNG:
    // email clients don't render SVG). The file lives in the website's
    // public/email folder, so it is served by the site itself.
    const EMAIL_LOGO_URL =
      process.env.EMAIL_LOGO_URL || 'https://pixelwave.it/email/logo-pixelwave-white.png';

    // Inline-styled table layout — email clients ignore <style> blocks and
    // modern CSS, so this is the one format that renders consistently.
    // The black header band runs edge to edge across whatever width the mail
    // window/phone has (width:100%), with the logo aligned to the same 960px
    // column as the content card below it, which shrinks on narrow screens
    // (width:100% + max-width:960px). Row values are passed in already-escaped
    // (or as trusted markup).
    function renderEmailHtml(title: string, rows: Array<[string, string]>, note?: string) {
      const rowsHtml = rows
        .map(
          ([label, value]) => `
            <tr>
              <td style="padding:14px 0;border-bottom:1px solid #e5e5e5;width:170px;vertical-align:top;font-family:Menlo,Consolas,monospace;font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:#808080;">${escapeHtml(label)}</td>
              <td style="padding:14px 0;border-bottom:1px solid #e5e5e5;vertical-align:top;font-family:Helvetica,Arial,sans-serif;font-size:15px;color:#000000;">${value}</td>
            </tr>`
        )
        .join('');

      return `<!doctype html>
<html lang="it">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
  </head>
  <body style="margin:0;padding:0;background:#f5f5f5;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;background:#000000;border-bottom:4px solid #FF5B00;">
      <tr>
        <td align="center" style="padding:28px 24px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;max-width:960px;">
            <tr>
              <td align="left" style="padding:0 8px;">
                <img src="${escapeHtml(EMAIL_LOGO_URL)}" alt="PixelWave" width="150" style="display:block;border:0;outline:none;width:150px;max-width:100%;height:auto;font-family:Helvetica,Arial,sans-serif;font-size:20px;font-weight:700;color:#ffffff;">
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;background:#f5f5f5;">
      <tr>
        <td align="center" style="padding:24px 16px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;max-width:960px;background:#ffffff;">
            <tr>
              <td style="padding:32px;">
                <h1 style="margin:0 0 20px;font-family:Helvetica,Arial,sans-serif;font-size:22px;color:#000000;">${escapeHtml(title)}</h1>
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rowsHtml}</table>
                ${note ? `<p style="margin:24px 0 0;font-family:Helvetica,Arial,sans-serif;font-size:13px;color:#666666;">${escapeHtml(note)}</p>` : ''}
              </td>
            </tr>
          </table>
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
        subject: `Nuova richiesta di progetto da ${result.name}`,
        text: [
          `Nome: ${result.name}`,
          `Email: ${result.email}`,
          `Telefono: ${result.phone || '—'}`,
          `Tipo di progetto: ${projectTypes}`,
          `Tempi: ${result.timeline || '—'}`,
        ].join('\n'),
        html: renderEmailHtml(
          'Nuova richiesta di progetto',
          [
            ['Nome', escapeHtml(result.name)],
            ['Email', mailtoLink(result.email)],
            [
              'Telefono',
              result.phone
                ? `<a href="tel:${escapeHtml(result.phone)}" style="color:#FF5B00;text-decoration:none;">${escapeHtml(result.phone)}</a>`
                : '—',
            ],
            ['Tipo di progetto', escapeHtml(projectTypes)],
            ['Tempi', escapeHtml(result.timeline || '—')],
          ],
          'Rispondi a questa email per rispondere direttamente.'
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
        subject: `Nuova candidatura: ${result.role} — ${result.name} ${result.surname}`,
        text: [
          `Nome: ${result.name} ${result.surname}`,
          `Email: ${result.email}`,
          `Telefono: ${result.phone}`,
          `Ruolo: ${result.role}`,
          attachments.length > 0 ? 'CV: allegato (non conservato sul server)' : 'CV: impossibile allegarlo, controlla il pannello admin.',
        ].join('\n'),
        html: renderEmailHtml(
          'Nuova candidatura',
          [
            ['Nome', escapeHtml(`${result.name} ${result.surname}`)],
            ['Email', mailtoLink(result.email)],
            ['Telefono', `<a href="tel:${escapeHtml(result.phone)}" style="color:#FF5B00;text-decoration:none;">${escapeHtml(result.phone)}</a>`],
            ['Ruolo', escapeHtml(result.role)],
            ['CV', attachments.length > 0 ? 'Allegato a questa email (non conservato sul server)' : 'Impossibile allegarlo: controlla il pannello admin'],
          ],
          'Rispondi a questa email per rispondere direttamente.'
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
