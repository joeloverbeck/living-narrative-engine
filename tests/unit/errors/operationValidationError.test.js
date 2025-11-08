/**
 * @file operationValidationError.test.js
 * @description Unit tests for OperationValidationError
 * Tests for enhanced error messages with helper functions (Option B implementation)
 */

import { describe, it, expect } from '@jest/globals';
import OperationValidationError from '../../../src/errors/operationValidationError.js';

describe('OperationValidationError', () => {
  describe('constructor', () => {
    it('should create error with operation type and missing registrations', () => {
      const error = new OperationValidationError('TEST_OPERATION', ['whitelist']);

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(OperationValidationError);
      expect(error.name).toBe('OperationValidationError');
      expect(error.operationType).toBe('TEST_OPERATION');
      expect(error.missingRegistrations).toEqual(['whitelist']);
    });

    it('should generate detailed error message', () => {
      const error = new OperationValidationError('TEST_OPERATION', ['whitelist']);

      expect(error.message).toContain('TEST_OPERATION');
      expect(error.message).toContain('Missing registrations detected');
    });
  });

  describe('error message formatting', () => {
    describe('whitelist missing', () => {
      it('should include whitelist guidance when missing', () => {
        const error = new OperationValidationError('NEW_OP', ['whitelist']);

        expect(error.message).toContain('STEP 7: NOT IN PRE-VALIDATION WHITELIST');
        expect(error.message).toContain('src/utils/preValidationUtils.js');
        expect(error.message).toContain('KNOWN_OPERATION_TYPES array');
        expect(error.message).toContain("'NEW_OP',");
      });

      it('should include code example for whitelist', () => {
        const error = new OperationValidationError('NEW_OP', ['whitelist']);

        expect(error.message).toContain('const KNOWN_OPERATION_TYPES = [');
        expect(error.message).toContain("'NEW_OP',  // <-- Add this line");
      });
    });

    describe('schema missing', () => {
      it('should include schema file guidance when missing', () => {
        const error = new OperationValidationError('NEW_OP', ['schema']);

        expect(error.message).toContain('STEP 1: SCHEMA FILE NOT FOUND');
        expect(error.message).toContain('data/schemas/operations/newOp.schema.json');
        expect(error.message).toContain('Extend base-operation.schema.json');
        expect(error.message).toContain('"NEW_OP"');
      });

      it('should use correct schema file name convention', () => {
        const error = new OperationValidationError('VALIDATE_INVENTORY', ['schema']);

        // Should be camelCase
        expect(error.message).toContain('validateInventory.schema.json');
      });

      it('should include schema example', () => {
        const error = new OperationValidationError('NEW_OP', ['schema']);

        expect(error.message).toContain('allOf');
        expect(error.message).toContain('base-operation.schema.json');
        expect(error.message).toContain('"const": "NEW_OP"');
      });
    });

    describe('schema reference missing', () => {
      it('should include reference guidance when missing', () => {
        const error = new OperationValidationError('NEW_OP', ['reference']);

        expect(error.message).toContain('STEP 2: SCHEMA NOT REFERENCED');
        expect(error.message).toContain('data/schemas/operation.schema.json');
        expect(error.message).toContain('$defs.Operation.anyOf array');
        expect(error.message).toContain('"$ref": "./operations/newOp.schema.json"');
      });

      it('should include correct path structure', () => {
        const error = new OperationValidationError('NEW_OP', ['reference']);

        expect(error.message).toContain('$defs');
        expect(error.message).toContain('Operation');
        expect(error.message).toContain('anyOf');
      });
    });

    describe('token missing', () => {
      it('should include token guidance when missing', () => {
        const error = new OperationValidationError('NEW_OP', ['token']);

        expect(error.message).toContain('STEP 4: DI TOKEN NOT DEFINED');
        expect(error.message).toContain('src/dependencyInjection/tokens/tokens-core.js');
        expect(error.message).toContain('NewOpHandler');
        expect(error.message).toContain("NewOpHandler: 'NewOpHandler',");
      });

      it('should note that operation handlers do not use "I" prefix', () => {
        const error = new OperationValidationError('NEW_OP', ['token']);

        expect(error.message).toContain('Operation handlers do NOT use "I" prefix');
        expect(error.message).not.toContain('INewOpHandler');
      });

      it('should use correct token name convention', () => {
        const error = new OperationValidationError('VALIDATE_CAPACITY', ['token']);

        expect(error.message).toContain('ValidateCapacityHandler');
        expect(error.message).not.toContain('IValidateCapacityHandler');
      });
    });

    describe('handler registration missing', () => {
      it('should include handler registration guidance when missing', () => {
        const error = new OperationValidationError('NEW_OP', ['handler']);

        expect(error.message).toContain('STEP 5: HANDLER NOT REGISTERED');
        expect(error.message).toContain(
          'src/dependencyInjection/registrations/operationHandlerRegistrations.js'
        );
        expect(error.message).toContain('NewOpHandler');
      });

      it('should include import statement', () => {
        const error = new OperationValidationError('NEW_OP', ['handler']);

        expect(error.message).toContain('import NewOpHandler from');
        expect(error.message).toContain('newopHandler.js');
      });

      it('should include factory example', () => {
        const error = new OperationValidationError('NEW_OP', ['handler']);

        expect(error.message).toContain('token: tokens.NewOpHandler');
        expect(error.message).toContain('factory:');
        expect(error.message).toContain('new NewOpHandler');
      });
    });

    describe('operation mapping missing', () => {
      it('should include mapping guidance when missing', () => {
        const error = new OperationValidationError('NEW_OP', ['mapping']);

        expect(error.message).toContain('STEP 6: OPERATION NOT MAPPED');
        expect(error.message).toContain(
          'src/dependencyInjection/registrations/interpreterRegistrations.js'
        );
        expect(error.message).toContain("registry.register('NEW_OP'");
        expect(error.message).toContain('tokens.NewOpHandler');
      });

      it('should include mapping example', () => {
        const error = new OperationValidationError('NEW_OP', ['mapping']);

        expect(error.message).toContain('configureRegistry');
        expect(error.message).toContain('bind(tokens.NewOpHandler)');
      });
    });

    describe('multiple missing registrations', () => {
      it('should include all missing registration types', () => {
        const error = new OperationValidationError('NEW_OP', [
          'whitelist',
          'schema',
          'reference',
          'token',
          'handler',
          'mapping',
        ]);

        expect(error.message).toContain('STEP 7: NOT IN PRE-VALIDATION WHITELIST');
        expect(error.message).toContain('STEP 1: SCHEMA FILE NOT FOUND');
        expect(error.message).toContain('STEP 2: SCHEMA NOT REFERENCED');
        expect(error.message).toContain('STEP 4: DI TOKEN NOT DEFINED');
        expect(error.message).toContain('STEP 5: HANDLER NOT REGISTERED');
        expect(error.message).toContain('STEP 6: OPERATION NOT MAPPED');
      });

      it('should include verification commands', () => {
        const error = new OperationValidationError('NEW_OP', ['whitelist']);

        expect(error.message).toContain('Verification commands');
        expect(error.message).toContain('npm run validate');
        expect(error.message).toContain('npm run validate:strict');
        expect(error.message).toContain('npm run typecheck');
        expect(error.message).toContain('npm run test:unit');
      });

      it('should include complete registration guide reference', () => {
        const error = new OperationValidationError('NEW_OP', ['whitelist']);

        expect(error.message).toContain('Complete registration guide');
        expect(error.message).toContain('CLAUDE.md');
        expect(error.message).toContain('8-step checklist');
      });
    });

    describe('naming conventions', () => {
      it('should correctly convert ADD_COMPONENT', () => {
        const error = new OperationValidationError('ADD_COMPONENT', [
          'schema',
          'token',
        ]);

        expect(error.message).toContain('addComponent.schema.json');
        expect(error.message).toContain('AddComponentHandler');
      });

      it('should correctly convert VALIDATE_INVENTORY_CAPACITY', () => {
        const error = new OperationValidationError('VALIDATE_INVENTORY_CAPACITY', [
          'schema',
          'token',
        ]);

        expect(error.message).toContain('validateInventoryCapacity.schema.json');
        expect(error.message).toContain('ValidateInventoryCapacityHandler');
      });

      it('should handle single-word operations', () => {
        const error = new OperationValidationError('SEQUENCE', ['schema', 'token']);

        expect(error.message).toContain('sequence.schema.json');
        expect(error.message).toContain('SequenceHandler');
      });
    });

    describe('error message structure', () => {
      it('should have clear sections', () => {
        const error = new OperationValidationError('NEW_OP', [
          'whitelist',
          'schema',
        ]);

        // Header
        expect(error.message).toContain('Operation validation failed');

        // Missing registrations section
        expect(error.message).toContain('Missing registrations detected');

        // Verification commands section
        expect(error.message).toContain('Verification commands');

        // Complete guide section
        expect(error.message).toContain('Complete registration guide');

        // Tips section
        expect(error.message).toContain('Tip:');
      });

      it('should use emoji markers for clarity', () => {
        const error = new OperationValidationError('NEW_OP', ['whitelist']);

        expect(error.message).toContain('❌');
        expect(error.message).toContain('📋');
        expect(error.message).toContain('⚠️');
        expect(error.message).toContain('🔧');
        expect(error.message).toContain('📚');
        expect(error.message).toContain('💡');
      });
    });
  });

  describe('integration with helper functions', () => {
    it('should use toSchemaFileName helper for schema naming', () => {
      const error = new OperationValidationError('OPEN_CONTAINER', ['schema']);

      // Should match the helper function output
      expect(error.message).toContain('openContainer.schema.json');
    });

    it('should use toTokenName helper for token naming', () => {
      const error = new OperationValidationError('OPEN_CONTAINER', ['token']);

      // Should match the helper function output
      expect(error.message).toContain('OpenContainerHandler');
    });

    it('should use toHandlerClassName helper for handler class naming', () => {
      const error = new OperationValidationError('OPEN_CONTAINER', ['handler']);

      // Should match the helper function output
      expect(error.message).toContain('OpenContainerHandler');
    });
  });

  describe('real-world scenarios', () => {
    it('should provide helpful message for completely new operation', () => {
      const error = new OperationValidationError('MY_NEW_OPERATION', [
        'whitelist',
        'schema',
        'reference',
        'token',
        'handler',
        'mapping',
      ]);

      // Should include all steps
      expect(error.message).toContain('STEP 1');
      expect(error.message).toContain('STEP 2');
      expect(error.message).toContain('STEP 4');
      expect(error.message).toContain('STEP 5');
      expect(error.message).toContain('STEP 6');
      expect(error.message).toContain('STEP 7');

      // Should include naming conventions
      expect(error.message).toContain('myNewOperation.schema.json');
      expect(error.message).toContain('MyNewOperationHandler');
    });

    it('should provide concise message when only whitelist is missing', () => {
      const error = new OperationValidationError('FORGOT_WHITELIST', ['whitelist']);

      // Should mention whitelist
      expect(error.message).toContain('NOT IN PRE-VALIDATION WHITELIST');

      // Should not mention other steps if not in missing array
      const message = error.message;
      const hasSchemaMissing = message.includes('STEP 1: SCHEMA FILE NOT FOUND');
      expect(hasSchemaMissing).toBe(false);
    });
  });
});
