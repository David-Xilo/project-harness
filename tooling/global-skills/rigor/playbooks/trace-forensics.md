# Trace forensics

**You own the diagnosis from the artifact.** Unlike Runtime forensics, the capture already
exists: a fixed dataset to read, not to run again. Keep the tooling generic: a trace
parser for a cpuprofile or `.json.gz`, a text editor for a spindump, heap tooling for a
heap snapshot.

1. Identify the format and load it with the right tool. Parse a large artifact in a
   subagent (`guard-the-context-window`) and keep only the reduced finding here.
2. Turn it into something you can query: load the trace or snapshot into sqlite, one row
   per sample, frame or node, before you read.
3. Narrow to the cause. Query for the frames that hold the most time and walk the call
   tree to the hot path. For a leak, follow the retainer chain to a GC root. For a
   spindump, find the thread stuck on the CPU or blocked, and why.
4. Attribute it to source through the artifact's own symbols. A frame with no source
   mapping is not a diagnosis yet: resolve the symbols, or say the artifact doesn't
   carry them.
5. With a paired capture, diff before against after to confirm. Otherwise mark the
   finding as the strongest hypothesis the artifact supports, not a confirmed cause.
6. Hand back a cited diagnosis, no fix unless asked; route to Bug fix or Perf issue once
   the cause is known. The throughput checkpoint is one line: `throughput checkpoint:
   n/a, read-only forensics`.

**Reply:** the artifact and its format, the reduced finding, the source location, the
artifact paths, and whether a paired capture confirmed it.
