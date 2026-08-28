import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import {
  aiMetadataJsonSchema,
  isAiMetadataSuggestion,
  prepareAiMetadataRequest,
} from "../../../lib/ai-metadata";

const userWindows = new Map<string, { startedAt: number; count: number }>();

function limited(userId: string) {
  const now = Date.now();
  const current = userWindows.get(userId);
  if (!current || now - current.startedAt >= 60_000) {
    if (userWindows.size > 2_000) userWindows.clear();
    userWindows.set(userId, { startedAt: now, count: 1 });
    return false;
  }
  current.count += 1;
  return current.count > 10;
}

export async function POST(request: NextRequest) {
  if (!process.env.GROQ_API_KEY)
    return NextResponse.json(
      { error: "AI metadata assistance is not configured." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const token = request.headers
    .get("authorization")
    ?.replace(/^Bearer\s+/i, "");
  if (!supabaseUrl || !supabaseAnonKey || !token)
    return NextResponse.json(
      { error: "Sign in is required." },
      { status: 401 },
    );
  const auth = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await auth.auth.getUser(token);
  if (error || !data.user)
    return NextResponse.json(
      { error: "Your session could not be verified." },
      { status: 401 },
    );
  if (limited(data.user.id))
    return NextResponse.json(
      { error: "AI assistance limit reached. Try again in a minute." },
      { status: 429, headers: { "Retry-After": "60" } },
    );
  const contentLength = Number(request.headers.get("content-length")) || 0;
  if (contentLength > 20_000)
    return NextResponse.json(
      { error: "Book metadata is too large." },
      { status: 413 },
    );
  if (!request.headers.get("content-type")?.includes("application/json"))
    return NextResponse.json(
      { error: "AI metadata requests must use JSON." },
      { status: 415, headers: { "Cache-Control": "no-store" } },
    );
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "AI metadata request contains invalid JSON." },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }
  const prepared = prepareAiMetadataRequest(body);
  if (!prepared)
    return NextResponse.json(
      { error: "Add a title, author, or ISBN before requesting AI review." },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  const input = JSON.stringify(prepared);
  let response: Response;
  try {
    response = await fetch("https://api.groq.com/openai/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.GROQ_METADATA_MODEL || "openai/gpt-oss-20b",
        store: false,
        max_output_tokens: 900,
        instructions:
          "Review a private book catalog record. Prefer supplied provider candidates over memory. Return null for unknown fields, never invent an ISBN or exact page count, preserve Bengali text when appropriate, and explain uncertainty briefly. Suggestions are reviewed by the user and never applied automatically.",
        input,
        text: {
          format: {
            type: "json_schema",
            name: "book_metadata_suggestion",
            strict: true,
            schema: aiMetadataJsonSchema,
          },
        },
      }),
      signal: AbortSignal.timeout(20_000),
    });
  } catch {
    return NextResponse.json(
      { error: "AI metadata assistance is temporarily unavailable." },
      { status: 502, headers: { "Cache-Control": "no-store" } },
    );
  }
  if (!response.ok)
    return NextResponse.json(
      { error: "AI metadata assistance is temporarily unavailable." },
      { status: 502 },
    );
  const payload = (await response.json()) as {
    output_text?: string;
    output?: Array<{ content?: Array<{ type?: string; text?: string }> }>;
  };
  const outputText =
    payload.output_text ??
    payload.output
      ?.flatMap((item) => item.content ?? [])
      .find((item) => item.type === "output_text")?.text;
  if (!outputText)
    return NextResponse.json(
      { error: "AI returned no usable suggestion." },
      { status: 502 },
    );
  try {
    const suggestion: unknown = JSON.parse(outputText);
    if (!isAiMetadataSuggestion(suggestion))
      return NextResponse.json(
        { error: "AI returned an invalid suggestion." },
        { status: 502 },
      );
    return NextResponse.json(
      { suggestion },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      { error: "AI returned an invalid suggestion." },
      { status: 502 },
    );
  }
}
