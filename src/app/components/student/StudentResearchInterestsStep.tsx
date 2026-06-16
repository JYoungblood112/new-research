import { Sparkles, X } from 'lucide-react';
import { KeyboardEvent, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { lookupSubjectByQuery, RESEARCH_SUBJECT_GROUPS } from '../../lib/researchTaxonomy';
import { Button } from '../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { toast } from 'sonner';

type GeneratedSubject = {
  subject: string;
  subFields: string[];
};

type LiveCandidate = GeneratedSubject & {
  score: number;
};

function normalizeForMatch(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function scoreSubFieldMatch(subField: string, rawQuery: string) {
  const query = normalizeForMatch(rawQuery);
  if (!query) return 0;

  const subFieldNormalized = normalizeForMatch(subField);
  if (!subFieldNormalized) return 0;

  if (subFieldNormalized === query) return 100;
  if (subFieldNormalized.startsWith(query)) return 90;
  if (subFieldNormalized.includes(` ${query}`)) return 75;
  if (subFieldNormalized.includes(query)) return 60;

  const queryTokens = query.split(' ').filter(Boolean);
  const subTokens = subFieldNormalized.split(' ').filter(Boolean);
  let score = 0;

  for (const qToken of queryTokens) {
    for (const sToken of subTokens) {
      if (sToken === qToken) {
        score = Math.max(score, 70);
      } else if (sToken.startsWith(qToken) || qToken.startsWith(sToken)) {
        score = Math.max(score, 55);
      } else if (sToken.includes(qToken) || qToken.includes(sToken)) {
        score = Math.max(score, 45);
      }
    }
  }

  return score;
}

export default function StudentResearchInterestsStep({
  onBack,
  onContinue,
}: {
  onBack: () => void;
  onContinue: () => void;
}) {
  const { setupState, updateStudentProfile, refreshSession } = useAuth();
  const currentInterests = (setupState?.profile as { interests?: string[] } | null)?.interests ?? [];

  const [subjectInput, setSubjectInput] = useState('');
  const [generatedSubjects, setGeneratedSubjects] = useState<GeneratedSubject[]>([]);
  const [selectedInterests, setSelectedInterests] = useState<string[]>(currentInterests);
  const [isSaving, setIsSaving] = useState(false);
  const [visibleSavedSubjects, setVisibleSavedSubjects] = useState<Set<string>>(new Set());

  const selectedSet = useMemo(
    () => new Set(selectedInterests.map((interest) => interest.toLowerCase())),
    [selectedInterests]
  );
  const liveCandidates = useMemo(() => {
    const query = subjectInput.trim();
    if (!query) {
      return [] as LiveCandidate[];
    }

    const normalizedQuery = normalizeForMatch(query);
    const candidates: LiveCandidate[] = [];

    for (const group of RESEARCH_SUBJECT_GROUPS) {
      const subjectKey = group.title.trim().toLowerCase();
      if (visibleSavedSubjects.has(subjectKey)) {
        continue;
      }

      const titleScore = scoreSubFieldMatch(group.title, query);
      const subScore = group.subjects.reduce((best, subField) => {
        return Math.max(best, scoreSubFieldMatch(subField, query));
      }, 0);

      const score = Math.max(titleScore, subScore);
      if (score >= 55 || normalizeForMatch(group.title).includes(normalizedQuery)) {
        candidates.push({ subject: group.title, subFields: group.subjects, score });
      }
    }

    candidates.sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      return a.subject.localeCompare(b.subject);
    });

    return candidates.slice(0, 5);
  }, [subjectInput, visibleSavedSubjects]);

  const hasCloseSubjectMatch = liveCandidates.length > 0;
  const fallbackLookup = useMemo(() => lookupSubjectByQuery(subjectInput), [subjectInput]);

  const highlightedSubFields = useMemo(() => {
    if (!subjectInput.trim()) {
      return new Set<string>();
    }

    const next = new Set<string>();
    const sources = liveCandidates.length > 0
      ? liveCandidates
      : fallbackLookup.source !== 'generated'
        ? [{ subject: fallbackLookup.subjectLabel, subFields: fallbackLookup.subFields, score: 100 }]
        : [];

    for (const source of sources) {
      for (const subField of source.subFields) {
        if (scoreSubFieldMatch(subField, subjectInput) >= 55) {
          next.add(subField.toLowerCase());
        }
      }
    }

    return next;
  }, [fallbackLookup.source, fallbackLookup.subjectLabel, fallbackLookup.subFields, liveCandidates, subjectInput]);

  useEffect(() => {
    if (typeof window === 'undefined' || !('IntersectionObserver' in window)) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        setVisibleSavedSubjects((previous) => {
          const next = new Set(previous);
          let changed = false;

          for (const entry of entries) {
            const target = entry.target as HTMLElement;
            const subjectKey = target.dataset.savedSubjectKey;
            if (!subjectKey) {
              continue;
            }

            if (entry.isIntersecting) {
              if (!next.has(subjectKey)) {
                next.add(subjectKey);
                changed = true;
              }
            } else if (next.delete(subjectKey)) {
              changed = true;
            }
          }

          return changed ? next : previous;
        });
      },
      { threshold: 0.15 }
    );

    const nodes = document.querySelectorAll<HTMLElement>('[data-saved-subject-key]');
    nodes.forEach((node) => observer.observe(node));

    return () => {
      observer.disconnect();
    };
  }, [generatedSubjects]);

  const saveSubject = (subject: string, subFields: string[], clearInput = true) => {
    if (!subject || subFields.length === 0) {
      return;
    }

    setGeneratedSubjects((current) => {
      const nextSubject = subject.toLowerCase();
      const remaining = current.filter((entry) => entry.subject.toLowerCase() !== nextSubject);

      // Keep list ordered by most recently saved subject first.
      return [{ subject, subFields }, ...remaining];
    });
    if (clearInput) {
      setSubjectInput('');
    }
  };

  const addSubject = (value: string) => {
    const query = value.trim();
    if (!query) {
      return;
    }

    if (liveCandidates.length > 0) {
      const best = liveCandidates[0];
      saveSubject(best.subject, best.subFields);
      return;
    }

    const lookup = lookupSubjectByQuery(query);
    if (lookup.source === 'generated' || !lookup.subjectLabel || lookup.subFields.length === 0) {
      return;
    }

    saveSubject(lookup.subjectLabel, lookup.subFields);
  };

  const handleEnterSaveSubject = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key !== 'Enter') {
      return;
    }

    if (!subjectInput.trim()) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    addSubject(subjectInput);
  };

  const toggleInterest = (subField: string) => {
    const normalized = subField.toLowerCase();

    setSelectedInterests((current) => {
      const exists = current.some((interest) => interest.toLowerCase() === normalized);
      if (exists) {
        return current.filter((interest) => interest.toLowerCase() !== normalized);
      }
      return [...current, subField];
    });
  };

  const removeInterest = (interestToRemove: string) => {
    setSelectedInterests((current) =>
      current.filter((interest) => interest.toLowerCase() !== interestToRemove.toLowerCase())
    );
  };

  const removeSavedSubject = (subjectToRemove: string) => {
    const subjectKey = subjectToRemove.trim().toLowerCase();
    setGeneratedSubjects((current) =>
      current.filter((entry) => entry.subject.trim().toLowerCase() !== subjectKey)
    );
    setVisibleSavedSubjects((current) => {
      if (!current.has(subjectKey)) {
        return current;
      }
      const next = new Set(current);
      next.delete(subjectKey);
      return next;
    });
  };

  const handleContinue = async () => {
    if (selectedInterests.length < 1) {
      toast.error('Please choose at least 1 sub-genre to continue.');
      return;
    }

    setIsSaving(true);
    try {
      await updateStudentProfile({ interests: selectedInterests });
      await refreshSession();
      toast.success('Research interests saved.');
      onContinue();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save research interests');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card className="border-[#dfdfdf] bg-white shadow-sm">
      <CardHeader>
        <CardTitle className="text-2xl text-[#1f1f1f]">Research Interests</CardTitle>
        <CardDescription className="text-[#676767]">
          Type a broad subject and choose at least 1 sub-genre to continue.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2" onKeyDownCapture={handleEnterSaveSubject}>
          <Label htmlFor="subject-search" className="text-sm font-semibold text-[#555555]">
            Search Subject
          </Label>
          <div className="flex gap-2">
            <Input
              id="subject-search"
              value={subjectInput}
              onChange={(event) => setSubjectInput(event.target.value)}
              onKeyDown={handleEnterSaveSubject}
              placeholder="Type a subject, e.g. Business, Computer Science, Psychology"
              className="h-11 border-[#d6d6d6]"
            />
            <Button
              type="button"
              variant="outline"
              className="h-11 border-[#cccccc]"
              onClick={() => addSubject(subjectInput)}
              disabled={!hasCloseSubjectMatch}
            >
              <Sparkles className="size-4" />
              Search
            </Button>
          </div>
          <p className="text-xs text-[#7a7a7a]">
            Results stay blank until your query matches or closely resembles a known subject or sub-genre.
          </p>

          {hasCloseSubjectMatch ? (
            <div className="space-y-3">
              {liveCandidates.map((candidate) => (
                <section key={`live-${candidate.subject}`} className="rounded-xl border border-[#dfe5ea] bg-[#f8fbfc] p-4">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <h3 className="text-sm font-semibold text-[#4f6069]">
                      {candidate.subject}
                    </h3>
                    <Button
                      type="button"
                      variant="outline"
                      className="h-8 border-[#cfd6db] px-3 text-xs"
                      onClick={() => saveSubject(candidate.subject, candidate.subFields)}
                    >
                      Save Subject
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {candidate.subFields.map((subField) => {
                      const selected = selectedSet.has(subField.toLowerCase());
                      const highlighted = highlightedSubFields.has(subField.toLowerCase());
                      return (
                        <button
                          key={`live-${candidate.subject}-${subField}`}
                          type="button"
                          onClick={() => toggleInterest(subField)}
                          className={`chip-appear rounded-full border px-3 py-1.5 text-sm transition-colors ${
                            selected
                              ? 'border-[#7c8f9a] bg-[#dbe6ec] text-[#243640]'
                              : highlighted
                                ? 'border-red-600 bg-red-600 text-white'
                                : 'border-[#d6dbe0] bg-white text-[#4e5b62] hover:bg-[#f4f7f9]'
                          }`}
                        >
                          {subField}
                        </button>
                      );
                    })}
                  </div>
                </section>
              ))}
            </div>
          ) : null}
        </div>

        <div className="space-y-4">
          {generatedSubjects.map((group) => (
            <section
              key={group.subject}
              data-saved-subject-key={group.subject.trim().toLowerCase()}
              className="subject-appear rounded-xl border border-[#e5e5e5] p-4"
            >
              <div className="mb-3 flex items-center justify-between gap-3">
                <h3 className="text-sm font-semibold text-[#4f6069]">
                  {group.subject}
                </h3>
                <button
                  type="button"
                  className="rounded-full p-1 text-[#6b7a83] transition-colors hover:bg-[#eef3f6] hover:text-[#2f3d45]"
                  onClick={() => removeSavedSubject(group.subject)}
                  aria-label={`Remove saved subject ${group.subject}`}
                >
                  <X className="size-4" />
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {group.subFields.map((subField) => {
                  const selected = selectedSet.has(subField.toLowerCase());
                  const highlighted = highlightedSubFields.has(subField.toLowerCase());
                  return (
                    <button
                      key={subField}
                      type="button"
                      onClick={() => toggleInterest(subField)}
                      className={`chip-appear rounded-full border px-3 py-1.5 text-sm transition-colors ${
                        selected
                          ? 'border-[#7c8f9a] bg-[#dbe6ec] text-[#243640]'
                          : highlighted
                            ? 'border-red-600 bg-red-600 text-white'
                          : 'border-[#d6dbe0] bg-white text-[#4e5b62] hover:bg-[#f4f7f9]'
                      }`}
                    >
                      {subField}
                    </button>
                  );
                })}
              </div>
            </section>
          ))}
        </div>

        <div className="space-y-3 rounded-xl border border-[#e5e5e5] bg-[#fafcfd] p-4">
          <p className="text-sm font-semibold text-[#3d4e57]">
            Selected Interests ({selectedInterests.length})
          </p>
          {selectedInterests.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {selectedInterests.map((interest) => (
                <span
                  key={interest}
                  className="inline-flex items-center gap-2 rounded-full border border-[#9cafba] bg-[#e3edf2] px-3 py-1 text-sm text-[#2b3f4a]"
                >
                  {interest}
                  <button
                    type="button"
                    className="text-[#4f6874] transition-colors hover:text-[#20313a]"
                    onClick={() => removeInterest(interest)}
                    aria-label={`Remove ${interest}`}
                  >
                    <X className="size-3.5" />
                  </button>
                </span>
              ))}
            </div>
          ) : (
            <p className="text-sm text-[#7a7a7a]">No interests selected yet.</p>
          )}
        </div>

        <div className="flex items-center justify-between">
          <Button
            type="button"
            variant="outline"
            className="border-[#cccccc] text-[#4f4f4f] hover:bg-[#f7f7f7]"
            onClick={onBack}
          >
            Back to Profile Setup
          </Button>
          <Button
            type="button"
            className="bg-red-700 text-white hover:bg-red-800"
            disabled={selectedInterests.length < 1 || isSaving}
            onClick={handleContinue}
          >
            Continue
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
