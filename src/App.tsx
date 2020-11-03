import React, { useCallback, useMemo, useState } from "react";
import { useDropzone } from "react-dropzone";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faTrash,
  faChevronDown,
  faCheck,
  faEdit,
  faUndo,
  faCaretDown,
} from "@fortawesome/free-solid-svg-icons";
import { SourceFileState, UserFileState } from "./file_states";
import { useUploader } from "./uploader";
import "./App.css";
import { MappedSegment, parseFiles, ParseResult, Segment } from "./parse";
import { useDiffMemo } from "./diff_memo";

const App: React.FC = () => {
  const uploaderState = useUploader();
  const parseResult = useDiffMemo(
    (prev?: ParseResult) => parseFiles(uploaderState.uploadedFiles, prev),
    [uploaderState.uploadedFiles]
  );

  const [leftFilelistOpen, setLeftFilelistOpen] = useState(false);
  const [rightFilelistOpen, setRightFilelistOpen] = useState(false);

  const [selectedLeft, setSelectedLeft] = useState<string | undefined>();
  const [selectedRight, setSelectedRight] = useState<string | undefined>();
  const selectFile = useCallback(
    (name: string) => {
      setLeftFilelistOpen(false);
      setSelectedLeft(name);
    },
    [setLeftFilelistOpen, setSelectedLeft]
  );
  const [selectSegmentLeft, setSelectSegmentLeft] = useState<
    [number, number] | undefined
  >();
  const [highlightRight, setHighlightRight] = useState<
    [number, number] | undefined
  >();
  const selectRightFile = useCallback(
    (name: string, highlight?: [[number, number], [number, number]]) => {
      setRightFilelistOpen(false);
      setSelectedRight(name);
      setSelectSegmentLeft(highlight ? highlight[0] : undefined);
      setHighlightRight(highlight ? highlight[1] : undefined);
    },
    [setRightFilelistOpen, setSelectedRight]
  );
  const selectedLeftFile =
    selectedLeft !== undefined
      ? uploaderState.uploadedFiles.get(selectedLeft)
      : undefined;
  const selectedLeftParsed =
    selectedLeft !== undefined
      ? parseResult.files.get(selectedLeft)
      : undefined;
  const selectedRightFile =
    selectedRight !== undefined
      ? parseResult.sourceFiles.get(selectedRight)
      : undefined;
  // TODO: relative path
  const mappings = selectedLeftParsed?.sourceMapRef
    ? parseResult.files.get(selectedLeftParsed.sourceMapRef)?.sourceMap
        ?.mappings
    : undefined;
  const inversedMappings = useMemo<Segment[][] | undefined>(() => {
    if (selectedLeft && selectedRight && mappings) {
      return inverseMappings(selectedLeft, selectedRight, mappings);
    } else {
      return undefined;
    }
  }, [selectedLeft, selectedRight, mappings]);
  return (
    <div className="App">
      <h1>SourceMap Explorer</h1>
      <div className="editor">
        <div className="editor-generated">
          <ul
            className={
              selectedLeftFile && !leftFilelistOpen
                ? "file-list closed"
                : "file-list"
            }
          >
            {Array.from(uploaderState.userFiles.entries()).map(
              ([name, file]) => (
                <FileListEntry
                  key={name}
                  name={name}
                  file={file}
                  selected={name === selectedLeft}
                  selectFile={selectFile}
                  removeFile={uploaderState.removeFile}
                  renameFile={uploaderState.renameFile}
                />
              )
            )}
            <FileListAddButton onDrop={uploaderState.onDrop} />
          </ul>
          {selectedLeftFile ? (
            <>
              <div
                className="file-heading"
                onClick={() => setLeftFilelistOpen(true)}
              >
                <div className="file-heading-inner">{selectedLeft}</div>
                <button onClick={() => setLeftFilelistOpen(true)}>
                  <FontAwesomeIcon icon={faChevronDown} />
                </button>
              </div>
              <SourceMappedText
                text={new TextDecoder().decode(selectedLeftFile.content)}
                mappings={mappings}
                openRight={selectRightFile}
                highlight={selectSegmentLeft}
              />
            </>
          ) : null}
        </div>
        <div className="editor-source">
          <ul
            className={
              selectedRightFile &&
              selectedRightFile.state !== "missing" &&
              !rightFilelistOpen
                ? "file-list closed"
                : "file-list"
            }
          >
            {Array.from(parseResult.sourceFiles.entries()).map(
              ([name, file]) => (
                <FileListEntry
                  key={name}
                  name={name}
                  file={file}
                  selected={false}
                  selectFile={selectRightFile}
                  removeFile={uploaderState.removeFile}
                  renameFile={uploaderState.renameFile}
                />
              )
            )}
          </ul>
          {selectedRightFile && selectedRightFile.state !== "missing" ? (
            <>
              <div
                className="file-heading"
                onClick={() => setRightFilelistOpen(true)}
              >
                <div className="file-heading-inner">{selectedRight}</div>
                <button onClick={() => setRightFilelistOpen(true)}>
                  <FontAwesomeIcon icon={faChevronDown} />
                </button>
              </div>
              <SourceMappedText
                text={new TextDecoder().decode(selectedRightFile.content)}
                mappings={inversedMappings}
                highlight={highlightRight}
              />
            </>
          ) : null}
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
  renameFile: (name: string, newName: string) => void;
  selectFile?: (name: string) => void;
}

const FileListEntry: React.FC<FileListEntryProps> = (props) => {
  const { name, file, selected, removeFile, renameFile, selectFile } = props;
  const [nameEditing, setNameEditing] = useState<string | undefined>();
  const editable = file.state === "uploaded";
  const editing = editable && !!nameEditing;
  const classNames = [
    "file-list-entry",
    selected ? "selected" : undefined,
  ].filter(Boolean);
  return (
    <li
      className={classNames.join(" ")}
      onClick={(e) => {
        if (!editing && selectFile) {
          selectFile(name);
        }
      }}
    >
      <div className="file-list-entry-inner">
        {editing ? (
          <input
            type="text"
            className="file-list-name-input"
            value={nameEditing}
            onChange={(e) => setNameEditing(e.currentTarget.value)}
            onKeyPress={(e) => {
              if (e.key === "Enter") {
                renameFile(name, nameEditing ?? name);
                setNameEditing(undefined);
              }
            }}
            autoFocus={true}
          />
        ) : (
          <span className="file-list-name">{name}</span>
        )}
        {file.state === "uploading" ? "..." : ""}
      </div>
      {(file.state === "uploaded" || file.state === "bundled") && !editing ? (
        <button
          className="file-list-select"
          onClick={(e) => {
            e.stopPropagation();
            if (selectFile) selectFile(name);
          }}
        >
          <FontAwesomeIcon icon={faCaretDown} />
        </button>
      ) : null}
      {editing ? (
        <>
          <button
            className="file-list-apply-edit"
            onClick={(e) => {
              e.stopPropagation();
              renameFile(name, nameEditing ?? name);
              setNameEditing(undefined);
            }}
          >
            <FontAwesomeIcon icon={faCheck} />
          </button>
          <button
            className="file-list-cancel-edit"
            onClick={(e) => {
              e.stopPropagation();
              setNameEditing(undefined);
            }}
          >
            <FontAwesomeIcon icon={faUndo} />
          </button>
        </>
      ) : editable ? (
        <button
          className="file-list-edit"
          onClick={(e) => {
            e.stopPropagation();
            setNameEditing(name);
          }}
        >
          <FontAwesomeIcon icon={faEdit} />
        </button>
      ) : null}
      {file.state === "uploading" || file.state === "uploaded" ? (
        <button
          className="file-list-remove"
          onClick={(e) => {
            e.stopPropagation();
            removeFile(name);
          }}
        >
          <FontAwesomeIcon icon={faTrash} />
        </button>
      ) : null}
    </li>
  );
};

interface FileListAddButtonProps {
  onDrop: (uploadedFiles: File[]) => void;
}

const FileListAddButton: React.FC<FileListAddButtonProps> = (props) => {
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: props.onDrop,
  });
  return (
    <li className="file-list-add-button" {...getRootProps()}>
      <input {...getInputProps()} />
      {isDragActive ? (
        <div>Drop the files here ...</div>
      ) : (
        <span>Drag 'n' drop some files here, or click to select files</span>
      )}
    </li>
  );
};

