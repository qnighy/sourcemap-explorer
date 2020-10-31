import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTrash } from '@fortawesome/free-solid-svg-icons';
import { SourceFileState, UserFileState } from './file_states';
import { useUploader } from './uploader';
import './App.css';
import { parseFiles, ParseResult } from './parse';
import { useDiffMemo } from './diff_memo';

const App: React.FC = () => {
  const uploaderState = useUploader();
  const parseResult = useDiffMemo((prev?: ParseResult) => parseFiles(uploaderState.uploadedFiles, prev), [uploaderState.uploadedFiles]);
  const {getRootProps, getInputProps, isDragActive} = useDropzone({onDrop: uploaderState.onDrop})

  const [selectedGenerated, setSelectedGenerated] = useState<string | undefined>(undefined);
  const selectedGeneratedFile = selectedGenerated !== undefined ? uploaderState.uploadedFiles.get(selectedGenerated) : undefined;
  return (
    <div className="App">
      <h1>SourceMap Explorer</h1>
      <div className="editor">
        <div className="editor-generated">
          <h2>Generated</h2>
          <ul className="file-list">
            {
              Array.from(uploaderState.userFiles.entries()).map(([name, file]) => (
                <FileListEntry key={name} name={name} file={file} selected={name === selectedGenerated} selectFile={setSelectedGenerated} removeFile={uploaderState.removeFile} />
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
          {selectedGeneratedFile ?
            <pre className="generated-file-content">
              <code>
                {new TextDecoder().decode(selectedGeneratedFile.content)}
              </code>
            </pre>
            : null
          }
        </div>
        <div className="editor-source">
          <h2>Source</h2>
          <ul className="file-list">
            {
              Array.from(parseResult.sourceFiles.entries()).map(([name, file]) => (
                <FileListEntry key={name} name={name} file={file} selected={false} removeFile={uploaderState.removeFile} />
              ))
            }
          </ul>
        </div>
      </div>
    </div>
  );
};

interface FileListEntryProps {
  name: string;
  file: UserFileState | SourceFileState;
  selected: boolean;
  removeFile: (name: string) => void;
  selectFile?: (name: string) => void;
}

const FileListEntry: React.FC<FileListEntryProps> = (props) => {
  const { name, file, selected, removeFile, selectFile } = props;
  const removeThisFile = useCallback(() => removeFile(name), [name, removeFile]);
  const selectThisFile = useCallback(() => selectFile && selectFile(name), [name, selectFile]);
  const classNames = ["file-list-entry", selected ? "selected" : undefined].filter(Boolean);
  return (
    <li className={classNames.join(" ")}>
      <button onClick={selectThisFile} disabled={selected}>
        <div className="file-list-entry-inner">
          {name}{file.state === "uploading" ? "..." : ""}
        </div>
        {
          file.state === "uploading" || file.state === "uploaded" ?
          <button className="file-list-remove" onClick={removeThisFile}>
            <FontAwesomeIcon icon={faTrash} />
          </button> :
          null
        }
      </button>
    </li>
  );
};

export default App;
