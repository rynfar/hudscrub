import PDFDocument from 'pdfkit';
import * as fs from 'node:fs';
import * as path from 'node:path';

interface Party {
  name: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  ssn?: string;
  phone?: string;
  email?: string;
}

interface Profile {
  filename: string;
  // Section A
  loanNum: string;
  fhaCase: string;
  settlementDate: string;
  disbursementDate: string;
  // Section C – Borrower
  borrower: Party;
  coBorrower?: Party;
  // Section D – Seller
  seller: Party;
  coSeller?: Party;
  // Section E – Lender
  lender: Party;
  // Section F – Property
  propertyAddress: string;
  propertyCity: string;
  propertyState: string;
  propertyZip: string;
  // Section G – Settlement Agent
  settlementAgent: string;
  settlementOffice: string;
  settlementCity: string;
  settlementState: string;
  settlementZip: string;
  settlementPhone: string;
  settlementEmail: string;
  // Section J – Borrower's transaction
  contractSalesPrice: number;
  settlementCharges: number;
  cityTaxes: number;
  countyTaxes: number;
  assessments: number;
  // Section K – Seller's transaction (same contractSalesPrice)
  // Section 200 – Amounts paid by/for borrower
  earnestMoney: number;
  loanAmount: number;
  sellerCredit: number;
  // Section L – Settlement charges to borrower (line items)
  originationFee: number;
  appraisalFee: number;
  creditReportFee: number;
  titleInsurance: number;
  recordingFees: number;
  surveyFee: number;
  pestInspection: number;
  homeownersInsurance: number;
  propertyTaxEscrow: number;
}

