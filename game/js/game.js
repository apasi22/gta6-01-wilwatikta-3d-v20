// game.js — WILWATIKTA 3D: open-world crime game (raw WebGL1, zero network). Fresh composition.
import { mat4Identity, mat4Perspective, mat4LookAt, mat4Multiply, mat4Ortho, createProgram, VS, FS, Mesh } from './gl.js';
import { buildCity, buildSky, makeRng } from './world.js';
import { drawPerson, drawCar, drawHeli, SKINS, SHIRTS, HAIRS } from './actors.js';

const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);
const SHOT = params.get('shot') || '';
const T0 = performance.now();

// ---------------- state ----------------
const S = {
  mode: 'title', // title | drive | onfoot | map | pause | upgrade
  prevMode: 'drive',
  t: 0,
  money: 12480, stars: 4, health: 100, cond: 100,
  weapon: 2,
  weapons: [
    { name: 'FIST', ammo: '∞' }, { name: 'PISTOL', ammo: '12/60' },
    { name: 'SMG TAWON', ammo: '32/160' }, { name: 'SHOTGUN', ammo: 'LOCKED' },
    { name: 'RIFLE', ammo: 'LOCKED' },
  ],
  mission: 6, missionTime: 193, missionDist: 168,
  speed: 97, gear: 5, inCar: true,
  player: { x: 0, z: 6, ry: Math.PI, walk: 0, moving: false },
  car: { x: 0, z: 2, ry: Math.PI, speed: 97 },
  camYaw: 0, camPitch: 0.12,
  radio: 0,
  radios: [
    { st: 'GAMELAN FM 101.1', song: 'Bonang Malam — Gamelan Wilwatikta' },
    { st: 'WAVE 88.1 · Neon Drive', song: 'Pink Horizon — Lumen Kids' },
    { st: 'CELESTE 98.1', song: 'Malecón Mirage — Vela Roja' },
  ],
  enemies: [],
  peds: [],
  heli: { x: 2, y: 13, z: -8, rotor: 0 },
  dialogue: { name: 'BAMBANG', role: 'MECHANIC · BENGKEL', text: 'Your Garuda needs new brakes. Come by the bengkel.', face: 3 },
  hitAt: -10,
};
const MISSIONS = [
  ['Selamat Datang', 300, 'done'], ['Hot Wheels', 450, 'done'], ['Antar Paket', 400, 'done'],
  ['Tagihan Pasar', 550, 'done'], ['Mata-Mata', 500, 'done'], ['Balapan Senja', 700, 'active'],
  ['Gudang Segara', 650, ''], ['Kabur dari WPD', 600, ''], ['Heat Wave', 750, ''],
  ['Kencana Hilang', 700, ''], ['Double Cross', 900, ''], ['The Last Ride', 1200, ''],
];
const CREW = [
  { name: 'SUGENG', sub: 'YOU', skin: 0, hair: 0, shirt: 0, you: true },
  { name: 'AGUS', sub: '$200 HIRE [Z]', skin: 1, hair: 1, shirt: 1 },
  { name: 'WANTO', sub: '$500 HIRE [X]', skin: 2, hair: 2, shirt: 2, cap: true },
  { name: 'BAMBANG', sub: '$350 HIRE [H]', skin: 0, hair: 3, shirt: 3 },
  { name: 'RATNA', sub: '$300 HIRE [C]', skin: 3, hair: 0, shirt: 4, female: true },
  { name: 'SLAMET', sub: '$400 HIRE [V]', skin: 1, hair: 2, shirt: 5 },
];
const DISTRICTS = [
  { name: 'PELABUHAN SEGARA', color: 'rgba(59,110,180,0.62)', pois: [['W', 'Warehouse', 42, 62]] },
  { name: 'KAMPUNG BATIK', color: 'rgba(124,70,180,0.62)', pois: [] },
  { name: 'LORONG EMAS', color: 'rgba(190,150,40,0.62)', pois: [] },
  { name: 'PANTAI KIDUL', color: 'rgba(40,150,130,0.62)', pois: [['D', 'Docks', 46, 66]] },
  { name: 'ALUN-ALUN', color: 'rgba(50,80,150,0.62)', pois: [['M', 'Mansion', 44, 34], ['G', 'Bengkel Bambang', 62, 52], ['P', 'Kantor WPD', 40, 72], ['F', 'Safehouse', 56, 82]] },
  { name: 'PASAR SENJA', color: 'rgba(150,100,50,0.62)', pois: [['C', 'Casino', 68, 38], ['S', 'Showroom', 66, 76]] },
];

