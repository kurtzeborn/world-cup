using './main.bicep'

param location = 'eastus2'
param swaLocation = 'eastus2'
// customDomain: set after DNS CNAME wc.k61.dev → victorious-grass-0910e160f.4.azurestaticapps.net is in place
param lockDeadline = '2026-06-11T19:00:00Z'
param tags = {
  project: 'world-cup'
}
