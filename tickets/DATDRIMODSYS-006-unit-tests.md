# DATDRIMODSYS-006: Unit Tests for Data-Driven Modifier System

## Summary

Create comprehensive unit tests for all new services and modifications in the data-driven modifier system. This ticket consolidates unit testing requirements that were mentioned but deferred in previous tickets.

## File List

Files to create:
- `tests/unit/combat/services/ModifierContextBuilder.test.js`
- `tests/unit/combat/services/ModifierCollectorService.modifiers.test.js`
- `tests/unit/combat/services/ChanceCalculationService.modifiers.test.js`
- `tests/unit/actions/formatters/MultiTargetActionFormatter.tags.test.js`

Files to reference (read-only):
- `src/combat/services/ModifierContextBuilder.js`
- `src/combat/services/ModifierCollectorService.js`
- `src/combat/services/ChanceCalculationService.js`
- `src/actions/formatters/MultiTargetActionFormatter.js`

## Out of Scope

- **DO NOT** modify any source files
- **DO NOT** create integration tests (that's DATDRIMODSYS-007)
- **DO NOT** modify any action JSON files
- **DO NOT** modify any schema files

## Detailed Implementation

### 1. ModifierContextBuilder Unit Tests

File: `tests/unit/combat/services/ModifierContextBuilder.test.js`

```javascript
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import ModifierContextBuilder from '../../../../src/combat/services/ModifierContextBuilder.js';

describe('ModifierContextBuilder', () => {
  let mockEntityManager;
  let mockLogger;
  let builder;

  beforeEach(() => {
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    mockEntityManager = {
      getEntity: jest.fn(),
      getComponentData: jest.fn(),
      hasComponent: jest.fn(),
    };

    builder = new ModifierContextBuilder({
      entityManager: mockEntityManager,
      logger: mockLogger,
    });
  });

  describe('constructor', () => {
    it('should initialize with valid dependencies', () => {
      expect(builder).toBeDefined();
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'ModifierContextBuilder: Initialized'
      );
    });

    it('should throw when logger is missing', () => {
      expect(
        () => new ModifierContextBuilder({ entityManager: mockEntityManager })
      ).toThrow();
    });

    it('should throw when entityManager is missing', () => {
      expect(
        () => new ModifierContextBuilder({ logger: mockLogger })
      ).toThrow();
    });
  });

  describe('buildContext', () => {
    it('should build context with actor only', () => {
      mockEntityManager.getEntity.mockReturnValue({ id: 'actor1', components: {} });
      mockEntityManager.getComponentData.mockReturnValue(null);

      const context = builder.buildContext({ actorId: 'actor1' });

      expect(context.entity.actor).toBeDefined();
      expect(context.entity.actor.id).toBe('actor1');
      expect(context.entity.primary).toBeNull();
      expect(context.entity.secondary).toBeNull();
      expect(context.entity.tertiary).toBeNull();
    });

    it('should build context with actor and primary target', () => {
      mockEntityManager.getEntity.mockImplementation((id) => ({
        id,
        components: {},
      }));

      const context = builder.buildContext({
        actorId: 'actor1',
        primaryTargetId: 'target1',
      });

      expect(context.entity.actor.id).toBe('actor1');
      expect(context.entity.primary.id).toBe('target1');
    });

    it('should build context with all targets', () => {
      mockEntityManager.getEntity.mockImplementation((id) => ({
        id,
        components: {},
      }));

      const context = builder.buildContext({
        actorId: 'actor1',
        primaryTargetId: 'target1',
        secondaryTargetId: 'target2',
        tertiaryTargetId: 'target3',
      });

      expect(context.entity.actor.id).toBe('actor1');
      expect(context.entity.primary.id).toBe('target1');
      expect(context.entity.secondary.id).toBe('target2');
      expect(context.entity.tertiary.id).toBe('target3');
    });

    it('should resolve location from actor core:position component', () => {
      mockEntityManager.getEntity.mockImplementation((id) => ({
        id,
        components: {},
      }));
      mockEntityManager.getComponentData.mockImplementation((entityId, componentId) => {
        if (entityId === 'actor1' && componentId === 'core:position') {
          return { locationId: 'location1' };
        }
        return null;
      });

      const context = builder.buildContext({ actorId: 'actor1' });

      expect(context.entity.location).toBeDefined();
      expect(context.entity.location.id).toBe('location1');
    });

    it('should return null location when actor has no position', () => {
      mockEntityManager.getEntity.mockReturnValue({ id: 'actor1', components: {} });
      mockEntityManager.getComponentData.mockReturnValue(null);

      const context = builder.buildContext({ actorId: 'actor1' });

      expect(context.entity.location).toBeNull();
    });

    it('should return null for non-existent entity IDs', () => {
      mockEntityManager.getEntity.mockReturnValue(null);

      const context = builder.buildContext({
        actorId: 'missing',
        primaryTargetId: 'also-missing',
      });

      expect(context.entity.actor).toBeNull();
      expect(context.entity.primary).toBeNull();
    });

    it('should include all component data in entity context', () => {
      mockEntityManager.getEntity.mockReturnValue({
        id: 'actor1',
        components: new Map([
          ['core:actor', { name: 'Test Actor' }],
          ['skills:combat', { value: 50 }],
        ]),
      });
      mockEntityManager.getComponentData.mockImplementation((entityId, componentId) => {
        if (componentId === 'core:actor') return { name: 'Test Actor' };
        if (componentId === 'skills:combat') return { value: 50 };
        return null;
      });

      const context = builder.buildContext({ actorId: 'actor1' });

      expect(context.entity.actor.components['core:actor']).toEqual({
        name: 'Test Actor',
      });
      expect(context.entity.actor.components['skills:combat']).toEqual({
        value: 50,
      });
    });

    it('should handle entity with no components gracefully', () => {
      mockEntityManager.getEntity.mockReturnValue({
        id: 'actor1',
        components: {},
      });

      const context = builder.buildContext({ actorId: 'actor1' });

      expect(context.entity.actor).toBeDefined();
      expect(context.entity.actor.components).toEqual({});
    });
  });
});
```

### 2. ModifierCollectorService Modifier Tests

File: `tests/unit/combat/services/ModifierCollectorService.modifiers.test.js`

```javascript
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import ModifierCollectorService from '../../../../src/combat/services/ModifierCollectorService.js';

describe('ModifierCollectorService - Action Modifiers', () => {
  let mockEntityManager;
  let mockModifierContextBuilder;
  let mockLogger;
  let service;

  beforeEach(() => {
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    mockEntityManager = {
      getEntity: jest.fn(),
      getComponentData: jest.fn(),
      hasComponent: jest.fn(),
    };

    mockModifierContextBuilder = {
      buildContext: jest.fn().mockReturnValue({
        entity: {
          actor: { id: 'actor1', components: {} },
          primary: { id: 'target1', components: {} },
          secondary: null,
          tertiary: null,
          location: null,
        },
      }),
    };

    service = new ModifierCollectorService({
      entityManager: mockEntityManager,
      modifierContextBuilder: mockModifierContextBuilder,
      logger: mockLogger,
    });
  });

  describe('collectModifiers with action modifiers', () => {
    it('should return empty array when no modifiers configured', () => {
      const result = service.collectModifiers({
        actorId: 'actor1',
        primaryTargetId: 'target1',
        actionConfig: { enabled: true },
      });

      expect(result.modifiers).toEqual([]);
      expect(result.totalFlat).toBe(0);
      expect(result.totalPercentage).toBe(1);
    });

    it('should evaluate inline JSON Logic conditions', () => {
      const result = service.collectModifiers({
        actorId: 'actor1',
        primaryTargetId: 'target1',
        actionConfig: {
          enabled: true,
          modifiers: [
            {
              condition: { logic: { '==': [1, 1] } },
              value: 10,
              type: 'flat',
              tag: 'always active',
            },
          ],
        },
      });

      expect(result.modifiers).toHaveLength(1);
      expect(result.modifiers[0].tag).toBe('always active');
      expect(result.totalFlat).toBe(10);
    });

    it('should skip modifiers when conditions are false', () => {
      const result = service.collectModifiers({
        actorId: 'actor1',
        primaryTargetId: 'target1',
        actionConfig: {
          enabled: true,
          modifiers: [
            {
              condition: { logic: { '==': [1, 2] } },
              value: 10,
              type: 'flat',
              tag: 'never active',
            },
          ],
        },
      });

      expect(result.modifiers).toHaveLength(0);
    });

    it('should handle legacy modifier format (integer)', () => {
      const result = service.collectModifiers({
        actorId: 'actor1',
        actionConfig: {
          enabled: true,
          modifiers: [
            {
              condition: { logic: { '==': [1, 1] } },
              modifier: 15,
            },
          ],
        },
      });

      expect(result.modifiers).toHaveLength(1);
      expect(result.modifiers[0].type).toBe('flat');
      expect(result.modifiers[0].value).toBe(15);
    });

    it('should handle new value+type format', () => {
      const result = service.collectModifiers({
        actorId: 'actor1',
        actionConfig: {
          enabled: true,
          modifiers: [
            {
              condition: { logic: { '==': [1, 1] } },
              value: 0.1,
              type: 'percentage',
              tag: 'buff',
            },
          ],
        },
      });

      expect(result.modifiers[0].type).toBe('percentage');
      expect(result.modifiers[0].value).toBe(0.1);
    });

    it('should log warning on condition evaluation error and continue', () => {
      const result = service.collectModifiers({
        actorId: 'actor1',
        actionConfig: {
          enabled: true,
          modifiers: [
            {
              condition: { logic: { invalid_operator: [] } },
              value: 10,
              tag: 'broken',
            },
            {
              condition: { logic: { '==': [1, 1] } },
              value: 5,
              tag: 'valid',
            },
          ],
        },
      });

      expect(mockLogger.warn).toHaveBeenCalled();
      expect(result.modifiers).toHaveLength(1);
      expect(result.modifiers[0].tag).toBe('valid');
    });

    it('should pass all target IDs to context builder', () => {
      service.collectModifiers({
        actorId: 'actor1',
        primaryTargetId: 'target1',
        secondaryTargetId: 'target2',
        tertiaryTargetId: 'target3',
        actionConfig: { enabled: true, modifiers: [] },
      });

      expect(mockModifierContextBuilder.buildContext).toHaveBeenCalledWith({
        actorId: 'actor1',
        primaryTargetId: 'target1',
        secondaryTargetId: 'target2',
        tertiaryTargetId: 'target3',
      });
    });

    it('should treat no condition as always active', () => {
      const result = service.collectModifiers({
        actorId: 'actor1',
        actionConfig: {
          enabled: true,
          modifiers: [
            {
              value: 10,
              type: 'flat',
              tag: 'unconditional',
            },
          ],
        },
      });

      expect(result.modifiers).toHaveLength(1);
      expect(result.modifiers[0].tag).toBe('unconditional');
    });
  });
});
```

### 3. ChanceCalculationService Modifier Tests

File: `tests/unit/combat/services/ChanceCalculationService.modifiers.test.js`

```javascript
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import ChanceCalculationService from '../../../../src/combat/services/ChanceCalculationService.js';

describe('ChanceCalculationService - Modifier Integration', () => {
  let mockSkillResolverService;
  let mockModifierCollectorService;
  let mockProbabilityCalculatorService;
  let mockOutcomeDeterminerService;
  let mockLogger;
  let service;

  beforeEach(() => {
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    mockSkillResolverService = {
      getSkillValue: jest.fn().mockReturnValue({ baseValue: 50 }),
    };

    mockModifierCollectorService = {
      collectModifiers: jest.fn().mockReturnValue({
        modifiers: [],
        totalFlat: 0,
        totalPercentage: 1,
      }),
    };

    mockProbabilityCalculatorService = {
      calculate: jest.fn().mockReturnValue({
        baseChance: 50,
        finalChance: 50,
      }),
    };

    mockOutcomeDeterminerService = {
      determine: jest.fn().mockReturnValue({
        outcome: 'SUCCESS',
        roll: 25,
        margin: 25,
        isCritical: false,
      }),
    };

    service = new ChanceCalculationService({
      skillResolverService: mockSkillResolverService,
      modifierCollectorService: mockModifierCollectorService,
      probabilityCalculatorService: mockProbabilityCalculatorService,
      outcomeDeterminerService: mockOutcomeDeterminerService,
      logger: mockLogger,
    });
  });

  describe('calculateForDisplay', () => {
    it('should pass primaryTargetId to modifier collector', () => {
      service.calculateForDisplay({
        actorId: 'actor1',
        primaryTargetId: 'target1',
        actionDef: { chanceBased: { enabled: true } },
      });

      expect(mockModifierCollectorService.collectModifiers).toHaveBeenCalledWith(
        expect.objectContaining({ primaryTargetId: 'target1' })
      );
    });

    it('should pass secondaryTargetId to modifier collector', () => {
      service.calculateForDisplay({
        actorId: 'actor1',
        primaryTargetId: 'target1',
        secondaryTargetId: 'target2',
        actionDef: { chanceBased: { enabled: true } },
      });

      expect(mockModifierCollectorService.collectModifiers).toHaveBeenCalledWith(
        expect.objectContaining({ secondaryTargetId: 'target2' })
      );
    });

    it('should pass tertiaryTargetId to modifier collector', () => {
      service.calculateForDisplay({
        actorId: 'actor1',
        tertiaryTargetId: 'target3',
        actionDef: { chanceBased: { enabled: true } },
      });

      expect(mockModifierCollectorService.collectModifiers).toHaveBeenCalledWith(
        expect.objectContaining({ tertiaryTargetId: 'target3' })
      );
    });

    it('should extract active tags from modifiers', () => {
      mockModifierCollectorService.collectModifiers.mockReturnValue({
        modifiers: [
          { type: 'flat', value: 10, tag: 'tag1' },
          { type: 'flat', value: 5, tag: 'tag2' },
        ],
        totalFlat: 15,
        totalPercentage: 1,
      });

      const result = service.calculateForDisplay({
        actorId: 'actor1',
        actionDef: { chanceBased: { enabled: true } },
      });

      expect(result.activeTags).toEqual(['tag1', 'tag2']);
    });

    it('should return empty activeTags when no modifiers have tags', () => {
      mockModifierCollectorService.collectModifiers.mockReturnValue({
        modifiers: [{ type: 'flat', value: 10, tag: null }],
        totalFlat: 10,
        totalPercentage: 1,
      });

      const result = service.calculateForDisplay({
        actorId: 'actor1',
        actionDef: { chanceBased: { enabled: true } },
      });

      expect(result.activeTags).toEqual([]);
    });

    it('should support legacy targetId parameter (backward compatibility)', () => {
      service.calculateForDisplay({
        actorId: 'actor1',
        targetId: 'legacyTarget',
        actionDef: { chanceBased: { enabled: true } },
      });

      expect(mockModifierCollectorService.collectModifiers).toHaveBeenCalledWith(
        expect.objectContaining({ primaryTargetId: 'legacyTarget' })
      );
    });
  });

  describe('resolveOutcome', () => {
    it('should include activeTags in outcome result', () => {
      mockModifierCollectorService.collectModifiers.mockReturnValue({
        modifiers: [{ type: 'flat', value: 10, tag: 'active' }],
        totalFlat: 10,
        totalPercentage: 1,
      });

      const result = service.resolveOutcome({
        actorId: 'actor1',
        actionDef: { chanceBased: { enabled: true } },
      });

      expect(result.activeTags).toEqual(['active']);
    });

    it('should return empty activeTags for non-chance-based actions', () => {
      const result = service.resolveOutcome({
        actorId: 'actor1',
        actionDef: { chanceBased: { enabled: false } },
      });

      expect(result.activeTags).toEqual([]);
    });
  });
});
```

### 4. MultiTargetActionFormatter Tag Tests

File: `tests/unit/actions/formatters/MultiTargetActionFormatter.tags.test.js`

```javascript
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { MultiTargetActionFormatter } from '../../../../src/actions/formatters/MultiTargetActionFormatter.js';

describe('MultiTargetActionFormatter - Tag Display', () => {
  let mockBaseFormatter;
  let mockLogger;
  let formatter;

  beforeEach(() => {
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    mockBaseFormatter = {
      format: jest.fn(),
    };

    formatter = new MultiTargetActionFormatter(mockBaseFormatter, mockLogger);
  });

  describe('#formatModifierTags (via formatMultiTarget)', () => {
    it('should format single tag correctly', () => {
      const mockChanceService = {
        calculateForDisplay: jest.fn().mockReturnValue({
          displayText: '50%',
          activeTags: ['prone'],
        }),
      };

      const result = formatter.formatMultiTarget(
        {
          template: 'attack {target} ({chance}% chance)',
          chanceBased: { enabled: true },
        },
        { primary: [{ id: 't1', displayName: 'Goblin' }] },
        {},
        { chanceCalculationService: mockChanceService, actorId: 'a1' },
        { targetDefinitions: { primary: { placeholder: 'target' } } }
      );

      expect(result.ok).toBe(true);
      expect(result.value[0].command).toContain('[prone]');
    });

    it('should format multiple tags correctly', () => {
      const mockChanceService = {
        calculateForDisplay: jest.fn().mockReturnValue({
          displayText: '60%',
          activeTags: ['prone', 'flanked', 'low light'],
        }),
      };

      const result = formatter.formatMultiTarget(
        {
          template: 'attack {target} ({chance}% chance)',
          chanceBased: { enabled: true },
        },
        { primary: [{ id: 't1', displayName: 'Goblin' }] },
        {},
        { chanceCalculationService: mockChanceService, actorId: 'a1' },
        { targetDefinitions: { primary: { placeholder: 'target' } } }
      );

      expect(result.value[0].command).toContain('[prone]');
      expect(result.value[0].command).toContain('[flanked]');
      expect(result.value[0].command).toContain('[low light]');
    });

    it('should filter empty tags', () => {
      const mockChanceService = {
        calculateForDisplay: jest.fn().mockReturnValue({
          displayText: '50%',
          activeTags: ['valid', '', 'also valid'],
        }),
      };

      const result = formatter.formatMultiTarget(
        {
          template: 'attack {target} ({chance}% chance)',
          chanceBased: { enabled: true },
        },
        { primary: [{ id: 't1', displayName: 'Target' }] },
        {},
        { chanceCalculationService: mockChanceService, actorId: 'a1' },
        { targetDefinitions: { primary: { placeholder: 'target' } } }
      );

      const command = result.value[0].command;
      expect(command).toContain('[valid]');
      expect(command).toContain('[also valid]');
      expect(command).not.toContain('[]');
    });

    it('should filter whitespace-only tags', () => {
      const mockChanceService = {
        calculateForDisplay: jest.fn().mockReturnValue({
          displayText: '50%',
          activeTags: ['valid', '   ', 'another'],
        }),
      };

      const result = formatter.formatMultiTarget(
        {
          template: 'attack {target} ({chance}% chance)',
          chanceBased: { enabled: true },
        },
        { primary: [{ id: 't1', displayName: 'Target' }] },
        {},
        { chanceCalculationService: mockChanceService, actorId: 'a1' },
        { targetDefinitions: { primary: { placeholder: 'target' } } }
      );

      expect(result.value[0].command).not.toContain('[   ]');
    });

    it('should handle empty activeTags array', () => {
      const mockChanceService = {
        calculateForDisplay: jest.fn().mockReturnValue({
          displayText: '50%',
          activeTags: [],
        }),
      };

      const result = formatter.formatMultiTarget(
        {
          template: 'attack {target} ({chance}% chance)',
          chanceBased: { enabled: true },
        },
        { primary: [{ id: 't1', displayName: 'Target' }] },
        {},
        { chanceCalculationService: mockChanceService, actorId: 'a1' },
        { targetDefinitions: { primary: { placeholder: 'target' } } }
      );

      expect(result.value[0].command).toBe('attack Target (50% chance)');
    });

    it('should handle null activeTags gracefully', () => {
      const mockChanceService = {
        calculateForDisplay: jest.fn().mockReturnValue({
          displayText: '50%',
          activeTags: null,
        }),
      };

      const result = formatter.formatMultiTarget(
        {
          template: 'attack {target} ({chance}% chance)',
          chanceBased: { enabled: true },
        },
        { primary: [{ id: 't1', displayName: 'Target' }] },
        {},
        { chanceCalculationService: mockChanceService, actorId: 'a1' },
        { targetDefinitions: { primary: { placeholder: 'target' } } }
      );

      expect(result.ok).toBe(true);
      expect(result.value[0].command).not.toContain('[');
    });

    it('should preserve tag order from displayResult', () => {
      const mockChanceService = {
        calculateForDisplay: jest.fn().mockReturnValue({
          displayText: '50%',
          activeTags: ['first', 'second', 'third'],
        }),
      };

      const result = formatter.formatMultiTarget(
        {
          template: 'attack {target} ({chance}% chance)',
          chanceBased: { enabled: true },
        },
        { primary: [{ id: 't1', displayName: 'Target' }] },
        {},
        { chanceCalculationService: mockChanceService, actorId: 'a1' },
        { targetDefinitions: { primary: { placeholder: 'target' } } }
      );

      const command = result.value[0].command;
      const firstIndex = command.indexOf('[first]');
      const secondIndex = command.indexOf('[second]');
      const thirdIndex = command.indexOf('[third]');

      expect(firstIndex).toBeLessThan(secondIndex);
      expect(secondIndex).toBeLessThan(thirdIndex);
    });
  });
});
```

## Acceptance Criteria

### Tests That Must Pass

1. **All New Tests**:
   - `npm run test:unit -- --testPathPattern="ModifierContextBuilder" --silent` must pass
   - `npm run test:unit -- --testPathPattern="ModifierCollectorService.modifiers" --silent` must pass
   - `npm run test:unit -- --testPathPattern="ChanceCalculationService.modifiers" --silent` must pass
   - `npm run test:unit -- --testPathPattern="MultiTargetActionFormatter.tags" --silent` must pass

2. **Coverage Requirements**:
   - ModifierContextBuilder: ≥90% line coverage
   - ModifierCollectorService (new code): ≥85% line coverage
   - ChanceCalculationService (new code): ≥85% line coverage
   - MultiTargetActionFormatter (tag code): ≥80% line coverage

3. **Existing Tests**:
   - `npm run test:unit -- --testPathPattern="combat" --silent` must pass
   - `npm run test:unit -- --testPathPattern="formatters" --silent` must pass

### Invariants That Must Remain True

1. **Test Isolation**:
   - All tests must use mocks for dependencies
   - No tests should require real entities or game state
   - Each test file should be runnable in isolation

2. **Test Quality**:
   - Each test should test one behavior
   - Test names should clearly describe expected behavior
   - Edge cases should be covered

## Verification Commands

```bash
# Run all new unit tests
npm run test:unit -- --testPathPattern="ModifierContextBuilder|ModifierCollectorService.modifiers|ChanceCalculationService.modifiers|MultiTargetActionFormatter.tags" --silent

# Run with coverage
npm run test:unit -- --testPathPattern="ModifierContextBuilder" --coverage

# Check all combat tests still pass
npm run test:unit -- --testPathPattern="combat" --silent
```

## Dependencies

- **Depends on**: DATDRIMODSYS-002, DATDRIMODSYS-003, DATDRIMODSYS-004, DATDRIMODSYS-005 (must have implementations to test)
- **Blocks**: None (unit tests can be written alongside implementation)

## Notes

- Test file naming follows the project convention: `[ComponentName].test.js` for new files, `[ComponentName].[aspect].test.js` for additional test files
- Uses Jest with `@jest/globals` imports per project convention
- Mocks should validate dependency injection contracts
- Consider using test helpers from `/tests/common/` where applicable
