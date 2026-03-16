// ===== CHOROPLETH MAP LAYER =====
// Uses france-geojson for department contours, geo.api.gouv.fr for commune contours

let deptLayer = null;
let communeLayers = {}; // keyed by dept code
let loadedDepts = new Set();
let communeLayerGroup = L.layerGroup();
let activeDeptCode = null; // currently selected department

const DEPT_GEOJSON_URL = 'https://raw.githubusercontent.com/gregoiredavid/france-geojson/master/departements-version-simplifiee.geojson';

// Aggregate results per department from RESULTS_DB
function getDeptPoliticalData() {
  const deptData = {};
  Object.entries(RESULTS_DB).forEach(([code, results]) => {
    const dept = getDeptCode(code);
    if (!deptData[dept]) deptData[dept] = { cities: [], bords: {} };
    deptData[dept].cities.push({ code, ...results });

    if (results.candidats && results.candidats.length) {
      const lead = results.candidats.find(c => c.score !== null && c.score !== undefined);
      if (lead) {
        let family = 'indecis';
        if (BORD_FAMILIES.gauche.includes(lead.bord)) family = 'gauche';
        else if (BORD_FAMILIES.droite.includes(lead.bord)) family = 'droite';
        else if (BORD_FAMILIES.rn.includes(lead.bord)) family = 'rn';
        else if (BORD_FAMILIES.divers.includes(lead.bord)) family = 'divers';
        deptData[dept].bords[family] = (deptData[dept].bords[family] || 0) + 1;
      }
    }
  });
  return deptData;
}

function getDeptColor(deptCode, deptPoliticalData) {
  const data = deptPoliticalData[deptCode];
  if (!data) return 'rgba(144,164,174,0.15)';

  let maxBord = 'indecis', maxCount = 0;
  Object.entries(data.bords).forEach(([bord, count]) => {
    if (count > maxCount) { maxBord = bord; maxCount = count; }
  });

  const colors = {
    gauche: 'rgba(255,107,107,0.35)',
    droite: 'rgba(25,118,210,0.35)',
    rn: 'rgba(92,107,192,0.35)',
    eco: 'rgba(76,175,80,0.35)',
    centre: 'rgba(255,152,0,0.35)',
    divers: 'rgba(144,164,174,0.2)',
    indecis: 'rgba(144,164,174,0.2)'
  };
  return colors[maxBord] || colors.indecis;
}

function getCommuneColor(communeCode) {
  const results = RESULTS_DB[communeCode];
  if (!results || !results.candidats || !results.candidats.length) return null;

  const lead = results.candidats.find(c => c.score !== null && c.score !== undefined);
  if (!lead) return null;

  if (BORD_FAMILIES.rn.includes(lead.bord)) return 'rgba(92,107,192,0.5)';
  if (BORD_FAMILIES.gauche.includes(lead.bord)) {
    if (lead.bord === 'Extrême gauche') return 'rgba(155,89,182,0.5)';
    if (lead.bord === 'Centre-gauche') return 'rgba(76,175,80,0.5)';
    return 'rgba(255,107,107,0.5)';
  }
  if (BORD_FAMILIES.droite.includes(lead.bord)) {
    if (lead.bord === 'Centre' || lead.bord === 'Centre-droit') return 'rgba(255,152,0,0.5)';
    if (lead.bord === 'Droite souverainiste') return 'rgba(0,150,136,0.5)';
    return 'rgba(25,118,210,0.5)';
  }
  if (BORD_FAMILIES.divers.includes(lead.bord)) return 'rgba(144,164,174,0.35)';
  return 'rgba(144,164,174,0.3)';
}

