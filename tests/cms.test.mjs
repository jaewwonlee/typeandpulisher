import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { parseCSV, recordsFromCSV, safeAsset, vimeoEmbed, ratio, videoContain, imageURLs, imageSource } from '../type/assets/js/cms-data.mjs';
import { rowsFromCSV, infoFromRows, archiveFromRows, contactLink, dateKey, tapColor, INFO_HEADERS, ARCHIVE_HEADERS } from '../type/assets/js/site-data.mjs';
const seed = JSON.parse(fs.readFileSync(new URL('../cms-seed.json', import.meta.url), 'utf8'));
const manifest = JSON.parse(fs.readFileSync(new URL('../type/assets/js/font-manifest.json', import.meta.url), 'utf8'));
const csv = rows => rows.map(row => row.map(v => '"' + String(v).replaceAll('"', '""') + '"').join(',')).join('\r\n');
test('CSV handles bilingual paragraphs, escaped quotes, commas, BOM, and empty last field', () => {
  const values = [['국문','영문','빈칸'],['줄1\n줄2','"Room", margin','']];
  assert.deepEqual(parseCSV('\uFEFF'+csv(values)+'\r\n'),values);
  assert.throws(() => parseCSV('"unfinished'));
});
test('CMS preserves all five rows, exact descriptions, videos and colors', () => {
  const records = recordsFromCSV(csv([seed.headers,...seed.rows]));
  assert.equal(records.length,5);
  assert.equal(records[0]['서체 소개 국문'],seed.rows[0][7]);
  assert.equal(records[4]['Vimeo URL'],'https://vimeo.com/1230525322');
  assert.equal(records[2]['대표색'],seed.rows[2][seed.headers.indexOf('대표색')]);
});
test('Incomplete paste, duplicate addresses, bad colors and changed headers cannot replace live data', () => {
  assert.throws(() => recordsFromCSV(csv([seed.headers,...seed.rows.slice(1)])));
  const duplicate = structuredClone(seed.rows); duplicate[4][0]='cake';
  assert.throws(() => recordsFromCSV(csv([seed.headers,...duplicate])));
  const invalid = structuredClone(seed.rows); invalid[0][5]='red';
  assert.throws(() => recordsFromCSV(csv([seed.headers,...invalid])));
  assert.throws(() => recordsFromCSV('<html>Sign in</html>'));
});
test('Only safe assets and Vimeo players are embedded; unlisted hashes survive', () => {
  assert.equal(safeAsset('javascript:alert(1)'), '');
  assert.equal(safeAsset('//evil.example/test'), '');
  assert.equal(safeAsset('/type/assets/fonts/Witz.woff2'),'/type/assets/fonts/Witz.woff2');
  assert.equal(vimeoEmbed('https://evil.example/123'), '');
  assert.match(vimeoEmbed('https://vimeo.com/123/abc123'), /h=abc123/);
  assert.match(vimeoEmbed('https://vimeo.com/123?fl=ip&fe=ec'), /\/video\/123\?/);
  assert.deepEqual(ratio('32:9'),[32,9]);
  assert.deepEqual(ratio('9:16'),[9,16]);
  assert.deepEqual(ratio('0:0'),[16,9]);
});
test('16:9 frame contains wide and narrow videos without cropping', () => {
  assert.deepEqual(videoContain('16:9'),{width:100,height:100});
  assert.deepEqual(videoContain('32:9'),{width:100,height:50});
  assert.deepEqual(videoContain('4:3'),{width:75,height:100});
  assert.deepEqual(videoContain('9:16'),{width:31.640625,height:100});
});
test('All pages preserve the six-row original information layout and original core order', () => {
  const original = JSON.parse(fs.readFileSync(new URL('../type/assets/js/witz-core-glyphs.json',import.meta.url),'utf8'));
  for (const row of seed.rows) {
    const slug = row[0];
    const html = fs.readFileSync(new URL(`../type/${slug}/index.html`,import.meta.url),'utf8');
    const labels = [...html.matchAll(/<th scope="row">([^<]+)<\/th>/g)].map(m=>m[1]);
    assert.deepEqual(labels,['디자인','제작 연도','버전','포맷','글리프','문의']);
    assert.match(html,/2025–2026/);
    assert.match(html,/<title>TAP \| /);
    assert.match(html,/href="\/favicon.png"/);
    assert.match(html,/Under Construction/);
    assert.match(html,/class="hero__stage"/);
    assert.match(html,/<details class="type-menu">/);
    assert.equal([...html.matchAll(/>Type\/<span class="type-menu__name">(Cake|Giul|Rooms|Umm|Witz)<\/span><\/a>/g)].length,5);
    assert.ok(!html.includes('kiosk'));
    const core = JSON.parse(fs.readFileSync(new URL(`../type/assets/js/${slug}-core.json`,import.meta.url),'utf8'));
    assert.deepEqual(core,original.filter(cp=>core.includes(cp)));
    assert.equal(core.length, manifest[slug].count);
    assert.ok(core.length<=216);
    assert.ok(!html.includes('data-full'));
  }
});

