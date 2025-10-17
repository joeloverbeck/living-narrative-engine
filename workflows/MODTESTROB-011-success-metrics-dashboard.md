# MODTESTROB-011: Success Metrics Dashboard and Tracking

**Epic**: Mod Testing Robustness Enhancement  
**Priority**: P2 (Documentation & Measurement)  
**Estimated Effort**: 6-8 hours  
**Dependencies**: MODTESTROB-005, MODTESTROB-006, MODTESTROB-007, MODTESTROB-010

---

## Overview

### Problem Statement

After implementing new testing patterns and migrating existing tests, we need to measure the actual impact and track adoption over time. Currently:

- **No quantitative impact data**: We estimate improvements but don't measure them
- **No adoption tracking**: Can't see which patterns are being used or ignored
- **No trend analysis**: Can't identify if patterns are improving or degrading
- **No developer feedback loop**: No mechanism to gather usage feedback

### Target Outcome

Create a comprehensive metrics dashboard that tracks:

- **Pattern adoption rates**: Which patterns are used, how often, where
- **Impact measurements**: Line reduction, setup time, debugging time
- **Quality metrics**: Test pass rates, flakiness, maintenance burden
- **Developer satisfaction**: Feedback on pattern effectiveness
- **Trend analysis**: Improvement over time, pattern evolution

### Benefits

1. **Data-Driven Decisions**: Evidence-based improvements to patterns
2. **Adoption Visibility**: Clear view of which patterns need promotion
3. **ROI Demonstration**: Quantify value of testing infrastructure investment
4. **Continuous Improvement**: Identify areas for enhancement
5. **Team Alignment**: Shared understanding of testing quality

---

## Prerequisites

### Required Tickets

- ✅ MODTESTROB-005 (Enhanced Test Assertions) - Matchers to track
- ✅ MODTESTROB-006 (Sitting Scenario Builders) - Scenarios to track
- ✅ MODTESTROB-007 (Inventory Scenario Builders) - Scenarios to track
- ✅ MODTESTROB-010 (Update Existing Tests) - Migration progress to track

### Development Environment

```bash
# Verify test infrastructure
npm run test:unit -- tests/common/mods/domainMatchers.test.js
npm run test:unit -- tests/common/mods/sittingScenarios.test.js
npm run test:unit -- tests/common/mods/inventoryScenarios.test.js

# Verify migration tracking
node scripts/track-migration-progress.js

# All should be operational
```

### Knowledge Requirements

- Understanding of metrics collection and visualization
- Familiarity with Node.js scripting
- Knowledge of Git statistics
- Understanding of the testing patterns being measured

---

## Detailed Steps

### Step 1: Design Metrics Collection System

**Duration**: 1 hour

#### 1.1: Define Metrics Taxonomy

**Core Metrics Categories**:

```javascript
/**
 * Metrics taxonomy for mod testing robustness
 */
const METRICS_TAXONOMY = {
  // Pattern Adoption Metrics
  adoption: {
    domainMatchers: {
      total: 'Total domain matcher usages across all tests',
      perFile: 'Average domain matcher usages per file',
      byType: {
        toSucceed: 'Success assertion usage count',
        toFail: 'Failure assertion usage count',
        toAddComponent: 'Component addition assertion count',
        toRemoveComponent: 'Component removal assertion count',
        toUpdateComponent: 'Component update assertion count',
        toHaveComponent: 'Component presence assertion count',
        toBeAt: 'Location assertion count',
        toDispatchEvent: 'Event dispatch assertion count',
        toHaveComponentData: 'Component data assertion count',
        toHaveValidationError: 'Validation error assertion count',
      },
    },
    scenarioBuilders: {
      total: 'Total scenario builder usages',
      perFile: 'Average scenario builder usages per file',
      sitting: {
        twoActorsSittingTogether: 'Two actors together usage',
        actorsSittingClose: 'Actors sitting close usage',
        actorSittingAlone: 'Actor sitting alone usage',
        standingNearSitting: 'Standing near sitting usage',
        multipleActorsSitting: 'Multiple actors sitting usage',
        separateFurniture: 'Separate furniture usage',
        sittingWithStandingBehind: 'Sitting with standing behind usage',
        kneelingBeforeSitting: 'Kneeling before sitting usage',
      },
      inventory: {
        actorCarryingItems: 'Actor carrying items usage',
        actorWithWeapon: 'Actor with weapon usage',
        itemsAtLocation: 'Items at location usage',
        actorWithFullInventory: 'Actor with full inventory usage',
        actorWithEmptyInventory: 'Actor with empty inventory usage',
        containerWithItems: 'Container with items usage',
        actorGivingItem: 'Actor giving item usage',
        actorDroppingItem: 'Actor dropping item usage',
        actorPickingUpItem: 'Actor picking up item usage',
        actorOpeningContainer: 'Actor opening container usage',
        actorPuttingItemInContainer: 'Actor putting item in container usage',
      },
    },
    oldPatterns: {
      manualSetup: 'Old manual setup pattern count',
      manualAssertions: 'Old manual assertion pattern count',
    },
  },

  // Impact Metrics
  impact: {
    lineReduction: {
      total: 'Total lines reduced across all migrations',
      average: 'Average line reduction per file',
      percentage: 'Percentage reduction in test code',
    },
    testClarity: {
      setupLinesPerTest: 'Average setup lines per test',
      assertionLinesPerTest: 'Average assertion lines per test',
      totalLinesPerTest: 'Average total lines per test',
    },
    timeToWrite: {
      beforePatterns: 'Average time to write test before patterns (minutes)',
      afterPatterns: 'Average time to write test after patterns (minutes)',
      improvement: 'Time improvement percentage',
    },
    timeToDebug: {
      beforePatterns: 'Average time to debug failing test before patterns (minutes)',
      afterPatterns: 'Average time to debug failing test after patterns (minutes)',
      improvement: 'Debug time improvement percentage',
    },
  },

  // Quality Metrics
  quality: {
    testPassRate: {
      overall: 'Overall test pass rate percentage',
      byModule: 'Pass rate broken down by module (positioning, items, etc.)',
      trend: 'Pass rate trend over time',
    },
    flakiness: {
      flakyTests: 'Number of tests with intermittent failures',
      flakinessRate: 'Percentage of tests that are flaky',
      trend: 'Flakiness trend over time',
    },
    maintenance: {
      testUpdatesPerWeek: 'Number of test updates per week',
      testBreakageRate: 'How often tests break due to code changes',
      timeToFix: 'Average time to fix broken tests (hours)',
    },
    coverage: {
      migratedFiles: 'Number of files using new patterns',
      totalFiles: 'Total test files',
      migrationProgress: 'Percentage of files migrated',
    },
  },

  // Developer Satisfaction
  satisfaction: {
    patternUsability: {
      easeOfUse: 'Developer rating of pattern ease of use (1-5)',
      clarity: 'Developer rating of pattern clarity (1-5)',
      efficiency: 'Developer rating of pattern efficiency (1-5)',
    },
    feedback: {
      positiveComments: 'Count of positive feedback items',
      improvementSuggestions: 'Count of improvement suggestions',
      blockers: 'Count of reported blockers',
    },
  },

  // Trend Analysis
  trends: {
    adoptionRate: 'Pattern adoption rate over time',
    impactTrend: 'Impact improvement trend over time',
    qualityTrend: 'Quality metrics trend over time',
    satisfactionTrend: 'Developer satisfaction trend over time',
  },
};
```

#### 1.2: Define Data Collection Points

**Collection Methods**:

1. **Static Code Analysis**:
   - Parse test files for pattern usage
   - Count domain matchers by type
   - Count scenario builder invocations
   - Detect old pattern remnants

2. **Git History Analysis**:
   - Track line count changes over time
   - Measure migration velocity
   - Analyze commit patterns

3. **Test Execution Metrics**:
   - Collect pass/fail rates from Jest
   - Track test execution time
   - Identify flaky tests

4. **Developer Surveys**:
   - Periodic satisfaction surveys
   - Feedback collection forms
   - Usage interviews

5. **Manual Tracking**:
   - Time-to-write estimates
   - Time-to-debug measurements
   - Migration effort logs

#### 1.3: Design Data Storage Schema

**Metrics Storage** - `metrics/metrics-data.json`:

