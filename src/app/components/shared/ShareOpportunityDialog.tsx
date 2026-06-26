import { useEffect, useMemo, useState } from 'react';
import { Send, Share2, X } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../../contexts/AuthContext';
import type { ResearchPosting } from '../../contexts/DataContext';
import { searchShareRecipients, shareOpportunity, type ShareRecipient } from '../../lib/api';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../ui/dialog';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Textarea } from '../ui/textarea';

type RecipientRoleFilter = 'all' | 'student' | 'professor';

export default function ShareOpportunityDialog({
  posting,
  open,
  onOpenChange,
}: {
  posting: ResearchPosting | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { user } = useAuth();
  const [query, setQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<RecipientRoleFilter>('all');
  const [recipients, setRecipients] = useState<ShareRecipient[]>([]);
  const [selected, setSelected] = useState<ShareRecipient[]>([]);
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    if (!open) {
      setQuery('');
      setRoleFilter('all');
      setRecipients([]);
      setSelected([]);
      setMessage('');
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const timeout = window.setTimeout(() => {
      void searchShareRecipients({ query, role: roleFilter })
        .then((payload) => {
          if (!cancelled) {
            setRecipients(payload.recipients.filter((recipient) => recipient.id !== user?.id));
          }
        })
        .catch(() => {
          if (!cancelled) setRecipients([]);
        });
    }, 180);

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [open, query, roleFilter, user?.id]);

  const selectedIds = useMemo(() => new Set(selected.map((recipient) => recipient.id)), [selected]);

  const handleSend = async () => {
    if (!posting || selected.length === 0) {
      toast.error('Select at least one recipient.');
      return;
    }

    setIsSending(true);
    try {
      await shareOpportunity({
        opportunityId: posting.id,
        recipientIds: selected.map((recipient) => recipient.id),
        message,
      });
      toast.success('Opportunity shared.');
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to share opportunity.');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="h-5 w-5 text-red-700" />
            Share Opportunity
          </DialogTitle>
          <DialogDescription>
            {posting ? `${posting.title} by ${posting.professorName}` : 'Send a research opportunity to another portal user.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-[1fr_180px]">
            <div className="space-y-1.5">
              <Label>Recipient Search</Label>
              <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by name or email" />
            </div>
            <div className="space-y-1.5">
              <Label>Role</Label>
              <Select value={roleFilter} onValueChange={(value) => setRoleFilter(value as RecipientRoleFilter)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Students and Professors</SelectItem>
                  <SelectItem value="student">Students</SelectItem>
                  <SelectItem value="professor">Professors</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {selected.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {selected.map((recipient) => (
                <Badge key={recipient.id} variant="outline" className="gap-1 rounded-full px-2.5 py-1">
                  {recipient.name} ({recipient.role})
                  <button type="button" onClick={() => setSelected((current) => current.filter((entry) => entry.id !== recipient.id))} aria-label={`Remove ${recipient.name}`}>
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          ) : null}

          <div className="max-h-52 overflow-y-auto rounded-lg border border-[#e7e0dc]">
            {recipients.length === 0 ? (
              <p className="p-4 text-sm text-[#6f6863]">No matching recipients found.</p>
            ) : (
              recipients.map((recipient) => (
                <button
                  key={recipient.id}
                  type="button"
                  className="flex w-full items-center justify-between gap-3 border-t border-[#f0ece8] px-4 py-3 text-left first:border-t-0 hover:bg-[#fbf7f4]"
                  onClick={() => {
                    if (selectedIds.has(recipient.id)) return;
                    setSelected((current) => [...current, recipient]);
                  }}
                >
                  <span>
                    <span className="block text-sm font-medium text-[#211d1a]">{recipient.name}</span>
                    <span className="block text-xs text-[#6f6863]">{recipient.email}</span>
                  </span>
                  <Badge variant="secondary" className="rounded-full">{recipient.role}</Badge>
                </button>
              ))
            )}
          </div>

          <div className="space-y-1.5">
            <Label>Optional Message</Label>
            <Textarea value={message} onChange={(event) => setMessage(event.target.value)} rows={4} placeholder="Add context for the recipient" />
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={handleSend} disabled={isSending || selected.length === 0}>
              <Send className="mr-2 h-4 w-4" />
              {isSending ? 'Sending...' : 'Send'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
