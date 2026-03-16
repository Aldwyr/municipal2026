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

const LEGEND_PARTY_MAP = {
  PS:   ['PS', 'PS-PCF-Éco', 'PS-EELV-PCF', 'PS-PCF', 'PS-Union gauche', 'PS-Éco-PCF', 'DVG (PS-Éco)', 'Union de la gauche'],
  LFI:  ['LFI', 'LFI-Éco', 'LFI-PCF', 'LFI-Éco-PCF'],
  PCF:  ['PCF', 'PCF-Gauche unie', 'PCF-PS-Éco'],
  EELV: ['EELV', 'EELV-Union gauche', 'EELV-PS-PCF', 'Écologistes', 'Union gauche hors LFI', 'Éco-PS-PCF'],
  LR:   ['LR', 'LR-RE-Horizons', 'LR-RE', 'LR-Horizons', 'DVD-LR-RE', 'LR-MoDem', 'Union à droite'],
  RE:   ['Renaissance', 'Horizons', 'RE', 'MoDem', 'Horizons-RE-MoDem', 'LR-RE-Horizons'],
  RN:   ['RN', 'RN-UDR', 'UDR-RN'],
  UDR:  ['UDR', 'UDR (allié RN)', 'UDR-RN'],
  REC:  ['Reconquête'],
  DIV:  ['DVD', 'DVG', 'DIV', 'Divers', 'Sans étiquette', 'Droite-Macronie', 'DVC', 'Liste citoyenne']
};

const IS_DEFINITIF = false;
const REFRESH_INTERVAL = 5 * 60 * 1000;

