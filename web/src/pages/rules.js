// rules.js — static rules / how-to-play page

export function renderRulesPage(container) {
  container.innerHTML = `
    <div class="rules-page" style="max-width:720px;margin:0 auto;padding:1rem">

      <h2 style="margin-bottom:1.5rem"><i class="fa-solid fa-book-open" style="margin-right:.5rem"></i>How to Play</h2>

      <div class="card" style="margin-bottom:1rem">
        <h3 style="margin-top:0"><i class="fa-solid fa-calendar-check" style="margin-right:.5rem;color:var(--accent)"></i>Pick Deadline</h3>
        <p>All picks must be submitted before the first match kicks off:</p>
        <p style="font-size:1.1rem;font-weight:700">June 11, 2026 — 1:00 PM MDT (7:00 PM UTC)</p>
        <p style="color:var(--text-muted);font-size:.9rem">After the deadline, picks are locked and read-only. There is no manual submit button — your picks are saved automatically as you go. Whatever you have saved when the deadline arrives is your final entry.</p>
      </div>

      <div class="card" style="margin-bottom:1rem">
        <h3 style="margin-top:0"><i class="fa-solid fa-layer-group" style="margin-right:.5rem;color:var(--accent)"></i>Group Stage <span style="font-weight:400;font-size:.85rem;color:var(--text-muted)">(max 108 pts)</span></h3>
        <p>For each of the 12 groups (A–L), rank all 4 teams in the order you think they'll finish. Only the top 3 positions are scored — 4th place earns no points.</p>
        <table style="width:100%;border-collapse:collapse;font-size:.9rem">
          <thead>
            <tr style="border-bottom:1px solid var(--border-color)">
              <th style="text-align:left;padding:.4rem .5rem">Prediction</th>
              <th style="text-align:right;padding:.4rem .5rem">Points</th>
            </tr>
          </thead>
          <tbody>
            <tr style="border-bottom:1px solid var(--border-color)">
              <td style="padding:.4rem .5rem">Team picked in exact finishing position (1st, 2nd, or 3rd)</td>
              <td style="text-align:right;padding:.4rem .5rem;font-weight:700">3</td>
            </tr>
            <tr style="border-bottom:1px solid var(--border-color)">
              <td style="padding:.4rem .5rem">Team correctly predicted to advance (top 2 or qualifying 3rd) but wrong position</td>
              <td style="text-align:right;padding:.4rem .5rem;font-weight:700">1</td>
            </tr>
            <tr>
              <td style="padding:.4rem .5rem">Team eliminated or picked 4th regardless of result</td>
              <td style="text-align:right;padding:.4rem .5rem;color:var(--text-muted)">0</td>
            </tr>
          </tbody>
        </table>
        <p style="margin-bottom:0;font-size:.85rem;color:var(--text-muted)">9 points max per group × 12 groups = 108 pts</p>
      </div>

      <div class="card" style="margin-bottom:1rem">
        <h3 style="margin-top:0"><i class="fa-solid fa-arrow-up-right-dots" style="margin-right:.5rem;color:var(--accent)"></i>3rd-Place Advancement <span style="font-weight:400;font-size:.85rem;color:var(--text-muted)">(max 16 pts)</span></h3>
        <p>The 8 best 3rd-place teams advance to the knockout round. For each group, an "Advance?" checkbox appears next to the team you ranked 3rd. Check exactly 8 of the 12 groups.</p>
        <table style="width:100%;border-collapse:collapse;font-size:.9rem">
          <thead>
            <tr style="border-bottom:1px solid var(--border-color)">
              <th style="text-align:left;padding:.4rem .5rem">Prediction</th>
              <th style="text-align:right;padding:.4rem .5rem">Points</th>
            </tr>
          </thead>
          <tbody>
            <tr style="border-bottom:1px solid var(--border-color)">
              <td style="padding:.4rem .5rem">Correctly picked a 3rd-place team to advance (and they did)</td>
              <td style="text-align:right;padding:.4rem .5rem;font-weight:700">2</td>
            </tr>
            <tr>
              <td style="padding:.4rem .5rem">Picked a 3rd-place team to advance but they didn't</td>
              <td style="text-align:right;padding:.4rem .5rem;color:var(--text-muted)">0</td>
            </tr>
          </tbody>
        </table>
        <p style="margin-bottom:0;font-size:.85rem;color:var(--text-muted)">8 picks × 2 pts = 16 pts max</p>
      </div>

      <div class="card" style="margin-bottom:1rem">
        <h3 style="margin-top:0"><i class="fa-solid fa-trophy" style="margin-right:.5rem;color:var(--accent)"></i>Knockout Stage <span style="font-weight:400;font-size:.85rem;color:var(--text-muted)">(max 176 pts)</span></h3>
        <p>The bracket auto-populates based on your group picks. Pick a winner for each match; winners cascade forward automatically.</p>
        <p><strong>Full credit</strong> — team is in the exact bracket slot you predicted (correct path all the way through).<br>
        <strong>Partial credit</strong> — team wins in that round but arrived via a different bracket path than you predicted.</p>
        <table style="width:100%;border-collapse:collapse;font-size:.9rem">
          <thead>
            <tr style="border-bottom:1px solid var(--border-color)">
              <th style="text-align:left;padding:.4rem .5rem">Round</th>
              <th style="text-align:right;padding:.4rem .5rem">Full</th>
              <th style="text-align:right;padding:.4rem .5rem">Partial</th>
              <th style="text-align:right;padding:.4rem .5rem">Max</th>
            </tr>
          </thead>
          <tbody>
            <tr style="border-bottom:1px solid var(--border-color)">
              <td style="padding:.4rem .5rem">Round of 32 (16 matches)</td>
              <td style="text-align:right;padding:.4rem .5rem">2</td>
              <td style="text-align:right;padding:.4rem .5rem">1</td>
              <td style="text-align:right;padding:.4rem .5rem;font-weight:700">32</td>
            </tr>
            <tr style="border-bottom:1px solid var(--border-color)">
              <td style="padding:.4rem .5rem">Round of 16 (8 matches)</td>
              <td style="text-align:right;padding:.4rem .5rem">4</td>
              <td style="text-align:right;padding:.4rem .5rem">2</td>
              <td style="text-align:right;padding:.4rem .5rem;font-weight:700">32</td>
            </tr>
            <tr style="border-bottom:1px solid var(--border-color)">
              <td style="padding:.4rem .5rem">Quarterfinals (4 matches)</td>
              <td style="text-align:right;padding:.4rem .5rem">8</td>
              <td style="text-align:right;padding:.4rem .5rem">4</td>
              <td style="text-align:right;padding:.4rem .5rem;font-weight:700">32</td>
            </tr>
            <tr style="border-bottom:1px solid var(--border-color)">
              <td style="padding:.4rem .5rem">Semifinals (2 matches)</td>
              <td style="text-align:right;padding:.4rem .5rem">16</td>
              <td style="text-align:right;padding:.4rem .5rem">8</td>
              <td style="text-align:right;padding:.4rem .5rem;font-weight:700">32</td>
            </tr>
            <tr style="border-bottom:1px solid var(--border-color)">
              <td style="padding:.4rem .5rem">Third-place match</td>
              <td style="text-align:right;padding:.4rem .5rem">16</td>
              <td style="text-align:right;padding:.4rem .5rem">8</td>
              <td style="text-align:right;padding:.4rem .5rem;font-weight:700">16</td>
            </tr>
            <tr>
              <td style="padding:.4rem .5rem">Final</td>
              <td style="text-align:right;padding:.4rem .5rem">32</td>
              <td style="text-align:right;padding:.4rem .5rem">16</td>
              <td style="text-align:right;padding:.4rem .5rem;font-weight:700">32</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="card" style="margin-bottom:1rem">
        <h3 style="margin-top:0"><i class="fa-solid fa-calculator" style="margin-right:.5rem;color:var(--accent)"></i>Maximum Points Summary</h3>
        <table style="width:100%;border-collapse:collapse;font-size:.9rem">
          <tbody>
            <tr style="border-bottom:1px solid var(--border-color)">
              <td style="padding:.4rem .5rem">Group stage (12 groups)</td>
              <td style="text-align:right;padding:.4rem .5rem">108</td>
            </tr>
            <tr style="border-bottom:1px solid var(--border-color)">
              <td style="padding:.4rem .5rem">3rd-place advancement</td>
              <td style="text-align:right;padding:.4rem .5rem">16</td>
            </tr>
            <tr style="border-bottom:1px solid var(--border-color)">
              <td style="padding:.4rem .5rem">Knockout rounds (R32 through Final)</td>
              <td style="text-align:right;padding:.4rem .5rem">176</td>
            </tr>
            <tr style="font-weight:700;font-size:1rem">
              <td style="padding:.5rem .5rem">Total</td>
              <td style="text-align:right;padding:.5rem .5rem">300</td>
            </tr>
          </tbody>
        </table>
        <p style="margin-bottom:0;font-size:.85rem;color:var(--text-muted)">Tiebreakers: most exact group positions → most correct knockout picks (Final first) → earlier submission timestamp.</p>
      </div>

      <div class="card" style="margin-bottom:1rem">
        <h3 style="margin-top:0"><i class="fa-solid fa-users" style="margin-right:.5rem;color:var(--accent)"></i>Leagues</h3>
        <p>You have <strong>one set of picks</strong> for the whole tournament — but you can compete in as many private leagues as you like with that same entry.</p>
        <ul style="margin:.5rem 0;padding-left:1.25rem;line-height:1.8">
          <li><strong>Create a league</strong> — give it a name and share the 6-character join code with your group.</li>
          <li><strong>Join a league</strong> — enter a join code to add your picks to that league's leaderboard.</li>
          <li>Each league has its own leaderboard showing only its members, ranked by the same scoring rules.</li>
          <li>You can be in as many leagues as you want — office pool, friends group, family bracket, all at once.</li>
        </ul>
        <p style="margin-bottom:0;color:var(--text-muted);font-size:.85rem">Find your leagues on the <strong>Leagues</strong> tab. League leaderboards are accessible before and after the pick deadline.</p>
      </div>

    </div>
  `;
}
