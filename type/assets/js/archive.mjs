import { TABS, ARCHIVE_HEADERS, archiveFromRows } from './site-data.mjs?v=6';
import { initMenu, watchTab, seedFrom, el, linkify } from './site.mjs?v=6';

const PAGE_SIZE = 15;
const table = document.querySelector('.archive-table');
const pager = document.querySelector('.archive-pager');
const thumb = document.querySelector('.list-thumb img');
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const wait = ms => new Promise(r => setTimeout(r, reduced() ? 0 : ms));
let items = [], open = null, hovered = null, filter = null, page = 1, busy = false;

// 데스크톱 왼쪽 위 칸: 마우스를 올린(또는 키보드로 고른) 항목의 썸네일만 보여주고, 평소에는 비워둔다.
// 썸네일 img는 archive/index.html에 referrerpolicy="no-referrer"로 들어 있다(구글 드라이브 이미지).
function showThumb(item) {
  const src = item?.thumb || '';
  thumb.hidden = !src;
  if (src && thumb.getAttribute('src') !== src) { thumb.src = src; thumb.alt = item.ko || item.en; }
}

const categoriesOf = item => item.category.split(',').map(s => s.trim()).filter(Boolean);
const visibleItems = () => filter ? items.filter(item => categoriesOf(item).includes(filter)) : items;
const pageCount = () => Math.max(1, Math.ceil(visibleItems().length / PAGE_SIZE));

function panel(item, id) {
  // 바깥 칸의 높이를 0 ↔ 안쪽 칸 높이(px)로 움직인다.
  const box = el('div', 'archive-row__panel'), inner = el('div', 'archive-row__inner');
  box.id = id;
  if (item.images.length) {
    const images = el('div', 'archive-row__images');
    for (const src of item.images) {
      const img = el('img');
      img.referrerPolicy = 'no-referrer'; img.src = src; img.alt = ''; img.loading = 'lazy'; img.decoding = 'async';
      images.append(img);
    }
    inner.append(images);
  }
  if (item.descKo || item.descEn) {
    const text = el('div', 'archive-row__text');
    const para = (value, lang) => { const p = el('p'); p.lang = lang; p.append(...linkify(value)); return p; };
    if (item.descKo) text.append(para(item.descKo, 'ko'));
    if (item.descEn) text.append(para(item.descEn, 'en'));
    inner.append(text);
  }
  box.append(inner);
  return box;
}

// 줄임말 카테고리는 평소엔 줄임말, 눌러서 그 카테고리만 볼 때만 풀어 쓴다(좁은 화면에서 잘리지 않게).
const FULL_NAMES = { LC: 'Last Call' };
const categoryLabel = name => name === filter && FULL_NAMES[name] || name;

// 카테고리 낱말마다 버튼: 누르면 그 카테고리만, 같은 것을 다시 누르면 전체.
function categoryCell(item) {
  const cell = el('span', 'archive-row__category');
  categoriesOf(item).forEach((name, i) => {
    if (i) cell.append(', ');
    const button = el('button', 'archive-cat' + (name === filter ? ' is-active' : ''));
    button.append(categoryLabel(name));
    button.type = 'button';
    if (FULL_NAMES[name]) button.title = FULL_NAMES[name];
    button.setAttribute('aria-pressed', String(name === filter));
    button.addEventListener('click', () => setFilter(name === filter ? null : name));
    cell.append(button);
  });
  return cell;
}

// 누른 자리에서 그대로 아래로 펼쳐진다(화면을 위로 끌어올리지 않는다).
async function toggle(row, item) {
  const button = row.querySelector('.archive-row__button');
  const key = item.no;
  const current = table.querySelector('.archive-row.is-open');
  if (open === key) { open = null; close(row); return; }
  // 다른 항목이 열려 있으면 닫는다. 누른 항목보다 위에 있으면 움직임 없이 바로 접고
  // 그만큼 스크롤을 당겨서, 누른 항목이 손가락 아래 그 자리에 머물게 한다.
  if (current && current !== row) {
    if (current.compareDocumentPosition(row) & Node.DOCUMENT_POSITION_FOLLOWING) {
      const before = row.getBoundingClientRect().top;
      close(current, { instant: true });
      scrollBy(0, row.getBoundingClientRect().top - before);
    } else close(current);
  }
  open = key;
  const box = panel(item, `archive-${key}`);
  row.append(box);
  button.setAttribute('aria-expanded', 'true');
  row.classList.add('is-open');
  box.getBoundingClientRect();
  box.style.height = `${box.firstElementChild.offsetHeight}px`;
  box.classList.add('is-shown');
  await wait(400);
  // 다 열리면 auto로 풀어 사진이 늦게 불러와져도 높이가 따라가게 한다.
  if (box.isConnected && box.classList.contains('is-shown')) box.style.height = 'auto';
}

function close(row, { instant = false } = {}) {
  const box = row.querySelector('.archive-row__panel');
  row.classList.remove('is-open');
  row.querySelector('.archive-row__button').setAttribute('aria-expanded', 'false');
  if (!box) return;
  if (instant) { box.remove(); return; }
  // auto → 지금 높이(px) → 0 순서로 바꿔야 닫히는 움직임이 보인다.
  box.style.height = `${box.offsetHeight}px`;
  box.getBoundingClientRect();
  box.classList.remove('is-shown');
  box.style.height = '0px';
  setTimeout(() => box.remove(), reduced() ? 0 : 360);
}

