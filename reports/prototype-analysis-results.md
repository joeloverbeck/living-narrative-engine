Axis Space Analysis [Technical Report]
Model Integrity Status
✓
Axis Registry
(?)
✓
Schema Validation
(?)
✓
Weight Ranges
(?)
✓
No Duplicates
(?)
All integrity checks passed. Prototypes validated against axis registry and schema.

Prototypes Analyzed:
110
Recommendations:
2
Confidence:
medium
(?)
Confidence: Medium — 2 methods triggered (PCA Analysis, Multi-Axis Conflicts). No boost applied.

New Axis Recommended?
MAYBE
Residual variance (16.8%) exceeds 15% threshold, indicating unexplained dimensions. However, no strong secondary signals (coverage gaps, hub prototypes) were detected. Consider reviewing poorly fitting prototypes.

How is this determined?
YES: (High residual AND coverage gaps) OR (Hub prototypes AND multi-axis conflicts)
MAYBE: High residual alone, OR any other single signal
NO: Residual ≤15% AND no detection signals
Important: PCA uses OR logic for triggering. High residual variance (>15%) alone is sufficient for MAYBE verdict, regardless of "Additional Components" count.

Explained by top 4 PCs:
69.7%
(?)
Expected axis count (K):
6
(?)
Explained by top K PCs:
83.2%
(?)
Signal Sources
✗ FAIL
PCA Analysis:
1
(residual ≥15% triggered)
✓ PASS
Hub Prototypes:
0
(no connectors)
✓ PASS
Coverage Gaps:
0
(adaptive threshold)
✗ FAIL
Multi-Axis Conflicts:
1
(high axis count)
Detection Logic: PCA signal triggers when residual variance >15% OR additional components >0. Either condition alone is sufficient for triggering INVESTIGATE recommendations.

The signal statuses above determine the confidence level shown in the summary.

Dimensionality Analysis (PCA)
Principal Component Analysis reveals whether the current axis set captures prototype variance. High residual variance suggests missing dimensions.

Residual Variance:
16.8%
(?)
Significant Components (Broken-Stick):
3
(?)
Expected Components (K):
6
(?)
Significant Beyond K:
0 *
(?)
Methodology Note: The broken-stick null hypothesis test found 0 additional significant components. This means the eigenvalue distribution matches random expectation—variance is diffuse across many small components rather than concentrated in discoverable hidden dimensions. High residual variance (16.8%) with 0 extra components suggests the unexplained variance may be noise or idiosyncratic prototype differences, not a missing axis.
Formula: The broken-stick model tests whether each eigenvalue exceeds random expectation. Expected(k) = (1/p) × Σ(j=k..p) 1/j, where p is the number of axes. "Beyond expected" = max(0, significant − K) = max(0, 3 − 6) = 0. Since 3 < 6, the clamped result is 0—this means fewer PCA-significant dimensions were found than expected, not that PCA found nothing.
Sparse Filtering Impact
Comparison of dense (sparse-filtered) vs full (unfiltered) PCA

Significant components (full − dense): +2
Residual variance (full − dense): +1.2%
RMSE (full − dense): -0.024
Sparse filtering materially changed PCA conclusions.

Components for 80% Variance:
6
(?)
Components for 90% Variance:
8
(?)
affiliationagency_controlarousalbaseline_libidoengagementfuture_expectancyinhibitory_controlruminationself_controlself_evaluationsexual_arousaltemporal_orientationthreatuncertaintyvalence
Excluded Sparse Axes (10)
Axes used by <10% of prototypes are excluded to prevent sparse axes from distorting PCA due to unbalanced variance contributions from infrequent usage.

affective_empathy
cognitive_empathy
contamination_salience
disgust_sensitivity
evaluation_pressure
evaluation_sensitivity
harm_aversion
ruminative_tendency
sex_excitation
sex_inhibition
Unused but Defined Axes (1)
Truly Unused Defined Axes (1)
These axes are defined in the registry but appear in neither prototype weights nor gate conditions. Consider adding prototypes that use them, or remove them from the registry if unneeded.

sexual_inhibition
Used in Weights but Not in Gates (2)
These axes appear in prototype WEIGHTS but never appear in any prototype gate conditions. Consider adding gates that reference these axes, or verify they are not needed as gates.

baseline_libido
self_control
Extreme Prototypes on Additional Component
Prototypes with highest |projection| on unexplained variance component

