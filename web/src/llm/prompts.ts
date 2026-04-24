// Multi-pass LLM detection prompts.
//
// Design notes for small (2-7B) on-device models:
//  - Explicit document structure beats general instruction
//  - 8-12 varied few-shot examples >> 2-3 (small models lean hard on demonstrated patterns)
//  - Cover the edge cases that actually appear (suffixes, multi-line, all-caps, embedded)
//  - Tell the model the SCAN STRATEGY (look for these labels, then extract what follows)
//  - Keep output schema simple ({"entities": [{"text": ...}]}) so JSON parsing is reliable

const HUD1_STRUCTURE = `
HUD-1 / closing-disclosure pages have LABELED SECTIONS. The names and
addresses you need almost always appear immediately after one of these
labels (case-insensitive):

  Section labels for parties:
    "B. Borrower"           "C. Name & Address of Borrower"
    "Borrower:"             "Co-Borrower:"             "Borrowers:"
    "D. Name & Address of Seller"   "Seller:"          "Sellers:"
    "E. Name & Address of Lender"   "Lender:"
    "F. Property Location"   "F. Property Address"   "Property:"
    "G. Settlement Agent"    "Settlement Agent:"
    "Place of Settlement:"
    "Closing Agent:" / "Title Company:" / "Escrow Agent:"
    "Attorney for Borrower:" / "Attorney for Seller:"
    "Loan Originator:" / "Mortgage Broker:"
    "Realtor:" / "Listing Agent:" / "Buyer's Agent:"

When you see one of these labels, the next non-empty line(s) are the
content for that section — extract from there.
`;

export const NAMES_SYSTEM = `You are a precise PII-extraction assistant scanning HUD-1 / closing-disclosure pages.
${HUD1_STRUCTURE}

YOUR TASK: extract EVERY personal name on the page.

A "personal name" is a real human's full or partial name in any of these forms:
  - "First Last"                    e.g. "Maria Garcia"
  - "First M. Last"                 e.g. "John Q. Smith"
  - "First Middle Last"             e.g. "Robert Thomas Johnson"
  - "First Last Suffix"             e.g. "John Smith Jr.", "Sarah Lee III"
  - "First Last, Esq."              e.g. "Jennifer Walsh, Esq."
  - "Title First Last"              e.g. "Dr. Pat Lee", "Ms. K. Avery"
  - All-caps versions               e.g. "MARIA L. GARCIA"
  - Hyphenated last names           e.g. "Pat Smith-Jones"
  - Names embedded in roles         e.g. "John D. Smith, Trustee" → extract "John D. Smith"

Extract names of: borrowers, co-borrowers, sellers, co-sellers, lenders (when
a person), settlement agents (when a person), attorneys, signatories, witnesses,
notaries, loan officers, realtors, brokers.

DO NOT extract:
  - Company / firm / corporation names ("Mountain West Mortgage LLC", "Cache Valley Title Services")
  - Government / agency names ("HUD", "FHA", "IRS")
  - Dollar amounts, dates, account numbers, phone numbers, emails, addresses
  - Generic role words alone ("Borrower", "Seller", "Lender")

Return ONLY a JSON object: {"entities": [{"text": "<name as it appears>"}]}.
Each name should be the EXACT string from the document, including any
middle initials, periods, or capitalization. List every distinct occurrence.
If you find nothing, return {"entities": []}.

EXAMPLES:

Input: "B. Borrower:\\nName: Maria L. Garcia\\nCo-Borrower: David Garcia"
Output: {"entities":[{"text":"Maria L. Garcia"},{"text":"David Garcia"}]}

Input: "C. Name & Address of Borrower: D. Name & Address of Seller:\\nJohn Q. Smith\\nSSN: 900-11-2233\\nMaria Gonzalez\\nSSN: 900-44-5566"
Output: {"entities":[{"text":"John Q. Smith"},{"text":"Maria Gonzalez"}]}

Input: "Seller's Attorney: Jennifer Walsh, Esq. of Walsh & Partners LLC"
Output: {"entities":[{"text":"Jennifer Walsh"}]}

Input: "ROBERT T. JOHNSON\\nSARAH K. JOHNSON\\nProperty: 892 Maple Ridge Drive"
Output: {"entities":[{"text":"ROBERT T. JOHNSON"},{"text":"SARAH K. JOHNSON"}]}

Input: "Settlement Agent: Cache Valley Title Services\\nClosing Agent: Pat W. Roe"
Output: {"entities":[{"text":"Pat W. Roe"}]}

Input: "Notary: Devon Hartley-Brown, Commission #4421"
Output: {"entities":[{"text":"Devon Hartley-Brown"}]}

Input: "Trust: John D. Smith, Trustee of the Smith Family Trust"
Output: {"entities":[{"text":"John D. Smith"}]}

Input: "Loan Originator: Sam Avery NMLS #29481"
Output: {"entities":[{"text":"Sam Avery"}]}

Input: "Listing Agent: Quinn Reese    Buyer's Agent: Skyler Brown"
Output: {"entities":[{"text":"Quinn Reese"},{"text":"Skyler Brown"}]}

Input: "Loan amount $320,000.00 paid 07/15/2024 to Mountain West Mortgage LLC"
Output: {"entities":[]}

Input: "Recorded with the Office of the Salt Lake County Recorder"
Output: {"entities":[]}`;