test('Type index replaces history with one of exactly five detail routes', () => {
  const html = fs.readFileSync(new URL('../type/index.html',import.meta.url),'utf8');
  const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
  for (const [i,slug] of ['cake','giul','rooms','umm','witz'].entries()) {
    let destination;
    vm.runInNewContext(script,{Math:{random:()=>i/5+.01,floor:Math.floor},location:{replace:url=>destination=url}});
    assert.equal(destination,`/type/${slug}/`);
  }
  assert.match(html,/<body>\s*<\/body>/);
});

test('Gallery splits line-separated image URLs and rejects unsafe entries', () => {
  assert.deepEqual(imageURLs(' https://example.com/a.png\r\n\n/type/assets/images/tap-symbol.svg '), ['https://example.com/a.png','/type/assets/images/tap-symbol.svg']);
  assert.deepEqual(imageURLs(''), []);
  assert.throws(() => imageURLs('https://example.com/a.png\njavascript:alert(1)'));
  const rows = structuredClone(seed.rows);
  rows[0][seed.headers.indexOf('사용 예시 이미지')] = 'https://example.com/a.png\nhttps://example.com/b.png';
  assert.equal(recordsFromCSV(csv([seed.headers,...rows])).length, 5);
});

test('Info tab reads the header row under the group row and splits blocks by column', () => {
  const group = ['기본 정보', ...Array(8).fill(''), '구성원', '', '활동', '', '', '연락처', '', ''];
  assert.equal(group.length, INFO_HEADERS.length);
  assert.throws(() => rowsFromCSV(csv([group, ['구분','국문']]), INFO_HEADERS, 1));
  assert.throws(() => rowsFromCSV('<html>Sign in</html>', INFO_HEADERS, 1));
  assert.deepEqual(rowsFromCSV(csv([group, INFO_HEADERS]), INFO_HEADERS, 1), []);
  const row = values => INFO_HEADERS.map(h => values[h] || '');
  const rows = rowsFromCSV(csv([group, INFO_HEADERS,
    // 맨 위에 끼워 넣은 줄: 기본 정보가 아래로 밀려도 찾아 읽어야 한다.
    row({ '구성원 국문': '김민서', '구성원 영문': 'Minseo Kim', '활동 날짜': '25. 10', '활동 국문': 'TAP 결성', '활동 영문': 'TAP Founded' }),
    row({ '제목 국문': '타입앤퍼블리셔', '소개 국문': '첫 문단\n\n둘째 문단', '소개 영문': 'First', '이미지': 'https://drive.google.com/file/d/AbC_12-x/view?usp=sharing\n/images/b.jpg', '이미지 설명': '캡션', '탭 메뉴 색': '#ff0000',
      '구성원 국문': '박시은', '활동 날짜': '26. 9', '활동 국문': '첫 전시', '연락처 항목 국문': '이메일', '연락처 항목 영문': 'Email', '연락처 주소': 'typeandpublisher@gmail.com' }),
    row({ '활동 국문': '날짜 없음', '연락처 항목 국문': '인스타그램', '연락처 주소': 'https://www.instagram.com/typeandpublisher/' }),
    row({ '연락처 항목 국문': '나쁨', '연락처 주소': 'javascript:alert(1)' }),
  ]), INFO_HEADERS, 1);
  const info = infoFromRows(rows);
  assert.equal(info.title.ko, '타입앤퍼블리셔');
  assert.equal(info.title.en, 'Typeandpublisher');
  assert.deepEqual(info.intro, [{ ko: '첫 문단', en: 'First' }, { ko: '둘째 문단', en: '' }]);
  assert.deepEqual(info.images, ['https://lh3.googleusercontent.com/d/AbC_12-x=w2400', '/images/b.jpg']);
  assert.equal(info.caption, '캡션');
  assert.equal(info.tapColor, '#ff0000');
  assert.deepEqual(info.members.map(m => m.ko), ['김민서', '박시은']);
  assert.deepEqual(info.works.map(w => w.ko), ['첫 전시', 'TAP 결성', '날짜 없음']);
  assert.deepEqual(info.contacts.map(c => c.link.text), ['typeandpublisher@gmail.com', '@typeandpublisher']);
  assert.equal(contactLink('https://vimeo.com/user263951849').text, 'https://vimeo.com/user263951849');
});

