# LLMROLPROARCANA-012: Implement Prompt Performance Monitoring and Metrics

---

## 🚫 STATUS: WON'T IMPLEMENT

**Closed:** 2025-11-25
**Reason:** Premature infrastructure - existing capabilities sufficient

### Closure Rationale

1. **Token counting already exists** - `TokenEstimator` class at `src/llms/services/tokenEstimator.js` provides full token estimation capabilities
2. **Schema validation exists** - `LLMResponseProcessor` already validates LLM responses against schema with AJV
3. **No active problem to solve** - No specific LLM quality issues requiring monitoring infrastructure
4. **Overkill for use case** - A/B testing framework and quality scorers are enterprise-grade features unnecessary for game engine development
5. **Comprehensive monitoring infrastructure already exists** - `PerformanceMonitor`, `ErrorClassifier`, structured tracing system all in place

### If Token Visibility Needed Later

Add debug logging at LLM request point using existing `TokenEstimator` (~30 minutes vs 8-12 hours).

---

**Reference:** `reports/llm-roleplay-prompt-architecture-analysis.md` - Section 9, Phase 4 (Ongoing), Section 10
**Priority:** MEDIUM ⭐⭐⭐
**Estimated Effort:** Medium (8-12 hours)
**Impact:** Continuous improvement capability, data-driven optimization
**Phase:** 4 - Monitoring & Iteration (Ongoing)

## Problem Statement

The current system lacks metrics and monitoring for prompt template performance, making it impossible to:
- Measure effectiveness of optimization changes
- Identify failure patterns systematically
- Track prompt quality over time
- Make data-driven improvement decisions
- Validate that changes actually improve outcomes

**Missing Capabilities:**
- Token count tracking per generation
- Output format compliance monitoring
- Note classification accuracy measurement
- Character voice consistency scoring
- LLM output quality metrics

## Objective

Implement comprehensive monitoring system to track prompt performance metrics, identify failure patterns, and enable data-driven iterative improvements.

## Acceptance Criteria

- [ ] Token count tracking implemented
- [ ] Output format compliance validator created
- [ ] Note classification accuracy checker implemented
- [ ] Character voice quality scorer added
- [ ] Metrics dashboard/reporting system built
- [ ] Automated compliance checking integrated
- [ ] Performance baseline established
- [ ] A/B testing framework ready

## Technical Implementation

### Files to Create/Modify

1. **`src/prompting/monitoring/promptMetricsCollector.js`** (new)
   - Collect metrics during prompt generation and LLM response

2. **`src/prompting/monitoring/outputValidator.js`** (new)
   - Validate LLM output against format rules

3. **`src/prompting/monitoring/qualityScorer.js`** (new)
   - Score character voice quality and consistency

4. **`src/prompting/monitoring/metricsReporter.js`** (new)
   - Generate reports and dashboards

5. **`src/prompting/monitoring/abTestManager.js`** (new)
   - Manage A/B testing of template variations

### Metrics Collection System

