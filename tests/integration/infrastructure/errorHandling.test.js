/**
 * @file Error Handling Infrastructure Tests - Corrected Version
 * @description Robust error scenario validation for mod testing infrastructure components
 * Tests error handling patterns, recovery mechanisms, and edge cases across all components
 *
 * This test suite has been corrected to match the actual production code APIs
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ModTestHandlerFactory } from '../../../tests/common/mods/ModTestHandlerFactory.js';
import { ModEntityBuilder } from '../../../tests/common/mods/ModEntityBuilder.js';
import { ModAssertionHelpers } from '../../../tests/common/mods/ModAssertionHelpers.js';
import { ModTestFixture } from '../../../tests/common/mods/ModTestFixture.js';
import { createTestBed } from '../../common/testBed.js';

describe('Infrastructure Error Handling - Corrected', () => {
  let testBed;
  let mockLogger;
  let mockEntityManager;
  let mockEventBus;
  let mockGameDataRepository;

  beforeEach(() => {
    testBed = createTestBed();
    mockLogger = testBed.createMockLogger();
    mockEntityManager = {
      ...testBed.createMockEntityManager(),
      getEntityInstance: testBed.createMock('getEntityInstance', []),
      getComponentData: testBed.createMock('getComponentData', []),
      addComponent: testBed.createMock('addComponent', []),
    };
    mockEventBus = testBed.mockValidatedEventDispatcher;
    mockGameDataRepository = {
      getComponentDefinition: jest.fn().mockReturnValue(null),
      get: jest.fn().mockReturnValue(null),
    };
  });

  afterEach(() => {
    testBed.cleanup();
  });

  describe('ModTestHandlerFactory Error Scenarios', () => {
    describe('Invalid Dependency Handling', () => {
      it('should handle null entityManager gracefully', () => {
        expect(() => {
          ModTestHandlerFactory.createStandardHandlers(
            null,
            mockEventBus,
            mockLogger
          );
        }).toThrow(
          'ModTestHandlerFactory.createStandardHandlers: entityManager is required'
        );
      });

      it('should handle null eventBus gracefully', () => {
        expect(() => {
          ModTestHandlerFactory.createStandardHandlers(
            mockEntityManager,
            null,
            mockLogger
          );
        }).toThrow(
          'ModTestHandlerFactory.createStandardHandlers: eventBus is required'
        );
      });

      it('should handle null logger gracefully', () => {
        expect(() => {
          ModTestHandlerFactory.createStandardHandlers(
            mockEntityManager,
            mockEventBus,
            null
          );
        }).toThrow(
          'ModTestHandlerFactory.createStandardHandlers: logger is required'
        );
      });

      it('should handle undefined dependencies gracefully', () => {
        expect(() => {
          ModTestHandlerFactory.createStandardHandlers(
            undefined,
            undefined,
            undefined
          );
        }).toThrow(
          'ModTestHandlerFactory.createStandardHandlers: entityManager is required'
        );
      });

      it('should handle invalid entityManager (missing required methods)', () => {
        const invalidEntityManager = {};

        expect(() => {
          ModTestHandlerFactory.createStandardHandlers(
            invalidEntityManager,
            mockEventBus,
            mockLogger
          );
        }).toThrow();
      });

      it('should handle invalid eventBus (missing required methods)', () => {
        const invalidEventBus = {};

        expect(() => {
          ModTestHandlerFactory.createStandardHandlers(
            mockEntityManager,
            invalidEventBus,
            mockLogger
          );
        }).toThrow();
      });

      it('should handle invalid logger (missing required methods)', () => {
        const invalidLogger = {};

        expect(() => {
          ModTestHandlerFactory.createStandardHandlers(
            mockEntityManager,
            mockEventBus,
            invalidLogger
          );
        }).toThrow();
      });
    });

    describe('Handler Creation Success Cases', () => {
      it('should create standard handlers with valid dependencies', () => {
        expect(() => {
          const handlers = ModTestHandlerFactory.createStandardHandlers(
            mockEntityManager,
            mockEventBus,
            mockLogger
          );
          expect(handlers).toBeDefined();
          expect(handlers.QUERY_COMPONENT).toBeDefined();
          expect(handlers.GET_NAME).toBeDefined();
          expect(handlers.GET_TIMESTAMP).toBeDefined();
        }).not.toThrow();
      });

      it('should create handlers with ADD_COMPONENT', () => {
        expect(() => {
          const handlers = ModTestHandlerFactory.createHandlersWithAddComponent(
            mockEntityManager,
            mockEventBus,
            mockLogger,
            mockGameDataRepository
          );
          expect(handlers).toBeDefined();
          expect(handlers.ADD_COMPONENT).toBeDefined();
        }).not.toThrow();
      });

      it('should create minimal handlers', () => {
        expect(() => {
          const handlers = ModTestHandlerFactory.createMinimalHandlers(
            mockEntityManager,
            mockEventBus,
            mockLogger
          );
          expect(handlers).toBeDefined();
          expect(handlers.GET_NAME).toBeDefined();
          expect(handlers.DISPATCH_PERCEPTIBLE_EVENT).toBeDefined();
        }).not.toThrow();
      });

      it('should create custom handlers with options', () => {
        expect(() => {
          const handlers = ModTestHandlerFactory.createCustomHandlers(
            mockEntityManager,
            mockEventBus,
            mockLogger,
            mockGameDataRepository,
            { includeAddComponent: true, includeSetVariable: false }
          );
          expect(handlers).toBeDefined();
          expect(handlers.ADD_COMPONENT).toBeDefined();
          expect(handlers.SET_VARIABLE).toBeUndefined();
        }).not.toThrow();
      });

      it('should handle safe dispatcher creation', () => {
        expect(() => {
          const dispatcher =
            ModTestHandlerFactory.createSafeDispatcher(mockEventBus);
          expect(dispatcher).toBeDefined();
          expect(typeof dispatcher.dispatch).toBe('function');
        }).not.toThrow();
      });

      it('should handle safe dispatcher creation with null eventBus', () => {
        expect(() => {
          ModTestHandlerFactory.createSafeDispatcher(null);
        }).toThrow(
          'ModTestHandlerFactory.createSafeDispatcher: eventBus is required'
        );
      });
    });

    describe('Category-Based Handler Factory', () => {
      it('should return appropriate factory for positioning category', () => {
        const factory =
          ModTestHandlerFactory.getHandlerFactoryForCategory('positioning');
        expect(factory).toBeDefined();
        expect(typeof factory).toBe('function');
      });

      it('should return standard factory for unknown category', () => {
        const factory =
          ModTestHandlerFactory.getHandlerFactoryForCategory('unknown');
        expect(factory).toBeDefined();
        expect(typeof factory).toBe('function');
      });

      it('should handle null category gracefully', () => {
        const factory =
          ModTestHandlerFactory.getHandlerFactoryForCategory(null);
        expect(factory).toBeDefined();
        expect(typeof factory).toBe('function');
      });
    });

    describe('Concurrent Access Error Handling', () => {
      it('should handle concurrent handler creation safely', async () => {
        const promises = Array(10)
          .fill()
          .map(() =>
            Promise.resolve(
              ModTestHandlerFactory.createStandardHandlers(
                mockEntityManager,
                mockEventBus,
                mockLogger
              )
            )
          );

        const handlers = await Promise.all(promises);

        handlers.forEach((handler) => {
          expect(handler).toBeDefined();
          expect(handler.GET_NAME).toBeDefined();
        });
      });
    });
  });

  describe('ModEntityBuilder Error Scenarios', () => {
    describe('Entity Creation Errors', () => {
      it('should handle missing entity ID in constructor', () => {
        expect(() => {
          new ModEntityBuilder();
        }).toThrow("Parameter 'Entity ID' must be a non-blank string");
      });

      it('should handle null entity ID in constructor', () => {
        expect(() => {
          new ModEntityBuilder(null);
        }).toThrow("Parameter 'Entity ID' must be a non-blank string");
      });

      it('should handle undefined entity ID in constructor', () => {
        expect(() => {
          new ModEntityBuilder(undefined);
        }).toThrow("Parameter 'Entity ID' must be a non-blank string");
      });

      it('should handle empty string entity ID', () => {
        expect(() => {
          new ModEntityBuilder('');
        }).toThrow("Parameter 'Entity ID' must be a non-blank string");
      });

      it('should handle whitespace-only entity ID', () => {
        expect(() => {
          new ModEntityBuilder('   ');
        }).toThrow("Parameter 'Entity ID' must be a non-blank string");
      });

      it('should handle non-string entity ID', () => {
        expect(() => {
          new ModEntityBuilder(123);
        }).toThrow("Parameter 'Entity ID' must be a non-blank string");
      });
    });

    describe('Fluent API Error Handling', () => {
      let builder;

      beforeEach(() => {
        builder = new ModEntityBuilder('testEntity');
      });

      it('should handle invalid name in withName', () => {
        expect(() => {
          builder.withName('');
        }).toThrow("Parameter 'Entity name' must be a non-blank string");

        expect(() => {
          builder.withName(null);
        }).toThrow("Parameter 'Entity name' must be a non-blank string");
      });

      it('should handle invalid description in withDescription', () => {
        expect(() => {
          builder.withDescription('');
        }).toThrow("Parameter 'Entity description' must be a non-blank string");
      });

      it('should handle invalid location ID in atLocation', () => {
        expect(() => {
          builder.atLocation('');
        }).toThrow("Parameter 'Location ID' must be a non-blank string");

        expect(() => {
          builder.atLocation(null);
        }).toThrow("Parameter 'Location ID' must be a non-blank string");
      });

      it('should handle invalid other entity in inSameLocationAs', () => {
        expect(() => {
          builder.inSameLocationAs(null);
        }).toThrow('Other entity is required');

        expect(() => {
          builder.inSameLocationAs({});
        }).toThrow(
          'ModEntityBuilder.inSameLocationAs: otherEntity must have a position component'
        );
      });

      it('should handle invalid component ID in withComponent', () => {
        expect(() => {
          builder.withComponent('', {});
        }).toThrow(
          'Parameter \'Component ID\' must be a non-blank string in ModEntityBuilder.withComponent. Received: ""'
        );

        expect(() => {
          builder.withComponent('validId', null);
        }).toThrow('Component data is required');
      });
    });

    describe('Entity Validation Errors', () => {
      it('should handle validation with invalid component structure', () => {
        const builder = new ModEntityBuilder('testEntity');
        builder.entityData.components = null;

        expect(() => {
          builder.validate();
        }).toThrow('Components must be an object');
      });

      it('should handle validation with invalid position component', () => {
        const builder = new ModEntityBuilder('testEntity');
        builder.entityData.components['core:position'] = {};

        expect(() => {
          builder.validate();
        }).toThrow("Position component missing 'locationId'");
      });

      it('should handle validation with invalid name component', () => {
        const builder = new ModEntityBuilder('testEntity');
        builder.entityData.components['core:name'] = {};

        expect(() => {
          builder.validate();
        }).toThrow("Name component missing 'text'");
      });
    });

    describe('Complex Entity Construction', () => {
      it('should handle circular reference in entity components gracefully', () => {
        const builder = new ModEntityBuilder('testEntity');
        const circular = { id: 'test' };
        circular.self = circular;

        expect(() => {
          builder.withComponent('circular', circular);
          const entity = builder.build();
          expect(entity.id).toBe('testEntity');
        }).not.toThrow();
      });

      it('should handle extremely deep nested components', () => {
        const builder = new ModEntityBuilder('testEntity');

        // Create deeply nested structure
        let deepNested = {};
        let current = deepNested;
        for (let i = 0; i < 100; i++) {
          current.nested = { level: i };
          current = current.nested;
        }

        expect(() => {
          builder.withComponent('deepNested', deepNested);
          const entity = builder.build();
          expect(entity.id).toBe('testEntity');
        }).not.toThrow();
      });

      it('should handle extremely large component data', () => {
        const builder = new ModEntityBuilder('testEntity');

        const largeData = {};
        for (let i = 0; i < 1000; i++) {
          largeData[`prop${i}`] = `value${i}`;
        }

        expect(() => {
          builder.withComponent('largeComponent', largeData);
          const entity = builder.build();
          expect(entity.id).toBe('testEntity');
        }).not.toThrow();
      });

      it('should handle rapid entity creation and cleanup', () => {
        expect(() => {
          for (let i = 0; i < 100; i++) {
            const builder = new ModEntityBuilder(`entity${i}`);
            const entity = builder.build();
            // Simulate cleanup
            if (entity.cleanup) entity.cleanup();
          }
        }).not.toThrow();
      });
    });

    describe('Special Characters and Unicode', () => {
      it('should handle special characters in entity ID', () => {
        const specialChars = '!@#$%^&*()[]{}|;:,.<>?~`';

        expect(() => {
          const builder = new ModEntityBuilder(specialChars);
          const entity = builder.build();
          expect(entity.id).toBe(specialChars);
        }).not.toThrow();
      });

      it('should handle unicode characters in entity ID', () => {
        const unicode = '测试实体🎮🎯🚀';

        expect(() => {
          const builder = new ModEntityBuilder(unicode);
          const entity = builder.build();
          expect(entity.id).toBe(unicode);
        }).not.toThrow();
      });

      it('should handle maximum length constraints', () => {
        const veryLongId = 'a'.repeat(10000);

        expect(() => {
          const builder = new ModEntityBuilder(veryLongId);
          const entity = builder.build();
          expect(entity.id).toBe(veryLongId);
        }).not.toThrow();
      });
    });
  });

  describe('ModAssertionHelpers Error Scenarios', () => {
    describe('Assertion Parameter Validation', () => {
      it('should handle null events array in assertActionSuccess', () => {
        expect(() => {
          ModAssertionHelpers.assertActionSuccess(null, 'test message');
        }).toThrow('events must be an array');
      });

      it('should handle empty events array in assertActionSuccess', () => {
        expect(() => {
          ModAssertionHelpers.assertActionSuccess([], 'test message');
        }).toThrow('events array cannot be empty');
      });

      it('should handle non-array events in assertPerceptibleEvent', () => {
        expect(() => {
          ModAssertionHelpers.assertPerceptibleEvent('not-an-array', {});
        }).toThrow('events must be an array');
      });

      it('should handle invalid expectedEvent in assertPerceptibleEvent', () => {
        expect(() => {
          ModAssertionHelpers.assertPerceptibleEvent([], null);
        }).toThrow('expectedEvent must be an object');
      });

      it('should handle invalid entityManager in assertComponentAdded', () => {
        expect(() => {
          ModAssertionHelpers.assertComponentAdded(
            null,
            'testEntity',
            'testComponent'
          );
        }).toThrow(
          'entityManager must be provided with getEntityInstance method'
        );

        expect(() => {
          ModAssertionHelpers.assertComponentAdded(
            {},
            'testEntity',
            'testComponent'
          );
        }).toThrow(
          'entityManager must be provided with getEntityInstance method'
        );
      });

      it('should handle invalid entityId in assertComponentAdded', () => {
        expect(() => {
          ModAssertionHelpers.assertComponentAdded(
            mockEntityManager,
            '',
            'testComponent'
          );
        }).toThrow('entityId must be a non-empty string');

        expect(() => {
          ModAssertionHelpers.assertComponentAdded(
            mockEntityManager,
            null,
            'testComponent'
          );
        }).toThrow('entityId must be a non-empty string');
      });

      it('should handle invalid componentId in assertComponentAdded', () => {
        expect(() => {
          ModAssertionHelpers.assertComponentAdded(
            mockEntityManager,
            'testEntity',
            ''
          );
        }).toThrow('componentId must be a non-empty string');
      });
    });

    describe('Event Finding and Processing', () => {
      it('should handle invalid events array in findEventByType', () => {
        expect(() => {
          ModAssertionHelpers.findEventByType('not-an-array', 'test-event');
        }).toThrow('events must be an array');
      });

      it('should handle invalid eventType in findEventByType', () => {
        expect(() => {
          ModAssertionHelpers.findEventByType([], '');
        }).toThrow('eventType must be a non-empty string');

        expect(() => {
          ModAssertionHelpers.findEventByType([], null);
        }).toThrow('eventType must be a non-empty string');
      });

      it('should handle missing events gracefully', () => {
        const result = ModAssertionHelpers.findEventByType(
          [],
          'nonexistent-event'
        );
        expect(result).toBeUndefined();
      });

      it('should find events correctly when they exist', () => {
        const events = [
          { eventType: 'event1', payload: {} },
          { eventType: 'event2', payload: {} },
        ];

        const result = ModAssertionHelpers.findEventByType(events, 'event1');
        expect(result).toBeDefined();
        expect(result.eventType).toBe('event1');
      });
    });

    describe('Complex Assertion Scenarios', () => {
      it('should handle assertions with circular references', () => {
        const events = [
          {
            eventType: 'test-event',
            payload: {},
          },
        ];
        events[0].payload.self = events[0].payload;

        expect(() => {
          ModAssertionHelpers.findEventByType(events, 'test-event');
        }).not.toThrow();
      });

      it('should handle deeply nested assertion data', () => {
        const deepPayload = {};
        let current = deepPayload;
        for (let i = 0; i < 50; i++) {
          current.nested = { level: i };
          current = current.nested;
        }

        const events = [
          {
            eventType: 'deep-event',
            payload: deepPayload,
          },
        ];

        expect(() => {
          ModAssertionHelpers.findEventByType(events, 'deep-event');
        }).not.toThrow();
      });
    });

    describe('Event Count and Sequence Validation', () => {
      it('should handle event count validation', () => {
        const events = [
          { eventType: 'event1', payload: {} },
          { eventType: 'event1', payload: {} },
          { eventType: 'event2', payload: {} },
        ];

        expect(() => {
          ModAssertionHelpers.assertEventCounts(events, {
            event1: 2,
            event2: 1,
          });
        }).not.toThrow();
      });

      it('should handle event sequence validation', () => {
        const events = [
          { eventType: 'first', payload: {} },
          { eventType: 'second', payload: {} },
          { eventType: 'third', payload: {} },
        ];

        expect(() => {
          ModAssertionHelpers.assertEventSequence(events, [
            'first',
            'second',
            'third',
          ]);
        }).not.toThrow();
      });

      it('should handle missing events in sequence', () => {
        const events = [
          { eventType: 'first', payload: {} },
          { eventType: 'third', payload: {} },
        ];

        expect(() => {
          ModAssertionHelpers.assertEventSequence(events, [
            'first',
            'second',
            'third',
          ]);
        }).toThrow();
      });
    });
  });

  describe('ModTestFixture Error Scenarios', () => {
    describe('Auto-Loading Error Handling', () => {
      it('should handle auto-loading with invalid modId', async () => {
        try {
          await ModTestFixture.forActionAutoLoad(
            'nonexistent_mod',
            'test_action'
          );
          fail('Should have thrown an error');
        } catch (error) {
          expect(error.message).toContain('Could not load rule file');
        }
      });

      it('should handle auto-loading with invalid actionId', async () => {
        try {
          await ModTestFixture.forActionAutoLoad(
            'intimacy',
            'nonexistent_action'
          );
          fail('Should have thrown an error');
        } catch (error) {
          expect(error.message).toContain('Could not load rule file');
        }
      });

      it('should handle partial file auto-loading gracefully', async () => {
        const result = await ModTestFixture.tryAutoLoadFiles(
          'nonexistent',
          'test'
        );
        expect(result.ruleFile).toBeNull();
        expect(result.conditionFile).toBeNull();
      });

      it('should return conventional paths correctly', () => {
        const paths = ModTestFixture.getConventionalPaths(
          'intimacy',
          'kiss_cheek'
        );
        expect(paths.rulePaths).toBeDefined();
        expect(paths.conditionPaths).toBeDefined();
        expect(paths.rulePaths.length).toBeGreaterThan(0);
        expect(paths.conditionPaths.length).toBeGreaterThan(0);
      });
    });

    describe('Category-Based Fixture Creation', () => {
      it('should create category fixtures without throwing', () => {
        expect(() => {
          const fixture = ModTestFixture.forCategory('positioning');
          expect(fixture).toBeDefined();
        }).not.toThrow();
      });

      it('should handle unknown categories gracefully', () => {
        expect(() => {
          const fixture = ModTestFixture.forCategory('unknown');
          expect(fixture).toBeDefined();
        }).not.toThrow();
      });

      it('should handle null category gracefully', () => {
        expect(() => {
          const fixture = ModTestFixture.forCategory(null);
          expect(fixture).toBeDefined();
        }).not.toThrow();
      });
    });

    describe('File Path Convention Testing', () => {
      it('should extract action names correctly', () => {
        const paths1 = ModTestFixture.getConventionalPaths(
          'intimacy',
          'kiss_cheek'
        );
        expect(
          paths1.rulePaths.some((path) => path.includes('kiss_cheek.rule.json'))
        ).toBe(true);

        const paths2 = ModTestFixture.getConventionalPaths(
          'intimacy',
          'kissing:kiss_cheek'
        );
        expect(
          paths2.rulePaths.some((path) => path.includes('kiss_cheek.rule.json'))
        ).toBe(true);
      });

      it('should handle underscore to hyphen conversion for conditions', () => {
        const paths = ModTestFixture.getConventionalPaths(
          'intimacy',
          'kiss_cheek'
        );
        expect(
          paths.conditionPaths.some((path) =>
            path.includes('kiss-cheek.condition.json')
          )
        ).toBe(true);
      });

      it('should handle colon and underscore normalization', () => {
        const paths = ModTestFixture.getConventionalPaths(
          'kissing',
          'kissing:kiss_cheek'
        );
        expect(
          paths.conditionPaths.some((path) =>
            path.includes('kissing-kiss-cheek.condition.json')
          )
        ).toBe(true);
      });
    });
  });

  describe('Integration Error Recovery', () => {
    describe('Component Interaction Stability', () => {
      it('should maintain stability after entity builder errors', () => {
        // Cause some errors
        try {
          new ModEntityBuilder();
        } catch (error) {
          // Expected
        }

        try {
          new ModEntityBuilder(null);
        } catch (error) {
          // Expected
        }

        // Should still work normally afterward
        expect(() => {
          const validBuilder = new ModEntityBuilder('valid');
          const entity = validBuilder.build();
          expect(entity.id).toBe('valid');
        }).not.toThrow();
      });

      it('should maintain stability after handler factory errors', () => {
        // Cause some errors
        try {
          ModTestHandlerFactory.createStandardHandlers(null, null, null);
        } catch (error) {
          // Expected
        }

        // Should still work normally afterward
        expect(() => {
          const handlers = ModTestHandlerFactory.createStandardHandlers(
            mockEntityManager,
            mockEventBus,
            mockLogger
          );
          expect(handlers).toBeDefined();
        }).not.toThrow();
      });

      it('should maintain stability after assertion helper errors', () => {
        // Cause some errors
        try {
          ModAssertionHelpers.assertActionSuccess(null, 'test');
        } catch (error) {
          // Expected
        }

        // Should still work normally afterward
        expect(() => {
          const result = ModAssertionHelpers.findEventByType([], 'nonexistent');
          expect(result).toBeUndefined();
        }).not.toThrow();
      });
    });

    describe('Memory and Resource Management', () => {
      it('should handle memory cleanup on component failures', () => {
        const builders = [];

        try {
          for (let i = 0; i < 100; i++) {
            const builder = new ModEntityBuilder(`entity${i}`);
            builders.push(builder);

            if (i === 50) {
              // Simulate failure
              throw new Error('Simulated failure');
            }
          }
        } catch (error) {
          // Cleanup created builders
          builders.forEach((builder) => {
            if (builder.cleanup) {
              builder.cleanup();
            }
          });

          expect(builders.length).toBe(51); // 0-50 inclusive
        }
      });

      it('should handle rapid fire operations', () => {
        expect(() => {
          for (let i = 0; i < 1000; i++) {
            const builder = new ModEntityBuilder(`rapid${i}`);
            const entity = builder.build();
            // Simulate assertion
            expect(entity.id).toBe(`rapid${i}`);
          }
        }).not.toThrow();
      });

      it('should handle concurrent component operations', async () => {
        const promises = Array(50)
          .fill()
          .map(async (_, index) => {
            const builder = new ModEntityBuilder(`concurrent${index}`);
            const entity = builder.build();
            return entity;
          });

        const results = await Promise.allSettled(promises);
        const successful = results.filter(
          (r) => r.status === 'fulfilled'
        ).length;

        expect(successful).toBe(50); // All should succeed
      });
    });
  });

  describe('Error Reporting and Logging', () => {
    describe('Error Message Quality', () => {
      it('should provide detailed error messages', () => {
        try {
          new ModEntityBuilder(null);
          fail('Should have thrown');
        } catch (error) {
          expect(error.message).toContain('Entity ID');
          expect(error.message).toContain('non-blank string');
          expect(error.message.length).toBeGreaterThan(20);
        }
      });

      it('should include context in error messages', () => {
        try {
          ModTestHandlerFactory.createStandardHandlers(null, null, null);
          fail('Should have thrown');
        } catch (error) {
          expect(error.message).toContain('ModTestHandlerFactory');
          expect(error.message).toContain('createStandardHandlers');
          expect(error.message).toContain('entityManager is required');
        }
      });

      it('should provide actionable error messages', () => {
        try {
          ModAssertionHelpers.assertComponentAdded(null, 'test', 'component');
          fail('Should have thrown');
        } catch (error) {
          expect(error.message).toContain('entityManager must be provided');
          expect(error.message).toContain('getEntityInstance method');
        }
      });
    });

    describe('Stack Trace and Debugging Support', () => {
      it('should include stack traces for debugging', () => {
        try {
          throw new Error('Test error');
        } catch (error) {
          expect(error.stack).toBeDefined();
          expect(error.stack).toContain('errorHandling.test.js');
        }
      });

      it('should preserve error context through nested calls', () => {
        /**
         *
         */
        function innerFunction() {
          throw new Error('Inner error');
        }

        /**
         *
         */
        function outerFunction() {
          try {
            innerFunction();
          } catch (error) {
            throw new Error(`Outer error: ${error.message}`);
          }
        }

        try {
          outerFunction();
        } catch (error) {
          expect(error.message).toContain('Outer error');
          expect(error.message).toContain('Inner error');
          expect(error.stack).toBeDefined();
        }
      });
    });
  });
});
