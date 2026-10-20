import { useState, useEffect } from 'react';
import {
  Clock,
  Video,
  RotateCcw,
  Youtube,
  Instagram,
  Linkedin,
  Twitter,
} from 'lucide-react';
import { authFetch } from '../lib/apiClient';

export type QueueStage = 'pending' | 'media_ready' | 'scheduled' | 'posted' | 'failed';

export interface ContentQueueItem {
  id: string;
  brand: 'TalentXcel' | 'CHATR' | 'Nuty Tales' | 'TX Academy';
  brandSlug: string;
  platform: 'youtube' | 'facebook' | 'instagram' | 'twitter' | 'linkedin';
  hookLine: string;
  caption: string;
  script: string;
  firstComment: string;
  scheduledTime: string;
  stage: QueueStage;
  thumbnailUrl?: string;
  videoDurationSec?: number;
  metrics?: {
    views?: number;
    likes?: number;
    comments?: number;
    shares?: number;
  };
  failureReason?: string;
  audioVoice?: string;
}

export function ContentQueueMonitor() {
  const [items, setItems] = useState<ContentQueueItem[]>([
    {
      id: 'cq-1',
      brand: 'CHATR',
      brandSlug: 'chatr',
      platform: 'youtube',
      hookLine: 'Why asynchronous video messaging cuts 8 hours of Zoom fatigue weekly.',
      caption: 'Stop sitting through 45-minute meetings that could have been a 30-second interactive clip. #Productivity #VideoMessaging #WorkSmarter',
      script: 'Scene 1: Close up of endless calendar invites.\nScene 2: Split screen showing CHATR interactive thread.\nScene 3: "Reclaim your calendar without losing human warmth."',
      firstComment: 'Try CHATR completely free at https://chatr.chat/video-messaging — no credit card needed.',
      scheduledTime: 'Today at 16:30',
      stage: 'pending',
      audioVoice: 'en-US-GuyNeural',
      videoDurationSec: 32,
    },
    {
      id: 'cq-2',
      brand: 'TalentXcel',
      brandSlug: 'talentxcel',
      platform: 'linkedin',
      hookLine: 'The 2026 AI Infrastructure Compensation Matrix is here.',
      caption: 'We analyzed 1,400+ verified engineering offers across US, EU, and India. Key takeaway: agent orchestration engineers are out-earning traditional frontend leads by 38%.',
      script: 'Card carousel breakdown of median compensation bands across tiers and remote hubs.',
      firstComment: 'Download the complete verified benchmark sheet: https://talentxcel.in/insights/ai-salaries-2026',
      scheduledTime: 'Today at 17:00',
      stage: 'media_ready',
      thumbnailUrl: 'https://images.unsplash.com/photo-1551836022-d5d88e9218df?w=400&auto=format&fit=crop&q=80',
      videoDurationSec: 45,
    },
    {
      id: 'cq-3',
      brand: 'Nuty Tales',
      brandSlug: 'nuty-tales',
      platform: 'instagram',
      hookLine: 'Did you know standard roasted almonds lose 40% of their bio-active vitamin E?',
      caption: 'We slow-activate our nuts at 42°C for 24 hours to preserve nutrient bioavailability. Taste the raw difference.',
      script: 'ASMR cracking of activated California almonds with macro nutrient callouts.',
      firstComment: 'Fresh batches baked daily. Shop now at https://nutytales.com with code CRUNCH15 for 15% off.',
      scheduledTime: 'Today at 18:15',
      stage: 'scheduled',
      thumbnailUrl: 'https://images.unsplash.com/photo-1508061253366-f7da158b6d46?w=400&auto=format&fit=crop&q=80',
      videoDurationSec: 28,
    },
    {
      id: 'cq-4',
      brand: 'CHATR',
      brandSlug: 'chatr',
      platform: 'facebook',
      hookLine: 'POV: Your boss still sends you 300-word emails when a quick 10-second video answers everything.',
      caption: 'Save your team from reading marathons. Send interactive video reactions in one click. #WFH #RemoteWork #SlackAlternative',
      script: 'Humorous reaction face cutting into ultra-fast video creation workflow.',
      firstComment: 'Download the app free at https://chatr.chat',
      scheduledTime: 'Posted 2h ago',
      stage: 'posted',
      thumbnailUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=400&auto=format&fit=crop&q=80',
      videoDurationSec: 24,
      metrics: {
        views: 28900,
        likes: 2450,
        comments: 184,
        shares: 612,
      },
    },
    {
      id: 'cq-5',
      brand: 'TX Academy',
      brandSlug: 'tx-academy',
      platform: 'youtube',
      hookLine: 'Build a production multi-agent system using Ollama and TypeScript.',
      caption: 'Step-by-step tutorial on local agent execution, zero API token costs, and structured JSON output streaming.',
      script: 'High energy code walkthrough in VS Code showing local llama3.2 inference.',
      firstComment: 'Repository code and setup scripts: https://txacademy.ai/courses/agentic-engineering',
      scheduledTime: 'Failed 1h ago',
      stage: 'failed',
      failureReason: 'Patchright session token expired during upload handshake. Refresh required.',
      videoDurationSec: 58,
    },
    {
      id: 'cq-6',
      brand: 'TalentXcel',
      brandSlug: 'talentxcel',
      platform: 'twitter',
      hookLine: '5 interview questions that immediately reveal if an AI engineer understands distributed inference.',
      caption: 'Thread: 1/ Don\'t ask generic LeetCode algorithms. Ask these 5 system design problems instead 🧵👇',
      script: 'Twitter thread generation with 5 technical prompts.',
      firstComment: 'Follow @TalentXcel for daily engineering leadership breakdowns.',
      scheduledTime: 'Today at 19:45',
      stage: 'media_ready',
      videoDurationSec: 0,
    },
  ]);

  const [brandFilter, setBrandFilter] = useState<string>('all');
  const [platformFilter, setPlatformFilter] = useState<string>('all');
  const [selectedItem, setSelectedItem] = useState<ContentQueueItem | null>(null);

  const fetchQueue = async () => {
    try {
      const res = await authFetch('/api/v1/omnipulse/queue');
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          setItems(json.data);
        }
      }
    } catch {
      // Keep state
    }
  };

  useEffect(() => {
    fetchQueue();
  }, []);

  const columns: Array<{ id: QueueStage; title: string; color: string }> = [
    { id: 'pending', title: 'Pending Synthesis', color: 'var(--accent-amber)' },
    { id: 'media_ready', title: 'Media Ready (TTS & Video)', color: 'var(--accent-blue)' },
    { id: 'scheduled', title: 'Scheduled for Release', color: 'var(--accent-purple)' },
    { id: 'posted', title: 'Posted & Live', color: 'var(--accent-green)' },
    { id: 'failed', title: 'Failed / Cooldown', color: 'var(--accent-red)' },
  ];

  const safeItems = Array.isArray(items) ? items : [];
  const filteredItems = safeItems.filter((item) => {
    if (brandFilter !== 'all' && item.brandSlug !== brandFilter) return false;
    if (platformFilter !== 'all' && item.platform !== platformFilter) return false;
    return true;
  });

  const renderPlatformIcon = (platform: string) => {
    switch (platform) {
      case 'youtube':
        return <Youtube size={14} color="#ef4444" />;
      case 'instagram':
        return <Instagram size={14} color="#ec4899" />;
      case 'linkedin':
        return <Linkedin size={14} color="#3b82f6" />;
      case 'twitter':
        return <Twitter size={14} color="#60a5fa" />;
      case 'facebook':
        return <Video size={14} color="#1877f2" />;
      default:
        return <Video size={14} />;
    }
  };

  const handleRetryItem = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, stage: 'media_ready', failureReason: undefined } : item))
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '1440px', margin: '0 auto' }}>
      {/* ─── Header & Filters ───────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '24px' }}>🎬</span>
            <h2 style={{ fontSize: '24px', fontWeight: 700, letterSpacing: '-0.5px' }}>
              Content Pipeline Kanban
            </h2>
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginTop: '4px' }}>
            Autonomous video synthesis, Edge-TTS audio mastering, and headless social scheduling monitor
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <select
            value={brandFilter}
            onChange={(e) => setBrandFilter(e.target.value)}
            style={{
              backgroundColor: 'var(--bg-card)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-color)',
              borderRadius: '6px',
              padding: '6px 12px',
              fontSize: '12px',
            }}
          >
            <option value="all">All Brands</option>
            <option value="talentxcel">TalentXcel</option>
            <option value="chatr">CHATR</option>
            <option value="nuty-tales">Nuty Tales</option>
            <option value="tx-academy">TX Academy</option>
          </select>

          <select
            value={platformFilter}
            onChange={(e) => setPlatformFilter(e.target.value)}
            style={{
              backgroundColor: 'var(--bg-card)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-color)',
              borderRadius: '6px',
              padding: '6px 12px',
              fontSize: '12px',
            }}
          >
            <option value="all">All Platforms</option>
            <option value="youtube">YouTube</option>
            <option value="facebook">Facebook</option>
            <option value="instagram">Instagram</option>
            <option value="twitter">Twitter / X</option>
            <option value="linkedin">LinkedIn</option>
          </select>
        </div>
      </div>

      {/* ─── Kanban Board Columns ───────────────────────────────────── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(5, 1fr)',
          gap: '16px',
          alignItems: 'start',
          overflowX: 'auto',
          paddingBottom: '20px',
        }}
      >
        {columns.map((col) => {
          const colItems = filteredItems.filter((i) => i.stage === col.id);
          return (
            <div
              key={col.id}
              style={{
                backgroundColor: 'var(--bg-secondary)',
                border: '1px solid var(--border-color)',
                borderRadius: '8px',
                padding: '14px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                minWidth: '240px',
              }}
            >
              {/* Column Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: col.color }} />
                  <span style={{ fontSize: '13px', fontWeight: 700 }}>{col.title}</span>
                </div>
                <span
                  style={{
                    fontSize: '11px',
                    padding: '2px 6px',
                    borderRadius: '10px',
                    backgroundColor: 'var(--bg-card)',
                    color: 'var(--text-secondary)',
                    fontWeight: 600,
                  }}
                >
                  {colItems.length}
                </span>
              </div>

              {/* Cards in Column */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {colItems.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => setSelectedItem(item)}
                    style={{
                      backgroundColor: 'var(--bg-card)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '8px',
                      padding: '12px',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px',
                      transition: 'border-color 0.2s',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--accent-blue)')}
                    onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border-color)')}
                  >
                    {/* Brand Badge & Platform Icon */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span
                        style={{
                          fontSize: '10px',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          backgroundColor: 'var(--bg-secondary)',
                          color: 'var(--text-primary)',
                          fontWeight: 600,
                        }}
                      >
                        {item.brand}
                      </span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        {renderPlatformIcon(item.platform)}
                        <span style={{ fontSize: '11px', textTransform: 'capitalize', color: 'var(--text-secondary)' }}>
                          {item.platform}
                        </span>
                      </div>
                    </div>

                    {/* Thumbnail if available */}
                    {item.thumbnailUrl && (
                      <div
                        style={{
                          width: '100%',
                          height: '110px',
                          borderRadius: '6px',
                          overflow: 'hidden',
                          position: 'relative',
                          backgroundColor: '#000',
                        }}
                      >
                        <img
                          src={item.thumbnailUrl}
                          alt="Thumbnail"
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                        {item.videoDurationSec && (
                          <span
                            style={{
                              position: 'absolute',
                              bottom: '6px',
                              right: '6px',
                              backgroundColor: 'rgba(0, 0, 0, 0.75)',
                              color: '#fff',
                              fontSize: '10px',
                              padding: '2px 4px',
                              borderRadius: '3px',
                            }}
                          >
                            {item.videoDurationSec}s
                          </span>
                        )}
                      </div>
                    )}

                    {/* Hook Line */}
                    <div style={{ fontSize: '12px', fontWeight: 600, lineHeight: '1.4' }}>
                      {item.hookLine}
                    </div>

                    {/* Scheduled Time or Failure */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <Clock size={12} />
                        {item.scheduledTime}
                      </span>

                      {item.stage === 'failed' && (
                        <button
                          onClick={(e) => handleRetryItem(item.id, e)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '3px',
                            padding: '2px 6px',
                            backgroundColor: 'rgba(239, 68, 68, 0.2)',
                            color: 'var(--accent-red)',
                            border: '1px solid var(--accent-red)',
                            borderRadius: '4px',
                            fontSize: '10px',
                            cursor: 'pointer',
                          }}
                        >
                          <RotateCcw size={10} />
                          Retry
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* ─── Detail Modal ───────────────────────────────────────────── */}
      {selectedItem && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
          onClick={() => setSelectedItem(null)}
        >
          <div
            style={{
              backgroundColor: 'var(--bg-secondary)',
              border: '1px solid var(--border-color)',
              borderRadius: '12px',
              padding: '24px',
              width: '640px',
              maxWidth: '92%',
              maxHeight: '90vh',
              overflowY: 'auto',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span
                  style={{
                    fontSize: '12px',
                    padding: '3px 8px',
                    borderRadius: '4px',
                    backgroundColor: 'var(--bg-card)',
                    color: 'var(--text-primary)',
                    fontWeight: 700,
                    border: '1px solid var(--border-color)',
                  }}
                >
                  {selectedItem.brand}
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  {renderPlatformIcon(selectedItem.platform)}
                  <span style={{ fontSize: '13px', fontWeight: 600, textTransform: 'capitalize' }}>
                    {selectedItem.platform}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setSelectedItem(null)}
                style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '18px' }}
              >
                ✕
              </button>
            </div>

            {/* Hook Line */}
            <div style={{ marginBottom: '16px' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Hook Line:</div>
              <div style={{ fontSize: '16px', fontWeight: 700 }}>{selectedItem.hookLine}</div>
            </div>

            {/* Script */}
            <div style={{ marginBottom: '16px' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                Full Creative Script & Voice Instructions:
              </div>
              <div
                style={{
                  backgroundColor: 'var(--bg-card)',
                  padding: '12px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontFamily: 'monospace',
                  whiteSpace: 'pre-wrap',
                  border: '1px solid var(--border-color)',
                }}
              >
                {selectedItem.script}
              </div>
            </div>

            {/* Caption & Hashtags */}
            <div style={{ marginBottom: '16px' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Published Caption:</div>
              <div
                style={{
                  backgroundColor: 'var(--bg-card)',
                  padding: '12px',
                  borderRadius: '6px',
                  fontSize: '13px',
                  border: '1px solid var(--border-color)',
                }}
              >
                {selectedItem.caption}
              </div>
            </div>

            {/* First Comment (Auto-pinned CTA) */}
            <div style={{ marginBottom: '16px' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                Pinned First Comment (CTA Link):
              </div>
              <div
                style={{
                  backgroundColor: 'var(--bg-card)',
                  padding: '10px 12px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  color: 'var(--accent-blue)',
                  border: '1px solid var(--border-color)',
                }}
              >
                {selectedItem.firstComment}
              </div>
            </div>

            {/* Metrics if live */}
            {selectedItem.metrics && (
              <div style={{ marginBottom: '16px', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                  Live Engagement Metrics:
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', textAlign: 'center' }}>
                  <div style={{ backgroundColor: 'var(--bg-card)', padding: '10px', borderRadius: '6px' }}>
                    <div style={{ fontSize: '16px', fontWeight: 800 }}>{(selectedItem.metrics?.views ?? 0).toLocaleString()}</div>
                    <div style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>Views</div>
                  </div>
                  <div style={{ backgroundColor: 'var(--bg-card)', padding: '10px', borderRadius: '6px' }}>
                    <div style={{ fontSize: '16px', fontWeight: 800 }}>{(selectedItem.metrics?.likes ?? 0).toLocaleString()}</div>
                    <div style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>Likes</div>
                  </div>
                  <div style={{ backgroundColor: 'var(--bg-card)', padding: '10px', borderRadius: '6px' }}>
                    <div style={{ fontSize: '16px', fontWeight: 800 }}>{(selectedItem.metrics?.comments ?? 0).toLocaleString()}</div>
                    <div style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>Comments</div>
                  </div>
                  <div style={{ backgroundColor: 'var(--bg-card)', padding: '10px', borderRadius: '6px' }}>
                    <div style={{ fontSize: '16px', fontWeight: 800 }}>{(selectedItem.metrics?.shares ?? 0).toLocaleString()}</div>
                    <div style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>Shares</div>
                  </div>
                </div>
              </div>
            )}

            {/* Failure Reason */}
            {selectedItem.failureReason && (
              <div
                style={{
                  backgroundColor: 'rgba(239, 68, 68, 0.15)',
                  border: '1px solid var(--accent-red)',
                  padding: '12px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  color: 'var(--accent-red)',
                  marginBottom: '16px',
                }}
              >
                <strong>Execution Error:</strong> {selectedItem.failureReason}
              </div>
            )}

            {/* Modal Actions */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '16px' }}>
              <button
                onClick={() => setSelectedItem(null)}
                style={{
                  padding: '8px 16px',
                  backgroundColor: 'var(--bg-card)',
                  color: 'var(--text-primary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '6px',
                  fontSize: '12px',
                  cursor: 'pointer',
                  fontWeight: 600,
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ContentQueueMonitor;
