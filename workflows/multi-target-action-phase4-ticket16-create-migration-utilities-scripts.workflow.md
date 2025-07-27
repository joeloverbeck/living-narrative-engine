# Ticket 16: Create Migration Utilities and Scripts

## Overview

Create comprehensive migration utilities and scripts to facilitate the transition from single-target to multi-target actions. These tools will automate the migration process, validate existing content, and provide safe upgrade paths for both core system components and user-created mods.

## Dependencies

- Ticket 15: Create Comprehensive Documentation (must be completed)
- All previous tickets (1-15) must be completed

## Blocks

- Ticket 17: Performance Optimization and Monitoring
- Ticket 18: Final System Deployment and Validation

## Priority: High

## Estimated Time: 8-10 hours

## Background

With the multi-target system fully implemented and documented, migration utilities are needed to help developers transition existing content and ensure smooth deployment. These utilities will provide automated analysis, migration, and validation capabilities.

## Implementation Details

### 1. Create Content Migration Analyzer

**File**: `tools/migration/contentMigrationAnalyzer.js`

```javascript
/**
 * @file Content migration analyzer for multi-target system
 */

import fs from 'fs/promises';
import path from 'path';
import { glob } from 'glob';
import { ensureValidLogger } from '../../src/utils/loggerUtils.js';

/**
 * Analyzes existing content for multi-target migration opportunities
 */
export class ContentMigrationAnalyzer {
  #logger;
  #analysisResults;

  constructor({ logger }) {
    this.#logger = ensureValidLogger(logger);
    this.#analysisResults = {
      totalFiles: 0,
      rulesAnalyzed: 0,
      actionsAnalyzed: 0,
      migrationOpportunities: [],
      compatibilityIssues: [],
      recommendations: [],
    };
  }

  /**
   * Analyzes entire project for migration opportunities
   * @param {string} projectPath - Path to project root
   * @returns {Object} Analysis results
   */
  async analyzeProject(projectPath) {
    this.#logger.info('Starting project migration analysis', { projectPath });

    this.#resetAnalysisResults();

    try {
      // Analyze rules
      await this.#analyzeRules(projectPath);

      // Analyze actions
      await this.#analyzeActions(projectPath);

      // Analyze schemas
      await this.#analyzeSchemas(projectPath);

      // Generate recommendations
      this.#generateRecommendations();

      this.#logger.info('Project analysis completed', {
        totalFiles: this.#analysisResults.totalFiles,
        opportunities: this.#analysisResults.migrationOpportunities.length,
        issues: this.#analysisResults.compatibilityIssues.length,
      });

      return this.#analysisResults;
    } catch (error) {
      this.#logger.error('Project analysis failed', {
        error: error.message,
        projectPath,
      });
      throw error;
    }
  }

  /**
   * Analyzes rules for migration opportunities
   * @param {string} projectPath - Project root path
   */
  async #analyzeRules(projectPath) {
    const rulePattern = path.join(projectPath, 'data/mods/*/rules/**/*.json');
    const ruleFiles = await glob(rulePattern);

    this.#logger.info(`Analyzing ${ruleFiles.length} rule files`);

    for (const filePath of ruleFiles) {
      try {
        const content = await fs.readFile(filePath, 'utf-8');
        const ruleData = JSON.parse(content);

        if (ruleData.rules && Array.isArray(ruleData.rules)) {
          for (const rule of ruleData.rules) {
            await this.#analyzeRule(rule, filePath);
          }
        } else if (ruleData.id) {
          // Single rule file
          await this.#analyzeRule(ruleData, filePath);
        }

        this.#analysisResults.totalFiles++;
      } catch (error) {
        this.#analysisResults.compatibilityIssues.push({
          type: 'file_parse_error',
          file: filePath,
          error: error.message,
        });
      }
    }
  }

  /**
   * Analyzes single rule for migration opportunities
   * @param {Object} rule - Rule object
   * @param {string} filePath - File path
   */
  async #analyzeRule(rule, filePath) {
    this.#analysisResults.rulesAnalyzed++;

    const analysis = {
      ruleId: rule.id,
      filePath,
      opportunities: [],
      issues: [],
      complexity: 'low',
    };

    // Analyze conditions
    if (rule.conditions) {
      this.#analyzeRuleConditions(rule.conditions, analysis);
    }

    // Analyze operations
    if (rule.operations) {
      this.#analyzeRuleOperations(rule.operations, analysis);
    }

    // Determine complexity
    analysis.complexity = this.#assessRuleComplexity(analysis);

    // Record findings
    if (analysis.opportunities.length > 0) {
      this.#analysisResults.migrationOpportunities.push(analysis);
    }

    if (analysis.issues.length > 0) {
      this.#analysisResults.compatibilityIssues.push(...analysis.issues);
    }
  }

  /**
   * Analyzes rule conditions for migration patterns
   * @param {Array} conditions - Rule conditions
   * @param {Object} analysis - Analysis object
   */
  #analyzeRuleConditions(conditions, analysis) {
    for (const condition of conditions) {
      if (condition.type === 'json_logic' && condition.logic) {
        this.#analyzeJsonLogicForMigration(
          condition.logic,
          analysis,
          'condition'
        );
      }
    }
  }

  /**
   * Analyzes rule operations for migration patterns
   * @param {Array} operations - Rule operations
   * @param {Object} analysis - Analysis object
   */
  #analyzeRuleOperations(operations, analysis) {
    for (const operation of operations) {
      if (operation.data) {
        this.#analyzeDataForMigration(operation.data, analysis, 'operation');
      }

      if (operation.condition) {
        this.#analyzeJsonLogicForMigration(
          operation.condition,
          analysis,
          'operation_condition'
        );
      }
    }
  }

  /**
   * Analyzes JSON Logic for migration opportunities
   * @param {Object} logic - JSON Logic object
   * @param {Object} analysis - Analysis object
   * @param {string} context - Context of analysis
   */
  #analyzeJsonLogicForMigration(logic, analysis, context) {
    const logicString = JSON.stringify(logic);

    // Direct targetId access
    if (logicString.includes('event.targetId')) {
      analysis.opportunities.push({
        type: 'direct_target_access',
        context,
        pattern: 'event.targetId',
        recommendation: 'Replace with conditional multi-target access',
        priority: 'medium',
        effort: 'low',
      });
    }

    // Action-specific patterns
    const multiTargetActions = [
      'throw',
      'attack',
      'use',
      'give',
      'trade',
      'craft',
      'cast',
      'combine',
    ];

    for (const action of multiTargetActions) {
      if (logicString.includes(action)) {
        analysis.opportunities.push({
          type: 'multi_target_action',
          context,
          action,
          pattern: `action contains '${action}'`,
          recommendation: `Consider multi-target enhancement for ${action} actions`,
          priority: 'high',
          effort: 'medium',
        });
      }
    }

    // Complex conditions that could benefit from target-specific logic
    if (this.#hasComplexTargetLogic(logic)) {
      analysis.opportunities.push({
        type: 'complex_target_logic',
        context,
        pattern: 'complex target-related logic',
        recommendation: 'Simplify using multi-target patterns',
        priority: 'low',
        effort: 'high',
      });
    }
  }

  /**
   * Analyzes data objects for migration opportunities
   * @param {Object} data - Data object
   * @param {Object} analysis - Analysis object
   * @param {string} context - Context
   */
  #analyzeDataForMigration(data, analysis, context) {
    const dataString = JSON.stringify(data);

    if (dataString.includes('event.targetId')) {
      analysis.opportunities.push({
        type: 'data_target_access',
        context,
        pattern: 'event.targetId in data',
        recommendation: 'Enhance with conditional multi-target access',
        priority: 'medium',
        effort: 'low',
      });
    }

    // Look for hardcoded entity access patterns
    const entityAccessPattern = /entities\[event\.targetId\]/g;
    if (entityAccessPattern.test(dataString)) {
      analysis.opportunities.push({
        type: 'entity_access_pattern',
        context,
        pattern: 'entities[event.targetId]',
        recommendation: 'Use dynamic target resolution',
        priority: 'medium',
        effort: 'medium',
      });
    }
  }

  /**
   * Checks for complex target logic
   * @param {Object} logic - JSON Logic object
   * @returns {boolean} True if complex
   */
  #hasComplexTargetLogic(logic) {
    const logicString = JSON.stringify(logic);

    // Check for multiple nested conditions involving targets
    const targetReferences = (logicString.match(/event\.target/g) || []).length;
    const nestedConditions = (logicString.match(/"and":|"or":/g) || []).length;

    return targetReferences > 2 && nestedConditions > 1;
  }

  /**
   * Analyzes actions for migration opportunities
   * @param {string} projectPath - Project path
   */
  async #analyzeActions(projectPath) {
    const actionPattern = path.join(
      projectPath,
      'data/mods/*/actions/**/*.json'
    );
    const actionFiles = await glob(actionPattern);

    this.#logger.info(`Analyzing ${actionFiles.length} action files`);

    for (const filePath of actionFiles) {
      try {
        const content = await fs.readFile(filePath, 'utf-8');
        const actionData = JSON.parse(content);

        if (actionData.actions && Array.isArray(actionData.actions)) {
          for (const action of actionData.actions) {
            this.#analyzeAction(action, filePath);
          }
        } else if (actionData.id) {
          this.#analyzeAction(actionData, filePath);
        }

        this.#analysisResults.totalFiles++;
      } catch (error) {
        this.#analysisResults.compatibilityIssues.push({
          type: 'action_parse_error',
          file: filePath,
          error: error.message,
        });
      }
    }
  }

  /**
   * Analyzes single action for migration opportunities
   * @param {Object} action - Action object
   * @param {string} filePath - File path
   */
  #analyzeAction(action, filePath) {
    this.#analysisResults.actionsAnalyzed++;

    // Check for actions that could benefit from multi-target support
    const multiTargetCandidates = [
      'throw',
      'attack',
      'use',
      'give',
      'trade',
      'craft',
      'cast',
      'combine',
      'transfer',
      'activate',
      'repair',
      'enhance',
      'enchant',
    ];

    for (const candidate of multiTargetCandidates) {
      if (action.id && action.id.includes(candidate)) {
        this.#analysisResults.migrationOpportunities.push({
          actionId: action.id,
          filePath,
          type: 'action_enhancement_candidate',
          candidate,
          recommendation: `Action '${action.id}' could benefit from multi-target support`,
          priority: 'medium',
          effort: 'medium',
        });
      }
    }

    // Check for complex parameter structures
    if (action.parameters && Object.keys(action.parameters).length > 2) {
      this.#analysisResults.migrationOpportunities.push({
        actionId: action.id,
        filePath,
        type: 'complex_parameters',
        parameterCount: Object.keys(action.parameters).length,
        recommendation: 'Consider restructuring as multi-target action',
        priority: 'low',
        effort: 'high',
      });
    }
  }

  /**
   * Analyzes schemas for compatibility
   * @param {string} projectPath - Project path
   */
  async #analyzeSchemas(projectPath) {
    const schemaPattern = path.join(projectPath, 'data/schemas/**/*.json');
    const schemaFiles = await glob(schemaPattern);

    for (const filePath of schemaFiles) {
      try {
        const content = await fs.readFile(filePath, 'utf-8');
        const schema = JSON.parse(content);

        // Check for event schemas that might need updating
        if (schema.id && schema.id.includes('event')) {
          this.#analyzeEventSchema(schema, filePath);
        }

        this.#analysisResults.totalFiles++;
      } catch (error) {
        this.#analysisResults.compatibilityIssues.push({
          type: 'schema_parse_error',
          file: filePath,
          error: error.message,
        });
      }
    }
  }

  /**
   * Analyzes event schema for compatibility
   * @param {Object} schema - Schema object
   * @param {string} filePath - File path
   */
  #analyzeEventSchema(schema, filePath) {
    // Check if schema supports multi-target format
    const hasTargetsProperty = schema.dataSchema?.properties?.targets;
    const hasTargetIdProperty = schema.dataSchema?.properties?.targetId;

    if (!hasTargetsProperty && hasTargetIdProperty) {
      this.#analysisResults.migrationOpportunities.push({
        schemaId: schema.id,
        filePath,
        type: 'schema_enhancement',
        recommendation:
          'Schema could be enhanced to support multi-target format',
        priority: 'high',
        effort: 'low',
      });
    }
  }

  /**
   * Assesses rule complexity for migration
   * @param {Object} analysis - Rule analysis
   * @returns {string} Complexity level
   */
  #assessRuleComplexity(analysis) {
    const opportunityCount = analysis.opportunities.length;
    const issueCount = analysis.issues.length;

    if (opportunityCount === 0 && issueCount === 0) {
      return 'none';
    } else if (opportunityCount <= 2 && issueCount === 0) {
      return 'low';
    } else if (opportunityCount <= 5 && issueCount <= 1) {
      return 'medium';
    } else {
      return 'high';
    }
  }

  /**
   * Generates migration recommendations
   */
  #generateRecommendations() {
    const opportunities = this.#analysisResults.migrationOpportunities;
    const issues = this.#analysisResults.compatibilityIssues;

    // Prioritize recommendations
    const highPriorityOpportunities = opportunities.filter(
      (o) => o.priority === 'high'
    );
    const mediumPriorityOpportunities = opportunities.filter(
      (o) => o.priority === 'medium'
    );

    // Generate strategic recommendations
    this.#analysisResults.recommendations = [
      {
        category: 'immediate_actions',
        title: 'Immediate Migration Actions',
        items: [
          `Address ${issues.length} compatibility issues`,
          `Enhance ${highPriorityOpportunities.length} high-priority rules`,
          'Update event schemas to support multi-target format',
        ],
      },
      {
        category: 'phased_migration',
        title: 'Phased Migration Plan',
        items: [
          'Phase 1: Fix compatibility issues and update schemas',
          'Phase 2: Enhance high-priority rules and actions',
          'Phase 3: Gradually enhance medium-priority opportunities',
          'Phase 4: Consider low-priority enhancements based on value',
        ],
      },
      {
        category: 'effort_estimation',
        title: 'Effort Estimation',
        items: [
          `Low effort: ${opportunities.filter((o) => o.effort === 'low').length} items`,
          `Medium effort: ${opportunities.filter((o) => o.effort === 'medium').length} items`,
          `High effort: ${opportunities.filter((o) => o.effort === 'high').length} items`,
        ],
      },
      {
        category: 'risk_assessment',
        title: 'Risk Assessment',
        items: [
          issues.length > 0
            ? 'High risk due to compatibility issues'
            : 'Low risk migration',
          'Backward compatibility maintained throughout process',
          'Incremental migration allows for testing at each step',
        ],
      },
    ];
  }

  /**
   * Generates detailed migration report
   * @returns {string} Formatted report
   */
  generateReport() {
    const results = this.#analysisResults;
    const report = [];

    report.push('# Multi-Target Migration Analysis Report');
    report.push('');
    report.push(`Generated: ${new Date().toISOString()}`);
    report.push('');

    // Summary
    report.push('## Summary');
    report.push(`- **Total Files Analyzed**: ${results.totalFiles}`);
    report.push(`- **Rules Analyzed**: ${results.rulesAnalyzed}`);
    report.push(`- **Actions Analyzed**: ${results.actionsAnalyzed}`);
    report.push(
      `- **Migration Opportunities**: ${results.migrationOpportunities.length}`
    );
    report.push(
      `- **Compatibility Issues**: ${results.compatibilityIssues.length}`
    );
    report.push('');

    // Recommendations
    report.push('## Recommendations');
    for (const recommendation of results.recommendations) {
      report.push(`### ${recommendation.title}`);
      for (const item of recommendation.items) {
        report.push(`- ${item}`);
      }
      report.push('');
    }

    // Detailed opportunities
    if (results.migrationOpportunities.length > 0) {
      report.push('## Migration Opportunities');

      const groupedOpportunities = this.#groupOpportunitiesByType(
        results.migrationOpportunities
      );

      for (const [type, opportunities] of Object.entries(
        groupedOpportunities
      )) {
        report.push(`### ${type} (${opportunities.length} items)`);

        for (const opportunity of opportunities.slice(0, 5)) {
          // Show first 5
          report.push(
            `- **${opportunity.ruleId || opportunity.actionId || opportunity.schemaId}**`
          );
          report.push(`  - File: ${opportunity.filePath}`);
          report.push(`  - Recommendation: ${opportunity.recommendation}`);
          report.push(
            `  - Priority: ${opportunity.priority}, Effort: ${opportunity.effort}`
          );
        }

        if (opportunities.length > 5) {
          report.push(`  - ... and ${opportunities.length - 5} more`);
        }
        report.push('');
      }
    }

    // Issues
    if (results.compatibilityIssues.length > 0) {
      report.push('## Compatibility Issues');

      const groupedIssues = this.#groupIssuesByType(
        results.compatibilityIssues
      );

      for (const [type, issues] of Object.entries(groupedIssues)) {
        report.push(`### ${type} (${issues.length} items)`);

        for (const issue of issues.slice(0, 3)) {
          // Show first 3
          report.push(`- **${issue.file}**: ${issue.error}`);
        }

        if (issues.length > 3) {
          report.push(`  - ... and ${issues.length - 3} more`);
        }
        report.push('');
      }
    }

    return report.join('\n');
  }

  /**
   * Groups opportunities by type
   * @param {Array} opportunities - Migration opportunities
   * @returns {Object} Grouped opportunities
   */
  #groupOpportunitiesByType(opportunities) {
    return opportunities.reduce((groups, opportunity) => {
      const type = opportunity.type || 'unknown';
      if (!groups[type]) groups[type] = [];
      groups[type].push(opportunity);
      return groups;
    }, {});
  }

  /**
   * Groups issues by type
   * @param {Array} issues - Compatibility issues
   * @returns {Object} Grouped issues
   */
  #groupIssuesByType(issues) {
    return issues.reduce((groups, issue) => {
      const type = issue.type || 'unknown';
      if (!groups[type]) groups[type] = [];
      groups[type].push(issue);
      return groups;
    }, {});
  }

  /**
   * Resets analysis results
   */
  #resetAnalysisResults() {
    this.#analysisResults = {
      totalFiles: 0,
      rulesAnalyzed: 0,
      actionsAnalyzed: 0,
      migrationOpportunities: [],
      compatibilityIssues: [],
      recommendations: [],
    };
  }

  /**
   * Exports analysis results
   * @param {string} outputPath - Output file path
   * @returns {Promise} Export promise
   */
  async exportResults(outputPath) {
    const report = this.generateReport();
    await fs.writeFile(outputPath, report, 'utf-8');

    const jsonPath = outputPath.replace(/\.[^.]+$/, '.json');
    await fs.writeFile(
      jsonPath,
      JSON.stringify(this.#analysisResults, null, 2),
      'utf-8'
    );

    this.#logger.info('Analysis results exported', {
      reportPath: outputPath,
      dataPath: jsonPath,
    });
  }
}

