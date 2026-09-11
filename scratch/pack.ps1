$zipName = "backend-elearning-english.zip"
if (Test-Path $zipName) {
    Remove-Item -Force $zipName
}
$exclude = @("node_modules", "uploads", "scratch", "database.sql", ".git", "backend-elearning-english.zip")
$items = Get-ChildItem -Path . | Where-Object { $exclude -notcontains $_.Name -and $_.Extension -ne ".log" }
Compress-Archive -Path $items -DestinationPath $zipName -CompressionLevel Optimal
Write-Output "ZIP CREATED SUCCESSFULLY:"
Get-Item $zipName | Select-Object Name, Length, LastWriteTime
