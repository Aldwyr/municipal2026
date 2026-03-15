// ===== CONFIGURATION =====
const BORD_COLORS = {
  gauche: '#FF6B6B', droite: '#1976D2', centre: '#FF9800',
  rn: '#5C6BC0', eco: '#4CAF50', lfi: '#9B59B6', indecis: '#90A4AE'
};

const BORD_FAMILIES = {
  gauche: ['Gauche', 'Centre-gauche', 'Extrême gauche', 'Divers gauche'],
  droite: ['Droite', 'Droite-Centre', 'Centre-droit', 'Centre', 'Divers droite', 'Droite souverainiste', 'Divers'],
  rn: ['Extrême droite']
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

// Which parties belong to which legend chip (for legend filtering)
const LEGEND_PARTY_MAP = {
  PS:   ['PS', 'PS-PCF-Éco', 'PS-EELV-PCF', 'PS-PCF', 'PS-Union gauche'],
  LFI:  ['LFI', 'LFI-Éco'],
  PCF:  ['PCF', 'PCF-Gauche unie'],
  EELV: ['EELV', 'EELV-Union gauche', 'EELV-PS-PCF', 'Écologistes', 'Union gauche hors LFI'],
  LR:   ['LR', 'LR-RE-Horizons', 'LR-RE', 'LR-Horizons', 'DVD-LR-RE'],
  RE:   ['Renaissance', 'Horizons', 'RE', 'MoDem', 'Horizons-RE-MoDem', 'LR-RE-Horizons'],
  RN:   ['RN', 'RN-UDR', 'UDR-RN'],
  UDR:  ['UDR', 'UDR (allié RN)'],
  REC:  ['Reconquête'],
  DIV:  ['DVD', 'DVG', 'DIV', 'Divers', 'Sans étiquette', 'Droite-Macronie']
};

const IS_DEFINITIF = false;
const REFRESH_INTERVAL = 5 * 60 * 1000;

// ===== RESULTS DB (keyed by INSEE code) =====
const RESULTS_DB = {
  "75056": {
    maireSortant: "Anne Hidalgo (PS)", status: "2t", bord: "gauche", participation: 44.01,
    note: "Quinquangulaire inédite — second tour le 22 mars",
    candidats: [
      { nom: "E. Grégoire", parti: "PS", bord: "Gauche", score: 36.5, color: "var(--ps)" },
      { nom: "R. Dati", parti: "LR", bord: "Droite", score: 24.9, color: "var(--lr)" },
      { nom: "S. Chikirou", parti: "LFI", bord: "Extrême gauche", score: 13.7, color: "var(--lfi)" },
      { nom: "P-Y. Bournazel", parti: "Horizons", bord: "Centre", score: 11.8, color: "var(--re)" },
      { nom: "S. Knafo", parti: "Reconquête", bord: "Extrême droite", score: 9, color: "var(--rec)" }
    ]
  },
  "13055": {
    maireSortant: "Benoît Payan (PS)", status: "2t", bord: "indecis", participation: 52,
    note: "Payan et Allisio à égalité — duel serré",
    candidats: [
      { nom: "B. Payan", parti: "PS-PCF-Éco", bord: "Gauche", score: 34.5, color: "var(--ps)" },
      { nom: "F. Allisio", parti: "RN", bord: "Extrême droite", score: 34.5, color: "var(--rn)" },
      { nom: "M. Vassal", parti: "DVD-LR-RE", bord: "Droite-Centre", score: 19, color: "var(--lr)" },
      { nom: "S. Delogu", parti: "LFI", bord: "Extrême gauche", score: 10, color: "var(--lfi)" }
    ]
  },
  "69123": {
    maireSortant: "Grégory Doucet (EELV)", status: "2t", bord: "gauche", participation: 63.9,
    note: "Surprise : Doucet devance Aulas malgré les sondages",
    candidats: [
      { nom: "G. Doucet", parti: "EELV-Union gauche", bord: "Gauche", score: 37.3, color: "var(--eco)" },
      { nom: "J-M. Aulas", parti: "LR-RE-Horizons", bord: "Droite-Centre", score: 35.4, color: "var(--lr)" },
      { nom: "A. Belouassa-Cherifi", parti: "LFI", bord: "Extrême gauche", score: 10.9, color: "var(--lfi)" },
      { nom: "A. Dupalais", parti: "RN-UDR", bord: "Extrême droite", score: 7.5, color: "var(--rn)" }
    ]
  },
  "31555": {
    maireSortant: "Jean-Luc Moudenc (LR-Horizons)", status: "2t", bord: "droite", participation: 56.5,
    note: "Moudenc en tête — Piquemal (LFI) devance l'union de la gauche",
    candidats: [
      { nom: "J-L. Moudenc", parti: "LR-RE-Horizons", bord: "Droite-Centre", score: 37.3, color: "var(--lr)" },
      { nom: "F. Piquemal", parti: "LFI", bord: "Extrême gauche", score: 27.2, color: "var(--lfi)" },
      { nom: "F. Briançon", parti: "PS-Union gauche", bord: "Gauche", score: 24.7, color: "var(--ps)" }
    ]
  },
  "06088": {
    maireSortant: "Christian Estrosi (Horizons)", status: "2t", bord: "rn", participation: 53.8,
    note: "Ciotti (UDR/RN) devance nettement Estrosi",
    candidats: [
      { nom: "É. Ciotti", parti: "UDR (allié RN)", bord: "Droite souverainiste", score: 41.9, color: "var(--udr)" },
      { nom: "C. Estrosi", parti: "Horizons", bord: "Centre-droit", score: 31, color: "var(--re)" },
      { nom: "J. Chesnel-Le Roux", parti: "Gauche unie", bord: "Gauche", score: 12.2, color: "var(--ps)" }
    ]
  },
  "44109": {
    maireSortant: "Johanna Rolland (PS)", status: "2t", bord: "gauche", participation: 59.8,
    note: "Rolland en tête",
    candidats: [
      { nom: "J. Rolland", parti: "PS", bord: "Gauche", score: 38, color: "var(--ps)" },
      { nom: "Candidat droite-centre", parti: "LR-RE", bord: "Droite-Centre", score: 31, color: "var(--lr)" }
    ]
  },
  "67482": {
    maireSortant: "Jeanne Barseghian (EELV)", status: "2t", bord: "gauche", participation: 56.9,
    note: "Trautmann devance la maire sortante — possible quadrangulaire",
    candidats: [
      { nom: "C. Trautmann", parti: "PS", bord: "Gauche", score: 25.1, color: "var(--ps)" },
      { nom: "J-P. Vetter", parti: "LR", bord: "Droite", score: 23, color: "var(--lr)" },
      { nom: "J. Barseghian", parti: "EELV", bord: "Centre-gauche", score: 18.8, color: "var(--eco)" },
      { nom: "F. Kobryn", parti: "RN", bord: "Extrême droite", score: 11.8, color: "var(--rn)" }
    ]
  },
  "34172": {
    maireSortant: "Michaël Delafosse (PS)", status: "2t", bord: "gauche", participation: 49.5,
    note: "13 listes dont 6 à gauche — résultats en cours",
    candidats: [
      { nom: "M. Delafosse", parti: "PS", bord: "Gauche", score: null, color: "var(--ps)" }
    ]
  },
  "33063": {
    maireSortant: "Pierre Hurmic (EELV)", status: "2t", bord: "gauche", participation: 58.1,
    note: "Hurmic en tête d'un cheveu devant Cazenave",
    candidats: [
      { nom: "P. Hurmic", parti: "EELV-PS-PCF", bord: "Gauche", score: 27.7, color: "var(--eco)" },
      { nom: "T. Cazenave", parti: "Renaissance", bord: "Centre", score: 25, color: "var(--re)" },
      { nom: "P. Dessertine", parti: "Sans étiquette", bord: "Divers", score: 19.9, color: "var(--div)" }
    ]
  },
  "59350": {
    maireSortant: "Martine Aubry (PS) — Deslandes", status: "2t", bord: "gauche", participation: 52.7,
    note: "LFI en tête devant le PS — 5 listes qualifiées",
    candidats: [
      { nom: "L. Addouche", parti: "LFI", bord: "Extrême gauche", score: 31.3, color: "var(--lfi)" },
      { nom: "A. Deslandes", parti: "PS-PCF", bord: "Gauche", score: 26, color: "var(--ps)" },
      { nom: "S. Baly", parti: "EELV", bord: "Centre-gauche", score: 14.1, color: "var(--eco)" },
      { nom: "V. Spillebout", parti: "Renaissance", bord: "Centre", score: 11.3, color: "var(--re)" }
    ]
  },
  "35238": {
    maireSortant: "Nathalie Appéré (PS)", status: "2t", bord: "gauche", participation: 59.3,
    note: "Appéré largement en tête",
    candidats: [
      { nom: "N. Appéré", parti: "PS-EELV-PCF", bord: "Gauche", score: 34.1, color: "var(--ps)" },
      { nom: "C. Compagnon", parti: "Horizons-RE-MoDem", bord: "Centre", score: 22, color: "var(--re)" },
      { nom: "M. Mesmeur", parti: "LFI", bord: "Extrême gauche", score: 19.1, color: "var(--lfi)" }
    ]
  },
  "83137": {
    maireSortant: "Hubert Falco (DVD)", status: "2t", bord: "rn", participation: 56.5,
    note: "RN largement en tête — gauche éliminée",
    candidats: [
      { nom: "L. Lavalette", parti: "RN", bord: "Extrême droite", score: 42, color: "var(--rn)" },
      { nom: "J. Massi", parti: "DVD", bord: "Divers droite", score: 28.1, color: "var(--div)" },
      { nom: "M. Bonnus", parti: "LR-Horizons", bord: "Droite-Centre", score: 16.5, color: "var(--lr)" }
    ]
  },
  "76351": {
    maireSortant: "Édouard Philippe (Horizons)", status: "2t", bord: "droite", participation: 55,
    note: "Philippe largement en tête — triangulaire",
    candidats: [
      { nom: "É. Philippe", parti: "Horizons", bord: "Centre", score: 43.8, color: "var(--re)" },
      { nom: "J-P. Lecoq", parti: "PCF-Gauche unie", bord: "Gauche", score: 33.3, color: "var(--pcf)" },
      { nom: "F. Keller", parti: "UDR-RN", bord: "Extrême droite", score: 15.3, color: "var(--rn)" }
    ]
  },
  "38185": {
    maireSortant: "Éric Piolle (EELV)", status: "2t", bord: "gauche", participation: 55,
    note: "Ruffin vs Carignon — résultats en cours",
    candidats: [
      { nom: "L. Ruffin", parti: "Union gauche hors LFI", bord: "Gauche", score: null, color: "var(--eco)" },
      { nom: "A. Carignon", parti: "Droite-Macronie", bord: "Droite-Centre", score: null, color: "var(--lr)" }
    ]
  },
  "66136": {
    maireSortant: "Louis Aliot (RN)", status: "elu", bord: "rn", participation: 55,
    note: "Réélu dès le 1er tour à la majorité absolue",
    candidats: [
      { nom: "L. Aliot", parti: "RN", bord: "Extrême droite", score: 51.4, color: "var(--rn)" },
      { nom: "A. Langevine", parti: "PS", bord: "Gauche", score: 15.8, color: "var(--ps)" },
      { nom: "B. Nougayrède", parti: "DVD", bord: "Divers droite", score: 13, color: "var(--div)" },
      { nom: "M. Idrac", parti: "LFI-Éco", bord: "Extrême gauche", score: 9.7, color: "var(--lfi)" }
    ]
  },
  "62427": {
    maireSortant: "Steeve Briois (RN)", status: "elu", bord: "rn", participation: 55,
    note: "Victoire écrasante — 78,3 %",
    candidats: [
      { nom: "S. Briois", parti: "RN", bord: "Extrême droite", score: 78.3, color: "var(--rn)" }
    ]
  },
  "59512": {
    maireSortant: "Alexandre Garcin (DVD)", status: "2t", bord: "gauche", participation: 45,
    note: "Guiraud (LFI) très largement en tête",
    candidats: [
      { nom: "D. Guiraud", parti: "LFI", bord: "Extrême gauche", score: 46.5, color: "var(--lfi)" },
      { nom: "A. Garcin", parti: "DVD", bord: "Divers droite", score: 20.3, color: "var(--div)" },
      { nom: "K. Amrouni", parti: "DVG", bord: "Divers gauche", score: 16.7, color: "var(--ps)" },
      { nom: "C. Sayah", parti: "RN", bord: "Extrême droite", score: 12.2, color: "var(--rn)" }
    ]
  }
};

// Fallback geo data when API is unavailable
const GEO_FALLBACK = {
  "75056": { nom: "Paris", pop: 2133111, lat: 48.8566, lng: 2.3522, dept: "Île-de-France" },
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
  "66136": { nom: "Perpignan", pop: 120605, lat: 42.6886, lng: 2.8948, dept: "Pyrénées-Orientales" },
  "62427": { nom: "Hénin-Beaumont", pop: 26042, lat: 50.4226, lng: 2.9503, dept: "Pas-de-Calais" },
  "59512": { nom: "Roubaix", pop: 98828, lat: 50.6942, lng: 3.1746, dept: "Nord" }
};
