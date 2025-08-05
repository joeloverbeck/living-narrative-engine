/**
 * @file Progress reporting system for build process
 * Provides visual feedback during build operations
 */

const { default: chalk } = require('chalk');
const ora = require('ora').default;

class BuildProgress {
  constructor() {
    this.steps = [];
    this.currentStep = null;
    this.startTime = Date.now();
    this.spinner = null;
    this.useSpinner = process.stdout.isTTY && !process.env.CI;
  }

  /**
   * Start a new build step
   *
   * @param {string} message - Step description
   */
  start(message) {
    this.currentStep = {
      message,
      startTime: Date.now(),
      status: 'running',
    };

    if (this.useSpinner) {
      this.spinner = ora({
        text: message,
        color: 'blue',
      }).start();
    } else {
      console.log(chalk.blue(`▶ ${message}...`));
    }
  }

  /**
   * Update current step message
   *
   * @param {string} message - Updated message
   */
  update(message) {
    if (this.spinner) {
      this.spinner.text = message;
    } else {
      console.log(chalk.gray(`  ${message}`));
    }
  }

  /**
   * Complete current step
   *
   * @param {string} message - Completion message
   */
  complete(message) {
    if (this.currentStep) {
      this.currentStep.endTime = Date.now();
      this.currentStep.status = 'completed';
      this.currentStep.duration =
        this.currentStep.endTime - this.currentStep.startTime;
      this.steps.push(this.currentStep);

      const duration = this.formatDuration(this.currentStep.duration);

      if (this.spinner) {
        this.spinner.succeed(`${message} ${chalk.gray(duration)}`);
        this.spinner = null;
      } else {
        console.log(chalk.green(`✓ ${message} ${chalk.gray(duration)}`));
      }
    }
  }

  /**
   * Mark current step as failed
   *
   * @param {string} message - Error message
   * @param {Error} [error] - Error object
   */
  error(message, error) {
    if (this.currentStep) {
      this.currentStep.endTime = Date.now();
      this.currentStep.status = 'failed';
      this.currentStep.duration =
        this.currentStep.endTime - this.currentStep.startTime;
      this.steps.push(this.currentStep);
    }

    if (this.spinner) {
      this.spinner.fail(chalk.red(message));
      this.spinner = null;
    } else {
      console.log(chalk.red(`✗ ${message}`));
    }

    if (error && error.message) {
      console.error(chalk.red(`  ${error.message}`));
    }
  }

  /**
   * Show warning message
   *
   * @param {string} message - Warning message
   */
  warn(message) {
    if (this.spinner) {
      // Temporarily pause spinner
      const currentText = this.spinner.text;
      this.spinner.stop();
      console.log(chalk.yellow(`⚠ ${message}`));
      this.spinner = ora({
        text: currentText,
        color: 'blue',
      }).start();
    } else {
      console.log(chalk.yellow(`⚠ ${message}`));
    }
  }

  /**
   * Show info message
   *
   * @param {string} message - Info message
   */
  info(message) {
    if (this.spinner) {
      // Temporarily pause spinner
      const currentText = this.spinner.text;
      this.spinner.stop();
      console.log(chalk.cyan(`ℹ ${message}`));
      this.spinner = ora({
        text: currentText,
        color: 'blue',
      }).start();
    } else {
      console.log(chalk.cyan(`ℹ ${message}`));
    }
  }

  /**
   * Display build summary
   */
  summary() {
    const totalTime = Date.now() - this.startTime;
    const successCount = this.steps.filter(
      (s) => s.status === 'completed'
    ).length;
    const failureCount = this.steps.filter((s) => s.status === 'failed').length;

    console.log(chalk.bold('\n📊 Build Summary:'));
    console.log(chalk.gray('─'.repeat(50)));

    // Time statistics
    console.log(
      `⏱  Total time: ${chalk.bold(this.formatDuration(totalTime))}`
    );
    console.log(
      `📋 Steps completed: ${chalk.green(successCount)} / ${this.steps.length}`
    );

    if (failureCount > 0) {
      console.log(`❌ Failed steps: ${chalk.red(failureCount)}`);
    }

    // Performance breakdown
    if (this.steps.length > 0) {
      console.log(chalk.gray('\n📈 Performance breakdown:'));
      const sortedSteps = [...this.steps]
        .filter((s) => s.status === 'completed')
        .sort((a, b) => b.duration - a.duration)
        .slice(0, 5);

      sortedSteps.forEach((step) => {
        const percentage = Math.round((step.duration / totalTime) * 100);
        const bar = this.createProgressBar(percentage, 20);
        console.log(`  ${step.message}`);
        console.log(
          `  ${bar} ${chalk.gray(`${this.formatDuration(step.duration)} (${percentage}%)`)}`
        );
      });
    }

    console.log(chalk.gray('─'.repeat(50)));
  }

  /**
   * Format duration in human-readable format
   *
   * @param {number} ms - Duration in milliseconds
   * @returns {string} Formatted duration
   */
  formatDuration(ms) {
    if (ms < 1000) {
      return `${ms}ms`;
    } else if (ms < 60000) {
      return `${(ms / 1000).toFixed(1)}s`;
    } else {
      const minutes = Math.floor(ms / 60000);
      const seconds = Math.floor((ms % 60000) / 1000);
      return `${minutes}m ${seconds}s`;
    }
  }

  /**
   * Create a visual progress bar
   *
   * @param {number} percentage - Percentage (0-100)
   * @param {number} width - Bar width in characters
   * @returns {string} Progress bar
   */
  createProgressBar(percentage, width) {
    const filled = Math.round((percentage / 100) * width);
    const empty = width - filled;
    return chalk.green('█'.repeat(filled)) + chalk.gray('░'.repeat(empty));
  }

  /**
   * Clean up any active spinners
   */
  cleanup() {
    if (this.spinner) {
      this.spinner.stop();
      this.spinner = null;
    }
  }
}

module.exports = BuildProgress;
