export interface UploadingFileState {
  state: "uploading";
  file: File;
  // old content, if any
  content?: ArrayBuffer;
}
export interface UploadedFileState {
  state: "uploaded";
  content: ArrayBuffer;
}
export interface MissingFileState {
  state: "missing";
  content?: undefined;
}
export interface BundledFileState {
  state: "bundled";
  content: ArrayBuffer;
}

export type UserFileState = UploadingFileState | UploadedFileState;
export type SourceFileState =
  | MissingFileState
  | BundledFileState
  | UploadedFileState;
