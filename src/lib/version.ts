import { join } from "path";
import { readFileSync, existsSync } from "fs";

export function version(
  project_directory: string,
): `${number}.${number}.${number}` {
  const packageJsonPath = join(project_directory, "package.json");
  if (!existsSync(packageJsonPath)) {
    throw new Error("Failed to resolve @jalexw/mould package.json file!");
  }

  const packageJson: unknown = JSON.parse(
    readFileSync(packageJsonPath, "utf8"),
  );

  if (typeof packageJson !== "object" || !packageJson) {
    throw new TypeError(
      "Failed to parse @jalexw/mould package.json file as a JavaScript object!",
    );
  }

  if ("version" in packageJson && typeof packageJson.version === "string") {
    const semver: `${number}.${number}.${number}` =
      packageJson.version as `${number}.${number}.${number}`;
    if (semver.split(".").length !== 3) {
      throw new TypeError(
        "Failed to parse semantic version number for @jalexw/mould program from package.json!",
      );
    }
    return semver;
  } else {
    throw new TypeError(
      "Failed to resolve @jalexw/mould package.json version field as a string!",
    );
  }
}

export default version;