```json
{
  "version": "1.0.0",
  "lastUpdated": "2024-01-15T10:30:00Z",
  "snapshot": {
    "adoption": {
      "domainMatchers": {
        "total": 45,
        "perFile": 3.2,
        "byType": {
          "toSucceed": 15,
          "toFail": 3,
          "toAddComponent": 8,
          "toRemoveComponent": 7,
          "toUpdateComponent": 5,
          "toHaveComponent": 4,
          "toBeAt": 1,
          "toDispatchEvent": 1,
          "toHaveComponentData": 1,
          "toHaveValidationError": 0
        }
      },
      "scenarioBuilders": {
        "total": 12,
        "perFile": 0.9,
        "sitting": {
          "twoActorsSittingTogether": 2,
          "actorsSittingClose": 1,
          "actorSittingAlone": 3,
          "standingNearSitting": 0,
          "multipleActorsSitting": 1,
          "separateFurniture": 0,
          "sittingWithStandingBehind": 0,
          "kneelingBeforeSitting": 1
        },
        "inventory": {
          "actorCarryingItems": 4,
          "actorWithWeapon": 0,
          "itemsAtLocation": 0,
          "actorWithFullInventory": 0,
          "actorWithEmptyInventory": 1,
          "containerWithItems": 0,
          "actorGivingItem": 0,
          "actorDroppingItem": 0,
          "actorPickingUpItem": 0,
          "actorOpeningContainer": 0,
          "actorPuttingItemInContainer": 0
        }
      },
      "oldPatterns": {
        "manualSetup": 5,
        "manualAssertions": 8
      }
    },
    "impact": {
      "lineReduction": {
        "total": 107,
        "average": 26.75,
        "percentage": 59
      },
      "testClarity": {
        "setupLinesPerTest": 6.5,
        "assertionLinesPerTest": 4.2,
        "totalLinesPerTest": 18.25
      },
      "timeToWrite": {
        "beforePatterns": 45,
        "afterPatterns": 20,
        "improvement": 56
      },
      "timeToDebug": {
        "beforePatterns": 30,
        "afterPatterns": 15,
        "improvement": 50
      }
    },
    "quality": {
      "testPassRate": {
        "overall": 100,
        "byModule": {
          "positioning": 100,
          "items": 100
        }
      },
      "flakiness": {
        "flakyTests": 0,
        "flakinessRate": 0
      },
      "maintenance": {
        "testUpdatesPerWeek": 2,
        "testBreakageRate": 5,
        "timeToFix": 1.5
      },
      "coverage": {
        "migratedFiles": 4,
        "totalFiles": 60,
        "migrationProgress": 7
      }
    }
  },
  "history": [
    {
      "timestamp": "2024-01-15T10:30:00Z",
      "migratedFiles": 4,
      "totalLineReduction": 107,
      "patternUsageTotal": 57
    }
  ]
}
```

---

### Step 2: Implement Metrics Collection Scripts

**Duration**: 2 hours

#### 2.1: Create Static Code Analyzer

**File**: `scripts/metrics/collect-pattern-metrics.js`

```javascript
#!/usr/bin/env node

/**
 * Collects metrics on pattern usage across test files
 * Analyzes code for domain matchers, scenario builders, and old patterns
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.join(__dirname, '../..');

// Test directories to scan
const TEST_DIRS = [
  'tests/integration/mods/positioning',
  'tests/integration/mods/items',
  'tests/integration/mods/affection',
  'tests/integration/mods/kissing',
  'tests/integration/mods/caressing',
];

// Pattern definitions
const PATTERNS = {
  domainMatchers: {
    toSucceed: /\.toSucceed\s*\(/g,
    toFail: /\.toFail\s*\(/g,
    toAddComponent: /\.toAddComponent\s*\(/g,
    toRemoveComponent: /\.toRemoveComponent\s*\(/g,
    toUpdateComponent: /\.toUpdateComponent\s*\(/g,
    toHaveComponent: /\.toHaveComponent\s*\(/g,
    toBeAt: /\.toBeAt\s*\(/g,
    toDispatchEvent: /\.toDispatchEvent\s*\(/g,
    toHaveComponentData: /\.toHaveComponentData\s*\(/g,
    toHaveValidationError: /\.toHaveValidationError\s*\(/g,
  },
  scenarioBuilders: {
    sitting: {
      twoActorsSittingTogether: /scenarios\.sitting\.twoActorsSittingTogether/g,
      actorsSittingClose: /scenarios\.sitting\.actorsSittingClose/g,
      actorSittingAlone: /scenarios\.sitting\.actorSittingAlone/g,
      standingNearSitting: /scenarios\.sitting\.standingNearSitting/g,
      multipleActorsSitting: /scenarios\.sitting\.multipleActorsSitting/g,
      separateFurniture: /scenarios\.sitting\.separateFurniture/g,
      sittingWithStandingBehind: /scenarios\.sitting\.sittingWithStandingBehind/g,
      kneelingBeforeSitting: /scenarios\.sitting\.kneelingBeforeSitting/g,
    },
    inventory: {
      actorCarryingItems: /scenarios\.inventory\.actorCarryingItems/g,
      actorWithWeapon: /scenarios\.inventory\.actorWithWeapon/g,
      itemsAtLocation: /scenarios\.inventory\.itemsAtLocation/g,
      actorWithFullInventory: /scenarios\.inventory\.actorWithFullInventory/g,
      actorWithEmptyInventory: /scenarios\.inventory\.actorWithEmptyInventory/g,
      containerWithItems: /scenarios\.inventory\.containerWithItems/g,
      actorGivingItem: /scenarios\.inventory\.actorGivingItem/g,
      actorDroppingItem: /scenarios\.inventory\.actorDroppingItem/g,
      actorPickingUpItem: /scenarios\.inventory\.actorPickingUpItem/g,
      actorOpeningContainer: /scenarios\.inventory\.actorOpeningContainer/g,
      actorPuttingItemInContainer: /scenarios\.inventory\.actorPuttingItemInContainer/g,
    },
  },
  oldPatterns: {
    manualSetup: /testEnv\.given\./g,
    manualSuccess: /result\.success\s*===\s*true/g,
    manualChanges: /result\.changes\.(added|removed)/g,
    manualErrors: /result\.errors\.length/g,
  },
};

/**
 * Analyzes a single test file for pattern usage
 */
async function analyzeFile(filePath) {
  const content = await fs.readFile(filePath, 'utf-8');
  const relativePath = path.relative(PROJECT_ROOT, filePath);

  const metrics = {
    path: relativePath,
    lines: content.split('\n').length,
    domainMatchers: {},
    scenarioBuilders: { sitting: {}, inventory: {} },
    oldPatterns: {},
    migrated: false,
  };

  // Count domain matchers
  let totalMatchers = 0;
  for (const [name, pattern] of Object.entries(PATTERNS.domainMatchers)) {
    const matches = content.match(pattern);
    const count = matches ? matches.length : 0;
    metrics.domainMatchers[name] = count;
    totalMatchers += count;
  }

  // Count scenario builders (sitting)
  let totalSittingScenarios = 0;
  for (const [name, pattern] of Object.entries(PATTERNS.scenarioBuilders.sitting)) {
    const matches = content.match(pattern);
    const count = matches ? matches.length : 0;
    metrics.scenarioBuilders.sitting[name] = count;
    totalSittingScenarios += count;
  }

  // Count scenario builders (inventory)
  let totalInventoryScenarios = 0;
  for (const [name, pattern] of Object.entries(PATTERNS.scenarioBuilders.inventory)) {
    const matches = content.match(pattern);
    const count = matches ? matches.length : 0;
    metrics.scenarioBuilders.inventory[name] = count;
    totalInventoryScenarios += count;
  }

  // Count old patterns
  let totalOldPatterns = 0;
  for (const [name, pattern] of Object.entries(PATTERNS.oldPatterns)) {
    const matches = content.match(pattern);
    const count = matches ? matches.length : 0;
    metrics.oldPatterns[name] = count;
    totalOldPatterns += count;
  }

  // Determine migration status
  // File is "migrated" if it uses new patterns and minimal old patterns
  metrics.migrated = totalMatchers > 0 && totalOldPatterns < 5;
  metrics.totalMatchers = totalMatchers;
  metrics.totalScenarios = totalSittingScenarios + totalInventoryScenarios;
  metrics.totalOldPatterns = totalOldPatterns;

  return metrics;
}

/**
 * Scans all test files and collects metrics
 */
async function collectMetrics() {
  const allMetrics = [];
  let totalFiles = 0;
  let migratedFiles = 0;

  for (const dir of TEST_DIRS) {
    const dirPath = path.join(PROJECT_ROOT, dir);
    try {
      const files = await fs.readdir(dirPath);

      for (const file of files) {
        if (file.endsWith('.test.js') && !file.includes('.backup')) {
          const filePath = path.join(dirPath, file);
          const metrics = await analyzeFile(filePath);
          allMetrics.push(metrics);
          totalFiles++;
          if (metrics.migrated) migratedFiles++;
        }
      }
    } catch (err) {
      console.warn(`Warning: Could not scan ${dir}: ${err.message}`);
    }
  }

  return {
    files: allMetrics,
    summary: {
      totalFiles,
      migratedFiles,
      migrationProgress: Math.round((migratedFiles / totalFiles) * 100),
    },
  };
}

/**
 * Aggregates metrics across all files
 */
function aggregateMetrics(metricsData) {
  const aggregated = {
    domainMatchers: {
      total: 0,
      perFile: 0,
      byType: {},
    },
    scenarioBuilders: {
      total: 0,
      perFile: 0,
      sitting: {},
      inventory: {},
    },
    oldPatterns: {
      total: 0,
      byType: {},
    },
  };

  // Aggregate domain matchers
  for (const file of metricsData.files) {
    for (const [name, count] of Object.entries(file.domainMatchers)) {
      aggregated.domainMatchers.byType[name] =
        (aggregated.domainMatchers.byType[name] || 0) + count;
      aggregated.domainMatchers.total += count;
    }
  }
  aggregated.domainMatchers.perFile =
    metricsData.summary.totalFiles > 0
      ? (aggregated.domainMatchers.total / metricsData.summary.totalFiles).toFixed(2)
      : 0;

  // Aggregate scenario builders
  for (const file of metricsData.files) {
    for (const [name, count] of Object.entries(file.scenarioBuilders.sitting)) {
      aggregated.scenarioBuilders.sitting[name] =
        (aggregated.scenarioBuilders.sitting[name] || 0) + count;
      aggregated.scenarioBuilders.total += count;
    }
    for (const [name, count] of Object.entries(file.scenarioBuilders.inventory)) {
      aggregated.scenarioBuilders.inventory[name] =
        (aggregated.scenarioBuilders.inventory[name] || 0) + count;
      aggregated.scenarioBuilders.total += count;
    }
  }
  aggregated.scenarioBuilders.perFile =
    metricsData.summary.totalFiles > 0
      ? (aggregated.scenarioBuilders.total / metricsData.summary.totalFiles).toFixed(2)
      : 0;

  // Aggregate old patterns
  for (const file of metricsData.files) {
    for (const [name, count] of Object.entries(file.oldPatterns)) {
      aggregated.oldPatterns.byType[name] =
        (aggregated.oldPatterns.byType[name] || 0) + count;
      aggregated.oldPatterns.total += count;
    }
  }

  return aggregated;
}

/**
 * Generates metrics summary report
 */
function generateReport(metricsData, aggregated) {
  console.log('\n=== Pattern Usage Metrics ===\n');

  console.log(`Total Test Files: ${metricsData.summary.totalFiles}`);
  console.log(`Migrated Files: ${metricsData.summary.migratedFiles} (${metricsData.summary.migrationProgress}%)`);
  console.log('');

  console.log('Domain Matchers:');
  console.log(`  Total Usages: ${aggregated.domainMatchers.total}`);
  console.log(`  Average per File: ${aggregated.domainMatchers.perFile}`);
  console.log('  By Type:');
  for (const [name, count] of Object.entries(aggregated.domainMatchers.byType)) {
    if (count > 0) {
      console.log(`    ${name}: ${count}`);
    }
  }
  console.log('');

  console.log('Scenario Builders:');
  console.log(`  Total Usages: ${aggregated.scenarioBuilders.total}`);
  console.log(`  Average per File: ${aggregated.scenarioBuilders.perFile}`);
  console.log('  Sitting Scenarios:');
  for (const [name, count] of Object.entries(aggregated.scenarioBuilders.sitting)) {
    if (count > 0) {
      console.log(`    ${name}: ${count}`);
    }
  }
  console.log('  Inventory Scenarios:');
  for (const [name, count] of Object.entries(aggregated.scenarioBuilders.inventory)) {
    if (count > 0) {
      console.log(`    ${name}: ${count}`);
    }
  }
  console.log('');

  console.log('Old Patterns (remaining):');
  console.log(`  Total: ${aggregated.oldPatterns.total}`);
  for (const [name, count] of Object.entries(aggregated.oldPatterns.byType)) {
    if (count > 0) {
      console.log(`    ${name}: ${count}`);
    }
  }
  console.log('');

  console.log('Top Pattern Adopters:');
  const sortedFiles = metricsData.files
    .filter((f) => f.migrated)
    .sort((a, b) => b.totalMatchers + b.totalScenarios - (a.totalMatchers + a.totalScenarios))
    .slice(0, 10);

  sortedFiles.forEach((file, index) => {
    console.log(
      `  ${index + 1}. ${path.basename(file.path)}: ${file.totalMatchers} matchers, ${file.totalScenarios} scenarios`
    );
  });
}

/**
 * Saves metrics to JSON file
 */
async function saveMetrics(metricsData, aggregated) {
  const metricsDir = path.join(PROJECT_ROOT, 'metrics');
  await fs.mkdir(metricsDir, { recursive: true });

  const output = {
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    summary: metricsData.summary,
    aggregated,
    files: metricsData.files,
  };

  const outputPath = path.join(metricsDir, 'pattern-metrics.json');
  await fs.writeFile(outputPath, JSON.stringify(output, null, 2));
  console.log(`\n✓ Metrics saved to ${outputPath}`);
}

/**
 * Main execution
 */
async function main() {
  console.log('Collecting pattern usage metrics...');

  const metricsData = await collectMetrics();
  const aggregated = aggregateMetrics(metricsData);

  generateReport(metricsData, aggregated);
  await saveMetrics(metricsData, aggregated);

  console.log('\n✓ Metrics collection complete');
}

main().catch((err) => {
  console.error('Error collecting metrics:', err);
  process.exit(1);
});
```

