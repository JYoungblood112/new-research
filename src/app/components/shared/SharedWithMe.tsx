import { useEffect, useState } from 'react';
import { Bookmark, ExternalLink, Inbox } from 'lucide-react';
import { useNavigate } from 'react-router';
import { useAuth } from '../../contexts/AuthContext';
import { listReceivedShares } from '../../lib/api';
import { listReceivedOpportunityShares } from '../../lib/researchPlatformQueries';
import { Button } from '../ui/button';
import { Card, CardContent } from '../ui/card';

type ShareRow = Record<string, any>;

export default function SharedWithMe() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [shares, setShares] = useState<ShareRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    setLoading(true);
    void listReceivedShares()
      .then((payload) => payload.shares as ShareRow[])
      .catch(() => listReceivedOpportunityShares(user.id) as Promise<ShareRow[]>)
      .then((rows) => {
        if (!cancelled) setShares(rows as ShareRow[]);
      })
      .catch(() => {
        if (!cancelled) setShares([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-[#111111]">Shared With Me</h1>
        <p className="mt-1 text-sm text-[#655f5a]">Opportunities sent by students and professors.</p>
      </div>

      {loading ? (
        <Card className="rounded-lg border-[#eee6e1] bg-white shadow-none">
          <CardContent className="py-10 text-center text-sm text-[#655f5a]">Loading shared opportunities...</CardContent>
        </Card>
      ) : shares.length === 0 ? (
        <Card className="rounded-lg border-[#eee6e1] bg-white shadow-none">
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <Inbox className="h-8 w-8 text-[#8f8782]" />
            <p className="font-medium text-[#111111]">No shared opportunities yet</p>
            <p className="text-sm text-[#655f5a]">Shares you receive will appear here with the sender note and quick actions.</p>
          </CardContent>
        </Card>
      ) : (
        shares.map((share) => {
          const project = share.projects ?? {};
          const professor = Array.isArray(project.professors) ? project.professors[0] : project.professors;
          const professorName = professor?.metadata?.full_name ?? professor?.metadata?.name ?? 'Faculty mentor';
          return (
            <Card key={share.id} className="rounded-lg border-[#eee6e1] bg-white shadow-none">
              <CardContent className="space-y-3 p-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-red-700">Shared opportunity</p>
                  <h2 className="mt-1 text-lg font-semibold text-[#111111]">{project.title ?? 'Research Opportunity'}</h2>
                  <p className="text-sm text-[#655f5a]">{professorName} • {professor?.department ?? 'Research'}</p>
                </div>
                {share.message ? <p className="rounded-lg border border-[#f0e8e4] bg-[#fffaf7] p-3 text-sm leading-6 text-[#4f4742]">{share.message}</p> : null}
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" className="rounded-md bg-[#c92e1f] text-white hover:bg-[#b3271b]" onClick={() => navigate(`/student/research/${share.opportunity_id}`)}>
                    View Opportunity <ExternalLink className="ml-2 h-4 w-4" />
                  </Button>
                  <Button size="sm" variant="outline" className="rounded-md">
                    <Bookmark className="mr-2 h-4 w-4" />
                    Save
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })
      )}
    </div>
  );
}
