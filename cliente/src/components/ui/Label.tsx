import * as React from 'react'
import { cn } from '@/lib/utils'

export interface LabelProps extends React.LabelHTMLAttributes<HTMLLabelElement> {
  variant?: 'default' | 'typeform'
}

const Label = React.forwardRef<HTMLLabelElement, LabelProps>(
  ({ className, variant = 'default', ...props }, ref) => {
    const base =
      variant === 'typeform'
        ? 'typeform-label'
        : 'text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70'

    return (
      <label
        ref={ref}
        className={cn(base, className)}
        {...props}
      />
    )
  }
)
Label.displayName = 'Label'

export { Label }
