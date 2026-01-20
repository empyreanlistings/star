#!/bin/bash
export GIT_TERMINAL_PROMPT=0
git add .
git commit -m "Fix: Remove CSS !important to allow avatar visibility toggling (v3.78)" || echo "Commit failed or no changes"
git push star main
