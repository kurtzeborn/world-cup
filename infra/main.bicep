// FIFA World Cup 2026 Picks — Azure Infrastructure
// Deploys: Storage Account (Table Storage) + Azure Static Web App (managed functions)

targetScope = 'resourceGroup'

@description('Azure region for storage resources')
param location string = resourceGroup().location

@description('Azure region for Static Web App (limited availability)')
param swaLocation string = 'eastus2'

@description('Custom domain for the Static Web App (leave empty until DNS CNAME is configured)')
param customDomain string = ''

@description('Lock deadline for picks (ISO 8601 UTC)')
param lockDeadline string = '2026-06-11T19:00:00Z'

@description('Tags to apply to all resources')
param tags object = {
  project: 'world-cup'
}

var storageAccountName = 'stwc${uniqueString(resourceGroup().id)}'
var staticSiteName = 'swa-wc-prod'

// Storage Account — Table Storage for all app data
module storageAccount 'br/public:avm/res/storage/storage-account:0.19.0' = {
  params: {
    name: storageAccountName
    location: location
    tags: tags
    skuName: 'Standard_LRS'
    kind: 'StorageV2'
    allowBlobPublicAccess: false
    allowSharedKeyAccess: true
    publicNetworkAccess: 'Enabled'
    networkAcls: {
      defaultAction: 'Allow'
    }
    tableServices: {
      tables: [
        { name: 'Teams' }
        { name: 'Users' }
        { name: 'Picks' }
        { name: 'Results' }
        { name: 'Scores' }
        { name: 'Leagues' }
        { name: 'LeagueMembers' }
      ]
    }
  }
}

// Static Web App — Standard tier required for custom auth providers (Google)
module staticSite 'br/public:avm/res/web/static-site:0.7.0' = {
  params: {
    name: staticSiteName
    location: swaLocation
    tags: tags
    sku: 'Standard'
    customDomains: customDomain != '' ? [customDomain] : []
  }
}

// App settings — constructed from storage key after both resources are provisioned
var storageKey = listKeys(resourceId('Microsoft.Storage/storageAccounts', storageAccountName), '2023-05-01').keys[0].value
var storageConnectionString = 'DefaultEndpointsProtocol=https;AccountName=${storageAccountName};AccountKey=${storageKey};EndpointSuffix=core.windows.net'

resource swaAppSettings 'Microsoft.Web/staticSites/config@2023-12-01' = {
  name: '${staticSiteName}/appsettings'
  properties: {
    AZURE_STORAGE_CONNECTION_STRING: storageConnectionString
    LOCK_DEADLINE: lockDeadline
  }
  dependsOn: [storageAccount, staticSite]
}

// ============================================================================
// Outputs
// ============================================================================

@description('Static Web App default hostname (used for Cloudflare CNAME)')
output swaHostname string = staticSite.outputs.defaultHostname

@description('Static Web App name')
output swaName string = staticSiteName

@description('Storage Account name')
output storageAccountName string = storageAccount.outputs.name

@description('Command to retrieve the SWA deployment token for GitHub Actions')
output getDeployTokenCommand string = 'az staticwebapp secrets list --name ${staticSiteName} --resource-group <rg-name> --query "properties.apiKey" -o tsv'
