'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';

interface Project {
  id: number;
  name: string;
  task_type: string;
  target_column: string;
  eda_summary?: {
    columns?: {
      name: string;
      dtype: string;
      role: string;
      missing_count: number;
      unique_count: number;
      is_target: boolean;
    }[];
  };
}

interface Run {
  id: number;
  run_number: number;
  model_name: string;
  metric_name: string | null;
  metric_value: number | null;
  status: string;
  model_path: string | null;
  created_at: string;
  project_id: number;
  project_name?: string;
  task_type?: string;
}

export default function ModelsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [runs, setRuns] = useState<Run[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Playground state
  const [selectedRun, setSelectedRun] = useState<Run | null>(null);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [playgroundInputs, setPlaygroundInputs] = useState<Record<string, string>>({});
  const [predicting, setPredicting] = useState(false);
  const [predictionResult, setPredictionResult] = useState<any | null>(null);
  const [predictionError, setPredictionError] = useState('');

  const fetchData = useCallback(async () => {
    try {
      const projRes = await fetch(`${API}/api/projects`);
      if (!projRes.ok) throw new Error('Backend server is offline');
      const projs: Project[] = await projRes.json();
      setProjects(projs);

      const allModelRuns: Run[] = [];
      await Promise.all(projs.map(async p => {
        try {
          const r = await fetch(`${API}/api/projects/${p.id}/runs`);
          if (!r.ok) return;
          const runsData: Run[] = await r.json();
          // Filter runs that have a saved model path on disk
          runsData.forEach(run => {
            if (run.model_path && run.status === 'completed') {
              allModelRuns.push({
                ...run,
                project_id: p.id,
                project_name: p.name,
                task_type: p.task_type
              });
            }
          });
        } catch (_) { /* skip failed fetches */ }
      }));
      
      // Sort by run completion date (newest first)
      allModelRuns.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setRuns(allModelRuns);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error fetching models');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleDelete = async (runId: number, modelName: string) => {
    if (!confirm(`Are you sure you want to permanently delete the model "${modelName}"?\nThis will delete it from disk and database.`)) return;
    try {
      const res = await fetch(`${API}/api/models/${runId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error((await res.json()).detail || 'Deletion failed');
      
      setRuns(prev => prev.filter(r => r.id !== runId));
    } catch (e: unknown) {
      alert(`❌ Error: ${e instanceof Error ? e.message : 'Failed to delete model'}`);
    }
  };

  const openPlayground = (run: Run) => {
    const proj = projects.find(p => p.id === run.project_id) || null;
    setSelectedRun(run);
    setSelectedProject(proj);
    setPlaygroundInputs({});
    setPredictionResult(null);
    setPredictionError('');
  };

  const closePlayground = () => {
    setSelectedRun(null);
    setSelectedProject(null);
  };

  const handleInputChange = (colName: string, value: string) => {
    setPlaygroundInputs(prev => ({ ...prev, [colName]: value }));
  };

  const runPrediction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRun) return;
    setPredicting(true);
    setPredictionResult(null);
    setPredictionError('');

    try {
      const res = await fetch(`${API}/api/models/${selectedRun.id}/predict`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inputs: playgroundInputs }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || 'Prediction failed');
      }

      const data = await res.json();
      setPredictionResult(data);
    } catch (e: unknown) {
      setPredictionError(e instanceof Error ? e.message : 'Error running prediction');
    } finally {
      setPredicting(false);
    }
  };

  // Helper: Format metrics
  const formatMetric = (run: Run) => {
    if (run.metric_value === null) return '—';
    if (run.metric_name === 'accuracy') return `${(run.metric_value * 100).toFixed(1)}%`;
    return run.metric_value.toFixed(4);
  };

  const getFeatures = () => {
    if (!selectedProject || !selectedProject.eda_summary?.columns) return [];
    return selectedProject.eda_summary.columns.filter(c => !c.is_target);
  };

  return (
    <div style={{ padding: '36px 32px', maxWidth: '1400px', margin: '0 auto', width: '100%', position: 'relative' }}>
      
      {/* Header */}
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '28px', fontWeight: 700, letterSpacing: '-0.02em', marginBottom: '6px' }}>
          Models Repository
        </h1>
        <p style={{ color: 'var(--on-surface-variant)', fontSize: '14px' }}>
          Explore, download, and test all saved machine learning pipelines.
        </p>
      </div>

      {/* States */}
      {loading && (
        <div style={{ textAlign: 'center', padding: '80px', color: 'var(--on-surface-variant)', fontFamily: 'var(--font-mono)' }}>
          ⏳ Loading saved models...
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

      {!loading && !error && runs.length === 0 && (
        <div style={{
          textAlign: 'center', padding: '80px 20px',
          color: 'var(--on-surface-variant)', fontFamily: 'var(--font-mono)', fontSize: '14px',
        }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>📦</div>
          No models saved yet. Run the AutoML pipeline to train and save models. &nbsp;
          <Link href="/" style={{ color: 'var(--primary-fixed-dim)', textDecoration: 'none' }}>
            Train your first model →
          </Link>
        </div>
      )}

      {/* Grid */}
      {!loading && !error && runs.length > 0 && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))',
          gap: '20px',
        }}>
          {runs.map((run, i) => (
            <div
              key={run.id}
              className="glass-panel animate-slide-up"
              style={{
                borderRadius: '14px', padding: '24px',
                display: 'flex', flexDirection: 'column', gap: '16px',
                animationDelay: `${i * 0.05}s`,
                transition: 'box-shadow 0.25s, transform 0.2s',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.boxShadow = '0 0 20px rgba(0,219,233,0.12)';
                e.currentTarget.style.transform = 'translateY(-2px)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.boxShadow = '';
                e.currentTarget.style.transform = '';
              }}
            >
              {/* Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px' }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <h2 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {run.model_name}
                  </h2>
                  <p style={{ color: 'var(--on-surface-variant)', fontSize: '12px', fontFamily: 'var(--font-mono)' }}>
                    Project: {run.project_name} · Run #{run.run_number}
                  </p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{
                    padding: '3px 8px', borderRadius: '4px', fontSize: '10px', fontFamily: 'var(--font-mono)',
                    textTransform: 'uppercase', background: run.task_type === 'classification' ? 'rgba(0,219,233,0.1)' : 'rgba(235,178,255,0.1)',
                    color: run.task_type === 'classification' ? 'var(--primary-fixed-dim)' : 'var(--secondary)',
                    border: `1px solid ${run.task_type === 'classification' ? 'rgba(0,219,233,0.2)' : 'rgba(235,178,255,0.2)'}`,
                  }}>
                    {run.task_type}
                  </div>
                  <button
                    onClick={() => handleDelete(run.id, run.model_name)}
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      color: '#f87171', padding: '4px', display: 'flex', alignItems: 'center',
                      borderRadius: '4px', transition: 'background 0.2s, color 0.2s',
                    }}
                    title="Delete model"
                    onMouseEnter={e => {
                      e.currentTarget.style.background = 'rgba(248,113,113,0.15)';
                      e.currentTarget.style.color = '#ef4444';
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.background = 'none';
                      e.currentTarget.style.color = '#f87171';
                    }}
                  >
                    🗑️
                  </button>
                </div>
              </div>

              {/* Stats */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div className="label-mono-sm" style={{ color: 'var(--on-surface-variant)', textTransform: 'uppercase', fontSize: '9px' }}>
                    Metric Value ({run.metric_name || 'score'})
                  </div>
                  <div style={{ fontSize: '20px', fontWeight: 700, color: '#4ade80', fontFamily: 'var(--font-mono)' }}>
                    {formatMetric(run)}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div className="label-mono-sm" style={{ color: 'var(--on-surface-variant)', textTransform: 'uppercase', fontSize: '9px' }}>
                    Trained On
                  </div>
                  <div style={{ fontSize: '13px', color: 'var(--on-surface)', fontFamily: 'var(--font-mono)' }}>
                    {new Date(run.created_at).toLocaleDateString()}
                  </div>
                </div>
              </div>

              <div style={{ height: '1px', background: 'rgba(255,255,255,0.06)' }} />

              {/* Actions */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {/* Download and Export Buttons Row */}
                <div style={{ display: 'flex', gap: '10px' }}>
                  {/* Download PKL */}
                  <a
                    href={`${API}/api/models/download/${run.id}`}
                    style={{
                      flex: 1, padding: '9px', borderRadius: '7px', border: '1px solid var(--outline-variant)',
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                      color: 'var(--on-surface)', textDecoration: 'none',
                      fontFamily: 'var(--font-ui)', fontSize: '12px', fontWeight: 600,
                      transition: 'border-color 0.2s, background 0.2s',
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.borderColor = 'var(--primary-fixed-dim)';
                      e.currentTarget.style.background = 'rgba(0,219,233,0.05)';
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.borderColor = 'var(--outline-variant)';
                      e.currentTarget.style.background = 'transparent';
                    }}
                  >
                    💾 Download
                  </a>

                  {/* Export Bundle ZIP */}
                  <a
                    href={`${API}/api/models/export/${run.id}`}
                    style={{
                      flex: 1, padding: '9px', borderRadius: '7px', border: '1px solid var(--outline-variant)',
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                      color: 'var(--on-surface)', textDecoration: 'none',
                      fontFamily: 'var(--font-ui)', fontSize: '12px', fontWeight: 600,
                      transition: 'border-color 0.2s, background 0.2s',
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.borderColor = 'var(--secondary)';
                      e.currentTarget.style.background = 'rgba(235,178,255,0.05)';
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.borderColor = 'var(--outline-variant)';
                      e.currentTarget.style.background = 'transparent';
                    }}
                  >
                    📦 Export
                  </a>
                </div>
                
                {/* Playground Button */}
                <button
                  onClick={() => openPlayground(run)}
                  style={{
                    width: '100%', padding: '10px', borderRadius: '8px', border: 'none',
                    background: 'var(--primary-container)', color: 'var(--on-primary-container)',
                    fontFamily: 'var(--font-ui)', fontSize: '13px', fontWeight: 700,
                    cursor: 'pointer', transition: 'filter 0.2s',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.filter = 'brightness(1.15)')}
                  onMouseLeave={e => (e.currentTarget.style.filter = '')}
                >
                  ⚡ Test Model
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Sliding Playground Drawer ── */}
      {selectedRun && (
        <>
          {/* Overlay mask */}
          <div
            onClick={closePlayground}
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
              width: '100%', maxWidth: '480px',
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
                <h3 style={{ fontSize: '18px', fontWeight: 700 }}>Model Playground</h3>
                <span className="label-mono-sm" style={{ color: 'var(--on-surface-variant)' }}>
                  {selectedRun.model_name}
                </span>
              </div>
              <button
                onClick={closePlayground}
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

            {/* Scrollable Form */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
              <form onSubmit={runPrediction} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div className="label-mono-sm" style={{ color: 'var(--on-surface-variant)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Input Features
                </div>

                {getFeatures().map((col) => (
                  <div key={col.name}>
                    <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', color: 'var(--on-surface)', fontWeight: 500 }}>
                      {col.name} &nbsp;
                      <span className="label-mono-sm" style={{ color: 'var(--on-surface-variant)', fontSize: '10px' }}>
                        ({col.role})
                      </span>
                    </label>

                    {col.role === 'boolean' ? (
                      <select
                        className="select-field"
                        value={playgroundInputs[col.name] || ''}
                        onChange={e => handleInputChange(col.name, e.target.value)}
                        required
                      >
                        <option value="">-- select value --</option>
                        <option value="true">True</option>
                        <option value="false">False</option>
                      </select>
                    ) : (
                      <input
                        className="input-field"
                        type={col.role === 'numeric' ? 'number' : 'text'}
                        step="any"
                        placeholder={`Enter ${col.name}`}
                        value={playgroundInputs[col.name] || ''}
                        onChange={e => handleInputChange(col.name, e.target.value)}
                        required
                      />
                    )}
                  </div>
                ))}

                <button
                  type="submit"
                  className="btn-primary"
                  disabled={predicting}
                  style={{ width: '100%', padding: '12px', fontSize: '14px', borderRadius: '8px', marginTop: '10px' }}
                >
                  {predicting ? '⏳ Predicting...' : '⚡ Generate Prediction'}
                </button>
              </form>

              {/* Error Callout */}
              {predictionError && (
                <div style={{
                  marginTop: '20px', padding: '12px 16px', borderRadius: '8px',
                  background: 'rgba(255,180,171,0.08)', border: '1px solid rgba(255,180,171,0.25)',
                  color: 'var(--error)', fontFamily: 'var(--font-mono)', fontSize: '13px',
                }}>
                  ❌ {predictionError}
                </div>
              )}

              {/* Prediction Result Block */}
              {predictionResult && (
                <div className="glass-panel" style={{
                  marginTop: '24px', padding: '20px', borderRadius: '10px',
                  border: '1px solid var(--primary-fixed-dim)',
                  boxShadow: '0 0 15px rgba(0,219,233,0.12)',
                  animation: 'fadeIn 0.4s ease',
                }}>
                  <div className="label-mono-sm" style={{ color: 'var(--on-surface-variant)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
                    Predicted Output
                  </div>
                  <div style={{
                    fontSize: '28px', fontWeight: 800, color: 'var(--primary-fixed-dim)',
                    fontFamily: 'var(--font-mono)', letterSpacing: '-0.02em',
                  }}>
                    {String(predictionResult.prediction)}
                  </div>

                  {/* Probabilities for classification */}
                  {predictionResult.probabilities && (
                    <div style={{ marginTop: '16px' }}>
                      <div className="label-mono-sm" style={{ color: 'var(--on-surface-variant)', fontSize: '10px', textTransform: 'uppercase', marginBottom: '6px' }}>
                        Class Probabilities
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {Object.entries(predictionResult.probabilities).map(([c, p]: [string, any]) => (
                          <div key={c} style={{ fontSize: '12px', fontFamily: 'var(--font-mono)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                              <span>{c}</span>
                              <span style={{ color: 'var(--secondary)' }}>{(p * 100).toFixed(1)}%</span>
                            </div>
                            <div style={{ height: '4px', background: 'var(--surface-variant)', borderRadius: '2px', overflow: 'hidden' }}>
                              <div style={{
                                height: '100%', width: `${p * 100}%`,
                                background: 'var(--secondary)', borderRadius: '2px',
                              }} />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
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
