/* 전시장 무인 키오스크용 임시 코드. 전시가 끝나면 이 파일과, 이 파일을 불러오는
   <script> 태그(각 페이지, index.html 포함)를 지우면 된다. */
(function () {
  var RELOAD_EVERY_MS = 10 * 60 * 1000; // 10분마다 새로고침
  setTimeout(function () { location.reload(); }, RELOAD_EVERY_MS);
})();
