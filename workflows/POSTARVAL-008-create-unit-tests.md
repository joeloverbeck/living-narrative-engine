# POSTARVAL-008: Create Unit Tests

## Overview
Create comprehensive unit tests for all new validation components, ensuring robust test coverage for schema validation, the TargetComponentValidator class, and the pipeline stage.

## Prerequisites
- POSTARVAL-001: Schema definition complete
- POSTARVAL-002: TargetComponentValidator implemented
- POSTARVAL-003: Pipeline stage created

## Objectives
1. Create schema validation unit tests
2. Test TargetComponentValidator in isolation
3. Test pipeline stage unit behavior
4. Achieve >95% code coverage
5. Cover edge cases and error conditions

## Implementation Steps

### 1. Schema Validation Tests
Create `tests/unit/schemas/actionSchemaTargetValidation.test.js`

```javascript
import { describe, it, expect, beforeEach } from '@jest/globals';
import { AjvSchemaValidator } from '../../../src/validation/AjvSchemaValidator.js';

describe('Action Schema - Target Forbidden Components', () => {
  let validator;

  beforeEach(() => {
    validator = new AjvSchemaValidator();
    // Load action schema
  });

  describe('single-target validation', () => {
    it('should accept target forbidden components', () => {
      const actionDef = {
        "$schema": "schema://living-narrative-engine/action.schema.json",
        "id": "test:action",
        "name": "Test Action",
        "forbidden_components": {
          "actor": ["comp:actor_forbidden"],
          "target": ["comp:target_forbidden"]
        }
      };

      expect(validator.validate(actionDef, 'action')).toBe(true);
    });

    it('should accept empty target forbidden components', () => {
      const actionDef = {
        "id": "test:action",
        "forbidden_components": {
          "target": []
        }
      };

      expect(validator.validate(actionDef, 'action')).toBe(true);
    });

    it('should reject invalid component ID format', () => {
      const actionDef = {
        "id": "test:action",
        "forbidden_components": {
          "target": ["invalid-format"] // Missing namespace
        }
      };

      expect(validator.validate(actionDef, 'action')).toBe(false);
      expect(validator.getErrors()).toContain('pattern');
    });
  });

  describe('multi-target validation', () => {
    it('should accept primary target forbidden components', () => {
      const actionDef = {
        "id": "test:action",
        "forbidden_components": {
          "primary": ["positioning:kneeling_before"]
        }
      };

      expect(validator.validate(actionDef, 'action')).toBe(true);
    });

    it('should accept all target roles', () => {
      const actionDef = {
        "id": "test:action",
        "forbidden_components": {
          "primary": ["comp:primary"],
          "secondary": ["comp:secondary"],
          "tertiary": ["comp:tertiary"]
        }
      };

      expect(validator.validate(actionDef, 'action')).toBe(true);
    });

    it('should reject unknown target roles', () => {
      const actionDef = {
        "id": "test:action",
        "forbidden_components": {
          "quaternary": ["comp:invalid"] // Not a valid role
        }
      };

      expect(validator.validate(actionDef, 'action')).toBe(false);
    });
  });

  describe('backward compatibility', () => {
    it('should accept actor-only forbidden components', () => {
      const actionDef = {
        "id": "test:action",
        "forbidden_components": {
          "actor": ["comp:forbidden"]
        }
      };

      expect(validator.validate(actionDef, 'action')).toBe(true);
    });

    it('should accept actions without forbidden_components', () => {
      const actionDef = {
        "id": "test:action",
        "name": "Simple Action"
      };

      expect(validator.validate(actionDef, 'action')).toBe(true);
    });
  });
});
```

### 2. TargetComponentValidator Tests
Create `tests/unit/actions/validation/TargetComponentValidator.test.js`

