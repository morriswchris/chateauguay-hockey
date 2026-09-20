/* Shared data helpers for the CAHL site (public + admin).
   No backend: the season data lives in data/season.json in the repo. */
(function (global) {
  'use strict';

  var DATA_PATH = 'data/season.json';

  // Fetch the season file. Cache-busted so freshly-committed updates show up
  // as soon as GitHub Pages serves them.
  function loadSeason() {
    return fetch(DATA_PATH + '?t=' + Date.now(), { cache: 'no-store' })
      .then(function (r) {
        if (!r.ok) throw new Error('Could not load ' + DATA_PATH + ' (' + r.status + ')');
        return r.json();
      });
  }

  // Roll every week's stat lines up into per-player totals.
  // GP = number of weeks a player has a stat line (i.e. played).
  function aggregate(season) {
    var totals = {};
    (season.players || []).forEach(function (p) {
      totals[p.name] = { name: p.name, number: p.number || null, gp: 0, g: 0, a: 0 };
    });
    (season.weeks || []).forEach(function (w) {
      (w.stats || []).forEach(function (s) {
        if (!totals[s.player]) {
          totals[s.player] = { name: s.player, number: null, gp: 0, g: 0, a: 0 };
        }
        var t = totals[s.player];
        t.gp += 1;
        t.g += Number(s.g) || 0;
        t.a += Number(s.a) || 0;
      });
    });
    return Object.keys(totals).map(function (k) {
      var t = totals[k];
      t.pts = t.g + t.a;
      return t;
    }).sort(function (a, b) {
      return b.pts - a.pts || b.g - a.g || a.name.localeCompare(b.name);
    });
  }

  // Top scorer for a given stat key ('g', 'a', or 'pts').
  function leader(rows, key) {
    var best = { name: '—', value: 0 };
    rows.forEach(function (r) {
      if (r[key] > best.value) best = { name: r.name, value: r[key] };
    });
    return best;
  }

  global.CAHL = {
    DATA_PATH: DATA_PATH,
    loadSeason: loadSeason,
    aggregate: aggregate,
    leader: leader
  };
})(window);