const PROFILES: Profile[] = [
  {
    filename: 'hud1_garcia.pdf',
    loanNum: 'GAR-2024-77310',
    fhaCase: '321-7741092-703',
    settlementDate: '07/15/2024',
    disbursementDate: '07/18/2024',
    borrower: {
      name: 'Maria L. Garcia',
      address: '1428 Oak Hollow Lane',
      city: 'Sandy',
      state: 'UT',
      zip: '84092',
      ssn: '521-44-9012',
      phone: '(801) 555-0182',
      email: 'm.garcia@example.com',
    },
    coBorrower: {
      name: 'David Garcia',
      address: '1428 Oak Hollow Lane',
      city: 'Sandy',
      state: 'UT',
      zip: '84092',
      ssn: '522-45-9013',
      phone: '(801) 555-0183',
      email: 'd.garcia@example.com',
    },
    seller: {
      name: 'Patricia A. Henderson',
      address: '8821 Willow Creek Rd',
      city: 'Park City',
      state: 'UT',
      zip: '84060',
      ssn: '601-22-4488',
      phone: '(435) 555-0244',
      email: 'p.henderson@example.com',
    },
    lender: {
      name: 'Cascade Federal Credit Union',
      address: '2200 South State Street, Suite 400',
      city: 'Salt Lake City',
      state: 'UT',
      zip: '84115',
      phone: '(801) 555-0900',
    },
    propertyAddress: '1428 Oak Hollow Lane',
    propertyCity: 'Sandy',
    propertyState: 'UT',
    propertyZip: '84092',
    settlementAgent: 'Wasatch Title & Escrow LLC',
    settlementOffice: '405 East Vine Street',
    settlementCity: 'Murray',
    settlementState: 'UT',
    settlementZip: '84107',
    settlementPhone: '(801) 555-0455',
    settlementEmail: 'closings@wasatchtitle.example.com',
    contractSalesPrice: 425000,
    settlementCharges: 8240.5,
    cityTaxes: 412.5,
    countyTaxes: 1180.0,
    assessments: 0,
    earnestMoney: 8500,
    loanAmount: 340000,
    sellerCredit: 4200,
    originationFee: 2400,
    appraisalFee: 575,
    creditReportFee: 35,
    titleInsurance: 1820,
    recordingFees: 145.5,
    surveyFee: 425,
    pestInspection: 95,
    homeownersInsurance: 1240,
    propertyTaxEscrow: 1875,
  },
  {
    filename: 'hud1_johnson.pdf',
    loanNum: 'JOH-2024-44820',
    fhaCase: '481-2299847-703',
    settlementDate: '08/22/2024',
    disbursementDate: '08/26/2024',
    borrower: {
      name: 'Robert T. Johnson',
      address: '892 Maple Ridge Drive',
      city: 'Austin',
      state: 'TX',
      zip: '78745',
      ssn: '410-22-7788',
      phone: '512-555-0344',
      email: 'rj.johnson@example.com',
    },
    coBorrower: {
      name: 'Sarah K. Johnson',
      address: '892 Maple Ridge Drive',
      city: 'Austin',
      state: 'TX',
      zip: '78745',
      ssn: '411-23-7789',
      phone: '512-555-0345',
      email: 'sk.johnson@example.com',
    },
    seller: {
      name: 'Michael B. Reyes',
      address: '4410 Bluebonnet Ln',
      city: 'Round Rock',
      state: 'TX',
      zip: '78664',
      ssn: '433-19-2266',
      phone: '512-555-0712',
      email: 'm.reyes@example.com',
    },
    coSeller: {
      name: 'Linda Reyes',
      address: '4410 Bluebonnet Ln',
      city: 'Round Rock',
      state: 'TX',
      zip: '78664',
      ssn: '434-20-2267',
      phone: '512-555-0713',
      email: 'l.reyes@example.com',
    },
    lender: {
      name: 'Lone Star Mortgage Bankers, Inc.',
      address: '3900 N IH-35, Building C',
      city: 'Austin',
      state: 'TX',
      zip: '78751',
      phone: '512-555-0980',
    },
    propertyAddress: '892 Maple Ridge Drive',
    propertyCity: 'Austin',
    propertyState: 'TX',
    propertyZip: '78745',
    settlementAgent: 'Texas Premier Title Company',
    settlementOffice: '1100 South Lamar Blvd, Suite 250',
    settlementCity: 'Austin',
    settlementState: 'TX',
    settlementZip: '78704',
    settlementPhone: '512-555-0660',
    settlementEmail: 'escrow@texaspremiertitle.example.com',
    contractSalesPrice: 568000,
    settlementCharges: 11248.75,
    cityTaxes: 945.0,
    countyTaxes: 2210.0,
    assessments: 380,
    earnestMoney: 11000,
    loanAmount: 454400,
    sellerCredit: 5500,
    originationFee: 3100,
    appraisalFee: 600,
    creditReportFee: 40,
    titleInsurance: 2150,
    recordingFees: 178.25,
    surveyFee: 475,
    pestInspection: 110,
    homeownersInsurance: 1480,
    propertyTaxEscrow: 2200,
  },
  {
    filename: 'hud1_smith.pdf',
    loanNum: 'SMH-2024-88421',
    fhaCase: '522-9988776',
    settlementDate: '09/03/2024',
    disbursementDate: '09/06/2024',
    borrower: {
      name: 'John Q. Smith',
      address: '3344 Cedar Park Blvd',
      city: 'Boulder',
      state: 'CO',
      zip: '80303',
      ssn: '603-77-1144',
      phone: '720.555.0211',
      email: 'jq.smith@example.com',
    },
    seller: {
      name: 'Eleanor M. Whitfield',
      address: '7762 Pine Cliff Way',
      city: 'Lyons',
      state: 'CO',
      zip: '80540',
      ssn: '589-31-6710',
      phone: '303.555.0177',
      email: 'e.whitfield@example.com',
    },
    lender: {
      name: 'Rocky Mountain Home Lending, LLC',
      address: '1850 Folsom Street, Suite 300',
      city: 'Boulder',
      state: 'CO',
      zip: '80302',
      phone: '303.555.0822',
    },
    propertyAddress: '3344 Cedar Park Blvd',
    propertyCity: 'Boulder',
    propertyState: 'CO',
    propertyZip: '80303',
    settlementAgent: 'Front Range Settlement Services',
    settlementOffice: '950 17th Street, Suite 1100',
    settlementCity: 'Denver',
    settlementState: 'CO',
    settlementZip: '80202',
    settlementPhone: '303.555.0344',
    settlementEmail: 'closings@frontrangesettlement.example.com',
    contractSalesPrice: 312500,
    settlementCharges: 6892.0,
    cityTaxes: 308.5,
    countyTaxes: 875.0,
    assessments: 0,
    earnestMoney: 6000,
    loanAmount: 250000,
    sellerCredit: 3000,
    originationFee: 1850,
    appraisalFee: 525,
    creditReportFee: 35,
    titleInsurance: 1640,
    recordingFees: 132,
    surveyFee: 400,
    pestInspection: 90,
    homeownersInsurance: 1100,
    propertyTaxEscrow: 1450,
  },
];

