# MODDEPVAL-006: Add Violation Detection and Reporting System

## Overview

Enhance the `ModCrossReferenceValidator` with advanced violation detection capabilities, detailed reporting mechanisms, and comprehensive error analysis. This builds on MODDEPVAL-005 to provide production-ready validation with actionable insights for developers.

## Background

The core validator from MODDEPVAL-005 provides basic violation detection. This ticket adds sophisticated analysis, detailed reporting, context-aware suggestions, and integration with development workflows.

**Enhanced capabilities needed:**
- File-level violation tracking with line numbers
- Context-aware violation analysis
- Automated fix suggestions
- Integration with existing error reporting infrastructure
- Performance metrics and validation statistics
- Support for different reporting formats (console, JSON, HTML)

## Technical Specifications

### Enhanced Violation Detection

```javascript
/**
 * Enhanced violation detection with detailed context tracking
 * @private
 * @param {string} modId - ID of mod being validated
 * @param {string} modPath - Path to mod directory  
 * @param {ModReferenceMap} references - Extracted mod references with context
 * @param {Set<string>} declaredDeps - Declared dependencies
 * @param {Map<string, Object>} manifestsMap - All mod manifests
 * @returns {Promise<CrossReferenceViolation[]>} List of detailed violations
 */
async #detectViolationsWithContext(modId, modPath, references, declaredDeps, manifestsMap) {
  const violations = [];
  const fileViolations = new Map(); // Track violations by file
  
  // Get detailed reference data with file context
  const detailedReferences = await this.#referenceExtractor.extractReferencesWithContext(modPath);
  
  for (const [referencedModId, componentRefs] of references) {
    // Skip self-references and declared dependencies
    if (referencedModId === modId || declaredDeps.has(referencedModId)) {
      continue;
    }
    
    // Verify referenced mod exists
    if (!manifestsMap.has(referencedModId)) {
      this.#logger.warn(`Referenced mod '${referencedModId}' not found in ecosystem`);
      continue;
    }
    
    // Create detailed violations for each component reference
    for (const componentId of componentRefs) {
      const contexts = detailedReferences.get(`${referencedModId}:${componentId}`) || [];
      
      if (contexts.length === 0) {
        // Fallback violation without file context
        const violation = this.#createBasicViolation(
          modId, referencedModId, componentId, declaredDeps
        );
        violations.push(violation);
      } else {
        // Create violation for each occurrence with full context
        for (const context of contexts) {
          const violation = await this.#createDetailedViolation(
            modId, modPath, referencedModId, componentId, context, declaredDeps, manifestsMap
          );
          violations.push(violation);
          
          // Track violations by file for reporting
          if (!fileViolations.has(context.file)) {
            fileViolations.set(context.file, []);
          }
          fileViolations.get(context.file).push(violation);
        }
      }
    }
  }
  
  // Enhance violations with additional analysis
  await this.#enhanceViolationsWithAnalysis(violations, manifestsMap);
  
  // Store file-level violation mapping for reporting
  this.#lastFileViolations = fileViolations;
  
  return violations;
}

/**
 * Creates a detailed violation with full context information
 * @private
 * @param {string} modId - Violating mod ID
 * @param {string} modPath - Path to mod directory
 * @param {string} referencedModId - Referenced mod ID
 * @param {string} componentId - Referenced component ID
 * @param {Object} context - Reference context from extractor
 * @param {string[]} declaredDeps - List of declared dependencies
 * @param {Map<string, Object>} manifestsMap - All mod manifests
 * @returns {Promise<CrossReferenceViolation>} Detailed violation object
 */
async #createDetailedViolation(modId, modPath, referencedModId, componentId, context, declaredDeps, manifestsMap) {
  const violation = {
    violatingMod: modId,
    referencedMod: referencedModId,
    referencedComponent: componentId,
    file: path.relative(modPath, context.file),
    line: context.line,
    column: context.column,
    context: context.context,
    contextType: context.type, // e.g., 'action', 'rule', 'scope'
    message: `Mod '${modId}' references '${referencedModId}:${componentId}' but doesn't declare '${referencedModId}' as a dependency`,
    declaredDependencies: [...declaredDeps],
    
    // Enhanced analysis
    severity: this.#calculateViolationSeverity(context, referencedModId, manifestsMap),
    impact: this.#analyzeViolationImpact(context, referencedModId, componentId),
    suggestedFixes: await this.#generateSuggestedFixes(modId, referencedModId, context, manifestsMap),
    relatedViolations: [], // Will be populated by analysis phase
    
    // Metadata for tooling
    metadata: {
      extractionTimestamp: new Date().toISOString(),
      validatorVersion: this.#getValidatorVersion(),
      ruleApplied: 'cross-reference-dependency-check'
    }
  };
  
  return violation;
}