// ---------------- 2D portraits ----------------
function drawFace(cv, c) {
  const x = cv.getContext('2d'); const W = cv.width, H = cv.height;
  x.clearRect(0, 0, W, H);
  x.fillStyle = '#2a2140'; x.fillRect(0, 0, W, H);
  const skin = ['#d9a878', '#b98a5e', '#9a6a44', '#e8b98a'][c.skin];
  const hair = ['#1a1210', '#33241a', '#0d0d0d', '#5a3d24'][c.hair];
  const shirt = ['#2a9a5a', '#d94040', '#2f5cb8', '#e8b13c', '#2a9a8a', '#c85a7a'][c.shirt];
  // shoulders / shirt
  x.fillStyle = shirt; x.beginPath(); x.moveTo(8, H); x.lineTo(26, H - 34); x.lineTo(W - 26, H - 34); x.lineTo(W - 8, H); x.closePath(); x.fill();
  // neck
  x.fillStyle = skin; x.fillRect(W/2 - 9, H - 44, 18, 14);
  // head
  x.fillStyle = skin; x.beginPath(); x.ellipse(W/2, H/2 - 6, 26, 30, 0, 0, Math.PI * 2); x.fill();
  // ears
  x.beginPath(); x.ellipse(W/2 - 27, H/2 - 6, 5, 8, 0, 0, Math.PI * 2); x.fill();
  x.beginPath(); x.ellipse(W/2 + 27, H/2 - 6, 5, 8, 0, 0, Math.PI * 2); x.fill();
  // hair
  x.fillStyle = hair;
  if (c.female) {
    x.beginPath(); x.ellipse(W/2, H/2 - 16, 29, 22, 0, Math.PI, 0); x.fill();
    x.fillRect(W/2 - 29, H/2 - 16, 8, 34); x.fillRect(W/2 + 21, H/2 - 16, 8, 34);
  } else if (c.cap) {
    x.fillStyle = '#1e4fa0'; x.beginPath(); x.ellipse(W/2, H/2 - 18, 28, 14, 0, Math.PI, 0); x.fill();
    x.fillRect(W/2 - 28, H/2 - 20, 56, 8);
    x.fillStyle = '#ffd24a'; x.fillRect(W/2 - 6, H/2 - 30, 12, 8);
  } else {
    x.beginPath(); x.ellipse(W/2, H/2 - 18, 28, 18, 0, Math.PI, 0); x.fill();
    x.fillRect(W/2 - 28, H/2 - 18, 10, 12); x.fillRect(W/2 + 18, H/2 - 18, 10, 12);
  }
  // brows + eyes
  x.fillStyle = hair;
  x.fillRect(W/2 - 19, H/2 - 14, 13, 3); x.fillRect(W/2 + 6, H/2 - 14, 13, 3);
  x.fillStyle = '#fff';
  x.beginPath(); x.ellipse(W/2 - 12, H/2 - 7, 6, 4, 0, 0, Math.PI * 2); x.fill();
  x.beginPath(); x.ellipse(W/2 + 12, H/2 - 7, 6, 4, 0, 0, Math.PI * 2); x.fill();
  x.fillStyle = '#241a12';
  x.beginPath(); x.arc(W/2 - 12, H/2 - 7, 2.6, 0, Math.PI * 2); x.fill();
  x.beginPath(); x.arc(W/2 + 12, H/2 - 7, 2.6, 0, Math.PI * 2); x.fill();
  // nose + mouth
  x.fillStyle = 'rgba(0,0,0,0.18)'; x.fillRect(W/2 - 1.5, H/2 + 1, 3, 9);
  x.fillStyle = '#7a3a30'; x.fillRect(W/2 - 8, H/2 + 16, 16, 3);
}

