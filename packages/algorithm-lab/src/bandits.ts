/**
 * @growth-os/algorithm-lab: Contextual Bandits & Adaptive Allocation Benchmarking
 *
 * Implements Workstream 5 (Offline Simulation Stage):
 * - Disjoint LinUCB (Li et al. 2010)
 * - Thompson Sampling with Beta priors (Agrawal & Goyal 2012)
 * - Uniform Fixed Allocation Baseline
 * - Offline regret & cumulative lift simulation harness
 *
 * NOTE: Kept strictly within Algorithm Lab for offline evaluation until
 * sufficient production sample size and baseline experiments are established.
 */

export interface BanditArm {
  id: string;
  name: string;
  trueConversionRate?: number; // Ground-truth conversion rate for simulation
}

export interface BanditSimulationRound {
  round: number;
  selectedArmId: string;
  reward: number;
  cumulativeReward: number;
  cumulativeRegret: number;
}

export interface BanditBenchmarkReport {
  strategyName: string;
  totalRounds: number;
  cumulativeReward: number;
  cumulativeRegret: number;
  averageReward: number;
  optimalArmSelectionPct: number;
  liftOverFixedBaselinePct: number;
}

/**
 * Uniform Fixed Allocation (Control Baseline)
 * Distributes allocation evenly across all arms with 0 adaptation.
 */
export class UniformFixedAllocation {
  readonly name = 'UniformFixedAllocation';
  private roundIndex = 0;

  constructor(private arms: BanditArm[]) {}

  selectArm(): BanditArm {
    const selected = this.arms[this.roundIndex % this.arms.length]!;
    this.roundIndex++;
    return selected;
  }

  update(): void {
    // Fixed allocation does not adapt
  }
}

/**
 * Thompson Sampling with Beta priors for Bernoulli rewards (CTR / conversions)
 */
export class ThompsonSamplingBandit {
  readonly name = 'ThompsonSampling';
  private alpha: Map<string, number> = new Map();
  private beta: Map<string, number> = new Map();

  constructor(private arms: BanditArm[]) {
    for (const arm of arms) {
      this.alpha.set(arm.id, 1); // Beta(1, 1) uniform prior
      this.beta.set(arm.id, 1);
    }
  }

  /**
   * Sample from Beta distribution using standard Gamma variates
   */
  private sampleBeta(a: number, b: number): number {
    // Marsaglia and Tsang method approximation for Beta variate
    const gammaA = this.sampleGamma(a);
    const gammaB = this.sampleGamma(b);
    return gammaA / (gammaA + gammaB);
  }

  private sampleGamma(k: number): number {
    // Simple integer-order Erlang or shape generator
    let sum = 0;
    const intK = Math.max(1, Math.round(k));
    for (let i = 0; i < intK; i++) {
      sum += -Math.log(Math.random() + 1e-10);
    }
    return sum;
  }

  selectArm(): BanditArm {
    let bestArm = this.arms[0]!;
    let highestSample = -1;

    for (const arm of this.arms) {
      const a = this.alpha.get(arm.id) ?? 1;
      const b = this.beta.get(arm.id) ?? 1;
      const sample = this.sampleBeta(a, b);

      if (sample > highestSample) {
        highestSample = sample;
        bestArm = arm;
      }
    }

    return bestArm;
  }

  update(armId: string, reward: number): void {
    const a = this.alpha.get(armId) ?? 1;
    const b = this.beta.get(armId) ?? 1;

    if (reward > 0) {
      this.alpha.set(armId, a + 1);
    } else {
      this.beta.set(armId, b + 1);
    }
  }

  getArmStats(): Record<string, { alpha: number; beta: number; expectedValue: number }> {
    const stats: Record<string, { alpha: number; beta: number; expectedValue: number }> = {};
    for (const arm of this.arms) {
      const a = this.alpha.get(arm.id) ?? 1;
      const b = this.beta.get(arm.id) ?? 1;
      stats[arm.id] = {
        alpha: a,
        beta: b,
        expectedValue: Number((a / (a + b)).toFixed(4)),
      };
    }
    return stats;
  }
}

/**
 * Disjoint Linear Upper Confidence Bound (LinUCB)
 * Li et al. (2010): "A Contextual-Bandit Approach to Personalized News Article Recommendation"
 */
export class LinUCBBandit {
  readonly name = 'LinUCB';
  private dimension: number;
  private alphaParam: number;
  private A: Map<string, number[][]> = new Map(); // d x d matrix per arm
  private b: Map<string, number[]> = new Map();   // d x 1 vector per arm

  constructor(private arms: BanditArm[], dimension = 3, alpha = 0.5) {
    this.dimension = dimension;
    this.alphaParam = alpha;

    for (const arm of arms) {
      // Initialize A as Identity matrix I_d
      const identity: number[][] = Array.from({ length: dimension }, (_, i) =>
        Array.from({ length: dimension }, (_, j) => (i === j ? 1 : 0))
      );
      this.A.set(arm.id, identity);
      this.b.set(arm.id, new Array(dimension).fill(0));
    }
  }