/**
 * Calculates violation severity based on context and dependency relationships
 * @private
 * @param {Object} context - Reference context
 * @param {string} referencedModId - Referenced mod ID
 * @param {Map<string, Object>} manifestsMap - All mod manifests
 * @returns {string} Severity level: 'critical', 'high', 'medium', 'low'
 */
#calculateViolationSeverity(context, referencedModId, manifestsMap) {
  // Critical: References in core system files or blocking operations
  if (context.type === 'rule' || context.contextType === 'blocking_operation') {
    return 'critical';
  }
  
  // High: References in actions or conditions that affect gameplay
  if (context.type === 'action' || context.type === 'condition') {
    return 'high';
  }
  
  // Medium: References in components or configuration
  if (context.type === 'component' || context.type === 'scope') {
    return 'medium';
  }
  
  // Low: References in metadata or optional features
  return 'low';
}

/**
 * Analyzes the potential impact of a violation
 * @private
 * @param {Object} context - Reference context
 * @param {string} referencedModId - Referenced mod ID
 * @param {string} componentId - Referenced component ID
 * @returns {Object} Impact analysis
 */
#analyzeViolationImpact(context, referencedModId, componentId) {
  return {
    loadingFailure: this.#assessLoadingFailureRisk(context, referencedModId),
    runtimeFailure: this.#assessRuntimeFailureRisk(context, componentId),
    dataInconsistency: this.#assessDataInconsistencyRisk(context),
    userExperience: this.#assessUserExperienceImpact(context)
  };
}

/**
 * Generates context-aware fix suggestions
 * @private
 * @param {string} modId - Violating mod ID
 * @param {string} referencedModId - Referenced mod ID
 * @param {Object} context - Reference context
 * @param {Map<string, Object>} manifestsMap - All mod manifests
 * @returns {Promise<Object[]>} Array of suggested fixes
 */
async #generateSuggestedFixes(modId, referencedModId, context, manifestsMap) {
  const fixes = [];
  
  // Primary fix: Add dependency
  const referencedManifest = manifestsMap.get(referencedModId);
  if (referencedManifest) {
    fixes.push({
      type: 'add_dependency',
      priority: 'primary',
      description: `Add "${referencedModId}" to dependencies in mod-manifest.json`,
      implementation: {
        file: 'mod-manifest.json',
        change: {
          path: ['dependencies'],
          action: 'append',
          value: {
            id: referencedModId,
            version: referencedManifest.version || '^1.0.0'
          }
        }
      },
      estimatedEffort: 'low',
      riskLevel: 'low'
    });
  }
  
  // Alternative fix: Remove reference if possible
  if (this.#canRemoveReference(context)) {
    fixes.push({
      type: 'remove_reference',
      priority: 'alternative',
      description: `Remove reference to ${referencedModId}:${componentId}`,
      implementation: {
        file: context.file,
        change: {
          line: context.line,
          action: 'remove_or_replace',
          suggestions: await this.#generateRemovalSuggestions(context)
        }
      },
      estimatedEffort: 'medium',
      riskLevel: 'medium'
    });
  }
  
  // Advanced fix: Create abstraction
  if (this.#shouldSuggestAbstraction(context, referencedModId)) {
    fixes.push({
      type: 'create_abstraction',
      priority: 'advanced',
      description: `Create local abstraction to avoid direct dependency`,
      implementation: {
        steps: [
          'Create local component equivalent',
          'Update references to use local component',
          'Document relationship for future maintainers'
        ]
      },
      estimatedEffort: 'high',
      riskLevel: 'medium'
    });
  }
  
  return fixes;
}

