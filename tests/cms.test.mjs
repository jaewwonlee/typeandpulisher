import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { parseCSV, recordsFromCSV, safeAsset, vimeoEmbed, ratio, videoContain } from '../type/assets/js/cms-data.mjs';
const seed = JSON.parse(fs.readFileSync(new URL('../cms-seed.json', import.meta.url), 'utf8'));
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
  assert.equal(records[2]['대표색'],'#123456');
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
    assert.match(html,/<details class="type-menu">/);
    assert.equal([...html.matchAll(/>TAP\/(Cake|Giul|Rooms|Umm|Witz)<\/a>/g)].length,5);
    const core = JSON.parse(fs.readFileSync(new URL(`../type/assets/js/${slug}-core.json`,import.meta.url),'utf8'));
    assert.deepEqual(core,original.filter(cp=>core.includes(cp)));
    assert.ok(core.length<=216 && core.length>=200);
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
