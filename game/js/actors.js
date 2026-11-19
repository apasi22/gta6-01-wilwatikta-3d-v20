// actors.js — people (head-to-toe), the v17-style car, police car, heli. Fresh composition.
import { Mesh } from './gl.js';

export const SKINS = [
  [0.85, 0.65, 0.48], [0.72, 0.52, 0.36], [0.60, 0.42, 0.30], [0.92, 0.74, 0.58],
];
export const SHIRTS = [
  [0.15, 0.55, 0.35], [0.85, 0.25, 0.25], [0.20, 0.35, 0.75], [0.95, 0.75, 0.20],
  [0.75, 0.35, 0.65], [0.35, 0.75, 0.80], [0.90, 0.55, 0.20],
];
export const HAIRS = [[0.10, 0.08, 0.06], [0.20, 0.14, 0.08], [0.05, 0.05, 0.05], [0.35, 0.25, 0.15]];

// Rotate a vector about the X axis (sagittal plane — used for limb chains).
function rotX(v, a) {
  const c = Math.cos(a), s = Math.sin(a);
  return [v[0], v[1]*c - v[2]*s, v[1]*s + v[2]*c];
}
function add(a, b) { return [a[0]+b[0], a[1]+b[1], a[2]+b[2]]; }
function sub(a, b) { return [a[0]-b[0], a[1]-b[1], a[2]-b[2]]; }

// Draw one limb segment (box) from pivot `p`, pointing down `len` after rotation rx about X
// and rz about Z, and return the end point. Width w, depth d.
function limb(m, p, len, w, d, col, rx, rz = 0) {
  const dir = rotX([0, -len, 0], rx);
  const dir2 = [dir[0]*Math.cos(rz) - dir[2]*Math.sin(rz), dir[1], dir[0]*Math.sin(rz) + dir[2]*Math.cos(rz)];
  const end = add(p, dir2);
  const mid = [(p[0]+end[0])/2, (p[1]+end[1])/2, (p[2]+end[2])/2];
  m.box(mid[0], mid[1], mid[2], w, len, d, col, 0, { rx, rz, px: p[0], py: p[1], pz: p[2] });
  return end;
}

// A pistol held pointing +Z from `pos` (the grip centre). Draws slide, grip, trigger guard,
// the dominant hand's fingers curled around the grip, index finger straight along the frame,
// and the support hand wrapping from below.
function drawPistol(m, pos, skin, gripCol = [0.12, 0.12, 0.14]) {
  const [x, y, z] = pos;
  // slide (barrel) — long, forward, gunmetal so it reads against a dark shirt
  m.box(x, y + 0.05, z + 0.10, 0.055, 0.06, 0.30, [0.42, 0.42, 0.46], 0.35);
  // muzzle tip
  m.box(x, y + 0.05, z + 0.26, 0.045, 0.045, 0.03, [0.05, 0.05, 0.06], 0.3);
  // rear sight
  m.box(x, y + 0.095, z - 0.03, 0.05, 0.02, 0.02, [0.05, 0.05, 0.06]);
  // grip — angled down and back
  m.box(x, y - 0.05, z - 0.05, 0.06, 0.16, 0.07, gripCol, 0, { rx: 0.35 });
  // trigger guard
  m.box(x, y - 0.01, z + 0.05, 0.04, 0.05, 0.10, [0.10, 0.10, 0.12]);
  // trigger
  m.box(x, y - 0.01, z + 0.06, 0.015, 0.04, 0.015, [0.05, 0.05, 0.06]);
  // dominant hand: fingers curled around the grip (4 small boxes stacked on the grip front)
  for (let i = 0; i < 4; i++) {
    m.box(x - 0.028, y - 0.02 - i * 0.032, z - 0.015, 0.02, 0.028, 0.055, skin, 0, { rx: 0.35 });
  }
  // index finger — straight along the frame (NOT on the trigger)
  m.box(x + 0.032, y + 0.02, z + 0.12, 0.018, 0.018, 0.16, skin);
  // thumb across the back of the grip
  m.box(x - 0.02, y + 0.005, z - 0.085, 0.07, 0.018, 0.02, skin, 0, { ry: 0.5 });
  // support hand wrapping from below / the side
  m.box(x + 0.045, y - 0.06, z - 0.01, 0.025, 0.09, 0.06, skin, 0, { rx: 0.35 });
  for (let i = 0; i < 3; i++) {
    m.box(x + 0.045, y - 0.03 - i * 0.03, z + 0.035, 0.022, 0.026, 0.05, skin, 0, { rx: 0.35 });
  }
}

