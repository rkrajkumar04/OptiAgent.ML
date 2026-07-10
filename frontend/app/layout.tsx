'use client';

import type { Metadata } from 'next';
import './globals.css';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

// ─── Shared Logo SVG ─────────────────────────────────────────────────────────
function Logo() {
  return (
    <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: '10px', textDecoration: 'none' }}>
      <svg width="32" height="32" viewBox="0 0 34 34" fill="none" xmlns="http://www.w3.org/2000/svg">
        <polygon points="17,2 30,9.5 30,24.5 17,32 4,24.5 4,9.5"
          fill="rgba(0,219,233,0.08)" stroke="#00dbe9" strokeWidth="1.2" />
        <polygon points="17,6 26.5,11.5 26.5,22.5 17,28 7.5,22.5 7.5,11.5"
          fill="none" stroke="rgba(0,219,233,0.25)" strokeWidth="0.6" />
        <circle cx="17" cy="11" r="2" fill="#00dbe9" />
        <circle cx="11" cy="20" r="2" fill="#ebb2ff" />
        <circle cx="23" cy="20" r="2" fill="#ebb2ff" />
        <line x1="17" y1="11" x2="11" y2="20" stroke="rgba(0,219,233,0.5)" strokeWidth="1" />
        <line x1="17" y1="11" x2="23" y2="20" stroke="rgba(0,219,233,0.5)" strokeWidth="1" />
        <line x1="11" y1="20" x2="23" y2="20" stroke="rgba(235,178,255,0.4)" strokeWidth="1" />
        <circle cx="17" cy="17" r="1.2" fill="rgba(0,219,233,0.6)" />
        <circle cx="17" cy="11" r="3.5" fill="none" stroke="rgba(0,219,233,0.2)" strokeWidth="0.8" />
      </svg>
      <span style={{
        fontFamily: 'var(--font-mono)', fontSize: '17px',
        fontWeight: 700, letterSpacing: '-0.01em',
        color: 'var(--primary-fixed-dim)', lineHeight: 1,
      }}>
        OPTIAGENT<span style={{ color: 'var(--secondary)', opacity: 0.85 }}>.ML</span>
      </span>
    </Link>
  );
}

// ─── Shared Navbar ────────────────────────────────────────────────────────────
const API = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';

function Navbar() {
  const pathname = usePathname();
  const [apiStatus, setApiStatus] = useState<'checking' | 'online' | 'offline'>('checking');

  useEffect(() => {
    fetch(API)
      .then(r => r.json())
      .then(d => setApiStatus(d.status === 'online' ? 'online' : 'offline'))
      .catch(() => setApiStatus('offline'));
  }, []);

  if (pathname === '/') return null;

  const isLandingSubpage = ['/documentation', '/privacy', '/terms', '/support'].includes(pathname);

  if (isLandingSubpage) {
    return (
      <nav style={{
        position: 'sticky', top: 0, zIndex: 50,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '20px 40px',
        background: 'rgba(10, 10, 13, 0.75)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
      }}>
        <Logo />

        {/* Landing Links */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '32px' }} className="desktop-only">
          {[
            { label: 'Home', href: '/' },
            { label: 'Features', href: '/#features' },
            { label: 'Workplace', href: '/?tab=workspace' },
            { label: 'About', href: '/?tab=about' },
          ].map(({ label, href }) => (
            <Link key={label} href={href} style={{
              fontSize: '14px',
              fontFamily: 'var(--font-ui)',
              color: 'rgba(255, 255, 255, 0.6)',
              textDecoration: 'none',
              fontWeight: 500,
              transition: 'color 0.2s ease',
            }}
              onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.color = '#ffffff'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.color = 'rgba(255, 255, 255, 0.6)'; }}
            >
              {label}
            </Link>
          ))}
        </div>

        {/* Action Button */}
        <div>
          <Link href="/?tab=workspace" style={{
            display: 'inline-flex', alignItems: 'center',
            padding: '8px 20px', borderRadius: '100px',
            background: 'linear-gradient(135deg, #4F8CFF, #7C4DFF)',
            color: '#ffffff',
            fontFamily: 'var(--font-ui)', fontSize: '13px', fontWeight: 600,
            textDecoration: 'none', cursor: 'pointer',
            transition: 'all 0.2s ease',
            boxShadow: '0 4px 15px rgba(124, 77, 255, 0.2)'
          }}
            onMouseEnter={e => { e.currentTarget.style.filter = 'brightness(1.1)'; }}
            onMouseLeave={e => { e.currentTarget.style.filter = ''; }}
          >
            Launch App
          </Link>
        </div>
      </nav>
    );
  }

  const navLinks = [
    { label: 'Dashboard',   href: '/dashboard' },
    { label: 'New Run',     href: '/' },
    { label: 'History',     href: '/experiments' },
    { label: 'Models',      href: '/models' },
    { label: 'Settings',    href: '/settings' },
  ];

  const statusColor =
    apiStatus === 'online' ? '#4ade80' :
    apiStatus === 'checking' ? '#fbbf24' : '#f87171';

  return (
    <nav style={{
      position: 'sticky', top: 0, zIndex: 50,
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '14px 32px',
      background: 'rgba(8,20,37,0.5)',
      backdropFilter: 'blur(20px)',
      WebkitBackdropFilter: 'blur(20px)',
      borderBottom: '1px solid rgba(255,255,255,0.08)',
      boxShadow: '0 0 15px rgba(0,219,233,0.07)',
    }}>
      <Logo />

      {/* Nav links */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '28px' }}>
        {navLinks.map(({ label, href }) => {
          const isActive = href === '/' ? pathname === '/' : pathname.startsWith(href);
          return (
            <Link key={label} href={href} style={{
              fontSize: '14px', fontFamily: 'var(--font-ui)',
              color: isActive ? 'var(--primary-fixed-dim)' : 'var(--on-surface-variant)',
              textDecoration: 'none',
              borderBottom: isActive ? '2px solid var(--primary-fixed-dim)' : '2px solid transparent',
              paddingBottom: '2px',
              transition: 'color 0.2s ease, border-color 0.2s ease',
            }}
              onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLAnchorElement).style.color = 'var(--primary)'; }}
              onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLAnchorElement).style.color = 'var(--on-surface-variant)'; }}
            >
              {label}
            </Link>
          );
        })}
      </div>

      {/* Right: status + deploy */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: '7px',
          padding: '6px 14px', borderRadius: '9999px',
          background: 'rgba(4,14,31,0.65)',
          border: '1px solid rgba(255,255,255,0.08)',
          fontFamily: 'var(--font-mono)', fontSize: '11px',
        }}>
          <span style={{
            width: '7px', height: '7px', borderRadius: '50%',
            backgroundColor: statusColor,
            animation: 'pulse 2s infinite', display: 'inline-block',
          }} />
          <span style={{ color: 'var(--on-surface-variant)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            API {apiStatus}
          </span>
        </div>

        <Link href="/" style={{
          display: 'inline-flex', alignItems: 'center', gap: '6px',
          padding: '8px 18px', borderRadius: '9999px', border: 'none',
          background: 'var(--primary-container)', color: 'var(--on-primary-container)',
          fontFamily: 'var(--font-ui)', fontSize: '13px', fontWeight: 700,
          textDecoration: 'none', cursor: 'pointer',
          transition: 'filter 0.2s ease',
        }}
          onMouseEnter={e => (e.currentTarget.style.filter = 'brightness(1.15)')}
          onMouseLeave={e => (e.currentTarget.style.filter = '')}
        >
          ▶ Deploy
        </Link>
      </div>
    </nav>
  );
}

