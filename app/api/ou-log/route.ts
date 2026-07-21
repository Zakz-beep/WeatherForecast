/**
 * app/api/ou-log/route.ts
 * POST  → Upsert today's OU prediction into Supabase `ou_predictions` table.
 *         Idempotent: safe to call on every page render (upsert on date PK).
 * GET   → Fetch all stored OU predictions (for backtesting panel).
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Supabase env vars not set");
  return createClient(url, key);
}

// ── Auto-create table if it doesn't exist ────────────────────────────────────
// We use a raw SQL RPC call via Supabase's REST API (pg_query workaround).
// If the anon role doesn't have DDL perms, this is a no-op and the POST will
// fail gracefully without crashing the page.
async function ensureTable(supabase: SupabaseClient) {
  const sql = `
    CREATE TABLE IF NOT EXISTS ou_predictions (
      date             DATE PRIMARY KEY,
      target_date      DATE NOT NULL,
      predicted_p50    NUMERIC(5,2) NOT NULL,
      predicted_p10    NUMERIC(5,2),
      predicted_p90    NUMERIC(5,2),
      ou_mean          NUMERIC(5,2),
      theta            NUMERIC(4,3),
      regime           TEXT,
      source_temp      NUMERIC(5,2),
      confidence_score INT,
      created_at       TIMESTAMPTZ DEFAULT now()
    );
  `;
  // Try calling a custom RPC 'exec_sql' if it exists; ignore errors silently.
  try {
    await supabase.rpc("exec_sql", { sql });
  } catch {
    // No-op: table may already exist or RPC not available
  }
}

// ── POST: Log today's OU prediction ──────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const supabase = getSupabase();

    await ensureTable(supabase);

    const { error } = await supabase
      .from("ou_predictions")
      .upsert([body], { onConflict: "date" });

    if (error) {
      // If table doesn't exist (42P01), return graceful message
      if (error.code === "42P01") {
        return NextResponse.json(
          { ok: false, reason: "Table ou_predictions does not exist yet. Run migration first." },
          { status: 202 }
        );
      }
      throw error;
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[ou-log POST]", err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}

// ── GET: Retrieve all OU predictions ─────────────────────────────────────────
export async function GET() {
  try {
    const supabase = getSupabase();

    const { data, error } = await supabase
      .from("ou_predictions")
      .select("*")
      .order("date", { ascending: true });

    if (error) {
      if (error.code === "42P01" || error.code === "PGRST205") {
        return NextResponse.json({ data: [], reason: "Table not yet created" });
      }
      throw error;
    }

    return NextResponse.json({ data: data ?? [] });
  } catch (err) {
    console.error("[ou-log GET]", err);
    return NextResponse.json({ data: [], error: String(err) }, { status: 500 });
  }
}