function buildCrew() {
  for (const target of ['crew', 'map-crew']) {
    const el = $(target); if (!el) continue; el.innerHTML = '';
    CREW.forEach((c) => {
      const d = document.createElement('div'); d.className = 'mate' + (c.you ? ' you' : '');
      const cv = document.createElement('canvas'); cv.width = 128; cv.height = 128;
      drawFace(cv, c); d.appendChild(cv);
      const nm = document.createElement('div'); nm.className = 'nm'; nm.textContent = c.name; d.appendChild(nm);
      const pr = document.createElement('div'); pr.className = 'pr'; pr.textContent = c.sub; d.appendChild(pr);
      el.appendChild(d);
    });
  }
  drawFace($('dlg-face'), CREW[S.dialogue.face]);
}

// ---------------- minimap ----------------
function drawMinimap() {
  const cv = $('minimap'); const x = cv.getContext('2d');
  const W = cv.width, H = cv.height;
  x.clearRect(0, 0, W, H);
  x.fillStyle = '#241c38'; x.beginPath(); x.arc(W/2, H/2, W/2, 0, Math.PI * 2); x.fill();
  x.save(); x.beginPath(); x.arc(W/2, H/2, W/2, 0, Math.PI * 2); x.clip();
  const cols = ['#3b6eb4', '#7c46b4', '#be9628', '#289682', '#325096', '#966432'];
  const cell = W / 3;
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) {
    x.fillStyle = cols[r * 3 + c]; x.globalAlpha = 0.85;
    x.fillRect(c * cell, r * cell, cell, cell);
  }
  x.globalAlpha = 1;
  x.strokeStyle = 'rgba(255,255,255,0.5)'; x.lineWidth = 3;
  for (let i = 1; i < 3; i++) {
    x.beginPath(); x.moveTo(i * cell, 0); x.lineTo(i * cell, H); x.stroke();
    x.beginPath(); x.moveTo(0, i * cell); x.lineTo(W, i * cell); x.stroke();
  }
  // POI dots
  const dots = [[0.22, 0.3, '#fff'], [0.55, 0.62, '#ffd24a'], [0.78, 0.28, '#ff4d4d'], [0.4, 0.78, '#37e07a']];
  for (const [dx, dy, col] of dots) {
    x.fillStyle = col; x.beginPath(); x.arc(dx * W, dy * H, 7, 0, Math.PI * 2); x.fill();
    x.strokeStyle = '#1a1030'; x.lineWidth = 2; x.stroke();
  }
  // player arrow (centre)
  const px = W/2, py = H/2;
  x.fillStyle = '#fff'; x.strokeStyle = '#1a1030'; x.lineWidth = 2;
  x.beginPath(); x.moveTo(px, py - 14); x.lineTo(px + 9, py + 10); x.lineTo(px, py + 4); x.lineTo(px - 9, py + 10); x.closePath();
  x.fill(); x.stroke();
  x.restore();
}

// ---------------- map screen ----------------
function buildMap() {
  const ol = $('mission-list'); ol.innerHTML = '';
  MISSIONS.forEach(([name, price, st], i) => {
    const li = document.createElement('li');
    li.className = st === 'done' ? 'done' : st === 'active' ? 'active' : '';
    li.innerHTML = `${i + 1}. ${name} <b>$${price}</b> ${st === 'done' ? '✓' : st === 'active' ? 'ACTIVE' : '—'}`;
    ol.appendChild(li);
  });
  const dg = $('map-districts'); dg.innerHTML = '';
  DISTRICTS.forEach((d) => {
    const div = document.createElement('div'); div.className = 'district';
    div.style.background = d.color;
    div.innerHTML = `<h4>${d.name}</h4>`;
    for (const [letter, label, lx, ly] of d.pois) {
      const p = document.createElement('div'); p.className = 'poi';
      p.style.left = lx + '%'; p.style.top = ly + '%';
      p.innerHTML = `<b>${letter}</b>${label}`;
      div.appendChild(p);
    }
    dg.appendChild(div);
  });
  // 42% ring
  const rc = $('map-ring'); const x = rc.getContext('2d');
  x.clearRect(0, 0, 220, 220);
  x.lineWidth = 16; x.strokeStyle = '#3a3350';
  x.beginPath(); x.arc(110, 110, 82, 0, Math.PI * 2); x.stroke();
  x.strokeStyle = '#ffb400'; x.lineCap = 'round';
  x.beginPath(); x.arc(110, 110, 82, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * 0.42); x.stroke();
  x.fillStyle = '#fff'; x.font = 'bold 44px Arial'; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.fillText('42%', 110, 110);
}

