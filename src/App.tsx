import React, { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { FileState, useUploader } from './uploader';
import './App.css';
import { parseFiles, ParseResult } from './parse';
import { useDiffMemo } from './diff_memo';

const App: React.FC = () => {
  const uploaderState = useUploader();
  const _parseResult = useDiffMemo((prev?: ParseResult) => parseFiles(uploaderState.uploadedFiles, prev), [uploaderState.uploadedFiles]);
  const {getRootProps, getInputProps, isDragActive} = useDropzone({onDrop: uploaderState.onDrop})
  return (
    <div className="App">
      <h1>SourceMap Explorer</h1>
      <div className="editor">
        <div className="editor-generated">
          <h2>Generated</h2>
          <ul className="file-list">
            {
              Array.from(uploaderState.uploadedFiles.entries()).map(([name, file]) => (
                <FileListEntry key={name} name={name} file={file} removeFile={uploaderState.removeFile} />
              ))
            }
          </ul>
          <div {...getRootProps()}>
            <input {...getInputProps()} />
            {
              isDragActive ?
                <p>Drop the files here ...</p> :
                <p>Drag 'n' drop some files here, or click to select files</p>
            }
          </div>
        </div>
        <div className="editor-source">
          <h2>Source</h2>
        </div>
      </div>
    </div>
  );
};

interface FileListEntryProps {
  name: string;
  file: FileState;
  removeFile: (name: string) => void;
}

const FileListEntry: React.FC<FileListEntryProps> = (props) => {
  const { name, file, removeFile } = props;
  const removeThisFile = useCallback(() => removeFile(name), [name, removeFile]);
  return (
    <li className="file-list-entry">
      {name}{file.state === "uploading" ? "..." : ""}
      <span className="file-list-remove" onClick={removeThisFile}>x</span>
    </li>
  );
};

export default App;