export default ContentMigrationAnalyzer;
```

### 2. Create Automated Migration Tool

**File**: `tools/migration/automatedMigrationTool.js`

```javascript
/**
 * @file Automated migration tool for multi-target system
 */

import fs from 'fs/promises';
import path from 'path';
import { ensureValidLogger } from '../../src/utils/loggerUtils.js';
import RuleMigrationHelper from '../../src/utils/ruleMigrationHelper.js';

/**
 * Automated tool for migrating content to multi-target format
 */
export class AutomatedMigrationTool {
  #logger;
  #migrationHelper;
  #migrationResults;

  constructor({ logger }) {
    this.#logger = ensureValidLogger(logger);
    this.#migrationHelper = new RuleMigrationHelper({ logger });
    this.#migrationResults = {
      filesProcessed: 0,
      rulesUpdated: 0,
      schemasUpdated: 0,
      backupsCreated: 0,
      errors: [],
    };
  }

  /**
   * Migrates project content to multi-target format
   * @param {Object} migrationPlan - Migration plan from analyzer
   * @param {Object} options - Migration options
   * @returns {Object} Migration results
   */
  async migrateProject(migrationPlan, options = {}) {
    const {
      createBackups = true,
      dryRun = false,
      validateAfterMigration = true,
      backupSuffix = '.pre-multi-target',
    } = options;

    this.#logger.info('Starting automated migration', {
      opportunities: migrationPlan.migrationOpportunities.length,
      dryRun,
      createBackups,
    });

    this.#resetMigrationResults();

    try {
      // Phase 1: Create backups
      if (createBackups && !dryRun) {
        await this.#createBackups(migrationPlan, backupSuffix);
      }

      // Phase 2: Update schemas
      await this.#updateSchemas(migrationPlan, dryRun);

      // Phase 3: Migrate rules
      await this.#migrateRules(migrationPlan, dryRun);

      // Phase 4: Validate migrations
      if (validateAfterMigration && !dryRun) {
        await this.#validateMigrations(migrationPlan);
      }

      this.#logger.info(
        'Migration completed successfully',
        this.#migrationResults
      );
      return this.#migrationResults;
    } catch (error) {
      this.#logger.error('Migration failed', {
        error: error.message,
        results: this.#migrationResults,
      });
      throw error;
    }
  }

  /**
   * Creates backups of files to be migrated
   * @param {Object} migrationPlan - Migration plan
   * @param {string} suffix - Backup suffix
   */
  async #createBackups(migrationPlan, suffix) {
    this.#logger.info('Creating backups');

    const filesToBackup = new Set();

    // Collect all files that will be modified
    for (const opportunity of migrationPlan.migrationOpportunities) {
      if (opportunity.filePath) {
        filesToBackup.add(opportunity.filePath);
      }
    }

    for (const filePath of filesToBackup) {
      try {
        const backupPath = `${filePath}${suffix}`;
        await fs.copyFile(filePath, backupPath);
        this.#migrationResults.backupsCreated++;

        this.#logger.debug('Backup created', {
          original: filePath,
          backup: backupPath,
        });
      } catch (error) {
        this.#migrationResults.errors.push({
          type: 'backup_error',
          file: filePath,
          error: error.message,
        });
      }
    }
  }

  /**
   * Updates schemas to support multi-target format
   * @param {Object} migrationPlan - Migration plan
   * @param {boolean} dryRun - Whether this is a dry run
   */
  async #updateSchemas(migrationPlan, dryRun) {
    const schemaOpportunities = migrationPlan.migrationOpportunities.filter(
      (op) => op.type === 'schema_enhancement'
    );

    this.#logger.info(`Updating ${schemaOpportunities.length} schemas`);

    for (const opportunity of schemaOpportunities) {
      try {
        await this.#updateSchema(opportunity, dryRun);
        this.#migrationResults.schemasUpdated++;
      } catch (error) {
        this.#migrationResults.errors.push({
          type: 'schema_update_error',
          file: opportunity.filePath,
          error: error.message,
        });
      }
    }
  }

  /**
   * Updates single schema file
   * @param {Object} opportunity - Migration opportunity
   * @param {boolean} dryRun - Whether this is a dry run
   */
  async #updateSchema(opportunity, dryRun) {
    const filePath = opportunity.filePath;
    const content = await fs.readFile(filePath, 'utf-8');
    const schema = JSON.parse(content);

    // Add targets property to event schemas
    if (schema.dataSchema && schema.dataSchema.properties) {
      const properties = schema.dataSchema.properties;

      if (!properties.targets && properties.targetId) {
        properties.targets = {
          type: 'object',
          description: 'Multi-target data for enhanced actions',
          additionalProperties: {
            type: 'string',
            description: 'Target ID for specific target type',
          },
        };

        // Make targets optional for backward compatibility
        if (!schema.dataSchema.required) {
          schema.dataSchema.required = [];
        }
        // Ensure targets is not required
        schema.dataSchema.required = schema.dataSchema.required.filter(
          (field) => field !== 'targets'
        );

        this.#logger.debug('Enhanced schema with targets property', {
          schemaId: schema.id,
          filePath,
        });

        if (!dryRun) {
          const updatedContent = JSON.stringify(schema, null, 2);
          await fs.writeFile(filePath, updatedContent, 'utf-8');
        }
      }
    }
  }

  /**
   * Migrates rules to multi-target format
   * @param {Object} migrationPlan - Migration plan
   * @param {boolean} dryRun - Whether this is a dry run
   */
  async #migrateRules(migrationPlan, dryRun) {
    const ruleOpportunities = migrationPlan.migrationOpportunities.filter(
      (op) => op.ruleId
    );

    this.#logger.info(`Migrating ${ruleOpportunities.length} rules`);

    // Group opportunities by file for efficient processing
    const opportunitiesByFile =
      this.#groupOpportunitiesByFile(ruleOpportunities);

    for (const [filePath, opportunities] of Object.entries(
      opportunitiesByFile
    )) {
      try {
        await this.#migrateRuleFile(filePath, opportunities, dryRun);
        this.#migrationResults.filesProcessed++;
      } catch (error) {
        this.#migrationResults.errors.push({
          type: 'rule_migration_error',
          file: filePath,
          error: error.message,
        });
      }
    }
  }

  /**
   * Migrates single rule file
   * @param {string} filePath - File path
   * @param {Array} opportunities - Migration opportunities for this file
   * @param {boolean} dryRun - Whether this is a dry run
   */
  async #migrateRuleFile(filePath, opportunities, dryRun) {
    const content = await fs.readFile(filePath, 'utf-8');
    const ruleData = JSON.parse(content);
    let modified = false;

    if (ruleData.rules && Array.isArray(ruleData.rules)) {
      // Multiple rules file
      for (let i = 0; i < ruleData.rules.length; i++) {
        const rule = ruleData.rules[i];
        const ruleOpportunities = opportunities.filter(
          (op) => op.ruleId === rule.id
        );

        if (ruleOpportunities.length > 0) {
          const enhancedRule = await this.#enhanceRule(rule, ruleOpportunities);
          ruleData.rules[i] = enhancedRule;
          modified = true;
          this.#migrationResults.rulesUpdated++;
        }
      }
    } else if (ruleData.id) {
      // Single rule file
      const ruleOpportunities = opportunities.filter(
        (op) => op.ruleId === ruleData.id
      );

      if (ruleOpportunities.length > 0) {
        const enhancedRule = await this.#enhanceRule(
          ruleData,
          ruleOpportunities
        );
        Object.assign(ruleData, enhancedRule);
        modified = true;
        this.#migrationResults.rulesUpdated++;
      }
    }

    if (modified && !dryRun) {
      const updatedContent = JSON.stringify(ruleData, null, 2);
      await fs.writeFile(filePath, updatedContent, 'utf-8');

      this.#logger.debug('Rule file migrated', {
        filePath,
        rulesUpdated: opportunities.length,
      });
    }
  }

  /**
   * Enhances single rule with multi-target support
   * @param {Object} rule - Original rule
   * @param {Array} opportunities - Migration opportunities
   * @returns {Object} Enhanced rule
   */
  async #enhanceRule(rule, opportunities) {
    // Use migration helper to generate enhanced rule
    const enhancedRule = this.#migrationHelper.generateEnhancedRule(rule, {
      preserveBackwardCompatibility: true,
      addMultiTargetSupport: true,
    });

    // Apply specific enhancements based on opportunities
    for (const opportunity of opportunities) {
      switch (opportunity.type) {
        case 'direct_target_access':
          this.#enhanceDirectTargetAccess(enhancedRule, opportunity);
          break;
        case 'multi_target_action':
          this.#enhanceMultiTargetAction(enhancedRule, opportunity);
          break;
        case 'data_target_access':
          this.#enhanceDataTargetAccess(enhancedRule, opportunity);
          break;
      }
    }

    // Validate backward compatibility
    const validation = this.#migrationHelper.validateBackwardCompatibility(
      rule,
      enhancedRule
    );
    if (!validation.isCompatible) {
      this.#logger.warn('Backward compatibility issue detected', {
        ruleId: rule.id,
        issues: validation.issues,
      });
    }

    return enhancedRule;
  }

  /**
   * Enhances direct target access patterns
   * @param {Object} rule - Rule to enhance
   * @param {Object} opportunity - Migration opportunity
   */
  #enhanceDirectTargetAccess(rule, opportunity) {
    // Replace direct targetId access with conditional logic
    const ruleString = JSON.stringify(rule);
    const updatedString = ruleString.replace(
      /"var":\s*"event\.targetId"/g,
      '{"if":[{"var":"event.targets.target"},{"var":"event.targets.target"},{"var":"event.targetId"}]}'
    );

    try {
      const updatedRule = JSON.parse(updatedString);
      Object.assign(rule, updatedRule);
    } catch (error) {
      this.#logger.warn('Failed to enhance direct target access', {
        ruleId: rule.id,
        error: error.message,
      });
    }
  }

  /**
   * Enhances multi-target action patterns
   * @param {Object} rule - Rule to enhance
   * @param {Object} opportunity - Migration opportunity
   */
  #enhanceMultiTargetAction(rule, opportunity) {
    // Add conditions to check for targets object
    if (rule.conditions) {
      const hasTargetsCondition = {
        type: 'json_logic',
        logic: { var: 'event.targets' },
      };

      // Check if condition already exists
      const hasCondition = rule.conditions.some(
        (condition) =>
          condition.logic &&
          JSON.stringify(condition.logic).includes('event.targets')
      );

      if (!hasCondition) {
        rule.conditions.push(hasTargetsCondition);
      }
    }
  }

  /**
   * Enhances data target access patterns
   * @param {Object} rule - Rule to enhance
   * @param {Object} opportunity - Migration opportunity
   */
  #enhanceDataTargetAccess(rule, opportunity) {
    // Similar to direct target access but for operation data
    if (rule.operations) {
      for (const operation of rule.operations) {
        if (operation.data) {
          this.#enhanceDataObject(operation.data);
        }
      }
    }
  }

  /**
   * Enhances data object with multi-target patterns
   * @param {Object} data - Data object to enhance
   */
  #enhanceDataObject(data) {
    for (const [key, value] of Object.entries(data)) {
      if (
        value &&
        typeof value === 'object' &&
        value.var === 'event.targetId'
      ) {
        data[key] = {
          if: [
            { var: 'event.targets.target' },
            { var: 'event.targets.target' },
            { var: 'event.targetId' },
          ],
        };
      }
    }
  }

  /**
   * Validates migrations after completion
   * @param {Object} migrationPlan - Original migration plan
   */
  async #validateMigrations(migrationPlan) {
    this.#logger.info('Validating migrations');

    // Re-analyze migrated files to check for issues
    const analyzer = new (
      await import('./contentMigrationAnalyzer.js')
    ).ContentMigrationAnalyzer({
      logger: this.#logger,
    });

    // Get unique file paths
    const migratedFiles = new Set(
      migrationPlan.migrationOpportunities
        .filter((op) => op.filePath)
        .map((op) => op.filePath)
    );

    let validationErrors = 0;

    for (const filePath of migratedFiles) {
      try {
        const content = await fs.readFile(filePath, 'utf-8');
        JSON.parse(content); // Validate JSON syntax
      } catch (error) {
        validationErrors++;
        this.#migrationResults.errors.push({
          type: 'validation_error',
          file: filePath,
          error: 'Invalid JSON after migration',
        });
      }
    }

    this.#logger.info('Migration validation completed', {
      filesValidated: migratedFiles.size,
      errors: validationErrors,
    });
  }

  /**
   * Groups opportunities by file path
   * @param {Array} opportunities - Migration opportunities
   * @returns {Object} Grouped opportunities
   */
  #groupOpportunitiesByFile(opportunities) {
    return opportunities.reduce((groups, opportunity) => {
      const filePath = opportunity.filePath;
      if (!groups[filePath]) groups[filePath] = [];
      groups[filePath].push(opportunity);
      return groups;
    }, {});
  }

  /**
   * Resets migration results
   */
  #resetMigrationResults() {
    this.#migrationResults = {
      filesProcessed: 0,
      rulesUpdated: 0,
      schemasUpdated: 0,
      backupsCreated: 0,
      errors: [],
    };
  }

  /**
   * Generates migration report
   * @returns {string} Formatted report
   */
  generateReport() {
    const results = this.#migrationResults;
    const report = [];

    report.push('# Migration Results Report');
    report.push('');
    report.push(`Generated: ${new Date().toISOString()}`);
    report.push('');

    // Summary
    report.push('## Summary');
    report.push(`- **Files Processed**: ${results.filesProcessed}`);
    report.push(`- **Rules Updated**: ${results.rulesUpdated}`);
    report.push(`- **Schemas Updated**: ${results.schemasUpdated}`);
    report.push(`- **Backups Created**: ${results.backupsCreated}`);
    report.push(`- **Errors**: ${results.errors.length}`);
    report.push('');

    // Success rate
    const totalOperations =
      results.filesProcessed + results.rulesUpdated + results.schemasUpdated;
    const successRate =
      totalOperations > 0
        ? (
            ((totalOperations - results.errors.length) / totalOperations) *
            100
          ).toFixed(1)
        : '100.0';

    report.push(`**Success Rate**: ${successRate}%`);
    report.push('');

    // Errors
    if (results.errors.length > 0) {
      report.push('## Errors');

      const errorsByType = results.errors.reduce((groups, error) => {
        const type = error.type || 'unknown';
        if (!groups[type]) groups[type] = [];
        groups[type].push(error);
        return groups;
      }, {});

      for (const [type, errors] of Object.entries(errorsByType)) {
        report.push(`### ${type} (${errors.length} items)`);

        for (const error of errors.slice(0, 5)) {
          report.push(`- **${error.file}**: ${error.error}`);
        }

        if (errors.length > 5) {
          report.push(`  - ... and ${errors.length - 5} more`);
        }
        report.push('');
      }
    }

    return report.join('\n');
  }
}

