/**
 * MultitrackForm — Cadastro e edição de multitracks.
 * Upload via storageService. Se upload falhar, registro não é salvo.
 * Na edição, arquivo atual com botão de lixeira + modal de confirmação.
 */
import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { storageService } from '@/services/storageService';
import { logAudit } from '@/services/logService';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { ArtistAutocomplete } from '@/components/shared/ArtistAutocomplete';
import { SongAutocomplete } from '@/components/shared/SongAutocomplete';
import { ALL_SONG_KEYS, ACCEPTED_MIME_TYPES, MAX_FILE_SIZE_BYTES, MAX_FILE_SIZE_MB } from '@/utils/constants';
import { ArrowLeft, Loader2, Upload, FileAudio, Trash2, ExternalLink } from 'lucide-react';

const client = supabase as any;

interface FormData {
  artistId: string | null;
  artistName: string;
  songId: string | null;
  songName: string;
  songKey: string;
  bpm: string;
  youtubeUrl: string;
  notes: string;
}

const initialForm: FormData = {
  artistId: null,
  artistName: '',
  songId: null,
  songName: '',
  songKey: '',
  bpm: '',
  youtubeUrl: '',
  notes: '',
};

const MultitrackForm = () => {
  const { id } = useParams();
  const isEdit = !!id;
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { toast } = useToast();

  const [form, setForm] = useState<FormData>(initialForm);
  const [file, setFile] = useState<File | null>(null);
  const [existingFilePath, setExistingFilePath] = useState<string | null>(null);
  const [existingFileUrl, setExistingFileUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [loadingData, setLoadingData] = useState(isEdit);
  const [showDeleteFileDialog, setShowDeleteFileDialog] = useState(false);
  const [deletingFile, setDeletingFile] = useState(false);

  // Load existing multitrack for edit
  useEffect(() => {
    if (!isEdit) return;

    const load = async () => {
      const { data, error } = await client
        .from('multitracks')
        .select('*, artist:artist_id(id, name), song:song_id(id, name)')
        .eq('id', id)
        .single();

      if (error || !data) {
        toast({ title: 'Multitrack não encontrado.', variant: 'destructive' });
        navigate('/multitracks');
        return;
      }

      setForm({
        artistId: data.artist?.id || null,
        artistName: data.artist?.name || '',
        songId: data.song?.id || null,
        songName: data.song?.name || '',
        songKey: data.song_key,
        bpm: data.bpm?.toString() || '',
        youtubeUrl: data.youtube_version_url || '',
        notes: data.notes || '',
      });

      setExistingFilePath(data.storage_path);
      setExistingFileUrl(data.storage_url);
      setLoadingData(false);
    };

    load();
  }, [id, isEdit, navigate, toast]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;

    const extension = f.name.toLowerCase().split('.').pop() || '';
    const acceptedExtensions = ['mp3', 'wav', 'm4a', 'zip'];
    const mimeAccepted = ACCEPTED_MIME_TYPES.includes(f.type);
    const extensionAccepted = acceptedExtensions.includes(extension);

    if (!mimeAccepted && !extensionAccepted) {
      toast({ title: 'Formato de arquivo não suportado. Use MP3, WAV, M4A ou ZIP.', variant: 'destructive' });
      e.target.value = '';
      return;
    }

    if (f.size > MAX_FILE_SIZE_BYTES) {
      toast({ title: `O arquivo excede o tamanho máximo de ${MAX_FILE_SIZE_MB}MB.`, variant: 'destructive' });
      e.target.value = '';
      return;
    }

    setFile(f);
  };

  const handleDeleteExistingFile = async () => {
    if (!existingFilePath || !profile) return;
    setDeletingFile(true);

    try {
      await storageService.deleteFile(existingFilePath);

      // Update the multitrack record to clear file references
      await client
        .from('multitracks')
        .update({ storage_path: null, storage_url: null })
        .eq('id', id);

      await logAudit({
        userId: profile.id,
        userName: profile.full_name,
        action: 'DELETE_FILE',
        entity: 'multitrack',
        entityId: id!,
        description: `Arquivo do multitrack removido.`,
      });

      setExistingFilePath(null);
      setExistingFileUrl(null);
      setShowDeleteFileDialog(false);
      toast({ title: 'Arquivo removido com sucesso.' });
    } catch {
      toast({ title: 'Falha ao remover o arquivo. Tente novamente.', variant: 'destructive' });
    } finally {
      setDeletingFile(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;

    // Validations
    if (!form.artistId || !form.songId) {
      toast({ title: 'Selecione artista e música.', variant: 'destructive' });
      return;
    }
    if (!form.songKey) {
      toast({ title: 'Selecione o tom.', variant: 'destructive' });
      return;
    }

    setSaving(true);
    let uploadedUrl: string | null = null;
    let uploadedPath: string | null = null;

    try {
      // Upload file first if present — if upload fails, don't save the record
      if (file) {
        setUploading(true);
        const ext = file.name.split('.').pop();
        const path = `${crypto.randomUUID()}.${ext}`;

        const result = await storageService.uploadFile(file, path);
        uploadedUrl = result.url;
        uploadedPath = result.storagePath;
        setUploading(false);
      }

      const payload: Record<string, any> = {
        artist_id: form.artistId,
        song_id: form.songId,
        song_key: form.songKey,
        bpm: form.bpm ? parseInt(form.bpm, 10) : null,
        youtube_version_url: form.youtubeUrl || null,
        notes: form.notes || null,
      };

      // Only update storage fields if a new file was uploaded
      if (uploadedUrl !== null) {
        payload.storage_url = uploadedUrl;
        payload.storage_path = uploadedPath;
      }

      if (isEdit) {
        const { error } = await client
          .from('multitracks')
          .update(payload)
          .eq('id', id);

        if (error) throw error;

        await logAudit({
          userId: profile.id,
          userName: profile.full_name,
          action: 'UPDATE',
          entity: 'multitrack',
          entityId: id!,
          description: `Multitrack '${form.songName} — ${form.artistName}' atualizado.`,
        });

        toast({ title: 'Multitrack atualizado com sucesso.' });
      } else {
        payload.created_by = profile.id;

        const { data, error } = await client
          .from('multitracks')
          .insert(payload)
          .select('id')
          .single();

        if (error) throw error;

        await logAudit({
          userId: profile.id,
          userName: profile.full_name,
          action: 'CREATE',
          entity: 'multitrack',
          entityId: data.id,
          description: `Multitrack '${form.songName} — ${form.artistName}' cadastrado.`,
        });

        toast({ title: 'Multitrack cadastrado com sucesso.' });
      }

      navigate('/multitracks');
    } catch (err: any) {
      setUploading(false);

      // If upload succeeded but DB save failed, clean up uploaded file
      if (uploadedPath) {
        try { await storageService.deleteFile(uploadedPath); } catch {}
      }

      toast({
        title: err.message || 'Ocorreu um erro inesperado. Tente novamente.',
        variant: 'destructive',
      });
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

  const fileName = file?.name || (existingFilePath ? existingFilePath.split('/').pop() : null);

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/multitracks')} className="text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold">{isEdit ? 'Editar Multitrack' : 'Novo Multitrack'}</h1>
          <p className="text-sm text-muted-foreground">
            {isEdit ? 'Altere as informações do multitrack.' : 'Preencha os dados do novo multitrack.'}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5 rounded-lg border border-border bg-card p-6">
        {/* Artist */}
        <div className="space-y-2">
          <Label>Artista *</Label>
          <ArtistAutocomplete
            value={form.artistId}
            displayValue={form.artistName}
            onSelect={(id, name) => {
              setForm((f) => ({
                ...f,
                artistId: id,
                artistName: name,
                // Reset song when artist changes
                songId: f.artistId !== id ? null : f.songId,
                songName: f.artistId !== id ? '' : f.songName,
              }));
            }}
          />
        </div>

        {/* Song */}
        <div className="space-y-2">
          <Label>Música *</Label>
          <SongAutocomplete
            value={form.songId}
            displayValue={form.songName}
            onSelect={(id, name) => setForm((f) => ({ ...f, songId: id, songName: name }))}
            artistId={form.artistId}
          />
        </div>

        {/* Key + BPM row */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Tom *</Label>
            <Select value={form.songKey} onValueChange={(v) => setForm((f) => ({ ...f, songKey: v }))}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione..." />
              </SelectTrigger>
              <SelectContent>
                {ALL_SONG_KEYS.map((k) => (
                  <SelectItem key={k} value={k}>{k}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>BPM</Label>
            <Input
              type="number"
              min={1}
              max={300}
              placeholder="Ex: 120"
              value={form.bpm}
              onChange={(e) => setForm((f) => ({ ...f, bpm: e.target.value }))}
            />
          </div>
        </div>

        {/* YouTube URL */}
        <div className="space-y-2">
          <Label>URL YouTube (versão)</Label>
          <div className="relative">
            <ExternalLink className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="url"
              placeholder="https://youtube.com/..."
              value={form.youtubeUrl}
              onChange={(e) => setForm((f) => ({ ...f, youtubeUrl: e.target.value }))}
              className="pl-9"
            />
          </div>
        </div>

        {/* File Upload */}
        <div className="space-y-2">
          <Label>Arquivo (MP3, WAV, M4A, ZIP — máx {MAX_FILE_SIZE_MB}MB)</Label>

          {/* Show existing file in edit mode */}
          {isEdit && existingFilePath && !file && (
            <div className="flex items-center gap-2 rounded-md border border-border bg-muted/50 p-3 text-sm">
              <FileAudio className="h-4 w-4 text-primary shrink-0" />
              <span className="truncate flex-1">{existingFilePath.split('/').pop()}</span>
              <button
                type="button"
                onClick={() => setShowDeleteFileDialog(true)}
                className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                title="Remover arquivo"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* New file selected */}
          {file && (
            <div className="flex items-center gap-2 rounded-md border border-border bg-muted/50 p-3 text-sm">
              <FileAudio className="h-4 w-4 text-primary shrink-0" />
              <span className="truncate flex-1">{file.name}</span>
              <button
                type="button"
                onClick={() => setFile(null)}
                className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                title="Remover"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* Upload input */}
          {!file && !(isEdit && existingFilePath) && (
            <label className="flex cursor-pointer items-center justify-center gap-2 rounded-md border-2 border-dashed border-border p-6 text-sm text-muted-foreground hover:border-primary/50 hover:text-foreground transition-colors">
              <Upload className="h-5 w-5" />
              <span>Clique para selecionar ou arraste o arquivo</span>
              <input
                type="file"
                accept={ACCEPTED_MIME_TYPES.join(',')}
                onChange={handleFileChange}
                className="hidden"
              />
            </label>
          )}
        </div>

        {/* Notes */}
        <div className="space-y-2">
          <Label>Observações</Label>
          <Textarea
            placeholder="Informações adicionais..."
            value={form.notes}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            rows={3}
          />
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="outline" onClick={() => navigate('/multitracks')} disabled={saving}>
            Cancelar
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {uploading ? 'Enviando arquivo...' : 'Salvando...'}
              </>
            ) : (
              isEdit ? 'Salvar Alterações' : 'Cadastrar'
            )}
          </Button>
        </div>
      </form>

      {/* Delete file confirmation modal */}
      <AlertDialog open={showDeleteFileDialog} onOpenChange={setShowDeleteFileDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover Arquivo</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover o arquivo deste multitrack? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingFile}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteExistingFile}
              disabled={deletingFile}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deletingFile ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Removendo...</>
              ) : 'Remover'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default MultitrackForm;
