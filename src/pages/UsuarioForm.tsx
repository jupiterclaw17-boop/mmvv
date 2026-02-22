import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { logAudit, logError } from '@/services/logService';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { ROLE_OPTIONS, STATUS_OPTIONS } from '@/utils/constants';
import { ArrowLeft } from 'lucide-react';
import { z } from 'zod';

const client = supabase as any;

interface Team {
  id: string;
  name: string;
}

const UsuarioForm = () => {
  const { id } = useParams();
  const isEdit = !!id;
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { toast } = useToast();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('ministro_guia');
  const [teamId, setTeamId] = useState<string>('');
  const [status, setStatus] = useState('ativo');
  const [teams, setTeams] = useState<Team[]>([]);
  const [saving, setSaving] = useState(false);
  const [loadingData, setLoadingData] = useState(isEdit);

  useEffect(() => {
    const fetchTeams = async () => {
      const { data } = await client
        .from('teams')
        .select('id, name')
        .eq('status', 'ativa')
        .order('name');
      if (data) setTeams(data);
    };
    fetchTeams();

    if (isEdit) {
      const fetchUser = async () => {
        const { data } = await client
          .from('users_profiles')
          .select('*')
          .eq('id', id)
          .single();
        if (data) {
          setFullName(data.full_name);
          setEmail(data.email);
          setRole(data.role);
          setTeamId(data.team_id || '');
          setStatus(data.status);
        }
        setLoadingData(false);
      };
      fetchUser();
    }
  }, [id, isEdit]);

  const validate = (): string | null => {
    if (!fullName.trim()) return 'Preencha todos os campos obrigatórios.';
    if (!email.trim()) return 'Preencha todos os campos obrigatórios.';

    const emailSchema = z.string().email();
    const emailResult = emailSchema.safeParse(email.trim());
    if (!emailResult.success) return 'Informe um endereço de e-mail válido.';

    if (!isEdit && password.length < 8) return 'A senha deve ter pelo menos 8 caracteres.';
    if (isEdit && password && password.length < 8) return 'A senha deve ter pelo menos 8 caracteres.';

    if (!role) return 'Preencha todos os campos obrigatórios.';
    if (!status) return 'Preencha todos os campos obrigatórios.';

    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const error = validate();
    if (error) {
      toast({ title: error, variant: 'destructive' });
      return;
    }

    setSaving(true);

    try {
      if (isEdit) {
        const body: Record<string, unknown> = {
          action: 'update',
          user_id: id,
          full_name: fullName.trim(),
          role,
          team_id: teamId && teamId !== 'none' ? teamId : null,
          status,
        };
        if (password) body.password = password;

        const { data, error: fnError } = await supabase.functions.invoke('manage-user', { body });
        if (fnError) throw fnError;
        if (data?.error) throw new Error(data.error);

        await logAudit({
          userId: profile!.id,
          userName: profile!.full_name,
          action: 'UPDATE',
          entity: 'user',
          entityId: id,
          description: `Usuário '${fullName.trim()}' editado.`,
        });

        toast({ title: 'Usuário atualizado com sucesso.' });
      } else {
        const { data, error: fnError } = await supabase.functions.invoke('manage-user', {
          body: {
            action: 'create',
            email: email.trim(),
            password,
            full_name: fullName.trim(),
            role,
            team_id: teamId && teamId !== 'none' ? teamId : null,
            status,
          },
        });

        if (fnError) throw fnError;
        if (data?.error) throw new Error(data.error);

        await logAudit({
          userId: profile!.id,
          userName: profile!.full_name,
          action: 'CREATE',
          entity: 'user',
          entityId: data?.user?.id,
          description: `Usuário '${fullName.trim()}' cadastrado.`,
        });

        toast({ title: 'Usuário cadastrado com sucesso.' });
      }

      navigate('/usuarios');
    } catch (e: any) {
      const msg = e.message || 'Ocorreu um erro inesperado. Tente novamente.';
      toast({ title: msg, variant: 'destructive' });

      await logError({
        userId: profile?.id,
        userName: profile?.full_name,
        description: `Erro ao salvar registro em users_profiles: ${msg}`,
      });
    } finally {
      setSaving(false);
    }
  };

  if (loadingData) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/usuarios')} className="rounded p-1.5 hover:bg-accent transition-colors">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold">{isEdit ? 'Editar Usuário' : 'Novo Usuário'}</h1>
          <p className="text-sm text-muted-foreground">
            {isEdit ? 'Atualize os dados do usuário.' : 'Preencha os dados para cadastrar um novo usuário.'}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 rounded-lg border border-border bg-card p-6">
        <div className="space-y-2">
          <Label htmlFor="fullName">Nome Completo *</Label>
          <Input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} maxLength={100} required />
        </div>

        <div className="space-y-2">
          <Label htmlFor="email">E-mail *</Label>
          <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} disabled={isEdit} maxLength={255} required />
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">Senha {isEdit ? '(deixe em branco para manter)' : '*'}</Label>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={isEdit ? '••••••••' : 'Mínimo 8 caracteres'}
            required={!isEdit}
            minLength={isEdit ? 0 : 8}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Tipo de Usuário *</Label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {ROLE_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Status *</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <Label>Equipe</Label>
          <Select value={teamId} onValueChange={setTeamId}>
            <SelectTrigger><SelectValue placeholder="Selecione (opcional)" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Nenhuma</SelectItem>
              {teams.map((t) => (
                <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex justify-end gap-3 pt-4">
          <Button type="button" variant="outline" onClick={() => navigate('/usuarios')}>
            Cancelar
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? 'Salvando...' : isEdit ? 'Salvar Alterações' : 'Cadastrar Usuário'}
          </Button>
        </div>
      </form>
    </div>
  );
};

export default UsuarioForm;
