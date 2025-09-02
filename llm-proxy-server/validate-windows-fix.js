/**
 * @file Validate Windows Terminal Fix
 * @description Quick validation script to test Windows Terminal flush behavior
 * 
 * This script provides a simple test to verify:
 * 1. Windows and WSL platform detection is working
 * 2. Flush mechanisms are available and functional
 * 3. Enhanced console logger is working with Windows fixes
 * 
 * Run with: node validate-windows-fix.js
 */

import { isWSL, shouldUseWindowsTerminalFlush, getPlatformDescription, forceTerminalFlush } from './src/utils/platformUtils.js';

/**
 * Test Windows Terminal flush mechanisms
 */
async function validateWindowsFix() {
  console.log('=== Windows Terminal Fix Validation ===\n');
  
  // 1. Enhanced Platform Detection
  console.log('1. Platform Detection:');
  console.log(`   Base Platform: ${process.platform}`);
  console.log(`   WSL Environment: ${isWSL() ? '✓ Detected' : '✗ Not detected'}`);
  console.log(`   Platform Description: ${getPlatformDescription()}`);
  console.log(`   Should Use Windows Terminal Flush: ${shouldUseWindowsTerminalFlush() ? '✓ YES' : '✗ NO'}`);
  console.log(`   Node.js version: ${process.version}\n`);
  
  // 2. Stdout/stderr flush availability
  console.log('2. Flush Mechanism Availability:');
  console.log(`   process.stdout._flush: ${typeof process.stdout?._flush === 'function' ? '✓ Available' : '✗ Not available'}`);
  console.log(`   process.stderr._flush: ${typeof process.stderr?._flush === 'function' ? '✓ Available' : '✗ Not available'}`);
  console.log(`   process.stdout.write: ${typeof process.stdout?.write === 'function' ? '✓ Available' : '✗ Not available'}\n`);
  
  // 3. WSL-specific checks
  if (isWSL()) {
    console.log('3. WSL Environment Analysis:');
    console.log(`   WSL_DISTRO_NAME: ${process.env.WSL_DISTRO_NAME || 'Not set'}`);
    console.log(`   WSLENV: ${process.env.WSLENV || 'Not set'}`);
    console.log(`   WSL_INTEROP: ${process.env.WSL_INTEROP || 'Not set'}`);
    
    try {
      const { readFileSync } = await import('fs');
      const procVersion = readFileSync('/proc/version', 'utf8');
      console.log(`   /proc/version contains 'microsoft': ${procVersion.toLowerCase().includes('microsoft') ? '✓ Yes' : '✗ No'}`);
      console.log(`   /proc/version contains 'wsl': ${procVersion.toLowerCase().includes('wsl') ? '✓ Yes' : '✗ No'}`);
    } catch (error) {
      console.log(`   /proc/version check failed: ${error.message}`);
    }
    console.log('');
  }
  
  // 4. Test manual flush
  console.log(`${isWSL() ? '4' : '3'}. Manual Flush Test:`);
  if (shouldUseWindowsTerminalFlush()) {
    console.log('   Testing WSL-aware flush utility...');
    try {
      forceTerminalFlush(true); // Enable logging for this test
    } catch (error) {
      console.log(`   Manual flush failed: ${error.message}`);
    }
  } else {
    console.log('   Skipped (not Windows/WSL environment)');
  }
  
  console.log(`\n${isWSL() ? '5' : '4'}. Enhanced Console Logger Test:`);
  
  // Import and test enhanced console logger
  import('./src/logging/enhancedConsoleLogger.js')
    .then(({ getEnhancedConsoleLogger }) => {
      const logger = getEnhancedConsoleLogger();
      
      console.log('   Enhanced logger loaded: ✓');
      
      // Test different log levels with Windows flushing
      logger.info('Enhanced Windows fix validation - INFO level');
      logger.debug('Enhanced Windows fix validation - DEBUG level');
      logger.warn('Enhanced Windows fix validation - WARN level');
      
      console.log('\n=== Validation Complete ===');
      console.log('If you can see all messages above immediately, the Windows fix is working!');
      console.log('If messages only appear after Alt+Tab, there may be an issue.');
      
    })
    .catch((error) => {
      console.log(`   Failed to load enhanced logger: ${error.message}`);
      console.log('\n=== Validation Complete with Errors ===');
    });
}

// Run validation
validateWindowsFix();