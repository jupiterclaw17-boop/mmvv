/**
 * EscalaForm — Cadastro e edição de escalas (services).
 * Slots dinâmicos de músicas (1-7) com SongAutocompleteGlobal + badge "Tem Multitrack".
 * Ministro Guia filtrado por role='ministro_guia', DM por role='dm'.
 */
import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { logAudit } from '@/services/logService';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { SongAutocompleteGlobal } from '@/components/shared/SongAutocompleteGlobal';
import { ALL_SONG_KEYS, PERIODS } from '@/utils/constants';
import { ArrowLeft, Loader2, Plus, Trash2, CalendarIcon, Music2 } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

const client = supabase as any;

const MIN_SONGS = 1;
const MAX_SONGS = 7;

interface SongSlot {
  songId: string | null;
  songName: string;
  artistName: string;
  songKey: string;
  notes: string;
  hasMultitrack: boolean;
}

const emptySongSlot = (): SongSlot => ({
  songId: null,
  songName: '',
  artistName: '',
  songKey: '',
  notes: '',
  hasMultitrack: false,
});

interface PersonOption {
  id: string;
  full_name: string;
}

const EscalaForm = () => {
  const { id } = useParams();
  const isEdit = !!id;
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { toast } = useToast();

  const [serviceDate, setServiceDate] = useState<Date | undefined>(undefined);
  const [period, setPeriod] = useState('');
  const [teamId, setTeamId] = useState('');
  const [worshipLeaderId, setWorshipLeaderId] = useState('');
  const [dmId, setDmId] = useState('');
  const [notes, setNotes] = useState('');
  const [songs, setSongs] = useState<SongSlot[]>([emptySongSlot()]);

  const [teams, setTeams] = useState<{ id: string; name: string }[]>([]);
  const [ministers, setMinisters] = useState<PersonOption[]>([]);
  const [dms, setDms] = useState<PersonOption[]>([]);

  const [saving, setSaving] = useState(false);
  const [loadingData, setLoadingData] = useState(true);

  // Fetch lookup data
  useEffect(() => {
    const load = async () => {
      const [teamsRes, ministersRes, dmsRes] = await Promise.all([
        client.from('teams').select('id, name').eq('status', 'ativa').order('name'),
        client.from('users_profiles').select('id, full_name').eq('role', 'ministro_guia').eq('status', 'ativo').order('full_name'),
        client.from('users_profiles').select('id, full_name').eq('role', 'dm').eq('status', 'ativo').order('full_name'),
      ]);

      setTeams(teamsRes.data || []);
      setMinisters(ministersRes.data || []);
      setDms(dmsRes.data || []);

      if (!isEdit) setLoadingData(false);
    };
    load();
  }, [isEdit]);

  // Load existing service for edit
  useEffect(() => {
    if (!isEdit) return;

    const load = async () => {
      const { data, error } = await client
        .from('services')
        .select('*')
        .eq('id', id)
        .single();

      if (error || !data) {
        toast({ title: 'Escala não encontrada.', variant: 'destructive' });
        navigate('/escalas');
        return;
      }

      setServiceDate(parseISO(data.service_date));
      setPeriod(data.period);
      setTeamId(data.team_id);
      setWorshipLeaderId(data.worship_leader_id);
      setDmId(data.dm_id || '');
      setNotes(data.notes || '');

      // Load service_songs
      const { data: songsData } = await client
        .from('service_songs')
        .select('*, song:song_id(id, name, artist_id, artists:artist_id(name))')
        .eq('service_id', id)
        .order('created_at');

      if (songsData && songsData.length > 0) {
        // Check multitracks for each song
        const songIds = songsData.map((s: any) => s.song_id);
        const { data: mtData } = await client
          .from('multitracks')
          .select('song_id')
          .in('song_id', songIds);

        const mtSet = new Set((mtData || []).map((m: any) => m.song_id));

        setSongs(songsData.map((s: any) => ({
          songId: s.song_id,
          songName: s.song?.name || '',
          artistName: s.song?.artists?.name || '',
          songKey: s.song_key,
          notes: s.notes || '',
          hasMultitrack: mtSet.has(s.song_id),
        })));
      }

      setLoadingData(false);
    };
    load();
  }, [id, isEdit, navigate, toast]);

  const addSongSlot = () => {
    if (songs.length >= MAX_SONGS) return;
    setSongs((s) => [...s, emptySongSlot()]);
  };

  const removeSongSlot = (index: number) => {
    if (songs.length <= MIN_SONGS) return;
    setSongs((s) => s.filter((_, i) => i !== index));
  };

  const updateSongSlot = (index: number, updates: Partial<SongSlot>) => {
    setSongs((s) => s.map((slot, i) => (i === index ? { ...slot, ...updates } : slot)));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;

    // Validations
    if (!serviceDate) {
      toast({ title: 'Selecione a data do culto.', variant: 'destructive' });
      return;
    }
    if (!period) {
      toast({ title: 'Selecione o período.', variant: 'destructive' });
      return;
    }
    if (!teamId) {
      toast({ title: 'Selecione a equipe.', variant: 'destructive' });
      return;
    }
    if (!worshipLeaderId) {
      toast({ title: 'Selecione o ministro guia.', variant: 'destructive' });
      return;
    }

    // Validate songs: at least 1 must have songId and songKey
    const validSongs = songs.filter((s) => s.songId && s.songKey);
    if (validSongs.length < MIN_SONGS) {
      toast({ title: `Adicione pelo menos ${MIN_SONGS} música com tom selecionado.`, variant: 'destructive' });
      return;
    }

    setSaving(true);

    try {
      const dateStr = format(serviceDate, 'yyyy-MM-dd');

      const servicePayload: Record<string, any> = {
        service_date: dateStr,
        period,
        team_id: teamId,
        worship_leader_id: worshipLeaderId,
        dm_id: dmId || null,
        notes: notes || null,
      };

      let serviceId: string;

      if (isEdit) {
        const { error } = await client.from('services').update(servicePayload).eq('id', id);
        if (error) throw error;
        serviceId = id!;

        // Delete old service_songs and re-insert
        await client.from('service_songs').delete().eq('service_id', serviceId);
      } else {
        servicePayload.created_by = profile.id;
        const { data, error } = await client.from('services').insert(servicePayload).select('id').single();
        if (error) throw error;
        serviceId = data.id;
      }

      // Insert service_songs
      const songRows = validSongs.map((s) => ({
        service_id: serviceId,
        song_id: s.songId!,
        song_key: s.songKey,
        notes: s.notes || null,
      }));

      const { error: songsError } = await client.from('service_songs').insert(songRows);
      if (songsError) throw songsError;

      await logAudit({
        userId: profile.id,
        userName: profile.full_name,
        action: isEdit ? 'UPDATE' : 'CREATE',
        entity: 'service',
        entityId: serviceId,
        description: `Escala de ${dateStr} ${isEdit ? 'atualizada' : 'cadastrada'}.`,
      });

      toast({ title: `Escala ${isEdit ? 'atualizada' : 'cadastrada'} com sucesso.` });
      navigate('/escalas');
    } catch (err: any) {
      toast({ title: err.message || 'Ocorreu um erro inesperado. Tente novamente.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  if (loadingData) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" /> Carregando...
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/escalas')} className="text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold">{isEdit ? 'Editar Escala' : 'Nova Escala'}</h1>
          <p className="text-sm text-muted-foreground">
            {isEdit ? 'Altere as informações da escala.' : 'Preencha os dados da nova escala.'}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5 rounded-lg border border-border bg-card p-6">
        {/* Date + Period */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Data do Culto *</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  className={cn('w-full justify-start text-left font-normal', !serviceDate && 'text-muted-foreground')}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {serviceDate ? format(serviceDate, 'dd/MM/yyyy', { locale: ptBR }) : 'Selecione...'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={serviceDate}
                  onSelect={setServiceDate}
                  locale={ptBR}
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <Label>Período *</Label>
            <Select value={period} onValueChange={setPeriod}>
              <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
              <SelectContent>
                {PERIODS.map((p) => (
                  <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Team */}
        <div className="space-y-2">
          <Label>Equipe *</Label>
          <Select value={teamId} onValueChange={setTeamId}>
            <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
            <SelectContent>
              {teams.map((t) => (
                <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Worship Leader + DM */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Ministro Guia *</Label>
            <Select value={worshipLeaderId} onValueChange={setWorshipLeaderId}>
              <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
              <SelectContent>
                {ministers.map((m) => (
                  <SelectItem key={m.id} value={m.id}>{m.full_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>DM</Label>
            <Select value={dmId} onValueChange={setDmId}>
              <SelectTrigger><SelectValue placeholder="Nenhum" /></SelectTrigger>
              <SelectContent>
                {dms.map((d) => (
                  <SelectItem key={d.id} value={d.id}>{d.full_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Songs (dynamic slots) */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-base">Músicas ({songs.length}/{MAX_SONGS})</Label>
            {songs.length < MAX_SONGS && (
              <Button type="button" variant="outline" size="sm" onClick={addSongSlot}>
                <Plus className="mr-1 h-3.5 w-3.5" /> Adicionar Música
              </Button>
            )}
          </div>

          {songs.map((slot, index) => (
            <div key={index} className="rounded-md border border-border bg-muted/30 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">Música {index + 1}</span>
                <div className="flex items-center gap-2">
                  {slot.hasMultitrack && (
                    <Badge variant="secondary" className="bg-success/15 text-success border-success/30 text-xs">
                      <Music2 className="h-3 w-3 mr-1" /> Tem Multitrack
                    </Badge>
                  )}
                  {songs.length > MIN_SONGS && (
                    <button
                      type="button"
                      onClick={() => removeSongSlot(index)}
                      className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                      title="Remover música"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-[1fr_120px] gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Música *</Label>
                  <SongAutocompleteGlobal
                    value={slot.songId}
                    displayValue={slot.songId ? `${slot.songName} — ${slot.artistName}` : ''}
                    onSelect={(song) => {
                      updateSongSlot(index, {
                        songId: song.id,
                        songName: song.name,
                        artistName: song.artist_name,
                        hasMultitrack: song.has_multitrack,
                      });
                    }}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Tom *</Label>
                  <Select
                    value={slot.songKey}
                    onValueChange={(v) => updateSongSlot(index, { songKey: v })}
                  >
                    <SelectTrigger className="h-9"><SelectValue placeholder="Tom" /></SelectTrigger>
                    <SelectContent>
                      {ALL_SONG_KEYS.map((k) => (
                        <SelectItem key={k} value={k}>{k}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Notes */}
        <div className="space-y-2">
          <Label>Observações</Label>
          <Textarea
            placeholder="Informações adicionais..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
          />
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="outline" onClick={() => navigate('/escalas')} disabled={saving}>
            Cancelar
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Salvando...</>
            ) : (
              isEdit ? 'Salvar Alterações' : 'Cadastrar'
            )}
          </Button>
        </div>
      </form>
    </div>
  );
};

export default EscalaForm;
