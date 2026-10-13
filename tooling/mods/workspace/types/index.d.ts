// The band above the prompt: one line, and whether it warns.
export type WorkspaceBand = { text: string; isWarning: boolean }

// One open operator entry, as `opsboard --tsv` reads it from a workspace's operator.md.
export type WorkspaceOpsRow = {
  workspace: string
  kind: 'you' | 'later'
  section: string
  id: string
  title: string
  when: string
  tell: string
  // The track that owns it, where the entry names one (**Owner:**).
  owner: string
  unblocks: string
  // How many step, handoff, session and checkpoint IDs it unblocks.
  weight: number
  line: number
}

// One session of a workspace, as `opsboard --tsv` joins it: its state (reached, ready,
// blocked, idle), next step, ready count, what blocks it, checkpoint row and autopilot.
export type WorkspaceSessionRow = {
  workspace: string
  id: string
  state: string
  next: string
  ready: number
  blockedBy: string
  checkpoint: string
  autopilot: string
}

// The operator steps pane: open entries, each workspace's checkpoint line and sessions.
export type WorkspaceOps = {
  rows: WorkspaceOpsRow[]
  checkpoints: { workspace: string; text: string }[]
  sessions: WorkspaceSessionRow[]
  at: number
  error: string | null
}

declare module 'claude-code' {
  interface PluginState {
    workspace: { band: WorkspaceBand | null; ops: WorkspaceOps | null; showLater: boolean }
  }
}
