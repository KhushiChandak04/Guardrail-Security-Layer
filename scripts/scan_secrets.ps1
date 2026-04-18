param(
    [switch]$ScanHistory
)

$ErrorActionPreference = "Stop"

$patterns = @(
    'AIza[0-9A-Za-z_-]{20,}',
    '-----BEGIN (RSA )?PRIVATE KEY-----',
    '"private_key"\s*:',
    '"client_email"\s*:\s*"[^\"]+@[^\"]+\.iam\.gserviceaccount\.com"',
    'firebase-adminsdk-[^@\"]+@'
)

function Invoke-GitPatternScan {
    param(
        [string]$Pattern,
        [string[]]$ExtraArgs = @()
    )

    $commandArgs = @('grep', '-nE', '--', $Pattern) + $ExtraArgs
    $output = & git @commandArgs 2>$null
    $exitCode = $LASTEXITCODE

    return [PSCustomObject]@{
        ExitCode = $exitCode
        Output = $output
    }
}

$hasFindings = $false

Write-Output "Scanning tracked files for secret patterns..."
foreach ($pattern in $patterns) {
    $result = Invoke-GitPatternScan -Pattern $pattern
    if ($result.ExitCode -eq 0) {
        $hasFindings = $true
        Write-Output "[FOUND] Pattern: $pattern"
        $result.Output | ForEach-Object { Write-Output $_ }
    }
}

if ($ScanHistory) {
    $revisions = & git rev-list --all
    if ($LASTEXITCODE -eq 0 -and $revisions) {
        Write-Output "Scanning git history for secret patterns..."
        foreach ($pattern in $patterns) {
            $result = Invoke-GitPatternScan -Pattern $pattern -ExtraArgs $revisions
            if ($result.ExitCode -eq 0) {
                $hasFindings = $true
                Write-Output "[FOUND HISTORY] Pattern: $pattern"
                $result.Output | ForEach-Object { Write-Output $_ }
            }
        }
    }
}

if ($hasFindings) {
    Write-Error "Secret scan failed. Remove or rotate exposed values before committing/pushing."
    exit 1
}

Write-Output "Secret scan passed."
