import { TABS, INFO_HEADERS, infoFromRows } from './site-data.mjs?v=6';
import { initMenu, watchTab, seedFrom, el } from './site.mjs?v=5';

const body = document.body;
const mobile = document.querySelector('.about-m');
const desk = document.querySelector('.about-d');
// 터치 화면에서 두 번 탭은 메뉴(tap-menu.mjs)다. 제목·소개는 첫 탭에 바로 반응하고,
// 0.32초 안에 두 번째 탭이 오면 첫 탭 동작을 되돌려 메뉴만 열리게 한다.
// 사진은 연달아 넘기는 일이 많아 탭 메뉴에서 빼고 누를 때마다 넘기기만 한다.
const DOUBLE_TAP = 320;
const touch = matchMedia('(pointer: coarse)').matches;
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
// 메뉴가 열린 직후 브라우저가 이어서 보내는 click은 새 탭으로 치지 않는다.
let menuOpenedAt = -Infinity;
const justOpenedMenu = () => performance.now() - menuOpenedAt < 400;

// 국문/영문을 같이 넣고 CSS가 고른다. 영문이 비면 국문을 대신 보여준다.
const bi = (tag, className, ko, en) => {
  const node = el(tag, ['bi', className].filter(Boolean).join(' '));
  node.append(Object.assign(el('span', '', ko || ''), { lang: 'ko' }), Object.assign(el('span', '', en || ko || ''), { lang: 'en' }));
  return node;
};
// 링크가 있는 이름은 밑줄을 긋고 새 탭에서 연다(잘못 눌러도 사이트가 닫히지 않게).
const person = (name, href) => {
  if (!href) return el('span', '', name);
  const a = el('a', 'person-link', name);
  a.href = href; a.target = '_blank'; a.rel = 'noopener';
  return a;
};
const people = (list, key) => {
  const span = el('span');
  list.forEach((p, i) => { if (i) span.append(', '); span.append(person(p[key] || p.ko, p.href)); });
  return span;
};
const paragraphs = (list, key) => list.map(item => el('p', '', item[key] || item.ko));
const contactLinks = (contacts, label) => {
  const dl = el('dl', 'contacts');
  for (const c of contacts) {
    const a = el('a', '', c.link.text);
    a.href = c.link.href;
    if (c.link.href.startsWith('https:')) { a.target = '_blank'; a.rel = 'noopener'; }
    const dd = el('dd'); dd.append(a);
    dl.append(label(c), dd);
  }
  return dl;
};
// 사진이 여러 장이면 누를 때마다 다음 장이 겹쳐 나타난다(모바일·데스크톱 같은 순번).
let slide = 0, photos = { images: [], captions: [] };
const captionFor = i => (photos.captions.length > 1 ? photos.captions[i] : photos.captions[0]) || '';
const photo = src => {
  const img = el('img');
  // 구글 드라이브 이미지(lh3)는 Referer가 붙으면 간헐적으로 403을 준다.
  img.referrerPolicy = 'no-referrer'; img.src = src; img.decoding = 'async';
  return img;
};
function showSlide(index) {
  slide = index;
  document.querySelectorAll('.photo-slider').forEach(button => {
    const next = photo(photos.images[slide]);
    next.alt = captionFor(slide);
    button.append(next);
    const fadeIn = () => {
      next.classList.add('is-in');
      setTimeout(() => { while (button.firstElementChild !== next) button.firstElementChild.remove(); }, reduced() ? 0 : 340);
    };
    if (next.complete) fadeIn(); else next.addEventListener('load', fadeIn, { once: true });
    button.setAttribute('aria-label', `사진 ${slide + 1}/${photos.images.length}, 눌러서 다음 사진`);
  });
  document.querySelectorAll('.about-d__image figcaption').forEach(c => { c.textContent = captionFor(slide); });
  Object.assign(new Image(), { referrerPolicy: 'no-referrer', src: photos.images[(slide + 1) % photos.images.length] });
}
const image = (data, className) => {
  photos = data;
  if (!data.images.length) return '';
  slide %= data.images.length;
  const figure = el('figure', className), img = photo(data.images[slide]);
  img.alt = captionFor(slide);
  if (data.images.length > 1) {
    const button = el('button', 'photo-slider');
    button.type = 'button';
    button.setAttribute('aria-label', `사진 ${slide + 1}/${data.images.length}, 눌러서 다음 사진`);
    button.addEventListener('click', () => showSlide((slide + 1) % data.images.length));
    button.append(img);
    figure.append(button);
  } else figure.append(img);
  if (data.captions.some(Boolean)) figure.append(el('figcaption', '', captionFor(slide)));
  return figure;
};

