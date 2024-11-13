$process = Get-Process -Name Vortex -ErrorAction SilentlyContinue

if ($null -ne $process) {
    $id = $process.Id

    Write-Output "Close Vortex. PIDs: $id"

    $process.CloseMainWindow()
    $process.Close()

    Wait-Process -Id $id -Timeout 10 -ErrorAction SilentlyContinue

    if ($process.HasExited -eq $false) {
        Write-Output "Force close Vortex."
        $process.Kill($true)
    }
}

Remove-Variable process
