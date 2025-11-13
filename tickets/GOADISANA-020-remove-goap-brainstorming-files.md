# GOADISANA-020: Remove GOAP Brainstorming Files

## Context

The GOAP player implementation design brainstorming document contains exploratory thinking about the GOAP system architecture. While historically interesting, it's no longer relevant to the codebase and can be removed from the working tree (remains in git history).

**Fatal Flaw Context**: Brainstorming explored design decisions for a system attempting to auto-generate planning effects - an approach that proved fundamentally flawed.

## Objective

Remove `brainstorming/goap-player-implementation-design.md` from the working tree while preserving it in git history.

## Files Affected

**To be REMOVED**:
- `brainstorming/goap-player-implementation-design.md`

**Expected Content**:
- GOAP design exploration
- Architecture brainstorming
- Implementation considerations
- Exploratory notes on effects and planning

## Detailed Steps

1. **Verify file exists**:
   ```bash
   test -f brainstorming/goap-player-implementation-design.md && echo "File exists" || echo "File not found"
   ```

2. **Back up brainstorming** (for easy reference):
   ```bash
   cp brainstorming/goap-player-implementation-design.md tickets/removed-goap-brainstorming.md
   ```

3. **Remove the file**:
   ```bash
   rm brainstorming/goap-player-implementation-design.md
   ```

4. **Verify removal**:
   ```bash
   test -f brainstorming/goap-player-implementation-design.md && echo "ERROR: File still exists" || echo "OK: File removed"
   ```

5. **Verify file accessible in git history**:
   ```bash
   git log --all --full-history -- brainstorming/goap-player-implementation-design.md
   # Should show commit history
   ```

## Acceptance Criteria

- [ ] `brainstorming/goap-player-implementation-design.md` removed from working tree
- [ ] File backed up to `tickets/removed-goap-brainstorming.md`
- [ ] File removal verified (file does not exist in working directory)
- [ ] File accessible in git history (verified with git log)
- [ ] Commit message notes historical preservation in git

## Dependencies

**Requires**:
- GOADISANA-017 (test helpers removed)

**Can run in PARALLEL with**:
- GOADISANA-018 (documentation removal)
- GOADISANA-019 (specifications removal)

## Verification Commands

```bash
# Verify file removed from working tree
test -f brainstorming/goap-player-implementation-design.md && echo "FAIL" || echo "PASS"

# Check backup created
cat tickets/removed-goap-brainstorming.md | head -20

# Verify file in git history
git log --all --full-history -- brainstorming/goap-player-implementation-design.md
# Should show commits

# Verify no other goap brainstorming exists
find brainstorming/ -name "*goap*" 2>/dev/null
# Should return empty
```

## Brainstorming Content Lost

The removed file contained:
- Early GOAP architecture explorations
- Design trade-offs considered
- Implementation approach discussions
- Planning system brainstorming

**Impact**: Historical document removed from working tree, preserved in git history

## Git History Preservation

The file remains accessible via:
```bash
# View file from last commit where it existed
git log --all --full-history -- brainstorming/goap-player-implementation-design.md
# Copy commit hash from output
git show <commit-hash>:brainstorming/goap-player-implementation-design.md

# Or checkout from backup branch
git show backup/goap-implementation:brainstorming/goap-player-implementation-design.md
```

## Future Brainstorming

When implementing task-based system:
- Create new brainstorming document for task-based architecture
- Explore task decomposition approaches
- Consider lessons learned from GOAP failure
- Document why task-based is better than effects-based

## Notes

- Brainstorming represents historical design thinking
- File removed from working tree to reduce clutter
- Remains in git history for historical reference
- Backup created for easy access without git commands
- No other code depends on this brainstorming document
- Removal completes documentation cleanup phase
