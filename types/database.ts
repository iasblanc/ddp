// ============================================================
// DATABASE TYPES — Dont Dream. Plan.
// Gerado manualmente. Após setup do Supabase, substituir por:
// npx supabase gen types typescript --project-id <id> > types/database.ts
// ============================================================

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type DreamStatus =
  | "maturing"
  | "active"
  | "queued"
  | "completed"
  | "archived"
  | "paused";

export type DreamMaturityStage = 1 | 2 | 3;

export type BlockStatus =
  | "scheduled"
  | "completed"
  | "missed"
  | "skipped"
  | "active";

export type ConversationType =
  | "extraction"
  | "checkin"
  | "pre_block"
  | "post_block"
  | "crisis"
  | "revaluation"
  | "maturation";

export type NorthTone = "direct" | "gentle" | "provocative";

export type CalendarProvider = "google" | "apple" | "outlook";

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          email: string;
          north_tone: NorthTone;
          locale: string;
          onboarding_completed_at: string | null;
          subscription_status: "free" | "pro" | "team";
          subscription_ends_at: string | null;
          free_blocks_used: number;
          push_subscription: Json | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          north_tone?: NorthTone;
          locale?: string;
          onboarding_completed_at?: string | null;
          subscription_status?: "free" | "pro" | "team";
          subscription_ends_at?: string | null;
          free_blocks_used?: number;
          push_subscription?: Json | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["users"]["Insert"]>;
      };

      dreams: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          description: string | null;
          status: DreamStatus;
          maturity_stage: DreamMaturityStage;
          declared_deadline: string | null;
          calibrated_deadline: string | null;
          blocks_per_week: number;
          position: number;
          archived_reason: string | null;
          created_at: string;
          activated_at: string | null;
          completed_at: string | null;
          archived_at: string | null;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          title: string;
          description?: string | null;
          status?: DreamStatus;
          maturity_stage?: DreamMaturityStage;
          declared_deadline?: string | null;
          calibrated_deadline?: string | null;
          blocks_per_week?: number;
          position?: number;
          archived_reason?: string | null;
          created_at?: string;
          activated_at?: string | null;
          completed_at?: string | null;
          archived_at?: string | null;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["dreams"]["Insert"]>;
      };

      dream_memories: {
        Row: {
          id: string;
          dream_id: string;
          user_id: string;
          dream_profile: Json;
          execution_profile: Json;
          emotional_profile: Json;
          conversation_summaries: Json;
          embeddings_updated_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          dream_id: string;
          user_id: string;
          dream_profile?: Json;
          execution_profile?: Json;
          emotional_profile?: Json;
          conversation_summaries?: Json;
          embeddings_updated_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["dream_memories"]["Insert"]>;
      };

      blocks: {
        Row: {
          id: string;
          dream_id: string;
          user_id: string;
          title: string;
          description: string | null;
          status: BlockStatus;
          is_critical: boolean;
          scheduled_at: string;
          duration_minutes: number;
          completed_at: string | null;
          pre_block_note: string | null;
          post_block_note: string | null;
          north_pre_message: string | null;
          north_post_message: string | null;
          google_event_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          dream_id: string;
          user_id: string;
          title: string;
          description?: string | null;
          status?: BlockStatus;
          is_critical?: boolean;
          scheduled_at: string;
          duration_minutes?: number;
          completed_at?: string | null;
          pre_block_note?: string | null;
          post_block_note?: string | null;
          north_pre_message?: string | null;
          north_post_message?: string | null;
          google_event_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["blocks"]["Insert"]>;
      };

      conversations: {
        Row: {
          id: string;
          user_id: string;
          dream_id: string | null;
          block_id: string | null;
          type: ConversationType;
          messages: Json;
          insights_extracted: Json | null;
          tokens_used: number;
          model_used: string;
          ended_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          dream_id?: string | null;
          block_id?: string | null;
          type: ConversationType;
          messages?: Json;
          insights_extracted?: Json | null;
          tokens_used?: number;
          model_used?: string;
          ended_at?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["conversations"]["Insert"]>;
      };

      calendar_integrations: {
        Row: {
          id: string;
          user_id: string;
          provider: CalendarProvider;
          access_token_encrypted: string;
          refresh_token_encrypted: string;
          expires_at: string | null;
          sync_enabled: boolean;
          last_synced_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          provider: CalendarProvider;
          access_token_encrypted: string;
          refresh_token_encrypted: string;
          expires_at?: string | null;
          sync_enabled?: boolean;
          last_synced_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["calendar_integrations"]["Insert"]>;
      };

      witnesses: {
        Row: {
          id: string;
          dream_id: string;
          user_id: string;
          witness_email: string | null;
          witness_name: string | null;
          token: string;
          is_active: boolean;
          support_message: string | null;
          support_message_shown_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          dream_id: string;
          user_id: string;
          witness_email?: string | null;
          witness_name?: string | null;
          token?: string;
          is_active?: boolean;
          support_message?: string | null;
          support_message_shown_at?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["witnesses"]["Insert"]>;
      };
    };
    Views: {};
    Functions: {};
    Enums: {
      dream_status: DreamStatus;
      dream_maturity_stage: DreamMaturityStage;
      block_status: BlockStatus;
      conversation_type: ConversationType;
      north_tone: NorthTone;
      calendar_provider: CalendarProvider;
    };
  };
}

// ── HELPER TYPES ─────────────────────────────────────────────
export type User = Database["public"]["Tables"]["users"]["Row"];
export type Dream = Database["public"]["Tables"]["dreams"]["Row"];
export type DreamMemory = Database["public"]["Tables"]["dream_memories"]["Row"];
export type Block = Database["public"]["Tables"]["blocks"]["Row"];
export type Conversation = Database["public"]["Tables"]["conversations"]["Row"];
export type CalendarIntegration = Database["public"]["Tables"]["calendar_integrations"]["Row"];
export type Witness = Database["public"]["Tables"]["witnesses"]["Row"];

// ── DREAM MEMORY PROFILES ────────────────────────────────────
export interface DreamProfile {
  dream_declared: string;
  dream_real: string | null;
  deadline_declared: string | null;
  deadline_calibrated: string | null;
  obstacle_declared: string | null;
  obstacle_real: string | null;
  recurring_words: string[];
  previous_attempts: string[];
  last_updated: string;
}

export interface ExecutionProfile {
  real_times: string[];
  declared_times: string[];
  strong_days: string[];
  weak_days: string[];
  avg_real_duration: number;
  abandonment_pattern: string | null;
  current_streak: number;
  best_streak: number;
}

export interface EmotionalProfile {
  preferred_tone: NorthTone;
  reacts_badly_to: string[];
  reacts_well_to: string[];
  crisis_moments: string[];
  abandonment_triggers: string[];
  resistance_language: string[];
}

export interface ConversationSummary {
  conversation_id: string;
  type: ConversationType;
  date: string;
  summary: string;
  decisions: string[];
  revelations: string[];
  emotional_state: string;
  risk_flags: string[];
}
