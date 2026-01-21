#!/bin/bash
export GIT_TERMINAL_PROMPT=0
git add .
git commit -m "Fix: Refine Matrix loader transition and fix carousel fade-in (v3.80)" || echo "Commit failed or no changes"
git push star main