```javascript
// src/prompting/monitoring/promptMetricsCollector.js

class PromptMetricsCollector {
  constructor({ storage, logger }) {
    this.storage = storage;
    this.logger = logger;
    this.metrics = [];
  }

  collectGenerationMetrics(prompt, response, metadata) {
    const metrics = {
      timestamp: new Date().toISOString(),
      templateVersion: metadata.templateVersion,
      characterId: metadata.characterId,
      sceneTurn: metadata.sceneTurn,

      // Token metrics
      promptTokens: this.countTokens(prompt),
      responseTokens: this.countTokens(response),
      totalTokens: this.countTokens(prompt) + this.countTokens(response),

      // Format compliance
      formatCompliance: this.validateFormat(response),
      actionTagCompliance: this.validateActionTags(response),
      thoughtSpeechDistinction: this.validateThoughtVsSpeech(response),

      // Note classification
      noteClassification: this.validateNoteClassification(response),

      // Quality metrics
      characterVoiceScore: this.scoreCharacterVoice(response, metadata.character),
      freshThoughtsScore: this.scoreFreshThoughts(response, metadata.recentThoughts),

      // Performance
      generationTime: metadata.generationTime,
      llmLatency: metadata.llmLatency
    };

    this.metrics.push(metrics);
    this.storage.save(metrics);

    return metrics;
  }

  validateFormat(response) {
    const validators = [
      this.hasRequiredSections(response),
      this.validateActionTags(response),
      this.validateThoughtVsSpeech(response),
      this.validateNoteFormat(response)
    ];

    const passed = validators.filter(v => v === true).length;
    return passed / validators.length; // Compliance score 0-1
  }

  validateActionTags(response) {
    const violations = [];

    // Check for internal states in asterisks
    const internalStatePattern = /\*(feels?|thinks?|realizes?|remembers?|knows?)/gi;
    const internalMatches = response.match(internalStatePattern);
    if (internalMatches) {
      violations.push({
        type: 'internal_state_in_action',
        count: internalMatches.length
      });
    }

    // Check for asterisks in dialogue
    const dialogueActionPattern = /"[^"]*\*[^"]*"/g;
    const dialogueMatches = response.match(dialogueActionPattern);
    if (dialogueMatches) {
      violations.push({
        type: 'asterisks_in_dialogue',
        count: dialogueMatches.length
      });
    }

    // Check for past tense in action tags
    const pastTensePattern = /\*([\w\s]*ed\s?)/gi;
    const pastTenseMatches = response.match(pastTensePattern);
    if (pastTenseMatches) {
      violations.push({
        type: 'past_tense_action',
        count: pastTenseMatches.length
      });
    }

    return {
      compliant: violations.length === 0,
      violations,
      score: Math.max(0, 1 - (violations.length * 0.2)) // Deduct for each violation
    };
  }

  validateThoughtVsSpeech(response) {
    try {
      const parsed = JSON.parse(response);

      if (!parsed.thoughts || !parsed.speech) {
        return {
          compliant: false,
          reason: 'Missing thoughts or speech section'
        };
      }

      // Check for content similarity (should be DIFFERENT)
      const similarity = this.calculateSimilarity(
        parsed.thoughts,
        parsed.speech
      );

      const compliant = similarity < 0.5; // Less than 50% similar

      return {
        compliant,
        similarity,
        score: compliant ? 1.0 : (1 - similarity)
      };
    } catch (err) {
      return {
        compliant: false,
        reason: 'Invalid JSON response',
        error: err.message
      };
    }
  }

  validateNoteClassification(response) {
    try {
      const parsed = JSON.parse(response);

      if (!parsed.notes || parsed.notes.length === 0) {
        return { compliant: true, noteCount: 0 }; // No notes is valid
      }

      const validTypes = ['entity', 'event', 'plan', 'knowledge', 'state', 'other'];
      const violations = [];

      parsed.notes.forEach((note, index) => {
        if (!validTypes.includes(note.subjectType)) {
          violations.push({
            noteIndex: index,
            invalidType: note.subjectType,
            validTypes
          });
        }

        // Check note length (should be 1-3 sentences, max 60 words)
        const wordCount = note.note.split(/\s+/).length;
        if (wordCount > 60) {
          violations.push({
            noteIndex: index,
            issue: 'exceeds_word_limit',
            wordCount,
            limit: 60
          });
        }
      });

      return {
        compliant: violations.length === 0,
        noteCount: parsed.notes.length,
        violations,
        score: Math.max(0, 1 - (violations.length * 0.3))
      };
    } catch (err) {
      return {
        compliant: false,
        reason: 'Invalid JSON response',
        error: err.message
      };
    }
  }

  scoreCharacterVoice(response, character) {
    // Implement character voice quality scoring
    // Could use LLM-based evaluation or heuristics

    const indicators = [
      this.checkSpeechPatternUsage(response, character.speechPatterns),
      this.checkPsychologicalDepth(response, character.psychology),
      this.checkTraitConsistency(response, character.traits)
    ];

    const avgScore = indicators.reduce((sum, score) => sum + score, 0) / indicators.length;

    return {
      score: avgScore,
      indicators: {
        speechPatterns: indicators[0],
        psychologicalDepth: indicators[1],
        traitConsistency: indicators[2]
      }
    };
  }

  scoreFreshThoughts(response, recentThoughts) {
    try {
      const parsed = JSON.parse(response);

      if (!parsed.thoughts) return { score: 0, reason: 'No thoughts section' };

      // Calculate similarity with recent thoughts
      const similarities = recentThoughts.map(recentThought =>
        this.calculateSimilarity(parsed.thoughts, recentThought)
      );

      const maxSimilarity = Math.max(...similarities, 0);
      const freshness = 1 - maxSimilarity; // Inverse of similarity

      return {
        score: freshness,
        maxSimilarity,
        compliant: freshness >= 0.7 // >70% fresh
      };
    } catch (err) {
      return {
        score: 0,
        reason: 'Invalid JSON response',
        error: err.message
      };
    }
  }

  calculateSimilarity(text1, text2) {
    // Implement text similarity calculation
    // Could use Levenshtein distance, cosine similarity, etc.

    const tokens1 = text1.toLowerCase().split(/\s+/);
    const tokens2 = text2.toLowerCase().split(/\s+/);

    const commonTokens = tokens1.filter(token => tokens2.includes(token));
    const similarity = (2 * commonTokens.length) / (tokens1.length + tokens2.length);

    return similarity;
  }

  getMetricsSummary(timeRange = '24h') {
    const filtered = this.filterByTimeRange(this.metrics, timeRange);

    return {
      totalGenerations: filtered.length,
      avgPromptTokens: this.avg(filtered.map(m => m.promptTokens)),
      avgResponseTokens: this.avg(filtered.map(m => m.responseTokens)),
      formatComplianceRate: this.avg(filtered.map(m => m.formatCompliance)),
      actionTagComplianceRate: this.avg(filtered.map(m => m.actionTagCompliance?.score || 0)),
      thoughtSpeechComplianceRate: this.avg(filtered.map(m => m.thoughtSpeechDistinction?.score || 0)),
      avgCharacterVoiceScore: this.avg(filtered.map(m => m.characterVoiceScore?.score || 0)),
      avgFreshThoughtsScore: this.avg(filtered.map(m => m.freshThoughtsScore?.score || 0))
    };
  }

  avg(numbers) {
    if (numbers.length === 0) return 0;
    return numbers.reduce((sum, n) => sum + n, 0) / numbers.length;
  }
}
```