export default AutomatedMigrationTool;
```

### 3. Create Migration CLI Tool

**File**: `tools/migration/migrationCli.js`

```javascript
#!/usr/bin/env node

/**
 * @file Command-line interface for migration tools
 */

import { Command } from 'commander';
import chalk from 'chalk';
import fs from 'fs/promises';
import path from 'path';
import ContentMigrationAnalyzer from './contentMigrationAnalyzer.js';
import AutomatedMigrationTool from './automatedMigrationTool.js';

const program = new Command();

// Configure CLI
program
  .name('multi-target-migration')
  .description('Migration tools for multi-target action system')
  .version('1.0.0');

// Analyze command
program
  .command('analyze')
  .description('Analyze project for migration opportunities')
  .argument('<project-path>', 'Path to project root')
  .option('-o, --output <path>', 'Output file path', 'migration-analysis.md')
  .option('-v, --verbose', 'Verbose output')
  .action(async (projectPath, options) => {
    try {
      console.log(
        chalk.blue('🔍 Analyzing project for migration opportunities...')
      );

      const logger = createLogger(options.verbose);
      const analyzer = new ContentMigrationAnalyzer({ logger });

      const results = await analyzer.analyzeProject(projectPath);

      console.log(chalk.green('\n✅ Analysis completed successfully!'));
      console.log(`📊 Results:`);
      console.log(`   • Files analyzed: ${results.totalFiles}`);
      console.log(`   • Rules analyzed: ${results.rulesAnalyzed}`);
      console.log(`   • Actions analyzed: ${results.actionsAnalyzed}`);
      console.log(
        `   • Migration opportunities: ${results.migrationOpportunities.length}`
      );
      console.log(
        `   • Compatibility issues: ${results.compatibilityIssues.length}`
      );

      await analyzer.exportResults(options.output);
      console.log(chalk.green(`📄 Report saved to: ${options.output}`));
    } catch (error) {
      console.error(chalk.red('❌ Analysis failed:'), error.message);
      process.exit(1);
    }
  });

