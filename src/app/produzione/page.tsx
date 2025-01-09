'use client'

import { useState, useMemo, useEffect } from 'react'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Users, StickyNote, ArrowUpDown, Check } from 'lucide-react'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"
import { supabase } from '@/lib/supabase'

interface Ordine {
  orderNumber: string
  cliente: string
  prodotto: string
  productDimensions: string
  heatTreated: boolean
  quantita: number
  dataConsegna: string
  linkId: number
  body?: {
    quantity: number
    deliveryDate: string
    productionConfirmed?: {
      timestamp: string
      user: string
    }
  }
}

interface OrderiResponse {
  id: number;
  body: {
    quantity: number;
    deliveryDate: string;
  };
  ordini: {
    id: string;
    order_number: string;
    client: {
      ragione_sociale: string;
    };
  };
  client_products: {
    name: string;
    body: {
      dimensions?: string;
      heatTreated?: boolean;
    };
  };
}

type GruppoOrdini = Record<string, Ordine[]>

export default function ComponentProduction() {
  const [ordini, setOrdini] = useState<Ordine[]>([])
  const [tipoRaggruppamento, setTipoRaggruppamento] = useState<'nessuno' | 'cliente' | 'postIt'>('postIt')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Fetch orders from Supabase
  const fetchOrdini = async () => {
    try {
      setIsLoading(true)
      setError(null)

      const { data, error } = await supabase
        .from('link_ordini_client_products')
        .select(`
          id,
          body,
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
        .eq('stato', 'produzione')
        console.log('Data from Supabase:', JSON.stringify(data?.[0], null, 2))
      if (error) throw error

      if (!data) {
        setOrdini([])
        return
      }

      const formattedOrders = ((data || []) as unknown as OrderiResponse[])
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
          linkId: item.id
        }))

      setOrdini(formattedOrders)
    } catch (err) {
      console.error('Error fetching orders:', err)
      setError('Errore nel caricamento degli ordini')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchOrdini()
  }, [])

  const aggiornaDataConsegna = async (linkId: number, nuovaData: string) => {
    try {
      const ordine = ordini.find(o => o.linkId === linkId)
      if (!ordine) return

      const { error } = await supabase
        .from('link_ordini_client_products')
        .update({
          body: {
            deliveryDate: nuovaData,
            quantity: ordine.quantita
          }
        })
        .eq('id', linkId)

      if (error) throw error

      setOrdini(ordini.map(ordine => 
        ordine.linkId === linkId ? { ...ordine, dataConsegna: nuovaData } : ordine
      ))
    } catch (err) {
      console.error('Error updating delivery date:', err)
    }
  }

  const confermaProduzione = async (linkId: number) => {
    try {
      const ordine = ordini.find(o => o.linkId === linkId)
      if (!ordine) return
  
      // Get current user from Supabase auth
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('User not authenticated')
  
      const updatedBody = {
        ...ordine.body,
        quantity: ordine.quantita,
        deliveryDate: ordine.dataConsegna,
        productionConfirmed: {
          timestamp: new Date().toISOString(),
          user: user.email || user.id
        }
      }
  
      const { error } = await supabase
        .from('link_ordini_client_products')
        .update({ 
          stato: 'consegna',
          body: updatedBody
        })
        .eq('id', linkId)
  
      if (error) throw error
  
      setOrdini(ordini.filter(ordine => ordine.linkId !== linkId))
    } catch (err) {
      console.error('Error confirming production:', err)
      setError('Errore nella conferma della produzione')
    }
  }

  const ordiniOrdinati = useMemo(() => {
    return [...ordini].sort((a, b) => new Date(a.dataConsegna).getTime() - new Date(b.dataConsegna).getTime())
  }, [ordini])

  const ordiniRaggruppati = useMemo(() => {
    if (tipoRaggruppamento === 'nessuno') {
      return { "Tutti gli ordini": ordiniOrdinati }
    }

    return ordiniOrdinati.reduce((acc, ordine) => {
      let chiave: string;  // definisci esplicitamente il tipo
      if (tipoRaggruppamento === 'cliente') {
          chiave = ordine.cliente;
      } else {  // postIt è l'unica altra opzione possibile
          chiave = `${ordine.orderNumber}|${ordine.cliente}|${ordine.prodotto}`;
      }
      
      if (!acc[chiave]) {
        acc[chiave] = []
      }
      acc[chiave].push(ordine)
      return acc
    }, {} as GruppoOrdini)
}, [ordiniOrdinati, tipoRaggruppamento])

  if (isLoading) {
    return <div className="container mx-auto p-4">Caricamento...</div>
  }

  if (error) {
    return <div className="container mx-auto p-4 text-red-500">{error}</div>
  }

  return (
    <div className="container mx-auto p-4">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">Produzione</h1>
        <div className="space-x-2">
          <Button
            onClick={() => setTipoRaggruppamento('nessuno')}
            variant={tipoRaggruppamento === 'nessuno' ? "default" : "outline"}
            size="sm"
          >
            <ArrowUpDown className="mr-2 h-4 w-4" />
            Tutti
          </Button>
          <Button
            onClick={() => setTipoRaggruppamento('cliente')}
            variant={tipoRaggruppamento === 'cliente' ? "default" : "outline"}
            size="sm"
          >
            <Users className="mr-2 h-4 w-4" />
            Cliente
          </Button>
          <Button
            onClick={() => setTipoRaggruppamento('postIt')}
            variant={tipoRaggruppamento === 'postIt' ? "default" : "outline"}
            size="sm"
          >
            <StickyNote className="mr-2 h-4 w-4" />
            Post it
          </Button>
        </div>
      </div>
      {Object.entries(ordiniRaggruppati).map(([gruppo, ordiniGruppo]) => (
        <div key={gruppo} className="mb-8">
          {tipoRaggruppamento !== 'nessuno' && (
            <h2 className="text-xl font-semibold mb-2">
              {tipoRaggruppamento === 'postIt' 
                ? <>
                    <div>{gruppo.split('|')[0]} - {ordiniGruppo[0].cliente}</div>
                    <div className="text-base font-normal mt-1">
                      <b>{ordiniGruppo[0].prodotto}</b> - {ordiniGruppo[0].productDimensions} - {ordiniGruppo[0].heatTreated ? 'T' : 'NON T'}
                    </div>
                  </>
                : gruppo
              }
            </h2>
          )}
          <Table>
            <TableHeader>
              <TableRow>
                {tipoRaggruppamento !== 'postIt' && tipoRaggruppamento !== 'cliente' && <TableHead>Cliente</TableHead>}
                {tipoRaggruppamento !== 'postIt' && <TableHead>Prodotto</TableHead>}
                <TableHead>Quantità</TableHead>
                <TableHead>Data di Consegna</TableHead>
                {tipoRaggruppamento !== 'postIt' && <TableHead>Post-it</TableHead>}
                <TableHead>Azioni</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ordiniGruppo.map((ordine) => (
                <TableRow key={ordine.linkId}>
                  {tipoRaggruppamento !== 'postIt' && tipoRaggruppamento !== 'cliente' && <TableCell>{ordine.cliente}</TableCell>}
                  {tipoRaggruppamento !== 'postIt' && <TableCell>
                    <div>{ordine.prodotto}</div>
                    <div className="text-sm text-gray-500">
                      {ordine.productDimensions} - {ordine.heatTreated ? 'Trattata' : 'NON Trattata'}
                    </div>
                  </TableCell>}
                  <TableCell>{ordine.quantita}</TableCell>
                  <TableCell>
                    <Input
                      type="date"
                      value={ordine.dataConsegna}
                      onChange={(e) => aggiornaDataConsegna(ordine.linkId, e.target.value)}
                      className="w-40"
                    />
                  </TableCell>
                  {tipoRaggruppamento !== 'postIt' && <TableCell>{ordine.orderNumber}</TableCell>}
                  <TableCell>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="sm" variant="default">
                          <Check className="mr-2 h-4 w-4" />
                          Conferma
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Conferma produzione</AlertDialogTitle>
                          <AlertDialogDescription>
                            Vuoi davvero confermare la produzione per l&apos;ordine {ordine.orderNumber}?
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Annulla</AlertDialogCancel>
                          <AlertDialogAction onClick={() => confermaProduzione(ordine.linkId)}>Conferma</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ))}
    </div>
  )
}