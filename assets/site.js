/* Public site rendering — reads data/season.json and paints the page. */
(function () {
  'use strict';

  var MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  var DAYS = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];

  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  function isGame(row) {
    return row.time && row.time !== 'NO GAME' && row.week !== '—';
  }

  // First upcoming real game (by ISO date); falls back to the last game.
  function nextGame(schedule) {
    var today = new Date();
    today.setHours(0, 0, 0, 0);
    var games = schedule.filter(isGame);
    var upcoming = games.filter(function (r) {
      return r.iso && new Date(r.iso + 'T00:00:00') >= today;
    });
    return upcoming[0] || games[games.length - 1] || null;
  }

  function renderNextGame(game, season) {
    var box = document.getElementById('nextGame');
    if (!game) { box.querySelector('.game-details').innerHTML = '<strong>Schedule TBD</strong>'; return; }
    var d = game.iso ? new Date(game.iso + 'T00:00:00') : null;
    box.innerHTML =
      '<div class="date-box">' +
        '<div class="day">' + (d ? DAYS[d.getDay()] : '') + '</div>' +
        '<div class="month">' + (d ? MONTHS[d.getMonth()] : '') + '</div>' +
        '<div class="num">' + (d ? d.getDate() : game.week) + '</div>' +
        '<div class="year">' + (d ? d.getFullYear() : '') + '</div>' +
      '</div>' +
      '<div class="game-details">' +
        '<strong>' + esc(game.time) + '</strong>' +
        '<strong>📍 ' + esc(game.rink || season.defaultRink || '') + '</strong>' +
        '<strong>Week ' + esc(game.week) + '</strong>' +
        '<a class="btn" href="#schedule">VIEW FULL SCHEDULE →</a>' +
      '</div>';
  }

  function renderSchedule(schedule, game) {
    document.getElementById('scheduleBody').innerHTML = schedule.map(function (r) {
      var cls = !isGame(r) ? 'no-game' : (game && r === game ? 'highlight' : '');
      return '<tr class="' + cls + '">' +
        '<td>' + esc(r.week) + '</td><td>' + esc(r.date) + '</td>' +
        '<td>' + esc(r.time) + '</td><td>' + esc(r.rink) + '</td></tr>';
    }).join('');
  }

  function renderStats(rows) {
    document.getElementById('statsBody').innerHTML = rows.map(function (p, i) {
      return '<tr><td>' + (i + 1) + '</td><td><b>' + esc(p.name) + '</b></td>' +
        '<td>' + p.gp + '</td><td>' + p.g + '</td><td>' + p.a + '</td>' +
        '<td class="points">' + p.pts + '</td></tr>';
    }).join('');
  }

  var TOP_NEWS = 3;

  function dateLineHTML(n) {
    return n.date ? '<span class="news-date">' + esc(n.date) + '</span>' : '';
  }

  // Minimal, safe Markdown → HTML for news bodies. Everything is escaped first,
  // so only the markup below can produce tags. Single newlines become <br>
  // (the sheet is typed like a text message, not like a Markdown document).
  // Supports: # headings, **bold**, *italic*, ~~strike~~, `code`, [links](url),
  // bare URLs, - / 1. lists, > quotes and --- rules.
  function mdInline(s) {
    var codes = [];
    s = esc(s).replace(/`([^`]+)`/g, function (m, c) { codes.push(c); return '\u0000' + (codes.length - 1) + '\u0000'; });
    s = s
      .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+|mailto:[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
      .replace(/(^|[\s(])(https?:\/\/[^\s<]+[^\s<.,;:!?)])/g, '$1<a href="$2" target="_blank" rel="noopener">$2</a>')
      .replace(/(\*\*|__)(?=\S)([\s\S]*?\S)\1/g, '<strong>$2</strong>')
      .replace(/(^|[^*\w])\*(?=\S)([^*]*?\S)\*(?!\*)/g, '$1<em>$2</em>')
      .replace(/(^|[^\w])_(?=\S)([^_]*?\S)_(?!\w)/g, '$1<em>$2</em>')
      .replace(/~~(?=\S)([\s\S]*?\S)~~/g, '<del>$1</del>');
    return s.replace(/\u0000(\d+)\u0000/g, function (m, i) { return '<code>' + codes[i] + '</code>'; });
  }

  function markdown(src) {
    var lines = String(src || '').replace(/\r\n?/g, '\n').split('\n');
    var out = [], para = [], list = null, quote = [];
    function flushPara() { if (para.length) out.push('<p>' + para.map(mdInline).join('<br>') + '</p>'); para = []; }
    function flushList() { if (list) out.push('<' + list.tag + '>' + list.items.map(function (i) { return '<li>' + mdInline(i) + '</li>'; }).join('') + '</' + list.tag + '>'); list = null; }
    function flushQuote() { if (quote.length) out.push('<blockquote>' + quote.map(mdInline).join('<br>') + '</blockquote>'); quote = []; }
    function flush() { flushPara(); flushList(); flushQuote(); }
    lines.forEach(function (line) {
      var m;
      if (!line.trim()) { flush(); return; }
      if ((m = line.match(/^\s*(#{1,6})\s+(.*?)\s*#*\s*$/))) {
        flush(); var lvl = Math.min(m[1].length + 3, 6);   // # → h4 (cards already use h4 for titles)
        out.push('<h' + lvl + ' class="md-h">' + mdInline(m[2]) + '</h' + lvl + '>'); return;
      }
      if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(line)) { flush(); out.push('<hr>'); return; }
      if ((m = line.match(/^\s*>\s?(.*)$/))) { flushPara(); flushList(); quote.push(m[1]); return; }
      if ((m = line.match(/^\s*(?:([-*+])|(\d+)[.)])\s+(.*)$/))) {
        var tag = m[1] ? 'ul' : 'ol';
        flushPara(); flushQuote();
        if (list && list.tag !== tag) flushList();
        if (!list) list = { tag: tag, items: [] };
        list.items.push(m[3]); return;
      }
      flushList(); flushQuote(); para.push(line);
    });
    flush();
    return out.join('');
  }

  // Card view: title truncates to one line (CSS), body is clamped to a fixed
  // height (CSS) and expands inline via the "View more" button.
  function newsCardHTML(n) {
    return '<div class="news-item"><div class="news-content"><h4>' + esc(n.title || '') + '</h4>' +
      '<div class="news-text md">' + markdown(n.body) + '</div>' +
      '<button type="button" class="view-more" hidden></button>' +
      dateLineHTML(n) + '</div></div>';
  }

  // Full view (modal): whole body.
  function newsFullHTML(n) {
    return '<div class="news-item"><div class="news-content"><h4>' + esc(n.title || '') + '</h4>' +
      '<div class="md">' + markdown(n.body) + '</div>' +
      dateLineHTML(n) + '</div></div>';
  }

  // Reveal an inline "View more" only on cards whose body is actually clamped,
  // and toggle expand/collapse.
  function wireExpanders(container) {
    container.querySelectorAll('.news-item').forEach(function (item) {
      var text = item.querySelector('.news-text');
      var btn = item.querySelector('.view-more');
      if (!text || !btn) return;
      if (text.scrollHeight - text.clientHeight > 2) {
        btn.hidden = false;
        btn.textContent = 'View more';
        btn.addEventListener('click', function () {
          var expanded = item.classList.toggle('expanded');
          btn.textContent = expanded ? 'View less' : 'View more';
        });
      }
    });
  }

  function renderNews(season) {
    var body = document.getElementById('newsBody');
    if (!body) return;
    var items = CAHL.sortNews(season.news || []);
    if (!items.length) { body.innerHTML = '<p class="hint">No news yet.</p>'; return; }
    body.innerHTML = items.slice(0, TOP_NEWS).map(newsCardHTML).join('');
    wireExpanders(body);

    var modal = document.getElementById('newsModal');
    var more = document.getElementById('newsMore');
    if (!modal) return;
    var titleEl = document.getElementById('newsModalTitle');
    var modalBody = document.getElementById('newsModalBody');
    var closeBtn = document.getElementById('newsModalClose');
    var lastFocus = null;

    function open() {
      modalBody.innerHTML = items.map(newsFullHTML).join('');
      titleEl.textContent = 'League News';
      lastFocus = document.activeElement;
      modal.hidden = false;
      document.body.style.overflow = 'hidden';
      closeBtn.focus();
    }
    function close() {
      modal.hidden = true;
      document.body.style.overflow = '';
      if (lastFocus && lastFocus.focus) lastFocus.focus();
    }

    closeBtn.addEventListener('click', close);
    modal.querySelectorAll('[data-close]').forEach(function (el) { el.addEventListener('click', close); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !modal.hidden) close(); });

    // The "NEWS" nav link opens the full list in the modal.
    var navNews = document.querySelector('.nav a[href="#news"]');
    if (navNews) navNews.addEventListener('click', function (e) { e.preventDefault(); open(); });

    // "View all" opens the full list. The badge count reflects only current/
    // upcoming dated posts (today or later); pinned/evergreen posts and past
    // posts are not counted.
    if (items.length > TOP_NEWS && more) {
      var today = todayISO();
      var upcoming = items.filter(function (n) {
        return !n.pinned && n.iso && n.iso >= today;
      }).length;
      more.hidden = false;
      more.textContent = upcoming ? 'View all news (' + upcoming + ') →' : 'View all news →';
      more.addEventListener('click', open);
    }
  }

  function todayISO() {
    var d = new Date(), m = d.getMonth() + 1, day = d.getDate();
    return d.getFullYear() + '-' + (m < 10 ? '0' + m : m) + '-' + (day < 10 ? '0' + day : day);
  }

  function renderLeaders(rows) {
    var g = CAHL.leader(rows, 'g'), a = CAHL.leader(rows, 'a'), p = CAHL.leader(rows, 'pts');
    document.getElementById('goalName').textContent = g.name;
    document.getElementById('goalVal').textContent = g.value;
    document.getElementById('assistName').textContent = a.name;
    document.getElementById('assistVal').textContent = a.value;
    document.getElementById('pointName').textContent = p.name;
    document.getElementById('pointVal').textContent = p.value;
  }

  CAHL.loadSeason().then(function (season) {
    if (season.season) {
      document.getElementById('seasonLabel').textContent =
        (season.shortName || 'CAHL') + ' • ' + season.season + ' SEASON';
    }
    var schedule = season.schedule || [];
    var game = nextGame(schedule);
    renderNextGame(game, season);
    renderSchedule(schedule, game);
    renderNews(season);
    var rows = CAHL.aggregate(season);
    renderStats(rows);
    renderLeaders(rows);
  }).catch(function (err) {
    document.getElementById('nextGame').querySelector('.game-details').innerHTML =
      '<strong>Could not load league data.</strong>';
    console.error(err);
  });
})();