**Usage**:
```bash
# Collect pattern metrics
chmod +x scripts/metrics/collect-pattern-metrics.js
node scripts/metrics/collect-pattern-metrics.js

# View metrics
cat metrics/pattern-metrics.json | jq '.aggregated'
```

---

#### 2.2: Create Git History Analyzer

**File**: `scripts/metrics/analyze-git-history.sh`

```bash
#!/bin/bash
set -e

#
# Analyzes Git history to track migration velocity and code changes
#

METRICS_DIR="metrics"
OUTPUT_FILE="$METRICS_DIR/git-history-metrics.json"

mkdir -p "$METRICS_DIR"

echo "Analyzing Git history for migration metrics..."

# Get commits related to migration
MIGRATION_COMMITS=$(git log --oneline --grep="migrate.*test" --grep="MODTESTROB" --all --format="%H %ci %s" | head -20)

# Count files changed per commit
echo "Calculating file changes..."

# Initialize JSON output
cat > "$OUTPUT_FILE" <<EOF
{
  "version": "1.0.0",
  "timestamp": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "commits": [
EOF

FIRST=true

# Process each migration commit
while IFS= read -r line; do
  HASH=$(echo "$line" | awk '{print $1}')
  DATE=$(echo "$line" | awk '{print $2}')
  MESSAGE=$(echo "$line" | cut -d' ' -f4-)
  
  # Get files changed
  FILES_CHANGED=$(git diff-tree --no-commit-id --name-only -r "$HASH" | grep "\.test\.js$" | wc -l)
  
  # Get line changes
  LINES_ADDED=$(git show "$HASH" --numstat | grep "\.test\.js$" | awk '{sum+=$1} END {print sum+0}')
  LINES_REMOVED=$(git show "$HASH" --numstat | grep "\.test\.js$" | awk '{sum+=$2} END {print sum+0}')
  NET_CHANGE=$((LINES_ADDED - LINES_REMOVED))
  
  # Add to JSON (skip if no test files changed)
  if [ "$FILES_CHANGED" -gt 0 ]; then
    if [ "$FIRST" = false ]; then
      echo "," >> "$OUTPUT_FILE"
    fi
    FIRST=false
    
    cat >> "$OUTPUT_FILE" <<EOF
    {
      "hash": "$HASH",
      "date": "$DATE",
      "message": "$MESSAGE",
      "filesChanged": $FILES_CHANGED,
      "linesAdded": $LINES_ADDED,
      "linesRemoved": $LINES_REMOVED,
      "netChange": $NET_CHANGE
    }
EOF
  fi
done <<< "$MIGRATION_COMMITS"

# Close JSON
cat >> "$OUTPUT_FILE" <<EOF

  ],
  "summary": {
    "totalMigrationCommits": $(echo "$MIGRATION_COMMITS" | grep -c "^" || echo 0),
    "totalFilesChanged": $(git log --grep="migrate.*test" --grep="MODTESTROB" --all --name-only --format="" | grep "\.test\.js$" | sort -u | wc -l),
    "totalLinesAdded": $(git log --grep="migrate.*test" --grep="MODTESTROB" --all --numstat | grep "\.test\.js$" | awk '{sum+=$1} END {print sum+0}'),
    "totalLinesRemoved": $(git log --grep="migrate.*test" --grep="MODTESTROB" --all --numstat | grep "\.test\.js$" | awk '{sum+=$2} END {print sum+0}'),
    "netLineChange": $(git log --grep="migrate.*test" --grep="MODTESTROB" --all --numstat | grep "\.test\.js$" | awk '{added+=$1; removed+=$2} END {print (added-removed)+0}')
  }
}
EOF

echo ""
echo "=== Git History Summary ==="
cat "$OUTPUT_FILE" | jq '.summary'

echo ""
echo "✓ Git history metrics saved to $OUTPUT_FILE"
```

