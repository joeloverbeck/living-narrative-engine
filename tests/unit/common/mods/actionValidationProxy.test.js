import { describe, it, expect } from '@jest/globals';
import {
  createActionValidationProxy,
  createRuleValidationProxy,
} from '../../../common/mods/actionValidationProxy.js';

describe('actionValidationProxy - Property Validation', () => {
  it('should accept valid action definitions for scoot closer variants', () => {
    const validActions = [
      {
        id: 'personal-space:scoot_closer',
        name: 'Scoot Closer',
        targets: {
          primary: {
            scope: 'personal-space:closest_leftmost_occupant',
            placeholder: 'someone',
          },
        },
      },
      {
        id: 'personal-space:scoot_closer_right',
        name: 'Scoot Closer Right',
        targets: {
          primary: {
            scope: 'personal-space:furniture_actor_sitting_on',
            placeholder: 'seat',
          },
          secondary: {
            scope: 'personal-space:closest_rightmost_occupant',
            placeholder: 'occupant',
            contextFrom: 'primary',
          },
        },
      },
    ];

    validActions.forEach((action) => {
      expect(() => {
        createActionValidationProxy(action, `Test Action ${action.id}`);
      }).not.toThrow();
    });
  });

  it('should catch typo: action_id instead of id', () => {
    const invalidAction = {
      action_id: 'personal-space:scoot_closer',
      name: 'Scoot Closer',
    };

    expect(() => {
      createActionValidationProxy(invalidAction, 'Test Action');
    }).toThrow(/Invalid property 'action_id'/);
    expect(() => {
      createActionValidationProxy(invalidAction, 'Test Action');
    }).toThrow(/Did you mean 'id'/);
  });

  it('should catch missing required property: id', () => {
    const invalidAction = {
      name: 'Scoot Closer',
    };

    expect(() => {
      createActionValidationProxy(invalidAction, 'Test Action');
    }).toThrow(/missing required property 'id'/);
  });

  it('should catch invalid ID format (missing namespace)', () => {
    const invalidAction = {
      id: 'scoot_closer', // Missing "positioning:" prefix
      name: 'Scoot Closer',
    };

    expect(() => {
      createActionValidationProxy(invalidAction, 'Test Action');
    }).toThrow(/missing namespace separator ':'/);
  });
});

describe('actionValidationProxy - Target Validation', () => {
  it('should catch target_id in action definition', () => {
    const invalidAction = {
      id: 'personal-space:scoot_closer',
      name: 'Scoot Closer',
      targets: {
        primary: {
          scope: 'personal-space:closest_leftmost_occupant',
          placeholder: 'someone',
          target_id: 'should-not-be-here', // Runtime-only property
        },
      },
    };

    expect(() => {
      createActionValidationProxy(invalidAction, 'Test Action');
    }).toThrow(/target_id should not be defined in action file/);
  });

  it('should catch missing required target properties', () => {
    const invalidAction = {
      id: 'personal-space:scoot_closer',
      name: 'Scoot Closer',
      targets: {
        primary: {
          // Missing: scope, placeholder
        },
      },
    };

    expect(() => {
      createActionValidationProxy(invalidAction, 'Test Action');
    }).toThrow(/missing required 'scope' property/);
    expect(() => {
      createActionValidationProxy(invalidAction, 'Test Action');
    }).toThrow(/missing required 'placeholder' property/);
  });

  it('should catch invalid contextFrom value', () => {
    const invalidAction = {
      id: 'personal-space:scoot_closer',
      name: 'Scoot Closer',
      targets: {
        secondary: {
          scope: 'some:scope',
          placeholder: 'something',
          contextFrom: 'tertiary', // Invalid - can only be 'primary' or 'secondary'
        },
      },
    };

    expect(() => {
      createActionValidationProxy(invalidAction, 'Test Action');
    }).toThrow(/Invalid contextFrom 'tertiary'/);
  });

  it('should catch circular contextFrom reference', () => {
    const invalidAction = {
      id: 'personal-space:scoot_closer',
      name: 'Scoot Closer',
      targets: {
        secondary: {
          scope: 'some:scope',
          placeholder: 'something',
          contextFrom: 'secondary', // Circular reference
        },
      },
    };

    expect(() => {
      createActionValidationProxy(invalidAction, 'Test Action');
    }).toThrow(/cannot reference itself in contextFrom/);
  });
});

describe('actionValidationProxy - Component Constraints', () => {
  it('should validate required_components structure', () => {
    const invalidAction = {
      id: 'personal-space:scoot_closer',
      name: 'Scoot Closer',
      required_components: ['sitting-states:sitting_on'], // Should be object, not array
    };

    expect(() => {
      createActionValidationProxy(invalidAction, 'Test Action');
    }).toThrow(/must be an object with role keys/);
  });

  it('should catch invalid role in component constraints', () => {
    const invalidAction = {
      id: 'personal-space:scoot_closer',
      name: 'Scoot Closer',
      required_components: {
        player: ['sitting-states:sitting_on'], // Invalid role - should be 'actor'
      },
    };

    expect(() => {
      createActionValidationProxy(invalidAction, 'Test Action');
    }).toThrow(/Invalid role 'player'/);
  });
});

describe('ruleValidationProxy - Basic Validation', () => {
  it('should accept valid rule definition', () => {
    const validRule = {
      id: 'positioning:handle_scoot_closer',
      operations: [
        {
          operation: 'UPDATE_COMPONENT',
          params: { component: 'sitting-states:sitting_on' },
        },
      ],
    };

    expect(() => {
      createRuleValidationProxy(validRule, 'Test Rule');
    }).not.toThrow();
  });

  it('should catch missing operations array', () => {
    const invalidRule = {
      id: 'positioning:handle_scoot_closer',
      // Missing operations
    };

    expect(() => {
      createRuleValidationProxy(invalidRule, 'Test Rule');
    }).toThrow(/missing required 'operations' or 'actions' array/);
  });
});
