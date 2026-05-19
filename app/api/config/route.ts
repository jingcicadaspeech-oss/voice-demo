import { NextResponse } from "next/server";
import { bots } from "@/lib/bots";

export async function GET() {
  return NextResponse.json({
    appName: "voice demo",
    companyName: "Cicada Speech",
    bots,
  });
}