function renderMobile(d) {
  const title = el('h1', 'page-title');
  const titleButton = bi('button', 'lang-toggle', d.title.ko, d.title.en);
  titleButton.type = 'button';
  titleButton.dataset.tapMenuAllow = '';
  title.append(titleButton);
  const intro = el('button', 'about-m__intro lang-toggle bi');
  intro.type = 'button';
  intro.dataset.tapMenuAllow = '';
  const ko = el('span'); ko.lang = 'ko'; ko.append(...paragraphs(d.intro, 'ko'));
  const en = el('span'); en.lang = 'en'; en.append(...paragraphs(d.intro, 'en'));
  intro.append(ko, en);
  const figure = image(d, 'about-m__image');
  if (figure) figure.querySelector('figcaption')?.remove();

  const block = (ko, en, content) => {
    const section = el('section', 'about-m__block');
    const head = el('h2', 'about-m__head');
    head.append(el('span', '', ko), el('span', '', en));
    section.append(head, content);
    return section;
  };
  const members = el('ul', 'members');
  for (const m of d.members) { const li = el('li'); li.append(person(m.ko, m.href), person(m.en, m.href)); members.append(li); }
  const works = el('ul', 'works');
  for (const w of d.works) { const li = el('li'); li.append(el('span', '', w.date), bi('span', '', w.ko, w.en)); works.append(li); }

  const credits = el('dl', 'credits');
  for (const g of d.credits) {
    const dd = el('dd', 'bi');
    dd.append(Object.assign(people(g.people, 'ko'), { lang: 'ko' }), Object.assign(people(g.people, 'en'), { lang: 'en' }));
    credits.append(bi('dt', '', g.ko, g.en), dd);
  }

  mobile.replaceChildren(title, figure, intro,
    block('구성원', 'Member', members),
    block('활동', 'Works', works),
    block('연락처', 'Contact', contactLinks(d.contacts, c => bi('dt', '', c.ko, c.en))),
    ...(d.credits.length ? [block('웹 크레딧', 'Web Credits', credits)] : []));
  mobile.querySelectorAll('.lang-toggle').forEach(b => {
    b.disabled = !d.intro.some(i => i.en) && d.title.en === d.title.ko;
  });
}

