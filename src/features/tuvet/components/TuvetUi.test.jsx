import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { FileDrop } from './TuvetUi'

describe('FileDrop', () => {
  it('keeps the visible picker trigger keyboard-focusable and the focused input exposed to assistive technology', () => {
    const onChange = vi.fn()
    render(<FileDrop accept=".xlsx" file={null} onChange={onChange} />)

    const trigger = screen.getByRole('button', { name: /arrastra el archivo/i })
    const input = document.querySelector('input[type="file"]')
    const click = vi.spyOn(input, 'click')
    trigger.focus()
    fireEvent.click(trigger)

    expect(trigger).toHaveFocus()
    expect(click).toHaveBeenCalledOnce()
    expect(input).not.toHaveAttribute('aria-hidden', 'true')
  })

  it('supports file selection, removal, and the disabled state', () => {
    const onChange = vi.fn()
    const file = new File(['xlsx'], 'inventory.xlsx')
    const { rerender } = render(<FileDrop accept=".xlsx" file={null} onChange={onChange} />)

    fireEvent.change(document.querySelector('input[type="file"]'), { target: { files: [file] } })
    expect(onChange).toHaveBeenCalledWith(file)

    rerender(<FileDrop accept=".xlsx" file={file} onChange={onChange} />)
    fireEvent.click(screen.getByRole('button', { name: 'Quitar' }))
    expect(onChange).toHaveBeenLastCalledWith(null)

    rerender(<FileDrop accept=".xlsx" file={null} onChange={onChange} disabled />)
    expect(screen.getByRole('button', { name: /arrastra el archivo/i })).toBeDisabled()
    expect(document.querySelector('input[type="file"]')).toBeDisabled()
  })
})
