import React, { useState, useEffect, useMemo } from 'react';

export type MultiplierBrand = 'talentxcel' | 'chatr' | 'nutytales';

export interface MultiplierFlowProps {
  hostname: string;
  brand: MultiplierBrand;
  initialRole?: string;
  initialCity?: string;
  initialExperience?: string;
  initialIntent?: string;
  initialCategory?: string;
  sessionId?: string;
  onStepChange?: (step: number, stepName: string, payload: Record<string, any>) => void;
}

// --------------------------------------------------------------------------
// 1. TALENTXCEL: In-Hand CTC & Tax Regime Comparator (salary.talentxcel.in)
// --------------------------------------------------------------------------
interface SalaryState {
  ctcLakhs: number;
  variablePercent: number;
  city: string;
  experienceYears: number;
  activeSkillPremiums: string[];
  selectedRegime: 'new' | 'old';
}

const CITY_COL_INDEX: Record<string, { multiplier: number; rentIndex: number; name: string }> = {
  bengaluru: { multiplier: 1.18, rentIndex: 120, name: 'Bengaluru (Tech Capital)' },
  noida: { multiplier: 0.94, rentIndex: 85, name: 'Noida (NCR Hub)' },
  gurugram: { multiplier: 1.12, rentIndex: 110, name: 'Gurugram (Cyber City)' },
  mumbai: { multiplier: 1.25, rentIndex: 145, name: 'Mumbai (Financial Capital)' },
  hyderabad: { multiplier: 1.02, rentIndex: 90, name: 'Hyderabad (HITEC City)' },
  pune: { multiplier: 0.98, rentIndex: 88, name: 'Pune (Oxford of the East)' },
  remote: { multiplier: 0.85, rentIndex: 60, name: 'Tier 2 / Remote India' },
};

const SKILL_PREMIUMS: Array<{ id: string; name: string; boostPercent: number }> = [
  { id: 'k8s', name: 'Kubernetes & Platform Ops', boostPercent: 22 },
  { id: 'genai', name: 'Generative AI & LLMOps', boostPercent: 26 },
  { id: 'golang', name: 'Golang & Distributed Systems', boostPercent: 18 },
  { id: 'system_design', name: 'High-Scale LLD/HLD Architecture', boostPercent: 20 },
  { id: 'rust', name: 'Rust & Systems Performance', boostPercent: 24 },
];

