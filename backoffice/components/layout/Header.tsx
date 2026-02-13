import { Bell, Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

function initialsFromEmail(email?: string | null) {
  if (!email) return 'AD'
  const name = email.split('@')[0] || ''
  const parts = name.split(/[._-]+/).filter(Boolean)
  const a = (parts[0]?.[0] || name[0] || 'A').toUpperCase()
  const b = (parts[1]?.[0] || name[1] || 'D').toUpperCase()
  return `${a}${b}`
}

export function Header({ userEmail }: { userEmail?: string | null }) {
  const email = userEmail || null
  return (
    <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-border bg-card/80 backdrop-blur-sm px-6">
      {/* Search */}
      <div className="flex flex-1 items-center">
        <div className="relative w-full max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Buscar empresas, NIT, razón social..."
            className="pl-10"
          />
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-destructive" />
        </Button>

        <div className="flex items-center gap-3 border-l border-border pl-3">
          <div className="text-right text-sm">
            <p className="font-medium text-foreground">Admin</p>
            <p className="text-muted-foreground">{email ?? 'sin-email'}</p>
          </div>
          <div className="h-10 w-10 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-medium">
            {initialsFromEmail(email)}
          </div>
        </div>
      </div>
    </header>
  )
}
