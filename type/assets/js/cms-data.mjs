export const SHEET_ID = '1--3NU9grVjGsIfl_JgB5AwL_R2JYELGBLxGbCXQuMMc';
export const SHEET_GID = '540036586';
export const SLUGS = ['cake', 'giul', 'rooms', 'umm', 'witz'];

export function accentInk(hex) {
  const rgb = [1,3,5].map(i => parseInt(hex.slice(i,i+2),16)/255).map(v => v <= .04045 ? v/12.92 : ((v+.055)/1.055)**2.4);
  return rgb[0]*.2126 + rgb[1]*.7152 + rgb[2]*.0722 > .179 ? '#111111' : '#ffffff';
}

// CSV cells may contain commas, escaped quotes, CRLF, and paragraphs.
export function parseCSV(source) {
  const rows = []; let row = [], cell = '', quoted = false;
  const text = source.replace(/^\uFEFF/, '');
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') {
      if (quoted && text[i + 1] === '"') { cell += '"'; i++; }
      else if (quoted || cell === '') quoted = !quoted;
      else cell += ch;
    } else if (ch === ',' && !quoted) { row.push(cell); cell = ''; }
    else if ((ch === '\n' || ch === '\r') && !quoted) {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); rows.push(row); row = []; cell = '';
    } else cell += ch;
  }
  if (quoted) throw new Error('Unclosed CSV quote');
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

export function safeAsset(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (/^\/(?!\/)/.test(raw) && !raw.includes('\\')) return raw;
  try {
    const url = new URL(raw);
    if (url.protocol === 'https:' && !url.username && !url.password) return url.href;
  } catch { /* Invalid URLs never enter the DOM. */ }
  return '';
}

export function vimeoEmbed(value) {
  try {
    const u = new URL(value);
    if (u.protocol !== 'https:' || !['vimeo.com', 'www.vimeo.com', 'player.vimeo.com'].includes(u.hostname)) return '';
    const match = u.pathname.match(/^\/(?:video\/)?(\d+)(?:\/([a-zA-Z0-9]+))?\/?$/);
    if (!match) return '';
    const params = new URLSearchParams({ title: '0', byline: '0', portrait: '0', dnt: '1' });
    const hash = match[2] || u.searchParams.get('h');
    if (hash && /^[a-zA-Z0-9]+$/.test(hash)) params.set('h', hash);
    return `https://player.vimeo.com/video/${match[1]}?${params}`;
  } catch { return ''; }
}

export function ratio(value) {
  const m = String(value).trim().match(/^(\d+(?:\.\d+)?)\s*[:/]\s*(\d+(?:\.\d+)?)$/);
  return m && +m[1] > 0 && +m[2] > 0 ? [+m[1], +m[2]] : [16, 9];
}

export function videoContain(value) {
  const [w, h] = ratio(value), relative = (w / h) / (16 / 9);
  return { width: Math.min(100, relative * 100), height: Math.min(100, 100 / relative) };
}

export function recordsFromCSV(text) {
  const rows = parseCSV(text);
  const headers = rows.shift()?.map(h => h.trim());
  const required = ['주소', '서체명 국문', '서체명 영문', '대표색', '첫 화면 문구', '서체 소개 국문', '서체 소개 영문', '웹폰트 파일', 'Vimeo URL', '포맷', '글리프', '문의 이메일', '제작 연도'];
  if (!headers || required.some(h => !headers.includes(h)) || new Set(headers).size !== headers.length) throw new Error('CMS headers changed');
  const result = rows.filter(r => r.some(v => v.trim())).map(row => Object.fromEntries(headers.map((h, i) => [h, row[i] || ''])));
  for (const record of result) {
    record['주소'] = record['주소'].trim();
    record['대표색'] = record['대표색'].trim();
    if (!SLUGS.includes(record['주소']) || !/^#[\da-f]{6}$/i.test(record['대표색']) || !record['서체명 영문'].trim()) throw new Error('Invalid CMS row');
    if (record['Vimeo URL'] && !vimeoEmbed(record['Vimeo URL'])) throw new Error('Invalid Vimeo URL');
    for (const key of ['웹폰트 파일', '사용 예시 이미지']) if (record[key] && !safeAsset(record[key])) throw new Error('Invalid asset URL');
  }
  // A cleared or half-pasted sheet must not replace the last complete snapshot.
  if (result.length !== SLUGS.length || new Set(result.map(r => r['주소'])).size !== SLUGS.length) throw new Error('Incomplete CMS rows');
  return result;
}