// A person, head to toe. o: {x, z, ry, s (scale), skin, shirt, pants, shoes, hair,
// pose: 'stand'|'walk'|'aim'|'sit', phase (walk), detail: 'hero'|'plain', gun: bool}
// Faces +Z before the ry rotation. Height ~1.8*s.
export function drawPerson(m, o) {
  const s = o.s || 1;
  const skin = o.skin, shirt = o.shirt, pants = o.pants, shoes = o.shoes, hair = o.hair;
  const ph = o.phase || 0;
  const pose = o.pose || 'stand';
  const detail = o.detail || 'plain';
  // Local frame: build facing +Z at origin, then rotate the whole person by ry about (x, 0, z).
  // We approximate the ry rotation by rotating every box centre — so build into a temp mesh
  // in local space, then copy rotated. Simpler: build with a rotation wrapper: collect boxes
  // in a local Mesh, then merge with rotation.
  const lm = new Mesh();
  const H = 1.8;
  const hipY = 0.92, chestY = 1.42, shoulderY = 1.50, headY = 1.66;
  const lean = pose === 'walk' ? 0.07 : pose === 'aim' ? 0.10 : 0.02;
  const sway = pose === 'walk' ? 0.045 * Math.sin(ph) : 0;
  const bob = pose === 'walk' ? 0.03 * Math.abs(Math.cos(ph)) : 0;
  const y0 = bob;

  // ---------- legs ----------
  const legSwing = pose === 'walk' ? 0.55 : 0;
  for (const side of [-1, 1]) {
    const hip = [side * 0.11, hipY + y0, 0];
    const sw = legSwing * Math.sin(ph + (side < 0 ? 0 : Math.PI));
    const kneeBend = pose === 'walk' ? 0.65 * Math.max(0, Math.sin(ph + (side < 0 ? 0 : Math.PI) + 0.7)) : 0.06;
    const knee = limb(lm, hip, 0.45, 0.15, 0.15, pants, sw);
    const ankle = limb(lm, knee, 0.42, 0.125, 0.125, pants, sw - kneeBend);
    // foot: heel-to-toe roll — pitch changes through the stride
    const footPitch = pose === 'walk' ? 0.35 * Math.sin(ph + (side < 0 ? 0 : Math.PI) - 1.1) : 0;
    lm.box(ankle[0], ankle[1] - 0.035, ankle[2] + 0.07, 0.12, 0.07, 0.27, shoes, 0, { rx: footPitch, px: ankle[0], py: ankle[1], pz: ankle[2] });
    lm.box(ankle[0], ankle[1] - 0.065, ankle[2] + 0.07, 0.125, 0.025, 0.28, [0.08, 0.08, 0.10], 0, { rx: footPitch, px: ankle[0], py: ankle[1], pz: ankle[2] });
  }

  // ---------- torso: hips, waist, chest (tapered), shoulders ----------
  lm.box(0, hipY + 0.08 + y0, 0, 0.38, 0.16, 0.23, pants); // hips
  lm.box(0, 1.14 + y0, 0, 0.40, 0.26, 0.22, shirt); // waist
  lm.box(0, 1.36 + y0, 0, 0.46, 0.28, 0.25, shirt); // chest
  // pectoral shading: two slightly darker panels
  lm.box(-0.11, 1.38 + y0, 0.128, 0.16, 0.12, 0.01, [shirt[0]*0.85, shirt[1]*0.85, shirt[2]*0.85]);
  lm.box(0.11, 1.38 + y0, 0.128, 0.16, 0.12, 0.01, [shirt[0]*0.85, shirt[1]*0.85, shirt[2]*0.85]);
  // collar
  lm.box(0, 1.50 + y0, 0.10, 0.20, 0.05, 0.06, [shirt[0]*0.7, shirt[1]*0.7, shirt[2]*0.7]);
  // neck
  lm.box(0, 1.55 + y0, 0, 0.10, 0.10, 0.10, skin);
  // trapezius slope from neck to shoulders
  lm.box(-0.17, 1.50 + y0, 0, 0.14, 0.07, 0.20, shirt, 0, { rz: 0.35 });
  lm.box(0.17, 1.50 + y0, 0, 0.14, 0.07, 0.20, shirt, 0, { rz: -0.35 });

  // ---------- arms ----------
  const armSwing = pose === 'walk' ? 0.45 : 0;
  for (const side of [-1, 1]) {
    const sh = [side * 0.27, shoulderY + y0, 0];
    let rx1, rx2, rz;
    if (pose === 'aim') { rx1 = -1.22; rx2 = -0.30; rz = 0; } // both arms straight forward, hands meet at the grip
    else if (pose === 'walk') { rx1 = -armSwing * Math.sin(ph + (side < 0 ? Math.PI : 0)); rx2 = -0.25; rz = side * 0.06; }
    else { rx1 = 0.08; rx2 = -0.18; rz = side * 0.08; }
    const elbow = limb(lm, sh, 0.30, 0.115, 0.115, shirt, rx1, rz);
    const wrist = limb(lm, elbow, 0.28, 0.10, 0.10, skin, rx1 + rx2, rz);
    // hand
    lm.box(wrist[0], wrist[1] - 0.05, wrist[2] + 0.01, 0.09, 0.11, 0.05, skin);
  }
  // aim pose: pistol at the meeting point of both hands
  if (pose === 'aim') {
    const grip = [0, 1.38 + y0, 0.62];
    drawPistol(lm, grip, skin);
    // bring the forearms' hands to the grip: redrawn hands are already near it; add knuckles
    lm.box(-0.05, 1.36 + y0, 0.60, 0.07, 0.07, 0.07, skin);
    lm.box(0.06, 1.33 + y0, 0.60, 0.07, 0.07, 0.07, skin);
  }

  // ---------- head: skull, jaw, cheekbones, face ----------
  const hy = headY + y0;
  lm.box(0, hy, 0, 0.24, 0.26, 0.22, skin); // skull
  lm.box(0, hy - 0.10, 0.01, 0.20, 0.10, 0.20, skin); // jaw (tapered)
  lm.box(0, hy - 0.135, 0.01, 0.15, 0.05, 0.17, skin); // chin
  // cheekbones
  lm.box(-0.085, hy + 0.01, 0.10, 0.09, 0.05, 0.04, [skin[0]*0.96, skin[1]*0.94, skin[2]*0.92]);
  lm.box(0.085, hy + 0.01, 0.10, 0.09, 0.05, 0.04, [skin[0]*0.96, skin[1]*0.94, skin[2]*0.92]);
  // ears
  lm.box(-0.125, hy + 0.01, 0, 0.02, 0.06, 0.05, skin);
  lm.box(0.125, hy + 0.01, 0, 0.02, 0.06, 0.05, skin);
  // nose: bridge + tip + nostrils
  lm.box(0, hy - 0.01, 0.125, 0.045, 0.09, 0.035, [skin[0]*0.92, skin[1]*0.9, skin[2]*0.88]);
  lm.box(0, hy - 0.055, 0.135, 0.05, 0.02, 0.03, [skin[0]*0.88, skin[1]*0.86, skin[2]*0.84]);
  lm.box(-0.018, hy - 0.065, 0.13, 0.012, 0.012, 0.01, [0.15, 0.10, 0.08]);
  lm.box(0.018, hy - 0.065, 0.13, 0.012, 0.012, 0.01, [0.15, 0.10, 0.08]);
  // eyes: sclera + iris + pupil + eyelid + brow (hero detail; plain keeps sclera+iris)
  for (const side of [-1, 1]) {
    const ex = side * 0.058, ey = hy + 0.045;
    lm.box(ex, ey, 0.115, 0.052, 0.032, 0.012, [0.96, 0.96, 0.94], 0.1); // sclera
    lm.box(ex, ey, 0.122, 0.024, 0.026, 0.008, [0.12, 0.08, 0.05]); // iris
    lm.box(ex, ey, 0.127, 0.010, 0.012, 0.006, [0.02, 0.02, 0.02]); // pupil
    if (detail === 'hero') {
      lm.box(ex, ey + 0.022, 0.118, 0.056, 0.010, 0.010, skin, 0, { rz: side * -0.12 }); // upper eyelid
      lm.box(ex, ey + 0.038, 0.118, 0.058, 0.012, 0.010, hair, 0, { rz: side * -0.18 }); // brow
    }
  }
  // mouth: lips + dark mouth line
  lm.box(0, hy - 0.085, 0.115, 0.095, 0.014, 0.012, [0.55, 0.25, 0.22]);
  lm.box(0, hy - 0.092, 0.118, 0.07, 0.008, 0.008, [0.20, 0.08, 0.08]);
  // hair: top cap + back + side tufts
  lm.box(0, hy + 0.145, -0.01, 0.25, 0.07, 0.23, hair);
  lm.box(0, hy + 0.06, -0.115, 0.23, 0.18, 0.05, hair);
  lm.box(-0.115, hy + 0.08, 0.02, 0.04, 0.12, 0.16, hair);
  lm.box(0.115, hy + 0.08, 0.02, 0.04, 0.12, 0.16, hair);
  lm.box(0, hy + 0.10, 0.115, 0.20, 0.05, 0.03, hair); // fringe

  // ---------- merge local mesh into world mesh, rotated by ry about (x,0,z), scaled by s ----------
  const c = Math.cos(o.ry || 0), sn = Math.sin(o.ry || 0);
  const n = lm.count();
  for (let i = 0; i < n; i++) {
    const lx = lm.pos[i*3] * s, ly = lm.pos[i*3+1] * s, lz = lm.pos[i*3+2] * s;
    // lean forward (rotate about X at ground) then yaw
    const y2 = ly * Math.cos(lean) - lz * Math.sin(lean);
    const z2 = ly * Math.sin(lean) + lz * Math.cos(lean);
    const wx = o.x + lx * c + z2 * sn;
    const wz = o.z - lx * sn + z2 * c;
    m.pos.push(wx, y2, wz);
    const nx = lm.nor[i*3], ny = lm.nor[i*3+1], nz = lm.nor[i*3+2];
    const ny2 = ny * Math.cos(lean) - nz * Math.sin(lean);
    const nz2 = ny * Math.sin(lean) + nz * Math.cos(lean);
    m.nor.push(nx * c + nz2 * sn, ny2, -nx * sn + nz2 * c);
    m.col.push(lm.col[i*3], lm.col[i*3+1], lm.col[i*3+2]);
    m.emi.push(lm.emi[i]);
  }
  void sway;
}

