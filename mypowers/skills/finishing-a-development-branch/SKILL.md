---
name: finishing-a-development-branch
description: Use when implementation is complete, all tests pass, and you need to decide how to integrate the work - guides completion of development work by presenting structured options for merge, PR, or cleanup
---

# Finishing a Development Branch

**Skill 标识**: `finishing-a-development-branch`

其他 skill 通过 `finishing-a-development-branch` 引用本 skill。

## Overview

Guide completion of development work by presenting clear options and handling chosen workflow.

**Core principle:** Verify tests -> Present options -> Execute choice -> Clean up.

**Announce at start:** "I'm using the finishing-a-development-branch skill to complete this work."

## The Process

### Step 1: Verify Tests

**Before presenting options, verify tests pass:**

```bash
# Run project's test suite
npm test / cargo test / pytest / go test ./...
```

**invoke `verification-before-completion`** -- run it now, before claiming tests pass or proceeding.

**If tests fail:** Stop. Don't proceed to Step 2.

**If tests pass:** Continue to Step 2.

### Step 2: Determine Base Branch

```bash
git merge-base HEAD main 2>/dev/null || git merge-base HEAD master 2>/dev/null
```

### Step 3: Present Options

Present exactly these 4 options:

```
Implementation complete. What would you like to do?

1. Merge back to <base-branch> locally
2. Push and create a Merge Request (via spec-commit GitLab workflow)
3. Keep the branch as-is (I'll handle it later)
4. Discard this work

Which option?
```

### Step 4: Execute Choice

#### Option 1: Merge Locally
```bash
git checkout <base-branch>
git pull
git merge <feature-branch>
<test command>
git branch -d <feature-branch>
```

#### Option 2: Push and Create Merge Request
```bash
git push -u origin <feature-branch>
```
Then invoke `spec-commit` Step 7-8 workflow:
- Step 7: Push handling (already done above)
- Step 8: Create Merge Request via GitLab API (extract domain from git remote, read token from ~/.qianliu/config.json, determine target branch, prepare MR description reusing commit message body, call GitLab API)

This ensures MR creation follows the same team standards as regular commits — same AI tags, same structured description template, same GitLab integration.

#### Option 3: Keep As-Is
Report: "Keeping branch <name>. Worktree preserved at <path>."

#### Option 4: Discard
Confirm first, require typed "discard" confirmation.

### Step 5: Cleanup Worktree

For Options 1, 2, 4 -- clean up worktree if applicable.
For Option 3 -- keep worktree.

## Red Flags

**Never:**
- Proceed with failing tests
- Merge without verifying tests on result
- Delete work without confirmation
- Force-push without explicit request

## Integration

**Called by:**
- **subagent-driven-development** - After all tasks complete
- **executing-plans** - After all batches complete

**Pairs with:**
- **using-git-worktrees** - Cleans up worktree created by that skill
