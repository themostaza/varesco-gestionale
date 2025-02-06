import { useState, useEffect } from 'react'
import { Plus, Trash2, AlertCircle, Copy } from 'lucide-react'
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'

type OrderStatus = 'produzione' | 'consegna' | 'completato' | 'pronto_consegna' | 'ddt'

type Product = {
  id: string
  name: string
  dimensions: string
  heat_treated: boolean
}

type OrderProduct = {
  id: string
  productId: string
  quantity: number
  deliveryDate: string
  status: OrderStatus
  product: Product
}

type OrderProductsProps = {
  orderId: string
  clientId: string // Added to fetch client-specific products
}

export function OrderProducts({ orderId, clientId }: OrderProductsProps) {
  const [orderProducts, setOrderProducts] = useState<OrderProduct[]>([])
  const [availableProducts, setAvailableProducts] = useState<Product[]>([])
  const [showDialog, setShowDialog] = useState(false)
  const [currentOrderProduct, setCurrentOrderProduct] = useState<OrderProduct | null>(null)
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false)
  const [productToDelete, setProductToDelete] = useState<OrderProduct | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (orderId) {
      fetchOrderProducts()
    }
  }, [orderId])

  useEffect(() => {
    if (clientId) {
      fetchClientProducts()
    }
  }, [clientId])

  const fetchOrderProducts = async () => {
    try {
      const { data, error } = await supabase
        .from('link_ordini_client_products')
        .select(`
          id,
          c_product_id,
          body,
          stato,
          client_products (
            id,
            name,
            body
          )
        `)
        .eq('order_id', orderId)

        //console.log('Data from Supabase:', JSON.stringify(data?.[0], null, 2))


      if (error) throw error

      interface OrderProductResponse {
        id: number;
        c_product_id: number;
        body: {
          quantity: number;
          deliveryDate: string;
        };
        stato: string;
        client_products: {
          id: number;
          name: string;
          body: {
            dimensions: string;
            heatTreated: boolean;
          };
        };
      }

      const transformedData = ((data || []) as unknown as OrderProductResponse[])
  .filter(item => item && item.client_products)
  .map(item => ({
    id: item.id.toString(),
    productId: item.c_product_id.toString(),
    quantity: item.body?.quantity || 0,
    deliveryDate: item.body?.deliveryDate || new Date().toISOString().split('T')[0],
    status: (item.stato as OrderStatus) || 'produzione',
    product: {
      id: item.client_products.id.toString(),
      name: item.client_products.name,
      dimensions: item.client_products.body?.dimensions || '',
      heat_treated: item.client_products.body?.heatTreated || false
    }
  }))

      setOrderProducts(transformedData)
    } catch (error) {
      console.error('Error fetching order products:', error)
      toast.error('Errore nel caricamento dei prodotti dell\'ordine')
    }
  }

  const fetchClientProducts = async () => {
    try {
      const { data, error } = await supabase
        .from('client_products')
        .select('*')
        .eq('client', clientId)
      //console.log(data)
      if (error) throw error

      const transformedProducts = data.map(item => ({
        id: item.id.toString(),
        name: item.name,
        dimensions: item.body?.dimensions || '',
        heat_treated: item.body?.heatTreated || false
      }))

      setAvailableProducts(transformedProducts)
    } catch (error) {
      console.error('Error fetching client products:', error)
      toast.error('Errore nel caricamento dei prodotti del cliente')
    }
  }

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!currentOrderProduct) return
    
    setIsLoading(true)
    try {
      const productData = {
        order_id: orderId,
        c_product_id: parseInt(currentOrderProduct.productId),
        body: {
          quantity: currentOrderProduct.quantity,
          deliveryDate: currentOrderProduct.deliveryDate
        },
        stato: currentOrderProduct.status
      }

      if (currentOrderProduct.id) {
        // Update
        const { error } = await supabase
          .from('link_ordini_client_products')
          .update(productData)
          .eq('id', currentOrderProduct.id)

        if (error) throw error
        toast.success('Prodotto aggiornato con successo')
      } else {
        // Insert
        const { error } = await supabase
          .from('link_ordini_client_products')
          .insert([productData])

        if (error) throw error
        toast.success('Prodotto aggiunto con successo')
      }

      setShowDialog(false)
      setCurrentOrderProduct(null)
      fetchOrderProducts()
    } catch (error) {
      console.error('Error saving product:', error)
      toast.error('Errore durante il salvataggio del prodotto')
    } finally {
      setIsLoading(false)
    }
  }

  const handleDuplicateProduct = async (product: OrderProduct) => {
    setIsLoading(true)
    try {
      const productData = {
        order_id: orderId,
        c_product_id: parseInt(product.productId),
        body: {
          quantity: product.quantity,
          deliveryDate: product.deliveryDate
        },
        stato: product.status
      }

      const { error } = await supabase
        .from('link_ordini_client_products')
        .insert([productData])

      if (error) throw error
      
      toast.success('Prodotto duplicato con successo')
      fetchOrderProducts()
    } catch (error) {
      console.error('Error duplicating product:', error)
      toast.error('Errore durante la duplicazione del prodotto')
    } finally {
      setIsLoading(false)
    }
  }

  const confirmDeleteProduct = async () => {
    if (!productToDelete) return
    
    setIsLoading(true)
    try {
      const { error } = await supabase
        .from('link_ordini_client_products')
        .delete()
        .eq('id', productToDelete.id)

      if (error) throw error

      toast.success('Prodotto eliminato con successo')
      setShowDeleteConfirmation(false)
      fetchOrderProducts()
    } catch (error) {
      console.error('Error deleting product:', error)
      toast.error('Errore durante l\'eliminazione del prodotto')
    } finally {
      setIsLoading(false)
    }
  }

  const getStatusBadgeColor = (status: OrderStatus) => {
    switch (status) {
      case 'produzione': return 'bg-yellow-200 text-yellow-800'
      case 'consegna': return 'bg-blue-200 text-blue-800'
      case 'completato': return 'bg-green-200 text-green-800'
      case 'pronto_consegna': return 'bg-violet-200 text-violet-800'
      case 'ddt': return 'bg-brown-200 text-brown-800'
    }
  }

  if (!orderId) {
    return null;
  }

  return (
    <div className="mt-8">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold">Prodotti dell&apos;ordine</h2>
        <Button onClick={() => {
          setCurrentOrderProduct({
            id: '',
            productId: '',
            quantity: 1,
            deliveryDate: new Date().toISOString().split('T')[0],
            status: 'produzione',
            product: availableProducts[0]
          })
          setShowDialog(true)
        }}>
          <Plus className="mr-2 h-4 w-4" /> Aggiungi Prodotto
        </Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Prodotto</TableHead>
            <TableHead>Dimensioni</TableHead>
            <TableHead>Trattata term?</TableHead>
            <TableHead>Quantità</TableHead>
            <TableHead>Data Consegna</TableHead>
            <TableHead>
              <div className="flex items-center gap-2">
                Stato
                <Tooltip>
                  <TooltipTrigger>
                    <AlertCircle className="h-4 w-4 text-red-500 hover:text-red-600" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs rounded-md">
                    Attenzione: modificare il campo Stato modifica la posizione di un ordine tra le schermate Produzione e Carichi.
                  </TooltipContent>
                </Tooltip>
              </div>
            </TableHead>
            <TableHead className="w-[150px]">Azioni</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {orderProducts.map((orderProduct) => (
            <TableRow 
              key={orderProduct.id}
              className="cursor-pointer transition-colors hover:bg-black hover:text-white group"
              onClick={() => {
                setCurrentOrderProduct(orderProduct)
                setShowDialog(true)
              }}
            >
              <TableCell className="rounded-l-lg">{orderProduct.product.name}</TableCell>
              <TableCell>{orderProduct.product.dimensions}</TableCell>
              <TableCell>{orderProduct.product.heat_treated ? 'Sì' : 'No'}</TableCell>
              <TableCell>{orderProduct.quantity}</TableCell>
              <TableCell>{new Date(orderProduct.deliveryDate).toLocaleDateString()}</TableCell>
              <TableCell>
                <Badge className={getStatusBadgeColor(orderProduct.status)}>
                  {orderProduct.status.charAt(0).toUpperCase() + orderProduct.status.slice(1)}
                </Badge>
              </TableCell>
              <TableCell className="rounded-r-lg">
                <div className="flex gap-2" onClick={e => e.stopPropagation()}>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDuplicateProduct(orderProduct)}
                  >
                    <Copy className="h-4 w-4 text-black group-hover:text-white hover:text-black" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={(e) => {
                      e.stopPropagation()
                      setProductToDelete(orderProduct)
                      setShowDeleteConfirmation(true)
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

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {currentOrderProduct?.id ? 'Modifica Prodotto' : 'Aggiungi Prodotto'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSaveProduct} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm">Prodotto</label>
              <Select 
                value={currentOrderProduct?.productId}
                onValueChange={(value) => {
                  if (currentOrderProduct) {
                    const selectedProduct = availableProducts.find(p => p.id === value)
                    if (selectedProduct) {
                      setCurrentOrderProduct({
                        ...currentOrderProduct,
                        productId: value,
                        product: selectedProduct
                      })
                    }
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleziona prodotto" />
                </SelectTrigger>
                <SelectContent>
                  {availableProducts.map(product => (
                    <SelectItem key={product.id} value={product.id}>
                      {product.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <label htmlFor="quantity" className="text-sm">Quantità</label>
              <Input
                id="quantity"
                type="number"
                min="1"
                value={currentOrderProduct?.quantity || ''}
                onChange={(e) => currentOrderProduct && setCurrentOrderProduct({
                  ...currentOrderProduct,
                  quantity: parseInt(e.target.value)
                })}
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="deliveryDate" className="text-sm">Data Consegna</label>
              <Input
                id="deliveryDate"
                type="date"
                value={currentOrderProduct?.deliveryDate || ''}
                onChange={(e) => currentOrderProduct && setCurrentOrderProduct({
                  ...currentOrderProduct,
                  deliveryDate: e.target.value
                })}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm">Stato</label>
              <Select 
                value={currentOrderProduct?.status}
                onValueChange={(value: OrderStatus) => currentOrderProduct && setCurrentOrderProduct({
                  ...currentOrderProduct,
                  status: value
                })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleziona stato" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="produzione">Produzione</SelectItem>
                  <SelectItem value="consegna">Consegna</SelectItem>
                  <SelectItem value="completato">Completato</SelectItem>
                  <SelectItem value="pronto_consegna">Pronto consegna</SelectItem>
                  <SelectItem value="ddt">DDT</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowDialog(false)}>
                Annulla
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? 'Salvataggio...' : (currentOrderProduct?.id ? 'Salva Modifiche' : 'Aggiungi')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={showDeleteConfirmation} onOpenChange={setShowDeleteConfirmation}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Conferma Eliminazione</DialogTitle>
            <DialogDescription>
            Vuoi davvero eliminare questo prodotto dall&apos;ordine? Questa azione è irreversibile.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteConfirmation(false)}>
              Annulla
            </Button>
            <Button 
              variant="destructive" 
              onClick={confirmDeleteProduct}
              disabled={isLoading}
            >
              {isLoading ? 'Eliminazione...' : 'Elimina'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}