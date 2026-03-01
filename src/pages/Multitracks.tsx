/**
 * Multitracks — Listagem com busca, download, edição e deleção.
 * Apenas dm/admin podem criar/editar/deletar.
 */
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { storageService } from '@/services/storageService';
import { logAudit } from '@/services/logService';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Pencil, Trash2, Download, Search, Music, Loader2, Play } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
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
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';

const client = supabase as any;

interface MultitrackRow {
  id: string;
  song_key: string;
  bpm: number | null;
  notes: string | null;
  storage_url: string | null;
  storage_path: string | null;
  youtube_version_url: string | null;
  artist_name: string;
  song_name: string;
  created_at: string | null;
}

const Multitracks = () => {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [rows, setRows] = useState<MultitrackRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<MultitrackRow | null>(null);
  const [youtubeTarget, setYoutubeTarget] = useState<MultitrackRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  const canWrite = profile?.role === 'admin' || profile?.role === 'dm';

  const fetchData = useCallback(async () => {
    setLoading(true);
    let q = client
      .from('multitracks')
      .select('*, artist:artist_id(name), song:song_id(name)')
      .order('created_at', { ascending: false });

    const { data, error } = await q;

    if (!error && data) {
      let mapped = (data as any[]).map((r) => ({
        ...r,
        artist_name: r.artist?.name || '—',
        song_name: r.song?.name || '—',
      }));

      if (search.trim()) {
        const s = search.trim().toUpperCase();
        mapped = mapped.filter(
          (r) =>
            r.artist_name.toUpperCase().includes(s) ||
            r.song_name.toUpperCase().includes(s) ||
            r.song_key.toUpperCase().includes(s)
        );
      }

      setRows(mapped);
    }
    setLoading(false);
  }, [search]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleDelete = async () => {
    if (!deleteTarget || !profile) return;
    setDeleting(true);

    try {
      // Delete file from storage first if exists
      if (deleteTarget.storage_path) {
        try {
          await storageService.deleteFile(deleteTarget.storage_path);
        } catch {
          // Storage file might already be gone, continue
        }
      }

      const { error } = await client
        .from('multitracks')
        .delete()
        .eq('id', deleteTarget.id);

      if (error) throw error;

      await logAudit({
        userId: profile.id,
        userName: profile.full_name,
        action: 'DELETE',
        entity: 'multitrack',
        entityId: deleteTarget.id,
        description: `Multitrack '${deleteTarget.song_name} — ${deleteTarget.artist_name}' deletado.`,
      });

      toast({ title: 'Multitrack deletado com sucesso.' });
      setDeleteTarget(null);
      fetchData();
    } catch (e: any) {
      toast({ title: e.message || 'Ocorreu um erro inesperado. Tente novamente.', variant: 'destructive' });
    } finally {
      setDeleting(false);
    }
  };

  const handleDownload = async (row: MultitrackRow) => {
    if (row.storage_url) {
      window.open(row.storage_url, '_blank');
      return;
    }

    if (!row.storage_path) return;

    const url = await storageService.getDownloadUrl(row.storage_path);
    window.open(url, '_blank');
  };

  /** Extract YouTube embed ID from various URL formats */
  const getYoutubeEmbedUrl = (url: string): string | null => {
    try {
      const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([a-zA-Z0-9_-]{11})/);
      return match ? `https://www.youtube.com/embed/${match[1]}?autoplay=1` : null;
    } catch {
      return null;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Multitracks</h1>
          <p className="text-sm text-muted-foreground">Biblioteca de multitracks do ministério.</p>
        </div>
        {canWrite && (
          <Button onClick={() => navigate('/multitracks/novo')}>
            <Plus className="mr-2 h-4 w-4" /> Novo Multitrack
          </Button>
        )}
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por artista, música ou tom..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <div className="rounded-lg border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Música</TableHead>
              <TableHead>Artista</TableHead>
              <TableHead>Tom</TableHead>
              <TableHead>BPM</TableHead>
              <TableHead>Arquivo</TableHead>
              <TableHead>YouTube</TableHead>
              <TableHead>Observações</TableHead>
              {canWrite && <TableHead className="w-24">Ações</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={canWrite ? 8 : 7} className="text-center py-8 text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin inline mr-2" />
                  Carregando...
                </TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={canWrite ? 8 : 7} className="text-center py-8 text-muted-foreground">
                  <Music className="h-8 w-8 mx-auto mb-2 opacity-40" />
                  Nenhum multitrack encontrado.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow key={row.id} className="hover:bg-table-row-hover">
                  <TableCell className="font-medium">{row.song_name}</TableCell>
                  <TableCell>{row.artist_name}</TableCell>
                  <TableCell>
                    <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                      {row.song_key}
                    </span>
                  </TableCell>
                  <TableCell>{row.bpm ?? '—'}</TableCell>
                  <TableCell>
                    {row.storage_path ? (
                      <button
                        onClick={() => handleDownload(row)}
                        className="inline-flex items-center gap-1 text-primary hover:underline text-sm"
                      >
                        <Download className="h-3.5 w-3.5" /> Download
                      </button>
                    ) : '—'}
                  </TableCell>
                  <TableCell>
                    {row.youtube_version_url ? (
                      <button
                        onClick={() => setYoutubeTarget(row)}
                        className="inline-flex items-center gap-1 text-rose-400 hover:text-rose-300 text-sm transition-colors"
                      >
                        <Play className="h-3.5 w-3.5" /> Assistir
                      </button>
                    ) : '—'}
                  </TableCell>
                  <TableCell className="max-w-[200px]">
                    {row.notes ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="block truncate cursor-default">{row.notes}</span>
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs">
                          <p>{row.notes}</p>
                        </TooltipContent>
                      </Tooltip>
                    ) : '—'}
                  </TableCell>
                  {canWrite && (
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => navigate(`/multitracks/${row.id}/editar`)}
                          className="rounded p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                          title="Editar"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => setDeleteTarget(row)}
                          className="rounded p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                          title="Deletar"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* YouTube modal */}
      <Dialog open={!!youtubeTarget} onOpenChange={() => setYoutubeTarget(null)}>
        <DialogContent className="sm:max-w-2xl p-0 overflow-hidden">
          <DialogHeader className="p-4 pb-0">
            <DialogTitle className="text-base">
              {youtubeTarget?.song_name} — {youtubeTarget?.artist_name}
            </DialogTitle>
          </DialogHeader>
          {youtubeTarget?.youtube_version_url && (
            <div className="aspect-video w-full">
              {getYoutubeEmbedUrl(youtubeTarget.youtube_version_url) ? (
                <iframe
                  src={getYoutubeEmbedUrl(youtubeTarget.youtube_version_url)!}
                  className="h-full w-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  title={youtubeTarget.song_name}
                />
              ) : (
                <div className="flex h-full items-center justify-center text-muted-foreground">
                  <a
                    href={youtubeTarget.youtube_version_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    Abrir no YouTube
                  </a>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deletar Multitrack</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja deletar o multitrack <strong>{deleteTarget?.song_name} — {deleteTarget?.artist_name}</strong>?
              {deleteTarget?.storage_path && ' O arquivo associado também será removido.'}
              {' '}Esta ação não pode ser desfeita.
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

export default Multitracks;
