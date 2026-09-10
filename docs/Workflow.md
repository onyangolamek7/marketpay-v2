# Git Branching Workflow

## Branches
- main → Production-ready code
- develop → Integration/testing branch
- feature/* → Individual features branched from develop

## Workflow
1. Branch from develop: `git checkout -b feature/user-auth develop`
2. Commit & push feature: `git push -u origin feature/user-auth`
3. Merge feature to develop: `git checkout develop` → `git merge feature/user-auth`
4. Merge develop to main after testing: `git checkout main` → `git merge develop`