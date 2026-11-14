import { SHEET_ID } from './cms-data.mjs?v=7';
import { TABS, INFO_HEADERS, rowsFromCSV, infoFromRows } from './site-data.mjs?v=6';

// 이스터에그: 푸터의 춤추는 이모티콘을 누르면 그 위에 말풍선으로 웹 크레딧이 나온다(모든 페이지).
// 이름·역할은 운영 시트 Info 탭의 '크레딧' 열에서 읽고, 못 읽으면 아래 사본을 쓴다.
const FALLBACK = [
  { ko: '웹 디자인', people: [{ ko: '이재원', href: 'https://www.instagram.com/zhotd/' }, { ko: '최지원', href: 'https://www.instagram.com/jiwoniese/' }] },
  { ko: '웹 개발', people: [{ ko: '최지원', href: 'https://www.instagram.com/jiwoniese/' }] },
];
const CONTACT = 'ji-won-choi@naver.com';
// 시트의 역할 이름을 말풍선에서는 '웹 ○○'로 맞춰 보여준다.
const ROLE = { 웹디자인: '웹 디자인', 디자인: '웹 디자인', 개발: '웹 개발', 웹개발: '웹 개발' };
// 페이지마다 말풍선 맨 아래에 붙는 출처(작게). Publish 그림은 pjb의 아스키 아트.
const PAGE_NOTE = { publish: 'original ascii art by pjb' }[document.body.dataset.page];
const CACHE_KEY = `tap-site-cms-v3:${SHEET_ID}:${TABS.info}`;   // site.mjs와 같은 저장소 키(Info 탭 마지막 정상본)

const make = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
};

function creditsFrom(csv) {
  try { return infoFromRows(rowsFromCSV(csv, INFO_HEADERS, 1)).credits; } catch { return []; }
}

let credits = FALLBACK, fetched = false;
try {
  const saved = JSON.parse(localStorage.getItem(CACHE_KEY));
  const list = saved?.csv && creditsFrom(saved.csv);
  if (list?.length) credits = list;
} catch { /* 저장소 없이도 사본으로 보여준다. */ }

async function refresh() {
  if (fetched) return;
  fetched = true;
  try {
    const response = await fetch(`https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${TABS.info}&_=${Date.now()}`, { cache: 'no-store' });
    if (!response.ok) return;
    const list = creditsFrom(await response.text());
    if (list.length) { credits = list; document.querySelectorAll('.credit-bubble').forEach(fill); }
  } catch { /* 사본 그대로 */ }
}

function fill(bubble) {
  const list = make('dl', 'credit-bubble__list');
  for (const group of credits) {
    const dd = make('dd');
    group.people.forEach((p, i) => {
      if (i) dd.append(', ');
      const name = p.ko || p.en;
      if (!p.href) { dd.append(name); return; }
      const a = make('a', '', name);
      a.href = p.href; a.target = '_blank'; a.rel = 'noopener';
      dd.append(a);
    });
    const role = group.ko || group.en;
    list.append(make('dt', '', ROLE[role.replace(/\s/g, '')] || role), dd);
  }
  const note = make('p', 'credit-bubble__note', '웹사이트를 둘러보다 오류를 발견했거나 궁금한 점이 있다면 아래 메일로 편하게 알려주세요.');
  const mail = make('a', 'credit-bubble__mail', CONTACT);
  mail.href = `mailto:${CONTACT}`;
  const extra = PAGE_NOTE ? [make('p', 'credit-bubble__source', PAGE_NOTE)] : [];
  bubble.querySelector('.credit-bubble__body').replaceChildren(list, note, mail, ...extra);
}

