/**
 * Prepara imagens para o OCR sem armazená-las no navegador ou no servidor.
 * O visor costuma ocupar uma fração da foto original; limitar a dimensão e a
 * qualidade reduz tempo, memória e custo da chamada multimodal.
 */
export interface PreparedAiImage {
  base64: string
  mimeType: string
  width?: number
  height?: number
  bytes: number
}

const MAX_DIMENSION = 1_600
const TARGET_BYTES = 1_500_000

function readAsDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(reader.error || new Error('Não foi possível ler a imagem.'))
    reader.readAsDataURL(blob)
  })
}

function dataUrlParts(dataUrl: string) {
  const separator = dataUrl.indexOf(',')
  if (separator < 0) throw new Error('Formato de imagem inválido.')
  const metadata = dataUrl.slice(0, separator)
  return {
    mimeType: metadata.match(/^data:([^;]+)/)?.[1] || 'image/jpeg',
    base64: dataUrl.slice(separator + 1),
  }
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const image = new Image()
    image.onload = () => {
      URL.revokeObjectURL(url)
      resolve(image)
    }
    image.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Não foi possível abrir a imagem.'))
    }
    image.src = url
  })
}

function canvasBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob)
      else reject(new Error('Não foi possível preparar a imagem.'))
    }, 'image/jpeg', quality)
  })
}

export async function prepareImageForAi(file: File): Promise<PreparedAiImage> {
  if (!file.type.startsWith('image/')) {
    const dataUrl = await readAsDataUrl(file)
    const parts = dataUrlParts(dataUrl)
    return { ...parts, bytes: file.size }
  }

  const image = await loadImage(file)
  const scale = Math.min(1, MAX_DIMENSION / Math.max(image.naturalWidth, image.naturalHeight))
  const width = Math.max(1, Math.round(image.naturalWidth * scale))
  const height = Math.max(1, Math.round(image.naturalHeight * scale))
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Seu navegador não conseguiu preparar a imagem.')
  context.drawImage(image, 0, 0, width, height)

  let quality = 0.84
  let blob = await canvasBlob(canvas, quality)
  while (blob.size > TARGET_BYTES && quality > 0.52) {
    quality -= 0.08
    blob = await canvasBlob(canvas, quality)
  }
  const dataUrl = await readAsDataUrl(blob)
  return { ...dataUrlParts(dataUrl), width, height, bytes: blob.size }
}
