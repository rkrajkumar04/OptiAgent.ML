'use client';

import React from 'react';
import Link from 'next/link';

export default function DocumentationPage() {
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
            Documentation
          </h1>
          <p style={{ color: '#75777F', fontSize: '15px', lineHeight: '24px', margin: 0 }}>
            Learn how to use OptiAgent.ML to automate your machine learning workflows.
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
            <h2 style={{ fontSize: '20px', fontWeight: 700, margin: '0 0 12px 0', color: '#ffffff' }}>1. Preparing Your Dataset</h2>
            <p style={{ color: '#abb2bf', fontSize: '14px', lineHeight: '24px', margin: 0 }}>
              OptiAgent.ML processes structured tabular datasets in <strong>CSV</strong> format. Ensure your dataset has a clear header row. Categorical attributes will be auto-encoded using label encoders or one-hot vectors, and text columns will be converted using TF-IDF vectorization.
            </p>
          </section>

          {/* Section 2 */}
          <section style={{ borderTop: '1px solid rgba(255, 255, 255, 0.08)', paddingTop: '24px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: 700, margin: '0 0 12px 0', color: '#ffffff' }}>2. Running the AutoML Pipeline</h2>
            <p style={{ color: '#abb2bf', fontSize: '14px', lineHeight: '24px', margin: 0 }}>
              Once you upload your CSV file and select the target label column:
            </p>
            <ul style={{ color: '#abb2bf', fontSize: '14px', lineHeight: '24px', margin: '8px 0 0 20px', padding: 0 }}>
              <li>The agent audits the dataset for target leakage and drops proxy features.</li>
              <li>A series of classifiers/regressors (XGBoost, Random Forest, SVM) are executed.</li>
              <li>The leaderboards are computed and evaluated based on accuracy, F1-scores, or R2 metrics.</li>
            </ul>
          </section>

          {/* Section 3 */}
          <section style={{ borderTop: '1px solid rgba(255, 255, 255, 0.08)', paddingTop: '24px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: 700, margin: '0 0 12px 0', color: '#ffffff' }}>3. Model Exporting</h2>
            <p style={{ color: '#abb2bf', fontSize: '14px', lineHeight: '24px', margin: 0 }}>
              After training completes, you can download the serialized best model (in <strong>PKL</strong> format) along with Python source templates to integrate the predictions directly into your production servers.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
