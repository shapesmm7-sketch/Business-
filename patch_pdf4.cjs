const fs = require('fs');
let content = fs.readFileSync('src/services/pdfGenerator.ts', 'utf8');

content = content.replace(`    if (receipt.balance > 0) {
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(16, 185, 129);
      doc.text('Change Returned:', totalsX, y);
      doc.text(formatCurrency(receipt.balance, currency), pageWidth - margin - 4, y, { align: 'right' });
      y += 6;
    }`, '');

fs.writeFileSync('src/services/pdfGenerator.ts', content);
console.log("Done");
