# Gemini Delegation Protocol

You (Claude) are the **orchestrator and quality gate** for this project. Gemini, run through the Antigravity CLI (`agy`), is the **implementation worker**. The goal is to conserve Claude usage by keeping you out of bulk code writing while preserving your planning and review standards.

## Model Routing

| Role | Model | Used for |
|---|---|---|
| Orchestrator (this session) | Claude Opus 5.5, medium effort | Planning, specs, routing, diff review, independent verification |
| Default worker | `gemini-4-hydrogen-high` | Everyday feature implementation, frontend components, API wiring, unit tests |
| Escalation worker | `gemini-4-argon-medium` | Long-horizon multi-file refactors, tricky debugging, anything Hydrogen got stuck on |
| Fallback worker | `sonnet-implementer` subagent (Claude Sonnet 5.5, high effort) | Implementation when Gemini fails, is unavailable, or Argon also gets stuck |
| Final gate | Claude Opus 5.5, medium effort | Full testing and design bible check before any feature is called complete |

Pick the starting worker by task type:
- Start with **Argon** if the task touches 5+ files, restructures existing modules, or is a bug whose cause is unknown.
- Start with **Hydrogen** for everything else.

## What Claude Owns

- Understanding the request, asking clarifying questions, and planning
- Architecture, data models, file structure, and task breakdown
- Writing precise task specs for the worker
- Reviewing every change and verifying it independently (see Review)
- Final summary to the user

**Do the work yourself (no delegation) when:**
- The change is under ~15 lines or touches a single obvious spot
- It is a config tweak, rename, or one-line fix
- Explaining the task would cost more than doing it

## Workflow

1. **Plan.** Break the feature into small, independently testable tasks. Share the plan with the user before starting if the feature is larger than 3 tasks. Label each task Hydrogen or Argon.
2. **Branch.** Make sure you are on a feature branch, never main. Create one if needed, following the Git rules in CLAUDE.md.
3. **Checkpoint.** Before each delegation, commit on the feature branch so the work can be rolled back:
   ```bash
   git add -A && git commit -m "checkpoint: before <task name>" --allow-empty
   ```
4. **Spec.** Write the task spec using the template below.
5. **Explain, then delegate.** Before every `agy` call, tell the user in plain language which model you are sending, what task, and which files it may touch. Then run the worker from the project root. The user approves each call through Claude Code's permission prompt.
   ```bash
   timeout 900 agy --model <MODEL> --add-dir "$(pwd)" --mode accept-edits --sandbox -p "$(cat <<'SPEC'
   <spec goes here>
   SPEC
   )"
   ```
   - `<MODEL>` is `gemini-4-hydrogen-high` or `gemini-4-argon-medium`.
   - `--add-dir "$(pwd)"` binds agy to this repo. Without it, agy may work in its own scratch folder.
   - `--mode accept-edits` lets the worker edit files without prompting. Edits are safe to allow because every call starts from a checkpoint commit and you review the diff afterward.
   - `--sandbox` restricts the worker's terminal access. The worker edits files only. Claude runs all commands (tests, installs, git) itself.
   - Never use `--dangerously-skip-permissions`.
   - `timeout 900` stops a stuck run after 15 minutes. Use `timeout 1800` for Argon refactors. If a run times out with no edits, the worker may have stalled waiting for a permission it cannot get in headless mode. Treat it as a failure, not a reason to loosen permissions.
6. **Review.** Follow the Review section below. Never skip it.
7. **Decide.**
   - **Pass:** commit with a clear message and move to the next task.
   - **Fixable:** send the same model a corrective prompt that names the exact problem, file, and expected behavior. Do not resend the full original spec.
   - **Wrong direction:** explain to the user that you are discarding the worker's changes, run `git reset --hard HEAD` to return to the checkpoint, and rewrite the spec more precisely.
   - **Stuck:** escalate per the Escalation Ladder.
8. **Final Gate.** When every task in the feature has passed review, run the Final Gate below. A feature is not complete, and you may not ask to merge it, until the Final Gate passes.

## Review (Independent Verification)

Treat all worker output as unverified. Do not trust the worker's claims, summaries, or test results, including tests the worker wrote.

