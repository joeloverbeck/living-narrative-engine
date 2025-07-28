/**
 * @file Build output validation system
 * Ensures all expected files are present and valid
 */

const fs = require('fs-extra');
const path = require('path');
const chalk = require('chalk');

class BuildValidator {
  /**
   * Create a new BuildValidator instance
   *
   * @param {object} config - Build configuration
   */
  constructor(config) {
    this.config = config;
    this.requiredFiles = this.buildRequiredFilesList();
  }

  /**
   * Build list of all required output files
   *
   * @returns {Array<object>} List of required files with metadata
   */
  buildRequiredFilesList() {
    const files = [];

    // JavaScript bundles
    this.config.bundles.forEach((bundle) => {
      files.push({
        path: path.join(this.config.distDir, bundle.output),
        type: 'javascript',
        source: bundle.entry,
        critical: true,
      });

      // Sourcemaps (if enabled)
      if (this.config.esbuildOptions.sourcemap) {
        files.push({
          path: path.join(this.config.distDir, `${bundle.output}.map`),
          type: 'sourcemap',
          source: bundle.entry,
          critical: false,
        });
      }
    });

    // HTML files
    this.config.htmlFiles.forEach((htmlFile) => {
      files.push({
        path: path.join(this.config.distDir, htmlFile),
        type: 'html',
        source: htmlFile,
        critical: true,
      });
    });

    // Static directories
    this.config.staticDirs.forEach((dir) => {
      files.push({
        path: path.join(this.config.distDir, dir.target),
        type: 'directory',
        source: dir.source,
        critical: true,
      });
    });

    return files;
  }

  /**
   * Validate build output
   *
   * @returns {Promise<object>} Validation result
   */
  async validate() {
    const errors = [];
    const warnings = [];
    const stats = {
      totalFiles: 0,
      totalSize: 0,
      largestFile: null,
      smallestFile: null,
    };

    // Check required files
    for (const file of this.requiredFiles) {
      try {
        if (file.type === 'directory') {
          await this.validateDirectory(file, errors, warnings);
        } else {
          await this.validateFile(file, errors, warnings, stats);
        }
      } catch (error) {
        errors.push({
          type: 'validation_error',
          file: file.path,
          message: `Validation failed: ${error.message}`,
        });
      }
    }

    // Check for unexpected files (optional)
    await this.checkUnexpectedFiles(warnings);

    // Validate file sizes
    if (this.config.validation.checkEmptyFiles) {
      await this.validateFileSizes();
    }

    // Validate sourcemaps
    if (this.config.validation.checkSourcemaps) {
      await this.validateSourcemaps(errors, warnings);
    }

    return {
      success: errors.length === 0,
      errors,
      warnings,
      stats,
      summary: this.createSummary(errors, warnings, stats),
    };
  }

  /**
   * Validate a single file
   *
   * @param {object} fileSpec - File specification
   * @param {Array} errors - Error accumulator
   * @param {Array} warnings - Warning accumulator
   * @param {object} stats - Statistics accumulator
   */
  async validateFile(fileSpec, errors, warnings, stats) {
    const exists = await fs.pathExists(fileSpec.path);

    if (!exists) {
      if (fileSpec.critical) {
        errors.push({
          type: 'missing_file',
          file: fileSpec.path,
          source: fileSpec.source,
          message: `Required ${fileSpec.type} file missing`,
        });
      } else {
        warnings.push({
          type: 'missing_file',
          file: fileSpec.path,
          source: fileSpec.source,
          message: `Optional ${fileSpec.type} file missing`,
        });
      }
      return;
    }

    // Get file stats
    const fileStat = await fs.stat(fileSpec.path);
    stats.totalFiles++;
    stats.totalSize += fileStat.size;

    // Track largest/smallest files
    if (!stats.largestFile || fileStat.size > stats.largestFile.size) {
      stats.largestFile = {
        path: fileSpec.path,
        size: fileStat.size,
      };
    }
    if (!stats.smallestFile || fileStat.size < stats.smallestFile.size) {
      stats.smallestFile = {
        path: fileSpec.path,
        size: fileStat.size,
      };
    }

    // Check for empty files
    if (fileStat.size === 0) {
      errors.push({
        type: 'empty_file',
        file: fileSpec.path,
        source: fileSpec.source,
        message: `${fileSpec.type} file is empty`,
      });
    } else if (
      fileSpec.type === 'javascript' &&
      fileStat.size < this.config.validation.minFileSize
    ) {
      warnings.push({
        type: 'small_file',
        file: fileSpec.path,
        source: fileSpec.source,
        size: fileStat.size,
        message: `${fileSpec.type} file unusually small (${this.formatSize(fileStat.size)})`,
      });
    }
  }