function setup(mark) {
  if (mark.closest('.credit-anchor')) return;
  const anchor = make('span', 'credit-anchor');
  mark.replaceWith(anchor);
  anchor.append(mark);
  mark.removeAttribute('aria-hidden');
  mark.setAttribute('role', 'button');
  mark.setAttribute('tabindex', '0');
  mark.setAttribute('aria-label', '웹 크레딧 보기');
  mark.setAttribute('aria-expanded', 'false');
  mark.dataset.tapMenuIgnore = '';
  // 그림 글자(\(^__^) 등)는 화면 읽기 프로그램이 한 글자씩 읽지 않게 숨긴다.
  [...mark.children].forEach(span => span.setAttribute('aria-hidden', 'true'));

  const bubble = make('div', 'credit-bubble');
  bubble.id = `credit-bubble-${Math.random().toString(36).slice(2, 8)}`;
  bubble.setAttribute('role', 'dialog');
  bubble.setAttribute('aria-label', '웹 크레딧');
  bubble.dataset.tapMenuIgnore = '';
  bubble.hidden = true;
  bubble.append(make('div', 'credit-bubble__body'));
  mark.setAttribute('aria-controls', bubble.id);
  anchor.append(bubble);

  // pinned: 눌러서 연 말풍선(마우스를 떼도 남는다). 호버로만 열린 말풍선은 마우스가 떠나면 닫힌다.
  let pinned = false, leaveTimer = 0;
  const toggle = () => { if (bubble.hidden) { show(); pinned = true; } else if (!pinned) { pinned = true; pop(); } else hide(); };
  // 호버로 열린 말풍선을 누르면 위로 5px 살짝 '띵' 튀어올랐다 내려와 고정됐다는 걸 보여준다.
  function pop() {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    bubble.animate(
      [{ translate: '0 0' }, { translate: '0 -5px', offset: 0.35, easing: 'cubic-bezier(.3, .7, .4, 1)' }, { translate: '0 0' }],
      { duration: 280, easing: 'cubic-bezier(.2, .8, .3, 1)' });
  }
  function show() {
    document.querySelectorAll('.credit-bubble:not([hidden])').forEach(b => b !== bubble && b.closeBubble());
    fill(bubble);
    bubble.hidden = false;
    mark.setAttribute('aria-expanded', 'true');
    place();
    bubble.getBoundingClientRect();
    bubble.classList.add('is-shown');
    void refresh();
  }
  function hide() {
    pinned = false;
    clearTimeout(leaveTimer);
    if (bubble.hidden) return;
    bubble.classList.remove('is-shown');
    mark.setAttribute('aria-expanded', 'false');
    const done = () => { if (!bubble.classList.contains('is-shown')) bubble.hidden = true; };
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) done(); else setTimeout(done, 180);
  }
  // 말풍선은 이모티콘 가운데 위에 뜨고, 화면 밖으로 나가면 안쪽으로 밀어 넣는다(꼬리는 계속 이모티콘을 가리킨다).
  function place() {
    bubble.style.setProperty('--shift', '0px');
    const rect = bubble.getBoundingClientRect(), pad = 16;
    const shift = Math.min(0, innerWidth - pad - rect.right) + Math.max(0, pad - rect.left);
    bubble.style.setProperty('--shift', `${shift}px`);
  }
  bubble.closeBubble = hide;
  mark.addEventListener('click', toggle);
  // 데스크톱(마우스): 이모티콘에 올리면 바로 열리고, 말풍선 쪽으로 옮기는 동안(0.3초)은 닫히지 않아 메일 링크를 누를 수 있다.
  const canHover = matchMedia('(hover: hover) and (pointer: fine)');
  mark.addEventListener('pointerenter', () => { if (canHover.matches && bubble.hidden) show(); });
  anchor.addEventListener('pointerenter', () => clearTimeout(leaveTimer));
  anchor.addEventListener('pointerleave', () => {
    if (!canHover.matches || pinned) return;
    clearTimeout(leaveTimer);
    leaveTimer = setTimeout(hide, 300);
  });
  mark.addEventListener('keydown', event => {
    if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); bubble.hidden ? toggle() : hide(); }
  });
  document.addEventListener('click', event => { if (!anchor.contains(event.target)) hide(); });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !bubble.hidden) { hide(); mark.focus(); }
  });
  addEventListener('resize', () => { if (!bubble.hidden) place(); });
}

// Info 데스크톱 푸터는 시트를 읽은 뒤 다시 그려지므로 새로 생기는 마크도 잡는다.
export function initCredits() {
  const scan = () => document.querySelectorAll('.footer__mark').forEach(setup);
  scan();
  new MutationObserver(scan).observe(document.body, { childList: true, subtree: true });
}
