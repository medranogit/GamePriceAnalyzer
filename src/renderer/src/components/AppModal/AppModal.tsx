import type { ReactNode } from 'react'
import { Modal } from 'antd'

interface AppModalProps {
  open: boolean
  title?: ReactNode
  onClose: () => void
  onOk?: () => void
  okText?: string
  cancelText?: string
  confirmLoading?: boolean
  danger?: boolean
  width?: number
  /** Sobrescreve o footer padrão. Passe `null` pra não mostrar footer nenhum. */
  footer?: ReactNode
  children: ReactNode
}

export function AppModal({
  open,
  title,
  onClose,
  onOk,
  okText = 'Confirmar',
  cancelText = 'Cancelar',
  confirmLoading = false,
  danger = false,
  width,
  footer,
  children
}: AppModalProps) {
  return (
    <Modal
      open={open}
      title={title}
      onCancel={onClose}
      onOk={onOk}
      okText={okText}
      cancelText={cancelText}
      confirmLoading={confirmLoading}
      okButtonProps={danger ? { danger: true } : undefined}
      width={width}
      footer={footer !== undefined ? footer : onOk ? undefined : null}
      centered
      destroyOnClose
    >
      {children}
    </Modal>
  )
}
