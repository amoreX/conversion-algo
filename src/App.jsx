import { useMemo, useState } from 'react'
import {
  FEATURES,
  INTERCEPT,
  predict,
  contributions,
  classify
} from './lib/predictor.js'
import { generateDataset, datasetStats } from './lib/dataset.js'

function pct(p, digits = 1) {
  return (p * 100).toFixed(digits)
}

function fmt(n, digits = 2) {
  return Number(n).toFixed(digits)
}

function SegmentedBar({ value, segments = 24, tone = 'neutral' }) {
  const filled = Math.round(value * segments)
  return (
    <div className={`segbar tone-${tone}`} aria-hidden>
      {Array.from({ length: segments }).map((_, i) => (
        <span key={i} className={`segbar-cell ${i < filled ? 'on' : 'off'}`} />
      ))}
    </div>
  )
}

// Compact slider for the side panel — single row + track. No hint/beta footer.
function Slider({ feature, value, onChange }) {
  return (
    <div className="slider-row" title={`${feature.label} — β = ${fmt(feature.beta, 3)}. ${feature.hint}`}>
      <div className="slider-head">
        <span className="label">{feature.label}</span>
        <span className="slider-value">
          <span className="num">{value}</span>
          <span className="unit">{feature.unit}</span>
        </span>
      </div>
      <input
        className="slider-input"
        type="range"
        min={feature.min}
        max={feature.max}
        step={feature.step}
        value={value}
        onChange={(e) => onChange(feature.key, Number(e.target.value))}
        aria-label={feature.label}
      />
    </div>
  )
}

// Mini vertical bar for the horizontal contributions strip.
// Bar grows up from baseline. Negative → grows down, red.
function ContribCol({ label, contrib, max }) {
  const sign = contrib >= 0 ? 'pos' : 'neg'
  const heightPct = max === 0 ? 0 : Math.min(100, (Math.abs(contrib) / max) * 100)
  return (
    <div className="contrib-col">
      <div className="contrib-bar-wrap">
        <div className={`contrib-bar ${sign}`} style={{ height: `${heightPct}%` }} />
      </div>
      <div className={`contrib-col-value ${sign}`}>
        {contrib >= 0 ? '+' : ''}
        {fmt(contrib, 2)}
      </div>
      <div className="contrib-col-label">{label}</div>
    </div>
  )
}

function StatBlock({ label, value, unit }) {
  return (
    <div className="stat-block">
      <div className="label dim">{label}</div>
      <div className="stat-value">
        <span className="num">{value}</span>
        {unit && <span className="unit">{unit}</span>}
      </div>
    </div>
  )
}

const DEFAULT_INPUT = {
  weekly_sessions: 10,
  avg_session_min: 24,
  features_used: 6,
  days_active_30: 14,
  content_created: 9,
  collaborators_invited: 1,
  paywall_hits: 2,
  tenure_days: 28,
  support_tickets: 0
}