// Migrate command
program
  .command('migrate')
  .description('Execute automated migration')
  .argument('<analysis-file>', 'Path to analysis JSON file')
  .option('--dry-run', 'Perform dry run without making changes')
  .option('--no-backup', 'Skip creating backups')
  .option('--no-validate', 'Skip validation after migration')
  .option('-v, --verbose', 'Verbose output')
  .action(async (analysisFile, options) => {
    try {
      console.log(chalk.blue('🚀 Starting automated migration...'));

      // Load analysis results
      const analysisData = await fs.readFile(analysisFile, 'utf-8');
      const migrationPlan = JSON.parse(analysisData);

      const logger = createLogger(options.verbose);
      const migrationTool = new AutomatedMigrationTool({ logger });

      const migrationOptions = {
        dryRun: options.dryRun,
        createBackups: options.backup,
        validateAfterMigration: options.validate,
      };

      if (options.dryRun) {
        console.log(
          chalk.yellow('🔍 Performing dry run - no files will be modified')
        );
      }

      const results = await migrationTool.migrateProject(
        migrationPlan,
        migrationOptions
      );

      console.log(chalk.green('\n✅ Migration completed successfully!'));
      console.log(`📊 Results:`);
      console.log(`   • Files processed: ${results.filesProcessed}`);
      console.log(`   • Rules updated: ${results.rulesUpdated}`);
      console.log(`   • Schemas updated: ${results.schemasUpdated}`);
      console.log(`   • Backups created: ${results.backupsCreated}`);
      console.log(`   • Errors: ${results.errors.length}`);

      if (results.errors.length > 0) {
        console.log(
          chalk.yellow('\n⚠️  Some errors occurred during migration:')
        );
        for (const error of results.errors.slice(0, 5)) {
          console.log(`   • ${error.file}: ${error.error}`);
        }
        if (results.errors.length > 5) {
          console.log(`   • ... and ${results.errors.length - 5} more errors`);
        }
      }
    } catch (error) {
      console.error(chalk.red('❌ Migration failed:'), error.message);
      process.exit(1);
    }
  });

