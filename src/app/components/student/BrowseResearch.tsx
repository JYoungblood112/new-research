import { useState } from 'react';
import { useData } from '../../contexts/DataContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Input } from '../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Search, Calendar, Clock, BadgeDollarSign, SlidersHorizontal, ArrowUpDown, ExternalLink } from 'lucide-react';
import ApplyToResearchDialog from './ApplyToResearchDialog';
import { useNavigate } from 'react-router';
import { RESEARCH_POSTING_CATEGORY_OPTIONS } from '../../lib/researchTaxonomy';

const CATEGORIES = ['All', ...RESEARCH_POSTING_CATEGORY_OPTIONS] as const;

const COMPENSATION_OPTIONS = ['All', 'course credit', 'stipend', 'tbd', 'volunteer'] as const;
const COMPENSATION_LABELS: Record<(typeof COMPENSATION_OPTIONS)[number], string> = {
  All: 'All Compensation Types',
  'course credit': 'Course Credit',
  stipend: 'Stipend',
  tbd: 'To Be Determined',
  volunteer: 'Volunteer',
};
const SORT_FIELDS = [
  { value: 'applicationDeadline', label: 'Application deadline' },
  { value: 'createdAt', label: 'Date posted' },
] as const;

const SORT_ORDERS = [
  { value: 'desc', label: 'Newest / Latest first' },
  { value: 'asc', label: 'Oldest / Soonest first' },
] as const;

function formatBrowseEndDate(duration: string, startDate: string) {
  const parsedDurationDate = new Date(duration);
  if (!Number.isNaN(parsedDurationDate.getTime())) {
    return parsedDurationDate.toLocaleDateString();
  }

  const parsedStartDate = new Date(startDate);
  if (Number.isNaN(parsedStartDate.getTime())) {
    return duration;
  }

  const normalized = duration.toLowerCase();
  const monthMatch = normalized.match(/(\d+)\s*month/);
  const weekMatch = normalized.match(/(\d+)\s*week/);
  let monthsToAdd = 0;

  if (monthMatch) {
    monthsToAdd = Number.parseInt(monthMatch[1], 10);
  } else if (/2\s*semester/.test(normalized)) {
    monthsToAdd = 8;
  } else if (/1\s*semester/.test(normalized) || /\bsemester\b/.test(normalized)) {
    monthsToAdd = 4;
  } else if (/academic\s*year|\b1\s*year\b|12\s*month/.test(normalized)) {
    monthsToAdd = 12;
  } else if (/\b2\s*year\b|24\s*month/.test(normalized)) {
    monthsToAdd = 24;
  }

  const estimatedEndDate = new Date(parsedStartDate);
  if (monthsToAdd > 0) {
    estimatedEndDate.setMonth(estimatedEndDate.getMonth() + monthsToAdd);
    return estimatedEndDate.toLocaleDateString();
  }

  if (weekMatch) {
    const weeksToAdd = Number.parseInt(weekMatch[1], 10);
    estimatedEndDate.setDate(estimatedEndDate.getDate() + weeksToAdd * 7);
    return estimatedEndDate.toLocaleDateString();
  }

  return parsedStartDate.toLocaleDateString();
}

