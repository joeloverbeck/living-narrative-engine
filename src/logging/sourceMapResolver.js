/**
 * @file Browser-based source map resolver for debug logging
 * Resolves bundled stack traces back to original source files
 * Uses a simplified VLQ decoder for browser compatibility
 */

/**
 * Simple VLQ decoder for source maps
 * Based on the spec: https://sourcemaps.info/spec.html
 */
class VLQDecoder {
  static BASE64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  static BASE64_MAP = {};
  
  static {
    // Initialize the base64 map
    for (let i = 0; i < VLQDecoder.BASE64.length; i++) {
      VLQDecoder.BASE64_MAP[VLQDecoder.BASE64[i]] = i;
    }
  }

  /**
   * Decode a single VLQ value
   * @param {string} str - VLQ encoded string
   * @param {number} index - Start index
   * @returns {{value: number, index: number}} Decoded value and next index
   */
  static decodeVLQ(str, index) {
    let result = 0;
    let shift = 0;
    let continuation = true;
    
    while (continuation && index < str.length) {
      const char = str[index++];
      const digit = VLQDecoder.BASE64_MAP[char];
      
      if (digit === undefined) {
        throw new Error(`Invalid base64 character: ${char}`);
      }
      
      continuation = (digit & 32) !== 0;
      result += (digit & 31) << shift;
      shift += 5;
    }
    
    // Convert from VLQ signed to regular signed integer
    const negate = (result & 1) === 1;
    result >>= 1;
    if (negate) {
      result = -result;
    }
    
    return { value: result, index };
  }

  /**
   * Decode a line of mappings
   * @param {string} line - Single line of mappings
   * @returns {Array} Decoded segments
   */
  static decodeLine(line) {
    const segments = [];
    let index = 0;
    
    while (index < line.length) {
      const segment = [];
      
      // Generated column
      const genCol = VLQDecoder.decodeVLQ(line, index);
      segment.push(genCol.value);
      index = genCol.index;
      
      if (index < line.length && line[index] !== ',' && line[index] !== ';') {
        // Source index
        const srcIdx = VLQDecoder.decodeVLQ(line, index);
        segment.push(srcIdx.value);
        index = srcIdx.index;
        
        // Original line
        const origLine = VLQDecoder.decodeVLQ(line, index);
        segment.push(origLine.value);
        index = origLine.index;
        
        // Original column
        const origCol = VLQDecoder.decodeVLQ(line, index);
        segment.push(origCol.value);
        index = origCol.index;
        
        // Optional: name index
        if (index < line.length && line[index] !== ',' && line[index] !== ';') {
          const nameIdx = VLQDecoder.decodeVLQ(line, index);
          segment.push(nameIdx.value);
          index = nameIdx.index;
        }
      }
      
      segments.push(segment);
      
      // Skip comma
      if (index < line.length && line[index] === ',') {
        index++;
      }
    }
    
    return segments;
  }
}

/**
 * Source map resolver for browser environments
 * Implements simplified VLQ decoding for browser compatibility
 */
class SourceMapResolver {
  #sourceMapCache = new Map();
  #pendingFetches = new Map();
  #enabled = true;

  constructor() {
    // Pre-fetch common bundle source maps on initialization
    // Note: When served via http-server from dist/, files are at root
    this.prefetchSourceMap('/bundle.js');
  }