### Metrics Reporter

```javascript
// src/prompting/monitoring/metricsReporter.js

class MetricsReporter {
  constructor({ collector, logger }) {
    this.collector = collector;
    this.logger = logger;
  }

  generateDailyReport() {
    const summary = this.collector.getMetricsSummary('24h');

    const report = `
# Daily Prompt Performance Report

**Date:** ${new Date().toISOString().split('T')[0]}

## Summary Metrics

- **Total Generations:** ${summary.totalGenerations}
- **Avg Prompt Tokens:** ${Math.round(summary.avgPromptTokens)}
- **Avg Response Tokens:** ${Math.round(summary.avgResponseTokens)}

## Compliance Rates

- **Format Compliance:** ${(summary.formatComplianceRate * 100).toFixed(1)}%
- **Action Tag Compliance:** ${(summary.actionTagComplianceRate * 100).toFixed(1)}%
- **Thought/Speech Distinction:** ${(summary.thoughtSpeechComplianceRate * 100).toFixed(1)}%

## Quality Scores

- **Character Voice Consistency:** ${(summary.avgCharacterVoiceScore * 10).toFixed(1)}/10
- **Fresh Thoughts Score:** ${(summary.avgFreshThoughtsScore * 10).toFixed(1)}/10

## Recommendations

