const otpEnvelope = /^\{"\$1":"([^"]+)"\}:\s*\{"\$1":"([^"]+)"\}$/;

export function formatMessage(rawText: string): string {
  const match = rawText.match(otpEnvelope);
  if (!match) return rawText;
  const [, service, otp] = match;
  return `Here's your one-time passcode for ${service}\n\n*${otp}*`;
}