export function SalaryMultiplierFlow({
  initialRole = 'Senior Software Engineer',
  initialCity = 'bengaluru',
  initialExperience = '5-8',
  onStepChange,
}: {
  initialRole?: string;
  initialCity?: string;
  initialExperience?: string;
  onStepChange?: (step: number, name: string, payload: any) => void;
}) {
  const [step, setStep] = useState<number>(1);
  const [state, setState] = useState<SalaryState>({
    ctcLakhs: 24,
    variablePercent: 15,
    city: initialCity.toLowerCase() in CITY_COL_INDEX ? initialCity.toLowerCase() : 'bengaluru',
    experienceYears: 6,
    activeSkillPremiums: ['k8s'],
    selectedRegime: 'new',
  });

  const calculations = useMemo(() => {
    const totalCtc = state.ctcLakhs * 100000;
    const variableAmount = totalCtc * (state.variablePercent / 100);
    const fixedCtc = totalCtc - variableAmount;
    const epfEmployee = Math.min(fixedCtc * 0.12, 180000); // PF cap / standard
    const standardDeduction = 75000; // 2024-2026 Budget New Regime standard deduction

    // Simplified New vs Old Tax Regime Calculations for India (FY 2025-26 slabs)
    let taxableNew = Math.max(0, totalCtc - standardDeduction);
    let taxNew = 0;
    if (taxableNew > 1500000) {
      taxNew = (taxableNew - 1500000) * 0.3 + 150000;
    } else if (taxableNew > 1200000) {
      taxNew = (taxableNew - 1200000) * 0.2 + 90000;
    } else if (taxableNew > 800000) {
      taxNew = (taxableNew - 800000) * 0.1 + 30000;
    } else if (taxableNew > 400000) {
      taxNew = (taxableNew - 400000) * 0.05;
    }
    const cessNew = taxNew * 0.04;
    const netAnnualNew = totalCtc - (taxNew + cessNew) - epfEmployee;
    const monthlyInHandNew = Math.round(netAnnualNew / 12);

    // Old regime with 80C + HRA
    let taxableOld = Math.max(0, totalCtc - 50000 - 150000 - 200000);
    let taxOld = taxableOld > 1000000 ? (taxableOld - 1000000) * 0.3 + 112500 : taxableOld * 0.2;
    const monthlyInHandOld = Math.round((totalCtc - taxOld * 1.04 - epfEmployee) / 12);

    // Skill Premiums
    const totalBoost = state.activeSkillPremiums.reduce((acc, id) => {
      const p = SKILL_PREMIUMS.find((item) => item.id === id);
      return acc + (p?.boostPercent || 0);
    }, 0);

    const projectedBoostedCtcLakhs = (state.ctcLakhs * (1 + totalBoost / 100)).toFixed(1);

    return {
      monthlyInHandNew,
      monthlyInHandOld,
      annualTaxNew: Math.round(taxNew + cessNew),
      epfEmployee: Math.round(epfEmployee),
      fixedCtc: Math.round(fixedCtc),
      variableAmount: Math.round(variableAmount),
      totalBoost,
      projectedBoostedCtcLakhs,
      colData: CITY_COL_INDEX[state.city] || CITY_COL_INDEX['bengaluru'],
    };
  }, [state]);

  const handleNextStep = (next: number, stepName: string) => {
    setStep(next);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.set('step', String(next));
      window.history.pushState({ step: next }, '', url.toString());
      // Automatic next-step route pre-fetching
      const prefetchLink = document.createElement('link');
      prefetchLink.rel = 'prefetch';
      prefetchLink.href = `/job/${encodeURIComponent(initialRole.toLowerCase().replace(/\s+/g, '-'))}-in-${state.city}-with-${state.activeSkillPremiums[0] || 'kubernetes'}`;
      document.head.appendChild(prefetchLink);
    }
    onStepChange?.(next, stepName, { state, calculations });
  };

  return (
    <div className="multiplier-container" style={containerStyle}>
      {/* Progress Multiplier Bar */}
      <div style={stepProgressHeaderStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
          <span style={{ fontWeight: 700, fontSize: '13px', color: '#2563eb', textTransform: 'uppercase' }}>
            Interactive Salary & Tax Intelligence Engine
          </span>
          <span style={{ fontSize: '12px', color: '#64748b' }}>Step {step} of 4 &bull; 6x Session Multiplier</span>
        </div>
        <div style={progressBarTrackStyle}>
          <div style={{ ...progressBarFillStyle, width: `${(step / 4) * 100}%` }} />
        </div>
      </div>

      {/* STEP 1: CTC Breakdown & Tax Regimes */}
      {step === 1 && (
        <div className="flow-step">
          <h3 style={stepTitleStyle}>Step 1: In-Hand Take-Home & New vs Old Tax Regime</h3>
          <p style={stepSubStyle}>Compare your exact monthly in-hand take-home pay under Union Budget slabs for {initialRole}.</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', margin: '16px 0' }}>
            <div>
              <label style={labelStyle}>Total Annual CTC: ₹{state.ctcLakhs} LPA</label>
              <input
                type="range"
                min="6"
                max="90"
                step="1"
                value={state.ctcLakhs}
                onChange={(e) => setState({ ...state, ctcLakhs: Number(e.target.value) })}
                style={{ width: '100%', accentColor: '#2563eb' }}
              />
            </div>
            <div>
              <label style={labelStyle}>Variable / Performance Pay: {state.variablePercent}%</label>
              <input
                type="range"
                min="0"
                max="40"
                step="5"
                value={state.variablePercent}
                onChange={(e) => setState({ ...state, variablePercent: Number(e.target.value) })}
                style={{ width: '100%', accentColor: '#2563eb' }}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', margin: '20px 0' }}>
            <div style={metricCardStyle}>
              <div style={metricLabelStyle}>Monthly In-Hand (New Regime)</div>
              <div style={metricValueStyle}>₹{calculations.monthlyInHandNew.toLocaleString('en-IN')}</div>
              <div style={{ fontSize: '11px', color: '#10b981', marginTop: '4px' }}>Recommended for most tech workers</div>
            </div>
            <div style={metricCardStyle}>
              <div style={metricLabelStyle}>Monthly In-Hand (Old Regime)</div>
              <div style={metricValueStyle}>₹{calculations.monthlyInHandOld.toLocaleString('en-IN')}</div>
              <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>With standard 80C &amp; HRA deductions</div>
            </div>
            <div style={metricCardStyle}>
              <div style={metricLabelStyle}>Annual Income Tax Slabs</div>
              <div style={metricValueStyle}>₹{calculations.annualTaxNew.toLocaleString('en-IN')}</div>
              <div style={{ fontSize: '11px', color: '#ef4444', marginTop: '4px' }}>4% Health &amp; Education Cess Included</div>
            </div>
          </div>

          <button
            onClick={() => handleNextStep(2, 'city_cost_of_living')}
            style={primaryBtnStyle}
          >
            Step 2: Compare Purchasing Power in {calculations.colData.name.split(' ')[0]} &rarr;
          </button>
        </div>
      )}

      {/* STEP 2: City Cost-of-Living Index */}
      {step === 2 && (
        <div className="flow-step">
          <h3 style={stepTitleStyle}>Step 2: City Purchasing Power & Rent Impact</h3>
          <p style={stepSubStyle}>A ₹{state.ctcLakhs} LPA package in Bengaluru yields different discretionary savings than in Noida or Hyderabad.</p>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '8px', margin: '16px 0' }}>
            {Object.entries(CITY_COL_INDEX).map(([key, info]) => (
              <button
                key={key}
                onClick={() => setState({ ...state, city: key })}
                style={{
                  ...cityPillBtnStyle,
                  borderColor: state.city === key ? '#2563eb' : '#e2e8f0',
                  backgroundColor: state.city === key ? '#eff6ff' : '#ffffff',
                  fontWeight: state.city === key ? 700 : 500,
                }}
              >
                {info.name.split(' ')[0]}
                <span style={{ fontSize: '10px', display: 'block', color: '#64748b' }}>Index: {info.rentIndex}</span>
              </button>
            ))}
          </div>

          <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '8px', border: '1px solid #e2e8f0', margin: '16px 0' }}>
            <div style={{ fontWeight: 600, color: '#1e293b' }}>Living Cost Analysis for {calculations.colData.name}:</div>
            <div style={{ fontSize: '13px', color: '#475569', marginTop: '6px' }}>
              Average 2BHK rental cost index is <strong>{calculations.colData.rentIndex}</strong>. To maintain the exact same purchasing power as ₹{state.ctcLakhs} LPA in Bengaluru, you require approximately <strong>₹{(state.ctcLakhs * (calculations.colData.multiplier / 1.18)).toFixed(1)} LPA</strong> in {calculations.colData.name.split(' ')[0]}.
            </div>
          </div>

          <div style={{ display: 'flex', gap: '12px' }}>
            <button onClick={() => setStep(1)} style={secondaryBtnStyle}>&larr; Back</button>
            <button onClick={() => handleNextStep(3, 'skill_premium_adder')} style={primaryBtnStyle}>
              Step 3: Unlock High-Value Skill Premiums &rarr;
            </button>
          </div>
        </div>
      )}

      {/* STEP 3: Skill Premium Adder */}
      {step === 3 && (
        <div className="flow-step">
          <h3 style={stepTitleStyle}>Step 3: Skill Premium Adder (+22% to +50% Market Demand)</h3>
          <p style={stepSubStyle}>Toggle enterprise skills to instantly see market premium increments offered by recruiters in India.</p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', margin: '16px 0' }}>
            {SKILL_PREMIUMS.map((skill) => {
              const active = state.activeSkillPremiums.includes(skill.id);
              return (
                <div
                  key={skill.id}
                  onClick={() => {
                    const nextPremiums = active
                      ? state.activeSkillPremiums.filter((id) => id !== skill.id)
                      : [...state.activeSkillPremiums, skill.id];
                    setState({ ...state, activeSkillPremiums: nextPremiums });
                  }}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '12px 16px',
                    borderRadius: '8px',
                    border: `2px solid ${active ? '#10b981' : '#e2e8f0'}`,
                    backgroundColor: active ? '#f0fdf4' : '#ffffff',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ fontWeight: 600, color: '#0f172a' }}>{skill.name}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ backgroundColor: active ? '#dcfce7' : '#f1f5f9', color: active ? '#15803d' : '#475569', padding: '3px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 700 }}>
                      +{skill.boostPercent}% Premium
                    </span>
                    <input type="checkbox" checked={active} readOnly style={{ accentColor: '#10b981' }} />
                  </div>
                </div>
              );
            })}
          </div>

          <div style={{ background: '#f0f9ff', padding: '16px', borderRadius: '8px', border: '1px solid #bae6fd', margin: '16px 0' }}>
            <div style={{ fontSize: '13px', color: '#0369a1', fontWeight: 600 }}>Calculated Talent Premium:</div>
            <div style={{ fontSize: '18px', fontWeight: 800, color: '#0c4a6e', marginTop: '4px' }}>
              Base ₹{state.ctcLakhs} LPA &rarr; Target Potential: ₹{calculations.projectedBoostedCtcLakhs} LPA (+{calculations.totalBoost}%)
            </div>
          </div>

          <div style={{ display: 'flex', gap: '12px' }}>
            <button onClick={() => setStep(2)} style={secondaryBtnStyle}>&larr; Back</button>
            <button onClick={() => handleNextStep(4, 'matched_roles_and_courses')} style={primaryBtnStyle}>
              Step 4: View Verified Openings &amp; Learning Modules &rarr;
            </button>
          </div>
        </div>
      )}

      {/* STEP 4: Matching Roles & Verified Learning Modules */}
      {step === 4 && (
        <div className="flow-step">
          <h3 style={stepTitleStyle}>Step 4: Real-Time Verified Matches Across TalentXcel Ecosystem</h3>
          <p style={stepSubStyle}>Matched {initialRole} openings in {calculations.colData.name.split(' ')[0]} paying up to ₹{calculations.projectedBoostedCtcLakhs} LPA.</p>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', margin: '20px 0' }}>
            <div style={{ ...metricCardStyle, textAlign: 'left' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                <span style={{ fontSize: '18px' }}>💼</span>
                <span style={{ fontWeight: 700, color: '#0f172a' }}>Direct Job Openings</span>
              </div>
              <p style={{ fontSize: '12px', color: '#64748b', marginBottom: '12px' }}>
                142 verified listings on <code>jobs.talentxcel.in</code> matching your skill premium profile.
              </p>
              <a
                href={`https://jobs.talentxcel.in/job/${encodeURIComponent(initialRole.toLowerCase().replace(/\s+/g, '-'))}-in-${state.city}-with-${state.activeSkillPremiums[0] || 'kubernetes'}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{ ...primaryBtnStyle, display: 'inline-block', textDecoration: 'none', padding: '8px 16px', fontSize: '13px' }}
              >
                Browse Matching Jobs &rarr;
              </a>
            </div>

            <div style={{ ...metricCardStyle, textAlign: 'left' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                <span style={{ fontSize: '18px' }}>🎓</span>
                <span style={{ fontWeight: 700, color: '#0f172a' }}>Accredited Skill Tracks</span>
              </div>
              <p style={{ fontSize: '12px', color: '#64748b', marginBottom: '12px' }}>
                Hands-on tutorials on <code>learning.talentxcel.in</code> to close your +{calculations.totalBoost}% premium gap.
              </p>
              <a
                href={`https://learning.talentxcel.in/learn/${state.activeSkillPremiums[0] || 'kubernetes'}-tutorial-for-advanced`}
                target="_blank"
                rel="noopener noreferrer"
                style={{ ...primaryBtnStyle, display: 'inline-block', backgroundColor: '#0f172a', textDecoration: 'none', padding: '8px 16px', fontSize: '13px' }}
              >
                Start Free Skill Lab &rarr;
              </a>
            </div>
          </div>

          <button onClick={() => setStep(1)} style={secondaryBtnStyle}>Recalculate with New Parameters &rarr;</button>
        </div>
      )}
    </div>
  );
}

// --------------------------------------------------------------------------
// 2. TALENTXCEL: ATS Score & Keyword Gap Scanner (resume.talentxcel.in)
// --------------------------------------------------------------------------
export function ResumeAtsMultiplierFlow({
  initialRole = 'Senior Backend Engineer',
  onStepChange,
}: {
  initialRole?: string;
  onStepChange?: (step: number, name: string, payload: any) => void;
}) {
  const [view, setView] = useState<number>(1);
  const [copied, setCopied] = useState<boolean>(false);

  const atsScore = 88;
  const hardSkills = [
    { name: 'Distributed Systems', present: true, weight: 95 },
    { name: 'PostgreSQL Indexing', present: true, weight: 90 },
    { name: 'Redis Cache-Aside', present: true, weight: 85 },
    { name: 'Kafka Event Streams', present: false, weight: 92 },
    { name: 'Docker / Kubernetes', present: true, weight: 88 },
    { name: 'OpenTelemetry Tracing', present: false, weight: 80 },
  ];

  const handleNext = (nextView: number, name: string) => {
    setView(nextView);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.set('diag_view', String(nextView));
      window.history.pushState({ diag_view: nextView }, '', url.toString());
    }
    onStepChange?.(nextView, name, { atsScore, hardSkills });
  };

  return (
    <div style={containerStyle}>
      <div style={stepProgressHeaderStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
          <span style={{ fontWeight: 700, fontSize: '13px', color: '#059669', textTransform: 'uppercase' }}>
            Live ATS Compliance &amp; Keyword Match Matrix
          </span>
          <span style={{ fontSize: '12px', color: '#64748b' }}>Diagnostic {view} of 4 &bull; 6x Session Multiplier</span>
        </div>
        <div style={progressBarTrackStyle}>
          <div style={{ ...progressBarFillStyle, backgroundColor: '#059669', width: `${(view / 4) * 100}%` }} />
        </div>
      </div>

      {view === 1 && (
        <div>
          <h3 style={stepTitleStyle}>Diagnostic 1: Real-Time Role Benchmark for {initialRole}</h3>
          <p style={stepSubStyle}>Compared against 1,200+ live job listings parsed from <code>jobs.talentxcel.in</code>.</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px', margin: '20px 0' }}>
            <div style={{ width: '100px', height: '100px', borderRadius: '50%', backgroundColor: '#ecfdf5', border: '4px solid #10b981', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: '28px', fontWeight: 800, color: '#065f46' }}>{atsScore}%</span>
              <span style={{ fontSize: '10px', color: '#047857', fontWeight: 600 }}>Grade A-</span>
            </div>
            <div>
              <div style={{ fontWeight: 700, color: '#0f172a', fontSize: '15px' }}>High Recruiter Parsing Compatibility</div>
              <div style={{ fontSize: '13px', color: '#475569', marginTop: '4px' }}>
                Your structure clears standard Workday, Greenhouse, and Taleo parsers with 0 unparsed sections. 2 high-value keyword gaps detected.
              </div>
            </div>
          </div>
          <button onClick={() => handleNext(2, 'keyword_gap_radar')} style={{ ...primaryBtnStyle, backgroundColor: '#059669' }}>
            View Keyword Gap Radar &rarr;
          </button>
        </div>
      )}

      {view === 2 && (
        <div>
          <h3 style={stepTitleStyle}>Diagnostic 2: Hard Skill vs Soft Skill Keyword Density</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '10px', margin: '16px 0' }}>
            {hardSkills.map((s) => (
              <div key={s.name} style={{ padding: '10px 14px', borderRadius: '6px', border: `1px solid ${s.present ? '#bbf7d0' : '#fecaca'}`, backgroundColor: s.present ? '#f0fdf4' : '#fef2f2' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: 600, color: s.present ? '#166534' : '#991b1b' }}>
                  <span>{s.name}</span>
                  <span>{s.present ? '✓ Detected' : '✗ Missing'}</span>
                </div>
                <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>Recruiter Demand Weight: {s.weight}/100</div>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button onClick={() => setView(1)} style={secondaryBtnStyle}>&larr; Back</button>
            <button onClick={() => handleNext(3, 'formatting_compliance')} style={{ ...primaryBtnStyle, backgroundColor: '#059669' }}>
              Check Formatting &amp; Table Traps &rarr;
            </button>
          </div>
        </div>
      )}

      {view === 3 && (
        <div>
          <h3 style={stepTitleStyle}>Diagnostic 3: ATS Parsing Traps &amp; Layout Inspection</h3>
          <div style={{ margin: '16px 0', fontSize: '13px', color: '#334155' }}>
            <div style={{ padding: '10px', background: '#f8fafc', borderRadius: '6px', marginBottom: '8px' }}>
              ✓ <strong>Zero Multi-Column Layout:</strong> Single-column flow ensures top-to-bottom parse accuracy.
            </div>
            <div style={{ padding: '10px', background: '#f8fafc', borderRadius: '6px', marginBottom: '8px' }}>
              ✓ <strong>Standard Section Headings:</strong> 'Work Experience', 'Education', 'Skills' accurately flagged.
            </div>
            <div style={{ padding: '10px', background: '#fffbeb', border: '1px solid #fef3c7', borderRadius: '6px' }}>
              ⚠ <strong>Action Metric Density:</strong> Add 3 more quantified bullet points with measurable impact (e.g., 'reduced latency by 34%').
            </div>
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button onClick={() => setView(2)} style={secondaryBtnStyle}>&larr; Back</button>
            <button onClick={() => handleNext(4, 'unlock_tailored_template')} style={{ ...primaryBtnStyle, backgroundColor: '#059669' }}>
              Unlock Optimized ATS Template &rarr;
            </button>
          </div>
        </div>
      )}

      {view === 4 && (
        <div>
          <h3 style={stepTitleStyle}>Diagnostic 4: Download 100% Verified ATS-Ready LaTeX / DOCX</h3>
          <p style={stepSubStyle}>Pre-populated with high-density keywords for {initialRole}.</p>
          <div style={{ background: '#f0fdf4', padding: '16px', borderRadius: '8px', border: '1px solid #bbf7d0', margin: '16px 0', textAlign: 'center' }}>
            <div style={{ fontSize: '15px', fontWeight: 700, color: '#166534' }}>Verified Clean ATS Template Ready</div>
            <p style={{ fontSize: '12px', color: '#15803d', marginTop: '4px' }}>
              Share this free diagnostic with your developer circle to download immediately.
            </p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', marginTop: '12px' }}>
              <a
                href={`https://api.whatsapp.com/send?text=${encodeURIComponent(`Check your instant ATS resume score and keyword gaps for ${initialRole}: https://resume.talentxcel.in`)}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{ ...primaryBtnStyle, backgroundColor: '#25d366', textDecoration: 'none', padding: '8px 16px', fontSize: '13px' }}
              >
                Share on WhatsApp &amp; Unlock
              </a>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(`https://resume.talentxcel.in`);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }}
                style={secondaryBtnStyle}
              >
                {copied ? '✓ Link Copied' : 'Copy Direct Link'}
              </button>
            </div>
          </div>
          <button onClick={() => setView(1)} style={secondaryBtnStyle}>Re-run Scanner &rarr;</button>
        </div>
      )}
    </div>
  );
}

// --------------------------------------------------------------------------
// 3. CHATR: Live Agent Intent Sandbox & ROI Calculator (chatr.chat & chatrchat.in)
// --------------------------------------------------------------------------
export function ChatrAgentMultiplierFlow({
  initialIntent = 'support_triage',
  onStepChange,
}: {
  initialIntent?: string;
  onStepChange?: (step: number, name: string, payload: any) => void;
}) {
  const [step, setStep] = useState<number>(1);
  const [selectedIntent, setSelectedIntent] = useState<string>(initialIntent);
  const [monthlyInquiries, setMonthlyInquiries] = useState<number>(15000);
  const [avgHandleTimeMin, setAvgHandleTimeMin] = useState<number>(8);
  const [humanCostPerHour, setHumanCostPerHour] = useState<number>(350); // INR per hour

  const roi = useMemo(() => {
    const totalHours = (monthlyInquiries * avgHandleTimeMin) / 60;
    const currentCost = totalHours * humanCostPerHour;
    const automatedPercent = 0.78; // 78% autonomous containment
    const hoursSaved = Math.round(totalHours * automatedPercent);
    const monthlySavingsInr = Math.round(currentCost * automatedPercent);
    const chatrEstimatedCost = Math.round(monthlyInquiries * 1.5); // ₹1.5 per interaction
    const netMonthlyRoiInr = monthlySavingsInr - chatrEstimatedCost;

    return {
      hoursSaved,
      monthlySavingsInr,
      netMonthlyRoiInr,
      containmentPercent: 78,
    };
  }, [monthlyInquiries, avgHandleTimeMin, humanCostPerHour]);

  const handleNext = (nextStep: number, name: string) => {
    setStep(nextStep);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.set('agent_step', String(nextStep));
      window.history.pushState({ agent_step: nextStep }, '', url.toString());
    }
    onStepChange?.(nextStep, name, { selectedIntent, roi });
  };

  return (
    <div style={containerStyle}>
      <div style={stepProgressHeaderStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
          <span style={{ fontWeight: 700, fontSize: '13px', color: '#4f46e5', textTransform: 'uppercase' }}>
            CHATR Autonomous Agent Sandbox &amp; Workforce ROI Calculator
          </span>
          <span style={{ fontSize: '12px', color: '#64748b' }}>Step {step} of 4 &bull; 6x Session Multiplier</span>
        </div>
        <div style={progressBarTrackStyle}>
          <div style={{ ...progressBarFillStyle, backgroundColor: '#4f46e5', width: `${(step / 4) * 100}%` }} />
        </div>
      </div>

      {step === 1 && (
        <div>
          <h3 style={stepTitleStyle}>Step 1: Test Autonomous Multi-Turn Agent Intents</h3>
          <p style={stepSubStyle}>Experience how CHATR agents orchestrate workflows without human intervention.</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', margin: '16px 0' }}>
            {[
              { id: 'support_triage', title: 'Customer Support & Returns', turns: '3-turn resolution', badge: 'E-Commerce' },
              { id: 'lead_qual', title: 'Enterprise Lead Scoring', turns: 'B2B qualification', badge: 'SaaS' },
              { id: 'booking_concierge', title: 'Appointment & Booking Concierge', turns: 'Calendar sync', badge: 'Hospitality' },
            ].map((t) => (
              <div
                key={t.id}
                onClick={() => setSelectedIntent(t.id)}
                style={{
                  padding: '12px',
                  borderRadius: '8px',
                  border: `2px solid ${selectedIntent === t.id ? '#4f46e5' : '#e2e8f0'}`,
                  backgroundColor: selectedIntent === t.id ? '#eef2ff' : '#ffffff',
                  cursor: 'pointer',
                }}
              >
                <span style={{ fontSize: '10px', backgroundColor: '#e0e7ff', color: '#3730a3', padding: '2px 6px', borderRadius: '4px', fontWeight: 700 }}>
                  {t.badge}
                </span>
                <div style={{ fontWeight: 600, color: '#0f172a', fontSize: '14px', marginTop: '6px' }}>{t.title}</div>
                <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>{t.turns}</div>
              </div>
            ))}
          </div>
          <button onClick={() => handleNext(2, 'conversation_sandbox')} style={{ ...primaryBtnStyle, backgroundColor: '#4f46e5' }}>
            Launch Interactive Conversation Sandbox &rarr;
          </button>
        </div>
      )}

      {step === 2 && (
        <div>
          <h3 style={stepTitleStyle}>Step 2: Live Multi-Turn Interactive Sandbox</h3>
          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '16px', margin: '16px 0' }}>
            <div style={{ display: 'flex', gap: '10px', marginBottom: '12px' }}>
              <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#4f46e5', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 700 }}>AI</div>
              <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', padding: '8px 12px', borderRadius: '8px', fontSize: '13px', color: '#1e293b' }}>
                Hello! I am your autonomous AI triage assistant. How can I assist your order today?
              </div>
            </div>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginBottom: '12px' }}>
              <div style={{ background: '#4f46e5', color: '#fff', padding: '8px 12px', borderRadius: '8px', fontSize: '13px' }}>
                I need to modify the delivery address for order #CX-9028.
              </div>
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#4f46e5', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 700 }}>AI</div>
              <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', padding: '8px 12px', borderRadius: '8px', fontSize: '13px', color: '#1e293b' }}>
                Verified order #CX-9028. Dispatch status: <em>Preparing for dispatch</em>. Address updated via webhook to fulfillment center. Confirmation sent via WhatsApp!
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button onClick={() => setStep(1)} style={secondaryBtnStyle}>&larr; Back</button>
            <button onClick={() => handleNext(3, 'roi_fte_calculator')} style={{ ...primaryBtnStyle, backgroundColor: '#4f46e5' }}>
              Step 3: Calculate Monthly Cost Savings &rarr;
            </button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div>
          <h3 style={stepTitleStyle}>Step 3: Enterprise ROI &amp; Labor Savings Simulator</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', margin: '16px 0' }}>
            <div>
              <label style={labelStyle}>Monthly Inquiries: {monthlyInquiries.toLocaleString()}</label>
              <input
                type="range"
                min="2000"
                max="100000"
                step="2000"
                value={monthlyInquiries}
                onChange={(e) => setMonthlyInquiries(Number(e.target.value))}
                style={{ width: '100%', accentColor: '#4f46e5' }}
              />
            </div>
            <div>
              <label style={labelStyle}>Average Agent Handle Time: {avgHandleTimeMin} mins</label>
              <input
                type="range"
                min="2"
                max="25"
                step="1"
                value={avgHandleTimeMin}
                onChange={(e) => setAvgHandleTimeMin(Number(e.target.value))}
                style={{ width: '100%', accentColor: '#4f46e5' }}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', margin: '16px 0' }}>
            <div style={metricCardStyle}>
              <div style={metricLabelStyle}>Hours Saved / Month</div>
              <div style={metricValueStyle}>{roi.hoursSaved.toLocaleString()} hrs</div>
            </div>
            <div style={metricCardStyle}>
              <div style={metricLabelStyle}>Net Monthly Savings</div>
              <div style={{ ...metricValueStyle, color: '#10b981' }}>₹{roi.netMonthlyRoiInr.toLocaleString('en-IN')}</div>
            </div>
            <div style={metricCardStyle}>
              <div style={metricLabelStyle}>Autonomous Containment</div>
              <div style={metricValueStyle}>{roi.containmentPercent}%</div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button onClick={() => setStep(2)} style={secondaryBtnStyle}>&larr; Back</button>
            <button onClick={() => handleNext(4, 'deploy_agent_template')} style={{ ...primaryBtnStyle, backgroundColor: '#4f46e5' }}>
              Step 4: Deploy Agent in 60 Seconds &rarr;
            </button>
          </div>
        </div>
      )}

      {step === 4 && (
        <div>
          <h3 style={stepTitleStyle}>Step 4: Instant Agent Deployment Blueprint</h3>
          <p style={stepSubStyle}>Connect CHATR to your Supabase, WhatsApp Business, or Zendesk in 1 click.</p>
          <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '8px', border: '1px solid #e2e8f0', margin: '16px 0' }}>
            <div style={{ fontWeight: 700, color: '#0f172a' }}>Pre-Configured Agent Webhook Endpoint:</div>
            <code style={{ display: 'block', padding: '8px', background: '#1e293b', color: '#f8fafc', borderRadius: '4px', fontSize: '12px', marginTop: '8px' }}>
              POST https://chatr.chat/api/v1/agent/{selectedIntent}/dispatch
            </code>
          </div>
          <a
            href="https://chatr.chat"
            target="_blank"
            rel="noopener noreferrer"
            style={{ ...primaryBtnStyle, backgroundColor: '#4f46e5', display: 'inline-block', textDecoration: 'none' }}
          >
            Launch Production Agent Now &rarr;
          </a>
        </div>
      )}
    </div>
  );
}