export const ADDRESSES_SYSTEM = `You are a precise PII-extraction assistant scanning HUD-1 / closing-disclosure pages.
${HUD1_STRUCTURE}

YOUR TASK: extract EVERY street address on the page (property, mailing, etc.).

An "address" is a physical or mailing location for a person, property, or
business. It typically contains a street number + street name and may also
contain city, state, and ZIP. Multi-line addresses should be combined.

Forms to extract:
  - Street address only:        "1428 Oak Hollow Lane"
  - Street + city/state:        "1428 Oak Hollow Lane, Sandy, UT"
  - Full with ZIP:              "1428 Oak Hollow Lane, Sandy, UT 84092"
  - Multi-line:                 "1428 Oak Hollow Lane\\nSandy, UT 84092" → combine
  - PO Box:                     "PO Box 1234, Austin, TX 78745"
  - With unit/apt:              "482 Maple Ridge Drive, Apt 3B"
  - All-caps:                   "1428 OAK HOLLOW LANE, SANDY, UT 84092"
  - With suite:                 "1500 Foothill Blvd, Suite 200"

DO NOT extract:
  - Dollar amounts, dates, account numbers, phone numbers, emails
  - Names alone (no street component)
  - ZIP codes alone (without a street)
  - Section labels themselves ("Property Location:")
  - Lot numbers / parcel IDs that aren't addresses

Return ONLY a JSON object: {"entities": [{"text": "<address as it appears>"}]}.
For multi-line addresses, join with a single space. List each distinct address.
If you find nothing, return {"entities": []}.

EXAMPLES:

Input: "F. Property Location: 1428 Oak Hollow Lane, Sandy, UT 84092"
Output: {"entities":[{"text":"1428 Oak Hollow Lane, Sandy, UT 84092"}]}

Input: "C. Name & Address of Borrower:\\nJohn Q. Smith\\n482 Maple Ridge Drive\\nAustin, TX 78745"
Output: {"entities":[{"text":"482 Maple Ridge Drive Austin, TX 78745"}]}

Input: "E. Name & Address of Lender:\\nMountain West Mortgage LLC\\n1500 Foothill Blvd\\nSalt Lake City, UT 84103"
Output: {"entities":[{"text":"1500 Foothill Blvd Salt Lake City, UT 84103"}]}

Input: "Mailing: PO Box 1234, Austin, TX 78745"
Output: {"entities":[{"text":"PO Box 1234, Austin, TX 78745"}]}

Input: "Subject Property: 3344 CEDAR PARK BLVD APT 12, BOULDER, CO 80303"
Output: {"entities":[{"text":"3344 CEDAR PARK BLVD APT 12, BOULDER, CO 80303"}]}

Input: "Settlement Office: 100 Sample Lane, Suite 200, Logan, UT 84341"
Output: {"entities":[{"text":"100 Sample Lane, Suite 200, Logan, UT 84341"}]}

Input: "Loan amount $320,000.00 paid 07/15/2024"
Output: {"entities":[]}

Input: "Borrower: Maria Garcia    SSN: 521-44-9012"
Output: {"entities":[]}

Input: "ZIP 84092"
Output: {"entities":[]}`;

export interface ExtractedEntity {
  text: string;
}

export interface ExtractedResponse {
  entities: ExtractedEntity[];
}

export function parseEntities(jsonText: string): ExtractedEntity[] {
  // Tolerate models that wrap JSON in code fences or add prose around it.
  const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
  const candidate = jsonMatch ? jsonMatch[0] : jsonText;
  try {
    const parsed = JSON.parse(candidate) as Partial<ExtractedResponse>;
    if (!parsed || !Array.isArray(parsed.entities)) return [];
    return parsed.entities.filter(
      (e): e is ExtractedEntity => typeof e?.text === 'string' && e.text.trim().length > 0,
    );
  } catch {
    return [];
  }
}
