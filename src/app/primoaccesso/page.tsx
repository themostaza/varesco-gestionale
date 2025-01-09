"use client";

import { useState } from "react";
import { Toaster } from "sonner";
import { LogIn, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

const FirstAccessPage = () => {
  const [step, setStep] = useState<'initial' | 'setPassword'>('initial');
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const router = useRouter();

  const validatePassword = (password: string): { isValid: boolean; error: string } => {
    if (password.length < 6) {
      return { isValid: false, error: "La password deve contenere almeno 6 caratteri" };
    }
    if (!/[A-Z]/.test(password)) {
      return { isValid: false, error: "La password deve contenere almeno una lettera maiuscola" };
    }
    if (!/\d/.test(password)) {
      return { isValid: false, error: "La password deve contenere almeno un numero" };
    }
    return { isValid: true, error: "" };
  };

  const validateOtp = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError("");
  
    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: email,
        password: otp
      });
      console.log(data)
  
      if (signInError) {
        throw signInError;
      }
  
      const { data: { user } } = await supabase.auth.getUser();
      if (user && new Date(user.user_metadata.otp_expires_at) < new Date()) {
        await supabase.auth.signOut();
        throw new Error("OTP scaduto");
      }
  
      setStep('setPassword');
      toast.success("Codice OTP verificato con successo!");
  
    } catch (error) {
      console.error("Errore durante la verifica:", error);
      toast.error("Codice OTP non valido o scaduto");
    } finally {
      setLoading(false);
    }
  };

  const handleSetPassword = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError("");
  
    // Valida la password
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.isValid) {
      setError(passwordValidation.error);
      toast.error(passwordValidation.error);
      setLoading(false);
      return;
    }

    if (password !== confirmPassword) {
      setError("Le password non coincidono");
      toast.error("Le password non coincidono");
      setLoading(false);
      return;
    }
  
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const currentMetadata = user?.user_metadata || {};
  
      const { data, error } = await supabase.auth.updateUser({
        password: password,
        data: {
          ...currentMetadata,
          registration_status: 'active',
          otp: null,
          otp_expires_at: null
        }
      });
      console.log(data)
  
      if (error) throw error;
  
      toast.success("Password impostata con successo!");
      
      if (user?.user_metadata?.role === "collaboratore") {
        router.push("/produzione");
      } else {
        router.push("/dashboard");
      }
  
    } catch (error) {
      console.error("Errore durante l'impostazione della password:", error);
      toast.error("Si è verificato un errore durante l'impostazione della password");
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
          <p className="mt-2 text-gray-600">
            {step === 'initial' ? 'Primo accesso' : 'Imposta la tua password'}
          </p>
        </div>

        {step === 'initial' ? (
          <>
          <form onSubmit={validateOtp} className="space-y-4">
            <div className="space-y-4">
              <div>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setError("");
                  }}
                  placeholder="Email"
                  required
                  disabled={loading}
                  className={`h-12 ${error ? 'border-red-500' : ''}`}
                />
              </div>
              <div>
                <Input
                  type="text"
                  value={otp}
                  onChange={(e) => {
                    setOtp(e.target.value);
                    setError("");
                  }}
                  placeholder="Codice OTP"
                  required
                  disabled={loading}
                  className={`h-12 ${error ? 'border-red-500' : ''}`}
                />
              </div>
              {error && (
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
                  {error}
                </div>
              )}
            </div>
            <Button type="submit" className="w-full h-12" disabled={loading}>
              <LogIn className="mr-2 h-5 w-5" />
              {loading ? "Verifica in corso..." : "Verifica accesso"}
            </Button>
          </form>
          <div className="flex justify-center">
          <Button 
            size="lg"
            variant="outline" 
            onClick={() => router.push('/login')}
            className="justify-center hover:bg-gray-200"
          >
            vai al login
          </Button>
        </div>
      </>
        ) : (
          <form onSubmit={handleSetPassword} className="space-y-4">
            <div className="space-y-4">
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setError("");
                  }}
                  placeholder="Nuova password"
                  required
                  disabled={loading}
                  className={`h-12 ${error ? 'border-red-500' : ''}`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-3 text-gray-500 hover:text-gray-700"
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
              <div className="text-sm text-gray-600">
                La password deve contenere:
                <ul className="list-disc pl-5 mt-1">
                  <li>Almeno 6 caratteri</li>
                  <li>Almeno una lettera maiuscola</li>
                  <li>Almeno un numero</li>
                </ul>
              </div>
              <div className="relative">
                <Input
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    setError("");
                  }}
                  placeholder="Conferma password"
                  required
                  disabled={loading}
                  className={`h-12 ${error ? 'border-red-500' : ''}`}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-3 text-gray-500 hover:text-gray-700"
                >
                  {showConfirmPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
              {error && (
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
                  {error}
                </div>
              )}
            </div>
            <Button type="submit" className="w-full h-12" disabled={loading}>
              {loading ? "Impostazione in corso..." : "Imposta password e accedi"}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
};

export default FirstAccessPage;