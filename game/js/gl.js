// gl.js — minimal WebGL1 helpers: mat4, shader, mesh builder (fresh composition).
export function mat4Identity() {
  return new Float32Array([1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]);
}
export function mat4Perspective(fovy, aspect, near, far) {
  const f = 1 / Math.tan(fovy / 2), nf = 1 / (near - far);
  const m = new Float32Array(16);
  m[0] = f / aspect; m[5] = f; m[10] = (far + near) * nf; m[11] = -1;
  m[14] = 2 * far * near * nf; return m;
}
export function mat4LookAt(ex, ey, ez, cx, cy, cz, ux, uy, uz) {
  let zx = ex - cx, zy = ey - cy, zz = ez - cz;
  let zl = Math.hypot(zx, zy, zz); zx /= zl; zy /= zl; zz /= zl;
  let xx = uy * zz - uz * zy, xy = uz * zx - ux * zz, xz = ux * zy - uy * zx;
  let xl = Math.hypot(xx, xy, xz); xx /= xl; xy /= xl; xz /= xl;
  const yx = zy * xz - zz * xy, yy = zz * xx - zx * xz, yz = zx * xy - zy * xx;
  const m = new Float32Array(16);
  m[0]=xx; m[1]=yx; m[2]=zx; m[3]=0;
  m[4]=xy; m[5]=yy; m[6]=zy; m[7]=0;
  m[8]=xz; m[9]=yz; m[10]=zz; m[11]=0;
  m[12]=-(xx*ex+xy*ey+xz*ez); m[13]=-(yx*ex+yy*ey+yz*ez); m[14]=-(zx*ex+zy*ey+zz*ez); m[15]=1;
  return m;
}
export function mat4Multiply(a, b) {
  const o = new Float32Array(16);
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) {
    o[c*4+r] = a[r]*b[c*4] + a[4+r]*b[c*4+1] + a[8+r]*b[c*4+2] + a[12+r]*b[c*4+3];
  }
  return o;
}
export function mat4Ortho(l, r, b, t, n, f) {
  const m = new Float32Array(16);
  m[0]=2/(r-l); m[5]=2/(t-b); m[10]=-2/(f-n); m[12]=-(r+l)/(r-l); m[13]=-(t+b)/(t-b); m[14]=-(f+n)/(f-n); m[15]=1;
  return m;
}

export function compileShader(gl, type, src) {
  const s = gl.createShader(type);
  gl.shaderSource(s, src); gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error('shader: ' + gl.getShaderInfoLog(s));
  return s;
}
export function createProgram(gl, vsSrc, fsSrc) {
  const p = gl.createProgram();
  gl.attachShader(p, compileShader(gl, gl.VERTEX_SHADER, vsSrc));
  gl.attachShader(p, compileShader(gl, gl.FRAGMENT_SHADER, fsSrc));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error('link: ' + gl.getProgramInfoLog(p));
  return p;
}

export const VS = `
attribute vec3 aPos; attribute vec3 aNor; attribute vec3 aCol; attribute float aEmi;
uniform mat4 uMVP; uniform mat4 uNor;
varying vec3 vCol; varying vec3 vNor; varying float vEmi; varying float vFog;
uniform vec3 uCam;
void main() {
  vec4 wp = vec4(aPos, 1.0);
  gl_Position = uMVP * wp;
  vCol = aCol; vNor = normalize((uNor * vec4(aNor, 0.0)).xyz); vEmi = aEmi;
  vFog = distance(wp.xyz, uCam);
}`;
export const FS = `
precision mediump float;
varying vec3 vCol; varying vec3 vNor; varying float vEmi; varying float vFog;
uniform vec3 uSun; uniform vec3 uFogCol; uniform float uFogNear; uniform float uFogFar;
void main() {
  float dif = max(dot(normalize(vNor), normalize(uSun)), 0.0);
  vec3 col = vCol * (0.42 + 0.58 * dif) + vCol * vEmi * 0.9;
  float f = clamp((vFog - uFogNear) / (uFogFar - uFogNear), 0.0, 1.0);
  gl_FragColor = vec4(mix(col, uFogCol, f), 1.0);
}`;

