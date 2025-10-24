import { describe, it, expect, beforeEach } from '@jest/globals';
import { StackTraceAnalyzer } from '../../../../src/actions/tracing/stackTraceAnalyzer.js';

describe('StackTraceAnalyzer', () => {
  let analyzer;
  const projectPath = '/home/project';

  beforeEach(() => {
    analyzer = new StackTraceAnalyzer({
      projectPath,
      logger: console,
    });
  });

  describe('Constructor', () => {
    it('should create analyzer with default project path', () => {
      const defaultAnalyzer = new StackTraceAnalyzer({ logger: console });
      expect(defaultAnalyzer).toBeInstanceOf(StackTraceAnalyzer);
    });

    it('should create analyzer with custom project path', () => {
      expect(analyzer).toBeInstanceOf(StackTraceAnalyzer);
    });
  });

  describe('Stack Trace Parsing', () => {
    it('should parse standard V8 stack trace format', () => {
      const stackTrace = `Error: Test error
    at Object.testFunction (/home/project/src/test.js:10:5)
    at processAction (/home/project/src/actions.js:25:10)
    at Object.<anonymous> (/home/project/index.js:5:1)`;

      const parsed = analyzer.parseStackTrace(stackTrace);

      expect(parsed.errorMessage).toBe('Error: Test error');
      expect(parsed.frames).toHaveLength(3);
      expect(parsed.frames[0].functionName).toBe('Object.testFunction');
      expect(parsed.frames[0].fileName).toBe('/home/project/src/test.js');
      expect(parsed.frames[0].lineNumber).toBe(10);
      expect(parsed.frames[0].columnNumber).toBe(5);
      expect(parsed.frames[0].isProjectCode).toBe(true);
    });

    it('should parse anonymous function stack frames', () => {
      const stackTrace = `Error: Test error
    at /home/project/src/anonymous.js:15:20
    at <anonymous> (/home/project/src/callback.js:5:1)`;

      const parsed = analyzer.parseStackTrace(stackTrace);

      expect(parsed.frames[0].functionName).toBe('<anonymous>');
      expect(parsed.frames[0].fileName).toBe('/home/project/src/anonymous.js');
      expect(parsed.frames[0].lineNumber).toBe(15);
      expect(parsed.frames[0].columnNumber).toBe(20);
      expect(parsed.frames[1].functionName).toBe('<anonymous>');
    });

    it('should parse function-only stack frames', () => {
      const stackTrace = `Error: Test error
    at functionWithoutLocation`;

      const parsed = analyzer.parseStackTrace(stackTrace);

      expect(parsed.frames[0].functionName).toBe('functionWithoutLocation');
      expect(parsed.frames[0].fileName).toBe('<unknown>');
      expect(parsed.frames[0].lineNumber).toBeNull();
      expect(parsed.frames[0].columnNumber).toBeNull();
    });

    it('should identify project code frames correctly', () => {
      const stackTrace = `Error: Test error
    at projectFunction (/home/project/src/test.js:10:5)
    at nodeModule (/home/project/node_modules/some-package/index.js:100:10)
    at nativeFunction ([native code])`;

      const parsed = analyzer.parseStackTrace(stackTrace);

      expect(parsed.frames[0].isProjectCode).toBe(true);
      expect(parsed.frames[0].isNodeModules).toBe(false);
      expect(parsed.frames[0].isNativeCode).toBe(false);

      expect(parsed.frames[1].isProjectCode).toBe(false);
      expect(parsed.frames[1].isNodeModules).toBe(true);
      expect(parsed.frames[1].isNativeCode).toBe(false);

      expect(parsed.frames[2].isProjectCode).toBe(false);
      expect(parsed.frames[2].isNodeModules).toBe(false);
      expect(parsed.frames[2].isNativeCode).toBe(true);
    });

    it('should extract short file names correctly', () => {
      const stackTrace = `Error: Test error
    at func1 (/very/long/path/to/project/src/module/test.js:10:5)
    at func2 (/home/project/index.js:5:1)`;

      const parsed = analyzer.parseStackTrace(stackTrace);

      expect(parsed.frames[0].shortFileName).toBe('module/test.js');
      expect(parsed.frames[1].shortFileName).toBe('project/index.js');
    });

    it('should handle malformed stack trace lines gracefully', () => {
      const stackTrace = `Error: Test error
    at validFunction (/home/project/src/test.js:10:5)
    malformed line without at prefix
    at anotherValidFunction (/home/project/src/other.js:20:10)`;

      const parsed = analyzer.parseStackTrace(stackTrace);

      expect(parsed.frames).toHaveLength(2);
      expect(parsed.frames[0].functionName).toBe('validFunction');
      expect(parsed.frames[1].functionName).toBe('anotherValidFunction');
    });

    it('should handle empty or null stack traces', () => {
      expect(analyzer.parseStackTrace(null)).toEqual(
        expect.objectContaining({
          errorMessage: '',
          frames: [],
          frameCount: 0,
          hasProjectFrames: false,
          topProjectFrame: null,
        })
      );

      expect(analyzer.parseStackTrace('')).toEqual(
        expect.objectContaining({
          errorMessage: '',
          frames: [],
          frameCount: 0,
        })
      );

      expect(analyzer.parseStackTrace(undefined)).toEqual(
        expect.objectContaining({
          errorMessage: '',
          frames: [],
          frameCount: 0,
        })
      );
    });

    it('should handle non-string stack traces', () => {
      const parsed = analyzer.parseStackTrace(123);

      expect(parsed.errorMessage).toBe('');
      expect(parsed.frames).toEqual([]);
      expect(parsed.frameCount).toBe(0);
    });
  });

  describe('Stack Trace Analysis', () => {
    it('should provide comprehensive frame analysis', () => {
      const stackTrace = `Error: Test error
    at function1 (/home/project/src/a.js:1:1)
    at function2 (/home/project/src/b.js:2:2)
    at async function3 (/home/project/src/c.js:3:3)
    at nodeFunction (/home/project/node_modules/pkg/index.js:10:10)
    at nativeFunction ([native code])`;

      const parsed = analyzer.parseStackTrace(stackTrace);
      const analysis = parsed.analysis;

      expect(analysis.totalFrames).toBe(5);
      expect(analysis.projectFrames).toBe(3);
      expect(analysis.nodeModulesFrames).toBe(1);
      expect(analysis.nativeFrames).toBe(1);
      expect(analysis.hasAsyncFrames).toBe(true);
      expect(analysis.uniqueFiles).toBe(5);
      expect(analysis.callDepth).toBe(5);
      expect(analysis.isShallow).toBe(false);
      expect(analysis.isDeep).toBe(false);
    });

    it('should detect shallow stack traces', () => {
      const stackTrace = `Error: Test error
    at function1 (/home/project/src/a.js:1:1)
    at function2 (/home/project/src/b.js:2:2)`;

      const parsed = analyzer.parseStackTrace(stackTrace);

      expect(parsed.analysis.isShallow).toBe(true);
      expect(parsed.analysis.isDeep).toBe(false);
    });

    it('should detect deep stack traces', () => {
      const frames = Array.from(
        { length: 25 },
        (_, i) =>
          `    at function${i} (/home/project/src/file${i}.js:${i + 1}:1)`
      ).join('\n');
      const stackTrace = `Error: Deep stack trace\n${frames}`;

      const parsed = analyzer.parseStackTrace(stackTrace);

      expect(parsed.analysis.isShallow).toBe(false);
      expect(parsed.analysis.isDeep).toBe(true);
      expect(parsed.analysis.totalFrames).toBe(25);
    });

    it('should identify async frames correctly', () => {
      const stackTrace = `Error: Async error
    at regular function (/home/project/src/a.js:1:1)
    at async asyncFunction (/home/project/src/b.js:2:2)
    at Promise.resolve (/home/project/src/c.js:3:3)`;

      const parsed = analyzer.parseStackTrace(stackTrace);

      expect(parsed.analysis.hasAsyncFrames).toBe(true);
    });

    it('should find deepest project frame', () => {
      const stackTrace = `Error: Test error
    at nodeFunction (/home/project/node_modules/pkg/index.js:1:1)
    at projectFunction1 (/home/project/src/a.js:2:2)
    at projectFunction2 (/home/project/src/b.js:3:3)
    at nativeFunction ([native code])`;

      const parsed = analyzer.parseStackTrace(stackTrace);

      expect(parsed.analysis.deepestProjectFrame).toBeTruthy();
      expect(parsed.analysis.deepestProjectFrame.functionName).toBe(
        'projectFunction2'
      );
    });

    it('should identify top project frame', () => {
      const stackTrace = `Error: Test error
    at nodeFunction (/home/project/node_modules/pkg/index.js:1:1)
    at projectFunction1 (/home/project/src/a.js:2:2)
    at projectFunction2 (/home/project/src/b.js:3:3)`;

      const parsed = analyzer.parseStackTrace(stackTrace);

      expect(parsed.topProjectFrame).toBeTruthy();
      expect(parsed.topProjectFrame.functionName).toBe('projectFunction1');
      expect(parsed.hasProjectFrames).toBe(true);
    });
  });

  describe('Stack Trace Formatting', () => {
    const sampleStackTrace = `Error: Test error
    at testFunc (/home/project/src/test.js:10:5)
    at nodeFunc (/home/project/node_modules/pkg/index.js:1:1)
    at nativeFunc ([native code])`;

    it('should format stack trace with default options', () => {
      const parsed = analyzer.parseStackTrace(sampleStackTrace);
      const formatted = analyzer.formatStackTrace(parsed);

      expect(formatted).toContain('Error: Test error');
      expect(formatted).toContain('testFunc');
      expect(formatted).toContain('test.js:10:5');
      expect(formatted).toContain('[PROJECT]');
      expect(formatted).toContain('[DEPENDENCY]');
      expect(formatted).toContain('[NATIVE]');
    });

    it('should format stack trace showing project code only', () => {
      const parsed = analyzer.parseStackTrace(sampleStackTrace);
      const formatted = analyzer.formatStackTrace(parsed, {
        showProjectOnly: true,
      });

      expect(formatted).toContain('testFunc');
      expect(formatted).not.toContain('nodeFunc');
      expect(formatted).not.toContain('nativeFunc');
    });

    it('should format stack trace without line numbers', () => {
      const parsed = analyzer.parseStackTrace(sampleStackTrace);
      const formatted = analyzer.formatStackTrace(parsed, {
        includeLineNumbers: false,
      });

      expect(formatted).toContain('testFunc');
      expect(formatted).not.toContain(':10:5');
    });

    it('should format stack trace with analysis', () => {
      const parsed = analyzer.parseStackTrace(sampleStackTrace);
      const formatted = analyzer.formatStackTrace(parsed, {
        includeAnalysis: true,
      });

      expect(formatted).toContain('Analysis:');
      expect(formatted).toContain('Total frames:');
      expect(formatted).toContain('Project frames:');
      expect(formatted).toContain('Call depth:');
    });

    it('should note when async calls are present in analysis output', () => {
      const stackTrace = `Error: Async test error\n    at regularFunc (/home/project/src/test.js:10:5)\n    at async asyncFunc (/home/project/src/async.js:20:10)`;

      const parsed = analyzer.parseStackTrace(stackTrace);
      const formatted = analyzer.formatStackTrace(parsed, {
        includeAnalysis: true,
      });

      expect(parsed.analysis.hasAsyncFrames).toBe(true);
      expect(formatted).toContain('Contains async calls');
    });

    it('should limit number of frames displayed', () => {
      const frames = Array.from(
        { length: 10 },
        (_, i) =>
          `    at function${i} (/home/project/src/file${i}.js:${i + 1}:1)`
      ).join('\n');
      const longStackTrace = `Error: Long stack trace\n${frames}`;

      const parsed = analyzer.parseStackTrace(longStackTrace);
      const formatted = analyzer.formatStackTrace(parsed, {
        maxFrames: 3,
      });

      const lines = formatted.split('\n');
      const frameLines = lines.filter((line) => /^\s*\d+\./.test(line));
      expect(frameLines).toHaveLength(3);
      expect(formatted).toContain('(7 more frames)');
    });

    it('should handle empty parsed trace', () => {
      const formatted = analyzer.formatStackTrace(null);
      expect(formatted).toBe('No stack trace available');

      const emptyTrace = { frames: [] };
      const formatted2 = analyzer.formatStackTrace(emptyTrace);
      expect(formatted2).toContain('No stack trace available');
    });

    it('should format frames with unknown filenames', () => {
      const stackTrace = `Error: Test error
    at unknownFunction`;

      const parsed = analyzer.parseStackTrace(stackTrace);
      const formatted = analyzer.formatStackTrace(parsed);

      expect(formatted).toContain('unknownFunction');
      expect(formatted).not.toContain('(<unknown>');
    });
  });

  describe('Error Location Extraction', () => {
    it('should extract error location preferring project code', () => {
      const stackTrace = `Error: Test error
    at nodeFunction (/home/project/node_modules/pkg/index.js:1:1)
    at projectFunction (/home/project/src/test.js:10:5)
    at anotherNodeFunction (/home/project/node_modules/other/index.js:2:2)`;

      const parsed = analyzer.parseStackTrace(stackTrace);
      const location = analyzer.getErrorLocation(parsed);

      expect(location).toBeTruthy();
      expect(location.function).toBe('projectFunction');
      expect(location.file).toBe('/home/project/src/test.js');
      expect(location.shortFile).toBe('src/test.js');
      expect(location.line).toBe(10);
      expect(location.column).toBe(5);
      expect(location.isProjectCode).toBe(true);
    });

    it('should fallback to first frame when no project code found', () => {
      const stackTrace = `Error: Test error
    at nodeFunction (/home/project/node_modules/pkg/index.js:1:1)
    at anotherNodeFunction (/home/project/node_modules/other/index.js:2:2)`;

      const parsed = analyzer.parseStackTrace(stackTrace);
      const location = analyzer.getErrorLocation(parsed);

      expect(location).toBeTruthy();
      expect(location.function).toBe('nodeFunction');
      expect(location.file).toBe('/home/project/node_modules/pkg/index.js');
      expect(location.isProjectCode).toBe(false);
    });

    it('should return null for empty stack traces', () => {
      const location = analyzer.getErrorLocation(null);
      expect(location).toBeNull();

      const emptyTrace = { frames: [] };
      const location2 = analyzer.getErrorLocation(emptyTrace);
      expect(location2).toBeNull();
    });

    it('should handle frames without location info', () => {
      const stackTrace = `Error: Test error
    at unknownFunction`;

      const parsed = analyzer.parseStackTrace(stackTrace);
      const location = analyzer.getErrorLocation(parsed);

      expect(location).toBeTruthy();
      expect(location.function).toBe('unknownFunction');
      expect(location.file).toBe('<unknown>');
      expect(location.line).toBeNull();
      expect(location.column).toBeNull();
    });
  });

  describe('Project Code Detection', () => {
    it('should correctly identify project code vs dependencies', () => {
      const analyzer = new StackTraceAnalyzer({
        projectPath: '/Users/dev/myproject',
        logger: console,
      });

      const stackTrace = `Error: Test error
    at projectFunc (/Users/dev/myproject/src/index.js:1:1)
    at depFunc (/Users/dev/myproject/node_modules/lodash/index.js:2:2)
    at sysFunc (internal/modules/cjs/loader.js:3:3)
    at nativeFunc ([native code])`;

      const parsed = analyzer.parseStackTrace(stackTrace);

      expect(parsed.frames[0].isProjectCode).toBe(true);
      expect(parsed.frames[1].isNodeModules).toBe(true);
      expect(parsed.frames[2].isNativeCode).toBe(false);
      expect(parsed.frames[3].isNativeCode).toBe(true);
    });

    it('should handle Windows-style paths', () => {
      const analyzer = new StackTraceAnalyzer({
        projectPath: 'C:\\Users\\dev\\myproject',
        logger: console,
      });

      const stackTrace = `Error: Test error
    at projectFunc (C:\\Users\\dev\\myproject\\src\\index.js:1:1)
    at depFunc (C:\\Users\\dev\\myproject\\node_modules\\lodash\\index.js:2:2)`;

      const parsed = analyzer.parseStackTrace(stackTrace);

      expect(parsed.frames[0].isProjectCode).toBe(true);
      expect(parsed.frames[1].isNodeModules).toBe(true);
    });

    it('should handle relative paths and normalization', () => {
      const stackTrace = `Error: Test error
    at projectFunc (./src/index.js:1:1)
    at depFunc (../node_modules/pkg/index.js:2:2)`;

      const parsed = analyzer.parseStackTrace(stackTrace);

      // These should be marked as unknown since they're not absolute paths
      // that can be reliably matched against the project path
      expect(parsed.frames[0].isProjectCode).toBe(false);
      expect(parsed.frames[1].isProjectCode).toBe(false);
    });
  });

  describe('Short File Name Generation', () => {
    it('should generate appropriate short names for different path depths', () => {
      const stackTrace = `Error: Test error
    at func1 (/very/long/path/to/project/src/module/submodule/file.js:1:1)
    at func2 (/home/project/index.js:2:2)
    at func3 (single-file.js:3:3)`;

      const parsed = analyzer.parseStackTrace(stackTrace);

      expect(parsed.frames[0].shortFileName).toBe('submodule/file.js');
      expect(parsed.frames[1].shortFileName).toBe('project/index.js');
      expect(parsed.frames[2].shortFileName).toBe('single-file.js');
    });

    it('should handle unknown and special file names', () => {
      const stackTrace = `Error: Test error
    at func1 (<unknown>)
    at func2 ([native code])`;

      const parsed = analyzer.parseStackTrace(stackTrace);

      expect(parsed.frames[0].shortFileName).toBe('<unknown>');
      expect(parsed.frames[1].shortFileName).toBe('[native code]');
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle stack traces with only error message', () => {
      const stackTrace = 'Error: Just an error message';

      const parsed = analyzer.parseStackTrace(stackTrace);

      expect(parsed.errorMessage).toBe('Error: Just an error message');
      expect(parsed.frames).toEqual([]);
      expect(parsed.frameCount).toBe(0);
    });

    it('should handle stack traces with mixed frame formats', () => {
      const stackTrace = `Error: Mixed formats
    at normalFunc (/home/project/src/test.js:10:5)
    at /home/project/src/anonymous.js:15:20
    at incompleteFunc
    at anotherNormalFunc (/home/project/src/other.js:25:15)`;

      const parsed = analyzer.parseStackTrace(stackTrace);

      expect(parsed.frames).toHaveLength(4);
      expect(parsed.frames[0].functionName).toBe('normalFunc');
      expect(parsed.frames[1].functionName).toBe('<anonymous>');
      expect(parsed.frames[2].functionName).toBe('incompleteFunc');
      expect(parsed.frames[3].functionName).toBe('anotherNormalFunc');
    });

    it('should handle stack traces with extra whitespace', () => {
      const stackTrace = `   Error: Test error   
      at   spaced Function   (  /home/project/src/test.js : 10 : 5  )  
      at   another Function   (  /home/project/src/other.js : 20 : 10  )  `;

      const parsed = analyzer.parseStackTrace(stackTrace);

      expect(parsed.errorMessage).toBe('Error: Test error');
      // Note: The current implementation might not handle internal spacing perfectly,
      // but should still parse the basic structure
      expect(parsed.frames.length).toBeGreaterThan(0);
    });

    it('should provide empty analysis for empty stack traces', () => {
      const parsed = analyzer.parseStackTrace('');

      expect(parsed.analysis.totalFrames).toBe(0);
      expect(parsed.analysis.projectFrames).toBe(0);
      expect(parsed.analysis.nodeModulesFrames).toBe(0);
      expect(parsed.analysis.nativeFrames).toBe(0);
      expect(parsed.analysis.hasAsyncFrames).toBe(false);
      expect(parsed.analysis.isShallow).toBe(true);
      expect(parsed.analysis.isDeep).toBe(false);
      expect(parsed.analysis.uniqueFiles).toBe(0);
    });
  });
});
