# GOADISANA-006: Remove GOAP Service Registrations

## Context

The `goapRegistrations.js` file registered all GOAP services with the dependency injection container. With services and tokens removed, this registration file is now orphaned.

**Fatal Flaw Context**: This file registered services that attempted to simulate planning effects without execution context. The services are gone, so the registrations must be removed.

## Objective

Remove the `goapRegistrations.js` file that registered GOAP services with the DI container.

## Files Affected

**To be REMOVED**:
- `src/dependencyInjection/registrations/goapRegistrations.js`

**Expected Registration Structure** (for documentation):
```javascript
export function registerGoapServices(container) {
  // Registered 9 GOAP services:
  // - EffectsGenerator
  // - EffectsAnalyzer
  // - EffectsValidator
  // - GoalManager
  // - GoalStateEvaluator
  // - SimplePlanner
  // - PlanCache
  // - ActionSelector
  // - AbstractPreconditionSimulator
}
```

## Detailed Steps

1. **Document registrations being removed** (for reference):
   ```bash
   # Save registration file for historical reference
   cat src/dependencyInjection/registrations/goapRegistrations.js > tickets/removed-goap-registrations.txt
   ```

2. **Remove the file**:
   ```bash
   rm src/dependencyInjection/registrations/goapRegistrations.js
   ```

3. **Verify removal**:
   ```bash
   test -f src/dependencyInjection/registrations/goapRegistrations.js && echo "ERROR: File still exists" || echo "OK: File removed"
   ```

## Acceptance Criteria

- [ ] `src/dependencyInjection/registrations/goapRegistrations.js` removed completely
- [ ] Registration functions documented in `tickets/removed-goap-registrations.txt`
- [ ] File removal verified (file does not exist)
- [ ] Commit message documents removal of 9 service registrations
- [ ] No orphaned registration files in registrations/ directory

## Dependencies

**Requires**:
- GOADISANA-005 (tokens file removed - this file imports tokens-goap)

**Blocks**:
- GOADISANA-007 (baseContainerConfig imports registerGoapServices)

## Verification Commands

```bash
# Verify file removed
test -f src/dependencyInjection/registrations/goapRegistrations.js && echo "FAIL" || echo "PASS"

# Verify no other goap registration files exist
find src/dependencyInjection/registrations/ -name "*goap*"

# Check that registration backup was created
cat tickets/removed-goap-registrations.txt

# Search for remaining registerGoapServices references (will find import in baseContainerConfig - expected)
grep -r "registerGoapServices" src/
```

## Expected State After This Step

**Import error will occur** in:
- `src/dependencyInjection/baseContainerConfig.js` (imports and calls registerGoapServices)

**This is expected and correct** - will be fixed in GOADISANA-007.

## Notes

- This file contained DI registration logic for GOAP services
- Removal is safe because:
  - All services being registered have been removed (GOADISANA-004)
  - All tokens being used have been removed (GOADISANA-005)
- The registration pattern itself was sound, only the services were flawed
- Do NOT fix the import error in baseContainerConfig.js yet - that's GOADISANA-007