${this.generateRecommendations(summary)}
`;

    return report;
  }

  generateRecommendations(summary) {
    const recommendations = [];

    if (summary.formatComplianceRate < 0.95) {
      recommendations.push('⚠️ Format compliance below target (95%). Review action tag rules and examples.');
    }

    if (summary.actionTagComplianceRate < 0.90) {
      recommendations.push('⚠️ Action tag compliance below target (90%). Consider enhancing action tag guidance.');
    }

    if (summary.avgCharacterVoiceScore < 0.8) {
      recommendations.push('⚠️ Character voice quality below target (8/10). Review speech pattern usage.');
    }

    if (summary.avgFreshThoughtsScore < 0.7) {
      recommendations.push('⚠️ Fresh thoughts score below target (70%). Check anti-repetition mechanism.');
    }

    if (summary.avgPromptTokens > 5500) {
      recommendations.push('💡 Prompt tokens above target. Consider additional compression opportunities.');
    }

    return recommendations.length > 0
      ? recommendations.join('\n')
      : '✅ All metrics within target ranges.';
  }

  exportMetrics(format = 'json', timeRange = '7d') {
    const data = this.collector.filterByTimeRange(
      this.collector.metrics,
      timeRange
    );

    if (format === 'json') {
      return JSON.stringify(data, null, 2);
    }

    if (format === 'csv') {
      return this.convertToCSV(data);
    }

    throw new Error(`Unsupported export format: ${format}`);
  }

  convertToCSV(data) {
    const headers = Object.keys(data[0]);
    const rows = data.map(row =>
      headers.map(header => JSON.stringify(row[header])).join(',')
    );

    return [headers.join(','), ...rows].join('\n');
  }
}
```

### A/B Testing Framework

