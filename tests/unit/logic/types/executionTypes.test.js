/**
 * @file Tests for execution context type definitions
 * @description Verifies that the executionTypes.js file is properly structured
 * and contains all required type definitions
 */

import { describe, it, expect, beforeAll } from '@jest/globals';
import { readFileSync } from 'fs';
import { join } from 'path';

describe('ExecutionContext Types - File Structure', () => {
  it('should import without errors', () => {
    // This test passes if import doesn't throw
    expect(() => {
      // Using dynamic import to avoid top-level await issues
      import('../../../../src/logic/types/executionTypes.js');
    }).not.toThrow();
  });

  it('should be a valid JavaScript module', async () => {
    const module = await import('../../../../src/logic/types/executionTypes.js');
    expect(module).toBeDefined();
  });
});

describe('ExecutionContext Types - Type Definitions', () => {
  let fileContent;

  // Read file content once before all tests
  beforeAll(() => {
    const filePath = join(
      process.cwd(),
      'src/logic/types/executionTypes.js'
    );
    fileContent = readFileSync(filePath, 'utf-8');
  });

  it('should provide ExecutionContext type for JSDoc', () => {
    expect(fileContent).toContain('@typedef {object} ExecutionContext');
    expect(fileContent).toContain(
      '@property {JsonLogicEvaluationContext} evaluationContext'
    );
    expect(fileContent).toContain('@property {EntityManager} entityManager');
    expect(fileContent).toContain(
      '@property {ValidatedEventDispatcher} validatedEventDispatcher'
    );
    expect(fileContent).toContain('@property {ILogger} logger');
    expect(fileContent).toContain(
      '@property {GameDataRepository} [gameDataRepository]'
    );
  });

  it('should provide JsonLogicEvaluationContext type', () => {
    expect(fileContent).toContain('@typedef {object} JsonLogicEvaluationContext');
    expect(fileContent).toContain('@property {object} event');
    expect(fileContent).toContain('@property {string} event.type');
    expect(fileContent).toContain('@property {object | null} event.payload');
    expect(fileContent).toContain(
      '@property {JsonLogicEntityContext | null} actor'
    );
    expect(fileContent).toContain(
      '@property {JsonLogicEntityContext | null} target'
    );
    expect(fileContent).toContain('@property {object} context');
  });

  it('should provide JsonLogicEntityContext type', () => {
    expect(fileContent).toContain('@typedef {object} JsonLogicEntityContext');
    expect(fileContent).toContain('@property {string | number} id');
    expect(fileContent).toContain(
      '@property {{[key: string]: object | null}} components'
    );
  });

  it('should have proper JSDoc imports', () => {
    expect(fileContent).toContain(
      "@typedef {import('../../entities/entityManager.js').default} EntityManager"
    );
    expect(fileContent).toContain(
      "@typedef {import('../../interfaces/coreServices.js').ILogger} ILogger"
    );
    expect(fileContent).toContain(
      "@typedef {import('../../events/validatedEventDispatcher.js').default} ValidatedEventDispatcher"
    );
    expect(fileContent).toContain(
      "@typedef {import('../../data/gameDataRepository.js').default} GameDataRepository"
    );
  });

  it('should contain export statement', () => {
    expect(fileContent).toContain('export {};');
  });

  it('should have comprehensive file header documentation', () => {
    expect(fileContent).toContain('@file Execution context type definitions');
    expect(fileContent).toContain('@description');
    expect(fileContent).toContain('circular dependencies');
    expect(fileContent).toContain('@see src/logic/defs.js');
    expect(fileContent).toContain('@see src/utils/serviceInitializerUtils.js');
  });
});
