import React, { useCallback, useState } from 'react';
import { Upload, AlertCircle } from 'lucide-react';

interface FileUploaderProps {
  onFilesSelect: (files: File[]) => void;
  disabled?: boolean;
}

const FileUploader: React.FC<FileUploaderProps> = ({ onFilesSelect, disabled }) => {
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (disabled) return;
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, [disabled]);

  const validateAndPassFiles = (fileList: FileList) => {
    setError(null);
    const validFiles: File[] = [];
    const maxFiles = 50;

    if (fileList.length > maxFiles) {
      setError(`Máximo de ${maxFiles} arquivos permitidos por vez.`);
      return;
    }

    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      if (file.type !== 'application/pdf') {
        setError("Apenas arquivos PDF são permitidos.");
        return; // Fail fast if one is invalid
      }
      if (file.size > 20 * 1024 * 1024) {
        setError(`O arquivo ${file.name} é muito grande (Máx 20MB).`);
        return;
      }
      validFiles.push(file);
    }
    
    if (validFiles.length > 0) {
      onFilesSelect(validFiles);
    }
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (disabled) return;

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      validateAndPassFiles(e.dataTransfer.files);
    }
  }, [onFilesSelect, disabled]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files.length > 0) {
      validateAndPassFiles(e.target.files);
    }
  };

  return (
    <div className="w-full">
      <div 
        className={`relative flex flex-col items-center justify-center w-full h-48 border-2 border-dashed rounded-xl transition-all duration-300 ease-in-out
          ${dragActive ? "border-indigo-500 bg-indigo-50" : "border-gray-300 bg-white"}
          ${disabled ? "opacity-50 cursor-not-allowed bg-gray-100" : "hover:border-indigo-400 hover:bg-gray-50 cursor-pointer"}
        `}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <div className="flex flex-col items-center justify-center pt-5 pb-6 text-center px-4">
          <div className="mb-3 p-3 rounded-full bg-indigo-100 text-indigo-600">
             <Upload className="w-6 h-6" />
          </div>
          
          <p className="mb-1 text-base font-medium text-gray-700">
             <span className="font-bold">Clique para upload</span> ou arraste PDFs
          </p>
          <p className="text-xs text-gray-500">
             Até 50 arquivos (Máx 20MB cada)
          </p>
        </div>
        
        <input 
          id="dropzone-file" 
          type="file" 
          className="hidden" 
          accept="application/pdf"
          onChange={handleChange}
          disabled={disabled}
          multiple
        />
        
        {!disabled && (
           <label 
            htmlFor="dropzone-file" 
            className="absolute inset-0 w-full h-full cursor-pointer"
           ></label>
        )}
      </div>

      {error && (
        <div className="mt-3 flex items-center p-3 text-sm text-red-800 border border-red-300 rounded-lg bg-red-50">
          <AlertCircle className="flex-shrink-0 inline w-4 h-4 mr-2" />
          <span className="font-medium">{error}</span>
        </div>
      )}
    </div>
  );
};

export default FileUploader;