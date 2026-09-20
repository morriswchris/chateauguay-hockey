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
    var rows = CAHL.aggregate(season);
    renderStats(rows);
    renderLeaders(rows);
  }).catch(function (err) {
    document.getElementById('nextGame').querySelector('.game-details').innerHTML =
      '<strong>Could not load league data.</strong>';
    console.error(err);
  });
})();
