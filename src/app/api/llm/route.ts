import { NextResponse } from "next/server";
import { llmStatus, rewriteCreative, type RewriteRequest } from "@/lib/llm/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Reports whether copy assistance is configured. Never leaks the key. */
export function GET() {
  const status = llmStatus();
  return NextResponse.json({
    available: status.available,
    provider: status.provider,
    model: status.model,
    reason: status.reason,
  });
}

export async function POST(request: Request) {
  let body: Partial<RewriteRequest>;
  try {
    body = (await request.json()) as Partial<RewriteRequest>;
  } catch {
    return NextResponse.json({ error: "Malformed request body." }, { status: 400 });
  }

  if (!body.headline || !body.body) {
    return NextResponse.json({ error: "headline and body are required." }, { status: 400 });
  }

  const result = await rewriteCreative({
    headline: body.headline,
    body: body.body,
    cta: body.cta ?? "",
    brand: body.brand ?? "the brand",
    segment: body.segment ?? "the target segment",
    channel: body.channel ?? "paid social",
    purpose: body.purpose ?? "",
    mustAvoid: Array.isArray(body.mustAvoid) ? body.mustAvoid.slice(0, 10) : [],
  });

  return NextResponse.json(result);
}