/**
 * Enhances violations with cross-violation analysis
 * @private
 * @param {CrossReferenceViolation[]} violations - List of violations
 * @param {Map<string, Object>} manifestsMap - All mod manifests
 */
async #enhanceViolationsWithAnalysis(violations, manifestsMap) {
  // Group violations by referenced mod
  const violationsByMod = new Map();
  violations.forEach(violation => {
    if (!violationsByMod.has(violation.referencedMod)) {
      violationsByMod.set(violation.referencedMod, []);
    }
    violationsByMod.get(violation.referencedMod).push(violation);
  });
  
  // Analyze patterns and relationships
  for (const [referencedMod, modViolations] of violationsByMod) {
    await this.#analyzeViolationPattern(modViolations, referencedMod, manifestsMap);
  }
  
  // Add circular dependency detection
  await this.#detectCircularDependencyRisks(violations, manifestsMap);
  
  // Add impact scoring
  this.#calculateViolationImpactScores(violations);
}

/**
 * Analyzes violation patterns for a specific referenced mod
 * @private
 * @param {CrossReferenceViolation[]} violations - Violations for specific mod
 * @param {string} referencedMod - Referenced mod ID
 * @param {Map<string, Object>} manifestsMap - All mod manifests
 */
async #analyzeViolationPattern(violations, referencedMod, manifestsMap) {
  const pattern = {
    totalViolations: violations.length,
    fileTypes: new Set(violations.map(v => v.contextType)),
    components: new Set(violations.map(v => v.referencedComponent)),
    severity: this.#calculatePatternSeverity(violations)
  };
  
  // Add pattern analysis to each violation
  violations.forEach(violation => {
    violation.pattern = pattern;
    violation.isPartOfLargerIssue = pattern.totalViolations > 3;
    violation.suggestedPriority = this.#calculateSuggestedPriority(violation, pattern);
  });
}
```

### Enhanced Reporting System

```javascript
/**
 * Enhanced reporting system with multiple output formats
 */
class ViolationReporter {
  #logger;
  
  constructor(logger) {
    this.#logger = logger;
  }
  
  /**
   * Generates report in specified format
   * @param {ValidationReport|Map<string, ValidationReport>} data - Validation results
   * @param {string} format - Output format: 'console', 'json', 'html', 'markdown'
   * @param {Object} options - Formatting options
   * @returns {string} Formatted report
   */
  generateReport(data, format = 'console', options = {}) {
    switch (format.toLowerCase()) {
      case 'console':
        return this.#generateConsoleReport(data, options);
      case 'json':
        return this.#generateJsonReport(data, options);
      case 'html':
        return this.#generateHtmlReport(data, options);
      case 'markdown':
        return this.#generateMarkdownReport(data, options);
      case 'junit':
        return this.#generateJUnitReport(data, options);
      default:
        throw new Error(`Unsupported report format: ${format}`);
    }
  }
  
  /**
   * Generates enhanced console report with colors and formatting
   * @private
   * @param {ValidationReport|Map<string, ValidationReport>} data - Validation results
   * @param {Object} options - Console formatting options
   * @returns {string} Console-formatted report
   */
  #generateConsoleReport(data, options = {}) {
    const { colors = true, verbose = false, showSuggestions = true } = options;
    const lines = [];
    
    // Color codes for console output
    const colors_codes = colors ? {
      red: '\x1b[31m',
      green: '\x1b[32m',
      yellow: '\x1b[33m',
      blue: '\x1b[34m',
      magenta: '\x1b[35m',
      cyan: '\x1b[36m',
      white: '\x1b[37m',
      reset: '\x1b[0m',
      bold: '\x1b[1m'
    } : {};
    
