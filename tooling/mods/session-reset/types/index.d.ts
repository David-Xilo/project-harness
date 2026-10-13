// The workspace session this conversation runs (`/session <ID>`), or null.
export type SessionResetSession = { id: string; root: string }

// The commands of the open "Ready to commit" preview; `next` is the first one not yet run,
// and `isReviewed` says whether the preview has its `Review:` line.
export type SessionResetPreview = { commands: string[]; next: number; at: number; isReviewed: boolean }

// Autopilot in the workspace session `id` (AUTOPILOT.md): it approves the session's clean
// previews until the commit of `target` (or, with none, the session's `reached` checkpoint
// row) or `max` approved commits; `count` is how many it approved.
export type SessionResetAutopilot = { id: string; target: string | null; max: number; count: number }

declare module 'claude-code' {
  interface PluginState {
    'session-reset': {
      session: SessionResetSession | null
      preview: SessionResetPreview | null
      autopilot: SessionResetAutopilot | null
    }
  }
}
