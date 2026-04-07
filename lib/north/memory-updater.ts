// @ts-nocheck
// ============================================================
// MEMORY UPDATER — Extrai insights após cada conversa
// Usa Claude Haiku para actualizar os 4 perfis de North
// ============================================================

import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

export interface ConversationInsights {
  dream_profile_updates: Record<string, any>;
  execution_profile_updates: Record<string, any>;
  emotional_profile_updates: Record<string, any>;
  conversation_summary: {
    type: string;
    date: string;
    summary: string;
    decisions: string[];
    revelations: string[];
    emotional_state: string;
    risk_flags: string[];
  };
  risk_flags: string[];
}

export async function extractInsights(
  messages: Array<{ role: string; content: string }>,
  conversationType: string,
  existingMemory: Record<string, any> | null
): Promise<ConversationInsights | null> {
  try {
    const transcript = messages
      .map((m) => `${m.role === "user" ? "USER" : "NORTH"}: ${m.content}`)
      .join("\n");

    const prompt = `Analyse this conversation between North (AI) and user about their dream/goal.
Extract structured insights to update North's memory profile.

CONVERSATION TYPE: ${conversationType}

TRANSCRIPT:
${transcript}

EXISTING MEMORY (for context):
${JSON.stringify(existingMemory || {}, null, 2)}

Return ONLY valid JSON with this exact structure:
{
  "dream_profile_updates": {
    "dream_real": "deeper desire behind stated dream, or null if not revealed",
    "obstacle_real": "real obstacle (internal/fear/identity) or null",
    "recurring_words": ["word1", "word2"],
    "previous_attempts": ["attempt1"]
  },
  "execution_profile_updates": {
    "strong_days": ["monday"],
    "weak_days": ["friday"],
    "abandonment_pattern": "description or null"
  },
  "emotional_profile_updates": {
    "reacts_badly_to": ["pressure", "comparison"],
    "reacts_well_to": ["specificity", "silence"],
    "resistance_language": ["I don't have time", "maybe later"]
  },
  "conversation_summary": {
    "type": "${conversationType}",
    "date": "${new Date().toISOString().split("T")[0]}",
    "summary": "2-3 sentence summary of what happened",
    "decisions": ["decision made"],
    "revelations": ["important thing revealed"],
    "emotional_state": "calm/anxious/motivated/resistant/open",
    "risk_flags": ["risk if any"]
  },
  "risk_flags": ["abandonment_risk", "emotional_distress", "plan_unrealistic"]
}

Return only the JSON object. No markdown, no explanation.`;

    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 800,
      messages: [{ role: "user", content: prompt }],
    });

    const text =
      response.content[0].type === "text" ? response.content[0].text : "";
    const cleaned = text.replace(/```json|```/g, "").trim();
    return JSON.parse(cleaned) as ConversationInsights;
  } catch (error) {
    console.error("Memory updater error:", error);
    return null;
  }
}

export function mergeMemoryProfiles(
  existing: Record<string, any>,
  updates: ConversationInsights
): Record<string, any> {
  const dreamProfile = existing.dream_profile || {};
  const executionProfile = existing.execution_profile || {};
  const emotionalProfile = existing.emotional_profile || {};
  const summaries = (existing.conversation_summaries || []) as any[];

  // Merge dream profile (only update non-null values)
  const newDreamProfile = { ...dreamProfile };
  for (const [key, value] of Object.entries(
    updates.dream_profile_updates || {}
  )) {
    if (value !== null && value !== undefined) {
      if (Array.isArray(value) && Array.isArray(newDreamProfile[key])) {
        newDreamProfile[key] = [...new Set([...newDreamProfile[key], ...value])];
      } else {
        newDreamProfile[key] = value;
      }
    }
  }

  // Merge execution profile
  const newExecutionProfile = { ...executionProfile };
  for (const [key, value] of Object.entries(
    updates.execution_profile_updates || {}
  )) {
    if (value !== null && value !== undefined) {
      if (Array.isArray(value) && Array.isArray(newExecutionProfile[key])) {
        newExecutionProfile[key] = [
          ...new Set([...newExecutionProfile[key], ...value]),
        ];
      } else {
        newExecutionProfile[key] = value;
      }
    }
  }

  // Merge emotional profile
  const newEmotionalProfile = { ...emotionalProfile };
  for (const [key, value] of Object.entries(
    updates.emotional_profile_updates || {}
  )) {
    if (value !== null && value !== undefined) {
      if (Array.isArray(value) && Array.isArray(newEmotionalProfile[key])) {
        newEmotionalProfile[key] = [
          ...new Set([...newEmotionalProfile[key], ...value]),
        ];
      } else {
        newEmotionalProfile[key] = value;
      }
    }
  }

  // Add conversation summary (keep last 5)
  const newSummaries = [...summaries, updates.conversation_summary].slice(-5);

  return {
    dream_profile: newDreamProfile,
    execution_profile: newExecutionProfile,
    emotional_profile: newEmotionalProfile,
    conversation_summaries: newSummaries,
  };
}
