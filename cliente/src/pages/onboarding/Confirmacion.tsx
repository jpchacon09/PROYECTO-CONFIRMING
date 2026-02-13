import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/Button'

export function Confirmacion() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-6">
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', stiffness: 200, damping: 15 }}
      >
        <svg className="w-24 h-24" viewBox="0 0 52 52">
          <motion.circle
            cx="26"
            cy="26"
            r="24"
            fill="none"
            stroke="hsl(var(--success))"
            strokeWidth="2"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
          />
          <motion.path
            d="M14.1 27.2l7.1 7.2 16.7-16.8"
            fill="none"
            stroke="hsl(var(--success))"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.4, delay: 0.6, ease: 'easeOut' }}
          />
        </svg>
      </motion.div>

      <motion.h1
        className="text-3xl md:text-4xl font-bold text-foreground mt-8 text-center"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.9, duration: 0.5 }}
      >
        ¡Solicitud enviada!
      </motion.h1>

      <motion.div
        className="max-w-lg text-center space-y-4 mt-6"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.1, duration: 0.5 }}
      >
        <p className="text-lg text-muted-foreground">
          Hemos recibido tu solicitud de onboarding. Nuestro equipo revisará la información
          y los documentos que subiste.
        </p>
        <p className="text-muted-foreground">
          Te notificaremos por email cuando haya novedades.
        </p>
        <p className="text-sm text-muted-foreground">
          <strong>Tiempo estimado de revisión:</strong> 2 a 3 días hábiles
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.4, duration: 0.5 }}
        className="mt-10"
      >
        <Button size="typeform" onClick={() => navigate('/dashboard')}>
          Ir a mi panel
        </Button>
      </motion.div>
    </div>
  )
}
