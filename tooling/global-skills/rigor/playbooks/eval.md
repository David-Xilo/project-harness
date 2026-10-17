# Eval

**You own the experiment's design. Plan, blind, run, synthesize.**

When the skill ships in a plugin with an eval suite, `claude plugin eval` runs it; the
`claude-code-guide` agent knows how to write one. Otherwise run the blinded arena below.

**Rules for blinding:**

- No `eval`, `test`, `judge`, `experiment`, `rubric`, `score`, `compare`, `benchmark`,
  `candidate` or `arena` in any folder, file or prompt a candidate sees.
- The candidate's prompt reads like a real request: the goal, not the meta.
- No cues that ask for the chain. Don't ask candidates which skills, principles or files
  they used; ask for design notes in general, and grade chain-following from the shape of
  the code, not self-report.
- Folder and slug names look like a real project's.
- Don't tell a candidate that other candidates exist.
- The judge knows it is judging, but sees the outputs by label only, never by model.
- Comparing two variants: one judge scores both sets in one pass on one scale, blind to
  which set is which.

**Steps:**

1. **Frame.** Name the variant under test and the behaviour that counts as success. Write
   the rubric (three to six concrete criteria) for the judge only.
2. **Set up clean environments.** One folder per candidate in the scratchpad, with the
   variant in place and the context a real task would have: a project skeleton, the
   skills a candidate would naturally read.
3. **Write one real-looking prompt**, what the operator would type, with no hint of what
   is measured.
4. **Spawn N candidates** on different models, as in the `arena` skill's Phase B, each in
   its own folder, with the same prompt.
5. **Spawn one blinded judge** on another model, as in `arena`'s Phase C. It sees the
   outputs by label and the rubric, never a model name.
6. **Check the chain from the transcripts, not from self-report.** Each subagent's
   transcript is under this session's `~/.claude/projects/<slug>/<uuid>/subagents/`.
   See which files each candidate actually opened, and grade from that and the code's
   shape.
7. **Read every output yourself**, end to end, and compare with the judge. Disagreement
   means a model is biased or the rubric is ambiguous. Synthesize.

**Reply:** the variant under test, the rubric, notes per candidate, the judge's verdict,
your synthesis, and whether to keep the variant.
