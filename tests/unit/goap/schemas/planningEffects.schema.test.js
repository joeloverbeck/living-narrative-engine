/**
 * @file Tests for planning effects JSON schema validation
 */

import { describe, it, expect, beforeAll } from '@jest/globals';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const currentFilename = fileURLToPath(import.meta.url);
const currentDirname = dirname(currentFilename);

describe('Planning Effects Schema', () => {
  let ajv;
  let schema;

  beforeAll(() => {
    // Load schema
    const schemaPath = join(
      currentDirname,
      '../../../../data/schemas/planning-effects.schema.json'
    );
    schema = JSON.parse(readFileSync(schemaPath, 'utf8'));

    // Initialize AJV
    ajv = new Ajv({ allErrors: true, strict: true });
    addFormats(ajv);
  });

  describe('Valid Planning Effects', () => {
    it('should validate minimal planning effects with single effect', () => {
      const planningEffects = {
        effects: [
          {
            operation: 'ADD_COMPONENT',
            entity: 'actor',
            component: 'positioning:sitting',
          },
        ],
      };

      const valid = ajv.validate(schema, planningEffects);
      if (!valid) {
        console.error('Validation errors:', ajv.errors);
      }
      expect(valid).toBe(true);
    });

    it('should validate planning effects with multiple effects', () => {
      const planningEffects = {
        effects: [
          {
            operation: 'REMOVE_COMPONENT',
            entity: 'actor',
            component: 'positioning:standing',
          },
          {
            operation: 'ADD_COMPONENT',
            entity: 'actor',
            component: 'positioning:sitting',
          },
        ],
      };

      const valid = ajv.validate(schema, planningEffects);
      expect(valid).toBe(true);
    });

    it('should validate planning effects with cost', () => {
      const planningEffects = {
        effects: [
          {
            operation: 'ADD_COMPONENT',
            entity: 'target',
            component: 'test:component',
          },
        ],
        cost: 1.5,
      };

      const valid = ajv.validate(schema, planningEffects);
      expect(valid).toBe(true);
    });

    it('should validate planning effects with dynamic cost', () => {
      const planningEffects = {
        effects: [
          {
            operation: 'MODIFY_COMPONENT',
            entity: 'actor',
            component: 'core:health',
            updates: { value: 100 },
          },
        ],
        cost: {
          base: 1.0,
          factors: ['distance', 'complexity'],
        },
      };

      const valid = ajv.validate(schema, planningEffects);
      expect(valid).toBe(true);
    });

    it('should validate planning effects with abstract preconditions', () => {
      const planningEffects = {
        effects: [
          {
            operation: 'CONDITIONAL',
            condition: {
              abstractPrecondition: 'targetIsFriendly',
              params: ['actor', 'target'],
            },
            then: [
              {
                operation: 'ADD_COMPONENT',
                entity: 'actor',
                component: 'test:happy',
              },
            ],
          },
        ],
        abstractPreconditions: {
          targetIsFriendly: {
            description: 'Checks if target is friendly towards actor',
            parameters: ['actor', 'target'],
            simulationFunction: 'assumeTrue',
          },
        },
      };

      const valid = ajv.validate(schema, planningEffects);
      expect(valid).toBe(true);
    });
  });

  describe('Effect Types', () => {
    describe('ADD_COMPONENT Effect', () => {
      it('should validate add component effect with data', () => {
        const planningEffects = {
          effects: [
            {
              operation: 'ADD_COMPONENT',
              entity: 'actor',
              component: 'positioning:sitting',
              data: { comfort: 'high' },
            },
          ],
        };

        const valid = ajv.validate(schema, planningEffects);
        expect(valid).toBe(true);
      });

      it('should validate add component effect without data', () => {
        const planningEffects = {
          effects: [
            {
              operation: 'ADD_COMPONENT',
              entity: 'tertiary_target',
              component: 'test:marker',
            },
          ],
        };

        const valid = ajv.validate(schema, planningEffects);
        expect(valid).toBe(true);
      });

      it('should reject add component without required fields', () => {
        const planningEffects = {
          effects: [
            {
              operation: 'ADD_COMPONENT',
              entity: 'actor',
              // Missing component
            },
          ],
        };

        const valid = ajv.validate(schema, planningEffects);
        expect(valid).toBe(false);
      });

      it('should reject invalid entity value', () => {
        const planningEffects = {
          effects: [
            {
              operation: 'ADD_COMPONENT',
              entity: 'invalid_entity',
              component: 'test:component',
            },
          ],
        };

        const valid = ajv.validate(schema, planningEffects);
        expect(valid).toBe(false);
      });

      it('should reject invalid component format', () => {
        const planningEffects = {
          effects: [
            {
              operation: 'ADD_COMPONENT',
              entity: 'actor',
              component: 'invalid-component-format', // No colon
            },
          ],
        };

        const valid = ajv.validate(schema, planningEffects);
        expect(valid).toBe(false);
      });
    });

    describe('REMOVE_COMPONENT Effect', () => {
      it('should validate remove component effect', () => {
        const planningEffects = {
          effects: [
            {
              operation: 'REMOVE_COMPONENT',
              entity: 'target',
              component: 'positioning:standing',
            },
          ],
        };

        const valid = ajv.validate(schema, planningEffects);
        expect(valid).toBe(true);
      });

      it('should reject remove component without required fields', () => {
        const planningEffects = {
          effects: [
            {
              operation: 'REMOVE_COMPONENT',
              entity: 'actor',
              // Missing component
            },
          ],
        };

        const valid = ajv.validate(schema, planningEffects);
        expect(valid).toBe(false);
      });
    });

    describe('MODIFY_COMPONENT Effect', () => {
      it('should validate modify component effect', () => {
        const planningEffects = {
          effects: [
            {
              operation: 'MODIFY_COMPONENT',
              entity: 'actor',
              component: 'core:position',
              updates: { location: 'bedroom' },
            },
          ],
        };

        const valid = ajv.validate(schema, planningEffects);
        expect(valid).toBe(true);
      });

      it('should reject modify component without updates', () => {
        const planningEffects = {
          effects: [
            {
              operation: 'MODIFY_COMPONENT',
              entity: 'actor',
              component: 'core:position',
              // Missing updates
            },
          ],
        };

        const valid = ajv.validate(schema, planningEffects);
        expect(valid).toBe(false);
      });

      it('should validate modify component with nested updates', () => {
        const planningEffects = {
          effects: [
            {
              operation: 'MODIFY_COMPONENT',
              entity: 'target',
              component: 'items:container',
              updates: {
                isOpen: true,
                contents: {
                  itemCount: 5,
                },
              },
            },
          ],
        };

        const valid = ajv.validate(schema, planningEffects);
        expect(valid).toBe(true);
      });
    });

    describe('CONDITIONAL Effect', () => {
      it('should validate conditional effect with simple condition', () => {
        const planningEffects = {
          effects: [
            {
              operation: 'CONDITIONAL',
              condition: { '==': [{ var: 'x' }, 5] },
              then: [
                {
                  operation: 'ADD_COMPONENT',
                  entity: 'actor',
                  component: 'test:component',
                },
              ],
            },
          ],
        };

        const valid = ajv.validate(schema, planningEffects);
        expect(valid).toBe(true);
      });

      it('should validate conditional effect with nested effects', () => {
        const planningEffects = {
          effects: [
            {
              operation: 'CONDITIONAL',
              condition: { var: 'hasSpace' },
              then: [
                {
                  operation: 'REMOVE_COMPONENT',
                  entity: 'actor',
                  component: 'items:in_inventory',
                },
                {
                  operation: 'ADD_COMPONENT',
                  entity: 'target',
                  component: 'items:in_inventory',
                },
              ],
            },
          ],
        };

        const valid = ajv.validate(schema, planningEffects);
        expect(valid).toBe(true);
      });

      it('should reject conditional effect without required fields', () => {
        const planningEffects = {
          effects: [
            {
              operation: 'CONDITIONAL',
              condition: { var: 'x' },
              // Missing then
            },
          ],
        };

        const valid = ajv.validate(schema, planningEffects);
        expect(valid).toBe(false);
      });
    });
  });

  describe('Cost Validation', () => {
    it('should accept zero cost', () => {
      const planningEffects = {
        effects: [
          {
            operation: 'ADD_COMPONENT',
            entity: 'actor',
            component: 'test:free',
          },
        ],
        cost: 0,
      };

      const valid = ajv.validate(schema, planningEffects);
      expect(valid).toBe(true);
    });

    it('should reject negative cost', () => {
      const planningEffects = {
        effects: [
          {
            operation: 'ADD_COMPONENT',
            entity: 'actor',
            component: 'test:component',
          },
        ],
        cost: -1,
      };

      const valid = ajv.validate(schema, planningEffects);
      expect(valid).toBe(false);
    });

    it('should accept large cost values', () => {
      const planningEffects = {
        effects: [
          {
            operation: 'ADD_COMPONENT',
            entity: 'actor',
            component: 'test:expensive',
          },
        ],
        cost: 999.9,
      };

      const valid = ajv.validate(schema, planningEffects);
      expect(valid).toBe(true);
    });

    it('should validate dynamic cost with factors', () => {
      const planningEffects = {
        effects: [
          {
            operation: 'ADD_COMPONENT',
            entity: 'actor',
            component: 'test:component',
          },
        ],
        cost: {
          base: 2.5,
          factors: ['distance', 'weight', 'urgency'],
        },
      };

      const valid = ajv.validate(schema, planningEffects);
      expect(valid).toBe(true);
    });

    it('should reject dynamic cost with negative base', () => {
      const planningEffects = {
        effects: [
          {
            operation: 'ADD_COMPONENT',
            entity: 'actor',
            component: 'test:component',
          },
        ],
        cost: {
          base: -1,
          factors: [],
        },
      };

      const valid = ajv.validate(schema, planningEffects);
      expect(valid).toBe(false);
    });
  });

  describe('Abstract Preconditions', () => {
    it('should validate abstract precondition definition', () => {
      const planningEffects = {
        effects: [
          {
            operation: 'ADD_COMPONENT',
            entity: 'actor',
            component: 'test:component',
          },
        ],
        abstractPreconditions: {
          checkFriendship: {
            description: 'Checks if entities are friends',
            parameters: ['actor', 'target'],
            simulationFunction: 'assumeTrue',
          },
        },
      };

      const valid = ajv.validate(schema, planningEffects);
      expect(valid).toBe(true);
    });

    it('should validate multiple abstract preconditions', () => {
      const planningEffects = {
        effects: [
          {
            operation: 'ADD_COMPONENT',
            entity: 'actor',
            component: 'test:component',
          },
        ],
        abstractPreconditions: {
          precond1: {
            description: 'First precondition',
            parameters: ['actor'],
            simulationFunction: 'assumeTrue',
          },
          precond2: {
            description: 'Second precondition',
            parameters: ['target'],
            simulationFunction: 'assumeFalse',
          },
        },
      };

      const valid = ajv.validate(schema, planningEffects);
      expect(valid).toBe(true);
    });

    it('should reject abstract precondition without required fields', () => {
      const planningEffects = {
        effects: [
          {
            operation: 'ADD_COMPONENT',
            entity: 'actor',
            component: 'test:component',
          },
        ],
        abstractPreconditions: {
          incomplete: {
            description: 'Incomplete precondition',
            // Missing parameters and simulationFunction
          },
        },
      };

      const valid = ajv.validate(schema, planningEffects);
      expect(valid).toBe(false);
    });

    it('should validate empty parameters array', () => {
      const planningEffects = {
        effects: [
          {
            operation: 'ADD_COMPONENT',
            entity: 'actor',
            component: 'test:component',
          },
        ],
        abstractPreconditions: {
          noParams: {
            description: 'Precondition with no parameters',
            parameters: [],
            simulationFunction: 'assumeTrue',
          },
        },
      };

      const valid = ajv.validate(schema, planningEffects);
      expect(valid).toBe(true);
    });
  });

  describe('Invalid Structures', () => {
    it('should reject planning effects without effects array', () => {
      const planningEffects = {
        cost: 1.0,
        // Missing effects
      };

      const valid = ajv.validate(schema, planningEffects);
      expect(valid).toBe(false);
    });

    it('should reject empty effects array', () => {
      const planningEffects = {
        effects: [],
      };

      const valid = ajv.validate(schema, planningEffects);
      expect(valid).toBe(false);
    });

    it('should reject effect with invalid operation type', () => {
      const planningEffects = {
        effects: [
          {
            operation: 'INVALID_OPERATION',
            entity: 'actor',
            component: 'test:component',
          },
        ],
      };

      const valid = ajv.validate(schema, planningEffects);
      expect(valid).toBe(false);
    });

    it('should reject planning effects with additional properties at root', () => {
      const planningEffects = {
        effects: [
          {
            operation: 'ADD_COMPONENT',
            entity: 'actor',
            component: 'test:component',
          },
        ],
        invalidProperty: 'should not be here',
      };

      const valid = ajv.validate(schema, planningEffects);
      expect(valid).toBe(false);
    });
  });

  describe('Complex Scenarios', () => {
    it('should validate complex planning effects with all features', () => {
      const planningEffects = {
        effects: [
          {
            operation: 'REMOVE_COMPONENT',
            entity: 'actor',
            component: 'positioning:standing',
          },
          {
            operation: 'ADD_COMPONENT',
            entity: 'actor',
            component: 'positioning:sitting',
            data: { comfort: 'medium' },
          },
          {
            operation: 'CONDITIONAL',
            condition: {
              abstractPrecondition: 'targetNearby',
              params: ['actor', 'target'],
            },
            then: [
              {
                operation: 'MODIFY_COMPONENT',
                entity: 'actor',
                component: 'social:closeness',
                updates: { targetId: '{targetId}', value: 'close' },
              },
            ],
          },
        ],
        cost: {
          base: 1.0,
          factors: ['distance'],
        },
        abstractPreconditions: {
          targetNearby: {
            description: 'Checks if target is nearby',
            parameters: ['actor', 'target'],
            simulationFunction: 'evaluateAtRuntime',
          },
        },
      };

      const valid = ajv.validate(schema, planningEffects);
      if (!valid) {
        console.error('Validation errors:', ajv.errors);
      }
      expect(valid).toBe(true);
    });

    it('should validate nested conditional effects', () => {
      const planningEffects = {
        effects: [
          {
            operation: 'CONDITIONAL',
            condition: { var: 'x' },
            then: [
              {
                operation: 'CONDITIONAL',
                condition: { var: 'y' },
                then: [
                  {
                    operation: 'ADD_COMPONENT',
                    entity: 'actor',
                    component: 'test:nested',
                  },
                ],
              },
            ],
          },
        ],
      };

      const valid = ajv.validate(schema, planningEffects);
      expect(valid).toBe(true);
    });
  });
});