// --------------------------------------------------------------------------
// 4. NUTY TALES: Custom Hamper & Wholesale Configurator (nutytales.com)
// --------------------------------------------------------------------------
export function NutyTalesHamperMultiplierFlow({
  onStepChange,
}: {
  onStepChange?: (step: number, name: string, payload: any) => void;
}) {
  const [step, setStep] = useState<number>(1);
  const [boxType, setBoxType] = useState<string>('walnut_wood');
  const [saffronGrams, setSaffronGrams] = useState<number>(5);
  const [quantity, setQuantity] = useState<number>(50);

  const quote = useMemo(() => {
    const boxBase = boxType === 'walnut_wood' ? 1450 : boxType === 'papier_mache' ? 1850 : 850;
    const saffronCost = saffronGrams * 350; // ₹350/gram pure Kashmiri Mongra
    const dryFruitsCost = 1200; // Mamra Almonds + Kernels
    const unitRetail = boxBase + saffronCost + dryFruitsCost;
    const discountTier = quantity >= 500 ? 0.32 : quantity >= 100 ? 0.24 : quantity >= 25 ? 0.15 : 0;
    const unitPrice = Math.round(unitRetail * (1 - discountTier));
    const totalOrder = unitPrice * quantity;

    return {
      unitRetail,
      unitPrice,
      totalOrder,
      discountPercent: discountTier * 100,
    };
  }, [boxType, saffronGrams, quantity]);

  const handleNext = (nextStep: number, name: string) => {
    setStep(nextStep);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.set('hamper_step', String(nextStep));
      window.history.pushState({ hamper_step: nextStep }, '', url.toString());
    }
    onStepChange?.(nextStep, name, { boxType, saffronGrams, quantity, quote });
  };

  return (
    <div style={containerStyle}>
      <div style={stepProgressHeaderStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
          <span style={{ fontWeight: 700, fontSize: '13px', color: '#b45309', textTransform: 'uppercase' }}>
            Nuty Tales Artisan Hamper &amp; Wholesale Configurator
          </span>
          <span style={{ fontSize: '12px', color: '#64748b' }}>Step {step} of 5 &bull; 6x Session Multiplier</span>
        </div>
        <div style={progressBarTrackStyle}>
          <div style={{ ...progressBarFillStyle, backgroundColor: '#b45309', width: `${(step / 5) * 100}%` }} />
        </div>
      </div>

      {step === 1 && (
        <div>
          <h3 style={stepTitleStyle}>Step 1: Select Authentic Kashmiri Box Craft</h3>
          <p style={stepSubStyle}>Every box is handmade by GI-tagged Kashmiri artisans in Old Srinagar.</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', margin: '16px 0' }}>
            {[
              { id: 'walnut_wood', name: 'Carved Walnut Wood', desc: 'Seasoned wild walnut with chinar motifs' },
              { id: 'papier_mache', name: 'Royal Papier-Mâché', desc: 'Hand-painted with 24k gold leaf lining' },
              { id: 'kraft_eco', name: 'Eco Artisan Kraft', desc: 'Recycled fiber with saffron silk ribbon' },
            ].map((box) => (
              <div
                key={box.id}
                onClick={() => setBoxType(box.id)}
                style={{
                  padding: '12px',
                  borderRadius: '8px',
                  border: `2px solid ${boxType === box.id ? '#b45309' : '#e2e8f0'}`,
                  backgroundColor: boxType === box.id ? '#fffbeb' : '#ffffff',
                  cursor: 'pointer',
                }}
              >
                <div style={{ fontWeight: 700, color: '#92400e', fontSize: '14px' }}>{box.name}</div>
                <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>{box.desc}</div>
              </div>
            ))}
          </div>
          <button onClick={() => handleNext(2, 'saffron_selection')} style={{ ...primaryBtnStyle, backgroundColor: '#b45309' }}>
            Step 2: Choose Saffron &amp; Dry Fruit Grade &rarr;
          </button>
        </div>
      )}

      {step === 2 && (
        <div>
          <h3 style={stepTitleStyle}>Step 2: Certified GI-Tagged Saffron &amp; Mamra Almonds</h3>
          <div style={{ margin: '16px 0' }}>
            <label style={labelStyle}>Pure Pampore Mongra Saffron: {saffronGrams} Grams</label>
            <input
              type="range"
              min="1"
              max="20"
              step="1"
              value={saffronGrams}
              onChange={(e) => setSaffronGrams(Number(e.target.value))}
              style={{ width: '100%', accentColor: '#b45309' }}
            />
            <div style={{ fontSize: '12px', color: '#64748b', marginTop: '6px' }}>
              Includes 500g Wild Kagzi Walnut Kernels + 500g Mamra Giri Almonds + 100g Kashmiri Kahwa.
            </div>
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button onClick={() => setStep(1)} style={secondaryBtnStyle}>&larr; Back</button>
            <button onClick={() => handleNext(3, 'custom_branding')} style={{ ...primaryBtnStyle, backgroundColor: '#b45309' }}>
              Step 3: Personalization &amp; Calligraphy &rarr;
            </button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div>
          <h3 style={stepTitleStyle}>Step 3: Custom Calligraphy &amp; Corporate / Wedding Embossing</h3>
          <p style={stepSubStyle}>Include your wedding initials, corporate logo, or bespoke greeting card.</p>
          <div style={{ background: '#fffbeb', padding: '16px', borderRadius: '8px', border: '1px solid #fde68a', margin: '16px 0' }}>
            <div style={{ fontWeight: 600, color: '#92400e' }}>Complimentary Customization Included:</div>
            <ul style={{ fontSize: '12px', color: '#78350f', marginTop: '6px', paddingLeft: '18px' }}>
              <li>Hand-pressed wax seal with family crest or company emblem</li>
              <li>Handmade paper scroll with personalized Persian / English calligraphy</li>
              <li>Tamper-evident GI authentication QR hologram</li>
            </ul>
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button onClick={() => setStep(2)} style={secondaryBtnStyle}>&larr; Back</button>
            <button onClick={() => handleNext(4, 'quantity_wholesale_slab')} style={{ ...primaryBtnStyle, backgroundColor: '#b45309' }}>
              Step 4: Wholesale Margin &amp; Volume Slabs &rarr;
            </button>
          </div>
        </div>
      )}

      {step === 4 && (
        <div>
          <h3 style={stepTitleStyle}>Step 4: Volume Discount &amp; Margin Optimizer</h3>
          <div style={{ margin: '16px 0' }}>
            <label style={labelStyle}>Order Quantity: {quantity} Hampers</label>
            <input
              type="range"
              min="10"
              max="1000"
              step="10"
              value={quantity}
              onChange={(e) => setQuantity(Number(e.target.value))}
              style={{ width: '100%', accentColor: '#b45309' }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', margin: '16px 0' }}>
            <div style={metricCardStyle}>
              <div style={metricLabelStyle}>Unit Cost</div>
              <div style={metricValueStyle}>₹{quote.unitPrice.toLocaleString('en-IN')}</div>
              <div style={{ fontSize: '11px', color: '#10b981' }}>{quote.discountPercent}% bulk savings</div>
            </div>
            <div style={metricCardStyle}>
              <div style={metricLabelStyle}>Total Estimate</div>
              <div style={metricValueStyle}>₹{quote.totalOrder.toLocaleString('en-IN')}</div>
            </div>
            <div style={metricCardStyle}>
              <div style={metricLabelStyle}>Worldwide Courier</div>
              <div style={{ ...metricValueStyle, fontSize: '15px', color: '#b45309' }}>Air Express Included</div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button onClick={() => setStep(3)} style={secondaryBtnStyle}>&larr; Back</button>
            <button onClick={() => handleNext(5, 'instant_quote_checkout')} style={{ ...primaryBtnStyle, backgroundColor: '#b45309' }}>
              Step 5: Get Formal Invoice &amp; Sample Box &rarr;
            </button>
          </div>
        </div>
      )}

      {step === 5 && (
        <div>
          <h3 style={stepTitleStyle}>Step 5: Official Quote Generated &amp; WhatsApp Sample Hold</h3>
          <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '8px', padding: '16px', margin: '16px 0' }}>
            <div style={{ fontSize: '14px', fontWeight: 700, color: '#92400e' }}>
              Quote Ref: #NT-HAMPER-{Math.floor(100000 + Math.random() * 900000)}
            </div>
            <p style={{ fontSize: '12px', color: '#78350f', marginTop: '4px' }}>
              {quantity}x {boxType} Hampers &bull; ₹{quote.totalOrder.toLocaleString('en-IN')} Total with GST &amp; Doorstep Delivery.
            </p>
            <div style={{ marginTop: '12px' }}>
              <a
                href={`https://api.whatsapp.com/send?text=${encodeURIComponent(`Hi Nuty Tales team, I just configured an order of ${quantity} hampers on weddings.nutytales.com. Total quote: ₹${quote.totalOrder.toLocaleString('en-IN')}. Please dispatch sample box.`)}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{ ...primaryBtnStyle, backgroundColor: '#25d366', textDecoration: 'none', display: 'inline-block', padding: '8px 16px' }}
              >
                Chat on WhatsApp for Sample Box &rarr;
              </a>
            </div>
          </div>
          <button onClick={() => setStep(1)} style={secondaryBtnStyle}>Configure Another Variant &rarr;</button>
        </div>
      )}
    </div>
  );
}

// --------------------------------------------------------------------------
// Master Component Selector
// --------------------------------------------------------------------------
export function SessionMultiplierFlow(props: MultiplierFlowProps) {
  const { hostname, brand } = props;

  if (hostname.includes('salary.talentxcel.in')) {
    return <SalaryMultiplierFlow initialRole={props.initialRole} initialCity={props.initialCity} initialExperience={props.initialExperience} onStepChange={props.onStepChange} />;
  }
  if (hostname.includes('resume.talentxcel.in')) {
    return <ResumeAtsMultiplierFlow initialRole={props.initialRole} onStepChange={props.onStepChange} />;
  }
  if (brand === 'chatr' || hostname.includes('chatr')) {
    return <ChatrAgentMultiplierFlow initialIntent={props.initialIntent} onStepChange={props.onStepChange} />;
  }
  // Default to Nuty Tales or general TalentXcel
  if (brand === 'nutytales' || hostname.includes('nutytales')) {
    return <NutyTalesHamperMultiplierFlow onStepChange={props.onStepChange} />;
  }

  // Fallback to Salary Multiplier
  return <SalaryMultiplierFlow initialRole={props.initialRole} initialCity={props.initialCity} onStepChange={props.onStepChange} />;
}

// --------------------------------------------------------------------------
// Server-Side Embeddable HTML Generator (for pSEO leaf pages in htmlRenderer)
// --------------------------------------------------------------------------
export function renderInteractiveMultiplierHtml(
  hostname: string,
  brand: MultiplierBrand,
  role = 'Specialist',
  city = 'bengaluru'
): string {
  const isSalary = hostname.includes('salary.talentxcel.in');
  const isResume = hostname.includes('resume.talentxcel.in');
  const isChatr = brand === 'chatr' || hostname.includes('chatr');
  const isNuty = brand === 'nutytales' || hostname.includes('nutytales');

  const title = isSalary
    ? '⚡ Interactive In-Hand CTC & Tax Regime Comparator'
    : isResume
    ? '🎯 Live ATS Compliance & Keyword Match Matrix'
    : isChatr
    ? '🤖 Live Autonomous Agent Workflow Sandbox & ROI'
    : '🎁 Custom Artisan Hamper & Wholesale Margin Configurator';

  const toolType = isSalary
    ? 'salary_comparator'
    : isResume
    ? 'resume_ats_scanner'
    : isChatr
    ? 'agent_intent_sandbox'
    : 'hamper_configurator';

  return `
  <section class="multiplier-interactive-widget" id="multiplier-app" style="background:#ffffff; border:2px solid #e2e8f0; border-radius:12px; padding:24px; margin:28px 0; box-shadow:0 4px 14px rgba(0,0,0,0.06);">
    <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #e2e8f0; padding-bottom:12px; margin-bottom:18px;">
      <h2 style="font-size:1.25rem; font-weight:700; color:#0f172a; margin:0;">${title}</h2>
      <span style="font-size:0.75rem; background:#dbeafe; color:#1d4ed8; font-weight:700; padding:4px 8px; border-radius:4px;">5x SESSION DEPTH ENGINE</span>
    </div>
    <div id="multiplier-step-content">
      <div style="padding:16px; background:#f8fafc; border-radius:8px; text-align:center;">
        <p style="font-size:0.95rem; color:#334155; margin-bottom:14px;">
          Launching real-time interactive calculations for <strong>${role}</strong> in <strong>${city}</strong>.
        </p>
        <button id="btn-start-multiplier" onclick="window.initMultiplierStep && window.initMultiplierStep(1)" style="background:#2563eb; color:#ffffff; font-weight:700; border:none; padding:10px 22px; border-radius:6px; cursor:pointer; font-size:0.95rem;">
          Start Interactive Flow (Step 1 &rarr;)
        </button>
      </div>
    </div>
    <script>
      (function() {
        var currentStep = 1;
        var hostname = "${hostname}";
        var toolType = "${toolType}";
        var sessionId = "sess_" + Math.random().toString(36).substring(2, 12);
        
        function trackStep(step, stepName) {
          try {
            if (window.navigator && window.navigator.sendBeacon) {
              window.navigator.sendBeacon("/api/v1/funnel/event", JSON.stringify({
                session_id: sessionId,
                hostname: hostname,
                brand_cluster: "${brand}",
                current_step: step,
                tool_type: toolType,
                step_name: stepName,
                path_url: window.location.pathname
              }));
            }
          } catch(e) {}
        }
        
        window.initMultiplierStep = function(step) {
          currentStep = step;
          var container = document.getElementById("multiplier-step-content");
          if (!container) return;
          trackStep(step, "step_" + step);
          
          if (step === 1) {
            container.innerHTML = '<div style="background:#f1f5f9; padding:16px; border-radius:8px;">' +
              '<div style="font-weight:700; margin-bottom:8px;">Step 1: Base vs Variable CTC & Union Budget Slabs</div>' +
              '<p style="font-size:0.9rem; color:#475569;">Calculated monthly take-home for ${role}: <strong>₹1,64,200/mo</strong> (New Regime) vs <strong>₹1,52,000/mo</strong> (Old Regime).</p>' +
              '<button onclick="window.initMultiplierStep(2)" style="background:#2563eb; color:#fff; border:none; padding:8px 16px; border-radius:4px; cursor:pointer; font-weight:600; margin-top:10px;">Step 2: City Cost of Living Comparison &rarr;</button>' +
            '</div>';
            history.pushState({ step: 1 }, '', '?step=1');
          } else if (step === 2) {
            container.innerHTML = '<div style="background:#f1f5f9; padding:16px; border-radius:8px;">' +
              '<div style="font-weight:700; margin-bottom:8px;">Step 2: City Cost-of-Living &amp; Discretionary Savings</div>' +
              '<p style="font-size:0.9rem; color:#475569;">Living in ${city} vs Noida vs Bengaluru: Discretionary savings index is <strong>+18% higher</strong> in Noida.</p>' +
              '<button onclick="window.initMultiplierStep(3)" style="background:#2563eb; color:#fff; border:none; padding:8px 16px; border-radius:4px; cursor:pointer; font-weight:600; margin-top:10px;">Step 3: Skill Premium Adder (+22%) &rarr;</button>' +
            '</div>';
            history.pushState({ step: 2 }, '', '?step=2');
          } else if (step === 3) {
            container.innerHTML = '<div style="background:#f0fdf4; padding:16px; border-radius:8px; border:1px solid #bbf7d0;">' +
              '<div style="font-weight:700; color:#166534; margin-bottom:8px;">Step 3: Skill Premium Activated (+22% Kubernetes / GenAI)</div>' +
              '<p style="font-size:0.9rem; color:#15803d;">Projected Compensation Band: <strong>₹28.5 LPA to ₹36.0 LPA</strong>.</p>' +
              '<a href="https://jobs.talentxcel.in" target="_blank" style="display:inline-block; background:#16a34a; color:#fff; padding:8px 16px; border-radius:4px; text-decoration:none; font-weight:600; margin-top:10px;">View 140+ Matching Openings on jobs.talentxcel.in &rarr;</a>' +
            '</div>';
            history.pushState({ step: 3 }, '', '?step=3');
          }
        };
      })();
    </script>
  </section>
  `;
}

// --------------------------------------------------------------------------
// Styles
// --------------------------------------------------------------------------
const containerStyle: React.CSSProperties = {
  backgroundColor: '#ffffff',
  border: '1px solid #e2e8f0',
  borderRadius: '12px',
  padding: '24px',
  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.05)',
  margin: '24px 0',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
};

const stepProgressHeaderStyle: React.CSSProperties = {
  marginBottom: '20px',
};

const progressBarTrackStyle: React.CSSProperties = {
  width: '100%',
  height: '6px',
  backgroundColor: '#f1f5f9',
  borderRadius: '999px',
  overflow: 'hidden',
};

const progressBarFillStyle: React.CSSProperties = {
  height: '100%',
  backgroundColor: '#2563eb',
  transition: 'width 0.3s ease',
};

const stepTitleStyle: React.CSSProperties = {
  fontSize: '18px',
  fontWeight: 700,
  color: '#0f172a',
  marginBottom: '6px',
};

const stepSubStyle: React.CSSProperties = {
  fontSize: '13px',
  color: '#64748b',
  marginBottom: '16px',
  lineHeight: 1.5,
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '13px',
  fontWeight: 600,
  color: '#334155',
  marginBottom: '6px',
};

const primaryBtnStyle: React.CSSProperties = {
  backgroundColor: '#2563eb',
  color: '#ffffff',
  border: 'none',
  borderRadius: '6px',
  padding: '10px 20px',
  fontSize: '14px',
  fontWeight: 600,
  cursor: 'pointer',
  transition: 'background-color 0.2s ease',
};

const secondaryBtnStyle: React.CSSProperties = {
  backgroundColor: '#f1f5f9',
  color: '#334155',
  border: '1px solid #cbd5e1',
  borderRadius: '6px',
  padding: '10px 16px',
  fontSize: '14px',
  fontWeight: 600,
  cursor: 'pointer',
};

const metricCardStyle: React.CSSProperties = {
  backgroundColor: '#f8fafc',
  border: '1px solid #e2e8f0',
  borderRadius: '8px',
  padding: '14px',
  textAlign: 'center',
};

const metricLabelStyle: React.CSSProperties = {
  fontSize: '11px',
  textTransform: 'uppercase',
  fontWeight: 700,
  color: '#64748b',
  letterSpacing: '0.04em',
};

const metricValueStyle: React.CSSProperties = {
  fontSize: '20px',
  fontWeight: 800,
  color: '#0f172a',
  marginTop: '4px',
};

const cityPillBtnStyle: React.CSSProperties = {
  border: '1px solid #e2e8f0',
  borderRadius: '6px',
  padding: '8px 10px',
  textAlign: 'center',
  cursor: 'pointer',
  fontSize: '12px',
  color: '#1e293b',
};
