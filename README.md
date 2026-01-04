# Template Scoring Portal (GitHub-only)

This portal uses GitHub Issues + Comments as the source of truth and generates an aggregate scoreboard for mobile-friendly viewing on GitHub Pages.

## How it works
1) Create a GitHub Issue with label `template-idea`
2) Reviewers comment `Score: X` (0–5)
3) GitHub Actions aggregates scores into `data/summary.json`
4) GitHub Pages displays the summary dashboard

## Setup
1) Create labels in your repo:
   - template-idea
2) Enable GitHub Pages:
   - Settings → Pages → Deploy from a branch → `main` / `/ (root)`

## Scoring
Core question: **Do I want to create this effect too?**
Comment format: `Score: 0` ... `Score: 5`

Priority rule A:
- P0: avg >= 4.0
- P1: 3.5–3.9
- P2: 3.0–3.4
- P3: < 3.0

## Notes
- This dashboard is read-only.
- All data is stored in GitHub (issues/comments + generated summary.json).