  /**
   * Prefetch and cache a source map for faster resolution
   * @param {string} bundleUrl - URL of the bundled file
   * @returns {Promise<void>}
   */
  async prefetchSourceMap(bundleUrl) {
    if (!this.#enabled) return;

    const mapUrl = bundleUrl + '.map';
    
    // Check if already cached or fetching
    if (this.#sourceMapCache.has(mapUrl) || this.#pendingFetches.has(mapUrl)) {
      return this.#pendingFetches.get(mapUrl) || Promise.resolve();
    }

    // Create fetch promise and store it
    const fetchPromise = this.#fetchSourceMap(mapUrl);
    this.#pendingFetches.set(mapUrl, fetchPromise);

    try {
      await fetchPromise;
    } finally {
      this.#pendingFetches.delete(mapUrl);
    }
  }

  /**
   * Fetch and parse a source map
   * @private
   * @param {string} mapUrl - URL of the source map file
   * @returns {Promise<void>}
   */
  async #fetchSourceMap(mapUrl) {
    try {
      const response = await fetch(mapUrl, {
        method: 'GET',
        credentials: 'same-origin',
      });

      if (!response.ok) {
        console.warn(`Failed to fetch source map: ${mapUrl}`);
        return;
      }

      const sourceMapData = await response.json();
      
      // Validate source map structure
      if (!sourceMapData.sources || !sourceMapData.mappings) {
        console.warn(`Invalid source map format: ${mapUrl}`);
        return;
      }

      // Parse and cache the source map
      const parsed = this.#parseSourceMap(sourceMapData);
      this.#sourceMapCache.set(mapUrl, parsed);
      
    } catch (error) {
      console.warn(`Error fetching source map ${mapUrl}:`, error);
      // Disable source maps if fetching fails to avoid repeated attempts
      if (error.message && error.message.includes('Failed to fetch')) {
        this.#enabled = false;
      }
    }
  }

  /**
   * Parse source map data
   * @private
   * @param {Object} sourceMapData - Raw source map data
   * @returns {Object} Parsed source map
   */
  #parseSourceMap(sourceMapData) {
    const { sources, mappings } = sourceMapData;
    const lines = mappings.split(';');
    const parsedMappings = [];
    
    // Current position in generated file
    let generatedLine = 1;
    
    // Current position in original files
    let sourceIndex = 0;
    let originalLine = 1;
    let originalColumn = 0;
    
    for (const line of lines) {
      const segments = [];
      let generatedColumn = 0;
      
      if (line) {
        try {
          const decodedSegments = VLQDecoder.decodeLine(line);
          
          for (const segment of decodedSegments) {
            if (segment.length >= 4) {
              // Update relative positions
              generatedColumn += segment[0];
              sourceIndex += segment[1];
              originalLine += segment[2];
              originalColumn += segment[3];
              
              segments.push({
                generatedColumn,
                sourceIndex,
                originalLine,
                originalColumn,
              });
            }
          }
        } catch (error) {
          // Skip invalid segments
          console.debug('Failed to decode segment:', error);
        }
      }
      
      parsedMappings.push({
        generatedLine,
        segments,
      });
      
      generatedLine++;
    }
    
