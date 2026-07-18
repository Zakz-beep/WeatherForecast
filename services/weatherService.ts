export interface City {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  country: string;
  admin1?: string; // state/province
  timezone: string;
}

import { supabase } from "@/lib/supabaseClient";

export interface WeatherData {
  current: {
    temperature_2m: number;
    relative_humidity_2m: number;
    apparent_temperature: number;
    is_day: number;
    precipitation: number;
    weather_code: number;
    wind_speed_10m: number;
    time: string;
  };
  daily: {
    time: string[];
    weather_code: number[];
    temperature_2m_max: number[];
    temperature_2m_min: number[];
    sunrise: string[];
    sunset: string[];
    precipitation_sum?: number[];
    wind_speed_10m_max?: number[];
  };
}

export interface HourlyForecastData {
  hourly: {
    time: string[];
    temperature_2m: number[];
  };
}

export async function searchCities(query: string): Promise<City[]> {
  if (!query) return [];
  const res = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=5&language=id&format=json`);
  const data = await res.json();
  return data.results || [];
}

export async function getWeather(lat: number, lon: number): Promise<WeatherData | null> {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,precipitation_sum,wind_speed_10m_max&timezone=auto`;
  try {
    const res = await fetch(url);
    const data = await res.json();
    return data;
  } catch (error) {
    console.error("Error fetching weather data:", error);
    return null;
  }
}

export async function getHourlyHistory(lat: number, lon: number): Promise<HourlyForecastData | null> {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&hourly=temperature_2m&past_days=2&forecast_days=1`;
  try {
    const res = await fetch(url);
    const data = await res.json();
    return data;
  } catch (error) {
    console.error("Error fetching hourly history:", error);
    return null;
  }
}

export interface WeatherComparisonRow {
  date: string;
  city: string;
  actual_temp_max: number;
  forecast_temp_max: number;
  actual_wind_max: number | null;
  forecast_wind_max: number | null;
}

export async function getWeatherHistory2026(): Promise<WeatherComparisonRow[]> {
  try {
    const { data, error } = await supabase
      .from("weather_comparison_2026")
      .select("*")
      .order("date", { ascending: true });
    
    if (error) {
      if (error.code === "PGRST205") {
        // Table doesn't exist yet, return empty
        return [];
      }
      throw error;
    }
    return data || [];
  } catch (e) {
    console.error("Failed to query 2026 weather history from Supabase:", e);
    return [];
  }
}
