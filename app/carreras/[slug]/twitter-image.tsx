// Re-export del opengraph-image.tsx para Twitter Cards.
// Next 15: si opengraph-image.tsx existe en la misma ruta, no es necesario
// crear twitter-image.tsx separado — Next lo detecta automaticamente.
// Pero algunos scrapers antiguos solo leen /twitter-image, asi que lo creamos
// como alias para garantizar cobertura.
export { default, size, contentType, generateImageMetadata } from "./opengraph-image";