    const c = (color, text) => colors ? `${colors_codes[color] || ''}${text}${colors_codes.reset}` : text;
    
    if (data instanceof Map) {
      return this.#generateEcosystemConsoleReport(data, c, verbose, showSuggestions);
    }
    
    // Single mod report
    lines.push(c('bold', `Cross-Reference Validation Report for '${data.modId}'`));
    lines.push('='.repeat(50));
    lines.push('');
    
    if (!data.hasViolations) {
      lines.push(c('green', '✅ No cross-reference violations detected'));
      if (verbose) {
        lines.push('');
        lines.push('Summary:');
        lines.push(`  • References to ${data.referencedMods.length} mods`);
        lines.push(`  • ${data.summary.totalReferences} total component references`);
        lines.push(`  • All references properly declared as dependencies`);
      }
      return lines.join('\n');
    }
    
    // Violations found
    lines.push(c('red', `❌ ${data.violations.length} cross-reference violations detected`));
    lines.push('');
    
    // Group violations by severity
    const violationsBySeverity = this.#groupViolationsBySeverity(data.violations);
    
    ['critical', 'high', 'medium', 'low'].forEach(severity => {
      const severityViolations = violationsBySeverity.get(severity) || [];
      if (severityViolations.length === 0) return;
      
      const severityColor = {
        critical: 'red',
        high: 'yellow',
        medium: 'blue',
        low: 'cyan'
      }[severity];
      
      lines.push(c('bold', `${severity.toUpperCase()} Priority (${severityViolations.length} violations):`));
      
      severityViolations.forEach(violation => {
        lines.push(c(severityColor, `  ❌ ${violation.referencedMod}:${violation.referencedComponent}`));
        lines.push(`     File: ${violation.file}${violation.line ? `:${violation.line}` : ''}`);
        lines.push(`     Context: ${violation.context}`);
        
        if (verbose && violation.impact) {
          lines.push(`     Impact: ${this.#formatImpactSummary(violation.impact)}`);
        }
        
        if (showSuggestions && violation.suggestedFixes && violation.suggestedFixes.length > 0) {
          const primaryFix = violation.suggestedFixes.find(f => f.priority === 'primary');
          if (primaryFix) {
            lines.push(c('green', `     💡 ${primaryFix.description}`));
          }
        }
        lines.push('');
      });
    });
    
    // Summary section
    lines.push(c('bold', 'Summary:'));
    lines.push(`  • Total violations: ${data.violations.length}`);
    lines.push(`  • Missing dependencies: ${data.missingDependencies.join(', ')}`);
    lines.push(`  • Referenced mods: ${data.referencedMods.length}`);
    
    if (showSuggestions) {
      lines.push('');
      lines.push(c('bold', 'Next Steps:'));
      lines.push('1. Review mod-manifest.json and add missing dependencies');
      lines.push('2. Focus on Critical and High priority violations first');
      lines.push('3. Consider architectural improvements for repeated violations');
      lines.push('4. Re-run validation after making changes');
    }
    
