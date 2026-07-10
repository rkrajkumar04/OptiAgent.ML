'use client';

import { useEffect, useState, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';

interface Project { id: number; name: string; task_type: string; }
interface Run {
  id: number; run_number: number; model_name: string;
  metric_name: string | null; metric_value: number | null;
  status: string; thought: string | null; started_at: string | null;
  project_id: number; project_name?: string;
  mlflow_run_id?: string | null;
  logs?: string | null;
}

interface RunDetails {
  id: number;
  run_number: number;
  model_name: string;
  metric_name: string;
  metric_value: number;
  status: string;
  thought: string;
  logs: string;
  hyperparameters: Record<string, any>;
  metrics: Record<string, number>;
  feature_importances: Record<string, number>;
  mlflow_run_id?: string | null;
  started_at: string;
  completed_at: string;
}

function getStatusClass(status: string) {
  if (status === 'completed') return 'badge badge-green';
  if (status === 'running' || status === 'automl_running') return 'badge badge-cyan';
  if (status === 'failed') return 'badge badge-red';
  return 'badge badge-gray';
}

function formatScore(run: Run) {
  if (run.metric_value === null) return '—';
  if (run.metric_name === 'accuracy') return `${(run.metric_value * 100).toFixed(2)}%`;
  return run.metric_value.toFixed(4);
}

function ExperimentsPageContent() {
  const searchParams = useSearchParams();
  const filterProjectId = searchParams.get('project');

  const [projects, setProjects] = useState<Project[]>([]);
  const [allRuns, setAllRuns] = useState<Run[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedProject, setSelectedProject] = useState<string>(filterProjectId || 'all');
  const [sortBy, setSortBy] = useState<'score' | 'run'>('score');

  // Inspector Drawer state
  const [activeRunId, setActiveRunId] = useState<number | null>(null);
  const [details, setDetails] = useState<RunDetails | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [detailsError, setDetailsError] = useState('');

  const fetchAll = useCallback(async () => {
    try {
      const projRes = await fetch(`${API}/api/projects`);
      if (!projRes.ok) throw new Error('Backend offline');
      const projs: Project[] = await projRes.json();
      setProjects(projs);

      const allRunsList: Run[] = [];
      await Promise.all(projs.map(async p => {
        try {
          const r = await fetch(`${API}/api/projects/${p.id}/runs`);
          if (!r.ok) return;
          const runs: Run[] = await r.json();
          runs.forEach(run => allRunsList.push({ ...run, project_id: p.id, project_name: p.name }));
        } catch (_) { /* skip */ }
      }));
      setAllRuns(allRunsList);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error loading data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
    const iv = setInterval(fetchAll, 5000);
    return () => clearInterval(iv);
  }, [fetchAll]);

  // Fetch detailed run telemetry
  const loadRunDetails = async (runId: number) => {
    setActiveRunId(runId);
    setLoadingDetails(true);
    setDetails(null);
    setDetailsError('');

    try {
      const res = await fetch(`${API}/api/runs/${runId}/details`);
      if (!res.ok) throw new Error('Failed to load run telemetry');
      const data = await res.json();
      setDetails(data);
    } catch (e: unknown) {
      setDetailsError(e instanceof Error ? e.message : 'Could not fetch run details');
    } finally {
      setLoadingDetails(false);
    }
  };

  const closeInspector = () => {
    setActiveRunId(null);
    setDetails(null);
  };

  // Filter + sort
  const filtered = allRuns
    .filter(r => selectedProject === 'all' || String(r.project_id) === selectedProject)
    .sort((a, b) => {
      if (sortBy === 'score') return (b.metric_value ?? -Infinity) - (a.metric_value ?? -Infinity);
      return a.run_number - b.run_number;
    });

  return (
    <div style={{ padding: '36px 32px', maxWidth: '1400px', margin: '0 auto', width: '100%', position: 'relative' }}>

      {/* Header */}
      <div style={{ marginBottom: '28px' }}>
        <h1 style={{ fontSize: '28px', fontWeight: 700, letterSpacing: '-0.02em', marginBottom: '6px' }}>
          Experiment History
        </h1>
        <p style={{ color: 'var(--on-surface-variant)', fontSize: '14px' }}>
          Full run leaderboard across all projects. Click on any completed run row to inspect details.
        </p>
      </div>

      {/* Filter bar */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '24px', flexWrap: 'wrap', alignItems: 'center' }}>
        <div>
          <label style={{ fontSize: '12px', fontFamily: 'var(--font-mono)', color: 'var(--on-surface-variant)', display: 'block', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Filter by Project
          </label>
          <select
            className="select-field"
            value={selectedProject}
            onChange={e => setSelectedProject(e.target.value)}
            style={{ width: '220px' }}
          >
            <option value="all">All Projects ({projects.length})</option>
            {projects.map(p => (
              <option key={p.id} value={String(p.id)}>{p.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label style={{ fontSize: '12px', fontFamily: 'var(--font-mono)', color: 'var(--on-surface-variant)', display: 'block', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Sort By
          </label>
          <div style={{
            display: 'inline-flex', borderRadius: '8px',
            border: '1px solid var(--outline-variant)',
            background: 'rgba(4,14,31,0.5)', overflow: 'hidden',
          }}>
            {(['score', 'run'] as const).map(s => (
              <button key={s} onClick={() => setSortBy(s)} style={{
                padding: '8px 18px', fontSize: '13px', fontWeight: 600,
                border: 'none', cursor: 'pointer',
                transition: 'all 0.2s ease',
                background: sortBy === s ? 'var(--primary-container)' : 'transparent',
                color: sortBy === s ? 'var(--on-primary-container)' : 'var(--on-surface-variant)',
                textTransform: 'capitalize',
              }}>
                {s === 'score' ? '🏆 Best Score' : '🔢 Run Order'}
              </button>
            ))}
          </div>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'flex-end' }}>
          <button
            onClick={fetchAll}
            style={{
              padding: '8px 16px', borderRadius: '8px', border: '1px solid var(--outline-variant)',
              background: 'transparent', color: 'var(--on-surface-variant)',
              fontFamily: 'var(--font-mono)', fontSize: '12px', cursor: 'pointer',
              transition: 'color 0.2s, border-color 0.2s',
            }}
            onMouseEnter={e => { e.currentTarget.style.color = 'var(--primary-fixed-dim)'; e.currentTarget.style.borderColor = 'var(--primary-fixed-dim)'; }}
            onMouseLeave={e => { e.currentTarget.style.color = 'var(--on-surface-variant)'; e.currentTarget.style.borderColor = 'var(--outline-variant)'; }}
          >
            ↻ Refresh
          </button>
        </div>
      </div>

      {/* States */}
      {loading && (
        <div style={{ textAlign: 'center', padding: '80px', color: 'var(--on-surface-variant)', fontFamily: 'var(--font-mono)', fontSize: '14px' }}>
          ⏳ Loading experiment history...
        </div>
      )}

      {!loading && error && (
        <div style={{
          padding: '20px', borderRadius: '12px', textAlign: 'center',
          background: 'rgba(255,71,71,0.08)', border: '1px solid rgba(255,71,71,0.2)',
          color: '#f87171', fontFamily: 'var(--font-mono)', fontSize: '14px',
        }}>
          ❌ {error} — Make sure the backend is running at port 8000.
        </div>
      )}

      {/* Table */}
      {!loading && !error && (
        <div className="glass-panel" style={{ borderRadius: '14px', overflow: 'hidden' }}>
          {/* Table header */}
          <div style={{
            padding: '14px 20px',
            borderBottom: '1px solid var(--outline-variant)',
            background: 'rgba(4,14,31,0.4)',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--on-surface-variant)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {filtered.length} run{filtered.length !== 1 ? 's' : ''}
              {selectedProject !== 'all' && ` · ${projects.find(p => String(p.id) === selectedProject)?.name}`}
            </span>
            <Link href="/dashboard" style={{
              fontFamily: 'var(--font-mono)', fontSize: '12px',
              color: 'var(--primary-fixed-dim)', textDecoration: 'none',
            }}>
              ← All Projects
            </Link>
          </div>

          {filtered.length === 0 ? (
            <div style={{ padding: '60px', textAlign: 'center', color: 'var(--on-surface-variant)', fontFamily: 'var(--font-mono)', fontSize: '14px' }}>
              <div style={{ fontSize: '40px', marginBottom: '14px' }}>🔬</div>
              No experiments found. <Link href="/" style={{ color: 'var(--primary-fixed-dim)' }}>Run AutoML →</Link>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{
                    fontFamily: 'var(--font-mono)', fontSize: '11px',
                    color: 'var(--on-surface-variant)', textTransform: 'uppercase',
                    letterSpacing: '0.04em', borderBottom: '1px solid var(--outline-variant)',
                    background: 'rgba(4,14,31,0.3)',
                  }}>
                    {['Rank', 'Project', 'Run #', 'Model', 'Score', 'Metric', 'Thought', 'Status', 'MLflow'].map(col => (
                      <th key={col} style={{ padding: '12px 16px', fontWeight: 500, textAlign: 'left' }}>{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((run, i) => (
                    <tr
                      key={run.id}
                      onClick={() => run.status === 'completed' && loadRunDetails(run.id)}
                      className="data-stream-row"
                      style={{
                        borderBottom: '1px solid rgba(255,255,255,0.04)',
                        fontSize: '13px',
                        cursor: run.status === 'completed' ? 'pointer' : 'default',
                        background: activeRunId === run.id ? 'rgba(0,219,233,0.08)' : 'transparent',
                        transition: 'background 0.2s',
                      }}
                    >
                      <td style={{ padding: '13px 16px', fontFamily: 'var(--font-mono)', color: i === 0 ? 'var(--primary-fixed-dim)' : 'var(--on-surface-variant)', fontWeight: i === 0 ? 700 : 400 }}>
                        {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`}
                      </td>
                      <td style={{ padding: '13px 16px', color: 'var(--on-surface-variant)', fontFamily: 'var(--font-mono)', fontSize: '12px', maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {run.project_name}
                      </td>
                      <td style={{ padding: '13px 16px', fontFamily: 'var(--font-mono)', color: 'var(--on-surface-variant)' }}>
                        #{run.run_number}
                      </td>
                      <td style={{ padding: '13px 16px', fontWeight: 600, maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {run.model_name || '—'}
                      </td>
                      <td style={{ padding: '13px 16px', fontFamily: 'var(--font-mono)', fontSize: '15px', fontWeight: 700, color: i === 0 ? '#4ade80' : 'var(--secondary)' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                          {formatScore(run)}
                          {(() => {
                            try {
                              const parsed = run.logs ? JSON.parse(run.logs) : {};
                              if (parsed && parsed.validation_alarm) {
                                return (
                                  <span title={parsed.validation_alarm} style={{ cursor: 'help', fontSize: '12px' }}>
                                    ⚠️
                                  </span>
                                );
                              }
                            } catch (_) {}
                            return null;
                          })()}
                        </span>
                      </td>
                      <td style={{ padding: '13px 16px', fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--on-surface-variant)', textTransform: 'uppercase' }}>
                        {run.metric_name || '—'}
                      </td>
                      <td style={{ padding: '13px 16px', color: 'var(--on-surface-variant)', fontSize: '12px', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {run.thought || '—'}
                      </td>
                      <td style={{ padding: '13px 16px' }}>
                        <span className={getStatusClass(run.status)}>
                          {run.status === 'automl_running' ? 'running' : run.status}
                        </span>
                      </td>
                      <td style={{ padding: '13px 16px' }} onClick={e => run.mlflow_run_id && e.stopPropagation()}>
                        {run.mlflow_run_id ? (
                          <a
                            href={`http://localhost:5000/#/runs/${run.mlflow_run_id}`}
                            target="_blank"
                            rel="noreferrer"
                            style={{
                              color: 'var(--primary-fixed-dim)', textDecoration: 'none',
                              fontSize: '11px', fontFamily: 'var(--font-mono)',
                              border: '1px solid rgba(0,219,233,0.3)',
                              padding: '3px 8px', borderRadius: '4px',
                              background: 'rgba(0,219,233,0.05)',
                              transition: 'all 0.2s',
                            }}
                            onMouseEnter={e => {
                              e.currentTarget.style.background = 'rgba(0,219,233,0.15)';
                              e.currentTarget.style.borderColor = 'var(--primary-fixed-dim)';
                            }}
                            onMouseLeave={e => {
                              e.currentTarget.style.background = 'rgba(0,219,233,0.05)';
                              e.currentTarget.style.borderColor = 'rgba(0,219,233,0.3)';
                            }}
                          >
                            📊 View
                          </a>
                        ) : (
                          <span style={{ color: 'var(--on-surface-variant)', fontSize: '11px', fontFamily: 'var(--font-mono)' }}>—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Sliding Run Inspector Drawer ── */}
      {activeRunId && (
        <>
          {/* Overlay mask */}
          <div
            onClick={closeInspector}
            style={{
              position: 'fixed', inset: 0, zIndex: 90,
              background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
            }}
          />

          {/* Drawer content */}
          <div
            className="glass-panel-bright"
            style={{
              position: 'fixed', top: 0, right: 0, bottom: 0, zIndex: 100,
              width: '100%', maxWidth: '520px',
              display: 'flex', flexDirection: 'column',
              boxShadow: '-10px 0 30px rgba(0,0,0,0.5)',
              borderLeft: '1px solid rgba(255,255,255,0.1)',
              animation: 'slideIn 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards',
            }}
          >
            {/* Header */}
            <div style={{
              padding: '24px', borderBottom: '1px solid var(--outline-variant)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <div>
                <h3 style={{ fontSize: '18px', fontWeight: 700 }}>Run Telemetry</h3>
                <span className="label-mono-sm" style={{ color: 'var(--on-surface-variant)' }}>
                  ID: #{activeRunId} · details
                </span>
              </div>
              <button
                onClick={closeInspector}
                style={{
                  background: 'none', border: 'none', color: 'var(--on-surface-variant)',
                  fontSize: '22px', cursor: 'pointer', transition: 'color 0.2s',
                }}
                onMouseEnter={e => (e.currentTarget.style.color = 'var(--primary-fixed-dim)')}
                onMouseLeave={e => (e.currentTarget.style.color = '')}
              >
                ✕
              </button>
            </div>

            {/* Scrollable details panel */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '24px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
              {loadingDetails && (
                <div style={{ textAlign: 'center', padding: '40px', color: 'var(--on-surface-variant)', fontFamily: 'var(--font-mono)' }}>
                  ⏳ Fetching run details...
                </div>
              )}

              {detailsError && (
                <div style={{
                  padding: '12px 16px', borderRadius: '8px',
                  background: 'rgba(255,180,171,0.08)', border: '1px solid rgba(255,180,171,0.25)',
                  color: 'var(--error)', fontFamily: 'var(--font-mono)', fontSize: '13px',
                }}>
                  ❌ {detailsError}
                </div>
              )}

              {details && (
                <>
                  {/* Overview details */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <h4 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--on-surface)' }}>
                        {details.model_name}
                      </h4>
                      <p className="label-mono-sm" style={{ color: 'var(--on-surface-variant)', fontSize: '11px', marginTop: '2px' }}>
                        Run #{details.run_number} · {details.status.toUpperCase()}
                      </p>
                      {details.mlflow_run_id && (
                        <div style={{ marginTop: '10px' }}>
                          <a
                            href={`http://localhost:5000/#/runs/${details.mlflow_run_id}`}
                            target="_blank"
                            rel="noreferrer"
                            style={{
                              display: 'inline-flex', alignItems: 'center', gap: '6px',
                              padding: '6px 12px', borderRadius: '6px',
                              border: '1px solid var(--outline-variant)',
                              background: 'rgba(255,255,255,0.03)',
                              color: 'var(--primary-fixed-dim)', textDecoration: 'none',
                              fontSize: '12px', fontWeight: 600,
                              fontFamily: 'var(--font-ui)',
                              transition: 'all 0.2s',
                            }}
                            onMouseEnter={e => {
                              e.currentTarget.style.borderColor = 'var(--primary-fixed-dim)';
                              e.currentTarget.style.background = 'rgba(0,219,233,0.06)';
                            }}
                            onMouseLeave={e => {
                              e.currentTarget.style.borderColor = 'var(--outline-variant)';
                              e.currentTarget.style.background = 'rgba(255,255,255,0.03)';
                            }}
                          >
                            📊 View Run in MLflow
                          </a>
                        </div>
                      )}
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div className="label-mono-sm" style={{ color: 'var(--on-surface-variant)', fontSize: '9px', textTransform: 'uppercase' }}>
                        {details.metric_name || 'score'}
                      </div>
                      <div style={{ fontSize: '24px', fontWeight: 700, color: '#4ade80', fontFamily: 'var(--font-mono)', lineHeight: 1 }}>
                        {details.metric_name === 'accuracy'
                          ? `${(details.metric_value * 100).toFixed(2)}%`
                          : details.metric_value.toFixed(4)}
                      </div>
                    </div>
                  </div>

                  {/* Validation Alarm warning card */}
                  {(() => {
                    try {
                      const parsed = details.logs ? JSON.parse(details.logs) : {};
                      if (parsed && parsed.validation_alarm) {
                        return (
                          <div className="glass-panel" style={{
                            padding: '14px 18px', borderRadius: '8px',
                            border: '1px solid rgba(248,113,113,0.3)',
                            background: 'rgba(248,113,113,0.04)',
                            color: '#f87171', fontSize: '13px',
                            display: 'flex', gap: '10px', alignItems: 'flex-start',
                          }}>
                            <span style={{ fontSize: '18px', lineHeight: 1 }}>⚠️</span>
                            <div>
                              <strong style={{ display: 'block', marginBottom: '2px', color: '#f87171' }}>Validation Alarm Triggered</strong>
                              {parsed.validation_alarm}
                            </div>
                          </div>
                        );
                      }
                    } catch (_) {}
                    return null;
                  })()}

                  {/* Agent Rationale */}
                  {details.thought && (
                    <div className="glass-panel" style={{
                      padding: '16px', borderRadius: '8px', border: '1px solid rgba(235,178,255,0.15)',
                      background: 'rgba(235,178,255,0.02)',
                    }}>
                      <div className="label-mono-sm" style={{ color: 'var(--secondary)', textTransform: 'uppercase', fontSize: '10px', marginBottom: '8px', fontWeight: 700 }}>
                        🤖 Agent Rationale
                      </div>
                      <p style={{ fontSize: '13px', color: 'var(--on-surface-variant)', lineHeight: '19px' }}>
                        {details.thought}
                      </p>
                    </div>
                  )}

                  {/* Complete Metrics Grid */}
                  <div>
                    <div className="label-mono-sm" style={{ color: 'var(--on-surface-variant)', textTransform: 'uppercase', fontSize: '10px', marginBottom: '10px', letterSpacing: '0.05em' }}>
                      Evaluation Metrics
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                      {Object.entries(details.metrics || {}).map(([mName, mVal]) => (
                        <div key={mName} style={{
                          padding: '12px', borderRadius: '8px',
                          background: 'rgba(4,14,31,0.5)',
                          border: '1px solid rgba(255,255,255,0.06)',
                          display: 'flex', flexDirection: 'column', gap: '4px',
                        }}>
                          <span className="label-mono-sm" style={{ color: 'var(--on-surface-variant)', fontSize: '10px', textTransform: 'uppercase' }}>
                            {mName.replace('_', ' ')}
                          </span>
                          <span style={{ fontSize: '18px', fontWeight: 700, color: 'var(--primary-fixed-dim)', fontFamily: 'var(--font-mono)' }}>
                            {['accuracy', 'precision', 'recall', 'f1_score', 'r2'].includes(mName)
                              ? `${(mVal * 100).toFixed(1)}%`
                              : mVal.toFixed(4)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Feature Importance bar chart */}
                  {Object.keys(details.feature_importances || {}).length > 0 && (
                    <div>
                      <div className="label-mono-sm" style={{ color: 'var(--on-surface-variant)', textTransform: 'uppercase', fontSize: '10px', marginBottom: '14px', letterSpacing: '0.05em' }}>
                        Feature Influence Telemetry
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {Object.entries(details.feature_importances)
                          .sort((a, b) => b[1] - a[1])
                          .map(([col, weight]) => {
                            const pct = (weight * 100).toFixed(1);
                            return (
                              <div key={col} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <span style={{ width: '130px', fontSize: '12px', color: 'var(--on-surface)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={col}>
                                  {col}
                                </span>
                                <div style={{ flex: 1, height: '6px', background: 'rgba(255,255,255,0.05)', borderRadius: '3px', overflow: 'hidden' }}>
                                  <div style={{
                                    height: '100%', width: `${pct}%`,
                                    background: 'var(--primary-fixed-dim)', borderRadius: '3px',
                                  }} />
                                </div>
                                <span style={{ width: '45px', textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--primary-fixed-dim)' }}>
                                  {pct}%
                                </span>
                              </div>
                            );
                          })}
                      </div>
                    </div>
                  )}

                  {/* Hyperparameters recruiter block */}
                  {Object.keys(details.hyperparameters || {}).length > 0 && (
                    <div>
                      <div className="label-mono-sm" style={{ color: 'var(--on-surface-variant)', textTransform: 'uppercase', fontSize: '10px', marginBottom: '8px', letterSpacing: '0.05em' }}>
                        Hyperparameters Configuration
                      </div>
                      <pre style={{
                        margin: 0, padding: '14px', borderRadius: '8px',
                        background: 'rgba(4,14,31,0.7)',
                        border: '1px solid rgba(255,255,255,0.06)',
                        color: 'var(--primary-fixed-dim)',
                        fontFamily: 'var(--font-mono)', fontSize: '12px',
                        overflowX: 'auto',
                      }}>
                        {JSON.stringify(details.hyperparameters, null, 2)}
                      </pre>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </>
      )}

      {/* Drawer slide-in animation */}
      <style jsx global>{`
        @keyframes slideIn {
          from { transform: translateX(100%); }
          to   { transform: translateX(0); }
        }
      `}</style>
    </div>
  );
}

export default function ExperimentsPage() {
  return (
    <Suspense fallback={<div style={{ padding: '40px', color: 'var(--on-surface-variant)', fontFamily: 'var(--font-mono)' }}>Loading experiments database...</div>}>
      <ExperimentsPageContent />
    </Suspense>
  );
}
