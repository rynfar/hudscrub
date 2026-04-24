import PDFDocument from 'pdfkit';
import * as fs from 'node:fs';
import * as path from 'node:path';

interface Profile {
  filename: string;
  borrower: string;
  coBorrower?: string;
  address: string;
  ssn: string;
  ssnCo?: string;
  phone: string;
  email: string;
  loanNum: string;
  closingDate: string;
  lineItems: Array<{ desc: string; amount: number }>;
}

const PROFILES: Profile[] = [
  {
    filename: 'hud1_garcia.pdf',
    borrower: 'Maria L. Garcia',
    coBorrower: 'David Garcia',
    address: '1428 Oak Hollow Lane, Sandy, UT 84092',
    ssn: '521-44-9012',
    ssnCo: '522-45-9013',
    phone: '(801) 555-0182',
    email: 'm.garcia@example.com',
    loanNum: 'GAR-2024-77310',
    closingDate: '07/15/2024',
    lineItems: [
      { desc: 'Origination fee', amount: 2400.0 },
      { desc: 'Appraisal', amount: 550.0 },
      { desc: 'Credit report', amount: 35.0 },
      { desc: 'Title insurance', amount: 1820.0 },
      { desc: 'Recording fees', amount: 145.5 },
      { desc: 'Survey', amount: 425.0 },
      { desc: 'Pest inspection', amount: 95.0 },
      { desc: "Homeowner's insurance (1 yr)", amount: 1240.0 },
      { desc: 'Property tax escrow (3 mo)', amount: 1875.0 },
      { desc: 'Loan amount', amount: 320000.0 },
    ],
  },
  {
    filename: 'hud1_johnson.pdf',
    borrower: 'Robert T. Johnson',
    coBorrower: 'Sarah K. Johnson',
    address: '892 Maple Ridge Drive, Austin, TX 78745',
    ssn: '410-22-7788',
    ssnCo: '411-23-7789',
    phone: '512-555-0344',
    email: 'rj.johnson@example.com',
    loanNum: 'JOH-2024-44820',
    closingDate: '08/22/2024',
    lineItems: [
      { desc: 'Origination fee', amount: 3100.0 },
      { desc: 'Appraisal', amount: 600.0 },
      { desc: 'Credit report', amount: 40.0 },
      { desc: 'Title insurance', amount: 2150.0 },
      { desc: 'Recording fees', amount: 178.25 },
      { desc: 'Survey', amount: 475.0 },
      { desc: 'Pest inspection', amount: 110.0 },
      { desc: "Homeowner's insurance (1 yr)", amount: 1480.0 },
      { desc: 'Property tax escrow (3 mo)', amount: 2200.0 },
      { desc: 'Loan amount', amount: 415000.0 },
    ],
  },
  {
    filename: 'hud1_smith.pdf',
    borrower: 'John Q. Smith',
    address: '3344 Cedar Park Blvd, Boulder, CO 80303',
    ssn: '603-77-1144',
    phone: '720.555.0211',
    email: 'jq.smith@example.com',
    loanNum: 'SMH-2024-88421',
    closingDate: '09/03/2024',
    lineItems: [
      { desc: 'Origination fee', amount: 1850.0 },
      { desc: 'Appraisal', amount: 525.0 },
      { desc: 'Credit report', amount: 35.0 },
      { desc: 'Title insurance', amount: 1640.0 },
      { desc: 'Recording fees', amount: 132.0 },
      { desc: 'Survey', amount: 400.0 },
      { desc: 'Pest inspection', amount: 90.0 },
      { desc: "Homeowner's insurance (1 yr)", amount: 1100.0 },
      { desc: 'Property tax escrow (3 mo)', amount: 1450.0 },
      { desc: 'Loan amount', amount: 245000.0 },
    ],
  },
];

function fmt(n: number): string {
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function generate(profile: Profile, outDir: string): Promise<string> {
  const filePath = path.join(outDir, profile.filename);
  const doc = new PDFDocument({ margin: 50 });
  const stream = fs.createWriteStream(filePath);
  doc.pipe(stream);

  doc.fontSize(16).text('HUD-1 Settlement Statement', { align: 'center' });
  doc.moveDown();
  doc.fontSize(10);
  doc.text(`Loan No. ${profile.loanNum}`);
  doc.text(`Closing Date: ${profile.closingDate}`);
  doc.moveDown();

  doc.fontSize(11).text('Borrower:', { underline: true });
  doc.fontSize(10).text(`Name: ${profile.borrower}`);
  if (profile.coBorrower) doc.text(`Co-Borrower: ${profile.coBorrower}`);
  doc.text(`Address: ${profile.address}`);
  doc.text(`SSN: ${profile.ssn}`);
  if (profile.ssnCo) doc.text(`Co-Borrower SSN: ${profile.ssnCo}`);
  doc.text(`Phone: ${profile.phone}`);
  doc.text(`Email: ${profile.email}`);
  doc.moveDown();

  doc.fontSize(11).text('Settlement Charges:', { underline: true });
  doc.fontSize(10);

  let total = 0;
  for (const item of profile.lineItems) {
    const line = `  ${item.desc.padEnd(35, '.')} ${fmt(item.amount)}`;
    doc.text(line);
    total += item.amount;
  }
  doc.moveDown();
  doc.fontSize(11).text(`Gross Amount Due from Borrower: ${fmt(total)}`);
  doc.moveDown();
  doc.fontSize(8).text(`Borrower Loan No. ${profile.loanNum} appears again here for reference.`);

  doc.end();

  return new Promise<string>((resolve, reject) => {
    stream.on('finish', () => resolve(filePath));
    stream.on('error', reject);
  });
}

async function main() {
  const outDir = path.resolve('tests/fixtures');
  fs.mkdirSync(outDir, { recursive: true });
  for (const p of PROFILES) {
    const written = await generate(p, outDir);
    console.log(`Generated: ${written}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
