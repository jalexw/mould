import MouldCommandLineInterface from "./cli";
import { join, normalize } from "path";

export { MouldCommandLineInterface } from "./cli";
export type { IMouldCommandLineInterface } from "./types/IMouldCommandLineInterface";

async function run(argv: readonly string[]): Promise<void> {
  const mouldAppDir: string = normalize(join(__dirname, ".."));
  const mould = new MouldCommandLineInterface({
    mouldAppDir,
  });

  await mould.run(argv);
}

export default run;

if (require.main === module) {
  await run(process.argv);
}
