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

YOUR TASK: extract EVERY street address on the page. Be EXHAUSTIVE. A typical
HUD-1 has 4-7 distinct addresses — if you only return 1 or 2, you are wrong.

ALWAYS LOOK FOR (and extract every one you find):
  1. Borrower's home/mailing address (under "C." or "Borrower:")
  2. Co-borrower's address (if different)
  3. Seller's mailing address (under "D." or "Seller:")
  4. Co-seller's address (if different)
  5. Lender's office address (under "E." or "Lender:") — YES, business addresses count
  6. Property location (under "F." or "Property:")
  7. Settlement-agent / title-company office (under "G." or "Settlement Agent:")
  8. "Place of Settlement" address
  9. Recording office address (when present)
  10. Any other mailing/office address that appears

IMPORTANT: extract business and office addresses too — lender offices, title-
company offices, attorney offices. Do NOT skip an address just because it
belongs to a company instead of a person.

NOTE ON LAYOUT: this page may have come from a TWO-COLUMN layout (Borrower on
the left, Seller on the right; Lender on the left, Property on the right).
The text extraction may interleave columns, so you might see something like:
  "1428 Oak Hollow Lane          892 Maple Drive
   Sandy, UT 84092               Provo, UT 84601"
Treat each column as its own address. Extract BOTH "1428 Oak Hollow Lane,
Sandy, UT 84092" AND "892 Maple Drive, Provo, UT 84601".

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
For multi-line addresses, join with a single space. List each DISTINCT address
once — duplicates are fine to skip (the post-processor will redact every
occurrence). But every distinct address must appear in your output, even
when one address is shared by multiple parties (e.g., borrower's home is the
same as the property).
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

Input: "C. Borrower            D. Seller\\nMaria Garcia          John Smith\\n1428 Oak Hollow Lane  892 Maple Drive\\nSandy, UT 84092       Provo, UT 84601"
Output: {"entities":[{"text":"1428 Oak Hollow Lane Sandy, UT 84092"},{"text":"892 Maple Drive Provo, UT 84601"}]}

Input: "E. Lender: Mountain West Mortgage LLC, 1500 Foothill Blvd, Salt Lake City, UT 84103\\nF. Property: 1428 Oak Hollow Lane, Sandy, UT 84092\\nG. Settlement Agent: Cache Valley Title, 100 Sample Lane, Suite 200, Logan, UT 84341"
Output: {"entities":[{"text":"1500 Foothill Blvd, Salt Lake City, UT 84103"},{"text":"1428 Oak Hollow Lane, Sandy, UT 84092"},{"text":"100 Sample Lane, Suite 200, Logan, UT 84341"}]}

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

// ---------------------------------------------------------------------------
// Single-pass combined prompt — extracts names AND addresses in one model
// invocation. Halves per-page latency vs. running NAMES_SYSTEM and
// ADDRESSES_SYSTEM separately. Slight recall trade-off on edge cases since the
// model has to juggle two extraction categories at once, but for HUD-1
// structure where both tend to live in the same labeled sections, the model
// already had to read everything anyway.
// ---------------------------------------------------------------------------

