# Ticket 09: Statistics Display

## Overview

Implement the statistics display showing total concepts, concepts with directions, and total directions count, with real-time updates as data changes.

## Dependencies

- Ticket 03: Controller Setup (completed)
- Ticket 05: Display Concepts (completed)

## Implementation Details

### 1. Enhance Update Statistics Method

In `CharacterConceptsManagerController`, enhance the `#updateStatistics` method:

```javascript
/**
 * Update statistics display with animations
 */
#updateStatistics() {
    const stats = this.#calculateStatistics();

    // Animate number changes
    this.#animateStatValue(this.#elements.totalConcepts, stats.totalConcepts);
    this.#animateStatValue(this.#elements.conceptsWithDirections, stats.conceptsWithDirections);
    this.#animateStatValue(this.#elements.totalDirections, stats.totalDirections);

    // Update additional statistics
    this.#updateAdvancedStatistics(stats);

    // Log statistics
    this.#logger.info('Statistics updated', stats);

    // Dispatch statistics event for other components
    this.#eventBus.dispatch({
        type: 'statistics:updated',
        payload: stats
    });
}

/**
 * Calculate all statistics
 * @returns {Object} Statistics object
 */
#calculateStatistics() {
    const totalConcepts = this.#conceptsData.length;
    const conceptsWithDirections = this.#conceptsData.filter(
        ({ directionCount }) => directionCount > 0
    ).length;
    const totalDirections = this.#conceptsData.reduce(
        (sum, { directionCount }) => sum + directionCount,
        0
    );

    // Calculate additional statistics
    const averageDirectionsPerConcept = totalConcepts > 0
        ? (totalDirections / totalConcepts).toFixed(1)
        : '0';

    const completionRate = totalConcepts > 0
        ? Math.round((conceptsWithDirections / totalConcepts) * 100)
        : 0;

    const maxDirections = Math.max(
        0,
        ...this.#conceptsData.map(({ directionCount }) => directionCount)
    );

    return {
        totalConcepts,
        conceptsWithDirections,
        totalDirections,
        averageDirectionsPerConcept,
        completionRate,
        maxDirections,
        conceptsWithoutDirections: totalConcepts - conceptsWithDirections
    };
}
```

### 2. Implement Number Animation

Add smooth number transitions:

```javascript
/**
 * Animate stat value changes
 * @param {HTMLElement} element - The element to update
 * @param {number} newValue - The target value
 */
#animateStatValue(element, newValue) {
    const currentValue = parseInt(element.textContent) || 0;

    if (currentValue === newValue) return;

    const duration = 500; // ms
    const steps = 20;
    const increment = (newValue - currentValue) / steps;
    const stepDuration = duration / steps;

    let step = 0;
    const animation = setInterval(() => {
        step++;

        if (step >= steps) {
            element.textContent = newValue;
            clearInterval(animation);

            // Add completion effect
            element.classList.add('stat-updated');
            setTimeout(() => {
                element.classList.remove('stat-updated');
            }, 300);
        } else {
            const value = Math.round(currentValue + (increment * step));
            element.textContent = value;
        }
    }, stepDuration);

    // Store animation reference for cleanup
    if (element.animationInterval) {
        clearInterval(element.animationInterval);
    }
    element.animationInterval = animation;
}
```

### 3. Add Advanced Statistics Display

Create an expanded statistics section:

```javascript
/**
 * Update advanced statistics display
 * @param {Object} stats - Statistics object
 */
#updateAdvancedStatistics(stats) {
    // Check if advanced stats container exists
    let advancedStats = document.querySelector('.advanced-stats');

    if (!advancedStats) {
        // Create advanced stats section
        advancedStats = this.#createAdvancedStatsSection();
        this.#elements.statsDisplay = document.querySelector('.stats-display');
        this.#elements.statsDisplay.appendChild(advancedStats);
    }

    // Update values
    this.#updateAdvancedStatValue('avg-directions', stats.averageDirectionsPerConcept);
    this.#updateAdvancedStatValue('completion-rate', `${stats.completionRate}%`);
    this.#updateAdvancedStatValue('max-directions', stats.maxDirections);

    // Update progress bar
    this.#updateCompletionProgress(stats.completionRate);
}

/**
 * Create advanced statistics section
 * @returns {HTMLElement}
 */
#createAdvancedStatsSection() {
    const section = document.createElement('div');
    section.className = 'advanced-stats';
    section.innerHTML = `
        <h4>Insights</h4>
        <div class="stat-item">
            <span class="stat-label">Average Directions:</span>
            <span id="avg-directions" class="stat-value">0</span>
        </div>
        <div class="stat-item">
            <span class="stat-label">Completion Rate:</span>
            <span id="completion-rate" class="stat-value">0%</span>
        </div>
        <div class="stat-item">
            <span class="stat-label">Most Directions:</span>
            <span id="max-directions" class="stat-value">0</span>
        </div>
        <div class="completion-progress">
            <div class="progress-bar">
                <div class="progress-fill" style="width: 0%"></div>
            </div>
            <div class="progress-label">
                <span class="concepts-complete">0</span> of
                <span class="concepts-total">0</span> concepts have directions
            </div>
        </div>
    `;

    return section;
}

/**
 * Update advanced stat value
 * @param {string} id - Element ID
 * @param {string|number} value - New value
 */
#updateAdvancedStatValue(id, value) {
    const element = document.getElementById(id);
    if (element && element.textContent !== String(value)) {
        element.textContent = value;
        element.classList.add('stat-updated');
        setTimeout(() => {
            element.classList.remove('stat-updated');
        }, 300);
    }
}
```

