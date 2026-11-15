/* Shared UI helpers: element builder and a copy button that survives a refused clipboard. */
function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined && text !== null) e.textContent = text;
  return e;
}
function copyBtn(getText, what) {
  const b = el('button', 'copy', 'Copy');
  b.type = 'button';
  b.setAttribute('aria-label', 'Copy ' + what);
  b.addEventListener('click', () => {
    const text = typeof getText === 'function' ? getText() : getText;
    const done = () => { b.textContent = 'Copied'; b.classList.add('done'); setTimeout(() => { b.textContent = 'Copy'; b.classList.remove('done'); }, 1300); };
    const fallback = () => {
      const ta = document.createElement('textarea');
      ta.value = text; ta.setAttribute('readonly', ''); ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0';
      document.body.appendChild(ta); ta.select();
      let ok = false; try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
      ta.remove();
      if (ok) done(); else { b.textContent = 'Select and copy by hand'; setTimeout(() => { b.textContent = 'Copy'; }, 2000); }
    };
    try { navigator.clipboard.writeText(text).then(done, fallback); } catch (e) { fallback(); }
  });
  return b;
}
function codeBlock(title, text) {
  const fig = el('figure', 'block');
  const cap = el('figcaption', '', title);
  cap.appendChild(copyBtn(text, title));
  fig.appendChild(cap);
  const pre = el('pre', '', text); pre.tabIndex = 0;
  fig.appendChild(pre);
  return fig;
}
