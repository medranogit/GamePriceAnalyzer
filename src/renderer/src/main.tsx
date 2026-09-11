import ReactDOM from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ConfigProvider, theme as antdTheme } from 'antd'
import ptBR from 'antd/locale/pt_BR'
import { ThemeProvider } from 'styled-components'
import { App } from './App'
import { appTheme } from './theme/theme'
import { GlobalStyle } from './theme/GlobalStyle'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      refetchOnWindowFocus: false
    }
  }
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <ConfigProvider
    locale={ptBR}
    theme={{
      algorithm: antdTheme.darkAlgorithm,
      token: {
        colorPrimary: appTheme.colors.primary,
        colorBgBase: appTheme.colors.background,
        borderRadius: 8
      }
    }}
  >
    <ThemeProvider theme={appTheme}>
      <GlobalStyle />
      <QueryClientProvider client={queryClient}>
        <HashRouter>
          <App />
        </HashRouter>
      </QueryClientProvider>
    </ThemeProvider>
  </ConfigProvider>
)
