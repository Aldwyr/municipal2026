// ===== STATE =====
let CITIES = [];
let MAP;
let currentFilter = 'all';
let activeLegendParty = null;
let openDetailCityId = null;
let refreshCountdown = REFRESH_INTERVAL / 1000;
let citiesLoaded = false;
let lastUpdateTimestamp = null;
const FRANCE_VIEW = { center: [46.6, 2.5], zoom: 6 };
let activeCommuneCode = null; // currently highlighted commune on map
let _navGuard = false; // prevent cascading zoomend events during programmatic navigation

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
  const miUrl = buildMinistryUrl(code);
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
  // If a department or DOM/TOM is active, filter within that context
  if (activeDeptCode || activeDomTom) {
    displayDeptResults(activeDeptCode || activeDomTom);
    return;
  }

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
const FRANCE_BOUNDS = L.latLngBounds([[41.0, -5.5], [51.5, 10.0]]);
let activeDomTom = null; // currently viewing DOM/TOM territory

function initMap() {
  MAP = L.map('map', {
    center: FRANCE_VIEW.center, zoom: FRANCE_VIEW.zoom,
    scrollWheelZoom: true, zoomControl: false,
    maxBounds: FRANCE_BOUNDS,
    maxBoundsViscosity: 1.0,
    minZoom: 5
  });
  L.control.zoom({ position: 'bottomright' }).addTo(MAP);
  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; OSM &copy; CARTO', maxZoom: 19
  }).addTo(MAP);

  // Two-level dezoom: commune → department view, then department → national
  MAP.on('zoomend', function () {
    if (_navGuard) return; // Skip during programmatic navigation
    const zoom = MAP.getZoom();
    // Level 1: commune selected + dezoom → back to department view
    if (activeCommuneCode && zoom <= 9 && (activeDeptCode || activeDomTom)) {
      returnToDeptView();
      return; // Stop here — don't also deselect department
    }
    // Level 2: department level (no commune) + dezoom → back to national
    if (activeDeptCode && !activeCommuneCode && zoom <= 7) {
      deselectDepartment();
    }
  });
}

// ===== SHARED: return from commune view to department/DOM-TOM view =====
function returnToDeptView() {
  deselectCommune();
  closeDetailPanel();
  clearOpenDetail();
  // Fly back to department or DOM/TOM bounds (with nav guard to prevent cascading zoomend)
  _navGuard = true;
  if (activeDomTom && domtomGeoLayers[activeDomTom]) {
    const bounds = domtomGeoLayers[activeDomTom].getBounds();
    if (bounds.isValid()) MAP.flyToBounds(bounds, { maxZoom: domtomMaps[activeDomTom] ? domtomMaps[activeDomTom].mainZoom : 10, padding: [20, 20], duration: 0.6 });
  } else if (activeDeptCode && communeLayers[activeDeptCode]) {
    MAP.flyToBounds(communeLayers[activeDeptCode].getBounds(), { maxZoom: 10, padding: [20, 20], duration: 0.6 });
  }
  setTimeout(() => { _navGuard = false; }, 1000);
}

// Clear any open inline tile detail
function clearOpenDetail() {
  if (openDetailCityId) {
    const existing = document.getElementById('tileDetail');
    if (existing) existing.remove();
    document.querySelectorAll('.city-tile.active').forEach(t => t.classList.remove('active'));
    openDetailCityId = null;
  }
}

