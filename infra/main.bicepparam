using './main.bicep'

param location = 'eastus2'
param swaLocation = 'eastus2'
param customDomain = 'wc.k61.dev'
param lockDeadline = '2026-06-11T19:00:00Z'
param tags = {
  project: 'world-cup'
}