// number: 지금 보이는 목록(카테고리로 걸렀으면 그 안)에서 가장 오래된 항목이 1번.
function rowFor(item, number) {
  const row = el('div', 'archive-row');
  const button = el('button', 'archive-row__button');
  button.type = 'button';
  button.append(el('span', '', `[${number}]`), el('span', 'archive-row__ko', item.ko || item.en), el('span', 'archive-row__en', item.en));
  const line = el('div', 'archive-row__line');
  line.append(button, categoryCell(item));
  row.append(line);
  if (item.images.length || item.descKo || item.descEn) {
    button.setAttribute('aria-controls', `archive-${item.no}`);
    button.setAttribute('aria-expanded', 'false');
    button.addEventListener('click', () => toggle(row, item));
    // 시트가 갱신돼 다시 그려져도 보고 있던 항목은 펼친 채로 둔다.
    if (open === item.no) {
      const box = panel(item, `archive-${item.no}`);
      box.classList.add('is-shown');
      box.style.height = 'auto';
      row.append(box);
      row.classList.add('is-open');
      button.setAttribute('aria-expanded', 'true');
    }
  } else button.disabled = true;
  const enter = () => { hovered = item.no; showThumb(item); };
  const leave = () => { if (hovered === item.no) { hovered = null; showThumb(null); } };
  row.addEventListener('pointerenter', enter);
  row.addEventListener('pointerleave', leave);
  button.addEventListener('focus', enter);
  button.addEventListener('blur', leave);
  return row;
}

function head() {
  const row = el('div', 'archive-head');
  row.append(el('span', '', 'No.'), el('span', '', 'TITLE'), el('span', 'archive-head__en'));
  const cell = el('span', 'archive-row__category');
  if (filter) {
    // 걸러 보는 중에는 머리말에 카테고리가 나오고, 누르면 전체로 돌아간다.
    const button = el('button', 'archive-cat is-active');
    button.append(categoryLabel(filter));
    button.type = 'button';
    button.setAttribute('aria-label', `${FULL_NAMES[filter] || filter}만 보는 중, 눌러서 전체 보기`);
    button.addEventListener('click', () => setFilter(null));
    cell.append(button);
  } else cell.append('CATEGORY');
  row.append(cell);
  return row;
}

function draw({ entering = false } = {}) {
  const list = visibleItems();
  page = Math.min(page, pageCount());
  const start = (page - 1) * PAGE_SIZE;
  const rows = list.slice(start, start + PAGE_SIZE).map((item, i) => rowFor(item, list.length - start - i));
  if (!rows.length) rows.push(el('p', 'archive-empty', '준비 중이에요.'));
  if (entering) rows.forEach((row, i) => { row.classList.add('is-entering'); row.style.animationDelay = `${Math.min(i, 10) * 20}ms`; });
  table.replaceChildren(head(), ...rows);
  // 걸러 보는 중에는 고르지 않은 카테고리를 회색으로.
  table.classList.toggle('is-filtered', Boolean(filter));
  drawPager();
  showThumb(items.find(item => item.no === hovered));
}

// 페이지 번호: ← 1 2 3 →, 지금 페이지는 밑줄. 한 페이지뿐이면 숨긴다.
function drawPager() {
  const count = pageCount();
  pager.hidden = count < 2;
  if (count < 2) { pager.replaceChildren(); return; }
  const button = (label, target, aria, current = false) => {
    const b = el('button', 'archive-pager__item' + (current ? ' is-current' : ''), label);
    b.type = 'button';
    b.setAttribute('aria-label', aria);
    if (current) b.setAttribute('aria-current', 'page');
    b.disabled = target < 1 || target > count;
    b.addEventListener('click', () => goTo(target));
    return b;
  };
  pager.replaceChildren(
    button('←', page - 1, '이전 페이지'),
    ...Array.from({ length: count }, (_, i) => button(String(i + 1), i + 1, `${i + 1}페이지`, i + 1 === page)),
    button('→', page + 1, '다음 페이지'));
}

// 바뀔 때는 지금 목록이 옅어진 뒤 새 목록이 한 줄씩 나타난다(디졸브).
async function transition(change) {
  if (busy) return;
  busy = true;
  table.classList.add('is-leaving');
  await wait(180);
  change();
  open = null;
  table.classList.remove('is-leaving');
  draw({ entering: true });
  busy = false;
}

function setFilter(name) {
  transition(() => { filter = name; page = 1; });
}

function goTo(target) {
  transition(() => { page = target; });
  const top = table.getBoundingClientRect().top + scrollY - document.querySelector('.topbar').offsetHeight - 16;
  if (scrollY > top) scrollTo({ top, behavior: reduced() ? 'auto' : 'smooth' });
}

function render(rows) {
  items = archiveFromRows(rows);
  if (filter && !items.some(item => categoriesOf(item).includes(filter))) filter = null;
  draw();
}

initMenu();
watchTab({ name: 'archive', gid: TABS.archive, headers: ARCHIVE_HEADERS, seed: seedFrom('archive-seed'), render });