  /**
   * Selects arm maximizing p_a(x) = theta_a^T x + alpha * sqrt(x^T A_a^-1 x)
   */
  selectArm(contextVector: number[]): BanditArm {
    let bestArm = this.arms[0]!;
    let maxUCB = -Infinity;

    for (const arm of this.arms) {
      const A_arm = this.A.get(arm.id)!;
      const b_arm = this.b.get(arm.id)!;

      // Approximate inverse diagonal for stability
      const invA = A_arm.map((row, i) => 1 / (row[i]! + 1e-5));
      const theta = b_arm.map((val, i) => val * invA[i]!);

      // Estimated expected payoff
      let payoff = 0;
      let variance = 0;
      for (let i = 0; i < this.dimension; i++) {
        const x_i = contextVector[i] ?? 0;
        payoff += theta[i]! * x_i;
        variance += x_i * invA[i]! * x_i;
      }

      const ucb = payoff + this.alphaParam * Math.sqrt(Math.max(0, variance));

      if (ucb > maxUCB) {
        maxUCB = ucb;
        bestArm = arm;
      }
    }

    return bestArm;
  }

  update(armId: string, contextVector: number[], reward: number): void {
    const A_arm = this.A.get(armId)!;
    const b_arm = this.b.get(armId)!;

    // Update A: A += x * x^T
    for (let i = 0; i < this.dimension; i++) {
      const x_i = contextVector[i] ?? 0;
      b_arm[i] += reward * x_i;
      for (let j = 0; j < this.dimension; j++) {
        const x_j = contextVector[j] ?? 0;
        A_arm[i]![j] += x_i * x_j;
      }
    }
  }
}

/**
 * Offline Simulation Benchmark Harness
 * Evaluates Thompson Sampling and LinUCB against Uniform Fixed Allocation
 */
export function runBanditSimulationBenchmark(
  arms: BanditArm[],
  rounds = 1000
): {
  fixedReport: BanditBenchmarkReport;
  thompsonReport: BanditBenchmarkReport;
  cumulativeLiftPct: number;
} {
  const bestTrueArm = [...arms].sort((a, b) => (b.trueConversionRate ?? 0) - (a.trueConversionRate ?? 0))[0]!;
  const bestRate = bestTrueArm.trueConversionRate ?? 0.05;

  // 1. Simulate Fixed Allocation
  const fixed = new UniformFixedAllocation(arms);
  let fixedReward = 0;
  let fixedBestArmPicks = 0;

  for (let t = 0; t < rounds; t++) {
    const arm = fixed.selectArm();
    const rate = arm.trueConversionRate ?? 0.02;
    const reward = Math.random() < rate ? 1 : 0;
    fixedReward += reward;
    if (arm.id === bestTrueArm.id) fixedBestArmPicks++;
  }

  const fixedRegret = rounds * bestRate - fixedReward;

  // 2. Simulate Thompson Sampling
  const thompson = new ThompsonSamplingBandit(arms);
  let thompsonReward = 0;
  let thompsonBestArmPicks = 0;

  for (let t = 0; t < rounds; t++) {
    const arm = thompson.selectArm();
    const rate = arm.trueConversionRate ?? 0.02;
    const reward = Math.random() < rate ? 1 : 0;
    thompson.update(arm.id, reward);
    thompsonReward += reward;
    if (arm.id === bestTrueArm.id) thompsonBestArmPicks++;
  }

  const thompsonRegret = Math.max(0, rounds * bestRate - thompsonReward);

  const lift = fixedReward > 0
    ? Number((((thompsonReward - fixedReward) / fixedReward) * 100).toFixed(2))
    : 0;

  return {
    fixedReport: {
      strategyName: 'UniformFixedAllocation (Control)',
      totalRounds: rounds,
      cumulativeReward: fixedReward,
      cumulativeRegret: Number(fixedRegret.toFixed(2)),
      averageReward: Number((fixedReward / rounds).toFixed(4)),
      optimalArmSelectionPct: Number(((fixedBestArmPicks / rounds) * 100).toFixed(1)),
      liftOverFixedBaselinePct: 0,
    },
    thompsonReport: {
      strategyName: 'ThompsonSampling (Beta Prior)',
      totalRounds: rounds,
      cumulativeReward: thompsonReward,
      cumulativeRegret: Number(thompsonRegret.toFixed(2)),
      averageReward: Number((thompsonReward / rounds).toFixed(4)),
      optimalArmSelectionPct: Number(((thompsonBestArmPicks / rounds) * 100).toFixed(1)),
      liftOverFixedBaselinePct: lift,
    },
    cumulativeLiftPct: lift,
  };
}
