import { useEffect, useMemo, useState } from 'react';
import { Activity, Eye } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { heartbeatOpportunityPresence } from '../../lib/api';
import { Badge } from '../ui/badge';

function getAnonymousSessionId() {
  const key = 'research_portal_anon_session_id';
  const existing = window.sessionStorage.getItem(key);
  if (existing) return existing;
  const next = crypto.randomUUID();
  window.sessionStorage.setItem(key, next);
  return next;
}

export default function OpportunityPresence({ opportunityId }: { opportunityId: string }) {
  const { user } = useAuth();
  const [metrics, setMetrics] = useState<{ currentViewers: number; studentViewers: number; uniqueViews7d: number; totalViews: number } | null>(null);
  const viewerKey = useMemo(() => user?.id ?? getAnonymousSessionId(), [user?.id]);

  useEffect(() => {
    let cancelled = false;
    let intervalId: number | null = null;

    const sendHeartbeat = async () => {
      if (document.visibilityState !== 'visible') return;
      try {
        const payload = await heartbeatOpportunityPresence({ opportunityId, viewerKey, role: user?.role });
        if (!cancelled) setMetrics(payload);
      } catch {
        if (!cancelled) setMetrics(null);
      }
    };

    void sendHeartbeat();
    intervalId = window.setInterval(sendHeartbeat, 25_000);
    document.addEventListener('visibilitychange', sendHeartbeat);

    return () => {
      cancelled = true;
      if (intervalId) window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', sendHeartbeat);
    };
  }, [opportunityId, viewerKey, user?.role]);

  if (!metrics) return null;

  const showCurrent = metrics.currentViewers >= 3;
  return (
    <div className="flex flex-wrap items-center gap-2">
      {showCurrent ? (
        <Badge variant="outline" className="rounded-full border-emerald-200 bg-emerald-50 px-3 py-1 text-emerald-800">
          <Activity className="mr-1.5 h-3.5 w-3.5" />
          {metrics.studentViewers >= 3 ? `${metrics.studentViewers} students currently viewing` : `${metrics.currentViewers} people are viewing now`}
        </Badge>
      ) : null}
      {metrics.uniqueViews7d >= 10 ? (
        <Badge variant="outline" className="rounded-full border-[#e4d8d3] bg-white px-3 py-1 text-[#5f5752]">
          <Eye className="mr-1.5 h-3.5 w-3.5" />
          Popular this week • {metrics.uniqueViews7d} unique views
        </Badge>
      ) : (
        <Badge variant="outline" className="rounded-full border-[#e4d8d3] bg-white px-3 py-1 text-[#5f5752]">
          <Eye className="mr-1.5 h-3.5 w-3.5" />
          {metrics.uniqueViews7d} unique views in the last 7 days
        </Badge>
      )}
    </div>
  );
}
