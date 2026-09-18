export const RYDAH_TARGET_CITIES = ["Lagos", "Abuja", "Ibadan"] as const;

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
] as const;

export const RYDAH_DEFAULT_SERVICE_AREA = "Lekki, Lagos";

export function cityFromServiceArea(area: string) {
  const city = RYDAH_TARGET_CITIES.find((candidate) =>
    area.toLowerCase().includes(candidate.toLowerCase()),
  );
  return city ?? "Other";
}
