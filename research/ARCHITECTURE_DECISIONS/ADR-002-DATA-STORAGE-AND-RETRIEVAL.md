# ADR-002: Data Storage, Indexing & Hybrid Search Strategy

## Status
**Accepted** (13 October 2026)

## Context
The OS must store transactional entities (workspaces, brands, workflow runs, content assets, approval events), time-series traffic observations, and unstructured source text for research retrieval.

We evaluated three alternatives:
1. **PostgreSQL with `tsvector` FTS + `pgvector` (Adopted):** Consolidated relational database with native full-text indexing and dense vector embeddings.
2. **PostgreSQL + Qdrant (Separate Vector DB):** Relational store paired with a dedicated vector engine.
3. **OpenSearch / Elasticsearch Cluster:** Dedicated distributed search cluster.

## Decision
Adopt **PostgreSQL with native `tsvector` and `pgvector`** hosted on Supabase. Hybrid search fuses lexical BM25 (`ts_rank_cd`) and dense embeddings (`cosine_distance`) via Reciprocal Rank Fusion (RRF).

## Consequences
- **Positive:** Single database to backup, migrate, and secure; ACID transactions across workflows and embeddings; zero cross-database synchronization lag.
- **Tradeoff:** Dedicated vector databases scale better past $10\text{M}$ vectors; our current dataset size ($\sim 50\text{k}$ documents in validation phase) is well within PostgreSQL HNSW memory limits.
