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
  mappings: Segment[][];
}

export interface UnmappedSegment {
  column: number;
  source?: undefined;
  sourceLine?: undefined;
  sourceColumn?: undefined;
  name?: undefined;
}
export interface MappedSegment {
  column: number;
  source: string;
  sourceLine: number;
  sourceColumn: number;
  name?: string;
}
export type Segment = UnmappedSegment | MappedSegment;

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
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _typecheck_json: object = json;
  const { version, file, sourceRoot, sources, sourcesContent, names, mappings } = json as { [key in string]?: unknown };
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
    mappings: parseMappings(mappings, sources, names),
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

const parseMappings = (mappings_: string, sources: string[], names: string[]): Segment[][] => {
  const mappings = mappings_ + ";";
  const lines: Segment[][] = [];
  let segments: Segment[] = [];
  let lastColumn = 0;
  let lastSourceIndex = 0;
  let lastSourceLine = 0;
  let lastSourceColumn = 0;
  let lastNameIndex = 0;
  let currentSegment: number[] = [];
  let current = 0;
  let currentBits = 0;
  for (let i = 0; i < mappings.length; i++) {
    const charCode = mappings.charCodeAt(i);
    if (charCode === 0x3B /* ; */ || charCode === 0x2C /* , */) {
      if (current !== 0 || currentBits !== 0) throw new Error("VLQ runover");
      if (currentSegment.length === 0 && charCode === 0x3B /* ; */) {
        lines.push(segments);
        segments = [];
        lastColumn = 0;
        continue;
      }
      if (currentSegment.length === 0) throw new Error("Segment too short");
      // TODO: check monotonicity
      lastColumn += toSigned(currentSegment[0]);
      if (currentSegment.length === 4 || currentSegment.length === 5) {
        lastSourceIndex += toSigned(currentSegment[1]);
        lastSourceLine += toSigned(currentSegment[2]);
        lastSourceColumn += toSigned(currentSegment[3]);
        if (currentSegment.length === 5) {
          lastNameIndex += toSigned(currentSegment[4]);
        }
      } else if (currentSegment.length !== 1) {
        throw new Error("Invalid segment length");
      }
      segments.push({
        column: lastColumn,
        // TODO: check index
        source: sources[lastSourceIndex],
        sourceLine: lastSourceLine,
        sourceColumn: lastSourceColumn,
        name: currentSegment.length === 5 ? names[lastNameIndex] : undefined,
      });
      currentSegment = [];
      if (charCode === 0x3B /* ; */) {
        lines.push(segments);
        segments = [];
        lastColumn = 0;
      }
      continue;
    }
    const b = base64val(charCode);
    if (b < 32) {
      currentSegment.push(current | (b << currentBits));
      current = 0;
      currentBits = 0;
    } else {
      current |= ((b & 31) << currentBits);
      currentBits += 5;
    }
  }
  return lines;
}

const base64val = (charCode: number): number => {
  if (charCode >= 0x41 /* A */ && charCode <= 0x5A /* Z */) {
    return charCode - 0x41;
  } else if (charCode >= 0x61 /* a */ && charCode <= 0x7A /* z */) {
    return charCode - (0x61 - 26);
  } else if (charCode >= 0x30 /* 0 */ && charCode <= 0x39 /* 9 */) {
    return charCode + (52 - 0x30);
  } else if (charCode === 0x2B /* + */) {
    return 62;
  } else if (charCode === 0x2F /* / */) {
    return 63;
  } else {
    throw new Error(`Invalid base64 value: ${charCode}`);
  }
};

const toSigned = (n: number): number => {
  if (n & 1) {
    return -(n >> 1);
  } else {
    return (n >> 1);
  }
}
