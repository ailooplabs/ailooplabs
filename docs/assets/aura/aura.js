/* Progressive enhancements: the written guide and media links work without JS. */
(() => {
  'use strict';

  const assetBase = new URL('assets/aura/', document.baseURI);
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const manuals = [...document.querySelectorAll('[data-manual]')];

  function screenshotURL(file) {
    if (typeof file !== 'string' || !/^screens\/[a-z0-9_-]+\.(?:png|jpe?g|webp)$/i.test(file)) return null;
    return new URL(file, assetBase).href;
  }

  function seconds(value) {
    if (typeof value === 'number') return Number.isFinite(value) && value >= 0 ? value : null;
    if (typeof value !== 'string' || !value.trim()) return null;
    if (/^\d+(?:\.\d+)?$/.test(value)) return Number(value);
    if (!/^\d+:\d{2}(?::\d{2})?(?:\.\d+)?$/.test(value)) return null;
    const parts = value.split(':').map(Number);
    if (parts.slice(1).some(part => part >= 60)) return null;
    return parts.reduce((total, part) => total * 60 + part, 0);
  }

  function timestamp(value) {
    const total = Math.floor(value);
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const rest = String(total % 60).padStart(2, '0');
    return hours ? `${hours}:${String(minutes).padStart(2, '0')}:${rest}` : `${minutes}:${rest}`;
  }

  function validScenes(data) {
    if (!data || !Array.isArray(data.scenes)) return [];
    return data.scenes.map(scene => {
      if (!scene || typeof scene !== 'object') return null;
      const start = seconds(scene.start);
      const end = seconds(scene.end);
      if (start === null || end === null || end <= start || typeof scene.title !== 'string' || !scene.title.trim() || typeof scene.narration !== 'string' || !scene.narration.trim()) return null;
      return { start, end, title: scene.title.trim(), narration: scene.narration.trim(), screenshot: screenshotURL(scene.screenshot) };
    }).filter(Boolean).sort((a, b) => a.start - b.start);
  }

  function screenshotLink(url, title, group, caption) {
    const link = document.createElement('a');
    link.href = url;
    link.dataset.lightbox = '';
    link.dataset.gallery = group;
    link.dataset.caption = caption;
    link.setAttribute('aria-label', `Enlarge ${title} example screenshot`);
    return link;
  }

  function renderGallery(entries) {
    const gallery = document.querySelector('[data-screen-gallery]');
    if (!gallery || !Array.isArray(entries)) return;
    const fragment = document.createDocumentFragment();
    const seen = new Set();
    entries.forEach(entry => {
      if (!entry || typeof entry !== 'object') return;
      const url = screenshotURL(entry.screenshot || entry.file);
      if (!url || seen.has(url) || typeof entry.title !== 'string' || !entry.title.trim()) return;
      seen.add(url);
      const title = entry.title.trim();
      const description = typeof entry.description === 'string' ? entry.description.trim() : '';
      const figure = document.createElement('figure');
      figure.className = 'gallery-item';
      const caption = `${title} — example Aura app state.${description ? ` ${description}` : ''} TV prompts are illustrative; check results on your actual TV.`;
      const link = screenshotLink(url, title, 'all-screens', caption);
      const img = document.createElement('img');
      img.src = url;
      img.alt = `${title} — example Aura app state.`;
      img.width = 720;
      img.height = 1280;
      img.loading = 'lazy';
      img.decoding = 'async';
      link.append(img);
      const figcaption = document.createElement('figcaption');
      const heading = document.createElement('h3');
      heading.textContent = title;
      figcaption.append(heading);
      if (description) {
        const paragraph = document.createElement('p');
        paragraph.textContent = description;
        figcaption.append(paragraph);
      }
      figure.append(link, figcaption);
      fragment.append(figure);
    });
    // Keep the useful static gallery if optional data is missing or invalid.
    if (fragment.childElementCount) gallery.replaceChildren(fragment);
  }

  function renderManual(section, data) {
    const scenes = validScenes(data);
    if (!scenes.length) return;
    const video = section.querySelector('video');
    const list = section.querySelector('[data-chapter-list]');
    const transcript = section.querySelector('[data-transcript]');
    const status = section.querySelector('[data-seek-status]');
    const chapterFragment = document.createDocumentFragment();
    const transcriptFragment = document.createDocumentFragment();
    const chapterButtons = [];
    let pendingScene = null;
    let metadataRequested = false;
    let activeIndex = -1;

    function completeSeek(scene) {
      const limit = Number.isFinite(video.duration) ? Math.max(0, video.duration - .05) : scene.start;
      try {
        // Land inside the scene rather than on the previous segment's final frame.
        video.currentTime = Math.min(scene.start + .12, limit);
        video.focus({ preventScroll: true });
        video.scrollIntoView({ behavior: reducedMotion.matches ? 'auto' : 'smooth', block: 'center' });
        status.textContent = `Moved to ${timestamp(scene.start)}: ${scene.title}. ${video.paused ? 'Press Play when ready.' : 'Playback continues.'}`;
      } catch {
        status.textContent = 'This chapter could not be selected. Use the video controls or the download link.';
      }
    }

    function seek(scene) {
      if (video.readyState >= 1) {
        completeSeek(scene);
      } else {
        pendingScene = scene;
        status.textContent = `Loading ${scene.title}. Playback will not start automatically.`;
        if (!metadataRequested) {
          metadataRequested = true;
          video.preload = 'metadata';
          video.load();
        }
      }
    }

    video.addEventListener('loadedmetadata', () => {
      metadataRequested = false;
      if (pendingScene) {
        completeSeek(pendingScene);
        pendingScene = null;
      }
    });
    video.addEventListener('error', () => {
      metadataRequested = false;
      pendingScene = null;
      status.textContent = 'The video could not be loaded. Use the download link or written setup.';
    });

    scenes.forEach(scene => {
      const item = document.createElement('li');
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'chapter-button';
      button.setAttribute('aria-controls', video.id);
      const time = document.createElement('span');
      time.className = 'chapter-time';
      time.textContent = timestamp(scene.start);
      const title = document.createElement('span');
      title.textContent = scene.title;
      button.append(time, title);
      button.addEventListener('click', () => seek(scene));
      item.append(button);
      chapterFragment.append(item);
      chapterButtons.push(button);

      const entry = document.createElement('section');
      entry.className = 'transcript-scene';
      const heading = document.createElement('h4');
      const transcriptButton = document.createElement('button');
      transcriptButton.type = 'button';
      transcriptButton.className = 'transcript-seek';
      transcriptButton.textContent = `${timestamp(scene.start)} · ${scene.title}`;
      transcriptButton.setAttribute('aria-controls', video.id);
      transcriptButton.addEventListener('click', () => seek(scene));
      heading.append(transcriptButton);
      const narration = document.createElement('p');
      narration.textContent = scene.narration;
      entry.append(heading, narration);
      if (scene.screenshot) {
        const link = screenshotLink(scene.screenshot, scene.title, `${section.dataset.manual}-transcript`, `${scene.title} — example Aura app state. TV prompts are illustrative; check results on your actual TV.`);
        link.textContent = 'View this example app state';
        entry.append(link);
      }
      transcriptFragment.append(entry);
    });

    list.replaceChildren(chapterFragment);
    transcript.replaceChildren(transcriptFragment);
    const duration = seconds(data.duration);
    if (duration !== null && duration > 0) section.querySelector('[data-duration]').textContent = `${timestamp(Math.round(duration))} · English`;
    section.querySelector('[data-manual-fallback]').hidden = true;
    section.querySelector('[data-manual-content]').hidden = false;

    video.addEventListener('timeupdate', () => {
      const current = scenes.findIndex(scene => video.currentTime >= scene.start && video.currentTime < scene.end);
      if (current === activeIndex) return;
      if (activeIndex >= 0) chapterButtons[activeIndex].removeAttribute('aria-current');
      if (current >= 0) chapterButtons[current].setAttribute('aria-current', 'true');
      activeIndex = current;
    });
  }

  manuals.forEach(section => {
    const video = section.querySelector('video');
    const error = section.querySelector('[data-video-error]');
    function showError() { error.hidden = false; }
    video.addEventListener('error', showError);
    section.querySelector('source').addEventListener('error', showError);
    video.addEventListener('loadedmetadata', () => { error.hidden = true; });
    video.addEventListener('play', () => {
      manuals.forEach(other => { if (other !== section) other.querySelector('video').pause(); });
    });
  });

  const dialog = document.querySelector('.image-dialog');
  if (dialog && typeof dialog.showModal === 'function') {
    const image = dialog.querySelector('.lightbox-image');
    const caption = dialog.querySelector('.lightbox-caption');
    const counter = dialog.querySelector('.lightbox-count');
    const previous = dialog.querySelector('[data-lightbox-prev]');
    const next = dialog.querySelector('[data-lightbox-next]');
    let items = [];
    let index = 0;
    let opener = null;

    function showImage() {
      const item = items[index];
      const focused = document.activeElement;
      image.src = item.href;
      image.alt = item.querySelector('img')?.alt || item.dataset.caption || 'Example Aura app state';
      caption.textContent = item.dataset.caption || image.alt;
      counter.textContent = `${index + 1} of ${items.length}`;
      previous.disabled = index === 0;
      next.disabled = index === items.length - 1;
      if (dialog.open && focused === previous && previous.disabled) next.focus();
      if (dialog.open && focused === next && next.disabled) previous.focus();
    }

    function move(amount) {
      const target = index + amount;
      if (target < 0 || target >= items.length) return;
      index = target;
      showImage();
    }

    document.addEventListener('click', event => {
      const link = event.target.closest('a[data-lightbox]');
      if (!link || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      opener = link;
      items = [...document.querySelectorAll('a[data-lightbox]')].filter(item => item.dataset.gallery === link.dataset.gallery);
      index = items.indexOf(link);
      showImage();
      dialog.showModal();
      document.body.classList.add('dialog-open');
    });
    previous.addEventListener('click', () => move(-1));
    next.addEventListener('click', () => move(1));
    dialog.addEventListener('keydown', event => {
      if (event.altKey || event.ctrlKey || event.metaKey) return;
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        event.preventDefault();
        move(event.key === 'ArrowLeft' ? -1 : 1);
      }
      if (event.key === 'Escape') { event.preventDefault(); dialog.close(); }
    });
    dialog.addEventListener('click', event => {
      if (event.target !== dialog) return;
      const rect = dialog.getBoundingClientRect();
      if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
    });
    dialog.addEventListener('close', () => {
      document.body.classList.remove('dialog-open');
      if (opener?.isConnected) opener.focus({ preventScroll: true });
    });
  }

  // Hide unavailable screenshot images gracefully; the written guide remains useful.
  document.addEventListener('error', event => {
    const img = event.target;
    if (!(img instanceof HTMLImageElement) || img.classList.contains('lightbox-image')) return;
    const link = img.closest('a[data-lightbox]');
    if (!link) return;
    const fallback = document.createElement('span');
    fallback.className = 'asset-fallback';
    fallback.textContent = 'Screenshot unavailable. Follow the written guide for this step.';
    link.replaceWith(fallback);
  }, true);

  if (manuals.length || document.querySelector('[data-screen-gallery]')) {
    fetch(new URL('chapters.json', assetBase), { credentials: 'same-origin' })
      .then(response => { if (!response.ok) throw new Error('Guide data unavailable'); return response.json(); })
      .then(data => {
        if (!data || typeof data !== 'object') return;
        manuals.forEach(section => renderManual(section, data[section.dataset.manual]));
        renderGallery(data.gallery);
      })
      .catch(() => { /* Preserve static setup text and screenshots on failure. */ });
  }
})();
