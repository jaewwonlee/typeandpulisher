// Measure actual browser line wrapping, including the selected webfont.
(function () {
  const stage = document.querySelector('.hero__stage');
  const text = stage?.querySelector('.hero__headline');
  if (!text) return;
  let scheduled = 0;
  function fit() {
    scheduled = 0;
    const css = getComputedStyle(stage);
    const height = stage.clientHeight - parseFloat(css.paddingTop) - parseFloat(css.paddingBottom);
    const width = stage.clientWidth;
    if (!width || !height) return;
    let low = 1, high = 400;
    while (high - low > .25) {
      const size = (low + high) / 2;
      text.style.fontSize = `${size}px`;
      // Reserve space for deep outlines not represented by the browser line box.
      const inkMargin = document.body.dataset.slug === 'rooms' ? size * .3 : 0;
      if (text.scrollWidth <= width && text.scrollHeight + inkMargin <= height) low = size;
      else high = size;
    }
    text.style.fontSize = `${Math.floor(low * 4) / 4}px`;
  }
  function schedule() {
    if (!scheduled) scheduled = requestAnimationFrame(fit);
  }
  new ResizeObserver(schedule).observe(stage);
  new MutationObserver(schedule).observe(text, { childList:true, characterData:true, subtree:true });
  document.fonts.ready.then(schedule);
  document.fonts.addEventListener('loadingdone', schedule);
  schedule();
})();
