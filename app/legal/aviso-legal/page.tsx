import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Aviso legal",
  description: "Información legal sobre mi-dorsal.",
  alternates: { canonical: "/legal/aviso-legal" },
  robots: { index: true, follow: true },
};

export default function AvisoLegalPage() {
  return (
    <article className="mx-auto max-w-3xl px-4 py-12 prose prose-gray">
      <h1>Aviso legal</h1>
      <p className="text-sm text-gray-500">Última actualización: 4 de septiembre de 2026</p>

      <h2>1. Datos identificativos</h2>
      <p>
        En cumplimiento del artículo 10 de la Ley 34/2002, de 11 de julio, de Servicios de la
        Sociedad de la Información y de Comercio Electrónico (LSSI-CE), se informa al usuario
        que el sitio web <strong>mi-dorsal.es</strong> (en adelante, "el sitio") es un servicio
        prestado por su titular.
      </p>
      <ul>
        <li><strong>Titular:</strong> [Tu nombre o razón social]</li>
        <li><strong>NIF/CIF:</strong> [Tu NIF/CIF]</li>
        <li><strong>Domicilio:</strong> [Tu domicilio social]</li>
        <li><strong>Email de contacto:</strong> hola@mi-dorsal.es</li>
      </ul>

      <h2>2. Objeto y ámbito de aplicación</h2>
      <p>
        El presente aviso legal regula el acceso, la navegación y el uso de los contenidos
        publicados en el sitio web mi-dorsal.es. La utilización del sitio atribuye la condición
        de usuario y comporta la aceptación íntegra de todas las cláusulas contenidas en este
        aviso.
      </p>

      <h2>3. Propiedad intelectual e industrial</h2>
      <p>
        Todos los contenidos del sitio (textos, fotografías, gráficos, imágenes, vídeos,
        marcos sonoros, animaciones, software, ilustraciones, diseño gráfico y código fuente,
        así como las marcas, nombres comerciales y signos distintivos en él incluidos) son
        propiedad de mi-dorsal o de los terceros que han cedido sus derechos, y están protegidos
        por la normativa nacional e internacional en materia de propiedad intelectual e
        industrial.
      </p>
      <p>
        La reutilización de los contenidos del sitio para fines distintos del uso personal y
        privado requiere la autorización expresa de mi-dorsal. En particular, no se permite la
        reproducción total o parcial de los textos sin citar la fuente ("mi-dorsal") con un
        enlace a la página original.
      </p>

      <h2>4. Información sobre carreras y eventos</h2>
      <p>
        mi-dorsal actúa como agregador de información sobre carreras populares y eventos
        deportivos. La información mostrada (fechas, distancias, precios, reglamentos) proviene
        de fuentes oficiales de los organizadores y de fuentes públicas (RFEA, FEDME, etc.). A
        pesar de nuestros esfuerzos por mantenerla actualizada, <strong>mi-dorsal no se
        responsabiliza de la exactitud o vigencia de la información</strong>, que debe
        contrastarse siempre con la web oficial de cada carrera antes de tomar decisiones
        (inscripción, viaje, etc.).
      </p>
      <p>
        Si detectas información incorrecta o desactualizada, por favor escríbenos a{" "}
        <a href="mailto:hola@mi-dorsal.es">hola@mi-dorsal.es</a> para que podamos corregirla.
      </p>

      <h2>5. Enlaces a sitios de terceros</h2>
      <p>
        El sitio puede contener enlaces a páginas web de terceros (organizadores, inscripciones,
        cronometradores). mi-dorsal no se hace responsable del contenido, la veracidad o el
        funcionamiento de dichas páginas, ni de los daños que puedan derivarse de su uso.
      </p>

      <h2>6. Limitación de responsabilidad</h2>
      <p>
        mi-dorsal no garantiza la disponibilidad ininterrumpida ni el correcto funcionamiento
        del sitio, ni la ausencia total de virus u otros componentes dañinos. El usuario
        utiliza el sitio bajo su propia responsabilidad.
      </p>

      <h2>7. Legislación aplicable y jurisdicción</h2>
      <p>
        Las presentes condiciones se rigen por la legislación española. Para la resolución de
        las controversias que pudieran derivarse de su interpretación o aplicación, las partes
        se someten a los Juzgados y Tribunales de la ciudad de [tu ciudad], salvo en los
        supuestos en los que la ley fije imperativamente otro fuero distinto.
      </p>

      <h2>8. Contacto</h2>
      <p>
        Para cualquier consulta relativa a este aviso legal, puedes escribirnos a{" "}
        <a href="mailto:hola@mi-dorsal.es">hola@mi-dorsal.es</a>.
      </p>
    </article>
  );
}
