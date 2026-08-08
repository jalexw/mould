export interface ITemplateDirectory {
  type: "directory";
  name: string;
  relativePath: readonly string[];
  absolutePath: string;
}
