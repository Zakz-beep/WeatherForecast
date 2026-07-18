import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json({ error: "Supabase credentials are not configured in environment variables." }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey);

  try {
    // 1. Fetch Singapore Changi 2026 history from Open-Meteo Archive API
    // Let's get data from Jan 1, 2026 to July 15, 2026
    const lat = 1.3644;
    const lon = 103.9915;
    const url = `https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lon}&start_date=2026-01-01&end_date=2026-07-15&daily=temperature_2m_max,wind_speed_10m_max&timezone=auto`;
    
    const res = await fetch(url);
    const apiData = await res.json();

    if (!apiData.daily) {
      return NextResponse.json({ error: "Failed to fetch historical data from Open-Meteo." }, { status: 500 });
    }

    const { time, temperature_2m_max, wind_speed_10m_max } = apiData.daily;

    // 2. Prepare database rows with slight variations to simulate Forecast vs Actual
    const rows = time.map((dateStr: string, idx: number) => {
      const actualTempMax = temperature_2m_max[idx];
      const actualWindMax = wind_speed_10m_max[idx];

      if (actualTempMax === null) return null;

      // Add a pseudo-random variation to simulate forecast deviation (standard error of forecast)
      // We use a deterministic-looking random seed based on index to keep it consistent
      const seed = Math.sin(idx) * 10000;
      const tempDeviation = (seed - Math.floor(seed)) * 3 - 1.5; // -1.5 to +1.5 degrees
      const windDeviation = (seed - Math.floor(seed)) * 4 - 2; // -2 to +2 km/h

      const forecastTempMax = parseFloat((actualTempMax + tempDeviation).toFixed(1));
      const forecastWindMax = actualWindMax !== null 
        ? parseFloat(Math.max(0, actualWindMax + windDeviation).toFixed(1)) 
        : null;

      return {
        date: dateStr,
        city: "Singapore (WSSS)",
        actual_temp_max: actualTempMax,
        forecast_temp_max: forecastTempMax,
        actual_wind_max: actualWindMax,
        forecast_wind_max: forecastWindMax
      };
    }).filter(Boolean);

    // 3. Upsert data to Supabase (so running it multiple times is safe)
    const { error } = await supabase
      .from("weather_comparison_2026")
      .upsert(rows, { onConflict: "date" });

    if (error) {
      throw error;
    }

    return NextResponse.json({ success: true, count: rows.length });
  } catch (err) {
    console.error("Seeding error:", err);
    const message = err instanceof Error ? err.message : "Failed to seed data.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
