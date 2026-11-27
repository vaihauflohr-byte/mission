/**
 * Mission — tableau du responsable des petits groupes
 *
 * Reçoit, depuis mission.ka-ilei.com :
 *   - les bilans de rencontre envoyés par les leaders (onglet « Bilans ») ;
 *   - les pages lues sur le site, comptées sans cookie ni donnée personnelle (onglet « Visites »).
 * L’onglet « Résumé » se calcule tout seul : bilans par groupe, études les plus lues.
 *
 * Installation, une seule fois, sur ordinateur, dans le tableau « Mission — bilans des petits groupes » :
 *   1. Extensions › Apps Script ; effacer le code présent et coller tout ce fichier ; Enregistrer.
 *   2. Choisir la fonction « installer » en haut, puis Exécuter, et autoriser l’accès avec son compte Google.
 *   3. Déployer › Nouveau déploiement › type « Application Web » ;
 *      Exécuter en tant que : Moi ; Qui a accès : Tout le monde ; Déployer.
 *   4. Copier l’adresse de l’application Web (elle se termine par /exec) : c’est elle que le site utilise
 *      (constante SCRIPT_MISSION dans assets/app.js).
 * Après une modification de ce code : Déployer › Gérer les déploiements › modifier › Nouvelle version.
 */

const COLONNES = {
  Bilans: ["Reçu le", "Date de la rencontre", "Groupe", "Leader", "Série", "Étude", "Durée", "Présents", "Membres",
    "Noms des présents", "Absents", "Visiteurs", "Versets récités", "Partage", "Prière et besoins", "Code d’envoi"],
  Visites: ["Jour", "Page", "Titre", "Lectures"],
};
const CODE = 16; // colonne « Code d’envoi » des bilans

function doPost(e) {
  if (tropDeDemandes()) return reponse({ ok: false, erreur: "trop de demandes, réessayer plus tard" });
  const verrou = LockService.getScriptLock();
  verrou.waitLock(20000);
  try {
    const d = JSON.parse(e.postData.contents);
    if (d.type === "bilan") ecrireBilan(d);
    else if (d.type === "visites") ecrireVisites(d);
    else return reponse({ ok: false, erreur: "type inconnu" });
    return reponse({ ok: true });
  } catch (err) {
    return reponse({ ok: false, erreur: String(err) });
  } finally {
    verrou.releaseLock();
  }
}

function doGet() {
  return reponse({ ok: true, service: "Mission, tableau des petits groupes" });
}

function reponse(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

// l’adresse du script est publique (elle est dans le site) : au plus 120 envois par minute
function tropDeDemandes() {
  const cache = CacheService.getScriptCache();
  const cle = "minute-" + Math.floor(Date.now() / 60000);
  const n = Number(cache.get(cle) || 0) + 1;
  cache.put(cle, String(n), 120);
  return n > 120;
}

// texte reçu du site : coupé à la longueur voulue, et jamais pris pour une formule
function texte(v, n) {
  const t = String(v == null ? "" : v).slice(0, n || 500);
  return /^[=+\-@]/.test(t) ? "'" + t : t;
}
function nombre(v) {
  const n = Math.round(Number(v));
  return isFinite(n) ? Math.max(0, Math.min(100000, n)) : "";
}
function jour(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ""));
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : "";
}

function onglet(nom) {
  const classeur = SpreadsheetApp.getActiveSpreadsheet();
  let f = classeur.getSheetByName(nom);
  if (!f) f = classeur.insertSheet(nom);
  if (COLONNES[nom] && f.getLastRow() === 0) {
    f.getRange(1, 1, 1, COLONNES[nom].length).setValues([COLONNES[nom]]).setFontWeight("bold").setBackground("#DCEDE6");
    f.setFrozenRows(1);
  }
  return f;
}

