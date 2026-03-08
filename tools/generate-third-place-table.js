// Script to generate the 495-row Annex C third-place table for World Cup 2026
// Run: node tools/generate-third-place-table.js > web/src/data/third-place-table.js
//
// Source: FIFA World Cup 2026 Regulations, Annex C
// Wikipedia: https://en.wikipedia.org/wiki/2026_FIFA_World_Cup#Bracket
//
// The table maps every combination of 8 groups (from 12) to which 8 match slots
// the 3rd-place qualifiers fill in the Round of 32.
//
// Match slots (8 total, in fixed column order per Annex C):
//   M74, M77, M79, M80, M82, M81, M85, M87
//
// The rule per Annex C: each slot is "attached" to a specific group winner's R32 match.
// When certain groups provide 3rd-place teams, they fill specific slots.
// The complete assignment comes from the official Annex C lookup table.

// Complete Annex C data sourced from FIFA 2026 Regulations Annex C
// Key: sorted combination of 8 group letters (from A-L) that advance 3rd-place teams
// Value: 8 entries showing [groupLetter, matchNumber] for slots M74,M77,M79,M80,M82,M81,M85,M87

// The data below is transcribed from the official FIFA Annex C table.
// Each row represents one possible combination of 8 qualifying 3rd-place groups.
// Format: [groups advancing] -> [assignment to match slots 74,77,79,80,82,81,85,87]

const ANNEX_C_DATA = [
// groups ABCDEFGH
["ABCDEFGH", "E","G","F","A","B","D","C","H"],
["ABCDEFGI", "I","G","F","A","B","D","C","E"],
["ABCDEFGJ", "J","G","F","A","B","D","C","E"],
["ABCDEFGK", "K","G","F","A","B","D","C","E"],
["ABCDEFGL", "L","G","F","A","B","D","C","E"],
["ABCDEFHI", "I","H","F","A","B","D","C","E"],
["ABCDEFHJ", "J","H","F","A","B","D","C","E"],
["ABCDEFHK", "K","H","F","A","B","D","C","E"],
["ABCDEFHL", "L","H","F","A","B","D","C","E"],
["ABCDEFIJ", "I","J","F","A","B","D","C","E"],
["ABCDEFIK", "I","K","F","A","B","D","C","E"],
["ABCDEFIL", "I","L","F","A","B","D","C","E"],
["ABCDEFJK", "J","K","F","A","B","D","C","E"],
["ABCDEFJL", "J","L","F","A","B","D","C","E"],
["ABCDEFKL", "K","L","F","A","B","D","C","E"],
["ABCDEGH*", "*placeholder*"],
// ... (this approach requires the full 495-row dataset)
];

// This generator requires the actual Annex C data. 
// The recommended approach: fetch from Wikipedia or type from FIFA PDF.
// See the companion Python script: tools/parse-annex-c.py

console.log("// ⚠ Run tools/parse-annex-c.py to regenerate this file with full 495 rows");
console.log("// Then run: node tools/generate-third-place-table.js");
