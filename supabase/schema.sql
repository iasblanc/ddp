-- ============================================================
-- DONT DREAM. PLAN — SUPABASE SCHEMA
-- Execute no SQL Editor do Supabase na ordem abaixo
-- ============================================================

-- ── EXTENSÕES ────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "vector"; -- para busca semântica de North

-- ── ENUMS ────────────────────────────────────────────────────
CREATE TYPE dream_status AS ENUM (
  'maturing', 'active', 'queued', 'completed', 'archived', 'paused'
);

CREATE TYPE dream_maturity_stage AS ENUM ('1', '2', '3');

CREATE TYPE block_status AS ENUM (
  'scheduled', 'completed', 'missed', 'skipped', 'active'
);

CREATE TYPE conversation_type AS ENUM (
  'extraction', 'checkin', 'pre_block', 'post_block',
  'crisis', 'revaluation', 'maturation'
);

CREATE TYPE north_tone AS ENUM ('direct', 'gentle', 'provocative');

CREATE TYPE calendar_provider AS ENUM ('google', 'apple', 'outlook');

CREATE TYPE subscription_status AS ENUM ('free', 'pro', 'team');

-- ── TABELA: users ─────────────────────────────────────────────
CREATE TABLE public.users (
  id                      UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email                   TEXT NOT NULL,
  north_tone              north_tone DEFAULT 'direct',
  locale                  TEXT DEFAULT 'en', -- 'en', 'pt-BR', 'es'
  onboarding_completed_at TIMESTAMPTZ,
  subscription_status     subscription_status DEFAULT 'free',
  subscription_ends_at    TIMESTAMPTZ,
  free_blocks_used        INTEGER DEFAULT 0,
  push_subscription       JSONB, -- Web Push subscription object
  created_at              TIMESTAMPTZ DEFAULT NOW(),
  updated_at              TIMESTAMPTZ DEFAULT NOW()
);

