/* 전시장 무인 키오스크용 임시 코드. 전시가 끝나면 이 파일과, 이 파일을 불러오는
   <script> 태그(각 페이지, index.html 포함)를 지우면 된다. */
(function () {
  var RELOAD_EVERY_MS = 10 * 60 * 1000; // 10분마다 새로고침 체크
  // 최근 이 시간 안에 조작이 있었으면 리로드를 미루고 다시 대기한다.
  // 너무 짧으면 문장 읽는 잠깐의 정지에도 끊기고, 너무 길면 자리 비움을 늦게 감지한다.
  var IDLE_GRACE_MS = 60 * 1000;

  var lastActivity = Date.now();
  ['pointerdown', 'pointermove', 'keydown', 'wheel', 'touchstart', 'scroll', 'input'].forEach(function (type) {
    window.addEventListener(type, function () { lastActivity = Date.now(); }, { passive: true });
  });

  function checkAndReload() {
    var idleFor = Date.now() - lastActivity;
    if (idleFor >= IDLE_GRACE_MS) {
      location.reload();
    } else {
      setTimeout(checkAndReload, IDLE_GRACE_MS - idleFor);
    }
  }
  setTimeout(checkAndReload, RELOAD_EVERY_MS);
})();
