import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { createTestBed } from '../../common/testBed.js';
import { ComponentStateValidator } from '../../../src/utils/componentStateValidator.js';
import { InvalidArgumentError } from '../../../src/errors/invalidArgumentError.js';
import { EntityNotFoundError } from '../../../src/errors/entityNotFoundError.js';

describe('ComponentStateValidator', () => {
  let testBed;
  let validator;
  let mockLogger;

  beforeEach(() => {
    testBed = createTestBed();
    mockLogger = testBed.createMockLogger();
    validator = new ComponentStateValidator({ logger: mockLogger });
  });

  afterEach(() => {
    testBed.cleanup();
  });

  describe('Constructor', () => {
    it('should validate logger dependency', () => {
      expect(() => new ComponentStateValidator({ logger: null })).toThrow(
        'Missing required dependency: ILogger'
      );
    });

    it('should require logger with required methods', () => {
      const invalidLogger = { info: jest.fn() }; // Missing other methods
      expect(
        () => new ComponentStateValidator({ logger: invalidLogger })
      ).toThrow("Invalid or missing method 'warn' on dependency 'ILogger'");
    });

    it('should create validator with valid logger', () => {
      const validLogger = testBed.createMockLogger();
      expect(
        () => new ComponentStateValidator({ logger: validLogger })
      ).not.toThrow();
    });
  });

  describe('validateFurnitureComponent', () => {
    describe('Valid cases', () => {
      it('should validate furniture with valid spots', () => {
        const component = { spots: [null, 'core:actor1', null] };

        expect(() =>
          validator.validateFurnitureComponent('core:chair', component)
        ).not.toThrow();
        expect(mockLogger.debug).toHaveBeenCalledWith(
          'Furniture component validated',
          expect.objectContaining({
            furnitureId: 'core:chair',
            spotsCount: 3,
            context: 'furniture validation',
          })
        );
      });

      it('should validate furniture with custom context', () => {
        const component = { spots: ['core:actor1'] };

        expect(() =>
          validator.validateFurnitureComponent(
            'core:chair',
            component,
            'sitting operation'
          )
        ).not.toThrow();
        expect(mockLogger.debug).toHaveBeenCalledWith(
          'Furniture component validated',
          expect.objectContaining({ context: 'sitting operation' })
        );
      });

      it('should validate furniture with single spot', () => {
        const component = { spots: [null] };

        expect(() =>
          validator.validateFurnitureComponent('core:stool', component)
        ).not.toThrow();
      });

      it('should validate furniture with maximum spots', () => {
        const component = { spots: new Array(10).fill(null) };

        expect(() =>
          validator.validateFurnitureComponent('core:bench', component)
        ).not.toThrow();
      });

      it('should validate furniture with mixed occupied and empty spots', () => {
        const component = {
          spots: [null, 'core:actor1', null, 'mod:npc2', null],
        };

        expect(() =>
          validator.validateFurnitureComponent('core:table', component)
        ).not.toThrow();
      });
    });

    describe('Parameter validation', () => {
      it('should require non-blank furniture ID', () => {
        const component = { spots: [null] };

        expect(() =>
          validator.validateFurnitureComponent('', component)
        ).toThrow(InvalidArgumentError);
        expect(() =>
          validator.validateFurnitureComponent(null, component)
        ).toThrow(InvalidArgumentError);
        expect(() =>
          validator.validateFurnitureComponent('   ', component)
        ).toThrow(InvalidArgumentError);
      });

      it('should require non-blank context', () => {
        const component = { spots: [null] };

        expect(() =>
          validator.validateFurnitureComponent('core:chair', component, '')
        ).toThrow(InvalidArgumentError);
        expect(() =>
          validator.validateFurnitureComponent('core:chair', component, null)
        ).toThrow(InvalidArgumentError);
        expect(() =>
          validator.validateFurnitureComponent('core:chair', component, '   ')
        ).toThrow(InvalidArgumentError);
      });
    });

    describe('Component validation errors', () => {
      it('should throw EntityNotFoundError for missing component', () => {
        expect(() =>
          validator.validateFurnitureComponent('core:chair', null)
        ).toThrow(EntityNotFoundError);
        expect(() =>
          validator.validateFurnitureComponent('core:chair', null)
        ).toThrow('Furniture core:chair missing allows_sitting component');

        expect(() =>
          validator.validateFurnitureComponent('core:chair', undefined)
        ).toThrow(EntityNotFoundError);
      });

      it('should throw InvalidArgumentError for missing spots array', () => {
        const component = {};

        expect(() =>
          validator.validateFurnitureComponent('core:chair', component)
        ).toThrow(InvalidArgumentError);
        expect(() =>
          validator.validateFurnitureComponent('core:chair', component)
        ).toThrow('Furniture core:chair has invalid spots array');
      });

      it('should throw InvalidArgumentError for null spots array', () => {
        const component = { spots: null };

        expect(() =>
          validator.validateFurnitureComponent('core:chair', component)
        ).toThrow(InvalidArgumentError);
        expect(() =>
          validator.validateFurnitureComponent('core:chair', component)
        ).toThrow('Furniture core:chair has invalid spots array');
      });

      it('should throw InvalidArgumentError for non-array spots', () => {
        const component = { spots: 'not-an-array' };

        expect(() =>
          validator.validateFurnitureComponent('core:chair', component)
        ).toThrow(InvalidArgumentError);
        expect(() =>
          validator.validateFurnitureComponent('core:chair', component)
        ).toThrow('Furniture core:chair has invalid spots array');
      });

      it('should throw InvalidArgumentError for empty spots array', () => {
        const component = { spots: [] };

        expect(() =>
          validator.validateFurnitureComponent('core:chair', component)
        ).toThrow(InvalidArgumentError);
        expect(() =>
          validator.validateFurnitureComponent('core:chair', component)
        ).toThrow('Furniture core:chair has empty spots array');
      });

      it('should throw InvalidArgumentError for exceeding maximum spots', () => {
        const component = { spots: new Array(11).fill(null) };

        expect(() =>
          validator.validateFurnitureComponent('core:longbench', component)
        ).toThrow(InvalidArgumentError);
        expect(() =>
          validator.validateFurnitureComponent('core:longbench', component)
        ).toThrow('Furniture core:longbench exceeds maximum spots (10)');
      });
    });

    describe('Spot validation errors', () => {
      it('should throw InvalidArgumentError for invalid occupant ID format', () => {
        const component = { spots: [null, 'invalid-id-no-colon'] };

        expect(() =>
          validator.validateFurnitureComponent('core:chair', component)
        ).toThrow(InvalidArgumentError);
        expect(() =>
          validator.validateFurnitureComponent('core:chair', component)
        ).toThrow(
          'Furniture core:chair spot 1 has invalid occupant ID: invalid-id-no-colon'
        );
      });

      it('should throw InvalidArgumentError for non-string occupant ID', () => {
        const component = { spots: [null, 123] };

        expect(() =>
          validator.validateFurnitureComponent('core:chair', component)
        ).toThrow(InvalidArgumentError);
        expect(() =>
          validator.validateFurnitureComponent('core:chair', component)
        ).toThrow('Furniture core:chair spot 1 has invalid occupant ID: 123');
      });

      it('should throw InvalidArgumentError for empty string occupant ID', () => {
        const component = { spots: [null, ''] };

        expect(() =>
          validator.validateFurnitureComponent('core:chair', component)
        ).toThrow(InvalidArgumentError);
        expect(() =>
          validator.validateFurnitureComponent('core:chair', component)
        ).toThrow('Furniture core:chair spot 1 has invalid occupant ID: ');
      });

      it('should throw InvalidArgumentError for object occupant ID', () => {
        const component = { spots: [null, {}] };

        expect(() =>
          validator.validateFurnitureComponent('core:chair', component)
        ).toThrow(InvalidArgumentError);
        expect(() =>
          validator.validateFurnitureComponent('core:chair', component)
        ).toThrow(
          'Furniture core:chair spot 1 has invalid occupant ID: [object Object]'
        );
      });

      it('should validate correct spot index in error messages', () => {
        const component = { spots: ['core:valid', null, 'invalid-id', null] };

        expect(() =>
          validator.validateFurnitureComponent('core:chair', component)
        ).toThrow(
          'Furniture core:chair spot 2 has invalid occupant ID: invalid-id'
        );
      });
    });

    describe('Error logging', () => {
      it('should log error details on validation failure', () => {
        const component = { spots: [] };

        try {
          validator.validateFurnitureComponent(
            'core:chair',
            component,
            'test context'
          );
        } catch {
          // Expected to throw
        }

        expect(mockLogger.error).toHaveBeenCalledWith(
          'Furniture validation failed for core:chair',
          expect.objectContaining({
            error: 'Furniture core:chair has empty spots array',
            context: 'test context',
          })
        );
      });
    });
  });

  describe('validateClosenessComponent', () => {
    describe('Valid cases', () => {
      it('should allow null closeness component', () => {
        expect(() =>
          validator.validateClosenessComponent('core:actor1', null)
        ).not.toThrow();

        // Should not log debug for null component
        expect(mockLogger.debug).not.toHaveBeenCalled();
      });

      it('should validate component with partners', () => {
        const component = { partners: ['core:actor2', 'core:actor3'] };

        expect(() =>
          validator.validateClosenessComponent('core:actor1', component)
        ).not.toThrow();
        expect(mockLogger.debug).toHaveBeenCalledWith(
          'Closeness component validated',
          expect.objectContaining({
            actorId: 'core:actor1',
            partnerCount: 2,
            context: 'closeness validation',
          })
        );
      });

      it('should validate component with custom context', () => {
        const component = { partners: ['core:actor2'] };

        expect(() =>
          validator.validateClosenessComponent(
            'core:actor1',
            component,
            'relationship setup'
          )
        ).not.toThrow();
        expect(mockLogger.debug).toHaveBeenCalledWith(
          'Closeness component validated',
          expect.objectContaining({ context: 'relationship setup' })
        );
      });

      it('should validate component with empty partners array', () => {
        const component = { partners: [] };

        expect(() =>
          validator.validateClosenessComponent('core:actor1', component)
        ).not.toThrow();
        expect(mockLogger.debug).toHaveBeenCalledWith(
          'Closeness component validated',
          expect.objectContaining({ partnerCount: 0 })
        );
      });

      it('should validate component with different namespaced partners', () => {
        const component = {
          partners: ['core:actor2', 'mod:npc1', 'custom:character3'],
        };

        expect(() =>
          validator.validateClosenessComponent('core:actor1', component)
        ).not.toThrow();
      });
    });

    describe('Parameter validation', () => {
      it('should require non-blank actor ID', () => {
        const component = { partners: [] };

        expect(() =>
          validator.validateClosenessComponent('', component)
        ).toThrow(InvalidArgumentError);
        expect(() =>
          validator.validateClosenessComponent(null, component)
        ).toThrow(InvalidArgumentError);
        expect(() =>
          validator.validateClosenessComponent('   ', component)
        ).toThrow(InvalidArgumentError);
      });

      it('should require non-blank context', () => {
        const component = { partners: [] };

        expect(() =>
          validator.validateClosenessComponent('core:actor1', component, '')
        ).toThrow(InvalidArgumentError);
        expect(() =>
          validator.validateClosenessComponent('core:actor1', component, null)
        ).toThrow(InvalidArgumentError);
        expect(() =>
          validator.validateClosenessComponent('core:actor1', component, '   ')
        ).toThrow(InvalidArgumentError);
      });
    });

    describe('Component validation errors', () => {
      it('should throw InvalidArgumentError for missing partners array', () => {
        const component = {};

        expect(() =>
          validator.validateClosenessComponent('core:actor1', component)
        ).toThrow(InvalidArgumentError);
        expect(() =>
          validator.validateClosenessComponent('core:actor1', component)
        ).toThrow('Actor core:actor1 has invalid closeness partners array');
      });

      it('should throw InvalidArgumentError for null partners array', () => {
        const component = { partners: null };

        expect(() =>
          validator.validateClosenessComponent('core:actor1', component)
        ).toThrow(InvalidArgumentError);
        expect(() =>
          validator.validateClosenessComponent('core:actor1', component)
        ).toThrow('Actor core:actor1 has invalid closeness partners array');
      });

      it('should throw InvalidArgumentError for non-array partners', () => {
        const component = { partners: 'not-an-array' };

        expect(() =>
          validator.validateClosenessComponent('core:actor1', component)
        ).toThrow(InvalidArgumentError);
        expect(() =>
          validator.validateClosenessComponent('core:actor1', component)
        ).toThrow('Actor core:actor1 has invalid closeness partners array');
      });
    });

    describe('Partner validation errors', () => {
      it('should throw InvalidArgumentError for invalid partner ID format', () => {
        const component = { partners: ['core:actor2', 'invalid-id-no-colon'] };

        expect(() =>
          validator.validateClosenessComponent('core:actor1', component)
        ).toThrow(InvalidArgumentError);
        expect(() =>
          validator.validateClosenessComponent('core:actor1', component)
        ).toThrow(
          'Actor core:actor1 has invalid partner ID at index 1: invalid-id-no-colon'
        );
      });

      it('should throw InvalidArgumentError for non-string partner ID', () => {
        const component = { partners: ['core:actor2', 123] };

        expect(() =>
          validator.validateClosenessComponent('core:actor1', component)
        ).toThrow(InvalidArgumentError);
        expect(() =>
          validator.validateClosenessComponent('core:actor1', component)
        ).toThrow('Actor core:actor1 has invalid partner ID at index 1: 123');
      });

      it('should throw InvalidArgumentError for empty string partner ID', () => {
        const component = { partners: [''] };

        expect(() =>
          validator.validateClosenessComponent('core:actor1', component)
        ).toThrow(InvalidArgumentError);
        expect(() =>
          validator.validateClosenessComponent('core:actor1', component)
        ).toThrow('Actor core:actor1 has invalid partner ID at index 0: ');
      });

      it('should validate correct partner index in error messages', () => {
        const component = {
          partners: ['core:valid', 'core:valid2', 'invalid-id'],
        };

        expect(() =>
          validator.validateClosenessComponent('core:actor1', component)
        ).toThrow(
          'Actor core:actor1 has invalid partner ID at index 2: invalid-id'
        );
      });

      it('should throw InvalidArgumentError for duplicate partners', () => {
        const component = {
          partners: ['core:actor2', 'core:actor3', 'core:actor2'],
        };

        expect(() =>
          validator.validateClosenessComponent('core:actor1', component)
        ).toThrow(InvalidArgumentError);
        expect(() =>
          validator.validateClosenessComponent('core:actor1', component)
        ).toThrow(
          'Actor core:actor1 has duplicate partners in closeness component'
        );
      });

      it('should throw InvalidArgumentError for self-reference', () => {
        const component = { partners: ['core:actor2', 'core:actor1'] };

        expect(() =>
          validator.validateClosenessComponent('core:actor1', component)
        ).toThrow(InvalidArgumentError);
        expect(() =>
          validator.validateClosenessComponent('core:actor1', component)
        ).toThrow('Actor core:actor1 cannot be partner with themselves');
      });

      it('should throw InvalidArgumentError for self-reference only', () => {
        const component = { partners: ['core:actor1'] };

        expect(() =>
          validator.validateClosenessComponent('core:actor1', component)
        ).toThrow(InvalidArgumentError);
        expect(() =>
          validator.validateClosenessComponent('core:actor1', component)
        ).toThrow('Actor core:actor1 cannot be partner with themselves');
      });
    });

    describe('Error logging', () => {
      it('should log error details on validation failure', () => {
        const component = { partners: ['invalid-id'] };

        try {
          validator.validateClosenessComponent(
            'core:actor1',
            component,
            'test context'
          );
        } catch {
          // Expected to throw
        }

        expect(mockLogger.error).toHaveBeenCalledWith(
          'Closeness validation failed for core:actor1',
          expect.objectContaining({
            error:
              'Actor core:actor1 has invalid partner ID at index 0: invalid-id',
            context: 'test context',
          })
        );
      });
    });
  });

  describe('validateBidirectionalCloseness', () => {
    let mockEntityManager;

    beforeEach(() => {
      mockEntityManager = testBed.createMock('EntityManager', [
        'getComponentData',
      ]);
    });

    describe('Valid cases', () => {
      it('should validate bidirectional relationships', () => {
        mockEntityManager.getComponentData
          .mockReturnValueOnce({ partners: ['core:actor2'] }) // actor1 has actor2
          .mockReturnValueOnce({ partners: ['core:actor1'] }); // actor2 has actor1

        expect(() =>
          validator.validateBidirectionalCloseness(
            mockEntityManager,
            'core:actor1',
            'core:actor2'
          )
        ).not.toThrow();

        expect(mockLogger.debug).toHaveBeenCalledWith(
          'Bidirectional closeness validated',
          { actorId: 'core:actor1', partnerId: 'core:actor2' }
        );
      });

      it('should validate when neither has relationships', () => {
        mockEntityManager.getComponentData
          .mockReturnValueOnce(null) // actor1 has no closeness
          .mockReturnValueOnce(null); // actor2 has no closeness

        expect(() =>
          validator.validateBidirectionalCloseness(
            mockEntityManager,
            'core:actor1',
            'core:actor2'
          )
        ).not.toThrow();
      });

      it('should validate when both have empty partners arrays', () => {
        mockEntityManager.getComponentData
          .mockReturnValueOnce({ partners: [] }) // actor1 has empty partners
          .mockReturnValueOnce({ partners: [] }); // actor2 has empty partners

        expect(() =>
          validator.validateBidirectionalCloseness(
            mockEntityManager,
            'core:actor1',
            'core:actor2'
          )
        ).not.toThrow();
      });

      it('should validate when one has no closeness component', () => {
        mockEntityManager.getComponentData
          .mockReturnValueOnce(null) // actor1 has no closeness
          .mockReturnValueOnce({ partners: [] }); // actor2 has empty partners

        expect(() =>
          validator.validateBidirectionalCloseness(
            mockEntityManager,
            'core:actor1',
            'core:actor2'
          )
        ).not.toThrow();
      });

      it('should validate relationships with multiple partners', () => {
        mockEntityManager.getComponentData
          .mockReturnValueOnce({ partners: ['core:actor2', 'core:actor3'] }) // actor1 has multiple partners
          .mockReturnValueOnce({ partners: ['core:actor1', 'core:actor4'] }); // actor2 has multiple partners

        expect(() =>
          validator.validateBidirectionalCloseness(
            mockEntityManager,
            'core:actor1',
            'core:actor2'
          )
        ).not.toThrow();
      });
    });

    describe('Parameter validation', () => {
      it('should require non-blank actor ID', () => {
        expect(() =>
          validator.validateBidirectionalCloseness(
            mockEntityManager,
            '',
            'core:actor2'
          )
        ).toThrow(InvalidArgumentError);
        expect(() =>
          validator.validateBidirectionalCloseness(
            mockEntityManager,
            null,
            'core:actor2'
          )
        ).toThrow(InvalidArgumentError);
        expect(() =>
          validator.validateBidirectionalCloseness(
            mockEntityManager,
            '   ',
            'core:actor2'
          )
        ).toThrow(InvalidArgumentError);
      });

      it('should require non-blank partner ID', () => {
        expect(() =>
          validator.validateBidirectionalCloseness(
            mockEntityManager,
            'core:actor1',
            ''
          )
        ).toThrow(InvalidArgumentError);
        expect(() =>
          validator.validateBidirectionalCloseness(
            mockEntityManager,
            'core:actor1',
            null
          )
        ).toThrow(InvalidArgumentError);
        expect(() =>
          validator.validateBidirectionalCloseness(
            mockEntityManager,
            'core:actor1',
            '   '
          )
        ).toThrow(InvalidArgumentError);
      });

      it('should require entity manager', () => {
        expect(() =>
          validator.validateBidirectionalCloseness(
            null,
            'core:actor1',
            'core:actor2'
          )
        ).toThrow(InvalidArgumentError);
        expect(() =>
          validator.validateBidirectionalCloseness(
            null,
            'core:actor1',
            'core:actor2'
          )
        ).toThrow('Entity manager is required for bidirectional validation');
      });
    });

    describe('Unidirectional relationship detection', () => {
      it('should detect unidirectional relationships (A→B but not B→A)', () => {
        mockEntityManager.getComponentData
          .mockReturnValueOnce({ partners: ['core:actor2'] }) // actor1 has actor2
          .mockReturnValueOnce({ partners: [] }); // actor2 doesn't have actor1

        expect(() =>
          validator.validateBidirectionalCloseness(
            mockEntityManager,
            'core:actor1',
            'core:actor2'
          )
        ).toThrow(InvalidArgumentError);

        // Setup mock again for second call
        mockEntityManager.getComponentData
          .mockReturnValueOnce({ partners: ['core:actor2'] }) // actor1 has actor2
          .mockReturnValueOnce({ partners: [] }); // actor2 doesn't have actor1

        expect(() =>
          validator.validateBidirectionalCloseness(
            mockEntityManager,
            'core:actor1',
            'core:actor2'
          )
        ).toThrow(
          'Unidirectional closeness detected: core:actor1 → core:actor2 but not reverse'
        );
      });

      it('should detect unidirectional relationships (B→A but not A→B)', () => {
        mockEntityManager.getComponentData
          .mockReturnValueOnce({ partners: [] }) // actor1 doesn't have actor2
          .mockReturnValueOnce({ partners: ['core:actor1'] }); // actor2 has actor1

        expect(() =>
          validator.validateBidirectionalCloseness(
            mockEntityManager,
            'core:actor1',
            'core:actor2'
          )
        ).toThrow(InvalidArgumentError);

        // Setup mock again for second call
        mockEntityManager.getComponentData
          .mockReturnValueOnce({ partners: [] }) // actor1 doesn't have actor2
          .mockReturnValueOnce({ partners: ['core:actor1'] }); // actor2 has actor1

        expect(() =>
          validator.validateBidirectionalCloseness(
            mockEntityManager,
            'core:actor1',
            'core:actor2'
          )
        ).toThrow(
          'Unidirectional closeness detected: core:actor2 → core:actor1 but not reverse'
        );
      });

      it('should detect unidirectional when actor1 has partner but actor2 has null closeness', () => {
        mockEntityManager.getComponentData
          .mockReturnValueOnce({ partners: ['core:actor2'] }) // actor1 has actor2
          .mockReturnValueOnce(null); // actor2 has no closeness component

        expect(() =>
          validator.validateBidirectionalCloseness(
            mockEntityManager,
            'core:actor1',
            'core:actor2'
          )
        ).toThrow(
          'Unidirectional closeness detected: core:actor1 → core:actor2 but not reverse'
        );
      });

      it('should detect unidirectional when actor2 has partner but actor1 has null closeness', () => {
        mockEntityManager.getComponentData
          .mockReturnValueOnce(null) // actor1 has no closeness component
          .mockReturnValueOnce({ partners: ['core:actor1'] }); // actor2 has actor1

        expect(() =>
          validator.validateBidirectionalCloseness(
            mockEntityManager,
            'core:actor1',
            'core:actor2'
          )
        ).toThrow(
          'Unidirectional closeness detected: core:actor2 → core:actor1 but not reverse'
        );
      });

      it('should detect unidirectional with multiple partners', () => {
        mockEntityManager.getComponentData
          .mockReturnValueOnce({ partners: ['core:actor2', 'core:actor3'] }) // actor1 has actor2 and actor3
          .mockReturnValueOnce({ partners: ['core:actor3'] }); // actor2 only has actor3, not actor1

        expect(() =>
          validator.validateBidirectionalCloseness(
            mockEntityManager,
            'core:actor1',
            'core:actor2'
          )
        ).toThrow(
          'Unidirectional closeness detected: core:actor1 → core:actor2 but not reverse'
        );
      });
    });

    describe('Entity manager interaction', () => {
      it('should call getComponentData with correct parameters', () => {
        mockEntityManager.getComponentData
          .mockReturnValueOnce({ partners: [] })
          .mockReturnValueOnce({ partners: [] });

        validator.validateBidirectionalCloseness(
          mockEntityManager,
          'core:actor1',
          'core:actor2'
        );

        expect(mockEntityManager.getComponentData).toHaveBeenCalledTimes(2);
        expect(mockEntityManager.getComponentData).toHaveBeenCalledWith(
          'core:actor1',
          'personal-space-states:closeness'
        );
        expect(mockEntityManager.getComponentData).toHaveBeenCalledWith(
          'core:actor2',
          'personal-space-states:closeness'
        );
      });
    });

    describe('Error logging', () => {
      it('should log error details on validation failure', () => {
        mockEntityManager.getComponentData
          .mockReturnValueOnce({ partners: ['core:actor2'] })
          .mockReturnValueOnce({ partners: [] });

        try {
          validator.validateBidirectionalCloseness(
            mockEntityManager,
            'core:actor1',
            'core:actor2'
          );
        } catch {
          // Expected to throw
        }

        expect(mockLogger.error).toHaveBeenCalledWith(
          'Bidirectional validation failed for core:actor1 and core:actor2',
          expect.objectContaining({
            error:
              'Unidirectional closeness detected: core:actor1 → core:actor2 but not reverse',
          })
        );
      });
    });
  });
});
