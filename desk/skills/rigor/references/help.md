# Rigor help

Answer the user's question about these skills, give them a prompt they can send, and
name the file the answer came from. For a help question, don't start the work: a rigor
run spends real tokens, so let them send the prompt. A message that asks for work ("use
rigor to fix this bug") is not a help question: run `/desk:rigor` on it.

The skills own the details. Read the file you route to before quoting it, and trust it
when it disagrees with this map.

## Start a task

`/desk:rigor` matches the task to a playbook, copies its steps into the todo list, and runs
the other skills as the steps need them. A skipped step stays in the list as
`skip: <reason>`. A good prompt states the goal and how to tell it is done; it doesn't
list skills, because a hand-written order drops or reorders steps the playbook keeps.

## Pick a skill

The default answer is `/desk:rigor`, which runs most of the others when its steps need them.
Name a skill directly when the user wants more or less of something than the playbook
gives.

| The user wants to | Skill |
|---|---|
| Do non-trivial work with rigor | `/desk:rigor` |
| Check the agent understood the goal, and aim the task higher, before it starts | `/desk:sharpen` |
| Know how code works, or where new code should live | `/desk:how` |
| Know why code is this way, or where a number came from | `/desk:why` |
| Understand a change or subsystem, explained plainly | `/desk:how` (teach mode) |
| Catch up on their recent work on a topic | `/desk:recall` |
| Catch up on this chat since their last message | `/desk:recall this chat` |
| Know what a small diff could break outside itself | `/desk:blast-radius` |
| Settle types and module shape before code | `/desk:architect` |
| Get several attempts at one brief, merged into the best | `/desk:arena` |
| Run parallel checks over slices, or race workers | `/desk:swarm` |
| Have two models review a diff and try to break it | `/desk:interrogate` |
| Fix a bug test-first when a cheap test exists | `/desk:tdd` |
| Apply TypeScript rules to `.ts` work | `/desk:typescript-best-practices` |
| Strip comments before review | `/desk:no-comments` |
| Clean AI tells out of prose | `/desk:unslop` |
| Write docs, a commit message or a PR body to a standard | `/desk:technical-writing` |
| Give agents a scripted way to drive a module | `/desk:create-verification-skill` |
| Bring a verify skill back in line with its module | `/desk:maintain-verification-skill` |
| Vet a performance number | `/desk:benchmark-checklist` |
| Run a large change, or one to review after stepping away | `/desk:figure-it-out` |
| Keep a decision trail, and review it afterwards | `/desk:show-me-your-work` |
| Look up an engineering principle | `/desk:principles` |
| Run a maintenance pass on a repository | `/desk:code-cleanup` |
| Turn what a session taught into skill edits | `/desk:reflect` |
| Stop agents repeating the same mistakes | `/desk:reflect correct` |

If a desk skill is missing from the table, read its frontmatter and route by its
description.

Close calls:

- `/desk:how` explains what the code does, `/desk:why` the reasons; "teach me" puts `/desk:how`
  in teach mode, which runs one or both and explains plainly.
- `/desk:arena` gives every worker the same brief and merges the best parts; `/desk:swarm` splits
  the work into slices or a race and returns one report.
- `/desk:architect` implements right after it settles the design; add "with checkpoint" to
  review the design first.
- `/desk:interrogate` reviews the diff; `/desk:blast-radius` looks for breakage outside it. Neither
  replaces `code-review` before a PR.
- `/desk:recall` rebuilds context across recent chats; `/desk:recall this chat` covers only this chat.
  Resuming one chat or branch is the Session pickup playbook.
- `/desk:figure-it-out` designs one rigorous run; a multi-phase plan splits a program into
  PR-sized steps.

Phrases inside `/desk:rigor` that pick a playbook: "take over this branch" (Session pickup),
"pause safely" (Pause safely), "run the eval playbook" (Eval), "turn this into a plan"
(Multi-phase plan).

## Prompts worth copying

Swap in the real paths and done checks. Informal wording works.

- `/desk:sharpen in your own words: <long or messy ask>`
- `/desk:rigor investigate why <symptom>. what we know, what data you used, your best hypotheses. no code changes yet.`
- `use /desk:how to understand <subsystem>, then /desk:why to find out why it broke recently.`
- `/desk:rigor <symptom>. repro first, then fix and verify.`
- `/desk:rigor repro <bug> with the project's verification skill. if there's a cheap test path, /desk:tdd it.`
- `/desk:rigor add <behaviour>. <current output> stays byte-identical. verify both.`
- `/desk:rigor move <code> into one module, no behaviour change. record the output first and prove it unchanged after.`
- `/desk:rigor <operation> takes <time> on <input>. trace it, fix the measured cause, show before and after.`
- `/desk:rigor prototype a few options for <feature>, with screenshots to compare.`
- `/desk:rigor turn this design into a plan: small verifiable steps, each with its check.`
- `/desk:interrogate the whole branch, skeptically. no changes yet, no nitpicks unless it's a real bug.`
- `/desk:swarm check every module against its verify skill. one worker per module, one report.`
- `/desk:show-me-your-work catch me up on what you did.` Read its Attention section first.
- `/desk:reflect capture what we learned so the next run doesn't repeat it.`

## Word the prompt

Put in:

- the goal: what is wrong, or what the user wants;
- the done check, one that can pass or fail ("make it better" and a duration are not);
- the proof to show: the real command output, the flow, the stored value, a before and
  after number;
- what the user already knows: a symptom, a repro step, a log, a link;
- the real constraints: "repro first", "no code changes yet", "no behaviour change",
  "let me review before proceeding".

Leave out the how, a list of skills or steps, and the user's theory of the cause
until the agent has restated the problem: a stated guess narrows the search.

Before stepping away: write done as
checks every iteration can run, give `/loop` that predicate, ask for a trail, and give an
exit ("if you're stuck after a few hours, stop and write up why").

Steer in one line: restate the goal ("I asked for a repro, not a fix yet"), or name the
principle ("apply prove-it-works: show me the real output").

## When a run goes wrong

| Symptom | Fix |
|---|---|
| The mode stopped applying after a few turns | Start each new task with `/desk:rigor` |
| A question was taken as the next step of the last task | Say "new task" |
| Runs cost more than expected | Save `/desk:rigor` for work that needs it; ask for fewer reviewers or `sonnet` workers |
| Parallel agents overwrote each other | Give each its own worktree (`isolation: "worktree"`) or folder |
| An unattended run moved but finished nothing | `/loop` needs a check that can pass or fail, not a duration |
| The reply claims success from a green build | Ask for the real command, flow, value or profile (`prove-it-works`) |
| A skill misbehaved | Fix it in its own commit, not inside the work where it went wrong |
