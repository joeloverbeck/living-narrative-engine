/**
 * @file Unit tests for custom Jest action discovery matchers
 * @description Tests the toHaveAction and toDiscoverActionCount matchers
 */

import { describe, it, expect } from '@jest/globals';
import '../../common/actionMatchers.js'; // Auto-extends Jest

describe('actionMatchers - toHaveAction', () => {
  describe('Positive cases', () => {
    it('should pass when action is discovered', () => {
      const actions = [
        { id: 'affection:place_hands_on_shoulders', name: 'Place Hands' },
        { id: 'physical-control:turn_around', name: 'Turn Around' },
      ];

      expect(actions).toHaveAction('affection:place_hands_on_shoulders');
    });

    it('should pass when action is in wrapped object', () => {
      const result = {
        actions: [
          { id: 'affection:place_hands_on_shoulders', name: 'Place Hands' },
        ],
      };

      expect(result).toHaveAction('affection:place_hands_on_shoulders');
    });

    it('should pass with complex action objects', () => {
      const actions = [
        {
          id: 'intimacy:kiss_cheek',
          name: 'Kiss Cheek',
          targets: 'personal-space:close_actors',
          required_components: { actor: ['personal-space-states:closeness'] },
        },
      ];

      expect(actions).toHaveAction('intimacy:kiss_cheek');
    });
  });

  describe('Negative cases', () => {
    it('should fail when action not discovered', () => {
      const actions = [
        { id: 'physical-control:turn_around', name: 'Turn Around' },
        { id: 'deference:kneel_before', name: 'Kneel Before' },
      ];

      expect(() => {
        expect(actions).toHaveAction('affection:place_hands_on_shoulders');
      }).toThrow(/Expected to discover action/);
    });

    it('should fail with detailed error message', () => {
      const actions = [
        { id: 'physical-control:turn_around', name: 'Turn Around' },
        { id: 'deference:kneel_before', name: 'Kneel Before' },
      ];

      let errorMessage;
      try {
        expect(actions).toHaveAction('affection:place_hands_on_shoulders');
      } catch (err) {
        errorMessage = err.message;
      }

      expect(errorMessage).toContain('❌');
      expect(errorMessage).toContain('Actions discovered: 2');
      expect(errorMessage).toContain('1. physical-control:turn_around');
      expect(errorMessage).toContain('2. deference:kneel_before');
      expect(errorMessage).toContain('ComponentFilteringStage');
      expect(errorMessage).toContain('MultiTargetResolutionStage');
      expect(errorMessage).toContain('To debug:');
    });

    it('should show (none) when no actions discovered', () => {
      const actions = [];

      let errorMessage;
      try {
        expect(actions).toHaveAction('affection:place_hands_on_shoulders');
      } catch (err) {
        errorMessage = err.message;
      }

      expect(errorMessage).toContain('Actions discovered: 0');
      expect(errorMessage).toContain('(none)');
    });
  });

  describe('Negation support', () => {
    it('should pass when action not discovered with .not', () => {
      const actions = [
        { id: 'physical-control:turn_around', name: 'Turn Around' },
      ];

      expect(actions).not.toHaveAction('affection:place_hands_on_shoulders');
    });

    it('should fail when action discovered with .not', () => {
      const actions = [
        { id: 'affection:place_hands_on_shoulders', name: 'Place Hands' },
      ];

      expect(() => {
        expect(actions).not.toHaveAction('affection:place_hands_on_shoulders');
      }).toThrow(/Expected NOT to discover action/);
    });
  });

  describe('Edge cases', () => {
    it('should handle empty actions array', () => {
      const actions = [];

      expect(() => {
        expect(actions).toHaveAction('affection:place_hands_on_shoulders');
      }).toThrow(/Expected to discover action/);
    });

    it('should handle wrapped object with empty actions', () => {
      const result = { actions: [] };

      expect(() => {
        expect(result).toHaveAction('affection:place_hands_on_shoulders');
      }).toThrow(/Expected to discover action/);
    });

    it('should handle actions without id field gracefully', () => {
      const actions = [{ name: 'Invalid Action' }];

      expect(() => {
        expect(actions).toHaveAction('affection:place_hands_on_shoulders');
      }).toThrow(/Expected to discover action/);
    });
  });
});

