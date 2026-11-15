// Inlines base.css, common.js and engine.js into template.html to produce index.html.
// Usage: node build.js   (run inside a project folder)
const fs = require('fs');
const cfg = JSON.parse(fs.readFileSync('accent.json', 'utf8'));
let css = fs.readFileSync('base.css', 'utf8');
for (const k of Object.keys(cfg)) css = css.split('@' + k + '@').join(cfg[k]);
let t = fs.readFileSync('template.html', 'utf8');
t = t.replace('/*BASE*/', () => css)
     .replace('/*COMMON*/', () => fs.readFileSync('common.js', 'utf8'))
     .replace('/*ENGINE*/', () => fs.readFileSync('engine.js', 'utf8'));
fs.writeFileSync('index.html', t);
for (const m of t.matchAll(/<script>([\s\S]*?)<\/script>/g)) new Function(m[1]);
console.log('index.html written, ' + t.length + ' bytes');
