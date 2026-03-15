// ===== STATE =====
let CITIES = [];
let MAP, CLUSTER_GROUP;
let currentFilter = 'all';
let activeLegendParty = null;
let openDetailCityId = null;
let refreshCountdown = REFRESH_INTERVAL / 1000;
let citiesLoaded = false;

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
  const deptName = apiCity.departement ? apiCity.departement.nom : '';
  const pop = apiCity.population || 0;
  const popStr = pop >= 1e6 ? (pop / 1e6).toFixed(1).replace('.0', '') + ' M hab.'
    : pop >= 1000 ? Math.round(pop / 1000) + ' k hab.' : pop + ' hab.';
  const lat = apiCity.centre ? apiCity.centre.coordinates[1] : 46.6;
  const lng = apiCity.centre ? apiCity.centre.coordinates[0] : 2.5;
  const deptCode = code.substring(0, code.startsWith('97') ? 3 : 2);
  const miUrl = 'https://www.resultats-elections.interieur.gouv.fr/municipales2026/' + deptCode.padStart(3, '0') + '/' + code + '/';
  const base = {
    id: code, name: apiCity.nom, pop: popStr, dept: deptName,
    lat, lng, code, population: pop,
    sources: [{ label: "Ministère de l'Intérieur", url: miUrl }]
  };
  if (results) return { ...base, ...results, tags: computeTags(results) };
  return { ...base, status: 'inconnu', bord: 'indecis', participation: 0, candidats: [], tags: [], note: 'Résultats non encore disponibles' };
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

// ===== LOAD CITIES (once at startup) =====
async function loadCities() {
  const grid = document.getElementById('citiesGrid');
  grid.innerHTML = '<div style="text-align:center;padding:2rem;color:var(--text2)">Chargement...</div>';

  // Start with all RESULTS_DB cities (guaranteed data)
  CITIES = Object.entries(RESULTS_DB).map(([code, results]) => {
    const geo = GEO_FALLBACK[code];
    if (!geo) return null;
    const fakeApi = {
      code, nom: geo.nom, population: geo.pop,
      centre: { coordinates: [geo.lng, geo.lat] },
      departement: { nom: geo.dept }
    };
    return buildCity(fakeApi, results);
  }).filter(Boolean);

  // Try to enrich with API data (more cities, better geo data)
  try {
    const resp = await fetch('https://geo.api.gouv.fr/communes?fields=nom,code,departement,population,centre&boost=population&limit=80', { signal: AbortSignal.timeout(6000) });
    const apiCities = await resp.json();

    // Merge: update existing cities with API data, add new ones
    const existingCodes = new Set(CITIES.map(c => c.id));
    apiCities.forEach(ac => {
      if (existingCodes.has(ac.code)) {
        // Update existing city with better API geo data
        const idx = CITIES.findIndex(c => c.id === ac.code);
        if (idx !== -1) {
          CITIES[idx] = buildCity(ac, RESULTS_DB[ac.code] || null);
        }
      } else {
        // Add new city from API (no results yet)
        CITIES.push(buildCity(ac, null));
      }
    });
  } catch (e) {
    console.log('API geo indisponible, données embarquées uniquement:', e);
  }

  citiesLoaded = true;
  displayFiltered('all');
}

// ===== DISPLAY (no re-fetch, just filter + render) =====
function displayFiltered(filter) {
  if (!citiesLoaded) return;

  let filtered = applyFilter(CITIES, filter);

  if (activeLegendParty) {
    filtered = filtered.filter(c => cityMatchesLegendParty(c, activeLegendParty));
  }

  filtered = filtered.slice(0, 20);
  renderTiles(filtered);
  updateMap(filtered);
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
    default: // 'all' — ONLY cities with results, sorted by population
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
  CLUSTER_GROUP = L.markerClusterGroup({
    maxClusterRadius: 45, spiderfyOnMaxZoom: true,
    showCoverageOnHover: false, zoomToBoundsOnClick: true,
    iconCreateFunction: function (cluster) {
      const n = cluster.getChildCount();
      const sz = n >= 10 ? 'large' : n >= 5 ? 'medium' : 'small';
      return L.divIcon({ html: '<div>' + n + '</div>', className: 'marker-cluster marker-cluster-' + sz, iconSize: L.point(40, 40) });
    }
  });
  MAP.addLayer(CLUSTER_GROUP);
}

function updateMap(cities) {
  CLUSTER_GROUP.clearLayers();
  cities.forEach(city => {
    const c = BORD_COLORS[city.bord] || '#90A4AE';
    const r = Math.max(8, Math.min(16, (city.candidats ? city.candidats.length : 1) * 3 + 4));
    const mk = L.circleMarker([city.lat, city.lng], {
      radius: r, fillColor: c, fillOpacity: 0.85, color: '#fff', weight: 2
    });
    mk.bindPopup(buildPopupHTML(city), { maxWidth: 320 });
    mk.on('mouseover', function () { this.setStyle({ weight: 3, fillOpacity: 1 }); });
    mk.on('mouseout', function () { this.setStyle({ weight: 2, fillOpacity: 0.85 }); });
    city._marker = mk;
    CLUSTER_GROUP.addLayer(mk);
  });
}

