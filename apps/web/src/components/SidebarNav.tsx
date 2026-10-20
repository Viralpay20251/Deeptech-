import React from 'react';
import {
  Zap,
  TrendingUp,
  Smartphone,
  Film,
  Compass,
  Link2,
  Globe,
  BarChart3,
  Cpu,
  CheckSquare,
  Sparkles,
  GitBranch,
  Bot,
  Search,
  Tag,
  Plug,
  FileText,
  PanelLeftClose,
  PanelLeft,
} from 'lucide-react';
import type { TabType } from '../App';

export interface SidebarNavProps {
  activeTab: TabType;
  onSelectTab: (tab: TabType) => void;
  approvalsCount: number;
  collapsed: boolean;
  onToggleCollapse: () => void;
}

interface NavItem {
  key: TabType;
  label: string;
  icon: React.ComponentType<any>;
  badge?: string | number;
  badgeColor?: string;
  isPulse?: boolean;
}

interface NavSection {
  title: string;
  tag?: string;
  items: NavItem[];
}

export function SidebarNav({
  activeTab,
  onSelectTab,
  approvalsCount,
  collapsed,
  onToggleCollapse,
}: SidebarNavProps) {
  const sections: NavSection[] = [
    {
      title: 'OmniPulse Engine',
      tag: 'Pulse',
      items: [
        { key: 'omnipulse', label: 'Command Center', icon: Zap, isPulse: true },
        { key: 'omnipulse_velocity', label: 'Velocity Multipliers (21)', icon: TrendingUp, isPulse: true, badge: '21' },
        { key: 'omnipulse_accounts', label: 'Social Health Pool', icon: Smartphone, isPulse: true },
        { key: 'omnipulse_queue', label: 'Content Queue', icon: Film, isPulse: true },
        { key: 'omnipulse_pseo', label: 'pSEO Intelligence', icon: Compass, isPulse: true },
        { key: 'omnipulse_backlinks', label: 'Backlink Engine', icon: Link2, isPulse: true },
      ],
    },
    {
      title: 'Governance & Core',
      items: [
        { key: 'domains', label: 'Domain Registry & Health', icon: Globe, badge: '26', badgeColor: '#38bdf8' },
        { key: 'scorecards', label: 'North Star Targets', icon: BarChart3 },
        { key: 'queue', label: 'Durable Job Queue', icon: Cpu },
        {
          key: 'approvals',
          label: 'Human Approvals',
          icon: CheckSquare,
          badge: approvalsCount > 0 ? approvalsCount : undefined,
          badgeColor: approvalsCount > 0 ? '#f59e0b' : undefined,
        },
        { key: 'opportunities', label: 'Demand Opportunities', icon: Sparkles },
        { key: 'workflows', label: 'Autonomous Workflows', icon: GitBranch },
      ],
    },
    {
      title: 'Intelligence & Tools',
      items: [
        { key: 'crawler', label: 'Web Crawler v2', icon: Bot },
        { key: 'seo', label: 'SEO Workbench', icon: Search },
        { key: 'meta_studio', label: 'Metadata Studio & Graph', icon: Tag },
        { key: 'connectors', label: 'Connector Catalog', icon: Plug },
        { key: 'evidence', label: 'Evidence & Claims', icon: FileText },
      ],
    },
  ];

  return (
    <aside
      style={{
        width: collapsed ? '68px' : '260px',
        minWidth: collapsed ? '68px' : '260px',
        backgroundColor: 'var(--bg-secondary)',
        borderRight: '1px solid var(--border-color)',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        flexShrink: 0,
        transition: 'width 0.2s cubic-bezier(0.4, 0, 0.2, 1), min-width 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
        overflow: 'hidden',
        userSelect: 'none',
      }}
    >
      {/* Sidebar Header with Toggle */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: collapsed ? 'center' : 'space-between',
          padding: collapsed ? '14px 0' : '14px 16px',
          borderBottom: '1px solid var(--border-color)',
          minHeight: '52px',
        }}
      >
        {!collapsed && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '12px', fontWeight: 700, letterSpacing: '0.5px', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
              Navigation
            </span>
          </div>
        )}
        <button
          onClick={onToggleCollapse}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--text-secondary)',
            cursor: 'pointer',
            padding: '6px',
            borderRadius: '6px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'background 0.15s, color 0.15s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.08)';
            e.currentTarget.style.color = 'var(--text-primary)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
            e.currentTarget.style.color = 'var(--text-secondary)';
          }}
        >
          {collapsed ? <PanelLeft size={18} /> : <PanelLeftClose size={18} />}
        </button>
      </div>

      {/* Nav Sections Scroll Area */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          overflowX: 'hidden',
          padding: collapsed ? '12px 6px' : '12px 10px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
        }}
      >
        {sections.map((sec, secIdx) => (
          <div key={secIdx} style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            {!collapsed && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '4px 10px 8px 10px',
                  fontSize: '11px',
                  fontWeight: 700,
                  letterSpacing: '0.6px',
                  textTransform: 'uppercase',
                  color: sec.tag ? '#60a5fa' : 'var(--text-secondary)',
                }}
              >
                <span>{sec.title}</span>
                {sec.tag && (
                  <span
                    style={{
                      fontSize: '9px',
                      padding: '1px 6px',
                      borderRadius: '4px',
                      backgroundColor: 'rgba(59, 130, 246, 0.15)',
                      color: 'var(--accent-blue)',
                      fontWeight: 700,
                      letterSpacing: '0.5px',
                    }}
                  >
                    {sec.tag}
                  </span>
                )}
              </div>
            )}

            {sec.items.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.key;

              return (
                <button
                  key={item.key}
                  onClick={() => onSelectTab(item.key)}
                  title={collapsed ? item.label : undefined}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: collapsed ? '0' : '10px',
                    justifyContent: collapsed ? 'center' : 'flex-start',
                    padding: collapsed ? '10px 0' : '9px 12px',
                    backgroundColor: isActive ? 'rgba(59, 130, 246, 0.15)' : 'transparent',
                    border: 'none',
                    borderLeft: isActive ? '3px solid var(--accent-blue)' : '3px solid transparent',
                    borderRadius: collapsed ? '8px' : '0 8px 8px 0',
                    color: isActive
                      ? '#ffffff'
                      : item.isPulse
                      ? '#93c5fd'
                      : 'var(--text-secondary)',
                    fontSize: '13px',
                    fontWeight: isActive ? 600 : 500,
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'all 0.15s ease',
                    position: 'relative',
                    width: '100%',
                    boxSizing: 'border-box',
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
                      e.currentTarget.style.color = 'var(--text-primary)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.backgroundColor = 'transparent';
                      e.currentTarget.style.color = item.isPulse ? '#93c5fd' : 'var(--text-secondary)';
                    }
                  }}
                >
                  <Icon
                    size={17}
                    style={{
                      flexShrink: 0,
                      color: isActive ? 'var(--accent-blue)' : item.isPulse ? '#60a5fa' : 'currentColor',
                    }}
                  />

                  {!collapsed && (
                    <span
                      style={{
                        flex: 1,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {item.label}
                    </span>
                  )}

                  {!collapsed && item.badge !== undefined && (
                    <span
                      style={{
                        fontSize: '11px',
                        fontWeight: 700,
                        padding: '1px 7px',
                        borderRadius: '10px',
                        backgroundColor: item.badgeColor
                          ? `rgba(${item.badgeColor === '#f59e0b' ? '245, 158, 11' : '56, 189, 248'}, 0.2)`
                          : 'rgba(255, 255, 255, 0.1)',
                        color: item.badgeColor || 'var(--text-primary)',
                        flexShrink: 0,
                      }}
                    >
                      {item.badge}
                    </span>
                  )}

                  {collapsed && item.badge !== undefined && (
                    <span
                      style={{
                        position: 'absolute',
                        top: '6px',
                        right: '10px',
                        width: '7px',
                        height: '7px',
                        borderRadius: '50%',
                        backgroundColor: item.badgeColor || 'var(--accent-blue)',
                      }}
                    />
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      {/* Sidebar Footer */}
      <div
        style={{
          padding: collapsed ? '12px 0' : '12px 14px',
          borderTop: '1px solid var(--border-color)',
          fontSize: '11px',
          color: 'var(--text-secondary)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: collapsed ? 'center' : 'space-between',
        }}
      >
        {!collapsed ? (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#10b981', display: 'inline-block' }} />
              <span style={{ fontWeight: 600 }}>OS Shield Active</span>
            </div>
            <span style={{ opacity: 0.6 }}>v2.0</span>
          </>
        ) : (
          <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#10b981', display: 'inline-block' }} title="OS Shield Active" />
        )}
      </div>
    </aside>
  );
}
