/**
 * @file Integration tests for rise_to_surface visibility-based modifiers.
 * @description Validates modifier structure and application based on liquid body visibility.
 */

import { describe, it, expect } from '@jest/globals';
import riseToSurfaceAction from '../../../../data/mods/liquids/actions/rise_to_surface.action.json' with { type: 'json' };

describe('rise_to_surface visibility modifiers', () => {
  const modifiers = riseToSurfaceAction.chanceBased?.modifiers || [];

  /**
   * Helper to find a modifier by visibility level.
   * @param {string} visibility - The visibility level to search for
   * @returns {object|undefined} The modifier object or undefined
   */
  const findModifierByVisibility = (visibility) => {
    return modifiers.find((mod) => {
      const condition = JSON.stringify(mod.condition);
      return condition.includes(`"${visibility}"`);
    });
  };

  describe('Modifier structure', () => {
    it('has modifiers array defined', () => {
      expect(riseToSurfaceAction.chanceBased).toBeDefined();
      expect(riseToSurfaceAction.chanceBased.modifiers).toBeInstanceOf(Array);
    });

    it('has exactly four visibility-based modifiers', () => {
      expect(modifiers.length).toBe(4);
    });

    it('has pristine modifier', () => {
      expect(findModifierByVisibility('pristine')).toBeDefined();
    });

    it('has clear modifier', () => {
      expect(findModifierByVisibility('clear')).toBeDefined();
    });

    it('has murky modifier', () => {
      expect(findModifierByVisibility('murky')).toBeDefined();
    });

    it('has opaque modifier', () => {
      expect(findModifierByVisibility('opaque')).toBeDefined();
    });

    it('has all four visibility modifiers', () => {
      const visibilities = ['pristine', 'clear', 'murky', 'opaque'];
      const foundModifiers = visibilities.map(findModifierByVisibility);
      expect(foundModifiers.every(Boolean)).toBe(true);
    });
  });

  describe('Modifier values', () => {
    describe('Pristine visibility modifier', () => {
      const pristineMod = findModifierByVisibility('pristine');

      it('applies +10 flat bonus', () => {
        expect(pristineMod.value).toBe(10);
      });

      it('is of type flat', () => {
        expect(pristineMod.type).toBe('flat');
      });
    });

    describe('Clear visibility modifier', () => {
      const clearMod = findModifierByVisibility('clear');

      it('applies +5 flat bonus', () => {
        expect(clearMod.value).toBe(5);
      });

      it('is of type flat', () => {
        expect(clearMod.type).toBe('flat');
      });
    });

    describe('Murky visibility modifier', () => {
      const murkyMod = findModifierByVisibility('murky');

      it('applies -5 flat penalty', () => {
        expect(murkyMod.value).toBe(-5);
      });

      it('is of type flat', () => {
        expect(murkyMod.type).toBe('flat');
      });
    });

    describe('Opaque visibility modifier', () => {
      const opaqueMod = findModifierByVisibility('opaque');

      it('applies -10 flat penalty', () => {
        expect(opaqueMod.value).toBe(-10);
      });

      it('is of type flat', () => {
        expect(opaqueMod.type).toBe('flat');
      });
    });
  });

  describe('Modifier condition structure', () => {
    it('all modifiers use condition with logic wrapper', () => {
      modifiers.forEach((mod) => {
        expect(mod.condition).toBeDefined();
        expect(mod.condition.logic).toBeDefined();
      });
    });

    it('all modifiers use get_component_value operator', () => {
      modifiers.forEach((mod) => {
        const conditionStr = JSON.stringify(mod.condition);
        expect(conditionStr).toContain('get_component_value');
      });
    });

    it('all modifiers reference in_liquid_body component', () => {
      modifiers.forEach((mod) => {
        const conditionStr = JSON.stringify(mod.condition);
        expect(conditionStr).toContain(
          'liquids-states:in_liquid_body.liquid_body_id'
        );
      });
    });
  });

  describe('Modifier tag and description', () => {
    describe('Pristine modifier', () => {
      const pristineMod = findModifierByVisibility('pristine');

      it('has tag containing pristine', () => {
        expect(pristineMod.tag).toBeDefined();
        expect(pristineMod.tag.toLowerCase()).toContain('pristine');
      });

      it('has non-empty description', () => {
        expect(pristineMod.description).toBeDefined();
        expect(typeof pristineMod.description).toBe('string');
        expect(pristineMod.description.length).toBeGreaterThan(0);
      });
    });

    describe('Clear modifier', () => {
      const clearMod = findModifierByVisibility('clear');

      it('has tag containing clear', () => {
        expect(clearMod.tag).toBeDefined();
        expect(clearMod.tag.toLowerCase()).toContain('clear');
      });

      it('has non-empty description', () => {
        expect(clearMod.description).toBeDefined();
        expect(typeof clearMod.description).toBe('string');
        expect(clearMod.description.length).toBeGreaterThan(0);
      });
    });

    describe('Murky modifier', () => {
      const murkyMod = findModifierByVisibility('murky');

      it('has tag containing murky', () => {
        expect(murkyMod.tag).toBeDefined();
        expect(murkyMod.tag.toLowerCase()).toContain('murky');
      });

      it('has non-empty description', () => {
        expect(murkyMod.description).toBeDefined();
        expect(typeof murkyMod.description).toBe('string');
        expect(murkyMod.description.length).toBeGreaterThan(0);
      });
    });

    describe('Opaque modifier', () => {
      const opaqueMod = findModifierByVisibility('opaque');

      it('has tag containing opaque', () => {
        expect(opaqueMod.tag).toBeDefined();
        expect(opaqueMod.tag.toLowerCase()).toContain('opaque');
      });

      it('has non-empty description', () => {
        expect(opaqueMod.description).toBeDefined();
        expect(typeof opaqueMod.description).toBe('string');
        expect(opaqueMod.description.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Condition logic verification', () => {
    it('all conditions have logic wrapper', () => {
      modifiers.forEach((mod) => {
        expect(mod.condition).toHaveProperty('logic');
      });
    });

    it('all conditions use equality check', () => {
      modifiers.forEach((mod) => {
        expect(mod.condition.logic).toHaveProperty('==');
      });
    });

    it('all conditions use get_component_value operator', () => {
      modifiers.forEach((mod) => {
        const equalityArgs = mod.condition.logic['=='];
        expect(equalityArgs).toBeInstanceOf(Array);
        expect(equalityArgs.length).toBe(2);
        expect(equalityArgs[0]).toHaveProperty('get_component_value');
      });
    });

    it('all conditions reference correct entity path', () => {
      modifiers.forEach((mod) => {
        const conditionStr = JSON.stringify(mod.condition);
        expect(conditionStr).toContain(
          'entity.actor.components.liquids-states:in_liquid_body.liquid_body_id'
        );
      });
    });

    it('all conditions reference liquid_body component', () => {
      modifiers.forEach((mod) => {
        const getComponentValue =
          mod.condition.logic['=='][0].get_component_value;
        expect(getComponentValue).toBeInstanceOf(Array);
        expect(getComponentValue[1]).toBe('liquids:liquid_body');
      });
    });

    it('all conditions access visibility property', () => {
      modifiers.forEach((mod) => {
        const getComponentValue =
          mod.condition.logic['=='][0].get_component_value;
        expect(getComponentValue[2]).toBe('visibility');
      });
    });
  });

  describe('Modifier ordering and progression', () => {
    it('bonuses are positive and penalties are negative', () => {
      const pristineMod = findModifierByVisibility('pristine');
      const clearMod = findModifierByVisibility('clear');
      const murkyMod = findModifierByVisibility('murky');
      const opaqueMod = findModifierByVisibility('opaque');

      expect(pristineMod.value).toBeGreaterThan(0);
      expect(clearMod.value).toBeGreaterThan(0);
      expect(murkyMod.value).toBeLessThan(0);
      expect(opaqueMod.value).toBeLessThan(0);
    });

    it('pristine has highest bonus', () => {
      const pristineMod = findModifierByVisibility('pristine');
      const clearMod = findModifierByVisibility('clear');

      expect(pristineMod.value).toBeGreaterThan(clearMod.value);
    });

    it('opaque has highest penalty', () => {
      const murkyMod = findModifierByVisibility('murky');
      const opaqueMod = findModifierByVisibility('opaque');

      expect(opaqueMod.value).toBeLessThan(murkyMod.value);
    });
  });

  describe('Modifier targetRole', () => {
    it('all modifiers target actor', () => {
      modifiers.forEach((mod) => {
        expect(mod.targetRole).toBe('actor');
      });
    });
  });
});
