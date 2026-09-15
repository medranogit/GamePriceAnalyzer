import { useEffect, useState } from 'react'
import { Button, InputNumber, Modal, Tooltip, Typography, message } from 'antd'
import {
  ApiOutlined,
  ClockCircleOutlined,
  CloudOutlined,
  SyncOutlined,
  WarningOutlined
} from '@ant-design/icons'
import styled from 'styled-components'
import dayjs from 'dayjs'
import { useQueryClient } from '@tanstack/react-query'
import type { QueueEntry, QueueSource, TimerStatus } from '@shared/types'
import {
  useGGDealsQueue,
  useGGDealsQuota,
  useSteamMetadataQueue,
  useTimersStatus
} from '@renderer/hooks/useQueues'
import { useSessionLogEntries, useSessionLogSessions } from '@renderer/hooks/useSessionLog'
import { useSettings, useUpdateSettings } from '@renderer/hooks/useSettings'
import { useSyncSteamWishlist } from '@renderer/hooks/useWishlist'
import { useSyncLibrary } from '@renderer/hooks/useLibrary'
import { METADATA_RESOLVE_STATUS_KEY, useMetadataResolveStatus } from '@renderer/hooks/useMetadata'
import { SessionLogLines } from '@renderer/components/SessionLogLines/SessionLogLines'
import { formatCountdown } from '@renderer/lib/formatters'

const { Title, Text } = Typography

type IntervalField =
  | 'intervalMinutes'
  | 'wishlistSyncIntervalMinutes'
  | 'librarySyncIntervalMinutes'
  | 'metadataBackfillIntervalMinutes'

const TIMER_INTERVAL_FIELD: Record<string, IntervalField> = {
  ofertas: 'intervalMinutes',
  wishlist: 'wishlistSyncIntervalMinutes',
  biblioteca: 'librarySyncIntervalMinutes',
  backfill: 'metadataBackfillIntervalMinutes'
}

const TIMER_FORCE_TOOLTIP: Record<string, string> = {
  ofertas:
    'Busca preço no GG.deals pra toda a wishlist agora, sem esperar o próximo ciclo. Conta pro limite de 1000 registros/hora da conta.',
  wishlist:
    'Sincroniza sua wishlist com a Steam agora (o que foi adicionado/removido), sem esperar o próximo ciclo.',
  biblioteca:
    'Confere jogos novos na sua biblioteca Steam agora e já busca a metadata deles, sem esperar o próximo ciclo.',
  backfill:
    'Varre biblioteca + ofertas atrás de metadata faltando (capa, gênero, trailer etc.) agora, sem esperar o próximo ciclo.'
}

const TIMER_INTERVAL_TOOLTIP =
  'Intervalo entre execuções automáticas, em minutos. Mudar o valor já reseta a contagem a partir de agora.'

function showError(error: unknown): void {
  message.error(error instanceof Error ? error.message : 'Algo deu errado.')
}

const SectionTitle = styled.h3`
  margin: 0 0 12px;
`

const TimersGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 12px;
  margin-bottom: 24px;
`

const TimerCard = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 12px;
  background: ${({ theme }) => theme.colors.surfaceRaised};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: 10px;
  padding: 12px 14px;
`

const TimerIconBadge = styled.div<{ $running: boolean }>`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  flex-shrink: 0;
  border-radius: 50%;
  font-size: 16px;
  color: ${({ $running, theme }) => ($running ? theme.colors.primary : theme.colors.textMuted)};
  background: ${({ $running, theme }) => ($running ? theme.colors.primary : theme.colors.textMuted)}26;
`

const TimerBody = styled.div`
  flex: 1;
  min-width: 0;
`

const TimerLabel = styled(Text)`
  &&& {
    display: block;
    font-weight: 600;
    font-size: 13px;
  }
`

const TimerDetail = styled(Text)`
  &&& {
    display: block;
    color: ${({ theme }) => theme.colors.textMuted};
    font-size: 12px;
  }
`

const TimerControls = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 8px;
`

const QueueCard = styled.div`
  background: ${({ theme }) => theme.colors.surfaceRaised};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: 10px;
  padding: 16px;
  margin-bottom: 20px;
`

const QueueTitle = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  margin-bottom: 12px;
`

const Bar = styled.div`
  display: flex;
  height: 56px;
  border-radius: 8px;
  overflow: hidden;
  background: ${({ theme }) => theme.colors.background};
  border: 1px solid ${({ theme }) => theme.colors.border};
`

