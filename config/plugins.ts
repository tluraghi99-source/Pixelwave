import type { Core } from '@strapi/strapi';

const allowedMediaTypes = [
  'image/*',
  'video/*',
  'audio/*',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.*',
  'text/plain',
  'text/csv',
];

const deniedTypes = [
  'image/svg+xml',
  'application/vnd.microsoft.portable-executable',
  'application/x-msdownload',
  'application/x-msdos-program',
  'application/x-executable',
  'application/x-dosexec',
  'application/x-sh',
  'text/x-shellscript',
  'application/x-mach-binary',
];

const config = ({ env }: Core.Config.Shared.ConfigParams): Core.Config.Plugin => ({
  'users-permissions': {
    config: {
      jwtManagement: 'refresh',
      sessions: {
        httpOnly: true,
      },
    },
  },
  upload: {
    config: {
      security: {
        allowedTypes: allowedMediaTypes,
        deniedTypes,
      },
    },
  },
  // Gmail/Google Workspace SMTP — used by src/index.ts's afterCreate
  // lifecycle hook (on contact-submission/careers-application) to email new
  // submissions to MAIL_TO. Needs a Google "App Password" for SMTP_USERNAME
  // (2-Step Verification must be on for that account), not its real login
  // password — generate one at myaccount.google.com/apppasswords. All
  // SMTP_*/MAIL_TO vars go in .env (gitignored), never here.
  //
  // connectionTimeout/greetingTimeout/socketTimeout: nodemailer's own
  // default is a very long (effectively unbounded) wait — confirmed live,
  // a submission with SMTP_USERNAME/PASSWORD unset (or wrong) took 75s to
  // fail. The email send itself doesn't block the form response (see the
  // lifecycle hook, which fires it without awaiting), but a bounded
  // timeout still keeps a misconfigured/unreachable SMTP server from
  // leaving connections hanging indefinitely in the background.
  email: {
    config: {
      provider: 'nodemailer',
      providerOptions: {
        host: env('SMTP_HOST', 'smtp.gmail.com'),
        port: env.int('SMTP_PORT', 465),
        secure: env.bool('SMTP_SECURE', true),
        auth: {
          user: env('SMTP_USERNAME'),
          pass: env('SMTP_PASSWORD'),
        },
        connectionTimeout: 10000,
        greetingTimeout: 10000,
        socketTimeout: 10000,
      },
      settings: {
        defaultFrom: env('SMTP_USERNAME'),
        defaultReplyTo: env('SMTP_USERNAME'),
      },
    },
  },
});

export default config;
