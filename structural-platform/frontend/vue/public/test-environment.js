// The local test gateway loads this on every HTML page, including standalone tools.
(() => {
  if (location.hostname !== 'geekcalculus.test' || window.top !== window.self) return;
  const mount = () => {
    if (document.getElementById('geek-test-indicator')) return;
    const marker = document.createElement('div');
    marker.id = 'geek-test-indicator';
    marker.setAttribute('role', 'note');
    marker.setAttribute('aria-label', 'Test environment');
    marker.style.cssText = 'position:fixed!important;left:max(12px,env(safe-area-inset-left))!important;bottom:max(12px,env(safe-area-inset-bottom))!important;z-index:2147483647!important;pointer-events:none!important;';
    const shadow = marker.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent = 'span{display:block;padding:8px 16px;border:1px solid #956319;border-radius:7px;background:#ffd16b;color:#35240a;font:700 16px/1.25 Calibri,"Segoe UI",Arial,sans-serif;letter-spacing:.3px;box-shadow:0 2px 9px #0004;}';
    const text = document.createElement('span');
    text.textContent = 'Test';
    shadow.append(style, text);
    document.body.append(marker);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount, { once: true });
  else mount();
})();
