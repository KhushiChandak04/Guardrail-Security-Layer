param(
    [Parameter(Mandatory = $true)]
    [int[]]$Ports
)

foreach ($port in $Ports) {
    $listeners = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue

    if ($null -eq $listeners) {
        Write-Output ("PORT {0} free" -f $port)
        continue
    }

    $processIds = $listeners | Select-Object -ExpandProperty OwningProcess -Unique

    foreach ($processId in $processIds) {
        $process = Get-Process -Id $processId -ErrorAction SilentlyContinue
        if ($null -eq $process) {
            continue
        }

        Stop-Process -Id $processId -Force
        Write-Output ("PORT {0} cleared by stopping PID {1} ({2})" -f $port, $processId, $process.ProcessName)
    }
}
