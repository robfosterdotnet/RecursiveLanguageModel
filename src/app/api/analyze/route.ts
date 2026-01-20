import { NextResponse } from "next/server";
import { analyze } from "@/lib/analyze";
import type { AnalyzeRequest } from "@/lib/types";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as AnalyzeRequest;

    if (!body.question || !body.documents || body.documents.length === 0) {
      return NextResponse.json(
        { error: "Provide at least one document and a question." },
        { status: 400 },
      );
    }

    const response = await analyze(body);
    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unexpected error.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
