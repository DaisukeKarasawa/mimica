import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DEFAULT_SETTINGS } from "@mimica/shared";
import { resolveTuttiVoiceConfig } from "./tuttiVoiceConfig.js";

describe("resolveTuttiVoiceConfig", () => {
  it("uses settings defaults", () => {
    const config = resolveTuttiVoiceConfig(DEFAULT_SETTINGS);
    assert.equal(config.enabled, true);
    assert.equal(config.baseUrl, "http://127.0.0.1:8787");
  });

  it("honors MIMICA_TUTTI_URL", () => {
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
