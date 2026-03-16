// ===== STATE =====
let CITIES = [];
let MAP;
let currentFilter = 'all';
let activeLegendParty = null;
let openDetailCityId = null;
let refreshCountdown = REFRESH_INTERVAL / 1000;
let citiesLoaded = false;
let lastUpdateTimestamp = null;

// ===== UTILS =====
function computeTags(r) {
  const tags = [];
  if (r.status === '2t') tags.push('2t');
  if (r.status === 'elu') tags.push('elu');
  if (r.bord) tags.push(r.bord);
  if (r.candidats && r.candidats.length > 0) {
    const lead = r.candidats[0];
    if (lead.score !== null) {
      if (BORD_FAMILIES.gauche.includes(lead.bord)) tags.push('gauche');
      if (BORD_FAMILIES.droite.includes(lead.bord)) tags.push('droite');
      if (BORD_FAMILIES.rn.includes(lead.bord)) tags.push('rn');
    }
  }
  return [...new Set(tags)];
}

function hasResults(city) {
  return city.candidats && city.candidats.length > 0 && city.candidats.some(c => c.score !== null);
}

function buildCity(apiCity, results) {
  const code = apiCity.code;
  const deptName = apiCity.departement ? apiCity.departement.nom : (apiCity.dept || '');
  const pop = apiCity.population || 0;
  const popStr = pop >= 1e6 ? (pop / 1e6).toFixed(1).replace('.0', '') + ' M hab.'
    : pop >= 1000 ? Math.round(pop / 1000) + ' k hab.' : pop + ' hab.';
  const lat = apiCity.centre ? apiCity.centre.coordinates[1] : (apiCity.lat || 46.6);
  const lng = apiCity.centre ? apiCity.centre.coordinates[0] : (apiCity.lng || 2.5);
  const deptCode = getDeptCode(code);
  const miUrl = 'https://www.resultats-elections.interieur.gouv.fr/municipales2026/' + deptCode.padStart(3, '0') + '/' + code + '/';
  const base = {
    id: code, name: apiCity.nom, pop: popStr, dept: deptName,
    lat, lng, code, population: pop,
    sources: [{ label: "Ministère de l'Intérieur", url: miUrl }]
  };
  if (results) return { ...base, ...results, tags: computeTags(results) };
  return { ...base, status: 'inconnu', bord: 'indecis', participation: 0, candidats: [], tags: [], note: null };
}

function getLeadScore(city, family) {
  if (!city.candidats) return 0;
  return city.candidats
    .filter(c => c.score !== null && BORD_FAMILIES[family] && BORD_FAMILIES[family].includes(c.bord))
    .reduce((s, c) => s + (c.score || 0), 0);
}

function cityMatchesLegendParty(city, partyKey) {
  if (!city.candidats || !city.candidats.length) return false;
  const aliases = LEGEND_PARTY_MAP[partyKey] || [];
  const lead = city.candidats.find(c => c.score !== null);
  if (!lead) return false;
  const bordMatch = {
    RN: ['Extrême droite'], UDR: ['Droite souverainiste'],
    PS: ['Gauche'], LFI: ['Extrême gauche'], PCF: ['Gauche'],
    EELV: ['Centre-gauche', 'Gauche'], LR: ['Droite', 'Droite-Centre'],
    RE: ['Centre', 'Centre-droit'], REC: ['Extrême droite'],
    DIV: ['Divers', 'Divers droite', 'Divers gauche']
  };
  const partiMatch = aliases.some(a => lead.parti === a || lead.parti.includes(a) || a.includes(lead.parti));
  const bords = bordMatch[partyKey] || [];
  const bMatch = bords.includes(lead.bord);
  return partiMatch || bMatch;
}

// ===== LIVE DATA FETCH =====
async function fetchLiveResults() {
  try {
    const cacheBuster = '?t=' + Date.now();
    const resp = await fetch('data/results-live.json' + cacheBuster, {
      signal: AbortSignal.timeout(8000),
      cache: 'no-store'
    });
    if (!resp.ok) return null;
    return await resp.json();
  } catch (e) {
    console.log('Fetch live results failed:', e);
    return null;
  }
}

