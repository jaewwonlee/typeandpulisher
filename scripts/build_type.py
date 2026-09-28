"""Generate static Pages routes and glyph maps. pip install beautifulsoup4 fonttools brotli"""
from pathlib import Path
import json
from html import escape
from bs4 import BeautifulSoup
from fontTools.ttLib import TTFont

ROOT = Path(__file__).resolve().parents[1]
seed = json.loads((ROOT / 'cms-seed.json').read_text())
records = [dict(zip(seed['headers'], row)) for row in seed['rows']]
template = (ROOT / 'templates/type.html').read_text()
manifest = {}
for record in records:
    slug = record['주소']
    font_path = record['웹폰트 파일']
    font = TTFont(ROOT / font_path.lstrip('/'))
    points = sorted(cp for cp in font.getBestCmap() if cp >= 33 and not 0xD800 <= cp <= 0xDFFF)
    core_chars = set('ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!?.,:;()[]{}+-=<>@#%&가나다라마바사아자차카타파하한글서체타입퍼블리셔')
    core = [cp for cp in points if chr(cp) in core_chars]
    for suffix, values in [('core', core), ('all', points)]:
        (ROOT / f'type/assets/js/{slug}-{suffix}.json').write_text(json.dumps(values))
    manifest[slug] = {'font': font_path, 'core': f'/type/assets/js/{slug}-core.json', 'all': f'/type/assets/js/{slug}-all.json', 'count': len(points)}
    soup = BeautifulSoup(template, 'html.parser')
    for el in soup.select('[href], [src]'):
        for attr in ['href', 'src']:
            if el.get(attr, '').startswith('assets/'):
                el[attr] = '/type/' + el[attr]
    soup.select_one('link[rel="preload"]')['href'] = font_path
    soup.title.string = f"{record['서체명 영문']} {record['서체명 국문']} | TAP"
    soup.select_one('meta[name="description"]')['content'] = record['서체 소개 국문']
    canonical = soup.new_tag('link', rel='canonical', href=f'https://typeandpublisher.kr/type/{slug}/')
    soup.head.append(canonical)
    for prop, content in [('og:title', soup.title.string), ('og:description', record['서체 소개 국문']), ('og:url', canonical['href']), ('og:type', 'website')]:
        soup.head.append(soup.new_tag('meta', property=prop, content=content))
    soup.head.append(soup.new_tag('link', rel='stylesheet', href='/type/assets/css/cms.css'))
    soup.body['data-slug'] = slug
    soup.body['style'] = f"--pink:{record['대표색']};--pink-soft:{record['대표색']}33;--font-display:'Type-{slug}',var(--font-ui)"
    brand = soup.select_one('.topbar__brand')
    brand.name = 'a'
    brand['href'] = '/'
    nav = soup.select_one('.topbar__nav')
    nav.name = 'nav'
    nav['aria-label'] = '서체 메뉴'
    nav.clear()
    for name, href in [('TAP', '/'), ('Type', '/type/')] + [(r['서체명 영문'], f"/type/{r['주소']}/") for r in records]:
        a = soup.new_tag('a', href=href)
        a.string = name
        if href == f'/type/{slug}/':
            a['aria-current'] = 'page'
        nav.append(a)
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
    for label, key in [('디자인', '디자이너 국문'), ('제작 연도', '제작 연도'), ('버전', '버전'), ('굵기 및 스타일', '굵기 및 스타일'), ('분류', '서체 분류'), ('주요 용도', '주요 용도'), ('지원 문자', '지원 문자'), ('문의', '문의 이메일')]:
        if not record[key]:
            continue
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
    grid['data-core'] = manifest[slug]['core']; grid['data-full'] = manifest[slug]['all']
    soup.select_one('.video .head-row .col-a').string = record['영상 제목']
    soup.select_one('.video .head-row .col-b').string = ''
    soup.select_one('.video .head-row a')['href'] = record['Vimeo URL']
    video_id = record['Vimeo URL'].split('/')[-1]
    frame = soup.select_one('.video__frame')
    frame['style'] = 'aspect-ratio:' + record['영상 비율'].replace(':', '/')
    if record['영상 비율'] == '9:16':
        frame['class'] += ['video__frame--portrait']
    iframe = frame.iframe
    iframe['src'] = f'https://player.vimeo.com/video/{video_id}?title=0&byline=0&portrait=0&dnt=1'
    iframe['title'] = record['영상 제목']
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
    script = soup.new_tag('script', type='module', src='/type/assets/js/cms.js')
    soup.body.append(script)
    output = ROOT / 'type' / slug / 'index.html'
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(str(soup))
    print(f'{slug}: {len(points)} supported characters')

# Every page gets the completed manifest, including later entries.
for record in records:
    path = ROOT / 'type' / record['주소'] / 'index.html'
    soup = BeautifulSoup(path.read_text(), 'html.parser')
    soup.select_one('#type-seed').string = json.dumps({'records': records, 'glyphs': manifest}, ensure_ascii=False).replace('<', '\\u003c')
    path.write_text(str(soup))
(ROOT / 'type/assets/js/font-manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2))

links = ''.join(f'''<a href="/type/{r['주소']}/" data-type-link="{r['주소']}" style="color:{r['대표색']};--card-soft:{r['대표색']}33"><span class="type-list__name">{escape(r['서체명 영문'])} {escape(r['서체명 국문'])}</span><span class="type-list__designer">{escape(r['디자이너 국문'])}</span></a>''' for r in records)
seed_json = json.dumps({'records': records, 'glyphs': manifest}, ensure_ascii=False).replace('<', '\\u003c')
(ROOT / 'type/index.html').write_text(f'''<!doctype html>
<html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Type | TAP</title><meta name="description" content="타입앤퍼블리셔의 다섯 서체: Cake, Giul, Rooms, Umm, Witz">
<link rel="canonical" href="https://typeandpublisher.kr/type/">
<link rel="stylesheet" href="/type/assets/css/reset.css"><link rel="stylesheet" href="/type/assets/css/main.css"><link rel="stylesheet" href="/type/assets/css/preview.css"><link rel="stylesheet" href="/type/assets/css/cms.css">
</head><body style="--pink:#111111;--pink-soft:#11111133">
<header class="topbar"><a class="topbar__brand" href="/">타입앤퍼블리셔</a><nav class="topbar__nav" aria-label="주 메뉴"><a href="/">TAP</a><a href="/type/" aria-current="page">Type</a></nav></header>
<main class="container type-index"><h1>Type 서체</h1><nav class="type-list" aria-label="서체 목록">{links}</nav></main>
<script id="type-seed" type="application/json">{seed_json}</script><script type="module" src="/type/assets/js/cms.js"></script>
</body></html>''')
