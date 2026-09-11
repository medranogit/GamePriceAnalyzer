import { useState } from 'react'
import {
  Button,
  Card,
  Divider,
  Form,
  Input,
  InputNumber,
  Space,
  Switch,
  TimePicker,
  Typography,
  message
} from 'antd'
import { NotificationOutlined, SyncOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { useSettings, useUpdateSettings } from '@renderer/hooks/useSettings'
import { useSecretsStatus, useSetGGDealsApiKey, useSetSteamApiKey } from '@renderer/hooks/useSecrets'

const { Title, Text } = Typography

export function SettingsPage() {
  const { data: settings } = useSettings()
  const updateSettings = useUpdateSettings()
  const { data: secretsStatus } = useSecretsStatus()
  const setSteamApiKey = useSetSteamApiKey()
  const setGGDealsApiKey = useSetGGDealsApiKey()
  const [testingNotifications, setTestingNotifications] = useState(false)
  const [checkingDealsNow, setCheckingDealsNow] = useState(false)

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

      <Card title="Conta Steam" style={{ marginBottom: 16 }}>
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

          <Form.Item label="Chave da Steam Web API" extra="Gere em steamcommunity.com/dev/apikey">
            <Space.Compact style={{ width: '100%' }}>
              <Input.Password
                placeholder={secretsStatus?.hasSteamApiKey ? '•••••••• (configurada)' : 'cole sua chave aqui'}
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

      <Card title="GG.deals" style={{ marginBottom: 16 }}>
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

      <Card title="Verificação em background">
        <Form layout="vertical">
          <Form.Item label="Intervalo de checagem (minutos)">
            <InputNumber
              min={5}
              max={240}
              value={settings.polling.intervalMinutes}
              onChange={(value) =>
                value && updateSettings.mutate({ polling: { ...settings.polling, intervalMinutes: value } })
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
                value={settings.polling.quietHoursEnd ? dayjs(settings.polling.quietHoursEnd, 'HH:mm') : null}
                onChange={(value) =>
                  updateSettings.mutate({
                    polling: { ...settings.polling, quietHoursEnd: value ? value.format('HH:mm') : null }
                  })
                }
              />
            </Space>
          </Form.Item>

          <Form.Item
            label="Procurar ofertas agora"
            extra="Roda uma busca imediata na wishlist inteira, sem esperar o próximo ciclo automático."
          >
            <Button
              icon={<SyncOutlined />}
              loading={checkingDealsNow}
              onClick={async () => {
                setCheckingDealsNow(true)
                try {
                  await window.api.polling.triggerNow()
                  message.success('Busca de ofertas concluída.')
                } catch (error) {
                  showError(error)
                } finally {
                  setCheckingDealsNow(false)
                }
              }}
            >
              Procurar ofertas agora
            </Button>
          </Form.Item>

          <Divider />

          <Form.Item label="Iniciar com o Windows (minimizado na bandeja)">
            <Switch
              checked={settings.autoStartOnBoot}
              onChange={(checked) => updateSettings.mutate({ autoStartOnBoot: checked })}
            />
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
        </Form>
      </Card>
    </div>
  )
}
