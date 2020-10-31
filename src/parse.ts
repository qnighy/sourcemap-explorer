import { SourceFileState, UploadedFileState } from './file_states';

export interface ParseResult {
  files: Map<string, ParsedFile>;
  sourceFiles: Map<string, SourceFileState>;
}

const initResult = (): ParseResult => ({
  files: new Map(),
  sourceFiles: new Map(),
});

export interface ParsedFile {
  content: ArrayBuffer;
  sourceMap?: SourceMapContent;
  sourceMapRef?: string;
}

export interface SourceMapContent {
  version: 3;
  file?: string;
  sourceRoot?: string;
  sources: string[];
  sourcesContent?: (string | null)[];
  names: string[];
  mappings: string;
}

export const parseFiles = (uploadedFiles: Map<string, UploadedFileState>, prev: ParseResult = initResult()): ParseResult => {
  const files = new Map<string, ParsedFile>();
  for (const [name, uploadedFile] of Array.from(uploadedFiles.entries())) {
    const prevFile = prev.files.get(name);
    if (prevFile && prevFile.content === uploadedFile.content) {
      files.set(name, prevFile);
    } else {
      files.set(name, parseFile(name, uploadedFile.content));
    }
  }

  // Return prev if nothing has been changed.
  if (equalFiles(prev.files, files)) {
    return prev;
  }

  const sourceFiles = new Map<string, SourceFileState>();
  for (const file of Array.from(files.values())) {
    if (file.sourceMap) {
      for (const source of file.sourceMap.sources) {
        // TODO: sourceRoot
        sourceFiles.set(source, { state: "missing" });
      }
    }
  }
  for (const file of Array.from(files.values())) {
    if (file.sourceMap && file.sourceMap.sourcesContent) {
      for (const [i, source] of Array.from(file.sourceMap.sources.entries())) {
        // TODO: sourceRoot
        const sourceContent = file.sourceMap.sourcesContent[i];
        if (sourceContent) {
          sourceFiles.set(source, { state: "bundled", content: new TextEncoder().encode(sourceContent) });
        }
      }
    }
  }
  for (const [name, uploadedFile] of Array.from(uploadedFiles.entries())) {
    if (sourceFiles.has(name)) {
      sourceFiles.set(name, { state: "uploaded", content: uploadedFile.content });
    }
  }
  return {
    files,
    sourceFiles,
  };
};

const parseFile = (name: string, content: ArrayBuffer): ParsedFile => {
  if (name.match(/\.map$/)) {
    return {
      content,
      sourceMap: parseSourceMap(content),
    };
  }
  let sourceMapRef: string | undefined;
  const contentText = new TextDecoder().decode(content);
  const matchJS = contentText.match(/^\/\/# sourceMappingURL=(.*)$/m);
  const matchCSS = contentText.match(/^\/\*# sourceMappingURL=(.*) \*\/$/m);
  if (matchJS) {
    sourceMapRef = matchJS[1];
  } else if (matchCSS) {
    sourceMapRef = matchCSS[1];
  }
  return { content, sourceMapRef };
};

const parseSourceMap = (content: ArrayBuffer): SourceMapContent => {
  const json: unknown = JSON.parse(new TextDecoder().decode(content));
  if (typeof json !== "object" || json === null || Array.isArray(json)) {
    throw new Error("SourecMap should be an object");
  }
  const { version, file, sourceRoot, sources, sourcesContent, names, mappings } = json as { [key in keyof SourceMapContent]?: unknown };
  if (version !== 3) {
    throw new Error("Invalid version");
  }
  if (typeof file !== "undefined" && typeof file !== "string") {
    throw new Error("file must be a string");
  }
  if (typeof sourceRoot !== "undefined" && typeof sourceRoot !== "string") {
    throw new Error("sourceRoot must be a string");
  }
  if (!isArrayOf(sources, isString)) {
    throw new Error("sources must be an array of strings")
  }
  if (typeof sourcesContent !== "undefined" && !isArrayOf(sourcesContent, isStringOrNull)) {
    throw new Error("sourcesContent must be an array of strings or nulls")
  }
  if (!isArrayOf(names, isString)) {
    throw new Error("names must be an array of strings")
  }
  if (typeof mappings !== "string") {
    throw new Error("mappings must be a string");
  }
  return {
    version,
    file,
    sourceRoot,
    sources,
    sourcesContent,
    names,
    mappings,
  };
};

const isString = (x: unknown): x is string => typeof x === "string";
const isStringOrNull = (x: unknown): x is (string | null) => typeof x === "string" || x === null;

const isArrayOf = <T>(arr: unknown, pred: (x: unknown) => x is T): arr is T[] => {
  if (!Array.isArray(arr)) {
    return false;
  }
  for (const elem of arr) {
    if (!pred(elem)) return false;
  }
  return true;
}

const equalFiles = (files1: Map<string, ParsedFile>, files2: Map<string, ParsedFile>): boolean => {
  for (const name of Array.from(files1.keys()).concat(Array.from(files2.keys()))) {
    if (files1.get(name) !== files2.get(name)) {
      return false;
    }
  }
  return true;
};
