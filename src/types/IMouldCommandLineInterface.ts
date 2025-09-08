export interface IMouldCommandLineInterface {
  run: (argv: readonly string[]) => Promise<void>;
}
