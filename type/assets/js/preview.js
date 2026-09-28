/* ==========================================================
   폰트 미리보기 페이지 로직
   - 타이핑 섹션: 자유 입력 + 크기/행간/자간 조절, 글자 크기에 맞춰 영역 높이 자동 확장
   - 글리프 섹션: 원본 주요 글리프 목록만 보여준다
   ========================================================== */

(function initTyping() {
  // Witz의 잉크 영역은 대략 -0.244em ~ 0.840em (=1.084em).
  // 행간이 이보다 좁으면 위아래 획이 잘려 보이므로 그만큼 여백을 더한다.
  const INK_RATIO = document.body.dataset.slug === 'cake' ? 1.7 : (document.body.dataset.slug === 'rooms' ? 1.5 : 1.16);


  document.querySelectorAll('.typing__box').forEach((box) => {
    const text = box.querySelector('.typing__text');
    const inputs = {
      size: box.querySelector('[data-role="size"]'),
      leading: box.querySelector('[data-role="leading"]'),
      tracking: box.querySelector('[data-role="tracking"]'),
    };
    const outputs = {
      size: box.querySelector('[data-out="size"]'),
      leading: box.querySelector('[data-out="leading"]'),
      tracking: box.querySelector('[data-out="tracking"]'),
    };

    function applyStyle() {
      const size = parseFloat(inputs.size.value) || 16;
      const leading = parseFloat(inputs.leading.value) || size;
      const tracking = parseFloat(inputs.tracking.value) || 0;

      text.style.fontSize = size + 'px';
      text.style.lineHeight = leading + 'px';
      text.style.letterSpacing = tracking + 'px';

      // 행간이 잉크 높이보다 작을 때 생기는 잘림을 위아래 패딩으로 보정
      const overflow = Math.max(0, size * INK_RATIO - leading);
      text.style.paddingBlock = Math.ceil(overflow / 2) + 'px';

      Object.keys(outputs).forEach((key) => {
        if (outputs[key]) {
          outputs[key].textContent = { size, leading, tracking }[key];
        }
      });
    }

    let manuallySized = false;
    const defaults = { size: Number(inputs.size.value), leading: Number(inputs.leading.value) };
    Object.values(inputs).forEach((input) => {
      if (input) input.addEventListener('input', () => { manuallySized = true; applyStyle(); });
    });

    // 첫 포커스 시 예시 문구 전체 선택 → 바로 덮어쓸 수 있게
    text.addEventListener('focus', () => {
      if (text.dataset.touched) return;
      const range = document.createRange();
      range.selectNodeContents(text);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
    });

    text.addEventListener('input', () => {
      text.dataset.touched = 'true';
    });

    function fitInitialSize() {
      if (manuallySized) return;
      const split = box.closest('.typing__row--split');
      const referenceWidth = window.innerWidth <= 768 ? 868 : (split && window.innerWidth > 1024 ? 720 : 1464);
      const scale = Math.min(1, box.clientWidth / referenceWidth);
      inputs.leading.value = Math.round(defaults.leading * scale);
      inputs.size.value = Math.round(Math.min(defaults.size, defaults.leading / INK_RATIO) * scale);
      applyStyle();
    }
    fitInitialSize();
    new ResizeObserver(fitInitialSize).observe(box);

  });
})();

(function initGlyphs() {
  const grid = document.querySelector('.glyphs__grid');
  if (!grid) return;
  const countLabel = document.querySelector('.glyphs__count');
  const searchInput = document.querySelector('.glyphs__search input');
  const bigPreview = document.querySelector('.glyphs__big');
  const codeLabel = document.querySelector('.glyphs__code');
  let codepoints = [];
  const toCode = cp => 'U+' + cp.toString(16).toUpperCase().padStart(4, '0');
  function setActive(cp, cell) {
    bigPreview.textContent = String.fromCodePoint(cp);
    codeLabel.textContent = toCode(cp);
    grid.querySelectorAll('.glyphs__cell.is-active').forEach(el => el.classList.remove('is-active'));
    cell?.classList.add('is-active');
  }
  grid.addEventListener('click', event => {
    const cell = event.target.closest('.glyphs__cell');
    if (cell) setActive(Number(cell.dataset.cp), cell);
  });
  searchInput.addEventListener('keydown', event => {
    if (event.key !== 'Enter') return;
    const value = searchInput.value.trim();
    if (!value) return;
    const hex = value.match(/^u\+?([0-9a-f]+)$/i);
    const cp = hex ? parseInt(hex[1], 16) : value.codePointAt(0);
    const found = codepoints.includes(cp);
    searchInput.classList.toggle('is-miss', !found);
    searchInput.setAttribute('aria-invalid', String(!found));
    countLabel.textContent = found ? `주요 글리프 ${codepoints.length}자` : '주요 글리프 목록에 없는 문자입니다.';
    if (found) setActive(cp, grid.querySelector('[data-cp="' + cp + '"]'));
    // Keep the fixed core grid and its position; never fetch or append the full cmap.
  });
  searchInput.addEventListener('input', () => {
    searchInput.classList.remove('is-miss');
    searchInput.removeAttribute('aria-invalid');
    countLabel.textContent = `주요 글리프 ${codepoints.length}자`;
  });
  fetch(grid.dataset.core)
    .then(response => { if (!response.ok) throw new Error('Glyph HTTP ' + response.status); return response.json(); })
    .then(cps => {
      codepoints = cps;
      const fragment = document.createDocumentFragment();
      cps.forEach(cp => {
        const cell = document.createElement('button');
        cell.type = 'button'; cell.className = 'glyphs__cell';
        cell.textContent = String.fromCodePoint(cp); cell.dataset.cp = cp;
        cell.setAttribute('aria-label', toCode(cp)); fragment.append(cell);
      });
      grid.replaceChildren(fragment);
      countLabel.textContent = `주요 글리프 ${cps.length}자`;
      const first = cps.includes(0x41) ? 0x41 : cps[0];
      if (first !== undefined) setActive(first, grid.querySelector('[data-cp="' + first + '"]'));
    })
    .catch(error => { countLabel.textContent = '글리프를 불러오지 못했습니다.'; console.error(error); });
})();