// ---------------- HUD ----------------
function setWeapon(i) {
  if (i < 0 || i > 4) return;
  S.weapon = i;
  document.querySelectorAll('#slots .slot').forEach((el, j) => el.classList.toggle('active', j === i));
  $('active-weapon').textContent = S.weapons[i].name;
  $('ammo-line').textContent = `${S.weapons[i].name} · ${S.weapons[i].ammo} ROUNDS`;
}
function setMode(mode) {
  S.prevMode = S.mode === 'title' ? 'drive' : S.mode;
  S.mode = mode;
  $('title-screen').classList.toggle('hidden', mode !== 'title');
  $('map-screen').style.display = mode === 'map' ? 'block' : 'none';
  $('pause-screen').style.display = mode === 'pause' ? 'flex' : 'none';
  $('upgrade-screen').style.display = mode === 'upgrade' ? 'flex' : 'none';
  const inGame = mode === 'drive' || mode === 'onfoot';
  $('mission').style.display = inGame ? 'block' : 'none';
  $('dialogue').style.display = inGame ? 'flex' : 'none';
  $('crew').style.display = inGame ? 'flex' : 'none';
  $('topright').style.display = inGame ? 'block' : 'none'; // hidden on the map (it has its own stats)
  $('bottomright').style.display = inGame ? 'block' : 'none';
  $('minimap-wrap').style.display = inGame ? 'block' : 'none';
  $('hitmarker').style.display = 'none';
}
function setDialogue(name, role, text, face) {
  S.dialogue = { name, role, text, face };
  $('dlg-name').textContent = name; $('dlg-role').textContent = role; $('dlg-text').textContent = text;
  drawFace($('dlg-face'), CREW[face]);
}
function setMission(n, title, desc, next) {
  S.mission = n;
  $('mission-title').textContent = `MISSION ${n}/12 — ${title}`;
  $('mission-desc').textContent = desc;
  if (next) $('mission-next').innerHTML = next;
}
function updateHUD() {
  $('speed').textContent = S.inCar ? Math.round(S.car.speed) : 0;
  const g = S.inCar ? Math.min(5, 1 + Math.floor(S.car.speed / 22)) : 0;
  S.gear = g; $('gear').textContent = S.inCar ? 'G' + g : 'G0';
  $('cond-fill').style.width = S.cond + '%';
  $('cond-pct').textContent = Math.round(S.cond) + '%';
  $('health-fill').style.width = S.health + '%';
  $('money').textContent = '$' + S.money.toLocaleString('en-US');
}

// ---------------- WebGL setup ----------------
const canvas = $('gl');
const gl = canvas.getContext('webgl', { antialias: true, preserveDrawingBuffer: true });
if (!gl) throw new Error('WebGL unavailable');
const prog = createProgram(gl, VS, FS);
gl.useProgram(prog);
gl.enable(gl.DEPTH_TEST);
const uMVP = gl.getUniformLocation(prog, 'uMVP');
const uNor = gl.getUniformLocation(prog, 'uNor');
const uCam = gl.getUniformLocation(prog, 'uCam');
const uSun = gl.getUniformLocation(prog, 'uSun');
const uFogCol = gl.getUniformLocation(prog, 'uFogCol');
const uFogNear = gl.getUniformLocation(prog, 'uFogNear');
const uFogFar = gl.getUniformLocation(prog, 'uFogFar');
gl.uniform3f(uSun, 0.55, 0.75, 0.35);
gl.uniform3f(uFogCol, 0.23, 0.13, 0.30);

const cityMesh = buildCity();
const cityBufs = cityMesh.upload(gl, prog);
const cityTris = cityMesh.count();
const skyMesh = buildSky();
const skyBufs = skyMesh.upload(gl, prog);
const skyTris = skyMesh.count();