    return lines.join('\n');
  }
  
  /**
   * Generates structured JSON report for tooling integration
   * @private
   * @param {ValidationReport|Map<string, ValidationReport>} data - Validation results
   * @param {Object} options - JSON formatting options
   * @returns {string} JSON-formatted report
   */
  #generateJsonReport(data, options = {}) {
    const { pretty = false, includeMetadata = true } = options;
    
    const reportData = {
      timestamp: new Date().toISOString(),
      validatorVersion: this.#getValidatorVersion(),
      reportFormat: 'json',
      ...(includeMetadata && { metadata: this.#generateReportMetadata(data) })
    };
    
    if (data instanceof Map) {
      reportData.type = 'ecosystem';
      reportData.mods = {};
      data.forEach((report, modId) => {
        reportData.mods[modId] = this.#sanitizeReportForJson(report);
      });
      reportData.summary = this.#generateEcosystemSummary(data);
    } else {
      reportData.type = 'single-mod';
      reportData.mod = this.#sanitizeReportForJson(data);
    }
    
    return JSON.stringify(reportData, null, pretty ? 2 : 0);
  }
  
  /**
   * Generates HTML report with interactive features
   * @private
   * @param {ValidationReport|Map<string, ValidationReport>} data - Validation results
   * @param {Object} options - HTML formatting options
   * @returns {string} HTML-formatted report
   */
  #generateHtmlReport(data, options = {}) {
    const { 
      includeStyles = true, 
      includeScript = true, 
      title = 'Cross-Reference Validation Report' 
    } = options;
    
    const html = [];
    
    html.push('<!DOCTYPE html>');
    html.push('<html lang="en">');
    html.push('<head>');
    html.push(`<title>${title}</title>`);
    html.push('<meta charset="UTF-8">');
    html.push('<meta name="viewport" content="width=device-width, initial-scale=1.0">');
    
    if (includeStyles) {
      html.push('<style>');
      html.push(this.#generateHtmlStyles());
      html.push('</style>');
    }
    
    html.push('</head>');
    html.push('<body>');
    
    html.push(`<h1>${title}</h1>`);
    html.push(`<div class="timestamp">Generated: ${new Date().toLocaleString()}</div>`);
    
    if (data instanceof Map) {
      html.push(this.#generateEcosystemHtmlContent(data));
    } else {
      html.push(this.#generateSingleModHtmlContent(data));
    }
    
    if (includeScript) {
      html.push('<script>');
      html.push(this.#generateHtmlScript());
      html.push('</script>');
    }
    
    html.push('</body>');
    html.push('</html>');
    
    return html.join('\n');
  }
  
  /**
   * Generates Markdown report for documentation
   * @private
   * @param {ValidationReport|Map<string, ValidationReport>} data - Validation results
   * @param {Object} options - Markdown formatting options
   * @returns {string} Markdown-formatted report
   */
  #generateMarkdownReport(data, options = {}) {
    const { includeToC = true, detailLevel = 'full' } = options;
    const lines = [];
    
    lines.push('# Cross-Reference Validation Report');
    lines.push('');
    lines.push(`**Generated:** ${new Date().toISOString()}`);
    lines.push('');
    
    if (data instanceof Map) {
      const totalViolations = Array.from(data.values())
        .reduce((sum, report) => sum + report.violations.length, 0);
      
      lines.push('## Summary');
      lines.push('');
      lines.push(`- **Total Mods Validated:** ${data.size}`);
      lines.push(`- **Total Violations:** ${totalViolations}`);
      lines.push(`- **Mods with Violations:** ${Array.from(data.values()).filter(r => r.hasViolations).length}`);
      lines.push('');
      
      if (includeToC) {
        lines.push('## Table of Contents');
        lines.push('');
        Array.from(data.keys()).forEach(modId => {
          const report = data.get(modId);
          const status = report.hasViolations ? '❌' : '✅';
          lines.push(`- [${status} ${modId}](#${modId.toLowerCase().replace(/[^a-z0-9]/g, '-')})`);
        });
        lines.push('');
      }
      
      // Individual mod sections
      data.forEach((report, modId) => {
        lines.push(`## ${modId}`);
        lines.push('');
        lines.push(...this.#generateMarkdownModSection(report, detailLevel));
        lines.push('');
      });
      
    } else {
      lines.push(...this.#generateMarkdownModSection(data, detailLevel));
    }
    
    return lines.join('\n');
  }
  
  /**
   * Generates JUnit XML report for CI/CD integration
   * @private
   * @param {ValidationReport|Map<string, ValidationReport>} data - Validation results
   * @param {Object} options - JUnit formatting options
   * @returns {string} JUnit XML-formatted report
   */
  #generateJUnitReport(data, options = {}) {
    const { suiteName = 'CrossReferenceValidation' } = options;
    const xml = [];
    
    xml.push('<?xml version="1.0" encoding="UTF-8"?>');
    
    if (data instanceof Map) {
      const totalTests = data.size;
      const failures = Array.from(data.values()).filter(r => r.hasViolations).length;
      const totalTime = 0; // TODO: Track actual validation time
      
      xml.push(`<testsuite name="${suiteName}" tests="${totalTests}" failures="${failures}" time="${totalTime}">`);
      
      data.forEach((report, modId) => {
        xml.push(`  <testcase name="${modId}" classname="${suiteName}">`);
        
        if (report.hasViolations) {
          const message = `${report.violations.length} cross-reference violations detected`;
          const details = report.violations.map(v => 
            `${v.file}:${v.line || '?'} - ${v.message}`
          ).join('\n');
          
          xml.push(`    <failure message="${this.#escapeXml(message)}">`);
          xml.push(`      <![CDATA[${details}]]>`);
          xml.push(`    </failure>`);
        }
        
        xml.push(`  </testcase>`);
      });
      
      xml.push('</testsuite>');
    } else {
      xml.push(`<testsuite name="${suiteName}" tests="1" failures="${data.hasViolations ? 1 : 0}" time="0">`);
      xml.push(`  <testcase name="${data.modId}" classname="${suiteName}">`);
      
      if (data.hasViolations) {
        const message = `${data.violations.length} cross-reference violations detected`;
        const details = data.violations.map(v => 
          `${v.file}:${v.line || '?'} - ${v.message}`
        ).join('\n');
        
        xml.push(`    <failure message="${this.#escapeXml(message)}">`);
        xml.push(`      <![CDATA[${details}]]>`);
        xml.push(`    </failure>`);
      }
      
      xml.push(`  </testcase>`);
      xml.push('</testsuite>');
    }
    
    return xml.join('\n');
  }
  
  /**
   * Helper method to group violations by severity
   * @private
   * @param {CrossReferenceViolation[]} violations - List of violations
   * @returns {Map<string, CrossReferenceViolation[]>} Violations grouped by severity
   */
  #groupViolationsBySeverity(violations) {
    const groups = new Map();
    
    violations.forEach(violation => {
      const severity = violation.severity || 'medium';
      if (!groups.has(severity)) {
        groups.set(severity, []);
      }
      groups.get(severity).push(violation);
    });
    
    return groups;
  }
  
  // Additional helper methods for report formatting...
  #formatImpactSummary(impact) {
    const impacts = [];
    if (impact.loadingFailure === 'high') impacts.push('Loading Risk');
    if (impact.runtimeFailure === 'high') impacts.push('Runtime Risk');
    if (impact.dataInconsistency === 'high') impacts.push('Data Risk');
    if (impact.userExperience === 'high') impacts.push('UX Impact');
    return impacts.length > 0 ? impacts.join(', ') : 'Low Impact';
  }
  
  #escapeXml(text) {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
}
```

### Performance Monitoring and Statistics

```javascript
/**
 * Performance monitoring and validation statistics
 */
class ValidationStatistics {
  constructor() {
    this.startTime = null;
    this.endTime = null;
    this.metrics = new Map();
  }
  
  startValidation() {
    this.startTime = performance.now();
  }
  
  endValidation() {
    this.endTime = performance.now();
  }
  
  recordMetric(name, value) {
    this.metrics.set(name, value);
  }
  
  getExecutionTime() {
    if (!this.startTime || !this.endTime) {
      return null;
    }
    return this.endTime - this.startTime;
  }
  
  generatePerformanceReport() {
    const report = {
      executionTime: this.getExecutionTime(),
      timestamp: new Date().toISOString(),
      metrics: Object.fromEntries(this.metrics)
    };
    
    return report;
  }
}

// Integration with validator
class ModCrossReferenceValidator {
  // ... existing code ...
  
  async validateModReferences(modPath, manifestsMap) {
    const stats = new ValidationStatistics();
    stats.startValidation();
    
    try {
      // ... existing validation logic ...
      
      stats.recordMetric('filesProcessed', fileCount);
      stats.recordMetric('referencesExtracted', referenceCount);
      stats.recordMetric('violationsDetected', violations.length);
      
      stats.endValidation();
      
      // Add performance data to report
      report.performance = stats.generatePerformanceReport();
      
      return report;
    } catch (error) {
      stats.endValidation();
      throw error;
    }
  }
}
```

## Integration Points

### CLI Integration

```javascript
// scripts/validateModReferences.js - New CLI tool

import { container } from '../src/dependencyInjection/container.js';
import { tokens } from '../src/dependencyInjection/tokens/tokens-core.js';
import { ViolationReporter } from '../src/validation/violationReporter.js';

async function main() {
  const args = process.argv.slice(2);
  const options = parseCommandLineArgs(args);
  
  try {
    const validator = container.resolve(tokens.IModCrossReferenceValidator);
    const manifestLoader = container.resolve(tokens.IModManifestLoader);
    
    // Load all manifests
    const manifestsMap = await manifestLoader.loadAllManifests();
    
    // Run validation
    const results = options.modId 
      ? await validator.validateModReferences(options.modPath, manifestsMap)
      : await validator.validateAllModReferences(manifestsMap);
    
    // Generate report
    const reporter = new ViolationReporter(container.resolve(tokens.ILogger));
    const report = reporter.generateReport(results, options.format, options);
    
    if (options.output) {
      await fs.writeFile(options.output, report);
      console.log(`Report written to: ${options.output}`);
    } else {
      console.log(report);
    }
    
    // Exit with error code if violations found
    const hasViolations = results instanceof Map 
      ? Array.from(results.values()).some(r => r.hasViolations)
      : results.hasViolations;
    
    process.exit(hasViolations ? 1 : 0);
    
  } catch (error) {
    console.error('Validation failed:', error.message);
    process.exit(2);
  }
}

function parseCommandLineArgs(args) {
  // Command line argument parsing logic
  return {
    modId: args.find(a => a.startsWith('--mod='))?.split('=')[1],
    format: args.find(a => a.startsWith('--format='))?.split('=')[1] || 'console',
    output: args.find(a => a.startsWith('--output='))?.split('=')[1],
    verbose: args.includes('--verbose'),
    showSuggestions: !args.includes('--no-suggestions')
  };
}

if (require.main === module) {
  main();
}
```

### Package.json Scripts

```json
{
  "scripts": {
    "validate:cross-references": "node scripts/validateModReferences.js",
    "validate:mod": "node scripts/validateModReferences.js --mod=",
    "validate:json": "node scripts/validateModReferences.js --format=json",
    "validate:html": "node scripts/validateModReferences.js --format=html --output=validation-report.html"
  }
}
```

## Testing Requirements

### Enhanced Testing Structure

```javascript
// tests/unit/validation/violationDetection.test.js

describe('Enhanced Violation Detection', () => {
  describe('Context-Aware Detection', () => {
    it('should detect violations with file and line context', async () => {
      const mockExtractor = testBed.createMock('referenceExtractor', [
        'extractReferencesWithContext'
      ]);
      
      mockExtractor.extractReferencesWithContext.mockResolvedValue(new Map([
        ['intimacy:kissing', [{
          file: '/test/actions/turn_around.action.json',
          line: 17,
          column: 8,
          context: 'forbidden_components.actor',
          type: 'action'
        }]]
      ]));
      
      const violations = await validator.#detectViolationsWithContext(
        'positioning', '/test/positioning', mockReferences, mockDeps, manifestsMap
      );
      
      expect(violations[0].file).toBe('actions/turn_around.action.json');
      expect(violations[0].line).toBe(17);
      expect(violations[0].context).toBe('forbidden_components.actor');
    });

    it('should calculate appropriate violation severity', () => {
      const context = { type: 'action', contextType: 'blocking_operation' };
      const severity = validator.#calculateViolationSeverity(context, 'intimacy', manifestsMap);
      
      expect(severity).toBe('critical');
    });
  });

  describe('Suggested Fixes', () => {
    it('should generate primary fix suggestion', async () => {
      const fixes = await validator.#generateSuggestedFixes(
        'positioning', 'intimacy', mockContext, manifestsMap
      );
      
      const primaryFix = fixes.find(f => f.priority === 'primary');
      expect(primaryFix.type).toBe('add_dependency');
      expect(primaryFix.description).toContain('Add "intimacy" to dependencies');
    });

    it('should suggest alternative fixes when appropriate', async () => {
      const removableContext = { 
        type: 'action', 
        contextType: 'optional_component',
        removable: true 
      };
      
      const fixes = await validator.#generateSuggestedFixes(
        'positioning', 'intimacy', removableContext, manifestsMap
      );
      
      expect(fixes.some(f => f.type === 'remove_reference')).toBe(true);
    });
  });
});

