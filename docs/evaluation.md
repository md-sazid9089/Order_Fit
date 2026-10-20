# AI evaluation

Run the offline regression corpus from the repository root:

```powershell
backend/.venv/Scripts/python.exe scripts/ai_eval.py --mode recorded --output "$env:TEMP/orderfit-ai-evaluation.json"
```

Routine runs write outside the tracked corpus; regeneration is an intentional fixture change.
The runner never loads `.env`. Recorded extraction and what-if cases call the
same public functions as production and use committed synthetic recordings under
`data/ai_workflow/recordings/`. Reply cases measure the deterministic baseline merged with a recorded typed reading when
one exists; a template fallback is never counted as a model pass.

`pass_k` means every repeated run was safe and matched its labels. `model_passes`
separately counts only a recorded or live model result; a template fallback has
zero model passes even if it is the safe expected outcome for an unsupported
instruction. The report also includes fallback rate, per-case latency and any
provider token totals. Live evaluations require an explicit provider configuration
outside this script and have not been run for this corpus.

## Tasks, comparison and language qualification

Case tasks: `extract`, `whatif`, `reply`, `clause`, `explain`. Cases with a `recorded` key
carry a synthetic model output; `python scripts/ai_eval.py --write-recordings` regenerates the
matching recording files (the older hand-written recordings are untouched). Several recordings
are deliberately weak model outputs (an `invoice_date` basis, two "extracted" totals, a
computed sum, a fabricated quote, a number inside an explanation) to prove that the guards
lower or drop them.

The report adds, per task, `unsafe_changes` and `model_path_retained` (true only while the
model path produced zero unsafe changes; for what-if it also reports the deterministic
baseline's pass count and how many cases the model path adds), and per language `qualified`
(true only if extract and reply cases exist for it and all pass). Both carry
`evidence: "recorded"`: a replay of authored outputs. They establish that the pipeline,
guards, grounding and language handling behave as specified, not that any model reads these
languages well. Run the same cases with `--mode live` and a configured provider before
describing live quality.

Synthetic per-script PDFs are generated in tests (`tests/pdf_synthetic.py`, a non-embedded
Identity-H font with a ToUnicode map) and read through the bounded production parser; this
checks the text-layer path for Bengali, Hindi and Simplified Chinese, not any particular
producer's shaping.
