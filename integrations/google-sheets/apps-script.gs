/**
 * =========================================================
 *  SwiftStyle : collecte des demandes de pilote (Google Sheets)
 * =========================================================
 *
 *  À coller dans Extensions > Apps Script d'un Google Sheet,
 *  puis Déployer > Nouveau déploiement > Application web :
 *     - Exécuter en tant que      : Moi
 *     - Qui a accès               : Tout le monde
 *  Copier l'URL /exec obtenue dans la variable GOOGLE_SHEETS_WEBHOOK_URL
 *  (.env.local en local, réglages du projet sur Vercel)
 *
 *  Procédure détaillée dans integrations/README.md.
 * =========================================================
 */

/**
 *  Onglet dédié aux demandes de pilote venant des marques.
 *  L'ancien onglet « Inscriptions » (version grand public) n'est pas touché :
 *  si vous l'aviez utilisé, ses lignes restent là où elles sont.
 */
var SHEET_NAME = 'Marques';

var HEADERS = [
  'Date',
  'Marque',
  'Site web',
  'Nom',
  'Email',
  'Message',
  'Page source',
  'Référent',
  // Ajoutées avec le site v0.2, en fin de ligne pour ne pas décaler les lignes existantes.
  'Plateforme',
  'Commandes par mois'
];

/* Colonne de l'email dans HEADERS, utilisée pour le dédoublonnage. */
var EMAIL_COL = 5;

/**
 * Reçoit une demande transmise par /api/demande-essai.
 * Le corps est du JSON ; son type de contenu n'est pas vérifié.
 */
function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);

    // Garde-fous minimaux côté serveur.
    var email = String(data.email || '').trim();
    if (!/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(email)) {
      return json({ ok: false, error: 'email invalide' });
    }

    var sheet = getSheet_();

    // Un même email ne s'inscrit qu'une fois.
    if (emailExists_(sheet, email)) {
      return json({ ok: true, duplicate: true });
    }

    sheet.appendRow([
      new Date(),
      clean_(data.marque, 120),
      clean_(data.siteWeb, 200),
      clean_(data.nom, 120),
      email,
      clean_(data.message, 2000),
      clean_(data.source, 300),
      clean_(data.referrer, 300),
      clean_(data.plateforme, 80),
      clean_(data.volume, 80)
    ]);

    notify_(data, email);

    return json({ ok: true });

  } catch (err) {
    console.error(err);
    return json({ ok: false, error: String(err) });
  }
}

/** Petit test de vie : ouvrir l'URL /exec dans le navigateur. */
function doGet() {
  return json({ ok: true, service: 'SwiftStyle pilotes' });
}

/* ---------------------------------------------------------
   Utilitaires
   --------------------------------------------------------- */

function getSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAME);

  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
  }

  if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADERS);
    sheet.getRange(1, 1, 1, HEADERS.length)
         .setFontWeight('bold')
         .setBackground('#f2ede2');
    sheet.setFrozenRows(1);
    sheet.setColumnWidth(1, 160);
    sheet.setColumnWidth(3, 200);
    sheet.setColumnWidth(EMAIL_COL, 230);
    sheet.setColumnWidth(6, 320);
  }

  // Onglet créé par une version précédente du script : on complète l'en-tête.
  if (sheet.getLastColumn() < HEADERS.length) {
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]).setFontWeight('bold');
  }

  return sheet;
}

function emailExists_(sheet, email) {
  var last = sheet.getLastRow();
  if (last < 2) return false;

  var values = sheet.getRange(2, EMAIL_COL, last - 1, 1).getValues();
  var needle = email.toLowerCase();

  for (var i = 0; i < values.length; i++) {
    if (String(values[i][0]).trim().toLowerCase() === needle) return true;
  }
  return false;
}

function clean_(value, max) {
  return String(value == null ? '' : value).trim().slice(0, max);
}

/**
 * Email de notification à chaque inscription.
 * Décommenter la ligne MailApp et renseigner DESTINATAIRE pour l'activer.
 */
function notify_(data, email) {
  var DESTINATAIRE = '';            // ex. 'equipe@swiftstyle.fr'
  if (!DESTINATAIRE) return;

  var corps =
    'Nouvelle demande de pilote SwiftStyle\n\n' +
    'Marque   : ' + clean_(data.marque, 120) + '\n' +
    'Site web : ' + clean_(data.siteWeb, 200) + '\n' +
    'Plateforme : ' + clean_(data.plateforme, 80) + '\n' +
    'Volume   : ' + clean_(data.volume, 80) + '\n' +
    'Contact  : ' + clean_(data.nom, 120) + '\n' +
    'Email    : ' + email + '\n' +
    'Message  : ' + clean_(data.message, 2000) + '\n';

  MailApp.sendEmail(DESTINATAIRE, 'SwiftStyle : demande de pilote', corps);
}

function json(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
