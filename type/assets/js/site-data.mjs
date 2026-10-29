import { parseCSV, safeAsset } from './cms-data.mjs?v=5';

// 운영 시트의 Info / Archive / Publish 탭 gid. Type 탭은 cms-data.mjs의 SHEET_GID.
export const TABS = { info: '119225931', archive: '1287932855', publish: '1811725569' };

export const INFO_HEADERS = ['구분', '국문', '영문', '링크', '날짜'];
export const ARCHIVE_HEADERS = ['번호', '제목 국문', '제목 영문', '카테고리', '썸네일 URL', '이미지 URL', '설명 국문', '설명 영문'];
export const PUBLISH_HEADERS = ['제목'];

// 열 제목이 바뀌었거나 로그인 페이지 같은 HTML이 오면 throw해서 마지막 정상 데이터를 유지한다.
export function rowsFromCSV(text, required) {
  const rows = parseCSV(text);
  const headers = rows.shift()?.map(h => h.trim());
  if (!headers || required.some(h => !headers.includes(h)) || new Set(headers).size !== headers.length) throw new Error('CMS headers changed');
  return rows.filter(r => r.some(v => v.trim())).map(row => Object.fromEntries(headers.map((h, i) => [h, (row[i] || '').trim()])));
}

// 연락처 링크는 메일과 https만 허용한다. 표시 문구는 링크에서 만든다.
export function contactLink(value) {
  const raw = String(value || '').trim();
  if (/^mailto:[^\s@]+@[^\s@]+$/i.test(raw)) return { href: raw, text: raw.slice(7) };
  if (/^[^\s@:/]+@[^\s@]+\.[^\s@]+$/.test(raw)) return { href: 'mailto:' + raw, text: raw };
  const href = /^https:\/\//i.test(raw) ? safeAsset(raw) : '';
  if (!href) return null;
  const insta = new URL(href);
  if (/(^|\.)instagram\.com$/.test(insta.hostname)) {
    const handle = insta.pathname.split('/').filter(Boolean)[0];
    if (handle) return { href, text: '@' + handle };
  }
  return { href, text: raw };
}

// 구분 열로 묶는다. 모르는 구분과 잘못된 링크는 화면에 넣지 않고 건너뛴다.
export function infoFromRows(rows) {
  const of = kind => rows.filter(r => r['구분'] === kind);
  const title = of('제목')[0];
  const image = of('이미지').map(r => ({ src: safeAsset(r['링크']), caption: r['국문'], captionEn: r['영문'] })).find(i => i.src);
  const notice = of('문의 안내')[0];
  return {
    title: { ko: title?.['국문'] || '타입앤퍼블리셔', en: title?.['영문'] || 'Typeandpublisher' },
    intro: of('소개').map(r => ({ ko: r['국문'], en: r['영문'] })),
    image: image || null,
    members: of('구성원').map(r => ({ ko: r['국문'], en: r['영문'] })),
    works: of('활동').map(r => ({ date: r['날짜'], ko: r['국문'], en: r['영문'] })),
    notice: notice ? { ko: notice['국문'], en: notice['영문'] } : null,
    contacts: of('연락처').map(r => ({ ko: r['국문'], en: r['영문'], link: contactLink(r['링크']) })).filter(c => c.link),
  };
}

export function archiveFromRows(rows) {
  return rows.filter(r => r['제목 국문'] || r['제목 영문']).map(r => {
    // 한 장이 잘못돼도 나머지 사진은 보여준다.
    const images = String(r['이미지 URL']).split(/\r?\n/).map(safeAsset).filter(Boolean);
    return {
      no: r['번호'],
      ko: r['제목 국문'],
      en: r['제목 영문'],
      category: r['카테고리'],
      thumb: safeAsset(r['썸네일 URL']) || images[0] || '',
      images,
      descKo: r['설명 국문'],
      descEn: r['설명 영문'],
    };
  });
}
