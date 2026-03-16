// ===== CONFIGURATION =====
const BORD_COLORS = {
  gauche: '#FF6B6B', droite: '#1976D2', centre: '#FF9800',
  rn: '#5C6BC0', eco: '#4CAF50', lfi: '#9B59B6', indecis: '#90A4AE'
};

const BORD_FAMILIES = {
  gauche: ['Gauche', 'Centre-gauche', 'Extrême gauche', 'Divers gauche'],
  droite: ['Droite', 'Droite-Centre', 'Centre-droit', 'Centre', 'Divers droite', 'Droite souverainiste'],
  rn: ['Extrême droite'],
  divers: ['Divers']
};

const PARTY_LABELS = {
  PS:   { name: 'PS',           bord: 'Gauche',             color: 'var(--ps)' },
  LFI:  { name: 'LFI',          bord: 'Extrême gauche',     color: 'var(--lfi)' },
  PCF:  { name: 'PCF',          bord: 'Gauche',             color: 'var(--pcf)' },
  EELV: { name: 'Écologistes',  bord: 'Centre-gauche',      color: 'var(--eco)' },
  LR:   { name: 'LR',           bord: 'Droite',             color: 'var(--lr)' },
  RE:   { name: 'Renaissance',  bord: 'Centre',             color: 'var(--re)' },
  RN:   { name: 'RN',           bord: 'Extrême droite',     color: 'var(--rn)' },
  UDR:  { name: 'UDR',          bord: 'Droite souverainiste',color: 'var(--udr)' },
  REC:  { name: 'Reconquête',   bord: 'Extrême droite',     color: 'var(--rec)' },
  DIV:  { name: 'Divers',       bord: 'Divers',             color: 'var(--div)' }
};

const LEGEND_PARTY_MAP = {
  PS:   ['PS', 'PS-PCF-Éco', 'PS-EELV-PCF', 'PS-PCF', 'PS-Union gauche', 'PS-Éco-PCF', 'DVG (PS-Éco)', 'Union de la gauche', 'LSOC', 'LUG', 'LDVG'],
  LFI:  ['LFI', 'LFI-Éco', 'LFI-PCF', 'LFI-Éco-PCF', 'LEXG'],
  PCF:  ['PCF', 'PCF-Gauche unie', 'PCF-PS-Éco', 'LCOM'],
  EELV: ['EELV', 'EELV-Union gauche', 'EELV-PS-PCF', 'Écologistes', 'Union gauche hors LFI', 'Éco-PS-PCF', 'LECO', 'LVEC'],
  LR:   ['LR', 'LR-RE-Horizons', 'LR-RE', 'LR-Horizons', 'DVD-LR-RE', 'LR-MoDem', 'Union à droite', 'LLR', 'LUD', 'LDVD'],
  RE:   ['Renaissance', 'Horizons', 'RE', 'MoDem', 'Horizons-RE-MoDem', 'LR-RE-Horizons', 'LREN', 'LREG', 'LDVC', 'LUC'],
  RN:   ['RN', 'RN-UDR', 'UDR-RN', 'LRN', 'LUXD'],
  UDR:  ['UDR', 'UDR (allié RN)', 'UDR-RN', 'LUDR'],
  REC:  ['Reconquête', 'LREC', 'LEXD'],
  DIV:  ['DVD', 'DVG', 'DIV', 'Divers', 'Sans étiquette', 'Droite-Macronie', 'DVC', 'Liste citoyenne', 'LDIV']
};

const IS_DEFINITIF = false;
const REFRESH_INTERVAL = 5 * 60 * 1000;

