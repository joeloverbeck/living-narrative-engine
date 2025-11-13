# GOADISANA-001: Create Historical Reference Points

## Context

The GOAP (Goal-Oriented Action Planning) system is being completely dismantled due to a fatal architectural flaw. Before removal, we must create historical reference points to preserve the implementation for future analysis and potential recovery if needed.

**Fatal Flaw Summary**: The GOAP system attempted to auto-generate planning effects from execution rules, assuming planning-time filters would match execution-time filters. This failed because:
- Action discovery uses dynamic ScopeDSL queries requiring full world state traversal
- Prerequisites use JSON Logic with runtime-only data
- The planner cannot simulate future action availability without full execution context

## Objective

Create git reference points (tag and backup branch) to preserve the current GOAP implementation state before any removal work begins.

## Files Affected

- Git repository metadata (tags, branches)
- No source files modified

## Detailed Steps

1. **Create git tag for current state**:
   ```bash
   git tag -a goap-before-removal -m "GOAP system state before removal - see reports/goap-dismantling-analysis.md"
   git push origin goap-before-removal
   ```

2. **Create backup branch**:
   ```bash
   git checkout -b backup/goap-implementation
   git push origin backup/goap-implementation
   git checkout main  # or your current branch
   ```

3. **Verify reference points exist**:
   ```bash
   git tag -l | grep goap-before-removal
   git branch -r | grep backup/goap-implementation
   ```

4. **Document reference points**:
   - Add comment to commit message referencing tag and branch
   - Note: dismantling analysis is in `reports/goap-dismantling-analysis.md`

## Acceptance Criteria

- [ ] Git tag `goap-before-removal` exists and points to current HEAD
- [ ] Tag has been pushed to remote repository
- [ ] Backup branch `backup/goap-implementation` created from current state
- [ ] Backup branch has been pushed to remote repository
- [ ] Both reference points are accessible via `git log` and `git branch -r`
- [ ] Verification commands show both tag and branch exist

## Dependencies

**None** - This is the first ticket in the removal sequence.

## Verification Commands

```bash
# Verify tag exists
git tag -l | grep goap-before-removal
git show goap-before-removal --quiet

# Verify backup branch exists locally and remotely
git branch -a | grep backup/goap-implementation

# Verify tag is on remote
git ls-remote --tags origin | grep goap-before-removal

# Verify backup branch is on remote
git ls-remote --heads origin | grep backup/goap-implementation
```

## Notes

- This ticket is non-destructive - it only creates reference points
- All GOAP files remain accessible in the backup branch and tagged commit
- The backup branch should NOT be deleted even after removal is complete
- Historical reports in `reports/` directory will also be preserved in main branch
