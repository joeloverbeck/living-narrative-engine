# Possible bugs and incompatible outputs for prototype analysis.

The report for the Monte Carlo simulation in expression-diagnostics.html includes:

## 🎯 Prototype Fit Analysis

Ranking of emotion prototypes by how well they fit this expression's mood regime.

| Rank | Prototype | Gate Pass | P(I≥t) | Conflict | Composite |
|------|-----------|-----------|--------|----------|-----------|
| 1 | **protest_anger** | 79.31% | 100.00% | 0.00% | 0.94 |
| 2 | **embarrassment** | 79.31% | 86.96% | 0.00% | 0.89 |
| 3 | **unease** | 100.00% | 68.97% | 0.00% | 0.89 |
| 4 | **regret** | 68.97% | 90.00% | 0.00% | 0.87 |
| 5 | **irritation** | 100.00% | 62.07% | 0.00% | 0.87 |
| 6 | **envy** | 100.00% | 68.97% | 16.67% | 0.86 |
| 7 | **frustration** | 58.62% | 94.12% | 0.00% | 0.86 |
| 8 | **confusion** | 62.07% | 88.89% | 0.00% | 0.85 |
| 9 | **interest** | 100.00% | 65.52% | 16.67% | 0.85 |
| 10 | **shame** | 72.41% | 76.19% | 0.00% | 0.83 |

### Top 3 Prototype Details

#### 1. protest_anger

- **Intensity Distribution**: P50=0.47, P90=0.58, P95=0.59
- **Conflicting Axes**: None

#### 2. embarrassment

- **Intensity Distribution**: P50=0.42, P90=0.55, P95=0.59
- **Conflicting Axes**: None

#### 3. unease

- **Intensity Distribution**: P50=0.36, P90=0.49, P95=0.49
- **Conflicting Axes**: None

---

## 🧭 Implied Prototype from Prerequisites

Analysis of which prototypes best match the expression's constraint pattern.

### Target Signature

| Axis | Direction | Importance |
|------|-----------|------------|
| affiliation | ↑ High | 0.55 |
| valence | ↓ Low | 0.53 |
| self_evaluation | ↓ Low | 0.51 |
| engagement | ↑ High | 0.54 |
| threat | ↑ High | 0.60 |
| arousal | ↑ High | 0.60 |

### Top 5 by Cosine Similarity

| Rank | Prototype | Similarity | Gate Pass | Combined |
|------|-----------|------------|-----------|----------|
| 1 | **protest_anger** | N/A | 79.31% | 0.88 |
| 2 | **hypervigilance** | N/A | 27.59% | 0.59 |
| 3 | **embarrassment** | N/A | 79.31% | 0.79 |
| 4 | **humiliation** | N/A | 44.83% | 0.64 |
| 5 | **terror** | N/A | 13.79% | 0.51 |

### Top 5 by Gate Pass Rate

| Rank | Prototype | Gate Pass | Similarity | Combined |
|------|-----------|-----------|------------|----------|
| 1 | **interest** | 100.00% | N/A | 0.67 |
| 2 | **unease** | 100.00% | N/A | 0.79 |
| 3 | **irritation** | 100.00% | N/A | 0.78 |
| 4 | **envy** | 100.00% | N/A | 0.79 |
| 5 | **grief** | 86.21% | N/A | 0.58 |

### Top 5 by Combined Score

| Rank | Prototype | Combined | Similarity | Gate Pass |
|------|-----------|----------|------------|----------|
| 1 | **protest_anger** | 0.88 | N/A | 79.31% |
| 2 | **unease** | 0.79 | N/A | 100.00% |
| 3 | **embarrassment** | 0.79 | N/A | 79.31% |
| 4 | **envy** | 0.79 | N/A | 100.00% |
| 5 | **irritation** | 0.78 | N/A | 100.00% |

---

## 🔍 Prototype Gap Detection

Analysis of prototype coverage in "prototype space".

### ✅ Good Coverage

**Nearest Distance**: 0.13 - within acceptable range.

### k-Nearest Prototypes

| Rank | Prototype | Distance | Weight Dist | Gate Dist |
|------|-----------|----------|-------------|----------|
| 1 | **protest_anger** | N/A | 0.18 | 0.00 |
| 2 | **embarrassment** | N/A | 0.34 | 0.00 |
| 3 | **jealousy** | N/A | 0.35 | 0.00 |
| 4 | **awkwardness** | N/A | 0.35 | 0.00 |
| 5 | **hypervigilance** | N/A | 0.35 | 0.00 |


---

However, the non-report version outputs:

🎯 Prototype Fit Analysis
Ranking of emotion prototypes by how well they fit this expression's mood regime.

Rank	Prototype	Gate Pass	P(I≥t)	Conflict	Composite
1	protest_anger	79.3%	100.0%	0%	93.8%
2	embarrassment	79.3%	87.0%	0%	89.2%
3	unease	100.0%	69.0%	0%	89.1%
4	regret	69.0%	90.0%	0%	87.2%
5	irritation	100.0%	62.1%	0%	86.7%
6	envy	100.0%	69.0%	17%	85.8%
7	frustration	58.6%	94.1%	0%	85.5%
8	confusion	62.1%	88.9%	0%	84.7%
9	interest	100.0%	65.5%	17%	84.6%
10	shame	72.4%	76.2%	0%	83.4%
#1 protest_anger
Intensity Quantiles: P50: 0.47 | P90: 0.58 | P95: 0.59
Conflict Magnitude: 0.00
Conflicting Axes: None
#2 embarrassment
Intensity Quantiles: P50: 0.42 | P90: 0.55 | P95: 0.59
Conflict Magnitude: 0.00
Conflicting Axes: None
#3 unease
Intensity Quantiles: P50: 0.36 | P90: 0.49 | P95: 0.49
Conflict Magnitude: 0.00
Conflicting Axes: None
🧭 Implied Prototype from Prerequisites
Analysis of which prototypes best match the expression's constraint pattern.

Target Signature
Axis	Direction	Importance
threat	↑ High	60%
arousal	↑ High	60%
affiliation	↑ High	55%
engagement	↑ High	54%
valence	↓ Low	53%
self_evaluation	↓ Low	51%
Top 5 by Similarity
Rank	Prototype	Similarity	Gate Pass	Combined
1	protest_anger	0%	79%	88%
2	hypervigilance	0%	28%	59%
3	embarrassment	0%	79%	79%
4	humiliation	0%	45%	64%
5	terror	0%	14%	51%
Top 5 by Gate Pass
Rank	Prototype	Gate Pass	Similarity	Combined
1	interest	0%	100%	67%
2	unease	0%	100%	79%
3	irritation	0%	100%	78%
4	envy	0%	100%	79%
5	grief	0%	86%	58%
Top 5 by Combined
Rank	Prototype	Combined	Similarity	Gate Pass
1	protest_anger	0%	79%	88%
2	unease	0%	100%	79%
3	embarrassment	0%	79%	79%
4	envy	0%	100%	79%
5	irritation	0%	100%	78%
🔍 Prototype Gap Detection
Analysis of prototype coverage in "prototype space".

✅ Good Coverage - Nearest prototype is 0.13 units away. Existing prototypes adequately cover this expression's constraint pattern.
k-Nearest Prototypes
Rank	Prototype	Distance	Weight Dist	Gate Dist
1	protest_anger	0.000	0.179	0.000
2	embarrassment	0.000	0.338	0.000
3	jealousy	0.000	0.350	0.000
4	awkwardness	0.000	0.352	0.000
5	hypervigilance	0.000	0.353	0.000