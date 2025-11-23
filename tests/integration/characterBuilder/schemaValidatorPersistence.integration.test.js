/**
 * @file Integration test for schema validator persistence across bootstrap sessions
 * @description Tests that singleton SchemaValidator retains schemas across multiple
 * CharacterBuilderBootstrap initialization cycles. Payload schemas are now logged at
 * debug level (not warn level) to reduce noise during normal page navigation.
 *
 * NOTE: This test verifies that the bootstrap can successfully run multiple times
 * without errors. The actual logging behavior (debug vs warn) is tested in unit tests
 * for schemaUtils.js (registerSchema function).
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import CharacterBuilderBootstrap from '../../../src/characterBuilder/CharacterBuilderBootstrap.js';

describe('SchemaValidator Persistence Across Bootstrap Sessions', () => {
  let firstBootstrap;
  let secondBootstrap;
  let consoleWarnSpy;

  beforeEach(() => {
    firstBootstrap = new CharacterBuilderBootstrap();
    secondBootstrap = new CharacterBuilderBootstrap();

    // Spy on console.warn to verify no actual warnings are logged for payload schemas
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleWarnSpy.mockRestore();
  });

  it('should successfully run bootstrap twice without errors (payload schemas use debug logging)', async () => {
    // Arrange: Configuration for thematic directions manager
    const config = {
      pageName: 'thematic-directions-manager',
      includeModLoading: true,
      customSchemas: [
        '/data/schemas/character-concept.schema.json',
        '/data/schemas/thematic-direction.schema.json',
        '/data/schemas/llm-configs.schema.json',
      ],
      controllerClass: class MockController {
        constructor() {}
        async initialize() {}
      },
    };

    // Act: Bootstrap twice (simulating page reload or navigation)
    await firstBootstrap.bootstrap(config);

    // Second bootstrap with same config should succeed without throwing
    await expect(secondBootstrap.bootstrap(config)).resolves.not.toThrow();

    // Assert: No console warnings for payload schemas
    // (Payload schemas now use debug level logging per schemaUtils.js behavior)
    const payloadSchemaWarnings = consoleWarnSpy.mock.calls.filter((call) => {
      const message = call[0];
      return (
        typeof message === 'string' &&
        message.includes('already loaded') &&
        message.includes('#payload')
      );
    });

    // Should be 0 because payload schemas use debug level, not warn level
    expect(payloadSchemaWarnings.length).toBe(0);
  }, 30000); // 30 second timeout for mod loading

  it('should not produce any schema-related warnings on first bootstrap', async () => {
    // Arrange
    const config = {
      pageName: 'thematic-directions-manager',
      includeModLoading: true,
      customSchemas: [
        '/data/schemas/character-concept.schema.json',
        '/data/schemas/thematic-direction.schema.json',
        '/data/schemas/llm-configs.schema.json',
      ],
      controllerClass: class MockController {
        constructor() {}
        async initialize() {}
      },
    };

    // Act
    await expect(firstBootstrap.bootstrap(config)).resolves.not.toThrow();

    // Assert: No schema-related warnings on first load
    const schemaWarnings = consoleWarnSpy.mock.calls.filter((call) => {
      const message = call[0];
      return (
        typeof message === 'string' &&
        (message.includes('already loaded') || message.includes('Overwriting'))
      );
    });

    expect(schemaWarnings.length).toBe(0);
  }, 30000);
});
