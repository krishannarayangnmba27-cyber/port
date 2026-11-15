(() => {
  'use strict';

  // Configuration
  const TOTAL_FRAMES = 240;
  const FRAME_DIR = './frames/';
  const FRAME_PREFIX = 'frame_';
  const FRAME_PAD = 6;
  const FRAME_EXT = '.png';
  const LERP_FACTOR = 0.08; // Buttery smooth interpolation factor

  // DOM Elements
  const canvas = document.getElementById('animation-canvas');
  const ctx = canvas.getContext('2d', { alpha: false });
  const loaderStatus = document.getElementById('loader-status');
  const loaderText = document.getElementById('loader-text');

  // State
  const images = new Array(TOTAL_FRAMES + 1);
  const loadedFlags = new Array(TOTAL_FRAMES + 1).fill(false);
  let loadedCount = 0;
  let targetProgress = 0;
  let currentProgress = 0;
  let lastRenderedFrame = -1;
  let animationFrameId = null;
  let isInitialFrameRendered = false;

  // Build frame URL helper
  function getFrameUrl(index) {
    const padded = String(index).padStart(FRAME_PAD, '0');
    return `${FRAME_DIR}${FRAME_PREFIX}${padded}${FRAME_EXT}`;
  }

  // Canvas Sizing with Retina / High-DPI support
  function resizeCanvas() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2); // Cap at 2x for smooth 60fps performance
    const displayWidth = window.innerWidth;
    const displayHeight = window.innerHeight;

    if (canvas.width !== displayWidth * dpr || canvas.height !== displayHeight * dpr) {
      canvas.width = displayWidth * dpr;
      canvas.height = displayHeight * dpr;
    }

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    // Force redraw current frame after resize
    if (lastRenderedFrame > 0) {
      const img = getBestAvailableFrame(lastRenderedFrame);
      if (img) {
        renderImageCover(img);
      }
    }
  }

  // Draw image preserving aspect ratio with cover fitting (centered)
  function renderImageCover(img) {
    if (!img || !img.complete || img.naturalWidth === 0) return;

    const cw = canvas.width;
    const ch = canvas.height;
    const iw = img.naturalWidth;
    const ih = img.naturalHeight;

    const imgAspect = iw / ih;
    const canvasAspect = cw / ch;

    let renderWidth, renderHeight, offsetX, offsetY;

    if (canvasAspect > imgAspect) {
      // Screen is wider than image aspect ratio
      renderWidth = cw;
      renderHeight = cw / imgAspect;
      offsetX = 0;
      offsetY = (ch - renderHeight) / 2;
    } else {
      // Screen is taller than image aspect ratio
      renderHeight = ch;
      renderWidth = ch * imgAspect;
      offsetX = (cw - renderWidth) / 2;
      offsetY = 0;
    }

    ctx.fillStyle = '#0a0908';
    ctx.fillRect(0, 0, cw, ch);
    ctx.drawImage(img, offsetX, offsetY, renderWidth, renderHeight);
  }

  // Find nearest loaded frame if the requested one is buffering
  function getBestAvailableFrame(preferredIndex) {
    if (loadedFlags[preferredIndex] && images[preferredIndex]) {
      return images[preferredIndex];
    }

    // Search outward for closest loaded frame
    let offset = 1;
    while (preferredIndex - offset >= 1 || preferredIndex + offset <= TOTAL_FRAMES) {
      const lower = preferredIndex - offset;
      if (lower >= 1 && loadedFlags[lower] && images[lower]) {
        return images[lower];
      }
      const upper = preferredIndex + offset;
      if (upper <= TOTAL_FRAMES && loadedFlags[upper] && images[upper]) {
        return images[upper];
      }
      offset++;
    }

    return null;
  }

  // Update scroll target progress based on page scroll
  function onScroll() {
    const docHeight = document.documentElement.scrollHeight - window.innerHeight;
    if (docHeight <= 0) {
      targetProgress = 0;
      return;
    }

    const scrollY = Math.max(0, window.pageYOffset || document.documentElement.scrollTop || 0);
    targetProgress = Math.min(1, Math.max(0, scrollY / docHeight));
  }

  // Render loop with smooth linear interpolation
  function tick() {
    // Smooth lerp
    const diff = targetProgress - currentProgress;
    if (Math.abs(diff) > 0.0001) {
      currentProgress += diff * LERP_FACTOR;
    } else {
      currentProgress = targetProgress;
    }

    // Map progress [0, 1] to frame [1, TOTAL_FRAMES]
    const targetFrameIndex = Math.min(
      TOTAL_FRAMES,
      Math.max(1, Math.round(1 + currentProgress * (TOTAL_FRAMES - 1)))
    );

    if (targetFrameIndex !== lastRenderedFrame || !isInitialFrameRendered) {
      const frameImg = getBestAvailableFrame(targetFrameIndex);
      if (frameImg) {
        renderImageCover(frameImg);
        lastRenderedFrame = targetFrameIndex;
        isInitialFrameRendered = true;
      }
    }

    animationFrameId = requestAnimationFrame(tick);
  }

  // Preload frame by index
  function loadFrame(index) {
    return new Promise((resolve) => {
      const img = new Image();
      img.src = getFrameUrl(index);

      img.onload = () => {
        images[index] = img;
        loadedFlags[index] = true;
        loadedCount++;

        // Render first frame immediately to eliminate white/blank flash
        if (index === 1 && !isInitialFrameRendered) {
          resizeCanvas();
          renderImageCover(img);
          lastRenderedFrame = 1;
          isInitialFrameRendered = true;
        }

        updateLoader();
        resolve(img);
      };

      img.onerror = () => {
        loadedCount++;
        updateLoader();
        resolve(null);
      };
    });
  }

  // Update loading pill
  function updateLoader() {
    const pct = Math.floor((loadedCount / TOTAL_FRAMES) * 100);
    if (loaderText) {
      loaderText.textContent = `Loading frames ${pct}%`;
    }

    if (loadedCount >= TOTAL_FRAMES) {
      setTimeout(() => {
        if (loaderStatus) {
          loaderStatus.classList.add('loaded');
        }
      }, 300);
    }
  }

  // Progressive Preloader: Prioritizes initial scrubbing window, then loads remainder
  async function preloadAllFrames() {
    // 1. Immediate priority: First frame
    await loadFrame(1);

    // 2. High priority: Key interval anchor frames (every 10th frame) for responsive scrubbing while loading
    const keyFrames = [];
    for (let i = 10; i <= TOTAL_FRAMES; i += 10) {
      keyFrames.push(i);
    }
    await Promise.all(keyFrames.map(loadFrame));

    // 3. Batch load all remaining frames in chunks to avoid network saturation
    const remainingIndices = [];
    for (let i = 1; i <= TOTAL_FRAMES; i++) {
      if (!loadedFlags[i]) {
        remainingIndices.push(i);
      }
    }

    const CONCURRENCY = 6;
    let index = 0;

    async function loadNext() {
      while (index < remainingIndices.length) {
        const frameIdx = remainingIndices[index++];
        await loadFrame(frameIdx);
      }
    }

    const workers = [];
    for (let i = 0; i < CONCURRENCY; i++) {
      workers.push(loadNext());
    }

    await Promise.all(workers);
  }

  // Initialization
  function init() {
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas, { passive: true });
    window.addEventListener('scroll', onScroll, { passive: true });

    // Initial scroll position sync
    onScroll();

    // Start RAF Loop
    animationFrameId = requestAnimationFrame(tick);

    // Start Asset Loading
    preloadAllFrames();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
