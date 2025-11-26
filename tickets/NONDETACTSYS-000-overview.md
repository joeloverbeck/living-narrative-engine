# NONDETACTSYS-000: Non-Deterministic Actions System - Overview

## Summary

This epic implements a non-deterministic (chance-based) actions system for the Living Narrative Engine. The system supports skill-based probability calculations, environmental modifiers, degrees of success/failure (critical success, success, failure, fumble), and displays probability percentages in action templates.

**Example Use Case**: A `swing_at_target` action calculates hit probability based on actor's `melee_skill` vs target's `defense_skill`, displays "swing longsword at chicken (55%)" to the player, and resolves with different outcomes based on the roll.

## Specification Source

`specs/non-deterministic-actions-system.md`

## Design Principles

1. **Full extensible service architecture** for future combat system
2. **Data-driven configuration** via JSON action schema extensions
3. **Individual skill components** following existing gate patterns
4. **Probability percentage displayed** in action discovery templates

## Ticket List

### Phase 1: Core Services Foundation

| Ticket | Description | Status |
|--------|-------------|--------|
| [NONDETACTSYS-001](./NONDETACTSYS-001-skills-mod.md) | Create skills mod with skill components | ⬜ |
| [NONDETACTSYS-002](../archive/NONDETACTSYS/NONDETACTSYS-002-damage-types-mod.md) | Create damage-types mod with marker components | ✅ |
| [NONDETACTSYS-003](../archive/NONDETACTSYS/NONDETACTSYS-003-skill-resolver-service.md) | Implement SkillResolverService | ✅ |
| [NONDETACTSYS-004](../archive/NONDETACTSYS/NONDETACTSYS-004-probability-calculator-service.md) | Implement ProbabilityCalculatorService | ✅ |
| [NONDETACTSYS-005](./NONDETACTSYS-005-outcome-determiner-service.md) | Implement OutcomeDeterminerService | ⬜ |

### Phase 2: Operation Handler

| Ticket | Description | Status |
|--------|-------------|--------|
| [NONDETACTSYS-006](../archive/NONDETACTSYS/NONDETACTSYS-006-resolve-outcome-schema.md) | Create RESOLVE_OUTCOME operation schema | ✅ |
| [NONDETACTSYS-007](./NONDETACTSYS-007-resolve-outcome-handler.md) | Implement ResolveOutcomeHandler | ⬜ |
| [NONDETACTSYS-008](./NONDETACTSYS-008-resolve-outcome-di-registration.md) | Register RESOLVE_OUTCOME in DI system | ⬜ |

### Phase 3: Action Discovery Integration

| Ticket | Description | Status |
|--------|-------------|--------|
| [NONDETACTSYS-009](./NONDETACTSYS-009-action-schema-chancebased.md) | Extend action.schema.json with chanceBased property | ⬜ |
| [NONDETACTSYS-010](./NONDETACTSYS-010-get-skill-value-operator.md) | Create getSkillValue JSON Logic operator | ⬜ |
| [NONDETACTSYS-011](./NONDETACTSYS-011-action-formatting-chance-injection.md) | Modify ActionFormattingStage for {chance} placeholder | ⬜ |

### Phase 4: Combat Action Implementation

| Ticket | Description | Status |
|--------|-------------|--------|
| [NONDETACTSYS-012](./NONDETACTSYS-012-wielded-cutting-weapons-scope.md) | Create wielded_cutting_weapons scope | ⬜ |
| [NONDETACTSYS-013](./NONDETACTSYS-013-swing-at-target-action.md) | Create swing_at_target action definition | ⬜ |
| [NONDETACTSYS-014](./NONDETACTSYS-014-swing-at-target-rule.md) | Create swing_at_target rule with outcome handling | ⬜ |
| [NONDETACTSYS-015](./NONDETACTSYS-015-weapon-entities-can-cut.md) | Add can_cut component to weapon entities | ⬜ |

### Phase 5: Modifiers Enhancement

| Ticket | Description | Status |
|--------|-------------|--------|
| [NONDETACTSYS-016](./NONDETACTSYS-016-modifier-collector-service.md) | Implement ModifierCollectorService | ⬜ |
| [NONDETACTSYS-017](./NONDETACTSYS-017-chance-calculation-service.md) | Implement ChanceCalculationService orchestrator | ⬜ |

