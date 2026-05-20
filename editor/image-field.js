/**
 * Harpoon Story Engine — Image Field Component
 * image-field.js
 *
 * Enhances image URL inputs with:
 *  1. Upload button — picks a file, uploads to S3, populates the URL field
 *  2. Focal point picker — drag a dot on a thumbnail to set object-position
 *
 * Usage: call initImageFields() after content is loaded.
 */

'use strict';

(function () {

  // ── Styles ────────────────────────────────────────────────────────

  const style = document.createElement('style');
  style.textContent = `
    .img-field-wrap {
      display: flex;
      flex-direction: column;
      gap: 0.35rem;
    }

    .img-field-row {
      display: flex;
      gap: 0.35rem;
      align-items: center;
    }

    .img-field-row .form-input {
      flex: 1;
      min-width: 0;
    }

    .img-upload-btn {
      flex-shrink: 0;
      padding: 0.38rem 0.55rem;
      background: var(--bg-2);
      border: 1px solid var(--rule);
      color: var(--ink-3);
      font-family: var(--font-mono);
      font-size: 0.56rem;
      letter-spacing: 0.1em;
      cursor: pointer;
      border-radius: 1px;
      white-space: nowrap;
      transition: all 0.12s;
    }

    .img-upload-btn:hover {
      border-color: var(--accent);
      color: var(--accent);
      background: rgba(139,58,42,0.04);
    }

    .img-upload-btn.is-uploading {
      opacity: 0.5;
      cursor: wait;
    }

    /* ── Focal point picker ── */

    .focal-wrap {
      display: none;
      flex-direction: column;
      gap: 0.35rem;
    }

    .focal-wrap.is-visible { display: flex; }

    .focal-label {
      font-family: var(--font-mono);
      font-size: 0.52rem;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      color: var(--ink-3);
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .focal-label-text { display: flex; align-items: center; gap: 0.4rem; }

    .focal-label-text::before {
      content: '⊕';
      font-size: 0.7rem;
      color: var(--accent);
    }

    .focal-coords {
      font-family: var(--font-mono);
      font-size: 0.5rem;
      color: var(--ink-3);
      background: var(--bg-2);
      padding: 0.15rem 0.4rem;
      border-radius: 1px;
    }

    .focal-canvas {
      position: relative;
      cursor: crosshair;
      overflow: hidden;
      border: 1px solid var(--rule);
      border-radius: 1px;
      background: var(--bg-3);
      user-select: none;
      height: 120px;
    }

    .focal-canvas img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      object-position: center;
      display: block;
      pointer-events: none;
    }

    .focal-dot {
      position: absolute;
      width: 18px;
      height: 18px;
      border-radius: 50%;
      border: 2px solid white;
      background: var(--accent);
      box-shadow: 0 0 0 1px rgba(0,0,0,0.3), 0 2px 6px rgba(0,0,0,0.4);
      transform: translate(-50%, -50%);
      transition: left 0s, top 0s;
      pointer-events: none;
    }

    .focal-dot::after {
      content: '';
      position: absolute;
      inset: -6px;
      border-radius: 50%;
    }

    .focal-reset {
      font-family: var(--font-mono);
      font-size: 0.52rem;
      letter-spacing: 0.1em;
      background: none;
      border: none;
      color: var(--ink-3);
      cursor: pointer;
      padding: 0;
      text-decoration: underline;
      text-underline-offset: 2px;
    }

    .focal-reset:hover { color: var(--accent); }

    .img-upload-progress {
      font-family: var(--font-mono);
      font-size: 0.54rem;
      letter-spacing: 0.1em;
      color: var(--ink-3);
      display: none;
    }

    .img-upload-progress.is-visible { display: block; }
    .img-upload-error {
      font-size: 0.62rem;
      color: #C0392B;
      display: none;
    }
    .img-upload-error.is-visible { display: block; }
  `;
  document.head.appendChild(style);

  // ── Public API ────────────────────────────────────────────────────

  /**
   * Enhance all image URL inputs in a container.
   * Called after content loads and after section editor opens.
   *
   * @param {string}   projectId  - current project ID
   * @param {Function} onUpdate   - callback(fieldId, url, focal) called when value changes
   * @param {Element}  [root]     - root element to search within (default: document)
   */
  window.initImageFields = function (projectId, onUpdate, root) {
    root = root || document;
    const inputs = root.querySelectorAll('input.form-input[data-image-field]');
    inputs.forEach(input => {
      if (input.dataset.enhanced) {
        // Already enhanced — just refresh the thumbnail and focal dot
        const fieldId = input.id;
        const focalWrap = document.querySelector('.focal-wrap');
        if (focalWrap && input.value) {
          const img = document.getElementById('focal-img-' + fieldId);
          if (img && img.src !== input.value) img.src = input.value;
          focalWrap.classList.add('is-visible');
        }
        // Restore focal from data attribute
        if (input.dataset.existingFocal) {
          const match = input.dataset.existingFocal.match(/(\d+)%\s*(\d+)%/);
          if (match) {
            const canvas = document.getElementById('focal-canvas-' + fieldId);
            if (canvas) canvas.dispatchEvent(new CustomEvent('set-focal', {
              detail: { x: parseInt(match[1])/100, y: parseInt(match[2])/100 }
            }));
          }
        }
        return;
      }
      enhanceImageField(input, projectId, onUpdate);
    });
  };

  // Update focal point on an already-enhanced field (e.g. when switching sections)
  window.updateImageFieldFocal = function (fieldId, focal) {
    if (!focal) return;
    const match = focal.match(/(\d+)%\s*(\d+)%/);
    if (!match) return;
    const x = parseInt(match[1]) / 100;
    const y = parseInt(match[2]) / 100;
    // Find the canvas for this field and set focal
    const canvas = document.getElementById('focal-canvas-' + fieldId);
    if (!canvas) return;
    canvas.dispatchEvent(new CustomEvent('set-focal', { detail: { x, y } }));
  };

  // ── Enhance a single image URL input ─────────────────────────────

  function enhanceImageField(urlInput, projectId, onUpdate) {
    // Don't double-enhance
    if (urlInput.dataset.enhanced) return;
    urlInput.dataset.enhanced = 'true';

    const fieldId   = urlInput.id;
    const focalPath = urlInput.dataset.focalPath || '';

    // Wrap the input
    const wrap = document.createElement('div');
    wrap.className = 'img-field-wrap';
    urlInput.parentNode.insertBefore(wrap, urlInput);

    // Row: input + upload button
    const row = document.createElement('div');
    row.className = 'img-field-row';
    wrap.appendChild(row);
    row.appendChild(urlInput);

    // Upload button
    const uploadBtn = document.createElement('button');
    uploadBtn.type      = 'button';
    uploadBtn.className = 'img-upload-btn';
    uploadBtn.textContent = '↑ Upload';
    uploadBtn.setAttribute('aria-label', 'Upload image from your computer');
    row.appendChild(uploadBtn);

    // Progress / error messages
    const progress = document.createElement('p');
    progress.className = 'img-upload-progress';
    wrap.appendChild(progress);

    const errMsg = document.createElement('p');
    errMsg.className = 'img-upload-error';
    wrap.appendChild(errMsg);

    // Focal point section
    const focalWrap = document.createElement('div');
    focalWrap.className = 'focal-wrap';
    focalWrap.innerHTML = `
      <div class="focal-label">
        <span class="focal-label-text">Focal point</span>
        <div style="display:flex;align-items:center;gap:0.5rem">
          <span class="focal-coords" id="focal-coords-${fieldId}">center</span>
          <button type="button" class="focal-reset" id="focal-reset-${fieldId}" aria-label="Reset focal point to centre">Reset</button>
        </div>
      </div>
      <div class="focal-canvas" id="focal-canvas-${fieldId}" role="img" aria-label="Click or drag to set focal point" tabindex="0">
        <img id="focal-img-${fieldId}" src="" alt="">
        <div class="focal-dot" id="focal-dot-${fieldId}" style="left:50%;top:50%"></div>
      </div>
    `;
    wrap.appendChild(focalWrap);

    const focalCanvas = focalWrap.querySelector('.focal-canvas');
    const focalImg    = focalWrap.querySelector('img');
    const focalDot    = focalWrap.querySelector('.focal-dot');
    const focalCoords = focalWrap.querySelector('.focal-coords');
    const focalReset  = focalWrap.querySelector('.focal-reset');

    // Current focal value
    let currentFocal = '50% 50%';

    // ── Upload handler ─────────────────────────────────────────────

    const fileInput = document.createElement('input');
    fileInput.type   = 'file';
    fileInput.accept = 'image/jpeg,image/png,image/webp,image/gif,video/mp4';
    fileInput.style.display = 'none';
    document.body.appendChild(fileInput);

    uploadBtn.addEventListener('click', () => fileInput.click());

    fileInput.addEventListener('change', async () => {
      const file = fileInput.files[0];
      if (!file) return;

      uploadBtn.classList.add('is-uploading');
      uploadBtn.disabled = true;
      progress.textContent = `Uploading ${file.name}…`;
      progress.classList.add('is-visible');
      errMsg.classList.remove('is-visible');

      try {
        const formData = new FormData();
        formData.append('file', file, file.name);

        const res  = await fetch(`/api/project/${projectId}/upload`, {
          method: 'POST',
          body: formData,
        });
        const data = await res.json();

        if (!res.ok) throw new Error(data.error || 'Upload failed');

        // Populate URL field
        urlInput.value = data.url;
        urlInput.dispatchEvent(new Event('input', { bubbles: true }));

        progress.textContent = data.compressed
          ? '✓ Compressed and uploaded'
          : '✓ Uploaded';
        setTimeout(() => { progress.classList.remove('is-visible'); }, 3000);

        // Show focal picker with the uploaded image
        showFocalPicker(data.url);

      } catch (err) {
        errMsg.textContent = err.message;
        errMsg.classList.add('is-visible');
        progress.classList.remove('is-visible');
      } finally {
        uploadBtn.classList.remove('is-uploading');
        uploadBtn.disabled = false;
        fileInput.value = '';
      }
    });

    // ── Show focal picker when URL is populated ────────────────────

    function showFocalPicker(url) {
      if (!url) { focalWrap.classList.remove('is-visible'); return; }
      focalWrap.classList.add('is-visible');
      focalImg.src = url;
      focalImg.onerror = () => { focalWrap.classList.remove('is-visible'); };
    }

    // Show picker if URL already has a value on load
    if (urlInput.value) showFocalPicker(urlInput.value);

    // Also show when URL is manually typed
    urlInput.addEventListener('input', () => {
      clearTimeout(urlInput._focalTimer);
      urlInput._focalTimer = setTimeout(() => showFocalPicker(urlInput.value), 800);
    });

    // ── Focal point interaction ────────────────────────────────────

    function setFocal(x, y) {
      // x, y are 0–1 fractions of the canvas dimensions
      const pctX = Math.round(x * 100);
      const pctY = Math.round(y * 100);
      currentFocal = `${pctX}% ${pctY}%`;

      focalDot.style.left = (pctX) + '%';
      focalDot.style.top  = (pctY) + '%';
      focalCoords.textContent = currentFocal;

      // Notify parent
      if (onUpdate) onUpdate(fieldId, urlInput.value, currentFocal, focalPath);
    }

    function focalFromEvent(e) {
      const rect = focalCanvas.getBoundingClientRect();
      const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      const y = Math.max(0, Math.min(1, (e.clientY - rect.top)  / rect.height));
      setFocal(x, y);
    }

    let draggingFocal = false;

    focalCanvas.addEventListener('mousedown', e => {
      draggingFocal = true;
      focalFromEvent(e);
      e.preventDefault();
    });

    document.addEventListener('mousemove', e => {
      if (draggingFocal) focalFromEvent(e);
    });

    document.addEventListener('mouseup', () => { draggingFocal = false; });

    // Keyboard: arrow keys move focal point
    focalCanvas.addEventListener('keydown', e => {
      const step = e.shiftKey ? 10 : 5;
      const cur  = currentFocal.match(/(\d+)%\s+(\d+)%/);
      if (!cur) return;
      let x = parseInt(cur[1]), y = parseInt(cur[2]);
      if (e.key === 'ArrowLeft')  x = Math.max(0,   x - step);
      if (e.key === 'ArrowRight') x = Math.min(100, x + step);
      if (e.key === 'ArrowUp')    y = Math.max(0,   y - step);
      if (e.key === 'ArrowDown')  y = Math.min(100, y + step);
      else if (!e.key.startsWith('Arrow')) return;
      e.preventDefault();
      setFocal(x / 100, y / 100);
    });

    focalReset.addEventListener('click', () => setFocal(0.5, 0.5));

    // Listen for external focal updates (e.g. when switching sections)
    focalCanvas.addEventListener('set-focal', (e) => {
      setFocal(e.detail.x, e.detail.y);
    });

    // Initialise dot from existing value on the input, or default to centre
    const existingFocal = urlInput.dataset.existingFocal || '';
    if (existingFocal) {
      const match = existingFocal.match(/(\d+)%\s*(\d+)%/);
      if (match) {
        setFocal(parseInt(match[1]) / 100, parseInt(match[2]) / 100);
      } else {
        setFocal(0.5, 0.5);
      }
    } else {
      setFocal(0.5, 0.5);
    }
  }

})();
