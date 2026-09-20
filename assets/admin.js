/* Weekly stats entry editor. Fully client-side:
   edits produce an updated data/season.json which is either downloaded
   or committed to GitHub via the Contents API (which auto-deploys Pages). */
(function () {
  'use strict';

  var LS_KEY = 'cahl.gh';
  var state = { season: null };

  var $ = function (id) { return document.getElementById(id); };

  function setStatus(msg, kind) {
    var el = $('status');
    el.textContent = msg;
    el.className = 'status show ' + (kind || 'info');
    if (kind === 'ok') setTimeout(function () { el.className = 'status'; }, 6000);
  }

  function isGame(row) {
    return row.time && row.time !== 'NO GAME' && row.week !== '—';
  }

  function b64utf8(str) {
    return btoa(unescape(encodeURIComponent(str)));
  }

  function updatePreview() {
    $('jsonOut').value = JSON.stringify(state.season, null, 2);
  }

  // Read the (possibly hand-edited) preview back into state before publishing.
  function syncFromPreview() {
    try {
      state.season = JSON.parse($('jsonOut').value);
      return true;
    } catch (e) {
      setStatus('The JSON preview is not valid: ' + e.message, 'err');
      return false;
    }
  }

  function weekNumber(row) {
    var n = parseInt(row.week, 10);
    return isNaN(n) ? row.week : n;
  }

  function findWeek(num) {
    return (state.season.weeks || []).filter(function (w) { return w.week === num; })[0];
  }

  // ---- Entry table ----------------------------------------------------------
  function renderEntry() {
    var sel = $('weekSelect');
    var row = state.season.schedule[sel.value];
    $('weekDate').value = row ? row.date : '';
    var num = weekNumber(row);
    var existing = findWeek(num);
    var byPlayer = {};
    if (existing) (existing.stats || []).forEach(function (s) { byPlayer[s.player] = s; });

    $('entryBody').innerHTML = state.season.players.map(function (p, i) {
      var s = byPlayer[p.name];
      var played = !!s;
      return '<tr data-name="' + encodeURIComponent(p.name) + '"' + (played ? ' class="played"' : '') + '>' +
        '<td class="num"><input type="checkbox" class="e-play"' + (played ? ' checked' : '') + '></td>' +
        '<td><b>' + p.name + '</b></td>' +
        '<td class="num"><input type="number" class="e-g" min="0" step="1" value="' + (s ? (s.g || 0) : 0) + '"></td>' +
        '<td class="num"><input type="number" class="e-a" min="0" step="1" value="' + (s ? (s.a || 0) : 0) + '"></td>' +
        '</tr>';
    }).join('');

    // Ticking "played" highlights the row.
    $('entryBody').querySelectorAll('.e-play').forEach(function (cb) {
      cb.addEventListener('change', function () {
        cb.closest('tr').classList.toggle('played', cb.checked);
      });
    });
  }

  function applyWeek() {
    var sel = $('weekSelect');
    var row = state.season.schedule[sel.value];
    var num = weekNumber(row);
    var stats = [];
    $('entryBody').querySelectorAll('tr').forEach(function (tr) {
      if (!tr.querySelector('.e-play').checked) return;
      stats.push({
        player: decodeURIComponent(tr.getAttribute('data-name')),
        g: parseInt(tr.querySelector('.e-g').value, 10) || 0,
        a: parseInt(tr.querySelector('.e-a').value, 10) || 0
      });
    });

    if (!state.season.weeks) state.season.weeks = [];
    var entry = { week: num, date: row.date, iso: row.iso || '', stats: stats };
    var idx = state.season.weeks.findIndex(function (w) { return w.week === num; });
    if (idx >= 0) state.season.weeks[idx] = entry; else state.season.weeks.push(entry);
    state.season.weeks.sort(function (a, b) { return (a.week || 0) - (b.week || 0); });

    updatePreview();
    setStatus('Week ' + num + ' applied — ' + stats.length + ' player(s). Now publish or download.', 'ok');
  }

  // ---- Download / copy ------------------------------------------------------
  function download() {
    if (!syncFromPreview()) return;
    var blob = new Blob([JSON.stringify(state.season, null, 2)], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'season.json';
    a.click();
    URL.revokeObjectURL(a.href);
    setStatus('Downloaded season.json — commit it to data/season.json in the repo.', 'ok');
  }

  function copyJson() {
    if (!syncFromPreview()) return;
    var text = JSON.stringify(state.season, null, 2);
    navigator.clipboard.writeText(text).then(function () {
      setStatus('JSON copied to clipboard.', 'ok');
    }, function () {
      $('jsonOut').select();
      setStatus('Select-all done — press Ctrl/Cmd+C to copy.', 'info');
    });
  }

  // ---- GitHub publish -------------------------------------------------------
  function detectRepo() {
    var host = location.hostname, path = location.pathname;
    var owner = 'morriswchris', repo = 'chateauguay-hockey';
    var m = host.match(/^([^.]+)\.github\.io$/);
    if (m) {
      owner = m[1];
      var seg = path.split('/').filter(Boolean);
      repo = seg.length && !/\.html?$/.test(seg[0]) ? seg[0] : owner + '.github.io';
    }
    return { owner: owner, repo: repo };
  }

  function loadSettings() {
    var d = detectRepo();
    var saved = {};
    try { saved = JSON.parse(localStorage.getItem(LS_KEY) || '{}'); } catch (e) {}
    $('ghOwner').value = saved.owner || d.owner;
    $('ghRepo').value = saved.repo || d.repo;
    $('ghBranch').value = saved.branch || 'master';
    if (saved.token) { $('ghToken').value = saved.token; $('ghRemember').checked = true; }
  }

  function saveSettings() {
    if (!$('ghRemember').checked) { localStorage.removeItem(LS_KEY); return; }
    try {
      localStorage.setItem(LS_KEY, JSON.stringify({
        owner: $('ghOwner').value.trim(), repo: $('ghRepo').value.trim(),
        branch: $('ghBranch').value.trim(), token: $('ghToken').value.trim()
      }));
    } catch (e) {}
  }

  function publish() {
    if (!syncFromPreview()) return;
    var owner = $('ghOwner').value.trim(), repo = $('ghRepo').value.trim();
    var branch = $('ghBranch').value.trim() || 'master', token = $('ghToken').value.trim();
    if (!owner || !repo || !token) { setStatus('Owner, repo and token are all required to publish.', 'err'); return; }
    saveSettings();

    var url = 'https://api.github.com/repos/' + owner + '/' + repo + '/contents/data/season.json';
    var headers = { 'Authorization': 'Bearer ' + token, 'Accept': 'application/vnd.github+json' };
    var body = JSON.stringify(state.season, null, 2) + '\n';
    $('publishBtn').disabled = true;
    setStatus('Publishing to GitHub…', 'info');

    // Get current SHA (needed to update an existing file), then PUT.
    fetch(url + '?ref=' + encodeURIComponent(branch), { headers: headers })
      .then(function (r) { return r.status === 404 ? { sha: undefined } : r.json(); })
      .then(function (info) {
        return fetch(url, {
          method: 'PUT', headers: headers,
          body: JSON.stringify({
            message: 'Update weekly stats (season.json)',
            content: b64utf8(body),
            sha: info && info.sha,
            branch: branch
          })
        });
      })
      .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, status: r.status, j: j }; }); })
      .then(function (res) {
        if (!res.ok) throw new Error((res.j && res.j.message) || ('HTTP ' + res.status));
        setStatus('Published! The site will rebuild in a minute or two.', 'ok');
      })
      .catch(function (err) { setStatus('Publish failed: ' + err.message, 'err'); })
      .finally(function () { $('publishBtn').disabled = false; });
  }

  // ---- Init -----------------------------------------------------------------
  CAHL.loadSeason().then(function (season) {
    state.season = season;
    var sel = $('weekSelect');
    sel.innerHTML = season.schedule.map(function (r, i) {
      return isGame(r) ? '<option value="' + i + '">Week ' + r.week + ' — ' + r.date + '</option>' : '';
    }).join('');
    renderEntry();
    updatePreview();
    loadSettings();

    sel.addEventListener('change', renderEntry);
    $('applyBtn').addEventListener('click', applyWeek);
    $('downloadBtn').addEventListener('click', download);
    $('copyBtn').addEventListener('click', copyJson);
    $('publishBtn').addEventListener('click', publish);
  }).catch(function (err) {
    setStatus('Could not load season data: ' + err.message, 'err');
  });
})();
