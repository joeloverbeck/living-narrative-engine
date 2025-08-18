import { describe, expect, it } from '@jest/globals';

import { 
  createActionComposite, 
  validateVisualProperties 
} from '../../../../src/turns/dtos/actionComposite';
import { MAX_AVAILABLE_ACTIONS_PER_TURN } from '../../../../src/constants/core.js';

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
          textColor: '#ffffff'
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
      expect(() => createActionComposite(
        1, 'test:action', 'cmd', {}, 'desc',
        { backgroundColor: '#ff0000', textColor: '#fff' }
      )).not.toThrow();
    });

    it('should accept valid rgb colors', () => {
      expect(() => createActionComposite(
        1, 'test:action', 'cmd', {}, 'desc',
        { backgroundColor: 'rgb(255, 0, 0)', textColor: 'rgba(255, 255, 255, 0.5)' }
      )).not.toThrow();
    });

    it('should accept valid named colors', () => {
      expect(() => createActionComposite(
        1, 'test:action', 'cmd', {}, 'desc',
        { backgroundColor: 'red', textColor: 'white' }
      )).not.toThrow();
    });

    it('should reject invalid color formats', () => {
      expect(() => createActionComposite(
        1, 'test:action', 'cmd', {}, 'desc',
        { backgroundColor: '#gg0000' }
      )).toThrow(/Invalid backgroundColor/);

      expect(() => createActionComposite(
        1, 'test:action', 'cmd', {}, 'desc', 
        { textColor: 'notacolor123' }
      )).toThrow(/Invalid textColor/);
    });

    it('should reject non-object visual properties', () => {
      expect(() => createActionComposite(
        1, 'test:action', 'cmd', {}, 'desc', 'invalid'
      )).toThrow(/must be a non-null object/);
      
      expect(() => createActionComposite(
        1, 'test:action', 'cmd', {}, 'desc', []
      )).toThrow(/must be a non-null object/);
    });

    it('should warn about unknown properties', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      
      createActionComposite(
        1, 'test:action', 'cmd', {}, 'desc',
        { backgroundColor: 'red', unknownProp: 'value' }
      );
      
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Unknown visual property "unknownProp"')
      );
      consoleSpy.mockRestore();
    });

    it('should accept all valid color properties', () => {
      expect(() => createActionComposite(
        1, 'test:action', 'cmd', {}, 'desc',
        {
          backgroundColor: '#ff0000',
          textColor: '#ffffff',
          hoverBackgroundColor: 'rgba(255, 0, 0, 0.8)',
          hoverTextColor: 'rgb(255, 255, 255)'
        }
      )).not.toThrow();
    });
  });
});

describe('validateVisualProperties', () => {
  it('should validate valid visual properties without throwing', () => {
    expect(() => validateVisualProperties({
      backgroundColor: '#ff0000',
      textColor: 'white'
    })).not.toThrow();
  });

  it('should throw for invalid color values', () => {
    expect(() => validateVisualProperties({
      backgroundColor: 'invalid-color'
    })).toThrow(/Invalid backgroundColor/);
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
