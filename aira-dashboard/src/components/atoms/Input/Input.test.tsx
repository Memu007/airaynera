import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { Input } from './Input';

describe('Input component', () => {
  it('should render the input with a label and placeholder', () => {
    render(
      <Input
        id="test-input"
        label="Test Label"
        placeholder="Enter text"
        value=""
        onChange={() => {}}
      />
    );
    expect(screen.getByLabelText(/Test Label/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Enter text/i)).toBeInTheDocument();
  });

  it('should display the correct value', () => {
    render(
      <Input
        id="test-input"
        label="Test Label"
        value="test value"
        onChange={() => {}}
      />
    );
    const inputElement = screen.getByLabelText(/Test Label/i) as HTMLInputElement;
    expect(inputElement.value).toBe('test value');
  });

  it('should call the onChange handler when the user types', () => {
    const handleChange = vi.fn();
    render(
      <Input
        id="test-input"
        label="Test Label"
        value=""
        onChange={handleChange}
      />
    );
    const inputElement = screen.getByLabelText(/Test Label/i);
    fireEvent.change(inputElement, { target: { value: 'new value' } });
    expect(handleChange).toHaveBeenCalledTimes(1);
  });
});
