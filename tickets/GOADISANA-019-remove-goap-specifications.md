# GOADISANA-019: Remove GOAP Specifications

## Context

The GOAP Tier 1 implementation specification documents the planned implementation of the GOAP system based on the flawed effects-generation approach. This specification is now obsolete and should not be used for future implementation.

**Fatal Flaw Context**: Specification details implementation of a system attempting to auto-generate planning effects from rules - an approach that has been proven fundamentally flawed.

## Objective

Remove the `specs/goap-tier1-implementation.md` specification file.

## Files Affected

**To be REMOVED**:
- `specs/goap-tier1-implementation.md`

**Expected Specification Content**:
- GOAP Tier 1 implementation plan
- Effects generation specifications
- Goal management design
- Planning algorithm details

## Detailed Steps

1. **Verify file exists**:
   ```bash
   test -f specs/goap-tier1-implementation.md && echo "File exists" || echo "File not found"
   ```

2. **Back up specification** (for reference):
   ```bash
   cp specs/goap-tier1-implementation.md tickets/removed-goap-tier1-spec.md
   ```

3. **Remove the file**:
   ```bash
   rm specs/goap-tier1-implementation.md
   ```

4. **Verify removal**:
   ```bash
   test -f specs/goap-tier1-implementation.md && echo "ERROR: File still exists" || echo "OK: File removed"
   ```

5. **Check for references** to this specification:
   ```bash
   grep -r "goap-tier1-implementation" docs/ specs/ README.md || echo "No references found"
   ```

## Acceptance Criteria

- [ ] `specs/goap-tier1-implementation.md` file removed
- [ ] Specification backed up to `tickets/removed-goap-tier1-spec.md`
- [ ] File removal verified (file does not exist)
- [ ] No remaining references to this specification in other files
- [ ] Commit message documents specification removal reason

## Dependencies

**Requires**:
- GOADISANA-017 (test helpers removed)

**Can run in PARALLEL with**:
- GOADISANA-018 (documentation removal)
- GOADISANA-020 (brainstorming removal)

## Verification Commands

```bash
# Verify file removed
test -f specs/goap-tier1-implementation.md && echo "FAIL" || echo "PASS"

# Check backup created
cat tickets/removed-goap-tier1-spec.md | head -20

# Verify no other goap specs exist
find specs/ -name "*goap*"
# Should return empty

# Search for references
grep -r "goap-tier1" . --exclude-dir=.git --exclude-dir=tickets
# Should return only backup file reference
```

## Specification Content Lost

The removed spec detailed:
- Tier 1 implementation goals (basic GOAP functionality)
- Effects generation approach (the fatal flaw)
- Goal selection mechanism
- Simple planning algorithm
- Integration with existing systems

**Impact**: Specification described flawed implementation, should not be followed

## Future Specifications

When implementing task-based system:
- Create new specification for task-based architecture
- Document task decomposition approach (not effects-based)
- Specify task-to-action selection mechanism
- Do NOT reuse GOAP specification patterns

## Notes

- Specification provided implementation guidance for flawed system
- File remains in git history for reference
- DO NOT use this specification as basis for future implementation
- Task-based system needs entirely new specification
- Removal prevents future developers from following flawed approach
