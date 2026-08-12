import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs/promises";
import fsSync from "node:fs";
import crypto from "node:crypto";
import multer from "multer";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
import sharp from "sharp";
import nodemailer from "nodemailer";

const app = express();
const port = process.env.PORT || 3001;
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dataDir = path.resolve(process.env.DATA_DIR || path.join(root, "data"));
const uploadsDir = path.join(dataDir, "uploads");
const originalsDir = path.join(uploadsDir, "originals");
const optimizedDir = path.join(uploadsDir, "optimized");
const backupsDir = path.join(dataDir, "backups");
const migrationBackupsDir = path.join(backupsDir, "migrations");
const contentFile = path.join(dataDir, "content.json");
const draftFile = path.join(dataDir, "draft.json");
const leadsFile = path.join(dataDir, "leads.json");
const sessions = new Map();
const sessionHours = Number(process.env.SESSION_HOURS || 8);

for (const directory of [dataDir, originalsDir, optimizedDir, backupsDir, migrationBackupsDir]) fsSync.mkdirSync(directory, { recursive: true });
app.set("trust proxy", 1);
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      frameSrc: ["'self'", "https://www.youtube.com", "https://youtube.com", "https://*.youtube.com", "https://www.youtube-nocookie.com", "https://*.youtube-nocookie.com", "https://www.google.com", "https://*.google.com"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      connectSrc: ["'self'"],
    },
  },
  referrerPolicy: { policy: "strict-origin-when-cross-origin" },
  crossOriginResourcePolicy: { policy: "cross-origin" },
}));
app.use(express.json({ limit: "2mb" }));
app.use("/uploads", express.static(uploadsDir, { maxAge: "30d", immutable: true }));

const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: "draft-8", legacyHeaders: false, message: { message: "Çok fazla giriş denemesi. Lütfen daha sonra tekrar deneyin." } });
const formLimiter = rateLimit({ windowMs: 10 * 60 * 1000, limit: 8, standardHeaders: "draft-8", legacyHeaders: false, message: { message: "Çok fazla talep gönderildi. Lütfen daha sonra tekrar deneyin." } });
const upload = multer({ memoryStorage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024, files: 12 }, fileFilter: (_req, file, callback) => callback(null, file.mimetype.startsWith("image/") || file.mimetype === "application/pdf") });

