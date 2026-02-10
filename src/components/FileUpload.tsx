import { useCallback, useState } from 'react';
import { Upload, FileSpreadsheet, Check, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const MAX_FILE_SIZE_MB = 1;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

interface FileUploadProps {
  onFileSelect: (file: File) => void;
  isProcessing?: boolean;
}

export function FileUpload({ onFileSelect, isProcessing }: FileUploadProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const validateFile = async (file: File): Promise<{ valid: boolean; error?: string }> => {
    // Check file type
    const validTypes = [
      'text/csv',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ];
    const validExtensions = ['.csv', '.xls', '.xlsx'];
    
    const hasValidType = validTypes.includes(file.type);
    const hasValidExtension = validExtensions.some(ext => 
      file.name.toLowerCase().endsWith(ext)
    );
    
    if (!hasValidType && !hasValidExtension) {
      return { valid: false, error: 'Invalid file type. Please upload a CSV or Excel file.' };
    }

    // Check file size (vcita limit: 1MB)
    if (file.size > MAX_FILE_SIZE_BYTES) {
      return { valid: false, error: `File too large. Maximum size is ${MAX_FILE_SIZE_MB}MB for vcita import.` };
    }

    // Magic byte verification
    try {
      const header = await file.slice(0, 8).arrayBuffer();
      const bytes = new Uint8Array(header);
      const isXlsx = bytes[0] === 0x50 && bytes[1] === 0x4B; // PK (ZIP/XLSX)
      const isXls = bytes[0] === 0xD0 && bytes[1] === 0xCF; // OLE2 (XLS)
      const ext = file.name.toLowerCase();
      
      if ((ext.endsWith('.xlsx') && !isXlsx) || (ext.endsWith('.xls') && !isXls)) {
        return { valid: false, error: 'File content does not match its extension.' };
      }
    } catch {
      // If we can't read bytes, allow and let the parser handle it
    }

    return { valid: true };
  };

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    setError(null);
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      const file = files[0];
      const validation = await validateFile(file);
      
      if (validation.valid) {
        setSelectedFile(file);
        onFileSelect(file);
      } else {
        setError(validation.error || 'Invalid file');
        toast.error(validation.error || 'Invalid file');
      }
    }
  }, [onFileSelect]);

  const handleFileInput = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    const files = e.target.files;
    if (files && files.length > 0) {
      const file = files[0];
      const validation = await validateFile(file);
      
      if (validation.valid) {
        setSelectedFile(file);
        onFileSelect(file);
      } else {
        setError(validation.error || 'Invalid file');
        toast.error(validation.error || 'Invalid file');
      }
    }
  }, [onFileSelect]);

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn(
          "relative border-2 border-dashed rounded-2xl p-12 transition-all duration-300 cursor-pointer",
          "hover:border-primary/50 hover:bg-primary/5",
          isDragOver && "border-primary bg-primary/10 scale-[1.02]",
          selectedFile && !isProcessing && "border-primary bg-primary/10",
          isProcessing && "border-primary bg-primary/5"
        )}
      >
        <input
          type="file"
          accept=".csv,.xls,.xlsx"
          onChange={handleFileInput}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          disabled={isProcessing}
        />
        
        <div className="flex flex-col items-center gap-4 text-center pointer-events-none">
          {selectedFile && !isProcessing ? (
            <>
              <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center">
                <Check className="w-8 h-8 text-primary" />
              </div>
              <div>
                <p className="text-lg font-medium text-foreground">{selectedFile.name}</p>
                <p className="text-sm text-muted-foreground mt-1">
                  File ready • Click to change
                </p>
              </div>
            </>
          ) : isProcessing ? (
            <>
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
              <div>
                <p className="text-lg font-medium text-foreground">Thinking...</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Analyzing headers with AI
                </p>
              </div>
            </>
          ) : (
            <>
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
                <Upload className="w-8 h-8 text-muted-foreground" />
              </div>
              <div>
                <p className="text-lg font-medium text-foreground">
                  Drop your file here
                </p>
                <div className="flex items-center justify-center gap-3 mt-2">
                  <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">CSV</span>
                  <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">XLS</span>
                  <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">XLSX</span>
                </div>
                <p className="text-sm text-muted-foreground mt-2">
                  or click to browse
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  Max file size: {MAX_FILE_SIZE_MB}MB • Max 5,000 clients
                </p>
              </div>
            </>
          )}
        </div>
        
        {/* Error message */}
        {error && (
          <div className="flex items-center justify-center gap-2 mt-4 text-sm text-destructive">
            <AlertCircle className="w-4 h-4" />
            <span>{error}</span>
          </div>
        )}
      </div>

    </div>
  );
}
