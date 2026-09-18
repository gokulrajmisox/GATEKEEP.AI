# GATEKEEP.AI Evaluation

## Executive summary

This evaluation measures the checked-in regex detector and the configured local NER model against small, synthetic, hand-labeled corpora. It reports what was measured, not a general claim that the firewall detects every sensitive value. The results show strong performance on the included canonical examples, while the adversarial suite demonstrates an important limitation: obfuscated and Unicode-substituted inputs were **not detected** by the current regex rules.

The evaluated project revision is the local working tree containing the benchmark and evaluation runners. Results were generated on **2026-09-18**.

## Evaluation environment

| Variable | Measured value |
|---|---|
| Operating system | Linux 6.18.38, x86_64 |
| CPU | 6 logical CPUs available |
| RAM | 5,858 MB total; 4,714 MB available at measurement start |
| Node.js | v22.13.0 |
| Chromium installed | Chromium 151.0.7922.71 |
| Extension model | `Xenova/bert-base-NER-uncased` |
| Model quantization | `q8` |
| Transformers.js | `@huggingface/transformers` 3.8.1 |
| Extension inference configuration | ONNX Runtime Web WASM, one thread, offscreen document |
| Browser extension runtime | Chromium version was recorded, but a browser-automation harness was not used for these CLI measurements |

The NER results below are measured by invoking the same model configuration from Node.js. They are not presented as Chrome wall-clock measurements. A production release should add a Chrome automation run with the unpacked extension and collect browser-side memory and interaction latency separately.

## Detector quality

The standard corpus contains 13 synthetic cases: four canonical sensitive-data positives, nine benign or adversarial negatives, and 12 configured regex patterns. The NER corpus contains six synthetic sentences with seven labeled entities and three benign cases. The hybrid row is a **composite** over those two labeled slices, not a claim from one unified production trace.

| Detector | Corpus | Precision | Recall | F1 |
|---|---:|---:|---:|---:|
| Regex | 13 cases; 4 positive cases | 100.0% | 100.0% | 100.0% |
| NER | 6 cases; 7 labeled entities | 100.0% | 100.0% | 100.0% |
| Hybrid composite | 19 cases across both slices | 100.0% | 100.0% | 100.0% |

The apparent 100% scores are expected to be optimistic because these are small, synthetic, curated regression corpora. They should be treated as a regression baseline, not as a representative estimate of real-world accuracy. The next evaluation step should use a larger, independently labeled corpus with realistic benign prompts, multilingual text, code, structured documents, and difficult near-misses.

## Regex performance

The regex evaluator performs 100 warm-up scans and then 1,000 timed scans of a representative prompt containing email, phone, and AWS-key examples. The measurement is detector execution time in Node.js, excluding DOM event handling, UI rendering, Chrome messaging, and model inference.

| Metric | Measured value |
|---|---:|
| Median detection latency | 0.003 ms |
| P95 detection latency | 0.007 ms |
| Maximum observed latency | 1.175 ms |
| Process RSS before/after scan benchmark | 69 MB / 69 MB |
| Heap used after scan benchmark | 5 MB |
| False-positive rate on nine benign/adversarial cases | 0.0% |

The results file is generated at [`src/extension/reports/evaluation-results.json`](src/extension/reports/evaluation-results.json).

## NER performance

The NER runner loads the configured quantized model, then evaluates six sentences. Model loading and inference were measured separately.

| Metric | Measured value |
|---|---:|
| Model load time | 753 ms |
| Median per-sentence inference latency | 11.128 ms |
| Process RSS after model load and inference | 319 MB |
| Heap used after model load and inference | 19 MB |
| NER false-positive rate on three benign cases | 0.0% |

The measured RSS increase relative to the regex-only process was approximately **250 MB**. RSS includes native/WASM/runtime allocations and should not be interpreted as model-file size. The extension’s actual Chrome memory footprint can differ.

## Adversarial inputs

These inputs were intentionally chosen to probe normalization and obfuscation gaps. The current detector does not normalize them before applying patterns.

| Input class | Example | Result | Interpretation |
|---|---|---|---|
| Obfuscated email | `john [dot] doe [at] gmail [dot] com` | Not detected | Bypass confirmed |
| Spaces around symbols | `john.doe @ gmail.com` | Not detected | Bypass confirmed |
| Spaced AWS key | `AKIA XXXX XXXX` | Not detected | Not a canonical key; no positive expectation |
| JWT with spaces | `eyJhbGci OiJIUzI1NiJ9 . eyJ1c2VyIjoidGVzdCJ9 . dGVzdA` | Not detected | Bypass confirmed for a malformed/spaced token |
| Unicode at-sign | `john.doe＠gmail.com` | Not detected | Unicode normalization gap |
| Unicode full stop | `john.doe@gmail。com` | Not detected | Unicode normalization gap |
| Inserted punctuation | `john.doe<at>gmail<dot>com` | Not detected | Bypass confirmed |

These results are not failures of the canonical detector contract because the current rules intentionally match structured formats. They are, however, material threat-model findings: a user or attacker can evade simple pattern matching through natural-language obfuscation. A future normalization layer should be separately evaluated to avoid increasing false positives.

## Reproduction

From the repository root:

```bash
cd src/extension
npm ci
node benchmarks/evaluate.js
node benchmarks/ner-evaluate.mjs
npm test
npm run build
```

The two evaluation commands write machine-readable results to:

- `src/extension/reports/evaluation-results.json`
- `src/extension/reports/ner-evaluation-results.json`

The existing `npm run benchmark` command remains the smaller regression benchmark used by CI.

## What this demonstrates

The evidence supports narrower, defensible statements:

- Canonical structured values are detected quickly by the regex layer on the checked-in synthetic corpus.
- The configured NER model correctly identified the labeled entities in the small evaluation slice.
- The NER layer has materially higher memory cost than regex-only scanning.
- The current detector does not catch common obfuscation and Unicode substitution patterns.
- The current numbers are a reproducible baseline, not production efficacy or a security guarantee.

## Limitations and next experiments

The evaluation does not measure user correction time, Chrome content-script scheduling, modal rendering latency, site-specific submission interception, provider-side retention, multilingual NER, image/OCR inputs, or model-download network behavior. It also does not establish statistical confidence intervals because the corpora are too small.

Recommended next steps are to expand the corpus to at least hundreds of independently labeled examples, add false-positive-heavy benign prompts, evaluate the detector in Chromium with the unpacked extension loaded, measure browser process memory before and after model initialization, and add a normalization experiment for obfuscated and Unicode inputs with a separate regression threshold.
