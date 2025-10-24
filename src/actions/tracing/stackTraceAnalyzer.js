/**
 * @file Stack trace analysis for error capture
 * Provides detailed analysis and formatting of JavaScript stack traces
 */

/**
 * Stack trace analyzer for processing and formatting error stack traces
 */
export class StackTraceAnalyzer {
  #projectPath;
  #logger;

  constructor({ projectPath = process.cwd(), logger }) {
    this.#projectPath = projectPath;
    this.#logger = logger;
  }

  /**
   * Parse and analyze a stack trace
   *
   * @param {string} stackTrace - Raw stack trace string
   * @returns {object} Parsed stack trace information
   */
  parseStackTrace(stackTrace) {
    if (!stackTrace || typeof stackTrace !== 'string') {
      return this.#createEmptyStackTrace();
    }

    const lines = stackTrace.split('\n');
    const frames = [];
    let errorMessage = '';

    // First line is usually the error message
    if (lines.length > 0 && !lines[0].trim().startsWith('at ')) {
      errorMessage = lines[0].trim();
    }

    // Parse stack frames
    lines.forEach((line, index) => {
      if (line.trim().startsWith('at ')) {
        const frame = this.#parseStackFrame(line.trim());
        if (frame) {
          frame.index = index;
          frames.push(frame);
        }
      }
    });

    return {
      errorMessage,
      frames,
      frameCount: frames.length,
      hasProjectFrames: frames.some((f) => f.isProjectCode),
      topProjectFrame: frames.find((f) => f.isProjectCode) || null,
      analysis: this.#analyzeStackTrace(frames),
    };
  }

  /**
   * Parse individual stack frame
   *
   * @private
   * @param {string} line - Stack frame line
   * @returns {object | null} Parsed frame or null if invalid
   */
  #parseStackFrame(line) {
    // Remove 'at ' prefix
    const cleaned = line.replace(/^\s*at\s+/, '');

    // Try to match different stack frame formats
    const patterns = [
      // Function at native code
      /^(.+?)\s+\((\[native code\])\)$/,
      // Function at file:line:column
      /^(.+?)\s+\((.+):(\d+):(\d+)\)$/,
      // Anonymous function at file:line:column
      /^(.+):(\d+):(\d+)$/,
      // Function with no location info
      /^(.+)$/,
    ];

