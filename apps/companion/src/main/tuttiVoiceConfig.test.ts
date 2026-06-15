import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DEFAULT_SETTINGS } from "@mimica/shared";
import { isLocalhostTuttiUrl, resolveTuttiVoiceConfig } from "./tuttiVoiceConfig.js";

describe("isLocalhostTuttiUrl", () => {
  it("accepts localhost loopback hosts", () => {
    assert.equal(isLocalhostTuttiUrl("http://127.0.0.1:8787"), true);
    assert.equal(isLocalhostTuttiUrl("http://localhost:8787"), true);
    assert.equal(isLocalhostTuttiUrl("http://[::1]:8787"), true);
  });

  it("rejects non-localhost hosts", () => {
    assert.equal(isLocalhostTuttiUrl("http://100.64.0.5:8787"), false);
    assert.equal(isLocalhostTuttiUrl("https://example.com"), false);
  });
});

describe("resolveTuttiVoiceConfig", () => {
  it("uses settings defaults", () => {
    const config = resolveTuttiVoiceConfig(DEFAULT_SETTINGS);
    assert.equal(config.enabled, true);
    assert.equal(config.baseUrl, "http://127.0.0.1:8787");
  });

  it("honors localhost MIMICA_TUTTI_URL", () => {
    const previous = process.env.MIMICA_TUTTI_URL;
    process.env.MIMICA_TUTTI_URL = "http://127.0.0.1:9999";
    try {
      const config = resolveTuttiVoiceConfig(DEFAULT_SETTINGS);
      assert.equal(config.baseUrl, "http://127.0.0.1:9999");
    } finally {
      if (previous === undefined) delete process.env.MIMICA_TUTTI_URL;
      else process.env.MIMICA_TUTTI_URL = previous;
    }
  });

  it("disables readout for non-localhost MIMICA_TUTTI_URL", () => {
    const previousUrl = process.env.MIMICA_TUTTI_URL;
    const previousEnabled = process.env.MIMICA_VOICE_READOUT_ENABLED;
    process.env.MIMICA_TUTTI_URL = "http://100.64.0.5:8787";
    delete process.env.MIMICA_VOICE_READOUT_ENABLED;
    try {
      const config = resolveTuttiVoiceConfig(DEFAULT_SETTINGS);
      assert.equal(config.enabled, false);
      assert.equal(config.baseUrl, "http://127.0.0.1:8787");
    } finally {
      if (previousUrl === undefined) delete process.env.MIMICA_TUTTI_URL;
      else process.env.MIMICA_TUTTI_URL = previousUrl;
      if (previousEnabled === undefined) delete process.env.MIMICA_VOICE_READOUT_ENABLED;
      else process.env.MIMICA_VOICE_READOUT_ENABLED = previousEnabled;
    }
  });

  it("honors MIMICA_VOICE_READOUT_ENABLED=0", () => {
    const previous = process.env.MIMICA_VOICE_READOUT_ENABLED;
    process.env.MIMICA_VOICE_READOUT_ENABLED = "0";
    try {
      const config = resolveTuttiVoiceConfig(DEFAULT_SETTINGS);
      assert.equal(config.enabled, false);
    } finally {
      if (previous === undefined) delete process.env.MIMICA_VOICE_READOUT_ENABLED;
      else process.env.MIMICA_VOICE_READOUT_ENABLED = previous;
    }
  });
});
