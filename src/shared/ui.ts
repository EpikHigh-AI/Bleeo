import type { Message, PopupState, Sensitivity, Settings } from "./types";

export const SENSITIVITY_HELP: Record<Sensitivity, string> = {
  low: "Softens the strongest signals. More text stays visible.",
  medium: "A balanced starting point for everyday browsing.",
  high: "Softens more language. May also catch ordinary headlines."
};

export function getPageStatus(settings: PopupState, available: boolean): string {
  if (!available) return "Unavailable";
  if (!settings.enabled) return "Extension off";
  if (!settings.sitePreferenceEnabled) return "Site off";
  if (settings.siteSnoozed) return "Paused";
  return "Filtering";
}

export async function requestSettings<T extends Settings>(message: Message): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const response = await Promise.race([
      chrome.runtime.sendMessage(message) as Promise<{ settings?: T; error?: string } | undefined>,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error("Settings request timed out")), 8000);
      })
    ]);
    if (!response?.settings || response.error) throw new Error("Settings unavailable");
    return response.settings;
  } finally {
    clearTimeout(timer);
  }
}