// ===== LOAD DEPARTMENTS =====
async function loadDepartments() {
  try {
    const resp = await fetch(DEPT_GEOJSON_URL, { signal: AbortSignal.timeout(15000) });
    const geojson = await resp.json();
    const deptPoliticalData = getDeptPoliticalData();

    deptLayer = L.geoJSON(geojson, {
      style: function (feature) {
        return {
          fillColor: getDeptColor(feature.properties.code, deptPoliticalData),
          fillOpacity: 1,
          color: 'rgba(71,85,105,0.4)',
          weight: 1
        };
      },
      onEachFeature: function (feature, layer) {
        layer.on('click', function () {
          selectDepartment(feature.properties.code, layer);
        });
        layer.on('mouseover', function () {
          this.setStyle({ weight: 2, color: 'rgba(56,189,248,0.6)' });
        });
        layer.on('mouseout', function () {
          this.setStyle({ weight: 1, color: 'rgba(71,85,105,0.4)' });
        });

        const data = deptPoliticalData[feature.properties.code];
        let tooltip = '<strong>' + feature.properties.nom + '</strong> (' + feature.properties.code + ')';
        if (data && data.cities.length) {
          tooltip += '<br>' + data.cities.length + ' ville(s) avec résultats';
        }
        layer.bindTooltip(tooltip, { sticky: true, className: 'dept-tooltip' });
      }
    });

    deptLayer.addTo(MAP);
    MAP.on('zoomend', onMapZoom);

  } catch (e) {
    console.log('Impossible de charger les contours départementaux:', e);
  }
}

// ===== LOAD COMMUNES FOR A DEPARTMENT =====
async function loadCommunesForDept(deptCode) {
  if (loadedDepts.has(deptCode)) return;
  loadedDepts.add(deptCode);

  try {
    // Load both: GeoJSON contours from geo API + election results from our JSON
    const [geoResp, _deptData] = await Promise.all([
      fetch('https://geo.api.gouv.fr/departements/' + deptCode + '/communes?format=geojson&geometry=contour&fields=nom,code,population', {
        signal: AbortSignal.timeout(15000)
      }),
      loadDeptResults(deptCode)
    ]);

    const geojson = await geoResp.json();

    const layer = L.geoJSON(geojson, {
      style: function (feature) {
        const color = getCommuneColor(feature.properties.code);
        return {
          fillColor: color || 'rgba(30,41,59,0.3)',
          fillOpacity: color ? 1 : 0.5,
          color: 'rgba(71,85,105,0.3)',
          weight: 0.5
        };
      },
      onEachFeature: function (feature, layer) {
        const code = feature.properties.code;
        const results = RESULTS_DB[code];
        let tooltip = '<strong>' + feature.properties.nom + '</strong>';
        if (feature.properties.population) {
          tooltip += '<br>' + feature.properties.population.toLocaleString('fr-FR') + ' hab.';
        }
        if (results && results.candidats && results.candidats.length) {
          const lead = results.candidats.find(c => c.score !== null && c.score !== undefined);
          if (lead) {
            tooltip += '<br><span style="color:' + lead.color + '">' + lead.nom + ' (' + lead.parti + ') — ' + lead.score + '%</span>';
          }
          const statusText = results.status === 'elu' ? 'Élu 1er tour' : results.status === '2t' ? '2e tour' : '';
          if (statusText) tooltip += '<br><em>' + statusText + '</em>';
        }
        layer.bindTooltip(tooltip, { sticky: true, className: 'commune-tooltip' });

        layer.on('click', function () {
          handleCommuneClick(code, feature.properties.nom, feature.properties.population);
        });
        layer.on('mouseover', function () {
          this.setStyle({ weight: 1.5, color: 'rgba(56,189,248,0.7)' });
        });
        layer.on('mouseout', function () {
          this.setStyle({ weight: 0.5, color: 'rgba(71,85,105,0.3)' });
        });
      }
    });

    communeLayers[deptCode] = layer;
    // Don't auto-add to group; selectDepartment controls what's shown

  } catch (e) {
    console.log('Erreur chargement communes dept ' + deptCode + ':', e);
    loadedDepts.delete(deptCode);
  }
}

