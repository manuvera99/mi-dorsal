import Link from "next/link";

export function Footer() {
  return (
    <footer className="border-t border-gray-200 bg-white py-10 mt-12">
      <div className="mx-auto max-w-7xl px-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-8 text-sm">
          {/* Columna 1: branding */}
          <div className="col-span-2 md:col-span-1">
            <Link href="/" className="flex items-center gap-2 mb-2" aria-label="mi-dorsal">
              <img src="/icon.svg" alt="" width={32} height={32} className="h-8 w-8" aria-hidden="true" />
              <span className="text-base font-bold tracking-tight">
                <span>mi</span>
                <span className="text-gray-400 font-light">-</span>
                <span className="text-runner-primary">dorsal</span>
              </span>
            </Link>
            <p className="text-gray-500 leading-relaxed">
              El hilo que te une a tu dorsal.
            </p>
          </div>

          {/* Columna 2: producto */}
          <div>
            <h3 className="font-semibold mb-3">Producto</h3>
            <ul className="space-y-2 text-gray-600">
              <li><Link href="/carreras" className="hover:text-runner-primary">Carreras</Link></li>
              <li><Link href="/ranking" className="hover:text-runner-primary">Ranking</Link></li>
              <li><Link href="/calendario" className="hover:text-runner-primary">Mi calendario</Link></li>
              <li><Link href="/perfil" className="hover:text-runner-primary">Mi perfil</Link></li>
            </ul>
          </div>

          {/* Columna 3: legal */}
          <div>
            <h3 className="font-semibold mb-3">Legal</h3>
            <ul className="space-y-2 text-gray-600">
              <li><Link href="/legal/privacidad" className="hover:text-runner-primary">Privacidad</Link></li>
              <li><Link href="/legal/cookies" className="hover:text-runner-primary">Cookies</Link></li>
              <li><Link href="/legal/aviso-legal" className="hover:text-runner-primary">Aviso legal</Link></li>
            </ul>
          </div>

          {/* Columna 4: contacto */}
          <div>
            <h3 className="font-semibold mb-3">Contacto</h3>
            <ul className="space-y-2 text-gray-600">
              <li>
                <a href="mailto:hola@mi-dorsal.es" className="hover:text-runner-primary">
                  hola@mi-dorsal.es
                </a>
              </li>
              <li className="text-xs text-gray-400 mt-3">
                Hecho con ❤ por un corredor<br />para corredores. v0.1
              </li>
            </ul>
          </div>
        </div>

        <div className="pt-6 border-t border-gray-100 text-center text-xs text-gray-400">
          <p>© {new Date().getFullYear()} mi-dorsal · Todos los datos de carreras pertenecen a sus respectivos organizadores.</p>
        </div>
      </div>
    </footer>
  );
}
