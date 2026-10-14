import './standards-preview.css'

/* GitHub Pages demo navigation shim. Native Vue implementation lives in source. */
  (function(){
    const destination = new URL('hi-doubly-symmetric-aisc360-10.html', document.baseURI).href;
    let overlay = null, previousFocus = null;
    function close(){
      if(!overlay) return;
      overlay.remove();overlay=null;previousFocus?.focus?.();
    }
    function choose(){
      previousFocus=document.activeElement;
      const isEnglish=document.documentElement.lang==='en';
      overlay=document.createElement('div');
      overlay.className='geek-standards-backdrop';
      overlay.innerHTML=`<section class="geek-standards-dialog" role="dialog" aria-modal="true" aria-label="${isEnglish?'Choose design standard':'Chọn tiêu chuẩn thiết kế'}">
        <header class="geek-standards-head"><div>
          <span class="geek-standards-kicker">STEEL DESIGN / COMPONENT / SYMMETRIC I/H</span>
          <h2>${isEnglish?'Choose design standard':'Chọn tiêu chuẩn thiết kế'}</h2>
          <p>${isEnglish?'Select the design specification for this section.':'Chọn phiên bản tiêu chuẩn để mở bảng tính cấu kiện I/H đối xứng.'}</p>
        </div><button class="geek-standards-close" type="button" aria-label="Close">×</button></header>
        <div class="geek-standards-options">
          <button data-ready type="button"><span><strong>AISC 360-10</strong><small>Phase 1 · Excel Parity (Preview)</small></span><span>→</span></button>
          <button disabled type="button"><span><strong>AISC 360-16</strong><small>Coming soon</small></span></button>
          <button disabled type="button"><span><strong>AISC 360-22</strong><small>Coming soon</small></span></button>
          <button disabled type="button"><span><strong>EN 1993</strong><small>Coming soon</small></span></button>
        </div>
        <p class="geek-standards-warning">${isEnglish?'Engineering warning: AISC 360-10 is a navigation label, the current calculation is an AISC 360-05 Excel parity preview and is not design-certified.':'Lưu ý: AISC 360-10 hiện là lựa chọn giao diện; kết quả vẫn đối chiếu Excel AISC 360-05, chưa được xác nhận dùng thiết kế.'}</p>
      </section>`;
      document.body.appendChild(overlay);
      overlay.querySelector('.geek-standards-close').addEventListener('click',close);
      overlay.querySelector('[data-ready]').addEventListener('click',()=>window.location.assign(destination));
      overlay.addEventListener('click',e=>{if(e.target===overlay)close()});
      overlay.addEventListener('keydown',e=>{
        if(e.key==='Escape'){e.preventDefault();close()}
        if(e.key==='Tab'){
          const controls=[...overlay.querySelectorAll('button:not([disabled])')];
          const idx=controls.indexOf(document.activeElement);
          if(e.shiftKey && idx===0){e.preventDefault();controls[controls.length-1].focus()}
          else if(!e.shiftKey && idx===controls.length-1){e.preventDefault();controls[0].focus()}
        }
      });
      overlay.querySelector('.geek-standards-close').focus();
    }
    document.addEventListener('click',e=>{
      const card=e.target.closest?.('.steel-component-card[data-component="symmetric_i"]');
      if(!card)return;
      e.preventDefault();e.stopImmediatePropagation();choose();
    },true);
    function deepLinkFallback(){
      if(location.hash==='#/modules/steel/components/symmetric-i/aisc-360-10')window.location.replace(destination);
    }
    window.addEventListener('hashchange',deepLinkFallback);deepLinkFallback();
  })();
