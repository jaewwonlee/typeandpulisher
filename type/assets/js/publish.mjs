import { TABS, PUBLISH_HEADERS } from './site-data.mjs?v=6';
import { initMenu, watchTab, sideIntro, el } from './site.mjs?v=9';

// 출간물 디자인이 정해지기 전까지는 시트의 제목만 반영하고 본문은 아스키 아트 그림으로 둔다.
const side = document.querySelector('.list-side .page-title');
const mobile = document.querySelector('.list-main > .page-title');
const fallback = mobile.textContent;

function render(rows) {
  sideIntro(rows);
  const title = rows.find(r => r['제목'])?.['제목'] || fallback;
  mobile.textContent = title;
  side.firstChild.textContent = title;
}

// 아스키 아트를 사이트 글꼴(Atlas Grotesk·Noto Sans KR)로 그린다. 글자 폭이 제각각인 글꼴이라
// 한 글자씩 같은 폭의 칸(그리드)에 넣어 줄을 맞춘다. '_'는 칸을 꽉 채우는 1px 선으로 그린다(글꼴의 _는 칸보다 짧아 끊겨 보임).
// 왼쪽 LEFT칸·오른쪽 RIGHT칸은 고정, 그 사이는 화면 폭에 따라 늘고 줄며 3~5번째 줄 가운데에 문구가 들어간다.
const LEFT = 12, MID_END = 41, RIGHT = 15, TEXT_ROWS = [3, 6];

const BOOKS = {
  1: ['', '     _______', '    / _____', '   / /    /|', '  / /    //', ' / (====|/'],
  2: ['     _____', '    /    /|_', '   /    //', '  (====|/', '  (=====|/', ' /'],
  3: ['    _____', '   /    /|_', '  /    // /|', ' (====|/ //', '  (=====|/', ' (====|/'],
};
const ITEMS = {
  pencil: ['\\|/', '|_|', '|_|'],
  coffee: [' ) )', '(   )', 'c[_]'],
  lamp: [' .--.', '/____\\', ' _|_ '],
  plant: [' \\|/', '_|_|_', '\\___/'],
};
const RARE = {
  cat: [' /\\_/\\', '( o.o )', ' > ^ <'],
  mouse: [' ()()', ' (..)', '(")(")~'],
  hamster: ['  n n', '(=o.o=)', ' (")(")'],
};
const RARE_CHANCE = 1 / 20;
const ITEM_COL = 42, ITEM_WIDTH = 7;
const pick = list => list[Math.floor(Math.random() * list.length)];

function vary(lines) {
  const query = new URLSearchParams(location.search);
  const books = BOOKS[query.get('books')] || BOOKS[pick(Object.keys(BOOKS))];
  const pool = Math.random() < RARE_CHANCE ? RARE : ITEMS;
  const item = ITEMS[query.get('item')] || RARE[query.get('item')] || pool[pick(Object.keys(pool))];
  const put = (row, col, width, text) => {
    const chars = [...(lines[row] || '').padEnd(MID_END + RIGHT)];
    chars.splice(col, width, ...text.padEnd(width).slice(0, width));
    lines[row] = chars.join('');
  };
  books.forEach((text, row) => put(row, 0, LEFT, text));
  const width = Math.max(...item.map(line => line.length));
  const start = ITEM_COL + Math.floor((ITEM_WIDTH - width) / 2);
  item.forEach((text, i) => {
    put(TEXT_ROWS[0] + i, ITEM_COL, ITEM_WIDTH, '');
    put(TEXT_ROWS[0] + i, start, text.length, text);
  });
  return lines;
}
function drawArt() {
  const pre = document.querySelector('.soon__art'), text = document.querySelector('.soon__text');
  if (!pre) return;
  const grid = el('div', 'soon__grid');
  grid.setAttribute('aria-hidden', 'true');
  grid.style.setProperty('--left', LEFT);
  grid.style.setProperty('--right', RIGHT);
  const place = (node, row, column) => { node.style.gridRow = row + 1; node.style.gridColumn = column; return node; };
  vary(pre.textContent.replace(/^\n/, '').split('\n')).forEach((line, row) => {
    const chars = [...line.padEnd(MID_END + RIGHT)];
    const cell = (ch, column) => {
      if (ch === ' ') return;
      grid.append(place(ch === '_' ? el('span', 'soon__bar') : el('span', '', ch), row, column));
    };
    chars.slice(0, LEFT).forEach((ch, i) => cell(ch, i + 1));
    // 가운데 칸: 밑줄로 꽉 찼으면 늘어나는 선 하나, 비었으면 그대로 비운다.
    if (/^_+$/.test(chars.slice(LEFT, MID_END).join(''))) grid.append(place(el('span', 'soon__bar'), row, LEFT + 1));
    chars.slice(MID_END, MID_END + RIGHT).forEach((ch, i) => cell(ch, LEFT + 2 + i));
  });
  if (text) {
    text.style.gridRow = `${TEXT_ROWS[0] + 1} / ${TEXT_ROWS[1] + 1}`;
    text.style.gridColumn = LEFT + 1;
    grid.append(text);
  }
  pre.replaceWith(grid);
}

drawArt();
initMenu();
watchTab({ name: 'publish', gid: TABS.publish, headers: PUBLISH_HEADERS, seed: [], render });
