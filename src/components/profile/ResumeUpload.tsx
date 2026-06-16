import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { Check, Loader2, UploadCloud } from 'lucide-react';
import { supabase } from '../../app/lib/supabase';

export interface ResumeFields {
  full_name: string | null;
  email: string | null;
  linkedin: string | null;
  github: string | null;
  major: string | null;
  academic_year: string | null;
  skills: string | null;
  degree: string | null;
}

const AUTOFILL_FIELDS: Array<{ key: keyof ResumeFields; label: string }> = [
  { key: 'full_name', label: 'Full Name' },
  { key: 'email', label: 'Email' },
  { key: 'major', label: 'Major' },
  { key: 'academic_year', label: 'Academic Year' },
  { key: 'linkedin', label: 'LinkedIn' },
  { key: 'github', label: 'GitHub' },
  { key: 'skills', label: 'Skills' },
  { key: 'degree', label: 'Degree' },
];

type ResumeUploadProps = {
  onAutofill: (fields: ResumeFields) => void;
  onResumeUploaded?: (resume: { name: string; uploadDate: string }) => void;
};

export type ResumeUploadHandle = {
  triggerReplace: () => void;
};

const ResumeUpload = forwardRef<ResumeUploadHandle, ResumeUploadProps>(function ResumeUpload({ onAutofill, onResumeUploaded }, ref) {
  const inputRef = useRef<HTMLInputElement>(null);
  const replaceInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState('');
  const [parsedFields, setParsedFields] = useState<ResumeFields | null>(null);

  useImperativeHandle(ref, () => ({
    triggerReplace: () => {
      replaceInputRef.current?.click();
    },
  }), []);

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
      const { data: sessionData } = supabase
        ? await supabase.auth.getSession()
        : { data: { session: null } };
      const accessToken = sessionData.session?.access_token;
      const authHeaders = accessToken
        ? {
            Authorization: `Bearer ${accessToken}`,
          }
        : undefined;

      const formData = new FormData();
      formData.append('resume', file);

      const response = await fetch('/api/profile/parse-resume', {
        method: 'POST',
        headers: authHeaders,
        body: formData,
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload?.error || 'Resume parsing failed.');
      }

      if (!payload?.data) {
        throw new Error('Resume parser returned no data.');
      }

      const fields = payload.data as ResumeFields;
      setParsedFields(fields);
      onAutofill(fields);

      const resumeFormData = new FormData();
      resumeFormData.append('resume', file);
      try {
        const resumeSaveResponse = await fetch('/api/profile/resume', {
          method: 'POST',
          headers: authHeaders,
          body: resumeFormData,
        });

        const resumeSavePayload = await resumeSaveResponse.json().catch(() => ({}));

        if (!resumeSaveResponse.ok) {
          throw new Error('Resume upload failed while saving profile resume.');
        }

        onResumeUploaded?.(
          resumeSavePayload?.resume ?? {
            name: file.name,
            uploadDate: new Date().toISOString(),
          }
        );
      } catch (saveError) {
        console.error('Resume file save failed:', saveError);
      }
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Resume parsing failed.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleUpload = async (file: File) => {
    await uploadFile(file);
  };

  const handleFiles = async (files: FileList | null) => {
    const file = files?.[0];
    if (!file) {
      return;
    }

    await handleUpload(file);
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
      await handleUpload(file);
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
        <input
          ref={replaceInputRef}
          type="file"
          accept=".pdf,.txt"
          style={{ display: 'none' }}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) {
              void handleUpload(file);
            }
            event.target.value = '';
          }}
        />

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
            <p className="text-sm text-muted-foreground">
              Uploads will autofill: Full Name, Email, Major, Academic Year,
              LinkedIn, GitHub, Skills, and Degree.
            </p>
          </>
        )}
      </div>

      {error ? <p className="text-sm text-red-600" role="alert">{error}</p> : null}

      {parsedFields ? (
        <div className="rounded-xl border border-[#d7d0ca] bg-[#fcfbfa] px-4 py-3">
          {AUTOFILL_FIELDS.filter((f) => parsedFields[f.key] !== null).map((f) => (
            <div key={f.key} className="flex items-center gap-2 text-sm py-1">
              <Check className="h-4 w-4 shrink-0 text-green-500" aria-hidden="true" />
              <span className="font-medium">{f.label}:</span>
              <span className="text-muted-foreground truncate max-w-xs">
                {parsedFields[f.key]}
              </span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
});

export default ResumeUpload;
