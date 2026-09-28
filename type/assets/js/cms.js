import { createUsageGallery } from './usage-gallery.mjs?v=5';
import { SHEET_ID, SHEET_GID, recordsFromCSV, safeAsset, vimeoEmbed, videoContain, accentInk } from './cms-data.mjs?v=5';

const seed = JSON.parse(document.getElementById('type-seed').textContent);
const slug = document.body.dataset.slug;
const cacheKey = `tap-type-cms-v2:${SHEET_ID}:${SHEET_GID}`;
let records = seed.records, current, busy = false, language = 'ko', languageTimer;
let loadedFont = seed.glyphs?.[slug]?.font, fontRequest = 0;
const $ = selector => document.querySelector(selector);
const gallery = createUsageGallery($('.usage__frame'));
const setText = (selector, value) => { const el = $(selector); if (el && el.textContent !== value) el.textContent = value || ''; };

function renderIntro() {
  const intro = $('.info__body');
  if (!intro || !current) return;
  if (!current['서체 소개 영문']) language = 'ko';
  intro.textContent = current[language === 'ko' ? '서체 소개 국문' : '서체 소개 영문'];
  intro.lang = language;
  intro.disabled = !current['서체 소개 영문'];
  intro.setAttribute('aria-label', language === 'ko' ? '서체 소개: English로 전환' : 'Typeface description: 한국어로 전환');
}

async function applyFont(record) {
  const url = safeAsset(record['웹폰트 파일']);
  if (url === loadedFont) return;
  loadedFont = url;
  const ticket = ++fontRequest;
  const glyphSection = $('.glyphs');
  // Existing glyph maps are only valid for the exact bundled font.
  if (glyphSection) glyphSection.hidden = url !== seed.glyphs?.[slug]?.font;
  if (!url) { document.body.style.setProperty('--font-display', 'var(--font-ui)'); return; }
  try {
    const face = new FontFace(`Type-live-${slug}-${ticket}`, `url(${JSON.stringify(url)})`);
    await face.load();
    if (ticket !== fontRequest) return;
    document.fonts.add(face);
    document.body.style.setProperty('--font-display', `'${face.family}',var(--font-ui)`);
    document.body.style.setProperty('--font-glyph', `'${face.family}',var(--font-ui)`);
  } catch (error) { loadedFont = null; console.warn('웹폰트를 불러오지 못했습니다.', error); }
}

function applyDetail() {
  current = records.find(r => r['주소'] === slug);
  if (!current) return;
  const r = current;
  document.body.style.setProperty('--pink', r['대표색']);
  document.body.style.setProperty('--pink-soft', r['대표색'] + '33');
  document.body.style.setProperty('--on-accent', accentInk(r['대표색']));
  document.body.style.setProperty('--mark-invert', accentInk(r['대표색']) === '#111111' ? '1' : '0');
  const title = r['서체명 영문'] + ' ' + r['서체명 국문'];
  document.title = 'TAP | ' + title;
  $('meta[name="description"]').content = r['서체 소개 국문'];
  $('meta[property="og:title"]').content = document.title;
  $('meta[property="og:description"]').content = r['서체 소개 국문'];
  setText('.hero__title', title);
  setText('.hero__headline', r['첫 화면 문구']);
  renderIntro();
  const tbody = $('.info__table tbody');
  tbody.replaceChildren();
  for (const [label, key] of [['디자인','디자이너 국문'],['제작 연도','제작 연도'],['버전','버전'],['포맷','포맷'],['글리프','글리프'],['문의','문의 이메일']]) {
    const tr = document.createElement('tr'), th = document.createElement('th'), td = document.createElement('td');
    th.scope = 'row'; th.textContent = label; td.textContent = r[key]; tr.append(th, td); tbody.append(tr);
  }
  document.querySelectorAll('.typing__box').forEach((box, i) => {
    box.querySelector('.typing__id').textContent = r['서체명 국문'];
    const text = box.querySelector('.typing__text');
    // Never erase what the visitor is currently typing during a CMS refresh.
    if (!text.dataset.touched && document.activeElement !== text) text.textContent = r[`타이핑 예문 ${i + 1}`] || '';
  });
  const embed = vimeoEmbed(r['Vimeo URL']);
  $('.video').hidden = !embed;
  const iframe = $('.video iframe');
  if (embed && iframe.getAttribute('src') !== embed) iframe.src = embed;
  iframe.title = r['영상 제목'];
  $('.video .head-row a').href = r['Vimeo URL'];
  setText('.video .head-row .col-a', r['영상 제목']);
  setText('.video .caption-row .col-a', r['영상 소개 국문']);
  setText('.video .caption-row .col-b', ['영상 채널','영상 색상','영상 사운드','영상 길이','영상 제작연도'].map(k => r[k]).filter(Boolean).join(', '));
  const fit = videoContain(r['영상 비율']);
  $('.video__frame').style.aspectRatio = '16 / 9';
  iframe.style.width = `${fit.width}%`;
  iframe.style.height = `${fit.height}%`;
  gallery.update(r['사용 예시 이미지'], r['사용 예시 설명'] || title + ' 사용 예시');
  setText('.usage .head-row .col-a', r['사용 예시 설명']);
  void applyFont(r);
}

function apply(next) {
  records = next;
  document.querySelectorAll('.topbar__nav a').forEach(a => {
    const record = records.find(r => a.getAttribute('href') === `/type/${r['주소']}/`);
    if (record) a.textContent = 'TAP/' + record['서체명 영문'];
  });
  if (slug) applyDetail();
}

const menu = $('.type-menu');
document.addEventListener('click', event => { if (menu?.open && !menu.contains(event.target)) menu.open = false; });
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && menu?.open) { menu.open = false; menu.querySelector('summary').focus(); }
});
document.addEventListener('keydown', event => { if (event.key === 'Tab') { document.body.classList.add('keyboard-mode'); } });
document.addEventListener('pointerdown', () => { document.body.classList.remove('keyboard-mode'); });

$('.language-toggle')?.addEventListener('click', () => {
  const intro = $('.info__body');
  clearTimeout(languageTimer); intro.classList.add('is-changing');
  languageTimer = setTimeout(() => { language = language === 'ko' ? 'en' : 'ko'; renderIntro(); intro.classList.remove('is-changing'); }, matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 160);
});

// Local cache is only a last-good copy; each page always asks the live sheet again.
try {
  const saved = JSON.parse(localStorage.getItem(cacheKey));
  if (saved && typeof saved.csv === 'string') records = recordsFromCSV(saved.csv);
} catch { /* A blocked/full localStorage does not prevent loading the site. */ }
apply(records);

async function refresh() {
  if (busy || document.hidden) return;
  busy = true;
  const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 15000);
  try {
    const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${SHEET_GID}&_=${Date.now()}`;
    const response = await fetch(url, { cache: 'no-store', signal: controller.signal });
    if (!response.ok) throw new Error(`CMS HTTP ${response.status}`);
    const csv = await response.text(), next = recordsFromCSV(csv);
    if (JSON.stringify(next) !== JSON.stringify(records)) apply(next);
    try { localStorage.setItem(cacheKey, JSON.stringify({ csv, savedAt: Date.now() })); } catch { /* Optional cache. */ }
    document.documentElement.dataset.cmsState = 'live';
  } catch (error) {
    document.documentElement.dataset.cmsState = 'fallback';
    console.warn('CMS 갱신 실패: 마지막 정상 콘텐츠를 유지합니다.', error);
  } finally { clearTimeout(timer); busy = false; }
}
void refresh();
setInterval(refresh, 30000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) void refresh(); });
window.addEventListener('online', refresh);