```javascript
// src/prompting/monitoring/abTestManager.js

class ABTestManager {
  constructor({ storage, metricsCollector }) {
    this.storage = storage;
    this.metricsCollector = metricsCollector;
    this.activeTests = new Map();
  }

  createTest(testConfig) {
    const test = {
      id: this.generateTestId(),
      name: testConfig.name,
      description: testConfig.description,
      variants: testConfig.variants, // e.g., ['v1.0', 'v2.0']
      trafficSplit: testConfig.trafficSplit || [0.5, 0.5],
      metrics: testConfig.metrics || ['formatCompliance', 'characterVoiceScore'],
      startDate: new Date(),
      status: 'active',
      sampleSize: testConfig.sampleSize || 100
    };

    this.activeTests.set(test.id, test);
    this.storage.saveTest(test);

    return test;
  }

  selectVariant(testId, characterId) {
    const test = this.activeTests.get(testId);
    if (!test) return null;

    // Consistent variant assignment based on character ID
    const hash = this.hashString(characterId);
    const normalizedHash = hash % 100 / 100;

    let cumulative = 0;
    for (let i = 0; i < test.variants.length; i++) {
      cumulative += test.trafficSplit[i];
      if (normalizedHash < cumulative) {
        return test.variants[i];
      }
    }

    return test.variants[test.variants.length - 1];
  }

  analyzeResults(testId) {
    const test = this.activeTests.get(testId);
    if (!test) return null;

    const variantMetrics = {};

    test.variants.forEach(variant => {
      const metrics = this.metricsCollector.metrics.filter(m =>
        m.templateVersion === variant &&
        m.timestamp >= test.startDate
      );

      variantMetrics[variant] = {
        sampleSize: metrics.length,
        formatCompliance: this.avg(metrics.map(m => m.formatCompliance)),
        characterVoiceScore: this.avg(metrics.map(m => m.characterVoiceScore?.score || 0)),
        promptTokens: this.avg(metrics.map(m => m.promptTokens))
      };
    });

    // Statistical significance testing
    const winner = this.determineWinner(variantMetrics, test.metrics);

    return {
      testId,
      testName: test.name,
      variantMetrics,
      winner,
      confidence: this.calculateConfidence(variantMetrics),
      recommendation: this.generateRecommendation(winner, variantMetrics)
    };
  }

  determineWinner(variantMetrics, metricNames) {
    // Simple implementation - could be enhanced with proper statistical testing
    const scores = {};

    Object.entries(variantMetrics).forEach(([variant, metrics]) => {
      scores[variant] = metricNames.reduce((sum, metric) =>
        sum + (metrics[metric] || 0), 0
      ) / metricNames.length;
    });

    const winner = Object.entries(scores).reduce((best, [variant, score]) =>
      score > best.score ? { variant, score } : best,
      { variant: null, score: -Infinity }
    );

    return winner.variant;
  }

  generateTestId() {
    return `abtest_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  hashString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  avg(numbers) {
    if (numbers.length === 0) return 0;
    return numbers.reduce((sum, n) => sum + n, 0) / numbers.length;
  }
}
```

## Testing Requirements

### Metrics Collection Tests

```javascript
describe('Prompt Metrics Collection', () => {
  let collector;

  beforeEach(() => {
    collector = new PromptMetricsCollector({
      storage: mockStorage,
      logger: mockLogger
    });
  });

  it('should collect token count metrics', () => {
    const metrics = collector.collectGenerationMetrics(
      testPrompt,
      testResponse,
      testMetadata
    );

    expect(metrics.promptTokens).toBeGreaterThan(0);
    expect(metrics.responseTokens).toBeGreaterThan(0);
    expect(metrics.totalTokens).toBe(metrics.promptTokens + metrics.responseTokens);
  });

  it('should validate output format', () => {
    const validResponse = JSON.stringify({
      thoughts: 'Some fresh thought',
      action: 'wait',
      speech: 'Something different from thoughts',
      notes: []
    });

    const validation = collector.validateFormat(validResponse);
    expect(validation).toBeGreaterThanOrEqual(0.9);
  });

  it('should detect action tag violations', () => {
    const responseWithViolations = `
      thoughts: "I feel anxious"
      speech: "I don't *really* understand"
      action: *felt nervous*
    `;

    const validation = collector.validateActionTags(responseWithViolations);

    expect(validation.compliant).toBe(false);
    expect(validation.violations.length).toBeGreaterThan(0);
  });

  it('should score fresh thoughts correctly', () => {
    const recentThoughts = [
      'I should examine the notice board',
      'This tavern is quite boring'
    ];

    const freshResponse = JSON.stringify({
      thoughts: 'Bertram seems knowledgeable about local opportunities'
    });

    const score = collector.scoreFreshThoughts(freshResponse, recentThoughts);

    expect(score.score).toBeGreaterThan(0.7); // Fresh thought
    expect(score.compliant).toBe(true);
  });
});
```

### Unit Tests
- [ ] Test metrics collection for all metric types
- [ ] Test output format validation
- [ ] Test action tag compliance checking
- [ ] Test note classification validation
- [ ] Test character voice scoring

### Integration Tests
- [ ] Test full metrics collection pipeline
- [ ] Test metrics storage and retrieval
- [ ] Test report generation
- [ ] Test A/B test framework

## Dependencies

- **Blocks:** None (monitoring is parallel to implementation)
- **Blocked By:** None
- **Related:**
  - All previous tickets (provides metrics for all optimizations)

## Success Metrics

| Metric | Baseline | Target | Measurement Method |
|--------|----------|--------|-------------------|
| Metrics collection coverage | 0% | 100% | Coverage analysis |
| Format compliance tracking | None | Real-time | Automated validation |
| Report generation | Manual | Automated | Daily reports |
| A/B testing capability | None | Ready | Test framework |

## Rollback Plan

Monitoring is additive and non-intrusive:
1. Can be disabled without affecting prompt function
2. Metrics collection can be throttled if performance impact
3. A/B testing is opt-in

## Implementation Notes

### Metric Categories

**Quantitative Metrics:**
- Token counts (prompt, response, total)
- Compliance rates (format, action tags, thought/speech)
- Classification accuracy (note types)
- Generation performance (time, latency)

**Qualitative Metrics:**
- Character voice consistency (scored)
- Fresh thoughts quality (scored)
- Roleplay depth (human evaluation)
- Speech pattern authenticity (scored)

### Success Criteria Targets

From Report Section 10:

**Minimum Viable Improvement:**
- ✅ 25% token reduction
- ✅ 90% format compliance
- ✅ Zero critical instruction conflicts
- ✅ Maintained character voice quality

**Target Improvement:**
- ✅ 37% token reduction
- ✅ 95% format compliance
- ✅ 85% note classification accuracy
- ✅ Improved character voice consistency

**Stretch Goal:**
- ✅ 40% token reduction
- ✅ 98% format compliance
- ✅ 90% note classification accuracy
- ✅ Demonstrably richer roleplay depth

### Continuous Improvement Process

1. **Baseline**: Establish metrics for current version
2. **Hypothesis**: Identify optimization opportunity
3. **Implement**: Create variation/improvement
4. **A/B Test**: Compare old vs new
5. **Analyze**: Statistical significance testing
6. **Decision**: Roll out winner or iterate
7. **Monitor**: Track long-term impact

## References

- Report Section 10: "Success Metrics"
- Report Section 9: "Phase 4 - Monitoring & Iteration"
- Report Section 11: "Risk Assessment"
