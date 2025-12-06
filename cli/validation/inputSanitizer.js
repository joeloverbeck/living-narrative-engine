/**
 * @file Input sanitizer for mod validation security
 * @description Sanitizes and validates input to prevent security vulnerabilities
 * including path traversal, JSON bombs, and ReDoS attacks
 */

import {
  ModSecurityError,
  SecurityLevel,
} from '../../src/errors/modSecurityError.js';
import { validateDependency } from '../../src/utils/dependencyUtils.js';
import path from 'path';

/**
 * Sanitizes and validates input data to prevent security vulnerabilities
 */
class InputSanitizer {
  #config;
  #logger;

  /**
   * Creates a new InputSanitizer instance
   *
   * @param {object} dependencies - Dependencies
   * @param {object} dependencies.config - Security configuration
   * @param {import('../../src/utils/loggerUtils.js').ILogger} [dependencies.logger] - Optional logger
   */
  constructor({ config, logger = console }) {
    this.#config = config || {};
    this.#logger = logger;

    // Set defaults from config or use built-in defaults
    this.maxFileSize = this.#config.maxFileSize || 10 * 1024 * 1024; // 10MB
    this.allowedExtensions = this.#config.allowedExtensions || [
      '.json',
      '.scope',
    ];
    this.blockedPaths = this.#config.blockedPaths || [
      'node_modules',
      '.git',
      '.env',
      'secrets',
    ];
    this.maxDepth = this.#config.maxDepth || 50;
    this.maxKeys = this.#config.maxKeys || 1000;
    this.maxStringLength = this.#config.maxStringLength || 100000;
    this.maxArrayLength = this.#config.maxArrayLength || 10000;
    this.maxReferences = this.#config.maxReferences || 10000;
    this.pathTraversalPatterns = this.#config.pathTraversalPatterns || [
      '../',
      '..\\',
      '%2e%2e/',
      '%2e%2e\\',
      '..%2f',
      '..%5c',
      '..',
      '~/',
      '~\\',
    ];
  }

  /**
   * Sanitizes a file path to prevent directory traversal attacks
   *
   * @param {string} filePath - The file path to sanitize
   * @returns {string} Sanitized file path
   * @throws {ModSecurityError} If path traversal attempt is detected
   */
  sanitizeFilePath(filePath) {
    if (!filePath || typeof filePath !== 'string') {
      throw new ModSecurityError(
        'Invalid file path provided',
        SecurityLevel.MEDIUM,
        { filePath, reason: 'Invalid or missing path' }
      );
    }

    // Normalize the path to resolve any '..' or '.' segments
    const normalizedPath = path.normalize(filePath);
    const resolvedPath = path.resolve(filePath);

    // Check for path traversal patterns
    for (const pattern of this.pathTraversalPatterns) {
      if (filePath.includes(pattern)) {
        this.#logger.error(`Path traversal attempt detected: ${filePath}`);
        throw new ModSecurityError(
          `Path traversal attempt detected in: ${filePath}`,
          SecurityLevel.CRITICAL,
          {
            filePath,
            pattern,
            reason: 'Path contains traversal pattern',
          }
        );
      }
    }

    // Check if path tries to escape the mod directory
    const modBasePath = this.#getModBasePath(normalizedPath);
    if (modBasePath && !resolvedPath.startsWith(modBasePath)) {
      throw new ModSecurityError(
        `Path escapes mod directory: ${filePath}`,
        SecurityLevel.HIGH,
        {
          filePath,
          modBasePath,
          resolvedPath,
          reason: 'Path escapes allowed directory',
        }
      );
    }

    // Check for blocked paths
    for (const blockedPath of this.blockedPaths) {
      if (normalizedPath.includes(blockedPath)) {
        throw new ModSecurityError(
          `Access to blocked path attempted: ${blockedPath}`,
          SecurityLevel.HIGH,
          {
            filePath,
            blockedPath,
            reason: 'Path contains blocked directory',
          }
        );
      }
    }

    // Check file extension
    const ext = path.extname(normalizedPath).toLowerCase();
    if (ext && !this.allowedExtensions.includes(ext)) {
      throw new ModSecurityError(
        `Disallowed file extension: ${ext}`,
        SecurityLevel.MEDIUM,
        {
          filePath,
          extension: ext,
          allowedExtensions: this.allowedExtensions,
          reason: 'File extension not allowed',
        }
      );
    }

    return normalizedPath;
  }

  /**
   * Sanitizes JSON content to prevent JSON bomb attacks
   *
   * @param {any} content - The JSON content to sanitize
   * @param {string} filePath - The file path (for error reporting)
   * @returns {any} Sanitized content
   * @throws {ModSecurityError} If dangerous JSON patterns are detected
   */
  sanitizeJsonContent(content, filePath = 'unknown') {
    if (!content || typeof content !== 'object') {
      return content; // Primitive values are safe
    }

    const stats = {
      depth: 0,
      keyCount: 0,
      arrayCount: 0,
      stringLength: 0,
      totalSize: 0,
    };

    try {
      this.#analyzeJsonStructure(content, stats, 0);
    } catch (error) {
      if (error instanceof ModSecurityError) {
        throw error;
      }
      throw new ModSecurityError(
        `JSON analysis failed: ${error.message}`,
        SecurityLevel.MEDIUM,
        { filePath, error: error.message }
      );
    }

    // Check for dangerous patterns
    this.#checkForDangerousKeys(content, filePath);

    return content;
  }

  /**
   * Sanitizes Scope DSL content to prevent ReDoS attacks
   *
   * @param {string} content - The Scope DSL content to sanitize
   * @param {string} filePath - The file path (for error reporting)
   * @returns {string} Sanitized content
   * @throws {ModSecurityError} If dangerous patterns are detected
   */
  sanitizeScopeDslContent(content, filePath = 'unknown') {
    if (!content || typeof content !== 'string') {
      return content;
    }

    // Check expression length
    if (content.length > (this.#config.maxExpressionLength || 5000)) {
      throw new ModSecurityError(
        'Scope expression exceeds maximum length',
        SecurityLevel.MEDIUM,
        {
          filePath,
          length: content.length,
          maxLength: this.#config.maxExpressionLength || 5000,
        }
      );
    }

    // Check for ReDoS patterns
    const dangerousPatterns = this.#config.dangerousRegexPatterns || [
      '(.*)*',
      '(.*)\\+',
      '([^\\n]*)*',
      '([^\\n]*)\\+',
      '(\\w*)*',
      '(\\w*)\\+',
    ];

    for (const pattern of dangerousPatterns) {
      if (content.includes(pattern)) {
        throw new ModSecurityError(
          `Potentially dangerous regex pattern detected: ${pattern}`,
          SecurityLevel.HIGH,
          {
            filePath,
            pattern,
            reason: 'Potential ReDoS vulnerability',
          }
        );
      }
    }

    // Check nesting depth (count brackets)
    const nestingDepth = this.#calculateNestingDepth(content);
    if (nestingDepth > (this.#config.maxNestingLevel || 20)) {
      throw new ModSecurityError(
        'Scope expression exceeds maximum nesting depth',
        SecurityLevel.MEDIUM,
        {
          filePath,
          depth: nestingDepth,
          maxDepth: this.#config.maxNestingLevel || 20,
        }
      );
    }

    // Check reference count
    const referenceCount = (
      content.match(/[a-zA-Z][a-zA-Z0-9_]*:[a-zA-Z][a-zA-Z0-9_-]*/g) || []
    ).length;
    if (referenceCount > this.maxReferences) {
      throw new ModSecurityError(
        'Scope expression contains too many references',
        SecurityLevel.MEDIUM,
        {
          filePath,
          referenceCount,
          maxReferences: this.maxReferences,
        }
      );
    }

    return content;
  }

  /**
   * Validates file size to prevent processing of excessively large files
   *
   * @param {number} size - File size in bytes
   * @param {string} filePath - The file path (for error reporting)
   * @throws {ModSecurityError} If file size exceeds limit
   */
  validateFileSize(size, filePath = 'unknown') {
    if (size > this.maxFileSize) {
      throw new ModSecurityError(
        `File size exceeds maximum allowed: ${size} > ${this.maxFileSize}`,
        SecurityLevel.MEDIUM,
        {
          filePath,
          fileSize: size,
          maxSize: this.maxFileSize,
          reason: 'File too large',
        }
      );
    }
  }

  /**
   * Analyzes JSON structure recursively to detect bombs
   *
   * @private
   * @param {any} obj - Object to analyze
   * @param {object} stats - Statistics object to update
   * @param {number} currentDepth - Current nesting depth
   * @throws {ModSecurityError} If limits are exceeded
   */
  #analyzeJsonStructure(obj, stats, currentDepth) {
    // Check depth
    if (currentDepth > this.maxDepth) {
      throw new ModSecurityError(
        `JSON nesting depth exceeds maximum: ${currentDepth} > ${this.maxDepth}`,
        SecurityLevel.HIGH,
        {
          depth: currentDepth,
          maxDepth: this.maxDepth,
          reason: 'Possible JSON bomb - excessive nesting',
        }
      );
    }

    stats.depth = Math.max(stats.depth, currentDepth);

    if (Array.isArray(obj)) {
      // Check array length
      if (obj.length > this.maxArrayLength) {
        throw new ModSecurityError(
          `Array length exceeds maximum: ${obj.length} > ${this.maxArrayLength}`,
          SecurityLevel.HIGH,
          {
            arrayLength: obj.length,
            maxLength: this.maxArrayLength,
            reason: 'Possible JSON bomb - excessive array size',
          }
        );
      }

      stats.arrayCount++;

      // Recursively check array elements
      for (const item of obj) {
        this.#analyzeJsonStructure(item, stats, currentDepth + 1);
      }
    } else if (obj && typeof obj === 'object') {
      const keys = Object.keys(obj);

      // Check key count
      if (keys.length > this.maxKeys) {
        throw new ModSecurityError(
          `Object key count exceeds maximum: ${keys.length} > ${this.maxKeys}`,
          SecurityLevel.HIGH,
          {
            keyCount: keys.length,
            maxKeys: this.maxKeys,
            reason: 'Possible JSON bomb - excessive keys',
          }
        );
      }

      stats.keyCount += keys.length;

      // Recursively check object values
      for (const key of keys) {
        // Check for prototype pollution attempts
        if (
          key === '__proto__' ||
          key === 'constructor' ||
          key === 'prototype'
        ) {
          throw new ModSecurityError(
            `Dangerous key detected: ${key}`,
            SecurityLevel.CRITICAL,
            {
              key,
              reason: 'Potential prototype pollution attempt',
            }
          );
        }

        this.#analyzeJsonStructure(obj[key], stats, currentDepth + 1);
      }
    } else if (typeof obj === 'string') {
      // Check string length
      if (obj.length > this.maxStringLength) {
        throw new ModSecurityError(
          `String length exceeds maximum: ${obj.length} > ${this.maxStringLength}`,
          SecurityLevel.MEDIUM,
          {
            stringLength: obj.length,
            maxLength: this.maxStringLength,
            reason: 'Excessive string length',
          }
        );
      }

      stats.stringLength += obj.length;
    }

    // Update total size estimate
    stats.totalSize = stats.keyCount + stats.arrayCount + stats.stringLength;
  }

  /**
   * Checks for dangerous keys that might indicate attacks
   *
   * @private
   * @param {object} obj - Object to check
   * @param {string} filePath - File path for error reporting
   */
  #checkForDangerousKeys(obj, filePath) {
    const dangerousKeys = this.#config.dangerousKeys || [
      '__proto__',
      'constructor',
      'prototype',
    ];

    const checkObject = (o, path = '') => {
      if (!o || typeof o !== 'object') return;

      if (Array.isArray(o)) {
        o.forEach((item, index) => checkObject(item, `${path}[${index}]`));
      } else {
        for (const key of Object.keys(o)) {
          const keyPath = path ? `${path}.${key}` : key;

          if (dangerousKeys.includes(key)) {
            throw new ModSecurityError(
              `Dangerous key '${key}' detected at path: ${keyPath}`,
              SecurityLevel.CRITICAL,
              {
                filePath,
                key,
                path: keyPath,
                reason: 'Potential security vulnerability',
              }
            );
          }

          checkObject(o[key], keyPath);
        }
      }
    };

    checkObject(obj);
  }

  /**
   * Calculates the nesting depth of brackets in a string
   *
   * @private
   * @param {string} content - Content to analyze
   * @returns {number} Maximum nesting depth
   */
  #calculateNestingDepth(content) {
    let maxDepth = 0;
    let currentDepth = 0;
    const openBrackets = ['[', '{', '('];
    const closeBrackets = [']', '}', ')'];

    for (const char of content) {
      if (openBrackets.includes(char)) {
        currentDepth++;
        maxDepth = Math.max(maxDepth, currentDepth);
      } else if (closeBrackets.includes(char)) {
        currentDepth = Math.max(0, currentDepth - 1);
      }
    }

    return maxDepth;
  }

  /**
   * Gets the base path for mod files
   *
   * @private
   * @param {string} filePath - File path to check
   * @returns {string|null} Base mod path or null
   */
  #getModBasePath(filePath) {
    // Try to find 'data/mods' in the path
    const modsIndex = filePath.indexOf('data/mods');
    if (modsIndex !== -1) {
      // Return everything up to and including the mod directory
      const afterMods = filePath.substring(modsIndex + 'data/mods/'.length);
      const modName = afterMods.split(/[/\\]/)[0];
      if (modName) {
        return filePath.substring(
          0,
          modsIndex + 'data/mods/'.length + modName.length
        );
      }
    }

    // In test environment, might be in temp directory
    if (globalThis.process?.env?.NODE_ENV === 'test') {
      const tempIndex = filePath.indexOf('/tmp/');
      if (tempIndex !== -1) {
        return null; // Allow temp directories in tests
      }
    }

    return null;
  }
}

export default InputSanitizer;
