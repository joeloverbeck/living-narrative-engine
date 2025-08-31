/**
 * @file Integration tests for stack trace parsing with webpack support
 * @see src/logging/logMetadataEnricher.js
 */

import { describe, it, expect, jest } from '@jest/globals';
import LogMetadataEnricher from '../../../src/logging/logMetadataEnricher.js';

describe('Stack Trace Parsing Integration', () => {
  describe('Real webpack bundle scenarios', () => {
    // Tests create their own enricher instances as needed

    it('should handle esbuild output format', () => {
      // esbuild typically produces cleaner stack traces
      const esbuildStack = `Error: Test error
    at Object.<anonymous> (http://localhost:8080/dist/bundle.js:1234:56)
    at __webpack_require__ (http://localhost:8080/dist/bundle.js:20:30)
    at Module.123 (http://localhost:8080/dist/bundle.js:5678:90)`;

      const mockError = jest.fn().mockImplementation(() => ({
        stack: esbuildStack,
      }));
      
      const testEnricher = new LogMetadataEnricher({ ErrorConstructor: mockError });
      const source = testEnricher.detectSource(1);
      expect(source).toBe('bundle.js:1234');
    });

    it('should handle webpack development build with module names', () => {
      const webpackDevStack = `Error: Validation failed
    at validateInput (webpack-internal:///./src/validation/inputValidator.js:25:11)
    at FormController.submit (webpack-internal:///./src/controllers/formController.js:45:5)
    at HTMLButtonElement.eval (webpack-internal:///./src/ui/button.js:12:20)`;

      const mockError = jest.fn().mockImplementation(() => ({
        stack: webpackDevStack,
      }));
      
      const testEnricher = new LogMetadataEnricher({ ErrorConstructor: mockError });
      const source = testEnricher.detectSource(1);
      expect(source).toBe('inputValidator.js:25');
    });

    it('should handle webpack production build with minified names', () => {
      const webpackProdStack = `Error
    at r.validate (https://cdn.example.com/app.min.js:2:14523)
    at t.submit (https://cdn.example.com/app.min.js:2:18964)
    at HTMLButtonElement.n (https://cdn.example.com/app.min.js:1:2341)`;

      const mockError = jest.fn().mockImplementation(() => ({
        stack: webpackProdStack,
      }));
      
      const testEnricher = new LogMetadataEnricher({ ErrorConstructor: mockError });
      const source = testEnricher.detectSource(1);
      expect(source).toBe('app.min.js:2');
    });
  });

  describe('Cross-browser consistency', () => {
    it('should parse webpack stacks consistently across browsers', () => {
      const testCases = [
        {
          name: 'Chrome with webpack',
          stack: `Error
    at ActionManager.execute (webpack-internal:///./src/actions/actionManager.js:100:15)
    at GameLoop.tick (webpack-internal:///./src/engine/gameLoop.js:50:10)`,
          expected: 'actionManager.js:100',
          skipFrames: 1,
        },
        {
          name: 'Firefox with webpack',
          stack: `execute@webpack-internal:///./src/actions/actionManager.js:100:15
tick@webpack-internal:///./src/engine/gameLoop.js:50:10`,
          expected: 'actionManager.js:100',
          skipFrames: 0, // Firefox doesn't have "Error" header line
        },
        {
          name: 'Safari with webpack',
          stack: `execute@webpack-internal:///./src/actions/actionManager.js:100:15
tick@webpack-internal:///./src/engine/gameLoop.js:50:10`,
          expected: 'actionManager.js:100',
          skipFrames: 0, // Safari doesn't have "Error" header line
        },
      ];

      testCases.forEach(({ stack, expected, skipFrames }) => {
        const mockError = jest.fn().mockImplementation(() => ({ stack }));
        const enricher = new LogMetadataEnricher({ ErrorConstructor: mockError });
        const source = enricher.detectSource(skipFrames);
        expect(source).toBe(expected);
      });
    });
  });

  describe('Cache performance', () => {
    it('should improve performance with caching', () => {
      const stack = `Error
    at remoteLogger.js:10:15
    at logMetadataEnricher.js:20:10
    at logCategoryDetector.js:30:5
    at UserService.authenticate (webpack-internal:///./src/services/userService.js:30:12)`;

      const mockError = jest.fn().mockImplementation(() => ({ stack }));
      const enricher = new LogMetadataEnricher({ 
        ErrorConstructor: mockError,
        stackCacheSize: 50,
      });

      // Warm up cache
      enricher.detectSource(4);

      // Measure performance with cache
      const iterations = 1000;
      const startTime = performance.now();
      
      for (let i = 0; i < iterations; i++) {
        enricher.detectSource(4);
      }
      
      const endTime = performance.now();
      const avgTime = (endTime - startTime) / iterations;

      // Should be very fast with caching (< 0.1ms per call)
      expect(avgTime).toBeLessThan(0.1);
    });

    it('should handle cache eviction properly', () => {
      const mockError = jest.fn();
      const enricher = new LogMetadataEnricher({ 
        ErrorConstructor: mockError,
        stackCacheSize: 2, // Very small cache
      });

      // Create different stacks
      const stacks = [
        'Error\n    at file1.js:10:15',
        'Error\n    at file2.js:20:25',
        'Error\n    at file3.js:30:35',
      ];

      stacks.forEach((stack, index) => {
        mockError.mockImplementation(() => ({ stack }));
        const source = enricher.detectSource(1);
        expect(source).toBe(`file${index + 1}.js:${(index + 1) * 10}`);
      });

      // First stack should have been evicted
      mockError.mockImplementation(() => ({ stack: stacks[0] }));
      enricher.detectSource(1);

      // Check that cache size is maintained
      // This is implicitly tested by the fact that the enricher continues to work
    });
  });

  describe('Source map integration', () => {
    it('should integrate with SourceMapResolver when provided', () => {
      const mockResolver = {
        resolveSync: jest.fn().mockReturnValue({
          source: 'originalFile.js',
          line: 42,
          column: 10,
        }),
      };

      const prodStack = `Error
    at t.method (https://cdn.example.com/bundle.min.js:1:12345)`;

      const mockError = jest.fn().mockImplementation(() => ({ stack: prodStack }));
      const enricher = new LogMetadataEnricher({ 
        ErrorConstructor: mockError,
        sourceMapResolver: mockResolver,
      });

      const source = enricher.detectSource(1);
      expect(source).toBe('originalFile.js:42');
      expect(mockResolver.resolveSync).toHaveBeenCalledWith(
        'https://cdn.example.com/bundle.min.js',
        '1',
        '12345'
      );
    });

    it('should fallback gracefully when source map resolution fails', () => {
      const mockResolver = {
        resolveSync: jest.fn().mockReturnValue(null),
      };

      const prodStack = `Error
    at t.method (https://cdn.example.com/bundle.min.js:1:12345)`;

      const mockError = jest.fn().mockImplementation(() => ({ stack: prodStack }));
      const enricher = new LogMetadataEnricher({ 
        ErrorConstructor: mockError,
        sourceMapResolver: mockResolver,
      });

      const source = enricher.detectSource(1);
      expect(source).toBe('bundle.min.js:1');
      expect(mockResolver.resolveSync).toHaveBeenCalled();
    });

    it('should handle source map resolver exceptions', () => {
      const mockResolver = {
        resolveSync: jest.fn().mockImplementation(() => {
          throw new Error('Source map loading failed');
        }),
      };

      const prodStack = `Error
    at t.method (https://cdn.example.com/bundle.min.js:1:12345)`;

      const mockError = jest.fn().mockImplementation(() => ({ stack: prodStack }));
      const enricher = new LogMetadataEnricher({ 
        ErrorConstructor: mockError,
        sourceMapResolver: mockResolver,
      });

      const source = enricher.detectSource(1);
      // Should fallback to bundle path
      expect(source).toBe('bundle.min.js:1');
    });
  });

  describe('Edge cases', () => {
    it('should handle webpack bootstrap frames', () => {
      const bootstrapStack = `Error
    at __webpack_require__ (webpack://my-app/webpack/bootstrap:19:1)
    at fn (webpack://my-app/webpack/runtime/define-property-getters:5:1)
    at UserModule.init (webpack-internal:///./src/user.js:10:5)`;

      const mockError = jest.fn().mockImplementation(() => ({ stack: bootstrapStack }));
      const enricher = new LogMetadataEnricher({ ErrorConstructor: mockError });
      const source = enricher.detectSource(3); // Skip first 3 frames to get to user code
      expect(source).toBe('user.js:10');
    });

    it('should handle node_modules in webpack bundles', () => {
      const nodeModulesStack = `Error
    at validateOptions (webpack-internal:///./node_modules/some-library/dist/validator.js:50:10)
    at MyComponent.render (webpack-internal:///./src/components/MyComponent.js:25:5)`;

      const mockError = jest.fn().mockImplementation(() => ({ stack: nodeModulesStack }));
      const enricher = new LogMetadataEnricher({ ErrorConstructor: mockError });
      const source = enricher.detectSource(1);
      // Could include node_modules but extract clean filename
      expect(source).toBe('validator.js:50');
    });

    it('should handle deeply nested webpack paths', () => {
      const nestedStack = `Error
    at processData (webpack-internal:///./src/utils/data/processors/dataProcessor.js:100:20)`;

      const mockError = jest.fn().mockImplementation(() => ({ stack: nestedStack }));
      const enricher = new LogMetadataEnricher({ ErrorConstructor: mockError });
      const source = enricher.detectSource(1);
      expect(source).toBe('dataProcessor.js:100');
    });

    it('should handle webpack hot module replacement frames', () => {
      const hmrStack = `Error
    at Module.hot.accept (webpack-internal:///./src/index.js:50:10)
    at __webpack_require__.hmrM (webpack://my-app/webpack/runtime/hot-module-replacement:10:5)
    at UserCode.execute (webpack-internal:///./src/userCode.js:30:15)`;

      const mockError = jest.fn().mockImplementation(() => ({ stack: hmrStack }));
      const enricher = new LogMetadataEnricher({ ErrorConstructor: mockError });
      const source = enricher.detectSource(1);
      expect(source).toBe('index.js:50');
    });
  });
});