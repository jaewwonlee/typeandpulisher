import { parseCSV, safeAsset, imageSource } from './cms-data.mjs?v=6';

// 운영 시트의 Info / Archive / Publish 탭 gid. Type 탭은 cms-data.mjs의 SHEET_GID.
export const TABS = { info: '119225931', archive: '1287932855', publish: '1811725569' };

// Info 탭은 1행이 묶음 제목(기본 정보 / 구성원 / 활동 / 연락처), 2행이 열 제목이다.
// 기본 정보는 3행 한 줄만 쓰고, 나머지 묶음은 3행부터 아래로 한 줄에 하나씩 쓴다.
export const INFO_HEADERS = [
  '제목 국문', '제목 영문', '소개 국문', '소개 영문', '대표 이미지', '이미지 설명', '문의 안내 국문', '문의 안내 영문',
  '구성원 국문', '구성원 영문',
  '활동 날짜', '활동 국문', '활동 영문',
  '연락처 항목 국문', '연락처 항목 영문', '연락처 주소',
];
export const ARCHIVE_HEADERS = ['번호', '제목 국문', '제목 영문', '카테고리', '썸네일 이미지', '사진', '설명 국문', '설명 영문'];
export const PUBLISH_HEADERS = ['제목'];

// 열 제목이 바뀌었거나 로그인 페이지 같은 HTML이 오면 throw해서 마지막 정상 데이터를 유지한다.
// headerRow: 열 제목이 있는 행(0부터). 그 위의 행은 묶음 제목이라 읽지 않는다.
export function rowsFromCSV(text, required, headerRow = 0) {
  const rows = parseCSV(text).slice(headerRow);
  const headers = rows.shift()?.map(h => h.trim());
  if (!headers || required.some(h => !headers.includes(h)) || new Set(headers.filter(Boolean)).size !== headers.filter(Boolean).length) throw new Error('CMS headers changed');
  return rows.filter(r => r.some(v => v.trim())).map(row => Object.fromEntries(headers.map((h, i) => [h, (row[i] || '').trim()]).filter(([h]) => h)));
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

// 셀 안에서 빈 줄로 문단을 나눈다.
const paragraphs = value => String(value || '').split(/\r?\n\s*\r?\n/).map(s => s.trim()).filter(Boolean);

// 묶음마다 해당 열이 채워진 줄만 모은다. 잘못된 링크는 화면에 넣지 않고 건너뛴다.
export function infoFromRows(rows) {
  const base = rows[0] || {};
  const ko = paragraphs(base['소개 국문']), en = paragraphs(base['소개 영문']);
  const src = imageSource(base['대표 이미지']);
  const notice = base['문의 안내 국문'] || base['문의 안내 영문'];
  return {
    title: { ko: base['제목 국문'] || '타입앤퍼블리셔', en: base['제목 영문'] || 'Typeandpublisher' },
    intro: Array.from({ length: Math.max(ko.length, en.length) }, (_, i) => ({ ko: ko[i] || '', en: en[i] || '' })),
    image: src ? { src, caption: base['이미지 설명'] } : null,
    members: rows.filter(r => r['구성원 국문'] || r['구성원 영문']).map(r => ({ ko: r['구성원 국문'], en: r['구성원 영문'] })),
    works: rows.filter(r => r['활동 국문'] || r['활동 영문']).map(r => ({ date: r['활동 날짜'], ko: r['활동 국문'], en: r['활동 영문'] })),
    notice: notice ? { ko: base['문의 안내 국문'], en: base['문의 안내 영문'] } : null,
    contacts: rows.filter(r => r['연락처 주소']).map(r => ({ ko: r['연락처 항목 국문'], en: r['연락처 항목 영문'], link: contactLink(r['연락처 주소']) })).filter(c => c.link),
  };
}

export function archiveFromRows(rows) {
  return rows.filter(r => r['제목 국문'] || r['제목 영문']).map(r => {
    // 한 장이 잘못돼도 나머지 사진은 보여준다.
    const images = String(r['사진']).split(/\r?\n/).map(imageSource).filter(Boolean);
    return {
      no: r['번호'],
      ko: r['제목 국문'],
      en: r['제목 영문'],
      category: r['카테고리'],
      thumb: imageSource(r['썸네일 이미지']) || images[0] || '',
      images,
      descKo: r['설명 국문'],
      descEn: r['설명 영문'],
    };
  });
}
