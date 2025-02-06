'use client'

import React from 'react'
import { useState, useMemo, useEffect } from 'react'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { format, parseISO } from 'date-fns'
import { it } from 'date-fns/locale'
import { Trash2, Plus, Calendar as CalendarIcon } from 'lucide-react'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "@/hooks/use-toast"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import { supabase } from '@/lib/supabase'
import debounce from 'lodash/debounce'

interface Consegna {
  data: string
  note: string
}

interface CaricoDB {
  id: number
  codice_raggruppamento: string | null
  body: {
    quantity: number
    deliveryDate: string
    note?: string
    consegne?: Consegna[]
    completedAt?: {
      timestamp: string
      user: string
    }
  }
  ordini: {
    id: string
    order_number: string
    client: {
      ragione_sociale: string
    }
  }
  client_products: {
    name: string
    body: {
      dimensions?: string
      heatTreated?: boolean
    }
  }
}

interface Carico {
  orderNumber: string
  cliente: string
  prodotto: string
  productDimensions: string
  heatTreated: boolean
  quantita: number
  dataConsegna: string
  consegne: Consegna[]
  note: string
  linkId: number
  codice_raggruppamento: string | null
  body?: {
    quantity: number
    deliveryDate: string
    note?: string
    consegne?: Consegna[]
    completedAt?: {
      timestamp: string
      user: string
    }
  }
}