// Département → Région code mapping (for Ministry of Interior URLs)
const DEPT_TO_REGION = {
  '01':'84','02':'32','03':'84','04':'93','05':'93','06':'93','07':'84','08':'44',
  '09':'76','10':'44','11':'76','12':'76','13':'93','14':'28','15':'84','16':'75',
  '17':'75','18':'24','19':'75','21':'27','22':'53','23':'75','24':'75','25':'27',
  '26':'84','27':'28','28':'24','29':'53','30':'76','31':'76','32':'76','33':'75',
  '34':'76','35':'53','36':'24','37':'24','38':'84','39':'27','40':'75','41':'24',
  '42':'84','43':'84','44':'52','45':'24','46':'76','47':'75','48':'76','49':'52',
  '50':'28','51':'44','52':'44','53':'52','54':'44','55':'44','56':'53','57':'44',
  '58':'27','59':'32','60':'32','61':'28','62':'32','63':'84','64':'75','65':'76',
  '66':'76','67':'44','68':'44','69':'84','70':'27','71':'27','72':'52','73':'84',
  '74':'84','75':'11','76':'28','77':'11','78':'11','79':'75','80':'32','81':'76',
  '82':'76','83':'93','84':'93','85':'52','86':'75','87':'75','88':'44','89':'27',
  '90':'27','91':'11','92':'11','93':'11','94':'11','95':'11',
  '2A':'94','2B':'94',
  '971':'01','972':'02','973':'03','974':'04','975':'05','976':'06',
  '988':'99'
};

// Build the correct Ministry of Interior URL for a commune
function buildMinistryUrl(inseeCode) {
  const deptCode = getDeptCode(inseeCode);
  const regionCode = DEPT_TO_REGION[deptCode] || '00';
  return 'https://www.resultats-elections.interieur.gouv.fr/municipales2026/ensemble_geographique/' + regionCode + '/' + deptCode + '/' + inseeCode + '/';
}

// ===== RESULTS DB — keyed by INSEE code =====
// Starts with hardcoded top cities, enriched on-demand from data/dept/*.json
const RESULTS_DB = {};

// ===== Department data cache =====
const DEPT_CACHE = {}; // dept_code -> { nom, communes: [{code, nom, ...}] }
const DEPT_LOADING = {}; // dept_code -> Promise (prevent double-fetching)

