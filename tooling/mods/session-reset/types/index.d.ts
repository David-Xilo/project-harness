// The workspace session this conversation runs (`/session <ID>`), or null.
export type SessionResetSession = { id: string; root: string }

// The commands of the open "Ready to commit" preview; `next` is the first one not yet run.
export type SessionResetPreview = { commands: string[]; next: number; at: number }

declare module 'claude-code' {
  interface PluginState {
    'session-reset': { session: SessionResetSession | null; preview: SessionResetPreview | null }
  }
}
