import { ChevronUp, ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/Button'

interface TypeformNavigationProps {
  onPrev: () => void
  onNext: () => void
  canGoPrev: boolean
  canGoNext: boolean
  showSubmit?: boolean
  submitLabel?: string
  loading?: boolean
  onSubmitClick?: () => void
}

export function TypeformNavigation({
  onPrev,
  onNext,
  canGoPrev,
  canGoNext,
  showSubmit,
  submitLabel,
  loading,
  onSubmitClick,
}: TypeformNavigationProps) {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-4 flex items-center justify-between bg-background/80 backdrop-blur-sm border-t border-border">
      <div className="flex gap-1">
        <Button
          variant="outline"
          size="icon"
          onClick={onPrev}
          disabled={!canGoPrev}
          type="button"
        >
          <ChevronUp className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          onClick={onNext}
          disabled={!canGoNext && !showSubmit}
          type="button"
        >
          <ChevronDown className="h-4 w-4" />
        </Button>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-xs text-muted-foreground hidden sm:inline">
          presiona{' '}
          <kbd className="px-1.5 py-0.5 bg-secondary rounded text-xs font-mono text-secondary-foreground">
            Enter
          </kbd>
        </span>
        {showSubmit ? (
          <Button
            size="typeform"
            type={onSubmitClick ? 'button' : 'submit'}
            disabled={loading}
            onClick={onSubmitClick}
          >
            {loading ? 'Enviando...' : submitLabel || 'Enviar'}
          </Button>
        ) : (
          <Button size="typeform" onClick={onNext} disabled={!canGoNext} type="button">
            OK
          </Button>
        )}
      </div>
    </div>
  )
}
