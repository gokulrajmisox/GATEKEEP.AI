import { pipeline, env } from '@huggingface/transformers';
import fs from 'node:fs';
import os from 'node:os';
import process from 'node:process';

env.allowRemoteModels = true;
env.allowLocalModels = false;
env.useBrowserCache = false;
const model = 'Xenova/bert-base-NER-uncased';
const cases = [
  ['person-positive', 'Alice Johnson joined Acme Corporation in London.', ['PERSON', 'ORGANIZATION', 'LOCATION']],
  ['person-positive-2', 'Dr. John Smith lives in Paris.', ['PERSON', 'LOCATION']],
  ['organization-positive', 'Microsoft opened an office in Seattle.', ['ORGANIZATION', 'LOCATION']],
  ['clean-prose', 'Summarize the release notes and list three risks.', []],
  ['clean-code', 'const retries = 3; return response.status === 200;', []],
  ['clean-generic', 'The meeting is scheduled for tomorrow afternoon.', []],
];
const started = Date.now();
const ner = await pipeline('token-classification', model, { dtype: 'q8' });
const loadMs = Date.now() - started;
const rows = [];
for (const [id, text, expected] of cases) {
  const t0 = process.hrtime.bigint();
  const output = await ner(text);
  const latencyMs = Number(process.hrtime.bigint() - t0) / 1e6;
  const detected = [...new Set(output.filter((x) => x.score >= 0.5 && !x.entity.endsWith('-MISC') && !x.entity.endsWith('-O')).map((x) => {
    const label = x.entity.replace(/^[BI]-/, '').toUpperCase();
    return { PER: 'PERSON', ORG: 'ORGANIZATION', LOC: 'LOCATION' }[label] || label;
  }))];
  const wanted = new Set(expected); const found = new Set(detected);
  const tp = [...wanted].filter((x) => found.has(x)).length;
  const fp = [...found].filter((x) => !wanted.has(x)).length;
  const fn = [...wanted].filter((x) => !found.has(x)).length;
  rows.push({ id, expected, detected, tp, fp, fn, latencyMs });
}
const totals = rows.reduce((a, r) => ({ tp: a.tp + r.tp, fp: a.fp + r.fp, fn: a.fn + r.fn }), { tp: 0, fp: 0, fn: 0 });
const precision = totals.tp / (totals.tp + totals.fp || 1);
const recall = totals.tp / (totals.tp + totals.fn || 1);
const result = { generatedAt: new Date().toISOString(), model, runtime: { node: process.version, cpuCount: os.cpus().length, loadMs, rssAfterMb: Math.round(process.memoryUsage().rss / 1024 / 1024), heapUsedMb: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) }, cases: rows.length, totals, precision, recall, f1: 2 * precision * recall / (precision + recall || 1), inferenceMedianMs: rows.map((r) => r.latencyMs).sort((a,b) => a-b)[Math.floor(rows.length / 2)], rows };
fs.writeFileSync(new URL('../reports/ner-evaluation-results.json', import.meta.url), JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify(result, null, 2));
