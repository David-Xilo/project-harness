---
name: ketchup
description: "Catch the operator up on what changed in this chat since their last message, in a few plain sentences and small diagrams, with each call they must make and just enough context to make it. Use for /ketchup, and to end an autopilot run."
---

# Ketchup

Catch the operator up on what changed in this chat since the last message they wrote
before `/ketchup`, so they understand each change, not only where it stands. Notifications,
subagent results and other sessions' messages are not their messages. Assume they
remember their last message and nothing after it.

Use the plain voice of the `unslop` skill ("Say it plainly"): short sentences, no
jargon, like one person catching up another. Say what changed for the operator, not how
you did it: "the tests pass", not "CI is green". Leave out hashes, file paths, commands
and test counts unless the operator needs one to act. Call each commit, PR, session or
agent by a name the operator knows (`S3`, "the band fix"), not one you made up. If a fact
needs context to make sense, give the context or leave the fact out.

## Gather what changed

Keep this turn read-only: no code changes, no apps or jobs started, nothing posted, no
git writes. Collect your own work since that message, the reports of subagents, and
messages from other sessions. Check the current state of each commit, preview, PR, CI run
or session this chat touched (`git log`, `gh`, `opsboard --md` in a workspace). Check each
number you will show against what it comes from, and say so when you correct one.

An action item is a call only the operator can make: an approve of an open preview, a
product choice, an answer to a question, a push or a merge, an irreversible step, or
access you don't have. Include any still waiting, even one raised before their last
message. Work you can still do yourself is not an action item. Never make one up to fill
the reply. A step the operator didn't ask for and the work doesn't need is not an action
item, unless it is irreversible and waiting on them: give it one line, no diagram.

## Write the reply

Keep the reply well under 150 words, diagrams not counted. When something is easier to
grasp as a picture, draw it: how a design or system works, a stack of commits or PRs with
each one's state, a before and after of a fix, or options side by side. Never draw a
status list, or boxes with nothing connecting them. Never give a fact twice. Leave out
work that changed nothing for the operator. When words run short, cut what happened
before you cut action items.

1. Open with one sentence saying how many things need the operator, or that nothing does.
   If nothing happened and nothing waits, say so and stop.
2. Show what happened, pictures first. Then one short bullet per thing the operator
   asked for: what came of it, and whether it is done, running, failed or not checked.
   Write each line as you would say it: "Search was slow because an index was missing",
   not "Search review: done". Name any bug found and fixed on the way. Each line stays
   true read alone. Never mark done something that still waits on the operator. Under
   that, at most three lines that change what the operator knows or must do, then one
   line on the work left that you can do yourself.
3. List the action items as plain bullets, never in a diagram. Two lines each (one for
   an unasked irreversible step): the call with your recommendation and why, then what
   happens if the operator doesn't answer. Put anything that must happen first, and
   anything that can't be undone, in the recommendation. Write "unknown" for what you
   don't know.
4. If a call is a choice, compare the options after the list: what each gets the
   operator and what it costs, with the current state when there is one.

## Diagrams

A diagram is ASCII in a code block, which the terminal shows as is. For a picture that
needs more (a chart, a screenshot), use the `teach` skill's sketch or an artifact, and
link it. A Markdown table is not a diagram.

Keep each one readable at a glance: at most six boxes, at most eight words in each, with
plain labels ("tests pass", not "Tests: PASS"). A fact that needs a sentence goes in the
text, or nowhere. Never invent a number or draw a screen you didn't capture. Link only
files that exist; if a visible change has no screenshot, say "no screenshot yet" and say
what changed on screen.

## At the end of an autopilot run

When an autopilot run ends, the restarted session that names its next step and waits
opens with a ketchup of the whole run (AUTOPILOT.md section 2). It has none of the run in
its context, so it reads the run from the trail (`show-me-your-work`), from its last
`autopilot` row on, and checks it against git. "Since the operator's last message" then
means since that row. The trail's rows (its `start` row, and the corrections the check
adds) are the one write that turn makes.

Adapted from pstack ([license](../LICENSE-pstack)).