test('Dates sort newest first in several spellings; tap color falls back to #15B9FF', () => {
  assert.equal(dateKey('2026.09.27'), 20260927);
  assert.equal(dateKey('2026. 9'), 20260900);
  assert.equal(dateKey('26. 9'), 20260900);
  assert.equal(dateKey('2026-10-01'), 20261001);
  assert.equal(dateKey(''), null);
  assert.equal(tapColor('#15b9ff'), '#15b9ff');
  assert.equal(tapColor('blue'), '#15B9FF');
  assert.equal(tapColor(''), '#15B9FF');
});

test('Google Drive share links become image addresses; other hosts are unchanged', () => {
  assert.equal(imageSource('https://drive.google.com/open?id=XYZ'), 'https://lh3.googleusercontent.com/d/XYZ=w2400');
  assert.equal(imageSource('https://drive.google.com/uc?export=view&id=XYZ'), 'https://lh3.googleusercontent.com/d/XYZ=w2400');
  assert.equal(imageSource('https://drive.google.com/drive/folders/XYZ'), 'https://drive.google.com/drive/folders/XYZ');
  assert.equal(imageSource('https://example.com/a.jpg'), 'https://example.com/a.jpg');
  assert.equal(imageSource('javascript:alert(1)'), '');
  assert.deepEqual(imageURLs('https://drive.google.com/file/d/A1/view\n/images/b.jpg'), ['https://lh3.googleusercontent.com/d/A1=w2400', '/images/b.jpg']);
});

test('Archive shows only checked rows, newest date first, numbered in order, first photo as thumbnail', () => {
  const items = archiveFromRows(rowsFromCSV(csv([ARCHIVE_HEADERS,
    ['2026.08.10', 'TRUE', '한강 상영회', '', 'LC, Event', '', '', ''],
    ['', 'TRUE', '날짜 없음', '', '', '', '', ''],
    ['2026.09.27', 'TRUE', '설치', '', 'LC', 'https://example.com/a.jpg\njavascript:alert(1)\n/archive/b.jpg', '국문', 'English'],
    ['2026.10', 'FALSE', '숨김', '', '', '', '', ''],
    ['2026.10', '', '체크 안 함', '', '', '', '', ''],
    ['', '', '', '', '', '', '', ''],
  ]), ARCHIVE_HEADERS));
  assert.deepEqual(items.map(i => [i.no, i.ko]), [['1', '설치'], ['2', '한강 상영회'], ['3', '날짜 없음']]);
  assert.deepEqual(items[0].images, ['https://example.com/a.jpg', '/archive/b.jpg']);
  assert.equal(items[0].thumb, 'https://example.com/a.jpg');
  assert.equal(items[1].thumb, '');
});

test('New pages share the topbar menu and mark their own route', () => {
  for (const [path, label, href] of [['../index.html','Info','/'],['../archive/index.html','Archive','/archive/'],['../publish/index.html','Publish','/publish/']]) {
    const html = fs.readFileSync(new URL(path, import.meta.url), 'utf8');
    assert.match(html, new RegExp(`<summary aria-label="페이지 메뉴">/${label}</summary>`));
    assert.match(html, new RegExp(`<a aria-current="page" href="${href}">TAP/<span class="type-menu__name">${label}</span></a>`));
    assert.equal([...html.matchAll(/aria-current="page"/g)].length, 1);
    assert.ok(!html.includes('kiosk'));
    assert.match(html, /tap-menu\.mjs/);
  }
  assert.match(fs.readFileSync(new URL('../publish/index.html', import.meta.url), 'utf8'), /<p class="soon">출간 예정<\/p>/);
});
