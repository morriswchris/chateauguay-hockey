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
  var PREVIEW_CHARS = 150;

  function dateLineHTML(n) {
    return n.date ? '<span class="news-date">' + esc(n.date) + '</span>' : '';
  }

  // Card view: body truncated to a preview; long posts get a "Read more".
  function newsCardHTML(n, idx) {
    var body = n.body || '';
    var long = body.length > PREVIEW_CHARS;
    var preview = long ? body.slice(0, PREVIEW_CHARS).replace(/\s+\S*$/, '') + '…' : body;
    var more = long ? '<button type="button" class="read-more" data-news-idx="' + idx + '">Read more →</button>' : '';
    return '<div class="news-item"><div class="news-thumb">' + esc(n.tag || 'CAHL') + '</div>' +
      '<div><h4>' + esc(n.title || '') + '</h4><p>' + esc(preview) + '</p>' +
      more + dateLineHTML(n) + '</div></div>';
  }

  // Full view (modal): whole body, line breaks preserved.
  function newsFullHTML(n) {
    var body = esc(n.body || '').replace(/\n/g, '<br>');
    return '<div class="news-item"><div class="news-thumb">' + esc(n.tag || 'CAHL') + '</div>' +
      '<div><h4>' + esc(n.title || '') + '</h4><p>' + body + '</p>' + dateLineHTML(n) + '</div></div>';
  }

  function renderNews(season) {
    var body = document.getElementById('newsBody');
    if (!body) return;
    var items = CAHL.sortNews(season.news || []);
    if (!items.length) { body.innerHTML = '<p class="hint">No news yet.</p>'; return; }
    body.innerHTML = items.slice(0, TOP_NEWS).map(function (n) {
      return newsCardHTML(n, items.indexOf(n));
    }).join('');

    var modal = document.getElementById('newsModal');
    var more = document.getElementById('newsMore');
    if (!modal) return;
    var titleEl = document.getElementById('newsModalTitle');
    var modalBody = document.getElementById('newsModalBody');
    var closeBtn = document.getElementById('newsModalClose');
    var lastFocus = null;

    function open(list, title) {
      modalBody.innerHTML = list.map(newsFullHTML).join('');
      titleEl.textContent = title || 'League News';
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

    // "Read more" on a single long post opens just that post.
    body.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-news-idx]');
      if (!btn) return;
      var n = items[+btn.getAttribute('data-news-idx')];
      if (n) open([n], n.title || 'League News');
    });

    // "View all" opens the full list.
    if (items.length > TOP_NEWS && more) {
      more.hidden = false;
      more.textContent = 'View all news (' + items.length + ') →';
      more.addEventListener('click', function () { open(items, 'League News'); });
    }
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
