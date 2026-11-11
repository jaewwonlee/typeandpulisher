// 상단 메뉴를 열 때 항목이 차례로 내려오고, 닫을 때는 아래 칸부터 차례로 올라가며 사라진다.
// CSS의 [open] 애니메이션은 Safari에서 처음 한 번만 돌고 다시 열 때는 안 돌아서, 매번 Web Animations로 새로 건다.
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const linksOf = menu => [...menu.querySelectorAll('.type-menu__links a')];
const closing = new WeakSet();

export function animateMenu(menu) {
  const summary = menu?.querySelector('summary');
  if (!summary) return;
  // summary의 click은 details가 열리기 직전에 오므로 첫 프레임부터 투명한 상태로 시작한다.
  summary.addEventListener('click', event => {
    if (menu.open && !closing.has(menu)) { event.preventDefault(); closeMenu(menu); return; }
    // 닫히는 도중에 다시 누르면 닫기를 멈추고 다시 내려오게 한다.
    if (closing.delete(menu)) event.preventDefault();
    if (reduced()) return;
    linksOf(menu).forEach((a, i) => {
      a.getAnimations().forEach(old => old.cancel());   // 빠르게 다시 열 때 겹치지 않게
      a.animate(
        [{ opacity: 0, transform: 'translateY(-8px)' }, { opacity: 1, transform: 'none' }],
        { duration: 240, delay: Math.min(i, 5) * 45, easing: 'cubic-bezier(.2, .8, .3, 1)', fill: 'backwards' });
    });
  });
}

// 메뉴 바깥 클릭·Esc·메뉴 버튼 모두 이 함수로 닫는다. 움직임이 끝난 뒤 details를 닫는다.
export function closeMenu(menu) {
  if (!menu?.open || closing.has(menu)) return;
  const links = linksOf(menu);
  if (reduced() || !links.length) { menu.open = false; return; }
  closing.add(menu);
  const last = links.length - 1;
  const animations = links.map((a, i) => {
    a.getAnimations().forEach(old => old.cancel());
    return a.animate(
      [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateY(-8px)' }],
      { duration: 180, delay: Math.min(last - i, 5) * 35, easing: 'cubic-bezier(.4, 0, .6, 1)', fill: 'forwards' });
  });
  Promise.all(animations.map(a => a.finished)).then(() => {
    // 닫히는 동안 다시 열었으면(closing에서 빠짐) 그대로 둔다.
    if (closing.has(menu)) { closing.delete(menu); menu.open = false; }
    animations.forEach(a => a.cancel());
  }, () => {});
}
