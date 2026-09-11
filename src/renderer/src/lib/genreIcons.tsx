import type { ReactNode } from 'react'
import {
  BulbOutlined,
  CarOutlined,
  CrownOutlined,
  DeploymentUnitOutlined,
  ExperimentOutlined,
  FireOutlined,
  GiftOutlined,
  GlobalOutlined,
  PictureOutlined,
  RocketOutlined,
  SmileOutlined,
  SoundOutlined,
  TagOutlined,
  TeamOutlined,
  ThunderboltOutlined,
  ToolOutlined,
  TrophyOutlined,
  WarningOutlined
} from '@ant-design/icons'

const GENRE_ICONS: Record<string, ReactNode> = {
  Ação: <ThunderboltOutlined />,
  Aventura: <GlobalOutlined />,
  RPG: <CrownOutlined />,
  Estratégia: <DeploymentUnitOutlined />,
  Simulação: <ExperimentOutlined />,
  Esportes: <TrophyOutlined />,
  Corrida: <CarOutlined />,
  Casual: <SmileOutlined />,
  Indie: <BulbOutlined />,
  'Multijogador Massivo': <TeamOutlined />,
  'Acesso Antecipado': <RocketOutlined />,
  'Gratuitos para Jogar': <GiftOutlined />,
  Terror: <WarningOutlined />,
  Luta: <FireOutlined />,
  'Design e Ilustração': <PictureOutlined />,
  Utilitários: <ToolOutlined />,
  'Áudio de produção': <SoundOutlined />
}

const FALLBACK_ICON = <TagOutlined />

export function getGenreIcon(genreName: string): ReactNode {
  return GENRE_ICONS[genreName] ?? FALLBACK_ICON
}
