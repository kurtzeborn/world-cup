# configure-aad-app.ps1
# Configures the Entra ID (AAD) app registration settings required for SWA custom auth.
# These settings cannot be expressed in Bicep and must be applied manually (or via this script).
#
# Run this once after creating a new app registration, or if the registration is recreated.
# Requires: az cli, logged in with sufficient permissions (Application Administrator or Owner)
#
# Usage: .\tools\configure-aad-app.ps1

param(
    [string]$AppId = "a5165989-ab4c-4566-b16d-a1bad2191a20"
)

Write-Host "Configuring AAD app registration $AppId..."

# 1. Single-tenant only — tokens must come from the kurtzeborn.org tenant.
#    Without this, the app accepts personal MSA accounts (@outlook.com etc),
#    which produce tokens with a different issuer than the openIdIssuer in
#    staticwebapp.config.json, causing SWA to silently reject the login.
az ad app update --id $AppId --sign-in-audience "AzureADMyOrg"
Write-Host "  [ok] signInAudience = AzureADMyOrg"

# 2. Enable ID token issuance (implicit grant).
#    SWA custom auth uses response_type=id_token. Without this, every Entra
#    login fails with error 700054 and the user is returned to the app with
#    no session.
az ad app update --id $AppId --enable-id-token-issuance true
Write-Host "  [ok] enableIdTokenIssuance = true"

# 3. Verify redirect URIs are present (informational — set manually in portal
#    or via az ad app update --web-redirect-uris if needed).
$uris = az ad app show --id $AppId --query "web.redirectUris" -o tsv
Write-Host "  [info] Redirect URIs:"
$uris -split "`t" | ForEach-Object { Write-Host "    $_" }

$expected = @(
    "https://victorious-grass-0910e160f.4.azurestaticapps.net/.auth/login/aad/callback",
    "https://wc.k61.dev/.auth/login/aad/callback"
)
foreach ($uri in $expected) {
    if ($uris -notmatch [regex]::Escape($uri)) {
        Write-Warning "  Missing redirect URI: $uri"
    }
}

Write-Host "Done."
