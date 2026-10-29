import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { parseCSV, recordsFromCSV, safeAsset, vimeoEmbed, ratio, videoContain, imageURLs } from '../type/assets/js/cms-data.mjs';
import { rowsFromCSV, infoFromRows, archiveFromRows, contactLink, INFO_HEADERS, ARCHIVE_HEADERS } from '../type/assets/js/site-data.mjs';
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
    assert.match(html,/Under Constructure/);
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

test('Info/Archive tabs keep last good data when headers change and group rows by 구분', () => {
  assert.throws(() => rowsFromCSV(csv([['구분','국문']]), INFO_HEADERS));
  assert.throws(() => rowsFromCSV('<html>Sign in</html>', INFO_HEADERS));
  assert.deepEqual(rowsFromCSV(csv([INFO_HEADERS]), INFO_HEADERS), []);
  const rows = rowsFromCSV(csv([INFO_HEADERS,
    ['소개','첫 문단\n둘째 줄','First',' ',''],
    ['구성원','김민서','Minseo Kim','',''],
    ['활동','TAP 결성','TAP Founded','','25. 10'],
    ['연락처','이메일','Email','typeandpublisher@gmail.com',''],
    ['연락처','인스타그램','Instagram','https://www.instagram.com/typeandpublisher/',''],
    ['연락처','나쁨','Bad','javascript:alert(1)',''],
    ['이미지','캡션','','http://insecure.example/a.png',''],
    ['모르는 구분','x','y','',''],
  ]), INFO_HEADERS);
  const info = infoFromRows(rows);
  assert.equal(info.title.ko, '타입앤퍼블리셔');
  assert.equal(info.intro[0].ko, '첫 문단\n둘째 줄');
  assert.deepEqual(info.works, [{ date: '25. 10', ko: 'TAP 결성', en: 'TAP Founded' }]);
  assert.deepEqual(info.contacts.map(c => c.link.text), ['typeandpublisher@gmail.com', '@typeandpublisher']);
  assert.equal(info.image, null);
  assert.equal(contactLink('https://vimeo.com/user263951849').text, 'https://vimeo.com/user263951849');
});

test('Archive rows split images per line, drop unsafe ones and fall back to the first image as thumbnail', () => {
  const [item] = archiveFromRows(rowsFromCSV(csv([ARCHIVE_HEADERS,
    ['1','과천 나들이','MMCA Picnic','Event','','https://example.com/a.jpg\njavascript:alert(1)\n/archive/b.jpg','국문','English'],
    ['','','','','','','',''],
  ]), ARCHIVE_HEADERS));
  assert.deepEqual(item.images, ['https://example.com/a.jpg', '/archive/b.jpg']);
  assert.equal(item.thumb, 'https://example.com/a.jpg');
});

test('New pages share the topbar menu and mark their own route', () => {
  for (const [path, label, href] of [['../index.html','Info','/'],['../archive/index.html','Archive','/archive/'],['../publish/index.html','Publish','/publish/']]) {
    const html = fs.readFileSync(new URL(path, import.meta.url), 'utf8');
    assert.match(html, new RegExp(`<summary aria-label="페이지 메뉴">/${label}</summary>`));
    assert.match(html, new RegExp(`<a aria-current="page" href="${href}">TAP/<span class="type-menu__name">${label}</span></a>`));
    assert.equal([...html.matchAll(/aria-current="page"/g)].length, 1);
    assert.ok(!html.includes('kiosk'));
  }
  assert.match(fs.readFileSync(new URL('../publish/index.html', import.meta.url), 'utf8'), /<p class="soon">출간 예정<\/p>/);
});
