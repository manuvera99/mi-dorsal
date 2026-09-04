import Link from "next/link";
import { Home, Search, Trophy, ArrowRight } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4 py-12">
      <div className="max-w-2xl w-full text-center">
        {/* Dorsal decorativo grande */}
        <div className="relative inline-block mb-8">
          <div className="flex h-32 w-24 md:h-40 md:w-28 items-center justify-center bg-runner-primary rounded-lg text-white font-black text-5xl md:text-6xl mx-auto shadow-xl">
            ?
          </div>
          <div className="absolute -top-3 left-1/4 w-3 h-3 bg-runner-dark rounded-full" />
          <div className="absolute -top-3 right-1/4 w-3 h-3 bg-runner-dark rounded-full" />
          <div className="absolute -top-1 left-1/4 right-1/4 h-1.5 bg-runner-dark rounded-full" />
        </div>

        <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-3">
          Dorsal no encontrado
        </h1>
        <p className="text-lg text-gray-600 mb-8 max-w-md mx-auto">
          La carrera que buscas no existe, fue descalificada o el enlace está mal.
          Te ayudamos a volver al camino.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center mb-12">
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 bg-runner-primary text-white font-semibold px-6 py-3 rounded-md hover:bg-red-700 transition-colors"
          >
            <Home className="h-4 w-4" /> Volver al inicio
          </Link>
          <Link
            href="/carreras"
            className="inline-flex items-center justify-center gap-2 border border-gray-300 bg-white text-gray-900 font-semibold px-6 py-3 rounded-md hover:bg-gray-50 transition-colors"
          >
            <Trophy className="h-4 w-4" /> Explorar carreras <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="text-sm text-gray-500">
          <p>¿Crees que es un error?</p>
          <a href="mailto:hola@mi-dorsal.es" className="text-runner-primary hover:underline">
            Escríbenos a hola@mi-dorsal.es
          </a>
        </div>
      </div>
    </div>
  );
}
