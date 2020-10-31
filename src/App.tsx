import React, { useCallback, useState } from 'react';
import { useDropzone, FileRejection, DropEvent } from 'react-dropzone';
import './App.css';

const App: React.FC = () => {
  const [uploadedFiles, setUploadedFiles] = useState<Map<string, ArrayBuffer>>(() => new Map());
  const onDrop = useCallback(async (acceptedFiles: File[], fileRejections: FileRejection[], event: DropEvent) => {
    for (const file of acceptedFiles) {
      const content = await file.arrayBuffer();
      setUploadedFiles((oldState) => {
        const state = new Map(oldState);
        state.set(file.name, content);
        return state;
      });
    }
  }, [])
  const {getRootProps, getInputProps, isDragActive} = useDropzone({onDrop})
  return (
    <div className="App">
      <h1>SourceMap Explorer</h1>
      <ul>
        {
          Array.from(uploadedFiles.entries()).map(([name, _content]) => (
            <li key={name}>{name}</li>
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
  );
};

export default App;