// v17-style car: long body, sloped hood + trunk, clear cabin with glass, white headlights,
// grey-hub wheels. Faces +Z in local space; o: {x, z, ry, color, police}
export function drawCar(m, o) {
  const col = o.color || [0.85, 0.12, 0.12];
  const dark = [col[0]*0.6, col[1]*0.6, col[2]*0.6];
  const cm = new Mesh();
  const W = 1.9, L = 4.4;
  // lower body
  cm.box(0, 0.55, 0, W, 0.55, L, col);
  // side skirts + bumpers
  cm.box(0, 0.32, 0, W + 0.06, 0.16, L + 0.1, [0.08, 0.08, 0.10]);
  cm.box(0, 0.42, L/2 + 0.02, W, 0.18, 0.10, [0.10, 0.10, 0.12]); // front bumper
  cm.box(0, 0.42, -L/2 - 0.02, W, 0.18, 0.10, [0.10, 0.10, 0.12]); // rear bumper
  // sloped hood (front, +Z): tall at windshield, thin at the nose
  cm.wedge(0, 0.82, 1.55, W - 0.15, 0.28, 1.3, col);
  // sloped trunk (rear): tall at cabin, thin at the tail
  cm.wedge(0, 0.82, -1.55, W - 0.15, 0.28, 1.3, col, 0, { ry: Math.PI });
  // cabin with glass
  cm.box(0, 1.18, -0.35, 1.68, 0.55, 2.1, col);
  cm.box(0, 1.47, -0.35, 1.60, 0.10, 2.0, dark); // roof
  // side windows (dark glass, both sides)
  cm.box(-0.85, 1.20, -0.35, 0.04, 0.42, 1.85, [0.10, 0.13, 0.18], 0.25);
  cm.box(0.85, 1.20, -0.35, 0.04, 0.42, 1.85, [0.10, 0.13, 0.18], 0.25);
  // windshield (sloped) + rear window
  cm.box(0, 1.22, 0.72, 1.55, 0.45, 0.06, [0.10, 0.13, 0.18], 0.25, { rx: -0.35 });
  cm.box(0, 1.22, -1.42, 1.55, 0.45, 0.06, [0.10, 0.13, 0.18], 0.25, { rx: 0.35 });
  // door seams
  cm.box(-0.96, 0.85, 0.25, 0.02, 0.4, 0.03, [0.05, 0.05, 0.06]);
  cm.box(0.96, 0.85, 0.25, 0.02, 0.4, 0.03, [0.05, 0.05, 0.06]);
  cm.box(-0.96, 0.85, -0.75, 0.02, 0.4, 0.03, [0.05, 0.05, 0.06]);
  cm.box(0.96, 0.85, -0.75, 0.02, 0.4, 0.03, [0.05, 0.05, 0.06]);
  // side mirrors
  cm.box(-1.02, 1.05, 0.55, 0.10, 0.08, 0.14, [0.12, 0.12, 0.14]);
  cm.box(1.02, 1.05, 0.55, 0.10, 0.08, 0.14, [0.12, 0.12, 0.14]);
  // grille + headlights (front, white, emissive)
  cm.box(0, 0.62, L/2 + 0.05, 0.9, 0.14, 0.06, [0.08, 0.08, 0.10]);
  cm.box(-0.62, 0.68, L/2 + 0.06, 0.42, 0.16, 0.06, [0.98, 0.98, 0.90], 0.9);
  cm.box(0.62, 0.68, L/2 + 0.06, 0.42, 0.16, 0.06, [0.98, 0.98, 0.90], 0.9);
  // taillights (rear, red, emissive)
  cm.box(-0.62, 0.68, -L/2 - 0.06, 0.42, 0.14, 0.06, [0.95, 0.10, 0.10], 0.9);
  cm.box(0.62, 0.68, -L/2 - 0.06, 0.42, 0.14, 0.06, [0.95, 0.10, 0.10], 0.9);
  // exhaust
  cm.cylinder(0.55, 0.30, -L/2 - 0.08, 0.07, 0.22, [0.35, 0.35, 0.38], 0, 8, 'z');
  // wheels: black tires + grey hubs, axis X
  for (const [wx, wz] of [[-0.88, 1.35], [0.88, 1.35], [-0.88, -1.35], [0.88, -1.35]]) {
    cm.cylinder(wx, 0.36, wz, 0.36, 0.24, [0.07, 0.07, 0.08], 0, 12, 'x');
    cm.cylinder(wx + (wx < 0 ? -0.13 : 0.13), 0.36, wz, 0.19, 0.05, [0.75, 0.75, 0.78], 0.2, 10, 'x');
  }
  if (o.police) {
    // white body repaint is done by caller colour; add the light bar
    cm.box(-0.22, 1.56, -0.35, 0.42, 0.10, 0.22, [0.95, 0.10, 0.10], 1.0);
    cm.box(0.22, 1.56, -0.35, 0.42, 0.10, 0.22, [0.15, 0.35, 0.95], 1.0);
    cm.box(0, 1.50, -0.35, 0.9, 0.06, 0.24, [0.08, 0.08, 0.10]);
  }
  // merge with yaw rotation about (x, 0, z)
  const c = Math.cos(o.ry || 0), sn = Math.sin(o.ry || 0);
  const n = cm.count();
  for (let i = 0; i < n; i++) {
    const lx = cm.pos[i*3], ly = cm.pos[i*3+1], lz = cm.pos[i*3+2];
    m.pos.push(o.x + lx * c + lz * sn, ly, o.z - lx * sn + lz * c);
    const nx = cm.nor[i*3], ny = cm.nor[i*3+1], nz = cm.nor[i*3+2];
    m.nor.push(nx * c + nz * sn, ny, -nx * sn + nz * c);
    m.col.push(cm.col[i*3], cm.col[i*3+1], cm.col[i*3+2]);
    m.emi.push(cm.emi[i]);
  }
}

