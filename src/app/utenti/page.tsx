'use client'

import { useEffect, useState } from 'react'
import { Plus, Trash2, Clock, KeyRound, HelpCircle, LayoutDashboard, Users, Building2, ClipboardList, Factory, Truck, ArrowsUpFromLine, PrinterCheck, Check } from 'lucide-react'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { supabase } from '@/lib/supabase'

type User = {
  id: string
  name: string
  email: string | undefined
  role: 'admin' | 'collaboratore' | 'operatore'
  registration_status?: 'pending' | 'active'
  otp?: string
  otp_expires_at?: string
}

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([])
  const [currentUser, setCurrentUser] = useState<string | null>(null)
  const [newUser, setNewUser] = useState({ name: '', email: '', role: 'collaboratore' })
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [showOtpDialog, setShowOtpDialog] = useState(false)
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [showResetConfirmation, setShowResetConfirmation] = useState(false)
  const [userToReset, setUserToReset] = useState<User | null>(null)
  const [showPermissionsDialog, setShowPermissionsDialog] = useState(false)
  
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false)
  const [userToDelete, setUserToDelete] = useState<User | null>(null)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [userToEdit, setUserToEdit] = useState<User | null>(null)

  const permissionsMap = {
    admin: [
      { name: 'Dashboard', icon: LayoutDashboard },
      { name: 'Utenti', icon: Users },
      { name: 'Clienti', icon: Building2 },
      { name: 'Ordini', icon: ClipboardList },
      { name: 'Produzione', icon: Factory },
      { name: 'Carichi', icon: Truck },
      { name: 'Carichi del giorno', icon: ArrowsUpFromLine },
      { name: 'DDT', icon: PrinterCheck }
    ],
    collaboratore: [
      { name: 'Produzione', icon: Factory },
      { name: 'Carichi', icon: Truck },
      { name: 'Carichi del giorno', icon: ArrowsUpFromLine }
    ],
    operatore: [
      { name: 'Produzione', icon: Factory },
      { name: 'Carichi del giorno', icon: ArrowsUpFromLine }
    ]
  }

  useEffect(() => {
    fetchUsers()
    getCurrentUser()
  }, [])

  const getCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      setCurrentUser(user.id)
    }
  }

  const fetchUsers = async () => {
    try {
      const response = await fetch('/api/users')
      const data = await response.json()
      
      if (!response.ok) throw new Error(data.error)
      
      setUsers(data)
    } catch (error) {
      console.error('Error fetching users:', error)
    }
  }

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault()
    if (newUser.name && newUser.email) {
      try {
        const response = await fetch('/api/users', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(newUser)
        })
        
        const data = await response.json()
        if (!response.ok) throw new Error(data.error)

        await fetchUsers()
        setNewUser({ name: '', email: '', role: 'collaboratore' })
        setShowAddDialog(false)
        
      } catch (error) {
        console.error('Error adding user:', error)
      }
    }
  }

  const handleDeleteUser = (user: User) => {
    setUserToDelete(user)
    setShowDeleteConfirmation(true)
  }

  const handleResetPassword = (user: User) => {
    setUserToReset(user)
    setShowResetConfirmation(true)
  }

  const confirmResetPassword = async () => {
    if (userToReset) {
      try {
        const response = await fetch('/api/reset-password', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ id: userToReset.id })
        })
        
        const data = await response.json()
        if (!response.ok) throw new Error(data.error)

        await fetchUsers()
        setShowResetConfirmation(false)
        
        // Mostra l'OTP generato
        const updatedUser = data.user
        setSelectedUser(updatedUser)
        setShowOtpDialog(true)
      } catch (error) {
        console.error('Error resetting password:', error)
      }
    }
  }

  const confirmDeleteUser = async () => {
    if (userToDelete) {
      try {
        const response = await fetch('/api/users', {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ id: userToDelete.id })
        })
        
        const data = await response.json()
        if (!response.ok) throw new Error(data.error)

        await fetchUsers()
        setShowDeleteConfirmation(false)
      } catch (error) {
        console.error('Error deleting user:', error)
      }
    }
  }

  const handleUserClick = (user: User) => {
    if (user.registration_status === 'pending') {
      setSelectedUser(user)
      setShowOtpDialog(true)
    } else {
      handleEditUser(user)
    }
  }

  const handleEditUser = (user: User) => {
    setUserToEdit(user)
    setShowEditDialog(true)
  }

  const saveEditedUser = async () => {
    if (userToEdit) {
      try {
        const response = await fetch('/api/users', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            id: userToEdit.id,
            name: userToEdit.name,
            role: userToEdit.role
          })
        })
        
        const data = await response.json()
        if (!response.ok) throw new Error(data.error)

        await fetchUsers()
        setShowEditDialog(false)
      } catch (error) {
        console.error('Error updating user:', error)
      }
    }
  }

  const isOtpExpired = (expiresAt: string | undefined) => {
    if (!expiresAt) return true
    return new Date(expiresAt) < new Date()
  }

  return (
    <div className="container mx-auto p-4">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">Gestione Utenti</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowPermissionsDialog(true)}>
            <HelpCircle className="mr-2 h-4 w-4" /> Permessi
          </Button>
          <Button onClick={() => setShowAddDialog(true)}>
            <Plus className="mr-2 h-4 w-4" /> Aggiungi Utente
          </Button>
        </div>
      </div>
      
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nome</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Ruolo</TableHead>
            <TableHead>Stato</TableHead>
            <TableHead className="w-[150px]">Azioni</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.map((user) => (
            <TableRow 
              key={user.id} 
              className="cursor-pointer transition-colors hover:bg-black hover:text-white group"
              onClick={() => handleUserClick(user)}
            >
              <TableCell className="rounded-l-lg">{user.name}</TableCell>
              <TableCell>{user.email}</TableCell>
              <TableCell>{user.role}</TableCell>
              <TableCell>
                {user.registration_status === 'pending' && (
                  <Badge variant="outline" className="bg-yellow-100 text-yellow-800">
                    <Clock className="mr-1 h-3 w-3" />
                    Pending
                  </Badge>
                )}
                {user.registration_status === 'active' && (
                  <Badge variant="outline" className="bg-green-100 text-green-800">
                    <Check className="mr-1 h-3 w-3" />
                    Attivo
                  </Badge>
                )}
              </TableCell>
              <TableCell className="rounded-r-lg">
                <div className="flex gap-2">
                  {user.registration_status === 'active' && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="transition-opacity"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleResetPassword(user)
                      }}
                    >
                      <KeyRound className="h-4 w-4 text-black group-hover:text-white hover:text-black" />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="transition-opacity"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleDeleteUser(user)
                    }}
                  >
                    <Trash2 className="h-4 w-4 text-black group-hover:text-white hover:text-black" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Aggiungi Nuovo Utente</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAddUser}>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <label htmlFor="name" className="text-right">
                  Nome
                </label>
                <Input
                  id="name"
                  value={newUser.name}
                  onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                  className="col-span-3"
                  required
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <label htmlFor="email" className="text-right">
                  Email
                </label>
                <Input
                  id="email"
                  type="email"
                  value={newUser.email}
                  onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                  className="col-span-3"
                  required
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <label htmlFor="role" className="text-right">
                  Ruolo
                </label>
                <Select
                  value={newUser.role}
                  onValueChange={(value) => setNewUser({ ...newUser, role: value })}
                >
                  <SelectTrigger className="col-span-3">
                    <SelectValue placeholder="Seleziona ruolo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="collaboratore">Collaboratore</SelectItem>
                    <SelectItem value="operatore">Operatore</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button type="submit">Aggiungi</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={showOtpDialog} onOpenChange={setShowOtpDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Codice OTP</DialogTitle>
            <DialogDescription>
              Codice di registrazione per {selectedUser?.email}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="rounded-lg bg-gray-100 p-4 text-center">
              <p className="text-2xl font-mono">{selectedUser?.otp}</p>
              {selectedUser?.otp_expires_at && (
                <p className="text-sm text-gray-500 mt-2">
                  {isOtpExpired(selectedUser.otp_expires_at) 
                    ? "OTP Scaduto" 
                    : `Scade il ${new Date(selectedUser.otp_expires_at).toLocaleString()}`}
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setShowOtpDialog(false)}>Chiudi</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showDeleteConfirmation} onOpenChange={setShowDeleteConfirmation}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Conferma Eliminazione</DialogTitle>
            <DialogDescription>
              Vuoi davvero eliminare {userToDelete?.name} dall&apos;accesso alla piattaforma? Questa azione è irreversibile.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteConfirmation(false)}>Annulla</Button>
            <Button variant="destructive" onClick={confirmDeleteUser}>Elimina</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modifica Utente</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <label htmlFor="edit-name" className="text-right">
                Nome
              </label>
              <Input
                id="edit-name"
                value={userToEdit?.name || ''}
                onChange={(e) => setUserToEdit(userToEdit ? { ...userToEdit, name: e.target.value } : null)}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <label htmlFor="edit-email" className="text-right">
                Email
              </label>
              <Input
                id="edit-email"
                value={userToEdit?.email || ''}
                disabled
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <label htmlFor="edit-role" className="text-right">
                Ruolo
              </label>
              <Select
                value={userToEdit?.role}
                onValueChange={(value) => setUserToEdit(userToEdit ? { ...userToEdit, role: value as 'admin' | 'collaboratore' | 'operatore' } : null)}
                disabled={currentUser === userToEdit?.id}
              >
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="Seleziona ruolo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="collaboratore">Collaboratore</SelectItem>
                  <SelectItem value="operatore">Operatore</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>Annulla</Button>
            <Button onClick={saveEditedUser}>Salva</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Nuovo Dialog per conferma reset password */}
      <Dialog open={showResetConfirmation} onOpenChange={setShowResetConfirmation}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Conferma Reset Password</DialogTitle>
            <DialogDescription>
              Vuoi davvero reimpostare la password per {userToReset?.name}? 
              Verrà generato un nuovo codice OTP temporaneo e l&apos;utente dovrà effettuare nuovamente la registrazione.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowResetConfirmation(false)}>Annulla</Button>
            <Button variant="destructive" onClick={confirmResetPassword}>Reset Password</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showPermissionsDialog} onOpenChange={setShowPermissionsDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Mappa dei Permessi</DialogTitle>
            <DialogDescription>
              Visualizza le pagine accessibili per ogni ruolo utente
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-3 gap-4 mt-4">
            {Object.entries(permissionsMap).map(([role, permissions]) => (
              <div key={role} className="border rounded-lg p-4">
                <h3 className="font-semibold mb-2 capitalize">{role}</h3>
                <div className="space-y-2">
                  {permissions.map((permission) => (
                    <div key={permission.name} className="flex items-center gap-2">
                      <permission.icon className="h-4 w-4" />
                      <span className="text-sm">{permission.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}