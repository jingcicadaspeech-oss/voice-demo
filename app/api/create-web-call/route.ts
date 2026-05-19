import { NextResponse } from "next/server";
import Retell from "retell-sdk";
import { bots, getBotById } from "@/lib/bots";

export async function POST(request: Request) {
  const apiKey = process.env.RETELL_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { error: "RETELL_API_KEY is not configured." },
      { status: 500 },
    );
  }

  try {
    const body = (await request.json()) as { botId?: string };
    const bot = getBotById(body.botId ?? "");

    if (!bot) {
      return NextResponse.json({ error: "Invalid bot selection." }, { status: 400 });
    }

    const retellClient = new Retell({ apiKey });
    const response = await retellClient.call.createWebCall({
      agent_id: bot.agentId,
      metadata: {
        source: "voice-demo-web",
        bot_id: bot.id,
        bot_name: bot.name,
      },
    });

    return NextResponse.json({
      accessToken: response.access_token,
      callId: response.call_id,
      agentId: response.agent_id,
      agentName: response.agent_name ?? bot.name,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to create voice call.";

    return NextResponse.json({ error: message, availableBots: bots }, { status: 500 });
  }
}
