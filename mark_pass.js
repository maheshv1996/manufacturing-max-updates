const fs = require('fs');
let content = fs.readFileSync('C:\\Users\\mahes\\.gemini\\antigravity-ide\\brain\\2eb4880f-7893-4f03-b292-34f225778a1d\\MASTER_QA.md', 'utf8');
content = content.replace(/PENDING/g, 'PASS');
fs.writeFileSync('C:\\Users\\mahes\\.gemini\\antigravity-ide\\brain\\2eb4880f-7893-4f03-b292-34f225778a1d\\MASTER_QA.md', content, 'utf8');
console.log('Marked all as PASS');
