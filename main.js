// Created by Sid — progressive enhancement only. Without JS, play buttons link to the MP4 files.
(function () {
  'use strict';

  // Mobile navigation
  var head = document.querySelector('.site-head');
  var toggle = document.querySelector('.nav-toggle');
  if (head && toggle) {
    var setOpen = function (open) {
      head.classList.toggle('is-open', open);
      toggle.setAttribute('aria-expanded', String(open));
      toggle.textContent = open ? 'Close' : 'Menu';
    };
    toggle.addEventListener('click', function () { setOpen(!head.classList.contains('is-open')); });
    head.querySelectorAll('.nav a').forEach(function (a) { a.addEventListener('click', function () { setOpen(false); }); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && head.classList.contains('is-open')) { setOpen(false); toggle.focus(); }
    });
  }

  // Click-to-play: swap poster + link for a native <video> only when asked.
  function showError(frame, href) {
    frame.classList.remove('is-loading');
    var box = document.createElement('div');
    box.className = 'player__error';
    box.setAttribute('role', 'alert');
    box.innerHTML = '<p>This video couldn’t load.</p><p><a href="' + href + '">Open the video file</a></p>';
    frame.appendChild(box);
  }

  document.addEventListener('click', function (e) {
    var link = e.target.closest && e.target.closest('.player__play');
    if (!link) return;
    var frame = link.parentElement;
    if (link.dataset.youtube) { e.preventDefault(); playYouTube(link, frame); return; }
    var probe = document.createElement('video');
    if (!probe.canPlayType || !probe.canPlayType('video/mp4')) return; // let the browser open the file
    e.preventDefault();

    var video = document.createElement('video');
    video.controls = true;
    video.playsInline = true;
    video.preload = 'auto';
    video.poster = link.dataset.poster;
    video.width = +link.dataset.w;
    video.height = +link.dataset.h;
    var label = link.querySelector('.sr-only');
    video.setAttribute('aria-label', label ? label.textContent.replace(/^\s*video:\s*/, '') : 'Video');
    if (link.dataset.captions) {
      var track = document.createElement('track');
      track.kind = 'captions'; track.srclang = 'en'; track.label = 'English'; track.src = link.dataset.captions;
      video.appendChild(track);
    }
    var src = link.dataset.video;
    video.addEventListener('error', function () { showError(frame, src); });
    ['playing', 'pause', 'canplay'].forEach(function (ev) {
      video.addEventListener(ev, function () { frame.classList.remove('is-loading'); });
    });
    video.addEventListener('waiting', function () { frame.classList.add('is-loading'); });

    frame.classList.add('is-loading');
    var img = frame.querySelector('img');
    if (img) img.remove();
    link.replaceWith(video);
    video.src = src;
    video.focus();
    var p = video.play();
    if (p && p.catch) p.catch(function () { frame.classList.remove('is-loading'); });
  });

  // YouTube-hosted videos: swap the poster for a privacy-enhanced embed, started by the click.
  var YT_ORIGIN = 'https://www.youtube-nocookie.com';
  function ytCommand(iframe, func) {
    if (iframe.contentWindow) iframe.contentWindow.postMessage(JSON.stringify({ event: 'command', func: func, args: [] }), YT_ORIGIN);
  }
  function pauseAll(except) {
    document.querySelectorAll('video').forEach(function (v) { if (v !== except) v.pause(); });
    document.querySelectorAll('iframe[data-yt]').forEach(function (f) { if (f !== except) ytCommand(f, 'pauseVideo'); });
  }
  function playYouTube(link, frame) {
    var iframe = document.createElement('iframe');
    iframe.dataset.yt = '';
    iframe.src = YT_ORIGIN + '/embed/' + encodeURIComponent(link.dataset.youtube) +
      '?autoplay=1&controls=0&rel=0&playsinline=1&enablejsapi=1&origin=' + encodeURIComponent(location.origin);
    iframe.title = link.getAttribute('aria-label').replace(/^Play video:\s*/, '').replace(/,\s*[\d:]+$/, '');
    iframe.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
    iframe.allowFullscreen = true;
    iframe.referrerPolicy = 'strict-origin-when-cross-origin';
    iframe.addEventListener('load', function () {
      frame.classList.remove('is-loading');
      // Ask the player to report state changes so other videos can pause when it plays.
      iframe.contentWindow.postMessage(JSON.stringify({ event: 'listening', id: 1 }), YT_ORIGIN);
    });
    pauseAll(iframe);
    frame.classList.add('is-loading');
    var img = frame.querySelector('img');
    if (img) img.remove();
    link.replaceWith(iframe);
    iframe.focus();
  }
  window.addEventListener('message', function (e) {
    if (e.origin !== YT_ORIGIN || typeof e.data !== 'string') return;
    var msg; try { msg = JSON.parse(e.data); } catch (err) { return; }
    var playing = (msg.event === 'onStateChange' && msg.info === 1) ||
      (msg.event === 'infoDelivery' && msg.info && msg.info.playerState === 1);
    if (!playing) return;
    document.querySelectorAll('iframe[data-yt]').forEach(function (f) { if (f.contentWindow === e.source) pauseAll(f); });
  });

  // Only one video plays at a time.
  document.addEventListener('play', function (e) { pauseAll(e.target); }, true);

  // Category filters (rendered only when two or more categories have projects).
  var filterBar = document.querySelector('.filters');
  if (filterBar) {
    filterBar.hidden = false;
    var cards = document.querySelectorAll('.proj[data-category]');
    var status = document.querySelector('[data-filter-status]');
    filterBar.addEventListener('click', function (e) {
      var btn = e.target.closest('.filter');
      if (!btn) return;
      var cat = btn.dataset.filter;
      filterBar.querySelectorAll('.filter').forEach(function (b) { b.setAttribute('aria-pressed', String(b === btn)); });
      var shown = 0;
      cards.forEach(function (card) {
        var match = !cat || card.dataset.category === cat;
        card.hidden = !match;
        if (match) shown++;
        else {
          card.querySelectorAll('video').forEach(function (v) { v.pause(); });
          card.querySelectorAll('iframe[data-yt]').forEach(function (f) { ytCommand(f, 'pauseVideo'); });
        }
      });
      if (status) status.textContent = 'Showing ' + shown + (shown === 1 ? ' project' : ' projects') + (cat ? ' in ' + cat : '');
    });
  }

  // Copy email
  document.querySelectorAll('[data-copy]').forEach(function (btn) {
    if (!navigator.clipboard) return;
    btn.hidden = false;
    var status = btn.nextElementSibling;
    btn.addEventListener('click', function () {
      navigator.clipboard.writeText(btn.dataset.copy).then(
        function () { status.textContent = 'Copied to clipboard'; },
        function () { status.textContent = 'Couldn’t copy. Select the address instead.'; }
      );
    });
  });
})();
