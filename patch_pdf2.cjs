const fs = require('fs');
let content = fs.readFileSync('src/services/pdfGenerator.ts', 'utf8');

content = content.replace(/\/\/ Footer/g, 'y = this.appendSupplementaryInfo(doc, receipt, y, margin, pageWidth);\n    // Footer');

fs.writeFileSync('src/services/pdfGenerator.ts', content);
console.log("Done");
