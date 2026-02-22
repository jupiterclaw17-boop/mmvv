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
import { Plus, Pencil, Trash2, Loader2, CalendarDays, Eye, Music, Download, Filter } from 'lucide-react';
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
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Tooltip, TooltipContent, TooltipTrigger,
} from '@/components/ui/tooltip';
import { PERIODS } from '@/utils/constants';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const client = supabase as any;

interface SongInfo {
  song_id: string;
  name: string;
  key: string;
}

interface MultitrackInfo {
  song_id: string;
  storage_url: string | null;
}

interface ServiceRow {
  id: string;
  service_date: string;
  period: string;
  team_name: string;
  worship_leader_name: string;
  dm_name: string | null;
  notes: string | null;
  songs: SongInfo[];
}

const Escalas = () => {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [rows, setRows] = useState<ServiceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<ServiceRow | null>(null);
  const [viewTarget, setViewTarget] = useState<ServiceRow | null>(null);
  const [viewMultitracks, setViewMultitracks] = useState<MultitrackInfo[]>([]);
  const [allMultitracks, setAllMultitracks] = useState<MultitrackInfo[]>([]);
  const [deleting, setDeleting] = useState(false);
  const [filterMonth, setFilterMonth] = useState<string>('');

  const canWrite = profile?.role === 'admin' || profile?.role === 'dm';
  const canDelete = profile?.role === 'admin';

  const fetchData = useCallback(async () => {
    setLoading(true);

    const { data, error } = await client
      .from('services')
      .select('*, team:team_id(name), worship_leader:worship_leader_id(full_name), dm:dm_id(full_name), service_songs(song_id, song_key, song:song_id(name))')
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
        songs: (r.service_songs || [])
          .filter((ss: any) => ss.song?.name)
          .map((ss: any) => ({ song_id: ss.song_id || ss.song?.id, name: ss.song.name, key: ss.song_key })),
      })));
      // Fetch all multitracks that have storage_url
      const allSongIds = (data as any[]).flatMap((r) =>
        (r.service_songs || []).filter((ss: any) => ss.song_id).map((ss: any) => ss.song_id)
      );
      const uniqueSongIds = [...new Set(allSongIds)];
      if (uniqueSongIds.length > 0) {
        const { data: mtData } = await client
          .from('multitracks')
          .select('song_id, storage_url')
          .in('song_id', uniqueSongIds)
          .not('storage_url', 'is', null);
        if (mtData) setAllMultitracks(mtData as MultitrackInfo[]);
      }
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const openView = async (row: ServiceRow) => {
    setViewTarget(row);
    setViewMultitracks([]);
    if (row.songs.length > 0) {
      const songIds = row.songs.map((s) => s.song_id).filter(Boolean);
      if (songIds.length > 0) {
        const { data } = await client
          .from('multitracks')
          .select('song_id, storage_url')
          .in('song_id', songIds);
        if (data) setViewMultitracks(data as MultitrackInfo[]);
      }
    }
  };

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

  // Build month options from data
  const monthOptions = Array.from(
    new Set(rows.map((r) => r.service_date.substring(0, 7)))
  ).sort((a, b) => b.localeCompare(a)).map((ym) => {
    const [y, m] = ym.split('-');
    const label = format(new Date(Number(y), Number(m) - 1), "MMMM 'de' yyyy", { locale: ptBR });
    return { value: ym, label: label.charAt(0).toUpperCase() + label.slice(1) };
  });

  const filteredRows = filterMonth
    ? rows.filter((r) => r.service_date.startsWith(filterMonth))
    : rows;

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

      <div className="flex items-center gap-3">
        <Filter className="h-4 w-4 text-muted-foreground" />
        <select
          value={filterMonth}
          onChange={(e) => setFilterMonth(e.target.value)}
          className="rounded-md border border-border bg-card px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="">Todos os meses</option>
          {monthOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
        {filterMonth && (
          <button
            onClick={() => setFilterMonth('')}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Limpar filtro
          </button>
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
              <TableHead className="w-28">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin inline mr-2" />Carregando...
                </TableCell>
              </TableRow>
            ) : filteredRows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                  <CalendarDays className="h-8 w-8 mx-auto mb-2 opacity-40" />
                  Nenhuma escala encontrada.
                </TableCell>
              </TableRow>
            ) : (
              filteredRows.map((row) => (
                <TableRow key={row.id} className="hover:bg-table-row-hover">
                  <TableCell className="font-medium whitespace-nowrap">{formatDate(row.service_date)}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{periodLabel(row.period)}</Badge>
                  </TableCell>
                  <TableCell>{row.team_name}</TableCell>
                  <TableCell>{row.worship_leader_name}</TableCell>
                  <TableCell>{row.dm_name || '—'}</TableCell>
                  <TableCell>
                    {row.songs.length > 0 ? (
                      <div className="flex flex-col gap-1">
                        {row.songs.map((song, i) => {
                          const colors = [
                            'bg-purple-500/15 text-purple-400',
                            'bg-sky-500/15 text-sky-400',
                            'bg-emerald-500/15 text-emerald-400',
                            'bg-amber-500/15 text-amber-400',
                            'bg-rose-500/15 text-rose-400',
                            'bg-indigo-500/15 text-indigo-400',
                            'bg-teal-500/15 text-teal-400',
                          ];
                          const mt = allMultitracks.find((m) => m.song_id === song.song_id && m.storage_url);
                          return (
                            <div key={i} className="flex items-center gap-1.5">
                              <span
                                className={`inline-block w-fit rounded-full px-2 py-0.5 text-[11px] font-medium leading-tight ${colors[i % colors.length]}`}
                              >
                                {song.name} <span className="opacity-60">({song.key})</span>
                              </span>
                              {mt?.storage_url && (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <a
                                      href={mt.storage_url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      download
                                      className="text-primary hover:text-primary/80 transition-colors"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <Download className="h-3.5 w-3.5" />
                                    </a>
                                  </TooltipTrigger>
                                  <TooltipContent>Baixar Multitrack</TooltipContent>
                                </Tooltip>
                              )}
                            </div>
                          );
                        })}
                      </div>
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
                  <TableCell>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => openView(row)}
                          className="rounded p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                          title="Visualizar"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        {canWrite && (
                          <button
                            onClick={() => navigate(`/escalas/${row.id}/editar`)}
                            className="rounded p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                            title="Editar"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                        )}
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
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* View Dialog */}
      <Dialog open={!!viewTarget} onOpenChange={() => setViewTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Detalhes da Escala</DialogTitle>
          </DialogHeader>
          {viewTarget && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="text-xs text-muted-foreground">Data</span>
                  <p className="text-sm font-medium">{formatDate(viewTarget.service_date)}</p>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground">Período</span>
                  <p><Badge variant="secondary">{periodLabel(viewTarget.period)}</Badge></p>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground">Equipe</span>
                  <p className="text-sm font-medium">{viewTarget.team_name}</p>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground">Ministro Guia</span>
                  <p className="text-sm font-medium">{viewTarget.worship_leader_name}</p>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground">DM</span>
                  <p className="text-sm font-medium">{viewTarget.dm_name || '—'}</p>
                </div>
              </div>

              <div>
                <span className="text-xs text-muted-foreground">Músicas</span>
                {viewTarget.songs.length > 0 ? (
                  <div className="mt-1 flex flex-col gap-1.5">
                    {viewTarget.songs.map((song, i) => {
                      const colors = [
                        'bg-purple-500/15 text-purple-400',
                        'bg-sky-500/15 text-sky-400',
                        'bg-emerald-500/15 text-emerald-400',
                        'bg-amber-500/15 text-amber-400',
                        'bg-rose-500/15 text-rose-400',
                        'bg-indigo-500/15 text-indigo-400',
                        'bg-teal-500/15 text-teal-400',
                      ];
                      const mt = viewMultitracks.find((m) => m.song_id === song.song_id && m.storage_url);
                      return (
                        <div key={i} className="flex items-center gap-2">
                          <span
                            className={`inline-block w-fit rounded-full px-2.5 py-1 text-xs font-medium ${colors[i % colors.length]}`}
                          >
                            {song.name} <span className="opacity-60">({song.key})</span>
                          </span>
                          {mt?.storage_url && (
                            <a
                              href={mt.storage_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              download
                              className="flex items-center gap-1 rounded-full bg-primary/15 text-primary px-2 py-0.5 text-[11px] font-medium hover:bg-primary/25 transition-colors"
                              title="Baixar Multitrack"
                            >
                              <Music className="h-3 w-3" />
                              Multitrack
                              <Download className="h-3 w-3" />
                            </a>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Nenhuma música</p>
                )}
              </div>

              {viewTarget.notes && (
                <div>
                  <span className="text-xs text-muted-foreground">Observações</span>
                  <p className="text-sm mt-0.5 whitespace-pre-wrap">{viewTarget.notes}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

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
