import { TABS, INFO_HEADERS, infoFromRows } from './site-data.mjs?v=3';
import { initMenu, watchTab, seedFrom, el } from './site.mjs?v=2';

const body = document.body;
const mobile = document.querySelector('.about-m');
const desk = document.querySelector('.about-d');

// 국문/영문을 같이 넣고 CSS가 고른다. 영문이 비면 국문을 대신 보여준다.
const bi = (tag, className, ko, en) => {
  const node = el(tag, ['bi', className].filter(Boolean).join(' '));
  node.append(Object.assign(el('span', '', ko || ''), { lang: 'ko' }), Object.assign(el('span', '', en || ko || ''), { lang: 'en' }));
  return node;
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
// 사진이 여러 장이면 누를 때마다 다음 장으로 넘어간다(모바일·데스크톱 같은 순번).
let slide = 0;
const image = (data, className) => {
  if (!data.images.length) return '';
  slide %= data.images.length;
  const figure = el('figure', className), img = el('img');
  // 구글 드라이브 이미지(lh3)는 Referer가 붙으면 간헐적으로 403을 준다.
  img.referrerPolicy = 'no-referrer'; img.src = data.images[slide]; img.alt = data.caption; img.decoding = 'async';
  if (data.images.length > 1) {
    const button = el('button', 'photo-slider');
    button.type = 'button';
    button.setAttribute('aria-label', `사진 ${slide + 1}/${data.images.length}, 눌러서 다음 사진`);
    button.addEventListener('click', () => {
      slide = (slide + 1) % data.images.length;
      document.querySelectorAll('.photo-slider').forEach(b => {
        b.querySelector('img').src = data.images[slide];
        b.setAttribute('aria-label', `사진 ${slide + 1}/${data.images.length}, 눌러서 다음 사진`);
      });
      Object.assign(new Image(), { referrerPolicy: 'no-referrer', src: data.images[(slide + 1) % data.images.length] });
    });
    button.append(img);
    figure.append(button);
  } else figure.append(img);
  if (data.caption) figure.append(el('figcaption', '', data.caption));
  return figure;
};

function renderMobile(d) {
  const title = el('h1', 'page-title');
  const titleButton = bi('button', 'lang-toggle', d.title.ko, d.title.en);
  titleButton.type = 'button';
  title.append(titleButton);
  const intro = el('button', 'about-m__intro lang-toggle bi');
  intro.type = 'button';
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
  for (const m of d.members) { const li = el('li'); li.append(el('span', '', m.ko), el('span', '', m.en)); members.append(li); }
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
    const list = key => { const ul = el('ul', `members members--${key}`); for (const m of d.members) ul.append(el('li', '', m[key] || m.ko)); return ul; };
    grid.append(cell('about-d__head', el('h2', '', '구성원')), cell('about-d__head', el('h2', '', 'Member')),
      cell('about-d__list', list('ko')), cell('about-d__list', list('en')));
  }
  if (d.works.length) {
    grid.append(cell('about-d__head about-d__head--works', el('h2', '', '활동')), cell('about-d__head about-d__head--works'));
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

initMenu();
body.dataset.lang = 'ko';
let timer;
mobile.addEventListener('click', event => {
  const button = event.target.closest('.lang-toggle');
  if (!button || button.disabled) return;
  const toggles = mobile.querySelectorAll('.lang-toggle');
  toggles.forEach(t => t.classList.add('is-changing'));
  clearTimeout(timer);
  timer = setTimeout(() => {
    body.dataset.lang = body.dataset.lang === 'ko' ? 'en' : 'ko';
    document.documentElement.lang = body.dataset.lang;
    toggles.forEach(t => t.classList.remove('is-changing'));
  }, matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 160);
});
watchTab({ name: 'info', gid: TABS.info, headers: INFO_HEADERS, headerRow: 1, seed: seedFrom('info-seed'), render });
