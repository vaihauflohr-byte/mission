# Mission — exporte en PDF, avec Word, PowerPoint et Excel, les documents du site mission.ka-ilei.com.
# Les fichiers d'origine (Google Drive, dossier Eglise\Etude petit groupe) ne sont pas modifiés :
# chacun est copié dans un dossier temporaire, ouvert en lecture seule, exporté en PDF, puis refermé.
$ErrorActionPreference = "Stop"
$ici = Split-Path -Parent $MyInvocation.MyCommand.Path
$sortie = Join-Path $ici "pdf"
$temp = Join-Path $env:TEMP "mission-pdf"
New-Item -ItemType Directory -Force -Path $sortie, $temp | Out-Null
$journal = Join-Path $ici "journal.txt"
"Début : $(Get-Date)" | Out-File -FilePath $journal -Encoding UTF8

# dossier « Mon Drive » de Google Drive (lettre G: ou autre)
$racine = $null
foreach ($lecteur in (Get-PSDrive -PSProvider FileSystem)) {
  foreach ($nom in @("Mon Drive", "My Drive", "Mon disque")) {
    $p = Join-Path $lecteur.Root $nom
    if (Test-Path -LiteralPath (Join-Path $p "Eglise\Etude petit groupe")) { $racine = $p; break }
  }
  if ($racine) { break }
}
if (-not $racine) {
  Write-Host "Dossier « Eglise\Etude petit groupe » introuvable. Google Drive est-il ouvert sur ce PC ?" -ForegroundColor Red
  Read-Host "Appuyez sur Entrée pour fermer"; exit 1
}
Write-Host "Documents pris dans : $racine\Eglise\Etude petit groupe"

$liste = Get-Content -Raw -Encoding UTF8 -LiteralPath (Join-Path $ici "liste.json") | ConvertFrom-Json
$word = $null; $ppt = $null; $excel = $null
$n = 0; $faits = 0; $erreurs = 0
foreach ($e in $liste) {
  $n++
  $dest = Join-Path $sortie $e.cible
  if (Test-Path -LiteralPath $dest) { $faits++; continue }   # déjà fait : on peut relancer le script
  Write-Host ("[{0}/{1}] {2}" -f $n, $liste.Count, $e.cible)
  try {
    $src = Join-Path $racine $e.source
    if (-not (Test-Path -LiteralPath $src)) { throw "fichier introuvable : $src" }
    $copie = Join-Path $temp ("document" + [IO.Path]::GetExtension($src))
    Copy-Item -LiteralPath $src -Destination $copie -Force
    switch ($e.type) {
      "Word" {
        if (-not $word) { $word = New-Object -ComObject Word.Application; $word.Visible = $false; $word.DisplayAlerts = 0 }
        $doc = $word.Documents.Open($copie, $false, $true, $false)
        try { $doc.TrackRevisions = $false; if ($doc.Revisions.Count -gt 0) { $doc.Revisions.AcceptAll() } } catch {}
        # PDF (17), qualité impression, tout le document, sans les marques de révision, avec signets et balises
        $doc.ExportAsFixedFormat($dest, 17, $false, 0, 0, 1, 1, 0, $true, $true, 1, $true, $true, $false)
        $doc.Close(0)
      }
      "PowerPoint" {
        if (-not $ppt) { $ppt = New-Object -ComObject PowerPoint.Application }
        $pres = $ppt.Presentations.Open($copie, -1, 0, 0)
        try { $pres.ExportAsFixedFormat($dest, 2, 1) }      # PDF, qualité écran (fichier plus léger)
        catch { $pres.SaveAs($dest, 32) }                    # sinon : enregistrer en PDF
        $pres.Close()
      }
      "Excel" {
        if (-not $excel) { $excel = New-Object -ComObject Excel.Application; $excel.Visible = $false; $excel.DisplayAlerts = $false }
        $classeur = $excel.Workbooks.Open($copie, 0, $true)
        foreach ($feuille in @("Formules", "Présentation")) { try { $classeur.Worksheets.Item($feuille).Visible = 0 } catch {} }
        $classeur.ExportAsFixedFormat(0, $dest)
        $classeur.Close($false)
      }
    }
    Remove-Item -LiteralPath $copie -Force -ErrorAction SilentlyContinue
    $faits++
    "ok      $($e.cible)" | Out-File -Append -FilePath $journal -Encoding UTF8
  } catch {
    $erreurs++
    "ERREUR  $($e.cible) : $($_.Exception.Message)" | Out-File -Append -FilePath $journal -Encoding UTF8
    Write-Host "  erreur : $($_.Exception.Message)" -ForegroundColor Red
  }
}
if ($word) { $word.Quit() }
if ($ppt) { $ppt.Quit() }
if ($excel) { $excel.Quit() }
"Fin : $(Get-Date) — $faits PDF, $erreurs erreur(s)" | Out-File -Append -FilePath $journal -Encoding UTF8
Write-Host ""
Write-Host "Terminé : $faits PDF sur $($liste.Count), $erreurs erreur(s)." -ForegroundColor Green
Write-Host "Les PDF sont dans $sortie"
Read-Host "Appuyez sur Entrée pour fermer"
