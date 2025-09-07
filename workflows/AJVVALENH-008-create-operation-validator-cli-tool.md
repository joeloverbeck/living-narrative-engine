# AJVVALENH-008: Create Operation Validator CLI Tool

## Priority: 4 - Medium-Low

## Problem Statement
Developers need a quick way to validate individual operation files or batches of rule files without running the entire game engine. Currently, validation only happens during game startup, making it slow to iterate on rule development. A standalone CLI tool would enable rapid validation feedback during development.

## Current State
- Validation only occurs during game engine startup
- No standalone validation tool exists
- Developers must run the full game to check if operations are valid
- No batch validation capability for multiple files
- No way to validate operations in isolation

## Technical Requirements

### 1. CLI Tool Architecture

```javascript
#!/usr/bin/env node
// scripts/validate-operation.js

import { Command } from 'commander';
import { ValidationEngine } from '../src/validation/ValidationEngine.js';
import { SchemaRegistry } from '../src/validation/SchemaRegistry.js';
import chalk from 'chalk';
import glob from 'glob';
import fs from 'fs/promises';
import path from 'path';
import { performance } from 'perf_hooks';

class OperationValidatorCLI {
  constructor() {
    this.program = new Command();
    this.validationEngine = null;
    this.schemaRegistry = null;
    this.stats = {
      totalFiles: 0,
      validFiles: 0,
      invalidFiles: 0,
      errors: [],
      warnings: []
    };
  }
  
  async initialize() {
    // Load schemas and initialize validation engine
    this.schemaRegistry = new SchemaRegistry();
    await this.schemaRegistry.loadSchemas('./data/schemas');
    
    this.validationEngine = new ValidationEngine({
      schemaRegistry: this.schemaRegistry,
      enableTwoPhase: true,
      enablePreValidation: true,
      enableEnhancedErrors: true
    });
    
    this.setupCommands();
  }
  
  setupCommands() {
    this.program
      .name('validate-operation')
      .description('Validate Living Narrative Engine operation files')
      .version('1.0.0');
    
    // Validate single file
    this.program
      .command('file <path>')
      .description('Validate a single operation file')
      .option('-v, --verbose', 'Show detailed validation information')
      .option('-s, --schema <type>', 'Specify schema type', 'operation')
      .option('--json', 'Output results as JSON')
      .option('--fix', 'Attempt to fix common structural issues')
      .action(async (filePath, options) => {
        await this.validateFile(filePath, options);
      });
    
    // Validate multiple files
    this.program
      .command('batch <pattern>')
      .description('Validate multiple files matching a pattern')
      .option('-v, --verbose', 'Show detailed validation information')
      .option('-p, --parallel', 'Validate files in parallel')
      .option('--fail-fast', 'Stop on first validation error')
      .option('--json', 'Output results as JSON')
      .option('--summary', 'Show summary statistics')
      .action(async (pattern, options) => {
        await this.validateBatch(pattern, options);
      });
    
    // Validate directory
    this.program
      .command('dir <directory>')
      .description('Validate all operation files in a directory')
      .option('-r, --recursive', 'Include subdirectories')
      .option('-v, --verbose', 'Show detailed validation information')
      .option('--json', 'Output results as JSON')
      .option('--report <file>', 'Save report to file')
      .action(async (directory, options) => {
        await this.validateDirectory(directory, options);
      });
    
    // Interactive mode
    this.program
      .command('interactive')
      .description('Start interactive validation mode')
      .action(async () => {
        await this.startInteractiveMode();
      });
    
    // Watch mode
    this.program
      .command('watch <pattern>')
      .description('Watch files and validate on change')
      .option('-i, --interval <ms>', 'Poll interval', '1000')
      .action(async (pattern, options) => {
        await this.watchFiles(pattern, options);
      });
    
    // Schema info
    this.program
      .command('schema <operation-type>')
      .description('Show schema information for an operation type')
      .option('--example', 'Show example of valid operation')
      .option('--required', 'Show only required fields')
      .action(async (operationType, options) => {
        await this.showSchemaInfo(operationType, options);
      });
    
    // Lint mode
    this.program
      .command('lint <pattern>')
      .description('Lint operation files for best practices')
      .option('--fix', 'Attempt to fix issues')
      .option('--config <file>', 'Use custom lint configuration')
      .action(async (pattern, options) => {
        await this.lintFiles(pattern, options);
      });
  }
  
  async validateFile(filePath, options) {
    const startTime = performance.now();
    
    try {
      // Read file
      const content = await fs.readFile(filePath, 'utf8');
      const data = JSON.parse(content);
      
      // Apply fixes if requested
      if (options.fix) {
        const fixed = await this.applyFixes(data);
        if (fixed !== data) {
          await fs.writeFile(filePath, JSON.stringify(fixed, null, 2));
          console.log(chalk.yellow(`Fixed: ${filePath}`));
        }
      }
      
      // Validate
      const result = await this.validationEngine.validate(data, {
        schemaType: options.schema,
        filePath
      });
      
      const duration = (performance.now() - startTime).toFixed(2);
      
      // Display results
      if (options.json) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        this.displayResult(filePath, result, options.verbose, duration);
      }
      
      // Update stats
      this.stats.totalFiles++;
      if (result.valid) {
        this.stats.validFiles++;
      } else {
        this.stats.invalidFiles++;
        this.stats.errors.push({ file: filePath, errors: result.errors });
      }
      
      // Exit code
      process.exit(result.valid ? 0 : 1);
      
    } catch (error) {
      console.error(chalk.red(`Error validating ${filePath}:`), error.message);
      process.exit(1);
    }
  }
  
  async validateBatch(pattern, options) {
    const files = glob.sync(pattern);
    
    if (files.length === 0) {
      console.warn(chalk.yellow(`No files found matching: ${pattern}`));
      process.exit(0);
    }
    
    console.log(chalk.blue(`Validating ${files.length} files...\n`));
    
    const validateFn = async (file) => {
      try {
        const content = await fs.readFile(file, 'utf8');
        const data = JSON.parse(content);
        const result = await this.validationEngine.validate(data);
        
        return { file, result };
      } catch (error) {
        return { file, error: error.message };
      }
    };
    
    let results;
    if (options.parallel) {
      results = await Promise.all(files.map(validateFn));
    } else {
      results = [];
      for (const file of files) {
        const result = await validateFn(file);
        results.push(result);
        
        if (options.failFast && (result.error || !result.result?.valid)) {
          break;
        }
      }
    }
    
    // Process results
    results.forEach(({ file, result, error }) => {
      this.stats.totalFiles++;
      
      if (error) {
        console.error(chalk.red(`✗ ${file}: ${error}`));
        this.stats.invalidFiles++;
      } else if (result.valid) {
        console.log(chalk.green(`✓ ${file}`));
        this.stats.validFiles++;
      } else {
        console.log(chalk.red(`✗ ${file}: ${result.errors.length} errors`));
        this.stats.invalidFiles++;
        
        if (options.verbose) {
          result.errors.slice(0, 3).forEach(err => {
            console.log(`  ${err.path}: ${err.message}`);
          });
        }
      }
    });
    
    // Show summary
    if (options.summary || options.json) {
      this.showSummary(options.json);
    }
    
    process.exit(this.stats.invalidFiles > 0 ? 1 : 0);
  }
  
  displayResult(filePath, result, verbose, duration) {
    const fileName = path.basename(filePath);
    
    if (result.valid) {
      console.log(chalk.green(`✓ ${fileName} is valid`) + chalk.gray(` (${duration}ms)`));
    } else {
      console.log(chalk.red(`✗ ${fileName} is invalid`) + chalk.gray(` (${duration}ms)`));
      console.log(chalk.red(`  ${result.errors.length} error(s) found:\n`));
      
      const errorLimit = verbose ? result.errors.length : 5;
      result.errors.slice(0, errorLimit).forEach((error, index) => {
        console.log(chalk.red(`  ${index + 1}. ${error.path || 'root'}:`));
        console.log(`     ${error.message}`);
        
        if (error.hint) {
          console.log(chalk.yellow(`     Hint: ${error.hint}`));
        }
        
        if (error.fix && verbose) {
          console.log(chalk.cyan(`     Fix: ${error.fix.description}`));
        }
      });
      
      if (result.errors.length > errorLimit) {
        console.log(chalk.gray(`\n  ... and ${result.errors.length - errorLimit} more errors`));
      }
    }
    
    // Show warnings
    if (result.warnings && result.warnings.length > 0) {
      console.log(chalk.yellow(`\n  ${result.warnings.length} warning(s):`));
      result.warnings.slice(0, 3).forEach(warning => {
        console.log(chalk.yellow(`  ⚠ ${warning.message}`));
      });
    }
    
    // Show suggestions
    if (result.suggestions && result.suggestions.length > 0) {
      console.log(chalk.cyan('\n  Suggestions:'));
      result.suggestions.forEach(suggestion => {
        console.log(chalk.cyan(`  → ${suggestion}`));
      });
    }
  }
  
  showSummary(asJson) {
    const summary = {
      totalFiles: this.stats.totalFiles,
      valid: this.stats.validFiles,
      invalid: this.stats.invalidFiles,
      successRate: ((this.stats.validFiles / this.stats.totalFiles) * 100).toFixed(2) + '%',
      errors: this.stats.errors.length,
      warnings: this.stats.warnings.length
    };
    
    if (asJson) {
      console.log(JSON.stringify(summary, null, 2));
    } else {
      console.log(chalk.blue('\n═══ Validation Summary ═══'));
      console.log(`Total Files: ${summary.totalFiles}`);
      console.log(`Valid: ${chalk.green(summary.valid)}`);
      console.log(`Invalid: ${chalk.red(summary.invalid)}`);
      console.log(`Success Rate: ${summary.successRate}`);
      
      if (summary.errors > 0) {
        console.log(chalk.red(`\nTotal Errors: ${summary.errors}`));
      }
      
      if (summary.warnings > 0) {
        console.log(chalk.yellow(`Total Warnings: ${summary.warnings}`));
      }
    }
  }
}
```

