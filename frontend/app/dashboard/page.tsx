'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface Project {
  id: number;
  name: string;
  task_type: string;
  target_column: string;
  status: string;
  row_count?: number;
  column_count?: number;
  created_at?: string;
  best_score?: number | null;
  best_metric?: string | null;
  has_alarm?: boolean;
}

const API = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';

function StatPill({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: '3px',
      padding: '10px 14px', borderRadius: '8px',
      background: 'rgba(4,14,31,0.5)',
      border: '1px solid rgba(255,255,255,0.06)',
      minWidth: '90px',
    }}>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--on-surface-variant)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        {label}
      </span>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '18px', fontWeight: 700, color, letterSpacing: '-0.02em' }}>
        {value}
      </span>
    </div>
  );
}

function TaskBadge({ type }: { type: string }) {
  const isClass = type === 'classification';
  return (
    <span style={{
      padding: '3px 10px', borderRadius: '9999px', fontSize: '10px',
      fontFamily: 'var(--font-mono)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em',
      background: isClass ? 'rgba(0,219,233,0.1)' : 'rgba(235,178,255,0.1)',
      color: isClass ? 'var(--primary-fixed-dim)' : 'var(--secondary)',
      border: `1px solid ${isClass ? 'rgba(0,219,233,0.2)' : 'rgba(235,178,255,0.2)'}`,
    }}>
      {type}
    </span>
  );
}

function StatusDot({ status }: { status: string }) {
  const color =
    status === 'completed' ? '#4ade80' :
    status === 'automl_running' || status === 'running' ? 'var(--primary-fixed-dim)' :
    status === 'failed' ? '#f87171' : 'var(--on-surface-variant)';
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
      <span style={{
        width: '7px', height: '7px', borderRadius: '50%',
        backgroundColor: color, display: 'inline-block',
        animation: status.includes('running') ? 'pulse 2s infinite' : 'none',
      }} />
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
        {status === 'automl_running' ? 'Running' : status}
      </span>
    </span>
  );
}

// Simple Markdown Renderer
function MarkdownRenderer({ content }: { content: string }) {
  const lines = content.split('\n');
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '13px', lineHeight: '21px', color: 'var(--on-surface-variant)' }}>
      {lines.map((line, i) => {
        const trimmed = line.trim();
        if (!trimmed) return <div key={i} style={{ height: '4px' }} />;
        
        // H3 headers
        if (trimmed.startsWith('###')) {
          return <h5 key={i} style={{ fontSize: '14px', fontWeight: 700, color: 'var(--on-surface)', marginTop: '10px', marginBottom: '2px' }}>{trimmed.replace('###', '').trim()}</h5>;
        }
        // H2 headers
        if (trimmed.startsWith('##')) {
          return <h4 key={i} style={{ fontSize: '16px', fontWeight: 700, color: 'var(--primary-fixed-dim)', marginTop: '14px', marginBottom: '4px' }}>{trimmed.replace('##', '').trim()}</h4>;
        }
        // H1 headers
        if (trimmed.startsWith('#')) {
          return <h3 key={i} style={{ fontSize: '18px', fontWeight: 800, color: 'var(--on-surface)', marginTop: '18px', marginBottom: '6px' }}>{trimmed.replace('#', '').trim()}</h3>;
        }
        // Bullet list items
        if (trimmed.startsWith('*') || trimmed.startsWith('-')) {
          const itemText = trimmed.substring(1).trim();
          return (
            <div key={i} style={{ display: 'flex', gap: '8px', paddingLeft: '8px' }}>
              <span style={{ color: 'var(--primary-fixed-dim)' }}>•</span>
              <span dangerouslySetInnerHTML={{ __html: formatBoldText(itemText) }} />
            </div>
          );
        }
        
        // Standard paragraphs
        return <p key={i} style={{ margin: 0 }} dangerouslySetInnerHTML={{ __html: formatBoldText(trimmed) }} />;
      })}
    </div>
  );
}