const GroupBar = styled.div<{ $running: boolean }>`
  flex: 1 1 0;
  min-width: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 2px;
  padding: 0 14px;
  background: ${({ $running, theme }) => ($running ? theme.colors.primary : theme.colors.primaryHover)};
  opacity: ${({ $running }) => ($running ? 1 : 0.6)};

  & + & {
    border-left: 1px solid rgba(0, 0, 0, 0.25);
  }
`

const GroupSource = styled.div`
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  color: rgba(255, 255, 255, 0.75);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`

const GroupLabel = styled.div`
  font-size: 13px;
  font-weight: 600;
  color: #fff;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`

const EmptyBar = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  padding: 0 16px;
  color: ${({ theme }) => theme.colors.textMuted};
  font-size: 13px;
`

const LogPanel = styled.div`
  height: 320px;
  overflow-y: auto;
  background: ${({ theme }) => theme.colors.surface};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: 10px;
  padding: 12px 16px;
  font-family: 'Cascadia Code', Consolas, monospace;
  font-size: 13px;
  line-height: 1.7;
`

function TimerStatusCard({ timer }: { timer: TimerStatus }) {
  // O snapshot do timer só muda de verdade quando ele roda de novo (a cada minutos) — sem esse
  // ticker próprio, o "Próxima em: Xmin Ys" ficaria parado entre uma resposta e outra do polling
  // (o react-query nem re-renderiza sozinho, já que o conteúdo do array não muda a cada 1s).
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timerId = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timerId)
  }, [])

  const { data: settings } = useSettings()
  const updateSettings = useUpdateSettings()
  const queryClient = useQueryClient()
  const syncWishlist = useSyncSteamWishlist()
  const syncLibrary = useSyncLibrary()
  const { data: resolveStatus } = useMetadataResolveStatus()
  const resolvingMetadata = resolveStatus?.resolving ?? false
  const [forcingOfertas, setForcingOfertas] = useState(false)
  const { data: quota } = useGGDealsQuota()

  const lastRunAt = timer.lastRunAt ? dayjs(timer.lastRunAt) : null
  const nextRunAtMs = timer.lastRunAt
    ? new Date(timer.lastRunAt).getTime() + timer.intervalMinutes * 60_000
    : null
  const remainingMs = nextRunAtMs !== null ? nextRunAtMs - now : 0

  const intervalField = TIMER_INTERVAL_FIELD[timer.key]
  const intervalValue = settings ? settings.polling[intervalField] : timer.intervalMinutes

  const handleIntervalChange = (value: number | null): void => {
    if (!value || !settings) return
    updateSettings.mutate({ polling: { ...settings.polling, [intervalField]: value } })
  }

  const handleMaxDealsPerCycleChange = (value: number | null): void => {
    if (!value || !settings) return
    updateSettings.mutate({ polling: { ...settings.polling, maxDealsPerCycle: value } })
  }

  const handleDealsBatchCountChange = (value: number | null): void => {
    if (!value || !settings) return
    updateSettings.mutate({ polling: { ...settings.polling, dealsBatchCount: value } })
  }

  const forceOfertas = async (): Promise<void> => {
    setForcingOfertas(true)
    try {
      await window.api.polling.triggerNow()
      void queryClient.invalidateQueries({ queryKey: ['deals'] })
      void queryClient.invalidateQueries({ queryKey: ['wishlist-deals-cache'] })
      message.success('Busca de ofertas concluída.')
    } catch (error) {
      showError(error)
    } finally {
      setForcingOfertas(false)
      void queryClient.invalidateQueries({ queryKey: ['timers'] })
    }
  }

  const forceBackfill = async (): Promise<void> => {
    queryClient.setQueryData(METADATA_RESOLVE_STATUS_KEY, { resolving: true })
    try {
      const result = await window.api.metadata.resolveMissing()
      void queryClient.invalidateQueries({ queryKey: ['deals'] })
      void queryClient.invalidateQueries({ queryKey: ['wishlist-deals-cache'] })
      void queryClient.invalidateQueries({ queryKey: ['metadata-cache'] })
      message.success(
        `Metadata resolvida: ${result.resolved} jogo(s) novo(s) (${result.failed} falha(s)). ${result.synced} oferta(s) sincronizada(s).`
      )
    } catch (error) {
      showError(error)
    } finally {
      void queryClient.invalidateQueries({ queryKey: METADATA_RESOLVE_STATUS_KEY })
    }
  }

  const handleForceClick = (): void => {
    switch (timer.key) {
      case 'ofertas':
        Modal.confirm({
          title: 'Forçar busca de ofertas agora?',
          icon: <WarningOutlined />,
          content:
            'Isso conta pro limite de 1000 registros/hora da conta do GG.deals. Forçar fora do horário do timer com frequência pode estourar essa cota — só confirme se realmente precisar ver um preço atualizado agora.',
          okText: 'Forçar mesmo assim',
          cancelText: 'Cancelar',
          onOk: forceOfertas
        })
        return
      case 'wishlist':
        syncWishlist.mutate(undefined, { onError: showError })
        return
      case 'biblioteca':
        syncLibrary.mutate(undefined, { onError: showError })
        return
      case 'backfill':
        void forceBackfill()
        return
    }
  }

  // `timer.running` vem do scheduler de verdade (main process) — cobre o caso de a sincronização ter
  // sido disparada por outra tela (Minha Biblioteca/Wishlist), não só pelo botão deste card.
  const isForcing =
    timer.key === 'backfill'
      ? resolvingMetadata
      : timer.key === 'wishlist'
        ? syncWishlist.isPending || timer.running
        : timer.key === 'biblioteca'
          ? syncLibrary.isPending || timer.running
          : forcingOfertas || timer.running

  return (
    <TimerCard>
      <TimerIconBadge $running={timer.running}>
        <ClockCircleOutlined />
      </TimerIconBadge>
      <TimerBody>
        <TimerLabel>{timer.label}</TimerLabel>
        <TimerDetail>
          {timer.running
            ? 'Rodando agora'
            : `Próxima em: ${nextRunAtMs !== null ? formatCountdown(remainingMs) : '—'}`}
        </TimerDetail>
        <TimerDetail>Última: {lastRunAt ? lastRunAt.format('DD/MM HH:mm') : '—'}</TimerDetail>
        {timer.key === 'ofertas' && (
          <Tooltip title="Estimativa a partir da última resposta real do GG.deals nesta sessão — não persiste entre reinícios do app. Use pra calibrar 'jogos por ciclo' sem estourar o limite de 1000/hora da conta.">
            <TimerDetail>
              Cota GG.deals:{' '}
              {quota?.remaining != null
                ? `${quota.limit - quota.remaining}/${quota.limit} usados`
                : '— (sem chamada nesta sessão ainda)'}
            </TimerDetail>
          </Tooltip>
        )}

        <TimerControls>
          <Tooltip title={TIMER_INTERVAL_TOOLTIP}>
            <InputNumber
              size="small"
              min={5}
              max={240}
              value={intervalValue}
              onChange={handleIntervalChange}
              addonAfter="min"
              style={{ width: 90 }}
            />
          </Tooltip>
          {timer.key === 'ofertas' && (
            <Tooltip title="Máximo de AppIDs consultados no GG.deals por ciclo automático — deixa uma folga do limite de 1000 registros/hora da conta pra forçar buscas manuais sem estourar a cota. O que passar do limite entra primeiro no próximo ciclo.">
              <InputNumber
                size="small"
                min={50}
                max={1000}
                step={50}
                value={settings?.polling.maxDealsPerCycle}
                onChange={handleMaxDealsPerCycleChange}
                addonAfter="jogos"
                style={{ width: 115 }}
              />
            </Tooltip>
          )}
          {timer.key === 'ofertas' && (
            <Tooltip title="Em quantos lotes dividir os jogos por ciclo — cada lote vira uma chamada HTTP separada ao GG.deals (o tamanho de cada um é calculado automaticamente e nunca passa do limite real da API, 100). Mais lotes = mais granularidade na Fila de Chamadas/log, mesma cota total consumida.">
              <InputNumber
                size="small"
                min={1}
                max={5}
                step={1}
                value={settings?.polling.dealsBatchCount}
                onChange={handleDealsBatchCountChange}
                addonAfter="lotes"
                style={{ width: 105 }}
              />
            </Tooltip>
          )}
          <Tooltip title={TIMER_FORCE_TOOLTIP[timer.key]}>
            <Button size="small" icon={<SyncOutlined />} loading={isForcing} onClick={handleForceClick} />
          </Tooltip>
          {timer.key === 'backfill' && resolvingMetadata && (
            <Tooltip title="Cancela a busca de metadata em andamento assim que possível.">
              <Button
                size="small"
                danger
                onClick={() => {
                  window.api.metadata.cancelResolve().catch(showError)
                }}
              >
                Cancelar
              </Button>
            </Tooltip>
          )}
        </TimerControls>
      </TimerBody>
    </TimerCard>
  )
}

const QUEUE_SOURCE_LABELS: Record<QueueSource, string> = {
  ofertas: 'Ofertas',
  wishlist: 'Wishlist',
  biblioteca: 'Biblioteca',
  backfill: 'Backfill de metadata',
  refresh: 'Sobrescrever tudo',
  manual: 'Busca manual'
}

interface SourceGroup {
  key: string
  source: QueueSource | null
  itemLabel: string
  /** Quantos itens dessa MESMA origem estão na fila agora — mostrado como "(+N)" em vez de virar um
   * segmento por item (o que lotava a barra inteira quando um timer só, como o backfill, enfileira
   * dezenas de DLCs cosméticas de uma vez). */
  count: number
  running: boolean
}

/**
 * Agrupa por origem (qual timer pediu aquela busca) — cada origem vira UMA barra só, mesmo que tenha
 * dezenas de itens esperando. A ordem de execução real não muda (continua sendo estritamente a ordem de
 * chegada, de um por vez, dentro do ThrottledGameMetadataRepository); isso aqui é só a forma de exibir.
 * Quem está executando de verdade fica na barra mais à esquerda.
 */
function groupBySource(entries: QueueEntry[]): SourceGroup[] {
  const order: string[] = []
  const bySource = new Map<string, QueueEntry[]>()
  for (const entry of entries) {
    const key = entry.source ?? 'geral'
    if (!bySource.has(key)) {
      order.push(key)
      bySource.set(key, [])
    }
    bySource.get(key)?.push(entry)
  }

  const groups = order.map((key): SourceGroup => {
    const items = bySource.get(key) ?? []
    const runningItem = items.find((item) => item.status === 'running')
    const representative = runningItem ?? items[0]
    return {
      key,
      source: representative.source ?? null,
      itemLabel: representative.label,
      count: items.length,
      running: runningItem !== undefined
    }
  })

  groups.sort((a, b) => Number(b.running) - Number(a.running))
  return groups
}

function QueueBar({ entries }: { entries: QueueEntry[] }) {
  if (entries.length === 0) {
    return (
      <Bar>
        <EmptyBar>Fila vazia — nada esperando agora.</EmptyBar>
      </Bar>
    )
  }

  const groups = groupBySource(entries)

  return (
    <Bar>
      {groups.map((group) => (
        <GroupBar key={group.key} $running={group.running} title={group.itemLabel}>
          {group.source && <GroupSource>{QUEUE_SOURCE_LABELS[group.source]}</GroupSource>}
          <GroupLabel>
            {group.itemLabel}
            {group.count > 1 ? ` (+${group.count - 1})` : ''}
          </GroupLabel>
        </GroupBar>
      ))}
    </Bar>
  )
}

export function CallQueuePage() {
  const { data: timers = [] } = useTimersStatus()
  const { data: ggDealsQueue = [] } = useGGDealsQueue()
  const { data: steamMetadataQueue = [] } = useSteamMetadataQueue()
  const { data: sessions = [] } = useSessionLogSessions()
  const currentSession = sessions.find((session) => session.status === 'running') ?? sessions[0] ?? null
  const { data: logEntries = [] } = useSessionLogEntries(currentSession?.id ?? null)
  const logEntriesNewestFirst = [...logEntries].reverse()

  return (
    <div>
      <Title level={3}>Fila de Chamadas</Title>

      <SectionTitle>Timers</SectionTitle>
      <TimersGrid>
        {timers.map((timer) => (
          <TimerStatusCard key={timer.key} timer={timer} />
        ))}
      </TimersGrid>

      <SectionTitle>Filas</SectionTitle>
      <Text type="secondary" style={{ display: 'block', marginBottom: 20 }}>
        Ordem ao vivo das chamadas às APIs externas — o item mais à esquerda é o próximo a rodar (ou já
        rodando agora). Sem histórico: assim que termina, sai da fila.
      </Text>

      <QueueCard>
        <QueueTitle>
          <CloudOutlined /> GG.deals
        </QueueTitle>
        <QueueBar entries={ggDealsQueue} />
      </QueueCard>

      <QueueCard>
        <QueueTitle>
          <ApiOutlined /> Steam Metadata
        </QueueTitle>
        <QueueBar entries={steamMetadataQueue} />
      </QueueCard>

      <SectionTitle>Log</SectionTitle>
      <Text type="secondary" style={{ display: 'block', marginBottom: 12 }}>
        O que cada timer trouxe de verdade (jogo por jogo) na sessão atual — capa, sinopse, quantos
        screenshots/trailers foram encontrados etc.
      </Text>
      <LogPanel>
        <SessionLogLines entries={logEntriesNewestFirst} />
      </LogPanel>
    </div>
  )
}