// Validate command
program
  .command('validate')
  .description('Validate migrated content')
  .argument('<project-path>', 'Path to project root')
  .option('-v, --verbose', 'Verbose output')
  .action(async (projectPath, options) => {
    try {
      console.log(chalk.blue('🔍 Validating migrated content...'));

      const logger = createLogger(options.verbose);
      const analyzer = new ContentMigrationAnalyzer({ logger });

      // Re-analyze to check for remaining issues
      const results = await analyzer.analyzeProject(projectPath);

      const remainingIssues = results.compatibilityIssues.length;
      const highPriorityOpportunities = results.migrationOpportunities.filter(
        (op) => op.priority === 'high'
      ).length;

      if (remainingIssues === 0 && highPriorityOpportunities === 0) {
        console.log(
          chalk.green('✅ Validation passed - no critical issues found!')
        );
      } else {
        console.log(chalk.yellow('⚠️  Validation found some issues:'));
        console.log(`   • Compatibility issues: ${remainingIssues}`);
        console.log(
          `   • High-priority opportunities: ${highPriorityOpportunities}`
        );
      }

      console.log(`📊 Overall status:`);
      console.log(`   • Files analyzed: ${results.totalFiles}`);
      console.log(
        `   • Total opportunities: ${results.migrationOpportunities.length}`
      );
      console.log(`   • Total issues: ${results.compatibilityIssues.length}`);
    } catch (error) {
      console.error(chalk.red('❌ Validation failed:'), error.message);
      process.exit(1);
    }
  });

