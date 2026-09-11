import { Layout, Menu } from 'antd'
import {
  AppstoreOutlined,
  DatabaseOutlined,
  HeartOutlined,
  HistoryOutlined,
  SettingOutlined
} from '@ant-design/icons'
import { Link, Outlet, useLocation } from 'react-router-dom'
import styled from 'styled-components'
import { appTheme } from '@renderer/theme/theme'

const { Sider, Content, Header } = Layout

const StyledHeader = styled(Header)`
  background: ${({ theme }) => theme.colors.surface};
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};
  display: flex;
  align-items: center;
  padding: 0 24px;
  font-size: 16px;
  font-weight: 600;
`

const StyledContent = styled(Content)`
  padding: 24px;
  overflow-y: auto;
`

const SiderInner = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
`

const Brand = styled.div`
  padding: 20px 16px;
  font-weight: 700;
  font-size: 18px;
`

const MenuArea = styled.div`
  flex: 1;
  overflow-y: auto;
`

const SiderFooter = styled.div`
  padding: 12px 16px;
  font-size: 12px;
  color: ${({ theme }) => theme.colors.textMuted};
  border-top: 1px solid ${({ theme }) => theme.colors.border};
`

const menuItems = [
  { key: '/', icon: <AppstoreOutlined />, label: <Link to="/">Ofertas</Link> },
  { key: '/library', icon: <DatabaseOutlined />, label: <Link to="/library">Minha Biblioteca</Link> },
  { key: '/wishlist', icon: <HeartOutlined />, label: <Link to="/wishlist">Wishlist</Link> },
  { key: '/history', icon: <HistoryOutlined />, label: <Link to="/history">Histórico</Link> },
  { key: '/settings', icon: <SettingOutlined />, label: <Link to="/settings">Configurações</Link> }
]

export function AppLayout() {
  const location = useLocation()
  const selectedKey =
    menuItems.find((item) => location.pathname.startsWith(item.key) && item.key !== '/')?.key ?? '/'

  return (
    <Layout style={{ height: '100vh' }}>
      <Sider width={220} theme="dark" style={{ borderRight: `1px solid ${appTheme.colors.border}` }}>
        <SiderInner>
          <Brand>GamePriceAnalyzer</Brand>
          <MenuArea>
            <Menu theme="dark" mode="inline" selectedKeys={[selectedKey]} items={menuItems} />
          </MenuArea>
          <SiderFooter>medranogit</SiderFooter>
        </SiderInner>
      </Sider>
      <Layout>
        <StyledHeader>Ofertas de jogos, sem repetir o que você já tem</StyledHeader>
        <StyledContent>
          <Outlet />
        </StyledContent>
      </Layout>
    </Layout>
  )
}