function drawMesh(mesh, bufs, view, proj, camPos, fogNear, fogFar) {
  const mvp = mat4Multiply(proj, view);
  gl.uniformMatrix4fv(uMVP, false, mvp);
  gl.uniformMatrix4fv(uNor, false, mat4Identity());
  gl.uniform3f(uCam, camPos[0], camPos[1], camPos[2]);
  gl.uniform1f(uFogNear, fogNear); gl.uniform1f(uFogFar, fogFar);
  const locs = ['aPos', 'aNor', 'aCol', 'aEmi'];
  bufs.forEach((b, i) => {
    gl.bindBuffer(gl.ARRAY_BUFFER, b);
    const loc = gl.getAttribLocation(prog, locs[i]);
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, i === 3 ? 1 : 3, gl.FLOAT, false, 0, 0);
  });
  gl.drawArrays(gl.TRIANGLES, 0, mesh.count());
}

// ---------------- scene population (deterministic) ----------------
function populate() {
  const rng = makeRng(77);
  S.enemies = [];
  for (let i = 0; i < 4; i++) {
    S.enemies.push({
      x: -4.5 + i * 3, z: -6.5 - (i % 2) * 1.8, ry: 0.12 * (i - 1.5),
      skin: SKINS[i % 4], shirt: [0.85, 0.18, 0.18], pants: [0.12, 0.12, 0.16],
      shoes: [0.10, 0.08, 0.08], hair: HAIRS[i % 4], hp: 100, phase: rng() * 6,
    });
  }
  S.peds = [];
  const pedSpots = [[-9.5, 14], [9.8, -6], [-6, -18], [12, 20], [-14, -4], [6, -24], [18, 8], [-20, 10]];
  pedSpots.forEach(([x, z], i) => {
    S.peds.push({
      x, z, ry: rng() * Math.PI * 2, speed: 0.9 + rng() * 0.7, phase: rng() * 6,
      skin: SKINS[i % 4], shirt: SHIRTS[i % SHIRTS.length], pants: [0.15, 0.16, 0.22],
      shoes: [0.12, 0.10, 0.10], hair: HAIRS[(i + 1) % 4],
    });
  });
}
populate();

function buildActors(t) {
  const m = new Mesh();
  const mode = S.mode;
  // hero car (red Garuda GT, v17 style) — parked on the title screen, driven in chase
  if (mode === 'title') {
    drawCar(m, { x: -3.2, z: 0.8, ry: 1.45, color: [0.85, 0.12, 0.12] });
  } else if (mode === 'onfoot') {
    // parked out of the hero's view in night mode
    drawCar(m, { x: 9, z: 13, ry: 2.2, color: [0.85, 0.12, 0.12] });
  } else {
    drawCar(m, { x: S.car.x, z: S.car.z, ry: S.car.ry, color: [0.85, 0.12, 0.12] });
  }
  // white WPD police car parked on the avenue
  drawCar(m, { x: 14, z: -14, ry: -0.4, color: [0.92, 0.92, 0.94], police: true });
  // hero
  if (mode === 'title') {
    drawPerson(m, { x: 2.8, z: 4.2, ry: -0.35, s: 1.28, skin: SKINS[0], shirt: SHIRTS[0], pants: [0.22, 0.24, 0.30], shoes: [0.45, 0.32, 0.20], hair: HAIRS[0], pose: 'aim', detail: 'hero' });
  } else if (mode === 'onfoot' || mode === 'map') {
    drawPerson(m, { x: S.player.x, z: S.player.z, ry: S.player.ry, s: 1, skin: SKINS[0], shirt: SHIRTS[0], pants: [0.22, 0.24, 0.30], shoes: [0.45, 0.32, 0.20], hair: HAIRS[0], pose: S.player.moving ? 'walk' : 'stand', phase: S.player.walk, detail: 'hero' });
  }
  // enemies (night) — visible in on-foot and map modes, plus a couple in chase
  if (mode === 'onfoot' || mode === 'map') {
    for (const e of S.enemies) {
      drawPerson(m, { x: e.x, z: e.z, ry: e.ry, s: 1, skin: e.skin, shirt: e.shirt, pants: e.pants, shoes: e.shoes, hair: e.hair, pose: 'aim', detail: 'plain' });
    }
  }
  // pedestrians walking the sidewalks
  for (const p of S.peds) {
    const px = p.x + Math.sin(t * 0.35 * p.speed + p.phase) * 1.5;
    const pz = p.z + Math.cos(t * 0.22 * p.speed + p.phase) * 1.5;
    drawPerson(m, { x: px, z: pz, ry: p.ry + Math.sin(t * 0.3 + p.phase) * 0.4, s: 0.98, skin: p.skin, shirt: p.shirt, pants: p.pants, shoes: p.shoes, hair: p.hair, pose: 'walk', phase: t * 3.2 * p.speed + p.phase, detail: 'plain' });
  }
  // heli — circles above the avenue AHEAD of the player, low enough to stay inside the camera's top edge
  const heliAhead = (mode === 'onfoot' || mode === 'map') ? 14 : 12;
  const heliY = (mode === 'onfoot' || mode === 'map') ? 8 : 9;
  const heliZ0 = (mode === 'onfoot' || mode === 'map') ? S.player.z : S.car.z;
  const hx = S.car.x + 3 + Math.sin(t * 0.25) * 3, hz = heliZ0 - heliAhead + Math.cos(t * 0.18) * 2;
  S.heli.x = hx; S.heli.z = hz; S.heli.rotor = t * 9;
  drawHeli(m, { x: hx, y: heliY + Math.sin(t * 0.5) * 0.5, z: hz, ry: 0.6, rotor: S.heli.rotor });
  return m;
}

