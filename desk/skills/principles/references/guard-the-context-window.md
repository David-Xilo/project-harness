# Guard the Context Window

**Rule:** Apply when context is filling up: large outputs, long files, repeated reads, fan-out planning. Route bulk to subagents; keep summaries in the main thread, not raw payloads.

**Why:** Context overflow degrades reasoning quality, creates compression artifacts, and halts progress.

**Pattern:**
- **Size phases and cap scope.** Limit files per phase, set turn budgets, account for mechanism costs.
- **Send bulk reads to a subagent.** A sweep over many files, a long log or a transcript
  goes to an Explore or general-purpose agent, which returns file pointers and a summary.
- **Read the slice you need.** A file's headings first, then the section; `grep` before
  `cat`.
- **Don't repeat what is already in context.** Use what an earlier read established
  instead of reading it again.
