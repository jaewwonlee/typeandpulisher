"""Generate static Pages routes and glyph maps. pip install beautifulsoup4 fonttools brotli"""
from pathlib import Path
import json
from bs4 import BeautifulSoup
from fontTools.ttLib import TTFont

ROOT = Path(__file__).resolve().parents[1]
seed = json.loads((ROOT / 'cms-seed.json').read_text())
records = [dict(zip(seed['headers'], row)) for row in seed['rows']]
template = (ROOT / 'templates/type.html').read_text()
original_core = json.loads((ROOT / 'type/assets/js/witz-core-glyphs.json').read_text())
manifest = {}
for record in records:
    slug = record['주소']
    font_path = record['웹폰트 파일']
    font = TTFont(ROOT / font_path.lstrip('/'))
    points = sorted(cp for cp in font.getBestCmap() if cp >= 33 and not 0xD800 <= cp <= 0xDFFF)
    core = [cp for cp in original_core if cp in font.getBestCmap()]
    (ROOT / f'type/assets/js/{slug}-core.json').write_text(json.dumps(core))
    manifest[slug] = {'font': font_path, 'core': f'/type/assets/js/{slug}-core.json', 'count': len(core)}
    soup = BeautifulSoup(template, 'html.parser')
    for el in soup.select('[href], [src]'):
        for attr in ['href', 'src']:
            if el.get(attr, '').startswith('assets/'):
                el[attr] = '/type/' + el[attr]
                if el[attr].endswith(('.css', '.js')):
                    el[attr] += '?v=3'
    soup.select_one('link[rel="preload"]')['href'] = font_path
    soup.title.string = f"{record['서체명 영문']} {record['서체명 국문']} | TAP"
    soup.select_one('meta[name="description"]')['content'] = record['서체 소개 국문']
    canonical = soup.new_tag('link', rel='canonical', href=f'https://typeandpublisher.kr/type/{slug}/')
    soup.head.append(canonical)
    for prop, content in [('og:title', soup.title.string), ('og:description', record['서체 소개 국문']), ('og:url', canonical['href']), ('og:type', 'website')]:
        soup.head.append(soup.new_tag('meta', property=prop, content=content))
    soup.head.append(soup.new_tag('link', rel='stylesheet', href='/type/assets/css/cms.css?v=3'))
    soup.body['data-slug'] = slug
    soup.body['style'] = f"--pink:{record['대표색']};--pink-soft:{record['대표색']}33;--font-display:'Type-{slug}',var(--font-ui);--font-glyph:'Glyph-{slug}',var(--font-ui)"
    brand = soup.select_one('.topbar__brand')
    brand.name = 'a'
    brand['href'] = '/'
    nav = soup.select_one('.topbar__nav')
    nav.name = 'div'
    nav.clear()
    home = soup.new_tag('a', href='/', attrs={'class':'topbar__home'})
    home.string = 'TAP'
    nav.append(home)
    menu = soup.new_tag('details', attrs={'class':'type-menu'})
    summary = soup.new_tag('summary', attrs={'aria-label':'서체 페이지 메뉴'})
    summary.append('/'); summary.append('Type')
    menu.append(summary)
    links = soup.new_tag('nav', attrs={'class':'type-menu__links','aria-label':'서체 페이지'})
    for r in records:
        name, href = r['서체명 영문'], f"/type/{r['주소']}/"
        a = soup.new_tag('a', href=href)
        a.string = 'TAP/' + name
        if href == f'/type/{slug}/':
            a['aria-current'] = 'page'
        links.append(a)
    menu.append(links)
    nav.append(menu)
    soup.select_one('.hero__title').string = f"{record['서체명 영문']} {record['서체명 국문']}"
    soup.select_one('.hero__headline').string = record['첫 화면 문구']
    intro = soup.select_one('.info__body')
    intro.name = 'button'
    intro['type'] = 'button'
    intro['class'] += ['language-toggle']
    intro['aria-label'] = '서체 소개: English로 전환'
    intro['lang'] = 'ko'
    intro.string = record['서체 소개 국문']
    tbody = soup.select_one('.info__table tbody')
    tbody.clear()
    for label, key in [('디자인', '디자이너 국문'), ('제작 연도', '제작 연도'), ('버전', '버전'), ('포맷', '포맷'), ('글리프', '글리프'), ('문의', '문의 이메일')]:
        tr = soup.new_tag('tr')
        th = soup.new_tag('th', scope='row'); th.string = label
        td = soup.new_tag('td'); td.string = record[key]
        tr.extend([th, td]); tbody.append(tr)
    for i, box in enumerate(soup.select('.typing__box'), 1):
        box.select_one('.typing__id').string = record['서체명 국문']
        text = box.select_one('.typing__text')
        text.string = record[f'타이핑 예문 {i}']
        text['role'] = 'textbox'; text['aria-label'] = f'타이핑 예문 {i}'; text['aria-multiline'] = 'true'
    grid = soup.select_one('.glyphs__grid')
    grid['data-core'] = manifest[slug]['core']
    soup.select_one('.glyphs__reset').decompose()
    soup.select_one('.glyphs__search input')['placeholder'] = '주요 글리프 검색 (문자 또는 U+0041)'
    soup.select_one('.video .head-row .col-a').string = record['영상 제목']
    soup.select_one('.video .head-row .col-b').string = ''
    soup.select_one('.video .head-row a')['href'] = record['Vimeo URL']
    video_id = record['Vimeo URL'].split('/')[-1]
    frame = soup.select_one('.video__frame')
    frame['style'] = 'aspect-ratio:16 / 9'
    iframe = frame.iframe
    iframe['src'] = f'https://player.vimeo.com/video/{video_id}?title=0&byline=0&portrait=0&dnt=1'
    iframe['title'] = record['영상 제목']
    width, height = map(float, record['영상 비율'].split(':'))
    iframe['style'] = f'width:{min(100, width / height / (16 / 9) * 100):.6f}%;height:{min(100, (16 / 9) / (width / height) * 100):.6f}%'
    soup.select_one('.video .caption-row .col-a').string = record['영상 소개 국문']
    soup.select_one('.video .caption-row .col-b').string = ', '.join(record[k] for k in ['영상 채널', '영상 색상', '영상 사운드', '영상 길이', '영상 제작연도'] if record[k])
    soup.select_one('.usage .head-row .col-a').string = ''
    soup.select_one('.usage .head-row .col-end').string = ''
    for a in soup.select('.usage__nav'):
        a.decompose()
    soup.select_one('.placeholder__text').clear()
    soup.select_one('.placeholder__text').append('준비 중이에요!')
    soup.select_one('.footer__links a[href^="mailto:"]')['href'] = 'mailto:typeandpublisher@gmail.com'
    data = soup.new_tag('script', id='type-seed', type='application/json')
    data.string = json.dumps({'records': records, 'glyphs': manifest}, ensure_ascii=False).replace('<', '\\u003c')
    soup.body.append(data)
    script = soup.new_tag('script', type='module', src='/type/assets/js/cms.js?v=3')
    soup.body.append(script)
    output = ROOT / 'type' / slug / 'index.html'
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(str(soup))
    print(f'{slug}: {len(core)} core characters')

# Every page gets the completed manifest, including later entries.
for record in records:
    path = ROOT / 'type' / record['주소'] / 'index.html'
    soup = BeautifulSoup(path.read_text(), 'html.parser')
    soup.select_one('#type-seed').string = json.dumps({'records': records, 'glyphs': manifest}, ensure_ascii=False).replace('<', '\\u003c')
    path.write_text(str(soup))
(ROOT / 'type/assets/js/font-manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2))

(ROOT / 'type/index.html').write_text('''<!doctype html>
<html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Type | TAP</title><meta name="robots" content="noindex">
<script>
const pages = ['cake','giul','rooms','umm','witz'];
location.replace('/type/' + pages[Math.floor(Math.random() * pages.length)] + '/');
</script>
<noscript><meta http-equiv="refresh" content="0;url=/type/cake/"></noscript>
</head><body>
</body></html>''')