// ===== TOP CITIES with curated data (override CSV data for better names) =====
const TOP_CITIES = {
  "75056": {
    maireSortant: "Anne Hidalgo (PS)", status: "2t", bord: "gauche", participation: 55,
    note: "Quinquangulaire inédite — Grégoire creuse l'écart face à Dati",
    candidats: [
      { nom: "E. Grégoire", parti: "PS-Éco-PCF", bord: "Gauche", score: 37.98, color: "var(--ps)" },
      { nom: "R. Dati", parti: "LR-MoDem", bord: "Droite", score: 25.46, color: "var(--lr)" },
      { nom: "S. Chikirou", parti: "LFI", bord: "Extrême gauche", score: 11.72, color: "var(--lfi)" },
      { nom: "P-Y. Bournazel", parti: "Horizons-RE", bord: "Centre", score: 11.34, color: "var(--re)" },
      { nom: "S. Knafo", parti: "Reconquête", bord: "Extrême droite", score: 10.4, color: "var(--rec)" }
    ]
  },
  "13055": {
    maireSortant: "Benoît Payan (DVG)", status: "2t", bord: "indecis", participation: 54,
    note: "Duel au coude-à-coude gauche/RN — quadrangulaire possible",
    candidats: [
      { nom: "B. Payan", parti: "DVG (PS-Éco)", bord: "Gauche", score: 35.5, color: "var(--ps)" },
      { nom: "F. Allisio", parti: "RN", bord: "Extrême droite", score: 35.2, color: "var(--rn)" },
      { nom: "M. Vassal", parti: "LR", bord: "Droite", score: 12.7, color: "var(--lr)" },
      { nom: "S. Delogu", parti: "LFI", bord: "Extrême gauche", score: 11.9, color: "var(--lfi)" }
    ]
  },
  "69123": {
    maireSortant: "Grégory Doucet (EELV)", status: "2t", bord: "gauche", participation: 57,
    note: "Énorme surprise : Doucet à égalité avec Aulas",
    candidats: [
      { nom: "G. Doucet", parti: "EELV-PS-PCF", bord: "Gauche", score: 36.8, color: "var(--eco)" },
      { nom: "J-M. Aulas", parti: "LR-RE-Horizons", bord: "Droite-Centre", score: 36.8, color: "var(--lr)" },
      { nom: "A. Belouassa-Cherifi", parti: "LFI", bord: "Extrême gauche", score: 10.9, color: "var(--lfi)" },
      { nom: "A. Dupalais", parti: "RN-UDR", bord: "Extrême droite", score: 7.5, color: "var(--rn)" }
    ]
  },
  "31555": {
    maireSortant: "Jean-Luc Moudenc (DVD)", status: "2t", bord: "droite", participation: 57.4,
    note: "Surprise : LFI (Piquemal) devance le PS — triangulaire",
    candidats: [
      { nom: "J-L. Moudenc", parti: "LR-RE-Horizons", bord: "Droite-Centre", score: 37.23, color: "var(--lr)" },
      { nom: "F. Piquemal", parti: "LFI", bord: "Extrême gauche", score: 27.56, color: "var(--lfi)" },
      { nom: "F. Briançon", parti: "PS-EELV-PCF", bord: "Gauche", score: 24.99, color: "var(--ps)" },
      { nom: "J. Léonardelli", parti: "RN-UDR", bord: "Extrême droite", score: 5.9, color: "var(--rn)" }
    ]
  },
  "06088": {
    maireSortant: "Christian Estrosi (Horizons)", status: "2t", bord: "rn", participation: 53.91,
    note: "Ciotti (UDR-RN) devance très largement Estrosi — triangulaire",
    candidats: [
      { nom: "É. Ciotti", parti: "UDR-RN", bord: "Extrême droite", score: 43.43, color: "var(--rn)" },
      { nom: "C. Estrosi", parti: "Horizons-LR", bord: "Centre-droit", score: 30.92, color: "var(--re)" },
      { nom: "J. Chesnel-Le Roux", parti: "Éco-PS-PCF", bord: "Gauche", score: 11.93, color: "var(--ps)" },
      { nom: "M. Damiano", parti: "LFI", bord: "Extrême gauche", score: 8.95, color: "var(--lfi)" }
    ]
  },
  "44109": {
    maireSortant: "Johanna Rolland (PS)", status: "2t", bord: "gauche", participation: 59.8,
    note: "Duel serré PS/Droite — LFI qualifiée",
    candidats: [
      { nom: "J. Rolland", parti: "PS", bord: "Gauche", score: 35, color: "var(--ps)" },
      { nom: "F. Chombart de Lauwe", parti: "DVD", bord: "Droite", score: 33.1, color: "var(--lr)" },
      { nom: "W. Aucant", parti: "LFI", bord: "Extrême gauche", score: 12, color: "var(--lfi)" }
    ]
  },
  "67482": {
    maireSortant: "Jeanne Barseghian (EELV)", status: "2t", bord: "gauche", participation: 56.9,
    note: "Trautmann (PS) revient en tête — sortante EELV repoussée en 3e",
    candidats: [
      { nom: "C. Trautmann", parti: "PS", bord: "Gauche", score: 25.1, color: "var(--ps)" },
      { nom: "J-P. Vetter", parti: "LR", bord: "Droite", score: 23, color: "var(--lr)" },
      { nom: "J. Barseghian", parti: "EELV", bord: "Centre-gauche", score: 18.8, color: "var(--eco)" },
      { nom: "F. Kobryn", parti: "RN", bord: "Extrême droite", score: 11.8, color: "var(--rn)" }
    ]
  },
  "34172": {
    maireSortant: "Michaël Delafosse (PS)", status: "2t", bord: "gauche", participation: 51,
    note: "Delafosse nettement en tête — LFI et Altrad qualifiés",
    candidats: [
      { nom: "M. Delafosse", parti: "PS", bord: "Gauche", score: 32.8, color: "var(--ps)" },
      { nom: "N. Oziol", parti: "LFI", bord: "Extrême gauche", score: 16, color: "var(--lfi)" },
      { nom: "M. Altrad", parti: "DVC", bord: "Centre", score: 11.2, color: "var(--re)" }
    ]
  },
  "33063": {
    maireSortant: "Pierre Hurmic (EELV)", status: "2t", bord: "gauche", participation: 58.13,
    note: "Triangulaire Hurmic/Cazenave/Dessertine",
    candidats: [
      { nom: "P. Hurmic", parti: "EELV-PS-PCF", bord: "Gauche", score: 27.68, color: "var(--eco)" },
      { nom: "T. Cazenave", parti: "Renaissance", bord: "Centre", score: 25.58, color: "var(--re)" },
      { nom: "P. Dessertine", parti: "Liste citoyenne", bord: "Divers", score: 20.16, color: "var(--div)" },
      { nom: "N. Raymond", parti: "LFI", bord: "Extrême gauche", score: 9.36, color: "var(--lfi)" },
      { nom: "J. Rechagneux", parti: "RN", bord: "Extrême droite", score: 7.02, color: "var(--rn)" }
    ]
  },
  "59350": {
    maireSortant: "Arnaud Deslandes (PS)", status: "2t", bord: "gauche", participation: 56,
    note: "LFI talonne le PS — quinquangulaire historique",
    candidats: [
      { nom: "A. Deslandes", parti: "PS", bord: "Gauche", score: 26.26, color: "var(--ps)" },
      { nom: "L. Addouche", parti: "LFI", bord: "Extrême gauche", score: 23.73, color: "var(--lfi)" },
      { nom: "S. Baly", parti: "EELV", bord: "Centre-gauche", score: 17.12, color: "var(--eco)" },
      { nom: "V. Spillebout", parti: "Renaissance", bord: "Centre", score: 11.14, color: "var(--re)" },
      { nom: "M. Valet", parti: "RN", bord: "Extrême droite", score: 10.92, color: "var(--rn)" }
    ]
  },
  "35238": {
    maireSortant: "Nathalie Appéré (PS)", status: "2t", bord: "gauche", participation: 58,
    note: "Appéré largement en tête — RN et LR éliminés",
    candidats: [
      { nom: "N. Appéré", parti: "PS-EELV-PCF", bord: "Gauche", score: 34.9, color: "var(--ps)" },
      { nom: "C. Compagnon", parti: "Horizons-RE-MoDem", bord: "Centre", score: 21.9, color: "var(--re)" },
      { nom: "M. Mesmeur", parti: "LFI", bord: "Extrême gauche", score: 18.6, color: "var(--lfi)" }
    ]
  },
  "83137": {
    maireSortant: "Josée Massi (DVD)", status: "2t", bord: "rn", participation: 54,
    note: "RN (Lavalette) domine nettement — triangulaire",
    candidats: [
      { nom: "L. Lavalette", parti: "RN", bord: "Extrême droite", score: 41.7, color: "var(--rn)" },
      { nom: "J. Massi", parti: "DVD", bord: "Divers droite", score: 29.4, color: "var(--div)" },
      { nom: "M. Bonnus", parti: "LR-Horizons", bord: "Droite-Centre", score: 15.8, color: "var(--lr)" }
    ]
  },
  "76351": {
    maireSortant: "Édouard Philippe (Horizons)", status: "2t", bord: "droite", participation: 55,
    note: "Philippe largement en tête (43,76 %) — triangulaire",
    candidats: [
      { nom: "É. Philippe", parti: "Horizons", bord: "Centre", score: 43.76, color: "var(--re)" },
      { nom: "J-P. Lecoq", parti: "PCF-Gauche unie", bord: "Gauche", score: 33.25, color: "var(--pcf)" },
      { nom: "F. Keller", parti: "UDR-RN", bord: "Extrême droite", score: 15.3, color: "var(--rn)" }
    ]
  },
  "38185": {
    maireSortant: "Éric Piolle (EELV)", status: "2t", bord: "droite", participation: 54,
    note: "Surprise : Carignon (LR) devance de peu Ruffin",
    candidats: [
      { nom: "A. Carignon", parti: "LR", bord: "Droite", score: 27.04, color: "var(--lr)" },
      { nom: "L. Ruffin", parti: "Éco-PS-PCF", bord: "Gauche", score: 26.33, color: "var(--eco)" },
      { nom: "A. Brunon", parti: "LFI", bord: "Extrême gauche", score: 14.59, color: "var(--lfi)" }
    ]
  },
  "42218": {
    maireSortant: "Poste vacant (Gaël Perdriau démissionnaire)", status: "2t", bord: "gauche", participation: 52.38,
    note: "Première fois que le RN arrive 2e à Saint-Étienne",
    candidats: [
      { nom: "R. Juanico", parti: "Union de la gauche", bord: "Gauche", score: 29.16, color: "var(--ps)" },
      { nom: "C. Jousserand", parti: "RN", bord: "Extrême droite", score: 18.97, color: "var(--rn)" },
      { nom: "D. Cinieri", parti: "Union à droite", bord: "Droite", score: 16.30, color: "var(--lr)" },
      { nom: "V. Mercier", parti: "LFI", bord: "Extrême gauche", score: 13.29, color: "var(--lfi)" }
    ]
  },
  "66136": {
    maireSortant: "Louis Aliot (RN)", status: "elu", bord: "rn", participation: 53,
    note: "Réélu dès le 1er tour à la majorité absolue (50,61 %)",
    candidats: [
      { nom: "L. Aliot", parti: "RN", bord: "Extrême droite", score: 50.61, color: "var(--rn)" },
      { nom: "A. Langevine", parti: "PS", bord: "Gauche", score: 15.8, color: "var(--ps)" }
    ]
  },
  "62427": {
    maireSortant: "Steeve Briois (RN)", status: "elu", bord: "rn", participation: 55,
    note: "Victoire écrasante — 77,71 % (vs 74,2 % en 2020)",
    candidats: [
      { nom: "S. Briois", parti: "RN", bord: "Extrême droite", score: 77.71, color: "var(--rn)" },
      { nom: "I. Taourit", parti: "Union de la gauche", bord: "Gauche", score: 19.16, color: "var(--ps)" }
    ]
  },
  "59512": {
    maireSortant: "Alexandre Garcin (DVD)", status: "2t", bord: "gauche", participation: 48,
    note: "Guiraud (LFI) très largement en tête",
    candidats: [
      { nom: "D. Guiraud", parti: "LFI", bord: "Extrême gauche", score: 46.5, color: "var(--lfi)" },
      { nom: "A. Garcin", parti: "DVD", bord: "Divers droite", score: 20.3, color: "var(--div)" }
    ]
  },
  "93066": {
    maireSortant: "Mathieu Hanotin (PS)", status: "elu", bord: "gauche", participation: 45,
    note: "LFI conquiert Saint-Denis dès le 1er tour",
    candidats: [
      { nom: "B. Bagayoko", parti: "LFI-PCF", bord: "Extrême gauche", score: 50.88, color: "var(--lfi)" },
      { nom: "M. Hanotin", parti: "PS", bord: "Gauche", score: 32.53, color: "var(--ps)" }
    ]
  },
  "83061": {
    maireSortant: "David Rachline (RN)", status: "elu", bord: "rn", participation: 55,
    note: "Rachline réélu dès le 1er tour (51,33 %)",
    candidats: [
      { nom: "D. Rachline", parti: "RN", bord: "Extrême droite", score: 51.33, color: "var(--rn)" }
    ]
  },
  "34032": {
    maireSortant: "Robert Ménard (DVD, soutenu LR)", status: "elu", bord: "droite", participation: 52,
    note: "Ménard réélu avec 65,6 %",
    candidats: [
      { nom: "R. Ménard", parti: "DVD (soutenu LR)", bord: "Droite", score: 65.6, color: "var(--lr)" }
    ]
  },
  "06027": {
    maireSortant: "Louis Nègre (LR, 30 ans)", status: "elu", bord: "rn", participation: 54,
    note: "Le RN détrône un maire LR en poste depuis 30 ans",
    candidats: [
      { nom: "B. Masson", parti: "RN", bord: "Extrême droite", score: 50.21, color: "var(--rn)" },
      { nom: "L. Nègre", parti: "LR", bord: "Droite", score: 49.79, color: "var(--lr)" }
    ]
  },
  "62193": {
    maireSortant: "Natacha Bouchart (LR)", status: "elu", bord: "droite", participation: 52,
    note: "Bouchart réélue dès le 1er tour (59,5 %)",
    candidats: [
      { nom: "N. Bouchart", parti: "LR", bord: "Droite", score: 59.5, color: "var(--lr)" }
    ]
  },
  "30189": {
    maireSortant: "Jean-Paul Fournier (LR)", status: "2t", bord: "indecis", participation: 54,
    note: "Coude-à-coude RN vs Gauche unie",
    candidats: [
      { nom: "J. Sanchez", parti: "RN", bord: "Extrême droite", score: 30.5, color: "var(--rn)" },
      { nom: "V. Bouget", parti: "PCF-PS-Éco", bord: "Gauche", score: 30.5, color: "var(--pcf)" }
    ]
  },
  "87085": {
    maireSortant: "Émile-Roger Lombertie (LR)", status: "2t", bord: "droite", participation: 52,
    note: "Guérin (LR) devance LFI-Éco de peu",
    candidats: [
      { nom: "G. Guérin", parti: "LR", bord: "Droite", score: 27.34, color: "var(--lr)" },
      { nom: "D. Maudet", parti: "LFI-Éco", bord: "Extrême gauche", score: 24.86, color: "var(--lfi)" }
    ]
  },
  "06083": {
    maireSortant: "Sandra Paire (DVD)", status: "2t", bord: "rn", participation: 52,
    note: "RN en tête — Louis Sarkozy à 18 %",
    candidats: [
      { nom: "A. Masson", parti: "RN", bord: "Extrême droite", score: 36.24, color: "var(--rn)" },
      { nom: "S. Paire", parti: "DVD", bord: "Divers droite", score: 19.74, color: "var(--div)" },
      { nom: "L. Sarkozy", parti: "Divers", bord: "Droite", score: 18.01, color: "var(--lr)" }
    ]
  }
};