// tests/unit/validation/violationReporter.test.js

describe('Violation Reporter', () => {
  describe('Console Report Generation', () => {
    it('should generate colored console output', () => {
      const report = reporter.generateReport(mockValidationReport, 'console', {
        colors: true,
        showSuggestions: true
      });
      
      expect(report).toContain('\x1b[31m'); // Red color code
      expect(report).toContain('💡'); // Suggestion emoji
    });

    it('should handle no-color mode', () => {
      const report = reporter.generateReport(mockValidationReport, 'console', {
        colors: false
      });
      
      expect(report).not.toContain('\x1b['); // No ANSI codes
    });
  });

  describe('JSON Report Generation', () => {
    it('should generate valid JSON', () => {
      const report = reporter.generateReport(mockValidationReport, 'json');
      
      expect(() => JSON.parse(report)).not.toThrow();
    });

    it('should include metadata when requested', () => {
      const report = reporter.generateReport(mockValidationReport, 'json', {
        includeMetadata: true
      });
      
      const parsed = JSON.parse(report);
      expect(parsed.metadata).toBeDefined();
      expect(parsed.timestamp).toBeDefined();
    });
  });

  describe('HTML Report Generation', () => {
    it('should generate valid HTML', () => {
      const report = reporter.generateReport(mockValidationReport, 'html');
      
      expect(report).toContain('<!DOCTYPE html>');
      expect(report).toContain('</html>');
    });

    it('should include interactive features when enabled', () => {
      const report = reporter.generateReport(mockValidationReport, 'html', {
        includeScript: true
      });
      
      expect(report).toContain('<script>');
    });
  });
});
```

## Success Criteria

- [ ] Enhanced violation detection tracks file locations and line numbers
- [ ] Context-aware violation analysis calculates appropriate severity levels
- [ ] Automated fix suggestions provide actionable guidance
- [ ] Multiple report formats support different use cases (console, JSON, HTML, Markdown, JUnit)
- [ ] Performance monitoring tracks validation statistics
- [ ] CLI integration provides command-line access to validation
- [ ] Integration with existing infrastructure maintains consistency
- [ ] Comprehensive test coverage validates all reporting functionality
- [ ] Real-world violation scenarios handled correctly
- [ ] Documentation provides clear usage guidance

## Implementation Notes

### Performance Considerations
- **Lazy loading**: Only generate detailed context when violations are found
- **Report caching**: Cache generated reports for repeated access
- **Streaming output**: Support streaming for large reports
- **Memory management**: Clean up large data structures after reporting

### Extensibility Design
- **Plugin architecture**: Support custom report formats
- **Rule configuration**: Allow customization of violation rules
- **Integration hooks**: Provide hooks for IDE and CI/CD integration
- **Custom analyzers**: Support additional analysis passes

### User Experience Focus
- **Clear messaging**: Provide actionable error messages
- **Progressive disclosure**: Show summary by default, details on request
- **Interactive features**: HTML reports with filtering and sorting
- **Integration guidance**: Clear instructions for CI/CD setup

## Next Steps

After completion:
1. **MODDEPVAL-007**: Complete integration with existing ModDependencyValidator
2. **CLI testing**: Validate command-line interface with real scenarios
3. **CI/CD integration**: Add to build pipeline for continuous validation

## References

- **Existing error patterns**: `src/errors/modDependencyError.js`
- **CLI patterns**: Existing scripts in `scripts/` directory
- **Report formatting**: Industry standards for validation reports
- **Testing patterns**: `tests/common/testBed.js` for test utilities