// ---------------- camera ----------------
function cameraFor(mode, t) {
  if (mode === 'title') {
    return { eye: [0.9, 1.9, 8.6], at: [1.0, 1.25, -0.5], up: [0, 1, 0] };
  }
  if (mode === 'map') {
    return { eye: [0, 42, 26], at: [0, 0, -2], up: [0, 1, 0] };
  }
  if (mode === 'onfoot') {
    const p = S.player;
    const bx = p.x - Math.sin(p.ry) * 5.2, bz = p.z - Math.cos(p.ry) * 5.2;
    return { eye: [bx, 2.6, bz], at: [p.x + Math.sin(p.ry) * 4, 1.3, p.z + Math.cos(p.ry) * 4], up: [0, 1, 0] };
  }
  // drive (and pause/upgrade keep the chase cam)
  const c = S.car;
  const back = 6.4, up = 3.1;
  const bx = c.x - Math.sin(c.ry) * back + Math.sin(c.ry + S.camYaw) * 0.0;
  const bz = c.z - Math.cos(c.ry) * back;
  return {
    eye: [bx + Math.sin(S.camYaw) * 1.2, up + S.camPitch * 4, bz + Math.cos(S.camYaw) * 1.2],
    at: [c.x + Math.sin(c.ry) * 8, 1.5, c.z + Math.cos(c.ry) * 8], up: [0, 1, 0],
  };
}

// ---------------- render ----------------
let lastT = 0;
function frame(now) {
  const dt = Math.min(0.05, (now - lastT) / 1000 || 0.016);
  lastT = now;
  if (SHOT === '') S.t += dt; else S.t += 1 / 60; // fixed step in shot mode
  const t = S.t;
  const w = canvas.clientWidth || 1280, h = canvas.clientHeight || 720;
  if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
  gl.viewport(0, 0, canvas.width, canvas.height);
  gl.clearColor(0.14, 0.07, 0.22, 1);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  // simple game tick: car cruise, player walk bob, mission clock
  if (S.mode === 'drive') {
    S.car.speed = 97 + Math.sin(t * 0.8) * 2;
    // forward is (sin ry, cos ry)
    S.car.x += Math.sin(S.car.ry) * S.car.speed * dt * 0.12;
    S.car.z += Math.cos(S.car.ry) * S.car.speed * dt * 0.12;
    if (S.car.z < -40) { S.car.z = 30; }
    S.missionTime = Math.max(0, S.missionTime - dt);
    $('mission-time').textContent = `${Math.floor(S.missionTime / 60)}:${String(Math.floor(S.missionTime % 60)).padStart(2, '0')}`;
  }
  if (S.mode === 'onfoot' && S.player.moving) S.player.walk += dt * 6;

  const cam = cameraFor(S.mode, t);
  const proj = mat4Perspective(1.05, canvas.width / canvas.height, 0.1, 600);
  const view = mat4LookAt(cam.eye[0], cam.eye[1], cam.eye[2], cam.at[0], cam.at[1], cam.at[2], 0, 1, 0);
  drawMesh(skyMesh, skyBufs, view, proj, cam.eye, 1e9, 1e9 + 1);
  drawMesh(cityMesh, cityBufs, view, proj, cam.eye, 30, 170);
  const actors = buildActors(t);
  const abufs = actors.upload(gl, prog);
  drawMesh(actors, abufs, view, proj, cam.eye, 30, 170);
  abufs.forEach((b) => gl.deleteBuffer(b));
  if (now - S.hitAt < 900 || SHOT === 'night') $('hitmarker').style.display = 'block';
  else $('hitmarker').style.display = 'none';
  requestAnimationFrame(frame);
}