// ===== COMMUNE CLICK HANDLER =====
async function handleCommuneClick(code, nom, population) {
  // Ensure results are loaded for this commune
  await loadCommuneResults(code);

  let city = CITIES.find(c => c.id === code);
  if (!city) {
    const results = RESULTS_DB[code] || null;
    const deptCode = getDeptCode(code);
    const deptInfo = DEPT_CACHE[deptCode];
    const deptName = deptInfo ? deptInfo.nom : '';
    const pop = population || 0;
    const popStr = pop >= 1e6 ? (pop / 1e6).toFixed(1).replace('.0', '') + ' M hab.'
      : pop >= 1000 ? Math.round(pop / 1000) + ' k hab.' : pop + ' hab.';
    const miUrl = buildMinistryUrl(code);

    city = {
      id: code, name: nom, pop: popStr, dept: deptName,
      lat: 0, lng: 0, code: code, population: pop,
      sources: [{ label: "Ministère de l'Intérieur", url: miUrl }],
      status: results ? results.status : 'inconnu',
      bord: results ? results.bord : 'indecis',
      participation: results ? results.participation : 0,
      candidats: results ? results.candidats : [],
      maireSortant: results ? results.maireSortant : null,
      note: results ? results.note : null,
      tags: results ? computeTags(results) : []
    };
    CITIES.push(city);
  }

  showDetailPanel(city.id);
  // Highlight the commune on the map
  highlightCommune(code);
  // Zoom to the commune — find its bounds from the GeoJSON layer
  if (MAP) {
    let found = false;
    const searchLg = activeDomTom ? domtomGeoLayers[activeDomTom] :
      (activeDeptCode ? communeLayers[activeDeptCode] : null);
    if (searchLg) {
      searchLg.eachLayer(function (l) {
        if (!found && l.feature && l.feature.properties.code === code) {
          MAP.fitBounds(l.getBounds(), { maxZoom: 13, padding: [40, 40], animate: true });
          found = true;
        }
      });
    }
  }
}

// ===== DESELECT DEPARTMENT =====
function deselectDepartment() {
  deselectCommune();
  activeDeptCode = null;
  // Remove all commune layers from the group
  communeLayerGroup.clearLayers();
  if (MAP.hasLayer(communeLayerGroup)) MAP.removeLayer(communeLayerGroup);
  // Restore all dept styles
  const deptPoliticalData = getDeptPoliticalData();
  deptLayer.eachLayer(function (l) {
    const code = l.feature.properties.code;
    l.setStyle({ fillColor: getDeptColor(code, deptPoliticalData), fillOpacity: 1, weight: 1, color: 'rgba(71,85,105,0.4)' });
  });
  MAP.flyTo(FRANCE_VIEW.center, FRANCE_VIEW.zoom, { duration: 0.8 });
  hideMapCloseBtn();
  // Close any open detail
  closeDetailPanel();
  if (openDetailCityId) {
    const existing = document.getElementById('tileDetail');
    if (existing) existing.remove();
    document.querySelectorAll('.city-tile.active').forEach(t => t.classList.remove('active'));
    openDetailCityId = null;
  }
  // Reset tiles to national view
  displayFiltered(currentFilter);
}

// ===== SELECT DEPARTMENT =====
async function selectDepartment(deptCode, layer) {
  // If clicking the same dept, deselect
  if (activeDeptCode === deptCode) {
    deselectDepartment();
    return;
  }

  // Clear previous commune layers before loading new dept
  communeLayerGroup.clearLayers();

  activeDeptCode = deptCode;
  closeDetailPanel();

  // Dim all departments, highlight selected
  deptLayer.eachLayer(function (l) {
    const code = l.feature.properties.code;
    if (code === deptCode) {
      l.setStyle({ fillOpacity: 0, weight: 2, color: 'rgba(56,189,248,0.6)' });
    } else {
      l.setStyle({ fillOpacity: 0.3, weight: 1, color: 'rgba(71,85,105,0.2)' });
    }
  });

  // Load communes for this dept only and show on map
  await loadCommunesForDept(deptCode);
  // Re-add only the active dept's commune layer to the group
  communeLayerGroup.clearLayers();
  if (communeLayers[deptCode]) communeLayerGroup.addLayer(communeLayers[deptCode]);
  if (!MAP.hasLayer(communeLayerGroup)) MAP.addLayer(communeLayerGroup);

  // Zoom to dept
  if (layer) MAP.fitBounds(layer.getBounds(), { maxZoom: 11, padding: [20, 20] });
  showMapCloseBtn();

  // Show dept communes in the tiles
  displayDeptResults(deptCode);
}

