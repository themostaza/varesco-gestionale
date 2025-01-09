"use client";

import { useState } from "react";
import { Toaster } from "sonner";
import { LogIn, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";

import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

const AuthPage = () => {
  const [showInfoDialog, setShowInfoDialog] = useState(false);
  
  //Stati per gestione mostra password
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  
  // Stati per form login
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  
  // Stati comuni
  const [loading, setLoading] = useState(false);
  
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setLoginError("");
  
    try {
      const { data: signInData, error } = await supabase.auth.signInWithPassword({
        email: loginEmail,
        password: loginPassword,
      });

      console.log(signInData)
  
      if (error) {
        let errorMessage = "";
        if (error.message.includes("Invalid login credentials")) {
          errorMessage = "Email o password non corretta";
        } else if (error.message.includes("Email not confirmed")) {
          errorMessage = "Email non confermata";
        } else {
          errorMessage = `Errore: ${error.message}`;
        }
        setLoginError(errorMessage);
        toast.error(errorMessage);
        return;
      }
  
      // Controlla il ruolo dell'utente nelle raw user meta data
      const { data: { user } } = await supabase.auth.getUser();
      const userRole = user?.user_metadata?.role;
  
      toast.success("Accesso effettuato con successo!");
      
      // Reindirizza in base al ruolo
      if (userRole === "collaboratore") {
        router.push("/produzione");
      } else {
        router.push("/dashboard");
      }
  
    } catch (error: unknown) {
      console.error("Errore completo:", error);
      toast.error("Si è verificato un errore durante il login");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-4">
      <Toaster position="top-center" richColors closeButton />
      <div className="w-full max-w-md space-y-8 bg-white rounded-lg shadow-lg p-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-tight">Varesco Legno 1947</h1>
          <p className="mt-2 text-gray-600">Accedi per continuare</p>
        </div>

        <Tabs defaultValue="login" className="w-full">
          <TabsContent value="login">
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-4">
                <div>
                  <Input
                    id="loginEmail"
                    type="email"
                    value={loginEmail}
                    onChange={(e) => {
                      setLoginEmail(e.target.value);
                      setLoginError(""); 
                    }}
                    placeholder="Email"
                    required
                    disabled={loading}
                    className={`h-12 ${loginError ? 'border-red-500' : ''}`}
                  />
                </div>
                <div className="relative">
                  <Input
                    id="loginPassword"
                    type={showLoginPassword ? "text" : "password"}
                    value={loginPassword}
                    onChange={(e) => {
                      setLoginPassword(e.target.value);
                      setLoginError("");
                    }}
                    placeholder="Password"
                    required
                    disabled={loading}
                    className={`h-12 ${loginError ? 'border-red-500' : ''}`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowLoginPassword(!showLoginPassword)}
                    className="absolute right-3 top-3 text-gray-500 hover:text-gray-700"
                  >
                    {showLoginPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => setShowInfoDialog(true)}
                    className="text-sm text-blue-600 hover:text-blue-800"
                  >
                    Password dimenticata?
                  </button>
                </div>
                {loginError && (
                  <div className="text-red-500 text-sm bg-red-50 p-3 rounded-md border border-red-200 flex items-start">
                    <svg
                      className="w-4 h-4 mr-2 mt-0.5 flex-shrink-0"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                        clipRule="evenodd"
                      />
                    </svg>
                    {loginError}
                  </div>
                )}
              </div>
              <Button type="submit" className="w-full h-12" disabled={loading}>
                <LogIn className="mr-2 h-5 w-5" />
                {loading ? "Accesso in corso..." : "Accedi"}
              </Button>
            </form>
            <div className="flex justify-center mt-4">
              <Button 
                size="lg"
                variant="outline" 
                onClick={() => router.push('/primoaccesso')}
                className="justify-center hover:bg-gray-200"
              >
                vai al primo accesso
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={showInfoDialog} onOpenChange={setShowInfoDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Password Dimenticata</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Chiedi all&apos;admin di sistema: ti invierà una password temporanea per l&apos;accesso da eseguire attraverso la pagina di PRIMO ACCESSO.
            </p>
            <Button
              type="button"
              className="w-full"
              onClick={() => setShowInfoDialog(false)}
            >
              Chiudi
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AuthPage;