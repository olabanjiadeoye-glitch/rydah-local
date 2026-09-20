const emailPattern = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const linkPattern = /(?:https?:\/\/|www\.|wa\.me|t\.me|bit\.ly|tinyurl\.com|[A-Z0-9-]+\.(?:com|ng|net|org|co|io|me|app)\b)/i;
const nigeriaPhonePattern = /(?:\+?234|0)[\s().-]*[789][01][\s().-]*[0-9](?:[\s().-]*[0-9]){7}/i;
const genericPhonePattern = /(?:\+?[0-9][\s().-]*){9,15}/;
const socialPlatformPattern = /\b(?:whats?app|telegram|instagram|facebook|messenger|tiktok|snapchat|twitter|linkedin|discord|signal|wechat|imo)\b|\bx\s*(?:dot|\.)\s*com\b/i;
const socialHandlePattern = /(^|[^A-Z0-9_])@[A-Z0-9_.-]{2,}/i;
const contactPromptPattern = /\b(?:dm\s+me|direct\s+message|inbox\s+me|message\s+me\s+on|contact\s+me\s+on|my\s+(?:ig|fb|handle))\b/i;

export function containsOffPlatformContact(value: string) {
  const text = value.trim();
  return (
    emailPattern.test(text)
    || linkPattern.test(text)
    || nigeriaPhonePattern.test(text)
    || genericPhonePattern.test(text)
    || socialPlatformPattern.test(text)
    || socialHandlePattern.test(text)
    || contactPromptPattern.test(text)
  );
}

export const offPlatformContactMessage =
  "Contact details are not allowed in a job description. Remove phone numbers, email addresses, social-media names or handles, WhatsApp/Telegram details, websites and external links. Use the official Phone and Email fields and keep communication and payment on Rydah.";
