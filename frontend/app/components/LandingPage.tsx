'use client';

import React, { useState, useEffect } from 'react';

const tokens = {
  primary: '#4F8CFF',     // Electric Blue
  secondary: '#7C4DFF',   // Vibrant Indigo
  tertiary: '#22C55E',    // Sleek Green
  neutral: '#75777F',     // Slate Gray
  background: '#121214',  // Deep Space Black
};

const API = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';

interface LandingPageProps {
  onLaunchApp: (tab?: 'workspace' | 'about') => void;
  isLoggedIn: boolean;
  setIsLoggedIn: (val: boolean) => void;
}

export default function LandingPage({ onLaunchApp, isLoggedIn, setIsLoggedIn }: LandingPageProps) {
  const [hoveredNav, setHoveredNav] = useState<string | null>(null);

  // Motion picture animation loop states
  const [animProgress, setAnimProgress] = useState(0);
  const [tickerVal, setTickerVal] = useState(0);
  const [activeModelIndex, setActiveModelIndex] = useState(-1);

  useEffect(() => {
    let frame = 0;
    const interval = setInterval(() => {
      frame = (frame + 1.2) % 100;
      setAnimProgress(frame);
      
      const targetAcc = 97.8;
      const val = Math.min(targetAcc, (frame / 85) * targetAcc);
      setTickerVal(Number(val.toFixed(1)));

      const activeIdx = Math.min(4, Math.floor((frame / 85) * 5));
      setActiveModelIndex(activeIdx);
    }, 70);
    return () => clearInterval(interval);
  }, []);

  // Authentication & Login Modal states
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [pendingTab, setPendingTab] = useState<'workspace' | 'about'>('workspace');

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleWorkflowAction = (tab: 'workspace' | 'about' = 'workspace') => {
    if (tab === 'about') {
      onLaunchApp('about');
      return;
    }
    if (isLoggedIn) {
      onLaunchApp(tab);
    } else {
      setPendingTab(tab);
      setAuthMode('login');
      setShowAuthModal(true);
    }
  };

  const handleAuthSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    if (!email || !password) return;

    const cleanedEmail = email.trim().toLowerCase();
    if (!cleanedEmail.endsWith('@gmail.com')) {
      setAuthError('Please enter a valid Gmail address (ending in @gmail.com)');
      return;
    }

    setAuthLoading(true);
    
    // Log user login to backend
    fetch(`${API}/api/users/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: cleanedEmail })
    })
    .catch(err => console.error("Failed to log user login:", err))
    .finally(() => {
      if (typeof window !== 'undefined') {
        localStorage.setItem('userEmail', cleanedEmail);
      }
      setIsLoggedIn(true);
      setAuthLoading(false);
      setShowAuthModal(false);
      setAuthError(null);
      onLaunchApp(pendingTab);
    });
  };

  return (
    <div style={{
      background: 'radial-gradient(ellipse at top, #181922, #0d0e12)',
      color: '#ffffff',
      fontFamily: 'var(--font-sans, "Outfit", sans-serif)',
      minHeight: '100vh',
      overflowX: 'hidden'
    }}>
      {/* ─── STICKY HEADER ─── */}
      <header style={{
        position: 'sticky',
        top: 0,
        zIndex: 1000,
        backdropFilter: 'blur(16px)',
        background: 'rgba(13, 14, 18, 0.75)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
        transition: 'all 0.3s ease'
      }}>
        <div style={{
          maxWidth: '1200px',
          margin: '0 auto',
          padding: '16px 24px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          {/* Logo brand */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }} onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
            <svg width="32" height="32" viewBox="0 0 34 34" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ filter: `drop-shadow(0 0 8px ${tokens.primary}40)` }}>
              <polygon points="17,2 30,9.5 30,24.5 17,32 4,24.5 4,9.5"
                fill="rgba(79, 140, 255, 0.06)" stroke={tokens.primary} strokeWidth="2" />
              <polygon points="17,6 26.5,11.5 26.5,22.5 17,28 7.5,22.5 7.5,11.5"
                fill="none" stroke={`${tokens.secondary}40`} strokeWidth="1" />
              <circle cx="17" cy="11" r="2.5" fill={tokens.primary} />
              <circle cx="11" cy="20" r="2.5" fill={tokens.secondary} />
              <circle cx="23" cy="20" r="2.5" fill={tokens.secondary} />
              <line x1="17" y1="11" x2="11" y2="20" stroke={`${tokens.primary}60`} strokeWidth="1.5" />
              <line x1="17" y1="11" x2="23" y2="20" stroke={`${tokens.primary}60`} strokeWidth="1.5" />
              <line x1="11" y1="20" x2="23" y2="20" stroke={`${tokens.secondary}50`} strokeWidth="1.5" />
            </svg>
            <span style={{
              fontSize: '20px',
              fontWeight: 800,
              letterSpacing: '-0.02em',
              background: `linear-gradient(90deg, #ffffff, #c7d2fe)`,
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent'
            }}>
              OptiAgent<span style={{ color: tokens.secondary }}>.ML</span>
            </span>
          </div>

          {/* Navigation Links */}
          <nav className="desktop-only" style={{ display: 'flex', gap: '32px', alignItems: 'center' }}>
            {['Home', 'Features', 'Workplace', 'About'].map((item) => (
              <button
                key={item}
                onClick={() => {
                  if (item === 'Home') window.scrollTo({ top: 0, behavior: 'smooth' });
                  else if (item === 'Workplace') handleWorkflowAction('workspace');
                  else if (item === 'About') handleWorkflowAction('about');
                  else scrollToSection(item.toLowerCase());
                }}
                onMouseEnter={() => setHoveredNav(item)}
                onMouseLeave={() => setHoveredNav(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: hoveredNav === item ? '#ffffff' : 'rgba(255, 255, 255, 0.6)',
                  fontSize: '14px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  transition: 'color 0.2s ease, transform 0.2s ease',
                  transform: hoveredNav === item ? 'translateY(-1px)' : 'none'
                }}
              >
                {item}
              </button>
            ))}
          </nav>

          {/* Auth Actions */}
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            {isLoggedIn ? (
              <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                {/* Gmail-style User Badge */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: '100px',
                  padding: '4px 12px 4px 4px',
                  fontFamily: 'var(--font-mono, monospace)',
                  fontSize: '12px',
                  color: 'rgba(255, 255, 255, 0.8)'
                }}>
                  {/* Gmail Logo Avatar */}
                  <div style={{
                    width: '24px',
                    height: '24px',
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, #ea4335, #c5221f)', // Gmail Red
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 'bold',
                    color: '#ffffff',
                    fontSize: '11px',
                    textShadow: '0 1px 2px rgba(0,0,0,0.3)',
                    boxShadow: '0 2px 5px rgba(234, 67, 53, 0.4)'
                  }}>
                    {(typeof window !== 'undefined' ? localStorage.getItem('userEmail') || 'G' : 'G').substring(0, 1).toUpperCase()}
                  </div>
                  <span>
                    {typeof window !== 'undefined' ? localStorage.getItem('userEmail') || 'gmail-user@gmail.com' : ''}
                  </span>
                </div>

                <button
                  onClick={() => {
                    if (typeof window !== 'undefined') localStorage.removeItem('userEmail');
                    setIsLoggedIn(false);
                  }}
                  style={{
                    background: 'transparent',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    borderRadius: '8px',
                    color: 'rgba(255, 255, 255, 0.8)',
                    fontSize: '14px',
                    fontWeight: 600,
                    padding: '9px 18px',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = '#ffffff';
                    e.currentTarget.style.color = '#ffffff';
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.15)';
                    e.currentTarget.style.color = 'rgba(255, 255, 255, 0.8)';
                    e.currentTarget.style.background = 'transparent';
                  }}
                >
                  Logout
                </button>
              </div>
            ) : (
              <>
                <button
                  onClick={() => {
                    setAuthMode('login');
                    setShowAuthModal(true);
                  }}
                  style={{
                    background: 'transparent',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    borderRadius: '8px',
                    color: 'rgba(255, 255, 255, 0.8)',
                    fontSize: '14px',
                    fontWeight: 600,
                    padding: '9px 18px',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = '#ffffff';
                    e.currentTarget.style.color = '#ffffff';
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.15)';
                    e.currentTarget.style.color = 'rgba(255, 255, 255, 0.8)';
                    e.currentTarget.style.background = 'transparent';
                  }}
                >
                  Login
                </button>
                <button
                  onClick={() => {
                    setAuthMode('signup');
                    setShowAuthModal(true);
                  }}
                  className="launch-btn-glow"
                  style={{
                    background: `linear-gradient(135deg, ${tokens.primary}, ${tokens.secondary})`,
                    border: 'none',
                    borderRadius: '8px',
                    color: '#ffffff',
                    fontSize: '14px',
                    fontWeight: 600,
                    padding: '10px 20px',
                    cursor: 'pointer',
                    transition: 'all 0.3s ease',
                    boxShadow: `0 4px 20px ${tokens.secondary}30`
                  }}
                >
                  Sign Up
                </button>
              </>
            )}
          </div>

        </div>
      </header>

      {/* ─── HERO SECTION ─── */}
      <section style={{
        maxWidth: '1200px',
        margin: '0 auto',
        padding: '80px 24px 100px 24px',
        display: 'grid',
        gridTemplateColumns: '1.1fr 0.9fr',
        gap: '48px',
        alignItems: 'center'
      }} className="grid-2col">
        {/* Left Column info */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
          {/* Badge */}
          <div style={{ display: 'inline-flex', width: 'fit-content' }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '6px 14px',
              borderRadius: '100px',
              background: 'rgba(124, 77, 255, 0.06)',
              border: `1.5px solid ${tokens.secondary}40`,
              boxShadow: `0 0 15px ${tokens.secondary}15`
            }}>
              <span style={{ fontSize: '12px' }}>✨</span>
              <span style={{
                fontSize: '11px',
                fontWeight: 600,
                fontFamily: 'var(--font-mono, monospace)',
                color: tokens.primary,
                letterSpacing: '0.05em',
                textTransform: 'uppercase'
              }}>
                AutoML • No code required
              </span>
            </div>
          </div>

          {/* Heading */}
          <h1 style={{
            fontSize: '56px',
            fontWeight: 900,
            lineHeight: '1.22',
            letterSpacing: '-0.03em',
            margin: 0
          }}>
            TRAIN MACHINE <br />
            <span style={{
              background: `linear-gradient(90deg, ${tokens.primary}, ${tokens.secondary})`,
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              position: 'relative'
            }}>
              LEARNING
            </span> <br />
            IN MINUTES
          </h1>

          {/* Description */}
          <p style={{
            fontSize: '17px',
            color: tokens.neutral,
            lineHeight: '26px',
            margin: 0,
            maxWidth: '480px'
          }}>
            Upload a CSV. Pick a column. Watch five algorithms compete and rank themselves. Get a deployable model — no Python knowledge needed.
          </p>

          {/* CTA Buttons */}
          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
            <button
              onClick={() => handleWorkflowAction('workspace')}

              className="launch-btn-glow"
              style={{
                background: `linear-gradient(135deg, ${tokens.primary}, ${tokens.secondary})`,
                border: 'none',
                borderRadius: '10px',
                color: '#ffffff',
                fontSize: '15px',
                fontWeight: 600,
                padding: '14px 28px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                transition: 'all 0.3s ease',
                boxShadow: `0 4px 25px ${tokens.secondary}40`
              }}
            >
              <span>▶</span>
              START FREE
            </button>
            <button
              onClick={() => scrollToSection('workflow')}
              style={{
                background: 'rgba(255, 255, 255, 0.02)',
                border: '1.5px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '10px',
                color: '#ffffff',
                fontSize: '15px',
                fontWeight: 600,
                padding: '14px 28px',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.15)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.02)';
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)';
              }}
            >
              Watch Demo →
            </button>
          </div>

          {/* Divider */}
          <div style={{ height: '1px', background: 'rgba(255,255,255,0.06)', width: '100%', margin: '12px 0' }} />

          {/* Stats Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }} className="metrics-grid">
            {[
              { val: '5', label: 'ML Algorithms' },
              { val: '< 10s', label: 'Avg Train Time' },
              { val: '4', label: 'Analytics Views' },
              { val: '0', label: 'Server Uploads' }
            ].map((stat, idx) => (
              <div key={idx}>
                <div style={{ fontSize: '24px', fontWeight: 800, color: '#ffffff', letterSpacing: '-0.02em' }}>{stat.val}</div>
                <div style={{ fontSize: '10px', textTransform: 'uppercase', color: tokens.neutral, marginTop: '4px', letterSpacing: '0.05em', fontFamily: 'var(--font-mono, monospace)' }}>{stat.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Column preview dashboard */}
        <div style={{ position: 'relative' }}>
          {/* Subtle backglow */}
          <div style={{
            position: 'absolute',
            width: '300px',
            height: '300px',
            background: `radial-gradient(circle, ${tokens.primary}20, transparent 70%)`,
            top: '-50px',
            right: '-50px',
            zIndex: 1
          }} />

          {/* macOS Mock Window */}
          <div className="glass-panel" style={{
            position: 'relative',
            zIndex: 2,
            borderRadius: '16px',
            background: 'rgba(20, 21, 26, 0.85)',
            border: '1.5px solid rgba(255, 255, 255, 0.08)',
            boxShadow: '0 30px 60px rgba(0, 0, 0, 0.4)',
            overflow: 'hidden',
            padding: '24px'
          }}>
            {/* macOS Window Controls */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <div style={{ display: 'flex', gap: '8px' }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#ff5f56', display: 'inline-block' }} />
                <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#ffbd2e', display: 'inline-block' }} />
                <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#27c93f', display: 'inline-block' }} />
              </div>
              <div style={{ fontSize: '11px', fontFamily: 'var(--font-mono, monospace)', color: tokens.neutral }}>optiagent_dashboard.py</div>
              <div style={{
                fontSize: '11px',
                color: tokens.tertiary,
                background: 'rgba(34, 197, 94, 0.08)',
                padding: '2px 8px',
                borderRadius: '100px',
                fontWeight: 600,
                fontFamily: 'var(--font-mono, monospace)',
                transition: 'all 0.2s ease'
              }}>
                {tickerVal}% ↑
              </div>
            </div>

            {/* Best Model card */}
            <div style={{
              background: `linear-gradient(135deg, ${tokens.primary}10, ${tokens.secondary}10)`,
              border: `1.5px solid ${tokens.secondary}30`,
              borderRadius: '12px',
              padding: '16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '20px',
              boxShadow: '0 4px 20px rgba(124, 77, 255, 0.05)',
              transition: 'all 0.3s ease'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <span style={{ fontSize: '28px' }}>🏆</span>
                <div>
                  <div style={{ fontSize: '10px', textTransform: 'uppercase', color: tokens.primary, fontWeight: 700, letterSpacing: '0.08em', fontFamily: 'var(--font-mono, monospace)' }}>Best Model</div>
                  <div style={{ fontSize: '18px', fontWeight: 800, marginTop: '2px', color: '#ffffff', transition: 'all 0.2s ease' }}>
                    {activeModelIndex === 0 ? 'Logistic Regression' : activeModelIndex === 1 ? 'Decision Tree' : activeModelIndex === 2 ? 'XGBoost' : activeModelIndex === 3 ? 'Gradient Boosting' : 'Random Forest'}
                  </div>
                </div>
              </div>
              <div style={{ fontSize: '24px', fontWeight: 900, color: tokens.tertiary, transition: 'all 0.2s ease' }}>
                {tickerVal}%
              </div>
            </div>

            {/* Accuracy Comparison */}
            <div style={{ marginBottom: '24px' }}>
              <div style={{ fontSize: '10px', textTransform: 'uppercase', color: tokens.neutral, fontWeight: 700, letterSpacing: '0.08em', fontFamily: 'var(--font-mono, monospace)', marginBottom: '12px' }}>
                Accuracy — All Models
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {[
                  { name: 'LR', val: 87.9, color: tokens.primary },
                  { name: 'DT', val: 91.3, color: tokens.primary },
                  { name: 'XGB', val: 95.4, color: tokens.secondary },
                  { name: 'GB', val: 96.2, color: tokens.secondary },
                  { name: 'RF', val: 97.8, color: tokens.tertiary }
                ].map((item, idx) => {
                  const currentWidth = Math.min(item.val, Math.max(0, (animProgress / 85) * item.val));
                  const isHighlighted = idx === activeModelIndex;
                  return (
                    <div key={idx} style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '4px 8px',
                      borderRadius: '6px',
                      backgroundColor: isHighlighted ? 'rgba(255, 255, 255, 0.04)' : 'transparent',
                      border: isHighlighted ? '1px solid rgba(255, 255, 255, 0.06)' : '1px solid transparent',
                      transition: 'all 0.25s ease'
                    }}>
                      <span style={{ width: '32px', fontSize: '11px', fontFamily: 'var(--font-mono, monospace)', color: isHighlighted ? '#ffffff' : tokens.neutral, fontWeight: isHighlighted ? 700 : 400 }}>{item.name}</span>
                      <div style={{ flex: 1, height: '6px', background: 'rgba(255,255,255,0.03)', borderRadius: '3px', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${currentWidth}%`, backgroundColor: isHighlighted ? tokens.secondary : item.color, borderRadius: '3px', transition: 'width 0.1s linear, background-color 0.2s ease' }} />
                      </div>
                      <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono, monospace)', fontWeight: 600, minWidth: '42px', textAlign: 'right' }}>
                        {currentWidth.toFixed(1)}%
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Confusion Matrix preview */}
            <div>
              <div style={{ fontSize: '10px', textTransform: 'uppercase', color: tokens.neutral, fontWeight: 700, letterSpacing: '0.08em', fontFamily: 'var(--font-mono, monospace)', marginBottom: '10px' }}>
                Confusion Matrix
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                {[
                  { label: 'TN', val: 12177, color: tokens.tertiary, isError: false },
                  { label: 'FP', val: 156, color: '#f59e0b', isError: true },
                  { label: 'FN', val: 54, color: '#ef4444', isError: true },
                  { label: 'TP', val: 2847, color: tokens.tertiary, isError: false }
                ].map((m, idx) => {
                  const currentVal = Math.floor((Math.min(85, animProgress) / 85) * m.val);
                  return (
                    <div key={idx} style={{
                      padding: '8px 12px',
                      background: m.isError ? 'rgba(239, 68, 68, 0.03)' : 'rgba(34, 197, 94, 0.03)',
                      border: m.isError ? '1px solid rgba(239, 68, 68, 0.12)' : '1px solid rgba(34, 197, 94, 0.12)',
                      borderRadius: '6px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      transition: 'all 0.2s ease'
                    }}>
                      <span style={{ fontSize: '11px', color: tokens.neutral }}>{m.label}</span>
                      <strong style={{ fontSize: '13px', color: m.color }}>{currentVal.toLocaleString()}</strong>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── WORKFLOW SECTION ─── */}
      <section id="workflow" style={{
        background: 'rgba(13, 14, 18, 0.4)',
        borderTop: '1px solid rgba(255, 255, 255, 0.03)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.03)',
        padding: '100px 24px'
      }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          {/* Header */}
          <div style={{ textAlign: 'center', marginBottom: '64px' }}>
            <span style={{
              fontSize: '11px',
              fontFamily: 'var(--font-mono, monospace)',
              color: tokens.secondary,
              letterSpacing: '0.15em',
              textTransform: 'uppercase',
              fontWeight: 700
            }}>
              Workflow
            </span>
            <h2 style={{
              fontSize: '40px',
              fontWeight: 900,
              letterSpacing: '-0.02em',
              lineHeight: '1.25',
              marginTop: '12px',
              marginBottom: '16px'
            }}>
              SIX STEPS. ONE TRAINED MODEL.
            </h2>
            <p style={{
              fontSize: '16px',
              color: tokens.neutral,
              maxWidth: '540px',
              margin: '0 auto',
              lineHeight: '24px'
            }}>
              From raw spreadsheet to production-ready model — the entire pipeline takes under ten minutes.
            </p>
          </div>

          {/* Workflow steps cards grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '24px',
            marginBottom: '48px'
          }} className="grid-2col">
            {[
              {
                num: '01',
                title: 'Upload CSV',
                desc: 'Drop any spreadsheet — sales, fraud, churn, health data. The system auto-detects every column and data type instantly.',
                icon: (
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={tokens.primary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="17 8 12 3 7 8" />
                    <line x1="12" y1="3" x2="12" y2="15" />
                  </svg>
                )
              },
              {
                num: '02',
                title: 'Choose Target',
                desc: 'Pick the column you want to predict. One click and everything else becomes an input feature automatically.',
                icon: (
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={tokens.primary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <circle cx="12" cy="12" r="6" />
                    <circle cx="12" cy="12" r="2" />
                  </svg>
                )
              },
              {
                num: '03',
                title: 'Run AutoML',
                desc: 'Hit one button. Five algorithms compete in parallel — Random Forest, XGBoost, Gradient Boosting, and more.',
                icon: (
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={tokens.primary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="2" width="20" height="8" rx="2" ry="2" />
                    <rect x="2" y="14" width="20" height="8" rx="2" ry="2" />
                    <line x1="6" y1="6" x2="6.01" y2="6" />
                    <line x1="6" y1="18" x2="6.01" y2="18" />
                  </svg>
                )
              },
              {
                num: '04',
                title: 'Read Leaderboard',
                desc: 'Get ranked results instantly. Accuracy, Precision, Recall, F1 — every metric shown with visual charts you can act on.',
                icon: (
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={tokens.secondary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
                    <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
                    <path d="M4 22h16" />
                    <path d="M10 14.66V17c0 .55-.45 1-1 1H4v2h16v-2h-5c-.55 0-1-.45-1-1v-2.34" />
                    <path d="M12 2a4 4 0 0 1 4 4v7.38a2 2 0 0 1-1.07 1.76l-2.22 1.1a1 1 0 0 1-.85 0l-2.22-1.1A2 2 0 0 1 8 13.38V6a4 4 0 0 1 4-4z" />
                  </svg>
                )
              },
              {
                num: '05',
                title: 'Test Predictions',
                desc: 'Open the Predict tab and run the model against your own inputs in real-time. See which features drove each decision.',
                icon: (
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={tokens.secondary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                    <line x1="12" y1="9" x2="12" y2="13" />
                    <line x1="12" y1="17" x2="12.01" y2="17" />
                  </svg>
                )
              },
              {
                num: '06',
                title: 'Export & Deploy',
                desc: 'Download a ready-to-run ZIP: model binary, inference script, requirements, and a README. Deploy on any Python machine.',
                icon: (
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={tokens.secondary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="21 16 12 21 3 16" />
                    <polyline points="21 12 12 17 3 12" />
                    <polygon points="12 2 22 7 12 12 2 7" />
                  </svg>
                )
              }
            ].map((step, idx) => (
              <div key={idx} className="glass-panel" style={{
                position: 'relative',
                borderRadius: '12px',
                border: '1.5px solid rgba(255, 255, 255, 0.04)',
                background: 'rgba(255, 255, 255, 0.01)',
                padding: '32px 24px',
                overflow: 'hidden',
                transition: 'all 0.3s ease',
                cursor: 'default'
              }}
              onMouseEnter={e => {
                e.currentTarget.style.transform = 'translateY(-4px)';
                e.currentTarget.style.borderColor = `${tokens.primary}40`;
                e.currentTarget.style.background = `${tokens.primary}05`;
              }}
              onMouseLeave={e => {
                e.currentTarget.style.transform = 'none';
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.04)';
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.01)';
              }}>
                {/* Huge back number */}
                <div style={{
                  position: 'absolute',
                  right: '16px',
                  top: '12px',
                  fontSize: '64px',
                  fontWeight: 900,
                  color: 'rgba(255,255,255,0.02)',
                  fontFamily: 'var(--font-mono, monospace)',
                  pointerEvents: 'none'
                }}>
                  {step.num}
                </div>

                {/* Icon wrapper */}
                <div style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '10px',
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: '20px'
                }}>
                  {step.icon}
                </div>

                <h3 style={{ fontSize: '18px', fontWeight: 700, margin: '0 0 10px 0', color: '#ffffff' }}>
                  {step.title}
                </h3>
                <p style={{ fontSize: '13px', color: tokens.neutral, lineHeight: '20px', margin: 0 }}>
                  {step.desc}
                </p>
              </div>
            ))}
          </div>

          {/* Try CTA */}
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: '40px' }}>
            <button
              onClick={() => handleWorkflowAction('workspace')}


              className="launch-btn-glow"
              style={{
                background: `linear-gradient(135deg, ${tokens.primary}, ${tokens.secondary})`,
                border: 'none',
                borderRadius: '10px',
                color: '#ffffff',
                fontSize: '15px',
                fontWeight: 600,
                padding: '14px 32px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                transition: 'all 0.3s ease',
                boxShadow: `0 4px 25px ${tokens.secondary}40`
              }}
            >
              <span>▶</span>
              TRY IT NOW – FREE
            </button>
          </div>
        </div>
      </section>

      {/* ─── CAPABILITIES SECTION ─── */}
      <section id="features" style={{
        maxWidth: '1200px',
        margin: '0 auto',
        padding: '100px 24px'
      }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '64px' }}>
          <span style={{
            fontSize: '11px',
            fontFamily: 'var(--font-mono, monospace)',
            color: tokens.tertiary,
            letterSpacing: '0.15em',
            textTransform: 'uppercase',
            fontWeight: 700
          }}>
            Capabilities
          </span>
          <h2 style={{
            fontSize: '40px',
            fontWeight: 900,
            letterSpacing: '-0.02em',
            lineHeight: '1.25',
            marginTop: '12px',
            marginBottom: '16px'
          }}>
            EVERYTHING YOU NEED. NOTHING YOU DON'T.
          </h2>
        </div>

        {/* Feature Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '24px'
        }} className="grid-2col">
          {[
            {
              title: '5 Algorithms in One Click',
              desc: 'Logistic Regression, Decision Tree, Random Forest, Gradient Boosting, and XGBoost — all trained and ranked automatically.',
              icon: '⚙️'
            },
            {
              title: 'Visual Analytics Suite',
              desc: 'Feature importance, ROC curves, grouped precision/recall charts, and accuracy comparisons — no BI tool needed.',
              icon: '📊'
            },
            {
              title: 'Confusion Matrix',
              desc: 'Full TP/FP/TN/FN breakdown with color-coded cells and derived metrics: Accuracy, Precision, Recall, Specificity.',
              icon: '🔢'
            },
            {
              title: 'Real-Time Prediction Sandbox',
              desc: 'Type in any values and run the winning model live. Every prediction comes with a decision-factor explanation.',
              icon: '🧪'
            },
            {
              title: 'Secured Local Compute',
              desc: 'All training and inference runs securely on your local server. Your data never leaves your secure system.',
              icon: '🔒'
            },
            {
              title: 'One-Click Export',
              desc: 'Download a production-ready ZIP with model.pkl, predict.py, requirements.txt, and full usage instructions.',
              icon: '📦'
            }
          ].map((feat, idx) => (
            <div key={idx} className="glass-panel" style={{
              borderRadius: '12px',
              border: '1px solid rgba(255, 255, 255, 0.04)',
              background: 'rgba(20, 21, 26, 0.4)',
              padding: '28px',
              transition: 'all 0.25s ease'
            }}
            onMouseEnter={e => {
              e.currentTarget.style.borderColor = `${tokens.tertiary}40`;
              e.currentTarget.style.background = `${tokens.tertiary}05`;
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.04)';
              e.currentTarget.style.background = 'rgba(20, 21, 26, 0.4)';
            }}>
              <span style={{ fontSize: '24px', display: 'inline-block', marginBottom: '16px' }}>{feat.icon}</span>
              <h3 style={{ fontSize: '17px', fontWeight: 700, margin: '0 0 8px 0', color: '#ffffff' }}>{feat.title}</h3>
              <p style={{ fontSize: '13px', color: tokens.neutral, lineHeight: '20px', margin: 0 }}>{feat.desc}</p>
            </div>
          ))}
        </div>
      </section>


      {/* ─── AUTHENTICATION MODAL ─── */}
      {showAuthModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(8, 9, 12, 0.8)',
          backdropFilter: 'blur(12px)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 9999
        }}>
          <div style={{
            background: 'rgba(22, 23, 30, 0.95)',
            border: '1.5px solid rgba(255, 255, 255, 0.08)',
            boxShadow: '0 24px 64px rgba(0, 0, 0, 0.7), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
            borderRadius: '16px',
            padding: '40px',
            width: '100%',
            maxWidth: '400px',
            position: 'relative',
            display: 'flex',
            flexDirection: 'column',
            gap: '24px'
          }}>
            {/* Close Button */}
            <button
              onClick={() => setShowAuthModal(false)}
              style={{
                position: 'absolute',
                top: '16px',
                right: '16px',
                background: 'none',
                border: 'none',
                color: 'rgba(255, 255, 255, 0.4)',
                fontSize: '24px',
                cursor: 'pointer',
                transition: 'color 0.2s'
              }}
              onMouseEnter={e => (e.currentTarget.style.color = '#ffffff')}
              onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255, 255, 255, 0.4)')}
            >
              &times;
            </button>

            {/* Header */}
            <div style={{ textAlign: 'center' }}>
              <h2 style={{
                fontSize: '24px',
                fontWeight: 800,
                margin: '0 0 8px 0',
                background: 'linear-gradient(90deg, #ffffff, #c7d2fe)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent'
              }}>
                {authMode === 'login' ? 'Welcome Back' : 'Create Account'}
              </h2>
              <p style={{ fontSize: '13px', color: tokens.neutral, margin: 0 }}>
                {authMode === 'login' 
                  ? 'Sign in to access your machine learning workspace' 
                  : 'Start training models in minutes with OptiAgent.ML'}
              </p>
            </div>

            {/* Form */}
            <form onSubmit={handleAuthSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {authError && (
                <div style={{
                  background: 'rgba(234, 67, 53, 0.1)',
                  border: '1px solid rgba(234, 67, 53, 0.25)',
                  borderRadius: '8px',
                  padding: '12px',
                  color: '#ea4335',
                  fontSize: '13px',
                  fontWeight: 500,
                  textAlign: 'center'
                }}>
                  ⚠️ {authError}
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'rgba(255, 255, 255, 0.6)' }}>
                  EMAIL ADDRESS
                </label>
                <input
                  type="email"
                  placeholder="name@company.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  style={{
                    background: 'rgba(255, 255, 255, 0.02)',
                    border: '1.5px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: '8px',
                    padding: '12px 16px',
                    color: '#ffffff',
                    fontSize: '14px',
                    outline: 'none',
                    transition: 'all 0.2s'
                  }}
                  onFocus={e => {
                    e.currentTarget.style.borderColor = tokens.primary;
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.04)';
                  }}
                  onBlur={e => {
                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)';
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.02)';
                  }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'rgba(255, 255, 255, 0.6)' }}>
                  PASSWORD
                </label>
                <input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  style={{
                    background: 'rgba(255, 255, 255, 0.02)',
                    border: '1.5px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: '8px',
                    padding: '12px 16px',
                    color: '#ffffff',
                    fontSize: '14px',
                    outline: 'none',
                    transition: 'all 0.2s'
                  }}
                  onFocus={e => {
                    e.currentTarget.style.borderColor = tokens.primary;
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.04)';
                  }}
                  onBlur={e => {
                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)';
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.02)';
                  }}
                />
              </div>

              {/* Submit button */}
              <button
                type="submit"
                disabled={authLoading}
                className="launch-btn-glow"
                style={{
                  background: `linear-gradient(135deg, ${tokens.primary}, ${tokens.secondary})`,
                  border: 'none',
                  borderRadius: '8px',
                  color: '#ffffff',
                  fontSize: '14px',
                  fontWeight: 600,
                  padding: '14px',
                  cursor: authLoading ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  gap: '8px',
                  transition: 'all 0.2s',
                  boxShadow: `0 4px 20px ${tokens.secondary}30`,
                  marginTop: '8px'
                }}
              >
                {authLoading ? (
                  <>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style={{ animation: 'spin 1s linear infinite' }}>
                      <circle cx="12" cy="12" r="10" stroke="rgba(255,255,255,0.2)" strokeWidth="3" />
                      <path d="M12 2a10 10 0 0 1 10 10" stroke="#ffffff" strokeWidth="3" strokeLinecap="round" />
                    </svg>
                    Signing in...
                  </>
                ) : (
                  authMode === 'login' ? 'Sign In' : 'Create Account'
                )}
              </button>
            </form>

            {/* Toggle Mode */}
            <div style={{ textAlign: 'center', fontSize: '13px', color: tokens.neutral }}>
              {authMode === 'login' ? (
                <>
                  Don't have an account?{' '}
                  <span
                    onClick={() => setAuthMode('signup')}
                    style={{ color: tokens.primary, cursor: 'pointer', fontWeight: 600 }}
                  >
                    Sign Up
                  </span>
                </>
              ) : (
                <>
                  Already have an account?{' '}
                  <span
                    onClick={() => setAuthMode('login')}
                    style={{ color: tokens.primary, cursor: 'pointer', fontWeight: 600 }}
                  >
                    Sign In
                  </span>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Glow Button Animation Styles */}
      <style jsx global>{`
        .launch-btn-glow:hover {
          transform: translateY(-1px);
          box-shadow: 0 8px 30px ${tokens.secondary}60 !important;
        }
        .launch-btn-glow:active {
          transform: translateY(0);
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @media (max-width: 1024px) {
          .desktop-only {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
}