### 4. Implement Completion Progress Bar

Add visual progress indicator:

```javascript
/**
 * Update completion progress bar
 * @param {number} percentage - Completion percentage
 */
#updateCompletionProgress(percentage) {
    const progressFill = document.querySelector('.progress-fill');
    const conceptsComplete = document.querySelector('.concepts-complete');
    const conceptsTotal = document.querySelector('.concepts-total');

    if (progressFill) {
        // Animate progress bar
        progressFill.style.width = `${percentage}%`;

        // Update color based on percentage
        if (percentage === 100) {
            progressFill.classList.add('complete');
        } else if (percentage >= 75) {
            progressFill.classList.add('good');
        } else if (percentage >= 50) {
            progressFill.classList.add('moderate');
        } else {
            progressFill.classList.add('low');
        }
    }

    // Update labels
    if (conceptsComplete && conceptsTotal) {
        const stats = this.#calculateStatistics();
        conceptsComplete.textContent = stats.conceptsWithDirections;
        conceptsTotal.textContent = stats.totalConcepts;
    }
}
```

### 5. Add Statistics Chart (Optional Enhancement)

Implement a simple chart visualization:

```javascript
/**
 * Create statistics chart
 */
#createStatisticsChart() {
    const chartContainer = document.createElement('div');
    chartContainer.className = 'stats-chart';
    chartContainer.innerHTML = `
        <h4>Direction Distribution</h4>
        <div class="chart-bars"></div>
    `;

    return chartContainer;
}

/**
 * Update statistics chart
 * @param {Array} conceptsData
 */
#updateStatisticsChart(conceptsData) {
    const chartBars = document.querySelector('.chart-bars');
    if (!chartBars) return;

    // Group concepts by direction count
    const distribution = {};
    conceptsData.forEach(({ directionCount }) => {
        const key = directionCount === 0 ? '0' :
                   directionCount <= 5 ? '1-5' :
                   directionCount <= 10 ? '6-10' : '11+';

        distribution[key] = (distribution[key] || 0) + 1;
    });

    // Clear existing bars
    chartBars.innerHTML = '';

    // Create bars
    const maxCount = Math.max(...Object.values(distribution), 1);

    ['0', '1-5', '6-10', '11+'].forEach(range => {
        const count = distribution[range] || 0;
        const percentage = (count / maxCount) * 100;

        const bar = document.createElement('div');
        bar.className = 'chart-bar';
        bar.innerHTML = `
            <div class="bar-label">${range}</div>
            <div class="bar-container">
                <div class="bar-fill" style="height: ${percentage}%">
                    <span class="bar-value">${count}</span>
                </div>
            </div>
            <div class="bar-footer">directions</div>
        `;

        chartBars.appendChild(bar);
    });
}
```

### 6. Add Real-time Statistics Updates

Ensure statistics update on all relevant operations:

```javascript
// Update event handlers to refresh statistics

#handleConceptCreated(event) {
    this.#logger.info('Concept created event received', event.detail);

    // Refresh data and statistics
    this.#loadConceptsData().then(() => {
        // Add creation celebration
        this.#celebrateCreation();
    });
}

#handleConceptUpdated(event) {
    this.#logger.info('Concept updated event received', event.detail);

    // Update specific concept and refresh statistics
    const { conceptId } = event.detail;
    this.#updateConceptInCache(conceptId).then(() => {
        this.#updateStatistics();
    });
}

#handleConceptDeleted(event) {
    this.#logger.info('Concept deleted event received', event.detail);

    // Statistics will be updated in the delete handler
    // Just ensure the display is current
    this.#updateStatistics();
}

#handleDirectionsGenerated(event) {
    this.#logger.info('Directions generated event received', event.detail);

    // Update direction count for the concept
    const { conceptId, directionsCount } = event.detail;
    this.#updateDirectionCount(conceptId, directionsCount);
}
```

