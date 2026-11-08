# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project status

This repository is newly initialized: it contains only a placeholder `README.md` and a Node.js-template `.gitignore`. There is no source code, package manifest, build, lint, or test setup yet. When those are added, update this file with the actual commands and architecture.

## Git rules

- Never commit directly to `main`. Create a branch for each feature or fix.
- Commit after each change that works, with a clear one-line message.
- Commit before any risky refactor so there's a clean restore point.
- Never commit API keys, passwords, or `.env` files.
- Ask before merging into `main`, deleting branches, or force-pushing.
