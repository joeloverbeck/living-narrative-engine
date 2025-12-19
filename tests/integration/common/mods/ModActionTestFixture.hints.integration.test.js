import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';

describe('ModTestFixture - Error Hints', () => {
  let consoleWarnSpy;
  let testFixture;

  beforeEach(() => {
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
  });

  afterEach(() => {
    consoleWarnSpy.mockRestore();
    testFixture?.cleanup();
  });

  describe('scope registration hints', () => {
    it('should provide hint when known scope not registered', async () => {
      testFixture = await ModTestFixture.forAction(
        'sitting',
        'sitting:sit_down',
        null,
        null
      );
      const scenario = testFixture.createStandardActorTarget(['Alice', 'Bob']);

      // Act - discover actions without registering scopes
      const availableActions = testFixture.discoverActions(scenario.actor.id);

      // Assert - should have warned
      expect(consoleWarnSpy).toHaveBeenCalled();
      const warning = consoleWarnSpy.mock.calls[0][0];
      expect(warning).toContain('Action Discovery Hint');
      expect(warning).toContain('autoRegisterScopes: true');
    });

    it('should not provide hint when scopes registered', async () => {
      testFixture = await ModTestFixture.forAction(
        'sitting',
        'sitting:sit_down',
        null,
        null,
        {
          autoRegisterScopes: true,
        }
      );

      // Create sitting scenario with furniture to make action discoverable
      const scenario = testFixture.createSittingPair({
        seatedActors: [
          { id: 'alice', name: 'Alice', spotIndex: 0 },
          { id: 'bob', name: 'Bob', spotIndex: 1 },
        ],
      });

      // Act
      const availableActions = testFixture.discoverActions(
        scenario.seatedActors[0].id
      );

      // Assert - should not have warned (actions were found)
      expect(consoleWarnSpy).not.toHaveBeenCalled();
      expect(availableActions.length).toBeGreaterThan(0);
    });

    it('should provide custom resolver hint for unknown scopes', async () => {
      // Create a test fixture for an action with custom scope
      testFixture = await ModTestFixture.forAction(
        'sitting',
        'sitting:sit_down',
        null,
        null
      );

      // Mock the action definition to use unknown scope
      testFixture._actionDefinition = {
        id: 'test:custom_action',
        targets: 'custom:unknown_scope',
      };

      const scenario = testFixture.createStandardActorTarget(['Alice', 'Bob']);

      // Act
      const availableActions = testFixture.discoverActions(scenario.actor.id);

      // Assert
      expect(consoleWarnSpy).toHaveBeenCalled();
      const warning = consoleWarnSpy.mock.calls[0][0];
      expect(warning).toContain('Create custom scope resolver');
      expect(warning).toContain('createComponentLookupResolver');
    });

    it('should allow suppressing hints', async () => {
      testFixture = await ModTestFixture.forAction(
        'sitting',
        'sitting:sit_down',
        null,
        null
      );
      testFixture.suppressHints(); // Suppress hints

      const scenario = testFixture.createStandardActorTarget(['Alice', 'Bob']);

      // Act
      const availableActions = testFixture.discoverActions(scenario.actor.id);

      // Assert - should not have warned
      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });

    it('should re-enable hints after suppression', async () => {
      testFixture = await ModTestFixture.forAction(
        'sitting',
        'sitting:sit_down',
        null,
        null
      );
      testFixture.suppressHints();
      testFixture.enableHints(); // Re-enable hints

      const scenario = testFixture.createStandardActorTarget(['Alice', 'Bob']);

      // Act
      const availableActions = testFixture.discoverActions(scenario.actor.id);

      // Assert - should have warned
      expect(consoleWarnSpy).toHaveBeenCalled();
    });

    it('should not provide hint when actions are discovered', async () => {
      testFixture = await ModTestFixture.forAction(
        'sitting',
        'sitting:sit_down',
        null,
        null,
        {
          autoRegisterScopes: true,
        }
      );

      // Create sitting scenario with furniture to make sit_down action discoverable
      const scenario = testFixture.createSittingPair({
        seatedActors: [
          { id: 'alice', name: 'Alice', spotIndex: 0 },
          { id: 'bob', name: 'Bob', spotIndex: 1 },
        ],
      });

      // Act
      const availableActions = testFixture.discoverActions(
        scenario.seatedActors[0].id
      );

      // Assert - should not have warned (actions were found)
      expect(consoleWarnSpy).not.toHaveBeenCalled();
      expect(availableActions.length).toBeGreaterThan(0);
    });

    it('should handle missing action definition gracefully', async () => {
      testFixture = await ModTestFixture.forAction(
        'sitting',
        'sitting:sit_down',
        null,
        null
      );

      // Clear the action definition
      testFixture._actionDefinition = null;

      const scenario = testFixture.createStandardActorTarget(['Alice', 'Bob']);

      // Act
      const availableActions = testFixture.discoverActions(scenario.actor.id);

      // Assert - should not crash, no warning shown
      expect(consoleWarnSpy).not.toHaveBeenCalled();
      expect(availableActions).toBeDefined();
    });

    it('should handle action without targets field', async () => {
      testFixture = await ModTestFixture.forAction(
        'sitting',
        'sitting:sit_down',
        null,
        null
      );

      // Mock action definition without targets
      testFixture._actionDefinition = {
        id: 'test:no_targets_action',
        // No targets field
      };

      const scenario = testFixture.createStandardActorTarget(['Alice', 'Bob']);

      // Act
      const availableActions = testFixture.discoverActions(scenario.actor.id);

      // Assert - should not crash or warn
      expect(consoleWarnSpy).not.toHaveBeenCalled();
      expect(availableActions).toBeDefined();
    });

    it('should detect positioning category correctly', async () => {
      testFixture = await ModTestFixture.forAction(
        'sitting',
        'sitting:sit_down',
        null,
        null
      );

      // Mock action definition with positioning scope
      testFixture._actionDefinition = {
        id: 'positioning:sit_down',
        targets: 'positioning:furniture_allowing_sitting_at_location',
      };

      const scenario = testFixture.createStandardActorTarget(['Alice', 'Bob']);

      // Act
      const availableActions = testFixture.discoverActions(scenario.actor.id);

      // Assert
      expect(consoleWarnSpy).toHaveBeenCalled();
      const warning = consoleWarnSpy.mock.calls[0][0];
      expect(warning).toContain('registerPositioningScopes');
    });

    it('should detect inventory category correctly', async () => {
      testFixture = await ModTestFixture.forAction(
        'item-handling',
        'item-handling:pick_up_item',
        null,
        null
      );

      // Mock action definition with inventory scope
      testFixture._actionDefinition = {
        id: 'item-handling:pick_up_item',
        targets: 'items:items_at_location',
      };

      const scenario = testFixture.createStandardActorTarget(['Alice', 'Bob']);

      // Act
      const availableActions = testFixture.discoverActions(scenario.actor.id);

      // Assert
      expect(consoleWarnSpy).toHaveBeenCalled();
      const warning = consoleWarnSpy.mock.calls[0][0];
      expect(warning).toContain('registerInventoryScopes');
    });

    it('should detect anatomy category correctly', async () => {
      testFixture = await ModTestFixture.forAction(
        'sitting',
        'sitting:sit_down',
        null,
        null
      );

      // Mock action definition with anatomy scope
      testFixture._actionDefinition = {
        id: 'anatomy:examine_body_part',
        targets: 'anatomy:target_body_parts',
      };

      const scenario = testFixture.createStandardActorTarget(['Alice', 'Bob']);

      // Act
      const availableActions = testFixture.discoverActions(scenario.actor.id);

      // Assert
      expect(consoleWarnSpy).toHaveBeenCalled();
      const warning = consoleWarnSpy.mock.calls[0][0];
      expect(warning).toContain('registerAnatomyScopes');
    });
  });
});
