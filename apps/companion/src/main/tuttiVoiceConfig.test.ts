import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DEFAULT_SETTINGS } from "@mimica/shared";
import { assertLocalhostTuttiBaseUrl, resolveTuttiVoiceConfig } from "./tuttiVoiceConfig.js";

describe("assertLocalhostTuttiBaseUrl", () => {
  it("accepts loopback hosts", () => {
    assert.equal(assertLocalhostTuttiBaseUrl("http://127.0.0.1:8787"), "http://127.0.0.1:8787");
    assert.equal(assertLocalhostTuttiBaseUrl("http://localhost:8787/"), "http://localhost:8787");
    assert.equal(assertLocalhostTuttiBaseUrl("http://[::1]:8787"), "http://[::1]:8787");
  });

  it("rejects non-loopback hosts", () => {
    assert.throws(
      () => assertLocalhostTuttiBaseUrl("http://example.com:8787"),
      /must target localhost/,
    );
    assert.throws(
      () => assertLocalhostTuttiBaseUrl("http://192.168.0.10:8787"),
      /must target localhost/,
    );
  });

  it("rejects non-http schemes", () => {
    assert.throws(
      () => assertLocalhostTuttiBaseUrl("ftp://127.0.0.1:8787"),
      /must use http or https/,
    );
  });
});

describe("resolveTuttiVoiceConfig", () => {
  it("uses settings defaults", () => {
    const config = resolveTuttiVoiceConfig(DEFAULT_SETTINGS);
    assert.equal(config.enabled, true);
    assert.equal(config.baseUrl, "http://127.0.0.1:8787");
  });

  it("honors MIMICA_TUTTI_URL on loopback", () => {
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

  it("falls back to default when MIMICA_TUTTI_URL is non-loopback", () => {
    const previous = process.env.MIMICA_TUTTI_URL;
    process.env.MIMICA_TUTTI_URL = "http://evil.example:8787";
    try {
      const config = resolveTuttiVoiceConfig(DEFAULT_SETTINGS);
      assert.equal(config.baseUrl, "http://127.0.0.1:8787");
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