## Dependency Graph

```
Phase 1 (parallelizable within phase):
NONDETACTSYS-001 ─────┐
NONDETACTSYS-002 ─────┼──────────────────────► Phase 2
NONDETACTSYS-003 ─────┤
NONDETACTSYS-004 ─────┤
NONDETACTSYS-005 ─────┘

Phase 2 (sequential):
NONDETACTSYS-006 ────► NONDETACTSYS-007 ────► NONDETACTSYS-008

Phase 3 (sequential):
NONDETACTSYS-009 ────► NONDETACTSYS-010 ────► NONDETACTSYS-011

Phase 4 (depends on Phase 2 & 3):
NONDETACTSYS-012 ─────┐
                      ├──► NONDETACTSYS-013 ──► NONDETACTSYS-014
NONDETACTSYS-015 ─────┘

Phase 5 (depends on Phase 3):
NONDETACTSYS-016 ────► NONDETACTSYS-017
```

## Recommended Execution Order

**Phase 1: Foundation (parallelizable)**
1. NONDETACTSYS-001 (skills mod)
2. NONDETACTSYS-002 (damage-types mod)
3. NONDETACTSYS-003 (SkillResolverService)
4. NONDETACTSYS-004 (ProbabilityCalculatorService)
5. NONDETACTSYS-005 (OutcomeDeterminerService)

**Phase 2: Operation Handler (sequential)**
6. NONDETACTSYS-006 (operation schema)
7. NONDETACTSYS-007 (handler implementation)
8. NONDETACTSYS-008 (DI registration)

**Phase 3: Action Discovery (sequential)**
9. NONDETACTSYS-009 (action schema extension)
10. NONDETACTSYS-010 (JSON Logic operator)
11. NONDETACTSYS-011 (ActionFormattingStage)

**Phase 4: Combat Action (after Phase 2 & 3)**
12. NONDETACTSYS-012 (scope definition)
13. NONDETACTSYS-015 (can_cut to weapons - parallelizable with 012)
14. NONDETACTSYS-013 (action definition)
15. NONDETACTSYS-014 (rule definition)

**Phase 5: Enhancement (after Phase 3)**
16. NONDETACTSYS-016 (ModifierCollectorService)
17. NONDETACTSYS-017 (ChanceCalculationService orchestrator)

## File Summary

### New Files to Create

| File | Ticket |
|------|--------|
| `data/mods/skills/mod-manifest.json` | 001 |
| `data/mods/skills/components/melee_skill.component.json` | 001 |
| `data/mods/skills/components/defense_skill.component.json` | 001 |
| `data/mods/skills/components/ranged_skill.component.json` | 001 |
| `data/mods/skills/components/dodge_skill.component.json` | 001 |
| `data/mods/skills/components/parry_skill.component.json` | 001 |
| `data/mods/damage-types/mod-manifest.json` | 002 |
| `data/mods/damage-types/components/can_cut.component.json` | 002 |
| `src/combat/services/SkillResolverService.js` | 003 |
| `src/combat/services/ProbabilityCalculatorService.js` | 004 |
| `src/combat/services/OutcomeDeterminerService.js` | 005 |
| `src/combat/index.js` | 003 |
| `data/schemas/operations/resolveOutcome.schema.json` | 006 |
| `src/logic/operationHandlers/resolveOutcomeHandler.js` | 007 |
| `src/dependencyInjection/registrations/combatRegistrations.js` | 008 |
| `src/logic/operators/getSkillValueOperator.js` | 010 |
| `data/mods/weapons/scopes/wielded_cutting_weapons.scope` | 012 |
| `data/mods/weapons/actions/swing_at_target.action.json` | 013 |
| `data/mods/weapons/conditions/event-is-action-swing-at-target.condition.json` | 013 |
| `data/mods/weapons/rules/handle_swing_at_target.rule.json` | 014 |
| `src/combat/services/ModifierCollectorService.js` | 016 |
| `src/combat/services/ChanceCalculationService.js` | 017 |

### Files to Modify

