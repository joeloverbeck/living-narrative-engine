import { describe, expect, it } from '@jest/globals';

import {
  createActionComposite,
  validateVisualProperties,
} from '../../../../src/turns/dtos/actionComposite';
import { MAX_AVAILABLE_ACTIONS_PER_TURN } from '../../../../src/constants/core.js';
import {
  assertVisualPropertiesFrozen,
  createMockActionCompositeWithVisual,
} from '../../../common/mockFactories/visualProperties.js';

describe('createActionComposite', () => {
  it('should create a valid, frozen ActionComposite', () => {
    const params = { targetId: 'rat_01' };
    const ac = createActionComposite(
      1,
      'core:attack',
      'attack rat',
      params,
      'Attack the rat'
    );
    expect(ac).toEqual({
      index: 1,
      actionId: 'core:attack',
      commandString: 'attack rat',
      params,
      description: 'Attack the rat',
      visual: null,
    });
    expect(Object.isFrozen(ac)).toBe(true);
  });

  it('should reject out-of-range indices', () => {
    expect(() => createActionComposite(0, 'a', 'b', {}, 'c')).toThrow(/index/);
    expect(() =>
      createActionComposite(
        MAX_AVAILABLE_ACTIONS_PER_TURN + 1,
        'a',
        'b',
        {},
        'c'
      )
    ).toThrow(/index/);
  });

  it('should reject empty or non-string actionId/commandString/description', () => {
    const bad = () => createActionComposite(1, '', 'cmd', {}, 'desc');
    expect(bad).toThrow(/actionId/);
    expect(() => createActionComposite(1, 'aid', '   ', {}, 'desc')).toThrow(
      /commandString/
    );
    expect(() => createActionComposite(1, 'aid', 'cmd', {}, '')).toThrow(
      /description/
    );
  });

  it('should reject non-object or null params', () => {
    expect(() => createActionComposite(1, 'aid', 'cmd', null, 'desc')).toThrow(
      /params/
    );
    expect(() => createActionComposite(1, 'aid', 'cmd', [], 'desc')).toThrow(
      /params/
    );
  });
});

describe('ActionComposite - Visual Properties', () => {
  describe('creation with visual properties', () => {
    it('should create composite with valid visual properties', () => {
      const composite = createActionComposite(
        1,
        'test:action',
        'test command',
        {},
        'Test description',
        {
          backgroundColor: '#ff0000',
          textColor: '#ffffff',
        }
      );

      expect(composite.visual).toBeDefined();
      expect(composite.visual.backgroundColor).toBe('#ff0000');
      expect(composite.visual.textColor).toBe('#ffffff');
      expect(Object.isFrozen(composite.visual)).toBe(true);
    });

    it('should create composite without visual properties', () => {
      const composite = createActionComposite(
        1,
        'test:action',
        'test command',
        {},
        'Test description'
      );

      expect(composite.visual).toBeNull();
    });

    it('should create composite with null visual properties', () => {
      const composite = createActionComposite(
        1,
        'test:action',
        'test command',
        {},
        'Test description',
        null
      );

      expect(composite.visual).toBeNull();
    });
  });

  describe('visual properties validation', () => {
    it('should accept valid hex colors', () => {
      expect(() =>
        createActionComposite(1, 'test:action', 'cmd', {}, 'desc', {
          backgroundColor: '#ff0000',
          textColor: '#fff',
        })
      ).not.toThrow();
    });

    it('should accept valid rgb colors', () => {
      expect(() =>
        createActionComposite(1, 'test:action', 'cmd', {}, 'desc', {
          backgroundColor: 'rgb(255, 0, 0)',
          textColor: 'rgba(255, 255, 255, 0.5)',
        })
      ).not.toThrow();
    });

    it('should accept valid named colors', () => {
      expect(() =>
        createActionComposite(1, 'test:action', 'cmd', {}, 'desc', {
          backgroundColor: 'red',
          textColor: 'white',
        })
      ).not.toThrow();
    });

    it('should reject invalid color formats', () => {
      expect(() =>
        createActionComposite(1, 'test:action', 'cmd', {}, 'desc', {
          backgroundColor: '#gg0000',
        })
      ).toThrow(/Invalid backgroundColor/);

      expect(() =>
        createActionComposite(1, 'test:action', 'cmd', {}, 'desc', {
          textColor: 'notacolor123',
        })
      ).toThrow(/Invalid textColor/);
    });

    it('should reject non-object visual properties', () => {
      expect(() =>
        createActionComposite(1, 'test:action', 'cmd', {}, 'desc', 'invalid')
      ).toThrow(/must be a non-null object/);

      expect(() =>
        createActionComposite(1, 'test:action', 'cmd', {}, 'desc', [])
      ).toThrow(/must be a non-null object/);
    });

    it('should warn about unknown properties', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      createActionComposite(1, 'test:action', 'cmd', {}, 'desc', {
        backgroundColor: 'red',
        unknownProp: 'value',
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Unknown visual property "unknownProp"')
      );
      consoleSpy.mockRestore();
    });

    it('should accept all valid color properties', () => {
      expect(() =>
        createActionComposite(1, 'test:action', 'cmd', {}, 'desc', {
          backgroundColor: '#ff0000',
          textColor: '#ffffff',
          hoverBackgroundColor: 'rgba(255, 0, 0, 0.8)',
          hoverTextColor: 'rgb(255, 255, 255)',
        })
      ).not.toThrow();
    });
  });
});