// Display only communes from a specific department in the tiles grid
function displayDeptResults(deptCode) {
  const deptInfo = DEPT_CACHE[deptCode];
  if (!deptInfo) return;

  // Build city objects for all communes in this dept with results
  let deptCities = deptInfo.communes
    .filter(c => c.candidats && c.candidats.length > 0)
    .map(c => {
      let city = CITIES.find(x => x.id === c.code);
      if (!city) {
        city = buildCity({
          code: c.code, nom: c.nom, population: c.inscrits || 0,
          departement: { nom: deptInfo.nom }
        }, RESULTS_DB[c.code] || null);
        CITIES.push(city);
      }
      return city;
    });

  // Apply current filter and legend
  deptCities = applyFilter(deptCities, currentFilter);
  if (activeLegendParty) {
    deptCities = deptCities.filter(c => cityMatchesLegendParty(c, activeLegendParty));
  }

  renderTiles(deptCities.slice(0, 50));
}

// ===== ZOOM HANDLER =====
function onMapZoom() {
  const zoom = MAP.getZoom();

  if (zoom >= 9 && activeDeptCode) {
    // Show commune layer when zoomed in with active dept
    if (deptLayer && MAP.hasLayer(deptLayer)) {
      deptLayer.eachLayer(function (l) {
        if (l.feature.properties.code === activeDeptCode) {
          l.setStyle({ fillOpacity: 0, weight: 2, color: 'rgba(56,189,248,0.6)' });
        }
      });
    }
    if (!MAP.hasLayer(communeLayerGroup)) MAP.addLayer(communeLayerGroup);
  } else if (!activeDeptCode) {
    // No active dept: restore normal dept view
    if (zoom < 9) {
      if (deptLayer && MAP.hasLayer(deptLayer)) {
        const deptPoliticalData = getDeptPoliticalData();
        deptLayer.eachLayer(function (layer) {
          const code = layer.feature.properties.code;
          layer.setStyle({
            fillColor: getDeptColor(code, deptPoliticalData),
            fillOpacity: 1,
            weight: 1,
            color: 'rgba(71,85,105,0.4)'
          });
        });
      }
      if (MAP.hasLayer(communeLayerGroup)) MAP.removeLayer(communeLayerGroup);
    }
  }
}

// ===== REFRESH COLORS =====
function refreshChoroplethColors() {
  if (deptLayer) {
    const deptPoliticalData = getDeptPoliticalData();
    deptLayer.eachLayer(function (layer) {
      const code = layer.feature.properties.code;
      layer.setStyle({ fillColor: getDeptColor(code, deptPoliticalData) });
    });
  }

  Object.values(communeLayers).forEach(layer => {
    layer.eachLayer(function (subLayer) {
      if (!subLayer.feature) return;
      const code = subLayer.feature.properties.code;
      const color = getCommuneColor(code);
      subLayer.setStyle({
        fillColor: color || 'rgba(30,41,59,0.3)',
        fillOpacity: color ? 1 : 0.5
      });
    });
  });
}

// ===== INIT CHOROPLETH =====
function initChoropleth() {
  communeLayerGroup.addTo(MAP);
  MAP.removeLayer(communeLayerGroup); // Start hidden
  loadDepartments();
}