| File | Ticket | Change |
|------|--------|--------|
| `data/schemas/action.schema.json` | 009 | Add `chanceBased` property |
| `data/schemas/operation.schema.json` | 006 | Add `$ref` to resolveOutcome.schema.json |
| `src/utils/preValidationUtils.js` | 008 | Add `RESOLVE_OUTCOME` to `KNOWN_OPERATION_TYPES` |
| `src/dependencyInjection/tokens/tokens-core.js` | 003, 004, 005, 007, 016, 017 | Add service tokens |
| `src/dependencyInjection/registrations/operationHandlerRegistrations.js` | 008 | Register handler factory |
| `src/dependencyInjection/registrations/interpreterRegistrations.js` | 008 | Map RESOLVE_OUTCOME to handler |
| `src/logic/jsonLogicCustomOperators.js` | 010 | Register getSkillValue operator |
| `src/actions/pipeline/stages/ActionFormattingStage.js` | 011 | Inject chance calculation |
| `data/game.json` | 001, 002 | Add skills and damage-types mods |
| Weapon entity definitions (multiple) | 015 | Add `damage-types:can_cut` component |

### Test Files to Create

| Test File | Ticket |
|-----------|--------|
| `tests/unit/combat/services/SkillResolverService.test.js` | 003 |
| `tests/unit/combat/services/ProbabilityCalculatorService.test.js` | 004 |
| `tests/unit/combat/services/OutcomeDeterminerService.test.js` | 005 |
| `tests/unit/logic/operationHandlers/resolveOutcomeHandler.test.js` | 007 |
| `tests/unit/logic/operators/getSkillValueOperator.test.js` | 010 |
| `tests/integration/mods/weapons/swingAtTargetChanceDisplay.test.js` | 011, 013 |
| `tests/integration/mods/weapons/swingAtTargetOutcomeResolution.test.js` | 014 |
| `tests/unit/combat/services/ModifierCollectorService.test.js` | 016 |
| `tests/unit/combat/services/ChanceCalculationService.test.js` | 017 |

## DI Token Additions

Tokens to add to `src/dependencyInjection/tokens/tokens-core.js`:

```javascript
// Combat Services
SkillResolverService: 'SkillResolverService',
ModifierCollectorService: 'ModifierCollectorService',
ProbabilityCalculatorService: 'ProbabilityCalculatorService',
OutcomeDeterminerService: 'OutcomeDeterminerService',
ChanceCalculationService: 'ChanceCalculationService',
ResolveOutcomeHandler: 'ResolveOutcomeHandler',
```

## Validation Commands

```bash
# After each ticket completion
npm run validate
npm run typecheck
npx eslint <modified-files>

# After all Phase 1 tickets
npm run test:unit -- --testPathPattern="combat/services"

# After Phase 2 tickets
npm run test:unit -- --testPathPattern="resolveOutcome"

# After Phase 3 tickets
npm run test:unit -- --testPathPattern="getSkillValue"
npm run test:integration -- --testPathPattern="ChanceDisplay"

# After Phase 4 tickets
npm run test:integration -- --testPathPattern="swingAtTarget"

# Full validation
npm run test:ci
```

## Key Concepts

### Outcome Types
- **CRITICAL_SUCCESS**: Roll <= criticalSuccessThreshold (default 5) AND success
- **SUCCESS**: Roll <= finalChance
- **FAILURE**: Roll > finalChance
- **FUMBLE**: Roll >= criticalFailureThreshold (default 95) AND failure

### Formula Types
| Formula | Calculation | Best For |
|---------|-------------|----------|
| `ratio` (default) | `actor / (actor + target) * 100` | Opposed skill checks |
| `logistic` | `100 / (1 + e^(-0.1 * diff))` | Bell-curve distribution |
| `linear` | `50 + (actor - difficulty)` | Fixed difficulty checks |

### Probability Bounds
- Default minimum: 5%
- Default maximum: 95%
- Ensures no action is ever guaranteed to succeed or fail

## Future Extensibility

This architecture supports future enhancements:
- **Damage System**: Add damage calculation service using same patterns
- **Armor System**: Modifiers from equipment components
- **Buffs/Debuffs**: Temporary modifiers on entities
- **Environmental Effects**: Location-based modifiers
- **Different Contest Types**: Group checks, extended contests
- **Weapon Properties**: Special modifiers from weapon components
- **Stance Modifiers**: Position-based bonuses/penalties
