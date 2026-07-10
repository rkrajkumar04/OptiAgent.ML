'use client';

import React from 'react';
import Link from 'next/link';

export default function PrivacyPage() {
  return (
    <div style={{
      minHeight: '100vh',
      background: 'radial-gradient(circle at top left, #0e121e 0%, #08090c 70%)',
      color: '#f8f9fa',
      padding: '80px 24px 120px 24px',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center'
    }}>
      <div style={{ maxWidth: '800px', width: '100%', display: 'flex', flexDirection: 'column', gap: '32px' }}>
        {/* Back Link */}
        <div>
          <Link href="/" style={{
            color: '#4F8CFF',
            textDecoration: 'none',
            fontSize: '14px',
            fontWeight: 600,
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            ← Back to Home
          </Link>
        </div>

        {/* Header */}
        <div>
          <h1 style={{
            fontSize: '40px',
            fontWeight: 900,
            background: 'linear-gradient(135deg, #ffffff 30%, #a5b4fc 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            margin: '0 0 12px 0',
            letterSpacing: '-0.03em'
          }}>
            Privacy Policy
          </h1>
          <p style={{ color: '#75777F', fontSize: '15px', lineHeight: '24px', margin: 0 }}>
            Your privacy and dataset security are our highest priority.
          </p>
        </div>

        {/* Content Panel */}
        <div style={{
          background: 'rgba(255, 255, 255, 0.03)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '16px',
          padding: '40px',
          backdropFilter: 'blur(16px)',
          display: 'flex',
          flexDirection: 'column',
          gap: '32px'
        }}>
          {/* Section 1 */}
          <section>
            <h2 style={{ fontSize: '20px', fontWeight: 700, margin: '0 0 12px 0', color: '#ffffff' }}>1. Data Storage & Uploads</h2>
            <p style={{ color: '#abb2bf', fontSize: '14px', lineHeight: '24px', margin: 0 }}>
              Any dataset CSV files uploaded to OptiAgent.ML are stored strictly on our secure local node server and are only accessed for executing machine learning sandbox scripts. We do not sell, rent, or distribute your datasets to third parties.
            </p>
          </section>

          {/* Section 2 */}
          <section style={{ borderTop: '1px solid rgba(255, 255, 255, 0.08)', paddingTop: '24px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: 700, margin: '0 0 12px 0', color: '#ffffff' }}>2. Cookies & State Persistence</h2>
            <p style={{ color: '#abb2bf', fontSize: '14px', lineHeight: '24px', margin: 0 }}>
              We use standard browser local storage configurations to preserve workspace progress, active wizard step indices, and session login flags across page refreshes.
            </p>
          </section>

          {/* Section 3 */}
          <section style={{ borderTop: '1px solid rgba(255, 255, 255, 0.08)', paddingTop: '24px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: 700, margin: '0 0 12px 0', color: '#ffffff' }}>3. Analytics & Telemetry Anonymization</h2>
            <p style={{ color: '#abb2bf', fontSize: '14px', lineHeight: '24px', margin: 0 }}>
              Usage telemetry logs (like login records) are processed securely. In order to protect user confidentiality, email logs returned via public APIs are automatically masked (e.g. <code>u***r@domain.com</code>) to prevent scraping or identity exposure.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
