import { isDefaultTargetHost } from "../shared/settings";
import { getPageStatus, requestSettings, SENSITIVITY_HELP } from "../shared/ui";
import type { Message, PopupState, Settings } from "../shared/types";

const globalInput = document.querySelector<HTMLInputElement>("#global-enabled")!;
const siteInput = document.querySelector<HTMLInputElement>("#site-enabled")!;
const sensitivityInputs = Array.from(document.querySelectorAll<HTMLInputElement>('input[name="sensitivity"]'));
const snoozeButton = document.querySelector<HTMLButtonElement>("#snooze-site")!;
const feedback = document.querySelector<HTMLElement>("#feedback")!;
const retryButton = document.querySelector<HTMLButtonElement>("#retry")!;
const controls = [globalInput, siteInput, ...sensitivityInputs, snoozeButton];
let hostname = "";
let available = false;
let settings: PopupState | undefined;
let busy = false;
let snoozeTimer: ReturnType<typeof setTimeout> | undefined;

function render() {
  controls.forEach((control) => { control.disabled = busy || !settings; });
  siteInput.disabled ||= !available;
  snoozeButton.disabled ||= !available || !settings?.enabled || !settings.sitePreferenceEnabled;
  if (!settings) return;

  globalInput.checked = settings.enabled;
  siteInput.checked = available && settings.sitePreferenceEnabled;
  sensitivityInputs.forEach((input) => { input.checked = input.value === settings!.sensitivity; });
  document.querySelector("#sensitivity-help")!.textContent = SENSITIVITY_HELP[settings.sensitivity];
  const hostnameElement = document.querySelector<HTMLElement>("#hostname")!;
  hostnameElement.textContent = hostname || "Browser page";
  hostnameElement.title = hostname || "Browser page";
  const status = getPageStatus(settings, available);
  const chip = document.querySelector<HTMLElement>("#state-chip")!;
  chip.textContent = status === "Filtering" ? "Active" : status;
  chip.dataset.state = status === "Filtering" ? "active" : status === "Paused" ? "paused" : "off";
  document.querySelector("#mode")!.textContent = "On-device";
  document.querySelector("#site-label")!.textContent = !available
    ? hostname ? "Bleeo does not run on this site" : "Open a supported news or social page"
    : !settings.enabled ? "Turn on Bleeo above to filter this page"
    : settings.siteSnoozed && settings.sitePreferenceEnabled
      ? `Paused until ${new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(settings.siteSnoozedUntil)}`
      : settings.sitePreferenceSource === "override" ? "Your preference for this site" : "On by default here";
  snoozeButton.dataset.snoozed = String(settings.siteSnoozed);
  snoozeButton.textContent = settings.siteSnoozed ? "Resume this site" : "Pause for 1 hour";
  clearTimeout(snoozeTimer);
  if (settings.siteSnoozedUntil) {
    snoozeTimer = setTimeout(() => { if (!busy) void load(); }, Math.max(0, settings.siteSnoozedUntil - Date.now() + 250));
  }
}

function showFeedback(message: string, error = false) {
  feedback.textContent = message;
  feedback.dataset.state = error ? "error" : "saved";
  retryButton.hidden = !error;
}

async function load() {
  if (busy) return;
  busy = true;
  render();
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    hostname = "";
    available = false;
    if (tab?.url) {
      const url = new URL(tab.url);
      if (url.protocol === "http:" || url.protocol === "https:") {
        hostname = url.hostname;
        available = isDefaultTargetHost(hostname) && await chrome.permissions.contains({ origins: [tab.url] });
      }
    }
    settings = await requestSettings<PopupState>({ type: "GET_POPUP_STATE", hostname });
    showFeedback("Changes save automatically.");
  } catch {
    showFeedback("Could not load settings. Try again.", true);
  } finally {
    busy = false;
    render();
  }
}

async function save(message: Message) {
  if (busy || !settings) return;
  busy = true;
  render();
  showFeedback("Saving…");
  try {
    await requestSettings<Settings>(message);
    settings = await requestSettings<PopupState>({ type: "GET_POPUP_STATE", hostname });
    showFeedback("Saved. Your open pages update automatically.");
  } catch {
    showFeedback("Could not confirm your change. Retry, then try the control again.", true);
  } finally {
    busy = false;
    render();
  }
}

globalInput.addEventListener("change", () => { void save({ type: "TOGGLE_GLOBAL", enabled: globalInput.checked }); });
siteInput.addEventListener("change", () => { void save({ type: "TOGGLE_SITE", hostname, enabled: siteInput.checked }); });
sensitivityInputs.forEach((input) => input.addEventListener("change", () => {
  if (input.checked) void save({ type: "SET_SENSITIVITY", sensitivity: input.value as PopupState["sensitivity"] });
}));
snoozeButton.addEventListener("click", () => {
  if (!available) return;
  void save(settings?.siteSnoozed
    ? { type: "CLEAR_SITE_SNOOZE", hostname }
    : { type: "SNOOZE_SITE", hostname, until: Date.now() + 60 * 60 * 1000 });
});
document.querySelector("#open-options")!.addEventListener("click", () => {
  void chrome.runtime.openOptionsPage().catch(() => showFeedback("Could not open settings. Try again.", true));
});
retryButton.addEventListener("click", () => { void load(); });
chrome.storage.onChanged.addListener(() => { if (!busy) void load(); });
void load();
