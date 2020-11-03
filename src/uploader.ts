import { useCallback, useState } from "react";
import { produce } from "immer";
import { UploadedFileState, UserFileState } from "./file_states";

export interface UploaderState {
  userFiles: Map<string, UserFileState>;
  uploadedFiles: Map<string, UploadedFileState>;
  removeFile: (name: string) => void;
  renameFile: (name: string, newName: string) => void;
  onDrop: (acceptedFiles: File[]) => void;
}

export const useUploader = (): UploaderState => {
  const [userFiles, setUserFiles] = useState<Map<string, UserFileState>>(
    () => new Map()
  );
  const removeFile = useCallback(
    (name: string) => {
      setUserFiles((state) =>
        produce(state, (state) => {
          state.delete(name);
        })
      );
    },
    [setUserFiles]
  );
  const renameFile = useCallback(
    (name: string, newName: string) => {
      setUserFiles((state) =>
        produce(state, (state) => {
          const entry = state.get(name);
          if (entry && name !== newName) {
            state.delete(name);
            state.set(newName, entry);
          }
        })
      );
    },
    [setUserFiles]
  );
  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      setUserFiles((state) =>
        produce(state, (state) => {
          for (const file of acceptedFiles) {
            state.set(file.name, {
              state: "uploading",
              file,
              content: state.get(file.name)?.content,
            });
          }
        })
      );
      for (const file of acceptedFiles) {
        (async (file) => {
          const content = await file.arrayBuffer();
          setUserFiles((state) =>
            produce(state, (state) => {
              const oldFileState = state.get(file.name);
              if (
                !oldFileState ||
                oldFileState.state !== "uploading" ||
                oldFileState.file !== file
              ) {
                return;
              }
              state.set(file.name, {
                state: "uploaded",
                content,
              });
            })
          );
        })(file);
      }
    },
    [setUserFiles]
  );

  const uploadedFiles: Map<string, UploadedFileState> = new Map();
  for (const [name, file] of Array.from(userFiles.entries())) {
    if (file.content) {
      uploadedFiles.set(name, {
        state: "uploaded",
        content: file.content,
      });
    }
  }

  return {
    uploadedFiles,
    userFiles,
    removeFile,
    renameFile,
    onDrop,
  };
};
