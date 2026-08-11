import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { Link, NavLink, Outlet, Route, Routes, useLocation, useParams } from "react-router";
import Admin from "./Admin";

const categoryMeta = {
  completed: { label: "Tamamlanan", path: "tamamlanan" },
  ongoing: { label: "Devam eden", path: "devam-eden" },
  planned: { label: "Planlanan", path: "planlanan" },
};

const fallbackContent = {
  company: { name: "Kuzeykale İnşaat", phone: "0366 212 10 60", email: "info@kuzeykaleinsaat.com" },
  projects: [], team: [], services: [], news: [], stats: [], partners: [], testimonials: [], certificates: [],
};

const ContentContext = createContext(fallbackContent);
const useContent = () => useContext(ContentContext);

function ContentProvider({ children }) {
  const [content, setContent] = useState(fallbackContent);
  useEffect(() => {
    fetch("/api/content")
      .then((response) => response.ok ? response.json() : Promise.reject())
      .then((data) => setContent({ ...fallbackContent, ...data }))
      .catch(() => {});
  }, []);
  return <ContentContext.Provider value={content}>{children}</ContentContext.Provider>;
}

function Seo() {
  const content = useContent();
  const location = useLocation();
  useEffect(() => {
    const project = location.pathname.startsWith("/projeler/detay/") ? content.projects?.find(item => location.pathname.endsWith(`/${item.slug}`)) : null;
    const titles = { "/": content.company?.seoTitle, "/kurumsal": `Kurumsal | ${content.company?.name}`, "/kurumsal/hakkimizda": `Hakkımızda | ${content.company?.name}`, "/kurumsal/ekibimiz": `Ekibimiz | ${content.company?.name}`, "/hizmetler": `Hizmetlerimiz | ${content.company?.name}`, "/projeler": `Projelerimiz | ${content.company?.name}`, "/haberler": `Haberler | ${content.company?.name}`, "/iletisim": `İletişim | ${content.company?.name}` };
    const title = project ? `${project.seoTitle || project.title} | ${content.company?.name}` : titles[location.pathname] || content.company?.seoTitle || content.company?.name;
    const description = project?.seoDescription || project?.description || content.company?.seoDescription || "Kuzeykale İnşaat";
    const canonical = `${window.location.origin}${location.pathname === "/" ? "" : location.pathname}`;
    document.title = title;
    const setMeta = (selector, attribute, value) => { let element = document.head.querySelector(selector); if (!element) { element = document.createElement("meta"); const match = selector.match(/\[(name|property)="([^"]+)"\]/); if (match) element.setAttribute(match[1], match[2]); document.head.appendChild(element); } element.setAttribute(attribute, value); };
    setMeta('meta[name="description"]', "content", description);
    setMeta('meta[property="og:title"]', "content", title);
    setMeta('meta[property="og:description"]', "content", description);
    setMeta('meta[property="og:url"]', "content", canonical);
    setMeta('meta[property="og:image"]', "content", content.company?.socialImage || content.company?.logo || "/assets/logo.png");
    let favicon = document.head.querySelector('link[rel="icon"]');
    if (!favicon) { favicon = document.createElement("link"); favicon.rel = "icon"; document.head.appendChild(favicon); }
    favicon.href = content.company?.logo || "/assets/logo.png";
    const canonicalElement = document.head.querySelector('link[rel="canonical"]'); if (canonicalElement) canonicalElement.href = canonical;
  }, [content, location.pathname]);
  return null;
}

function Layout() {
  const { company, theme } = useContent();
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  return <div className="site-shell" style={{ "--primary": theme?.primary, "--accent": theme?.accent, "--surface": theme?.surface }}><Seo/>
    <header className="site-header">
      <Link className="brand" to="/" onClick={close}><img src={company.logo || "/assets/logo.png"} alt={company.name} /></Link>
      <button className="menu-toggle" type="button" aria-label="Menüyü aç" aria-expanded={open} onClick={() => setOpen(!open)}>☰</button>
      <nav className={open ? "site-nav is-open" : "site-nav"} aria-label="Ana menü">
        <div className="nav-dropdown">
          <NavLink to="/kurumsal" onClick={close}>Kurumsal <span aria-hidden="true">⌄</span></NavLink>
          <div className="dropdown-menu">
            <Link to="/kurumsal/hakkimizda" onClick={close}>Hakkımızda</Link>
            <Link to="/kurumsal/is-ortaklari" onClick={close}>İş ortaklarımız</Link>
            <Link to="/kurumsal/ekibimiz" onClick={close}>Ekibimiz</Link>
            <Link to="/kurumsal/e-katalog" onClick={close}>E-Katalog</Link>
            <Link to="/kurumsal/insan-kaynaklari" onClick={close}>İnsan kaynakları</Link>
          </div>
        </div>
        <NavLink to="/hizmetler" onClick={close}>Hizmetler</NavLink>
        <div className="nav-dropdown">
          <NavLink to="/projeler" onClick={close}>Projeler <span aria-hidden="true">⌄</span></NavLink>
          <div className="dropdown-menu">
            {Object.entries(categoryMeta).map(([key, item]) => <Link key={key} to={`/projeler/${item.path}`} onClick={close}>{item.label} projeler</Link>)}
          </div>
        </div>
        <div className="nav-dropdown"><NavLink to="/galeri" onClick={close}>Galeri <span aria-hidden="true">⌄</span></NavLink><div className="dropdown-menu"><Link to="/galeri/fotograflar" onClick={close}>Foto galeri</Link><Link to="/galeri/videolar" onClick={close}>Video galeri</Link></div></div>
        <NavLink to="/haberler" onClick={close}>Haberler</NavLink>
        <NavLink to="/iletisim" onClick={close}>İletişim</NavLink>
      </nav>
      <Link className="header-cta" to="/iletisim">Teklif alın <span>→</span></Link>
    </header>
    <Outlet />
    <div className="floating-contact"><a href={`tel:${company.phone}`} aria-label="Kuzeykale'yi ara">Ara</a>{company.whatsapp && <a className="whatsapp" href={`https://wa.me/${company.whatsapp}`} target="_blank" rel="noreferrer">WhatsApp</a>}</div>
    <footer className="site-footer">
      <Link to="/"><img src={company.logo || "/assets/logo.png"} alt={company.name}/></Link>
      <p>© {new Date().getFullYear()} {company.name}. Tüm hakları saklıdır.</p>
      <div><Link to="/kurumsal">Kurumsal</Link><Link to="/iletisim">İletişim</Link><Link to="/admin">Yönetim</Link></div>
    </footer>
  </div>;
}

function PageHero({ eyebrow, title, children }) {
  return <section className="page-hero"><p className="eyebrow">{eyebrow}</p><h1>{title}</h1>{children && <p>{children}</p>}</section>;
}

function QuoteForm() {
  const [status, setStatus] = useState("");
  async function submit(event) {
    event.preventDefault();
    setStatus("Gönderiliyor...");
    const form = event.currentTarget;
    const response = await fetch("/api/teklif", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(Object.fromEntries(new FormData(form))) });
    const data = await response.json();
    setStatus(data.message);
    if (response.ok) form.reset();
  }
  return <form onSubmit={submit} className="quote-form">
    <label>Adınız soyadınız<input name="name" required placeholder="Adınız soyadınız" /></label>
    <label>Telefon numaranız<input name="phone" required inputMode="tel" placeholder="05XX XXX XX XX" /></label>
    <label>Proje türü<select name="projectType" required defaultValue=""><option value="" disabled>Seçiniz</option><option>Kentsel dönüşüm</option><option>Taahhüt projesi</option><option>Tadilat / yenileme</option><option>Diğer</option></select></label>
    <label>Projeniz hakkında kısa bilgi<textarea name="message" rows="4" placeholder="Yapı tipi, konum ve ihtiyacınızı yazabilirsiniz." /></label>
    <button type="submit">Ücretsiz görüşme planla <span>→</span></button>
    {status && <p className="form-status" role="status">{status}</p>}
  </form>;
}

function ProjectCard({ project }) {
  return <article className="project-card"><Link to={`/projeler/detay/${project.slug}`}><img src={project.cover} alt={project.title}/><div><p>{categoryMeta[project.category]?.label || project.category}</p><h3>{project.title}</h3><span>Projeyi incele →</span></div></Link></article>;
}

function Home() {
  const { projects, services, hero, stats, testimonials, company } = useContent();
  const visibleProjects = projects.filter(project => project.published !== false);
  return <main>
    <section className="hero hero-video">
      <div className="hero-video-media"><iframe src={hero?.videoUrl} title="Kuzeykale tanıtım filmi" allow="autoplay; encrypted-media"/></div>
      <div className="hero-video-shade"/><div className="hero-copy"><p className="eyebrow">{hero?.eyebrow}</p><h1>{hero?.title}</h1><p className="lede">{hero?.description}</p><div className="hero-actions"><Link className="button" to="/iletisim">Projenizi konuşalım <span>→</span></Link><Link className="text-link" to="/projeler">Projelerimizi inceleyin</Link></div></div><div className="hero-badge"><b>2010</b><span>yılından beri</span></div>
    </section>
    <section className="trust"><p>GÜVENİLİR YAPI ÇÖZÜMLERİ</p><div><span>Taahhüt</span><span>Kentsel dönüşüm</span><span>Projelendirme</span><span>Uygulama</span></div></section>
    <section className="stats-strip">{stats?.map(item => <article key={item.label}><b>{item.value}</b><span>{item.label}</span></article>)}</section>
    <section className="services"><div className="section-intro"><p className="eyebrow">UZMANLIKLARIMIZ</p><h2>Yalnızca bina değil, <em>güven</em> inşa ediyoruz.</h2></div><div className="service-grid">{services?.filter(item => item.published !== false).slice(0, 4).map((service, index) => <article key={service.id}><b>0{index + 1}</b><h3>{service.title}</h3><p>{service.description}</p></article>)}</div><Link className="text-link section-link" to="/hizmetler">Tüm hizmetleri görün →</Link></section>
    <section className="projects"><div className="section-intro row"><div><p className="eyebrow">GÜNCEL PROJELER</p><h2>Her detayda<br/><em>kalıcı değer.</em></h2></div><Link className="text-link" to="/projeler">Tüm projeleri görün →</Link></div><div className="project-grid">{visibleProjects.slice(0, 3).map(project => <ProjectCard key={project.id || project.slug} project={project}/>)}</div></section>
    <section className="principles"><p className="eyebrow">KUZEYKALE FARKI</p><div><h2>İyi bir yapı;<br/>doğru kararlarla<br/><em>başlar.</em></h2><ul><li><b>Şeffaf iletişim</b><span>Projenin her aşamasını açık ve anlaşılır biçimde paylaşırız.</span></li><li><b>Teknik disiplin</b><span>Doğru malzeme, doğru ekip ve kontrollü uygulama standarttır.</span></li><li><b>Uzun vadeli sahiplenme</b><span>Teslimle bitmeyen, güvene dayalı iş ortaklıkları kurarız.</span></li></ul></div></section>
    {testimonials?.some(item => item.published !== false) && <section className="testimonial-section"><p className="eyebrow">MÜŞTERİLERİMİZ</p><h2>Projelerden kalan <em>güven.</em></h2><div>{testimonials.filter(item => item.published !== false).map(item => <blockquote key={item.id}><p>“{item.quote}”</p><footer>{item.name} · {item.project}</footer></blockquote>)}</div></section>}
    <section className="location-section"><div><p className="eyebrow">OFİSİMİZ</p><h2>Kahveye <em>bekliyoruz.</em></h2><p>{company.address}</p><Link className="button" to="/iletisim">Randevu oluşturun →</Link></div><iframe title="Kuzeykale ofis konumu" loading="lazy" src={`https://www.google.com/maps?q=${encodeURIComponent(company.address || "Kastamonu")}&output=embed`}/></section>
    <section className="home-cta"><p className="eyebrow">İLK ADIMI ATIN</p><h2>Projenizi <em>birlikte</em> konuşalım.</h2><Link className="button" to="/iletisim">Teklif talebi oluşturun →</Link></section>
  </main>;
}

function Corporate() { return <main className="corporate page-main"><PageHero eyebrow="KURUMSAL" title={<>Güven, bilgi ve <em>sorumlulukla</em> inşa ediyoruz.</>}>Kuzeykale'nin kurum kültürü, ekibi ve çalışma yaklaşımı.</PageHero><section className="corporate-menu-grid"><Link to="/kurumsal/hakkimizda"><b>01</b><h2>Hakkımızda</h2><span>Şirketimizi tanıyın →</span></Link><Link to="/kurumsal/is-ortaklari"><b>02</b><h2>İş Ortaklarımız</h2><span>Markaları görün →</span></Link><Link to="/kurumsal/ekibimiz"><b>03</b><h2>Ekibimiz</h2><span>12 kişilik ekibimiz →</span></Link><Link to="/kurumsal/e-katalog"><b>04</b><h2>E-Katalog</h2><span>Belgeleri inceleyin →</span></Link><Link to="/kurumsal/insan-kaynaklari"><b>05</b><h2>İnsan Kaynakları</h2><span>Ekibimize katılın →</span></Link></section></main>; }
function About() { const { company } = useContent(); return <main className="corporate page-main"><PageHero eyebrow="KURUMSAL · HAKKIMIZDA" title={<>Biz <em>kimiz?</em></>}/><section><h2>Kuzeykale İnşaat</h2><p>{company.about}</p><p>Taahhüt, mimarlık, mühendislik ve yapı denetim çalışmalarında kaliteyi, teknik disiplini ve güveni merkeze alıyoruz.</p></section></main>; }
function Partners() { const { partners = [] } = useContent(); return <main className="corporate page-main"><PageHero eyebrow="KURUMSAL · İŞ ORTAKLARIMIZ" title={<>Güvenilir markalarla <em>birlikte.</em></>}/><section><div className="partner-grid">{partners.map((partner, index) => <article key={partner.id || partner.name || partner}>{partner.logo && <img src={partner.logo} alt=""/>}<span>{partner.name || partner}</span></article>)}</div></section></main>; }
function Team() { const { team = [] } = useContent(); return <main className="corporate page-main"><PageHero eyebrow="KURUMSAL · EKİBİMİZ" title={<>Deneyimli <em>ekibimiz.</em></>}>Mühendislikten satışa, projelerimizi birlikte hayata geçiren ekip.</PageHero><section><div className="team-grid full-team">{team.map(person => <article key={person.id || person.name}><img src={person.image} alt={person.name}/><h3>{person.name}</h3><p>{person.role}</p></article>)}</div></section></main>; }
function Catalog() { const { certificates = [], company } = useContent(); return <main className="corporate page-main"><PageHero eyebrow="KURUMSAL · E-KATALOG" title={<>Belgelerimiz <em>tek yerde.</em></>}/><section><h2>E-Katalog ve belgeler</h2><div className="document-list">{certificates.length ? certificates.map(item => <a key={item.id} href={item.url} target="_blank" rel="noreferrer">{item.title} →</a>) : <a className="button" href={`mailto:${company.email}?subject=E-Katalog Talebi`}>E-katalog talep edin →</a>}</div></section></main>; }
function Careers() { return <main className="corporate page-main"><PageHero eyebrow="KURUMSAL · İNSAN KAYNAKLARI" title={<>Birlikte <em>inşa edelim.</em></>}/><section><h2>Kuzeykale ekibine katılın</h2><p>Açık pozisyonlar ve genel başvurular için özgeçmişinizi e-posta ile paylaşabilirsiniz.</p><a className="button" href="mailto:info@kuzeykaleinsaat.com?subject=İnsan Kaynakları Başvurusu">Özgeçmiş gönderin →</a></section></main>; }

function Services() { const { services = [] } = useContent(); return <main className="page-main"><PageHero eyebrow="HİZMETLER" title={<>Fikirden teslimata <em>tek ekip.</em></>}>Taahhüt, mimarlık, mühendislik ve yapı denetim hizmetleri.</PageHero><section className="service-list">{services.filter(item => item.published !== false).map((service, index) => <article key={service.id}><b>0{index + 1}</b><div><h2>{service.title}</h2><p>{service.description}</p><Link className="text-link" to={`/hizmetler/${service.id}`}>Devamını okuyun →</Link></div></article>)}</section></main>; }
function ServiceDetail() { const { slug } = useParams(); const service = useContent().services?.find(item => item.id === slug && item.published !== false); if (!service) return <NotFound/>; return <main className="page-main"><PageHero eyebrow="HİZMETLER" title={service.title}/><section className="content-section"><p>{service.description}</p><Link className="button" to="/iletisim">Bu hizmet için teklif alın →</Link></section></main>; }

function ProjectIndex({ forcedCategory }) {
  const { projects } = useContent();
  const params = useParams();
  const category = forcedCategory || Object.entries(categoryMeta).find(([, meta]) => meta.path === params.category)?.[0];
  const published = projects.filter(project => project.published !== false);
  const visible = category ? published.filter(project => project.category === category) : published;
  const title = category ? `${categoryMeta[category].label} projeler` : "Tüm projeler";
  return <main className="page-main project-list-page"><PageHero eyebrow="PROJELER" title={<>{title}: <em>kalıcı değerler.</em></>}>Konut, ticari yapı ve dönüşüm projelerimizi inceleyin.</PageHero>{!category && <div className="category-tabs">{Object.entries(categoryMeta).map(([key, meta]) => <Link key={key} to={`/projeler/${meta.path}`}>{meta.label}</Link>)}</div>}<section className="archive-grid">{visible.length ? visible.map(project => <ProjectCard key={project.id || project.slug} project={project}/>) : <p>Bu kategoride henüz yayınlanmış proje bulunmuyor.</p>}</section></main>;
}

function ProjectDetail() {
  const { projects } = useContent();
  const { slug } = useParams();
  const project = projects.find(item => item.slug === slug && item.published !== false);
  if (!project) return <main className="project-detail"><Link to="/projeler">← Tüm projeler</Link><h1>Proje bulunamadı</h1></main>;
  const video = getYoutubeEmbed(project.youtubeUrl);
  return <main className="project-detail"><Link to="/projeler">← Tüm projeler</Link><p className="eyebrow">{categoryMeta[project.category]?.label?.toUpperCase()} PROJE</p><h1>{project.title}</h1>{project.startDate && <p className="project-date">Başlangıç tarihi · {project.startDate}</p>}<p>{project.description}</p><img className="project-cover" src={project.cover} alt={project.title}/>{project.gallery?.length > 0 && <><h2>Proje galerisi</h2><div className="detail-gallery">{project.gallery.map((image, index)=><img key={`${image}-${index}`} src={image} alt={`${project.title} proje görseli ${index + 1}`}/>)}</div></>}{video && <><h2>Proje videosu</h2><iframe className="project-video" src={video} title={`${project.title} videosu`} allowFullScreen/></>}</main>;
}

function getYoutubeEmbed(url = "") {
  if (!url) return "";
  if (url.includes("youtube.com/embed/")) return url;
  const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|shorts\/))([^?&/]+)/);
  return match ? `https://www.youtube.com/embed/${match[1]}` : "";
}