export default function App() {
  const [input, setInput] = useState(DEFAULT_INPUT)
  const [tableSort, setTableSort] = useState('probability')

  const probability = useMemo(() => predict(input), [input])
  const contrib = useMemo(() => contributions(input), [input])
  const tier = useMemo(() => classify(probability), [probability])
  const dataset = useMemo(() => generateDataset(200, 7), [])
  const stats = useMemo(() => datasetStats(dataset), [dataset])

  const sortedDataset = useMemo(() => {
    const copy = [...dataset]
    if (tableSort === 'probability') copy.sort((a, b) => b.probability - a.probability)
    if (tableSort === 'tenure_days') copy.sort((a, b) => b.tenure_days - a.tenure_days)
    if (tableSort === 'paywall_hits') copy.sort((a, b) => b.paywall_hits - a.paywall_hits)
    return copy.slice(0, 12)
  }, [dataset, tableSort])

  // Use the absolute intercept too so the chart scale stays stable as features change.
  const maxContrib = Math.max(
    Math.abs(INTERCEPT),
    ...contrib.map((c) => Math.abs(c.contrib))
  )

  // Build the strip in a fixed (feature-definition) order so columns don't reorder
  // as the user drags sliders — much easier to compare visually.
  const stripRows = useMemo(() => {
    const byKey = Object.fromEntries(contrib.map((c) => [c.key, c]))
    return [
      { key: '__intercept', label: 'INTERCEPT', contrib: INTERCEPT },
      ...FEATURES.map((f) => ({
        key: f.key,
        label: f.label,
        contrib: byKey[f.key]?.contrib ?? 0
      }))
    ]
  }, [contrib])

  function setKey(key, value) {
    setInput((cur) => ({ ...cur, [key]: value }))
  }

  function loadFromRow(row) {
    const { id, handle, archetype, probability, converted, ...features } = row
    setInput(features)
  }

  return (
    <div className="page">
      {/* HEADER */}
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark" />
          <span className="brand-text">UPGRADE / PREDICTOR</span>
          <span className="brand-version">V1.0</span>
        </div>
        <div className="topbar-center">
          <span className="label">FREE → PAID PROBABILITY MODEL</span>
        </div>
      </header>

      {/* HERO — % left, sliders right, side by side */}
      <section className="hero">
        <div className="hero-left">
          <div className="label dim">PREDICTED UPGRADE PROBABILITY</div>
          <div className="hero-number">
            <span className="hero-doto">{pct(probability, 1)}</span>
            <span className="hero-percent">%</span>
          </div>
          <div className="hero-sub">
            <span className="label dim">TIER</span>
            <span className={`tier tier-${tier.tone}`}>{tier.tier}</span>
            <span className="label dim">/</span>
            <span className="label">{tier.desc}</span>
          </div>
          <div className="hero-bar">
            <SegmentedBar value={probability} segments={48} tone={tier.tone} />
          </div>
        </div>

        <div className="hero-right panel">
          <div className="panel-head">
            <span className="label">USER PROFILE / INPUTS</span>
            <span className="label dim">{FEATURES.length} FEATURES</span>
          </div>
          <div className="slider-list">
            {FEATURES.map((f) => (
              <Slider
                key={f.key}
                feature={f}
                value={input[f.key]}
                onChange={setKey}
              />
            ))}
          </div>
        </div>
      </section>

      {/* HORIZONTAL CONTRIBUTIONS STRIP — bars update live as sliders move */}
      <section className="panel contrib-strip-panel">
        <div className="panel-head">
          <span className="label">FEATURE CONTRIBUTIONS</span>
          <span className="label dim">LOG-ODDS Δ · LIVE</span>
        </div>
        <div className="contrib-strip">
          {stripRows.map((row) => (
            <ContribCol
              key={row.key}
              label={row.label}
              contrib={row.contrib}
              max={maxContrib}
            />
          ))}
        </div>
      </section>

      {/* SUPPORTING — formula + cohort */}
      <section className="support-grid">
        <div className="panel panel-formula">
          <div className="panel-head">
            <span className="label">MODEL</span>
            <span className="label dim">LOGISTIC REGRESSION</span>
          </div>
          <div className="formula">
            <div className="formula-line">
              <span className="formula-lhs">P(upgrade)</span>
              <span className="formula-eq">=</span>
              <span className="formula-rhs">σ( β₀ + Σ βᵢ · xᵢ )</span>
            </div>
            <div className="formula-line">
              <span className="formula-lhs">σ(z)</span>
              <span className="formula-eq">=</span>
              <span className="formula-rhs">1 / ( 1 + e⁻ᶻ )</span>
            </div>
            <div className="formula-line">
              <span className="formula-lhs">z</span>
              <span className="formula-eq">=</span>
              <span className="formula-rhs">{fmt(INTERCEPT, 2)} + Σ βᵢ · xᵢ</span>
            </div>
          </div>
        </div>

        <div className="panel panel-cohort">
          <div className="panel-head">
            <span className="label">COHORT / N=200</span>
            <span className="label dim">SEGMENT COUNTS</span>
          </div>
          <div className="cohort-grid">
            <StatBlock label="HOT" value={stats.hot} unit="USERS" />
            <StatBlock label="WARM" value={stats.warm} unit="USERS" />
            <StatBlock label="COOL" value={stats.cool} unit="USERS" />
            <StatBlock label="COLD" value={stats.cold} unit="USERS" />
            <StatBlock label="MEAN P" value={pct(stats.meanP, 1)} unit="%" />
            <StatBlock label="CONVERTED" value={pct(stats.conversionRate, 1)} unit="%" />
          </div>
        </div>
      </section>

      {/* DATASET */}
      <section className="panel panel-dataset">
        <div className="panel-head">
          <span className="label">SYNTHETIC DATASET / TOP 12</span>
          <div className="seg-control">
            {[
              { id: 'probability', label: 'BY P' },
              { id: 'tenure_days', label: 'BY TENURE' },
              { id: 'paywall_hits', label: 'BY PAYWALL' }
            ].map((s) => (
              <button
                key={s.id}
                className={`seg-btn ${tableSort === s.id ? 'on' : ''}`}
                onClick={() => setTableSort(s.id)}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>HANDLE</th>
                <th>ARCH</th>
                <th className="num">SESS/WK</th>
                <th className="num">MIN</th>
                <th className="num">FEATURES</th>
                <th className="num">ACTIVE</th>
                <th className="num">PAYWALL</th>
                <th className="num">P(UPGRADE)</th>
                <th>TIER</th>
                <th>LABEL</th>
              </tr>
            </thead>
            <tbody>
              {sortedDataset.map((r) => {
                const t = classify(r.probability)
                return (
                  <tr key={r.id} onClick={() => loadFromRow(r)} className="data-row">
                    <td className="mono dim">{r.id}</td>
                    <td className="mono">{r.handle}</td>
                    <td className="mono dim">{r.archetype}</td>
                    <td className="num mono">{r.weekly_sessions}</td>
                    <td className="num mono">{r.avg_session_min}</td>
                    <td className="num mono">{r.features_used}</td>
                    <td className="num mono">{r.days_active_30}</td>
                    <td className="num mono">{r.paywall_hits}</td>
                    <td className="num mono">{pct(r.probability, 1)}%</td>
                    <td>
                      <span className={`tier-pill tier-${t.tone}`}>{t.tier}</span>
                    </td>
                    <td className="mono dim">{r.converted ? 'PAID' : 'FREE'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <div className="table-foot">
          <span className="label dim">CLICK ANY ROW TO LOAD INTO PREDICTOR</span>
          <span className="label dim mono">{dataset.length} RECORDS · SEED 7</span>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="botbar">
        <span className="label dim">UPGRADE PREDICTOR</span>
        <span className="label dim">/</span>
        <span className="label dim">CLIENT-SIDE INFERENCE · LOGISTIC REGRESSION</span>
      </footer>
    </div>
  )
}
