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

// The operator steps pane: open entries and each workspace's checkpoint line.
export type WorkspaceOps = { rows: WorkspaceOpsRow[]; checkpoints: { workspace: string; text: string }[]; at: number; error: string | null }

declare module 'claude-code' {
  interface PluginState {
    workspace: { band: WorkspaceBand | null; ops: WorkspaceOps | null; showLater: boolean }
  }
}
