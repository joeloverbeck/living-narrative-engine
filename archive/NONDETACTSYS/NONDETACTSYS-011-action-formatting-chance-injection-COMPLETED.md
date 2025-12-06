# NONDETACTSYS-011: Modify ActionFormattingStage for {chance} Placeholder

## Summary

Modify the `ActionFormattingStage` to detect actions with `chanceBased.enabled: true` and inject calculated probability into the `{chance}` template placeholder. This enables actions to display success probability to players.

## Files to Modify

| File                                                   | Change                           |
| ------------------------------------------------------ | -------------------------------- |
| `src/actions/pipeline/stages/ActionFormattingStage.js` | Add chance calculation injection |

## Files to Create

| File                                                                | Purpose                             |
| ------------------------------------------------------------------- | ----------------------------------- |
| `tests/integration/mods/weapons/swingAtTargetChanceDisplay.test.js` | Integration test for chance display |

## Implementation Details

### ActionFormattingStage Modifications

The stage needs to:

1. **Detect chance-based actions**: Check if `actionDef.chanceBased?.enabled === true`
2. **Calculate probability**: Use services to compute success chance
3. **Inject placeholder**: Replace `{chance}` with calculated percentage

```javascript
// Pseudocode for the modification

class ActionFormattingStage {
  #skillResolverService;
  #probabilityCalculatorService;

  constructor({
    // ... existing dependencies
    skillResolverService,
    probabilityCalculatorService,
  }) {
    // ... existing initialization
    this.#skillResolverService = skillResolverService;
    this.#probabilityCalculatorService = probabilityCalculatorService;
  }

  async process(context) {
    const { actionDef, actorId, targetId, resolvedTargets } = context;

    // Existing formatting logic...
    let formattedTemplate = this.#formatTemplate(
      actionDef.template,
      resolvedTargets
    );

    // NEW: Inject chance if applicable
    if (
      actionDef.chanceBased?.enabled &&
      formattedTemplate.includes('{chance}')
    ) {
      const chance = this.#calculateChance(actionDef, actorId, targetId);
      formattedTemplate = formattedTemplate.replace('{chance}', chance);
    }

    return {
      ...context,
      formattedTemplate,
    };
  }

  #calculateChance(actionDef, actorId, targetId) {
    const { chanceBased } = actionDef;

    // Get actor skill
    const actorSkill = this.#skillResolverService.getSkillValue(
      actorId,
      chanceBased.actorSkill.component,
      chanceBased.actorSkill.default || 0
    );

    // Get target skill (if opposed)
    let targetSkillValue = 0;
    if (chanceBased.contestType === 'opposed' && chanceBased.targetSkill) {
      const targetSkill = this.#skillResolverService.getSkillValue(
        targetId,
        chanceBased.targetSkill.component,
        chanceBased.targetSkill.default || 0
      );
      targetSkillValue = targetSkill.baseValue;
    }

    // Calculate probability
    const result = this.#probabilityCalculatorService.calculate({
      actorSkill: actorSkill.baseValue,
      targetSkill: targetSkillValue,
      difficulty: chanceBased.fixedDifficulty,
      formula: chanceBased.formula || 'ratio',
      bounds: chanceBased.bounds,
    });

    return Math.round(result.finalChance);
  }
}
```

### Template Transformation

Before:

```
"template": "swing {weapon} at {target} ({chance}%)"
```

After formatting:

```
"swing longsword at chicken (55%)"
```

### DI Updates

Add dependencies to ActionFormattingStage constructor and update DI registration if needed.

## Out of Scope

- **DO NOT** modify other pipeline stages
- **DO NOT** implement modifier collection (Phase 5)
- **DO NOT** create new services
- **DO NOT** modify action schema
- **DO NOT** create unit tests (integration test covers this)

## Acceptance Criteria

### Tests That Must Pass

```bash
# Integration test for chance display
npm run test:integration -- --testPathPattern="swingAtTargetChanceDisplay"

# Type checking
npm run typecheck

# Lint
npx eslint src/actions/pipeline/stages/ActionFormattingStage.js

# Full test suite (no regressions)
npm run test:ci
```

### Integration Test Requirements

**Test File**: `tests/integration/mods/weapons/swingAtTargetChanceDisplay.test.js`

Required test cases:

1. **Basic chance injection**
   - Action with `chanceBased.enabled: true`
   - Template contains `{chance}` placeholder
   - Output shows calculated percentage

2. **Opposed skill check display**
   - Actor has melee_skill: 50
   - Target has defense_skill: 25
   - Expected chance ~67%

3. **Missing skill fallback**
   - Actor lacks skill component
   - Uses default value from action definition
   - Displays calculated chance

4. **No chance placeholder**
   - Action has chanceBased enabled
   - Template lacks `{chance}` placeholder
   - No error, template unchanged

5. **Non-chance action unchanged**
   - Action without chanceBased or enabled: false
   - Template with `{chance}` literal (edge case)
   - Template unchanged (or shows placeholder)

### Invariants That Must Remain True

- [ ] All existing action formatting works unchanged
- [ ] Actions without chanceBased continue to format correctly
- [ ] Pipeline stage order is preserved
- [ ] No performance regression in action discovery
- [ ] Dependencies are properly injected
- [ ] Error handling is graceful (missing skills don't break pipeline)

## Dependencies

- **Depends on**:
  - NONDETACTSYS-003 (SkillResolverService)
  - NONDETACTSYS-004 (ProbabilityCalculatorService)
  - NONDETACTSYS-008 (services registered in DI)
  - NONDETACTSYS-009 (action schema with chanceBased)
- **Blocked by**: NONDETACTSYS-003, 004, 008, 009
- **Blocks**: NONDETACTSYS-013 (swing_at_target action needs chance display)

## Reference Files

| File                                                                | Purpose                  |
| ------------------------------------------------------------------- | ------------------------ |
| `src/actions/pipeline/stages/ActionFormattingStage.js`              | File to modify           |
| `src/actions/pipeline/stages/MultiTargetResolutionStage.js`         | Stage pattern reference  |
| `tests/integration/mods/weapons/wieldWeaponActionDiscovery.test.js` | Integration test pattern |

## Alternative Approaches Considered

### Option A: Modify ActionFormattingStage (Chosen)

- **Pros**: Minimal changes, integrates with existing flow
- **Cons**: Adds responsibility to formatting stage

### Option B: New ChanceCalculationStage

- **Pros**: Cleaner separation of concerns
- **Cons**: More files, more complex pipeline
- **Decision**: Deferred to Phase 5 if needed for modifier complexity

## Performance Considerations

- Chance calculation adds ~1-2ms per action
- Consider caching for actions with many combinations
- Profile after implementation if discovery feels slow