// Format double asterisk **text** to HTML <strong>
function formatBoldText(text: string): string {
  let formatted = text;
  const boldRegex = /\*\*(.*?)\*\*/g;
  formatted = formatted.replace(boldRegex, '<strong style="color: var(--on-surface)">$1</strong>');
  
  // Format inline code `code`
  const codeRegex = /`(.*?)`/g;
  formatted = formatted.replace(codeRegex, '<code style="background: rgba(255,255,255,0.06); padding: 2px 6px; border-radius: 4px; font-family: var(--font-mono); font-size: 11px; color: var(--primary-fixed-dim)">$1</code>');
  
  return formatted;
}

export default function DashboardPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [runningId, setRunningId] = useState<number | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // AI Insights state
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const [selectedProjectName, setSelectedProjectName] = useState('');
  const [loadingInsights, setLoadingInsights] = useState(false);
  const [aiInsights, setAiInsights] = useState<string | null>(null);
  const [insightsError, setInsightsError] = useState('');

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  const fetchProjects = async () => {
    try {
      const res = await fetch(`${API}/api/projects`);
      if (!res.ok) throw new Error('Failed to load projects');
      const data = await res.json();
      setProjects(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Could not reach backend');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
    const iv = setInterval(fetchProjects, 5000);
    return () => clearInterval(iv);
  }, []);

  const triggerAutoML = async (id: number, name: string) => {
    setRunningId(id);
    try {
      const res = await fetch(`${API}/api/projects/${id}/automl`, { method: 'POST' });
      if (!res.ok) throw new Error('Failed to trigger AutoML');
      showToast(`✅ AutoML started for "${name}"`);
      setTimeout(fetchProjects, 1500);
    } catch (e: unknown) {
      showToast(`❌ ${e instanceof Error ? e.message : 'Error'}`);
    } finally {
      setRunningId(null);
    }
  };

  const openInsights = async (projectId: number, name: string) => {
    setSelectedProjectId(projectId);
    setSelectedProjectName(name);
    setLoadingInsights(true);
    setAiInsights(null);
    setInsightsError('');

    try {
      const res = await fetch(`${API}/api/projects/${projectId}/insights`);
      if (!res.ok) throw new Error('Failed to load AI Insights');
      const data = await res.json();
      setAiInsights(data.ai_insights);
    } catch (e: unknown) {
      setInsightsError(e instanceof Error ? e.message : 'Could not generate report');
    } finally {
      setLoadingInsights(false);
    }
  };

  const closeInsights = () => {
    setSelectedProjectId(null);
    setAiInsights(null);
  };

  return (
    <div style={{ padding: '36px 32px', maxWidth: '1400px', margin: '0 auto', width: '100%' }}>

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', top: '80px', right: '24px', zIndex: 100,
          padding: '12px 20px', borderRadius: '10px',
          background: toast.startsWith('✅') ? 'rgba(74,222,128,0.15)' : 'rgba(255,71,71,0.15)',
          border: `1px solid ${toast.startsWith('✅') ? 'rgba(74,222,128,0.3)' : 'rgba(255,71,71,0.3)'}`,
          color: toast.startsWith('✅') ? '#4ade80' : '#f87171',
          fontFamily: 'var(--font-mono)', fontSize: '13px',
          backdropFilter: 'blur(12px)',
          animation: 'fadeIn 0.3s ease',
        }}>
          {toast}
        </div>
      )}

      {/* Page header */}
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '28px', fontWeight: 700, letterSpacing: '-0.02em', marginBottom: '6px' }}>
          All Projects
        </h1>
        <p style={{ color: 'var(--on-surface-variant)', fontSize: '14px' }}>
          Overview of every uploaded dataset and its experiment status.
        </p>
      </div>

      {/* Summary stats bar */}
      <div style={{
        display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '32px',
      }}>
        <StatPill label="Total Projects" value={String(projects.length)} color="var(--primary-fixed-dim)" />
        <StatPill
          label="Completed"
          value={String(projects.filter(p => p.status === 'completed').length)}
          color="#4ade80"
        />
        <StatPill
          label="Running"
          value={String(projects.filter(p => p.status?.includes('running')).length)}
          color="var(--secondary)"
        />
        <StatPill
          label="Uploaded"
          value={String(projects.filter(p => p.status === 'uploaded').length)}
          color="var(--on-surface-variant)"
        />
      </div>

      {/* States */}
      {loading && (
        <div style={{ textAlign: 'center', padding: '80px', color: 'var(--on-surface-variant)', fontFamily: 'var(--font-mono)' }}>
          ⏳ Loading projects...
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

      {!loading && !error && projects.length === 0 && (
        <div style={{
          textAlign: 'center', padding: '80px 20px',
          color: 'var(--on-surface-variant)', fontFamily: 'var(--font-mono)', fontSize: '14px',
        }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>📂</div>
          No projects yet. &nbsp;
          <Link href="/" style={{ color: 'var(--primary-fixed-dim)', textDecoration: 'none' }}>
            Upload your first dataset →
          </Link>
        </div>
      )}

      {/* Project Cards Grid */}
      {!loading && !error && projects.length > 0 && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
          gap: '20px',
        }}>
          {projects.map((project, i) => (
            <div
              key={project.id}
              className="glass-panel animate-slide-up"
              style={{
                borderRadius: '14px', padding: '22px',
                display: 'flex', flexDirection: 'column', gap: '16px',
                animationDelay: `${i * 0.07}s`,
                transition: 'box-shadow 0.25s ease, transform 0.2s ease',
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLDivElement).style.boxShadow = '0 0 20px rgba(0,219,233,0.12)';
                (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)';
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLDivElement).style.boxShadow = '';
                (e.currentTarget as HTMLDivElement).style.transform = '';
              }}
            >
              {/* Card header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <h2 style={{
                    fontSize: '16px', fontWeight: 700, marginBottom: '4px',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {project.name}
                  </h2>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <TaskBadge type={project.task_type || 'classification'} />
                    <span style={{ color: 'var(--on-surface-variant)', fontSize: '12px', fontFamily: 'var(--font-mono)' }}>
                      target: {project.target_column}
                    </span>
                  </div>
                </div>
                <div style={{
                  flexShrink: 0,
                  fontFamily: 'var(--font-mono)', fontSize: '11px',
                  color: 'var(--on-surface-variant)',
                  background: 'rgba(255,255,255,0.04)',
                  padding: '4px 8px', borderRadius: '6px',
                  border: '1px solid rgba(255,255,255,0.06)',
                }}>
                  #{project.id}
                </div>
              </div>

              {/* Status */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <StatusDot status={project.status || 'uploaded'} />
                  {project.has_alarm && (
                    <span style={{
                      padding: '2px 8px', borderRadius: '4px', fontSize: '9px',
                      fontFamily: 'var(--font-mono)', fontWeight: 700,
                      background: 'rgba(255,71,71,0.12)', color: '#f87171',
                      border: '1px solid rgba(255,71,71,0.3)',
                      boxShadow: '0 0 8px rgba(255,71,71,0.2)',
                      animation: 'pulse 1.8s infinite',
                      textTransform: 'uppercase', letterSpacing: '0.04em',
                    }}>
                      ⚠️ Alarm
                    </span>
                  )}
                </div>
                {project.best_score !== null && project.best_score !== undefined && (
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '18px', fontWeight: 700, color: '#4ade80' }}>
                      {project.best_metric === 'accuracy'
                        ? `${(project.best_score * 100).toFixed(1)}%`
                        : project.best_score.toFixed(4)}
                    </div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--on-surface-variant)', textTransform: 'uppercase' }}>
                      {project.best_metric || 'score'}
                    </div>
                  </div>
                )}
              </div>

              {/* Divider */}
              <div style={{ height: '1px', background: 'rgba(255,255,255,0.06)' }} />

              {/* Actions */}
              <div style={{ display: 'flex', gap: '8px', flexDirection: 'column' }}>
                <div style={{ display: 'flex', gap: '10px' }}>
                  {/* Run AutoML */}
                  <button
                    onClick={() => triggerAutoML(project.id, project.name)}
                    disabled={runningId === project.id || project.status?.includes('running')}
                    style={{
                      flex: 1, padding: '9px 12px', borderRadius: '7px', border: 'none',
                      background: 'var(--primary-container)', color: 'var(--on-primary-container)',
                      fontFamily: 'var(--font-ui)', fontSize: '13px', fontWeight: 700,
                      cursor: runningId === project.id || project.status?.includes('running') ? 'not-allowed' : 'pointer',
                      opacity: runningId === project.id || project.status?.includes('running') ? 0.5 : 1,
                      transition: 'filter 0.2s ease',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.filter = 'brightness(1.15)')}
                    onMouseLeave={e => (e.currentTarget.style.filter = '')}
                  >
                    {runningId === project.id ? '⏳ Starting...' : '▶ Run AutoML'}
                  </button>

                  {/* AI Insights Button */}
                  <button
                    onClick={() => openInsights(project.id, project.name)}
                    disabled={project.status !== 'completed'}
                    style={{
                      padding: '9px 14px', borderRadius: '7px',
                      border: '1px solid var(--outline-variant)',
                      background: 'transparent', color: 'var(--on-surface)',
                      fontFamily: 'var(--font-ui)', fontSize: '13px', fontWeight: 600,
                      cursor: project.status !== 'completed' ? 'not-allowed' : 'pointer',
                      opacity: project.status !== 'completed' ? 0.4 : 1,
                      transition: 'border-color 0.2s, background 0.2s',
                    }}
                    onMouseEnter={e => {
                      if (project.status === 'completed') {
                        e.currentTarget.style.borderColor = 'var(--secondary)';
                        e.currentTarget.style.background = 'rgba(235,178,255,0.06)';
                      }
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.borderColor = 'var(--outline-variant)';
                      e.currentTarget.style.background = 'transparent';
                    }}
                  >
                    💡 AI Insights
                  </button>
                </div>

                <Link href={`/experiments?project=${project.id}`} style={{
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  padding: '9px 16px', borderRadius: '7px',
                  border: '1px solid var(--outline-variant)',
                  color: 'var(--on-surface-variant)', textDecoration: 'none',
                  fontFamily: 'var(--font-ui)', fontSize: '13px', fontWeight: 600,
                  transition: 'border-color 0.2s, color 0.2s',
                }}
                  onMouseEnter={e => {
                    e.currentTarget.style.borderColor = 'var(--primary-fixed-dim)';
                    e.currentTarget.style.color = 'var(--primary-fixed-dim)';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.borderColor = 'var(--outline-variant)';
                    e.currentTarget.style.color = 'var(--on-surface-variant)';
                  }}
                >
                  View Runs Leaderboard →
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── AI Insights Sliding Drawer ── */}
      {selectedProjectId && (
        <>
          {/* Overlay mask */}
          <div
            onClick={closeInsights}
            style={{
              position: 'fixed', inset: 0, zIndex: 90,
              background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
            }}
          />

          {/* Drawer panel */}
          <div
            className="glass-panel-bright animate-slide-up"
            style={{
              position: 'fixed', top: 0, right: 0, bottom: 0, zIndex: 100,
              width: '100%', maxWidth: '540px',
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
                <h3 style={{ fontSize: '18px', fontWeight: 700 }}>AI Executive Insights</h3>
                <span className="label-mono-sm" style={{ color: 'var(--on-surface-variant)' }}>
                  Project: {selectedProjectName}
                </span>
              </div>
              <button
                onClick={closeInsights}
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

            {/* Scrollable Report */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '28px' }}>
              {loadingInsights && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '40px 0' }}>
                  <div style={{ textAlign: 'center', color: 'var(--on-surface-variant)', fontFamily: 'var(--font-mono)', fontSize: '13px', animation: 'pulse 1.5s infinite' }}>
                    🤖 AutoML Agent is reviewing experiment runs...
                  </div>
                  {/* Loading placeholder skeleton */}
                  <div style={{ height: '80px', borderRadius: '8px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.04)', animation: 'pulse 2s infinite' }} />
                  <div style={{ height: '140px', borderRadius: '8px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.04)', animation: 'pulse 2s infinite', animationDelay: '0.2s' }} />
                </div>
              )}

              {insightsError && (
                <div style={{
                  padding: '12px 16px', borderRadius: '8px',
                  background: 'rgba(255,180,171,0.08)', border: '1px solid rgba(255,180,171,0.25)',
                  color: 'var(--error)', fontFamily: 'var(--font-mono)', fontSize: '13px',
                }}>
                  ❌ {insightsError}
                </div>
              )}

              {aiInsights && (
                <div style={{ paddingBottom: '20px' }}>
                  <MarkdownRenderer content={aiInsights} />
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
