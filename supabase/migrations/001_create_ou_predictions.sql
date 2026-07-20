-- Migration: Create ou_predictions table for OU Backtesting feature
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard/project/jxnmuxbkcovjmwmjlxwn/sql

CREATE TABLE IF NOT EXISTS ou_predictions (
  date             DATE PRIMARY KEY,          -- tanggal prediksi dibuat
  target_date      DATE NOT NULL,             -- tanggal yang diprediksi (esok hari)
  predicted_p50    NUMERIC(5,2) NOT NULL,     -- OU median forecast (°C)
  predicted_p10    NUMERIC(5,2),              -- P10 percentile (°C)
  predicted_p90    NUMERIC(5,2),              -- P90 percentile (°C)
  ou_mean          NUMERIC(5,2),              -- E[T] OU conditional mean
  theta            NUMERIC(4,3),              -- θ (mean-reversion speed) used
  regime           TEXT,                      -- monsoon regime label
  source_temp      NUMERIC(5,2),              -- T_t input temperature (correctedPeak)
  confidence_score INT,                       -- 0–100 confidence decay score
  created_at       TIMESTAMPTZ DEFAULT now()
);

-- Enable Row Level Security (optional, anon read is sufficient)
ALTER TABLE ou_predictions ENABLE ROW LEVEL SECURITY;

-- Allow anon read (for backtesting panel)
CREATE POLICY "Allow anon select" ON ou_predictions
  FOR SELECT USING (true);

-- Allow anon insert/upsert (for logging predictions)
CREATE POLICY "Allow anon upsert" ON ou_predictions
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow anon update" ON ou_predictions
  FOR UPDATE USING (true);
