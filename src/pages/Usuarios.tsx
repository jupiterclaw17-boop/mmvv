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
import { ROLE_OPTIONS, STATUS_OPTIONS } from '@/utils/constants';

interface UserRow {
  id: string;
  full_name: string;
  email: string;
  role: string;
  team_id: string | null;
  status: string;
  team_name?: string;
}

const client = supabase as any;

const Usuarios = () => {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<UserRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchUsers = async () => {
    setLoading(true);
    const { data, error } = await client
      .from('users_profiles')
      .select('*, teams:team_id(name)')
      .order('full_name');

    if (!error && data) {
      setUsers(data.map((u: any) => ({
        ...u,
        team_name: u.teams?.name || null,
      })));
    }
    setLoading(false);
  };

  useEffect(() => { fetchUsers(); }, []);

  const handleDelete = async () => {
    if (!deleteTarget || !profile) return;
    setDeleting(true);

    try {
      const { data, error } = await supabase.functions.invoke('manage-user', {
        body: { action: 'delete', user_id: deleteTarget.id },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      await logAudit({
        userId: profile.id,
        userName: profile.full_name,
        action: 'DELETE',
        entity: 'user',
        entityId: deleteTarget.id,
        description: `Usuário '${deleteTarget.full_name}' deletado.`,
      });

      toast({ title: 'Usuário deletado com sucesso.' });
      setDeleteTarget(null);
      fetchUsers();
    } catch (e: any) {
      toast({ title: e.message || 'Ocorreu um erro inesperado. Tente novamente.', variant: 'destructive' });
    } finally {
      setDeleting(false);
    }
  };

  const roleLabel = (r: string) => ROLE_OPTIONS.find(o => o.value === r)?.label || r;
  const statusLabel = (s: string) => STATUS_OPTIONS.find(o => o.value === s)?.label || s;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Usuários</h1>
          <p className="text-sm text-muted-foreground">Gestão de usuários do sistema.</p>
        </div>
        <Button onClick={() => navigate('/usuarios/novo')}>
          <Plus className="mr-2 h-4 w-4" /> Novo Usuário
        </Button>
      </div>

      <div className="rounded-lg border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>E-mail</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Equipe</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-24">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  Carregando...
                </TableCell>
              </TableRow>
            ) : users.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  Nenhum usuário encontrado.
                </TableCell>
              </TableRow>
            ) : (
              users.map((user) => (
                <TableRow key={user.id} className="hover:bg-table-row-hover">
                  <TableCell className="font-medium">{user.full_name}</TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>{roleLabel(user.role)}</TableCell>
                  <TableCell>{user.team_name || '—'}</TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                      user.status === 'ativo'
                        ? 'bg-success/10 text-success'
                        : 'bg-destructive/10 text-destructive'
                    }`}>
                      {statusLabel(user.status)}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => navigate(`/usuarios/${user.id}/editar`)}
                        className="rounded p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                        title="Editar"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => setDeleteTarget(user)}
                        className="rounded p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                        title="Deletar"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deletar Usuário</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja deletar o usuário <strong>{deleteTarget?.full_name}</strong>? O acesso deste usuário ao sistema será removido permanentemente.
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

export default Usuarios;
