# FIFA World Cup 2026 Picks — Project Plan

**Domain:** wc.k61.dev  
**Repo:** kurtzeborn/world-cup  
**Status:** Phase 1 Complete / Phase 2 In Progress / All 48 teams confirmed  
**Live:** https://wc.k61.dev

---

## 1. Overview

A web application for making FIFA World Cup 2026 predictions. Users rank teams within each group, pick which 3rd-place teams advance, and complete a knockout bracket that auto-fills based on their group stage picks. Points are awarded for correct predictions with escalating values through each tournament round.

### Key Features
- Microsoft Entra ID authentication (Google to be added post-launch)
- Group stage team ordering (12 groups × 4 teams)
- 3rd-place advancement picks (8 of 12)
- Auto-populated knockout bracket based on group picks
- Escalating scoring system with partial credit
- Global leaderboard + private leagues
- Admin panel for entering actual results (with future API automation)
- All picks lock before the tournament starts (June 11, 2026)

---

## 2. Tournament Format — 2026 FIFA World Cup

### 2.1 Group Stage
- **48 teams** in **12 groups** (A through L) of 4 teams each
- Each team plays 3 group matches (June 11–27, 2026)
- **Top 2 from each group** (24 teams) advance automatically
- **8 best 3rd-place teams** (out of 12) also advance
- **32 total teams** enter the knockout stage

### 2.2 Groups (as drawn December 5, 2025)

| Group | Pot 1 | Pot 2 | Pot 3 | Pot 4 |
|-------|-------|-------|-------|-------|
| A | Mexico (H) | South Africa | South Korea | Czech Republic |
| B | Canada (H) | Bosnia and Herzegovina | Qatar | Switzerland |
| C | Brazil | Morocco | Haiti | Scotland |
| D | United States (H) | Paraguay | Australia | Turkey |
| E | Germany | Curaçao | Ivory Coast | Ecuador |
| F | Netherlands | Japan | Sweden | Tunisia |
| G | Belgium | Egypt | Iran | New Zealand |
| H | Spain | Cape Verde | Saudi Arabia | Uruguay |
| I | France | Senegal | Iraq | Norway |
| J | Argentina | Algeria | Austria | Jordan |
| K | Portugal | DR Congo | Uzbekistan | Colombia |
| L | England | Croatia | Ghana | Panama |

*(H) = Host nation*

**UEFA Playoff results (March 2026):**
- Path A: **Bosnia and Herzegovina** (beat Italy on penalties in final)
- Path B: **Sweden**
- Path C: **Turkey** (beat Kosovo 1-0 in final)
- Path D: **Czech Republic** (beat Denmark on penalties in final)

**Inter-confederation playoff results (March 2026):**
- IC Path 1: **DR Congo**
- IC Path 2: **Iraq**

> **Note:** The app must support updating team names once playoff results are known. Store teams with a stable ID and a display name that can be updated.

### 2.3 3rd-Place Advancement
- 12 third-place teams are ranked by: Points → Goal difference → Goals scored → Team conduct score → FIFA ranking
- Top 8 advance to the Round of 32
- The **specific R32 matchup** for each qualifying 3rd-place team depends on which combination of groups produced the 8 qualifying 3rd-place teams
- FIFA publishes a **495-row lookup table** (Annex C of tournament regulations) mapping each possible combination of qualifying groups to specific bracket positions
- This lookup table **must be implemented** in the application to correctly populate the bracket
- **Edge case:** If 3rd-place ranking produces ties resolved by fair play score or drawing of lots, the final official 8 qualifiers as published by FIFA are authoritative. Admin must enter the exact 8 groups/teams that FIFA publishes.

### 2.4 Knockout Stage Structure
- **Round of 32** (16 matches): June 28 – July 3
- **Round of 16** (8 matches): July 4–7
- **Quarterfinals** (4 matches): July 9–11
- **Semifinals** (2 matches): July 14–15
- **Third-place match**: July 18
- **Final**: July 19

The bracket is split into two halves (pathways). By design, the #1 and #2 ranked teams (Spain, Argentina) and #3 and #4 (France, England) were drawn into opposite pathways, meaning they can only meet in the final if they win their groups.

### 2.5 Round of 32 Fixed Matchups

The R32 matchups are predetermined by the draw. Group winners (1X), runners-up (2X), and 3rd-place qualifiers (3X) are placed as follows:

**Pathway 1 (Semifinal in Arlington):**

| Match | Team A | Team B |
|-------|--------|--------|
| 74 | 1E (Germany) | 3rd from ABCDF |
| 77 | 1I (France) | 3rd from CDFGH |
| 73 | 2A | 2B |
| 75 | 1F (Netherlands) | 2C |
| 83 | 2K | 2L |
| 84 | 1H (Spain) | 2J |
| 81 | 1D (United States) | 3rd from BEFIJ |
| 82 | 1G (Belgium) | 3rd from AEHIJ |

**Pathway 2 (Semifinal in Atlanta):**

| Match | Team A | Team B |
|-------|--------|--------|
| 76 | 1C (Brazil) | 2F |
| 78 | 2E | 2I |
| 79 | 1A (Mexico) | 3rd from CEFHI |
| 80 | 1L (England) | 3rd from EHIJK |
| 86 | 1J (Argentina) | 2H |
| 88 | 2D | 2G |
| 85 | 1K (Portugal) | 3rd from EFGIJ |
| 87 | 1B (Canada) | 3rd from DEIJL |