export default function CarichiComponent() {
  const [carichi, setCarichi] = useState<Carico[]>([])
  const [date, setDate] = useState<Date>(new Date())
  const [dialogOpen, setDialogOpen] = useState(false)
  const [caricoSelezionato, setCaricoSelezionato] = useState<number | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchCarichi = async () => {
    try {
      setIsLoading(true)
      setError(null)

      const { data, error } = await supabase
        .from('link_ordini_client_products')
        .select(`
          id,
          body,
          codice_raggruppamento,
          ordini (
            id,
            order_number,
            client (
              ragione_sociale
            )
          ),
          client_products (
            name,
            body
          )
        `)
        .in('stato', ['consegna', 'pronto_consegna']) as { data: CaricoDB[] | null, error: unknown }

      if (error) throw error

      if (!data) {
        setCarichi([])
        return
      }

      const formattedCarichi = data
        .filter(item => {
          return item?.ordini?.client?.ragione_sociale && 
                 item?.client_products?.name && 
                 item?.body?.quantity && 
                 item?.body?.deliveryDate &&
                 item?.ordini?.order_number
        })
        .map(item => ({
          orderNumber: item.ordini.order_number,
          cliente: item.ordini.client.ragione_sociale,
          prodotto: item.client_products.name,
          productDimensions: item.client_products.body?.dimensions || '',
          heatTreated: item.client_products.body?.heatTreated || false,
          quantita: item.body.quantity,
          dataConsegna: item.body.deliveryDate,
          consegne: item.body.consegne || [],
          note: item.body.note || '',
          linkId: item.id,
          codice_raggruppamento: item.codice_raggruppamento,
          body: item.body
        }))

      setCarichi(formattedCarichi)
    } catch (err) {
      console.error('Error fetching deliveries:', err)
      setError('Errore nel caricamento dei carichi')
    } finally {
      setIsLoading(false)
    }
  }

  const debouncedUpdate = useMemo(
    () => debounce(async (linkId: number, nuoveNote: string, carico: Carico) => {
      try {
        const updatedBody = {
          ...carico.body,
          note: nuoveNote
        }
    
        const { error } = await supabase
          .from('link_ordini_client_products')
          .update({ body: updatedBody })
          .eq('id', linkId)
    
        if (error) throw error
      } catch (err) {
        console.error('Error updating notes:', err)
        toast({
          title: "Errore",
          description: "Impossibile aggiornare le note",
        })
      }
    }, 500),
    []
  )

  useEffect(() => {
    return () => {
      debouncedUpdate.cancel()
    }
  }, [debouncedUpdate])

  useEffect(() => {
    fetchCarichi()
  }, [])

  const apriDialog = (id: number) => {
    setCaricoSelezionato(id)
    setDialogOpen(true)
  }

  const chiudiDialog = () => {
    setDialogOpen(false)
    setCaricoSelezionato(null)
    setDate(new Date())
  }

  const aggiungiConsegna = async (linkId: number, nuovaConsegna: Consegna) => {
    try {
      const carico = carichi.find(c => c.linkId === linkId)
      if (!carico) return

      const updatedBody = {
        ...carico.body,
        consegne: [...(carico.body?.consegne || []), nuovaConsegna]
      }

      const { error } = await supabase
        .from('link_ordini_client_products')
        .update({ body: updatedBody })
        .eq('id', linkId)

      if (error) throw error

      setCarichi(carichi.map(carico => 
        carico.linkId === linkId ? { ...carico, consegne: [...carico.consegne, nuovaConsegna] } : carico
      ))

      toast({
        title: "Consegna registrata",
        description: `Consegna del ${format(parseISO(nuovaConsegna.data), 'dd/MM/yyyy', { locale: it })}${nuovaConsegna.note ? ` - Note: ${nuovaConsegna.note}` : ''}`,
      })
      chiudiDialog()
    } catch (err) {
      console.error('Error adding delivery:', err)
      toast({
        title: "Errore",
        description: "Impossibile registrare la consegna",
      })
    }
  }

  const eliminaConsegna = async (linkId: number, indexConsegna: number) => {
    try {
      const carico = carichi.find(c => c.linkId === linkId)
      if (!carico) return
  
      const nuoveConsegne = carico.consegne.filter((_, index) => index !== indexConsegna)
      
      const updatedBody = {
        ...carico.body,
        consegne: nuoveConsegne
      }
  
      const { error } = await supabase
        .from('link_ordini_client_products')
        .update({ body: updatedBody })
        .eq('id', linkId)
  
      if (error) throw error
  
      setCarichi(carichi.map(carico => 
        carico.linkId === linkId ? { ...carico, consegne: nuoveConsegne } : carico
      ))
  
      toast({
        title: "Consegna eliminata",
        description: "La consegna è stata eliminata con successo",
      })
    } catch (err) {
      console.error('Error deleting delivery:', err)
      toast({
        title: "Errore",
        description: "Impossibile eliminare la consegna",
      })
    }
  }

  const isFirstInGroup = (currentCarico: Carico, index: number, carichi: Carico[]) => {
    if (!currentCarico.codice_raggruppamento) return false;
    return index === 0 || carichi[index - 1].codice_raggruppamento !== currentCarico.codice_raggruppamento;
  }

  const isLastInGroup = (currentCarico: Carico, index: number, carichi: Carico[]) => {
    if (!currentCarico.codice_raggruppamento) return false;
    return index === carichi.length - 1 || carichi[index + 1].codice_raggruppamento !== currentCarico.codice_raggruppamento;
  }

  const carichiOrdinati = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
  
    const filtered = carichi.filter(carico => {
      const deliveryDate = new Date(carico.dataConsegna)
      deliveryDate.setHours(0, 0, 0, 0)
      return deliveryDate.getTime() === today.getTime()
    })

    const grouped = filtered.reduce((acc, carico) => {
      if (!carico.codice_raggruppamento) {
        acc.ungrouped.push(carico)
        return acc
      }
      
      if (!acc.grouped[carico.codice_raggruppamento]) {
        acc.grouped[carico.codice_raggruppamento] = []
      }
      acc.grouped[carico.codice_raggruppamento].push(carico)
      return acc
    }, { grouped: {} as Record<string, Carico[]>, ungrouped: [] as Carico[] })

    const sortedGrouped = Object.entries(grouped.grouped)
      .map(([, group]) => group)
      .sort((a, b) => new Date(a[0].dataConsegna).getTime() - new Date(b[0].dataConsegna).getTime())
      .flat()

    const sortedUngrouped = grouped.ungrouped
      .sort((a, b) => new Date(a.dataConsegna).getTime() - new Date(b.dataConsegna).getTime())

    return [...sortedGrouped, ...sortedUngrouped]
  }, [carichi])

  if (isLoading) {
    return <div className="container mx-auto p-4">Caricamento...</div>
  }

  if (error) {
    return <div className="container mx-auto p-4 text-red-500">{error}</div>
  }

  return (
    <div className="container mx-auto p-4">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">Carichi di oggi {format(new Date(), 'dd/MM/yyyy', { locale: it })}</h1>
      </div>
      {carichiOrdinati.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          Non ci sono carichi previsti per oggi
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Ordine</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Prodotto</TableHead>
              <TableHead>Quantità</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {carichiOrdinati.map((carico, index) => {
              const isFirst = isFirstInGroup(carico, index, carichiOrdinati);
              const isLast = isLastInGroup(carico, index, carichiOrdinati);
              const isGrouped = !!carico.codice_raggruppamento;

              return (
                <React.Fragment key={carico.linkId}>
                  <TableRow className={cn(
                    'border-b-0',
                    isGrouped && 'bg-gray-50',
                    isFirst && 'border-t-2 border-t-gray-200',
                    isLast && 'border-b-2 border-b-gray-200',
                    !isGrouped && 'border-b border-b-gray-200'
                  )}>
                    <TableCell>{carico.orderNumber}</TableCell>
                    <TableCell className="font-bold text-lg">{carico.cliente}</TableCell>
                    <TableCell>
                      <div className="font-bold text-lg">{carico.prodotto}</div>
                      <div className="text-sm text-gray-500">
                        {carico.productDimensions} {carico.heatTreated ? '- HT' : ''}
                      </div>
                    </TableCell>
                    <TableCell className="font-bold text-lg">{carico.quantita}</TableCell>
                  </TableRow>
                  <TableRow className={cn(
                    isGrouped && 'bg-gray-50',
                    isLast && 'border-b-2 border-b-gray-200'
                  )}>
                    <TableCell colSpan={6}>
                      <Button 
                        variant="outline" 
                        className="mb-2 bg-black text-white" 
                        onClick={() => apriDialog(carico.linkId)}
                      >
                        <Plus className="mr-2 h-4 w-4" />
                        Nuova consegna
                      </Button>
                      <div className="text-sm text-gray-600 mt-2">
                        {carico.consegne.map((consegna, consegnaIndex) => (
                          <div key={consegnaIndex} className="mb-1 flex items-center justify-start">
                            <div>
                              Consegna del {format(parseISO(consegna.data), 'dd/MM/yyyy', { locale: it })}.
                              {consegna.note && ` Note: ${consegna.note}`}
                            </div>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Elimina consegna</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Vuoi davvero eliminare questa consegna?
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Annulla</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => eliminaConsegna(carico.linkId, consegnaIndex)}>
                                    Elimina
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        ))}
                      </div>
                    </TableCell>
                  </TableRow>
                </React.Fragment>
              )
            })}
          </TableBody>
        </Table>
      )}

      <Dialog open={dialogOpen} onOpenChange={chiudiDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Aggiungi nuova consegna</DialogTitle>
          </DialogHeader>
          <form onSubmit={(e) => {
            e.preventDefault()
            if (caricoSelezionato === null) return
            const form = e.target as HTMLFormElement
            const note = form.note.value
            aggiungiConsegna(caricoSelezionato, { 
              data: format(date, 'yyyy-MM-dd'),
              note 
            })
            form.reset()
          }}>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <label className="text-right">Data consegna</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal col-span-3",
                        !date && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {date ? format(date, 'PPP', { locale: it }) : <span>Seleziona una data</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={date}
                      onSelect={(date) => date && setDate(date)}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <label htmlFor="note" className="text-right">Note</label>
                <Textarea id="note" name="note" className="col-span-3" />
              </div>
            </div>
            <div className="mt-4">
              <Button type="submit" className="w-full">Registra consegna</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}