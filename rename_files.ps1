# PowerShell script to rename JavaScript files from uppercase to lowercase
# This script will rename all .js files that start with uppercase letters

Write-Host "Starting file renaming process..." -ForegroundColor Green

# Function to rename a file and update all references
function Rename-JavaScriptFile {
    param(
        [string]$FilePath
    )
    
    $directory = Split-Path $FilePath -Parent
    $oldName = Split-Path $FilePath -Leaf
    $newName = $oldName.ToLower()
    
    if ($oldName -eq $newName) {
        return
    }
    
    $newPath = Join-Path $directory $newName
    
    Write-Host "Renaming: $oldName -> $newName" -ForegroundColor Yellow
    
    # Rename the file
    try {
        Move-Item -Path $FilePath -Destination $newPath -Force
        Write-Host "Successfully renamed: $oldName -> $newName" -ForegroundColor Green
        return @{ OldPath = $FilePath; NewPath = $newPath; OldName = $oldName; NewName = $newName }
    }
    catch {
        Write-Host "Error renaming $oldName`: $($_.Exception.Message)" -ForegroundColor Red
        return $null
    }
}

# Get all JavaScript files that start with uppercase letters
$filesToRename = @()

# Main src directory
$mainSrcFiles = Get-ChildItem -Path "src" -Recurse -Filter "*.js" | Where-Object { $_.Name -match "^[A-Z]" }
$filesToRename += $mainSrcFiles

# llm-proxy-server src directory
$llmProxyFiles = Get-ChildItem -Path "llm-proxy-server\src" -Recurse -Filter "*.js" | Where-Object { $_.Name -match "^[A-Z]" }
$filesToRename += $llmProxyFiles

Write-Host "Found $($filesToRename.Count) files to rename" -ForegroundColor Cyan

# Store the rename operations for later reference
$renameOperations = @()

# Rename all files
foreach ($file in $filesToRename) {
    $result = Rename-JavaScriptFile -FilePath $file.FullName
    if ($result) {
        $renameOperations += $result
    }
}

Write-Host "`nRenamed $($renameOperations.Count) files successfully" -ForegroundColor Green

# Save the rename operations to a file for reference
$renameOperations | ConvertTo-Json -Depth 3 | Out-File -FilePath "rename_operations.json" -Encoding UTF8

Write-Host "Rename operations saved to rename_operations.json" -ForegroundColor Cyan
Write-Host "File renaming complete!" -ForegroundColor Green 