**Round of 16 matchups:**

| Match | Team A | Team B |
|-------|--------|--------|
| 89 | W74 | W77 |
| 90 | W73 | W75 |
| 91 | W76 | W78 |
| 92 | W79 | W80 |
| 93 | W83 | W84 |
| 94 | W81 | W82 |
| 95 | W86 | W88 |
| 96 | W85 | W87 |

**Quarterfinals:**

| Match | Team A | Team B |
|-------|--------|--------|
| 97 | W89 | W90 |
| 98 | W93 | W94 |
| 99 | W91 | W92 |
| 100 | W95 | W96 |

**Semifinals:**

| Match | Team A | Team B |
|-------|--------|--------|
| 101 | W97 | W98 |
| 102 | W99 | W100 |

**Final:** W101 vs W102  
**Third place:** L101 vs L102

---

## 3. User Experience

### 3.1 Authentication Flow
1. Landing page with tournament branding and "Sign in with Microsoft" button
2. After auth, user sees their pick dashboard (or the pick entry screen if no picks yet)
3. Google sign-in to be added post-launch

### 3.2 Pick Entry — Sliding Panel Layout (Implemented)

The pick entry uses a **horizontal sliding panel** that pairs Groups and Bracket side-by-side. On desktop (≥900px), the bracket peek is visible alongside the groups panel; on smaller screens, users swipe or tap the nav to switch between panels.

> **Layout evolution:** The original plan was a combined side-by-side layout. The first implementation used separate tabbed pages via a hash router. The current implementation is a sliding panel that gives the best of both: groups and bracket are always in the same DOM so they stay in sync, but the user focuses on one panel at a time with smooth transitions.

**Desktop (≥900px):**
```
┌─────────────────────────────────────────────────────────┐
│  HEADER ROW 1: Title                  Auth | Theme      │
│  HEADER ROW 2: Picks | Leaderboard | Leagues            │
├──────────────────────────────┬──────────────────────────┤
│  GROUP STAGE (≤620px)        │ BRACKET (peek 180px)     │
│  "Group Stage" heading       │ Faded gradient overlay   │
│  ┌─ Group A ─┐ ┌─ Group B ─┐│ Click to slide →         │
│  │ 1. Mexico  │ │ 1. Canada ││                          │
│  │ 2. S.Korea │ │ 2. Switz. ││                          │
│  │ 3. S.Africa│ │ 3. Qatar  ││                          │
│  │ 4. PathD   │ │ 4. PathA  ││                          │
│  └────────────┘ └───────────┘│                          │
│  ... Groups C-L (2-col grid) │                          │
│  [Save Picks] [Lock & Submit]│                          │
└──────────────────────────────┴──────────────────────────┘
```

When viewing bracket, 120px of groups peeks from the left.

**Mobile (<900px):**
- No peek overlays; panels are full-width
- Touch swipe left/right to switch panels (with scroll-aware guard — swipe-back is suppressed while user is scrolling bracket content horizontally)
- **Sticky tab bar** (Groups | Bracket) sits below the header and stays visible while scrolling; replaces the earlier floating pill indicator
- **Two-row header:** Row 1 = title + auth status (truncated with ellipsis) + theme toggle; Row 2 = nav links (Picks, Leaderboard, Leagues). Total 68px height.
- "Picks" is a single nav link that covers both Groups and Bracket; the tab bar provides sub-navigation
- Tablet (600–899px): groups use 2-column grid
- Phone (<600px): groups use single-column grid
- Center bracket section (SF → Final → Champion) uses horizontal scroll (`min-width: min-content`) instead of wrapping, keeping all cards in a single row
- Scroll position is preserved when switching panels