function renderDesk(d) {
  const side = el('aside', 'about-d__side');
  const card = el('div', 'about-d__card');
  const title = el('h1', 'page-title');
  title.append(el('span', '', d.title.ko), el('br'), el('span', '', d.title.en));
  card.append(title);
  if (d.notice) {
    const notice = el('p', 'about-d__notice');
    notice.append(el('span', '', d.notice.ko), el('br'), el('span', '', d.notice.en));
    card.append(notice);
  }
  card.append(contactLinks(d.contacts, c => el('dt', '', c.en || c.ko)));
  side.append(image(d, 'about-d__image'), card);

  const grid = el('div', 'about-d__grid');
  const cell = (className, ...children) => { const node = el('div', className); node.append(...children); return node; };
  grid.append(
    cell('about-d__intro', ...paragraphs(d.intro, 'ko')),
    cell('about-d__intro about-d__intro--en', ...paragraphs(d.intro, 'en')));
  if (d.members.length) {
    const list = key => { const ul = el('ul', `members members--${key}`); for (const m of d.members) { const li = el('li'); li.append(person(m[key] || m.ko, m.href)); ul.append(li); } return ul; };
    grid.append(cell('about-d__head', el('h2', '', '구성원')), cell('about-d__head', el('h2', '', 'Member')),
      cell('about-d__list', list('ko')), cell('about-d__list', list('en')));
  }
  if (d.works.length) {
    grid.append(cell('about-d__head about-d__head--works', el('h2', '', '활동')), cell('about-d__head about-d__head--works', el('h2', '', 'Works')));
    d.works.forEach((w, i) => {
      const ko = el('ul', 'works'), li = el('li');
      li.append(el('span', '', w.date), el('span', '', w.ko));
      ko.append(li);
      const row = i ? 'works-row' : 'works-row works-row--first';
      grid.append(cell(row, ko), cell(row, el('p', '', w.en || w.ko)));
    });
  }
  if (d.credits.length) {
    grid.append(cell('about-d__head about-d__head--works', el('h2', '', '웹 크레딧')), cell('about-d__head about-d__head--works', el('h2', '', 'Web Credits')));
    d.credits.forEach((g, i) => {
      const row = i ? 'works-row' : 'works-row works-row--first';
      const line = key => { const ul = el('ul', 'works'), li = el('li'); li.append(el('span', '', g[key] || g.ko), people(g.people, key)); ul.append(li); return ul; };
      grid.append(cell(row, line('ko')), cell(row, line('en')));
    });
  }
  const main = el('div', 'about-d__main');
  main.append(grid, document.querySelector('#site-end').content.cloneNode(true));
  desk.replaceChildren(side, main);
}

function render(rows) {
  const data = infoFromRows(rows);
  renderMobile(data);
  renderDesk(data);
}

// 영문일 때는 상단 '타입앤퍼블리셔'도 영문으로(Info 페이지에서만).
const brand = document.querySelector('.topbar__brand').lastChild;
function switchLang() {
  body.dataset.lang = body.dataset.lang === 'ko' ? 'en' : 'ko';
  document.documentElement.lang = body.dataset.lang;
  brand.textContent = body.dataset.lang === 'en' ? 'Typeandpublisher' : '타입앤퍼블리셔';
}

initMenu();
body.dataset.lang = 'ko';
let langPending = null;
mobile.addEventListener('click', event => {
  const button = event.target.closest('.lang-toggle');
  if (!button || button.disabled || justOpenedMenu()) return;
  const toggles = mobile.querySelectorAll('.lang-toggle');
  // 두 번째 탭: 바꾸려던 것을 취소하고 원래 글로 돌아온다(메뉴는 tap-menu.mjs가 연다).
  if (langPending) { clearTimeout(langPending); langPending = null; toggles.forEach(t => t.classList.remove('is-changing')); return; }
  // 첫 탭: 바로 옅어지기 시작하고, 두 번 탭이 아니면 0.32초 뒤(마우스는 0.16초) 다른 언어로 나타난다.
  toggles.forEach(t => t.classList.add('is-changing'));
  langPending = setTimeout(() => {
    langPending = null;
    switchLang();
    toggles.forEach(t => t.classList.remove('is-changing'));
  }, touch ? DOUBLE_TAP : reduced() ? 0 : 160);
});
// 두 번째 탭은 탭 메뉴의 작은 원 위에 떨어지므로, 메뉴가 열렸다는 신호로도 첫 탭 동작을 되돌린다.
document.addEventListener('tapmenu:open', () => {
  menuOpenedAt = performance.now();
  if (langPending) { clearTimeout(langPending); langPending = null; mobile.querySelectorAll('.lang-toggle').forEach(t => t.classList.remove('is-changing')); }
});
watchTab({ name: 'info', gid: TABS.info, headers: INFO_HEADERS, headerRow: 1, seed: seedFrom('info-seed'), render });
