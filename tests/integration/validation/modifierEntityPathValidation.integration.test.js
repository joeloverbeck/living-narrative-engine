/**
 * @file Integration tests for modifier entity path validation at action load time.
 * Tests that ActionLoader correctly validates entity paths in modifier conditions
 * and logs appropriate warnings for invalid paths.
 * @see src/loaders/actionLoader.js
 * @see src/logic/utils/entityPathValidator.js
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import ActionLoader from '../../../src/loaders/actionLoader.js';
import InMemoryDataRegistry from '../../../src/data/inMemoryDataRegistry.js';

const ACTION_SCHEMA_ID = 'schema://living-narrative-engine/action.schema.json';

/**
 * Minimal configuration service
 */
class TestConfiguration {
  getModsBasePath() {
    return '/virtual-mods';
  }

  getContentTypeSchemaId(contentType) {
    return contentType === 'actions' ? ACTION_SCHEMA_ID : null;
  }
}

/**
 * Path resolver for tests
 */
class TestPathResolver {
  resolveModContentPath(modId, diskFolder, filename) {
    return `/virtual-mods/${modId}/${diskFolder}/${filename}`;
  }
}

/**
 * Map-based data fetcher
 */
class MapDataFetcher {
  constructor(fileMap) {
    this._fileMap = fileMap;
  }

  async fetch(path) {
    if (!this._fileMap.has(path)) {
      throw new Error(`Missing fixture for path: ${path}`);
    }
    const value = this._fileMap.get(path);
    return typeof value === 'object' && value !== null
      ? JSON.parse(JSON.stringify(value))
      : value;
  }
}

/**
 * Schema validator that always passes
 */
class PassingSchemaValidator {
  constructor() {
    this.isSchemaLoaded = jest.fn(() => true);
    this.getValidator = jest.fn(() => () => ({ isValid: true, errors: null }));
    this.validate = jest.fn(() => ({ isValid: true, errors: null }));
  }
}

/**
 * Extended registry supporting mod-namespaced lookups
 */
class NamespacedDataRegistry extends InMemoryDataRegistry {
  getAll(type) {
    if (typeof type === 'string' && type.includes('.')) {
      const [category, modId] = type.split('.', 2);
      const entries = super.getAll(category);
      if (!modId) return entries;
      const filtered = entries.filter(
        (entry) => entry && entry._modId === modId
      );
      return filtered.length > 0 ? filtered : undefined;
    }
    return super.getAll(type);
  }
}

/**
 * Creates test logger with spies
 */
function createTestLogger() {
  return {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  };
}

/**
 * Factory for ActionLoader with test dependencies
 */
function createActionLoader(fileMap) {
  const logger = createTestLogger();
  const registry = new NamespacedDataRegistry({ logger });
  const config = new TestConfiguration();
  const pathResolver = new TestPathResolver();
  const dataFetcher = new MapDataFetcher(fileMap);
  const schemaValidator = new PassingSchemaValidator();

  const loader = new ActionLoader(
    config,
    pathResolver,
    dataFetcher,
    schemaValidator,
    registry,
    logger
  );

  return { loader, registry, logger };
}

