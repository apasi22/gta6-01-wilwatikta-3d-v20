// world.js — Wilwatikta city: deterministic layout (seeded), v19-style buildings
// with window grids, varied heights/materials, shop fronts, trees, lamps, roads.
import { Mesh } from './gl.js';

export function makeRng(seed) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

const BUILDING_COLORS = [
  [0.42, 0.36, 0.48], [0.48, 0.42, 0.33], [0.29, 0.36, 0.48],
  [0.54, 0.42, 0.36], [0.35, 0.42, 0.42], [0.50, 0.38, 0.44],
  [0.38, 0.33, 0.52], [0.45, 0.45, 0.38],
];
const AWNING_COLORS = [
  [0.85, 0.25, 0.35], [0.15, 0.55, 0.85], [0.95, 0.65, 0.15], [0.25, 0.70, 0.40],
];
const SIGN_COLORS = [
  [0.95, 0.35, 0.55], [0.25, 0.75, 0.95], [1.0, 0.75, 0.2], [0.45, 0.9, 0.45],
];

export function buildCity() {
  const m = new Mesh();
  const rng = makeRng(1998);
  const ASPHALT = [0.13, 0.11, 0.18];
  const SIDEWALK = [0.23, 0.20, 0.29];
  const CURB = [0.30, 0.28, 0.36];

  // --- ground: big asphalt plane + sidewalks along the two avenues ---
  m.ground(0, 0, 240, 240, ASPHALT);
  // sidewalks: strips flanking the main avenue (x = ±7) and the cross street (z = ±7)
  for (const sx of [-1, 1]) {
    m.box(sx * 8.2, 0.06, 0, 2.4, 0.12, 200, SIDEWALK);
    m.box(0, 0.06, sx * 8.2, 200, 0.12, 2.4, SIDEWALK);
  }
  // lane markings: dashed yellow centre lines
  for (let z = -95; z < 96; z += 6) m.box(0, 0.02, z, 0.35, 0.02, 3, [0.85, 0.72, 0.22], 0.25);
  for (let x = -95; x < 96; x += 6) m.box(x, 0.02, 0, 3, 0.02, 0.35, [0.85, 0.72, 0.22], 0.25);
  // zebra crossings at the main intersection
  for (let i = -3; i <= 3; i++) {
    m.box(i * 1.6, 0.02, 10.5, 0.9, 0.02, 2.6, [0.92, 0.92, 0.92], 0.15);
    m.box(i * 1.6, 0.02, -10.5, 0.9, 0.02, 2.6, [0.92, 0.92, 0.92], 0.15);
    m.box(10.5, 0.02, i * 1.6, 2.6, 0.02, 0.9, [0.92, 0.92, 0.92], 0.15);
    m.box(-10.5, 0.02, i * 1.6, 2.6, 0.02, 0.9, [0.92, 0.92, 0.92], 0.15);
  }

  // --- buildings: blocks on a 15-unit grid, skipping the two avenues (|x|<10 or |z|<10) ---
  const blocks = [];
  for (let bx = -3; bx <= 3; bx++) for (let bz = -3; bz <= 3; bz++) {
    const cx = bx * 15, cz = bz * 15;
    // The two avenues (|x| < 11 north-south, |z| < 11 east-west) stay CLEAR of buildings.
    if (Math.abs(cx) < 11 || Math.abs(cz) < 11) continue;
    blocks.push({ x: cx, z: cz, w: 10 + rng() * 2, d: 10 + rng() * 2, h: 7 + rng() * 16 });
  }
  for (const b of blocks) {
    const col = BUILDING_COLORS[Math.floor(rng() * BUILDING_COLORS.length)];
    const dark = [col[0]*0.55, col[1]*0.55, col[2]*0.55];
    m.box(b.x, b.h/2, b.z, b.w, b.h, b.d, col);
    m.box(b.x, b.h + 0.25, b.z, b.w * 0.9, 0.5, b.d * 0.9, dark); // roof cap
    // window grids on the faces that look at a street (all four, cheap)
    const cols = Math.max(2, Math.floor(b.w / 2.6));
    const rows = Math.max(2, Math.floor(b.h / 2.8));
    for (let r = 0; r < rows; r++) {
      const wy = 1.6 + r * 2.8;
      if (wy > b.h - 1) continue;
      for (let c = 0; c < cols; c++) {
        const ox = -b.w/2 + 1.3 + c * (b.w - 2.6) / Math.max(1, cols - 1);
        const lit = rng() < 0.18;
        const wc = lit ? [0.90, 0.68, 0.38] : [0.10, 0.09, 0.15];
        const em = lit ? 0.7 : 0;
        // front (+z) and back (-z)
        m.quad([b.x + ox - 0.45, wy + 0.5, b.z + b.d/2 + 0.03], [b.x + ox + 0.45, wy + 0.5, b.z + b.d/2 + 0.03],
               [b.x + ox + 0.45, wy - 0.5, b.z + b.d/2 + 0.03], [b.x + ox - 0.45, wy - 0.5, b.z + b.d/2 + 0.03], [0,0,1], wc, em);
        m.quad([b.x + ox + 0.45, wy + 0.5, b.z - b.d/2 - 0.03], [b.x + ox - 0.45, wy + 0.5, b.z - b.d/2 - 0.03],
               [b.x + ox - 0.45, wy - 0.5, b.z - b.d/2 - 0.03], [b.x + ox + 0.45, wy - 0.5, b.z - b.d/2 - 0.03], [0,0,-1], wc, em);
        // left (-x) and right (+x)
        const oz = -b.d/2 + 1.3 + c * (b.d - 2.6) / Math.max(1, cols - 1);
        m.quad([b.x + b.w/2 + 0.03, wy + 0.5, b.z + oz - 0.45], [b.x + b.w/2 + 0.03, wy + 0.5, b.z + oz + 0.45],
               [b.x + b.w/2 + 0.03, wy - 0.5, b.z + oz + 0.45], [b.x + b.w/2 + 0.03, wy - 0.5, b.z + oz - 0.45], [1,0,0], wc, em);
        m.quad([b.x - b.w/2 - 0.03, wy + 0.5, b.z + oz + 0.45], [b.x - b.w/2 - 0.03, wy + 0.5, b.z + oz - 0.45],
               [b.x - b.w/2 - 0.03, wy - 0.5, b.z + oz - 0.45], [b.x - b.w/2 - 0.03, wy - 0.5, b.z + oz + 0.45], [-1,0,0], wc, em);
      }
    }
    // shop front on the street side: awning + sign box (only for low buildings near the avenues)
    if (b.h < 14 && (Math.abs(b.x) < 26 || Math.abs(b.z) < 26)) {
      const ac = AWNING_COLORS[Math.floor(rng() * AWNING_COLORS.length)];
      const sc = SIGN_COLORS[Math.floor(rng() * SIGN_COLORS.length)];
      const side = Math.abs(b.x) > Math.abs(b.z) ? 'x' : 'z';
      if (side === 'z') {
        const fz = b.z + Math.sign(0 - b.z || 1) * (b.d/2 + 0.5);
        m.box(b.x, 2.6, fz, 5.5, 0.25, 1.6, ac, 0, { rx: 0.35 });
        m.box(b.x, 3.9, b.z + Math.sign(0 - b.z || 1) * (b.d/2 + 0.08), 5.0, 1.0, 0.15, sc, 0.55);
        m.box(b.x - 1.5, 1.4, b.z + Math.sign(0 - b.z || 1) * (b.d/2 + 0.06), 1.6, 2.6, 0.1, [0.75, 0.85, 0.9], 0.35);
        m.box(b.x + 1.5, 1.4, b.z + Math.sign(0 - b.z || 1) * (b.d/2 + 0.06), 1.6, 2.6, 0.1, [0.75, 0.85, 0.9], 0.35);
      } else {
        const fx = b.x + Math.sign(0 - b.x || 1) * (b.w/2 + 0.5);
        m.box(fx, 2.6, b.z, 1.6, 0.25, 5.5, ac, 0, { rz: 0.35 });
        m.box(b.x + Math.sign(0 - b.x || 1) * (b.w/2 + 0.08), 3.9, b.z, 0.15, 1.0, 5.0, sc, 0.55);
      }
    }
  }

  // --- trees along the sidewalks ---
  const treeSpots = [];
  for (let i = 0; i < 26; i++) {
    const along = -90 + i * 7.2;
    const side = i % 2 === 0 ? -1 : 1;
    treeSpots.push([side * 9.6, along]);
    treeSpots.push([along, side * 9.6]);
  }
  for (const [tx, tz] of treeSpots) {
    if (Math.abs(tx) < 12 && Math.abs(tz) < 12) continue;
    m.cylinder(tx, 1.1, tz, 0.22, 2.2, [0.35, 0.22, 0.14]);
    m.sphere(tx, 3.0, tz, 1.7, [0.22, 0.48, 0.22], 0, 6);
    m.sphere(tx + 0.7, 2.4, tz + 0.4, 1.2, [0.28, 0.55, 0.26], 0, 6);
    m.sphere(tx - 0.6, 2.5, tz - 0.5, 1.1, [0.18, 0.42, 0.20], 0, 6);
  }

  // --- street lamps ---
  for (let i = 0; i < 14; i++) {
    const along = -84 + i * 13;
    for (const side of [-1, 1]) {
      m.cylinder(side * 7.4, 2.6, along, 0.09, 5.2, [0.25, 0.25, 0.30]);
      m.box(side * 6.9, 5.1, along, 1.0, 0.12, 0.12, [0.25, 0.25, 0.30]);
      m.sphere(side * 6.5, 5.0, along, 0.22, [1.0, 0.9, 0.6], 0.7, 6);
      m.cylinder(along, 2.6, side * 7.4, 0.09, 5.2, [0.25, 0.25, 0.30]);
      m.box(along, 5.1, side * 6.9, 0.12, 0.12, 1.0, [0.25, 0.25, 0.30]);
      m.sphere(along, 5.0, side * 6.5, 0.22, [1.0, 0.9, 0.6], 0.7, 6);
    }
  }

  // --- props: red kiosk, benches, hydrant, pink billboard ---
  m.box(-9.5, 1.3, 16, 2.2, 2.6, 1.6, [0.75, 0.15, 0.15]);
  m.box(-9.5, 2.75, 16, 2.4, 0.3, 1.8, [0.55, 0.1, 0.1]);
  m.box(-9.5, 1.5, 16.85, 1.6, 1.2, 0.08, [0.85, 0.9, 0.95], 0.4);
  for (const [bx, bz, ry] of [[8.5, 22, 0], [-8.5, -22, Math.PI], [22, -8.5, Math.PI/2]]) {
    m.box(bx, 0.55, bz, 2.0, 0.12, 0.6, [0.45, 0.30, 0.18], 0, { ry });
    m.box(bx, 0.25, bz, 0.15, 0.5, 0.5, [0.3, 0.3, 0.3], 0, { ry });
  }
  m.cylinder(9.2, 0.45, -14, 0.28, 0.9, [0.8, 0.2, 0.2]);
  // big pink billboard on the avenue
  m.box(-12.5, 9, -30, 0.5, 9, 0.5, [0.3, 0.3, 0.35]);
  m.box(-12.5, 9, -30, 0.6, 9, 0.6, [0.3, 0.3, 0.35]);
  m.box(-11.8, 12, -30, 1.2, 5, 8, [0.9, 0.3, 0.55], 0.5);
  m.box(-11.1, 12, -30, 0.15, 4.2, 7.2, [1.0, 0.75, 0.85], 0.7);

  return m;
}

