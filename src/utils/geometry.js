// src/utils/geometry.js

// --- CONSTANTS ---
export const PI = Math.PI;
export const TWO_PI = Math.PI * 2;

// --- POLAR/CARTESIAN HELPERS ---
export const polarToCartesian = (cx, cy, r, theta) => {
  return {
    x: cx + r * Math.cos(theta),
    y: cy + r * Math.sin(theta),
  };
};

export const cartesianToPolar = (cx, cy, x, y) => {
  const dx = x - cx;
  const dy = y - cy;
  return {
    r: Math.sqrt(dx * dx + dy * dy),
    theta: Math.atan2(dy, dx),
  };
};

export const normalizeAngle = (angle) => {
  let a = angle % TWO_PI;
  if (a < 0) a += TWO_PI;
  return a;
};

export const dist = (p1, p2) => {
  return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
};

// --- COLOR HELPERS ---
export const hslaToString = (c) => {
  return `hsla(${c.h.toFixed(1)}, ${c.s.toFixed(1)}%, ${c.l.toFixed(1)}%, ${c.a.toFixed(2)})`;
};

// --- MATH UTILS ---
export const mapRange = (value, inMin, inMax, outMin, outMax) => {
  return ((value - inMin) * (outMax - outMin)) / (inMax - inMin) + outMin;
};

export const clamp = (val, min, max) => Math.min(Math.max(val, min), max);

export const noise = (angle, time, frequency = 1) => {
  const t = time * 0.5;
  return (
    Math.sin(angle * frequency + t) * 0.5 +
    Math.sin(angle * frequency * 2 + t * 1.5) * 0.25 +
    Math.sin(angle * frequency * 3 - t * 0.8) * 0.125
  );
};

// --- SYMMETRY REFLECTION (The new logic) ---
export const reflectPoint = (p, line) => {
  if (!line) return p;
  
  // Translate to origin
  const dx = p.x - line.x;
  const dy = p.y - line.y;
  
  // Rotate to horizontal
  const rad = (line.angle * Math.PI) / 180;
  const cos = Math.cos(-rad);
  const sin = Math.sin(-rad);
  const rx = dx * cos - dy * sin;
  const ry = dx * sin + dy * cos;
  
  // Reflect across X (flip Y)
  const ry_ref = -ry;
  
  // Rotate back
  const cos_b = Math.cos(rad);
  const sin_b = Math.sin(rad);
  const finalX = rx * cos_b - ry_ref * sin_b + line.x;
  const finalY = rx * sin_b + ry_ref * cos_b + line.y;
  
  return { x: finalX, y: finalY };
};