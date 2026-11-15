const G = require('./engine.js');
console.log(G.scenarios.length + ' situations');
for (const q of ['committed on the wrong branch', 'undo last commit', 'lost stash', 'force push', 'typo in message']) {
  console.log(q, '=>', G.search(q).slice(0, 3).map(i => G.scenarios[i].t));
}
console.log(G.resolve(G.scenarios[2], { n: '3' }, true));
