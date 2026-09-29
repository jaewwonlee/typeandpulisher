(function () {
  var el = document.getElementById('loading-screen');
  if (!el) return;
  // 점/잔상 애니메이션이 최소 한 바퀴는 돌고 나서 사라지도록 최소 노출 시간을 둔다.
  // 실제 로딩이 이보다 빨리 끝나도 이 시간까지는 화면을 유지한다.
  var MIN_VISIBLE_MS = 1500;
  var startedAt = Date.now();
  var hidden = false;
  function hide() {
    if (hidden) return;
    hidden = true;
    el.classList.add('is-hidden');
    el.addEventListener('transitionend', function () { el.remove(); }, { once: true });
  }
  function reveal() {
    var remaining = MIN_VISIBLE_MS - (Date.now() - startedAt);
    if (remaining > 0) setTimeout(hide, remaining);
    else hide();
  }
  // 이 페이지의 서체 표시용 웹폰트(--font-display/--font-glyph)가 준비될 때까지 기다린다.
  // document.fonts.ready는 폰트 전체가 아니라 "지금까지 요청된" 폰트 기준이라
  // 오프라인 등으로 끝내 로드되지 않는 경우를 대비해 타임아웃으로 강제로 걷어낸다.
  var fallback = setTimeout(reveal, 4000);
  var ready = (document.fonts && document.fonts.ready) || Promise.resolve();
  ready.then(function () { clearTimeout(fallback); reveal(); }).catch(function () { clearTimeout(fallback); reveal(); });
})();
