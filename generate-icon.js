const { createCanvas } = require('canvas');
const fs = require('fs');
const path = require('path');

const size = 1024;
const canvas = createCanvas(size, size);
const ctx = canvas.getContext('2d');

// White background
ctx.fillStyle = '#ffffff';
ctx.fillRect(0, 0, size, size);

// Rounded rect background
const radius = size * 0.18;
const x = size * 0.15;
const y = size * 0.15;
const w = size * 0.7;
const h = size * 0.7;

ctx.beginPath();
ctx.moveTo(x + radius, y);
ctx.lineTo(x + w - radius, y);
ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
ctx.lineTo(x + w, y + h - radius);
ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
ctx.lineTo(x + radius, y + h);
ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
ctx.lineTo(x, y + radius);
ctx.quadraticCurveTo(x, y, x + radius, y);
ctx.closePath();
ctx.fillStyle = '#111111';
ctx.fill();

// PDF icon - document shape
const docX = size * 0.32;
const docY = size * 0.22;
const docW = size * 0.36;
const docH = size * 0.44;
const docR = size * 0.03;

ctx.beginPath();
ctx.moveTo(docX + docR, docY);
ctx.lineTo(docX + docW - docR - size * 0.06, docY);
ctx.lineTo(docX + docW, docY + size * 0.06);
ctx.lineTo(docX + docW, docY + docH - docR);
ctx.quadraticCurveTo(docX + docW, docY + docH, docX + docW - docR, docY + docH);
ctx.lineTo(docX + docR, docY + docH);
ctx.quadraticCurveTo(docX, docY + docH, docX, docY + docH - docR);
ctx.lineTo(docX, docY + docR);
ctx.quadraticCurveTo(docX, docY, docX + docR, docY);
ctx.closePath();
ctx.fillStyle = '#ffffff';
ctx.fill();

// Folded corner
const foldSize = size * 0.06;
ctx.beginPath();
ctx.moveTo(docX + docW - foldSize - size * 0.06, docY);
ctx.lineTo(docX + docW - foldSize - size * 0.06, docY + foldSize);
ctx.lineTo(docX + docW - size * 0.06, docY + foldSize);
ctx.lineTo(docX + docW - size * 0.06, docY + size * 0.06);
ctx.lineTo(docX + docW, docY + size * 0.06);
ctx.lineTo(docX + docW - foldSize - size * 0.06, docY);
ctx.closePath();
ctx.fillStyle = '#e4e4e7';
ctx.fill();

// "P" letter
ctx.fillStyle = '#6366f1';
ctx.font = `bold ${size * 0.22}px sans-serif`;
ctx.textAlign = 'center';
ctx.textBaseline = 'middle';
ctx.fillText('P', size * 0.42, size * 0.48);

// Lines
ctx.fillStyle = '#a1a1aa';
const lineY1 = size * 0.58;
const lineY2 = size * 0.63;
const lineY3 = size * 0.68;
const lineX = size * 0.28;
const lineW = size * 0.44;
const lineH = size * 0.018;

ctx.beginPath();
ctx.roundRect(lineX, lineY1, lineW * 0.8, lineH, lineH / 2);
ctx.fill();
ctx.beginPath();
ctx.roundRect(lineX, lineY2, lineW, lineH, lineH / 2);
ctx.fill();
ctx.beginPath();
ctx.roundRect(lineX, lineY3, lineW * 0.6, lineH, lineH / 2);
ctx.fill();

// Save
const buffer = canvas.toBuffer('image/png');
fs.writeFileSync(path.join(__dirname, 'build', 'icon.png'), buffer);
console.log('Icon created: build/icon.png');