**Usage**:
```bash
# Analyze Git history
chmod +x scripts/metrics/analyze-git-history.sh
./scripts/metrics/analyze-git-history.sh

# View summary
cat metrics/git-history-metrics.json | jq '.summary'
```

---

#### 2.3: Create Test Execution Metrics Collector

**File**: `scripts/metrics/collect-test-execution-metrics.js`

```javascript
#!/usr/bin/env node

/**
 * Collects test execution metrics from Jest output
 * Tracks pass rates, execution times, flakiness
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.join(__dirname, '../..');

/**
 * Runs Jest and collects output
 */
async function runTests() {
  console.log('Running tests to collect execution metrics...');

  try {
    const { stdout, stderr } = await execAsync(
      'NODE_ENV=test npm run test:integration -- --json --silent',
      {
        cwd: PROJECT_ROOT,
        maxBuffer: 10 * 1024 * 1024, // 10MB buffer
      }
    );

    return JSON.parse(stdout);
  } catch (err) {
    // Jest exits with code 1 if tests fail, but we still want the output
    if (err.stdout) {
      try {
        return JSON.parse(err.stdout);
      } catch {
        throw new Error('Failed to parse Jest output');
      }
    }
    throw err;
  }
}

/**
 * Analyzes test results for metrics
 */
function analyzeResults(jestOutput) {
  const metrics = {
    timestamp: new Date().toISOString(),
    overall: {
      totalTests: jestOutput.numTotalTests,
      passedTests: jestOutput.numPassedTests,
      failedTests: jestOutput.numFailedTests,
      pendingTests: jestOutput.numPendingTests,
      passRate: Math.round((jestOutput.numPassedTests / jestOutput.numTotalTests) * 100),
    },
    suites: {
      total: jestOutput.numTotalTestSuites,
      passed: jestOutput.numPassedTestSuites,
      failed: jestOutput.numFailedTestSuites,
    },
    timing: {
      totalDuration: jestOutput.testResults.reduce((sum, suite) => sum + (suite.perfStats?.runtime || 0), 0),
      averagePerSuite: 0,
      slowestSuites: [],
    },
    byModule: {},
    flakiness: {
      flakyTests: [],
      potentiallyFlaky: [],
    },
  };

  // Calculate average timing
  metrics.timing.averagePerSuite =
    metrics.suites.total > 0
      ? Math.round(metrics.timing.totalDuration / metrics.suites.total)
      : 0;

  // Identify slowest suites
  metrics.timing.slowestSuites = jestOutput.testResults
    .map((suite) => ({
      name: path.basename(suite.name),
      duration: suite.perfStats?.runtime || 0,
    }))
    .sort((a, b) => b.duration - a.duration)
    .slice(0, 10);

  // Analyze by module
  for (const suite of jestOutput.testResults) {
    const match = suite.name.match(/mods\/([^/]+)\//);
    if (match) {
      const module = match[1];
      if (!metrics.byModule[module]) {
        metrics.byModule[module] = {
          totalTests: 0,
          passedTests: 0,
          failedTests: 0,
          passRate: 0,
        };
      }

      metrics.byModule[module].totalTests += suite.numPassingTests + suite.numFailingTests;
      metrics.byModule[module].passedTests += suite.numPassingTests;
      metrics.byModule[module].failedTests += suite.numFailingTests;
    }
  }

  // Calculate pass rates per module
  for (const module of Object.keys(metrics.byModule)) {
    const moduleData = metrics.byModule[module];
    moduleData.passRate =
      moduleData.totalTests > 0
        ? Math.round((moduleData.passedTests / moduleData.totalTests) * 100)
        : 0;
  }

  return metrics;
}

/**
 * Saves metrics to file
 */
async function saveMetrics(metrics) {
  const metricsDir = path.join(PROJECT_ROOT, 'metrics');
  await fs.mkdir(metricsDir, { recursive: true });

  const outputPath = path.join(metricsDir, 'test-execution-metrics.json');
  await fs.writeFile(outputPath, JSON.stringify(metrics, null, 2));
  console.log(`\n✓ Test execution metrics saved to ${outputPath}`);

  return outputPath;
}

/**
 * Generates report
 */
function generateReport(metrics) {
  console.log('\n=== Test Execution Metrics ===\n');

  console.log('Overall Results:');
  console.log(`  Total Tests: ${metrics.overall.totalTests}`);
  console.log(`  Passed: ${metrics.overall.passedTests}`);
  console.log(`  Failed: ${metrics.overall.failedTests}`);
  console.log(`  Pending: ${metrics.overall.pendingTests}`);
  console.log(`  Pass Rate: ${metrics.overall.passRate}%`);
  console.log('');

  console.log('Test Suites:');
  console.log(`  Total: ${metrics.suites.total}`);
  console.log(`  Passed: ${metrics.suites.passed}`);
  console.log(`  Failed: ${metrics.suites.failed}`);
  console.log('');

  console.log('Timing:');
  console.log(`  Total Duration: ${metrics.timing.totalDuration}ms`);
  console.log(`  Average per Suite: ${metrics.timing.averagePerSuite}ms`);
  console.log('  Slowest Suites:');
  metrics.timing.slowestSuites.slice(0, 5).forEach((suite, index) => {
    console.log(`    ${index + 1}. ${suite.name}: ${suite.duration}ms`);
  });
  console.log('');

  console.log('By Module:');
  for (const [module, data] of Object.entries(metrics.byModule)) {
    console.log(
      `  ${module}: ${data.passedTests}/${data.totalTests} passed (${data.passRate}%)`
    );
  }
}

/**
 * Main execution
 */
async function main() {
  const jestOutput = await runTests();
  const metrics = analyzeResults(jestOutput);

  generateReport(metrics);
  await saveMetrics(metrics);

  console.log('\n✓ Test execution metrics collection complete');
}

main().catch((err) => {
  console.error('Error collecting test execution metrics:', err);
  process.exit(1);
});
```

**Usage**:
```bash
# Collect test execution metrics
chmod +x scripts/metrics/collect-test-execution-metrics.js
node scripts/metrics/collect-test-execution-metrics.js

# View metrics
cat metrics/test-execution-metrics.json | jq '.overall'
```

---

### Step 3: Create Metrics Dashboard

**Duration**: 2 hours

#### 3.1: Build Dashboard Generator

**File**: `scripts/metrics/generate-dashboard.js`

