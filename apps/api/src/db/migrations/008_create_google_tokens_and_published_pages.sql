-- ============================================================
-- Migration: 008_create_google_tokens_and_published_pages.sql
-- Description: OAuth tokens storage, Google GSC/GA4 integration,
--              and Independent Public Publishing surface with
--              mandatory Human Approval Gate enforcement.
-- ============================================================

-- ─── OAuth Tokens (Encrypted / Token Reference Store) ─────────────────────────

CREATE TABLE oauth_tokens (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id    UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    provider        TEXT NOT NULL CHECK (provider IN ('google', 'linkedin', 'meta', 'x', 'reddit')),
    access_token    TEXT NOT NULL,
    refresh_token   TEXT,
    token_type      TEXT NOT NULL DEFAULT 'Bearer',
    scopes          TEXT[] NOT NULL DEFAULT '{}',
    expires_at      TIMESTAMPTZ NOT NULL,
    metadata        JSONB NOT NULL DEFAULT '{}'::JSONB,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (workspace_id, provider)
);

CREATE INDEX idx_oauth_tokens_workspace_provider ON oauth_tokens(workspace_id, provider);

COMMENT ON TABLE oauth_tokens IS
    'OAuth token credentials for external API integrations (Google GSC/GA4, LinkedIn, Meta).';

-- ─── Independent Public Published Pages ───────────────────────────────────────

CREATE TABLE public_published_pages (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id        UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    brand_id            UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
    asset_id            UUID REFERENCES content_assets(id) ON DELETE SET NULL,
    approval_event_id   UUID NOT NULL REFERENCES approval_events(id),
    slug                TEXT NOT NULL UNIQUE,
    title               TEXT NOT NULL,
    meta_description    TEXT NOT NULL,
    canonical_url       TEXT NOT NULL,
    schema_type         TEXT NOT NULL DEFAULT 'Article',
    html_content        TEXT NOT NULL,
    cta_tracked_code    TEXT REFERENCES tracked_links(short_code) ON DELETE SET NULL,
    cta_label           TEXT NOT NULL DEFAULT 'Learn More',
    page_views          INTEGER NOT NULL DEFAULT 0,
    is_indexed          BOOLEAN NOT NULL DEFAULT TRUE,
    published_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_public_published_pages_slug ON public_published_pages(slug);
CREATE INDEX idx_public_published_pages_brand ON public_published_pages(brand_id);
CREATE INDEX idx_public_published_pages_approval ON public_published_pages(approval_event_id);

COMMENT ON TABLE public_published_pages IS
    'Independent public publishing surface. Strictly requires an approved approval_event_id. '
    'Hosted on the OS-owned domain; zero changes to CHATR, TalentXcel, or Nuty Tales domains.';

-- ─── Triggers ─────────────────────────────────────────────────────────────────

CREATE TRIGGER trg_oauth_tokens_updated_at BEFORE UPDATE ON oauth_tokens
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_public_published_pages_updated_at BEFORE UPDATE ON public_published_pages
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
