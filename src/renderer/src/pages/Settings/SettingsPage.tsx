import { useState } from 'react'
import {
  Button,
  Card,
  Form,
  Input,
  InputNumber,
  Popconfirm,
  Space,
  Switch,
  TimePicker,
  Typography,
  message
} from 'antd'
import {
  BellOutlined,
  ClearOutlined,
  DesktopOutlined,
  NotificationOutlined,
  PictureOutlined,
  SoundOutlined,
  SyncOutlined,
  TagsOutlined,
  UserOutlined,
  VideoCameraOutlined
} from '@ant-design/icons'
import dayjs from 'dayjs'
import styled from 'styled-components'
import { useQueryClient } from '@tanstack/react-query'
import { useSettings, useUpdateSettings } from '@renderer/hooks/useSettings'
import { useSecretsStatus, useSetGGDealsApiKey, useSetSteamApiKey } from '@renderer/hooks/useSecrets'
import { dismissAllInAppNotifications } from '@renderer/lib/notificationApi'

const { Title, Text } = Typography

const SettingsGrid = styled.div`
  column-count: 2;
  column-gap: 16px;

  > * {
    break-inside: avoid;
    margin-bottom: 16px;
  }

  @media (max-width: 900px) {
    column-count: 1;
  }
`

export function SettingsPage() {
  const { data: settings } = useSettings()
  const updateSettings = useUpdateSettings()
  const queryClient = useQueryClient()
  const { data: secretsStatus } = useSecretsStatus()
  const setSteamApiKey = useSetSteamApiKey()
  const setGGDealsApiKey = useSetGGDealsApiKey()
  const [overwritingAll, setOverwritingAll] = useState(false)
  const [testingNotifications, setTestingNotifications] = useState(false)
  const [clearingNotifications, setClearingNotifications] = useState(false)
  const [dismissingNotifications, setDismissingNotifications] = useState(false)

  const [steamId64Input, setSteamId64Input] = useState('')
  const [steamApiKeyInput, setSteamApiKeyInput] = useState('')
  const [ggDealsApiKeyInput, setGGDealsApiKeyInput] = useState('')

  if (!settings) return null

  const showError = (error: unknown): void => {
    message.error(error instanceof Error ? error.message : 'Algo deu errado.')
  }

  return (
    <div>
      <Title level={3}>Configurações</Title>

      <SettingsGrid>
        <Card
          title={
            <Space>
              <UserOutlined /> Conta Steam
            </Space>
          }
        >
          <Form layout="vertical">
            <Form.Item
              label="SteamID64"
              extra="Pode colar o número, a URL do perfil ou seu nome personalizado — o app resolve sozinho. Precisa estar público pra sincronização funcionar."
            >
              <Space.Compact style={{ width: '100%' }}>
                <Input
                  placeholder={settings.steamId64 ?? 'ex: 76561198000000000'}
                  value={steamId64Input}
                  onChange={(e) => setSteamId64Input(e.target.value)}
                />
                <Button
                  type="primary"
                  onClick={() =>
                    updateSettings.mutate({ steamId64: steamId64Input.trim() }, { onError: showError })
                  }
                  disabled={!steamId64Input}
                >
                  Salvar
                </Button>
              </Space.Compact>
            </Form.Item>

            <Form.Item
              label="Chave da Steam Web API"
              extra="Gere em steamcommunity.com/dev/apikey. Necessária pra sincronizar Minha Biblioteca e buscar conquistas."
            >
              <Space.Compact style={{ width: '100%' }}>
                <Input.Password
                  placeholder={
                    secretsStatus?.hasSteamApiKey ? '•••••••• (configurada)' : 'cole sua chave aqui'
                  }
                  value={steamApiKeyInput}
                  onChange={(e) => setSteamApiKeyInput(e.target.value)}
                />
                <Button
                  onClick={async () => {
                    try {
                      await setSteamApiKey.mutateAsync(steamApiKeyInput.trim())
                      setSteamApiKeyInput('')
                      message.success('Chave da Steam salva.')
                    } catch (error) {
                      showError(error)
                    }
                  }}
                  disabled={!steamApiKeyInput}
                >
                  Salvar
                </Button>
              </Space.Compact>
            </Form.Item>
          </Form>
        </Card>

        <Card
          title={
            <Space>
              <TagsOutlined /> GG.deals
            </Space>
          }
        >
          <Form layout="vertical">
            <Form.Item label="Chave da API do GG.deals" extra="Gere em gg.deals/api/">
              <Space.Compact style={{ width: '100%' }}>
                <Input.Password
                  placeholder={
                    secretsStatus?.hasGGDealsApiKey ? '•••••••• (configurada)' : 'cole sua chave aqui'
                  }
                  value={ggDealsApiKeyInput}
                  onChange={(e) => setGGDealsApiKeyInput(e.target.value)}
                />
                <Button
                  onClick={async () => {
                    try {
                      await setGGDealsApiKey.mutateAsync(ggDealsApiKeyInput.trim())
                      setGGDealsApiKeyInput('')
                      message.success('Chave do GG.deals salva.')
                    } catch (error) {
                      showError(error)
                    }
                  }}
                  disabled={!ggDealsApiKeyInput}
                >
                  Salvar
                </Button>
              </Space.Compact>
            </Form.Item>
          </Form>
        </Card>

        <Card
          title={
            <Space>
              <SyncOutlined /> Sincronização em background
            </Space>
          }
        >
          <Form layout="vertical">
            <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
              Os intervalos de cada timer (Ofertas, Wishlist, Biblioteca, Backfill) e os botões pra forçar
              cada busca na hora ficam na tela <strong>Fila de Chamadas</strong>, junto com o status ao vivo
              de cada um.
            </Text>

            <Form.Item
              label="Sobrescrever tudo"
              extra="Refaz a busca da Steam pra TODO mundo (biblioteca + ofertas), mesmo quem já tem metadata completa — útil pra pegar mudanças (capa nova, sinopse editada). Diferente do backfill (que só preenche o que falta), essa sempre busca de novo. Também reseta os timers de sincronização da biblioteca e de backfill, pra não rodarem de novo em cima dessa busca."
            >
              <Button
                icon={<SyncOutlined />}
                loading={overwritingAll}
                onClick={async () => {
                  setOverwritingAll(true)
                  try {
                    const result = await window.api.metadata.refreshAll()
                    void queryClient.invalidateQueries({ queryKey: ['deals'] })
                    void queryClient.invalidateQueries({ queryKey: ['wishlist-deals-cache'] })
                    void queryClient.invalidateQueries({ queryKey: ['metadata-cache'] })
                    message.success(
                      `Metadata sobrescrita: ${result.refreshed} jogo(s) (${result.failed} falha(s)). ${result.synced} oferta(s) sincronizada(s).`
                    )
                  } catch (error) {
                    showError(error)
                  } finally {
                    setOverwritingAll(false)
                  }
                }}
              >
                Sobrescrever tudo
              </Button>
            </Form.Item>
          </Form>
        </Card>

        <Card
          title={
            <Space>
              <BellOutlined /> Notificações
            </Space>
          }
        >
          <Form layout="vertical">
            <Form.Item
              label="Desconto mínimo pra notificar"
              extra="A partir de quantos % de desconto (efetivo, comparado ao preço cheio da Steam, ou o desconto ativo na própria Steam) uma oferta deve notificar. Independente do filtro de exibição do Dashboard."
            >
              <InputNumber
                min={0}
                max={95}
                addonAfter="%"
                value={settings.polling.notifyMinDiscountPercent}
                onChange={(value) =>
                  value !== null &&
                  updateSettings.mutate({
                    polling: { ...settings.polling, notifyMinDiscountPercent: value }
                  })
                }
              />
            </Form.Item>

            <Form.Item
              label="Notificar também no menor preço histórico"
              extra="Notifica mesmo quando o desconto não atinge o mínimo acima, se o preço atual já é o menor que o GG.deals já registrou pra esse jogo."
            >
              <Switch
                checked={settings.polling.notifyOnHistoricalLow}
                onChange={(checked) =>
                  updateSettings.mutate({ polling: { ...settings.polling, notifyOnHistoricalLow: checked } })
                }
              />
            </Form.Item>

            <Form.Item label="Modo silencioso (não notificar)">
              <Space>
                <TimePicker
                  format="HH:mm"
                  placeholder="Início"
                  value={
                    settings.polling.quietHoursStart ? dayjs(settings.polling.quietHoursStart, 'HH:mm') : null
                  }
                  onChange={(value) =>
                    updateSettings.mutate({
                      polling: { ...settings.polling, quietHoursStart: value ? value.format('HH:mm') : null }
                    })
                  }
                />
                <Text>até</Text>
                <TimePicker
                  format="HH:mm"
                  placeholder="Fim"
                  value={
                    settings.polling.quietHoursEnd ? dayjs(settings.polling.quietHoursEnd, 'HH:mm') : null
                  }
                  onChange={(value) =>
                    updateSettings.mutate({
                      polling: { ...settings.polling, quietHoursEnd: value ? value.format('HH:mm') : null }
                    })
                  }
                />
              </Space>
            </Form.Item>

            <Form.Item
              label="Testar notificação"
              extra="Dispara 3 notificações de mentira, espaçadas, pra você ver o visual. Respeita o modo silencioso configurado acima."
            >
              <Button
                icon={<NotificationOutlined />}
                loading={testingNotifications}
                onClick={async () => {
                  setTestingNotifications(true)
                  try {
                    await window.api.notifications.test()
                  } catch (error) {
                    showError(error)
                  } finally {
                    setTestingNotifications(false)
                  }
                }}
              >
                Disparar 3 notificações de teste
              </Button>
            </Form.Item>

            <Form.Item
              label="Limpar notificações"
              extra="Fecha na hora as notificações que ainda estão na tela (do Windows e dentro do app) — útil quando dispara um monte de uma vez. Não muda o que já foi notificado."
            >
              <Button
                icon={<ClearOutlined />}
                loading={dismissingNotifications}
                onClick={async () => {
                  setDismissingNotifications(true)
                  try {
                    dismissAllInAppNotifications()
                    await window.api.notifications.dismissAll()
                    message.success('Notificações fechadas.')
                  } catch (error) {
                    showError(error)
                  } finally {
                    setDismissingNotifications(false)
                  }
                }}
              >
                Limpar notificações
              </Button>
            </Form.Item>

            <Form.Item
              label="Esquecer o que já foi notificado"
              extra="Zera o histórico de preços já notificados — ofertas que ainda qualificam podem notificar de novo na próxima busca, mesmo sem cair mais de preço. Não fecha nada que já esteja na tela."
            >
              <Popconfirm
                title="Esquecer todo o histórico de notificações?"
                okText="Esquecer"
                cancelText="Cancelar"
                onConfirm={async () => {
                  setClearingNotifications(true)
                  try {
                    await window.api.notifications.clearHistory()
                    message.success('Histórico de notificações esquecido.')
                  } catch (error) {
                    showError(error)
                  } finally {
                    setClearingNotifications(false)
                  }
                }}
              >
                <Button icon={<ClearOutlined />} loading={clearingNotifications} danger>
                  Esquecer histórico
                </Button>
              </Popconfirm>
            </Form.Item>
          </Form>
        </Card>

        <Card
          title={
            <Space>
              <DesktopOutlined /> Geral
            </Space>
          }
        >
          <Form layout="vertical">
            <Form.Item label="Iniciar com o Windows (minimizado na bandeja)">
              <Switch
                checked={settings.autoStartOnBoot}
                onChange={(checked) => updateSettings.mutate({ autoStartOnBoot: checked })}
              />
            </Form.Item>

            <Form.Item
              label={
                <Space>
                  <PictureOutlined /> Baixar capa/screenshots localmente
                </Space>
              }
              extra="Ao resolver a metadata de um jogo, baixa a capa, os screenshots e as miniaturas dos trailers pro seu computador, em vez de depender da Steam toda vez que você abre a tela. Só vale pra metadata resolvida depois de ligar essa opção — o que já está em cache não muda sozinho."
            >
              <Switch
                checked={settings.downloadImagesLocally}
                onChange={(checked) => updateSettings.mutate({ downloadImagesLocally: checked })}
              />
            </Form.Item>

            <Form.Item
              label={
                <Space>
                  <VideoCameraOutlined /> Baixar trailers localmente
                </Space>
              }
              extra="Baixa o vídeo completo de cada trailer pro seu computador, em vez de assistir direto da Steam. Pode ocupar bastante espaço em disco (vários MB por trailer, multiplicado por todos os jogos da sua biblioteca) — deixe desligado se não tiver espaço sobrando. Independente do toggle de capa/screenshots acima."
            >
              <Switch
                checked={settings.downloadTrailersLocally}
                onChange={(checked) => updateSettings.mutate({ downloadTrailersLocally: checked })}
              />
            </Form.Item>

            <Form.Item
              label={
                <Space>
                  <SoundOutlined /> Volume inicial dos vídeos (%)
                </Space>
              }
              extra="Com que volume os trailers já começam a tocar quando você abre um."
            >
              <InputNumber
                min={0}
                max={100}
                value={settings.defaultVideoVolumePercent}
                onChange={(value) =>
                  value !== null && updateSettings.mutate({ defaultVideoVolumePercent: value })
                }
              />
            </Form.Item>
          </Form>
        </Card>
      </SettingsGrid>
    </div>
  )
}