// ---------------- input ----------------
const keys = {};
addEventListener('keydown', (e) => {
  if (e.repeat) return;
  keys[e.key.toLowerCase()] = true;
  const k = e.key.toLowerCase();
  if (k === 'm') { if (S.mode === 'map') setMode(S.prevMode === 'map' ? 'drive' : S.prevMode); else { S.prevMode = S.mode; setMode('map'); } }
  if (k === 'escape' || k === 'p') { if (S.mode === 'pause') setMode(S.prevMode); else if (S.mode !== 'title' && S.mode !== 'map') { S.prevMode = S.mode; setMode('pause'); } }
  if (k === 'e') toggleCar();
  if (k === 'q') setWeapon((S.weapon + 1) % 5);
  if (k >= '0' && k <= '4') setWeapon(+k);
  if (k === 'r') { S.radio = (S.radio + 1) % S.radios.length; const r = S.radios[S.radio]; document.querySelector('#radio-box .st').textContent = '♪ ' + r.st; document.querySelector('#radio-box .song').textContent = r.song; }
  if (k === 'u') { S.prevMode = S.mode; setMode('upgrade'); S.cond = 100; S.money -= 350; updateHUD(); }
  if (k === 'w' || k === 'a' || k === 's' || k === 'd') S.player.moving = true;
});
addEventListener('keyup', (e) => { keys[e.key.toLowerCase()] = false; if (!keys.w && !keys.a && !keys.s && !keys.d) S.player.moving = false; });
let dragging = false, lx = 0;
canvas.addEventListener('mousedown', (e) => { dragging = true; lx = e.clientX; if (S.mode === 'drive' || S.mode === 'onfoot') shoot(); });
addEventListener('mousemove', (e) => { if (!dragging) return; S.camYaw += (e.clientX - lx) * 0.004; lx = e.clientX; });
addEventListener('mouseup', () => { dragging = false; });
function shoot() {
  S.hitAt = performance.now();
  const hm = $('hitmarker');
  hm.textContent = 'HIT! −' + (5 + Math.floor(Math.random() * 10)) + ' HP';
  if (S.weapon === 2 && S.weapons[2].ammo !== 'LOCKED') {
    const [a, b] = S.weapons[2].ammo.split('/').map(Number);
    if (a > 0) { S.weapons[2].ammo = (a - 1) + '/' + b; document.querySelectorAll('#slots .slot')[2].querySelector('.wammo').textContent = S.weapons[2].ammo; }
  }
}
function toggleCar() {
  if (S.mode === 'drive') {
    S.inCar = false; S.mode = 'onfoot';
    S.player.x = S.car.x + 2.2; S.player.z = S.car.z + 1.5; S.player.ry = S.car.ry;
    setMode('onfoot');
    setMission(7, 'GUDANG SEGARA', 'Bersihkan area gudang: 4 musuh tersisa di Pelabuhan Segara.', 'NEXT: KABUR DARI WPD<br>WPD DISPATCH: 1 unit mengejar —<br>HELI 2 — SPOTLIGHT — PELABUHAN SEGARA');
    setDialogue('WANTO', 'KOMISARIS · WPD', 'WPD datang dari utara. Bersihkan gudang, cepat!', 2);
  } else if (S.mode === 'onfoot') {
    S.inCar = true; S.mode = 'drive';
    S.car.x = S.player.x; S.car.z = S.player.z; S.car.ry = S.player.ry;
    setMode('drive');
    setMission(6, 'BALAPAN SENJA', 'Checkpoint 1 of 4: Kalahkan 3 pembalap di Pantai Kidul.', 'NEXT: GUDANG SEGARA<br>WPD DISPATCH: 2 unit mengejar —<br>HELI 2 — SPOTLIGHT — PANTAI KIDUL');
    setDialogue('BAMBANG', 'MECHANIC · BENGKEL', 'Your Garuda needs new brakes. Come by the bengkel.', 3);
  }
}

