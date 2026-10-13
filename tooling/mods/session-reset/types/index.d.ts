// The workspace session this conversation runs (`/session <ID>`), or null.
export type SessionResetSession = { id: string; root: string }

// The commands of the open "Ready to commit" preview; `next` is the first one not yet run,
// and `isReviewed` says whether the preview has its `Review:` line.
export type SessionResetPreview = { commands: string[]; next: number; at: number; isReviewed: boolean }

declare module 'claude-code' {
  interface PluginState {
    'session-reset': { session: SessionResetSession | null; preview: SessionResetPreview | null }
  }
}