```javascript
#!/usr/bin/env node

/**
 * Generates HTML dashboard from collected metrics
 * Creates visual representation of pattern adoption and impact
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.join(__dirname, '../..');

/**
 * Loads all metrics files
 */
async function loadMetrics() {
  const metricsDir = path.join(PROJECT_ROOT, 'metrics');

  const patternMetrics = JSON.parse(
    await fs.readFile(path.join(metricsDir, 'pattern-metrics.json'), 'utf-8')
  );

  const gitMetrics = JSON.parse(
    await fs.readFile(path.join(metricsDir, 'git-history-metrics.json'), 'utf-8')
  );

  const testMetrics = JSON.parse(
    await fs.readFile(path.join(metricsDir, 'test-execution-metrics.json'), 'utf-8')
  );

  return { patternMetrics, gitMetrics, testMetrics };
}

/**
 * Generates HTML dashboard
 */
function generateDashboardHTML(metrics) {
  const { patternMetrics, gitMetrics, testMetrics } = metrics;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Mod Testing Robustness - Metrics Dashboard</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      background: #f5f5f5;
      color: #333;
      padding: 20px;
    }

    .container {
      max-width: 1200px;
      margin: 0 auto;
      background: white;
      padding: 30px;
      border-radius: 8px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    }

    h1 {
      color: #2c3e50;
      margin-bottom: 10px;
      font-size: 2.5em;
    }

    .subtitle {
      color: #7f8c8d;
      margin-bottom: 30px;
      font-size: 1.1em;
    }

    .timestamp {
      color: #95a5a6;
      font-size: 0.9em;
      margin-bottom: 30px;
    }

    .metrics-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 20px;
      margin-bottom: 40px;
    }

    .metric-card {
      background: #ecf0f1;
      padding: 20px;
      border-radius: 8px;
      border-left: 4px solid #3498db;
    }

    .metric-card.success {
      border-left-color: #27ae60;
    }

    .metric-card.warning {
      border-left-color: #f39c12;
    }

    .metric-card.info {
      border-left-color: #3498db;
    }

    .metric-title {
      font-size: 0.9em;
      color: #7f8c8d;
      margin-bottom: 8px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .metric-value {
      font-size: 2.5em;
      font-weight: bold;
      color: #2c3e50;
    }

    .metric-subtitle {
      font-size: 0.9em;
      color: #95a5a6;
      margin-top: 5px;
    }

    .section {
      margin-bottom: 40px;
    }

    .section-title {
      font-size: 1.8em;
      color: #2c3e50;
      margin-bottom: 20px;
      border-bottom: 2px solid #ecf0f1;
      padding-bottom: 10px;
    }

    .progress-bar {
      width: 100%;
      height: 30px;
      background: #ecf0f1;
      border-radius: 15px;
      overflow: hidden;
      margin: 15px 0;
    }

    .progress-fill {
      height: 100%;
      background: linear-gradient(90deg, #3498db, #2ecc71);
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-weight: bold;
      transition: width 0.3s ease;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      margin: 20px 0;
    }

    th, td {
      padding: 12px;
      text-align: left;
      border-bottom: 1px solid #ecf0f1;
    }

    th {
      background: #ecf0f1;
      font-weight: 600;
      color: #2c3e50;
    }

    tr:hover {
      background: #f8f9fa;
    }

    .badge {
      display: inline-block;
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 0.85em;
      font-weight: 600;
    }

    .badge.success {
      background: #d5f4e6;
      color: #27ae60;
    }

    .badge.info {
      background: #d6eaf8;
      color: #3498db;
    }

    .badge.warning {
      background: #fdebd0;
      color: #f39c12;
    }

    .chart {
      margin: 20px 0;
      padding: 20px;
      background: #f8f9fa;
      border-radius: 8px;
    }

    .bar-chart {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .bar-item {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .bar-label {
      width: 180px;
      font-size: 0.9em;
      color: #7f8c8d;
    }

    .bar {
      flex: 1;
      height: 25px;
      background: #ecf0f1;
      border-radius: 4px;
      overflow: hidden;
    }

    .bar-fill {
      height: 100%;
      background: linear-gradient(90deg, #3498db, #2ecc71);
      display: flex;
      align-items: center;
      padding-left: 10px;
      color: white;
      font-size: 0.85em;
      font-weight: 600;
    }

    .footer {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 2px solid #ecf0f1;
      text-align: center;
      color: #95a5a6;
      font-size: 0.9em;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>🎯 Mod Testing Robustness Metrics</h1>
    <div class="subtitle">Pattern Adoption and Impact Dashboard</div>
    <div class="timestamp">Last Updated: ${new Date(patternMetrics.timestamp).toLocaleString()}</div>

    <!-- Key Metrics -->
    <div class="metrics-grid">
      <div class="metric-card success">
        <div class="metric-title">Migration Progress</div>
        <div class="metric-value">${patternMetrics.summary.migrationProgress}%</div>
        <div class="metric-subtitle">${patternMetrics.summary.migratedFiles} of ${patternMetrics.summary.totalFiles} files</div>
      </div>

      <div class="metric-card info">
        <div class="metric-title">Domain Matchers</div>
        <div class="metric-value">${patternMetrics.aggregated.domainMatchers.total}</div>
        <div class="metric-subtitle">${patternMetrics.aggregated.domainMatchers.perFile} avg per file</div>
      </div>

      <div class="metric-card info">
        <div class="metric-title">Scenario Builders</div>
        <div class="metric-value">${patternMetrics.aggregated.scenarioBuilders.total}</div>
        <div class="metric-subtitle">${patternMetrics.aggregated.scenarioBuilders.perFile} avg per file</div>
      </div>

      <div class="metric-card ${testMetrics.overall.passRate === 100 ? 'success' : 'warning'}">
        <div class="metric-title">Test Pass Rate</div>
        <div class="metric-value">${testMetrics.overall.passRate}%</div>
        <div class="metric-subtitle">${testMetrics.overall.passedTests}/${testMetrics.overall.totalTests} tests</div>
      </div>
    </div>

    <!-- Migration Progress Bar -->
    <div class="section">
      <div class="section-title">Migration Status</div>
      <div class="progress-bar">
        <div class="progress-fill" style="width: ${patternMetrics.summary.migrationProgress}%">
          ${patternMetrics.summary.migrationProgress}% Complete
        </div>
      </div>
      <p style="color: #7f8c8d; margin-top: 10px;">
        ${patternMetrics.summary.migratedFiles} files migrated, 
        ${patternMetrics.summary.totalFiles - patternMetrics.summary.migratedFiles} remaining
      </p>
    </div>

    <!-- Domain Matcher Usage -->
    <div class="section">
      <div class="section-title">Domain Matcher Adoption</div>
      <div class="chart bar-chart">
        ${Object.entries(patternMetrics.aggregated.domainMatchers.byType)
          .sort((a, b) => b[1] - a[1])
          .map(
            ([name, count]) => `
        <div class="bar-item">
          <div class="bar-label">${name}</div>
          <div class="bar">
            <div class="bar-fill" style="width: ${count > 0 ? Math.min((count / patternMetrics.aggregated.domainMatchers.total) * 100, 100) : 0}%">
              ${count}
            </div>
          </div>
        </div>
        `
          )
          .join('')}
      </div>
    </div>

    <!-- Scenario Builder Usage -->
    <div class="section">
      <div class="section-title">Scenario Builder Adoption</div>
      <div class="chart bar-chart">
        <h4 style="margin-bottom: 15px; color: #7f8c8d;">Sitting Scenarios</h4>
        ${Object.entries(patternMetrics.aggregated.scenarioBuilders.sitting)
          .filter(([, count]) => count > 0)
          .sort((a, b) => b[1] - a[1])
          .map(
            ([name, count]) => `
        <div class="bar-item">
          <div class="bar-label">${name}</div>
          <div class="bar">
            <div class="bar-fill" style="width: ${Math.min((count / patternMetrics.aggregated.scenarioBuilders.total) * 100, 100)}%">
              ${count}
            </div>
          </div>
        </div>
        `
          )
          .join('')}
      </div>
      <div class="chart bar-chart">
        <h4 style="margin-bottom: 15px; color: #7f8c8d;">Inventory Scenarios</h4>
        ${Object.entries(patternMetrics.aggregated.scenarioBuilders.inventory)
          .filter(([, count]) => count > 0)
          .sort((a, b) => b[1] - a[1])
          .map(
            ([name, count]) => `
        <div class="bar-item">
          <div class="bar-label">${name}</div>
          <div class="bar">
            <div class="bar-fill" style="width: ${Math.min((count / patternMetrics.aggregated.scenarioBuilders.total) * 100, 100)}%">
              ${count}
            </div>
          </div>
        </div>
        `
          )
          .join('')}
      </div>
    </div>

    <!-- Git History -->
    <div class="section">
      <div class="section-title">Migration Activity</div>
      <div class="metrics-grid">
        <div class="metric-card info">
          <div class="metric-title">Migration Commits</div>
          <div class="metric-value">${gitMetrics.summary.totalMigrationCommits}</div>
          <div class="metric-subtitle">Total commits</div>
        </div>
        <div class="metric-card info">
          <div class="metric-title">Files Changed</div>
          <div class="metric-value">${gitMetrics.summary.totalFilesChanged}</div>
          <div class="metric-subtitle">Unique files</div>
        </div>
        <div class="metric-card ${gitMetrics.summary.netLineChange < 0 ? 'success' : 'info'}">
          <div class="metric-title">Net Line Change</div>
          <div class="metric-value">${gitMetrics.summary.netLineChange}</div>
          <div class="metric-subtitle">${gitMetrics.summary.totalLinesRemoved} removed, ${gitMetrics.summary.totalLinesAdded} added</div>
        </div>
      </div>
    </div>

    <!-- Test Execution -->
    <div class="section">
      <div class="section-title">Test Execution Quality</div>
      <table>
        <thead>
          <tr>
            <th>Module</th>
            <th>Total Tests</th>
            <th>Passed</th>
            <th>Failed</th>
            <th>Pass Rate</th>
          </tr>
        </thead>
        <tbody>
          ${Object.entries(testMetrics.byModule)
            .sort((a, b) => b[1].totalTests - a[1].totalTests)
            .map(
              ([module, data]) => `
          <tr>
            <td><strong>${module}</strong></td>
            <td>${data.totalTests}</td>
            <td style="color: #27ae60;">${data.passedTests}</td>
            <td style="color: ${data.failedTests > 0 ? '#e74c3c' : '#95a5a6'};">${data.failedTests}</td>
            <td>
              <span class="badge ${data.passRate === 100 ? 'success' : data.passRate >= 80 ? 'info' : 'warning'}">
                ${data.passRate}%
              </span>
            </td>
          </tr>
          `
            )
            .join('')}
        </tbody>
      </table>
    </div>

    <!-- Top Adopters -->
    <div class="section">
      <div class="section-title">Top Pattern Adopters</div>
      <table>
        <thead>
          <tr>
            <th>Test File</th>
            <th>Domain Matchers</th>
            <th>Scenario Builders</th>
            <th>Total Patterns</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          ${patternMetrics.files
            .filter((f) => f.migrated)
            .sort((a, b) => b.totalMatchers + b.totalScenarios - (a.totalMatchers + a.totalScenarios))
            .slice(0, 15)
            .map(
              (file) => `
          <tr>
            <td><strong>${path.basename(file.path)}</strong></td>
            <td>${file.totalMatchers}</td>
            <td>${file.totalScenarios}</td>
            <td><strong>${file.totalMatchers + file.totalScenarios}</strong></td>
            <td>
              <span class="badge success">✓ Migrated</span>
            </td>
          </tr>
          `
            )
            .join('')}
        </tbody>
      </table>
    </div>

    <div class="footer">
      Generated by MODTESTROB-011 Success Metrics Dashboard<br>
      <small>Data collected from pattern analysis, Git history, and test execution</small>
    </div>
  </div>
</body>
</html>`;
}

