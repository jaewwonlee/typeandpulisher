import { imageURLs } from './cms-data.mjs?v=4';

export function createUsageGallery(frame) {
  const placeholder = frame.querySelector('.placeholder');
  const prev = frame.querySelector('.usage__nav--prev');
  const next = frame.querySelector('.usage__nav--next');
  const image = document.createElement('img');
  image.hidden = true;
  const status = document.createElement('span');
  status.className = 'usage__status';
  status.setAttribute('aria-live', 'polite');
  status.hidden = true;
  frame.append(image, status);
  frame.setAttribute('role', 'region');
  frame.setAttribute('aria-label', '사용 예시 이미지');
  let urls = [], index = 0, description = '';
  function render() {
    const available = urls.length > 0;
    image.hidden = !available;
    placeholder.hidden = available;
    prev.hidden = next.hidden = urls.length < 2;
    status.hidden = !available;
    frame.classList.toggle('usage__frame--empty', !available);
    if (!available) { image.removeAttribute('src'); return; }
    image.alt = `${description} (${index + 1}/${urls.length})`;
    status.textContent = `${index + 1} / ${urls.length}`;
    if (image.getAttribute('src') !== urls[index]) image.src = urls[index];
  }
  image.addEventListener('error', () => {
    image.hidden = true;
    placeholder.hidden = false;
    status.textContent = `${index + 1} / ${urls.length} · 이미지를 불러오지 못했습니다`;
  });
  image.addEventListener('load', () => { image.hidden = false; placeholder.hidden = true; });
  function move(delta) {
    if (urls.length < 2) return;
    index = (index + delta + urls.length) % urls.length;
    render();
  }
  prev.addEventListener('click', () => move(-1));
  next.addEventListener('click', () => move(1));
  frame.addEventListener('keydown', event => {
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault(); move(event.key === 'ArrowLeft' ? -1 : 1);
    }
  });
  return { update(value, caption) {
    const selected = urls[index];
    urls = imageURLs(value);
    index = Math.max(0, urls.indexOf(selected));
    description = caption;
    render();
  }};
}
