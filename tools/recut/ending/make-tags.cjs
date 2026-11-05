/* Approach (b)'s enabler: boot(..., { tags: true }) also records which part of the composition last set each grain
   (the land, the underground, the pond's furniture, trees, the home, the terraces, grass, wildflowers, fungi, worms,
   cave moss), and what the grain was before the first part after the land touched it. world.stage(s) then draws the
   composition as it is with only parts up to s grown in: the bare ground growing into Exhibit B, part by part.
   Without { tags } nothing is recorded and nothing changes (the plate check proves it).
   Prototype limits: the ground pass lays the pond's water and bed and the terraces' tilled tops with the land, so they
   show in the bare stage; Phase 2 would tag those branches too.
   Usage: node make-tags.cjs in-core.js out-core.js */
const fs = require('fs'), path = require('path');
const [inA, outA] = process.argv.slice(2);
let s = fs.readFileSync(path.resolve(inA), 'utf8');
const rep = (a, b) => { const n = s.split(a).length - 1; if (n !== 1) throw new Error(n + ' matches: ' + a.slice(0, 70)); s = s.replace(a, () => b); };
rep(`    const col = new Uint32Array(N), base = new Uint32Array(N), orig = new Uint32Array(N);`, `    const col = new Uint32Array(N), base = new Uint32Array(N), orig = new Uint32Array(N);
    const tags = opts && opts.tags ? { part: new Uint8Array(N), bareM: new Uint8Array(N), bareC: new Uint32Array(N), prevM: new Uint8Array(N), prevC: new Uint32Array(N) } : null;
    /* After each part: every grain it changed is that part's; what it was before the first part after the land, kept. */
    function mark(k) {
      if (!tags) return;
      for (let i = 0; i < N; i++) {
        if (mat[i] === tags.prevM[i] && col[i] === tags.prevC[i]) continue;
        if (k > 1 && tags.part[i] <= 1) { tags.bareM[i] = tags.prevM[i]; tags.bareC[i] = tags.prevC[i]; }
        if (k === 1) { tags.bareM[i] = mat[i]; tags.bareC[i] = col[i]; }
        tags.part[i] = k; tags.prevM[i] = mat[i]; tags.prevC[i] = col[i];
      }
    }`);
const marks = [
  ['    /* -- Underground: the water under the beds', 1], ['    /* -- On the ground */', 2], ['    /* Trees. */', 3],
  ['    /* The cabin, with a cellar under it', 4], ['    /* Terraces: stone retaining walls', 5], ['    /* Grass blades, thin and many', 6],
  ['    /* -- Wildflowers: each one a plant', 7], ['    /* -- The cave: glowing fungi', 8], ['    /* -- A worm or two', 9],
  ['    /* -- Fireflies, drifting', 10], ['    /* What the water bodies hold', 11]];
marks.forEach(([at, k]) => rep(at, `    mark(${k});\n` + at));
/* stage(s): draw with only parts up to s; the lights, fungi, fish and creature of parts not grown yet stay out. */
rep(`      GW, GH, U, PW: GWp, PH: GHp, line: 'T+0000000', render, out, image,`, `      GW, GH, U, PW: GWp, PH: GHp, line: 'T+0000000', render, out, image, tags,
      stage(st) {
        if (!tags) throw new Error('boot with { tags: true }');
        const m0 = mat.slice(), c0 = col.slice(), l0 = lights.slice(), f0 = fungi.slice(), fi0 = fish.slice(), fl0 = flies.slice(), h0 = hover;
        for (let i = 0; i < N; i++) if (tags.part[i] > st) { mat[i] = tags.bareM[i]; col[i] = tags.bareC[i]; }
        lights.length = 0; l0.forEach((l) => { if (tags.part[idx(l[0], l[1])] <= st) lights.push(l); });
        fungi.length = 0; if (st >= 8) f0.forEach((f) => fungi.push(f));
        fish.length = 0; if (st >= 2) fi0.forEach((f) => fish.push(f));
        flies.length = 0; if (st >= 7) fl0.forEach((f) => flies.push(f));
        if (st < 6) hover = null;
        render();
        mat.set(m0); col.set(c0); lights.length = 0; l0.forEach((l) => lights.push(l)); fungi.length = 0; f0.forEach((f) => fungi.push(f));
        fish.length = 0; fi0.forEach((f) => fish.push(f)); flies.length = 0; fl0.forEach((f) => flies.push(f)); hover = h0;
      },`);
fs.writeFileSync(path.resolve(outA), s);
console.log('wrote', outA);
