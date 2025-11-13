# GOADISANA-007: Update Base Container Configuration

## Context

The base container configuration calls `registerGoapServices()` to register GOAP services. With the registration file removed, this import and call must be deleted to prevent module resolution errors.

**Fatal Flaw Context**: The container was registering GOAP services that attempted to auto-generate planning effects. With services removed, the registration call must be removed.

## Objective

Remove GOAP service registration import and call from `baseContainerConfig.js`.

## Files Affected

**To be MODIFIED**:
- `src/dependencyInjection/baseContainerConfig.js`

## Detailed Steps

1. **Read the current file**:
   ```bash
   cat src/dependencyInjection/baseContainerConfig.js
   ```

2. **Identify the import to remove**:
   Look for:
   ```javascript
   import { registerGoapServices } from './registrations/goapRegistrations.js';
   ```

3. **Identify the function call to remove**:
   Look for (likely in `createContainer()` function):
   ```javascript
   registerGoapServices(container);
   ```

4. **Remove both lines**:
   - Delete the import statement
   - Delete the function call
   - Preserve all other registrations

5. **Verify file still compiles**:
   ```bash
   npm run typecheck
   ```

## Acceptance Criteria

- [ ] Import statement for `registerGoapServices` removed
- [ ] Function call `registerGoapServices(container)` removed
- [ ] All other imports and registration calls preserved
- [ ] File syntax is valid (no accidental deletions)
- [ ] TypeScript compilation succeeds for this file
- [ ] Container instantiation works (verified in later ticket)
- [ ] Commit message documents the two lines removed

## Dependencies

**Requires**:
- GOADISANA-006 (goapRegistrations.js removed)

**Blocks**:
- GOADISANA-008 (depends on clean DI configuration)

## Verification Commands

```bash
# Verify import removed
grep "registerGoapServices" src/dependencyInjection/baseContainerConfig.js
# Should return empty

# Verify file compiles
npm run typecheck 2>&1 | grep baseContainerConfig
# Should not show errors for this file

# Verify other registrations still present
grep "register" src/dependencyInjection/baseContainerConfig.js
# Should show other registration calls, not GOAP
```

## Expected Changes

**BEFORE**:
```javascript
import { registerGoapServices } from './registrations/goapRegistrations.js';
import { registerOtherServices } from './registrations/otherRegistrations.js';

export function createContainer() {
  const container = new Container();

  registerGoapServices(container);  // ← REMOVE THIS
  registerOtherServices(container);

  return container;
}
```

**AFTER**:
```javascript
// import { registerGoapServices } from './registrations/goapRegistrations.js'; ← REMOVED
import { registerOtherServices } from './registrations/otherRegistrations.js';

export function createContainer() {
  const container = new Container();

  // registerGoapServices(container); ← REMOVED
  registerOtherServices(container);

  return container;
}
```

## Notes

- This is a simple deletion - no logic changes required
- The file structure and other registrations remain intact
- Container creation should still work (verified in Phase 7)
- If other GOAP-related code exists in this file, document it (shouldn't be any)
- Do NOT remove any other registrations or imports
