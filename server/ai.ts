import OpenAI from "openai";

// Lazily initialize only if a key is provided
const hasKey = !!process.env.OPENAI_API_KEY;
const client = hasKey ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;

type Plan = { summary: string; next_steps: string[] };

export async function aiAnalyze(
  ctx: unknown,
  opts?: { model?: string; maxTokens?: number; temperature?: number }
): Promise<{ plan: Plan; token_usage?: any }> {
  if (!hasKey || !client) {
    // Safe fallback so dev server can run without setting OPENAI_API_KEY
    return {
      plan: {
        summary: "AI disabled (no OPENAI_API_KEY). Proceeding without analysis.",
        next_steps: []
      },
      token_usage: undefined
    };
  }

  const model = opts?.model || process.env.OPENAI_MODEL || "gpt-5-mini";
  const max_tokens = Number(opts?.maxTokens ?? process.env.OPENAI_MAX_TOKENS ?? 400);
  const temperature = Number(opts?.temperature ?? process.env.OPENAI_TEMPERATURE ?? 0.2);

  const resp = await client.chat.completions.create({
    model,
    temperature,
    max_tokens,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: "You are a concise telecom product coach." },
      { role: "user", content: "Return JSON with keys: summary, next_steps." },
      { role: "user", content: JSON.stringify(ctx).slice(0, 6000) }
    ]
  });

  const usage = (resp as any).usage;
  const content = resp.choices[0]?.message?.content || "{}";
  let plan: Plan;
  try { plan = JSON.parse(content); } catch { plan = { summary: content, next_steps: [] }; }
  return { plan, token_usage: usage };
}
