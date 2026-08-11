# Kuzeykale Construction Website & Mobile CMS

A production-oriented React Router 8 and Express website for Kuzeykale İnşaat. The public site preserves the legacy content structure while providing a modern design, project galleries, local SEO, conversion forms and a mobile-friendly content/lead-management panel.

## Included

- Multi-page public site with corporate, service, project-category, project-detail, gallery, news and contact routes
- CMS-managed branding, hero, services, news, projects, team, statistics, testimonials and documents
- Draft, preview and publish workflow
- Automatic content backups and restore controls
- Secure cookie sessions, hashed admin password support, rate limiting and security headers
- Optimized WebP generation for uploaded images; originals are retained
- Lightweight CRM with stages, notes, assigned staff, callback reminders, phone/WhatsApp actions and CSV export
- Optional SMTP notification for new leads
- Route-aware metadata, Open Graph tags, structured data, dynamic sitemap and robots file
- Docker/Coolify deployment with a health check

## Local development

Requires Node 22.22 or newer.

```bash
npm install
cp .env.example .env
npm run dev
```

For local HTTP development use `COOKIE_SECURE=false`. Vite runs at `http://localhost:5173`; Express runs at `http://localhost:3001`.

## Create the admin password hash

```bash
npm run hash-password -- 'a-long-unique-password'
```

Copy the output into `ADMIN_PASSWORD_HASH`. The plain `ADMIN_PASSWORD` environment variable remains a development fallback but should not be used in production.

## Coolify deployment

1. Create an application from the repository and select the Dockerfile build pack.
2. Expose container port `3001`.
3. Add all required values from `.env.example`.
4. Mount persistent storage at `/app/data`. This contains published content, drafts, leads, backups, originals and optimized uploads.
5. Set `PUBLIC_URL` to the final HTTPS domain and keep `COOKIE_SECURE=true`.
6. Connect the domain and allow Coolify to provision HTTPS.

The CMS is available at `/admin`. The sitemap is `/sitemap.xml`, robots directives are at `/robots.txt`, and the health endpoint is `/api/health`.

## Email notifications

Set the `SMTP_*` and `LEAD_NOTIFICATION_EMAIL` variables to notify the office when a new quote request arrives. Without these variables, lead collection continues normally and the CMS clearly reports that email notifications are not configured.

## Backup behavior

The server creates a backup immediately before each publish or restore operation and retains the latest 30 content backups. Persistent storage is mandatory in production; container-local files alone will be replaced during redeployment.