    return {
      sources,
      mappings: parsedMappings,
    };
  }

  /**
   * Resolve a stack frame from bundle.js to original source
   * @param {string} bundlePath - Path to bundle file (e.g., "bundle.js")
   * @param {number} line - Line number in bundle (1-based)
   * @param {number} [column] - Column number in bundle (0-based)
   * @returns {Object|null} Resolved source location or null
   */
  resolveSync(bundlePath, line, column = 0) {
    if (!this.#enabled) return null;

    // Normalize bundle path to map URL
    const mapUrl = bundlePath.includes('.js') 
      ? bundlePath + '.map'
      : bundlePath + '.js.map';

    // Try to find the source map with various path formats
    let sourceMap = this.#sourceMapCache.get(mapUrl) || 
                    this.#sourceMapCache.get('/' + mapUrl);

    if (!sourceMap) {
      // Try common paths (when served from dist/, files are at root)
      const alternativePaths = [
        '/bundle.js.map',
        './bundle.js.map',
        'bundle.js.map',
      ];
      
      for (const path of alternativePaths) {
        sourceMap = this.#sourceMapCache.get(path);
        if (sourceMap) {
          break;
        }
      }
      
      if (!sourceMap) {
        return null;
      }
    }

    // Find the mapping for the given position
    const lineData = sourceMap.mappings[line - 1];
    if (!lineData || !lineData.segments || lineData.segments.length === 0) {
      // Fallback to simple heuristic
      return this.#fallbackResolve(sourceMap, line, column);
    }

    // Find the segment that contains our column
    let bestSegment = null;
    for (const segment of lineData.segments) {
      if (segment.generatedColumn <= column) {
        bestSegment = segment;
      } else {
        break;
      }
    }

    if (bestSegment && sourceMap.sources[bestSegment.sourceIndex]) {
      const sourcePath = sourceMap.sources[bestSegment.sourceIndex];
      const cleanPath = this.#cleanSourcePath(sourcePath);
      
      return {
        source: cleanPath,
        line: bestSegment.originalLine,
        column: bestSegment.originalColumn,
      };
    }

    // Fallback if no exact match
    return this.#fallbackResolve(sourceMap, line, column);
  }

  /**
   * Fallback resolution when exact mapping not found
   * @private
   * @param {Object} sourceMap - Parsed source map
   * @param {number} line - Line number in bundle
   * @param {number} column - Column number in bundle
   * @returns {Object|null} Resolved source location or null
   */
  #fallbackResolve(sourceMap, line, column) {
    if (!sourceMap.sources || sourceMap.sources.length === 0) {
      return null;
    }

    // Simple heuristic: estimate source file based on line number
    const sourceIndex = Math.min(
      Math.floor(line / 10000), // Rough estimate
      sourceMap.sources.length - 1
    );
    
    const sourcePath = sourceMap.sources[sourceIndex];
    if (sourcePath) {
      const cleanPath = this.#cleanSourcePath(sourcePath);
      return {
        source: cleanPath,
        line: line,
        column: column,
      };
    }

    return null;
  }

  /**
   * Clean up source path for display
   * @private
   * @param {string} sourcePath - Raw source path from source map
   * @returns {string} Cleaned path
   */
  #cleanSourcePath(sourcePath) {
    // Remove webpack/esbuild prefixes
    let cleaned = sourcePath;
    cleaned = cleaned.replace(/^webpack:\/\/\//, '');
    cleaned = cleaned.replace(/^\.\.\//, '');
    cleaned = cleaned.replace(/^\.\//, '');
    
    // Normalize to src/ prefix if not present
    if (!cleaned.startsWith('src/') && cleaned.includes('/')) {
      const srcIndex = cleaned.indexOf('src/');
      if (srcIndex > 0) {
        cleaned = cleaned.substring(srcIndex);
      }
    }
    
    return cleaned;
  }

  /**
   * Extract source path from a stack trace line
   * @param {string} stackLine - Single line from stack trace
   * @returns {Object|null} Extracted source info or null
   */
  extractSourceFromStackLine(stackLine) {
    if (!stackLine || !this.#enabled) return null;

    // Match common browser stack trace patterns
    const patterns = [
      // Chrome: "at functionName (http://domain/path/file.js:line:col)"
      /at\s+(?:.*?\s+)?\(?(?:.*?\/)?([^\/\s]+\.js):(\d+):(\d+)\)?/,
      // Firefox: "functionName@http://domain/path/file.js:line:col"
      /(?:.*?@)?(?:.*?\/)?([^\/\s]+\.js):(\d+):(\d+)/,
      // Safari: "functionName@file.js:line:col"
      /(?:.*?@)?([^\/\s@]+\.js):(\d+):(\d+)/,
      // Edge/IE: "at functionName (file.js:line:col)"
      /at\s+.*?\s+\(([^)]+\.js):(\d+):(\d+)\)/,
    ];

    for (const pattern of patterns) {
      const match = stackLine.match(pattern);
      if (match) {
        const [, file, line, column] = match;
        
        // Check if this is a bundled file
        if (file.includes('bundle') || file.includes('chunk')) {
          // Try to resolve through source map
          const resolved = this.resolveSync(file, parseInt(line), parseInt(column));
          if (resolved) {
            return resolved;
          }
        }
        
        // Return original if not bundled or resolution failed
        return {
          source: file,
          line: parseInt(line),
          column: parseInt(column),
        };
      }
    }

    return null;
  }

  /**
   * Clean up resources when no longer needed
   */
  destroy() {
    this.#sourceMapCache.clear();
    this.#pendingFetches.clear();
  }
}

// Export singleton instance for browser use
const sourceMapResolver = new SourceMapResolver();

// Clean up on page unload - use pagehide which is more reliable than unload
if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', () => {
    sourceMapResolver.destroy();
  });
}

export default sourceMapResolver;