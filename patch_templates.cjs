const fs = require('fs');
let content = fs.readFileSync('src/components/ReceiptLayoutRenderer.tsx', 'utf8');

const helperFn = `
const renderSupplementaryInfo = (amountInWords?: string, notes?: string, balance: number = 0, currency: string = 'UGX') => {
  const isOwed = balance < 0;
  const hasChange = balance > 0;
  
  if (!amountInWords && !notes && !isOwed && !hasChange) return null;

  return (
    <div className="mt-4 pt-3 border-t border-dashed border-slate-200 dark:border-slate-700 text-left space-y-1.5 font-sans">
      {(isOwed || hasChange) && (
        <div className="flex justify-between py-0.5 font-bold text-xs">
          <span className={isOwed ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}>
            {isOwed ? 'Balance Due:' : 'Change:'}
          </span>
          <span className={isOwed ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}>
            {formatCurrency(Math.abs(balance), currency)}
          </span>
        </div>
      )}
      {amountInWords && (
        <div className="text-[11px] text-slate-600 dark:text-slate-400 pt-1">
          <span className="font-semibold text-slate-900 dark:text-slate-200">Amount in Words: </span>
          <span className="italic uppercase">{amountInWords}</span>
        </div>
      )}
      {notes && (
        <div className="text-[11px] text-slate-600 dark:text-slate-400">
          <span className="font-semibold text-slate-900 dark:text-slate-200">Notes: </span>
          <span>{notes}</span>
        </div>
      )}
    </div>
  );
};
`;

content = content.replace("export interface ReceiptRenderData", helperFn + "\nexport interface ReceiptRenderData");

// Now we want to insert `{renderSupplementaryInfo(amountInWords, notes, balance, currency)}` right before the footer block.
// A simpler way is to just replace the last `</div>\n    );` of each block.
// But some templates have `</div>` nested. We can match `      </div>\n    );\n  }` or similar.
// Let's just find the customFooter lines and manually prepend it to the footer div using string matching.

const footers = [
  `<div className="mt-4 pt-3 font-sans flex justify-between items-end text-[10px] text-slate-500 border-t border-slate-200 dark:border-slate-800">
          <span>{customFooter || 'Thank you for your patronage.'}</span>`,

  `<div className="text-center text-xs text-slate-400 mt-4 pt-3 border-t border-slate-100 dark:border-slate-800">
          {customFooter || 'Thank you.'}`,
          
  `<div className="mt-3 text-center text-[10px] text-slate-400 pt-2 border-t border-slate-100 dark:border-slate-800">
          {customFooter || 'Thank you for your business. Valid tax invoice.'}`,
          
  `<div className="text-center pt-2 text-[10px] text-slate-500 space-y-0.5 border-t border-dashed border-slate-300 dark:border-slate-700">
          <p className="font-bold">*** THANK YOU FOR VISITING ***</p>
          <p>{customFooter || 'PLEASE KEEP THIS SLIP'}</p>`,
          
  `<div className="text-center text-[10px] font-bold text-slate-400 uppercase pt-2">
            {customFooter || 'ORIGINAL CUSTOMER TAX RECEIPT • RETAIN FOR WARRANTY'}`,
            
  `<div className="text-center text-[10px] text-slate-400 pt-1">
            {customFooter || 'Smooth sailing & thank you for your patronage!'}`,
            
  `<div className="mt-4 pt-3 border-t border-[#8c6d58] flex justify-between items-end text-[10px] font-mono text-[#5d4037] dark:text-[#d7ccc8]">
          <span>{customFooter || 'Goods once sold are gratefully acknowledged.'}</span>`,
          
  `<div className="text-center text-[10px] text-slate-400 pt-2 border-t border-slate-100 dark:border-slate-800">
          {customFooter || 'Thank you for your business! Please come again.'}`
];

footers.forEach(f => {
  content = content.replace(f, `{renderSupplementaryInfo(amountInWords, notes, balance, currency)}\n        ` + f);
});

fs.writeFileSync('src/components/ReceiptLayoutRenderer.tsx', content);
console.log("Done patching!");