const fmt$ = (n: number): string =>
  `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const COL_LEFT = 50;
const COL_RIGHT = 320;
const COL_WIDTH = 260;

function partyBlock(doc: PDFKit.PDFDocument, x: number, y: number, p: Party): number {
  doc.fontSize(9).font('Helvetica').text(p.name, x, y, { width: COL_WIDTH });
  doc.text(p.address, x, doc.y, { width: COL_WIDTH });
  doc.text(`${p.city}, ${p.state} ${p.zip}`, x, doc.y, { width: COL_WIDTH });
  if (p.ssn) doc.text(`SSN: ${p.ssn}`, x, doc.y, { width: COL_WIDTH });
  if (p.phone) doc.text(`Phone: ${p.phone}`, x, doc.y, { width: COL_WIDTH });
  if (p.email) doc.text(`Email: ${p.email}`, x, doc.y, { width: COL_WIDTH });
  return doc.y;
}

function sectionHeader(doc: PDFKit.PDFDocument, x: number, y: number, label: string) {
  doc.fontSize(10).font('Helvetica-Bold').text(label, x, y, { width: COL_WIDTH });
}

function chargeLine(
  doc: PDFKit.PDFDocument,
  num: string,
  desc: string,
  amount: number,
  amountCol = 540,
) {
  const startY = doc.y;
  doc.fontSize(9).font('Helvetica').text(num, COL_LEFT, startY, { width: 40 });
  doc.text(desc, COL_LEFT + 45, startY, { width: 380 });
  doc.text(fmt$(amount), 0, startY, { width: amountCol, align: 'right' });
}

function totalLine(doc: PDFKit.PDFDocument, label: string, total: number) {
  const y = doc.y + 4;
  doc.moveTo(COL_LEFT, y).lineTo(560, y).strokeColor('#000').stroke();
  doc.moveDown(0.3);
  doc.fontSize(10).font('Helvetica-Bold').text(label, COL_LEFT, doc.y, { width: 380 });
  doc.text(fmt$(total), 0, doc.y - 12, { width: 540, align: 'right' });
  doc.moveDown(0.5);
}

function generate(profile: Profile, outDir: string): Promise<string> {
  const filePath = path.join(outDir, profile.filename);
  const doc = new PDFDocument({ size: 'LETTER', margin: 40 });
  const stream = fs.createWriteStream(filePath);
  doc.pipe(stream);

  // Title
  doc.fontSize(14).font('Helvetica-Bold').text('A. Settlement Statement (HUD-1)', { align: 'center' });
  doc.fontSize(8).font('Helvetica').text(
    'U.S. Department of Housing and Urban Development (fake form — for testing only)',
    { align: 'center' },
  );
  doc.moveDown(1);

  // Section B + FHA case (two columns)
  let y = doc.y;
  doc.fontSize(10).font('Helvetica-Bold').text(`B. Loan No. ${profile.loanNum}`, COL_LEFT, y, { width: COL_WIDTH });
  doc.text(`FHA Case No. ${profile.fhaCase}`, COL_RIGHT, y, { width: COL_WIDTH });
  doc.moveDown(0.5);

  y = doc.y;
  doc.fontSize(9).font('Helvetica').text(`Settlement Date: ${profile.settlementDate}`, COL_LEFT, y, { width: COL_WIDTH });
  doc.text(`Disbursement Date: ${profile.disbursementDate}`, COL_RIGHT, y, { width: COL_WIDTH });
  doc.moveDown(1);

  // Sections C and D side-by-side (Borrower / Seller)
  y = doc.y;
  sectionHeader(doc, COL_LEFT, y, 'C. Name & Address of Borrower:');
  sectionHeader(doc, COL_RIGHT, y, 'D. Name & Address of Seller:');
  doc.moveDown(0.4);
  const yAfterCD = doc.y;

  // Left column: borrower + co-borrower
  doc.y = yAfterCD;
  let leftY = partyBlock(doc, COL_LEFT, yAfterCD, profile.borrower);
  if (profile.coBorrower) {
    doc.moveDown(0.5);
    leftY = partyBlock(doc, COL_LEFT, doc.y, profile.coBorrower);
  }

  // Right column: seller + co-seller
  doc.y = yAfterCD;
  let rightY = partyBlock(doc, COL_RIGHT, yAfterCD, profile.seller);
  if (profile.coSeller) {
    doc.moveDown(0.5);
    rightY = partyBlock(doc, COL_RIGHT, doc.y, profile.coSeller);
  }
  doc.y = Math.max(leftY, rightY);
  doc.moveDown(1);

  // Sections E and F side-by-side (Lender / Property)
  y = doc.y;
  sectionHeader(doc, COL_LEFT, y, 'E. Name & Address of Lender:');
  sectionHeader(doc, COL_RIGHT, y, 'F. Property Location:');
  doc.moveDown(0.4);
  const yAfterEF = doc.y;

  doc.y = yAfterEF;
  doc.fontSize(9).font('Helvetica').text(profile.lender.name, COL_LEFT, yAfterEF, { width: COL_WIDTH });
  doc.text(profile.lender.address, COL_LEFT, doc.y, { width: COL_WIDTH });
  doc.text(
    `${profile.lender.city}, ${profile.lender.state} ${profile.lender.zip}`,
    COL_LEFT,
    doc.y,
    { width: COL_WIDTH },
  );
  if (profile.lender.phone) doc.text(`Phone: ${profile.lender.phone}`, COL_LEFT, doc.y, { width: COL_WIDTH });
  leftY = doc.y;

  doc.y = yAfterEF;
  doc.text(profile.propertyAddress, COL_RIGHT, yAfterEF, { width: COL_WIDTH });
  doc.text(
    `${profile.propertyCity}, ${profile.propertyState} ${profile.propertyZip}`,
    COL_RIGHT,
    doc.y,
    { width: COL_WIDTH },
  );
  rightY = doc.y;

  doc.y = Math.max(leftY, rightY);
  doc.moveDown(1);

  // Section G – Settlement Agent (full width)
  sectionHeader(doc, COL_LEFT, doc.y, 'G. Settlement Agent:');
  doc.moveDown(0.4);
  doc.fontSize(9).font('Helvetica').text(profile.settlementAgent, COL_LEFT, doc.y, { width: 480 });
  doc.text(
    `${profile.settlementOffice}, ${profile.settlementCity}, ${profile.settlementState} ${profile.settlementZip}`,
    COL_LEFT,
    doc.y,
    { width: 480 },
  );
  doc.text(`Phone: ${profile.settlementPhone}    Email: ${profile.settlementEmail}`, COL_LEFT, doc.y, { width: 480 });
  doc.moveDown(1);

  // Section J – Summary of Borrower's Transaction
  sectionHeader(doc, COL_LEFT, doc.y, "J. Summary of Borrower's Transaction — Gross Amount Due");
  doc.moveDown(0.3);
  chargeLine(doc, '101.', 'Contract sales price', profile.contractSalesPrice);
  doc.moveDown(0.2);
  chargeLine(doc, '103.', 'Settlement charges to borrower (Line 1400)', profile.settlementCharges);
  doc.moveDown(0.2);
  chargeLine(doc, '106.', `City/town taxes ${profile.settlementDate.slice(0, 5)}/24 to 12/31/24`, profile.cityTaxes);
  doc.moveDown(0.2);
  chargeLine(doc, '107.', `County taxes ${profile.settlementDate.slice(0, 5)}/24 to 12/31/24`, profile.countyTaxes);
  doc.moveDown(0.2);
  chargeLine(doc, '108.', 'Assessments', profile.assessments);
  doc.moveDown(0.2);
  const grossDue =
    profile.contractSalesPrice +
    profile.settlementCharges +
    profile.cityTaxes +
    profile.countyTaxes +
    profile.assessments;
  totalLine(doc, '120. Gross Amount Due From Borrower', grossDue);

  // Section 200 – Amounts paid by/for borrower
  sectionHeader(doc, COL_LEFT, doc.y, '200. Amounts Paid By or In Behalf of Borrower');
  doc.moveDown(0.3);
  chargeLine(doc, '201.', 'Deposit or earnest money', profile.earnestMoney);
  doc.moveDown(0.2);
  chargeLine(doc, '202.', 'Principal amount of new loan', profile.loanAmount);
  doc.moveDown(0.2);
  chargeLine(doc, '204.', 'Seller credit', profile.sellerCredit);
  doc.moveDown(0.2);
  const totalPaid = profile.earnestMoney + profile.loanAmount + profile.sellerCredit;
  totalLine(doc, '220. Total Paid By/For Borrower', totalPaid);

  doc.moveDown(0.3);
  doc.fontSize(10).font('Helvetica-Bold');
  const cashFromBorrower = grossDue - totalPaid;
  doc.text('303. Cash ☐ From  ☒ To  Borrower', COL_LEFT, doc.y, { width: 380 });
  doc.text(fmt$(cashFromBorrower), 0, doc.y - 12, { width: 540, align: 'right' });
  doc.moveDown(1.5);

  // ---- Page 2: Section L Settlement Charges ----
  doc.addPage();
  doc.fontSize(14).font('Helvetica-Bold').text('L. Settlement Charges', { align: 'center' });
  doc.fontSize(8).font('Helvetica').text(
    `Loan No. ${profile.loanNum}    Borrower: ${profile.borrower.name}`,
    { align: 'center' },
  );
  doc.moveDown(1);

  // 700 – Real Estate Broker Fees (placeholder)
  sectionHeader(doc, COL_LEFT, doc.y, '700. Total Real Estate Broker Fees');
  doc.moveDown(0.3);
  chargeLine(doc, '701.', `Listing agent commission (3% of ${fmt$(profile.contractSalesPrice)})`, profile.contractSalesPrice * 0.03);
  doc.moveDown(0.2);
  chargeLine(doc, '702.', `Buyer's agent commission (3% of ${fmt$(profile.contractSalesPrice)})`, profile.contractSalesPrice * 0.03);
  doc.moveDown(0.5);

  // 800 – Items Payable in Connection with Loan
  sectionHeader(doc, COL_LEFT, doc.y, '800. Items Payable in Connection with Loan');
  doc.moveDown(0.3);
  chargeLine(doc, '801.', 'Loan origination fee', profile.originationFee);
  doc.moveDown(0.2);
  chargeLine(doc, '802.', 'Appraisal fee', profile.appraisalFee);
  doc.moveDown(0.2);
  chargeLine(doc, '803.', 'Credit report', profile.creditReportFee);
  doc.moveDown(0.5);

  // 900 – Items Required by Lender to be Paid in Advance
  sectionHeader(doc, COL_LEFT, doc.y, '900. Items Required by Lender to Be Paid in Advance');
  doc.moveDown(0.3);
  chargeLine(doc, '903.', "Homeowner's insurance premium (12 months)", profile.homeownersInsurance);
  doc.moveDown(0.5);

  // 1000 – Reserves Deposited with Lender
  sectionHeader(doc, COL_LEFT, doc.y, '1000. Reserves Deposited with Lender');
  doc.moveDown(0.3);
  chargeLine(doc, '1004.', 'County property taxes (3 months @ 1/12 annual)', profile.propertyTaxEscrow);
  doc.moveDown(0.5);

  // 1100 – Title Charges
  sectionHeader(doc, COL_LEFT, doc.y, '1100. Title Charges');
  doc.moveDown(0.3);
  chargeLine(doc, '1101.', `Settlement or closing fee to ${profile.settlementAgent}`, 450);
  doc.moveDown(0.2);
  chargeLine(doc, '1103.', "Owner's title insurance", profile.titleInsurance * 0.4);
  doc.moveDown(0.2);
  chargeLine(doc, '1104.', "Lender's title insurance", profile.titleInsurance * 0.6);
  doc.moveDown(0.5);

  // 1200 – Government Recording and Transfer Charges
  sectionHeader(doc, COL_LEFT, doc.y, '1200. Government Recording and Transfer Charges');
  doc.moveDown(0.3);
  chargeLine(doc, '1201.', 'Recording fees', profile.recordingFees);
  doc.moveDown(0.2);
  chargeLine(doc, '1203.', `${profile.propertyState} state transfer tax`, profile.contractSalesPrice * 0.001);
  doc.moveDown(0.5);

  // 1300 – Additional Settlement Charges
  sectionHeader(doc, COL_LEFT, doc.y, '1300. Additional Settlement Charges');
  doc.moveDown(0.3);
  chargeLine(doc, '1301.', 'Survey fee', profile.surveyFee);
  doc.moveDown(0.2);
  chargeLine(doc, '1302.', 'Pest/termite inspection', profile.pestInspection);
  doc.moveDown(0.5);

  totalLine(doc, '1400. Total Settlement Charges (entered on Line 103)', profile.settlementCharges);

  doc.moveDown(2);
  doc.fontSize(8).font('Helvetica').text(
    `I have carefully reviewed the HUD-1 Settlement Statement and to the best of my knowledge and belief, ` +
      `it is a true and accurate statement of all receipts and disbursements made on my account or by me in this transaction. ` +
      `I further certify that I have received a copy of the HUD-1 Settlement Statement.`,
    COL_LEFT,
    doc.y,
    { width: 510, align: 'justify' },
  );
  doc.moveDown(1.5);
  doc.fontSize(9).font('Helvetica').text(`Borrower: ${profile.borrower.name}`, COL_LEFT);
  doc.text(`Date: ${profile.settlementDate}`, COL_LEFT);
  doc.moveDown(0.5);
  if (profile.coBorrower) {
    doc.text(`Co-Borrower: ${profile.coBorrower.name}`, COL_LEFT);
    doc.text(`Date: ${profile.settlementDate}`, COL_LEFT);
    doc.moveDown(0.5);
  }
  doc.text(`Seller: ${profile.seller.name}`, COL_LEFT);
  doc.text(`Date: ${profile.settlementDate}`, COL_LEFT);
  if (profile.coSeller) {
    doc.moveDown(0.5);
    doc.text(`Co-Seller: ${profile.coSeller.name}`, COL_LEFT);
    doc.text(`Date: ${profile.settlementDate}`, COL_LEFT);
  }
  doc.moveDown(0.5);
  doc.text(`Settlement Agent: ${profile.settlementAgent}`, COL_LEFT);
  doc.text(`Date: ${profile.settlementDate}`, COL_LEFT);

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