async function applyLiveResults() {
  const data = await fetchLiveResults();
  if (!data || !data.results) return false;
  if (lastUpdateTimestamp && data.lastUpdate === lastUpdateTimestamp) return false;
  lastUpdateTimestamp = data.lastUpdate;

  let changed = false;
  Object.entries(data.results).forEach(([code, results]) => {
    const existing = RESULTS_DB[code];
    if (!existing || JSON.stringify(existing) !== JSON.stringify(results)) {
      RESULTS_DB[code] = results;
      changed = true;
    }
  });

  if (changed) {
    rebuildCitiesFromDB();
    displayFiltered(currentFilter);
    if (typeof refreshChoroplethColors === 'function') refreshChoroplethColors();

    const ts = new Date(data.lastUpdate);
    const formatted = ts.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
      + ', ' + ts.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    const el = document.getElementById('lastUpdate');
    if (el) el.textContent = formatted;
  }
  return changed;
}

// Rebuild CITIES array from RESULTS_DB + GEO_FALLBACK
function rebuildCitiesFromDB() {
  const existingCodes = new Set(CITIES.map(c => c.id));

  // Update existing cities
  CITIES.forEach((city, idx) => {
    if (RESULTS_DB[city.id]) {
      CITIES[idx] = buildCity({
        code: city.id, nom: city.name, population: city.population,
        lat: city.lat, lng: city.lng, dept: city.dept
      }, RESULTS_DB[city.id]);
    }
  });

  // Add new cities from RESULTS_DB that have geo fallback
  Object.entries(RESULTS_DB).forEach(([code, results]) => {
    if (existingCodes.has(code)) return;
    const geo = GEO_FALLBACK[code];
    if (geo) {
      CITIES.push(buildCity({
        code, nom: geo.nom, population: geo.pop,
        centre: { coordinates: [geo.lng, geo.lat] },
        departement: { nom: geo.dept }
      }, results));
    }
  });
}

// ===== LOAD CITIES (once at startup) =====
async function loadCities() {
  const grid = document.getElementById('citiesGrid');
  grid.innerHTML = '<div style="text-align:center;padding:2rem;color:var(--text2)">Chargement...</div>';

  await applyLiveResults();

  // Build from RESULTS_DB + GEO_FALLBACK (top cities)
  CITIES = Object.entries(GEO_FALLBACK).map(([code, geo]) => {
    return buildCity({
      code, nom: geo.nom, population: geo.pop,
      centre: { coordinates: [geo.lng, geo.lat] },
      departement: { nom: geo.dept }
    }, RESULTS_DB[code] || null);
  }).filter(Boolean);

  citiesLoaded = true;
  displayFiltered('all');
}

// ===== DISPLAY =====
function displayFiltered(filter) {
  if (!citiesLoaded) return;

  let filtered = applyFilter(CITIES, filter);

  if (activeLegendParty) {
    filtered = filtered.filter(c => cityMatchesLegendParty(c, activeLegendParty));
  }

  filtered = filtered.slice(0, 30);
  renderTiles(filtered);
}

function applyFilter(cities, filter) {
  let list = [...cities];
  switch (filter) {
    case '2t':
      list = list.filter(c => c.status === '2t');
      list.sort((a, b) => (b.population || 0) - (a.population || 0));
      break;
    case 'elu':
      list = list.filter(c => c.status === 'elu');
      list.sort((a, b) => (b.population || 0) - (a.population || 0));
      break;
    case 'gauche':
      list = list.filter(c => hasResults(c) && getLeadScore(c, 'gauche') > 0);
      list.sort((a, b) => getLeadScore(b, 'gauche') - getLeadScore(a, 'gauche'));
      break;
    case 'droite':
      list = list.filter(c => hasResults(c) && getLeadScore(c, 'droite') > 0);
      list.sort((a, b) => getLeadScore(b, 'droite') - getLeadScore(a, 'droite'));
      break;
    case 'rn':
      list = list.filter(c => hasResults(c) && getLeadScore(c, 'rn') > 0);
      list.sort((a, b) => getLeadScore(b, 'rn') - getLeadScore(a, 'rn'));
      break;
    default:
      list = list.filter(c => hasResults(c));
      list.sort((a, b) => (b.population || 0) - (a.population || 0));
      break;
  }
  return list;
}

// ===== MAP =====
function initMap() {
  MAP = L.map('map', { center: [46.6, 2.5], zoom: 6, scrollWheelZoom: true, zoomControl: false });
  L.control.zoom({ position: 'bottomright' }).addTo(MAP);
  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; OSM &copy; CARTO', maxZoom: 19
  }).addTo(MAP);
}

