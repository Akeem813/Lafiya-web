import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';

const tokenGroups = [
  {
    group: 'Surface Tokens',
    description: 'Background containers, cards, and canvas layers',
    tokens: [
      { name: '--color-surface-primary', light: '#FFFFFF', dark: '#0B1120' },
      { name: '--color-surface-secondary', light: '#F8FAFC', dark: '#111827' },
      { name: '--color-surface-muted', light: '#F1F5F9', dark: '#1F2937' },
      { name: '--color-surface-inverse', light: '#0F172A', dark: '#F9FAFB' },
    ],
  },
  {
    group: 'Text Tokens',
    description: 'Hierarchical typography and accessible copy',
    tokens: [
      { name: '--color-text-primary', light: '#0F172A', dark: '#F9FAFB' },
      { name: '--color-text-secondary', light: '#475569', dark: '#D1D5DB' },
      { name: '--color-text-muted', light: '#64748B', dark: '#9CA3AF' },
      { name: '--color-text-inverse', light: '#FFFFFF', dark: '#111827' },
    ],
  },
  {
    group: 'Feedback & Severity Tokens',
    description: 'Emergency, validation, and warning indicators',
    tokens: [
      { name: '--color-verified-base', light: '#059669', dark: '#10B981' },
      { name: '--color-verified-surface', light: '#ECFDF5', dark: '#064E3B' },
      { name: '--color-danger-base', light: '#DC2626', dark: '#EF4444' },
      { name: '--color-danger-surface', light: '#FEF2F2', dark: '#450A0A' },
      { name: '--color-warning-base', light: '#D97706', dark: '#F59E0B' },
      { name: '--color-warning-surface', light: '#FFFBEB', dark: '#451A03' },
    ],
  },
];

function TokensDoc() {
  return (
    <div style={{ padding: '2rem', fontFamily: 'system-ui, sans-serif' }}>
      <h1>Lafiya Semantic Design Tokens</h1>
      <p style={{ color: '#475569', maxWidth: '640px' }}>
        Single source of truth for semantic surface, text, danger, verified, and warning design tokens across themes.
      </p>

      {tokenGroups.map((g) => (
        <section key={g.group} style={{ marginTop: '2.5rem' }}>
          <h2>{g.group}</h2>
          <p style={{ color: '#64748B', fontSize: '0.875rem' }}>{g.description}</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem', marginTop: '1rem' }}>
            {g.tokens.map((t) => (
              <div
                key={t.name}
                style={{
                  border: '1px solid #E2E8F0',
                  borderRadius: '0.5rem',
                  padding: '1rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '1rem',
                }}
              >
                <div
                  style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '0.375rem',
                    backgroundColor: t.light,
                    border: '1px solid #CBD5E1',
                  }}
                />
                <div>
                  <code style={{ fontSize: '0.8rem', fontWeight: 600 }}>{t.name}</code>
                  <div style={{ fontSize: '0.75rem', color: '#64748B' }}>Light: {t.light} | Dark: {t.dark}</div>
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

const meta: Meta = {
  title: 'Design System/Tokens',
  component: TokensDoc,
};

export default meta;
type Story = StoryObj;

export const Default: Story = {};