-- ── TABELA: dreams ────────────────────────────────────────────
CREATE TABLE public.dreams (
  id                  UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id             UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  title               TEXT NOT NULL,
  description         TEXT,
  status              dream_status DEFAULT 'maturing',
  maturity_stage      INTEGER DEFAULT 1 CHECK (maturity_stage BETWEEN 1 AND 3),
  declared_deadline   DATE,
  calibrated_deadline DATE,
  blocks_per_week     INTEGER DEFAULT 5 CHECK (blocks_per_week BETWEEN 1 AND 14),
  position            INTEGER DEFAULT 0, -- ordem na fila
  archived_reason     TEXT,
  activated_at        TIMESTAMPTZ,
  completed_at        TIMESTAMPTZ,
  archived_at         TIMESTAMPTZ,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- Constraint: apenas 1 sonho ativo por usuário
CREATE UNIQUE INDEX idx_one_active_dream_per_user
  ON public.dreams(user_id)
  WHERE status = 'active';

-- ── TABELA: dream_memories ────────────────────────────────────
CREATE TABLE public.dream_memories (
  id                     UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  dream_id               UUID REFERENCES public.dreams(id) ON DELETE CASCADE NOT NULL,
  user_id                UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  -- Perfis de North (JSONB tipado — ver types/database.ts)
  dream_profile          JSONB DEFAULT '{}',
  execution_profile      JSONB DEFAULT '{}',
  emotional_profile      JSONB DEFAULT '{}',
  conversation_summaries JSONB DEFAULT '[]', -- array dos últimos resumos
  -- Embeddings para busca semântica (pgvector)
  embedding              vector(1536), -- dimensão claude embeddings
  embeddings_updated_at  TIMESTAMPTZ,
  created_at             TIMESTAMPTZ DEFAULT NOW(),
  updated_at             TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(dream_id) -- uma memória por sonho
);

-- ── TABELA: blocks ────────────────────────────────────────────
CREATE TABLE public.blocks (
  id                   UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  dream_id             UUID REFERENCES public.dreams(id) ON DELETE CASCADE NOT NULL,
  user_id              UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  title                TEXT NOT NULL,
  description          TEXT,
  status               block_status DEFAULT 'scheduled',
  is_critical          BOOLEAN DEFAULT false,
  scheduled_at         TIMESTAMPTZ NOT NULL,
  duration_minutes     INTEGER DEFAULT 30 CHECK (duration_minutes > 0),
  completed_at         TIMESTAMPTZ,
  pre_block_note       TEXT, -- nota do usuário antes do bloco
  post_block_note      TEXT, -- nota do usuário após o bloco
  north_pre_message    TEXT, -- mensagem de North antes do bloco
  north_post_message   TEXT, -- resposta de North após o bloco
  google_event_id      TEXT, -- ID do evento no Google Calendar
  created_at           TIMESTAMPTZ DEFAULT NOW(),
  updated_at           TIMESTAMPTZ DEFAULT NOW()
);

-- ── TABELA: conversations ──────────────────────────────────────
CREATE TABLE public.conversations (
  id                  UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id             UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  dream_id            UUID REFERENCES public.dreams(id) ON DELETE SET NULL,
  block_id            UUID REFERENCES public.blocks(id) ON DELETE SET NULL,
  type                conversation_type NOT NULL,
  messages            JSONB DEFAULT '[]', -- [{role, content, timestamp}]
  insights_extracted  JSONB, -- insights extraídos pelo Memory Updater
  tokens_used         INTEGER DEFAULT 0,
  model_used          TEXT DEFAULT 'claude-haiku-4-5-20251001',
  ended_at            TIMESTAMPTZ,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- ── TABELA: calendar_integrations ─────────────────────────────
CREATE TABLE public.calendar_integrations (
  id                      UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id                 UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  provider                calendar_provider NOT NULL,
  access_token_encrypted  TEXT NOT NULL, -- criptografado com pgcrypto
  refresh_token_encrypted TEXT NOT NULL,
  expires_at              TIMESTAMPTZ,
  sync_enabled            BOOLEAN DEFAULT true,
  last_synced_at          TIMESTAMPTZ,
  created_at              TIMESTAMPTZ DEFAULT NOW(),
  updated_at              TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, provider)
);

-- ── TABELA: witnesses ─────────────────────────────────────────
CREATE TABLE public.witnesses (
  id                          UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  dream_id                    UUID REFERENCES public.dreams(id) ON DELETE CASCADE NOT NULL,
  user_id                     UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  witness_email               TEXT,
  witness_name                TEXT,
  token                       TEXT DEFAULT encode(gen_random_bytes(32), 'hex') UNIQUE,
  is_active                   BOOLEAN DEFAULT true,
  support_message             TEXT,
  support_message_shown_at    TIMESTAMPTZ,
  created_at                  TIMESTAMPTZ DEFAULT NOW()
);

-- ── TABELA: share_cards ───────────────────────────────────────
CREATE TABLE public.share_cards (
  id          UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id     UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  dream_id    UUID REFERENCES public.dreams(id) ON DELETE CASCADE NOT NULL,
  type        TEXT NOT NULL, -- 'milestone', 'completed', '30days', etc.
  data        JSONB DEFAULT '{}',
  slug        TEXT UNIQUE DEFAULT encode(gen_random_bytes(8), 'hex'),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── ROW LEVEL SECURITY ────────────────────────────────────────
-- CRÍTICO: Usuário A nunca acessa dados do Usuário B

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dreams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dream_memories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calendar_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.witnesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.share_cards ENABLE ROW LEVEL SECURITY;

-- Users: acesso apenas ao próprio perfil
CREATE POLICY "users_own_data" ON public.users
  FOR ALL USING (auth.uid() = id);

-- Dreams: CRUD apenas nos próprios sonhos
CREATE POLICY "dreams_own_data" ON public.dreams
  FOR ALL USING (auth.uid() = user_id);

-- Dream Memories: CRUD apenas nas próprias memórias
CREATE POLICY "dream_memories_own_data" ON public.dream_memories
  FOR ALL USING (auth.uid() = user_id);

-- Blocks: CRUD apenas nos próprios blocos
CREATE POLICY "blocks_own_data" ON public.blocks
  FOR ALL USING (auth.uid() = user_id);

-- Conversations: CRUD apenas nas próprias conversas
CREATE POLICY "conversations_own_data" ON public.conversations
  FOR ALL USING (auth.uid() = user_id);

-- Calendar Integrations: CRUD apenas nas próprias integrações
CREATE POLICY "calendar_own_data" ON public.calendar_integrations
  FOR ALL USING (auth.uid() = user_id);

-- Witnesses: dono do sonho pode gerenciar
CREATE POLICY "witnesses_owner_manage" ON public.witnesses
  FOR ALL USING (auth.uid() = user_id);

-- Witnesses: acesso público por token (para a página da Testemunha)
CREATE POLICY "witnesses_public_read_by_token" ON public.witnesses
  FOR SELECT USING (true); -- restringido pelo token na query

-- Share Cards: dono gerencia
CREATE POLICY "share_cards_owner" ON public.share_cards
  FOR ALL USING (auth.uid() = user_id);

-- Share Cards: leitura pública por slug
CREATE POLICY "share_cards_public_read" ON public.share_cards
  FOR SELECT USING (true);

-- ── TRIGGERS: updated_at ──────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER users_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER dreams_updated_at
  BEFORE UPDATE ON public.dreams
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER dream_memories_updated_at
  BEFORE UPDATE ON public.dream_memories
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER blocks_updated_at
  BEFORE UPDATE ON public.blocks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER calendar_updated_at
  BEFORE UPDATE ON public.calendar_integrations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── TRIGGER: criar user profile após signup ────────────────────
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, locale)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'locale', 'en')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ── ÍNDICES ───────────────────────────────────────────────────
CREATE INDEX idx_dreams_user_id ON public.dreams(user_id);
CREATE INDEX idx_dreams_status ON public.dreams(status);
CREATE INDEX idx_blocks_user_id ON public.blocks(user_id);
CREATE INDEX idx_blocks_dream_id ON public.blocks(dream_id);
CREATE INDEX idx_blocks_scheduled_at ON public.blocks(scheduled_at);
CREATE INDEX idx_blocks_status ON public.blocks(status);
CREATE INDEX idx_conversations_user_id ON public.conversations(user_id);
CREATE INDEX idx_conversations_dream_id ON public.conversations(dream_id);
CREATE INDEX idx_conversations_type ON public.conversations(type);
CREATE INDEX idx_witnesses_token ON public.witnesses(token);
CREATE INDEX idx_share_cards_slug ON public.share_cards(slug);

