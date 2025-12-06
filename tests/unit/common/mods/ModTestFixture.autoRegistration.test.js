import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import { ScopeResolverHelpers } from '../../../common/mods/scopeResolverHelpers.js';

// Mock ScopeResolverHelpers
jest.mock('../../../common/mods/scopeResolverHelpers.js');

describe('ModTestFixture - Auto-Registration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('forAction with autoRegisterScopes', () => {
    it('should not auto-register scopes by default', async () => {
      // Act
      const fixture = await ModTestFixture.forAction(
        'positioning',
        'positioning:sit_down'
      );

      // Assert
      expect(
        ScopeResolverHelpers.registerPositioningScopes
      ).not.toHaveBeenCalled();

      fixture.cleanup();
    });

    it('should auto-register positioning scopes when enabled', async () => {
      // Act
      const fixture = await ModTestFixture.forAction(
        'positioning',
        'positioning:sit_down',
        null,
        null,
        { autoRegisterScopes: true }
      );

      // Assert
      expect(
        ScopeResolverHelpers.registerPositioningScopes
      ).toHaveBeenCalledWith(fixture.testEnv);

      fixture.cleanup();
    });

    it('should auto-register multiple scope categories', async () => {
      // Act
      const fixture = await ModTestFixture.forAction(
        'positioning',
        'positioning:sit_down',
        null,
        null,
        {
          autoRegisterScopes: true,
          scopeCategories: ['positioning', 'anatomy'],
        }
      );

      // Assert
      expect(
        ScopeResolverHelpers.registerPositioningScopes
      ).toHaveBeenCalledWith(fixture.testEnv);
      expect(ScopeResolverHelpers.registerAnatomyScopes).toHaveBeenCalledWith(
        fixture.testEnv
      );

      fixture.cleanup();
    });

    it('should accept "items" alias for inventory category', async () => {
      // Act
      const fixture = await ModTestFixture.forAction(
        'items',
        'items:pick_up_item',
        null,
        null,
        {
          autoRegisterScopes: true,
          scopeCategories: ['items'],
        }
      );

      // Assert
      expect(ScopeResolverHelpers.registerInventoryScopes).toHaveBeenCalledWith(
        fixture.testEnv
      );

      fixture.cleanup();
    });

    it('should accept "inventory" category', async () => {
      // Act
      const fixture = await ModTestFixture.forAction(
        'items',
        'items:pick_up_item',
        null,
        null,
        {
          autoRegisterScopes: true,
          scopeCategories: ['inventory'],
        }
      );

      // Assert
      expect(ScopeResolverHelpers.registerInventoryScopes).toHaveBeenCalledWith(
        fixture.testEnv
      );

      fixture.cleanup();
    });
  });

  describe('options validation', () => {
    it('should reject non-boolean autoRegisterScopes', async () => {
      // Act & Assert
      await expect(
        ModTestFixture.forAction(
          'positioning',
          'positioning:sit_down',
          null,
          null,
          {
            autoRegisterScopes: 'true', // ❌ string instead of boolean
          }
        )
      ).rejects.toThrow('autoRegisterScopes must be a boolean');
    });

    it('should reject non-array scopeCategories', async () => {
      // Act & Assert
      await expect(
        ModTestFixture.forAction(
          'positioning',
          'positioning:sit_down',
          null,
          null,
          {
            autoRegisterScopes: true,
            scopeCategories: 'positioning', // ❌ string instead of array
          }
        )
      ).rejects.toThrow('scopeCategories must be an array');
    });

    it('should reject invalid scope categories', async () => {
      // Act & Assert
      await expect(
        ModTestFixture.forAction(
          'positioning',
          'positioning:sit_down',
          null,
          null,
          {
            autoRegisterScopes: true,
            scopeCategories: ['positioning', 'invalid_category'],
          }
        )
      ).rejects.toThrow('Invalid scope categories: invalid_category');
    });

    it('should accept all valid scope categories', async () => {
      // Act
      const fixture = await ModTestFixture.forAction(
        'positioning',
        'positioning:sit_down',
        null,
        null,
        {
          autoRegisterScopes: true,
          scopeCategories: ['positioning', 'inventory', 'anatomy'],
        }
      );

      // Assert - should not throw
      expect(fixture).toBeDefined();

      fixture.cleanup();
    });

    it('should accept "items" as valid alias', async () => {
      // Act
      const fixture = await ModTestFixture.forAction(
        'items',
        'items:pick_up_item',
        null,
        null,
        {
          autoRegisterScopes: true,
          scopeCategories: ['items'],
        }
      );

      // Assert - should not throw
      expect(fixture).toBeDefined();

      fixture.cleanup();
    });
  });

  describe('backward compatibility', () => {
    it('should work without options parameter', async () => {
      // Act
      const fixture = await ModTestFixture.forAction(
        'positioning',
        'positioning:sit_down'
      );

      // Assert
      expect(fixture).toBeDefined();
      expect(
        ScopeResolverHelpers.registerPositioningScopes
      ).not.toHaveBeenCalled();

      fixture.cleanup();
    });

    it('should work with empty options object', async () => {
      // Act
      const fixture = await ModTestFixture.forAction(
        'positioning',
        'positioning:sit_down',
        null,
        null,
        {}
      );

      // Assert
      expect(fixture).toBeDefined();
      expect(
        ScopeResolverHelpers.registerPositioningScopes
      ).not.toHaveBeenCalled();

      fixture.cleanup();
    });

    it('should preserve other options when auto-registration is used', async () => {
      // Act
      const fixture = await ModTestFixture.forAction(
        'positioning',
        'positioning:sit_down',
        null,
        null,
        {
          autoRegisterScopes: true,
          supportingActions: ['deference:stand_up'],
        }
      );

      // Assert
      expect(fixture).toBeDefined();
      expect(
        ScopeResolverHelpers.registerPositioningScopes
      ).toHaveBeenCalledWith(fixture.testEnv);

      fixture.cleanup();
    });
  });

  describe('default scope categories', () => {
    it('should default to positioning category when autoRegisterScopes is true', async () => {
      // Act
      const fixture = await ModTestFixture.forAction(
        'positioning',
        'positioning:sit_down',
        null,
        null,
        { autoRegisterScopes: true }
      );

      // Assert
      expect(
        ScopeResolverHelpers.registerPositioningScopes
      ).toHaveBeenCalledWith(fixture.testEnv);
      expect(
        ScopeResolverHelpers.registerInventoryScopes
      ).not.toHaveBeenCalled();
      expect(ScopeResolverHelpers.registerAnatomyScopes).not.toHaveBeenCalled();

      fixture.cleanup();
    });

    it('should override default when scopeCategories is explicitly provided', async () => {
      // Act
      const fixture = await ModTestFixture.forAction(
        'items',
        'items:pick_up_item',
        null,
        null,
        {
          autoRegisterScopes: true,
          scopeCategories: ['inventory'],
        }
      );

      // Assert
      expect(ScopeResolverHelpers.registerInventoryScopes).toHaveBeenCalledWith(
        fixture.testEnv
      );
      expect(
        ScopeResolverHelpers.registerPositioningScopes
      ).not.toHaveBeenCalled();

      fixture.cleanup();
    });
  });
});
