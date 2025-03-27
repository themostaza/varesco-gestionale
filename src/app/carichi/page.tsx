'use client'

import React from 'react'
import { useState, useMemo, useEffect } from 'react'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { format, parseISO } from 'date-fns'
import { it } from 'date-fns/locale'
import { BookOpenCheck, CheckCheck, Trash2, Calendar as CalendarIcon, Ungroup } from 'lucide-react'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "@/hooks/use-toast"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import { supabase } from '@/lib/supabase'
import debounce from 'lodash/debounce'
import GroupDialog from './GroupDialog'

interface Consegna {
  data: string
  note: string
}

interface CaricoDB {
  stato: 'consegna' | 'pronto_consegna' | 'ddt' | 'completato'
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
  stato: 'consegna' | 'pronto_consegna' | 'completato' | 'ddt'
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
          stato,
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
          stato: item.stato,
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

  const toggleProntoConsegna = async (linkId: number) => {
    try {
      const carico = carichi.find(c => c.linkId === linkId)
      if (!carico) return

      const nuovoStato = carico.stato === 'pronto_consegna' ? 'consegna' : 'pronto_consegna'

      const { error } = await supabase
        .from('link_ordini_client_products')
        .update({ stato: nuovoStato })
        .eq('id', linkId)

      if (error) throw error

      setCarichi(carichi.map(c => 
        c.linkId === linkId ? { ...c, stato: nuovoStato } : c
      ))

      toast({
        title: nuovoStato === 'pronto_consegna' ? "Carico pronto per la consegna" : "Carico in lavorazione",
        description: `Il carico ${carico.orderNumber} è stato ${nuovoStato === 'pronto_consegna' ? 'marcato come pronto' : 'rimesso in lavorazione'}`,
      })
    } catch (err) {
      console.error('Error updating delivery status:', err)
      toast({
        title: "Errore",
        description: "Impossibile aggiornare lo stato del carico",
      })
    }
  }

  const raggruppaCarichi = async (selectedIds: number[]) => {
    try {
      const timestamp = new Date().toISOString()
      const firstCarico = carichi.find(c => c.linkId === selectedIds[0])
      if (!firstCarico) return
  
      // Execute all updates and collect results
      const results = await Promise.all(
        selectedIds.map(async (id) => {
          const carico = carichi.find(c => c.linkId === id)
          if (!carico) return null
  
          const { error } = await supabase
            .from('link_ordini_client_products')
            .update({ 
              codice_raggruppamento: timestamp,
              stato: firstCarico.stato,
              body: {
                ...carico.body,              // Mantiene tutto il body originale
                deliveryDate: firstCarico.dataConsegna  // Aggiorna solo la data
              }
            })
            .eq('id', id)
          
          return error
        })
      )
  
      // Check if any of the operations resulted in an error
      const errors = results.filter(error => error !== null)
      if (errors.length > 0) {
        throw new Error('One or more updates failed')
      }
  
      await fetchCarichi()
  
      toast({
        title: "Carichi raggruppati",
        description: `${selectedIds.length} carichi sono stati raggruppati con successo`,
      })
    } catch (err) {
      console.error('Error grouping deliveries:', err)
      toast({
        title: "Errore",
        description: "Impossibile raggruppare i carichi",
      })
    }
  }

