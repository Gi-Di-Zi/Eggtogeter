param(
    [string]$SourcePath,
    [string]$DestPath
)

$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
$files = Get-ChildItem -Path $SourcePath -Filter "*.md" | Sort-Object Name
$sb = New-Object System.Text.StringBuilder

Write-Host "Compressing $($files.Count) files from $SourcePath to $DestPath..."

foreach ($f in $files) {
    if ($f.Name -eq "Test_Data.md") { continue }
    
    # Add Header
    $sb.AppendLine("### Original File: " + $f.Name) | Out-Null
    $sb.AppendLine("") | Out-Null
    
    # Read Content
    $content = [System.IO.File]::ReadAllText($f.FullName, $utf8NoBom)
    $sb.AppendLine($content) | Out-Null
    
    # Add Separator
    $sb.AppendLine("") | Out-Null
    $sb.AppendLine("---") | Out-Null
    $sb.AppendLine("") | Out-Null
}

# Write to file
[System.IO.File]::WriteAllText($DestPath, $sb.ToString(), $utf8NoBom)
Write-Host "Compression Complete."