### 2. Fix Suggestions and Auto-Fix

```javascript
// src/validation/OperationFixer.js
export class OperationFixer {
  constructor() {
    this.fixes = [
      new StructuralFix(),
      new TypeFix(),
      new CommonPatternFix()
    ];
  }
  
  async suggestFixes(data, errors) {
    const suggestions = [];
    
    for (const error of errors) {
      for (const fixer of this.fixes) {
        if (fixer.canFix(error)) {
          const suggestion = await fixer.suggest(data, error);
          if (suggestion) {
            suggestions.push(suggestion);
          }
        }
      }
    }
    
    return suggestions;
  }
  
  async applyFixes(data, errors) {
    let fixed = { ...data };
    let appliedFixes = [];
    
    for (const error of errors) {
      for (const fixer of this.fixes) {
        if (fixer.canFix(error)) {
          const result = await fixer.apply(fixed, error);
          if (result.success) {
            fixed = result.data;
            appliedFixes.push(result.description);
          }
        }
      }
    }
    
    return {
      data: fixed,
      applied: appliedFixes,
      success: appliedFixes.length > 0
    };
  }
}

class StructuralFix {
  canFix(error) {
    return error.message.includes('wrong nesting level') ||
           error.message.includes('should be inside parameters');
  }
  
  suggest(data, error) {
    if (data.type === 'IF' && (data.condition || data.then_actions)) {
      return {
        type: 'structural',
        description: 'Move condition and then_actions inside parameters',
        before: JSON.stringify({ condition: data.condition }, null, 2),
        after: JSON.stringify({ parameters: { condition: data.condition } }, null, 2)
      };
    }
    return null;
  }
  
  apply(data, error) {
    if (data.type === 'IF' && (data.condition || data.then_actions)) {
      const fixed = {
        type: data.type,
        parameters: {
          condition: data.condition,
          then_actions: data.then_actions,
          else_actions: data.else_actions
        }
      };
      
      // Remove from wrong level
      delete fixed.condition;
      delete fixed.then_actions;
      delete fixed.else_actions;
      
      return {
        success: true,
        data: fixed,
        description: 'Moved IF operation properties to correct nesting level'
      };
    }
    
    return { success: false };
  }
}
```