```javascript
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { TargetComponentValidator } from '../../../../src/actions/validation/TargetComponentValidator.js';

describe('TargetComponentValidator', () => {
  let validator;
  let mockLogger;
  let mockEntityManager;

  beforeEach(() => {
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn()
    };

    mockEntityManager = {
      getEntity: jest.fn(),
      hasComponent: jest.fn()
    };

    validator = new TargetComponentValidator({
      logger: mockLogger,
      entityManager: mockEntityManager
    });
  });

  describe('validateTargetComponents', () => {
    describe('single-target validation', () => {
      it('should return valid when target lacks forbidden components', () => {
        const actionDef = {
          forbidden_components: {
            target: ['positioning:kneeling_before']
          }
        };

        const targetEntity = {
          id: 'target1',
          components: {
            'core:actor': {},
            'core:position': {}
          }
        };

        const result = validator.validateTargetComponents(actionDef, {
          target: targetEntity
        });

        expect(result.valid).toBe(true);
      });

      it('should return invalid when target has forbidden component', () => {
        const actionDef = {
          forbidden_components: {
            target: ['positioning:kneeling_before']
          }
        };

        const targetEntity = {
          id: 'target1',
          components: {
            'positioning:kneeling_before': { entityId: 'other' }
          }
        };

        const result = validator.validateTargetComponents(actionDef, {
          target: targetEntity
        });

        expect(result.valid).toBe(false);
        expect(result.reason).toContain('forbidden component');
        expect(result.targetId).toBe('target1');
      });

      it('should check multiple forbidden components', () => {
        const actionDef = {
          forbidden_components: {
            target: ['comp:a', 'comp:b', 'comp:c']
          }
        };

        const targetEntity = {
          id: 'target1',
          components: {
            'comp:b': {}  // Has one of the forbidden
          }
        };

        const result = validator.validateTargetComponents(actionDef, {
          target: targetEntity
        });

        expect(result.valid).toBe(false);
      });
    });

    describe('multi-target validation', () => {
      it('should validate primary target', () => {
        const actionDef = {
          forbidden_components: {
            primary: ['positioning:kneeling_before']
          }
        };

        const targets = {
          primary: {
            id: 'primary1',
            components: {
              'positioning:kneeling_before': {}
            }
          }
        };

        const result = validator.validateTargetComponents(actionDef, targets);

        expect(result.valid).toBe(false);
        expect(result.targetRole).toBe('primary');
      });

      it('should validate all target roles', () => {
        const actionDef = {
          forbidden_components: {
            primary: ['comp:a'],
            secondary: ['comp:b'],
            tertiary: ['comp:c']
          }
        };

        const targets = {
          primary: { id: 't1', components: {} },
          secondary: { id: 't2', components: { 'comp:b': {} } }, // Invalid
          tertiary: { id: 't3', components: {} }
        };

        const result = validator.validateTargetComponents(actionDef, targets);

        expect(result.valid).toBe(false);
        expect(result.targetRole).toBe('secondary');
      });

      it('should handle missing optional targets', () => {
        const actionDef = {
          forbidden_components: {
            primary: ['comp:a'],
            secondary: ['comp:b']
          }
        };

        const targets = {
          primary: { id: 't1', components: {} }
          // secondary not provided
        };

        const result = validator.validateTargetComponents(actionDef, targets);

        expect(result.valid).toBe(true);
      });
    });

    describe('edge cases', () => {
      it('should handle null forbidden_components', () => {
        const actionDef = {};
        const targets = { target: { id: 't1', components: {} } };

        const result = validator.validateTargetComponents(actionDef, targets);

        expect(result.valid).toBe(true);
      });

      it('should handle null target entities', () => {
        const actionDef = {
          forbidden_components: { target: ['comp:a'] }
        };

        const result = validator.validateTargetComponents(actionDef, {});

        expect(result.valid).toBe(true);
      });

      it('should handle entity without components property', () => {
        const actionDef = {
          forbidden_components: { target: ['comp:a'] }
        };

        const targetEntity = { id: 't1' }; // No components property

        const result = validator.validateTargetComponents(actionDef, {
          target: targetEntity
        });

        expect(result.valid).toBe(true);
      });
    });

    describe('performance', () => {
      it('should validate quickly with many forbidden components', () => {
        const forbiddenComponents = Array.from({ length: 100 }, (_, i) => `comp:${i}`);
        const actionDef = {
          forbidden_components: { target: forbiddenComponents }
        };

        const targetEntity = {
          id: 't1',
          components: { 'other:comp': {} }
        };

        const start = performance.now();
        validator.validateTargetComponents(actionDef, { target: targetEntity });
        const duration = performance.now() - start;

        expect(duration).toBeLessThan(5);
      });
    });
  });

  describe('validateEntityComponents', () => {
    it('should return valid for empty forbidden list', () => {
      const entity = { id: 'e1', components: { 'comp:a': {} } };
      const result = validator.validateEntityComponents(entity, []);

      expect(result.valid).toBe(true);
    });

    it('should identify specific forbidden component', () => {
      const entity = {
        id: 'e1',
        components: { 'comp:forbidden': {} }
      };

      const result = validator.validateEntityComponents(entity, ['comp:forbidden']);

      expect(result.valid).toBe(false);
      expect(result.component).toBe('comp:forbidden');
    });
  });
});
```