interface SourceMappedTextProps {
  text: string;
  mappings?: Segment[][];
  highlight?: [number, number];
  openRight?: (
    name: string,
    highlight?: [[number, number], [number, number]]
  ) => void;
}

const SourceMappedText: React.FC<SourceMappedTextProps> = (props) => {
  const mappings = props.mappings ?? [];
  return (
    <pre className="generated-file-content">
      <code>
        {props.text.split("\n").map((line, lineno) => (
          <SourceMappedLine
            key={lineno}
            lineno={lineno}
            line={line}
            mappings={mappings[lineno]}
            highlight={
              props.highlight
                ? props.highlight[0] === lineno
                  ? props.highlight[1]
                  : undefined
                : undefined
            }
            openRight={props.openRight}
          />
        ))}
      </code>
    </pre>
  );
};

interface SourceMappedLineProps {
  lineno: number;
  line: string;
  mappings?: Segment[];
  highlight?: number;
  openRight?: (
    name: string,
    highlight?: [[number, number], [number, number]]
  ) => void;
}

const SourceMappedLine: React.FC<SourceMappedLineProps> = (props) => {
  let mappings = props.mappings ?? [];
  if (mappings.length === 0 || mappings[0].column > 0) {
    mappings = [{ column: 0 }].concat(mappings);
  }
  return (
    <>
      {mappings.map((mapping, i) => {
        const nextColumn = mappings[i + 1]?.column ?? props.line.length;
        if (mapping.column >= nextColumn) return null;
        const segmentText = props.line.substring(mapping.column, nextColumn);
        return (
          <SourceMappedSegment
            key={mapping.column}
            lineno={props.lineno}
            segmentText={segmentText}
            mapping={mapping}
            highlight={props.highlight === mapping.column}
            openRight={props.openRight}
          />
        );
      })}
      {"\n"}
    </>
  );
};

interface SourceMappedSegmentProps {
  lineno: number;
  segmentText: string;
  mapping: Segment;
  highlight: boolean;
  openRight?: (
    name: string,
    highlight?: [[number, number], [number, number]]
  ) => void;
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
  }, [
    openRight,
    mapping.source,
    props.lineno,
    mapping.column,
    mapping.sourceLine,
    mapping.sourceColumn,
  ]);
  if (mapping.source) {
    return (
      <span
        className={highlight ? "segment-mapped highlight" : "segment-mapped"}
        onClick={openThisRight}
      >
        {segmentText}
      </span>
    );
  } else {
    return <span className="segment-unmapped">{segmentText}</span>;
  }
};

const inverseMappings = (
  name: string,
  sourceName: string,
  mappings: Segment[][]
): Segment[][] => {
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