function buildPopupHTML(city) {
  const sl = city.status === 'elu' ? 'ÉLU' : city.status === '2t' ? '2e TOUR' : 'EN COURS';
  const sc = city.status === 'elu' ? '#22C55E' : city.status === '2t' ? '#F59E0B' : '#94A3B8';
  let h = '<div style="min-width:220px;font-family:inherit">';
  h += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">';
  h += '<strong style="font-size:1rem">' + city.name + '</strong>';
  h += '<span style="font-size:0.6rem;background:' + sc + '33;color:' + sc + ';padding:2px 6px;border-radius:999px;font-weight:700">' + sl + '</span></div>';
  h += '<div style="font-size:0.7rem;color:#94A3B8">' + city.pop + ' — ' + city.dept + '</div>';
  if (city.candidats && city.candidats.length) {
    h += '<hr style="border-color:#475569;margin:6px 0">';
    city.candidats.forEach(cd => {
      const s = cd.score !== null ? cd.score + ' %' : '—';
      h += '<div style="display:flex;justify-content:space-between;margin:3px 0;font-size:0.78rem">';
      h += '<span>' + cd.nom + ' <span style="color:#94A3B8;font-size:0.68rem">(' + cd.parti + ')</span></span>';
      h += '<strong style="color:' + cd.color + '">' + s + '</strong></div>';
    });
  }
  h += '<hr style="border-color:#475569;margin:6px 0">';
  h += '<button onclick="showDetailPanel(\'' + city.id + '\')" style="width:100%;padding:6px;background:#38BDF8;color:#0F172A;border:none;border-radius:8px;font-weight:700;font-size:0.78rem;cursor:pointer">Voir les détails</button></div>';
  return h;
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

// ===== INLINE DETAIL (tile expansion) =====
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

  if (MAP && city._marker) {
    MAP.setView([city.lat, city.lng], Math.max(MAP.getZoom(), 8), { animate: true });
    city._marker.openPopup();
  }

  detailRow.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// ===== DETAIL PANEL (from map/search click) =====
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

function showRemoteCityDetail(apiCity) {
  if (RESULTS_DB[apiCity.code]) {
    const city = buildCity(apiCity, RESULTS_DB[apiCity.code]);
    if (!CITIES.find(c => c.id === city.id)) CITIES.push(city);
    showDetailPanel(city.id);
    return;
  }
  const city = buildCity(apiCity, null);
  if (!CITIES.find(c => c.id === city.id)) CITIES.push(city);
  showDetailPanel(city.id);
  if (apiCity.centre && MAP) {
    MAP.setView([apiCity.centre.coordinates[1], apiCity.centre.coordinates[0]], Math.max(MAP.getZoom(), 9), { animate: true });
  }
}

// ===== BUILD DETAIL HTML =====
function buildDetailHTML(city, isTile) {
  const maxScore = Math.max(...(city.candidats || []).map(c => c.score || 0), 1);
  const deptCode = (city.code || '').substring(0, (city.code || '').startsWith('97') ? 3 : 2);
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
  html += '</div>';
  return html;
}

// ===== LEGEND (interactive) =====
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

// ===== FILTERS (no re-fetch, just re-display) =====
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
    const localMatches = CITIES.filter(c => c.name.toLowerCase().includes(q.toLowerCase()) || c.dept.toLowerCase().includes(q.toLowerCase()));
    renderSearchResults(results, input, localMatches, []);
    clearTimeout(searchDebounce);
    searchDebounce = setTimeout(() => {
      fetch('https://geo.api.gouv.fr/communes?nom=' + encodeURIComponent(q) + '&fields=nom,code,codesPostaux,departement,population,centre&boost=population&limit=15', { signal: AbortSignal.timeout(4000) })
        .then(r => r.json())
        .then(apiCities => {
          const localCodes = new Set(CITIES.map(c => c.id));
          const remote = apiCities.filter(ac => !localCodes.has(ac.code));
          renderSearchResults(results, input, localMatches, remote);
        }).catch(() => { });
    }, 250);
  });
  document.addEventListener('click', e => { if (!e.target.closest('.search-container')) results.classList.remove('active'); });
}

function renderSearchResults(container, input, localMatches, remoteCities) {
  container.innerHTML = '';
  localMatches.forEach(city => {
    const item = document.createElement('div');
    item.className = 'search-result-item';
    const top = (city.candidats || []).filter(c => c.score !== null).slice(0, 2);
    const preview = top.map(c => c.parti + ' ' + c.score + '%').join(' / ');
    item.innerHTML = '<span class="city-n">' + city.name + '</span> <span class="city-dept">— ' + city.dept + '</span>' + (preview ? '<div style="font-size:0.7rem;color:var(--accent);margin-top:2px">' + preview + '</div>' : '');
    item.addEventListener('click', () => { showDetailPanel(city.id); container.classList.remove('active'); input.value = city.name; });
    container.appendChild(item);
  });
  if (localMatches.length > 0 && remoteCities.length > 0) {
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
    item.innerHTML = '<span class="city-n">' + ac.nom + '</span> <span class="city-dept">— ' + dn + (ps ? ' · ' + ps : '') + '</span>';
    item.addEventListener('click', () => { showRemoteCityDetail(ac); container.classList.remove('active'); input.value = ac.nom; });
    container.appendChild(item);
  });
  if (!localMatches.length && !remoteCities.length) {
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
  setInterval(() => { refreshCountdown = REFRESH_INTERVAL / 1000; location.reload(); }, REFRESH_INTERVAL);
  setInterval(() => {
    if (refreshCountdown > 0) refreshCountdown--;
    const m = Math.floor(refreshCountdown / 60), s = refreshCountdown % 60;
    document.getElementById('refreshTimer').textContent = 'Refresh : ' + m + ':' + String(s).padStart(2, '0');
  }, 1000);
}

// ===== INIT =====
document.addEventListener('DOMContentLoaded', function () {
  initMap();
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
