# FIFA World Cup 2026 Picks — Pre-Launch Test Plan

**Goal:** Verify that picks, result entry, score calculation, dashboard display, and leaderboard all work end-to-end before opening to real users.  
**Window:** March 9–12, 2026 (before playoff results are finalized on ~March 26)

---

## Automated Test Coverage

The following scenarios are covered by automated tests in `functions/src/tests/` and do **not** require manual testing:

| Scenario | Test File | Coverage |
|----------|-----------|----------|
| T1 — Group Stage: All Exact Positions | `scoring.test.ts` | `calculateScore` exact order → 9 pts |
| T2 — Group Stage: Top-2 Swap | `scoring.test.ts` | `calculateScore` swap → 5 pts |
| T3 — Picks Top-2, Finishes as Advancing 3rd | `scoring.test.ts` | correct advance partial credit |
| T4 — 3rd Pick + Advance Box, Finishes Top-2 | `scoring.test.ts` | 3rd-place pick partial credit |
| T5 — Zero Points (Completely Wrong) | `scoring.test.ts` | no matches → 0 pts |
| T6 — 3rd-Place Advancement Scoring | `scoring.test.ts` | 0/4/8 correct → 0/8/16 pts |
| T7 — Knockout: Full Credit | `scoring.test.ts` | exact bracket slot → full pts |
| T8 — Knockout: Partial Credit | `scoring.test.ts` | correct round, wrong slot → partial pts |
| T9 — Knockout: No Credit | `scoring.test.ts` | team eliminated early → 0 pts |
| T10 — Perfect Score (300 pts) | `scoring.test.ts` | end-to-end perfect calculation |
| T12 — Picks Visibility Gate | `picks.test.ts` | 403 pre-deadline, 200 post-deadline |
| Lock completeness validation | `picks.test.ts` | 400 on incomplete groups/3rd/bracket |

Run with: `cd functions && npm test`

---

## Pre-Test Fixes Applied

The following scoring bugs were found and fixed in `functions/src/functions/admin-results.ts` before this test plan was written:

| # | Bug | Impact |
|---|-----|--------|
| 1 | Exact 4th-place pick gave 3 pts (rules say 0) | Inflated scores |
| 2 | Group partial credit: picking a 1st/2nd team who finished 3rd + advanced scored 0 (should be 1) | Missed points |
| 3 | Group partial credit: picking a team 3rd + advance box when they finished 1st/2nd scored 0 (should be 1) | Missed points |
| 4 | 3rd-place advancement scoring compared group letters to team IDs — always scored 0 | Critical: broken feature |

---

## 1. Setup

### 1.1 Test Accounts

You need **at least 3 test accounts** to test the leaderboard and tiebreakers. Options:
- Your normal admin account (scott@kurtzeborn.org via Microsoft)
- A second Google account
- A third Microsoft or Google account

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

> **T1–T10 and T12 are covered by automated tests** — see the Automated Test Coverage section above. Run `npm test` in the `functions/` directory.

Only one manual scenario remains:

---

### T11 — Tiebreaker Verification

**Purpose:** Verify that tied total scores are ranked by correct exact group positions.

**Setup:** Two test accounts with the same total points but different distributions.

**Account A picks:** All exact group positions + some partial knockout picks → 150 pts total
**Account B picks:** Half exact + half partial group picks + more exact knockout picks → 150 pts total

Design the picks and results so Account A has more exact group position hits.

**Expected:** Account A ranks above Account B on the leaderboard.

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

- [ ] All scoring unit tests (`scoring.test.ts`) — T1–T10
- [ ] All handler tests (`picks.test.ts`) — T12 + lock validation

Manual tests passing:

- [ ] T11 Tiebreaker sort
- [ ] All regression checklist items

**Tested by:** ________________________  **Date:** ________________________
