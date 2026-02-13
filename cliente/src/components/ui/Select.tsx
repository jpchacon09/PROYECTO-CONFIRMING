import * as React from 'react'
import { cn } from '@/lib/utils'

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  variant?: 'default' | 'typeform'
}

const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, children, variant = 'default', ...props }, ref) => {
    const base =
      variant === 'typeform'
        ? 'typeform-select'
        : 'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50'

    return (
      <select
        className={cn(base, className)}
        ref={ref}
        {...props}
      >
        {children}
      </select>
    )
  }
)
Select.displayName = 'Select'

export { Select }