// buttons
$('btn-start').addEventListener('click', () => { setMode('drive'); });
$('btn-save').addEventListener('click', () => { try { localStorage.setItem('wilwatikta-save', JSON.stringify({ money: S.money, mission: S.mission })); } catch (e) {} });
$('btn-load').addEventListener('click', () => { try { const s = JSON.parse(localStorage.getItem('wilwatikta-save') || 'null'); if (s) { S.money = s.money; updateHUD(); } } catch (e) {} setMode('drive'); });
$('btn-end').addEventListener('click', () => setMode('title'));
$('btn-close-map').addEventListener('click', () => setMode(S.prevMode === 'map' ? 'drive' : S.prevMode));
$('btn-to-title').addEventListener('click', () => setMode('title'));
$('btn-resume').addEventListener('click', () => setMode(S.prevMode));
$('btn-quit').addEventListener('click', () => setMode('title'));
$('btn-upgrade-done').addEventListener('click', () => setMode(S.prevMode));
document.querySelectorAll('#slots .slot').forEach((el) => el.addEventListener('click', () => setWeapon(+el.dataset.w)));

// ---------------- shot setups (deterministic) ----------------
function setupShot() {
  if (SHOT === 'chase') {
    setMode('drive');
    S.car.x = 0; S.car.z = 2; S.car.ry = Math.PI; S.car.speed = 97; S.inCar = true;
    setMission(6, 'BALAPAN SENJA', 'Checkpoint 1 of 4: Kalahkan 3 pembalap di Pantai Kidul.', 'NEXT: GUDANG SEGARA<br>WPD DISPATCH: 2 unit mengejar —<br>HELI 2 — SPOTLIGHT — PANTAI KIDUL');
    setDialogue('BAMBANG', 'MECHANIC · BENGKEL', 'Your Garuda needs new brakes. Come by the bengkel.', 3);
  } else if (SHOT === 'title') {
    setMode('title');
  } else if (SHOT === 'night') {
    setMode('onfoot');
    S.inCar = false; S.player.x = 0; S.player.z = 2; S.player.ry = Math.PI; S.player.walk = 0.4;
    S.car.x = 0; S.car.z = 6; S.car.ry = Math.PI;
    S.hitAt = performance.now() - 100;
    setMission(7, 'GUDANG SEGARA', 'Bersihkan area gudang: 4 musuh tersisa di Pelabuhan Segara.', 'NEXT: KABUR DARI WPD<br>WPD DISPATCH: 1 unit mengejar —<br>HELI 2 — SPOTLIGHT — PELABUHAN SEGARA');
    setDialogue('WANTO', 'KOMISARIS · WPD', 'WPD datang dari utara. Bersihkan gudang, cepat!', 2);
  } else if (SHOT === 'map') {
    setMode('map');
    S.player.x = 0; S.player.z = 2; S.player.ry = Math.PI;
  } else {
    setMode('title');
  }
  updateHUD();
  drawMinimap();
}

// ---------------- boot ----------------
buildCrew();
buildMap();
setupShot();
drawMinimap();
requestAnimationFrame((now) => { lastT = now; frame(now); });
window.__game = { S, setMode, setWeapon, toggleCar, cityTris, skyTris };
console.log('WILWATIKTA ready', { mode: S.mode, shot: SHOT, cityTris, skyTris });
