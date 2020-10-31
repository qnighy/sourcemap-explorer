import { useCallback, useState } from 'react';

export interface UploaderState {
  uploadedFiles: Map<string, FileState>;
  removeFile: (name: string) => void;
  onDrop: (acceptedFiles: File[]) => void;
}

export type FileState = UploadingFileState | UploadedFileState;
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

export const useUploader = (): UploaderState => {
  const [uploadedFiles, setUploadedFiles] = useState<Map<string, FileState>>(() => new Map());
  const removeFile = useCallback((name: string) => {
    setUploadedFiles((oldState) => {
      const state = new Map(oldState);
      state.delete(name);
      return state;
    });
  }, [setUploadedFiles]);
  const onDrop = useCallback((acceptedFiles: File[]) => {
    setUploadedFiles((oldState) => {
      const state = new Map(oldState);
      for (const file of acceptedFiles) {
        state.set(file.name, {
          state: "uploading",
          file,
          content: state.get(file.name)?.content,
        });
      }
      return state;
    });
    for (const file of acceptedFiles) {
      (async (file) => {
        const content = await file.arrayBuffer();
        setUploadedFiles((oldState) => {
          const oldFileState = oldState.get(file.name);
          if (!oldFileState || oldFileState.state !== "uploading" || oldFileState.file !== file) {
            return oldState;
          }
          const state = new Map(oldState);
          state.set(file.name, {
            state: "uploaded",
            content,
          });
          return state;
        });
      })(file);
    }
  }, [setUploadedFiles]);
  return {
    uploadedFiles,
    removeFile,
    onDrop,
  }
};