  const rimuoviRaggruppamento = async (codiceRaggruppamento: string) => {
    try {
      const { error } = await supabase
        .from('link_ordini_client_products')
        .update({ codice_raggruppamento: null })
        .eq('codice_raggruppamento', codiceRaggruppamento)

      if (error) throw error

      await fetchCarichi()

      toast({
        title: "Raggruppamento rimosso",
        description: "I carichi sono stati separati con successo",
      })
    } catch (err) {
      console.error('Error removing group:', err)
      toast({
        title: "Errore",
        description: "Impossibile rimuovere il raggruppamento",
      })
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

  const aggiornaDataConsegna = async (linkId: number, nuovaData: string) => {
    try {
      const carico = carichi.find(c => c.linkId === linkId)
      if (!carico) return

      const updatedBody = {
        ...carico.body,
        deliveryDate: nuovaData
      }

      const { error } = await supabase
        .from('link_ordini_client_products')
        .update({ body: updatedBody })
        .eq('id', linkId)

      if (error) throw error

      setCarichi(carichi.map(carico => 
        carico.linkId === linkId ? { ...carico, dataConsegna: nuovaData } : carico
      ))
    } catch (err) {
      console.error('Error updating delivery date:', err)
      toast({
        title: "Errore",
        description: "Impossibile aggiornare la data di consegna",
      })
    }
  }

  const confermaCarico = async (linkId: number, isGrouped = false) => {
    try {
      const carico = carichi.find(c => c.linkId === linkId)
      if (!carico) return
  
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('User not authenticated')
  
      const updatedBody = {
        ...carico.body,
        completedAt: {
          timestamp: new Date().toISOString(),
          user: user.email || user.id
        }
      }
  
      if (isGrouped && carico.codice_raggruppamento) {
        // Se è un gruppo, aggiorna tutti i carichi del gruppo
        const carichiGruppo = carichi.filter(c => c.codice_raggruppamento === carico.codice_raggruppamento)
        
        await Promise.all(carichiGruppo.map(c => 
          supabase
            .from('link_ordini_client_products')
            .update({ 
              stato: 'ddt',
              body: {
                ...c.body,
                completedAt: updatedBody.completedAt
              }
            })
            .eq('id', c.linkId)
        ))
  
        // Aggiorna lo stato UI rimuovendo tutti i carichi del gruppo
        setCarichi(carichi.filter(c => c.codice_raggruppamento !== carico.codice_raggruppamento))
        
        toast({
          title: "Carichi completati",
          description: `${carichiGruppo.length} carichi sono stati completati`,
        })
      } else {
        // Gestione singolo carico
        const { error } = await supabase
          .from('link_ordini_client_products')
          .update({ 
            stato: 'ddt',
            body: updatedBody
          })
          .eq('id', linkId)
  
        if (error) throw error
  
        setCarichi(carichi.filter(c => c.linkId !== linkId))
        
        toast({
          title: "Carico completato",
          description: `Il carico ${carico.orderNumber} è stato completato`,
        })
      }
    } catch (err) {
      console.error('Error confirming delivery:', err)
      toast({
        title: "Errore",
        description: "Impossibile completare il carico",
      })
    }
  }

  const isFirstInGroup = (currentCarico: Carico, index: number) => {
    if (!currentCarico.codice_raggruppamento) return false;
    return index === 0 || carichiOrdinati[index - 1].codice_raggruppamento !== currentCarico.codice_raggruppamento;
  }

  const isLastInGroup = (currentCarico: Carico, index: number) => {
    if (!currentCarico.codice_raggruppamento) return false;
    return index === carichiOrdinati.length - 1 || carichiOrdinati[index + 1].codice_raggruppamento !== currentCarico.codice_raggruppamento;
  }

  const carichiOrdinati = useMemo(() => {
    // Group carichi by codice_raggruppamento
    const grouped = carichi.reduce((acc, carico) => {
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

    // Sort ungrouped carichi
    const sortedUngrouped = grouped.ungrouped
      .filter(c => c.stato === 'consegna')
      .sort((a, b) => new Date(a.dataConsegna).getTime() - new Date(b.dataConsegna).getTime())
      .concat(
        grouped.ungrouped
          .filter(c => c.stato === 'pronto_consegna')
          .sort((a, b) => new Date(a.dataConsegna).getTime() - new Date(b.dataConsegna).getTime())
      )

    // Sort and flatten grouped carichi
    const sortedGrouped = Object.entries(grouped.grouped)
      .map(([, group]) => group)
      .sort((a, b) => new Date(a[0].dataConsegna).getTime() - new Date(b[0].dataConsegna).getTime())
      .flat()

    return [...sortedGrouped, ...sortedUngrouped]
  }, [carichi])

  useEffect(() => {
    return () => {
      debouncedUpdate.cancel()
    }
  }, [debouncedUpdate])

  useEffect(() => {
    fetchCarichi()
  }, [])

  if (isLoading) {
    return <div className="container mx-auto p-4">Caricamento...</div>
  }

  if (error) {
    return <div className="container mx-auto p-4 text-red-500">{error}</div>
  }

  return (
    <div className="container mx-auto p-4">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">Carichi</h1>
        <GroupDialog carichi={carichi} onGroup={raggruppaCarichi} />
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Ordine</TableHead>
            <TableHead>Cliente</TableHead>
            <TableHead>Prodotto</TableHead>
            <TableHead>Quantità</TableHead>
            <TableHead>Consegna</TableHead>
            <TableHead>Azioni</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {carichiOrdinati.map((carico, index) => {
            const isFirst = isFirstInGroup(carico, index);
            const isLast = isLastInGroup(carico, index);
            const isGrouped = !!carico.codice_raggruppamento;
            //const showActions = !isGrouped || isFirst;

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
                  <TableCell>
                    {(!isGrouped || isFirst) && (
                      <div className="flex space-x-2">
                        <Input
                          type="date"
                          value={carico.dataConsegna}
                          onChange={(e) => {
                            if (isGrouped) {
                              // Aggiorna tutti i carichi nel gruppo
                              const groupCode = carico.codice_raggruppamento;
                              carichiOrdinati
                                .filter(c => c.codice_raggruppamento === groupCode)
                                .forEach(c => aggiornaDataConsegna(c.linkId, e.target.value));
                            } else {
                              aggiornaDataConsegna(carico.linkId, e.target.value);
                            }
                          }}
                          className="w-40 mb-1"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const today = new Date().toISOString().split('T')[0];
                            if (isGrouped) {
                              // Aggiorna tutti i carichi nel gruppo
                              const groupCode = carico.codice_raggruppamento;
                              carichiOrdinati
                                .filter(c => c.codice_raggruppamento === groupCode)
                                .forEach(c => aggiornaDataConsegna(c.linkId, today));
                            } else {
                              aggiornaDataConsegna(carico.linkId, today);
                            }
                          }}
                          className="ml-2"
                        >
                          Oggi
                        </Button>
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    {(!isGrouped || isFirst) && (
                      <div className="flex space-x-2">
                        <Button 
                          size="sm" 
                          variant="outline" 
                          className={cn(
                            "text-md",
                            carico.stato === 'pronto_consegna' ? "bg-green-100 text-green-800 hover:bg-green-200" : ""
                          )}
                          onClick={() => {
                            if (isGrouped) {
                              // Aggiorna tutti i carichi nel gruppo
                              const groupCode = carico.codice_raggruppamento;
                              carichiOrdinati
                                .filter(c => c.codice_raggruppamento === groupCode)
                                .forEach(c => toggleProntoConsegna(c.linkId));
                            } else {
                              toggleProntoConsegna(carico.linkId);
                            }
                          }}
                        >
                          <BookOpenCheck className={cn(
                            "mr-2 h-4 w-4",
                            carico.stato === 'pronto_consegna' ? "text-green-800" : ""
                          )} />
                          {carico.stato === 'pronto_consegna' ? 'Pronto consegna!' : 'Pronto consegna'}
                        </Button>

                        {isGrouped && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button size="sm" variant="outline" className="text-md">
                                <Ungroup className="mr-2 h-4 w-4" />
                                Separa
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Separa carichi</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Vuoi davvero separare questi carichi raggruppati?
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Annulla</AlertDialogCancel>
                                <AlertDialogAction onClick={() => {rimuoviRaggruppamento(carico.codice_raggruppamento!); setCaricoSelezionato(carico.linkId)}}>
                                  Separa
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}

                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button size="sm" variant="outline" className="text-md">
                              <CheckCheck className="mr-2 h-4 w-4" />
                              Evadi
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Conferma carico</AlertDialogTitle>
                              <AlertDialogDescription>
                                {carico.consegne.length === 0 ? 
                                  'Per evadere il carico devi prima registrare almeno una consegna' :
                                  isGrouped ? 
                                    'Vuoi davvero evadere tutti i carichi raggruppati?' :
                                    `Vuoi davvero evadere il carico ${carico.orderNumber}?`
                                }
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Annulla</AlertDialogCancel>
                              {carico.consegne.length > 0 && (
                                <AlertDialogAction onClick={() => {
                                    if (isGrouped) {
                                      confermaCarico(carico.linkId, true);
                                    } else {
                                      confermaCarico(carico.linkId);
                                    }
                                  }}>
                                  Conferma
                                </AlertDialogAction>
                              )}
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell colSpan={6} className={cn(
                    isGrouped && 'bg-gray-50',
                    isLast && 'border-b-2 border-b-gray-200'
                  )}>
                    <Textarea
                      placeholder="Note"
                      value={carico.note}
                      onChange={(e) => {
                        setCarichi(prevCarichi => prevCarichi.map(c => 
                          c.linkId === carico.linkId ? { ...c, note: e.target.value } : c
                        ))
                        debouncedUpdate(carico.linkId, e.target.value, carico)
                      }}
                      className="w-full mb-2"
                    />
                    <div className="text-sm text-gray-600 mt-2">
                      {carico.consegne.map((consegna, index) => (
                        <div key={index} className="mb-1 flex items-center justify-start">
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
                                
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      ))}
                    </div>
                  </TableCell>
                </TableRow>
              </React.Fragment>
            );
          })}
        </TableBody>
      </Table>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Aggiungi nuova consegna</DialogTitle>
          </DialogHeader>
          <form onSubmit={(e) => {
            e.preventDefault()
            if (caricoSelezionato === null) return
            const form = e.target as HTMLFormElement
            //const note = form.note.value
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