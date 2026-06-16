import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../../contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Button } from '../../components/ui/button';
import { ArrowLeft, Camera } from 'lucide-react';
import { toast } from 'sonner';
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

export default function ProfessorProfilePage() {
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
  const [photoBase64, setPhotoBase64] = useState(profile.photoBase64 ?? '');
  const [isSaving, setIsSaving] = useState(false);
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

  const handleSave = async () => {
    setShowValidationErrors(true);

    if (!trimmedDisplayName || !trimmedDepartment || !trimmedTitle || !trimmedContactEmail) {
      toast.error('Please complete all required fields before saving.');
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
        photoBase64: photoBase64 || undefined,
      });
      setShowValidationErrors(false);
      toast.success('Profile updated successfully!');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update profile');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#eeecea]">
      <main className="mx-auto max-w-5xl px-4 py-8">
        <Button
          variant="outline"
          className="mb-4 rounded-xl border-[#d0ceca] bg-white"
          onClick={() => navigate('/professor/dashboard')}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Dashboard
        </Button>

        <section className="overflow-hidden rounded-[28px] border border-[#d9d9d9] bg-white text-[#111111] shadow-[0_18px_36px_rgba(15,15,15,0.06)]">
          <div className="relative h-28 bg-[linear-gradient(120deg,#faf1ef_0%,#f7f4f1_55%,#f2f2f0_100%)]">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,#ffffff90,transparent_58%)]" />
            <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-b from-transparent to-white" />
          </div>

          <div className="relative -mt-10 px-6 pb-6">
            <div className="mx-auto max-w-4xl">
              <div className="flex flex-col items-center gap-5 border-b border-[#ececec] pb-7 md:flex-row md:items-end md:gap-6 md:pb-6">
                <div data-interactive="true" className="group relative flex cursor-pointer" onClick={() => document.getElementById('professor-profile-photo-upload')?.click()}>
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
                    <h2 className="text-3xl font-semibold tracking-tight text-[#111111]">Edit your profile</h2>
                    <p className="mt-2 max-w-2xl text-sm text-[#6f6f6f]">
                      Keep your profile up to date so students can easily evaluate your research opportunities.
                    </p>
                  </div>
                </div>

                <div className="rounded-full border border-[#e5e5e5] bg-[#fafafa] px-4 py-2 text-xs font-medium text-red-700">
                  Bio link optional
                </div>
              </div>

              <input
                id="professor-profile-photo-upload"
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
                </div>
              </div>

              <div className="mt-7 flex items-center justify-end border-t border-[#ececec] pt-5">
                <Button onClick={handleSave} disabled={isSaving} className="rounded-2xl bg-red-700 px-6 text-white hover:bg-red-800">
                  {isSaving ? 'Saving...' : 'Save Changes'}
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
