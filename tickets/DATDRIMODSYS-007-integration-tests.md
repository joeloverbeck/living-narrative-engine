# DATDRIMODSYS-007: Integration Tests for Data-Driven Modifier System

## Summary

Create end-to-end integration tests that validate the complete modifier system flow from action definition through condition evaluation to final display output. These tests use real services with minimal mocking to verify system integration.

## File List

Files to create:
- `tests/integration/combat/modifierSystemFlow.integration.test.js`
- `tests/integration/actions/chanceBasedModifierDisplay.integration.test.js`

Files to reference (read-only):
- `src/combat/services/ModifierContextBuilder.js`
- `src/combat/services/ModifierCollectorService.js`
- `src/combat/services/ChanceCalculationService.js`
- `src/actions/formatters/MultiTargetActionFormatter.js`
- `data/mods/physical-control/actions/restrain_target.action.json`

## Out of Scope

- **DO NOT** modify any source files
- **DO NOT** modify any action JSON files
- **DO NOT** create unit tests (that's DATDRIMODSYS-006)
- **DO NOT** create test data files in `data/mods/`

## Detailed Implementation

### 1. Modifier System Flow Integration Test

File: `tests/integration/combat/modifierSystemFlow.integration.test.js`

```javascript
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { createTestBed } from '../../common/testBed.js';

describe('Modifier System Flow Integration', () => {
  let testBed;
  let modifierContextBuilder;
  let modifierCollectorService;
  let chanceCalculationService;
  let entityManager;

  beforeEach(async () => {
    testBed = createTestBed();

    // Create test entities with components
    entityManager = testBed.getEntityManager();

    // Create actor with skills
    await testBed.createEntity('actor1', {
      'core:actor': { name: 'Test Actor' },
      'skills:grappling_skill': { value: 60 },
      'core:position': { locationId: 'location1' },
    });

    // Create target with restraint status
    await testBed.createEntity('target1', {
      'core:actor': { name: 'Test Target' },
      'positioning:being_restrained': { restrainedBy: 'someone' },
      'skills:defense_skill': { value: 30 },
    });

    // Create target without restraint
    await testBed.createEntity('target2', {
      'core:actor': { name: 'Free Target' },
      'skills:defense_skill': { value: 40 },
    });

    // Create location
    await testBed.createEntity('location1', {
      'core:location': { name: 'Test Room' },
      'environment:lighting': { level: 'dim' },
    });

    // Get services from DI container
    const container = testBed.getContainer();
    modifierContextBuilder = container.resolve('ModifierContextBuilder');
    modifierCollectorService = container.resolve('ModifierCollectorService');
    chanceCalculationService = container.resolve('ChanceCalculationService');
  });

  afterEach(() => {
    testBed.cleanup();
  });

  describe('Context Building', () => {
    it('should build complete context with all entity data', async () => {
      const context = modifierContextBuilder.buildContext({
        actorId: 'actor1',
        primaryTargetId: 'target1',
      });

      // Verify actor data
      expect(context.entity.actor.id).toBe('actor1');
      expect(context.entity.actor.components['core:actor'].name).toBe('Test Actor');
      expect(context.entity.actor.components['skills:grappling_skill'].value).toBe(60);

      // Verify target data
      expect(context.entity.primary.id).toBe('target1');
      expect(context.entity.primary.components['positioning:being_restrained']).toBeDefined();

      // Verify location from actor's position
      expect(context.entity.location).toBeDefined();
      expect(context.entity.location.id).toBe('location1');
    });
  });

  describe('Modifier Collection with Real Conditions', () => {
    it('should activate modifier when target has required component', async () => {
      const actionConfig = {
        enabled: true,
        modifiers: [
          {
            condition: {
              logic: {
                '!!': [{ 'var': 'entity.primary.components.positioning:being_restrained' }]
              }
            },
            value: 20,
            type: 'flat',
            tag: 'target restrained',
            description: 'Bonus when target is already restrained',
          },
        ],
      };

      const result = modifierCollectorService.collectModifiers({
        actorId: 'actor1',
        primaryTargetId: 'target1',
        actionConfig,
      });

      expect(result.modifiers).toHaveLength(1);
      expect(result.modifiers[0].tag).toBe('target restrained');
      expect(result.totalFlat).toBe(20);
    });

    it('should NOT activate modifier when target lacks component', async () => {
      const actionConfig = {
        enabled: true,
        modifiers: [
          {
            condition: {
              logic: {
                '!!': [{ 'var': 'entity.primary.components.positioning:being_restrained' }]
              }
            },
            value: 20,
            type: 'flat',
            tag: 'target restrained',
          },
        ],
      };

      const result = modifierCollectorService.collectModifiers({
        actorId: 'actor1',
        primaryTargetId: 'target2', // target2 is NOT restrained
        actionConfig,
      });

      expect(result.modifiers).toHaveLength(0);
      expect(result.totalFlat).toBe(0);
    });

    it('should handle multiple modifiers with different conditions', async () => {
      const actionConfig = {
        enabled: true,
        modifiers: [
          {
            condition: {
              logic: {
                '!!': [{ 'var': 'entity.primary.components.positioning:being_restrained' }]
              }
            },
            value: 20,
            type: 'flat',
            tag: 'target restrained',
          },
          {
            condition: {
              logic: {
                '==': [
                  { 'var': 'entity.location.components.environment:lighting.level' },
                  'dim'
                ]
              }
            },
            value: -10,
            type: 'flat',
            tag: 'low light',
          },
        ],
      };

      // Test with restrained target
      const result = modifierCollectorService.collectModifiers({
        actorId: 'actor1',
        primaryTargetId: 'target1',
        actionConfig,
      });

      expect(result.modifiers).toHaveLength(2);
      expect(result.totalFlat).toBe(10); // 20 - 10
    });
  });

  describe('Stacking Rules', () => {
    it('should apply stacking rules for same stackId', async () => {
      const actionConfig = {
        enabled: true,
        modifiers: [
          {
            condition: { logic: { '==': [1, 1] } },
            value: 10,
            type: 'flat',
            tag: 'buff 1',
            stackId: 'strength_buff',
          },
          {
            condition: { logic: { '==': [1, 1] } },
            value: 15,
            type: 'flat',
            tag: 'buff 2',
            stackId: 'strength_buff',
          },
        ],
      };

      const result = modifierCollectorService.collectModifiers({
        actorId: 'actor1',
        actionConfig,
      });

      // Only highest value should apply
      expect(result.modifiers).toHaveLength(1);
      expect(result.modifiers[0].value).toBe(15);
      expect(result.totalFlat).toBe(15);
    });
  });

  describe('Full Chance Calculation Flow', () => {
    it('should calculate final chance including modifiers', async () => {
      const actionDef = {
        id: 'test:action',
        chanceBased: {
          enabled: true,
          contestType: 'opposed',
          actorSkill: {
            component: 'skills:grappling_skill',
            default: 10,
          },
          targetSkill: {
            component: 'skills:defense_skill',
            default: 0,
            targetRole: 'primary',
          },
          formula: 'ratio',
          bounds: { min: 5, max: 95 },
          modifiers: [
            {
              condition: {
                logic: {
                  '!!': [{ 'var': 'entity.primary.components.positioning:being_restrained' }]
                }
              },
              value: 20,
              type: 'flat',
              tag: 'target restrained',
            },
          ],
        },
      };

      const displayResult = chanceCalculationService.calculateForDisplay({
        actorId: 'actor1',
        primaryTargetId: 'target1', // Restrained target
        actionDef,
      });

      // Should have modifier active
      expect(displayResult.activeTags).toContain('target restrained');
      expect(displayResult.breakdown.modifiers).toHaveLength(1);

      // Compare to same calculation without modifier
      const displayResultNoMod = chanceCalculationService.calculateForDisplay({
        actorId: 'actor1',
        primaryTargetId: 'target2', // NOT restrained
        actionDef,
      });

      // Chance should be higher with modifier
      expect(displayResult.chance).toBeGreaterThan(displayResultNoMod.chance);
    });
  });
});
```

### 2. Chance-Based Modifier Display Integration Test

File: `tests/integration/actions/chanceBasedModifierDisplay.integration.test.js`

```javascript
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { createTestBed } from '../../common/testBed.js';

describe('Chance-Based Modifier Display Integration', () => {
  let testBed;
  let multiTargetFormatter;
  let chanceCalculationService;

  beforeEach(async () => {
    testBed = createTestBed();

    // Setup test entities
    await testBed.createEntity('actor1', {
      'core:actor': { name: 'Fighter' },
      'skills:grappling_skill': { value: 50 },
    });

    await testBed.createEntity('target1', {
      'core:actor': { name: 'Goblin' },
      'positioning:prone': {},
    });

    await testBed.createEntity('target2', {
      'core:actor': { name: 'Orc' },
    });

    const container = testBed.getContainer();
    multiTargetFormatter = container.resolve('MultiTargetActionFormatter');
    chanceCalculationService = container.resolve('ChanceCalculationService');
  });

  afterEach(() => {
    testBed.cleanup();
  });

  describe('Tag Display in Action Templates', () => {
    it('should display tags in formatted action when modifiers active', async () => {
      const actionDef = {
        id: 'test:attack',
        template: 'attack {target} ({chance}% chance)',
        chanceBased: {
          enabled: true,
          contestType: 'fixed_difficulty',
          actorSkill: { component: 'skills:grappling_skill', default: 10 },
          formula: 'difference',
          bounds: { min: 5, max: 95 },
          modifiers: [
            {
              condition: {
                logic: { '!!': [{ 'var': 'entity.primary.components.positioning:prone' }] }
              },
              value: 15,
              type: 'flat',
              tag: 'target prone',
            },
          ],
        },
      };

      const result = multiTargetFormatter.formatMultiTarget(
        actionDef,
        { primary: [{ id: 'target1', displayName: 'Goblin' }] },
        {},
        {
          chanceCalculationService,
          actorId: 'actor1',
        },
        { targetDefinitions: { primary: { placeholder: 'target' } } }
      );

      expect(result.ok).toBe(true);
      expect(result.value[0].command).toContain('[target prone]');
    });

    it('should NOT display tags when modifiers inactive', async () => {
      const actionDef = {
        id: 'test:attack',
        template: 'attack {target} ({chance}% chance)',
        chanceBased: {
          enabled: true,
          contestType: 'fixed_difficulty',
          actorSkill: { component: 'skills:grappling_skill', default: 10 },
          formula: 'difference',
          bounds: { min: 5, max: 95 },
          modifiers: [
            {
              condition: {
                logic: { '!!': [{ 'var': 'entity.primary.components.positioning:prone' }] }
              },
              value: 15,
              type: 'flat',
              tag: 'target prone',
            },
          ],
        },
      };

      const result = multiTargetFormatter.formatMultiTarget(
        actionDef,
        { primary: [{ id: 'target2', displayName: 'Orc' }] }, // Orc is NOT prone
        {},
        {
          chanceCalculationService,
          actorId: 'actor1',
        },
        { targetDefinitions: { primary: { placeholder: 'target' } } }
      );

      expect(result.ok).toBe(true);
      expect(result.value[0].command).not.toContain('[target prone]');
      expect(result.value[0].command).not.toContain('[');
    });

    it('should display multiple tags when multiple modifiers active', async () => {
      // Add prone and restrained to target
      await testBed.addComponent('target1', 'positioning:being_restrained', { restrainedBy: 'someone' });

      const actionDef = {
        id: 'test:attack',
        template: 'attack {target} ({chance}% chance)',
        chanceBased: {
          enabled: true,
          contestType: 'fixed_difficulty',
          actorSkill: { component: 'skills:grappling_skill', default: 10 },
          formula: 'difference',
          bounds: { min: 5, max: 95 },
          modifiers: [
            {
              condition: {
                logic: { '!!': [{ 'var': 'entity.primary.components.positioning:prone' }] }
              },
              value: 15,
              type: 'flat',
              tag: 'prone',
            },
            {
              condition: {
                logic: { '!!': [{ 'var': 'entity.primary.components.positioning:being_restrained' }] }
              },
              value: 10,
              type: 'flat',
              tag: 'restrained',
            },
          ],
        },
      };

      const result = multiTargetFormatter.formatMultiTarget(
        actionDef,
        { primary: [{ id: 'target1', displayName: 'Goblin' }] },
        {},
        {
          chanceCalculationService,
          actorId: 'actor1',
        },
        { targetDefinitions: { primary: { placeholder: 'target' } } }
      );

      expect(result.ok).toBe(true);
      expect(result.value[0].command).toContain('[prone]');
      expect(result.value[0].command).toContain('[restrained]');
    });
  });

  describe('Different Target Combinations', () => {
    it('should calculate modifiers per target combination', async () => {
      const actionDef = {
        id: 'test:attack',
        template: 'attack {target} ({chance}% chance)',
        generateCombinations: true,
        chanceBased: {
          enabled: true,
          contestType: 'fixed_difficulty',
          actorSkill: { component: 'skills:grappling_skill', default: 10 },
          formula: 'difference',
          bounds: { min: 5, max: 95 },
          modifiers: [
            {
              condition: {
                logic: { '!!': [{ 'var': 'entity.primary.components.positioning:prone' }] }
              },
              value: 15,
              type: 'flat',
              tag: 'prone',
            },
          ],
        },
      };

      const result = multiTargetFormatter.formatMultiTarget(
        actionDef,
        {
          primary: [
            { id: 'target1', displayName: 'Goblin' }, // Prone
            { id: 'target2', displayName: 'Orc' },    // Not prone
          ]
        },
        {},
        {
          chanceCalculationService,
          actorId: 'actor1',
        },
        { targetDefinitions: { primary: { placeholder: 'target' } } }
      );

      expect(result.ok).toBe(true);
      expect(result.value).toHaveLength(2);

      // Goblin (prone) should have tag
      const goblinCommand = result.value.find((v) => v.command.includes('Goblin'));
      expect(goblinCommand.command).toContain('[prone]');

      // Orc (not prone) should NOT have tag
      const orcCommand = result.value.find((v) => v.command.includes('Orc'));
      expect(orcCommand.command).not.toContain('[prone]');
    });
  });
});
```

## Acceptance Criteria

### Tests That Must Pass

1. **All New Integration Tests**:
   - `npm run test:integration -- --testPathPattern="modifierSystemFlow" --silent` must pass
   - `npm run test:integration -- --testPathPattern="chanceBasedModifierDisplay" --silent` must pass

2. **No Regressions**:
   - `npm run test:integration -- --testPathPattern="combat" --silent` must pass
   - `npm run test:integration -- --testPathPattern="actions" --silent` must pass

### Invariants That Must Remain True

1. **Test Independence**:
   - Each test should set up its own entities and state
   - Tests must not depend on each other's execution order
   - testBed cleanup must be called in afterEach

2. **Real Integration**:
   - Use real services from DI container where possible
   - Only mock external dependencies (APIs, file system)
   - Validate actual JSON Logic evaluation

3. **Entity State**:
   - All test entities must be cleaned up after each test
   - Component data must match schema requirements

## Verification Commands

```bash
# Run all new integration tests
npm run test:integration -- --testPathPattern="modifierSystemFlow|chanceBasedModifierDisplay" --silent

# Run with verbose output for debugging
npm run test:integration -- --testPathPattern="modifierSystemFlow" --verbose

# Run all combat integration tests
npm run test:integration -- --testPathPattern="combat" --silent
```

## Dependencies

- **Depends on**: DATDRIMODSYS-001 through DATDRIMODSYS-006 (all implementation must be complete)
- **Blocks**: None (this completes the test coverage)

## Notes

- Integration tests use `createTestBed()` from `/tests/common/testBed.js`
- Entity creation should follow existing patterns in the codebase
- JSON Logic conditions in tests should match real usage patterns from the spec
- The tests assume DI container exposes services by their token names
- Consider adding test fixtures for common action modifier patterns
