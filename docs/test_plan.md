# FIFA World Cup 2026 Picks — Pre-Launch Test Plan

**Goal:** Verify that picks, result entry, score calculation, dashboard display, and leaderboard all work end-to-end before opening to real users.  
**Window:** March 9–12, 2026 (before playoff results are finalized on ~March 26)

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

Each scenario defines: the picks to enter, the results to enter as admin, and the expected scores.

Use **Group A** for group-stage-focused tests (teams: Mexico seed 1, South Africa seed 2, South Korea seed 3, UEFA Path D seed 4).

---

### T1 — Group Stage: All Exact Positions

**Purpose:** Verify exact-position scoring gives 3 pts per position (max 9 pts, positions 1–3 only; 4th = 0).

**Picks (Group A only — pick the exact correct order):**
- 1st: Mexico
- 2nd: South Africa
- 3rd: South Korea
- 4th: UEFA Path D

**Results to enter:**
- Group A: 1st = Mexico, 2nd = South Africa  
  (Admin infers: 3rd = South Korea [seed 3], 4th = UEFA Path D [seed 4] ✓ matches picks)
- 3rd-place advancing: check South Korea (Group A's 3rd-place team)
- Knockout: fill all 32 matches with any teams

**Expected Group A score:** 3 + 3 + 3 + 0 = **9 pts**

**Pass criteria:**
- [ ] Dashboard shows all four Group A rows as **green** for positions 1–3
- [ ] Dashboard shows 4th-place row as **gray/no color** (correct but zero points)
- [ ] Group points total includes 9 from Group A

---

### T2 — Group Stage: Advance Partial Credit (Top-2 Swap)

**Purpose:** Verify 1 pt awarded when user picks both 1st and 2nd correctly but swapped.

**Picks (Group A):**
- 1st: South Africa
- 2nd: Mexico
- 3rd: South Korea
- 4th: UEFA Path D

**Results to enter:**
- Group A: 1st = Mexico, 2nd = South Africa  
  (Admin infers: 3rd = South Korea, 4th = UEFA Path D)
- 3rd-place advancing: check South Korea

**Expected Group A score:** 1 + 1 + 3 + 0 = **5 pts**
- Mexico: picked 2nd, finished 1st — both in top 2, wrong position → 1 pt
- South Africa: picked 1st, finished 2nd — both in top 2, wrong position → 1 pt
- South Korea: picked 3rd, finished 3rd → exact → 3 pts
- UEFA Path D: 4th, always 0

**Pass criteria:**
- [ ] Mexico row shows **yellow** (partial)
- [ ] South Africa row shows **yellow** (partial)
- [ ] South Korea row shows **green** (exact)
- [ ] UEFA Path D row shows no scoring indicator

---

### T3 — Group Stage: Advance Partial Credit (Picks Top-2 Team Who Finishes 3rd + Advances)

**Purpose:** Verify 1 pt when a team you picked in the top 2 actually finishes 3rd but qualifies as one of the 8 advancing 3rd-place teams.

**Picks (Group A):**
- 1st: Mexico
- 2nd: South Korea  ← picked to finish 2nd
- 3rd: South Africa
- 4th: UEFA Path D

**Results to enter:**
- Group A: 1st = Mexico, 2nd = South Africa  
  (Admin infers: 3rd = South Korea [seed 3], 4th = UEFA Path D [seed 4])
- **3rd-place advancing: check South Korea** (they DID finish 3rd and DO advance)

**Expected Group A score:**
- Mexico: picked 1st, finished 1st → **3 pts** (exact)
- South Korea: picked 2nd, finished 3rd AND advancing → **1 pt** (predicted top-2, they advanced as 3rd-place qualifier)
- South Africa: picked 3rd, finished 2nd → user had advance box unchecked for South Africa's group position... 

Wait — let me clarify. The advance checkbox is per GROUP (does group A's 3rd-place team advance?), not per team. South Africa is your 3rd-place pick but South Korea actually finishes 3rd. The "advance" checkbox in this scenario is checked for Group A (meaning "yes, Group A's 3rd-place team advances"). South Korea is the actual 3rd-place finisher.

So South Africa was your 3rd pick, but South Africa actually finished 2nd. Did you "predict South Africa would advance"? You picked them 3rd, and your advance box was checked for Group A. But the advance box really means "the team I ranked 3rd will be one of the 8" — and that team in your picks is South Africa, not South Korea.

Given the engine implementation: for South Africa (pos=2), `userPredictedAdvance = thirdPlaceGroups.has("A")` = true (you checked the Group A advance box). The actual position of South Africa = index 1 (2nd place). `teamActuallyAdvanced = actualPos < 2` = true. So South Africa gets 1 pt partial. ✓

Revised expected:
- Mexico: **3 pts** (exact 1st)
- South Korea: picked 2nd (pos=1), finished 3rd (actualPos=2). `userPredictedAdvance = pos < 2` = true. `teamActuallyAdvanced = index 2 is advancing3rdSet` = yes (checked the box). → **1 pt**
- South Africa: picked 3rd (pos=2), finished 2nd (actualPos=1). `userPredictedAdvance = thirdPlaceGroups.has("A")` = true. `teamActuallyAdvanced = actualPos < 2` = true. → **1 pt**
- UEFA Path D: 4th, 0

Total Group A = **5 pts**

**Pass criteria:**
- [ ] Mexico: green (3)
- [ ] South Korea: yellow (1)
- [ ] South Africa: yellow (1)
- [ ] UEFA Path D: no indicator

---

### T4 — Group Stage: 3rd Pick + Advance Box, Team Finished 1st/2nd

**Purpose:** Verify 1 pt when the user picked a team 3rd with the advance box checked, but that team actually finished 1st or 2nd.

**Picks (Group A):**
- 1st: South Africa
- 2nd: South Korea
- 3rd: Mexico (with advance box checked for Group A)
- 4th: UEFA Path D

**Results to enter:**
- Group A: 1st = Mexico, 2nd = South Africa

**Expected Group A score:**
- South Africa: picked 1st, finished 2nd — both top 2, wrong position → **1 pt**
- South Korea: picked 2nd, finished 3rd + advancing (Group A box checked) — wait: South Korea is not the user's 3rd pick. South Korea actually finished 3rd. But the user picked South Korea 2nd. Does South Korea advance? In this scenario, the admin marks Group A's 3rd-place team (South Korea, inferred as seed 3) as advancing. The user picked South Korea 2nd — `userPredictedAdvance = pos < 2` = true. `teamActuallyAdvanced = actualPos=2 && advancing3rdSet.has(SKO)` = yes → **1 pt**
- Mexico: picked 3rd (pos=2), advance box checked. Finished 1st (actualPos=0). `userPredictedAdvance = thirdPlaceGroups.has("A")` = true. `teamActuallyAdvanced = actualPos < 2` = true → **1 pt**
- UEFA Path D: 0

Total = **3 pts**

**Pass criteria:**
- [ ] Mexico: yellow (1)
- [ ] South Africa: yellow (1)
- [ ] South Korea: yellow (1)
- [ ] UEFA Path D: no indicator

---

### T5 — Group Stage: Zero Points (Completely Wrong)

**Purpose:** Verify 0 pts when picks have no correct teams in their predicted positions and no teams advance as predicted.

**Picks (Group A):**
- 1st: UEFA Path D
- 2nd: South Korea
- 3rd: South Africa (with advance box **unchecked** for Group A)
- 4th: Mexico

**Results to enter:**
- Group A: 1st = Mexico, 2nd = South Africa
  (Admin infers: 3rd = South Korea, 4th = UEFA Path D)
- 3rd-place advancing: **do NOT check Group A**

**Expected Group A score:**
- UEFA Path D: picked 1st, finished 4th — not in top 2 of actual → **0 pts**
- South Korea: picked 2nd, finished 3rd — `userPredictedAdvance = pos < 2` = true. `teamActuallyAdvanced = pos 2 && NOT in advancing3rdSet` = false → **0 pts**
- South Africa: picked 3rd, advance box unchecked → `userPredictedAdvance = false` → **0 pts** (even though they finished 2nd)
- Mexico: 4th pick, always 0

Total Group A = **0 pts**

**Pass criteria:**
- [ ] All Group A rows show **red** (incorrect)

---

### T6 — 3rd-Place Advancement Scoring

**Purpose:** Verify the 2-point advancement picks score correctly.

**Setup:** Use a fresh test account. Complete picks for all 12 groups with Group A–H 3rd-place checked (8 picks).

**Results to enter (focus on advancement):**
- Make sure Group A's actual 3rd-place team (Mexico per seed inference, if you enter South Africa 1st + South Korea 2nd) **is** in the 8 advancing teams you check.
- Make sure Group I–L's 3rd-place teams are **not** in the 8 you mark as advancing.

| Group | User checked advance | Admin marks advancing | Expected |
|-------|---------------------|----------------------|---------|
| A | ✓ | ✓ (Group A's 3rd team included) | 2 pts |
| B | ✓ | ✓ | 2 pts |
| C | ✓ | ✓ | 2 pts |
| D | ✓ | ✓ | 2 pts |
| E | ✓ | ✓ | 2 pts |
| F | ✓ | ✓ | 2 pts |
| G | ✓ | ✓ | 2 pts |
| H | ✓ | ✓ | 2 pts |
| I | ✗ | ✗ | 0 pts |
| J | ✗ | ✗ | 0 pts |
| K | ✗ | ✗ | 0 pts |
| L | ✗ | ✗ | 0 pts |

**Expected 3rd-place total: 16 pts** (all 8 correct)

To get partial: use a mix — e.g., check only A–D (4 correct → 8 pts).

**Pass criteria:**
- [ ] Leaderboard shows correct `thirdPlacePoints`
- [ ] Score breakdown in table storage shows `3rd_advance_A` through `3rd_advance_H` each = 2

---

### T7 — Knockout Stage: Full Credit

**Purpose:** Verify exact bracket picks give full credit.

**Setup:** Create a bracket where you predict (and the results confirm) the exact bracket path for several teams.

**Picks:** Choose Team X to win R32 Match 73. Choose the same Team X to win R16 Match 90.

**Results to enter:** Mark Team X as the winner of M73 and M90.

**Expected:**
- R32 slot (2 pts full) + R16 slot (4 pts full) = **6 pts** for Team X's path

**Pass criteria:**
- [ ] Dashboard bracket shows Match 73 and Match 90 slots for Team X as **green**
- [ ] Score breakdown shows `ko_R32_73_full = 2` and `ko_R16_90_full = 4`

---

### T8 — Knockout Stage: Partial Credit

**Purpose:** Verify a team that wins in the correct round but wrong bracket slot gives partial credit.

**Picks:** Choose Germany (`GER`) to win R32 Match 74.

**Results to enter:** Mark Germany as the winner of **Match 73** (not 74 — a different R32 match).

**Expected:** Germany won Round of 32, just not the slot you predicted → **1 pt** (partial R32)

**Pass criteria:**
- [ ] Dashboard bracket shows Match 74 slot as **yellow** (partial)
- [ ] Score breakdown shows `ko_R32_74_partial = 1`

---

### T9 — Knockout Stage: No Credit (Early Elimination)

**Purpose:** Verify 0 pts when a team is eliminated before the round you predicted.

**Picks:** Choose Brazil (`BRA`) to win R16 Match 91.

**Results to enter:** Mark Brazil as the **loser** of their R32 match (eliminated before R16).

**Expected:** Brazil didn't even reach R16 → **0 pts**

**Pass criteria:**
- [ ] Dashboard bracket shows Match 91 as **red** (incorrect)
- [ ] Score breakdown has no entry for `ko_R16_91`

---

### T10 — End-to-End: Full Score Calculation

**Purpose:** Verify the total of all scoring categories adds up correctly in the leaderboard.

**Setup:** Use a complete set of picks with a known expected score across all categories.

Suggested test data — designed for easy arithmetic:

**Group picks:** For every group, pick the 4 teams in exact seed order (1st = seed 1, 2nd = seed 2, etc.).

**Results to enter:** For every group, enter 1st = seed 1, 2nd = seed 2.
- Admin infers 3rd = seed 3, 4th = seed 4 → all 12 groups exact for positions 1–3.
- Expected group score: 12 groups × 9 pts = **108 pts**

**3rd-place picks:** Check all 12 groups.

**Results:** Mark 8 of those 12 groups' seed-3 teams as advancing.
- Expected 3rd-place score: 8 × 2 = **16 pts**

**Bracket picks:** Pick every match winner to be the team listed first in each R32 slot (teams seeded higher in the draw).

**Results:** Mark those same teams as winners for all 32 knockout matches in the exact same slots.
- Expected knockout score: 16×2 + 8×4 + 4×8 + 2×16 + 1×16 + 1×32 = 32+32+32+32+16+32 = **176 pts**

**Expected total: 108 + 16 + 176 = 300 pts** (perfect score)

**Pass criteria:**
- [ ] Leaderboard shows 300 pts for this test account
- [ ] Group points = 108, 3rd-place points = 16, knockout points = 176
- [ ] Dashboard shows all rows green

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

### T12 — Picks Visibility (Post-Lock Gate)

**Purpose:** Verify that other users' picks are only visible after picks are locked.

**Steps:**
1. Create a second test account with picks but **not yet locked**
2. From your admin account, navigate to the leaderboard and click on the second account's name
3. Verify you see a "not visible before lock deadline" message (or 403 response)
4. Lock the second account's picks using the force-lock method from section 1.2
5. Recalculate scores
6. From your admin account, click on the second account's name again
7. Verify you can now see their full group and bracket picks

**Pass criteria:**
- [ ] Pre-lock: picks are not viewable by others
- [ ] Post-lock: picks are viewable, showing correct group rankings and bracket

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

All tests passing:

- [ ] T1 Group exact scoring
- [ ] T2 Group top-2 swap partial
- [ ] T3 Group top-2 pick finishes as advancing 3rd
- [ ] T4 Group 3rd pick + advance → finished top 2
- [ ] T5 Group zero points
- [ ] T6 3rd-place advancement scoring (full and partial)
- [ ] T7 Knockout full credit
- [ ] T8 Knockout partial credit
- [ ] T9 Knockout no credit
- [ ] T10 Full 300-point perfect score
- [ ] T11 Tiebreaker sort
- [ ] T12 Picks visibility gate
- [ ] All regression checklist items

**Tested by:** ________________________  **Date:** ________________________
