import type { Message, Settings } from "../shared/types";
import { requestSettings, SENSITIVITY_HELP } from "../shared/ui";

const enabledInput = document.querySelector<HTMLInputElement>("#enabled");
const sensitivityInputs = Array.from(document.querySelectorAll<HTMLInputElement>('input[name="sensitivity"]'));
const markersInput = document.querySelector<HTMLInputElement>("#markers");
const modeElement = document.querySelector<HTMLElement>("#mode");
const refreshButton = document.querySelector<HTMLButtonElement>("#refresh");
const tableBody = document.querySelector<HTMLTableSectionElement>("#site-overrides");
const emptyState = document.querySelector<HTMLElement>("#empty-state");
const feedback = document.querySelector<HTMLElement>("#feedback")!;
const retryButton = document.querySelector<HTMLButtonElement>("#retry")!;
let lastSettings: Settings | undefined;
let busy = false;

function showFeedback(message: string, error = false) {
  feedback.textContent = message;
  feedback.dataset.state = error ? "error" : "saved";
  retryButton.hidden = !error;
}

function disableControls() {
  document.querySelectorAll<HTMLInputElement | HTMLButtonElement>(".controls input, #site-overrides button, #refresh, #retry")
    .forEach((control) => { control.disabled = busy || (!lastSettings && control.id !== "refresh" && control.id !== "retry"); });
}

async function update(message: Message, success = "Saved. Your open pages update automatically.") {
  if (busy) return;
  busy = true;
  disableControls();
  showFeedback(message.type === "GET_ALL_SETTINGS" ? "Loading settings…" : "Saving…");
  try {
    lastSettings = await requestSettings<Settings>(message);
    render(lastSettings);
    showFeedback(success);
  } catch {
    if (lastSettings) render(lastSettings);
    showFeedback("Could not confirm your settings. Retry, then try the control again.", true);
  } finally {
    busy = false;
    disableControls();
  }
}

function renderOverrides(settings: Settings) {
  if (!tableBody || !emptyState) {
    return;
  }

  tableBody.replaceChildren();
  const overrides = Object.entries(settings.siteOverrides).sort(([left], [right]) => left.localeCompare(right));

  if (!overrides.length) {
    emptyState.dataset.visible = "true";
    tableBody.closest<HTMLElement>(".table-shell")!.hidden = true;
    return;
  }

  emptyState.dataset.visible = "false";
  tableBody.closest<HTMLElement>(".table-shell")!.hidden = false;
  for (const [hostname, enabled] of overrides) {
    const row = document.createElement("tr");

    const hostCell = document.createElement("td");
    hostCell.textContent = hostname;

    const stateCell = document.createElement("td");
    const pill = document.createElement("span");
    pill.className = `pill ${enabled ? "enabled" : "disabled"}`;
    pill.textContent = enabled ? "Enabled" : "Disabled";
    stateCell.appendChild(pill);

    const actionCell = document.createElement("td");
    const button = document.createElement("button");
    button.className = "button subtle";
    button.type = "button";
    button.textContent = "Use default";
    button.setAttribute("aria-label", `Use default for ${hostname}`);
    button.addEventListener("click", async () => {
      await update({
        type: "REMOVE_SITE_OVERRIDE",
        hostname
      }, `Default restored for ${hostname}.`);
      refreshButton?.focus();
    });
    actionCell.appendChild(button);

    row.append(hostCell, stateCell, actionCell);
    tableBody.appendChild(row);
  }
}

function render(settings: Settings) {
  if (enabledInput) {
    enabledInput.checked = settings.enabled;
  }
  sensitivityInputs.forEach((input) => { input.checked = input.value === settings.sensitivity; });
  document.querySelector("#sensitivity-help")!.textContent = SENSITIVITY_HELP[settings.sensitivity];
  if (markersInput) {
    markersInput.checked = settings.showMarkers;
  }
  if (modeElement) {
    modeElement.textContent = "Local rules · No server calls";
  }
  renderOverrides(settings);
}

async function refresh() {
  await update({ type: "GET_ALL_SETTINGS" }, "Changes save automatically.");
}

enabledInput?.addEventListener("change", async () => {
  await update({
    type: "TOGGLE_GLOBAL",
    enabled: Boolean(enabledInput?.checked)
  });
});

sensitivityInputs.forEach((input) => input.addEventListener("change", async () => {
  if (!input.checked) return;
  await update({
    type: "SET_SENSITIVITY",
    sensitivity: input.value as Settings["sensitivity"]
  });
}));

markersInput?.addEventListener("change", async () => {
  await update({
    type: "SET_SHOW_MARKERS",
    showMarkers: Boolean(markersInput?.checked)
  });
});

refreshButton?.addEventListener("click", () => {
  void refresh();
});

retryButton.addEventListener("click", () => { void refresh(); });
chrome.storage.onChanged.addListener(() => { if (!busy) void refresh(); });

void refresh();
