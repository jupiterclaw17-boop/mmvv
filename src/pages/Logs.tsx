import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarIcon, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover, PopoverContent, PopoverTrigger,
} from '@/components/ui/popover';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Tooltip, TooltipContent, TooltipTrigger,
} from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { PAGE_SIZE } from '@/utils/constants';

const client = supabase as any;

interface LogRow {
  id: string;
  created_at: string;
  log_type: string;
  user_name: string | null;
  action: string | null;
  entity: string | null;
  description: string;
}

const Logs = () => {
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  const fetchLogs = useCallback(async () => {
    setLoading(true);

    let query = client
      .from('logs')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

    if (dateFrom) {
      query = query.gte('created_at', format(dateFrom, 'yyyy-MM-dd'));
    }
    if (dateTo) {
      // Add 1 day to include the whole end date
      const nextDay = new Date(dateTo);
      nextDay.setDate(nextDay.getDate() + 1);
      query = query.lt('created_at', format(nextDay, 'yyyy-MM-dd'));
    }

    const { data, count, error } = await query;

    if (!error) {
      setLogs(data || []);
      setTotalCount(count || 0);
    }
    setLoading(false);
  }, [page, dateFrom, dateTo]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  // Reset to page 0 when filters change
  useEffect(() => {
    setPage(0);
  }, [dateFrom, dateTo]);

  const clearFilters = () => {
    setDateFrom(undefined);
    setDateTo(undefined);
    setPage(0);
  };

  const hasFilters = !!dateFrom || !!dateTo;

  const logTypeLabel = (type: string) => {
    if (type === 'audit') return 'Auditoria';
    if (type === 'error') return 'Erro';
    return type;
  };

  const actionLabel = (action: string | null) => {
    if (!action) return '—';
    const map: Record<string, string> = {
      CREATE: 'Criar',
      UPDATE: 'Editar',
      DELETE: 'Deletar',
      DELETE_FILE: 'Deletar Arquivo',
      LOGIN: 'Login',
    };
    return map[action] || action;
  };

  const entityLabel = (entity: string | null) => {
    if (!entity) return '—';
    const map: Record<string, string> = {
      multitrack: 'Multitrack',
      service: 'Escala',
      team: 'Equipe',
      user: 'Usuário',
    };
    return map[entity] || entity;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Logs</h1>
        <p className="text-sm text-muted-foreground">Registro de auditoria e erros do sistema.</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <span className="text-sm font-medium">Data Início</span>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  'w-[180px] justify-start text-left font-normal',
                  !dateFrom && 'text-muted-foreground'
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {dateFrom ? format(dateFrom, 'dd/MM/yyyy') : 'Selecionar'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={dateFrom}
                onSelect={setDateFrom}
                locale={ptBR}
                initialFocus
                className={cn('p-3 pointer-events-auto')}
              />
            </PopoverContent>
          </Popover>
        </div>

        <div className="space-y-1">
          <span className="text-sm font-medium">Data Fim</span>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  'w-[180px] justify-start text-left font-normal',
                  !dateTo && 'text-muted-foreground'
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {dateTo ? format(dateTo, 'dd/MM/yyyy') : 'Selecionar'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={dateTo}
                onSelect={setDateTo}
                locale={ptBR}
                initialFocus
                className={cn('p-3 pointer-events-auto')}
              />
            </PopoverContent>
          </Popover>
        </div>

        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters} className="h-10">
            <X className="mr-1 h-4 w-4" /> Limpar Filtros
          </Button>
        )}
      </div>

      {/* Table */}
      <div className="rounded-lg border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[150px]">Data/Hora</TableHead>
              <TableHead className="w-[100px]">Tipo</TableHead>
              <TableHead>Usuário</TableHead>
              <TableHead className="w-[120px]">Ação</TableHead>
              <TableHead className="w-[110px]">Entidade</TableHead>
              <TableHead>Descrição</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  Carregando...
                </TableCell>
              </TableRow>
            ) : logs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  Nenhum registro encontrado.
                </TableCell>
              </TableRow>
            ) : (
              logs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                    {log.created_at
                      ? format(new Date(log.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })
                      : '—'}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={log.log_type === 'error' ? 'destructive' : 'secondary'}
                      className="text-xs"
                    >
                      {logTypeLabel(log.log_type)}
                    </Badge>
                  </TableCell>
                  <TableCell>{log.user_name || '—'}</TableCell>
                  <TableCell>{actionLabel(log.action)}</TableCell>
                  <TableCell>{entityLabel(log.entity)}</TableCell>
                  <TableCell className="max-w-[300px]">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="block truncate cursor-default">{log.description}</span>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-sm">
                        <p className="whitespace-pre-wrap">{log.description}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">
            Página {page + 1} de {totalPages} ({totalCount} registros)
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
            >
              Anterior
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
            >
              Próxima
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Logs;