### 3. Interactive Mode

```javascript
// src/cli/InteractiveValidator.js
import inquirer from 'inquirer';
import chalk from 'chalk';

export class InteractiveValidator {
  constructor(validationEngine) {
    this.validationEngine = validationEngine;
    this.history = [];
  }
  
  async start() {
    console.log(chalk.blue('═══ Interactive Operation Validator ═══\n'));
    
    while (true) {
      const { action } = await inquirer.prompt([
        {
          type: 'list',
          name: 'action',
          message: 'What would you like to do?',
          choices: [
            'Validate a file',
            'Create new operation',
            'Fix existing operation',
            'Test operation type',
            'View schema documentation',
            'View validation history',
            'Exit'
          ]
        }
      ]);
      
      switch (action) {
        case 'Validate a file':
          await this.validateFileInteractive();
          break;
        case 'Create new operation':
          await this.createOperation();
          break;
        case 'Fix existing operation':
          await this.fixOperation();
          break;
        case 'Test operation type':
          await this.testOperationType();
          break;
        case 'View schema documentation':
          await this.viewSchemaDoc();
          break;
        case 'View validation history':
          this.viewHistory();
          break;
        case 'Exit':
          return;
      }
    }
  }
  
  async createOperation() {
    const { operationType } = await inquirer.prompt([
      {
        type: 'list',
        name: 'operationType',
        message: 'Select operation type:',
        choices: this.validationEngine.getOperationTypes()
      }
    ]);
    
    const template = this.validationEngine.getOperationTemplate(operationType);
    
    // Interactive field filling
    const operation = await this.fillTemplate(template, operationType);
    
    // Validate
    const result = await this.validationEngine.validate(operation);
    
    if (result.valid) {
      console.log(chalk.green('\n✓ Operation is valid!\n'));
      console.log(JSON.stringify(operation, null, 2));
      
      const { save } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'save',
          message: 'Save to file?',
          default: true
        }
      ]);
      
      if (save) {
        await this.saveOperation(operation);
      }
    } else {
      console.log(chalk.red('\n✗ Operation has errors:\n'));
      this.displayErrors(result.errors);
      
      const { fix } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'fix',
          message: 'Would you like to fix the errors?',
          default: true
        }
      ]);
      
      if (fix) {
        await this.fixOperationInteractive(operation, result.errors);
      }
    }
  }
}
```

