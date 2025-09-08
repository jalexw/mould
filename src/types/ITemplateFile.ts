export interface ITemplateFile {
  type: "file";
  name: string;
  relativePath: readonly string[];
  absolutePath: string;
  readUtf8: () => string;
}

export interface ITemplateDirectory {
  type: "directory";
  name: string;
  relativePath: readonly string[];
  absolutePath: string;
}
