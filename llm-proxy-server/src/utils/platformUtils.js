/**
 * @file Platform utilities for cross-platform compatibility
 * @description Utilities for detecting platform and environment specifics, including WSL
 */

import { readFileSync } from 'fs';

/**
 * Checks if the current environment is Windows Subsystem for Linux (WSL)
 * @returns {boolean} True if running in WSL, false otherwise
 */
export function isWSL() {
  // Method 1: Check WSL environment variables
  if (process.env.WSL_DISTRO_NAME || process.env.WSLENV || process.env.WSL_INTEROP) {
    return true;
  }

  // Method 2: Check /proc/version for Microsoft/WSL keywords (Linux only)
  if (process.platform === 'linux') {
    try {
      const procVersion = readFileSync('/proc/version', 'utf8').toLowerCase();
      if (procVersion.includes('microsoft') || procVersion.includes('wsl')) {
        return true;
      }
    } catch (_error) {
      // Unable to read /proc/version, assume not WSL
    }
  }

  return false;
}

/**
 * Checks if Windows Terminal flushing should be applied
 * This includes native Windows and WSL environments displaying through Windows Terminal
 * @returns {boolean} True if Windows Terminal flush mechanisms should be used
 */
export function shouldUseWindowsTerminalFlush() {
  // Native Windows
  if (process.platform === 'win32') {
    return true;
  }

  // WSL environment (Linux running under Windows)
  if (process.platform === 'linux' && isWSL()) {
    return true;
  }

  return false;
}

/**
 * Gets a descriptive string of the current platform environment
 * @returns {string} Platform description
 */
export function getPlatformDescription() {
  if (process.platform === 'win32') {
    return 'Windows (native)';
  }

  if (process.platform === 'linux' && isWSL()) {
    return 'Linux (WSL - Windows Terminal output)';
  }

  return `${process.platform} (native)`;
}

/**
 * Force flush stdout/stderr with WSL and Windows compatibility
 * This function works for both native Windows and WSL environments
 * @param {boolean} [forceLog] - Whether to log flush attempts (for debugging)
 */
export function forceTerminalFlush(forceLog = false) {
  if (!shouldUseWindowsTerminalFlush()) {
    if (forceLog) {
      console.log('[PlatformUtils] Skipping flush - not Windows/WSL environment');
    }
    return;
  }

  try {
    // Method 1: Native Node.js flush methods (works on native Windows)
    if (process.stdout && typeof process.stdout._flush === 'function') {
      process.stdout._flush();
      if (forceLog) console.log('[PlatformUtils] stdout._flush() executed');
    }
    if (process.stderr && typeof process.stderr._flush === 'function') {
      process.stderr._flush();
      if (forceLog) console.log('[PlatformUtils] stderr._flush() executed');
    }

    // Method 2: Write empty string to trigger terminal flush (works in WSL)
    if (process.stdout && typeof process.stdout.write === 'function') {
      process.stdout.write('');
      if (forceLog) console.log('[PlatformUtils] stdout.write("") executed');
    }

    // Method 3: WSL-specific: Try to sync filesystem (may help with terminal display)
    if (isWSL() && process.platform === 'linux') {
      try {
        // Force a small delay to let Windows Terminal catch up
        process.nextTick(() => {
          if (process.stdout && typeof process.stdout.write === 'function') {
            process.stdout.write('\x1b[0m'); // Reset ANSI codes, can trigger display
          }
        });
        if (forceLog) console.log('[PlatformUtils] WSL-specific flush executed');
      } catch (_wslError) {
        // WSL-specific methods failed, continue with standard methods
      }
    }

  } catch (error) {
    if (forceLog) {
      console.log(`[PlatformUtils] Flush failed: ${error.message}`);
    }
    // Silent fail - this is a best-effort fix
  }
}

/**
 * Force filesystem sync in WSL environments
 * This helps ensure file writes are immediately visible
 * @param {boolean} [forceLog] - Whether to log sync attempts (for debugging)
 * @returns {Promise<void>}
 */
export async function forceFilesystemSync(forceLog = false) {
  if (!isWSL()) {
    if (forceLog) {
      console.log('[PlatformUtils] Skipping filesystem sync - not WSL environment');
    }
    return;
  }

  try {
    // Method 1: Use child_process to run sync command
    const { execSync } = await import('child_process');
    
    // Run sync command to flush filesystem buffers
    execSync('sync', { stdio: 'ignore' });
    
    if (forceLog) {
      console.log('[PlatformUtils] Filesystem sync executed successfully');
    }
  } catch (error) {
    if (forceLog) {
      console.log(`[PlatformUtils] Filesystem sync failed: ${error.message}`);
    }
    // Silent fail - this is a best-effort operation
  }
}

/**
 * Get WSL-optimized configuration for file operations
 * @returns {object} Configuration object with WSL-optimized settings
 */
export function getWSLOptimizedConfig() {
  if (!isWSL()) {
    // Return standard configuration for non-WSL environments
    return {
      writeBufferSize: 100,
      flushIntervalMs: 5000,
      useDirectFileHandles: false,
      immediateFlush: false
    };
  }

  // WSL-optimized configuration
  return {
    writeBufferSize: 10,        // Smaller buffer for more frequent writes
    flushIntervalMs: 1000,      // More frequent flush interval
    useDirectFileHandles: true, // Use file handles with explicit sync
    immediateFlush: true        // Flush immediately after each write
  };
}

export default {
  isWSL,
  shouldUseWindowsTerminalFlush,
  getPlatformDescription,
  forceTerminalFlush,
  forceFilesystemSync,
  getWSLOptimizedConfig,
};