/**
 * Saves dashboard HTML
 */
async function saveDashboard(html) {
  const metricsDir = path.join(PROJECT_ROOT, 'metrics');
  await fs.mkdir(metricsDir, { recursive: true });

  const outputPath = path.join(metricsDir, 'dashboard.html');
  await fs.writeFile(outputPath, html);

  console.log(`\n✓ Dashboard generated at ${outputPath}`);
  console.log(`  Open in browser: file://${outputPath}`);

  return outputPath;
}

/**
 * Main execution
 */
async function main() {
  console.log('Loading metrics data...');
  const metrics = await loadMetrics();

  console.log('Generating dashboard HTML...');
  const html = generateDashboardHTML(metrics);

  await saveDashboard(html);

  console.log('\n✓ Dashboard generation complete');
}

main().catch((err) => {
  console.error('Error generating dashboard:', err);
  process.exit(1);
});
```

**Usage**:
```bash
# Generate dashboard
chmod +x scripts/metrics/generate-dashboard.js
node scripts/metrics/generate-dashboard.js

# Open dashboard in browser
open metrics/dashboard.html
# or
firefox metrics/dashboard.html
```

---

### Step 4: Create Automated Collection Workflow

**Duration**: 1 hour

#### 4.1: Create Master Collection Script

**File**: `scripts/metrics/collect-all-metrics.sh`

```bash
#!/bin/bash
set -e

#
# Master script to collect all metrics and generate dashboard
# Run this after any migration activity to update metrics
#

echo "======================================"
echo "Collecting All Metrics"
echo "======================================"
echo ""

# Collect pattern metrics
echo "1/4 Collecting pattern usage metrics..."
node scripts/metrics/collect-pattern-metrics.js
echo ""

# Analyze Git history
echo "2/4 Analyzing Git history..."
./scripts/metrics/analyze-git-history.sh
echo ""

# Collect test execution metrics
echo "3/4 Collecting test execution metrics..."
node scripts/metrics/collect-test-execution-metrics.js
echo ""

# Generate dashboard
echo "4/4 Generating dashboard..."
node scripts/metrics/generate-dashboard.js
echo ""

echo "======================================"
echo "✓ All metrics collected successfully"
echo "======================================"
echo ""
echo "View dashboard:"
echo "  metrics/dashboard.html"
echo ""
echo "View raw data:"
echo "  metrics/pattern-metrics.json"
echo "  metrics/git-history-metrics.json"
echo "  metrics/test-execution-metrics.json"
```

**Usage**:
```bash
# Collect all metrics at once
chmod +x scripts/metrics/collect-all-metrics.sh
./scripts/metrics/collect-all-metrics.sh

# View dashboard
open metrics/dashboard.html
```

---

#### 4.2: Create Scheduled Collection (Optional)

**File**: `.github/workflows/collect-metrics.yml` (if using GitHub Actions)

```yaml
name: Collect Metrics

on:
  schedule:
    # Run daily at midnight UTC
    - cron: '0 0 * * *'
  workflow_dispatch: # Allow manual trigger

jobs:
  collect-metrics:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0 # Need full history for Git analysis

      - uses: actions/setup-node@v4
        with:
          node-version: '18'

      - name: Install dependencies
        run: npm ci

      - name: Make scripts executable
        run: |
          chmod +x scripts/metrics/collect-all-metrics.sh
          chmod +x scripts/metrics/analyze-git-history.sh

      - name: Collect all metrics
        run: ./scripts/metrics/collect-all-metrics.sh

      - name: Commit metrics
        run: |
          git config user.name "GitHub Actions"
          git config user.email "actions@github.com"
          git add metrics/
          git diff --quiet && git diff --staged --quiet || git commit -m "chore: update metrics dashboard [skip ci]"
          git push

      - name: Upload dashboard artifact
        uses: actions/upload-artifact@v4
        with:
          name: metrics-dashboard
          path: metrics/dashboard.html
```

---

### Step 5: Document Metrics System

**Duration**: 1 hour

#### 5.1: Create Metrics Documentation

**File**: `docs/testing/metrics-system.md`

```markdown
# Metrics System Documentation

Comprehensive guide to the mod testing metrics collection and dashboard system.

---

## Overview

The metrics system tracks:

1. **Pattern Adoption**: Domain matchers and scenario builder usage
2. **Impact**: Line reduction, test clarity, time savings
3. **Quality**: Test pass rates, flakiness, maintenance burden
4. **Trends**: Progress over time

---

## Quick Start

### Collect Metrics

```bash
# Collect all metrics and generate dashboard
./scripts/metrics/collect-all-metrics.sh

# View dashboard
open metrics/dashboard.html
```

### View Metrics

**Dashboard** - `metrics/dashboard.html`:
- Visual representation of all metrics
- Key performance indicators
- Trend charts and tables
- Top pattern adopters

**Raw Data**:
- `metrics/pattern-metrics.json` - Pattern usage statistics
- `metrics/git-history-metrics.json` - Migration activity
- `metrics/test-execution-metrics.json` - Test quality metrics

---

## Metrics Taxonomy

### Pattern Adoption Metrics

**Domain Matchers** (`adoption.domainMatchers`):
- `total`: Total matcher usages across all tests
- `perFile`: Average matchers per file
- `byType`: Breakdown by matcher type (toSucceed, toFail, etc.)

**Scenario Builders** (`adoption.scenarioBuilders`):
- `total`: Total scenario builder usages
- `perFile`: Average scenarios per file
- `sitting`: Breakdown of sitting scenario types
- `inventory`: Breakdown of inventory scenario types

**Old Patterns** (`adoption.oldPatterns`):
- `manualSetup`: Remaining old setup patterns
- `manualAssertions`: Remaining old assertion patterns

### Impact Metrics

**Line Reduction** (`impact.lineReduction`):
- `total`: Total lines reduced across migrations
- `average`: Average reduction per file
- `percentage`: Percentage reduction in test code

**Test Clarity** (`impact.testClarity`):
- `setupLinesPerTest`: Average setup lines per test
- `assertionLinesPerTest`: Average assertion lines per test
- `totalLinesPerTest`: Average total lines per test

**Time Metrics** (`impact.timeToWrite`, `impact.timeToDebug`):
- `beforePatterns`: Average time before patterns (minutes)
- `afterPatterns`: Average time after patterns (minutes)
- `improvement`: Percentage improvement

### Quality Metrics

**Test Pass Rate** (`quality.testPassRate`):
- `overall`: Overall pass rate percentage
- `byModule`: Pass rate by module (positioning, items, etc.)
- `trend`: Pass rate over time

**Flakiness** (`quality.flakiness`):
- `flakyTests`: Number of flaky tests
- `flakinessRate`: Percentage of flaky tests

**Maintenance** (`quality.maintenance`):
- `testUpdatesPerWeek`: Test update frequency
- `testBreakageRate`: Test breakage frequency
- `timeToFix`: Average time to fix broken tests

**Coverage** (`quality.coverage`):
- `migratedFiles`: Number of migrated files
- `totalFiles`: Total test files
- `migrationProgress`: Migration percentage

---

## Collection Scripts

### Pattern Metrics Collector

**Script**: `scripts/metrics/collect-pattern-metrics.js`

**Purpose**: Analyzes test files for pattern usage

**Output**: `metrics/pattern-metrics.json`

**Detects**:
- Domain matcher usage (toSucceed, toAddComponent, etc.)
- Scenario builder usage (sitting, inventory)
- Old pattern remnants

**Usage**:
```bash
node scripts/metrics/collect-pattern-metrics.js
```

### Git History Analyzer

**Script**: `scripts/metrics/analyze-git-history.sh`

**Purpose**: Tracks migration activity in Git history

**Output**: `metrics/git-history-metrics.json`

**Analyzes**:
- Migration commits
- Files changed per commit
- Line additions/deletions
- Net line changes

**Usage**:
```bash
./scripts/metrics/analyze-git-history.sh
```

### Test Execution Metrics Collector

**Script**: `scripts/metrics/collect-test-execution-metrics.js`

