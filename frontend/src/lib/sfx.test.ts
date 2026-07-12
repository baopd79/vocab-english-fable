import { afterEach, beforeEach, expect, test, vi } from "vitest";

import { isMuted, playCorrect, playFanfare, playWrong, setMuted } from "./sfx";

/** Chainable no-op audio graph that records oscillator starts. */
const started: unknown[] = [];

class FakeAudioContext {
  state = "running";
  currentTime = 0;
  destination = {};
  resume = vi.fn();
  createOscillator() {
    const osc = {
      type: "sine",
      frequency: { value: 0 },
      connect: (node: unknown) => node,
      start: (at: number) => started.push(at),
      stop: vi.fn(),
    };
    return osc;
  }
  createGain() {
    return {
      gain: {
        setValueAtTime: vi.fn(),
        linearRampToValueAtTime: vi.fn(),
        exponentialRampToValueAtTime: vi.fn(),
      },
      connect: (node: unknown) => node,
    };
  }
}

beforeEach(() => {
  vi.stubGlobal("AudioContext", FakeAudioContext);
  started.length = 0;
  localStorage.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

test("mute state persists across reads (localStorage)", () => {
  expect(isMuted()).toBe(false); // default: sound on
  setMuted(true);
  expect(isMuted()).toBe(true); // fresh read — survives a reload
  expect(localStorage.getItem("sfx-muted")).toBe("1");
  setMuted(false);
  expect(isMuted()).toBe(false);
});

test("chimes schedule oscillators when unmuted", () => {
  playCorrect();
  expect(started).toHaveLength(2); // two-note ding
  playWrong();
  expect(started).toHaveLength(4); // + two-note buzz
  playFanfare();
  expect(started).toHaveLength(8); // + four-note arpeggio
});

test("muted: nothing plays", () => {
  setMuted(true);
  playCorrect();
  playWrong();
  playFanfare();
  expect(started).toHaveLength(0);
});
