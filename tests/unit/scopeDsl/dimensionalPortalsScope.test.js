/**
 * @file Unit tests for movement:dimensional_portals scope
 * @description Tests that the scope definition is valid and properly structured
 */

import { describe, it, expect } from '@jest/globals';
import { promises as fs } from 'fs';

describe('movement:dimensional_portals Scope', () => {
  describe('Scope Definition', () => {
    it('should have valid scope definition file', async () => {
      const scopeContent = await fs.readFile(
        'data/mods/movement/scopes/dimensional_portals.scope',
        'utf-8'
      );

      expect(scopeContent).toBeDefined();
      expect(scopeContent).toContain('movement:dimensional_portals');
      expect(scopeContent).toContain('location.locations:exits');
    });

    it('should filter exits by blocker presence', async () => {
      const scopeContent = await fs.readFile(
        'data/mods/movement/scopes/dimensional_portals.scope',
        'utf-8'
      );

      // Verify it filters for blocker presence
      expect(scopeContent).toContain('entity.blocker');
    });

    it('should reference blocker-is-dimensional-portal condition', async () => {
      const scopeContent = await fs.readFile(
        'data/mods/movement/scopes/dimensional_portals.scope',
        'utf-8'
      );

      // Verify it uses the condition reference
      expect(scopeContent).toContain('condition_ref');
      expect(scopeContent).toContain('blockers:blocker-is-dimensional-portal');
    });

    it('should extract target from exits', async () => {
      const scopeContent = await fs.readFile(
        'data/mods/movement/scopes/dimensional_portals.scope',
        'utf-8'
      );

      // Verify it extracts target
      expect(scopeContent).toContain('.target');
    });
  });

  describe('Condition Definition', () => {
    it('should have valid condition definition file', async () => {
      const conditionContent = await fs.readFile(
        'data/mods/blockers/conditions/blocker-is-dimensional-portal.condition.json',
        'utf-8'
      );

      const condition = JSON.parse(conditionContent);

      expect(condition.id).toBe('blockers:blocker-is-dimensional-portal');
      expect(condition.logic).toBeDefined();
    });

    it('should check for is_dimensional_portal component', async () => {
      const conditionContent = await fs.readFile(
        'data/mods/blockers/conditions/blocker-is-dimensional-portal.condition.json',
        'utf-8'
      );

      const condition = JSON.parse(conditionContent);

      // Verify it uses has_component operation
      expect(condition.logic.has_component).toBeDefined();
      expect(condition.logic.has_component[1]).toBe(
        'blockers:is_dimensional_portal'
      );
    });
  });
});
