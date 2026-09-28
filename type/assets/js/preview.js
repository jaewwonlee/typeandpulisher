/* ==========================================================
   폰트 미리보기 페이지 로직
   - 타이핑 섹션: 자유 입력 + 크기/행간/자간 조절, 글자 크기에 맞춰 영역 높이 자동 확장
   - 글리프 섹션: 주요 글리프를 먼저 보여주고, 필요할 때 전체를 불러온다
   ========================================================== */

(function initTyping() {
  // Witz의 잉크 영역은 대략 -0.244em ~ 0.840em (=1.084em).
  // 행간이 이보다 좁으면 위아래 획이 잘려 보이므로 그만큼 여백을 더한다.
  const INK_RATIO = 1.15;

  // 좁은 화면에서는 초기 크기를 화면 폭에 맞춰 줄인다(슬라이더 범위는 그대로)
  const initialScale = window.innerWidth <= 768 ? Math.min(1, window.innerWidth / 900) : 1;

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

    Object.values(inputs).forEach((input) => {
      if (input) input.addEventListener('input', applyStyle);
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

    if (initialScale < 1) {
      ['size', 'leading'].forEach((key) => {
        const input = inputs[key];
        if (input) input.value = Math.round(parseFloat(input.value) * initialScale);
      });
    }

    applyStyle();
  });
})();

(function initGlyphs() {
  const grid = document.querySelector('.glyphs__grid');
  if (!grid) return;

  const resetBtn = document.querySelector('.glyphs__reset');
  const countLabel = document.querySelector('.glyphs__count');
  const searchInput = document.querySelector('.glyphs__search input');
  const bigPreview = document.querySelector('.glyphs__big');
  const codeLabel = document.querySelector('.glyphs__code');

  const CORE_URL = grid.dataset.core;
  const FULL_URL = grid.dataset.full;
  const BATCH_SIZE = 600;

  let codepoints = [];
  let coreList = [];
  let renderedCount = 0;
  let showingAll = false;
  let fullListPromise = null;

  function toCode(cp) {
    return 'U+' + cp.toString(16).toUpperCase().padStart(4, '0');
  }

  function setActive(cp, cell) {
    bigPreview.textContent = String.fromCodePoint(cp);
    codeLabel.textContent = toCode(cp);
    grid.querySelectorAll('.glyphs__cell.is-active').forEach((el) => el.classList.remove('is-active'));
    if (cell) cell.classList.add('is-active');
  }

  function updateFoot() {
    if (countLabel) {
      countLabel.textContent = showingAll
        ? '전체 글리프 ' + codepoints.length.toLocaleString() + '자'
        : '주요 글리프 ' + codepoints.length + '자';
    }
    // 검색 때문에 전체를 불러온 상태에서만 되돌리기 버튼을 보여준다
    if (resetBtn) resetBtn.hidden = !showingAll;
  }

  function renderBatch(count) {
    const frag = document.createDocumentFragment();
    const end = Math.min(renderedCount + count, codepoints.length);

    for (let i = renderedCount; i < end; i++) {
      const cp = codepoints[i];
      const cell = document.createElement('button');
      cell.type = 'button';
      cell.className = 'glyphs__cell';
      cell.textContent = String.fromCodePoint(cp);
      cell.dataset.cp = cp;
      cell.setAttribute('aria-label', toCode(cp));
      frag.appendChild(cell);
    }

    grid.appendChild(frag);
    renderedCount = end;
    updateFoot();
  }

  function reset(list, all) {
    codepoints = list;
    showingAll = all;
    renderedCount = 0;
    grid.textContent = '';
    renderBatch(all ? BATCH_SIZE : list.length);
  }

  function loadFullList() {
    if (!fullListPromise) {
      fullListPromise = fetch(FULL_URL).then((res) => {
        if (!res.ok) throw new Error('Glyph HTTP ' + res.status);
        return res.json();
      }).catch((error) => { fullListPromise = null; throw error; });
    }
    return fullListPromise;
  }

  function showAll() {
    return loadFullList().then((cps) => {
      if (!showingAll) reset(cps, true);
      return codepoints;
    });
  }

  function focusCodepoint(cp) {
    const idx = codepoints.indexOf(cp);
    if (idx === -1) return false;
    while (renderedCount <= idx) renderBatch(BATCH_SIZE);
    const cell = grid.querySelector('[data-cp="' + cp + '"]');
    if (cell) {
      setActive(cp, cell);
      cell.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
    return true;
  }

  grid.addEventListener('click', (e) => {
    const cell = e.target.closest('.glyphs__cell');
    if (!cell) return;
    setActive(Number(cell.dataset.cp), cell);
  });

  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      reset(coreList, false);
      const first = coreList.includes(0x41) ? 0x41 : coreList[0];
      setActive(first, grid.querySelector('[data-cp="' + first + '"]'));
      grid.scrollIntoView({ block: 'start', behavior: 'smooth' });
    });
  }

  if (searchInput) {
    searchInput.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter') return;
      const value = searchInput.value.trim();
      if (!value) return;

      const hexMatch = value.match(/^u\+?([0-9a-f]+)$/i);
      const cp = hexMatch ? parseInt(hexMatch[1], 16) : value.codePointAt(0);

      // 주요 글리프에 없으면 전체를 불러와서 다시 찾는다
      if (focusCodepoint(cp)) {
        searchInput.classList.remove('is-miss');
        return;
      }
      showAll().then(() => {
        searchInput.classList.toggle('is-miss', !focusCodepoint(cp));
      }).catch(() => { countLabel.textContent = '글리프를 불러오지 못했습니다. 다시 검색해주세요.'; });
    });

    searchInput.addEventListener('input', () => searchInput.classList.remove('is-miss'));
  }

  fetch(CORE_URL)
    .then((res) => res.json())
    .then((cps) => {
      coreList = cps;
      reset(cps, false);
      const defaultCp = cps.includes(0x41) ? 0x41 : cps[0];
      setActive(defaultCp, grid.querySelector('[data-cp="' + defaultCp + '"]'));
    })
    .catch((err) => {
      console.error('글리프 데이터를 불러오지 못했습니다.', err);
    });
})();