### 3. Pipeline Stage Tests
Create `tests/unit/actions/pipeline/stages/TargetComponentValidationStage.test.js`

```javascript
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { TargetComponentValidationStage } from '../../../../../src/actions/pipeline/stages/TargetComponentValidationStage.js';

describe('TargetComponentValidationStage', () => {
  let stage;
  let mockDependencies;

  beforeEach(() => {
    mockDependencies = {
      logger: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn()
      },
      entityManager: {
        getEntity: jest.fn()
      },
      targetComponentValidator: {
        validateTargetComponents: jest.fn()
      },
      performanceMonitor: {
        record: jest.fn()
      }
    };

    stage = new TargetComponentValidationStage(mockDependencies);
  });

  describe('process', () => {
    it('should filter actions with invalid targets', async () => {
      const actionCandidates = [
        {
          actionId: 'action1',
          actionDef: { forbidden_components: { target: ['comp:forbidden'] } },
          targets: { target: { id: 't1' } }
        },
        {
          actionId: 'action2',
          actionDef: { forbidden_components: { target: ['comp:forbidden'] } },
          targets: { target: { id: 't2' } }
        }
      ];

      mockDependencies.targetComponentValidator.validateTargetComponents
        .mockReturnValueOnce({ valid: false, reason: 'forbidden' })
        .mockReturnValueOnce({ valid: true });

      const result = await stage.process(actionCandidates, {});

      expect(result).toHaveLength(1);
      expect(result[0].actionId).toBe('action2');
    });

    it('should handle actions without forbidden_components', async () => {
      const actionCandidates = [
        {
          actionId: 'action1',
          actionDef: {}, // No forbidden_components
          targets: { target: { id: 't1' } }
        }
      ];

      const result = await stage.process(actionCandidates, {});

      expect(result).toHaveLength(1);
      expect(mockDependencies.targetComponentValidator.validateTargetComponents).not.toHaveBeenCalled();
    });

    it('should log performance metrics', async () => {
      const actionCandidates = [
        {
          actionId: 'action1',
          actionDef: { forbidden_components: { target: ['comp:a'] } },
          targets: { target: { id: 't1' } }
        }
      ];

      mockDependencies.targetComponentValidator.validateTargetComponents
        .mockReturnValue({ valid: true });

      await stage.process(actionCandidates, {});

      expect(mockDependencies.logger.debug).toHaveBeenCalledWith(
        expect.stringContaining('validation completed')
      );
    });

    it('should handle validation errors gracefully', async () => {
      const actionCandidates = [
        {
          actionId: 'action1',
          actionDef: { forbidden_components: { target: ['comp:a'] } },
          targets: { target: { id: 't1' } }
        }
      ];

      mockDependencies.targetComponentValidator.validateTargetComponents
        .mockImplementation(() => {
          throw new Error('Validation error');
        });

      await stage.process(actionCandidates, {});

      expect(mockDependencies.logger.error).toHaveBeenCalled();
    });
  });
});
```

## Success Criteria
- [ ] All schema validation tests pass
- [ ] TargetComponentValidator tests achieve >95% coverage
- [ ] Pipeline stage tests achieve >95% coverage
- [ ] Edge cases and error conditions covered
- [ ] Performance tests validate speed requirements
- [ ] Tests follow project testing patterns

## Files to Create
- `tests/unit/schemas/actionSchemaTargetValidation.test.js`
- `tests/unit/actions/validation/TargetComponentValidator.test.js`
- `tests/unit/actions/pipeline/stages/TargetComponentValidationStage.test.js`

## Dependencies
- POSTARVAL-001: Schema definition
- POSTARVAL-002: Validator implementation
- POSTARVAL-003: Pipeline stage implementation

## Estimated Time
4-5 hours

## Notes
- Use existing test patterns from the project
- Ensure tests are isolated and don't depend on external state
- Mock all dependencies appropriately
- Include performance benchmarks where relevant