function Gallery({ mode = "photos" }) {
  const images = useContent().projects.filter(project => project.published !== false).flatMap(project => [project.cover, ...(project.gallery || [])]).filter(Boolean);
  const videos = useContent().projects.filter(project => project.published !== false && project.youtubeUrl);
  return <main className="page-main"><PageHero eyebrow="GALERİ" title={mode === "videos" ? <>Proje <em>videoları.</em></> : <>Yapım sürecinden <em>detaylar.</em></>}>Projelerimizden seçilmiş fotoğraf ve videolar.</PageHero>{mode === "videos" ? <section className="video-gallery">{videos.map(project => <article key={project.slug}><iframe src={getYoutubeEmbed(project.youtubeUrl)} title={`${project.title} videosu`} allowFullScreen/><h2>{project.title}</h2></article>)}</section> : <section className="gallery-grid">{[...new Set(images)].map((image, index) => <img key={image} src={image} alt={`Kuzeykale proje galerisi ${index + 1}`}/>)}</section>}</main>;
}

function News() { const { news = [] } = useContent(); return <main className="page-main"><PageHero eyebrow="HABERLER" title={<>Kuzeykale'den <em>gelişmeler.</em></>}/><section className="news-grid full-news">{news.filter(item => item.published !== false).map((item, index) => <article key={item.id}><span>{index < 3 ? "GÜNCEL" : "KURUMSAL"}</span><h3>{item.title}</h3><p>{item.excerpt}</p></article>)}</section></main>; }

function Contact() {
  const { company } = useContent();
  return <main className="page-main contact-page"><PageHero eyebrow="İLETİŞİM" title={<>Projenizi <em>birlikte</em> konuşalım.</>}>Teklif talebinizi bırakın, ekibimiz sizi arasın.</PageHero><section className="contact"><div><h2>İletişim bilgileri</h2><a href={`tel:${company.phone}`}>{company.phone}</a><a href={`mailto:${company.email}`}>{company.email}</a><p>{company.address}</p><p>{company.hours}</p></div><QuoteForm/></section></main>;
}

function NotFound() { return <main className="page-main"><PageHero eyebrow="404" title="Sayfa bulunamadı"/><Link className="button" to="/">Ana sayfaya dön</Link></main>; }

export default function App() {
  return <ContentProvider><Routes>
    <Route element={<Layout/>}>
      <Route index element={<Home/>}/>
      <Route path="kurumsal" element={<Corporate/>}/>
      <Route path="kurumsal/hakkimizda" element={<About/>}/>
      <Route path="kurumsal/is-ortaklari" element={<Partners/>}/>
      <Route path="kurumsal/ekibimiz" element={<Team/>}/>
      <Route path="kurumsal/e-katalog" element={<Catalog/>}/>
      <Route path="kurumsal/insan-kaynaklari" element={<Careers/>}/>
      <Route path="hizmetler" element={<Services/>}/>
      <Route path="hizmetler/:slug" element={<ServiceDetail/>}/>
      <Route path="projeler" element={<ProjectIndex/>}/>
      <Route path="projeler/tamamlanan" element={<ProjectIndex forcedCategory="completed"/>}/>
      <Route path="projeler/devam-eden" element={<ProjectIndex forcedCategory="ongoing"/>}/>
      <Route path="projeler/planlanan" element={<ProjectIndex forcedCategory="planned"/>}/>
      <Route path="projeler/detay/:slug" element={<ProjectDetail/>}/>
      <Route path="galeri" element={<Gallery/>}/>
      <Route path="galeri/fotograflar" element={<Gallery/>}/>
      <Route path="galeri/videolar" element={<Gallery mode="videos"/>}/>
      <Route path="haberler" element={<News/>}/>
      <Route path="iletisim" element={<Contact/>}/>
      <Route path="*" element={<NotFound/>}/>
    </Route>
    <Route path="admin" element={<Admin/>}/>
  </Routes></ContentProvider>;
}