    for (const pattern of patterns) {
      const match = cleaned.match(pattern);
      if (match) {
        return this.#buildFrameObject(match);
      }
    }

  }

  /**
   * Build frame object from regex match
   *
   * @private
   * @param {Array} match - Regex match array
   * @returns {object} Stack frame object
   */
  #buildFrameObject(match) {
    let functionName, fileName, lineNumber, columnNumber;

    if (match.length === 5) {
      // Function at file:line:column
      [, functionName, fileName, lineNumber, columnNumber] = match;
    } else if (match.length === 4) {
      // Anonymous function at file:line:column
      [, fileName, lineNumber, columnNumber] = match;
      functionName = '<anonymous>';
    } else if (match.length === 3 && match[2] === '[native code]') {
      // Function at [native code]
      [, functionName, fileName] = match;
      lineNumber = null;
      columnNumber = null;
    } else {
      // Function name only
      functionName = match[1];
      fileName = '<unknown>';
      lineNumber = null;
      columnNumber = null;
    }

    return {
      functionName: functionName.trim(),
      fileName: fileName ? fileName.trim() : '<unknown>',
      lineNumber: lineNumber ? parseInt(lineNumber, 10) : null,
      columnNumber: columnNumber ? parseInt(columnNumber, 10) : null,
      isProjectCode: this.#isProjectCode(fileName),
      isNodeModules: fileName && fileName.includes('node_modules'),
      isNativeCode:
        fileName === '<unknown>' ||
        (fileName && fileName.includes('[native code]')),
      shortFileName: this.#getShortFileName(fileName),
    };
  }

  /**
   * Check if file is project code
   *
   * @private
   * @param {string} fileName - File name to check
   * @returns {boolean} True if project code
   */
  #isProjectCode(fileName) {
    if (!fileName || fileName === '<unknown>') {
      return false;
    }

    // Normalize paths for comparison
    const normalizedFile = fileName.replace(/\\/g, '/');
    const normalizedProject = this.#projectPath.replace(/\\/g, '/');

    return (
      normalizedFile.includes(normalizedProject) &&
      !normalizedFile.includes('node_modules')
    );
  }

  /**
   * Get short file name for display
   *
   * @private
   * @param {string} fileName - Full file path
   * @returns {string} Short file name
   */
  #getShortFileName(fileName) {
    if (!fileName || fileName === '<unknown>') {
      return '<unknown>';
    }

    if (fileName === '[native code]') {
      return '[native code]';
    }

    // Extract just the file name and immediate parent directory
    const parts = fileName.split(/[/\\]/);
    if (parts.length >= 2) {
      return `${parts[parts.length - 2]}/${parts[parts.length - 1]}`;
    }

    return parts[parts.length - 1];
  }

  /**
   * Analyze stack trace patterns
   *
   * @private
   * @param {Array} frames - Stack frames
   * @returns {object} Stack trace analysis
   */
  #analyzeStackTrace(frames) {
    const projectFrames = frames.filter((f) => f.isProjectCode);
    const nodeModulesFrames = frames.filter((f) => f.isNodeModules);
    const nativeFrames = frames.filter((f) => f.isNativeCode);

    return {
      totalFrames: frames.length,
      projectFrames: projectFrames.length,
      nodeModulesFrames: nodeModulesFrames.length,
      nativeFrames: nativeFrames.length,
      hasAsyncFrames: frames.some((f) => f.functionName.includes('async')),
      deepestProjectFrame: projectFrames[projectFrames.length - 1] || null,
      callDepth: frames.length,
      isShallow: frames.length <= 3,
      isDeep: frames.length > 20,
      uniqueFiles: [...new Set(frames.map((f) => f.fileName))].length,
    };
  }

  /**
   * Format stack trace for human readability
   *
   * @param {object} parsedTrace - Parsed stack trace
   * @param {object} options - Formatting options
   * @returns {string} Formatted stack trace
   */
  formatStackTrace(parsedTrace, options = {}) {
    const {
      showProjectOnly = false,
      maxFrames = 20,
      includeLineNumbers = true,
      includeAnalysis = false,
    } = options;

    if (
      !parsedTrace ||
      !parsedTrace.frames ||
      parsedTrace.frames.length === 0
    ) {
      return 'No stack trace available';
    }

    const lines = [];

    // Add error message if available
    if (parsedTrace.errorMessage) {
      lines.push(`Error: ${parsedTrace.errorMessage}`);
      lines.push('');
    }

    // Filter and limit frames
    let frames = parsedTrace.frames;
    if (showProjectOnly) {
      frames = frames.filter((f) => f.isProjectCode);
    }
    frames = frames.slice(0, maxFrames);

    // Format frames
    frames.forEach((frame, index) => {
      let line = `  ${index + 1}. ${frame.functionName}`;

      if (frame.fileName !== '<unknown>') {
        line += ` (${frame.shortFileName}`;

        if (includeLineNumbers && frame.lineNumber) {
          line += `:${frame.lineNumber}`;
          if (frame.columnNumber) {
            line += `:${frame.columnNumber}`;
          }
        }

        line += ')';
      }

      // Add markers for special frame types
      if (frame.isProjectCode) {
        line += ' [PROJECT]';
      } else if (frame.isNodeModules) {
        line += ' [DEPENDENCY]';
      } else if (frame.isNativeCode) {
        line += ' [NATIVE]';
      }

      lines.push(line);
    });

    // Add truncation notice if frames were limited
    if (parsedTrace.frames.length > maxFrames) {
      lines.push(
        `  ... (${parsedTrace.frames.length - maxFrames} more frames)`
      );
    }

    // Add analysis if requested
    if (includeAnalysis && parsedTrace.analysis) {
      lines.push('');
      lines.push('Analysis:');
      lines.push(`  Total frames: ${parsedTrace.analysis.totalFrames}`);
      lines.push(`  Project frames: ${parsedTrace.analysis.projectFrames}`);
      lines.push(`  Call depth: ${parsedTrace.analysis.callDepth}`);
      if (parsedTrace.analysis.hasAsyncFrames) {
        lines.push('  Contains async calls');
      }
    }

    return lines.join('\n');
  }

  /**
   * Create empty stack trace object
   *
   * @private
   * @returns {object} Empty stack trace
   */
  #createEmptyStackTrace() {
    return {
      errorMessage: '',
      frames: [],
      frameCount: 0,
      hasProjectFrames: false,
      topProjectFrame: null,
      analysis: {
        totalFrames: 0,
        projectFrames: 0,
        nodeModulesFrames: 0,
        nativeFrames: 0,
        hasAsyncFrames: false,
        deepestProjectFrame: null,
        callDepth: 0,
        isShallow: true,
        isDeep: false,
        uniqueFiles: 0,
      },
    };
  }

  /**
   * Extract error location from stack trace
   *
   * @param {object} parsedTrace - Parsed stack trace
   * @returns {object | null} Error location info
   */
  getErrorLocation(parsedTrace) {
    if (!parsedTrace || !parsedTrace.frames) {
      return null;
    }

    // Prefer project code frames
    const projectFrame = parsedTrace.frames.find((f) => f.isProjectCode);
    const firstFrame = parsedTrace.frames[0];

    const frame = projectFrame || firstFrame;

    if (!frame) {
      return null;
    }

    return {
      file: frame.fileName,
      shortFile: frame.shortFileName,
      function: frame.functionName,
      line: frame.lineNumber,
      column: frame.columnNumber,
      isProjectCode: frame.isProjectCode,
    };
  }
}