// Initialize RESULTS_DB with top cities
Object.entries(TOP_CITIES).forEach(([code, data]) => { RESULTS_DB[code] = data; });

// Fallback geo data for top cities
const GEO_FALLBACK = {
  "75056": { nom: "Paris", pop: 2133111, lat: 48.8566, lng: 2.3522, dept: "Paris" },
  "13055": { nom: "Marseille", pop: 873076, lat: 43.2965, lng: 5.3698, dept: "Bouches-du-Rhône" },
  "69123": { nom: "Lyon", pop: 516092, lat: 45.764, lng: 4.8357, dept: "Rhône" },
  "31555": { nom: "Toulouse", pop: 479553, lat: 43.6047, lng: 1.4442, dept: "Haute-Garonne" },
  "06088": { nom: "Nice", pop: 342669, lat: 43.7102, lng: 7.262, dept: "Alpes-Maritimes" },
  "44109": { nom: "Nantes", pop: 314138, lat: 47.2184, lng: -1.5536, dept: "Loire-Atlantique" },
  "67482": { nom: "Strasbourg", pop: 284677, lat: 48.5734, lng: 7.7521, dept: "Bas-Rhin" },
  "34172": { nom: "Montpellier", pop: 285121, lat: 43.6108, lng: 3.8767, dept: "Hérault" },
  "33063": { nom: "Bordeaux", pop: 254436, lat: 44.8378, lng: -0.5792, dept: "Gironde" },
  "59350": { nom: "Lille", pop: 234475, lat: 50.6292, lng: 3.0573, dept: "Nord" },
  "35238": { nom: "Rennes", pop: 222485, lat: 48.1173, lng: -1.6778, dept: "Ille-et-Vilaine" },
  "83137": { nom: "Toulon", pop: 176198, lat: 43.1242, lng: 5.928, dept: "Var" },
  "76351": { nom: "Le Havre", pop: 172074, lat: 49.4944, lng: 0.1079, dept: "Seine-Maritime" },
  "38185": { nom: "Grenoble", pop: 158198, lat: 45.1885, lng: 5.7245, dept: "Isère" },
  "42218": { nom: "Saint-Étienne", pop: 174082, lat: 45.4397, lng: 4.3872, dept: "Loire" },
  "66136": { nom: "Perpignan", pop: 120605, lat: 42.6886, lng: 2.8948, dept: "Pyrénées-Orientales" },
  "62427": { nom: "Hénin-Beaumont", pop: 26042, lat: 50.4226, lng: 2.9503, dept: "Pas-de-Calais" },
  "59512": { nom: "Roubaix", pop: 98828, lat: 50.6942, lng: 3.1746, dept: "Nord" },
  "93066": { nom: "Saint-Denis", pop: 113134, lat: 48.9362, lng: 2.3574, dept: "Seine-Saint-Denis" },
  "83061": { nom: "Fréjus", pop: 54458, lat: 43.4332, lng: 6.7370, dept: "Var" },
  "34032": { nom: "Béziers", pop: 78683, lat: 43.3440, lng: 3.2190, dept: "Hérault" },
  "06027": { nom: "Cagnes-sur-Mer", pop: 52178, lat: 43.6638, lng: 7.1489, dept: "Alpes-Maritimes" },
  "62193": { nom: "Calais", pop: 73911, lat: 50.9481, lng: 1.8564, dept: "Pas-de-Calais" },
  "30189": { nom: "Nîmes", pop: 151001, lat: 43.8367, lng: 4.3601, dept: "Gard" },
  "87085": { nom: "Limoges", pop: 132175, lat: 45.8336, lng: 1.2611, dept: "Haute-Vienne" },
  "06083": { nom: "Menton", pop: 30231, lat: 43.7764, lng: 7.5048, dept: "Alpes-Maritimes" }
};

