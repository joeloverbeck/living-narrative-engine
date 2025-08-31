/**
 * @file Integration tests for LogMetadataEnricher source category detection
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import LogMetadataEnricher from '../../../src/logging/logMetadataEnricher.js';

describe('LogMetadataEnricher Source Category Integration', () => {
  let enricher;
  let mockErrorConstructor;

  beforeEach(() => {
    // Create a proper mock Error constructor that the enricher will actually use
    mockErrorConstructor = jest.fn();
    
    enricher = new LogMetadataEnricher({
      level: 'standard',
      enableSource: true,
      enablePerformance: true,
      enableBrowser: false,
      ErrorConstructor: mockErrorConstructor, // Pass our mock to the constructor
    });
  });

  describe('End-to-End Source Category Detection', () => {
    it('should correctly categorize logs from different source directories', async () => {
      const testCases = [
        {
          stackTrace: `Error
    at LogMetadataEnricher.enrichLogEntry (/src/logging/logMetadataEnricher.js:150:5)
    at RemoteLogger.log (/src/logging/remoteLogger.js:120:10)
    at ConsoleLogger.info (/src/logging/consoleLogger.js:45:8)
    at TestClass.method (/home/user/project/src/actions/userActions.js:10:15)
    at Module._compile (module.js:456:26)`,
          expectedSource: 'userActions.js:10',
          expectedCategory: 'actions',
        },
        {
          stackTrace: `Error
    at LogMetadataEnricher.enrichLogEntry (/src/logging/logMetadataEnricher.js:150:5)
    at RemoteLogger.log (/src/logging/remoteLogger.js:120:10)
    at ConsoleLogger.info (/src/logging/consoleLogger.js:45:8)
    at OperationHandler.execute (/home/user/project/src/logic/operationHandlers/modifyContextArrayHandler.js:50:10)`,
          expectedSource: 'modifyContextArrayHandler.js:50',
          expectedCategory: 'logic',
        },
        {
          stackTrace: `Error
    at LogMetadataEnricher.enrichLogEntry (/src/logging/logMetadataEnricher.js:150:5)
    at RemoteLogger.log (/src/logging/remoteLogger.js:120:10)
    at ConsoleLogger.info (/src/logging/consoleLogger.js:45:8)
    at EntityManager.query (/home/user/project/src/entities/managers/EntityQueryManager.js:125:8)`,
          expectedSource: 'EntityQueryManager.js:125',
          expectedCategory: 'entities',
        },
        {
          stackTrace: `Error
    at LogMetadataEnricher.enrichLogEntry (/src/logging/logMetadataEnricher.js:150:5)
    at RemoteLogger.log (/src/logging/remoteLogger.js:120:10)
    at ConsoleLogger.info (/src/logging/consoleLogger.js:45:8)
    at PortraitRenderer.render (/home/user/project/src/domUI/renderers/portraitModalRenderer.js:200:15)`,
          expectedSource: 'portraitModalRenderer.js:200',
          expectedCategory: 'domUI',
        },
        {
          stackTrace: `Error
    at LogMetadataEnricher.enrichLogEntry (/src/logging/logMetadataEnricher.js:150:5)
    at RemoteLogger.log (/src/logging/remoteLogger.js:120:10)
    at ConsoleLogger.info (/src/logging/consoleLogger.js:45:8)
    at FilterResolver.resolve (/home/user/project/src/scopeDsl/nodes/filterResolver.js:75:20)`,
          expectedSource: 'filterResolver.js:75',
          expectedCategory: 'scopeDsl',
        },
      ];

      for (const testCase of testCases) {
        // Use the proper mock Error constructor that enricher will actually call
        mockErrorConstructor.mockImplementation(() => ({
          stack: testCase.stackTrace,
        }));

        const logEntry = {
          level: 'info',
          message: `Test from ${testCase.expectedCategory}`,
          timestamp: Date.now(),
        };

        const enriched = await enricher.enrichLogEntry(logEntry);

        expect(enriched.source).toBe(testCase.expectedSource);
        expect(enriched.sourceCategory).toBe(testCase.expectedCategory);
        expect(enriched.metadata).toBeDefined();
      }
    });

    it('should handle cross-browser stack trace formats', () => {
      const browserFormats = [
        {
          name: 'Chrome/V8',
          stack: `Error
    at LogMetadataEnricher.enrichLogEntry (/src/logging/logMetadataEnricher.js:150:5)
    at RemoteLogger.log (/src/logging/remoteLogger.js:120:10)
    at ConsoleLogger.info (/src/logging/consoleLogger.js:45:8)
    at MemoryManager.process (/project/src/ai/memoryManager.js:45:20)
    at Module._compile (module.js:456:26)`,
          expectedCategory: 'ai',
        },
        {
          name: 'Firefox',
          stack: `LogMetadataEnricher.prototype.enrichLogEntry@/src/logging/logMetadataEnricher.js:150:5
RemoteLogger.prototype.log@/src/logging/remoteLogger.js:120:10
ConsoleLogger.prototype.info@/src/logging/consoleLogger.js:45:8
someFunction@internals.js:25:10
processMemory@/project/src/ai/memoryManager.js:45:20
Module._compile@module.js:456:26`,
          expectedCategory: 'ai',
        },
        {
          name: 'Safari/WebKit',
          stack: `LogMetadataEnricher.prototype.enrichLogEntry@/src/logging/logMetadataEnricher.js:150:5
RemoteLogger.prototype.log@/src/logging/remoteLogger.js:120:10
ConsoleLogger.prototype.info@/src/logging/consoleLogger.js:45:8
someFunction@internals.js:25:10
processMemory@/project/src/ai/memoryManager.js:45:20
global code@module.js:456:26`,
          expectedCategory: 'ai',
        },
      ];

      browserFormats.forEach(({ name, stack, expectedCategory }) => {
        // Use the proper mock Error constructor
        mockErrorConstructor.mockImplementation(() => ({ stack }));

        const logEntry = {
          level: 'info',
          message: `Test from ${name}`,
          timestamp: Date.now(),
        };

        const enriched = enricher.enrichLogEntrySync(logEntry);
        
        expect(enriched.sourceCategory).toBe(expectedCategory);
      });
    });

    it('should correctly categorize all 50 source directories in real scenarios', () => {
      const realWorldPaths = [
        { path: '/Users/dev/projects/game/src/actions/combat/attack.js', category: 'actions' },
        { path: 'C:\\Projects\\game\\src\\logic\\rules\\validation.js', category: 'logic' },
        { path: '/var/www/app/src/entities/player.js', category: 'entities' },
        { path: '../../../src/ai/npc/behavior.js', category: 'ai' },
        { path: './src/domUI/components/modal.js', category: 'domUI' },
        { path: '/src/engine/core/gameLoop.js', category: 'engine' },
        { path: 'file:///home/user/src/events/eventBus.js', category: 'events' },
        { path: '/home/runner/work/src/loaders/modLoader.js', category: 'loaders' },
        { path: '/opt/app/src/scopeDsl/parser.js', category: 'scopeDsl' },
        { path: '/src/initializers/startup.js', category: 'initializers' },
        { path: '/src/dependencyInjection/container.js', category: 'dependencyInjection' },
        { path: '/src/logging/logger.js', category: 'logging' },
        { path: '/src/config/settings.js', category: 'config' },
        { path: '/src/utils/helpers.js', category: 'utils' },
        { path: '/src/services/apiService.js', category: 'services' },
        { path: '/src/constants/gameConstants.js', category: 'constants' },
        { path: '/src/storage/localStorage.js', category: 'storage' },
        { path: '/src/types/definitions.js', category: 'types' },
        { path: '/src/alerting/notifier.js', category: 'alerting' },
        { path: '/src/context/gameContext.js', category: 'context' },
        { path: '/src/turns/turnManager.js', category: 'turns' },
        { path: '/src/adapters/apiAdapter.js', category: 'adapters' },
        { path: '/src/query/queryBuilder.js', category: 'query' },
        { path: '/src/characterBuilder/generator.js', category: 'characterBuilder' },
        { path: '/src/prompting/promptBuilder.js', category: 'prompting' },
        { path: '/src/anatomy/bodyParts.js', category: 'anatomy' },
        { path: '/src/scheduling/scheduler.js', category: 'scheduling' },
        { path: '/src/errors/customError.js', category: 'errors' },
        { path: '/src/interfaces/IEntity.js', category: 'interfaces' },
        { path: '/src/clothing/outfit.js', category: 'clothing' },
        { path: '/src/input/inputHandler.js', category: 'input' },
        { path: '/src/testing/testUtils.js', category: 'testing' },
        { path: '/src/configuration/configManager.js', category: 'configuration' },
        { path: '/src/modding/modManager.js', category: 'modding' },
        { path: '/src/persistence/saveGame.js', category: 'persistence' },
        { path: '/src/data/gameData.js', category: 'data' },
        { path: '/src/shared/utilities.js', category: 'shared' },
        { path: '/src/bootstrapper/bootstrap.js', category: 'bootstrapper' },
        { path: '/src/commands/commandHandler.js', category: 'commands' },
        { path: '/src/thematicDirection/theme.js', category: 'thematicDirection' },
        { path: '/src/models/userModel.js', category: 'models' },
        { path: '/src/llms/llmAdapter.js', category: 'llms' },
        { path: '/src/validation/validator.js', category: 'validation' },
        { path: '/src/pathing/pathfinder.js', category: 'pathing' },
        { path: '/src/formatting/formatter.js', category: 'formatting' },
        { path: '/src/ports/portAdapter.js', category: 'ports' },
        { path: '/src/shutdown/cleanup.js', category: 'shutdown' },
        { path: '/src/common/base.js', category: 'common' },
        { path: '/src/clichesGenerator/generator.js', category: 'clichesGenerator' },
        { path: '/src/coreMotivationsGenerator/motivations.js', category: 'coreMotivationsGenerator' },
        { path: '/src/thematicDirectionsManager/manager.js', category: 'thematicDirectionsManager' },
        { path: '/tests/unit/test.js', category: 'tests' },
        { path: '/llm-proxy-server/server.js', category: 'llm-proxy' },
      ];

      realWorldPaths.forEach(({ path, category }) => {
        const stack = `Error
    at LogMetadataEnricher.enrichLogEntry (/src/logging/logMetadataEnricher.js:150:5)
    at RemoteLogger.log (/src/logging/remoteLogger.js:120:10)
    at ConsoleLogger.info (/src/logging/consoleLogger.js:45:8)
    at TestClass.method (${path}:10:15)`;
        mockErrorConstructor.mockImplementation(() => ({ stack }));

        const logEntry = {
          level: 'info',
          message: `Test from ${category}`,
          timestamp: Date.now(),
        };

        // Use enrichLogEntrySync to test the full integration path
        const enriched = enricher.enrichLogEntrySync(logEntry);
        expect(enriched.sourceCategory).toBe(category);
      });
    });

    it('should maintain backward compatibility with existing source field', () => {
      const stack = `Error
    at LogMetadataEnricher.enrichLogEntry (/src/logging/logMetadataEnricher.js:150:5)
    at RemoteLogger.log (/src/logging/remoteLogger.js:120:10)
    at ConsoleLogger.info (/src/logging/consoleLogger.js:45:8)
    at TestClass.method (/home/user/project/src/actions/userActions.js:10:15)
    at Module._compile (module.js:456:26)`;

      mockErrorConstructor.mockImplementation(() => ({ stack }));

      const logEntry = {
        level: 'info',
        message: 'Test message',
        timestamp: Date.now(),
      };

      const enriched = enricher.enrichLogEntrySync(logEntry);

      // Verify backward compatibility
      expect(enriched.source).toBe('userActions.js:10'); // Original format preserved
      expect(enriched.source).toMatch(/^[^/\\]+:\d+$/); // filename:line format
      
      // Verify new functionality
      expect(enriched.sourceCategory).toBe('actions');
    });

    it('should handle deeply nested paths correctly', () => {
      const nestedPaths = [
        {
          path: '/project/src/logic/operationHandlers/deeply/nested/handler.js',
          category: 'logic',
        },
        {
          path: '/project/src/domUI/components/complex/nested/modal/dialog.js',
          category: 'domUI',
        },
        {
          path: '/project/src/entities/managers/specialized/EntityQueryManager.js',
          category: 'entities',
        },
      ];

      nestedPaths.forEach(({ path, category }) => {
        const stack = `Error
    at LogMetadataEnricher.enrichLogEntry (/src/logging/logMetadataEnricher.js:150:5)
    at RemoteLogger.log (/src/logging/remoteLogger.js:120:10)
    at ConsoleLogger.info (/src/logging/consoleLogger.js:45:8)
    at DeepHandler.execute (${path}:100:25)`;
        mockErrorConstructor.mockImplementation(() => ({ stack }));

        const logEntry = {
          level: 'info',
          message: `Test nested ${category}`,
          timestamp: Date.now(),
        };

        // Use enrichLogEntrySync to test the full integration path
        const enriched = enricher.enrichLogEntrySync(logEntry);
        expect(enriched.sourceCategory).toBe(category);
      });
    });

    it('should handle edge cases gracefully', () => {
      const edgeCases = [
        {
          name: 'empty stack',
          stack: '',
          expectedCategory: 'general',
        },
        {
          name: 'malformed stack',
          stack: 'Not a real stack trace',
          expectedCategory: 'general',
        },
        {
          name: 'only internal frames',
          stack: `Error
    at remoteLogger.js:10:15
    at logMetadataEnricher.js:20:10
    at logCategoryDetector.js:30:5`,
          expectedCategory: 'general',
        },
        {
          name: 'root level file',
          stack: `Error\n    at /index.js:10:15`,
          expectedCategory: 'general',
        },
      ];

      edgeCases.forEach(({ name, stack, expectedCategory }) => {
        mockErrorConstructor.mockImplementation(() => ({ stack }));

        const logEntry = {
          level: 'info',
          message: `Edge case: ${name}`,
          timestamp: Date.now(),
        };

        // Use enrichLogEntrySync to test the full integration path
        const enriched = enricher.enrichLogEntrySync(logEntry);
        expect(enriched.sourceCategory).toBe(expectedCategory);
      });
    });
  });

  describe('Performance Characteristics', () => {
    it('should detect source category within 2ms', () => {
      const stack = `Error
    at LogMetadataEnricher.enrichLogEntry (/src/logging/logMetadataEnricher.js:150:5)
    at RemoteLogger.log (/src/logging/remoteLogger.js:120:10)
    at ConsoleLogger.info (/src/logging/consoleLogger.js:45:8)
    at TestClass.method (/home/user/project/src/actions/userActions.js:10:15)
    at Module._compile (module.js:456:26)`;

      mockErrorConstructor.mockImplementation(() => ({ stack }));

      const iterations = 1000;
      const start = performance.now();

      const logEntry = {
        level: 'info',
        message: 'Performance test',
        timestamp: Date.now(),
      };

      for (let i = 0; i < iterations; i++) {
        enricher.enrichLogEntrySync(logEntry);
      }

      const end = performance.now();
      const avgTime = (end - start) / iterations;

      expect(avgTime).toBeLessThan(2); // Should be under 2ms per call
    });

    it('should efficiently handle large stack traces', () => {
      // Create a large stack trace with 100 frames, starting with internal logging frames
      const frames = [
        '    at LogMetadataEnricher.enrichLogEntry (/src/logging/logMetadataEnricher.js:150:5)',
        '    at RemoteLogger.log (/src/logging/remoteLogger.js:120:10)',
        '    at ConsoleLogger.info (/src/logging/consoleLogger.js:45:8)',
        '    at TestClass.method (/home/user/project/src/actions/userActions.js:100:15)', // This will be the first non-internal frame processed at index 4
      ];
      for (let i = 0; i < 100; i++) {
        frames.push(`    at function${i} (file${i}.js:${i}:10)`);
      }
      
      const largeStack = `Error\n${frames.join('\n')}`;

      mockErrorConstructor.mockImplementation(() => ({ stack: largeStack }));

      const logEntry = {
        level: 'info',
        message: 'Large stack test',
        timestamp: Date.now(),
      };

      const start = performance.now();
      const enriched = enricher.enrichLogEntrySync(logEntry);
      const end = performance.now();

      expect(enriched.sourceCategory).toBe('actions');
      expect(end - start).toBeLessThan(5); // Should handle large stacks quickly
    });
  });
});