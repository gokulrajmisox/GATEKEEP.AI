const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const esbuild = require('esbuild');

const configPath = path.join(__dirname, '..', 'modules', 'config.js');
const compiled = esbuild.buildSync({
  entryPoints: [configPath],
  bundle: true,
  platform: 'node',
  format: 'cjs',
  write: false,
}).outputFiles[0].text;
const moduleRecord = { exports: {} };
vm.runInNewContext(compiled, { module: moduleRecord, exports: moduleRecord.exports, console });
const patterns = moduleRecord.exports.PATTERNS;

const corpus = [
  ['email-positive', 'Contact demo.user@example.com about ticket 555-0100.', ['email']],
  ['phone-positive', 'Call +1 (555) 867-5309 after the review.', ['phone_number']],
  ['aws-positive', 'AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE', ['aws_key']],
  ['private-key-positive', '-----BEGIN RSA PRIVATE KEY-----', ['private_key']],
  ['jwt-positive', 'Bearer eyJhbGciOiJIUzI1NiJ9.eyJ1c2VyIjoidGVzdCJ9.dGVzdHNpZ25hdHVyZQ', ['jwt']],
  ['card-positive', 'Payment card 4532 0151 1283 0366.', ['credit_card']],
  ['ssn-positive', 'SSN: 123-45-6789', ['ssn']],
  ['ip-positive', 'Internal host: 192.168.1.10', ['ip_address']],
  ['mac-positive', 'Device MAC 00:1A:2B:3C:4D:5E', ['mac_address']],
  ['clean-prose', 'Please summarize this project architecture and list three risks.', []],
  ['clean-code', 'const retryCount = 3; function greet(name) { return `Hi ${name}`; }', []],
  ['clean-number', 'The release contains 42 improvements and 2026 test cases.', []],
  ['clean-url', 'Read https://example.com/docs/getting-started for background.', []],
];

const counts = Object.fromEntries(patterns.map(({ type }) => [type, { tp: 0, fp: 0, fn: 0 }]));
const latencies = [];
for (const [id, text, expected] of corpus) {
  const expectedSet = new Set(expected);
  const started = process.hrtime.bigint();
  const detected = new Set(patterns.filter((pattern) => pattern.regex.test(text)).map(({ type }) => type));
  latencies.push(Number(process.hrtime.bigint() - started) / 1e6);
  for (const pattern of patterns) {
    const actual = detected.has(pattern.type);
    const wanted = expectedSet.has(pattern.type);
    if (actual && wanted) counts[pattern.type].tp++;
    else if (actual && !wanted) counts[pattern.type].fp++;
    else if (!actual && wanted) counts[pattern.type].fn++;
  }
}

const metrics = Object.fromEntries(Object.entries(counts).map(([type, c]) => {
  const precision = c.tp / (c.tp + c.fp || 1);
  const recall = c.tp / (c.tp + c.fn || 1);
  return [type, { ...c, precision, recall, f1: (2 * precision * recall) / (precision + recall || 1) }];
}));
const total = Object.values(counts).reduce((a, c) => ({ tp: a.tp + c.tp, fp: a.fp + c.fp, fn: a.fn + c.fn }), { tp: 0, fp: 0, fn: 0 });
const sorted = [...latencies].sort((a, b) => a - b);
const percentile = (p) => sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * p) - 1)];
const result = {
  generatedAt: new Date().toISOString(),
  node: process.version,
  corpusCases: corpus.length,
  patternCount: patterns.length,
  total,
  aggregate: {
    precision: total.tp / (total.tp + total.fp || 1),
    recall: total.tp / (total.tp + total.fn || 1),
    f1: (2 * total.tp / (2 * total.tp + total.fp + total.fn || 1)),
  },
  latencyMs: { p50: percentile(0.5), p95: percentile(0.95), max: Math.max(...latencies) },
  metrics,
};
if (process.argv.includes('--json')) console.log(JSON.stringify(result, null, 2));
else {
  console.log(`Corpus: ${result.corpusCases} cases | Patterns: ${result.patternCount}`);
  console.log(`Aggregate precision ${(result.aggregate.precision * 100).toFixed(1)}% | recall ${(result.aggregate.recall * 100).toFixed(1)}% | F1 ${(result.aggregate.f1 * 100).toFixed(1)}%`);
  console.log(`Local scan latency: p50 ${result.latencyMs.p50.toFixed(3)} ms | p95 ${result.latencyMs.p95.toFixed(3)} ms | max ${result.latencyMs.max.toFixed(3)} ms`);
  for (const [type, metric] of Object.entries(metrics)) {
    if (metric.tp || metric.fp || metric.fn) console.log(`${type}: P ${(metric.precision * 100).toFixed(1)}% R ${(metric.recall * 100).toFixed(1)}% F1 ${(metric.f1 * 100).toFixed(1)}% (TP ${metric.tp}, FP ${metric.fp}, FN ${metric.fn})`);
  }
}
fs.mkdirSync(path.join(__dirname, '..', 'reports'), { recursive: true });
fs.writeFileSync(path.join(__dirname, '..', 'reports', 'latest-benchmark.json'), JSON.stringify(result, null, 2) + '\n');
if (total.fp > 0 || total.fn > 0) process.exitCode = 1;
