interface TypeformProgressProps {
  current: number
  total: number
}

export function TypeformProgress({ current, total }: TypeformProgressProps) {
  const percentage = Math.round((current / total) * 100)

  return (
    <div className="fixed top-0 left-0 right-0 z-50">
      <div className="flex items-center px-6 py-3">
        <img src="/logo.png" alt="Confirming" className="h-7" />
        <span className="ml-auto text-xs text-muted-foreground">{percentage}%</span>
      </div>
      <div className="h-1 bg-muted">
        <div
          className="h-full bg-primary transition-all duration-500 ease-out"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  )
}
