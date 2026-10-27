// Prints the glyph table in src/features/tab/smufl.ts from VexFlow's Bravura outlines:
//   npm pack vexflow@4.2.5 && tar xzf vexflow-4.2.5.tgz
//   node scripts/smufl-glyphs.mjs package/src/fonts/bravura_glyphs.ts
// VexFlow's outline units are 360 to a staff space, y up; the table is in staff spaces, y down.
import fs from 'node:fs';
const src = fs.readFileSync(process.argv[2], 'utf8');
const names = ['gClef', 'accidentalSharp', 'accidentalFlat', 'accidentalNatural', 'noteheadBlack', 'noteheadHalf', 'noteheadWhole', 'noteheadXBlack',
  'restWhole', 'restHalf', 'restQuarter', 'rest8th', 'rest16th', 'rest32nd', 'rest64th',
  'flag8thUp', 'flag8thDown', 'flag16thUp', 'flag16thDown', 'flag32ndUp', 'flag32ndDown', 'flag64thUp', 'flag64thDown',
  'bracketTop', 'bracketBottom',
  'noteheadDiamondWhole', 'noteheadDiamondHalf', 'noteheadDiamondBlack', 'noteheadXHalf', 'noteheadXWhole',
  'noteheadParenthesisLeft', 'noteheadParenthesisRight'];
const U = 360;
const r = v => Math.round(v / U * 1000) / 1000;
let out = '';
for (const n of names) {
  const m = src.match(new RegExp(`\\n    ${n}: \\{([\\s\\S]*?)\\n    \\}`));
  const o = m[1].match(/o: '([^']*)'/)[1];
  const xmax = Number(m[1].match(/x_max: (-?[\d.]+)/)[1]);
  const t = o.trim().split(/\s+/);
  let d = '';
  for (let i = 0; i < t.length;) {
    const c = t[i++];
    const nums = k => t.slice(i, i += k).map(Number);
    if (c === 'm') { const [x, y] = nums(2); d += `M${r(x)} ${r(-y)}`; }
    else if (c === 'l') { const [x, y] = nums(2); d += `L${r(x)} ${r(-y)}`; }
    else if (c === 'b') { const [x, y, a, b, cc, dd] = nums(6); d += `C${r(a)} ${r(-b)} ${r(cc)} ${r(-dd)} ${r(x)} ${r(-y)}`; }
    else if (c === 'q') { const [x, y, a, b] = nums(4); d += `Q${r(a)} ${r(-b)} ${r(x)} ${r(-y)}`; }
    else if (c === 'z') d += 'Z';
    else throw new Error(c);
  }
  out += `  ${n}: { width: ${Math.round(xmax / 250 * 1000) / 1000}, d: '${d.replace(/ -/g, '-').replace(/([A-Z])-/g, '$1-')}' },\n`;
}
process.stdout.write(out);
