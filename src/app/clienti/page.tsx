'use client'

import { useState, useEffect } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { CustomerProducts } from './components/product'
import { supabase } from '@/lib/supabase'
import { toast } from "sonner"

type Customer = {
  id: string
  ragione_sociale: string
  partita_iva: string
  email: string
  telefono: string
  addresses: string[]
}

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [showSidebar, setShowSidebar] = useState(false)
  const [currentCustomer, setCurrentCustomer] = useState<Customer | null>(null)
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false)
  const [customerToDelete, setCustomerToDelete] = useState<Customer | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [hasChanges, setHasChanges] = useState(false)


  // Fetch customers on component mount
  useEffect(() => {
    fetchCustomers()
  }, [])

  const fetchCustomers = async () => {
    try {
      const { data, error } = await supabase
        .from('clienti')
        .select('*')
        .order('ragione_sociale', { ascending: true })

      if (error) throw error

      setCustomers(data || [])
    } catch (error) {
      console.error('Error fetching customers:', error)
      toast.error('Errore nel caricamento dei clienti')
    } finally {
      setLoading(false)
    }
  }

  const handleAddCustomer = () => {
    setCurrentCustomer({
      id: '',
      ragione_sociale: '',
      partita_iva: '',
      email: '',
      telefono: '',
      addresses: []
    })
    setHasChanges(false) // Resetta lo stato dei cambiamenti
    setShowSidebar(true)
  }

  const handleEditCustomer = (customer: Customer) => {
    setCurrentCustomer(customer)
    setHasChanges(false) 
    setShowSidebar(true)
  }

  const handleDeleteCustomer = async (customer: Customer, e: React.MouseEvent) => {
    e.stopPropagation()
    setCustomerToDelete(customer)
    setShowDeleteConfirmation(true)
  }

  const confirmDeleteCustomer = async () => {
    if (customerToDelete) {
      try {
        const { error } = await supabase
          .from('clienti')
          .delete()
          .eq('id', customerToDelete.id)

        if (error) throw error

        setCustomers(customers.filter(c => c.id !== customerToDelete.id))
        toast.success('Cliente eliminato con successo')
      } catch (error) {
        console.error('Error deleting customer:', error)
        toast.error('Errore durante l\'eliminazione del cliente')
      }
      setShowDeleteConfirmation(false)
    }
  }

  const handleSaveCustomer = async (customer: Customer) => {
    try {
      if (customer.id) {
        // Update existing customer
        const { error } = await supabase
          .from('clienti')
          .update({
            ragione_sociale: customer.ragione_sociale,
            partita_iva: customer.partita_iva,
            email: customer.email,
            telefono: customer.telefono,
            addresses: customer.addresses
          })
          .eq('id', customer.id)

        if (error) throw error

        setCustomers(customers.map(c => c.id === customer.id ? customer : c))
        toast.success('Cliente aggiornato con successo')
      } else {
        // Add new customer
        const { data, error } = await supabase
          .from('clienti')
          .insert({
            ragione_sociale: customer.ragione_sociale,
            partita_iva: customer.partita_iva,
            email: customer.email,
            telefono: customer.telefono,
            addresses: customer.addresses || []
          })
          .select()

        if (error) throw error

        if (data) {
          setCustomers([...customers, data[0]])
          toast.success('Cliente creato con successo')
        }
      }
      setHasChanges(false)
      setShowSidebar(false)
    } catch (error) {
      console.error('Error saving customer:', error)
      toast.error('Errore durante il salvataggio del cliente')
    }
  }

  const filteredCustomers = customers.filter(customer => 
    customer.ragione_sociale.toLowerCase().includes(searchTerm.toLowerCase()) ||
    customer.partita_iva.toLowerCase().includes(searchTerm.toLowerCase()) ||
    customer.email.toLowerCase().includes(searchTerm.toLowerCase())
  )

  if (loading) {
    return <div className="flex items-center justify-center h-screen">Caricamento...</div>
  }

  return (
    <div className="container mx-auto p-4">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">Gestione Clienti</h1>
        <Button onClick={handleAddCustomer}>
          <Plus className="mr-2 h-4 w-4" /> Aggiungi Cliente
        </Button>
      </div>
      <div className="mb-4">
        <Input
          placeholder="Cerca per nome, partita IVA o email..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="max-w-md"
        />
      </div>
      
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Ragione Sociale</TableHead>
            <TableHead>Partita IVA</TableHead>
            <TableHead>Email</TableHead>
            <TableHead className="w-[100px]">Azioni</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filteredCustomers.map((customer) => (
            <TableRow 
              key={customer.id} 
              className="cursor-pointer transition-colors hover:bg-black hover:text-white group"
              onClick={() => handleEditCustomer(customer)}
            >
              <TableCell className="rounded-l-lg">{customer.ragione_sociale}</TableCell>
              <TableCell>{customer.partita_iva}</TableCell>
              <TableCell>{customer.email}</TableCell>
              <TableCell className="rounded-r-lg">
                <Button
                  variant="ghost"
                  size="icon"
                  className="transition-opacity"
                  onClick={(e) => handleDeleteCustomer(customer, e)}
                >
                  <Trash2 className="h-4 w-4 text-black group-hover:text-white hover:text-black" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Sheet open={showSidebar} onOpenChange={setShowSidebar}>
        <SheetContent side="right" className="w-4/5 min-w-[80%]">
          <SheetHeader>
            <SheetTitle>
              {currentCustomer?.id ? currentCustomer?.ragione_sociale : 'Nuovo Cliente'}
            </SheetTitle>
            <div className="flex justify-end gap-4 mt-6">
              <Button variant="outline" onClick={() => setShowSidebar(false)}>
                Annulla
              </Button>
              <Button 
                onClick={() => currentCustomer && handleSaveCustomer(currentCustomer)}
                disabled={!hasChanges}
              >
                {currentCustomer?.id ? 'Salva Modifiche' : 'Crea Cliente'}
              </Button>
            </div>
          </SheetHeader>
          <div className="grid grid-cols-2 gap-2 py-4">
            <div className="space-y-2">
              <label htmlFor="ragione_sociale" className="text-sm">
                Ragione Sociale
              </label>
              <Input
                id="ragione_sociale"
                placeholder="Ragione sociale"
                value={currentCustomer?.ragione_sociale || ''}
                onChange={(e) => {
                  setCurrentCustomer(currentCustomer ? 
                    { ...currentCustomer, ragione_sociale: e.target.value } : null)
                  setHasChanges(true)
                }}
              />
            </div>
            
            <div className="space-y-2">
              <label htmlFor="partita_iva" className="text-sm">
                Partita IVA
              </label>
              <Input
                id="partita_iva"
                placeholder="Partita IVA"
                value={currentCustomer?.partita_iva || ''}
                onChange={(e) => {
                  setCurrentCustomer(currentCustomer ? 
                    { ...currentCustomer, partita_iva: e.target.value } : null)
                  setHasChanges(true)
                }}
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="email" className="text-sm">
                Email
              </label>
              <Input
                id="email"
                type="email"
                placeholder="Email"
                value={currentCustomer?.email || ''}
                onChange={(e) => {
                  setCurrentCustomer(currentCustomer ? 
                    { ...currentCustomer, email: e.target.value } : null)
                  setHasChanges(true)
                }}
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="telefono" className="text-sm">
                Telefono
              </label>
              <Input
                id="telefono"
                placeholder="Telefono"
                value={currentCustomer?.telefono || ''}
                onChange={(e) => {
                  setCurrentCustomer(currentCustomer ? 
                    { ...currentCustomer, telefono: e.target.value } : null)
                  setHasChanges(true)
                }}
              />
            </div>
          </div>

          {currentCustomer && (
            <CustomerProducts clientId={currentCustomer.id} />
          )}
          
        </SheetContent>
      </Sheet>

      <Dialog open={showDeleteConfirmation} onOpenChange={setShowDeleteConfirmation}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Conferma Eliminazione</DialogTitle>
            <DialogDescription>
              Vuoi davvero eliminare {customerToDelete?.ragione_sociale} dalla piattaforma? 
              Questa azione è irreversibile.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteConfirmation(false)}>
              Annulla
            </Button>
            <Button variant="destructive" onClick={confirmDeleteCustomer}>
              Elimina
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}