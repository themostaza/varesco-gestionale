// middleware.ts
import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();
  const supabase = createMiddlewareClient({ req, res });
  const { data: { session } } = await supabase.auth.getSession();

 

  // Lista delle pagine pubbliche che non richiedono autenticazione
  const publicPages = ['/login', '/', '/auth/reset-password', '/primoaccesso', '/admin/x7k9m2p4v3'];
  const isPublicPage = publicPages.includes(req.nextUrl.pathname) || 
                      req.nextUrl.pathname.match(/^\/ebudgets\/[\w-]+$/);

  // Se non c'è sessione e non è una pagina pubblica, redirect al login
  if (!session && !isPublicPage) {
    return NextResponse.redirect(new URL('/login', req.url));
  }

  // Se c'è sessione e l'utente prova ad accedere al login, redirect alla dashboard
  if (session && req.nextUrl.pathname === '/login') {
    console.log('scatta?', session)
    return NextResponse.redirect(new URL('/dashboard', req.url));
  }

  return res;
}

// Specifica su quali path deve essere eseguito il middleware
export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};