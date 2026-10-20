/**
 * Autonomous Growth OS — Unified Authentication Hub & GSC Connector Modal
 *
 * Implements:
 * 1. Google Search Console & GA4 multi-domain authorization:
 *    - OAuth 2.0 flow initiation
 *    - Google Cloud Service Account JSON upload & direct verification
 *    - Direct OAuth token registration
 *    - Coverage across all 26 authoritative hostnames
 * 2. Search & Indexing Connectors (Bing Webmaster, IndexNow, Brave Search)
 * 3. Social Media & Distribution Connectors (LinkedIn, Meta, X/Twitter, YouTube)
 * 4. Operator Session Management (JWT validity, role inspection, 1-click session bootstrap)
 */

import { useState, useEffect } from 'react';
import { authFetch, getStoredUser, ensureOperatorSession } from '../lib/apiClient';

interface AuthenticationHubModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSessionUpdated?: () => void;
}

export function AuthenticationHubModal({ isOpen, onClose, onSessionUpdated }: AuthenticationHubModalProps) {
  const [activeTab, setActiveTab] = useState<'gsc' | 'webmaster' | 'social' | 'operator'>('gsc');
  const [loading, setLoading] = useState<boolean>(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);

  // GSC / Google State
  const [gscStatus, setGscStatus] = useState<any>(null);
  const [serviceAccountJson, setServiceAccountJson] = useState<string>('');
  const [directGoogleToken, setDirectGoogleToken] = useState<string>('');

  // Other Connectors State
  const [bingApiKey, setBingApiKey] = useState<string>('');
  const [indexNowKey, setIndexNowKey] = useState<string>('');
  const [linkedinToken, setLinkedinToken] = useState<string>('');
  const [metaToken, setMetaToken] = useState<string>('');
  const [twitterToken, setTwitterToken] = useState<string>('');

  // Operator State
  const [currentUser, setCurrentUser] = useState<any>(getStoredUser());

  useEffect(() => {
    if (isOpen) {
      loadConnectorsStatus();
      setCurrentUser(getStoredUser());
    }
  }, [isOpen]);

  const loadConnectorsStatus = async () => {
    try {
      setLoading(true);
      const res = await authFetch('/api/v1/auth/connectors-status');
      const json = await res.json();
      if (json.success && json.data) {
        setGscStatus(json.data);
      }
    } catch (err) {
      console.warn('Failed to load connector status:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAuthorizeGoogleOAuth = async () => {
    try {
      setLoading(true);
      setNotification(null);
      const res = await authFetch('/api/v1/auth/google/authorize');
      const json = await res.json();
      if (json.success && json.url) {
        window.location.href = json.url;
      } else {
        setNotification({
          type: 'error',
          message: `❌ Google OAuth Initiation: ${json.error?.message || 'Failed to generate authorization URL.'}`,
        });
      }
    } catch (err) {
      setNotification({ type: 'error', message: `❌ Error: ${(err as Error).message}` });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveServiceAccount = async () => {
    if (!serviceAccountJson.trim()) {
      setNotification({ type: 'error', message: 'Please paste your Google Cloud Service Account JSON key.' });
      return;
    }

    try {
      setLoading(true);
      setNotification(null);
      const res = await authFetch('/api/v1/auth/service-account', {
        method: 'POST',
        body: JSON.stringify({ service_account_json: serviceAccountJson }),
      });
      const json = await res.json();
      if (json.success) {
        setNotification({
          type: 'success',
          message: `✅ Google Service Account (${json.data.client_email}) successfully authorized across all 26 domains!`,
        });
        setServiceAccountJson('');
        loadConnectorsStatus();
      } else {
        setNotification({ type: 'error', message: `❌ Authorization failed: ${json.error?.message || json.error}` });
      }
    } catch (err) {
      setNotification({ type: 'error', message: `❌ Network error: ${(err as Error).message}` });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveDirectGoogleToken = async () => {
    if (!directGoogleToken.trim()) {
      setNotification({ type: 'error', message: 'Please provide a valid Google Access Token.' });
      return;
    }

    try {
      setLoading(true);
      setNotification(null);
      const res = await authFetch('/api/v1/connectors/login-direct', {
        method: 'POST',
        body: JSON.stringify({
          connector_type: 'google_search_console',
          access_token: directGoogleToken.trim(),
        }),
      });
      const json = await res.json();
      if (json.success) {
        setNotification({ type: 'success', message: '✅ Google Search Console token verified & connected!' });
        setDirectGoogleToken('');
        loadConnectorsStatus();
      } else {
        setNotification({ type: 'error', message: `❌ Verification failed: ${json.error?.message}` });
      }
    } catch (err) {
      setNotification({ type: 'error', message: `❌ Error: ${(err as Error).message}` });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveConnectorKey = async (connectorType: string, token: string, label: string) => {
    if (!token.trim()) {
      setNotification({ type: 'error', message: `Please enter a valid credential for ${label}.` });
      return;
    }

    try {
      setLoading(true);
      setNotification(null);
      const res = await authFetch('/api/v1/connectors/login-direct', {
        method: 'POST',
        body: JSON.stringify({
          connector_type: connectorType,
          api_key: token.trim(),
          access_token: token.trim(),
        }),
      });
      const json = await res.json();
      if (json.success) {
        setNotification({ type: 'success', message: `✅ ${label} successfully registered and verified!` });
        loadConnectorsStatus();
      } else {
        setNotification({ type: 'error', message: `❌ ${label} failed: ${json.error?.message}` });
      }
    } catch (err) {
      setNotification({ type: 'error', message: `❌ Error: ${(err as Error).message}` });
    } finally {
      setLoading(false);
    }
  };

  const handleRebootstrapSession = async () => {
    try {
      setLoading(true);
      localStorage.removeItem('growth_os_token');
      localStorage.removeItem('growth_os_user');
      const session = await ensureOperatorSession();
      setCurrentUser(session.user);
      setNotification({
        type: 'success',
        message: `✅ Operator session re-issued: ${session.user.display_name} (${session.user.role}) is active for 24 hours.`,
      });
      if (onSessionUpdated) onSessionUpdated();
    } catch (err) {
      setNotification({ type: 'error', message: `❌ Failed to re-issue session: ${(err as Error).message}` });
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const isGoogleConnected =
    Boolean(gscStatus?.oauth_tokens?.google?.connected) ||
    Boolean(gscStatus?.connectors?.find((c: any) => c.connector_type === 'google_search_console')?.status === 'connected');

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: '20px',
      }}
    >
      <div
        style={{
          backgroundColor: '#0f172a',
          border: '1px solid #334155',
          borderRadius: '12px',
          width: '100%',
          maxWidth: '780px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
          color: '#f8fafc',
          overflow: 'hidden',
        }}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: '18px 24px',
            borderBottom: '1px solid #1e293b',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            backgroundColor: '#090d16',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '20px' }}>🔐</span>
            <div>
              <h2 style={{ margin: 0, fontSize: '17px', fontWeight: 700, color: '#f8fafc' }}>
                Authentication & Connectors Command Center
              </h2>
              <p style={{ margin: '3px 0 0', fontSize: '12px', color: '#94a3b8' }}>
                Google Search Console, GA4, Multi-Domain Webmaster APIs & Operator Identity
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '20px',
              color: '#94a3b8',
              cursor: 'pointer',
              padding: '4px',
            }}
          >
            ✕
          </button>
        </div>

        {/* Navigation Tabs */}
        <div
          style={{
            display: 'flex',
            borderBottom: '1px solid #1e293b',
            backgroundColor: '#0c1222',
            padding: '4px 16px',
            gap: '8px',
          }}
        >
          {[
            { id: 'gsc', label: '🔍 Google Search Console & GA4', icon: '🌐' },
            { id: 'webmaster', label: '⚡ IndexNow & Webmaster APIs', icon: '📡' },
            { id: 'social', label: '📱 Social Distribution', icon: '📣' },
            { id: 'operator', label: '👤 Operator Identity', icon: '🛡️' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              style={{
                padding: '10px 14px',
                fontSize: '12px',
                fontWeight: 600,
                border: 'none',
                background: 'none',
                cursor: 'pointer',
                color: activeTab === tab.id ? '#38bdf8' : '#94a3b8',
                borderBottom: activeTab === tab.id ? '2px solid #38bdf8' : '2px solid transparent',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Notification Banner */}
        {notification && (
          <div
            style={{
              margin: '12px 24px 0',
              padding: '10px 14px',
              borderRadius: '6px',
              fontSize: '13px',
              backgroundColor:
                notification.type === 'success'
                  ? 'rgba(16, 185, 129, 0.15)'
                  : notification.type === 'error'
                  ? 'rgba(239, 68, 68, 0.15)'
                  : 'rgba(59, 130, 246, 0.15)',
              border: `1px solid ${
                notification.type === 'success' ? '#10b981' : notification.type === 'error' ? '#ef4444' : '#3b82f6'
              }`,
              color: notification.type === 'success' ? '#34d399' : notification.type === 'error' ? '#f87171' : '#60a5fa',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <span>{notification.message}</span>
            <button
              onClick={() => setNotification(null)}
              style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', fontWeight: 700 }}
            >
              ✕
            </button>
          </div>
        )}

        {/* Modal Body */}
        <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '18px' }}>
          {/* ── TAB 1: GOOGLE SEARCH CONSOLE & GA4 ───────────────────────────── */}
          {activeTab === 'gsc' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              {/* Connection Status Card */}
              <div
                style={{
                  backgroundColor: '#1e293b',
                  border: '1px solid #334155',
                  borderRadius: '8px',
                  padding: '16px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div
                      style={{
                        width: '10px',
                        height: '10px',
                        borderRadius: '50%',
                        backgroundColor: isGoogleConnected ? '#10b981' : '#f59e0b',
                      }}
                    />
                    <strong style={{ fontSize: '14px', color: '#f8fafc' }}>
                      Google Search Console & GA4 Data API
                    </strong>
                    <span
                      style={{
                        fontSize: '11px',
                        padding: '2px 8px',
                        borderRadius: '10px',
                        fontWeight: 600,
                        backgroundColor: isGoogleConnected ? 'rgba(16, 185, 129, 0.2)' : 'rgba(245, 158, 11, 0.2)',
                        color: isGoogleConnected ? '#10b981' : '#f59e0b',
                      }}
                    >
                      {isGoogleConnected ? 'AUTHENTICATED & ACTIVE' : 'AWAITING CREDENTIALS'}
                    </span>
                  </div>
                  <p style={{ margin: '6px 0 0', fontSize: '12px', color: '#94a3b8' }}>
                    Authorized for 26 canonical properties across TalentXcel, CHATR, and Nuty Tales.
                  </p>
                </div>

                <button
                  onClick={handleAuthorizeGoogleOAuth}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: '#2563eb',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <span>Google OAuth 2.0 Login ↗</span>
                </button>
              </div>

              {/* Service Account JSON Configuration */}
              <div
                style={{
                  backgroundColor: '#131d31',
                  border: '1px solid #283548',
                  borderRadius: '8px',
                  padding: '16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <strong style={{ fontSize: '13px', color: '#f8fafc' }}>
                      Method B: Google Cloud Service Account (Recommended for 26 Domains)
                    </strong>
                    <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#94a3b8' }}>
                      Paste your Google Cloud Service Account JSON key. Grants automated, unprompted Search Console crawl data and index submission across all subdomains.
                    </p>
                  </div>
                </div>

                <textarea
                  placeholder='Paste Google Cloud Service Account JSON key (e.g. {"type": "service_account", "client_email": "...", "private_key": "..."})'
                  value={serviceAccountJson}
                  onChange={(e) => setServiceAccountJson(e.target.value)}
                  rows={4}
                  style={{
                    width: '100%',
                    backgroundColor: '#090d16',
                    border: '1px solid #334155',
                    borderRadius: '6px',
                    padding: '10px 12px',
                    color: '#f8fafc',
                    fontSize: '12px',
                    fontFamily: 'monospace',
                    boxSizing: 'border-box',
                    resize: 'vertical',
                  }}
                />

                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button
                    onClick={handleSaveServiceAccount}
                    disabled={loading || !serviceAccountJson.trim()}
                    style={{
                      padding: '8px 18px',
                      backgroundColor: '#10b981',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '6px',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: loading || !serviceAccountJson.trim() ? 'not-allowed' : 'pointer',
                      opacity: loading || !serviceAccountJson.trim() ? 0.6 : 1,
                    }}
                  >
                    {loading ? 'Authenticating...' : '🔐 Authorize Service Account'}
                  </button>
                </div>
              </div>

              {/* Method C: Direct OAuth Token */}
              <div
                style={{
                  backgroundColor: '#131d31',
                  border: '1px solid #283548',
                  borderRadius: '8px',
                  padding: '16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                }}
              >
                <div>
                  <strong style={{ fontSize: '13px', color: '#f8fafc' }}>
                    Method C: Direct Operator OAuth Access Token
                  </strong>
                  <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#94a3b8' }}>
                    Paste a valid Google OAuth bearer token for immediate testing.
                  </p>
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="password"
                    placeholder="ya29.a0AfH6SM..."
                    value={directGoogleToken}
                    onChange={(e) => setDirectGoogleToken(e.target.value)}
                    style={{
                      flex: 1,
                      backgroundColor: '#090d16',
                      border: '1px solid #334155',
                      borderRadius: '6px',
                      padding: '8px 12px',
                      color: '#f8fafc',
                      fontSize: '12px',
                    }}
                  />
                  <button
                    onClick={handleSaveDirectGoogleToken}
                    disabled={loading || !directGoogleToken.trim()}
                    style={{
                      padding: '8px 14px',
                      backgroundColor: '#3b82f6',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '6px',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: loading || !directGoogleToken.trim() ? 'not-allowed' : 'pointer',
                    }}
                  >
                    Verify & Store
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ── TAB 2: INDEXNOW & WEBMASTER APIS ────────────────────────────── */}
          {activeTab === 'webmaster' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px', padding: '16px' }}>
                <strong style={{ fontSize: '13px', color: '#f8fafc' }}>IndexNow Protocol Key (Bing / Yandex Instant Indexing)</strong>
                <p style={{ margin: '4px 0 10px', fontSize: '12px', color: '#94a3b8' }}>
                  A 32-character hex key placed at the root of the domain to submit newly generated pSEO pages immediately.
                </p>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="text"
                    placeholder="e.g. 7f3b89a42c1048e09f4b7a128d542031"
                    value={indexNowKey}
                    onChange={(e) => setIndexNowKey(e.target.value)}
                    style={{
                      flex: 1,
                      backgroundColor: '#090d16',
                      border: '1px solid #334155',
                      borderRadius: '6px',
                      padding: '8px 12px',
                      color: '#f8fafc',
                      fontSize: '12px',
                    }}
                  />
                  <button
                    onClick={() => handleSaveConnectorKey('indexnow', indexNowKey, 'IndexNow Protocol')}
                    style={{ padding: '8px 14px', backgroundColor: '#3b82f6', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}
                  >
                    Save Key
                  </button>
                </div>
              </div>

              <div style={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px', padding: '16px' }}>
                <strong style={{ fontSize: '13px', color: '#f8fafc' }}>Bing Webmaster Tools API Key</strong>
                <p style={{ margin: '4px 0 10px', fontSize: '12px', color: '#94a3b8' }}>
                  Retrieve crawl issues, indexed URLs, and search query analytics from Microsoft Bing.
                </p>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="password"
                    placeholder="Bing Webmaster API Key"
                    value={bingApiKey}
                    onChange={(e) => setBingApiKey(e.target.value)}
                    style={{
                      flex: 1,
                      backgroundColor: '#090d16',
                      border: '1px solid #334155',
                      borderRadius: '6px',
                      padding: '8px 12px',
                      color: '#f8fafc',
                      fontSize: '12px',
                    }}
                  />
                  <button
                    onClick={() => handleSaveConnectorKey('bing_webmaster', bingApiKey, 'Bing Webmaster')}
                    style={{ padding: '8px 14px', backgroundColor: '#3b82f6', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}
                  >
                    Save Key
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ── TAB 3: SOCIAL DISTRIBUTION ──────────────────────────────────── */}
          {activeTab === 'social' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px', padding: '16px' }}>
                <strong style={{ fontSize: '13px', color: '#f8fafc' }}>LinkedIn Marketing & Company Pages API</strong>
                <p style={{ margin: '4px 0 10px', fontSize: '12px', color: '#94a3b8' }}>
                  OAuth access token with <code>w_organization_social</code> permissions for autonomous publishing.
                </p>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="password"
                    placeholder="LinkedIn OAuth Access Token"
                    value={linkedinToken}
                    onChange={(e) => setLinkedinToken(e.target.value)}
                    style={{ flex: 1, backgroundColor: '#090d16', border: '1px solid #334155', borderRadius: '6px', padding: '8px 12px', color: '#f8fafc', fontSize: '12px' }}
                  />
                  <button
                    onClick={() => handleSaveConnectorKey('linkedin', linkedinToken, 'LinkedIn')}
                    style={{ padding: '8px 14px', backgroundColor: '#3b82f6', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}
                  >
                    Verify & Save
                  </button>
                </div>
              </div>

              <div style={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px', padding: '16px' }}>
                <strong style={{ fontSize: '13px', color: '#f8fafc' }}>Meta Graph API (Instagram & Facebook Pages)</strong>
                <p style={{ margin: '4px 0 10px', fontSize: '12px', color: '#94a3b8' }}>
                  Page Access Token with <code>pages_manage_posts</code> and <code>instagram_basic</code>.
                </p>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="password"
                    placeholder="Meta Page Access Token"
                    value={metaToken}
                    onChange={(e) => setMetaToken(e.target.value)}
                    style={{ flex: 1, backgroundColor: '#090d16', border: '1px solid #334155', borderRadius: '6px', padding: '8px 12px', color: '#f8fafc', fontSize: '12px' }}
                  />
                  <button
                    onClick={() => handleSaveConnectorKey('meta', metaToken, 'Meta')}
                    style={{ padding: '8px 14px', backgroundColor: '#3b82f6', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}
                  >
                    Verify & Save
                  </button>
                </div>
              </div>

              <div style={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px', padding: '16px' }}>
                <strong style={{ fontSize: '13px', color: '#f8fafc' }}>X (Twitter) API v2</strong>
                <p style={{ margin: '4px 0 10px', fontSize: '12px', color: '#94a3b8' }}>
                  Bearer Token or OAuth 2.0 User Token for developer thread syndication.
                </p>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="password"
                    placeholder="X Bearer Token"
                    value={twitterToken}
                    onChange={(e) => setTwitterToken(e.target.value)}
                    style={{ flex: 1, backgroundColor: '#090d16', border: '1px solid #334155', borderRadius: '6px', padding: '8px 12px', color: '#f8fafc', fontSize: '12px' }}
                  />
                  <button
                    onClick={() => handleSaveConnectorKey('x_twitter', twitterToken, 'X (Twitter)')}
                    style={{ padding: '8px 14px', backgroundColor: '#3b82f6', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}
                  >
                    Verify & Save
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ── TAB 4: OPERATOR IDENTITY ────────────────────────────────────── */}
          {activeTab === 'operator' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px', padding: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <strong style={{ fontSize: '14px', color: '#f8fafc' }}>Active Operator Session</strong>
                    <div style={{ marginTop: '8px', fontSize: '13px', color: '#cbd5e1' }}>
                      <div>Name: <strong>{currentUser?.display_name || 'Lead Growth Operator'}</strong></div>
                      <div>Role: <span style={{ color: '#38bdf8', fontWeight: 600 }}>{currentUser?.role || 'workspace_admin'}</span></div>
                      <div>Email: <code>{currentUser?.email || 'operator@growth-os.internal'}</code></div>
                      <div>Workspace ID: <code>{currentUser?.workspace_id || '00000000-0000-0000-0000-000000000001'}</code></div>
                    </div>
                  </div>
                  <span
                    style={{
                      fontSize: '11px',
                      padding: '3px 8px',
                      borderRadius: '12px',
                      backgroundColor: 'rgba(16, 185, 129, 0.2)',
                      color: '#10b981',
                      fontWeight: 600,
                    }}
                  >
                    SESSION ACTIVE
                  </span>
                </div>

                <div style={{ marginTop: '16px', display: 'flex', gap: '10px' }}>
                  <button
                    onClick={handleRebootstrapSession}
                    disabled={loading}
                    style={{
                      padding: '8px 16px',
                      backgroundColor: '#2563eb',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '6px',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    ⚡ Refresh / Re-issue 24h Session Token
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div
          style={{
            padding: '14px 24px',
            borderTop: '1px solid #1e293b',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            backgroundColor: '#090d16',
          }}
        >
          <div style={{ fontSize: '11px', color: '#64748b' }}>
            All credentials are encrypted and stored in PostgreSQL with workspace boundary enforcement.
          </div>
          <button
            onClick={onClose}
            style={{
              padding: '6px 16px',
              backgroundColor: '#334155',
              color: '#f8fafc',
              border: 'none',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
