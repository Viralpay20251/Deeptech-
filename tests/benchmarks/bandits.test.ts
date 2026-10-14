/**
 * Benchmark Test Suite: Contextual Bandits & Adaptive Allocation
 */

import { describe, it, expect } from 'vitest';
import {
  UniformFixedAllocation,
  ThompsonSamplingBandit,
  LinUCBBandit,
  runBanditSimulationBenchmark,
  type BanditArm,
} from '../../packages/algorithm-lab/src/index.js';

describe('Algorithm Lab: Contextual Bandits & Adaptive Allocation', () => {
  const arms: BanditArm[] = [
    { id: 'creative_A', name: 'Variant A (Control)', trueConversionRate: 0.02 },
    { id: 'creative_B', name: 'Variant B (High Lift)', trueConversionRate: 0.08 },
    { id: 'creative_C', name: 'Variant C (Medium)', trueConversionRate: 0.04 },
  ];

  it('UniformFixedAllocation cycles arms evenly without adaptation', () => {
    const fixed = new UniformFixedAllocation(arms);
    const selected = [fixed.selectArm().id, fixed.selectArm().id, fixed.selectArm().id, fixed.selectArm().id];
    expect(selected).toEqual(['creative_A', 'creative_B', 'creative_C', 'creative_A']);
  });

  it('ThompsonSamplingBandit updates Beta posterior and selects arms', () => {
    const ts = new ThompsonSamplingBandit(arms);
    // Observe 10 conversions on creative_B
    for (let i = 0; i < 10; i++) {
      ts.update('creative_B', 1);
    }
    // Observe 10 non-conversions on creative_A
    for (let i = 0; i < 10; i++) {
      ts.update('creative_A', 0);
    }

    const stats = ts.getArmStats();
    expect(stats['creative_B']!.expectedValue).toBeGreaterThan(stats['creative_A']!.expectedValue);

    // Repeated sampling should favor creative_B overwhelmingly
    let bCount = 0;
    const trials = 100;
    for (let i = 0; i < trials; i++) {
      if (ts.selectArm().id === 'creative_B') bCount++;
    }
    expect(bCount).toBeGreaterThan(60);
  });

  it('LinUCBBandit scores and updates arms with contextual feature vectors', () => {
    const lin = new LinUCBBandit(arms, 3, 0.5);
    const context = [1.0, 0.5, 0.2];

    const arm = lin.selectArm(context);
    expect(arm).toBeDefined();

    // Update with positive reward
    lin.update(arm.id, context, 1);
  });

  it('runBanditSimulationBenchmark measures cumulative lift over fixed baseline', () => {
    const rounds = 1500;
    const simulation = runBanditSimulationBenchmark(arms, rounds);

    expect(simulation.fixedReport.totalRounds).toBe(rounds);
    expect(simulation.thompsonReport.totalRounds).toBe(rounds);
    expect(simulation.thompsonReport.optimalArmSelectionPct).toBeGreaterThan(
      simulation.fixedReport.optimalArmSelectionPct
    );
  });
});
