/* Shared data helpers for the CAHL site.
   No backend: data/season.json is generated from a Google Sheet by
   .github/workflows/deploy.yml. Games are keyed by date; the roster
   and all totals are computed from whatever players appear in the sheet. */
(function (global) {
  'use strict';

  var DATA_PATH = 'data/season.json';

  // Fetch the season file, cache-busted so fresh syncs show up immediately.
  function loadSeason() {
    return fetch(DATA_PATH + '?t=' + Date.now(), { cache: 'no-store' })
      .then(function (r) {
        if (!r.ok) throw new Error('Could not load ' + DATA_PATH + ' (' + r.status + ')');
        return r.json();
      });
  }

  // Roll every game's stat lines up into per-player totals.
  // Roster is derived from the players who appear in the games (Player is a
  // free-text string in the sheet). GP = number of games a player appears in.
  function aggregate(season) {
    var totals = {};
    (season.games || []).forEach(function (g) {
      (g.stats || []).forEach(function (s) {
        var name = (s.player || '').trim();
        if (!name) return;
        if (!totals[name]) totals[name] = { name: name, gp: 0, g: 0, a: 0 };
        var t = totals[name];
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

  // Order news for display: pinned items (no date) first in sheet order,
  // then dated items newest-first.
  function sortNews(news) {
    var items = (news || []).slice();
    var pinned = items.filter(function (n) { return n.pinned || !n.iso; });
    var dated = items.filter(function (n) { return !(n.pinned || !n.iso); });
    dated.sort(function (a, b) { return a.iso < b.iso ? 1 : a.iso > b.iso ? -1 : 0; });
    return pinned.concat(dated);
  }

  global.CAHL = {
    DATA_PATH: DATA_PATH,
    loadSeason: loadSeason,
    aggregate: aggregate,
    leader: leader,
    sortNews: sortNews
  };
})(window);