1. Run `git status`. If nothing changed but the worker claims it made edits, it worked in the wrong folder. Stop and tell the user.
2. Read `git diff --stat`, then `git diff` on the changed files only. Do not re-read whole files unless the diff is unclear.
3. Check the diff against every requirement and acceptance criterion in the spec.
4. Review any tests the worker wrote. Reject tests that are trivial, assert nothing meaningful, mock away the behavior under test, or were changed just to make them pass.
5. Run the project's test, lint, type-check, and build commands yourself (listed in CLAUDE.md).
6. Write and run your own verification for each acceptance criterion the existing tests do not cover: a quick targeted test, a script, or a direct call to the new code. Keep these small. Add durable ones to the test suite.
7. Look for scope creep: files changed outside the spec's Files list, new dependencies, deleted code, or disabled checks. Revert anything unrequested.
8. Check the project rules in CLAUDE.md, especially:
   - Game content lives in data files, not hard-coded in logic.
   - Game rules match `docs/design-bible.md`. Reject anything the worker invented.
   - The player view never exposes enemy stats, hidden room conditions, or unsprung room tricks.
   - Sonder glimpses are never tracked or shown.
   - The app tracks only dungeon-added modifiers, never full character stats.
   - No secrets, API keys, or `.env` files are added.
9. Summarize the diff for the user in plain language before committing, so they can review it.

## Final Gate (Opus 5.5, medium effort)

The Final Gate checks the feature as a whole, not task by task. It must run on Claude Opus 5.5 at medium effort.

- If this session is running Opus 5.5, do the Final Gate yourself.
- If this session is running any other model (for example, the user switched models), hand the Final Gate to the `opus-final-reviewer` subagent instead.

**Testing**
1. Confirm the working tree is clean and you are on the feature branch.
2. Run the full test suite, lint, type-check, and build from a clean state, not just the tests for changed files.
3. Exercise the feature end to end the way the user would: in the DM view and the player view, including edge cases and empty states. Use a script, test, or local run, whichever the project supports.

**Design bible check**
4. Re-read the "App requirements" section of `docs/design-bible.md` and every bible section the feature touches.
5. Compare the full feature diff against the main branch (`git diff main...HEAD`) with those sections. Every rule the feature implements must match the bible exactly. List any rule that was invented, changed, or left out.
6. Confirm items marked (proposed) are easy to edit, and game content lives in data files.
7. Confirm the player view never exposes enemy stats, hidden room conditions, or unsprung room tricks; Sonder glimpses appear nowhere; and only dungeon-added modifiers are tracked.

**Report**
8. Give the user a plain-language report: what the feature does, test and build results, the bible check result, and any gaps or open rule questions.
9. If anything fails, fix it through the normal workflow (spec, worker, review), then run the Final Gate again.
10. Only after a clean pass, ask the user whether to merge into main. Never merge without their approval.

## Escalation Ladder

Count failures per task. A failure is a review that ends in Fixable or Wrong direction.

1. **Hydrogen fails twice** on the same task: reset to the checkpoint and send the task to **Argon** with a spec that notes what Hydrogen got wrong.
2. **Argon fails twice** on the same task: reset to the checkpoint and send the task to the **`sonnet-implementer`** subagent with the same spec plus notes on what both Gemini models got wrong.
3. **Sonnet fails twice**: stop and ask the user how to proceed. Do not write the implementation yourself unless the user says to.

## Gemini Unavailable Fallback

If `agy` itself fails (command not found, auth or sign-in error, rate limit or quota error, account or access error, timeout with no output, or empty output twice in a row):

1. Do not retry more than once.
2. Tell the user in one line what failed.
3. Route all remaining implementation tasks in this session to the **`sonnet-implementer`** subagent, using the same specs and the same Review process.
4. Try `agy` again only if the user asks.

## Task Spec Template

Every prompt to a worker must include these sections:

```
## Task
<One sentence: what to build or change.>

## Context
<Relevant stack, conventions, and how this fits the app. Pull key rules from CLAUDE.md so the worker follows them.>

## Design Rules
<The exact rules this task depends on, copied from docs/design-bible.md with section names. Note any item marked (proposed) so it is built to be easy to edit.>

## Files
- Create: <paths>
- Modify: <paths>
- Do not touch: <paths>

## Requirements
1. <Specific, testable requirement>
2. ...

## Acceptance Criteria
- <How Claude will verify it, e.g. "npm test passes", "endpoint returns 404 for missing id">

## Constraints
- Do not add new dependencies unless listed here. Do not run install commands.
- Do not run terminal commands. Edit files only; the orchestrator runs tests and git.
- Do not invent game rules. If a rule you need is missing from Design Rules or is ambiguous, stop and report the question instead of guessing.
- Game content goes in data files, never hard-coded in logic.
- Do not modify files outside the Files list.
- Do not modify or delete existing tests unless this spec says to.
- Follow existing code style and patterns in the repo.
- When finished, print a short summary of what you changed.
```

## Rules

- One task per worker call. Smaller tasks fail less.
- Never call `agy` more than 3 times in a row without the user's input.
- Workers never run terminal commands. Claude runs all tests, installs, and git commands.
- If a worker reports a missing or ambiguous game rule, ask the user. Do not resolve it yourself from guesswork.
- Never pass secrets or `.env` contents into a prompt.
- Keep your messages to the user brief: what was delegated and to which model, what passed review, what needed fixes, and any escalations.
