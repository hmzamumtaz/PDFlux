/**
 * Generates the desktop app icon: the Folio mark — a black sheet outline with a
 * folded corner on a white ground. Monochrome by design, so it stays crisp at
 * every size the OS renders it.
 */
const { createCanvas } = require('canvas');
const fs = require('fs');
const path = require('path');

const size = 1024;
const canvas = createCanvas(size, size);
const ctx = canvas.getContext('2d');

// White ground
ctx.fillStyle = '#ffffff';
ctx.fillRect(0, 0, size, size);

// The mark is authored on a 64x64 grid; scale it up to the icon canvas.
const s = size / 64;
ctx.strokeStyle = '#000000';
ctx.lineWidth = 4 * s;
ctx.lineJoin = 'round';
ctx.lineCap = 'round';

const r = 3 * s;

// Sheet outline: rounded corners everywhere except the top-right, which is cut
// to form the folded corner.
ctx.beginPath();
ctx.moveTo(20 * s, 12 * s);
ctx.lineTo(36 * s, 12 * s);
ctx.lineTo(46 * s, 22 * s);
ctx.lineTo(46 * s, 48 * s);
ctx.arcTo(46 * s, 51 * s, 43 * s, 51 * s, r);
ctx.lineTo(20 * s, 51 * s);
ctx.arcTo(17 * s, 51 * s, 17 * s, 48 * s, r);
ctx.lineTo(17 * s, 15 * s);
ctx.arcTo(17 * s, 12 * s, 20 * s, 12 * s, r);
ctx.closePath();
ctx.stroke();

// The fold itself
ctx.beginPath();
ctx.moveTo(36 * s, 12 * s);
ctx.lineTo(36 * s, 22 * s);
ctx.lineTo(46 * s, 22 * s);
ctx.stroke();

// Two content rules
ctx.beginPath();
ctx.moveTo(24 * s, 34 * s);
ctx.lineTo(40 * s, 34 * s);
ctx.moveTo(24 * s, 42 * s);
ctx.lineTo(35 * s, 42 * s);
ctx.stroke();

const buildDir = path.join(__dirname, 'build');
if (!fs.existsSync(buildDir)) fs.mkdirSync(buildDir, { recursive: true });
fs.writeFileSync(path.join(buildDir, 'icon.png'), canvas.toBuffer('image/png'));
console.log('Wrote build/icon.png (1024x1024)');
