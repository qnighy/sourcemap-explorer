import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTrash, faChevronDown, faCheck } from '@fortawesome/free-solid-svg-icons';
import { SourceFileState, UserFileState } from './file_states';
import { useUploader } from './uploader';
import './App.css';
import { parseFiles, ParseResult, Segment } from './parse';
import { useDiffMemo } from './diff_memo';

const App: React.FC = () => {
  const uploaderState = useUploader();
  const parseResult = useDiffMemo((prev?: ParseResult) => parseFiles(uploaderState.uploadedFiles, prev), [uploaderState.uploadedFiles]);

  const [leftFilelistOpen, setLeftFilelistOpen] = useState(false);

  const [selectedGenerated, setSelectedGenerated] = useState<string | undefined>(undefined);
  const selectFile = useCallback((name: string) => {
    setLeftFilelistOpen(false);
    setSelectedGenerated(name);
  }, [setLeftFilelistOpen, setSelectedGenerated]);
  const selectedGeneratedFile = selectedGenerated !== undefined ? uploaderState.uploadedFiles.get(selectedGenerated) : undefined;
  const selectedGeneratedParsed = selectedGenerated !== undefined ? parseResult.files.get(selectedGenerated) : undefined;
  // TODO: relative path
  const mappings =
    selectedGeneratedParsed?.sourceMapRef ?
    parseResult.files.get(selectedGeneratedParsed.sourceMapRef)?.sourceMap?.mappings :
    undefined;
  return (
    <div className="App">
      <h1>SourceMap Explorer</h1>
      <div className="editor">
        <div className="editor-generated">
          <ul className={(selectedGeneratedFile && !leftFilelistOpen) ? "file-list closed" : "file-list"}>
            {
              Array.from(uploaderState.userFiles.entries()).map(([name, file]) => (
                <FileListEntry key={name} name={name} file={file} selected={name === selectedGenerated} selectFile={selectFile} removeFile={uploaderState.removeFile} />
              ))
            }
            <FileListAddButton onDrop={uploaderState.onDrop} />
          </ul>
          {selectedGeneratedFile ?
            <>
              <div className="file-heading" onClick={() => setLeftFilelistOpen(true)}>
                <div className="file-heading-inner">{selectedGenerated}</div>
                <button onClick={() => setLeftFilelistOpen(true)}>
                  <FontAwesomeIcon icon={faChevronDown} />
                </button>
              </div>
              <SourceMappedText text={new TextDecoder().decode(selectedGeneratedFile.content)} mappings={mappings} />
            </>
            : null
          }
        </div>
        <div className="editor-source">
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
    <li className={classNames.join(" ")} onClick={selectThisFile}>
      <div className="file-list-entry-inner">
        {name}{file.state === "uploading" ? "..." : ""}
      </div>
      {
        file.state === "uploading" || file.state === "uploaded" ?
        <>
          <button className="file-list-select" onClick={selectThisFile}>
            <FontAwesomeIcon icon={faCheck} />
          </button>
          <button className="file-list-remove" onClick={removeThisFile}>
            <FontAwesomeIcon icon={faTrash} />
          </button>
        </> :
        null
      }
    </li>
  );
};

interface FileListAddButtonProps {
  onDrop: (uploadedFiles: File[]) => void;
}

const FileListAddButton: React.FC<FileListAddButtonProps> = (props) => {
  const {getRootProps, getInputProps, isDragActive} = useDropzone({onDrop: props.onDrop})
  return (
    <li className="file-list-add-button" {...getRootProps()}>
      <input {...getInputProps()} />
      {
        isDragActive ?
          <div>Drop the files here ...</div> :
          <span>Drag 'n' drop some files here, or click to select files</span>
      }
    </li>
  );
};

interface SourceMappedTextProps {
  text: string;
  mappings?: Segment[][];
}

const SourceMappedText: React.FC<SourceMappedTextProps> = (props) => {
  const mappings = props.mappings ?? [];
  return (
    <pre className="generated-file-content">
      <code>
        {
          props.text.split("\n").map((line, lineno) => (
            <SourceMappedLine key={lineno} line={line} mappings={mappings[lineno]} />
          ))
        }
      </code>
    </pre>
  );
};

interface SourceMappedLineProps {
  line: string;
  mappings?: Segment[];
}

const SourceMappedLine: React.FC<SourceMappedLineProps> = (props) => {
  let mappings = props.mappings ?? [];
  if (mappings.length === 0 || mappings[0].column > 0) {
    mappings = [{ column: 0 }].concat(mappings);
  }
  return (
    <>
      {
        mappings.map((mapping, i) => {
          const nextColumn = mappings[i + 1]?.column ?? props.line.length;
          if (mapping.column >= nextColumn) return null;
          const segmentText = props.line.substring(mapping.column, nextColumn);
          if (mapping.source) {
            return <span key={mapping.column} className="segment-mapped">{segmentText}</span>;
          } else {
            return <span key={mapping.column} className="segment-unmapped">{segmentText}</span>;
          }
        })
      }
      {"\n"}
    </>
  );
};

export default App;
