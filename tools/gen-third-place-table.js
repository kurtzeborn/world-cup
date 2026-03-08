#!/usr/bin/env node
// Generates third-place-table.js from the raw Annex C data scraped from Wikipedia
// Run: node tools/gen-third-place-table.js > web/src/data/third-place-table.js

// Raw data from Wikipedia Annex C table
// Format: [groups present (A-L positional), then 8 slot assignments]
// Columns represent which groups advanced (A=col0 ... L=col11)
// Last 8 columns = group letter assigned to match slots: 74,77,79,80,82,81,85,87
// "3X" prefixes stripped; empty = that group didn't qualify

const RAW = [
// row, A,B,C,D,E,F,G,H,I,J,K,L, m74, m77, m79, m80, m82, m81, m85, m87
[1,  0,0,0,0,1,1,1,1,1,1,1,1, "E","G","F","A","J","H","L","K"],  // Wait - must re-read
// Actually the Wikipedia table columns after the 12 group columns ARE the slot assignments
// Let me re-read: columns are "3P slot for M74, slot for M77, slot for M79, slot for M80, slot for M82(typo in wiki?), slot for M81, slot for M85, slot for M87"
// From the Wikipedia data I read: row 1: groups D,E,F,G,H,I,J,K,L present -> "3E","3J","3I","3F","3H","3G","3L","3K"
// That means: M74=E, M77=J, M79=I, M80=F, M82=H, M81=G, M85=L, M87=K
];

// Re-encoded from Wikipedia rows directly
// Each entry: [sortedGroupKey, [m74Group, m77Group, m79Group, m80Group, m82Group, m81Group, m85Group, m87Group]]
const ROWS = [
["DEFGHIJKL", ["E","J","I","F","H","G","L","K"]],
["CEFGHIJKL", ["E","J","I","C","H","G","L","K"]],
["DEFGHIJKL", ["E","J","I","F","H","G","L","K"]], // row 1
];

// This approach is too error-prone by hand. Let me encode the data properly.
