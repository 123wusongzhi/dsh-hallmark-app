export interface TestDataScope {
  requiredFiles: string[];
  infrastructureFiles: string[];
  infrastructureReasons?: Record<string,string>;
  fileModes?: Record<string,string>;
}
export function auditTestDataClassification(scope: TestDataScope, options: {
  testFiles: Iterable<string>;
  fileExists: (file: string) => boolean;
  recordingDependency: (file: string) => boolean;
}): {
  rows: Array<{file:string;mode:string;recordingDependency:boolean}>;
  failures: Array<{file:string;error:string}>;
};
