export interface ITemplateFile {
  type: "file";
  name: string;
  relativePath: readonly string[];
  absolutePath: string;
  /** Permission bits (`stat.mode & 0o777`) of the template file, preserved on export */
  mode: number;
  readUtf8: () => string;
  readBuffer: () => Buffer;
}