// ===== MAP CLOSE BUTTON (deselect dept / DOM/TOM) =====
function showMapCloseBtn() {
  let btn = document.getElementById('mapCloseBtn');
  if (!btn) {
    btn = document.createElement('button');
    btn.id = 'mapCloseBtn';
    btn.className = 'map-close-btn';
    btn.innerHTML = '&times;';
    btn.title = 'Retour';
    btn.addEventListener('click', function () {
      // Level 1: commune selected → back to dept/DOM-TOM view
      if (activeCommuneCode && (activeDeptCode || activeDomTom)) {
        returnToDeptView();
        return; // Keep close button visible for level 2
      }
      // Level 2: DOM/TOM view → back to national
      if (activeDomTom) {
        exitDomTomView();
        return;
      }
      // Level 2: department view → back to national
      if (activeDeptCode) {
        deselectDepartment();
        hideMapCloseBtn();
      }
    });
    document.querySelector('.col-map').appendChild(btn);
  }
  btn.style.display = 'flex';
}

function hideMapCloseBtn() {
  const btn = document.getElementById('mapCloseBtn');
  if (btn) btn.style.display = 'none';
}

function zoomToCity(cityId) {
  const city = CITIES.find(c => c.id === cityId);
  if (!city || !MAP) return;
  // Highlight the commune on the map
  highlightCommune(cityId);
  // Try to find the commune's GeoJSON bounds for accurate zooming
  const searchLg = activeDomTom ? domtomGeoLayers[activeDomTom] :
    (activeDeptCode ? communeLayers[activeDeptCode] : null);
  if (searchLg) {
    let found = false;
    searchLg.eachLayer(function (l) {
      if (!found && l.feature && l.feature.properties.code === cityId) {
        MAP.fitBounds(l.getBounds(), { maxZoom: 13, padding: [40, 40], animate: true });
        found = true;
      }
    });
    if (found) return;
  }
  // Fallback: use lat/lng if valid (not default 0,0 or 46.6,2.5)
  if (city.lat && city.lng && city.lat !== 0 && city.lng !== 0 && !(city.lat === 46.6 && city.lng === 2.5)) {
    MAP.setView([city.lat, city.lng], Math.max(MAP.getZoom(), 10), { animate: true });
  }
}

// Highlight a specific commune on the choropleth map
function highlightCommune(communeCode) {
  deselectCommune();
  activeCommuneCode = communeCode;
  // Search in all loaded commune layers
  const searchLayers = activeDeptCode ? [communeLayers[activeDeptCode]] :
    activeDomTom ? [domtomGeoLayers[activeDomTom]] : Object.values(communeLayers);
  searchLayers.forEach(lg => {
    if (!lg) return;
    lg.eachLayer(function (l) {
      if (!l.feature) return;
      if (l.feature.properties.code === communeCode) {
        l.setStyle({ weight: 3, color: '#38BDF8', fillOpacity: 1 });
        l.bringToFront();
      } else {
        l.setStyle({ fillOpacity: 0.35, weight: 0.5, color: 'rgba(71,85,105,0.3)' });
      }
    });
  });
}

// Reset commune highlighting
function deselectCommune() {
  if (!activeCommuneCode) return;
  activeCommuneCode = null;
  const searchLayers = activeDeptCode ? [communeLayers[activeDeptCode]] :
    activeDomTom ? [domtomGeoLayers[activeDomTom]] : Object.values(communeLayers);
  searchLayers.forEach(lg => {
    if (!lg) return;
    lg.eachLayer(function (l) {
      if (!l.feature) return;
      const color = getCommuneColor(l.feature.properties.code);
      l.setStyle({ fillColor: color || 'rgba(30,41,59,0.3)', fillOpacity: color ? 1 : 0.5, weight: 0.5, color: 'rgba(71,85,105,0.3)' });
    });
  });
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
    // Closing: deselect commune and zoom back
    openDetailCityId = null;
    deselectCommune();
    const existing = document.getElementById('tileDetail');
    if (existing) existing.remove();
    const activeTile = document.querySelector('.city-tile.active');
    if (activeTile) activeTile.classList.remove('active');
    // Zoom back to department/DOM-TOM level (with nav guard)
    _navGuard = true;
    if (activeDomTom && domtomGeoLayers[activeDomTom]) {
      const bounds = domtomGeoLayers[activeDomTom].getBounds();
      if (bounds.isValid()) MAP.flyToBounds(bounds, { maxZoom: domtomMaps[activeDomTom] ? domtomMaps[activeDomTom].mainZoom : 10, padding: [20, 20], duration: 0.6 });
    } else if (activeDeptCode && communeLayers[activeDeptCode]) {
      MAP.flyToBounds(communeLayers[activeDeptCode].getBounds(), { maxZoom: 10, padding: [20, 20], duration: 0.6 });
    } else if (MAP) {
      MAP.flyTo(FRANCE_VIEW.center, FRANCE_VIEW.zoom, { duration: 0.8 });
    }
    setTimeout(() => { _navGuard = false; }, 1000);
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
  // Scroll to show the tile (city name) at top, not the detail
  tile.scrollIntoView({ behavior: 'smooth', block: 'start' });
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

  if (apiCity.centre && MAP && !activeDomTom) {
    MAP.setView([apiCity.centre.coordinates[1], apiCity.centre.coordinates[0]], Math.max(MAP.getZoom(), 10), { animate: true });
  }
}