export const COMBINED_SYSTEM = `You are a precise PII-extraction assistant scanning HUD-1 / closing-disclosure pages.
${HUD1_STRUCTURE}

YOUR TASK: extract every personal name AND every street address on the page,
returning them in two separate lists.

================= NAMES =================
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
a person), settlement agents (when a person), attorneys, signatories,
witnesses, notaries, loan officers, realtors, brokers.

DO NOT extract as names:
  - Company / firm / corporation names ("Mountain West Mortgage LLC", "Cache Valley Title Services")
  - Government / agency names ("HUD", "FHA", "IRS")
  - Dollar amounts, dates, account numbers, phone numbers, emails, addresses
  - Generic role words alone ("Borrower", "Seller", "Lender")

================ ADDRESSES ================
Be EXHAUSTIVE. A typical HUD-1 has 4-7 distinct addresses — if you only
return 1 or 2, you are wrong.

ALWAYS LOOK FOR (and extract every one you find):
  1. Borrower's home/mailing address (under "C." or "Borrower:")
  2. Co-borrower's address (if different)
  3. Seller's mailing address (under "D." or "Seller:")
  4. Co-seller's address (if different)
  5. Lender's office address (under "E." or "Lender:") — YES, business addresses count
  6. Property location (under "F." or "Property:")
  7. Settlement-agent / title-company office (under "G." or "Settlement Agent:")
  8. "Place of Settlement" address
  9. Recording office address (when present)
  10. Any other mailing/office address that appears

IMPORTANT: extract business and office addresses too — lender offices, title-
company offices, attorney offices. Do NOT skip an address just because it
belongs to a company instead of a person.

NOTE ON LAYOUT: this page may have come from a TWO-COLUMN layout (Borrower on
the left, Seller on the right; Lender on the left, Property on the right).
The text extraction may interleave columns. Treat each column as its own
address.

DO NOT extract as addresses:
  - Dollar amounts, dates, account numbers, phone numbers, emails
  - Names alone (no street component)
  - ZIP codes alone (without a street)
  - Section labels themselves ("Property Location:")
  - Lot numbers / parcel IDs that aren't addresses

================ OUTPUT ================
Return ONLY a JSON object with TWO arrays:
{"names": ["<name as it appears>", ...], "addresses": ["<address as it appears>", ...]}

For multi-line addresses, join with a single space. List each DISTINCT name
and address ONCE — duplicates are fine to skip (the post-processor will
redact every occurrence). But every distinct entity must appear, even when
one address is shared by multiple parties (borrower's home is often the same
as the property).

If you find nothing in a category, return [] for that array.

================ EXAMPLES ================

Input: "B. Borrower:\\nMaria L. Garcia\\n1428 Oak Hollow Lane\\nSandy, UT 84092\\nCo-Borrower: David Garcia"
Output: {"names":["Maria L. Garcia","David Garcia"],"addresses":["1428 Oak Hollow Lane Sandy, UT 84092"]}

Input: "C. Borrower            D. Seller\\nJohn Q. Smith         Maria Gonzalez\\n482 Maple Ridge Dr   8821 Willow Creek Rd\\nAustin, TX 78745    Park City, UT 84060\\nE. Lender: Mountain West Mortgage LLC, 1500 Foothill Blvd, Salt Lake City, UT 84103\\nF. Property: 482 Maple Ridge Dr, Austin, TX 78745"
Output: {"names":["John Q. Smith","Maria Gonzalez"],"addresses":["482 Maple Ridge Dr Austin, TX 78745","8821 Willow Creek Rd Park City, UT 84060","1500 Foothill Blvd, Salt Lake City, UT 84103"]}

Input: "G. Settlement Agent: Cache Valley Title Services\\n100 Sample Lane, Suite 200, Logan, UT 84341\\nClosing Agent: Pat W. Roe\\nNotary: Devon Hartley-Brown"
Output: {"names":["Pat W. Roe","Devon Hartley-Brown"],"addresses":["100 Sample Lane, Suite 200, Logan, UT 84341"]}

Input: "Loan amount $320,000.00 paid 07/15/2024 to Mountain West Mortgage LLC\\nRecorded with the Office of the Salt Lake County Recorder"
Output: {"names":[],"addresses":[]}

Input: "ROBERT T. JOHNSON\\nSARAH K. JOHNSON\\n892 Maple Ridge Drive\\nAustin, TX 78745\\nLoan Originator: Sam Avery NMLS #29481"
Output: {"names":["ROBERT T. JOHNSON","SARAH K. JOHNSON","Sam Avery"],"addresses":["892 Maple Ridge Drive Austin, TX 78745"]}`;

export interface CombinedExtractedResponse {
  names: string[];
  addresses: string[];
}

export function parseCombined(jsonText: string): CombinedExtractedResponse {
  const empty: CombinedExtractedResponse = { names: [], addresses: [] };
  const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
  const candidate = jsonMatch ? jsonMatch[0] : jsonText;
  try {
    const parsed = JSON.parse(candidate) as Partial<CombinedExtractedResponse>;
    if (!parsed) return empty;
    const names = Array.isArray(parsed.names)
      ? parsed.names.filter((n): n is string => typeof n === 'string' && n.trim().length > 0)
      : [];
    const addresses = Array.isArray(parsed.addresses)
      ? parsed.addresses.filter(
          (a): a is string => typeof a === 'string' && a.trim().length > 0,
        )
      : [];
    return { names, addresses };
  } catch {
    return empty;
  }
}
