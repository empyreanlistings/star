#!/bin/bash
export GIT_TERMINAL_PROMPT=0
git add .
git commit -m "Feat: Add Matrix-inspired loading animation to hero (v3.79)" || echo "Commit failed or no changes"
git push star main