**Purpose**: Collects test quality metrics from Jest

**Output**: `metrics/test-execution-metrics.json`

**Tracks**:
- Overall pass/fail rates
- Test execution times
- Module-level statistics
- Slowest test suites

**Usage**:
```bash
node scripts/metrics/collect-test-execution-metrics.js
```

### Dashboard Generator

**Script**: `scripts/metrics/generate-dashboard.js`

**Purpose**: Creates HTML dashboard from metrics

**Output**: `metrics/dashboard.html`

**Features**:
- Visual KPI cards
- Progress bars
- Bar charts for pattern adoption
- Tables for detailed data

**Usage**:
```bash
node scripts/metrics/generate-dashboard.js
open metrics/dashboard.html
```

---

## Metrics Workflow

### Daily Workflow

1. **After Migration**:
   ```bash
   # Migrate test files
   # ...
   
   # Collect updated metrics
   ./scripts/metrics/collect-all-metrics.sh
   
   # View dashboard
   open metrics/dashboard.html
   ```

2. **Weekly Review**:
   - Review dashboard for trends
   - Check pattern adoption rates
   - Identify low-adoption patterns
   - Plan improvements

3. **Monthly Analysis**:
   - Compare metrics month-over-month
   - Calculate ROI on testing improvements
   - Report to team/stakeholders
   - Plan next quarter goals

### Automated Collection

**GitHub Actions** (optional):
- Runs daily at midnight UTC
- Collects all metrics automatically
- Commits updated metrics to repo
- Uploads dashboard as artifact

**Setup**:
1. Enable GitHub Actions workflow in `.github/workflows/collect-metrics.yml`
2. View automated dashboards in Actions artifacts
3. Track trends over time automatically

---

## Dashboard Interpretation

### Key Performance Indicators

**Migration Progress**:
- **Goal**: 80% of files migrated
- **Green**: >60%
- **Yellow**: 40-60%
- **Red**: <40%

**Domain Matcher Adoption**:
- **Goal**: 3+ per file average
- **Green**: >2.5
- **Yellow**: 1.5-2.5
- **Red**: <1.5

**Scenario Builder Adoption**:
- **Goal**: 1+ per file average
- **Green**: >0.8
- **Yellow**: 0.4-0.8
- **Red**: <0.4

**Test Pass Rate**:
- **Goal**: 100%
- **Green**: 100%
- **Yellow**: 95-99%
- **Red**: <95%

### Trend Analysis

**Positive Trends**:
- Increasing pattern adoption
- Decreasing line counts
- Stable/improving pass rates
- Reducing debug time

**Negative Trends**:
- Stagnant adoption
- Increasing test complexity
- Declining pass rates
- Rising flakiness

**Action Items**:
- If adoption stagnant → Promote patterns more
- If complexity increasing → Review pattern design
- If pass rate declining → Fix flaky tests
- If debugging time up → Improve error messages

---

## Best Practices

### Collection Frequency

- **After every migration**: Update metrics immediately
- **Daily automated**: Via GitHub Actions or cron job
- **Weekly manual review**: Check trends and plan
- **Monthly analysis**: Deep dive and reporting

### Data Quality

- **Verify collection**: Check that metrics files are generated
- **Validate dashboard**: Ensure charts render correctly
- **Cross-check data**: Compare with manual observations
- **Document anomalies**: Note any unusual metrics

### Continuous Improvement

- **Track action items**: From trend analysis
- **Measure impact**: Of improvements made
- **Iterate patterns**: Based on usage data
- **Share insights**: With team regularly

---

## Troubleshooting

### Metrics Collection Fails

**Symptom**: Scripts error during collection

**Solutions**:
1. Check Node.js version (require 18+)
2. Verify test files exist in expected paths
3. Run tests manually first: `npm run test:integration`
4. Check script permissions: `chmod +x scripts/metrics/*.sh`

### Dashboard Not Rendering

**Symptom**: Dashboard HTML is blank or broken

**Solutions**:
1. Verify all metrics JSON files exist
2. Check JSON validity: `cat metrics/pattern-metrics.json | jq`
3. Regenerate dashboard: `node scripts/metrics/generate-dashboard.js`
4. Try different browser if rendering issues

### Metrics Seem Incorrect

**Symptom**: Numbers don't match expectations

**Solutions**:
1. Check pattern regex in collection script
2. Verify test file paths in TEST_DIRS
3. Review excluded files (.backup files)
4. Manually count samples and compare
5. Update collection scripts if patterns changed

---

## Future Enhancements

### Planned Features

1. **Developer Satisfaction Surveys**
   - In-dashboard survey forms
   - Feedback collection and analysis
   - Satisfaction trend tracking

2. **Time Tracking Integration**
   - Automatic time-to-write tracking
   - Debug time measurement
   - Productivity metrics

3. **Trend Visualization**
   - Line charts for metrics over time
   - Comparative analysis (week-over-week)
   - Predictive analytics

4. **Alerts and Notifications**
   - Email alerts for metric thresholds
   - Slack integration for daily summaries
   - GitHub PR comments with metrics

5. **Export Capabilities**
   - CSV/Excel export for reporting
   - PDF dashboard generation
   - Presentation mode for stakeholders

---

## Support

For questions or issues with the metrics system:

1. Review this documentation
2. Check troubleshooting section
3. Review ticket: `workflows/MODTESTROB-011-success-metrics-dashboard.md`
4. Consult team lead or project maintainer

---

_Last Updated: 2024-01-15_
```

---

## Validation Criteria

### Metrics Collection System

```bash
# Verify all collection scripts work
node scripts/metrics/collect-pattern-metrics.js
./scripts/metrics/analyze-git-history.sh
node scripts/metrics/collect-test-execution-metrics.js

# Check output files created
ls -lh metrics/pattern-metrics.json
ls -lh metrics/git-history-metrics.json
ls -lh metrics/test-execution-metrics.json

# Validate JSON structure
cat metrics/pattern-metrics.json | jq '.aggregated'
cat metrics/git-history-metrics.json | jq '.summary'
cat metrics/test-execution-metrics.json | jq '.overall'
```

### Dashboard Generation

```bash
# Generate dashboard
node scripts/metrics/generate-dashboard.js

# Verify HTML created
ls -lh metrics/dashboard.html

# Check file size (should be >50KB)
wc -c metrics/dashboard.html

# Open in browser for visual validation
open metrics/dashboard.html
```

### Master Workflow

```bash
# Run complete collection workflow
./scripts/metrics/collect-all-metrics.sh

# Should output:
# - Pattern metrics collected
# - Git history analyzed
# - Test execution metrics collected
# - Dashboard generated
# - All files present in metrics/

# Verify all outputs
ls -lh metrics/
```

### Data Accuracy

```bash
# Manually verify pattern counts
grep -r "toSucceed" tests/integration/mods/ | wc -l
# Compare with metrics/pattern-metrics.json -> aggregated.domainMatchers.byType.toSucceed

# Verify migration progress
find tests/integration/mods -name "*.test.js" | wc -l
# Compare with metrics/pattern-metrics.json -> summary.totalFiles
```

---

## Files Created

### Collection Scripts

1. **`scripts/metrics/collect-pattern-metrics.js`** (~350 lines)
   - Pattern usage analyzer
   - Domain matcher detection
   - Scenario builder tracking
   - Old pattern identification

2. **`scripts/metrics/analyze-git-history.sh`** (~100 lines)
   - Git history analyzer
   - Commit statistics
   - Line change tracking
   - Migration velocity measurement

3. **`scripts/metrics/collect-test-execution-metrics.js`** (~250 lines)
   - Test execution analyzer
   - Pass/fail rate tracking
   - Timing metrics
   - Module-level statistics

4. **`scripts/metrics/generate-dashboard.js`** (~450 lines)
   - HTML dashboard generator
   - Chart creation
   - Table generation
   - Visual KPI cards

5. **`scripts/metrics/collect-all-metrics.sh`** (~50 lines)
   - Master collection orchestrator
   - Runs all collection scripts
   - Generates dashboard
   - Status reporting

### Documentation

6. **`docs/testing/metrics-system.md`** (~700 lines)
   - Complete metrics documentation
   - Script usage guides
   - Dashboard interpretation
   - Troubleshooting guide
   - Best practices

### Optional GitHub Actions

7. **`.github/workflows/collect-metrics.yml`** (~40 lines)
   - Automated daily collection
   - GitHub Actions workflow
   - Artifact upload
   - Auto-commit metrics

### Output Files (generated)

8. **`metrics/pattern-metrics.json`** (generated)
   - Pattern usage statistics
   - Aggregated metrics
   - Per-file analysis

9. **`metrics/git-history-metrics.json`** (generated)
   - Git commit analysis
   - Line change statistics
   - Migration velocity

10. **`metrics/test-execution-metrics.json`** (generated)
    - Test pass rates
    - Execution timing
    - Module statistics

11. **`metrics/dashboard.html`** (generated)
    - Visual dashboard
    - Charts and graphs
    - KPI cards
    - Detailed tables

---

## Testing

### Script Execution Tests

```bash
# Test pattern metrics collection
NODE_ENV=test node scripts/metrics/collect-pattern-metrics.js
# Expected: JSON file created, no errors

