import { Cloud, CloudDrizzle, CloudFog, CloudLightning, CloudRain, CloudSnow, Sun, CloudSun } from "lucide-react";

export function getWeatherInfo(code: number) {
  switch (code) {
    case 0: return { label: "Cerah", icon: Sun };
    case 1:
    case 2:
    case 3: return { label: "Berawan", icon: CloudSun };
    case 45:
    case 48: return { label: "Berkabut", icon: CloudFog };
    case 51:
    case 53:
    case 55: return { label: "Gerimis", icon: CloudDrizzle };
    case 61:
    case 63:
    case 65: return { label: "Hujan", icon: CloudRain };
    case 71:
    case 73:
    case 75: return { label: "Salju", icon: CloudSnow };
    case 95:
    case 96:
    case 99: return { label: "Badai Petir", icon: CloudLightning };
    default: return { label: "Tidak Diketahui", icon: Cloud };
  }
}
