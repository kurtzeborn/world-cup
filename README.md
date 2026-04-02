# FIFA World Cup 2026 Picks

[![deploy](https://img.shields.io/github/actions/workflow/status/kurtzeborn/world-cup/deploy.yml?label=deploy)](https://github.com/kurtzeborn/world-cup/actions/workflows/deploy.yml)

A web app for predicting the outcome of all 104 matches in the 2026 FIFA World Cup. Players rank group stage teams, select third-place advancers, and fill out a knockout bracket. Points are awarded for correct predictions with escalating values through each round.

**Live at [wc.k61.dev](https://wc.k61.dev)**

## Tech Stack

- **Frontend:** Vanilla HTML/CSS/JS with Vite
- **Backend:** Azure Functions (TypeScript) via Azure Static Web App
- **Database:** Azure Table Storage
- **Auth:** Microsoft Entra ID + Google (SWA custom auth)
- **CI/CD:** GitHub Actions

## Project Structure

```
web/          → Frontend SPA (Vite)
functions/    → Azure Functions API (TypeScript)
infra/        → Bicep infrastructure templates
docs/         → Project documentation
tools/        → Setup and utility scripts
```

## Documentation

- [Project Plan](docs/plan.md) — feature roadmap and implementation details
- [Scoring Rules](docs/rules.md) — how picks are scored across all rounds
- [Deployment Guide](docs/DEPLOYMENT.md) — one-time Azure/GitHub setup steps
- [Test Plan](docs/test_plan.md) — pre-launch end-to-end testing checklist

## Development

```powershell
# Start the functions API locally
cd functions
npm install
npm run start

# Start the frontend dev server
cd web
npm install
npm run dev
```