// Backup command
program
  .command('backup')
  .description('Create project backup before migration')
  .argument('<project-path>', 'Path to project root')
  .option('-o, --output <path>', 'Backup output directory')
  .option('-v, --verbose', 'Verbose output')
  .action(async (projectPath, options) => {
    try {
      const backupDir = options.output || `${projectPath}-backup-${Date.now()}`;

      console.log(chalk.blue(`💾 Creating project backup...`));
      console.log(`   Source: ${projectPath}`);
      console.log(`   Destination: ${backupDir}`);

      await copyDirectory(projectPath, backupDir);

      console.log(chalk.green('✅ Backup created successfully!'));
    } catch (error) {
      console.error(chalk.red('❌ Backup failed:'), error.message);
      process.exit(1);
    }
  });

// Helper functions
function createLogger(verbose) {
  return {
    info: (message, data) => {
      if (verbose) {
        console.log(
          chalk.blue('ℹ️ '),
          message,
          data ? chalk.gray(JSON.stringify(data)) : ''
        );
      }
    },
    warn: (message, data) => {
      console.log(
        chalk.yellow('⚠️ '),
        message,
        data ? chalk.gray(JSON.stringify(data)) : ''
      );
    },
    error: (message, data) => {
      console.log(
        chalk.red('❌'),
        message,
        data ? chalk.gray(JSON.stringify(data)) : ''
      );
    },
    debug: (message, data) => {
      if (verbose) {
        console.log(
          chalk.gray('🔍'),
          message,
          data ? chalk.gray(JSON.stringify(data)) : ''
        );
      }
    },
  };
}