describe('Modifier Entity Path Validation at Load Time', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('invalid path detection', () => {
    it('should log warning for paths not starting with entity.', async () => {
      const fileMap = new Map([
        [
          '/virtual-mods/testMod/actions/invalid_path.action.json',
          {
            id: 'testMod:invalid_path',
            name: 'Invalid Path Action',
            chanceBased: {
              enabled: true,
              modifiers: [
                {
                  condition: {
                    logic: { isSlotExposed: ['actor', 'torso_upper', []] },
                  },
                  type: 'flat',
                  value: 10,
                },
              ],
            },
          },
        ],
      ]);

      const { loader, logger } = createActionLoader(fileMap);
      const manifest = {
        content: { actions: ['invalid_path.action.json'] },
      };

      await loader.loadItemsForMod(
        'testMod',
        manifest,
        'actions',
        'actions',
        'actions'
      );

      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Invalid entity path')
      );
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('must start with "entity."')
      );
    });

    it('should log warning for paths with invalid roles', async () => {
      const fileMap = new Map([
        [
          '/virtual-mods/testMod/actions/invalid_role.action.json',
          {
            id: 'testMod:invalid_role',
            name: 'Invalid Role Action',
            chanceBased: {
              enabled: true,
              modifiers: [
                {
                  condition: {
                    logic: {
                      isSocketCovered: ['entity.unknown_role', 'shoulder'],
                    },
                  },
                  type: 'flat',
                  value: -5,
                },
              ],
            },
          },
        ],
      ]);

      const { loader, logger } = createActionLoader(fileMap);
      const manifest = {
        content: { actions: ['invalid_role.action.json'] },
      };

      await loader.loadItemsForMod(
        'testMod',
        manifest,
        'actions',
        'actions',
        'actions'
      );

      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Invalid entity path')
      );
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Invalid entity role')
      );
    });

    it('should include action ID and modifier index in warning', async () => {
      const fileMap = new Map([
        [
          '/virtual-mods/testMod/actions/indexed.action.json',
          {
            id: 'testMod:indexed',
            name: 'Indexed Action',
            chanceBased: {
              enabled: true,
              modifiers: [
                {
                  condition: { logic: { '!!': { var: 'valid' } } },
                  type: 'flat',
                  value: 5,
                },
                {
                  condition: {
                    logic: { isSlotExposed: ['actor', 'slot', []] },
                  },
                  type: 'flat',
                  value: 10,
                },
              ],
            },
          },
        ],
      ]);

      const { loader, logger } = createActionLoader(fileMap);
      const manifest = {
        content: { actions: ['indexed.action.json'] },
      };

      await loader.loadItemsForMod(
        'testMod',
        manifest,
        'actions',
        'actions',
        'actions'
      );

      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('testMod:indexed')
      );
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('chanceBased.modifiers[1]')
      );
    });

    it('should include the problematic path in warning', async () => {
      const fileMap = new Map([
        [
          '/virtual-mods/testMod/actions/bad_path.action.json',
          {
            id: 'testMod:bad_path',
            name: 'Bad Path Action',
            chanceBased: {
              enabled: true,
              modifiers: [
                {
                  condition: {
                    logic: { isSlotExposed: ['wrong_path', 'slot', []] },
                  },
                  type: 'flat',
                  value: 10,
                },
              ],
            },
          },
        ],
      ]);

      const { loader, logger } = createActionLoader(fileMap);
      const manifest = {
        content: { actions: ['bad_path.action.json'] },
      };

      await loader.loadItemsForMod(
        'testMod',
        manifest,
        'actions',
        'actions',
        'actions'
      );

      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('"wrong_path"')
      );
    });

    it('should include suggestion of valid roles in warning', async () => {
      const fileMap = new Map([
        [
          '/virtual-mods/testMod/actions/suggest_roles.action.json',
          {
            id: 'testMod:suggest_roles',
            name: 'Suggest Roles Action',
            chanceBased: {
              enabled: true,
              modifiers: [
                {
                  condition: {
                    logic: { isSocketCovered: ['entity.invalid', 'socket'] },
                  },
                  type: 'flat',
                  value: -10,
                },
              ],
            },
          },
        ],
      ]);

      const { loader, logger } = createActionLoader(fileMap);
      const manifest = {
        content: { actions: ['suggest_roles.action.json'] },
      };

      await loader.loadItemsForMod(
        'testMod',
        manifest,
        'actions',
        'actions',
        'actions'
      );

      // Should mention valid roles in the error message
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringMatching(/actor.*primary.*secondary.*tertiary.*location/i)
      );
    });
  });

  describe('valid path handling', () => {
    it('should not log warnings for valid entity.actor paths', async () => {
      const fileMap = new Map([
        [
          '/virtual-mods/testMod/actions/valid_actor.action.json',
          {
            id: 'testMod:valid_actor',
            name: 'Valid Actor Path Action',
            chanceBased: {
              enabled: true,
              modifiers: [
                {
                  condition: {
                    logic: {
                      isSlotExposed: ['entity.actor', 'torso_upper', ['base']],
                    },
                  },
                  type: 'flat',
                  value: 10,
                },
              ],
            },
          },
        ],
      ]);

      const { loader, logger } = createActionLoader(fileMap);
      const manifest = {
        content: { actions: ['valid_actor.action.json'] },
      };

      await loader.loadItemsForMod(
        'testMod',
        manifest,
        'actions',
        'actions',
        'actions'
      );

      // Should not log any warnings about invalid entity paths
      const pathWarnings = logger.warn.mock.calls.filter(([msg]) =>
        msg.includes('Invalid entity path')
      );
      expect(pathWarnings).toHaveLength(0);
    });

    it('should not log warnings for valid entity.primary paths', async () => {
      const fileMap = new Map([
        [
          '/virtual-mods/testMod/actions/valid_primary.action.json',
          {
            id: 'testMod:valid_primary',
            name: 'Valid Primary Path Action',
            chanceBased: {
              enabled: true,
              modifiers: [
                {
                  condition: {
                    logic: {
                      isSocketCovered: ['entity.primary', 'left_shoulder'],
                    },
                  },
                  type: 'flat',
                  value: -20,
                },
              ],
            },
          },
        ],
      ]);

      const { loader, logger } = createActionLoader(fileMap);
      const manifest = {
        content: { actions: ['valid_primary.action.json'] },
      };

      await loader.loadItemsForMod(
        'testMod',
        manifest,
        'actions',
        'actions',
        'actions'
      );

      const pathWarnings = logger.warn.mock.calls.filter(([msg]) =>
        msg.includes('Invalid entity path')
      );
      expect(pathWarnings).toHaveLength(0);
    });

    it('should not log warnings for paths with component access', async () => {
      const fileMap = new Map([
        [
          '/virtual-mods/testMod/actions/component_access.action.json',
          {
            id: 'testMod:component_access',
            name: 'Component Access Action',
            chanceBased: {
              enabled: true,
              modifiers: [
                {
                  condition: {
                    logic: {
                      isSlotExposed: [
                        'entity.actor.components.clothing:equipment',
                        'slot',
                        [],
                      ],
                    },
                  },
                  type: 'flat',
                  value: 5,
                },
              ],
            },
          },
        ],
      ]);

      const { loader, logger } = createActionLoader(fileMap);
      const manifest = {
        content: { actions: ['component_access.action.json'] },
      };

      await loader.loadItemsForMod(
        'testMod',
        manifest,
        'actions',
        'actions',
        'actions'
      );

      const pathWarnings = logger.warn.mock.calls.filter(([msg]) =>
        msg.includes('Invalid entity path')
      );
      expect(pathWarnings).toHaveLength(0);
    });
  });

  describe('graceful degradation', () => {
    it('should continue loading action even with invalid paths', async () => {
      const fileMap = new Map([
        [
          '/virtual-mods/testMod/actions/invalid_but_loads.action.json',
          {
            id: 'testMod:invalid_but_loads',
            name: 'Invalid But Loads',
            description: 'Should still load despite path errors',
            chanceBased: {
              enabled: true,
              modifiers: [
                {
                  condition: {
                    logic: { isSlotExposed: ['actor', 'slot', []] },
                  },
                  type: 'flat',
                  value: 10,
                },
              ],
            },
          },
        ],
      ]);

      const { loader, registry, logger } = createActionLoader(fileMap);
      const manifest = {
        content: { actions: ['invalid_but_loads.action.json'] },
      };

      const result = await loader.loadItemsForMod(
        'testMod',
        manifest,
        'actions',
        'actions',
        'actions'
      );

      // Should have loaded successfully despite warnings
      expect(result.count).toBe(1);
      expect(result.errors).toBe(0);

      // Verify action is in registry
      const stored = registry.get('actions', 'testMod:invalid_but_loads');
      expect(stored).toBeDefined();
      expect(stored.name).toBe('Invalid But Loads');

      // But should have logged warning
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Invalid entity path')
      );
    });

    it('should load all modifiers even if some have invalid paths', async () => {
      const fileMap = new Map([
        [
          '/virtual-mods/testMod/actions/mixed_modifiers.action.json',
          {
            id: 'testMod:mixed_modifiers',
            name: 'Mixed Modifiers Action',
            chanceBased: {
              enabled: true,
              modifiers: [
                {
                  condition: {
                    logic: { isSlotExposed: ['entity.actor', 'slot', []] },
                  },
                  type: 'flat',
                  value: 10,
                  tag: 'valid',
                },
                {
                  condition: {
                    logic: { isSocketCovered: ['actor', 'socket'] },
                  },
                  type: 'flat',
                  value: -5,
                  tag: 'invalid',
                },
                {
                  condition: {
                    logic: { isSlotExposed: ['entity.primary', 'slot', []] },
                  },
                  type: 'flat',
                  value: 5,
                  tag: 'also valid',
                },
              ],
            },
          },
        ],
      ]);

      const { loader, registry } = createActionLoader(fileMap);
      const manifest = {
        content: { actions: ['mixed_modifiers.action.json'] },
      };

      await loader.loadItemsForMod(
        'testMod',
        manifest,
        'actions',
        'actions',
        'actions'
      );

      const stored = registry.get('actions', 'testMod:mixed_modifiers');
      expect(stored.chanceBased.modifiers).toHaveLength(3);
    });
  });

  describe('edge cases', () => {
    it('should handle actions without modifiers', async () => {
      const fileMap = new Map([
        [
          '/virtual-mods/testMod/actions/no_modifiers.action.json',
          {
            id: 'testMod:no_modifiers',
            name: 'No Modifiers Action',
            description: 'Simple action without chance-based modifiers',
          },
        ],
      ]);

      const { loader, logger } = createActionLoader(fileMap);
      const manifest = {
        content: { actions: ['no_modifiers.action.json'] },
      };

      const result = await loader.loadItemsForMod(
        'testMod',
        manifest,
        'actions',
        'actions',
        'actions'
      );

      expect(result.count).toBe(1);
      expect(result.errors).toBe(0);

      // No path warnings should be logged
      const pathWarnings = logger.warn.mock.calls.filter(([msg]) =>
        msg.includes('Invalid entity path')
      );
      expect(pathWarnings).toHaveLength(0);
    });

    it('should handle modifiers without conditions', async () => {
      const fileMap = new Map([
        [
          '/virtual-mods/testMod/actions/no_conditions.action.json',
          {
            id: 'testMod:no_conditions',
            name: 'No Conditions Action',
            chanceBased: {
              enabled: true,
              modifiers: [
                {
                  type: 'flat',
                  value: 5,
                  tag: 'unconditional',
                },
              ],
            },
          },
        ],
      ]);

      const { loader, logger } = createActionLoader(fileMap);
      const manifest = {
        content: { actions: ['no_conditions.action.json'] },
      };

      const result = await loader.loadItemsForMod(
        'testMod',
        manifest,
        'actions',
        'actions',
        'actions'
      );

      expect(result.count).toBe(1);
      expect(result.errors).toBe(0);

      const pathWarnings = logger.warn.mock.calls.filter(([msg]) =>
        msg.includes('Invalid entity path')
      );
      expect(pathWarnings).toHaveLength(0);
    });

    it('should handle null/undefined gracefully', async () => {
      const fileMap = new Map([
        [
          '/virtual-mods/testMod/actions/null_data.action.json',
          {
            id: 'testMod:null_data',
            name: 'Null Data Action',
            chanceBased: {
              enabled: true,
              modifiers: [
                {
                  condition: null,
                  type: 'flat',
                  value: 5,
                },
                {
                  condition: { logic: null },
                  type: 'flat',
                  value: 10,
                },
              ],
            },
          },
        ],
      ]);

      const { loader, logger } = createActionLoader(fileMap);
      const manifest = {
        content: { actions: ['null_data.action.json'] },
      };

      // Should not throw
      const result = await loader.loadItemsForMod(
        'testMod',
        manifest,
        'actions',
        'actions',
        'actions'
      );

      expect(result.count).toBe(1);
      expect(result.errors).toBe(0);

      const pathWarnings = logger.warn.mock.calls.filter(([msg]) =>
        msg.includes('Invalid entity path')
      );
      expect(pathWarnings).toHaveLength(0);
    });

    it('should handle chanceBased.modifiers being not an array', async () => {
      const fileMap = new Map([
        [
          '/virtual-mods/testMod/actions/invalid_modifiers_type.action.json',
          {
            id: 'testMod:invalid_modifiers_type',
            name: 'Invalid Modifiers Type Action',
            chanceBased: {
              enabled: true,
              modifiers: 'not-an-array',
            },
          },
        ],
      ]);

      const { loader, logger } = createActionLoader(fileMap);
      const manifest = {
        content: { actions: ['invalid_modifiers_type.action.json'] },
      };

      // Should not throw
      const result = await loader.loadItemsForMod(
        'testMod',
        manifest,
        'actions',
        'actions',
        'actions'
      );

      expect(result.count).toBe(1);

      const pathWarnings = logger.warn.mock.calls.filter(([msg]) =>
        msg.includes('Invalid entity path')
      );
      expect(pathWarnings).toHaveLength(0);
    });
  });

  describe('multiple invalid paths', () => {
    it('should log warning for each invalid path in the same modifier', async () => {
      const fileMap = new Map([
        [
          '/virtual-mods/testMod/actions/multiple_invalid.action.json',
          {
            id: 'testMod:multiple_invalid',
            name: 'Multiple Invalid Paths Action',
            chanceBased: {
              enabled: true,
              modifiers: [
                {
                  condition: {
                    logic: {
                      and: [
                        { isSlotExposed: ['actor', 'slot1', []] },
                        { isSocketCovered: ['target', 'socket1'] },
                      ],
                    },
                  },
                  type: 'flat',
                  value: 10,
                },
              ],
            },
          },
        ],
      ]);

      const { loader, logger } = createActionLoader(fileMap);
      const manifest = {
        content: { actions: ['multiple_invalid.action.json'] },
      };

      await loader.loadItemsForMod(
        'testMod',
        manifest,
        'actions',
        'actions',
        'actions'
      );

      // Should have logged two warnings (one for each invalid path)
      const pathWarnings = logger.warn.mock.calls.filter(([msg]) =>
        msg.includes('Invalid entity path')
      );
      expect(pathWarnings).toHaveLength(2);
    });
  });
});