### 3.3 Group Stage Interaction
- Each group shows 4 teams in a **click-to-order** sortable list (numbered 1–4)
- Default order matches the draw seeding
- User clicks teams sequentially to assign positions 1st → 2nd → 3rd → 4th
- Clicking a team that's already placed removes it (and shifts later picks up)
- Visual indicators: positions 1-2 highlighted green (auto-advance), position 3 highlighted yellow (possible advance), position 4 grayed out
- **Advance indicators:** 1st and 2nd place show "Advances" text; 3rd place shows "Advance?" with a checkbox to toggle 3rd-place advancement
- Country flags displayed alongside team names (SVG flags from [flagcdn.com](https://flagcdn.com))
- **FIFA World Ranking** displayed subtly next to each team name (superscript link to FIFA rankings page) to help inform picks
- Numbered rank badge (colored circle: green=1st, blue=2nd, orange=3rd, gray=4th) appears in the rank cell

### 3.4 3rd-Place Advancement Picks
- 3rd-place advancement is integrated **inline** within each group card (not a separate section)
- When a team is ranked 3rd, an "Advance?" checkbox appears next to it
- User checks exactly **8 of 12** groups to advance; checkboxes disable at the maximum
- Validation on lock: cannot lock picks until exactly 8 are selected
- The bracket auto-updates in real time as 3rd-place selections change (via state subscription)

### 3.5 Knockout Bracket Interaction
- Bracket **auto-populates** based on group picks + 3rd-place selections
- The 3rd-place teams are placed using the FIFA 495-combination lookup table
- Group winners and runners-up fill their predetermined bracket positions
- User then clicks/taps to select the winner of each R32 match
- Winners cascade forward — selecting a R32 winner fills the R16 slot, etc.
- **Group change impact handling:**
  - When a user changes a group ranking or 3rd-place selection that affects the bracket, a **warning dialog** is shown explaining which bracket picks will be affected
  - Only the **minimum necessary** bracket picks are cleared (e.g., if only one R32 slot changes, only that slot and its downstream picks are reset — not the entire bracket)
  - User can **undo** the group change to restore their bracket picks (single-level undo)
- Visual bracket layout following the standard tournament bracket format (top to bottom, left to right converging to center)
- FIFA World Rankings shown as subtle indicators on bracket matchup cards

### 3.6 Auto-Save
- Picks are **automatically saved as drafts** on every change (debounced, ~2 second delay)
- Since the user is already authenticated, no extra action needed
- Visual save indicator: small "Saved" / "Saving..." status in the header
- Users can close the browser and resume exactly where they left off
- Draft picks are stored server-side (not just localStorage) for cross-device access

### 3.7 Pick Locking
- All picks lock before the first match: **June 11, 2026, kickoff**
- Lock deadline displayed prominently with countdown timer
- Once locked, picks are read-only (viewable but not editable)
- Admin can configure the exact lock datetime

### 3.8 PDF Export
- Users can **export their picks to a PDF** at any time (before or after locking)
- PDF includes:
  - User's display name and export date
  - All 12 group rankings with team flags
  - 3rd-place advancement selections
  - Full knockout bracket with all picks
  - **QR code** linking to the app's landing page (wc.k61.dev) so anyone viewing the PDF can scan to create their own picks
- Generated client-side (e.g., jsPDF or html2pdf.js) — no server cost

### 3.9 Dark Mode
- **System preference detection:** App defaults to the user's OS light/dark mode setting via `prefers-color-scheme` media query
- **Manual override:** Toggle in the header/settings to switch between light, dark, and system-auto modes
- Preference persisted in localStorage
- All UI components (groups, bracket, leaderboard, admin) must support both themes
- Use CSS custom properties (variables) for all colors to make theming straightforward

### 3.10 Icons
- **All icons use [Font Awesome](https://fontawesome.com/)** (free tier)
- Loaded via CDN (`cdnjs.cloudflare.com/ajax/libs/font-awesome/...`)
- Examples: lock icon for deadline, trophy for leaderboard, user-group for leagues, sun/moon for dark mode toggle, file-pdf for export, drag-handle for sortable lists

### 3.11 Leaderboard & Leagues
- **Global leaderboard:** All users ranked by total points, updated as results come in
- **Private leagues:**
  - Any user can create a league (gets a shareable join code)
  - Other users enter the code to join
  - League leaderboard shows only league members
  - A user can be in multiple leagues
- Leaderboard shows: Rank, Display Name, Total Points, Group Points, Knockout Points
- Click on a user to view their full picks (only after lock deadline)

### 3.12 Dashboard
- After picks are locked, the main view becomes a dashboard showing:
  - User's picks with color-coded correctness (green = correct, yellow = partial, red = wrong, gray = pending)
  - Running point total
  - Quick links to leaderboard and leagues
  - Next match countdown
  - Recent results

---

## 4. Scoring System

### 4.1 Group Stage Scoring (per group, max 9 pts)

| Prediction | Points |
|-----------|--------|
| Team correctly picked in exact finishing position (1st, 2nd, or 3rd) | 3 |
| Team correctly predicted to advance (top 2 or qualifying 3rd-place) but in wrong position | 1 |
| 4th place — no points regardless of correctness | 0 |
| Incorrect / team eliminated | 0 |

- Per group: 3 scoreable positions × up to 3 pts = 9 pts max
- Total group stage: 12 groups × 9 pts = **108 pts max**

> **Note:** Users rank all 4 teams 1st through 4th. 4th place earns no points even if correct, keeping the focus on identifying advancing teams.

### 4.2 3rd-Place Advancement Scoring

| Prediction | Points |
|-----------|--------|
| Correctly picked a 3rd-place team to advance (and they did) | 2 |
| Picked a 3rd-place team to advance but they didn't | 0 |

- 8 picks × 2 pts = **16 pts max**

### 4.3 Knockout Stage Scoring

| Round | Correct pick (right position) | Partial credit (team won but wrong bracket slot) | Max per round |
|-------|------------------------------|--------------------------------------------------|---------------|
| Round of 32 (16 matches) | 2 | 1 | 32 |
| Round of 16 (8 matches) | 4 | 2 | 32 |
| Quarterfinals (4 matches) | 8 | 4 | 32 |
| Semifinals (2 matches) | 16 | 8 | 32 |
| Third-place match (1 match) | 16 | 8 | 16 |
| Final (1 match) | 32 | 16 | 32 |

**"Right position"** (full credit) means the team is in the exact bracket slot the user predicted (i.e., they advanced from the correct path through the correct matchups).

**"Partial credit"** applies when a team the user predicted to win a given round **did win in that round in real life**, but arrived at a **different bracket position** than the user predicted. In other words: the winning team is correct regardless of the path it took to get there. If you picked Team X to win in the quarterfinals and Team X does win a quarterfinal match — but in a different quarter of the bracket than you predicted — you receive partial credit.

> **Clarification:** Partial credit is awarded based solely on whether the team advanced in the correct round, not whether the matchup was correct. This is the most generous interpretation and avoids penalizing users for cascading 3rd-place placement differences. Full detailed rules are documented in [docs/rules.md](rules.md).

### 4.4 Maximum Points Summary

| Category | Max Points |
|----------|-----------|
| Group stage (12 groups) | 108 |
| 3rd-place advancement | 16 |
| Round of 32 | 32 |
| Round of 16 | 32 |
| Quarterfinals | 32 |
| Semifinals | 32 |
| Third-place match | 16 |
| Final | 32 |
| **Total** | **300** |

### 4.5 Tiebreakers
If users are tied on points:
1. Most correct exact group positions
2. Most correct knockout picks (by round, starting from Final working backward)
3. Earlier submission timestamp

---

## 5. Technical Architecture

### 5.1 Tech Stack

| Component | Technology | Tier/Cost |
|-----------|-----------|-----------|
| Hosting | Azure Static Web Apps | Free tier |
| Frontend | Vanilla HTML/CSS/JS with Vite bundler | — |
| Backend API | Azure Functions (managed, within SWA) | Included in free SWA |
| Database | Azure Table Storage | Pay-per-use (~$0/month at this scale) |
| Static assets | Azure Blob Storage | Pay-per-use (pennies) |
| Auth | SWA built-in auth (Microsoft provider) | Free |
| Domain | wc.k61.dev (custom domain on SWA) | Already owned |
| CI/CD | GitHub Actions (SWA deploys) | Free for public repos |
| Flags | flagcdn.com (SVG) | Free CDN |
| Icons | Font Awesome (free tier) | Free CDN |
| PDF export | jsPDF + html2canvas (client-side) | Free (npm) |

**Why Vanilla JS instead of React/Vue?**
- SWA free tier has no build-time restrictions, but keeping the bundle small keeps load times fast
- Drag-and-drop and bracket rendering can be done with the HTML Drag and Drop API + CSS Grid
- If complexity warrants it during development, we can add Preact (3KB) as a lightweight option
- No SSR needed — all rendering is client-side

**Alternative considered:** SvelteKit — lightweight, good DX, but adds build complexity. Vanilla JS preferred for simplicity; can upgrade later.

### 5.2 Azure Static Web Apps — Built-in Auth

SWA provides built-in authentication with zero custom code for the auth flow itself:

- Microsoft (Entra ID) provider enabled by default: `/.auth/login/aad`
- Google provider can be enabled later: `/.auth/login/google`
- User info available at `/.auth/me` endpoint
- Role-based access via `staticwebapp.config.json` routes
- Built-in `/.auth/logout` endpoint

**No MSAL library or custom OAuth code needed.** SWA handles the full OAuth redirect flow.

```json
// staticwebapp.config.json example
{
  "routes": [
    { "route": "/api/*", "allowedRoles": ["authenticated"] },
    { "route": "/admin/*", "allowedRoles": ["admin"] }
  ],
  "responseOverrides": {
    "401": { "redirect": "/.auth/login/aad" }
  }
}
```

### 5.3 Project Structure

```
world-cup/
├── .github/
│   ├── workflows/
│   │   ├── deploy.yml              # SWA deploy via SWA token (push to main)
│   │   └── infra.yml               # Bicep deploy via OIDC (infra/** changes)
│   └── copilot-instructions.md
├── .gitignore
├── docs/
│   ├── plan.md                      # This file
│   └── rules.md                     # Scoring rules (user-facing + internal reference)
├── staticwebapp.config.json         # SWA routing + auth config
├── web/                             # Frontend (SWA app_location)
│   ├── index.html                   # Main SPA entry point
│   ├── vite.config.js
│   ├── package.json
│   └── src/
│       ├── main.js                  # App entry + hash router + auth init
│       ├── auth.js                  # Auth helpers (/.auth/me wrapper)
│       ├── api.js                   # API client (all endpoint wrappers)
│       ├── state.js                 # Global app state (user, picks, teams, locked)
│       ├── favicon.svg
│       ├── style.css                # Global styles
│       ├── data/
│       │   ├── teams.js             # 48 teams (flags, groups, seeds, FIFA rankings)
│       ├── bracket-structure.js # R32‑F matchup definitions + BRACKET_STRUCTURE + MATCH_SCHEDULE
│       │   └── third-place-table.js # 495-row 3rd-place placement lookup table
│       └── pages/
│           ├── groups.js            # Group stage reordering + 3rd-place picker
│           ├── bracket.js           # Knockout bracket auto-fill + winner selection
│           ├── leaderboard.js       # Global leaderboard display
│           └── leagues.js           # Create/join leagues + league leaderboard
├── functions/                       # Azure Functions TypeScript (SWA api_location)
│   ├── package.json
│   ├── host.json
│   ├── tsconfig.json
│   └── src/
│       ├── functions/
│       │   ├── me.ts                # GET/PUT /api/me
│       │   ├── teams.ts             # GET /api/teams
│       │   ├── picks.ts             # GET/PUT/POST /api/picks
│       │   ├── results.ts           # GET /api/results
│       │   ├── leaderboard.ts       # GET /api/leaderboard[/:leagueId]
│       │   ├── leagues.ts           # GET/POST /api/leagues, POST /api/leagues/join
│       │   ├── admin-results.ts     # POST /api/admin/results
│       │   └── admin-teams.ts       # PUT /api/admin/teams/:id
│       └── shared/
│           ├── auth.ts              # SWA user header parsing + role checks
│           ├── storage.ts           # Azure Table Storage client + helpers
│           └── types.ts             # Shared TypeScript interfaces
├── infra/
│   ├── main.bicep                   # Storage Account (7 tables) + SWA + app settings
│   └── main.bicepparam              # eastus2, wc.k61.dev, lock deadline
└── tools/
    ├── parse-annex-c.js             # Source tool: extract Annex C from FIFA PDF
    ├── gen-third-place-table.js     # Build third-place-table.js
    └── generate-third-place-table.js
```

### 5.4 Data Model — Azure Table Storage

#### Teams Table
| Field | Type | Description |
|-------|------|-------------|
| PartitionKey | string | `"team"` |
| RowKey | string | Team ID (e.g., `"MEX"`, `"BRA"`) |
| name | string | Display name (e.g., `"Mexico"`) |
| group | string | Group letter (e.g., `"A"`) |
| groupSeed | number | Draw position in group (1-4) |
| flagCode | string | ISO country code for flag display (used with flagcdn.com) |
| fifaRanking | number | Current FIFA World Ranking (updated periodically by admin) |
| confirmed | boolean | `false` for playoff TBD teams |

#### Users Table
| Field | Type | Description |
|-------|------|-------------|
| PartitionKey | string | `"user"` |
| RowKey | string | User ID (from SWA auth) |
| displayName | string | Custom display name (user-chosen, shown on leaderboard) |
| authProvider | string | `"aad"` or `"google"` |
| createdAt | string (ISO datetime) | First login |
| updatedAt | string (ISO datetime) | Last profile update |

#### Picks Table
| Field | Type | Description |
|-------|------|-------------|
| PartitionKey | string | User ID (from SWA auth) |
| RowKey | string | `"picks"` |
| groupPicks | string (JSON) | `{ "A": ["MEX","KOR","RSA","TBD_D"], "B": [...], ... }` |
| thirdPlaceAdvancing | string (JSON) | `["A","C","E","F","G","H","J","K"]` (group letters) |
| bracketPicks | string (JSON) | `{ "R32_74": "GER", "R32_77": "FRA", "R16_89": "FRA", ... }` |
| lockedAt | string (ISO datetime) | When picks were finalized |
| updatedAt | string (ISO datetime) | Last modification (auto-save timestamp) |

#### Results Table
| Field | Type | Description |
|-------|------|-------------|
| PartitionKey | string | `"result"` |
| RowKey | string | Match identifier (e.g., `"GROUP_A"`, `"R32_74"`, `"R16_89"`) |
| data | string (JSON) | Group standings or match winner |
| enteredBy | string | Admin user ID |
| enteredAt | string (ISO datetime) | When result was entered |

#### Leagues Table
| Field | Type | Description |
|-------|------|-------------|
| PartitionKey | string | `"league"` |
| RowKey | string | League ID (generated) |
| name | string | League display name |
| joinCode | string | 6-character shareable code |
| createdBy | string | User ID of creator |
| createdAt | string (ISO datetime) | Creation time |

#### League Members Table
| Field | Type | Description |
|-------|------|-------------|
| PartitionKey | string | League ID |
| RowKey | string | User ID |
| joinedAt | string (ISO datetime) | When user joined |

#### Scores Table (Computed/Cached)
| Field | Type | Description |
|-------|------|-------------|
| PartitionKey | string | `"score"` |
| RowKey | string | User ID |
| totalPoints | number | Total score |
| groupPoints | number | Points from group stage |
| thirdPlacePoints | number | Points from 3rd-place picks |
| knockoutPoints | number | Points from knockout picks |
| breakdown | string (JSON) | Detailed breakdown by round |
| calculatedAt | string (ISO datetime) | Last recalculation time |

### 5.5 API Endpoints

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET | `/api/me` | authenticated | Get current user info + display name |
| PUT | `/api/me` | authenticated | Update display name |
| GET | `/api/picks` | authenticated | Get current user's picks (including drafts) |
| PUT | `/api/picks` | authenticated | Auto-save / update picks (before lock) |
| POST | `/api/picks/lock` | authenticated | Lock picks (one-way) |
| GET | `/api/picks/:userId` | authenticated | View another user's picks (post-lock only) |
| GET | `/api/leaderboard` | authenticated | Global leaderboard |
| GET | `/api/leaderboard/:leagueId` | authenticated | League leaderboard |
| POST | `/api/leagues` | authenticated | Create a league |
| POST | `/api/leagues/join` | authenticated | Join a league by code |
| GET | `/api/leagues` | authenticated | List user's leagues |
| PUT | `/api/leagues/:leagueId` | authenticated | Rename a league (creator only) |
| DELETE | `/api/leagues/:leagueId/members/:userId` | authenticated | Remove a league member (creator only) |
| GET | `/api/results` | authenticated | Get current tournament results |
| GET | `/api/teams` | anonymous | Get team list (public) |
| POST | `/api/admin/results` | admin | Enter/update match results |
| PUT | `/api/admin/teams/:id` | admin | Update team name (for playoffs) |
| POST | `/api/admin/recalculate` | admin | Recalculate all scores |

### 5.6 Auth & Role Management

- **SWA built-in auth** handles login/logout/session
- **Admin role:** Assigned via SWA role management (Azure portal → SWA → Role management → invite specific user as "admin")
- **Authenticated role:** All logged-in users automatically get the `authenticated` role
- Routes protected via `staticwebapp.config.json` (see 5.2)

---

## 6. Admin Features

### 6.1 Result Entry (Phase 1 — Manual)
- Admin-only page at `/admin`
- **Group Results:** For each group, admin enters final standings (1st through 4th)
- **3rd-Place Ranking:** Admin enters the exact 8 groups whose third-place teams qualified, as officially published by FIFA (including any tiebreakers resolved by fair play or drawing of lots)
- **Knockout Results:** For each match, admin selects the winner
- After each entry, scores are recalculated for all users

### 6.2 Team Name Updates
- Before playoffs conclude (March 2026), TBD teams show placeholder names
- Admin can update team names once playoff results are known
- This updates the Teams table; users' picks reference team IDs (not names) so picks are unaffected

### 6.3 Automated Results (Phase 2 — Future)
- Scheduled Azure Function polls a sports data API for live results
- Candidate APIs (to evaluate):
  - [Football-Data.org](https://www.football-data.org/) — free tier available
  - [API-Football](https://www.api-football.com/) — free tier with limits
  - [FIFA's own data feeds](https://www.fifa.com/) — if publicly available
- Function runs every 5 minutes during match windows
- Auto-enters results and triggers score recalculation
- Admin can override any auto-imported result

---

## 7. Deployment & Infrastructure

### 7.1 Azure Resources Needed

| Resource | SKU | Estimated Cost |
|----------|-----|---------------|
| Azure Static Web App | Free tier | $0/month |
| Azure Storage Account (Table + Blob) | Standard LRS | ~$0.01–0.10/month |
| **Total** | | **< $1/month** |

### 7.2 GitHub Actions CI/CD

Two workflows:

**`deploy.yml`** — triggered on push to `main`:
- Build Vite frontend + TypeScript functions
- Deploy to SWA via `AZURE_STATIC_WEB_APPS_API_TOKEN`
- `app_location: "web"`, `api_location: "functions"`, `output_location: "dist"`
- No PR staging environments (direct push to main workflow only)

**`infra.yml`** — triggered on changes to `infra/**` + `workflow_dispatch`:
- Authenticates via **OIDC** (no long-lived secrets) using `sp-wc-deploy` service principal
- Deploys `infra/main.bicep` via `azure/arm-deploy@v2`
- Scoped to `rg-world-cup` only (least privilege)

GitHub secrets set: `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID`, `AZURE_STATIC_WEB_APPS_API_TOKEN`

### 7.3 Custom Domain Setup

1. Create SWA resource in Azure
2. Add custom domain `wc.k61.dev` in SWA settings
3. Create CNAME record: `wc.k61.dev` → SWA auto-generated hostname
4. SWA provisions free SSL certificate automatically

### 7.4 Environment Configuration

- **Storage connection string:** Set as SWA application setting (not in code)
- **Lock deadline:** Configurable app setting (ISO datetime)
- **Admin user IDs:** Managed via SWA Role Management in Azure portal

---

## 8. 3rd-Place Lookup Table Implementation

This is a critical and complex piece. FIFA's Annex C defines **495 combinations** of which 8 groups (out of 12) produce advancing 3rd-place teams, and for each combination, which specific R32 match each 3rd-place team is assigned to.

### 8.1 Data Source — CRITICAL

> **The 495-row table MUST be sourced from the official FIFA regulations PDF**, not from Wikipedia or fan recreations. Small transcription errors in 495 rows will silently break bracket population for some users.

**Steps to obtain:**
1. Download the official "FIFA World Cup 2026™ Regulations" document from [digitalhub.fifa.com](https://digitalhub.fifa.com)
2. Locate **Annex C** — the complete mapping of 3rd-place qualifying group combinations to R32 bracket slots
3. Extract all 495 rows programmatically (OCR or manual with double-verification)
4. **Cross-verify** against the Wikipedia partial table and at least one other independent source
5. Write unit tests covering every single combination

**Similarly**, the bracket match numbering (73–88 for R32, 89–96 R16, etc.) and opponent descriptions must be cross-checked against the **official match schedule PDF** from digitalhub.fifa.com — early fan summaries sometimes contain small discrepancies in which third-place groups feed into which R32 match.

### 8.2 Data Structure & Storage

The table is stored as a **minified JS module** (tree-shakeable, included in the client bundle). At ~495 entries × ~50 bytes each, the raw JSON is ~25KB, which is acceptable for the client bundle. If size becomes a concern, it can be gzip-compressed in Blob Storage and fetched on demand.

```javascript
// Each entry: [qualifying groups] → [bracket slot assignments]
// Bracket slots correspond to R32 match positions for 3rd-place teams
const THIRD_PLACE_TABLE = {
  // Key: sorted string of qualifying group letters (e.g., "ABCDEFGH")
  // Value: array of 8 entries mapping [groupLetter, R32MatchNumber]
  "EFGHIJKL": [
    ["E", 74], // 3E goes to Match 74
    ["J", 77], // 3J goes to Match 77 (vs 1I)
    ["I", 79], // ...
    ["F", 80],
    ["H", 82],
    ["G", 81],
    ["L", 85],
    ["K", 87]
  ],
  // ... 494 more entries
};
```

### 8.3 Simplification for User Picks

Since picks lock before the tournament, the user's bracket auto-fills based on their predictions. When a user:
1. Ranks all 12 groups → determines predicted 3rd-place team per group
2. Selects 8 of 12 to advance → determines the combination
3. App looks up that combination in the table → places 3rd-place teams into correct R32 slots
4. R32 bracket is fully populated → user picks winners from there

If the user changes group rankings or 3rd-place selections, **only the affected bracket slots are cleared** (with a warning — see section 3.5).

---

## 9. Implementation Phases

### Phase 0 — Documentation (Target: March 2026)
- [x] Finalize `docs/rules.md` scoring rules document
- [x] Download official FIFA regulations PDF and extract Annex C
- [x] Cross-verify bracket match numbering against official match schedule PDF
- [x] Source and verify all 48 team FIFA World Rankings

### Phase 1 — Foundation ✅ Complete
- [x] Set up SWA + storage account in Azure (`swa-wc-prod`, `stwcjafnrgdxqw3v4`, `rg-world-cup`)
- [x] Configure GitHub Actions deployment (two workflows: `deploy.yml` via SWA token, `infra.yml` via OIDC)
- [x] Implement SWA built-in Microsoft auth (`staticwebapp.config.json`)
- [x] Build Teams data file with all 48 teams (placeholders for TBD) + FIFA rankings
- [x] Build the 495-row 3rd-place lookup table (from official Annex C)
- [x] Create API endpoints: all endpoints from section 5.5 implemented as TypeScript Functions
- [x] Basic SPA with hash router, auth header, per-page loading
- [x] Custom domain live with HTTPS (`wc.k61.dev`)
- [x] Dark mode support (CSS custom properties + system preference detection)
- [x] Font Awesome integration

### Phase 2 — Pick Entry (Target: May 2026)
- [x] Group stage UI with click-to-reorder team ordering (FIFA rankings shown)
- [x] 3rd-place advancement picker (inline checkbox per group, select 8 of 12)
- [x] Knockout bracket auto-fill from group + 3rd-place picks (3rd-place table used)
- [x] Knockout bracket winner selection UI
- [x] Pick locking (deadline-only enforcement, no manual lock button — picks editable until first match)
- [x] Bracket CSS connector lines between rounds
- [x] Match info bars showing match number, date, and city (MATCH_SCHEDULE data)
- [x] Champion winner card (gold border) and 3rd Place winner card (bronze border)
- [x] Center section with SF → Final bracket + TPM section
- [x] Cascade-clear invalid downstream bracket picks on change
- [x] Sliding panel layout (Groups ↔ Bracket with peek overlays and transitions)
- [x] Live bracket sync (bracket re-renders on group/3rd-place pick changes via state subscription)
- [x] Advance indicators ("Advances" for 1st/2nd, "Advance?" checkbox for 3rd)
- [x] Mobile-responsive layout (touch swipe, scroll preservation, tablet 2-col, phone 1-col)
- [x] Two-row header for mobile (title+auth top, nav bottom) with auth email truncation
- [x] Sticky tab bar (Groups | Bracket) replacing floating pill indicator
- [x] Merged Groups/Bracket into single "Picks" nav link with tab bar sub-navigation
- [x] Swipe-back guard (suppresses panel switch while user is scrolling bracket content)
- [x] Center bracket horizontal scroll (no-wrap) for narrow screens
- [x] Auto-save draft picks on every change (replaces manual Save/Lock buttons; 2s debounce, localStorage + server)
- [x] Countdown timer to lock deadline (header row 1, "⏱ Xd Xh" format, updates every 60s)
- [x] Drag-and-drop reordering for group stage (SortableJS, desktop-only via pointer:fine media query)
- [x] Progressive auth prompt (modal after 4 groups completed, sessionStorage dismissal)
- [x] PDF export (jsPDF text API, lazy-loaded via dynamic import, group + knockout picks, no QR code)
- [x] Save indicator in tab bar ("Saving…" / "✓ Saved" / "⚠ Save failed")
- [x] Display ordering (ranked teams shown first in rank order, then unranked in draw order)
- [x] Custom display name prompt on first login (blocking modal after auth, lazy uniqueness check, editable via pencil icon)
- [x] Picks status bar (sticky below tabs: display name + pencil left, completeness X/88 right)

### Phase 3 — Social & Scoring (Target: Late May 2026)
- [x] Leaderboard API and UI
- [x] League create/join flow API and UI
- [x] Scoring engine (server-side, full scoring logic implemented with breakdown tracking)
- [x] View other users' picks (post-lock, read-only picks page with groups + bracket)

### Phase 4 — Admin & Polish (Target: Early June 2026)
- [x] Admin result entry API (`admin-results.ts`)
- [x] Admin team name update API (`admin-teams.ts`)
- [x] Custom domain setup (`wc.k61.dev` — CNAME + Azure binding complete)
- [x] Admin page UI at `/admin` (form-based results entry with groups/3rd-place/knockout)
- [x] Score recalculation on manual trigger (admin button in admin page)
- [x] Dashboard view (post-lock, showing picks vs results with color coding)
- [x] Add Google auth provider (federated identity with Azure AD)

### Phase 5 — Future Enhancements
- [ ] Automated results from sports API
- [ ] Email/push notifications for result updates
- [ ] Pick sharing (social media cards)
- [ ] Historical data (if reused for future tournaments)
- [ ] Pre-production environment

---

## 10. Key Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|-----------|
| TBD playoff teams not resolved in time | Users can't complete picks | Allow saving partial picks; update team names via admin once known |
| 3rd-place lookup table errors | Wrong bracket matchups | Source from official FIFA PDF (Annex C); cross-reference multiple sources; unit test all 495 combinations |
| SWA free tier limits (100GB bandwidth) | Site goes down during peak | Monitor usage; upgrade to Standard ($9/mo) if needed |
| Scoring edge cases (e.g., team in wrong bracket slot but still wins) | Unfair scoring | Define clear rules; partial credit handles most cases |
| Lock deadline timezone confusion | Some users lock late | Show deadline in user's local timezone with prominent countdown |
| Azure Table Storage query limitations | Slow leaderboard | Pre-compute scores in Scores table; update on result entry |

---

## 11. Resolved Decisions

| Decision | Resolution |
|----------|------------|
| Flag assets | **flagcdn.com** (SVG) — reliable, fast, consistent cross-platform rendering |
| Username display | **Custom display name** — user sets on first login; Microsoft account names are often emails/full names which are bad for leaderboards |
| Pick visibility | No — users cannot see others' picks before the lock deadline; only after lock |
| Late registration | Yes — users can sign up and make picks any time before the lock deadline |
| Icons | **Font Awesome** (free tier via CDN) for all icons |
| Dark mode | **System preference detection** with manual override toggle |
| Scoring rules doc | Created as `docs/rules.md` — maintained as source of truth, shown in-app on a rules page |
| Pick entry layout | **Sliding panel** — Groups and Bracket share a horizontal slide track with peek overlays on desktop and swipe gestures on mobile. Hash router still used for all pages but Groups/Bracket are co-rendered in the same DOM for live sync. Evolved from tabbed pages → sliding panels. |
| Mobile header | **Two-row layout** — Row 1: title + auth (email truncated with ellipsis) + theme toggle (rightmost). Row 2: nav links (Picks, Leaderboard, Leagues). 68px total height. |
| Mobile sub-nav | **Sticky tab bar** (Groups \| Bracket) replaces the floating pill indicator. Sits outside `.slide-container` so `position: sticky` works. Tab bar always visible, syncs active state with slide position. |
| Nav consolidation | Groups and Bracket merged under single **"Picks"** nav link; tab bar handles sub-navigation between the two panels. |
| Layout constants | Groups panel capped at 620px, bracket peek 180px (right) / 120px (left), 24px gap, peek hidden below 900px |
| 3rd-place UX | **Inline per-group** — "Advance?" checkbox appears on the 3rd-ranked team in each group card, replacing the separate counter/picker section |
| Deploy workflow | **Push to main only** — removed PR trigger and staging environments (close_pull_request job) |
| Bracket info | **Match info bars** between team rows showing match number, date, and city from FIFA schedule |
| Winner display | **Fixed-width cards** (180px) for Champion (gold) and 3rd Place (bronze) to prevent layout shifts |
| Pick locking | **Deadline-only** — no manual lock/submit button. Picks remain editable until `LOCK_DEADLINE` (first match kickoff). Server enforces deadline via timestamp check. |
| Auto-save | **Debounced (2s)** — saves to localStorage always, debounces server save when logged in. Replaces manual Save/Lock buttons entirely. Save indicator in tab bar shows status. |
| Drag-and-drop | **SortableJS, desktop-only** — drag handles appear on fully-ranked groups when `pointer: fine` media query matches. Not shown on touch devices (click-to-rank is the mobile UX). |
| Progressive auth | **Modal after 4 groups completed** — anonymous users see a sign-in prompt modal after completing 4 group rankings. Dismissible (tracked in sessionStorage). Picks saved to localStorage for anonymous users, synced to server on login. |
| PDF export | **jsPDF text API, lazy-loaded** — code-split via dynamic import (~393KB only loaded on click). Page 1: group stage (4-col layout, color-coded ranks, 3rd-place advance markers). Page 2: knockout stage by round. No QR code for now. |
| Bracket warnings | **Skipped** — cascade-clear remains silent. Warning + undo adds complexity for minimal user value. |
| Display name | **Blocking modal after first login** — required before interacting with picks. 2–30 chars, lazy uniqueness check (single query, race conditions OK). Changeable via pencil icon in picks status bar. Stored in Users table. Header keeps showing email; display name only in picks status bar. |
| Picks status bar | **Sticky below tabs** — `.picks-sticky-header` wraps tab bar + status bar. Left: display name + pencil edit icon. Right: completeness counter (X/88 = 48 group ranks + 8 third-place advances + 32 bracket winners). Turns green when complete. |

## 12. Open Questions

1. **League size limits:** Should there be a max number of members per league?
2. **Scoring rules page:** Should the rules page be accessible before login (public) or only after auth?
