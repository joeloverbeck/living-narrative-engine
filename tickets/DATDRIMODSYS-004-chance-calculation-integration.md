# DATDRIMODSYS-004: Integrate ChanceCalculationService with Multi-Target Modifiers

## Summary

Update `ChanceCalculationService.js` to pass secondary and tertiary target IDs to the modifier collection system, enabling modifiers that depend on multiple targets. Also expose active modifier tags in the display result for template rendering.

## File List

Files to modify:
- `src/combat/services/ChanceCalculationService.js` (update method signatures and calls)

## Out of Scope

- **DO NOT** modify `ModifierCollectorService.js` (that's DATDRIMODSYS-003)
- **DO NOT** modify `ModifierContextBuilder.js` (that's DATDRIMODSYS-002)
- **DO NOT** modify any schema files (that's DATDRIMODSYS-001)
- **DO NOT** modify `MultiTargetActionFormatter.js` (that's DATDRIMODSYS-005)
- **DO NOT** add integration tests (that's DATDRIMODSYS-007)
- **DO NOT** modify any action JSON files

## Detailed Implementation

### 1. Update `calculateForDisplay` Method

Add secondary and tertiary target parameters and pass them to modifier collection:

```javascript
/**
 * Calculate chance for action discovery display
 *
 * @param {object} params
 * @param {string} params.actorId - Actor entity ID
 * @param {string} [params.primaryTargetId] - Primary target entity ID (for opposed checks)
 * @param {string} [params.secondaryTargetId] - Secondary target entity ID
 * @param {string} [params.tertiaryTargetId] - Tertiary target entity ID
 * @param {object} params.actionDef - Action definition with chanceBased config
 * @returns {DisplayResult}
 */
calculateForDisplay({ actorId, primaryTargetId, secondaryTargetId, tertiaryTargetId, actionDef }) {
  this.#logger.debug(
    `ChanceCalculationService: Calculating display chance for ${actionDef?.id ?? 'unknown'}`
  );

  const chanceBased = actionDef?.chanceBased;
  if (!chanceBased?.enabled) {
    return {
      chance: 100,
      displayText: '',
      breakdown: { reason: 'Action is not chance-based' },
      activeTags: [],
    };
  }

  // 1. Resolve skills
  const actorSkill = this.#skillResolverService.getSkillValue(
    actorId,
    chanceBased.actorSkill?.component,
    chanceBased.actorSkill?.default ?? 0
  );

  let targetSkillValue = 0;
  if (
    chanceBased.contestType === 'opposed' &&
    chanceBased.targetSkill &&
    primaryTargetId
  ) {
    const targetSkill = this.#skillResolverService.getSkillValue(
      primaryTargetId,
      chanceBased.targetSkill.component,
      chanceBased.targetSkill.default ?? 0
    );
    targetSkillValue = targetSkill.baseValue;
  }

  // 2. Collect modifiers (now with all target roles)
  const modifierCollection = this.#modifierCollectorService.collectModifiers({
    actorId,
    primaryTargetId,
    secondaryTargetId,
    tertiaryTargetId,
    actionConfig: chanceBased,
  });

  // 3. Calculate probability
  const calculation = this.#probabilityCalculatorService.calculate({
    actorSkill: actorSkill.baseValue,
    targetSkill: targetSkillValue,
    difficulty: chanceBased.fixedDifficulty ?? 0,
    formula: chanceBased.formula ?? 'ratio',
    modifiers: modifierCollection,
    bounds: chanceBased.bounds ?? { min: 5, max: 95 },
  });

  const roundedChance = Math.round(calculation.finalChance);

  // Extract active tags from modifiers
  const activeTags = this.#extractActiveTags(modifierCollection.modifiers);

  return {
    chance: roundedChance,
    displayText: `${roundedChance}%`,
    activeTags,
    breakdown: {
      actorSkill: actorSkill.baseValue,
      targetSkill: targetSkillValue,
      baseChance: calculation.baseChance,
      finalChance: calculation.finalChance,
      modifiers: modifierCollection.modifiers ?? [],
      formula: chanceBased.formula ?? 'ratio',
    },
  };
}
```

### 2. Update `resolveOutcome` Method

Update to use consistent parameter naming:

```javascript
/**
 * Resolve outcome for rule execution
 *
 * @param {object} params
 * @param {string} params.actorId - Actor entity ID
 * @param {string} [params.primaryTargetId] - Primary target entity ID (for opposed checks)
 * @param {string} [params.secondaryTargetId] - Secondary target entity ID
 * @param {string} [params.tertiaryTargetId] - Tertiary target entity ID
 * @param {object} params.actionDef - Action definition with chanceBased config
 * @param {number} [params.forcedRoll] - For testing determinism (1-100)
 * @returns {OutcomeResult}
 */
resolveOutcome({ actorId, primaryTargetId, secondaryTargetId, tertiaryTargetId, actionDef, forcedRoll }) {
  this.#logger.debug(
    `ChanceCalculationService: Resolving outcome for ${actionDef?.id ?? 'unknown'}`
  );

  const chanceBased = actionDef?.chanceBased;
  if (!chanceBased?.enabled) {
    // Non-chance actions always succeed
    return {
      outcome: 'SUCCESS',
      roll: 0,
      threshold: 100,
      margin: -100,
      modifiers: [],
      activeTags: [],
      isCritical: false,
    };
  }

  // Calculate chance (reuse display calculation logic)
  const displayResult = this.calculateForDisplay({
    actorId,
    primaryTargetId,
    secondaryTargetId,
    tertiaryTargetId,
    actionDef,
  });

  // Determine outcome
  const thresholds = chanceBased.outcomes ?? {
    criticalSuccess: 5,
    criticalFailure: 95,
  };

  const outcome = this.#outcomeDeterminerService.determine({
    finalChance: displayResult.chance,
    thresholds,
    forcedRoll,
  });

  return {
    outcome: outcome.outcome,
    roll: outcome.roll,
    threshold: displayResult.chance,
    margin: outcome.margin,
    modifiers: displayResult.breakdown.modifiers ?? [],
    activeTags: displayResult.activeTags,
    isCritical: outcome.isCritical,
  };
}
```

### 3. Add Helper Method for Tag Extraction

Add a private method to extract tags from active modifiers:

```javascript
/**
 * Extracts active tags from modifiers for display
 *
 * @private
 * @param {Array<Modifier>} modifiers - Active modifiers
 * @returns {string[]} - Array of tag strings
 */
#extractActiveTags(modifiers) {
  if (!modifiers || modifiers.length === 0) {
    return [];
  }

  return modifiers
    .filter((mod) => mod.tag && mod.tag.trim().length > 0)
    .map((mod) => mod.tag);
}
```

### 4. Backward Compatibility Wrapper (Optional)

If existing callers use `targetId` instead of `primaryTargetId`, add parameter aliasing:

```javascript
calculateForDisplay({ actorId, targetId, primaryTargetId, secondaryTargetId, tertiaryTargetId, actionDef }) {
  // Support legacy targetId parameter
  const resolvedPrimaryTargetId = primaryTargetId ?? targetId;
  // ... rest of implementation uses resolvedPrimaryTargetId
}
```

## Acceptance Criteria

### Tests That Must Pass

1. **Unit Tests** (update existing or create):
   - File: `tests/unit/combat/services/ChanceCalculationService.test.js`
   - Test cases:
     - `should pass primaryTargetId to modifier collector`
     - `should pass secondaryTargetId to modifier collector`
     - `should pass tertiaryTargetId to modifier collector`
     - `should extract active tags from modifiers`
     - `should return empty activeTags when no modifiers have tags`
     - `should include activeTags in display result`
     - `should include activeTags in outcome result`
     - `should support legacy targetId parameter (backward compatibility)`

2. **Existing Tests**:
   - `npm run test:unit -- --testPathPattern="combat" --silent` must pass
   - `npm run typecheck` must pass

### Invariants That Must Remain True

1. **Backward Compatibility**:
   - Existing callers using `targetId` parameter must continue to work
   - Actions without modifiers must return empty `activeTags` array
   - Non-chance-based actions must return empty arrays

2. **Result Structure**:
   - `DisplayResult` must always include `activeTags: string[]`
   - `OutcomeResult` must always include `activeTags: string[]`
   - Tags must be strings, not null/undefined

3. **No Breaking Changes**:
   - `chance` calculation must produce same results
   - `breakdown` structure must remain unchanged
   - `outcome` determination must be unaffected

## Verification Commands

```bash
# Run unit tests for combat services
npm run test:unit -- --testPathPattern="combat/services/ChanceCalculationService" --silent

# Check types
npm run typecheck

# Lint modified files
npx eslint src/combat/services/ChanceCalculationService.js
```

## Dependencies

- **Depends on**: DATDRIMODSYS-003 (ModifierCollectorService must accept multi-target params)
- **Blocks**: DATDRIMODSYS-005 (Tag display needs activeTags from this service)

## Notes

- The `activeTags` array preserves order of modifiers (may be useful for UI display)
- Empty tags and whitespace-only tags are filtered out
- The backward compatibility for `targetId` → `primaryTargetId` is optional but recommended
- The `DisplayResult` and `OutcomeResult` types should be updated in JSDoc if defined elsewhere
