import test from "node:test";
import assert from "node:assert/strict";
import { interviewerSsml, interviewerVoices } from "../src/lib/interviewer-speech.ts";

test("interviewer speech maps male and female looks to neural voices", () => {
  const male = interviewerSsml("Hello & welcome <there>", "male");
  const female = interviewerSsml("Good morning", "female");
  assert.match(male, new RegExp(interviewerVoices.male));
  assert.match(male, /Hello &amp; welcome &lt;there&gt;/);
  assert.doesNotMatch(male, /<there>/);
  assert.match(female, new RegExp(interviewerVoices.female));
  assert.equal(interviewerVoices.male, "en-US-GuyNeural");
  assert.equal(interviewerVoices.female, "en-US-JennyNeural");
});