### 7. Add Statistics Export Feature

Allow users to export statistics:

```javascript
/**
 * Export statistics as JSON or CSV
 * @param {string} format - 'json' or 'csv'
 */
#exportStatistics(format = 'json') {
    const stats = this.#calculateStatistics();
    const timestamp = new Date().toISOString();

    const data = {
        exportDate: timestamp,
        statistics: stats,
        concepts: this.#conceptsData.map(({ concept, directionCount }) => ({
            id: concept.id,
            textLength: concept.text.length,
            directionCount,
            createdAt: concept.createdAt,
            updatedAt: concept.updatedAt
        }))
    };

    let content, filename, mimeType;

    if (format === 'csv') {
        content = this.#convertToCSV(data);
        filename = `character-concepts-stats-${Date.now()}.csv`;
        mimeType = 'text/csv';
    } else {
        content = JSON.stringify(data, null, 2);
        filename = `character-concepts-stats-${Date.now()}.json`;
        mimeType = 'application/json';
    }

    // Create download
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);

    this.#logger.info('Statistics exported', { format, filename });
}

/**
 * Convert statistics to CSV format
 * @param {Object} data
 * @returns {string}
 */
#convertToCSV(data) {
    const headers = ['Metric', 'Value'];
    const rows = [
        ['Export Date', data.exportDate],
        ['Total Concepts', data.statistics.totalConcepts],
        ['Concepts with Directions', data.statistics.conceptsWithDirections],
        ['Total Directions', data.statistics.totalDirections],
        ['Average Directions per Concept', data.statistics.averageDirectionsPerConcept],
        ['Completion Rate', `${data.statistics.completionRate}%`],
        ['Maximum Directions', data.statistics.maxDirections]
    ];

    const csv = [
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    return csv;
}
```

### 8. Add Statistics CSS Styling

Add these styles to character-concepts-manager.css:

```css
/* Enhanced statistics display */
.stats-display {
  background: var(--bg-secondary);
  border-radius: 12px;
  padding: 1.5rem;
  margin-top: 2rem;
  transition: all 0.3s ease;
}

.stats-display:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

/* Stat value animations */
.stat-value.stat-updated {
  animation: statPulse 0.3s ease-out;
  color: var(--narrative-purple-bright);
}

@keyframes statPulse {
  0% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.1);
  }
  100% {
    transform: scale(1);
  }
}

/* Advanced statistics */
.advanced-stats {
  margin-top: 1.5rem;
  padding-top: 1.5rem;
  border-top: 1px solid var(--border-primary);
}

.advanced-stats h4 {
  margin: 0 0 1rem 0;
  font-size: 1rem;
  color: var(--text-secondary);
  font-weight: 500;
}

/* Completion progress */
.completion-progress {
  margin-top: 1rem;
}

.progress-bar {
  height: 8px;
  background: var(--bg-tertiary);
  border-radius: 4px;
  overflow: hidden;
  margin-bottom: 0.5rem;
}

.progress-fill {
  height: 100%;
  background: var(--narrative-purple);
  transition: width 0.5s ease-out;
  border-radius: 4px;
}

.progress-fill.complete {
  background: #2ecc71;
}

.progress-fill.good {
  background: #3498db;
}

.progress-fill.moderate {
  background: #f39c12;
}

.progress-fill.low {
  background: #95a5a6;
}

.progress-label {
  font-size: 0.75rem;
  color: var(--text-secondary);
  text-align: center;
}

.progress-label .concepts-complete,
.progress-label .concepts-total {
  font-weight: 600;
  color: var(--narrative-purple);
}

/* Statistics chart */
.stats-chart {
  margin-top: 1.5rem;
  padding-top: 1.5rem;
  border-top: 1px solid var(--border-primary);
}

.stats-chart h4 {
  margin: 0 0 1rem 0;
  font-size: 1rem;
  color: var(--text-secondary);
  font-weight: 500;
}

.chart-bars {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  height: 120px;
  gap: 0.5rem;
}

.chart-bar {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.bar-label {
  font-size: 0.75rem;
  color: var(--text-secondary);
  margin-bottom: 0.5rem;
}

.bar-container {
  width: 100%;
  height: 80px;
  background: var(--bg-tertiary);
  border-radius: 4px 4px 0 0;
  position: relative;
  display: flex;
  align-items: flex-end;
}

.bar-fill {
  width: 100%;
  background: var(--narrative-purple);
  border-radius: 4px 4px 0 0;
  transition: height 0.5s ease-out;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 20px;
}

.bar-value {
  font-size: 0.875rem;
  font-weight: 600;
  color: white;
}

.bar-footer {
  font-size: 0.625rem;
  color: var(--text-tertiary);
  margin-top: 0.25rem;
}

/* Export button */
.export-stats-btn {
  margin-top: 1rem;
  width: 100%;
  padding: 0.5rem;
  background: transparent;
  border: 1px solid var(--border-primary);
  border-radius: 8px;
  color: var(--text-secondary);
  font-size: 0.875rem;
  cursor: pointer;
  transition: all 0.2s ease;
}

.export-stats-btn:hover {
  background: var(--bg-highlight);
  border-color: var(--narrative-purple);
  color: var(--narrative-purple);
}
```