// Sky dome: gradient cylinder (horizon orange -> dusk purple), drawn with fog off.
export function buildSky() {
  const m = new Mesh();
  const R = 380, H = 150, SEG = 24, BANDS = 4;
  const top = [0.16, 0.09, 0.27], mid = [0.55, 0.25, 0.42], hor = [1.0, 0.55, 0.25];
  const bandCol = (t) => {
    if (t < 0.5) { const k = t / 0.5; return [hor[0]+(mid[0]-hor[0])*k, hor[1]+(mid[1]-hor[1])*k, hor[2]+(mid[2]-hor[2])*k]; }
    const k = (t - 0.5) / 0.5; return [mid[0]+(top[0]-mid[0])*k, mid[1]+(top[1]-mid[1])*k, mid[2]+(top[2]-mid[2])*k];
  };
  for (let b = 0; b < BANDS; b++) {
    const y0 = (b / BANDS) * H - 4, y1 = ((b+1) / BANDS) * H - 4;
    const c0 = bandCol(b / BANDS), c1 = bandCol((b+1) / BANDS);
    for (let s = 0; s < SEG; s++) {
      const a0 = 2*Math.PI*s/SEG, a1 = 2*Math.PI*(s+1)/SEG;
      const am = (a0 + a1) / 2;
      const n = [-Math.cos(am), 0, -Math.sin(am)]; // inward radial normal
      const p = (a, y) => [Math.cos(a)*R, y, Math.sin(a)*R];
      // one quad per segment per band, coloured with the band-top colour
      m.quad(p(a1,y1), p(a0,y1), p(a0,y0), p(a1,y0), n, c1, 0.85);
    }
  }
  // cap: dark purple disc on top
  for (let s = 0; s < SEG; s++) {
    const a0 = 2*Math.PI*s/SEG, a1 = 2*Math.PI*(s+1)/SEG;
    m._tri([0,H-4,0], [Math.cos(a1)*R, H-4, Math.sin(a1)*R], [Math.cos(a0)*R, H-4, Math.sin(a0)*R], [0,-1,0], top, 0.85);
  }
  return m;
}