// Police heli: body, tail boom, spinning main rotor, tail rotor, skids, glass, searchlight.
export function drawHeli(m, o) {
  const rotor = o.rotor || 0;
  const hm = new Mesh();
  hm.box(0, 0, 0, 1.5, 1.1, 2.2, [0.92, 0.92, 0.95]); // body
  hm.sphere(0, 0.1, 1.05, 0.55, [0.92, 0.92, 0.95], 0, 6); // nose
  hm.box(0, 0.15, 1.05, 1.1, 0.55, 0.5, [0.10, 0.14, 0.20], 0.3); // cockpit glass
  hm.box(0, 0.1, -1.9, 0.35, 0.35, 1.8, [0.85, 0.85, 0.88]); // tail boom
  hm.box(0, 0.45, -2.75, 0.08, 0.9, 0.5, [0.85, 0.85, 0.88]); // tail fin
  hm.box(0, 0.62, 0, 0.5, 0.12, 0.5, [0.15, 0.15, 0.18]); // rotor mast
  // main rotor: two long blades, spinning
  hm.box(0, 0.72, 0, 5.4, 0.05, 0.28, [0.12, 0.12, 0.14], 0, { ry: rotor });
  hm.box(0, 0.72, 0, 0.28, 0.05, 5.4, [0.12, 0.12, 0.14], 0, { ry: rotor });
  // tail rotor
  hm.box(0, 0.45, -2.8, 0.06, 1.3, 0.10, [0.12, 0.12, 0.14], 0, { rx: rotor * 3 });
  // skids
  hm.box(-0.7, -0.75, 0.3, 0.08, 0.08, 2.4, [0.15, 0.15, 0.18]);
  hm.box(0.7, -0.75, 0.3, 0.08, 0.08, 2.4, [0.15, 0.15, 0.18]);
  hm.box(-0.7, -0.5, 0.6, 0.08, 0.5, 0.08, [0.15, 0.15, 0.18]);
  hm.box(0.7, -0.5, 0.6, 0.08, 0.5, 0.08, [0.15, 0.15, 0.18]);
  // searchlight beam — short pale glow under the belly, angled down-forward
  hm.box(0, -0.9, 0.9, 0.35, 1.6, 0.35, [1.0, 0.95, 0.75], 0.4, { rx: 0.5 });
  // police markings: blue stripe + red/blue beacon
  hm.box(0, -0.15, 0.4, 1.52, 0.22, 1.2, [0.15, 0.35, 0.95], 0.3);
  hm.box(0, 0.62, -0.6, 0.18, 0.10, 0.18, [0.95, 0.10, 0.10], 1.0);
  const c = Math.cos(o.ry || 0), sn = Math.sin(o.ry || 0);
  const n = hm.count();
  for (let i = 0; i < n; i++) {
    const lx = hm.pos[i*3], ly = hm.pos[i*3+1], lz = hm.pos[i*3+2];
    m.pos.push(o.x + lx * c + lz * sn, o.y + ly, o.z - lx * sn + lz * c);
    const nx = hm.nor[i*3], ny = hm.nor[i*3+1], nz = hm.nor[i*3+2];
    m.nor.push(nx * c + nz * sn, ny, -nx * sn + nz * c);
    m.col.push(hm.col[i*3], hm.col[i*3+1], hm.col[i*3+2]);
    m.emi.push(hm.emi[i]);
  }
}
