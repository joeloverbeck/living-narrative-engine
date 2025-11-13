# GOADISANA-004: Remove GOAP Core Services Directory

## Context

The GOAP core services represent the heart of the flawed implementation. These services attempted to auto-generate planning effects from execution rules and simulate future world states, which is fundamentally impossible without full execution context.

**Fatal Flaw Details**:
- **effectsGenerator.js**: Tried to extract effects from rule operations, assuming planning==execution
- **effectsAnalyzer.js**: Analyzed operations for planning, but couldn't predict runtime behavior
- **goalStateEvaluator.js**: Evaluated goal states using static conditions, failing with dynamic queries
- **goalManager.js**: Selected goals by priority for a planning model that doesn't work
- **abstractPreconditionSimulator.js**: Attempted to simulate preconditions during planning without execution context
- **actionSelector.js**: Greedy selection based on simulated effects (invalid data)
- **simplePlanner.js**: One-step validation approach that failed due to effect inaccuracy
- **planCache.js**: Cached plans that were based on incorrect effects

## Objective

Remove the entire `src/goap/` directory containing all 9 core GOAP service files.

## Files Affected

**To be REMOVED** (9 files):
- `src/goap/generation/effectsGenerator.js`
- `src/goap/validation/effectsValidator.js`
- `src/goap/analysis/effectsAnalyzer.js`
- `src/goap/goals/goalStateEvaluator.js`
- `src/goap/goals/goalManager.js`
- `src/goap/simulation/abstractPreconditionSimulator.js`
- `src/goap/selection/actionSelector.js`
- `src/goap/planning/simplePlanner.js`
- `src/goap/planning/planCache.js`

## Detailed Steps

1. **Remove GOAP generation directory**:
   ```bash
   rm -rf src/goap/generation/
   ```

2. **Remove GOAP validation directory**:
   ```bash
   rm -rf src/goap/validation/
   ```

3. **Remove GOAP analysis directory**:
   ```bash
   rm -rf src/goap/analysis/
   ```

4. **Remove GOAP goals directory**:
   ```bash
   rm -rf src/goap/goals/
   ```

5. **Remove GOAP simulation directory**:
   ```bash
   rm -rf src/goap/simulation/
   ```

6. **Remove GOAP selection directory**:
   ```bash
   rm -rf src/goap/selection/
   ```

7. **Remove GOAP planning directory**:
   ```bash
   rm -rf src/goap/planning/
   ```

8. **Remove empty parent directory**:
   ```bash
   rmdir src/goap/ 2>/dev/null || rm -rf src/goap/
   ```

9. **Verify complete removal**:
   ```bash
   # Should return empty or "No such file or directory"
   ls src/goap/
   ```

## Acceptance Criteria

- [ ] `src/goap/generation/` directory removed completely
- [ ] `src/goap/validation/` directory removed completely
- [ ] `src/goap/analysis/` directory removed completely
- [ ] `src/goap/goals/` directory removed completely
- [ ] `src/goap/simulation/` directory removed completely
- [ ] `src/goap/selection/` directory removed completely
- [ ] `src/goap/planning/` directory removed completely
- [ ] `src/goap/` parent directory removed (no orphaned subdirectories)
- [ ] `ls src/goap/` returns error or empty result
- [ ] No GOAP service files remain in src/ directory tree
- [ ] Commit message documents all 9 removed files

## Dependencies

**Requires**:
- GOADISANA-001 (historical reference points created)
- GOADISANA-002 (system state validated)
- GOADISANA-003 (dependencies audited)

## Verification Commands

```bash
# Verify src/goap/ doesn't exist
test -d src/goap/ && echo "ERROR: src/goap/ still exists" || echo "OK: src/goap/ removed"

# Search for any remaining goap directories
find src/ -type d -name "*goap*"

# Search for any remaining GOAP service files
find src/ -name "effectsGenerator.js" -o -name "goalManager.js" -o -name "simplePlanner.js"

# Verify no stray GOAP files
ls src/goap/ 2>&1
```

## Expected Errors After This Step

After removing these files, the following WILL FAIL (expected):
- Any imports of GOAP services will cause module resolution errors
- `src/dependencyInjection/registrations/goapRegistrations.js` will fail to import
- `src/dependencyInjection/tokens/tokens-goap.js` references will break
- TypeScript compilation will fail due to missing modules

**This is expected** - subsequent tickets will clean up these references.

## Notes

- This is a destructive operation - files are permanently removed from the working tree
- All files remain accessible in git history and backup branch
- No source code modifications needed - this is pure deletion
- After this step, expect import errors in dependent files (to be fixed in Phase 3)
- Do NOT attempt to fix import errors in this ticket - that's Phase 3's job
