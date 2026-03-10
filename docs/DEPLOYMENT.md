# Deployment & Setup Guide

This document covers the one-time setup steps required to deploy the World Cup 2026 Picks app from scratch. Routine code deploys are fully automated via GitHub Actions — this is only needed when setting up a new environment or recreating resources.

## Prerequisites

- Azure subscription
- Azure CLI logged in (`az login`)
- GitHub CLI logged in (`gh auth login`)
- Access to Google Cloud Console (for Google OAuth app)

---

## 1. Azure Infrastructure

Deploy the Bicep template to create the Storage Account and Static Web App:

```powershell
az group create --name rg-world-cup --location eastus2
az deployment group create \
  --resource-group rg-world-cup \
  --template-file infra/main.bicep \
  --parameters infra/main.bicepparam
```

> **Note:** The Bicep `appsettings` resource does a **full PUT** — it wipes any settings not declared in the template. Auth secrets (below) must be set *after* every infra deploy. The `infra.yml` workflow handles this automatically for CI/CD deploys using GitHub Secrets.

---

## 2. Google OAuth App

1. Go to [Google Cloud Console](https://console.cloud.google.com/) → APIs & Services → Credentials
2. Create an **OAuth 2.0 Client ID** (Web application)
3. Add Authorized redirect URIs:
   - `https://<your-swa-default-domain>/.auth/login/google/callback`
   - `https://<your-custom-domain>/.auth/login/google/callback`
4. Note the **Client ID** and **Client Secret**

---

## 3. Entra ID (AAD) App Registration

1. Create the app registration:
   ```powershell
   az ad app create --display-name "World Cup Picks" \
     --web-redirect-uris \
       "https://<your-swa-default-domain>/.auth/login/aad/callback" \
       "https://<your-custom-domain>/.auth/login/aad/callback"
   ```
2. Create a client secret:
   ```powershell
   az ad app credential reset --id <app-id> --years 2
   ```
3. **Run the configuration script** — this applies two settings that cannot be expressed in Bicep and are required for SWA custom auth to work:
   ```powershell
   .\tools\configure-aad-app.ps1 -AppId <app-id>
   ```
   What the script sets:
   - `signInAudience: AzureADMyOrg` — single-tenant only. Without this, the app accepts personal MSA accounts (@outlook.com etc), which produce tokens with a different issuer than the one configured in `staticwebapp.config.json`, causing SWA to silently reject the login.
   - `enableIdTokenIssuance: true` — enables the implicit grant ID token flow. SWA custom auth uses `response_type=id_token`; without this every Entra login fails with error 700054 and the user is returned to the app with no session.

---

## 4. App Settings

Set all secrets on the Static Web App:

```powershell
az staticwebapp appsettings set \
  --name <swa-name> \
  --resource-group rg-world-cup \
  --setting-names \
    GOOGLE_CLIENT_ID="<google-client-id>" \
    GOOGLE_CLIENT_SECRET="<google-client-secret>" \
    AZURE_CLIENT_ID="<aad-app-id>" \
    AZURE_CLIENT_SECRET="<aad-client-secret>" \
    ADMIN_EMAILS="<comma-separated-admin-emails>"
```

> `AZURE_STORAGE_CONNECTION_STRING` and `LOCK_DEADLINE` are set by the Bicep deploy automatically.

---

## 5. GitHub Secrets

Add these secrets to the GitHub repo so the infra workflow can re-apply auth settings after Bicep deploys:

```powershell
gh secret set SWA_GOOGLE_CLIENT_ID     --body "<google-client-id>"
gh secret set SWA_GOOGLE_CLIENT_SECRET --body "<google-client-secret>"
gh secret set SWA_ENTRA_CLIENT_ID      --body "<aad-app-id>"
gh secret set SWA_ENTRA_CLIENT_SECRET  --body "<aad-client-secret>"
gh secret set SWA_ADMIN_EMAILS         --body "<comma-separated-admin-emails>"
```

Plus the existing deployment secrets (set when the SWA was created):
- `AZURE_STATIC_WEB_APPS_API_TOKEN` — from the SWA resource in the portal
- `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID` — for the infra workflow's federated credential

---

## 6. Custom Domain

After DNS is configured (CNAME pointing to the SWA default domain), set the custom domain via the portal or:

```powershell
az staticwebapp hostname set \
  --name <swa-name> \
  --resource-group rg-world-cup \
  --hostname <your-custom-domain>
```

Then update `infra/main.bicepparam` with the custom domain so future infra deploys preserve it.

---

## Routine Deploys

After initial setup, everything is automated:

- **App + functions**: push to `main` → `deploy.yml` builds and deploys
- **Infrastructure**: push changes to `infra/**` → `infra.yml` deploys Bicep + re-applies auth settings