// ===== BUILD DETAIL HTML =====
function buildDetailHTML(city, isTile) {
  const maxScore = Math.max(...(city.candidats || []).map(c => c.score || 0), 1);
  const miUrl = buildMinistryUrl(city.code || '');

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

// ===== DOM/TOM INSET MAPS =====
const domtomMaps = {};
const domtomGeoLayers = {}; // commune GeoJSON layers on main map per DOM/TOM dept
let franceMiniMap = null; // mini-map showing France when viewing DOM/TOM

function initDomTomInsets() {
  document.querySelectorAll('.domtom-inset').forEach(el => {
    const dept = el.dataset.dept;
    const [lat, lng] = el.dataset.center.split(',').map(Number);
    const zoom = parseInt(el.dataset.zoom);
    const mapEl = el.querySelector('.domtom-map');

    const miniMap = L.map(mapEl, {
      center: [lat, lng], zoom: zoom,
      zoomControl: false, attributionControl: false,
      dragging: false, scrollWheelZoom: false,
      doubleClickZoom: false, touchZoom: false,
      keyboard: false, boxZoom: false
    });
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', { maxZoom: 19 }).addTo(miniMap);
    const mainZoom = parseInt(el.dataset.mainZoom) || zoom;
    domtomMaps[dept] = { map: miniMap, center: [lat, lng], zoom: zoom, mainZoom: mainZoom, el: el };

    // Load dept data and add commune layer to mini-map
    loadDeptResults(dept).then(() => {
      fetch('https://geo.api.gouv.fr/departements/' + dept + '/communes?format=geojson&geometry=contour&fields=nom,code,population', { signal: AbortSignal.timeout(15000) })
        .then(r => r.json())
        .then(geojson => {
          L.geoJSON(geojson, {
            style: function(feature) {
              const color = getCommuneColor(feature.properties.code);
              return { fillColor: color || 'rgba(30,41,59,0.3)', fillOpacity: color ? 1 : 0.5, color: 'rgba(71,85,105,0.3)', weight: 0.5 };
            }
          }).addTo(miniMap);

          // Pre-create commune layer for main map
          domtomGeoLayers[dept] = L.geoJSON(geojson, {
            style: function(feature) {
              const color = getCommuneColor(feature.properties.code);
              return { fillColor: color || 'rgba(30,41,59,0.3)', fillOpacity: color ? 1 : 0.5, color: 'rgba(71,85,105,0.3)', weight: 0.5 };
            },
            onEachFeature: function(feature, layer) {
              const code = feature.properties.code;
              let tooltip = '<strong>' + feature.properties.nom + '</strong>';
              if (feature.properties.population) tooltip += '<br>' + feature.properties.population.toLocaleString('fr-FR') + ' hab.';
              layer.bindTooltip(tooltip, { sticky: true, className: 'commune-tooltip' });
              layer.on('click', function() {
                handleCommuneClick(code, feature.properties.nom, feature.properties.population);
              });
            }
          });
        }).catch(() => {});
    });

    // Click handler: show territory on main map
    el.addEventListener('click', () => selectDomTom(dept));
  });
}

// Restore a single DOM/TOM inset to its original territory view
function restoreDomTomInset(dept) {
  const info = domtomMaps[dept];
  if (!info) return;
  info.el.classList.remove('domtom-active');
  info.el.classList.remove('domtom-selected');
  const label = info.el.querySelector('.domtom-label');
  if (label && label.dataset.originalLabel) label.textContent = label.dataset.originalLabel;
  info.map.setView(info.center, info.zoom);
}

// Show a DOM/TOM territory on the main map
async function selectDomTom(dept) {
  // If already viewing this DOM/TOM, deselect
  if (activeDomTom === dept) {
    exitDomTomView();
    return;
  }

  // Restore ALL DOM/TOM insets first (in case switching)
  Object.keys(domtomMaps).forEach(d => restoreDomTomInset(d));

  // Deselect any active metro department first
  if (activeDeptCode) deselectDepartment();
  deselectCommune();

  activeDomTom = dept;
  const info = domtomMaps[dept];
  if (!info) return;

  // Remove maxBounds so we can pan to DOM/TOM
  MAP.setMaxBounds(null);
  MAP.setMinZoom(3);

  // Show commune layer on main map
  Object.values(domtomGeoLayers).forEach(l => { if (MAP.hasLayer(l)) MAP.removeLayer(l); });
  if (domtomGeoLayers[dept]) domtomGeoLayers[dept].addTo(MAP);

  // Fly to DOM/TOM territory (mainZoom = closer view for the big map)
  _navGuard = true;
  MAP.flyTo(info.center, info.mainZoom, { duration: 1 });
  setTimeout(() => { _navGuard = false; }, 1500);

  // Hide dept layer to declutter
  if (deptLayer && MAP.hasLayer(deptLayer)) MAP.removeLayer(deptLayer);

  // Transform ONLY this inset into a France/Métropole mini-preview
  const label = info.el.querySelector('.domtom-label');
  if (label) {
    if (!label.dataset.originalLabel) label.dataset.originalLabel = label.textContent;
    label.textContent = 'Métropole';
  }
  info.el.classList.add('domtom-active');
  info.el.classList.add('domtom-selected');
  info.map.setView(FRANCE_VIEW.center, 4);

  // Show close button on map
  showMapCloseBtn();

  // Show communes list in tiles (no preselection)
  await loadDeptResults(dept);
  closeDetailPanel();
  clearOpenDetail();
  displayDeptResults(dept);
}

// Return main map to France view
function exitDomTomView() {
  if (!activeDomTom) return;

  // Remove DOM/TOM commune layer from main map
  Object.values(domtomGeoLayers).forEach(l => { if (MAP.hasLayer(l)) MAP.removeLayer(l); });

  // Restore dept layer
  if (deptLayer && !MAP.hasLayer(deptLayer)) deptLayer.addTo(MAP);

  // Restore France bounds
  MAP.setMaxBounds(FRANCE_BOUNDS);
  MAP.setMinZoom(5);
  _navGuard = true;
  MAP.flyTo(FRANCE_VIEW.center, FRANCE_VIEW.zoom, { duration: 0.8 });
  setTimeout(() => { _navGuard = false; }, 1000);

  // Restore ALL insets
  Object.keys(domtomMaps).forEach(d => restoreDomTomInset(d));

  deselectCommune();
  activeDomTom = null;
  hideMapCloseBtn();
  closeDetailPanel();
  clearOpenDetail();
  displayFiltered(currentFilter);
}

// ===== INIT =====
document.addEventListener('DOMContentLoaded', function () {
  initMap();
  initChoropleth();
  initDomTomInsets();
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
