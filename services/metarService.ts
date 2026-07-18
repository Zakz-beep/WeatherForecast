export interface MetarData {
  icaoId: string;
  receiptTime: string;
  obsTime: number;
  reportTime: string;
  temp: number;
  dewp: number;
  wdir: number;
  wspd: number;
  wgst: number | null;
  visib: number;
  altim: number;
  slp: number;
  wxString: string | null;
  rawOb: string;
  lat: number;
  lon: number;
  elev: number;
  name: string;
  cover?: string;
  clouds?: Array<{ cover: string; base: number }>;
  fltCat?: string;
}

export async function getNearbyMetar(lat: number, lon: number): Promise<MetarData | null> {
  const diff = 0.5; // roughly 55km bounding box
  const minLat = lat - diff;
  const maxLat = lat + diff;
  const minLon = lon - diff;
  const maxLon = lon + diff;
  
  const url = `https://aviationweather.gov/api/data/metar?bbox=${minLat},${minLon},${maxLat},${maxLon}&format=json`;
  
  try {
    const res = await fetch(url);
    const data: MetarData[] = await res.json();
    if (data && data.length > 0) {
      // Find the closest one
      let closest = data[0];
      let minDistance = Number.MAX_VALUE;
      for (const station of data) {
        const dist = Math.sqrt(Math.pow(station.lat - lat, 2) + Math.pow(station.lon - lon, 2));
        if (dist < minDistance) {
          minDistance = dist;
          closest = station;
        }
      }
      return closest;
    }
    return null;
  } catch (error) {
    console.error("Error fetching METAR data:", error);
    return null;
  }
}

export async function getHistoricalMetar(icaoId: string, hours: number = 48): Promise<MetarData[]> {
  const url = `https://aviationweather.gov/api/data/metar?ids=${icaoId}&format=json&hours=${hours}`;
  try {
    const res = await fetch(url);
    const data: MetarData[] = await res.json();
    return data || [];
  } catch (error) {
    console.error("Error fetching historical METAR:", error);
    return [];
  }
}
