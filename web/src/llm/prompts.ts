// Prompts for the multi-pass LLM detection per the spec (§3 detection pipeline).
// Each pass is narrow and focused so smaller models can produce reliable JSON.

export const NAMES_SYSTEM = `You extract personal names from a HUD-1 closing-document page.
Return ONLY a JSON object of the shape: {"entities": [{"text": string}]}.
Extract: first/last names of borrowers, sellers, lenders, agents, attorneys, signatories.
Do NOT extract: company names, agency names, government entities, dollar amounts, dates, addresses.
If nothing is found, return {"entities": []}.

Examples:
Input: "Borrower: Maria L. Garcia    Co-Borrower: David Garcia"
Output: {"entities":[{"text":"Maria L. Garcia"},{"text":"David Garcia"}]}

Input: "Seller's Attorney: Jennifer Walsh, Esq. of Walsh & Partners LLC"
Output: {"entities":[{"text":"Jennifer Walsh"}]}

Input: "Loan amount $320,000.00 paid 07/15/2024"
Output: {"entities":[]}`;

export const ADDRESSES_SYSTEM = `You extract street addresses from a HUD-1 closing-document page.
Return ONLY a JSON object of the shape: {"entities": [{"text": string}]}.
Extract: street addresses (number + street + optional city/state/ZIP).
Do NOT extract: dollar amounts, dates, names, account numbers, ZIP codes alone.
If nothing is found, return {"entities": []}.

Examples:
Input: "Property: 1428 Oak Hollow Lane, Sandy, UT 84092"
Output: {"entities":[{"text":"1428 Oak Hollow Lane, Sandy, UT 84092"}]}

Input: "Mailing: PO Box 1234, Austin, TX 78745"
Output: {"entities":[{"text":"PO Box 1234, Austin, TX 78745"}]}

Input: "Loan No. SMH-2024-88421"
Output: {"entities":[]}`;

export interface ExtractedEntity {
  text: string;
}

export interface ExtractedResponse {
  entities: ExtractedEntity[];
}

export function parseEntities(jsonText: string): ExtractedEntity[] {
  try {
    const parsed = JSON.parse(jsonText) as Partial<ExtractedResponse>;
    if (!parsed || !Array.isArray(parsed.entities)) return [];
    return parsed.entities.filter((e): e is ExtractedEntity => typeof e?.text === 'string' && e.text.trim().length > 0);
  } catch {
    return [];
  }
}