# Test Git history analysis
./scripts/metrics/analyze-git-history.sh
# Expected: JSON file created, commit data present

# Test test execution metrics
NODE_ENV=test node scripts/metrics/collect-test-execution-metrics.js
# Expected: JSON file created, test data present

# Test dashboard generation
node scripts/metrics/generate-dashboard.js
# Expected: HTML file created, opens in browser
```

### Data Validation Tests

```bash
# Validate JSON structure
for file in metrics/*.json; do
  echo "Validating $file..."
  jq empty "$file" && echo "✓ Valid JSON" || echo "✗ Invalid JSON"
done

# Check required fields
jq '.version, .timestamp, .summary' metrics/pattern-metrics.json
jq '.summary.totalMigrationCommits' metrics/git-history-metrics.json
jq '.overall.passRate' metrics/test-execution-metrics.json
```

### Dashboard Visual Tests

```bash
# Generate test dashboard
node scripts/metrics/generate-dashboard.js

# Check HTML structure
grep -c "<div class=\"metric-card\"" metrics/dashboard.html
# Expected: 4 metric cards

grep -c "<table>" metrics/dashboard.html
# Expected: 2-3 tables

grep -c "class=\"section\"" metrics/dashboard.html
# Expected: 6-7 sections

# Open and verify visually
open metrics/dashboard.html
# Checklist:
# - [ ] All sections render
# - [ ] Charts display correctly
# - [ ] Tables have data
# - [ ] Progress bars show percentage
# - [ ] No console errors
```

---

## Rollback Plan

### Remove Metrics System

```bash
# Remove collection scripts
rm -rf scripts/metrics/

# Remove documentation
rm -f docs/testing/metrics-system.md

# Remove generated metrics
rm -rf metrics/

# Remove GitHub Actions workflow (if added)
rm -f .github/workflows/collect-metrics.yml

# Commit removal
git add .
git commit -m "chore: remove metrics system

Rolled back MODTESTROB-011 implementation.

Ref: MODTESTROB-011"
```

### Partial Rollback (keep scripts, remove automation)

```bash
# Remove GitHub Actions only
rm -f .github/workflows/collect-metrics.yml

# Keep scripts and manual collection available
git add .github/workflows/collect-metrics.yml
git commit -m "chore: remove automated metrics collection

Keep manual collection scripts but remove automation.

Ref: MODTESTROB-011"
```

---

## Commit Strategy

### Commit 1: Collection Scripts

```bash
git add scripts/metrics/collect-pattern-metrics.js \
        scripts/metrics/analyze-git-history.sh \
        scripts/metrics/collect-test-execution-metrics.js
git commit -m "tools: add metrics collection scripts

- collect-pattern-metrics.js: Pattern usage analyzer
- analyze-git-history.sh: Git history statistics
- collect-test-execution-metrics.js: Test quality metrics

Enables tracking of pattern adoption and migration progress.

Ref: MODTESTROB-011"

chmod +x scripts/metrics/*.sh
```

### Commit 2: Dashboard Generator

```bash
git add scripts/metrics/generate-dashboard.js
git commit -m "tools: add metrics dashboard generator

Creates HTML dashboard with visual KPIs, charts, and tables.
Aggregates data from all metrics collectors.

Features:
- Key metric cards
- Progress bars
- Pattern adoption charts
- Test quality tables
- Git activity summary

Ref: MODTESTROB-011"
```

### Commit 3: Master Workflow

```bash
git add scripts/metrics/collect-all-metrics.sh
git commit -m "tools: add master metrics collection workflow

Orchestrates all metrics collectors and dashboard generation.
Single command to update all metrics and regenerate dashboard.

Usage: ./scripts/metrics/collect-all-metrics.sh

Ref: MODTESTROB-011"

chmod +x scripts/metrics/collect-all-metrics.sh
```

### Commit 4: Documentation

```bash
git add docs/testing/metrics-system.md
git commit -m "docs: add metrics system documentation

Comprehensive guide covering:
- Metrics taxonomy and definitions
- Collection script usage
- Dashboard interpretation
- Troubleshooting guide
- Best practices

Ref: MODTESTROB-011"
```

### Commit 5: Optional Automation

```bash
git add .github/workflows/collect-metrics.yml
git commit -m "ci: add automated metrics collection workflow

GitHub Actions workflow for daily metrics collection:
- Runs at midnight UTC
- Collects all metrics automatically
- Commits updated dashboard
- Uploads dashboard artifact

Can be triggered manually via workflow_dispatch.

Ref: MODTESTROB-011"
```

---

## Success Criteria

### Core Functionality

- ✅ **Pattern metrics collection operational**
  - Script runs without errors
  - Detects domain matchers correctly
  - Tracks scenario builder usage
  - Identifies old patterns

- ✅ **Git history analysis working**
  - Analyzes migration commits
  - Calculates line changes
  - Tracks files changed
  - Produces valid JSON

- ✅ **Test execution metrics collected**
  - Integrates with Jest
  - Captures pass/fail rates
  - Measures execution time
  - Breaks down by module

- ✅ **Dashboard generation successful**
  - Creates valid HTML
  - All sections render
  - Charts display data
  - Tables populate correctly

### Data Quality

- ✅ **Metrics accuracy validated**
  - Manual spot-checks confirm counts
  - JSON schema valid
  - No missing data fields
  - Reasonable values

- ✅ **Dashboard usability**
  - Renders in modern browsers
  - Responsive layout
  - Clear visual hierarchy
  - Actionable insights

### Documentation

- ✅ **Complete documentation provided**
  - Script usage documented
  - Metrics taxonomy defined
  - Dashboard interpretation guide
  - Troubleshooting procedures

### Automation (optional)

- ⏳ **GitHub Actions workflow**
  - Daily collection runs
  - Metrics auto-committed
  - Dashboard artifact uploaded
  - (Only if automation enabled)

### Long-term Goals

- ⏳ **80% pattern adoption** (tracked over time)
  - Current: TBD from first collection
  - Target: 80% of files using patterns

- ⏳ **50%+ line reduction** (measured)
  - Current: TBD from migration data
  - Target: Average 50% reduction

- ⏳ **100% test pass rate** (maintained)
  - Current: To be measured
  - Target: Sustained 100%

---

## Next Steps

### Immediate (after implementation)

1. **Initial Metrics Collection**
   ```bash
   ./scripts/metrics/collect-all-metrics.sh
   open metrics/dashboard.html
   ```

2. **Establish Baseline**
   - Record initial metrics as baseline
   - Document starting state
   - Set improvement targets

3. **Share with Team**
   - Demo dashboard to team
   - Explain metrics taxonomy
   - Establish review cadence

### Short-term (next 2 weeks)

4. **Weekly Reviews**
   - Review dashboard weekly
   - Track migration progress
   - Identify slow adoption areas

5. **Refine Metrics**
   - Adjust thresholds based on reality
   - Add missing metrics if identified
   - Fix collection issues

6. **Promote Patterns**
   - Target low-adoption patterns
   - Create examples for underused patterns
   - Update migration guide

### Medium-term (next month)

7. **Trend Analysis**
   - Compare week-over-week metrics
   - Identify positive/negative trends
   - Adjust strategy as needed

8. **ROI Calculation**
   - Calculate time savings
   - Measure quality improvements
   - Quantify maintenance reduction

9. **Stakeholder Reporting**
   - Present metrics to stakeholders
   - Demonstrate value
   - Plan next phase

### Long-term (next quarter)

10. **Continuous Improvement**
    - Monitor sustained impact
    - Plan enhancements (surveys, time tracking)
    - Maintain documentation

11. **Pattern Evolution**
    - Use metrics to inform pattern design
    - Deprecate unused patterns
    - Create new patterns based on needs

12. **Knowledge Sharing**
    - Write case study
    - Share learnings with broader team
    - Update best practices

---

**Estimated Total Effort**: 6-8 hours for complete implementation  
**Actual Effort**: TBD (track during implementation)  
**Maintenance Effort**: ~1 hour/week for review and updates

---

**Related Tickets**:
- ✅ MODTESTROB-005 (Enhanced Test Assertions) - Matchers tracked
- ✅ MODTESTROB-006 (Sitting Scenario Builders) - Scenarios tracked
- ✅ MODTESTROB-007 (Inventory Scenario Builders) - Scenarios tracked
- ✅ MODTESTROB-010 (Update Existing Tests) - Migration tracked
- ✅ MODTESTROB-011 (Success Metrics Dashboard) - **This ticket**
