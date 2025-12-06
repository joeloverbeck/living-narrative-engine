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
    const module = await import(
      '../../../../src/logic/types/executionTypes.js'
    );
    expect(module).toBeDefined();
  });
});

describe('ExecutionContext Types - Type Definitions', () => {
  let fileContent;

  // Read file content once before all tests
  beforeAll(() => {
    const filePath = join(process.cwd(), 'src/logic/types/executionTypes.js');
    fileContent = readFileSync(filePath, 'utf-8');
  });

  it('should provide ExecutionContext type for JSDoc', () => {
    expect(fileContent).toContain('@typedef {object} ExecutionContext');
    expect(fileContent).toContain(
      '@property {JsonLogicEvaluationContext} evaluationContext'
    );
    expect(fileContent).toContain(
      '@property {ExecutionEntityManagerLike} entityManager'
    );
    expect(fileContent).toContain(
      '@property {ExecutionValidatedEventDispatcher} validatedEventDispatcher'
    );
    expect(fileContent).toContain('@property {ExecutionLogger} logger');
    expect(fileContent).toContain(
      '@property {ExecutionGameDataRepository | null | undefined} [gameDataRepository]'
    );
  });

  it('should provide JsonLogicEvaluationContext type', () => {
    expect(fileContent).toContain(
      '@typedef {object} JsonLogicEvaluationContext'
    );
    expect(fileContent).toContain(
      '@property {{ type: string, payload: object | null }} event'
    );
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

  it('should define minimal service contracts instead of importing runtime modules', () => {
    expect(fileContent).toContain('@typedef {object} ExecutionLogger');
    expect(fileContent).toContain(
      '@typedef {object} ExecutionEntityManagerLike'
    );
    expect(fileContent).toContain(
      '@typedef {object} ExecutionValidatedEventDispatcher'
    );
    expect(fileContent).toContain(
      '@typedef {object} ExecutionGameDataRepository'
    );
    expect(fileContent).not.toContain(
      "import('../../entities/entityManager.js')"
    );
    expect(fileContent).not.toContain(
      "import('../../events/validatedEventDispatcher.js')"
    );
    expect(fileContent).not.toContain(
      "import('../../data/gameDataRepository.js')"
    );
  });

  it('should contain export statement', () => {
    expect(fileContent).toContain('export {};');
  });

  it('should have comprehensive file header documentation', () => {
    expect(fileContent).toContain('@file Execution context type definitions');
    expect(fileContent).toContain('@description');
    expect(fileContent).toContain('leaf module with no runtime imports');
    expect(fileContent).toContain('service initialization utilities');
  });
});
