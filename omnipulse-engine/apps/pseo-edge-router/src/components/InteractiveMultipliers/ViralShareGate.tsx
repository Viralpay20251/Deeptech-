import React, { useState } from 'react';

export interface ViralShareGateProps {
  toolTitle: string;
  shareUrl: string;
  shareMessage: string;
  unlockedContentTitle: string;
  onUnlocked?: () => void;
  children: React.ReactNode;
}

export function ViralShareGate({
  toolTitle,
  shareUrl,
  shareMessage,
  unlockedContentTitle,
  onUnlocked,
  children,
}: ViralShareGateProps) {
  const [unlocked, setUnlocked] = useState<boolean>(false);
  const [sharesCount, setSharesCount] = useState<number>(0);

  const handleShareClick = (platform: 'whatsapp' | 'linkedin') => {
    let target = '';
    const encodedUrl = encodeURIComponent(shareUrl);
    const encodedText = encodeURIComponent(shareMessage);

    if (platform === 'whatsapp') {
      target = `https://api.whatsapp.com/send?text=${encodedText}%20${encodedUrl}`;
    } else {
      target = `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`;
    }

    if (typeof window !== 'undefined') {
      window.open(target, '_blank', 'width=600,height=500');
    }

    setSharesCount((prev) => prev + 1);
    setUnlocked(true);
    onUnlocked?.();
  };

  if (unlocked) {
    return (
      <div className="viral-unlocked-section" style={{ marginTop: '16px' }}>
        <div style={{ backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', padding: '12px 16px', marginBottom: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '13px', fontWeight: 600, color: '#166534' }}>
            🎉 <strong>Full Breakdown Unlocked:</strong> {unlockedContentTitle}
          </span>
          <span style={{ fontSize: '11px', color: '#15803d', fontWeight: 700 }}>
            Viral K-Factor: 1.8x
          </span>
        </div>
        {children}
      </div>
    );
  }

  return (
    <div
      className="viral-share-gate"
      style={{
        backgroundColor: '#ffffff',
        border: '2px dashed #94a3b8',
        borderRadius: '12px',
        padding: '24px',
        textAlign: 'center',
        margin: '20px 0',
      }}
    >
      <div style={{ fontSize: '28px', marginBottom: '8px' }}>🔒</div>
      <h3 style={{ fontSize: '17px', fontWeight: 700, color: '#0f172a', marginBottom: '6px' }}>
        Unlock Full {unlockedContentTitle}
      </h3>
      <p style={{ fontSize: '13px', color: '#64748b', maxWidth: '480px', margin: '0 auto 18px auto', lineHeight: 1.5 }}>
        Share this free interactive diagnostic with 1 colleague or peer on WhatsApp or LinkedIn to instantly reveal full confidential salary percentiles, PDF downloads, and verified templates.
      </p>

      <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', flexWrap: 'wrap' }}>
        <button
          onClick={() => handleShareClick('whatsapp')}
          style={{
            backgroundColor: '#25d366',
            color: '#ffffff',
            border: 'none',
            borderRadius: '6px',
            padding: '10px 18px',
            fontSize: '13px',
            fontWeight: 700,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <span>Share to WhatsApp to Unlock</span>
        </button>

        <button
          onClick={() => handleShareClick('linkedin')}
          style={{
            backgroundColor: '#0a66c2',
            color: '#ffffff',
            border: 'none',
            borderRadius: '6px',
            padding: '10px 18px',
            fontSize: '13px',
            fontWeight: 700,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <span>Share to LinkedIn</span>
        </button>
      </div>

      <div style={{ marginTop: '12px' }}>
        <button
          onClick={() => {
            setUnlocked(true);
            onUnlocked?.();
          }}
          style={{
            background: 'none',
            border: 'none',
            fontSize: '11px',
            color: '#94a3b8',
            cursor: 'pointer',
            textDecoration: 'underline',
          }}
        >
          Skip and unlock directly
        </button>
      </div>
    </div>
  );
}
