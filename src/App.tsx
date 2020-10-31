import React from 'react';
import { useDropzone } from 'react-dropzone';
import { useUploader } from './Uploader';
import './App.css';

const App: React.FC = () => {
  const uploaderState = useUploader();
  const {getRootProps, getInputProps, isDragActive} = useDropzone({onDrop: uploaderState.onDrop})
  return (
    <div className="App">
      <h1>SourceMap Explorer</h1>
      <div className="editor">
        <div className="editor-generated">
          <ul>
            {
              Array.from(uploaderState.uploadedFiles.entries()).map(([name, file]) => (
                <li key={name}>{name}{file.state === "uploading" ? "..." : ""}</li>
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
        <div className="editor-source"></div>
      </div>
    </div>
  );
};

export default App;
