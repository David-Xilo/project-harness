# Runtime forensics

**You own the diagnosis. Instrument the live process; don't theorize from the source.**
The deliverable is a cited diagnosis, not a fix.

1. Capture the live signal on its surface: a CPU profile for a spinning process, a heap
   snapshot for a leak, a trace for a visual glitch (`node --inspect`, the browser tools,
   the runtime's own profiler). A real artifact, not a guess.
2. Reduce the artifact to the smoking gun: the function on the hot path, the retainer
   chain from the leaked object to a GC root, the loop that fires with no input. Parse a
   large artifact in a subagent (`guard-the-context-window`) and keep only the reduced
   finding here.
3. Prove the mechanism before believing it. Inject instrumentation into the running
   process, or patch the live code without a reload, to confirm it cheaply.
4. Map the finding back to the source: the file, the symbol, the line that allocates or
   schedules.
5. The throughput checkpoint is one line: `throughput checkpoint: n/a, read-only forensics`.

**Reply:** the signal captured, the reduced finding, how you proved the mechanism, the
source location and the artifact paths. No fix unless asked; hand back to Bug fix or
Perf issue once the cause is known.
