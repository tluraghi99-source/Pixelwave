# Hand-off: manual steps

This CMS is scaffolded, its content-types are defined, public read access
is on, and it's seeded with your current site's Project/Team content. A
few things need your own account/browser and can't be done by an agent:

## Getting started

You've already created your Strapi admin account and can log in at
http://localhost:1337/admin by running `npm run develop` in this directory
and visiting that URL in your browser. This is the account you'll use to
log in and edit content going forward.

## 1. Verify the seeded content

Once logged in, check Content Manager → Project and Content Manager →
Team Member — you should see entries matching your site's current
project/team roster, with empty media fields (photos/hero images/gallery
images) waiting for you to upload real photography.

## 2. Push this repo to GitHub

This project is its own git repo (separate from your site's). Create a
new, empty GitHub repository and push this one to it:

    git remote add origin <your-new-repo-url>
    git push -u origin main

## 3. Connect it to Strapi Cloud

Go to https://cloud.strapi.io, create an account (or log in), and follow
their "Deploy an existing project" flow, pointing it at the GitHub repo
from step 2. Strapi Cloud will provision hosting and a production
database for you — this replaces the local SQLite database used so far.

**Important — production starts with an empty database.** The 24 seeded
entries you verified in step 1 live only in this machine's local
`.tmp/data.db`, which is gitignored and never pushed to GitHub — Strapi
Cloud provisions a brand-new, empty database for the deployed instance.
Left alone, the live CMS will show 0 projects and 0 team members. To get
the same content into production, either (a) re-run `npm run seed`
pointed at the production database, using the `DATABASE_CLIENT`/
`DATABASE_*` connection env vars Strapi Cloud shows you for the deployed
instance, or (b) use Strapi's built-in `npx strapi transfer` command to
copy content from your local instance to the remote one — it needs a
transfer token generated from the Strapi Cloud admin panel first; see
`npx strapi transfer --help` and Strapi's current docs for exact usage.

## 4. Note the production API URL

Once deployed, Strapi Cloud gives you a production URL (something like
`https://your-project.strapiapp.com`). That URL is what the site's
frontend integration (the next piece of this project) will be pointed at.
Keep it handy.