  /**
   * Validate a directory
   *
   * @param {object} dirSpec - Directory specification
   * @param {Array} errors - Error accumulator
   * @param {Array} warnings - Warning accumulator
   */
  async validateDirectory(dirSpec, errors, warnings) {
    const exists = await fs.pathExists(dirSpec.path);

    if (!exists) {
      errors.push({
        type: 'missing_directory',
        file: dirSpec.path,
        source: dirSpec.source,
        message: `Required directory missing`,
      });
      return;
    }

    // Check if directory is empty
    const files = await fs.readdir(dirSpec.path);
    if (files.length === 0) {
      warnings.push({
        type: 'empty_directory',
        file: dirSpec.path,
        source: dirSpec.source,
        message: `Directory is empty`,
      });
    }
  }

  /**
   * Check for unexpected files in dist
   *
   * @param {Array} warnings - Warning accumulator
   */
  async checkUnexpectedFiles(warnings) {
    try {
      const distFiles = await this.getAllFiles(this.config.distDir);
      const expectedFiles = new Set(this.requiredFiles.map((f) => f.path));

      for (const file of distFiles) {
        if (!expectedFiles.has(file) && !this.isExpectedAsset(file)) {
          warnings.push({
            type: 'unexpected_file',
            file,
            message: 'Unexpected file in build output',
          });
        }
      }
    } catch {
      // Ignore errors in this optional check
    }
  }

  /**
   * Validate file sizes
   */
  async validateFileSizes() {
    // This is already handled in validateFile
    // Could add additional size checks here
  }

  /**
   * Validate sourcemaps
   *
   * @param {Array} errors - Error accumulator
   * @param {Array} warnings - Warning accumulator
   */
  async validateSourcemaps(errors, warnings) {
    if (!this.config.esbuildOptions.sourcemap) {
      return;
    }

    for (const bundle of this.config.bundles) {
      const jsPath = path.join(this.config.distDir, bundle.output);

      // Check if JS file references sourcemap
      try {
        const jsContent = await fs.readFile(jsPath, 'utf8');
        const hasSourceMapComment = jsContent.includes('//# sourceMappingURL=');

        if (!hasSourceMapComment) {
          warnings.push({
            type: 'missing_sourcemap_reference',
            file: jsPath,
            message: 'JavaScript file missing sourcemap reference',
          });
        }
      } catch {
        // File might not exist, which is already reported
      }
    }
  }

  /**
   * Check if a file is an expected asset
   *
   * @param {string} filePath - File path to check
   * @returns {boolean} True if file is expected
   */
  isExpectedAsset(filePath) {
    // Check against asset patterns
    const matchesPattern = this.config.assetPatterns.some((pattern) => {
      const regex = new RegExp(pattern.replace('*', '.*'));
      return regex.test(path.basename(filePath));
    });

    if (matchesPattern) {
      return true;
    }

    // Check if file is within a static directory
    return this.config.staticDirs.some((dir) => {
      const staticDirPath = path.join(this.config.distDir, dir.target);
      return filePath.startsWith(staticDirPath + path.sep);
    });
  }

  /**
   * Get all files in a directory recursively
   *
   * @param {string} dir - Directory path
   * @returns {Promise<Array<string>>} List of file paths
   */
  async getAllFiles(dir) {
    const files = [];
    const items = await fs.readdir(dir);

    for (const item of items) {
      const fullPath = path.join(dir, item);
      const stat = await fs.stat(fullPath);

      if (stat.isDirectory()) {
        const subFiles = await this.getAllFiles(fullPath);
        files.push(...subFiles);
      } else {
        files.push(fullPath);
      }
    }

    return files;
  }

  /**
   * Create validation summary
   *
   * @param {Array} errors - Validation errors
   * @param {Array} warnings - Validation warnings
   * @param {object} stats - Build statistics
   * @returns {string} Summary text
   */
  createSummary(errors, warnings, stats) {
    const lines = [];

    if (errors.length === 0) {
      lines.push(chalk.green('✓ Build validation passed'));
    } else {
      lines.push(
        chalk.red(`✗ Build validation failed with ${errors.length} error(s)`)
      );
    }

    if (warnings.length > 0) {
      lines.push(chalk.yellow(`⚠ ${warnings.length} warning(s)`));
    }

    lines.push(
      chalk.gray(
        `Files: ${stats.totalFiles}, Total size: ${this.formatSize(stats.totalSize)}`
      )
    );

    if (stats.largestFile) {
      lines.push(
        chalk.gray(
          `Largest: ${path.basename(stats.largestFile.path)} (${this.formatSize(stats.largestFile.size)})`
        )
      );
    }

    return lines.join('\n');
  }

  /**
   * Format file size
   *
   * @param {number} bytes - Size in bytes
   * @returns {string} Formatted size
   */
  formatSize(bytes) {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(1)} ${units[unitIndex]}`;
  }
}

module.exports = BuildValidator;
