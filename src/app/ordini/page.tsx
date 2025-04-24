'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { Plus, Trash2, ChevronLeft, ChevronRight, Users } from 'lucide-react'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { TooltipProvider } from "@/components/ui/tooltip"
import { Badge } from "@/components/ui/badge"
import { OrderProducts } from './components/orderproduct'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'

type Order = {
  id: string
  order_number: string
  client: string
  client_name: string 
  created_at: string
  updated_at: string | null
  latest_delivery_date: string | null
  is_completed: boolean
  data_inserimento_ordine: string
}

type Client = {
  id: string
  ragione_sociale: string
}

const ITEMS_PER_PAGE = 30

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [totalOrders, setTotalOrders] = useState(0)
  const [currentPage, setCurrentPage] = useState(0)
  const [isClientView, setIsClientView] = useState(false)
  
  const [showSidebar, setShowSidebar] = useState(false)
  const [currentOrder, setCurrentOrder] = useState<Order | null>(null)
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false)
  const [orderToDelete, setOrderToDelete] = useState<Order | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    fetchOrders()
    fetchClients()
  }, [currentPage, searchTerm])

  const fetchOrders = async () => {
    try {
      // Get total count
      const { count, error: countError } = await supabase
        .from('ordini')
        .select('*', { count: 'exact', head: true })
        .ilike('order_number', `%${searchTerm}%`)

      if (countError) throw countError
      setTotalOrders(count || 0)

      // Get orders with products data
      const { data: ordersWithProducts, error: ordersError } = await supabase
        .from('ordini')
        .select(`
          *,
          clienti (
            ragione_sociale
          ),
          link_ordini_client_products (
            body,
            stato
          )
        `)
        .ilike('order_number', `%${searchTerm}%`)
        .range(currentPage * ITEMS_PER_PAGE, (currentPage + 1) * ITEMS_PER_PAGE - 1)

      if (ordersError) throw ordersError

      // Transform and sort the data
      const transformedData = ordersWithProducts.map(order => {
        const products = order.link_ordini_client_products || []
        //@ts-expect-error 123
        const nonCompletedProducts = products.filter(p => p.stato !== 'completato')
        
        // Find latest delivery date from non-completed products
        const latestDeliveryDate = nonCompletedProducts.length > 0
        //@ts-expect-error 123
          ? Math.max(...nonCompletedProducts.map(p => new Date(p.body.deliveryDate).getTime()))
          : null

        // Check if all products are completed
        //@ts-expect-error 123
        const isCompleted = products.length > 0 && products.every(p => p.stato === 'completato')

        return {
          ...order,
          client_name: order.clienti?.ragione_sociale || 'Cliente non trovato',
          latest_delivery_date: latestDeliveryDate ? new Date(latestDeliveryDate).toISOString() : null,
          is_completed: isCompleted
        }
      })

      // Sort by latest delivery date (null dates at the end)
      const sortedData = transformedData.sort((a, b) => {
        if (!a.latest_delivery_date && !b.latest_delivery_date) return 0
        if (!a.latest_delivery_date) return 1
        if (!b.latest_delivery_date) return -1
        return new Date(a.latest_delivery_date).getTime() - new Date(b.latest_delivery_date).getTime()
      })

      setOrders(sortedData)
    } catch (error) {
      console.error('Error fetching orders:', error)
      toast.error('Errore nel caricamento degli ordini')
    }
  }

  const fetchClients = async () => {
    try {
      const { data, error } = await supabase
        .from('clienti')
        .select('id, ragione_sociale')
        .order('ragione_sociale', { ascending: true })

      if (error) throw error
      setClients(data || [])
    } catch (error) {
      console.error('Error fetching clients:', error)
      toast.error('Errore nel caricamento dei clienti')
    }
  }

  const handleAddOrder = () => {
    setCurrentOrder({
      id: '',
      order_number: generateOrderNumber(),
      client: '',
      client_name: '',
      created_at: new Date().toISOString(),
      updated_at: null,
      latest_delivery_date: null,
      is_completed: false,
      data_inserimento_ordine: new Date().toISOString()
    })
    setShowSidebar(true)
  }

  const handleEditOrder = (order: Order) => {
    setCurrentOrder(order)
    setShowSidebar(true)
  }

  const handleDeleteOrder = (order: Order, e: React.MouseEvent) => {
    e.stopPropagation()
    setOrderToDelete(order)
    setShowDeleteConfirmation(true)
  }

  const generateOrderNumber = (): string => {
    const year = new Date().getFullYear()
    const letters = Array(3)
      .fill(0)
      .map(() => String.fromCharCode(65 + Math.floor(Math.random() * 26)))
      .join('')
    const numbers = Array(3)
      .fill(0)
      .map(() => Math.floor(Math.random() * 10))
      .join('')
    return `${year}/${letters}-${numbers}`
  }

  const confirmDeleteOrder = async () => {
    if (!orderToDelete) return

    setIsLoading(true)
    try {
      const { error } = await supabase
        .from('ordini')
        .delete()
        .eq('id', orderToDelete.id)

      if (error) throw error

      setOrders(orders.filter(o => o.id !== orderToDelete.id))
      setShowDeleteConfirmation(false)
      toast.success('Ordine eliminato con successo')
    } catch (error) {
      console.error('Error deleting order:', error)
      toast.error('Errore durante l\'eliminazione dell\'ordine')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSaveOrder = async (order: Order) => {
    setIsLoading(true)
    try {
      if (order.id) {
        const { error } = await supabase
          .from('ordini')
          .update({
            client: order.client,
            order_number: order.order_number,
            data_inserimento_ordine: order.data_inserimento_ordine,
            updated_at: new Date().toISOString()
          })
          .eq('id', order.id)

        if (error) throw error

        const updatedOrder = {
          ...order,
          client_name: clients.find(c => c.id === order.client)?.ragione_sociale || 'Cliente non trovato'
        }
        setOrders(orders.map(o => o.id === order.id ? updatedOrder : o))
        toast.success('Ordine aggiornato con successo')
      } else {
        const { data, error } = await supabase
          .from('ordini')
          .insert([{
            client: order.client,
            order_number: order.order_number,
            data_inserimento_ordine: order.data_inserimento_ordine
          }])
          .select()

        if (error) throw error

        if (data) {
          const newOrder = {
            ...data[0],
            client_name: clients.find(c => c.id === data[0].client)?.ragione_sociale || 'Cliente non trovato',
            latest_delivery_date: null,
            is_completed: false
          }
          setOrders([newOrder, ...orders])
          setCurrentOrder(newOrder)
          toast.success('Ordine creato con successo')
        }
      }
      
    } catch (error) {
      console.error('Error saving order:', error)
      toast.error('Errore durante il salvataggio dell\'ordine')
    } finally {
      setIsLoading(false)
    }
  }

  const toggleClientView = () => {
    setIsClientView(!isClientView)
  }

  // Grouped orders calculation using useMemo
  const groupedOrders = useMemo(() => {
    if (!isClientView) return null;
    
    return orders.reduce((acc, order) => {
      if (!acc[order.client_name]) {
        acc[order.client_name] = [];
      }
      acc[order.client_name].push(order);
      return acc;
    }, {} as Record<string, Order[]>);
  }, [orders, isClientView]);

  const renderOrders = () => {
    if (!isClientView) {
      return orders.map((order) => (
        <TableRow 
          key={order.id} 
          className="cursor-pointer transition-colors hover:bg-black hover:text-white group"
          onClick={() => handleEditOrder(order)}
        >
          <TableCell>{order.order_number}</TableCell>
          <TableCell>{order.client_name}</TableCell>
          <TableCell>{new Date(order.data_inserimento_ordine).toLocaleDateString()}</TableCell>
          <TableCell>
            {order.latest_delivery_date 
              ? new Date(order.latest_delivery_date).toLocaleDateString()
              : '-'}
          </TableCell>
          <TableCell className="flex gap-2 items-center justify-start min-w-40">
            <Button
              variant="ghost"
              size="icon"
              onClick={(e) => handleDeleteOrder(order, e)}
            >
              <Trash2 className="h-4 w-4 text-black group-hover:text-white hover:text-black" />
            </Button>
            {order.is_completed && (
              <Badge className="bg-green-200 text-green-800">
                evaso!
              </Badge>
            )}
          </TableCell>
        </TableRow>
      ));
    }

    // Vista raggruppata per cliente
    return groupedOrders ? Object.entries(groupedOrders).map(([clientName, clientOrders], groupIndex) => (
      <React.Fragment key={`group-${groupIndex}`}>
        <TableRow className="bg-gray-100">
          <TableCell colSpan={5} className="font-bold">
            {clientName} ({clientOrders.length} ordini)
          </TableCell>
        </TableRow>
        {clientOrders.map((order) => (
          <TableRow 
            key={order.id}
            className="cursor-pointer transition-colors hover:bg-black hover:text-white group"
            onClick={() => handleEditOrder(order)}
          >
            <TableCell>{order.order_number}</TableCell>
            <TableCell></TableCell>
            <TableCell>{new Date(order.data_inserimento_ordine).toLocaleDateString()}</TableCell>
            <TableCell>
              {order.latest_delivery_date 
                ? new Date(order.latest_delivery_date).toLocaleDateString()
                : '-'}
            </TableCell>
            <TableCell className="flex gap-2 items-center justify-start min-w-40">
              <Button
                variant="ghost"
                size="icon"
                onClick={(e) => handleDeleteOrder(order, e)}
              >
                <Trash2 className="h-4 w-4 text-black group-hover:text-white hover:text-black" />
              </Button>
              {order.is_completed && (
                <Badge className="bg-green-200 text-green-800">
                  evaso!
                </Badge>
              )}
            </TableCell>
          </TableRow>
        ))}
      </React.Fragment>
    )) : null;
  };

  const totalPages = Math.ceil(totalOrders / ITEMS_PER_PAGE)

  return (
    <TooltipProvider>
      <div className="container mx-auto p-4">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-2xl font-bold">Gestione Ordini</h1>
          <div className="flex gap-2">
            <Button onClick={toggleClientView} variant={isClientView ? "secondary" : "outline"}>
              <Users className="mr-2 h-4 w-4" /> Clienti
            </Button>
            <Button onClick={handleAddOrder}>
              <Plus className="mr-2 h-4 w-4" /> Nuovo Ordine
            </Button>
          </div>
        </div>
        
        <div className="flex gap-4 mb-4">
          <Input
            placeholder="Cerca ordine..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value)
              setCurrentPage(0)
            }}
            className="max-w-md"
          />
        </div>
        
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Ordine</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Data Inserimento</TableHead>
              <TableHead>Data Consegna</TableHead>
              <TableHead className="w-[100px]">Azioni</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {renderOrders()}
          </TableBody>
        </Table>

        <div className="flex items-center justify-between mt-4">
          <div className="text-sm text-gray-500">
            {orders.length} ordini
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={() => setCurrentPage(prev => Math.max(0, prev - 1))}
              disabled={currentPage === 0}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="flex items-center gap-2">
              <span className="text-sm">Pagina {currentPage + 1} di {totalPages}</span>
            </div>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setCurrentPage(prev => Math.min(totalPages - 1, prev + 1))}
              disabled={currentPage >= totalPages - 1}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <Sheet open={showSidebar} onOpenChange={setShowSidebar}>
          <SheetContent side="right" className="w-4/5 min-w-[80%] overflow-y-auto">
            <SheetHeader className="pb-4">
              <SheetTitle className="flex items-center gap-4">
                {currentOrder?.id ? `Modifica Ordine ${currentOrder.order_number}` : 'Nuovo Ordine'}
                {currentOrder?.is_completed && (
                  <Badge className="bg-green-200 text-green-800">
                    Ordine Evaso!
                  </Badge>
                )}
              </SheetTitle>
              <div className="flex justify-end gap-4 mt-6">
                <Button variant="outline" onClick={() => setShowSidebar(false)}>
                  Annulla
                </Button>
                <Button 
                  onClick={() => currentOrder && handleSaveOrder(currentOrder)}
                  disabled={isLoading}
                >
                  {isLoading ? 'Salvataggio...' : (currentOrder?.id ? 'Salva Modifiche' : 'Crea Ordine')}
                </Button>
              </div>
            </SheetHeader>
            <div className="grid grid-cols-2 gap-4 py-4">
              <div className="space-y-2">
                <label htmlFor="orderNumber" className="text-sm">Numero Ordine</label>
                <Input
                  id="orderNumber"
                  value={currentOrder?.order_number || ''}
                  onChange={(e) => setCurrentOrder(currentOrder ? 
                    { ...currentOrder, order_number: e.target.value } : null)}
                />
              </div>
              
              <div className="space-y-2">
                <label htmlFor="customer" className="text-sm">Cliente</label>
                <Select
                  value={currentOrder?.client || ''}
                  onValueChange={(value) => setCurrentOrder(currentOrder ? 
                    { ...currentOrder, client: value } : null)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleziona cliente" />
                  </SelectTrigger>
                  <SelectContent>
                    {clients.map(client => (
                      <SelectItem key={client.id} value={client.id}>
                        {client.ragione_sociale}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label htmlFor="dateInserted" className="text-sm">Data Inserimento</label>
                <div className="flex gap-2">
                  <Input
                    id="dateInserted"
                    type="date"
                    value={currentOrder?.data_inserimento_ordine ? new Date(currentOrder.data_inserimento_ordine).toISOString().split('T')[0] : ''}
                    onChange={(e) => setCurrentOrder(currentOrder ? 
                      { ...currentOrder, data_inserimento_ordine: new Date(e.target.value).toISOString() } : null)}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setCurrentOrder(currentOrder ? 
                      { ...currentOrder, data_inserimento_ordine: new Date().toISOString() } : null)}
                  >
                    Oggi
                  </Button>
                </div>
              </div>
            </div>
            
            <OrderProducts orderId={currentOrder?.id || ''} clientId={currentOrder?.client || ''} onUpdate={fetchOrders} />
            
          </SheetContent>
        </Sheet>

        <Dialog open={showDeleteConfirmation} onOpenChange={setShowDeleteConfirmation}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Conferma Eliminazione</DialogTitle>
              <DialogDescription>
                Vuoi davvero eliminare l&apos;ordine {orderToDelete?.order_number}? Questa azione è irreversibile.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowDeleteConfirmation(false)}>
                Annulla
              </Button>
              <Button 
                variant="destructive" 
                onClick={confirmDeleteOrder}
                disabled={isLoading}
              >
                {isLoading ? 'Eliminazione...' : 'Elimina'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  )
}