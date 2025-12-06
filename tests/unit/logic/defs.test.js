/**
 * @file Unit tests for logic/defs.js re-export verification
 * @description Tests to ensure ExecutionContext types are properly re-exported
 * from executionTypes.js for backward compatibility.
 */

import { describe, it, expect } from '@jest/globals';
import { readFileSync } from 'fs';
import { join } from 'path';

describe('Logic Defs - Type Re-export Verification', () => {
  const defsPath = join(process.cwd(), 'src/logic/defs.js');
  let defsContent;

  beforeAll(() => {
    defsContent = readFileSync(defsPath, 'utf-8');
  });

  describe('Re-export Implementation', () => {
    it('should have re-export statement for executionTypes', () => {
      expect(defsContent).toContain(
        "export * from './types/executionTypes.js'"
      );
    });

    it('should have explanatory file header comment', () => {
      expect(defsContent).toContain(
        'ExecutionContext and related types have been extracted'
      );
      expect(defsContent).toContain('src/logic/types/executionTypes.js');
      expect(defsContent).toContain('backward compatibility');
    });
  });

  describe('Duplicate Type Definition Removal', () => {
    it('should not have duplicate ExecutionContext typedef definition', () => {
      // Count occurrences of @typedef {object} ExecutionContext
      const matches = defsContent.match(
        /@typedef\s+\{object\}\s+ExecutionContext/g
      );

      // Should not have any direct definitions (only re-export)
      expect(matches).toBeNull();
    });

    it('should not have duplicate JsonLogicEvaluationContext typedef definition', () => {
      // Count occurrences of @typedef {object} JsonLogicEvaluationContext
      const matches = defsContent.match(
        /@typedef\s+\{object\}\s+JsonLogicEvaluationContext/g
      );

      // Should not have any direct definitions (only re-export)
      expect(matches).toBeNull();
    });

    it('should not have duplicate JsonLogicEntityContext typedef definition', () => {
      // Count occurrences of @typedef {object} JsonLogicEntityContext
      const matches = defsContent.match(
        /@typedef\s+\{object\}\s+JsonLogicEntityContext/g
      );

      // Should not have any direct definitions (only re-export)
      expect(matches).toBeNull();
    });
  });

  describe('Type Definition Preservation', () => {
    it('should preserve OperationParams typedef', () => {
      expect(defsContent).toContain('@typedef {object} OperationParams');
    });

    it('should preserve OperationHandler typedef', () => {
      expect(defsContent).toContain('@typedef {object} OperationHandler');
    });

    it('should preserve BaseHandlerDeps typedef', () => {
      expect(defsContent).toContain('@typedef {object} BaseHandlerDeps');
    });

    it('should preserve EntityOperationDeps typedef', () => {
      expect(defsContent).toContain('@typedef {object} EntityOperationDeps');
    });

    it('should preserve EventDispatchDeps typedef', () => {
      expect(defsContent).toContain('@typedef {object} EventDispatchDeps');
    });

    it('should preserve ContextOperationDeps typedef', () => {
      expect(defsContent).toContain('@typedef {object} ContextOperationDeps');
    });

    it('should preserve ClosenessCircleDeps typedef', () => {
      expect(defsContent).toContain('@typedef {object} ClosenessCircleDeps');
    });

    it('should preserve GameEvent typedef', () => {
      expect(defsContent).toContain('@typedef {object} GameEvent');
    });
  });

  describe('Module Export', () => {
    it('should have empty export statement at the end', () => {
      expect(defsContent).toContain('export {};');
    });

    it('should be importable without errors', () => {
      // This test verifies the module can be loaded
      expect(() => {
        require('../../../src/logic/defs.js');
      }).not.toThrow();
    });
  });

  describe('Import Compatibility', () => {
    it('should allow imports from logic/defs.js (backward compatibility)', () => {
      // This verifies the old import path still works
      expect(() => {
        const defs = require('../../../src/logic/defs.js');
        // Module should load successfully
        expect(defs).toBeDefined();
      }).not.toThrow();
    });

    it('should allow imports from executionTypes.js (new location)', () => {
      // This verifies the new import path works
      expect(() => {
        const types = require('../../../src/logic/types/executionTypes.js');
        // Module should load successfully
        expect(types).toBeDefined();
      }).not.toThrow();
    });
  });

  describe('File Structure', () => {
    it('should have re-export statement before type definitions', () => {
      const reExportIndex = defsContent.indexOf(
        "export * from './types/executionTypes.js'"
      );
      const firstTypedefIndex = defsContent.indexOf('@typedef');

      expect(reExportIndex).toBeGreaterThan(0);
      expect(firstTypedefIndex).toBeGreaterThan(0);
      expect(reExportIndex).toBeLessThan(firstTypedefIndex);
    });

    it('should have file header comment at the start', () => {
      const headerIndex = defsContent.indexOf(
        '@file Operation handler type definitions'
      );
      expect(headerIndex).toBeGreaterThan(0);
      expect(headerIndex).toBeLessThan(100); // Should be near the start
    });
  });
});