describe('validateVisualProperties', () => {
  it('should validate valid visual properties without throwing', () => {
    expect(() =>
      validateVisualProperties({
        backgroundColor: '#ff0000',
        textColor: 'white',
      })
    ).not.toThrow();
  });

  it('should throw for invalid color values', () => {
    expect(() =>
      validateVisualProperties({
        backgroundColor: 'invalid-color',
      })
    ).toThrow(/Invalid backgroundColor/);
  });

  it('should throw for non-object input', () => {
    expect(() => validateVisualProperties('not-object')).toThrow(
      /must be a non-null object/
    );
    expect(() => validateVisualProperties(null)).toThrow(
      /must be a non-null object/
    );
    expect(() => validateVisualProperties([])).toThrow(
      /must be a non-null object/
    );
  });
});

describe('ActionComposite - Immutability and Deep Freezing', () => {
  it('should deeply freeze visual properties object', () => {
    const composite = createActionComposite(
      1,
      'test:action',
      'test command',
      {},
      'Test description',
      {
        backgroundColor: '#ff0000',
        textColor: '#ffffff',
      }
    );

    // Check that the composite itself is frozen
    expect(Object.isFrozen(composite)).toBe(true);

    // Check that the visual property is frozen
    expect(Object.isFrozen(composite.visual)).toBe(true);

    // Use helper to assert deep freezing
    assertVisualPropertiesFrozen(composite.visual);
  });

  it('should prevent modification of visual properties after creation', () => {
    const composite = createActionComposite(
      1,
      'test:action',
      'test command',
      {},
      'Test description',
      {
        backgroundColor: '#ff0000',
        textColor: '#ffffff',
      }
    );

    // Frozen objects throw TypeError when attempting to modify
    expect(() => {
      composite.visual.backgroundColor = '#00ff00';
    }).toThrow(TypeError);

    expect(() => {
      composite.visual.newProp = 'value';
    }).toThrow(TypeError);

    expect(() => {
      delete composite.visual.textColor;
    }).toThrow(TypeError);

    // Values should remain unchanged
    expect(composite.visual.backgroundColor).toBe('#ff0000');
    expect(composite.visual.textColor).toBe('#ffffff');
    expect(composite.visual.newProp).toBeUndefined();
  });

  it('should freeze params object alongside visual properties', () => {
    const params = { targetId: 'target' };
    const composite = createActionComposite(
      1,
      'test:action',
      'test command',
      params,
      'Test description',
      { backgroundColor: '#ff0000' }
    );

    expect(Object.isFrozen(composite.params)).toBe(true);
  });

  it('should handle null visual properties without breaking immutability', () => {
    const composite = createActionComposite(
      1,
      'test:action',
      'test command',
      {},
      'Test description',
      null
    );

    expect(composite.visual).toBeNull();
    expect(Object.isFrozen(composite)).toBe(true);

    // Attempt to assign visual properties after creation should throw
    expect(() => {
      composite.visual = { backgroundColor: '#ff0000' };
    }).toThrow(TypeError);

    // Value should remain null
    expect(composite.visual).toBeNull();
  });
});

describe('ActionComposite - Error Handling and Messages', () => {
  it('should provide clear error messages for visual property validation failures', () => {
    expect(() =>
      createActionComposite(
        1,
        'test:action',
        'test command',
        {},
        'Test description',
        { backgroundColor: 'invalid-color-value' }
      )
    ).toThrow(/Invalid backgroundColor.*invalid-color-value/);

    expect(() =>
      createActionComposite(
        1,
        'test:action',
        'test command',
        {},
        'Test description',
        { textColor: 123 }
      )
    ).toThrow(/Invalid textColor/);
  });

  it('should provide helpful error context including action ID', () => {
    const actionId = 'custom:special_action';

    expect(() =>
      createActionComposite(
        1,
        actionId,
        'test command',
        {},
        'Test description',
        { backgroundColor: 'not-a-color' }
      )
    ).toThrow(/Invalid backgroundColor/);
  });

  it('should validate all visual properties before throwing', () => {
    const invalidVisual = {
      backgroundColor: 'invalid1',
      textColor: 'invalid2',
      hoverBackgroundColor: 123,
      hoverTextColor: null,
    };

    expect(() =>
      createActionComposite(
        1,
        'test:action',
        'test command',
        {},
        'Test description',
        invalidVisual
      )
    ).toThrow(/Invalid/);
  });

  it('should handle edge case property combinations', () => {
    // Only hover colors without base colors
    const hoverOnly = {
      hoverBackgroundColor: '#ff0000',
      hoverTextColor: '#ffffff',
    };

    const composite = createActionComposite(
      1,
      'test:action',
      'test command',
      {},
      'Test description',
      hoverOnly
    );

    expect(composite.visual.hoverBackgroundColor).toBe('#ff0000');
    expect(composite.visual.hoverTextColor).toBe('#ffffff');
    expect(composite.visual.backgroundColor).toBeUndefined();
    expect(composite.visual.textColor).toBeUndefined();
  });

  it('should maintain property order in visual object', () => {
    const visual = {
      textColor: '#ffffff',
      backgroundColor: '#ff0000',
      hoverTextColor: '#cccccc',
      hoverBackgroundColor: '#cc0000',
    };

    const composite = createActionComposite(
      1,
      'test:action',
      'test command',
      {},
      'Test description',
      visual
    );

    // Properties should exist regardless of order
    expect(composite.visual.backgroundColor).toBe('#ff0000');
    expect(composite.visual.textColor).toBe('#ffffff');
    expect(composite.visual.hoverBackgroundColor).toBe('#cc0000');
    expect(composite.visual.hoverTextColor).toBe('#cccccc');
  });
});
