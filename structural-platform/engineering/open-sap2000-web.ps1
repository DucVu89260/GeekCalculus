param([string]$Uri, [switch]$Elevated, [ValidateSet('vi','en')][string]$Language='vi')
function Read-ConnectorToken([string]$Path) {
    # Set-Content in older kits appended CR/LF to the serialized DPAPI value.
    # ConvertTo-SecureString expects hex without trailing whitespace.
    $serialized = (Get-Content -Raw -LiteralPath $Path).Trim()
    $secure = ConvertTo-SecureString -String $serialized
    $value = ([System.Net.NetworkCredential]::new('', $secure)).Password
    if ($value -cnotmatch '^[0-9a-f]{64}$') { throw 'Invalid saved launcher token. Keep this file private.' }
    return $value
}

$ErrorActionPreference = 'Stop'
$stage = 'validate launcher address'
$root = 'C:\geek_calculus\SAP2000-API'
try {
    if ($Uri) {
        if ($Uri -cnotmatch '^geekcalculus-sap2000://launch/26\.2\.0/\?lang=(vi|en)$') { throw 'Unsupported SAP2000 launcher address.' }
        $Language = $Matches[1]
    } elseif (-not $Elevated) { throw 'Use the SAP2000-API button on GeekCalculus.' }
    if ($PSScriptRoot -ine $root) { throw "Extract the full kit to $root first." }
    if (-not $Elevated) {
        # Only validated language is forwarded; never execute a URL as shell code.
        Start-Process powershell.exe -Verb RunAs -ArgumentList @('-NoProfile','-ExecutionPolicy','Bypass','-File',"`"$root\open-sap2000-web.ps1`"",'-Elevated','-Language',$Language)
        exit
    }
    $admin = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
    if (-not $admin.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) { throw 'Administrator permission was not granted.' }
    # DPAPI encrypts the reusable token for the current Windows user. No web endpoint exposes it.
    $stage = 'read saved connector token'
    $state = Join-Path $env:LOCALAPPDATA 'GeekCalculus\SAP2000-API'
    New-Item -ItemType Directory -Force -Path $state | Out-Null
    $tokenFile = Join-Path $state 'connector-token.dpapi'
    if (Test-Path $tokenFile) {
        $token = Read-ConnectorToken $tokenFile
    } else {
        $bytes = New-Object byte[] 32
        $rng = [Security.Cryptography.RandomNumberGenerator]::Create()
        try { $rng.GetBytes($bytes) } finally { $rng.Dispose() }
        $token = [BitConverter]::ToString($bytes).Replace('-','').ToLowerInvariant()
        ConvertTo-SecureString $token -AsPlainText -Force | ConvertFrom-SecureString | Set-Content -LiteralPath $tokenFile -NoNewline
    }
    $web = 'https://ducvu89260.github.io/GeekCalculus/sap2000-api/26.2.0/?lang=' + $Language
    $stage = 'check running connector'
    $ready = $false
    try {
        $response = Invoke-RestMethod -Uri 'http://127.0.0.1:8010/API_IF_SAP26.2.0_V1/connection' -Headers @{Authorization="Bearer $token"} -TimeoutSec 3
        if ($response.transport -ne 'dotnet' -or -not $response.build_id) { throw 'Unexpected local connector response.' }
        $ready = $true
    } catch {
        # Existing connectors with another token are not stopped or taken over.
        if ($_.Exception.Message -eq 'Unexpected local connector response.') { throw }
        if ($_.Exception.Response) { throw 'Port 8010 belongs to a different connector. Stop its CMD with Ctrl+C when no export is active, then click SAP2000-API again.' }
    }
    if ($ready) {
        $stage = 'open authenticated web panel'
        Start-Process ($web + '#token=' + [Uri]::EscapeDataString($token))
    } else {
        $stage = 'start local connector'
        $env:SAP2000_CONNECTOR_TOKEN = $token
        Set-Location $root
        & "$root\start-sap2000-panel.cmd" --web-url $web
        if ($LASTEXITCODE -ne 0) { throw 'Connector failed to start. See the message above.' }
    }
} catch {
    Write-Host ('Launcher error during: ' + $stage + ' (line ' + $_.InvocationInfo.ScriptLineNumber + ')') -ForegroundColor Red
    if ($stage -eq 'read saved connector token') {
        Write-Host 'Cannot read the saved connector token. Do not share the token file. Use the updated launcher; existing CR/LF is handled automatically.' -ForegroundColor Red
    } else { Write-Host $_.Exception.Message -ForegroundColor Red }
    Read-Host 'Press Enter to close'
    exit 1
}