function zoomToCity(cityId) {
  const city = CITIES.find(c => c.id === cityId);
  if (!city || !MAP) return;
  MAP.setView([city.lat, city.lng], Math.max(MAP.getZoom(), 11), { animate: true });
}

// ===== TILES =====
function renderTiles(cities) {
  const grid = document.getElementById('citiesGrid');
  grid.innerHTML = '';
  if (!cities.length) {
    grid.innerHTML = '<div style="text-align:center;padding:2rem;color:var(--text2)">Aucune ville pour ce filtre</div>';
    return;
  }
  cities.forEach(city => {
    const bordColor = city.bord === 'gauche' ? 'var(--ps)' : city.bord === 'droite' ? 'var(--lr)' : city.bord === 'rn' ? 'var(--rn)' : city.bord === 'eco' ? 'var(--eco)' : city.bord === 'centre' ? 'var(--re)' : 'var(--div)';
    const top = (city.candidats || []).filter(c => c.score !== null).slice(0, 3);
    let chips = top.map(c =>
      '<span class="cand-chip"><span class="cdot" style="background:' + c.color + '"></span>' + c.parti + ' <span class="cscore" style="color:' + c.color + '">' + c.score + '%</span></span>'
    ).join(' / ');
    if (!chips) chips = '<span style="color:var(--text2)">En attente</span>';
    let bar = '';
    const totalScore = top.reduce((s, c) => s + (c.score || 0), 0);
    if (totalScore > 0) top.forEach(c => { bar += '<div class="seg" style="width:' + ((c.score || 0) / 100 * 100) + '%;background:' + c.color + '"></div>'; });

    const tile = document.createElement('div');
    tile.className = 'city-tile' + (openDetailCityId === city.id ? ' active' : '');
    tile.id = 'tile-' + city.id;
    tile.onclick = () => toggleTileDetail(city.id);
    tile.innerHTML =
      '<div class="bord-line" style="background:' + bordColor + '"></div>' +
      '<div class="city-tile-header"><span class="name">' + city.name + '</span>' +
      '<span class="status-badge ' + (city.status === 'elu' ? 'status-elu' : city.status === '2t' ? 'status-2t' : '') + '">' + (city.status === 'elu' ? 'Élu 1er tour' : city.status === '2t' ? '2e tour' : '—') + '</span></div>' +
      '<div class="city-tile-preview">' + chips + '</div>' +
      '<div class="city-tile-stacked-bar">' + bar + '</div>';
    grid.appendChild(tile);

    if (openDetailCityId === city.id) {
      const detailRow = document.createElement('div');
      detailRow.className = 'tile-detail-row';
      detailRow.id = 'tileDetail';
      detailRow.innerHTML = buildDetailHTML(city, true);
      grid.appendChild(detailRow);
    }
  });
}

