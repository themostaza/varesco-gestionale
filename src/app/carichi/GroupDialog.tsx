import React, { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { ScrollArea } from "@/components/ui/scroll-area"
import { format, parseISO } from 'date-fns'
import { it } from 'date-fns/locale'
import { LayersIcon } from 'lucide-react'

interface Carico {
  linkId: number
  cliente: string
  prodotto: string
  dataConsegna: string
  productDimensions: string
  stato: string
  body: unknown
  codice_raggruppamento: string | null
}

interface GroupDialogProps {
  carichi: Carico[]
  onGroup: (selectedIds: number[]) => Promise<void>
}

export default function GroupDialog({ carichi, onGroup }: GroupDialogProps) {
  const [open, setOpen] = useState(false)
  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const [isGrouping, setIsGrouping] = useState(false)

  // Filtriamo i carichi non raggruppati
  const carichiNonRaggruppati = carichi.filter(c => !c.codice_raggruppamento)

  const handleToggleSelect = (id: number) => {
    setSelectedIds(prev => 
      prev.includes(id) 
        ? prev.filter(x => x !== id)
        : [...prev, id]
    )
  }

  const handleGroup = async () => {
    if (selectedIds.length < 2) return
    setIsGrouping(true)
    try {
      await onGroup(selectedIds)
      setOpen(false)
      setSelectedIds([])
    } catch (error) {
      console.error('Error grouping items:', error)
    } finally {
      setIsGrouping(false)
    }
  }

  // Disabilitiamo il pulsante se non ci sono carichi da raggruppare
  const noCarichiFree = carichiNonRaggruppati.length === 0

  return (
    <>
      <Button 
        variant="outline" 
        onClick={() => setOpen(true)}
        className="ml-2"
        disabled={noCarichiFree}
        title={noCarichiFree ? "Non ci sono carichi disponibili da raggruppare" : ""}
      >
        <LayersIcon className="mr-2 h-4 w-4" />
        Raggruppa
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[100vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Raggruppa carichi</DialogTitle>
          </DialogHeader>
          
          <div className="py-4">
            {carichiNonRaggruppati.length === 0 ? (
              <div className="text-center text-gray-500 py-8">
                Non ci sono carichi disponibili da raggruppare
              </div>
            ) : (
              <ScrollArea className="h-[400px] pr-4">
                {carichiNonRaggruppati.map((carico) => (
                  <div
                    key={carico.linkId}
                    className="flex items-center space-x-4 py-2 border-b"
                  >
                    <Checkbox
                      checked={selectedIds.includes(carico.linkId)}
                      onCheckedChange={() => handleToggleSelect(carico.linkId)}
                    />
                    <div className="flex-1">
                      <div className="font-medium">{carico.cliente}</div>
                      <div className="text-sm text-gray-500">
                        {carico.prodotto} {carico.productDimensions}
                      </div>
                      <div className="text-sm text-gray-500">
                        Consegna: {format(parseISO(carico.dataConsegna), 'dd/MM/yyyy', { locale: it })}
                      </div>
                    </div>
                  </div>
                ))}
              </ScrollArea>
            )}
          </div>

          <div className="flex justify-end space-x-2">
            <Button
              variant="secondary"
              onClick={() => setOpen(false)}
            >
              Annulla
            </Button>
            <Button
              disabled={selectedIds.length < 2 || isGrouping}
              onClick={handleGroup}
            >
              {isGrouping ? 'Raggruppamento...' : 'Raggruppa'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}