### 9. Add Celebration Animation

Create a fun animation for milestones:

```javascript
/**
 * Celebrate creation milestones
 */
#celebrateCreation() {
    const stats = this.#calculateStatistics();

    // Check for milestones
    if (stats.totalConcepts === 1) {
        this.#showMilestone('🎉 First Concept Created!');
    } else if (stats.totalConcepts % 10 === 0) {
        this.#showMilestone(`🎊 ${stats.totalConcepts} Concepts Created!`);
    } else if (stats.completionRate === 100 && stats.totalConcepts > 1) {
        this.#showMilestone('⭐ All Concepts Have Directions!');
    }
}

/**
 * Show milestone notification
 * @param {string} message
 */
#showMilestone(message) {
    const milestone = document.createElement('div');
    milestone.className = 'milestone-notification';
    milestone.textContent = message;

    document.body.appendChild(milestone);

    // Animate in
    setTimeout(() => {
        milestone.classList.add('show');
    }, 100);

    // Remove after delay
    setTimeout(() => {
        milestone.classList.remove('show');
        setTimeout(() => {
            milestone.remove();
        }, 500);
    }, 3000);
}
```

### 10. Add Refresh Statistics Method

Implement manual refresh capability:

```javascript
/**
 * Refresh statistics from server
 */
async #refreshStatistics() {
    try {
        // Show loading indicator on stats
        this.#elements.statsDisplay?.classList.add('stats-loading');

        // Reload concepts data
        await this.#loadConceptsData();

        // Statistics will be updated automatically

        this.#logger.info('Statistics refreshed');

    } catch (error) {
        this.#logger.error('Failed to refresh statistics', error);
        this.#showError('Failed to refresh statistics');
    } finally {
        this.#elements.statsDisplay?.classList.remove('stats-loading');
    }
}

// Add refresh button to stats display
#addRefreshButton() {
    const refreshBtn = document.createElement('button');
    refreshBtn.className = 'stats-refresh-btn';
    refreshBtn.innerHTML = '🔄';
    refreshBtn.setAttribute('aria-label', 'Refresh statistics');
    refreshBtn.addEventListener('click', () => this.#refreshStatistics());

    const statsHeader = this.#elements.statsDisplay?.querySelector('h3');
    if (statsHeader) {
        statsHeader.appendChild(refreshBtn);
    }
}
```

## Acceptance Criteria

1. ✅ Statistics display shows correct counts
2. ✅ Numbers animate when changing
3. ✅ Advanced statistics show insights
4. ✅ Progress bar shows completion rate
5. ✅ Statistics update in real-time
6. ✅ Export functionality works
7. ✅ Milestone celebrations appear
8. ✅ Chart visualization (optional)
9. ✅ Refresh button works
10. ✅ All calculations are accurate

## Testing Requirements

1. Test with 0, 1, and many concepts
2. Test statistic calculations accuracy
3. Test real-time updates on CRUD operations
4. Test number animations
5. Test progress bar updates
6. Test export functionality
7. Test milestone triggers
8. Test with edge cases (all zeros, all complete)

## Notes

- Ensure calculations handle edge cases (division by zero)
- Consider caching statistics for performance
- Test animations don't cause layout shifts
- Make statistics accessible to screen readers
- Consider adding more insights based on user feedback
