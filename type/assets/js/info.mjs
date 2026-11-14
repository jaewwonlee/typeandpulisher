import { TABS, INFO_HEADERS, infoFromRows } from './site-data.mjs?v=6';
import { initMenu, watchTab, seedFrom, el, sized } from './site.mjs?v=12';

const body = document.body;
const mobile = document.querySelector('.about-m');
const desk = document.querySelector('.about-d');
// 터치 화면에서 두 번 탭은 메뉴(tap-menu.mjs)다. 제목·소개를 한 번 탭하면 0.32초 기다렸다가
// (두 번 탭이 아니면) 다른 언어로 바뀐다. 바뀔 때 움직임은 없다.
const DOUBLE_TAP = 320;
const touch = matchMedia('(pointer: coarse)').matches;
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
// 사진이 여러 장이면 옆으로 밀어서 넘긴다(손가락·마우스 끌기, 키보드 ←/→). 모바일·데스크톱이 같은 순번을 쓴다.
// 사진을 누르는 것은 다른 곳과 똑같이 탭 메뉴(tap-menu.mjs) 몫이다.
let slide = 0, photos = { images: [], captions: [] };
const captionFor = i => (photos.captions.length > 1 ? photos.captions[i] : photos.captions[0]) || '';
const photo = src => {
  const img = el('img');
  // 구글 드라이브 이미지(lh3)는 Referer가 붙으면 간헐적으로 403을 준다.
  img.referrerPolicy = 'no-referrer'; img.src = sized(src, 1600); img.decoding = 'async'; img.draggable = false;
  return img;
};
function showSlide(index) {
  slide = Math.max(0, Math.min(photos.images.length - 1, index));
  document.querySelectorAll('.photo-slider').forEach(box => {
    const track = box.firstElementChild;
    track.style.transition = '';
    track.style.transform = `translateX(${-slide * 100}%)`;
    [...track.children].forEach((img, i) => { img.alt = i === slide ? captionFor(i) : ''; });
    box.setAttribute('aria-label', `사진 ${slide + 1}/${photos.images.length}`);
  });
  document.querySelectorAll('.about-d__image figcaption').forEach(c => { c.textContent = captionFor(slide); });
}
// 가로로 6px 넘게 움직이면 끌기로 보고 사진이 손을 따라온다. 폭의 15%를 넘기거나 빠르게 튕기면 넘어간다.
function swipeable(box) {
  let start = null;
  const track = box.firstElementChild;
  box.addEventListener('pointerdown', event => {
    if (event.button) return;
    start = { x: event.clientX, y: event.clientY, t: performance.now(), id: event.pointerId, dragging: false };
  });
  box.addEventListener('pointermove', event => {
    if (!start || event.pointerId !== start.id) return;
    const dx = event.clientX - start.x, dy = event.clientY - start.y;
    if (!start.dragging) {
      if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 6) { start = null; return; }   // 세로 스크롤
      if (Math.abs(dx) < 6) return;
      start.dragging = true;
      try { box.setPointerCapture(event.pointerId); } catch { /* 이미 끝난 포인터 */ }
      box.classList.add('is-dragging');
      track.style.transition = 'none';
    }
    // 처음·마지막 장에서 더 밀면 1/3만 따라온다.
    const edge = (slide === 0 && dx > 0) || (slide === photos.images.length - 1 && dx < 0);
    track.style.transform = `translateX(calc(${-slide * 100}% + ${edge ? dx / 3 : dx}px))`;
  });
  const end = event => {
    if (!start || event.pointerId !== start.id) return;
    const { dragging, x, t } = start;
    start = null;
    box.classList.remove('is-dragging');
    if (!dragging) return;
    const dx = event.clientX - x, fast = Math.abs(dx) / (performance.now() - t) > 0.4;
    const step = Math.abs(dx) > box.offsetWidth * 0.15 || (fast && Math.abs(dx) > 20) ? (dx < 0 ? 1 : -1) : 0;
    showSlide(slide + step);
  };
  box.addEventListener('pointerup', end);
  box.addEventListener('pointercancel', end);
  box.addEventListener('keydown', event => {
    const step = { ArrowRight: 1, ArrowLeft: -1 }[event.key];
    if (step) { event.preventDefault(); showSlide(slide + step); }
  });
}
const image = (data, className) => {
  photos = data;
  if (!data.images.length) return '';
  slide = Math.min(slide, data.images.length - 1);
  const figure = el('figure', className);
  if (data.images.length > 1) {
    const box = el('div', 'photo-slider'), track = el('div', 'photo-slider__track');
    box.tabIndex = 0;
    box.setAttribute('role', 'group');
    box.setAttribute('aria-roledescription', '슬라이드');
    track.append(...data.images.map(photo));
    track.style.transform = `translateX(${-slide * 100}%)`;
    box.setAttribute('aria-label', `사진 ${slide + 1}/${data.images.length}`);
    box.append(track);
    swipeable(box);
    figure.append(box);
  } else figure.append(Object.assign(photo(data.images[0]), { alt: captionFor(0) }));
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

  mobile.replaceChildren(title, figure, intro,
    block('구성원', 'Member', members),
    block('활동', 'Works', works),
    block('연락처', 'Contact', contactLinks(d.contacts, c => bi('dt', '', c.ko, c.en))));
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
  // 두 번째 탭: 바꾸려던 것을 취소한다(메뉴는 tap-menu.mjs가 연다).
  if (langPending) { clearTimeout(langPending); langPending = null; return; }
  if (!touch) { switchLang(); return; }
  langPending = setTimeout(() => { langPending = null; switchLang(); }, DOUBLE_TAP);
});
// 두 번째 탭은 탭 메뉴의 작은 원 위에 떨어지므로, 메뉴가 열렸다는 신호로도 첫 탭 동작을 취소한다.
document.addEventListener('tapmenu:open', () => {
  menuOpenedAt = performance.now();
  if (langPending) { clearTimeout(langPending); langPending = null; }
});
watchTab({ name: 'info', gid: TABS.info, headers: INFO_HEADERS, headerRow: 1, seed: seedFrom('info-seed'), render });
