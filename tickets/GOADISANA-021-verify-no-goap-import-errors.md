# GOADISANA-021: Verify No GOAP Import Errors

## Context

After removing all GOAP services, tokens, registrations, tests, and documentation, we must verify that no broken imports or unresolved references remain in the codebase. This ticket ensures TypeScript compilation succeeds and searches for any remaining GOAP references.

**Fatal Flaw Context**: With all GOAP services removed, any remaining imports would cause module resolution errors. This verification ensures clean removal.

## Objective

Verify TypeScript compilation succeeds and search for any remaining unintended GOAP references in the codebase.

## Files Affected

**No files modified** - verification only

## Detailed Steps

1. **Run TypeScript type checking**:
   ```bash
   npm run typecheck
   ```
   - Must complete without errors
   - Any import errors indicate missed cleanup

2. **Search for GOAP token references**:
   ```bash
   grep -r "goapTokens" src/ > tickets/verification-goap-tokens.txt
   cat tickets/verification-goap-tokens.txt
   ```
   - Should return EMPTY or only comments

3. **Search for GOAP interface references**:
   ```bash
   grep -r "IGoalManager\|ISimplePlanner\|IPlanCache\|IEffectsGenerator\|IEffectsAnalyzer\|IEffectsValidator\|IGoalStateEvaluator\|IActionSelector\|IAbstractPreconditionSimulator" src/ > tickets/verification-goap-interfaces.txt
   cat tickets/verification-goap-interfaces.txt
   ```
   - Should return EMPTY or only comments

4. **Search for planning effects references**:
   ```bash
   grep -r "planningEffects" src/ data/ > tickets/verification-planning-effects.txt
   cat tickets/verification-planning-effects.txt
   ```
   - Should return EMPTY

5. **Search for goap directory imports**:
   ```bash
   grep -r "from.*['\"].*goap/" src/ > tickets/verification-goap-imports.txt
   cat tickets/verification-goap-imports.txt
   ```
   - Should return EMPTY

6. **Check for registerGoapServices references**:
   ```bash
   grep -r "registerGoapServices" src/ > tickets/verification-register-goap.txt
   cat tickets/verification-register-goap.txt
   ```
   - Should return EMPTY

7. **Document findings**:
   - Create summary of verification results
   - Note any unexpected references found
   - Confirm clean removal or identify additional cleanup needed

## Acceptance Criteria

- [ ] `npm run typecheck` completes successfully with no errors
- [ ] No `goapTokens` imports found in src/
- [ ] No GOAP interface references found (or only in comments)
- [ ] No `planningEffects` references found
- [ ] No `goap/` directory imports found
- [ ] No `registerGoapServices` references found
- [ ] Verification results documented in `tickets/verification-*.txt` files
- [ ] Summary of findings created

## Dependencies

**Requires ALL previous tickets completed**:
- GOADISANA-001 through GOADISANA-020

**Blocks**:
- GOADISANA-022 (build verification)

## Verification Commands

```bash
# TypeScript compilation
npm run typecheck 2>&1 | tee tickets/typecheck-output.txt
echo "Exit code: $?"
# Exit code should be 0

# Count GOAP references
echo "GOAP token references: $(grep -rc "goapTokens" src/ | grep -v ":0" | wc -l)"
echo "GOAP interface references: $(grep -rc "IGoalManager\|ISimplePlanner" src/ | grep -v ":0" | wc -l)"
echo "Planning effects references: $(grep -rc "planningEffects" src/ data/ | grep -v ":0" | wc -l)"

# View verification files
cat tickets/verification-*.txt

# Check for any files in removed directories (should error)
ls src/goap/ 2>&1
ls tests/unit/goap/ 2>&1
ls tests/integration/goap/ 2>&1
# All should show "No such file or directory"
```

## Expected Outcomes

**Clean Removal**:
- TypeScript compilation: SUCCESS (exit 0)
- GOAP token references: 0
- GOAP interface references: 0
- Planning effects references: 0
- Import errors: NONE

**Acceptable Findings**:
- Comments mentioning GOAP (historical context)
- Git history references (preserved intentionally)
- Backup files in tickets/ directory

**Unacceptable Findings** (require additional cleanup):
- Active imports from removed files
- Token references in production code
- Broken module resolution
- Type errors from missing types

## If Issues Found

**Scenario: Broken imports detected**
1. Identify the importing file
2. Determine why import wasn't caught earlier
3. Create follow-up cleanup task
4. Fix imports before proceeding

**Scenario: Unexpected GOAP references**
1. Analyze context (code vs comment)
2. If code: remove reference
3. If comment: evaluate if should be updated or preserved
4. Document decision

## Notes

- This is the first verification gate in Phase 7
- Must pass before proceeding to build verification
- All verification output saved for documentation
- Clean verification confirms successful removal
- Any issues found should be fixed before marking ticket complete
