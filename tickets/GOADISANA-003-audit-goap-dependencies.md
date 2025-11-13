# GOADISANA-003: Audit GOAP Dependencies

## Context

Before removing GOAP code, we must identify all files that import or reference GOAP components to ensure clean removal without broken imports. This comprehensive audit maps the dependency tree.

**Fatal Flaw Summary**: The GOAP system's fatal flaw was attempting to auto-generate effects from rules. During removal, we must identify every reference point to avoid leaving broken imports or orphaned code.

## Objective

Create a comprehensive map of all GOAP dependencies, imports, and references across the codebase to guide systematic removal.

## Files Affected

- No source files modified
- Audit results saved as `tickets/GOADISANA-003-audit-results.txt`

## Detailed Steps

1. **Search for GOAP token imports**:
   ```bash
   grep -r "goapTokens" src/ > tickets/audit-goap-tokens.txt
   grep -r "tokens-goap" src/ >> tickets/audit-goap-tokens.txt
   ```

2. **Search for GOAP service interfaces**:
   ```bash
   grep -r "IGoalManager\|ISimplePlanner\|IPlanCache\|IEffectsGenerator\|IEffectsAnalyzer\|IEffectsValidator\|IGoalStateEvaluator\|IActionSelector\|IAbstractPreconditionSimulator" src/ > tickets/audit-goap-interfaces.txt
   ```

3. **Search for planning effects references**:
   ```bash
   grep -r "planningEffects" src/ data/ > tickets/audit-planning-effects.txt
   ```

4. **Search for GOAP directory imports**:
   ```bash
   grep -r "from.*goap/" src/ > tickets/audit-goap-imports.txt
   grep -r "import.*goap/" src/ >> tickets/audit-goap-imports.txt
   ```

5. **Search for GOAP registration references**:
   ```bash
   grep -r "registerGoapServices\|goapRegistrations" src/ > tickets/audit-goap-registrations.txt
   ```

6. **Search for goal-related references**:
   ```bash
   grep -r "goalLoader\|goal\.schema" src/ > tickets/audit-goal-references.txt
   ```

7. **Consolidate audit results**:
   ```bash
   cat tickets/audit-*.txt > tickets/GOADISANA-003-audit-results.txt
   ```

8. **Create dependency map**:
   - Document files that import GOAP code
   - Document files that will break after GOAP removal
   - Identify files requiring updates (not just removal)

## Acceptance Criteria

- [ ] Complete list of GOAP token references saved
- [ ] Complete list of GOAP interface references saved
- [ ] Complete list of `planningEffects` references saved
- [ ] Complete list of GOAP imports identified
- [ ] Complete list of GOAP registration references saved
- [ ] Goal-related references documented (for preservation decision)
- [ ] Consolidated audit results saved to `tickets/GOADISANA-003-audit-results.txt`
- [ ] Dependency map created showing:
  - Files that import GOAP code (will break)
  - Files that reference GOAP through abstractions (may continue working)
  - Files requiring updates (not just removal)

## Dependencies

**Requires**: GOADISANA-002 (system state validated)

## Verification Commands

```bash
# Verify audit files created
ls -la tickets/audit-*.txt
ls -la tickets/GOADISANA-003-audit-results.txt

# Check audit completeness
wc -l tickets/GOADISANA-003-audit-results.txt

# Verify specific searches found expected files
grep "aiRegistrations.js" tickets/audit-goap-tokens.txt
grep "baseContainerConfig.js" tickets/audit-goap-registrations.txt

# Preview key findings
head -20 tickets/GOADISANA-003-audit-results.txt
```

## Expected Findings

Based on the analysis report, we expect to find:

**Files requiring updates**:
- `src/dependencyInjection/baseContainerConfig.js` - Remove registerGoapServices call
- `src/dependencyInjection/registrations/aiRegistrations.js` - Update IGoapDecisionProvider registration
- `src/turns/providers/goapDecisionProvider.js` - Replace with stub implementation
- `data/schemas/action.schema.json` - Check for planningEffects property

**Files that reference but don't need updates**:
- `src/dependencyInjection/registrations/registerActorAwareStrategy.js` - Routes to providers, works with stub
- `src/turns/factories/actorAwareStrategyFactory.js` - Reads player_type, works with any provider
- `data/mods/core/components/player_type.component.json` - Preserved for future use

## Notes

- This audit is preparation only - no files are modified
- Results guide the systematic removal in subsequent tickets
- Audit files can be committed for documentation purposes
- If unexpected references are found, update removal strategy accordingly