export default function BrowseResearch() {
  const { postings, projectsLoading, projectsError, refreshProjects } = useData();
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedCompensation, setSelectedCompensation] = useState<(typeof COMPENSATION_OPTIONS)[number]>('All');
  const [sortField, setSortField] = useState<(typeof SORT_FIELDS)[number]['value']>('createdAt');
  const [sortOrder, setSortOrder] = useState<(typeof SORT_ORDERS)[number]['value']>('desc');
  const [selectedPosting, setSelectedPosting] = useState<string | null>(null);

  const orderOptions =
    sortField === 'applicationDeadline'
      ? [
          { value: 'asc' as const, label: 'Soonest first' },
          { value: 'desc' as const, label: 'Furthest away' },
        ]
      : [
          { value: 'desc' as const, label: 'Newest first' },
          { value: 'asc' as const, label: 'Oldest first' },
        ];

  const filteredPostings = postings
    .filter((p) => p.status === 'published')
    .filter((p) => {
      const matchesSearch =
        p.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.overview.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.studentRoleDescription.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.researchAreas.some((area) => area.toLowerCase().includes(searchTerm.toLowerCase())) ||
        p.skillsNeeded.some((skill) => skill.toLowerCase().includes(searchTerm.toLowerCase()));
      const matchesCategory = selectedCategory === 'All' || p.category === selectedCategory;
      const matchesCompensation = selectedCompensation === 'All' || p.compensation === selectedCompensation;
      return matchesSearch && matchesCategory && matchesCompensation;
    });

  const sortedPostings = [...filteredPostings].sort((a, b) => {
    const left = new Date(a[sortField]).getTime();
    const right = new Date(b[sortField]).getTime();
    return sortOrder === 'asc' ? left - right : right - left;
  });

  return (
    <div className="space-y-6">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <Input
          placeholder="Search research opportunities..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <div className="rounded-2xl border border-[#dedede] bg-white p-4">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-[#575757]">
            <SlidersHorizontal className="h-4 w-4 text-red-700" />
            Filters
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1">
              <p className="text-xs font-medium uppercase tracking-[0.15em] text-[#8f8f8f]">Category</p>
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger>
                  <SelectValue placeholder="All categories" />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <p className="text-xs font-medium uppercase tracking-[0.15em] text-[#8f8f8f]">Compensation</p>
              <Select
                value={selectedCompensation}
                onValueChange={(value) =>
                  setSelectedCompensation(value as (typeof COMPENSATION_OPTIONS)[number])
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="All compensation types" />
                </SelectTrigger>
                <SelectContent>
                  {COMPENSATION_OPTIONS.map((option) => (
                    <SelectItem key={option} value={option}>
                      {COMPENSATION_LABELS[option]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-[#dedede] bg-white p-4">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-[#575757]">
            <ArrowUpDown className="h-4 w-4 text-red-700" />
            Sort
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1">
              <p className="text-xs font-medium uppercase tracking-[0.15em] text-[#8f8f8f]">Sort by</p>
              <Select
                value={sortField}
                onValueChange={(value) => {
                  const nextSortField = value as (typeof SORT_FIELDS)[number]['value'];
                  setSortField(nextSortField);

                  // Use intuitive defaults per field.
                  if (nextSortField === 'applicationDeadline') {
                    setSortOrder('asc');
                  } else {
                    setSortOrder('desc');
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select field" />
                </SelectTrigger>
                <SelectContent>
                  {SORT_FIELDS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <p className="text-xs font-medium uppercase tracking-[0.15em] text-[#8f8f8f]">Order</p>
              <Select
                value={sortOrder}
                onValueChange={(value) => setSortOrder(value as (typeof SORT_ORDERS)[number]['value'])}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select order" />
                </SelectTrigger>
                <SelectContent>
                  {orderOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {projectsLoading ? (
          <Card>
            <CardContent className="space-y-3 py-12">
              <div className="mx-auto h-4 w-48 animate-pulse rounded bg-[#efefef]" />
              <div className="mx-auto h-4 w-72 max-w-full animate-pulse rounded bg-[#f4f4f4]" />
            </CardContent>
          </Card>
        ) : projectsError ? (
          <Card>
            <CardContent className="space-y-4 py-12 text-center">
              <div>
                <p className="font-medium text-[#111111]">Unable to load research opportunities</p>
                <p className="mt-1 text-sm text-gray-500">{projectsError}</p>
              </div>
              <Button variant="outline" onClick={() => void refreshProjects()}>
                Try again
              </Button>
            </CardContent>
          </Card>
        ) : sortedPostings.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-gray-500">No research opportunities found</p>
            </CardContent>
          </Card>
        ) : (
          sortedPostings.map((posting) => (
            <Card key={posting.id} className="border-[#d0ceca] transition-shadow hover:shadow-md">
              <CardHeader>
                {/** Show bio link only when a non-empty URL exists. */}
                {(() => {
                  const professorBioUrl = posting.professorBioUrl?.trim() ?? '';
                  return (
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <CardTitle>{posting.title}</CardTitle>
                    <CardDescription>
                      {posting.professorName} • {posting.professorDepartment}
                    </CardDescription>
                    {professorBioUrl ? (
                      <a
                        href={professorBioUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-xs font-medium text-red-700 hover:text-red-800"
                      >
                        Professor bio
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    ) : null}
                  </div>
                  <Badge className="rounded-full border border-red-700/20 bg-red-700/[0.08] text-red-800">
                    {posting.category}
                  </Badge>
                </div>
                  );
                })()}
              </CardHeader>

              <CardContent className="space-y-4">
                <p className="text-sm">{posting.overview}</p>
                {posting.researchAreas.length > 0 || posting.skillsNeeded.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {posting.researchAreas.slice(0, 4).map((area) => (
                      <Badge key={`area-${area}`} variant="secondary" className="rounded-full">
                        {area}
                      </Badge>
                    ))}
                    {posting.skillsNeeded.slice(0, 4).map((skill) => (
                      <Badge key={`skill-${skill}`} className="rounded-full border border-[#d8d8d8] bg-white text-[#4f4a46] hover:bg-white">
                        {skill}
                      </Badge>
                    ))}
                  </div>
                ) : null}

                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2 text-gray-600">
                    <Calendar className="h-4 w-4" />
                    Date posted: {new Date(posting.createdAt).toLocaleDateString()}
                  </div>
                  <div className="flex items-center gap-4 text-gray-600">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      End date: {formatBrowseEndDate(posting.duration, posting.startDate)}
                    </div>
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      Apply by {new Date(posting.applicationDeadline).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-gray-600">
                    <BadgeDollarSign className="h-4 w-4" />
                    Compensation: {COMPENSATION_LABELS[posting.compensation]}
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2">
                  <Button
                    variant="outline"
                    className="rounded-md px-3 py-1.5 text-sm transition-all duration-150 active:translate-y-0.5 active:bg-muted focus-visible:ring-2 focus-visible:ring-red-700/20"
                    onClick={() => navigate(`/student/research/${posting.id}`)}
                  >
                    View Details
                  </Button>
                  <Button
                    className="rounded-md bg-[#c92e1f] px-3 py-1.5 text-sm font-medium text-white shadow-sm transition-all duration-150 hover:-translate-y-0.5 hover:bg-[#b3271b] active:translate-y-0.5 active:bg-[#a92318] focus-visible:ring-2 focus-visible:ring-red-700/25"
                    onClick={() => setSelectedPosting(posting.id)}
                  >
                    Apply →
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {selectedPosting && (
        <ApplyToResearchDialog
          postingId={selectedPosting}
          open={!!selectedPosting}
          onOpenChange={(open) => !open && setSelectedPosting(null)}
        />
      )}
    </div>
  );
}