// ===== LOAD DEPARTMENT RESULTS ON DEMAND =====
function getDeptCode(inseeCode) {
  if (inseeCode.startsWith('97')) return inseeCode.substring(0, 3);
  if (inseeCode.startsWith('2A') || inseeCode.startsWith('2B')) return inseeCode.substring(0, 2);
  return inseeCode.substring(0, 2);
}

async function loadDeptResults(deptCode) {
  if (DEPT_CACHE[deptCode]) return DEPT_CACHE[deptCode];
  if (DEPT_LOADING[deptCode]) return DEPT_LOADING[deptCode];

  DEPT_LOADING[deptCode] = (async () => {
    try {
      const resp = await fetch('data/dept/' + deptCode + '.json', {
        signal: AbortSignal.timeout(10000)
      });
      if (!resp.ok) return null;
      const data = await resp.json();
      DEPT_CACHE[deptCode] = data;

      // Populate RESULTS_DB for all communes in this department
      data.communes.forEach(c => {
        // Don't override curated top cities
        if (TOP_CITIES[c.code]) return;
        RESULTS_DB[c.code] = {
          status: c.status,
          bord: c.bord,
          participation: c.participation,
          candidats: c.candidats,
          note: null
        };
      });

      console.log('Loaded dept ' + deptCode + ': ' + data.communes.length + ' communes');
      return data;
    } catch (e) {
      console.log('Failed to load dept ' + deptCode + ':', e);
      return null;
    } finally {
      delete DEPT_LOADING[deptCode];
    }
  })();

  return DEPT_LOADING[deptCode];
}

// Load results for a specific commune (fetches its department if needed)
async function loadCommuneResults(inseeCode) {
  if (RESULTS_DB[inseeCode]) return RESULTS_DB[inseeCode];
  const deptCode = getDeptCode(inseeCode);
  await loadDeptResults(deptCode);
  return RESULTS_DB[inseeCode] || null;
}

// Search communes within loaded department data
function searchInDeptCache(query) {
  const q = query.toLowerCase();
  const results = [];
  Object.values(DEPT_CACHE).forEach(dept => {
    dept.communes.forEach(c => {
      if (c.nom.toLowerCase().includes(q)) {
        results.push({ code: c.code, nom: c.nom, dept: dept.nom, inscrits: c.inscrits });
      }
    });
  });
  return results.sort((a, b) => (b.inscrits || 0) - (a.inscrits || 0)).slice(0, 20);
}
