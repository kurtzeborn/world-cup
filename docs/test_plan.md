# FIFA World Cup 2026 Picks — Pre-Launch Test Plan

**Goal:** Verify that picks, result entry, score calculation, dashboard display, and leaderboard all work end-to-end before opening to real users.  
**Window:** March 9–12, 2026 (before playoff results are finalized on ~March 26)

> **Scoring logic is covered by automated tests** (`cd functions && npm test`). This plan covers the UI and end-to-end flow only.

---

## 1. Setup

### 1.1 Test Accounts

You need **at least 2 test accounts** (one for T1, two for T2). Options:
- Your normal admin account (scott@kurtzeborn.org via Microsoft)
- A second Google or Microsoft account

For each account, sign in at [wc.k61.dev](https://wc.k61.dev), set a display name, and create picks as described in the test scenarios below.

### 1.2 Force-Locking Picks

The UI does not have a lock button (deadline is June 11). To lock picks for testing, call the lock API directly after completing all picks in the browser.

**Step 1:** In the browser, open DevTools → Application → Cookies → copy the `StaticWebAppsAuthCookie` value.

**Step 2:** Run this PowerShell (replace `<cookie>` with the value from Step 1):

```powershell
$headers = @{ Cookie = "StaticWebAppsAuthCookie=<cookie>" }
Invoke-RestMethod -Uri "https://wc.k61.dev/api/picks/lock" -Method Post -Headers $headers
```

Expected response: `{ "lockedAt": "2026-03-09T...", "deadline": "2026-06-11T19:00:00Z" }`

If you get a 400 error, it means your picks are incomplete (all 12 groups, 8 3rd-place selections, and all 32 bracket winners are required).

**To re-test with different picks:** Picks cannot be unlocked once locked. Use a different test account for each distinct test scenario.

### 1.3 Entering Results as Admin

1. Sign in as your admin account
2. Navigate to `wc.k61.dev/#admin`
3. Fill in the form (see individual test scenarios for specific values)
4. Click **Save Results** → confirm green "✓ Results saved"
5. Click **Recalculate Scores** → confirm "✓ Recalculated X scores"

> **Note:** All 32 knockout match winners must be entered before the form will save. For early test scenarios focused on group stage, you can use the same team for all knockout matches (e.g., always pick the first listed team) — it won't affect the group/3rd-place scores you're testing.

### 1.4 Admin Form: 3rd/4th Place Inference

The admin form only asks for **1st and 2nd place** per group. 3rd and 4th place are inferred by seed order: the two remaining teams are sorted by `groupSeed`, with the **lower seed number assigned 3rd** and the higher seed assigned 4th.

> **Example**: Group A teams by seed: Mexico(1), South Africa(2), South Korea(3), UEFA Path D(4).  
> If you enter 1st=South Korea, 2nd=South Africa → remaining = Mexico(seed 1) and UEFA Path D(seed 4).  
> Admin form assigns: **3rd = Mexico** (seed 1, lower), **4th = UEFA Path D** (seed 4, higher).

**Important for test design:** When you want a specific team to be 3rd in the final results (for exact-position scoring tests), check which team among the two remaining has the lower seed number.

### 1.5 Verifying Scores

After entering results and recalculating:
- **Dashboard:** Sign in as the test user → navigate to `wc.k61.dev/#dashboard`
- **Leaderboard:** Navigate to `wc.k61.dev/#leaderboard`
- **Score breakdown in storage (advanced):** Use Azure Storage Explorer → Table `Scores` → find the row for your test user's ID. The `breakdown` column contains a JSON object with per-pick scoring detail.

---

## 2. Test Scenarios

Use **Group A** for group-stage tests (teams: Mexico seed 1, South Africa seed 2, South Korea seed 3, UEFA Path D seed 4).

---

### T1 — Scoring UI: Green / Yellow / Red Across All Categories

**Purpose:** See all three scoring states (exact, partial, zero) in the dashboard across group, 3rd-place, and knockout categories in a single pass.

**Account A picks (Group A):**
- 1st: Mexico, 2nd: South Africa, 3rd: South Korea, 4th: UEFA Path D
- Check Group A 3rd-place advance box
- Bracket: pick **Germany** to win R32 Match 74, pick **Brazil** to win R16 Match 89, pick any team to win all other knockout slots

**Results to enter as admin:**
- Group A: 1st = Mexico, 2nd = **South Korea**  
  (infers: 3rd = South Africa [seed 2 < seed 4], 4th = UEFA Path D)  
  → Mexico exact (green), South Africa picked 2nd but finished 3rd + advance box checked (yellow), South Korea picked 3rd but finished 2nd (yellow), UEFA Path D 4th (no points)
- 3rd-place advancing: check Group A (South Africa is the actual 3rd — she advances → 2 pts)
- Knockout: Mark **Germany** as winner of Match **73** (not 74 — different R32 slot) → partial credit on R32_74
- Mark any team other than Brazil as winner of Match 89 → Brazil doesn't appear as winner anywhere → 0 pts on R16_89
- Fill remaining knockout matches with any teams

**Expected:**
- Group A: Mexico green (3 pts), South Africa yellow (1 pt), South Korea yellow (1 pt), UEFA Path D none
- 3rd-place: Group A correct → 2 pts
- Knockout: R32_74 Germany yellow (1 pt partial), R16_89 Brazil red (0 pts)

**Pass criteria:**
- [ ] Dashboard group rows show mix of green, yellow, and no-indicator
- [ ] Knockout bracket shows a yellow (partial) slot for Match 74 and red for Match 89
- [ ] Score breakdown in leaderboard reflects correct point totals

---

### T2 — Tiebreaker Verification

**Purpose:** Verify that tied total scores are ranked by correct exact group positions.

**Setup:** Two test accounts with the same total points but different distributions.

**Account A picks:** Maximize exact group positions + accept some partial knockout picks → target ~150 pts total  
**Account B picks:** More partial group positions + more exact knockout picks → same ~150 pts total

Design picks and results so Account A ends up with more exact group position hits.

**Expected:** Account A ranks above Account B on the leaderboard despite equal total points.

**Pass criteria:**
- [ ] Leaderboard shows Account A above Account B at the same point total

---

## 3. Regression Checklist

After running all test scenarios, verify the following end-to-end:

### Picks Entry
- [ ] All 12 groups can be ranked (click-to-order and drag-and-drop)
- [ ] Bracket auto-populates as group picks change
- [ ] 3rd-place advance checkbox enables/disables at 8-pick maximum
- [ ] Auto-save fires after changes (tab bar shows "✓ Saved")
- [ ] Picks persist on page reload (localStorage + server roundtrip)
- [ ] Completeness counter reaches 88/88 when all picks are complete

### Admin
- [ ] Group results save without error (all 12 groups with valid 1st and 2nd)
- [ ] Error shown if fewer than 8 3rd-place advancing teams are checked
- [ ] Error shown if any knockout match is missing a winner
- [ ] "Recalculate Scores" updates the Scores table and leaderboard

### Scoring & Dashboard
- [ ] Dashboard does not appear (or shows "no results yet") if admin has not entered results
- [ ] After results + recalculation, dashboard shows color-coded rows
- [ ] Score totals on leaderboard match sum of group + 3rd-place + knockout breakdown

### Leaderboard & Leagues
- [ ] Global leaderboard ranks users correctly by total score
- [ ] Can create a league and get a join code
- [ ] Second account can join the league with that code
- [ ] League leaderboard shows only league members with correct scores

---

## 4. Known Limitations

### Admin Form: 3rd/4th Place Inference
The admin form does not accept 3rd and 4th place directly — they are inferred from the two remaining teams sorted by seed number (lower seed = 3rd, higher seed = 4th). This means:
- You **cannot test exact 3rd-place scoring** for a team with a higher seed number than the other remaining team.
- Workaround: When designing test cases, choose 1st/2nd place entrants such that the remaining lower-seed team is the one you want to test as 3rd.
- Future improvement: Add explicit 3rd/4th place dropdowns to the admin form.

### Admin Must Enter All 32 Knockout Matches
The form validates all 32 matches before saving. For group-stage-only tests, pick any team for all knockout slots to satisfy the validation.

### Multiple Test Accounts Are Needed
Each locked set of picks is permanent. Plan your test scenarios in advance and use one account per distinct pick configuration.

### TBD Teams
Six group slots are still TBD (playoff results due March 26). If you order a group containing a TBD team, the TBD team can still be picked and scored — it just shows as a placeholder name. Avoid testing with TBD teams in critical scoring positions until their names are updated.

---

## 5. Issue Log

Record issues found during testing here. Include: date, test scenario, steps to reproduce, expected vs actual behavior.

| # | Date | Scenario | Issue | Status |
|---|------|----------|-------|--------|
| — | — | — | — | — |

---

## 6. Sign-Off

Automated tests passing (`cd functions && npm test`):

- [ ] All scoring unit tests (`scoring.test.ts`)
- [ ] All handler tests (`picks.test.ts`)

Manual tests passing:

- [ ] T1 Scoring UI (green/yellow/red across all categories)
- [ ] T2 Tiebreaker sort
- [ ] All regression checklist items

**Tested by:** ________________________  **Date:** ________________________
