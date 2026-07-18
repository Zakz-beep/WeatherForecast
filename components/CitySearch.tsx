"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { searchCities, City } from "@/services/weatherService";
import { Search, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";

export default function CitySearch({ className, variant = "small" }: { className?: string; variant?: "small" | "large" }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<City[]>([]);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const delayDebounceFn = setTimeout(async () => {
      if (query.length > 2) {
        setLoading(true);
        const res = await searchCities(query);
        setResults(res);
        setLoading(false);
      } else {
        setResults([]);
      }
    }, 500);

    return () => clearTimeout(delayDebounceFn);
  }, [query]);

  const handleSelect = (city: City) => {
    setQuery("");
    setResults([]);
    router.push(`/?lat=${city.latitude}&lon=${city.longitude}&name=${encodeURIComponent(city.name)}`);
  };

  const isLarge = variant === "large";

  return (
    <div className={cn("relative w-full", isLarge ? "max-w-2xl" : "max-w-md", className)}>
      <div className={cn(
        "relative flex items-center w-full rounded-full focus-within:shadow-xl bg-white dark:bg-slate-900 overflow-hidden border border-slate-200 dark:border-slate-800 transition-all duration-300",
        isLarge ? "h-16 shadow-lg hover:border-blue-400 dark:hover:border-blue-500" : "h-12 border-slate-200 dark:border-slate-700"
      )}>
        <div className={cn("grid place-items-center h-full text-slate-400 dark:text-slate-500", isLarge ? "w-16" : "w-12")}>
          <Search size={isLarge ? 24 : 20} />
        </div>
        <input
          className={cn(
            "peer h-full w-full outline-none text-slate-700 dark:text-slate-200 pr-4 bg-transparent",
            isLarge ? "text-lg" : "text-sm pr-2"
          )}
          type="text"
          id="search"
          placeholder="Cari kota (misal: Jakarta, Tokyo)..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      
      {results.length > 0 && (
        <div className="absolute z-50 w-full mt-3 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-100 dark:border-slate-800 overflow-hidden transition-all duration-300">
          <ul>
            {results.map((city) => (
              <li
                key={city.id}
                onClick={() => handleSelect(city)}
                className="px-5 py-4 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer flex items-center text-sm sm:text-base text-slate-700 dark:text-slate-300 transition-colors border-b last:border-0 border-slate-100 dark:border-slate-800"
              >
                <MapPin size={isLarge ? 18 : 16} className="mr-3 text-blue-500 flex-shrink-0" />
                <div className="flex flex-col sm:flex-row sm:items-center">
                  <span className="font-semibold text-slate-800 dark:text-slate-100">{city.name}</span>
                  <span className="text-slate-400 dark:text-slate-500 text-xs sm:text-sm sm:ml-2">
                    {city.admin1 ? `${city.admin1}, ` : ""}{city.country}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
      {loading && (
        <div className="absolute z-50 w-full mt-3 bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-100 dark:border-slate-800 p-4 text-center text-sm text-slate-500 dark:text-slate-400">
          Mencari lokasi...
        </div>
      )}
    </div>
  );
}
