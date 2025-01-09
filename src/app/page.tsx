'use client'

import React from 'react';
import { useRouter } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { ClipboardList, Factory, BarChart3, Truck } from 'lucide-react';
import Link from 'next/link';

export default function LandingPage() {
  const router = useRouter();

  const features = [
    {
      title: "Gestione Ordini",
      description: "Traccia e gestisci tutti gli ordini di produzione in tempo reale",
      icon: <ClipboardList className="h-6 w-6" />,
      link: "/features/orders"
    },
    {
      title: "Controllo Produzione",
      description: "Monitora l'avanzamento della produzione e ottimizza i processi",
      icon: <Factory className="h-6 w-6" />,
      link: "/features/production"
    },
    {
      title: "Analisi Prestazioni",
      description: "Analizza le performance e identifica aree di miglioramento",
      icon: <BarChart3 className="h-6 w-6" />,
      link: "/features/analytics"
    },
    {
      title: "Logistica",
      description: "Gestisci spedizioni e magazzino in modo efficiente",
      icon: <Truck className="h-6 w-6" />,
      link: "/features/logistics"
    }
  ];

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <div className="text-xl font-semibold">
              Varesco Legno <span className="text-gray-500">1947</span>
            </div>
            <div className='flex gap-2'>
            <Button 
              
              variant="outline" 
              onClick={() => router.push('/primoaccesso')}
              className="font-semibold"
            >
              primo accesso
            </Button>
            <Button 
              onClick={() => router.push('/login')}
              
              className="font-semibold"
            >
              Accedi
            </Button>
            </div>
          </div>
        </div>
      </header>

      <main>
        {/* Hero Section */}
        <section className="container mx-auto px-4 py-16 md:py-24">
          <div className="max-w-3xl mx-auto text-center">
            <h1 className="text-4xl md:text-6xl font-bold tracking-tight text-gray-900 mb-6">
              Gestionale di Produzione
            </h1>
            <p className="text-xl text-gray-600 mb-8">
              Gestionale per la Produzione, i Carichi, Clienti e vista sui dati di analisi.
            </p>
            <div className='flex gap-8 items-center justify-center'>
            <Button 
              size="lg"
              variant="outline" 
              onClick={() => router.push('/primoaccesso')}
              className="font-semibold"
            >
              primo accesso
            </Button>
            <Button 
              size="lg" 
              onClick={() => router.push('/login')}
              className="font-bold"
            >
              Accedi
            </Button>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section className="container mx-auto px-4 py-16 bg-gray-50">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-3xl font-bold text-center mb-12">
              Come Funziona
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {features.map((feature, index) => (
                <Card key={index} className="border-2">
                  <CardHeader>
                    <div className="flex items-center gap-4">
                      <div className="p-2 rounded-lg bg-primary/10 text-primary">
                        {feature.icon}
                      </div>
                      <div>
                        <CardTitle className="text-xl mb-2">{feature.title}</CardTitle>
                        <CardDescription className="text-base">
                          {feature.description}
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <Link 
                      href={feature.link}
                      className="text-primary hover:underline font-medium"
                    >
                      Scopri di più →
                    </Link>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        
      </main>

      {/* Footer */}
      <footer className="border-t bg-gray-50">
        <div className="container mx-auto px-4 py-8">
          <div className="flex justify-between items-center">
            <div className="text-sm text-gray-600">
              © {new Date().getFullYear()} Varesco Legno Srl. Tutti i diritti riservati.
            </div>
            
          </div>
        </div>
      </footer>
    </div>
  );
}