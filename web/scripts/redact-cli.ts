import * as fs from 'node:fs';
import * as path from 'node:path';
import { loadPdf } from '../src/pdf/load.js';
import { extractPage } from '../src/pdf/extract.js';
import { detectPage } from '../src/detection/index.js';
import { RegexDetector } from '../src/detection/detectors/regex-detector.js';
import { redactDocument } from '../src/output/redactor.js';
import { verifyDollarPreservation } from '../src/output/dollar-verifier.js';
import { ValueMapper } from '../src/mapping/value-mapper.js';
import type { Span, Mode } from '../src/types.js';

interface Args {
  mode: Mode;
  input: string;
  output: string;
  seed?: number;
}

function parseArgs(argv: string[]): Args {
  const args: Partial<Args> = { mode: 'redact' };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--mode') args.mode = argv[++i] as Mode;
    else if (a === '--in') args.input = argv[++i];
    else if (a === '--out') args.output = argv[++i];
    else if (a === '--seed') args.seed = parseInt(argv[++i], 10);
  }
  if (!args.input || !args.output) {
    console.error(
      'Usage: tsx scripts/redact-cli.ts --mode {redact|sandbox} --in <pdf> --out <pdf> [--seed N]',
    );
    process.exit(1);
  }
  return args as Args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const inputBytes = fs.readFileSync(path.resolve(args.input));
  const inputDoc = await loadPdf(inputBytes);

  const mapper = args.mode === 'sandbox' ? new ValueMapper(args.seed) : null;
  const inputPages: string[] = [];
  const allSpans: Span[] = [];

  for (let i = 0; i < inputDoc.pageCount; i++) {
    const ext = extractPage(inputDoc.getPage(i), i);
    inputPages.push(ext.text);
    const detected = await detectPage(ext.text, [new RegexDetector()]);
    for (const s of detected) {
      const bbox = ext.bboxRange(s.start, s.end);
      if (!bbox) continue;
      const span: Span = {
        ...s,
        bbox: { ...bbox, pageNum: i },
        decision: 'accepted',
      };
      if (mapper) span.replacement = mapper.mapValue(s.label, s.text);
      allSpans.push(span);
    }
  }
  inputDoc.close();

  const outputBytes = await redactDocument(inputBytes, allSpans, { mode: args.mode });

  const outputDoc = await loadPdf(outputBytes);
  const outputPages: string[] = [];
  for (let i = 0; i < outputDoc.pageCount; i++) {
    outputPages.push(extractPage(outputDoc.getPage(i), i).text);
  }
  outputDoc.close();

  const verification = verifyDollarPreservation(inputPages, outputPages);
  if (!verification.ok) {
    console.error('DOLLAR VERIFICATION FAILED — refusing to write output.');
    console.error(JSON.stringify(verification.diffs, null, 2));
    process.exit(2);
  }

  fs.writeFileSync(path.resolve(args.output), outputBytes);
  console.log(`Wrote ${args.output}`);
  console.log(`Spans applied: ${allSpans.length}`);
  if (mapper) {
    const reportPath = args.output.replace(/\.pdf$/, '.mappings.json');
    fs.writeFileSync(reportPath, JSON.stringify(mapper.getMappingReport(), null, 2));
    console.log(`Mappings: ${reportPath}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
