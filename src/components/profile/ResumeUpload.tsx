import { useEffect, useRef, useState } from 'react';
import { Loader2, UploadCloud } from 'lucide-react';

export interface ResumeFields {
  full_name: string | null;
  email: string | null;
  phone: string | null;
  location: string | null;
  linkedin: string | null;
  github_or_portfolio: string | null;
  university: string | null;
  degree: string | null;
  major: string | null;
  gpa: string | null;
  graduation_date: string | null;
  graduation_type: string | null;
  most_recent_job_title: string | null;
  most_recent_employer: string | null;
  years_of_experience: string | null;
  work_authorization: string | null;
  skills: string | null;
  professional_summary: string | null;
}

type ResumeUploadProps = {
  onAutofill: (fields: ResumeFields) => void;
};

export default function ResumeUpload({ onAutofill }: ResumeUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isUploading) {
      setElapsed(0);
      return;
    }

    const interval = setInterval(() => setElapsed((current) => current + 1), 1000);
    return () => clearInterval(interval);
  }, [isUploading]);

  const uploadFile = async (file: File) => {
    setError('');
    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append('resume', file);

      const response = await fetch('/api/profile/parse-resume', {
        method: 'POST',
        body: formData,
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload?.error || 'Resume parsing failed.');
      }

      if (!payload?.data) {
        throw new Error('Resume parser returned no data.');
      }

      console.log('Raw API response:', payload);
      console.log('Calling onAutofill with:', payload.data);
      onAutofill(payload.data as ResumeFields);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Resume parsing failed.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleFiles = async (files: FileList | null) => {
    const file = files?.[0];
    if (!file) {
      return;
    }

    await uploadFile(file);
  };

  const handleClick = () => {
    inputRef.current?.click();
  };

  const handleChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    await handleFiles(event.target.files);
    event.target.value = '';
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = async (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(false);
    const file = event.dataTransfer.files?.[0];
    if (file) {
      await uploadFile(file);
    }
  };

  return (
    <div className="space-y-3">
      <div
        role="button"
        tabIndex={0}
        aria-busy={isUploading}
        onClick={handleClick}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            handleClick();
          }
        }}
        className={`flex min-h-36 cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-8 text-center transition-colors ${
          isDragging ? 'border-red-600 bg-red-50' : 'border-[#d7d0ca] bg-[#fcfbfa] hover:border-red-300 hover:bg-red-50/40'
        } ${isUploading ? 'cursor-wait opacity-80' : ''}`}
      >
        <input ref={inputRef} type="file" accept=".pdf,.txt" onChange={handleChange} style={{ display: 'none' }} />

        {isUploading ? (
          <div className="space-y-2 text-center">
            <div className="flex items-center gap-3 text-sm font-medium text-red-700">
              <Loader2 className="h-5 w-5 animate-spin" />
              Extracting fields...
            </div>
            <p className="text-sm text-muted-foreground mt-2">Extracting fields... {elapsed}s</p>
          </div>
        ) : (
          <>
            <UploadCloud className="h-10 w-10 text-red-700" />
            <p className="mt-3 text-sm font-semibold text-foreground">Upload your resume</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Drag and drop a PDF or .txt file here, or click to browse.
            </p>
          </>
        )}
      </div>

      {error ? <p className="text-sm text-red-600" role="alert">{error}</p> : null}
    </div>
  );
}