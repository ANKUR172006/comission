import { useEffect, type ReactNode } from 'react'

/* ---------- layout ---------- */

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl border border-zinc-800 bg-zinc-900/60 ${className}`}>
      {children}
    </div>
  )
}

export function CardHeader({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800 px-5 py-4">
      <h2 className="text-sm font-semibold tracking-wide text-zinc-200 uppercase">{title}</h2>
      {action}
    </div>
  )
}

export function StatCard({
  label,
  value,
  hint,
  tone = 'default',
}: {
  label: string
  value: string | number
  hint?: string
  tone?: 'default' | 'green' | 'orange'
}) {
  const toneClass =
    tone === 'green' ? 'text-emerald-400' : tone === 'orange' ? 'text-amber-400' : 'text-zinc-50'
  return (
    <Card className="p-5">
      <p className="text-xs font-medium tracking-wide text-zinc-500 uppercase">{label}</p>
      <p className={`mt-2 text-2xl font-semibold ${toneClass}`}>{value}</p>
      {hint ? <p className="mt-1 text-xs text-zinc-500">{hint}</p> : null}
    </Card>
  )
}

/* ---------- buttons ---------- */

type ButtonProps = {
  children: ReactNode
  onClick?: () => void
  type?: 'button' | 'submit'
  variant?: 'primary' | 'secondary' | 'danger' | 'success' | 'ghost'
  disabled?: boolean
  className?: string
}

export function Button({
  children,
  onClick,
  type = 'button',
  variant = 'secondary',
  disabled = false,
  className = '',
}: ButtonProps) {
  const styles: Record<string, string> = {
    primary: 'bg-zinc-100 text-zinc-900 border-zinc-100 hover:bg-white',
    secondary: 'bg-zinc-900 text-zinc-200 border-zinc-700 hover:bg-zinc-800',
    danger: 'bg-transparent text-red-400 border-red-900 hover:bg-red-950/50',
    success: 'bg-emerald-600 text-white border-emerald-600 hover:bg-emerald-500',
    ghost: 'bg-transparent text-zinc-400 border-transparent hover:bg-zinc-800',
  }
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center justify-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-40 ${styles[variant]} ${className}`}
    >
      {children}
    </button>
  )
}

export function Badge({ paid }: { paid: boolean }) {
  if (paid) {
    return (
      <span className="inline-flex items-center rounded-full bg-emerald-950/60 px-2 py-0.5 text-xs font-medium text-emerald-400 ring-1 ring-emerald-800 ring-inset">
        Paid
      </span>
    )
  }
  return (
    <span className="inline-flex items-center rounded-full bg-amber-950/50 px-2 py-0.5 text-xs font-medium text-amber-400 ring-1 ring-amber-800 ring-inset">
      Unpaid
    </span>
  )
}

export function Pill({ children, tone = 'zinc' }: { children: ReactNode; tone?: string }) {
  const tones: Record<string, string> = {
    zinc: 'bg-zinc-800 text-zinc-300 ring-zinc-700',
    green: 'bg-emerald-950/60 text-emerald-400 ring-emerald-800',
    orange: 'bg-amber-950/50 text-amber-400 ring-amber-800',
    blue: 'bg-sky-950/50 text-sky-400 ring-sky-800',
  }
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${tones[tone]}`}
    >
      {children}
    </span>
  )
}

/* ---------- form fields ---------- */

export function Field({
  label,
  children,
  hint,
}: {
  label: string
  children: ReactNode
  hint?: string
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-zinc-400">{label}</span>
      {children}
      {hint ? <span className="mt-1 block text-xs text-zinc-500">{hint}</span> : null}
    </label>
  )
}

const inputClass =
  'w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-zinc-500'

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${inputClass} ${props.className ?? ''}`} />
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select {...props} className={`${inputClass} ${props.className ?? ''}`}>
      {props.children}
    </select>
  )
}

export function Checkbox({
  checked,
  onChange,
  label,
}: {
  checked: boolean
  onChange: (value: boolean) => void
  label: string
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-300">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 rounded border-zinc-600 bg-zinc-950 accent-zinc-200"
      />
      {label}
    </label>
  )
}

/* ---------- dialogs ---------- */

export function Modal({
  open,
  title,
  onClose,
  children,
  footer,
}: {
  open: boolean
  title: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/70 p-4 sm:p-8">
      <div className="mx-auto w-full max-w-lg rounded-xl border border-zinc-800 bg-zinc-900">
        <div className="flex items-center justify-between border-b border-zinc-800 px-5 py-4">
          <h2 className="text-base font-semibold text-zinc-100">{title}</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg px-2 py-1 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200"
          >
            ✕
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
        {footer ? (
          <div className="flex flex-wrap justify-end gap-2 border-t border-zinc-800 px-5 py-4">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  )
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Delete',
  onConfirm,
  onCancel,
}: {
  open: boolean
  title: string
  message: ReactNode
  confirmLabel?: string
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <Modal
      open={open}
      title={title}
      onClose={onCancel}
      footer={
        <>
          <Button onClick={onCancel}>Cancel</Button>
          <Button variant="danger" onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="text-sm text-zinc-400">{message}</div>
    </Modal>
  )
}

/* ---------- tables + misc ---------- */

export function TableWrap({ children, minWidth }: { children: ReactNode; minWidth: string }) {
  return (
    <div className="overflow-x-auto">
      <table className={`w-full ${minWidth} text-sm`}>{children}</table>
    </div>
  )
}

export function Th({ children, right = false }: { children?: ReactNode; right?: boolean }) {
  return (
    <th
      className={`px-5 py-3 text-xs font-medium tracking-wide text-zinc-500 uppercase ${
        right ? 'text-right' : 'text-left'
      }`}
    >
      {children}
    </th>
  )
}

export function Td({
  children,
  right = false,
  className = '',
}: {
  children?: ReactNode
  right?: boolean
  className?: string
}) {
  return (
    <td className={`px-5 py-3 ${right ? 'text-right' : ''} ${className}`}>{children}</td>
  )
}

export function Tr({ children }: { children: ReactNode }) {
  return <tr className="border-b border-zinc-800 last:border-0 hover:bg-zinc-800/40">{children}</tr>
}

export function EmptyState({ message }: { message: string }) {
  return <div className="px-5 py-10 text-center text-sm text-zinc-500">{message}</div>
}
