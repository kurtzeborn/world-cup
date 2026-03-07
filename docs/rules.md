# FIFA World Cup 2026 Picks — Scoring Rules

> **This document is the canonical source of truth for all scoring rules.**
> It should be kept up-to-date throughout development and displayed in-app on the rules page.

---

## Overview

Players predict the outcome of all 104 matches in the 2026 FIFA World Cup. Points are awarded for correct predictions across three categories:

1. **Group Stage** — predict the finishing order of all 12 groups
2. **3rd-Place Advancement** — predict which 8 of 12 third-place teams advance
3. **Knockout Stage** — predict the winner of every knockout match (R32 through Final)

**Maximum possible score: 336 points**

All picks must be submitted before **June 11, 2026** (first match kickoff). No changes are allowed after the lock deadline.

---

## 1. Group Stage Scoring

Each of the 12 groups contains 4 teams. You rank all 4 teams from 1st to 4th.

| Prediction Result | Points |
|-------------------|--------|
| Team in the **exact correct position** (e.g., you said 1st, they finished 1st) | **3** |
| Team correctly predicted to **advance** (top 2) but in the wrong position (e.g., you said 1st, they finished 2nd) | **1** |
| Team not in the correct position and not in the correct advance/eliminate category | **0** |

### Group Stage Details

- Each group has 4 teams × 3 max points = **12 points max per group**
- 12 groups × 12 points = **144 points max for group stage**

### Examples

**Group A actual result:** 1st Mexico, 2nd South Korea, 3rd Colombia, 4th Tanzania

| Your Pick | Actual | Points | Reason |
|-----------|--------|--------|--------|
| 1st: Mexico | 1st: Mexico | 3 | Exact position |
| 2nd: Colombia | 2nd: South Korea | 0 | Wrong position AND wrong advance/eliminate category (you had Colombia advancing, they finished 3rd) |
| 3rd: South Korea | 3rd: Colombia | 0 | Wrong position, wrong category |
| 4th: Tanzania | 4th: Tanzania | 3 | Exact position |

**Another example — advance credit:**

| Your Pick | Actual | Points | Reason |
|-----------|--------|--------|--------|
| 1st: Mexico | 2nd: Mexico | 1 | Mexico advanced (top 2) — you predicted they'd advance, they did, but wrong position |
| 2nd: South Korea | 1st: South Korea | 1 | South Korea advanced — you predicted they'd advance, they did, but wrong position |
| 3rd: Colombia | 3rd: Colombia | 3 | Exact position |
| 4th: Tanzania | 4th: Tanzania | 3 | Exact position |

---

## 2. 3rd-Place Advancement Scoring

After ranking all 12 groups, you select **exactly 8** of the 12 third-place teams to advance to the Round of 32.

| Prediction Result | Points |
|-------------------|--------|
| You picked a 3rd-place team to advance, and **they did** | **2** |
| You picked a 3rd-place team to advance, but they **didn't** | **0** |
| You did NOT pick a 3rd-place team, and they didn't advance | N/A (no pick, no points) |
| You did NOT pick a 3rd-place team, but they did advance | **0** (missed opportunity) |

- 8 picks × 2 points = **16 points max**

### How 3rd-Place Advancement Works in the Tournament

- All 12 third-place teams are ranked by: Points → Goal difference → Goals scored → Team conduct score → FIFA World Ranking
- The top 8 advance to the Round of 32
- **Edge case:** If ties remain after all criteria, FIFA resolves them by fair play score or drawing of lots. The final official 8 qualifiers as published by FIFA are authoritative. The admin enters the exact result; user scoring is based on the official outcome.

### 3rd-Place Bracket Placement

The specific R32 matchup for each qualifying 3rd-place team depends on **which combination of 8 groups** produced the advancing teams. FIFA defines 495 possible combinations in Annex C of the tournament regulations. The app handles this automatically — you just pick which 8 move on, and the bracket fills in the correct slots.

---

## 3. Knockout Stage Scoring

