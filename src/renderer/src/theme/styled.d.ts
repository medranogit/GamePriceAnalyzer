import 'styled-components'
import type { AppTheme } from './theme'

declare module 'styled-components' {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type -- declaration merging pra tipar o theme do styled-components
  export interface DefaultTheme extends AppTheme {}
}
