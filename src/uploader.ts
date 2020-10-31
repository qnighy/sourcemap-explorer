import { useCallback, useState } from 'react';
import { produce } from 'immer';

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
    setUploadedFiles((state) => produce(state, (state) => {
      state.delete(name);
    }));
  }, [setUploadedFiles]);
  const onDrop = useCallback((acceptedFiles: File[]) => {
    setUploadedFiles((state) => produce(state, (state) => {
      for (const file of acceptedFiles) {
        state.set(file.name, {
          state: "uploading",
          file,
          content: state.get(file.name)?.content,
        });
      }
    }));
    for (const file of acceptedFiles) {
      (async (file) => {
        const content = await file.arrayBuffer();
        setUploadedFiles((state) => produce(state, (state) => {
          const oldFileState = state.get(file.name);
          if (!oldFileState || oldFileState.state !== "uploading" || oldFileState.file !== file) {
            return;
          }
          state.set(file.name, {
            state: "uploaded",
            content,
          });
        }));
      })(file);
    }
  }, [setUploadedFiles]);
  return {
    uploadedFiles,
    removeFile,
    onDrop,
  }
};
