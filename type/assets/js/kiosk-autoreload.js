/* 전시장 무인 키오스크용 임시 코드. 전시가 끝나면 이 파일과, 이 파일을 불러오는
   <script> 태그(각 페이지, index.html 포함)를 지우면 된다. */
(function () {
  var RELOAD_EVERY_MS = 10 * 60 * 1000; // 10분마다 다음 페이지로 넘어갈지 체크
  // 최근 이 시간 안에 조작이 있었으면 이동을 미루고 다시 대기한다.
  // 너무 짧으면 문장 읽는 잠깐의 정지에도 끊기고, 너무 길면 자리 비움을 늦게 감지한다.
  var IDLE_GRACE_MS = 60 * 1000;
  var SLUGS = ['cake', 'giul', 'rooms', 'umm', 'witz'];
  var STORAGE_KEY = 'tap-kiosk-next-slug-index';

  function currentSlug() {
    var m = location.pathname.match(/^\/type\/([a-z]+)\/?$/);
    return m ? m[1] : null;
  }

  // localStorage에 "다음 순번"을 저장해두고 매번 하나씩 전진시켜서, 랜덤이 아니라
  // 5개 페이지가 돌아가며 골고루 한 번씩 나오게 한다.
  function nextTypeURL() {
    var stored = -1;
    try { stored = parseInt(localStorage.getItem(STORAGE_KEY), 10); } catch (e) { /* 저장 불가 환경이면 아래에서 처음부터 시작 */ }
    if (!(stored >= 0 && stored < SLUGS.length)) stored = -1;
    var next = (stored + 1) % SLUGS.length;
    // 중간에 수동으로 이동해둬서 다음 순번이 지금 보고 있는 페이지와 겹치면 한 칸 더 건너뛴다.
    if (SLUGS[next] === currentSlug()) next = (next + 1) % SLUGS.length;
    try { localStorage.setItem(STORAGE_KEY, String(next)); } catch (e) { /* 저장 못 해도 이동 자체는 계속한다 */ }
    return '/type/' + SLUGS[next] + '/';
  }

  var lastActivity = Date.now();
  ['pointerdown', 'pointermove', 'keydown', 'wheel', 'touchstart', 'scroll', 'input'].forEach(function (type) {
    window.addEventListener(type, function () { lastActivity = Date.now(); }, { passive: true });
  });

  function checkAndGoNext() {
    var idleFor = Date.now() - lastActivity;
    if (idleFor >= IDLE_GRACE_MS) {
      location.href = nextTypeURL();
    } else {
      setTimeout(checkAndGoNext, IDLE_GRACE_MS - idleFor);
    }
  }
  setTimeout(checkAndGoNext, RELOAD_EVERY_MS);
})();