### 4. Watch Mode

```javascript
// src/cli/WatchMode.js
import chokidar from 'chokidar';
import debounce from 'lodash/debounce';

export class WatchMode {
  constructor(validationEngine, options) {
    this.validationEngine = validationEngine;
    this.options = options;
    this.results = new Map();
  }
  
  async start(pattern) {
    console.log(chalk.blue(`Watching for changes in: ${pattern}\n`));
    
    const watcher = chokidar.watch(pattern, {
      persistent: true,
      ignoreInitial: false
    });
    
    const validateFile = debounce(async (filePath) => {
      console.log(chalk.gray(`\nValidating ${filePath}...`));
      
      try {
        const content = await fs.readFile(filePath, 'utf8');
        const data = JSON.parse(content);
        const result = await this.validationEngine.validate(data);
        
        const previousResult = this.results.get(filePath);
        this.results.set(filePath, result);
        
        // Show result
        if (result.valid) {
          console.log(chalk.green(`✓ ${filePath} is valid`));
          
          if (previousResult && !previousResult.valid) {
            console.log(chalk.green('  Fixed! Previous errors resolved.'));
          }
        } else {
          console.log(chalk.red(`✗ ${filePath} has ${result.errors.length} errors`));
          
          // Show first 3 errors
          result.errors.slice(0, 3).forEach(error => {
            console.log(chalk.red(`  • ${error.path}: ${error.message}`));
          });
          
          // Show what changed
          if (previousResult) {
            const diff = this.compareResults(previousResult, result);
            if (diff.newErrors.length > 0) {
              console.log(chalk.yellow(`  New errors: ${diff.newErrors.length}`));
            }
            if (diff.fixedErrors.length > 0) {
              console.log(chalk.green(`  Fixed: ${diff.fixedErrors.length}`));
            }
          }
        }
        
        // Show status bar
        this.updateStatusBar();
        
      } catch (error) {
        console.error(chalk.red(`Error: ${error.message}`));
      }
    }, 300);
    
    watcher
      .on('add', validateFile)
      .on('change', validateFile)
      .on('unlink', (path) => {
        this.results.delete(path);
        this.updateStatusBar();
      });
    
    // Handle exit
    process.on('SIGINT', () => {
      console.log(chalk.blue('\n\nStopping watch mode...'));
      watcher.close();
      process.exit(0);
    });
  }
  
  updateStatusBar() {
    const total = this.results.size;
    const valid = Array.from(this.results.values()).filter(r => r.valid).length;
    const invalid = total - valid;
    
    process.stdout.write(
      chalk.blue(`\n[Watch Mode] `) +
      `Files: ${total} | ` +
      chalk.green(`Valid: ${valid} `) +
      chalk.red(`Invalid: ${invalid} `) +
      `| Press Ctrl+C to exit\n`
    );
  }
}
```

