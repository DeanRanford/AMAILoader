<#
.SYNOPSIS
    Recursively processes Warcraft III maps via the AMAI Node.js endpoint and rebuilds the folder structure.
#>

# Ensure the required .NET HTTP assembly is loaded
Add-Type -AssemblyName System.Net.Http

# --- Configuration ---
$SourceDir = "\\VX420-G2v\Backups\wc3\BaseMaps"   # Folder containing your original maps (scanned recursively)
$OutputDir = "\\VX420-G2v\Backups\wc3\Processed" # Folder where the processed map structure will be rebuilt
$Endpoint  = "[YOURSERVERHERE]/process-map" # $Endpoint  = "https://curly-space-disco-qp4gjjr55q9f9jpw-3000.app.github.dev/process-mao
$AiChatLanguage = "English"
$ForceAiChatLanguage = $false
$DisableAiChat = $false

# Ensure source directory exists
if (-not (Test-Path -Path $SourceDir)) {
    Write-Error "Source directory does not exist: $SourceDir"
    exit 1
}

# Get all .w3x and .w3m files recursively
$mapFiles = Get-ChildItem -Path $SourceDir -Include *.w3x, *.w3m -Recurse -File

if ($mapFiles.Count -eq 0) {
    Write-Host "No map files found in $SourceDir" -ForegroundColor Yellow
    exit 0
}

Write-Host "Found $($mapFiles.Count) map(s) to process." -ForegroundColor Cyan

# Create HttpClient instance for reuse
$httpClient = New-Object System.Net.Http.HttpClient
$httpClient.Timeout = [System.TimeSpan]::FromMinutes(10) # Adjust timeout for large maps if needed

foreach ($file in $mapFiles) {
    # Calculate relative path to preserve folder structure
    $relativePath = $file.FullName.Substring($SourceDir.Length).TrimStart('\', '/')
    $targetFilePath = Join-Path -Path $OutputDir -ChildPath $relativePath
    $targetFileDir = Split-Path -Path $targetFilePath -Parent

    Write-Host "Processing: $relativePath..." -NoNewline

    $form = $null
    $fileStream = $null

    try {
        # Create multipart form data content
        $form = New-Object System.Net.Http.MultipartFormDataContent
        $form.Add((New-Object System.Net.Http.StringContent("REFORGED")), "version")
        $form.Add((New-Object System.Net.Http.StringContent("1")), "commander")
        $form.Add((New-Object System.Net.Http.StringContent($AiChatLanguage)), "language")
        if ($ForceAiChatLanguage) {
            $form.Add((New-Object System.Net.Http.StringContent("true")), "forceLanguage")
        }
        if ($DisableAiChat) {
            $form.Add((New-Object System.Net.Http.StringContent("true")), "disableChat")
        }

        # Attach map file
        $fileStream = [System.IO.File]::OpenRead($file.FullName)
        $streamContent = New-Object System.Net.Http.StreamContent($fileStream)
        $streamContent.Headers.ContentType = [System.Net.Http.Headers.MediaTypeHeaderValue]::Parse("application/octet-stream")
        $form.Add($streamContent, "mapFile", $file.Name)

        # Send POST request
        $response = $httpClient.PostAsync($Endpoint, $form).Result

        if ($response.IsSuccessStatusCode) {
            # Read binary response
            $bytes = $response.Content.ReadAsByteArrayAsync().Result

            # Ensure target directory exists
            if (-not (Test-Path -Path $targetFileDir)) {
                New-Item -ItemType Directory -Path $targetFileDir -Force | Out-Null
            }

            # Save processed map
            [System.IO.File]::WriteAllBytes($targetFilePath, $bytes)
            Write-Host " [SUCCESS]" -ForegroundColor Green
        } else {
            $errorMsg = $response.Content.ReadAsStringAsync().Result
            Write-Host " [FAILED]" -ForegroundColor Red
            Write-Warning "Server responded with status $($response.StatusCode): $errorMsg"
        }
    }
    catch {
        Write-Host " [ERROR]" -ForegroundColor Red
        Write-Warning "Exception occurred while processing '$relativePath': $_"
    }
    finally {
        # Clean up streams and content objects per iteration
        if ($fileStream) { $fileStream.Dispose() }
        if($form) { $form.Dispose() }
    }
}

# Dispose HttpClient
$httpClient.Dispose()
Write-Host "`nBatch processing complete!" -ForegroundColor Cyan