aroused_with_shame
0.751
sexual_craving
0.666
romantic_yearning
0.653
sexual_performance_anxiety
0.636
sexual_confidence
0.635
Poorly Fitting Prototypes
Prototypes with highest reconstruction error (don't fit well in current axis space)

aroused_with_shame
RMSE: 0.268
dread
RMSE: 0.247
sexual_performance_anxiety
RMSE: 0.227
humiliation
RMSE: 0.218
protest_anger
RMSE: 0.216
Hub Prototypes
Prototypes connecting multiple clusters may indicate missing dimensions.

No hub prototypes detected.
Coverage Gaps
Behaviorally-similar prototype clusters (grouped by k-means, not dominant axis) whose weight centroids don't align well with any existing axis.

No coverage gaps detected.
Multi-Axis Conflicts
Prototypes with unusually high axis counts (statistical outliers via Tukey's fence).

sexual_performance_anxiety
Axes: 14
Uses 14 axes with evenly mixed signs
Sign Tensions (Informational)
Note: Mixed positive/negative weights are normal for emotional prototypes. This section shows structural patterns for understanding, not defects requiring action. Sign tensions do not contribute to confidence scoring or recommendations.

calm Informational
6 active axes, 100% sign diversity
+: inhibitory_control, valence
−: arousal, threat, uncertainty
contentment Informational
5 active axes, 80% sign diversity
+: agency_control, valence
−: arousal, threat, uncertainty
release Informational
7 active axes, 86% sign diversity
+: engagement
−: arousal, inhibitory_control, threat
joy Informational
5 active axes, 80% sign diversity
+: arousal, future_expectancy, valence
−: inhibitory_control
euphoria Informational
6 active axes, 67% sign diversity
+: agency_control, arousal, engagement, valence
−: inhibitory_control, self_control
enthusiasm Informational
6 active axes, 67% sign diversity
+: arousal, engagement, future_expectancy, valence
−: inhibitory_control, self_control
amusement Informational
6 active axes, 100% sign diversity
+: arousal, engagement, valence
−: inhibitory_control, threat
awe Informational
7 active axes, 86% sign diversity
+: arousal, engagement, uncertainty, valence
−: agency_control, inhibitory_control, self_control
aesthetic_appreciation Informational
9 active axes, 67% sign diversity
+: engagement, valence
−: arousal, threat
fascination Informational
5 active axes, 80% sign diversity
+: arousal, engagement, valence
−: inhibitory_control
entranced Informational
8 active axes, 75% sign diversity
+: engagement, uncertainty
−: agency_control, arousal, inhibitory_control, self_control, threat
transfixed Informational
8 active axes, 100% sign diversity
+: arousal, engagement, uncertainty
−: agency_control, inhibitory_control, self_control, threat
quiet_absorption Informational
8 active axes, 100% sign diversity
+: engagement, inhibitory_control, self_control, valence
−: agency_control, arousal, threat, uncertainty
spellbound_absorption Informational
8 active axes, 75% sign diversity
+: engagement, uncertainty
−: agency_control, arousal, inhibitory_control, self_control, threat
focused_absorption Informational
7 active axes, 86% sign diversity
+: agency_control, engagement, inhibitory_control, self_control
−: arousal, threat, uncertainty
grief Informational
7 active axes, 86% sign diversity
+: engagement, rumination, ruminative_tendency
−: agency_control, arousal, temporal_orientation, valence
numbness Informational
6 active axes, 67% sign diversity
+: inhibitory_control, self_control
−: arousal, engagement, future_expectancy, valence
nostalgia Informational
7 active axes, 86% sign diversity
+: affiliation, engagement, valence
−: temporal_orientation, threat
apathy Informational
6 active axes, 67% sign diversity
+: inhibitory_control, self_control
−: arousal, engagement, future_expectancy, valence
unease Informational
6 active axes, 67% sign diversity
+: threat
−: valence
apprehension Informational
9 active axes, 67% sign diversity
+: inhibitory_control, self_control, temporal_orientation, threat
−: future_expectancy
stress_acute Informational
9 active axes, 67% sign diversity
+: arousal, engagement, threat
−: agency_control, future_expectancy, inhibitory_control, self_control, valence
strain_chronic Informational
9 active axes, 67% sign diversity
+: inhibitory_control, self_control, threat
−: agency_control, arousal, engagement, future_expectancy, valence
anxiety Informational
9 active axes, 89% sign diversity
+: arousal, temporal_orientation, threat, uncertainty
−: agency_control, future_expectancy, inhibitory_control, self_control, valence
craving Informational
8 active axes, 100% sign diversity
+: arousal, engagement
−: agency_control, inhibitory_control, self_control, valence
thrill Informational
5 active axes, 80% sign diversity
+: arousal, threat, valence
−: inhibitory_control, self_control
fear Informational
6 active axes, 67% sign diversity
+: arousal, threat
−: agency_control, inhibitory_control, self_control, valence
terror Informational
7 active axes, 86% sign diversity
+: arousal, engagement, threat
−: agency_control, inhibitory_control, self_control, valence
panic Informational
8 active axes, 75% sign diversity
+: arousal, engagement, threat
−: agency_control, future_expectancy, inhibitory_control, self_control, valence
alarm Informational
6 active axes, 67% sign diversity
+: arousal, inhibitory_control, self_control, threat
−: agency_control, valence
freeze Informational
7 active axes, 86% sign diversity
+: engagement, inhibitory_control, self_control, threat
−: agency_control, valence
suspicion Informational
5 active axes, 80% sign diversity
+: engagement, threat, uncertainty
−: affiliation, valence
irritation Informational
5 active axes, 80% sign diversity
+: arousal
−: inhibitory_control, self_control, valence
frustration Informational
6 active axes, 67% sign diversity
+: arousal, engagement
−: agency_control, inhibitory_control, self_control, valence
smoldering_anger Informational
8 active axes, 75% sign diversity
+: agency_control, engagement, inhibitory_control, self_control, threat
−: affiliation, arousal, valence
protest_anger Informational
8 active axes, 75% sign diversity
+: affiliation, agency_control, arousal, engagement, threat
−: valence
rage Informational
7 active axes, 86% sign diversity
+: agency_control, arousal, threat
−: affiliation, inhibitory_control, self_control, valence
wrath Informational
9 active axes, 89% sign diversity
+: agency_control, arousal, engagement
−: affiliation, inhibitory_control, self_control, valence
resentment Informational
10 active axes, 80% sign diversity
+: arousal, engagement, inhibitory_control, rumination, ruminative_tendency, self_control
−: agency_control, self_evaluation, temporal_orientation, valence
disgust Informational
7 active axes, 86% sign diversity
+: arousal, contamination_salience, disgust_sensitivity
−: engagement, inhibitory_control, self_control, valence
embarrassment Informational
8 active axes, 75% sign diversity
+: arousal, evaluation_pressure, evaluation_sensitivity, inhibitory_control, self_control
−: self_evaluation, valence
awkwardness Informational
8 active axes, 100% sign diversity
+: arousal, evaluation_pressure, evaluation_sensitivity
−: agency_control, self_control, valence
regret Informational
10 active axes, 100% sign diversity
+: engagement, rumination, ruminative_tendency
−: future_expectancy, self_evaluation, temporal_orientation, valence
humiliation Informational
10 active axes, 80% sign diversity
+: arousal, evaluation_pressure, evaluation_sensitivity, inhibitory_control, threat
−: affiliation, agency_control, self_evaluation, valence
submission Informational
6 active axes, 67% sign diversity
+: engagement, inhibitory_control, self_control, threat
−: agency_control
trusting_surrender Informational
8 active axes, 75% sign diversity
+: engagement, future_expectancy, valence
−: agency_control, inhibitory_control, self_control, threat
jealousy Informational
10 active axes, 80% sign diversity
+: arousal, engagement, threat, uncertainty
−: affiliation, agency_control, inhibitory_control, self_control, self_evaluation, valence
gratitude Informational
6 active axes, 67% sign diversity
+: affiliation, self_control, valence
−: threat
empathic_distress Informational
11 active axes, 91% sign diversity
+: affective_empathy, affiliation, arousal, engagement
−: agency_control, future_expectancy, inhibitory_control, self_control, self_evaluation, valence
hatred Informational
11 active axes, 73% sign diversity
+: agency_control, arousal, engagement, threat
−: affective_empathy, affiliation, cognitive_empathy, harm_aversion, inhibitory_control, self_control, valence
surprise_startle Informational
6 active axes, 100% sign diversity
+: arousal, engagement, threat
−: agency_control, inhibitory_control, self_control
passion Informational
9 active axes, 67% sign diversity
+: arousal, baseline_libido, engagement, sexual_arousal, threat, valence
−: agency_control, inhibitory_control, self_control
sexual_sensual_pleasure Informational
8 active axes, 75% sign diversity
+: self_evaluation, sexual_arousal, valence
−: inhibitory_control, self_control, threat
submissive_arousal Informational
9 active axes, 67% sign diversity
+: arousal, baseline_libido, engagement, sexual_arousal, threat
−: agency_control, inhibitory_control, self_control
sexual_playfulness Informational
9 active axes, 67% sign diversity
+: arousal, engagement, self_evaluation, sexual_arousal, valence
−: inhibitory_control, self_control, threat
fearful_arousal Informational
8 active axes, 100% sign diversity
+: arousal, sexual_arousal, threat
−: agency_control, inhibitory_control, self_control, valence
sexual_craving Informational
10 active axes, 80% sign diversity
+: arousal, baseline_libido, engagement, sex_excitation, sexual_arousal
−: agency_control, inhibitory_control, self_control
sexual_performance_anxiety Informational
14 active axes, 71% sign diversity
+: arousal, evaluation_pressure, evaluation_sensitivity, sexual_arousal, temporal_orientation, threat, uncertainty
−: agency_control, self_control, self_evaluation, valence
sexual_frustration Informational
9 active axes, 89% sign diversity
+: arousal, baseline_libido, engagement, sexual_arousal, threat
−: agency_control, inhibitory_control, self_control, valence
aroused_with_disgust Informational
9 active axes, 89% sign diversity
+: arousal, contamination_salience, disgust_sensitivity, sexual_arousal
−: inhibitory_control, self_control, self_evaluation, valence
sexual_indifference Informational
8 active axes, 100% sign diversity
+: inhibitory_control, self_control, sex_inhibition
−: arousal, baseline_libido, engagement, threat
Axis Polarity Coverage
Identifies axes with imbalanced positive/negative weight distributions. An axis dominated by one polarity suggests missing prototype coverage for the opposite direction.

13 imbalanced axes detected
Actionable
ruminative_tendency
100% positive
7 prototypes use positive, only 0 use negative
Positive weight bias is expected for unipolar axis
contamination_salience
100% positive
3 prototypes use positive, only 0 use negative
Consider adding prototypes with negative "contamination_salience" weights
disgust_sensitivity
100% positive
3 prototypes use positive, only 0 use negative
Positive weight bias is expected for unipolar axis
evaluation_sensitivity
100% positive
5 prototypes use positive, only 0 use negative
Positive weight bias is expected for unipolar axis
sexual_arousal
100% positive
17 prototypes use positive, only 0 use negative
Positive weight bias is expected for unipolar axis
sex_excitation
100% positive
3 prototypes use positive, only 0 use negative
Positive weight bias is expected for unipolar axis
baseline_libido
88% positive
15 prototypes use positive, only 2 use negative
Positive weight bias is expected for unipolar axis
engagement
87% positive
74 prototypes use positive, only 11 use negative
Consider adding prototypes with negative "engagement" weights
affective_empathy
83% positive
5 prototypes use positive, only 1 use negative
Positive weight bias is expected for unipolar axis
cognitive_empathy
83% positive
5 prototypes use positive, only 1 use negative
Positive weight bias is expected for unipolar axis
evaluation_pressure
83% positive
5 prototypes use positive, only 1 use negative
Consider adding prototypes with negative "evaluation_pressure" weights
rumination
82% positive
9 prototypes use positive, only 2 use negative
Consider adding prototypes with negative "rumination" weights
harm_aversion
75% positive
3 prototypes use positive, only 1 use negative
Positive weight bias is expected for unipolar axis
⚠️ Warnings
Axis "rumination" is 82% positive: 9 prototypes use positive weights, only 2 use negative. Consider adding prototypes with negative "rumination" weights.
Axis "engagement" is 87% positive: 74 prototypes use positive weights, only 11 use negative. Consider adding prototypes with negative "engagement" weights.
Axis "ruminative_tendency" is 100% positive: 7 prototypes use positive weights, only 0 use negative. Consider adding prototypes with negative "ruminative_tendency" weights. (expected for unipolar axis)
Axis "harm_aversion" is 75% positive: 3 prototypes use positive weights, only 1 use negative. Consider adding prototypes with negative "harm_aversion" weights. (expected for unipolar axis)
Axis "affective_empathy" is 83% positive: 5 prototypes use positive weights, only 1 use negative. Consider adding prototypes with negative "affective_empathy" weights. (expected for unipolar axis)
Axis "cognitive_empathy" is 83% positive: 5 prototypes use positive weights, only 1 use negative. Consider adding prototypes with negative "cognitive_empathy" weights. (expected for unipolar axis)
Axis "contamination_salience" is 100% positive: 3 prototypes use positive weights, only 0 use negative. Consider adding prototypes with negative "contamination_salience" weights.
Axis "disgust_sensitivity" is 100% positive: 3 prototypes use positive weights, only 0 use negative. Consider adding prototypes with negative "disgust_sensitivity" weights. (expected for unipolar axis)
Axis "evaluation_sensitivity" is 100% positive: 5 prototypes use positive weights, only 0 use negative. Consider adding prototypes with negative "evaluation_sensitivity" weights. (expected for unipolar axis)
Axis "evaluation_pressure" is 83% positive: 5 prototypes use positive weights, only 1 use negative. Consider adding prototypes with negative "evaluation_pressure" weights.
Axis "sexual_arousal" is 100% positive: 17 prototypes use positive weights, only 0 use negative. Consider adding prototypes with negative "sexual_arousal" weights. (expected for unipolar axis)
Axis "sex_excitation" is 100% positive: 3 prototypes use positive weights, only 0 use negative. Consider adding prototypes with negative "sex_excitation" weights. (expected for unipolar axis)
Axis "baseline_libido" is 88% positive: 15 prototypes use positive weights, only 2 use negative. Consider adding prototypes with negative "baseline_libido" weights. (expected for unipolar axis)
Prototype Complexity Analysis
Analyzes the distribution of active axes across prototypes and identifies frequently co-occurring axis bundles that may suggest composite concepts.

Prototypes Analyzed:
110
Average Axis Count:
7.86
Median:
8
Q1 / Q3:
6 / 9
Axis Count Distribution
1
3
6
4
10
5
15
6
16
7
16
8
23
9
11
10
6
11
4
12
1
13
1
14
View as table
Complexity Outliers (3)
Prototypes with unusually high axis counts (statistical outliers).

sadness
3 axes
moral_outrage
13 axes
sexual_performance_anxiety
14 axes
Frequently Co-occurring Axis Bundles (20)
Axes that frequently appear together may suggest composite concepts.

arousal
valence
Appears in 95 prototypes Suggested: A_V_composite
self_control
valence
Appears in 91 prototypes Suggested: selfcontrol_V_composite
inhibitory_control
valence
Appears in 84 prototypes Suggested: inhibitorycontrol_V_composite
engagement
valence
Appears in 84 prototypes Suggested: engagement_V_composite
inhibitory_control
self_control
Appears in 83 prototypes Suggested: inhibitorycontrol_selfcontrol_composite
inhibitory_control
self_control
valence
Appears in 82 prototypes Suggested: multi_axis_bundle_3
arousal
self_control
Appears in 79 prototypes Suggested: A_selfcontrol_composite
arousal
self_control
valence
Appears in 78 prototypes Suggested: multi_axis_bundle_3
arousal
inhibitory_control
Appears in 76 prototypes Suggested: A_inhibitorycontrol_composite
agency_control
valence
Appears in 76 prototypes Suggested: agencycontrol_V_composite
arousal
inhibitory_control
valence
Appears in 75 prototypes Suggested: multi_axis_bundle_3
arousal
inhibitory_control
self_control
Appears in 74 prototypes Suggested: multi_axis_bundle_3
threat
valence
Appears in 74 prototypes Suggested: threat_V_composite
arousal
inhibitory_control
self_control
valence
Appears in 73 prototypes Suggested: multi_axis_bundle_4
arousal
engagement
Appears in 72 prototypes Suggested: A_engagement_composite
engagement
self_control
Appears in 72 prototypes Suggested: engagement_selfcontrol_composite
arousal
engagement
valence
Appears in 71 prototypes Suggested: multi_axis_bundle_3
engagement
self_control
valence
Appears in 71 prototypes Suggested: multi_axis_bundle_3
agency_control
arousal
Appears in 68 prototypes Suggested: agencycontrol_A_composite
agency_control
arousal
valence
Appears in 67 prototypes Suggested: multi_axis_bundle_3
Complexity Recommendations (10)
consider_new_axis inhibitory_control + self_control + valence 75% of prototypes (82/110) use all these axes together
consider_new_axis arousal + self_control + valence 71% of prototypes (78/110) use all these axes together
consider_new_axis arousal + inhibitory_control + valence 68% of prototypes (75/110) use all these axes together
consider_new_axis arousal + inhibitory_control + self_control 67% of prototypes (74/110) use all these axes together
consider_new_axis arousal + inhibitory_control + self_control + valence 66% of prototypes (73/110) use all these axes together
consider_new_axis arousal + engagement + valence 65% of prototypes (71/110) use all these axes together
consider_new_axis engagement + self_control + valence 65% of prototypes (71/110) use all these axes together
consider_new_axis agency_control + arousal + valence 61% of prototypes (67/110) use all these axes together
reduce_complexity moral_outrage + sexual_performance_anxiety 2 prototype(s) have unusually high axis counts (>10 axes)
balance_complexity sadness 1 prototype(s) have unusually low axis counts (<6 axes)
Axis Recommendations
medium
INVESTIGATE
PCA analysis suggests unexplained variance. Investigate the top-loading prototypes for potential axis candidates.
PCA residual variance ratio: 16.8%,Additional significant components: 0,Top loading prototypes: aroused_with_shame, sexual_craving, romantic_yearning, sexual_performance_anxiety, sexual_confidence
low
REFINE_EXISTING
Prototype "sexual_performance_anxiety" shows multi-axis conflict patterns that may be related to the axis gap.
Active axes: 14,Sign balance: 0.29
Candidate Axis Validation
Would adding a new axis help? Tests potential axis directions against improvement metrics.

No candidate axes to validate (extraction found 0 significant components, 0 coverage gaps, 0 hub candidates).
Flagged Prototypes Analysis
Prototypes flagged by detection methods with their dominant axis weights.

aroused_with_shame
Extreme Projection
Top Axes by Weight
sexual_arousal
+0.800
self_evaluation
-0.800
arousal
+0.400
valence
-0.300
inhibitory_control
+0.300
Why flagged: Projection score 0.751 on unexplained component
sexual_craving
Extreme Projection
Top Axes by Weight
sexual_arousal
+1.000
engagement
+0.650
self_control
-0.650
inhibitory_control
-0.550
arousal
+0.350
Why flagged: Projection score 0.666 on unexplained component
romantic_yearning
Extreme Projection
Top Axes by Weight
engagement
+0.600
sexual_arousal
+0.550
temporal_orientation
+0.550
future_expectancy
+0.450
uncertainty
+0.450
Why flagged: Projection score 0.653 on unexplained component
sexual_performance_anxiety
Extreme Projection
Top Axes by Weight
evaluation_pressure
+0.850
sexual_arousal
+0.750
uncertainty
+0.650
self_evaluation
-0.550
agency_control
-0.550
Why flagged: Projection score 0.636 on unexplained component
sexual_confidence
Extreme Projection
Top Axes by Weight
sexual_arousal
+0.850
agency_control
+0.750
uncertainty
-0.700
self_evaluation
+0.350
inhibitory_control
+0.300
Why flagged: Projection score 0.635 on unexplained component
erotic_thrill
Extreme Projection
Top Axes by Weight
sexual_arousal
+0.800
arousal
+0.600
threat
+0.500
engagement
+0.400
valence
+0.300
Why flagged: Projection score 0.526 on unexplained component
sexual_dominant_pleasure
Extreme Projection
Top Axes by Weight
sexual_arousal
+0.800
agency_control
+0.800
arousal
+0.400
valence
+0.300
self_control
-0.300
Why flagged: Projection score 0.522 on unexplained component
passion
Extreme Projection
Top Axes by Weight
engagement
+1.000
sexual_arousal
+0.700
valence
+0.700
arousal
+0.500
self_control
-0.500
Why flagged: Projection score 0.486 on unexplained component
wrath
Extreme Projection
Top Axes by Weight
arousal
+1.000
inhibitory_control
-0.900
valence
-0.750
self_control
-0.600
agency_control
+0.350
Why flagged: Projection score -0.481 on unexplained component
submissive_arousal
Extreme Projection
Top Axes by Weight
sexual_arousal
+0.750
agency_control
-0.700
self_control
-0.400
arousal
+0.300
engagement
+0.300
Why flagged: Projection score 0.471 on unexplained component