async function readJson(file, fallback) { try { return JSON.parse(await fs.readFile(file, "utf8")); } catch { return fallback; } }
async function writeJson(file, value) { await fs.writeFile(file, `${JSON.stringify(value, null, 2)}\n`); }
function migrateLegacyImportedImageUrls(value) {
  let changed = false;
  const visit = current => {
    if (typeof current === "string") {
      const match = current.match(/^(\/imported\/.+)\.(jpe?g|png|gif|tiff?|avif)([?#].*)?$/i);
      if (!match) return current;
      const nextUrl = `${match[1]}.webp${match[3] || ""}`;
      const staticPath = match[1].replace(/^\//, "") + ".webp";
      if (!fsSync.existsSync(path.join(root, "dist", staticPath))) return current;
      changed = true;
      return nextUrl;
    }
    if (Array.isArray(current)) return current.map(visit);
    if (current && typeof current === "object") return Object.fromEntries(Object.entries(current).map(([key, entry]) => [key, visit(entry)]));
    return current;
  };
  return { value: visit(value), changed };
}
async function backupBeforeMigration(file) {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const name = path.basename(file, ".json");
  await fs.copyFile(file, path.join(migrationBackupsDir, `${stamp}-${name}-before-webp-url-migration.json`));
}
async function migrateLegacyUploadedImages() {
  const imageExtensions = new Set([".jpg", ".jpeg", ".png", ".gif", ".tif", ".tiff", ".avif"]);
  for (const filename of await fs.readdir(originalsDir)) {
    const extension = path.extname(filename).toLowerCase();
    if (!imageExtensions.has(extension)) continue;
    const id = path.basename(filename, extension);
    const source = path.join(originalsDir, filename);
    const destination = path.join(optimizedDir, `${id}.webp`);
    if (!fsSync.existsSync(destination)) await sharp(source).rotate().resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true }).webp({ quality: 82 }).toFile(destination);
    await fs.unlink(source);
  }
}
migrateLegacyUploadedImages().catch(error => console.error("Legacy WebP migration failed", error.message));
async function migrateContentSchema() {
  const partnerLogos = {
    winsa: "/imported/partners/winsa.webp",
    "kutahya-seramik": "/imported/partners/kutahya-seramik.webp",
    kronospan: "/imported/partners/kronospan.webp",
    "kokler-petrol": "/imported/partners/kokler-petrol.webp",
    "kastamonu-entegre": "/imported/partners/kastamonu-entegre.webp",
    eca: "/imported/partners/eca.webp",
    "canakkale-seramik": "/imported/partners/canakkale-seramik.webp",
  };
  const newsImages = {
    "olukbasi-sozlesme": "/imported/news/olukbasi-sozlesme.webp",
    "hamza-eren-goksu": "/imported/news/hamza-eren-goksu.webp",
    "yeni-proje-imzalar": "/imported/news/yeni-proje-imzalar.webp",
    "hisarciklioglu-mesaj": "/imported/news/hisarciklioglu-mesaj.webp",
    "vali-cakir-ziyaret": "/imported/news/vali-cakir-ziyaret.webp",
    "katso-secimleri": "/imported/news/katso-secimleri.webp",
    "tobb-genc-girisimciler": "/imported/news/tobb-genc-girisimciler.webp",
    "genc-fikirler": "/imported/news/genc-fikirler.webp",
  };
  const missingOriginalNews = [
    { id: "tobb-genc-girisimciler", title: "Kastamonu TOBB İl Genç Girişimciler İcra Kurulu başkanını seçti", excerpt: "05 Mart 2019 Salı günü Odamız toplantı salonunda yapılan seçim neticesinde Ahmet Cevdet UYANIK, TOBB İl Genç Girişimciler İcra Kurulu Başkanı seçildi.", image: newsImages["tobb-genc-girisimciler"], published: true },
    { id: "genc-fikirler", title: "Genç Fikirler Yarışıyor etkinliğinde öğrenciler uzman mentörlerle buluştu", excerpt: "Vocathlon Mesleki Girişim Maratonu kapsamında öğrencilerin girişimcilik kapasitelerini artırmaları, fikirlerini geliştirmeleri ve takım çalışmasını deneyimlemeleri amaçlandı.", image: newsImages["genc-fikirler"], published: true },
  ];
  for (const file of [contentFile, draftFile]) {
    const storedContent = await readJson(file, null);
    if (!storedContent) continue;
    const legacyImageMigration = migrateLegacyImportedImageUrls(storedContent);
    const content = legacyImageMigration.value;
    let changed = legacyImageMigration.changed;
    const isKuzeykale = String(content.company?.name || "").toLocaleLowerCase("tr-TR").includes("kuzeykale");
    content.partners = (content.partners || []).map(partner => {
      if (!isKuzeykale || typeof partner !== "object" || partner.logo || !partnerLogos[partner.id]) return partner;
      changed = true;
      return { ...partner, logo: partnerLogos[partner.id] };
    });
    content.news = (content.news || []).map(item => {
      if (item.image) return item;
      if (isKuzeykale && newsImages[item.id]) { changed = true; return { ...item, image: newsImages[item.id] }; }
      if (!Object.hasOwn(item, "image")) { changed = true; return { ...item, image: "" }; }
      return item;
    });
    for (const article of isKuzeykale ? missingOriginalNews : []) {
      if (content.news.some(item => item.id === article.id)) continue;
      content.news.push(article);
      changed = true;
    }
    if (changed) {
      if (legacyImageMigration.changed) await backupBeforeMigration(file);
      await writeJson(file, content);
    }
  }
}
await migrateContentSchema();
function parseCookies(req) { return Object.fromEntries((req.headers.cookie || "").split(";").filter(Boolean).map(part => { const [key, ...value] = part.trim().split("="); return [key, decodeURIComponent(value.join("="))]; })); }
function sessionId(req) { const token = parseCookies(req).kk_session; return token ? crypto.createHash("sha256").update(token).digest("hex") : ""; }
function requireAdmin(req, res, next) { const session = sessions.get(sessionId(req)); if (!session || session.expiresAt < Date.now()) return res.status(401).json({ message: "Oturumunuz sona erdi. Lütfen tekrar giriş yapın." }); session.expiresAt = Date.now() + sessionHours * 3600000; next(); }
function safeEqual(a, b) { const left = Buffer.from(String(a)); const right = Buffer.from(String(b)); return left.length === right.length && crypto.timingSafeEqual(left, right); }
function verifyPassword(password) {
  if (process.env.ADMIN_PASSWORD_HASH) {
    const [salt, expected] = process.env.ADMIN_PASSWORD_HASH.split(":");
    if (!salt || !expected) return false;
    return safeEqual(crypto.scryptSync(password, salt, 64).toString("hex"), expected);
  }
  return Boolean(process.env.ADMIN_PASSWORD) && safeEqual(password, process.env.ADMIN_PASSWORD);
}
function setSessionCookie(res, token) { const secure = process.env.COOKIE_SECURE === "true" || (process.env.COOKIE_SECURE !== "false" && process.env.NODE_ENV === "production"); res.setHeader("Set-Cookie", `kk_session=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${sessionHours * 3600}${secure ? "; Secure" : ""}`); }
async function backupContent(label = "automatic") {
  try {
    const content = await fs.readFile(contentFile);
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    await fs.writeFile(path.join(backupsDir, `${stamp}-${label}.json`), content);
    const files = (await fs.readdir(backupsDir)).filter(name => name.endsWith(".json")).sort().reverse();
    await Promise.all(files.slice(30).map(name => fs.unlink(path.join(backupsDir, name))));
  } catch { /* first publish has no backup */ }
}
function publicUrl(req) { return (process.env.PUBLIC_URL || `${req.protocol}://${req.get("host")}`).replace(/\/$/, ""); }
function escapeHtml(value = "") { return String(value).replace(/[&<>'"]/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character]); }
function routeSeo(pathname, content, baseUrl) {
  const company = content.company || {};
  const project = pathname.startsWith("/projeler/detay/") ? content.projects?.find(item => pathname.endsWith(`/${item.slug}`)) : null;
  const routes = {
    "/": [company.seoTitle || `${company.name} | İnşaat, Taahhüt ve Yapı Denetim`, company.seoDescription || "Kastamonu'da taahhüt, mimarlık, mühendislik ve yapı denetim hizmetleri."],
    "/kurumsal": [`Kurumsal | ${company.name}`, `${company.name} şirket yapısı, iş ortakları ve ekibi.`],
    "/kurumsal/hakkimizda": [`Hakkımızda | ${company.name}`, company.aboutShort || "Kuzeykale İnşaat ve Kale Yapı Denetim hakkında kurumsal bilgiler."],
    "/kurumsal/ekibimiz": [`Ekibimiz | ${company.name}`, `${company.name} mühendislik, mimarlık ve proje ekibi.`],
    "/hizmetler": [`Hizmetlerimiz | ${company.name}`, "Taahhüt, mimarlık, mühendislik ve yapı denetim hizmetleri."],
    "/projeler": [`Projelerimiz | ${company.name}`, `${company.name} tamamlanan, devam eden ve planlanan projeleri.`],
    "/iletisim": [`İletişim | ${company.name}`, `${company.name} telefon, adres, çalışma saatleri ve teklif formu.`],
  };
  const [title, description] = project ? [`${project.seoTitle || project.title} | ${company.name}`, project.seoDescription || project.description || `${project.title} proje detayları ve fotoğrafları.`] : (routes[pathname] || [`${company.name}`, company.seoDescription || "Kuzeykale İnşaat"]);
  const canonical = `${baseUrl}${pathname === "/" ? "" : pathname}`;
  const image = project?.cover ? `${baseUrl}${project.cover}` : `${baseUrl}${company.socialImage || "/assets/hero.jpg"}`;
  const schema = project ? { "@context": "https://schema.org", "@type": "CreativeWork", name: project.title, description, image, url: canonical, creator: { "@type": "Organization", name: company.name } } : { "@context": "https://schema.org", "@type": "ConstructionBusiness", name: company.name, url: baseUrl, telephone: company.phone, email: company.email, image, description, address: { "@type": "PostalAddress", streetAddress: company.address, addressLocality: company.city || "Kastamonu", addressCountry: "TR" }, openingHours: company.openingHours || "Mo-Sa 09:00-18:00", sameAs: [company.instagram, company.facebook].filter(Boolean) };
  return { title, description, canonical, image, schema };
}
async function renderHtml(req) {
  const [html, content] = await Promise.all([fs.readFile(path.join(root, "dist", "index.html"), "utf8"), readJson(contentFile, {})]);
  const seo = routeSeo(req.path, content, publicUrl(req));
  return html.replace(/<title>.*?<\/title>/, `<title>${escapeHtml(seo.title)}</title>`)
    .replace(/<meta name="description"[^>]*>/, `<meta name="description" content="${escapeHtml(seo.description)}"/>`)
    .replace(/<link rel="canonical"[^>]*>/, `<link rel="canonical" href="${escapeHtml(seo.canonical)}"/>`)
    .replace(/<script type="application\/ld\+json">.*?<\/script>/, `<script type="application/ld+json">${JSON.stringify(seo.schema).replace(/</g, "\\u003c")}</script>`)
    .replace("</head>", `<meta property="og:type" content="website"/><meta property="og:title" content="${escapeHtml(seo.title)}"/><meta property="og:description" content="${escapeHtml(seo.description)}"/><meta property="og:url" content="${escapeHtml(seo.canonical)}"/><meta property="og:image" content="${escapeHtml(seo.image)}"/><meta name="twitter:card" content="summary_large_image"/></head>`);
}
async function notifyNewLead(lead) {
  const required = ["SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASSWORD", "LEAD_NOTIFICATION_EMAIL"];
  if (!required.every(key => process.env[key])) return false;
  const transporter = nodemailer.createTransport({ host: process.env.SMTP_HOST, port: Number(process.env.SMTP_PORT), secure: process.env.SMTP_SECURE === "true", auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD } });
  await transporter.sendMail({ from: process.env.SMTP_FROM || process.env.SMTP_USER, to: process.env.LEAD_NOTIFICATION_EMAIL, subject: `Yeni teklif talebi: ${lead.name}`, text: `${lead.name}\n${lead.phone}\n${lead.projectType}\n${lead.message || ""}` });
  return true;
}

app.get("/api/health", (_req, res) => res.json({ ok: true }));
app.post("/api/auth/login", loginLimiter, (req, res) => { if (!verifyPassword(req.body?.password || "")) return res.status(401).json({ message: "Parola hatalı." }); const token = crypto.randomBytes(32).toString("base64url"); sessions.set(crypto.createHash("sha256").update(token).digest("hex"), { expiresAt: Date.now() + sessionHours * 3600000 }); setSessionCookie(res, token); res.json({ message: "Giriş başarılı." }); });
app.get("/api/auth/session", requireAdmin, (_req, res) => res.json({ authenticated: true }));
app.post("/api/auth/logout", requireAdmin, (req, res) => { sessions.delete(sessionId(req)); res.setHeader("Set-Cookie", "kk_session=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0"); res.json({ message: "Çıkış yapıldı." }); });

app.get("/api/content", async (_req, res) => res.json(await readJson(contentFile, {})));
app.get("/api/admin/draft", requireAdmin, async (_req, res) => res.json(await readJson(draftFile, await readJson(contentFile, {}))));
app.put("/api/admin/draft", requireAdmin, async (req, res) => { await writeJson(draftFile, req.body); res.json({ message: "Taslak kaydedildi." }); });
app.post("/api/admin/publish", requireAdmin, async (req, res) => { const draft = await readJson(draftFile, null); if (!draft) return res.status(400).json({ message: "Yayınlanacak taslak bulunamadı." }); await backupContent("before-publish"); await writeJson(contentFile, draft); res.json({ message: "Değişiklikler yayınlandı." }); });
app.get("/api/admin/backups", requireAdmin, async (_req, res) => { const files = (await fs.readdir(backupsDir)).filter(name => name.endsWith(".json")).sort().reverse(); res.json(files); });
app.post("/api/admin/backups/:name/restore", requireAdmin, async (req, res) => { const filename = path.basename(req.params.name); const source = path.join(backupsDir, filename); const restored = await readJson(source, null); if (!restored) return res.status(404).json({ message: "Yedek bulunamadı." }); await backupContent("before-restore"); await writeJson(contentFile, restored); await writeJson(draftFile, restored); await migrateContentSchema(); res.json({ message: "Yedek geri yüklendi." }); });
app.get("/api/admin/status", requireAdmin, (_req, res) => res.json({ emailNotifications: Boolean(process.env.SMTP_HOST && process.env.LEAD_NOTIFICATION_EMAIL), persistentDataPath: dataDir }));

app.get("/api/leads", requireAdmin, async (_req, res) => res.json(await readJson(leadsFile, [])));
app.patch("/api/leads/:id", requireAdmin, async (req, res) => { const leads = await readJson(leadsFile, []); const allowed = ["status", "notes", "assignedTo", "callbackAt"]; const updates = Object.fromEntries(Object.entries(req.body || {}).filter(([key]) => allowed.includes(key))); const next = leads.map(lead => lead.id === req.params.id ? { ...lead, ...updates, updatedAt: new Date().toISOString() } : lead); await writeJson(leadsFile, next); res.json({ message: "Talep güncellendi." }); });
app.delete("/api/leads/:id", requireAdmin, async (req, res) => { const leads = await readJson(leadsFile, []); await writeJson(leadsFile, leads.filter(lead => lead.id !== req.params.id)); res.json({ message: "Talep silindi." }); });
app.get("/api/leads-export.csv", requireAdmin, async (_req, res) => { const leads = await readJson(leadsFile, []); const quote = value => `"${String(value ?? "").replaceAll('"', '""')}"`; const rows = [["Ad", "Telefon", "Proje türü", "Durum", "Sorumlu", "Geri arama", "Notlar", "Tarih"], ...leads.map(lead => [lead.name, lead.phone, lead.projectType, lead.status, lead.assignedTo, lead.callbackAt, lead.notes, lead.createdAt])]; res.type("text/csv").attachment("kuzeykale-teklif-talepleri.csv").send(`\uFEFF${rows.map(row => row.map(quote).join(",")).join("\n")}`); });
app.post("/api/teklif", formLimiter, async (req, res) => { const { name, phone, projectType, message = "" } = req.body ?? {}; if (!name || !phone || !projectType) return res.status(400).json({ message: "Lütfen zorunlu alanları doldurun." }); const lead = { id: crypto.randomUUID(), name: String(name).slice(0, 120), phone: String(phone).slice(0, 40), projectType: String(projectType).slice(0, 120), message: String(message).slice(0, 2000), status: "new", assignedTo: "", notes: "", callbackAt: "", createdAt: new Date().toISOString() }; const leads = await readJson(leadsFile, []); leads.unshift(lead); await writeJson(leadsFile, leads); res.status(201).json({ message: "Talebiniz yönetim paneline kaydedildi. Ekibimiz en kısa sürede size ulaşacak.", destination: "admin-crm" }); setImmediate(() => notifyNewLead(lead).catch(error => console.error("Lead notification failed", error.message))); });

app.post("/api/uploads", requireAdmin, upload.array("images", 12), async (req, res) => { const urls = []; for (const file of req.files || []) { const id = `${Date.now()}-${crypto.randomUUID()}`; if (file.mimetype === "application/pdf") { await fs.writeFile(path.join(originalsDir, `${id}.pdf`), file.buffer); urls.push(`/uploads/originals/${id}.pdf`); } else { await sharp(file.buffer).rotate().resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true }).webp({ quality: 82 }).toFile(path.join(optimizedDir, `${id}.webp`)); urls.push(`/uploads/optimized/${id}.webp`); } } res.status(201).json({ urls }); });

app.get("/sitemap.xml", async (req, res) => { const content = await readJson(contentFile, {}); const base = publicUrl(req); const staticRoutes = ["/", "/kurumsal", "/kurumsal/hakkimizda", "/kurumsal/is-ortaklari", "/kurumsal/ekibimiz", "/kurumsal/e-katalog", "/kurumsal/insan-kaynaklari", "/hizmetler", "/hizmetler/taahhut", "/hizmetler/mimarlik", "/hizmetler/muhendislik", "/hizmetler/yapi-denetim", "/projeler", "/projeler/tamamlanan", "/projeler/devam-eden", "/projeler/planlanan", "/galeri/fotograflar", "/galeri/videolar", "/haberler", "/iletisim"]; const routes = [...staticRoutes, ...(content.projects || []).filter(project => project.published !== false).map(project => `/projeler/detay/${project.slug}`)]; res.type("application/xml").send(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${routes.map(route => `<url><loc>${escapeHtml(`${base}${route === "/" ? "" : route}`)}</loc></url>`).join("")}</urlset>`); });
app.get("/robots.txt", (req, res) => res.type("text/plain").send(`User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /api/\nSitemap: ${publicUrl(req)}/sitemap.xml\n`));

app.use(express.static(path.join(root, "dist"), { index: false, maxAge: "7d" }));
app.get("/{*splat}", async (req, res, next) => { try { res.type("html").send(await renderHtml(req)); } catch (error) { next(error); } });
app.use((error, _req, res, _next) => { console.error(error); res.status(error?.code === "LIMIT_FILE_SIZE" ? 413 : 500).json({ message: error?.code === "LIMIT_FILE_SIZE" ? "Görsel 10 MB sınırını aşıyor." : "Beklenmeyen bir sunucu hatası oluştu." }); });

app.listen(port, () => console.log(`Kuzeykale app listening on ${port}`));