### 5. Lint Mode

```javascript
// src/cli/OperationLinter.js
export class OperationLinter {
  constructor(config = {}) {
    this.rules = this.loadRules(config.rulesPath);
  }
  
  async lint(data, filePath) {
    const issues = [];
    
    for (const rule of this.rules) {
      if (rule.enabled) {
        const ruleIssues = await rule.check(data, filePath);
        issues.push(...ruleIssues);
      }
    }
    
    return {
      issues,
      fixable: issues.filter(i => i.fixable).length,
      errors: issues.filter(i => i.severity === 'error').length,
      warnings: issues.filter(i => i.severity === 'warning').length
    };
  }
  
  loadRules() {
    return [
      new EmptyActionsRule(),
      new AlwaysTrueConditionRule(),
      new DuplicateOperationRule(),
      new ComplexityRule(),
      new NamingConventionRule()
    ];
  }
}

class EmptyActionsRule {
  enabled = true;
  severity = 'warning';
  
  async check(data) {
    const issues = [];
    
    if (data.type === 'IF' && data.parameters?.then_actions?.length === 0) {
      issues.push({
        rule: 'empty-actions',
        severity: this.severity,
        message: 'IF operation has empty then_actions',
        path: 'parameters.then_actions',
        fixable: false
      });
    }
    
    return issues;
  }
}
```

## Success Criteria

### Functional Requirements
- [ ] CLI tool validates single files
- [ ] Batch validation works for multiple files
- [ ] Watch mode detects and validates changes
- [ ] Interactive mode guides operation creation
- [ ] Fix suggestions are accurate and helpful
- [ ] Auto-fix works for common issues

### Quality Requirements
- [ ] Tool starts in <1 second
- [ ] Validation completes in <100ms per file
- [ ] Clear, actionable error messages
- [ ] Helpful documentation and examples

## Test Requirements

### Unit Tests
- Test validation engine integration
- Test fix suggestion logic
- Test batch processing
- Test watch mode file detection

### Integration Tests
- Test with real operation files
- Test with invalid files
- Test fix application
- Test interactive flows

### End-to-End Tests
- Complete workflow tests
- Performance benchmarks
- Error handling scenarios

## Dependencies
- Requires validation engine to be modular
- Should work with enhanced error formatters
- Integrates with two-phase validation
- Uses schema registry

## Estimated Complexity
- **Effort**: 8-10 hours
- **Risk**: Low (standalone tool)
- **Testing**: 3-4 hours

## Implementation Notes

### Installation
```bash
npm install -g @living-narrative/validate-operation
# or
npm link  # for development
```

### Usage Examples
```bash
# Validate single file
validate-operation file data/mods/core/rules/entity_thought.rule.json

# Validate all rules in a mod
validate-operation batch "data/mods/*/rules/*.rule.json"

# Watch and validate on change
validate-operation watch "data/mods/**/*.rule.json"

# Interactive mode
validate-operation interactive

# Show schema for IF operation
validate-operation schema IF --example

# Lint with auto-fix
validate-operation lint "**/*.rule.json" --fix
```

## Definition of Done
- [ ] Core CLI tool implemented
- [ ] All commands functional
- [ ] Interactive mode complete
- [ ] Watch mode working
- [ ] Fix suggestions implemented
- [ ] Lint rules created
- [ ] Tests passing
- [ ] Documentation complete
- [ ] Published to npm (optional)

## Related Tickets
- AJVVALENH-003: Implement Pre-validation Type Checker
- AJVVALENH-006: Create Two-Phase Validation System
- AJVVALENH-007: Build Schema Validation Debugger

## Notes
This CLI tool will significantly improve the developer experience by providing instant validation feedback during rule development. It should be designed to be fast, helpful, and easy to use. The tool should integrate all the validation improvements from other tickets to provide the best possible experience.