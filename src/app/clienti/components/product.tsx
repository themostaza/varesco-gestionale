'use client'

import { useState, useEffect } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { supabase } from '@/lib/supabase'
import { toast } from "sonner"

type Product = {
  id: number
  name: string
  body: {
    dimensions: string
    heatTreated: boolean
  }
  client: string
}

type CustomerProductsProps = {
  clientId: string
}

export function CustomerProducts({ clientId }: CustomerProductsProps) {
  const [products, setProducts] = useState<Product[]>([])
  const [showDialog, setShowDialog] = useState(false)
  const [currentProduct, setCurrentProduct] = useState<Product | null>(null)
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false)
  const [productToDelete, setProductToDelete] = useState<Product | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (clientId) {
      fetchProducts()
    }
  }, [clientId])

  const fetchProducts = async () => {
    try {
      const { data, error } = await supabase
        .from('client_products')
        .select('*')
        .eq('client', clientId)
        .order('created_at', { ascending: false })

      if (error) throw error

      setProducts(data || [])
    } catch (error) {
      console.error('Error fetching products:', error)
      toast.error('Errore nel caricamento dei prodotti')
    } finally {
      setLoading(false)
    }
  }

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!currentProduct) return

    try {
      const productData = {
        name: currentProduct.name,
        body: {
          dimensions: currentProduct.body.dimensions,
          heatTreated: currentProduct.body.heatTreated
        },
        client: clientId
      }

      if (currentProduct.id) {
        // Update existing product
        const { error } = await supabase
          .from('client_products')
          .update(productData)
          .eq('id', currentProduct.id)

        if (error) throw error

        setProducts(products.map(p => p.id === currentProduct.id ? { ...currentProduct } : p))
        toast.success('Prodotto aggiornato con successo')
      } else {
        // Create new product
        const { data, error } = await supabase
          .from('client_products')
          .insert(productData)
          .select()

        if (error) throw error

        if (data) {
          setProducts([data[0], ...products])
          toast.success('Prodotto creato con successo')
        }
      }

      setShowDialog(false)
      setCurrentProduct(null)
    } catch (error) {
      console.error('Error saving product:', error)
      toast.error('Errore durante il salvataggio del prodotto')
    }
  }

  const handleDeleteProduct = async (product: Product, e: React.MouseEvent) => {
    e.stopPropagation()
    setProductToDelete(product)
    setShowDeleteConfirmation(true)
  }

  const confirmDeleteProduct = async () => {
    if (!productToDelete) return

    try {
      const { error } = await supabase
        .from('client_products')
        .delete()
        .eq('id', productToDelete.id)

      if (error) throw error

      setProducts(products.filter(p => p.id !== productToDelete.id))
      toast.success('Prodotto eliminato con successo')
      setShowDeleteConfirmation(false)
    } catch (error) {
      console.error('Error deleting product:', error)
      toast.error('Errore durante l\'eliminazione del prodotto')
    }
  }

  if (loading) {
    return <div>Caricamento prodotti...</div>
  }

  return (
    <div className="mt-8">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold">Prodotti</h2>
        <Button 
          onClick={() => {
            setCurrentProduct({
              id: 0,
              name: '',
              body: {
                dimensions: '',
                heatTreated: false
              },
              client: clientId
            })
            setShowDialog(true)
          }}
        >
          <Plus className="mr-2 h-4 w-4" /> Nuovo Prodotto
        </Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Prodotto</TableHead>
            <TableHead>Dimensioni</TableHead>
            <TableHead>Trattata term?</TableHead>
            <TableHead className="w-[100px]">Azioni</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {products.map((product) => (
            <TableRow 
              key={product.id}
              className="cursor-pointer transition-colors hover:bg-black hover:text-white group"
              onClick={() => {
                setCurrentProduct(product)
                setShowDialog(true)
              }}
            >
              <TableCell className="rounded-l-lg">{product.name}</TableCell>
              <TableCell>{product.body.dimensions}</TableCell>
              <TableCell>{product.body.heatTreated ? 'Sì' : 'No'}</TableCell>
              <TableCell className="rounded-r-lg">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={(e) => handleDeleteProduct(product, e)}
                >
                  <Trash2 className="h-4 w-4 text-black group-hover:text-white hover:text-black" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {currentProduct?.id ? 'Modifica Prodotto' : 'Nuovo Prodotto'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSaveProduct} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="name" className="text-sm">Prodotto</label>
              <Input
                id="name"
                value={currentProduct?.name || ''}
                onChange={(e) => currentProduct && setCurrentProduct({
                  ...currentProduct,
                  name: e.target.value
                })}
              />
            </div>
            
            <div className="space-y-2">
              <label htmlFor="dimensions" className="text-sm">Dimensioni</label>
              <Input
                id="dimensions"
                value={currentProduct?.body.dimensions || ''}
                onChange={(e) => currentProduct && setCurrentProduct({
                  ...currentProduct,
                  body: {
                    ...currentProduct.body,
                    dimensions: e.target.value
                  }
                })}
              />
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="heatTreated"
                checked={currentProduct?.body.heatTreated || false}
                onCheckedChange={(checked) => currentProduct && setCurrentProduct({
                  ...currentProduct,
                  body: {
                    ...currentProduct.body,
                    heatTreated: checked as boolean
                  }
                })}
              />
              <label htmlFor="heatTreated" className="text-sm">
                Trattata termicamente
              </label>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowDialog(false)}>
                Annulla
              </Button>
              <Button type="submit">
                {currentProduct?.id ? 'Salva Modifiche' : 'Crea Prodotto'}
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
              Vuoi davvero eliminare {productToDelete?.name}? 
              Questa azione è irreversibile.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteConfirmation(false)}>
              Annulla
            </Button>
            <Button variant="destructive" onClick={confirmDeleteProduct}>
              Elimina
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}