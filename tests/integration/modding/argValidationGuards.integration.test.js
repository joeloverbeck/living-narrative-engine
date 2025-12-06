import { describe, expect, it } from '@jest/globals';

import ModManifestProcessor from '../../../src/loaders/ModManifestProcessor.js';
import ModDependencyValidator from '../../../src/modding/modDependencyValidator.js';
import ModLoadOrderResolver from '../../../src/modding/modLoadOrderResolver.js';
import ModValidationOrchestrator from '../../../cli/validation/modValidationOrchestrator.js';

const createLogger = () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
});

describe('argValidation integration guardrails', () => {
  it('propagates informative error when ModDependencyValidator receives a malformed logger from ModManifestProcessor', async () => {
    const invalidLogger = {
      debug: jest.fn(),
      // Missing info/warn/error on purpose to exercise assertIsLogger failure path.
    };

    const manifestLoader = {
      async loadRequestedManifests(requestedIds) {
        return new Map(
          requestedIds.map((id) => [id.toLowerCase(), { id, version: '1.0.0' }])
        );
      },
    };

    const processor = new ModManifestProcessor({
      modManifestLoader: manifestLoader,
      logger: invalidLogger,
      registry: { store: jest.fn() },
      validatedEventDispatcher: { dispatch: jest.fn() },
      modDependencyValidator: ModDependencyValidator,
      modVersionValidator: () => {},
      modLoadOrderResolver: new ModLoadOrderResolver(createLogger()),
    });

    await expect(
      processor.processManifests(['core-mod'], 'test-world')
    ).rejects.toThrow(
      'ModDependencyValidator.validate: Input `logger` must be a valid ILogger instance.'
    );
  });

  it('fails early when ModValidationOrchestrator hands a non-map manifest collection to ModDependencyValidator', async () => {
    const logger = createLogger();

    const orchestrator = new ModValidationOrchestrator({
      logger,
      modDependencyValidator: ModDependencyValidator,
      modCrossReferenceValidator: {
        validateModReferences: async () => ({
          isValid: true,
          errors: [],
          warnings: [],
        }),
        validateAllModReferences: async () => new Map(),
      },
      modLoadOrderResolver: new ModLoadOrderResolver(createLogger()),
      modManifestLoader: {
        async loadRequestedManifests() {
          return { not: 'a-map' };
        },
        async loadModManifests() {
          return new Map();
        },
      },
      pathResolver: {
        resolveModManifestPath: (modId) => `mods/${modId}/mod-manifest.json`,
      },
      configuration: {
        getContentTypeSchemaId: () => 'schema://example',
      },
      fileExistenceValidator: {
        async validateManifests() {
          return new Map();
        },
        async validateManifest() {
          return { isValid: true, errors: [], warnings: [] };
        },
      },
    });

    await expect(
      orchestrator.validateEcosystem({
        modsToValidate: ['alpha-mod'],
        skipCrossReferences: true,
      })
    ).rejects.toThrow(
      'ModDependencyValidator.validate: Input `manifests` must be a Map.'
    );
  });
});
