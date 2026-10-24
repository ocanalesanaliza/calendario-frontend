import { cleanup, configure } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { afterEach } from 'vitest'

// Con toda la suite en paralelo (más de 160 archivos), el 1 s por defecto de findBy/waitFor
// hacía fallar al azar pruebas que pasan solas. 5 s da margen sin ocultar fallos reales.
configure({ asyncUtilTimeout: 5000 })

afterEach(() => {
  cleanup()
})