// ─── Shared Footer ────────────────────────────────────────────────────────────
function Footer() {
  return (
    <footer style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      flexWrap: 'wrap', gap: '16px',
      padding: '20px 32px',
      borderTop: '1px solid var(--outline-variant)',
      background: 'rgba(4,14,31,0.55)',
      backdropFilter: 'blur(10px)',
      fontFamily: 'var(--font-mono)', fontSize: '12px',
      color: 'var(--on-tertiary-container)',
    }}>
      <div style={{ fontWeight: 900, fontSize: '13px', color: 'var(--on-surface)' }}>
        OPTIAGENT.ML
      </div>
      <div style={{ display: 'flex', gap: '24px' }}>
        {[
          { label: 'Documentation', path: '/documentation' },
          { label: 'Privacy', path: '/privacy' },
          { label: 'Terms', path: '/terms' },
          { label: 'Support', path: '/support' }
        ].map(link => (
          <Link key={link.label} href={link.path} style={{ color: 'inherit', textDecoration: 'none', transition: 'color 0.2s' }}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--primary-fixed-dim)')}
            onMouseLeave={e => (e.currentTarget.style.color = '')}
          >{link.label}</Link>
        ))}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--primary-fixed-dim)', animation: 'pulse 2s infinite', display: 'inline-block' }} />
        ALL SYSTEMS OPERATIONAL. &nbsp;|&nbsp; © 2025 OPTIAGENT.ML.
      </div>
    </footer>

  );
}

// ─── Root Layout ──────────────────────────────────────────────────────────────
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <title>OptiAgentML | Autonomous AI Data Science & AutoML Orchestrator</title>
        <meta name="description" content="OptiAgent.ML is an autonomous AI data science orchestrator. Execute end-to-end Machine Learning pipelines directly from CSV files with zero manual coding." />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="keywords" content="AutoML, machine learning, data science orchestrator, train models online, AI model training, linear svc, random forest classifier, dataset analysis, predictive modeling" />
        <meta name="robots" content="index, follow" />
        <link rel="canonical" href="https://optiagent.ml" />

        {/* Open Graph / Facebook */}
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://optiagent.ml/" />
        <meta property="og:title" content="OptiAgentML | Autonomous AI Data Science & AutoML Orchestrator" />
        <meta property="og:description" content="Execute end-to-end Machine Learning pipelines directly from raw CSV files. Auto-detect columns, tune hyperparameters, and download trained models in seconds." />
        <meta property="og:image" content="https://optiagent.ml/opti_agent_architecture.png" />

        {/* Twitter */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:url" content="https://optiagent.ml/" />
        <meta name="twitter:title" content="OptiAgentML | Autonomous AI Data Science & AutoML Orchestrator" />
        <meta name="twitter:description" content="Execute end-to-end Machine Learning pipelines directly from raw CSV files. Auto-detect columns, tune hyperparameters, and download trained models in seconds." />
        <meta name="twitter:image" content="https://optiagent.ml/opti_agent_architecture.png" />

        {/* Schema.org Structured Data for Google Rich Snippets */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebApplication",
              "name": "OptiAgent.ML",
              "alternateName": "OptiAgentML",
              "url": "https://optiagent.ml",
              "image": "https://optiagent.ml/opti_agent_architecture.png",
              "description": "Autonomous AI Data Science and AutoML Experiment Orchestrator. Train, tune, and export production models directly from CSV files.",
              "applicationCategory": "DeveloperApplication",
              "operatingSystem": "All",
              "browserRequirements": "Requires JavaScript. Requires HTML5.",
              "offers": {
                "@type": "Offer",
                "price": "0.00",
                "priceCurrency": "USD"
              }
            })
          }}
        />
      </head>
      <body style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
        <Navbar />
        <main style={{ flex: 1 }}>
          {children}
        </main>
        <Footer />
      </body>
    </html>
  );
}
