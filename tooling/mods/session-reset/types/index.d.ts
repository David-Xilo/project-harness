// The workspace session this conversation runs (`/session <ID>`), or null; `since` is when
// it started (ms), kept over its restarts.
export type SessionResetSession = { id: string; root: string; since?: number }

// The turn that runs an approved preview (register.ts), kept by the host so a hot reload
// keeps it.
export type SessionResetApproved = { note: string; writes: number; hasFailed: boolean; hasCommitted: boolean; isExact: boolean }

// The commands of the open "Ready to commit" preview; `next` is the first one not yet run,
// `isReviewed` says whether the preview has its `Review:` line, and `done` lists the steps
// its `Step done:` line says its commit finishes.
export type SessionResetPreview = { commands: string[]; next: number; at: number; isReviewed: boolean; done?: string[] }

// Autopilot in the workspace session `id` at `root` (AUTOPILOT.md): it approves the
// session's clean previews until the commit of `target` (or, with none, the session's
// `reached` checkpoint row) or `max` commits; `count` is how many ran, and `waiting` says
// what the session waits for from the operator, if anything.
export type SessionResetAutopilot = {
  id: string
  root: string
  target: string | null
  max: number
  count: number
  waiting: string | null
}

declare module 'claude-code' {
  interface PluginState {
    'session-reset': {
      session: SessionResetSession | null
      preview: SessionResetPreview | null
      // Why the last answer's commit block opened no preview.
      rejected: string | null
      approved: SessionResetApproved | null
      // Why this turn's approve is held, if it is.
      holding: string | null
      autopilot: SessionResetAutopilot | null
    }
  }
}
