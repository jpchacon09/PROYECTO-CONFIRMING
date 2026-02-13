import { useState, useCallback, useEffect } from 'react'
import type { UseFormTrigger, FieldPath, FieldValues } from 'react-hook-form'

interface StepConfig<T extends FieldValues> {
  fields: FieldPath<T>[]
}

export function useTypeformNavigation<T extends FieldValues>(
  steps: StepConfig<T>[],
  trigger: UseFormTrigger<T>
) {
  const [currentStep, setCurrentStep] = useState(0)

  const goToNext = useCallback(async () => {
    const currentFields = steps[currentStep].fields
    const isValid = await trigger(currentFields)
    if (isValid && currentStep < steps.length - 1) {
      setCurrentStep((prev) => prev + 1)
    }
    return isValid
  }, [currentStep, steps, trigger])

  const goToPrev = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep((prev) => prev - 1)
    }
  }, [currentStep])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName
      // Don't intercept Enter on select or textarea
      if (e.key === 'Enter' && !e.shiftKey && tag !== 'SELECT' && tag !== 'TEXTAREA') {
        e.preventDefault()
        void goToNext()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [goToNext])

  return {
    currentStep,
    setCurrentStep,
    goToNext,
    goToPrev,
    isFirstStep: currentStep === 0,
    isLastStep: currentStep === steps.length - 1,
    totalSteps: steps.length,
  }
}
