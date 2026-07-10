'use client';

import { useEffect, useState } from 'react';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';

interface KeyStatus {
  configured: boolean;
  count: number;
}

export default function SettingsPage() {
  const [keyStatus, setKeyStatus] = useState<KeyStatus | null>(null);
  const [keysInput, setKeysInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchKeyStatus = async () => {
    try {
      const res = await fetch(`${API}/api/settings/keys`);
      if (res.ok) setKeyStatus(await res.json());
    } catch (_) { /* backend offline */ }
  };

  useEffect(() => { fetchKeyStatus(); }, []);

  const saveKeys = async () => {
    const keys = keysInput.split('\n').map(k => k.trim()).filter(Boolean);
    if (keys.length === 0) return setMsg({ type: 'error', text: 'Please enter at least one API key.' });
    setSaving(true); setMsg(null);
    try {
      const res = await fetch(`${API}/api/settings/keys`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keys }),
      });
      if (!res.ok) throw new Error((await res.json()).detail || 'Failed to save keys');
      setMsg({ type: 'success', text: `✅ ${keys.length} key${keys.length > 1 ? 's' : ''} saved successfully.` });
      setKeysInput('');
      fetchKeyStatus();
    } catch (e: unknown) {
      setMsg({ type: 'error', text: `❌ ${e instanceof Error ? e.message : 'Error saving keys'}` });
    } finally {
      setSaving(false);
    }
  };

  const testConnection = async () => {
    setTesting(true); setMsg(null);
    try {
      const res = await fetch(`${API}/api/settings/keys/test`, { method: 'POST' });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || 'Test failed');
      }
      const data = await res.json();
      setMsg({ type: 'success', text: `✅ Connection successful! Model responded: "${data.response?.slice(0, 80)}..."` });
    } catch (e: unknown) {
      setMsg({ type: 'error', text: `❌ ${e instanceof Error ? e.message : 'Connection test failed'}` });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div style={{ padding: '36px 32px', maxWidth: '760px', margin: '0 auto', width: '100%' }}>

      {/* Header */}
      <div style={{ marginBottom: '36px' }}>
        <h1 style={{ fontSize: '28px', fontWeight: 700, letterSpacing: '-0.02em', marginBottom: '6px' }}>
          Settings
        </h1>
        <p style={{ color: 'var(--on-surface-variant)', fontSize: '14px' }}>
          Manage your Gemini API keys and system configuration.
        </p>
      </div>

      {/* Key Status Card */}
      <div className="glass-panel animate-slide-up" style={{
        borderRadius: '14px', padding: '24px', marginBottom: '20px',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h2 style={{ fontSize: '16px', fontWeight: 700 }}>🔑 Gemini API Keys</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{
              width: '8px', height: '8px', borderRadius: '50%', display: 'inline-block',
              backgroundColor: keyStatus?.configured ? '#4ade80' : '#f87171',
              animation: keyStatus?.configured ? 'pulse 2s infinite' : 'none',
            }} />
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: keyStatus?.configured ? '#4ade80' : '#f87171', textTransform: 'uppercase' }}>
              {keyStatus?.configured ? `${keyStatus.count} key${keyStatus.count > 1 ? 's' : ''} configured` : 'No keys'}
            </span>
          </div>
        </div>

        <p style={{ color: 'var(--on-surface-variant)', fontSize: '13px', lineHeight: '20px', marginBottom: '20px' }}>
          The AI agent uses Gemini API keys to power its reasoning loop. You can add multiple keys —
          the system will automatically rotate between them if a key hits its rate limit.
        </p>

        {/* Input */}
        <div style={{ marginBottom: '16px' }}>
          <label style={{
            display: 'block', marginBottom: '8px',
            fontFamily: 'var(--font-mono)', fontSize: '12px',
            color: 'var(--on-surface-variant)', textTransform: 'uppercase', letterSpacing: '0.05em',
          }}>
            Paste API Keys (one per line)
          </label>
          <textarea
            value={keysInput}
            onChange={e => setKeysInput(e.target.value)}
            placeholder="AIza...&#10;AIza...&#10;AIza..."
            rows={5}
            style={{
              width: '100%', padding: '12px 14px',
              borderRadius: '8px', border: '1px solid var(--outline-variant)',
              background: 'rgba(4,14,31,0.65)', color: 'var(--on-surface)',
              fontFamily: 'var(--font-mono)', fontSize: '13px',
              resize: 'vertical', outline: 'none',
              transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
            }}
            onFocus={e => {
              e.target.style.borderColor = 'var(--primary-fixed-dim)';
              e.target.style.boxShadow = '0 0 0 3px rgba(0,219,233,0.12)';
            }}
            onBlur={e => {
              e.target.style.borderColor = 'var(--outline-variant)';
              e.target.style.boxShadow = 'none';
            }}
          />
          <p style={{ fontSize: '12px', color: 'var(--on-surface-variant)', marginTop: '6px', fontFamily: 'var(--font-mono)' }}>
            Get free keys at <a href="https://aistudio.google.com" target="_blank" rel="noreferrer" style={{ color: 'var(--primary-fixed-dim)' }}>aistudio.google.com</a>
          </p>
        </div>

        {/* Message */}
        {msg && (
          <div style={{
            padding: '10px 14px', borderRadius: '8px', fontSize: '13px', marginBottom: '16px',
            background: msg.type === 'success' ? 'rgba(74,222,128,0.08)' : 'rgba(255,71,71,0.08)',
            border: `1px solid ${msg.type === 'success' ? 'rgba(74,222,128,0.25)' : 'rgba(255,71,71,0.25)'}`,
            color: msg.type === 'success' ? '#4ade80' : '#f87171',
            fontFamily: 'var(--font-mono)',
          }}>
            {msg.text}
          </div>
        )}

        {/* Buttons */}
        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            onClick={saveKeys}
            disabled={saving || !keysInput.trim()}
            style={{
              flex: 1, padding: '11px', borderRadius: '8px', border: 'none',
              background: 'var(--primary-container)', color: 'var(--on-primary-container)',
              fontFamily: 'var(--font-ui)', fontSize: '14px', fontWeight: 700,
              cursor: saving || !keysInput.trim() ? 'not-allowed' : 'pointer',
              opacity: saving || !keysInput.trim() ? 0.5 : 1,
              transition: 'filter 0.2s',
            }}
            onMouseEnter={e => { if (!saving) e.currentTarget.style.filter = 'brightness(1.15)'; }}
            onMouseLeave={e => { e.currentTarget.style.filter = ''; }}
          >
            {saving ? '⏳ Saving...' : '💾 Save Keys'}
          </button>

          <button
            onClick={testConnection}
            disabled={testing || !keyStatus?.configured}
            style={{
              padding: '11px 22px', borderRadius: '8px',
              border: '1px solid var(--outline-variant)',
              background: 'transparent', color: 'var(--on-surface-variant)',
              fontFamily: 'var(--font-ui)', fontSize: '14px', fontWeight: 600,
              cursor: testing || !keyStatus?.configured ? 'not-allowed' : 'pointer',
              opacity: testing || !keyStatus?.configured ? 0.5 : 1,
              transition: 'border-color 0.2s, color 0.2s',
            }}
            onMouseEnter={e => {
              if (!testing && keyStatus?.configured) {
                e.currentTarget.style.borderColor = 'var(--primary-fixed-dim)';
                e.currentTarget.style.color = 'var(--primary-fixed-dim)';
              }
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = 'var(--outline-variant)';
              e.currentTarget.style.color = 'var(--on-surface-variant)';
            }}
          >
            {testing ? '⏳ Testing...' : '🔌 Test Connection'}
          </button>
        </div>
      </div>

      {/* Info Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        {[
          {
            title: '🔄 Key Rotation',
            desc: 'When a key hits its free-tier rate limit (429 error), the system automatically switches to the next available key — zero downtime.',
          },
          {
            title: '🔒 Security',
            desc: 'Keys are stored server-side in the SQLite database. They are never exposed in the browser, URLs, or frontend JavaScript.',
          },
          {
            title: '⚡ Rate Limits',
            desc: 'Gemini Flash free tier: 15 requests/minute per key. Adding 3+ keys effectively gives you 45 requests/minute.',
          },
          {
            title: '🆓 Free Keys',
            desc: 'Get free API keys at Google AI Studio (aistudio.google.com). No credit card required. Up to 1,500 free requests/day per key.',
          },
        ].map((card, i) => (
          <div key={i} className="glass-panel animate-fade-in" style={{
            borderRadius: '12px', padding: '18px',
            animationDelay: `${i * 0.1}s`,
          }}>
            <div style={{ fontSize: '14px', fontWeight: 700, marginBottom: '8px' }}>{card.title}</div>
            <p style={{ fontSize: '13px', color: 'var(--on-surface-variant)', lineHeight: '19px' }}>{card.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
