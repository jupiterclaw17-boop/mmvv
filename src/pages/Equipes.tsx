import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { logAudit } from '@/services/logService';
import { Button } from '@/components/ui/button';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { TEAM_STATUS_OPTIONS } from '@/utils/constants';
import {
  Tooltip, TooltipContent, TooltipTrigger,
} from '@/components/ui/tooltip';

const client = supabase as any;

interface TeamRow {
  id: string;
  name: string;
  worship_leader_id: string;
  worship_leader_name?: string;
  status: string;
  notes: string | null;
}

const Equipes = () => {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [teams, setTeams] = useState<TeamRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<TeamRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  const isAdmin = profile?.role === 'admin';

  const fetchTeams = async () => {
    setLoading(true);
    const { data, error } = await client
      .from('teams')
      .select('*, worship_leader:worship_leader_id(full_name)')
      .order('name');

    if (!error && data) {
      setTeams(data.map((t: any) => ({
        ...t,
        worship_leader_name: t.worship_leader?.full_name || '—',
      })));
    }
    setLoading(false);
  };

  useEffect(() => { fetchTeams(); }, []);

  const handleDelete = async () => {
    if (!deleteTarget || !profile) return;
    setDeleting(true);

    try {
      const { error } = await client
        .from('teams')
        .delete()
        .eq('id', deleteTarget.id);

      if (error) throw error;

      await logAudit({
        userId: profile.id,
        userName: profile.full_name,
        action: 'DELETE',
        entity: 'team',
        entityId: deleteTarget.id,
        description: `Equipe '${deleteTarget.name}' deletada.`,
      });

      toast({ title: 'Equipe deletada com sucesso.' });
      setDeleteTarget(null);
      fetchTeams();
    } catch (e: any) {
      toast({ title: e.message || 'Ocorreu um erro inesperado. Tente novamente.', variant: 'destructive' });
    } finally {
      setDeleting(false);
    }
  };

  const statusLabel = (s: string) => TEAM_STATUS_OPTIONS.find(o => o.value === s)?.label || s;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Equipes</h1>
          <p className="text-sm text-muted-foreground">Gestão de equipes do ministério.</p>
        </div>
        {isAdmin && (
          <Button onClick={() => navigate('/equipes/nova')}>
            <Plus className="mr-2 h-4 w-4" /> Nova Equipe
          </Button>
        )}
      </div>

      <div className="rounded-lg border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Ministro Guia</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Observações</TableHead>
              {isAdmin && <TableHead className="w-24">Ações</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={isAdmin ? 5 : 4} className="text-center py-8 text-muted-foreground">
                  Carregando...
                </TableCell>
              </TableRow>
            ) : teams.length === 0 ? (
              <TableRow>
                <TableCell colSpan={isAdmin ? 5 : 4} className="text-center py-8 text-muted-foreground">
                  Nenhuma equipe encontrada.
                </TableCell>
              </TableRow>
            ) : (
              teams.map((team) => (
                <TableRow key={team.id} className="hover:bg-table-row-hover">
                  <TableCell className="font-medium">{team.name}</TableCell>
                  <TableCell>{team.worship_leader_name}</TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                      team.status === 'ativa'
                        ? 'bg-success/10 text-success'
                        : 'bg-destructive/10 text-destructive'
                    }`}>
                      {statusLabel(team.status)}
                    </span>
                  </TableCell>
                  <TableCell className="max-w-[200px]">
                    {team.notes ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="block truncate cursor-default">{team.notes}</span>
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs">
                          <p>{team.notes}</p>
                        </TooltipContent>
                      </Tooltip>
                    ) : '—'}
                  </TableCell>
                  {isAdmin && (
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => navigate(`/equipes/${team.id}/editar`)}
                          className="rounded p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                          title="Editar"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => setDeleteTarget(team)}
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

      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deletar Equipe</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja deletar a equipe <strong>{deleteTarget?.name}</strong>? Esta ação não pode ser desfeita.
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

export default Equipes;
