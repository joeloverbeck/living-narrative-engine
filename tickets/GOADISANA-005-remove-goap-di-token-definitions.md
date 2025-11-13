# GOADISANA-005: Remove GOAP DI Token Definitions

## Context

The GOAP dependency injection tokens defined interfaces for GOAP services. With core services removed, these tokens are now orphaned and must be deleted to prevent import errors.

**Fatal Flaw Context**: These tokens defined interfaces for services that attempted to auto-generate planning effects from rules. The services are now gone, so the tokens serve no purpose.

## Objective

Remove the `tokens-goap.js` file containing all GOAP-specific dependency injection token definitions.

## Files Affected

**To be REMOVED**:
- `src/dependencyInjection/tokens/tokens-goap.js`

**Expected Token Exports** (for documentation):
```javascript
export const goapTokens = {
  IEffectsGenerator: 'IEffectsGenerator',
  IEffectsAnalyzer: 'IEffectsAnalyzer',
  IEffectsValidator: 'IEffectsValidator',
  IGoalManager: 'IGoalManager',
  IGoalStateEvaluator: 'IGoalStateEvaluator',
  ISimplePlanner: 'ISimplePlanner',
  IPlanCache: 'IPlanCache',
  IActionSelector: 'IActionSelector',
  IAbstractPreconditionSimulator: 'IAbstractPreconditionSimulator',
};
```

## Detailed Steps

1. **Document tokens being removed** (for reference):
   ```bash
   # Save token list for historical reference
   cat src/dependencyInjection/tokens/tokens-goap.js > tickets/removed-goap-tokens.txt
   ```

2. **Remove the file**:
   ```bash
   rm src/dependencyInjection/tokens/tokens-goap.js
   ```

3. **Verify removal**:
   ```bash
   test -f src/dependencyInjection/tokens/tokens-goap.js && echo "ERROR: File still exists" || echo "OK: File removed"
   ```

## Acceptance Criteria

- [ ] `src/dependencyInjection/tokens/tokens-goap.js` file removed completely
- [ ] Token list documented in `tickets/removed-goap-tokens.txt` for historical reference
- [ ] File removal verified (file does not exist)
- [ ] Commit message lists all 9 removed token definitions
- [ ] No compilation errors from this file (it no longer exists)

## Dependencies

**Requires**:
- GOADISANA-004 (GOAP core services removed)

**Blocks**:
- GOADISANA-006 (registration file imports goapTokens)

## Verification Commands

```bash
# Verify file removed
test -f src/dependencyInjection/tokens/tokens-goap.js && echo "FAIL" || echo "PASS"

# Verify no other tokens-goap files exist
find src/ -name "*tokens-goap*"

# Check that token backup was created
cat tickets/removed-goap-tokens.txt

# Search for any remaining goapTokens references (will find imports in registrations - expected)
grep -r "goapTokens" src/dependencyInjection/
```

## Expected State After This Step

**Import errors will occur** in:
- `src/dependencyInjection/registrations/goapRegistrations.js` (imports goapTokens)
- `src/dependencyInjection/registrations/aiRegistrations.js` (imports goapTokens dynamically)

**This is expected and correct** - these will be fixed in GOADISANA-006 and GOADISANA-008.

## Notes

- This file contained only token definitions (strings), no implementation code
- Removal is safe because all services using these tokens have been removed
- The tokens will remain accessible in git history for reference
- Do NOT attempt to fix import errors in other files - that's handled by later tickets
