import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../../contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Button } from '../../components/ui/button';
import { Camera, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '../../lib/supabase';
import ResearchMetadataPicker, {
  normalizeResearchAreas,
  normalizeResearchInterests,
} from '../../components/professor/ResearchMetadataPicker';

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isValidUrl(value: string) {
  return /^https?:\/\//i.test(value);
}

type ImportedProfessorProfile = {
  name?: string;
  title?: string;
  department?: string;
  contactEmail?: string;
  bioUrl?: string;
  websiteUrl?: string;
  publicationsUrl?: string;
  researchAreas?: string[];
  researchInterests?: string[];
  summary?: string;
  extractionMethod?: 'rules' | 'rules+ollama';
};

export default function ProfessorSetupPage() {
  const { user, setupState, updateProfessorProfile } = useAuth();
  const navigate = useNavigate();

  const profile =
    (setupState?.profile as
      | {
          department?: string;
          title?: string;
          contactEmail?: string;
          bioUrl?: string;
          researchAreas?: string[];
          professorWebsite?: string;
          publicationsLink?: string;
          researchInterests?: string[];
          researchSummary?: string;
          photoBase64?: string;
        }
      | undefined) ?? {};

  const [displayName, setDisplayName] = useState(user?.name ?? '');
  const [department, setDepartment] = useState(profile.department ?? '');
  const [title, setTitle] = useState(profile.title ?? '');
  const [contactEmail, setContactEmail] = useState(profile.contactEmail ?? user?.email ?? '');
  const [bioUrl, setBioUrl] = useState(profile.bioUrl ?? '');
  const [researchAreas, setResearchAreas] = useState<string[]>(normalizeResearchAreas(profile.researchAreas));
  const [professorWebsite, setProfessorWebsite] = useState(profile.professorWebsite ?? '');
  const [publicationsLink, setPublicationsLink] = useState(profile.publicationsLink ?? '');
  const [researchInterests, setResearchInterests] = useState<string[]>(normalizeResearchInterests(profile.researchInterests));
  const [researchSummary, setResearchSummary] = useState(profile.researchSummary ?? '');
  const [photoBase64, setPhotoBase64] = useState(profile.photoBase64 ?? '');
  const [isSaving, setIsSaving] = useState(false);
  const [importUrl, setImportUrl] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [importError, setImportError] = useState('');
  const [importSuccess, setImportSuccess] = useState('');
  const [hasImportedProfile, setHasImportedProfile] = useState(false);
  const [showValidationErrors, setShowValidationErrors] = useState(false);
  const trimmedDisplayName = displayName.trim();
  const trimmedDepartment = department.trim();
  const trimmedTitle = title.trim();
  const trimmedContactEmail = contactEmail.trim();
  const trimmedBioUrl = bioUrl.trim();
  const trimmedProfessorWebsite = professorWebsite.trim();
  const trimmedPublicationsLink = publicationsLink.trim();
  const missingDisplayName = showValidationErrors && !trimmedDisplayName;
  const missingDepartment = showValidationErrors && !trimmedDepartment;
  const missingTitle = showValidationErrors && !trimmedTitle;
  const missingContactEmail = showValidationErrors && !trimmedContactEmail;
  const hasInvalidContactEmail = Boolean(trimmedContactEmail) && !isValidEmail(trimmedContactEmail);
  const hasInvalidBioUrl = Boolean(trimmedBioUrl) && !isValidUrl(trimmedBioUrl);
  const hasInvalidProfessorWebsite = Boolean(trimmedProfessorWebsite) && !isValidUrl(trimmedProfessorWebsite);
  const hasInvalidPublicationsLink = Boolean(trimmedPublicationsLink) && !isValidUrl(trimmedPublicationsLink);
  const trimmedImportUrl = importUrl.trim();
  const hasInvalidImportUrl = Boolean(trimmedImportUrl) && !isValidUrl(trimmedImportUrl);
  const initials = (() => {
    const parts = displayName
      .trim()
      .split(/\s+/)
      .filter(Boolean);

    if (parts.length === 0) {
      return 'P';
    }

    const firstInitial = parts[0][0]?.toUpperCase() ?? 'P';
    const lastInitial = parts.length > 1 ? parts[parts.length - 1][0]?.toUpperCase() ?? '' : '';
    return `${firstInitial}${lastInitial}`;
  })();
  const missingResearchAreas = showValidationErrors && researchAreas.length === 0;
  const missingResearchInterests = showValidationErrors && researchInterests.length === 0;

  useEffect(() => {
    if (setupState?.completed) {
      navigate('/professor/dashboard', { replace: true });
    }
  }, [navigate, setupState?.completed]);

  const applyImportedProfile = (imported: ImportedProfessorProfile) => {
    const textUpdates = [
      { current: displayName, value: imported.name, apply: setDisplayName },
      { current: department, value: imported.department, apply: setDepartment },
      { current: title, value: imported.title, apply: setTitle },
      { current: contactEmail, value: imported.contactEmail, apply: setContactEmail },
      { current: bioUrl, value: imported.bioUrl, apply: setBioUrl },
      { current: professorWebsite, value: imported.websiteUrl, apply: setProfessorWebsite },
      { current: publicationsLink, value: imported.publicationsUrl, apply: setPublicationsLink },
    ];
    const importedAreas = normalizeResearchAreas(imported.researchAreas);
    const importedInterests = normalizeResearchInterests(imported.researchInterests);
    const wouldReplaceExisting = textUpdates.some(
      ({ current, value }) => current.trim() && value?.trim() && current.trim() !== value.trim()
    ) || (researchAreas.length > 0 && importedAreas.length > 0) || (researchInterests.length > 0 && importedInterests.length > 0);
    const replaceExisting =
      wouldReplaceExisting && window.confirm('Replace current fields with imported profile?');

    for (const { current, value, apply } of textUpdates) {
      const trimmedValue = value?.trim();
      if (!trimmedValue) continue;
      if (replaceExisting || !current.trim()) {
        apply(trimmedValue);
      }
    }

    if (importedAreas.length > 0 && (replaceExisting || researchAreas.length === 0)) {
      setResearchAreas(importedAreas);
    }
    if (importedInterests.length > 0 && (replaceExisting || researchInterests.length === 0)) {
      setResearchInterests(importedInterests);
    }
    if (imported.summary?.trim() && (replaceExisting || !researchSummary.trim())) {
      setResearchSummary(imported.summary.trim());
    }

    setHasImportedProfile(true);
  };

  const handleImportProfessorProfile = async () => {
    setImportError('');
    setImportSuccess('');

    if (!trimmedImportUrl) {
      setImportError('Paste a professor website, lab page, Google Scholar page, or university bio URL.');
      return;
    }

    if (hasInvalidImportUrl) {
      setImportError('URL must start with http:// or https://');
      return;
    }

    setIsImporting(true);
    try {
      const { data } = supabase ? await supabase.auth.getSession() : { data: { session: null } };
      const accessToken = data.session?.access_token;
      const response = await fetch('/api/import-professor-profile', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify({ url: trimmedImportUrl }),
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload?.error || 'Unable to import profile from that URL.');
      }

      applyImportedProfile(payload);
      setImportSuccess('Imported from website. Please review before saving.');
      toast.success('Profile details imported.');
    } catch (error) {
      const rawMessage = error instanceof Error ? error.message : '';
      const message = /failed to fetch/i.test(rawMessage)
        ? 'Could not reach the local API server. Make sure the full-stack dev server is running and open the app at http://localhost:5173.'
        : rawMessage || 'Unable to import profile from that URL.';
      setImportError(message);
      toast.error(message);
    } finally {
      setIsImporting(false);
    }
  };

  const handleCompleteSetup = async () => {
    setShowValidationErrors(true);

    if (!trimmedDisplayName || !trimmedDepartment || !trimmedTitle || !trimmedContactEmail || researchAreas.length === 0 || researchInterests.length === 0) {
      toast.error('Please complete all fields before continuing.');
      return;
    }

    if (hasInvalidContactEmail) {
      toast.error('Please enter a valid contact email.');
      return;
    }

    if (hasInvalidBioUrl) {
      toast.error('Bio link must start with http:// or https://');
      return;
    }

    if (hasInvalidProfessorWebsite) {
      toast.error("Professor's website must start with http:// or https://");
      return;
    }

    if (hasInvalidPublicationsLink) {
      toast.error('Publications link must start with http:// or https://');
      return;
    }

    setIsSaving(true);
    try {
      await updateProfessorProfile({
        name: trimmedDisplayName,
        department: trimmedDepartment,
        title: trimmedTitle,
        contactEmail: trimmedContactEmail,
        bioUrl: trimmedBioUrl || undefined,
        researchAreas,
        professorWebsite: trimmedProfessorWebsite || undefined,
        publicationsLink: trimmedPublicationsLink || undefined,
        researchInterests,
        researchSummary: researchSummary.trim() || undefined,
        photoBase64: photoBase64 || undefined,
      });
      setShowValidationErrors(false);
      toast.success('Setup completed successfully!');
      navigate('/professor/dashboard', { replace: true });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to complete setup');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#eeecea]">
      <main className="mx-auto max-w-5xl px-4 py-8">
        <Card className="mb-5 border-[#ead8ce] bg-[#f8f1ec] shadow-none">
          <CardHeader>
            <CardTitle>Complete Your Professor Setup</CardTitle>
            <CardDescription>
              Welcome {user?.name}. Please complete your setup before entering the professor dashboard.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-[#8a4d3a]">
            You only need to do this once. You can edit details later from your dashboard.
          </CardContent>
        </Card>

        <section className="overflow-hidden rounded-[28px] border border-[#d9d9d9] bg-white text-[#111111] shadow-[0_18px_36px_rgba(15,15,15,0.06)]">
          <div className="relative h-28 bg-[linear-gradient(120deg,#faf1ef_0%,#f7f4f1_55%,#f2f2f0_100%)]">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,#ffffff90,transparent_58%)]" />
            <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-b from-transparent to-white" />
          </div>

          <div className="relative -mt-10 px-6 pb-6">
            <div className="mx-auto max-w-4xl">
              <div className="flex flex-col items-center gap-5 border-b border-[#ececec] pb-7 md:flex-row md:items-end md:gap-6 md:pb-6">
                <div data-interactive="true" className="group relative flex cursor-pointer" onClick={() => document.getElementById('professor-photo-upload')?.click()}>
                  <div className="flex size-24 shrink-0 items-center justify-center overflow-hidden rounded-full border-4 border-white bg-[linear-gradient(145deg,#d86666,#b4232f)] text-2xl font-medium text-white shadow-[0_12px_24px_rgba(180,35,47,0.18)]">
                    {photoBase64 ? (
                      <img src={`data:image/jpeg;base64,${photoBase64}`} alt="Profile" className="size-full object-cover" />
                    ) : (
                      initials
                    )}
                  </div>
                  <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
                    <Camera className="size-6 text-white" />
                  </div>
                </div>

                <div className="flex-1 space-y-2 text-center md:text-left">
                  <p className="text-xs font-medium uppercase tracking-[0.32em] text-[#8c8c8c]">Professor Profile</p>
                  <div>
                    <h2 className="text-3xl font-semibold tracking-tight text-[#111111]">Complete your setup</h2>
                    <p className="mt-2 max-w-2xl text-sm text-[#6f6f6f]">
                      Add your profile details so students can discover and apply to your research opportunities.
                    </p>
                  </div>
                </div>

              </div>

              <input
                id="professor-photo-upload"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  if (file.size > 5 * 1024 * 1024) {
                    toast.error('Photo must be under 5 MB.');
                    return;
                  }
                  try {
                    const base64 = await fileToBase64Image(file);
                    setPhotoBase64(base64);
                  } catch {
                    toast.error('Unable to read selected photo.');
                  }
                  e.target.value = '';
                }}
                className="hidden"
              />

              <div className="mt-7 rounded-2xl border border-[#ead8ce] bg-[#fcfbfa] p-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-end">
                  <div className="flex-1 space-y-2">
                    <Label className="text-sm font-semibold text-[#575757]">Import from Website</Label>
                    <Input
                      value={importUrl}
                      onChange={(event) => {
                        setImportUrl(event.target.value);
                        setImportError('');
                        setImportSuccess('');
                      }}
                      disabled={isSaving || isImporting}
                      placeholder="https://www.cs.cmu.edu/people/faculty-profile"
                      aria-invalid={hasInvalidImportUrl || Boolean(importError)}
                      className={`h-12 rounded-2xl bg-white px-4 text-[#111111] shadow-none ${
                        hasInvalidImportUrl || importError
                          ? 'border-destructive/80 text-destructive focus-visible:border-destructive/80 focus-visible:ring-destructive/20'
                          : 'border-[#d9d9d9]'
                      }`}
                    />
                  </div>
                  <Button
                    type="button"
                    onClick={handleImportProfessorProfile}
                    disabled={isSaving || isImporting}
                    className="h-12 rounded-2xl bg-red-700 px-5 text-white hover:bg-red-800"
                  >
                    {isImporting ? (
                      <>
                        <Loader2 className="mr-2 size-4 animate-spin" />
                        Importing
                      </>
                    ) : (
                      'Import'
                    )}
                  </Button>
                </div>
                <p className="mt-2 text-xs text-[#7a7a7a]">
                  Paste a professor website, lab page, Google Scholar page, or university bio URL. Imported data is not saved until you click Complete Setup.
                </p>
                {hasInvalidImportUrl ? <p className="mt-2 text-xs text-destructive">URL must start with http:// or https://</p> : null}
                {importError ? <p className="mt-2 text-xs text-destructive" role="alert">{importError}</p> : null}
                {importSuccess ? <p className="mt-2 text-xs text-emerald-700" role="status">{importSuccess}</p> : null}
              </div>

              {hasImportedProfile ? (
                <div className="mt-4 rounded-2xl border border-[#ead8ce] bg-[#fff8f5] px-4 py-3 text-sm text-[#8a4d3a]">
                  Imported from website. Please review before saving.
                </div>
              ) : null}

              <div className="mt-7 grid grid-cols-1 gap-5 md:grid-cols-2">
                <div className="space-y-2">
                  <Label className="text-sm font-semibold text-[#575757]">Name <span className="text-red-700">*</span></Label>
                  <Input
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    disabled={isSaving}
                    placeholder="Sarah Chen"
                    aria-invalid={missingDisplayName}
                    className={`h-12 rounded-2xl bg-white px-4 text-[#111111] shadow-none ${
                      missingDisplayName
                        ? 'border-destructive/80 text-destructive focus-visible:border-destructive/80 focus-visible:ring-destructive/20'
                        : 'border-[#d9d9d9]'
                    }`}
                  />
                  {missingDisplayName && <p className="mt-2 text-xs text-destructive">This field is required</p>}
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-semibold text-[#575757]">Department <span className="text-red-700">*</span></Label>
                  <Input
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    disabled={isSaving}
                    placeholder="Robotics Institute"
                    aria-invalid={missingDepartment}
                    className={`h-12 rounded-2xl bg-white px-4 text-[#111111] shadow-none ${
                      missingDepartment
                        ? 'border-destructive/80 text-destructive focus-visible:border-destructive/80 focus-visible:ring-destructive/20'
                        : 'border-[#d9d9d9]'
                    }`}
                  />
                  {missingDepartment && <p className="mt-2 text-xs text-destructive">This field is required</p>}
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-semibold text-[#575757]">Title <span className="text-red-700">*</span></Label>
                  <Input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    disabled={isSaving}
                    placeholder="Assistant Professor"
                    aria-invalid={missingTitle}
                    className={`h-12 rounded-2xl bg-white px-4 text-[#111111] shadow-none ${
                      missingTitle
                        ? 'border-destructive/80 text-destructive focus-visible:border-destructive/80 focus-visible:ring-destructive/20'
                        : 'border-[#d9d9d9]'
                    }`}
                  />
                  {missingTitle && <p className="mt-2 text-xs text-destructive">This field is required</p>}
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-semibold text-[#575757]">Contact Email <span className="text-red-700">*</span></Label>
                  <Input
                    value={contactEmail}
                    onChange={(e) => setContactEmail(e.target.value)}
                    disabled={isSaving}
                    placeholder="schen@andrew.cmu.edu"
                    aria-invalid={missingContactEmail || hasInvalidContactEmail}
                    className={`h-12 rounded-2xl bg-white px-4 text-[#111111] shadow-none ${
                      missingContactEmail || hasInvalidContactEmail
                        ? 'border-destructive/80 text-destructive focus-visible:border-destructive/80 focus-visible:ring-destructive/20'
                        : 'border-[#d9d9d9]'
                    }`}
                  />
                  {missingContactEmail && <p className="mt-2 text-xs text-destructive">This field is required</p>}
                  {hasInvalidContactEmail && (
                    <p className="mt-2 text-xs text-destructive" role="alert" aria-live="polite">
                      Email is invalid
                    </p>
                  )}
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label className="text-sm font-semibold text-[#575757]">Link to Bio</Label>
                  <Input
                    value={bioUrl}
                    onChange={(e) => setBioUrl(e.target.value)}
                    disabled={isSaving}
                    placeholder="https://www.cs.cmu.edu/people/sarah-chen"
                    aria-invalid={hasInvalidBioUrl}
                    className={`h-12 rounded-2xl bg-white px-4 text-[#111111] shadow-none ${
                      hasInvalidBioUrl
                        ? 'border-destructive/80 text-destructive focus-visible:border-destructive/80 focus-visible:ring-destructive/20'
                        : 'border-[#d9d9d9]'
                    }`}
                  />
                  {hasInvalidBioUrl && (
                    <p className="mt-2 text-xs text-destructive" role="alert" aria-live="polite">
                      Bio link must start with http:// or https://
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <ResearchMetadataPicker
                    label="Research Areas"
                    value={researchAreas}
                    onChange={setResearchAreas}
                    disabled={isSaving}
                    placeholder="Search canonical fields"
                  />
                  {missingResearchAreas && <p className="mt-2 text-xs text-destructive">Select at least one research area</p>}
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-semibold text-[#575757]">Professor's Website</Label>
                  <Input
                    value={professorWebsite}
                    onChange={(e) => setProfessorWebsite(e.target.value)}
                    disabled={isSaving}
                    placeholder="https://www.andrew.cmu.edu/user/praman/"
                    aria-invalid={hasInvalidProfessorWebsite}
                    className={`h-12 rounded-2xl bg-white px-4 text-[#111111] shadow-none ${
                      hasInvalidProfessorWebsite
                        ? 'border-destructive/80 text-destructive focus-visible:border-destructive/80 focus-visible:ring-destructive/20'
                        : 'border-[#d9d9d9]'
                    }`}
                  />
                  {hasInvalidProfessorWebsite && (
                    <p className="mt-2 text-xs text-destructive" role="alert" aria-live="polite">
                      Professor's website must start with http:// or https://
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-semibold text-[#575757]">Publications Link</Label>
                  <Input
                    value={publicationsLink}
                    onChange={(e) => setPublicationsLink(e.target.value)}
                    disabled={isSaving}
                    placeholder="https://scholar.google.com/citations?user=abc123"
                    aria-invalid={hasInvalidPublicationsLink}
                    className={`h-12 rounded-2xl bg-white px-4 text-[#111111] shadow-none ${
                      hasInvalidPublicationsLink
                        ? 'border-destructive/80 text-destructive focus-visible:border-destructive/80 focus-visible:ring-destructive/20'
                        : 'border-[#d9d9d9]'
                    }`}
                  />
                  {hasInvalidPublicationsLink && (
                    <p className="mt-2 text-xs text-destructive" role="alert" aria-live="polite">
                      Publications link must start with http:// or https://
                    </p>
                  )}
                </div>
                <div className="space-y-2 md:col-span-2">
                  <ResearchMetadataPicker
                    label="Research Interests"
                    value={researchInterests}
                    onChange={setResearchInterests}
                    disabled={isSaving}
                    allowCustom
                    placeholder="Search topics or add a concise tag"
                  />
                  {missingResearchInterests && <p className="mt-2 text-xs text-destructive">Add at least one research interest</p>}
                </div>
              </div>

              <div className="mt-7 flex items-center justify-end border-t border-[#ececec] pt-5">
                <Button onClick={handleCompleteSetup} disabled={isSaving} className="rounded-2xl bg-red-700 px-6 text-white hover:bg-red-800">
                  {isSaving ? 'Saving...' : 'Complete Setup'}
                </Button>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

function fileToBase64Image(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== 'string') {
        reject(new Error('Failed to read image file.'));
        return;
      }
      resolve(reader.result.replace(/^data:image\/[a-zA-Z+]+;base64,/, ''));
    };
    reader.onerror = () => {
      reject(new Error('Failed to read image file.'));
    };
    reader.readAsDataURL(file);
  });
}
