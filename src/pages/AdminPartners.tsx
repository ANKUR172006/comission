import { useEffect, useState } from 'react'
import { api, money, type Partner } from '../api'
import {
  Button,
  Card,
  CardHeader,
  ConfirmDialog,
  EmptyState,
  Field,
  Input,
  Modal,
  Pill,
  TableWrap,
  Td,
  Th,
  Tr,
} from '../components/ui'

export default function AdminPartners() {
  const [partners, setPartners] = useState<Partner[]>([])
  const [error, setError] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Partner | null>(null)
  const [deleting, setDeleting] = useState<Partner | null>(null)

  const load = () =>
    api.partners
      .list()
      .then(setPartners)
      .catch((err) => setError((err as Error).message))

  useEffect(() => {
    load()
  }, [])

  const toggleActive = async (partner: Partner) => {
    setError('')
    try {
      await api.partners.update(partner.id, { active: !partner.active })
      await load()
    } catch (err) {
      setError((err as Error).message)
    }
  }

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader
          title="Partners"
          action={
            <Button
              variant="primary"
              onClick={() => {
                setEditing(null)
                setFormOpen(true)
              }}
            >
              + Add partner
            </Button>
          }
        />

        {error ? <p className="px-5 py-3 text-sm text-red-400">{error}</p> : null}

        {partners.length === 0 ? (
          <EmptyState message="No partners yet. Only partners you add here can sign in." />
        ) : (
          <TableWrap minWidth="min-w-[760px]">
            <thead>
              <tr className="border-b border-zinc-800">
                <Th>Partner</Th>
                <Th>Login email</Th>
                <Th>Status</Th>
                <Th right>Wallet total</Th>
                <Th right>Paid</Th>
                <Th right>Pending</Th>
                <Th right>Actions</Th>
              </tr>
            </thead>
            <tbody>
              {partners.map((partner) => (
                <Tr key={partner.id}>
                  <Td className="font-medium text-zinc-100">{partner.name}</Td>
                  <Td className="text-zinc-400">{partner.email}</Td>
                  <Td>
                    {partner.active ? <Pill tone="green">Active</Pill> : <Pill>Inactive</Pill>}
                  </Td>
                  <Td right className="font-medium text-zinc-100">
                    {money(partner.total, partner.currency)}
                  </Td>
                  <Td right className="text-emerald-400">
                    {money(partner.paid, partner.currency)}
                  </Td>
                  <Td right className="text-amber-400">
                    {money(partner.pending, partner.currency)}
                  </Td>
                  <Td right>
                    <div className="flex justify-end gap-2">
                      <Button
                        onClick={() => {
                          setEditing(partner)
                          setFormOpen(true)
                        }}
                      >
                        Edit
                      </Button>
                      <Button onClick={() => toggleActive(partner)}>
                        {partner.active ? 'Deactivate' : 'Activate'}
                      </Button>
                      <Button variant="danger" onClick={() => setDeleting(partner)}>
                        Delete
                      </Button>
                    </div>
                  </Td>
                </Tr>
              ))}
            </tbody>
          </TableWrap>
        )}
      </Card>

      <PartnerForm
        open={formOpen}
        editing={editing}
        onClose={() => setFormOpen(false)}
        onSaved={async () => {
          setFormOpen(false)
          await load()
        }}
        onError={setError}
      />

      <ConfirmDialog
        open={deleting !== null}
        title="Delete partner"
        message={
          deleting
            ? `Delete ${deleting.name}? They can no longer sign in and all of their commission entries will be removed.`
            : ''
        }
        onCancel={() => setDeleting(null)}
        onConfirm={async () => {
          if (!deleting) return
          try {
            await api.partners.remove(deleting.id)
            await load()
          } catch (err) {
            setError((err as Error).message)
          }
          setDeleting(null)
        }}
      />
    </div>
  )
}

function PartnerForm({
  open,
  editing,
  onClose,
  onSaved,
  onError,
}: {
  open: boolean
  editing: Partner | null
  onClose: () => void
  onSaved: () => void
  onError: (message: string) => void
}) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')

  const [lastOpen, setLastOpen] = useState(false)
  if (open !== lastOpen) {
    setLastOpen(open)
    if (open) {
      setName(editing?.name ?? '')
      setEmail(editing?.email ?? '')
    }
  }

  const save = async () => {
    try {
      if (editing) {
        await api.partners.update(editing.id, { name, email })
      } else {
        await api.partners.create({ name, email })
      }
      onSaved()
    } catch (err) {
      onError((err as Error).message)
      onClose()
    }
  }

  return (
    <Modal
      open={open}
      title={editing ? `Edit ${editing.name}` : 'Add partner'}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={save}>
            {editing ? 'Save changes' : 'Add partner'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Partner name">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Rahul" />
        </Field>
        <Field
          label="Login email"
          hint="The partner signs in with this email only — no password."
        >
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="partner@example.com"
          />
        </Field>
      </div>
    </Modal>
  )
}
