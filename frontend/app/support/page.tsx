'use client';

import React from 'react';
import Link from 'next/link';

export default function SupportPage() {
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
            Support Desk
          </h1>
          <p style={{ color: '#75777F', fontSize: '15px', lineHeight: '24px', margin: 0 }}>
            Have questions or issues? Contact our systems administrator.
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
            <h2 style={{ fontSize: '20px', fontWeight: 700, margin: '0 0 12px 0', color: '#ffffff' }}>1. Troubleshooting Sandbox Failures</h2>
            <p style={{ color: '#abb2bf', fontSize: '14px', lineHeight: '24px', margin: 0 }}>
              If your dataset optimization loop returns a failing run code, verify that:
            </p>
            <ul style={{ color: '#abb2bf', fontSize: '14px', lineHeight: '24px', margin: '8px 0 0 20px', padding: 0 }}>
              <li>The target column contains clean values without massive ratios of null elements.</li>
              <li>You have chosen the correct target variable name (case sensitive).</li>
              <li>The CSV file fits the size constraints (downsampled automatically for fast testing).</li>
            </ul>
          </section>

          {/* Section 2 */}
          <section style={{ borderTop: '1px solid rgba(255, 255, 255, 0.08)', paddingTop: '24px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: 700, margin: '0 0 12px 0', color: '#ffffff' }}>2. Administrative Support</h2>
            <p style={{ color: '#abb2bf', fontSize: '14px', lineHeight: '24px', margin: 0 }}>
              For system inquiries, server resets, or custom integration assistance, reach out directly at:
              <br />
              <strong style={{ color: '#4F8CFF', marginTop: '8px', display: 'inline-block', fontSize: '15px' }}>
                optiagent.ml@gmail.com
              </strong>
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
