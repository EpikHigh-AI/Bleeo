import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_SETTINGS, getPopupState, mergeSettings } from "../src/shared/settings";
import { getPageStatus, requestSettings } from "../src/shared/ui";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("page status", () => {
  it("never advertises filtering on an unavailable page", () => {
    expect(getPageStatus(getPopupState(DEFAULT_SETTINGS, "cnn.com"), false)).toBe("Unavailable");
    const overridden = getPopupState(mergeSettings({ siteOverrides: { "example.com": true } }), "example.com");
    expect(getPageStatus(overridden, false)).toBe("Unavailable");
  });

  it("explains the master switch before a saved pause", () => {
    const settings = mergeSettings({ enabled: false, siteSnoozes: { "cnn.com": Date.now() + 60_000 } });
    expect(getPageStatus(getPopupState(settings, "cnn.com"), true)).toBe("Extension off");
  });

  it("keeps site preference on while its filtering is paused", () => {
    const settings = mergeSettings({ siteSnoozes: { "cnn.com": Date.now() + 60_000 } });
    const state = getPopupState(settings, "cnn.com");
    expect(state.sitePreferenceEnabled).toBe(true);
    expect(state.siteEnabled).toBe(false);
    expect(getPageStatus(state, true)).toBe("Paused");
  });

  it("does not suggest resuming a disabled site's stale pause", () => {
    const settings = mergeSettings({ siteOverrides: { "cnn.com": false }, siteSnoozes: { "cnn.com": Date.now() + 60_000 } });
    expect(getPageStatus(getPopupState(settings, "cnn.com"), true)).toBe("Site off");
  });
});

describe("settings feedback", () => {
  it("returns confirmed settings and cleans up the timeout", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("chrome", { runtime: { sendMessage: vi.fn().mockResolvedValue({ settings: DEFAULT_SETTINGS }) } });
    expect(await requestSettings({ type: "GET_ALL_SETTINGS" })).toEqual(DEFAULT_SETTINGS);
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each([undefined, {}, { error: "STORAGE_ERROR" }])("rejects missing or failed responses: %j", async (response) => {
    vi.stubGlobal("chrome", { runtime: { sendMessage: vi.fn().mockResolvedValue(response) } });
    await expect(requestSettings({ type: "GET_ALL_SETTINGS" })).rejects.toThrow("Settings unavailable");
  });

  it("lets the UI recover when the extension never responds", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("chrome", { runtime: { sendMessage: () => new Promise(() => {}) } });
    const result = expect(requestSettings({ type: "GET_ALL_SETTINGS" })).rejects.toThrow("timed out");
    await vi.advanceTimersByTimeAsync(8000);
    await result;
    expect(vi.getTimerCount()).toBe(0);
  });
});
