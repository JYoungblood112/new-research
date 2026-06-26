import { useMemo, useState } from 'react';
import { ExternalLink, Search, Share2 } from 'lucide-react';
import type { ResearchPosting } from '../../contexts/DataContext';
import { useData } from '../../contexts/DataContext';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Card, CardContent } from '../ui/card';
import { Input } from '../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import ShareOpportunityDialog from './ShareOpportunityDialog';

type ProfessorResult = {
  id: string;
  name: string;
  title: string;
  department: string;
  lab: string;
  bioUrl?: string;
  researchAreas: string[];
  researchInterests: string[];
  openPostings: ResearchPosting[];
  summary: string;
};

function includesAny(text: string, terms: string[]) {
  const normalized = text.toLowerCase();
  return terms.some((term) => normalized.includes(term.toLowerCase()));
}

export default function ProfessorSearch() {
  const { postings } = useData();
  const [query, setQuery] = useState('');
  const [department, setDepartment] = useState('All');
  const [researchArea, setResearchArea] = useState('All');
  const [hasOpen, setHasOpen] = useState('all');
  const [compensation, setCompensation] = useState('All');
  const [modality, setModality] = useState('All');
  const [sharePosting, setSharePosting] = useState<ResearchPosting | null>(null);

  const professors = useMemo(() => {
    const map = new Map<string, ProfessorResult>();
    postings.forEach((posting) => {
      const key = posting.professorId || posting.professorEmail || posting.professorName;
      const existing = map.get(key);
      const researchAreas = Array.from(new Set([...(existing?.researchAreas ?? []), ...posting.researchAreas, ...(posting.professorResearchAreas ?? [])]));
      const researchInterests = Array.from(new Set([...(existing?.researchInterests ?? []), ...(posting.professorResearchInterests ?? [])]));
      const openPostings = [...(existing?.openPostings ?? []), ...(posting.status === 'published' ? [posting] : [])];
      map.set(key, {
        id: key,
        name: posting.professorName,
        title: existing?.title ?? 'Faculty Mentor',
        department: posting.professorDepartment,
        lab: existing?.lab ?? `${posting.professorDepartment} Research Lab`,
        bioUrl: posting.professorBioUrl,
        researchAreas,
        researchInterests,
        openPostings,
        summary: existing?.summary ?? posting.overview,
      });
    });
    return Array.from(map.values()).sort((left, right) => left.name.localeCompare(right.name));
  }, [postings]);

  const departments = ['All', ...Array.from(new Set(professors.map((professor) => professor.department).filter(Boolean))).sort()];
  const areas = ['All', ...Array.from(new Set(professors.flatMap((professor) => [...professor.researchAreas, ...professor.researchInterests]).filter(Boolean))).sort()];

  const results = professors.filter((professor) => {
    const terms = query.trim().split(/\s+/).filter(Boolean);
    const searchable = [
      professor.name,
      professor.department,
      professor.lab,
      professor.title,
      professor.summary,
      professor.researchAreas.join(' '),
      professor.researchInterests.join(' '),
      professor.openPostings.map((posting) => `${posting.title} ${posting.skillsNeeded.join(' ')} ${posting.compensation} ${posting.timeCommitmentExpected}`).join(' '),
    ].join(' ');
    const matchesQuery = terms.length === 0 || includesAny(searchable, terms);
    const matchesDepartment = department === 'All' || professor.department === department;
    const matchesArea = researchArea === 'All' || professor.researchAreas.includes(researchArea) || professor.researchInterests.includes(researchArea);
    const matchesOpen = hasOpen === 'all' || professor.openPostings.length > 0;
    const matchesCompensation = compensation === 'All' || professor.openPostings.some((posting) => posting.compensation === compensation);
    const matchesModality = modality === 'All' || professor.openPostings.some((posting) => posting.timeCommitmentExpected.toLowerCase().includes(modality.toLowerCase()));
    return matchesQuery && matchesDepartment && matchesArea && matchesOpen && matchesCompensation && matchesModality;
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-[#111111]">Professor Search</h1>
        <p className="mt-1 text-sm text-[#655f5a]">{results.length} professors visible</p>
      </div>

      <div className="rounded-lg bg-white/75 p-3">
        <div className="grid gap-3 lg:grid-cols-[1fr_repeat(5,180px)]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#777777]" />
            <Input className="pl-10" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Name, lab, area, skill, project" />
          </div>
          <Select value={hasOpen} onValueChange={setHasOpen}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Any availability</SelectItem>
              <SelectItem value="open">Has open opportunities</SelectItem>
            </SelectContent>
          </Select>
          <Select value={department} onValueChange={setDepartment}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{departments.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={researchArea} onValueChange={setResearchArea}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{areas.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={compensation} onValueChange={setCompensation}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {['All', 'stipend', 'course credit', 'volunteer', 'tbd'].map((item) => <SelectItem key={item} value={item}>{item === 'All' ? 'Any pay' : item}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={modality} onValueChange={setModality}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {['All', 'remote', 'in-person', 'hybrid'].map((item) => <SelectItem key={item} value={item}>{item === 'All' ? 'Any modality' : item}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-3">
        {results.map((professor) => (
          <Card key={professor.id} className="rounded-lg border-[#eee6e1] bg-white shadow-none">
            <CardContent className="space-y-3 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-[#111111]">{professor.name}</h2>
                  <p className="text-sm text-[#655f5a]">{professor.title} • {professor.department} • {professor.lab}</p>
                </div>
                <Badge className="rounded-full border border-red-700/15 bg-red-700/[0.08] px-2.5 py-1 text-xs text-red-800">
                  {professor.openPostings.length} open opportunities
                </Badge>
              </div>
              <p className="line-clamp-2 text-sm leading-6 text-[#444444]">{professor.summary}</p>
              <div className="flex flex-wrap gap-2">
                {[...professor.researchAreas, ...professor.researchInterests].slice(0, 8).map((area) => (
                  <Badge key={`${professor.id}-${area}`} variant="secondary" className="rounded-full">{area}</Badge>
                ))}
              </div>
              <div className="flex flex-wrap gap-2">
                {professor.bioUrl ? (
                  <Button asChild variant="outline" size="sm" className="rounded-md">
                    <a href={professor.bioUrl} target="_blank" rel="noreferrer">
                      View Profile <ExternalLink className="ml-2 h-4 w-4" />
                    </a>
                  </Button>
                ) : null}
                {professor.openPostings.slice(0, 2).map((posting) => (
                  <Button key={posting.id} variant="outline" size="sm" className="rounded-md" onClick={() => setSharePosting(posting)}>
                    <Share2 className="mr-2 h-4 w-4" />
                    Share {posting.title}
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <ShareOpportunityDialog posting={sharePosting} open={Boolean(sharePosting)} onOpenChange={(open) => !open && setSharePosting(null)} />
    </div>
  );
}
