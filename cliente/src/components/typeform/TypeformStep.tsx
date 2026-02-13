import { motion } from 'framer-motion'
import type { ReactNode } from 'react'

interface TypeformStepProps {
  children: ReactNode
  stepNumber?: number
  totalSteps?: number
}

export function TypeformStep({ children, stepNumber, totalSteps }: TypeformStepProps) {
  return (
    <motion.div
      className="typeform-step"
      initial={{ opacity: 0, y: 40 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -40 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
    >
      <div className="typeform-content">
        {stepNumber != null && totalSteps != null && (
          <p className="text-sm text-muted-foreground mb-6 font-medium">
            {stepNumber} <span className="text-muted-foreground/50">/ {totalSteps}</span>
          </p>
        )}
        {children}
      </div>
    </motion.div>
  )
}
