// demonstration of conflicting changes
// run with:
//    >node demo_automerge2.js

var Automerge = require('Automerge');

let doc1 = Automerge.init();
let doc2 = Automerge.init();

doc1 = Automerge.change(doc1, doc => { doc.x = 1});
doc2 = Automerge.change(doc2, doc => { doc.x = 2});

doc1 = Automerge.merge(doc1, doc2);
doc2 = Automerge.merge(doc2, doc1);

//doc1 might be either {x: 1} or {x: 2}, but the choice is random
//doc2 will be the same, whatever is in doc1 (Whatever is chosen as the winner)

console.log(doc1);
console.log(doc2);
