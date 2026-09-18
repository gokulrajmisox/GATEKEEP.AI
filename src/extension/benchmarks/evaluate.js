const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const esbuild = require('esbuild');

const configPath = path.join(__dirname, '..', 'modules', 'config.js');
const compiled = esbuild.buildSync({ entryPoints: [configPath], bundle: true, platform: 'node', format: 'cjs', write: false }).outputFiles[0].text;
const moduleRecord = { exports: {} };
vm.runInNewContext(compiled, { module: moduleRecord, exports: moduleRecord.exports, console });
const patterns = moduleRecord.exports.PATTERNS;
const byType = new Map(patterns.map((pattern) => [pattern.type, pattern]));
const cases = [
  { id: 'email-normal', text: 'john.doe@gmail.com', expected: ['email'] },
  { id: 'phone-normal', text: '+1 (555) 867-5309', expected: ['phone_number'] },
  { id: 'aws-normal', text: 'AKIAIOSFODNN7EXAMPLE', expected: ['aws_key'] },
  { id: 'jwt-normal', text: 'eyJhbGciOiJIUzI1NiJ9.eyJ1c2VyIjoidGVzdCJ9.dGVzdHNpZ25hdHVyZQ', expected: ['jwt'] },
  { id: 'email-obfuscated-dot-at', text: 'john [dot] doe [at] gmail [dot] com', expected: [] },
  { id: 'email-spaced-symbols', text: 'john.doe @ gmail.com', expected: [] },
  { id: 'aws-spaced', text: 'AKIA XXXX XXXX', expected: [] },
  { id: 'jwt-spaced', text: 'eyJhbGci OiJIUzI1NiJ9 . eyJ1c2VyIjoidGVzdCJ9 . dGVzdA', expected: [] },
  { id: 'unicode-at', text: 'john.doe＠gmail.com', expected: [] },
  { id: 'unicode-dot', text: 'john.doe@gmail。com', expected: [] },
  { id: 'punctuated-email', text: 'john.doe<at>gmail<dot>com', expected: [] },
  { id: 'benign-prose', text: 'Summarize the release notes and list the top three risks.', expected: [] },
  { id: 'benign-code', text: 'const retries = 3; return response.status === 200;', expected: [] },
];

function detect(text) {
  return patterns.filter((pattern) => pattern.regex.test(text)).map((pattern) => pattern.type);
}
function score(expected, actual) {
  const wanted = new Set(expected); const found = new Set(actual);
  let tp = 0; let fp = 0; let fn = 0;
  for (const type of new Set([...wanted, ...found])) {
    if (wanted.has(type) && found.has(type)) tp++;
    else if (found.has(type)) fp++;
    else fn++;
  }
  return { tp, fp, fn };
}
const totals = { tp: 0, fp: 0, fn: 0 };
const rows = cases.map((item) => {
  const actual = detect(item.text);
  const result = score(item.expected, actual);
  for (const key of Object.keys(totals)) totals[key] += result[key];
  return { ...item, detected: actual, result, passed: JSON.stringify(item.expected) === JSON.stringify(actual) };
});
const latencies = [];
for (let i = 0; i < 100; i++) detect('Contact demo.user@example.com or call +1 555 867 5309.');
for (let i = 0; i < 1000; i++) {
  const started = process.hrtime.bigint();
  detect('Contact demo.user@example.com or call +1 555 867 5309. AWS AKIAIOSFODNN7EXAMPLE');
  latencies.push(Number(process.hrtime.bigint() - started) / 1e6);
}
latencies.sort((a, b) => a - b);
const percentile = (p) => latencies[Math.min(latencies.length - 1, Math.ceil(latencies.length * p) - 1)];
const positives = cases.filter((item) => item.expected.length > 0);
const adversarial = rows.filter((item) => item.id.includes('obfuscated') || item.id.includes('spaced') || item.id.includes('unicode') || item.id.includes('punctuated'));
const falsePositives = rows.filter((item) => item.expected.length === 0 && item.detected.length > 0);
const precision = totals.tp / (totals.tp + totals.fp || 1);
const recall = totals.tp / (totals.tp + totals.fn || 1);
const result = {
  generatedAt: new Date().toISOString(),
  runtime: { node: process.version, platform: process.platform, arch: process.arch, cpuCount: require('node:os').cpus().length, rssBeforeMb: Math.round(process.memoryUsage().rss / 1024 / 1024) },
  detector: { patternCount: patterns.length, patternTypes: patterns.map((p) => p.type) },
  corpus: { totalCases: cases.length, positiveCases: positives.length, adversarialCases: adversarial.length, falsePositiveCases: falsePositives.length },
  regex: { ...totals, precision, recall, f1: 2 * precision * recall / (precision + recall || 1), falsePositiveRate: falsePositives.length / (cases.length - positives.length) },
  latencyMs: { median: percentile(0.5), p95: percentile(0.95), max: latencies.at(-1) },
  memory: { rssAfterMb: Math.round(process.memoryUsage().rss / 1024 / 1024), heapUsedMb: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) },
  adversarial,
};
fs.mkdirSync(path.join(__dirname, '..', 'reports'), { recursive: true });
fs.writeFileSync(path.join(__dirname, '..', 'reports', 'evaluation-results.json'), JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify(result, null, 2));