// ===== RESULTS DB (keyed by INSEE code) — Données vérifiées du 1er tour (15 mars 2026) =====
const RESULTS_DB = {
  // ===== PARIS =====
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
  // ===== MARSEILLE =====
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
  // ===== LYON =====
  "69123": {
    maireSortant: "Grégory Doucet (EELV)", status: "2t", bord: "gauche", participation: 57,
    note: "Énorme surprise : Doucet à égalité avec Aulas, donné favori dans les sondages",
    candidats: [
      { nom: "G. Doucet", parti: "EELV-PS-PCF", bord: "Gauche", score: 36.8, color: "var(--eco)" },
      { nom: "J-M. Aulas", parti: "LR-RE-Horizons", bord: "Droite-Centre", score: 36.8, color: "var(--lr)" },
      { nom: "A. Belouassa-Cherifi", parti: "LFI", bord: "Extrême gauche", score: 10.9, color: "var(--lfi)" },
      { nom: "A. Dupalais", parti: "RN-UDR", bord: "Extrême droite", score: 7.5, color: "var(--rn)" }
    ]
  },
  // ===== TOULOUSE =====
  "31555": {
    maireSortant: "Jean-Luc Moudenc (DVD)", status: "2t", bord: "droite", participation: 57.4,
    note: "Surprise : LFI (Piquemal) devance le PS — RN éliminé — triangulaire",
    candidats: [
      { nom: "J-L. Moudenc", parti: "LR-RE-Horizons", bord: "Droite-Centre", score: 37.23, color: "var(--lr)" },
      { nom: "F. Piquemal", parti: "LFI", bord: "Extrême gauche", score: 27.56, color: "var(--lfi)" },
      { nom: "F. Briançon", parti: "PS-EELV-PCF", bord: "Gauche", score: 24.99, color: "var(--ps)" },
      { nom: "J. Léonardelli", parti: "RN-UDR", bord: "Extrême droite", score: 5.9, color: "var(--rn)" },
      { nom: "L. Meilhac", parti: "Divers", bord: "Divers", score: 1.5, color: "var(--div)" },
      { nom: "A. Cottrel", parti: "Reconquête", bord: "Extrême droite", score: 1.3, color: "var(--rec)" }
    ]
  },
  // ===== NICE =====
  "06088": {
    maireSortant: "Christian Estrosi (Horizons)", status: "2t", bord: "rn", participation: 53.91,
    note: "Ciotti (UDR-RN) devance très largement Estrosi — triangulaire",
    candidats: [
      { nom: "É. Ciotti", parti: "UDR-RN", bord: "Extrême droite", score: 43.43, color: "var(--rn)" },
      { nom: "C. Estrosi", parti: "Horizons-LR", bord: "Centre-droit", score: 30.92, color: "var(--re)" },
      { nom: "J. Chesnel-Le Roux", parti: "Éco-PS-PCF", bord: "Gauche", score: 11.93, color: "var(--ps)" },
      { nom: "M. Damiano", parti: "LFI", bord: "Extrême gauche", score: 8.95, color: "var(--lfi)" },
      { nom: "C. Vella", parti: "Reconquête", bord: "Extrême droite", score: 1.86, color: "var(--rec)" }
    ]
  },
  // ===== NANTES =====
  "44109": {
    maireSortant: "Johanna Rolland (PS)", status: "2t", bord: "gauche", participation: 59.8,
    note: "Duel serré PS/Droite — LFI qualifiée",
    candidats: [
      { nom: "J. Rolland", parti: "PS", bord: "Gauche", score: 35, color: "var(--ps)" },
      { nom: "F. Chombart de Lauwe", parti: "DVD", bord: "Droite", score: 33.1, color: "var(--lr)" },
      { nom: "W. Aucant", parti: "LFI", bord: "Extrême gauche", score: 12, color: "var(--lfi)" }
    ]
  },
  // ===== STRASBOURG =====
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
  // ===== MONTPELLIER =====
  "34172": {
    maireSortant: "Michaël Delafosse (PS)", status: "2t", bord: "gauche", participation: 51,
    note: "Delafosse nettement en tête — LFI et Altrad qualifiés",
    candidats: [
      { nom: "M. Delafosse", parti: "PS", bord: "Gauche", score: 32.8, color: "var(--ps)" },
      { nom: "N. Oziol", parti: "LFI", bord: "Extrême gauche", score: 16, color: "var(--lfi)" },
      { nom: "M. Altrad", parti: "DVC", bord: "Centre", score: 11.2, color: "var(--re)" }
    ]
  },
  // ===== BORDEAUX =====
  "33063": {
    maireSortant: "Pierre Hurmic (EELV)", status: "2t", bord: "gauche", participation: 58.13,
    note: "Triangulaire Hurmic/Cazenave/Dessertine — Dessertine refuse les alliances",
    candidats: [
      { nom: "P. Hurmic", parti: "EELV-PS-PCF", bord: "Gauche", score: 27.68, color: "var(--eco)" },
      { nom: "T. Cazenave", parti: "Renaissance", bord: "Centre", score: 25.58, color: "var(--re)" },
      { nom: "P. Dessertine", parti: "Liste citoyenne", bord: "Divers", score: 20.16, color: "var(--div)" },
      { nom: "N. Raymond", parti: "LFI", bord: "Extrême gauche", score: 9.36, color: "var(--lfi)" },
      { nom: "J. Rechagneux", parti: "RN", bord: "Extrême droite", score: 7.02, color: "var(--rn)" },
      { nom: "P. Poutou", parti: "NPA", bord: "Extrême gauche", score: 5.14, color: "var(--lfi)" },
      { nom: "V. Bonthoux-Tournay", parti: "Reconquête", bord: "Extrême droite", score: 1.81, color: "var(--rec)" }
    ]
  },
  // ===== LILLE =====
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
  // ===== RENNES =====
  "35238": {
    maireSortant: "Nathalie Appéré (PS)", status: "2t", bord: "gauche", participation: 58,
    note: "Appéré largement en tête — RN et LR éliminés",
    candidats: [
      { nom: "N. Appéré", parti: "PS-EELV-PCF", bord: "Gauche", score: 34.9, color: "var(--ps)" },
      { nom: "C. Compagnon", parti: "Horizons-RE-MoDem", bord: "Centre", score: 21.9, color: "var(--re)" },
      { nom: "M. Mesmeur", parti: "LFI", bord: "Extrême gauche", score: 18.6, color: "var(--lfi)" },
      { nom: "J. Masson", parti: "RN", bord: "Extrême droite", score: 6.7, color: "var(--rn)" },
      { nom: "T. Rousseau", parti: "LR", bord: "Droite", score: 6.4, color: "var(--lr)" }
    ]
  },
  // ===== TOULON =====
  "83137": {
    maireSortant: "Josée Massi (DVD)", status: "2t", bord: "rn", participation: 54,
    note: "RN (Lavalette) domine nettement — triangulaire, possible barrage droite",
    candidats: [
      { nom: "L. Lavalette", parti: "RN", bord: "Extrême droite", score: 41.7, color: "var(--rn)" },
      { nom: "J. Massi", parti: "DVD", bord: "Divers droite", score: 29.4, color: "var(--div)" },
      { nom: "M. Bonnus", parti: "LR-Horizons", bord: "Droite-Centre", score: 15.8, color: "var(--lr)" },
      { nom: "Union gauche", parti: "PS-Éco", bord: "Gauche", score: 8.4, color: "var(--ps)" },
      { nom: "Candidat LFI", parti: "LFI", bord: "Extrême gauche", score: 4.2, color: "var(--lfi)" }
    ]
  },
  // ===== LE HAVRE =====
  "76351": {
    maireSortant: "Édouard Philippe (Horizons)", status: "2t", bord: "droite", participation: 55,
    note: "Philippe largement en tête (43,76 %) — triangulaire",
    candidats: [
      { nom: "É. Philippe", parti: "Horizons", bord: "Centre", score: 43.76, color: "var(--re)" },
      { nom: "J-P. Lecoq", parti: "PCF-Gauche unie", bord: "Gauche", score: 33.25, color: "var(--pcf)" },
      { nom: "F. Keller", parti: "UDR-RN", bord: "Extrême droite", score: 15.3, color: "var(--rn)" }
    ]
  },
  // ===== GRENOBLE =====
  "38185": {
    maireSortant: "Éric Piolle (EELV)", status: "2t", bord: "droite", participation: 54,
    note: "Surprise : Carignon (LR, ancien maire condamné) devance de peu Ruffin",
    candidats: [
      { nom: "A. Carignon", parti: "LR", bord: "Droite", score: 27.04, color: "var(--lr)" },
      { nom: "L. Ruffin", parti: "Éco-PS-PCF", bord: "Gauche", score: 26.33, color: "var(--eco)" },
      { nom: "A. Brunon", parti: "LFI", bord: "Extrême gauche", score: 14.59, color: "var(--lfi)" },
      { nom: "R. Gentil", parti: "Place Publique", bord: "Gauche", score: 10, color: "var(--ps)" },
      { nom: "H. Gerbi", parti: "Horizons", bord: "Centre", score: 9.63, color: "var(--re)" },
      { nom: "V. Gabriac", parti: "RN", bord: "Extrême droite", score: 5.2, color: "var(--rn)" },
      { nom: "T. Simon", parti: "Liste citoyenne", bord: "Divers", score: 4.98, color: "var(--div)" }
    ]
  },
  // ===== SAINT-ÉTIENNE =====
  "42218": {
    maireSortant: "Poste vacant (Gaël Perdriau démissionnaire)", status: "2t", bord: "gauche", participation: 52.38,
    note: "Première fois que le RN arrive 2e à Saint-Étienne — quadrangulaire historique",
    candidats: [
      { nom: "R. Juanico", parti: "Union de la gauche", bord: "Gauche", score: 29.16, color: "var(--ps)" },
      { nom: "C. Jousserand", parti: "RN", bord: "Extrême droite", score: 18.97, color: "var(--rn)" },
      { nom: "D. Cinieri", parti: "Union à droite", bord: "Droite", score: 16.30, color: "var(--lr)" },
      { nom: "V. Mercier", parti: "LFI", bord: "Extrême gauche", score: 13.29, color: "var(--lfi)" },
      { nom: "S. Labich", parti: "Divers", bord: "Divers", score: 9.36, color: "var(--div)" },
      { nom: "M. Chassaubéné", parti: "DVD", bord: "Divers droite", score: 6.72, color: "var(--div)" }
    ]
  },
  // ===== PERPIGNAN =====
  "66136": {
    maireSortant: "Louis Aliot (RN)", status: "elu", bord: "rn", participation: 53,
    note: "Réélu dès le 1er tour à la majorité absolue (50,61 %)",
    candidats: [
      { nom: "L. Aliot", parti: "RN", bord: "Extrême droite", score: 50.61, color: "var(--rn)" },
      { nom: "A. Langevine", parti: "PS", bord: "Gauche", score: 15.8, color: "var(--ps)" },
      { nom: "B. Nougayrède", parti: "DVD", bord: "Divers droite", score: 13, color: "var(--div)" },
      { nom: "M. Idrac", parti: "LFI-Éco", bord: "Extrême gauche", score: 9.7, color: "var(--lfi)" }
    ]
  },
  // ===== HÉNIN-BEAUMONT =====
  "62427": {
    maireSortant: "Steeve Briois (RN)", status: "elu", bord: "rn", participation: 55,
    note: "Victoire écrasante — 77,71 % (vs 74,2 % en 2020)",
    candidats: [
      { nom: "S. Briois", parti: "RN", bord: "Extrême droite", score: 77.71, color: "var(--rn)" },
      { nom: "I. Taourit", parti: "Union de la gauche", bord: "Gauche", score: 19.16, color: "var(--ps)" },
      { nom: "H. Benhadja", parti: "LFI", bord: "Extrême gauche", score: 3.14, color: "var(--lfi)" }
    ]
  },
  // ===== ROUBAIX =====
  "59512": {
    maireSortant: "Alexandre Garcin (DVD)", status: "2t", bord: "gauche", participation: 48,
    note: "Guiraud (LFI) très largement en tête — si élu, plus grande commune LFI de France",
    candidats: [
      { nom: "D. Guiraud", parti: "LFI", bord: "Extrême gauche", score: 46.5, color: "var(--lfi)" },
      { nom: "A. Garcin", parti: "DVD", bord: "Divers droite", score: 20.3, color: "var(--div)" },
      { nom: "K. Amrouni", parti: "DVG", bord: "Divers gauche", score: 16.7, color: "var(--ps)" },
      { nom: "C. Sayah", parti: "RN", bord: "Extrême droite", score: 12.2, color: "var(--rn)" }
    ]
  },
  // ===== SAINT-DENIS =====
  "93066": {
    maireSortant: "Mathieu Hanotin (PS)", status: "elu", bord: "gauche", participation: 45,
    note: "LFI conquiert Saint-Denis dès le 1er tour — 2e ville d'Île-de-France",
    candidats: [
      { nom: "B. Bagayoko", parti: "LFI-PCF", bord: "Extrême gauche", score: 50.88, color: "var(--lfi)" },
      { nom: "M. Hanotin", parti: "PS", bord: "Gauche", score: 32.53, color: "var(--ps)" }
    ]
  },
  // ===== FRÉJUS =====
  "83061": {
    maireSortant: "David Rachline (RN)", status: "elu", bord: "rn", participation: 55,
    note: "Rachline réélu dès le 1er tour (51,33 %)",
    candidats: [
      { nom: "D. Rachline", parti: "RN", bord: "Extrême droite", score: 51.33, color: "var(--rn)" },
      { nom: "E. Bonnemain", parti: "DVD", bord: "Divers droite", score: 29.94, color: "var(--div)" }
    ]
  },
  // ===== BÉZIERS =====
  "34032": {
    maireSortant: "Robert Ménard (DVD, soutenu LR)", status: "elu", bord: "droite", participation: 52,
    note: "Ménard réélu avec 65,6 % — première candidature RN contre lui",
    candidats: [
      { nom: "R. Ménard", parti: "DVD (soutenu LR)", bord: "Droite", score: 65.6, color: "var(--lr)" },
      { nom: "J. Gabarron", parti: "RN", bord: "Extrême droite", score: 8.97, color: "var(--rn)" }
    ]
  },
  // ===== CAGNES-SUR-MER =====
  "06027": {
    maireSortant: "Louis Nègre (LR, 30 ans)", status: "elu", bord: "rn", participation: 54,
    note: "Le RN détrône un maire LR en poste depuis 30 ans — Bryan Masson a 29 ans",
    candidats: [
      { nom: "B. Masson", parti: "RN", bord: "Extrême droite", score: 50.21, color: "var(--rn)" },
      { nom: "L. Nègre", parti: "LR", bord: "Droite", score: 49.79, color: "var(--lr)" }
    ]
  },
  // ===== CALAIS =====
  "62193": {
    maireSortant: "Natacha Bouchart (LR)", status: "elu", bord: "droite", participation: 52,
    note: "Bouchart réélue dès le 1er tour (59,5 %)",
    candidats: [
      { nom: "N. Bouchart", parti: "LR", bord: "Droite", score: 59.5, color: "var(--lr)" }
    ]
  },
  // ===== NÎMES =====
  "30189": {
    maireSortant: "Jean-Paul Fournier (LR)", status: "2t", bord: "indecis", participation: 54,
    note: "Coude-à-coude RN vs Gauche unie — second tour très incertain",
    candidats: [
      { nom: "J. Sanchez", parti: "RN", bord: "Extrême droite", score: 30.5, color: "var(--rn)" },
      { nom: "V. Bouget", parti: "PCF-PS-Éco", bord: "Gauche", score: 30.5, color: "var(--pcf)" },
      { nom: "F. Proust", parti: "LR", bord: "Droite", score: 19.5, color: "var(--lr)" }
    ]
  },
  // ===== LIMOGES =====
  "87085": {
    maireSortant: "Émile-Roger Lombertie (LR)", status: "2t", bord: "droite", participation: 52,
    note: "Guérin (LR) devance LFI-Éco de peu — maire sortant effondré à 10 %",
    candidats: [
      { nom: "G. Guérin", parti: "LR", bord: "Droite", score: 27.34, color: "var(--lr)" },
      { nom: "D. Maudet", parti: "LFI-Éco", bord: "Extrême gauche", score: 24.86, color: "var(--lfi)" },
      { nom: "T. Miguel", parti: "PS-PCF", bord: "Gauche", score: 16.92, color: "var(--ps)" },
      { nom: "É-R. Lombertie", parti: "LR", bord: "Droite", score: 10.05, color: "var(--lr)" }
    ]
  },
  // ===== MENTON =====
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
