import { FileState } from './uploader';

export interface ParseResult {
  files: Map<string, ParsedFile>;
}

const initResult = (): ParseResult => ({
  files: new Map(),
});

export interface ParsedFile {
  content: ArrayBuffer;
  sourceMap?: SourceMapContent;
}

export interface SourceMapContent {
  json: {};
}

export const parseFiles = (uploadedFiles: Map<string, FileState>, prev: ParseResult = initResult()): ParseResult => {
  const files = new Map<string, ParsedFile>();
  for (const [name, uploadedFile] of Array.from(uploadedFiles.entries())) {
    if (!uploadedFile.content) continue;

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
  return { files };
};

const parseFile = (name: string, content: ArrayBuffer): ParsedFile => {
  if (name.match(/\.map$/)) {
    const json = JSON.parse(new TextDecoder().decode(content));
    console.log(`${name} json = `, json);
    return {
      content,
      sourceMap: { json }
    };
  }
  return { content };
};

const equalFiles = (files1: Map<string, ParsedFile>, files2: Map<string, ParsedFile>): boolean => {
  for (const name of Array.from(files1.keys()).concat(Array.from(files2.keys()))) {
    if (files1.get(name) !== files2.get(name)) {
      return false;
    }
  }
  return true;
};
