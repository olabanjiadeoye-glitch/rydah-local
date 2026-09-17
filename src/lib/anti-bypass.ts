const emailPattern = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const linkPattern = /(https?:\/\/|www\.|wa\.me|whatsapp|telegram|t\.me)/i;
const nigeriaPhonePattern = /(?:\+?234|0)[\s().-]*[789][01][\s().-]*[0-9][\s().-]*[0-9]{3}[\s().-]*[0-9]{4}/i;

export function containsOffPlatformContact(value: string) {
  const text = value.trim();
  return emailPattern.test(text) || linkPattern.test(text) || nigeriaPhonePattern.test(text);
}

export const offPlatformContactMessage =
  "For your safety and Rydah protection, do not place phone numbers, email addresses, WhatsApp details or external links in descriptions. Keep contact and payment inside Rydah.";
