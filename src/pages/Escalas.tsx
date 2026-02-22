/**
 * Escalas — Listagem de cultos/escalas com data, equipe, ministro, DM, músicas.
 * dm/admin podem criar/editar/deletar.
 */
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { logAudit } from '@/services/logService';
import { Button } from '@/components/ui/button';
import { Plus, Pencil, Trash2, Loader2, CalendarDays } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Tooltip, TooltipContent, TooltipTrigger,
} from '@/components/ui/tooltip';
import { PERIODS } from '@/utils/constants';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const client = supabase as any;

interface ServiceRow {
  id: string;
  service_date: string;
  period: string;
  team_name: string;
  worship_leader_name: string;
  dm_name: string | null;
  notes: string | null;
  song_names: string[];
}

const Escalas = () => {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [rows, setRows] = useState<ServiceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<ServiceRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  const canWrite = profile?.role === 'admin' || profile?.role === 'dm';
  const canDelete = profile?.role === 'admin';

  const fetchData = useCallback(async () => {
    setLoading(true);

    const { data, error } = await client
      .from('services')
      .select('*, team:team_id(name), worship_leader:worship_leader_id(full_name), dm:dm_id(full_name), service_songs(song:song_id(name))')
      .order('service_date', { ascending: false });

    if (!error && data) {
      setRows((data as any[]).map((r) => ({
        id: r.id,
        service_date: r.service_date,
        period: r.period,
        team_name: r.team?.name || '—',
        worship_leader_name: r.worship_leader?.full_name || '—',
        dm_name: r.dm?.full_name || null,
        notes: r.notes,
        song_names: (r.service_songs || []).map((ss: any) => ss.song?.name).filter(Boolean),
      })));
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleDelete = async () => {
    if (!deleteTarget || !profile) return;
    setDeleting(true);

    try {
      // Delete service_songs first
      await client.from('service_songs').delete().eq('service_id', deleteTarget.id);

      const { error } = await client.from('services').delete().eq('id', deleteTarget.id);
      if (error) throw error;

      await logAudit({
        userId: profile.id,
        userName: profile.full_name,
        action: 'DELETE',
        entity: 'service',
        entityId: deleteTarget.id,
        description: `Escala de ${formatDate(deleteTarget.service_date)} deletada.`,
      });

      toast({ title: 'Escala deletada com sucesso.' });
      setDeleteTarget(null);
      fetchData();
    } catch (e: any) {
      toast({ title: e.message || 'Ocorreu um erro inesperado. Tente novamente.', variant: 'destructive' });
    } finally {
      setDeleting(false);
    }
  };

  const formatDate = (d: string) => {
    try {
      return format(parseISO(d), "dd/MM/yyyy (EEEE)", { locale: ptBR });
    } catch {
      return d;
    }
  };

  const periodLabel = (p: string) => PERIODS.find((o) => o.value === p)?.label || p;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Escalas</h1>
          <p className="text-sm text-muted-foreground">Histórico de cultos e escalas.</p>
        </div>
        {canWrite && (
          <Button onClick={() => navigate('/escalas/nova')}>
            <Plus className="mr-2 h-4 w-4" /> Nova Escala
          </Button>
        )}
      </div>

      <div className="rounded-lg border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data</TableHead>
              <TableHead>Período</TableHead>
              <TableHead>Equipe</TableHead>
              <TableHead>Ministro Guia</TableHead>
              <TableHead>DM</TableHead>
              <TableHead className="text-center">Músicas</TableHead>
              <TableHead>Observações</TableHead>
              {canWrite && <TableHead className="w-24">Ações</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={canWrite ? 8 : 7} className="text-center py-8 text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin inline mr-2" />Carregando...
                </TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={canWrite ? 8 : 7} className="text-center py-8 text-muted-foreground">
                  <CalendarDays className="h-8 w-8 mx-auto mb-2 opacity-40" />
                  Nenhuma escala encontrada.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow key={row.id} className="hover:bg-table-row-hover">
                  <TableCell className="font-medium whitespace-nowrap">{formatDate(row.service_date)}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{periodLabel(row.period)}</Badge>
                  </TableCell>
                  <TableCell>{row.team_name}</TableCell>
                  <TableCell>{row.worship_leader_name}</TableCell>
                  <TableCell>{row.dm_name || '—'}</TableCell>
                  <TableCell className="max-w-[250px]">
                    {row.song_names.length > 0 ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="block truncate cursor-default text-sm">
                            {row.song_names.join(', ')}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs">
                          <ul className="list-disc pl-4 space-y-0.5">
                            {row.song_names.map((name, i) => (
                              <li key={i}>{name}</li>
                            ))}
                          </ul>
                        </TooltipContent>
                      </Tooltip>
                    ) : '—'}
                  </TableCell>
                  <TableCell className="max-w-[200px]">
                    {row.notes ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="block truncate cursor-default">{row.notes}</span>
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs"><p>{row.notes}</p></TooltipContent>
                      </Tooltip>
                    ) : '—'}
                  </TableCell>
                  {canWrite && (
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => navigate(`/escalas/${row.id}/editar`)}
                          className="rounded p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                          title="Editar"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        {canDelete && (
                          <button
                            onClick={() => setDeleteTarget(row)}
                            className="rounded p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                            title="Deletar"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deletar Escala</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja deletar a escala de <strong>{deleteTarget ? formatDate(deleteTarget.service_date) : ''}</strong>? Todas as músicas vinculadas serão removidas. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? 'Deletando...' : 'Deletar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Escalas;
