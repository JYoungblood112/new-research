import { useState } from 'react';
import { useData } from '../../contexts/DataContext';
import { useAuth } from '../../contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Input } from '../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Search, Calendar, Clock, BadgeDollarSign } from 'lucide-react';
import ApplyToResearchDialog from './ApplyToResearchDialog';
import { useNavigate } from 'react-router';

const CATEGORIES = [
  'All',
  'Machine Learning',
  'Human-Computer Interaction',
  'Robotics',
  'Computer Systems',
  'Cybersecurity',
  'Software Engineering',
  'Natural Language Processing',
  'Computer Vision',
  'Computational Biology',
  'Other',
];

export default function BrowseResearch() {
  const { setupState } = useAuth();
  const { postings } = useData();
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedPosting, setSelectedPosting] = useState<string | null>(null);

  const filteredPostings = postings
    .filter((p) => p.status === 'published')
    .filter((p) => {
      const matchesSearch =
        p.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.overview.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.studentRoleDescription.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = selectedCategory === 'All' || p.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });

  return (
    <div className="space-y-6">
      <div className="flex gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Search research opportunities..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={selectedCategory} onValueChange={setSelectedCategory}>
          <SelectTrigger className="w-64">
            <SelectValue />
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

      <div className="space-y-4">
        {filteredPostings.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-gray-500">No research opportunities found</p>
            </CardContent>
          </Card>
        ) : (
          filteredPostings.map((posting) => (
            <Card key={posting.id} className="border-[#d0ceca] transition-shadow hover:shadow-md">
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div className="space-y-1">
                    <CardTitle>{posting.title}</CardTitle>
                    <CardDescription>
                      {posting.professorName} • {posting.professorDepartment}
                    </CardDescription>
                  </div>
                  <Badge className="rounded-full border border-red-700/20 bg-red-700/[0.08] text-red-800">
                    {posting.category}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm">{posting.overview}</p>

                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-4 text-gray-600">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4" />
                      {posting.duration}
                    </div>
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4" />
                      Apply by {new Date(posting.applicationDeadline).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-gray-600">
                    <BadgeDollarSign className="w-4 h-4" />
                    Compensation: {posting.compensation}
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
