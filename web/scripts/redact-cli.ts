import * as fs from 'node:fs';
import * as path from 'node:path';
import { loadPdf } from '../src/pdf/load.js';
import { extractPage } from '../src/pdf/extract.js';
import { detectPage } from '../src/detection/index.js';
import { RegexDetector } from '../src/detection/detectors/regex-detector.js';
import { NerDetector } from '../src/detection/ner/ner-detector.js';
import { loadTransformersNer } from '../src/detection/ner/transformers-loader.js';
import { redactDocument } from '../src/output/redactor.js';
import { verifyDollarPreservation } from '../src/output/dollar-verifier.js';
import { ValueMapper } from '../src/mapping/value-mapper.js';
import type { Detector, Mode, Span } from '../src/types.js';

interface Args {
  mode: Mode;
  input: string;
  output: string;
  seed?: number;
  detector: 'regex' | 'ner' | 'both';
}

function parseArgs(argv: string[]): Args {
  const args: Partial<Args> = { mode: 'redact', detector: 'regex' };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--mode') args.mode = argv[++i] as Mode;
    else if (a === '--in') args.input = argv[++i];
    else if (a === '--out') args.output = argv[++i];
    else if (a === '--seed') args.seed = parseInt(argv[++i], 10);
    else if (a === '--detector') args.detector = argv[++i] as Args['detector'];
  }
  if (!args.input || !args.output) {
    console.error(
      'Usage: tsx scripts/redact-cli.ts --mode {redact|sandbox} --in <pdf> --out <pdf> [--seed N] [--detector {regex|ner|both}]',
    );
    process.exit(1);
  }
  return args as Args;
}

async function buildDetectors(choice: Args['detector']): Promise<Detector[]> {
  const out: Detector[] = [];
  if (choice === 'regex' || choice === 'both') {
    out.push(new RegexDetector());
  }
  if (choice === 'ner' || choice === 'both') {
    const ner = new NerDetector({ loader: loadTransformersNer });
    process.stderr.write('Loading NER model... ');
    await ner.ensureLoaded((p) => {
      if (p.status === 'downloading' && p.progress > 0) {
        process.stderr.write(`\rLoading NER model: ${Math.round(p.progress * 100)}% `);
      }
    });
    process.stderr.write('\rNER model ready.                  \n');
    out.push(ner);
  }
  return out;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const inputBytes = fs.readFileSync(path.resolve(args.input));
  const detectors = await buildDetectors(args.detector);
  const inputDoc = await loadPdf(inputBytes);

  const mapper = args.mode === 'sandbox' ? new ValueMapper(args.seed) : null;
  const inputPages: string[] = [];
  const allSpans: Span[] = [];

  for (let i = 0; i < inputDoc.pageCount; i++) {
    const ext = extractPage(inputDoc.getPage(i), i);
    inputPages.push(ext.text);
    const detected = await detectPage(ext.text, detectors);
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
  console.log(`Detectors used: ${detectors.map((d) => d.name).join(', ')}`);
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
