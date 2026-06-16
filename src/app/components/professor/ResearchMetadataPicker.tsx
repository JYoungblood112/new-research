import { useMemo, useState } from 'react';
import { Check, Plus, Search, X } from 'lucide-react';
import { lookupSubjectByQuery, RESEARCH_SUBJECT_GROUPS } from '../../lib/researchTaxonomy';

type ResearchMetadataPickerProps = {
  label: string;
  value: string[];
  onChange: (nextValue: string[]) => void;
  disabled?: boolean;
  placeholder?: string;
  allowCustom?: boolean;
  maxSuggestions?: number;
  options?: string[];
};

const CANONICAL_RESEARCH_AREAS = RESEARCH_SUBJECT_GROUPS.map((group) => group.title);
const CANONICAL_RESEARCH_INTERESTS = Array.from(
  new Set(RESEARCH_SUBJECT_GROUPS.flatMap((group) => [group.title, ...group.subjects]))
).sort((a, b) => a.localeCompare(b));

function normalizeTag(value: string) {
  return value.trim().replace(/\s+/g, ' ');
}

function uniqueTags(values: string[]) {
  const seen = new Set<string>();
  const next: string[] = [];

  for (const value of values) {
    const tag = normalizeTag(value);
    const key = tag.toLowerCase();
    if (!tag || seen.has(key)) continue;
    seen.add(key);
    next.push(tag);
  }

  return next;
}

export function normalizeResearchAreas(values: unknown): string[] {
  const input = Array.isArray(values)
    ? values
    : typeof values === 'string'
      ? values.split(/[,;|\n\r]+/)
      : [];
  const canonicalByKey = new Map(CANONICAL_RESEARCH_AREAS.map((area) => [area.toLowerCase(), area]));

  return uniqueTags(
    input
      .filter((entry): entry is string => typeof entry === 'string')
      .map((entry) => {
        const tag = normalizeTag(entry);
        const exact = canonicalByKey.get(tag.toLowerCase());
        if (exact) return exact;
        const lookup = lookupSubjectByQuery(tag);
        return lookup.source === 'generated' ? '' : lookup.subjectLabel;
      })
  );
}

export function normalizeResearchInterests(values: unknown): string[] {
  const input = Array.isArray(values)
    ? values
    : typeof values === 'string'
      ? values.split(/[,;|\n\r]+/)
      : [];

  return uniqueTags(input.filter((entry): entry is string => typeof entry === 'string')).slice(0, 24);
}

export default function ResearchMetadataPicker({
  label,
  value,
  onChange,
  disabled = false,
  placeholder = 'Search and add tags',
  allowCustom = false,
  maxSuggestions = 8,
  options: providedOptions,
}: ResearchMetadataPickerProps) {
  const [query, setQuery] = useState('');
  const normalizedValue = uniqueTags(value);
  const selectedKeys = new Set(normalizedValue.map((entry) => entry.toLowerCase()));
  const options = providedOptions ?? (allowCustom ? CANONICAL_RESEARCH_INTERESTS : CANONICAL_RESEARCH_AREAS);
  const trimmedQuery = normalizeTag(query);

  const suggestions = useMemo(() => {
    const normalizedQuery = trimmedQuery.toLowerCase();
    return options
      .filter((option) => !selectedKeys.has(option.toLowerCase()))
      .filter((option) => !normalizedQuery || option.toLowerCase().includes(normalizedQuery))
      .slice(0, maxSuggestions);
  }, [maxSuggestions, options, selectedKeys, trimmedQuery]);

  const canAddCustom =
    allowCustom &&
    trimmedQuery.length > 1 &&
    !selectedKeys.has(trimmedQuery.toLowerCase()) &&
    !options.some((option) => option.toLowerCase() === trimmedQuery.toLowerCase());

  const addTag = (tag: string) => {
    const normalized = normalizeTag(tag);
    if (!normalized) return;
    if (!allowCustom && !options.some((option) => option.toLowerCase() === normalized.toLowerCase())) return;
    onChange(uniqueTags([...normalizedValue, normalized]));
    setQuery('');
  };

  const removeTag = (tag: string) => {
    onChange(normalizedValue.filter((entry) => entry.toLowerCase() !== tag.toLowerCase()));
  };

  return (
    <div className="space-y-2">
      <label className="text-sm font-semibold text-[#575757]">{label}</label>
      <div className="rounded-2xl border border-[#d9d9d9] bg-white p-3 text-[#111111] shadow-none">
        <div className="flex flex-wrap gap-2">
          {normalizedValue.map((tag) => (
            <span
              key={tag}
              className="inline-flex max-w-full items-center gap-2 rounded-full border border-[#ead8ce] bg-[#fff8f5] px-3 py-1 text-sm text-[#8a4d3a]"
            >
              <span className="truncate">{tag}</span>
              <button
                type="button"
                onClick={() => removeTag(tag)}
                disabled={disabled}
                className="rounded-full text-[#8a4d3a] hover:text-red-800 disabled:cursor-not-allowed disabled:opacity-50"
                aria-label={`Remove ${tag}`}
              >
                <X className="size-3.5" />
              </button>
            </span>
          ))}
        </div>
        <div className="mt-3 flex h-10 items-center gap-2 rounded-xl border border-[#ececec] bg-[#fcfbfa] px-3">
          <Search className="size-4 shrink-0 text-[#8c8c8c]" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                addTag(suggestions[0] ?? trimmedQuery);
              }
            }}
            disabled={disabled}
            placeholder={placeholder}
            className="min-w-0 flex-1 border-0 bg-transparent text-sm outline-none placeholder:text-[#9a9a9a] disabled:cursor-not-allowed"
          />
        </div>
        {(suggestions.length > 0 || canAddCustom) && (
          <div className="mt-2 max-h-52 overflow-y-auto rounded-xl border border-[#ececec] bg-white p-1 shadow-sm">
            {suggestions.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                onClick={() => addTag(suggestion)}
                disabled={disabled}
                className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm text-[#333333] hover:bg-[#f8f6f4] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <span>{suggestion}</span>
                <Check className="size-4 text-red-700" />
              </button>
            ))}
            {canAddCustom && (
              <button
                type="button"
                onClick={() => addTag(trimmedQuery)}
                disabled={disabled}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-red-800 hover:bg-[#fff8f5] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Plus className="size-4" />
                <span>Add "{trimmedQuery}"</span>
              </button>
            )}
          </div>
        )}
        {normalizedValue.length === 0 ? (
          <p className="mt-2 text-xs text-[#7a7a7a]">
            {allowCustom ? 'Add concise current research topic tags.' : 'Choose one or more canonical research fields.'}
          </p>
        ) : null}
      </div>
    </div>
  );
}