The knockout bracket has 32 matches total across 6 rounds. Points increase with each round to reward correctly predicting deep tournament runs.

| Round | Matches | Full Credit | Partial Credit | Max Points |
|-------|---------|-------------|----------------|------------|
| Round of 32 | 16 | **2** | 1 | 32 |
| Round of 16 | 8 | **4** | 2 | 32 |
| Quarterfinals | 4 | **8** | 4 | 32 |
| Semifinals | 2 | **16** | 8 | 32 |
| Third-place match | 1 | **16** | 8 | 16 |
| Final | 1 | **32** | 16 | 32 |

**Total knockout stage: 176 points max**

### Full Credit vs. Partial Credit

**Full credit** is awarded when:
- The team you predicted to win a specific match **did win that match** in exactly the bracket position you predicted. In other words, the team advanced through the correct path (the correct sequence of matchups) to arrive at the slot you picked them for, and they won.

**Partial credit** is awarded when:
- A team you predicted to win **in a given round** did win a match **in that same round**, but in a **different bracket position** than you predicted.
- In other words: the team is correct, the round is correct, but the path is different.

> **Key principle:** Partial credit is based solely on whether the team advanced in the correct round, **not** whether the matchup was correct. If you picked Team X to win in the quarterfinals and Team X does win a quarterfinal match — but in a different quarter of the bracket than you predicted — you receive partial credit.

This is intentionally the most generous interpretation. Because 3rd-place placement can cause cascading bracket differences, strict matchup-based scoring would unfairly punish users who correctly predicted a team's tournament run but had a slightly different group-stage prediction.

### Knockout Examples

**Example 1 — Full credit:**
- You predicted Brazil beats Germany in QF Match 93
- Brazil actually beats Germany in QF Match 93
- → **8 points** (full QF credit)

**Example 2 — Partial credit:**
- You predicted Brazil beats Germany in QF Match 93
- Brazil actually beats France in QF Match 94 (different quarter of bracket)
- → **4 points** (partial QF credit — Brazil won a QF, just not the one you predicted)

**Example 3 — No credit:**
- You predicted Brazil beats Germany in QF Match 93
- Brazil was eliminated in the Round of 16
- → **0 points**

**Example 4 — Partial credit, cascading difference:**
- You predicted Argentina to win R32 Match 74, then win R16 Match 89
- Due to different 3rd-place outcomes, Argentina actually played (and won) R32 Match 75, then won R16 Match 90
- → **1 point** for R32 (partial — Argentina won R32, different match) + **2 points** for R16 (partial — Argentina won R16, different match) = **3 points total**

---

## 4. Total Points Summary

| Category | Max Points |
|----------|-----------|
| Group stage (12 groups × 12) | 144 |
| 3rd-place advancement (8 × 2) | 16 |
| Round of 32 (16 × 2) | 32 |
| Round of 16 (8 × 4) | 32 |
| Quarterfinals (4 × 8) | 32 |
| Semifinals (2 × 16) | 32 |
| Third-place match (1 × 16) | 16 |
| Final (1 × 32) | 32 |
| **Total** | **336** |

---

## 5. Tiebreakers

If two or more users have the same total points, ties are broken in this order:

1. **Most correct exact group positions** — the user who correctly predicted more exact finishing positions (3-point results) across all 12 groups ranks higher
2. **Most correct knockout picks by round (deepest first)** — starting from the Final and working backward through Semifinals, QF, R16, R32, the user with more correct picks in the later rounds ranks higher
3. **Earlier submission timestamp** — the user who locked their picks first ranks higher

---

## 6. Important Notes

- **All picks lock before the first match.** There are no live/in-play predictions.
- **Picks are all-or-nothing at submission time.** You must complete all group rankings, 3rd-place selections, and the full knockout bracket before locking.
- **Results are entered by the admin** as matches complete. Scores update in real-time on the leaderboard.
- **No bonus picks or special predictions** beyond the group/3rd-place/knockout structure described above.
- **Private leagues** use the same scoring system — they simply filter the leaderboard to league members.
