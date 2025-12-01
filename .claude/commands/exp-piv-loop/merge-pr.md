---
description: Merge PR and return to main branch
argument-hint: [pr-number] (default: current branch's PR)
---

# Merge PR

**PR**: $ARGUMENTS (default: PR for current branch)

---

## Steps

1. Get PR to merge:
   ```bash
   # If no argument, find PR for current branch
   gh pr view --json number,title,state
   ```

2. Merge the PR:
   ```bash
   gh pr merge [NUMBER] --merge --delete-branch
   ```

   Options:
   - `--merge` - Create merge commit
   - `--squash` - Squash commits (alternative)
   - `--delete-branch` - Delete branch after merge

3. Switch to main and pull:
   ```bash
   git checkout main
   git pull origin main
   ```

4. Clean up local branches:
   ```bash
   git branch -d [merged-branch]
   ```

## Output

```
✅ PR #[NUMBER] merged: [TITLE]
📍 Now on main (up to date)
🗑️ Branch [name] deleted
```