describe('actionMatchers - toDiscoverActionCount', () => {
  describe('Positive cases', () => {
    it('should pass when count matches', () => {
      const actions = [
        { id: 'affection:place_hands_on_shoulders', name: 'Place Hands' },
        { id: 'physical-control:turn_around', name: 'Turn Around' },
        { id: 'deference:kneel_before', name: 'Kneel Before' },
      ];

      expect(actions).toDiscoverActionCount(3);
    });

    it('should pass when zero actions match zero expected', () => {
      const actions = [];

      expect(actions).toDiscoverActionCount(0);
    });

    it('should pass with wrapped object', () => {
      const result = {
        actions: [
          { id: 'affection:place_hands_on_shoulders', name: 'Place Hands' },
        ],
      };

      expect(result).toDiscoverActionCount(1);
    });
  });

  describe('Negative cases - fewer actions', () => {
    it('should fail when fewer actions discovered', () => {
      const actions = [
        { id: 'physical-control:turn_around', name: 'Turn Around' },
      ];

      expect(() => {
        expect(actions).toDiscoverActionCount(3);
      }).toThrow(/Expected to discover 3 actions but discovered 1/);
    });

    it('should provide helpful message for fewer actions', () => {
      const actions = [
        { id: 'physical-control:turn_around', name: 'Turn Around' },
        { id: 'deference:kneel_before', name: 'Kneel Before' },
      ];

      let errorMessage;
      try {
        expect(actions).toDiscoverActionCount(5);
      } catch (err) {
        errorMessage = err.message;
      }

      expect(errorMessage).toContain('FEWER actions than expected (2 < 5)');
      expect(errorMessage).toContain(
        'Some actions were filtered out by pipeline stages'
      );
      expect(errorMessage).toContain('Actor missing required components');
      expect(errorMessage).toContain('Prerequisites not met');
    });
  });

  describe('Negative cases - more actions', () => {
    it('should fail when more actions discovered', () => {
      const actions = [
        { id: 'physical-control:turn_around', name: 'Turn Around' },
        { id: 'deference:kneel_before', name: 'Kneel Before' },
        { id: 'affection:place_hands_on_shoulders', name: 'Place Hands' },
      ];

      expect(() => {
        expect(actions).toDiscoverActionCount(2);
      }).toThrow(/Expected to discover 2 actions but discovered 3/);
    });

    it('should provide helpful message for more actions', () => {
      const actions = [
        { id: 'physical-control:turn_around', name: 'Turn Around' },
        { id: 'deference:kneel_before', name: 'Kneel Before' },
        { id: 'affection:place_hands_on_shoulders', name: 'Place Hands' },
      ];

      let errorMessage;
      try {
        expect(actions).toDiscoverActionCount(1);
      } catch (err) {
        errorMessage = err.message;
      }

      expect(errorMessage).toContain('MORE actions than expected (3 > 1)');
      expect(errorMessage).toContain(
        'More entities in closeness than expected'
      );
      expect(errorMessage).toContain('Scope resolving to unexpected targets');
      expect(errorMessage).toContain(
        'Multiple action definitions with similar criteria'
      );
    });
  });

  describe('Error message formatting', () => {
    it('should list all discovered actions in error message', () => {
      const actions = [
        { id: 'physical-control:turn_around', name: 'Turn Around' },
        { id: 'deference:kneel_before', name: 'Kneel Before' },
      ];

      let errorMessage;
      try {
        expect(actions).toDiscoverActionCount(3);
      } catch (err) {
        errorMessage = err.message;
      }

      expect(errorMessage).toContain('Actions discovered:');
      expect(errorMessage).toContain('1. physical-control:turn_around');
      expect(errorMessage).toContain('2. deference:kneel_before');
    });

    it('should show (none) when no actions discovered', () => {
      const actions = [];

      let errorMessage;
      try {
        expect(actions).toDiscoverActionCount(2);
      } catch (err) {
        errorMessage = err.message;
      }

      expect(errorMessage).toContain('(none)');
    });
  });

  describe('Negation support', () => {
    it('should pass when count does not match with .not', () => {
      const actions = [
        { id: 'physical-control:turn_around', name: 'Turn Around' },
      ];

      expect(actions).not.toDiscoverActionCount(3);
    });

    it('should fail when count matches with .not', () => {
      const actions = [
        { id: 'physical-control:turn_around', name: 'Turn Around' },
        { id: 'deference:kneel_before', name: 'Kneel Before' },
      ];

      expect(() => {
        expect(actions).not.toDiscoverActionCount(2);
      }).toThrow(/Expected NOT to discover 2 actions/);
    });
  });
});

describe('actionMatchers - Auto-extension', () => {
  it('should auto-extend Jest expect on import', () => {
    // Verify matchers are available
    expect(expect.extend).toBeDefined();

    // Verify our matchers are registered (they should work without explicit registration)
    const actions = [{ id: 'test:action', name: 'Test' }];
    expect(actions).toHaveAction('test:action');
    expect(actions).toDiscoverActionCount(1);
  });

  it('should work with standard expect() syntax', () => {
    const actions = [
      { id: 'affection:place_hands_on_shoulders', name: 'Place Hands' },
      { id: 'physical-control:turn_around', name: 'Turn Around' },
    ];

    // Should work without any setup
    expect(actions).toHaveAction('affection:place_hands_on_shoulders');
    expect(actions).toDiscoverActionCount(2);
  });
});
