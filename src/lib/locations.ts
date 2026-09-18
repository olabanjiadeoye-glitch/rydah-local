export const RYDAH_TARGET_CITIES = ["Lagos", "Abuja", "Ibadan", "Warri", "Port Harcourt"] as const;

export const RYDAH_SERVICE_AREAS = [
  "Lekki, Lagos",
  "Victoria Island, Lagos",
  "Ikeja, Lagos",
  "Ajah, Lagos",
  "Surulere, Lagos",
  "Yaba, Lagos",
  "Mainland, Lagos",
  "Other Lagos area",
  "Wuse, Abuja",
  "Garki, Abuja",
  "Maitama, Abuja",
  "Gwarinpa, Abuja",
  "Jabi, Abuja",
  "Kubwa, Abuja",
  "Lugbe, Abuja",
  "Other Abuja area",
  "Bodija, Ibadan",
  "Dugbe, Ibadan",
  "Ring Road, Ibadan",
  "Challenge, Ibadan",
  "Akobo, Ibadan",
  "Mokola, Ibadan",
  "Apata, Ibadan",
  "Oluyole, Ibadan",
  "Akala, Ibadan",
  "Jericho, Ibadan",
  "Iyaganku, Ibadan",
  "Other Ibadan area",
  "Warri Central, Warri",
  "Effurun, Warri",
  "Enerhen, Warri",
  "Udu, Warri",
  "Ekpan, Warri",
  "Airport Road, Warri",
  "Other Warri area",
  "GRA, Port Harcourt",
  "D-Line, Port Harcourt",
  "Rumuola, Port Harcourt",
  "Rumuokoro, Port Harcourt",
  "Woji, Port Harcourt",
  "Trans Amadi, Port Harcourt",
  "Other Port Harcourt area",
] as const;

export const RYDAH_DEFAULT_SERVICE_AREA = "Lekki, Lagos";

type AreaCenter = {
  latitude: number;
  longitude: number;
};

export const RYDAH_SERVICE_AREA_CENTERS: Record<string, AreaCenter> = {
  "Lekki, Lagos": { latitude: 6.4698, longitude: 3.5852 },
  "Victoria Island, Lagos": { latitude: 6.4281, longitude: 3.4219 },
  "Ikeja, Lagos": { latitude: 6.6018, longitude: 3.3515 },
  "Ajah, Lagos": { latitude: 6.4690, longitude: 3.5677 },
  "Surulere, Lagos": { latitude: 6.4969, longitude: 3.3530 },
  "Yaba, Lagos": { latitude: 6.5157, longitude: 3.3859 },
  "Mainland, Lagos": { latitude: 6.5234, longitude: 3.3792 },

  "Wuse, Abuja": { latitude: 9.0765, longitude: 7.4700 },
  "Garki, Abuja": { latitude: 9.0331, longitude: 7.4895 },
  "Maitama, Abuja": { latitude: 9.0948, longitude: 7.4920 },
  "Gwarinpa, Abuja": { latitude: 9.1135, longitude: 7.4054 },
  "Jabi, Abuja": { latitude: 9.0647, longitude: 7.4212 },
  "Kubwa, Abuja": { latitude: 9.1524, longitude: 7.3271 },
  "Lugbe, Abuja": { latitude: 8.9952, longitude: 7.3713 },

  "Bodija, Ibadan": { latitude: 7.4350, longitude: 3.9140 },
  "Dugbe, Ibadan": { latitude: 7.3857, longitude: 3.8860 },
  "Ring Road, Ibadan": { latitude: 7.3777, longitude: 3.8755 },
  "Challenge, Ibadan": { latitude: 7.3576, longitude: 3.8670 },
  "Akobo, Ibadan": { latitude: 7.4590, longitude: 3.9450 },
  "Mokola, Ibadan": { latitude: 7.4050, longitude: 3.8940 },
  "Apata, Ibadan": { latitude: 7.3650, longitude: 3.8330 },
  "Oluyole, Ibadan": { latitude: 7.3290, longitude: 3.8700 },
  "Akala, Ibadan": { latitude: 7.3520, longitude: 3.8450 },
  "Jericho, Ibadan": { latitude: 7.3950, longitude: 3.8720 },
  "Iyaganku, Ibadan": { latitude: 7.3890, longitude: 3.8910 },

  "Warri Central, Warri": { latitude: 5.5167, longitude: 5.7500 },
  "Effurun, Warri": { latitude: 5.5560, longitude: 5.7840 },
  "Enerhen, Warri": { latitude: 5.5330, longitude: 5.7580 },
  "Udu, Warri": { latitude: 5.4890, longitude: 5.8180 },
  "Ekpan, Warri": { latitude: 5.5730, longitude: 5.7730 },
  "Airport Road, Warri": { latitude: 5.5480, longitude: 5.7350 },

  "GRA, Port Harcourt": { latitude: 4.8156, longitude: 7.0046 },
  "D-Line, Port Harcourt": { latitude: 4.8150, longitude: 7.0120 },
  "Rumuola, Port Harcourt": { latitude: 4.8500, longitude: 7.0200 },
  "Rumuokoro, Port Harcourt": { latitude: 4.8667, longitude: 6.9980 },
  "Woji, Port Harcourt": { latitude: 4.8300, longitude: 7.0550 },
  "Trans Amadi, Port Harcourt": { latitude: 4.8060, longitude: 7.0400 },
};

export function cityFromServiceArea(area: string) {
  const city = RYDAH_TARGET_CITIES.find((candidate) =>
    area.toLowerCase().includes(candidate.toLowerCase()),
  );
  return city ?? "Other";
}

function toRadians(value: number) {
  return value * Math.PI / 180;
}

export function distanceKm(
  latitudeA: number,
  longitudeA: number,
  latitudeB: number,
  longitudeB: number,
) {
  const earthRadiusKm = 6371;
  const latitudeDelta = toRadians(latitudeB - latitudeA);
  const longitudeDelta = toRadians(longitudeB - longitudeA);
  const startLatitude = toRadians(latitudeA);
  const endLatitude = toRadians(latitudeB);

  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(startLatitude) *
      Math.cos(endLatitude) *
      Math.sin(longitudeDelta / 2) ** 2;

  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

export function nearestServiceArea(
  latitude: number,
  longitude: number,
  allowedAreas: readonly string[] = RYDAH_SERVICE_AREAS,
) {
  let nearest: { area: string; distanceKm: number } | null = null;

  for (const area of allowedAreas) {
    const center = RYDAH_SERVICE_AREA_CENTERS[area];
    if (!center) continue;

    const distance = distanceKm(
      latitude,
      longitude,
      center.latitude,
      center.longitude,
    );

    if (!nearest || distance < nearest.distanceKm) {
      nearest = { area, distanceKm: distance };
    }
  }

  return nearest;
}

export function isNearTargetCoverage(latitude: number, longitude: number, maxDistanceKm = 45) {
  const nearest = nearestServiceArea(latitude, longitude);
  return Boolean(nearest && nearest.distanceKm <= maxDistanceKm);
}
