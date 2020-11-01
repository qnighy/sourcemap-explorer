import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTrash } from '@fortawesome/free-solid-svg-icons';
import { SourceFileState, UserFileState } from './file_states';
import { useUploader } from './uploader';
import './App.css';
import { parseFiles, ParseResult } from './parse';
import { useDiffMemo } from './diff_memo';

interface UnmappedSegment {
  column: number;
  source?: undefined;
  sourceLine?: undefined;
  sourceColumn?: undefined;
  name?: undefined;
}
interface MappedSegment {
  column: number;
  source: string;
  sourceLine: number;
  sourceColumn: number;
  name?: string;
}
type Segment = UnmappedSegment | MappedSegment;

const App: React.FC = () => {
  const uploaderState = useUploader();
  const parseResult = useDiffMemo((prev?: ParseResult) => parseFiles(uploaderState.uploadedFiles, prev), [uploaderState.uploadedFiles]);
  const {getRootProps, getInputProps, isDragActive} = useDropzone({onDrop: uploaderState.onDrop})

  const [selectedGenerated, setSelectedGenerated] = useState<string | undefined>(undefined);
  const selectedGeneratedFile = selectedGenerated !== undefined ? uploaderState.uploadedFiles.get(selectedGenerated) : undefined;
  if (selectedGeneratedFile) {
    // TODO: relative path
    const selectedGeneratedParsed = selectedGenerated !== undefined ? parseResult.files.get(selectedGenerated) : undefined;
    if (selectedGeneratedParsed && selectedGeneratedParsed.sourceMapRef) {
      const mapFile = parseResult.files.get(selectedGeneratedParsed.sourceMapRef);
      if (mapFile && mapFile.sourceMap) {
        const mappings = mapFile.sourceMap.mappings + ";";
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
            if (current !== 0) throw new Error("VLQ runover");
            if (currentSegment.length === 0) continue;
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
              source: mapFile.sourceMap.sources[lastSourceIndex],
              sourceLine: lastSourceLine,
              sourceColumn: lastSourceColumn,
              name: currentSegment.length === 5 ? mapFile.sourceMap.names[lastNameIndex] : undefined,
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
            current |= (b << (currentBits & 31));
            currentBits += 5;
          }
        }
        console.log(lines);
      }
    }
  }
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
    return ~(n >> 1);
  } else {
    return (n >> 1);
  }
}

export default App;
