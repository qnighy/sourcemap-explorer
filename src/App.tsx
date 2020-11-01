import React, { useCallback, useMemo, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTrash, faChevronDown, faCheck } from '@fortawesome/free-solid-svg-icons';
import { SourceFileState, UserFileState } from './file_states';
import { useUploader } from './uploader';
import './App.css';
import { MappedSegment, parseFiles, ParseResult, Segment } from './parse';
import { useDiffMemo } from './diff_memo';

const App: React.FC = () => {
  const uploaderState = useUploader();
  const parseResult = useDiffMemo((prev?: ParseResult) => parseFiles(uploaderState.uploadedFiles, prev), [uploaderState.uploadedFiles]);

  const [leftFilelistOpen, setLeftFilelistOpen] = useState(false);
  const [rightFilelistOpen, setRightFilelistOpen] = useState(false);

  const [selectedGenerated, setSelectedGenerated] = useState<string | undefined>(undefined);
  const [selectedRight, setSelectedRight] = useState<string | undefined>(undefined);
  const selectFile = useCallback((name: string) => {
    setLeftFilelistOpen(false);
    setSelectedGenerated(name);
  }, [setLeftFilelistOpen, setSelectedGenerated]);
  const [selectSegmentLeft, setSelectSegmentLeft] = useState<[number, number] | undefined>();
  const [highlightRight, setHighlightRight] = useState<[number, number] | undefined>();
  const selectRightFile = useCallback((name: string, highlight?: [[number, number], [number, number]]) => {
    setRightFilelistOpen(false);
    setSelectedRight(name);
    setSelectSegmentLeft(highlight ? highlight[0] : undefined);
    setHighlightRight(highlight ? highlight[1] : undefined);
  }, [setRightFilelistOpen, setSelectedRight]);
  const selectedGeneratedFile = selectedGenerated !== undefined ? uploaderState.uploadedFiles.get(selectedGenerated) : undefined;
  const selectedGeneratedParsed = selectedGenerated !== undefined ? parseResult.files.get(selectedGenerated) : undefined;
  const selectedRightFile = selectedRight !== undefined ? parseResult.sourceFiles.get(selectedRight) : undefined;
  // TODO: relative path
  const mappings =
    selectedGeneratedParsed?.sourceMapRef ?
    parseResult.files.get(selectedGeneratedParsed.sourceMapRef)?.sourceMap?.mappings :
    undefined;
  const inversedMappings = useMemo<Segment[][] | undefined>(() => {
    if (selectedGenerated && selectedRight && mappings) {
      return inverseMappings(selectedGenerated, selectedRight, mappings);
    } else {
      return undefined;
    }
  }, [selectedGenerated, selectedRight, mappings]);
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
              <SourceMappedText text={new TextDecoder().decode(selectedGeneratedFile.content)} mappings={mappings} openRight={selectRightFile} highlight={selectSegmentLeft} />
            </>
            : null
          }
        </div>
        <div className="editor-source">
          <ul className={(selectedRightFile && selectedRightFile.state !== "missing" && !rightFilelistOpen) ? "file-list closed" : "file-list"}>
            {
              Array.from(parseResult.sourceFiles.entries()).map(([name, file]) => (
                <FileListEntry key={name} name={name} file={file} selected={false} selectFile={selectRightFile} removeFile={uploaderState.removeFile} />
              ))
            }
          </ul>
          {(selectedRightFile && selectedRightFile.state !== "missing") ?
            <>
              <div className="file-heading" onClick={() => setRightFilelistOpen(true)}>
                <div className="file-heading-inner">{selectedRight}</div>
                <button onClick={() => setRightFilelistOpen(true)}>
                  <FontAwesomeIcon icon={faChevronDown} />
                </button>
              </div>
              <SourceMappedText text={new TextDecoder().decode(selectedRightFile.content)} mappings={inversedMappings} highlight={highlightRight} />
            </>
            : null
          }
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
  highlight?: [number, number];
  openRight?: (name: string, highlight?: [[number, number], [number, number]]) => void;
}

const SourceMappedText: React.FC<SourceMappedTextProps> = (props) => {
  const mappings = props.mappings ?? [];
  return (
    <pre className="generated-file-content">
      <code>
        {
          props.text.split("\n").map((line, lineno) => (
            <SourceMappedLine
              key={lineno}
              lineno={lineno}
              line={line}
              mappings={mappings[lineno]}
              highlight={
                props.highlight ? props.highlight[0] === lineno ? props.highlight[1] : undefined : undefined
              }
              openRight={props.openRight}
            />
          ))
        }
      </code>
    </pre>
  );
};

interface SourceMappedLineProps {
  lineno: number;
  line: string;
  mappings?: Segment[];
  highlight?: number;
  openRight?: (name: string, highlight?: [[number, number], [number, number]]) => void;
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
          return <SourceMappedSegment
            key={mapping.column}
            lineno={props.lineno}
            segmentText={segmentText}
            mapping={mapping}
            highlight={props.highlight === mapping.column}
            openRight={props.openRight}
          />
        })
      }
      {"\n"}
    </>
  );
};

interface SourceMappedSegmentProps {
  lineno: number;
  segmentText: string;
  mapping: Segment;
  highlight: boolean;
  openRight?: (name: string, highlight?: [[number, number], [number, number]]) => void;
}

const SourceMappedSegment: React.FC<SourceMappedSegmentProps> = (props) => {
  const { segmentText, mapping, highlight, openRight } = props;
  const openThisRight = useCallback(() => {
    if (openRight && mapping.source) {
      openRight(mapping.source, [
        [props.lineno, mapping.column],
        [mapping.sourceLine, mapping.sourceColumn],
      ]);
    }
  }, [openRight, mapping.source, props.lineno, mapping.column, mapping.sourceLine, mapping.sourceColumn]);
  if (mapping.source) {
    return <span className={highlight ? "segment-mapped highlight" : "segment-mapped"} onClick={openThisRight}>{segmentText}</span>;
  } else {
    return <span className="segment-unmapped">{segmentText}</span>;
  }
};

const inverseMappings = (name: string, sourceName: string, mappings: Segment[][]): Segment[][] => {
  const newMappings: MappedSegment[][] = [];
  for (const [lineno, line] of Array.from(mappings.entries())) {
    for (const segment of line) {
      if (!segment.source) continue;
      if (segment.source !== sourceName) continue;
      while (newMappings.length <= segment.sourceLine) newMappings.push([]);
      newMappings[segment.sourceLine].push({
        column: segment.sourceColumn,
        source: name,
        sourceLine: lineno,
        sourceColumn: segment.column,
      });
    }
  }
  for (const line of newMappings) {
    line.sort((a, b) => {
      if (a.column !== b.column) return a.column - b.column;
      // For sort reproducibility
      if (a.sourceLine !== b.sourceLine) return a.sourceLine - b.sourceLine;
      return a.sourceLine - b.sourceLine;
    });
  }
  return newMappings;
};

export default App;
