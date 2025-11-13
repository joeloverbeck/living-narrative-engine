# GOADISANA-018: Remove GOAP Documentation

## Context

The GOAP documentation describes the architecture, planning system, effects system, operation mapping, and troubleshooting for a system built on the fatal flaw of auto-generating planning effects from rules. This documentation is now obsolete.

**Fatal Flaw Context**: Documentation explains how to use and understand services attempting to simulate planning without execution context - an approach that fundamentally cannot work.

## Objective

Remove the `docs/goap/` directory containing all GOAP system documentation.

## Files Affected

**To be REMOVED** (5 files in `docs/goap/`):
- `README.md` - GOAP system overview
- `planning-system.md` - Planning, goals, action selection documentation
- `effects-system.md` - Effects generation, analysis, runtime documentation
- `operation-mapping.md` - Operation-to-effect mapping documentation
- `troubleshooting.md` - Common issues and solutions

## Detailed Steps

1. **Verify directory exists**:
   ```bash
   test -d docs/goap/ && echo "Directory exists" || echo "Directory not found"
   ```

2. **List files to be removed** (for documentation):
   ```bash
   find docs/goap/ -name "*.md" > tickets/removed-documentation-list.txt
   ```

3. **Remove entire directory**:
   ```bash
   rm -rf docs/goap/
   ```

4. **Verify removal**:
   ```bash
   test -d docs/goap/ && echo "ERROR: Directory still exists" || echo "OK: Directory removed"
   ```

5. **Check for broken links** in other documentation:
   ```bash
   grep -r "docs/goap/" docs/ README.md || echo "No broken links found"
   ```

6. **Update main README** (if it references GOAP docs):
   - Search for GOAP documentation links
   - Remove or update references to removed docs

## Acceptance Criteria

- [ ] `docs/goap/` directory removed completely
- [ ] All 5 documentation files removed
- [ ] List of removed files documented in `tickets/removed-documentation-list.txt`
- [ ] No broken links to GOAP docs in other documentation files
- [ ] Main README updated if it referenced GOAP docs
- [ ] Documentation build succeeds (if applicable)
- [ ] Commit message lists all removed documentation files

## Dependencies

**Requires**:
- GOADISANA-017 (test helpers removed)

**Can run in PARALLEL with**:
- GOADISANA-019 (specifications removal)
- GOADISANA-020 (brainstorming removal)

## Verification Commands

```bash
# Verify directory removed
test -d docs/goap/ && echo "FAIL" || echo "PASS"

# Check file list backup
cat tickets/removed-documentation-list.txt

# Verify no goap directories in docs
find docs/ -name "*goap*"
# Should return empty

# Search for broken links
grep -r "/goap/" docs/ README.md
# Should return empty or be updated

# Check if docs build (if applicable)
npm run docs:build 2>&1 | grep -i error
```

## Documentation Content Lost

The removed documentation covered:

**README.md**:
- GOAP system overview and philosophy
- High-level architecture explanation
- Integration points with game engine

**planning-system.md**:
- Goal selection and prioritization
- Action selection algorithms
- Plan caching strategies

**effects-system.md**:
- Effects generation from rules (the fatal flaw)
- Effects analysis and validation
- Runtime effects application

**operation-mapping.md**:
- How operations map to effects (flawed mapping)
- Conditional effects handling
- Macro expansion for planning

**troubleshooting.md**:
- Common GOAP issues
- Debugging effects generation
- Performance optimization tips

**Impact**: Documentation described flawed system, no loss of valuable information

## Future Documentation

When implementing task-based system:
- Create new `docs/tasks/` directory
- Document task-based architecture (not effects-based)
- Explain task decomposition approach
- Provide troubleshooting for task system

## Notes

- Documentation explained how to use a fundamentally flawed system
- All files remain in git history for reference
- Historical reports in `reports/` directory are PRESERVED (not in this ticket)
- May want to add note to main README explaining GOAP removal
- Documentation removal reduces confusion about system capabilities
