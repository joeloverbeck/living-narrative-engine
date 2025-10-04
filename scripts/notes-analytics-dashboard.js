#!/usr/bin/env node

/**
 * @file Notes Categorization Analytics Dashboard
 *
 * Usage: node scripts/notes-analytics-dashboard.js
 */

import NotesAnalyticsService from '../src/ai/notesAnalyticsService.js';
import { ensureValidLogger } from '../src/utils/loggerUtils.js';

const logger = ensureValidLogger(console, 'AnalyticsDashboard');
const analyticsService = new NotesAnalyticsService({ logger });

// Load analytics from storage if available
await analyticsService.loadAnalytics();

// Generate and display report
const report = analyticsService.generateReport();
console.log(report);

// Display summary in console-friendly format
const summary = analyticsService.getAnalyticsSummary();

console.log('\n╔═══════════════════════════════════════════════╗');
console.log('║   NOTES CATEGORIZATION ANALYTICS SUMMARY      ║');
console.log('╚═══════════════════════════════════════════════╝\n');

console.log(`📊 Total Notes: ${summary.summary.totalNotes}`);
console.log(`✅ Accuracy: ${summary.summary.accuracy}`);
console.log(`❌ Errors: ${summary.summary.totalErrors}\n`);

console.log('🏆 Most Used Types:');
summary.mostUsedTypes.forEach(({ type, count, percentage }) => {
  console.log(`   - ${type}: ${count} (${percentage}%)`);
});

if (summary.underutilizedTypes.length > 0) {
  console.log('\n⚠️  Underutilized Types:');
  summary.underutilizedTypes.forEach((type) => {
    console.log(`   - ${type}`);
  });
}

if (summary.topMisclassifications.length > 0) {
  console.log('\n🔄 Top Misclassifications:');
  summary.topMisclassifications.forEach(({ pattern, count }) => {
    console.log(`   - ${pattern}: ${count} occurrences`);
  });
}
