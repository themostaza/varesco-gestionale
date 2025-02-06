'use client'

import React from 'react'
import { useState, useMemo, useEffect } from 'react'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { format, parseISO } from 'date-fns'
import { it } from 'date-fns/locale'
import { CheckCheck} from 'lucide-react'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import { supabase } from '@/lib/supabase'
import debounce from 'lodash/debounce'

interface Consegna {
  data: string
  note: string
}

interface CaricoDB {
  stato: 'ddt' | 'completato'
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
  stato: 'ddt' | 'completato'
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
        .eq('stato', 'ddt') as { data: CaricoDB[] | null, error: unknown }

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

  const completaCarico = async (linkId: number, isGrouped = false) => {
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
              stato: 'completato',
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
            stato: 'completato',
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
      console.error('Error completing delivery:', err)
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

    const sortedUngrouped = grouped.ungrouped
      .sort((a, b) => new Date(a.dataConsegna).getTime() - new Date(b.dataConsegna).getTime())

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
        <h1 className="text-2xl font-bold">DDT</h1>
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
                      <div className="w-40 mb-1 text-gray-700">
                        {format(parseISO(carico.dataConsegna), 'dd/MM/yyyy', { locale: it })}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    {(!isGrouped || isFirst) && (
                      <div className="flex space-x-2">
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button size="sm" variant="outline" className="text-md">
                              <CheckCheck className="mr-2 h-4 w-4" />
                              Completa
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Conferma completamento</AlertDialogTitle>
                              <AlertDialogDescription>
                                {isGrouped ? 
                                  'Vuoi davvero completare tutti i carichi raggruppati?' :
                                  `Vuoi davvero completare il carico ${carico.orderNumber}?`
                                }
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Annulla</AlertDialogCancel>
                              <AlertDialogAction onClick={() => {
                                completaCarico(carico.linkId, isGrouped);
                              }}>
                                Conferma
                              </AlertDialogAction>
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
                        <div key={index} className="mb-1">
                          Consegna del {format(parseISO(consegna.data), 'dd/MM/yyyy', { locale: it })}.
                          {consegna.note && ` Note: ${consegna.note}`}
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
    </div>
  )
}