// ===== INLINE DETAIL =====
function toggleTileDetail(cityId) {
  closeDetailPanel();

  if (openDetailCityId === cityId) {
    openDetailCityId = null;
    const existing = document.getElementById('tileDetail');
    if (existing) existing.remove();
    const activeTile = document.querySelector('.city-tile.active');
    if (activeTile) activeTile.classList.remove('active');
    return;
  }

  openDetailCityId = cityId;
  const oldDetail = document.getElementById('tileDetail');
  if (oldDetail) oldDetail.remove();
  document.querySelectorAll('.city-tile.active').forEach(t => t.classList.remove('active'));

  const tile = document.getElementById('tile-' + cityId);
  const city = CITIES.find(c => c.id === cityId);
  if (!tile || !city) return;

  tile.classList.add('active');

  const detailRow = document.createElement('div');
  detailRow.className = 'tile-detail-row';
  detailRow.id = 'tileDetail';
  detailRow.innerHTML = buildDetailHTML(city, true);
  tile.after(detailRow);

  zoomToCity(cityId);
  detailRow.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// ===== DETAIL PANEL =====
function showDetailPanel(cityId) {
  if (openDetailCityId) {
    const oldDetail = document.getElementById('tileDetail');
    if (oldDetail) oldDetail.remove();
    document.querySelectorAll('.city-tile.active').forEach(t => t.classList.remove('active'));
    openDetailCityId = null;
  }

  let city = CITIES.find(c => c.id === cityId);
  if (!city) return;

  const panel = document.getElementById('detailPanel');
  const body = document.getElementById('detailBody');
  body.innerHTML = buildDetailHTML(city, false);
  panel.classList.add('active');
  panel.scrollIntoView({ behavior: 'smooth', block: 'start' });

  if (MAP) MAP.closePopup();
}

function closeDetailPanel() {
  const panel = document.getElementById('detailPanel');
  if (panel) panel.classList.remove('active');
}

async function showRemoteCityDetail(apiCity) {
  // Load department results to get election data for this commune
  const deptCode = getDeptCode(apiCity.code);
  await loadDeptResults(deptCode);

  const results = RESULTS_DB[apiCity.code] || null;
  const city = buildCity(apiCity, results);
  if (!CITIES.find(c => c.id === city.id)) CITIES.push(city);
  showDetailPanel(city.id);

  if (apiCity.centre && MAP) {
    MAP.setView([apiCity.centre.coordinates[1], apiCity.centre.coordinates[0]], Math.max(MAP.getZoom(), 11), { animate: true });
  }
}

// ===== BUILD DETAIL HTML =====
function buildDetailHTML(city, isTile) {
  const maxScore = Math.max(...(city.candidats || []).map(c => c.score || 0), 1);
  const deptCode = getDeptCode(city.code || '');
  const miUrl = 'https://www.resultats-elections.interieur.gouv.fr/municipales2026/' + deptCode.padStart(3, '0') + '/' + (city.code || '') + '/';

  const closeBtn = isTile
    ? '<button class="tile-detail-close" onclick="event.stopPropagation();toggleTileDetail(\'' + city.id + '\')">&times;</button>'
    : '';

  let html = closeBtn;
  html += '<div class="detail-city-name">' + city.name + '</div>';
  html += '<div class="detail-city-meta">' + city.pop + ' — ' + city.dept + '</div>';
  if (city.maireSortant) html += '<div class="detail-city-mayor">Maire sortant : ' + city.maireSortant + '</div>';

  if (city.participation) {
    html += '<div class="detail-section-title">Participation</div>';
    html += '<div class="part-bar"><div class="part-bar-track"><div class="part-bar-fill" style="width:' + city.participation + '%"></div></div><span class="part-bar-pct">' + city.participation + ' %</span></div>';
  }

  const scored = (city.candidats || []).filter(c => c.score !== null);
  if (scored.length > 0) {
    html += '<div class="detail-section-title">Résultats 1er tour</div>';
    html += '<div class="chart-area">';
    scored.forEach(c => {
      const h = Math.max(4, (c.score / maxScore) * 100);
      html += '<div class="chart-bar-group"><div class="chart-bar-value" style="color:' + c.color + '">' + c.score + '%</div><div class="chart-bar" style="height:' + h + 'px;background:' + c.color + '"></div><div class="chart-bar-label">' + c.nom + '</div></div>';
    });
    html += '</div>';
    html += '<div class="detail-section-title">Détail des candidats</div>';
    (city.candidats || []).forEach(cand => {
      const pct = cand.score !== null ? ((cand.score / maxScore) * 100) : 0;
      const st = cand.score !== null ? cand.score + ' %' : '—';
      html += '<div class="cand-row"><div class="cand-info"><div class="cand-name">' + cand.nom + '</div><div class="cand-parti" style="color:' + cand.color + '">' + cand.parti + ' (' + cand.bord + ')</div><div class="cand-bar-track"><div class="cand-bar-fill" style="width:' + pct + '%;background:' + cand.color + '"></div></div></div><div class="cand-score" style="color:' + cand.color + '">' + st + '</div></div>';
    });
  } else {
    html += '<div class="detail-section-title">Résultats 1er tour</div>';
    html += '<div class="placeholder-2t">Résultats non encore intégrés.<br><br><a href="' + miUrl + '" target="_blank" style="color:var(--accent);font-weight:600">Consulter sur le Ministère de l\'Intérieur</a></div>';
  }

  if (city.status === '2t') {
    html += '<div class="detail-section-title">Sondages &amp; projections 2e tour</div>';
    html += '<div class="placeholder-2t">Les sondages pour le second tour (22 mars) seront affichés ici dès leur publication.</div>';
  }
  if (city.note) html += '<div class="detail-note">' + city.note + '</div>';
  html += '<div class="detail-sources"><strong style="font-size:0.72rem;color:var(--text2)">Sources :</strong> ';
  (city.sources || []).forEach(s => { html += '<a href="' + s.url + '" target="_blank">' + s.label + '</a> '; });
  html += '<a href="https://www.data.gouv.fr/reuses/resultats-des-elections-municipales-2026" target="_blank">data.gouv.fr</a>';
  html += '</div>';
  return html;
}

// ===== LEGEND =====
function setupLegend() {
  document.querySelectorAll('.legend-chip').forEach(chip => {
    chip.addEventListener('click', function () {
      const party = this.dataset.party;
      if (activeLegendParty === party) {
        activeLegendParty = null;
        this.classList.remove('active');
      } else {
        document.querySelectorAll('.legend-chip.active').forEach(c => c.classList.remove('active'));
        activeLegendParty = party;
        this.classList.add('active');
      }
      displayFiltered(currentFilter);
    });
  });
}

// ===== FILTERS =====
function setupFilters() {
  document.getElementById('filterTabs').addEventListener('click', function (e) {
    const tab = e.target.closest('.filter-tab');
    if (!tab) return;
    document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    currentFilter = tab.dataset.filter;
    displayFiltered(currentFilter);
  });
}

// ===== SEARCH =====
let searchDebounce = null;
function setupSearch() {
  const input = document.getElementById('citySearch');
  const results = document.getElementById('searchResults');
  input.addEventListener('input', function () {
    const q = this.value.trim();
    if (q.length < 2) { results.classList.remove('active'); return; }

    // Immediate: search in local CITIES + DEPT_CACHE
    const localMatches = CITIES.filter(c => c.name.toLowerCase().includes(q.toLowerCase()) || c.dept.toLowerCase().includes(q.toLowerCase()));
    const cachedMatches = searchInDeptCache(q).filter(c => !localMatches.find(lm => lm.id === c.code));
    renderSearchResults(results, input, localMatches, [], cachedMatches);

    // Debounced: search via geo API for all 36k communes
    clearTimeout(searchDebounce);
    searchDebounce = setTimeout(() => {
      fetch('https://geo.api.gouv.fr/communes?nom=' + encodeURIComponent(q) + '&fields=nom,code,codesPostaux,departement,population,centre&boost=population&limit=20', { signal: AbortSignal.timeout(4000) })
        .then(r => r.json())
        .then(apiCities => {
          const knownCodes = new Set([...CITIES.map(c => c.id), ...cachedMatches.map(c => c.code)]);
          const remote = apiCities.filter(ac => !knownCodes.has(ac.code));
          renderSearchResults(results, input, localMatches, remote, cachedMatches);
        }).catch(() => { });
    }, 250);
  });
  document.addEventListener('click', e => { if (!e.target.closest('.search-container')) results.classList.remove('active'); });
}

function renderSearchResults(container, input, localMatches, remoteCities, cachedMatches) {
  container.innerHTML = '';

  // Local matches (from top cities / already loaded)
  localMatches.forEach(city => {
    const item = document.createElement('div');
    item.className = 'search-result-item';
    const top = (city.candidats || []).filter(c => c.score !== null).slice(0, 2);
    const preview = top.map(c => c.parti + ' ' + c.score + '%').join(' / ');
    item.innerHTML = '<span class="city-n">' + city.name + '</span> <span class="city-dept">— ' + city.dept + '</span>' + (preview ? '<div style="font-size:0.7rem;color:var(--accent);margin-top:2px">' + preview + '</div>' : '');
    item.addEventListener('click', () => {
      showDetailPanel(city.id);
      zoomToCity(city.id);
      container.classList.remove('active');
      input.value = city.name;
    });
    container.appendChild(item);
  });

  // Cached matches (from loaded departments, with results)
  if (cachedMatches && cachedMatches.length > 0) {
    if (localMatches.length > 0) {
      const sep = document.createElement('div');
      sep.style.cssText = 'padding:4px 1rem;font-size:0.68rem;color:var(--text2);background:var(--surface2);font-weight:600;letter-spacing:0.5px;text-transform:uppercase';
      sep.textContent = 'Résultats chargés';
      container.appendChild(sep);
    }
    cachedMatches.forEach(cm => {
      const item = document.createElement('div');
      item.className = 'search-result-item';
      const hasData = !!RESULTS_DB[cm.code];
      const results = RESULTS_DB[cm.code];
      let preview = '';
      if (results && results.candidats) {
        const top = results.candidats.filter(c => c.score).slice(0, 2);
        preview = top.map(c => c.parti + ' ' + c.score + '%').join(' / ');
      }
      item.innerHTML = '<span class="city-n">' + cm.nom + '</span> <span class="city-dept">— ' + cm.dept + '</span>' +
        (preview ? '<div style="font-size:0.7rem;color:#22C55E;margin-top:2px">' + preview + '</div>' :
        (hasData ? '<div style="font-size:0.65rem;color:#22C55E;margin-top:2px">Résultats disponibles</div>' : ''));
      item.addEventListener('click', async () => {
        container.classList.remove('active');
        input.value = cm.nom;
        // Build a fake API city object
        const deptCode = getDeptCode(cm.code);
        const deptInfo = DEPT_CACHE[deptCode];
        const apiCity = {
          code: cm.code, nom: cm.nom, population: cm.inscrits || 0,
          departement: { nom: deptInfo ? deptInfo.nom : '' }
        };
        await showRemoteCityDetail(apiCity);
      });
      container.appendChild(item);
    });
  }

  // Remote matches (from geo API, not yet loaded)
  if (remoteCities.length > 0) {
    const sep = document.createElement('div');
    sep.style.cssText = 'padding:4px 1rem;font-size:0.68rem;color:var(--text2);background:var(--surface2);font-weight:600;letter-spacing:0.5px;text-transform:uppercase';
    sep.textContent = 'Autres communes';
    container.appendChild(sep);
  }
  remoteCities.forEach(ac => {
    const item = document.createElement('div');
    item.className = 'search-result-item';
    const dn = ac.departement ? ac.departement.nom : '';
    const ps = ac.population ? (ac.population > 1000 ? Math.round(ac.population / 1000) + 'k hab.' : ac.population + ' hab.') : '';
    item.innerHTML = '<span class="city-n">' + ac.nom + '</span> <span class="city-dept">— ' + dn + (ps ? ' · ' + ps : '') + '</span>' +
      '<div style="font-size:0.65rem;color:var(--accent);margin-top:2px">Cliquer pour charger les résultats</div>';
    item.addEventListener('click', () => {
      showRemoteCityDetail(ac);
      container.classList.remove('active');
      input.value = ac.nom;
    });
    container.appendChild(item);
  });

  if (!localMatches.length && !remoteCities.length && (!cachedMatches || !cachedMatches.length)) {
    const n = document.createElement('div');
    n.className = 'search-result-item';
    n.style.color = 'var(--text2)';
    n.textContent = 'Recherche en cours...';
    container.appendChild(n);
  }
  container.classList.add('active');
}

// ===== AUTO REFRESH =====
function setupAutoRefresh() {
  if (IS_DEFINITIF) {
    document.getElementById('refreshInfo').innerHTML = '<span style="color:var(--text2)">Résultats définitifs</span>';
    document.getElementById('liveBadge').textContent = '1er Tour — Définitif';
    document.getElementById('liveBadge').style.background = '#22C55E';
    return;
  }

  setInterval(async () => {
    refreshCountdown = REFRESH_INTERVAL / 1000;
    const updated = await applyLiveResults();
    if (updated) {
      const badge = document.getElementById('liveBadge');
      badge.style.background = '#22C55E';
      badge.textContent = 'Données mises à jour';
      setTimeout(() => {
        badge.style.background = '';
        badge.textContent = '1er Tour — En direct';
      }, 3000);
    }
  }, REFRESH_INTERVAL);

  setInterval(() => {
    if (refreshCountdown > 0) refreshCountdown--;
    const m = Math.floor(refreshCountdown / 60), s = refreshCountdown % 60;
    document.getElementById('refreshTimer').textContent = 'Refresh : ' + m + ':' + String(s).padStart(2, '0');
  }, 1000);
}

// ===== INIT =====
document.addEventListener('DOMContentLoaded', function () {
  initMap();
  initChoropleth();
  loadCities();
  setupSearch();
  setupFilters();
  setupLegend();
  setupAutoRefresh();

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      closeDetailPanel();
      if (openDetailCityId) toggleTileDetail(openDetailCityId);
    }
  });
});
