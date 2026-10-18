# Cross-platform PowerShell regression. Windows uses DPAPI; Linux does not.
$ErrorActionPreference = 'Stop'
$source = Join-Path $PSScriptRoot '..\open-sap2000-web.ps1'
$tokens = $null; $errors = $null
$ast = [System.Management.Automation.Language.Parser]::ParseFile((Resolve-Path $source), [ref]$tokens, [ref]$errors)
if ($errors.Count) { throw 'Launcher has PowerShell syntax errors.' }
$reader = $ast.Find({ param($node) $node -is [System.Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -eq 'Read-ConnectorToken' }, $true)
if (-not $reader) { throw 'Token reader is missing.' }
# Execute only the token reader, never the Windows startup / elevation code.
. ([scriptblock]::Create($reader.Extent.Text))
$temp = Join-Path ([IO.Path]::GetTempPath()) ([Guid]::NewGuid().ToString()+'.token-test')
try {
    $expected = 'ab' * 32
    $serialized = ConvertTo-SecureString $expected -AsPlainText -Force | ConvertFrom-SecureString
    foreach ($suffix in @('', "`n", "`r`n", "`r`n`r`n")) {
        [IO.File]::WriteAllText($temp, $serialized + $suffix)
        if ((Read-ConnectorToken $temp) -cne $expected) { throw 'Token changed during whitespace recovery.' }
    }
    # Original Set-Content behavior, then repeated restarts using the same file.
    $serialized | Set-Content $temp
    1..3 | ForEach-Object { if ((Read-ConnectorToken $temp) -cne $expected) { throw 'Restart did not preserve token.' } }
    $serialized | Set-Content -LiteralPath $temp -NoNewline
    if ((Get-Content -Raw $temp) -cne $serialized) { throw 'New writes must omit the newline.' }
    if ((Read-ConnectorToken $temp) -cne $expected) { throw 'New writer did not round trip.' }
    [IO.File]::WriteAllText($temp, 'invalid saved data')
    $rejected = $false
    try { $null = Read-ConnectorToken $temp } catch { $rejected = $true }
    if (-not $rejected) { throw 'Corrupted token was accepted.' }
    Write-Host 'PASS: launcher parses, legacy LF/CRLF tokens, repeated restarts, new writes, and corrupt-token rejection.'
} finally { Remove-Item -LiteralPath $temp -ErrorAction SilentlyContinue }