// un bilan renvoyé (corrigé, ou envoyé deux fois) remplace sa ligne : même groupe, même date, même code
function ecrireBilan(d) {
  const f = onglet("Bilans");
  const code = texte(d.id, 80);
  const ligne = [
    new Date(), jour(d.date), texte(d.groupe, 80), texte(d.leader, 60), texte(d.serie, 120), texte(d.etude, 160),
    texte(d.duree, 20), nombre(d.presents), nombre(d.membres), texte(d.nomsPresents, 600), texte(d.absents, 600),
    nombre(d.visiteurs), d.versets === null || d.versets === undefined || d.versets === "" ? "" : nombre(d.versets),
    texte(d.partage, 1500), texte(d.priere, 1500), code,
  ];
  let r = 0;
  if (code && f.getLastRow() > 1) {
    const trouve = f.getRange(2, CODE, f.getLastRow() - 1, 1).createTextFinder(code).matchEntireCell(true).findNext();
    if (trouve) r = trouve.getRow();
  }
  if (r) f.getRange(r, 1, 1, ligne.length).setValues([ligne]);
  else { f.appendRow(ligne); r = f.getLastRow(); }
  f.getRange(r, 1).setNumberFormat("dd/MM/yyyy HH:mm");
  f.getRange(r, 2).setNumberFormat("dd/MM/yyyy");
}

// pages lues : des totaux par jour et par page, envoyés par paquets ; un paquet reçu deux fois ne compte qu’une fois
function ecrireVisites(d) {
  const cache = CacheService.getScriptCache();
  const lot = "lot-" + texte(d.lot, 40);
  if (d.lot && cache.get(lot)) return;
  const lignes = (Array.isArray(d.pages) ? d.pages : []).slice(0, 300)
    .map((x) => [jour(x.jour), texte(x.p, 200), texte(x.t, 200), nombre(x.n)])
    .filter((l) => l[0] && l[1] && l[3]);
  if (!lignes.length) return;
  const f = onglet("Visites");
  const debut = f.getLastRow() + 1;
  f.getRange(debut, 1, lignes.length, 4).setValues(lignes);
  f.getRange(debut, 1, lignes.length, 1).setNumberFormat("dd/MM/yyyy");
  if (d.lot) cache.put(lot, "1", 21600);
}

// à exécuter une fois : onglets, en-têtes, et le résumé qui se calcule tout seul
// (dans Apps Script, les formules s’écrivent toujours avec des virgules, quelle que soit la langue du tableau)
function installer() {
  onglet("Bilans");
  onglet("Visites");
  const r = onglet("Résumé");
  r.clear();
  r.getRange("A1").setValue("Résumé").setFontSize(14).setFontWeight("bold");
  r.getRange("A3:B6").setValues([
    ["Bilans reçus", "=COUNTA(Bilans!B2:B)"],
    ["Dernier bilan reçu le", '=IF(B3=0,"",MAX(Bilans!A2:A))'],
    ["Présents en moyenne par rencontre", "=IF(B3=0,0,AVERAGE(Bilans!H2:H))"],
    ["Pages lues sur le site (comptées sans donnée personnelle)", "=SUM(Visites!D2:D)"],
  ]);
  r.getRange("B4").setNumberFormat("dd/MM/yyyy HH:mm");
  r.getRange("B5").setNumberFormat("0.0");
  r.getRange("A8").setValue("Bilans par groupe").setFontWeight("bold");
  r.getRange("A9").setFormula('=IFERROR(QUERY(Bilans!A1:P,"select C, count(B), avg(H), max(B) where C is not null group by C ' +
    'label C \'Groupe\', count(B) \'Bilans\', avg(H) \'Présents en moyenne\', max(B) \'Dernière rencontre\'",1),"Pas encore de bilan")');
  r.getRange("F8").setValue("Les plus lues, 30 derniers jours").setFontWeight("bold");
  r.getRange("F9").setFormula('=IFERROR(QUERY(Visites!A1:D,"select C, sum(D) where A >= date \'"&TEXT(TODAY()-30,"yyyy-mm-dd")&"\' ' +
    'and C is not null group by C order by sum(D) desc limit 30 label C \'Page\', sum(D) \'Lectures\'",1),"Pas encore de visite comptée")');
  r.setColumnWidth(1, 300);
  r.setColumnWidth(6, 420);
  SpreadsheetApp.getActiveSpreadsheet().setActiveSheet(r);
}