async function copyDirectory(src, dest) {
  await fs.mkdir(dest, { recursive: true });

  const entries = await fs.readdir(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      await copyDirectory(srcPath, destPath);
    } else {
      await fs.copyFile(srcPath, destPath);
    }
  }
}

// Parse command line arguments
program.parse();
```

### 4. Create Migration Documentation

**File**: `tools/migration/README.md`

````markdown
# Multi-Target Migration Tools

This directory contains tools for migrating existing content to the new multi-target action system.

## Tools Overview

### 1. Content Migration Analyzer

Analyzes existing project content to identify migration opportunities and compatibility issues.

### 2. Automated Migration Tool

Performs automated migration of rules and schemas to support multi-target format.

### 3. Migration CLI

Command-line interface for running migration tools.

## Usage

### Installation

```bash
cd tools/migration
npm install
```
````

### Analysis

Analyze your project for migration opportunities:

```bash
node migrationCli.js analyze /path/to/your/project
```

This will generate a detailed analysis report and JSON data file.

### Migration

Execute automated migration based on analysis:

```bash
# Dry run first to see what would change
node migrationCli.js migrate analysis-results.json --dry-run

# Execute actual migration
node migrationCli.js migrate analysis-results.json
```

### Validation

Validate migrated content:

```bash
node migrationCli.js validate /path/to/your/project
```

### Backup

Create project backup before migration:

```bash
node migrationCli.js backup /path/to/your/project
```

## Migration Process

### Recommended Workflow

1. **Backup**: Create full project backup
2. **Analyze**: Run analysis to understand migration scope
3. **Plan**: Review analysis report and plan migration phases
4. **Test**: Run dry-run migration to preview changes
5. **Migrate**: Execute actual migration
6. **Validate**: Verify migration results
7. **Test**: Run comprehensive tests on migrated content

### Safety Features

- **Automatic Backups**: Tools create backups before making changes
- **Dry Run Mode**: Preview changes without modifying files
- **Validation**: Automatic validation after migration
- **Error Recovery**: Detailed error reporting and recovery guidance

## Migration Analysis Report

The analysis generates a detailed report including:

- **Summary Statistics**: Files analyzed, opportunities found, issues detected
- **Migration Opportunities**: Specific enhancement opportunities with priority and effort estimates
- **Compatibility Issues**: Problems that need manual resolution
- **Recommendations**: Strategic guidance for migration planning

## Automated Migration Features

- **Schema Enhancement**: Automatically adds multi-target support to event schemas
- **Rule Migration**: Enhances rules with backward-compatible multi-target patterns
- **Validation**: Ensures migrated content maintains JSON validity
- **Error Handling**: Graceful handling of migration errors with detailed reporting

## Troubleshooting

### Common Issues

**Analysis fails with JSON parse errors**

- Some rule files may have syntax errors
- Review and fix JSON syntax issues before migration

**Migration produces validation errors**

- Check generated rules for logical consistency
- Some complex rules may need manual enhancement

**Backup creation fails**

- Ensure sufficient disk space
- Check file permissions

### Getting Help

1. Review generated analysis report for specific guidance
2. Check error messages for detailed failure information
3. Use verbose mode (`-v`) for additional debugging information
4. Consult main documentation for rule enhancement patterns

```

