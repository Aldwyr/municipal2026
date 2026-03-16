// ===== CHOROPLETH MAP LAYER =====
// V2: Department-level choropleth + commune-level on zoom — NO circle markers

let deptLayer = null;
let communeLayers = {}; // keyed by dept code
let loadedDepts = new Set();
let communeLayerGroup = L.layerGroup();

// Map INSEE city codes to department codes
function getDeptFromInsee(code) {
  if (code.startsWith('97')) return code.substring(0, 3);
  if (code.startsWith('2A') || code.startsWith('2B')) return code.substring(0, 2);
  return code.substring(0, 2);
}

// Aggregate results per department from RESULTS_DB
function getDeptPoliticalData() {
  const deptData = {};
  Object.entries(RESULTS_DB).forEach(([code, results]) => {
    const dept = getDeptFromInsee(code);
    if (!deptData[dept]) deptData[dept] = { cities: [], bords: {} };
    deptData[dept].cities.push({ code, ...results });

    if (results.candidats && results.candidats.length) {
      const lead = results.candidats.find(c => c.score !== null);
      if (lead) {
        let family = 'indecis';
        if (BORD_FAMILIES.gauche.includes(lead.bord)) family = 'gauche';
        else if (BORD_FAMILIES.droite.includes(lead.bord)) family = 'droite';
        else if (BORD_FAMILIES.rn.includes(lead.bord)) family = 'rn';
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
    indecis: 'rgba(144,164,174,0.2)'
  };
  return colors[maxBord] || colors.indecis;
}

function getCommuneColor(communeCode) {
  const results = RESULTS_DB[communeCode];
  if (!results || !results.candidats || !results.candidats.length) return null;

  const lead = results.candidats.find(c => c.score !== null);
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
  return 'rgba(144,164,174,0.3)';
}

// ===== LOAD DEPARTMENTS =====
async function loadDepartments() {
  try {
    const resp = await fetch('https://geo.api.gouv.fr/departements?fields=nom,code,contour', {
      signal: AbortSignal.timeout(10000)
    });
    const depts = await resp.json();
    const deptPoliticalData = getDeptPoliticalData();

    const geojson = {
      type: 'FeatureCollection',
      features: depts.filter(d => d.contour).map(d => ({
        type: 'Feature',
        properties: { code: d.code, nom: d.nom },
        geometry: d.contour
      }))
    };

    deptLayer = L.geoJSON(geojson, {
      style: function (feature) {
        const fillColor = getDeptColor(feature.properties.code, deptPoliticalData);
        return {
          fillColor: fillColor,
          fillOpacity: 1,
          color: 'rgba(71,85,105,0.4)',
          weight: 1
        };
      },
      onEachFeature: function (feature, layer) {
        layer.on('click', function () {
          loadCommunesForDept(feature.properties.code);
          MAP.fitBounds(layer.getBounds(), { maxZoom: 10, padding: [20, 20] });
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
    const resp = await fetch(
      'https://geo.api.gouv.fr/departements/' + deptCode + '/communes?fields=nom,code,population,contour',
      { signal: AbortSignal.timeout(10000) }
    );
    const communes = await resp.json();

    const geojson = {
      type: 'FeatureCollection',
      features: communes.filter(c => c.contour).map(c => ({
        type: 'Feature',
        properties: { code: c.code, nom: c.nom, population: c.population || 0 },
        geometry: c.contour
      }))
    };

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
          const lead = results.candidats.find(c => c.score !== null);
          if (lead) {
            tooltip += '<br><span style="color:' + lead.color + '">' + lead.nom + ' (' + lead.parti + ') — ' + lead.score + '%</span>';
          }
          const statusText = results.status === 'elu' ? 'Élu 1er tour' : results.status === '2t' ? '2e tour' : '';
          if (statusText) tooltip += '<br><em>' + statusText + '</em>';
        }
        layer.bindTooltip(tooltip, { sticky: true, className: 'commune-tooltip' });

        // Click on commune → show detail panel
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
    communeLayerGroup.addLayer(layer);

  } catch (e) {
    console.log('Erreur chargement communes dept ' + deptCode + ':', e);
    loadedDepts.delete(deptCode);
  }
}

// ===== COMMUNE CLICK HANDLER =====
function handleCommuneClick(code, nom, population) {
  // Check if city already in CITIES
  let city = CITIES.find(c => c.id === code);

  if (!city) {
    // Build a minimal city object
    const deptCode = code.substring(0, code.startsWith('97') ? 3 : 2);
    const results = RESULTS_DB[code] || null;
    const pop = population || 0;
    const popStr = pop >= 1e6 ? (pop / 1e6).toFixed(1).replace('.0', '') + ' M hab.'
      : pop >= 1000 ? Math.round(pop / 1000) + ' k hab.' : pop + ' hab.';
    const miUrl = 'https://www.resultats-elections.interieur.gouv.fr/municipales2026/' + deptCode.padStart(3, '0') + '/' + code + '/';

    city = {
      id: code, name: nom, pop: popStr, dept: '',
      lat: 0, lng: 0, code: code, population: pop,
      sources: [{ label: "Ministère de l'Intérieur", url: miUrl }],
      status: results ? results.status : 'inconnu',
      bord: results ? results.bord : 'indecis',
      participation: results ? results.participation : 0,
      candidats: results ? results.candidats : [],
      maireSortant: results ? results.maireSortant : null,
      note: results ? results.note : 'Résultats non encore disponibles',
      tags: results ? computeTags(results) : []
    };
    CITIES.push(city);
  }

  showDetailPanel(city.id);
}

// ===== ZOOM HANDLER =====
function onMapZoom() {
  const zoom = MAP.getZoom();

  if (zoom >= 9) {
    if (deptLayer && MAP.hasLayer(deptLayer)) {
      deptLayer.setStyle({ fillOpacity: 0, weight: 1, color: 'rgba(71,85,105,0.2)' });
    }
    if (!MAP.hasLayer(communeLayerGroup)) MAP.addLayer(communeLayerGroup);
    loadVisibleDeptCommunes();
  } else {
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

function loadVisibleDeptCommunes() {
  if (!deptLayer) return;
  const bounds = MAP.getBounds();
  deptLayer.eachLayer(function (layer) {
    if (bounds.intersects(layer.getBounds())) {
      loadCommunesForDept(layer.feature.properties.code);
    }
  });
}

// ===== REFRESH COLORS (called after live data update) =====
function refreshChoroplethColors() {
  // Refresh department colors
  if (deptLayer) {
    const deptPoliticalData = getDeptPoliticalData();
    deptLayer.eachLayer(function (layer) {
      const code = layer.feature.properties.code;
      layer.setStyle({
        fillColor: getDeptColor(code, deptPoliticalData),
      });
      // Update tooltip
      const data = deptPoliticalData[code];
      let tooltip = '<strong>' + layer.feature.properties.nom + '</strong> (' + code + ')';
      if (data && data.cities.length) {
        tooltip += '<br>' + data.cities.length + ' ville(s) avec résultats';
      }
      layer.unbindTooltip();
      layer.bindTooltip(tooltip, { sticky: true, className: 'dept-tooltip' });
    });
  }

  // Refresh commune colors
  Object.values(communeLayers).forEach(layer => {
    layer.eachLayer(function (subLayer) {
      if (!subLayer.feature) return;
      const code = subLayer.feature.properties.code;
      const color = getCommuneColor(code);
      subLayer.setStyle({
        fillColor: color || 'rgba(30,41,59,0.3)',
        fillOpacity: color ? 1 : 0.5
      });

      // Update tooltip
      const results = RESULTS_DB[code];
      let tooltip = '<strong>' + subLayer.feature.properties.nom + '</strong>';
      if (subLayer.feature.properties.population) {
        tooltip += '<br>' + subLayer.feature.properties.population.toLocaleString('fr-FR') + ' hab.';
      }
      if (results && results.candidats && results.candidats.length) {
        const lead = results.candidats.find(c => c.score !== null);
        if (lead) {
          tooltip += '<br><span style="color:' + lead.color + '">' + lead.nom + ' (' + lead.parti + ') — ' + lead.score + '%</span>';
        }
        const statusText = results.status === 'elu' ? 'Élu 1er tour' : results.status === '2t' ? '2e tour' : '';
        if (statusText) tooltip += '<br><em>' + statusText + '</em>';
      }
      subLayer.unbindTooltip();
      subLayer.bindTooltip(tooltip, { sticky: true, className: 'commune-tooltip' });
    });
  });
}

// ===== INIT CHOROPLETH =====
function initChoropleth() {
  communeLayerGroup.addTo(MAP);
  MAP.removeLayer(communeLayerGroup); // Start hidden
  loadDepartments();
}
