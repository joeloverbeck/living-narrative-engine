# Prototype discovery issues

When analyzing sensual_enjoyment.expression.json in expression-diagnostics.html through 'Run Simulator', the prototype fit analysis shows (in the report):

## Report prototype fit analysis

## 🎯 Prototype Fit Analysis

Ranking of emotion prototypes by how well they fit this expression's mood regime.

| Rank | Prototype | Gate Pass | P(I≥t) | Conflict | Composite |
|------|-----------|-----------|--------|----------|-----------|
| 1 | **calm** | 92.27% | 45.74% | 0.00% | 0.79 |
| 2 | **relief** | 92.27% | 38.58% | 0.00% | 0.76 |
| 3 | **trust** | 100.00% | 22.21% | 0.00% | 0.73 |
| 4 | **numbness** | 18.27% | 90.50% | 0.00% | 0.72 |
| 5 | **sadness** | 30.43% | 78.72% | 0.00% | 0.72 |
| 6 | **disappointment** | 22.65% | 82.87% | 0.00% | 0.71 |
| 7 | **cynicism** | 17.86% | 86.31% | 0.00% | 0.71 |
| 8 | **contentment** | 36.42% | 68.44% | 0.00% | 0.70 |
| 9 | **boredom** | 37.82% | 66.65% | 0.00% | 0.70 |
| 10 | **fatigue** | 40.47% | 62.15% | 0.00% | 0.69 |

### Top 3 Prototype Details

#### 1. calm

- **Intensity Distribution**: P50=0.27, P90=0.64, P95=0.73
- **Conflicting Axes**: None

#### 2. relief

- **Intensity Distribution**: P50=0.20, P90=0.59, P95=0.69
- **Conflicting Axes**: None

#### 3. trust

- **Intensity Distribution**: P50=0.10, P90=0.43, P95=0.52
- **Conflicting Axes**: None

---

## 🧭 Implied Prototype from Prerequisites

Analysis of which prototypes best match the expression's constraint pattern.

### Target Signature

| Axis | Direction | Importance |
|------|-----------|------------|
| threat | ↓ Low | 0.42 |
| arousal | ↓ Low | 0.34 |

### Top 5 by Cosine Similarity

| Rank | Prototype | Similarity | Gate Pass | Combined |
|------|-----------|------------|-----------|----------|
| 1 | **calm** | 0.98 | 92.27% | 0.96 |
| 2 | **relief** | 0.75 | 92.27% | 0.82 |
| 3 | **contentment** | 0.67 | 36.42% | 0.55 |
| 4 | **fatigue** | 0.55 | 40.47% | 0.49 |
| 5 | **trusting_surrender** | 0.53 | 3.94% | 0.33 |

### Top 5 by Gate Pass Rate

| Rank | Prototype | Gate Pass | Similarity | Combined |
|------|-----------|-----------|------------|----------|
| 1 | **trust** | 100.00% | 0.49 | 0.69 |
| 2 | **calm** | 92.27% | 0.98 | 0.96 |
| 3 | **relief** | 92.27% | 0.75 | 0.82 |
| 4 | **confusion** | 59.88% | -0.19 | 0.12 |
| 5 | **love_attachment** | 46.91% | 0.13 | 0.27 |

### Top 5 by Combined Score

| Rank | Prototype | Combined | Similarity | Gate Pass |
|------|-----------|----------|------------|----------|
| 1 | **calm** | 0.96 | 0.98 | 92.27% |
| 2 | **relief** | 0.82 | 0.75 | 92.27% |
| 3 | **trust** | 0.69 | 0.49 | 100.00% |
| 4 | **contentment** | 0.55 | 0.67 | 36.42% |
| 5 | **fatigue** | 0.49 | 0.55 | 40.47% |

---

## 🔍 Prototype Gap Detection

Analysis of prototype coverage in "prototype space".

### ✅ Good Coverage

**Nearest Distance**: 0.21 - within acceptable range.

### k-Nearest Prototypes

| Rank | Prototype | Distance | Weight Dist | Gate Dist |
|------|-----------|----------|-------------|----------|
| 1 | **trust** | 0.21 | 0.29 | 0.00 |
| 2 | **gratitude** | 0.27 | 0.39 | 0.00 |
| 3 | **cynicism** | 0.29 | 0.41 | 0.00 |
| 4 | **confusion** | 0.29 | 0.41 | 0.00 |
| 5 | **guilt** | 0.29 | 0.42 | 0.00 |


## Non-report output prototype fit analysis

🎯 Prototype Fit Analysis
Ranking of emotion prototypes by how well they fit this expression's mood regime.

Rank	Prototype	Gate Pass	P(I≥t)	Conflict	Composite
1	calm	92.3%	45.7%	0%	78.7%
2	relief	92.3%	38.6%	0%	76.2%
3	trust	100.0%	22.2%	0%	72.8%
4	numbness	18.3%	90.5%	0%	72.2%
5	sadness	30.4%	78.7%	0%	71.7%
6	disappointment	22.7%	82.9%	0%	70.8%
7	cynicism	17.9%	86.3%	0%	70.6%
8	contentment	36.4%	68.4%	0%	69.9%
9	boredom	37.8%	66.7%	0%	69.7%
10	fatigue	40.5%	62.1%	0%	68.9%
#1 calm
Intensity Quantiles: P50: 0.27 | P90: 0.64 | P95: 0.73
Conflict Magnitude: 0.00
Conflicting Axes: None
#2 relief
Intensity Quantiles: P50: 0.20 | P90: 0.59 | P95: 0.69
Conflict Magnitude: 0.00
Conflicting Axes: None
#3 trust
Intensity Quantiles: P50: 0.10 | P90: 0.43 | P95: 0.52
Conflict Magnitude: 0.00
Conflicting Axes: None
🧭 Implied Prototype from Prerequisites
Analysis of which prototypes best match the expression's constraint pattern.

Target Signature
Axis	Direction	Importance
threat	↓ Low	43%
arousal	↓ Low	34%
Top 5 by Similarity
Rank	Prototype	Similarity	Gate Pass	Combined
1	calm	98%	92%	96%
2	relief	75%	92%	82%
3	contentment	67%	36%	55%
4	fatigue	55%	40%	49%
5	trusting_surrender	53%	4%	33%
Top 5 by Gate Pass
Rank	Prototype	Gate Pass	Similarity	Combined
1	trust	49%	100%	69%
2	calm	98%	92%	96%
3	relief	75%	92%	82%
4	confusion	-19%	60%	12%
5	love_attachment	13%	47%	27%
Top 5 by Combined
Rank	Prototype	Combined	Similarity	Gate Pass
1	calm	98%	92%	96%
2	relief	75%	92%	82%
3	trust	49%	100%	69%
4	contentment	67%	36%	55%
5	fatigue	55%	40%	49%
🔍 Prototype Gap Detection
Analysis of prototype coverage in "prototype space".

✅ Good Coverage - Nearest prototype is 0.21 units away. Existing prototypes adequately cover this expression's constraint pattern.
k-Nearest Prototypes
Rank	Prototype	Distance	Weight Dist	Gate Dist
1	trust	0.206	0.294	0.000
2	gratitude	0.273	0.389	0.000
3	cynicism	0.287	0.410	0.000
4	confusion	0.289	0.412	0.000
5	guilt	0.291	0.416	0.000