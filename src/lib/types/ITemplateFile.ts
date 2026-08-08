export interface ITemplateFile {
  type: "file";
  name: string;
  relativePath: readonly string[];
  absolutePath: string;
  readUtf8: () => string;
}
