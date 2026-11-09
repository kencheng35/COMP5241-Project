// Windows-only launcher for the existing isolated worker gate. Child
// environment values are explicit arguments/defaults, not host env reads.
import { spawnSync } from "node:child_process";
import { dirname, isAbsolute, join } from "node:path";

const [windows, profile] = process.argv.slice(2);
if (process.platform !== "win32" || !windows || !profile || !isAbsolute(windows) || !isAbsolute(profile)) {
  throw new Error("On Windows, supply absolute Windows and user-profile directories.");
}
const local = join(profile, "AppData", "Local");
const system32 = join(windows, "System32");
const env = {
  SystemRoot: windows, WINDIR: windows,
  TEMP: join(local, "Temp"), TMP: join(local, "Temp"),
  USERPROFILE: profile, LOCALAPPDATA: local, APPDATA: join(profile, "AppData", "Roaming"),
  COMSPEC: join(system32, "cmd.exe"), PATHEXT: ".COM;.EXE;.BAT;.CMD",
  PATH: `${dirname(process.execPath)};${system32};${windows}`,
  NEXT_TELEMETRY_DISABLED: "1", CI: "1",
};
const result = spawnSync(process.execPath, ["tests/offline-build.mjs", "--pdf-import-worker-gate"], {
  env, stdio: "inherit",
});
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
