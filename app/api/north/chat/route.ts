// @ts-nocheck
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { buildNorthPrompt, getModelForConversation } from "@/lib/north/prompt-builder";
import { extractInsights, mergeMemoryProfiles } from "@/lib/north/memory-updater";

export const runtime = "nodejs";
export const maxDuration = 60;


export async function POST(request: Request) {
  try {
    // Verificar API key antes de qualquer coisa
    if (!process.env.ANTHROPIC_API_KEY) {
      console.error("North API error: ANTHROPIC_API_KEY not configured");
      return Response.json({ error: "north_unavailable", message: "North está temporariamente indisponível." }, { status: 503 });
    }

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const { messages, conversationType = "checkin", dreamId, blockId, conversationId, endConversation = false } = body;

    if (!messages || !Array.isArray(messages)) {
      return Response.json({ error: "Messages required" }, { status: 400 });
    }

    // Perfil do utilizador
    const profileResult = await supabase
      .from("users")
      .select("north_tone, locale, subscription_status, free_blocks_used")
      .eq("id", user.id)
      .single();
    const profile = profileResult.data;

    // Verificar limite free
    if (
      profile?.subscription_status === "free" &&
      (profile?.free_blocks_used || 0) >= 3 &&
      (conversationType === "pre_block" || conversationType === "post_block")
    ) {
      return Response.json({ error: "free_limit_reached" }, { status: 402 });
    }

    // Memória de North
    let memory = null;
    if (dreamId) {
      const memResult = await supabase
        .from("dream_memories")
        .select("*")
        .eq("dream_id", dreamId)
        .eq("user_id", user.id)
        .single();
      memory = memResult.data;
    }

    // Contexto do bloco actual
    let currentBlock = null;
    if (blockId) {
      const blockResult = await supabase
        .from("blocks")
        .select("title, scheduled_at, is_critical")
        .eq("id", blockId)
        .eq("user_id", user.id)
        .single();
      const blockData = blockResult.data;
      if (blockData) {
        const countResult = await supabase
          .from("blocks")
          .select("id", { count: "exact" })
          .eq("dream_id", dreamId)
          .eq("user_id", user.id)
          .eq("status", "completed");
        currentBlock = {
          title: blockData.title,
          scheduledAt: blockData.scheduled_at,
          isFirst: (countResult.count || 0) === 0,
        };
      }
    }

    // Streak actual
    const streakResult = await supabase
      .from("blocks")
      .select("id", { count: "exact" })
      .eq("user_id", user.id)
      .eq("status", "completed")
      .gte("scheduled_at", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

    // Total blocos completados
    const totalResult = await supabase
      .from("blocks")
      .select("id", { count: "exact" })
      .eq("user_id", user.id)
      .eq("status", "completed");

    // Prompt de North
    const systemPrompt = buildNorthPrompt({
      userId: user.id,
      dreamId,
      conversationType,
      northTone: profile?.north_tone || "direct",
      memory,
      currentBlock,
      streak: streakResult.count || 0,
      blocksCompleted: totalResult.count || 0,
      locale: profile?.locale || "en",
    });

    const model = getModelForConversation(conversationType);
    const formattedMessages = messages.map((m: any) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));

    // Capturar key ANTES do stream (process.env pode ser undefined dentro do callback)
    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    if (!anthropicKey) {
      return Response.json({ error: "north_unavailable" }, { status: 503 });
    }

    // Streaming
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          let totalTokens = 0;
          let fullResponse = "";

          const response = await new Anthropic({ apiKey: anthropicKey }).messages.create({
            model,
            max_tokens: 1024,
            system: systemPrompt,
            messages: formattedMessages,
            stream: true,
          });

          for await (const chunk of response) {
            if (chunk.type === "content_block_delta") {
              const text = chunk.delta.type === "text_delta" ? chunk.delta.text : "";
              if (text) {
                fullResponse += text;
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text })}\n\n`));
              }
            }
            if (chunk.type === "message_delta" && chunk.usage) {
              totalTokens = chunk.usage.output_tokens;
            }
          }

          // Salvar conversa
          const allMessages = [
            ...messages,
            { role: "assistant", content: fullResponse, timestamp: new Date().toISOString() },
          ];

          const savedConvId = await saveConversation({
            supabase, userId: user.id, dreamId, blockId,
            conversationId, conversationType,
            messages: allMessages, tokensUsed: totalTokens, model,
          });

          // Memory Updater: executar quando conversa termina
          if (endConversation && dreamId && allMessages.length >= 4) {
            runMemoryUpdater({
              supabase, userId: user.id, dreamId,
              messages: allMessages, conversationType,
              existingMemory: memory,
            }).catch(console.error);
          }

          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true, conversationId: savedConvId })}\n\n`));
          controller.close();
        } catch (error) {
          console.error("North stream error:", (error as any)?.status, (error as any)?.message, "| KEY:", anthropicKey?.slice(0, 20));
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: "Stream failed" })}\n\n`));
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("North API error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

async function saveConversation({ supabase, userId, dreamId, blockId, conversationId, conversationType, messages, tokensUsed, model }: any) {
  if (conversationId) {
    await supabase.from("conversations")
      .update({ messages, tokens_used: tokensUsed, ended_at: new Date().toISOString() })
      .eq("id", conversationId).eq("user_id", userId);
    return conversationId;
  } else {
    const result = await supabase.from("conversations").insert({
      user_id: userId, dream_id: dreamId || null, block_id: blockId || null,
      type: conversationType, messages, tokens_used: tokensUsed, model_used: model,
    }).select("id").single();
    return result.data?.id;
  }
}

async function runMemoryUpdater({ supabase, userId, dreamId, messages, conversationType, existingMemory }: any) {
  const insights = await extractInsights(messages, conversationType, existingMemory);
  if (!insights) return;

  const existingData = existingMemory || {};
  const updatedMemory = mergeMemoryProfiles(existingData, insights);

  // Verificar se existe registo
  const existing = await supabase
    .from("dream_memories")
    .select("id")
    .eq("dream_id", dreamId)
    .eq("user_id", userId)
    .single();

  if (existing.data) {
    await supabase.from("dream_memories")
      .update({ ...updatedMemory, updated_at: new Date().toISOString() })
      .eq("dream_id", dreamId).eq("user_id", userId);
  } else {
    await supabase.from("dream_memories").insert({
      dream_id: dreamId, user_id: userId, ...updatedMemory,
    });
  }

  // Sinalizar risk flags se críticos
  if (insights.risk_flags?.length > 0) {
    console.log(`[North] Risk flags for user ${userId}:`, insights.risk_flags);
  }
}