## Testing Requirements

### 1. Tool Functionality Tests

- **Analyzer accuracy**: Correctly identifies migration opportunities
- **Migration safety**: No data loss during automated migration
- **Validation completeness**: Catches all compatibility issues
- **CLI usability**: Command-line interface works correctly

### 2. Migration Quality Tests

- **Backward compatibility**: Migrated rules maintain legacy support
- **Enhancement accuracy**: Multi-target enhancements work correctly
- **Schema validity**: Updated schemas are valid and complete
- **Error handling**: Graceful handling of all error conditions

### 3. End-to-end Tests

- **Complete workflow**: Full analysis → migration → validation cycle
- **Real project testing**: Tools work with actual project content
- **Recovery testing**: Backup and restore functionality
- **Performance testing**: Tools handle large projects efficiently

## Success Criteria

1. **Complete Migration Support**: Tools handle all identified migration scenarios
2. **Safety and Reliability**: No data loss or corruption during migration
3. **Ease of Use**: Clear CLI interface and comprehensive documentation
4. **Quality Assurance**: Migrated content maintains quality and compatibility
5. **Production Readiness**: Tools ready for use with real projects

## Files Created

- `tools/migration/contentMigrationAnalyzer.js`
- `tools/migration/automatedMigrationTool.js`
- `tools/migration/migrationCli.js`
- `tools/migration/README.md`

## Files Modified

None (new migration tools only)

## Validation Steps

1. Test migration tools with sample project content
2. Validate analysis accuracy and completeness
3. Test automated migration safety and correctness
4. Verify CLI functionality and usability
5. Test complete migration workflow end-to-end

## Notes

- Migration tools provide safe, automated transition path
- Comprehensive analysis identifies all migration opportunities
- CLI interface enables easy integration with development workflows
- Safety features prevent data loss and ensure quality

## Risk Assessment

**Low Risk**: Migration tools are isolated utilities that don't affect runtime system. Extensive backup and validation features minimize risk of data loss during migration.

## Next Steps

After this ticket completion:
1. Move to Ticket 17: Performance Optimization and Monitoring
2. Create performance monitoring and optimization tools
3. Prepare for final system deployment
```
