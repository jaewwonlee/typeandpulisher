// 상단 메뉴를 열 때 항목이 차례로 내려온다. CSS의 [open] 애니메이션은 Safari에서 처음 한 번만 돌고
// 다시 열 때는 안 돌아서, 열 때마다 Web Animations로 새로 건다.
export function animateMenu(menu) {
  const summary = menu?.querySelector('summary');
  if (!summary) return;
  // summary의 click은 details가 열리기 직전에 오므로 첫 프레임부터 투명한 상태로 시작한다.
  summary.addEventListener('click', () => {
    if (menu.open || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    menu.querySelectorAll('.type-menu__links a').forEach((a, i) => {
      a.getAnimations().forEach(old => old.cancel());   // 빠르게 다시 열 때 겹치지 않게
      a.animate(
        [{ opacity: 0, transform: 'translateY(-8px)' }, { opacity: 1, transform: 'none' }],
        { duration: 240, delay: Math.min(i, 5) * 45, easing: 'cubic-bezier(.2, .8, .3, 1)', fill: 'backwards' });
    });
  });
}