// Mesh builder: appends quads (as triangles) with a color + emissive flag.
// Vertices are transformed by an optional euler rotation (rx, ry, rz) about a pivot.
export class Mesh {
  constructor() { this.pos = []; this.nor = []; this.col = []; this.emi = []; }
  _rot(x, y, z, rx, ry, rz, px, py, pz) {
    x -= px; y -= py; z -= pz;
    if (rx) { const c = Math.cos(rx), s = Math.sin(rx); const y2 = y*c - z*s, z2 = y*s + z*c; y = y2; z = z2; }
    if (ry) { const c = Math.cos(ry), s = Math.sin(ry); const x2 = x*c + z*s, z2 = -x*s + z*c; x = x2; z = z2; }
    if (rz) { const c = Math.cos(rz), s = Math.sin(rz); const x2 = x*c - y*s, y2 = x*s + y*c; x = x2; y = y2; }
    return [x + px, y + py, z + pz];
  }
  _tri(a, b, c, n, col, emi) {
    for (const v of [a, b, c]) { this.pos.push(v[0], v[1], v[2]); this.nor.push(n[0], n[1], n[2]); this.col.push(col[0], col[1], col[2]); this.emi.push(emi); }
  }
  quad(p1, p2, p3, p4, n, col, emi, rot) {
    const t = (p) => rot ? this._rot(p[0], p[1], p[2], rot.rx||0, rot.ry||0, rot.rz||0, rot.px||0, rot.py||0, rot.pz||0) : p;
    const a = t(p1), b = t(p2), c = t(p3), d = t(p4);
    this._tri(a, b, c, n, col, emi); this._tri(a, c, d, n, col, emi);
  }
  // Axis-aligned box centered at (x,y,z) with size (sx,sy,sz); optional rotation about its center.
  box(x, y, z, sx, sy, sz, col, emi = 0, rot = null) {
    const hx = sx/2, hy = sy/2, hz = sz/2;
    const r = rot ? { rx: rot.rx||0, ry: rot.ry||0, rz: rot.rz||0, px: x, py: y, pz: z } : null;
    const F = (dx, dy, dz) => [x+dx, y+dy, z+dz];
    // +z front, -z back, +x right, -x left, +y top, -y bottom
    this.quad(F(-hx,hy,hz), F(hx,hy,hz), F(hx,-hy,hz), F(-hx,-hy,hz), [0,0,1], col, emi, r);
    this.quad(F(hx,hy,-hz), F(-hx,hy,-hz), F(-hx,-hy,-hz), F(hx,-hy,-hz), [0,0,-1], col, emi, r);
    this.quad(F(hx,hy,hz), F(hx,hy,-hz), F(hx,-hy,-hz), F(hx,-hy,hz), [1,0,0], col, emi, r);
    this.quad(F(-hx,hy,-hz), F(-hx,hy,hz), F(-hx,-hy,hz), F(-hx,-hy,-hz), [-1,0,0], col, emi, r);
    this.quad(F(-hx,hy,-hz), F(hx,hy,-hz), F(hx,hy,hz), F(-hx,hy,hz), [0,1,0], col, emi, r);
    this.quad(F(-hx,-hy,hz), F(hx,-hy,hz), F(hx,-hy,-hz), F(-hx,-hy,-hz), [0,-1,0], col, emi, r);
  }
  // Triangular prism (wedge): footprint sx × sz, height sy at the back (-z), tapering to a thin
  // edge at the front (+z). Used for the car hood slope and trunk slope.
  wedge(x, y, z, sx, sy, sz, col, emi = 0, rot = null) {
    const hx = sx/2, hz = sz/2;
    const r = rot ? { rx: rot.rx||0, ry: rot.ry||0, rz: rot.rz||0, px: x, py: y, pz: z } : null;
    const F = (dx, dy, dz) => [x+dx, y+dy, z+dz];
    const A = F(-hx,0,-hz), B = F(hx,0,-hz), C = F(hx,0,hz), D = F(-hx,0,hz);
    const E = F(-hx,sy,-hz), G = F(hx,sy,-hz);
    // bottom
    this.quad(D, C, B, A, [0,-1,0], col, emi, r);
    // back (tall face)
    this.quad(A, B, G, E, [0,0,-1], col, emi, r);
    // slope (top): from back-top edge to front-bottom edge
    const n = [0, sz, sy]; const l = Math.hypot(sz, sy); const nn = [0, sz/l, sy/l];
    this.quad(E, G, C, D, nn, col, emi, r);
    // left + right triangles
    const nl = [-1,0,0];
    this._tri(this._r(D, r), this._r(A, r), this._r(E, r), nl, col, emi);
    this._tri(this._r(C, r), this._r(B, r), this._r(G, r), [1,0,0], col, emi);
  }
  _r(p, r) { return r ? this._rot(p[0], p[1], p[2], r.rx||0, r.ry||0, r.rz||0, r.px||0, r.py||0, r.pz||0) : p; }
  // Flat ground quad (single-sided up).
  ground(x, z, w, d, col, emi = 0) {
    this.quad([x-w/2,0,z-d/2], [x+w/2,0,z-d/2], [x+w/2,0,z+d/2], [x-w/2,0,z+d/2], [0,1,0], col, emi);
  }
  // Low-poly sphere (lat/long bands) — used for lamp globes, heli nose, tree canopy blobs.
  sphere(x, y, z, r, col, emi = 0, bands = 6) {
    const pts = [];
    for (let i = 0; i <= bands; i++) {
      const th = Math.PI * i / bands;
      for (let j = 0; j <= bands; j++) {
        const ph = 2 * Math.PI * j / bands;
        pts.push([x + r*Math.sin(th)*Math.cos(ph), y + r*Math.cos(th), z + r*Math.sin(th)*Math.sin(ph)]);
      }
    }
    const idx = (i, j) => i * (bands+1) + j;
    for (let i = 0; i < bands; i++) for (let j = 0; j < bands; j++) {
      const a = pts[idx(i,j)], b = pts[idx(i,j+1)], c = pts[idx(i+1,j+1)], d = pts[idx(i+1,j)];
      const n = [a[0]-x, a[1]-y, a[2]-z]; const l = Math.hypot(n[0], n[1], n[2]) || 1;
      const nn = [n[0]/l, n[1]/l, n[2]/l];
      this._tri(a, b, c, nn, col, emi); this._tri(a, c, d, nn, col, emi);
    }
  }
  // Cylinder along Y (trunk, poles, wheels with axis X via rotation).
  cylinder(x, y, z, r, h, col, emi = 0, seg = 8, axis = 'y') {
    const top = [], bot = [];
    for (let i = 0; i <= seg; i++) {
      const a = 2 * Math.PI * i / seg;
      const cx = Math.cos(a)*r, cz = Math.sin(a)*r;
      if (axis === 'y') { top.push([x+cx, y+h/2, z+cz]); bot.push([x+cx, y-h/2, z+cz]); }
      else { top.push([x+h/2, y+cx, z+cz]); bot.push([x-h/2, y+cx, z+cz]); }
    }
    for (let i = 0; i < seg; i++) {
      const a = top[i], b = top[i+1], c = bot[i+1], d = bot[i];
      const n = axis === 'y' ? [a[0]-x, 0, a[2]-z] : [0, a[1]-y, a[2]-z];
      const l = Math.hypot(n[0], n[1], n[2]) || 1;
      this._tri(a, b, c, [n[0]/l, n[1]/l, n[2]/l], col, emi);
      this._tri(a, c, d, [n[0]/l, n[1]/l, n[2]/l], col, emi);
    }
  }
  count() { return this.pos.length / 3; }
  upload(gl, prog) {
    const mk = (data, loc, size) => {
      const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data), gl.STATIC_DRAW);
      gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 0, 0);
      return b;
    };
    const bufs = [];
    bufs.push(mk(this.pos, gl.getAttribLocation(prog, 'aPos'), 3));
    bufs.push(mk(this.nor, gl.getAttribLocation(prog, 'aNor'), 3));
    bufs.push(mk(this.col, gl.getAttribLocation(prog, 'aCol'), 3));
    bufs.push(mk(this.emi, gl.getAttribLocation(prog, 'aEmi'), 1));
    return bufs;
  }
}