-- Índice vetorial para busca semântica de North
CREATE INDEX idx_dream_memories_embedding
  ON public.dream_memories
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- ── FUNÇÃO: busca semântica de memórias de North ──────────────
CREATE OR REPLACE FUNCTION match_dream_memories(
  query_embedding vector(1536),
  match_user_id UUID,
  match_threshold FLOAT DEFAULT 0.7,
  match_count INT DEFAULT 5
)
RETURNS TABLE (
  id UUID,
  dream_id UUID,
  dream_profile JSONB,
  execution_profile JSONB,
  emotional_profile JSONB,
  conversation_summaries JSONB,
  similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    dm.id,
    dm.dream_id,
    dm.dream_profile,
    dm.execution_profile,
    dm.emotional_profile,
    dm.conversation_summaries,
    1 - (dm.embedding <=> query_embedding) AS similarity
  FROM public.dream_memories dm
  WHERE dm.user_id = match_user_id
    AND dm.embedding IS NOT NULL
    AND 1 - (dm.embedding <=> query_embedding) > match_threshold
  ORDER BY dm.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- ── FUNÇÃO: estatísticas de progresso do usuário ──────────────
CREATE OR REPLACE FUNCTION get_user_progress(p_user_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'total_blocks_completed', (
      SELECT COUNT(*) FROM public.blocks
      WHERE user_id = p_user_id AND status = 'completed'
    ),
    'current_streak', (
      SELECT COUNT(*) FROM (
        SELECT scheduled_at::DATE AS day
        FROM public.blocks
        WHERE user_id = p_user_id
          AND status = 'completed'
          AND scheduled_at >= NOW() - INTERVAL '30 days'
        GROUP BY day
        ORDER BY day DESC
      ) streak_days
    ),
    'dreams_completed', (
      SELECT COUNT(*) FROM public.dreams
      WHERE user_id = p_user_id AND status = 'completed'
    ),
    'active_dream', (
      SELECT row_to_json(d) FROM public.dreams d
      WHERE user_id = p_user_id AND status = 'active'
      LIMIT 1
    )
  ) INTO result;

  RETURN result;
END;
$$;
